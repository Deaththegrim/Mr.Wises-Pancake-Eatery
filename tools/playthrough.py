#!/usr/bin/env python3
"""Play the REAL game in a browser for N in-game weeks, then check the
engine simulator agrees with it.

    python3 tools/playthrough.py [weeks]        # default 2

WHY THIS EXISTS
---------------
`tools/simulate.js` drives the engine directly. That makes it fast enough
to run a full eight weeks, but it can only be as correct as its imitation
of `js/main.js` — and for most of this project's life it was not correct.
It called serve() without ever passing `forSynthia`, exactly like the
broken UI did, so it faithfully REPRODUCED the bug instead of exposing it:
Synthia never counted as a customer, the listening beat never fired, and
the simulation reported her stuck at REGULAR forever.

A simulator that shares the UI's blind spots is worse than no simulator,
because it manufactures confidence in a broken game.

So this plays the actual page — real DOM, real main.js, real scene wiring
— for a few weeks, and asserts the things the engine sim would have to
have gotten right. It is slow, which is why it runs short. Its job is not
to replace the simulator but to CATCH THE SIMULATOR LYING.

Run it after changing anything about how a turn is driven.
"""

import sys, time, http.server, socketserver, threading, functools, pathlib, subprocess, json

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = 8355
WEEKS = int(sys.argv[1]) if len(sys.argv) > 1 else 2
SEED = 2026


def serve_dir():
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(ROOT))
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


def bbox(handle, what):
    assert handle is not None, f"missing element: {what}"
    box = handle.bounding_box()
    assert box is not None, f"element has no box: {what}"
    return box


def cook_one(page):
    """Drive all four beats through the real DOM. Returns False if the
    griddle never appeared (nobody waiting)."""
    try:
        page.wait_for_selector("#beat-area button", timeout=3000)
    except Exception:
        return False

    # 1. pour — hold
    box = bbox(page.query_selector("#beat-area button"), "pour button")
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    page.mouse.down(); time.sleep(0.55); page.mouse.up()

    # 2. flip — wait toward the peak, then click
    time.sleep(2.1)
    btn = page.query_selector("#beat-area button")
    if btn:
        btn.click()

    # 3. stack — click the plate until it advances
    try:
        plate = page.wait_for_selector("#plate", timeout=2000)
    except Exception:
        return True
    pb = bbox(plate, "plate")
    for _ in range(12):
        if not page.query_selector("#plate"):
            break
        page.mouse.click(pb["x"] + pb["width"] / 2, pb["y"] + pb["height"] / 2)
        time.sleep(0.06)
    time.sleep(0.4)

    # 4. drizzle — drag across
    try:
        wrap = page.wait_for_selector("#drizzle", timeout=2000)
    except Exception:
        return True
    wb = bbox(wrap, "drizzle")
    y = wb["y"] + wb["height"] / 2
    page.mouse.move(wb["x"] + 4, y)
    page.mouse.down()
    for _ in range(2):
        for i in range(16):
            page.mouse.move(wb["x"] + 4 + i * (wb["width"] - 8) / 15, y)
    page.mouse.up()
    done = page.query_selector("text=Done")
    if done:
        done.click()
    time.sleep(0.15)
    return True


def clear_scenes(page):
    """Walk through any VN scene that has opened."""
    for _ in range(14):
        if not page.is_visible("#screen-vn"):
            return
        btns = page.query_selector_all("#vn-choices button")
        if not btns:
            return
        btns[0].click()
        time.sleep(0.12)


def main():
    from playwright.sync_api import sync_playwright

    httpd = serve_dir()
    errors, failures = [], []

    def check(cond, label):
        print(("  ok   " if cond else "  FAIL ") + label)
        if not cond:
            failures.append(label)

    print(f"Playing {WEEKS} in-game week(s) through the real page. This is slow on purpose.\n")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.on("console", lambda m: errors.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.goto(f"http://127.0.0.1:{PORT}/", wait_until="networkidle")

        page.click("#btn-new")
        page.evaluate(f"window.GAME.state.seed = {SEED}; window.GAME.save();")

        synthia_seen = 0
        days = 0
        for week in range(WEEKS):
            for _day in range(7):
                if page.is_visible("#screen-ending"):
                    break
                if not page.is_visible("#screen-morning"):
                    clear_scenes(page)
                if page.is_visible("#screen-evening"):
                    page.click("#btn-next-day")
                page.wait_for_selector("#btn-open", state="visible", timeout=4000)
                page.click("#btn-open")

                for _ in range(40):
                    card = page.inner_text("#customer-card")
                    if "God Synthia" in card:
                        synthia_seen += 1
                    if page.is_visible("#screen-vn"):
                        clear_scenes(page)
                        continue
                    if "Nobody right now" in card or "everyone for today" in card:
                        break
                    if not cook_one(page):
                        break
                    clear_scenes(page)
                    if not page.is_visible("#screen-service"):
                        break

                if page.is_visible("#screen-service"):
                    page.click("#btn-close")
                time.sleep(0.2)
                clear_scenes(page)
                days += 1
            print(f"  ...week {week + 1} played")

        state = json.loads(page.evaluate("JSON.stringify(window.GAME.state)"))
        browser.close()

    httpd.shutdown()

    cooked = sum(state["cooked"].values())
    aff = state["synthia"]["points"]
    reasons = {}
    for g in state["synthia"]["log"]:
        key = g["reason"].split(",")[0]
        reasons[key] = reasons.get(key, 0) + 1

    print(f"\nAfter {days} played days:")
    print(f"  pancakes cooked ...... {cooked}")
    print(f"  money ................ {state['money']}")
    print(f"  reputation ........... {state['reputation']:.1f}")
    print(f"  affection ............ {aff}")
    print(f"  synthia sightings .... {synthia_seen}")
    print(f"  grant reasons ........ {reasons}\n")

    check(cooked > 0, "the real page actually cooked pancakes")
    check(state["money"] > 0, "and took money for them")
    check(state["reputation"] > 0, "and built reputation")

    # THE CHECK THAT WOULD HAVE CAUGHT THE BUG.
    # In the broken build the ONLY grant reason was 'you kept the shop open'.
    check(any("served her" in r for r in reasons),
          "Synthia was SERVED as a customer, not just seen in cutscenes")
    check(len(reasons) > 1,
          f"affection accrues from more than one source (found: {list(reasons)})")

    # Cross-check the engine simulator against the real page.
    sim = subprocess.run(["node", "-e", f"""
      import('./tools/simulate.js').then(({{ simulate }}) => {{
        const rows = simulate({SEED}, 'careful');
        console.log(JSON.stringify(rows.slice(0, {WEEKS}).map(r => ({{
          week: r.week, met: r.met, tier: r.tier, affection: r.affection
        }}))));
      }});
    """], cwd=ROOT, capture_output=True, text=True)
    try:
        sim_rows = json.loads(sim.stdout.strip().splitlines()[-1])
    except Exception:
        sim_rows = []

    if sim_rows:
        sim_aff = sim_rows[-1]["affection"]
        print(f"  engine simulator, same seed, week {sim_rows[-1]['week']}: "
              f"affection {sim_aff}, tier {sim_rows[-1]['tier']}")
        # Both must show the arc MOVING. Exact numbers differ because the
        # browser's execution quality is not the simulator's profile.
        check(sim_aff > 0 and aff > 0,
              "simulator and real page agree the affection arc is alive")
        check((sim_aff > 4) == (aff > 4),
              "they agree on whether it is progressing past a trickle")
    else:
        check(False, "could not run the engine simulator to compare")

    print("\n" + "=" * 60)
    if errors:
        print(f"{len(errors)} console error(s):")
        for e in errors[:10]:
            print("  " + e)
    else:
        print("no console errors")

    if failures or errors:
        print(f"\n{len(failures)} failed check(s)")
        for f in failures:
            print("  " + f)
        return 1
    print("real-page playthrough agrees with the simulator")
    return 0


if __name__ == "__main__":
    sys.exit(main())
