/* RECIPES — one row per dish.
   pour.target / pour.band  : ml of batter, and the perfect-score window
   flip.windowMs            : half-width of the perfect flip window
   stackCount               : how many pancakes in the stack
   weights                  : how much each beat matters for THIS dish.
                              A souffle lives on the flip; a tall stack on
                              alignment. Four numbers change the whole feel. */

export const RECIPES = [
  {
    id: 'plain', name: 'Plain Stack', tags: ['basic'], base: 12,
    ingredients: ['flour', 'buttermilk'],
    pour: { target: 50, band: 10 },
    flip: { windowMs: 500 },
    stackCount: 3,
    weights: { pour: 1, flip: 1, stack: 1, drizzle: 1 },
    unlockedAtStart: true
  },
  {
    id: 'buttermilk_stack', name: 'Buttermilk Stack', tags: ['basic', 'rich'], base: 20,
    ingredients: ['flour', 'buttermilk', 'butter'],
    pour: { target: 60, band: 8 },
    flip: { windowMs: 420 },
    stackCount: 4,
    weights: { pour: 1, flip: 1.5, stack: 1.5, drizzle: 1 },
    unlockedAtStart: false
  },
  {
    id: 'souffle', name: 'Souffle Pancake', tags: ['delicate'], base: 45,
    ingredients: ['flour', 'buttermilk', 'butter'],
    pour: { target: 40, band: 5 },
    flip: { windowMs: 250 },
    stackCount: 2,
    weights: { pour: 1.5, flip: 3, stack: 0.5, drizzle: 1 },
    unlockedAtStart: false
  },
  {
    id: 'impossible', name: 'Impossible Stack', tags: ['divine'], base: 120,
    ingredients: ['flour', 'buttermilk', 'butter', 'starlight'],
    pour: { target: 55, band: 6 },
    flip: { windowMs: 300 },
    stackCount: 7,
    weights: { pour: 1, flip: 1.5, stack: 3, drizzle: 1.5 },
    unlockedAtStart: false
  }
];
