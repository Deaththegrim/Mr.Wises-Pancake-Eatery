import { el, clear } from './screens.js';
import { recipeById } from '../engine/lookup.js';
import { drawSprite, drawSpriteFit } from './art.js';
/* Aliased on purpose: the pour and drizzle beats already have local
   `start`/`stop` for their own hold handling, and an unaliased import
   would be shadowed inside exactly the two places that need it most. */
import { play as sfx, start as sfxStart, stop as sfxStop, stopAll as sfxStopAll } from './audio.js';

/* THE COOK SURFACE PALETTE, read from the stylesheet.

   These colours were hardcoded at eighteen call sites in here and again in
   css/shop.css, and the two disagreed: the DOM drew a pancake #c98a4b
   while this canvas drew the same pancake #d9a05b. Reading the tokens off
   the root element keeps the stylesheet as the one source, so a canvas
   beat cannot drift from the DOM beat next to it.

   Cached after the first read — this is called inside animation frames.
   The fallbacks matter: getComputedStyle returns '' if the stylesheet has
   not applied yet, and an empty fillStyle silently leaves the previous
   colour in place, which paints the food the colour of the pan. */
let PALETTE = null;
function palette() {
  if (PALETTE) return PALETTE;
  const css = getComputedStyle(document.documentElement);
  /* Only 3- or 6-digit hex, because rgb() below parses nothing else: a
     token authored as `rgb(...)`, `hsl(...)`, a colour name or 8-digit
     #rrggbbaa parses to NaN or to the wrong channels, and canvas silently
     ignores an invalid fillStyle and keeps the previous colour — so the
     food would quietly render the colour of the pan. The guard added when
     this last bit covered the OUTPUT format; this covers the input. */
  const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const read = (name, fallback) => {
    const raw = (css.getPropertyValue(name) || '').trim();
    if (!raw) return fallback;
    if (!HEX.test(raw)) {
      console.warn(`[palette] ${name} is "${raw}"; the canvas needs 3- or 6-digit hex. Using ${fallback}.`);
      return fallback;
    }
    return raw;
  };
  PALETTE = {
    pan: read('--pan', '#241d33'),
    rim: read('--pan-rim', '#3a2f52'),
    cake: read('--cake', '#d9a05b'),
    cakeEdge: read('--cake-edge', '#a8712f'),
    over: read('--cake-over', '#c07a3a'),
    overEdge: read('--cake-over-edge', '#8a4f22'),
    syrup: read('--syrup', '#b4762f'),
    syrupWet: read('--syrup-wet', '#ba742a'),
    syrupEdge: read('--syrup-edge', '#8a5a2b'),
    syrupPool: read('--syrup-pool', '#7e4816'),
    syrupDeep: read('--syrup-deep', '#5a320e'),
    accent: read('--accent', '#c9a8ff')
  };
  return PALETTE;
}

/* The canvas also needs these colours faded and darkened — wet syrup, a
   puddle, a pancake browning past its window. Deriving them from the same
   tokens keeps one source: hand-typed rgba() triplets are how the DOM and
   the canvas came to disagree in the first place. */
function rgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/* The pan itself. Both the pour and the flip drew it with identical
   six-statement blocks, magic radii and all — the drizzle beat's plate is
   deliberately a different ellipse and keeps its own. */
const PAN_RX = 130, PAN_RY = 78;
function drawPan(ctx, cx, cy) {
  if (drawSprite(ctx, 'griddle', cx, cy, PAN_RX * 2)) return;
  const p = palette();
  ctx.fillStyle = p.pan;
  ctx.beginPath(); ctx.ellipse(cx, cy, PAN_RX, PAN_RY, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = p.rim; ctx.lineWidth = 2; ctx.stroke();
}

/* One pancake. Every place that draws food goes through here, so a single
   file at assets/food/pancake.png replaces all of them at once — the batter
   in the pour, the pancake cooking in the flip, and every layer of the
   stack under the drizzle. `over` swaps to the overcooked sprite. */
function drawCake(ctx, cx, cy, rx, { over = false, fill, stroke } = {}) {
  if (drawSprite(ctx, over ? 'pancake_over' : 'pancake', cx, cy, rx * 2)) return;
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, rx * 0.6, 0, 0, Math.PI * 2); ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}

const alpha = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };
/* Returns HEX, not an rgb() string, so it composes with alpha() — the
   first cut returned rgb() and alpha(darken(...)) parsed it as a hex,
   producing rgba(NaN,NaN,NaN) and painting nothing at all. */
const darken = (hex, k) => {
  const [r, g, b] = rgb(hex);
  const to = v => Math.max(0, Math.min(255, Math.round(v * k))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
};

/* Four beats: pour, flip, stack, drizzle.

   This module MEASURES; it does not score. Scoring lives in engine/cook.js
   where it is unit-tested. Keep it that way — if you find yourself writing
   a number comparison in here, it belongs in the engine. */

export function mountGriddle(mount, recipeId, onDone, opts = {}) {
  const recipe = recipeById(recipeId);

  /* Tear down anything the PREVIOUS dish left running. "Close for the day"
     is visible for the whole of service, so abandoning mid-flip used to
     leave a 60fps requestAnimationFrame loop drawing to a detached canvas
     for the rest of the session — one more each time — and abandoning at
     the drizzle stage left a window mouseup listener attached forever. */
  if (mountGriddle._teardown) mountGriddle._teardown();
  const teardown = [];
  mountGriddle._teardown = () => {
    /* Sound first, and outside the loop. It used to be pushed onto the
       stack, and the stack drains LIFO, so it ran LAST — after the frame
       loop and the listener removal, either of which throwing would skip
       it and take the whole teardown with it, unwinding out of
       mountGriddle before `clear(mount)` and leaving the player on the
       service screen with a customer, no cook surface, and a sound still
       running. Each pop is guarded now for the same reason.

       NOT the guard against abandoning mid-pour, despite once claiming to
       be: this runs when the NEXT dish mounts, which is a whole evening
       away. main.js stops held sounds on leaving service, and that is what
       covers it. This is cleanup for the order that was left behind. */
    sfxStopAll();
    while (teardown.length) {
      const fn = teardown.pop();
      try { fn(); } catch (e) { /* one bad teardown must not skip the rest */ }
    }
  };

  clear(mount);
  if (!recipe) {
    mount.append(el('div', { className: 'card', text: `Unknown recipe: ${recipeId}` }));
    return;
  }

  const beats = { volume: 0, msOffset: 0, offsets: [], coverage: [], syrupId: null };

  /* Which syrups the player has to choose from at the drizzle beat. The
     griddle MEASURES what the player did and never scores it, so this
     records the choice and hands it back with the rest of the beats;
     engine/day.js decides what it was worth. */
  const syrups = opts.syrups || [];
  beats.syrupId = syrups.length ? syrups[0].id : null;
  let stage = 'pour';

  const card = el('div', { className: 'card' });
  const label = el('div', { className: 'beat-label' });
  const area = el('div', { attrs: { id: 'beat-area' } });
  card.append(label, area);
  mount.append(card);

  const render = () => {
    label.textContent = `${recipe.name} — ${stage}`;
    clear(area);
    ({ pour: doPour, flip: doFlip, stack: doStack, drizzle: doDrizzle })[stage]();
  };

  /* BEAT 1 — POUR. Hold to pour; batter visibly spreads on the griddle
     against a target ring. The ring is the recipe's band, so the player
     reads "fill to here" from the picture rather than from a number.
     A rising millilitre counter told them nothing about what they were
     doing; a puddle growing toward a ring does. */
  function doPour() {
    area.append(el('p', { text: 'Hold to pour. Fill the ring.' }));

    const canvas = el('canvas', { attrs: { id: 'pour-canvas', width: '520', height: '200' } });
    const btn = el('button', { text: 'Hold to pour' });
    const read = el('div', { attrs: { id: 'pour-read' }, className: 'muted', text: '0 ml' });
    area.append(canvas, btn, read);

    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2;
    // Radius scales with volume; the target radius maps to recipe target.
    const R_MAX = 78;
    const radiusFor = ml => Math.min(R_MAX + 26, Math.sqrt(ml / recipe.pour.target) * R_MAX);
    const bandR = Math.sqrt((recipe.pour.target + recipe.pour.band) / recipe.pour.target) * R_MAX;
    const bandRLow = Math.sqrt(Math.max(0, recipe.pour.target - recipe.pour.band) / recipe.pour.target) * R_MAX;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawPan(ctx, cx, cy);

      // the acceptable band, drawn as a soft ring
      ctx.strokeStyle = alpha(palette().accent, 0.30);
      ctx.lineWidth = Math.max(2, (bandR - bandRLow) * 0.6);
      ctx.beginPath(); ctx.ellipse(cx, cy, R_MAX, R_MAX * 0.6, 0, 0, Math.PI * 2); ctx.stroke();

      // the batter
      const r = radiusFor(beats.volume);
      if (r > 0) {
        const over = beats.volume > recipe.pour.target + recipe.pour.band;
        drawCake(ctx, cx, cy, r, {
          over,
          fill: over ? palette().over : palette().cake,
          stroke: over ? palette().overEdge : palette().cakeEdge
        });
      }
    };
    draw();

    let timer = null;
    const start = () => {
      if (timer) return;
      sfxStart('pour');
      timer = setInterval(() => {
        beats.volume += 2;
        read.textContent = `${beats.volume} ml`;
        draw();
      }, 30);
    };
    const stop = () => {
      if (!timer) return;
      sfxStop('pour');
      clearInterval(timer);
      timer = null;
      stage = 'flip';
      render();
    };
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', stop);
    btn.addEventListener('mouseleave', stop);
    btn.addEventListener('touchstart', e => { e.preventDefault(); start(); });
    btn.addEventListener('touchend', e => { e.preventDefault(); stop(); });
    /* touchcancel is NOT touchend. A system gesture, an incoming call, or
       the browser deciding the touch was a scroll fires this instead — and
       stop() does three things here, not one: it silences the pour, clears
       the 30ms interval, and advances the beat. Without this the batter
       keeps pouring while nobody is touching the screen, `beats.volume`
       climbs past any target, and the stage never advances. That is a
       corrupted measurement and a stuck beat, not a stray noise. */
    btn.addEventListener('touchcancel', e => { e.preventDefault(); stop(); });

    /* KEYBOARD. A <button> fires `click` on Enter/Space — it does NOT fire
       mousedown/mouseup. Without this a keyboard user can focus the button,
       see the focus ring, press Enter, and nothing happens: the first beat
       of every order is a dead end. Hold-to-pour maps to hold-the-key. */
    btn.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); start(); }
    });
    btn.addEventListener('keyup', e => {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); stop(); }
    });
    btn.addEventListener('blur', stop);
    btn.focus();
  }

  /* BEAT 2 — FLIP, on canvas.

     The DOM version printed a row of "o" characters, which read as debug
     output. Worse, it had a real gameplay hole: the instruction says "flip
     when they peak" but the bubbles only ever accumulated, so there was no
     peak to read. The beat whose entire skill is timing gave no timing cue.

     Now the bubbles rise, PEAK, and start popping at the ideal moment, and
     the edge sets and darkens as it overcooks. The visual peak is the real
     peak — the player reads the pancake, not a counter. */
  function doFlip() {
    area.append(el('p', { text: 'Watch the bubbles. Flip when they peak — they start popping.' }));
    const canvas = el('canvas', { attrs: { id: 'flip-canvas', width: '520', height: '200' } });
    const btn = el('button', { text: 'Flip' });
    area.append(canvas, btn);

    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2;
    const R = 76;
    const idealAt = 2000 + Math.random() * 1500;
    const t0 = performance.now();

    // Fixed bubble positions so they do not jitter between frames.
    const bubbles = Array.from({ length: 18 }, () => {
      const a = Math.random() * Math.PI * 2;
      const d = Math.sqrt(Math.random()) * (R - 14);
      return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.6,
               r: 2 + Math.random() * 3, born: Math.random() };
    });

    let raf = null;
    const draw = () => {
      const t = (performance.now() - t0) / idealAt;      // 1.0 == the ideal moment
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      drawPan(ctx, cx, cy);

      // the pancake, darkening as it cooks past the window
      const over = Math.max(0, t - 1.3);
      const shade = Math.max(0, 1 - over * 0.6);
      drawCake(ctx, cx, cy, R, {
        over: shade < 0.8,
        fill: darken(palette().cake, shade),
        stroke: palette().cakeEdge
      });

      // bubbles: rise, peak at t=1, then pop
      for (const b of bubbles) {
        const life = t - b.born * 0.55;
        if (life <= 0) continue;
        const popping = t >= 1;
        // after the peak, bubbles burst into rings and vanish
        const phase = popping ? Math.min(1, (t - 1) * 1.6 + b.born * 0.4) : 0;
        if (phase >= 1) continue;
        const grow = Math.min(1, life * 1.6);
        const r = b.r * grow * (1 + phase * 2.2);
        ctx.globalAlpha = popping ? 1 - phase : Math.min(1, life * 2);
        if (popping) {
          ctx.strokeStyle = palette().syrupEdge; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.fillStyle = palette().syrup;
          ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    teardown.push(() => cancelAnimationFrame(raf));

    btn.addEventListener('click', () => {
      cancelAnimationFrame(raf);
      beats.msOffset = (performance.now() - t0) - idealAt;
      sfx('flip');
      /* The one "well done" in the four beats. It reads the same window
         engine/cook.js scores against, so the sound cannot congratulate a
         flip the scorer marked down. */
      if (Math.abs(beats.msOffset) <= recipe.flip.windowMs / 2) sfx('flip_clean');
      stage = 'stack';
      render();
    }, { once: true });
  }

  // BEAT 3 — STACK. Click to place each pancake. The offset is the
  // horizontal distance from the plate's centre. Error COMPOUNDS, but in
  // engine/cook.js, not here.
  function doStack() {
    area.append(el('p', { text: `Place ${recipe.stackCount} pancakes. Aim for the centre line.` }));
    const plate = el('div', {
      attrs: { id: 'plate', tabindex: '0', role: 'application',
               'aria-label': `Place ${recipe.stackCount} pancakes. Arrow keys to aim, Enter to place.` }
    }, el('div', { className: 'centre-line' }));
    const cursor = el('div', { className: 'aim-cursor' });
    plate.append(cursor);
    const read = el('div', { className: 'muted', text: `0 / ${recipe.stackCount}` });
    area.append(plate, read);

    // Keyboard aim, as a fraction of half-width from centre (-1 .. 1).
    let aim = 0;
    const showCursor = () => {
      cursor.hidden = false;
      cursor.style.left = `${50 + aim * 50}%`;
    };

    /* engine/cook.js consumes offsets as DELTAS and accumulates them into a
       running centre (`drift += o`). This must emit deltas to match, or the
       scoring inverts the on-screen instruction: emitting absolute distances
       made a zig-zag either side of centre score 87 while a straight
       off-centre tower scored 60, despite the beat saying "aim for the
       centre line". The rendered cake sits at the ACCUMULATED position, which
       is also what doDrizzle draws, so both beats show the same stack. */
    let placedAt = 0;
    const place = absolute => {
      if (beats.offsets.length >= recipe.stackCount) return;
      beats.offsets.push(absolute - placedAt);
      placedAt = absolute;

      const cake = el('div', { className: 'cake' });
      cake.style.left = `${50 + (absolute / 25) * 50}%`;
      cake.style.bottom = `${8 + (beats.offsets.length - 1) * 15}px`;
      plate.append(cake);

      /* Each pancake lands a little higher than the last. One slot, bent
         per placement, so a seven-high stack audibly builds rather than
         repeating one thud — and so the tallest dish in the game sounds
         like the achievement it is. */
      sfx('stack_land', { rate: 1 + (beats.offsets.length - 1) * 0.045 });

      read.textContent = `${beats.offsets.length} / ${recipe.stackCount}`;
      if (beats.offsets.length >= recipe.stackCount) {
        setTimeout(() => { stage = 'drizzle'; render(); }, 350);
      }
    };

    plate.addEventListener('click', ev => {
      const rect = plate.getBoundingClientRect();
      const centre = rect.left + rect.width / 2;
      // Normalise to roughly -25..25 so screen width does not change difficulty.
      place(((ev.clientX - centre) / (rect.width / 2)) * 25);
    });

    /* KEYBOARD: arrows aim, Enter/Space places. Without this the plate is a
       plain div with a click handler — not focusable, not operable, and the
       run ends here for anyone without a mouse. */
    plate.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowLeft')       { aim = Math.max(-1, aim - 0.08); showCursor(); }
      else if (ev.key === 'ArrowRight') { aim = Math.min(1, aim + 0.08); showCursor(); }
      else if (ev.key === 'Enter' || ev.key === ' ') { place(aim * 25); }
      else return;
      ev.preventDefault();
    });
    plate.addEventListener('focus', showCursor);
    plate.focus();
  }

  // BEAT 4 — DRIZZLE. Drag across the cells; each fills while the pointer
  // is over it. Even coverage wins; pooling and bare cells cost.
  /* BEAT 4 — DRIZZLE, on canvas, drawn over the ACTUAL stack the player
     just built, at its real offsets.

     The DOM version was six flat rectangles that read as an equaliser, and
     it threw the plate away — so the player stopped decorating their food
     and started filling in a bar chart. Keeping the stack on screen is the
     whole point: you are pouring syrup on the thing you made, and a leaning
     tower is visibly harder to cover evenly, which is a fair consequence of
     the stack beat rather than a separate abstract task. */
  function doDrizzle() {
    const COLUMNS = 12;                       // finer than the old 6 cells
    /* How fast syrup builds under the pointer, and how deep a puddle can
       get. The mouse path and the keyboard path both pour, and these two
       numbers were written out at both — so a tuning change could land on
       one route and not the other, and the keyboard route is the one
       nobody plays and nobody would notice. */
    const POUR_STEP = 0.09, POUR_MAX = 1.2;
    const pourInto = i => {
      beats.coverage[i] = Math.min(POUR_MAX, beats.coverage[i] + POUR_STEP);
    };
    beats.coverage = new Array(COLUMNS).fill(0);

    /* THE SYRUP CHOICE. Discovering a syrup used to change a counter and
       nothing else — half the research tree paid out in nothing. Now the
       one you pour is the one that gets scored against this customer's
       taste. Each button names the syrup's own character; what a given
       customer likes is learned by serving them, not read off the screen. */
    if (syrups.length > 1) {
      const row = el('div', { className: 'syrup-picker' });
      row.setAttribute('role', 'radiogroup');
      row.setAttribute('aria-label', 'Choose a syrup');
      const buttons = [];
      const select = id => {
        beats.syrupId = id;
        for (const b of buttons) {
          const on = b.dataset.syrup === id;
          b.classList.toggle('selected', on);
          b.setAttribute('aria-checked', on ? 'true' : 'false');
          // Only the selected option stays in the tab order, so a
          // radiogroup is one stop rather than nine.
          b.tabIndex = on ? 0 : -1;
        }
      };
      syrups.forEach(sy => {
        const b = el('button', { className: 'syrup', text: `${sy.name} · ${sy.character}` });
        b.dataset.syrup = sy.id;
        b.setAttribute('role', 'radio');
        b.addEventListener('click', () => { select(sy.id); b.focus(); });
        b.addEventListener('keydown', e => {
          const i = syrups.findIndex(x => x.id === beats.syrupId);
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            const n = buttons[(i + 1) % buttons.length];
            select(n.dataset.syrup); n.focus();
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            const n = buttons[(i - 1 + buttons.length) % buttons.length];
            select(n.dataset.syrup); n.focus();
          }
        });
        buttons.push(b);
        row.append(b);
      });
      area.append(row);
      select(beats.syrupId);
    }

    area.append(el('p', { text: 'Drag across the stack. Even coverage, no puddles.' }));

    const canvas = el('canvas', { attrs: { id: 'drizzle', width: '560', height: '170' } });
    const done = el('button', { text: 'Done' });
    area.append(canvas, done);

    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2;
    const CAKE_W = 170, CAKE_H = 22, BASE_Y = canvas.height - 30;

    // Where each pancake actually sits, from the stack beat's offsets.
    const cakes = [];
    let drift = 0;
    beats.offsets.forEach((o, i) => {
      drift += o;
      cakes.push({ x: cx + drift * 2.2, y: BASE_Y - i * (CAKE_H - 4) });
    });

    // The syrup band spans the stack, so coverage columns line up with food.
    const spanL = cx - CAKE_W / 2 - 10;
    const spanW = CAKE_W + 20;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // plate
      ctx.fillStyle = palette().pan;
      ctx.beginPath(); ctx.ellipse(cx, BASE_Y + 8, 120, 16, 0, 0, Math.PI * 2); ctx.fill();

      // the stack, bottom-up, at its real offsets
      for (const c of cakes) {
        // Fitted, not scaled: the drizzle beat scores coverage across this
        // exact shape, so the art must not move what the player aims at.
        if (drawSpriteFit(ctx, 'pancake_stacked', c.x, c.y, CAKE_W, CAKE_H)) continue;
        ctx.fillStyle = palette().cake;
        ctx.strokeStyle = palette().cakeEdge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, CAKE_W / 2, CAKE_H / 2, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
      }

      /* Syrup, per column: a glossy cap sitting on the top pancake with a
         drip running down the stack. Even a light pass must be VISIBLE —
         the player has to be able to read their own coverage while they
         work, or the score at the end looks arbitrary. Hence the alpha
         floor: any syrup at all shows. */
      const top = cakes.length ? cakes[cakes.length - 1] : { x: cx, y: BASE_Y };
      const colW = spanW / COLUMNS;
      for (let i = 0; i < COLUMNS; i++) {
        const amount = beats.coverage[i];
        if (amount <= 0) continue;
        const x = spanL + (i + 0.5) * colW;
        const pooled = amount > 0.95;
        const a = Math.min(0.95, 0.30 + Math.min(1, amount) * 0.65);   // alpha floor
        ctx.fillStyle = pooled ? alpha(palette().syrupPool, 0.97) : alpha(palette().syrupWet, a);

        // drip down the front of the stack
        const dripH = 10 + Math.min(1, amount) * 34;
        ctx.fillRect(x - colW / 2.3, top.y - 4, colW / 1.15, dripH);

        // glossy cap
        ctx.beginPath();
        ctx.ellipse(x, top.y - 5, colW / 1.5, 6 + Math.min(1, amount) * 5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (pooled) {           // a puddle reads as too much, and it costs
          ctx.fillStyle = alpha(palette().syrupDeep, 0.9);
          ctx.beginPath();
          ctx.ellipse(x, top.y + dripH - 6, colW / 1.2, 7, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
    draw();

    let down = false;
    const applyAt = clientX => {
      const rect = canvas.getBoundingClientRect();
      // canvas is CSS-scaled, so map client x into canvas coordinates
      const x = (clientX - rect.left) * (canvas.width / rect.width);
      const i = Math.floor(((x - spanL) / spanW) * COLUMNS);
      if (i < 0 || i >= COLUMNS) return;      // off the stack: syrup on the plate, wasted
      pourInto(i);
      draw();
    };

    /* KEYBOARD: arrows move a column cursor, Enter/Space pours into it.
       The canvas is otherwise mouse-only, which would end the run here. */
    let col = Math.floor(COLUMNS / 2);
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'application');
    canvas.setAttribute('aria-label', 'Drizzle syrup. Arrow keys to move, Enter to pour, then choose Done.');
    const drawCursor = () => {
      draw();
      const x = spanL + (col + 0.5) * (spanW / COLUMNS);
      ctx.strokeStyle = alpha(palette().accent, 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 6); ctx.lineTo(x, canvas.height - 6);
      ctx.stroke();
    };
    canvas.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowLeft')       col = Math.max(0, col - 1);
      else if (ev.key === 'ArrowRight') col = Math.min(COLUMNS - 1, col + 1);
      else if (ev.key === 'Enter' || ev.key === ' ') {
        pourInto(col);
      } else return;
      ev.preventDefault();
      drawCursor();
    });
    canvas.addEventListener('focus', drawCursor);
    canvas.addEventListener('blur', draw);
    canvas.focus();

    canvas.addEventListener('mousedown', e => { down = true; sfxStart('drizzle'); applyAt(e.clientX); });
    canvas.addEventListener('mousemove', e => { if (down) applyAt(e.clientX); });
    canvas.addEventListener('touchstart', () => sfxStart('drizzle'));
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      /* `touches` can be empty on the event that ends a gesture, and
         `[0].clientX` on an empty list throws — inside a listener, where
         nothing catches it. changedTouches carries the point that actually
         moved, and the guard covers the rest. */
      const t = e.touches[0] || e.changedTouches[0];
      if (t) applyAt(t.clientX);
    });
    canvas.addEventListener('touchend', () => sfxStop('drizzle'));
    /* Same as the pour: a gesture the system takes over fires touchcancel,
       never touchend, and the window-level mouseup below does not fire for
       touch. Without this the syrup keeps running behind the receipt, the
       ledger and any scene that follows, until something else stops it. */
    canvas.addEventListener('touchcancel', () => sfxStop('drizzle'));
    const release = () => { down = false; sfxStop('drizzle'); };
    window.addEventListener('mouseup', release);
    teardown.push(() => window.removeEventListener('mouseup', release));

    done.addEventListener('click', () => {
      window.removeEventListener('mouseup', release);
      sfxStopAll();
      clear(mount);
      onDone(beats);
    }, { once: true });
  }

  render();
}
