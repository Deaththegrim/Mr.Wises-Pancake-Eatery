/* SYRUPS.
   axes    : what it tastes like when used on a dish
   discover: present only if it must be FOUND at the bench.
             target = the axis profile to hit, tolerance = how close counts,
             tier   = rough difficulty band, used for directional hints. */

export const SYRUPS = [
  { id: 'maple_syrup', name: 'Maple Syrup', cost: 3, unlockedAtStart: true,
    axes: { sweet: 8, sharp: 1, rich: 5, strange: 0 } },

  { id: 'lemon_glaze', name: 'Lemon Glaze', cost: 4, unlockedAtStart: false,
    axes: { sweet: 5, sharp: 8, rich: 1, strange: 0 },
    discover: { target: { sweet: 5, sharp: 8, rich: 1, strange: 0 }, tolerance: 4, tier: 1 } },

  { id: 'salted_caramel', name: 'Salted Caramel', cost: 5, unlockedAtStart: false,
    axes: { sweet: 8, sharp: 5, rich: 7, strange: 1 },
    discover: { target: { sweet: 8, sharp: 5, rich: 7, strange: 1 }, tolerance: 4, tier: 2 } },

  { id: 'void_syrup', name: 'Void Syrup', cost: 9, unlockedAtStart: false,
    axes: { sweet: 6, sharp: 3, rich: 4, strange: 9 },
    discover: { target: { sweet: 6, sharp: 3, rich: 4, strange: 9 }, tolerance: 3, tier: 3 } }
];
