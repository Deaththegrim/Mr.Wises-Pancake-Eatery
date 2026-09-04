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

  // BEAT 1 — POUR. Hold to pour; volume grows while held.
  function doPour() {
    area.append(el('p', { text: `Hold to pour. You want about ${recipe.pour.target}ml.` }));
    const btn = el('button', { text: 'Hold to pour' });
    const read = el('div', { attrs: { id: 'pour-read' }, text: '0 ml' });
    area.append(btn, read);

    let timer = null;
    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        beats.volume += 2;
        read.textContent = `${beats.volume} ml`;
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
  function doDrizzle() {
    const CELLS = 6;
    beats.coverage = new Array(CELLS).fill(0);
    area.append(el('p', { text: 'Drag across the stack. Even coverage, no puddles.' }));

    const wrap = el('div', { attrs: { id: 'drizzle' } });
    const cells = [];
    for (let i = 0; i < CELLS; i++) {
      const c = el('div', { attrs: { 'data-cell': String(i) } });
      cells.push(c);
      wrap.append(c);
    }
    const done = el('button', { text: 'Done' });
    area.append(wrap, done);

    let down = false;
    const fill = target => {
      const i = target && target.dataset ? target.dataset.cell : undefined;
      if (i === undefined) return;
      beats.coverage[i] = Math.min(1.2, beats.coverage[i] + 0.06);
      target.style.background = `rgba(201,168,255,${Math.min(1, beats.coverage[i])})`;
    };
    wrap.addEventListener('mousedown', e => { down = true; fill(e.target); });
    wrap.addEventListener('mousemove', e => { if (down) fill(e.target); });
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
