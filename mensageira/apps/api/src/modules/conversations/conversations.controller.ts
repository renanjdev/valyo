import type { FastifyRequest, FastifyReply } from 'fastify';
import type { ConversationsService } from './conversations.service.js';
import {
  listConversationsQuery, sendMessageSchema,
  updateConversationSchema, messagesQuery,
} from './conversations.schemas.js';

export class ConversationsController {
  constructor(private service: ConversationsService) {}

  async list(request: FastifyRequest, reply: FastifyReply) {
    const query = listConversationsQuery.parse(request.query);
    const result = await this.service.list(request.accountId!, query);
    return reply.send(result);
  }

  async getByLead(request: FastifyRequest<{ Params: { leadId: string } }>, reply: FastifyReply) {
    const result = await this.service.getByLead(request.accountId!, request.params.leadId);
    return reply.send(result);
  }

  async getMessages(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const query = messagesQuery.parse(request.query);
    const result = await this.service.getMessages(request.accountId!, request.params.id, query);
    return reply.send(result);
  }

  async sendMessage(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const input = sendMessageSchema.parse(request.body);
    const message = await this.service.sendMessage(
      request.accountId!, request.params.id, input.content, input.correlationId,
    );
    return reply.status(201).send(message);
  }

  async update(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const input = updateConversationSchema.parse(request.body);
    const result = await this.service.update(request.accountId!, request.params.id, input);
    return reply.send(result);
  }

  async takeover(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
    const result = await this.service.takeover(request.accountId!, request.params.id);
    return reply.send(result);
  }
}
