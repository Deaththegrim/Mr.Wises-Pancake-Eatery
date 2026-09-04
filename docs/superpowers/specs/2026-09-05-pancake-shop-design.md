# Pancake Shop — design

**Date:** 2026-09-05
**Status:** design, pending approval. No code written.
**Research it argues from:** `research/genre-loops.md`

---

## 1. What this is

A 2D browser shop sim: you run a pancake shop. You make pancakes by hand, chase a
weekly sales quota, and research new pancakes and syrups. A tired goddess called
Synthia keeps showing up, and over a long stretch of weeks her interest in you
grows.

**Tone:** chill. No timers, no Game Over, no impatient queue. Pressure comes from
a weekly number you want to hit, never from a clock.

**Reference frame** (from `research/genre-loops.md`): *Papa's Pancakeria*'s hands,
*ReStory*'s pace and returning-customer story engine, *Recettear*'s quota ratchet
with its Game Over removed, and *Potion Craft*'s discovery system with its four
documented mistakes designed out.

### Non-goals

- Not a VN with a minigame attached. The making loop is the game.
- Not a twitch game. Timing windows are generous by design.
- Not a management spreadsheet. You cook; you do not assign staff rotas.
- No combat, no dungeon, no expedition layer.

### Authorship constraint

Synthia is the collaborator's character. `god-synthia/research/voice-style-guide.md`
exists so new writing is indistinguishable from theirs, and every line written here
is held to it. **This design specifies the affection *system*; the collaborator
authors the affection *content*.** Where the arc goes romantically is theirs to
bless, not ours to assume. Credit follows the same rule as the mod work.

---

## 2. The pillar

> **The grind is the courtship.**

Her voice guide already contains the thesis: *"And most don't stay."* A player who
keeps opening the shop, week after week, is the counter-argument. So the repetitive
loop that every other shop sim treats as a chore is here the mechanism of the
relationship. Persistence reads as devotion because the fiction says it does.

Every system below is checked against this pillar. If a system doesn't serve it,
it is cut.

---

## 3. Architecture

Browser, vanilla JS, **ES modules, no build step**. Served as static files; ships
as an itch zip; runs from a link.

ES modules are the load-bearing choice: they run natively in the browser *and*
import directly into Node, so the pure logic (scoring, quota, research resolution,
affection) is unit-testable with no bundler, no toolchain, and no build step to
break the handoff.

```
pancake-shop/
├── index.html
├── css/
│   ├── style.css          # shell + themes, adapted from god-synthia
│   └── shop.css           # shop screens
├── js/
│   ├── data/              # ← DATA ONLY. The handoff surface.
│   │   ├── ingredients.js
│   │   ├── recipes.js
│   │   ├── syrups.js
│   │   ├── research.js
│   │   ├── customers.js
│   │   ├── scenes.js      # Synthia's VN scenes, god-synthia node format
│   │   ├── affection.js   # her arc: tiers and their beats
│   │   └── economy.js     # quota curve, prices, every tuning constant
│   ├── engine/            # pure logic, no DOM, unit-tested
│   │   ├── state.js       # game state + save/load
│   │   ├── day.js         # morning → service → evening
│   │   ├── cook.js        # four-beat scoring
│   │   ├── research.js    # tree resolution + bench experiments
│   │   ├── economy.js     # money, quota, tips, reputation
│   │   ├── affection.js   # Synthia's arc state machine
│   │   └── vn.js          # dialogue layer, lifted from god-synthia
│   ├── ui/                # thin shells, DOM only, no rules
│   │   ├── screens.js
│   │   ├── griddle.js
│   │   ├── shopfront.js
│   │   ├── tree.js
│   │   └── ledger.js
│   └── main.js
├── tools/validate.js      # content integrity checker (Node)
├── CONTENT.md             # the handoff guide
└── README.md
```

**Rules.** `engine/` holds rules and touches no DOM. `ui/` holds DOM and holds no
rules. `data/` holds content and holds no functions. Files stay under 800 lines.
If adding a syrup requires opening anything outside `data/`, the architecture has
failed its primary requirement.

---

## 4. The day

No clock. No action budget. You work until you choose to close.

```
MORNING   Set the menu (which recipes are available today) and prices.
          The quota board shows the week's target and progress.

SERVICE   Customers arrive one at a time, at their own pace. Each places an
          order. You cook it. You hand it over. Repeat as long as you like.
          Closing is a button, always available.

EVENING   Spend: research nodes, ingredient stock, shop decoration.
          The ledger shows the day's takings and quota progress.
```

**The known risk**, recorded honestly: with no clock, grinding one cheap recipe
forever is theoretically optimal. Three things prevent it, and they must all hold.

1. **Demand variety.** Customers want different things; serving a full menu earns
   materially more than serving one item. Repetition is legal but poor.
2. **Research gates progress.** Points come disproportionately from *new* dishes and
   *high-quality* execution, not volume. Grinding one recipe stalls the tree.
3. **Diminishing returns within a day.** Each repeat of the same recipe in one day
   earns slightly less. Soft, uncapped, self-limiting — the player feels the nudge
   without hitting a wall.

This directly targets the repetitive-cycle flaw reviewers hit *ReStory* with.

---

## 5. The making loop

Four beats. Each scores 0–100. Four is the calibration point: two is a menu click,
ten is *ReStory*'s screws.

| # | Beat | Interaction | Scored on |
|---|---|---|---|
| 1 | **Pour** | Hold to pour batter onto the griddle | Volume vs. the recipe's target band |
| 2 | **Flip** | Bubbles surface, a graded window opens, click | Timing accuracy: perfect / good / early / late |
| 3 | **Stack** | Drag each pancake onto the stack | Offset from centre, **compounding** — an off-centre first cake leans the whole stack |
| 4 | **Drizzle** | Drag to pour syrup across the stack | Coverage evenness; penalises pooling and bare edges |

Beat 3 compounding is lifted straight from *Papa's Pancakeria*, where an
off-centre first pancake cannot be corrected later. It is the single cheapest way
to make the loop have real skill depth.

**Quality** = weighted mean of the four, with **per-recipe weights** in
`data/recipes.js`. A soufflé lives or dies on the flip; a tall stack lives on
alignment; a drowned-in-syrup special lives on the drizzle. Same four beats,
genuinely different feel per recipe — this is what keeps the loop fresh as content
grows, and it costs the collaborator four numbers per recipe.

Quality drives: payment multiplier, tip size, reputation, research points, and —
when the customer is Synthia — affection.

**Feel constraints**, from the game-feel research:
- **Medium juice, not extreme.** Studies found extreme juiciness underperformed
  medium. Since progression hangs off a quality readout, the player must be able
  to reason about *why* they scored what they did. Legibility beats spectacle.
- **Generous windows.** Timing tolerance is "oil" — the coyote-time family. Input
  buffering on the flip. Forgiving by default; mastery is hitting *perfect*, not
  avoiding failure.
- **Order of operations:** responsive control first, predictable simulation second,
  polish third. Never the reverse.

### Canvas vs DOM — RESOLVED by prototype, 2026-09-05

The Phase 1 build implemented all four beats in DOM and they were played.
Verdict: **stack works in DOM; pour and drizzle need `<canvas>` in Phase 2.**

The evidence is the comparison between the beats, not a preference:

- **Stack is the best of the four**, and it is the only one with a real
  visual — pancakes land on a plate and the tower visibly leans away from
  the centre line. You can *see* the compounding rule that the engine is
  scoring. It needs nothing further.
- **Drizzle is the weakest.** In DOM it is six flat rectangles that fill
  with colour. It reads as an equaliser or a progress bar, not as syrup.
  Worse, it breaks continuity: the plate you just stacked disappears and is
  replaced by abstract cells, so the player stops decorating their stack and
  starts filling in a bar chart. Six buckets is also a coarse instrument for
  a score built on coverage variance.
- **Pour is nearly as weak** — a button and a rising millilitre counter,
  with no batter visibly spreading on a griddle.

The pattern is consistent: **the beats that feel like cooking are the ones
you can see.** Two of four currently communicate nothing about what the
player is doing, and that is a presentation failure, not a mechanical one —
the scoring for all four is correct and unit-tested.

**Phase 2 fix, in priority order:**
1. **Drizzle on canvas, drawn over the actual stack.** Keep the plate and
   the pancakes on screen; the player drags syrup across the food they made.
   Sample coverage from the canvas at a much finer resolution than six
   cells and feed the same `coverage[]` array to the unchanged scorer.
2. **Pour on canvas** — a puddle of batter that visibly spreads on the
   griddle as the button is held, so volume is read from the shape rather
   than from a number.
3. ~~Flip can stay in DOM~~ — **WRONG, corrected after looking at it.** The
   DOM flip printed a row of "o" characters, which reads as debug output
   next to a griddle and a plated stack. It also had a gameplay hole the
   scoring hid: the instruction says "flip when they peak", but the bubbles
   only ever *accumulated*, so there was no peak to read. The one beat whose
   entire skill is timing gave the player no timing cue at all.

   Now on canvas: bubbles rise, peak, and start **popping** at the ideal
   moment, and the pancake darkens as it overcooks. The visual peak is the
   real peak, so the player reads the pancake rather than a counter.

   Lesson: "the readout communicates clearly" was an assumption made from
   the code. It did not survive one look at the rendered screen.

**Nothing in `engine/cook.js` changes.** The scorers consume `volume`,
`msOffset`, `offsets[]` and `coverage[]`; only the module that *measures*
them (`js/ui/griddle.js`) is rewritten. That separation was the point of
keeping measurement and scoring apart.

---

## 6. Economy and the quota

### The quota is the story metronome

This is the keystone. With no fail state, a quota can't be a survival threshold —
so it becomes the **chapter gate**:

- **Hit the week's quota** → the next story beat unlocks. The week turns over.
- **Miss it** → a different, softer, funnier Synthia scene fires. Nothing is lost.
  The same quota stands next week.

No Game Over, no material penalty, and yet missing still stings — because you let
her down, and she is mildly, deadpanly disappointed in you. That is more motivating
than a fail screen and vastly more in-voice. It also fuses the economy to the
narrative engine instead of running them as separate systems.

### The curve

*Recettear*'s ratchet shape — roughly 2.2–2.5× per week — stretched over eight
weeks, because removing the fail state means the ramp can afford to be slower.

| Week | Quota |
|---|---|
| 1 | 300 |
| 2 | 700 |
| 3 | 1,600 |
| 4 | 3,600 |
| 5 | 8,000 |
| 6 | 18,000 |
| 7 | 40,000 |
| 8 | 90,000 |

**These are placeholders and will be wrong.** They live in `data/economy.js`
precisely so they can be tuned from play. What matters is the *shape*: escalation
that outpaces linear growth, so week-1 tactics cannot simply be repeated harder.
The player must convert profit into permanent capability — research nodes,
equipment, better ingredients — rather than hoarding cash. That conversion pressure
is the whole point of the curve.

Week 1's target is deliberately trivial, mirroring Recettear's soft onboarding.

The quota board is **always visible** in the morning and evening screens. Recettear
puts the next payment on the calendar permanently, and that visibility is what
makes daily decisions feel weighted.

### Reputation

A single slowly-moving number, separate from money, representing how well the shop
is known.

- **Rises** with each dish served, scaled by its quality. High-quality work moves
  it meaningfully; mediocre work moves it barely.
- **Never falls.** Cozy rules: a bad day stalls reputation, it does not undo weeks
  of work.
- **Spends on nothing.** It is not a currency. It is purely a gate.

It does exactly two things: it unlocks new customers on the roster (§8), and it
raises baseline customer traffic per day. That is the whole system — it is the
shop's equivalent of Synthia's hidden affection, a slow accumulator that makes
persistence visible in the world rather than on a scoreboard.

Kept deliberately thin. A reputation system that also modified prices, tips, and
research rates would be four systems wearing one name, and none of them tunable in
isolation.

---

## 7. Research

Two halves. The tree tells you where to aim; the bench lets you find things nobody
pointed you at.

### The tree

Explicit nodes with visible prerequisites, in `data/research.js`:

```
{ id, name, cost, prereqs: [ids], unlocks: {recipe|syrup|upgrade},
  gate: {cooked: {recipeId: count}} }
```

You always know what the next goal is and what it costs. Research points come from
serving *new* dishes and *high-quality* ones — not from volume.

**Upgrades follow Papa's philosophy: they buy away error, not power.** A griddle
alarm marks the flip window. A measured ladle narrows the pour band. A stack guide
shows the centre line. Each one makes a beat easier to score well rather than
making numbers bigger — so the game gets calmer as you progress, which is exactly
right for a chill sim.

### The bench — costs money (added 2026-09-05, post-build)

**Ingredients are bought from the till, and the bench consumes them whether
or not the blend works.** This was not in the original spec and it should
have been: without it, an 8-week playthrough ended with ~62,000 in the till
and nothing to spend it on. The escalating quota was pressure with no
purpose, because profit converted into nothing.

Serve pancakes → earn → buy stock → experiment → discover. Research points
still come from serving well and still buy tree nodes; the *bench* runs on
money. That split gives each currency one job.

Three outcomes, and the difference matters:
- **blocked** — no stock. Nothing spent, nothing happened, no points. A
  refusal, not a failure.
- **miss** — the ingredients are gone, but you always get a hint and points.
  Failure must cost something real or there is no grind; it must still teach
  or nobody experiments twice.
- **found** — gone, and you have a new syrup.

Prices are scaled against real income so cheap staples keep a broke player
tinkering while an exotic blend is a genuine investment. Simulated: the
careful player's till reads 223 / 33 / 114 / 2,135 / 6,122 / 8,767 / 11,881
/ 16,211 across the eight weeks — broke for three weeks because discovery is
eating the profits, then accumulating as income outgrows the bench.

Free experimentation over ingredient combinations. Every ingredient carries four
hidden axes in `data/ingredients.js`:

```
{ id, name, cost, axes: { sweet, sharp, rich, strange } }
```

Syrups and secret recipes define a target axis profile with a tolerance. Combine
ingredients; if the blend lands inside a target's tolerance, you discover it.

**Potion Craft's four documented complaints, each designed out:**

| Their problem | Our answer |
|---|---|
| Experimenting is too expensive, so players don't | Bench uses trivial ingredient quantities. Experimenting is nearly free by design. |
| No directional hints; you don't know where anything is | A miss returns a hint naming the dominant mismatched axis: *"Too sharp. Wants something round."* |
| Out-of-order discovery leads to brute-forcing | Targets are tiered; a blend far outside any tier returns the tier hint instead of silence. |
| Results are instantly, freely legible | Discovery names the syrup; its *full* effect is revealed by serving it to a customer. |

**A failed experiment never returns nothing.** It always yields a hint and a small
number of research points. The generalised lesson from the research: the search
space must be forgiving enough that failure is informative rather than wasted.
Cozy design agrees from the other direction — low punishment increases
experimentation, which is the entire point of a discovery system.

---

## 8. Customers

`data/customers.js`. A roster that grows as the shop's reputation does — a handful
at the start, more arriving over the weeks.

```
{ id, name, unlockAt: {week|reputation}, wants: [recipe tags],
  lines: {greeting, happy, disappointed} }
```

There is deliberately **no `patience` field**. Papa's scores how long customers
wait; we removed the clock, so a patience value would be a number nothing can ever
decrement — dead content that costs the collaborator time to fill in and means
nothing. Customers wait indefinitely and without complaint.

Ordinary customers are the economy and the texture. They have preferences, they
react to quality, a few become recognisable regulars with a line or two of their
own. They are deliberately shallow relative to Synthia — the roster exists so the
shop feels populated and so demand varies enough to make the menu decision real.

Adding one is a single data row. This is the easiest place for the collaborator to
add content and see it in-game immediately, which makes it the right first thing to
hand over.

---

## 9. Synthia — the slow burn

The long arc. She appears from week 1 and her interest deepens across the whole
game. This is the part the pillar exists to serve.

### Hidden, never a meter

Affection is an internal number the player **never sees**. No hearts, no bar, no
percentage. A visible meter turns a slow burn into a grind target and kills it
instantly.

It is expressed instead through things the player *notices*:

- Which expression she defaults to on arrival
- How long she lingers before leaving
- Whether she comments on the shop, the weather, herself
- What she orders, and whether she explains why
- Callbacks to things said many weeks earlier

The player should feel the change before they can name it. That is the whole craft
of it.

### Tiers

Five, in `data/affection.js`, each gating a pool of scenes:

```
STRANGER → REGULAR → FAMILIAR → CONFIDANT → DEVOTED
```

Thresholds are deliberately far apart. Reaching the last tier should take most of
the eight weeks. **Affection never decreases** — it stalls. This is a cozy game;
losing progress on a relationship because you had a bad week is the exact
punishment the genre exists to avoid. Rudeness in a dialogue choice can decline to
*grant* a step; nothing takes one away.

### How it rises

1. **Persistence.** Every week you keep the shop open grants a baseline step. This
   is the pillar made mechanical: showing up is the courtship.
2. **Quality served to her.** What you hand *her* specifically, scored by the same
   four beats. Feeding a goddess something mediocre is its own small tragedy.
3. **Dialogue choices** in her scenes.
4. **The listening mechanic** — described below, and the best one.

### The listening mechanic

Synthia mentions things in passing. An offhand line about a flavour she misses, a
texture she has not had in a long time, something from before.

Those lines are tagged in `data/scenes.js` with a research node or recipe id. If —
weeks later, entirely unprompted — you research that thing and serve it to her,
**she notices.** It grants a large affection step and fires a dedicated scene.

This is the design's best idea and the one to protect. It expresses affection
through the game's own systems rather than a dialogue tree: the player pays
attention, spends real resources on something with no mechanical reward attached,
and is met. It makes the research tree romantic. It rewards listening, which is
what a slow burn is actually made of.

Authoring cost is one optional field on a dialogue node.

### Impossible orders

She periodically orders something you cannot make yet. It is not a fail — she is
unbothered, deadpan about it, and it plants the recipe as a visible goal in the
tree. Her wanting something is how the game points you at the next research
target, so her presence drives progression even between story beats.

### Endings

Relationship tier at the end of week 8, plus accumulated choice flags, selects the
ending. The `god-synthia` VN already ships three endings and a branching structure;
same node format, same engine, so this costs writing rather than code.

Demon Synthia exists in the asset set with six expressions. Whether she appears
here is the collaborator's call — the system supports a second character with an
independent arc at zero additional engineering cost.

---

## 10. The handoff

The deliverable is not a finished game. It is **an engine plus a content format a
non-programmer can write into.** Everything above serves that.

`god-synthia` already proves the pattern: `js/story.js` is marked DATA ONLY and
holds all 691 lines of story, while `engine.js`, `ui.js`, and `main.js` hold none.

**Three things make the handoff real:**

1. **`CONTENT.md`** — one section per data file, each with a worked example that
   can be copy-pasted and edited. Written for someone who does not read JavaScript.

2. **`tools/validate.js`** — a Node script checking referential integrity: recipes
   citing missing ingredients, research nodes with dangling prerequisites, scenes
   pointing at absent sprites, affection beats referencing unknown tiers. It prints
   plain-English errors naming the file and the row.

   This is not optional polish. The `god-synthia` specialist sweep found exactly
   this class of bug — missing story nodes and absent sprites producing blank
   screens and dead clicks — and the fix was making them *visibly* diagnosable.
   The collaborator will hit these constantly while authoring. A clear error is
   the difference between a productive session and a mysterious blank page.

3. **Runtime tolerance.** Malformed content warns and skips rather than throwing.
   A broken row must never strand the player with no buttons. Same lesson, same
   source.

---

## 11. Testing

`engine/` is pure and DOM-free, so it imports straight into Node with no toolchain.

Unit tests cover: four-beat scoring (including stack compounding), quota
resolution and week rollover, research prerequisite and gate resolution, bench axis
matching and hint generation, affection accumulation and tier thresholds, and
save/load round-tripping.

`tools/validate.js` runs over the real content as an integration check.

**The making loop cannot be unit-tested for feel.** Pour, flip, and drizzle get
verified by playing them. Per the game-feel research: tested by playing the result,
not by looking at it.

---

## 12. Build order

**Phase 1 — the bones. ✅ COMPLETE 2026-09-05.** This was the handoff target.
Built, merged to `master`, pushed private. 121 unit tests, a content validator,
a balance simulator, and a headless smoke test that plays the game. Plan and
its deviations: `docs/superpowers/plans/2026-09-05-pancake-shop-phase1.md`.

1. Skeleton, ES module wiring, `index.html`, screen manager
2. `data/` files with a small but real content set
3. Day loop: morning → service → evening
4. The four-beat making loop with scoring
5. Economy, quota curve, ledger, week rollover
6. Research tree and experiment bench
7. VN layer lifted from `god-synthia`; one Synthia visit end-to-end
8. Save/load
9. `tools/validate.js` and `CONTENT.md`
10. Unit tests across `engine/`

At the end of Phase 1 the game is playable end-to-end with placeholder art and
thin content, and the collaborator can start writing.

**Phase 2 — after handoff. Priority order, informed by playing Phase 1:**

1. **Drizzle and pour onto `<canvas>`, drawn over the real stack** (§5). These
   are the two beats that currently communicate nothing about what the player
   is doing. Highest impact on how the game *feels*; no engine change needed.
2. **The collaborator's writing.** Everything in `data/scenes.js` is
   placeholder. The systems for the arc exist; the voice does not.
3. Character art beyond the reused sprites — in particular, food. Layered 2D
   composited at runtime (see the art-pipeline note below).
4. Shop decoration, audio, juice.

Original Phase 2 scope: Art, the full content pass, shop decoration, audio,
juice and polish. Explicitly deferred per the brief: back bone entirely first, art
eventually.

**Placeholder art strategy:** Synthia's existing sprites drop in unchanged. Food,
griddle, and shop furniture are CSS shapes and colour blocks on the existing
violet palette until real art exists. The game must be legible and fully playable
in placeholder form — that is what proves the bones.

### Art pipeline (Phase 2)

**The runtime is pure 2D. No 3D ships in the game.**

Food is **layered 2D sprites composited at runtime** — one sprite per pancake, per
topping, per syrup overlay, drawn stacked. This is how *Papa's Pancakeria* does it
and it is the only tractable answer to the combinatorics: pancake type × stack
height × toppings × syrup is hundreds of visual states, and one flat sprite per
state is not authorable.

**3D is optional, and useful only as an asset factory.** The failure mode of
layered compositing is inconsistent lighting and perspective between layers — the
stack reads as a collage. A 3D scene solves precisely that: model one pancake, one
plate, one griddle; light it once; render every variant from a locked camera. The
output is 2D sprites; nothing 3D enters the runtime.

Worth doing for the food and griddle if there's appetite for it. Entirely
skippable — hand-drawn or `kiln`-rendered layers work too, as long as lighting and
camera angle stay locked across the set. Decide at the start of Phase 2, not now.

---

## 13. Assets confirmed on disk

Verified 2026-09-05 in `~/vault/projects/god-synthia/`:

- **Sprites** — far more than first recorded. Eight live sets totalling ~156 PNGs
  across five wardrobes, with `.kra` Krita sources beside them so new expressions
  are authorable rather than locked:

  | Set | Count |
  |---|---|
  | `synthia_warrior/` | 30 |
  | `synthia_casual/` | 29 (the VN's default) |
  | `synthia_god/` | 26 |
  | `synthia_priestess/` | 25 |
  | `Demon_queen_pretend/` | 16 |
  | `synthia_holy/` | 12 |
  | `pancake/` | 12 |
  | `demon/` | 6 |

  (`synthia/` also exists with 5 — a superseded legacy set. Ignore it.)

  Expression keys in `synthia_casual/` include neutral, happy, excited, blush,
  curious, thinking, wink, love, shy, sweatdrop, sigh, sleepy, surprised, panic,
  pout, angry. **This directly benefits §9:** the affection arc wants her default
  expression to shift by tier, and the vocabulary for that already exists at zero
  art cost. Sprites are normalised to one canvas per set, bottom-anchored, so
  swapping expressions does not jump the frame.
- **Backgrounds** — `sanctum.jpg`, `arena.jpg`, `void.jpg`. Shop interior is new art.
- **Fonts, bundled offline** — Oswald, Inter, IBM Plex Mono, Cormorant Italic
- **CSS** — 354 lines carrying both dream (violet) and nightmare (red CRT) themes
- **Engine** — 1,879 lines total; the dialogue box, typewriter, backlog, and save
  layers are liftable rather than rewritable

---

## 14. Open questions

1. ~~**Working title**~~ — resolved, deliberately deferred. `pancake-shop` stays a
   directory name; **the collaborator names the game**, since it is their character
   and their world. Nothing in the code may hardcode a title: it lives in
   `data/economy.js` alongside the other tuning constants (or its own `data/meta.js`),
   so naming it later is a one-line edit rather than a find-and-replace.
2. ~~**Canvas or DOM**~~ — resolved by prototype, see §5. Stack stays DOM;
   pour and drizzle move to `<canvas>` in Phase 2, drawn over the real
   stack. No engine change required.
3. **Eight weeks** — the right length? Long enough for a slow burn to breathe,
   short enough to finish. `tools/simulate.js` says the quota curve works over
   8 weeks (sloppy 3/8, careful 6/8, with week 6 cleared by 266 and week 8
   missed by 239), but whether 8 weeks
   is enough time for the *relationship* to breathe is a question only reading
   the finished writing can answer. Revisit once the collaborator's scenes exist.
4. **Demon Synthia's role**, if any. Collaborator's call; system supports it free.
5. ~~**Decoration layer**~~ — resolved. Phase 2, and it does **not** feed
   reputation. Decoration is a money sink and a self-expression outlet only, per
   the cozy research's finding that self-authored goals carry cozy games. Wiring it
   into reputation would make reputation two systems wearing one name and would put
   an art-dependent feature on Phase 1's critical path. It stays cosmetic, so it
   can be added any time after handoff without touching the economy.
