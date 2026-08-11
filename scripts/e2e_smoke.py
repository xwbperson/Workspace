import json
import os
from pathlib import Path

from playwright.sync_api import Browser, Page, sync_playwright


BASE_URL = "http://127.0.0.1:5173"
PASSWORD = os.environ["WORKBENCH_TEST_PASSWORD"]
OUTPUT = Path("test-results/e2e")


def attach_failure_collectors(page: Page, failures: list[str]) -> None:
    page.on("pageerror", lambda error: failures.append(f"pageerror: {error}"))

    def collect_console(message) -> None:
        if message.type != "error":
            return
        if "status of 401 (Unauthorized)" in message.text:
            return
        failures.append(f"console error: {message.text}")

    page.on(
        "console",
        collect_console,
    )
    page.on(
        "response",
        lambda response: failures.append(f"HTTP {response.status}: {response.url}")
        if response.status >= 500
        else None,
    )


def login(page: Page) -> None:
    page.goto(BASE_URL, wait_until="networkidle")
    page.get_by_label("密码", exact=True).fill(PASSWORD)
    page.get_by_role("button", name="登录工作台").click()
    page.get_by_role("heading", name="离现在最近的一件事").wait_for()


def assert_no_horizontal_overflow(page: Page) -> None:
    dimensions = page.evaluate(
        """() => ({ width: window.innerWidth, scrollWidth: document.documentElement.scrollWidth })"""
    )
    assert dimensions["scrollWidth"] <= dimensions["width"] + 1, dimensions


def desktop_flow(browser: Browser, failures: list[str]) -> None:
    context = browser.new_context(
        viewport={"width": 1440, "height": 1000},
        device_scale_factor=1,
        locale="zh-CN",
    )
    page = context.new_page()
    attach_failure_collectors(page, failures)
    login(page)

    assert page.locator(".sidebar").is_visible()
    desktop_sidebar = page.locator(".sidebar").bounding_box()
    assert desktop_sidebar is not None and desktop_sidebar["width"] >= 220, desktop_sidebar
    assert not page.locator(".bottom-nav").is_visible()
    assert_no_horizontal_overflow(page)

    page.get_by_role("link", name="功能", exact=True).first.click()
    page.get_by_role("heading", name="工作台功能目录").wait_for()
    assert page.get_by_text("1 个可见功能").is_visible()
    page.get_by_role("link", name="打开倒计时").first.click()
    page.get_by_role("button", name="添加倒计时").first.click()
    page.get_by_label("名称", exact=True).fill("浏览器验收节点")
    page.get_by_label("备注", exact=True).fill("用于验证总览、搜索与多端布局")
    page.get_by_role("button", name="添加倒计时").last.click()
    page.get_by_role("heading", name="浏览器验收节点").wait_for()

    page.get_by_role("link", name="总览", exact=True).first.click()
    page.get_by_text("浏览器验收节点").first.wait_for()
    page.get_by_role("button", name="搜索工作台").click()
    search = page.get_by_placeholder("输入功能名称、倒计时标题或备注")
    search.fill("浏览器验收节点")
    page.get_by_text("功能公开结果").wait_for()
    page.get_by_text("浏览器验收节点").first.wait_for()

    page.reload(wait_until="networkidle")
    assert "/login" not in page.url
    page.get_by_role("link", name="总览", exact=True).first.click()
    page.get_by_text("浏览器验收节点").first.wait_for()
    assert_no_horizontal_overflow(page)
    page.screenshot(path=str(OUTPUT / "desktop-overview.png"))
    context.close()


def mobile_flow(browser: Browser, failures: list[str]) -> None:
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        locale="zh-CN",
        user_agent=(
            "Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36"
        ),
        is_mobile=True,
        has_touch=True,
        device_scale_factor=1,
    )
    page = context.new_page()
    attach_failure_collectors(page, failures)
    login(page)

    assert page.locator(".bottom-nav").is_visible()
    sidebar_box = page.locator(".sidebar").bounding_box()
    assert sidebar_box is not None and sidebar_box["x"] + sidebar_box["width"] <= 1, sidebar_box
    assert_no_horizontal_overflow(page)
    page.get_by_role("link", name="功能", exact=True).last.click()
    page.get_by_role("heading", name="工作台功能目录").wait_for()
    page.get_by_role("link", name="打开倒计时").first.click()
    page.get_by_text("浏览器验收节点").first.wait_for()
    assert_no_horizontal_overflow(page)
    page.screenshot(path=str(OUTPUT / "android-countdowns.png"))
    context.close()


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    failures: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="msedge", headless=True)
        try:
            desktop_flow(browser, failures)
            mobile_flow(browser, failures)
        finally:
            browser.close()
    if failures:
        raise AssertionError("\n".join(failures))
    print(
        json.dumps(
            {
                "status": "VERIFIED",
                "desktop": "login, countdown, overview, search, persistent session",
                "android": "login, bottom navigation, countdown list",
                "horizontalOverflow": False,
                "consoleErrors": 0,
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
