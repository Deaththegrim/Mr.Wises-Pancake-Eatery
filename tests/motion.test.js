import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* THE MOTION CONTRACT.

   Animation is the one kind of change in this project that can break
   gameplay without breaking anything a test would normally look at. The
   stack beat scores a leaning tower and the drizzle beat samples coverage
   across that same tower, so where the pancakes ARE is gameplay — animate
   a margin instead of a transform and the score quietly stops matching
   what the player saw.

   These are static checks on the stylesheets. They cost nothing and they
   hold three promises that are otherwise only comments. */

const root = fileURLToPath(new URL('../', import.meta.url));
const cssDir = join(root, 'css');
const files = readdirSync(cssDir).filter(f => f.endsWith('.css'));
/* Comments are stripped first. The stylesheets in this project explain
   themselves at length — including, in the motion block, a paragraph about
   why `animation: none` is the wrong tool — and a scanner that reads prose
   as declarations reports the documentation as the defect. */
const decomment = src => src.replace(/\/\*[\s\S]*?\*\//g, '');
const sheets = files.map(f => ({ name: f, src: decomment(readFileSync(join(cssDir, f), 'utf8')) }));
const all = sheets.map(s => s.src).join('\n');

test('reduced motion is honoured, and blankets the whole stylesheet', () => {
  /* Listing animations one by one inside the media query means the next
     one added is uncovered until somebody remembers. The blanket rule is
     covered the day it lands. */
  const at = all.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(at > 0, 'no prefers-reduced-motion block: motion is not optional for everyone');

  const block = all.slice(at, all.indexOf('\n}', all.indexOf('{', at + 40)) + 2);
  assert.match(block, /\*\s*,\s*\*::before\s*,\s*\*::after|\*\s*\{/,
    'the reduced-motion block does not use a universal selector, so it only covers what someone remembered to list');
  assert.match(block, /animation-duration:\s*[^;]+!important/,
    'reduced motion must override animation-duration, and must win');
  assert.match(block, /transition-duration:\s*[^;]+!important/,
    'reduced motion must override transition-duration, and must win');

  /* Why a near-zero DURATION and not `animation: none`. Both look right
     today — checked, not assumed: `none` resets animation-name and every
     sub-property, so no keyframe applies and the element renders at its
     BASE style, and nothing in either sheet carries a static `opacity: 0`
     for it to be stranded at.

     The difference is what happens next. A zero-length animation still
     runs: it fills, and it fires `animationend`. `none` does neither, so
     the first animation anyone writes whose completion something waits on
     would silently never complete — for reduced-motion users only, which
     is the hardest possible bug to find. */
  assert.ok(!/animation:\s*none\s*!important/.test(block),
    'animation:none stops animationend ever firing, for reduced-motion users only — ' +
    'use a near-zero duration, which still fills and still fires');
});

test('nothing animates forever', () => {
  /* Two reasons. The design one: a cozy shop visited for eight weeks must
     not twitch. The practical one: a harness clicking a button waits for
     it to stop moving first, so an endlessly animating one burns its whole
     timeout and then fails pointing at the click rather than at the
     animation that caused it. */
  const offenders = [];
  for (const { name, src } of sheets) {
    for (const m of src.matchAll(/animation[^;{}]*:\s*([^;}]*)/g)) {
      if (/\binfinite\b/.test(m[1])) offenders.push(`${name}: ${m[1].trim()}`);
    }
  }
  assert.deepEqual(offenders, [], `these repeat forever:\n${offenders.join('\n')}`);
});

test('animations move only transform and opacity', () => {
  /* THE ONE THAT PROTECTS THE SCORING. engine/cook.js measures the stack
     the player built and ui/griddle.js samples syrup coverage across it.
     transform and opacity are composited and change no layout, so an
     animated element occupies exactly the box it always did. Animate a
     width, a margin, a top or a height and the thing being scored is no
     longer the thing on screen. */
  /* `translate`, `scale` and `rotate` are the standalone forms of the same
     compositor transform and move layout no more than `transform` does, so
     they belong here — leaving them out would fail a correct stylesheet,
     and a gate that cries wolf is a gate that gets switched off. Vendor
     prefixes are stripped rather than enumerated for the same reason. */
  const allowed = new Set(['transform', 'translate', 'scale', 'rotate',
                           'opacity', 'filter', 'box-shadow', 'color',
                           'background-color', 'border-color', 'outline-color']);
  const bare = prop => prop.replace(/^-(?:webkit|moz|ms|o)-/, '');
  const offenders = [];

  for (const { name, src } of sheets) {
    for (const m of src.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
      // Walk to the matching close brace: keyframes nest one level.
      let i = m.index + m[0].length, depth = 1;
      while (i < src.length && depth > 0) {
        if (src[i] === '{') depth += 1;
        else if (src[i] === '}') depth -= 1;
        i += 1;
      }
      const body = src.slice(m.index + m[0].length, i - 1);
      for (const decl of body.matchAll(/(-?[a-z-]+)\s*:/g)) {
        if (!allowed.has(bare(decl[1]))) {
          offenders.push(`${name}: @keyframes ${m[1]} animates "${decl[1]}", which moves layout`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});

test('every animation names a keyframes that exists', () => {
  /* A typo here is silent: the element simply never animates, which looks
     exactly like a decision not to animate it. */
  const defined = new Set([...all.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]));
  const reserved = new Set(['none', 'ease', 'ease-in', 'ease-out', 'ease-in-out',
                            'linear', 'both', 'forwards', 'backwards', 'infinite',
                            'alternate', 'normal', 'reverse', 'running', 'paused']);
  const missing = [];

  for (const { name, src } of sheets) {
    for (const m of src.matchAll(/\banimation:\s*([^;}]+)/g)) {
      const named = m[1].split(/\s+/)
        .map(t => t.trim())
        .filter(t => /^[a-zA-Z][\w-]*$/.test(t) && !reserved.has(t) && !t.startsWith('cubic'));
      for (const n of named) {
        if (!defined.has(n)) missing.push(`${name}: animation "${n}" has no @keyframes`);
      }
    }
  }
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('the stack beat is animated, and only by transform', () => {
  /* Named directly rather than left to the general rule, because this is
     the one element where the difference between "looks like it moved"
     and "moved" is a score the player can see. */
  assert.match(all, /#plate\s+\.cake\s*\{[^}]*animation:/,
    'the pancakes land instantly, which was the flattest moment in the game');
  const kf = all.slice(all.indexOf('@keyframes settle'));
  const body = kf.slice(0, kf.indexOf('\n}'));
  assert.ok(!/(^|\s)(top|left|bottom|right|width|height|margin)\s*:/m.test(body),
    'the settle animation touches a layout property; the tower on screen would ' +
    'stop matching the tower engine/cook.js scored');
});
