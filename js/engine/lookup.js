import { RECIPES } from '../data/recipes.js';
import { INGREDIENTS } from '../data/ingredients.js';
import { SYRUPS } from '../data/syrups.js';
import { RESEARCH } from '../data/research.js';

/* ONE PLACE TO LOOK SOMETHING UP BY ID.

   There were sixteen copies of `COLLECTION.find(x => x.id === id)` across
   eight files, and they did not agree on what happens when the id is not
   found: some returned undefined, some `|| {}`, some `|| { name: id }`,
   some null. So the same missing id threw in one screen, rendered the
   word "undefined" in another, and silently showed the raw id in a third.

   Everything here returns null when it finds nothing — one answer, easy to
   test for — and `nameOf` gives the display fallback that the UI actually
   wanted, so no caller has to invent one again. */

const finder = collection => id => collection.find(x => x.id === id) || null;

export const recipeById = finder(RECIPES);
export const ingredientById = finder(INGREDIENTS);
export const syrupById = finder(SYRUPS);
export const researchById = finder(RESEARCH);

/* For labels. Falls back to the raw id, which is a readable clue in a
   half-authored game — far better than "undefined" and better than a
   blank, which looks like a rendering bug rather than missing content. */
export const nameOf = (lookup, id) => {
  const found = lookup(id);
  return found && found.name ? found.name : id;
};
