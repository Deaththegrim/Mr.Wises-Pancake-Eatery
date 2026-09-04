/* SYNTHIA'S SCENES — same node format as god-synthia's js/story.js.

   Node fields:
     speaker   - name in the name box; omit for narration
     text      - the line(s)
     expr      - expression key; omit to use her affection-tier default
     pose      - full-body pose key; omit to use her tier default
     next      - id of the following node
     choices   - [{ text, next, affection }]
     mentions  - recipe id she mentions in passing. If the player later
                 researches that dish and serves it to her, unprompted,
                 she notices. THIS IS THE ARC'S BEST BEAT.
                 See engine/affection.js checkListening().
     end       - true to close the scene

   VOICE: second person, present tense, short hard-broken fragments,
   deadpan. Her spoken lines go in smart quotes. Full guide at
   ~/vault/projects/god-synthia/research/voice-style-guide.md

   ------------------------------------------------------------------
   THE TEXT BELOW IS PLACEHOLDER, WRITTEN TO BE REPLACED.
   It is here so the engine has something to render and so the shape of a
   scene is obvious. The voice is the collaborator's, not ours.
   ------------------------------------------------------------------ */

export const SCENES = {
  visit_first: {
    speaker: '???',
    text: 'The bell goes.\n\nShe is taller than the doorway should allow.',
    next: 'visit_first_b'
  },
  visit_first_b: {
    speaker: 'God Synthia',
    expr: 'neutral',
    text: '“You are open.”\n\nIt is not quite a question.',
    next: 'visit_first_c'
  },
  visit_first_c: {
    speaker: 'God Synthia',
    text: '“Something plain. I am not in the mood to be impressed.”',
    choices: [
      { text: 'Plain it is.', next: 'visit_first_end', affection: 1 },
      { text: 'You could be.', next: 'visit_first_end', affection: 2 }
    ]
  },
  visit_first_end: {
    speaker: 'God Synthia',
    text: '“Hm.”\n\nShe stays a moment longer than she needs to.',
    end: true
  },

  quota_met: {
    speaker: 'God Synthia',
    expr: 'happy',
    text: '“You made the number.”\n\n“Breakfast holds. For another week.”',
    end: true
  },

  /* MISSING THE QUOTA — three scenes, escalating.
     A struggling player can miss six weeks running, and hearing the exact
     same line six times turns a kind mechanic into a broken record. These
     escalate for the first three misses and then hold. See
     engine/story.js missSceneFor(). */
  quota_missed_1: {
    speaker: 'God Synthia',
    expr: 'thinking',
    text: '“Short, this week.”\n\nA pause.\n\n“It happens. The world did not end. I checked.”',
    end: true
  },
  quota_missed_2: {
    speaker: 'God Synthia',
    expr: 'curious',
    text: '“Short again.”\n\nShe does not say it unkindly.\n\n“Is it the mornings? It is usually the mornings.”',
    end: true
  },
  quota_missed_3: {
    speaker: 'God Synthia',
    expr: 'sigh',
    text: 'She sits down. She does not usually sit down.\n\n“I am not here about the number.”\n\n“…You are still open. That is the part I would have bet against.”',
    end: true
  },

  /* A mention. She says it lightly and moves on. If the player researches
     the souffle weeks later and serves it to her, affection.js fires the
     listening beat. Use these sparingly — it only lands if it feels like
     she has forgotten she said it. */
  mention_souffle: {
    speaker: 'God Synthia',
    expr: 'sigh',
    text: '“There was a thing, once. Barely there. You breathed on it and it fell.”\n\n“…Nobody makes it any more.”',
    mentions: 'souffle',
    end: true
  },

  mention_impossible: {
    speaker: 'God Synthia',
    expr: 'thinking',
    text: '“Seven high. It should not stand up.”\n\n“I have only seen it once. I was younger. So was the world.”',
    mentions: 'impossible',
    end: true
  },

  /* ============================================================
     ENDINGS — one per affection tier, chosen at the end of the last
     authored week by engine/story.js endingFor().

     This is the payoff the whole affection system exists for: a player
     who never noticed her finishes somewhere quite different from one who
     listened. All placeholder — the last scene of the game is the one
     that most needs to be in her author's voice.
     ============================================================ */

  ending_stranger: {
    speaker: 'God Synthia',
    expr: 'neutral',
    text: 'The season turns.\n\nShe comes in, orders, eats, and goes, the way she has all along.',
    next: 'ending_stranger_b'
  },
  ending_stranger_b: {
    speaker: 'God Synthia',
    text: '“You kept it open.”\n\n“Most do not.”\n\nAt the door she almost says something else. She does not.',
    end: true, endingTitle: 'A Regular'
  },

  ending_regular: {
    speaker: 'God Synthia',
    expr: 'curious',
    text: 'The season turns.\n\nShe knows which stool she likes now. You had not noticed her deciding.',
    next: 'ending_regular_b'
  },
  ending_regular_b: {
    speaker: 'God Synthia',
    text: '“Same time next week.”\n\nIt is not a question, and it is not quite an order.',
    end: true, endingTitle: 'Same Time Next Week'
  },

  ending_familiar: {
    speaker: 'God Synthia',
    expr: 'thinking',
    text: 'The season turns.\n\nShe has started arriving before the sign goes up.',
    next: 'ending_familiar_b'
  },
  ending_familiar_b: {
    speaker: 'God Synthia',
    text: '“I have been coming here a while.”\n\n“I did not plan to.”\n\nShe looks at the griddle rather than at you.',
    end: true, endingTitle: 'Before the Sign Goes Up'
  },

  ending_confidant: {
    speaker: 'God Synthia',
    expr: 'happy',
    text: 'The season turns.\n\nShe lets herself in. She has for weeks. Neither of you mentioned it.',
    next: 'ending_confidant_b'
  },
  ending_confidant_b: {
    speaker: 'God Synthia',
    text: '“Breakfast holds the world up. I have said that before.”\n\n“I did not think anyone would take it seriously.”\n\n“…Thank you for taking it seriously.”',
    end: true, endingTitle: 'Load-Bearing'
  },

  ending_devoted: {
    speaker: 'God Synthia',
    expr: 'shy',
    text: 'The season turns.\n\nShe is behind the counter. You did not invite her; she did not ask.',
    next: 'ending_devoted_b'
  },
  ending_devoted_b: {
    speaker: 'God Synthia',
    expr: 'love',
    text: '“I said once that most do not stay.”\n\nA long pause. She is not good at this part.',
    next: 'ending_devoted_c'
  },
  ending_devoted_c: {
    speaker: 'God Synthia',
    text: '“You stayed.”\n\n“…Do not make it strange.”\n\nShe puts the kettle on, in her own shop, which it is now.',
    end: true, endingTitle: 'Most Do Not Stay'
  },

  /* Fires when she notices you made the thing she mentioned. */
  noticed: {
    speaker: 'God Synthia',
    expr: 'surprised',
    text: 'She looks at the plate.\n\nThen at you.\n\n“…I mentioned that. Weeks ago.”',
    next: 'noticed_b'
  },
  noticed_b: {
    speaker: 'God Synthia',
    expr: 'shy',
    text: '“You were listening.”\n\nShe does not say anything else for a while.',
    end: true
  }
};
