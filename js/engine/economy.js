import { QUOTA_CURVE, TUNING } from '../data/economy.js';

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

export function payoutFor(recipe, quality, repeatCount = 0) {
  return Math.round(recipe.base * qualityMultiplier(quality) * repeatMultiplier(repeatCount));
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
