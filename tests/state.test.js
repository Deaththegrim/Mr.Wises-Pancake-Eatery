import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, serialize, deserialize } from '../js/engine/state.js';
import { quotaForWeek } from '../js/engine/economy.js';

test('a new game starts playable', () => {
  const s = newGame(1);
  assert.equal(s.week, 1);
  assert.equal(s.day, 1);
  assert.ok(s.unlockedRecipes.length > 0, 'must start with something to cook');
  assert.ok(s.menu.length > 0, 'must start with something on the menu');
  assert.equal(s.synthia.points, 0);
});

test('serialize/deserialize round-trips', () => {
  const s = newGame(7);
  s.money = 123; s.reputation = 4.5; s.synthia.points = 11;
  const back = deserialize(serialize(s));
  assert.equal(back.ok, true);
  assert.equal(back.state.money, 123);
  assert.equal(back.state.reputation, 4.5);
  assert.equal(back.state.synthia.points, 11);
});

test('deserialize rejects malformed JSON without throwing', () => {
  const r = deserialize('{not json');
  assert.equal(r.ok, false);
  assert.match(r.reason, /read/i);
});

test('deserialize rejects null without throwing', () => {
  const r = deserialize('null');
  assert.equal(r.ok, false);
});

test('deserialize rejects a save from a future version', () => {
  const s = newGame(1);
  const bumped = JSON.parse(serialize(s));
  bumped.version = 999;
  const r = deserialize(JSON.stringify(bumped));
  assert.equal(r.ok, false);
  assert.match(r.reason, /version/i);
});

test('deserialize drops unknown recipe ids instead of stranding the player', () => {
  const s = newGame(1);
  const obj = JSON.parse(serialize(s));
  obj.unlockedRecipes.push('recipe_that_no_longer_exists');
  obj.menu.push('recipe_that_no_longer_exists');
  const r = deserialize(JSON.stringify(obj));
  assert.equal(r.ok, true, 'a stale id must not break the save');
  assert.ok(!r.state.unlockedRecipes.includes('recipe_that_no_longer_exists'));
  assert.ok(!r.state.menu.includes('recipe_that_no_longer_exists'));
});

test('deserialize guarantees a non-empty menu even if the save had none', () => {
  const s = newGame(1);
  const obj = JSON.parse(serialize(s));
  obj.menu = [];
  const r = deserialize(JSON.stringify(obj));
  assert.equal(r.ok, true);
  assert.ok(r.state.menu.length > 0, 'the player must never be stranded with nothing to sell');
});

test('deserialize recovers when every unlocked recipe has been deleted', () => {
  const s = newGame(1);
  const obj = JSON.parse(serialize(s));
  obj.unlockedRecipes = ['gone_a', 'gone_b'];
  obj.menu = ['gone_a'];
  const r = deserialize(JSON.stringify(obj));
  assert.equal(r.ok, true);
  assert.ok(r.state.unlockedRecipes.length > 0, 'must fall back to the starting recipes');
  assert.ok(r.state.menu.length > 0);
});

test('deserialize repairs a missing synthia block', () => {
  const s = newGame(1);
  const obj = JSON.parse(serialize(s));
  delete obj.synthia;
  const r = deserialize(JSON.stringify(obj));
  assert.equal(r.ok, true);
  assert.equal(r.state.synthia.points, 0);
  assert.deepEqual(r.state.synthia.mentions, []);
});

test('deserialize repairs a partial synthia block without losing progress', () => {
  const s = newGame(1);
  const obj = JSON.parse(serialize(s));
  obj.synthia = { points: 40 };            // hand-edited or from an older build
  const r = deserialize(JSON.stringify(obj));
  assert.equal(r.ok, true);
  assert.equal(r.state.synthia.points, 40, 'must keep what was there');
  assert.deepEqual(r.state.synthia.mentions, [], 'and fill in what was not');
  assert.ok(Array.isArray(r.state.synthia.log));
});

/* ROBUSTNESS: deserialize promises never to strand the player.

   These are not hypothetical. The state object is reachable from the page
   console, saves are plain JSON in localStorage, and JSON round-trips
   stringify numbers when written by hand. Each of these inputs used to pass
   deserialize and then throw on the first render — which presents to the
   player as a Continue button that does nothing, forever, with their save
   still sitting there. */
test('a hand-edited save with a stringified week still loads', () => {
  const { ok, state: s } = deserialize(JSON.stringify({ ...newGame(), week: '3', money: '120.5' }));
  assert.ok(ok, 'a repairable save must load, not be rejected');
  assert.equal(s.week, 3);
  assert.equal(typeof s.week, 'number');
  assert.equal(s.money, 120.5);
});

test('a save with week 0 is repaired, not accepted', () => {
  // quotaForWeek() is strict about its range; week 0 threw on render.
  const { state: s } = deserialize(JSON.stringify({ ...newGame(), week: 0 }));
  assert.ok(s.week >= 1, `week must be playable, got ${s.week}`);
  assert.doesNotThrow(() => quotaForWeek(s.week));
});

test('a save with a fractional or absurd day is clamped into the week', () => {
  const { state: s } = deserialize(JSON.stringify({ ...newGame(), day: 99 }));
  assert.ok(s.day >= 1 && s.day <= 7, `day must be within the week, got ${s.day}`);
  const { state: f } = deserialize(JSON.stringify({ ...newGame(), day: 2.7 }));
  assert.equal(f.day, 3);
});

test('garbage numerics fall back rather than poisoning the state with NaN', () => {
  const { state: s } = deserialize(JSON.stringify({
    ...newGame(), money: 'lots', reputation: null, points: undefined, week: 'week two',
  }));
  for (const k of ['money', 'reputation', 'points', 'week']) {
    assert.ok(Number.isFinite(s[k]), `${k} is ${s[k]} — NaN spreads through every later sum`);
  }
});

test('negative money cannot be smuggled in through a save', () => {
  const { state: s } = deserialize(JSON.stringify({ ...newGame(), money: -5000 }));
  assert.ok(s.money >= 0, 'a negative till breaks every affordability check');
});

test('a dish removed from the content is dropped from her memory too', () => {
  /* Every other id list in the save is pruned against real content;
     synthia's three were not. A deleted recipe would sit in `wanted`
     forever, matching no research node and marking nothing on the board,
     and in `mentions` where she could never be served it. */
  const g = newGame(1);
  g.synthia.wanted = ['souffle', 'deleted_dish'];
  g.synthia.mentions = ['souffle', 'gone_forever'];
  g.synthia.noticed = ['souffle', 'also_gone'];

  const { state } = deserialize(JSON.stringify(g));
  assert.deepEqual(state.synthia.wanted, ['souffle']);
  assert.deepEqual(state.synthia.mentions, ['souffle']);
  assert.deepEqual(state.synthia.noticed, ['souffle']);
});

test('and a save with none of those lists still loads', () => {
  const g = newGame(1);
  delete g.synthia.wanted;
  delete g.synthia.mentions;
  const { ok, state } = deserialize(JSON.stringify(g));
  assert.ok(ok);
  assert.deepEqual(state.synthia.wanted, []);
  assert.deepEqual(state.synthia.mentions, []);
});
