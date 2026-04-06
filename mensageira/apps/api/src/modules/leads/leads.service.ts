import type { PrismaClient } from '@mensageira/db';
import { TEMPERATURE_THRESHOLDS } from '@mensageira/shared';
import { AppError } from '../../lib/errors.js';
import type {
  CreateLeadInput, UpdateLeadInput, ImportLeadsInput,
  BulkActionInput, ScoreAdjustInput, ListLeadsQuery,
} from './leads.schemas.js';

export class LeadsService {
  constructor(private db: PrismaClient) {}

  async list(accountId: string, query: ListLeadsQuery) {
    const where: any = { accountId };
    if (query.status) where.status = query.status;
    if (query.temperature) where.temperature = query.temperature;
    if (query.assignedTo) where.assignedTo = query.assignedTo;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { company: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const leads = await this.db.lead.findMany({
      where,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: { assignedUser: { select: { id: true, name: true } } },
    });

    const hasMore = leads.length > query.limit;
    const items = hasMore ? leads.slice(0, -1) : leads;
    return {
      items,
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async getById(accountId: string, id: string) {
    const lead = await this.db.lead.findFirst({
      where: { id, accountId },
      include: {
        assignedUser: { select: { id: true, name: true } },
        conversations: { take: 1, orderBy: { lastMessageAt: 'desc' } },
      },
    });
    if (!lead) throw new AppError(404, 'Lead not found', 'NOT_FOUND');
    return lead;
  }

  async create(accountId: string, input: CreateLeadInput) {
    const existing = await this.db.lead.findUnique({
      where: { accountId_phone: { accountId, phone: input.phone } },
    });
    if (existing) throw new AppError(409, 'Phone already exists', 'DUPLICATE_PHONE');

    return this.db.lead.create({
      data: { accountId, ...input, tags: input.tags, metadata: input.metadata },
    });
  }

  async update(accountId: string, id: string, input: UpdateLeadInput) {
    const lead = await this.db.lead.findFirst({ where: { id, accountId } });
    if (!lead) throw new AppError(404, 'Lead not found', 'NOT_FOUND');

    const data: any = { ...input };
    if (input.status && input.status !== lead.status) {
      await this.db.leadEvent.create({
        data: {
          accountId, leadId: id, type: 'status_change',
          actor: 'human', data: { from: lead.status, to: input.status },
        },
      });
    }
    return this.db.lead.update({ where: { id }, data });
  }

  async importLeads(accountId: string, input: ImportLeadsInput) {
    let created = 0, duplicated = 0;
    const errors: string[] = [];

    for (const lead of input.leads) {
      try {
        const existing = await this.db.lead.findUnique({
          where: { accountId_phone: { accountId, phone: lead.phone } },
        });
        if (existing) { duplicated++; continue; }

        await this.db.lead.create({
          data: {
            accountId, name: lead.name, phone: lead.phone,
            company: lead.company, source: 'import',
            sourceDetail: input.sourceDetail,
            tags: lead.tags || [], metadata: lead.metadata || {},
          },
        });
        created++;
      } catch (err: any) {
        errors.push(`${lead.phone}: ${err.message}`);
      }
    }
    return { created, duplicated, errors };
  }

  async assign(accountId: string, leadId: string, userId: string) {
    const lead = await this.db.lead.findFirst({ where: { id: leadId, accountId } });
    if (!lead) throw new AppError(404, 'Lead not found', 'NOT_FOUND');

    const user = await this.db.user.findFirst({ where: { id: userId, accountId } });
    if (!user) throw new AppError(404, 'User not found', 'NOT_FOUND');

    await this.db.leadEvent.create({
      data: {
        accountId, leadId, type: 'assigned', actor: 'human',
        data: { from: lead.assignedTo, to: userId },
      },
    });

    return this.db.lead.update({ where: { id: leadId }, data: { assignedTo: userId } });
  }

  async adjustScore(accountId: string, leadId: string, delta: number, reason: string, actor: string = 'human') {
    const lead = await this.db.lead.findFirst({ where: { id: leadId, accountId } });
    if (!lead) throw new AppError(404, 'Lead not found', 'NOT_FOUND');

    const newScore = Math.max(0, lead.score + delta);
    let temperature = 'cold';
    if (newScore > TEMPERATURE_THRESHOLDS.WARM_MAX) temperature = 'hot';
    else if (newScore > TEMPERATURE_THRESHOLDS.COLD_MAX) temperature = 'warm';

    await this.db.leadEvent.create({
      data: {
        accountId, leadId, type: 'score_change', actor,
        data: { from: lead.score, to: newScore, delta, reason },
      },
    });

    return this.db.lead.update({
      where: { id: leadId },
      data: { score: newScore, temperature },
    });
  }

  async stop(accountId: string, leadId: string) {
    const lead = await this.db.lead.findFirst({ where: { id: leadId, accountId } });
    if (!lead) throw new AppError(404, 'Lead not found', 'NOT_FOUND');

    await this.db.leadSequence.updateMany({
      where: { leadId, accountId, status: 'active' },
      data: { status: 'cancelled' },
    });

    await this.db.conversation.updateMany({
      where: { leadId, accountId, status: 'active' },
      data: { aiEnabled: false },
    });

    return { stopped: true };
  }

  async getTimeline(accountId: string, leadId: string) {
    return this.db.leadEvent.findMany({
      where: { leadId, accountId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async pipeline(accountId: string) {
    const statuses = ['new', 'prospecting', 'waiting', 'engaged', 'qualified', 'unresponsive', 'nurture', 'won', 'lost'];
    const counts = await this.db.lead.groupBy({
      by: ['status'],
      where: { accountId },
      _count: true,
    });

    const pipeline = statuses.map(status => ({
      status,
      count: counts.find(c => c.status === status)?._count || 0,
    }));

    return pipeline;
  }

  async bulk(accountId: string, input: BulkActionInput) {
    const { leadIds, action, value } = input;
    let affected = 0;

    if (action === 'assign') {
      const result = await this.db.lead.updateMany({
        where: { id: { in: leadIds }, accountId },
        data: { assignedTo: value },
      });
      affected = result.count;
    } else if (action === 'update_status') {
      const result = await this.db.lead.updateMany({
        where: { id: { in: leadIds }, accountId },
        data: { status: value },
      });
      affected = result.count;
    }
    return { affected };
  }
}
