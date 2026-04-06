import type { PrismaClient } from '@mensageira/db';
import { AppError } from '../../lib/errors.js';

export class SequencesService {
  constructor(private db: PrismaClient) {}

  async list(accountId: string) {
    const sequences = await this.db.sequence.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });

    const stats = await Promise.all(
      sequences.map(async (seq) => {
        const activeLeads = await this.db.leadSequence.count({
          where: { sequenceId: seq.id, status: 'active' },
        });
        return { ...seq, activeLeads };
      })
    );
    return stats;
  }

  async create(accountId: string, input: any) {
    return this.db.sequence.create({
      data: { accountId, ...input, steps: input.steps },
    });
  }

  async update(accountId: string, id: string, input: any) {
    const seq = await this.db.sequence.findFirst({ where: { id, accountId } });
    if (!seq) throw new AppError(404, 'Sequence not found', 'NOT_FOUND');

    if (seq.publishedAt) {
      // Create new version
      return this.db.sequence.create({
        data: {
          accountId, name: input.name || seq.name, type: seq.type,
          version: seq.version + 1, steps: input.steps || seq.steps,
        },
      });
    }

    return this.db.sequence.update({ where: { id }, data: input });
  }

  async publish(accountId: string, id: string) {
    const seq = await this.db.sequence.findFirst({ where: { id, accountId } });
    if (!seq) throw new AppError(404, 'Sequence not found', 'NOT_FOUND');

    return this.db.sequence.update({
      where: { id },
      data: { isActive: true, publishedAt: new Date() },
    });
  }

  async enroll(accountId: string, sequenceId: string, leadIds: string[]) {
    const seq = await this.db.sequence.findFirst({ where: { id: sequenceId, accountId } });
    if (!seq) throw new AppError(404, 'Sequence not found', 'NOT_FOUND');
    if (!seq.publishedAt) throw new AppError(400, 'Sequence not published', 'NOT_PUBLISHED');

    const steps = seq.steps as any[];
    let enrolled = 0;

    for (const leadId of leadIds) {
      const existing = await this.db.leadSequence.findFirst({
        where: { leadId, sequenceId, status: 'active' },
      });
      if (existing) continue;

      const firstStep = steps[0];
      const nextSendAt = new Date();
      nextSendAt.setDate(nextSendAt.getDate() + (firstStep?.delayDays || 0));

      await this.db.leadSequence.create({
        data: {
          accountId, leadId, sequenceId,
          sequenceVersion: seq.version,
          nextSendAt,
        },
      });

      await this.db.lead.update({
        where: { id: leadId },
        data: { status: 'prospecting' },
      });

      enrolled++;
    }
    return { enrolled, total: leadIds.length };
  }

  async clone(accountId: string, id: string) {
    const seq = await this.db.sequence.findFirst({ where: { id, accountId } });
    if (!seq) throw new AppError(404, 'Sequence not found', 'NOT_FOUND');

    return this.db.sequence.create({
      data: {
        accountId, name: `${seq.name} (copy)`, type: seq.type,
        steps: seq.steps as any, version: 1,
      },
    });
  }

  async getLeads(accountId: string, sequenceId: string) {
    return this.db.leadSequence.findMany({
      where: { sequenceId, accountId },
      include: { lead: { select: { id: true, name: true, phone: true, status: true, score: true } } },
      orderBy: { startedAt: 'desc' },
    });
  }
}
