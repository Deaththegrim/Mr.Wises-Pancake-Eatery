/* Content integrity checker. Run: node tools/validate.js

   Prints plain-English problems naming the file and the row, so a content
   author gets a clear message instead of a blank screen or — worse — a
   game that looks fine but contains something the player can never reach.

   Errors block; warnings are worth a look but do not break the game. */

import { INGREDIENTS, AXES } from '../js/data/ingredients.js';
import { RECIPES } from '../js/data/recipes.js';
import { SYRUPS } from '../js/data/syrups.js';
import { RESEARCH } from '../js/data/research.js';
import { CUSTOMERS } from '../js/data/customers.js';
import { TUNING } from '../js/data/economy.js';
import { SCENES } from '../js/data/scenes.js';
import { TIER_ORDER, TIER_THRESHOLDS, TIER_EXPRESSION, TIER_POSE } from '../js/data/affection.js';


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
  const scenes = override.scenes || SCENES;

  /* The scene checks cross-reference recipes and research. When a caller
     overrides those with a synthetic set — which the validator's own
     tests do, to plant one fault at a time — the real scenes would all
     report their mentions as unreachable, burying the fault under noise.
     So the cross-content half of the scene pass runs only against real
     content. Shape checks on the scenes themselves always run. */
  const crossContent = !override.recipes && !override.research;

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
    need(r, 'craft', 'number', 'recipes.js', r.id);
    /* `craft` is the skill premium ON TOP of the parts, so a negative one
       means the dish bills less than what went into it — the bill would
       read as if the shop were paying the customer for the difficulty. */
    if (typeof r.craft === 'number' && r.craft < 0) {
      errors.push(`recipes.js — "${r.id}" has a negative craft (${r.craft}). ` +
                  `craft is the skill premium added to the parts, so it cannot be below zero.`);
    }
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
    need(ing, 'sell', 'number', 'ingredients.js', ing.id);
    /* Buying a thing for more than the dish it goes into earns is how a
       shop quietly bleeds money on its best-looking recipe. */
    if (typeof ing.cost === 'number' && typeof ing.sell === 'number' &&
        ing.sell <= ing.cost / 10) {
      warnings.push(`ingredients.js — "${ing.id}" sells for ${ing.sell} a serving but ` +
                    `costs ${(ing.cost / 10).toFixed(1)} a serving; there is no margin in it.`);
    }
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

  /* A repeated ingredient bills asymmetrically: a second flour is skipped
     (it is the pancake, billed by the stack) while a second butter adds
     another line and another charge. Whichever the author meant, one of
     the two is wrong, and nothing else would ever say so. */
  for (const r of recipes) {
    const seen = new Set(), dupes = new Set();
    for (const id of r.ingredients || []) {
      if (seen.has(id)) dupes.add(id);
      seen.add(id);
    }
    if (dupes.size) {
      warnings.push(`recipes.js — "${r.id}" lists ${[...dupes].map(d => `"${d}"`).join(', ')} more ` +
                    `than once. The bill charges a repeated ingredient twice but ignores a ` +
                    `repeated base, so the two cases disagree. List it once.`);
    }
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

  /* THE BASE INGREDIENT. billFor() skips it because the pancakes are
     already billed by the stack, so if this stops naming a real ingredient
     nothing is skipped and EVERY dish in the game quietly bills its base
     twice, with a plausible extra line on the receipt. Renaming an
     ingredient means editing ingredients.js and recipes.js — both of which
     are checked — and this third place, which was not. */
  if (crossContent) {
    const base = TUNING.baseIngredient;
    if (!ingIds.has(base)) {
      errors.push(`economy.js — TUNING.baseIngredient is "${base}", which is not an ingredient. ` +
                  `Every recipe would bill its base twice.`);
    } else {
      const without = recipes.filter(r => !(r.ingredients || []).includes(base));
      if (without.length) {
        warnings.push(`recipes.js — ${without.map(r => `"${r.id}"`).join(', ')} do not contain ` +
                      `"${base}", the ingredient billed as the pancakes themselves.`);
      }
    }
  }

  // --- syrups and tastes: the pairing is only as good as its data ---
  /* A syrup with no axes silently scores zero against everyone, so it
     looks discovered and pays nothing. A customer with no taste does the
     same from the other side. Neither throws. */
  for (const sy of syrups) {
    if (need(sy, 'axes', 'object', 'syrups.js', sy.id)) {
      for (const ax of AXES) need(sy, `axes.${ax}`, 'number', 'syrups.js', sy.id);
      for (const k of Object.keys(sy.axes)) {
        if (!AXES.includes(k)) {
          errors.push(`syrups.js — "${sy.id}" has an unknown axis "${k}". Valid axes are ${AXES.join(', ')}.`);
        }
      }
    }
  }

  for (const c of customers) {
    if (need(c, 'taste', 'object', 'customers.js', c.id)) {
      for (const ax of AXES) need(c, `taste.${ax}`, 'number', 'customers.js', c.id);
    }
  }

  /* A syrup nobody has much time for is a discovery that pays nothing —
     the player spends the bench's ingredients on it and gets a name. A
     warning rather than an error: it may be deliberate flavour. */
  if (crossContent) {
    const dist = (a, b) => AXES.reduce((d, ax) => d + Math.abs((a[ax] || 0) - (b[ax] || 0)), 0);
    for (const sy of syrups) {
      if (!sy.axes) continue;
      let best = 0;
      for (const c of customers) {
        if (!c.taste) continue;
        best = Math.max(best, Math.max(0, 1 - dist(sy.axes, c.taste) / 20));
      }
      if (best < 0.5) {
        warnings.push(`syrups.js — no customer scores "${sy.id}" above ${best.toFixed(2)}; ` +
                      `discovering it would never pay off for anyone.`);
      }
    }
  }

  // --- scenes: the story is content too, and it was never checked ---
  /* Every failure in here is SILENT. A mention pointing at a renamed
     recipe does not crash — she simply mentions something the player can
     never serve back to her, and the arc's best beat quietly stops
     firing. That is exactly the class of bug this project keeps shipping,
     so it gets a validator rule rather than trust. */
  const sceneIds = new Set(Object.keys(scenes));

  for (const [id, node] of Object.entries(scenes)) {
    if (!node || typeof node !== 'object') {
      errors.push(`scenes.js — "${id}" is not a scene object.`);
      continue;
    }
    if (typeof node.text !== 'string' || !node.text.trim()) {
      errors.push(`scenes.js — "${id}" has no text, so it renders as an empty speech box.`);
    }

    if (node.next !== undefined && !sceneIds.has(node.next)) {
      errors.push(`scenes.js — "${id}" continues to "${node.next}", which does not exist. ` +
                  `The player gets a "Skipping ahead" notice instead of the scene.`);
    }

    for (const c of node.choices || []) {
      if (!c || !c.text) {
        errors.push(`scenes.js — a choice in "${id}" has no text, so it is dropped from the screen.`);
        continue;
      }
      if (!c.next) {
        errors.push(`scenes.js — choice "${c.text}" in "${id}" has no next node.`);
      } else if (!sceneIds.has(c.next)) {
        errors.push(`scenes.js — choice "${c.text}" in "${id}" leads to "${c.next}", which does not exist.`);
      }
      if (c.affection !== undefined && typeof c.affection !== 'number') {
        errors.push(`scenes.js — choice "${c.text}" in "${id}" has a non-numeric affection value.`);
      }
    }

    if (!node.next && !node.end && !(node.choices || []).length) {
      warnings.push(`scenes.js — "${id}" has no next, no choices and is not marked end; ` +
                    `it will show "This scene has no ending" and skip.`);
    }

    // THE LISTENING BEAT. A mention must name a real, obtainable dish.
    if (node.mentions !== undefined && crossContent) {
      if (!recipeIds.has(node.mentions)) {
        errors.push(`scenes.js — "${id}" has her mention "${node.mentions}", which is not a recipe. ` +
                    `She would ask for something that cannot exist, and the listening bonus ` +
                    `— roughly half the affection arc — would never pay out.`);
      } else {
        const r = recipes.find(x => x.id === node.mentions);
        const unlockable = r.unlockedAtStart ||
          research.some(n => n.unlocks && n.unlocks.recipe === r.id);
        if (!unlockable) {
          errors.push(`scenes.js — she mentions "${node.mentions}", but no research node unlocks it ` +
                      `and it is not available at start, so the player can never serve it back to her.`);
        }
      }
    }
  }

  // --- affection tiers: every tier needs a full row of presentation ---
  for (const tier of TIER_ORDER) {
    if (typeof TIER_THRESHOLDS[tier] !== 'number') {
      errors.push(`affection.js — tier "${tier}" has no numeric threshold, so tierFor() can never return it.`);
    }
    if (typeof TIER_EXPRESSION[tier] !== 'string') {
      errors.push(`affection.js — tier "${tier}" has no expression; her sprite would fail to load at that tier.`);
    }
    if (typeof TIER_POSE[tier] !== 'string') {
      warnings.push(`affection.js — tier "${tier}" has no pose.`);
    }
  }
  const ordered = TIER_ORDER.map(t => TIER_THRESHOLDS[t]);
  for (let i = 1; i < ordered.length; i++) {
    if (!(ordered[i] > ordered[i - 1])) {
      errors.push(`affection.js — TIER_ORDER is not strictly ascending at "${TIER_ORDER[i]}" ` +
                  `(${ordered[i - 1]} then ${ordered[i]}); tierFor() would skip a tier entirely.`);
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
