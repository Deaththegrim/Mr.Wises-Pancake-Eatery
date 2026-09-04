# Changelog

## Phase 1 — 2026-09-05

The whole game loop, end to end, with placeholder art and thin content.
Playable from the title screen through eight weeks.

### Added

- **The making loop** — four scored beats: pour, flip, stack, drizzle. Each
  recipe weights them differently, so a souffle lives on the flip and a tall
  stack lives on alignment. Stack error compounds: an off-centre first
  pancake leans the whole tower, though a steady hand can nurse it back.
- **The day** — morning menu, service, evening ledger. No clock, no action
  budget. Close when you like.
- **The quota** — escalating weekly target that gates *story*, not survival.
  Hit it and the next beat opens; miss it and a softer Synthia scene fires
  and nothing is lost. There is no Game Over anywhere in this game.
- **Reputation** — rises with quality, never falls, buys nothing. It unlocks
  customers and makes the shop busier, and it shifts demand upmarket.
- **Research** — a visible tree with prerequisites and cook-gates, plus an
  experiment bench. Upgrades buy away *error*, never power, so the game gets
  calmer as it goes.
- **The pantry** — ingredients cost money from the till and the bench burns
  them whether or not the blend works. The shop's profits fund discovery.
- **Synthia's arc** — five hidden tiers, never shown as a number. Her default
  expression and how long she lingers change as it deepens. It can stall; it
  can never fall.
- **The listening mechanic** — she mentions something in passing; research and
  serve it weeks later, unprompted, and she notices. Reaching the last tier is
  impossible without it.
- **Save/load** — tolerant by design. Stale content is dropped with a warning
  rather than breaking the file, and the player is never stranded with nothing
  to cook.
- **Content layer** — everything editable lives in `js/data/`, enforced by
  tests: `js/engine/` fails the suite if it touches the DOM, `js/data/` fails
  if it declares a function.
- **Tooling** — `tools/validate.js` (content integrity), `tools/simulate.js`
  (8-week balance simulation, two skill profiles), `tools/smoke.py`
  (Playwright, plays the game headlessly). 149 unit tests.
- `CONTENT.md`, written for someone who does not read JavaScript.

### Fixed during the build

These were found by tooling, not by review, and every one would have shipped:

- **Income never scaled.** Weekly earnings sat flat at ~2,800 while the quota
  climbed 2.2x per week, making 5 of 8 quotas unreachable by any amount of
  effort. Reputation's "raises customer traffic" half had never been built.
- **Money had no sink.** An 8-week playthrough ended with ~62,000 in the till
  and nothing to spend it on, so the escalating quota was pressure with no
  purpose. Fixed by the pantry.
- **Salted Caramel was permanently undiscoverable.** The bench averages its
  ingredients, so a target more intense than any blend can reach is
  unreachable forever. It is now found via butter + maple + salt flake, which
  is how you actually make salted caramel.
- **The Impossible Stack could never be ordered.** Tagged `divine`; no
  customer wanted `divine`. The most valuable dish in the game was dead
  revenue.
- **The affection arc was unreachable.** DEVOTED sat at 90 points when the
  maximum achievable was 64.
- **Bench hints vanished instantly** — the bench's own refresh callback
  destroyed the hint element it had just written.
- Unlabelled money in the HUD; a stale score readout sitting over Synthia's
  first appearance; sprites rendering as cropped rectangles (they are not
  transparent cutouts); a 2,200px research screen that buried the bench under
  fourteen stock rows; syrup drawn too faintly to see.

### Changed

- **Pour and drizzle moved to `<canvas>`.** Drizzle now renders the actual
  stack you built, at its real offsets, on a plate — you pour syrup onto the
  food you made. The DOM version was six flat rectangles that read as an
  equaliser and discarded the plate entirely. `engine/cook.js` was untouched;
  only the module that *measures* changed.

### Added later the same day

- **Cost of goods.** Cooking now consumes ingredients. Stock is bought in
  units and held in servings — one unit is a bulk quantity that makes ten
  pancakes, while the bench burns a whole unit per experiment. That gap is
  load-bearing: it keeps discovery expensive while cooking stays profitable.
  Running out never cancels a sale; you buy emergency stock at double price,
  so bad restocking costs margin rather than revenue, and a broke player is
  never locked out of earning.
- **Content depth** — 9 recipes (was 4), 11 customers (was 4), 13 research
  nodes (was 6), 9 syrups with 8 discoverable (was 4/3), 14 ingredients
  (was 9). Two new branches in the tree: a cheap early *bright* line and an
  expensive *strange* line with high margins.
- Recalibrated the quota curve for the new income ceiling. Week 7 is now a
  deliberate knife-edge — the careful player misses it by 395.

### Known gaps

- All dialogue in `js/data/scenes.js` is placeholder written to be replaced.
- Food, griddle and shop furniture are CSS and canvas shapes, not art.
