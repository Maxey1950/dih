# dev-tools/ — DEVELOPMENT ONLY

Nothing in this directory is deployed or imported by `web/` or `api/`.

- `game-server-simulator/simulate.mjs`: sends heartbeats for a provisioned
  game server so the registry, player counts and staleness can be exercised
  before RFD exists. It only makes HTTP requests to
  `/api/internal/servers/:id/{heartbeat,drain,offline}`. It executes nothing
  and exposes nothing. See `docs/phase-3-games.md`.
- `rfd-smoke/rfd-smoke.mjs` (`npm run rfd:smoke`): end-to-end smoke test
  against a REAL, user-supplied RFD v347 build (`--rfd-path`, `--place`).
  Starts only that executable and the locally built launcher, with
  `shell: false` and `--skip_download`; refuses anything under `2015/` and the
  legacy RCC binaries; never downloads anything. `--dry-run` only validates.
- `rfd-smoke/fake-rfd/fake_rfd.py`: a TEST DOUBLE for RFD used to exercise the
  harness and the e2e test. A pass with it is not a live RFD verification.
- `e2e/join-boundary.mjs` (`npm run e2e:join`): join-boundary checks against the
  real API, adapter and launcher with the fake RFD.

See `docs/phase-4.5-rfd-hardening.md`.
