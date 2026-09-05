/* SOUND SLOTS — every noise the game can make, and how to make it.

   NOTHING HERE IS AN ASSET. Each slot carries a recipe the browser plays
   with its own audio hardware, so the game has sound on a fresh clone with
   no files to download, no library, and no build step — the same promise
   the rest of the project makes.

   A slot can still be REPLACED by a real recording: drop a file at `path`
   and it is used instead of the recipe, picked up on the next reload. That
   is the same either/or `data/art.js` makes, for the same reason — the
   audio can be made in any order, by anyone, one sound at a time, and
   until then the game is never silent.

   Run `node tools/audio.js` for the checklist.

   Each row:
     id       what the code asks for
     when     the moment it plays, in plain words
     path     where a real recording goes, if one is ever made
     sustain  true if it runs until told to stop (the two held actions)
     layers   the recipe: one or more voices, mixed

   Each layer:
     wave      sine · triangle · square · sawtooth · noise
     hz        a steady pitch, OR
     from, to  a pitch that slides from one to the other across `ms`
     ms        how long the layer lasts
     gain      how loud, 0 to 1, before the master volume
     delay     ms to wait before this layer starts, for two-part sounds
     attack    fade-in, as a fraction of ms (0.01 is a click, 0.4 is soft)
     release   fade-out, as a fraction of ms
     filter    lowpass · highpass · bandpass, with filterHz — mostly to
               shape `noise` into something that sounds like a liquid

   THE HOUSE STYLE IS QUIET. The design note this project keeps coming back
   to is that medium juice beats extreme juice for a cozy game: gains sit
   low, nothing is harsh, and the sound for FAILING at the bench is gentler
   than the one for succeeding rather than louder. Nothing here punishes.

   To add a slot: add a row, then play it with `play('<id>')` from a ui
   module. Tests fail if a declared slot is never played, or if the code
   plays an id no row declares. */

export const SOUNDS = [
  /* --- the four beats --- */
  {
    id: 'pour',
    when: 'held, while batter runs onto the griddle',
    path: 'assets/audio/pour.mp3',
    sustain: true,
    layers: [
      { wave: 'noise', ms: 0, gain: 0.05, attack: 0.2, release: 0.3,
        filter: 'lowpass', filterHz: 640 }
    ]
  },
  {
    id: 'flip',
    when: 'the pancake turns over',
    path: 'assets/audio/flip.mp3',
    layers: [
      { wave: 'noise', ms: 130, gain: 0.06, attack: 0.02, release: 0.85,
        filter: 'highpass', filterHz: 900 },
      { wave: 'sine', from: 300, to: 170, ms: 160, gain: 0.10, delay: 70,
        attack: 0.02, release: 0.8 }
    ]
  },
  {
    id: 'flip_clean',
    when: 'the flip lands inside the ideal window — the only "well done" in the beats',
    path: 'assets/audio/flip_clean.mp3',
    layers: [
      { wave: 'triangle', from: 660, to: 880, ms: 180, gain: 0.07, delay: 40,
        attack: 0.05, release: 0.7 }
    ]
  },
  {
    id: 'stack_land',
    when: 'a pancake settles onto the stack',
    path: 'assets/audio/stack_land.mp3',
    layers: [
      { wave: 'sine', from: 190, to: 120, ms: 130, gain: 0.11, attack: 0.02, release: 0.75 },
      { wave: 'noise', ms: 60, gain: 0.03, attack: 0.02, release: 0.9,
        filter: 'lowpass', filterHz: 420 }
    ]
  },
  {
    id: 'drizzle',
    when: 'held, while syrup is being drawn across the stack',
    path: 'assets/audio/drizzle.mp3',
    sustain: true,
    layers: [
      { wave: 'noise', ms: 0, gain: 0.035, attack: 0.25, release: 0.35,
        filter: 'bandpass', filterHz: 1500 }
    ]
  },

  /* --- the counter --- */
  {
    id: 'bell',
    when: 'a customer comes in',
    path: 'assets/audio/bell.mp3',
    layers: [
      { wave: 'triangle', hz: 1050, ms: 320, gain: 0.07, attack: 0.01, release: 0.85 },
      { wave: 'triangle', hz: 1400, ms: 260, gain: 0.04, delay: 45, attack: 0.01, release: 0.85 }
    ]
  },
  {
    id: 'bell_quiet',
    when: 'SHE comes in — the same bell, lower and slower, so the room changes before she speaks',
    path: 'assets/audio/bell_quiet.mp3',
    layers: [
      { wave: 'triangle', hz: 700, ms: 620, gain: 0.06, attack: 0.03, release: 0.9 },
      { wave: 'sine', hz: 466, ms: 700, gain: 0.05, delay: 90, attack: 0.05, release: 0.9 }
    ]
  },
  {
    id: 'serve',
    when: 'the plate goes across the counter',
    path: 'assets/audio/serve.mp3',
    layers: [
      { wave: 'sine', from: 240, to: 300, ms: 150, gain: 0.08, attack: 0.03, release: 0.8 }
    ]
  },
  {
    id: 'till',
    when: 'the bill is settled and the receipt prints',
    path: 'assets/audio/till.mp3',
    layers: [
      { wave: 'triangle', hz: 880, ms: 130, gain: 0.06, attack: 0.01, release: 0.8 },
      { wave: 'triangle', hz: 1320, ms: 220, gain: 0.05, delay: 80, attack: 0.01, release: 0.85 }
    ]
  },

  /* --- the bench and the board --- */
  {
    id: 'discover',
    when: 'a blend turns into a syrup nobody had',
    path: 'assets/audio/discover.mp3',
    layers: [
      { wave: 'triangle', hz: 523, ms: 200, gain: 0.06, attack: 0.02, release: 0.8 },
      { wave: 'triangle', hz: 659, ms: 220, gain: 0.06, delay: 110, attack: 0.02, release: 0.8 },
      { wave: 'triangle', hz: 784, ms: 420, gain: 0.07, delay: 220, attack: 0.02, release: 0.9 }
    ]
  },
  {
    id: 'bench_miss',
    when: 'a blend misses — SOFTER than discover, never a buzzer; a miss still pays a hint',
    path: 'assets/audio/bench_miss.mp3',
    layers: [
      { wave: 'sine', from: 300, to: 260, ms: 260, gain: 0.045, attack: 0.08, release: 0.85 }
    ]
  },
  {
    id: 'unlock',
    when: 'a research node is bought',
    path: 'assets/audio/unlock.mp3',
    layers: [
      { wave: 'triangle', from: 440, to: 660, ms: 300, gain: 0.06, attack: 0.03, release: 0.85 }
    ]
  },
  {
    id: 'purchase',
    when: 'stock or a decoration is paid for',
    path: 'assets/audio/purchase.mp3',
    layers: [
      { wave: 'sine', hz: 520, ms: 90, gain: 0.05, attack: 0.01, release: 0.8 },
      { wave: 'sine', hz: 700, ms: 140, gain: 0.045, delay: 55, attack: 0.01, release: 0.85 }
    ]
  },

  /* --- the shape of the day --- */
  {
    id: 'day_open',
    when: 'the shop opens',
    path: 'assets/audio/day_open.mp3',
    layers: [
      { wave: 'sine', from: 330, to: 494, ms: 380, gain: 0.055, attack: 0.06, release: 0.85 }
    ]
  },
  {
    id: 'day_close',
    when: 'the shop shuts for the night',
    path: 'assets/audio/day_close.mp3',
    layers: [
      { wave: 'sine', from: 440, to: 294, ms: 520, gain: 0.055, attack: 0.06, release: 0.9 }
    ]
  }
];
