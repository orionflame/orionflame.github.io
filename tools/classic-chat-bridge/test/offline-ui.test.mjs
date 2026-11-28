/* Minimal DOM stand-in for browser-independent behavior. Not a layout or browser test. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const ui = new URL('../../../classic-chat/', import.meta.url);
const archive = readFileSync(new URL('archive.js',ui),'utf8');
const app = readFileSync(new URL('app.js',ui),'utf8');
const html = readFileSync(new URL('index.html',ui),'utf8');
const STORE = 'classic-chat-ui-v1';
class Node {
  constructor(){
    this.children=[];this.events={};this.value='';this.style={};this.textContent='';this.files=[];
    const classes = new Set();this.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c),toggle:(c,v)=>{const on=v??!classes.has(c);if(on)classes.add(c);else classes.delete(c);return on;}};
  }
  addEventListener(k,f){this.events[k]=f;}
  append(...v){this.children.push(...v);}
  replaceChildren(){this.children=[];}
  focus(){}
  click(){return this.events.click?.({stopPropagation(){}});}
}
function fixture({origin='https://preview.invalid',protocol='https:',stored,width=1200,pairing='',fetcher}={}){
  const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Node()]));
  const calls=[];const map=new Map();if(stored!==undefined)map.set(STORE,stored);
  if(pairing)map.set('classic-chat-pair-v1',pairing);
  let reads=0,writes=0,download,nextTimer=0;
  const timers=new Map(),windowEvents={};
  const storage={getItem:k=>{reads++;return map.get(k)??null;},setItem:(k,v)=>{writes++;map.set(k,v);},removeItem:k=>map.delete(k)};
  const document={getElementById:id=>nodes.get(id),createElement:()=>new Node(),createTextNode:t=>t};
  const context=vm.createContext({document,location:{origin,protocol},crypto:{randomUUID:()=>`id-${Math.random()}`},window:{innerWidth:width,localStorage:storage,sessionStorage:storage,addEventListener:(k,f)=>{windowEvents[k]=f;}},navigator:{},Blob,URL:{createObjectURL:b=>{download=b;return 'blob:synthetic';},revokeObjectURL(){}},setInterval:()=>0,setTimeout:(f,ms)=>{const id=++nextTimer;timers.set(id,{f,ms});return id;},clearTimeout:id=>timers.delete(id),fetch:async (url,options)=>{calls.push(url);if(fetcher)return fetcher(url,options);throw new Error('No network in fixture');},AbortSignal,AbortController,TextDecoder});
  vm.runInContext(archive,context);vm.runInContext(app,context);
  return {nodes,map,calls,windowEvents,flushTimers(ms){for(const [id,t] of [...timers])if(t.ms<=ms){timers.delete(id);t.f();}},get reads(){return reads;},get writes(){return writes;},get download(){return download;}};
}
const makeChat=(id,content)=>({id,title:id,messages:[{id:'m',role:'user',content,status:'done'}]});
async function importBackup(f,raw){const n=f.nodes.get('import-file');n.files=[{size:raw.length,text:async()=>raw}];n.events.change();await new Promise(r=>setImmediate(r));}
async function send(f,text){f.nodes.get('prompt').value=text;f.nodes.get('composer').events.submit({preventDefault(){}});await new Promise(r=>setImmediate(r));}

test('remote preview neither uses browser storage nor contacts loopback',async()=>{
  const f=fixture({width:390,stored:'private sentinel'});
  assert.equal(f.nodes.get('connection-label').textContent,'Offline backup');
  assert.equal(f.nodes.get('pair-controls').classList.contains('hidden'),true);
  assert.equal(f.nodes.get('show-sidebar').classList.contains('hidden'),false);
  await send(f,'synthetic');
  assert.match(f.nodes.get('notice').textContent,/NOT sent to AI/);
  assert.equal(f.reads,0);assert.equal(f.writes,0);assert.deepEqual(f.calls,[]);
  assert.equal(f.map.get(STORE),'private sentinel');
  assert.equal(f.nodes.get('show-sidebar').classList.contains('hidden'),false);
});
test('offline file fixture restores, imports, exports and keeps complete text',async()=>{
  const text='雪🙂'.repeat(15000);
  const original={chats:[makeChat('old',text)],activeId:'old'};
  const f=fixture({origin:'null',protocol:'file:',stored:JSON.stringify(original)});
  assert.equal(f.nodes.get('messages').children[0].children[0].textContent,text);
  const incoming=JSON.stringify({version:1,chats:[makeChat('old','changed'),makeChat('new','new')]});
  await importBackup(f,incoming);
  assert.match(f.nodes.get('notice').textContent,/Imported 2 chat/);
  await importBackup(f,incoming);
  assert.match(f.nodes.get('notice').textContent,/skipped 2 identical/);
  const saved=JSON.parse(f.map.get(STORE));assert.equal(saved.chats.length,3);
  assert.equal(saved.chats[0].messages[0].content,text);
  await importBackup(f,'{"version":2,"chats":[]}');
  assert.match(f.nodes.get('notice').textContent,/Import failed/);
  assert.deepEqual(JSON.parse(f.map.get(STORE)),saved);
  f.nodes.get('export').click();
  const backup=JSON.parse(await f.download.text());assert.deepEqual(backup.chats,saved.chats);
  assert.deepEqual(f.calls,[]);
});
test('unreadable original storage is not silently overwritten',async()=>{
  const f=fixture({origin:'null',protocol:'file:',stored:'not-json'});
  assert.match(f.nodes.get('storage-status').textContent,/Original storage is preserved/);
  await send(f,'new local text');
  assert.equal(f.map.get(STORE),'not-json');assert.equal(f.writes,0);
  f.nodes.get('export').click();
  assert.equal(JSON.parse(await f.download.text()).chats[0].messages[0].content,'new local text');
});

// All service responses here are synthetic; no credentials or live requests.
function streamFixture(){
  let controller;
  const body=new ReadableStream({start(c){controller=c;}});
  const response=new Response(body,{headers:{'Content-Type':'text/event-stream'}});
  const f=fixture({origin:'http://127.0.0.1:17879',protocol:'http:',pairing:'a'.repeat(32),fetcher:async url=>{
    if(url.endsWith('/health'))return Response.json({ok:true});
    if(url.endsWith('/api/state'))return Response.json({session:{status:'connected',sharing:true},models:[{slug:'fixture',displayName:'Fixture'}]});
    if(url.endsWith('/api/send'))return response;
    throw new Error('Unexpected synthetic request');
  }});
  const delta=text=>controller.enqueue(new TextEncoder().encode('data: '+JSON.stringify({type:'delta',text})+'\n\n'));
  const done=()=>{controller.enqueue(new TextEncoder().encode('data: {"type":"done"}\n\n'));controller.close();};
  return {...f,delta,done,close:()=>controller.close(),saved:()=>JSON.parse(f.map.get(STORE)).chats[0].messages.at(-1)};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('stream checkpoints partial text and flushes on page hide and completion',async()=>{
  const f=streamFixture();await tick();
  assert.equal(f.nodes.get('test-plan').disabled,false);
  await send(f,'synthetic prompt');
  assert.equal(f.saved().status,'streaming');
  f.delta('partial 雪');await tick();f.flushTimers(1000);
  assert.equal(f.saved().content,'partial 雪');
  f.delta('🙂');await tick();
  f.windowEvents.pagehide();assert.equal(f.saved().content,'partial 雪🙂');
  f.done();await tick();
  assert.equal(f.saved().status,'done');
  assert.equal(f.saved().content,'partial 雪🙂');
});
test('incomplete response retains partial text and reports the failed turn',async()=>{
  const f=streamFixture();await tick();await send(f,'synthetic prompt');
  f.delta('partial text');f.close();await tick();
  assert.equal(f.saved().status,'error');
  assert.equal(f.saved().content,'partial text');
  assert.match(f.nodes.get('notice').textContent,/without completion/);
});

test('model picker labels explicit catalog tiers and never invents unknown or conflicting effort',async()=>{
  const entries=[
    {slug:'fixture-low',displayName:'Fixture'},
    {slug:'fixture-medium',displayName:'Fixture'},
    {slug:'fixture-high',displayName:'Fixture'},
    {slug:'fixture-xhigh',displayName:'Fixture'},
    {slug:'fixture-pro',displayName:'Fixture'},
    {slug:'fixture-other',displayName:'Fixture (Extra High)'},
    {slug:'fixture-default',displayName:'Fixture'},
    {slug:'fixture-high',displayName:'Conflict Low'},
    {slug:'another-high',displayName:'Fixture'},
  ];
  const f=fixture({origin:'http://127.0.0.1:17879',protocol:'http:',pairing:'a'.repeat(32),fetcher:async url=>{
    if(url.endsWith('/health'))return Response.json({ok:true});
    if(url.endsWith('/api/state'))return Response.json({session:{status:'connected',sharing:true},models:entries});
    throw new Error('Unexpected synthetic request');
  }});
  await tick();
  const options=f.nodes.get('model').children;
  assert.deepEqual(options.map(o=>o.value),entries.map(m=>m.slug));
  assert.deepEqual(options.map(o=>o.textContent),[
    'Fixture (Low)','Fixture (Medium)','Fixture (High) [fixture-high]',
    'Fixture (Extra High) [fixture-xhigh]','Fixture (Pro)',
    'Fixture (Extra High) [fixture-other]',
    'Fixture',
    'Conflict Low',
    'Fixture (High) [another-high]'
  ]);
  assert.equal(options[3].title,'Model ID: fixture-xhigh');
});
