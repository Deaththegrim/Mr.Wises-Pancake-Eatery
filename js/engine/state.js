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
    pantry: {},
    orderIndex: 0,
    synthia: { points: 0, mentions: [], noticed: [], wanted: [], log: [], lastVisitWeek: 0 },
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
  state.pantry = obj.pantry || {};

  /* Coerce the numeric scalars. deserialize() promises above that a stale or
     hand-edited save "must produce a readable message or a repaired state —
     never a blank screen or a thrown error", but it only ever pruned ids.
     quotaForWeek() is strict, so a save with week 0, week 1.5, or a
     STRINGIFIED week (what any JSON round-trip produces) passed validation
     here and then threw on the first render — leaving Continue as a
     permanently dead button. The live state object is exposed on the page
     for hand-editing, so this is a save a curious player will produce. */
  const num = (v, fallback, label) => {
    const n = Number(v);
    if (!Number.isFinite(n)) {
      console.warn(`[save] ${label} was ${JSON.stringify(v)}; using ${fallback}`);
      return fallback;
    }
    return n;
  };
  state.week = Math.max(1, Math.round(num(obj.week, 1, 'week')));
  state.day = Math.min(7, Math.max(1, Math.round(num(obj.day, 1, 'day'))));
  state.money = Math.max(0, num(obj.money, 0, 'money'));
  state.weekEarnings = Math.max(0, num(obj.weekEarnings, 0, 'weekEarnings'));
  state.reputation = Math.max(0, num(obj.reputation, 0, 'reputation'));
  state.points = Math.max(0, num(obj.points, 0, 'points'));
  state.synthia.points = Math.max(0, num((obj.synthia || {}).points, 0, 'affection'));

  // Drop ids that no longer exist in the content, with a warning.
  const validRecipes = new Set(RECIPES.map(r => r.id));
  const validSyrups = new Set(SYRUPS.map(s => s.id));
  const prune = (arr, valid, label) => (arr || []).filter(id => {
    if (valid.has(id)) return true;
    console.warn(`[save] dropping unknown ${label}: ${id}`);
    return false;
  });
  state.unlockedRecipes = prune(state.unlockedRecipes, validRecipes, 'recipe');
  /* The dishes she has asked for. Pruned like every other id list: a
     removed recipe would otherwise sit in here forever, matching no
     research node and marking nothing on the board. Harmless, but this
     module's whole contract is that a save never carries ids the content
     no longer has. */
  state.synthia.wanted = prune(state.synthia.wanted, validRecipes, 'dish she asked for');
  state.synthia.mentions = prune(state.synthia.mentions, validRecipes, 'dish she mentioned');
  state.synthia.noticed = prune(state.synthia.noticed, validRecipes, 'dish she noticed');
  state.unlockedSyrups = prune(state.unlockedSyrups, validSyrups, 'syrup');
  state.menu = prune(state.menu, validRecipes, 'menu recipe');

  // Never strand the player with nothing to cook or sell.
  if (state.unlockedRecipes.length === 0) state.unlockedRecipes = startingRecipes();
  if (state.menu.length === 0) state.menu = [...state.unlockedRecipes];

  state.version = META.saveVersion;
  return { ok: true, state };
}
