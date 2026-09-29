# launcher/ — `ourrevival://` protocol handler (documentation only in Phase 1)

Nothing is implemented here yet. This document records the planned flow so
that the web, API and RFD pieces are built against the same contract.

## Planned join flow

```
web: user clicks Play on /games/[id]
  → playGame(gameId)                      web/src/lib/games.js  (single integration point)
  → POST /api/games/:id/join              session cookie + CSRF check
      api: verify session, not banned, game playable
      api: pick an RFD v347 server from the registry
      api: ticket = 256-bit random (base64url), store SHA-256(ticket) with
           { userId, gameId, serverId, expiresAt = now + ~60 s, usedAt = null }
      ← { launchUrl: "ourrevival://join?ticket=<ticket>" }   (no host/port sent to the browser)
  → window.location.href = launchUrl      (fallback modal offers the launcher download)

launcher (registered handler for ourrevival://)
  → strictly parse the URL:
      scheme == "ourrevival", action == "join",
      ticket matches ^[A-Za-z0-9_-]{43}$, no other parameters; reject everything else
  → POST https://<api>/api/launcher/ticket/resolve { ticket }
      api: ticket exists, unexpired, unused → { host, port, rfdVersion: "v347" }
  → validate host against an allowlist of our game servers and port as an integer
  → spawn the RFD player with an argv array (never a shell string):
        <RFD player> -h <host> -p <port> -u <ticket>

RFD game server, on player connect
  → POST /api/gameserver/ticket/redeem { ticket, serverId }   (server-to-server auth)
      api: atomically mark used where unexpired, unused and serverId matches
      ← { userId, username, appearance }   or 403 → player is rejected
```

## Security requirements

- The launcher never executes anything named or built from URL input, and
  never passes URL input to a shell.
- Tickets are single-use, short-lived, bound to one user, game and server, and
  stored hashed.
- The launcher ships signed. Its update channel is signed and pinned to our
  domain.
- The launcher does not store the user's web session and never receives it.

## Not in Phase 1

No executable, installer, protocol registration, ticket creation or RFD
download.
