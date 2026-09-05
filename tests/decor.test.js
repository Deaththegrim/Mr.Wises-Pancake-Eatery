import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyDecor, owns, decorFor, decorById, ownedDecor, totalDecorCost } from '../js/engine/decor.js';
import { DECOR } from '../js/data/decor.js';
import { newGame, serialize, deserialize } from '../js/engine/state.js';

/* DECORATION.

   The money sink. Before it existed a careful player finished the research
   tree before the last weeks and the till simply climbed — roughly 21,000
   banked by the end, against a game whose entire escalating quota is
   supposed to mean something.

   The rule that must never break: it is COSMETIC. Spec §14.5 is explicit
   that decoration does not feed reputation, because reputation already
   means exactly two things — which customers come, and how many — and a
   third input would make it two systems wearing one name. */

const fresh = (money = 100000) => Object.assign(newGame(1), { money });

test('buying spends the money and keeps the thing', () => {
  const s = fresh(5000);
  const r = buyDecor(s, 'corner_lamp');
  assert.ok(r.ok);
  assert.equal(s.money, 5000 - decorById('corner_lamp').cost);
  assert.ok(owns(s, 'corner_lamp'));
});

test('IT NEVER TOUCHES REPUTATION, POINTS OR AFFECTION', () => {
  /* The whole design constraint in one test. If this ever fails,
     reputation has quietly become two systems sharing a name and the
     decoration has stopped being a self-authored goal. */
  const s = fresh();
  s.reputation = 42;
  s.points = 17;
  s.synthia.points = 9;
  for (const d of DECOR) assert.ok(buyDecor(s, d.id).ok, `could not buy ${d.id}`);
  assert.equal(s.reputation, 42, 'decoration must not raise reputation');
  assert.equal(s.points, 17, 'nor research points');
  assert.equal(s.synthia.points, 9, 'nor affection — it is not a gift');
});

test('nothing can be bought twice', () => {
  const s = fresh();
  assert.ok(buyDecor(s, 'window_boxes').ok);
  const again = buyDecor(s, 'window_boxes');
  assert.ok(!again.ok);
  assert.match(again.reason, /already/i);
  assert.equal(s.decor.filter(id => id === 'window_boxes').length, 1);
});

test('you cannot buy what you cannot afford, and it costs nothing to try', () => {
  const s = fresh(10);
  const before = s.money;
  const r = buyDecor(s, 'front_awning');
  assert.ok(!r.ok);
  assert.equal(s.money, before, 'a refused purchase must not take the money');
  assert.equal(s.decor.length, 0);
  assert.match(r.reason, /costs/i);
});

test('an unknown id is refused rather than throwing', () => {
  const s = fresh();
  const r = buyDecor(s, 'gilded_nothing');
  assert.ok(!r.ok);
  assert.equal(s.money, 100000);
});

test('the list reports what the player can act on', () => {
  const s = fresh(1500);
  buyDecor(s, 'window_boxes');                 // 400 spent, 1100 left
  const items = decorFor(s);
  assert.equal(items.length, DECOR.length);
  assert.ok(items.find(i => i.id === 'window_boxes').owned);
  assert.ok(!items.find(i => i.id === 'front_awning').affordable);
  assert.ok(items.find(i => i.id === 'second_table').affordable);
});

test('the room lists what was bought, in the order it was bought', () => {
  const s = fresh();
  buyDecor(s, 'corner_lamp');
  buyDecor(s, 'window_boxes');
  assert.deepEqual(ownedDecor(s).map(d => d.id), ['corner_lamp', 'window_boxes']);
});

test('it survives a save and a reload', () => {
  const s = fresh();
  buyDecor(s, 'repainted_sign');
  const { ok, state } = deserialize(serialize(s));
  assert.ok(ok);
  assert.ok(owns(state, 'repainted_sign'));
});

test('the whole shop costs more than one run banks — it is not a checklist', () => {
  /* A careful player ends with roughly 15,000-21,000 spare. If everything
     were affordable in one run the sink would be emptied before the last
     week and the money would start piling up again. */
  assert.ok(totalDecorCost() > 15000,
    `the shop totals ${totalDecorCost()}, which one run can clear`);
});

test('every item costs more than the one before it', () => {
  // The shop screen renders in data order, so that order must read as a
  // ladder rather than as an unsorted list.
  for (let i = 1; i < DECOR.length; i++) {
    assert.ok(DECOR[i].cost > DECOR[i - 1].cost,
      `${DECOR[i].id} (${DECOR[i].cost}) does not cost more than ${DECOR[i - 1].id} (${DECOR[i - 1].cost})`);
  }
});

test('the cheapest thing is reachable early, so the shop is not a late-game screen', () => {
  assert.ok(DECOR[0].cost <= 500, `the first item costs ${DECOR[0].cost}`);
});
