import type { FastifyRequest, FastifyReply } from 'fastify';
import type { AuthService } from './auth.service.js';
import { registerSchema, loginSchema, refreshSchema } from './auth.schemas.js';

export class AuthController {
  constructor(private service: AuthService) {}

  async register(request: FastifyRequest, reply: FastifyReply) {
    const input = registerSchema.parse(request.body);
    const result = await this.service.register(input);
    return reply.status(201).send(result);
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const input = loginSchema.parse(request.body);
    const result = await this.service.login(input);
    return reply.send(result);
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const input = refreshSchema.parse(request.body);
    const result = await this.service.refresh(input.refreshToken);
    return reply.send(result);
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = refreshSchema.parse(request.body);
    await this.service.logout(refreshToken);
    return reply.status(204).send();
  }
}
