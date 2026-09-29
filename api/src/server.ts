import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { Prisma, type PrismaClient } from '@revival/database';
import type { Config } from './config.js';
import { AppError, apiError } from './errors.js';
import { sessionPlugin } from './auth/session.js';
import { csrfPlugin } from './plugins/csrf.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { socialRoutes } from './routes/social.js';
import { adminRoutes } from './routes/admin.js';

export const API_VERSION = '0.2.0';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    config: Config;
  }
}

export interface ServerDeps {
  config: Config;
  prisma: PrismaClient;
}

export async function buildServer({ config, prisma }: ServerDeps): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      // Never log credentials, session cookies or CSRF tokens. Request bodies are not logged at all.
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-csrf-token"]',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
    },
    bodyLimit: 64 * 1024,
    trustProxy: config.TRUST_PROXY,
  });

  app.decorate('config', config);
  app.decorate('prisma', prisma);

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
    if (error instanceof AppError) {
      reply.code(error.statusCode).send(apiError(error.code, error.message, error.details));
      return;
    }
    if (error.code?.startsWith('FST_CSRF')) {
      reply.code(403).send(apiError('CSRF_INVALID', 'Invalid or missing CSRF token. Refresh the page and try again.'));
      return;
    }
    if (error.statusCode === 429) {
      reply.code(429).send(apiError('RATE_LIMITED', 'Too many attempts. Please wait a moment and try again.'));
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        reply.code(409).send(apiError('CONFLICT', 'That already exists.'));
        return;
      }
      if (error.code === 'P2025') {
        reply.code(404).send(apiError('NOT_FOUND', 'Not found'));
        return;
      }
    }
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      // Fastify's own 4xx (bad JSON, unsupported media type, body too large). Generic message only.
      reply.code(status).send(apiError('BAD_REQUEST', 'Invalid request.'));
      return;
    }
    // Anything else is a bug or an infrastructure failure: log it, reveal nothing.
    request.log.error({ err: error }, 'request failed');
    reply.code(500).send(apiError('INTERNAL', 'Internal server error'));
  });

  await app.register(cookie, { secret: config.COOKIE_SECRET });
  await app.register(rateLimit, {
    global: true,
    max: config.RATE_LIMIT_GLOBAL_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, ctx) => {
      const err = new Error('rate limited') as FastifyError;
      err.statusCode = ctx.statusCode;
      return err;
    },
  });
  await app.register(sessionPlugin);
  await app.register(csrfPlugin);

  await app.register(healthRoutes, { version: API_VERSION });
  await app.register(authRoutes);
  await app.register(userRoutes);
  await app.register(socialRoutes);
  await app.register(adminRoutes);

  return app;
}
