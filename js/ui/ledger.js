import { quotaForWeek } from '../engine/economy.js';
import { customersToday } from '../engine/day.js';

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
