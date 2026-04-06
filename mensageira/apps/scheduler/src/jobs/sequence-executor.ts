import type { PrismaClient } from '@mensageira/db';
import type { Queue } from 'bullmq';
import { generateId } from '@mensageira/shared';
import pino from 'pino';

const logger = pino({ level: 'info' });

export class SequenceExecutor {
  constructor(
    private db: PrismaClient,
    private sendQueue: Queue,
  ) {}

  async executeStep(leadSequenceId: string, workerId: string): Promise<void> {
    // Lock with optimistic locking
    const locked = await this.db.leadSequence.updateMany({
      where: { id: leadSequenceId, lockedAt: null, status: 'active' },
      data: { lockedAt: new Date(), lockedBy: workerId },
    });
    if (locked.count === 0) return; // Already locked or not active

    try {
      const ls = await this.db.leadSequence.findUnique({
        where: { id: leadSequenceId },
        include: { sequence: true, lead: true },
      });
      if (!ls || ls.status !== 'active') return;

      const steps = ls.sequence.steps as any[];
      const currentStep = steps[ls.currentStep];
      if (!currentStep) {
        await this.db.leadSequence.update({
          where: { id: leadSequenceId },
          data: { status: 'completed', completedAt: new Date(), lockedAt: null, lockedBy: null },
        });
        return;
      }

      // Find or create conversation
      let conversation = await this.db.conversation.findUnique({
        where: {
          accountId_leadId_channel: {
            accountId: ls.accountId, leadId: ls.leadId, channel: 'whatsapp',
          },
        },
      });
      if (!conversation) {
        conversation = await this.db.conversation.create({
          data: { accountId: ls.accountId, leadId: ls.leadId, channel: 'whatsapp' },
        });
      }

      const correlationId = generateId();

      // Create outbound message
      await this.db.message.create({
        data: {
          accountId: ls.accountId,
          conversationId: conversation.id,
          correlationId,
          direction: 'outbound',
          sender: 'ai',
          content: currentStep.template.replace('[Nome]', ls.lead.name),
          contentType: 'text',
          status: 'queued',
        },
      });

      // Enqueue for WhatsApp send
      await this.sendQueue.add('send', {
        conversationId: conversation.id,
        content: currentStep.template.replace('[Nome]', ls.lead.name),
        correlationId,
        accountId: ls.accountId,
      });

      // Calculate next step
      const nextStepIndex = ls.currentStep + 1;
      if (nextStepIndex >= steps.length) {
        await this.db.leadSequence.update({
          where: { id: leadSequenceId },
          data: {
            currentStep: nextStepIndex,
            status: 'completed', completedAt: new Date(),
            lockedAt: null, lockedBy: null,
          },
        });
      } else {
        const nextStep = steps[nextStepIndex];
        const nextSendAt = new Date();
        nextSendAt.setDate(nextSendAt.getDate() + nextStep.delayDays);

        await this.db.leadSequence.update({
          where: { id: leadSequenceId },
          data: {
            currentStep: nextStepIndex,
            nextSendAt,
            lockedAt: null, lockedBy: null,
          },
        });
      }

      await this.db.lead.update({
        where: { id: ls.leadId },
        data: { lastContactedAt: new Date(), status: 'waiting' },
      });

      logger.info({ leadSequenceId, step: ls.currentStep }, 'Step executed');
    } catch (error: any) {
      await this.db.leadSequence.update({
        where: { id: leadSequenceId },
        data: {
          retryCount: { increment: 1 },
          lastError: error.message,
          lockedAt: null, lockedBy: null,
        },
      });
      logger.error({ leadSequenceId, error: error.message }, 'Step execution failed');
    }
  }
}
