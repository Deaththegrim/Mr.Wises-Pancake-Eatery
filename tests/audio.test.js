import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOUNDS } from '../js/data/sounds.js';

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
   and drizzle beats already have local start/stop of their own. */
const CALL = /\b(?:play|sfx|sfxStart|sfxStop|start|stop)\(\s*'([^']+)'/g;

const sources = walk(join(root, 'js')).filter(f => !f.endsWith('js/data/sounds.js'));
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

      /* Web Audio's exponential ramps cannot touch zero — the pitch glide
         and every envelope use them, and a 0 here throws inside the audio
         thread where the try/catch in ui/audio.js would swallow it and the
         sound would just never play. */
      for (const k of ['hz', 'from', 'to']) {
        if (l[k] != null) assert.ok(l[k] > 0, `${where}: ${k} must be above zero`);
      }

      assert.ok(l.gain > 0 && l.gain <= 0.3,
        `${where}: gain ${l.gain} is outside 0–0.3. The house style is quiet; ` +
        'the design note this project keeps returning to is that medium juice beats extreme juice.');

      if (l.filter) assert.ok(filters.has(l.filter), `${where}: unknown filter "${l.filter}"`);
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
  assert.ok(played.size > 0, 'expected to find the play() calls');
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
  for (const name of ['play', 'start', 'stop']) {
    const body = src.slice(src.indexOf(`export function ${name}(`));
    const end = body.indexOf('\n}');
    assert.ok(body.slice(0, end).includes('try {'),
      `${name}() has no try/catch — a failure in the audio layer would reach the game`);
  }

  /* The context must not be built at import time: browsers refuse before a
     gesture and log a warning, and smoke.py asserts a clean console so that
     real warnings stay visible. */
  const topLevel = src.slice(0, src.indexOf('export function'));
  assert.ok(!/^\s*(?:const|let)\s+\w+\s*=\s*new\s+(?:window\.)?(?:Audio|webkitAudio)Context/m.test(topLevel),
    'an AudioContext is built at module scope, which warns before the first click');
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

test('the recordings folder the slots point into exists', () => {
  // A path into a folder nobody made is a file nobody will find.
  const dirs = new Set(SOUNDS.filter(s => s.path).map(s => s.path.split('/').slice(0, -1).join('/')));
  for (const dir of dirs) {
    assert.ok(existsSync(join(root, dir)),
      `${dir}/ does not exist, so a recording placed there is invisible`);
  }
});
