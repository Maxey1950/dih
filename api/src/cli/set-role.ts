/**
 * Grant or remove a role. This is the only way to create an admin; there is
 * no id-based or "first user" privilege.
 *   npm run user:set-role -w @revival/api -- <username> <user|moderator|admin>
 */
import { createPrismaClient } from '@revival/database';
import { normalizeUsername } from '@revival/shared';

const [username, role] = process.argv.slice(2);
const roles = ['user', 'moderator', 'admin'] as const;
if (!username || !roles.includes(role as (typeof roles)[number])) {
  console.error('Usage: set-role <username> <user|moderator|admin>');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}
const prisma = createPrismaClient(url);
const updated = await prisma.user.updateMany({
  where: { usernameNormalized: normalizeUsername(username) },
  data: { role: role as (typeof roles)[number] },
});
console.log(updated.count ? `Set ${username} to ${role}.` : `No user named ${username}.`);
await prisma.$disconnect();
