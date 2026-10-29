"""Exercise the local project page and capture desktop/mobile review images.

Usage: conda run -n medai python scripts/browser-check.py
Optional: set PLAYWRIGHT_CHROMIUM_EXECUTABLE to an installed Chromium binary.
"""
from __future__ import annotations

import json
import os
from itertools import groupby
from pathlib import Path
from statistics import mean

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "qa"
BASE = os.environ.get("TRACESCOPE_PREVIEW_URL", "http://127.0.0.1:4173/")


def main() -> None:
    OUTPUT.mkdir(exist_ok=True)
    data = json.loads((ROOT / "site/data/benchmark.json").read_text())
    ranks = {model["name"]: {} for model in data["models"]}
    for index in range(len(data["metrics"])):
        ordered = sorted(data["models"], key=lambda model: -model["scores"][index])
        for _, group in groupby(enumerate(ordered, 1), key=lambda entry: entry[1]["scores"][index]):
            tied = list(group)
            rank = mean(position for position, _ in tied)
            for _, model in tied:
                ranks[model["name"]][index] = rank
    expected_order = sorted(data["models"], key=lambda model: mean(
        mean(ranks[model["name"]][i] for i in task["indices"] if i not in (15, 18))
        for task in data["tasks"]
    ))
    assert [model["name"] for model in expected_order[:3]] == ["Qwen3.5-27B", "Gemini 3.8 Flash", "Claude Opus 4.7"]
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
        assert page.locator('#results').evaluate('element => element.open')
        assert page.locator('#results').evaluate('element => Boolean(element.compareDocumentPosition(document.querySelector("#axes")) & Node.DOCUMENT_POSITION_FOLLOWING)')
        assert page.locator('#results-tabs').count() == 0
        assert page.locator('#results-head .task-group').count() == 6
        assert page.locator('#results-head .metric-headings th').count() == 19
        assert page.locator('#results-body tr').count() == 22
        assert page.locator('.model-name').all_text_contents() == [model['name'] for model in expected_order]
        for position, model in enumerate(expected_order):
            cells = page.locator('#results-body tr').nth(position).locator('td')
            assert cells.all_text_contents() == [f'{score:.3f}' for score in model['scores']]
        results.append('Main board open by default: all six task groups, 22 models and 418 numerical cells; task-balanced overall order verified independently')
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

        assert page.locator('.evidence-model-trace').count() == 9
        assert page.locator('.evidence-chart-condition').count() == 5
        for state in range(5):
            page.locator(f'#axis-states button[data-state="{state}"]').click()
            expected = f'{data["axis1"]["means"][state] * 100:.1f}%'
            assert page.locator('#axis1-state-mean').inner_text() == expected
            assert page.locator('.evidence-comparison').get_attribute('data-state') == str(state)
            assert page.locator('.evidence-comparison').get_attribute('data-animating') == 'false'
        assert page.locator('#axis1-delta').inner_text() == '−7.6 pp vs selected images'
        for model in data['axis1']['models']:
            page.locator('#evidence-model').select_option(model['id'])
            assert page.locator('.evidence-values b').all_text_contents() == [f'{score * 100:.1f}%' for score in model['scores']]
            assert [float(value) for value in page.locator('.evidence-selected-points circle').evaluate_all('nodes => nodes.map(node => node.dataset.value)')] == model['scores']
        page.locator('[data-chart-state="0"]').focus()
        page.locator('[data-chart-state="0"]').press('ArrowRight')
        assert page.locator('#axis-states button[data-state="1"]').get_attribute('aria-pressed') == 'true'
        page.locator('#axis-states button[data-state="4"]').click()
        page.locator('#axis-play').click()
        expect(page.locator('.evidence-comparison')).to_have_attribute('data-state', '1', timeout=3000)
        page.locator('#axis-play').click()
        assert page.locator('#axis-play').get_attribute('aria-pressed') == 'false'
        page.locator('#axis-states button[data-state="0"]').click()
        page.locator('#evidence-model').select_option('qwen3vl_8b')
        page.set_viewport_size({'width': 1440, 'height': 1100})
        page.locator('#axes').evaluate('element => element.scrollIntoView({block: "start"})')
        page.mouse.move(15, 30)
        page.screenshot(path=str(OUTPUT / 'axis1-evidence.png'))
        page.locator('#evidence-model').select_option('all')
        results.append('Axis 1: five illustrated conditions, all 45 model values and five means, model highlighting, graph keyboard control, mean difference, playback and reduced-motion support')
        page.locator("#axis-tab-2").click()
        assert page.locator('.radar-profile').count() == 5
        assert page.locator('[data-radar-model]').count() == 19
        assert page.locator('.radar-active-point').count() == 19
        assert abs(float(page.locator('.radar-chance').get_attribute('r')) - 85.2) < 1e-8
        for state in range(5):
            page.locator(f'#axis-states button[data-state="{state}"]').click()
            assert page.locator('#axis-state-mean').inner_text() == f'{data["axis2"]["states"][state]["mean_balanced_accuracy"] * 100:.1f}%'
            assert page.locator('.radar').get_attribute('data-animating') == 'false'
            for index, model in enumerate(data['axis2']['roster']):
                point = page.locator('.radar-active-point').nth(index)
                assert float(point.get_attribute('data-value')) == model['scores'][state]
            profile = page.locator(f'.radar-profile[data-profile="{state}"] circle')
            assert [float(value) for value in profile.evaluate_all('nodes => nodes.map(node => node.dataset.value)')] == [model['scores'][state] for model in data['axis2']['roster']]
        for index, model in enumerate(data['axis2']['roster']):
            page.locator('#radar-model').select_option(str(index))
            assert page.locator('.radar-values b').all_text_contents() == [f'{score * 100:.1f}%' for score in model['scores']]
        page.locator('[data-radar-model="0"]').focus()
        page.locator('[data-radar-model="0"]').press('ArrowRight')
        assert page.locator('#radar-model').input_value() == '1'
        page.locator('#axis-states button[data-state="4"]').click()
        assert page.locator("#axis-state-mean").text_content() == "61.9%"
        assert "+0.042" in page.locator("#axis-state-detail").inner_text()
        page.locator('#axis-play').click()
        expect(page.locator('.radar')).to_have_attribute('data-state', '1', timeout=3000)
        page.locator('#axis-play').click()
        assert page.locator('#axis-play').get_attribute('aria-pressed') == 'false'
        page.locator('#axis-states button[data-state="4"]').click()
        page.locator('#axis-play').click()
        expect(page.locator('.radar')).to_have_attribute('data-state', '4', timeout=9000)
        expect(page.locator('#axis-play')).to_have_attribute('aria-pressed', 'false')
        page.locator('#axis-states button[data-state="3"]').click()
        assert "+0.076" in page.locator("#axis-state-detail").inner_text()
        page.locator('#axis-states button[data-state="4"]').click()
        page.locator('#radar-model').select_option('3')
        page.set_viewport_size({'width': 1440, 'height': 1180})
        page.locator('#axes').evaluate('element => element.scrollIntoView({block: "start"})')
        page.mouse.move(15, 30)
        page.screenshot(path=str(OUTPUT / "axis2-radar.png"))
        results.append("Axis 2: all 95 source values, 19 model spokes, five profiles, chance ring, model selection, keyboard interaction, playback/pause/completion and reduced-motion behaviour")

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
        page.locator('#overall-sort').click()
        assert page.locator('.model-name').all_text_contents() == [model['name'] for model in expected_order if model['family'] == 'Medical']
        page.locator("#family-filter").select_option("all")
        assert page.locator("#results-body tr").count() == 22
        assert page.locator('.model-name').all_text_contents() == [model['name'] for model in expected_order]
        assert page.locator('#overall-sort').get_attribute('aria-pressed') == 'true'
        page.locator("#show-physician").check()
        assert page.locator("#results-foot tr").count() == 2
        results.append("Ascending/descending metric sorting, overall-order reset, case-insensitive search, stable family filtering, empty state and physician reference")

        page.locator("#show-physician").uncheck()
        page.locator("#axis-tab-1").click()
        page.locator('.table-scroll').evaluate('element => element.scrollLeft = 0')
        page.locator('.board-toolbar > p').click()
        page.locator('#results').evaluate('element => element.scrollIntoView({block: "start"})')
        page.screenshot(path=str(OUTPUT / 'main-board.png'))
        page.set_viewport_size({'width': 1760, 'height': 1000})
        page.locator('#results').evaluate('element => element.scrollIntoView({block: "start"})')
        page.screenshot(path=str(OUTPUT / 'main-board-wide.png'))
        for width, height in [(1440, 1000), (1024, 850), (768, 1024), (390, 844), (375, 812), (319, 812)]:
            page.set_viewport_size({"width": width, "height": height})
            page.evaluate("window.scrollTo(0, 0)")
            dimensions = page.evaluate("({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth })")
            assert dimensions["scroll"] <= dimensions["width"], f"Horizontal overflow at {width}px: {dimensions}"
            frozen = page.locator('#results-body th').first.bounding_box()['x']
            page.locator('.table-scroll').evaluate('element => element.scrollLeft = element.scrollWidth')
            assert abs(page.locator('#results-body th').first.bounding_box()['x'] - frozen) < 1
            assert page.locator('.model-name').first.is_visible()
            page.locator('.table-scroll').evaluate('element => element.scrollLeft = 0')
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
                page.locator('#axis-tab-2').click()
                assert page.locator('.radar svg').get_attribute('viewBox') == '100 34 560 560'
                assert page.locator('.radar-spoke-number').first.is_visible()
                assert page.locator('.radar-model-label').first.is_hidden()
                page.locator('#radar-model').select_option('3')
                page.locator('#axis-panel').evaluate('element => element.scrollIntoView({block: "start"})')
                page.screenshot(path=str(OUTPUT / 'axis2-radar-mobile.png'))
                page.locator('#axis-tab-1').click()
                page.locator('#evidence-model').select_option('qwen3vl_8b')
                assert page.locator('.evidence-values b').all_text_contents() == [f'{score * 100:.1f}%' for score in data['axis1']['models'][1]['scores']]
                page.locator('.axis-chart-wrap').evaluate('element => element.scrollIntoView({block: "start"})')
                page.screenshot(path=str(OUTPUT / 'axis1-evidence-mobile.png'))
        results.append("Responsive layout at 319, 375, 390, 768, 1024 and 1440px; frozen model column under horizontal scrolling, mobile menu and task interaction")

        page.set_viewport_size({"width": 1440, "height": 1000})
        page.locator("#example-tab-1").click()
        page.locator('#explore > summary').click()
        assert page.locator('#results').evaluate('element => element.open')
        page.evaluate("window.scrollTo(0, 0)")
        page.screenshot(path=str(OUTPUT / "full-page.png"), full_page=True)
        report_height = page.evaluate('document.documentElement.scrollHeight')
        assert page.request.get(BASE + "assets/tracescope.pdf").status == 404
        assert page.request.get(BASE + "data/benchmark.json").status == 200
        assert page.request.get(BASE + ".git/config").status == 404
        assert not [url for url in requests if not url.startswith(BASE)]
        motion_page = context.new_page()
        motion_page.on('pageerror', lambda error: errors.append(str(error)))
        motion_page.emulate_media(reduced_motion='no-preference')
        motion_page.goto(BASE + '#axes', wait_until='networkidle')
        initial_focus = motion_page.locator('.evidence-focus').get_attribute('transform')
        motion_page.locator('#axis-states button[data-state="4"]').click()
        motion_page.wait_for_function('(initial) => document.querySelector(".evidence-comparison").dataset.animating === "true" && document.querySelector(".evidence-focus").getAttribute("transform") !== initial', arg=initial_focus)
        motion_page.emulate_media(reduced_motion='reduce')
        expect(motion_page.locator('.evidence-comparison')).to_have_attribute('data-animating', 'false')
        motion_page.emulate_media(reduced_motion='no-preference')
        motion_page.locator('#axis-tab-2').click()
        expect(motion_page.locator('.radar')).to_have_attribute('data-animating', 'true')
        expect(motion_page.locator('.radar')).to_have_attribute('data-animating', 'false', timeout=2000)
        initial = motion_page.locator('.radar-active').get_attribute('points')
        motion_page.locator('#axis-states button[data-state="0"]').click()
        motion_page.wait_for_function('(initial) => document.querySelector(".radar").dataset.animating === "true" && document.querySelector(".radar-active").getAttribute("points") !== initial', arg=initial)
        motion_page.emulate_media(reduced_motion='reduce')
        expect(motion_page.locator('.radar')).to_have_attribute('data-animating', 'false')
        motion_page.locator('#axis-play').click()
        motion_page.locator('#axis-tab-1').click()
        assert motion_page.locator('.radar').count() == 0
        assert motion_page.locator('#axis-play').get_attribute('aria-pressed') == 'false'
        motion_page.close()
        results.append('Real Axis 1 focus movement and Axis 2 polygon interpolation verified; changing motion preference finishes transitions, and switching axes cancels playback')
        assert not errors, errors
        results.append("PDF/results downloads, Git metadata isolation, zero third-party requests and zero browser errors")
        browser.close()
    report = {"status": "passed", "checks": results, "default_page_height_px_at_1440": report_height, "browser_errors": errors}
    (OUTPUT / "browser-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
