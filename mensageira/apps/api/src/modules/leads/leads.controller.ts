import type { FastifyRequest, FastifyReply } from 'fastify';
import type { LeadsService } from './leads.service.js';
import {
  createLeadSchema, updateLeadSchema, importLeadsSchema,
  bulkActionSchema, scoreAdjustSchema, listLeadsQuery,
} from './leads.schemas.js';

export class LeadsController {
  constructor(private service: LeadsService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listLeadsQuery.parse(request.query);
    const result = await this.service.list(request.accountId!, query);
    return reply.send(result);
  }

  async getById(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const lead = await this.service.getById(request.accountId!, request.params.id);
    return reply.send(lead);
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const input = createLeadSchema.parse(request.body);
    const lead = await this.service.create(request.accountId!, input);
    return reply.status(201).send(lead);
  }

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const input = updateLeadSchema.parse(request.body);
    const lead = await this.service.update(request.accountId!, request.params.id, input);
    return reply.send(lead);
  }

  async importLeads(request: FastifyRequest, reply: FastifyReply) {
    const input = importLeadsSchema.parse(request.body);
    const result = await this.service.importLeads(request.accountId!, input);
    return reply.send(result);
  }

  async assign(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const { userId } = request.body as { userId: string };
    const lead = await this.service.assign(request.accountId!, request.params.id, userId);
    return reply.send(lead);
  }

  async adjustScore(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const input = scoreAdjustSchema.parse(request.body);
    const lead = await this.service.adjustScore(request.accountId!, request.params.id, input.delta, input.reason);
    return reply.send(lead);
  }

  async stop(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const result = await this.service.stop(request.accountId!, request.params.id);
    return reply.send(result);
  }

  async timeline(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const events = await this.service.getTimeline(request.accountId!, request.params.id);
    return reply.send(events);
  }

  async pipeline(request: FastifyRequest, reply: FastifyReply) {
    const result = await this.service.pipeline(request.accountId!);
    return reply.send(result);
  }

  async bulk(request: FastifyRequest, reply: FastifyReply) {
    const input = bulkActionSchema.parse(request.body);
    const result = await this.service.bulk(request.accountId!, input);
    return reply.send(result);
  }
}
