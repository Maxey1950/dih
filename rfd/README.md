# rfd/ — game runtime integration

## Intended runtime

**Roblox Freedom Distribution (RFD), 2018 client/server — version v347.**

This directory holds our integration with RFD. It does **not** contain RFD
itself or any Roblox binaries.

- `GameConfig.revival.toml`: RFD server config template. v347, unsafe users
  off, and identity hooks wired to the adapter.
- `adapter/revival_ticket_adapter.py`: stdlib-only Python loaded by RFD's
  hooks. It redeems the player's one-time join ticket (`-u` user code) with
  `POST /api/internal/join-tickets/redeem` using this server's credential,
  maps the backend identity (numeric id + username) into RFD, and fixes RFD's
  rejoin behavior. Tests: `cd rfd/adapter && python3 -m unittest discover -s tests`.

Details, including the RFD smoke-test procedure (not yet run; no RFD build is
available here), are in [`docs/phase-4-join-launcher.md`](../docs/phase-4-join-launcher.md).

## Phase 1 rules

- Nothing here downloads, installs or executes RFD. Obtaining and running RFD
  is a deliberate, manual, documented step for a later phase.
- **AlphaBlox's `2015/` RCC binaries are not used.** That includes `RccService.exe`,
  `patchedrcc.exe`, `newrccpatched.exe`, `rblx16.exe`, `0.270.0.30605.exe` and
  their DLLs. They were never copied into this repository and must never be
  run. See [`docs/legacy-donor.md`](../docs/legacy-donor.md).
- No AlphaBlox RCC/SOAP code (`soap`, `xml2js`, `xmldom`, `render.lua`,
  `gameserver.txt`, `assetthumbnailrenderer.lua`) is carried over.

## How RFD fits the architecture

```
web (AlphaBlox UI) → api (Fastify) → PostgreSQL
                         │
                         ├── issues one-time join tickets   (Phase 2)
                         └── redeems tickets for RFD        (Phase 2)
launcher (ourrevival://)  → resolves ticket → starts RFD v347 player
RFD v347 game server      → validates/redeems ticket with api before admitting the player
```

## Integration requirements (implemented in Phases 3–4 unless noted)

1. **Ticket validation before admission.** When a player connects with
   `-u <ticket>`, the RFD server calls the API server-to-server
   (`POST /api/gameserver/ticket/redeem`, authenticated with a per-server
   credential such as mTLS or an HMAC key). The API burns the ticket
   atomically and returns the player's identity. RFD must reject the player if
   the call fails, times out, or the ticket is expired, already used, or issued
   for a different server.
2. **Identity comes from the API**, never from a client-supplied username or
   user id.
3. **Server registry (implemented in Phase 3).** Each RFD instance gets an
   identity and credential from `npm run server -- --game … --host … --port …`
   and its wrapper heartbeats `POST /api/internal/servers/:id/heartbeat` every
   30 s. See `docs/phase-3-games.md` for the credential design and the
   production secret-injection plan.
4. **Least privilege.** Run RFD under a dedicated unprivileged account with
   network egress limited to the API and asset hosts. Keep its credentials out
   of this repository.
5. **No dynamic RPC.** The API exposes a fixed set of typed endpoints to RFD;
   there is no "call any method by name" bridge (the BubbaBlox/ECS pattern this
   project avoids).

## Open questions for Phase 2

- Where RFD's hook for custom join validation lives, and how to wire the
  redeem call into it.
- Which asset, character-appearance and place-file endpoints v347 requests, and
  which of them the API must serve.
- Whether studio/place publishing goes through RFD tooling or our own upload
  pipeline.
