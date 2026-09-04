# Genre research — chill shop sim with a making loop

**Date:** 2026-09-05
**Question:** What structure should a 2D pancake-shop sim use, given it must be
(a) chill like *ReStory*, (b) hands-on enough that the making has impact,
(c) grindy in an RPG sense — quotas + a research tree, and
(d) handed off to a non-engine collaborator once the bones exist?

Status: **research complete, design not yet approved.** Nothing here is a decision;
it is the evidence the design will be argued from.

---

## 1. ReStory: Chill Electronics Repairs — the tone reference

Mandragora / tinyBuild, released 6 Aug 2026. Windows + macOS. Overwhelmingly
Positive (~95% of 4,577 reviews at time of search), Metacritic 84, ~700k
pre-launch wishlists, peaked >16,000 concurrent.

**Structure**
- Inherit a repair shop in mid-2000s Tokyo after its owner disappears.
- Day loop: receive a to-do list → tidy the workspace (drag items to their place
  or the bin) → pull the lever to open the shop → first customer arrives.
- Every repair follows one fixed pattern, beginning with diagnosing the fault
  using the multimeter. Then disassemble, clean, solder, repaint, reassemble.
- Financial pressure is real and diegetic: the shop owes a yakuza clan protection
  money.
- Shop decoration bought online — shelves, lights, paint, display pieces.
- Progression systems the wiki lists: repair shop, decorations, furniture, tools,
  computer apps, the Akiba Championship, Home Depot, Marketplace, Parts
  (Packuten), Reviewme.not, Service Licenses.

**Narrative engine — the part that matters most to us**
- Locals dropping by the shop are *the* mechanism for advancing story.
- Characters **return across multiple visits**, disclosing their stories
  gradually.
- Choices accumulate into **relationship states**, which drive multiple endings
  — the district is either saved or becomes a corporate shopping centre.

**The criticism to design against**
Steam Deck HQ: it is easy to fall into a **repetitive cycle that shuts out much
of the device variety**. (Also flagged poor Steam Deck performance — irrelevant
to a browser build.)

> **Implication.** The returning-customer-with-an-unfolding-story engine is
> exactly "Synthia keeps showing up," and it is the single highest-value thing to
> copy. The repetition flaw is the thing to beat — and a research tree that gates
> progress behind *variety* is a structural fix, not a patch.

Sources:
https://store.steampowered.com/app/3812600/ReStory_Chill_Electronics_Repairs/
https://en.wikipedia.org/wiki/ReStory:_Chill_Electronics_Repairs
https://steamdeckhq.com/game-reviews/restory/
https://noisypixel.net/restory-mid-2000s-repair-sim-steam-2026/

---

## 2. Papa's Pancakeria — the interaction-weight reference

Flipline Studios, browser, 2D, literally pancakes. This is the closest existing
thing to the target in both medium and subject, and it sits at the interaction
granularity asked for: real beats with impact, no screw-level teardown.

**Stations**
| Station | What the player does |
|---|---|
| Order | Greet customers, take the ticket, manage wait time |
| Grill | Pour batter, add mix-ins, watch for bubbles, flip at the peak of the Flip Meter, pull when the Time Meter fills orange |
| Build | Stack the flapjacks, add toppings, drizzle syrup |
| Drink | Unlocks at Rank 15 — exists purely to add multitasking load |

**Scoring**
- Graded on build, grill, and how long customers waited. Tips scale with score.
- **Stack alignment compounds.** An off-centre first pancake makes the whole
  stack lean and cannot be corrected later. Small offsets cause visible overhang
  and quietly cost Build points.
- **Drizzle is scored on distribution** — steady pace, even coverage, no heavy
  pooling, no missed edges. Cited as one of the most overlooked factors in
  reaching a 100% Build score.
- Partial credit exists: a topping only partly on the plate can still score 100%.

**Progression**
- Consistent 90+ scores raise rank → unlock content → increase tips.
- **Upgrades reduce error rather than adding power**: Grill Alarms tell you when
  to flip or pull; the Automatic Butter Slicer produces even pieces, removing a
  source of placement error and stabilising Build scores.
- Between days, a mini-game show (Foodini) spends special tickets earned during
  the day on prizes.

> **Implication.** Four scored beats — pour, flip, stack, drizzle — is a proven
> granularity for exactly this subject in exactly this medium. The upgrade
> philosophy (buy away your error sources) is a clean way to make the grind feel
> like it compounds. The one thing to discard is Papa's core tension: multitasking
> against impatient customers. That clock is what makes it *not* chill.

Source: https://fliplinestudios.fandom.com/wiki/Papa's_Pancakeria

---

## 3. Recettear — the quota reference

The canonical shop-sim quota curve. Recette must repay her missing father's debt
in weekly instalments; the fairy Tear explicitly justifies the instalment
structure in-fiction ("paying it all at once is beyond your means") and warns
that payments will grow as the store builds steam.

| Week | Deadline | Payment |
|---|---|---|
| 1 | Day 8 | 10,000 pix |
| 2 | Day 15 | 30,000 |
| 3 | Day 22 | 80,000 |
| 4 | Day 29 | 200,000 |
| 5 | Day 36 | 500,000 |

Total 820,000 pix.

**What makes the curve work**
- **~2.5–3× escalation per week.** Outpaces linear growth, so week-1 tactics
  cannot simply be repeated harder — the player's *systems* (pricing, stock,
  merchant level, loot tier) must compound.
- **The final payment is ~61% of the entire debt.** Earlier weeks are effectively
  a tutorial ramp; the last week is the real test. Community guides report players
  typically start struggling around week 3.
- **Soft onboarding** — day 1 is tutorial, play formally starts day 2, giving a
  full 7 days before a trivially small first check.
- **Always visible.** The next payment date and amount sit on the calendar in the
  main menu, which is what makes each day's time-spend decisions feel weighted.
- **Reinvestment tension.** The wiki explicitly warns against over-buying shop
  customisations and being unable to make the payment. Shop expansions are also
  gated by merchant level (12, 20, 26).
- **Failure is soft but real** — miss a deadline and Recette sells the shop and
  lives in a cardboard box; restart keeps merchant level and items but loses pix.
  Capability persists, liquidity does not, so a failed run shortens the next.

**The part that does NOT transfer:** missing a payment is a **Game Over**. That
is squarely incompatible with the chill brief (see §5).

Sources:
https://recettear.fandom.com/wiki/New_Game_(Story_Mode)
https://en.wikipedia.org/wiki/Recettear:_An_Item_Shop's_Tale
https://steamcommunity.com/sharedfiles/filedetails/?id=373947243

---

## 4. Potion Craft — the discovery reference, mostly as a list of mistakes

Relevant because "research for unique pancakes and syrups" is a
discovery-through-experimentation system, and Potion Craft is the best-known
recent attempt.

**How it works:** discovery is spatial — move the potion into undiscovered parts
of a map by combining ingredients grown in your garden or bought from merchants.
Found recipes are logged persistently in a potion journal.

**What players complain about — all four are traps for us**
1. **Economic disincentive to experiment.** Basic herbs are precious and deep
   experimentation is prohibitively expensive, so the game "heavily discourages
   you from experimenting" — the exact opposite of the intent.
2. **No directional hints.** The game does not indicate which element lies where.
   Community fix proposed: an in-game lore book with fantasy descriptions plus
   keywords hinting at map direction.
3. **Out-of-order discovery.** Players stumble onto advanced results before basic
   ones; the fallback becomes farming herbs to brute-force the tree.
4. **Results are instantly legible.** You know a potion's effect the moment it
   exists. A proposed fix was a testing lab (water glasses, seeds, plants, mice)
   so identification is its own step.

**The generalised lesson**, from a related gamedev thread on randomised recipe
systems: if a game expects experimentation but only a small number of combinations
work, experimentation is discouraged. **The search space must be forgiving enough
— cheap inputs, legible feedback — that a failed experiment is still informative
rather than wasted.**

Sources:
https://steamcommunity.com/app/1210320/discussions/0/3108017414023210997
https://itch.io/t/2998637/randomized-potion-recipe-system-innovative-or-infuriating

---

## 5. Cozy design — how to keep stakes without punishment

The direct tension in this brief: the player asked for **sales quotas** (pressure)
in a game modelled on a **chill** sim (no pressure). The literature resolves it.

- Cozy games are defined partly by key omissions, starting with **no Game Over**,
  and rarely have time-sensitive objectives or hard progression lines.
- **Soft consequences, not absent ones.** Stardew is the model: crops fail if
  unwatered, you can be looted if you pass out — but there is no overarching timer,
  and the mine penalty is a few items plus waking up at home. Never a significant
  setback.
- **Self-authored goals** replace designer-imposed ones. Stardew's engagement comes
  from player-determined value systems; the tension punishment would supply is
  absent or greatly softened.
- **Progression can be signalled without scoring.** One team found responsive
  animation alone produced a satisfying sense of progression with no points at all.
- **Low punishment increases experimentation.** When failure isn't harsh, players
  take creative risks; steep punishment makes them avoid trying new things. This
  connects directly to §4 — the research tree only works if failing is cheap.
- **Heuristic:** the more demanding the game, the less punishing its fail state
  should be.
- **The failure mode to avoid** is a feedback loop of failure (the classic MMO
  corpse-run debuff spiral), where failing makes future failure more likely.
- **Caveat worth respecting:** for a stress-relief audience, any reintroduced
  tension risks reading as a betrayal of the cozy promise. Soft consequences,
  self-set goals, and animated progression feedback are safer levers than real loss.

Sources:
https://en.wikipedia.org/wiki/Cozy_game
https://www.gamedeveloper.com/design/the-balance-of-fail-states-in-game-design
https://medium.com/@nareshsoni1265/how-to-handle-failure-states-without-punishing-the-player-4e9d142c3029

---

## 6. Game feel — constraints on the making loop

- **Juice is not monotonic.** A large-scale study found medium and high juiciness
  outperformed *extreme* juiciness and *no* juiciness across player experience,
  intrinsic motivation, play time, and in-game performance.
- **Juice has a readability cost.** Effect-saturated interaction makes it hard to
  learn which parts of the interaction carry mechanical weight. Directly relevant:
  if progression hangs off a quality score, the player must be able to read *why*
  they scored what they did.
- **Order of operations:** real-time control responsiveness first, then a
  predictable simulated space, then juice amplifies. Not the reverse.
- **"Oil" vs "juice" (Swink).** Oil makes play smoother, juice makes it engaging.
  A forgiving flip window is *oil* — the same family as coyote time and input
  buffering. Both matter.
- Cheap, effective techniques named: coyote time, input buffering, hit-stop,
  squash and stretch, screen shake, particles, easing, sound. Squash-and-stretch
  on a score counter is a cheap way to sell the readout itself. Tested by playing,
  not by looking.

Sources:
https://thedesignlab.blog/2025/01/06/making-gameplay-irresistibly-satisfying-using-game-juice/
https://egmatic.com/blog/how-to-make-your-game-feel-good
https://arxiv.org/pdf/2011.09201

---

## 7. Synthesis — what the evidence points at

Not decisions. The design doc will argue these; they are recorded here so the
reasoning is traceable.

1. **Papa's hands, ReStory's pace.** Take Papa's Pancakeria's four scored beats
   (pour / flip / stack / drizzle) and its error-reducing upgrade philosophy.
   Discard its impatient-customer clock, which is the source of its tension and
   the opposite of the brief.

2. **Recettear's ratchet, without its Game Over.** The escalating weekly quota is
   the right *shape* — it forces profit to be converted into permanent capability
   rather than hoarded. §5 says the Game Over must go. The proposed substitute:
   **a missed quota is a Synthia scene, not a fail screen** — a soft consequence
   in Stardew's sense, which additionally routes the economy into the story engine
   instead of fighting it. This is the single most important open design question.

3. **The research tree is the answer to ReStory's worst review.** Gating progress
   behind variety structurally prevents the repetitive rut. But §4 is a warning
   list: experiment inputs must be cheap, hints must be directional, and a failed
   combination must return usable information ("too sharp — needs rounding out")
   rather than nothing.

4. **Legibility beats spectacle.** Medium juice, generous timing windows (oil),
   and a quality readout the player can actually reason about.

5. **The handoff constrains everything.** All content — recipes, syrups, research
   nodes, customers, Synthia's scenes — must be plain data rows editable without
   opening engine code. god-synthia already proves the pattern: `js/story.js` is
   marked DATA ONLY and holds all 691 lines of story while `engine.js` / `ui.js` /
   `main.js` hold none. If adding a syrup requires touching a function, the
   architecture has failed its primary requirement.

---

## 8. Confirmed reusable assets (verified on disk, 2026-09-05)

From `~/vault/projects/god-synthia/`:
- **Sprites:** 5 God Synthia expressions (neutral / happy / smug / angry /
  surprised) and 6 Demon Synthia (+ playful / adoring), each with its `.kra`
  Krita source — so new expressions are authorable, not locked.
- **Backgrounds:** `sanctum.jpg`, `arena.jpg`, `void.jpg`. A shop interior is new art.
- **Fonts, bundled offline:** Oswald, Inter, IBM Plex Mono, Cormorant Italic.
- **CSS:** 354 lines carrying both the dream (violet) and nightmare (red CRT) themes.
- **Engine:** 1,879 lines total across `engine.js` (489), `story.js` (691),
  `ui.js` (186), `main.js` (159) — small enough that the dialogue-box, typewriter,
  backlog, and save layers can be lifted rather than rewritten.

**Attribution:** Synthia is the collaborator's character; god-synthia was work done
with them. `research/voice-style-guide.md` in that repo exists specifically so new
writing is indistinguishable from theirs, and all new dialogue is held to it.

---

## 9. Open questions for the design doc

1. Quota failure — Synthia scene as the sole consequence, or is there a material
   sting as well? (§5 says keep any sting soft.)
2. Does the day have a time budget (Recettear-style action-limited days) or does
   the player serve until they choose to close? The latter is more chill; the
   former is what makes quota decisions weighty.
3. Research discovery: explicit tree with visible prerequisites, or Potion
   Craft-style exploration with directional hints? §4 leans toward the explicit
   tree with a discovery layer on top.
4. Does the griddle station need `<canvas>` for pour/drizzle feel, or is layered
   DOM enough? Resolve by prototype, not argument.
5. Working title. `pancake-shop` is a directory name, not a name.
