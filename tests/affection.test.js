import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierFor, expressionFor, poseFor, grant, noteMention, checkListening, grantWeekly, grantForServing } from '../js/engine/affection.js';
import { GRANTS, TIER_THRESHOLDS } from '../js/data/affection.js';

const fresh = () => ({ points: 0, mentions: [], noticed: [], log: [] });

test('tiers resolve by threshold', () => {
  assert.equal(tierFor(0), 'STRANGER');
  assert.equal(tierFor(TIER_THRESHOLDS.REGULAR), 'REGULAR');
  assert.equal(tierFor(TIER_THRESHOLDS.DEVOTED + 50), 'DEVOTED');
});

test('every tier maps to a real expression and pose key', () => {
  for (const p of [0, 12, 30, 55, 90]) {
    assert.equal(typeof expressionFor(p), 'string');
    assert.equal(typeof poseFor(p), 'string');
  }
});

test('affection can rise', () => {
  const s = fresh();
  grant(s, 5, 'test');
  assert.equal(s.points, 5);
});

test('affection can NEVER fall - negative grants are ignored', () => {
  const s = fresh();
  grant(s, 10, 'up');
  grant(s, -50, 'attempted punishment');
  assert.equal(s.points, 10, 'a negative grant must not reduce affection');
});

test('a zero grant is not logged as an event', () => {
  const s = fresh();
  grant(s, 0, 'nothing happened');
  assert.equal(s.log.length, 0);
});

test('grants are logged with a reason', () => {
  const s = fresh();
  grant(s, 3, 'served her something good');
  assert.equal(s.log.length, 1);
  assert.equal(s.log[0].reason, 'served her something good');
});

test('weekly persistence grants the showing-up bonus', () => {
  const s = fresh();
  grantWeekly(s);
  assert.equal(s.points, GRANTS.weeklyPersistence);
});

test('serving her better food grants more', () => {
  const a = fresh(), b = fresh();
  grantForServing(a, 100);
  grantForServing(b, 20);
  assert.ok(a.points > b.points);
  assert.ok(a.points <= GRANTS.qualityServedMax);
});

test('the listening mechanic: she notices a mentioned dish served later', () => {
  const s = fresh();
  noteMention(s, 'souffle');
  const r = checkListening(s, 'souffle');
  assert.equal(r.noticed, true);
  assert.equal(r.bonus, GRANTS.listening);
  assert.equal(s.points, GRANTS.listening);
});

test('a dish she never mentioned is not noticed', () => {
  const s = fresh();
  noteMention(s, 'souffle');
  assert.equal(checkListening(s, 'plain').noticed, false);
});

test('she only notices the same mention once', () => {
  const s = fresh();
  noteMention(s, 'souffle');
  checkListening(s, 'souffle');
  const second = checkListening(s, 'souffle');
  assert.equal(second.noticed, false, 'the beat must not repeat');
  assert.equal(s.points, GRANTS.listening, 'and must not pay twice');
});

test('noteMention does not duplicate a tag', () => {
  const s = fresh();
  noteMention(s, 'souffle');
  noteMention(s, 'souffle');
  assert.equal(s.mentions.length, 1);
});

test('the listening beat outweighs everything else per-event', () => {
  assert.ok(GRANTS.listening > GRANTS.weeklyPersistence);
  assert.ok(GRANTS.listening > GRANTS.qualityServedMax);
});

test('the arc is slow - weekly persistence alone cannot reach DEVOTED in 8 weeks', () => {
  const s = fresh();
  for (let w = 0; w < 8; w++) grantWeekly(s);
  assert.notEqual(tierFor(s.points), 'DEVOTED', 'showing up alone must not max the arc');
});

test('a dedicated player CAN reach DEVOTED in 8 weeks', () => {
  // 8 weeks of showing up, serving her well each week, some good dialogue
  // choices, and catching three of her mentions. The arc must be
  // achievable, not merely slow.
  const s = fresh();
  for (let w = 0; w < 8; w++) {
    grantWeekly(s);
    grantForServing(s, 95);
    grant(s, 2, 'a choice she liked');
  }
  for (const dish of ['souffle', 'impossible', 'buttermilk_stack']) {
    noteMention(s, dish); checkListening(s, dish);
  }
  assert.equal(tierFor(s.points), 'DEVOTED', `only reached ${tierFor(s.points)} at ${s.points} points`);
});

test('DEVOTED is unreachable WITHOUT the listening mechanic', () => {
  // The design contract: a player who cooks perfectly and picks every kind
  // dialogue option, but never notices what she mentions, tops out below
  // DEVOTED. Paying attention is mechanically necessary.
  const s = fresh();
  for (let w = 0; w < 8; w++) {
    grantWeekly(s);
    grantForServing(s, 100);
    grant(s, 2, 'a choice she liked');
  }
  assert.notEqual(tierFor(s.points), 'DEVOTED',
    `reached DEVOTED at ${s.points} points with no listening catches — the arc's best beat must be required`);
  assert.equal(tierFor(s.points), 'CONFIDANT');
});
