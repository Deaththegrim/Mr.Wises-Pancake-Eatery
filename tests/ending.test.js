import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDay, closeDay, isFinalWeek } from '../js/engine/day.js';
import { endingFor, missSceneFor, endingTitleFor } from '../js/engine/story.js';
import { newGame } from '../js/engine/state.js';
import { SCENES } from '../js/data/scenes.js';
import { TIER_ORDER, TIER_THRESHOLDS } from '../js/data/affection.js';
import { QUOTA_CURVE } from '../js/data/economy.js';

const runWeeks = (state, n) => {
  let last = null;
  for (let w = 0; w < n; w++) {
    for (let d = 0; d < 7; d++) { openDay(state); last = closeDay(state); }
  }
  return last;
};

test('the final week is the last one the quota curve authors', () => {
  const s = newGame(1);
  s.week = QUOTA_CURVE.length;
  assert.equal(isFinalWeek(s), true);
  s.week = QUOTA_CURVE.length - 1;
  assert.equal(isFinalWeek(s), false);
});

test('the game ENDS after the final week rather than running forever', () => {
  const s = newGame(1);
  const result = runWeeks(s, QUOTA_CURVE.length);
  assert.equal(result.ended, true, 'closeDay must report the end');
  assert.equal(s.ended, true, 'and mark the state');
  assert.ok(result.ending, 'and name an ending scene');
});

test('the game does not end early', () => {
  const s = newGame(1);
  const result = runWeeks(s, QUOTA_CURVE.length - 1);
  assert.ok(!result.ended, `should not be over at week ${s.week}`);
  assert.ok(!s.ended);
});

test('every affection tier maps to a real ending scene that exists', () => {
  for (const tier of TIER_ORDER) {
    const id = endingFor(TIER_THRESHOLDS[tier]);
    assert.equal(typeof id, 'string', `${tier} has no ending`);
    assert.ok(SCENES[id], `${tier} maps to "${id}", which is not in scenes.js`);
  }
});

test('a devoted playthrough gets a different ending than a distant one', () => {
  const cold = endingFor(0);
  const warm = endingFor(TIER_THRESHOLDS.DEVOTED);
  assert.notEqual(cold, warm, 'the arc must actually change how it finishes');
});

test('every ending scene terminates', () => {
  for (const tier of TIER_ORDER) {
    let id = endingFor(TIER_THRESHOLDS[tier]);
    let hops = 0;
    while (id && hops < 20) {
      const node = SCENES[id];
      assert.ok(node, `ending chain reaches missing node "${id}"`);
      if (node.end) break;
      id = node.next || (node.choices && node.choices[0].next);
      hops += 1;
    }
    assert.ok(hops < 20, `${tier} ending does not terminate`);
  }
});

test('the ending fires once, not every subsequent day', () => {
  const s = newGame(1);
  runWeeks(s, QUOTA_CURVE.length);
  const after = runWeeks(s, 1);
  assert.ok(!after.ended, 'the ending must not re-fire after the game is over');
});

// --- repeated misses must not repeat the same words ---

test('missing repeatedly gives different scenes, not the same line six times', () => {
  const seen = new Set();
  for (let n = 1; n <= 4; n++) seen.add(missSceneFor(n));
  assert.ok(seen.size > 1, 'a player who struggles hears the same line every week');
  for (const id of seen) {
    assert.ok(SCENES[id], `miss scene "${id}" is not in scenes.js`);
  }
});

test('the miss scene stops varying rather than running out and breaking', () => {
  const id = missSceneFor(99);
  assert.ok(SCENES[id], 'a very unlucky player must still get a real scene');
});

test('the first miss is gentler than a repeated one', () => {
  assert.notEqual(missSceneFor(1), missSceneFor(3),
    'the shop being in trouble should read differently from one bad week');
});

test('every ending resolves to its own title, not the generic fallback', () => {
  /* THE REGRESSION GUARD. This walk used to live in main.js, which no test
     can import because it needs a DOM. A rename there changed its condition
     to one that is always true, so the walk never ran and all five endings
     printed "The season turns" — a devoted eight-week run and a stranger's
     were headed identically, and that title is the one thing on the card
     that tells them apart.

     ending.test.js already proved every tier reaches a real terminating
     scene. It never proved the title reached the screen, because the code
     that fetched it was somewhere nothing could reach. */
  const seen = new Map();
  for (const points of [0, 10, 30, 60, 300]) {
    const id = endingFor(points);
    const title = endingTitleFor(id);
    assert.ok(title, `${id} (at ${points} points) has no title, so the card falls back to a generic one`);
    assert.notEqual(title, 'The season turns', `${id} is showing the fallback`);
    seen.set(title, id);
  }
  assert.equal(seen.size, 5, `all five endings must be titled differently, got: ${[...seen.keys()].join(' / ')}`);
});

test('an unknown or broken ending id returns null rather than looping', () => {
  assert.equal(endingTitleFor('no_such_ending'), null);
  assert.equal(endingTitleFor(undefined), null);
});
