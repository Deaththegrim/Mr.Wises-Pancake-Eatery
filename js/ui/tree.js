import { RESEARCH } from '../data/research.js';
import { INGREDIENTS } from '../data/ingredients.js';
import { SYRUPS } from '../data/syrups.js';
import { RECIPES } from '../data/recipes.js';
import { purchase, isAvailable, gateMet, experiment } from '../engine/research.js';
import { priceOf, stockOf, canAfford, buyIngredient } from '../engine/pantry.js';
import { TUNING } from '../data/economy.js';
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

/* The market and the bench are one screen on purpose: you can see the
   money leaving the till and turning into the thing you are about to burn
   on an experiment. That connection IS the grind. */
export function renderBench(state, onChange) {
  const mount = clear(document.getElementById('bench-mount'));
  const chosen = [];                       // an array: a blend may repeat an item

  const money = el('span', { text: String(state.money) });
  const result = el('div', { className: 'hint' });
  const rows = new Map();                  // ingredient id -> {stockEl, buyBtn, useBtn}

  const refreshRow = ing => {
    const row = rows.get(ing.id);
    if (!row) return;
    const stock = stockOf(state, ing.id);
    const used = chosen.filter(x => x === ing.id).length;
    row.stockEl.textContent = `${stock} servings` + (used ? ` · using ${used}` : '');
    row.buyBtn.disabled = !canAfford(state, ing.id, 1);
    row.buyBtn.textContent = `buy ${priceOf(ing.id)}`;
    // One experiment burns a whole unit, so you need a full unit spare.
    row.useBtn.disabled = stock - used * TUNING.servingsPerUnit < TUNING.servingsPerUnit
                          || chosen.length >= 3;
    row.useBtn.style.borderColor = used ? 'var(--accent)' : '';
    money.textContent = String(state.money);
  };
  const refreshAll = () => { for (const ing of INGREDIENTS) refreshRow(ing); };

  // --- market ---
  const market = el('div', { className: 'card' });
  market.append(el('h3', { text: 'Stock' }));
  market.append(el('p', { className: 'muted' },
    el('span', { text: `One unit = ${TUNING.servingsPerUnit} servings. Cooking spends one serving; the bench burns a whole unit. In the till: ` }),
    money));

  for (const ing of INGREDIENTS) {
    const stockEl = el('span', { className: 'why' });
    const buyBtn = el('button', { className: 'ing' });
    const useBtn = el('button', { className: 'ing', text: 'use' });

    buyBtn.addEventListener('click', () => {
      const r = buyIngredient(state, ing.id, 1);
      if (!r.ok) showNotice(r.reason);
      refreshAll();
      if (onChange) onChange();
    });

    useBtn.addEventListener('click', () => {
      if (chosen.length >= 3) { showNotice('Three at a time is plenty.'); return; }
      const spare = stockOf(state, ing.id) -
        chosen.filter(x => x === ing.id).length * TUNING.servingsPerUnit;
      if (spare < TUNING.servingsPerUnit) {
        showNotice(`Not enough ${ing.name} for an experiment — the bench uses a whole unit.`);
        return;
      }
      chosen.push(ing.id);
      refreshAll();
    });

    rows.set(ing.id, { stockEl, buyBtn, useBtn });
    market.append(el('div', { className: 'stock-row' },
      el('span', { className: 'stock-name', text: ing.name }),
      stockEl, buyBtn, useBtn));
  }

  // --- bench ---
  const card = el('div', { className: 'card' });
  card.append(el('h3', { text: 'The bench' }));
  card.append(el('p', { className: 'muted', text: 'Combine two or three things. Whatever you use is gone, whether or not it works — but a miss always tells you something.' }));

  const chosenLine = el('div', { className: 'why', text: 'nothing selected' });
  const updateChosen = () => {
    chosenLine.textContent = chosen.length
      ? `Blending: ${chosen.map(id => (INGREDIENTS.find(i => i.id === id) || {}).name).join(' + ')}`
      : 'nothing selected';
  };

  const clearBtn = el('button', { text: 'Clear' });
  clearBtn.addEventListener('click', () => { chosen.length = 0; updateChosen(); refreshAll(); });

  const go = el('button', { text: 'Try it' });
  go.addEventListener('click', () => {
    if (chosen.length === 0) { showNotice('Pick something first.'); return; }
    // experiment() credits the points itself; the UI must not do economy.
    const r = experiment(state, [...chosen]);
    if (r.found) {
      const s = SYRUPS.find(x => x.id === r.syrupId);
      result.textContent = `You have made something. ${s ? s.name : r.syrupId}.`;
    } else {
      result.textContent = r.hint;
    }
    // Blocked experiments consume nothing, so keep the selection to fix it.
    if (!r.blocked) chosen.length = 0;
    updateChosen();
    refreshAll();
    if (onChange) onChange();
  });

  card.append(chosenLine, go, clearBtn, result);

  /* The bench goes ABOVE the market. The bench is the verb; the stock list
     is just supply. With 14 ingredients the market is long, and putting it
     first pushed the actual action below the fold. */
  mount.append(card, market);

  updateChosen();
  refreshAll();
}
