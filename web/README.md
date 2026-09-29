# web/ — AlphaBlox 2016-style frontend

Next.js 16 (App Router), React 19, and Bootstrap 5 with Bootswatch **Cosmo**,
compiled from SCSS in `src/styles/theme.scss` so no Google Fonts are requested.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
npm run lint
```

## How it talks to the backend

- **`src/lib/api.js` is the only API client.** It accepts only relative,
  same-origin `/api/...` paths, so credentials can never be sent to another
  domain. All endpoint paths are defined there.
- `next.config.mjs` proxies `/api/*` to `API_ORIGIN` (default
  `http://127.0.0.1:4000`). **Rewrites are resolved at build time**, so set
  `API_ORIGIN` when running `next build`, or route `/api/*` at your reverse
  proxy instead.
- **Auth is a server-issued HttpOnly session cookie.** JavaScript never sees a
  token. `src/contexts/AuthContext.js` exposes
  `useAuth() → { user, loading, isAuthenticated, refreshUser, login, logout }`,
  and `user` always comes from `GET /api/auth/me`.
- `src/components/auth/RequireAuth.js` redirects for UX only. The API must
  enforce every permission.
- `localStorage` holds only the light/dark `theme` preference.

## Games and Play

- `src/lib/games.js` is a **temporary static adapter** that returns the
  `shared` `Game` shape: `{ id, name, description, creator, thumbnailUrl, playerCount, maxPlayers, … }`.
- `playGame(gameId)` in the same file is the **single integration point** for
  Phase 2's `POST /api/games/:id/join`. For now it reports that the launcher is
  unavailable.

## User content

Forum posts and replies are plain text rendered by
`src/components/LinkifiedText.js`, which turns http(s) URLs into React `<a>`
elements. There is no `dangerouslySetInnerHTML` anywhere.
