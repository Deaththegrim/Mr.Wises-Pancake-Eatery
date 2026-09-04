import { RESEARCH } from '../data/research.js';
import { INGREDIENTS } from '../data/ingredients.js';
import { SYRUPS } from '../data/syrups.js';
import { TUNING } from '../data/economy.js';

const AXES = ['sweet', 'sharp', 'rich', 'strange'];
const byId = (coll, id) => coll.find(x => x.id === id);

export function gateMet(node, state) {
  if (!node.gate) return true;
  if (node.gate.cooked) {
    for (const [recipeId, need] of Object.entries(node.gate.cooked)) {
      if ((state.cooked[recipeId] || 0) < need) return false;
    }
  }
  return true;
}

export function isAvailable(node, state) {
  if (state.purchased.includes(node.id)) return false;
  if (!node.prereqs.every(p => state.purchased.includes(p))) return false;
  return gateMet(node, state);
}

export function availableNodes(state) {
  return RESEARCH.filter(n => isAvailable(n, state));
}

export function purchase(state, nodeId) {
  const node = byId(RESEARCH, nodeId);
  if (!node) return { ok: false, reason: `Unknown research node: ${nodeId}` };
  if (state.purchased.includes(nodeId)) return { ok: false, reason: 'Already researched.' };
  if (!node.prereqs.every(p => state.purchased.includes(p))) return { ok: false, reason: 'Prerequisites not met.' };
  if (!gateMet(node, state)) return { ok: false, reason: 'You have not cooked enough of the required dish yet.' };
  if (state.points < node.cost) return { ok: false, reason: `Not enough research points (need ${node.cost}).` };

  state.points -= node.cost;
  state.purchased.push(nodeId);
  const u = node.unlocks || {};
  if (u.recipe && !state.unlockedRecipes.includes(u.recipe)) state.unlockedRecipes.push(u.recipe);
  if (u.syrup && !state.unlockedSyrups.includes(u.syrup)) state.unlockedSyrups.push(u.syrup);
  if (u.upgrade && !state.upgrades.includes(u.upgrade)) state.upgrades.push(u.upgrade);
  return { ok: true, node };
}

export function blendAxes(ingredientIds) {
  const found = (ingredientIds || []).map(id => byId(INGREDIENTS, id)).filter(Boolean);
  const out = { sweet: 0, sharp: 0, rich: 0, strange: 0 };
  if (found.length === 0) return out;
  for (const ing of found) for (const ax of AXES) out[ax] += ing.axes[ax];
  for (const ax of AXES) out[ax] /= found.length;
  return out;
}

export function axisDistance(blend, target) {
  return Math.sqrt(AXES.reduce((a, ax) => a + (blend[ax] - target[ax]) ** 2, 0));
}

/* Potion Craft's second complaint was "no directional hints". A miss names
   the axis that is furthest off and which way to push it. */
export function hintFor(blend, target) {
  let worstAxis = AXES[0], worstDelta = 0;
  for (const ax of AXES) {
    const d = blend[ax] - target[ax];
    if (Math.abs(d) > Math.abs(worstDelta)) { worstDelta = d; worstAxis = ax; }
  }
  const tooMuch = {
    sweet: 'Too sweet. It needs cutting.',
    sharp: 'Too sharp. Wants something round.',
    rich: 'Too heavy. Lighten it.',
    strange: 'Too strange. Bring it back to earth.'
  };
  const tooLittle = {
    sweet: 'Not sweet enough.',
    sharp: 'Flat. It needs an edge.',
    rich: 'Thin. It wants more body.',
    strange: 'Ordinary. Nothing about it surprises.'
  };
  if (worstDelta === 0) return 'Close. Something is still not right.';
  return worstDelta > 0 ? tooMuch[worstAxis] : tooLittle[worstAxis];
}

/* A failed experiment ALWAYS returns a hint and non-zero points. The search
   space must be forgiving enough that failure is informative, not wasted. */
export function experiment(state, ingredientIds) {
  const blend = blendAxes(ingredientIds);
  const candidates = SYRUPS.filter(s => s.discover && !state.unlockedSyrups.includes(s.id));

  let best = null, bestDist = Infinity;
  for (const syrup of candidates) {
    const d = axisDistance(blend, syrup.discover.target);
    if (d < bestDist) { bestDist = d; best = syrup; }
  }

  if (best && bestDist <= best.discover.tolerance) {
    state.unlockedSyrups.push(best.id);
    return { found: true, syrupId: best.id, points: TUNING.benchFailPoints * 3 };
  }

  const hint = best
    ? hintFor(blend, best.discover.target)
    : 'Nothing left to find down this road.';
  return { found: false, hint, points: TUNING.benchFailPoints };
}
