/* SYNTHIA'S ARC.

   The player NEVER sees these numbers. No meter, no hearts, no bar — a
   visible bar turns a slow burn into a grind target and kills it.
   The arc is expressed through her default expression, how long she
   lingers, and what she says. The player should feel the change before
   they can name it.

   Affection can stall. It can never fall. This is a cozy game.

   Expression keys below are real files in
   ~/vault/projects/god-synthia/assets/sprites/synthia_casual/ (29 sprites).
   Verified on disk 2026-09-05. Note there is no c_smug.png in this set —
   the VN aliases smug to c_wink.png. */

export const TIER_ORDER = ['STRANGER', 'REGULAR', 'FAMILIAR', 'CONFIDANT', 'DEVOTED'];

/* Tuned against the actual grant economy, not guessed. Over 8 weeks:
     showing up ................ 16   (2/week, and UNAVOIDABLE — see below)
     serving her well weekly ... 24   (3/week)
     dialogue choices ...........  2   (one node in the whole game offers
                                       an affection choice, and pays once)
     ------------------------------------------
     everything except listening 42
     each listening catch ...... +8   (five mentions exist, so up to +40)

   So DEVOTED at 70 is DELIBERATELY unreachable without the listening
   mechanic. A player who never notices what she mentions tops out at
   CONFIDANT no matter how well they cook. That makes paying attention
   mechanically necessary rather than merely flavourful — which is the
   whole point of the arc. Do not raise the other grants past this
   without moving DEVOTED too. */
/* REGULAR sits above 16 on purpose. Showing up is granted every week and
   cannot be declined, so a finished eight-week game ALWAYS carries at
   least 16 points — which meant the STRANGER ending, and the whole
   bottom of this ladder, could never be reached by anyone who played to
   the end. Five endings were authored and one of them was unreachable.

   The floor a completed game produces must therefore fall inside
   STRANGER, not above it. tests/ending.test.js asserts every tier is
   reachable from real play, so moving any grant without moving these
   will fail rather than quietly orphaning an ending again. */
export const TIER_THRESHOLDS = {
  STRANGER: 0,
  REGULAR: 18,
  FAMILIAR: 30,
  CONFIDANT: 50,
  DEVOTED: 70
};

export const TIER_EXPRESSION = {
  STRANGER: 'neutral',
  REGULAR: 'curious',
  FAMILIAR: 'thinking',
  CONFIDANT: 'happy',
  DEVOTED: 'love'
};

/* How long she lingers, as an activity pose. The spec asks for the arc to
   show in how long she stays; these are the art for it, and it already
   exists. At STRANGER she stands in the doorway; by DEVOTED she has sat
   down with a coffee. */
/* AUTHORED AHEAD OF THE ART PASS — nothing renders these yet.

   How long she lingers, as an activity: at STRANGER she is in the
   doorway; by DEVOTED she has sat down with a coffee. It is here so the
   arc's staging is decided with the writing rather than invented later,
   and it names the sprite variant to draw for each tier.

   The engine helper that read this, and its re-export through ui/vn.js,
   were called by nothing and have been removed — dead plumbing reads like
   wiring that works. This is a note for the artist, and it should stay
   one until something actually draws it. */
export const TIER_POSE = {
  STRANGER: 'cpose_front',
  REGULAR: 'cpose_q_front',
  FAMILIAR: 'cact_pockets',
  CONFIDANT: 'cact_coffee',
  DEVOTED: 'cact_sitting'
};

export const GRANTS = {
  // Showing up is the courtship. Awarded every week the shop opened.
  weeklyPersistence: 2,
  // Serving HER something good. Scaled by quality/100.
  qualityServedMax: 3,
  // She mentioned something in passing; weeks later you researched it and
  // served it, unprompted. This is the arc's best beat — keep it large.
  listening: 8,
  // Dialogue choices carry their own value in scenes.js.
  choiceDefault: 1
};
