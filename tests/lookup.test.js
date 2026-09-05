import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recipeById, ingredientById, syrupById, researchById, nameOf } from '../js/engine/lookup.js';
import { RECIPES } from '../js/data/recipes.js';
import { INGREDIENTS } from '../js/data/ingredients.js';

/* lookup.js exists for exactly one reason: sixteen copies of
   `COLLECTION.find(x => x.id === id)` disagreed about what happens when the
   id is not found — undefined here, `|| {}` there, `|| { name: id }`, null —
   so the same missing id threw on one screen, rendered the word "undefined"
   on another, and showed a raw id on a third.

   That contract is the whole value of the module, and it had no test: a
   mutation making nameOf() return '' for a missing id passed the entire
   suite. These pin the contract itself. */

test('a real id returns the row', () => {
  assert.equal(recipeById(RECIPES[0].id).id, RECIPES[0].id);
  assert.equal(ingredientById('flour').name, 'Flour');
  assert.equal(syrupById('maple_syrup').name, 'Maple Syrup');
  assert.ok(researchById('r_buttermilk'));
});

test('EVERY lookup returns null when it finds nothing — one answer, not four', () => {
  for (const [name, fn] of Object.entries({ recipeById, ingredientById, syrupById, researchById })) {
    assert.equal(fn('no_such_id'), null, `${name} must return null, not undefined or {}`);
    assert.equal(fn(undefined), null, `${name} must cope with no id at all`);
    assert.equal(fn(''), null, `${name} must cope with an empty id`);
  }
});

test('nameOf falls back to the RAW ID, never to blank or "undefined"', () => {
  /* A blank looks like a rendering bug and "undefined" looks like a crash.
     The raw id is a readable clue in a half-authored game — it tells the
     content author exactly which row is missing. */
  assert.equal(nameOf(ingredientById, 'flour'), 'Flour');
  assert.equal(nameOf(ingredientById, 'ghost_ingredient'), 'ghost_ingredient');
  assert.equal(nameOf(recipeById, 'ghost_recipe'), 'ghost_recipe');
  assert.notEqual(nameOf(syrupById, 'ghost_syrup'), '');
  assert.notEqual(String(nameOf(syrupById, 'ghost_syrup')), 'undefined');
});

test('nameOf survives a row that exists but has no name', () => {
  const nameless = { id: 'nameless' };
  assert.equal(nameOf(() => nameless, 'nameless'), 'nameless');
});

test('the lookups see the real content, not a stale copy', () => {
  assert.equal(recipeById(RECIPES.at(-1).id), RECIPES.at(-1));
  assert.equal(ingredientById(INGREDIENTS.at(-1).id), INGREDIENTS.at(-1));
});
