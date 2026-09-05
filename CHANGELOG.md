# Changelog

## 2026-09-06 — the second review pass

Ran the rest of the reviewer panel — comment accuracy, silent failures, a
UI audit — over the audio and motion work. It found substantially more than
the first pass, including a bug in code predating this session.

### Fixed — things that were broken

- **A recording that 404s or will not decode was swallowed.** Record a
  file, run the tool, reload, hear the recipe, conclude it worked. Nothing
  anywhere said otherwise: `arrayBuffer()` accepts an HTML error body
  happily and `decodeAudioData` then rejects into an empty catch. Now the
  response is checked and every failure warns.
- **`start()` could leave a hiss nothing could stop.** It built its voices
  with `.map` and registered them afterwards, so a throw part-way through
  left the earlier layers started, connected, looping, and *absent from the
  map `stop()` reads* — unstoppable for the rest of the session, with the
  cause swallowed. It registers as it builds now. Both held slots have one
  layer today, so it was one data edit from shipping.
- **`stop()` de-registered before releasing**, so a throw on the first
  voice stranded the rest unreachable. And `release()` read
  `ctx.currentTime` outside its own try, so that throw escaped into the
  caller's catch — after the entry had already been removed.
- **`voice()` and `envelope()` each had a copy of the attack formula.**
  They agreed on every shipped row and diverged on `attack: 0`, which the
  schema explicitly permits. One home now, with a test.
- **The two held slots declared `ms`/`attack`/`release` that nothing
  reads** — the same declared-but-unread bug as `release`, one level down,
  sitting directly under the comment about having fixed that class. The
  envelope test filters `!sustain`, so it structurally could not see them.
- **A failed mute *write* silently un-muted the game at every reload,
  forever.** The rule about storage covered only the read side.
- **`unlock()` was click-only**, so keyboard-only players built the audio
  context inside their first beat — the exact case it exists to prevent.
  The pour beat is keyboard-operable on purpose.
- **Four exports had no try/catch while a test asserted every export did.**
  `setMuted` was the sharp one: it assigns `muted` before touching the
  audio graph, so a throw skipped the caller's re-render and left the
  button's label asserting the opposite of the state already committed.
- **`aria-pressed` was inverted** — a button reading "Sound: off"
  announced as *pressed*. The dimming is keyed to a class now, because
  styling off the ARIA state is what let the two get out of step.
- **The preview's hold-to-play buttons were mouse-only**, which is the
  exact bug the pour beat carries a comment about having fixed once.
- **The receipt stagger was off by two.** `:nth-child` counts the dish name
  and the customer's line as well, so the first money row started a third
  of the way through the sequence and everything past the fourth collapsed
  onto one delay. Indexed from the rows themselves now.
- **A bug older than this session:** in the research bench,
  `refreshChosen` was assigned *inside* the "Try it" handler, so until the
  player's first experiment every "use" click hit a no-op stub and the
  summary kept reading "nothing selected" with ingredients staged — which
  is precisely the bug the comment above it says was fixed.

### Fixed — touch, and the teardown

Finishing the silent-failure list rather than stopping at the findings that
were easy to reach.

- **A cancelled touch broke the pour beat.** `touchcancel` is not
  `touchend` — a system gesture, an incoming call, or the browser deciding
  a touch was really a scroll fires it instead, and the window-level
  `mouseup` that rescues the mouse path never fires for touch. The pour's
  `stop()` does three things: silences the sound, clears the 30ms interval,
  and advances the beat. Without it the batter kept pouring while nobody
  was touching the screen, the measured volume climbed past any target, and
  **the beat never advanced**. That is a corrupted measurement and a stuck
  order, not a stray noise. Both held beats handle it now, with a test —
  nothing else can see this, since the unit tests have no DOM and the smoke
  test drives a mouse.
- **`touches[0].clientX` was unguarded** in the drizzle's move handler.
  The list is empty on the event that ends a gesture, and that throws
  inside a listener, where nothing catches it.
- **The teardown ran the sound stop last.** It was pushed onto a stack that
  drains LIFO, so it went after the frame loop and the listener removal —
  either of which throwing would skip it *and* unwind out of `mountGriddle`
  before `clear(mount)`, leaving the player on the service screen with a
  customer, no cook surface, and a sound still running. It runs first now,
  and each teardown step is guarded separately.
- **A comment credited the wrong line with a guarantee.** The griddle's
  teardown claimed to be what stops the batter hissing when a player
  abandons mid-pour. It is not — it runs when the *next* dish mounts, an
  evening and a morning later. `main.js` stops held sounds on leaving
  service, and that is what covers it. Deleting that line would have looked
  safe and silently restored the bug the griddle comment described.
- **`askImpossible` discarded the griddle outside the teardown protocol.**
  Nothing leaks today, because the previous order always finished through
  the drizzle's Done handler — but "safe because of what the last screen
  happened to do" is not a property worth resting on.

### Added — touch coverage, because there was none

The pour bug above was found by *reading* the code. Every check in the
smoke test drives a mouse, so a game that is fully touch-operable had no
touch coverage at all — which is exactly how that bug lived in it.

There is now a touch section: a real touch-enabled context, a real
`touchstart`, and a `touchcancel` dispatched the way a phone does when the
system takes a gesture over. It asserts the pour actually starts (otherwise
everything after it passes by never running), then that the beat advances
and the readout stops.

Verified against the bug itself: removing the `touchcancel` handler leaves
the stage stuck on `pour` with the readout still ticking, and both checks
fail.

**And it immediately exposed a flake in the section above it.** Counting
the checks across runs gave 115, 104, 115 — the reduced-motion and touch
sections were being skipped entirely about one run in five, on a Playwright
timeout against a hidden `#customer-card`. Cause: her visit rolls forward
if she was not served, so a scene can be waiting after almost any "Open the
shop" — the exact trap this file documents and keeps a `clear_scenes()`
helper for. The touch section used it; the reduced-motion section, written
minutes earlier, did not. Six consecutive runs at 115 now.

A flaky gate is worse than a missing one: it cries wolf and then gets
ignored, which this project already learned once when an unpinned seed made
smoke play a different game every run.

### Fixed — comments that were wrong

This is its own category on purpose. A wrong comment in this codebase is
worse than no comment: they cite specific past bugs as justification, so
they get inherited as fact.

- **The disproved `animation: none` claim survived in `motion.test.js`**
  after being corrected in the CSS — and the test is where a maintainer
  actually reads it, because it is attached to the assertion message.
- **Three comments claimed the smoke test asserts a clean console.** It
  collected `error` only, so every `console.warn` — this project's whole
  channel for a fault the player cannot see — sailed straight past. Rather
  than water the comments down, **smoke.py now fails on warnings too**,
  which makes the claim true and gives the new audio diagnostics somewhere
  to land. Verified by planting one.
- The zero-pitch guard's stated mechanism was wrong (the `RangeError` is
  synchronous, and a clamp three lines away already prevents it).
- **The "module scope" AudioContext guard did not check module scope.** It
  sliced to the first `export`, which in that file lands after four
  function bodies — so it would have flagged correct lazy construction and
  missed a genuine module-scope assignment.
- `localStorage` does not throw in modern private browsing; the real cases
  are blocked site data and legacy quota errors.
- The suspended-context branch is about autoplay, not tab backgrounding —
  and construction never called `resume()`, which is now fixed.
- `attack` is floored at 5ms, silently overriding 14 of 23 declared values
  while the docs said "0.01 is a click".
- `sounds.js` claimed drop-and-reload parity with the art. Audio has no
  probing fallback, so running the tool is mandatory, not a convenience.
- Plus an unvalidated `filterHz` (where `|| 1000` rewrites a `0`), an
  invented "ramps out of order" mechanism, "a hang, not a failure" when
  Playwright's stability wait is bounded, and an unverified codec claim.

## 2026-09-06 — the reviewer panel, and what it found

Ran the full reviewer panel over the audio and motion work, plus `uid lint`
over the UI. Three real defects, all now fixed and mutation-tested.

### Fixed

- **`release` did nothing.** Every sound layer declares a `release`,
  documented as "fade-out, as a fraction of ms", and it only ever delayed
  when the node stopped — it never touched the gain. The fade was always
  whatever `ms - attack` happened to be, so a documented, per-layer,
  tunable knob was **inaudible**. That is this project's signature bug
  class (a declared value nothing reads), and it hid where the anti-drift
  rule could not see it: in a browser-only file the suite never imported.

  The envelope is now pure arithmetic behind an exported `envelope(layer)`,
  so the timing is unit-tested in Node: attack, hold, release, adding up to
  exactly `ms`, clamped so the parts can never overlap or go negative. A
  test asserts a larger `release` produces a longer fade — reverting to the
  old behaviour fails it. (An earlier draft of this entry justified the
  clamp by claiming a negative part would schedule the ramps out of order
  and mute the layer. It would not: the Web Audio timeline sorts automation
  events by time however they are scheduled. The clamp is for the
  arithmetic's sake — a negative part is a lie about the shape, in a number
  other code reads.)

  *The reviewer that found this misdiagnosed it,* reporting an abrupt
  cutoff. There was no cutoff: an exponential ramp interpolates from the
  previous scheduled point, so the sound did fade. It just faded over the
  wrong span, and by a number the author could not control.

  **How much this changes what you hear today: very little, and that is
  worth saying plainly.** Every shipped layer happens to use a high release
  (0.7–0.9), and the broken code faded over `ms - attack` — around 95–99%
  of the sound — so the two land close together. The fix is not audible
  drama; it is that the control exists. `release: 0.2` on a 400 ms sound
  now produces an 80 ms fade where it previously produced a 380 ms one no
  matter what was typed, so the next person to tune a sound gets the sound
  they asked for.

- **The sound guards were blind to double quotes.** The call-scanner
  matched `'single'` only, so `play("flipp")` — a typo, silent forever,
  throwing nothing — would have sailed through the one test that exists to
  catch exactly that. Now matches both quote styles and template literals.

- **A tautology.** "At least one sound is played" passed on the two *held*
  sounds alone, because `start`/`stop` match the same pattern — so the
  entire one-shot path could have been unwired with the test still green.
  Now requires several one-shots specifically.

- **Computed ids are refused outright.** A sound played through a variable
  or a ternary is invisible to every guard here, which already cost us once
  this session. A test now finds and names them.

- **The motion test would have failed correct CSS.** Vendor prefixes and
  the standalone `translate`/`scale`/`rotate` properties were treated as
  layout-movers. They are compositor properties like `transform` and are
  now allowed — a gate that cries wolf is a gate that gets switched off.
  Verified the guard still bites on a real layout property.

- **The reduced-motion check sampled one element.** Now sweeps every
  animated, on-screen element — and does it again after cooking a full
  order, where the pancakes and the receipt's rows put **eight** animated
  elements on screen instead of one. It reuses `playthrough.py`'s
  `cook_one()` rather than hand-rolling a second beat-driver, because a
  second copy would drift from the real one — which is precisely how
  `simulate.js` once reproduced a bug instead of finding it.

- **A WCAG 2.4.7 blocker in the sound toggle** (`uid lint`). The shared
  `button:focus-visible` outline did apply, so focus was visible — but
  hover brightened the label and keyboard focus did not, leaving keyboard
  users with less affordance on the one control that sits outside every
  screen, and one drawn deliberately quiet.

### Verified

`playthrough.py` re-run because the beat handlers changed, and this
project's rule is that the real-page/simulator cross-check runs whenever
how a turn is driven changes: 103 dishes over 7 days, three distinct
affection sources, simulator agrees.

## 2026-09-06 — motion, in the restrained kind

### Added

- **Juice, of the sort the design research actually calls for** — medium,
  not none. I had first written this off as working against the cozy
  pillar, which was the wrong call: the research says *medium juice beats
  extreme juice*, and the game had exactly one transition in three hundred
  and fifty lines of CSS.

  Motion now appears only where something was previously instant and
  therefore invisible: a pancake **settles** onto the stack instead of
  appearing, the receipt's rows **arrive in order** so the itemised bill is
  actually read rather than skipped, a customer card and a line of her
  dialogue rise into place, and buttons give under the press. No shake, no
  particles, nothing that repeats — a shop you visit for eight weeks must
  not twitch at you.

- **`prefers-reduced-motion`, blanketing the whole stylesheet** rather than
  listing rules one at a time, so an animation added later is covered on
  the day it lands instead of the day somebody remembers.

### Two rules, enforced by tests rather than by intention

- **Animations touch only `transform` and `opacity`.** The stack beat
  scores a leaning tower and the drizzle beat samples syrup coverage across
  that same tower — so where the pancakes *are* is gameplay, not
  decoration. Animate a margin or a height and the tower on screen stops
  being the tower that was scored. `tests/motion.test.js` reads every
  `@keyframes` and fails on any layout property.
- **Nothing runs forever.** Beyond the design reason: an endless animation
  on an element holding a button means that button never settles, and a
  test harness waiting for it to hold still waits for good — a hang rather
  than a failure, which is much worse to diagnose.

All three guards were mutation-tested (a layout property, an infinite
animation, a deleted reduced-motion block); all three die.

### Fixed

- **A comment of mine that taught something false.** I had written that
  `animation: none` in the reduced-motion block "could leave a pancake
  permanently translucent". Mutating the stylesheet to prove it showed the
  opposite: nothing here carries a static `opacity: 0`, so `none` is
  harmless today. The real difference is that a zero-length animation still
  *runs* — it fills and it fires `animationend` — where `none` does
  neither, so the first animation whose completion something waits on would
  silently never complete, for reduced-motion users only. The comment now
  says that instead. Shipping a plausible-sounding wrong reason is how the
  next person inherits it as fact.

- The reduced-motion smoke check was written against that same wrong
  failure mode. Re-aimed at the one that can actually happen — a static
  hidden start plus a lost fill-mode — and verified by planting exactly
  that mistake and watching the check fail.

## 2026-09-06 — sound, with no sound files

### Added

- **The game has audio, and ships none.** Every noise is a recipe in
  `js/data/sounds.js` that the browser performs with Web Audio — so sound
  works on a fresh clone with nothing to download, no library, and no build
  step. That was the whole design constraint: this project's promise is
  that it still runs in five years from a `git clone` and a static server,
  and a folder of MP3s is the easiest way to break that.

  Fifteen slots: the four beats (pour and drizzle are *held* — they run
  while the button is down, because those beats are press-and-hold), the
  counter (a bell, a plate, a till), the bench and the board, and the
  opening and closing of the day.

  **A real recording still wins.** Drop a file at a slot's `path`, run
  `node tools/audio.js`, reload — it is used instead of the recipe, and
  deleting it brings the recipe back. Identical to how a PNG replaces an
  art placeholder, and for the same reason: the work can be done in any
  order, by anyone, one sound at a time.

- **A mute toggle in the HUD**, persisted. It reports the state it is *in*
  ("Sound: off") rather than the state it would move to — "Turn sound on"
  beside a silent game reads as a label for the silence.

- **`node tools/audio.js`** — the checklist, and it writes the manifest the
  game loads from, so the console stays clean instead of reporting fifteen
  missing files on every load. Same workflow as the art tool.

- **A Sound tab in `preview.html`** — every sound played on its own,
  through the real layer. Held sounds are hold-to-play, which is the only
  way to judge whether a pour loops cleanly.

### Design notes worth keeping

- **The house style is quiet.** Gains sit between 0.03 and 0.12, and the
  sound for *failing* at the bench is gentler than the one for succeeding,
  not louder — a cozy game with no fail state should not own a buzzer. The
  validator warns above 0.3.
- **Her bell is not everyone's bell**: lower, slower, longer. It is the
  only place the sound layer knows who walked in, and it costs one branch.
- **The stack sound bends upward per pancake**, so a seven-high tower
  audibly builds instead of repeating one thud.
- **`flip_clean` reads the same window `engine/cook.js` scores against**, so
  the sound cannot congratulate a flip the scorer marked down.
- **Juice beyond sound was deliberately not built.** The design research
  says medium juice beats extreme juice for a cozy game, and the beats
  already animate. Screen-shake in a shop you visit for eight weeks works
  against the pillar.

### Fixed

- **The reachability test caught a real gap on its first run.** The
  customer bell was written as one call with a ternary
  (`play(x ? 'a' : 'b')`), so neither id was greppable and the guard could
  not vouch for either. Rewritten as two literal calls. The guard was left
  alone — this project's rule is to fix the code, not the gate.

- **The preview workbench had no test at all**, despite being a handoff
  deliverable that imports the real art, scene and sound layers — a broken
  import would have blanked it, and the person who found out would have
  been the collaborator opening it for the first time. Now covered by
  smoke.py. Its art 404s are *by design* (the game uses a manifest to avoid
  them; the workbench must ask for every slot to show which are empty), so
  the check ignores failed resource loads and fails on JavaScript faults.

- **A latent crash in `smoke.py`** — `query_selector(...).click()` on a
  possibly-missing button would have raised an AttributeError and killed
  the run, reporting nothing after it, which reads as a broken harness
  rather than a broken game.

- README drift the audio work exposed: "Four commands" listed five, "the
  two worklists" was three, and the test count said 290.

## 2026-09-06 — the background cast gets a voice

### Changed

- **The eleven customers now sound like eleven people.** They were all
  written in one register — flat, clipped, no contractions — which is
  Synthia's. A background cast speaking the protagonist's voice makes it
  nobody's. The early roster now talks loosely: *"Still warm. You're a
  saint."*, *"I'll be hungry again by the bridge."*, *"They must've meant
  somewhere else."* The last three — the Stranger, the Pilgrim, the Devout
  — keep the formal register, so it now reads as **the mark of someone
  touched by something** rather than as house style, and Synthia's voice
  stays hers.

  Night Shift's disappointed line was literally `"Hm."` — hers, from
  `visit_first_end`. Replaced, and the reason is noted in the file so it
  does not come back.

  **Not touched: a single line of Synthia's.** Those remain the
  collaborator's, as agreed.

- **Two research nodes were named after their own dishes.** All thirteen
  nodes name a *skill* — Citrus Work, Practised Eye, Steady Hands, Working
  With Ash — except the two late ones, which were called *The Impossible
  Stack* and *The Quiet Stack*. That put the same words twice on one screen
  and told the player nothing about what they were learning. Now **The
  Seventh Layer** (it is the dish that stands seven high) and **Working In
  Silence**, which rhymes with *Working With Ash* directly upstream of it.
  The convention is written down in `CONTENT.md` so the next node added
  follows it. Ingredient names were reviewed and left alone — Flour through
  Bottled Starlight and Quiet Milk is already a clean ordinary-to-uncanny
  gradient.

- **Two names.** `Souffle Pancake` → **Soufflé Stack** (accent restored;
  it now joins the Stack family it belongs to), and `Void Syrup` →
  **Starless** — the one abstract name in a list of concrete ones
  (Plum Lacquer, Ash Glaze, Ember Reduction, Nightmilk), and it is brewed
  from starlight. The research node followed the dish: **Soufflé Method**.

- **One decoration note.** The corner lamp's *"Warm, and low, and on all
  day."* read as a list; it is now *"Low, and warm, and on all day. Even
  when the sun is out."* — which is the small extravagance that is the
  actual reason to want it. The other six were already doing their job and
  were left alone.

### Fixed

- **The smoke test was asserting the copy, not the wiring.** It checked
  for the literal `"Souffle"` in the page, so renaming a dish in
  `js/data/` failed a check about whether *her ask is wired to the
  research board* — the one thing it exists to watch. It now reads both
  names out of `RECIPES` and `RESEARCH` at run time, which is a stronger
  assertion than the literal was: the ask must name **whatever the data
  says the dish is called**.

- **The writing checklist listed the roster in file order**, so The Critic
  (40 reputation) printed after The Stranger (180). It now prints in the
  order the player meets them — which is the order the escalation is
  written in, and unreadable in any other.

- **The handoff docs were teaching the mistake.** `CONTENT.md`'s worked
  example for adding a customer used `happy: 'Hm. Better than mine.'` —
  handing the collaborator Synthia's own tic as the model line for a
  market trader. The example now speaks in the roster's register, and the
  convention is written down beside it, explicitly as something to break
  on purpose rather than by accident.

  `README.md` and `tools/writing.js` both claimed *everything* was
  placeholder. That is still exactly true of `scenes.js` and now false of
  the shop, and the difference is the whole point — the collaborator
  should be able to tell at a glance which prose is waiting for them and
  which is only furniture they may rewrite. Both now say which is which.
  The three `Souffle` spellings in `CONTENT.md` follow the dish.

## 2026-09-06 — the shop, and somewhere to put the art

### Added

- **Art slots.** Every picture the game can use is declared in
  `js/data/art.js` with its path, its size, what it has to show and which
  placeholder it replaces. **None of it needs to exist** — each slot draws a
  placeholder until a file appears, and picks it up on the next reload. No
  code change, no registration, no build step; delete the file and the
  placeholder comes back. `node tools/art.js` prints the checklist and
  writes the manifest the game loads from, so the console stays clean
  instead of reporting eleven missing files on every load.

  Eleven slots wired so far: the pancake in the pan, the same pancake
  overcooked, a pancake seen edge-on as one layer of a stack, the griddle,
  and one for each of the seven things you can buy for the room. Synthia's
  29 existing sprites were already in and are untouched.

- **A writing checklist**, `node tools/writing.js` — every line of prose in
  the game with, for each one, when the player sees it: which week, what
  they have just done, what her face is doing, what they can say back. All
  of it can be worked through without opening any code, in any order.
- **`preview.html`** — a workbench for both jobs. Every art slot side by
  side, showing the real file where one exists and what it needs where it
  does not; and every scene playable on its own, with her sprite and the
  expression that scene calls for, so an ending can be read without playing
  eight weeks to reach it. Separate from the game and touches no save.
- **A front door in the README** for whoever picks this up: four commands
  that orient you, then CONTENT.md for everything else.

- **Decoration** — seven things to buy for the room: window boxes, a second
  table, a repainted sign, a corner lamp, a shelf of jars, the good griddle,
  an awning people wait under when it rains. Bought with money, kept forever,
  and **purely cosmetic** — a test buys every item and asserts reputation,
  research points and affection are all unchanged, and the smoke test asserts
  the same through the real page. Reputation already means exactly two things
  (which customers turn up, and how many); a third input would make it two
  systems wearing one name.

  Brought forward from Phase 2 because the hole it fills was measured: a
  careful player finished the research tree before the last weeks, and the
  till then climbed to about 21,000 with nothing to spend it on. The last two
  weeks had no economic decision left in them. A careful run now ends holding
  about 1,900 having bought five or six of the seven, so there is always
  something left to want and no run clears the shop.

### Fixed

- **One of the five endings could never be reached.** Showing up grants two
  points a week and cannot be declined, so a finished game always carried at
  least 16 — putting the floor above the lowest tier entirely. Five endings
  were authored and the collaborator would have been writing one nobody could
  see. The tiers were retuned so the floor lands in the bottom band, and a
  test now walks the real grant economy and asserts every tier is reachable.
- **The evening screen lied about the till after a trip to Research.** "Back"
  was nothing but a screen switch, so after spending at the bench the header
  said 200, the ledger four lines below said 3,000, and the shop offered a
  lamp at 2,600 with a live button. Buying it was safe — the purchase re-reads
  the money and refuses — but that refusal was the only sign the panel had
  been lying.
- **A save holding a string where a list belongs killed Continue.** It threw
  out of `deserialize`, which nothing catches, so the player clicked and
  nothing happened at all: no notice, no screen change. Hand-edited duplicates
  are now dropped too.
- **Every purchase dropped keyboard focus to the page body**, so a keyboard
  player lost their place on each buy and a second Enter went nowhere.

---

## 2026-09-05 (later) — syrups, listening, and the bill

### Added

- **Syrups do something.** They were inert: no runtime code read a syrup's
  axes and the drizzle beat did not know which one it was pouring, so half of
  what the research tree awards paid out in nothing. Customers now have a
  taste on the same four axes; you pick a syrup at the drizzle beat and a good
  match pays more and builds reputation faster. **A mismatch is never a
  penalty** — a discovery must only ever be a new option, never a new way to
  lose money. The customer's taste is never printed: you learn it from the
  result on the bill and from their greetings.
- **Dishes are priced from their parts, and billed like a till receipt** — so
  many pancakes at the going rate, a line per ingredient, a line for the skill
  the dish takes, then quality, the syrup with its verdict, and the tip. You
  never set a price; you choose what goes in, which is what finally makes an
  unlocked recipe visibly worth more. The receipt also shows what the stock
  cost and what was kept, so a dish cooked on emergency stock reads "total 23
  / stock −40 / kept −17" instead of quietly losing money.
- **Impossible orders** — she asks for a dish you have not unlocked, is
  deadpan about it, and the research board marks that node "She asked for
  this." The ask rides alongside her real order and never replaces it.
- **Customers react** — their happy and disappointed lines had been in the
  data since the roster was written and were rendered nowhere. They now speak
  at the top of their receipt.
- **She waits** — an unserved visit rolls to the next day the shop opens
  rather than evaporating. Closing early used to cost a week of the arc with
  nothing on screen saying she had been there.

### Fixed

- **The listening loop was gated on luck.** She ordered whatever was priciest,
  so a player who heard her mention a dish and spent weeks researching it had
  no way to serve it to her deliberately. She now asks for what she mentioned:
  the last tier went from 2 of 10 seeds to 10 of 10.
- **Every ending showed the same fallback title.** The walk that finds an
  ending's title never ran, so a devoted eight-week run and a stranger's were
  headed identically — and that title is the one thing on the card that tells
  them apart.
- **The receipt did not add up.** The total was rounded separately from its
  own lines, so one bill in eight printed a column that did not sum to its own
  total row. The money was always right; the arithmetic a player can do by eye
  was not.
- **An empty blend paid research points forever** — combining nothing, at no
  cost, indefinitely.
- **A stale base-ingredient setting would silently double-bill every dish** in
  the game, with a plausible extra line on the receipt. Now a validator error.
- **A hand-edited or stringified save made Continue a dead button**, the story
  screen could strand a player with no way out, the bench consumed ingredients
  before it could fail, and blocked browser storage was reported as "No save
  found."

### Changed

- The quota curve was retuned twice: up when syrup pairing added a real income
  lever, then down at the late weeks once the balance simulator stopped paying
  the research bench twice — every number it had been calibrated against
  described a game about a third richer than the one that ships.
- **Every colour, including the ones painted on canvas, is now a token.** The
  page drew a pancake one brown and the canvas drew the same pancake another.

### Tooling

- The balance simulator gained two profiles that exist to keep the tuning
  honest rather than to model play: one that cooks as well as a careful player
  but ignores everything Synthia mentions (proving the listening beat is
  load-bearing — two tiers of difference), and one that pours whatever the
  picker preselects, because a customer's taste is never printed and a
  first-time player does not have it.
- The smoke test was pinned to a fixed seed. It had been playing a different
  game every run, which is not a regression gate.
- Static guards for the class of bug that made 227 passing tests meaningless:
  every module must parse, no module may import the same name twice, every
  element id must exist in the page, and the canvas colour fallbacks must
  match the stylesheet.

### Known gaps

- **All dialogue in `js/data/scenes.js` is placeholder**, written to be
  replaced. The systems for the arc all exist — what she mentions, the payoff
  when you serve it back weeks later, the five endings chosen by tier, the
  dishes she asks for that you cannot make yet. The voice does not, and it is
  not ours to write: Synthia is the collaborator's character.
- **Food, the griddle, the room and its seven decorations are procedural
  shapes and labelled outlines**, not art. Legible and consistent, and
  placeholders. Each decoration already names the sprite that will replace it,
  and swapping them in changes one function.
- Audio and juice are untouched.

Nothing else in the design document is unbuilt.

---

## Phase 1 — 2026-09-05

The whole game loop, end to end, with placeholder art and thin content.
Playable from the title screen through eight weeks.

### Added

- **The making loop** — four scored beats: pour, flip, stack, drizzle. Each
  recipe weights them differently, so a souffle lives on the flip and a tall
  stack lives on alignment. Stack error compounds: an off-centre first
  pancake leans the whole tower, though a steady hand can nurse it back.
- **The day** — morning menu, service, evening ledger. No clock, no action
  budget. Close when you like.
- **The quota** — escalating weekly target that gates *story*, not survival.
  Hit it and the next beat opens; miss it and a softer Synthia scene fires
  and nothing is lost. There is no Game Over anywhere in this game.
- **Reputation** — rises with quality, never falls, buys nothing. It unlocks
  customers and makes the shop busier, and it shifts demand upmarket.
- **Research** — a visible tree with prerequisites and cook-gates, plus an
  experiment bench. Upgrades buy away *error*, never power, so the game gets
  calmer as it goes.
- **The pantry** — ingredients cost money from the till and the bench burns
  them whether or not the blend works. The shop's profits fund discovery.
- **Synthia's arc** — five hidden tiers, never shown as a number. Her default
  expression and how long she lingers change as it deepens. It can stall; it
  can never fall.
- **The listening mechanic** — she mentions something in passing; research and
  serve it weeks later, unprompted, and she notices. Reaching the last tier is
  impossible without it.
- **Save/load** — tolerant by design. Stale content is dropped with a warning
  rather than breaking the file, and the player is never stranded with nothing
  to cook.
- **Content layer** — everything editable lives in `js/data/`, enforced by
  tests: `js/engine/` fails the suite if it touches the DOM, `js/data/` fails
  if it declares a function.
- **Tooling** — `tools/validate.js` (content integrity), `tools/simulate.js`
  (8-week balance simulation, two skill profiles), `tools/smoke.py`
  (Playwright, plays the game headlessly). 161 unit tests, including 12
  balance regression tests that run the full simulation.
- `CONTENT.md`, written for someone who does not read JavaScript.

### Fixed during the build

These were found by tooling, not by review, and every one would have shipped:

- **Income never scaled.** Weekly earnings sat flat at ~2,800 while the quota
  climbed 2.2x per week, making 5 of 8 quotas unreachable by any amount of
  effort. Reputation's "raises customer traffic" half had never been built.
- **Money had no sink.** An 8-week playthrough ended with ~62,000 in the till
  and nothing to spend it on, so the escalating quota was pressure with no
  purpose. Fixed by the pantry.
- **Salted Caramel was permanently undiscoverable.** The bench averages its
  ingredients, so a target more intense than any blend can reach is
  unreachable forever. It is now found via butter + maple + salt flake, which
  is how you actually make salted caramel.
- **The Impossible Stack could never be ordered.** Tagged `divine`; no
  customer wanted `divine`. The most valuable dish in the game was dead
  revenue.
- **The affection arc was unreachable.** DEVOTED sat at 90 points when the
  maximum achievable was 64.
- **Bench hints vanished instantly** — the bench's own refresh callback
  destroyed the hint element it had just written.
- Unlabelled money in the HUD; a stale score readout sitting over Synthia's
  first appearance; sprites rendering as cropped rectangles (they are not
  transparent cutouts); a 2,200px research screen that buried the bench under
  fourteen stock rows; syrup drawn too faintly to see.

### Changed

- **Pour and drizzle moved to `<canvas>`.** Drizzle now renders the actual
  stack you built, at its real offsets, on a plate — you pour syrup onto the
  food you made. The DOM version was six flat rectangles that read as an
  equaliser and discarded the plate entirely. `engine/cook.js` was untouched;
  only the module that *measures* changed.

### Added later the same day

- **Cost of goods.** Cooking now consumes ingredients. Stock is bought in
  units and held in servings — one unit is a bulk quantity that makes ten
  pancakes, while the bench burns a whole unit per experiment. That gap is
  load-bearing: it keeps discovery expensive while cooking stays profitable.
  Running out never cancels a sale; you buy emergency stock at double price,
  so bad restocking costs margin rather than revenue, and a broke player is
  never locked out of earning.
- **Content depth** — 9 recipes (was 4), 11 customers (was 4), 13 research
  nodes (was 6), 9 syrups with 8 discoverable (was 4/3), 14 ingredients
  (was 9). Two new branches in the tree: a cheap early *bright* line and an
  expensive *strange* line with high margins.
- **Research costs rescaled.** The tree totalled 178 points against ~1,100
  earned, so six of thirteen nodes were bought in week 1 and it was
  exhausted by week 4 — points then piled up with nothing to buy, the same
  "no sink" bug the money economy had. It now totals ~1,130 and completes
  in week 8 for a careful player; a sloppy one reaches 4 of 13.
- Recalibrated the quota curve twice for the new content and pacing. The
  late weeks are near-misses on both sides: week 6 cleared by 266, week 7
  missed by 688, week 8 by 239.
- **12 balance regression tests** (`tests/balance.test.js`) that run the
  8-week simulation and assert the *shape* of the game — income compounds,
  the tree is not bought out early, discovery continues, money does not
  hoard, every recipe is profitable. The simulator found three separate
  "this resource has no sink" bugs; these make it impossible for a fourth
  to ship silently.

### Fixed on review

- **The HUD and the ledger contradicted each other after a week rollover.**
  `closeDay()` advances the week and resets earnings, so the ledger reported
  the new week's empty progress ("0 / 900") while the header still showed the
  old week's ("20 / 300"). The ledger now reports the week that just *ended*
  and shows the new target separately, and the HUD refreshes after the roll.
  Found by looking at a screenshot, not by any test — so the smoke test now
  asserts the two agree.

- **The morning screen was giving bad advice.** It read "a narrow menu of
  your best work earns more than a wide one", which stopped being true once
  there were nine recipes — the demand system already steers customers
  upmarket, so restricting the menu just turns people away. Rewritten to say
  narrow helps early and breadth pays later.
- **The morning screen now reports stock readiness and offers a restock
  button.** Cooking consumes ingredients, so "can I get through today?" is a
  real question; it previously told you the price without giving you any way
  to act on it, sending you hunting through the research screen.
- Checkboxes were rendering as default browser blue against a violet palette.

- **The flip beat moved to canvas too.** It had been left in DOM on the
  assumption that "the timing readout communicates clearly" — it did not. It
  rendered as a row of `o` characters, and it had a gameplay hole the scoring
  hid: the bubbles only accumulated, so there was no peak to flip *on*. They
  now rise, peak, and pop at the ideal moment, and the pancake darkens as it
  overcooks. All four beats are now visual and consistent.

- **The game now ends.** It previously ran forever — after 70 days you were
  in week 11 against a quota of 27,523 with no conclusion, despite the spec
  specifying an ending at the end of week 8. The last authored week now
  closes the story, and **which ending you get is chosen by how close Synthia
  became**: five endings, one per affection tier. The devoted one is titled
  "Most Do Not Stay", after the line in her own voice guide. An ending card
  reports the shape of the run — weeks, pancakes, syrups, and where she
  ended up — rather than a score, because there is nothing to win.
- **Missing the quota no longer repeats the same line.** A struggling player
  can miss six weeks running and was hearing one identical scene every time,
  which turns a kind mechanic into a broken record. Three scenes now escalate
  over the first three misses and then hold: she barely reacts, then she
  notices, then she sits down.

- **Synthia now actually comes into the shop.** She previously appeared only
  in scenes at week boundaries and was never a customer you could cook for —
  which meant `serve(..., {forSynthia:true})` was never called by anything.
  The whole affection chain was dead in the real game: her mentions were
  never recorded, serving her never counted, and **the listening beat — the
  best idea in the design, and the thing reaching DEVOTED depends on — could
  never fire.** She was permanently stuck at REGULAR. She now visits once a
  week on a varying day, says something in passing, and waits at the counter
  until served.
- Five mention scenes (was two), so the arc has headroom to reach its last
  tier rather than topping out just short.

- **`tools/playthrough.py`** — plays the real page in a browser for N in-game
  weeks and cross-checks `simulate.js` against it. The simulator drives the
  engine directly, which is fast but only as correct as its imitation of
  `main.js` — and it was once wrong in precisely the way the UI was, so it
  *reproduced* the Synthia bug rather than exposing it, reporting her stuck at
  REGULAR for eight weeks. Its load-bearing assertion is that affection must
  accrue from more than one source; in the broken build the only grant reason
  was "you kept the shop open".

### Known gaps at the end of Phase 1

- All dialogue in `js/data/scenes.js` is placeholder written to be replaced.
- Food, griddle and shop furniture are procedural canvas shapes, not art.
  They are legible and consistent, but they are placeholders.

*(Both still true. See the current gaps at the top of this file — several
other things listed here as built turned out to be built incorrectly, and
are recorded in the entries above.)*
