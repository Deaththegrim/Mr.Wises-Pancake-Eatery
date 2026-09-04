/* Build an element with TEXT content, never parsed HTML.

   Everything in js/data/ is authored by hand by a content author, so any
   string from there (a customer name, a dialogue line, a hint) must be set
   as text. Otherwise a stray "<" in a line of dialogue silently eats the
   rest of the sentence, and imported content becomes an injection vector.
   Use this for anything data-derived; plain templates are fine for numbers
   the engine computed. */
export function el(tag, { className, text, attrs } = {}, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) if (c) node.append(c);
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function showScreen(id) {
  for (const el of document.querySelectorAll('.screen')) {
    el.classList.toggle('active', el.id === `screen-${id}`);
  }
}

let noticeTimer = null;
export function showNotice(msg, ms = 4000) {
  const el = document.getElementById('notice');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/* Used when a story scene starts. A leftover score readout floating over
   Synthia's first appearance steps on the moment. */
export function hideNotice() {
  clearTimeout(noticeTimer);
  document.getElementById('notice').hidden = true;
}
