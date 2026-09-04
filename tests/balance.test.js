import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../tools/simulate.js';
import { quotaForWeek } from '../js/engine/economy.js';
import { RECIPES } from '../js/data/recipes.js';
import { priceOf } from '../js/engine/pantry.js';
import { TUNING } from '../js/data/economy.js';

/* BALANCE REGRESSION TESTS.

   The lesson of this build, encoded so it cannot happen twice: every unit
   test passed while the game was unplayable from week 4, because income
   never scaled and nothing checked. `tools/simulate.js` found it — but a
   tool only helps if someone remembers to run it.

   These are the assertions a content or economy change must not break.
   They are deliberately loose: they pin the SHAPE of the game, not exact
   numbers, so ordinary tuning does not produce false failures. If one of
   these fails, run `node tools/simulate.js` and read the table. */

test('a full 8-week game completes without throwing', () => {
  const rows = simulate(2026, 'careful');
  assert.equal(rows.length, 8, 'the simulation must reach week 8');
});

test('income GROWS across the game — the quota curve depends on it', () => {
  // This is the exact failure that made weeks 4-8 unreachable: earnings
  // sat flat at ~2800 while the quota climbed. Never again silently.
  const rows = simulate(2026, 'careful');
  const early = rows[1].earned;      // week 2
  const late = rows[6].earned;       // week 7
  assert.ok(late > early * 3,
    `income must compound, not plateau: week 2 = ${early}, week 7 = ${late}`);
});

test('a careful player clears the early weeks comfortably', () => {
  const rows = simulate(2026, 'careful');
  for (const r of rows.slice(0, 4)) {
    assert.ok(r.met, `week ${r.week} should be comfortable for a careful player (${r.earned}/${r.quota})`);
  }
});

test('the late weeks are NOT trivially cleared by execution alone', () => {
  // If a careful player who sells everything clears all eight weeks, the
  // quota has stopped being a decision and the menu screen is a formality.
  const rows = simulate(2026, 'careful');
  const missed = rows.filter(r => !r.met);
  assert.ok(missed.length >= 1,
    'at least one week must require more than good execution — try curating the menu');
  assert.ok(missed.every(r => r.week >= 5),
    `only the LATE weeks should be out of reach, missed: ${missed.map(r => r.week).join(', ')}`);
});

test('a sloppy player still progresses, and is never locked out', () => {
  // No fail state means bad play must be slow, not stuck.
  const rows = simulate(2026, 'sloppy');
  assert.ok(rows[0].met, 'week 1 must be clearable by anyone — it is the tutorial');
  assert.ok(rows[7].money >= 0, 'money must never go negative');
  assert.ok(rows[7].recipes > rows[0].recipes, 'a sloppy player must still unlock things');
});

test('skill matters — a careful player outperforms a sloppy one', () => {
  const careful = simulate(2026, 'careful');
  const sloppy = simulate(2026, 'sloppy');
  assert.ok(careful.filter(r => r.met).length > sloppy.filter(r => r.met).length,
    'if both profiles score the same, the four beats are decorative');
});

test('the research tree opens up gradually, not all at once', () => {
  const rows = simulate(2026, 'careful');
  assert.ok(rows[0].purchased.length < rows[7].purchased.length,
    'research must continue through the game');
  assert.ok(rows[1].purchased.length < rows[7].purchased.length / 2,
    'the tree must not be bought out in the first two weeks');
});

test('discovery continues all game rather than finishing early', () => {
  // Before the content expansion every syrup was found by week 3, leaving
  // the bench — the main money sink — with nothing to do.
  const rows = simulate(2026, 'careful');
  assert.ok(rows[7].syrups > rows[2].syrups,
    `syrups must still be being found late: week 3 = ${rows[2].syrups}, week 8 = ${rows[7].syrups}`);
});

test('money does not pile up uselessly — the sinks must bite', () => {
  // The original economy ended with ~62,000 in the till and nothing to
  // spend it on, which made the escalating quota pressure without purpose.
  const rows = simulate(2026, 'careful');
  const finalMoney = rows[7].money;
  const finalWeekIncome = rows[7].earned;
  assert.ok(finalMoney < finalWeekIncome * 3,
    `the till should not hoard: ${finalMoney} banked against ${finalWeekIncome} weekly income`);
});

test('the bench is a real, sustained expense', () => {
  const rows = simulate(2026, 'careful');
  const totalBench = rows.reduce((a, r) => a + r.benchSpend, 0);
  const totalEarned = rows.reduce((a, r) => a + r.earned, 0);
  assert.ok(totalBench > totalEarned * 0.15,
    `research should consume a real share of profits: spent ${totalBench} of ${totalEarned}`);
  assert.ok(rows[7].benchSpend > 0, 'and it should still be running in the final week');
});

test('every recipe is profitable to cook', () => {
  // A dish that costs more to make than it sells for would quietly bleed
  // the player. Checked at the WORST payout multiplier, not the best.
  for (const r of RECIPES) {
    const cogs = r.ingredients.reduce((sum, id) => sum + priceOf(id) / TUNING.servingsPerUnit, 0);
    const worstRevenue = r.base * TUNING.payoutMinMultiplier;
    assert.ok(worstRevenue > cogs,
      `${r.id}: even a poor one sells for ${worstRevenue.toFixed(1)} but costs ${cogs.toFixed(1)}`);
  }
});

test('the quota curve is reachable in principle at every week', () => {
  const rows = simulate(2026, 'careful');
  for (const r of rows) {
    // Not "was met" — "was within reach of a better strategy".
    assert.ok(r.earned > quotaForWeek(r.week) * 0.6,
      `week ${r.week} quota ${r.quota} is far beyond any income (${r.earned}) — unreachable, not hard`);
  }
});
