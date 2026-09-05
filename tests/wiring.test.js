import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* THE HOLE THIS CLOSES.

   The suite once reported 227 passing tests against a game that would not
   boot at all: two different `priceOf` imports collided in ui/shopfront.js,
   which is a SyntaxError at parse time, and main.js never loaded. Nothing
   caught it, because no test imports main.js or the ui modules — they need
   a DOM, so the suite had quietly stopped covering a third of the codebase.
   It took loading the page in a browser to find it.

   These tests cover the two ways that class of break happens: a file that
   does not parse, and code reaching for an element the page does not have.
   Both are static checks — no DOM, no browser, no dependency — so they run
   in the fast suite where a mistake gets caught in seconds rather than
   whenever someone next opens smoke.py. */

const root = fileURLToPath(new URL('../', import.meta.url));

const walk = dir => readdirSync(dir).flatMap(name => {
  const full = join(dir, name);
  return statSync(full).isDirectory() ? walk(full) : full.endsWith('.js') ? [full] : [];
});

const sources = walk(join(root, 'js'));

test('every module in js/ parses — including the ones no test imports', () => {
  assert.ok(sources.length > 10, `expected to find the source files, found ${sources.length}`);
  const broken = [];
  for (const file of sources) {
    try {
      execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (e) {
      broken.push(`${file.replace(root, '')}: ${String(e.stderr).split('\n').slice(1, 3).join(' ').trim()}`);
    }
  }
  assert.deepEqual(broken, [],
    'a file that does not parse takes the whole page down, and the rest of the ' +
    'suite will not notice:\n' + broken.join('\n'));
});

test('no module imports the same name twice', () => {
  /* The exact shipped bug, named directly rather than left to the parser:
     ui/shopfront.js pulled `priceOf` from pantry (the price of a unit of
     stock) and `priceOf` from economy (the price of a dish). Two real,
     different things that wanted the same obvious name. */
  const clashes = [];
  for (const file of sources) {
    const src = readFileSync(file, 'utf8');
    const seen = new Map();
    for (const m of src.matchAll(/^import\s+(?:(\w+)\s*,\s*)?\{([^}]*)\}\s+from\s+'([^']+)'/gm)) {
      const names = [
        ...(m[1] ? [m[1]] : []),
        ...m[2].split(',').map(x => x.trim().split(/\s+as\s+/).pop()).filter(Boolean)
      ];
      for (const name of names) {
        if (seen.has(name)) {
          clashes.push(`${file.replace(root, '')}: "${name}" imported from both ` +
                       `${seen.get(name)} and ${m[3]} — alias one of them`);
        }
        seen.set(name, m[3]);
      }
    }
  }
  assert.deepEqual(clashes, [], clashes.join('\n'));
});

test('every element the code reaches for exists in index.html', () => {
  /* getElementById returning null is the other way the page dies at load:
     the call itself is silent and the TypeError lands one line later, on
     .textContent or .addEventListener. */
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));

  const missing = [];
  for (const file of sources) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/getElementById\(\s*'([^']+)'\s*\)/g)) {
      if (!ids.has(m[1])) missing.push(`${file.replace(root, '')} wants #${m[1]}, which index.html does not have`);
    }
  }
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('every screen main.js switches to is a real screen', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const screens = new Set([...html.matchAll(/id="screen-([^"]+)"/g)].map(m => m[1]));
  const missing = [];
  for (const file of sources) {
    const src = readFileSync(file, 'utf8');
    for (const m of src.matchAll(/showScreen\(\s*'([^']+)'\s*\)/g)) {
      if (!screens.has(m[1])) missing.push(`${file.replace(root, '')} shows screen "${m[1]}", which does not exist`);
    }
  }
  assert.deepEqual(missing, [], missing.join('\n'));
});

test('the canvas fallback colours still match the stylesheet', () => {
  /* ui/griddle.js reads the cook-surface tokens off the root element, but
     carries a hardcoded fallback for each — getComputedStyle returns '' if
     the stylesheet has not applied, and an empty fillStyle silently keeps
     the previous colour, which paints the food the colour of the pan.

     Those fallbacks are a second copy of the palette with nothing holding
     the two together, which is precisely the drift the palette reader was
     built to end: before it, the DOM drew a pancake #c98a4b while the
     canvas drew the same pancake #d9a05b. Edit a token in the stylesheet
     and forget the fallback, and the canvas quietly renders the old colour
     for anyone whose CSS is slow. */
  const css = readFileSync(join(root, 'css/style.css'), 'utf8');
  const tokens = new Map(
    [...css.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g)].map(m => [m[1], m[2].toLowerCase()]));

  const griddle = readFileSync(join(root, 'js/ui/griddle.js'), 'utf8');
  const fallbacks = [...griddle.matchAll(/read\(\s*'(--[\w-]+)'\s*,\s*'(#[0-9a-fA-F]{3,8})'\s*\)/g)];

  assert.ok(fallbacks.length >= 8,
    `expected to find the palette fallbacks, found ${fallbacks.length}`);

  const drifted = [];
  for (const [, name, fallback] of fallbacks) {
    // The canvas parses only 3- or 6-digit hex; anything else silently
    // falls back, so the stylesheet must not author these any other way.
    assert.match(fallback, /^#([0-9a-f]{3}|[0-9a-f]{6})$/i,
      `${name}'s fallback ${fallback} is not plain hex, which the canvas cannot parse`);
    if (tokens.has(name)) {
      assert.match(tokens.get(name), /^#([0-9a-f]{3}|[0-9a-f]{6})$/i,
        `style.css authors ${name} as ${tokens.get(name)}; the canvas reads it and needs plain hex`);
    }
    if (!tokens.has(name)) {
      drifted.push(`${name}: griddle.js falls back to ${fallback}, but style.css no longer defines it`);
    } else if (tokens.get(name) !== fallback.toLowerCase()) {
      drifted.push(`${name}: style.css says ${tokens.get(name)}, griddle.js falls back to ${fallback}`);
    }
  }
  assert.deepEqual(drifted, [], drifted.join('\n'));
});
