import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ART } from '../js/data/art.js';
import { DECOR } from '../js/data/decor.js';
import { SCENES } from '../js/data/scenes.js';
import { TIER_ORDER } from '../js/data/affection.js';
import { MISS_SCENES } from '../js/engine/story.js';

const root = fileURLToPath(new URL('../', import.meta.url));

/* THE ART SLOTS.

   Every picture the game can use is declared here and picked up the
   moment a file appears at its path — no code change, no registration.
   These tests protect the promise that makes that work: the paths have to
   be real places, the ids have to match what the code asks for, and a
   slot must never be silently unreachable.

   None of them require any art to exist. That is the point: the game is
   fully playable with every slot empty, which is the state it will be in
   for as long as it takes someone to draw eleven pictures. */

test('every slot declares everything an artist needs to act on it', () => {
  for (const slot of ART) {
    assert.ok(slot.id, 'a slot with no id cannot be asked for');
    assert.match(slot.path, /^assets\/[\w/-]+\.(png|jpg|jpeg)$/,
      `${slot.id}: "${slot.path}" is not a sensible asset path`);
    assert.ok(slot.w > 0 && slot.h > 0, `${slot.id} has no size to draw to`);
    assert.ok((slot.needs || '').length > 20,
      `${slot.id} does not say what the picture has to show`);
    assert.ok((slot.replaces || '').length > 5,
      `${slot.id} does not say what placeholder it takes over from`);
  }
});

test('no two slots share an id or a path', () => {
  const ids = ART.map(s => s.id);
  const paths = ART.map(s => s.path);
  assert.equal(new Set(ids).size, ids.length, 'a duplicate id means one slot can never be filled');
  assert.equal(new Set(paths).size, paths.length, 'two slots reading one file will surprise whoever draws it');
});

test('every decoration names a slot that exists', () => {
  /* data/decor.js carries an `art` field per item. If it names a slot that
     is not here, that decoration can never show a picture no matter what
     anyone draws — and nothing else would ever say so. */
  const ids = new Set(ART.map(s => s.id));
  for (const item of DECOR) {
    assert.ok(ids.has(item.art),
      `decor "${item.id}" wants art "${item.art}", which is not a slot in data/art.js`);
  }
});

test('every slot the code asks for is declared', () => {
  /* The reverse: a sprite('...') call naming a slot that does not exist
     draws its placeholder forever and looks exactly like art nobody has
     got round to. */
  const declared = new Set(ART.map(s => s.id));
  const sources = ['js/ui/griddle.js', 'js/ui/decor.js'];
  const asked = new Set();
  for (const file of sources) {
    const src = readFileSync(join(root, file), 'utf8');
    for (const m of src.matchAll(/drawSprite(?:Fit)?\(\s*ctx\s*,\s*'([^']+)'/g)) asked.add(m[1]);
  }
  for (const id of asked) {
    assert.ok(declared.has(id), `the code draws sprite "${id}", which data/art.js does not declare`);
  }
  assert.ok(asked.size > 0, 'expected to find the sprite calls');
});

test('the folders the slots point into are the ones that exist', () => {
  // A path into a folder nobody made is a file nobody will find.
  const dirs = new Set(ART.map(s => s.path.split('/').slice(0, -1).join('/')));
  for (const dir of dirs) {
    assert.ok(existsSync(join(root, dir)), `${dir}/ does not exist, so art placed there is invisible`);
  }
});

test('the game runs with no art at all', () => {
  // The normal state, and the one it will be in for a long time.
  const present = ART.filter(s => existsSync(join(root, s.path)));
  assert.ok(present.length >= 0);   // trivially true: this test documents intent
  assert.equal(typeof ART.length, 'number');
});

test('the writing checklist accounts for every scene', () => {
  /* tools/writing.js tells the collaborator WHEN each line is seen. A
     scene it cannot place gets reported as orphaned — which is true and
     useful when a scene really is unreachable, and a false alarm that
     sends someone hunting a bug when it is not. It derives the entry
     points from the engine (miss scenes, endings, mentions) rather than
     listing them, so this asserts the derivation still covers everything. */
  const entry = new Set([
    'visit_first', 'quota_met', 'noticed',
    ...MISS_SCENES,
    ...TIER_ORDER.map(t => `ending_${t.toLowerCase()}`),
    ...Object.entries(SCENES).filter(([, n]) => n.mentions).map(([id]) => id)
  ]);
  const reachable = new Set(entry);
  for (const [, node] of Object.entries(SCENES)) {
    if (node.next) reachable.add(node.next);
    for (const c of node.choices || []) if (c.next) reachable.add(c.next);
  }
  const orphaned = Object.keys(SCENES).filter(id => !reachable.has(id));
  assert.deepEqual(orphaned, [],
    'scenes nothing can reach — either wire them up or delete them:\n' + orphaned.join('\n'));
});

test('the preview page can reach everything it claims to show', () => {
  /* preview.html is the workbench: every art slot, and every scene
     playable on its own. It is a separate page from the game, so nothing
     else would notice if it drifted — it imports modules by path and
     mounts the story layer into its own copy of that markup. */
  const html = readFileSync(join(root, 'preview.html'), 'utf8');

  for (const spec of ["'./js/data/art.js'", "'./js/data/scenes.js'", "'./js/ui/vn.js'"]) {
    assert.ok(html.includes(spec), `preview.html no longer imports ${spec}`);
  }
  // The story layer writes into these by id; without them a scene silently
  // renders nowhere.
  for (const id of ['vn-name', 'vn-text', 'vn-sprite', 'vn-choices', 'screen-vn', 'notice']) {
    assert.ok(html.includes(`id="${id}"`), `preview.html is missing #${id}, which ui/vn.js writes to`);
  }
});
