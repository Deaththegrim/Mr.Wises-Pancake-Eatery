import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDay, closeDay, nextCustomer, serve } from '../js/engine/day.js';
import { synthiaDueToday, mentionSceneFor } from '../js/engine/story.js';
import { newGame } from '../js/engine/state.js';
import { SCENES } from '../js/data/scenes.js';
import { RECIPES } from '../js/data/recipes.js';

const perfect = id => {
  const r = RECIPES.find(x => x.id === id);
  return { volume: r.pour.target, msOffset: 0,
           offsets: new Array(r.stackCount).fill(0),
           coverage: [0.7, 0.7, 0.7, 0.7, 0.7, 0.7] };
};

test('Synthia actually visits the shop during a week', () => {
  const s = newGame(1);
  let visits = 0;
  for (let d = 1; d <= 7; d++) { s.day = d; if (synthiaDueToday(s)) visits += 1; }
  assert.ok(visits >= 1, 'she must appear as a CUSTOMER, not only in week-boundary scenes');
});

test('she does not visit every single day', () => {
  const s = newGame(1);
  let visits = 0;
  for (let d = 1; d <= 7; d++) { s.day = d; if (synthiaDueToday(s)) visits += 1; }
  assert.ok(visits < 7, 'a god who turns up every day is not a slow burn');
});

test('her visit is deterministic for a seed', () => {
  const a = newGame(42), b = newGame(42);
  for (let d = 1; d <= 7; d++) {
    a.day = d; b.day = d;
    assert.equal(synthiaDueToday(a), synthiaDueToday(b));
  }
});

test('she appears in the customer queue on her day', () => {
  const s = newGame(1);
  openDay(s);
  // find her day
  let found = false;
  for (let d = 1; d <= 7 && !found; d++) {
    s.day = d;
    if (!synthiaDueToday(s)) continue;
    openDay(s);
    for (let i = 0; i < 20; i++) {
      const o = nextCustomer(s);
      if (o && o.isSynthia) { found = true; break; }
    }
  }
  assert.ok(found, 'nextCustomer must be able to return her');
});

test('serving her raises affection - the mechanic must be REACHABLE', () => {
  const s = newGame(1);
  openDay(s);
  const before = s.synthia.points;
  serve(s, 'plain', perfect('plain'), { forSynthia: true });
  assert.ok(s.synthia.points > before, 'serving her must count for something');
});

test('mentionSceneFor returns real scenes and eventually runs out cleanly', () => {
  const s = newGame(1);
  const first = mentionSceneFor(s);
  assert.ok(first === null || SCENES[first], `"${first}" is not a real scene`);
  // exhaust them
  for (let i = 0; i < 10; i++) {
    const id = mentionSceneFor(s);
    if (!id) break;
    s.synthia.mentions.push(SCENES[id].mentions);
  }
  assert.equal(mentionSceneFor(s), null, 'once she has mentioned everything, stop');
});

test('a mention is not repeated once she has said it', () => {
  const s = newGame(1);
  const id = mentionSceneFor(s);
  if (id) {
    s.synthia.mentions.push(SCENES[id].mentions);
    assert.notEqual(mentionSceneFor(s), id, 'she should not say the same thing twice');
  }
});

test('every mention scene points at a REAL recipe', () => {
  for (const [id, node] of Object.entries(SCENES)) {
    if (!node.mentions) continue;
    assert.ok(RECIPES.some(r => r.id === node.mentions),
      `scene "${id}" mentions "${node.mentions}", which is not a recipe — the listening beat could never fire`);
  }
});
