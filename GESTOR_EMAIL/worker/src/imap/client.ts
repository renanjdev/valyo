import { ImapFlow } from 'imapflow';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

export interface RawMessage {
  uid: number;
  source: Buffer;
}

export class ImapClient {
  private client: ImapFlow | null = null;

  async connect(): Promise<void> {
    await withRetry(
      async () => {
        this.client = new ImapFlow({
          host: config.imap.host,
          port: config.imap.port,
          secure: config.imap.tls,
          auth: {
            user: config.imap.user,
            pass: config.imap.password,
          },
          logger: false,
        });

        await this.client.connect();
        logger.info({ host: config.imap.host, user: config.imap.user }, 'IMAP connected');
      },
      { maxRetries: config.worker.maxRetries, delayMs: config.worker.retryDelayMs, label: 'imap-connect' },
    );
  }

  async fetchNewUIDs(processedUIDs: Set<number>): Promise<number[]> {
    if (!this.client) throw new Error('IMAP not connected');

    const lock = await this.client.getMailboxLock(config.imap.mailbox);
    try {
      const allUIDs: number[] = [];

      for await (const msg of this.client.fetch('1:*', { uid: true })) {
        if (!processedUIDs.has(msg.uid)) {
          allUIDs.push(msg.uid);
        }
      }

      logger.info({ total: allUIDs.length, mailbox: config.imap.mailbox }, 'New UIDs found');
      return allUIDs.slice(0, config.worker.maxEmailsPerBatch);
    } finally {
      lock.release();
    }
  }

  async fetchMessage(uid: number): Promise<RawMessage> {
    if (!this.client) throw new Error('IMAP not connected');

    const lock = await this.client.getMailboxLock(config.imap.mailbox);
    try {
      const msg = await this.client.fetchOne(`${uid}`, { source: true }, { uid: true });
      if (!msg || !msg.source) throw new Error(`No message returned for UID ${uid}`);
      return { uid: msg.uid, source: msg.source };
    } finally {
      lock.release();
    }
  }

  async fetchMessages(uids: number[]): Promise<RawMessage[]> {
    if (!this.client) throw new Error('IMAP not connected');

    const messages: RawMessage[] = [];
    const lock = await this.client.getMailboxLock(config.imap.mailbox);
    try {
      for (const uid of uids) {
        try {
          // Use UID range format to force UID FETCH instead of sequence FETCH
          const msg = await this.client.fetchOne(`${uid}`, { source: true }, { uid: true });
          if (!msg || !msg.source) { logger.warn({ uid }, 'No message returned, skipping'); continue; }
          messages.push({ uid: msg.uid, source: msg.source });
        } catch (err) {
          logger.warn({ uid, err }, 'Failed to fetch message, skipping');
        }
      }
    } finally {
      lock.release();
    }

    return messages;
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.logout();
      this.client = null;
      logger.debug('IMAP disconnected');
    }
  }
}
