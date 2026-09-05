import { SCENES } from '../data/scenes.js';
import { showScreen, showNotice, hideNotice, el, clear } from './screens.js';
import { expressionFor, noteMention, grant } from '../engine/affection.js';

const SPRITE_DIR = 'assets/sprites/synthia_casual/';
/* Tolerant of a non-string key: a scene written with `expr: 0`, or a tier
   added to TIER_ORDER without a matching TIER_EXPRESSION, used to throw here
   and strand the player on a buttonless screen. */
const spriteFor = key => {
  const k = typeof key === 'string' && key ? key : 'neutral';
  return `${SPRITE_DIR}${k.startsWith('c') && k.includes('_') ? k : 'c_' + k}.png`;
};

export function playScene(startId, state, onEnd) {
  let current = startId;

  const finish = () => onEnd();

  /* #screen-vn is the only screen with no permanent button, so ANY throw in
     here leaves the player on a dead screen with no way out but a reload.
     Wrapping render means a malformed scene degrades to "continue" rather
     than trapping them. */
  const safely = fn => {
    try { fn(); }
    catch (e) {
      console.warn('[vn] scene render failed:', e);
      showNotice('That scene could not be shown. Continuing.', 6000);
      const out = clear(document.getElementById('vn-choices'));
      const btn = el('button', { text: 'Continue' });
      btn.addEventListener('click', finish, { once: true });
      out.append(btn);
    }
  };

  const render = () => {
    const node = SCENES[current];

    // A missing node must be diagnosable, never a dead click.
    if (!node) {
      console.warn(`[vn] missing scene node: ${current}`);
      showNotice(`Story node "${current}" is missing. Skipping ahead.`);
      return finish();
    }

    document.getElementById('vn-name').textContent = node.speaker || '';
    document.getElementById('vn-text').textContent = node.text || '';

    // Her expression and how long she lingers both default to her tier,
    // so the arc shows even in scenes that say nothing about it.
    const key = node.expr || node.pose || expressionFor(state.synthia.points);
    const img = document.getElementById('vn-sprite');
    img.onerror = () => {
      console.warn(`[vn] missing sprite: ${img.getAttribute('src')}`);
      img.removeAttribute('src');
    };
    img.src = spriteFor(key);

    if (node.mentions) noteMention(state.synthia, node.mentions);

    const choicesEl = clear(document.getElementById('vn-choices'));

    if (node.end) {
      const btn = el('button', { text: 'Continue' });
      btn.addEventListener('click', finish, { once: true });
      choicesEl.append(btn);
      return;
    }

    const valid = (node.choices || []).filter(c => c && c.text && c.next);
    if (node.choices && valid.length === 0) {
      console.warn(`[vn] node "${current}" has choices but none are usable`);
      showNotice('This scene has no usable choices. Continuing.');
      return finish();
    }

    if (valid.length > 0) {
      for (const c of valid) {
        const btn = el('button', { text: c.text });
        btn.addEventListener('click', () => {
          if (c.affection) grant(state.synthia, c.affection, 'a choice she liked');
          current = c.next;
          safely(render);
        }, { once: true });
        choicesEl.append(btn);
      }
      return;
    }

    if (!node.next) {
      console.warn(`[vn] node "${current}" has no next and is not marked end`);
      showNotice('This scene has no ending. Continuing.');
      return finish();
    }

    const btn = el('button', { text: 'Next' });
    btn.addEventListener('click', () => { current = node.next; safely(render); }, { once: true });
    choicesEl.append(btn);
  };

  hideNotice();   // a leftover score readout must not sit over her first line
  showScreen('vn');
  safely(render);
}
