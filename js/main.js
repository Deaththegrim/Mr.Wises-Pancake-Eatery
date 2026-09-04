import { newGame, serialize, deserialize } from './engine/state.js';
import { openDay, closeDay, nextCustomer, serve, customersToday } from './engine/day.js';
import { META } from './data/meta.js';
import { showScreen, showNotice } from './ui/screens.js';
import { renderMorning, renderCustomer } from './ui/shopfront.js';
import { renderLedger, renderQuotaBoard } from './ui/ledger.js';
import { renderTree, renderBench } from './ui/tree.js';
import { mountGriddle } from './ui/griddle.js';
import { playScene } from './ui/vn.js';

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
  try { raw = localStorage.getItem(META.saveKey); } catch { raw = null; }
  if (!raw) { showNotice('No save found.'); return false; }
  const r = deserialize(raw);
  if (!r.ok) { showNotice(r.reason, 8000); return false; }
  state = r.state;
  return true;
}

function toMorning() {
  state.phase = 'morning';
  renderMorning(state, () => renderQuotaBoard(state));
  showScreen('morning');
  saveGame();
}

function toService() {
  openDay(state);
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
  renderCustomer(order);
  if (!order) return;

  mountGriddle(document.getElementById('griddle-mount'), order.recipeId, beats => {
    const result = serve(state, order.recipeId, beats);
    servedToday += 1;
    const b = result.breakdown;
    showNotice(
      `${result.quality}%  ·  pour ${b.pour} flip ${b.flip} stack ${b.stack} drizzle ${b.drizzle}` +
      `  ·  ${result.payout}${result.tip ? ` +${result.tip} tip` : ''}`, 5000);
    saveGame();
    nextOrder();
  });
}

function toEvening() {
  const dayResult = closeDay(state);
  renderLedger(state, dayResult);
  saveGame();

  if (dayResult.weekRolled) {
    // The quota is the story metronome. Hitting it opens the next beat;
    // missing it fires a softer scene and costs nothing at all.
    const first = !state.flags.metHer;
    if (first) state.flags.metHer = true;
    const sceneId = first ? 'visit_first' : (dayResult.weekResult.met ? 'quota_met' : 'quota_missed');
    playScene(sceneId, state, () => { saveGame(); showScreen('evening'); });
    return;
  }

  showScreen('evening');
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
document.getElementById('btn-back-evening').addEventListener('click', () => showScreen('evening'));

showScreen('title');

// Exposed for manual browser testing: GAME.state, GAME.save(), GAME.load().
window.GAME = { get state() { return state; }, save: saveGame, load: loadGame };
