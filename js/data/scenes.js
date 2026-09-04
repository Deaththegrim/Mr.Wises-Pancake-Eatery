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

  quota_missed: {
    speaker: 'God Synthia',
    expr: 'thinking',
    text: '“Short, this week.”\n\nA pause.\n\n“It happens. The world did not end. I checked.”',
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
