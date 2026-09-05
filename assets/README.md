# Assets

Everything here is optional. The game draws placeholders for anything that
is missing and picks up a real file the moment one appears.

    node tools/art.js

That prints what is needed, where each file goes, what size, what the
picture has to show, and which placeholder it replaces. Run it again after
adding a file — it updates `manifest.json`, which is how the game knows
what to load without asking for files that are not there.

    assets/
    ├── manifest.json   written by tools/art.js - do not edit by hand
    ├── food/           pancakes: in the pan, overcooked, and in a stack
    ├── shop/           the griddle
    ├── decor/          the seven things you can buy for the room
    └── sprites/
        └── synthia_casual/   HER 29 SPRITES - already in the game

`sprites/synthia_casual/` is the one folder that is not empty. Those are
the collaborator's existing Synthia art, reused unchanged: expressions
(`c_*.png`), activity poses (`cact_*.png`) and body angles (`cpose_*.png`).
The story screen already picks the expression that matches her mood, and
her default shifts as the relationship deepens.

Transparent PNG for everything else, since it is all drawn over something.
JPEG works too — the checklist reads both.
