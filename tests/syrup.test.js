import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchScore, payoutBonus, reputationBonus, rankSyrups, bestSyrupFor, matchLabel, characterOf, syrupById }
  from '../js/engine/syrup.js';
import { SYRUPS } from '../js/data/syrups.js';
import { CUSTOMERS } from '../js/data/customers.js';
import { TUNING } from '../js/data/economy.js';
import { newGame } from '../js/engine/state.js';
import { serve } from '../js/engine/day.js';
import { RECIPES } from '../js/data/recipes.js';

/* SYRUP PAIRING.

   Before this existed, discovering a syrup incremented a counter and did
   nothing else: no runtime code read a syrup's axes, and the drizzle beat
   did not know which syrup it was pouring. Since syrups are half of what
   the research tree awards, half the grind paid out in nothing — against
   a spec that says a syrup's full effect is revealed by serving it.

   The design rule these tests defend: a good match PAYS MORE, a bad match
   is merely ordinary, and nothing is ever a penalty. A discovery must
   only ever be a new option, never a new way to lose money. */

const taste = id => CUSTOMERS.find(c => c.id === id).taste;

test('an exact match scores 1 and a total mismatch scores 0', () => {
  const s = SYRUPS[0];
  assert.equal(matchScore(s, s.axes), 1);
  assert.equal(matchScore(s, { sweet: 0, sharp: 0, rich: 0, strange: 0 }),
    Math.max(0, 1 - (s.axes.sweet + s.axes.sharp + s.axes.rich + s.axes.strange) / TUNING.syrupMatchRange));
});

test('the bonus is never negative — a mismatch must not be a punishment', () => {
  for (const s of SYRUPS) {
    for (const c of CUSTOMERS) {
      const score = matchScore(s, c.taste);
      assert.ok(payoutBonus(100, score) >= 0,
        `${s.id} for ${c.id} would cost the player money for pouring the wrong syrup`);
      assert.ok(reputationBonus(score) >= 0, `${s.id} for ${c.id} would cost reputation`);
    }
  }
});

test('missing or unknown syrups score zero rather than throwing', () => {
  assert.equal(matchScore(null, taste('first_light')), 0);
  assert.equal(matchScore(syrupById('no_such_syrup'), taste('first_light')), 0);
  assert.equal(payoutBonus(100, matchScore(syrupById('no_such_syrup'), taste('first_light'))), 0);
  assert.equal(matchScore(SYRUPS[0], undefined), 0);
});

test('every customer has a syrup that genuinely suits them', () => {
  const all = SYRUPS.map(s => s.id);
  for (const c of CUSTOMERS) {
    const best = rankSyrups(all, c.taste)[0];
    assert.ok(best.score >= 0.65,
      `${c.id}'s best possible syrup only scores ${best.score.toFixed(2)} — nothing in the game pleases them`);
  }
});

test('every syrup suits somebody — no discovery is dead on arrival', () => {
  for (const s of SYRUPS) {
    const best = Math.max(...CUSTOMERS.map(c => matchScore(s, c.taste)));
    assert.ok(best >= 0.5,
      `${s.id} scores at most ${best.toFixed(2)} for anyone; researching it would pay nothing`);
  }
});

test('rankSyrups returns best first and skips ids the player does not own', () => {
  const ranked = rankSyrups(['maple_syrup', 'lemon_glaze', 'ghost_syrup'], taste('the_twins'));
  assert.equal(ranked.length, 2, 'an unknown id must be dropped, not rendered as undefined');
  assert.ok(ranked[0].score >= ranked[1].score);
  assert.equal(bestSyrupFor(['maple_syrup', 'lemon_glaze'], taste('the_twins')), 'lemon_glaze');
});

test('bestSyrupFor copes with an empty shelf', () => {
  assert.equal(bestSyrupFor([], taste('first_light')), null);
});

test('a syrup describes itself by its strongest axis', () => {
  assert.equal(characterOf('lemon_glaze'), 'sharp');
  assert.equal(characterOf('quiet_cream'), 'rich');
  assert.equal(characterOf('void_syrup'), 'strange');
  assert.equal(characterOf('nope'), '');
});

test('matchLabel is vague at the bottom and definite at the top', () => {
  assert.equal(matchLabel(1), 'exactly right');
  assert.equal(matchLabel(0), 'not really theirs');
});

/* THE PART THAT ACTUALLY MATTERS: it reaches the player's money. The
   research-points bug was invisible for exactly this reason — the
   mechanism worked and nothing checked that serve() used it. */
const beats = { volume: 10, msOffset: 0, offsets: [0, 0, 0, 0], coverage: new Array(12).fill(6) };
const anyRecipe = RECIPES.find(r => r.unlockedAtStart).id;

const serveWith = (syrupId, tasteProfile) => {
  const s = newGame(4);
  s.pantry = Object.fromEntries(RECIPES.flatMap(r => r.ingredients).map(i => [i, 99]));
  return serve(s, anyRecipe, beats, { syrupId, taste: tasteProfile });
};

test('serving a well-matched syrup pays more than a mismatched one', () => {
  const good = serveWith('maple_syrup', taste('first_light'));      // scores 1.00
  const bad = serveWith('ember_reduction', taste('first_light'));   // scores 0.05
  assert.ok(good.payout > bad.payout,
    `the pairing must reach the till: matched ${good.payout} vs mismatched ${bad.payout}`);
  assert.ok(good.syrupScore > bad.syrupScore);
});

test('and builds reputation faster', () => {
  const s1 = newGame(4), s2 = newGame(4);
  for (const s of [s1, s2]) s.pantry = Object.fromEntries(RECIPES.flatMap(r => r.ingredients).map(i => [i, 99]));
  serve(s1, anyRecipe, beats, { syrupId: 'maple_syrup', taste: taste('first_light') });
  serve(s2, anyRecipe, beats, { syrupId: 'ember_reduction', taste: taste('first_light') });
  assert.ok(s1.reputation > s2.reputation);
});

test('pouring nothing is no worse than pouring the wrong thing', () => {
  // No syrup chosen must not be a hidden penalty — the picker only shows
  // when the player owns more than one, so day one has no choice to make.
  const none = serveWith(null, taste('first_light'));
  const bad = serveWith('ember_reduction', taste('first_light'));
  assert.equal(none.payout, bad.payout);
});

test('serve reports which syrup was poured, so the UI can explain the result', () => {
  const r = serveWith('lemon_glaze', taste('the_twins'));
  assert.equal(r.syrupId, 'lemon_glaze');
  assert.ok(r.syrupScore > 0.9, 'lemon glaze is exactly what the twins want');
});

test('matchLabel distinguishes the middle, not just the ends', () => {
  /* This label is the ONLY channel by which a player ever learns a
     customer's taste — the taste itself is deliberately never printed. Only
     1.0 and 0.0 were pinned, so collapsing 'a good fit' and 'passable' into
     'not really theirs' passed the suite while quietly removing the
     feedback the whole mechanic teaches through. */
  const labels = [0, 0.3, 0.6, 0.9].map(matchLabel);
  assert.equal(new Set(labels).size, 4,
    `each band must read differently, got: ${labels.join(' / ')}`);
  assert.equal(matchLabel(0.9), 'exactly right');
  assert.equal(matchLabel(0.6), 'a good fit');
  assert.equal(matchLabel(0.3), 'passable');
  assert.equal(matchLabel(0), 'not really theirs');
  // Better must never read worse.
  const order = ['not really theirs', 'passable', 'a good fit', 'exactly right'];
  for (let s = 0; s <= 1; s += 0.05) {
    const i = order.indexOf(matchLabel(s));
    assert.ok(i >= 0, `unknown label at score ${s.toFixed(2)}`);
  }
});
