# Phase 2: accounts, sessions and the social graph

Scope: registration, login/logout, sessions, public profiles, people search, friends, follows, and settings.
Out of scope (later phases): password reset, email verification, messages, groups, forum, catalog, avatar,
economy, admin actions, launcher/RFD.

## API routes

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | none | |
| GET | `/api/auth/csrf` | none | `{ csrfToken }`; also sets the HttpOnly CSRF-secret cookie |
| GET | `/api/auth/me` | optional | `{ authenticated: true, user }` or `{ authenticated: false, user: null }` (always 200) |
| POST | `/api/auth/register` | none, CSRF, rate-limited | `{ username, password }` → 201 `{ authenticated, user }` + session cookie |
| POST | `/api/auth/login` | none, CSRF, rate-limited | `{ username, password }` → `{ authenticated, user }` + new session cookie |
| POST | `/api/auth/logout` | CSRF | deletes the session row, clears the cookie; idempotent |
| GET | `/api/users?search=&page=&limit=` | optional | limit 1–50 (default 10), search limited to username characters |
| GET | `/api/users/:id` | optional | `{ user, stats, relationship }` |
| GET | `/api/users/:id/friends` | optional | paginated (limit ≤ 50) |
| GET | `/api/users/:id/followers` | optional | paginated |
| GET | `/api/users/:id/following` | optional | paginated |
| GET | `/api/users/me/settings` | required | |
| PATCH | `/api/users/me` | required, CSRF | `{ displayName?, description?, theme? }` (strict; other fields rejected) |
| GET | `/api/users/me/friend-requests` | required | incoming pending requests |
| POST | `/api/friends/:id/request` | required, CSRF | |
| POST | `/api/friends/:id/accept` | required, CSRF | accepts the request **:id sent to you** |
| DELETE | `/api/friends/:id` | required, CSRF | unfriend, cancel your request, or decline theirs |
| POST | `/api/users/:id/follow` | required, CSRF | |
| DELETE | `/api/users/:id/follow` | required, CSRF | |
| GET | `/api/admin/users?search=&page=` | admin | read-only list (proves `requireAdmin`) |

All errors share the same shape: `{ "error": { "code", "message", "details"? } }`. The codes are:

- `BAD_REQUEST`, `VALIDATION_FAILED`
- `INVALID_CREDENTIALS`, `USERNAME_TAKEN`
- `CSRF_INVALID`, `UNAUTHENTICATED`, `FORBIDDEN`
- `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL`

Prisma errors, stack traces, file paths and hashing errors never reach clients: unexpected errors become a generic
`INTERNAL`, and Fastify's own 4xx become a generic `BAD_REQUEST`.

### Mapping from the donor's friend flows

| Donor UI action | Donor endpoint | New endpoint |
|---|---|---|
| Add Friend | `POST /api/friend/request/:userId` | `POST /api/friends/:userId/request` |
| Accept (profile + Requests tab) | `POST /api/friend/accept/:requestId`, `POST /api/friend/${action}/:requestId` | `POST /api/friends/:requesterUserId/accept` |
| Decline (profile + Requests tab, where the donor sent `reject`, which its server didn't support) | `POST /api/friend/decline/:requestId` | `DELETE /api/friends/:requesterUserId` |
| Unfriend | `DELETE /api/friend/unfriend/:userId` | `DELETE /api/friends/:userId` |
| Button state | `GET /api/friend/status/:userId` | `relationship.friendship` in `GET /api/users/:id` |
| Follow / Unfollow | `POST /api/followers/follow/:id`, `DELETE /api/followers/unfollow/:id` | `POST` / `DELETE /api/users/:id/follow` |
| Counts / follow state | `GET /api/followers/counts/:id`, `/status/:id` | `stats` and `relationship.isFollowing` in `GET /api/users/:id` |

Requests are addressed by the **other user's id**, not by a request id. There is at most one relationship row per
pair, so the user id is enough, and the server derives who is allowed to do what.

## Auth and session design

- **No JWT.** Sessions are rows in `sessions`.
- **Token:** 32 bytes from `crypto.randomBytes` (256 bits), base64url. The database stores only `SHA-256(token)` in
  `token_hash` (unique, CHECK-constrained to 64 hex characters). A database leak therefore yields no usable
  session tokens.
- **Cookie:** `HttpOnly; SameSite=Lax; Path=/`. `Secure` and the `__Host-` name prefix are on when `COOKIE_SECURE`
  is set, which it is by default in production. Development over http uses `rv_session`. The token is never in a
  response body, `localStorage`, `sessionStorage`, or a JS-readable cookie.
- **Lifetime:** absolute `SESSION_TTL_DAYS` (default 30).
- **Rotation:** login and registration delete the session presented with the request (if any) and create a new
  one.
- **Logout:** deletes the row, then clears the cookie; replaying the old cookie is tested and rejected.
- **Central resolver** (`api/src/auth/session.ts`, an `onRequest` hook on `/api/*`):
  1. read the cookie and check its format
  2. SHA-256 it
  3. look up the session with its user
  4. reject it if expired (and delete it) or if the user is banned
  5. set `request.auth = { user, sessionId }`, or `null`
- **Guards** (`api/src/auth/guards.ts`): `optionalAuth` (the default), `requireAuth` (401), `requireRole(min)` and
  `requireAdmin` (401/403). Permissions come from `users.role` only. There are no id-based privileges; the only way
  to make an admin is `npm run user:set-role -w @revival/api -- <username> admin`.
- **Frontend guards** (`RequireAuth`) are UX only.

### Passwords

- **Hashing:** argon2id via `argon2` (node-argon2), with m=19 MiB, t=2, p=1 (OWASP). Hashes are PHC strings, and
  `needsRehash` upgrades them on the next login.
- **Limits:** 8–128 characters, checked before hashing so oversized input can't burn CPU. The password must not
  equal the username. No composition rules (NIST 800-63B).
- **Unknown usernames:** verified against a dummy hash, so response time does not reveal whether a username exists.
  The external error is identical for a wrong password and an unknown user (tested).
- **Never exposed:** passwords and hashes are never logged or returned. The logger redacts `Authorization`,
  `Cookie`, `Set-Cookie` and `X-CSRF-Token`, and does not log request bodies.

### Usernames

The rules are defined once in `shared/src/validation.ts`:

- 3–20 characters: ASCII letters, digits, and at most one underscore; must start and end with a letter or digit.
  This rules out control characters, whitespace and homoglyphs.
- A few reserved names are refused.
- `username_normalized` (lower-case) carries the UNIQUE constraint, so `Builderman`/`builderman` collide. The display
  form is kept in `username`.
- Separately, `displayName` (optional, up to 32 characters, no control characters) is editable in Settings.

### Registration fields and email

The donor form asked for email only to support email verification, which is out of scope. The form and API
therefore collect **username and password only**. The nullable `users.email` column is kept for a future opt-in
recovery feature.

### CSRF

This uses the synchronizer-token design via `@fastify/csrf-protection` in cookie mode:

1. A random CSRF **secret** lives in a signed, HttpOnly, `SameSite=Lax` cookie (`rv_csrf` in dev, `__Host-csrf` in
   production).
2. `GET /api/auth/csrf` returns a **token** derived from that secret. The web app keeps the token in memory only and
   sends it as `X-CSRF-Token` on every POST/PUT/PATCH/DELETE. On a `CSRF_INVALID` response it refreshes the token
   once and retries.
3. Every unsafe `/api/*` request must carry a valid token. Login and registration are included, which prevents
   login CSRF.
4. **Defense in depth:** an unsafe request whose `Origin` header is present but not in `WEB_ORIGINS` is rejected.
   SameSite=Lax adds a third layer, but it is not relied on.

Tests cover a missing token, a token from another browser, and a foreign Origin.

### Rate limiting

`@fastify/rate-limit` uses an in-memory store:

- Login and register: `RATE_LIMIT_AUTH_MAX` per `RATE_LIMIT_AUTH_WINDOW` per IP (default 10 per minute).
- Everything else: `RATE_LIMIT_GLOBAL_MAX` per minute (default 600).
- `TRUST_PROXY` (default loopback only) decides whose `X-Forwarded-For` is believed.
- For multiple API instances, switch the store to Redis (TODO).

### Online status

- The web app re-fetches `/api/auth/me` every **60 s** while the tab is visible. The donor pages keep their existing
  30 s list polling.
- The resolver writes `users.last_online_at` and `sessions.last_used_at` at most every **2 minutes** per
  user/session, so PostgreSQL does not see a write per request.
- A user counts as **online** if seen within the last **5 minutes**.
- No WebSockets.

### Session cleanup

Expired sessions are cleaned up in three ways:

- deleted when presented
- the user's expired sessions are deleted at every login
- `npm run sessions:cleanup` (from the repo root, or `-w @revival/api`) deletes all of them. In production, run it
  from cron, e.g. hourly: `17 * * * * cd /srv/revival && npm run sessions:cleanup`.

## Database (Prisma migration `20260930000000_accounts_sessions_social`)

- **`users`:** `blurb` is renamed to `description` and `last_seen_at` to `last_online_at`. These are hand-edited
  RENAMEs, so no data is dropped. `display_name` is added, along with an index on `last_online_at`.
- **`sessions`:** `ip_address` and `revoked_at` are dropped (no IPs are stored; logout deletes the row), and
  `user_agent` is limited to 256 characters. CHECK: `token_hash ~ '^[0-9a-f]{64}$'`.
- **`friendships`** (new): one row per unordered pair.
  - `UNIQUE (user_low_id, user_high_id)`
  - `CHECK (user_low_id < user_high_id)`: no self-friendship and no reversed duplicates
  - `CHECK` that the requester is one of the pair
  - `CHECK` that `accepted_at` is set exactly when `status = 'accepted'`
  - Foreign keys `ON DELETE CASCADE`
- **`follows`** (new): primary key `(follower_id, following_id)` (no duplicates), `CHECK (follower_id <>
  following_id)`, foreign keys `ON DELETE CASCADE`.
- **Other foreign keys:** `sessions.user_id` cascades. `games.creator_id` is `RESTRICT`, so deleting a creator can't
  silently delete games.
- The Phase 1 migration was not edited. `prisma migrate diff` shows no drift between the migrations and the schema.

## Security verification (repository search, 2026-09-30)

| Check | Result |
|---|---|
| Auth tokens in `localStorage`/`sessionStorage` | None. The only `localStorage` use is the light/dark theme (`web/src/contexts/ThemeContext.js`). |
| JWT (`jwt`, `jsonwebtoken`, `jwt-decode`, `atob(`) | None. |
| Password or credential console logging | None. The only `console.log`s are the two CLI result lines (session count, role change). |
| Session-token logging | None. Logger redaction covers the cookie and CSRF headers, and a grep of the API log after the browser run found no tokens, passwords or hashes. |
| Hardcoded admin ids | None. Roles only; the first user is a normal user (tested). |
| Dynamic friend action routes (`/api/friend/${action}`) | None. There are explicit routes and explicit client functions (`friendsApi.sendRequest/accept/remove`). |
| Plaintext passwords stored | None. All `password_hash` values are `$argon2id$v=19$m=19456,p=1,t=2$…` (tested and checked in the DB). |
| Raw session tokens in the database | None. `token_hash` is 64-hex SHA-256 (CHECK constraint, test, and DB check). |
| Hashes, emails or tokens in API output | None (the test sweeps every GET endpoint plus the login/register bodies). |
