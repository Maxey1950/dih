# dev-tools/ — DEVELOPMENT ONLY

Nothing in this directory is deployed or imported by `web/` or `api/`.

- `game-server-simulator/simulate.mjs`: sends heartbeats for a provisioned
  game server so the registry, player counts and staleness can be exercised
  before RFD exists. It only makes HTTP requests to
  `/api/internal/servers/:id/{heartbeat,drain,offline}`. It executes nothing
  and exposes nothing. See `docs/phase-3-games.md`.
