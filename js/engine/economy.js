import { QUOTA_CURVE, TUNING } from '../data/economy.js';
import { ingredientById } from './lookup.js';
import { matchLabel, payoutBonus } from './syrup.js';

export function quotaForWeek(week) {
  if (!Number.isInteger(week) || week < 1) throw new Error(`week must be a positive integer, got ${week}`);
  if (week <= QUOTA_CURVE.length) return QUOTA_CURVE[week - 1];
  // Past the authored curve, keep the same ratchet going.
  const last = QUOTA_CURVE[QUOTA_CURVE.length - 1];
  const prev = QUOTA_CURVE[QUOTA_CURVE.length - 2] || last / 2;
  const ratio = last / prev;
  return Math.round(last * Math.pow(ratio, week - QUOTA_CURVE.length));
}

export function qualityMultiplier(quality) {
  const q = Math.max(0, Math.min(100, quality)) / 100;
  const { payoutMinMultiplier: lo, payoutMaxMultiplier: hi } = TUNING;
  return lo + (hi - lo) * q;
}

/* Diminishing returns within a single day. Soft and uncapped — the player
   feels the nudge toward variety without hitting a wall. */
export function repeatMultiplier(repeatCount) {
  const m = 1 - TUNING.repeatPenaltyStep * repeatCount;
  return Math.max(TUNING.repeatPenaltyFloor, m);
}

/* THE BILL.

   A dish is priced from its parts, the way a shop actually bills: so many
   pancakes at the going rate, a line for each thing that went into them, a
   line for the syrup, and a line for the skill. The player can read what
   they earned instead of being handed one number.

   It also makes the research grind pay legibly — a dish you unlocked has
   more, and dearer, parts on its bill, so the reason it earns more is
   visible on the receipt rather than buried in a `base` constant.

   `craft` is the part a bill of materials cannot express: a Souffle is two
   pancakes and cheap ingredients, and it sells for 45 because it is hard.
   Pricing purely by parts would make the most difficult dish in the game
   one of the cheapest.

   Returns line items AND the total, from the one function, so the receipt
   the player reads can never disagree with the money the till takes. */
export function billFor(recipe, opts = {}) {
  const { quality = 100, repeatCount = 0, syrup = null, syrupScore = 0 } = opts;
  const lines = [];

  const each = TUNING.pricePerPancake;
  lines.push({
    label: `${recipe.stackCount} ${recipe.stackCount === 1 ? 'pancake' : 'pancakes'}`,
    detail: `@ ${each}`,
    amount: recipe.stackCount * each
  });

  /* Flour is the pancake itself and is already billed above; charging for
     it again would double-bill every dish in the game. */
  for (const id of recipe.ingredients) {
    if (id === TUNING.baseIngredient) continue;
    const ing = ingredientById(id);
    if (!ing) continue;
    lines.push({ label: ing.name, amount: Number(ing.sell) || 0 });
  }

  if (recipe.craft > 0) lines.push({ label: 'skill', amount: recipe.craft });

  const subtotal = lines.reduce((a, l) => a + l.amount, 0);

  /* Quality and repetition adjust the whole bill, so they are shown as
     adjustments to the subtotal rather than as another item sold. */
  const qm = qualityMultiplier(quality);
  const rm = repeatMultiplier(repeatCount);
  let total = subtotal * qm * rm;

  const qAdjust = Math.round(subtotal * (qm - 1));
  if (qAdjust !== 0) {
    lines.push({ label: quality >= 100 ? 'made perfectly' : `made ${Math.round(quality)}%`, amount: qAdjust, adjustment: true });
  }
  if (rm < 1) {
    lines.push({ label: `${ordinal(repeatCount + 1)} today`, amount: Math.round(subtotal * qm * (rm - 1)), adjustment: true });
  }

  if (syrup) {
    const syrupAmount = payoutBonus(total, syrupScore);
    /* The verdict rides on the bill's own line. It is the only place the
       player ever learns what a customer's taste is — spec: "its full
       effect is revealed by serving it to a customer". */
    lines.push({ label: `${syrup.name} — ${matchLabel(syrupScore)}`, amount: syrupAmount, adjustment: true });
    total += syrupAmount;
  }

  return { lines, subtotal, total: Math.round(total) };
}

const ORDINALS = ['first', 'second', 'third'];
const ordinal = n => ORDINALS[n - 1] || `${n}th`;

/* What a dish is worth before anything is cooked. Used to sort the menu by
   value for the demand shift, and to check a dish is worth making at all. */
export function priceOf(recipe) {
  return billFor(recipe).subtotal;
}

export function payoutFor(recipe, quality, repeatCount = 0, syrup = null, syrupScore = 0) {
  return billFor(recipe, { quality, repeatCount, syrup, syrupScore }).total;
}

export function tipFor(basePayout, quality) {
  if (quality < TUNING.tipThreshold) return 0;
  const span = 100 - TUNING.tipThreshold;
  const t = span === 0 ? 1 : (quality - TUNING.tipThreshold) / span;
  return Math.round(basePayout * TUNING.maxTipRate * t);
}

/* Reputation rises with quality and NEVER falls. A bad day stalls it;
   it does not undo weeks of work. */
export function reputationGain(quality) {
  return Math.max(0, quality * TUNING.reputationPerQuality);
}

/* The quota is the story metronome, not a survival threshold. rollWeek
   REPORTS the outcome and mutates nothing. The caller decides which
   scene to fire. */
export function rollWeek(state) {
  const quota = quotaForWeek(state.week);
  return {
    met: state.weekEarnings >= quota,
    quota,
    earned: state.weekEarnings,
    week: state.week
  };
}
