import type { PrismaClient } from '@mensageira/db';
import { generateId } from '@mensageira/shared';
import { AppError } from '../../lib/errors.js';

export class ConversationsService {
  constructor(private db: PrismaClient) {}

  async list(accountId: string, query: any) {
    const where: any = { accountId };
    if (query.status) where.status = query.status;
    if (query.aiEnabled !== undefined) where.aiEnabled = query.aiEnabled;

    const conversations = await this.db.conversation.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { lastMessageAt: 'desc' },
      include: {
        lead: { select: { id: true, name: true, phone: true, status: true, score: true, temperature: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    const hasMore = conversations.length > query.limit;
    const items = hasMore ? conversations.slice(0, -1) : conversations;
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async getByLead(accountId: string, leadId: string) {
    const conversation = await this.db.conversation.findUnique({
      where: { accountId_leadId_channel: { accountId, leadId, channel: 'whatsapp' } },
      include: { lead: true },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');
    return conversation;
  }

  async getMessages(accountId: string, conversationId: string, query: any) {
    const conversation = await this.db.conversation.findFirst({
      where: { id: conversationId, accountId },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

    const messages = await this.db.message.findMany({
      where: { conversationId, accountId },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    const hasMore = messages.length > query.limit;
    const items = hasMore ? messages.slice(0, -1) : messages;
    return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
  }

  async sendMessage(accountId: string, conversationId: string, content: string, correlationId?: string) {
    const conversation = await this.db.conversation.findFirst({
      where: { id: conversationId, accountId },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

    const message = await this.db.message.create({
      data: {
        accountId, conversationId, content,
        direction: 'outbound', sender: 'human',
        contentType: 'text', status: 'queued',
        correlationId: correlationId || generateId(),
      },
    });

    await this.db.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });

    // TODO: enqueue to whatsapp:send via BullMQ (Plan 3)
    return message;
  }

  async update(accountId: string, conversationId: string, data: any) {
    const conversation = await this.db.conversation.findFirst({
      where: { id: conversationId, accountId },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

    return this.db.conversation.update({ where: { id: conversationId }, data });
  }

  async takeover(accountId: string, conversationId: string) {
    const conversation = await this.db.conversation.findFirst({
      where: { id: conversationId, accountId },
    });
    if (!conversation) throw new AppError(404, 'Conversation not found', 'NOT_FOUND');

    return this.db.conversation.update({
      where: { id: conversationId },
      data: { aiEnabled: false },
    });
  }
}
