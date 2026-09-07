# Weave · Personal Planet

Responsive homepage with eight distinct regions, procedural terrain, coasts, island chains, polar ice and primitive landmarks. Existing Python backend is independent and unchanged.

Use Node.js 22.13+ (or 24 LTS).

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

World data and authored coastlines: `lib/world.ts`. Spherical area calibration and terrain: `lib/terrain.ts`. Rendering: `components/Planet.tsx`; geometric landmarks: `components/Landmarks.tsx`. Design instructions: `../skills/personal-planet-ui/SKILL.md`.

Area targets are 60% ocean / 32% land / 8% ice. The brief's incomplete land percentages are treated as relative weights and normalized to the 32% land budget. Tests verify calibrated spherical areas, island counts, mesh budget, above-water vertices and non-overlapping distribution using 24,000 sphere samples. Familiarity currently uses authored defaults, not usage history.

Google Fonts is optional; system fonts remain available offline. WebGL is required for the interactive scene; an explanatory fallback is shown if unavailable.
