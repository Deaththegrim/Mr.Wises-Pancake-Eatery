import { makeRng, pick } from './rng.js';
import { scoreDish } from './cook.js';
import { payoutFor, tipFor, reputationGain, rollWeek, priceOf, billFor } from './economy.js';
import { grantWeekly, grantForServing, checkListening } from './affection.js';
import { CUSTOMERS } from '../data/customers.js';
import { TUNING } from '../data/economy.js';
import { payForCooking } from './pantry.js';
import { endingFor, synthiaDueToday } from './story.js';
import { QUOTA_CURVE } from '../data/economy.js';
import { matchScore, syrupById } from './syrup.js';
import { recipeById } from './lookup.js';

const DAYS_PER_WEEK = 7;

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

  /* She comes in once a week, as an actual customer you cook for. This is
     what makes serving her — and the listening beat — reachable at all. */
  if (synthiaDueToday(state) && !state.synthiaServedToday) {
    const rng = makeRng(state.seed + state.week * 13 + state.day);
    const menu = state.menu.map(recipeById).filter(Boolean);
    if (menu.length) {
      /* THE LISTENING LOOP, CLOSED. If she has mentioned something in
         passing and it is now on the menu — because the player heard her,
         researched it over weeks, and put it out — that is what she asks
         for. Anything else makes the payoff a coincidence: previously she
         ordered whatever was priciest, so a player who did everything
         right still only reached DEVOTED on 2 of 10 seeds, and had no way
         to serve her the dish deliberately.

         Skips what she has already noticed, so each mention pays once and
         she keeps moving through her list rather than re-ordering a
         favourite forever. */
      const remembered = menu.find(r =>
        state.synthia.mentions.includes(r.id) && !state.synthia.noticed.includes(r.id));

      /* IMPOSSIBLE ORDER (spec §9). If she has mentioned something the
         player has NOT unlocked, she asks for it first — and is unbothered
         when it is not there. It turns a line of dialogue into a visible
         research goal, which is how her presence drives progression
         between story beats.

         It rides ALONGSIDE her real order rather than replacing it. She
         comes in once a week, so an ask that consumed the visit would cost
         the player that week's serving grant and the listening chance:
         the arc would get WORSE the more she wanted, which inverts the
         entire point. She is deadpan about it, not walking out — she still
         wants breakfast.

         Asked at most once per dish, so she works through her list. */
      const wanted = state.synthia.wanted || (state.synthia.wanted = []);
      const impossibleAsk = remembered ? null : state.synthia.mentions.find(id =>
        !state.unlockedRecipes.includes(id) && !wanted.includes(id) && recipeById(id));
      if (impossibleAsk) wanted.push(impossibleAsk);

      // Otherwise: the most interesting thing on offer.
      const best = [...menu].sort((a, b) => priceOf(b) - priceOf(a));
      const pick = remembered || best[Math.floor(rng() * Math.min(2, best.length))];
      state.orderIndex = (state.orderIndex || 0) + 1;
      return {
        isSynthia: true,
        impossibleAsk: impossibleAsk || null,
        customer: { id: 'synthia', name: 'God Synthia',
                    // Rich and strange: nightmilk is hers. Nobody else's best.
                    taste: { sweet: 7, sharp: 2, rich: 8, strange: 9 },
                    lines: { greeting: 'Something worth the walk.', happy: 'Hm.', disappointed: 'Hm.' } },
        recipeId: pick.id
      };
    }
  }
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
  const byValue = [...choices].sort((a, b) => priceOf(a) - priceOf(b));
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
  state.synthiaServedToday = false;
  state.todayServed = {};
  state.orderIndex = 0;
  state.dayEarnings = 0;
}

export function serve(state, recipeId, beats, opts = {}) {
  const recipe = recipeById(recipeId);
  if (!recipe) throw new Error(`Unknown recipe: ${recipeId}`);

  // Ingredients come off the shelf before the pancake exists.
  const { ingredientCost, emergencyCost } = payForCooking(state, recipe.ingredients);

  const repeatCount = state.todayServed[recipeId] || 0;
  const { quality, breakdown } = scoreDish(recipe, beats, state.upgrades);

  /* THE SYRUP PAIRING. A syrup suited to this customer pays more and
     builds reputation faster; anything else is simply ordinary. Computed
     here rather than in the UI so the simulator cannot drift from the
     shipped game — which is exactly how research points came to be
     awarded by tools/simulate.js and by nothing the player ever ran. */
  const syrup = opts.syrupId ? syrupById(opts.syrupId) : null;
  const syrupScore = syrup ? matchScore(syrup, opts.taste) : 0;

  // The itemised bill. Same call produces the receipt and the takings.
  const bill = billFor(recipe, { quality, repeatCount, syrup, syrupScore });
  const payout = bill.total;
  const tip = tipFor(payout, quality);

  state.todayServed[recipeId] = repeatCount + 1;
  state.cooked[recipeId] = (state.cooked[recipeId] || 0) + 1;
  state.money += payout + tip;
  state.weekEarnings += payout + tip;
  state.dayEarnings = (state.dayEarnings || 0) + payout + tip;
  state.reputation += reputationGain(quality) + syrupScore * TUNING.syrupMatchReputation;

  /* RESEARCH POINTS. These used to be awarded only in tools/simulate.js,
     so the shipped game granted none at all: the tree costs ~1,130 points
     and the bench pays about 230 over eight weeks, which left recipes
     locked, income flat from week 3, and the game unwinnable from week 4.
     The balance tests could not see it because they asserted against the
     simulator, which paid the points itself.

     Awarding here — inside the one function both main.js and simulate.js
     call — is what stops that divergence recurring. */
  const firstEver = (state.cooked[recipeId] || 0) === 1;   // set just above
  let pointsEarned = 0;
  if (firstEver) pointsEarned += TUNING.pointsPerNewRecipeServed;
  if (quality >= TUNING.highQualityAt) pointsEarned += TUNING.pointsPerHighQuality;
  state.points += pointsEarned;

  let noticed = false;
  if (opts.forSynthia) {
    state.synthiaServedToday = true;
    grantForServing(state.synthia, quality);
    noticed = checkListening(state.synthia, recipeId).noticed;
  }

  return { quality, breakdown, payout, tip, noticed, ingredientCost, emergencyCost, pointsEarned,
           syrupId: opts.syrupId || null, syrupScore, bill };
}

/* The story runs as long as the quota curve is authored. Past that the
   game would extrapolate quotas forever with no conclusion, which is what
   it did before this existed. */
export function isFinalWeek(state) {
  return state.week >= QUOTA_CURVE.length;
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

  if (!weekResult.met) state.missCount = (state.missCount || 0) + 1;

  // The last authored week ends the story.
  const final = isFinalWeek(state) && !state.ended;
  if (final) {
    state.ended = true;
    // Persist which ending was earned, so reloading a finished save shows
    // the right one rather than defaulting.
    state.endingId = endingFor(state.synthia.points);
    state.week += 1;
    state.day = 1;
    state.weekEarnings = 0;
    return {
      dayEarnings, weekRolled: true, weekResult,
      ended: true, ending: state.endingId
    };
  }

  state.week += 1;
  state.day = 1;
  state.weekEarnings = 0;
  return { dayEarnings, weekRolled: true, weekResult };
}
