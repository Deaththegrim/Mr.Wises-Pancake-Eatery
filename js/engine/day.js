import { makeRng, pick } from './rng.js';
import { scoreDish } from './cook.js';
import { payoutFor, tipFor, reputationGain, rollWeek } from './economy.js';
import { grantWeekly, grantForServing, checkListening } from './affection.js';
import { CUSTOMERS } from '../data/customers.js';
import { RECIPES } from '../data/recipes.js';
import { TUNING } from '../data/economy.js';

const DAYS_PER_WEEK = 7;
const recipeById = id => RECIPES.find(r => r.id === id);

/* Reputation's second job (spec §6): a better-known shop is busier.
   Capped, because a chill game must not become a clicking marathon —
   past the cap, income grows through DEMAND rather than volume. */
export function customersToday(state) {
  const t = TUNING.baseTraffic + TUNING.trafficPerSqrtRep * Math.sqrt(Math.max(0, state.reputation));
  return Math.min(TUNING.maxTraffic, Math.round(t));
}

/* Demand drifts upmarket as the shop's name spreads. At low reputation a
   customer orders the cheapest thing they want; by demandShiftFullRep they
   reliably order the best thing they want. This is the income scaler that
   does NOT cost the player extra clicks. Returns 0..1. */
export function demandShift(reputation) {
  const { demandShiftMinRep: lo, demandShiftFullRep: hi } = TUNING;
  if (reputation <= lo) return 0;
  if (reputation >= hi) return 1;
  return (reputation - lo) / (hi - lo);
}

export function customerPool(state) {
  return CUSTOMERS.filter(c => {
    const u = c.unlockAt || {};
    if (u.week !== undefined && state.week < u.week) return false;
    if (u.reputation !== undefined && state.reputation < u.reputation) return false;
    return true;
  });
}

/* Deterministic per (seed, week, day, order index) so tests and replays
   match. orderIndex advances on every call, so consecutive customers in
   one day differ. */
function dayRng(state) {
  return makeRng(state.seed + state.week * 1000 + state.day * 10 + (state.orderIndex || 0));
}

export function nextCustomer(state) {
  const pool = customerPool(state);
  if (pool.length === 0 || state.menu.length === 0) return null;
  const rng = dayRng(state);
  const customer = pick(rng, pool);
  const wanted = state.menu
    .map(recipeById)
    .filter(r => r && r.tags.some(t => customer.wants.includes(t)));

  const choices = wanted.length ? wanted : state.menu.map(recipeById).filter(Boolean);
  if (choices.length === 0) return null;

  /* Demand shift: sort what they'd accept by value, then bias the pick
     toward the expensive end as reputation rises. At shift 0 it is a flat
     random choice; at shift 1 they always take the best thing on offer. */
  const byValue = [...choices].sort((a, b) => a.base - b.base);
  const shift = demandShift(state.reputation);
  const roll = rng();
  const biased = Math.pow(roll, 1 - shift * 0.85);   // pushes the roll upward
  const idx = Math.min(byValue.length - 1, Math.floor(biased * byValue.length));
  const recipeId = byValue[idx].id;

  state.orderIndex = (state.orderIndex || 0) + 1;
  return { customer, recipeId };
}

export function openDay(state) {
  state.phase = 'service';
  state.todayServed = {};
  state.orderIndex = 0;
  state.dayEarnings = 0;
}

export function serve(state, recipeId, beats, opts = {}) {
  const recipe = recipeById(recipeId);
  if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);

  const repeatCount = state.todayServed[recipeId] || 0;
  const { quality, breakdown } = scoreDish(recipe, beats, state.upgrades);
  const payout = payoutFor(recipe, quality, repeatCount);
  const tip = tipFor(payout, quality);

  state.todayServed[recipeId] = repeatCount + 1;
  state.cooked[recipeId] = (state.cooked[recipeId] || 0) + 1;
  state.money += payout + tip;
  state.weekEarnings += payout + tip;
  state.dayEarnings = (state.dayEarnings || 0) + payout + tip;
  state.reputation += reputationGain(quality);

  let noticed = false;
  if (opts.forSynthia) {
    grantForServing(state.synthia, quality);
    noticed = checkListening(state.synthia, recipeId).noticed;
  }

  return { quality, breakdown, payout, tip, noticed };
}

export function closeDay(state) {
  const dayEarnings = state.dayEarnings || 0;
  state.phase = 'evening';

  if (state.day < DAYS_PER_WEEK) {
    state.day += 1;
    return { dayEarnings, weekRolled: false };
  }

  // Week rollover. The quota REPORTS; it never punishes.
  const weekResult = rollWeek(state);
  grantWeekly(state.synthia);      // showing up is the courtship
  state.week += 1;
  state.day = 1;
  state.weekEarnings = 0;
  return { dayEarnings, weekRolled: true, weekResult };
}
