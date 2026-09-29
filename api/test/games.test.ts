import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GameListResponse, GameResponse } from '@revival/shared';
import { Agent, resetDb, setup, type TestContext } from './helpers.js';

let ctx: TestContext;
before(async () => {
  ctx = await setup();
});
after(async () => ctx.close());
beforeEach(async () => resetDb(ctx.prisma));

const anon = () => ctx.app.inject({ method: 'GET', url: '/api/games' });

async function owner(name = 'alice') {
  const agent = new Agent(ctx.app);
  const user = await agent.register(name);
  return { agent, user };
}

async function createGame(agent: Agent, body: Record<string, unknown> = {}) {
  const res = await agent.post('/api/games', { name: 'My Place', description: 'desc', maxPlayers: 20, isPublic: true, ...body });
  assert.equal(res.statusCode, 201, res.body);
  return GameResponse.parse(res.json()).game;
}

describe('games: create and view', () => {
  test('create sets creator from the session and allocates a placeId', async () => {
    const { agent, user } = await owner();
    const game = await createGame(agent);
    assert.equal(game.creator.id, user.id);
    assert.equal(game.playerCount, 0);
    assert.equal(game.canEdit, true);
    assert.ok(game.placeId > 0);
    const res = await ctx.app.inject({ method: 'GET', url: `/api/games/${game.id}` });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().game.canEdit, false);
  });

  test('creatorId, placeId and other protected fields cannot be supplied', async () => {
    const { agent } = await owner();
    const { user: bob } = await owner('bob');
    for (const extra of [{ creatorId: bob.id }, { placeId: 1 }, { visits: 9999 }, { isFeatured: true }, { thumbnailUrl: 'https://evil.example/x.png' }]) {
      const res = await agent.post('/api/games', { name: 'x', ...extra });
      assert.equal(res.statusCode, 400, JSON.stringify(extra));
    }
    assert.equal(await ctx.prisma.game.count(), 0);
  });

  test('create requires login and valid input', async () => {
    assert.equal((await new Agent(ctx.app).post('/api/games', { name: 'x' })).statusCode, 401);
    const { agent } = await owner();
    for (const body of [{ name: '' }, { name: '   ' }, { name: 'x'.repeat(51) }, { name: 'ok', maxPlayers: 0 }, { name: 'ok', maxPlayers: 101 }, { name: 'ok', maxPlayers: 2.5 }, { name: 'ok', genre: 'Horror' }]) {
      assert.equal((await agent.post('/api/games', body)).statusCode, 400, JSON.stringify(body));
    }
  });

  test('list is paginated and only shows public, non-deleted games', async () => {
    const { agent } = await owner();
    for (let i = 0; i < 5; i++) await createGame(agent, { name: `Public ${i}` });
    await createGame(agent, { name: 'Private', isPublic: false });
    const page1 = GameListResponse.parse((await ctx.app.inject({ method: 'GET', url: '/api/games?limit=2&sort=updated' })).json());
    assert.equal(page1.total, 5);
    assert.equal(page1.totalPages, 3);
    assert.equal(page1.games.length, 2);
    const page3 = GameListResponse.parse((await ctx.app.inject({ method: 'GET', url: '/api/games?limit=2&page=3&sort=updated' })).json());
    assert.equal(page3.games.length, 1);
    assert.ok(![...page1.games, ...page3.games].some((g) => g.name === 'Private'));
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/games?limit=500' })).statusCode, 400);
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/games?sort=random' })).statusCode, 400);
    assert.equal((await anon()).statusCode, 200);
  });

  test('private games are visible only to the creator and admins', async () => {
    const { agent } = await owner();
    const game = await createGame(agent, { isPublic: false });
    assert.equal((await agent.get(`/api/games/${game.id}`)).statusCode, 200);
    assert.equal((await ctx.app.inject({ method: 'GET', url: `/api/games/${game.id}` })).statusCode, 404);
    const { agent: bob } = await owner('bob');
    assert.equal((await bob.get(`/api/games/${game.id}`)).statusCode, 404);
    const mine = (await agent.get(`/api/users/${game.creator.id}/games`)).json();
    assert.equal(mine.games.length, 1);
    const theirs = (await bob.get(`/api/users/${game.creator.id}/games`)).json();
    assert.equal(theirs.games.length, 0);
  });
});

describe('games: permissions', () => {
  test('owner can edit their own game', async () => {
    const { agent } = await owner();
    const game = await createGame(agent);
    const res = await agent.patch(`/api/games/${game.id}`, { name: 'Renamed', maxPlayers: 30, isPublic: false });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().game.name, 'Renamed');
    assert.equal(res.json().game.maxPlayers, 30);
  });

  test("another user cannot edit or delete someone else's game", async () => {
    const { agent } = await owner();
    const game = await createGame(agent);
    const { agent: bob } = await owner('bob');
    const edit = await bob.patch(`/api/games/${game.id}`, { name: 'Hijacked' });
    assert.equal(edit.statusCode, 403);
    assert.equal((await bob.del(`/api/games/${game.id}`)).statusCode, 403);
    assert.equal((await ctx.prisma.game.findUniqueOrThrow({ where: { id: game.id } })).name, 'My Place');
  });

  test('update cannot modify protected fields', async () => {
    const { agent } = await owner();
    const { user: bob } = await owner('bob');
    const game = await createGame(agent);
    for (const patch of [{ creatorId: bob.id }, { placeId: 5 }, { visits: 1 }, { upVotes: 100 }, { deletedAt: null }, { thumbnailUrl: 'x' }]) {
      assert.equal((await agent.patch(`/api/games/${game.id}`, patch)).statusCode, 400, JSON.stringify(patch));
    }
    assert.equal((await agent.patch(`/api/games/${game.id}`, { isFeatured: true })).statusCode, 403);
    const row = await ctx.prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    assert.equal(row.creatorId, game.creator.id);
    assert.equal(row.isFeatured, false);
  });

  test('admins can moderate any game (edit, feature, delete)', async () => {
    const { agent } = await owner();
    const game = await createGame(agent);
    const { agent: admin, user: adminUser } = await owner('moderator1');
    await ctx.prisma.user.update({ where: { id: adminUser.id }, data: { role: 'admin' } });
    const res = await admin.patch(`/api/games/${game.id}`, { name: 'Moderated name', isFeatured: true });
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().game.isFeatured, true);
    assert.equal((await admin.del(`/api/games/${game.id}`)).statusCode, 200);
    assert.equal((await ctx.app.inject({ method: 'GET', url: `/api/games/${game.id}` })).statusCode, 404);
    assert.equal((await agent.get(`/api/games/${game.id}`)).statusCode, 404, 'deleted game hidden from its owner');
    assert.equal((await admin.get(`/api/games/${game.id}`)).statusCode, 200, 'admins still see it');
  });

  test('delete is a soft delete', async () => {
    const { agent } = await owner();
    const game = await createGame(agent);
    assert.equal((await agent.del(`/api/games/${game.id}`)).statusCode, 200);
    const row = await ctx.prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    assert.ok(row.deletedAt);
    assert.equal(row.isPublic, false);
    assert.equal(GameListResponse.parse((await anon()).json()).total, 0);
  });
});
