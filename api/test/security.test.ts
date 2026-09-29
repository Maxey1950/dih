import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { Agent, resetDb, setup, type TestContext } from './helpers.js';
import { hashToken, sessionCookieName } from '../src/auth/session.js';

let ctx: TestContext;
const COOKIE = sessionCookieName({ COOKIE_SECURE: false });
before(async () => {
  ctx = await setup();
});
after(async () => ctx.close());
beforeEach(async () => resetDb(ctx.prisma));

test('password hashes, emails and session tokens never appear in any API output', async () => {
  const alice = new Agent(ctx.app);
  const bob = new Agent(ctx.app);
  const password = 'correct horse battery';
  const bodies: string[] = [];
  const reg = await alice.post('/api/auth/register', { username: 'alice', password });
  bodies.push(reg.body);
  const bobUser = await bob.register('bob', password);
  await alice.post(`/api/friends/${bobUser.id}/request`);
  await bob.post(`/api/friends/${reg.json().user.id}/accept`);
  await bob.post(`/api/users/${reg.json().user.id}/follow`);
  const token = alice.cookies.get(COOKIE)!;
  const aliceRow = await ctx.prisma.user.findFirstOrThrow({ where: { username: 'alice' } });
  await ctx.prisma.user.update({ where: { id: aliceRow.id }, data: { role: 'admin', email: 'alice@example.com' } });

  for (const url of [
    '/api/auth/me',
    '/api/users',
    `/api/users/${aliceRow.id}`,
    `/api/users/${aliceRow.id}/friends`,
    `/api/users/${aliceRow.id}/followers`,
    `/api/users/${bobUser.id}/following`,
    '/api/users/me/settings',
    '/api/users/me/friend-requests',
    '/api/admin/users',
  ]) {
    const res = await alice.get(url);
    assert.equal(res.statusCode, 200, url);
    bodies.push(res.body);
  }
  bodies.push((await alice.post('/api/auth/login', { username: 'alice', password })).body);

  const all = bodies.join('\n');
  assert.ok(!all.includes(aliceRow.passwordHash), 'password hash leaked');
  assert.ok(!/\$argon2/.test(all), 'argon2 hash leaked');
  assert.ok(!/passwordHash|password_hash|tokenHash|token_hash|bannedUntil|banReason/.test(all), 'internal field leaked');
  assert.ok(!all.includes('alice@example.com'), 'email leaked');
  assert.ok(!all.includes(password), 'password echoed');
  assert.ok(!all.includes(token), 'session token in body');
});

test('the raw session token is never stored in the database', async () => {
  const a = new Agent(ctx.app);
  await a.register('alice');
  const token = a.cookies.get(COOKIE)!;
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const session = await ctx.prisma.session.findFirstOrThrow();
  assert.equal(session.tokenHash, hashToken(token));
  assert.notEqual(session.tokenHash, token);
  const dump = JSON.stringify(await ctx.prisma.$queryRawUnsafe('SELECT * FROM sessions'));
  assert.ok(!dump.includes(token));
});

test('passwords are stored as argon2id hashes', async () => {
  await new Agent(ctx.app).register('alice', 'correct horse battery');
  const user = await ctx.prisma.user.findFirstOrThrow();
  assert.match(user.passwordHash, /^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
  assert.ok(!user.passwordHash.includes('correct horse battery'));
});

test('server errors do not leak internals', async () => {
  const res = await ctx.app.inject({
    method: 'GET',
    url: '/api/auth/csrf',
  });
  const a = new Agent(ctx.app);
  await a.get('/api/auth/me');
  const bad = await a.request('POST', '/api/auth/login', undefined, { 'content-type': 'application/json' });
  assert.equal(res.statusCode, 200);
  assert.ok([400, 401].includes(bad.statusCode));
  assert.ok(!/prisma|stack|node_modules|\/home\//i.test(bad.body));
});
