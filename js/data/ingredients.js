/* INGREDIENTS — flavour axes drive bench discovery; cost drives the grind.

   axes: sweet / sharp / rich / strange, each roughly 0-10.

   COST is what makes research a grind. You buy stock out of the till and
   the bench BURNS it whether or not the experiment works. Prices are scaled
   against real shop income (roughly 1,000/week early, 10,000/week late), so
   a three-exotic blend is a serious investment early and a routine one once
   the shop is doing well. Cheap staples let a broke player still tinker.

   After changing a price, run `node tools/simulate.js` — the bench is the
   main money sink, so these numbers decide whether profit has a purpose. */

export const INGREDIENTS = [
  // staples — always affordable, so experimenting is never fully blocked
  { id: 'flour',      name: 'Flour',             cost: 6, sell: 2,   axes: { sweet: 1, sharp: 0, rich: 2, strange: 0 } },
  { id: 'saltflake',  name: 'Salt Flake',        cost: 8, sell: 2,   axes: { sweet: 0, sharp: 6, rich: 1, strange: 2 } },
  { id: 'buttermilk', name: 'Buttermilk',        cost: 14, sell: 3,  axes: { sweet: 2, sharp: 3, rich: 4, strange: 0 } },
  { id: 'butter',     name: 'Butter',            cost: 16, sell: 4,  axes: { sweet: 1, sharp: 0, rich: 8, strange: 0 } },
  { id: 'lemon',      name: 'Lemon',             cost: 18, sell: 6,  axes: { sweet: 1, sharp: 9, rich: 0, strange: 1 } },
  { id: 'cream',      name: 'Cream',             cost: 22, sell: 7,  axes: { sweet: 3, sharp: 1, rich: 9, strange: 0 } },
  { id: 'maple',      name: 'Maple Sap',         cost: 26, sell: 6,  axes: { sweet: 8, sharp: 1, rich: 4, strange: 0 } },
  { id: 'blueberry',  name: 'Blueberry',         cost: 28, sell: 8,  axes: { sweet: 6, sharp: 3, rich: 1, strange: 0 } },

  // uncommon — a real decision early on
  { id: 'blackhoney', name: 'Black Honey',       cost: 90, sell: 25,  axes: { sweet: 9, sharp: 4, rich: 6, strange: 3 } },
  { id: 'saltedplum', name: 'Salted Plum',       cost: 110, sell: 30, axes: { sweet: 5, sharp: 8, rich: 2, strange: 4 } },
  { id: 'ashsugar',   name: 'Ash Sugar',         cost: 150, sell: 40, axes: { sweet: 7, sharp: 2, rich: 5, strange: 6 } },

  // exotic — a three-of-these blend is a genuine investment
  { id: 'emberpeel',  name: 'Ember Peel',        cost: 240, sell: 65, axes: { sweet: 2, sharp: 9, rich: 3, strange: 7 } },
  { id: 'starlight',  name: 'Bottled Starlight', cost: 320, sell: 85, axes: { sweet: 4, sharp: 2, rich: 3, strange: 9 } },
  { id: 'quietmilk',  name: 'Quiet Milk',        cost: 380, sell: 100, axes: { sweet: 5, sharp: 0, rich: 9, strange: 8 } }
];
