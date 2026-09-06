/* The writing checklist. Run: node tools/writing.js

   Every line of prose in the game, where it lives, and when the player
   sees it — so it can be worked through without opening any code, and in
   any order.

   HER scenes are placeholder, written to be thrown away — the systems
   are finished and her voice is the only thing left that can make this
   feel like anything, and it is not ours to write.

   The shop around her has had a pass: the customers, the room, the
   names. That is furniture, not character, and it is here to be
   rewritten too — just not left blank while waiting.

   Nothing here fails. It is a worklist.

     node tools/writing.js            everything
     node tools/writing.js synthia    just her scenes
     node tools/writing.js customers  just the shop
*/

import { SCENES, IMPOSSIBLE_ORDER_LINES } from '../js/data/scenes.js';
import { CUSTOMERS } from '../js/data/customers.js';
import { DECOR } from '../js/data/decor.js';
import { RECIPES } from '../js/data/recipes.js';
import { SYRUPS } from '../js/data/syrups.js';
import { TIER_ORDER, TIER_THRESHOLDS } from '../js/data/affection.js';
import { QUOTA_CURVE } from '../js/data/economy.js';
import { MISS_SCENES } from '../js/engine/story.js';

const only = (process.argv[2] || '').toLowerCase();
const wants = section => !only || only === section;
const words = s => String(s || '').trim().split(/\s+/).filter(Boolean).length;

const rule = title => console.log(`\n${title}\n${'-'.repeat(title.length)}`);

/* Which scenes are reachable from where, so a writer knows what the
   player has just done when a line lands. Worked out from the data
   rather than listed by hand, so it cannot fall out of step. */
const entryPoints = {
  visit_first: 'the first week ends — her first visit',
  quota_met: 'a week ends with the target hit',
  noticed: 'you serve her something she once mentioned (the payoff)',
  ...Object.fromEntries(Object.entries(SCENES)
    .filter(([, n]) => n.mentions)
    .map(([id, n]) => [id, `she mentions ${n.mentions} in passing`])),
  ...Object.fromEntries(Object.entries(SCENES)
    .filter(([, n]) => n.visit && !n.mentions)
    .map(([id]) => [id, 'she visits with nothing left to mention (weeks 6-8)'])),
  ...Object.fromEntries(MISS_SCENES.map((id, i) => [
    id,
    i === MISS_SCENES.length - 1
      ? `a week ends under the target for the ${i + 1}${i ? 'rd' : 'st'} time or more`
      : `a week ends under the target — ${i === 0 ? 'the first time' : 'the second time'}`
  ])),
  ...Object.fromEntries(TIER_ORDER.map(t => [
    `ending_${t.toLowerCase()}`,
    `the last week ends with her at ${t} (${TIER_THRESHOLDS[t]}+ points)`
  ]))
};

let total = 0;

if (wants('synthia')) {
  rule('SYNTHIA — js/data/scenes.js');
  console.log('Her character, and the collaborator\'s to write. The systems around');
  console.log('her are finished: what she mentions, the payoff weeks later when you');
  console.log('serve it back, the five endings chosen by how well you listened.\n');

  const reachable = new Set(Object.keys(entryPoints));
  for (const [, node] of Object.entries(SCENES)) {
    if (node.next) reachable.add(node.next);
    for (const c of node.choices || []) if (c.next) reachable.add(c.next);
  }

  for (const [id, node] of Object.entries(SCENES)) {
    const when = entryPoints[id];
    console.log(`  ${id}${node.endingTitle ? `   [ending: "${node.endingTitle}"]` : ''}`);
    if (when) console.log(`    when: ${when}`);
    else if (!reachable.has(id)) console.log('    when: NOTHING REACHES THIS - orphaned');
    else console.log('    when: continues from another node');
    if (node.expr) console.log(`    her face: ${node.expr}`);
    if (node.choices) console.log(`    the player answers: ${node.choices.map(c => `"${c.text}"`).join(' / ')}`);
    console.log(`    ${words(node.text)} words\n`);
    total += words(node.text);
  }

  /* THE GAP, REPORTED. Every other empty slot in this project announces
     itself — tools/art.js prints what is still a placeholder, tools/audio.js
     prints what is still a recipe. A scene that has not been written cannot
     be listed above, because it is not there, so without this the one place
     the writing is most needed is the one place the worklist is silent.

     The numbers are derived, not typed: mentions counted from the data,
     weeks from the quota curve. */
  rule('THE WEEKS WITH NOTHING IN THEM — js/data/scenes.js');
  const mentions = Object.values(SCENES).filter(n => n.mentions).length;
  const visits = Object.values(SCENES).filter(n => n.visit && !n.mentions).length;
  const weeks = QUOTA_CURVE.length;
  const quiet = Math.max(0, weeks - mentions - visits);

  console.log(`She visits once a week for ${weeks} weeks. ${mentions} of those visits`);
  console.log(`have something for her to say (a mention), and ${visits} are visit scenes.`);
  if (quiet > 0) {
    console.log(`\n  ${quiet} WEEK(S) HAVE NOTHING. She walks in and says nothing at all.\n`);
    console.log('  They are the LAST weeks, and they are the ones the player is most');
    console.log('  invested in: the research tree finishes, the shop finally becomes');
    console.log('  affordable, and her closest tier is crossed — while she has gone quiet.');
    console.log('');
    console.log('  A mention cannot fill them: it has to name a dish the player has not');
    console.log('  researched yet, and by then there are none left. Use a visit scene —');
    console.log('  `visit: true`, no `mentions` — which is her talking without setting a');
    console.log('  goal. See CONTENT.md, and research/run-length.md for the measurement.');
    console.log('');
    console.log('  THIS IS THE MOST USEFUL WRITING LEFT TO DO.');
  } else {
    console.log('\n  Every week she visits has something for her to say.');
  }
  console.log('');

  rule('WHEN SHE ASKS FOR SOMETHING YOU CANNOT MAKE — js/data/scenes.js');
  console.log('One is picked at random. She is unbothered; the dish is named separately.\n');
  IMPOSSIBLE_ORDER_LINES.forEach((l, i) => {
    console.log(`  ${i + 1}. ${l.replace(/\n\n/g, '  /  ')}`);
    total += words(l);
  });
  console.log('');
}

if (wants('customers')) {
  rule('THE SHOP — js/data/customers.js');
  console.log('Three lines each: what they ask for, and what they say about what');
  console.log('they got. The reaction is printed on their receipt, so write them as');
  console.log('things a person says rather than as labels.\n');
  /* In the order the player meets them, not the order the file happens
     to list them in — the roster loosens up and then goes formal again as
     it climbs, and that is only legible read in sequence. Week-gated
     faces come before reputation-gated ones because week 1 arrives before
     any reputation does. */
  const meetsAt = c => (c.unlockAt || {}).reputation ?? -1;
  const roster = [...CUSTOMERS].sort((a, b) =>
    meetsAt(a) - meetsAt(b) || ((a.unlockAt || {}).week || 1) - ((b.unlockAt || {}).week || 1));

  for (const c of roster) {
    const u = c.unlockAt || {};
    const when = u.reputation ? `at ${u.reputation} reputation` : `from week ${u.week || 1}`;
    console.log(`  ${c.name}  (${when}, wants ${(c.wants || []).join('/')})`);
    console.log(`    asks:   "${c.lines.greeting}"`);
    console.log(`    happy:  "${c.lines.happy}"`);
    console.log(`    not:    "${c.lines.disappointed}"\n`);
    total += words(c.lines.greeting) + words(c.lines.happy) + words(c.lines.disappointed);
  }

  rule('THE ROOM — js/data/decor.js');
  console.log('One line each: the reason somebody would want the thing, not a');
  console.log('description of it.\n');
  for (const d of DECOR) {
    console.log(`  ${d.name.padEnd(18)} ${d.cost.toString().padStart(5)}   "${d.note}"`);
    total += words(d.note);
  }

  rule('NAMES — js/data/recipes.js, js/data/syrups.js');
  console.log(`  ${RECIPES.length} dishes:  ${RECIPES.map(r => r.name).join(', ')}`);
  console.log(`  ${SYRUPS.length} syrups:  ${SYRUPS.map(s => s.name).join(', ')}`);
  console.log('');
}

console.log(`\n~${total} words of prose in total.`);
console.log('Everything above is a plain string in js/data/. Rewrite freely — the');
console.log('game reads whatever is there. `node tools/validate.js` checks the shape');
console.log('(nothing dangling, nothing unreachable) but never the words.\n');
