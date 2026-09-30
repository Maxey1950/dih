#!/usr/bin/env node
/**
 * DEVELOPMENT ONLY: end-to-end smoke test against a REAL, user-supplied RFD build.
 *
 *   npm run build            # api/dist is used for provisioning and ticket issuance
 *   (cd launcher && cargo build --release)
 *   DATABASE_URL=... npm run rfd:smoke -- --rfd-path "C:\RFD\RFD.exe" --place "C:\places\baseplate.rbxl"
 *   npm run rfd:smoke -- --rfd-path /abs/RFD --place /abs/place.rbxl --dry-run
 *
 * The API must already be running (npm run dev:api) on a loopback/private address.
 *
 * Steps: verify files -> provision a throwaway GameServer -> write a temporary
 * GameConfig -> start ONLY the supplied RFD executable (server mode, with
 * --skip_download) -> heartbeat -> issue a ticket -> run the launcher with the
 * launch URL -> observe redemption -> check the ticket cannot be redeemed again
 * -> report -> shut down and delete the throwaway server.
 *
 * Rules this script enforces:
 * - It NEVER downloads anything and always passes --skip_download to RFD.
 * - It runs exactly two programs, both given by absolute path: the RFD
 *   executable (--rfd-path) and the launcher (--launcher-path). Both via
 *   spawn(file, argv, { shell: false }). No shell, no cmd.exe, no PowerShell.
 * - It refuses paths under any `2015` directory and the legacy AlphaBlox
 *   binaries (patchedrcc.exe, newrccpatched.exe, RccService.exe).
 * - RFD, the API and the game-server address must be on localhost or a private network.
 * - The raw ticket and the server credential are never printed. The
 *   credential is handed to RFD through a chmod-600 temp file, not argv.
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { connect } from 'node:net';
import { isIP } from 'node:net';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FORBIDDEN_NAMES = new Set(['patchedrcc.exe', 'newrccpatched.exe', 'rccservice.exe']);
const isWindows = process.platform === 'win32';

const { values: opt } = parseArgs({
  options: {
    'rfd-path': { type: 'string' },
    place: { type: 'string' },
    'launcher-path': { type: 'string' },
    api: { type: 'string', default: 'http://127.0.0.1:4000' },
    'rfd-host': { type: 'string', default: '127.0.0.1' },
    'web-port': { type: 'string', default: '2005' },
    timeout: { type: 'string', default: '120' },
    hold: { type: 'string', default: '20' },
    'keep-temp': { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
  strict: true,
});

const log = (msg) => console.log(`[rfd-smoke] ${msg}`);
function die(msg) {
  console.error(`[rfd-smoke] error: ${msg}`);
  process.exit(1);
}

// ---------- 1. verify inputs ----------

function checkPrivateHost(host, what) {
  if (host === 'localhost') return;
  const v = isIP(host);
  if (!v) die(`${what} must be localhost or an IP literal`);
  const private4 = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
  if (v === 4 ? !private4.test(host) : !(host === '::1' || /^f[cd]/i.test(host))) die(`${what} must be loopback or a private-network address`);
}

function checkFile(path, what) {
  if (!path) die(`--${what} is required`);
  if (!isAbsolute(path)) die(`--${what} must be an absolute path`);
  if (!existsSync(path)) die(`--${what} does not exist: ${path}`);
  const real = realpathSync(path);
  if (!statSync(real).isFile()) die(`--${what} is not a file: ${path}`);
  const parts = real.split(/[\\/]+/).map((p) => p.toLowerCase());
  if (parts.includes('2015')) die(`--${what} is inside a "2015" directory; legacy AlphaBlox binaries are never run`);
  if (FORBIDDEN_NAMES.has(basename(real).toLowerCase())) die(`--${what} is a legacy AlphaBlox/RCC binary; refusing to run it`);
  return real;
}

const api = new URL(opt.api);
if (!['http:', 'https:'].includes(api.protocol) || api.pathname !== '/' || api.username || api.search) die('--api must be a bare http(s) origin');
checkPrivateHost(api.hostname.replace(/^\[|\]$/g, ''), '--api host');
checkPrivateHost(opt['rfd-host'], '--rfd-host');
const webPort = Number(opt['web-port']);
if (!Number.isInteger(webPort) || webPort < 1 || webPort > 65535) die('--web-port must be 1-65535');
const timeoutMs = Number(opt.timeout) * 1000;
const holdMs = Number(opt.hold) * 1000;
if (!(timeoutMs > 0 && timeoutMs <= 600_000) || !(holdMs >= 0 && holdMs <= 600_000)) die('--timeout/--hold must be 0-600 seconds');

const rfdPath = checkFile(opt['rfd-path'], 'rfd-path');
const placePath = checkFile(opt.place, 'place');
const defaultLauncher = join(REPO, 'launcher', 'target', 'release', isWindows ? 'ourrevival-launcher.exe' : 'ourrevival-launcher');
const launcherPath = checkFile(opt['launcher-path'] ?? defaultLauncher, 'launcher-path');
const adapterSrc = join(REPO, 'rfd', 'adapter', 'revival_ticket_adapter.py');
const gameConfigSrc = join(REPO, 'rfd', 'GameConfig.revival.toml');
for (const f of [adapterSrc, gameConfigSrc]) if (!existsSync(f)) die(`missing repo file ${f}`);

const serverArgv = (configPath) => ['server', '--skip_download', '--config', configPath, '--web_port', String(webPort)];
log(`RFD executable:  ${rfdPath}`);
log(`launcher:        ${launcherPath}`);
log(`place file:      ${placePath}`);
log(`API:             ${api.origin}`);
log(`RFD web server:  ${opt['rfd-host']}:${webPort}`);
log(`server argv:     [RFD] ${serverArgv('<temp>/GameConfig.toml').join(' ')}`);
log(`launcher argv:   [launcher] ourrevival://join?ticket=<one-time ticket, not printed>`);
if (opt['dry-run']) {
  log('dry run: inputs are valid; nothing was provisioned or started.');
  process.exit(0);
}

// ---------- helpers ----------

const children = [];
function start(file, argv, env, name) {
  const child = spawn(file, argv, { shell: false, env, cwd: dirname(file), stdio: ['ignore', 'pipe', 'pipe'], detached: !isWindows, windowsHide: false });
  const tail = [];
  const keep = (buf) => {
    for (const line of buf.toString('utf8').split(/\r?\n/)) if (line) tail.push(line.replace(/rvjt_[A-Za-z0-9_-]{43}/g, 'rvjt_<redacted>').replace(/rvgs_[A-Za-z0-9_-]{43}/g, 'rvgs_<redacted>'));
    tail.splice(0, Math.max(0, tail.length - 40));
  };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  const entry = { name, child, tail, exited: null };
  child.on('exit', (code, signal) => (entry.exited = { code, signal }));
  child.on('error', (err) => (entry.exited = { code: -1, signal: err.code }));
  children.push(entry);
  return entry;
}

function stopAll() {
  for (const { child, exited } of children) {
    if (exited || child.pid === undefined) continue;
    try {
      if (isWindows) child.kill();
      else process.kill(-child.pid, 'SIGTERM'); // whole process group: includes the RFD player the launcher started
    } catch {
      /* already gone */
    }
  }
}

function childEnv(extra) {
  // Pass the ordinary environment minus anything secret-looking (DATABASE_URL, cookie secrets, tokens).
  const env = {};
  for (const [k, v] of Object.entries(process.env)) if (!/DATABASE|SECRET|TOKEN|PASSWORD|CREDENTIAL|COOKIE/i.test(k)) env[k] = v;
  return { ...env, ...extra };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const probe = (host, port) =>
  new Promise((resolve) => {
    const s = connect({ host, port, timeout: 2000 });
    s.once('connect', () => (s.destroy(), resolve(true)));
    s.once('error', () => resolve(false));
    s.once('timeout', () => (s.destroy(), resolve(false)));
  });

async function waitFor(fn, ms, every = 1000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await sleep(every);
  }
  return null;
}

// ---------- 2-10. run ----------

if (!process.env.DATABASE_URL) die('DATABASE_URL is required (the throwaway server and ticket are created directly)');
let db, provisionServer, issueTicket, hashPassword;
try {
  ({ createPrismaClient: db } = await import('@revival/database'));
  ({ provisionServer } = await import(join(REPO, 'api', 'dist', 'servers', 'provision.js')));
  ({ issueTicket } = await import(join(REPO, 'api', 'dist', 'tickets', 'tickets.js')));
  ({ hashPassword } = await import(join(REPO, 'api', 'dist', 'auth', 'password.js')));
} catch (err) {
  die(`could not load api/dist (run npm run build first): ${err.message}`);
}
const prisma = db(process.env.DATABASE_URL);
const report = { rfdStarted: false, webPortUp: false, heartbeat: false, ticketIssued: false, launcherExit: null, redeemed: false, replayRejected: false, bindRecorded: false };
let server, credential, tmp, secretDir, beatTimer;

async function internal(path, body) {
  const res = await fetch(new URL(path, api), {
    method: 'POST',
    headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

let cleaned = false;
async function cleanup() {
  if (cleaned) return;
  cleaned = true;
  clearInterval(beatTimer);
  stopAll();
  await sleep(1500);
  for (const { child, exited } of children) {
    if (!exited && child.pid !== undefined) {
      try {
        if (isWindows) child.kill('SIGKILL');
        else process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* gone */
      }
    }
  }
  if (server) {
    await internal(`/api/internal/servers/${server.id}/offline`).catch(() => {});
    await prisma.gameServer.delete({ where: { id: server.id } }).catch(() => {});
  }
  await prisma.$disconnect();
  if (tmp && !opt['keep-temp']) rmSync(tmp, { recursive: true, force: true });
  if (secretDir) rmSync(secretDir, { recursive: true, force: true });
  if (isWindows) log('Windows: close any RFD player window the launcher opened.');
}
process.on('SIGINT', () => cleanup().then(() => process.exit(130)));

let ok = false;
try {
  // Throwaway user + private game, so ticket issuance can only select our server.
  const user = await prisma.user.upsert({
    where: { usernameNormalized: 'rfd_smoke' },
    update: {},
    create: { username: 'rfd_smoke', usernameNormalized: 'rfd_smoke', passwordHash: await hashPassword(randomBytes(24).toString('base64url')) },
  });
  const game =
    (await prisma.game.findFirst({ where: { creatorId: user.id, name: 'RFD smoke test', deletedAt: null } })) ??
    (await prisma.game.create({ data: { name: 'RFD smoke test', creatorId: user.id, isPublic: false, maxPlayers: 4 } }));
  ({ server, credential } = await provisionServer(prisma, { gameId: game.id, host: opt['rfd-host'], port: webPort, maxPlayers: 4 }));
  log(`provisioned throwaway GameServer ${server.id} (credential not printed)`);

  // Temporary GameConfig directory: config + adapter + place.
  tmp = mkdtempSync(join(tmpdir(), 'rfd-smoke-'));
  copyFileSync(adapterSrc, join(tmp, 'revival_ticket_adapter.py'));
  copyFileSync(placePath, join(tmp, 'place.rbxl'));
  writeFileSync(join(tmp, 'GameConfig.toml'), readFileSync(gameConfigSrc, 'utf8'));
  // Credential in its own private directory, never inside RFD's config/served tree.
  secretDir = mkdtempSync(join(tmpdir(), 'rfd-smoke-secret-'));
  chmodSync(secretDir, 0o700);
  const credFile = join(secretDir, 'gameserver.credential');
  writeFileSync(credFile, credential + '\n', { mode: 0o600 });
  chmodSync(credFile, 0o600);
  const ledger = join(tmp, 'join-ledger.json');

  const rfd = start(
    rfdPath,
    serverArgv(join(tmp, 'GameConfig.toml')),
    childEnv({ REVIVAL_API_URL: api.origin, REVIVAL_GAME_SERVER_CREDENTIAL_FILE: credFile, REVIVAL_JOIN_LEDGER_PATH: ledger }),
    'rfd-server'
  );
  report.rfdStarted = true;
  report.webPortUp = !!(await waitFor(async () => rfd.exited ? 'dead' : probe(opt['rfd-host'], webPort), timeoutMs)) && !rfd.exited;
  if (!report.webPortUp) throw new Error(`RFD web port ${webPort} never opened${rfd.exited ? ` (RFD exited: ${JSON.stringify(rfd.exited)})` : ''}`);
  log('RFD web port is accepting connections');

  const beat = () => internal(`/api/internal/servers/${server.id}/heartbeat`, { playerCount: 0, maxPlayers: 4, status: 'online' });
  const first = await beat();
  report.heartbeat = first.status === 200;
  if (!report.heartbeat) throw new Error(`heartbeat failed: HTTP ${first.status}`);
  beatTimer = setInterval(() => beat().catch(() => {}), 30_000);

  const issued = await issueTicket(prisma, user.id, game.id);
  if (issued.serverId !== server.id) throw new Error('ticket was issued for a different server');
  report.ticketIssued = true;
  log(`ticket issued (expires ${issued.expiresAt.toISOString()}; value not printed)`);

  const launcherConfig = join(tmp, 'launcher.json');
  const loopbackApi = ['127.0.0.1', 'localhost', '[::1]'].includes(api.hostname);
  writeFileSync(
    launcherConfig,
    JSON.stringify({ apiBaseUrl: api.origin, rfdExecutable: rfdPath, rfdArgsPrefix: ['player'], developmentAllowHttpLocalhost: api.protocol === 'http:' && loopbackApi }, null, 2)
  );
  const launcher = start(launcherPath, [issued.launchUrl], childEnv({ OURREVIVAL_LAUNCHER_CONFIG: launcherConfig }), 'launcher');
  await waitFor(async () => launcher.exited, 30_000, 250);
  report.launcherExit = launcher.exited?.code ?? 'still running';
  log(`launcher exited with ${report.launcherExit}`);

  const redeemed = await waitFor(async () => (await prisma.joinTicket.findUnique({ where: { id: issued.ticketId } }))?.redeemedAt, timeoutMs);
  report.redeemed = !!redeemed;
  if (redeemed) log(`redemption observed at ${redeemed.toISOString()}`);

  const replay = await internal('/api/internal/join-tickets/redeem', { ticket: issued.ticket });
  report.replayRejected = replay.status === 403;
  report.bindRecorded = existsSync(ledger) && JSON.parse(readFileSync(ledger, 'utf8')).joins?.some((j) => j.uid === user.numericId);

  if (report.redeemed && holdMs) {
    log(`holding ${holdMs / 1000}s so the player can finish connecting...`);
    await sleep(holdMs);
  }
  ok = report.rfdStarted && report.webPortUp && report.heartbeat && report.ticketIssued && report.launcherExit === 0 && report.redeemed && report.replayRejected;
} catch (err) {
  log(`FAILED: ${err.message}`);
} finally {
  for (const { name, tail } of children) if (tail.length) log(`last output from ${name}:\n    ${tail.join('\n    ')}`);
  await cleanup();
}

log('report:');
for (const [k, v] of Object.entries(report)) log(`  ${k.padEnd(15)} ${v}`);
log(ok ? 'RESULT: PASS (ticket redeemed once by the RFD server; replay rejected)' : 'RESULT: FAIL');
log('Live status is "FULL LIVE RFD VERIFIED" only if --rfd-path was a real RFD v347 build and the player actually entered the game.');
process.exit(ok ? 0 : 1);
