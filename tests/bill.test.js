import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billFor, priceOf, payoutFor, qualityMultiplier } from '../js/engine/economy.js';
import { RECIPES } from '../js/data/recipes.js';
import { INGREDIENTS } from '../js/data/ingredients.js';
import { SYRUPS } from '../js/data/syrups.js';
import { CUSTOMERS } from '../js/data/customers.js';
import { matchScore } from '../js/engine/syrup.js';
import { TUNING } from '../js/data/economy.js';

/* THE BILL.

   A dish is priced from its parts the way a shop bills: so many pancakes
   at the going rate, a line for each thing that went into them, a line for
   the syrup, a line for the skill. The receipt the player reads and the
   money the till takes come from this one call, so they cannot disagree —
   which is the whole reason it returns both. */

const recipe = id => RECIPES.find(r => r.id === id);
const sell = id => INGREDIENTS.find(i => i.id === id).sell;

test('the bill charges for the pancakes in the stack', () => {
  const r = recipe('plain');
  const line = billFor(r).lines[0];
  assert.match(line.label, /pancakes?$/);
  assert.equal(line.amount, r.stackCount * TUNING.pricePerPancake);
});

test('and for each ingredient except the flour, which IS the pancake', () => {
  const r = recipe('buttermilk_stack');   // flour + buttermilk + butter
  const labels = billFor(r).lines.map(l => l.label);
  assert.ok(!labels.includes('Flour'),
    'flour is billed as the pancakes; charging for it again double-bills every dish');
  assert.ok(labels.includes('Buttermilk'));
  assert.ok(labels.includes('Butter'));
});

test('the parts add up to the price — no hidden number', () => {
  for (const r of RECIPES) {
    const parts = r.stackCount * TUNING.pricePerPancake
      + r.ingredients.filter(i => i !== TUNING.baseIngredient).reduce((a, i) => a + sell(i), 0)
      + (r.craft > 0 ? r.craft : 0);
    assert.equal(priceOf(r), parts, `${r.id}'s bill does not equal its parts`);
  }
});

test('craft is what a bill of materials cannot express', () => {
  /* A Souffle is two pancakes and cheap ingredients and sells for 45
     because it is hard. Priced purely by parts, the most difficult dish
     in the game would be one of the cheapest — cheaper than a Plain
     Stack's five-pancake cousin. */
  const souffle = recipe('souffle');
  const parts = souffle.stackCount * TUNING.pricePerPancake
    + souffle.ingredients.filter(i => i !== TUNING.baseIngredient).reduce((a, i) => a + sell(i), 0);
  assert.ok(souffle.craft > parts,
    'the souffle must be worth more for its difficulty than for its contents');
  assert.ok(priceOf(souffle) > priceOf(recipe('blueberry_pile')),
    'and must still out-earn a bigger, easier stack');
});

test('a better-made dish bills for more', () => {
  const r = recipe('plain');
  assert.ok(billFor(r, { quality: 100 }).total > billFor(r, { quality: 40 }).total);
});

test('quality and repetition show as adjustments, not as items sold', () => {
  const r = recipe('plain');
  const bill = billFor(r, { quality: 100, repeatCount: 2 });
  const items = bill.lines.filter(l => !l.adjustment);
  const adjustments = bill.lines.filter(l => l.adjustment);
  assert.equal(bill.subtotal, items.reduce((a, l) => a + l.amount, 0),
    'the subtotal is the things sold, before anything is adjusted');
  assert.ok(adjustments.some(l => /today/.test(l.label)), 'the repeat must be visible, not silent');
  assert.ok(adjustments.some(l => l.amount < 0), 'and it must cost something');
});

test('the third of a dish today bills less than the first', () => {
  const r = recipe('plain');
  assert.ok(billFor(r, { repeatCount: 2 }).total < billFor(r, { repeatCount: 0 }).total);
});

test('a matched syrup adds a line naming its verdict', () => {
  const r = recipe('plain');
  const syrup = SYRUPS.find(s => s.id === 'maple_syrup');
  const bill = billFor(r, { syrup, syrupScore: 1 });
  const line = bill.lines.find(l => l.label.startsWith('Maple Syrup'));
  assert.ok(line, 'the syrup must appear on the bill');
  assert.match(line.label, /exactly right/,
    'and carry its verdict — the bill is the only place the player learns a taste');
  assert.ok(line.amount > 0);
});

test('a mismatched syrup is free, never a charge against the shop', () => {
  const r = recipe('plain');
  const syrup = SYRUPS.find(s => s.id === 'maple_syrup');
  const bill = billFor(r, { syrup, syrupScore: 0 });
  const line = bill.lines.find(l => l.label.startsWith('Maple Syrup'));
  assert.equal(line.amount, 0, 'pouring the wrong syrup must not cost the player money');
  assert.equal(bill.total, billFor(r).total);
});

test('payoutFor and the bill total are the same number', () => {
  // They are the same call. If these ever diverge, the receipt is lying.
  for (const r of RECIPES) {
    for (const q of [30, 70, 100]) {
      assert.equal(payoutFor(r, q, 1), billFor(r, { quality: q, repeatCount: 1 }).total);
    }
  }
});

test('every dish is worth more than the flour it is made of', () => {
  for (const r of RECIPES) {
    assert.ok(priceOf(r) > r.stackCount * TUNING.pricePerPancake * 0.9,
      `${r.id} bills less than its own pancakes`);
  }
});

test('no syrup, on any dish, for any customer, can ever cost the player money', () => {
  /* THE INVARIANT, asserted through the REAL billing path over every
     recipe x syrup x customer combination — 891 of them.

     It used to be checked against a `payoutMultiplier()` helper that the
     game did not call: billFor() applied its own copy of the rule. So the
     test guarded a function nobody ran, which is the precise shape of the
     bug that made the shipped game unwinnable for a week. */
  let worst = Infinity, worstCase = '';
  for (const r of RECIPES) {
    const plain = billFor(r, { quality: 80 }).total;
    for (const syrup of SYRUPS) {
      for (const c of CUSTOMERS) {
        const withSyrup = billFor(r, { quality: 80, syrup, syrupScore: matchScore(syrup, c.taste) }).total;
        if (withSyrup - plain < worst) {
          worst = withSyrup - plain;
          worstCase = `${r.id} + ${syrup.id} for ${c.id}`;
        }
      }
    }
  }
  assert.ok(worst >= 0,
    `pouring a syrup must never reduce the bill; worst case was ${worstCase} at ${worst}`);
});

test('the printed lines add up to the printed total — every bill, always', () => {
  /* The receipt is itemised, so a player can add it up by eye, and one in
     eight bills did not add up. `total` was rounded once from unrounded
     floats while each adjustment line was rounded on its own, and the
     residues did not cancel. The money was right; the visible arithmetic
     was wrong, against this module's own promise that the receipt and the
     till "can never disagree".

     The old tests could not see it: one asserted subtotal against the
     non-adjustment lines only, and the other compared the total to itself. */
  let checked = 0;
  for (const r of RECIPES) {
    for (let quality = 0; quality <= 100; quality += 10) {
      for (const repeatCount of [0, 1, 2, 3, 8]) {
        for (const syrup of [null, SYRUPS[0], SYRUPS[4]]) {
          for (const score of [0, 0.37, 1]) {
            const bill = billFor(r, { quality, repeatCount, syrup, syrupScore: score });
            const sum = bill.lines.reduce((a, l) => a + l.amount, 0);
            assert.equal(sum, bill.total,
              `${r.id} at ${quality}% x${repeatCount + 1}${syrup ? ' + ' + syrup.id : ''}: ` +
              `lines add to ${sum} but the total row says ${bill.total}`);
            checked += 1;
          }
        }
      }
    }
  }
  assert.ok(checked > 1000, `expected a broad sweep, only checked ${checked}`);
});
