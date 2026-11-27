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
function fixture({origin='https://preview.invalid',protocol='https:',stored,width=1200}={}){
  const nodes=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>[m[1],new Node()]));
  const calls=[];const map=new Map();if(stored!==undefined)map.set(STORE,stored);
  let reads=0,writes=0,download;
  const storage={getItem:k=>{reads++;return map.get(k)??null;},setItem:(k,v)=>{writes++;map.set(k,v);},removeItem:k=>map.delete(k)};
  const document={getElementById:id=>nodes.get(id),createElement:()=>new Node(),createTextNode:t=>t};
  const context=vm.createContext({document,location:{origin,protocol},crypto:{randomUUID:()=>`id-${Math.random()}`},window:{innerWidth:width,localStorage:storage,sessionStorage:storage},navigator:{},Blob,URL:{createObjectURL:b=>{download=b;return 'blob:synthetic';},revokeObjectURL(){}},setInterval:()=>0,setTimeout:()=>0,fetch:async url=>{calls.push(url);throw new Error('No network in fixture');},AbortSignal,AbortController,TextDecoder});
  vm.runInContext(archive,context);vm.runInContext(app,context);
  return {nodes,map,calls,get reads(){return reads;},get writes(){return writes;},get download(){return download;}};
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
