import { INGREDIENTS } from '../data/ingredients.js';
import { TUNING } from '../data/economy.js';

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

/* Stock is bought in UNITS and held in SERVINGS. One unit is a bulk
   quantity that makes TUNING.servingsPerUnit pancakes. Cooking spends one
   serving per listed ingredient; the BENCH burns a whole unit, because
   experimenting is wasteful. That gap is what keeps discovery expensive
   while cooking stays profitable. */
export function servingsFor(units) {
  return units * TUNING.servingsPerUnit;
}

export function unitsFor(servings) {
  return Math.ceil(servings / TUNING.servingsPerUnit);
}

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
  state.pantry[ingredientId] = stockOf(state, ingredientId) + servingsFor(qty);
  return { ok: true, spent: total, stock: state.pantry[ingredientId] };
}

/* Bench requirements, in SERVINGS. A blend may use the same ingredient
   more than once, and each use burns a whole unit, so the requirement is
   count x servingsPerUnit — not count. Getting this wrong lets a player
   start an experiment they cannot actually pay for. */
function benchNeeds(ingredientIds) {
  const need = {};
  for (const id of ingredientIds || []) {
    need[id] = (need[id] || 0) + TUNING.servingsPerUnit;
  }
  return need;
}

export function hasIngredients(state, ingredientIds) {
  return Object.entries(benchNeeds(ingredientIds))
    .every(([id, servings]) => stockOf(state, id) >= servings);
}

export function missingIngredients(state, ingredientIds) {
  return Object.entries(benchNeeds(ingredientIds))
    .filter(([id, servings]) => stockOf(state, id) < servings)
    .map(([id]) => (byId(id) || { name: id }).name);
}

/* The bench: a whole unit of each ingredient, gone. */
export function consumeIngredients(state, ingredientIds) {
  if (!state.pantry) state.pantry = {};
  for (const id of ingredientIds || []) {
    state.pantry[id] = Math.max(0, stockOf(state, id) - TUNING.servingsPerUnit);
  }
}

/* Cooking: one serving of each ingredient. */
export function consumeForCooking(state, ingredientIds) {
  if (!state.pantry) state.pantry = {};
  for (const id of ingredientIds || []) {
    state.pantry[id] = Math.max(0, stockOf(state, id) - 1);
  }
}

/* Take what a dish needs, buying emergency stock for anything short.

   Running out does NOT turn the customer away. A chill game must not
   punish a planning mistake by cancelling the sale — it charges you a
   markup instead, so bad restocking costs margin, not revenue. And if the
   player is flat broke it is taken on the house: never soft-lock someone
   out of the only activity that earns money. */
export function payForCooking(state, ingredientIds) {
  if (!state.pantry) state.pantry = {};
  let emergencyCost = 0, normalCost = 0;

  for (const id of ingredientIds || []) {
    const ing = byId(id);
    if (!ing) continue;                       // unknown id: costs nothing, never throws
    const perServing = ing.cost / TUNING.servingsPerUnit;

    if (stockOf(state, id) >= 1) {
      state.pantry[id] = stockOf(state, id) - 1;
      normalCost += perServing;
      continue;
    }

    // Short: buy one whole unit at a markup, use one serving, shelve the rest.
    const price = Math.round(ing.cost * TUNING.emergencyMarkup);
    if (state.money >= price) {
      state.money -= price;
      state.pantry[id] = servingsFor(1) - 1;
      emergencyCost += price;
    } else {
      // Broke. On the house — the sale still happens.
      state.pantry[id] = 0;
    }
  }

  return { ingredientCost: Math.round(normalCost), emergencyCost };
}
