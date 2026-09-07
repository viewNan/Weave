---
name: personal-planet-ui
description: Build or refine Weave's Personal Planet homepage using its warm, soft low-poly diorama visual and interaction rules. Use for this project's planet and homepage, not unrelated backend work.
---

# Personal Planet — Soft Low-Poly Diorama

Explicit user instructions take precedence. The planet represents a personal knowledge world and serves as the homepage's visual centerpiece and, in later phases, navigation.

Use warm, editorial composition and a playful but restrained miniature world. Rounded continent silhouettes should still have visible triangular facets. Avoid realistic geography, satellite textures, dark space, neon, glossy gradients, glassmorphism, bloom, photorealistic materials and clouds.

Palette: page and ice `#FBF5F2`, blush/coast `#F6E2D7`, accent `#FF9558`, ocean `#8EC8D2`, deep ocean `#62AEBE`, ice shadows `#EAF1EF` / `#DCE7E5`. Familiarity is four discrete levels: 0 `#D8D4C3`, 1 `#B8C4A3`, 2 `#93A883`, 3 `#718A66`. Keep local coastal, rocky and terrain variation subordinate to that signal.

Use React Three Fiber, Three.js and Drei, with procedural geometry and flat-shaded rough nonmetallic materials. Use an icosphere ocean, slightly raised irregular continent meshes and geometric polar ice. Keep region data separate from rendering; familiarity controls land color toward sage green. Avoid heavy postprocessing; use simple lighting and cap pixel ratio for mobile.

Desktop composition is approximately 35% text and 65% planet. The globe must feel substantial, not like a small widget. Mobile stacks headline, globe and region list. Keep labels transient; provide keyboard-accessible region inspection and reduced-motion behavior.

Idle rotation is very slow. Pointer interaction pauses rotation; dragging rotates, and rotation resumes after a short delay once interaction ends. Hover subtly raises and brightens a continent.

Current scope: eight-region world with distinct coasts, raised terrain, simple geometric landmarks, paths and vegetation. The original five generic continents have been replaced. No content routes or backend integration yet.

For detailed world shaping, read [the user's world brief](world-brief.md). Its final eight-region structure takes precedence over its inconsistent introductory continent count. Use these identities:

- Research: large shield/pear, narrow north, 2–3 bays, a long peninsula, 3 nearby islands, central ridge and observatory; core familiarity 3.
- Workbench: large geometric coast, harbor cutouts, central terraces and modular workshop; relatively dense buildings.
- Living: large rounded bean, gentle bay, soft plain and hills, warm house and plentiful trees.
- Growth: medium elongated leaf/crescent, ascending slope and lighthouse; developing familiarity 1 with greener high points.
- Hobby Isles: six islands of varied size, one main island, hilly scenery, camp and varied familiarity.
- Archive: medium compact rounded rectangle, calm edges, low platform and orderly archive buildings.
- Exploration Ice: one broken northern cap and five detached irregular ice floes; small beacon, no trees.
- Spark Islands: eight scattered tiny fragments; low development, a small mailbox on one island.

Target 60% ocean, 32% land and 8% ice. The supplied land weights (18, 16, 18, 12, 10, 8, 2.5) total 84.5; normalize these within the 32% land budget rather than inventing a missing continent. Calibrate spherical footprint area, and check that landmasses do not overlap. Keep main islands and satellites within each region's area budget.

World data and authored outlines live in `frontend/lib/world.ts`, spherical area and terrain generation in `frontend/lib/terrain.ts`, primitive landmarks in `frontend/components/Landmarks.tsx`. Region data records intended shape, ruggedness, terrain, familiarity, island and building density. Change authored outlines to change coast shape; ruggedness is descriptive metadata, not a random noise multiplier.

When navigation is requested later: continent click should smoothly focus before displaying an Enter action; explicit landmark clicks may navigate. Keep destination routes in region data.

Run the app and inspect desktop and mobile before delivery. Verify drag, hover, pause, reset, keyboard interaction and reduced motion; check compilation and production build.
