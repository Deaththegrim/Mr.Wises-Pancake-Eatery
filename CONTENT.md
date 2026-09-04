# Adding content

Everything you can change lives in `js/data/`. You never need to open
anything in `js/engine/` or `js/ui/`.

Each file is a plain list. To add something, copy a row, change the values,
save. That's it — there's no build step, so a browser refresh shows it.

**After any edit, run this:**

    node tools/validate.js

It checks your content and prints the file and the row for anything wrong,
in plain English. It catches the mistakes that are invisible otherwise —
like a syrup nobody can ever discover, or a pancake nobody will ever order.
Please run it. It will save you an afternoon.

---

## Naming the game

`js/data/meta.js` — set `title` to whatever you want to call it.

    export const META = {
      title: null,        // <- put a name here
      ...

It's `null` right now, so the game just shows "Pancake Shop". Nothing else
anywhere hardcodes a name, so this one line is the whole job.

---

## Adding a pancake — `js/data/recipes.js`

    {
      id: 'lemon_stack',            // unique, no spaces, never changes
      name: 'Lemon Stack',          // what the player sees
      tags: ['basic'],              // customers order by tag - see below
      base: 25,                     // base price
      ingredients: ['flour', 'lemon'],
      pour: { target: 55, band: 9 },  // ml of batter, and how close counts
      flip: { windowMs: 450 },        // bigger number = more forgiving
      stackCount: 3,                  // how many pancakes
      weights: { pour: 1, flip: 2, stack: 1, drizzle: 1 },
      unlockedAtStart: false
    }

### `weights` is the interesting one

It decides what the dish is *about*. The four numbers are how much each
part of making it counts toward the score.

- High `flip` → a timing dish. Get it wrong and it's ruined.
- High `stack` → a precision dish. Wobble early and the tower leans.
- High `drizzle` → a presentation dish.

The Souffle has `flip: 3` and `stack: 0.5`, so it lives and dies on one
moment. The Impossible Stack has `stack: 3`, so it's about a steady hand.
Same four actions, completely different feel, for four numbers.

### `band` and `windowMs` are the difficulty

Smaller = harder. A sloppy player scores **80** on a Plain Stack (band 10)
but only **35** on a Souffle (band 5). That's where difficulty lives — if
you want a dish to demand care, tighten these. Don't ask for the scoring to
be made harsher overall; that would stop the game being chill.

### Every recipe needs a customer who wants its tag

If you tag a recipe `divine` and nobody in `customers.js` wants `divine`,
it can **never be ordered** — you'd research it, unlock it, put it on the
menu, and watch it never sell. This actually happened during development.
`validate.js` now treats it as an error and tells you.

---

## Adding a customer — `js/data/customers.js`

    {
      id: 'the_baker',
      name: 'The Baker',
      unlockAt: { reputation: 80 },     // or { week: 3 }, or both
      wants: ['rich', 'delicate'],      // recipe tags
      lines: {
        greeting: 'Professional curiosity.',
        happy: 'Hm. Better than mine.',
        disappointed: 'I have had worse.'
      }
    }

This is the easiest place to add content and see it in-game straight away.

**There is no `patience` field.** The game has no clock, so it would be a
number nothing could ever count down. Customers wait forever and never
complain. That's deliberate.

---

## Ingredients cost money — `js/data/ingredients.js`

    { id: 'cream', name: 'Cream', cost: 22,
      axes: { sweet: 3, sharp: 1, rich: 9, strange: 0 } }

`cost` is what makes research a grind. You buy stock out of the shop's till,
and the bench **burns it whether or not the experiment works**. That's the
whole loop: serve pancakes → earn → buy ingredients → experiment → discover.

Prices are scaled against real income (roughly 1,000/week early, 10,000/week
late), so the cheap staples keep a broke player tinkering while a
three-exotic blend is a serious investment. If you change prices, run
`node tools/simulate.js` — the bench is the game's main money sink, so these
numbers decide whether the shop's profits have a purpose at all.

The `axes` are the flavour profile the bench averages together.

## Adding a syrup — `js/data/syrups.js`

Two different things live on a syrup, and it's worth understanding why:

- `axes` — what the **finished syrup tastes like** when used on a dish.
- `discover.target` — the **blend the player has to hit** at the bench.

They don't have to match, and often shouldn't. The bench *averages* its
ingredients, so a blend can never be stronger than its strongest
ingredient — but a finished syrup can be, because you cook it down. Salted
Caramel is found from a gentle blend (maple + butter + salt) and tastes
strong. Mild inputs, intense output, exactly like real cooking.

**The trap:** if you write a `target` that's more intense than any blend
can reach, the syrup is undiscoverable forever. `validate.js` brute-forces
every combination and will tell you the closest possible blend and how far
off you are.

`tolerance` is how close counts. Bigger = easier to find.

**Work backwards, don't guess.** Pick the ingredients you want the recipe to
be — thematically, what *should* make this syrup — then set the target to
what that blend actually averages to. Every syrup in the file has its
intended recipe in a comment above it for exactly this reason. Guessing a
target and hoping is how one of them ended up undiscoverable.

---

## Adding research — `js/data/research.js`

    { id: 'r_lemon', name: 'Citrus Work', cost: 5,
      prereqs: ['r_buttermilk'],           // other research ids
      gate: { cooked: { plain: 10 } },     // or null
      unlocks: { recipe: 'lemon_stack' } } // exactly one of recipe/syrup/upgrade

`gate` makes the player *do* something rather than just save up points.

**Upgrades make mistakes cost less; they never make numbers bigger.** A
griddle alarm marks the flip window, a measured ladle widens the pour band.
That's on purpose — the game should get calmer as it goes, not louder.

---

## Writing Synthia — `js/data/scenes.js`

Same node format as god-synthia's `js/story.js`, so it should feel familiar.

    quiet_morning: {
      speaker: 'God Synthia',
      expr: 'sleepy',
      text: '“You are early.”\n\nSo is she.',
      choices: [
        { text: 'So are you.', next: 'quiet_morning_b', affection: 2 },
        { text: 'Say nothing.', next: 'quiet_morning_b', affection: 1 }
      ]
    }

Voice rules are in
`~/vault/projects/god-synthia/research/voice-style-guide.md` — second
person, present tense, short hard-broken fragments, deadpan, smart quotes
for her spoken lines. **Everything currently in `scenes.js` is placeholder
written to be thrown away.** The voice is yours.

`expr` takes any expression in `assets/sprites/synthia_casual/` — drop the
`c_` prefix, so `c_sleepy.png` is `expr: 'sleepy'`. There are 16, plus 8
activity poses (`cact_coffee`, `cact_sitting`…) and 5 body angles. If you
leave `expr` off, she uses whichever expression matches how close she
currently is to the player, which usually reads better.

### The one field worth knowing about

    mentions: 'souffle'

Put that on a node where she mentions something **in passing**. If the
player later researches that dish and serves it to her, unprompted, weeks
after she said it — she notices, and it's worth more than anything else in
the game.

It's the best thing in here. Two notes on using it:

- **Use it sparingly.** It only lands if it feels like she's forgotten she
  said it. Three or four across the whole game is plenty.
- **Make the line sound like nothing.** If it reads as a quest marker, the
  moment is dead. She should be talking to herself.

---

## How the relationship works

`js/data/affection.js` holds the numbers. **The player never sees any of
them** — no meter, no hearts, no bar. A visible bar turns a slow burn into
a grind target and kills it.

Instead it shows in which expression she arrives wearing, how long she
stays, and what she says. The player should feel it change before they can
name it.

Five stages: `STRANGER → REGULAR → FAMILIAR → CONFIDANT → DEVOTED`.

**It can stall. It never falls.** Nothing the player does badly takes any
of it away — not a missed quota, not a burnt pancake. This is a cozy game.

One deliberate bit of design: reaching `DEVOTED` is **impossible without
the listening beats**. A player who cooks perfectly and picks every kind
dialogue option, but never notices what she mentions, stops at `CONFIDANT`.
Paying attention is the point. If you change the grant numbers, keep that
true — there's a test that fails if it stops being.

---

## Changing the difficulty — `js/data/economy.js`

The quota curve and every tuning number live here. They're all placeholders
and they're all probably wrong; change them freely.

**After changing anything in this file, run:**

    node tools/simulate.js

It plays a full 8-week game twice — once as a sloppy player, once as a
careful one — and prints whether each week's quota was reachable. As tuned
right now:

    sloppy player, sells everything ....... 2 of 8 quotas
    careful player, sells everything ...... 6 of 8
    careful player, narrows the menu ...... 8 of 8

That spread is the design working. Nobody ever fails — a missed quota is a
Synthia scene, not a game over — but the last weeks need the player to
think about *what* they sell, not just how well they cook.

---

## If something breaks

- **Blank screen or a dead button** → open the browser console (F12). The
  game warns about missing story nodes, missing sprites, and unknown ids
  rather than dying silently.
- **A save stops loading** → it will tell you why. Old saves survive new
  content; anything that no longer exists is dropped with a warning rather
  than breaking the file.
- **Anything else** → run `node tools/validate.js` first. It catches most
  of it.
