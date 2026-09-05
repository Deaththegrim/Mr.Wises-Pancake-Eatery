import { newGame, serialize, deserialize } from './engine/state.js';
import { openDay, closeDay, nextCustomer, serve, customersToday } from './engine/day.js';
import { META } from './data/meta.js';
import { showScreen, showNotice, el, clear } from './ui/screens.js';
import { renderMorning, renderCustomer } from './ui/shopfront.js';
import { renderLedger, renderQuotaBoard, renderReceipt, clearReceipt } from './ui/ledger.js';
import { renderDecorShop, renderShopfrontDecor } from './ui/decor.js';
import { renderTree, renderBench } from './ui/tree.js';
import { mountGriddle } from './ui/griddle.js';
import { playScene } from './ui/vn.js';
import { missSceneFor, mentionSceneFor, endingTitleFor } from './engine/story.js';
import { tierFor } from './engine/affection.js';
import { characterOf } from './engine/syrup.js';
import { TUNING } from './data/economy.js';
import { SCENES, IMPOSSIBLE_ORDER_LINES } from './data/scenes.js';
import { syrupById, recipeById, nameOf } from './engine/lookup.js';
import { play, stopAll, unlock, toggleMuted, isMuted } from './ui/audio.js';

const TITLE_FALLBACK = 'Pancake Shop';
const title = META.title || TITLE_FALLBACK;

let state = null;
let order = null;
let servedToday = 0;

function saveGame() {
  if (!state) return;
  try {
    localStorage.setItem(META.saveKey, serialize(state));
  } catch (e) {
    showNotice(`Could not save: ${e.message}`);
  }
}

function loadGame() {
  let raw = null;
  try {
    raw = localStorage.getItem(META.saveKey);
  } catch (e) {
    /* Private-browsing mode and "block third-party cookies" both make this
       THROW rather than return null. Reporting that as "No save found."
       tells a player their progress is gone when it was never written —
       and hides the fact that playing on will not save either. */
    showNotice('This browser is blocking local storage, so the game cannot save or load. Try a normal (non-private) window.', 10000);
    return false;
  }
  if (!raw) { showNotice('No save found.'); return false; }
  const r = deserialize(raw);
  if (!r.ok) { showNotice(r.reason, 8000); return false; }
  state = r.state;
  return true;
}

function toMorning() {
  if (state.ended) { showEnding(state.endingId); return; }
  state.phase = 'morning';
  renderMorning(state, () => renderQuotaBoard(state));
  showScreen('morning');
  saveGame();
}

function toService() {
  openDay(state);
  play('day_open');
  clearReceipt();
  renderShopfrontDecor(state);
  servedToday = 0;
  showScreen('service');
  nextOrder();
}

function nextOrder() {
  renderQuotaBoard(state);

  // Traffic is reputation-driven; past it, the day winds down on its own.
  if (servedToday >= customersToday(state)) {
    renderCustomer(null);
    showNotice('That is everyone for today.');
    return;
  }

  order = nextCustomer(state);
  // While she is asking for something you cannot make, she has not
  // settled on an order yet — so the card must not print one.
  renderCustomer(order, { hideOrder: !!(order && order.impossibleAsk) });
  if (!order) return;

  /* Her bell is lower and slower than everyone else's, so the room
     changes before the card is read. It is the only place the sound
     layer knows who walked in, and it costs one branch.

     Written as two literal calls rather than one call with a ternary
     because the test that proves every declared sound is reachable greps
     for the id — and a slot it cannot see is a slot it cannot vouch for.
     The ternary version passed nothing and looked identical. */
  if (order.isSynthia) play('bell_quiet');
  else play('bell');

  /* When SHE is the customer, she says something first — sometimes
     something she misses, tagged so that researching and serving it weeks
     later fires the listening beat. Without this the mentions are never
     recorded and that beat can never happen. */
  if (order.isSynthia && !state.flags[`mentioned_w${state.week}`]) {
    const mention = mentionSceneFor(state);
    if (mention) {
      state.flags[`mentioned_w${state.week}`] = true;
      playScene(mention, state, () => { showScreen('service'); proceedWith(order); });
      return;
    }
  }

  proceedWith(order);
}

/* The single door into cooking. Both callers — a plain order, and one
   that arrives after her mention scene — must pass through here: the
   first cut checked for the impossible ask only on the direct path, so
   whenever she opened with a mention (which is most weeks) the ask was
   silently skipped and the research goal never got planted. */
function proceedWith(current) {
  if (current.impossibleAsk) {
    askImpossible(current);
    return;
  }
  cookFor(current);
}

function askImpossible(current) {
  const dish = nameOf(recipeById, current.impossibleAsk);
  const line = IMPOSSIBLE_ORDER_LINES[
    Math.floor(Math.random() * IMPOSSIBLE_ORDER_LINES.length)];

  const mount = clear(document.getElementById('griddle-mount'));
  const card = el('div', { className: 'card' },
    el('p', { text: `“${dish}.”` }),
    el('p', { className: 'muted', text: 'You do not know how to make that yet.' }));
  for (const para of line.split('\n\n')) card.append(el('p', { text: para }));

  const go = el('button', { text: 'Say so' });
  go.addEventListener('click', () => {
    showNotice(`${dish} is on the research board now — she asked for it.`, 6000);
    renderCustomer(current);          // she settles for what you do have
    saveGame();
    cookFor(current);
  }, { once: true });
  card.append(go);
  mount.append(card);
  go.focus();
}

function cookFor(current) {
  // What the player can pour today, in the order they unlocked them.
  const syrups = state.unlockedSyrups
    .map(syrupById)
    .filter(Boolean)
    .map(s => ({ id: s.id, name: s.name, character: characterOf(s) }));

  mountGriddle(document.getElementById('griddle-mount'), current.recipeId, beats => {
    const result = serve(state, current.recipeId, beats, {
      forSynthia: !!current.isSynthia,
      syrupId: beats.syrupId,
      taste: current.customer && current.customer.taste
    });
    servedToday += 1;

    /* The receipt carries every number now — the parts, the adjustments,
       the tip, what the stock cost and what was kept. Repeating them in
       the notice floated a second copy over the top of the first and hid
       the bottom of the bill.

       So the notice carries only what a receipt cannot: the customer
       saying something, and the verdict on the syrup — which is how the
       player learns a taste they are never shown. */
    // nextCustomer() always returns a customer with the order, so this is
    // not defended against — guarding here and then reading .name unguarded
    // two lines down told two different stories about the same object.
    const lines = current.customer.lines || {};
    const said = result.quality >= TUNING.happyAt ? lines.happy : lines.disappointed;
    renderReceipt(recipeById(current.recipeId), result, current.customer.name, said);
    play('serve');
    play('till');

    saveGame();

    // She remembered that she mentioned it. This is the payoff.
    if (result.noticed) {
      playScene('noticed', state, () => { saveGame(); showScreen('service'); nextOrder(); });
      return;
    }
    nextOrder();
  }, { syrups });
}

/* The evening screen shows the till in three places at once — the header,
   the ledger's "In the till", and which shop buttons are live — so all
   three have to be redrawn together, from wherever money moves.

   Kept at module scope because the player leaves this screen and comes
   back: research is a separate screen that spends from the same till, and
   "Back" used to be nothing but showScreen('evening'). Spend 2,800 at the
   bench and return, and the header said 200 while the ledger four lines
   below said 3,000 and the shop offered a lamp at 2,600 with a live
   button. Buying it was safe — buyDecor re-reads the money and refuses —
   but the refusal was the only sign the panel had been lying. */
let lastDayResult = null;

function renderEvening() {
  if (!state) return;
  renderLedger(state, lastDayResult);
  renderDecorShop(state, renderEvening);
  renderQuotaBoard(state);
  saveGame();
}

function toEvening() {
  /* Any held beat sound dies with the service screen. Without this a pour
     whose mouseup landed off the button keeps hissing behind the ledger. */
  stopAll();
  play('day_close');
  lastDayResult = closeDay(state);
  const dayResult = lastDayResult;
  renderQuotaBoard(state);   // the week may have rolled; the HUD must agree
  renderEvening();

  if (dayResult.weekRolled) {
    // The quota is the story metronome. Hitting it opens the next beat;
    // missing it fires a softer scene and costs nothing at all.
    const first = !state.flags.metHer;
    if (first) state.flags.metHer = true;

    // The last authored week ends the story, chosen by how close she got.
    if (dayResult.ended) {
      playScene(dayResult.ending, state, () => { saveGame(); showEnding(dayResult.ending); });
      return;
    }

    const sceneId = first
      ? 'visit_first'
      : (dayResult.weekResult.met ? 'quota_met' : missSceneFor(state.missCount || 1));
    playScene(sceneId, state, () => { saveGame(); showScreen('evening'); });
    return;
  }

  showScreen('evening');
}

/* The card after the last scene. Reports the shape of the run rather than a
   score — this is a cozy game, and there is nothing to win. */
function showEnding(endingId) {
  document.getElementById('ending-title').textContent =
    endingTitleFor(endingId) || 'The season turns';
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const cooked = Object.values(state.cooked).reduce((a, b) => a + b, 0);
  document.getElementById('ending-summary').textContent =
    `${plural(state.week - 1, 'week', 'weeks')}. ` +
    `${plural(cooked, 'pancake', 'pancakes')}. ` +
    `${plural(state.unlockedSyrups.length, 'syrup', 'syrups')}. ` +
    `She ended up ${tierFor(state.synthia.points).toLowerCase()}.`;
  showScreen('ending');
}

function toResearch() {
  /* The tree re-renders itself after a purchase. The BENCH must not — it
     owns transient state (which ingredients are selected, the last hint),
     and re-rendering it wipes both. It is drawn once and left alone; its
     callback only refreshes the tree, which is where the points total is
     shown. */
  const refreshTree = () => {
    renderTree(state, refreshTree);
    renderQuotaBoard(state);
    saveGame();
  };
  refreshTree();
  renderBench(state, refreshTree);
  showScreen('research');
}

document.getElementById('title-text').textContent = title;
document.getElementById('hud-title').textContent = title;

document.getElementById('btn-new').addEventListener('click', () => { state = newGame(); toMorning(); });
document.getElementById('btn-continue').addEventListener('click', () => { if (loadGame()) toMorning(); });
document.getElementById('btn-open').addEventListener('click', toService);
document.getElementById('btn-close').addEventListener('click', toEvening);
document.getElementById('btn-next-day').addEventListener('click', toMorning);
document.getElementById('btn-research').addEventListener('click', toResearch);
document.getElementById('btn-restart').addEventListener('click', () => { state = newGame(); toMorning(); });
document.getElementById('btn-back-evening').addEventListener('click', () => { renderEvening(); showScreen('evening'); });

/* SOUND. The button reports the state it is in rather than the state it
   would move to — "Sound: off" next to a silent game is readable; "Turn
   sound on" next to a silent game reads as a label for the silence. */
const soundBtn = document.getElementById('btn-sound');
function renderSound() {
  const on = !isMuted();
  soundBtn.textContent = on ? 'Sound: on' : 'Sound: off';

  /* aria-pressed has to AGREE with the label. It was set to isMuted(), so
     a button reading "Sound: off" announced as pressed — and pressed
     conventionally means engaged, which is the opposite. A screen-reader
     user got "Sound: off, pressed", which reads as a broken control. */
  soundBtn.setAttribute('aria-pressed', String(on));

  /* The dimming is a separate class rather than a [aria-pressed] selector.
     Styling off the ARIA state is what made the bug above possible: the
     visual said "muted" and the semantics said "on", and fixing either one
     alone silently broke the other. */
  soundBtn.classList.toggle('is-muted', !on);
}
soundBtn.addEventListener('click', () => { toggleMuted(); renderSound(); });
renderSound();

/* Browsers will not start an audio context before the player has
   interacted with the page, so the first gesture anywhere wakes it — once,
   and before any beat needs it, so the first sound is not the one lost
   while the hardware comes up.

   KEYDOWN AS WELL AS CLICK. The pour beat is deliberately operable from
   the keyboard, so a click-only unlock left keyboard-only players building
   the context inside the first beat instead of ahead of it — the exact
   case this exists to prevent. */
document.addEventListener('click', unlock, { once: true });
document.addEventListener('keydown', unlock, { once: true });

showScreen('title');

// Exposed for manual browser testing: GAME.state, GAME.save(), GAME.load().
window.GAME = { get state() { return state; }, save: saveGame, load: loadGame };
