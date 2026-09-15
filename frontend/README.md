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
Git integration are configured in Cloudflare. Do not add database bindings or
secrets for this static deployment spike. The Worker project name is
`weave-personal-planet`; update it only if that name is unavailable in the
target Cloudflare account.

For GitHub auto-deploy, connect `viewNan/Weave`, set the root directory to
`frontend`, use `npm run cf:build` as the build command, and use
`npx wrangler deploy` as the deploy command. Cloudflare reads `.nvmrc` during
the build; no build variables are required for this phase.

World data and authored coastlines: `lib/world.ts`. Spherical area calibration and terrain: `lib/terrain.ts`. Rendering: `components/Planet.tsx`; geometric landmarks: `components/Landmarks.tsx`. Design instructions: `../skills/personal-planet-ui/SKILL.md`.

Area targets are 60% ocean / 32% land / 8% ice. The brief's incomplete land percentages are treated as relative weights and normalized to the 32% land budget. Tests verify calibrated spherical areas, island counts, mesh budget, above-water vertices and non-overlapping distribution using 24,000 sphere samples. Familiarity currently uses authored defaults, not usage history.

Google Fonts is optional; system fonts remain available offline. WebGL is required for the interactive scene; an explanatory fallback is shown if unavailable.
