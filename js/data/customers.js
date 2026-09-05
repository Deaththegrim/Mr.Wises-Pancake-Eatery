/* CUSTOMERS — the roster grows as reputation does.
   wants    : recipe tags they'll order
   unlockAt : { week } and/or { reputation }
   taste    : which syrup suits them, on the same four hidden axes as
              ingredients and syrups. Pouring a syrup that matches pays
              more and builds reputation faster; a mismatch is merely
              ordinary, never a penalty — discovering a syrup should feel
              like gaining an option, not a new way to fail.

              These read straight off `wants`: 'basic' is sweet, 'bright'
              is sharp, 'rich' is rich, 'strange' and 'divine' are strange.
              Keep them in step when you retag a customer, or the tag they
              order by and the syrup that pleases them drift apart.

   There is deliberately NO patience field. The game has no clock, so a
   patience value would be a number nothing could ever decrement.
   Customers wait indefinitely and without complaint.

   HOW THEY SPEAK. The early roster talks loosely and uses contractions;
   the last three — the Stranger, the Pilgrim, the Devout — do not. That
   is the only thing marking them out as touched by something, and it is
   also what keeps Synthia's clipped register hers rather than the house
   style. It is a suggestion, not a rule: rewrite any of it. Only the one
   line noted below was written to stay out of her way. */

export const CUSTOMERS = [
  { id: 'first_light', name: 'A Regular', unlockAt: { week: 1 }, wants: ['basic'], taste: { sweet: 8, sharp: 1, rich: 5, strange: 0 },
    lines: { greeting: 'Morning. The usual.', happy: "That's the one.", disappointed: "No, it's fine. It's fine." } },

  { id: 'the_courier', name: 'The Courier', unlockAt: { week: 1 }, wants: ['basic'], taste: { sweet: 7, sharp: 3, rich: 4, strange: 0 },
    lines: { greeting: 'Quick one. Still warm if you can.', happy: "Still warm. You're a saint.", disappointed: "It'll travel. Just." } },

  { id: 'night_shift', name: 'Night Shift', unlockAt: { week: 2 }, wants: ['basic', 'rich'], taste: { sweet: 6, sharp: 2, rich: 9, strange: 3 },
    // Their "Hm." was Synthia's, and she should be the only one who gets it.
    lines: { greeting: "Something heavy. It's been a long one.", happy: "That'll hold me. Cheers.", disappointed: "I'll be hungry again by the bridge." } },

  { id: 'the_gardener', name: 'The Gardener', unlockAt: { week: 2 }, wants: ['bright', 'basic'], taste: { sweet: 6, sharp: 7, rich: 2, strange: 0 },
    lines: { greeting: "Something with fruit in it. It's been grey all week.", happy: 'That is summer, that is.', disappointed: 'Still grey, then.' } },

  { id: 'the_twins', name: 'The Twins', unlockAt: { reputation: 25 }, wants: ['basic', 'bright'], taste: { sweet: 5, sharp: 8, rich: 1, strange: 0 },
    lines: { greeting: 'Two. The same. No arguing.', happy: 'No arguing.', disappointed: "They're arguing." } },

  { id: 'the_widow', name: 'The Widow', unlockAt: { reputation: 60 }, wants: ['rich', 'strange'], taste: { sweet: 6, sharp: 3, rich: 8, strange: 7 },
    lines: { greeting: "Something I haven't had before.", happy: "I hadn't had that before.", disappointed: 'I had had that before.' } },

  { id: 'the_apprentice', name: 'The Apprentice', unlockAt: { reputation: 90 }, wants: ['delicate', 'bright'], taste: { sweet: 5, sharp: 8, rich: 3, strange: 2 },
    lines: { greeting: 'They said you can do the difficult one. The tall one.', happy: "You can do the difficult one. I'm telling everybody.", disappointed: "Oh. They must've meant somewhere else." } },

  { id: 'the_stranger', name: 'The Stranger', unlockAt: { reputation: 180 }, wants: ['strange', 'divine'], taste: { sweet: 6, sharp: 3, rich: 4, strange: 9 },
    lines: { greeting: 'I am not from the district.', happy: 'I will be back. Sooner than you expect.', disappointed: 'Ah. Well. It was the right shop.' } },

  { id: 'the_critic', name: 'The Critic', unlockAt: { reputation: 40 }, wants: ['delicate', 'rich'], taste: { sweet: 5, sharp: 1, rich: 10, strange: 5 },
    lines: { greeting: "Show me something you're proud of.", happy: 'Well. Yes. All right.', disappointed: 'You rushed it. I can taste the hurry.' } },

  { id: 'the_pilgrim', name: 'The Pilgrim', unlockAt: { reputation: 120 }, wants: ['delicate', 'divine'], taste: { sweet: 4, sharp: 4, rich: 6, strange: 8 },
    lines: { greeting: 'I heard about this place. From a long way off.', happy: 'Worth the walk. I will say so, where I am going.', disappointed: 'I walked a long way.' } },

  // Somebody must want the `divine` tag or the Impossible Stack is
  // unreachable revenue no matter how much research goes into it.
  // tools/validate.js now fails the build if a recipe tag has no taker.
  { id: 'the_devout', name: 'The Devout', unlockAt: { reputation: 260 }, wants: ['divine'], taste: { sweet: 4, sharp: 9, rich: 5, strange: 7 },
    lines: { greeting: 'The one that should not exist. Please.', happy: 'It should not exist. And yet.', disappointed: 'It existed. Barely.' } }
];
