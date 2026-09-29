# LEGACY — DO NOT DEPLOY OR EXECUTE

This project reuses only the **frontend** of
[`singharaj-usai/alphablox-next`](https://github.com/singharaj-usai/alphablox-next)
(imported from commit `715903d952060e85a009b8ac3f41ae099dc9e167`, 2026-01-21).

## What was imported

`client/` → `web/`. The file-by-file mapping is in the Phase 1 section of the
root `README.md`, and the audit is in
[`alphablox-migration-map.md`](alphablox-migration-map.md).

## What was deliberately NOT imported

None of the following exist anywhere in this repository or its git history.
Do not add them.

| Donor path | Why excluded |
|---|---|
| `2015/` (269 MB) | Opaque 2015/2016 RCC and client executables (`RccService.exe`, `patchedrcc.exe`, `newrccpatched.exe`, `rblx16.exe`, `0.270.0.30605.exe`, DLLs, NPAPI plugins) of unknown provenance. **Never execute.** The runtime is RFD v347 (see `rfd/README.md`). |
| `server/` | Old Express + MongoDB backend: JWT-in-localStorage auth, hardcoded admin user IDs, RCC/SOAP hooks, verbose logging of secrets. Replaced by `api/`. |
| `server/EXAMPLE.env` | Contained what appear to be real credentials (Gmail app password, MongoDB Atlas URI). The values are not reproduced anywhere here. |
| `update-admin-role.js` | One-off MongoDB admin-promotion script. |
| root `package.json` deps `soap`, `xml2js`, `xmldom` | RCC SOAP tooling. |
| `client/vercel.json`, `EXAMPLE.env.*`, Render.com URLs | Donor deployment configuration. |
| `client/public/ads.txt`, AdSense `<script>` | Donor's Google AdSense account. |
| `client/src/components/ParticlesBackground.js` | Loaded JS at runtime from a CDN. It was imported but never rendered. |
| `client/src/services/*`, `src/config/api.config.js`, `src/lib/auth.js`, `src/api/route.js`, `src/components/AuthProtection.js` | Old API layer (localStorage Bearer tokens, hardcoded hosts, credential logging). |
| `client/src/app/(pages)/admin/dashboard/` | Near-duplicate of `admin/page.js`. |
| `client/src/app/(pages)/games/data.js` | Hardcoded mock data, replaced by the typed adapter in `web/src/lib/games.js`. |
| `.idea/`, `.trae/` | Editor and AI-assistant configuration. |

## Git history

The donor's history was **not** grafted into this repository. Importing it
would put the 269 MB of `2015/` binaries and the committed `EXAMPLE.env`
credentials into our history permanently. Rewriting it to remove them would
produce commits that no longer match upstream, which defeats the purpose.
Provenance is recorded instead: the source repository and exact commit are
above, and the Phase 1 commit message lists them.

## If you need to consult the old backend

Clone the donor repository **outside** this working tree, read it as reference
only, and do not run it. Any behavior you want to keep should be
re-implemented in `api/` against `shared/` schemas, with tests.
