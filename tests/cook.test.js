import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePour, scoreFlip, scoreStack, scoreDrizzle, scoreDish, effectsFor } from '../js/engine/cook.js';
import { RECIPES } from '../js/data/recipes.js';

test('pour inside the band is perfect', () => {
  assert.equal(scorePour(50, 50, 10), 100);
  assert.equal(scorePour(58, 50, 10), 100);
});

test('pour degrades outside the band and never goes negative', () => {
  const near = scorePour(65, 50, 10);
  const far = scorePour(120, 50, 10);
  assert.ok(near > 0 && near < 100, `near should be partial, got ${near}`);
  assert.ok(far >= 0, 'score must never be negative');
  assert.ok(near > far, 'closer pours must score higher');
});

test('flip window is symmetric and forgiving', () => {
  assert.equal(scoreFlip(0, 500), 100);
  assert.equal(scoreFlip(400, 500), 100);
  assert.equal(scoreFlip(-400, 500), 100);
  assert.equal(scoreFlip(700, 500), scoreFlip(-700, 500));
});

test('flip falls off gradually, not off a cliff', () => {
  const justOut = scoreFlip(600, 500);
  assert.ok(justOut > 80, `just outside the window should still be decent, got ${justOut}`);
});

test('stack error compounds - an early offset costs more than a late one', () => {
  const early = scoreStack([10, 0, 0, 0]);
  const late  = scoreStack([0, 0, 0, 10]);
  assert.ok(early < late, `early offset (${early}) must cost more than late (${late})`);
});

test('a perfectly centred stack scores 100', () => {
  assert.equal(scoreStack([0, 0, 0]), 100);
});

test('drizzle rewards even coverage', () => {
  const even   = scoreDrizzle([0.7, 0.7, 0.7, 0.7, 0.7, 0.7]);
  const patchy = scoreDrizzle([1.0, 0.0, 1.0, 0.0, 1.0, 0.0]);
  assert.ok(even > patchy, `even (${even}) must beat patchy (${patchy})`);
  assert.ok(even > 85);
});

test('drizzle punishes bare edges and pooling', () => {
  const bare   = scoreDrizzle([0.7, 0.7, 0.0, 0.0, 0.7, 0.7]);
  const pooled = scoreDrizzle([1.0, 1.0, 1.0, 0.7, 0.7, 0.7]);
  assert.ok(bare < 100 && pooled < 100);
});

test('all scores clamp to 0..100', () => {
  for (const v of [scorePour(9999, 50, 10), scoreFlip(99999, 500), scoreStack([500, 500, 500]), scoreDrizzle([0, 0, 0])]) {
    assert.ok(v >= 0 && v <= 100, `out of range: ${v}`);
  }
});

test('per-recipe weights change the quality for identical execution', () => {
  const souffle = RECIPES.find(r => r.id === 'souffle');
  const impossible = RECIPES.find(r => r.id === 'impossible');
  // Bad flip, perfect everything else.
  const s = scoreDish(souffle, {
    volume: souffle.pour.target, msOffset: 5000,
    offsets: new Array(souffle.stackCount).fill(0),
    coverage: [0.7, 0.7, 0.7, 0.7]
  }, []);
  const i = scoreDish(impossible, {
    volume: impossible.pour.target, msOffset: 5000,
    offsets: new Array(impossible.stackCount).fill(0),
    coverage: [0.7, 0.7, 0.7, 0.7]
  }, []);
  assert.ok(s.quality < i.quality, 'a blown flip must hurt the souffle more (flip weight 3 vs 1.5)');
});

test('breakdown reports all four beats', () => {
  const r = RECIPES.find(x => x.id === 'plain');
  const out = scoreDish(r, { volume: 50, msOffset: 0, offsets: [0, 0, 0], coverage: [0.7, 0.7, 0.7] }, []);
  assert.deepEqual(Object.keys(out.breakdown).sort(), ['drizzle', 'flip', 'pour', 'stack']);
  assert.equal(out.quality, 100);
});

test('upgrades widen tolerances rather than adding power', () => {
  const e = effectsFor(['pour_band_bonus', 'flip_window_bonus']);
  assert.equal(e.pourBandPlus, 4);
  assert.equal(e.flipWindowPlus, 150);
  const r = RECIPES.find(x => x.id === 'plain');
  const beats = { volume: 62, msOffset: 600, offsets: [0, 0, 0], coverage: [0.7, 0.7, 0.7] };
  const without = scoreDish(r, beats, []).quality;
  const withUp  = scoreDish(r, beats, ['pour_band_bonus', 'flip_window_bonus']).quality;
  assert.ok(withUp > without, `upgrades must improve a marginal execution (${without} -> ${withUp})`);
});

test('effectsFor ignores unknown upgrade ids', () => {
  const e = effectsFor(['nonsense']);
  assert.equal(e.pourBandPlus, 0);
  assert.equal(e.stackDriftScale, 1);
});

test('stack forgiveness upgrade reduces the cost of drift', () => {
  const offsets = [8, 4, 2];
  assert.ok(scoreStack(offsets, 0.7) > scoreStack(offsets, 1));
});
