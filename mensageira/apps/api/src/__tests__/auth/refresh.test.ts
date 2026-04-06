import { describe, it, expect } from 'vitest';
import { getApp, createTestUser } from '../helpers.js';

describe('POST /api/auth/refresh', () => {
  it('should return new tokens', async () => {
    const app = await getApp();
    const { refreshToken } = await createTestUser();

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    // Old refresh token should be rotated
    expect(body.refreshToken).not.toBe(refreshToken);
  });

  it('should reject invalid refresh token', async () => {
    const app = await getApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'invalid-token' },
    });

    expect(res.statusCode).toBe(401);
  });
});
