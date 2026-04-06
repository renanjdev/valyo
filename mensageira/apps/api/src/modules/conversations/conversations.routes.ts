import type { FastifyInstance } from 'fastify';
import { ConversationsService } from './conversations.service.js';
import { ConversationsController } from './conversations.controller.js';
import { getDatabase } from '../../config/index.js';
import { authenticate } from '../../middleware/authenticate.js';
import { tenantScope } from '../../middleware/tenant-scope.js';

export async function conversationsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', tenantScope);

  const db = getDatabase();
  const service = new ConversationsService(db);
  const controller = new ConversationsController(service);

  app.get('/', (req, rep) => controller.list(req, rep));
  app.get('/by-lead/:leadId', (req, rep) => controller.getByLead(req as any, rep));
  app.get('/:id/messages', (req, rep) => controller.getMessages(req as any, rep));
  app.post('/:id/messages', (req, rep) => controller.sendMessage(req as any, rep));
  app.patch('/:id', (req, rep) => controller.update(req as any, rep));
  app.post('/:id/takeover', (req, rep) => controller.takeover(req as any, rep));
}
