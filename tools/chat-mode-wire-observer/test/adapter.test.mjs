import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname,join } from 'node:path';
import vm from 'node:vm';
const ROOT=dirname(dirname(fileURLToPath(import.meta.url)));
const source=readFileSync(join(ROOT,'dom-adapter.js'),'utf8');
const sandbox={};sandbox.globalThis=sandbox;
vm.runInNewContext(source,sandbox);
const D=sandbox.ClassicChatDomAdapter;
const fakeDoc={querySelectorAll:()=>[]};

test('normalizes whitespace without changing words',()=>{
  assert.equal(D.normalize(' a\n b   c '),'a b c');
});
test('detects explicit work route, never pretends a default is chat',()=>{
  assert.equal(D.mode(fakeDoc,'/codex/threads'),'work');
  assert.equal(D.mode(fakeDoc,'/work'),'work');
  assert.equal(D.mode(fakeDoc,'/c/some-thread'),'unknown');
});
test('refuses missing composer and send control',()=>{
  assert.equal(D.composer(fakeDoc),null);
  assert.equal(D.sendButton(fakeDoc),null);
});
test('no original messages results in no invented assistant output',()=>{
  assert.equal(D.turns(fakeDoc).length,0);
  assert.equal(D.history(fakeDoc).length,0);
});
test('send implementation uses original DOM controls and not APIs',()=>{
  const overlay=readFileSync(join(ROOT,'classic-overlay.js'),'utf8');
  assert.match(overlay,/button\.click\(\)/);
  assert.match(overlay,/document\.execCommand\('insertText'/);
  assert.doesNotMatch(overlay,/\/backend-api\//);
  assert.doesNotMatch(overlay,/fetch\s*\(/);
  assert.doesNotMatch(overlay,/document\.cookie/);
});
test('extension is scoped only to the official site',()=>{
  const m=JSON.parse(readFileSync(join(ROOT,'manifest.json'),'utf8'));
  assert.equal(m.permissions.join(','),'storage');
  assert.ok(m.content_scripts.every(s=>s.matches.join(',')==='https://chatgpt.com/*'));
  assert.ok(m.content_scripts.some(s=>s.js.includes('classic-overlay.js')));
});
