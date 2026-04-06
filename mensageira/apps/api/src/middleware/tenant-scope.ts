import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    accountId?: string;
  }
}

export async function tenantScope(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (!request.authUser?.accountId) {
    throw new AppError(401, 'No tenant context', 'NO_TENANT');
  }
  request.accountId = request.authUser.accountId;
}
