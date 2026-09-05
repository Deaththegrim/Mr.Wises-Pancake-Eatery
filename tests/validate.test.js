import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContent } from '../tools/validate.js';

test('the shipped content validates clean', () => {
  const { errors } = validateContent();
  assert.deepEqual(errors, [], `content has errors:\n${errors.join('\n')}`);
});

test('a recipe citing a missing ingredient is reported by file and row', () => {
  const { errors } = validateContent({
    recipes: [{ id: 'broken', name: 'Broken', tags: ['basic'], base: 1, ingredients: ['nope'],
                pour: { target: 1, band: 1 }, flip: { windowMs: 1 }, stackCount: 1,
                weights: { pour: 1, flip: 1, stack: 1, drizzle: 1 }, unlockedAtStart: true }]
  });
  assert.ok(errors.some(e => /recipes\.js/.test(e) && /broken/.test(e) && /nope/.test(e)),
    `expected a recipes.js error naming both ids, got:\n${errors.join('\n')}`);
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
    recipes: [{ id: 'x', name: 'X', tags: ['basic'], base: 1, ingredients: [],
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

/* The two checks earned by bugs found during implementation. */

test('a recipe whose tag no customer wants is an ERROR - unreachable revenue', () => {
  // This is the Impossible Stack bug: the most valuable dish in the game
  // was tagged `divine` and nobody wanted `divine`, so it could never be
  // ordered no matter how much research went into it.
  const { errors } = validateContent({
    recipes: [{ id: 'orphan', name: 'Orphan', tags: ['nobody_wants_this'], base: 99, ingredients: [],
                pour: { target: 1, band: 1 }, flip: { windowMs: 1 }, stackCount: 1,
                weights: { pour: 1, flip: 1, stack: 1, drizzle: 1 }, unlockedAtStart: true }]
  });
  assert.ok(errors.some(e => /orphan/.test(e) && /nobody_wants_this/.test(e)),
    `expected an unreachable-recipe error, got:\n${errors.join('\n')}`);
});

test('an undiscoverable syrup is an ERROR, and the message says how far off it is', () => {
  // This is the salted_caramel bug: the bench AVERAGES its ingredients, so
  // a target outside the ingredients' reachable range can never be hit.
  const { errors } = validateContent({
    syrups: [{ id: 'unreachable', name: 'Unreachable', cost: 1, unlockedAtStart: false,
               axes: { sweet: 1, sharp: 1, rich: 1, strange: 1 },
               discover: { target: { sweet: 99, sharp: 99, rich: 99, strange: 99 }, tolerance: 1, tier: 1 } }]
  });
  const hit = errors.find(e => /unreachable/.test(e));
  assert.ok(hit, `expected a reachability error, got:\n${errors.join('\n')}`);
  assert.match(hit, /closest/i, 'the message must tell the author how far off the target is');
});

test('a syrup with a discover block but no target is reported', () => {
  const { errors } = validateContent({
    syrups: [{ id: 's', name: 'S', cost: 1, unlockedAtStart: false,
               axes: { sweet: 0, sharp: 0, rich: 0, strange: 0 }, discover: { tolerance: 1 } }]
  });
  assert.ok(errors.some(e => /target/i.test(e)));
});

/* REQUIRED-FIELD CHECKS.

   Each of these was a reproduced crash where the validator reported 0 errors
   and the (non-tolerant) engine then threw. The validator must be STRICTER
   than the engine, not more forgiving — a content author cannot debug a
   TypeError, and several of these produced a permanently dead button with
   nothing but a console message. */

const RECIPE = {
  id: 'x', name: 'X', tags: ['basic'], base: 10, ingredients: [], stackCount: 2,
  pour: { target: 1, band: 1 }, flip: { windowMs: 1 },
  weights: { pour: 1, flip: 1, stack: 1, drizzle: 1 }, unlockedAtStart: true
};

test('a recipe missing `ingredients` is an error (New Game was a dead click)', () => {
  const { errors } = validateContent({ recipes: [{ ...RECIPE, ingredients: undefined }] });
  assert.ok(errors.some(e => /ingredients/.test(e)));
});

test('a typo in `weights` is an error (it made money and reputation NaN, and SAVED it)', () => {
  const { errors } = validateContent({
    recipes: [{ ...RECIPE, weights: { pour: 1, flip: 1, stack: 1, drizzel: 1 } }]
  });
  assert.ok(errors.some(e => /weights/.test(e)), `expected a weights error, got:\n${errors.join('\n')}`);
});

test('a recipe missing `stackCount` is an error (it trapped the player in the stack beat)', () => {
  const { errors } = validateContent({ recipes: [{ ...RECIPE, stackCount: undefined }] });
  assert.ok(errors.some(e => /stackCount/.test(e)));
});

test('a research node missing `prereqs` is an error (Research became a dead button)', () => {
  const { errors } = validateContent({ research: [{ id: 'r', name: 'R', cost: 1, unlocks: {} }] });
  assert.ok(errors.some(e => /prereqs/.test(e)));
});

test('an ingredient missing `axes` is REPORTED, not thrown', () => {
  // The validator used to crash here — on exactly the content it exists to
  // diagnose, handing the author a Node stack trace.
  let errors;
  assert.doesNotThrow(() => { ({ errors } = validateContent({
    ingredients: [{ id: 'flour', name: 'Flour', cost: 6 }]
  })); });
  assert.ok(errors.some(e => /axes/.test(e)));
});

test('a typo in an axis name is an error (it made every syrup undiscoverable)', () => {
  const { errors } = validateContent({
    ingredients: [{ id: 'flour', name: 'Flour', cost: 6,
                    axes: { sweet: 1, sharp: 0, rich: 2, strage: 0 } }]
  });
  assert.ok(errors.some(e => /axes/.test(e)));
});

test('no customer available in week 1 is an error (the shop opens to nobody)', () => {
  const { errors } = validateContent({
    customers: [{ id: 'c', name: 'C', unlockAt: { week: 5 }, wants: ['basic'],
                  lines: { greeting: 'a', happy: 'b', disappointed: 'c' } }]
  });
  assert.ok(errors.some(e => /week 1|nobody/i.test(e)));
});
