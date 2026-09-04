/* CUSTOMERS — the roster grows as reputation does.
   wants    : recipe tags they'll order
   unlockAt : { week } and/or { reputation }

   There is deliberately NO patience field. The game has no clock, so a
   patience value would be a number nothing could ever decrement.
   Customers wait indefinitely and without complaint.

   Lines below are placeholders. The collaborator replaces them. */

export const CUSTOMERS = [
  { id: 'first_light', name: 'A Regular', unlockAt: { week: 1 }, wants: ['basic'],
    lines: { greeting: 'Morning. The usual.', happy: 'That is the one.', disappointed: 'It was fine.' } },

  { id: 'the_courier', name: 'The Courier', unlockAt: { week: 1 }, wants: ['basic'],
    lines: { greeting: 'Quick one. Still warm, ideally.', happy: 'Still warm. Good.', disappointed: 'It travelled badly.' } },

  { id: 'night_shift', name: 'Night Shift', unlockAt: { week: 2 }, wants: ['basic', 'rich'],
    lines: { greeting: 'Something heavy. It has been a long one.', happy: 'That will hold.', disappointed: 'Hm.' } },

  { id: 'the_critic', name: 'The Critic', unlockAt: { reputation: 40 }, wants: ['delicate'],
    lines: { greeting: 'Show me something you are proud of.', happy: 'Well. Yes.', disappointed: 'You rushed it.' } }
];
