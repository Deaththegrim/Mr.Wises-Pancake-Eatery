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

        print("\n-- service: cook one dish through all four beats --")
        page.click("#btn-open")
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
