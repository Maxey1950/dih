import { createPrismaClient } from '@revival/database';
import { loadConfig } from './config.js';
import { buildServer } from './server.js';

const config = loadConfig();
const prisma = createPrismaClient(config.DATABASE_URL);
const app = await buildServer({ config, prisma });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
