import type { PrismaClient } from '@mensageira/db';
import type { SequenceExecutor } from '../jobs/sequence-executor.js';
import pino from 'pino';

const logger = pino({ level: 'info' });
const BATCH_SIZE = 50;
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class PendingScan {
  constructor(
    private db: PrismaClient,
    private executor: SequenceExecutor,
    private workerId: string,
  ) {}

  async scan(): Promise<number> {
    // Release stale locks
    const staleThreshold = new Date(Date.now() - LOCK_TIMEOUT_MS);
    await this.db.leadSequence.updateMany({
      where: { lockedAt: { lt: staleThreshold }, status: 'active' },
      data: { lockedAt: null, lockedBy: null },
    });

    // Find pending sends
    const pending = await this.db.leadSequence.findMany({
      where: {
        status: 'active',
        lockedAt: null,
        nextSendAt: { lte: new Date() },
        retryCount: { lt: 3 },
      },
      take: BATCH_SIZE,
      orderBy: { nextSendAt: 'asc' },
    });

    logger.info({ count: pending.length }, 'Pending sequences found');

    for (const ls of pending) {
      await this.executor.executeStep(ls.id, this.workerId);
    }

    return pending.length;
  }
}
