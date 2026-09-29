import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { createPrismaClient, type PrismaClient } from '@revival/database';
import { loadConfig, type Config } from '../src/config.js';
import { buildServer } from '../src/server.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgresql://revival@127.0.0.1:55432/revival_test';

export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: TEST_DATABASE_URL,
    COOKIE_SECRET: 'test-cookie-secret-that-is-long-enough-000000',
    RATE_LIMIT_AUTH_MAX: '1000',
    RATE_LIMIT_GAME_CREATE_MAX: '1000',
    RATE_LIMIT_JOIN_MAX: '1000',
    RATE_LIMIT_RESOLVE_MAX: '1000',
    ...overrides,
  });
}

export interface TestContext {
  app: FastifyInstance;
  prisma: PrismaClient;
  close: () => Promise<void>;
}

export async function setup(overrides: Record<string, string> = {}): Promise<TestContext> {
  const prisma = createPrismaClient(TEST_DATABASE_URL);
  const app = await buildServer({ config: testConfig(overrides), prisma });
  await app.ready();
  return {
    app,
    prisma,
    close: async () => {
      await app.close();
      await prisma.$disconnect();
    },
  };
}

export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE join_tickets, game_servers, follows, friendships, sessions, games, users CASCADE');
}

/** A tiny browser: keeps cookies and a CSRF token, like the web app does. */
export class Agent {
  cookies = new Map<string, string>();
  csrfToken: string | undefined;

  constructor(private app: FastifyInstance) {}

  private cookieHeader() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  private store(res: LightMyRequestResponse) {
    for (const c of res.cookies) {
      const expired = c.expires && new Date(c.expires).getTime() <= Date.now();
      if (!c.value || expired) this.cookies.delete(c.name);
      else this.cookies.set(c.name, c.value);
    }
  }

  async request(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (unsafe && !this.csrfToken) {
      const res = await this.app.inject({ method: 'GET', url: '/api/auth/csrf', headers: { cookie: this.cookieHeader() } });
      this.store(res);
      this.csrfToken = res.json().csrfToken;
    }
    const res = await this.app.inject({
      method: method as 'GET',
      url,
      headers: {
        cookie: this.cookieHeader(),
        ...(unsafe ? { 'x-csrf-token': this.csrfToken! } : {}),
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
    });
    this.store(res);
    return res;
  }

  get = (url: string) => this.request('GET', url);
  post = (url: string, body: unknown = {}) => this.request('POST', url, body);
  patch = (url: string, body: unknown) => this.request('PATCH', url, body);
  del = (url: string) => this.request('DELETE', url);

  async register(username: string, password = 'correct horse battery') {
    const res = await this.post('/api/auth/register', { username, password });
    if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
    return res.json().user as { id: string; username: string };
  }
}
