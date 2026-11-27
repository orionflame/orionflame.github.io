"""Direct offline-file and public preview smoke tests using synthetic data only."""
import argparse
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
UI = ROOT / "classic-chat"
PREVIEW = "https://raw.githack.com/orionflame/orionflame.github.io/classic-chat-backup-20261127/classic-chat/"
ASSETS = {"index.html": "text/html", "archive.js": "javascript", "app.js": "javascript", "styles.css": "text/css"}
SAMPLE = "Offline archive 雪🙂 <script>synthetic</script>"
ARCHIVE = {"version": 1, "activeId": "fixture", "chats": [
    {"id": "fixture", "title": "Synthetic fixture", "messages": [
        {"id": "m1", "role": "user", "content": SAMPLE, "status": "done"}]}]}


def import_archive(page):
    page.locator("#import-file").set_input_files({
        "name": "fixture.json", "mimeType": "application/json",
        "buffer": json.dumps(ARCHIVE, ensure_ascii=False).encode("utf-8"),
    })
    page.locator("#notice").filter(has_text="Imported 1 chat(s)").wait_for(timeout=5000)
    assert page.locator(".bubble").text_content() == SAMPLE
    assert page.locator(".bubble script").count() == 0


def export_archive(page):
    with page.expect_download(timeout=5000) as download:
        page.locator("#export").click()
    result = json.loads(Path(download.value.path()).read_text(encoding="utf-8"))
    assert result["version"] == 1
    assert result["chats"] == ARCHIVE["chats"]


def check_offline_ui(page):
    page.locator("#connection-label").filter(has_text="Offline backup").wait_for(timeout=5000)
    assert not page.locator("#pair-controls").is_visible()
    assert page.locator("#model").is_disabled()


def direct_file(browser):
    context = browser.new_context(accept_downloads=True)
    attempts, errors = [], []
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))

    def block(route):
        attempts.append(route.request.url)
        route.abort()

    context.route("http://**/*", block)
    context.route("https://**/*", block)
    page.goto((UI / "index.html").as_uri(), wait_until="load")
    check_offline_ui(page)
    import_archive(page)
    export_archive(page)
    storage = page.locator("#storage-status").text_content()
    if "Saved in this browser only" in storage:
        page.reload(wait_until="load")
        assert page.locator(".bubble").text_content() == SAMPLE
        export_archive(page)
        print("PASS direct file: persistent history after reload")
    else:
        assert any(text in storage for text in (
            "Memory only", "Original storage is preserved", "Browser storage unavailable"))
        print("PASS direct file: storage restriction explicitly reported")
    assert not errors, errors
    assert not attempts, "Unexpected HTTP request from direct file"
    context.close()
    print("PASS direct file: real file URL, offline UI, Unicode import/export, literal text, no network")


def public_preview(browser):
    # Dedicated disposable browser context. Never load credentials or user data.
    # Fetch only the four public static files. Before executing a response,
    # compare its UTF-8 source with the checked-out branch; fail closed otherwise.
    context = browser.new_context(accept_downloads=True)
    page = context.new_page()
    seen, unexpected, failures, errors = set(), [], [], []
    page.on("pageerror", lambda error: errors.append(str(error)))

    def normalize(data):
        return data.decode("utf-8").replace("\r\n", "\n")

    def verify_resource(route):
        url = route.request.url
        name = url.removeprefix(PREVIEW)
        if url != PREVIEW + name or name not in ASSETS:
            unexpected.append(url)
            route.abort()
            return
        try:
            response = route.fetch(max_redirects=0, timeout=15000)
            assert response.status == 200, f"{name}: HTTP {response.status}"
            assert response.url == url, f"{name}: unexpected final URL"
            assert ASSETS[name] in response.headers.get("content-type", "").lower(), f"{name}: wrong MIME type"
            assert normalize(response.body()) == normalize((UI / name).read_bytes()), f"{name}: source differs"
            seen.add(name)
            route.fulfill(response=response)
        except Exception as error:
            failures.append(f"{name}: {type(error).__name__}")
            route.abort()

    context.route("**/*", verify_resource)
    try:
        page.goto(PREVIEW + "index.html", wait_until="load", timeout=45000)
        check_offline_ui(page)
        assert "Memory only" in page.locator("#storage-status").text_content()
        import_archive(page)
        export_archive(page)
        page.reload(wait_until="load", timeout=45000)
        assert page.locator(".chat-item").count() == 0
        assert page.evaluate('localStorage.getItem("classic-chat-ui-v1")') is None
        assert page.evaluate('sessionStorage.getItem("classic-chat-pair-v1")') is None
        assert seen == set(ASSETS), seen
        assert not errors, errors
        assert not unexpected, "Unexpected network request from public preview"
        assert not failures, failures
    finally:
        context.close()
        if failures:
            print("PREVIEW RESOURCE CHECK FAILED:", ", ".join(failures))
    print("PASS actual public preview: exact static source, correct MIME, rendered UI, memory-only import/export")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("file", "preview"))
    args = parser.parse_args()
    executable = os.environ.get("CHROMIUM_PATH")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, **({"executable_path": executable} if executable else {}))
        try:
            (direct_file if args.mode == "file" else public_preview)(browser)
        finally:
            browser.close()
