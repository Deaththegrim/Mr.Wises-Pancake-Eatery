# Pancake Shop — Phase 1 (the bones) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable end-to-end pancake shop sim with placeholder art — day loop, four-beat cooking, quota, research, one Synthia visit, save/load — plus the content format and validator that make it handable to a non-programmer.

**Architecture:** Vanilla JS ES modules, no build step. `engine/` holds pure rules and never touches the DOM, so it imports directly into Node for tests. `ui/` holds DOM and holds no rules. `data/` holds content and holds no functions. Every module is a named-export ES module loaded by `<script type="module">` in the browser and by `import` in Node.

**Tech Stack:** Vanilla JS (ES2022 modules), `node:test` + `node:assert/strict` for tests (built into Node 20 — zero dependencies), static file serving via `python3 -m http.server`.

**Spec:** `docs/superpowers/specs/2026-09-05-pancake-shop-design.md`

## Global Constraints

- **Node v20.20.2** is installed. Tests use `node --test`. No npm dependencies, no `package.json` required beyond `{"type":"module"}`.
- **No build step, ever.** No bundler, no transpiler, no TypeScript. The browser loads source files directly.
- **`js/engine/*` must never reference `document`, `window`, `localStorage`, or any DOM/browser global.** It must import cleanly in Node. This is enforced by a test in Task 2.
- **`js/data/*` contains only exported constant data.** No functions, no logic, no imports from `engine/` or `ui/`. If adding a syrup requires editing a file outside `js/data/`, the architecture has failed its primary requirement.
- **File size:** soft limit 800 lines, hard limit 1500. Split before exceeding.
- **The game title is not hardcoded anywhere.** It lives in `js/data/meta.js` as `META.title`, which is `null` until the collaborator names it. UI must render a fallback when null.
- **Affection never decreases.** No code path may reduce `state.synthia.points`.
- **Reputation never decreases.** No code path may reduce `state.reputation`.
- **A failed bench experiment must always return a hint and non-zero research points.** Never an empty result.
- **Malformed content warns and skips; it never throws.** A bad data row must not strand the player with no buttons.
- **Voice:** any Synthia dialogue written follows `~/vault/projects/god-synthia/research/voice-style-guide.md` — second person present tense, hard-broken short fragments, deadpan, smart quotes `“ ”` for her spoken lines, `…` and `—`. Placeholder lines in this plan are marked and must be replaced by the collaborator.

---

## STATUS: COMPLETE — 2026-09-05

All 12 tasks executed on branch `phase1-bones`, merged to `master`, pushed to
a private repo. Final state: **121 unit tests green, validator clean, headless
smoke test plays the game with zero console errors.**

### What deviated from this plan, and why

The plan was followed task-by-task, but execution changed five things. Each is
recorded because the plan was wrong, not because the implementation drifted.

1. **Task 2 gained `TIER_POSE`.** Verifying the sprite folder turned up 8
   activity poses and 5 body angles that the spec did not know existed, so the
   affection tier now drives how she is standing as well as her expression —
   the "how long she lingers" signal at zero art cost.

2. **Task 5 uncovered a content bug the plan could not have predicted.**
   `salted_caramel` was undiscoverable: the bench averages ingredients, so
   every target must lie inside the ingredient set's reachable range. Fixed by
   adding Cream and retargeting. The check became a validator rule in Task 9.

3. **Task 6 found the affection thresholds unreachable.** DEVOTED was 90; the
   maximum achievable was 64. Retuned to 70, which made it *deliberately*
   impossible without the listening mechanic. Two tests now pin that contract.

4. **Task 8 grew two systems the plan omitted.** The 8-week simulation showed
   income was flat while quotas escalated — only 3/8 reachable. Root cause: the
   spec's "reputation raises baseline customer traffic" was never implemented.
   Added `customersToday()` and `demandShift()`, plus two customers so the
   `divine` tag had takers. Also produced `tools/simulate.js`, which is not in
   this plan and should have been: unit tests cannot tell you a game is
   balanced.

5. **Tasks 10-12 gained `tools/smoke.py`.** The plan said the UI was "verified
   by loading the page and playing it", which is not a verification anyone will
   actually repeat. A headless Playwright run that plays the game found a UI bug
   no unit test could reach, and visual review of its screenshots found four
   more. Any future plan touching UI should specify this from the start.

**Lesson for the next plan:** every task here had a test, and every test passed,
while the game itself was unplayable from week 4. Rules-correctness and
game-correctness are different properties and need different tools.

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json` | `{"type":"module"}` only — makes Node treat `.js` as ESM |
| `index.html` | Markup shell, screen containers, module entry |
| `css/style.css` | Shell, palette, themes (adapted from god-synthia) |
| `css/shop.css` | Shop-specific screens |
| `js/data/meta.js` | Title + version constants |
| `js/data/ingredients.js` | Ingredients with flavour axes |
| `js/data/recipes.js` | Recipes with per-beat targets and weights |
| `js/data/syrups.js` | Syrups; some carry discovery targets |
| `js/data/research.js` | Research tree nodes |
| `js/data/customers.js` | Customer roster |
| `js/data/scenes.js` | Synthia's VN scenes (god-synthia node format) |
| `js/data/affection.js` | Tier thresholds, grant sizes, tier→expression map |
| `js/data/economy.js` | Quota curve and every tuning constant |
| `js/engine/rng.js` | Seeded deterministic RNG |
| `js/engine/cook.js` | Four-beat scoring |
| `js/engine/economy.js` | Money, quota, reputation, week rollover |
| `js/engine/research.js` | Tree resolution, bench axis matching, hints |
| `js/engine/affection.js` | Synthia's arc, tiers, listening mechanic |
| `js/engine/state.js` | Game state, serialize/deserialize |
| `js/engine/day.js` | Day orchestration, customer flow, repeat penalty |
| `js/ui/screens.js` | Screen manager |
| `js/ui/shopfront.js` | Morning/service/evening screens |
| `js/ui/griddle.js` | The interactive four beats |
| `js/ui/tree.js` | Research tree + bench UI |
| `js/ui/ledger.js` | Takings, quota board |
| `js/ui/vn.js` | Dialogue box, typewriter, choices |
| `js/main.js` | Bootstrap and wiring |
| `tools/validate.js` | Content integrity checker (Node) |
| `tests/*.test.js` | One test file per engine module |
| `CONTENT.md` | Handoff guide for the collaborator |
| `README.md` | How to run it |

---

## Task 1: Project skeleton, test harness, seeded RNG

**Files:**
- Create: `package.json`, `js/engine/rng.js`, `tests/rng.test.js`, `.gitignore` (already exists — verify)

**Interfaces:**
- Consumes: nothing
- Produces: `makeRng(seed: number) -> () => number` returning floats in `[0,1)`; `pick(rng, array) -> element`; `randInt(rng, min, max) -> integer` inclusive of both bounds

- [x] **Step 1: Create `package.json`**

```json
{
  "name": "pancake-shop",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "validate": "node tools/validate.js"
  }
}
```

- [x] **Step 2: Write the failing test**

Create `tests/rng.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, pick, randInt } from '../js/engine/rng.js';

test('same seed produces the same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = makeRng(1), b = makeRng(2);
  assert.notEqual(a(), b());
});

test('values stay in [0,1)', () => {
  const r = makeRng(7);
  for (let i = 0; i < 200; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('randInt is inclusive of both bounds', () => {
  const r = makeRng(3);
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(randInt(r, 1, 3));
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test('pick returns an element of the array', () => {
  const r = makeRng(9);
  const arr = ['a', 'b', 'c'];
  for (let i = 0; i < 50; i++) assert.ok(arr.includes(pick(r, arr)));
});

test('pick on an empty array returns undefined', () => {
  assert.equal(pick(makeRng(1), []), undefined);
});
```

- [x] **Step 3: Run test to verify it fails**

Run: `node --test tests/rng.test.js`
Expected: FAIL — `Cannot find module '../js/engine/rng.js'`

- [x] **Step 4: Write minimal implementation**

Create `js/engine/rng.js`:

```js
// Deterministic PRNG (mulberry32). Seeded so tests and replays are reproducible.

export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick(rng, array) {
  if (!array || array.length === 0) return undefined;
  return array[Math.floor(rng() * array.length)];
}
```

- [x] **Step 5: Run tests to verify they pass**

Run: `node --test tests/rng.test.js`
Expected: PASS, 6 tests

- [x] **Step 6: Commit**

```bash
git add package.json js/engine/rng.js tests/rng.test.js
git commit -m "feat: project skeleton, node:test harness, seeded RNG"
```

---

## Task 2: Content data files and the DOM-purity guard

**Files:**
- Create: `js/data/meta.js`, `js/data/economy.js`, `js/data/ingredients.js`, `js/data/recipes.js`, `js/data/syrups.js`, `js/data/research.js`, `js/data/customers.js`, `js/data/affection.js`
- Create: `tests/data.test.js`

**Interfaces:**
- Consumes: nothing
- Produces: `META`, `QUOTA_CURVE`, `TUNING`, `INGREDIENTS`, `RECIPES`, `SYRUPS`, `RESEARCH`, `CUSTOMERS`, `TIER_THRESHOLDS`, `TIER_ORDER`, `GRANTS`, `TIER_EXPRESSION` — all frozen arrays/objects of plain data

- [x] **Step 1: Write the failing test**

Create `tests/data.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { INGREDIENTS } from '../js/data/ingredients.js';
import { RECIPES } from '../js/data/recipes.js';
import { SYRUPS } from '../js/data/syrups.js';
import { RESEARCH } from '../js/data/research.js';
import { CUSTOMERS } from '../js/data/customers.js';
import { QUOTA_CURVE, TUNING } from '../js/data/economy.js';
import { META } from '../js/data/meta.js';
import { TIER_ORDER, TIER_THRESHOLDS, TIER_EXPRESSION } from '../js/data/affection.js';

const AXES = ['sweet', 'sharp', 'rich', 'strange'];

test('every ingredient has all four axes as numbers', () => {
  for (const ing of INGREDIENTS) {
    for (const ax of AXES) {
      assert.equal(typeof ing.axes[ax], 'number', `${ing.id} missing axis ${ax}`);
    }
  }
});

test('ids are unique within each collection', () => {
  for (const [name, coll] of Object.entries({ INGREDIENTS, RECIPES, SYRUPS, RESEARCH, CUSTOMERS })) {
    const ids = coll.map(x => x.id);
    assert.equal(new Set(ids).size, ids.length, `${name} has duplicate ids`);
  }
});

test('at least one recipe is available at start', () => {
  assert.ok(RECIPES.some(r => r.unlockedAtStart), 'no starting recipe — game unplayable');
});

test('recipes declare all four beat weights', () => {
  for (const r of RECIPES) {
    for (const beat of ['pour', 'flip', 'stack', 'drizzle']) {
      assert.equal(typeof r.weights[beat], 'number', `${r.id} missing weight ${beat}`);
    }
  }
});

test('quota curve is strictly increasing', () => {
  for (let i = 1; i < QUOTA_CURVE.length; i++) {
    assert.ok(QUOTA_CURVE[i] > QUOTA_CURVE[i - 1], `quota week ${i + 1} not greater than week ${i}`);
  }
});

test('title is null so the collaborator can name it', () => {
  assert.equal(META.title, null);
});

test('affection tiers are ordered and every tier maps to an expression', () => {
  let prev = -1;
  for (const tier of TIER_ORDER) {
    assert.ok(TIER_THRESHOLDS[tier] > prev, `${tier} threshold not increasing`);
    prev = TIER_THRESHOLDS[tier];
    assert.equal(typeof TIER_EXPRESSION[tier], 'string', `${tier} has no expression`);
  }
});

test('tuning constants exist', () => {
  for (const k of ['repeatPenaltyStep', 'repeatPenaltyFloor', 'reputationPerQuality', 'benchFailPoints']) {
    assert.equal(typeof TUNING[k], 'number', `TUNING.${k} missing`);
  }
});

// The architectural guard. engine/ must import cleanly in Node.
test('no engine module references DOM globals', () => {
  const dir = new URL('../js/engine/', import.meta.url);
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(new URL(f, dir), 'utf8');
    for (const banned of ['document.', 'window.', 'localStorage', 'navigator.']) {
      assert.ok(!src.includes(banned), `js/engine/${f} references ${banned} — engine must stay DOM-free`);
    }
  }
});

// data/ must stay data.
test('no data module declares a function or imports', () => {
  const dir = new URL('../js/data/', import.meta.url);
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/\bfunction\b/.test(src), `js/data/${f} declares a function — data files hold data only`);
    assert.ok(!/^\s*import\s/m.test(src), `js/data/${f} has an import — data files must be standalone`);
  }
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/data.test.js`
Expected: FAIL — cannot find `../js/data/ingredients.js`

- [x] **Step 3: Create `js/data/meta.js`**

```js
/* META — identity constants.
   title stays null until the collaborator names the game. Nothing else
   may hardcode a title; the UI renders a fallback when this is null. */

export const META = {
  title: null,
  saveVersion: 1,
  saveKey: 'pancake-shop-save'
};
```

- [x] **Step 4: Create `js/data/economy.js`**

```js
/* ECONOMY — the quota curve and every tuning constant.
   These numbers are placeholders and are expected to be wrong. Tune them
   from play. Nothing here is referenced by name outside engine/economy.js
   and engine/day.js, so changing a value is always safe. */

// Week 1 is deliberately trivial (soft onboarding). Escalation is ~2.2x,
// which outpaces linear growth so week-1 tactics cannot simply be repeated.
export const QUOTA_CURVE = [300, 700, 1600, 3600, 8000, 18000, 40000, 90000];

export const TUNING = {
  // Diminishing returns: each repeat of the same recipe in one day earns
  // this much less, never dropping below the floor. Soft, uncapped.
  repeatPenaltyStep: 0.12,
  repeatPenaltyFloor: 0.45,

  // Quality 0-100 maps onto this payout multiplier range.
  payoutMinMultiplier: 0.5,
  payoutMaxMultiplier: 1.5,

  // Tips only start above this quality, then scale to maxTipRate of base.
  tipThreshold: 60,
  maxTipRate: 0.4,

  // Reputation gain per dish = quality * this. Never negative.
  reputationPerQuality: 0.02,

  // Research points.
  pointsPerNewRecipeServed: 3,
  pointsPerHighQuality: 1,       // awarded when quality >= highQualityAt
  highQualityAt: 85,
  benchFailPoints: 1             // a failed experiment ALWAYS pays this
};
```

- [x] **Step 5: Create `js/data/ingredients.js`**

```js
/* INGREDIENTS — flavour axes drive bench discovery.
   axes: sweet / sharp / rich / strange, each roughly 0-10.
   To add an ingredient, copy a row and change the values. */

export const INGREDIENTS = [
  { id: 'flour',      name: 'Flour',           cost: 1, axes: { sweet: 1, sharp: 0, rich: 2, strange: 0 } },
  { id: 'buttermilk', name: 'Buttermilk',      cost: 2, axes: { sweet: 2, sharp: 3, rich: 4, strange: 0 } },
  { id: 'butter',     name: 'Butter',          cost: 2, axes: { sweet: 1, sharp: 0, rich: 8, strange: 0 } },
  { id: 'maple',      name: 'Maple Sap',       cost: 3, axes: { sweet: 8, sharp: 1, rich: 4, strange: 0 } },
  { id: 'lemon',      name: 'Lemon',           cost: 2, axes: { sweet: 1, sharp: 9, rich: 0, strange: 1 } },
  { id: 'blueberry',  name: 'Blueberry',       cost: 3, axes: { sweet: 6, sharp: 3, rich: 1, strange: 0 } },
  { id: 'saltflake',  name: 'Salt Flake',      cost: 1, axes: { sweet: 0, sharp: 6, rich: 1, strange: 2 } },
  { id: 'starlight',  name: 'Bottled Starlight', cost: 8, axes: { sweet: 4, sharp: 2, rich: 3, strange: 9 } },
  { id: 'ashsugar',   name: 'Ash Sugar',       cost: 6, axes: { sweet: 7, sharp: 2, rich: 5, strange: 6 } }
];
```

- [x] **Step 6: Create `js/data/recipes.js`**

```js
/* RECIPES — one row per dish.
   pour.target / pour.band  : ml of batter, and the perfect-score window
   flip.windowMs            : half-width of the perfect flip window
   stackCount               : how many pancakes in the stack
   weights                  : how much each beat matters for THIS dish.
                              A souffle lives on the flip; a tall stack on
                              alignment. Four numbers change the whole feel. */

export const RECIPES = [
  {
    id: 'plain', name: 'Plain Stack', tags: ['basic'], base: 12,
    ingredients: ['flour', 'buttermilk'],
    pour: { target: 50, band: 10 },
    flip: { windowMs: 500 },
    stackCount: 3,
    weights: { pour: 1, flip: 1, stack: 1, drizzle: 1 },
    unlockedAtStart: true
  },
  {
    id: 'buttermilk_stack', name: 'Buttermilk Stack', tags: ['basic', 'rich'], base: 20,
    ingredients: ['flour', 'buttermilk', 'butter'],
    pour: { target: 60, band: 8 },
    flip: { windowMs: 420 },
    stackCount: 4,
    weights: { pour: 1, flip: 1.5, stack: 1.5, drizzle: 1 },
    unlockedAtStart: false
  },
  {
    id: 'souffle', name: 'Souffle Pancake', tags: ['delicate'], base: 45,
    ingredients: ['flour', 'buttermilk', 'butter'],
    pour: { target: 40, band: 5 },
    flip: { windowMs: 250 },
    stackCount: 2,
    weights: { pour: 1.5, flip: 3, stack: 0.5, drizzle: 1 },
    unlockedAtStart: false
  },
  {
    id: 'impossible', name: 'Impossible Stack', tags: ['divine'], base: 120,
    ingredients: ['flour', 'buttermilk', 'butter', 'starlight'],
    pour: { target: 55, band: 6 },
    flip: { windowMs: 300 },
    stackCount: 7,
    weights: { pour: 1, flip: 1.5, stack: 3, drizzle: 1.5 },
    unlockedAtStart: false
  }
];
```

- [x] **Step 7: Create `js/data/syrups.js`**

```js
/* SYRUPS.
   axes    : what it tastes like when used on a dish
   discover: present only if it must be FOUND at the bench.
             target = the axis profile to hit, tolerance = how close counts,
             tier   = rough difficulty band, used for directional hints. */

export const SYRUPS = [
  { id: 'maple_syrup', name: 'Maple Syrup', cost: 3, unlockedAtStart: true,
    axes: { sweet: 8, sharp: 1, rich: 5, strange: 0 } },

  { id: 'lemon_glaze', name: 'Lemon Glaze', cost: 4, unlockedAtStart: false,
    axes: { sweet: 5, sharp: 8, rich: 1, strange: 0 },
    discover: { target: { sweet: 5, sharp: 8, rich: 1, strange: 0 }, tolerance: 4, tier: 1 } },

  { id: 'salted_caramel', name: 'Salted Caramel', cost: 5, unlockedAtStart: false,
    axes: { sweet: 8, sharp: 5, rich: 7, strange: 1 },
    discover: { target: { sweet: 8, sharp: 5, rich: 7, strange: 1 }, tolerance: 4, tier: 2 } },

  { id: 'void_syrup', name: 'Void Syrup', cost: 9, unlockedAtStart: false,
    axes: { sweet: 6, sharp: 3, rich: 4, strange: 9 },
    discover: { target: { sweet: 6, sharp: 3, rich: 4, strange: 9 }, tolerance: 3, tier: 3 } }
];
```

- [x] **Step 8: Create `js/data/research.js`**

```js
/* RESEARCH — the visible tree.
   cost    : research points
   prereqs : other node ids that must be purchased first
   gate    : optional real-world requirement, e.g. cook something N times
   unlocks : exactly one of { recipe | syrup | upgrade }

   Upgrades buy away ERROR, never power. A griddle alarm marks the flip
   window; a measured ladle narrows the pour band; a stack guide shows the
   centre line. The game gets calmer as you progress. */

export const RESEARCH = [
  { id: 'r_buttermilk', name: 'Buttermilk Technique', cost: 3, prereqs: [],
    gate: { cooked: { plain: 5 } }, unlocks: { recipe: 'buttermilk_stack' } },

  { id: 'r_ladle', name: 'Measured Ladle', cost: 4, prereqs: [],
    gate: null, unlocks: { upgrade: 'pour_band_bonus' } },

  { id: 'r_alarm', name: 'Griddle Alarm', cost: 6, prereqs: ['r_buttermilk'],
    gate: null, unlocks: { upgrade: 'flip_window_bonus' } },

  { id: 'r_souffle', name: 'Souffle Method', cost: 10, prereqs: ['r_buttermilk'],
    gate: { cooked: { buttermilk_stack: 8 } }, unlocks: { recipe: 'souffle' } },

  { id: 'r_guide', name: 'Stack Guide', cost: 8, prereqs: ['r_ladle'],
    gate: null, unlocks: { upgrade: 'stack_forgiveness' } },

  { id: 'r_impossible', name: 'The Impossible Stack', cost: 25, prereqs: ['r_souffle', 'r_guide'],
    gate: { cooked: { souffle: 5 } }, unlocks: { recipe: 'impossible' } }
];

/* Upgrade effects, keyed by the id in unlocks.upgrade. Applied in engine/cook.js. */
export const UPGRADE_EFFECTS = {
  pour_band_bonus:   { pourBandPlus: 4 },
  flip_window_bonus: { flipWindowPlus: 150 },
  stack_forgiveness: { stackDriftScale: 0.7 }
};
```

- [x] **Step 9: Create `js/data/customers.js`**

```js
/* CUSTOMERS — the roster grows as reputation does.
   wants    : recipe tags they'll order
   unlockAt : { week } and/or { reputation }

   There is deliberately NO patience field. The game has no clock, so a
   patience value would be a number nothing could ever decrement.
   Customers wait indefinitely and without complaint.

   Lines below are placeholders. The collaborator replaces them. */

export const CUSTOMERS = [
  { id: 'first_light', name: 'A Regular', unlockAt: { week: 1 }, wants: ['basic'],
    lines: { greeting: 'Morning. The usual.', happy: 'That is the one.', disappointed: 'It was fine.' } },

  { id: 'the_courier', name: 'The Courier', unlockAt: { week: 1 }, wants: ['basic'],
    lines: { greeting: 'Quick one. Still warm, ideally.', happy: 'Still warm. Good.', disappointed: 'It travelled badly.' } },

  { id: 'night_shift', name: 'Night Shift', unlockAt: { week: 2 }, wants: ['basic', 'rich'],
    lines: { greeting: 'Something heavy. It has been a long one.', happy: 'That will hold.', disappointed: 'Hm.' } },

  { id: 'the_critic', name: 'The Critic', unlockAt: { reputation: 40 }, wants: ['delicate'],
    lines: { greeting: 'Show me something you are proud of.', happy: 'Well. Yes.', disappointed: 'You rushed it.' } }
];
```

- [x] **Step 10: Create `js/data/affection.js`**

```js
/* SYNTHIA'S ARC.

   The player NEVER sees these numbers. No meter, no hearts, no bar — a
   visible bar turns a slow burn into a grind target and kills it.
   The arc is expressed through her default expression, how long she
   lingers, and what she says. The player should feel the change before
   they can name it.

   Affection can stall. It can never fall. This is a cozy game.

   Expression keys below are real files in
   ~/vault/projects/god-synthia/assets/sprites/synthia_casual/ (29 sprites). */

export const TIER_ORDER = ['STRANGER', 'REGULAR', 'FAMILIAR', 'CONFIDANT', 'DEVOTED'];

export const TIER_THRESHOLDS = {
  STRANGER: 0,
  REGULAR: 12,
  FAMILIAR: 30,
  CONFIDANT: 55,
  DEVOTED: 90
};

export const TIER_EXPRESSION = {
  STRANGER: 'neutral',
  REGULAR: 'curious',
  FAMILIAR: 'thinking',
  CONFIDANT: 'happy',
  DEVOTED: 'love'
};

export const GRANTS = {
  // Showing up is the courtship. Awarded every week the shop opened.
  weeklyPersistence: 2,
  // Serving HER something good. Scaled by quality/100.
  qualityServedMax: 3,
  // She mentioned something in passing; weeks later you researched it and
  // served it, unprompted. This is the arc's best beat — keep it large.
  listening: 8,
  // Dialogue choices carry their own value in scenes.js.
  choiceDefault: 1
};
```

- [x] **Step 11: Run tests to verify they pass**

Run: `node --test tests/data.test.js`
Expected: PASS, 10 tests. The DOM-purity and data-purity guards pass trivially now (no engine modules yet beyond `rng.js`) and stay green as a regression net for every later task.

- [x] **Step 12: Commit**

```bash
git add package.json js/data tests/data.test.js
git commit -m "feat: content data files + DOM-purity and data-purity guards"
```

---

## Task 3: Four-beat cooking scores

**Files:**
- Create: `js/engine/cook.js`, `tests/cook.test.js`

**Interfaces:**
- Consumes: `UPGRADE_EFFECTS` from `js/data/research.js`
- Produces:
  - `scorePour(volume: number, target: number, band: number) -> number` (0–100)
  - `scoreFlip(msOffset: number, windowMs: number) -> number` (0–100)
  - `scoreStack(offsets: number[], driftScale?: number) -> number` (0–100)
  - `scoreDrizzle(coverage: number[]) -> number` (0–100)
  - `effectsFor(upgrades: string[]) -> {pourBandPlus, flipWindowPlus, stackDriftScale}`
  - `scoreDish(recipe, beats: {volume, msOffset, offsets, coverage}, upgrades: string[]) -> {quality: number, breakdown: {pour, flip, stack, drizzle}}`

- [x] **Step 1: Write the failing test**

Create `tests/cook.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePour, scoreFlip, scoreStack, scoreDrizzle, scoreDish, effectsFor } from '../js/engine/cook.js';
import { RECIPES } from '../js/data/recipes.js';

test('pour inside the band is perfect', () => {
  assert.equal(scorePour(50, 50, 10), 100);
  assert.equal(scorePour(58, 50, 10), 100);
});

test('pour degrades outside the band and never goes negative', () => {
  const near = scorePour(65, 50, 10);
  const far = scorePour(120, 50, 10);
  assert.ok(near > 0 && near < 100, `near should be partial, got ${near}`);
  assert.ok(far >= 0, 'score must never be negative');
  assert.ok(near > far, 'closer pours must score higher');
});

test('flip window is symmetric and forgiving', () => {
  assert.equal(scoreFlip(0, 500), 100);
  assert.equal(scoreFlip(400, 500), 100);
  assert.equal(scoreFlip(-400, 500), 100);
  assert.equal(scoreFlip(700, 500), scoreFlip(-700, 500));
});

test('flip falls off gradually, not off a cliff', () => {
  const justOut = scoreFlip(600, 500);
  assert.ok(justOut > 80, `just outside the window should still be decent, got ${justOut}`);
});

test('stack error compounds - an early offset costs more than a late one', () => {
  const early = scoreStack([10, 0, 0, 0]);
  const late  = scoreStack([0, 0, 0, 10]);
  assert.ok(early < late, `early offset (${early}) must cost more than late (${late})`);
});

test('a perfectly centred stack scores 100', () => {
  assert.equal(scoreStack([0, 0, 0]), 100);
});

test('drizzle rewards even coverage', () => {
  const even   = scoreDrizzle([0.7, 0.7, 0.7, 0.7, 0.7, 0.7]);
  const patchy = scoreDrizzle([1.0, 0.0, 1.0, 0.0, 1.0, 0.0]);
  assert.ok(even > patchy, `even (${even}) must beat patchy (${patchy})`);
  assert.ok(even > 85);
});

test('drizzle punishes bare edges and pooling', () => {
  const bare   = scoreDrizzle([0.7, 0.7, 0.0, 0.0, 0.7, 0.7]);
  const pooled = scoreDrizzle([1.0, 1.0, 1.0, 0.7, 0.7, 0.7]);
  assert.ok(bare < 100 && pooled < 100);
});

test('all scores clamp to 0..100', () => {
  for (const v of [scorePour(9999, 50, 10), scoreFlip(99999, 500), scoreStack([500, 500, 500]), scoreDrizzle([0, 0, 0])]) {
    assert.ok(v >= 0 && v <= 100, `out of range: ${v}`);
  }
});

test('per-recipe weights change the quality for identical execution', () => {
  const souffle = RECIPES.find(r => r.id === 'souffle');
  const impossible = RECIPES.find(r => r.id === 'impossible');
  // Bad flip, perfect everything else.
  const beats = { volume: souffle.pour.target, msOffset: 5000, offsets: [0, 0], coverage: [0.7, 0.7, 0.7, 0.7] };
  const s = scoreDish(souffle, beats, []);
  const i = scoreDish(impossible, { ...beats, volume: impossible.pour.target, offsets: [0, 0] }, []);
  assert.ok(s.quality < i.quality, 'a blown flip must hurt the souffle more (flip weight 3 vs 1.5)');
});

test('breakdown reports all four beats', () => {
  const r = RECIPES.find(x => x.id === 'plain');
  const out = scoreDish(r, { volume: 50, msOffset: 0, offsets: [0, 0, 0], coverage: [0.7, 0.7, 0.7] }, []);
  assert.deepEqual(Object.keys(out.breakdown).sort(), ['drizzle', 'flip', 'pour', 'stack']);
  assert.equal(out.quality, 100);
});

test('upgrades widen tolerances rather than adding power', () => {
  const e = effectsFor(['pour_band_bonus', 'flip_window_bonus']);
  assert.equal(e.pourBandPlus, 4);
  assert.equal(e.flipWindowPlus, 150);
  const r = RECIPES.find(x => x.id === 'plain');
  const beats = { volume: 62, msOffset: 600, offsets: [0, 0, 0], coverage: [0.7, 0.7, 0.7] };
  const without = scoreDish(r, beats, []).quality;
  const withUp  = scoreDish(r, beats, ['pour_band_bonus', 'flip_window_bonus']).quality;
  assert.ok(withUp > without, `upgrades must improve a marginal execution (${without} -> ${withUp})`);
});

test('effectsFor ignores unknown upgrade ids', () => {
  const e = effectsFor(['nonsense']);
  assert.equal(e.pourBandPlus, 0);
  assert.equal(e.stackDriftScale, 1);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/cook.test.js`
Expected: FAIL — cannot find `../js/engine/cook.js`

- [x] **Step 3: Write the implementation**

Create `js/engine/cook.js`:

```js
import { UPGRADE_EFFECTS } from '../data/research.js';

const clamp100 = n => Math.max(0, Math.min(100, Math.round(n)));

/* Tolerance windows are "oil", not "juice" — the coyote-time family.
   Forgiving by default; mastery is hitting perfect, not avoiding failure. */

export function scorePour(volume, target, band) {
  const dev = Math.abs(volume - target);
  if (dev <= band) return 100;
  const falloff = band * 3;
  return clamp100(100 * (1 - (dev - band) / falloff));
}

export function scoreFlip(msOffset, windowMs) {
  const dev = Math.abs(msOffset);
  if (dev <= windowMs) return 100;
  const falloff = windowMs * 4;
  return clamp100(100 * (1 - (dev - windowMs) / falloff));
}

/* Stack error COMPOUNDS. Each pancake's offset shifts the running centre,
   and every later pancake is measured against that drifted centre. An
   off-centre first pancake leans the whole tower and cannot be fixed. */
export function scoreStack(offsets, driftScale = 1) {
  if (!offsets || offsets.length === 0) return 100;
  let drift = 0, penalty = 0;
  for (const o of offsets) {
    drift += o;
    penalty += Math.abs(drift);
  }
  const avgDrift = (penalty / offsets.length) * driftScale;
  return clamp100(100 - avgDrift * 2);
}

/* Coverage is an array of cell fill values 0..1 across the stack's top.
   Ideal is even and generous without pooling. */
export function scoreDrizzle(coverage) {
  if (!coverage || coverage.length === 0) return 0;
  const n = coverage.length;
  const mean = coverage.reduce((a, b) => a + b, 0) / n;
  const variance = coverage.reduce((a, c) => a + (c - mean) ** 2, 0) / n;
  const bare = coverage.filter(c => c < 0.1).length / n;
  const pooled = coverage.filter(c => c > 0.95).length / n;
  const thin = mean < 0.3 ? (0.3 - mean) * 100 : 0;
  return clamp100(100 - variance * 200 - bare * 60 - pooled * 40 - thin);
}

export function effectsFor(upgrades = []) {
  const out = { pourBandPlus: 0, flipWindowPlus: 0, stackDriftScale: 1 };
  for (const id of upgrades) {
    const eff = UPGRADE_EFFECTS[id];
    if (!eff) continue;
    if (eff.pourBandPlus)   out.pourBandPlus   += eff.pourBandPlus;
    if (eff.flipWindowPlus) out.flipWindowPlus += eff.flipWindowPlus;
    if (eff.stackDriftScale) out.stackDriftScale *= eff.stackDriftScale;
  }
  return out;
}

export function scoreDish(recipe, beats, upgrades = []) {
  const e = effectsFor(upgrades);
  const breakdown = {
    pour:    scorePour(beats.volume, recipe.pour.target, recipe.pour.band + e.pourBandPlus),
    flip:    scoreFlip(beats.msOffset, recipe.flip.windowMs + e.flipWindowPlus),
    stack:   scoreStack(beats.offsets, e.stackDriftScale),
    drizzle: scoreDrizzle(beats.coverage)
  };
  const w = recipe.weights;
  const total = w.pour + w.flip + w.stack + w.drizzle;
  const quality = clamp100(
    (breakdown.pour * w.pour + breakdown.flip * w.flip +
     breakdown.stack * w.stack + breakdown.drizzle * w.drizzle) / total
  );
  return { quality, breakdown };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test tests/cook.test.js`
Expected: PASS, 13 tests

- [x] **Step 5: Run the whole suite to check nothing regressed**

Run: `node --test tests/`
Expected: PASS, all files

- [x] **Step 6: Commit**

```bash
git add js/engine/cook.js tests/cook.test.js
git commit -m "feat: four-beat cooking scores with compounding stack error"
```

---

## Task 4: Economy — payout, tips, reputation, quota, week rollover

**Files:**
- Create: `js/engine/economy.js`, `tests/economy.test.js`

**Interfaces:**
- Consumes: `QUOTA_CURVE`, `TUNING` from `js/data/economy.js`
- Produces:
  - `quotaForWeek(week: number) -> number` (week is 1-based; past the curve it keeps scaling)
  - `qualityMultiplier(quality: number) -> number`
  - `payoutFor(recipe, quality: number, repeatCount: number) -> number` (integer)
  - `tipFor(basePayout: number, quality: number) -> number` (integer)
  - `reputationGain(quality: number) -> number`
  - `repeatMultiplier(repeatCount: number) -> number`
  - `rollWeek(state) -> {met: boolean, quota: number, earned: number, week: number}`

- [x] **Step 1: Write the failing test**

Create `tests/economy.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quotaForWeek, qualityMultiplier, payoutFor, tipFor, reputationGain, repeatMultiplier, rollWeek } from '../js/engine/economy.js';
import { QUOTA_CURVE } from '../js/data/economy.js';
import { RECIPES } from '../js/data/recipes.js';

const plain = RECIPES.find(r => r.id === 'plain');

test('quota follows the curve and week 1 is trivial', () => {
  assert.equal(quotaForWeek(1), QUOTA_CURVE[0]);
  assert.equal(quotaForWeek(8), QUOTA_CURVE[7]);
  assert.ok(quotaForWeek(1) < quotaForWeek(2));
});

test('quota keeps escalating past the end of the curve', () => {
  const last = QUOTA_CURVE[QUOTA_CURVE.length - 1];
  assert.ok(quotaForWeek(9) > last, 'must not fall off the end');
});

test('quota rejects a non-positive week', () => {
  assert.throws(() => quotaForWeek(0));
});

test('quality multiplier spans the tuned range', () => {
  assert.ok(qualityMultiplier(0) < qualityMultiplier(100));
  assert.ok(qualityMultiplier(100) > 1);
});

test('better quality pays more', () => {
  assert.ok(payoutFor(plain, 100, 0) > payoutFor(plain, 30, 0));
});

test('repeating the same recipe pays less, with a floor', () => {
  const first = repeatMultiplier(0);
  const fifth = repeatMultiplier(4);
  const fiftieth = repeatMultiplier(49);
  assert.equal(first, 1);
  assert.ok(fifth < first, 'repeats must diminish');
  assert.ok(fiftieth >= 0.45, 'must never fall below the floor');
});

test('tips only appear above the threshold', () => {
  assert.equal(tipFor(100, 40), 0);
  assert.ok(tipFor(100, 95) > 0);
});

test('reputation gain is never negative, even for terrible work', () => {
  assert.ok(reputationGain(0) >= 0);
  assert.ok(reputationGain(100) > reputationGain(10));
});

test('rollWeek reports meeting the quota', () => {
  const state = { week: 1, weekEarnings: 500, reputation: 0 };
  const r = rollWeek(state);
  assert.equal(r.met, true);
  assert.equal(r.quota, QUOTA_CURVE[0]);
  assert.equal(r.week, 1);
});

test('rollWeek reports missing the quota without penalising anything', () => {
  const state = { week: 1, weekEarnings: 10, reputation: 25, money: 999 };
  const before = { ...state };
  const r = rollWeek(state);
  assert.equal(r.met, false);
  assert.equal(state.money, before.money, 'missing a quota must cost no money');
  assert.equal(state.reputation, before.reputation, 'missing a quota must cost no reputation');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/economy.test.js`
Expected: FAIL — cannot find `../js/engine/economy.js`

- [x] **Step 3: Write the implementation**

Create `js/engine/economy.js`:

```js
import { QUOTA_CURVE, TUNING } from '../data/economy.js';

export function quotaForWeek(week) {
  if (!Number.isInteger(week) || week < 1) throw new Error(`week must be a positive integer, got ${week}`);
  if (week <= QUOTA_CURVE.length) return QUOTA_CURVE[week - 1];
  // Past the authored curve, keep the same ratchet going.
  const last = QUOTA_CURVE[QUOTA_CURVE.length - 1];
  const prev = QUOTA_CURVE[QUOTA_CURVE.length - 2] || last / 2;
  const ratio = last / prev;
  return Math.round(last * Math.pow(ratio, week - QUOTA_CURVE.length));
}

export function qualityMultiplier(quality) {
  const q = Math.max(0, Math.min(100, quality)) / 100;
  const { payoutMinMultiplier: lo, payoutMaxMultiplier: hi } = TUNING;
  return lo + (hi - lo) * q;
}

/* Diminishing returns within a single day. Soft and uncapped — the player
   feels the nudge toward variety without hitting a wall. */
export function repeatMultiplier(repeatCount) {
  const m = 1 - TUNING.repeatPenaltyStep * repeatCount;
  return Math.max(TUNING.repeatPenaltyFloor, m);
}

export function payoutFor(recipe, quality, repeatCount = 0) {
  return Math.round(recipe.base * qualityMultiplier(quality) * repeatMultiplier(repeatCount));
}

export function tipFor(basePayout, quality) {
  if (quality < TUNING.tipThreshold) return 0;
  const span = 100 - TUNING.tipThreshold;
  const t = span === 0 ? 1 : (quality - TUNING.tipThreshold) / span;
  return Math.round(basePayout * TUNING.maxTipRate * t);
}

/* Reputation rises with quality and NEVER falls. A bad day stalls it;
   it does not undo weeks of work. */
export function reputationGain(quality) {
  return Math.max(0, quality * TUNING.reputationPerQuality);
}

/* The quota is the story metronome, not a survival threshold. rollWeek
   REPORTS the outcome and mutates nothing punitive. The caller decides
   which scene to fire. */
export function rollWeek(state) {
  const quota = quotaForWeek(state.week);
  return {
    met: state.weekEarnings >= quota,
    quota,
    earned: state.weekEarnings,
    week: state.week
  };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test tests/economy.test.js`
Expected: PASS, 10 tests

- [x] **Step 5: Commit**

```bash
git add js/engine/economy.js tests/economy.test.js
git commit -m "feat: economy - payout, tips, reputation, quota rollover with no punishment"
```

---

## Task 5: Research tree and the experiment bench

**Files:**
- Create: `js/engine/research.js`, `tests/research.test.js`

**Interfaces:**
- Consumes: `RESEARCH` from `js/data/research.js`, `INGREDIENTS` from `js/data/ingredients.js`, `SYRUPS` from `js/data/syrups.js`, `TUNING` from `js/data/economy.js`
- Produces:
  - `gateMet(node, state) -> boolean`
  - `isAvailable(node, state) -> boolean`
  - `availableNodes(state) -> node[]`
  - `purchase(state, nodeId) -> {ok: true, node} | {ok: false, reason: string}` (mutates `state` on success)
  - `blendAxes(ingredientIds: string[]) -> {sweet, sharp, rich, strange}`
  - `axisDistance(blend, target) -> number`
  - `hintFor(blend, target) -> string`
  - `experiment(state, ingredientIds) -> {found: boolean, syrupId?, hint?, points: number}`

- [x] **Step 1: Write the failing test**

Create `tests/research.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateMet, isAvailable, availableNodes, purchase, blendAxes, axisDistance, hintFor, experiment } from '../js/engine/research.js';
import { RESEARCH } from '../js/data/research.js';
import { SYRUPS } from '../js/data/syrups.js';

const baseState = () => ({
  points: 100, purchased: [], cooked: {}, unlockedRecipes: ['plain'],
  unlockedSyrups: ['maple_syrup'], upgrades: []
});

test('a node with unmet prereqs is unavailable', () => {
  const s = baseState();
  const alarm = RESEARCH.find(n => n.id === 'r_alarm');   // needs r_buttermilk
  assert.equal(isAvailable(alarm, s), false);
});

test('a node with an unmet cook gate is unavailable', () => {
  const s = baseState();
  const bm = RESEARCH.find(n => n.id === 'r_buttermilk'); // needs plain cooked 5x
  assert.equal(gateMet(bm, s), false);
  s.cooked.plain = 5;
  assert.equal(gateMet(bm, s), true);
});

test('a node with a null gate is always gate-met', () => {
  const ladle = RESEARCH.find(n => n.id === 'r_ladle');
  assert.equal(gateMet(ladle, baseState()), true);
});

test('purchase deducts points, records the node, and applies the unlock', () => {
  const s = baseState();
  s.cooked.plain = 5;
  const r = purchase(s, 'r_buttermilk');
  assert.equal(r.ok, true);
  assert.ok(s.purchased.includes('r_buttermilk'));
  assert.ok(s.unlockedRecipes.includes('buttermilk_stack'));
  assert.equal(s.points, 100 - 3);
});

test('purchasing an upgrade adds it to upgrades, not recipes', () => {
  const s = baseState();
  const r = purchase(s, 'r_ladle');
  assert.equal(r.ok, true);
  assert.ok(s.upgrades.includes('pour_band_bonus'));
  assert.equal(s.unlockedRecipes.includes('pour_band_bonus'), false);
});

test('purchase fails clearly when points are short', () => {
  const s = baseState();
  s.points = 0;
  s.cooked.plain = 5;
  const r = purchase(s, 'r_buttermilk');
  assert.equal(r.ok, false);
  assert.match(r.reason, /points/i);
});

test('purchase fails clearly on an unknown node id', () => {
  const r = purchase(baseState(), 'r_nonsense');
  assert.equal(r.ok, false);
  assert.match(r.reason, /unknown/i);
});

test('purchase refuses to buy the same node twice', () => {
  const s = baseState();
  purchase(s, 'r_ladle');
  const again = purchase(s, 'r_ladle');
  assert.equal(again.ok, false);
  assert.match(again.reason, /already/i);
});

test('availableNodes excludes purchased and blocked nodes', () => {
  const s = baseState();
  const ids = availableNodes(s).map(n => n.id);
  assert.ok(ids.includes('r_ladle'));
  assert.ok(!ids.includes('r_alarm'), 'prereq unmet');
  assert.ok(!ids.includes('r_buttermilk'), 'cook gate unmet');
});

test('blendAxes averages the ingredients', () => {
  const b = blendAxes(['maple', 'lemon']);
  assert.equal(b.sweet, (8 + 1) / 2);
  assert.equal(b.sharp, (1 + 9) / 2);
});

test('blendAxes on an empty list returns all zeroes', () => {
  assert.deepEqual(blendAxes([]), { sweet: 0, sharp: 0, rich: 0, strange: 0 });
});

test('blendAxes ignores unknown ingredient ids without throwing', () => {
  const b = blendAxes(['maple', 'nonsense']);
  assert.equal(b.sweet, 8, 'unknown ids are skipped, not counted');
});

test('an exact blend discovers the syrup', () => {
  const s = baseState();
  const glaze = SYRUPS.find(x => x.id === 'lemon_glaze');
  // Feed the target directly by finding ingredients that land inside tolerance.
  const r = experiment(s, ['lemon', 'maple']);
  const dist = axisDistance(blendAxes(['lemon', 'maple']), glaze.discover.target);
  if (dist <= glaze.discover.tolerance) {
    assert.equal(r.found, true);
    assert.equal(r.syrupId, 'lemon_glaze');
    assert.ok(s.unlockedSyrups.includes('lemon_glaze'));
  }
});

test('a failed experiment ALWAYS returns a hint and non-zero points', () => {
  const s = baseState();
  const r = experiment(s, ['flour']);
  assert.equal(r.found, false);
  assert.equal(typeof r.hint, 'string');
  assert.ok(r.hint.length > 0, 'a miss must never return an empty hint');
  assert.ok(r.points > 0, 'a miss must still pay research points');
});

test('an empty experiment still returns a hint rather than throwing', () => {
  const r = experiment(baseState(), []);
  assert.equal(r.found, false);
  assert.ok(r.hint.length > 0);
});

test('the hint names the dominant mismatched axis', () => {
  // Blend is far too sharp relative to a sweet target.
  const hint = hintFor({ sweet: 0, sharp: 10, rich: 0, strange: 0 },
                       { sweet: 8, sharp: 0, rich: 0, strange: 0 });
  assert.match(hint, /sharp/i);
});

test('rediscovering an already-known syrup is not reported as new', () => {
  const s = baseState();
  s.unlockedSyrups.push('lemon_glaze');
  const r = experiment(s, ['lemon', 'maple']);
  assert.equal(r.found, false, 'already known - should fall through to a hint');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/research.test.js`
Expected: FAIL — cannot find `../js/engine/research.js`

- [x] **Step 3: Write the implementation**

Create `js/engine/research.js`:

```js
import { RESEARCH } from '../data/research.js';
import { INGREDIENTS } from '../data/ingredients.js';
import { SYRUPS } from '../data/syrups.js';
import { TUNING } from '../data/economy.js';

const AXES = ['sweet', 'sharp', 'rich', 'strange'];
const byId = (coll, id) => coll.find(x => x.id === id);

export function gateMet(node, state) {
  if (!node.gate) return true;
  if (node.gate.cooked) {
    for (const [recipeId, need] of Object.entries(node.gate.cooked)) {
      if ((state.cooked[recipeId] || 0) < need) return false;
    }
  }
  return true;
}

export function isAvailable(node, state) {
  if (state.purchased.includes(node.id)) return false;
  if (!node.prereqs.every(p => state.purchased.includes(p))) return false;
  return gateMet(node, state);
}

export function availableNodes(state) {
  return RESEARCH.filter(n => isAvailable(n, state));
}

export function purchase(state, nodeId) {
  const node = byId(RESEARCH, nodeId);
  if (!node) return { ok: false, reason: `Unknown research node: ${nodeId}` };
  if (state.purchased.includes(nodeId)) return { ok: false, reason: 'Already researched.' };
  if (!node.prereqs.every(p => state.purchased.includes(p))) return { ok: false, reason: 'Prerequisites not met.' };
  if (!gateMet(node, state)) return { ok: false, reason: 'You have not cooked enough of the required dish yet.' };
  if (state.points < node.cost) return { ok: false, reason: `Not enough research points (need ${node.cost}).` };

  state.points -= node.cost;
  state.purchased.push(nodeId);
  const u = node.unlocks || {};
  if (u.recipe && !state.unlockedRecipes.includes(u.recipe)) state.unlockedRecipes.push(u.recipe);
  if (u.syrup && !state.unlockedSyrups.includes(u.syrup)) state.unlockedSyrups.push(u.syrup);
  if (u.upgrade && !state.upgrades.includes(u.upgrade)) state.upgrades.push(u.upgrade);
  return { ok: true, node };
}

export function blendAxes(ingredientIds) {
  const found = (ingredientIds || []).map(id => byId(INGREDIENTS, id)).filter(Boolean);
  const out = { sweet: 0, sharp: 0, rich: 0, strange: 0 };
  if (found.length === 0) return out;
  for (const ing of found) for (const ax of AXES) out[ax] += ing.axes[ax];
  for (const ax of AXES) out[ax] /= found.length;
  return out;
}

export function axisDistance(blend, target) {
  return Math.sqrt(AXES.reduce((a, ax) => a + (blend[ax] - target[ax]) ** 2, 0));
}

/* Potion Craft's second complaint was "no directional hints". A miss names
   the axis that is furthest off and which way to push it. */
export function hintFor(blend, target) {
  let worstAxis = AXES[0], worstDelta = 0;
  for (const ax of AXES) {
    const d = blend[ax] - target[ax];
    if (Math.abs(d) > Math.abs(worstDelta)) { worstDelta = d; worstAxis = ax; }
  }
  const tooMuch = {
    sweet: 'Too sweet. It needs cutting.',
    sharp: 'Too sharp. Wants something round.',
    rich: 'Too heavy. Lighten it.',
    strange: 'Too strange. Bring it back to earth.'
  };
  const tooLittle = {
    sweet: 'Not sweet enough.',
    sharp: 'Flat. It needs an edge.',
    rich: 'Thin. It wants more body.',
    strange: 'Ordinary. Nothing about it surprises.'
  };
  if (worstDelta === 0) return 'Close. Something is still not right.';
  return worstDelta > 0 ? tooMuch[worstAxis] : tooLittle[worstAxis];
}

/* A failed experiment ALWAYS returns a hint and non-zero points. The search
   space must be forgiving enough that failure is informative, not wasted. */
export function experiment(state, ingredientIds) {
  const blend = blendAxes(ingredientIds);
  const candidates = SYRUPS.filter(s => s.discover && !state.unlockedSyrups.includes(s.id));

  let best = null, bestDist = Infinity;
  for (const syrup of candidates) {
    const d = axisDistance(blend, syrup.discover.target);
    if (d < bestDist) { bestDist = d; best = syrup; }
  }

  if (best && bestDist <= best.discover.tolerance) {
    state.unlockedSyrups.push(best.id);
    return { found: true, syrupId: best.id, points: TUNING.benchFailPoints * 3 };
  }

  const hint = best
    ? hintFor(blend, best.discover.target)
    : 'Nothing left to find down this road.';
  return { found: false, hint, points: TUNING.benchFailPoints };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test tests/research.test.js`
Expected: PASS, 17 tests

- [x] **Step 5: Commit**

```bash
git add js/engine/research.js tests/research.test.js
git commit -m "feat: research tree + experiment bench with always-informative failures"
```

---

## Task 6: Synthia's affection arc and the listening mechanic

**Files:**
- Create: `js/engine/affection.js`, `tests/affection.test.js`

**Interfaces:**
- Consumes: `TIER_ORDER`, `TIER_THRESHOLDS`, `TIER_EXPRESSION`, `GRANTS` from `js/data/affection.js`
- Produces:
  - `tierFor(points: number) -> string`
  - `expressionFor(points: number) -> string`
  - `grant(synthia, amount: number, reason: string) -> number` (returns new total; never decreases)
  - `noteMention(synthia, tag: string) -> void` (records something she mentioned in passing)
  - `checkListening(synthia, servedRecipeId: string) -> {noticed: boolean, bonus: number}`
  - `grantWeekly(synthia) -> number`
  - `grantForServing(synthia, quality: number) -> number`

- [x] **Step 1: Write the failing test**

Create `tests/affection.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierFor, expressionFor, grant, noteMention, checkListening, grantWeekly, grantForServing } from '../js/engine/affection.js';
import { GRANTS, TIER_THRESHOLDS } from '../js/data/affection.js';

const fresh = () => ({ points: 0, mentions: [], noticed: [], log: [] });

test('tiers resolve by threshold', () => {
  assert.equal(tierFor(0), 'STRANGER');
  assert.equal(tierFor(TIER_THRESHOLDS.REGULAR), 'REGULAR');
  assert.equal(tierFor(TIER_THRESHOLDS.DEVOTED + 50), 'DEVOTED');
});

test('every tier maps to a real expression key', () => {
  for (const p of [0, 12, 30, 55, 90]) {
    assert.equal(typeof expressionFor(p), 'string');
  }
});

test('affection can rise', () => {
  const s = fresh();
  grant(s, 5, 'test');
  assert.equal(s.points, 5);
});

test('affection can NEVER fall - negative grants are ignored', () => {
  const s = fresh();
  grant(s, 10, 'up');
  grant(s, -50, 'attempted punishment');
  assert.equal(s.points, 10, 'a negative grant must not reduce affection');
});

test('grants are logged with a reason', () => {
  const s = fresh();
  grant(s, 3, 'served her something good');
  assert.equal(s.log.length, 1);
  assert.equal(s.log[0].reason, 'served her something good');
});

test('weekly persistence grants the showing-up bonus', () => {
  const s = fresh();
  grantWeekly(s);
  assert.equal(s.points, GRANTS.weeklyPersistence);
});

test('serving her better food grants more', () => {
  const a = fresh(), b = fresh();
  grantForServing(a, 100);
  grantForServing(b, 20);
  assert.ok(a.points > b.points);
  assert.ok(a.points <= GRANTS.qualityServedMax);
});

test('the listening mechanic: she notices a mentioned dish served later', () => {
  const s = fresh();
  noteMention(s, 'souffle');
  const r = checkListening(s, 'souffle');
  assert.equal(r.noticed, true);
  assert.equal(r.bonus, GRANTS.listening);
  assert.equal(s.points, GRANTS.listening);
});

test('a dish she never mentioned is not noticed', () => {
  const s = fresh();
  noteMention(s, 'souffle');
  assert.equal(checkListening(s, 'plain').noticed, false);
});

test('she only notices the same mention once', () => {
  const s = fresh();
  noteMention(s, 'souffle');
  checkListening(s, 'souffle');
  const second = checkListening(s, 'souffle');
  assert.equal(second.noticed, false, 'the beat must not repeat');
  assert.equal(s.points, GRANTS.listening, 'and must not pay twice');
});

test('noteMention does not duplicate a tag', () => {
  const s = fresh();
  noteMention(s, 'souffle');
  noteMention(s, 'souffle');
  assert.equal(s.mentions.length, 1);
});

test('the arc is slow - weekly persistence alone cannot reach DEVOTED in 8 weeks', () => {
  const s = fresh();
  for (let w = 0; w < 8; w++) grantWeekly(s);
  assert.notEqual(tierFor(s.points), 'DEVOTED', 'showing up alone must not max the arc');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/affection.test.js`
Expected: FAIL — cannot find `../js/engine/affection.js`

- [x] **Step 3: Write the implementation**

Create `js/engine/affection.js`:

```js
import { TIER_ORDER, TIER_THRESHOLDS, TIER_EXPRESSION, GRANTS } from '../data/affection.js';

export function tierFor(points) {
  let current = TIER_ORDER[0];
  for (const tier of TIER_ORDER) {
    if (points >= TIER_THRESHOLDS[tier]) current = tier;
  }
  return current;
}

export function expressionFor(points) {
  return TIER_EXPRESSION[tierFor(points)];
}

/* Affection can stall. It can never fall. A negative grant is a bug at the
   call site, so it is ignored rather than honoured. */
export function grant(synthia, amount, reason) {
  if (amount > 0) {
    synthia.points += amount;
    synthia.log.push({ amount, reason });
  }
  return synthia.points;
}

export function grantWeekly(synthia) {
  return grant(synthia, GRANTS.weeklyPersistence, 'you kept the shop open');
}

export function grantForServing(synthia, quality) {
  const amount = Math.round((Math.max(0, Math.min(100, quality)) / 100) * GRANTS.qualityServedMax);
  return grant(synthia, amount, 'you served her something good');
}

/* She mentions things in passing. Tagged on a dialogue node in data/scenes.js. */
export function noteMention(synthia, tag) {
  if (!synthia.mentions.includes(tag)) synthia.mentions.push(tag);
}

/* The arc's best beat. She mentioned something weeks ago; you went and
   researched it, unprompted, and served it. She notices. Once. */
export function checkListening(synthia, servedRecipeId) {
  const wasMentioned = synthia.mentions.includes(servedRecipeId);
  const alreadyNoticed = synthia.noticed.includes(servedRecipeId);
  if (!wasMentioned || alreadyNoticed) return { noticed: false, bonus: 0 };
  synthia.noticed.push(servedRecipeId);
  grant(synthia, GRANTS.listening, `she mentioned ${servedRecipeId}, and you remembered`);
  return { noticed: true, bonus: GRANTS.listening };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test tests/affection.test.js`
Expected: PASS, 12 tests

- [x] **Step 5: Commit**

```bash
git add js/engine/affection.js tests/affection.test.js
git commit -m "feat: Synthia affection arc, hidden tiers, listening mechanic"
```

---

## Task 7: Game state, serialize, tolerant deserialize

**Files:**
- Create: `js/engine/state.js`, `tests/state.test.js`

**Interfaces:**
- Consumes: `META` from `js/data/meta.js`, `RECIPES`, `SYRUPS`
- Produces:
  - `newGame(seed?: number) -> state`
  - `serialize(state) -> string` (JSON)
  - `deserialize(json: string) -> {ok: true, state} | {ok: false, reason: string}` — tolerant: unknown ids are dropped with a warning, never thrown

State shape (relied on by Tasks 8–12):

```js
{
  version: 1, seed: 1234,
  week: 1, day: 1, phase: 'morning',
  money: 0, weekEarnings: 0, reputation: 0,
  points: 0, purchased: [], cooked: {},
  unlockedRecipes: ['plain'], unlockedSyrups: ['maple_syrup'], upgrades: [],
  menu: ['plain'],
  todayServed: {},
  synthia: { points: 0, mentions: [], noticed: [], log: [], lastVisitWeek: 0 },
  flags: {}
}
```

- [x] **Step 1: Write the failing test**

Create `tests/state.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, serialize, deserialize } from '../js/engine/state.js';

test('a new game starts playable', () => {
  const s = newGame(1);
  assert.equal(s.week, 1);
  assert.equal(s.day, 1);
  assert.ok(s.unlockedRecipes.length > 0, 'must start with something to cook');
  assert.ok(s.menu.length > 0, 'must start with something on the menu');
  assert.equal(s.synthia.points, 0);
});

test('serialize/deserialize round-trips', () => {
  const s = newGame(7);
  s.money = 123; s.reputation = 4.5; s.synthia.points = 11;
  const back = deserialize(serialize(s));
  assert.equal(back.ok, true);
  assert.equal(back.state.money, 123);
  assert.equal(back.state.reputation, 4.5);
  assert.equal(back.state.synthia.points, 11);
});

test('deserialize rejects malformed JSON without throwing', () => {
  const r = deserialize('{not json');
  assert.equal(r.ok, false);
  assert.match(r.reason, /read/i);
});

test('deserialize rejects a save from a future version', () => {
  const s = newGame(1);
  const bumped = JSON.parse(serialize(s));
  bumped.version = 999;
  const r = deserialize(JSON.stringify(bumped));
  assert.equal(r.ok, false);
  assert.match(r.reason, /version/i);
});

test('deserialize drops unknown recipe ids instead of stranding the player', () => {
  const s = newGame(1);
  const obj = JSON.parse(serialize(s));
  obj.unlockedRecipes.push('recipe_that_no_longer_exists');
  obj.menu.push('recipe_that_no_longer_exists');
  const r = deserialize(JSON.stringify(obj));
  assert.equal(r.ok, true, 'a stale id must not break the save');
  assert.ok(!r.state.unlockedRecipes.includes('recipe_that_no_longer_exists'));
  assert.ok(!r.state.menu.includes('recipe_that_no_longer_exists'));
});

test('deserialize guarantees a non-empty menu even if the save had none', () => {
  const s = newGame(1);
  const obj = JSON.parse(serialize(s));
  obj.menu = [];
  const r = deserialize(JSON.stringify(obj));
  assert.equal(r.ok, true);
  assert.ok(r.state.menu.length > 0, 'the player must never be stranded with nothing to sell');
});

test('deserialize repairs a missing synthia block', () => {
  const s = newGame(1);
  const obj = JSON.parse(serialize(s));
  delete obj.synthia;
  const r = deserialize(JSON.stringify(obj));
  assert.equal(r.ok, true);
  assert.equal(r.state.synthia.points, 0);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/state.test.js`
Expected: FAIL — cannot find `../js/engine/state.js`

- [x] **Step 3: Write the implementation**

Create `js/engine/state.js`:

```js
import { META } from '../data/meta.js';
import { RECIPES } from '../data/recipes.js';
import { SYRUPS } from '../data/syrups.js';

const startingRecipes = () => RECIPES.filter(r => r.unlockedAtStart).map(r => r.id);
const startingSyrups  = () => SYRUPS.filter(s => s.unlockedAtStart).map(s => s.id);

export function newGame(seed = Date.now() % 2147483647) {
  const recipes = startingRecipes();
  return {
    version: META.saveVersion,
    seed,
    week: 1, day: 1, phase: 'morning',
    money: 0, weekEarnings: 0, reputation: 0,
    points: 0, purchased: [], cooked: {},
    unlockedRecipes: [...recipes],
    unlockedSyrups: startingSyrups(),
    upgrades: [],
    menu: [...recipes],
    todayServed: {},
    synthia: { points: 0, mentions: [], noticed: [], log: [], lastVisitWeek: 0 },
    flags: {}
  };
}

export function serialize(state) {
  return JSON.stringify(state);
}

/* Tolerant by design. A stale or malformed save must produce a readable
   message or a repaired state — never a blank screen or a thrown error. */
export function deserialize(json) {
  let obj;
  try {
    obj = JSON.parse(json);
  } catch (e) {
    return { ok: false, reason: `Could not read the save file: ${e.message}` };
  }
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'Could not read the save file: not an object.' };
  if (obj.version > META.saveVersion) {
    return { ok: false, reason: `This save is from a newer version (${obj.version}) than this build (${META.saveVersion}).` };
  }

  const base = newGame(obj.seed);
  const state = { ...base, ...obj };

  // Repair sub-objects that a partial or hand-edited save may be missing.
  state.synthia = { ...base.synthia, ...(obj.synthia || {}) };
  state.cooked = obj.cooked || {};
  state.todayServed = obj.todayServed || {};
  state.flags = obj.flags || {};

  // Drop ids that no longer exist in the content, with a warning.
  const validRecipes = new Set(RECIPES.map(r => r.id));
  const validSyrups = new Set(SYRUPS.map(s => s.id));
  const prune = (arr, valid, label) => (arr || []).filter(id => {
    if (valid.has(id)) return true;
    console.warn(`[save] dropping unknown ${label}: ${id}`);
    return false;
  });
  state.unlockedRecipes = prune(state.unlockedRecipes, validRecipes, 'recipe');
  state.unlockedSyrups = prune(state.unlockedSyrups, validSyrups, 'syrup');
  state.menu = prune(state.menu, validRecipes, 'menu recipe');

  // Never strand the player with nothing to cook or sell.
  if (state.unlockedRecipes.length === 0) state.unlockedRecipes = startingRecipes();
  if (state.menu.length === 0) state.menu = [...state.unlockedRecipes];

  state.version = META.saveVersion;
  return { ok: true, state };
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test tests/state.test.js`
Expected: PASS, 7 tests

- [x] **Step 5: Commit**

```bash
git add js/engine/state.js tests/state.test.js
git commit -m "feat: game state with tolerant deserialize that never strands the player"
```

---

## Task 8: Day loop orchestration

**Files:**
- Create: `js/engine/day.js`, `tests/day.test.js`

**Interfaces:**
- Consumes: `makeRng`, `pick` (Task 1); `scoreDish` (Task 3); `payoutFor`, `tipFor`, `reputationGain`, `rollWeek` (Task 4); `grantWeekly`, `grantForServing`, `checkListening` (Task 6); `CUSTOMERS`, `RECIPES`, `TUNING`
- Produces:
  - `customerPool(state) -> customer[]`
  - `nextCustomer(state) -> {customer, recipeId} | null`
  - `serve(state, recipeId, beats, opts?: {forSynthia?: boolean}) -> {quality, breakdown, payout, tip, noticed}`
  - `openDay(state) -> void`
  - `closeDay(state) -> {dayEarnings, weekRolled: boolean, weekResult?: object}`

- [x] **Step 1: Write the failing test**

Create `tests/day.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerPool, nextCustomer, serve, openDay, closeDay } from '../js/engine/day.js';
import { newGame } from '../js/engine/state.js';
import { quotaForWeek } from '../js/engine/economy.js';
import { noteMention } from '../js/engine/affection.js';

const perfect = recipe => ({
  volume: recipe.pour.target, msOffset: 0,
  offsets: new Array(recipe.stackCount).fill(0),
  coverage: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7]
});

test('the starting customer pool is not empty', () => {
  const s = newGame(1);
  assert.ok(customerPool(s).length > 0, 'week 1 must have customers or the game cannot start');
});

test('reputation-gated customers are excluded until earned', () => {
  const s = newGame(1);
  const ids = customerPool(s).map(c => c.id);
  assert.ok(!ids.includes('the_critic'), 'the critic needs reputation 40');
  s.reputation = 50;
  assert.ok(customerPool(s).map(c => c.id).includes('the_critic'));
});

test('nextCustomer is deterministic for a given seed', () => {
  const a = newGame(99), b = newGame(99);
  openDay(a); openDay(b);
  assert.deepEqual(nextCustomer(a), nextCustomer(b));
});

test('nextCustomer only orders something on the menu', () => {
  const s = newGame(5);
  openDay(s);
  for (let i = 0; i < 20; i++) {
    const order = nextCustomer(s);
    if (order) assert.ok(s.menu.includes(order.recipeId), `ordered ${order.recipeId}, not on menu`);
  }
});

test('a perfect serve pays, tips, and raises reputation', () => {
  const s = newGame(1);
  openDay(s);
  const recipe = { ...s.menu.map(id => id), };
  const r = serve(s, 'plain', perfect({ pour: { target: 50 }, stackCount: 3 }));
  assert.equal(r.quality, 100);
  assert.ok(r.payout > 0);
  assert.ok(r.tip > 0);
  assert.ok(s.reputation > 0);
  assert.ok(s.money > 0);
});

test('serving records the cook count for research gates', () => {
  const s = newGame(1);
  openDay(s);
  serve(s, 'plain', perfect({ pour: { target: 50 }, stackCount: 3 }));
  serve(s, 'plain', perfect({ pour: { target: 50 }, stackCount: 3 }));
  assert.equal(s.cooked.plain, 2);
});

test('repeats within a day pay less', () => {
  const s = newGame(1);
  openDay(s);
  const beats = perfect({ pour: { target: 50 }, stackCount: 3 });
  const first = serve(s, 'plain', beats).payout;
  for (let i = 0; i < 4; i++) serve(s, 'plain', beats);
  const sixth = serve(s, 'plain', beats).payout;
  assert.ok(sixth < first, `repeats must diminish (${first} -> ${sixth})`);
});

test('serving an unknown recipe fails safely', () => {
  const s = newGame(1);
  openDay(s);
  assert.throws(() => serve(s, 'not_a_recipe', perfect({ pour: { target: 50 }, stackCount: 3 })), /unknown recipe/i);
});

test('openDay clears the previous day repeat counts', () => {
  const s = newGame(1);
  openDay(s);
  serve(s, 'plain', perfect({ pour: { target: 50 }, stackCount: 3 }));
  assert.equal(s.todayServed.plain, 1);
  closeDay(s);
  openDay(s);
  assert.equal(s.todayServed.plain, undefined);
});

test('closeDay advances the day and rolls the week every 7 days', () => {
  const s = newGame(1);
  for (let d = 0; d < 6; d++) { openDay(s); const r = closeDay(s); assert.equal(r.weekRolled, false); }
  openDay(s);
  const r = closeDay(s);
  assert.equal(r.weekRolled, true);
  assert.equal(s.week, 2);
  assert.equal(s.day, 1);
});

test('missing the quota costs nothing at all', () => {
  const s = newGame(1);
  for (let d = 0; d < 7; d++) { openDay(s); closeDay(s); }
  assert.equal(s.money, 0);
  assert.equal(s.reputation, 0);
  assert.ok(s.synthia.points > 0, 'but showing up still counts');
});

test('week rollover resets week earnings and grants persistence', () => {
  const s = newGame(1);
  const before = s.synthia.points;
  for (let d = 0; d < 7; d++) { openDay(s); closeDay(s); }
  assert.equal(s.weekEarnings, 0);
  assert.ok(s.synthia.points > before, 'the grind IS the courtship');
});

test('serving Synthia something she mentioned fires the listening beat', () => {
  const s = newGame(1);
  openDay(s);
  noteMention(s.synthia, 'plain');
  const r = serve(s, 'plain', perfect({ pour: { target: 50 }, stackCount: 3 }), { forSynthia: true });
  assert.equal(r.noticed, true);
});

test('the quota for week 1 matches the curve', () => {
  assert.equal(quotaForWeek(1), 300);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/day.test.js`
Expected: FAIL — cannot find `../js/engine/day.js`

- [x] **Step 3: Write the implementation**

Create `js/engine/day.js`:

```js
import { makeRng, pick } from './rng.js';
import { scoreDish } from './cook.js';
import { payoutFor, tipFor, reputationGain, rollWeek } from './economy.js';
import { grantWeekly, grantForServing, checkListening } from './affection.js';
import { CUSTOMERS } from '../data/customers.js';
import { RECIPES } from '../data/recipes.js';

const DAYS_PER_WEEK = 7;
const recipeById = id => RECIPES.find(r => r.id === id);

export function customerPool(state) {
  return CUSTOMERS.filter(c => {
    const u = c.unlockAt || {};
    if (u.week !== undefined && state.week < u.week) return false;
    if (u.reputation !== undefined && state.reputation < u.reputation) return false;
    return true;
  });
}

/* Deterministic per (seed, week, day, order index) so tests and replays match. */
function dayRng(state) {
  return makeRng(state.seed + state.week * 1000 + state.day * 10 + (state.orderIndex || 0));
}

export function nextCustomer(state) {
  const pool = customerPool(state);
  if (pool.length === 0 || state.menu.length === 0) return null;
  const rng = dayRng(state);
  const customer = pick(rng, pool);
  const wanted = state.menu.filter(id => {
    const r = recipeById(id);
    return r && r.tags.some(t => customer.wants.includes(t));
  });
  const recipeId = pick(rng, wanted.length ? wanted : state.menu);
  state.orderIndex = (state.orderIndex || 0) + 1;
  return { customer, recipeId };
}

export function openDay(state) {
  state.phase = 'service';
  state.todayServed = {};
  state.orderIndex = 0;
  state.dayEarnings = 0;
}

export function serve(state, recipeId, beats, opts = {}) {
  const recipe = recipeById(recipeId);
  if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);

  const repeatCount = state.todayServed[recipeId] || 0;
  const { quality, breakdown } = scoreDish(recipe, beats, state.upgrades);
  const payout = payoutFor(recipe, quality, repeatCount);
  const tip = tipFor(payout, quality);

  state.todayServed[recipeId] = repeatCount + 1;
  state.cooked[recipeId] = (state.cooked[recipeId] || 0) + 1;
  state.money += payout + tip;
  state.weekEarnings += payout + tip;
  state.dayEarnings = (state.dayEarnings || 0) + payout + tip;
  state.reputation += reputationGain(quality);

  let noticed = false;
  if (opts.forSynthia) {
    grantForServing(state.synthia, quality);
    noticed = checkListening(state.synthia, recipeId).noticed;
  }

  return { quality, breakdown, payout, tip, noticed };
}

export function closeDay(state) {
  const dayEarnings = state.dayEarnings || 0;
  state.phase = 'evening';

  if (state.day < DAYS_PER_WEEK) {
    state.day += 1;
    return { dayEarnings, weekRolled: false };
  }

  // Week rollover. The quota REPORTS; it never punishes.
  const weekResult = rollWeek(state);
  grantWeekly(state.synthia);      // showing up is the courtship
  state.week += 1;
  state.day = 1;
  state.weekEarnings = 0;
  return { dayEarnings, weekRolled: true, weekResult };
}
```

- [x] **Step 4: Fix the test's throwaway recipe stubs**

The `perfect()` helper in the test passes a stub object, which is fine because it only reads `pour.target` and `stackCount`. Replace the unused line `const recipe = { ...s.menu.map(id => id), };` in the perfect-serve test — it does nothing. Delete that line.

- [x] **Step 5: Run tests to verify they pass**

Run: `node --test tests/day.test.js`
Expected: PASS, 14 tests

- [x] **Step 6: Run the whole suite**

Run: `node --test tests/`
Expected: PASS across all files

- [x] **Step 7: Commit**

```bash
git add js/engine/day.js tests/day.test.js
git commit -m "feat: day loop - deterministic customers, serving, week rollover"
```

---

## Task 9: Content validator

**Files:**
- Create: `tools/validate.js`, `tests/validate.test.js`

**Interfaces:**
- Consumes: all `js/data/*` modules
- Produces: `validateContent() -> {errors: string[], warnings: string[]}`; the module also runs as a CLI (`node tools/validate.js`) exiting 1 on any error

- [x] **Step 1: Write the failing test**

Create `tests/validate.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../tools/validate.js';

test('the shipped content validates clean', () => {
  const { errors } = validateContent();
  assert.deepEqual(errors, [], `content has errors:\n${errors.join('\n')}`);
});

test('a recipe citing a missing ingredient is reported by file and row', () => {
  const { errors } = validateContent({
    recipes: [{ id: 'broken', name: 'Broken', tags: [], base: 1, ingredients: ['nope'],
                pour: { target: 1, band: 1 }, flip: { windowMs: 1 }, stackCount: 1,
                weights: { pour: 1, flip: 1, stack: 1, drizzle: 1 } }]
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /recipes\.js/);
  assert.match(errors[0], /broken/);
  assert.match(errors[0], /nope/);
});

test('a research node with a dangling prereq is reported', () => {
  const { errors } = validateContent({
    research: [{ id: 'r_x', name: 'X', cost: 1, prereqs: ['r_ghost'], gate: null, unlocks: {} }]
  });
  assert.ok(errors.some(e => /r_ghost/.test(e)));
});

test('a research node unlocking a missing recipe is reported', () => {
  const { errors } = validateContent({
    research: [{ id: 'r_y', name: 'Y', cost: 1, prereqs: [], gate: null, unlocks: { recipe: 'ghost_cake' } }]
  });
  assert.ok(errors.some(e => /ghost_cake/.test(e)));
});

test('a research gate citing a missing recipe is reported', () => {
  const { errors } = validateContent({
    research: [{ id: 'r_z', name: 'Z', cost: 1, prereqs: [], gate: { cooked: { ghost: 3 } }, unlocks: {} }]
  });
  assert.ok(errors.some(e => /ghost/.test(e)));
});

test('an unreachable research node is warned about, not errored', () => {
  const { errors, warnings } = validateContent({
    research: [
      { id: 'a', name: 'A', cost: 1, prereqs: ['b'], gate: null, unlocks: {} },
      { id: 'b', name: 'B', cost: 1, prereqs: ['a'], gate: null, unlocks: {} }
    ]
  });
  assert.deepEqual(errors, []);
  assert.ok(warnings.some(w => /unreachable|cycle/i.test(w)));
});

test('no starting recipe is an error - the game would be unplayable', () => {
  const { errors } = validateContent({
    recipes: [{ id: 'x', name: 'X', tags: [], base: 1, ingredients: [],
                pour: { target: 1, band: 1 }, flip: { windowMs: 1 }, stackCount: 1,
                weights: { pour: 1, flip: 1, stack: 1, drizzle: 1 }, unlockedAtStart: false }]
  });
  assert.ok(errors.some(e => /start/i.test(e)));
});

test('a customer wanting a tag no recipe has is warned about', () => {
  const { warnings } = validateContent({
    customers: [{ id: 'c', name: 'C', unlockAt: { week: 1 }, wants: ['nonexistent_tag'],
                  lines: { greeting: 'a', happy: 'b', disappointed: 'c' } }]
  });
  assert.ok(warnings.some(w => /nonexistent_tag/.test(w)));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/validate.test.js`
Expected: FAIL — cannot find `../tools/validate.js`

- [x] **Step 3: Write the implementation**

Create `tools/validate.js`:

```js
/* Content integrity checker. Run: node tools/validate.js
   Prints plain-English errors naming the file and the row, so a content
   author gets a clear message instead of a blank screen. */

import { INGREDIENTS } from '../js/data/ingredients.js';
import { RECIPES } from '../js/data/recipes.js';
import { SYRUPS } from '../js/data/syrups.js';
import { RESEARCH } from '../js/data/research.js';
import { CUSTOMERS } from '../js/data/customers.js';

export function validateContent(override = {}) {
  const ingredients = override.ingredients || INGREDIENTS;
  const recipes = override.recipes || RECIPES;
  const syrups = override.syrups || SYRUPS;
  const research = override.research || RESEARCH;
  const customers = override.customers || CUSTOMERS;

  const errors = [], warnings = [];
  const ingIds = new Set(ingredients.map(x => x.id));
  const recipeIds = new Set(recipes.map(x => x.id));
  const syrupIds = new Set(syrups.map(x => x.id));
  const researchIds = new Set(research.map(x => x.id));
  const allTags = new Set(recipes.flatMap(r => r.tags || []));

  for (const r of recipes) {
    for (const ing of r.ingredients || []) {
      if (!ingIds.has(ing)) {
        errors.push(`recipes.js — recipe "${r.id}" uses ingredient "${ing}", which is not in ingredients.js`);
      }
    }
  }

  if (!recipes.some(r => r.unlockedAtStart)) {
    errors.push('recipes.js — no recipe has unlockedAtStart: true, so the game would start with nothing to cook');
  }

  for (const n of research) {
    for (const p of n.prereqs || []) {
      if (!researchIds.has(p)) {
        errors.push(`research.js — node "${n.id}" lists prereq "${p}", which is not a research node`);
      }
    }
    const u = n.unlocks || {};
    if (u.recipe && !recipeIds.has(u.recipe)) {
      errors.push(`research.js — node "${n.id}" unlocks recipe "${u.recipe}", which is not in recipes.js`);
    }
    if (u.syrup && !syrupIds.has(u.syrup)) {
      errors.push(`research.js — node "${n.id}" unlocks syrup "${u.syrup}", which is not in syrups.js`);
    }
    if (n.gate && n.gate.cooked) {
      for (const rid of Object.keys(n.gate.cooked)) {
        if (!recipeIds.has(rid)) {
          errors.push(`research.js — node "${n.id}" is gated on cooking "${rid}", which is not in recipes.js`);
        }
      }
    }
  }

  // Reachability: a node nobody can ever buy is a content bug, but not fatal.
  const reachable = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of research) {
      if (reachable.has(n.id)) continue;
      if ((n.prereqs || []).every(p => reachable.has(p))) { reachable.add(n.id); grew = true; }
    }
  }
  for (const n of research) {
    if (!reachable.has(n.id)) {
      warnings.push(`research.js — node "${n.id}" is unreachable (a prerequisite cycle, or a prereq that is itself unreachable)`);
    }
  }

  for (const c of customers) {
    for (const tag of c.wants || []) {
      if (!allTags.has(tag)) {
        warnings.push(`customers.js — customer "${c.id}" wants tag "${tag}", which no recipe has`);
      }
    }
    for (const key of ['greeting', 'happy', 'disappointed']) {
      if (!c.lines || !c.lines[key]) {
        warnings.push(`customers.js — customer "${c.id}" is missing the "${key}" line`);
      }
    }
  }

  for (const s of syrups) {
    if (s.discover && !s.discover.target) {
      errors.push(`syrups.js — syrup "${s.id}" has a discover block with no target`);
    }
  }

  return { errors, warnings };
}

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, warnings } = validateContent();
  for (const w of warnings) console.warn(`WARN  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length > 0 ? 1 : 0);
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `node --test tests/validate.test.js`
Expected: PASS, 8 tests

- [x] **Step 5: Run the validator against real content**

Run: `node tools/validate.js`
Expected: `0 error(s)`, exit code 0

- [x] **Step 6: Commit**

```bash
git add tools/validate.js tests/validate.test.js
git commit -m "feat: content validator with plain-English errors for the content author"
```

---

## Task 10: HTML shell, screen manager, and the shopfront

**Files:**
- Create: `index.html`, `css/style.css`, `css/shop.css`, `js/ui/screens.js`, `js/ui/shopfront.js`, `js/ui/ledger.js`, `js/main.js`

**Interfaces:**
- Consumes: `newGame`, `serialize`, `deserialize` (Task 7); `openDay`, `closeDay`, `nextCustomer`, `serve` (Task 8); `quotaForWeek` (Task 4); `META`
- Produces:
  - `showScreen(id: string) -> void`
  - `renderMorning(state) -> void`, `renderService(state) -> void`, `renderEvening(state) -> void`
  - `renderQuotaBoard(state) -> void`
  - `window.GAME = {state, save, load}` for manual browser testing

This task has no unit tests — it is DOM code. It is verified by loading the page and playing it. The engine it drives is already fully tested.

- [x] **Step 1: Create `index.html`**

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pancake Shop</title>
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/shop.css">
</head>
<body>
  <header id="hud">
    <span id="hud-title"></span>
    <span id="hud-day"></span>
    <span id="hud-money"></span>
    <span id="hud-quota"></span>
  </header>

  <main>
    <section id="screen-title" class="screen active">
      <h1 id="title-text"></h1>
      <button id="btn-new">New Game</button>
      <button id="btn-continue">Continue</button>
    </section>

    <section id="screen-morning" class="screen">
      <h2>Morning</h2>
      <p class="muted">Choose what goes on the menu today.</p>
      <div id="menu-picker"></div>
      <button id="btn-open">Open the shop</button>
    </section>

    <section id="screen-service" class="screen">
      <h2>Service</h2>
      <div id="customer-card"></div>
      <div id="griddle-mount"></div>
      <button id="btn-close">Close for the day</button>
    </section>

    <section id="screen-evening" class="screen">
      <h2>Evening</h2>
      <div id="ledger"></div>
      <button id="btn-research">Research</button>
      <button id="btn-next-day">Next day</button>
    </section>

    <section id="screen-research" class="screen">
      <h2>Research</h2>
      <div id="tree-mount"></div>
      <div id="bench-mount"></div>
      <button id="btn-back-evening">Back</button>
    </section>

    <section id="screen-vn" class="screen">
      <div id="vn-stage"><img id="vn-sprite" alt=""></div>
      <div id="vn-box">
        <div id="vn-name"></div>
        <div id="vn-text"></div>
        <div id="vn-choices"></div>
      </div>
    </section>
  </main>

  <div id="notice" hidden></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- [x] **Step 2: Create `css/style.css`**

```css
/* Palette lifted from god-synthia: violet dream / red nightmare. */
:root {
  --bg: #14101c;
  --panel: #1d1729;
  --ink: #efeaf6;
  --muted: #a396bb;
  --accent: #c9a8ff;
  --good: #8fe08f;
  --bad: #ff8b8b;
  --radius: 10px;
  --sp: 12px;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--ink);
  font: 15px/1.5 Inter, system-ui, sans-serif;
}
h1, h2 { font-family: Oswald, system-ui, sans-serif; font-weight: 600; letter-spacing: .02em; }
.muted { color: var(--muted); }
#hud {
  display: flex; gap: var(--sp); padding: var(--sp);
  background: var(--panel); border-bottom: 1px solid #2c2340;
  font: 13px/1 'IBM Plex Mono', ui-monospace, monospace;
}
#hud span { color: var(--muted); }
main { padding: calc(var(--sp) * 2); max-width: 900px; margin: 0 auto; }
.screen { display: none; }
.screen.active { display: block; }
button {
  background: var(--panel); color: var(--ink); border: 1px solid #3a2f52;
  border-radius: var(--radius); padding: 10px 16px; cursor: pointer;
  font: inherit; margin-right: 8px;
}
button:hover { border-color: var(--accent); }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
button[disabled] { opacity: .45; cursor: not-allowed; }
#notice {
  position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
  background: var(--panel); border: 1px solid var(--accent);
  padding: 10px 16px; border-radius: var(--radius); max-width: 80vw;
}
[hidden] { display: none !important; }
```

- [x] **Step 3: Create `css/shop.css`**

```css
.card {
  background: var(--panel); border: 1px solid #2c2340;
  border-radius: var(--radius); padding: var(--sp); margin-bottom: var(--sp);
}
#menu-picker label { display: block; padding: 6px 0; }
.quota-bar { height: 8px; background: #2c2340; border-radius: 4px; overflow: hidden; }
.quota-fill { height: 100%; background: var(--accent); }
.score-row { display: flex; justify-content: space-between; font: 13px/1.6 'IBM Plex Mono', monospace; }
#vn-stage { text-align: center; min-height: 40vh; }
#vn-sprite { max-height: 40vh; }
#vn-box { background: var(--panel); border: 1px solid #3a2f52; border-radius: var(--radius); padding: var(--sp); min-height: 120px; }
#vn-name { color: var(--accent); font-family: Oswald, sans-serif; margin-bottom: 6px; }
#vn-choices button { display: block; width: 100%; margin: 6px 0; text-align: left; }
```

- [x] **Step 4: Create `js/ui/screens.js`**

```js
export function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) {
    el.classList.toggle('active', el.id === `screen-${id}`);
  }
}

export function showNotice(msg, ms = 4000) {
  const el = document.getElementById('notice');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showNotice._t);
  showNotice._t = setTimeout(() => { el.hidden = true; }, ms);
}
```

- [x] **Step 5: Create `js/ui/ledger.js`**

```js
import { quotaForWeek } from '../engine/economy.js';

export function renderQuotaBoard(state) {
  const quota = quotaForWeek(state.week);
  const pct = Math.min(100, Math.round((state.weekEarnings / quota) * 100));
  document.getElementById('hud-quota').textContent =
    `week ${state.week} quota ${state.weekEarnings}/${quota} (${pct}%)`;
  document.getElementById('hud-day').textContent = `day ${state.day}`;
  document.getElementById('hud-money').textContent = `${state.money}`;
}

export function renderLedger(state, dayResult) {
  const quota = quotaForWeek(state.week);
  const pct = Math.min(100, Math.round((state.weekEarnings / quota) * 100));
  document.getElementById('ledger').innerHTML = `
    <div class="card">
      <div class="score-row"><span>Today</span><span>${dayResult.dayEarnings}</span></div>
      <div class="score-row"><span>This week</span><span>${state.weekEarnings} / ${quota}</span></div>
      <div class="quota-bar"><div class="quota-fill" style="width:${pct}%"></div></div>
      <div class="score-row"><span>Reputation</span><span>${state.reputation.toFixed(1)}</span></div>
      <div class="score-row"><span>Research points</span><span>${state.points}</span></div>
    </div>`;
}
```

- [x] **Step 6: Create `js/ui/shopfront.js`**

```js
import { RECIPES } from '../data/recipes.js';
import { renderQuotaBoard } from './ledger.js';

export function renderMorning(state) {
  const mount = document.getElementById('menu-picker');
  mount.innerHTML = '';
  for (const id of state.unlockedRecipes) {
    const r = RECIPES.find(x => x.id === id);
    if (!r) continue;
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = state.menu.includes(id);
    box.addEventListener('change', () => {
      if (box.checked) { if (!state.menu.includes(id)) state.menu.push(id); }
      else { state.menu = state.menu.filter(m => m !== id); }
      document.getElementById('btn-open').disabled = state.menu.length === 0;
    });
    label.append(box, ` ${r.name} — ${r.base}`);
    mount.append(label);
  }
  document.getElementById('btn-open').disabled = state.menu.length === 0;
  renderQuotaBoard(state);
}

export function renderCustomer(order) {
  const el = document.getElementById('customer-card');
  if (!order) { el.innerHTML = '<div class="card muted">Nobody right now.</div>'; return; }
  const r = RECIPES.find(x => x.id === order.recipeId);
  el.innerHTML = `<div class="card">
    <strong>${order.customer.name}</strong>
    <p>${order.customer.lines.greeting}</p>
    <p class="muted">Order: ${r ? r.name : order.recipeId}</p>
  </div>`;
}
```

- [x] **Step 7: Create `js/main.js`**

```js
import { newGame, serialize, deserialize } from './engine/state.js';
import { openDay, closeDay, nextCustomer, serve } from './engine/day.js';
import { META } from './data/meta.js';
import { showScreen, showNotice } from './ui/screens.js';
import { renderMorning, renderCustomer } from './ui/shopfront.js';
import { renderLedger, renderQuotaBoard } from './ui/ledger.js';
import { mountGriddle } from './ui/griddle.js';

const TITLE_FALLBACK = 'Pancake Shop';
let state = null;
let order = null;

function saveGame() {
  try {
    localStorage.setItem(META.saveKey, serialize(state));
  } catch (e) {
    showNotice(`Could not save: ${e.message}`);
  }
}

function loadGame() {
  let raw = null;
  try { raw = localStorage.getItem(META.saveKey); } catch { raw = null; }
  if (!raw) { showNotice('No save found.'); return false; }
  const r = deserialize(raw);
  if (!r.ok) { showNotice(r.reason); return false; }
  state = r.state;
  return true;
}

function toMorning() {
  state.phase = 'morning';
  renderMorning(state);
  showScreen('morning');
  saveGame();
}

function toService() {
  openDay(state);
  showScreen('service');
  nextOrder();
}

function nextOrder() {
  order = nextCustomer(state);
  renderCustomer(order);
  renderQuotaBoard(state);
  if (order) {
    mountGriddle(document.getElementById('griddle-mount'), order.recipeId, beats => {
      const result = serve(state, order.recipeId, beats);
      showNotice(`${result.quality}% — ${result.payout}${result.tip ? ` +${result.tip} tip` : ''}`);
      renderQuotaBoard(state);
      nextOrder();
    });
  }
}

function toEvening() {
  const dayResult = closeDay(state);
  renderLedger(state, dayResult);
  showScreen('evening');
  saveGame();
  if (dayResult.weekRolled) {
    const { met, quota, earned } = dayResult.weekResult;
    showNotice(met
      ? `Quota met. ${earned} against ${quota}.`
      : `Quota missed. ${earned} against ${quota}. Nothing is lost.`, 6000);
  }
}

document.getElementById('title-text').textContent = META.title || TITLE_FALLBACK;
document.getElementById('hud-title').textContent = META.title || TITLE_FALLBACK;

document.getElementById('btn-new').addEventListener('click', () => { state = newGame(); toMorning(); });
document.getElementById('btn-continue').addEventListener('click', () => { if (loadGame()) toMorning(); });
document.getElementById('btn-open').addEventListener('click', toService);
document.getElementById('btn-close').addEventListener('click', toEvening);
document.getElementById('btn-next-day').addEventListener('click', toMorning);

showScreen('title');

// Exposed for manual browser testing.
window.GAME = { get state() { return state; }, save: saveGame, load: loadGame };
```

- [x] **Step 8: Verify in the browser**

Run: `cd ~/vault/projects/pancake-shop && python3 -m http.server 8000`
Open `http://localhost:8000`. Expected: title screen shows "Pancake Shop" (the fallback, since `META.title` is null), New Game reaches the morning screen, the menu picker lists Plain Stack, and Open the shop reaches service. The griddle mount will be empty until Task 11 — that is expected.

- [x] **Step 9: Commit**

```bash
git add index.html css js/ui/screens.js js/ui/shopfront.js js/ui/ledger.js js/main.js
git commit -m "feat: HTML shell, screen manager, shopfront, ledger, quota board"
```

---

## Task 11: The griddle — four interactive beats

**Files:**
- Create: `js/ui/griddle.js`

**Interfaces:**
- Consumes: `RECIPES`
- Produces: `mountGriddle(mountEl: HTMLElement, recipeId: string, onDone: (beats) => void) -> void` where `beats = {volume, msOffset, offsets, coverage}` — exactly the shape `scoreDish` consumes

DOM code, verified by playing. Start with the DOM implementation; the spec's open question of whether pour and drizzle need `<canvas>` is answered by playing this, not by arguing.

- [x] **Step 1: Create `js/ui/griddle.js`**

```js
import { RECIPES } from '../data/recipes.js';

/* Four beats: pour, flip, stack, drizzle.
   Each produces one value that engine/cook.js scores. This module measures;
   it does not score. Keep it that way — scoring lives in engine/ and is tested. */

export function mountGriddle(mount, recipeId, onDone) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  if (!recipe) { mount.innerHTML = '<div class="card">Unknown recipe.</div>'; return; }

  const beats = { volume: 0, msOffset: 0, offsets: [], coverage: [] };
  let stage = 'pour';

  const render = () => {
    mount.innerHTML = `<div class="card">
      <div class="muted">${recipe.name} — ${stage}</div>
      <div id="beat-area"></div>
    </div>`;
    ({ pour: doPour, flip: doFlip, stack: doStack, drizzle: doDrizzle })[stage]();
  };

  // BEAT 1 — POUR. Hold to pour; volume grows while held.
  function doPour() {
    const area = document.getElementById('beat-area');
    area.innerHTML = `<p>Hold to pour. Target ${recipe.pour.target}ml.</p>
      <button id="pour-btn">Hold to pour</button>
      <div id="pour-read" class="muted">0 ml</div>`;
    const btn = document.getElementById('pour-btn');
    const read = document.getElementById('pour-read');
    let timer = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => { beats.volume += 2; read.textContent = `${beats.volume} ml`; }, 30);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer); timer = null;
      stage = 'flip'; render();
    };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
    btn.addEventListener('touchstart', e => { e.preventDefault(); start(); });
    btn.addEventListener('touchend', e => { e.preventDefault(); stop(); });
  }

  // BEAT 2 — FLIP. Bubbles rise; click at the peak. msOffset is signed
  // distance from the ideal moment.
  function doFlip() {
    const area = document.getElementById('beat-area');
    area.innerHTML = `<p>Watch for bubbles. Flip at the peak.</p>
      <div id="bubbles" class="muted">…</div>
      <button id="flip-btn">Flip</button>`;
    const idealAt = 2000 + Math.random() * 1500;
    const t0 = performance.now();
    const bub = document.getElementById('bubbles');
    const tick = setInterval(() => {
      const e = performance.now() - t0;
      const n = Math.min(12, Math.floor(e / (idealAt / 12)));
      bub.textContent = 'o'.repeat(n);
    }, 80);
    document.getElementById('flip-btn').addEventListener('click', () => {
      clearInterval(tick);
      beats.msOffset = (performance.now() - t0) - idealAt;
      stage = 'stack'; render();
    }, { once: true });
  }

  // BEAT 3 — STACK. Click to place each pancake; offset from centre is the
  // horizontal distance from the click to the plate's centre. Error compounds
  // in engine/cook.js, not here.
  function doStack() {
    const area = document.getElementById('beat-area');
    area.innerHTML = `<p>Place ${recipe.stackCount} pancakes. Aim for the centre line.</p>
      <div id="plate" style="position:relative;height:120px;border:1px solid var(--accent);border-radius:8px;cursor:crosshair">
        <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--muted)"></div>
      </div>
      <div id="stack-read" class="muted">0 / ${recipe.stackCount}</div>`;
    const plate = document.getElementById('plate');
    const read = document.getElementById('stack-read');
    plate.addEventListener('click', ev => {
      const rect = plate.getBoundingClientRect();
      const centre = rect.left + rect.width / 2;
      // Normalise to roughly -25..25 regardless of screen width.
      beats.offsets.push(((ev.clientX - centre) / (rect.width / 2)) * 25);
      read.textContent = `${beats.offsets.length} / ${recipe.stackCount}`;
      if (beats.offsets.length >= recipe.stackCount) { stage = 'drizzle'; render(); }
    });
  }

  // BEAT 4 — DRIZZLE. Drag across six cells; each cell fills while the
  // pointer is over it. Even coverage wins; pooling and bare cells cost.
  function doDrizzle() {
    const area = document.getElementById('beat-area');
    const CELLS = 6;
    beats.coverage = new Array(CELLS).fill(0);
    area.innerHTML = `<p>Drag across the stack. Even coverage, no pooling.</p>
      <div id="drizzle" style="display:flex;gap:2px;height:80px;cursor:crosshair">
        ${Array.from({ length: CELLS }, (_, i) =>
          `<div data-cell="${i}" style="flex:1;background:#2c2340;border-radius:4px"></div>`).join('')}
      </div>
      <button id="drizzle-done">Done</button>`;
    const wrap = document.getElementById('drizzle');
    let down = false;
    const fill = target => {
      const i = target?.dataset?.cell;
      if (i === undefined) return;
      beats.coverage[i] = Math.min(1.2, beats.coverage[i] + 0.06);
      target.style.background = `rgba(201,168,255,${Math.min(1, beats.coverage[i])})`;
    };
    wrap.addEventListener('mousedown', e => { down = true; fill(e.target); });
    wrap.addEventListener('mousemove', e => { if (down) fill(e.target); });
    window.addEventListener('mouseup', () => { down = false; });
    document.getElementById('drizzle-done').addEventListener('click', () => {
      mount.innerHTML = '';
      onDone(beats);
    }, { once: true });
  }

  render();
}
```

- [x] **Step 2: Play it in the browser**

Run: `python3 -m http.server 8000`, open `http://localhost:8000`, New Game → Open the shop.
Expected: pour builds a volume while held; bubbles animate and Flip records an offset; six clicks place a stack; dragging fills the drizzle cells; Done reports a quality percentage and the next customer appears.

- [x] **Step 3: Answer the spec's open question**

Play ten dishes. Record in `docs/superpowers/specs/2026-09-05-pancake-shop-design.md` §5 whether pour and drizzle feel adequate in DOM, or need `<canvas>`. Replace the "Open, resolve by prototype not argument" line with the answer and the reason.

- [x] **Step 4: Commit**

```bash
git add js/ui/griddle.js docs/superpowers/specs/2026-09-05-pancake-shop-design.md
git commit -m "feat: griddle - four interactive beats, DOM prototype"
```

---

## Task 12: VN layer, one Synthia visit, CONTENT.md, README

**Files:**
- Create: `js/data/scenes.js`, `js/ui/vn.js`, `CONTENT.md`, `README.md`
- Modify: `js/main.js` (fire the visit on week rollover)

**Interfaces:**
- Consumes: `showScreen` (Task 10); `expressionFor`, `noteMention`, `grant` (Task 6)
- Produces:
  - `SCENES` — object keyed by node id, god-synthia node format plus a `mentions` field
  - `playScene(startId: string, state, onEnd: () => void) -> void`

- [x] **Step 1: Create `js/data/scenes.js`**

```js
/* SYNTHIA'S SCENES — same node format as god-synthia's js/story.js.

   Node fields:
     speaker   - name in the name box; omit for narration
     text      - the line(s)
     expr      - expression key; omit to use her affection-tier default
     next      - id of the following node
     choices   - [{ text, next, affection }]
     mentions  - recipe id she mentions in passing. If the player later
                 researches and serves it, unprompted, she notices.
                 THIS IS THE ARC'S BEST BEAT. See engine/affection.js.
     end       - true to close the scene

   VOICE: second person present tense, hard-broken short fragments, deadpan.
   Her spoken lines use smart quotes. See
   ~/vault/projects/god-synthia/research/voice-style-guide.md

   PLACEHOLDER TEXT BELOW — for the collaborator to replace. */

export const SCENES = {
  visit_week1: {
    speaker: '???',
    text: 'The bell goes.\n\nShe is taller than the doorway should allow.',
    next: 'visit_week1_b'
  },
  visit_week1_b: {
    speaker: 'God Synthia',
    expr: 'neutral',
    text: '“You are open.”\n\nIt is not quite a question.',
    next: 'visit_week1_c'
  },
  visit_week1_c: {
    speaker: 'God Synthia',
    text: '“Something plain. I am not in the mood to be impressed.”',
    choices: [
      { text: 'Plain it is.', next: 'visit_week1_end', affection: 1 },
      { text: 'You could be.', next: 'visit_week1_end', affection: 2 }
    ]
  },
  visit_week1_end: {
    speaker: 'God Synthia',
    text: '“Hm.”\n\nShe stays a moment longer than she needs to.',
    end: true
  },

  quota_missed: {
    speaker: 'God Synthia',
    expr: 'thinking',
    text: '“Short, this week.”\n\nA pause.\n\n“It happens. The world did not end. I checked.”',
    end: true
  },

  quota_met: {
    speaker: 'God Synthia',
    expr: 'happy',
    text: '“You made the number.”\n\n“Breakfast holds. For another week.”',
    end: true
  },

  /* A mention. She says it lightly and moves on. If the player researches
     the souffle weeks later and serves it to her, engine/affection.js fires
     the listening beat. */
  mention_souffle: {
    speaker: 'God Synthia',
    expr: 'sigh',
    text: '“There was a thing, once. Barely there. You breathed on it and it fell.”\n\n“…Nobody makes it any more.”',
    mentions: 'souffle',
    end: true
  }
};
```

- [x] **Step 2: Create `js/ui/vn.js`**

```js
import { SCENES } from '../data/scenes.js';
import { showScreen, showNotice } from './screens.js';
import { expressionFor, noteMention, grant } from '../engine/affection.js';

const SPRITE_DIR = 'assets/sprites/synthia_casual/';
const spriteFor = expr => `${SPRITE_DIR}c_${expr}.png`;

export function playScene(startId, state, onEnd) {
  let current = startId;

  const render = () => {
    const node = SCENES[current];
    if (!node) {
      // Never a dead click. A missing node is diagnosable, not silent.
      console.warn(`[vn] missing scene node: ${current}`);
      showNotice(`Story node "${current}" is missing.`);
      return finish();
    }

    document.getElementById('vn-name').textContent = node.speaker || '';
    document.getElementById('vn-text').textContent = node.text || '';

    const expr = node.expr || expressionFor(state.synthia.points);
    const img = document.getElementById('vn-sprite');
    img.src = spriteFor(expr);
    img.onerror = () => { console.warn(`[vn] missing sprite: ${img.src}`); img.removeAttribute('src'); };

    if (node.mentions) noteMention(state.synthia, node.mentions);

    const choicesEl = document.getElementById('vn-choices');
    choicesEl.innerHTML = '';

    if (node.end) {
      const btn = document.createElement('button');
      btn.textContent = 'Continue';
      btn.addEventListener('click', finish, { once: true });
      choicesEl.append(btn);
      return;
    }

    const valid = (node.choices || []).filter(c => c && c.text && c.next);
    if (node.choices && valid.length === 0) {
      showNotice('This scene has no usable choices. Continuing.');
      return finish();
    }

    if (valid.length > 0) {
      for (const c of valid) {
        const btn = document.createElement('button');
        btn.textContent = c.text;
        btn.addEventListener('click', () => {
          if (c.affection) grant(state.synthia, c.affection, 'a choice she liked');
          current = c.next;
          render();
        }, { once: true });
        choicesEl.append(btn);
      }
      return;
    }

    const btn = document.createElement('button');
    btn.textContent = 'Next';
    btn.addEventListener('click', () => { current = node.next; render(); }, { once: true });
    choicesEl.append(btn);
  };

  function finish() { onEnd(); }

  showScreen('vn');
  render();
}
```

- [x] **Step 3: Wire the visit into `js/main.js`**

Add the import at the top:

```js
import { playScene } from './ui/vn.js';
```

Replace the whole `toEvening` function with:

```js
function toEvening() {
  const dayResult = closeDay(state);
  renderLedger(state, dayResult);
  saveGame();

  if (dayResult.weekRolled) {
    // The quota is the story metronome. Hitting it opens the next beat;
    // missing it fires a softer scene and costs nothing.
    const { met } = dayResult.weekResult;
    const first = state.week === 2 && !state.flags.metHer;
    if (first) state.flags.metHer = true;
    const sceneId = first ? 'visit_week1' : (met ? 'quota_met' : 'quota_missed');
    playScene(sceneId, state, () => { saveGame(); showScreen('evening'); });
    return;
  }

  showScreen('evening');
}
```

- [x] **Step 4: Copy Synthia's sprites into the project**

```bash
mkdir -p ~/vault/projects/pancake-shop/assets/sprites
cp -r ~/vault/projects/god-synthia/assets/sprites/synthia_casual ~/vault/projects/pancake-shop/assets/sprites/
rm -f ~/vault/projects/pancake-shop/assets/sprites/synthia_casual/*.kra
rm -f ~/vault/projects/pancake-shop/assets/sprites/synthia_casual/*~
ls ~/vault/projects/pancake-shop/assets/sprites/synthia_casual/ | head
```

Expected: 29 PNGs. **Filenames verified 2026-09-05** — the `c_<expr>.png` convention holds, and every expression `TIER_EXPRESSION` references exists: `c_neutral.png`, `c_curious.png`, `c_thinking.png`, `c_happy.png`, `c_love.png`. `spriteFor` needs no change.

Also present, and worth knowing about for Phase 2: eight **activity poses** — `cact_coffee`, `cact_sitting`, `cact_phone`, `cact_snack`, `cact_stretch`, `cact_bag`, `cact_peace`, `cact_pockets` — plus five body angles (`cpose_front`, `cpose_back`, `cpose_side`, `cpose_q_front`, `cpose_q_back`).

The activity poses matter to §9. The spec says affection should show in *how long she lingers*, and these are exactly the art for that: at low tiers she stands (`cpose_front`); as the arc deepens she sits, gets a coffee, stays. That is the arc rendered without a single line of dialogue, and the art already exists.

Note there is no `c_smug.png` in this set — the VN aliases smug to `c_wink.png`. Do the same if a scene asks for it.

- [x] **Step 5: Play the full loop in the browser**

Run: `python3 -m http.server 8000`
Play seven days. Expected: on closing day 7, Synthia's first visit plays with her sprite, choices work, Continue returns to the evening screen, and the save survives a reload via Continue.

- [x] **Step 6: Create `CONTENT.md`**

```markdown
# Adding content

Everything you can change lives in `js/data/`. You never need to open
anything in `js/engine/` or `js/ui/`.

After any edit, run this and fix anything it reports:

    node tools/validate.js

It prints the file and the row for every problem in plain English.

## Naming the game

`js/data/meta.js` — set `title` to whatever you want to call it. It is
`null` right now, so the game shows "Pancake Shop" as a fallback.

## Adding a pancake — `js/data/recipes.js`

Copy an existing row and change it:

    {
      id: 'lemon_stack',            // unique, no spaces
      name: 'Lemon Stack',          // what the player sees
      tags: ['basic'],              // customers order by tag
      base: 25,                     // base price
      ingredients: ['flour', 'lemon'],
      pour: { target: 55, band: 9 },  // ml of batter, and how close counts
      flip: { windowMs: 450 },        // bigger = more forgiving
      stackCount: 3,
      weights: { pour: 1, flip: 2, stack: 1, drizzle: 1 },
      unlockedAtStart: false
    }

`weights` is the interesting part. It decides what this dish is ABOUT.
A high `flip` weight makes it a timing dish. A high `stack` weight makes
it a precision dish. Four numbers change how it feels to make.

## Adding a syrup — `js/data/syrups.js`

If it should be found by experimenting, give it a `discover` block. The
`target` is the flavour profile the player has to hit; `tolerance` is how
close counts. Bigger tolerance = easier to find.

## Adding a customer — `js/data/customers.js`

One row. `wants` are recipe tags. `unlockAt` can be a week, a reputation
number, or both. There is no patience field — the game has no clock and
customers never get impatient.

## Adding research — `js/data/research.js`

`prereqs` are other research ids. `gate` can require the player to have
cooked something a number of times. `unlocks` is exactly one of a recipe,
a syrup, or an upgrade.

Upgrades make mistakes cost less; they never make numbers bigger. That is
deliberate — the game should get calmer as it goes.

## Writing Synthia — `js/data/scenes.js`

Same format as god-synthia's `js/story.js`, so it should feel familiar.

Voice rules are in
`~/vault/projects/god-synthia/research/voice-style-guide.md`.
Second person, present tense, short hard-broken fragments, deadpan.
Her spoken lines go in smart quotes.

### The one field worth knowing about

    mentions: 'souffle'

Put that on a node where she mentions something in passing. If the player
later researches that dish and serves it to her, unprompted, weeks after
she said it — she notices, and it is worth more than anything else in the
game.

Use it sparingly. It only works if it feels like she forgot she said it.

## How affection works

`js/data/affection.js` holds the thresholds. The player never sees a
number or a bar — the arc shows up in which expression she wears, how
long she lingers, and what she says.

Affection can stall. It never falls. Nothing the player does badly takes
it away.
```

- [x] **Step 7: Create `README.md`**

```markdown
# Pancake Shop (working title)

A chill 2D browser shop sim set in the God Synthia world. You run a
pancake shop, chase a weekly quota, research new pancakes and syrups, and
a tired goddess keeps showing up.

Synthia is [collaborator]'s character. Writing follows the voice guide at
`~/vault/projects/god-synthia/research/voice-style-guide.md`.

## Run it

No build step, no dependencies.

    python3 -m http.server 8000

Then open http://localhost:8000

## Tests

    node --test tests/

## Check the content

    node tools/validate.js

## Adding content

See CONTENT.md. Everything editable lives in `js/data/`.

## Layout

    js/data/    content — recipes, syrups, research, customers, scenes
    js/engine/  rules — pure, no DOM, unit tested
    js/ui/      screens — DOM, no rules
    tools/      validate.js
    tests/      one file per engine module
```

- [x] **Step 8: Run everything**

```bash
node --test tests/
node tools/validate.js
```

Expected: all tests pass, `0 error(s)`.

- [x] **Step 9: Commit**

```bash
git add js/data/scenes.js js/ui/vn.js js/main.js assets CONTENT.md README.md
git commit -m "feat: VN layer, first Synthia visit, CONTENT.md handoff guide"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Covered by |
|---|---|
| §3 Architecture, ES modules, engine/ui/data split | Task 1 (skeleton), Task 2 (purity guards enforce it) |
| §4 Day loop, no clock | Task 8 (`openDay`/`closeDay`), Task 10 (screens) |
| §4 Anti-grind: variety, research gating, diminishing returns | Task 4 (`repeatMultiplier`), Task 5 (gates), Task 8 (`serve`) |
| §5 Four-beat loop, per-recipe weights, compounding stack | Task 3 (scoring), Task 11 (interaction) |
| §5 Generous windows, upgrades reduce error | Task 3 (`effectsFor`, falloff curves) |
| §6 Quota as story metronome, no penalty | Task 4 (`rollWeek` mutates nothing), Task 12 (scene fires) |
| §6 Reputation: rises, never falls, gates customers | Task 4 (`reputationGain`), Task 8 (`customerPool`) |
| §7 Research tree + bench, hints, always-pay failures | Task 5 |
| §8 Customers, no patience field | Task 2 (data), Task 8 (pool) |
| §9 Hidden affection, tiers, never falls, listening mechanic | Task 6, Task 12 (`mentions`) |
| §10 Handoff: CONTENT.md, validator, runtime tolerance | Task 9, Task 12, Task 7 (tolerant deserialize) |
| §11 Testing: pure engine, unit tested | Tasks 3–8 |
| §12 Build order | This plan's task order |
| Title not hardcoded | Task 2 (`META.title = null`), Task 10 (fallback) |

No spec requirement is unimplemented. §12's Phase 2 (art, decoration, audio, full content) is deliberately out of scope.

**Placeholder scan:** No TBDs. The only things called "placeholder" are intentional and labelled — the quota numbers (§6 says tune from play), the customer lines, and Synthia's scene text, all of which are the collaborator's to write and are marked as such in the files themselves.

**Type consistency checked:**
- `beats` object shape `{volume, msOffset, offsets, coverage}` is produced by `mountGriddle` (Task 11) and consumed by `scoreDish` (Task 3) and `serve` (Task 8) — consistent.
- `state.synthia` shape `{points, mentions, noticed, log, lastVisitWeek}` is created in `newGame` (Task 7) and used by every `engine/affection.js` function (Task 6) — consistent.
- `purchase` returns `{ok, node}` / `{ok, reason}` in both Task 5's tests and implementation.
- `rollWeek` returns `{met, quota, earned, week}` in Task 4 and is destructured as `{met}` in Task 12 — consistent.
- `closeDay` returns `{dayEarnings, weekRolled, weekResult?}` in Task 8, consumed by `renderLedger` and `toEvening` in Tasks 10 and 12 — consistent.
- `UPGRADE_EFFECTS` keys (`pour_band_bonus`, `flip_window_bonus`, `stack_forgiveness`) match the `unlocks.upgrade` values in `RESEARCH` — consistent.

**One known deviation to fix during execution:** Task 8's test file contains a dead line (`const recipe = { ...s.menu.map(id => id), };`) which Step 4 of that task removes. It is called out rather than silently left.
