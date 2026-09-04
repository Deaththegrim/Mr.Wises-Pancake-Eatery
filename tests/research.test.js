import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateMet, isAvailable, availableNodes, purchase, blendAxes, axisDistance, hintFor, experiment } from '../js/engine/research.js';
import { RESEARCH } from '../js/data/research.js';
import { SYRUPS } from '../js/data/syrups.js';
import { INGREDIENTS } from '../js/data/ingredients.js';

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

test('a failed purchase spends nothing', () => {
  const s = baseState();
  s.points = 0;
  s.cooked.plain = 5;
  purchase(s, 'r_buttermilk');
  assert.equal(s.points, 0);
  assert.deepEqual(s.purchased, []);
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

test('a blend inside tolerance discovers the syrup', () => {
  const s = baseState();
  const glaze = SYRUPS.find(x => x.id === 'lemon_glaze');
  const blend = blendAxes(['lemon', 'maple']);
  const dist = axisDistance(blend, glaze.discover.target);
  const r = experiment(s, ['lemon', 'maple']);
  if (dist <= glaze.discover.tolerance) {
    assert.equal(r.found, true);
    assert.equal(r.syrupId, 'lemon_glaze');
    assert.ok(s.unlockedSyrups.includes('lemon_glaze'));
  } else {
    assert.equal(r.found, false);
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
  const hint = hintFor({ sweet: 0, sharp: 10, rich: 0, strange: 0 },
                       { sweet: 8, sharp: 0, rich: 0, strange: 0 });
  assert.match(hint, /sharp/i);
});

test('the hint distinguishes too much from too little', () => {
  const tooSweet = hintFor({ sweet: 10, sharp: 0, rich: 0, strange: 0 }, { sweet: 0, sharp: 0, rich: 0, strange: 0 });
  const notSweet = hintFor({ sweet: 0, sharp: 0, rich: 0, strange: 0 }, { sweet: 10, sharp: 0, rich: 0, strange: 0 });
  assert.notEqual(tooSweet, notSweet);
});

test('every discoverable syrup is actually reachable from real ingredients', () => {
  // Guards against authoring a target that no combination can ever hit —
  // the content bug that would make a syrup permanently undiscoverable.
  const ids = INGREDIENTS.map(i => i.id);
  const combos = [];
  for (let a = 0; a < ids.length; a++) {
    for (let b = a; b < ids.length; b++) {
      combos.push([ids[a], ids[b]]);
      for (let c = b; c < ids.length; c++) combos.push([ids[a], ids[b], ids[c]]);
    }
  }
  for (const syrup of SYRUPS.filter(s => s.discover)) {
    const hit = combos.find(combo =>
      axisDistance(blendAxes(combo), syrup.discover.target) <= syrup.discover.tolerance);
    assert.ok(hit, `syrup "${syrup.id}" cannot be discovered from any 2 or 3 ingredient combination`);
  }
});

test('rediscovering an already-known syrup is not reported as new', () => {
  const s = baseState();
  for (const syrup of SYRUPS.filter(x => x.discover)) s.unlockedSyrups.push(syrup.id);
  const r = experiment(s, ['lemon', 'maple']);
  assert.equal(r.found, false, 'nothing left to find - should fall through to a hint');
  assert.ok(r.hint.length > 0);
});
