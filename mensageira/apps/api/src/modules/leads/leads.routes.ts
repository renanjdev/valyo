import type { FastifyInstance } from 'fastify';
import { LeadsService } from './leads.service.js';
import { LeadsController } from './leads.controller.js';
import { getDatabase } from '../../config/index.js';
import { authenticate } from '../../middleware/authenticate.js';
import { tenantScope } from '../../middleware/tenant-scope.js';

export async function leadsRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', tenantScope);

  const db = getDatabase();
  const service = new LeadsService(db);
  const controller = new LeadsController(service);

  app.get('/', (req, rep) => controller.list(req, rep));
  app.get('/pipeline', (req, rep) => controller.pipeline(req, rep));
  app.get('/:id', (req, rep) => controller.getById(req as any, rep));
  app.post('/', (req, rep) => controller.create(req, rep));
  app.post('/import', (req, rep) => controller.importLeads(req, rep));
  app.post('/bulk', (req, rep) => controller.bulk(req, rep));
  app.patch('/:id', (req, rep) => controller.update(req as any, rep));
  app.post('/:id/assign', (req, rep) => controller.assign(req as any, rep));
  app.post('/:id/score', (req, rep) => controller.adjustScore(req as any, rep));
  app.post('/:id/stop', (req, rep) => controller.stop(req as any, rep));
  app.get('/:id/timeline', (req, rep) => controller.timeline(req as any, rep));
}
