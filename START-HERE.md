# Start here

This is a small browser game where you run a pancake shop and Synthia keeps
coming in. It's finished mechanically. What it's missing is her voice and
its pictures, and both of those are yours.

You don't need to know how to code. Nothing in here asks you to.

---

## Run it (about thirty seconds)

Open a terminal in this folder and type:

    python3 -m http.server 8000

Then open http://localhost:8000 in a browser and play a week. Leave that
running while you work — every change you make shows up on a page refresh.
There's no build step, nothing to install, nothing to compile.

Stop it with Ctrl+C when you're done.

---

## What's already done

You run a shop. Customers come in and order; you make each pancake through
four steps — pour, flip, stack, drizzle — and each is scored. You get a
weekly sales target. Hitting it moves the story on; missing it costs you
nothing except a softer scene from her. There's no way to lose.

Money buys ingredients. Ingredients let you experiment at the bench and
discover new syrups. Research unlocks new dishes. Once the research runs
out, money goes on the shop itself — window boxes, a lamp, an awning.

Synthia visits once a week. Sometimes she mentions something in passing. If
you go and research that thing weeks later, unprompted, and serve it to
her, she notices — and that's worth more than anything else in the game.
How much she warms to you decides which of five endings you get.

All of that works. There are 9 dishes, 9 syrups, 11 customers, 13 research
steps, 14 ingredients and 7 things to buy for the room.

---

## What's yours

**Her voice.** She's your character. Everything she currently says is
placeholder — written deliberately badly so you'd throw it away rather than
feel obliged to keep it. 26 scenes, about 450 words. The machinery around
them is finished: what she mentions, the payoff weeks later, the five
endings picked by how well the player listened.

**The pictures.** 11 slots — pancakes, the griddle, and the seven things
you can buy for the shop. Every one currently draws a coloured shape. Her
own sprites are already in and working, from `god-synthia`.

You can also rewrite anything else you like. The customers, the dish names,
the shop's decorations — I wrote all of those, and they're furniture. They
were filled in so the place wouldn't feel empty while you're working, not
because they're settled.

---

## The three lists that tell you what's left

Each of these prints a worklist and then stops. **None of them can fail,
and none of them can break the game.** Run them any time.

    node tools/writing.js       every line of words, and when a player sees it
    node tools/art.js           every picture, where the file goes, what it shows
    node tools/audio.js         every sound

`node tools/writing.js synthia` narrows it to just her.

The writing one is the most useful. For every scene it tells you *when* the
player sees it — which week, what they've just done, what her face is
doing — so you can write any line without reading a word of code.

---

## The one thing worth doing first

Run `node tools/writing.js synthia` and look at the section headed **"The
weeks with nothing in them."**

She visits eight times, and only five of those visits have anything for her
to say. Weeks 6, 7 and 8 she walks in and says nothing at all — and those
are the weeks a player is most invested, because that's when the research
finishes, the shop finally becomes affordable, and she's at her warmest.

Three short scenes fill that. It's the biggest single improvement available
and it's about ten minutes of writing. `CONTENT.md` shows the exact shape,
and `research/run-length.md` has the measurements if you want to see why.

---

## Where everything lives

Everything you'd want to change is a plain list in `js/data/`. Each file is
one kind of thing, and you can copy a row and edit it.

    js/data/scenes.js       ← HER. Everything she says.
    js/data/customers.js    the other eleven regulars, three lines each
    js/data/recipes.js      the nine dishes
    js/data/syrups.js       the nine syrups
    js/data/ingredients.js  what things cost
    js/data/research.js     the research board
    js/data/decor.js        things to buy for the shop
    js/data/sounds.js       every noise the game makes
    js/data/economy.js      difficulty: the weekly targets, prices
    js/data/art.js          where each picture goes
    js/data/meta.js         the game's name

Two more places, if you want them:

    css/                    all the colour
    assets/                 drop pictures and sound files in here

You never need to open anything in `js/engine/` or `js/ui/`. That's the
machinery.

---

## The other documents, and which to ignore

- **`CONTENT.md`** — the reference. One section per file above, each with a
  worked example you can copy. Look things up in it; don't read it start to
  finish.
- **`preview.html`** — open `http://localhost:8000/preview.html` with the
  server running. Every scene playable on its own with her sprite, so you
  can read an ending without playing eight weeks to reach it; every picture
  slot side by side; every sound with a play button.
- **`research/run-length.md`** — why the game is eight weeks. Short.
- **`research/genre-loops.md`** — the games this one learned from.
- **`README.md`** — the same ground as this page, aimed at a programmer.
- **`CHANGELOG.md`** and **`docs/superpowers/`** — a record of how it got
  built, written for whoever maintains the code. **You can ignore both
  completely.** Nothing in them is a decision you need to make.

---

## Two things that will save you time

**Run this after you edit anything:**

    node tools/validate.js

It reads your content and tells you, in plain English, if something can't
work — a syrup nobody could ever discover, a dish no customer would order,
a scene that leads nowhere. It names the file and the line. It has caught
real mistakes that would otherwise have shown up as a blank screen.

**Nothing you write can break the engine.** Bad content gets skipped with a
warning rather than crashing the game. So experiment freely; the worst case
is that a thing doesn't show up and the validator tells you why.

---

## If it stops working

Undo your last change and refresh. If that doesn't do it, run
`node tools/validate.js` — it will usually name the problem outright.

To check the whole thing is still sound:

    node --test tests/

That runs 314 checks over the rules and the balance. It should say
`# fail 0`. If it doesn't, something in the machinery needs a programmer,
not you.

---

## A note on the writing

There's a voice guide at `god-synthia/research/voice-style-guide.md` and
everything I wrote was held to it — second person, present tense, short
hard-broken lines, deadpan. But she's yours, and if the guide and your
instinct disagree, your instinct wins.

One small thing worth keeping: **"Hm." is hers.** It's the only verbal tic
in the game that belongs to a single character, and the eleven customers
were deliberately rewritten to talk differently from her so that it stays
that way. If a market trader starts saying it, she loses something.
