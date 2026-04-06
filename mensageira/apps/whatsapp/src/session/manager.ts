import type { PrismaClient } from '@mensageira/db';
import type { WhatsAppProvider, ConnectionStatus } from '../providers/provider.interface.js';

export class SessionManager {
  constructor(
    private db: PrismaClient,
    private provider: WhatsAppProvider,
    private accountId: string,
    private phone: string,
  ) {}

  async initialize(): Promise<void> {
    this.provider.onConnectionChange(async (status, qr) => {
      await this.updateSessionStatus(status);
    });
  }

  async getOrCreateSession() {
    let session = await this.db.whatsAppSession.findUnique({
      where: { accountId_phone: { accountId: this.accountId, phone: this.phone } },
    });
    if (!session) {
      session = await this.db.whatsAppSession.create({
        data: { accountId: this.accountId, phone: this.phone, status: 'disconnected' },
      });
    }
    return session;
  }

  private async updateSessionStatus(status: ConnectionStatus) {
    const dbStatus = status === 'qr_pending' ? 'disconnected' : status;
    await this.db.whatsAppSession.upsert({
      where: { accountId_phone: { accountId: this.accountId, phone: this.phone } },
      update: {
        status: dbStatus,
        ...(status === 'connected' ? { lastConnectedAt: new Date() } : {}),
      },
      create: { accountId: this.accountId, phone: this.phone, status: dbStatus },
    });
  }
}
