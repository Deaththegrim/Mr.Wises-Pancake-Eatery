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

def main():
    from playwright.sync_api import sync_playwright

    httpd = serve()
    failures, errors = [], []

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

        # The customer must actually SAY something. Their happy and
        # disappointed lines existed in the data from the start and the
        # game rendered neither, so the shop never reacted to the cooking.
        notice = page.inner_text("#notice")
        check("\u201c" in notice and "\u201d" in notice,
              f"the customer reacts in their own words: {notice[:70]}")
        check("Maple Syrup" in notice or "Glaze" in notice or "Ash" in notice,
              "and the result names the syrup that was poured")
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
        check(title != "", "the ending has a title")
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
            mount_text = page.inner_text("#griddle-mount")
            check("Souffle" in mount_text, f"the ask names the dish: {mount_text.splitlines()[0][:40]}")
            check("Order:" not in page.inner_text("#customer-card"),
                  "and the card does not spoil the order she has not placed yet")
            page.query_selector("#griddle-mount button").click()
            time.sleep(0.35)
            check(page.query_selector("#beat-area button") is not None,
                  "the ask costs her nothing — she still orders something you can cook")
            check("souffle" in page.evaluate("JSON.stringify(window.GAME.state.synthia.wanted)"),
                  "and the goal is recorded for the research board")


        browser.close()

    httpd.shutdown()

    print("\n" + "=" * 60)
    if errors:
        print(f"{len(errors)} console error(s):")
        for e in errors[:20]:
            print("  " + e)
    else:
        print("no console errors")

    if failures:
        print(f"\n{len(failures)} FAILED check(s):")
        for f in failures:
            print("  " + f)
        return 1
    if errors:
        return 1
    print("all checks passed")
    return 0

if __name__ == "__main__":
    sys.exit(main())
