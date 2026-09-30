import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { JoinGameResponse, LauncherResolveResponse, RedeemTicketResponse } from '@revival/shared';
import { Agent, resetDb, setup, type TestContext } from './helpers.js';
import { provisionServer } from '../src/servers/provision.js';
import { hashTicket } from '../src/tickets/tickets.js';
import { cleanupTickets } from '../src/tickets/cleanup.js';
import { sessionCookieName } from '../src/auth/session.js';

let ctx: TestContext;
before(async () => {
  ctx = await setup();
});
after(async () => ctx.close());
beforeEach(async () => resetDb(ctx.prisma));

const COOKIE = sessionCookieName({ COOKIE_SECURE: false });

async function world({ isPublic = true } = {}) {
  const owner = new Agent(ctx.app);
  const ownerUser = await owner.register('gameowner');
  const game = (await owner.post('/api/games', { name: 'Arena', maxPlayers: 10, isPublic })).json().game;
  const player = new Agent(ctx.app);
  const playerUser = await player.register('player1');
  return { owner, ownerUser, game, player, playerUser };
}

async function onlineServer(app: FastifyInstance, gameId: string, playerCount = 0, maxPlayers = 10, port = 2005) {
  const { server, credential } = await provisionServer(ctx.prisma, { gameId, host: '10.1.2.3', port });
  await heartbeat(app, server.id, credential, playerCount, maxPlayers);
  return { server, credential };
}

function heartbeat(app: FastifyInstance, id: string, credential: string, playerCount: number, maxPlayers: number) {
  return app.inject({
    method: 'POST',
    url: `/api/internal/servers/${id}/heartbeat`,
    headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' },
    payload: JSON.stringify({ playerCount, maxPlayers }),
  });
}

const resolve = (ticket: unknown, headers: Record<string, string> = {}) =>
  ctx.app.inject({
    method: 'POST',
    url: '/api/launcher/ticket/resolve',
    headers: { 'content-type': 'application/json', ...headers },
    payload: JSON.stringify({ ticket }),
  });

const redeem = (credential: string | null, ticket: unknown, headers: Record<string, string> = {}) =>
  ctx.app.inject({
    method: 'POST',
    url: '/api/internal/join-tickets/redeem',
    headers: { 'content-type': 'application/json', ...(credential ? { authorization: `Bearer ${credential}` } : {}), ...headers },
    payload: JSON.stringify({ ticket }),
  });

async function join(agent: Agent, gameId: string) {
  return agent.post(`/api/games/${gameId}/join`, {});
}

describe('ticket creation', () => {
  test('logged-in user gets a ticket; response has no host/port/server data', async () => {
    const { game, player } = await world();
    await onlineServer(ctx.app, game.id);
    const res = await join(player, game.id);
    assert.equal(res.statusCode, 201, res.body);
    const body = JoinGameResponse.parse(res.json());
    assert.match(body.ticket, /^rvjt_[A-Za-z0-9_-]{43}$/);
    assert.equal(body.launchUrl, `ourrevival://join?ticket=${body.ticket}`);
    const ttl = new Date(body.expiresAt).getTime() - Date.now();
    assert.ok(ttl > 80_000 && ttl <= 90_000, `ttl ${ttl}`);
    assert.deepEqual(Object.keys(res.json()).sort(), ['expiresAt', 'launchUrl', 'ticket']);
    assert.ok(!/10\.1\.2\.3|2005|serverId|rvgs_/.test(res.body));
  });

  test('anonymous users are rejected (and need CSRF)', async () => {
    const { game } = await world();
    await onlineServer(ctx.app, game.id);
    assert.equal((await new Agent(ctx.app).post(`/api/games/${game.id}/join`, {})).statusCode, 401);
    const noCsrf = await ctx.app.inject({ method: 'POST', url: `/api/games/${game.id}/join`, headers: { 'content-type': 'application/json' }, payload: '{}' });
    assert.equal(noCsrf.statusCode, 403);
  });

  test('private or deleted games cannot be joined by others', async () => {
    const { owner, game, player } = await world({ isPublic: false });
    await onlineServer(ctx.app, game.id);
    assert.equal((await join(player, game.id)).statusCode, 404);
    assert.equal((await join(owner, game.id)).statusCode, 201, 'owner may join own private game');
    await owner.del(`/api/games/${game.id}`);
    assert.equal((await join(owner, game.id)).statusCode, 404);
  });

  test('no server: NO_AVAILABLE_SERVER', async () => {
    const { game, player } = await world();
    const res = await join(player, game.id);
    assert.equal(res.statusCode, 503);
    assert.equal(res.json().error.code, 'NO_AVAILABLE_SERVER');
  });

  test('stale, draining and offline servers are ignored', async () => {
    const { game, player } = await world();
    const stale = await onlineServer(ctx.app, game.id, 0, 10, 2001);
    await ctx.prisma.gameServer.update({ where: { id: stale.server.id }, data: { lastHeartbeatAt: new Date(Date.now() - 91_000) } });
    const draining = await onlineServer(ctx.app, game.id, 0, 10, 2002);
    await ctx.prisma.gameServer.update({ where: { id: draining.server.id }, data: { status: 'draining' } });
    const offline = await onlineServer(ctx.app, game.id, 0, 10, 2003);
    await ctx.prisma.gameServer.update({ where: { id: offline.server.id }, data: { status: 'offline' } });
    assert.equal((await join(player, game.id)).json().error.code, 'NO_AVAILABLE_SERVER');
  });

  test('full servers are skipped; all full gives SERVERS_FULL; pending tickets reserve seats', async () => {
    const { game, player } = await world();
    const full = await onlineServer(ctx.app, game.id, 10, 10, 2001);
    const roomy = await onlineServer(ctx.app, game.id, 1, 2, 2002);
    const res = await join(player, game.id);
    assert.equal(res.statusCode, 201);
    const row = await ctx.prisma.joinTicket.findFirstOrThrow();
    assert.equal(row.serverId, roomy.server.id);
    assert.notEqual(row.serverId, full.server.id);
    // The pending ticket holds roomy's last seat, so another player finds everything full.
    const other = new Agent(ctx.app);
    await other.register('player2');
    const res2 = await join(other, game.id);
    assert.equal(res2.statusCode, 409);
    assert.equal(res2.json().error.code, 'SERVERS_FULL');
  });

  test('selection prefers the lowest occupancy ratio', async () => {
    const { game, player } = await world();
    await onlineServer(ctx.app, game.id, 8, 10, 2001);
    const light = await onlineServer(ctx.app, game.id, 3, 10, 2002);
    await join(player, game.id);
    assert.equal((await ctx.prisma.joinTicket.findFirstOrThrow()).serverId, light.server.id);
  });

  test('a new ticket revokes the previous unused one (one live ticket per user)', async () => {
    const { game, player } = await world();
    await onlineServer(ctx.app, game.id);
    const first = (await join(player, game.id)).json().ticket;
    const second = (await join(player, game.id)).json().ticket;
    assert.notEqual(first, second);
    assert.equal((await resolve(first)).statusCode, 404);
    assert.equal((await resolve(second)).statusCode, 200);
    assert.equal(await ctx.prisma.joinTicket.count({ where: { revokedAt: null } }), 1);
  });

  test('join is rate limited per user', async () => {
    const limited = await setup({ RATE_LIMIT_JOIN_MAX: '2' });
    try {
      const owner = new Agent(limited.app);
      await owner.register('owner9');
      const game = (await owner.post('/api/games', { name: 'G', isPublic: true })).json().game;
      const { server, credential } = await provisionServer(limited.prisma, { gameId: game.id, host: '10.0.0.1', port: 2000 });
      await heartbeat(limited.app, server.id, credential, 0, 50);
      const a = new Agent(limited.app);
      await a.register('spammer');
      const codes = [];
      for (let i = 0; i < 3; i++) codes.push((await a.post(`/api/games/${game.id}/join`, {})).statusCode);
      assert.deepEqual(codes, [201, 201, 429]);
      // Another user from the same IP is not affected.
      const b = new Agent(limited.app);
      await b.register('innocent');
      assert.equal((await b.post(`/api/games/${game.id}/join`, {})).statusCode, 201);
    } finally {
      await limited.close();
    }
  });
});

describe('ticket storage', () => {
  test('only the hash is stored', async () => {
    const { game, player } = await world();
    await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    const row = await ctx.prisma.joinTicket.findFirstOrThrow();
    assert.equal(row.tokenHash, hashTicket(ticket));
    const dump = JSON.stringify(await ctx.prisma.$queryRawUnsafe('SELECT * FROM join_tickets'));
    assert.ok(!dump.includes(ticket));
  });
});

describe('launcher resolve', () => {
  test('valid resolve returns the pre-selected server and identity, without redeeming', async () => {
    const { game, player, playerUser } = await world();
    const { server } = await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    const res = await resolve(ticket);
    assert.equal(res.statusCode, 200);
    const body = LauncherResolveResponse.parse(res.json());
    assert.deepEqual(body.server, { host: '10.1.2.3', port: 2005 });
    assert.equal(body.player.id, playerUser.id);
    assert.equal(body.player.username, 'player1');
    assert.ok(body.player.numericId > 0);
    assert.equal(body.game.id, game.id);
    const row = await ctx.prisma.joinTicket.findFirstOrThrow();
    assert.equal(row.redeemedAt, null, 'resolve must not redeem');
    assert.ok(row.launcherResolvedAt);
    assert.equal(row.serverId, server.id);
  });

  test('invalid, malformed, expired and revoked tickets are rejected identically', async () => {
    const { game, player } = await world();
    await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    const bodies = [];
    for (const t of ['rvjt_' + 'A'.repeat(43), 'rvjt_short', 'rvgs_' + 'A'.repeat(43), '', 42, null, ticket + 'x']) {
      const res = await resolve(t);
      assert.equal(res.statusCode, 404, String(t));
      bodies.push(res.body);
    }
    await ctx.prisma.joinTicket.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });
    bodies.push((await resolve(ticket)).body);
    await ctx.prisma.joinTicket.updateMany({ data: { expiresAt: new Date(Date.now() + 60_000), revokedAt: new Date() } });
    bodies.push((await resolve(ticket)).body);
    assert.equal(new Set(bodies).size, 1, 'all failures look the same');
    assert.equal(JSON.parse(bodies[0]!).error.code, 'TICKET_INVALID');
  });

  test('extra fields cannot pick a server', async () => {
    const { game, player } = await world();
    await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/launcher/ticket/resolve',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ ticket, host: 'evil.example', port: 1, serverId: 'x' }),
    });
    assert.equal(res.statusCode, 404);
  });

  test('resolve is limited to 3 times per ticket', async () => {
    const { game, player } = await world();
    await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    const codes = [];
    for (let i = 0; i < 4; i++) codes.push((await resolve(ticket)).statusCode);
    assert.deepEqual(codes, [200, 200, 200, 404]);
  });

  test('a server that went away after issuance is not handed out', async () => {
    const { game, player } = await world();
    const { server } = await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    await ctx.prisma.gameServer.update({ where: { id: server.id }, data: { lastHeartbeatAt: new Date(Date.now() - 91_000) } });
    assert.equal((await resolve(ticket)).statusCode, 404);
  });
});

describe('redemption', () => {
  test('valid redemption returns backend identity; second redemption fails', async () => {
    const { game, player, playerUser } = await world();
    const { credential } = await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    await resolve(ticket);
    const res = await redeem(credential, ticket);
    assert.equal(res.statusCode, 200, res.body);
    const body = RedeemTicketResponse.parse(res.json());
    assert.equal(body.user.id, playerUser.id);
    assert.equal(body.user.username, 'player1');
    const again = await redeem(credential, ticket);
    assert.equal(again.statusCode, 403);
    assert.equal(again.json().error.details.reason, 'already_redeemed');
    assert.equal((await resolve(ticket)).statusCode, 404, 'redeemed tickets no longer resolve');
  });

  test('simultaneous redemptions: exactly one succeeds', async () => {
    const { game, player } = await world();
    const { credential } = await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    const results = await Promise.all(Array.from({ length: 10 }, () => redeem(credential, ticket)));
    const ok = results.filter((r) => r.statusCode === 200).length;
    assert.equal(ok, 1, results.map((r) => r.statusCode).join(','));
  });

  test("another server cannot redeem this server's ticket", async () => {
    const { game, player } = await world();
    const mine = await onlineServer(ctx.app, game.id, 5, 10, 2001);
    const other = await onlineServer(ctx.app, game.id, 9, 10, 2002);
    const { ticket } = (await join(player, game.id)).json();
    assert.equal((await ctx.prisma.joinTicket.findFirstOrThrow()).serverId, mine.server.id);
    const res = await redeem(other.credential, ticket);
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error.details.reason, 'invalid');
    assert.equal((await redeem(mine.credential, ticket)).statusCode, 200, 'still redeemable by the right server');
  });

  test('expired tickets are rejected', async () => {
    const { game, player } = await world();
    const { credential } = await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    await ctx.prisma.joinTicket.updateMany({ data: { expiresAt: new Date(Date.now() - 1) } });
    const res = await redeem(credential, ticket);
    assert.equal(res.json().error.details.reason, 'expired');
  });

  test('a user banned after issuance cannot redeem', async () => {
    const { game, player, playerUser } = await world();
    const { credential } = await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    await ctx.prisma.user.update({ where: { id: playerUser.id }, data: { bannedUntil: new Date(Date.now() + 3_600_000) } });
    const res = await redeem(credential, ticket);
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error.details.reason, 'banned');
    assert.equal((await ctx.prisma.joinTicket.findFirstOrThrow()).redeemedAt, null);
  });

  test('stale/draining redeeming server policy: rejected, ticket not consumed', async () => {
    const { game, player } = await world();
    const { server, credential } = await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    await ctx.prisma.gameServer.update({ where: { id: server.id }, data: { status: 'draining' } });
    assert.equal((await redeem(credential, ticket)).json().error.details.reason, 'server_not_accepting');
    await ctx.prisma.gameServer.update({ where: { id: server.id }, data: { status: 'online', lastHeartbeatAt: new Date(Date.now() - 91_000) } });
    assert.equal((await redeem(credential, ticket)).json().error.details.reason, 'server_not_accepting');
    await heartbeat(ctx.app, server.id, credential, 0, 10);
    assert.equal((await redeem(credential, ticket)).statusCode, 200, 'redeemable once the server is healthy again');
  });

  test('a banned user cannot get a ticket, and a pre-ban ticket cannot be resolved', async () => {
    const { game, player, playerUser } = await world();
    await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    await ctx.prisma.user.update({ where: { id: playerUser.id }, data: { bannedUntil: new Date(Date.now() + 3_600_000) } });
    assert.equal((await join(player, game.id)).statusCode, 401);
    assert.equal((await resolve(ticket)).statusCode, 404);
  });

  test('logout revokes unused tickets', async () => {
    const { game, player } = await world();
    const { credential } = await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    await player.post('/api/auth/logout');
    assert.equal((await redeem(credential, ticket)).json().error.details.reason, 'revoked');
  });

  test('malformed redeem requests', async () => {
    const { game } = await world();
    const { credential } = await onlineServer(ctx.app, game.id);
    for (const t of ['nope', '', null, 'rvjt_' + 'A'.repeat(43)]) {
      const res = await redeem(credential, t);
      assert.equal(res.statusCode, 403);
      assert.equal(res.json().error.details.reason, 'invalid');
    }
  });
});

describe('credential separation', () => {
  test('a web session (even admin, with CSRF) cannot redeem', async () => {
    const { game, player, owner, ownerUser } = await world();
    await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    await ctx.prisma.user.update({ where: { id: ownerUser.id }, data: { role: 'admin' } });
    const res = await owner.post('/api/internal/join-tickets/redeem', { ticket });
    assert.equal(res.statusCode, 401);
    assert.equal((await ctx.prisma.joinTicket.findFirstOrThrow()).redeemedAt, null);
  });

  test('a join ticket cannot authenticate anything else', async () => {
    const { game, player } = await world();
    await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    const asBearer = { authorization: `Bearer ${ticket}` };
    const asCookie = { cookie: `${COOKIE}=${ticket}` };
    for (const headers of [asBearer, asCookie]) {
      assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers })).json().authenticated, false);
      assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/users/me/settings', headers })).statusCode, 401);
    }
    assert.equal((await redeem(ticket, ticket)).statusCode, 401, 'ticket is not a server credential');
    const hb = await ctx.app.inject({ method: 'GET', url: '/api/admin/servers', headers: asBearer });
    assert.equal(hb.statusCode, 401);
  });

  test('a game-server credential cannot act as a user or resolve tickets', async () => {
    const { game, player } = await world();
    const { credential } = await onlineServer(ctx.app, game.id);
    const headers = { authorization: `Bearer ${credential}` };
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/auth/me', headers })).json().authenticated, false);
    const csrfLess = await ctx.app.inject({ method: 'POST', url: `/api/games/${game.id}/join`, headers: { ...headers, 'content-type': 'application/json' }, payload: '{}' });
    assert.ok([401, 403].includes(csrfLess.statusCode));
    assert.equal((await resolve(credential)).statusCode, 404);
    void player;
  });

  test('the launcher endpoint ignores cookies (a session is not a ticket)', async () => {
    const { game, player } = await world();
    await onlineServer(ctx.app, game.id);
    await join(player, game.id);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/launcher/ticket/resolve',
      headers: { cookie: `${COOKIE}=${player.cookies.get(COOKIE)}`, 'content-type': 'application/json' },
      payload: '{}',
    });
    assert.equal(res.statusCode, 404);
  });
});

describe('ticket cleanup', () => {
  const HOUR = 3_600_000;
  async function seedTickets() {
    const { game, playerUser } = await world();
    const { server } = await onlineServer(ctx.app, game.id);
    const now = Date.now();
    const base = { userId: playerUser.id, gameId: game.id, serverId: server.id };
    const rows = {
      active: { expiresAt: new Date(now + 60_000) },
      recentlyExpired: { expiresAt: new Date(now - 5 * 60_000) },
      longExpired: { expiresAt: new Date(now - 2 * HOUR) },
      recentlyRedeemed: { expiresAt: new Date(now + 60_000), redeemedAt: new Date(now - HOUR / 2) },
      oldRedeemed: { expiresAt: new Date(now - 25 * HOUR), redeemedAt: new Date(now - 25 * HOUR) },
      recentlyRevoked: { expiresAt: new Date(now + 60_000), revokedAt: new Date(now - 60_000) },
      oldRevoked: { expiresAt: new Date(now - 30 * HOUR), revokedAt: new Date(now - 30 * HOUR) },
      // Age of the row does not matter; only expiry/redemption/revocation do.
      activeWithOddClock: { expiresAt: new Date(now + 60_000), createdAt: new Date(now - 48 * HOUR) },
    };
    const ids: Record<string, string> = {};
    for (const [name, data] of Object.entries(rows)) {
      ids[name] = (await ctx.prisma.joinTicket.create({ data: { ...base, createdAt: new Date(data.expiresAt.getTime() - 90_000), ...data, tokenHash: hashTicket(`rvjt_${name.padEnd(43, 'x')}`) } })).id;
    }
    return ids;
  }

  test('deletes only dead tickets and never an active one', async () => {
    const ids = await seedTickets();
    assert.equal(await cleanupTickets(ctx.prisma), 3);
    const left = new Set((await ctx.prisma.joinTicket.findMany({ select: { id: true } })).map((t) => t.id));
    for (const keep of ['active', 'recentlyExpired', 'recentlyRedeemed', 'recentlyRevoked', 'activeWithOddClock']) assert.ok(left.has(ids[keep]!), keep);
    for (const gone of ['longExpired', 'oldRedeemed', 'oldRevoked']) assert.ok(!left.has(ids[gone]!), gone);
  });

  test('concurrent cleanups are safe and idempotent', async () => {
    await seedTickets();
    const counts = await Promise.all(Array.from({ length: 6 }, () => cleanupTickets(ctx.prisma)));
    assert.equal(counts.reduce((a, b) => a + b, 0), 3, 'each dead ticket deleted exactly once in total');
    assert.equal(await ctx.prisma.joinTicket.count(), 5);
    assert.equal(await cleanupTickets(ctx.prisma), 0);
  });

  test('an active ticket stays redeemable after cleanup', async () => {
    const { game, player } = await world();
    const { credential } = await onlineServer(ctx.app, game.id);
    const { ticket } = (await join(player, game.id)).json();
    await Promise.all([cleanupTickets(ctx.prisma), cleanupTickets(ctx.prisma)]);
    assert.equal((await redeem(credential, ticket)).statusCode, 200);
  });
});

describe('internal rate limits', () => {
  test('game-server calls use their own budget, not the public global limit', async () => {
    const small = await setup({ RATE_LIMIT_GLOBAL_MAX: '3', RATE_LIMIT_INTERNAL_MAX: '8' });
    try {
      await resetDb(small.prisma);
      const owner = await small.prisma.user.create({ data: { username: 'rlowner', usernameNormalized: 'rlowner', passwordHash: 'x' } });
      const game = await small.prisma.game.create({ data: { name: 'RL', creatorId: owner.id, isPublic: true } });
      const { server, credential } = await provisionServer(small.prisma, { gameId: game.id, host: '10.1.2.3', port: 2005 });
      const call = () => heartbeat(small.app, server.id, credential, 0, 10);
      const codes = [];
      for (let i = 0; i < 9; i++) codes.push((await call()).statusCode);
      assert.deepEqual(codes.slice(0, 8), Array(8).fill(200), 'more than the global limit of 3');
      assert.equal(codes[8], 429, 'but the internal budget still applies');
    } finally {
      await small.close();
    }
  });
});
