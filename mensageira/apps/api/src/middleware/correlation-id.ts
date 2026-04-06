import type { FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';

export async function correlationIdHook(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const correlationId =
    (request.headers['x-correlation-id'] as string) || randomUUID();
  request.headers['x-correlation-id'] = correlationId;
  reply.header('x-correlation-id', correlationId);
}
