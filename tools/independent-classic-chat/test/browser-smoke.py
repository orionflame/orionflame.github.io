"""Optional locally mocked Chromium smoke test. No ChatGPT or internet requests.
Requires Python Playwright and /usr/bin/chromium. It injects the three released
scripts into an empty page and stubs fetch, making all tests self-contained.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright
import json
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p, TemporaryDirectory() as td:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-gpu'])
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.set_content('<html><body><div id="work-only">Work only. No ChatGPT composer exists.</div></body></html>')
    page.evaluate('''() => {
      window.mockPosts=[];
      if(!crypto.randomUUID) Object.defineProperty(crypto,'randomUUID',{value:()=> '9fc2a709-a70a-4f1b-b07f-11bc9aad9ac4'});
      window.fetch=async (url,init) => {
        if (url.endsWith('/api/auth/session'))return new Response(JSON.stringify({user:{id:'mock'},accessToken:'FAKE_TEST_TOKEN'}),{status:200,headers:{'Content-Type':'application/json'}});
        if (url.endsWith('/backend-api/models'))return new Response(JSON.stringify({models:[{slug:'auto',title:'Automatic'}]}),{status:200,headers:{'Content-Type':'application/json'}});
        if (url.endsWith('/backend-api/sentinel/chat-requirements/prepare'))return new Response('{}',{status:404,headers:{'Content-Type':'application/json'}});
        if (url.endsWith('/backend-api/f/conversation')){
          window.mockPosts.push(JSON.parse(init.body));
          const event=JSON.stringify({conversation_id:'76dfbc3d-5b3a-40ad-9a6d-40967aa794ef',message:{id:'3cd6a645-95dd-4b93-9d88-66ae15afffa1',author:{role:'assistant'},content:{parts:['Mock reply without original UI']}}});
          return new Response('data: '+event+'\\n\\ndata: [DONE]\\n\\n',{status:200,headers:{'Content-Type':'text/event-stream'}});
        }
        throw Error('Unexpected request: '+url);
      };
    }''')
    page.add_style_tag(content=(root/'native-ui.css').read_text())
    core=(root/'native-core.js').read_text()
    transport=(root/'native-transport.js').read_text()
    overlay=(root/'native-ui.js').read_text()
    # The release restricts itself to chatgpt.com; patch these checks only in
    # this test process, never in the published extension.
    transport=transport.replace("if (root && root.location && root.location.origin === 'https://chatgpt.com') root.NativeChatWireTransport = api;", "root.NativeChatWireTransport = api;")
    overlay=overlay.replace("if (location.origin !== 'https://chatgpt.com' || globalThis.__nativeIndependentChatUI) return;", "if (globalThis.__nativeIndependentChatUI) return;")
    page.add_script_tag(content=core)
    page.add_script_tag(content=transport)
    page.add_script_tag(content=overlay)
    page.locator('#nchat-root').wait_for(timeout=5000)
    page.get_by_role('button',name='Independent Chat').click()
    page.get_by_role('button',name='Connect',exact=True).click()
    page.get_by_text('Authenticated. 1 model(s) discovered.',exact=False).wait_for(timeout=5000)
    page.locator('#nchat-root textarea').fill('Hello mock')
    page.get_by_role('button',name='Send',exact=True).click()
    page.get_by_text('Mock reply without original UI',exact=False).wait_for(timeout=5000)
    payloads=page.evaluate('window.mockPosts')
    assert len(payloads)==1,payloads
    assert payloads[0]['messages'][0]['content']['parts'][0]=='Hello mock'
    assert page.locator('#prompt-textarea').count()==0
    image=root/'test'/'mock-browser-smoke.png'
    page.screenshot(path=str(image),full_page=True)
    print('PASS: standalone UI works on a blank page, sends a direct request, receives streamed reply; zero original UI selectors.')
    browser.close()
