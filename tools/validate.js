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
  // Tolerant of malformed rows: this runs AFTER the shape checks have already
  // reported them, and it must not crash before the author sees that report.
  const found = ids
    .map(id => ingredients.find(i => i.id === id))
    .filter(i => i && i.axes && AXES.every(ax => typeof i.axes[ax] === 'number'));
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

  /* REQUIRED-FIELD CHECKS.

     Every one of these was a real crash: the validator defaulted a missing
     field away with `|| []` and reported 0 errors, then the engine — which
     is NOT tolerant — threw on it. A recipe without `ingredients` made "New
     Game" a permanently dead click; a research node without `prereqs` did
     the same to the Research button; a typo in `weights` turned money and
     reputation into NaN and SAVED it; a missing `stackCount` trapped the
     player in the stack beat forever.

     The validator must be STRICTER than the engine, not more forgiving. */
  const need = (obj, path, kind, where, id) => {
    const parts = path.split('.');
    let v = obj;
    for (const part of parts) v = v == null ? undefined : v[part];
    const ok = kind === 'array' ? Array.isArray(v)
             : kind === 'number' ? typeof v === 'number' && Number.isFinite(v)
             : kind === 'object' ? v && typeof v === 'object'
             : typeof v === kind;
    if (!ok) {
      errors.push(`${where} — "${id}" is missing ${path} (needs a ${kind}). ` +
                  `The game will crash or misbehave on this row.`);
    }
    return ok;
  };

  for (const r of recipes) {
    need(r, 'id', 'string', 'recipes.js', r.id || '(no id)');
    need(r, 'name', 'string', 'recipes.js', r.id);
    need(r, 'base', 'number', 'recipes.js', r.id);
    need(r, 'tags', 'array', 'recipes.js', r.id);
    need(r, 'ingredients', 'array', 'recipes.js', r.id);
    need(r, 'stackCount', 'number', 'recipes.js', r.id);
    need(r, 'pour.target', 'number', 'recipes.js', r.id);
    need(r, 'pour.band', 'number', 'recipes.js', r.id);
    need(r, 'flip.windowMs', 'number', 'recipes.js', r.id);
    for (const beat of ['pour', 'flip', 'stack', 'drizzle']) {
      need(r, `weights.${beat}`, 'number', 'recipes.js', r.id);
    }
    // A stray key in weights is the classic hand-edit typo and yields NaN.
    for (const k of Object.keys(r.weights || {})) {
      if (!['pour', 'flip', 'stack', 'drizzle'].includes(k)) {
        errors.push(`recipes.js — recipe "${r.id}" has an unknown weight "${k}". ` +
                    `Valid weights are pour, flip, stack, drizzle. A typo here makes ` +
                    `every score NaN and corrupts the save.`);
      }
    }
  }

  for (const ing of ingredients) {
    need(ing, 'id', 'string', 'ingredients.js', ing.id || '(no id)');
    need(ing, 'name', 'string', 'ingredients.js', ing.id);
    need(ing, 'cost', 'number', 'ingredients.js', ing.id);
    if (need(ing, 'axes', 'object', 'ingredients.js', ing.id)) {
      for (const ax of AXES) need(ing, `axes.${ax}`, 'number', 'ingredients.js', ing.id);
      for (const k of Object.keys(ing.axes)) {
        if (!AXES.includes(k)) {
          errors.push(`ingredients.js — "${ing.id}" has an unknown axis "${k}". ` +
                      `Valid axes are ${AXES.join(', ')}. A typo here makes every syrup ` +
                      `permanently undiscoverable while the bench reports "nothing left to find".`);
        }
      }
    }
  }

  for (const n of research) {
    need(n, 'id', 'string', 'research.js', n.id || '(no id)');
    need(n, 'name', 'string', 'research.js', n.id);
    need(n, 'cost', 'number', 'research.js', n.id);
    need(n, 'prereqs', 'array', 'research.js', n.id);
  }

  for (const c of customers) {
    need(c, 'id', 'string', 'customers.js', c.id || '(no id)');
    need(c, 'name', 'string', 'customers.js', c.id);
    need(c, 'wants', 'array', 'customers.js', c.id);
  }

  // Somebody must be servable in week 1 with no reputation, or the player
  // opens the shop to "Nobody right now" every day with no clue why.
  const wk1 = customers.filter(c => {
    const u = c.unlockAt || {};
    return (u.week === undefined || u.week <= 1) && (u.reputation === undefined || u.reputation <= 0);
  });
  if (wk1.length === 0) {
    errors.push('customers.js — no customer is available in week 1 at zero reputation, ' +
                'so the shop opens to nobody and the game cannot start.');
  }

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
  const shapesOk = ingredients.every(i => i && i.axes && AXES.every(ax => typeof i.axes[ax] === 'number'));
  const ids = shapesOk ? ingredients.map(i => i.id) : [];
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
    for (const ax of AXES) {
      if (typeof s.discover.target[ax] !== 'number') {
        errors.push(`syrups.js — syrup "${s.id}" discover target is missing axis "${ax}"`);
      }
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
