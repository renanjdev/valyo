import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@mensageira/db';
import Redis from 'ioredis';
import pino from 'pino';
import { BaileysProvider } from './providers/baileys.provider.js';
import { MessageHandler } from './handlers/message.handler.js';
import { SessionManager } from './session/manager.js';
import {
  QUEUE_WHATSAPP_SEND, QUEUE_AI_PROCESS,
} from '@mensageira/contracts';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function start() {
  const db = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  const sessionPath = process.env.WA_SESSION_PATH || './sessions';
  const accountId = process.env.WA_ACCOUNT_ID || '';

  const provider = new BaileysProvider(sessionPath);
  const aiQueue = new Queue(QUEUE_AI_PROCESS, { connection: redis });
  const messageHandler = new MessageHandler(db, aiQueue);

  provider.onMessage(async (message) => {
    logger.info({ from: message.from }, 'Incoming message');
    await messageHandler.handleIncoming(accountId, message);
  });

  provider.onConnectionChange((status, qr) => {
    logger.info({ status }, 'Connection status changed');
    if (qr) logger.info('QR code available');
  });

  // Process outbound messages
  const sendWorker = new Worker(QUEUE_WHATSAPP_SEND, async (job) => {
    const { content } = job.data;
    const conversation = await db.conversation.findUnique({
      where: { id: job.data.conversationId },
      include: { lead: true },
    });
    if (!conversation) return;

    const result = await provider.sendMessage(conversation.lead.phone, { text: content });

    if (result.success) {
      await db.message.updateMany({
        where: { correlationId: job.data.correlationId },
        data: { status: 'sent', sentAt: new Date(), externalId: result.externalId },
      });
    } else {
      await db.message.updateMany({
        where: { correlationId: job.data.correlationId },
        data: { status: 'failed', failedAt: new Date(), error: result.error },
      });
    }
  }, { connection: redis });

  await provider.connect();
  logger.info('WhatsApp service started');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    await sendWorker.close();
    await provider.disconnect();
    await db.$disconnect();
    process.exit(0);
  });
}

start().catch((err) => {
  logger.fatal(err, 'Failed to start WhatsApp service');
  process.exit(1);
});
