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
import { TIER_ORDER, TIER_THRESHOLDS, TIER_EXPRESSION, TIER_POSE } from '../js/data/affection.js';

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
