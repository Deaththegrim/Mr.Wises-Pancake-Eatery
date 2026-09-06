# Is eight weeks the right length?

The design doc left this open — "is 8 weeks right" sat in §17 with the other
unresolved questions, and it was never measured, only assumed. This answers
it with the simulator rather than with an opinion.

**Short answer: yes, and for a sharper reason than expected. Eight is the
shortest run in which the game's top ending exists at all.** The thing that
is genuinely wrong is not the length — it is that the story stops three
weeks before the game does.

## Method

`tools/simulate.js` now takes `{ weeks }`, so the same code that plays the
shipped game can play a shorter or longer one. Everything below is seed
2026, and the profiles are the existing ones: `careful` (plays well, pours
the syrup that suits the customer), `shelf` (plays equally well but pours
whatever is first on the shelf — the honest first-time player), and `deaf`
(cooks *identically* to careful but never acts on anything she mentions).

## Finding 1 — the run length IS the affection budget

Affection accrues at a roughly fixed rate per week, so making the game
shorter does not make it tighter; it makes the ending worse.

| weeks | careful | deaf (cooks the same, ignores her) |
|------:|---------|------------------------------------|
| 4 | 36 FAMILIAR | 28 REGULAR |
| 5 | 41 FAMILIAR | 33 FAMILIAR |
| 6 | 54 CONFIDANT | 38 FAMILIAR |
| 7 | 59 CONFIDANT | 43 FAMILIAR |
| **8** | **72 DEVOTED** | 48 FAMILIAR |
| 9 | 85 DEVOTED | 53 CONFIDANT |
| 10 | 90 DEVOTED | 58 CONFIDANT |

DEVOTED needs 70. **A seven-week game caps a listening player at 59**, so
"Most Do Not Stay" — her own voice-guide line turned back on her, and the
payoff the entire affection system exists to produce — would be
*structurally impossible*. That is the same failure this project has
already fixed twice: DEVOTED unreachable at threshold 90 against a ceiling
of 64, and STRANGER unreachable at a floor of 16 against a threshold of 10.

Eight weeks clears it by **2 points**. It is not a round number; it is the
first length that works, with almost no margin.

`tests/balance.test.js` now pins this, so shortening the game fails the
suite with the reason attached rather than silently deleting an ending.

## Finding 2 — going longer dilutes the mechanic the game is built on

At eight weeks the gap between listening and not listening is DEVOTED
against FAMILIAR: two full tiers. By week nine the deaf player reaches
CONFIDANT, and by ten the gap has narrowed to one tier. Extra weeks are
extra affection for *everyone*, so they erode the premium on the listening
beat — the single mechanic the pillar rests on.

## Finding 3 — after week nine the quota is not hard, it is absurd

Income plateaus around week 9. The quota keeps ratcheting at the curve's
last ratio (~1.22×), so the gap does not widen gently — it detonates.

| week | quota | earned | gap |
|-----:|------:|-------:|----:|
| 6 | 13,500 | 15,260 | +1,760 |
| 7 | 16,800 | 14,751 | −2,049 |
| 8 | 20,500 | 18,487 | −2,013 |
| 9 | 25,015 | 22,037 | −2,978 |
| 10 | 30,524 | 19,941 | −10,583 |
| 12 | 45,450 | 19,480 | −25,970 |

Weeks 7 and 8 miss by about 2,000 — a **near miss**, which is exactly the
designed shape: the quota stops being met but stays close enough to read as
pressure rather than as failure, and the game has no fail state to make it
sting. From week 10 it is a rout, and a rout is not a metronome.

## Finding 4 — the real problem, and it is not the length

**There are five mention scenes. She says one per week. The game is eight
weeks long.**

So weeks 6, 7 and 8 have no new thing for her to say — and those are
mechanically the *most* interesting weeks in the run: the research tree
completes in week 8, the decoration shop is finally affordable, and DEVOTED
is crossed. The player is at their most invested precisely while she has
gone quiet.

This is the actionable one. **If anyone writes more mention scenes, weeks
6–8 are where they go.** Nothing else about the length needs changing.

## Conclusion

- **Keep eight.** Shorter deletes an ending; longer dilutes the listening
  premium and turns the last weeks into a rout.
- **Do not shorten without moving `TIER_THRESHOLDS`** — the balance suite
  now refuses it, and says why.
- **Write into the gap, not around it.** Three more mention scenes would
  fix the only real weakness the measurement found.

*Numbers reproduce with `node tools/simulate.js` (the shipped eight-week
table) and by passing `{ weeks: n }` to `simulate()` for the rest.*
