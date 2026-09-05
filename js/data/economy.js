/* ECONOMY — the quota curve and every tuning constant.
   These numbers are placeholders and are expected to be wrong. Tune them
   from play. Nothing here is referenced by name outside engine/economy.js
   and engine/day.js, so changing a value is always safe. */

/* Week 1 is deliberately trivial (soft onboarding). The curve escalates
   steeply early, while income is still compounding, then FLATTENS — because
   income itself plateaus once traffic caps and demand has fully shifted
   upmarket. A curve that keeps doubling past that point is unreachable by
   any amount of effort, which is what the first draft got wrong.

   Calibrated with `node tools/simulate.js` (2026-09-05, after the content
   expansion and the research-cost rescale):

     sloppy player ......................... 3/8 quotas, 4 of 13 research
     careful player ........................ 6/8 quotas, 13 of 13 research

   Week 6 is cleared by 266 and week 7 missed by 688 — near-misses on both
   sides, which is the shape to preserve. Missing by a hair is far more
   motivating than missing by a mile, and nobody ever fails: a missed quota
   is a Synthia scene.

   NOTE, corrected: narrowing the menu is a strong play EARLY but is no
   longer the late-game lever. Once enough recipes exist, `demandShift()`
   already steers customers toward your expensive dishes on its own, so
   restricting the menu just loses customers whose tags do not match. The
   late-game lever is the research tree — unlocking higher-base recipes.

   RE-RUN THE SIMULATOR after changing any of this. tests/balance.test.js
   will also fail if the shape breaks.

   RAISED when syrup pairing landed: pouring a syrup that suits the
   customer is worth up to +25% on the payout, which is a real income
   lever the old curve knew nothing about. Left alone, a careful player
   cleared all eight weeks and the quota stopped being a decision. */
export const QUOTA_CURVE = [300, 1000, 2600, 5200, 9000, 13500, 18500, 24000];

export const TUNING = {
  // Diminishing returns: each repeat of the same recipe in one day earns
  // this much less, never dropping below the floor. Soft, uncapped.
  repeatPenaltyStep: 0.12,
  repeatPenaltyFloor: 0.45,

  // Quality 0-100 maps onto this payout multiplier range.
  payoutMinMultiplier: 0.5,

  /* SYRUP PAIRING. A syrup matching the customer's taste multiplies the
     payout by up to 1 + syrupMatchBonus and adds up to syrupMatchReputation
     to the reputation gain. A mismatch scores zero and is simply ordinary —
     never a penalty, so discovering a syrup can only ever help.
     syrupMatchRange is the Manhattan distance across the four axes at
     which a syrup stops counting as "theirs" at all (worst case is 40). */
  syrupMatchBonus: 0.25,
  syrupMatchReputation: 0.6,
  syrupMatchRange: 20,
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
  benchFailPoints: 1,            // a failed experiment ALWAYS pays this

  /* Stock is bought in UNITS and spent in SERVINGS. One unit is a bulk
     quantity — a sack of flour, a jug of cream — and it makes this many
     pancakes. The bench, by contrast, burns a WHOLE UNIT per ingredient:
     experimenting is wasteful, which is what keeps it an expensive habit
     while cooking stays profitable.

     This is also what makes cost-of-goods real. The Impossible Stack sells
     for a lot AND costs a lot to make, because Bottled Starlight is 320 a
     unit. Cheap dishes have thin margins you make up on volume. */
  servingsPerUnit: 10,

  /* Running out mid-service does NOT turn a customer away — that would be
     a chill game punishing you for a planning mistake. You buy emergency
     stock at this multiple of the normal price instead, so bad restocking
     costs margin rather than the sale. */
  emergencyMarkup: 2
};
