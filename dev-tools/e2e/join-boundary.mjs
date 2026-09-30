#!/usr/bin/env node
/**
 * DEVELOPMENT ONLY: end-to-end check of the join boundary against the REAL
 * API and the REAL ticket adapter, hosted by the fake RFD test double
 * (dev-tools/rfd-smoke/fake-rfd). No real RFD, RCC or Roblox binary is run.
 *
 *   npm run build && (cd launcher && cargo build --release)
 *   DATABASE_URL=... npm run e2e:join      # API must be running on 127.0.0.1:4000
 *
 * Verifies: one ticket = one independent join; repeated RFD hooks for that
 * join work; a second connection fails; expired, wrong-server and banned-user
 * tickets fail; the browser never receives server host/port/id; the launcher
 * starts RFD directly (argv, no shell).
 *
 * Starts only: the fake RFD script (twice) and the locally built launcher,
 * via spawn(file, argv, { shell: false }).
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect } from 'node:net';
import { randomBytes } from 'node:crypto';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const API = new URL(process.env.API_ORIGIN ?? 'http://127.0.0.1:4000');
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000';
const FAKE_RFD = join(REPO, 'dev-tools', 'rfd-smoke', 'fake-rfd', 'fake_rfd.py');
const LAUNCHER = join(REPO, 'launcher', 'target', 'release', process.platform === 'win32' ? 'ourrevival-launcher.exe' : 'ourrevival-launcher');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const { createPrismaClient } = await import('@revival/database');
const { provisionServer } = await import(join(REPO, 'api', 'dist', 'servers', 'provision.js'));
const prisma = createPrismaClient(process.env.DATABASE_URL);

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Browser {
  cookies = new Map();
  csrf;
  async req(method, path, body) {
    const unsafe = method !== 'GET';
    if (unsafe && !this.csrf) this.csrf = (await (await this.req('GET', '/api/auth/csrf')).json()).csrfToken;
    const res = await fetch(new URL(path, API), {
      method,
      headers: {
        cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; '),
        ...(unsafe ? { 'x-csrf-token': this.csrf, origin: WEB_ORIGIN, 'content-type': 'application/json' } : {}),
      },
      body: unsafe ? JSON.stringify(body ?? {}) : undefined,
    });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      this.cookies.set(kv.slice(0, i), kv.slice(i + 1));
    }
    return res;
  }
}

const probe = (port) =>
  new Promise((resolve) => {
    const s = connect({ host: '127.0.0.1', port });
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
  });

const children = [];
const tmps = [];
async function startFakeRfd(port, credential) {
  const dir = mkdtempSync(join(tmpdir(), 'e2e-rfd-'));
  tmps.push(dir);
  copyFileSync(join(REPO, 'rfd', 'adapter', 'revival_ticket_adapter.py'), join(dir, 'revival_ticket_adapter.py'));
  copyFileSync(join(REPO, 'rfd', 'GameConfig.revival.toml'), join(dir, 'GameConfig.toml'));
  const secretDir = mkdtempSync(join(tmpdir(), 'e2e-secret-'));
  tmps.push(secretDir);
  const cred = join(secretDir, 'gs.credential');
  writeFileSync(cred, credential + '\n', { mode: 0o600 });
  const env = { PATH: process.env.PATH, HOME: process.env.HOME, REVIVAL_API_URL: API.origin, REVIVAL_GAME_SERVER_CREDENTIAL_FILE: cred };
  const child = spawn(FAKE_RFD, ['server', '--skip_download', '--config', join(dir, 'GameConfig.toml'), '--web_port', String(port)], { shell: false, env, stdio: ['ignore', 'ignore', 'pipe'] });
  child.stderr.on('data', (d) => process.stderr.write(`[fake-rfd:${port}] ${d}`));
  children.push(child);
  for (let i = 0; i < 50 && !(await probe(port)); i++) await sleep(100);
}
const rfdGet = async (port, path) => {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: res.status, body: await res.json() };
};
const joinData = (port, ticket) => rfdGet(port, `/join?code=${encodeURIComponent(ticket)}`);
const connectPlayer = (port, uid) => rfdGet(port, `/rfd/is-player-allowed?userId=${uid}`);

const heartbeat = (id, credential) =>
  fetch(new URL(`/api/internal/servers/${id}/heartbeat`, API), {
    method: 'POST',
    headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' },
    body: JSON.stringify({ playerCount: 0, maxPlayers: 10 }),
  });

const suffix = randomBytes(3).toString('hex');
const created = { users: [], servers: [], games: [] };
try {
  // --- world ---
  const owner = new Browser();
  const player = new Browser();
  const password = randomBytes(18).toString('base64url');
  for (const [b, name] of [[owner, `e2eown_${suffix}`], [player, `e2eply_${suffix}`]]) {
    const res = await b.req('POST', '/api/auth/register', { username: name, password });
    if (res.status !== 201 && res.status !== 200) throw new Error(`register ${name}: HTTP ${res.status} ${await res.text()}`);
    created.users.push(name.toLowerCase());
  }
  const me = await prisma.user.findUniqueOrThrow({ where: { usernameNormalized: `e2eply_${suffix}` } });
  const gameA = (await (await owner.req('POST', '/api/games', { name: `E2E A ${suffix}`, maxPlayers: 10, isPublic: true })).json()).game;
  const gameB = (await (await owner.req('POST', '/api/games', { name: `E2E B ${suffix}`, maxPlayers: 10, isPublic: true })).json()).game;
  created.games.push(gameA.id, gameB.id);
  const portA = 2200 + Math.floor(Math.random() * 400);
  const portB = portA + 1;
  const a = await provisionServer(prisma, { gameId: gameA.id, host: '127.0.0.1', port: portA });
  const b = await provisionServer(prisma, { gameId: gameB.id, host: '127.0.0.1', port: portB });
  created.servers.push(a.server.id, b.server.id);
  await heartbeat(a.server.id, a.credential);
  await heartbeat(b.server.id, b.credential);
  await startFakeRfd(portA, a.credential);
  await startFakeRfd(portB, b.credential);

  // --- browser-visible data ---
  const joinRes = await player.req('POST', `/api/games/${gameA.id}/join`, {});
  const joinText = await joinRes.text();
  const { ticket: t1 } = JSON.parse(joinText);
  const visible = [
    joinText,
    await (await player.req('GET', `/api/games/${gameA.id}`)).text(),
    await (await player.req('GET', `/api/games/${gameA.id}/servers`)).text(),
    await (await player.req('GET', '/api/games')).text(),
  ].join('\n');
  const leaks = [a.server.id, b.server.id, `"host"`, `"port"`, String(portA), `"serverId"`, 'rvgs_'].filter((s) => visible.includes(s));
  check('browser never receives server host/port/id', leaks.length === 0, leaks.join(', '));

  // --- one ticket = one independent join ---
  const j1 = await joinData(portA, t1);
  const j1again = await joinData(portA, t1);
  check('repeated RFD join-data hooks for one join work', j1.status === 200 && j1again.status === 200 && j1.body.id === me.numericId);
  const c1 = await connectPlayer(portA, me.numericId);
  check('the join\'s connection is admitted', c1.body.allowed === true);
  const c2 = await connectPlayer(portA, me.numericId);
  check('a second connection with the same ticket is refused', c2.body.allowed === false);
  const replayOther = await joinData(portB, t1);
  check('the redeemed ticket is refused on another server', replayOther.status === 403);

  // --- wrong server ---
  const { ticket: t2 } = await (await player.req('POST', `/api/games/${gameA.id}/join`, {})).json();
  check('wrong server cannot redeem a ticket', (await joinData(portB, t2)).status === 403);
  check('...and does not consume it (right server still can)', (await joinData(portA, t2)).status === 200);

  // --- expiry ---
  const { ticket: t3 } = await (await player.req('POST', `/api/games/${gameA.id}/join`, {})).json();
  await prisma.joinTicket.updateMany({
    where: { user: { numericId: me.numericId }, redeemedAt: null, revokedAt: null },
    data: { createdAt: new Date(Date.now() - 200_000), expiresAt: new Date(Date.now() - 1000) },
  });
  check('an expired ticket is refused', (await joinData(portA, t3)).status === 403);

  // --- banned ---
  const { ticket: t4 } = await (await player.req('POST', `/api/games/${gameA.id}/join`, {})).json();
  await prisma.user.update({ where: { numericId: me.numericId }, data: { bannedUntil: new Date(Date.now() + 3_600_000) } });
  check('a user banned before redemption is refused', (await joinData(portA, t4)).status === 403);
  await prisma.user.update({ where: { numericId: me.numericId }, data: { bannedUntil: null } });

  // --- launcher: direct argv spawn of the configured RFD, no shell ---
  const dir = mkdtempSync(join(tmpdir(), 'e2e-launcher-'));
  tmps.push(dir);
  const cfg = join(dir, 'launcher.json');
  writeFileSync(cfg, JSON.stringify({ apiBaseUrl: API.origin, rfdExecutable: FAKE_RFD, developmentAllowHttpLocalhost: true }));
  const { launchUrl } = await (await player.req('POST', `/api/games/${gameA.id}/join`, {})).json();
  const out = await new Promise((resolve) => {
    const env = { PATH: process.env.PATH, HOME: process.env.HOME, OURREVIVAL_LAUNCHER_CONFIG: cfg };
    const child = spawn(LAUNCHER, [launchUrl], { shell: false, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    child.stderr.on('data', (d) => (text += d));
    child.stdout.on('data', (d) => (text += d));
    child.on('exit', async (code) => {
      await sleep(1500); // the fake player (started by the launcher) reports on the same stderr
      resolve({ code, text });
    });
  });
  check('launcher starts RFD directly and the player is admitted', out.code === 0 && /connection ADMITTED/.test(out.text), out.text.trim().split('\n').join(' | '));
  check('launcher output never contains the ticket', !/rvjt_[A-Za-z0-9_-]{43}/.test(out.text));
} catch (err) {
  check('e2e run completed', false, err.message);
} finally {
  for (const c of children) c.kill();
  for (const d of tmps) rmSync(d, { recursive: true, force: true });
  await prisma.gameServer.deleteMany({ where: { id: { in: created.servers } } });
  await prisma.game.deleteMany({ where: { id: { in: created.games } } });
  await prisma.user.deleteMany({ where: { usernameNormalized: { in: created.users } } });
  await prisma.$disconnect();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
