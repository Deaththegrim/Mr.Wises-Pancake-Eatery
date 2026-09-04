/* ECONOMY — the quota curve and every tuning constant.
   These numbers are placeholders and are expected to be wrong. Tune them
   from play. Nothing here is referenced by name outside engine/economy.js
   and engine/day.js, so changing a value is always safe. */

/* Week 1 is deliberately trivial (soft onboarding). The curve escalates
   steeply early, while income is still compounding, then FLATTENS — because
   income itself plateaus once traffic caps and demand has fully shifted
   upmarket. A curve that keeps doubling past that point is unreachable by
   any amount of effort, which is what the first draft got wrong.

   Calibrated with `node tools/simulate.js` (2026-09-05):

     sloppy player, sells everything ....... 2/8 quotas
     careful player, sells everything ...... 6/8 quotas
     careful player, CURATES THE MENU ...... 8/8 quotas

   That spread is the design working. Missing is never a failure — it fires
   a Synthia scene — so a sloppy player still finishes the story. The last
   two weeks are unreachable by execution alone and require the strategic
   choice of narrowing the menu to your best dish (worth ~62% more income).
   That is what makes the morning menu screen a real decision.

   RE-RUN THE SIMULATOR after changing any of this. */
export const QUOTA_CURVE = [300, 900, 2200, 4500, 7000, 9000, 10500, 12000];

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

  // Reputation's SECOND job (spec §6): more people come in as the shop
  // becomes known. This is the income scaler the quota curve is built
  // around, so changing it changes whether quotas are reachable — re-run
  // `node tools/simulate.js` after touching it.
  // customers/day = baseTraffic + trafficPerSqrtRep * sqrt(reputation),
  // capped, because a chill game must not become a clicking marathon.
  baseTraffic: 6,
  trafficPerSqrtRep: 0.9,
  maxTraffic: 18,

  // Reputation also shifts DEMAND upmarket. Below minRep customers only
  // want their usual; by fullRep they reliably order your best work.
  // This scales income without scaling how much the player has to click.
  demandShiftMinRep: 40,
  demandShiftFullRep: 400,

  // Research points.
  pointsPerNewRecipeServed: 3,
  pointsPerHighQuality: 1,       // awarded when quality >= highQualityAt
  highQualityAt: 85,
  benchFailPoints: 1             // a failed experiment ALWAYS pays this
};
