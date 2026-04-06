import type { FastifyInstance } from 'fastify';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { getDatabase } from '../../config/index.js';

export async function authRoutes(app: FastifyInstance) {
  const db = getDatabase();
  const service = new AuthService(db, app.jwt);
  const controller = new AuthController(service);

  app.post('/register', (req, rep) => controller.register(req, rep));
  app.post('/login', (req, rep) => controller.login(req, rep));
  app.post('/refresh', (req, rep) => controller.refresh(req, rep));
  app.post('/logout', (req, rep) => controller.logout(req, rep));
}
