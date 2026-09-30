import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    DATABASE_URL: z.string().url(),

    /** Signs the CSRF secret cookie. At least 32 random characters. */
    COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 characters'),
    /** Defaults to true when NODE_ENV=production. Secure cookies also get the __Host- prefix. */
    COOKIE_SECURE: bool.optional(),
    SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

    /** Comma-separated origins allowed to make state-changing requests (Origin header check). */
    WEB_ORIGINS: z.string().default('http://localhost:3000,http://127.0.0.1:3000'),
    /**
     * Which proxies may set X-Forwarded-For (Fastify trustProxy). Default trusts
     * only loopback, i.e. the Next.js dev proxy or a reverse proxy on the same host.
     */
    TRUST_PROXY: z.string().default('127.0.0.1,::1'),

    RATE_LIMIT_AUTH_MAX: z.coerce.number().int().min(1).default(10),
    RATE_LIMIT_AUTH_WINDOW: z.string().default('1 minute'),
    RATE_LIMIT_GLOBAL_MAX: z.coerce.number().int().min(1).default(600),
    /** Games a single IP may create per hour. */
    RATE_LIMIT_GAME_CREATE_MAX: z.coerce.number().int().min(1).default(20),
    /** Join tickets a single user may request per minute. */
    RATE_LIMIT_JOIN_MAX: z.coerce.number().int().min(1).default(5),
    /** Launcher resolve calls per IP per minute. */
    RATE_LIMIT_RESOLVE_MAX: z.coerce.number().int().min(1).default(30),
    /**
     * Internal game-server calls (heartbeat/drain/offline/redeem) per source
     * address per minute. A separate, larger budget than the public global
     * limit, so a burst of junk joins against one RFD server cannot push that
     * server's legitimate redemptions into the public limit.
     */
    RATE_LIMIT_INTERNAL_MAX: z.coerce.number().int().min(1).default(3000),
  })
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    WEB_ORIGINS: env.WEB_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
    TRUST_PROXY: env.TRUST_PROXY.split(',').map((o) => o.trim()).filter(Boolean),
  }));

export type Config = z.infer<typeof EnvSchema>;

/** Parse and validate environment configuration. Fails fast on invalid values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
