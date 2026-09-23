# WALTER: Environmental Supply Chain Radar

*What changed. Where it matters. What to do next.*

A recurring, evidence-linked radar on environmental supply-chain risk, by [This Hollow Earth](https://thishollow.earth). WALTER is the internal codename.

**Status:** local prototype (Linear THI-95). Nothing is deployed yet. Staging will be `walter.thishollow.earth` (THI-96).

## Stack

- Static multi-page site: HTML + CSS + TypeScript, bundled with Vite.
- Radar layout: adapted from [Zalando tech-radar](https://github.com/zalando/tech-radar) `radar.js` v0.12 (MIT, d3 v7). It is ported to `src/radar.ts`; the original is kept in `src/vendor/radar.js` for reference.
- Wireframe look: [rough.js](https://roughjs.com/).
- Design v0.1: monochrome, background `#f5f5f5`, ink `#434343`, logo `public/tetrahedron.png`.

## Data

`public/data/2026-q4.yaml` is the single source of truth for an edition. The schema follows the blip schema v0.1 (Obsidian: `WALTER/prototypes/Blip schema v0.1 - prototype.md`).

- Stable blip `id`s. Explicit `movement` (new / in / out / none).
- `evidence` E1–E5. `severity` only on Conditions blips.
- `scope.origins` has two levels: `political` (countries) and `ecological` (ecosystem / watershed / landscape).
- `lifecycle` (since / until) and dated `events`.
- Blips with `draft: true` are stubs.

## Develop

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run typecheck
npm run build      # -> dist/
npm run preview    # http://127.0.0.1:4173
npm run pdf        # with preview running: vector PDF of /print.html -> dist/
```

## Pages

| Path | What |
|---|---|
| `/` | Radar, filters (commodity, origin, issue, ring), legend, blip detail (`/#<blip-id>`) |
| `/print.html` | Print view, the basis for the PDF |
| `/methodology.html`, `/independence.html`, `/disclaimer.html` | Draft copy (final text in THI-99) |

## Licence

- Code: MIT (see `LICENSE`).
- Radar content and data: CC BY 4.0.
