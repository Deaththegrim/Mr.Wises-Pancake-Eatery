import { TIER_ORDER, TIER_THRESHOLDS, TIER_EXPRESSION, TIER_POSE, GRANTS } from '../data/affection.js';

export function tierFor(points) {
  let current = TIER_ORDER[0];
  for (const tier of TIER_ORDER) {
    if (points >= TIER_THRESHOLDS[tier]) current = tier;
  }
  return current;
}

export function expressionFor(points) {
  return TIER_EXPRESSION[tierFor(points)];
}

/* How long she lingers, rendered as an activity pose. At STRANGER she
   stands in the doorway; by DEVOTED she has sat down with a coffee. */
export function poseFor(points) {
  return TIER_POSE[tierFor(points)];
}

/* Affection can stall. It can never fall. A negative grant is a bug at the
   call site, so it is ignored rather than honoured. */
export function grant(synthia, amount, reason) {
  if (amount > 0) {
    synthia.points += amount;
    synthia.log.push({ amount, reason });
  }
  return synthia.points;
}

export function grantWeekly(synthia) {
  return grant(synthia, GRANTS.weeklyPersistence, 'you kept the shop open');
}

export function grantForServing(synthia, quality) {
  const amount = Math.round((Math.max(0, Math.min(100, quality)) / 100) * GRANTS.qualityServedMax);
  return grant(synthia, amount, 'you served her something good');
}

/* She mentions things in passing. Tagged on a dialogue node in data/scenes.js. */
export function noteMention(synthia, tag) {
  if (!synthia.mentions.includes(tag)) synthia.mentions.push(tag);
}

/* The arc's best beat. She mentioned something weeks ago; you went and
   researched it, unprompted, and served it. She notices. Once. */
export function checkListening(synthia, servedRecipeId) {
  const wasMentioned = synthia.mentions.includes(servedRecipeId);
  const alreadyNoticed = synthia.noticed.includes(servedRecipeId);
  if (!wasMentioned || alreadyNoticed) return { noticed: false, bonus: 0 };
  synthia.noticed.push(servedRecipeId);
  grant(synthia, GRANTS.listening, `she mentioned ${servedRecipeId}, and you remembered`);
  return { noticed: true, bonus: GRANTS.listening };
}
