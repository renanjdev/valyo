import type { Queue } from 'bullmq';
import type { PrismaClient } from '@mensageira/db';
import { generateId } from '@mensageira/shared';
import type { IncomingMessage } from '../providers/provider.interface.js';

export class MessageHandler {
  constructor(
    private db: PrismaClient,
    private aiQueue: Queue,
  ) {}

  async handleIncoming(accountId: string, message: IncomingMessage): Promise<void> {
    // Find or create conversation
    const lead = await this.db.lead.findFirst({
      where: { accountId, phone: message.from },
    });
    if (!lead) return; // Unknown number, ignore

    let conversation = await this.db.conversation.findUnique({
      where: { accountId_leadId_channel: { accountId, leadId: lead.id, channel: 'whatsapp' } },
    });

    if (!conversation) {
      conversation = await this.db.conversation.create({
        data: { accountId, leadId: lead.id, channel: 'whatsapp' },
      });
    }

    // Store message
    const correlationId = generateId();
    await this.db.message.create({
      data: {
        accountId, conversationId: conversation.id,
        externalId: message.externalId, correlationId,
        direction: 'inbound', sender: 'lead',
        content: message.content, contentType: message.contentType,
        status: 'delivered',
        sentAt: new Date(message.timestamp * 1000),
        deliveredAt: new Date(),
      },
    });

    await this.db.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    // Update lead status if new
    if (lead.status === 'new' || lead.status === 'waiting' || lead.status === 'prospecting') {
      await this.db.lead.update({
        where: { id: lead.id },
        data: { status: 'engaged', lastContactedAt: new Date() },
      });
    }

    // Enqueue for AI processing if enabled
    if (conversation.aiEnabled && message.contentType === 'text') {
      await this.aiQueue.add('process', {
        conversationId: conversation.id,
        leadId: lead.id,
        message: message.content,
        correlationId,
        accountId,
        context: {
          leadStatus: lead.status,
          leadScore: lead.score,
          temperature: lead.temperature,
          conversationHistory: [],
        },
      });
    }
  }
}
