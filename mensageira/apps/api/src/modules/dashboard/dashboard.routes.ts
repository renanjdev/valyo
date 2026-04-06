import type { FastifyInstance } from 'fastify';
import { DashboardService } from './dashboard.service.js';
import { getDatabase } from '../../config/index.js';
import { authenticate } from '../../middleware/authenticate.js';
import { tenantScope } from '../../middleware/tenant-scope.js';

export async function dashboardRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', tenantScope);

  const service = new DashboardService(getDatabase());

  app.get('/overview', async (req, rep) => {
    const result = await service.overview(req.accountId!);
    return rep.send(result);
  });

  app.get('/metrics', async (req: any, rep) => {
    const period = (req.query as any).period || '30d';
    const result = await service.metrics(req.accountId!, period);
    return rep.send(result);
  });

  app.get('/activity', async (req, rep) => {
    const result = await service.activity(req.accountId!);
    return rep.send(result);
  });
}
