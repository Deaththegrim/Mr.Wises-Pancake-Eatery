/* Balance simulator. Run: node tools/simulate.js
   Plays a full 8-week game headlessly with a competent player and prints
   the week-by-week outcome.

   Use this whenever you change the quota curve, payouts, research costs,
   or affection grants. Unit tests prove the rules are correct; this shows
   you whether the GAME works — whether quotas are reachable, whether the
   research tree opens up at a sensible pace, and how far the Synthia arc
   gets for a normal player.

   Read the "met" column. Early weeks should be YES comfortably, the middle
   should be tight, and the end should demand a fully unlocked shop.

   IMPORTANT — THIS MUST MIRROR WHAT main.js ACTUALLY DOES.

   An earlier version of this file called serve() without ever passing
   `forSynthia`, exactly like the (broken) UI did at the time. It therefore
   REPRODUCED the bug instead of revealing it: Synthia never counted as a
   customer, the listening beat never fired, and this simulation faithfully
   reported her stuck at REGULAR — a symptom that was easy to read past.

   A simulator that shares the UI's blind spots is worse than none, because
   it manufactures confidence. If you change how main.js drives a turn,
   change it here in the same commit. `tools/playthrough.py` is the check on
   THIS file: it plays the real page and should agree. */

import { newGame } from '../js/engine/state.js';
import { makeRng } from '../js/engine/rng.js';
import { openDay, closeDay, serve, nextCustomer, customersToday } from '../js/engine/day.js';
import { mentionSceneFor } from '../js/engine/story.js';
import { bestSyrupFor } from '../js/engine/syrup.js';
import { noteMention } from '../js/engine/affection.js';
import { SCENES } from '../js/data/scenes.js';
import { availableNodes, purchase, experiment } from '../js/engine/research.js';
import { buyIngredient, priceOf } from '../js/engine/pantry.js';
import { INGREDIENTS } from '../js/data/ingredients.js';
import { quotaForWeek } from '../js/engine/economy.js';
import { tierFor } from '../js/engine/affection.js';
import { RECIPES } from '../js/data/recipes.js';
import { TUNING } from '../js/data/economy.js';

// Customers per day now comes from reputation (engine/day.js customersToday).
const WEEKS = 8;

/* Two player profiles, so the curve can be tuned against both ends.
   `competent` is imperfect: slightly over-poured, a little late on the
   flip, first pancake marginally off-centre. `skilled` plays cleanly.

   Tune so competent misses the last week or two (a Synthia scene, not a
   failure) and skilled clears everything. */
/* Measured scores, so these labels mean something:

     recipe      sloppy  careful
     plain          80     100
     souffle        35     100
     impossible     69      99

   Note that "careful" and "flawless" score the same. That is deliberate,
   not a bug — the timing windows are generous on purpose ("oil", not
   "juice"), so modest care reads as mastery. The skill gradient lives in
   RECIPE DIFFICULTY instead: the souffle's tight band punishes sloppiness
   four times harder than a plain stack does. If you want a dish to demand
   precision, tighten its pour.band and flip.windowMs — do not make the
   scoring curves harsher globally, or the game stops being chill. */
const PROFILES = {
  sloppy:  { pourOff: 16, msOffset: 1100, firstOffset: 7,
             coverage: [0.9, 0.3, 0.8, 0.2, 0.95, 0.4] },
  careful: { pourOff: 4, msOffset: 250, firstOffset: 1.5,
             coverage: [0.68, 0.72, 0.65, 0.75, 0.7, 0.66] }
};

function execution(recipeId, profile) {
  const r = RECIPES.find(x => x.id === recipeId);
  const p = PROFILES[profile];
  return {
    volume: r.pour.target + p.pourOff,
    msOffset: p.msOffset,
    offsets: new Array(r.stackCount).fill(0).map((_, i) => (i === 0 ? p.firstOffset : -0.5)),
    coverage: p.coverage
  };
}

/* An experimenting player: each evening, buys a few ingredients out of the
   till and burns them at the bench. This is now the main money sink, so the
   simulation has to model it or the economy numbers are fiction. */
function experimentTonight(state, rng) {
  let spent = 0, tries = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const combo = [];
    for (let k = 0; k < 2 + (attempt % 2); k++) {
      const ing = INGREDIENTS[Math.floor(rng() * INGREDIENTS.length)];
      const r = buyIngredient(state, ing.id, 1);
      if (!r.ok) return { spent, tries };
      spent += r.spent;
      combo.push(ing.id);
    }
    /* experiment() credits the points to the state itself (research.js
       awards on both a find and a miss) and returns the number only so the
       UI can report it. Adding it here paid the bench twice and made this
       simulator model a game roughly a third richer than the one that
       ships — which is precisely what this file's header warns about, and
       the QUOTA_CURVE was calibrated from its output. ui/tree.js has the
       matching comment and gets it right. */
    const res = experiment(state, combo);
    tries += 1;
  }
  return { spent, tries };
}

function buyEverythingAffordable(state) {
  let bought = true;
  while (bought) {
    bought = false;
    for (const n of availableNodes(state).sort((a, b) => a.cost - b.cost)) {
      if (purchase(state, n.id).ok) { bought = true; break; }
    }
  }
}

/* `deaf` models a player who cooks exactly as well as `careful` but never
   acts on what she says: anything she has mentioned is kept OFF the menu.
   It exists to prove the listening beat is load-bearing. Without it, the
   careful/sloppy gap only measures cooking accuracy, and the arc could
   silently go back to being a function of luck without any test noticing. */
export function simulate(seed = 2026, profile = 'careful') {
  const deaf = profile === 'deaf';
  if (deaf) profile = 'careful';
  const s = newGame(seed);
  const rows = [];
  for (let w = 1; w <= WEEKS; w++) {
    const quota = quotaForWeek(w);
    let weekBenchSpend = 0;
    for (let d = 0; d < 7; d++) {
      openDay(s);
      s.menu = deaf
        ? s.unlockedRecipes.filter(id => !s.synthia.mentions.includes(id))
        : [...s.unlockedRecipes];
      if (s.menu.length === 0) s.menu = [...s.unlockedRecipes];   // never stall the shop
      const todays = customersToday(s);
      for (let i = 0; i < todays; i++) {
        const order = nextCustomer(s);
        if (!order) break;

        // Mirror main.js nextOrder(): when SHE is the customer, a mention
        // fires first, and the serve is flagged so affection accrues.
        if (order.isSynthia && !s.flags[`mentioned_w${s.week}`]) {
          const mention = mentionSceneFor(s);
          if (mention) {
            s.flags[`mentioned_w${s.week}`] = true;
            noteMention(s.synthia, SCENES[mention].mentions);
          }
        }

        // Points are awarded inside serve() now. This file used to award
        // them itself, which is exactly how it came to be simulating a
        // different — and much easier — game than the one that shipped.
        /* Mirror cookFor(): the player picks a syrup at the drizzle beat.
           A careful player pours the one that suits the customer; a sloppy
           one grabs whatever is first on the shelf. If this ever stops
           matching what main.js does, the balance numbers describe a game
           nobody is playing — which has happened here twice already. */
        const taste = order.customer && order.customer.taste;
        const syrupId = profile === 'careful'
          ? bestSyrupFor(s.unlockedSyrups, taste)
          : (s.unlockedSyrups[0] || null);

        serve(s, order.recipeId, execution(order.recipeId, profile),
              { forSynthia: !!order.isSynthia, syrupId, taste });
      }
      const benchRng = makeRng(s.seed + s.week * 77 + s.day);
      const bench = experimentTonight(s, benchRng);
      weekBenchSpend += bench.spent;
      const earned = s.weekEarnings;
      const r = closeDay(s);
      if (r.weekRolled) {
        buyEverythingAffordable(s);
        rows.push({
          week: w, quota, earned, met: r.weekResult.met, money: s.money,
          points: s.points, recipes: s.unlockedRecipes.length,
          purchased: [...s.purchased], tier: tierFor(s.synthia.points),
          affection: s.synthia.points,
          benchSpend: weekBenchSpend, syrups: s.unlockedSyrups.length
        });
      }
    }
  }
  rows.state = s;   // exposed so tests can audit WHERE affection came from
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const profile of ['sloppy', 'careful']) {
    const rows = simulate(2026, profile);
    console.log(`\n=== ${profile.toUpperCase()} player, serving everyone, buying all affordable research ===\n`);
    console.log('week |  quota |  earned | met | money | bench | pts | recipes | syrups | tier');
    console.log('-----+--------+---------+-----+-------+-------+-----+---------+--------+----------');
    for (const r of rows) {
      console.log(
        String(r.week).padStart(4) + ' |' + String(r.quota).padStart(7) + ' |' +
        String(r.earned).padStart(8) + ' |' + (r.met ? ' YES' : '  no').padStart(4) + ' |' +
        String(r.money).padStart(6) + ' |' +
        String(r.benchSpend).padStart(6) + ' |' +
        String(r.points).padStart(4) + ' |' +
        String(r.recipes).padStart(8) + ' |' +
        String(r.syrups).padStart(7) + ' | ' + r.tier);
    }
    const missed = rows.filter(r => !r.met).map(r => r.week);
    console.log(`Met ${rows.length - missed.length}/${rows.length} quotas.` +
      (missed.length ? ` Missed: week ${missed.join(', ')}` : ''));
  }
}
