import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, pick, randInt } from '../js/engine/rng.js';

test('same seed produces the same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = makeRng(1), b = makeRng(2);
  assert.notEqual(a(), b());
});

test('values stay in [0,1)', () => {
  const r = makeRng(7);
  for (let i = 0; i < 200; i++) {
    const v = r();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('randInt is inclusive of both bounds', () => {
  const r = makeRng(3);
  const seen = new Set();
  for (let i = 0; i < 500; i++) seen.add(randInt(r, 1, 3));
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test('pick returns an element of the array', () => {
  const r = makeRng(9);
  const arr = ['a', 'b', 'c'];
  for (let i = 0; i < 50; i++) assert.ok(arr.includes(pick(r, arr)));
});

test('pick on an empty array returns undefined', () => {
  assert.equal(pick(makeRng(1), []), undefined);
});
