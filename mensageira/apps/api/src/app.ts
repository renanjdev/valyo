import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import { env } from './config/index.js';
import { errorHandler } from './lib/errors.js';
import { logger } from './lib/logger.js';
import { correlationIdHook } from './middleware/correlation-id.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { leadsRoutes } from './modules/leads/leads.routes.js';
import { conversationsRoutes } from './modules/conversations/conversations.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes.js';
import { whatsappRoutes } from './modules/whatsapp/whatsapp.routes.js';
import { sequencesRoutes } from './modules/sequences/sequences.routes.js';

export async function buildApp() {
  const app = Fastify({ logger });

  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: env.JWT_SECRET });

  app.addHook('onRequest', correlationIdHook);
  app.setErrorHandler(errorHandler);

  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(leadsRoutes, { prefix: '/api/leads' });
  await app.register(conversationsRoutes, { prefix: '/api/conversations' });
  await app.register(usersRoutes, { prefix: '/api/users' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(whatsappRoutes, { prefix: '/api/whatsapp' });
  await app.register(sequencesRoutes, { prefix: '/api/sequences' });

  return app;
}
