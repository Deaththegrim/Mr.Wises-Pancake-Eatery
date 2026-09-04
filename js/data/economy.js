/* ECONOMY — the quota curve and every tuning constant.
   These numbers are placeholders and are expected to be wrong. Tune them
   from play. Nothing here is referenced by name outside engine/economy.js
   and engine/day.js, so changing a value is always safe. */

// Week 1 is deliberately trivial (soft onboarding). Escalation is ~2.2x,
// which outpaces linear growth so week-1 tactics cannot simply be repeated.
export const QUOTA_CURVE = [300, 700, 1600, 3600, 8000, 18000, 40000, 90000];

export const TUNING = {
  // Diminishing returns: each repeat of the same recipe in one day earns
  // this much less, never dropping below the floor. Soft, uncapped.
  repeatPenaltyStep: 0.12,
  repeatPenaltyFloor: 0.45,

  // Quality 0-100 maps onto this payout multiplier range.
  payoutMinMultiplier: 0.5,
  payoutMaxMultiplier: 1.5,

  // Tips only start above this quality, then scale to maxTipRate of base.
  tipThreshold: 60,
  maxTipRate: 0.4,

  // Reputation gain per dish = quality * this. Never negative.
  reputationPerQuality: 0.02,

  // Research points.
  pointsPerNewRecipeServed: 3,
  pointsPerHighQuality: 1,       // awarded when quality >= highQualityAt
  highQualityAt: 85,
  benchFailPoints: 1             // a failed experiment ALWAYS pays this
};
