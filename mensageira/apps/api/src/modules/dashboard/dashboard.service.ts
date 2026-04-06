import type { PrismaClient } from '@mensageira/db';

export class DashboardService {
  constructor(private db: PrismaClient) {}

  async overview(accountId: string) {
    const [totalLeads, byStatus, byTemperature, activeSequences] = await Promise.all([
      this.db.lead.count({ where: { accountId } }),
      this.db.lead.groupBy({ by: ['status'], where: { accountId }, _count: true }),
      this.db.lead.groupBy({ by: ['temperature'], where: { accountId }, _count: true }),
      this.db.leadSequence.count({ where: { accountId, status: 'active' } }),
    ]);

    return {
      totalLeads,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      byTemperature: Object.fromEntries(byTemperature.map(t => [t.temperature, t._count])),
      activeSequences,
    };
  }

  async metrics(accountId: string, period: string) {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [totalMessages, responses, conversions] = await Promise.all([
      this.db.message.count({ where: { accountId, createdAt: { gte: since }, direction: 'outbound' } }),
      this.db.message.count({ where: { accountId, createdAt: { gte: since }, direction: 'inbound' } }),
      this.db.lead.count({ where: { accountId, status: { in: ['qualified', 'won'] }, updatedAt: { gte: since } } }),
    ]);

    return {
      period, totalMessages, responses,
      responseRate: totalMessages > 0 ? (responses / totalMessages * 100).toFixed(1) : '0',
      conversions,
    };
  }

  async activity(accountId: string) {
    return this.db.leadEvent.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { lead: { select: { id: true, name: true } } },
    });
  }
}
