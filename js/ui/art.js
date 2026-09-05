import { ART } from '../data/art.js';

/* LOADING THE ART, IF THERE IS ANY.

   Every slot in data/art.js is attempted once at start-up. A file that is
   not there fails quietly — a 404 in the network tab and nothing else —
   and `sprite(id)` returns null, so the caller draws its placeholder.

   That is what lets the art arrive one picture at a time, in any order,
   without a code change: the game asks for a sprite on every frame and
   gets one as soon as a file exists at the path.

   `sprite()` is called inside animation frames, so it does no work beyond
   a map lookup and two property reads. */

const loaded = new Map();

function load(slot) {
  const img = new Image();
  img.decoding = 'async';
  img.src = slot.path;
  loaded.set(slot.id, img);
}

/* WHY THERE IS A MANIFEST.

   Asking the browser for a file that is not there logs a 404 to the
   console, and a missing picture is the NORMAL state of this project —
   so probing all eleven slots on every load buried the warnings the game
   actually needs the console for (missing story nodes, unknown ids in a
   save). The smoke test asserts a clean console for exactly that reason.

   `assets/manifest.json` lists the slots that have a file. It is written
   by `node tools/art.js`, which is the same command you already run to
   see the checklist — so the workflow is: drop the file in, run the
   checklist, reload.

   If the manifest is missing or unreadable the game falls back to trying
   every slot, so a fresh clone works with no setup at all. It is just
   noisier, and that noise is the reminder to run the tool. */
fetch('assets/manifest.json')
  .then(r => (r.ok ? r.json() : Promise.reject(new Error('no manifest'))))
  .then(have => {
    const wanted = new Set(Array.isArray(have) ? have : []);
    for (const slot of ART) if (wanted.has(slot.id)) load(slot);
  })
  .catch(() => {
    for (const slot of ART) load(slot);
  });

/* The image for a slot, or null if there is no file yet. Callers must
   handle null — that is the placeholder path, and for most of this
   project's life it is the only path. */
export function sprite(id) {
  const img = loaded.get(id);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

/* Draw a sprite centred on (cx, cy) at a given width, keeping its aspect
   ratio, and report whether it drew anything. The caller falls back to its
   own drawing when this returns false:

       if (!drawSprite(ctx, 'pancake', cx, cy, width)) {
         ... draw the placeholder ellipse ...
       }

   Aspect is taken from the FILE, not from the slot, so art that is not
   exactly the declared size still lands in the right place at the right
   scale rather than being squashed to fit. */
export function drawSprite(ctx, id, cx, cy, width) {
  const img = sprite(id);
  if (!img) return false;
  const h = width * (img.naturalHeight / img.naturalWidth);
  ctx.drawImage(img, cx - width / 2, cy - h / 2, width, h);
  return true;
}

/* Draw into a fixed box, ignoring the file's own aspect.

   For the places where the GEOMETRY is the game rather than decoration —
   the stack beat measures a leaning tower and the drizzle beat scores
   coverage across it, so those pancakes must occupy exactly the space the
   scoring assumed. Art that arrives at a different aspect is fitted rather
   than allowed to move the target the player is aiming at. The slot in
   data/art.js states the aspect for this reason. */
export function drawSpriteFit(ctx, id, cx, cy, w, h) {
  const img = sprite(id);
  if (!img) return false;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  return true;
}

/* For the DOM side: an <img> for a slot, or null. Same contract. */
export function spriteImg(id, alt = '') {
  const img = sprite(id);
  if (!img) return null;
  const node = new Image();
  node.src = img.src;
  node.alt = alt;
  return node;
}
