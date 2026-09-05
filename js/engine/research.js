import { RESEARCH } from '../data/research.js';
import { INGREDIENTS, AXES } from '../data/ingredients.js';
import { SYRUPS } from '../data/syrups.js';
import { researchById, ingredientById } from './lookup.js';
import { TUNING } from '../data/economy.js';
import { hasIngredients, missingIngredients, consumeIngredients } from './pantry.js';


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
  const node = researchById(nodeId);
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
  const found = (ingredientIds || []).map(id => ingredientById(id)).filter(Boolean);
  const out = Object.fromEntries(AXES.map(ax => [ax, 0]));
  if (found.length === 0) return out;
  // Tolerant of a malformed row so the bench degrades to a hint, not a throw.
  for (const ing of found) for (const ax of AXES) out[ax] += Number(ing.axes?.[ax]) || 0;
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

/* The bench costs INGREDIENTS, which cost MONEY. That is what makes
   discovery a grind rather than a puzzle you solve for free.

   Three outcomes, and the distinction matters:
     blocked  — you do not have the ingredients. Nothing happened, nothing
                was spent, no points. Not a failure, a refusal.
     miss     — the ingredients are GONE, but you always get a hint and
                points. Failure must cost something real or there is no
                grind; it must still teach or nobody experiments twice.
     found    — the ingredients are gone and you have a new syrup. */
export function experiment(state, ingredientIds) {
  if (!hasIngredients(state, ingredientIds)) {
    const missing = missingIngredients(state, ingredientIds);
    return {
      found: false,
      blocked: true,
      points: 0,
      hint: missing.length
        ? `You do not have: ${missing.join(', ')}. Buy more stock.`
        : 'Pick something to combine first.'
    };
  }
  /* Compute BEFORE consuming. This used to consume the ingredients and then
     throw on a malformed axes block, so the player's stock vanished with no
     hint, no notice and no result — silent theft. */
  const blend = blendAxes(ingredientIds);
  consumeIngredients(state, ingredientIds);
  const candidates = SYRUPS.filter(s => s.discover && !state.unlockedSyrups.includes(s.id));

  let best = null, bestDist = Infinity;
  for (const syrup of candidates) {
    const d = axisDistance(blend, syrup.discover.target);
    if (d < bestDist) { bestDist = d; best = syrup; }
  }

  if (best && bestDist <= best.discover.tolerance) {
    state.unlockedSyrups.push(best.id);
    const points = TUNING.benchFailPoints * 3;
    state.points += points;          // credited here, not in the UI
    return { found: true, syrupId: best.id, points };
  }

  const hint = best
    ? hintFor(blend, best.discover.target)
    : 'Nothing left to find down this road.';
  state.points += TUNING.benchFailPoints;
  return { found: false, hint, points: TUNING.benchFailPoints };
}
