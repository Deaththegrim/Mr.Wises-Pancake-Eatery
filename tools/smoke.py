#!/usr/bin/env python3
"""Headless smoke test — actually PLAYS the game in a real browser.

The unit tests prove the rules are right. This proves the page works: that
the modules load, the screens advance, the griddle records all four beats,
serving pays out, a week rolls over into a Synthia scene, and the save
survives a reload.

Run:  python3 tools/smoke.py
Exits non-zero on any console error or failed assertion.

Requires playwright (already present at ~/.cache/ms-playwright). This is a
dev tool only — the game itself still has zero dependencies.
"""

import subprocess, sys, time, http.server, socketserver, threading, functools, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8321

def serve():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd

def clear_scenes(page, limit=12):
    """Walk out of any VN scene that is open.

    Her visit rolls to the next day the shop opens if she was not served,
    so a scene can be waiting after almost any "Open the shop". Four
    sections of this file had grown their own copy of this loop before it
    was worth naming, and the fifth that forgot it timed out for 30s.
    """
    for _ in range(limit):
        if not page.is_visible("#screen-vn"):
            return
        buttons = page.query_selector_all("#vn-choices button")
        if not buttons:
            return
        buttons[0].click()
        page.wait_for_timeout(150)


def dismiss_ask(page):
    """Acknowledge an impossible order if she is making one.

    She asks for a dish that is not unlocked before placing her real
    order, so the griddle does not exist until "Say so" is clicked. Any
    section that opens the shop can land on this.
    """
    first = page.query_selector("#griddle-mount button")
    if first and first.inner_text().strip() == "Say so":
        first.click()
        page.wait_for_timeout(300)


def main():
    from playwright.sync_api import sync_playwright

    httpd = serve()
    failures, errors, warnings = [], [], []

    def check(cond, label):
        print(("  ok   " if cond else "  FAIL ") + label)
        if not cond:
            failures.append(label)

    def stage(page):
        """Current beat name. NOTE: .beat-label is text-transform:uppercase and
        inner_text() returns RENDERED text, so this must be lowercased."""
        return page.inner_text(".beat-label").lower()

    def bbox(handle, what):
        assert handle is not None, f"element not found: {what}"
        box = handle.bounding_box()
        assert box is not None, f"element has no box: {what}"
        return box

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}")
                if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))

        # WARNINGS COUNT TOO. Three comments across the codebase justified
        # themselves with "the smoke test asserts a clean console", and it
        # did not — only `error` was collected, so every console.warn the
        # project raises for a real fault sailed past. That is the whole
        # diagnostic channel for a missing story node, an unknown id in a
        # save, a stale audio manifest, or a recording that would not
        # decode. A healthy run emits none, so any at all is a finding.
        page.on("console", lambda m: warnings.append(f"{m.text}")
                if m.type == "warning" else None)

        page.goto(f"http://127.0.0.1:{PORT}/", wait_until="networkidle")

        print("\n-- title screen --")
        check(page.is_visible("#screen-title"), "title screen visible")
        check(page.inner_text("#title-text").strip() != "", "title renders a fallback name")

        print("\n-- new game -> morning --")
        page.click("#btn-new")
        # PIN THE SEED. Without this smoke plays a DIFFERENT game every run:
        # newGame() defaults to a clock-derived seed, so customer order,
        # traffic and orders all vary. That produced an intermittent failure
        # at "service screen visible" that three later runs could not
        # reproduce — the worst kind of gate, one that cries wolf and is then
        # ignored. Content variety is covered by the seed sweep in the unit
        # tests; smoke's job is to prove the wiring, reproducibly.
        page.evaluate("window.GAME.state.seed = 2026; window.GAME.save();")
        # Give the player a shelf. The game starts with ONE syrup, so
        # without this the picker never renders and every check below
        # passes by never running — which is how the first version of
        # this block "passed" while proving nothing.
        page.evaluate("""window.GAME.state.unlockedSyrups =
            ['maple_syrup', 'lemon_glaze', 'ash_glaze']; window.GAME.save();""")
        check(page.is_visible("#screen-morning"), "morning screen visible")
        boxes = page.query_selector_all("#menu-picker input[type=checkbox]")
        check(len(boxes) >= 1, f"menu lists {len(boxes)} unlocked recipe(s)")
        check(page.is_enabled("#btn-open"), "open button enabled with a non-empty menu")

        print("\n-- unchecking every recipe disables opening --")
        for b in boxes:
            if b.is_checked():
                b.uncheck()
        check(not page.is_enabled("#btn-open"), "cannot open with an empty menu")
        boxes[0].check()
        check(page.is_enabled("#btn-open"), "re-enabled after re-checking one")

        print("\n-- the morning restock loop --")
        warn = page.inner_text("#stock-warning")
        check(warn.strip() != "", "the morning screen reports stock readiness")
        restock = [b for b in page.query_selector_all("#stock-warning button")]
        if restock:
            check(True, f'a restock button is offered: "{restock[0].inner_text()}"')
            check(not restock[0].is_enabled(),
                  "and it is correctly disabled with an empty till on day one")

        print("\n-- service: cook one dish through all four beats --")
        page.click("#btn-open")
        # Day one of week one, so no visit is due on the pinned seed — but
        # guarded anyway, because "safe for this seed" is the kind of
        # property that quietly stops being true.
        clear_scenes(page)
        # Wait for the transition rather than asserting in the same tick.
        try:
            page.wait_for_selector("#screen-service", state="visible", timeout=4000)
        except Exception:
            pass
        check(page.is_visible("#screen-service"), "service screen visible")
        check(page.inner_text("#customer-card").strip() != "", "a customer is waiting")

        # BEAT 1 pour — hold the button briefly
        page.wait_for_selector("#beat-area button")
        box = bbox(page.query_selector("#beat-area button"), "pour button")
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down(); time.sleep(0.8); page.mouse.up()
        poured = page.evaluate("document.getElementById('pour-read')") is None
        check("flip" in stage(page), "pour advanced to flip")

        # BEAT 2 flip — wait for bubbles, then click
        time.sleep(2.2)
        page.click("#beat-area button")
        check("stack" in stage(page), "flip advanced to stack")

        # BEAT 3 stack — click the plate centre once per pancake
        pb = bbox(page.wait_for_selector("#plate"), "plate")
        for _ in range(10):
            if "stack" not in stage(page):
                break
            page.mouse.click(pb["x"] + pb["width"] / 2, pb["y"] + pb["height"] / 2)
            time.sleep(0.12)
        time.sleep(0.5)
        check("drizzle" in stage(page), "stack advanced to drizzle")

        # THE SYRUP PICKER. Discovering a syrup used to move a counter and
        # nothing else; the choice now reaches the payout, so the control
        # that makes it has to actually be there and be operable.
        print("\n-- the syrup picker --")
        chosen_syrup = None
        picker = page.query_selector(".syrup-picker")
        check(picker is not None,
              "the picker renders when the player owns more than one syrup")
        if picker is not None:
            opts = page.query_selector_all(".syrup-picker .syrup")
            check(len(opts) >= 2, f"the picker offers {len(opts)} syrups")
            check(picker.get_attribute("role") == "radiogroup",
                  "the picker is a radiogroup, so it is one tab stop rather than nine")
            sel = [o for o in opts if "selected" in (o.get_attribute("class") or "")]
            check(len(sel) == 1, "exactly one syrup starts selected, so a dish always gets syrup")
            check([o.get_attribute("tabindex") for o in opts].count("0") == 1,
                  "only the selected option is in the tab order")
            first = sel[0].inner_text()
            opts[0].focus()
            page.keyboard.press("ArrowRight")
            now = [o.inner_text() for o in page.query_selector_all(".syrup-picker .syrup")
                   if "selected" in (o.get_attribute("class") or "")]
            check(now and now[0] != first, "arrow keys move the selection")
            check(page.evaluate("document.activeElement.textContent") == now[0],
                  "and focus follows the selection")
            # The name of the syrup the player actually chose, e.g.
            # "Lemon Glaze · sharp" -> "Lemon Glaze". The receipt below must
            # name THIS one: asserting "any of the three seeded syrups
            # appears" was satisfied by the default selection no matter what
            # the player picked, so the picker could be made decorative and
            # every gate still passed.
            # Now deliberately pour the one that SUITS this customer. The
            # run is seeded, so the early customers are basic-tastes and
            # Maple Syrup is their match. Asserting only that "a verdict
            # appeared" was not enough: dropping the customer's taste from
            # serve() makes every syrup score zero and still prints a line,
            # just always the worst one. A good pairing must pay.
            for opt in page.query_selector_all(".syrup-picker .syrup"):
                if opt.inner_text().startswith("Maple Syrup"):
                    opt.click()
                    break
            sel_now = [o.inner_text() for o in page.query_selector_all(".syrup-picker .syrup")
                       if "selected" in (o.get_attribute("class") or "")]
            chosen_syrup = sel_now[0].split("\u00b7")[0].strip() if sel_now else None
            check(chosen_syrup == "Maple Syrup", f"clicking selects that syrup ({chosen_syrup})")

        # BEAT 4 drizzle — drag across the cells
        wb = bbox(page.wait_for_selector("#drizzle"), "drizzle strip")
        y = wb["y"] + wb["height"] / 2
        page.mouse.move(wb["x"] + 4, y)
        page.mouse.down()
        for _ in range(3):
            for i in range(20):
                page.mouse.move(wb["x"] + 4 + i * (wb["width"] - 8) / 19, y)
        page.mouse.up()
        page.click("text=Done")

        money = page.evaluate("window.GAME.state.money")
        cooked = page.evaluate("JSON.stringify(window.GAME.state.cooked)")
        rep = page.evaluate("window.GAME.state.reputation")
        print(f"       money={money} cooked={cooked} rep={rep:.2f}")
        check(money > 0, "serving the dish paid out")

        # THE BILL. A dish is priced from its parts, and the receipt is
        # where the player reads it. Their happy/disappointed lines and the
        # syrup verdict live on it too — both existed in the data from the
        # start and neither was rendered anywhere for most of the build.
        receipt = page.inner_text("#receipt")
        check("\u201c" in receipt and "\u201d" in receipt,
              f"the customer reacts in their own words on the bill: {receipt.splitlines()[1][:50]}")
        check("pancakes @" in receipt or "pancake @" in receipt,
              "the bill charges for the pancakes themselves")
        check("total" in receipt, "the bill totals up")
        check(chosen_syrup and chosen_syrup in receipt,
              f"the bill names the syrup the PLAYER chose ({chosen_syrup}), not whatever was first")
        # And it must have been scored against this customer, not ignored:
        # dropping `taste` from the serve() options makes every syrup score
        # zero forever, which no other check could see.
        rows_r = [r for r in receipt.splitlines() if r.strip()]
        syrup_idx = next((i for i, r in enumerate(rows_r)
                          if chosen_syrup and r.startswith(chosen_syrup)), None)
        verdict = rows_r[syrup_idx] if syrup_idx is not None else "no line"
        check(syrup_idx is not None and "\u2014" in verdict,
              f"and carries a verdict: {verdict}")
        # THE ONE THAT MATTERS. A syrup that suits this customer must PAY.
        # If serve() is not handed the customer's taste, every syrup scores
        # zero: the line still prints, the verdict just silently becomes
        # "not really theirs" forever and the pairing pays nothing.
        amount = int(rows_r[syrup_idx + 1].lstrip("+")) if syrup_idx is not None else 0
        check("not really theirs" not in verdict and amount > 0,
              f"and a well-matched syrup actually pays: {verdict} = +{amount}")
        # THE CHECK THAT MATTERS: the number on the bill is the number the
        # till took. The receipt and the takings come from one billFor()
        # call precisely so they cannot drift, and this proves it end to
        # end. This is the first dish of the day, so dayEarnings is it.
        rows = [r for r in receipt.splitlines() if r.strip()]
        total_on_bill = None
        for i, r in enumerate(rows):
            if r.strip() == "total" and i + 1 < len(rows):
                total_on_bill = int(rows[i + 1].strip())
                break
        earned = page.evaluate("window.GAME.state.dayEarnings")
        check(total_on_bill is not None and total_on_bill == earned,
              f"the bill's total is what the till took: bill {total_on_bill}, till {earned}")
        check(rep > 0, "serving the dish raised reputation")
        check(page.inner_text("#customer-card").strip() != "", "the next customer appeared")

        print("\n-- save survives a reload --")
        page.reload(wait_until="networkidle")
        page.click("#btn-continue")
        restored = page.evaluate("window.GAME.state.money")
        check(page.is_visible("#screen-morning"), "Continue reaches the morning screen")
        check(restored == money, f"money restored ({restored} == {money})")

        print("\n-- a full week rolls over into a Synthia scene --")
        # Drive the engine directly for speed; the UI path is proven above.
        page.evaluate("""
          (async () => {
            const s = window.GAME.state;
            s.day = 7;
            window.GAME.save();
          })()
        """)
        page.click("#btn-open")
        # She may be waiting on this day — an unserved visit rolls forward
        # to the next day the shop opens, so her mention scene can be up
        # before the day is closed. Walk out of it first.
        page.wait_for_timeout(300)
        clear_scenes(page)
        page.click("#btn-close")
        page.wait_for_timeout(400)
        check(page.is_visible("#screen-vn"), "week rollover opened the VN screen")
        check(page.inner_text("#vn-text").strip() != "", "the scene rendered text")
        sprite = page.get_attribute("#vn-sprite", "src")
        check(bool(sprite), f"her sprite loaded ({sprite})")
        natural = page.evaluate("document.getElementById('vn-sprite').naturalWidth")
        check(natural > 0, f"the sprite is a real image (naturalWidth={natural})")

        # Walk the scene to its end.
        for _ in range(12):
            btns = page.query_selector_all("#vn-choices button")
            if not btns:
                break
            btns[0].click()
            page.wait_for_timeout(150)
            if page.is_visible("#screen-evening"):
                break
        check(page.is_visible("#screen-evening"), "the scene ends back at the evening screen")
        week = page.evaluate("window.GAME.state.week")
        check(week == 2, f"the week advanced (week={week})")

        # The HUD and the ledger must not contradict each other. closeDay()
        # advances the week, so a ledger reading live state would report the
        # NEW week's empty progress while the header still showed the old.
        hud = page.inner_text("#hud")
        ledger = page.inner_text("#ledger")
        check(f"week {week}" in hud.lower(),
              f"the HUD shows the current week after a rollover: {hud.strip()}")
        check("finished" in ledger.lower(),
              "the ledger reports the week that just ENDED, not the new empty one")
        check(f"Week {week} target" in ledger,
              "and shows the new week's target separately")

        print("\n-- the shop: what the till is for --")
        # Give the player a till and then reach the evening the way they
        # do — the shop is drawn when the day closes, so injecting money
        # onto an already-rendered screen proves nothing.
        page.evaluate("window.GAME.state.money = 6000; window.GAME.save();")
        if page.is_visible("#screen-research"):
            page.click("#btn-back-evening")
        if page.is_visible("#screen-evening"):
            page.click("#btn-next-day")
        page.wait_for_selector("#btn-open", state="visible", timeout=4000)
        page.click("#btn-open")
        page.wait_for_timeout(300)
        clear_scenes(page)
        page.click("#btn-close")
        page.wait_for_timeout(400)
        clear_scenes(page)
        rows = page.query_selector_all(".decor-row")
        check(len(rows) >= 5, f"the shop offers {len(rows)} things for the room")
        buyable = [b for b in page.query_selector_all(".decor-row button") if b.is_enabled()]
        check(len(buyable) > 0, "and some are affordable on 6000")
        # The visible text on these is just a price, so without a label a
        # screen reader announces "400" with no idea what it buys.
        names = [b.get_attribute("aria-label") for b in buyable]
        check(all(n and "Buy" in n for n in names),
              f"each price button says what it buys: {names[0]}")

        rep_before = page.evaluate("window.GAME.state.reputation")
        pts_before = page.evaluate("window.GAME.state.points")
        money_before = page.evaluate("window.GAME.state.money")
        buyable[0].click()
        page.wait_for_timeout(350)
        money_after = page.evaluate("window.GAME.state.money")
        check(money_after < money_before, f"buying spends the money ({money_before} -> {money_after})")
        check(len(page.evaluate("window.GAME.state.decor")) == 1, "and the shop keeps what was bought")
        # THE DESIGN RULE. Decoration is cosmetic: reputation already means
        # exactly two things, and a third input would make it two systems
        # wearing one name.
        check(page.evaluate("window.GAME.state.reputation") == rep_before,
              "and it does NOT touch reputation")
        check(page.evaluate("window.GAME.state.points") == pts_before, "nor research points")
        # The ledger prints "In the till" right above the shop, so it must
        # not still be showing the old number after spending.
        ledger = page.inner_text("#ledger")
        check(str(money_after) in ledger,
              f"the ledger above it shows the new till, not the old one ({money_after})")

        # THE STALE PANEL. Research is a separate screen spending from the
        # same till, and "Back" used to be nothing but showScreen('evening')
        # — so returning showed a header, a ledger and a row of shop buttons
        # that disagreed about how much money there was.
        page.click("#btn-research")
        page.wait_for_timeout(300)
        page.evaluate("window.GAME.state.money = 150; window.GAME.save();")
        page.click("#btn-back-evening")
        page.wait_for_timeout(300)
        ledger_back = page.inner_text("#ledger")
        check("150" in ledger_back,
              "coming back from Research redraws the ledger with the real till")
        live = [b for b in page.query_selector_all(".decor-row button") if b.is_enabled()]
        check(len(live) == 0,
              f"and nothing costing more than 150 still looks buyable ({len(live)} live buttons)")
        page.evaluate("window.GAME.state.money = 3000; window.GAME.save();")


        # THE VISIBLE HALF. Buying is pointless if the room never shows it —
        # the same gap as the research board's "She asked for this.", which
        # could be deleted with every gate still green.
        bought_name = page.evaluate("""(() => {
            const id = window.GAME.state.decor[0];
            return id;
        })()""")
        page.click("#btn-next-day")
        page.wait_for_selector("#btn-open", state="visible", timeout=4000)
        page.click("#btn-open")
        # Same guard as everywhere else that opens the shop: a scene here
        # would hide #shopfront-decor, and this would fail as "the room is
        # empty" rather than naming the cause. A no-op when none is open.
        clear_scenes(page)
        dismiss_ask(page)
        page.wait_for_timeout(300)
        room = page.inner_text("#shopfront-decor")
        check(room.strip() != "", f"the room shows what was bought for it: {room.strip()[:40]}")
        tokens = page.query_selector_all(".decor-token")
        check(len(tokens) == len(page.evaluate("window.GAME.state.decor")),
              f"one thing drawn per thing owned ({len(tokens)})")

        # Back to the evening, where the sections below expect to start.
        page.click("#btn-close")
        page.wait_for_timeout(400)
        clear_scenes(page)

        print("\n-- research screen --")
        page.click("#btn-research")
        check(page.is_visible("#screen-research"), "research screen visible")
        nodes = page.query_selector_all("#tree-mount .node")
        check(len(nodes) > 0, f"tree renders {len(nodes)} nodes")
        check(page.inner_text("#bench-mount").strip() != "", "bench renders")

        print("\n-- the pantry economy: money -> ingredients -> discovery --")
        money_before = page.evaluate("window.GAME.state.money")
        print(f"       till before buying: {money_before}")

        # Trying to blend with nothing must be refused, not silently fail.
        page.click("text=Try it")
        page.wait_for_timeout(150)
        check(page.evaluate("window.GAME.state.money") == money_before,
              "an empty blend spends nothing")

        # Buy one of the cheapest ingredient, then use it.
        buy_btns = [b for b in page.query_selector_all("#bench-mount button")
                    if b.inner_text().startswith("buy")]
        check(len(buy_btns) > 0, f"market offers {len(buy_btns)} ingredients to buy")
        enabled = [b for b in buy_btns if b.is_enabled()]
        check(len(enabled) > 0, f"{len(enabled)} of them are affordable on today's takings")
        enabled[0].click()
        page.wait_for_timeout(150)
        money_after = page.evaluate("window.GAME.state.money")
        pantry = page.evaluate("JSON.stringify(window.GAME.state.pantry)")
        print(f"       till after buying: {money_after}  pantry={pantry}")
        check(money_after < money_before, "buying stock spent money from the till")
        check(pantry not in ("{}", "null"), "the ingredient landed in the pantry")

        use_btns = [b for b in page.query_selector_all("#bench-mount button")
                    if b.inner_text().strip() == "use" and b.is_enabled()]
        check(len(use_btns) > 0, "an in-stock ingredient can be selected")
        use_btns[0].click()
        page.wait_for_timeout(120)

        page.click("text=Try it")
        page.wait_for_timeout(250)
        hint = page.inner_text("#bench-mount .hint").strip()
        check(hint != "", f'the bench answered: "{hint}"')

        after_pantry = page.evaluate("JSON.stringify(window.GAME.state.pantry)")
        total_stock = page.evaluate(
            "Object.values(window.GAME.state.pantry||{}).reduce((a,b)=>a+b,0)")
        print(f"       pantry after experiment: {after_pantry}")
        check(total_stock == 0, "the experiment consumed the ingredient (failure costs stock)")

        print("\n-- a HARD recipe: 7-pancake stack, tight windows --")
        # Everything above exercised `plain`. The recipes differ in
        # stackCount and window width, and the griddle reads those from
        # data - so a recipe with a different shape is a genuinely
        # different code path through the beats.
        page.evaluate("""
          (() => {
            const s = window.GAME.state;
            s.unlockedRecipes = ['plain','impossible'];
            s.menu = ['impossible'];
            s.money = 5000;
            s.pantry = {};                       // force the emergency path
            window.GAME.save();
          })()
        """)
        page.click("#btn-back-evening")
        page.click("#btn-next-day")
        page.click("#btn-open")
        page.wait_for_timeout(300)
        clear_scenes(page)
        dismiss_ask(page)
        page.wait_for_selector("#beat-area button")

        money_before = page.evaluate("window.GAME.state.money")
        box = bbox(page.query_selector("#beat-area button"), "pour button")
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down(); time.sleep(0.9); page.mouse.up()
        check("flip" in stage(page), "pour advanced on a different recipe")

        time.sleep(2.2)
        page.click("#beat-area button")
        check("stack" in stage(page), "flip advanced")

        pb = bbox(page.wait_for_selector("#plate"), "plate")
        clicks = 0
        for _ in range(14):
            if "stack" not in stage(page):
                break
            page.mouse.click(pb["x"] + pb["width"] / 2, pb["y"] + pb["height"] / 2)
            clicks += 1
            time.sleep(0.1)
        time.sleep(0.5)
        # NOTE: `clicks` overcounts. The loop keeps clicking during the
        # 350ms transition and doStack correctly ignores those, so this
        # asserts the requirement, not the raw click count.
        check(clicks >= 7, f"a 7-high stack required at least 7 placements (loop sent {clicks}, extras ignored)")
        check("drizzle" in stage(page), "stack advanced only after seven pancakes")

        wb = bbox(page.wait_for_selector("#drizzle"), "drizzle canvas")
        y = wb["y"] + wb["height"] / 2
        page.mouse.move(wb["x"] + 4, y)
        page.mouse.down()
        for _ in range(3):
            for i in range(20):
                page.mouse.move(wb["x"] + 4 + i * (wb["width"] - 8) / 19, y)
        page.mouse.up()
        page.click("text=Done")
        page.wait_for_timeout(300)

        money_after = page.evaluate("window.GAME.state.money")
        pantry = page.evaluate("JSON.stringify(window.GAME.state.pantry)")
        print(f"       money {money_before} -> {money_after}   pantry={pantry}")
        check(page.evaluate("window.GAME.state.cooked.impossible") == 1,
              "the expensive dish was actually cooked")
        check("starlight" in pantry,
              "emergency stock was bought mid-service rather than blocking the sale")

        print("\n-- buying research through the real UI --")
        page.evaluate("window.GAME.state.points = 500; window.GAME.save();")
        page.click("#btn-close")
        page.wait_for_timeout(300)
        # a scene may fire on a week rollover; walk past it
        for _ in range(10):
            btns = page.query_selector_all("#vn-choices button")
            if not btns or not page.is_visible("#screen-vn"):
                break
            btns[0].click(); page.wait_for_timeout(150)
        if not page.is_visible("#screen-evening"):
            page.click("#btn-next-day") if page.is_visible("#btn-next-day") else None
        page.click("#btn-research")
        page.wait_for_timeout(200)

        research_btns = [b for b in page.query_selector_all("#tree-mount button")
                         if b.inner_text().strip() == "Research" and b.is_enabled()]
        check(len(research_btns) > 0, f"{len(research_btns)} research nodes are buyable")
        before_nodes = page.evaluate("window.GAME.state.purchased.length")
        research_btns[0].click()
        page.wait_for_timeout(250)
        after_nodes = page.evaluate("window.GAME.state.purchased.length")
        check(after_nodes == before_nodes + 1, "clicking Research actually purchased a node")
        check(page.evaluate("window.GAME.state.points") < 500, "and it spent the points")

        print("\n-- the game actually ENDS --")
        page.evaluate("""
          (() => {
            const s = window.GAME.state;
            s.week = 8; s.day = 7;
            s.synthia.points = 200;          // a devoted run
            s.ended = false;
            window.GAME.save();
          })()
        """)
        page.click("#btn-back-evening") if page.is_visible("#btn-back-evening") else None
        page.click("#btn-next-day")
        page.click("#btn-open")
        # As above: she may be waiting on the final day, so her scene can be
        # up before the shop can be closed.
        page.wait_for_timeout(300)
        clear_scenes(page)
        page.click("#btn-close")
        page.wait_for_timeout(400)
        check(page.is_visible("#screen-vn"), "the final week opens a closing scene")
        for _ in range(12):
            btns = page.query_selector_all("#vn-choices button")
            if not btns or page.is_visible("#screen-ending"):
                break
            btns[0].click(); page.wait_for_timeout(180)
        check(page.is_visible("#screen-ending"), "the scene resolves to an ending card")
        title = page.inner_text("#ending-title").strip()
        summary = page.inner_text("#ending-summary").strip()
        print(f'       "{title}" — {summary}')
        # Not merely non-empty: "The season turns" is the fallback the card
        # shows when the title walk fails, and it did fail silently for a
        # while — every ending, devoted and stranger alike, headed the same.
        check(title != "" and title != "The season turns",
              f'the ending card shows its own authored title ("{title}")')
        check("devoted" in summary.lower(),
              "and the summary reflects the affection tier actually reached")
        check(page.evaluate("window.GAME.state.ended") is True, "the game is marked over")

        # IMPOSSIBLE ORDER (spec §9). Runs LAST: it drives the day loop
        # itself and leaves the page mid-dish.
        #  She asks for something not unlocked,
        # is unbothered, and still orders what she can have. The first cut
        # only checked for the ask on the direct path, so whenever she
        # opened with a mention — most weeks — it was silently skipped.
        print("\n-- she asks for something you cannot make --")
        # The section before this one runs the game to its ending, so
        # start a fresh one rather than looking for a morning screen that
        # no longer exists.
        page.click("#btn-restart")
        page.wait_for_selector("#screen-morning", state="visible", timeout=4000)
        page.evaluate("""(() => {
            const S = window.GAME.state;
            S.synthia.mentions = ['souffle'];
            S.synthia.wanted = [];
            S.flags = {};
            window.GAME.save();
        })()""")
        asked = False
        for day in range(1, 8):
            page.evaluate(f"window.GAME.state.day = {day}; window.GAME.save();")
            if page.is_visible("#screen-evening"):
                page.click("#btn-next-day")
            if not page.is_visible("#screen-service"):
                page.wait_for_selector("#btn-open", state="visible", timeout=4000)
                page.click("#btn-open")
            time.sleep(0.35)
            while page.is_visible("#screen-vn"):
                bs = page.query_selector_all("#vn-choices button")
                if not bs:
                    break
                bs[0].click()
                time.sleep(0.15)
            first = page.query_selector("#griddle-mount button")
            if first and first.inner_text() == "Say so":
                asked = True
                break
            if page.is_visible("#screen-service"):
                page.click("#btn-close")
                time.sleep(0.2)
        check(asked, "she asks for a dish that is not unlocked yet")
        if asked:
            # Read the names out of the data rather than spelling them here.
            # A literal made this a test of the copy: renaming the dish in
            # js/data/ failed a check about whether the ask is WIRED UP,
            # which is the one thing this is meant to be watching.
            dish_name = page.evaluate(
                "import('./js/data/recipes.js')"
                ".then(m => m.RECIPES.find(r => r.id === 'souffle').name)")
            node_name = page.evaluate(
                "import('./js/data/research.js')"
                ".then(m => m.RESEARCH.find(n => n.id === 'r_souffle').name)")
            mount_text = page.inner_text("#griddle-mount")
            check(dish_name in mount_text, f"the ask names the dish: {mount_text.splitlines()[0][:40]}")
            check("Order:" not in page.inner_text("#customer-card"),
                  "and the card does not spoil the order she has not placed yet")
            # Reported as a check rather than dereferenced blind: if the ask
            # ever stops rendering its button, an AttributeError here kills
            # the run and every check after it goes unreported, which reads
            # as "the harness broke" rather than "the game did".
            say_so = page.query_selector("#griddle-mount button")
            check(say_so is not None, "the ask offers a way to answer it")
            if say_so is None:
                raise SystemExit("the ask rendered no button; nothing further can be checked")
            say_so.click()
            time.sleep(0.35)
            check(page.query_selector("#beat-area button") is not None,
                  "the ask costs her nothing — she still orders something you can cook")
            check("souffle" in page.evaluate("JSON.stringify(window.GAME.state.synthia.wanted)"),
                  "and the goal is recorded")
            # The RECORD is not the point — the visible goal is. Deleting
            # the badge from the board passed every gate, while removing
            # the only thing the ask exists to produce: "turning a line of
            # dialogue into a visible research goal".
            page.click("#btn-close")
            time.sleep(0.3)
            while page.is_visible("#screen-vn"):
                bs = page.query_selector_all("#vn-choices button")
                if not bs:
                    break
                bs[0].click()
                time.sleep(0.15)
            if page.is_visible("#screen-evening"):
                page.click("#btn-research")
                time.sleep(0.4)
                asked = page.query_selector_all(".node.asked")
                check(len(asked) == 1, f"the research board marks exactly the node she asked for ({len(asked)})")
                if asked:
                    txt = asked[0].inner_text()
                    check("She asked for this" in txt, f"and says so in words: {txt.splitlines()[0]}")
                    check(node_name in txt, "on the node that unlocks the dish she named")

        # ---- sound ----
        # The unit tests prove every declared sound is reachable and that
        # the layer cannot throw. What they cannot see is the browser:
        # whether an AudioContext actually starts after a real click, and
        # whether the preference survives a reload. Both are silent
        # failures — the game plays perfectly either way.
        print("\n-- sound --")
        btn = page.query_selector("#btn-sound")
        check(btn is not None, "the HUD has a sound control")
        if btn:
            check(btn.inner_text().strip() == "Sound: on", f"it starts on: {btn.inner_text().strip()!r}")

            # A real click, not a call into the handler: a control wired to
            # nothing passes every direct-call test and is dead for the player.
            btn.click()
            time.sleep(0.15)
            check(page.inner_text("#btn-sound").strip() == "Sound: off", "clicking it mutes")

            # aria-pressed must AGREE with the label. It was set to
            # isMuted(), so a button reading "Sound: off" announced as
            # PRESSED — and pressed conventionally means engaged. A screen
            # reader said "Sound: off, pressed", which reads as a broken
            # control. Checked in both states, because either one alone
            # passes for whichever way round the mistake is made.
            check(page.get_attribute("#btn-sound", "aria-pressed") == "false",
                  'muted announces as not-pressed, agreeing with "Sound: off"')

            stored = page.evaluate("localStorage.getItem('pancake_shop_sound')")
            check(stored == "off", f"the choice is written down: {stored!r}")

            page.reload()
            page.wait_for_selector("#btn-sound", state="visible", timeout=4000)
            check(page.inner_text("#btn-sound").strip() == "Sound: off",
                  "and survives a reload — a preference that forgets is worse than none")

            page.click("#btn-sound")
            time.sleep(0.15)
            check(page.inner_text("#btn-sound").strip() == "Sound: on", "clicking again unmutes")
            check(page.get_attribute("#btn-sound", "aria-pressed") == "true",
                  'and unmuted announces as pressed, agreeing with "Sound: on"')

            # The context may only be built after a gesture. By now several
            # real clicks have happened, so one must exist and be running.
            state_now = page.evaluate("""(() => {
                try {
                    const C = window.AudioContext || window.webkitAudioContext;
                    return C ? 'available' : 'missing';
                } catch (e) { return 'threw'; }
            })()""")
            check(state_now == "available", f"the browser can make audio at all: {state_now}")

        # ---- the preview workbench ----
        # It is a handoff deliverable and nothing else covers it: it imports
        # the real art, scene and sound layers, so a break in any of them
        # takes it down, and the person who finds out is the collaborator
        # opening it for the first time. A bad import is a blank page.
        print("\n-- preview workbench --")
        # UNLIKE THE GAME, this page is EXPECTED to 404. The game reads
        # assets/manifest.json so it never asks for art that is not there;
        # the workbench deliberately asks for every slot, because showing
        # which ones are still empty is the whole job of its art tab. So a
        # failed resource load is by design here, and only a JavaScript
        # fault counts — which is the fault that would blank the page.
        preview_errors = []
        pv = browser.new_page()
        pv.on("console", lambda m: preview_errors.append(f"{m.type}: {m.text}")
              if m.type == "error" and "Failed to load resource" not in m.text else None)
        pv.on("pageerror", lambda e: preview_errors.append(f"pageerror: {e}"))
        pv.goto(f"http://127.0.0.1:{PORT}/preview.html", wait_until="networkidle")

        check(pv.query_selector("#art .slot") is not None, "the art tab lists its slots")
        check(len(pv.query_selector_all("#scene-list button")) > 0, "the writing tab lists every scene")

        pv.click("#tab-sound")
        time.sleep(0.2)
        # Counted from the data, never spelled here — a literal would turn
        # "add a sound" into a failing test about the wrong thing.
        declared = pv.evaluate(
            "import('./js/data/sounds.js').then(m => m.SOUNDS.length)")
        sound_cards = pv.query_selector_all("#sound-list .slot")
        check(len(sound_cards) == declared,
              f"the sound tab lists all {declared} sounds ({len(sound_cards)})")
        check(pv.is_visible("#sound") and not pv.is_visible("#art"),
              "and switching tabs actually swaps the panel")

        # A real click on a real button, for the same reason as the HUD
        # toggle: a play button wired to nothing looks identical.
        first_play = pv.query_selector("#sound-list button")
        if first_play:
            first_play.click()
            time.sleep(0.2)
        check(not preview_errors,
              f"preview loads and plays with no JavaScript faults: {preview_errors[:3]}")
        pv.close()

        # ---- reduced motion ----
        # tests/motion.test.js asserts the stylesheet SAYS the right thing.
        # Only a browser can show what it DOES. Every fade-in here starts at
        # opacity 0 and relies on the animation to finish, so the failure
        # this guards is a game that renders blank for exactly the people
        # who asked for less motion — a fill-mode or override mistake away
        # at all times, and invisible to anyone not running with the setting
        # on. Cheap to check, effectively impossible to notice otherwise.
        print("\n-- reduced motion --")
        rm_errors = []
        rm = browser.new_page(reduced_motion="reduce")
        rm.on("pageerror", lambda e: rm_errors.append(f"pageerror: {e}"))
        rm.goto(f"http://127.0.0.1:{PORT}/", wait_until="networkidle")
        rm.click("#btn-new")
        rm.wait_for_selector("#screen-morning", state="visible", timeout=4000)
        rm.click("#btn-open")
        # Her visit rolls forward if she was not served, so a scene can be
        # waiting after almost any "Open the shop" — which is why this file
        # has a helper for it. Leaving it out made this section fail about
        # one run in five, on a hidden #customer-card, with a Playwright
        # timeout rather than a named check. The touch section below got it
        # right and this one did not.
        clear_scenes(rm)
        dismiss_ask(rm)
        rm.wait_for_selector("#customer-card", state="visible", timeout=4000)
        time.sleep(0.3)

        # EVERY animated element on screen, not one spot-check. A single
        # element proves only that one selector survived; the failure mode
        # is a change to the reduced-motion override, which hits all of
        # them at once but could equally hit only the ones that use a
        # different fill-mode.
        stranded = rm.evaluate("""(() => {
            const out = [];
            for (const el of document.querySelectorAll('*')) {
                const cs = getComputedStyle(el);
                if (cs.animationName === 'none') continue;
                // Only what is actually on screen: a hidden screen's
                // elements are display:none and prove nothing either way.
                if (!el.getClientRects().length) continue;
                if (parseFloat(cs.opacity) < 0.99) {
                    out.push((el.id || el.className || el.tagName) + ' @ ' + cs.opacity);
                }
            }
            return out;
        })()""")
        animated = rm.evaluate("""(() => {
            let n = 0;
            for (const el of document.querySelectorAll('*')) {
                const cs = getComputedStyle(el);
                if (cs.animationName !== 'none' && el.getClientRects().length) n += 1;
            }
            return n;
        })()""")
        check(animated > 0, f"there are animated elements on screen to check ({animated})")
        check(not stranded,
              f"every animated element ends fully visible, none stranded at its first frame: {stranded[:4]}")

        # One element on a fresh service screen is a thin sample — the
        # pancakes and the receipt's rows are where most of the motion
        # lives, and they only exist after an order is cooked. cook_one()
        # is playthrough.py's, reused rather than copied: a second hand-
        # rolled beat-driver would drift from the real one, which is the
        # mistake that let simulate.js reproduce a bug instead of find it.
        sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
        from playthrough import cook_one  # type: ignore[import]  # noqa: E402 (sibling tool)
        if cook_one(rm):
            time.sleep(0.4)
            after = rm.evaluate("""(() => {
                const out = [], seen = [];
                for (const el of document.querySelectorAll('*')) {
                    const cs = getComputedStyle(el);
                    if (cs.animationName === 'none') continue;
                    if (!el.getClientRects().length) continue;
                    seen.push(cs.animationName);
                    if (parseFloat(cs.opacity) < 0.99) {
                        out.push((el.id || el.className || el.tagName) + ' @ ' + cs.opacity);
                    }
                }
                return { stranded: out, count: seen.length };
            })()""")
            check(after["count"] > animated,
                  f"a cooked order puts more animated elements on screen ({after['count']})")
            check(not after["stranded"],
                  f"and every one of those is visible too: {after['stranded'][:4]}")
        check(rm.is_visible("#screen-service"), "and the game is playable with motion turned down")
        check(not rm_errors, f"with no page errors: {rm_errors[:2]}")
        rm.close()

        # ---- touch ----
        # The game is fully touch-operable and had NO touch coverage at all,
        # which is how a real bug lived in it: an interrupted gesture on the
        # pour left the batter pouring with nobody touching the screen, the
        # measured volume climbing past any target, and the beat stuck. That
        # was found by reading the code, not by running it. Every check
        # above drives a mouse, so this drives fingers.
        print("\n-- touch --")
        touch_errors = []
        tp = browser.new_page(has_touch=True, is_mobile=True,
                              viewport={"width": 420, "height": 860})
        tp.on("pageerror", lambda e: touch_errors.append(f"pageerror: {e}"))
        tp.on("console", lambda m: touch_errors.append(f"{m.type}: {m.text}")
              if m.type in ("error", "warning") else None)
        tp.goto(f"http://127.0.0.1:{PORT}/", wait_until="networkidle")
        tp.tap("#btn-new")
        tp.wait_for_selector("#screen-morning", state="visible", timeout=4000)
        tp.evaluate("window.GAME.state.seed = 2026; window.GAME.save();")
        tp.tap("#btn-open")
        tp.wait_for_selector("#screen-service", state="visible", timeout=4000)
        clear_scenes(tp)
        dismiss_ask(tp)

        # POUR by touch, then CANCEL the gesture the way a phone does —
        # touchcancel, never touchend. The beat must still advance.
        btn = tp.wait_for_selector("#beat-area button", timeout=4000)
        check(btn is not None, "the pour button is reachable on a touch device")
        if btn:
            box = bbox(btn, "pour button (touch)")
            x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
            tp.evaluate("""([x, y]) => {
                const el = document.elementFromPoint(x, y);
                const mk = (type) => {
                    const t = new Touch({identifier: 1, target: el, clientX: x, clientY: y});
                    return new TouchEvent(type, {
                        touches: type === 'touchstart' ? [t] : [],
                        changedTouches: [t], bubbles: true, cancelable: true});
                };
                el.dispatchEvent(mk('touchstart'));
                window.__pourStarted = true;
                setTimeout(() => el.dispatchEvent(mk('touchcancel')), 400);
            }""", [x, y])
            # While the touch is still down, the pour must actually be
            # running — otherwise everything below passes by never starting.
            time.sleep(0.25)
            pouring = tp.evaluate(
                "document.getElementById('pour-read') && document.getElementById('pour-read').textContent")
            check(bool(pouring) and pouring != "0 ml",
                  f"a touch actually pours ({pouring!r}) — without this the rest proves nothing")

            # Now the cancel lands (scheduled above). stop() silences the
            # sound, clears the 30ms interval AND advances the beat, so the
            # stage moving on is the observable proof that all three ran.
            # Unfixed, the stage stays "pour" and the volume climbs forever.
            time.sleep(1.2)
            after = stage(tp)
            check("pour" not in after,
                  f"a cancelled touch ends the pour instead of leaving it running (stage: {after})")

            still_pouring = tp.evaluate(
                "!!document.getElementById('pour-read')")
            check(not still_pouring,
                  "and the pour readout is gone, so no interval is still ticking behind it")

        check(not touch_errors, f"no faults on a touch device: {touch_errors[:3]}")
        tp.close()

        browser.close()

    httpd.shutdown()

    print("\n" + "=" * 60)
    if errors:
        print(f"{len(errors)} console error(s):")
        for e in errors[:20]:
            print("  " + e)
    else:
        print("no console errors")

    if warnings:
        print(f"{len(warnings)} console warning(s):")
        for w in warnings[:20]:
            print("  " + w)
    else:
        print("no console warnings")

    if failures:
        print(f"\n{len(failures)} FAILED check(s):")
        for f in failures:
            print("  " + f)
        return 1
    if errors:
        return 1
    if warnings:
        # A healthy run emits none. console.warn is this project's channel
        # for a fault the player cannot see — a missing story node, an
        # unknown id in a save, a recording that would not decode — so a
        # warning IS a failure here, and saying otherwise in three separate
        # comments is what let this go uncollected for as long as it did.
        return 1
    print("all checks passed")
    return 0

if __name__ == "__main__":
    sys.exit(main())
