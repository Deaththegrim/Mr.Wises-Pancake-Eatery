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
   target is unreachable, and by how much. Always run it after adding one. */

export const SYRUPS = [
  { id: 'maple_syrup', name: 'Maple Syrup', cost: 3, unlockedAtStart: true,
    axes: { sweet: 8, sharp: 1, rich: 5, strange: 0 } },

  { id: 'lemon_glaze', name: 'Lemon Glaze', cost: 4, unlockedAtStart: false,
    axes: { sweet: 5, sharp: 8, rich: 1, strange: 0 },
    discover: { target: { sweet: 5, sharp: 8, rich: 1, strange: 0 }, tolerance: 4, tier: 1 } },

  // Discovered from maple + butter + salt flake. Tastes far stronger than
  // that blend because it is cooked down — see the note above.
  { id: 'salted_caramel', name: 'Salted Caramel', cost: 5, unlockedAtStart: false,
    axes: { sweet: 8, sharp: 5, rich: 7, strange: 1 },
    discover: { target: { sweet: 3, sharp: 2, rich: 4, strange: 1 }, tolerance: 3, tier: 2 } },

  { id: 'void_syrup', name: 'Void Syrup', cost: 9, unlockedAtStart: false,
    axes: { sweet: 6, sharp: 3, rich: 4, strange: 9 },
    discover: { target: { sweet: 6, sharp: 3, rich: 4, strange: 9 }, tolerance: 3, tier: 3 } }
];
