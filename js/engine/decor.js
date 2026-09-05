import { DECOR } from '../data/decor.js';

/* BUYING THE SHOP SOMETHING NICE.

   The one rule that matters: this touches money and nothing else. It must
   never grant reputation, research points or affection — spec §14.5 —
   because reputation already means exactly two things (which customers
   come, and how many), and a third input would quietly make it two
   systems sharing a name. A decoration is a thing the player wanted, not
   a stat.

   It is also the only sink the money has once the research tree is done,
   which is most of the last two weeks. */

export const decorById = id => DECOR.find(d => d.id === id) || null;

export const owns = (state, id) => (Array.isArray(state.decor) ? state.decor : []).includes(id);

/* Cheapest first, matching data order, with what the player can act on. */
export function decorFor(state) {
  return DECOR.map(d => ({
    ...d,
    owned: owns(state, d.id),
    affordable: state.money >= d.cost
  }));
}

export function buyDecor(state, id) {
  const item = decorById(id);
  if (!item) return { ok: false, reason: `No such thing: ${id}` };
  if (owns(state, id)) return { ok: false, reason: `You already have the ${item.name.toLowerCase()}.` };
  if (state.money < item.cost) {
    return { ok: false, reason: `The ${item.name.toLowerCase()} costs ${item.cost}; you have ${state.money}.` };
  }

  state.money -= item.cost;
  if (!state.decor) state.decor = [];
  state.decor.push(id);
  return { ok: true, item };
}

/* What the shop front draws. Owned only, in the order they were bought,
   so the room fills up in the order the player chose to fill it. */
export function ownedDecor(state) {
  // Array.isArray for the same reason prune() uses it: this runs inside
  // toService(), AFTER openDay() has reset the day but BEFORE the screen
  // is shown, so a throw here opens the day underneath a player who is
  // still looking at the morning screen.
  return (Array.isArray(state.decor) ? state.decor : []).map(decorById).filter(Boolean);
}

export const totalDecorCost = () => DECOR.reduce((a, d) => a + d.cost, 0);
