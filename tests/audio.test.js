import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOUNDS } from '../js/data/sounds.js';
import { envelope } from '../js/ui/audio.js';

/* WHAT THESE ARE FOR.

   A sound is the easiest thing in a codebase to get silently wrong. A slot
   nobody plays, an id with a typo, a held sound that is started and never
   stopped — none of them throw, none of them fail a build, and all three
   look exactly like "the audio is a bit off" to whoever notices months
   later. This project has been bitten three times by a resource with no
   sink and once by an entire affection chain that was unit-tested and never
   called, so the tests that matter here are the ones asserting that the
   declared thing is REACHED.

   The recipes themselves are not tested for how they sound. Nothing can
   assert that, and pretending otherwise would be the proxy metric this
   project has a rule against. */

const root = fileURLToPath(new URL('../', import.meta.url));

const walk = dir => readdirSync(dir).flatMap(name => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
});

/* Every call into the sound layer, wherever it lives. The aliases are real:
   ui/griddle.js imports play/start/stop under sfx* names because the pour
   and drizzle beats already have local start/stop of their own.

   BOTH QUOTE STYLES AND TEMPLATE LITERALS. The first cut matched only
   single quotes, which made the typo guard blind in the one direction that
   matters: play("flipp") is silent forever, throws nothing, and would have
   sailed through. The house style is single quotes, but a guard that only
   works while everyone remembers the house style is not a guard. */
const CALL = /\b(?:play|sfx|sfxStart|sfxStop|start|stop)\(\s*['"`]([^'"`]+)['"`]/g;

/* A call whose id is NOT a literal: play(someVar), a ternary, or an id
   read from a data structure. The checks below cannot see through one, so
   rather than let them quietly under-report, they are found and named.
   (A template literal is NOT in this set — CALL accepts backticks, so
   play(`${x}`) is caught by the undeclared-id check instead, which is a
   clearer message anyway.) */
const COMPUTED = /\b(?:play|sfx|sfxStart|sfxStop)\(\s*(?!['"`)])[^)]/g;

/* Callers only. The data file holds the ids, and ui/audio.js DEFINES
   play/start/stop — its own signatures look exactly like calls with a
   computed id, which is what the check below is hunting for. */
const sources = walk(join(root, 'js'))
  .filter(f => !f.endsWith('js/data/sounds.js') && !f.endsWith('js/ui/audio.js'));
const played = new Set();
for (const file of sources) {
  for (const m of readFileSync(file, 'utf8').matchAll(CALL)) played.add(m[1]);
}

test('the slots are well formed', () => {
  const ids = SOUNDS.map(s => s.id);
  assert.ok(ids.length > 0, 'no sounds declared');
  assert.equal(new Set(ids).size, ids.length, 'a duplicate id means one slot can never be reached');

  const paths = SOUNDS.map(s => s.path).filter(Boolean);
  assert.equal(new Set(paths).size, paths.length,
    'two slots reading one file will surprise whoever records it');

  const waves = new Set(['sine', 'triangle', 'square', 'sawtooth', 'noise']);
  const filters = new Set(['lowpass', 'highpass', 'bandpass']);

  for (const s of SOUNDS) {
    assert.ok(s.when && s.when.length > 4,
      `${s.id} has no "when" — the checklist prints it, and a slot nobody can place is a slot nobody records`);
    assert.ok(Array.isArray(s.layers) && s.layers.length > 0, `${s.id} has no layers, so it is silent`);

    for (const [i, l] of s.layers.entries()) {
      const where = `${s.id} layer ${i}`;
      assert.ok(waves.has(l.wave), `${where}: "${l.wave}" is not a wave the browser can make`);
      assert.ok(l.hz != null || l.from != null || l.wave === 'noise',
        `${where}: no pitch, and only noise may go without one`);

      /* Exponential ramps cannot pass through zero: the call throws a
         RangeError synchronously, at the call site. ui/audio.js already
         clamps the one value that reaches such a ramp
         (`Math.max(1, layer.to * rate)`), so this does not prevent a
         throw — it prevents the quieter thing the clamp cannot: a pitch
         of 0 authored in the data, silently rewritten to 1 Hz or to the
         440 default, giving a layer nobody chose the pitch of. */
      for (const k of ['hz', 'from', 'to']) {
        if (l[k] != null) assert.ok(l[k] > 0, `${where}: ${k} must be above zero`);
      }

      assert.ok(l.gain > 0 && l.gain <= 0.3,
        `${where}: gain ${l.gain} is outside 0–0.3. The house style is quiet; ` +
        'the design note this project keeps returning to is that medium juice beats extreme juice.');

      if (l.filter) {
        assert.ok(filters.has(l.filter), `${where}: unknown filter "${l.filter}"`);
        /* The one field with no check, and `filterHz || 1000` rewrites a 0
           into 1000 — so "no filtering", the obvious thing a 0 means, is
           silently a filter at a pitch nobody chose. */
        assert.ok(l.filterHz > 0,
          `${where}: filter "${l.filter}" needs a filterHz above zero; a 0 is silently read as 1000`);
      } else {
        assert.ok(l.filterHz == null,
          `${where}: filterHz is set but there is no filter to apply it to`);
      }
      if (l.attack != null) assert.ok(l.attack >= 0 && l.attack <= 1, `${where}: attack is a fraction of ms`);
      if (l.release != null) assert.ok(l.release >= 0 && l.release <= 1, `${where}: release is a fraction of ms`);

      // A one-shot with no duration never stops; a sustained one is stopped by hand.
      if (!s.sustain) assert.ok(l.ms > 0, `${where}: a one-shot layer needs a duration`);
    }
  }
});

test('every declared sound is actually played by the game', () => {
  /* THE BUG CLASS THIS PROJECT KEEPS HITTING. A slot declared and never
     played is dead weight that reads as finished work — the same shape as
     the syrups that paid out in nothing and the affection chain that was
     never called. */
  const orphaned = SOUNDS.map(s => s.id).filter(id => !played.has(id));
  assert.deepEqual(orphaned, [],
    `declared in data/sounds.js but nothing plays them: ${orphaned.join(', ')}`);
});

test('every sound the code plays is declared', () => {
  /* The reverse, and the one a typo produces: play('flipp') is silent
     forever, throws nothing, and looks like a sound nobody has made yet. */
  const declared = new Set(SOUNDS.map(s => s.id));
  const unknown = [...played].filter(id => !declared.has(id));
  assert.deepEqual(unknown, [],
    `played by the code but not declared in data/sounds.js: ${unknown.join(', ')}`);

  /* Not "we found something" — that passed while only the two held sounds
     were wired, because start()/stop() match the same pattern. At least
     one ONE-SHOT must be played through play()/sfx(), or the whole
     one-shot path is unexercised and this test is checking an empty set. */
  const oneShots = new Set(SOUNDS.filter(s => !s.sustain).map(s => s.id));
  const playedOneShots = [...played].filter(id => oneShots.has(id));
  assert.ok(playedOneShots.length > 3,
    `only ${playedOneShots.length} one-shot sound(s) are actually played; the one-shot path is barely wired`);
});

test('no sound is played through an id the guards cannot see', () => {
  /* A computed id — play(someVar), or a ternary — is invisible to the
     checks above, so a typo inside one is silent forever and an orphaned
     slot goes unreported. This has already happened once:
     play(x ? 'bell_quiet' : 'bell') hid BOTH ids and the guard could not
     vouch for either. Two literal calls cost nothing. */
  const computed = [];
  for (const file of sources) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(COMPUTED)) {
      const line = src.slice(0, m.index).split('\n').length;
      computed.push(`${file.replace(root, '')}:${line} — ${src.slice(m.index, m.index + 48).split('\n')[0]}`);
    }
  }
  assert.deepEqual(computed, [],
    'these play a sound through something other than a plain literal, which ' +
    'no guard here can follow:\n' + computed.join('\n'));
});

test('every held sound is both started and stopped', () => {
  /* A sustained slot that is started and never stopped runs until the tab
     closes. The pour beat is press-and-hold, so this is one missed handler
     away at all times. */
  const src = sources.map(f => readFileSync(f, 'utf8')).join('\n');
  for (const s of SOUNDS.filter(x => x.sustain)) {
    assert.match(src, new RegExp(`(?:sfxStart|start)\\(\\s*'${s.id}'`),
      `${s.id} is a held sound that nothing starts`);
    assert.match(src, new RegExp(`(?:sfxStop|stop)\\(\\s*'${s.id}'`),
      `${s.id} is a held sound that nothing stops — it would run until the tab closes`);
  }
});

test('one-shot slots are never started as held sounds, and vice versa', () => {
  const sustained = new Set(SOUNDS.filter(s => s.sustain).map(s => s.id));
  const src = sources.map(f => readFileSync(f, 'utf8')).join('\n');

  for (const s of SOUNDS) {
    const heldCall = new RegExp(`(?:sfxStart|sfxStop)\\(\\s*'${s.id}'`);
    if (s.sustain) {
      assert.ok(!new RegExp(`(?:^|[^a-zA-Z])(?:play|sfx)\\(\\s*'${s.id}'`, 'm').test(src),
        `${s.id} is sustained, so play() ignores it — it must be started and stopped`);
    } else if (heldCall.test(src)) {
      assert.fail(`${s.id} is a one-shot, so start()/stop() ignore it — it would never be heard`);
    }
  }
  assert.ok(sustained.size > 0, 'expected at least one held sound');
});

test('the sound layer cannot break the game', () => {
  /* Rule 1 of ui/audio.js, asserted rather than trusted. Sound is
     decoration; a browser with audio disabled, or a blocked AudioContext,
     must cost the noise and nothing else. Every exported entry point
     therefore has to carry its own try/catch. */
  const src = readFileSync(join(root, 'js/ui/audio.js'), 'utf8');

  /* EVERY export that DOES something, found by reading the file rather
     than by listing three names. The comment said "every exported entry
     point" and the loop checked play/start/stop — so stopAll, setMuted,
     toggleMuted and unlock were unguarded while the test asserted they
     were not. setMuted was the sharp one: it assigns `muted` before
     touching the audio graph, so a throw skipped the caller's re-render
     and left the button's label asserting the opposite of the state the
     function had already committed.

     The pure readers are exempt by name and by reason: they contain no
     statement that can throw, and wrapping them would only hide a future
     mistake. */
  const PURE = new Set(['isMuted', 'audible', 'envelope']);
  const exported = [...src.matchAll(/export function (\w+)\(/g)].map(m => m[1]);
  assert.ok(exported.length >= 6, `expected to find the exports, found ${exported.length}`);

  for (const name of exported) {
    if (PURE.has(name)) continue;
    const at = src.indexOf(`export function ${name}(`);
    const body = src.slice(at, src.indexOf('\n}', at));
    assert.ok(body.includes('try {'),
      `${name}() has no try/catch — a failure in the audio layer would reach the game`);
  }

  /* The context must not be built at import time: browsers refuse before a
     gesture, hand back a SUSPENDED context, and log a warning — which
     smoke.py now fails the run on, along with errors. */
  /* MODULE SCOPE MEANS COLUMN ZERO. The first cut sliced up to the first
     `export function`, which in this file lands after readMuted, ready(),
     loadFiles and voice() — so it was checking most of the module's
     FUNCTION BODIES and calling that module scope. It failed both ways: a
     correct lazy `new AudioContext()` inside ready() would have been
     reported as a module-scope build, and a genuine module-scope
     `ctx = new AudioContext()` (an assignment, not a declaration) matched
     nothing and sailed through.

     Statements at module scope start at column zero, so that is what this
     looks for — any construction, declared or assigned. */
  const moduleScope = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => line.length && !/^\s/.test(line))
    .join('\n');
  assert.ok(!/new\s+(?:window\.)?(?:Audio|webkitAudio)Context|new\s+Ctor\b/.test(moduleScope),
    'an AudioContext is built at module scope; browsers refuse before a gesture ' +
    'and hand back a suspended context that plays nothing');
});

test('the mute preference survives a browser that blocks storage', () => {
  /* main.js already learned this about saves: localStorage THROWS in
     private-browsing mode rather than returning null. Losing the preference
     is fine; losing the sound, or the page, is not. */
  const src = readFileSync(join(root, 'js/ui/audio.js'), 'utf8');
  for (const call of ['localStorage.getItem', 'localStorage.setItem']) {
    const at = src.indexOf(call);
    assert.ok(at > 0, `expected ${call} in the sound layer`);
    const before = src.slice(Math.max(0, at - 400), at);
    assert.ok(before.includes('try {'), `${call} is not inside a try/catch`);
  }
});

test('release actually shapes the sound', () => {
  /* THE BUG THIS EXISTS FOR. The first implementation used `release` only
     to delay when the node stopped — the gain ramp ran from the end of the
     attack to the end of the sound regardless — so a field documented as
     "fade-out" was inaudible, and every layer faded over whatever
     `ms - attack` happened to be. A declared value nothing reads is this
     project's recurring bug class; this one hid in a browser-only file
     where nothing in the suite could reach it, which is why the envelope
     is now pure arithmetic sitting behind an export. */
  const base = { ms: 400, attack: 0.1, release: 0.5 };
  const a = envelope(base);
  const b = envelope({ ...base, release: 0.25 });

  assert.ok(a.release > b.release,
    'a larger release must produce a longer fade, or the field is decorative');
  assert.ok(b.hold > a.hold, 'and a shorter fade must leave more of the sound at full volume');

  // ms is the whole sound: the three parts add up to it, and never past it.
  for (const env of [a, b]) {
    assert.ok(Math.abs((env.attack + env.hold + env.release) - env.total) < 1e-9,
      `the envelope does not add up to ms: ${JSON.stringify(env)}`);
  }

  /* The ramps are scheduled in order, so the parts may never be negative —
     a negative hold would schedule the fade before the attack finished and
     drop the layer to silence. Extreme values must degrade, not break. */
  for (const layer of [{ ms: 400, attack: 0.9, release: 0.9 },
                       { ms: 30, attack: 1, release: 1 },
                       { ms: 0 }, {}]) {
    const env = envelope(layer);
    for (const [part, v] of Object.entries(env)) {
      assert.ok(v >= 0 && Number.isFinite(v),
        `${part} is ${v} for ${JSON.stringify(layer)}; the layer would never be heard`);
    }
    assert.ok(env.attack + env.release <= env.total + 1e-9,
      `attack and release overlap for ${JSON.stringify(layer)}`);
  }

  // And every shipped layer survives it.
  for (const s of SOUNDS.filter(x => !x.sustain)) {
    for (const [i, l] of s.layers.entries()) {
      const env = envelope(l);
      assert.ok(env.release > 0, `${s.id} layer ${i} has no fade-out at all`);
      assert.ok(env.total > 0, `${s.id} layer ${i} has no length`);
    }
  }
});

test('a held slot declares no field that a held slot ignores', () => {
  /* THE SAME BUG CLASS AS `release`, one level down. A sustained slot has
     no `ms`, so it has no envelope to divide: it fades in over a fixed 5ms
     and out over a fixed 120ms, and `attack`/`release` on such a row are
     read by nothing. Both held rows carried them anyway — three declared,
     documented, tunable numbers that did nothing, sitting directly beneath
     the comment explaining that the envelope refactor exists to stop
     exactly that.

     The shipped-layer sweep in the envelope test filters `!sustain`, so it
     structurally cannot see these. This is the check that can. */
  for (const s of SOUNDS.filter(x => x.sustain)) {
    for (const [i, l] of s.layers.entries()) {
      for (const dead of ['attack', 'release']) {
        assert.ok(!(dead in l),
          `${s.id} layer ${i} declares "${dead}", which a held sound ignores — ` +
          'it reads as a knob and is not one. Remove it, or make start()/stop() read it.');
      }
    }
  }
});

test('the envelope arithmetic has exactly one home', () => {
  /* voice() and envelope() each had their own copy of the attack formula —
     `layer.attack || 0.05` against `layer.attack != null ? layer.attack :
     0.05`. They agreed on every shipped row and diverged on `attack: 0`,
     which the schema above explicitly permits: one ramped toward 5% of the
     sound while the other pinned the hold at 5ms, scheduling the peak
     part-way up the climb. Two formulas for one number is the drift this
     project has a rule about. */
  /* Comments stripped first. The paragraph explaining this very drift
     quotes both old formulas, so a scanner that reads prose as code counts
     the explanation as the offence — which is the second time in this
     suite that has happened, and the reason it is worth naming here. */
  const src = readFileSync(join(root, 'js/ui/audio.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  /* The precise contract: envelope() is the only place that turns a
     layer's `attack` into seconds. Counting occurrences was the wrong
     test — the one correct line mentions it twice in a single ternary. */
  const bodyOf = name => {
    const at = src.indexOf(`function ${name}(`);
    assert.ok(at > 0, `expected to find ${name}() in js/ui/audio.js`);
    return src.slice(at, src.indexOf('\n}', at));
  };

  assert.ok(!/layer\.attack/.test(bodyOf('voice')),
    'voice() computes its own attack again. envelope() owns that arithmetic; ' +
    'two copies agreed on every shipped row and diverged on attack: 0.');
  assert.match(bodyOf('voice'), /envelope\(layer\)/,
    'voice() should take its attack from envelope()');
  assert.match(bodyOf('envelope'), /layer\.attack/,
    'envelope() should be the one place a layer\'s attack is read');
});

test('the recordings folder the slots point into exists', () => {
  // A path into a folder nobody made is a file nobody will find.
  const dirs = new Set(SOUNDS.filter(s => s.path).map(s => s.path.split('/').slice(0, -1).join('/')));
  for (const dir of dirs) {
    assert.ok(existsSync(join(root, dir)),
      `${dir}/ does not exist, so a recording placed there is invisible`);
  }
});
