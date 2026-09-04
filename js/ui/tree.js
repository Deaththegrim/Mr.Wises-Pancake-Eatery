import { RESEARCH } from '../data/research.js';
import { INGREDIENTS } from '../data/ingredients.js';
import { SYRUPS } from '../data/syrups.js';
import { RECIPES } from '../data/recipes.js';
import { purchase, isAvailable, gateMet, experiment } from '../engine/research.js';
import { el, clear, showNotice } from './screens.js';

/* Why a node is not available yet, in the author's own words. Potion
   Craft's biggest complaint was not knowing where to go next, so a locked
   node always says what would unlock it. */
function blockedReason(node, state) {
  const missing = node.prereqs.filter(p => !state.purchased.includes(p));
  if (missing.length) {
    const names = missing.map(id => (RESEARCH.find(n => n.id === id) || {}).name || id);
    return `Needs first: ${names.join(', ')}`;
  }
  if (!gateMet(node, state) && node.gate && node.gate.cooked) {
    const parts = Object.entries(node.gate.cooked).map(([rid, need]) => {
      const r = RECIPES.find(x => x.id === rid);
      return `${state.cooked[rid] || 0}/${need} ${r ? r.name : rid}`;
    });
    return `Cook more: ${parts.join(', ')}`;
  }
  return null;
}

function unlockLabel(node) {
  const u = node.unlocks || {};
  if (u.recipe) {
    const r = RECIPES.find(x => x.id === u.recipe);
    return `unlocks ${r ? r.name : u.recipe}`;
  }
  if (u.syrup) {
    const s = SYRUPS.find(x => x.id === u.syrup);
    return `unlocks ${s ? s.name : u.syrup}`;
  }
  if (u.upgrade) return 'makes a beat more forgiving';
  return '';
}

export function renderTree(state, onChange) {
  const mount = clear(document.getElementById('tree-mount'));
  mount.append(el('div', { className: 'card' },
    el('div', { className: 'score-row' },
      el('span', { text: 'Research points' }),
      el('span', { text: String(state.points) }))));

  for (const node of RESEARCH) {
    const done = state.purchased.includes(node.id);
    const open = isAvailable(node, state);
    const affordable = open && state.points >= node.cost;

    const row = el('div', { className: `node${affordable ? ' affordable' : ''}` });
    row.append(el('div', { text: `${node.name} — ${node.cost} pts${done ? ' ✓' : ''}` }));
    row.append(el('div', { className: 'why', text: unlockLabel(node) }));

    if (!done) {
      const why = blockedReason(node, state);
      if (why) {
        row.append(el('div', { className: 'why', text: why }));
      } else {
        const btn = el('button', { text: affordable ? 'Research' : `Need ${node.cost} pts` });
        btn.disabled = !affordable;
        btn.addEventListener('click', () => {
          const r = purchase(state, node.id);
          showNotice(r.ok ? `Researched: ${node.name}` : r.reason);
          if (onChange) onChange();
        });
        row.append(btn);
      }
    }
    mount.append(row);
  }
}

export function renderBench(state, onChange) {
  const mount = clear(document.getElementById('bench-mount'));
  const chosen = new Set();

  const card = el('div', { className: 'card' });
  card.append(el('h3', { text: 'The bench' }));
  card.append(el('p', { className: 'muted', text: 'Combine two or three things and see what happens. A miss still tells you something.' }));

  const picker = el('div');
  for (const ing of INGREDIENTS) {
    const btn = el('button', { className: 'ing', text: ing.name });
    btn.addEventListener('click', () => {
      if (chosen.has(ing.id)) { chosen.delete(ing.id); btn.style.borderColor = ''; }
      else if (chosen.size < 3) { chosen.add(ing.id); btn.style.borderColor = 'var(--accent)'; }
      else showNotice('Three at a time is plenty.');
    });
    picker.append(btn);
  }
  card.append(picker);

  const result = el('div', { className: 'hint' });
  const go = el('button', { text: 'Try it' });
  go.addEventListener('click', () => {
    if (chosen.size === 0) { showNotice('Pick something first.'); return; }
    const r = experiment(state, [...chosen]);
    state.points += r.points;
    if (r.found) {
      const s = SYRUPS.find(x => x.id === r.syrupId);
      result.textContent = `You have made something. ${s ? s.name : r.syrupId}.`;
    } else {
      result.textContent = r.hint;
    }
    if (onChange) onChange();
  });

  card.append(go, result);
  mount.append(card);
}
