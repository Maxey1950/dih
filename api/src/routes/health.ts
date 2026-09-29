import type { FastifyPluginAsync } from 'fastify';
import { HealthResponse } from '@revival/shared';

export const healthRoutes: FastifyPluginAsync<{ version: string }> = async (app, opts) => {
  app.get('/health', async () =>
    HealthResponse.parse({
      status: 'ok',
      service: 'api',
      version: opts.version,
      time: new Date().toISOString(),
    })
  );
};
