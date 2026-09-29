# AlphaBlox-next → New Revival: Migration Map

Source inspected: `https://github.com/singharaj-usai/alphablox-next` @ `715903d952060e85a009b8ac3f41ae099dc9e167` (2026-01-21), shallow clone.
Scope: read-only defensive audit + migration planning.

> **Status:** Phase 1 is done. The frontend now lives in `web/` (see the root `README.md`), and the
> dependency changes are in `docs/dependency-security.md`. The donor backend and binaries were not imported
> (`docs/legacy-donor.md`). Endpoint paths in `web/src/lib/api.js` follow the "Replacement API map" below.

---

## A. Repository architecture

```
alphablox-next/
├── package.json               root: concurrently client+server; deps soap/xml2js/xmldom (RCC SOAP leftovers)
├── update-admin-role.js       one-off Mongo script: promotes userId 1 to admin
├── README.md                  UTF-16 encoded; says client→Vercel, server→Render, DB→MongoDB Atlas
├── Readmecontent/             README banner image
├── .idea/  .trae/             editor / AI-assistant config (project_rules.md = "use Bootstrap 5")
├── 2015/0.206.0.62042/        269 MB: Windows RCC/client binaries (RccService.exe, patchedrcc.exe,
│                              newrccpatched.exe, rblx16.exe, 0.270.0.30605.exe, *.dll), content/,
│                              shaders/, render.lua, gameserver.txt, AppSettings.xml
├── client/                    Next.js 15.0.7 App Router, React 18, JavaScript (no TypeScript)
│   ├── next.config.mjs        rewrites /api/* → http://localhost:5000 (dev) or https://alphablox-api.onrender.com (prod)
│   ├── vercel.json            same /api/* rewrite to onrender
│   ├── EXAMPLE.env.local      NEXT_PUBLIC_API_URL / NEXT_PUBLIC_APP_URL
│   ├── config/metadata.js     SEO metadata helper (generateMetadata)
│   ├── public/                images (24 files), particles.json, ads.txt (empty)
│   └── src/
│       ├── app/               routes (see below), layout.js, globals.css, page.module.css, error/not-found
│       ├── api/route.js       NOT a live route (outside app/); theme proxy to backend
│       ├── components/        AuthProtection, ParticlesBackground, ResendVerification, UserSubmenu, Alerts/*
│       ├── sections/          Navbar.js, Footer.js
│       ├── contexts/          ThemeContext.js (light/dark, persisted via backend + localStorage)
│       ├── hooks/             useTheme.js
│       ├── services/          authService.js, userService.js  (axios/fetch + localStorage JWT)
│       ├── config/            api.config.js (hardcoded base URLs)
│       ├── lib/               auth.js (fetchWithAuth), utils/{dateUtils,errorHandler,textHelper,wordValidation}
│       └── fonts/             Geist woff
└── server/                    Express + Mongoose (Render.com)
    ├── EXAMPLE.env            ⚠ contains what appear to be REAL credentials (see §E)
    ├── assetthumbnailrenderer.lua   RCC thumbnail script pointing at http://mete0r.xyz
    └── src/
        ├── server.js          mounts every router under /api/*, plus asset router at "/"
        ├── controllers/authController.js
        ├── middleware/        auth.js, authProtection.js, adminProtection.js, activityTracking.js, validateRequest.js
        ├── models/            User, Friend, Follower, ForumPost, ForumReply, ForumReport, Group, Message, Report
        ├── routes/            admin, asset, auth, avatar (NOT mounted), blurb, currency, followers, forum,
        │                      forumReports, friend, groups, message, profile, reports, settings, users, verifyEmail
        ├── services/          onlineStatusService.js, userService.js   (rccService.js is referenced but MISSING)
        ├── config/nodemailer.config.js
        └── utils/             emailValidation, envValidation, wordValidation
```

### Frontend structure (client/src/app)

Framework: Next.js App Router, all pages are `'use client'` components; styling is Bootstrap 5 via
`bootswatch/dist/cosmo/bootstrap.css` + `bootstrap-icons` + Font Awesome, global font Poppins.
There is no server-side data fetching; every page fetches from the browser.

| Area | Route | File |
|---|---|---|
| Root redirect | `/` | `app/page.js` (localStorage token → `/home` else `/login`) |
| Root layout | — | `app/layout.js` (Navbar, SiteAlert, Footer, ThemeProvider, AdSense `<script>`) |
| Nav / header | — | `sections/Navbar.js`, `components/UserSubmenu.js` |
| Footer | — | `sections/Footer.js` |
| Site banner | — | `components/Alerts/SiteAlert.js`, `components/Alerts/ForumAlert.js` |
| Home (logged-in dashboard) | `/home` | `app/(pages)/home/page.js` |
| Games list | `/games` | `app/(pages)/games/page.js` (**hardcoded array, no API**) |
| Game details + Play | `/games/[id]` | `app/(pages)/games/[id]/page.js` (**hardcoded `GAME_DATA`, fake Play**) |
| Game mock data | — | `app/(pages)/games/data.js` (also imported by profile page) |
| Profile | `/user/[userId]/profile` | `app/(pages)/user/[userId]/profile/page.js` |
| Friends / followers | `/user/[userId]/friends` | `app/(pages)/user/[userId]/friends/page.js` |
| People directory | `/users` | `app/(pages)/users/page.js` |
| Messages inbox | `/my/messages` | `app/(pages)/my/messages/page.js` |
| Message reply | `/my/messages/reply/[id]` | `app/(pages)/my/messages/reply/[id]/page.js` |
| Compose message | `/compose/message/[userId]` | `app/(pages)/compose/message/[userId]/page.js` |
| Groups list | `/groups` | `app/(pages)/groups/page.js` |
| My groups | `/my/groups` | `app/(pages)/my/groups/page.js` |
| Group detail | `/groups/group/[groupId]` | `app/(pages)/groups/group/[groupId]/page.js` |
| Create group | `/groups/create` | `app/(pages)/groups/create/page.js` |
| Forum home | `/forum/home` | `app/(pages)/forum/home/page.js` |
| Forum post | `/forum/post/[id]` | `app/(pages)/forum/post/[id]/page.js` |
| New post / reply | `/forum/new/post`, `/forum/new/reply/[id]` | `app/(pages)/forum/new/...` |
| Settings | `/settings` | `app/(pages)/settings/page.js` |
| Login | `/login` | `app/(pages)/(auth)/login/page.js` |
| Register | `/signup` | `app/(pages)/(auth)/signup/page.js` |
| Forgot / reset password | `/forgot-password`, `/reset-password` | `app/(pages)/(auth)/...` |
| Verify email | `/verify-email` | `app/(pages)/(auth)/verify-email/page.js` |
| Report abuse | `/reportabuse/userprofile/[userId]`, `/reportabuse/forum/[id]` | `app/(pages)/reportabuse/...` |
| Support (static) | `/help /faq /contact /privacy /safety /terms` | `app/(pages)/(support)/...` |
| Errors | `/forbidden`, `/method-not-allowed`, 404, error boundary | `app/(errors)/...`, `app/not-found.js`, `app/error.js` |
| **Admin UI** | `/admin`, `/admin/dashboard`, `/admin/reports`, `/admin/reports/forum` | `app/(pages)/admin/...` (no route guard; `admin/page.js` and `admin/dashboard/page.js` are ~95% duplicates) |

**Pages that do NOT exist** (linked from Navbar/UserSubmenu but 404): **`/catalog`**, **`/my/avatar`**, `/create`,
`/money`, `/memberships`, `/blog`, `/parents`, `/admin/logs`. There is **no catalog page, no avatar editor, no
inventory page** in the donor. The profile page has a *mock* "avatar items" carousel built from hardcoded
`/images/*.png` paths and a static `/images/noFilter.png` "3D avatar".

---

## B. Exact frontend API-call inventory

Conventions in the donor:
- `BASE` = `API_CONFIG.defaultOptions.baseURL` = `process.env.NEXT_PUBLIC_API_URL || ''` (`src/config/api.config.js`).
- Relative `/api/...` calls go through the Next rewrite in `next.config.mjs` / `vercel.json` to the Express server.
- `Bearer` = `Authorization: Bearer ${localStorage.getItem('auth_token')}` (JWT stored in localStorage).
- `withCredentials: true` is set on many calls but **no cookie auth is actually used**; the server only reads the Bearer header.
- No WebSocket / socket.io anywhere. "Online" status is polling (`/api/users` and `/api/friend/list` every 30s).

### Auth

| # | FILE | FUNCTION/COMPONENT | CURRENT ENDPOINT | METHOD | REQUEST BODY/PARAMS | EXPECTED RESPONSE | UI FEATURE |
|---|---|---|---|---|---|---|---|
| 1 | `services/authService.js` | `authService.register` (not used by signup page) | `/api/auth/register` | POST | `{username,email,password}` | `{message}` | Registration (dead path) |
| 2 | `app/(pages)/(auth)/signup/page.js` | `handleSubmit` | `${BASE}/api/auth/register` | POST | `{username,email,password}` | `{message}`; errors `{message}` | Sign-up form |
| 3 | `services/authService.js` | `authService.login` ← `login/page.js handleSubmit` | `/api/auth/login` | POST | `{username,password}` | `{authenticated,username,userId,token,message,theme,currency,lastCurrencyAward}`; 429 `{message,remainingTime,maxAttempts}`; 403 `{needsVerification,email}` | Login; stores `auth_token` + `user` in localStorage |
| 4 | `services/authService.js` | `authService.logout` ← `Navbar.handleLogout` | `/api/auth/logout` | POST | none (Bearer) | `{message,shouldRefresh}` (server does nothing) | Logout |
| 5 | `services/authService.js` | `authService.checkAuth` ← Navbar, Home, `AuthProtection` HOC | `/api/auth/checkAuth` | GET | Bearer | `{authenticated,username,userId,theme,currency,lastCurrencyAward,nextAward}` | Session check on every navigation |
| 6 | `contexts/ThemeContext.js` | `fetchTheme` | `/api/auth/check` | GET | none | `{authenticated,theme}` — **route does not exist on server (404), falls back to localStorage** | Theme load |
| 7 | `app/(pages)/(auth)/verify-email/page.js` | `verifyEmail` effect | `${BASE}/api/auth/verify-email` | POST | `{token}` (from `?token=`) | 2xx / error | Email verification |
| 8 | `app/(pages)/(auth)/forgot-password/page.js` | `handleSubmit` | `${NEXT_PUBLIC_API_URL}/api/auth/forgot-password` | POST | `{email}` | `{message}` | Forgot password |
| 9 | `components/ResendVerification.js` | `handleSubmit` | `${NEXT_PUBLIC_API_URL}/api/auth/resend-verification` | POST | `{email}` | `{message}` | Resend verification modal on login |
| 10 | `app/(pages)/(auth)/reset-password/page.js` | `handleSubmit` | `${BASE}/api/settings/reset-password` | POST | `{token,newPassword}` | `{message}` | Reset password |
| 11 | `app/(pages)/settings/page.js` | request reset button | `${BASE}/api/settings/request-password-reset` | POST | `{}` + Bearer | `{message}` | "Change password" (email link) |

### Users / profile / blurb / settings / currency

| # | FILE | FUNCTION/COMPONENT | CURRENT ENDPOINT | METHOD | REQUEST BODY/PARAMS | EXPECTED RESPONSE | UI FEATURE |
|---|---|---|---|---|---|---|---|
| 12 | `app/(pages)/users/page.js` | `fetchUsers` (initial + 30s poll) | `${BASE}/api/users` | GET | none | `{users:[{userId,username,isOnline,avatar?,...}]}` (returns **all** users, client-side paging/search) | People directory |
| 13 | `app/(pages)/user/[userId]/profile/page.js` | `fetchData` | `${BASE}/api/user/${userId}/profile` | GET | Bearer (server **requires** auth) | `{userId,username,isOnline,lastLoginDate,signupDate,blurb,avatar?,membershipType?,...}`; client overwrites `isOwnProfile` by base64-decoding JWT | Profile header |
| 14 | `app/(pages)/user/[userId]/friends/page.js` | `fetchData` | `${BASE}/api/user/${userId}/profile` | GET | Bearer | same as #13, uses `isOwnProfile` | Friends page header |
| 15 | `app/(pages)/compose/message/[userId]/page.js` | effect | `/api/user/${userId}/profile` | GET | Bearer | profile object | Compose — recipient lookup |
| 16 | `services/userService.js` | `getBlurb` ← Home | `/api/blurb/${userId}` | GET | Bearer | `{blurb}` | Home blurb |
| 17 | `app/(pages)/user/[userId]/profile/page.js` | `fetchData` | `${BASE}/api/blurb/${userId}` | GET | none | `{blurb}` | Profile blurb |
| 18 | `services/userService.js` | `updateBlurb` ← Home, Profile | `/api/blurb` | PUT | `{blurb}` + Bearer | `{message,blurb}` | Edit blurb |
| 19 | `app/(pages)/settings/page.js` | load | `${BASE}/api/settings/profile` | GET | Bearer | `{username,email,blurb,theme}` | Settings form |
| 20 | `app/(pages)/settings/page.js` | save | `${BASE}/api/settings/profile` | PUT | `{blurb,gender}` + Bearer | `{message,...}` | Settings save |
| 21 | `app/(pages)/settings/page.js` | theme toggle | `${BASE}/api/settings/theme` | PUT | `{theme}` + Bearer | `{theme}` | Theme |
| 22 | `contexts/ThemeContext.js` | `updateTheme` | `/api/settings/theme` | PUT | `{theme}` (**no Bearer → always 401**) | — | Theme (broken) |
| 23 | `src/api/route.js` | `GET`/`PUT` (not wired: file is outside `app/`) | `${NEXT_PUBLIC_API_URL}/api/settings/theme` | GET/PUT | forwards `Cookie` header | `{theme}` | Dead code |
| 24 | `services/authService.js` | `getCurrencyInfo` ← Navbar | `/api/currency` | GET | Bearer | `{currency,nextAward,timeRemaining,timeRemainingFormatted,lastCurrencyAward,canClaim}` | Navbar currency + daily-reward tooltip |
| 25 | `app/(pages)/home/page.js` | `<img src>` | `${BASE}/api/avatar/thumbnail/${userId}?size=420` and `?size=100` | GET (img) | — | PNG — **router not mounted & `rccService` missing → 404, `onError` falls back to nicepng.com** | Home avatar + friend avatars |

### Friends / followers

| # | FILE | FUNCTION/COMPONENT | CURRENT ENDPOINT | METHOD | REQUEST BODY/PARAMS | EXPECTED RESPONSE | UI FEATURE |
|---|---|---|---|---|---|---|---|
| 26 | `sections/Navbar.js` | `checkAuthStatus` | `/api/friend/requests` | GET | Bearer | `{requests:[{requestId,senderId,username,...}]}` | Friend-request badge |
| 27 | `app/(pages)/user/[userId]/friends/page.js` | `fetchData` (own profile only) | `${BASE}/api/friend/requests` | GET | Bearer | same | Requests tab |
| 28 | `app/(pages)/home/page.js` | effect | `${BASE}/api/friend/list` | GET | Bearer | `{friends:[{userId,username,isOnline,avatar}],friendCount,isOwnProfile}` | Home friends grid |
| 29 | `app/(pages)/user/[userId]/profile/page.js` | `fetchData` + 30s poll | `${BASE}/api/friend/list/${userId}` | GET | none | same | Profile friends |
| 30 | `app/(pages)/user/[userId]/friends/page.js` | `fetchData`, after accept | `${BASE}/api/friend/list/${userId}` | GET | Bearer | same | Friends tab |
| 31 | `app/(pages)/user/[userId]/profile/page.js` | `fetchFriendStatus` | `${BASE}/api/friend/status/${userId}` | GET | Bearer | `{status:'none'|'pending'|'accepted',requestId,isSender}` | Add/Accept/Unfriend button state |
| 32 | `app/(pages)/user/[userId]/profile/page.js` | `handleFriendAction('add')` | `${BASE}/api/friend/request/${userId}` | POST | `{}` + Bearer | `{message}` | Add friend |
| 33 | profile page | `handleFriendAction('accept')` | `${BASE}/api/friend/accept/${requestId}` | POST | `{}` + Bearer | `{message}` | Accept |
| 34 | profile page | `handleFriendAction('decline')` | `${BASE}/api/friend/decline/${requestId}` | POST | `{}` + Bearer | `{message}` | Decline |
| 35 | profile page | `handleFriendAction('unfriend')` | `${BASE}/api/friend/unfriend/${userId}` | DELETE | Bearer | `{message}` | Unfriend |
| 36 | `app/(pages)/user/[userId]/friends/page.js` | `handleFriendAction(requestId, action)` | `${BASE}/api/friend/${action}/${requestId}` (`action` ∈ accept/decline, from UI) | POST | `{}` + Bearer | `{message}` | Requests tab accept/decline |
| 37 | profile page | `fetchFollowData` | `/api/followers/counts/${userId}` | GET | Bearer | `{followersCount,followingCount}` | Follower counts |
| 38 | profile page | `fetchFollowData` | `/api/followers/status/${userId}` | GET | Bearer | `{isFollowing}` | Follow button |
| 39 | profile page | `handleFollowAction` | `/api/followers/follow/${userId}` | POST | `{}` + Bearer | `{message}` | Follow |
| 40 | profile page / friends page | `handleFollowAction` / `handleUnfollow` | `/api/followers/unfollow/${userId}` | DELETE | Bearer | `{message}` | Unfollow |
| 41 | `app/(pages)/user/[userId]/friends/page.js` | `fetchData` | `${BASE}/api/followers/followers/${userId}` | GET | Bearer optional | `{followers:[...]}` | Followers tab |
| 42 | same | `fetchData` | `${BASE}/api/followers/following/${userId}` | GET | Bearer optional | `{following:[...]}` | Following tab |

### Messages

| # | FILE | FUNCTION/COMPONENT | CURRENT ENDPOINT | METHOD | REQUEST BODY/PARAMS | EXPECTED RESPONSE | UI FEATURE |
|---|---|---|---|---|---|---|---|
| 43 | `sections/Navbar.js` | `checkAuthStatus` | `/api/messages/unread/count` | GET | Bearer | `{count}` | Unread badge |
| 44 | `app/(pages)/my/messages/page.js` | `fetchMessages` | `/api/messages` | GET | Bearer | `[{_id,senderId,receiverId,subject,content,isRead,isArchived,sender,receiver,createdAt}]` | Inbox/Sent/Archive |
| 45 | same | `markAsRead` | `/api/messages/${messageId}/read` | PATCH | `{}` + Bearer | message | Open message |
| 46 | same | `archiveMessage` | `/api/messages/${messageId}/archive` | PATCH | `{}` + Bearer | message | Archive |
| 47 | same | `unarchiveMessage` | `/api/messages/${messageId}/unarchive` | PATCH | `{}` + Bearer | message | Unarchive |
| 48 | `app/(pages)/my/messages/reply/[id]/page.js` | fetch original | `/api/messages/${id}` | GET | Bearer | message w/ `sender`,`receiver` | Reply view |
| 49 | same | `handleSubmit` | `/api/messages` | POST | `{receiverId,subject:"Re: …",content}` + Bearer | message | Send reply |
| 50 | `app/(pages)/compose/message/[userId]/page.js` | `handleSubmit` | `/api/messages` | POST | `{receiverId:int,subject,content}` + Bearer | message | Compose |

### Groups

| # | FILE | FUNCTION/COMPONENT | CURRENT ENDPOINT | METHOD | REQUEST BODY/PARAMS | EXPECTED RESPONSE | UI FEATURE |
|---|---|---|---|---|---|---|---|
| 51 | `app/(pages)/groups/page.js` | `fetchGroups` | `${BASE}/api/groups` | GET | none | `[group]` | Groups list |
| 52 | `app/(pages)/my/groups/page.js` | `fetchGroups` (filters client-side by decoded JWT userId) | `${BASE}/api/groups` | GET | none | `[group]` | My groups |
| 53 | `app/(pages)/my/groups/page.js`, `groups/group/[groupId]/page.js` | `handleJoin` | `${BASE}/api/groups/${groupId}/join` | POST | `{}` + Bearer | `{message}` | Join group |
| 54 | same two files | `handleLeave` | `${BASE}/api/groups/${groupId}/leave` | POST | `{}` + Bearer | `{message}` | Leave group |
| 55 | `app/(pages)/groups/group/[groupId]/page.js` | `fetchGroup` | `${BASE}/api/groups/${groupId}` | GET | Bearer optional | group w/ members | Group page |
| 56 | same | `handleUpdateSettings` | `${BASE}/api/groups/${groupId}` | PUT | `{name,description,isPublic}` + Bearer | `{message,group}` | Group settings (owner) |
| 57 | same | `handleRemoveMember` | `${BASE}/api/groups/${groupId}/members/${userId}` | DELETE | Bearer | `{message}` | Kick member (owner) |
| 58 | `app/(pages)/groups/create/page.js` | `handleSubmit` | `${BASE}/api/groups` | POST | `{name,description,isPublic}` + Bearer | group | Create group |

### Forum

| # | FILE | FUNCTION/COMPONENT | CURRENT ENDPOINT | METHOD | REQUEST BODY/PARAMS | EXPECTED RESPONSE | UI FEATURE |
|---|---|---|---|---|---|---|---|
| 59 | `app/(pages)/forum/home/page.js` | `fetchPosts` | `/api/forum` or `/api/forum?section=${encodeURIComponent(section)}` | GET | none | `[post]` | Forum index |
| 60 | `app/(pages)/forum/post/[id]/page.js` | `fetchPost` | `/api/forum/${id}` | GET | none | `{post:{postId,title,content,author,replies[],isLocked,isPinned,...}}` | Thread view |
| 61 | `app/(pages)/forum/new/reply/[id]/page.js` | `fetchPost` | `${BASE}/api/forum/${id}` | GET | Bearer | same | Reply page context |
| 62 | `app/(pages)/reportabuse/forum/[id]/page.js` | effect (×2) | `/api/forum/${id}` | GET | none | same | Show reported content |
| 63 | `app/(pages)/forum/new/post/page.js` | `handleSubmit` | `${BASE}/api/forum` | POST | `{title,section,content}` + Bearer | post | New thread |
| 64 | `app/(pages)/forum/post/[id]/page.js` | `handleReplySubmit` | `/api/forum/${id}/replies` | POST | `{content}` + Bearer | reply | Inline reply |
| 65 | `app/(pages)/forum/new/reply/[id]/page.js` | `handleSubmit` | `${BASE}/api/forum/${id}/replies` | POST | `{content}` + Bearer | reply | Reply page |
| 66 | `app/(pages)/forum/post/[id]/page.js` | `handleToggleLock` | `${BASE}/api/forum/${id}/lock` \| `/unlock` | PUT | Bearer | `{message,post:{postId,isLocked}}` | Mod: lock |
| 67 | same | `handleTogglePin` | `${BASE}/api/forum/${id}/pin` \| `/unpin` | PUT | Bearer | `{message,post:{postId,isPinned}}` | Mod: pin |

### Reports / moderation / admin

| # | FILE | FUNCTION/COMPONENT | CURRENT ENDPOINT | METHOD | REQUEST BODY/PARAMS | EXPECTED RESPONSE | UI FEATURE |
|---|---|---|---|---|---|---|---|
| 68 | `app/(pages)/reportabuse/userprofile/[userId]/page.js` | `handleSubmit` via `fetchWithAuth` | `http://localhost:5000/api/reports` (**`lib/auth.js` defaults to localhost if env unset**) | POST | `{reportedUserId:int,subject,description}` | `{message}` | Report user |
| 69 | `app/(pages)/reportabuse/forum/[id]/page.js` | `handleSubmit` via `fetchWithAuth` | `${API}/api/reports/forum` | POST | `{contentId,contentType:'post'|'reply',subject,description}` | `{message}` | Report forum content |
| 70 | `app/(pages)/admin/reports/page.js` | `fetchReports` | `${API}/api/reports` | GET | Bearer | `[report]` | Admin: user reports |
| 71 | same | `updateReportStatus` | `${API}/api/reports/${reportId}/status` | PUT | `{status}` | `{...}` | Admin: resolve |
| 72 | `app/(pages)/admin/reports/forum/page.js` | `fetchReports` | `${API}/api/reports/forum` | GET | Bearer | `[report]` | Admin: forum reports |
| 73 | same | `updateReportStatus` | `${API}/api/reports/forum/${reportId}/status` | PUT | `{status}` | `{...}` | Admin: resolve |
| 74 | `app/(pages)/admin/page.js` **and** `admin/dashboard/page.js` | `fetchUsers` | `${BASE}/api/admin/users` | GET | Bearer | `{users:[{userId,username,email,role,isBanned,...}]}` | Admin user table |
| 75 | same two files | `handleBanUser` | `${BASE}/api/admin/users/${userId}/ban` | PUT | `{reason,duration}` | `{message}` | Ban |
| 76 | same two files | `handleUnbanUser` | `${BASE}/api/admin/users/${userId}/unban` | PUT | `{}` | `{message}` | Unban |
| 77 | same two files | `handleChangeRole` | `${BASE}/api/admin/users/${userId}/role` | PUT | `{role:'admin'|'member'}` | `{message}` | Role change |

### Games / catalog / avatar / inventory / play

| # | FILE | FUNCTION/COMPONENT | CURRENT ENDPOINT | METHOD | … | UI FEATURE |
|---|---|---|---|---|---|---|
| — | `app/(pages)/games/page.js` | `Page` | **none** — hardcoded `GAMES_DATA` + fake 800 ms delay | — | — | Games grid |
| — | `app/(pages)/games/[id]/page.js` | `Page` | **none** — hardcoded `GAME_DATA` | — | — | Game details |
| — | `app/(pages)/games/[id]/page.js` | Play `onClick` | **none** — `setTimeout(showPlayModal, 2000)` | — | — | Play (fake) |
| — | `app/(pages)/user/[userId]/profile/page.js` | `ownerGames` | **none** — imports `games/data.js` | — | — | Profile "Places" |
| — | (missing) | — | no catalog / avatar / inventory API calls exist | — | — | — |

### Hardcoded external/server URLs in the frontend

| Location | Value |
|---|---|
| `src/config/api.config.js` | `https://alphablox-api.onrender.com`, `http://localhost:5000` |
| `src/lib/auth.js` | fallback `http://localhost:5000` |
| `next.config.mjs`, `vercel.json` | rewrites to `http://localhost:5000/api/*` / `https://alphablox-api.onrender.com/api/*` |
| `EXAMPLE.env.production` | `https://alphablox-api.onrender.com`, `https://alphablox-next.vercel.app` |
| `app/layout.js` | Google AdSense script with the donor author's `ca-pub-…` ID |
| `components/ParticlesBackground.js` | runtime-injected `https://cdn.jsdelivr.net/particles.js/2.0.0/particles.min.js` (no SRI) |
| many pages | hot-linked avatar fallbacks `https://www.nicepng.com/...bacon-hair...png`, `https://www.pngkit.com/...` |
| Navbar / Footer / Home / SiteAlert | donor's Discord / YouTube / Twitter / GitHub links |

---

## Replacement API map

New backend conventions (proposed):
- Session = **HttpOnly, Secure, SameSite=Lax cookie** holding an opaque server-side session id. No JWT in JS. CSRF token (double-submit or `Origin` check) on state-changing requests.
- One typed client in `web/src/lib/api/` — pages never call `axios`/`fetch` directly.
- IDs are opaque (UUID/ULID or int — pick one; the donor mixes numeric `userId` with Mongo `_id` for requests/messages).
- `me` is resolved server-side; the client never decodes a token to learn who it is.

| Old AlphaBlox endpoint | New endpoint | Notes |
|---|---|---|
| `POST /api/auth/register` | `POST /api/auth/register` | same body; server-side validation; captcha later |
| `POST /api/auth/login` | `POST /api/auth/login` | sets session cookie; response `{user}` only, **no token** |
| `POST /api/auth/logout` | `POST /api/auth/logout` | actually destroys server session |
| `GET /api/auth/checkAuth`, `GET /api/auth/check` | `GET /api/auth/me` | `{user:{id,username,theme,currency,role}}` or 401 |
| `POST /api/auth/verify-email` | `POST /api/auth/verify-email` | |
| `POST /api/auth/resend-verification` | `POST /api/auth/verify-email/resend` | |
| `POST /api/auth/forgot-password` | `POST /api/auth/password/forgot` | |
| `POST /api/settings/reset-password` | `POST /api/auth/password/reset` | `{token,newPassword}` |
| `POST /api/settings/request-password-reset` | `POST /api/auth/password/change` | require current password instead of emailing a link |
| `GET /api/auth/devices`, `POST /api/auth/trust-device` (server only) | `GET /api/auth/sessions`, `DELETE /api/auth/sessions/:id` | later |
| `GET /api/users` | `GET /api/users?query=&page=&limit=` | **server-side pagination/search**; never return all users |
| `GET /api/user/:userId/profile` | `GET /api/users/:id` | public; returns `isFriend`, `isFollowing`, `isSelf` computed server-side |
| `GET /api/blurb/:userId` | folded into `GET /api/users/:id` | |
| `PUT /api/blurb` | `PATCH /api/users/me` | `{blurb}` |
| `GET /api/settings/profile` | `GET /api/users/me/settings` | |
| `PUT /api/settings/profile` | `PATCH /api/users/me` | `{blurb,gender}` |
| `GET/PUT /api/settings/theme` | `PATCH /api/users/me` | `{theme}`; theme also returned by `/api/auth/me` |
| `GET /api/currency` | `GET /api/economy/balance` | `{currency,nextAward,canClaim}`; (optional) `POST /api/economy/daily-reward` |
| `GET /api/avatar/thumbnail/:userId?size=` | `GET /api/thumbnails/avatar/:userId?size=` | served from our own renderer/cache; never redirect to user-supplied URLs |
| `POST /api/avatar/update` (server only, `avatarUrl`) | `PUT /api/avatar` | body = item ids + body colors, **never a URL** |
| (none) | `GET /api/avatar` | current outfit + body colors |
| `GET /api/friend/list` | `GET /api/users/me/friends` | |
| `GET /api/friend/list/:userId` | `GET /api/users/:id/friends` | |
| `GET /api/friend/requests` | `GET /api/users/me/friend-requests` | |
| `GET /api/friend/status/:userId` | folded into `GET /api/users/:id` (`friendship:{status,requestId,direction}`) | |
| `POST /api/friend/request/:userId` | `POST /api/users/:id/friend-request` | |
| `POST /api/friend/accept/:requestId` | `POST /api/friend-requests/:requestId/accept` | |
| `POST /api/friend/decline/:requestId` | `POST /api/friend-requests/:requestId/decline` | replaces dynamic `/api/friend/${action}/…` |
| `DELETE /api/friend/unfriend/:userId` | `DELETE /api/users/:id/friend` | |
| `GET /api/followers/counts/:userId` | folded into `GET /api/users/:id` | |
| `GET /api/followers/status/:userId` | folded into `GET /api/users/:id` | |
| `POST /api/followers/follow/:userId` | `POST /api/users/:id/follow` | |
| `DELETE /api/followers/unfollow/:userId` | `DELETE /api/users/:id/follow` | |
| `GET /api/followers/followers/:userId` | `GET /api/users/:id/followers` | paginated |
| `GET /api/followers/following/:userId` | `GET /api/users/:id/following` | paginated |
| `GET /api/messages` | `GET /api/messages?box=inbox|sent|archive&page=` | |
| `GET /api/messages/:id` | `GET /api/messages/:id` | |
| `GET /api/messages/unread/count` | `GET /api/messages/unread-count` | or folded into `/api/auth/me` `notifications` |
| `POST /api/messages` | `POST /api/messages` | `{recipientId,subject,body}` |
| `PATCH /api/messages/:id/read` | `PATCH /api/messages/:id` | `{read:true}` |
| `PATCH /api/messages/:id/archive` \| `/unarchive` | `PATCH /api/messages/:id` | `{archived:true|false}` |
| `GET /api/groups` | `GET /api/groups?query=&page=` | |
| (client-side filter) | `GET /api/users/me/groups` | replaces JWT-decode filtering |
| `GET /api/groups/:id` | `GET /api/groups/:id` | |
| `POST /api/groups` | `POST /api/groups` | |
| `PUT /api/groups/:id` | `PATCH /api/groups/:id` | |
| `POST /api/groups/:id/join` \| `/leave` | `POST /api/groups/:id/membership` / `DELETE /api/groups/:id/membership` | |
| `DELETE /api/groups/:id/members/:userId` | `DELETE /api/groups/:id/members/:userId` | |
| `GET /api/forum[?section=]` | `GET /api/forum/threads?section=&page=` | |
| `GET /api/forum/:id` | `GET /api/forum/threads/:id` | replies paginated |
| `POST /api/forum` | `POST /api/forum/threads` | |
| `POST /api/forum/:id/replies` | `POST /api/forum/threads/:id/replies` | |
| `PUT /api/forum/:id/lock|unlock|pin|unpin` | `PATCH /api/forum/threads/:id` | `{locked?,pinned?}`; moderator role |
| `POST /api/reports` | `POST /api/reports` | `{targetType:'user'|'forum_thread'|'forum_reply'|'game'|'item',targetId,reason,details}` |
| `POST /api/reports/forum` | `POST /api/reports` | unified |
| `GET /api/reports`, `GET /api/reports/forum` | `GET /api/admin/reports?type=&status=` | |
| `PUT /api/reports/:id/status`, `PUT /api/reports/forum/:id/status` | `PATCH /api/admin/reports/:id` | `{status}` |
| `GET /api/admin/users` | `GET /api/admin/users?query=&page=` | |
| `PUT /api/admin/users/:id/ban` | `POST /api/admin/users/:id/ban` | `{reason,expiresAt}`; audit log |
| `PUT /api/admin/users/:id/unban` | `DELETE /api/admin/users/:id/ban` | |
| `PUT /api/admin/users/:id/role` | `PUT /api/admin/users/:id/role` | role enum validated; audit log |
| (hardcoded `GAMES_DATA`) | `GET /api/games?sort=&genre=&page=` | |
| (hardcoded `GAME_DATA[id]`) | `GET /api/games/:id` | includes `playing`, `visits`, `maxPlayers`, creator |
| (none) | `GET /api/games/:id/servers` | "Servers" card on game page |
| (fake Play) | **`POST /api/games/:id/join`** | see §D |
| (none, launcher) | `POST /api/launcher/ticket/resolve` | launcher exchanges ticket → `{host,port,…}` (see §D) |
| (none, RFD server→backend) | `POST /api/gameserver/ticket/redeem` | RFD validates & burns ticket; server-to-server auth |
| (profile `ownerGames` from data.js) | `GET /api/users/:id/games` | |
| (none; `/catalog` 404) | `GET /api/catalog?category=&page=` | |
| (none) | `GET /api/catalog/:id` | |
| (none) | `POST /api/catalog/:id/purchase` | idempotency key; transactional balance debit |
| (none; `/my/avatar` 404) | `GET /api/avatar` / `PUT /api/avatar` | |
| (mock items on profile) | `GET /api/inventory?type=&page=` and `GET /api/users/:id/inventory` | |
| `GET /asset/characterfetch.ashx`, `GET /asset/?id=` (server, RCC) | **not in web API** — owned by the RFD layer (§F) | |

---

## C. KEEP / MODIFY / REWRITE / REMOVE

### Root / repo-level

| Path | Verdict | Reason |
|---|---|---|
| `2015/` (all 269 MB: `RccService.exe`, `patchedrcc.exe`, `newrccpatched.exe`, `rblx16.exe`, `0.270.0.30605.exe`, DLLs, content, shaders, `render.lua`, `gameserver.txt`, `AppSettings.xml`) | **REMOVE** | Old 2015/2016 RCC + client binaries of unknown provenance (two are "patched"); we use RFD v347 instead. Never execute. |
| `server/` (entire tree) | **REMOVE** | Old Express/Mongo backend, JWT-in-localStorage auth, RCC hooks. Replaced by `api/`. Use only as a *spec reference* for response shapes. |
| `server/EXAMPLE.env` | **REMOVE** (and rotate) | Contains apparently real credentials (§E-1). |
| `server/assetthumbnailrenderer.lua` | **REMOVE** | RCC thumbnail script pointing at a third-party host. |
| `update-admin-role.js` | **REMOVE** | One-off DB script; admin bootstrap will be a CLI in `api/`. |
| root `package.json` (`soap`, `xml2js`, `xmldom`) | **REMOVE** | RCC SOAP deps, `xmldom@0.6` has known advisories. |
| `.idea/`, `.trae/` | **REMOVE** | Editor/AI config. (Keep the "Bootstrap 5" convention in our own CONTRIBUTING.) |
| `README.md`, `Readmecontent/` | **REMOVE** | Donor-specific. |

### client/ config

| Path | Verdict | Reason |
|---|---|---|
| `client/package.json` | **MODIFY** | Keep Next/React/Bootstrap/bootswatch/icons; upgrade `next` (audit: critical), drop `axios`, `jwt-decode`, `lodash`, `font-awesome@4` (dup of `@fortawesome`), `leo-profanity` (move to API); run `npm audit`. |
| `client/next.config.mjs` | **REWRITE** | Rewrites point at onrender/localhost:5000; add security headers/CSP; stop ignoring ESLint in builds. |
| `client/vercel.json` | **REMOVE** | Donor deployment. |
| `client/EXAMPLE.env.*` | **REWRITE** | New `API_ORIGIN` (server-only) instead of `NEXT_PUBLIC_API_URL`. |
| `client/jsconfig.json`, `.eslintrc.json`, `.gitignore` | **KEEP** (MODIFY lightly) | Fine; consider TS migration later. |
| `client/config/metadata.js` | **MODIFY** | Rebrand name/URLs. |
| `client/public/images/*` | **MODIFY** | Keep generic UI art (`rollercoaster.png`, `herocity.jpg`, `default_place.png`, etc.); remove donor branding (`ValkLogo.png`, `Valkyrie404.png`) and any Roblox-copyrighted art you don't want to ship; self-host a default avatar to replace nicepng/pngkit hotlinks. |
| `client/public/ads.txt` | **REMOVE** | AdSense leftover. |
| `client/public/particles.json` | KEEP (optional) | Only if particles background is kept. |
| `client/src/fonts/*` | KEEP | Unused Geist fonts — remove if unused. |

### client/src — shell, UI, styles

| Path | Verdict | Reason |
|---|---|---|
| `app/layout.js` | **MODIFY** | Keep structure (Navbar/Footer/Theme/Bootstrap); **remove AdSense script**, unused `ParticlesBackground` import, `next/head` in App Router. |
| `app/providers.js` | KEEP | Bootstrap JS loader. |
| `app/globals.css`, `app/page.module.css` | KEEP | Pure styles. |
| `app/page.js` | **MODIFY** | Decide redirect from `/api/auth/me` (or server component + cookie) instead of localStorage. |
| `app/error.js`, `app/not-found.js`, `app/(errors)/*` | KEEP | Pure UI (rebrand text/images). |
| `sections/Navbar.js` | **MODIFY** | Keep markup; replace `authService`/raw `fetch` with new API client; remove 404 links or build pages; tooltip `html:true` → `false`; self-host default avatar. |
| `sections/Footer.js` | **MODIFY** | Rebrand social links. |
| `components/UserSubmenu.js` | KEEP (MODIFY links) | Pure UI; links to `/my/avatar`, `/create`, `/money` need real pages. |
| `components/Alerts/SiteAlert.js` | **MODIFY** | Donor recruitment message → our own content (ideally from API). |
| `components/Alerts/ForumAlert.js` | KEEP | Pure UI. |
| `components/ParticlesBackground.js` | **MODIFY or REMOVE** | Injects third-party script from jsDelivr w/o SRI; bundle via npm or drop. Currently unused. |
| `components/AuthProtection.js` | **REWRITE** | Client-only guard; replace with Next middleware / server component session check + server-side authz. |
| `components/ResendVerification.js` | **MODIFY** | Keep UI, swap endpoint. |
| `contexts/ThemeContext.js`, `hooks/useTheme.js` | **MODIFY** | Keep; theme from `/api/auth/me` + `PATCH /api/users/me`. |
| `lib/utils/dateUtils.js`, `wordValidation.js` | KEEP | Pure helpers (profanity must also be enforced server-side). |
| `lib/utils/textHelper.js` | **MODIFY** | `linkifyText`+DOMPurify is OK-ish but upgrade DOMPurify and prefer rendering links as React elements (no `dangerouslySetInnerHTML`). |
| `lib/utils/errorHandler.js` | KEEP (MODIFY) | Generic; adjust 401 handling to new session model. |

### client/src — API layer

| Path | Verdict | Reason |
|---|---|---|
| `config/api.config.js` | **REWRITE** | Hardcoded onrender/localhost URLs. |
| `services/authService.js` | **REWRITE** | JWT + user object in localStorage; logs plaintext credentials. |
| `services/userService.js` | **REWRITE** | Raw fetch with localStorage bearer. |
| `lib/auth.js` (`fetchWithAuth`) | **REWRITE** | localStorage JWT, logs token prefix, localhost fallback, accepts absolute URLs. |
| `src/api/route.js` | **REMOVE** | Dead (not under `app/`), forwards cookies to arbitrary `NEXT_PUBLIC_API_URL`. |

### client/src — pages

| Path | Verdict | Reason |
|---|---|---|
| `(auth)/login`, `(auth)/signup` | **MODIFY** | Keep forms/markup; new endpoints; cookie session; remove console logging. |
| `(auth)/forgot-password`, `reset-password`, `verify-email` | **MODIFY** | Keep UI; new endpoints; stop logging reset token. |
| `(support)/*` | KEEP (MODIFY copy) | Static content; rewrite legal text for our project. |
| `home/page.js` | **MODIFY** | Keep dashboard UI; new API client; avatar from our thumbnail service. |
| `games/page.js` | **MODIFY** | Keep grid/sidebar/skeleton UI; replace `GAMES_DATA` with `GET /api/games`. |
| `games/[id]/page.js` | **REWRITE (logic) / KEEP (markup)** | Hardcoded data, fake Play, hooks called after early return (Rules-of-Hooks bug). New Play flow (§D). |
| `games/data.js` | **REMOVE** | Mock data. |
| `user/[userId]/profile/page.js` | **MODIFY** | Keep layout; single `GET /api/users/:id`; remove JWT `atob` decoding; replace mock avatar items with `/api/users/:id/inventory`; places from `/api/users/:id/games`. |
| `user/[userId]/friends/page.js` | **MODIFY** | Keep tabs UI; new endpoints; replace dynamic `${action}` URL. |
| `users/page.js` | **MODIFY** | Keep UI; server-side search/paging. |
| `my/messages/*`, `compose/message/[userId]` | **MODIFY** | Keep UI; new endpoints; remove `atob(token)` userId extraction. |
| `groups/*`, `my/groups` | **MODIFY** | Keep UI; new endpoints; `/api/users/me/groups`. |
| `forum/*` | **MODIFY** | Keep UI; new endpoints; remove hardcoded `userId === 1 || 2` admin check; safe link rendering. |
| `reportabuse/*` | **MODIFY** | Keep UI; unified `POST /api/reports`. |
| `settings/page.js` | **MODIFY** | Keep UI; new endpoints; add "change password (current+new)". |
| `admin/page.js` | **REWRITE** | Merge with dashboard; admin UI must be behind server-enforced role check; audit log. |
| `admin/dashboard/page.js` | **REMOVE** | Near-duplicate of `admin/page.js`. |
| `admin/reports/*` | **MODIFY** | Keep tables; new admin endpoints. |
| `admin/layout.js` | **REWRITE** | Add server-side role gate. |
| (new) `catalog/`, `catalog/[id]/`, `my/avatar/`, `my/inventory/` | **NEW** | Don't exist in donor; build in the same Bootstrap/cosmo style. |

---

## D. Play-flow trace

### Current donor flow (entirely client-side, no backend, no launcher)

```
/games                          client/src/app/(pages)/games/page.js
  └─ <Link href={`/games/${game.id}`}>   (GAMES_DATA hardcoded, lines ~7-10)

/games/[id]                     client/src/app/(pages)/games/[id]/page.js
  ├─ const game = GAME_DATA[id]           (hardcoded, lines ~6-34)
  ├─ Play button (inline, no component)   <button className="btn btn-success ..." onClick=...>
  │     onClick={() => { setIsPlaying(true); setTimeout(() => setShowPlayModal(true), 2000); }}
  ├─ frontend API request:                NONE
  ├─ old backend endpoint:                NONE
  ├─ launcher / protocol invocation:      NONE (no roblox-player:, no custom scheme, no window.location)
  └─ showPlayModal → "Launch Game" modal: "the AlphaBlox client is required… still under development"
                                          with a *disabled* "Download Client" button.

client/src/app/(pages)/user/[userId]/profile/page.js
  └─ "Places" tab: <Link href={`/games/${g.id}`} className="btn btn-success ...">  → same page above
```

Backend side: `server/src/server.js` has **no** games, places, join, ticket, or gameserver routes. The only
"game" code is RCC rendering leftovers: `server/src/routes/asset.js` (`/asset/characterfetch.ashx`, `/asset/?id=11911558`
→ serves `2015/.../face.png`), unmounted `server/src/routes/avatar.js` (requires missing `services/rccService.js`),
and `2015/0.206.0.62042/gameserver.txt` / `render.lua` (identical thumbnail-render Lua, `baseUrl = http://localhost:5000`,
`userId = 1818`). **There is nothing to migrate for Play — it's a greenfield replacement point.**

### Where to replace it

Replace in `client/src/app/(pages)/games/[id]/page.js` (→ `web/src/app/(pages)/games/[id]/page.js`):
1. Move all hooks above the `if (!game)` early return (current code violates Rules of Hooks).
2. Load `game` from `GET /api/games/:id` instead of `GAME_DATA`.
3. Extract the Play button into `web/src/components/games/PlayButton.js` with states: idle → requesting ticket → launching → "didn't launch? download launcher" modal (reuse the existing modal markup).

### Target flow

```
PlayButton onClick
  → POST /api/games/:id/join          (cookie session + CSRF; body {} or {serverId?})
      backend:
        1. verify session, user not banned, game exists & is playable
        2. choose RFD server (least-loaded healthy instance for this place, or allocate one)
        3. ticket = base64url(crypto.randomBytes(32))     # 256-bit
           store sha256(ticket) → {userId, gameId, serverId, expiresAt=now+60s, usedAt=null, ipHint?}
        4. rate-limit per user
      ← 200 { launchUrl: "ourrevival://join?ticket=<ticket>" }   (no host/port in the browser)
  → window.location.href = launchUrl   (fallback timer shows "Install launcher" modal)

launcher (registered handler for ourrevival://)
  → strictly parse URL: scheme == ourrevival, action == join, ticket matches ^[A-Za-z0-9_-]{43}$; reject everything else
  → POST https://api.<domain>/api/launcher/ticket/resolve  {ticket}
      backend: atomically check unexpired & unresolved → returns {host, port, rfdVersion:"v347"} (does NOT burn it yet)
  → spawn RFD player via argv array (no shell): Player.exe -h <host> -p <port> -u <ticket>
      host/port must come from the API response and be validated (allowlist of our server hosts / numeric port)

RFD server on player connect
  → POST /api/gameserver/ticket/redeem {ticket, serverId}  (mTLS or per-server HMAC key)
      backend: atomic UPDATE … SET usedAt=now WHERE hash=? AND usedAt IS NULL AND expiresAt>now AND serverId=?
      ← {userId, username, appearance, membership}  or 403
  → RFD admits the player with the identity from the API, never from client-supplied name/userId.
```

---

## E. Security findings (defensive, not exploited)

Severity: 🔴 critical · 🟠 high · 🟡 medium · ⚪ low/info

| # | Sev | Where | Finding | Action |
|---|---|---|---|---|
| 1 | 🔴 | `server/EXAMPLE.env` | Committed file contains what appear to be **real** credentials: a Gmail address + Gmail app password (`EMAIL_USER`/`EMAIL_PASS`) and a MongoDB Atlas SRV URI with embedded username:password (`MONGODB_URI`). Values intentionally not reproduced here. | Never copy. Treat as leaked (donor owner should rotate). Our repo: add secret scanning, never commit `.env*` other than placeholder examples. |
| 2 | 🔴 | `2015/0.206.0.62042/*.exe`, `*.dll` | Opaque RCC/client binaries, two explicitly "patched" (`patchedrcc.exe`, `newrccpatched.exe`), plus `VMProtectSDK32.dll`, NPAPI plugins (`NPRobloxProxy*.dll`). Unknown provenance; RCC executes Lua fetched over HTTP. | REMOVE; never run. RFD replaces this. |
| 3 | 🔴 | `client/package.json` → `next@15.0.7` | `npm audit` flags `next` as **critical** (range 9.3.4-canary.0 – 16.3.0-preview.10), plus axios (high), lodash (high), form-data (critical), dompurify (moderate), follow-redirects, nanoid, @babel/runtime. 10 vulns total (2 critical, 5 high). | Upgrade Next to latest patched release before shipping; drop axios/lodash; re-audit. |
| 4 | 🟠 | `services/authService.js`, `lib/auth.js`, every page | **JWT stored in `localStorage`** (`auth_token`) and sent as Bearer; any XSS = full account takeover. Token lifetime 24h, no revocation; logout is a no-op server-side. | New HttpOnly session cookie, server-side revocation. |
| 5 | 🟠 | `services/authService.js` `login()` | `console.log('Attempting login with:', credentials)` — logs **plaintext username+password** to the browser console; also logs full login response incl. token. | Don't copy; strip all auth logging. |
| 6 | 🟠 | `lib/auth.js` `fetchWithAuth` | Logs first 10 chars of the token; accepts absolute URLs (`url.startsWith('http') ? url : …`) and attaches the Bearer token to *any* host → token exfiltration if a URL is ever user-influenced. Falls back to `http://localhost:5000`. | Rewrite: fixed origin only. |
| 7 | 🟠 | `forum/post/[id]/page.js` L284, L385 | `dangerouslySetInnerHTML={{__html: linkifyText(content)}}` on user content. Mitigated by DOMPurify allowlist (`a` + `href/target/rel/class`) but DOMPurify version is flagged (GHSA-v8jm…, GHSA-v2wj…), and URL regex + string concat into `href` is fragile. | Render links as React `<a>` elements from a tokenizer; no raw HTML. |
| 8 | 🟠 | `server/src/routes/avatar.js` `POST /update` + `GET /thumbnail` | Stores arbitrary user-supplied `avatarUrl` and later `res.redirect(user.avatar)` → **open redirect / tracking pixel**. Client renders `profile.avatar`/`friend.avatar` as `<img src>` from arbitrary origins. | Avatars = our rendered thumbnails only. |
| 9 | 🟡 | `server/src/middleware/adminProtection.js`; `forum/post/[id]/page.js` | **Hardcoded privileged IDs**: `userId === 1 || userId === 2` grants admin regardless of role (server) and UI admin controls (client). `admin/role` route: only `userId === 1` can change roles. `update-admin-role.js` promotes userId 1. | Role/permission table only; bootstrap admin via CLI. |
| 10 | 🟡 | `app/(pages)/admin/*`, `admin/layout.js` | No route guard at all on admin UI; relies on API 403. Admin pages decode nothing and render the full user table (incl. emails) if API allows. | Server-side gate + audit log. |
| 11 | 🟡 | many pages (`my/messages`, `profile`, `groups`, `forum`) | **Client-side JWT decoding** (`JSON.parse(atob(token.split('.')[1]))`, `jwtDecode`) to determine identity / `isOwnProfile` / admin. Trusting unverified client data for UI decisions. | Identity from `/api/auth/me`; ownership flags computed server-side. |
| 12 | 🟡 | `app/layout.js` | Google AdSense `<script>` with the donor author's publisher ID; `components/ParticlesBackground.js` runtime-injects jsDelivr script without SRI. Third-party JS + localStorage JWT = token exposure. | Remove; strict CSP. |
| 13 | 🟡 | `server/src/server.js` global error handler | Logs full `req.body` (incl. passwords on auth errors) and returns `err.message` to client. `authProtection.js` logs `JWT_SECRET` length and usernames. `settings.js` logs the **password reset token**. | Structured logging with redaction. |
| 14 | 🟡 | `server/src/routes/asset.js`, `2015/.../gameserver.txt`, `render.lua`, `server/assetthumbnailrenderer.lua` | Legacy RCC asset endpoints mounted at `/`; thumbnail Lua sets `ContentProvider` base URL, enables `HttpService`, and points at a third-party host (`http://mete0r.xyz`). RCC SOAP deps in root `package.json`. | REMOVE. RFD's asset serving is a separate, sandboxed service. |
| 15 | 🟡 | `server/src/routes/users.js` / `GET /api/users` | Returns **every user** in one response; client paginates. User enumeration + scaling issue. | Server-side paging, rate limit. |
| 16 | 🟡 | `user/[userId]/friends/page.js` `handleFriendAction` | URL built from a caller-supplied action name: `/api/friend/${action}/${requestId}` — the "method name in the path" pattern. Harmless today (only UI passes `accept`/`decline`), but it's the shape of ECS-style dynamic dispatch. | Explicit functions per action; server never dispatches on user-provided method names. |
| 17 | ⚪ | Navbar Bootstrap tooltip `html: true` | Tooltip renders server-provided time string as HTML. Low risk now. | `html:false`. |
| 18 | ⚪ | `server/src/services/userService.js` | Device fingerprint via MD5 of UA/IP. | N/A (removed). |
| 19 | ⚪ | `next.config.mjs` | `eslint.ignoreDuringBuilds: true` hides bugs (e.g. Rules-of-Hooks violation in `games/[id]/page.js`). | Re-enable lint in CI. |
| 20 | ⚪ | `withCredentials: true` + server CORS `credentials:true` with `!origin → allow` | Cookie auth not actually used today, but if cookies are added naïvely this CORS config allows credentialed no-origin requests. | New API: same-site deployment, explicit origin allowlist, CSRF. |

**Not found** (searched client + server): `eval(`, `new Function`, `child_process`, `exec`/`spawn`, `fs` writes from request data, file-upload handlers (no multer/busboy), path joins from request params (asset route uses a fixed path), WebSockets/socket.io, server-side fetching of user-supplied URLs, dynamic `require`, or ECS/Bubba-style RPC dispatch (`obj[req.body.method](...)`). The donor's Express backend is a conventional REST app; its main risks are auth design, secrets hygiene, and the RCC binaries — not RCE-style dynamic dispatch.

---

## F. Migration plan

### Proposed project tree

```
revival/
├── web/                          ← from alphablox-next/client (UI only)
│   ├── package.json              (from client/package.json, deps trimmed/upgraded)
│   ├── next.config.mjs           (rewritten: security headers, CSP, API rewrite to our api/)
│   ├── jsconfig.json  .eslintrc.json  .gitignore
│   ├── config/metadata.js        (rebranded)
│   ├── public/images/            (subset of client/public/images, rebranded, self-hosted default avatar)
│   └── src/
│       ├── app/                  (from client/src/app — layout, globals.css, page.module.css, providers.js,
│       │   │                      error/not-found, (errors)/, (pages)/(auth), (support), home, games, user,
│       │   │                      users, my, compose, groups, forum, reportabuse, settings, admin (rewritten))
│       │   └── (pages)/catalog/ , (pages)/my/avatar/ , (pages)/my/inventory/   ← NEW
│       ├── sections/             Navbar.js, Footer.js
│       ├── components/           Alerts/, UserSubmenu.js, ResendVerification.js,
│       │                         games/PlayButton.js (NEW), catalog/*, avatar/* (NEW)
│       ├── contexts/ hooks/      ThemeContext.js, useTheme.js
│       └── lib/
│           ├── api/              NEW typed client: auth.js users.js games.js catalog.js avatar.js inventory.js
│           │                     friends.js messages.js groups.js forum.js reports.js admin.js
│           └── utils/            dateUtils.js errorHandler.js textHelper.js wordValidation.js
├── api/                          NEW backend (Node/TS e.g. Fastify or NestJS; or Go) — no donor code
│   ├── src/modules/{auth,users,friends,follows,messages,groups,forum,reports,admin,
│   │               games,servers,tickets,catalog,avatar,inventory,economy,thumbnails}
│   ├── src/middleware/{session,csrf,rateLimit,requireRole}
│   └── src/internal/{launcher,gameserver}   ← ticket resolve/redeem, server-to-server auth
├── database/                     NEW: migrations + seed (PostgreSQL recommended; replaces Mongo models)
│   └── migrations/  seeds/
├── launcher/                     NEW: ourrevival:// protocol handler, installer, RFD bootstrap
├── rfd/                          RFD v347 integration: server config, ticket-validation hook,
│                                 asset/character endpoints, deploy scripts (no AlphaBlox code)
├── shared/                       API schemas (zod/OpenAPI), constants, types used by web+api+launcher
├── infra/                        docker-compose, reverse proxy, CI (lint, audit, secret scan)
└── docs/                         this file, ADRs, security model
```

### What moves into `web/` (exact)

| From (alphablox-next) | To (revival) | Action |
|---|---|---|
| `client/src/app/**` except `games/data.js`, `admin/dashboard/` | `web/src/app/**` | copy, then MODIFY per §C |
| `client/src/sections/Navbar.js`, `Footer.js` | `web/src/sections/` | copy + modify |
| `client/src/components/Alerts/*`, `UserSubmenu.js`, `ResendVerification.js` | `web/src/components/` | copy + modify |
| `client/src/components/AuthProtection.js` | — | replaced by middleware/server gate |
| `client/src/components/ParticlesBackground.js` | — (or `web/src/components/` after bundling locally) | optional |
| `client/src/contexts/ThemeContext.js`, `client/src/hooks/useTheme.js` | `web/src/contexts/`, `web/src/hooks/` | copy + modify |
| `client/src/lib/utils/*` | `web/src/lib/utils/` | copy (textHelper modified) |
| `client/src/services/*`, `client/src/config/api.config.js`, `client/src/lib/auth.js`, `client/src/api/route.js` | — | replaced by `web/src/lib/api/*` |
| `client/src/app/globals.css`, `page.module.css`, `client/src/fonts/*` | `web/src/app/`, `web/src/fonts/` | copy |
| `client/public/images/*` (curated), `particles.json` | `web/public/` | copy subset |
| `client/config/metadata.js`, `jsconfig.json`, `.eslintrc.json`, `.gitignore`, `package.json` | `web/` | copy + modify |
| everything else (`server/`, `2015/`, root files, `.idea`, `.trae`, `vercel.json`, `ads.txt`) | — | not copied |

### Phased order

1. **Scaffold** `revival/` tree; CI with lint, `npm audit`, secret scanning; no donor secrets ever enter history.
2. **Import web/** (copy per table above, upgrade Next, remove AdSense/particles/hotlinks). Build passes with API calls stubbed.
3. **`web/src/lib/api/` client** matching the replacement map; migrate pages one area at a time: auth → users/profile → friends/follows → messages → groups → forum → reports → admin.
4. **`api/` + `database/`**: auth (cookie sessions, argon2id, email verify, reset), users, social, forum, moderation, admin with audit log.
5. **Games**: `GET /api/games`, `GET /api/games/:id`, `GET /api/games/:id/servers`; wire `/games` and `/games/[id]`; fix hooks bug; `PlayButton`.
6. **Tickets**: `POST /api/games/:id/join`, `POST /api/launcher/ticket/resolve`, `POST /api/gameserver/ticket/redeem`; server registry for RFD instances.
7. **Launcher**: `ourrevival://` handler, strict parsing, argv-only spawn of RFD player.
8. **RFD**: ticket validation on join, identity from API, server heartbeat/registration.
9. **Catalog / avatar / inventory / economy** + thumbnail rendering (isolated worker; no user-supplied URLs).

Nothing beyond this document has been changed. Awaiting instruction before starting step 1.
