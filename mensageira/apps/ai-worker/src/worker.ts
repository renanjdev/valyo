import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@mensageira/db';
import Redis from 'ioredis';
import pino from 'pino';
import { QUEUE_AI_PROCESS, QUEUE_WHATSAPP_SEND, QUEUE_NOTIFICATION_SEND } from '@mensageira/contracts';
import { AI_CONFIDENCE_THRESHOLD, generateId } from '@mensageira/shared';
import { getSystemPrompt, getClassificationPrompt } from './prompts/system.js';
import { IntentClassifier, ResponseGenerator } from './classifier/intent.js';
import { calculateTemperature, isHotLead } from './scoring/calculator.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function start() {
  const db = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required');

  const classifier = new IntentClassifier(apiKey);
  const generator = new ResponseGenerator(apiKey);
  const sendQueue = new Queue(QUEUE_WHATSAPP_SEND, { connection: redis });
  const notifyQueue = new Queue(QUEUE_NOTIFICATION_SEND, { connection: redis });

  const worker = new Worker(QUEUE_AI_PROCESS, async (job) => {
    const { conversationId, leadId, message, context, correlationId, accountId } = job.data;

    logger.info({ conversationId, leadId }, 'Processing AI request');

    // 1. Classify intent
    const classification = await classifier.classify(message, getClassificationPrompt());

    // 2. Update score
    if (classification.scoreDelta !== 0) {
      const lead = await db.lead.findUnique({ where: { id: leadId } });
      if (lead) {
        const newScore = Math.max(0, lead.score + classification.scoreDelta);
        const temperature = calculateTemperature(newScore);

        await db.lead.update({
          where: { id: leadId },
          data: { score: newScore, temperature },
        });

        await db.leadEvent.create({
          data: {
            accountId, leadId, type: 'score_change', actor: 'ai',
            data: { from: lead.score, to: newScore, delta: classification.scoreDelta, reason: classification.scoreReason },
          },
        });

        // Notify if lead became hot
        if (isHotLead(newScore) && !isHotLead(lead.score)) {
          await notifyQueue.add('notify', {
            accountId, type: 'lead_hot',
            data: { leadId, leadName: lead.name, score: newScore },
            correlationId,
          });
        }
      }
    }

    // 3. Handle action
    if (classification.action === 'stop') {
      await db.conversation.update({
        where: { id: conversationId },
        data: { aiEnabled: false },
      });
      await db.leadSequence.updateMany({
        where: { leadId, status: 'active' },
        data: { status: 'cancelled' },
      });
      logger.info({ leadId }, 'Stopped automation — lead requested');
      return;
    }

    if (classification.action === 'transfer_human') {
      await db.conversation.update({
        where: { id: conversationId },
        data: { aiEnabled: false },
      });
      await db.lead.update({ where: { id: leadId }, data: { status: 'qualified' } });
      await notifyQueue.add('notify', {
        accountId, type: 'takeover_needed',
        data: { leadId, conversationId, reason: classification.scoreReason },
        correlationId,
      });
      logger.info({ leadId }, 'Transferred to human');
      return;
    }

    if (classification.action === 'notify_human') {
      await notifyQueue.add('notify', {
        accountId, type: 'ai_uncertain',
        data: { leadId, conversationId, message, confidence: classification.confidence },
        correlationId,
      });
      return;
    }

    // 4. Generate response
    const lead = await db.lead.findUnique({ where: { id: leadId } });
    if (!lead) return;

    const systemPrompt = getSystemPrompt({
      name: lead.name, status: lead.status,
      score: lead.score, temperature: lead.temperature,
    });

    const history = context.conversationHistory || [];
    const response = await generator.generate(systemPrompt, history, message);

    if (response.confidence < AI_CONFIDENCE_THRESHOLD) {
      await notifyQueue.add('notify', {
        accountId, type: 'ai_uncertain',
        data: { leadId, conversationId, confidence: response.confidence },
        correlationId,
      });
      return;
    }

    // 5. Send response
    const newCorrelationId = generateId();
    await db.message.create({
      data: {
        accountId, conversationId, correlationId: newCorrelationId,
        direction: 'outbound', sender: 'ai',
        content: response.content, contentType: 'text', status: 'queued',
      },
    });

    await sendQueue.add('send', {
      conversationId, content: response.content,
      correlationId: newCorrelationId, accountId,
    });

    logger.info({ leadId, action: 'respond' }, 'AI response sent');
  }, {
    connection: redis,
    concurrency: 3,
  });

  logger.info('AI Worker started');

  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await worker.close();
    await db.$disconnect();
    process.exit(0);
  });
}

start().catch((err) => {
  logger.fatal(err, 'Failed to start AI worker');
  process.exit(1);
});
