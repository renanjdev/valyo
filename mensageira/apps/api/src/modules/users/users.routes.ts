import type { FastifyInstance } from 'fastify';
import { UsersService } from './users.service.js';
import { getDatabase } from '../../config/index.js';
import { authenticate } from '../../middleware/authenticate.js';
import { tenantScope } from '../../middleware/tenant-scope.js';
import { authorize } from '../../middleware/authorize.js';

export async function usersRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', tenantScope);

  const service = new UsersService(getDatabase());

  app.get('/me', async (req, rep) => {
    const user = await service.me(req.authUser!.userId);
    return rep.send(user);
  });

  app.get('/', { preHandler: authorize('admin') }, async (req, rep) => {
    const users = await service.list(req.accountId!);
    return rep.send(users);
  });

  app.post('/invite', { preHandler: authorize('admin') }, async (req, rep) => {
    const { name, email, role } = req.body as any;
    const result = await service.invite(req.accountId!, name, email, role || 'seller');
    return rep.status(201).send(result);
  });

  app.patch('/:id', { preHandler: authorize('admin') }, async (req: any, rep) => {
    const result = await service.update(req.accountId!, req.params.id, req.body);
    return rep.send(result);
  });
}
