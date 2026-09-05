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
const MISS_SCENES = [
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
  const rng = makeRng(state.seed + state.week * 31);
  const herDay = 1 + Math.floor(rng() * 7);
  return state.day === herDay;
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
