import { quotaForWeek } from '../engine/economy.js';
import { customersToday } from '../engine/day.js';
import { el, clear } from './screens.js';

export function renderQuotaBoard(state) {
  const quota = quotaForWeek(state.week);
  const pct = Math.min(100, Math.round((state.weekEarnings / quota) * 100));
  document.getElementById('hud-day').textContent = `week ${state.week} · day ${state.day}`;
  document.getElementById('hud-money').textContent = `till ${state.money}`;
  document.getElementById('hud-rep').textContent = `rep ${state.reputation.toFixed(0)}`;
  document.getElementById('hud-quota').textContent = `quota ${state.weekEarnings}/${quota} (${pct}%)`;
}

/* On a week rollover, closeDay() has already advanced state.week and reset
   weekEarnings — so reading `state` here would report the NEW week's empty
   progress the instant you finish one, and would silently disagree with the
   HUD. Report the week that just ENDED from dayResult.weekResult, then show
   the new target separately. */
export function renderLedger(state, dayResult) {
  const rolled = dayResult.weekRolled && dayResult.weekResult;
  const shownWeek = rolled ? dayResult.weekResult.week : state.week;
  const earned = rolled ? dayResult.weekResult.earned : state.weekEarnings;
  const quota = rolled ? dayResult.weekResult.quota : quotaForWeek(state.week);
  const pct = Math.min(100, Math.round((earned / quota) * 100));
  const met = earned >= quota;

  const nextRow = rolled
    ? `<div class="score-row"><span>Week ${state.week} target</span><span>${quotaForWeek(state.week)}</span></div>`
    : '';

  document.getElementById('ledger').innerHTML = `
    <div class="card">
      <div class="score-row"><span>Today</span><span>${dayResult.dayEarnings}</span></div>
      <div class="score-row"><span>Week ${shownWeek}${rolled ? ' (finished)' : ''}</span><span>${earned} / ${quota}</span></div>
      <div class="quota-bar"><div class="quota-fill${met ? ' met' : ''}" style="width:${pct}%"></div></div>
      ${nextRow}
      <div class="score-row"><span>In the till</span><span>${state.money}</span></div>
      <div class="score-row"><span>Reputation</span><span>${state.reputation.toFixed(1)}</span></div>
      <div class="score-row"><span>Expected tomorrow</span><span>${customersToday(state)} customers</span></div>
      <div class="score-row"><span>Research points</span><span>${state.points}</span></div>
    </div>`;
}

/* THE TILL. The itemised bill for the dish just served.

   Prices are built from parts — so many pancakes at the going rate, a line
   per ingredient, a line for the skill the dish takes — and this is where
   the player reads it. The lines come from engine/economy.js billFor(),
   the same call that produced the money, so the receipt cannot disagree
   with the till.

   It stays up until the next dish is served. A bill that flashes past in a
   notice is not a bill. */
export function renderReceipt(recipe, result, customer, said) {
  const mount = clear(document.getElementById('receipt'));
  if (!result || !result.bill) return;

  const card = el('div', { className: 'card receipt' });
  card.append(el('div', { className: 'receipt-head', text: `${recipe.name} — ${customer}` }));
  /* What they said about it, on the bill itself rather than in a floating
     notice — the notice was a second copy of these numbers laid over the
     top of the first, and it hid the bottom of the receipt. */
  if (said) card.append(el('div', { className: 'receipt-said', text: `“${said}”` }));

  const row = (label, amount, cls = '') => {
    const r = el('div', { className: `receipt-row ${cls}`.trim() });
    r.append(el('span', { className: 'receipt-label', text: label }));
    r.append(el('span', { className: 'receipt-amount', text: amount }));
    return r;
  };

  for (const line of result.bill.lines) {
    const sign = line.amount < 0 ? '−' : line.adjustment ? '+' : '';
    const label = line.detail ? `${line.label} ${line.detail}` : line.label;
    card.append(row(label, `${sign}${Math.abs(line.amount)}`,
                    line.adjustment ? (line.amount < 0 ? 'down' : 'up') : ''));
  }
  if (result.tip) card.append(row('tip', `+${result.tip}`, 'up'));

  card.append(row('total', String(result.payout + result.tip), 'total'));

  // What it cost to make. The margin is a real decision and the player
  // cannot make it if only one side of it is ever shown.
  const cost = result.ingredientCost + result.emergencyCost;
  if (cost) {
    card.append(row(result.emergencyCost ? 'stock (emergency prices)' : 'stock', `−${cost}`, 'down'));
    card.append(row('kept', String(result.payout + result.tip - cost), 'total kept'));
  }
  mount.append(card);
}

export function clearReceipt() {
  clear(document.getElementById('receipt'));
}
