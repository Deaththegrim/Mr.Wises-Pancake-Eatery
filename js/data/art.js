/* ART SLOTS — every picture the game will use, and where it looks for it.

   Nothing here needs to exist. Each slot draws a placeholder until a file
   appears at its path, and picks the file up the moment one does: no code
   change, no registration step, no build. Drop a PNG in, reload, it is in
   the game. Delete it and the placeholder comes back.

   That is the whole point of this file. The art can be made in any order,
   by anyone, and tested one picture at a time.

   Run `node tools/art.js` for the checklist: which slots are filled, which
   are empty, and whether a file is the size its slot expects.

   Each row:
     id       what the code asks for
     path     where to put the file, relative to the project root
     w, h     the size it is drawn at. Supply 2x for sharp edges on a
              retina screen; anything is accepted and scaled to fit.
     needs    what it has to show, in plain words
     replaces the placeholder it takes over from, so you can see what you
              are replacing before you draw anything

   Transparent PNG throughout — everything here is drawn over something.

   To add a NEW slot, add a row here and then read it with `sprite('<id>')`
   from ui/art.js at the place that should draw it. `tools/art.js` and the
   validator pick it up automatically. */

export const ART = [
  {
    id: 'pancake',
    path: 'assets/food/pancake.png',
    w: 200, h: 120,
    needs: 'One pancake, seen slightly from above, sitting flat. It is drawn ' +
           'many times in a stack, so the top face matters more than the edge, ' +
           'and it must tile upward without an obvious seam.',
    replaces: 'a drawn ellipse in the shop\'s batter colour'
  },
  {
    id: 'pancake_over',
    path: 'assets/food/pancake_over.png',
    w: 200, h: 120,
    needs: 'The same pancake, overcooked. Used the moment the flip window ' +
           'closes, so it should read as "too dark" at a glance, from the ' +
           'same angle and the same size as `pancake`.',
    replaces: 'the same ellipse in a burnt colour'
  },
  {
    id: 'pancake_stacked',
    path: 'assets/food/pancake_stacked.png',
    w: 340, h: 44,
    needs: 'A pancake seen almost edge-on, as one layer of a stack. This is ' +
           'a DIFFERENT view from `pancake`, not the same drawing squashed: ' +
           'in the pan you look down at it, in the stack you look across at ' +
           'it. Drawn at a fixed height so the leaning tower the stack beat ' +
           'measured stays the tower you see, so keep it flat and wide.',
    replaces: 'a flat drawn ellipse in the batter colour'
  },
  {
    id: 'griddle',
    path: 'assets/shop/griddle.png',
    w: 560, h: 340,
    needs: 'The pan, empty, seen from the same angle as the food. Everything ' +
           'else in the cooking screens is drawn on top of it, so keep the ' +
           'middle quiet and the rim readable.',
    replaces: 'a dark ellipse with a lighter rim'
  },

  /* The room. One per row in data/decor.js — the `art` field there is the
     id here. They are drawn in a line above the counter during service, so
     they want to read at a glance and sit on transparent backgrounds. */
  { id: 'decor_window_boxes', path: 'assets/decor/window_boxes.png', w: 240, h: 160,
    needs: 'Window boxes with something growing in them.', replaces: 'a labelled outline' },
  { id: 'decor_second_table', path: 'assets/decor/second_table.png', w: 240, h: 160,
    needs: 'A second table, small, for two.', replaces: 'a labelled outline' },
  { id: 'decor_sign', path: 'assets/decor/sign.png', w: 240, h: 160,
    needs: 'The shop sign, freshly repainted.', replaces: 'a labelled outline' },
  { id: 'decor_lamp', path: 'assets/decor/lamp.png', w: 240, h: 160,
    needs: 'A corner lamp, warm and low.', replaces: 'a labelled outline' },
  { id: 'decor_jars', path: 'assets/decor/jars.png', w: 240, h: 160,
    needs: 'A shelf of syrup jars, lit.', replaces: 'a labelled outline' },
  { id: 'decor_griddle', path: 'assets/decor/griddle.png', w: 240, h: 160,
    needs: 'A heavy, good griddle — the shop\'s, not the one you cook on.', replaces: 'a labelled outline' },
  { id: 'decor_awning', path: 'assets/decor/awning.png', w: 240, h: 160,
    needs: 'A front awning, the kind people wait under.', replaces: 'a labelled outline' }
];
