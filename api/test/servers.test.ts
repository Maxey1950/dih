import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { Agent, resetDb, setup, type TestContext } from './helpers.js';
import { provisionServer } from '../src/servers/provision.js';
import { hashServerCredential } from '../src/servers/credentials.js';
import { sessionCookieName } from '../src/auth/session.js';

let ctx: TestContext;
before(async () => {
  ctx = await setup();
});
after(async () => ctx.close());
beforeEach(async () => resetDb(ctx.prisma));

async function gameWithOwner(isPublic = true) {
  const agent = new Agent(ctx.app);
  await agent.register('owner1');
  const res = await agent.post('/api/games', { name: 'Arena', maxPlayers: 20, isPublic });
  return { agent, gameId: res.json().game.id as string };
}

function beat(app: FastifyInstance, id: string, credential: string | undefined, body: unknown, headers: Record<string, string> = {}) {
  return app.inject({
    method: 'POST',
    url: `/api/internal/servers/${id}/heartbeat`,
    headers: {
      'content-type': 'application/json',
      ...(credential !== undefined ? { authorization: `Bearer ${credential}` } : {}),
      ...headers,
    },
    payload: JSON.stringify(body),
  });
}

const players = async (gameId: string) =>
  (await ctx.app.inject({ method: 'GET', url: `/api/games/${gameId}` })).json().game.playerCount as number;

describe('provisioning', () => {
  test('generates a strong credential and stores only its hash', async () => {
    const { gameId } = await gameWithOwner();
    const { server, credential } = await provisionServer(ctx.prisma, { gameId, host: '10.0.0.5', port: 2005 });
    assert.match(credential, /^rvgs_[A-Za-z0-9_-]{43}$/);
    assert.equal(server.credentialHash, hashServerCredential(credential));
    const dump = JSON.stringify(await ctx.prisma.$queryRawUnsafe('SELECT * FROM game_servers'));
    assert.ok(!dump.includes(credential), 'raw credential persisted');
    assert.equal(server.status, 'offline');
    assert.equal(server.maxPlayers, 20);
  });

  test('rejects bad input', async () => {
    const { gameId } = await gameWithOwner();
    await assert.rejects(provisionServer(ctx.prisma, { gameId, host: 'bad host; rm -rf /', port: 2005 }));
    await assert.rejects(provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 70000 }));
    await assert.rejects(provisionServer(ctx.prisma, { gameId: '00000000-0000-4000-8000-000000000000', host: '127.0.0.1', port: 1 }));
  });
});

describe('heartbeats', () => {
  test('valid heartbeat brings the server online and updates counts', async () => {
    const { gameId } = await gameWithOwner();
    const { server, credential } = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2005 });
    const res = await beat(ctx.app, server.id, credential, { playerCount: 7, maxPlayers: 20 });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().server, { id: server.id, status: 'online', playerCount: 7, maxPlayers: 20, heartbeatIntervalSeconds: 30 });
    const row = await ctx.prisma.gameServer.findUniqueOrThrow({ where: { id: server.id } });
    assert.ok(row.lastHeartbeatAt && row.startedAt);
    assert.equal(await players(gameId), 7);
  });

  test('malformed bodies and impossible player counts are rejected', async () => {
    const { gameId } = await gameWithOwner();
    const { server, credential } = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2005 });
    for (const body of [
      {},
      { playerCount: -1, maxPlayers: 20 },
      { playerCount: 21, maxPlayers: 20 },
      { playerCount: 1, maxPlayers: 0 },
      { playerCount: 1.5, maxPlayers: 20 },
      { playerCount: '5', maxPlayers: 20 },
      { playerCount: 1, maxPlayers: 20, status: 'offline' },
      { playerCount: 1, maxPlayers: 20, host: '1.2.3.4' },
      { playerCount: 1, maxPlayers: 20, command: 'shutdown' },
    ]) {
      const res = await beat(ctx.app, server.id, credential, body);
      assert.equal(res.statusCode, 400, JSON.stringify(body));
    }
    assert.equal((await ctx.prisma.gameServer.findUniqueOrThrow({ where: { id: server.id } })).lastHeartbeatAt, null);
  });

  test('wrong, malformed or missing credentials are rejected', async () => {
    const { gameId } = await gameWithOwner();
    const { server, credential } = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2005 });
    const body = { playerCount: 1, maxPlayers: 20 };
    const wrong = 'rvgs_' + 'A'.repeat(43);
    for (const headers of [
      { authorization: `Bearer ${wrong}` },
      { authorization: `Bearer ${credential}x` },
      { authorization: credential },
      { authorization: `Basic ${credential}` },
      { authorization: `Bearer  ${credential}` },
      { authorization: `bearer ${credential}` },
      {},
    ]) {
      const res = await beat(ctx.app, server.id, undefined, body, headers);
      assert.equal(res.statusCode, 401, JSON.stringify(headers));
      assert.equal(res.json().error.code, 'UNAUTHENTICATED');
    }
    assert.equal((await beat(ctx.app, 'not-a-uuid', credential, body)).statusCode, 401);
  });

  test("a server cannot heartbeat for another server", async () => {
    const { gameId } = await gameWithOwner();
    const a = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2005 });
    const b = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2006 });
    const res = await beat(ctx.app, b.server.id, a.credential, { playerCount: 1, maxPlayers: 20 });
    assert.equal(res.statusCode, 401);
    assert.equal((await ctx.prisma.gameServer.findUniqueOrThrow({ where: { id: b.server.id } })).lastHeartbeatAt, null);
  });

  test('drain keeps players counted; offline removes them', async () => {
    const { gameId } = await gameWithOwner();
    const { server, credential } = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2005 });
    await beat(ctx.app, server.id, credential, { playerCount: 4, maxPlayers: 20 });
    const post = (action: string) =>
      ctx.app.inject({ method: 'POST', url: `/api/internal/servers/${server.id}/${action}`, headers: { authorization: `Bearer ${credential}` } });
    assert.equal((await post('drain')).json().server.status, 'draining');
    assert.equal((await beat(ctx.app, server.id, credential, { playerCount: 3, maxPlayers: 20 })).json().server.status, 'draining');
    assert.equal(await players(gameId), 3);
    assert.equal((await post('offline')).json().server.status, 'offline');
    assert.equal(await players(gameId), 0);
  });
});

describe('player-count aggregation', () => {
  test('one server, multiple servers, stale and offline servers', async () => {
    const { gameId } = await gameWithOwner();
    const s1 = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2001 });
    const s2 = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2002 });
    const s3 = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2003 });
    const s4 = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2004 });

    await beat(ctx.app, s1.server.id, s1.credential, { playerCount: 10, maxPlayers: 20 });
    assert.equal(await players(gameId), 10, 'one server');

    await beat(ctx.app, s2.server.id, s2.credential, { playerCount: 6, maxPlayers: 20 });
    assert.equal(await players(gameId), 16, 'two servers');

    await beat(ctx.app, s3.server.id, s3.credential, { playerCount: 5, maxPlayers: 20 });
    await ctx.prisma.gameServer.update({ where: { id: s3.server.id }, data: { lastHeartbeatAt: new Date(Date.now() - 91_000) } });
    assert.equal(await players(gameId), 16, 'stale server ignored even though its status is still online');

    await beat(ctx.app, s4.server.id, s4.credential, { playerCount: 8, maxPlayers: 20 });
    await ctx.prisma.gameServer.update({ where: { id: s4.server.id }, data: { status: 'offline' } });
    assert.equal(await players(gameId), 16, 'offline server ignored');

    await beat(ctx.app, s3.server.id, s3.credential, { playerCount: 1, maxPlayers: 20, status: 'starting' });
    assert.equal(await players(gameId), 16, 'starting server not counted');

    const servers = (await ctx.app.inject({ method: 'GET', url: `/api/games/${gameId}/servers` })).json().servers;
    assert.deepEqual(servers.map((s: { playerCount: number }) => s.playerCount), [10, 6]);

    const list = (await ctx.app.inject({ method: 'GET', url: '/api/games?sort=players' })).json();
    assert.equal(list.games[0].playerCount, 16);
  });

  test('sort=players orders by live players', async () => {
    const { agent, gameId } = await gameWithOwner();
    const other = (await agent.post('/api/games', { name: 'Busy', isPublic: true })).json().game.id as string;
    const s = await provisionServer(ctx.prisma, { gameId: other, host: '127.0.0.1', port: 2001 });
    await beat(ctx.app, s.server.id, s.credential, { playerCount: 9, maxPlayers: 12 });
    const list = (await ctx.app.inject({ method: 'GET', url: '/api/games?sort=players' })).json();
    assert.deepEqual(list.games.map((g: { id: string }) => g.id), [other, gameId]);
  });
});

describe('internal API isolation', () => {
  test('player and admin sessions (with valid CSRF) cannot use internal endpoints', async () => {
    const { gameId } = await gameWithOwner();
    const { server } = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2005 });
    const admin = new Agent(ctx.app);
    const user = await admin.register('siteadmin');
    await ctx.prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
    for (const action of ['heartbeat', 'drain', 'offline']) {
      const res = await admin.post(`/api/internal/servers/${server.id}/${action}`, { playerCount: 1, maxPlayers: 20 });
      assert.equal(res.statusCode, 401, action);
    }
    assert.equal((await ctx.prisma.gameServer.findUniqueOrThrow({ where: { id: server.id } })).lastHeartbeatAt, null);
  });

  test('a game-server credential cannot authenticate as a user or admin', async () => {
    const { gameId } = await gameWithOwner();
    const { credential } = await provisionServer(ctx.prisma, { gameId, host: '127.0.0.1', port: 2005 });
    const headers = { authorization: `Bearer ${credential}` };
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers })).json().authenticated, false);
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/admin/servers', headers })).statusCode, 401);
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/users/me/settings', headers })).statusCode, 401);
    // Used as a session cookie it is not a valid session either.
    const cookie = `${sessionCookieName({ COOKIE_SECURE: false })}=${credential}`;
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } })).json().authenticated, false);
  });

  test('public and admin server views never reveal host, port or credential material', async () => {
    const { gameId } = await gameWithOwner();
    const { server, credential } = await provisionServer(ctx.prisma, { gameId, host: '10.20.30.40', port: 53640 });
    await beat(ctx.app, server.id, credential, { playerCount: 2, maxPlayers: 20 });
    const admin = new Agent(ctx.app);
    const user = await admin.register('siteadmin');
    await ctx.prisma.user.update({ where: { id: user.id }, data: { role: 'admin' } });
    const bodies = [
      (await ctx.app.inject({ method: 'GET', url: `/api/games/${gameId}/servers` })).body,
      (await ctx.app.inject({ method: 'GET', url: `/api/games/${gameId}` })).body,
      (await ctx.app.inject({ method: 'GET', url: '/api/games' })).body,
      (await admin.get('/api/admin/servers')).body,
      (await beat(ctx.app, server.id, credential, { playerCount: 2, maxPlayers: 20 })).body,
    ];
    const all = bodies.join('\n');
    for (const secret of ['10.20.30.40', '53640', credential, server.credentialHash, 'credential', 'host']) {
      assert.ok(!all.includes(secret), `leaked: ${secret}`);
    }
    const publicList = JSON.parse(bodies[0]!).servers;
    assert.deepEqual(Object.keys(publicList[0]).sort(), ['maxPlayers', 'playerCount', 'status']);
    assert.ok(!bodies[0]!.includes(server.id) && !bodies[1]!.includes(server.id) && !bodies[2]!.includes(server.id), 'no server id in public responses');
    const adminView = JSON.parse(bodies[3]!).servers[0];
    assert.deepEqual(Object.keys(adminView).sort(), ['game', 'id', 'isStale', 'lastHeartbeatAt', 'maxPlayers', 'playerCount', 'startedAt', 'status']);
  });

  test('normal users cannot see the admin server list', async () => {
    const a = new Agent(ctx.app);
    await a.register('plainuser');
    assert.equal((await a.get('/api/admin/servers')).statusCode, 403);
  });
});
