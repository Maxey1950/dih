# Phase 3: database-backed games and the game-server registry

Phase 3 delivers **real games + a trusted server registry + heartbeats + player aggregation**.

It does **not** include join tickets, `ourrevival://`, the launcher, RFD process launching or ticket validation, RCC,
rendering, asset or place uploads, Lua execution, or remote commands.

## Game schema (`games`)

| Column | Notes |
|---|---|
| `id` | UUID |
| `place_id` | `SERIAL UNIQUE`, allocated by the database and never set by clients. This is the numeric id the runtime will use later. |
| `name` | 1–50 characters (CHECK: not blank) |
| `description` | ≤ 1000 characters |
| `creator_id` | FK → `users`, `ON DELETE RESTRICT`. Always taken from the session. |
| `genre` | optional; one of the 2016 genres (API-validated) |
| `max_players` | CHECK 1–100 |
| `thumbnail_url` | set by seed/admin only. `null` means the site default image; users cannot set arbitrary URLs. |
| `is_public` | private games are visible to the creator and admins only |
| `is_featured` | admin-only flag used by the Featured sort |
| `visits`, `up_votes`, `down_votes` | counters (CHECK ≥ 0). Not writable through the API. |
| `created_at`, `updated_at` | |
| `deleted_at` | soft delete: the game is unpublished and hidden from everyone but admins |

No runtime state is stored on a game. Player counts come from `game_servers`.

## GameServer schema (`game_servers`)

| Column | Notes |
|---|---|
| `id` | UUID, the server identity |
| `game_id` | FK → `games`, `ON DELETE CASCADE` |
| `credential_hash` | `CHAR(64) UNIQUE`, SHA-256 hex of the machine credential (CHECK: 64 hex characters). The raw credential is never stored. |
| `host`, `port` | **internal** routing data (CHECK: port 1–65535). Never returned by any public or admin API. |
| `status` | `starting` \| `online` \| `draining` \| `offline` |
| `player_count`, `max_players` | CHECK `0 ≤ player_count ≤ max_players`, `max_players` 1–200 |
| `started_at`, `last_heartbeat_at`, `created_at`, `updated_at` | |

Indexes on `(game_id, status, last_heartbeat_at)` and `(status, last_heartbeat_at)` serve the aggregation queries.

The migration is `20261001000000_games_and_server_registry`, generated with `prisma migrate diff` plus hand-added
CHECKs. Earlier migrations are unchanged.

## Public API

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/games?sort=featured\|updated\|players&page=&limit=` | optional | Public, non-deleted games only; limit ≤ 48. Sort orders: `featured` = featured, then visits, then recently updated; `updated` = recently updated; `players` = live players (in SQL, so pagination is correct). |
| GET | `/api/games/:id` | optional | Private games return 404 unless you are the creator or an admin; deleted games return 404 except for admins. Includes a viewer-specific `canEdit`. |
| GET | `/api/games/:id/servers` | optional | Live servers only: `{ id, playerCount, maxPlayers, status }`. No host, port or credential. |
| GET | `/api/users/:id/games` | optional | The owner also sees their private games. |
| POST | `/api/games` | user, CSRF, 20/hour/IP | Strict body `{ name, description?, maxPlayers?, isPublic?, genre? }`. The creator comes from the session. |
| PATCH | `/api/games/:id` | owner or admin, CSRF | Strict body `{ name?, description?, maxPlayers?, isPublic?, genre?, isFeatured? }`. `isFeatured` is admin-only. `creatorId`, `placeId`, counters, thumbnail and `deletedAt` are rejected (400). |
| DELETE | `/api/games/:id` | owner or admin, CSRF | Soft delete |
| GET | `/api/admin/servers` | admin | Read-only: id, game, status, isStale, players, startedAt, lastHeartbeatAt. No address, credential or hash, and **no actions**. |

### Permissions

- **Normal users** can create games, edit or delete their own, and view public games (plus their own private games).
- **Admins** can edit, feature, or delete any game, and can view private and deleted games.
- Ownership is checked on the server from the session. A non-owner gets 403 on a public game and 404 on a private one.
- There is no team-create or collaboration yet.

## Internal game-server API

Machine-to-machine only. The web app's `/api` proxy **excludes** `/api/internal/*` (verified: a browser gets
Next's 404), so game servers must call the API directly on the internal network.

| Method | Path | Body | Effect |
|---|---|---|---|
| POST | `/api/internal/servers/:id/heartbeat` | strict `{ playerCount, maxPlayers, status?: 'starting'\|'online' }` | Updates the counts and `last_heartbeat_at`. Sets `started_at` when coming back from offline. A draining server stays draining. |
| POST | `/api/internal/servers/:id/drain` | — | status → `draining` (players still counted; no new players in Phase 4) |
| POST | `/api/internal/servers/:id/offline` | — | status → `offline`, players → 0 (graceful shutdown) |

Heartbeat validation: integers only, `0 ≤ playerCount ≤ 200`, `1 ≤ maxPlayers ≤ 200`,
`playerCount ≤ maxPlayers`. Unknown fields (for example `host` or `command`) return 400. Every endpoint returns
`{ server: { id, status, playerCount, maxPlayers, heartbeatIntervalSeconds } }`.

There is **no HTTP registration endpoint**. Identities are provisioned by a CLI (below), which is option B of the
brief and replaces the suggested `POST /api/internal/servers/register`.

## Credential design

- **Format:** `rvgs_` + 32 random bytes (base64url), which is 256 bits. The prefix makes leaks easy for secret
  scanners to find.
- **Storage:** only `SHA-256(credential)` is stored, in `credential_hash`. A fast hash is correct here because the
  credential is full-entropy random, not a human password. The DB CHECK constraint rejects anything but a hex
  digest.
- **Transport:** `Authorization: Bearer rvgs_…`, parsed strictly. Malformed values, other schemes, or
  wrong/unknown/other-server credentials all get the same `401 UNAUTHENTICATED`.
- **Binding:** the credential is bound to the `:id` in the URL and compared with `crypto.timingSafeEqual`, so a
  server can't act for another server.
- **Isolation from user auth**, in both directions:
  - The session resolver and the CSRF hook skip `/api/internal/*`, so user and admin cookies are never consulted
    there (tested: an admin with a valid CSRF token gets 401).
  - User routes read only the session cookie, so a server credential authenticates nothing there (tested for
    `/api/auth/me`, `/api/admin/servers` and `/api/users/me/settings`, including when passed as a cookie).
- **Logging:** the logger already redacts the `Authorization` header, and a grep of the API log after the browser run
  found no credentials.
- **Exposure:** the credential is printed exactly once by the provisioning CLI and is never returned by any endpoint.
  It's revoked with `server:revoke`, which deletes the identity; re-provision to rotate.

### Development provisioning

```bash
export DATABASE_URL=...
npm run seed:dev                                          # optional sample games (refuses NODE_ENV=production)
npm run server -- --game <gameId|placeId> --host 127.0.0.1 --port 2005 [--max 20]
#   prints GAME_SERVER_ID and GAME_SERVER_CREDENTIAL (once)
npm run servers:list                                      # no credentials or hashes printed
npm run server:revoke -w @revival/api -- --id <serverId>
```

### Production secret injection (future RFD servers)

1. An operator (later, an orchestration job) runs `server:provision` once per RFD instance.
2. The printed credential goes straight into the host's secret store (systemd `LoadCredential=`, Docker/Kubernetes
   secrets, or a vault), exposed to the RFD wrapper as `GAME_SERVER_ID` / `GAME_SERVER_CREDENTIAL` environment
   variables. It never goes on a command line (visible in `ps`), in a repo, in a place file, or in logs.
3. The wrapper, not Lua running inside the game, sends heartbeats to the API over the internal network (TLS in
   production).
4. Rotation: provision a new identity, deploy it, then revoke the old one.

## Heartbeat and staleness policy (`api/src/servers/policy.ts`)

- **Heartbeat interval:** 30 s, also returned to servers as `heartbeatIntervalSeconds`.
- **Stale after:** 90 s without a heartbeat (three missed beats). A stale server is ignored by player counts,
  server lists and (in Phase 4) matchmaking, **whatever its stored status**. Reads apply the cutoff themselves, so
  correctness doesn't depend on a job running.
- **Counted statuses:** `online` and `draining`. **Joinable (Phase 4):** `online` only. `starting` and `offline`
  are never counted.
- **Housekeeping:** `npm run servers:reap` marks stale servers `offline` and zeroes their count (suggested cron:
  every minute). This is cosmetic, for the admin view and CLI.
- **Graceful shutdown:** optional (`/offline`). A crashed server simply goes stale.

## Player-count aggregation (`api/src/games/aggregate.ts`)

- **Any list:** one `groupBy` query over `game_servers` computes `SUM(player_count)` for the page's game ids, over
  counted statuses with `last_heartbeat_at ≥ now − 90 s`. That's one query per page, with no N+1.
- **`sort=players`:** one SQL query with a `LEFT JOIN` on the same aggregate, ordered and paginated in the
  database; then one query loads those games and one computes their counts.
- **Example:** Server 1 with 10 players and Server 2 with 6 shows as 16 playing. A stale or offline third server
  adds nothing (tested).
- **Live updates:** the web pages re-fetch every 30 s, so counts stay current without WebSockets.

## Frontend

- `/games`: real data. The Popular / Recently Updated / Featured tabs map to `players` / `updated` / `featured`.
  Added loading, empty and error states, a pager, and a 30 s refresh.
- `/games/[id]`: real data (creator, created/updated dates, live player count, max players), a live Servers card
  (no addresses), and an "Edit Game" button for the owner or admins.
- `/games/[id]/edit`: edit form and soft delete. It shows an error for non-owners; the API enforces this
  regardless.
- `/create`: create form (name, description, max players, public/private) plus a "My Places" list.
- Profile "Places" comes from `/api/users/:id/games`.
- Admin: a read-only "Game Servers" card.
- The home page had no game cards, so nothing changed there.
- `web/src/lib/games.js`: the static adapter is removed. `playGame(gameId)` stays the single integration point. It
  checks for a live server and returns "Launcher integration is coming in the next phase." It issues no ticket and
  launches nothing (verified in the browser: no navigation, no popup, no non-http request).

## Place files (later)

Every game already has a stable numeric `place_id`. A later phase adds an upload pipeline that:

1. stores the `.rbxl` in object storage keyed by `place_id` and a version
2. records a `place_versions` row with hash, size and uploader
3. has RFD servers fetch the place for their `place_id` through an authenticated internal endpoint

Nothing is uploaded or fetched in Phase 3.

## Development server simulator (`dev-tools/game-server-simulator/`)

**Development only.** It sends heartbeat, drain and offline HTTP requests with a provisioned credential (read from
`GAME_SERVER_CREDENTIAL`, never from argv). It does not execute commands, run Lua, spawn processes, emulate RCC, or
listen on any port.

```bash
GAME_SERVER_CREDENTIAL=rvgs_... npm run dev:simulate-server -- --id <serverId> --players 5 --max 20 --once
```

## Future integration (NOT YET IMPLEMENTED)

```
GameServer (RFD v347 wrapper)
  → POST /api/internal/servers/:id/heartbeat every 30 s     ← implemented in Phase 3 (simulator only)
  → API registry

Player
  → Play → POST /api/games/:id/join                          ← Phase 4 (not implemented)
  → one-time join ticket (picks an ONLINE, non-stale server with free slots)
  → ourrevival://join?ticket=…  → launcher resolves ticket via a trusted endpoint (gets host/port)
  → launches RFD player  → RFD server redeems ticket with its server credential before admitting the player
```

## Security verification (2026-10-01)

| Check | Result |
|---|---|
| Normal users cannot edit others' games | 403 (test + browser) |
| Normal users cannot use internal endpoints | 401 (test) |
| Admin cookies cannot substitute for server credentials | 401 even with a valid CSRF token (test) |
| Server credentials cannot authenticate as users/admins | `/api/auth/me` unauthenticated, admin/settings 401 (test) |
| Credential hashes never in API responses | Test sweep, plus 71 API responses captured in the browser run |
| Raw credentials never persisted | Test dumps `game_servers`; DB CHECK allows only a 64-hex digest; dev DB checked |
| Malformed authorization rejected | 7 malformed variants → 401 (test) |
| `creatorId` cannot be set on create | 400 (strict schema, test) |
| Protected fields cannot be updated | `creatorId`, `placeId`, `visits`, `upVotes`, `deletedAt`, `thumbnailUrl` → 400; `isFeatured` by a non-admin → 403 (test) |
| Impossible player counts rejected | negative, > max, zero max, non-integer, strings, extra fields → 400 (test) |
| Stale/offline servers don't count | test + real 95 s browser wait |
| Public server list has no host/port | test (asserts exact keys) + browser scan |
| Dynamic dispatch / command execution / shell / eval / RCC | None: repo search found no `child_process`, `exec(`/`spawn(`, `eval`, `new Function`, `vm`, or method-by-name dispatch in `api/`, `web/`, `shared/`, `database/` or `dev-tools/` (the only match is `RegExp.exec`), and no RCC, Lua or command endpoints |
