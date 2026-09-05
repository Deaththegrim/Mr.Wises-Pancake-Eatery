# Mr. Wise's Pancake Eatery

A chill 2D browser shop sim set in the **God Synthia** world. You run a
pancake shop, chase a weekly sales quota, research new pancakes and syrups,
and a tired goddess keeps showing up.

No timers. No game over. Pressure comes from a number you want to hit,
never from a clock.

**Synthia is not ours.** She's the collaborator's character, and this is a
spin-off of `god-synthia`. All writing follows the voice guide at
`god-synthia/research/voice-style-guide.md`; the sprites come from that
project. Everything currently in `js/data/scenes.js` is placeholder written
to be replaced — the voice belongs to her author, not to us.

The title is set in `js/data/meta.js` and nothing else hardcodes it, so
renaming the game is one line.

## If you've just been handed this

Five commands, in this order. None of them need anything installed beyond
Node and Python, and none of them can break the game.

    python3 -m http.server 8000     # then open localhost:8000 and play a week
    node tools/writing.js           # every line of prose, and when it is seen
    node tools/art.js               # every picture, where it goes, what it shows
    node tools/audio.js             # every sound, and whether it is a recipe or a recording
    node --test tests/              # proves nothing is broken before you start

And with the server running, **localhost:8000/preview.html** — a workbench
showing every art slot (the real file if you have drawn one, what it needs
if not), every scene playable on its own so you can read an ending without
playing eight weeks to reach it, and every sound playable on its own.

Then **[CONTENT.md](CONTENT.md)**, which is the whole guide to changing
things: a pancake, a customer, a syrup, a research node, one of her scenes.
Everything editable is a plain list in `js/data/` and you never need to open
the engine.

The three worklists never fail — they are not tests. They print what is
left to write, to draw and to record, and all three are designed so you can
do it a line, a picture or a sound at a time, in any order, and see the
result on the next reload.

## Run it

No build step. No dependencies. No `npm install`.

    python3 -m http.server 8000

Then open http://localhost:8000

## Check everything works

    node --test tests/         # 309 unit tests (incl. balance + motion regressions)
    node tools/validate.js     # content integrity
    node tools/simulate.js     # is the game actually balanced? (8 weeks, fast)
    python3 tools/smoke.py     # plays the game in a headless browser
    python3 tools/playthrough.py 1   # plays the REAL page for N weeks (slow)
    node tools/art.js          # what art is needed, and what is already in
    node tools/audio.js        # every sound the game makes
    node tools/writing.js      # every line of prose, and when it is seen

`simulate.js` drives the engine directly, so it is fast enough to run a full
eight weeks — but it is only as correct as its imitation of `main.js`, and it
was once wrong in exactly the same way the UI was, which meant it reproduced a
bug instead of finding it. `playthrough.py` plays the actual page and
cross-checks the simulator. Run it after changing how a turn is driven.

The first three need nothing but Node 20. The smoke test needs Playwright,
which is a dev tool only — the game itself has zero dependencies.

## Adding content

**See [CONTENT.md](CONTENT.md).** Everything editable lives in `js/data/`,
and every file is a plain list you can copy a row from. You never need to
open the engine.

## How it's put together

    js/data/     content. Recipes, syrups, research, customers, scenes,
                 and things to buy for the room.
                 Data only - no functions, no imports.
    js/engine/   the rules. Pure logic, never touches the page,
                 so it unit-tests in Node with no toolchain.
    js/ui/       the screens. DOM only - no rules live here.
    css/         all colour, including the canvas's - ui/griddle.js reads
                 the cook-surface tokens off the root element at mount
    tools/       validate.js, simulate.js, smoke.py, playthrough.py,
                 art.js, audio.js, writing.js
    tests/       one file per engine module

Three of those boundaries are enforced by tests rather than good
intentions: `js/engine/` fails the suite if it references `document` or
`window`, `js/data/` fails if it declares a function, and every tuning
constant must be read by something the player actually runs — a number
only a tool reads is a feature the game does not have, which is how the
shipped build once awarded no research points at all while every balance
test passed. They're what keeps the content layer safe to hand to someone
who doesn't write JavaScript.

## The idea

The loop is four beats — **pour, flip, stack, drizzle** — each scored, with
per-recipe weights so a souffle lives on the flip and a tall stack lives on
alignment. At the drizzle you choose which syrup to pour, and a syrup that
suits the customer pays more; a mismatch is only ordinary, never a penalty.

Dishes are priced from their parts and billed like a till receipt — so many
pancakes at the going rate, a line per ingredient, a line for the skill the
dish takes, then quality, syrup and tip. You never set a price; you choose
what goes in, which is what makes an unlocked recipe visibly worth more.

What the money is *for*, once the research tree runs out, is the shop
itself: window boxes, a second table, an awning people wait under when it
rains. All of it cosmetic, deliberately — it never touches reputation.
Nobody needs the window boxes. That is the point of them.

Stack error compounds, so an off-centre first pancake leans the whole tower
— though a steady hand can nurse it back.

The weekly quota isn't a survival threshold, it's the **story metronome**.
Hit it and the next beat opens; miss it and you get a softer Synthia scene
and nothing is lost.

Research is a **grind on purpose**. Ingredients cost money from the till and
the experiment bench burns them whether or not the blend works, so the shop's
profits are what fund discovery. For the first few weeks you are broke because
everything you earn goes back into the bench.

And the thing the whole design hangs on: **the grind is the courtship.**
Her voice guide says *"And most don't stay."* A player who keeps opening
the shop, week after week, is the answer to that. So the repetitive loop
every other shop sim treats as a chore is here the relationship itself.

## Where it's up to

Phase 1 is done, and then some: every system the design doc describes is
built and tested. The four beats on canvas, the economy and its itemised
bill, the research tree and the experiment bench, the syrup a dish is
finished with, Synthia's weekly visits and the dishes she asks for that you
cannot make yet, five endings chosen by how well you listened, save/load,
and the shop you spend the money on once the tree runs out.

**What's left is writing and art**, and both are set up to be dropped in
rather than built.

Sound and motion are already there. The game ships no audio files and is
not silent: every noise it makes is a recipe the browser performs, listed
by `node tools/audio.js`. A real recording can replace any of them — drop
the file at the path shown, run that tool so it lands in the manifest, then
reload. The motion is the restrained kind the design research calls for: a
pancake settling, a bill adding up, nothing that shakes or repeats, and a
`prefers-reduced-motion` block over all of it.

The shop around her has had a proper pass — the eleven customers, the
seven things you can buy for the room, the dish and syrup names — so there
is a furnished place to write her into. Rewrite any of it freely.

Every line in `js/data/scenes.js`, though, is still a placeholder, and
deliberately so — the systems for the arc exist, the voice does not, and
that is the collaborator's.
`node tools/writing.js synthia` prints every line of it with, for each one,
when the player sees it: which week, what they have just done, what her
face is doing. It can be worked through without opening any code. It counts
the words for you at the end, so this file does not carry a number that
goes stale the moment anyone writes a sentence.

For art, `node tools/art.js` prints every picture the game can use: where
the file goes, what size, what it has to show, and which placeholder it
replaces. Put a file at the path and it is in the game on the next reload —
no code change and no build step. Delete it and the placeholder comes back.
Nothing needs to be drawn in any particular order, or at all.

Design docs live in `docs/superpowers/`, and the genre research they argue
from is in `research/genre-loops.md`.
