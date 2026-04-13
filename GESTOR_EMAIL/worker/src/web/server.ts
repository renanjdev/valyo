import express from 'express';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import open from 'open';
import { setupRouter } from './routes/setup.js';
import { workerRouter } from './routes/worker-route.js';
import { emailsRouter } from './routes/emails.js';
import { reportsRouter } from './routes/reports.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// After tsc build: worker/dist/web/ -> go up 3 levels to worker/, then into web/dist/
const WEB_DIST = resolve(__dirname, '../../../web/dist');

export async function startWebServer(port: number = 3030): Promise<void> {
  const app = express();
  app.use(express.json());

  app.use('/api/setup', setupRouter);
  app.use('/api/worker', workerRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/reports', reportsRouter);

  // Serve React SPA
  app.use(express.static(WEB_DIST));
  app.get('*', (_req, res) => {
    res.sendFile(join(WEB_DIST, 'index.html'));
  });

  return new Promise((resolve) => {
    app.listen(port, () => {
      console.log(`Web interface: http://localhost:${port}`);
      setTimeout(() => open(`http://localhost:${port}`), 500);
      resolve();
    });
  });
}
