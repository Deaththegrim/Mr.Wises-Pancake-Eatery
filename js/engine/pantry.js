import { INGREDIENTS } from '../data/ingredients.js';

/* THE PANTRY — the money sink, and what makes research a grind.

   Research points come from serving well. Ingredients come from MONEY.
   You cannot discover a new syrup by thinking about it: you buy things
   out of the till, combine them at the bench, and they are gone whether
   or not it worked.

   That is the whole reason the shop's profits matter. Before this existed
   an 8-week playthrough ended with ~62,000 in the till and nothing to
   spend it on, which meant the escalating quota was pressure without a
   purpose. Now profit converts into capability, which is the ratchet the
   quota curve was designed around. */

const byId = id => INGREDIENTS.find(i => i.id === id);

export function priceOf(ingredientId) {
  const ing = byId(ingredientId);
  return ing ? ing.cost : 0;
}

export function stockOf(state, ingredientId) {
  return (state.pantry || {})[ingredientId] || 0;
}

export function restockCost(ingredientIds) {
  return (ingredientIds || []).reduce((sum, id) => sum + priceOf(id), 0);
}

export function canAfford(state, ingredientId, qty = 1) {
  return state.money >= priceOf(ingredientId) * qty;
}

export function buyIngredient(state, ingredientId, qty = 1) {
  const ing = byId(ingredientId);
  if (!ing) return { ok: false, reason: `Unknown ingredient: ${ingredientId}` };
  if (!Number.isInteger(qty) || qty < 1) return { ok: false, reason: 'Buy at least one.' };

  const total = ing.cost * qty;
  if (state.money < total) {
    return { ok: false, reason: `Not enough money (need ${total}, you have ${state.money}).` };
  }

  state.money -= total;
  if (!state.pantry) state.pantry = {};
  state.pantry[ingredientId] = stockOf(state, ingredientId) + qty;
  return { ok: true, spent: total, stock: state.pantry[ingredientId] };
}

/* A blend may use the same ingredient more than once, so count needs
   rather than checking each id in isolation. */
export function hasIngredients(state, ingredientIds) {
  const need = {};
  for (const id of ingredientIds || []) need[id] = (need[id] || 0) + 1;
  return Object.entries(need).every(([id, n]) => stockOf(state, id) >= n);
}

export function missingIngredients(state, ingredientIds) {
  const need = {};
  for (const id of ingredientIds || []) need[id] = (need[id] || 0) + 1;
  return Object.entries(need)
    .filter(([id, n]) => stockOf(state, id) < n)
    .map(([id]) => (byId(id) || { name: id }).name);
}

export function consumeIngredients(state, ingredientIds) {
  if (!state.pantry) state.pantry = {};
  for (const id of ingredientIds || []) {
    state.pantry[id] = Math.max(0, stockOf(state, id) - 1);
  }
}
