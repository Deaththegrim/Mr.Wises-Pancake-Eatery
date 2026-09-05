import { TUNING } from '../data/economy.js';
import { syrupById } from './lookup.js';
import { AXES } from '../data/ingredients.js';

/* WHAT A SYRUP IS WORTH.

   Discovering a syrup used to change a number on the ledger and nothing
   else: no runtime code read a syrup's axes, and the drizzle beat did not
   know which syrup it was pouring. Since syrups are half of what the
   research tree hands out, that made half the grind pay in nothing —
   against a spec that says a syrup's full effect shows when you serve it.

   The rule: a syrup that suits the customer pays more. A syrup that does
   not is merely ordinary. There is no penalty, ever — a discovery should
   feel like gaining an option, never like a new way to lose money. */


export { syrupById };

/* 0 when the syrup is nothing like their taste, 1 when it is exactly it.
   Manhattan distance over four 0-10 axes, so the worst case is 40; the
   scale below treats anything past `syrupMatchRange` as simply "not for
   them" rather than letting a bad match run away into a big negative. */
export function matchScore(syrup, taste) {
  if (!syrup || !syrup.axes || !taste) return 0;
  let d = 0;
  for (const ax of AXES) d += Math.abs((Number(syrup.axes[ax]) || 0) - (Number(taste[ax]) || 0));
  return Math.max(0, 1 - d / TUNING.syrupMatchRange);
}

/* What a match is worth, in money and in reputation. Both take the SCORE
   rather than the ids: the caller has already computed it to bill the dish,
   and scoring it twice invites the two answers to drift.

   These used to take ids and be called by nothing but their own tests,
   while economy.js and day.js each re-typed the same formula inline. That
   put both syrup tuning constants in two spellings in two files — the exact
   pattern this project's history keeps producing, and the "tested but
   unreachable" shape that hid the research-points bug for a week. Now the
   live paths call these, so each constant is read in one place. */
export const payoutBonus = (total, score) =>
  Math.round(total * TUNING.syrupMatchBonus * Math.max(0, score));

export const reputationBonus = score =>
  Math.max(0, score) * TUNING.syrupMatchReputation;

/* What the player is choosing between. Sorted best-first so the UI can
   show a hint without doing its own scoring — the UI measures and
   displays; it never decides what something is worth. */
export function rankSyrups(unlockedIds, taste) {
  return unlockedIds
    .map(id => syrupById(id))
    .filter(Boolean)
    .map(s => ({ id: s.id, name: s.name, score: matchScore(s, taste) }))
    .sort((a, b) => b.score - a.score);
}

export function bestSyrupFor(unlockedIds, taste) {
  const ranked = rankSyrups(unlockedIds, taste);
  return ranked.length ? ranked[0].id : null;
}

/* Plain words for the drizzle screen. Deliberately vague at the low end:
   the player should learn a customer's taste by serving them, not read it
   off a number. Spec: "its full effect is revealed by serving it." */
export function matchLabel(score) {
  if (score >= 0.75) return 'exactly right';
  if (score >= 0.5) return 'a good fit';
  if (score >= 0.25) return 'passable';
  return 'not really theirs';
}

/* The syrup's own character, for the picker. This names a property of the
   thing the player OWNS — never the customer's hidden preference. The spec
   is explicit that a syrup's full effect is revealed by serving it, and the
   customers already telegraph themselves in their greetings ("something
   heavy", "something with fruit in it"). Printing the answer above the
   drizzle beat would turn a taste you learn into a number you read. */
export function characterOf(syrupOrId) {
  const s = typeof syrupOrId === 'string' ? syrupById(syrupOrId) : syrupOrId;
  if (!s || !s.axes) return '';
  let top = AXES[0];
  for (const ax of AXES) if ((Number(s.axes[ax]) || 0) > (Number(s.axes[top]) || 0)) top = ax;
  return top;
}
