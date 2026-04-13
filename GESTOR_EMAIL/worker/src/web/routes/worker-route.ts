import { Router } from 'express';
import { getWorkerStatus, startManualCycle } from '../worker-control.js';

export const workerRouter = Router();

workerRouter.get('/status', (_req, res) => {
  res.json(getWorkerStatus());
});

workerRouter.post('/start', (_req, res) => {
  const { status } = getWorkerStatus();
  if (status === 'running') {
    return res.status(409).json({ error: 'Worker already running' });
  }
  startManualCycle().catch(() => {});
  res.json({ ok: true, message: 'Cycle started' });
});

workerRouter.post('/shutdown', (_req, res) => {
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 200);
});
