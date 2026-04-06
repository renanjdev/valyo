import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

export async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

export async function createTestUser(overrides = {}) {
  const app = await getApp();
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      name: 'Test User',
      email: `test-${Date.now()}@example.com`,
      password: 'password123',
      accountName: 'Test Account',
      ...overrides,
    },
  });
  return JSON.parse(res.body);
}

export function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}
