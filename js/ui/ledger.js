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

export function renderLedger(state, dayResult) {
  const quota = quotaForWeek(state.week);
  const pct = Math.min(100, Math.round((state.weekEarnings / quota) * 100));
  const met = state.weekEarnings >= quota;
  document.getElementById('ledger').innerHTML = `
    <div class="card">
      <div class="score-row"><span>Today</span><span>${dayResult.dayEarnings}</span></div>
      <div class="score-row"><span>This week</span><span>${state.weekEarnings} / ${quota}</span></div>
      <div class="quota-bar"><div class="quota-fill${met ? ' met' : ''}" style="width:${pct}%"></div></div>
      <div class="score-row"><span>In the till</span><span>${state.money}</span></div>
      <div class="score-row"><span>Reputation</span><span>${state.reputation.toFixed(1)}</span></div>
      <div class="score-row"><span>Expected tomorrow</span><span>${customersToday(state)} customers</span></div>
      <div class="score-row"><span>Research points</span><span>${state.points}</span></div>
    </div>`;
}
