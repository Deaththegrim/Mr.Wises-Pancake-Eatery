/* SYRUPS.
   axes    : what the FINISHED syrup tastes like when used on a dish
   discover: present only if it must be FOUND at the bench.
             target = the BLEND the player must hit at the bench,
             tolerance = how close counts,
             tier   = rough difficulty band, used for directional hints.

   IMPORTANT — axes and discover.target are different things and are NOT
   required to match. The bench AVERAGES its ingredients, so a blend can
   never be more intense than its strongest ingredient. A finished syrup
   can be, because cooking it down concentrates it. Mild inputs, intense
   output. That is why salted caramel is discovered from a gentle blend
   (maple + butter + salt) but tastes strong.

   PRACTICAL CONSEQUENCE: a discover.target must sit inside the range the
   ingredient list can actually average to, or the syrup is permanently
   undiscoverable. `node tools/validate.js` checks this for you — it
   brute-forces every 2- and 3-ingredient combination and tells you if a
   target is unreachable, and by how much. Always run it after adding one.

   Every target below was computed FROM a real blend rather than guessed,
   and the intended recipe is noted so the fiction and the mechanics agree.
   Tolerance widens with tier so that late discoveries are found by
   reasoning rather than by luck. */

export const SYRUPS = [
  { id: 'maple_syrup', name: 'Maple Syrup', cost: 3, unlockedAtStart: true,
    axes: { sweet: 8, sharp: 1, rich: 5, strange: 0 } },

  // tier 1 — cheap staples, findable in the first week or two
  { id: 'lemon_glaze', name: 'Lemon Glaze', cost: 4, unlockedAtStart: false,
    axes: { sweet: 5, sharp: 8, rich: 1, strange: 0 },
    // lemon + maple + maple
    discover: { target: { sweet: 5.7, sharp: 3.7, rich: 2.7, strange: 0.3 }, tolerance: 1.6, tier: 1 } },

  { id: 'salted_caramel', name: 'Salted Caramel', cost: 5, unlockedAtStart: false,
    axes: { sweet: 8, sharp: 5, rich: 7, strange: 1 },
    // butter + maple + salt flake
    discover: { target: { sweet: 3.0, sharp: 2.3, rich: 4.3, strange: 0.7 }, tolerance: 1.6, tier: 1 } },

  // tier 2 — needs uncommon stock, so it needs a shop that is doing well
  { id: 'plum_lacquer', name: 'Plum Lacquer', cost: 12, unlockedAtStart: false,
    axes: { sweet: 7, sharp: 8, rich: 3, strange: 4 },
    // salted plum + maple
    discover: { target: { sweet: 6.5, sharp: 4.5, rich: 3.0, strange: 2.0 }, tolerance: 1.5, tier: 2 } },

  { id: 'ash_glaze', name: 'Ash Glaze', cost: 14, unlockedAtStart: false,
    axes: { sweet: 6, sharp: 2, rich: 9, strange: 5 },
    // ash sugar + butter + cream
    discover: { target: { sweet: 3.7, sharp: 1.0, rich: 7.3, strange: 2.0 }, tolerance: 1.5, tier: 2 } },

  { id: 'ember_reduction', name: 'Ember Reduction', cost: 18, unlockedAtStart: false,
    axes: { sweet: 4, sharp: 9, rich: 5, strange: 7 },
    // ember peel + black honey
    discover: { target: { sweet: 5.5, sharp: 6.5, rich: 4.5, strange: 5.0 }, tolerance: 1.4, tier: 2 } },

  // tier 3 — exotic stock only. A serious investment per attempt.
  { id: 'quiet_cream', name: 'Quiet Cream', cost: 26, unlockedAtStart: false,
    axes: { sweet: 5, sharp: 0, rich: 10, strange: 6 },
    // quiet milk + cream
    discover: { target: { sweet: 4.0, sharp: 0.5, rich: 9.0, strange: 4.0 }, tolerance: 1.3, tier: 3 } },

  { id: 'void_syrup', name: 'Void Syrup', cost: 30, unlockedAtStart: false,
    axes: { sweet: 6, sharp: 3, rich: 4, strange: 9 },
    // starlight + starlight + ash sugar
    discover: { target: { sweet: 5.0, sharp: 2.0, rich: 3.7, strange: 8.0 }, tolerance: 1.3, tier: 3 } },

  { id: 'nightmilk', name: 'Nightmilk', cost: 40, unlockedAtStart: false,
    axes: { sweet: 7, sharp: 2, rich: 8, strange: 9 },
    // quiet milk + starlight + black honey — the deepest thing on the bench
    discover: { target: { sweet: 6.0, sharp: 2.0, rich: 6.0, strange: 6.7 }, tolerance: 1.2, tier: 3 } }
];
