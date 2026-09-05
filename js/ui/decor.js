import { el, clear, showNotice } from './screens.js';
import { decorFor, buyDecor, ownedDecor } from '../engine/decor.js';
import { spriteImg } from './art.js';

/* THE SHOP SCREEN, and the room it furnishes.

   Decoration is the only place money goes once the research tree is done,
   which is most of the last two weeks — before this the till simply
   climbed with nothing to spend it on.

   It is cosmetic, deliberately. The engine never lets it touch reputation
   and the UI must not imply otherwise, so nothing here reports a benefit:
   each row is a name, a price and the line of prose that says what it is
   for. Nobody needs the window boxes. That is the point of them. */

export function renderDecorShop(state, onChange) {
  /* Which row had focus, so it can be given back after the rebuild.
     Buying clears and redraws the whole card, which destroys the button
     the player just pressed and drops focus to <body> — ui/screens.js
     carries a long comment about exactly this symptom, because a keyboard
     player loses their place on every single purchase and a second Enter
     goes nowhere. */
  const hadFocus = document.activeElement;
  const focusedId = hadFocus && hadFocus.closest && hadFocus.closest('.decor-row')
    ? hadFocus.closest('.decor-row').dataset.decor
    : null;

  const mount = clear(document.getElementById('decor-shop'));
  const items = decorFor(state);
  const card = el('div', { className: 'card' });
  card.append(el('h3', { text: 'The shop' }));

  const owned = items.filter(i => i.owned).length;
  card.append(el('p', { className: 'muted',
    text: owned === items.length
      ? 'Nothing left to buy for it. It looks like somewhere.'
      : `${owned} of ${items.length}. Nothing here helps you cook.` }));

  for (const item of items) {
    const row = el('div', { className: `decor-row${item.owned ? ' owned' : ''}` });
    row.dataset.decor = item.id;
    row.append(el('span', { className: 'decor-name', text: item.name }));
    row.append(el('span', { className: 'why', text: item.note }));

    if (item.owned) {
      row.append(el('span', { className: 'decor-have', text: 'bought' }));
    } else {
      const btn = el('button', { text: `${item.cost}` });
      btn.disabled = !item.affordable;
      btn.setAttribute('aria-label', `Buy ${item.name} for ${item.cost}`);
      btn.addEventListener('click', () => {
        const r = buyDecor(state, item.id);
        showNotice(r.ok ? `${r.item.name}. ${r.item.note}` : r.reason, 6000);
        if (onChange) onChange();
      });
      row.append(btn);
    }
    card.append(row);
  }
  mount.append(card);

  /* Give the keyboard its place back. The row just bought no longer has a
     button, so focus moves to the next thing that does — which is where
     the player was heading anyway. */
  if (focusedId) {
    const rows = [...card.querySelectorAll('.decor-row')];
    const at = rows.findIndex(r => r.dataset.decor === focusedId);
    const next = rows.slice(Math.max(0, at)).map(r => r.querySelector('button')).find(Boolean)
      || rows.map(r => r.querySelector('button')).find(Boolean);
    if (next) next.focus();
  }
}

/* The room itself, above the counter. Each owned thing is drawn as a
   labelled placeholder until the sprite named by its `art` field exists;
   swapping in the art changes nothing but this function. */
export function renderShopfrontDecor(state) {
  const mount = clear(document.getElementById('shopfront-decor'));
  const items = ownedDecor(state);
  if (!items.length) return;                 // an empty room needs no strip

  const strip = el('div', { className: 'decor-strip' });
  strip.setAttribute('aria-label', 'The shop, as you have furnished it');
  for (const item of items) {
    /* The picture if one exists, the labelled outline if not. Each item's
       `art` field names its slot in data/art.js; dropping a PNG at that
       path is the whole of "adding the artwork". */
    const img = spriteImg(item.art, item.name);
    if (img) {
      img.className = 'decor-art';
      img.title = item.note;
      strip.append(img);
    } else {
      strip.append(el('span', { className: 'decor-token', text: item.name, attrs: { title: item.note } }));
    }
  }
  mount.append(strip);
}
