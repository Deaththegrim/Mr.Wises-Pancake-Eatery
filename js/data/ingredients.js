/* INGREDIENTS — flavour axes drive bench discovery.
   axes: sweet / sharp / rich / strange, each roughly 0-10.
   To add an ingredient, copy a row and change the values. */

export const INGREDIENTS = [
  { id: 'flour',      name: 'Flour',             cost: 1, axes: { sweet: 1, sharp: 0, rich: 2, strange: 0 } },
  { id: 'buttermilk', name: 'Buttermilk',        cost: 2, axes: { sweet: 2, sharp: 3, rich: 4, strange: 0 } },
  { id: 'butter',     name: 'Butter',            cost: 2, axes: { sweet: 1, sharp: 0, rich: 8, strange: 0 } },
  { id: 'cream',      name: 'Cream',             cost: 3, axes: { sweet: 3, sharp: 1, rich: 9, strange: 0 } },
  { id: 'maple',      name: 'Maple Sap',         cost: 3, axes: { sweet: 8, sharp: 1, rich: 4, strange: 0 } },
  { id: 'lemon',      name: 'Lemon',             cost: 2, axes: { sweet: 1, sharp: 9, rich: 0, strange: 1 } },
  { id: 'blueberry',  name: 'Blueberry',         cost: 3, axes: { sweet: 6, sharp: 3, rich: 1, strange: 0 } },
  { id: 'saltflake',  name: 'Salt Flake',        cost: 1, axes: { sweet: 0, sharp: 6, rich: 1, strange: 2 } },
  { id: 'starlight',  name: 'Bottled Starlight', cost: 8, axes: { sweet: 4, sharp: 2, rich: 3, strange: 9 } },
  { id: 'ashsugar',   name: 'Ash Sugar',         cost: 6, axes: { sweet: 7, sharp: 2, rich: 5, strange: 6 } }
];
