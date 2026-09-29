import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Agent, resetDb, setup, type TestContext } from './helpers.js';

let ctx: TestContext;
before(async () => {
  ctx = await setup();
});
after(async () => ctx.close());
beforeEach(async () => resetDb(ctx.prisma));

async function users() {
  const alice = new Agent(ctx.app);
  const bob = new Agent(ctx.app);
  const carol = new Agent(ctx.app);
  return {
    alice, bob, carol,
    aliceId: (await alice.register('alice')).id,
    bobId: (await bob.register('bob')).id,
    carolId: (await carol.register('carol')).id,
  };
}

describe('profiles and search', () => {
  test('public profile returns safe fields and counts', async () => {
    const { alice, bobId } = await users();
    const res = await ctx.app.inject({ method: 'GET', url: `/api/users/${bobId}` });
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.equal(body.user.username, 'bob');
    assert.equal(body.user.displayName, 'bob');
    assert.deepEqual(body.stats, { friendCount: 0, followerCount: 0, followingCount: 0 });
    assert.equal(body.relationship, null);
    const viewed = (await alice.get(`/api/users/${bobId}`)).json();
    assert.deepEqual(viewed.relationship, { friendship: { status: 'none', direction: null }, isFollowing: false });
  });

  test('unknown or malformed ids are 404', async () => {
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/users/not-a-uuid' })).statusCode, 404);
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/users/00000000-0000-4000-8000-000000000000' })).statusCode, 404);
  });

  test('search is case-insensitive, paginated and bounded', async () => {
    await users();
    const res = await ctx.app.inject({ method: 'GET', url: '/api/users?search=AL&limit=10' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().users.map((u: { username: string }) => u.username), ['alice']);
    const all = (await ctx.app.inject({ method: 'GET', url: '/api/users?limit=2&page=2' })).json();
    assert.equal(all.total, 3);
    assert.equal(all.totalPages, 2);
    assert.equal(all.users.length, 1);
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/users?limit=1000' })).statusCode, 400);
    assert.equal((await ctx.app.inject({ method: 'GET', url: '/api/users?search=%25' })).statusCode, 400);
  });

  test('PATCH /api/users/me updates description and display name', async () => {
    const { alice, aliceId } = await users();
    const res = await alice.patch('/api/users/me', { displayName: '  Alice W.  ', description: 'hello\u0007 world' });
    assert.equal(res.statusCode, 200);
    const profile = (await ctx.app.inject({ method: 'GET', url: `/api/users/${aliceId}` })).json();
    assert.equal(profile.user.displayName, 'Alice W.');
    assert.equal(profile.user.description, 'hello world');
    assert.equal((await alice.patch('/api/users/me', { username: 'renamed' })).statusCode, 400);
    assert.equal((await alice.patch('/api/users/me', { description: 'x'.repeat(1001) })).statusCode, 400);
  });
});

describe('friends', () => {
  test('request, accept, list, then unfriend', async () => {
    const { alice, bob, aliceId, bobId } = await users();
    assert.equal((await alice.post(`/api/friends/${bobId}/request`)).statusCode, 201);
    assert.deepEqual((await alice.get(`/api/users/${bobId}`)).json().relationship.friendship, { status: 'pending', direction: 'outgoing' });
    assert.deepEqual((await bob.get(`/api/users/${aliceId}`)).json().relationship.friendship, { status: 'pending', direction: 'incoming' });

    const requests = (await bob.get('/api/users/me/friend-requests')).json().requests;
    assert.deepEqual(requests.map((r: { user: { id: string } }) => r.user.id), [aliceId]);

    assert.equal((await bob.post(`/api/friends/${aliceId}/accept`)).statusCode, 200);
    const friends = (await ctx.app.inject({ method: 'GET', url: `/api/users/${aliceId}/friends` })).json();
    assert.deepEqual(friends.users.map((u: { username: string }) => u.username), ['bob']);
    assert.equal((await ctx.app.inject({ method: 'GET', url: `/api/users/${bobId}` })).json().stats.friendCount, 1);

    assert.equal((await alice.del(`/api/friends/${bobId}`)).statusCode, 200);
    assert.equal(await ctx.prisma.friendship.count(), 0);
  });

  test('self request is rejected', async () => {
    const { alice, aliceId } = await users();
    assert.equal((await alice.post(`/api/friends/${aliceId}/request`)).statusCode, 400);
  });

  test('duplicate requests are rejected in both directions', async () => {
    const { alice, bob, aliceId, bobId } = await users();
    await alice.post(`/api/friends/${bobId}/request`);
    assert.equal((await alice.post(`/api/friends/${bobId}/request`)).statusCode, 409);
    assert.equal((await bob.post(`/api/friends/${aliceId}/request`)).statusCode, 409);
    assert.equal(await ctx.prisma.friendship.count(), 1);
  });

  test('only the receiver can accept', async () => {
    const { alice, carol, aliceId, bobId } = await users();
    await alice.post(`/api/friends/${bobId}/request`);
    // The sender cannot accept their own request.
    assert.equal((await alice.post(`/api/friends/${bobId}/accept`)).statusCode, 404);
    // A third party cannot accept it.
    assert.equal((await carol.post(`/api/friends/${aliceId}/accept`)).statusCode, 404);
    assert.equal((await ctx.prisma.friendship.findFirst())?.status, 'pending');
  });

  test('receiver can decline', async () => {
    const { alice, bob, aliceId, bobId } = await users();
    await alice.post(`/api/friends/${bobId}/request`);
    assert.equal((await bob.del(`/api/friends/${aliceId}`)).statusCode, 200);
    assert.equal(await ctx.prisma.friendship.count(), 0);
  });

  test('logged out users cannot send requests', async () => {
    const { bobId } = await users();
    const anon = new Agent(ctx.app);
    assert.equal((await anon.post(`/api/friends/${bobId}/request`)).statusCode, 401);
  });

  test('the database itself refuses self-friendship and reversed duplicates', async () => {
    const { aliceId, bobId } = await users();
    await assert.rejects(ctx.prisma.$executeRawUnsafe(
      `INSERT INTO friendships (id, user_low_id, user_high_id, requester_id) VALUES (gen_random_uuid(), '${aliceId}', '${aliceId}', '${aliceId}')`
    ));
    const [low, high] = [aliceId, bobId].sort();
    await assert.rejects(ctx.prisma.$executeRawUnsafe(
      `INSERT INTO friendships (id, user_low_id, user_high_id, requester_id) VALUES (gen_random_uuid(), '${high}', '${low}', '${high}')`
    ));
  });
});

describe('follows', () => {
  test('follow, list, unfollow', async () => {
    const { alice, aliceId, bobId } = await users();
    assert.equal((await alice.post(`/api/users/${bobId}/follow`)).statusCode, 201);
    const followers = (await ctx.app.inject({ method: 'GET', url: `/api/users/${bobId}/followers` })).json();
    assert.deepEqual(followers.users.map((u: { id: string }) => u.id), [aliceId]);
    const following = (await ctx.app.inject({ method: 'GET', url: `/api/users/${aliceId}/following` })).json();
    assert.deepEqual(following.users.map((u: { id: string }) => u.id), [bobId]);
    assert.equal((await alice.get(`/api/users/${bobId}`)).json().relationship.isFollowing, true);
    assert.equal((await alice.del(`/api/users/${bobId}/follow`)).statusCode, 200);
    assert.equal(await ctx.prisma.follow.count(), 0);
  });

  test('self follow and duplicate follow are rejected', async () => {
    const { alice, aliceId, bobId } = await users();
    assert.equal((await alice.post(`/api/users/${aliceId}/follow`)).statusCode, 400);
    await alice.post(`/api/users/${bobId}/follow`);
    assert.equal((await alice.post(`/api/users/${bobId}/follow`)).statusCode, 409);
    await assert.rejects(ctx.prisma.$executeRawUnsafe(
      `INSERT INTO follows (follower_id, following_id) VALUES ('${aliceId}', '${aliceId}')`
    ));
  });
});
