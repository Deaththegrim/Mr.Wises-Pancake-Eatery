import { tierFor } from './affection.js';
import { TIER_ORDER } from '../data/affection.js';

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
