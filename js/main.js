import { newGame, serialize, deserialize } from './engine/state.js';
import { openDay, closeDay, nextCustomer, serve, customersToday } from './engine/day.js';
import { META } from './data/meta.js';
import { showScreen, showNotice } from './ui/screens.js';
import { renderMorning, renderCustomer } from './ui/shopfront.js';
import { renderLedger, renderQuotaBoard } from './ui/ledger.js';
import { renderTree, renderBench } from './ui/tree.js';
import { mountGriddle } from './ui/griddle.js';
import { playScene } from './ui/vn.js';
import { missSceneFor, mentionSceneFor } from './engine/story.js';
import { tierFor } from './engine/affection.js';
import { SCENES } from './data/scenes.js';

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
  if (state.ended) { showEnding(state.endingId); return; }
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

  /* When SHE is the customer, she says something first — sometimes
     something she misses, tagged so that researching and serving it weeks
     later fires the listening beat. Without this the mentions are never
     recorded and that beat can never happen. */
  if (order.isSynthia && !state.flags[`mentioned_w${state.week}`]) {
    const mention = mentionSceneFor(state);
    if (mention) {
      state.flags[`mentioned_w${state.week}`] = true;
      playScene(mention, state, () => { showScreen('service'); cookFor(order); });
      return;
    }
  }

  cookFor(order);
}

function cookFor(order) {
  mountGriddle(document.getElementById('griddle-mount'), order.recipeId, beats => {
    const result = serve(state, order.recipeId, beats, { forSynthia: !!order.isSynthia });
    servedToday += 1;
    const b = result.breakdown;
    // Show the margin, not just the takings — the cost of goods is a real
    // decision and the player cannot make it if they cannot see it.
    const cost = result.ingredientCost + result.emergencyCost;
    const emergency = result.emergencyCost
      ? ` (${result.emergencyCost} emergency stock!)` : '';
    showNotice(
      `${result.quality}%  ·  pour ${b.pour} flip ${b.flip} stack ${b.stack} drizzle ${b.drizzle}` +
      `  ·  +${result.payout}${result.tip ? ` +${result.tip} tip` : ''}` +
      `${cost ? ` −${cost} stock${emergency}` : ''}`, 5000);
    saveGame();

    // She remembered that she mentioned it. This is the payoff.
    if (result.noticed) {
      playScene('noticed', state, () => { saveGame(); showScreen('service'); nextOrder(); });
      return;
    }
    nextOrder();
  });
}

function toEvening() {
  const dayResult = closeDay(state);
  renderLedger(state, dayResult);
  renderQuotaBoard(state);   // the week may have rolled; the HUD must agree
  saveGame();

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
  const node = SCENES[endingId] || {};
  let title = node.endingTitle;
  if (!title) {
    // Walk to the terminal node, which is where the title lives.
    let id = endingId, hops = 0;
    while (id && hops < 20) {
      const n = SCENES[id];
      if (!n) break;
      if (n.endingTitle) { title = n.endingTitle; break; }
      id = n.next || (n.choices && n.choices[0] && n.choices[0].next);
      hops += 1;
    }
  }
  document.getElementById('ending-title').textContent = title || 'The season turns';
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
document.getElementById('btn-back-evening').addEventListener('click', () => showScreen('evening'));

showScreen('title');

// Exposed for manual browser testing: GAME.state, GAME.save(), GAME.load().
window.GAME = { get state() { return state; }, save: saveGame, load: loadGame };
