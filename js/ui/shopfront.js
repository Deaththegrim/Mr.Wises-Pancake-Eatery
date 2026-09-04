import { RECIPES } from '../data/recipes.js';
import { INGREDIENTS } from '../data/ingredients.js';
import { renderQuotaBoard } from './ledger.js';
import { stockOf, priceOf, buyIngredient } from '../engine/pantry.js';
import { customersToday } from '../engine/day.js';
import { el, clear, showNotice } from './screens.js';

const recipeById = id => RECIPES.find(r => r.id === id);

let onChangeRef = null;

export function renderMorning(state, onChange) {
  onChangeRef = onChange;
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
  renderStockWarning(state);
  renderQuotaBoard(state);
}

/* Cooking now spends ingredients, so the morning needs to say whether you
   can actually get through the day. Running out is not fatal — you buy at
   double price mid-service — but that should be a choice, not a surprise. */
function renderStockWarning(state) {
  const mount = document.getElementById('stock-warning');
  if (!mount) return;
  clear(mount);

  const expected = customersToday(state);
  const needed = new Set();
  for (const id of state.menu) {
    const r = RECIPES.find(x => x.id === id);
    if (r) for (const ing of r.ingredients) needed.add(ing);
  }

  const short = [...needed].filter(id => stockOf(state, id) < expected);
  if (short.length === 0) {
    mount.append(el('p', { className: 'muted',
      text: `Stocked for roughly ${expected} customers today.` }));
    return;
  }

  const names = short.map(id => (INGREDIENTS.find(i => i.id === id) || { name: id }).name);
  const restock = short.reduce((a, id) => a + priceOf(id), 0);

  mount.append(el('p', { className: 'hint',
    text: `Low on ${names.join(', ')} for ~${expected} customers. ` +
          `You can open anyway — you would buy at double price mid-service.` }));

  // Telling the player the price without giving them a way to act on it
  // sends them hunting through another screen. Close the loop here.
  const btn = el('button', {
    text: state.money >= restock
      ? `Restock one unit of each — ${restock}`
      : `Restock needs ${restock}, you have ${state.money}`
  });
  btn.disabled = state.money < restock;
  btn.addEventListener('click', () => {
    for (const id of short) buyIngredient(state, id, 1);
    renderMorning(state, onChangeRef);
    showNotice(`Restocked. ${state.money} left in the till.`);
  });
  mount.append(btn);
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
