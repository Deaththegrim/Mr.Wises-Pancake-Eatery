/* Content integrity checker. Run: node tools/validate.js

   Prints plain-English problems naming the file and the row, so a content
   author gets a clear message instead of a blank screen or — worse — a
   game that looks fine but contains something the player can never reach.

   Errors block; warnings are worth a look but do not break the game. */

import { INGREDIENTS } from '../js/data/ingredients.js';
import { RECIPES } from '../js/data/recipes.js';
import { SYRUPS } from '../js/data/syrups.js';
import { RESEARCH } from '../js/data/research.js';
import { CUSTOMERS } from '../js/data/customers.js';

const AXES = ['sweet', 'sharp', 'rich', 'strange'];

/* Mirrors engine/research.js blendAxes/axisDistance. Duplicated rather
   than imported so the validator keeps working even if the engine is
   mid-refactor — a broken engine must not silence content checks. */
function blend(ids, ingredients) {
  const found = ids.map(id => ingredients.find(i => i.id === id)).filter(Boolean);
  const out = { sweet: 0, sharp: 0, rich: 0, strange: 0 };
  if (!found.length) return out;
  for (const ing of found) for (const ax of AXES) out[ax] += ing.axes[ax];
  for (const ax of AXES) out[ax] /= found.length;
  return out;
}

function distance(a, b) {
  return Math.sqrt(AXES.reduce((acc, ax) => acc + (a[ax] - b[ax]) ** 2, 0));
}

export function validateContent(override = {}) {
  const ingredients = override.ingredients || INGREDIENTS;
  const recipes = override.recipes || RECIPES;
  const syrups = override.syrups || SYRUPS;
  const research = override.research || RESEARCH;
  const customers = override.customers || CUSTOMERS;

  const errors = [], warnings = [];
  const ingIds = new Set(ingredients.map(x => x.id));
  const recipeIds = new Set(recipes.map(x => x.id));
  const syrupIds = new Set(syrups.map(x => x.id));
  const researchIds = new Set(research.map(x => x.id));
  const recipeTags = new Set(recipes.flatMap(r => r.tags || []));
  const wantedTags = new Set(customers.flatMap(c => c.wants || []));

  // --- recipes ---
  for (const r of recipes) {
    for (const ing of r.ingredients || []) {
      if (!ingIds.has(ing)) {
        errors.push(`recipes.js — recipe "${r.id}" uses ingredient "${ing}", which is not in ingredients.js`);
      }
    }
    // Unreachable revenue: nobody will ever order this.
    const wanted = (r.tags || []).some(t => wantedTags.has(t));
    if (!wanted) {
      errors.push(
        `recipes.js — recipe "${r.id}" has tags [${(r.tags || []).join(', ')}] and NO customer wants any of them, ` +
        `so it can never be ordered. Give a customer in customers.js one of those tags, or retag the recipe.`);
    }
  }

  if (!recipes.some(r => r.unlockedAtStart)) {
    errors.push('recipes.js — no recipe has unlockedAtStart: true, so the game would start with nothing to cook');
  }

  // --- research ---
  for (const n of research) {
    for (const p of n.prereqs || []) {
      if (!researchIds.has(p)) {
        errors.push(`research.js — node "${n.id}" lists prereq "${p}", which is not a research node`);
      }
    }
    const u = n.unlocks || {};
    if (u.recipe && !recipeIds.has(u.recipe)) {
      errors.push(`research.js — node "${n.id}" unlocks recipe "${u.recipe}", which is not in recipes.js`);
    }
    if (u.syrup && !syrupIds.has(u.syrup)) {
      errors.push(`research.js — node "${n.id}" unlocks syrup "${u.syrup}", which is not in syrups.js`);
    }
    if (n.gate && n.gate.cooked) {
      for (const rid of Object.keys(n.gate.cooked)) {
        if (!recipeIds.has(rid)) {
          errors.push(`research.js — node "${n.id}" is gated on cooking "${rid}", which is not in recipes.js`);
        }
      }
    }
  }

  // Reachability: a node nobody can ever buy is a content bug, not fatal.
  const reachable = new Set();
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of research) {
      if (reachable.has(n.id)) continue;
      if ((n.prereqs || []).every(p => reachable.has(p))) { reachable.add(n.id); grew = true; }
    }
  }
  for (const n of research) {
    if (!reachable.has(n.id)) {
      warnings.push(`research.js — node "${n.id}" is unreachable (a prerequisite cycle, or a prereq that is itself unreachable)`);
    }
  }

  // --- syrups: is every discoverable one actually discoverable? ---
  // The bench AVERAGES its ingredients, so a target must lie within the
  // range 2-3 real ingredients can average to. Brute-force it.
  const ids = ingredients.map(i => i.id);
  const combos = [];
  for (let a = 0; a < ids.length; a++) {
    for (let b = a; b < ids.length; b++) {
      combos.push([ids[a], ids[b]]);
      for (let c = b; c < ids.length; c++) combos.push([ids[a], ids[b], ids[c]]);
    }
  }
  for (const s of syrups) {
    if (!s.discover) continue;
    if (!s.discover.target) {
      errors.push(`syrups.js — syrup "${s.id}" has a discover block with no target`);
      continue;
    }
    let best = null, bestDist = Infinity;
    for (const combo of combos) {
      const d = distance(blend(combo, ingredients), s.discover.target);
      if (d < bestDist) { bestDist = d; best = combo; }
    }
    if (bestDist > (s.discover.tolerance ?? 0)) {
      errors.push(
        `syrups.js — syrup "${s.id}" can NEVER be discovered. Closest possible blend is ${bestDist.toFixed(2)} away ` +
        `(via ${best ? best.join(' + ') : 'nothing'}) but its tolerance is ${s.discover.tolerance}. ` +
        `Remember the bench averages ingredients, so a target cannot be more intense than the ingredients allow — ` +
        `either widen the tolerance, move the target closer to a real blend, or add an ingredient.`);
    }
  }

  // --- customers ---
  for (const c of customers) {
    for (const tag of c.wants || []) {
      if (!recipeTags.has(tag)) {
        warnings.push(`customers.js — customer "${c.id}" wants tag "${tag}", which no recipe has`);
      }
    }
    for (const key of ['greeting', 'happy', 'disappointed']) {
      if (!c.lines || !c.lines[key]) {
        warnings.push(`customers.js — customer "${c.id}" is missing the "${key}" line`);
      }
    }
  }

  return { errors, warnings };
}

// CLI entry point.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, warnings } = validateContent();
  for (const w of warnings) console.warn(`WARN  ${w}`);
  for (const e of errors) console.error(`ERROR ${e}`);
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(errors.length > 0 ? 1 : 0);
}
