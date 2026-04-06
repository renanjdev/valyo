import { describe, it, expect } from 'vitest';
import { getApp } from '../helpers.js';

describe('POST /api/auth/register', () => {
  it('should create account and user', async () => {
    const app = await getApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'Renan',
        email: 'renan@test.com',
        password: 'password123',
        accountName: 'Homologa Plus',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.user.name).toBe('Renan');
    expect(body.user.role).toBe('owner');
    expect(body.account.name).toBe('Homologa Plus');
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
  });

  it('should reject duplicate email', async () => {
    const app = await getApp();
    const payload = {
      name: 'User',
      email: 'dup@test.com',
      password: 'password123',
      accountName: 'Account',
    };

    await app.inject({ method: 'POST', url: '/api/auth/register', payload });
    const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload });

    expect(res.statusCode).toBe(409);
  });

  it('should reject short password', async () => {
    const app = await getApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        name: 'User',
        email: 'short@test.com',
        password: '123',
        accountName: 'Account',
      },
    });

    expect(res.statusCode).toBe(400);
  });
});
