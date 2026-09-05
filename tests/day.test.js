import { test } from 'node:test';
import assert from 'node:assert/strict';
import { customerPool, nextCustomer, serve, openDay, closeDay, customersToday, demandShift } from '../js/engine/day.js';
import { synthiaDueToday } from '../js/engine/story.js';
import { TUNING } from '../js/data/economy.js';
import { newGame } from '../js/engine/state.js';
import { quotaForWeek } from '../js/engine/economy.js';
import { noteMention } from '../js/engine/affection.js';
import { RECIPES } from '../js/data/recipes.js';

// A flawless execution of any recipe, derived from that recipe's own targets.
const perfect = recipeId => {
  const r = RECIPES.find(x => x.id === recipeId);
  return {
    volume: r.pour.target,
    msOffset: 0,
    offsets: new Array(r.stackCount).fill(0),
    coverage: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7]
  };
};

test('the starting customer pool is not empty', () => {
  const s = newGame(1);
  assert.ok(customerPool(s).length > 0, 'week 1 must have customers or the game cannot start');
});

test('reputation-gated customers are excluded until earned', () => {
  const s = newGame(1);
  assert.ok(!customerPool(s).map(c => c.id).includes('the_critic'), 'the critic needs reputation 40');
  s.reputation = 50;
  assert.ok(customerPool(s).map(c => c.id).includes('the_critic'));
});

test('nextCustomer is deterministic for a given seed', () => {
  const a = newGame(99), b = newGame(99);
  openDay(a); openDay(b);
  assert.deepEqual(nextCustomer(a), nextCustomer(b));
});

test('consecutive customers in a day are not all identical', () => {
  // Skip Synthia's day: she is a single customer who waits at the counter
  // until served, so on her day every call correctly returns her.
  const s = newGame(4);
  for (let d = 1; d <= 7; d++) {
    s.day = d;
    openDay(s);
    if (synthiaDueToday(s)) continue;
    const orders = [];
    for (let i = 0; i < 12; i++) orders.push(nextCustomer(s).customer.id);
    assert.ok(new Set(orders).size > 1, 'the order index must advance the rng, not repeat one customer');
    return;
  }
  assert.fail('no ordinary day found in the week');
});

test('Synthia waits at the counter until she is served', () => {
  const s = newGame(4);
  for (let d = 1; d <= 7; d++) {
    s.day = d;
    openDay(s);
    if (!synthiaDueToday(s)) continue;
    assert.equal(nextCustomer(s).isSynthia, true);
    assert.equal(nextCustomer(s).isSynthia, true, 'she does not wander off unserved');
    serve(s, s.menu[0], {
      volume: 50, msOffset: 0, offsets: [0, 0, 0], coverage: [0.7, 0.7, 0.7]
    }, { forSynthia: true });
    const after = nextCustomer(s);
    assert.ok(!after || !after.isSynthia, 'and the queue moves on once she is served');
    return;
  }
  assert.fail('no Synthia day found in the week');
});

test('nextCustomer only orders something on the menu', () => {
  const s = newGame(5);
  openDay(s);
  for (let i = 0; i < 20; i++) {
    const order = nextCustomer(s);
    if (order) assert.ok(s.menu.includes(order.recipeId), `ordered ${order.recipeId}, not on menu`);
  }
});

test('nextCustomer returns null when the menu is empty', () => {
  const s = newGame(1);
  openDay(s);
  s.menu = [];
  assert.equal(nextCustomer(s), null);
});

test('a perfect serve pays, tips, and raises reputation', () => {
  const s = newGame(1);
  openDay(s);
  const r = serve(s, 'plain', perfect('plain'));
  assert.equal(r.quality, 100);
  assert.ok(r.payout > 0);
  assert.ok(r.tip > 0);
  assert.ok(s.reputation > 0);
  assert.ok(s.money > 0);
});

test('serving records the cook count for research gates', () => {
  const s = newGame(1);
  openDay(s);
  serve(s, 'plain', perfect('plain'));
  serve(s, 'plain', perfect('plain'));
  assert.equal(s.cooked.plain, 2);
});

test('repeats within a day pay less', () => {
  const s = newGame(1);
  openDay(s);
  const first = serve(s, 'plain', perfect('plain')).payout;
  for (let i = 0; i < 4; i++) serve(s, 'plain', perfect('plain'));
  const sixth = serve(s, 'plain', perfect('plain')).payout;
  assert.ok(sixth < first, `repeats must diminish (${first} -> ${sixth})`);
});

test('serving an unknown recipe fails safely', () => {
  const s = newGame(1);
  openDay(s);
  assert.throws(() => serve(s, 'not_a_recipe', perfect('plain')), /unknown recipe/i);
});

test('openDay clears the previous day repeat counts', () => {
  const s = newGame(1);
  openDay(s);
  serve(s, 'plain', perfect('plain'));
  assert.equal(s.todayServed.plain, 1);
  closeDay(s);
  openDay(s);
  assert.equal(s.todayServed.plain, undefined);
});

test('cook counts persist across days even though repeat counts reset', () => {
  const s = newGame(1);
  openDay(s); serve(s, 'plain', perfect('plain')); closeDay(s);
  openDay(s); serve(s, 'plain', perfect('plain')); closeDay(s);
  assert.equal(s.cooked.plain, 2, 'research gates depend on this surviving the day boundary');
});

test('closeDay advances the day and rolls the week every 7 days', () => {
  const s = newGame(1);
  for (let d = 0; d < 6; d++) { openDay(s); assert.equal(closeDay(s).weekRolled, false); }
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

test('money survives the week rollover even though week earnings reset', () => {
  const s = newGame(1);
  openDay(s);
  serve(s, 'plain', perfect('plain'));
  const earned = s.money;
  closeDay(s);
  for (let d = 0; d < 6; d++) { openDay(s); closeDay(s); }
  assert.equal(s.weekEarnings, 0);
  assert.equal(s.money, earned, 'the till is not emptied by a new week');
});

test('serving Synthia something she mentioned fires the listening beat', () => {
  const s = newGame(1);
  openDay(s);
  noteMention(s.synthia, 'plain');
  const r = serve(s, 'plain', perfect('plain'), { forSynthia: true });
  assert.equal(r.noticed, true);
});

test('serving Synthia normally does not fire the listening beat', () => {
  const s = newGame(1);
  openDay(s);
  const r = serve(s, 'plain', perfect('plain'), { forSynthia: true });
  assert.equal(r.noticed, false);
  assert.ok(s.synthia.points > 0, 'but she still appreciates good work');
});

test('the quota for week 1 matches the curve', () => {
  assert.equal(quotaForWeek(1), 300);
});

// --- reputation as an income scaler (spec §6) ---

test('a better-known shop is busier', () => {
  const quiet = { reputation: 0 };
  const known = { reputation: 100 };
  assert.ok(customersToday(known) > customersToday(quiet));
  assert.equal(customersToday(quiet), TUNING.baseTraffic);
});

test('traffic is capped so a chill game never becomes a clicking marathon', () => {
  assert.equal(customersToday({ reputation: 999999 }), TUNING.maxTraffic);
});

test('demand shift runs 0 to 1 and is monotonic', () => {
  assert.equal(demandShift(0), 0);
  assert.equal(demandShift(TUNING.demandShiftMinRep), 0);
  assert.equal(demandShift(TUNING.demandShiftFullRep), 1);
  assert.equal(demandShift(999999), 1);
  assert.ok(demandShift(200) > demandShift(100));
});

test('a well-known shop sells more expensive dishes than an unknown one', () => {
  // Same seed, same menu, different reputation. The famous shop should
  // earn materially more from the same number of customers.
  const RECIPE_IDS = ['plain', 'buttermilk_stack', 'souffle'];
  const takings = rep => {
    const s = newGame(1234);
    s.unlockedRecipes = [...RECIPE_IDS];
    s.menu = [...RECIPE_IDS];
    s.reputation = rep;
    openDay(s);
    let total = 0;
    for (let i = 0; i < 40; i++) {
      const o = nextCustomer(s);
      if (o) total += RECIPES.find(r => r.id === o.recipeId).base;
    }
    return total;
  };
  const unknown = takings(0);
  const famous = takings(TUNING.demandShiftFullRep);
  assert.ok(famous > unknown, `demand must shift upmarket (${unknown} -> ${famous})`);
});

test('nextCustomer returns null rather than throwing when the menu is all unknown ids', () => {
  const s = newGame(1);
  openDay(s);
  s.menu = ['ghost_recipe'];
  assert.equal(nextCustomer(s), null);
});
