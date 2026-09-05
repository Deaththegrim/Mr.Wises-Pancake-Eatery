import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulate } from '../tools/simulate.js';
import { quotaForWeek } from '../js/engine/economy.js';
import { RECIPES } from '../js/data/recipes.js';
import { unitPriceOf } from '../js/engine/pantry.js';
import { priceOf } from '../js/engine/economy.js';
import { TUNING } from '../js/data/economy.js';
import { DECOR } from '../js/data/decor.js';
import { SYRUPS } from '../js/data/syrups.js';
import { RESEARCH } from '../js/data/research.js';

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

test('the research tree lasts most of the game', () => {
  /* The property that matters is that the tree is still giving the player
     something to aim at deep into the run — not an arbitrary fraction by
     week 2. (It previously asserted week2 < final/2, which encoded nothing
     real: early nodes are deliberately cheap so a cozy game gives quick
     wins, and the shape that matters is the long tail after them.) */
  const rows = simulate(2026, 'careful');
  const total = rows[7].purchased.length;

  assert.ok(rows[0].purchased.length < total, 'research must continue past week 1');
  assert.ok(rows[3].purchased.length < total,
    'the tree must not be complete by the halfway point');
  assert.ok(rows[5].purchased.length > rows[2].purchased.length,
    'and must still be growing in the second half');
});

test('a sloppy player unlocks materially less of the tree than a careful one', () => {
  // Research is the main progression lever, so it has to reward playing well.
  const careful = simulate(2026, 'careful');
  const sloppy = simulate(2026, 'sloppy');
  const c = careful[7].purchased.length, s = sloppy[7].purchased.length;
  assert.ok(c > s * 1.4, `careful ${c}/13 vs sloppy ${s}/13 — skill must matter to progression`);
});

test('cooking is a real source of research points, not just the bench', () => {
  /* THE REGRESSION GUARD FOR THE WORST BUG IN THIS PROJECT. serve() used to
     award no points at all; the awards lived only in tools/simulate.js. The
     tree costs ~1,130 points and the bench pays ~230 over eight weeks, so
     the shipped game was unwinnable from week 4 while every balance test
     passed — because they measured the simulator, which paid itself. */
  const rows = simulate(2026, 'careful');
  const totalBench = rows.reduce((a, r) => a + r.benchSpend, 0);
  assert.ok(rows[7].purchased.length >= 10,
    `a careful player must get most of the tree (got ${rows[7].purchased.length}/13); ` +
    `if this drops to ~4, cooking has stopped awarding points again`);
  assert.ok(totalBench > 0, 'and the bench should still be a real expense');
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
    const cogs = r.ingredients.reduce((sum, id) => sum + unitPriceOf(id) / TUNING.servingsPerUnit, 0);
    const worstRevenue = priceOf(r) * TUNING.payoutMinMultiplier;
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

/* THE ARC IS REACHABLE BY PLAYING, NOT JUST IN PRINCIPLE.

   tests/affection.test.js proves DEVOTED is reachable by calling
   checkListening() directly. That is the same mistake as every other bug
   in this project: the MECHANISM was tested and the PATH to it was not.
   She used to order whatever was priciest on the menu, so a player who
   heard her mention a dish, spent weeks researching it and put it out had
   no way to actually serve it to her — the payoff landed only if the RNG
   happened to pick it. DEVOTED came up on 2 of 10 seeds. */
test('an attentive player reaches DEVOTED by playing', () => {
  const tiers = [];
  for (let seed = 2001; seed <= 2010; seed++) tiers.push(simulate(seed, 'careful')[7].tier);
  const devoted = tiers.filter(t => t === 'DEVOTED').length;
  assert.ok(devoted >= 7,
    `the full arc must be a reward for attention, not a lottery: ${devoted}/10 seeds reached DEVOTED (${tiers.join(', ')})`);
});

test('and listening is what gets them there — not just cooking well', () => {
  /* The 'deaf' profile cooks EXACTLY as well as 'careful' but keeps
     anything she mentioned off the menu. If these two ever converge, the
     listening beat has stopped mattering and the arc has quietly become a
     function of execution again. */
  const tier = s => simulate(s, 'careful')[7].affection;
  const deaf = s => simulate(s, 'deaf')[7].affection;
  let attentive = 0, inattentive = 0;
  for (let seed = 2001; seed <= 2010; seed++) { attentive += tier(seed); inattentive += deaf(seed); }
  assert.ok(attentive > inattentive * 1.4,
    `hearing her must be worth substantially more than cooking alone: ` +
    `attentive ${(attentive / 10).toFixed(1)} vs deaf ${(inattentive / 10).toFixed(1)} affection`);

  const deafTiers = [];
  for (let seed = 2001; seed <= 2010; seed++) deafTiers.push(simulate(seed, 'deaf')[7].tier);
  assert.ok(!deafTiers.includes('DEVOTED'),
    `a player who ignores what she says must NOT reach her closest tier (${deafTiers.join(', ')})`);
});

test('the quota curve is tuned for a player who is NOT told what customers like', () => {
  /* `careful` picks its syrup with bestSyrupFor() — an oracle for a taste
     the UI deliberately never prints, since the whole point is that you
     learn it by serving people. Calibrating the curve against that alone
     tunes the game for information no first-time player has.

     `shelf` cooks exactly as well but pours whatever the picker preselects,
     which is what actually happens until the player has learned a
     customer. The early weeks must still be comfortable for them. */
  const rows = simulate(2026, 'shelf');
  for (const r of rows.slice(0, 4)) {
    assert.ok(r.met, `week ${r.week} must be clearable without knowing anyone's taste (${r.earned}/${r.quota})`);
  }
  assert.ok(rows.filter(r => r.met).length >= 4,
    'a player who never guesses a syrup right should still clear half the game');
  assert.equal(rows[7].tier, 'DEVOTED',
    'and the relationship must not depend on syrup knowledge — that is what listening is for');
});

test('knowing a customer is worth something, but is not the difference', () => {
  const shelf = simulate(2026, 'shelf').filter(r => r.met).length;
  const careful = simulate(2026, 'careful').filter(r => r.met).length;
  assert.ok(careful >= shelf, 'learning tastes must never make you worse off');
  assert.ok(careful - shelf <= 3,
    `syrup knowledge should be an edge, not the game: ${careful}/8 against ${shelf}/8`);
});

test('the till has somewhere to go once the research tree is done', () => {
  /* THE ENDGAME HOLE THIS CLOSES. A careful player finished the tree
     before the last weeks, and from there the till simply climbed — about
     21,000 banked by the end, against a game whose whole escalating quota
     is supposed to mean something. The last two weeks had no economic
     decision left in them at all.

     Decoration is the sink. It is cosmetic on purpose (spec §14.5): the
     point is a self-authored goal, not a stat. */
  const rows = simulate(2026, 'careful');
  const last = rows[7];
  assert.ok(last.decor > 0, 'a careful player must find something to spend on');
  assert.ok(last.money < last.earned,
    `the till should not end the game holding more than a week's takings: ${last.money} banked against ${last.earned}`);
});

test('and the shop is not cleared in a single run', () => {
  // If everything is bought before the last week, the money starts piling
  // up again and the sink stops sinking exactly when it is needed.
  const rows = simulate(2026, 'careful');
  assert.ok(rows[7].decor < DECOR.length,
    `a single careful run bought all ${DECOR.length} decorations; the shop needs more in it`);
});

test('decoration is never the reason a quota is met', () => {
  /* It must not become an economic lever by the back door: a run that
     spends on the shop and one that does not must earn identically.

     This test used to describe that comparison and then run one
     simulation and check it cleared four weeks — which would have passed
     just as well if decoration paid a reputation dividend. The invariant
     named in the title was not tested at all.

     It is not an idle invariant either. payForCooking hands out free
     ingredients when the player is broke, and the bench abandons the
     evening the moment a buy fails; both trigger on money, so spending
     too much on the shop WOULD move earnings. */
  for (const profile of ['careful', 'shelf', 'sloppy']) {
    for (const seed of [2026, 4007, 4013]) {
      const withShop = simulate(seed, profile);
      const without = simulate(seed, profile, { noDecor: true });
      assert.deepEqual(
        withShop.map(r => [r.week, r.earned, r.met, r.points]),
        without.map(r => [r.week, r.earned, r.met, r.points]),
        `${profile} @ ${seed}: buying for the shop changed what the game paid`);
      /* The only thing it may change is how much is left in the till —
         and only for a player who could afford anything at all. A sloppy
         run never has the spare money to buy a single thing, so the two
         runs are identical down to the last coin, which is itself worth
         asserting: the shop must not quietly hand out what is not paid for. */
      const bought = withShop.at(-1).decor;
      if (bought > 0) {
        assert.ok(withShop.at(-1).money < without.at(-1).money,
          `${profile} @ ${seed} bought ${bought} things and ended no poorer for it`);
      } else {
        assert.equal(withShop.at(-1).money, without.at(-1).money,
          `${profile} @ ${seed} bought nothing, so the till must be untouched`);
      }
    }
  }
});

test('everything in the shop is affordable to someone who wants it', () => {
  /* The shop deliberately costs more than one run can clear, so the
     cheapest-first simulator never reaches the dearest item — that is the
     design, not a defect. But "not bought by this strategy" and "cannot be
     bought at all" look identical from the outside, and one of them is
     dead content. This separates them: a player who saves instead of
     buying the cheap things must be able to afford the most expensive one.

     Same question that found the unreachable ending — not "does the code
     handle this value" but "can the game actually produce it". */
  const dearest = DECOR.reduce((a, b) => (b.cost > a.cost ? b : a));
  let affordable = 0;
  for (let seed = 7001; seed <= 7010; seed++) {
    const peak = Math.max(...simulate(seed, 'careful', { noDecor: true }).map(r => r.money));
    if (peak >= dearest.cost) affordable += 1;
  }
  assert.ok(affordable >= 8,
    `"${dearest.name}" costs ${dearest.cost} and a saving player could afford it in only ` +
    `${affordable}/10 runs — it is priced out of the game rather than expensive`);
});

test('every recipe, syrup and research node is reached by ordinary play', () => {
  /* Content nobody ever sees is content nobody should have written. The
     validator proves each is reachable in principle — a research node
     unlocks it, a customer wants its tag — and this proves the game
     actually gets there. */
  const seen = { recipes: new Set(), syrups: new Set(), research: new Set() };
  for (let seed = 6001; seed <= 6010; seed++) {
    for (const profile of ['careful', 'shelf', 'sloppy']) {
      const s = simulate(seed, profile).state;
      s.unlockedRecipes.forEach(x => seen.recipes.add(x));
      s.unlockedSyrups.forEach(x => seen.syrups.add(x));
      s.purchased.forEach(x => seen.research.add(x));
    }
  }
  const missing = (all, got) => all.filter(x => !got.has(x.id)).map(x => x.id);
  assert.deepEqual(missing(RECIPES, seen.recipes), [], 'recipes never unlocked in any run');
  assert.deepEqual(missing(SYRUPS, seen.syrups), [], 'syrups never discovered in any run');
  assert.deepEqual(missing(RESEARCH, seen.research), [], 'research nodes never bought in any run');
});
