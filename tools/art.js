/* The art checklist. Run: node tools/art.js

   Lists every picture the game can use, whether there is a file for it
   yet, and what it has to show. Nothing here is required — every empty
   slot draws a placeholder — so this is a worklist, not a test. It exits
   0 whether the list is empty or full.

   It DOES fail on a file that exists but cannot be used: a wrong format,
   or an empty file. Those are the only two states worth stopping for,
   because both look exactly like "not drawn yet" in the game. */

import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname } from 'node:path';
import { ART } from '../js/data/art.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* PNG and JPEG dimensions, read from the header. No dependency: this
   project has none, and adding one to print a checklist would be a poor
   trade. */
function dimensions(file) {
  const buf = readFileSync(file);
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), kind: 'png' };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i += 1; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5), kind: 'jpeg' };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

const pad = (s, n) => String(s).padEnd(n);
const filled = [], empty = [], broken = [];

for (const slot of ART) {
  const file = join(root, slot.path);
  if (!existsSync(file)) { empty.push(slot); continue; }
  if (statSync(file).size === 0) {
    broken.push({ slot, why: 'the file is empty' });
    continue;
  }
  const dim = dimensions(file);
  if (!dim) {
    broken.push({ slot, why: `not a PNG or JPEG (${extname(file) || 'no extension'})` });
    continue;
  }
  filled.push({ slot, dim });
}

console.log(`\nART — ${filled.length} of ${ART.length} slots filled\n`);

if (filled.length) {
  console.log('  IN THE GAME');
  for (const { slot, dim } of filled) {
    const wanted = `${slot.w}x${slot.h}`;
    const got = `${dim.w}x${dim.h}`;
    const ratio = (dim.w / dim.h) / (slot.w / slot.h);
    // Size is a suggestion; SHAPE is not, for anything drawn to a box.
    const note = got === wanted ? ''
      : (ratio > 1.15 || ratio < 0.87)
        ? `  (${got} — a different shape from the ${wanted} this slot expects; it will be fitted)`
        : `  (${got}, scaled)`;
    console.log(`    ${pad(slot.id, 20)} ${got}${note}`);
  }
  console.log('');
}

if (empty.length) {
  console.log('  STILL PLACEHOLDER');
  for (const slot of empty) {
    console.log(`    ${pad(slot.id, 20)} ${pad(slot.path, 36)} ${slot.w}x${slot.h}`);
    console.log(`    ${pad('', 20)} ${slot.needs}`);
    console.log(`    ${pad('', 20)} replaces: ${slot.replaces}\n`);
  }
}

if (broken.length) {
  console.log('  CANNOT BE USED — these look exactly like "not drawn yet" in the game');
  for (const { slot, why } of broken) console.log(`    ${pad(slot.id, 20)} ${slot.path} — ${why}`);
  console.log('');
}

/* The game reads this to know which slots to request, so it never asks
   for a file that is not there and never logs a 404 the console does not
   need. Written every run, so "add the file, run the checklist, reload"
   is the whole workflow. */
const manifest = join(root, 'assets/manifest.json');
writeFileSync(manifest, JSON.stringify(filled.map(f => f.slot.id), null, 2) + '\n');
console.log(`  assets/manifest.json updated — ${filled.length} slot(s) listed for the game to load.\n`);

console.log(empty.length || broken.length
  ? 'Drop a file at the path shown and reload the page. No code change, no build step.\n'
  : 'Every slot is filled.\n');

process.exit(broken.length ? 1 : 0);
