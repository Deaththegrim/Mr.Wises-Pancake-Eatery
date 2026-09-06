import { tierFor } from './affection.js';
import { TIER_ORDER } from '../data/affection.js';
import { SCENES } from '../data/scenes.js';
import { makeRng } from './rng.js';

/* Which scene fires, and when.

   Kept out of day.js so the day loop stays about the day, and out of the
   UI so scene selection is testable. Everything here maps game state onto
   an id in data/scenes.js — it never contains any words itself, because
   the words are the collaborator's. */

/* The ending is chosen by how close she has become over the whole game.
   A player who never noticed her gets a different last scene than one who
   listened. This is the payoff the entire affection system exists for. */
const ENDING_BY_TIER = {
  STRANGER:  'ending_stranger',
  REGULAR:   'ending_regular',
  FAMILIAR:  'ending_familiar',
  CONFIDANT: 'ending_confidant',
  DEVOTED:   'ending_devoted'
};

export function endingFor(affectionPoints) {
  return ENDING_BY_TIER[tierFor(affectionPoints)] || ENDING_BY_TIER[TIER_ORDER[0]];
}

/* Missing a quota is a scene, not a failure — but a player who struggles
   can miss six weeks running, and hearing the identical line six times
   turns a kind mechanic into a broken record. The scenes escalate for the
   first few misses and then hold, so a bad run still feels acknowledged
   without needing infinite writing. */
export const MISS_SCENES = [
  'quota_missed_1',   // first time: she barely reacts
  'quota_missed_2',   // twice: she notices
  'quota_missed_3'    // three or more: she sits down
];

export function missSceneFor(missCount) {
  const i = Math.min(Math.max(1, missCount), MISS_SCENES.length) - 1;
  return MISS_SCENES[i];
}

/* SHE HAS TO ACTUALLY COME IN.

   The whole affection design — serving her, and the listening beat that
   reaching DEVOTED depends on — needs her to appear as a CUSTOMER, not
   only in the scenes at week boundaries. Without this the engine code for
   it is unit-tested and completely dead in the real game.

   Once a week, on a day that varies, so she stays unpredictable without
   becoming a fixture. */
export function synthiaDueToday(state) {
  const herDay = synthiaDay(state);
  if (state.day === herDay) return true;

  /* She waits. If her day came and went without her being served — the
     player closed up early, or abandoned the dish half-cooked — she comes
     back the next day instead of that week's visit silently evaporating.

     Without this, closing the shop early on one particular day cost the
     player a serving grant AND a listening catch, with nothing on screen
     saying she had been there at all. Affection is meant to stall, never
     to be quietly taken away, and "showing up is the courtship" cuts both
     ways: the shop being open is what she is turning up for. */
  return state.day > herDay && !(state.synthia.seenInWeek === state.week);
}

/* The day of the week she means to come. Deterministic per (seed, week). */
export function synthiaDay(state) {
  const rng = makeRng(state.seed + state.week * 31);
  return 1 + Math.floor(rng() * 7);
}

/* Something she says in passing, drawn from whatever she has not already
   mentioned. Returns null once she has said them all — the beat should
   stop rather than loop. */
export function mentionSceneFor(state) {
  const said = state.synthia.mentions || [];
  const available = Object.entries(SCENES)
    .filter(([, node]) => node.mentions && !said.includes(node.mentions))
    .map(([id]) => id);
  if (available.length === 0) return null;
  const rng = makeRng(state.seed + state.week * 977 + state.day);
  return available[Math.floor(rng() * available.length)];
}

/* SOMETHING TO SAY WHEN THERE IS NO GOAL LEFT TO PLANT.

   A mention has to name a research node the player has NOT bought yet —
   that is the whole beat: she says a thing in passing, you research it
   weeks later unprompted, and she notices. Measuring the run length turned
   up the consequence: there are five mentions, she says one a week, and
   every research node still unclaimed by one is bought by week 4. So in
   weeks 6, 7 and 8 she walked in and said NOTHING — and those are the
   weeks the player is most invested, with the tree completing, the shop
   finally affordable and her closest tier being crossed.

   A `visit: true` scene is her talking without planting anything. It fires
   only when no mention is left, so it can never take a mention's place,
   and each one is used once.

   There are none authored yet, deliberately: she is the collaborator's to
   write. This is the slot, empty, the same way the art and sound slots are
   empty — the mechanism exists so the writing can drop in without anyone
   touching the engine. See `research/run-length.md` for why this is where
   the gap is. */
export function visitSceneFor(state) {
  const seen = state.synthia.visited || [];
  const available = Object.entries(SCENES)
    .filter(([id, node]) => node.visit && !node.mentions && !seen.includes(id))
    .map(([id]) => id);
  if (available.length === 0) return null;
  const rng = makeRng(state.seed + state.week * 613 + state.day);
  return available[Math.floor(rng() * available.length)];
}

/* THE ENDING'S TITLE.

   Every ending scene carries its `endingTitle` one or two hops down the
   chain, not on the node the ending starts at, so finding it means
   walking. That walk lived in main.js — which no test can import, because
   it needs a DOM — and a rename there silently changed its condition to
   one that is always false. The walk stopped running and all five endings
   printed the same generic fallback: a devoted eight-week run and a
   stranger's were headed identically, which is the one line on that card
   that distinguishes them.

   It is pure logic over content, so it lives here where it can be tested. */
export function endingTitleFor(endingId) {
  let id = endingId, hops = 0;
  while (id && hops < 20) {
    const node = SCENES[id];
    if (!node) break;
    if (node.endingTitle) return node.endingTitle;
    id = node.next || (node.choices && node.choices[0] && node.choices[0].next);
    hops += 1;
  }
  return null;
}
