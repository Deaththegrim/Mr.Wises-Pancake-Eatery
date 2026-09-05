import { SOUNDS } from '../data/sounds.js';

/* THE SOUND LAYER.

   Reads the recipes in data/sounds.js and plays them with Web Audio, so
   the game has sound with no asset files, no library and no build step. A
   real recording dropped at a slot's `path` is used instead of its recipe.

   THREE RULES THIS MODULE KEEPS, EACH FOR A REASON THE PROJECT HAS ALREADY
   BEEN BITTEN BY:

   1. NOTHING HERE MAY THROW. Sound is decoration; the game is not. Every
      entry point swallows its own errors, so a browser with audio disabled,
      a blocked AudioContext, or a malformed row loses the noise and nothing
      else. A game that will not serve a customer because a beep failed is a
      worse game than a silent one.

   2. NO AudioContext UNTIL THE PLAYER HAS MADE A GESTURE. Browsers refuse
      to start one before a click or a key press, log a warning when you
      try, and hand back a SUSPENDED context that plays nothing. The smoke
      test fails on console warnings as well as errors, so that warning
      would fail the run — but the reason to avoid it is the suspended
      context, not the log line. Built lazily inside the first play() after
      a gesture, with `unlock()` wired to the first click or keydown.

   3. THE MUTE PREFERENCE MAY NOT BE TOUCHED DIRECTLY. A browser set to
      block site data throws SecurityError on merely ACCESSING
      window.localStorage, and some browsers throw QuotaExceededError from
      setItem while getItem works fine. (Not "private browsing returns
      null" — current Chrome Incognito and Firefox Private both give a
      working, ephemeral store, and a missing key returns null everywhere,
      which is the ordinary case handled at the read below.) Losing the
      preference must not cost the player their sound — and, on the write
      side, must not silently un-mute them at every reload. */

const SLOTS = new Map(SOUNDS.map(s => [s.id, s]));
const PREF_KEY = 'pancake_shop_sound';

let ctx = null;
let master = null;
let muted = readMuted();
let files = new Map();          // id -> decoded AudioBuffer, when one exists
const held = new Map();         // id -> the running voices of a sustained slot

function readMuted() {
  try {
    return localStorage.getItem(PREF_KEY) === 'off';
  } catch (e) {
    return false;               // blocked storage: play, and forget the choice
  }
}

let warnedNoPref = false;

function writeMuted(value) {
  try {
    localStorage.setItem(PREF_KEY, value ? 'off' : 'on');
  } catch (e) {
    /* The READ side losing a preference is harmless — the game plays. The
       WRITE side is the opposite case and used to be dismissed with the
       same shrug: a player who asks for silence and cannot have it
       remembered gets the sound turned back on at every single reload,
       forever, with nothing explaining why. They re-mute every session.
       Worth one line in the console rather than a shrug. */
    if (!warnedNoPref) {
      warnedNoPref = true;
      console.warn('[audio] this browser will not remember the sound setting ' +
                   `(${e && e.message ? e.message : e}).`);
    }
  }
}

/* Build the context, or report that we still cannot. Called from every
   entry point, so the first sound after the first click is the one that
   creates it. */
let warnedNoAudio = false;

function ready() {
  if (muted) return false;
  try {
    if (ctx) {
      /* A context built outside a user-activation window starts SUSPENDED
         and stays that way until something resumes it — that, not tab
         backgrounding, is the state this rescues. (Desktop Chrome does not
         suspend a running context merely for being in a background tab;
         background playback is the obvious counterexample.) It matters
         because construction below does not resume, so the first sound
         after an early construction depends on this line. */
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return noAudio('this browser has no AudioContext');
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    loadFiles();
    return true;
  } catch (e) {
    return noAudio(e && e.message ? e.message : String(e));
  }
}

/* SAY SO, ONCE. Rule 1 forbids THROWING, not reporting — and a game that
   is permanently silent because the context could never be built is
   indistinguishable, from both the player's side and a developer's, from a
   game whose sound is simply turned down. The HUD button reads the stored
   preference, so it will happily say "Sound: on" over total silence.

   A warning rather than an error. Both fail the smoke run, so this is not
   about slipping past the gate — it is that "this browser cannot make
   sound" is a fact about the machine, not a defect in the build, and the
   two deserve different words. Headless Chromium does provide an
   AudioContext, so a healthy run never reaches here. */
function noAudio(why) {
  if (!warnedNoAudio) {
    warnedNoAudio = true;
    console.warn(`[audio] no audio in this browser (${why}); the game will be silent.`);
  }
  return false;
}

/* Whether sound can actually be made right now, as opposed to whether the
   player has asked for it. Exported so the difference is observable at all:
   without this the two are indistinguishable from outside the module, and
   the smoke test could only check that the browser SHIPS an AudioContext —
   which is a fact about Chromium, not about this game. */
export function audible() {
  return !!ctx && ctx.state === 'running' && !muted;
}

/* REAL RECORDINGS, IF ANY EXIST.

   `assets/audio/manifest.json` lists the slots that have a file, and is
   written by `node tools/audio.js`. The manifest is REQUIRED here — unlike
   the art layer, which falls back to probing every slot when its manifest
   is missing, this loads nothing without one. That is a deliberate
   difference: an unfilled art slot is the normal state and its placeholder
   is visibly a placeholder, whereas an unrecorded sound already plays its
   recipe and sounds finished, so probing fifteen paths on every load would
   buy nothing and cost fifteen 404s.

   The practical consequence, and it is the one people trip over: dropping
   a file in is NOT enough. Run the tool, then reload.

   EVERY FAILURE HERE IS REPORTED. It used to be swallowed, and that made
   the one mistake this path invites invisible: record a file, run the
   tool, reload, hear the recipe, and conclude the recording is playing. A
   404 or a wrong container returns a body that `arrayBuffer()` accepts
   happily and `decodeAudioData` then rejects — silently, with the recipe
   still in place and nothing anywhere saying so. */
function loadFiles() {
  fetch('assets/audio/manifest.json')
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(have => {
      for (const id of Array.isArray(have) ? have : []) {
        const slot = SLOTS.get(id);
        if (!slot || !slot.path) {
          console.warn(`[audio] manifest lists "${id}", which data/sounds.js does not declare — re-run tools/audio.js`);
          continue;
        }
        fetch(slot.path)
          .then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.arrayBuffer();
          })
          .then(buf => ctx.decodeAudioData(buf))
          .then(decoded => files.set(id, decoded))
          .catch(e => console.warn(
            `[audio] "${slot.path}" could not be used (${e.message}); playing the built-in recipe instead.`));
      }
    })
    .catch(e => {
      /* No manifest at all is the fresh-clone state and entirely normal:
         every sound plays its recipe. Only say something if the file is
         there but unreadable, which means the tool wrote something broken. */
      if (!/HTTP 404/.test(e.message)) {
        console.warn(`[audio] assets/audio/manifest.json unreadable (${e.message}); recipes only.`);
      }
    });
}

/* One layer of a recipe, wired up and started. Returns the nodes so a
   sustained slot can stop them again. */
function voice(layer, when, rate) {
  const gain = ctx.createGain();
  let node;

  if (layer.wave === 'noise') {
    /* White noise has no oscillator, so it is a short buffer looped. One
       second is long enough that the loop point is not audible under a
       filter, and small enough to build on demand. */
    const frames = Math.floor(ctx.sampleRate);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = Math.random() * 2 - 1;
    node = ctx.createBufferSource();
    node.buffer = buffer;
    node.loop = true;
  } else {
    node = ctx.createOscillator();
    node.type = layer.wave || 'sine';
    const from = (layer.from != null ? layer.from : layer.hz || 440) * rate;
    node.frequency.setValueAtTime(from, when);
    if (layer.to != null && layer.ms) {
      node.frequency.exponentialRampToValueAtTime(
        Math.max(1, layer.to * rate), when + layer.ms / 1000);
    }
  }

  let tail = node;
  if (layer.filter) {
    const f = ctx.createBiquadFilter();
    f.type = layer.filter;
    f.frequency.value = layer.filterHz || 1000;
    tail.connect(f);
    tail = f;
  }
  tail.connect(gain);
  gain.connect(master);

  const peak = layer.gain || 0.05;
  /* THE SAME arithmetic play() will use, not a second copy of it. These
     were two formulas — `layer.attack || 0.05` here against
     `layer.attack != null ? layer.attack : 0.05` in envelope() — which
     agree on every shipped row and diverge on `attack: 0`, a value the
     schema explicitly allows. There, this ramped toward 5% of the sound
     while play() pinned the hold at 5ms, scheduling the peak mid-climb. */
  const env = envelope(layer);
  const attack = layer.ms ? env.attack : 0.005;   // held layers have no ms

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + attack);

  node.start(when);
  return { node, gain, secs: env.total, attack, peak };
}

/* Fade a running voice out and stop it. Never cuts abruptly — a hard stop
   on an oscillator is an audible click, which is exactly the harshness
   this project's design notes say to avoid. */
function release(v, seconds = 0.12) {
  try {
    /* Inside the try on purpose. It was one line above, so a throw from
       reading ctx.currentTime escaped this function's own catch into the
       caller's — and stop() had already removed the entry from `held` by
       then, leaving the remaining voices running and unreachable by
       stopAll() for the rest of the session. */
    const now = ctx.currentTime;
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(Math.max(0.0001, v.gain.gain.value), now);
    v.gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    v.node.stop(now + seconds + 0.02);
  } catch (e) {
    /* Already stopped. */
  }
}

/* THE ENVELOPE, as arithmetic rather than as scheduling calls.

   Pure, exported and unit-tested, because the first version of this was
   wrong in a way no test could see: `release` only delayed when the node
   stopped and never touched the gain, so the fade-out was always whatever
   `ms - attack` happened to be and the knob documented as "fade-out" did
   nothing audible at all. A declared value nothing reads is the exact bug
   class this project keeps hitting; the difference here is that the value
   lived in a browser-only file where the suite could not reach it.

   Now it is three numbers a test can check:

     |<-attack->|<----- hold ----->|<--release-->|
     0                                          ms

   `ms` stays the total length, so a sound is exactly as long as its row
   says. Both fractions are clamped so they cannot overlap: at their most
   extreme the sound becomes attack-then-release with no hold, never a
   negative middle. That clamp is for the ARITHMETIC's sake rather than to
   avert a crash — play() also guards with `if (env.hold > 0)`, and the
   Web Audio timeline sorts automation events by time regardless of the
   order they are scheduled in, so an out-of-order call would neither throw
   nor mute the parameter. A negative part would simply be a lie about the
   shape, which is worse in a number other code reads. */
export function envelope(layer = {}) {
  const total = Math.max(0, (layer.ms || 0) / 1000);
  const attack = Math.min(total, Math.max(0.005, total * (layer.attack != null ? layer.attack : 0.05)));
  const release = Math.min(total - attack,
                           Math.max(0.02, total * (layer.release != null ? layer.release : 0.5)));
  return {
    attack,
    release: Math.max(0, release),
    hold: Math.max(0, total - attack - Math.max(0, release)),
    total
  };
}

/* Play a one-shot. `rate` bends the pitch, which is how the stack beat
   makes each pancake land a little higher than the last without needing
   its own slot per layer. */
export function play(id, { rate = 1 } = {}) {
  try {
    const slot = SLOTS.get(id);
    if (!slot || slot.sustain) return;
    if (!ready()) return;

    const recording = files.get(id);
    if (recording) {
      const src = ctx.createBufferSource();
      src.buffer = recording;
      src.playbackRate.value = rate;
      src.connect(master);
      src.start();
      return;
    }

    const now = ctx.currentTime;
    for (const layer of slot.layers || []) {
      const at = now + (layer.delay || 0) / 1000;
      const v = voice(layer, at, rate);
      const env = envelope(layer);

      /* voice() has already ramped up to peak by `at + attack`. Hold it
         there, then fade across `release` so the sound ends exactly at
         `at + total` — its declared ms, no longer and no shorter. The
         hold is pinned explicitly because without it the ramp below would
         interpolate from the end of the attack, stretching the fade over
         the whole sound and making `release` decorative. */
      if (env.hold > 0) v.gain.gain.setValueAtTime(v.peak, at + env.attack + env.hold);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, at + env.total);
      v.node.stop(at + env.total + 0.02);
    }
  } catch (e) {
    /* Rule 1. */
  }
}

/* Begin a held sound. Calling it twice without stopping is a no-op rather
   than a second copy layered over the first — the pour button fires on
   mousedown, keydown AND touchstart, and a key held down repeats. */
export function start(id) {
  try {
    const slot = SLOTS.get(id);
    if (!slot || !slot.sustain || held.has(id)) return;
    if (!ready()) return;
    const now = ctx.currentTime;

    /* REGISTER AS WE BUILD, not after. A .map() that throws part-way
       through would leave the earlier layers started, connected and
       LOOPING with no stop scheduled — and absent from `held`, so neither
       stop() nor stopAll() could ever reach them. That is a hiss for the
       rest of the session that no control in the game can silence, and
       Rule 1's catch would hide the cause. Both held slots have one layer
       today, so it is unreachable; the data file documents `layers` as
       "one or more", so it is one edit away. */
    const voices = [];
    held.set(id, voices);
    for (const layer of slot.layers || []) voices.push(voice(layer, now, 1));
  } catch (e) {
    /* Rule 1. */
  }
}

export function stop(id) {
  try {
    const voices = held.get(id);
    if (!voices) return;
    /* Release FIRST, de-register after, and guard each voice separately:
       deleting up front meant a throw on voice 0 left voices 1..n running
       and no longer reachable from `held`. */
    for (const v of voices) {
      try { release(v); } catch (e) { /* that voice is already gone */ }
    }
    held.delete(id);
  } catch (e) {
    /* Rule 1. */
  }
}

/* Every held sound, cut. Called when a beat ends or a screen changes, so
   a pour cannot keep hissing behind the evening ledger because a mouseup
   landed somewhere unexpected. */
export function stopAll() {
  try {
    for (const id of [...held.keys()]) stop(id);
  } catch (e) {
    /* Rule 1. Safe by delegation before this — every stop() catches — but
       that was accident rather than design, and the test that enforces the
       rule only covered three of the exports. */
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  try {
    writeMuted(muted);
    if (muted) {
      stopAll();
      if (master) master.gain.value = 0;
    } else if (master) {
      master.gain.value = 0.9;
    }
  } catch (e) {
    /* Rule 1 — and this one was the sharp case. `muted` is assigned before
       any of the above, so a throw here used to escape to the caller and
       skip the caller's re-render, leaving the button's label asserting the
       opposite of the state this function had already committed. */
  }
  return muted;
}

export function toggleMuted() {
  try {
    return setMuted(!muted);
  } catch (e) {
    /* Rule 1, by construction rather than by delegation. setMuted() does
       not throw today, so this is unreachable — which is the point: the
       guarantee should not depend on a neighbour's implementation staying
       the way it is. Returns the state as it stands so a caller rendering
       from the result still shows something true. */
    return muted;
  }
}

/* Wired to the first click OR key press. Browsers will not start a context
   before a user gesture, and doing it here rather than inside the first
   beat means the first sound the player triggers is not the one swallowed
   while the hardware wakes up.

   Keys matter as much as clicks: the pour beat is operable from the
   keyboard on purpose (ui/griddle.js starts it on keydown), so a
   click-only unlock left keyboard-only players building their context
   inside the first beat — exactly the case this is meant to avoid. */
export function unlock() {
  try {
    ready();
  } catch (e) {
    /* Rule 1. */
  }
}
