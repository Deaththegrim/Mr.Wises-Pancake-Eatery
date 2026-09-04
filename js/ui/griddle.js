import { RECIPES } from '../data/recipes.js';
import { el, clear } from './screens.js';

/* Four beats: pour, flip, stack, drizzle.

   This module MEASURES; it does not score. Scoring lives in engine/cook.js
   where it is unit-tested. Keep it that way — if you find yourself writing
   a number comparison in here, it belongs in the engine. */

export function mountGriddle(mount, recipeId, onDone) {
  const recipe = RECIPES.find(r => r.id === recipeId);
  clear(mount);
  if (!recipe) {
    mount.append(el('div', { className: 'card', text: `Unknown recipe: ${recipeId}` }));
    return;
  }

  const beats = { volume: 0, msOffset: 0, offsets: [], coverage: [] };
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
    const targetR = R_MAX;
    const bandR = Math.sqrt((recipe.pour.target + recipe.pour.band) / recipe.pour.target) * R_MAX;
    const bandRLow = Math.sqrt(Math.max(0, recipe.pour.target - recipe.pour.band) / recipe.pour.target) * R_MAX;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // griddle
      ctx.fillStyle = '#241d33';
      ctx.beginPath(); ctx.ellipse(cx, cy, 130, 78, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3a2f52'; ctx.lineWidth = 2; ctx.stroke();

      // the acceptable band, drawn as a soft ring
      ctx.strokeStyle = 'rgba(201,168,255,.30)';
      ctx.lineWidth = Math.max(2, (bandR - bandRLow) * 0.6);
      ctx.beginPath(); ctx.ellipse(cx, cy, targetR, targetR * 0.6, 0, 0, Math.PI * 2); ctx.stroke();

      // the batter
      const r = radiusFor(beats.volume);
      if (r > 0) {
        const over = beats.volume > recipe.pour.target + recipe.pour.band;
        ctx.fillStyle = over ? '#c07a3a' : '#d9a05b';
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = over ? '#8a4f22' : '#a8712f';
        ctx.lineWidth = 2; ctx.stroke();
      }
    };
    draw();

    let timer = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        beats.volume += 2;
        read.textContent = `${beats.volume} ml`;
        draw();
      }, 30);
    };
    const stop = () => {
      if (!timer) return;
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
  }

  // BEAT 2 — FLIP. Bubbles rise; click at the peak. msOffset is the signed
  // distance from the ideal moment, which engine/cook.js grades.
  function doFlip() {
    area.append(el('p', { text: 'Watch for bubbles. Flip when they peak.' }));
    const bub = el('div', { attrs: { id: 'bubbles' } });
    const btn = el('button', { text: 'Flip' });
    area.append(bub, btn);

    const idealAt = 2000 + Math.random() * 1500;
    const t0 = performance.now();
    const tick = setInterval(() => {
      const elapsed = performance.now() - t0;
      const n = Math.min(14, Math.floor(elapsed / (idealAt / 12)));
      bub.textContent = 'o'.repeat(n);
    }, 80);

    btn.addEventListener('click', () => {
      clearInterval(tick);
      beats.msOffset = (performance.now() - t0) - idealAt;
      stage = 'stack';
      render();
    }, { once: true });
  }

  // BEAT 3 — STACK. Click to place each pancake. The offset is the
  // horizontal distance from the plate's centre. Error COMPOUNDS, but in
  // engine/cook.js, not here.
  function doStack() {
    area.append(el('p', { text: `Place ${recipe.stackCount} pancakes. Aim for the centre line.` }));
    const plate = el('div', { attrs: { id: 'plate' } }, el('div', { className: 'centre-line' }));
    const read = el('div', { className: 'muted', text: `0 / ${recipe.stackCount}` });
    area.append(plate, read);

    plate.addEventListener('click', ev => {
      if (beats.offsets.length >= recipe.stackCount) return;
      const rect = plate.getBoundingClientRect();
      const centre = rect.left + rect.width / 2;
      // Normalise to roughly -25..25 so screen width does not change difficulty.
      const offset = ((ev.clientX - centre) / (rect.width / 2)) * 25;
      beats.offsets.push(offset);

      const cake = el('div', { className: 'cake' });
      cake.style.left = `${ev.clientX - rect.left}px`;
      cake.style.bottom = `${8 + (beats.offsets.length - 1) * 15}px`;
      plate.append(cake);

      read.textContent = `${beats.offsets.length} / ${recipe.stackCount}`;
      if (beats.offsets.length >= recipe.stackCount) {
        setTimeout(() => { stage = 'drizzle'; render(); }, 350);
      }
    });
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
    beats.coverage = new Array(COLUMNS).fill(0);
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
      ctx.fillStyle = '#241d33';
      ctx.beginPath(); ctx.ellipse(cx, BASE_Y + 8, 120, 16, 0, 0, Math.PI * 2); ctx.fill();

      // the stack, bottom-up, at its real offsets
      for (const c of cakes) {
        ctx.fillStyle = '#d9a05b';
        ctx.strokeStyle = '#a8712f';
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
        ctx.fillStyle = pooled ? 'rgba(126,72,22,.97)' : `rgba(186,116,42,${a})`;

        // drip down the front of the stack
        const dripH = 10 + Math.min(1, amount) * 34;
        ctx.fillRect(x - colW / 2.3, top.y - 4, colW / 1.15, dripH);

        // glossy cap
        ctx.beginPath();
        ctx.ellipse(x, top.y - 5, colW / 1.5, 6 + Math.min(1, amount) * 5, 0, 0, Math.PI * 2);
        ctx.fill();

        if (pooled) {           // a puddle reads as too much, and it costs
          ctx.fillStyle = 'rgba(90,50,14,.9)';
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
      beats.coverage[i] = Math.min(1.2, beats.coverage[i] + 0.09);
      draw();
    };

    canvas.addEventListener('mousedown', e => { down = true; applyAt(e.clientX); });
    canvas.addEventListener('mousemove', e => { if (down) applyAt(e.clientX); });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      applyAt(e.touches[0].clientX);
    });
    const release = () => { down = false; };
    window.addEventListener('mouseup', release);

    done.addEventListener('click', () => {
      window.removeEventListener('mouseup', release);
      clear(mount);
      onDone(beats);
    }, { once: true });
  }

  render();
}
