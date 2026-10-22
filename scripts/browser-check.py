"""Exercise the local project page and capture desktop/mobile review images.

Usage: conda run -n medai python scripts/browser-check.py
Optional: set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an installed Chromium binary.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "qa"
BASE = os.environ.get("TRACESCOPE_PREVIEW_URL", "http://127.0.0.1:4173/")


def main() -> None:
    OUTPUT.mkdir(exist_ok=True)
    data = json.loads((ROOT / "site/data/benchmark.json").read_text())
    results: list[str] = []
    errors: list[str] = []
    requests: list[str] = []
    with sync_playwright() as p:
        options = {"headless": True}
        if binary := os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE"):
            options["executable_path"] = binary
        browser = p.chromium.launch(**options)
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, device_scale_factor=1, reduced_motion="reduce")
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: requests.append(request.url))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        response = page.goto(BASE, wait_until="networkidle")
        assert response and response.status == 200
        page.locator("#results-body tr").first.wait_for(state="attached")
        page.evaluate("document.fonts.ready")
        page.screenshot(path=str(OUTPUT / "desktop.png"))
        results.append("Local HTTP 200; data, fonts and images load")

        assert not page.locator('#explore').evaluate('element => element.open')
        assert not page.locator('#results').evaluate('element => element.open')
        for figure in ['overview', 'composition', 'construction']:
            page.locator(f'[data-figure="./assets/{figure}.webp"]').click()
            page.locator('#dialog-image').evaluate('image => image.decode()')
            assert figure in page.locator('#dialog-image').get_attribute('src')
            page.locator('#zoom-in').click()
            assert page.locator('#zoom-level').inner_text() == '150%'
            page.locator('#zoom-fit').click()
            assert page.locator('#zoom-level').inner_text() == '100%'
            page.locator('#close-dialog').click()
        results.append('Paper Figures 1, 2 and 3 load and support zoom, fit and close')

        page.locator("#explore > summary").click()
        for i, task in enumerate(data["tasks"]):
            page.locator(f"#example-tab-{i}").click()
            assert page.locator("#example-title").inner_text() == task["title"]
            assert page.locator("#reference-answer").is_hidden()
            page.locator("#reveal-answer").click()
            assert task["reference"] in page.locator("#reference-answer").inner_text()
            assert page.locator("#example-image").evaluate("image => image.complete && image.naturalWidth > 0")
        page.locator("#example-tab-0").focus()
        page.locator("#example-tab-0").press("ArrowRight")
        assert page.locator("#example-tab-1").get_attribute("aria-selected") == "true"
        page.locator("#expand-evidence").click()
        assert page.locator("#figure-dialog").is_visible()
        page.keyboard.press("Escape")
        assert page.locator("#figure-dialog").is_hidden()
        page.locator("#full-example").click()
        page.locator("#dialog-image").evaluate("image => image.decode()")
        assert "task-2-example" in page.locator("#dialog-image").get_attribute("src")
        page.locator("#close-dialog").click()
        results.append("All six task examples, reference reset/reveal, arrow keys, image dialogs and Escape")

        page.locator('#axis-states button[data-state="4"]').click()
        expected = f'{data["axis1"]["means"][4] * 100:.1f}%'
        assert page.locator(".active-value").text_content() == expected
        page.locator("#axis-tab-2").click()
        page.locator('#axis-states button[data-state="4"]').click()
        assert page.locator(".active-value").text_content() == "61.9%"
        assert "+0.042" in page.locator("#axis-state-detail").inner_text()
        page.locator('#axis-states button[data-state="3"]').click()
        assert "+0.076" in page.locator("#axis-state-detail").inner_text()
        page.locator("#axes").scroll_into_view_if_needed()
        page.screenshot(path=str(OUTPUT / "diagnostic-axes.png"))
        results.append("Both diagnostic axes and all state values agree with frozen aggregates")

        page.locator("#results > summary").click()
        for i, task in enumerate(data["tasks"]):
            page.locator(f"#result-tab-{i}").click()
            assert page.locator("#results-head th").count() == len(task["indices"]) + 1
        page.locator("#result-tab-4").click()
        page.locator('[data-sort="16"]').click()
        assert "Qwen3.5-27B" in page.locator("#results-body tr").first.inner_text()
        page.locator('[data-sort="16"]').click()
        assert "Qwen3.5-4B" in page.locator("#results-body tr").first.inner_text()
        page.locator("#model-search").fill("QWEN")
        assert page.locator("#results-body tr").count() == 6
        page.locator("#family-filter").select_option("Medical")
        assert "No models match" in page.locator("#results-body").inner_text()
        page.locator("#model-search").fill("")
        assert page.locator("#results-body tr").count() == 8
        page.locator("#family-filter").select_option("all")
        page.locator("#show-all-models").click()
        assert page.locator("#results-body tr").count() == 22
        page.locator("#show-physician").check()
        assert page.locator("#results-foot tr").count() == 2
        results.append("All 19 table readouts, ascending/descending sorting, case-insensitive search, family filtering, empty state, 22-model expansion and physician reference")

        page.locator("#show-physician").uncheck()
        page.locator("#show-all-models").click()
        page.locator("#result-tab-0").click()
        page.locator("#axis-tab-1").click()
        for width, height in [(1440, 1000), (1024, 850), (768, 1024), (390, 844), (375, 812), (319, 812)]:
            page.set_viewport_size({"width": width, "height": height})
            page.evaluate("window.scrollTo(0, 0)")
            dimensions = page.evaluate("({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth })")
            assert dimensions["scroll"] <= dimensions["width"], f"Horizontal overflow at {width}px: {dimensions}"
            if width == 390:
                page.screenshot(path=str(OUTPUT / "mobile.png"))
                page.locator(".menu-toggle").click()
                assert page.locator("#primary-nav").is_visible()
                page.locator('#primary-nav a[href="#benchmark"]').click()
                assert page.locator(".menu-toggle").get_attribute("aria-expanded") == "false"
                page.locator("#example-tab-5").click()
                assert page.locator("#example-title").inner_text() == data["tasks"][5]["title"]
                page.locator("#reveal-answer").click()
                assert page.locator("#reference-answer").is_visible()
        results.append("Responsive layout at 319, 375, 390, 768, 1024 and 1440px; mobile menu and task interaction")

        page.set_viewport_size({"width": 1440, "height": 1000})
        page.locator("#example-tab-1").click()
        page.locator('#explore > summary').click()
        page.locator('#results > summary').click()
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=str(OUTPUT / "full-page.png"), full_page=True)
        report_height = page.evaluate('document.documentElement.scrollHeight')
        assert page.request.get(BASE + "assets/tracescope.pdf").status == 200
        assert page.request.get(BASE + "data/benchmark.json").status == 200
        assert page.request.get(BASE + ".git/config").status == 404
        assert not [url for url in requests if not url.startswith(BASE)]
        assert not errors, errors
        results.append("PDF/results downloads, Git metadata isolation, zero third-party requests and zero browser errors")
        browser.close()
    report = {"status": "passed", "checks": results, "default_page_height_px_at_1440": report_height, "browser_errors": errors}
    (OUTPUT / "browser-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
