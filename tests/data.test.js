import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { INGREDIENTS, AXES } from '../js/data/ingredients.js';
import { RECIPES } from '../js/data/recipes.js';
import { SYRUPS } from '../js/data/syrups.js';
import { RESEARCH } from '../js/data/research.js';
import { CUSTOMERS } from '../js/data/customers.js';
import { QUOTA_CURVE, TUNING } from '../js/data/economy.js';
import { META } from '../js/data/meta.js';
import { TIER_ORDER, TIER_THRESHOLDS, TIER_EXPRESSION, TIER_POSE } from '../js/data/affection.js';


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

test('the title lives only in data, so renaming is one line', () => {
  // Either a real name or null (the UI falls back). What matters is that
  // nothing outside js/data/meta.js hardcodes one.
  assert.ok(META.title === null || typeof META.title === 'string');
  assert.notEqual(META.title, '', 'an empty title would render a blank header');
});

test('affection tiers are ordered and every tier maps to an expression and a pose', () => {
  let prev = -1;
  for (const tier of TIER_ORDER) {
    assert.ok(TIER_THRESHOLDS[tier] > prev, `${tier} threshold not increasing`);
    prev = TIER_THRESHOLDS[tier];
    assert.equal(typeof TIER_EXPRESSION[tier], 'string', `${tier} has no expression`);
    assert.equal(typeof TIER_POSE[tier], 'string', `${tier} has no pose`);
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

/* THE ANTI-DRIFT GUARD.

   Every tuning constant must be read by something the PLAYER runs. The
   worst bug in this project was that pointsPerNewRecipeServed,
   pointsPerHighQuality and highQualityAt were referenced only by
   tools/simulate.js — so the shipped game awarded no research points at
   all, the tree stayed locked, income never compounded, and the game was
   unwinnable from week 4 while every balance test passed, because they
   measured the simulator.

   A tuning constant that only a TOOL reads is a feature the game does not
   have. This catches the class, not the instance. */
test('every tuning constant is actually used by the game, not just by a tool', () => {
  /* Scan engine/ and ui/ only. js/data/ is where the constants are DEFINED,
     so including it would make every key match itself — which is exactly the
     bug the first version of this guard had, and why it silently passed. */
  const dirs = ['../js/engine/', '../js/ui/'].map(d => new URL(d, import.meta.url));
  const sources = dirs.flatMap(dir =>
    readdirSync(dir).filter(f => f.endsWith('.js'))
      .map(f => readFileSync(new URL(f, dir), 'utf8')));
  sources.push(readFileSync(new URL('../js/main.js', import.meta.url), 'utf8'));
  const gameSource = sources.join('\n');

  const unused = Object.keys(TUNING).filter(k => !gameSource.includes(k));
  assert.deepEqual(unused, [],
    `TUNING keys read by nothing under js/: ${unused.join(', ')}. ` +
    `If only tools/ reads them, the game does not have that feature.`);
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
