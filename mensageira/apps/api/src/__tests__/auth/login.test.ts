import { describe, it, expect } from 'vitest';
import { getApp, createTestUser } from '../helpers.js';

describe('POST /api/auth/login', () => {
  it('should return tokens for valid credentials', async () => {
    const app = await getApp();
    const email = `login-${Date.now()}@test.com`;
    await createTestUser({ email });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'password123' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe(email);
  });

  it('should reject invalid password', async () => {
    const app = await getApp();
    const email = `bad-${Date.now()}@test.com`;
    await createTestUser({ email });

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'wrongpassword' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('should reject non-existent email', async () => {
    const app = await getApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'ghost@test.com', password: 'password123' },
    });

    expect(res.statusCode).toBe(401);
  });
});
