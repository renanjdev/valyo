import { Queue } from 'bullmq';
import { PrismaClient } from '@mensageira/db';
import Redis from 'ioredis';
import pino from 'pino';
import { SequenceExecutor } from './jobs/sequence-executor.js';
import { PendingScan } from './cron/scan-pending.js';
import { QUEUE_WHATSAPP_SEND } from '@mensageira/contracts';
import { randomUUID } from 'node:crypto';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const SCAN_INTERVAL_MS = 30_000; // 30 seconds

async function start() {
  const db = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
  });

  const sendQueue = new Queue(QUEUE_WHATSAPP_SEND, { connection: redis });
  const workerId = `scheduler-${randomUUID().slice(0, 8)}`;

  const executor = new SequenceExecutor(db, sendQueue);
  const scanner = new PendingScan(db, executor, workerId);

  logger.info({ workerId }, 'Scheduler started');

  // Periodic scan
  const interval = setInterval(async () => {
    try {
      await scanner.scan();
    } catch (error: any) {
      logger.error({ error: error.message }, 'Scan failed');
    }
  }, SCAN_INTERVAL_MS);

  // Initial scan
  await scanner.scan();

  process.on('SIGTERM', async () => {
    logger.info('Shutting down...');
    clearInterval(interval);
    await db.$disconnect();
    process.exit(0);
  });
}

start().catch((err) => {
  logger.fatal(err, 'Failed to start scheduler');
  process.exit(1);
});
