import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { AuthMeResponse, ApiError, HealthResponse } from '@revival/shared';
import { Agent, resetDb, setup, type TestContext } from './helpers.js';
import { hashToken, sessionCookieName } from '../src/auth/session.js';

let ctx: TestContext;
const COOKIE = sessionCookieName({ COOKIE_SECURE: false });

before(async () => {
  ctx = await setup();
});
after(async () => ctx.close());
beforeEach(async () => resetDb(ctx.prisma));

describe('health', () => {
  test('GET /health returns ok with security headers', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/health' });
    assert.equal(res.statusCode, 200);
    HealthResponse.parse(res.json());
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
  });
});

describe('registration', () => {
  test('success creates the account, logs in, and returns the user', async () => {
    const a = new Agent(ctx.app);
    const res = await a.post('/api/auth/register', { username: 'Builderman', password: 'correct horse battery' });
    assert.equal(res.statusCode, 201);
    const body = res.json();
    assert.equal(body.authenticated, true);
    assert.equal(body.user.username, 'Builderman');
    assert.equal(body.user.role, 'user');

    const cookie = res.cookies.find((c) => c.name === COOKIE);
    assert.ok(cookie, 'session cookie set');
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Lax');
    assert.equal(cookie.path, '/');

    const me = AuthMeResponse.parse((await a.get('/api/auth/me')).json());
    assert.equal(me.authenticated, true);
    assert.equal(me.user?.username, 'Builderman');
  });

  test('duplicate username is rejected, case-insensitively', async () => {
    await new Agent(ctx.app).register('Builderman');
    const res = await new Agent(ctx.app).post('/api/auth/register', { username: 'bUILDERMAN', password: 'another password 1' });
    assert.equal(res.statusCode, 409);
    assert.equal(ApiError.parse(res.json()).error.code, 'USERNAME_TAKEN');
  });

  for (const [label, username, password] of [
    ['empty username', '', 'correct horse battery'],
    ['too short username', 'ab', 'correct horse battery'],
    ['too long username', 'a'.repeat(21), 'correct horse battery'],
    ['control characters', 'bad\u0000name', 'correct horse battery'],
    ['spaces', 'bad name', 'correct horse battery'],
    ['two underscores', 'a_b_c', 'correct horse battery'],
    ['leading underscore', '_abc', 'correct horse battery'],
    ['reserved name', 'Admin', 'correct horse battery'],
    ['short password', 'gooduser', 'short'],
    ['huge password', 'gooduser', 'x'.repeat(129)],
    ['password equals username', 'gooduser1', 'GoodUser1'],
  ] as const) {
    test(`invalid input is rejected: ${label}`, async () => {
      const res = await new Agent(ctx.app).post('/api/auth/register', { username, password });
      assert.equal(res.statusCode, 400);
      assert.equal(res.json().error.code, 'VALIDATION_FAILED');
      assert.equal(await ctx.prisma.user.count(), 0);
    });
  }

  test('unknown fields such as role are rejected, never applied', async () => {
    const res = await new Agent(ctx.app).post('/api/auth/register', { username: 'sneaky', password: 'correct horse battery', role: 'admin' });
    assert.equal(res.statusCode, 400);
    assert.equal(await ctx.prisma.user.count(), 0);
  });
});

describe('login', () => {
  test('success', async () => {
    await new Agent(ctx.app).register('Builderman', 'correct horse battery');
    const a = new Agent(ctx.app);
    const res = await a.post('/api/auth/login', { username: 'builderman', password: 'correct horse battery' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().user.username, 'Builderman');
    assert.equal((await a.get('/api/auth/me')).json().authenticated, true);
  });

  test('wrong password and unknown user give the identical external error', async () => {
    await new Agent(ctx.app).register('Builderman', 'correct horse battery');
    const wrong = await new Agent(ctx.app).post('/api/auth/login', { username: 'Builderman', password: 'wrong password!!' });
    const missing = await new Agent(ctx.app).post('/api/auth/login', { username: 'nobody_here', password: 'wrong password!!' });
    assert.equal(wrong.statusCode, 401);
    assert.equal(missing.statusCode, 401);
    assert.deepEqual(wrong.json(), missing.json());
    assert.equal(wrong.json().error.code, 'INVALID_CREDENTIALS');
    assert.equal(wrong.cookies.find((c) => c.name === COOKIE), undefined);
  });

  test('login rotates the session: the old token stops working', async () => {
    const a = new Agent(ctx.app);
    await a.register('Builderman');
    const oldToken = a.cookies.get(COOKIE)!;
    await a.post('/api/auth/login', { username: 'Builderman', password: 'correct horse battery' });
    assert.notEqual(a.cookies.get(COOKIE), oldToken);
    assert.equal(await ctx.prisma.session.count({ where: { tokenHash: hashToken(oldToken) } }), 0);
  });

  test('login is rate limited', async () => {
    const limited = await setup({ RATE_LIMIT_AUTH_MAX: '3' });
    try {
      const a = new Agent(limited.app);
      const codes = [];
      for (let i = 0; i < 4; i++) codes.push((await a.post('/api/auth/login', { username: 'x', password: 'y' })).statusCode);
      assert.deepEqual(codes, [401, 401, 401, 429]);
    } finally {
      await limited.close();
    }
  });
});

describe('sessions', () => {
  test('/api/auth/me is a normal 200 when logged out', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/me' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { authenticated: false, user: null });
  });

  test('an invalid session token is treated as logged out', async () => {
    for (const token of ['garbage', 'A'.repeat(43)]) {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: `${COOKIE}=${token}` } });
      assert.equal(res.statusCode, 200);
      assert.equal(res.json().authenticated, false);
    }
  });

  test('an expired session is rejected and deleted', async () => {
    const a = new Agent(ctx.app);
    await a.register('Builderman');
    await ctx.prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    assert.equal((await a.get('/api/auth/me')).json().authenticated, false);
    assert.equal(await ctx.prisma.session.count(), 0);
  });

  test('logout invalidates the server-side session, not just the cookie', async () => {
    const a = new Agent(ctx.app);
    await a.register('Builderman');
    const token = a.cookies.get(COOKIE)!;
    const res = await a.post('/api/auth/logout');
    assert.equal(res.statusCode, 200);
    assert.equal(await ctx.prisma.session.count(), 0);
    // Replaying the old cookie must not work.
    const replay = await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie: `${COOKIE}=${token}` } });
    assert.equal(replay.json().authenticated, false);
  });

  test('a banned user is not authenticated', async () => {
    const a = new Agent(ctx.app);
    await a.register('Builderman');
    await ctx.prisma.user.updateMany({ data: { bannedUntil: new Date(Date.now() + 60_000) } });
    assert.equal((await a.get('/api/auth/me')).json().authenticated, false);
  });
});

describe('csrf', () => {
  test('state-changing requests without a CSRF token are rejected', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ username: 'Builderman', password: 'correct horse battery' }),
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error.code, 'CSRF_INVALID');
    assert.equal(await ctx.prisma.user.count(), 0);
  });

  test('a token from another browser does not work', async () => {
    const attacker = new Agent(ctx.app);
    await attacker.get('/api/auth/me');
    await attacker.post('/api/auth/logout'); // obtains attacker's token
    const victim = new Agent(ctx.app);
    await victim.register('victim');
    victim.csrfToken = attacker.csrfToken;
    const res = await victim.patch('/api/users/me', { description: 'pwned' });
    assert.equal(res.statusCode, 403);
  });

  test('a foreign Origin is rejected even with a valid token', async () => {
    const a = new Agent(ctx.app);
    await a.register('Builderman');
    const res = await a.request('PATCH', '/api/users/me', { description: 'x' }, { origin: 'https://evil.example' });
    assert.equal(res.statusCode, 403);
    const ok = await a.request('PATCH', '/api/users/me', { description: 'x' }, { origin: 'http://localhost:3000' });
    assert.equal(ok.statusCode, 200);
  });
});

describe('authorization', () => {
  test('protected endpoint: 401 logged out, 200 logged in', async () => {
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/users/me/settings' })).statusCode, 401);
    const a = new Agent(ctx.app);
    await a.register('Builderman');
    const res = await a.get('/api/users/me/settings');
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().settings.username, 'Builderman');
  });

  test('admin endpoint rejects normal users and accepts admins', async () => {
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/admin/users' })).statusCode, 401);
    const a = new Agent(ctx.app);
    const user = await a.register('Builderman');
    const denied = await a.get('/api/admin/users');
    assert.equal(denied.statusCode, 403);
    assert.equal(denied.json().error.code, 'FORBIDDEN');
    await ctx.prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
    assert.equal((await a.get('/api/admin/users')).statusCode, 200);
  });

  test('the first registered user is not an admin', async () => {
    const a = new Agent(ctx.app);
    await a.register('firstuser');
    assert.equal((await a.get('/api/auth/me')).json().user.role, 'user');
  });
});
