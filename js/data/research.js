/* RESEARCH — the visible tree.
   cost    : research points
   prereqs : other node ids that must be purchased first
   gate    : optional real-world requirement, e.g. cook something N times
   unlocks : exactly one of { recipe | syrup | upgrade }

   Upgrades buy away ERROR, never power. A griddle alarm marks the flip
   window; a measured ladle narrows the pour band; a stack guide shows the
   centre line. The game gets calmer as you progress. */

export const RESEARCH = [
  { id: 'r_buttermilk', name: 'Buttermilk Technique', cost: 3, prereqs: [],
    gate: { cooked: { plain: 5 } }, unlocks: { recipe: 'buttermilk_stack' } },

  { id: 'r_ladle', name: 'Measured Ladle', cost: 4, prereqs: [],
    gate: null, unlocks: { upgrade: 'pour_band_bonus' } },

  { id: 'r_alarm', name: 'Griddle Alarm', cost: 6, prereqs: ['r_buttermilk'],
    gate: null, unlocks: { upgrade: 'flip_window_bonus' } },

  { id: 'r_souffle', name: 'Souffle Method', cost: 10, prereqs: ['r_buttermilk'],
    gate: { cooked: { buttermilk_stack: 8 } }, unlocks: { recipe: 'souffle' } },

  { id: 'r_guide', name: 'Stack Guide', cost: 8, prereqs: ['r_ladle'],
    gate: null, unlocks: { upgrade: 'stack_forgiveness' } },

  // --- the bright branch: cheap, early, and it opens up demand ---
  { id: 'r_lemon', name: 'Citrus Work', cost: 5, prereqs: ['r_buttermilk'],
    gate: { cooked: { buttermilk_stack: 4 } }, unlocks: { recipe: 'lemon_stack' } },

  { id: 'r_fruit', name: 'Fruit Handling', cost: 9, prereqs: ['r_lemon'],
    gate: { cooked: { lemon_stack: 6 } }, unlocks: { recipe: 'blueberry_pile' } },

  { id: 'r_pour_read', name: 'Practised Eye', cost: 12, prereqs: ['r_ladle'],
    gate: null, unlocks: { upgrade: 'pour_band_bonus' } },

  // --- the strange branch: expensive ingredients, high margins ---
  { id: 'r_ash', name: 'Working With Ash', cost: 16, prereqs: ['r_souffle'],
    gate: { cooked: { souffle: 3 } }, unlocks: { recipe: 'ash_dark' } },

  { id: 'r_ember', name: 'The Ember Method', cost: 22, prereqs: ['r_ash', 'r_alarm'],
    gate: { cooked: { ash_dark: 5 } }, unlocks: { recipe: 'ember_crisp' } },

  { id: 'r_steady', name: 'Steady Hands', cost: 18, prereqs: ['r_guide'],
    gate: null, unlocks: { upgrade: 'stack_forgiveness' } },

  { id: 'r_impossible', name: 'The Impossible Stack', cost: 25, prereqs: ['r_souffle', 'r_guide'],
    gate: { cooked: { souffle: 5 } }, unlocks: { recipe: 'impossible' } },

  // --- the end of the tree ---
  { id: 'r_quiet', name: 'The Quiet Stack', cost: 40, prereqs: ['r_impossible', 'r_ember'],
    gate: { cooked: { impossible: 3 } }, unlocks: { recipe: 'quiet_stack' } }
];

/* Upgrade effects, keyed by the id in unlocks.upgrade. Applied in engine/cook.js. */
export const UPGRADE_EFFECTS = {
  pour_band_bonus:   { pourBandPlus: 4 },
  flip_window_bonus: { flipWindowPlus: 150 },
  stack_forgiveness: { stackDriftScale: 0.7 }
};
