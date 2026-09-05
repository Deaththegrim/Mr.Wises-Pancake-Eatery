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
      craft: 8,                     // the skill premium - see below
      ingredients: ['flour', 'lemon'],
      pour: { target: 55, band: 9 },  // ml of batter, and how close counts
      flip: { windowMs: 450 },        // bigger number = more forgiving
      stackCount: 3,                  // how many pancakes
      weights: { pour: 1, flip: 2, stack: 1, drizzle: 1 },
      unlockedAtStart: false
    }

### You do not set a price — the bill does

A dish is priced from its parts, the way a shop actually bills. Serve the
Lemon Stack above and the customer's receipt reads:

    3 pancakes @ 3      9      <- stackCount x pricePerPancake
    Lemon               6      <- the ingredient's own `sell` value
    skill               8      <- the recipe's `craft`
    made 84%           +5
    Maple Syrup        +3
    tip                +4
    ------------------------
    total              35
    stock              -3
    kept               32

So a dish earns more because it has more, and dearer, parts — which is what
makes the research tree pay. You never type a price; you choose what goes in.

**`craft` is the one number you do pick.** It is the premium for the skill
the dish takes, on top of its parts, and it exists because a bill of
materials cannot express difficulty: the Souffle is two pancakes and cheap
ingredients, and it sells for 45 because it is *hard*. Priced purely by
parts it would be one of the cheapest things in the game. Set `craft` to 0
for something anyone could make and let the parts speak.

`pricePerPancake` lives in `js/data/economy.js`. Raise it and tall stacks
gain on rare-ingredient dishes; lower it and the reverse.

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
      taste: { sweet: 5, sharp: 2, rich: 9, strange: 4 },
      lines: {
        greeting: 'Professional curiosity.',
        happy: 'Hm. Better than mine.',
        disappointed: 'I have had worse.'
      }
    }

This is the easiest place to add content and see it in-game straight away.

**`taste` is which syrup suits them**, on the same four axes as ingredients
and syrups. Pouring a well-matched syrup pays more and builds reputation
faster; a mismatch is just ordinary, never a penalty. Keep it in step with
`wants` — `basic` is sweet, `bright` is sharp, `rich` is rich, `strange`
and `divine` are strange — or the tag they order by and the syrup that
pleases them drift apart. `validate.js` warns if you write a syrup that no
customer would ever be pleased by.

**`happy` and `disappointed` are printed at the top of their receipt**,
under the dish name. They went unrendered for most of the build, so write
them as things a person actually says, not as labels.

**There is no `patience` field.** The game has no clock, so it would be a
number nothing could ever count down. Customers wait forever and never
complain. That's deliberate.

---

## Ingredients cost money — `js/data/ingredients.js`

    { id: 'cream', name: 'Cream', cost: 22, sell: 7,
      axes: { sweet: 3, sharp: 1, rich: 9, strange: 0 } }

**Two prices, and they are not the same thing.** `cost` is what YOU pay for
a unit of stock. `sell` is what that ingredient adds to the CUSTOMER's bill
per serving, as its own line on the receipt. The margin between them is the
shop's living, so `sell` wants to be comfortably above `cost / 10` — one
unit is ten servings. `validate.js` warns when it isn't.

Put a dear ingredient in a dish and the dish bills for more, automatically.
That is the whole pricing model: you never set a price, you choose what
goes in.

Stock is bought in **units** and held in **servings**. One unit is a bulk
quantity — a sack of flour — that makes ten pancakes. Cooking spends one
serving; the bench burns a **whole unit**, because experimenting is
wasteful. That gap is deliberate and load-bearing: it keeps discovery
expensive while cooking stays profitable. If you shrink it, cooking starts
losing money on every dish.

Running out mid-service never turns a customer away — you buy emergency
stock at double price instead, so bad planning costs margin, not the sale.

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

**`axes` is not decoration.** At the drizzle beat the player picks which
syrup to pour, and it is scored against that customer's `taste`. A syrup
nothing suits is a discovery that pays nothing — the player spends the
bench's ingredients and gets a name — so `validate.js` warns when no
customer would score a syrup well. The picker shows a syrup's strongest
axis ("Lemon Glaze · sharp"); the customer's taste is never printed,
because it is meant to be learned by serving them.

**Work backwards, don't guess.** Pick the ingredients you want the recipe to
be — thematically, what *should* make this syrup — then set the target to
what that blend actually averages to. Every syrup in the file has its
intended recipe in a comment above it for exactly this reason. Guessing a
target and hoping is how one of them ended up undiscoverable.

---

## Things to buy for the room — `js/data/decor.js`

    { id: 'corner_lamp', name: 'Corner Lamp', cost: 2600,
      art: 'decor_lamp',
      note: 'Warm, and low, and on all day.' }

This is the easiest file in the project to add to, and the safest: nothing
here affects play at all.

**Decoration is cosmetic, and must stay that way.** It never touches
reputation, research points or affection — there is a test that buys every
item and asserts all three are unchanged, and the smoke test checks the
same thing through the real page. Reputation already means exactly two
things (which customers turn up, and how many); a third input would make it
two systems wearing one name.

So why does it exist? It is what the money is *for*. The research tree
finishes before the last weeks, and without a shop to spend on, the till
just climbs — about 21,000 by the end of a careful run, in a game whose
whole escalating quota is supposed to mean something. Nobody needs the
window boxes. That is the point of them.

**Two rules the validator checks:**

- Rows are listed cheapest first, and the shop screen renders in that
  order, so each one should cost more than the one above it.
- The whole shop should total more than about 15,000. A careful run banks
  roughly that much spare, and if everything is affordable in one go the
  sink empties before the last week and the money starts piling up again.

`note` is the line of prose shown beside it — write it as the reason
somebody would want the thing, not as a description of the thing. `art`
names the sprite that will one day replace the drawn placeholder; until
then the room shows a labelled outline per item and nothing else changes
when the real art arrives.

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

**Open `preview.html`** (with the server running) to read any scene on its
own, with her sprite and her expression, without playing to it. Choices
work; nothing is recorded.

**Start with `node tools/writing.js synthia`.** It prints every scene with
when the player sees it — which week, what they have just done, what her
face is doing, and what the player can say back — so the lines can be
written in any order without reading any code. `node tools/writing.js` on
its own adds the shop: the customers, the room, and the names.


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

## When she asks for something you cannot make

If she mentions a dish in a scene (`mentions:` on a node) and the player
has not unlocked it, she will ask for it on her next visit and be deadpan
about its absence. Her lines for that moment are `IMPOSSIBLE_ORDER_LINES`
at the bottom of `js/data/scenes.js` — plain strings, rewrite freely.

It costs her nothing: she asks, then orders something you *can* make, and
the research node that unlocks the dish is marked *"She asked for this"*.
Do not make the ask replace her order. She visits once a week, so that
would cost the player that week's affection — the relationship would get
worse the more she wanted, which is backwards.

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

## Adding artwork — drop a file in

Every picture the game can use is listed in `js/data/art.js`. **Nothing
there needs to exist.** Each one draws a placeholder until a file appears
at its path, and picks the file up the moment one does.

The whole workflow:

    1. node tools/art.js        # what is needed, where it goes, what size
    2. put the file there
    3. node tools/art.js        # again - it lists the file and tells the game
    4. reload the page

`preview.html` shows every slot side by side — the real file where you have
drawn one, and what it needs where you have not — so you can check a
picture without playing to the screen it appears on.

No code change, no registration, no build step. Delete the file and the
placeholder comes back.

`node tools/art.js` prints, for every empty slot, the exact path, the size,
what the picture has to show, and which placeholder it replaces — so you
can look at what you are replacing before drawing anything. For filled
slots it prints the size it found, and warns if the shape is different from
what that slot expects.

**Why step 3 exists.** Asking the browser for a file that is not there logs
an error, and a missing picture is the normal state here — eleven of them
would bury the warnings the console is actually for. So `tools/art.js`
writes `assets/manifest.json` listing what exists, and the game only asks
for those. Skip step 3 and the game still finds your file, it is just noisy
about the ones that are missing.

**Sizes are a suggestion, shape is not.** Supply 2x for a sharp screen —
anything is scaled to fit. But two slots (`pancake_stacked`, and the room's
decorations) are drawn into a fixed box, because the stack beat measures a
leaning tower and the drizzle beat scores coverage across it: the art must
not move the thing the player is aiming at. Those want the aspect the slot
states, or they will be squashed to it.

**Transparent PNG throughout.** Everything is drawn over something.

To add a slot that does not exist yet, add a row to `js/data/art.js` and
read it with `sprite('<your-id>')` from `js/ui/art.js` wherever it should
draw. The checklist and the tests pick it up automatically.

### Synthia's sprites are already in

Her 29 expressions and poses live in `assets/sprites/synthia_casual/` and
are wired: the story screen picks the one matching her mood, and her
expression shifts with the relationship on its own. Adding an expression is
a file in that folder plus a line in `js/data/affection.js`.

---

## Changing the difficulty — `js/data/economy.js`

The quota curve and every tuning number live here. They're all placeholders
and they're all probably wrong; change them freely.

**After changing anything in this file, run:**

    node tools/simulate.js

It plays a full 8-week game twice — once as a sloppy player, once as a
careful one — and prints whether each week's quota was reachable. As tuned
right now, on the default seed:

    sloppy player ..... 2 of 8 quotas, tier FAMILIAR
    shelf player ...... 5 of 8 quotas, tier DEVOTED
    careful player .... 6 of 8 quotas, tier DEVOTED

That spread is the design working. Nobody ever fails — a missed quota is a
Synthia scene, not a game over — but the late weeks are near-misses that
make you want one more unlock. Over 20 seeds a careful player averages
5.8 of 8 and only ever misses weeks 6, 7 and 8.

Two of the four profiles exist to keep the tuning honest:

**`shelf`** cooks exactly as well as `careful` but pours whatever syrup the
picker preselects. `careful` picks with `bestSyrupFor()`, which is an oracle
for a taste the game deliberately never prints — tuning against that alone
would balance the game for information no first-time player has. `shelf`
still clears 5 of 8 and still reaches DEVOTED, so the curve is honest.

**`deaf`** cooks as well as `careful` but keeps anything Synthia has
mentioned off the menu, measuring whether **listening** is worth anything on
its own: 72 affection against 43, two whole tiers. If those two ever
converge, the arc has quietly gone back to being a function of cooking
accuracy — which is exactly the bug it was written to catch, and
`tests/balance.test.js` fails when it happens.

**Watch out for one thing when you change the simulator:** `experiment()`
credits its research points to the state itself and returns the number only
so the UI can print it. The simulator once added them again, so every
number in this table described a game a third richer than the one that
ships, and the quota curve was calibrated from it.

The late-game lever is the **research tree**: dishes with more and dearer
parts on their bill are what close the gap. (Narrowing the menu helps early, but once you have several
recipes the game already steers customers toward your expensive dishes on
its own, so restricting it just turns people away.)

---

## If something breaks

- **Blank screen or a dead button** → open the browser console (F12). The
  game warns about missing story nodes, missing sprites, and unknown ids
  rather than dying silently.
- **A save stops loading** → it will tell you why. Old saves survive new
  content; anything that no longer exists is dropped with a warning rather
  than breaking the file.
- **Anything else** → run `node tools/validate.js` first. It catches most
  of it: dead scene links, a mention naming a recipe that no longer
  exists, a syrup no customer would like, a tier with no sprite, a
  customer nobody can be served in week 1.

**The three checks, in the order you want them:**

    node tools/validate.js     # content — instant
    node --test tests/         # rules — a couple of seconds
    python3 tools/smoke.py     # the real page in a real browser — a minute

And the two worklists, which never fail — they just tell you what is left:

    node tools/writing.js      # every line of prose, and when it is seen
    node tools/art.js          # every picture, where it goes, what it shows

`tools/playthrough.py` is the slow one. It plays actual in-game weeks
through the page and then checks that `tools/simulate.js` agrees with what
happened. Run it after changing how a turn is driven. It exists because
for most of this build the simulator called `serve()` the same wrong way
the UI did, so it faithfully reproduced the bug instead of exposing it — a
simulator that shares the UI's blind spots is worse than none, because it
manufactures confidence.

**A note on the colours.** Every colour, including the ones painted on the
canvas, is a token in `css/style.css`. `ui/griddle.js` reads them at mount.
Change `--cake` and the pancake changes everywhere; do not hardcode a hex
in the canvas, which is how the DOM and the canvas ended up drawing the
same pancake in two different browns.
