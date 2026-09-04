# Mr. Wise's Pancake Eatery

A chill 2D browser shop sim set in the **God Synthia** world. You run a
pancake shop, chase a weekly sales quota, research new pancakes and syrups,
and a tired goddess keeps showing up.

No timers. No game over. Pressure comes from a number you want to hit,
never from a clock.

**Synthia is not ours.** She's the collaborator's character, and this is a
spin-off of [`god-synthia`](../god-synthia). All writing follows the voice
guide at `../god-synthia/research/voice-style-guide.md`. The sprites come
from that project. The game still needs a name — that's the collaborator's
call.

## Run it

No build step. No dependencies. No `npm install`.

    python3 -m http.server 8000

Then open http://localhost:8000

## Check everything works

    node --test tests/        # 121 unit tests over the rules
    node tools/validate.js    # content integrity
    node tools/simulate.js    # is the game actually balanced?
    python3 tools/smoke.py    # plays the game in a headless browser

The first three need nothing but Node 20. The smoke test needs Playwright,
which is a dev tool only — the game itself has zero dependencies.

## Adding content

**See [CONTENT.md](CONTENT.md).** Everything editable lives in `js/data/`,
and every file is a plain list you can copy a row from. You never need to
open the engine.

## How it's put together

    js/data/     content. Recipes, syrups, research, customers, scenes.
                 Data only - no functions, no imports.
    js/engine/   the rules. Pure logic, never touches the page,
                 so it unit-tests in Node with no toolchain.
    js/ui/       the screens. DOM only - no rules live here.
    tools/       validate.js, simulate.js, smoke.py
    tests/       one file per engine module

Two of those boundaries are enforced by tests rather than good intentions:
`js/engine/` fails the suite if it references `document` or `window`, and
`js/data/` fails if it declares a function. They're what keeps the content
layer safe to hand to someone who doesn't write JavaScript.

## The idea

The loop is four beats — **pour, flip, stack, drizzle** — each scored, with
per-recipe weights so a souffle lives on the flip and a tall stack lives on
alignment. Stack error compounds, so an off-centre first pancake leans the
whole tower (though a steady hand can nurse it back).

The weekly quota isn't a survival threshold, it's the **story metronome**.
Hit it and the next beat opens; miss it and you get a softer Synthia scene
and nothing is lost.

And the thing the whole design hangs on: **the grind is the courtship.**
Her voice guide says *"And most don't stay."* A player who keeps opening
the shop, week after week, is the answer to that. So the repetitive loop
every other shop sim treats as a chore is here the relationship itself.

## Where it's up to

Phase 1 is done: the whole game loop works end to end with placeholder art
and thin content.

Phase 2 is art, the real writing, shop decoration, audio, and polish.

Design docs live in `docs/superpowers/`, and the genre research they argue
from is in `research/genre-loops.md`.
