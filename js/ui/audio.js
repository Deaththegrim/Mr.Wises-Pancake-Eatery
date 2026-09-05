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

   2. NO AudioContext UNTIL THE PLAYER HAS CLICKED. Browsers refuse to start
      one before a gesture and log a warning when you try. The smoke test
      asserts a clean console precisely so that real warnings are visible, so
      the context is built lazily inside the first play() that follows a
      gesture — and `unlock()` is wired to the first click on the page.

   3. THE MUTE PREFERENCE MAY NOT BE READ DIRECTLY. localStorage THROWS in
      private-browsing mode rather than returning null. main.js already
      learned this about saves; the same trap applies here, and losing the
      preference must not cost the player their sound. */

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

function writeMuted(value) {
  try {
    localStorage.setItem(PREF_KEY, value ? 'off' : 'on');
  } catch (e) {
    /* Nothing to do and nothing worth telling the player: the sound is
       working, it just will not be remembered next time. */
  }
}

/* Build the context, or report that we still cannot. Called from every
   entry point, so the first sound after the first click is the one that
   creates it. */
function ready() {
  if (muted) return false;
  if (ctx) {
    // Chrome suspends the context when a tab is backgrounded.
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return true;
  }
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    loadFiles();
    return true;
  } catch (e) {
    return false;
  }
}

/* REAL RECORDINGS, IF ANY EXIST.

   Same manifest trick as the art: asking for a file that is not there logs
   a 404, and "no file" is the normal state here, so probing fifteen slots
   on every load would bury the warnings the console is for. tools/audio.js
   writes the list. No manifest means no recordings, which is correct on a
   fresh clone. */
function loadFiles() {
  fetch('assets/audio/manifest.json')
    .then(r => (r.ok ? r.json() : Promise.reject(new Error('no manifest'))))
    .then(have => {
      for (const id of Array.isArray(have) ? have : []) {
        const slot = SLOTS.get(id);
        if (!slot || !slot.path) continue;
        fetch(slot.path)
          .then(r => r.arrayBuffer())
          .then(buf => ctx.decodeAudioData(buf))
          .then(decoded => files.set(id, decoded))
          .catch(() => {});     // a bad file just leaves the recipe in place
      }
    })
    .catch(() => {});
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
  const secs = (layer.ms || 0) / 1000;
  const attack = Math.max(0.005, secs * (layer.attack || 0.05));

  gain.gain.setValueAtTime(0.0001, when);
  gain.gain.exponentialRampToValueAtTime(peak, when + attack);

  node.start(when);
  return { node, gain, secs, attack, peak };
}

/* Fade a running voice out and stop it. Never cuts abruptly — a hard stop
   on an oscillator is an audible click, which is exactly the harshness
   this project's design notes say to avoid. */
function release(v, seconds = 0.12) {
  const now = ctx.currentTime;
  try {
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
   negative middle, which would schedule the ramps out of order and drop
   the layer to silence. */
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
    held.set(id, (slot.layers || []).map(layer => voice(layer, now, 1)));
  } catch (e) {
    /* Rule 1. */
  }
}

export function stop(id) {
  try {
    const voices = held.get(id);
    if (!voices) return;
    held.delete(id);
    for (const v of voices) release(v);
  } catch (e) {
    /* Rule 1. */
  }
}

/* Every held sound, cut. Called when a beat ends or a screen changes, so
   a pour cannot keep hissing behind the evening ledger because a mouseup
   landed somewhere unexpected. */
export function stopAll() {
  for (const id of [...held.keys()]) stop(id);
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = !!value;
  writeMuted(muted);
  if (muted) {
    stopAll();
    if (master) master.gain.value = 0;
  } else if (master) {
    master.gain.value = 0.9;
  }
  return muted;
}

export function toggleMuted() {
  return setMuted(!muted);
}

/* Wired to the first interaction with the page. Browsers will not start a
   context before one, and doing it here rather than inside the first beat
   means the first sound the player triggers is not the one that gets
   swallowed while the hardware wakes up. */
export function unlock() {
  ready();
}
