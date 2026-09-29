import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { Config } from './config.js';
import { apiError } from './errors.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';

export const API_VERSION = '0.1.0';

export function buildServer(config: Pick<Config, 'LOG_LEVEL' | 'NODE_ENV'>): FastifyInstance {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Never log credentials or session material.
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'],
        remove: true,
      },
    },
    bodyLimit: 64 * 1024,
    trustProxy: false,
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'no-referrer');
    return payload;
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.code(404).send(apiError('NOT_FOUND', 'Not found'));
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode && error.statusCode >= 400 && error.statusCode < 600 ? error.statusCode : 500;
    if (status >= 500) {
      request.log.error({ err: error }, 'request failed');
      reply.code(500).send(apiError('INTERNAL', 'Internal server error'));
      return;
    }
    if (error.validation) {
      reply.code(400).send(apiError('VALIDATION_FAILED', 'Invalid request'));
      return;
    }
    reply.code(status).send(apiError(status === 429 ? 'RATE_LIMITED' : 'BAD_REQUEST', error.message));
  });

  app.register(healthRoutes, { version: API_VERSION });
  app.register(authRoutes);

  return app;
}
