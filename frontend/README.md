# Weave · Personal Planet

Responsive homepage with eight distinct regions, procedural terrain, coasts, island chains, polar ice and primitive landmarks. Existing Python backend is independent and unchanged.

Use Node.js 24.19.0 LTS. The supported project range is Node.js 22.13+ and
below Node.js 25; `.nvmrc` pins the local and Cloudflare Workers Builds version.

```sh
cd frontend
npm install
npm run dev
```

Open http://127.0.0.1:3000. Drag to rotate; hover a continent or focus a region button to inspect. Pause and reset controls are below the globe. Reduced-motion preference disables automatic rotation. Region buttons inspect only; content routes are not connected.

```sh
npm run typecheck
npm test
npm run build
```

## Cloudflare Workers deployment spike

The frontend is prepared for Cloudflare Workers through OpenNext. The existing
Next.js development and production commands are unchanged; this adapter adds a
separate Worker build without changing UI, mock data, or the Python backend.

```sh
npm run cf:build
npm run cf:preview
```

`cf:deploy` is intentionally available but must only be run after a Worker and
Git integration are configured in Cloudflare. The Worker project name is
`weave-personal-planet`; update it only if that name is unavailable in the
target Cloudflare account.

For GitHub auto-deploy, connect `viewNan/Weave`, set the root directory to
`frontend`, use `npm run cf:build` as the build command, and use
`npx wrangler deploy` as the deploy command. Cloudflare reads `.nvmrc` during
the build; no build variables are required for this phase.

World data and authored coastlines: `lib/world.ts`. Spherical area calibration and terrain: `lib/terrain.ts`. Rendering: `components/Planet.tsx`; geometric landmarks: `components/Landmarks.tsx`. Design instructions: `../skills/personal-planet-ui/SKILL.md`.

Area targets are 60% ocean / 32% land / 8% ice. The brief's incomplete land percentages are treated as relative weights and normalized to the 32% land budget. Tests verify calibrated spherical areas, island counts, mesh budget, above-water vertices and non-overlapping distribution using 24,000 sphere samples. Familiarity currently uses authored defaults, not usage history.

Google Fonts is optional; system fonts remain available offline. WebGL is required for the interactive scene; an explanatory fallback is shown if unavailable.

## Web Push preview setup

The `/push` page is a small iPhone PWA notification test surface. It registers
`/sw.js`, requests notification permission only after **开启通知** is clicked,
stores the subscription in D1, and sends a test push to that same subscription.
It does not add scheduling, authentication, or any change to the Python/Postgres
backend.

1. Create a **preview** D1 database, for example `weave-push-preview`, then
   replace `REPLACE_WITH_D1_DATABASE_ID` in `wrangler.jsonc`. Do not create or
   bind a production database in this phase.
2. Apply the checked-in migration with `npx wrangler d1 migrations apply
   weave-push-preview --remote`.
3. Generate a VAPID key pair, for example with `npx web-push generate-vapid-keys`.
   `VAPID_PUBLIC_KEY` and `VAPID_SUBJECT` are normal Worker variables.
   `VAPID_PRIVATE_KEY` must be a Cloudflare Secret (`npx wrangler secret put
   VAPID_PRIVATE_KEY`); never commit it. Add all three to `.dev.vars` for local Worker
   preview. The public key endpoint makes the public key available to the PWA at
   runtime, so no `NEXT_PUBLIC_` build variable is needed.
4. Run `npm run cf:build`, then deploy the branch preview through the configured
   Git integration, or use `npx wrangler deploy` after the preview binding and
   secrets exist. Do not run `cf:deploy` until you approve that external change.

On an iPhone running iOS 16.4 or newer, open the HTTPS preview in Safari, use
Share → Add to Home Screen, then launch Weave from its new icon. Open `/push`,
tap **开启通知**, allow notifications, and tap **发送测试通知**. Close the web
app and repeat the test: the system notification should still arrive. The
remaining platform constraint is Apple’s: iOS Web Push works only for a Home
Screen web app on iOS 16.4+, over HTTPS; it cannot be validated against
`localhost` from an iPhone.

## Eat storage and reliability

Eat uses the existing `PUSH_SUBSCRIPTIONS_DB` D1 binding, not the separate
Python/PostgreSQL knowledge backend. Local development uses persistent local D1
under `.wrangler/state/v3`; an empty local database is not production data.
Before `npm run dev`, apply local migrations from `frontend`:

```sh
npx wrangler d1 migrations apply weave-push-production --local
```

Use `.dev.vars.example` as the configuration reference. `OPENAI_API_KEY` enables
generation; missing configuration or provider failures never produce mock menus.
Production also requires an unpredictable `EAT_ADMIN_TOKEN` of at least 32
characters, supplied as a Worker Secret, never committed. The unlock form creates
an eight-hour signed HttpOnly session; mutating requests require the same Origin.
Only loopback `next dev` bypasses login. Production fails closed if the secret is
missing. This protects Eat routes, not the entire Console or other existing APIs.

Before publishing this version, back up the target database, configure the secret,
apply `0006_recipe_reliability.sql` to the intended remote database, build, and
verify unauthorized requests are denied. Local migration does not migrate remote
D1. No deployment is implied by these instructions.

- Recommendations and actual meals are independent. One active main meal per
  date is enforced in SQL. Clearing archives it; duplicate legacy rows are also
  archived, not deleted. Edits use record ID and revision to reject stale writes.
  Replacing a meal clears its old score and source references; typo correction
  preserves them. Ratings are nullable integers from 1 to 5.
- Memory is rebuilt from active meals in the last 90 calendar days: the latest
  14 records plus exact-dish counts, rating counts/averages and last-eaten dates.
  Explicit preferences (`features/recipes/config/recipe-preferences.ts`), monthly
  seasonal data and up to 50 library entries are separate inputs. Preferences
  currently remain unset; the private Markdown file is not read automatically.
  Ratings never automatically overwrite preferences. No vector store is needed.
- Each successful recommendation saves its versioned input snapshot and model
  response ID alongside three validated candidates. Later meal corrections affect
  the next generation, not an already-saved menu or its audit snapshot. Editing
  does not currently retain every prior revision as an event history.
- Generation claims are persisted by date and fenced by owner. Failures require
  manual retry after 60 seconds; stalled claims after five minutes; at most three
  attempts per day. An uncertain remote request may still have incurred cost.
  Switching candidates only saves the index. Push is claimed once; unknown
  delivery results are not automatically replayed.
- `npm test` includes real SQLite migration/storage checks and a simulated model
  provider for concurrency, failure, parsing and session checks. These do not
  prove live API availability or device push delivery.

Responses parsing follows the official [text output structure](https://developers.openai.com/api/docs/guides/text)
and [structured outputs guidance](https://developers.openai.com/api/docs/guides/structured-outputs).

## Reusable backend notifications (service usage)

Server-side code can call `NotificationService.send({ title, body, url?, type?,
metadata? })`. It fans out to every active D1 subscription and removes endpoints
when the provider returns 404 or 410. `userId` and `deviceId` are reserved for a
future directed-delivery schema.

For a trusted PC or automation, set `INTERNAL_API_TOKEN` as a Cloudflare Secret
on the preview Worker, then call:

```sh
curl -X POST https://weave-personal-planet-preview.ryujyonan.workers.dev/api/internal/notifications \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"title":"Weave","body":"PC-triggered test","url":"/push","type":"test"}'
```

The endpoint is server-to-server only and rejects requests without the token.
Morning Brief or a future Cron should call `NotificationService` directly from
its server-side task, not route through the browser or a PushSubscription endpoint.
