import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, serialize, deserialize } from '../js/engine/state.js';

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
