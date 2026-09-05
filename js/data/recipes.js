/* RECIPES — one row per dish.
   pour.target / pour.band  : ml of batter, and the perfect-score window
   flip.windowMs            : half-width of the perfect flip window
   stackCount               : how many pancakes in the stack
   weights                  : how much each beat matters for THIS dish.
                              A souffle lives on the flip; a tall stack on
                              alignment. Four numbers change the whole feel. */

export const RECIPES = [
  {
    id: 'plain', name: 'Plain Stack', tags: ['basic'], craft: 0,
    ingredients: ['flour', 'buttermilk'],
    pour: { target: 50, band: 10 },
    flip: { windowMs: 500 },
    stackCount: 3,
    weights: { pour: 1, flip: 1, stack: 1, drizzle: 1 },
    unlockedAtStart: true
  },
  {
    id: 'buttermilk_stack', name: 'Buttermilk Stack', tags: ['basic', 'rich'], craft: 1,
    ingredients: ['flour', 'buttermilk', 'butter'],
    pour: { target: 60, band: 8 },
    flip: { windowMs: 420 },
    stackCount: 4,
    weights: { pour: 1, flip: 1.5, stack: 1.5, drizzle: 1 },
    unlockedAtStart: false
  },
  {
    id: 'souffle', name: 'Souffle Pancake', tags: ['delicate'], craft: 32,
    ingredients: ['flour', 'buttermilk', 'butter'],
    pour: { target: 40, band: 5 },
    flip: { windowMs: 250 },
    stackCount: 2,
    weights: { pour: 1.5, flip: 3, stack: 0.5, drizzle: 1 },
    unlockedAtStart: false
  },
  {
    id: 'lemon_stack', name: 'Lemon Stack', tags: ['basic', 'bright'], craft: 8,
    ingredients: ['flour', 'buttermilk', 'lemon'],
    pour: { target: 52, band: 9 },
    flip: { windowMs: 460 },
    stackCount: 3,
    // A drizzle dish: the glaze is the point, so coverage carries it.
    weights: { pour: 1, flip: 1, stack: 1, drizzle: 2.5 },
    unlockedAtStart: false
  },
  {
    id: 'blueberry_pile', name: 'Blueberry Pile', tags: ['basic', 'bright'], craft: 8,
    ingredients: ['flour', 'buttermilk', 'blueberry'],
    pour: { target: 66, band: 11 },
    flip: { windowMs: 520 },
    stackCount: 5,
    // Forgiving everywhere except height - a tall soft stack wants a steady hand.
    weights: { pour: 1, flip: 0.8, stack: 2, drizzle: 1 },
    unlockedAtStart: false
  },
  {
    id: 'ash_dark', name: 'Ash-Dark Stack', tags: ['rich', 'strange'], craft: 13,
    ingredients: ['flour', 'cream', 'ashsugar'],
    pour: { target: 58, band: 7 },
    flip: { windowMs: 340 },
    stackCount: 4,
    weights: { pour: 1.5, flip: 2, stack: 1.5, drizzle: 1.5 },
    unlockedAtStart: false
  },
  {
    id: 'ember_crisp', name: 'Ember Crisp', tags: ['delicate', 'strange'], craft: 20,
    ingredients: ['flour', 'butter', 'emberpeel'],
    pour: { target: 36, band: 4 },
    flip: { windowMs: 200 },
    stackCount: 2,
    // The hardest flip in the game. Thin, hot, and it burns while you think.
    weights: { pour: 2, flip: 3.5, stack: 0.5, drizzle: 1 },
    unlockedAtStart: false
  },
  {
    id: 'quiet_stack', name: 'Quiet Stack', tags: ['delicate', 'divine'], craft: 24,
    ingredients: ['flour', 'quietmilk', 'cream'],
    pour: { target: 48, band: 5 },
    flip: { windowMs: 280 },
    stackCount: 3,
    weights: { pour: 2, flip: 2, stack: 1, drizzle: 2 },
    unlockedAtStart: false
  },
  {
    id: 'impossible', name: 'Impossible Stack', tags: ['divine'], craft: 7,
    ingredients: ['flour', 'buttermilk', 'butter', 'starlight'],
    pour: { target: 55, band: 6 },
    flip: { windowMs: 300 },
    stackCount: 7,
    weights: { pour: 1, flip: 1.5, stack: 3, drizzle: 1.5 },
    unlockedAtStart: false
  }
];
