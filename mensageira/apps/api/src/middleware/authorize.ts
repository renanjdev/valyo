import type { FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../lib/errors.js';
import type { UserRole } from '@mensageira/shared';

const ROLE_HIERARCHY: Record<string, number> = {
  seller: 1,
  admin: 2,
  owner: 3,
};

export function authorize(...allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const userRole = request.authUser?.role;
    if (!userRole) {
      throw new AppError(401, 'Not authenticated', 'UNAUTHORIZED');
    }
    const userLevel = ROLE_HIERARCHY[userRole] || 0;
    const minLevel = Math.min(
      ...allowedRoles.map((r) => ROLE_HIERARCHY[r] || 999),
    );
    if (userLevel < minLevel) {
      throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
    }
  };
}
