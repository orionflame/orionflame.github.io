"""Chromium regression tests with synthetic data only; no live account or external requests.
Run from any directory: python tools/classic-chat-bridge/test/browser_offline.py
Requires Python Playwright and its installed Chromium; CHROMIUM_PATH can select another installation.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[3]
UI = ROOT / 'classic-chat'
STORE = 'classic-chat-ui-v1'

def message(mid, content, status='done', role='user'):
    return dict(id=mid, role=role, content=content, status=status)

def conversation(cid, messages):
    return dict(id=cid, title=cid, messages=messages)

def payload(chats):
    return json.dumps(dict(version=1, chats=chats), ensure_ascii=False).encode()

def import_file(page, data):
    page.locator('#import-file').set_input_files(dict(name='synthetic.json', mimeType='application/json', buffer=data))

def check(page, selector, text):
    page.locator(selector).filter(has_text=text).wait_for(state='visible', timeout=5000)

def serve_ui(route):
    path = route.request.url.split('?', 1)[0].rsplit('/', 1)[-1] or 'index.html'
    types = {'index.html':'text/html', 'styles.css':'text/css', 'app.js':'text/javascript', 'archive.js':'text/javascript'}
    if path not in types:
        route.abort()
        return
    route.fulfill(status=200, content_type=types[path], body=(UI/path).read_bytes())

with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_PATH')
    browser = p.chromium.launch(headless=True, **({'executable_path':executable} if executable else {}))
    # The loopback-origin fixture uses real Chromium localStorage and downloads.
    ctx = browser.new_context(accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.route('**/*', serve_ui)
    page.goto('http://127.0.0.1:17879/')
    check(page, '#connection-label', 'Local bridge offline')
    long_text = '雪🙂' * 15000
    original = [conversation('local', [message('m'+str(i), 'old' if i < 70 else long_text) for i in range(71)])]
    page.evaluate('(x) => localStorage.setItem("classic-chat-ui-v1", JSON.stringify(x))', {'chats':original,'activeId':'local'})
    page.reload()
    assert page.locator('.message').count() == 71
    assert page.locator('.bubble').last.text_content() == long_text
    page.locator('#sidebar-toggle').click()
    assert not page.locator('#sidebar').is_visible()
    page.locator('#show-sidebar').click()
    assert page.locator('#sidebar').is_visible()
    incoming = [conversation('local', [message('m0','changed')]), conversation('restored',[message('r1','<script>synthetic</script>')])]
    import_file(page, payload(incoming))
    check(page, '#notice', 'Imported 2 chat(s)')
    import_file(page, payload(incoming))
    check(page, '#notice', 'skipped 2 identical')
    import_file(page, b'{"version":2,"chats":[]}')
    check(page, '#notice', 'Import failed')
    page.reload()
    assert page.locator('.chat-item').count() == 3
    page.locator('.chat-item').filter(has_text='restored').click()
    assert page.locator('.bubble').text_content() == '<script>synthetic</script>'
    assert page.locator('.bubble script').count() == 0
    with page.expect_download() as dl:
        page.locator('#export').click()
    exported = json.loads(Path(dl.value.path()).read_text(encoding="utf-8"))
    assert exported['version'] == 1 and len(exported['chats']) == 3
    assert exported['chats'][0]['messages'][-1]['content'] == long_text
    assert not errors, errors
    ctx.close()
    print('PASS loopback fixture: full reload, sidebar, conflict-safe import, repeated import, invalid import, literal text, export')

    # A shared preview origin receives only the static resources, not bridge calls.
    ctx = browser.new_context(viewport={'width':390,'height':844})
    page = ctx.new_page()
    seen = []
    page.on('request', lambda req: seen.append(req.url))
    page.route('**/*', serve_ui)
    page.goto('https://preview.invalid/classic-chat/index.html')
    assert page.locator('#show-sidebar').is_visible()
    page.locator('#show-sidebar').click()
    check(page, '#storage-status', 'Memory only')
    page.locator('#status-button').click()
    assert not page.locator('#pair-controls').is_visible()
    check(page,'#bridge-status','offline only')
    page.locator('#status-button').click()
    page.locator('#prompt').fill('Synthetic offline prompt')
    page.locator('#send').click()
    check(page,'#notice','NOT sent to AI')
    assert page.evaluate('localStorage.getItem("classic-chat-ui-v1")') is None
    assert page.evaluate('sessionStorage.getItem("classic-chat-pair-v1")') is None
    page.wait_for_timeout(3900)
    assert all(url.startswith('https://preview.invalid/classic-chat/') for url in seen), seen
    ctx.close()
    print('PASS hosted preview: mobile sidebar, memory-only, hidden pairing, no loopback requests')

    # Local app rendering against a synthetic service, never a live sign-in or inference.
    ctx = browser.new_context()
    page = ctx.new_page()
    calls = []
    def local_fixture(route):
        url = route.request.url
        if not url.startswith('http://127.0.0.1:17879/'):
            route.abort()
            return
        path = url.removeprefix('http://127.0.0.1:17879')
        if path == '/health':
            route.fulfill(json={'ok':True,'pairingRequired':True})
        elif path == '/api/state':
            route.fulfill(json={'session':{'status':'connected','sharing':True},'models':[{'slug':'synthetic','displayName':'Synthetic fixture'}]})
        elif path == '/api/send':
            calls.append(route.request.post_data_json)
            route.fulfill(status=200, content_type='text/event-stream', body='data: {"type":"delta","text":"Synthetic reply"}\n\ndata: {"type":"done"}\n\n')
        else:
            serve_ui(route)
    page.route('**/*', local_fixture)
    page.add_init_script('sessionStorage.setItem("classic-chat-pair-v1", "a".repeat(32))')
    page.goto('http://127.0.0.1:17879/')
    check(page,'#connection-label','ChatGPT plan connected')
    page.locator('#prompt').fill('Synthetic message')
    page.locator('#send').click()
    check(page,'#notice','Response complete')
    assert page.locator('.bubble').last.text_content() == 'Synthetic reply'
    assert calls[0]['messages'] == [{'role':'user','content':'Synthetic message'}]
    ctx.close()
    print('PASS local UI: synthetic service state, model selection and streaming')
    browser.close()
