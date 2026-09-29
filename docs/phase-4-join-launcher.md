# Phase 4: secure join path, launcher and RFD adapter

End to end: **Play → one-time ticket → `ourrevival://` → launcher → RFD player → server-side redemption.** Tested with
the real API, the real launcher binary, the real RFD adapter and the development game-server simulator. A live RFD
v347 smoke test was **not** run (see "RFD smoke test" below).

## Sequence

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser (web)
    participant A as API
    participant L as Launcher (native)
    participant R as RFD player
    participant S as RFD server + adapter
    B->>A: POST /api/games/:id/join (session cookie + CSRF)
    A->>A: pick ONLINE, non-stale, non-full server; store SHA-256(ticket), TTL 90 s
    A-->>B: { ticket, expiresAt, launchUrl }  (no host/port)
    B->>L: OS opens ourrevival://join?ticket=rvjt_…
    L->>L: strict URL parse (fail closed)
    L->>A: POST /api/launcher/ticket/resolve { ticket }  (no cookies)
    A-->>L: { game, server:{host,port}, player, ticket:{expiresAt} }  (not consumed)
    L->>R: spawn(RFD, ["player","-h",host,"-p",port,"-u",ticket])  (argv array, no shell)
    R->>S: connect with user code = ticket
    S->>A: POST /api/internal/join-tickets/redeem { ticket }  (Bearer rvgs_ server credential)
    A->>A: atomic UPDATE … SET redeemed_at WHERE redeemed_at IS NULL AND server_id = caller
    A-->>S: { allowed:true, user:{id,numericId,username}, game }
    S-->>R: player admitted as that user
    Note over A: replay → already_redeemed; after 90 s → expired
```

## JoinTicket model (`join_tickets`, migration `20261002000000_join_tickets`)

| Column | Notes |
|---|---|
| `id` | UUID; safe to log |
| `token_hash` | `CHAR(64) UNIQUE`, SHA-256 hex of the raw ticket. CHECK: 64 hex characters. The raw ticket is never stored. |
| `user_id`, `game_id`, `server_id` | FKs with `ON DELETE CASCADE`. Bound at issuance; nothing can change them afterwards. |
| `created_at`, `expires_at` | CHECK `expires_at > created_at` |
| `launcher_resolved_at`, `resolve_count` | Resolve bookkeeping. CHECK `resolve_count ≥ 0`. |
| `redeemed_at` | Set exactly once, atomically, by the game server |
| `revoked_at` | Set by a newer ticket or by logout |

The same migration adds `users.numeric_id` (`SERIAL UNIQUE`). RFD needs an integer user id; ours are UUIDs.
Earlier migrations are unchanged.

## Ticket format and lifetime

- **Format:** `rvjt_` + 32 bytes from `crypto.randomBytes`, base64url: 43 characters, 256 bits.
- **TTL: 90 s.** Every read (resolve, redeem, selection) checks expiry directly; cleanup is never required for
  correctness.
- **Bindings:** one user, one game, one server. The browser never selects or sees the server.
- **Limits:**
  - Issuing a ticket revokes the user's other unused tickets, so each user has **at most one** live ticket.
  - `POST /join` allows **5 per user per minute** (`RATE_LIMIT_JOIN_MAX`).
  - The launcher may resolve a ticket at most **3 times**, and resolve is limited to **30 per IP per minute**
    (`RATE_LIMIT_RESOLVE_MAX`).
- **Logging:** the API logs only the ticket's database id, plus user, game and server ids and the reason. A grep
  of the API and web logs after the end-to-end run found no `rvjt_` or `rvgs_` values.

## Server selection (`api/src/tickets/tickets.ts`)

1. **Candidates:** this game's servers with status `online` and a heartbeat newer than 90 s. Draining, starting,
   offline and stale servers are never chosen.
2. **Effective load** = reported `playerCount` + pending tickets for that server (unredeemed, unrevoked,
   unexpired). A burst of Play clicks therefore can't overfill one server.
3. **Drop** servers with load ≥ `maxPlayers`.
4. **Choose** the lowest occupancy ratio, then the fewest players, then the server id (deterministic).
5. **Errors:** no candidates → `503 NO_AVAILABLE_SERVER`; candidates but all full → `409 SERVERS_FULL`.

No processes are started on demand, and there's no geographic matching yet. Two simultaneous joins can still race
for the last seat; the game server remains the final authority on capacity.

## Public join endpoint

`POST /api/games/:id/join` requires a session and CSRF. The game must be viewable by the user: public, or their
own, or they're an admin; never deleted.

- **Response (201):** `{ ticket, expiresAt, launchUrl }` and nothing else. No host, port, server id or credential
  (tested with an exact key check).
- **Errors:** `401` (logged out), `404` (not viewable), `503 NO_AVAILABLE_SERVER`, `409 SERVERS_FULL`,
  `429 RATE_LIMITED`.

## Launcher resolve endpoint

`POST /api/launcher/ticket/resolve` with a strict body `{ "ticket": "rvjt_…" }`.

- **Proof:** the ticket itself. The session resolver and CSRF hook skip `/api/launcher/*`, so cookies are ignored.
  The launcher never receives the website session or password.
- **Validity checks:** the ticket must be unexpired, unredeemed and unrevoked; the user must not be banned; the game
  must still be joinable; and the **originally selected** server must still be online and non-stale. The caller
  cannot pick a server; a body with extra fields gets the same generic 404.
- **Does not redeem.** It increments `resolve_count`, capped at 3 atomically.
- **Response:** `{ game:{id,placeId,name}, server:{host,port}, player:{id,numericId,username}, ticket:{expiresAt} }`.
- **Errors:** every failure is the same `404 TICKET_INVALID`, so the endpoint gives nothing away.

Unlike `/api/internal/*`, this endpoint is proxied publicly: it has to be reachable from players' machines.

## Internal redeem endpoint

`POST /api/internal/join-tickets/redeem`, authenticated **only** with the game server's
`Authorization: Bearer rvgs_…` credential. The server is identified by the unique credential hash; there's no id in
the URL.

- **Checks:** the ticket exists and belongs to **this** server. Another server's ticket gets the same answer as an
  unknown ticket. It must also be unexpired, not redeemed or revoked, the user not banned (**checked at redemption
  time**), and the game joinable.
- **Redeeming server policy:** the redeeming server itself must be `online` and non-stale. A draining, offline or
  stale server can't admit new players, and the ticket is **not** consumed in that case.
- **Consumption:** a single conditional `UPDATE … WHERE redeemed_at IS NULL AND revoked_at IS NULL AND expires_at >
  now AND server_id = caller`. Ten concurrent redemptions → exactly one success (tested).
- **Success (200):** `{ allowed: true, user:{id,numericId,username,displayName}, game:{id,placeId} }`.
- **Failure (403):** `JOIN_REJECTED` with `details.reason` ∈ `invalid`, `expired`, `revoked`, `already_redeemed`,
  `banned`, `game_unavailable`, `server_not_accepting`. Reasons are shown only to authenticated servers.

## Credential separation

| Credential | Accepted by | Never accepted by |
|---|---|---|
| Web session (HttpOnly cookie + CSRF) | player/site APIs | `/api/launcher/*` and `/api/internal/*` (skipped there) |
| Join ticket `rvjt_` | `/api/launcher/ticket/resolve` (body); redeem (body, alongside a server credential) | anything as a cookie or bearer; not a server credential |
| Game-server credential `rvgs_` | `/api/internal/*` (bearer) | player APIs (`/api/auth/me` stays anonymous), launcher resolve |

All cross-uses are tested: a web cookie (even an admin's, with CSRF) can't redeem; a ticket as a cookie or bearer
authenticates nothing; a server credential can't act as a user or resolve tickets; one server can't redeem another
server's ticket.

## Custom protocol

- **Exact form:** `ourrevival://join?ticket=rvjt_<43 base64url chars>`, and nothing else. No username, user id,
  game id, host, port, cookie, password or server credential.
- **Exposure:** launch URLs can show up in local browser history, OS protocol-handler logs, or crash reports. That's
  why the ticket expires in 90 s, is single-use, is bound to one user, game and server, and why a new ticket revokes
  the old one.
- **Browser behavior:** `playGame()` accepts only a response matching that exact pattern before calling
  `window.location.href = launchUrl`. Browsers can't reliably report a missing handler, so the "Starting Game…" modal
  explains how to install the launcher and press Play again.
- **Messages:** there are specific messages for logged out, no server, all full, rate limited, and game not
  available.

## Launcher (`launcher/`, Rust)

Rust was chosen because it's installed here, builds a small single static binary, has no runtime to ship, is easy
to audit, and cross-compiles to Windows. Electron wasn't needed.

| Module | Responsibility |
|---|---|
| `protocol.rs` | Strict parser: case-insensitive scheme; exact `join?ticket=`; exactly one parameter; ticket charset `[A-Za-z0-9_-]`; ≤ 128 bytes; ASCII only; no `&`, `?`, `#`, `=`, `/`, `%`, quotes or spaces |
| `config.rs` | `launcher.json` (no secrets): `apiBaseUrl` (https, or http on loopback only), absolute existing `rfdExecutable` (`.exe` required on Windows, so a `.bat`/`.cmd` can never route through cmd.exe), `rfdArgsPrefix` (default `["player"]`), optional `allowedServerHosts`. Unknown fields are rejected. |
| `api.rs` | Resolve call: 10 s timeout, no redirects, 64 KiB response cap. Response parsed with `deny_unknown_fields`; host must be a hostname, IPv4 or IPv6, never starting with `-`; port 1–65535; optional host allow-list. Anything else fails closed. |
| `launch.rs` | `std::process::Command::new(program).args(argv)`: argv `[prefix…, "-h", host, "-p", port, "-u", ticket]`, stdin null. **No shell, no cmd.exe, no string concatenation.** The program path comes only from config. |
| `register.rs` | Windows: `HKCU\Software\Classes\ourrevival` → `"<launcher.exe>" "%1"` (per-user, no admin). Linux: a `.desktop` handler plus an `xdg-mime` instruction. |
| `lib.rs` | `handle_launch()`: exactly one argv entry → parse → resolve → spawn. Resolver and runner are injected, so tests never touch the network or RFD. |

The launcher contains no passwords, cookies, database credentials, server credentials or admin credentials. It
never logs the ticket.

**Build** (both produced in this session):

```bash
cargo test                                               # 23 tests
cargo build --release                                    # Linux: target/release/ourrevival-launcher
cargo build --release --target x86_64-pc-windows-gnu     # Windows: ourrevival-launcher.exe (MinGW)
```

**Install (Windows):**

1. Put `ourrevival-launcher.exe` somewhere stable.
2. Write `%APPDATA%\OurRevival\launcher.json` (see `launcher/launcher.example.json`).
3. Run `ourrevival-launcher.exe --register`.

## RFD adapter (`rfd/adapter/revival_ticket_adapter.py` + `rfd/GameConfig.revival.toml`)

The adapter is standard-library Python, loaded by RFD's python-call-mode hooks inside the RFD server process. It was
verified against RFD source commit `510b6e25`, which I read but did not run.

- **Hooks overridden:** `check_user_allowed` (RFD's default is `lambda *a: True`), `retrieve_user_id`,
  `retrieve_username`, `check_user_has_admin` (always false), and `retrieve_default_user_code` (returns an invalid
  code, so a player with no ticket can't join). `allow_unsafe_users = false`.
- **Redeem once, then cache:** RFD calls `check_user_allowed` several times per join (join-data, then
  `/rfd/verify-player` with a 7 s cache). The adapter redeems on the **first** call with the server credential and
  keeps the decision locally for **120 s**. After that the same code is refused, which bounds replay of an old
  ticket against this server even though RFD's sqlite remembers `user_code → player`.
- **Rejoin fix-up (RFD integration bug found and fixed):** RFD's `players` table has `UNIQUE(id_number)` and
  `UNIQUE(username)` `ON CONFLICT IGNORE`, and RFD loops calling `retrieve_user_id` until an insert sticks. With a new
  ticket per join, a **returning player would hang RFD forever**; this was reproduced in a test with the fix
  disabled. Before returning the stable `numericId`, the adapter deletes the stale rows for that id/username. It
  checks the table's exact columns first and fails closed if the schema differs.
- **Identity:** always comes from the redemption response. The launcher and player cannot choose a username or id.
- **Credentials:** the server credential comes from `REVIVAL_GAME_SERVER_CREDENTIAL_FILE` (preferred) or
  `REVIVAL_GAME_SERVER_CREDENTIAL` in the server's environment. It's never in the repo, the launcher, the ticket or
  the URL.
- **Failure behavior:** fails closed on network errors, bad responses, or a malformed credential. It never logs
  tickets or credentials.
- **Tests (10):** the GameConfig snippets are executed through a copy of RFD's own exec wrapper, against RFD's exact
  players schema and a fake redeem API.

### RFD smoke test: not run (blocker)

No RFD v347 build is present, and running RFD needs its Roblox client/RCC binaries (RFD downloads them from the
internet) plus Windows or Wine. Per instructions, nothing was downloaded. To run it on a private network:

1. Install RFD (a known release) on a Windows host. Copy `rfd/GameConfig.revival.toml` and
   `rfd/adapter/revival_ticket_adapter.py` into one directory and add a `place.rbxl`.
2. Provision the server with `npm run server -- --game <placeId> --host <private-ip> --port 2005`, and store the
   credential in a file readable only by the RFD service account.
3. Start `RFD server -p 2005 --config GameConfig.revival.toml` with `REVIVAL_API_URL`,
   `REVIVAL_GAME_SERVER_CREDENTIAL_FILE` and `REVIVAL_RFD_SQLITE_PATH` set. Bind it to the private interface only.
4. Run a heartbeat wrapper: the simulator, or a small service posting `/heartbeat` every 30 s with RFD's player
   count. A production wrapper is a TODO.
5. Log in on the website, press Play. The launcher resolves the ticket and starts
   `RFD.exe player -h <ip> -p 2005 -u <ticket>`; RFD calls the adapter, which redeems.
6. Expect the player to appear with the website username and numeric id, and a replayed ticket to be refused.

## Cleanup, logout and bans

- `npm run tickets` deletes tickets that expired more than 1 hour ago, and redeemed or revoked tickets older than 24
  hours. Suggested cron: every 10 minutes. It's not needed for security.
- **Logout revokes** the user's unused tickets (tested).
- **Bans:** a user banned **after** issuance is rejected at resolve and at redemption, and the ticket isn't consumed
  (tested). Banned users can't get tickets anyway: their sessions don't authenticate.

## Future production deployment

- API behind HTTPS. `/api/launcher/*` public; `/api/internal/*` only on the private network (never proxied).
- **RFD hosts:** private network only; per-server credentials from a secret store; a heartbeat wrapper service.
  Set `allowedServerHosts` in the distributed launcher config.
- **Launcher:** sign the Windows binary; add an installer that writes the config and registers the protocol; add a
  signed update channel.
- **Rate limiting:** move to a shared store (Redis) when there's more than one API instance.
- **Later:** place-file delivery by `placeId`, avatar and membership hooks (`retrieve_avatar`, …), and on-demand
  server allocation.
