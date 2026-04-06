import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { env } from './config/index.js';
import { errorHandler } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { correlationIdHook } from './middleware/correlation-id.js';
import { authRoutes } from './modules/auth/auth.routes.js';

export async function buildApp() {
  const app = Fastify({ logger });

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: env.JWT_SECRET });

  // Global hooks
  app.addHook('onRequest', correlationIdHook);

  // Error handler
  app.setErrorHandler(errorHandler);

  // Health check
  app.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Routes
  await app.register(authRoutes, { prefix: '/api/auth' });

  return app;
}
