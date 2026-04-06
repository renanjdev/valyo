import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../lib/errors.js';

export interface AuthUser {
  userId: string;
  accountId: string;
  role: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const payload = await request.jwtVerify<AuthUser>();
    request.authUser = payload;
  } catch {
    throw new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED');
  }
}
