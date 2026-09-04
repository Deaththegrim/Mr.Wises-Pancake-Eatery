import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceOf, stockOf, canAfford, buyIngredient, hasIngredients, consumeIngredients, consumeForCooking, restockCost } from '../js/engine/pantry.js';
import { experiment } from '../js/engine/research.js';
import { newGame } from '../js/engine/state.js';
import { INGREDIENTS } from '../js/data/ingredients.js';
import { TUNING } from '../js/data/economy.js';

const UNIT = TUNING.servingsPerUnit;   // stock is bought in units, held in servings

const stocked = (extra = {}) => {
  const s = newGame(1);
  s.money = 500;
  s.pantry = { flour: 5 * UNIT, maple: 5 * UNIT, lemon: 5 * UNIT, ...extra };
  return s;
};

test('a new game starts with an empty pantry and no money', () => {
  const s = newGame(1);
  assert.deepEqual(s.pantry, {});
  assert.equal(s.money, 0);
});

test('every ingredient has a price', () => {
  for (const ing of INGREDIENTS) {
    assert.equal(typeof priceOf(ing.id), 'number', `${ing.id} has no cost`);
    assert.ok(priceOf(ing.id) > 0, `${ing.id} must cost something`);
  }
});

test('buying spends money and adds stock', () => {
  const s = stocked();
  const before = s.money;
  const r = buyIngredient(s, 'maple', 3);
  assert.equal(r.ok, true);
  assert.equal(stockOf(s, 'maple'), (5 + 3) * UNIT, 'each unit adds a bulk number of servings');
  assert.equal(s.money, before - priceOf('maple') * 3, 'but you pay per unit, not per serving');
});

test('buying what you cannot afford fails and spends nothing', () => {
  const s = stocked();
  s.money = 1;
  const r = buyIngredient(s, 'starlight', 5);
  assert.equal(r.ok, false);
  assert.match(r.reason, /afford|money/i);
  assert.equal(s.money, 1);
  assert.equal(stockOf(s, 'starlight'), 0);
});

test('buying an unknown ingredient fails clearly', () => {
  const r = buyIngredient(stocked(), 'moonrock', 1);
  assert.equal(r.ok, false);
  assert.match(r.reason, /unknown/i);
});

test('buying a non-positive quantity is refused', () => {
  const s = stocked();
  assert.equal(buyIngredient(s, 'maple', 0).ok, false);
  assert.equal(buyIngredient(s, 'maple', -3).ok, false);
  assert.equal(stockOf(s, 'maple'), 5 * UNIT, 'a negative buy must not remove stock or refund money');
});

test('canAfford reflects the real price', () => {
  const s = stocked();
  s.money = priceOf('maple') * 2;
  assert.equal(canAfford(s, 'maple', 2), true);
  assert.equal(canAfford(s, 'maple', 3), false);
});

test('hasIngredients checks stock, including duplicates in one blend', () => {
  const s = stocked({ maple: UNIT });
  assert.equal(hasIngredients(s, ['maple']), true);
  assert.equal(hasIngredients(s, ['maple', 'maple']), false, 'a blend using two of one thing needs two units');
  assert.equal(hasIngredients(s, ['starlight']), false);
});

test('the bench burns a WHOLE UNIT of each ingredient', () => {
  // Experimenting is wasteful on purpose: that gap between bench cost and
  // cooking cost is what keeps discovery an expensive habit.
  const s = stocked();
  consumeIngredients(s, ['maple', 'lemon', 'maple']);
  assert.equal(stockOf(s, 'maple'), 3 * UNIT);
  assert.equal(stockOf(s, 'lemon'), 4 * UNIT);
});

test('stock never goes negative', () => {
  const s = stocked({ maple: 1 });
  consumeIngredients(s, ['maple', 'maple', 'maple']);
  assert.ok(stockOf(s, 'maple') >= 0);
});

test('cooking costs far less per dish than one bench experiment', () => {
  // The whole economy rests on this: cooking must be profitable while
  // experimenting is a real investment.
  const a = stocked(), b = stocked();
  consumeForCooking(a, ['maple']);
  consumeIngredients(b, ['maple']);
  assert.ok(stockOf(a, 'maple') > stockOf(b, 'maple'),
    'one experiment must cost more stock than one pancake');
  assert.equal(stockOf(a, 'maple'), 5 * UNIT - 1);
});

test('restockCost prices a whole blend', () => {
  assert.equal(restockCost(['maple', 'lemon']), priceOf('maple') + priceOf('lemon'));
});

// --- the point of all this: the bench now costs money ---

test('an experiment CONSUMES its ingredients', () => {
  const s = stocked();
  experiment(s, ['maple', 'lemon']);
  assert.equal(stockOf(s, 'maple'), 4 * UNIT);
  assert.equal(stockOf(s, 'lemon'), 4 * UNIT);
});

test('an experiment you lack the ingredients for is refused and consumes nothing', () => {
  const s = stocked();
  const r = experiment(s, ['starlight', 'ashsugar']);
  assert.equal(r.found, false);
  assert.equal(r.blocked, true);
  assert.match(r.hint, /stock|buy|have/i);
  assert.equal(r.points, 0, 'a blocked experiment is not a failed one - it never happened');
  assert.equal(stockOf(s, 'starlight'), 0);
});

test('a FAILED experiment still consumes ingredients and still pays a hint', () => {
  // Failure must cost something real, or there is no grind - but it must
  // still teach, or nobody experiments.
  const s = stocked();
  const r = experiment(s, ['flour']);
  assert.equal(r.found, false);
  assert.equal(r.blocked, undefined);
  assert.ok(r.hint.length > 0);
  assert.ok(r.points > 0);
  assert.equal(stockOf(s, 'flour'), 4 * UNIT, 'a whole unit of flour was used up');
});

test('discovery is now gated on money, not just curiosity', () => {
  // With an empty pantry and no money, you cannot experiment at all.
  const s = newGame(1);
  s.money = 0;
  const r = experiment(s, ['maple', 'lemon']);
  assert.equal(r.blocked, true);
  assert.equal(buyIngredient(s, 'maple', 1).ok, false);
});

test('a save without a pantry is repaired rather than breaking', () => {
  const s = newGame(1);
  delete s.pantry;
  assert.equal(stockOf(s, 'maple'), 0, 'stockOf must tolerate a missing pantry');
});
