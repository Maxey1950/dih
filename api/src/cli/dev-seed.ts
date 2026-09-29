/**
 * DEVELOPMENT ONLY: insert sample users and the two sample games that the
 * old AlphaBlox frontend had hardcoded. Idempotent. Refuses to run with
 * NODE_ENV=production; the API never seeds on startup.
 *
 *   npm run seed:dev
 */
import { randomBytes } from 'node:crypto';
import { createPrismaClient } from '@revival/database';
import { hashPassword } from '../auth/password.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed development data with NODE_ENV=production.');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const prisma = createPrismaClient(url);

async function seedUser(username: string) {
  // Random, unprinted password: seed accounts exist only to own sample games.
  const passwordHash = await hashPassword(randomBytes(24).toString('base64url'));
  return prisma.user.upsert({
    where: { usernameNormalized: username.toLowerCase() },
    update: {},
    create: { username, usernameNormalized: username.toLowerCase(), passwordHash },
  });
}

const builderman = await seedUser('Builderman');
const noob = await seedUser('SampleCreator');

const samples = [
  {
    name: 'Happy Home in Robloxia',
    description: 'cool',
    genre: 'Town and City',
    maxPlayers: 12,
    thumbnailUrl: '/images/2010_place.png',
    visits: 52n,
    upVotes: 3,
    downVotes: 1,
    isFeatured: true,
    creatorId: builderman.id,
  },
  {
    name: 'My First Place',
    description: 'This is your very first creation. Check it out, then make it your own!',
    genre: 'Town and City',
    maxPlayers: 12,
    thumbnailUrl: '/images/default_place.png',
    visits: 9n,
    upVotes: 1,
    downVotes: 0,
    isFeatured: false,
    creatorId: noob.id,
  },
];

for (const sample of samples) {
  const existing = await prisma.game.findFirst({ where: { name: sample.name, creatorId: sample.creatorId } });
  if (existing) {
    console.log(`exists: ${sample.name} (place ${existing.placeId})`);
    continue;
  }
  const game = await prisma.game.create({ data: { ...sample, isPublic: true } });
  console.log(`created: ${game.name} (place ${game.placeId}, id ${game.id})`);
}
await prisma.$disconnect();
