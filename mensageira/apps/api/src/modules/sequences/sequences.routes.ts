import type { FastifyInstance } from 'fastify';
import { SequencesService } from './sequences.service.js';
import { getDatabase } from '../../config/index.js';
import { authenticate } from '../../middleware/authenticate.js';
import { tenantScope } from '../../middleware/tenant-scope.js';
import { createSequenceSchema, updateSequenceSchema, enrollSchema } from './sequences.schemas.js';

export async function sequencesRoutes(app: FastifyInstance) {
  app.addHook('onRequest', authenticate);
  app.addHook('onRequest', tenantScope);

  const service = new SequencesService(getDatabase());

  app.get('/', async (req, rep) => {
    const result = await service.list(req.accountId!);
    return rep.send(result);
  });

  app.post('/', async (req, rep) => {
    const input = createSequenceSchema.parse(req.body);
    const seq = await service.create(req.accountId!, input);
    return rep.status(201).send(seq);
  });

  app.patch('/:id', async (req: any, rep) => {
    const input = updateSequenceSchema.parse(req.body);
    const seq = await service.update(req.accountId!, req.params.id, input);
    return rep.send(seq);
  });

  app.post('/:id/publish', async (req: any, rep) => {
    const seq = await service.publish(req.accountId!, req.params.id);
    return rep.send(seq);
  });

  app.post('/:id/enroll', async (req: any, rep) => {
    const { leadIds } = enrollSchema.parse(req.body);
    const result = await service.enroll(req.accountId!, req.params.id, leadIds);
    return rep.send(result);
  });

  app.post('/:id/clone', async (req: any, rep) => {
    const seq = await service.clone(req.accountId!, req.params.id);
    return rep.status(201).send(seq);
  });

  app.get('/:id/leads', async (req: any, rep) => {
    const leads = await service.getLeads(req.accountId!, req.params.id);
    return rep.send(leads);
  });
}
