import { RECIPES } from '../data/recipes.js';
import { renderQuotaBoard } from './ledger.js';
import { el, clear } from './screens.js';

const recipeById = id => RECIPES.find(r => r.id === id);

export function renderMorning(state, onChange) {
  const mount = clear(document.getElementById('menu-picker'));

  for (const id of state.unlockedRecipes) {
    const r = recipeById(id);
    if (!r) continue;                       // stale id: skip, never throw

    const box = el('input', { attrs: { type: 'checkbox' } });
    box.checked = state.menu.includes(id);
    box.addEventListener('change', () => {
      if (box.checked) {
        if (!state.menu.includes(id)) state.menu.push(id);
      } else {
        state.menu = state.menu.filter(m => m !== id);
      }
      document.getElementById('btn-open').disabled = state.menu.length === 0;
      if (onChange) onChange();
    });

    // r.name is author-written: textContent, not markup.
    const label = el('label', {}, box,
      el('span', { text: r.name }),
      el('span', { className: 'price', text: `${r.base} · ${(r.tags || []).join(', ')}` }));
    mount.append(label);
  }

  if (state.unlockedRecipes.length === 0) {
    mount.append(el('p', { className: 'muted', text: 'Nothing to cook. That should not happen.' }));
  }

  document.getElementById('btn-open').disabled = state.menu.length === 0;
  renderQuotaBoard(state);
}

export function renderCustomer(order) {
  const mount = clear(document.getElementById('customer-card'));
  if (!order) {
    mount.append(el('div', { className: 'card muted', text: 'Nobody right now. You could close up.' }));
    return;
  }
  const r = recipeById(order.recipeId);
  mount.append(el('div', { className: 'card' },
    el('strong', { text: order.customer.name }),
    el('p', { text: order.customer.lines.greeting }),
    el('p', { className: 'muted', text: `Order: ${r ? r.name : order.recipeId}` })));
}
