import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDay, closeDay, nextCustomer, serve } from '../js/engine/day.js';
import { synthiaDueToday, mentionSceneFor } from '../js/engine/story.js';
import { newGame } from '../js/engine/state.js';
import { noteMention } from '../js/engine/affection.js';
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

/* IMPOSSIBLE ORDERS (spec §9).

   She asks for something the player cannot make yet. The design rule
   these defend: it must never COST her visit. She comes in once a week,
   so an ask that replaced her order would take away that week's serving
   grant and the listening chance — the relationship would get worse the
   more she wanted, which inverts the entire mechanic. It happened that
   way in the first cut and the balance sim caught it: DEVOTED fell from
   10 of 10 seeds to 5. */

const synthiaVisit = state => {
  state.synthiaServedToday = false;
  // Walk the week to whichever day she is due on.
  for (let d = 1; d <= 7; d++) { state.day = d; if (synthiaDueToday(state)) break; }
  openDay(state);
  let order = null;
  for (let i = 0; i < 30 && !order; i++) {
    const o = nextCustomer(state);
    if (o && o.isSynthia) order = o;
  }
  return order;
};

test('she asks for a dish that is not unlocked, and still orders something', () => {
  const s = newGame(11);
  const locked = RECIPES.find(r => !r.unlockedAtStart).id;
  noteMention(s.synthia, locked);

  const order = synthiaVisit(s);
  assert.ok(order, 'she must actually visit');
  assert.equal(order.impossibleAsk, locked, 'she asks for the thing she mentioned');
  assert.ok(order.recipeId, 'and still places an order she can be served');
  assert.ok(s.unlockedRecipes.includes(order.recipeId),
    'the order she actually places must be something the player can cook');
  assert.notEqual(order.recipeId, locked);
});

test('the ask is recorded so the research board can show it', () => {
  const s = newGame(11);
  const locked = RECIPES.find(r => !r.unlockedAtStart).id;
  noteMention(s.synthia, locked);
  synthiaVisit(s);
  assert.deepEqual(s.synthia.wanted, [locked]);
});

test('she does not ask for the same dish twice', () => {
  const s = newGame(11);
  const locked = RECIPES.find(r => !r.unlockedAtStart).id;
  noteMention(s.synthia, locked);
  synthiaVisit(s);

  s.week = 2;
  const second = synthiaVisit(s);
  assert.equal(second.impossibleAsk, null, 'she works through her list rather than nagging');
});

test('once it is unlocked she orders it outright instead of asking', () => {
  const s = newGame(11);
  const locked = RECIPES.find(r => !r.unlockedAtStart).id;
  noteMention(s.synthia, locked);
  s.unlockedRecipes.push(locked);
  s.menu.push(locked);

  const order = synthiaVisit(s);
  assert.equal(order.recipeId, locked, 'the listening payoff must win over the ask');
  assert.equal(order.impossibleAsk, null);
});

test('a mention naming a dish that no longer exists is ignored, not asked for', () => {
  const s = newGame(11);
  noteMention(s.synthia, 'deleted_recipe');
  const order = synthiaVisit(s);
  assert.equal(order.impossibleAsk, null, 'she must not ask for something with no name to print');
});
