import type { FastifyInstance } from 'fastify';
import { getDatabase } from '../../config/index.js';
import { authenticate } from '../../middleware/authenticate.js';
import { tenantScope } from '../../middleware/tenant-scope.js';

export async function whatsappRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', tenantScope);

  const db = getDatabase();

  app.get('/status', async (req, rep) => {
    const session = await db.whatsAppSession.findFirst({
      where: { accountId: req.accountId! },
    });
    return rep.send({
      status: session?.status || 'disconnected',
      phone: session?.phone,
      lastConnectedAt: session?.lastConnectedAt,
    });
  });
}
