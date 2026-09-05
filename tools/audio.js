/* The audio checklist. Run: node tools/audio.js

   Every sound the game can make, when it plays, and whether a real
   recording has replaced its built-in recipe.

   NOTHING HERE IS REQUIRED. Unlike the art, an empty slot is not silent —
   it plays a recipe the browser performs itself, so the game has sound on
   a fresh clone with no files at all. Recording over one is an upgrade,
   not a repair, and this is a worklist rather than a test.

   It DOES fail on a file that exists but cannot be used — an empty file,
   or one the browser will not decode — because both sound exactly like
   "nobody has recorded this yet". */

import { readFileSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname } from 'node:path';
import { SOUNDS } from '../js/data/sounds.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/* Container sniffing, by HEADER rather than by extension: a .mp3 that is
   really a .wav decodes fine, and a .mp3 that is really an HTML error page
   does not — the second being what a failed download leaves behind, which
   is the realistic way this goes wrong.

   Recognising a container is not a promise that every browser decodes it.
   MP3 and WAV are safe everywhere; Ogg and FLAC are not universal (Safari
   is the usual gap). The game reports a file it cannot decode at run time,
   so a wrong choice here is visible rather than silent — but prefer MP3 or
   WAV if the recording is meant to work for everyone. */
function format(file) {
  const buf = readFileSync(file);
  if (buf.length < 12) return null;
  const ascii = (a, b) => buf.slice(a, b).toString('latin1');
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'wav';
  if (ascii(0, 4) === 'OggS') return 'ogg';
  if (ascii(0, 4) === 'fLaC') return 'flac';
  if (ascii(4, 8) === 'ftyp') return 'm4a';
  if (ascii(0, 3) === 'ID3') return 'mp3';
  // A bare MPEG frame: 11 set bits.
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'mp3';
  return null;
}

const pad = (s, n) => String(s).padEnd(n);
const recorded = [], recipes = [], broken = [];

for (const slot of SOUNDS) {
  if (!slot.path) { recipes.push(slot); continue; }
  const file = join(root, slot.path);
  if (!existsSync(file)) { recipes.push(slot); continue; }
  if (statSync(file).size === 0) {
    broken.push({ slot, why: 'the file is empty' });
    continue;
  }
  const kind = format(file);
  if (!kind) {
    broken.push({ slot, why: `not audio the browser can decode (${extname(file) || 'no extension'})` });
    continue;
  }
  recorded.push({ slot, kind, bytes: statSync(file).size });
}

console.log(`\nAUDIO — ${SOUNDS.length} sounds · ${recorded.length} recorded · ${recipes.length} using the built-in recipe\n`);

if (recorded.length) {
  console.log('  RECORDED — these replace their recipe');
  for (const { slot, kind, bytes } of recorded) {
    console.log(`    ${pad(slot.id, 14)} ${pad(slot.path, 32)} ${kind}, ${(bytes / 1024).toFixed(0)} kB`);
  }
  console.log('');
}

if (recipes.length) {
  console.log('  PLAYED FROM THE RECIPE — working today; record over any of them');
  for (const slot of recipes) {
    const held = slot.sustain ? '  (held: it must loop cleanly)' : '';
    console.log(`    ${pad(slot.id, 14)} ${pad(slot.path || '(no path)', 32)}${held}`);
    console.log(`    ${pad('', 14)} ${slot.when}`);
  }
  console.log('');
}

if (broken.length) {
  console.log('  CANNOT BE USED — these sound exactly like "not recorded yet"');
  for (const { slot, why } of broken) console.log(`    ${pad(slot.id, 14)} ${slot.path} — ${why}`);
  console.log('');
}

/* The game reads this to know which slots have a recording. Unlike the
   art's manifest, which is an optimisation the game can do without (it
   falls back to probing every slot), this one is REQUIRED: the sound layer
   loads nothing that is not listed here. So running this tool is not a
   convenience, it is the step that puts a recording into the game.
   "Add the file, run the checklist, reload" is the whole workflow. */
const dir = join(root, 'assets/audio');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'manifest.json'),
  JSON.stringify(recorded.map(r => r.slot.id), null, 2) + '\n');
console.log(`  assets/audio/manifest.json updated — ${recorded.length} recording(s) listed for the game to load.\n`);

console.log(broken.length
  ? 'Fix or remove the files above; everything else is already making noise.\n'
  : 'Every sound is working. To replace one: drop a file at the path shown,\n' +
    'run this again so it lands in the manifest, then reload.\n');

process.exit(broken.length ? 1 : 0);
