#!/usr/bin/env node
/**
 * DEVELOPMENT ONLY: fake game server for exercising the registry.
 *
 * It ONLY sends heartbeat / drain / offline requests to the internal API
 * with a provisioned server credential. It does not run Lua, spawn
 * processes, emulate RCC, accept connections, or expose any shell or
 * command channel. It has no dependencies beyond Node's fetch.
 *
 * Usage (credential via environment, never on the command line):
 *   GAME_SERVER_CREDENTIAL=rvgs_... node dev-tools/game-server-simulator/simulate.mjs \
 *     --id <serverId> --players 5 --max 20 [--api http://127.0.0.1:4000] [--once] [--interval 30]
 *
 *   --once       send one heartbeat and exit (useful to change the player count)
 *   --offline    send a graceful "offline" and exit
 *   (default)    heartbeat every --interval seconds until Ctrl+C, then send "offline"
 */
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    id: { type: 'string' },
    players: { type: 'string', default: '0' },
    max: { type: 'string', default: '20' },
    api: { type: 'string', default: 'http://127.0.0.1:4000' },
    interval: { type: 'string', default: '30' },
    once: { type: 'boolean', default: false },
    offline: { type: 'boolean', default: false },
  },
  strict: true,
});

const credential = process.env.GAME_SERVER_CREDENTIAL;
if (!values.id || !credential) {
  console.error('Set GAME_SERVER_CREDENTIAL and pass --id <serverId>.');
  process.exit(1);
}
const api = new URL(values.api);
if (!['http:', 'https:'].includes(api.protocol)) {
  console.error('--api must be an http(s) URL');
  process.exit(1);
}

async function call(action, body) {
  const res = await fetch(new URL(`/api/internal/servers/${encodeURIComponent(values.id)}/${action}`, api), {
    method: 'POST',
    headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${action} failed: HTTP ${res.status} ${data?.error?.code ?? ''} ${data?.error?.message ?? ''}`);
  return data.server;
}

const beat = () =>
  call('heartbeat', { playerCount: Number(values.players), maxPlayers: Number(values.max), status: 'online' }).then((s) =>
    console.log(`[${new Date().toISOString()}] heartbeat ok: ${s.status} ${s.playerCount}/${s.maxPlayers}`)
  );

try {
  if (values.offline) {
    const s = await call('offline');
    console.log(`server ${s.id} is now ${s.status}`);
  } else if (values.once) {
    await beat();
  } else {
    await beat();
    const timer = setInterval(() => beat().catch((e) => console.error(e.message)), Number(values.interval) * 1000);
    process.on('SIGINT', async () => {
      clearInterval(timer);
      await call('offline').catch(() => {});
      console.log('sent offline; exiting');
      process.exit(0);
    });
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
