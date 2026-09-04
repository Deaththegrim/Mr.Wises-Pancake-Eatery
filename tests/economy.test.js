import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quotaForWeek, qualityMultiplier, payoutFor, tipFor, reputationGain, repeatMultiplier, rollWeek } from '../js/engine/economy.js';
import { QUOTA_CURVE } from '../js/data/economy.js';
import { RECIPES } from '../js/data/recipes.js';

const plain = RECIPES.find(r => r.id === 'plain');

test('quota follows the curve and week 1 is trivial', () => {
  assert.equal(quotaForWeek(1), QUOTA_CURVE[0]);
  assert.equal(quotaForWeek(8), QUOTA_CURVE[7]);
  assert.ok(quotaForWeek(1) < quotaForWeek(2));
});

test('quota keeps escalating past the end of the curve', () => {
  const last = QUOTA_CURVE[QUOTA_CURVE.length - 1];
  assert.ok(quotaForWeek(9) > last, 'must not fall off the end');
});

test('quota rejects a non-positive week', () => {
  assert.throws(() => quotaForWeek(0));
});

test('quality multiplier spans the tuned range', () => {
  assert.ok(qualityMultiplier(0) < qualityMultiplier(100));
  assert.ok(qualityMultiplier(100) > 1);
});

test('better quality pays more', () => {
  assert.ok(payoutFor(plain, 100, 0) > payoutFor(plain, 30, 0));
});

test('repeating the same recipe pays less, with a floor', () => {
  const first = repeatMultiplier(0);
  const fifth = repeatMultiplier(4);
  const fiftieth = repeatMultiplier(49);
  assert.equal(first, 1);
  assert.ok(fifth < first, 'repeats must diminish');
  assert.ok(fiftieth >= 0.45, 'must never fall below the floor');
});

test('tips only appear above the threshold', () => {
  assert.equal(tipFor(100, 40), 0);
  assert.ok(tipFor(100, 95) > 0);
});

test('reputation gain is never negative, even for terrible work', () => {
  assert.ok(reputationGain(0) >= 0);
  assert.ok(reputationGain(100) > reputationGain(10));
});

test('rollWeek reports meeting the quota', () => {
  const state = { week: 1, weekEarnings: 500, reputation: 0 };
  const r = rollWeek(state);
  assert.equal(r.met, true);
  assert.equal(r.quota, QUOTA_CURVE[0]);
  assert.equal(r.week, 1);
});

test('rollWeek reports missing the quota without penalising anything', () => {
  const state = { week: 1, weekEarnings: 10, reputation: 25, money: 999 };
  const before = { ...state };
  const r = rollWeek(state);
  assert.equal(r.met, false);
  assert.equal(state.money, before.money, 'missing a quota must cost no money');
  assert.equal(state.reputation, before.reputation, 'missing a quota must cost no reputation');
  assert.equal(state.weekEarnings, before.weekEarnings, 'rollWeek must not mutate earnings');
});
