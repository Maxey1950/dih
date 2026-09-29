# Dependency security (Phase 1)

Audit baseline: donor `alphablox-next/client/package-lock.json` @ `715903d`, audited with
`npm audit --package-lock-only --omit=dev` on 2026-09-29: **10 vulnerabilities (2 critical, 5 high, 3 moderate)**.

After Phase 1:

| Package tree | Command | Result |
|---|---|---|
| `web/` | `npm audit` (prod + dev) | **found 0 vulnerabilities** |
| root workspaces (`shared/`, `api/`, `database/`) | `npm audit` | **found 0 vulnerabilities** |

`npm audit fix --force` was **not** used anywhere. Every change below was chosen and verified by hand
(`next build`, `eslint`, `tsc`, API tests, Prisma validate/generate/migrate and a headless-browser smoke test).

## web/ — direct dependencies

| Package | OLD VERSION | NEW VERSION | WHY CHANGED | ANY BREAKING CHANGE |
|---|---|---|---|---|
| `next` | 15.0.7 | 16.3.7 | Audit: **critical** (advisory range 9.3.4-canary.0 – 16.3.0-preview.10). Only patched line available. | Yes (major). `next lint` removed → `eslint .` with flat config; Turbopack is the default bundler; `rewrites()` still resolved at build time. App code needed no API changes (all pages already `'use client'`). |
| `react`, `react-dom` | 18.2.0 | 19.3.0 | Recommended pairing for Next 16 App Router. | Major, but no code changes needed. New React Compiler lint rules flag donor fetch-in-effect patterns (downgraded to warnings, see TODO). |
| `axios` | 1.7.7 | **removed** | Audit: **high** (SSRF/credential leakage via absolute URL, prototype-pollution gadgets). Also the transport for the old Bearer-token pattern. | Replaced by `web/src/lib/api.js` (native `fetch`, same-origin `/api/` only). |
| `lodash` | 4.17.21 | **removed** | Audit: **high** (`_.template` code injection, `_.unset`/`_.omit` prototype pollution). Only `debounce` was used. | Replaced by `web/src/lib/utils/debounce.js`. |
| `dompurify` | 3.1.7 | **removed** | Audit: moderate (2 XSS bypass advisories). No longer needed: forum text is never parsed as HTML. | Replaced by `LinkifiedText` (React elements only). |
| `jwt-decode` | 4.0.0 | **removed** | Used to read identity from a localStorage JWT. | Identity now comes from `GET /api/auth/me`. |
| `font-awesome` | 4.7.0 | **removed** | Unused duplicate of `@fortawesome/fontawesome-free`. | None. |
| `@popperjs/core` | 2.11.8 | **removed** | Already bundled in `bootstrap.bundle.min.js`. | None. |
| `@fortawesome/fontawesome-free` | 6.6.0 | 7.3.1 | Current release; bundled locally (no CDN). | Major. Verified every icon class used (`fa-shirt`, `fa-plus`, `fa-book`, `fa-cog`, `fa-database`, `fa-envelope`, `fa-lock`, `fa-shield-alt`, `fa-user-shield`) still exists. v7 renders icons fixed-width by default (minor visual). |
| `bootstrap` | 5.3.3 | 5.3.8 | Patch releases. | None. |
| `bootswatch` | 5.3.3 | 5.3.8 | Patch releases. Cosmo is now compiled from SCSS (`src/styles/theme.scss`) with `$web-font-path: false`, so it no longer `@import`s Google Fonts at runtime. | None visually; the Cosmo font (Source Sans) is self-hosted via `next/font`. |
| `bootstrap-icons` | 1.11.3 | 1.13.1 | Minor releases. | None. |
| `react-bootstrap` | 2.10.9 | 2.10.10 | Patch; React 19 compatible. | None. |
| `date-fns` | 4.1.0 | 4.4.0 | Minor releases. | None. |
| `react-hot-toast` | 2.5.2 | 2.6.1 | Minor release. `<Toaster />` is now actually mounted (donor never mounted it). | None. |
| `react-icons` | 5.3.0 | 5.7.0 | Minor releases. | None. |
| `leo-profanity` | 1.7.0 | 1.9.0 | Minor releases (client-side hint only; the API must enforce). | None. |
| `eslint` (dev) | 8.57.1 | 9.39.5 | ESLint 8 is EOL; Next 16 config requires ≥ 9. | `.eslintrc.json` → `eslint.config.mjs` (flat config). |
| `eslint-config-next` (dev) | 15.0.2 | 16.3.7 | Matches Next 16. | Brings `eslint-plugin-react-hooks` 7 (React Compiler rules). |
| `eslint-config-prettier`, `eslint-plugin-*` (dev) | 9.1.0 / various | **removed** | Unused / provided by `eslint-config-next`. | None. |
| `sass` (dev) | — | 1.105.1 | **Added** to compile Bootswatch Cosmo without the Google Fonts import. | — |

## web/ — transitive dependencies flagged in the donor audit

| Package | OLD VERSION | NEW VERSION | WHY CHANGED | ANY BREAKING CHANGE |
|---|---|---|---|---|
| `form-data` | 4.0.1 | **not installed** | Audit: **critical** (unsafe boundary RNG, CRLF injection). Came in via `axios`. | Gone with axios. |
| `follow-redirects` | 1.15.9 | **not installed** | Audit: moderate (auth header leak on cross-domain redirect). Came in via `axios`. | Gone with axios. |
| `nanoid` | 3.3.7 | 3.3.19 | Audit: high. Now pulled by `postcss` via Next 16 at a patched version. | None. |
| `@babel/runtime` | 7.26.9 | 7.29.7 | Audit: moderate. Pulled by `react-bootstrap` at a patched version. | None. |

## Root workspaces (shared/, api/, database/) — new

| Package | VERSION | Notes |
|---|---|---|
| `fastify` | 5.12.5 | API framework. |
| `zod` | 4.6.5 | Env validation + shared API contract. |
| `prisma`, `@prisma/client` | 7.10.0 | PostgreSQL schema/migrations. `prisma@8` exists only as release candidates, so 7.x is used. |
| `typescript` | 6.0.3 | TS 7 (native compiler) is available, but 6.x keeps the widest tooling compatibility for now. |
| `tsx` | 4.23.15 | Dev runner + test runner. |
| `@types/node` | 22.x | Matches the Node 22 runtime. |

### Overrides (root `package.json`)

`npm audit` on the fresh root install reported **4 high** vulnerabilities, all inside the Prisma CLI
(a devDependency, not shipped at runtime):

| Package | FROM (pinned by prisma 7.10.0) | TO (override) | WHY | BREAKING? |
|---|---|---|---|---|
| `deepmerge-ts` | 7.1.5 | 8.0.2 | GHSA-ggr8-5vv4-36mx (stack exhaustion on recursive objects), via `@prisma/config`. | Major bump of a transitive dep. Verified `prisma validate`, `prisma generate`, `prisma migrate diff` and `prisma migrate deploy` (against a real PostgreSQL) all still work. |
| `mysql2` | 3.15.3 | 3.24.5 | GHSA-3f6p-5ww8-9rcr, GHSA-rgwj-5xj2-c3m3. Pulled by the Prisma CLI's dev tooling; we use PostgreSQL. | Minor bump. |

npm's own suggestion (`npm audit fix --force`) was to downgrade to `prisma@6.19.3`. That's a breaking change and would have
thrown away the Prisma 7 config model, so it was rejected. **Remove these overrides** once Prisma ships a release that depends on the fixed versions.

## Re-running

```bash
npm audit                 # root workspaces
npm audit --prefix web    # frontend
```
