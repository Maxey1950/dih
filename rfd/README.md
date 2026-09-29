# rfd/ — game runtime (documentation only in Phase 1)

## Intended runtime

**Roblox Freedom Distribution (RFD), 2018 client/server — version v347.**

This directory will hold our integration with RFD: server configuration, the
join-ticket validation hook, deployment scripts, and notes on the asset and
character endpoints RFD expects. It will **not** contain RFD itself or any
Roblox binaries.

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

## Requirements for the Phase 2 integration (design notes, not implemented)

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
