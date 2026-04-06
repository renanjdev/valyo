import { env } from './config/index.js';
import { buildApp } from './app.js';
import { logger } from './lib/logger.js';

async function start() {
  const app = await buildApp();

  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  logger.info(`Server running on http://${env.API_HOST}:${env.API_PORT}`);
}

start().catch((err) => {
  logger.fatal(err, 'Failed to start server');
  process.exit(1);
});
