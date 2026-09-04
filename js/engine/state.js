import { META } from '../data/meta.js';
import { RECIPES } from '../data/recipes.js';
import { SYRUPS } from '../data/syrups.js';

const startingRecipes = () => RECIPES.filter(r => r.unlockedAtStart).map(r => r.id);
const startingSyrups  = () => SYRUPS.filter(s => s.unlockedAtStart).map(s => s.id);

export function newGame(seed = Date.now() % 2147483647) {
  const recipes = startingRecipes();
  return {
    version: META.saveVersion,
    seed,
    week: 1, day: 1, phase: 'morning',
    money: 0, weekEarnings: 0, dayEarnings: 0, reputation: 0,
    points: 0, purchased: [], cooked: {},
    unlockedRecipes: [...recipes],
    unlockedSyrups: startingSyrups(),
    upgrades: [],
    menu: [...recipes],
    todayServed: {},
    orderIndex: 0,
    synthia: { points: 0, mentions: [], noticed: [], log: [], lastVisitWeek: 0 },
    flags: {}
  };
}

export function serialize(state) {
  return JSON.stringify(state);
}

/* Tolerant by design. A stale or malformed save must produce a readable
   message or a repaired state — never a blank screen or a thrown error. */
export function deserialize(json) {
  let obj;
  try {
    obj = JSON.parse(json);
  } catch (e) {
    return { ok: false, reason: `Could not read the save file: ${e.message}` };
  }
  if (!obj || typeof obj !== 'object') {
    return { ok: false, reason: 'Could not read the save file: it is not an object.' };
  }
  if (obj.version > META.saveVersion) {
    return { ok: false, reason: `This save is from a newer version (${obj.version}) than this build (${META.saveVersion}).` };
  }

  const base = newGame(obj.seed);
  const state = { ...base, ...obj };

  // Repair sub-objects a partial or hand-edited save may be missing.
  state.synthia = { ...base.synthia, ...(obj.synthia || {}) };
  state.cooked = obj.cooked || {};
  state.todayServed = obj.todayServed || {};
  state.flags = obj.flags || {};

  // Drop ids that no longer exist in the content, with a warning.
  const validRecipes = new Set(RECIPES.map(r => r.id));
  const validSyrups = new Set(SYRUPS.map(s => s.id));
  const prune = (arr, valid, label) => (arr || []).filter(id => {
    if (valid.has(id)) return true;
    console.warn(`[save] dropping unknown ${label}: ${id}`);
    return false;
  });
  state.unlockedRecipes = prune(state.unlockedRecipes, validRecipes, 'recipe');
  state.unlockedSyrups = prune(state.unlockedSyrups, validSyrups, 'syrup');
  state.menu = prune(state.menu, validRecipes, 'menu recipe');

  // Never strand the player with nothing to cook or sell.
  if (state.unlockedRecipes.length === 0) state.unlockedRecipes = startingRecipes();
  if (state.menu.length === 0) state.menu = [...state.unlockedRecipes];

  state.version = META.saveVersion;
  return { ok: true, state };
}
