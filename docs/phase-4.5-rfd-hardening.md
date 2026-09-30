# Phase 4.5: hardening and verifying the join boundary

> **Live-test status: SIMULATOR + RFD HOOK COMPATIBILITY TESTED.**
> Not "FULL LIVE RFD VERIFIED". No real RFD v347 build has been run. Everything below was tested against:
> - the real API, database and launcher binary;
> - the real adapter, running inside a fake RFD test double (`dev-tools/rfd-smoke/fake-rfd/fake_rfd.py`);
> - unit tests that model RFD commit `510b6e25`'s hook behavior.
>
> Run `npm run rfd:smoke` against a real v347 build before changing this status.

This phase added no product features: no catalog, avatar, currency, uploads or rendering.

## 1. RFD hook behavior (RFD commit `510b6e25`, read, not run)

A join goes through three RFD code paths:

1. **Join data** (`/game/join.ashx`, `/game/PlaceLauncher.ashx`) calls `add_player_to_players_database(user_code)`.
   - If RFD's sqlite `players` table already maps `user_code → player`, it returns that player **without calling
     any hook**.
   - Otherwise it calls `check_user_allowed.cached_call(7, user_code)`, then `retrieve_user_id`, then
     `retrieve_username`, and inserts a row. It repeats until the insert sticks (see §4).
2. **Connection verification.** RCC's `Players.PlayerAdded` handler calls `/rfd/is-player-allowed?userId=<id>`.
   RFD looks the user code up by id and calls `check_user_allowed.cached_call(7, user_code)`. A `false` kicks the
   player. This is the **only per-connection gate** RFD has.
3. **RFD's own cache.** `cached_call(7, …)` caches the result for 7 s per user code, shared by both paths. Hook calls
   carry no connection identity.

RFD's player command line is `RFD player -h <web host> -p <web port> -u <user code>`. Our user code is the one-time
join ticket.

## 2. Authorization-cache investigation (deliverable A)

These answers describe the **Phase 4 adapter**. It cached `allowed=True` for 120 s.

| Question | Phase 4 answer |
|---|---|
| **A.** What is the cache key? | `sha256(user_code)`, where the user code is the raw ticket. It was per RFD server process. |
| **B.** Does it cache only for one in-progress join? | **No.** Any call with the same code within 120 s got `True`, whatever connection it came from. |
| **C.** Can a second connection with the same ticket get `allowed=true` from the cache without hitting the API? | **Yes**, within 120 s, with no API call. Two things made it worse: RFD's join-data path skips the hook entirely once the code is in its `players` table, and RFD adds its own 7 s cache. |
| **D.** Can a redeemed ticket be reused within 120 s? | **Yes**, on the same server, as the same user. The API refuses it on any other server or after a restart, because redemption is single-use in the database. |
| **E.** Does the players database affect this? | **Yes.** `players` maps `user_code → player` for the life of the server (`clear_on_start` only clears it at startup). A replayed join-data request never reaches the adapter. The connection gate (`is-player-allowed`) looks the code up by id and does reach the adapter. |
| **F.** What invalidates the cached authorization? | Only the 120 s timeout or an adapter restart. Nothing tied it to a connection. |

**Conclusion.** Phase 4 violated the required property: a redeemed ticket must not authorize a second independent
connection. Shortening the timeout would not fix that, so the cache was replaced.

## 3. Redesign: an explicit join-state machine (deliverable B)

State is kept per ticket (keyed by SHA-256 of the user code) inside the RFD server process:

```text
(none) --check: API redeems OK--> REDEEMED  (deadline = now + 60 s)
REDEEMED --check-->               True      (repeated join-data hook, same join)
REDEEMED --retrieve_user_id-->    BOUND     (RFD binds the identity; slot fix-up, ledger entry)
BOUND --check-->                  ADMITTED  (returns True exactly once: the connection verification)
ADMITTED --check-->               False     (any further connection)
any state past its deadline -->   CLOSED    (False)
API 403/404 -->                   REJECTED  (False; asks the API again after 30 s, and the API refuses a used ticket)
API 429/5xx/timeout/bad body -->  no state  (False now; the next hook call asks again, so no lockout)
```

### Why this prevents replay

- **Another server, or after a restart:** the API redeems a ticket **once, globally**, with an atomic conditional
  UPDATE. Any other server, a restarted adapter, or a restarted RFD gets `already_redeemed`.
- **Same server, second connection:** the **one** admission is consumed by the first connection verification
  (`BOUND → ADMITTED`). Every later check for that ticket returns False, so RFD kicks the second connection at
  `PlayerAdded`. Replayed join data can still return RFD's cached mapping (RFD never asks us), but the connection
  itself is refused.
- **Late replay:** nothing is admitted more than 60 s after redemption (`ADMISSION_WINDOW_SECONDS`).
- **Identity hooks:** `retrieve_user_id` only works in REDEEMED or BOUND. `retrieve_username` only works in BOUND or
  ADMITTED, and only for the matching id. Anything else raises and fails closed.
- **Concurrency:** one in-flight decision per ticket (a per-ticket lock), so a ticket is never redeemed twice at
  once. Different tickets never wait on each other's API call.

### Residual risk (outside the adapter's control)

RFD answers repeated checks from its own 7 s cache without calling the adapter. So:

1. **Two connections for the same code within 7 s.** Both are answered by RFD's cache. The adapter cannot see the
   second one.
2. **Unobserved legitimate admission.** If the real client connects within 7 s of its join data, its verification
   comes from RFD's cache and the adapter never sees it. The single admission then stays unconsumed. Someone else
   holding the same raw ticket could use it until the 60 s window closes, on this server only, as the same user
   (not a different identity).

Both need the raw ticket, which only the player's own browser, launcher and command line see. Closing this fully
needs a per-connection signal from RFD, which is a later-phase item: for example an RFD patch, or using
`retrieve_avatar` as a post-connect hook after verifying its call pattern live.

### Tests (`rfd/adapter/tests`, 27 tests, standard library only)

A fake RFD (`FakeRfd`) reproduces the join-data loop, the `players` schema, `is-player-allowed` and the 7 s cache
on a fake clock. A fake API enforces single use.

| Property | Test |
|---|---|
| Repeated hooks during one join work | `test_repeated_hook_invocations_for_one_join`, `test_hook_repeated_before_binding_is_same_join` |
| A second connection is refused | `test_second_connection_with_same_ticket_is_rejected` |
| Replay after the window is refused | `test_replay_after_admission_window_is_rejected_even_if_admission_unseen` |
| The documented residual behaves as documented | `test_known_residual_window_when_rfd_cache_hides_the_admission` |
| Slow client past the window | `test_slow_client_past_admission_window_is_refused` |
| Restart: the API refuses a redeemed ticket | `test_redeemed_ticket_after_adapter_restart_is_rejected_by_api` |
| Expired ticket | `test_expired_ticket_is_rejected` |
| Negative cache (definitive rejections only) | `test_unknown_ticket_negative_cache_then_reask`, `test_transient_api_errors_are_not_negative_cached` |
| Identity hooks fail closed out of order | `test_identity_hooks_fail_closed_outside_an_active_join` |
| No redirects, credential-file permissions, API-URL rules | `test_redirects_are_not_followed`, `test_credential_file_readable_by_others_is_refused`, `test_api_url_rules` |

## 4. Returning-player workaround (re-reviewed; deliverable G)

**Why it is necessary.** RFD's `players` table has `UNIQUE(id_number)` and `UNIQUE(username)` with
`ON CONFLICT IGNORE`, and RFD loops `retrieve_user_id` until an insert sticks. Every join uses a new ticket (a new
user code) with the same stable id and username. Without the fix, a returning player's insert is silently ignored
forever and **RFD hangs**; a test reproduces this with the fix disabled.

**What it does** (`_free_player_slot`, called from `retrieve_user_id` for a just-redeemed ticket):

- **Scope.** It touches only RFD's `players` table, in the sqlite file at `REVIVAL_RFD_SQLITE_PATH` (operator
  environment) or `<CONFIG_DIR>/_.sqlite`.
  - The path must be absolute. It never comes from the ticket, the API or the player.
  - It opens with `mode=rw`, so it never creates a file.
- **Schema check.** It checks the table's columns are exactly `id_number, user_code, username` before touching
  anything, and fails closed otherwise.
- **SQL.** Parameterized only, inside `BEGIN IMMEDIATE` (serialized with other writers):
  - `SELECT` rows where `(id_number = ? OR username = ?) AND user_code <> ?`;
  - if **any** such row belongs to a different id or a different username, fail closed (`AdapterError`) and delete
    nothing;
  - otherwise delete each row by its exact `user_code` **and** `id_number`, then `COMMIT` (or `ROLLBACK` on error).
- **It cannot delete another player's row.**
  - It only deletes rows whose `id_number` equals the backend-verified id of the ticket being bound.
  - Identities come only from the API. A username held by a different id makes it stop rather than delete.

**Concurrency tests.** Two simultaneous joins for the same user, plus a join by another user: no hang, the other
player's row is intact, and at most one mapping exists for the returning user. With calls spaced past RFD's 7 s
cache, the adapter admits at most one connection.

## 5. Public server-id removal (deliverable C)

`GET /api/games/:id/servers` now returns only `{ playerCount, maxPlayers, status }`. The shared Zod schema is
`.strict()`, and the route selects only those columns. Tests assert the exact key set and that no `server.id`
appears in any public body.

Other browser-visible responses (join, game detail, game list) were already free of server data. The e2e test
(§9) checks all four responses for:

- server UUIDs
- `"host"` and `"port"` keys
- the port number
- `serverId`
- `rvgs_`

The web game page now keys the list by index. Internal responses (`/api/internal/*`) still include the id; they are
machine-to-machine only and never proxied.

## 6. Heartbeat agent (deliverable D)

`rfd/heartbeat_agent/revival_heartbeat_agent.py` is standard-library Python and runs as its own process next to
each RFD server.

- **Identity.** `server_id` and the credential in its config identify the GameServer. The credential is bound to
  that id by the API.
- **Liveness.** A TCP connect to the local RFD web port. It deliberately does not speak HTTPS to RFD: RFD's
  certificate is self-signed and TLS verification is never disabled.
- **Player count.** RFD v347 has **no presence or player-count API**, and its `players` table keeps rows after a
  player leaves. The only trusted local signal is the **join ledger** the adapter writes (time + numeric id per
  admitted join, never tickets).
  - The agent reports the number of **distinct ids that joined in the last `player_window_seconds`** (default 20
    min), capped at `max_players`.
  - This is an **over-estimate**, which is the safe direction: matchmaking sends fewer players to a server that
    looks fuller. A corrupt or oversized ledger reports "full".
  - It is never used for authorization. It does not read RFD memory or hook RFD.
- **Cycle.** Every `interval_seconds` (default 30) it sends `POST /heartbeat {playerCount, maxPlayers, status:
  "online"}`.
- **Failures.**
  - After 2 failed probes it reports `offline` (once), and resumes when the port returns.
  - API failures are logged and retried next cycle; a missed beat makes the server stale, and so not joinable.
  - SIGTERM/SIGINT reports `offline` and exits.
- **Commands.** `--drain`, `--offline` and `--once` send one fixed request and exit. `--drain` stops new players;
  the API keeps a draining server draining.
- **What it never does:** process spawning, shell, Lua, eval, remote commands, inbound sockets, following redirects
  (so the credential is never resent elsewhere), or arbitrary endpoints. `ApiClient.post` accepts only
  `heartbeat | drain | offline`.
- **Tests:** 20, in `rfd/heartbeat_agent/tests`. They include a source scan for `subprocess`, `os.system`, `exec(`,
  `eval(`, `ctypes`, `pickle` and `getattr(`.

## 7. GameServer secret handling

The credential is `rvgs_` plus 256 random bits. The database stores only its SHA-256.

| Rule | How it is met |
|---|---|
| Never compiled into the launcher or client | The launcher has no credential field (`deny_unknown_fields`), and the credential is not in the ticket, launch URL, or any public response (tests). |
| Never in source control | `.gitignore` covers `*.credential`, `.env*`, `heartbeat.toml`, `*.pfx` and `*.p12`; the example configs contain placeholders only; the regression search (§10) found no real secrets. |
| Never exposed to users | Only `npm run server` prints it, **once**, to the operator. It is never logged; tests grep the logs. |
| Environment variable or restricted file | `REVIVAL_GAME_SERVER_CREDENTIAL` (env), or `REVIVAL_GAME_SERVER_CREDENTIAL_FILE` / `credential_file` (absolute path). |
| File readable only by the server account | On POSIX, the adapter and agent **refuse** a file with any group/other permission bits (tests). |
| Not beside public web files | Keep it outside RFD's config/place directory and any web root. The smoke/e2e tools put it in its own `0700` temp directory. |

**Linux deployment:**

```bash
install -d -m 0750 -o root -g revival-rfd /etc/revival
install -m 0600 -o revival-rfd -g revival-rfd /dev/null /etc/revival/gameserver.credential
# paste the rvgs_... value into that file with an editor; never put it on a command line
```

Run RFD and the agent as `revival-rfd`. With systemd, `LoadCredential=` works too; point
`REVIVAL_GAME_SERVER_CREDENTIAL_FILE` at `$CREDENTIALS_DIRECTORY/...`.

**Windows deployment:**

1. Create the file somewhere like `C:\ProgramData\OurRevival\secrets\gameserver.credential`.
2. Remove inherited ACLs and grant read only to the RFD service account (and Administrators).

The permission-bit check is POSIX-only, so on Windows the operator's ACLs are the control.

Example configs contain placeholders only: `rfd/heartbeat_agent/heartbeat.example.toml`, and the environment
variable list in `rfd/adapter/revival_ticket_adapter.py`.

## 8. Rate limits (reviewed)

| Limit | Value | Key | Notes |
|---|---|---|---|
| Global (public) | 600/min | IP | Everything without a route-specific limit |
| Auth | 10/min | IP | Login/register |
| Join (ticket issuance) | 5/min | user | One live ticket per user anyway |
| Launcher resolve | 30/min | IP | Plus at most 3 resolves per ticket |
| **Internal** (heartbeat, drain, offline, redeem) | **3000/min** | `internal:<ip>` | **New.** A separate, larger budget, so internal calls no longer compete with the public 600/min bucket |

RFD's repeated hooks **cannot** lock out legitimate users:

- the adapter makes **one** redemption call per join, however often RFD repeats its hooks;
- REJECTED is cached only for definitive API refusals (403/404);
- a 429/5xx/timeout is not cached, so the next hook call asks again (tested).

**Residual:** anyone who can reach an RFD server's web port can make it redeem junk codes. At 50 per second they
could exhaust that one server's internal budget. The impact is limited to that server, and RFD's web port is itself
a DoS surface. Values are configurable (`RATE_LIMIT_*`).

## 9. Verification (deliverable H)

| Check | Result |
|---|---|
| API tests (`npm test`) | 102/102 |
| Adapter tests | 27/27 |
| Heartbeat agent tests | 20/20 |
| Launcher tests (`cargo test`) | 35/35; clippy `-D warnings` on Linux and the Windows target |
| Windows cross-build | OK (`x86_64-pc-windows-gnu`) |
| Frontend lint/build | 0 errors; 18 pre-existing warnings in legacy-derived pages; build OK |
| Prisma validate | OK |
| npm audit | 0 vulnerabilities (root and web) |
| cargo audit | 0 vulnerabilities, 0 warnings (72 crates) |
| `npm run e2e:join` | 11/11 (see below) |
| `npm run rfd:smoke` with the fake RFD | PASS (see below) |

`npm run e2e:join` runs against the real API, real adapter, real launcher binary and the fake RFD. It checks:

1. The browser never receives server host/port/id.
2. Repeated join-data hooks for one join work.
3. The join's connection is admitted.
4. A second connection with the same ticket is refused.
5. The redeemed ticket is refused on another server.
6. A wrong server cannot redeem, and does not consume, a ticket.
7. An expired ticket is refused.
8. A user banned before redemption is refused.
9. The launcher starts RFD directly (argv), and the player is admitted.
10. Launcher output never contains the ticket.

`npm run rfd:smoke` with the fake RFD confirms:

- the server started with `--skip_download`;
- heartbeat;
- ticket issued;
- launcher exit 0;
- redemption observed in the database;
- a replayed redemption returned 403;
- the ledger bind was recorded;
- clean shutdown: the throwaway server was deleted, the processes killed, and the temp directories removed.

## 10. Security regression search

These searches were run over all source, excluding `node_modules`, `target`, build output, and generated or lock
files:

- **Process and shell:** `child_process`, `spawn`, `exec*`, `subprocess`, `os.system`, `Command::new`, `cmd.exe`,
  `powershell`, `shell: true`, `shell=True`.
- **Dynamic code:** `eval(`, `new Function`, `exec(`, `getattr(`, `__import__`, and dynamic `obj[name](` dispatch.
- **Secret handling:** raw-ticket and credential logging, and hardcoded secrets (`rvgs_…`/`rvjt_…` literals, private
  keys, cloud keys).
- **TLS bypass:** `rejectUnauthorized`, `NODE_TLS_REJECT_UNAUTHORIZED`, `CERT_NONE`, `verify=False`,
  `_create_unverified_context`, `danger_accept_invalid*`, `insecure`.

Every hit is one of these exceptions:

| Hit | Why it is allowed |
|---|---|
| `launcher/src/launch.rs` `Command::new(program).args(argv)` | **The allowed exception:** a direct executable + argv spawn of the configured RFD. |
| `dev-tools/rfd-smoke/rfd-smoke.mjs`, `dev-tools/e2e/join-boundary.mjs` `spawn(file, argv, { shell: false })` | Dev-only harnesses that the user asked for (item 13). They start only the user-supplied RFD executable, the fake RFD, and the locally built launcher, by absolute path. They are never deployed or imported by `api/` or `web/`. |
| `rfd/adapter/tests/test_adapter.py` `exec(...)` | A test-only copy of RFD's own python-call-mode wrapper, used to run **our** GameConfig hook snippets exactly as RFD would. |
| `api/src/cli/server-provision.ts` prints `GAME_SERVER_CREDENTIAL` | The operator's one-time display at provisioning; documented. |
| `rvjt_AbCd…` literals in launcher unit tests | Fake, pattern-valid test tickets, never issued. |
| Regex `.exec(` in `api/src/servers/credentials.ts` | A regular expression, not code execution. |

No TLS bypass, `eval`, `new Function`, dynamic dispatch, raw-ticket logging or real secret was found.

## 11. Ticket cleanup, logout and bans

- **Cleanup.** `npm run tickets` now calls `cleanupTickets()`:
  - a single `DELETE … WHERE` of tickets expired more than 1 h ago, or redeemed/revoked more than 24 h ago;
  - an explicit guard that never matches an active ticket (unexpired, unredeemed, unrevoked).
  - It is idempotent and safe to run concurrently. Tests cover every ticket state, 6 cleanups in parallel (each dead
    ticket deleted exactly once), and an active ticket that stays redeemable after cleanup.
- **Logout** revokes the user's unused tickets (tested again).
- **Ban before redemption.**
  - The user's session stops authenticating, so they can't get a ticket (401).
  - A ticket issued before the ban is refused at resolve (404) and at redemption (403 `banned`), and is not
    consumed. Tested in the API tests and in the e2e test.
- **Ban after redemption (honest status):** **there is no live kick.** A player already in a game stays until they
  leave. RFD exposes no kick API that we use, and we built no remote-command channel by design. A future kick needs
  a narrowly-typed, per-server "revoke user" poll that the adapter or agent can act on without arbitrary commands.

## 12. Smoke-test harness for a real RFD build

```bash
npm run build && (cd launcher && cargo build --release)
npm run dev:api                                    # API on 127.0.0.1:4000
DATABASE_URL=... npm run rfd:smoke -- --rfd-path "C:\RFD\RFD.exe" --place "C:\places\baseplate.rbxl"
npm run rfd:smoke -- --rfd-path ... --place ... --dry-run    # validate inputs and print the plan only
```

The harness:

1. Verifies the files exist. It refuses:
   - relative paths;
   - anything under a `2015` directory;
   - `patchedrcc.exe`, `newrccpatched.exe` and `RccService.exe`.
2. Provisions a throwaway GameServer for a private "RFD smoke test" game.
3. Writes a temporary GameConfig directory: config, adapter, a copy of the place. The credential goes in a separate
   `0700` directory.
4. Starts **only** the supplied RFD executable: `server --skip_download --config … --web_port …`, with `shell: false`
   and secret-looking environment variables stripped.
5. Requires the API and RFD host to be loopback or private addresses.
6. Waits for the web port, sends a heartbeat, and issues a ticket.
7. Runs the launcher with the launch URL, using a temporary config. The launcher also passes `--skip_download`.
8. Observes redemption in the database.
9. Checks that a replayed redemption is refused, and that the adapter recorded the bind.
10. Reports PASS/FAIL, then shuts down: kills the process groups, posts `offline`, deletes the server, and removes
    the temp directories. On Windows, close the player window by hand.

It never downloads anything or contacts any mirror.

**Important finding: RFD downloads binaries from GitHub on first run unless it is given `--skip_download`.** Both the
harness and the launcher (default `rfdAllowAutoDownload: false`) now always pass it. Install RFD's v347 files ahead
of time.

**To reach "FULL LIVE RFD VERIFIED"**, the run must:

- use a real RFD v347 build;
- show the player in-game with the website username and numeric id;
- show a replay of the same launch URL being kicked;
- show the heartbeat agent reporting the join.

## 13. Remaining risks and TODOs

1. **Not run against real RFD v347** (no build here, and nothing is downloaded). Hook call order, the 7 s cache
   interplay, whether `retrieve_user_id` runs once per join, and `place.rbxl` path resolution all need live
   confirmation.
2. **RFD 7 s cache residual** (§3): up to one unobserved extra connection as the same user within 60 s, on one
   server, by someone who already has the raw ticket.
3. **Player count is an estimate** (§6). A real presence signal needs RFD support (RCC `PlayerRemoving` → an
   endpoint).
4. **No live kick** after ban (§11).
5. **Internal API DoS via junk codes** is limited to one server (§8).
6. **Windows credential ACLs** are the operator's responsibility; there is no automatic check.
7. **The launcher is unsigned** (see `launcher-security.md`).
