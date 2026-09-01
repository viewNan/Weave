# Weave UI Design Brief

## Product feeling

Weave is a bright, rounded, illustration-driven personal knowledge workspace.
It should feel like a calm digital desk for thinking, collecting, and revisiting
knowledge: energetic but polished, personal but not childish, colorful but controlled.

## Design direction

> Bright, rounded, illustration-driven workspace UI with vivid orange/yellow,
> large radii, card-based layout, and a friendly personal feel.

The visual reference is modern colorful mobile app illustration, adapted for a
desktop-first web workspace. Borrow the atmosphere, not the phone layout.

## Visual rules

- Use a very light peach / apricot background and clean white surfaces.
- Use large, generous radii: 16px for controls, 20–28px for major surfaces.
- Use vivid orange / yellow as the primary accent, with crisp green, blue, coral, and violet
  for supporting contexts.
- Keep cards white or softly tinted; avoid large saturated color fields.
- Leave generous whitespace around every major module.
- Prefer soft borders and very subtle shadows over hard outlines or elevation.
- Use simplified, friendly symbols and small illustration-like accents.
- Keep roughly 70% of the interface functional and 30% expressive.
- Default to light mode; do not introduce dark mode until the light system is stable.

## Context colors

| Context | Color | Symbol direction |
| --- | --- | --- |
| Research | sage / teal | leaf, telescope, specimen |
| Career | orange / apricot | path, briefcase, upward arrow |
| Writing | coral / rose | pencil, paper, spark |
| Schedule | sky blue | calendar, clock, sun |
| Personal | lavender | star, heart, small home |

Colors should appear as tags, icons, folder tabs, small illustrations, and card
backgrounds—not as full-page saturated backgrounds.

## Core page composition

The homepage should prioritize:

1. A friendly welcome message.
2. One large rounded search / Ask Weave area.
3. Colorful Project cards.
4. Recent files.
5. A small weekly plan or AI suggestion area.

The layout should breathe. Do not try to fill every available area with metrics.

## Component language

- `ProjectCard`: soft tinted surface, folder-like top edge, context color, symbol,
  document count, and a gentle hover lift.
- `DocumentCard`: file symbol, filename, type tag, updated time, and version tag.
- `AskWeavePanel`: recognizable rounded AI presence with a small expressive mark,
  prompt input, and calm status feedback.
- `ContextTag`: reusable pastel pill for Research, Career, Writing, Schedule, and
  Personal.
- `VersionBadge`: compact, quiet `v1`, `v2`, `v3` label.
- `EmptyState`: friendly illustration-like symbol and one clear next action.

## Avoid

- Generic SaaS admin dashboard templates.
- Uniform grids of identical statistic cards.
- Excessive gradients, glass effects, or animations.
- Dense spreadsheet-first file screens.
- Dark mode as the default.
- Tiptap or dnd-kit before the editor / block workspace is actually designed.

## Technical implementation

Keep visual patterns reusable through shared CSS variables and components. The
frontend should remain independent from the backend data model. Current first
version scope:

```text
Sidebar
Dashboard
Projects
Files
Search
Document Detail
``` 

The current mock UI can later replace its data adapter with the FastAPI document,
upload, version, download, and search endpoints without changing the visual layer.
