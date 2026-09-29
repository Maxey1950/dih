import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthMeResponse, HealthResponse, ApiError } from '@revival/shared';
import { buildServer } from '../src/server.js';

const app = buildServer({ LOG_LEVEL: 'silent', NODE_ENV: 'test' });

test('GET /health returns ok', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  const body = HealthResponse.parse(res.json());
  assert.equal(body.status, 'ok');
});

test('GET /api/auth/me is anonymous in Phase 1 and not cacheable', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.deepEqual(AuthMeResponse.parse(res.json()), { authenticated: false, user: null });
});

test('unknown routes return the ApiError shape', async () => {
  const res = await app.inject({ method: 'GET', url: '/api/does-not-exist' });
  assert.equal(res.statusCode, 404);
  assert.equal(ApiError.parse(res.json()).error.code, 'NOT_FOUND');
});

test('security headers are set', async () => {
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.headers['x-content-type-options'], 'nosniff');
  assert.equal(res.headers['x-frame-options'], 'DENY');
});
