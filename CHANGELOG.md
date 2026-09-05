# Changelog

## 2026-09-06 — the background cast gets a voice

### Changed

- **The eleven customers now sound like eleven people.** They were all
  written in one register — flat, clipped, no contractions — which is
  Synthia's. A background cast speaking the protagonist's voice makes it
  nobody's. The early roster now talks loosely: *"Still warm. You're a
  saint."*, *"I'll be hungry again by the bridge."*, *"They must've meant
  somewhere else."* The last three — the Stranger, the Pilgrim, the Devout
  — keep the formal register, so it now reads as **the mark of someone
  touched by something** rather than as house style, and Synthia's voice
  stays hers.

  Night Shift's disappointed line was literally `"Hm."` — hers, from
  `visit_first_end`. Replaced, and the reason is noted in the file so it
  does not come back.

  **Not touched: a single line of Synthia's.** Those remain the
  collaborator's, as agreed.

- **Two research nodes were named after their own dishes.** All thirteen
  nodes name a *skill* — Citrus Work, Practised Eye, Steady Hands, Working
  With Ash — except the two late ones, which were called *The Impossible
  Stack* and *The Quiet Stack*. That put the same words twice on one screen
  and told the player nothing about what they were learning. Now **The
  Seventh Layer** (it is the dish that stands seven high) and **Working In
  Silence**, which rhymes with *Working With Ash* directly upstream of it.
  The convention is written down in `CONTENT.md` so the next node added
  follows it. Ingredient names were reviewed and left alone — Flour through
  Bottled Starlight and Quiet Milk is already a clean ordinary-to-uncanny
  gradient.

- **Two names.** `Souffle Pancake` → **Soufflé Stack** (accent restored;
  it now joins the Stack family it belongs to), and `Void Syrup` →
  **Starless** — the one abstract name in a list of concrete ones
  (Plum Lacquer, Ash Glaze, Ember Reduction, Nightmilk), and it is brewed
  from starlight. The research node followed the dish: **Soufflé Method**.

- **One decoration note.** The corner lamp's *"Warm, and low, and on all
  day."* read as a list; it is now *"Low, and warm, and on all day. Even
  when the sun is out."* — which is the small extravagance that is the
  actual reason to want it. The other six were already doing their job and
  were left alone.

### Fixed

- **The smoke test was asserting the copy, not the wiring.** It checked
  for the literal `"Souffle"` in the page, so renaming a dish in
  `js/data/` failed a check about whether *her ask is wired to the
  research board* — the one thing it exists to watch. It now reads both
  names out of `RECIPES` and `RESEARCH` at run time, which is a stronger
  assertion than the literal was: the ask must name **whatever the data
  says the dish is called**.

- **The writing checklist listed the roster in file order**, so The Critic
  (40 reputation) printed after The Stranger (180). It now prints in the
  order the player meets them — which is the order the escalation is
  written in, and unreadable in any other.

- **The handoff docs were teaching the mistake.** `CONTENT.md`'s worked
  example for adding a customer used `happy: 'Hm. Better than mine.'` —
  handing the collaborator Synthia's own tic as the model line for a
  market trader. The example now speaks in the roster's register, and the
  convention is written down beside it, explicitly as something to break
  on purpose rather than by accident.

  `README.md` and `tools/writing.js` both claimed *everything* was
  placeholder. That is still exactly true of `scenes.js` and now false of
  the shop, and the difference is the whole point — the collaborator
  should be able to tell at a glance which prose is waiting for them and
  which is only furniture they may rewrite. Both now say which is which.
  The three `Souffle` spellings in `CONTENT.md` follow the dish.

## 2026-09-06 — the shop, and somewhere to put the art

### Added

- **Art slots.** Every picture the game can use is declared in
  `js/data/art.js` with its path, its size, what it has to show and which
  placeholder it replaces. **None of it needs to exist** — each slot draws a
  placeholder until a file appears, and picks it up on the next reload. No
  code change, no registration, no build step; delete the file and the
  placeholder comes back. `node tools/art.js` prints the checklist and
  writes the manifest the game loads from, so the console stays clean
  instead of reporting eleven missing files on every load.

  Eleven slots wired so far: the pancake in the pan, the same pancake
  overcooked, a pancake seen edge-on as one layer of a stack, the griddle,
  and one for each of the seven things you can buy for the room. Synthia's
  29 existing sprites were already in and are untouched.

- **A writing checklist**, `node tools/writing.js` — every line of prose in
  the game with, for each one, when the player sees it: which week, what
  they have just done, what her face is doing, what they can say back. All
  of it can be worked through without opening any code, in any order.
- **`preview.html`** — a workbench for both jobs. Every art slot side by
  side, showing the real file where one exists and what it needs where it
  does not; and every scene playable on its own, with her sprite and the
  expression that scene calls for, so an ending can be read without playing
  eight weeks to reach it. Separate from the game and touches no save.
- **A front door in the README** for whoever picks this up: four commands
  that orient you, then CONTENT.md for everything else.

- **Decoration** — seven things to buy for the room: window boxes, a second
  table, a repainted sign, a corner lamp, a shelf of jars, the good griddle,
  an awning people wait under when it rains. Bought with money, kept forever,
  and **purely cosmetic** — a test buys every item and asserts reputation,
  research points and affection are all unchanged, and the smoke test asserts
  the same through the real page. Reputation already means exactly two things
  (which customers turn up, and how many); a third input would make it two
  systems wearing one name.

  Brought forward from Phase 2 because the hole it fills was measured: a
  careful player finished the research tree before the last weeks, and the
  till then climbed to about 21,000 with nothing to spend it on. The last two
  weeks had no economic decision left in them. A careful run now ends holding
  about 1,900 having bought five or six of the seven, so there is always
  something left to want and no run clears the shop.

### Fixed

- **One of the five endings could never be reached.** Showing up grants two
  points a week and cannot be declined, so a finished game always carried at
  least 16 — putting the floor above the lowest tier entirely. Five endings
  were authored and the collaborator would have been writing one nobody could
  see. The tiers were retuned so the floor lands in the bottom band, and a
  test now walks the real grant economy and asserts every tier is reachable.
- **The evening screen lied about the till after a trip to Research.** "Back"
  was nothing but a screen switch, so after spending at the bench the header
  said 200, the ledger four lines below said 3,000, and the shop offered a
  lamp at 2,600 with a live button. Buying it was safe — the purchase re-reads
  the money and refuses — but that refusal was the only sign the panel had
  been lying.
- **A save holding a string where a list belongs killed Continue.** It threw
  out of `deserialize`, which nothing catches, so the player clicked and
  nothing happened at all: no notice, no screen change. Hand-edited duplicates
  are now dropped too.
- **Every purchase dropped keyboard focus to the page body**, so a keyboard
  player lost their place on each buy and a second Enter went nowhere.

---

## 2026-09-05 (later) — syrups, listening, and the bill

### Added

- **Syrups do something.** They were inert: no runtime code read a syrup's
  axes and the drizzle beat did not know which one it was pouring, so half of
  what the research tree awards paid out in nothing. Customers now have a
  taste on the same four axes; you pick a syrup at the drizzle beat and a good
  match pays more and builds reputation faster. **A mismatch is never a
  penalty** — a discovery must only ever be a new option, never a new way to
  lose money. The customer's taste is never printed: you learn it from the
  result on the bill and from their greetings.
- **Dishes are priced from their parts, and billed like a till receipt** — so
  many pancakes at the going rate, a line per ingredient, a line for the skill
  the dish takes, then quality, the syrup with its verdict, and the tip. You
  never set a price; you choose what goes in, which is what finally makes an
  unlocked recipe visibly worth more. The receipt also shows what the stock
  cost and what was kept, so a dish cooked on emergency stock reads "total 23
  / stock −40 / kept −17" instead of quietly losing money.
- **Impossible orders** — she asks for a dish you have not unlocked, is
  deadpan about it, and the research board marks that node "She asked for
  this." The ask rides alongside her real order and never replaces it.
- **Customers react** — their happy and disappointed lines had been in the
  data since the roster was written and were rendered nowhere. They now speak
  at the top of their receipt.
- **She waits** — an unserved visit rolls to the next day the shop opens
  rather than evaporating. Closing early used to cost a week of the arc with
  nothing on screen saying she had been there.

### Fixed

- **The listening loop was gated on luck.** She ordered whatever was priciest,
  so a player who heard her mention a dish and spent weeks researching it had
  no way to serve it to her deliberately. She now asks for what she mentioned:
  the last tier went from 2 of 10 seeds to 10 of 10.
- **Every ending showed the same fallback title.** The walk that finds an
  ending's title never ran, so a devoted eight-week run and a stranger's were
  headed identically — and that title is the one thing on the card that tells
  them apart.
- **The receipt did not add up.** The total was rounded separately from its
  own lines, so one bill in eight printed a column that did not sum to its own
  total row. The money was always right; the arithmetic a player can do by eye
  was not.
- **An empty blend paid research points forever** — combining nothing, at no
  cost, indefinitely.
- **A stale base-ingredient setting would silently double-bill every dish** in
  the game, with a plausible extra line on the receipt. Now a validator error.
- **A hand-edited or stringified save made Continue a dead button**, the story
  screen could strand a player with no way out, the bench consumed ingredients
  before it could fail, and blocked browser storage was reported as "No save
  found."

### Changed

- The quota curve was retuned twice: up when syrup pairing added a real income
  lever, then down at the late weeks once the balance simulator stopped paying
  the research bench twice — every number it had been calibrated against
  described a game about a third richer than the one that ships.
- **Every colour, including the ones painted on canvas, is now a token.** The
  page drew a pancake one brown and the canvas drew the same pancake another.

### Tooling

- The balance simulator gained two profiles that exist to keep the tuning
  honest rather than to model play: one that cooks as well as a careful player
  but ignores everything Synthia mentions (proving the listening beat is
  load-bearing — two tiers of difference), and one that pours whatever the
  picker preselects, because a customer's taste is never printed and a
  first-time player does not have it.
- The smoke test was pinned to a fixed seed. It had been playing a different
  game every run, which is not a regression gate.
- Static guards for the class of bug that made 227 passing tests meaningless:
  every module must parse, no module may import the same name twice, every
  element id must exist in the page, and the canvas colour fallbacks must
  match the stylesheet.

### Known gaps

- **All dialogue in `js/data/scenes.js` is placeholder**, written to be
  replaced. The systems for the arc all exist — what she mentions, the payoff
  when you serve it back weeks later, the five endings chosen by tier, the
  dishes she asks for that you cannot make yet. The voice does not, and it is
  not ours to write: Synthia is the collaborator's character.
- **Food, the griddle, the room and its seven decorations are procedural
  shapes and labelled outlines**, not art. Legible and consistent, and
  placeholders. Each decoration already names the sprite that will replace it,
  and swapping them in changes one function.
- Audio and juice are untouched.

Nothing else in the design document is unbuilt.

---

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
  (Playwright, plays the game headlessly). 161 unit tests, including 12
  balance regression tests that run the full simulation.
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
- **Research costs rescaled.** The tree totalled 178 points against ~1,100
  earned, so six of thirteen nodes were bought in week 1 and it was
  exhausted by week 4 — points then piled up with nothing to buy, the same
  "no sink" bug the money economy had. It now totals ~1,130 and completes
  in week 8 for a careful player; a sloppy one reaches 4 of 13.
- Recalibrated the quota curve twice for the new content and pacing. The
  late weeks are near-misses on both sides: week 6 cleared by 266, week 7
  missed by 688, week 8 by 239.
- **12 balance regression tests** (`tests/balance.test.js`) that run the
  8-week simulation and assert the *shape* of the game — income compounds,
  the tree is not bought out early, discovery continues, money does not
  hoard, every recipe is profitable. The simulator found three separate
  "this resource has no sink" bugs; these make it impossible for a fourth
  to ship silently.

### Fixed on review

- **The HUD and the ledger contradicted each other after a week rollover.**
  `closeDay()` advances the week and resets earnings, so the ledger reported
  the new week's empty progress ("0 / 900") while the header still showed the
  old week's ("20 / 300"). The ledger now reports the week that just *ended*
  and shows the new target separately, and the HUD refreshes after the roll.
  Found by looking at a screenshot, not by any test — so the smoke test now
  asserts the two agree.

- **The morning screen was giving bad advice.** It read "a narrow menu of
  your best work earns more than a wide one", which stopped being true once
  there were nine recipes — the demand system already steers customers
  upmarket, so restricting the menu just turns people away. Rewritten to say
  narrow helps early and breadth pays later.
- **The morning screen now reports stock readiness and offers a restock
  button.** Cooking consumes ingredients, so "can I get through today?" is a
  real question; it previously told you the price without giving you any way
  to act on it, sending you hunting through the research screen.
- Checkboxes were rendering as default browser blue against a violet palette.

- **The flip beat moved to canvas too.** It had been left in DOM on the
  assumption that "the timing readout communicates clearly" — it did not. It
  rendered as a row of `o` characters, and it had a gameplay hole the scoring
  hid: the bubbles only accumulated, so there was no peak to flip *on*. They
  now rise, peak, and pop at the ideal moment, and the pancake darkens as it
  overcooks. All four beats are now visual and consistent.

- **The game now ends.** It previously ran forever — after 70 days you were
  in week 11 against a quota of 27,523 with no conclusion, despite the spec
  specifying an ending at the end of week 8. The last authored week now
  closes the story, and **which ending you get is chosen by how close Synthia
  became**: five endings, one per affection tier. The devoted one is titled
  "Most Do Not Stay", after the line in her own voice guide. An ending card
  reports the shape of the run — weeks, pancakes, syrups, and where she
  ended up — rather than a score, because there is nothing to win.
- **Missing the quota no longer repeats the same line.** A struggling player
  can miss six weeks running and was hearing one identical scene every time,
  which turns a kind mechanic into a broken record. Three scenes now escalate
  over the first three misses and then hold: she barely reacts, then she
  notices, then she sits down.

- **Synthia now actually comes into the shop.** She previously appeared only
  in scenes at week boundaries and was never a customer you could cook for —
  which meant `serve(..., {forSynthia:true})` was never called by anything.
  The whole affection chain was dead in the real game: her mentions were
  never recorded, serving her never counted, and **the listening beat — the
  best idea in the design, and the thing reaching DEVOTED depends on — could
  never fire.** She was permanently stuck at REGULAR. She now visits once a
  week on a varying day, says something in passing, and waits at the counter
  until served.
- Five mention scenes (was two), so the arc has headroom to reach its last
  tier rather than topping out just short.

- **`tools/playthrough.py`** — plays the real page in a browser for N in-game
  weeks and cross-checks `simulate.js` against it. The simulator drives the
  engine directly, which is fast but only as correct as its imitation of
  `main.js` — and it was once wrong in precisely the way the UI was, so it
  *reproduced* the Synthia bug rather than exposing it, reporting her stuck at
  REGULAR for eight weeks. Its load-bearing assertion is that affection must
  accrue from more than one source; in the broken build the only grant reason
  was "you kept the shop open".

### Known gaps at the end of Phase 1

- All dialogue in `js/data/scenes.js` is placeholder written to be replaced.
- Food, griddle and shop furniture are procedural canvas shapes, not art.
  They are legible and consistent, but they are placeholders.

*(Both still true. See the current gaps at the top of this file — several
other things listed here as built turned out to be built incorrectly, and
are recorded in the entries above.)*
