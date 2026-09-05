/* DECORATION — what the till is FOR, late on.

   Bought with money, kept forever, and purely cosmetic. Spec §14.5 is
   explicit that decoration must NOT feed reputation: reputation already
   does exactly two jobs (unlock customers, raise foot traffic), and wiring
   a third thing into it would make it two systems wearing one name.

   It exists because the research tree finishes before the last weeks and
   the till then climbs with nothing to spend it on — measured at roughly
   21,000 banked by the end of a careful run, against a game whose whole
   escalating quota is supposed to mean something.

   The cozy research is the other half of the reason: self-authored goals
   are what carry games with no fail state. Nobody needs the window boxes.
   That is the point of them.

   `art` is a PLACEHOLDER name for the sprite that will replace the drawn
   stand-in. The shop front draws a labelled shape per owned item until
   those exist; nothing about the system changes when they do.

   Ordered cheapest first — that order is what the shop screen shows. */

export const DECOR = [
  { id: 'window_boxes', name: 'Window Boxes', cost: 400, art: 'decor_window_boxes',
    note: 'Something growing, where the light is.' },

  { id: 'second_table', name: 'A Second Table', cost: 900, art: 'decor_second_table',
    note: 'Two people could sit down now.' },

  { id: 'repainted_sign', name: 'Repainted Sign', cost: 1200, art: 'decor_sign',
    note: 'The letters had gone grey. They have not, now.' },

  { id: 'corner_lamp', name: 'Corner Lamp', cost: 2600, art: 'decor_lamp',
    note: 'Warm, and low, and on all day.' },

  { id: 'shelf_of_jars', name: 'A Shelf of Jars', cost: 3400, art: 'decor_jars',
    note: 'Every syrup you have ever found, in a row, in the light.' },

  { id: 'good_griddle', name: 'The Good Griddle', cost: 5200, art: 'decor_griddle',
    note: 'Heavier. It holds its heat. It does not cook any better — you do.' },

  { id: 'front_awning', name: 'Front Awning', cost: 7500, art: 'decor_awning',
    note: 'People wait under it when it rains. They did not used to wait.' }
];
