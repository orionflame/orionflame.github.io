/* A local-first browser UI. This file deliberately has no OpenAI token or ChatGPT cookie access. */
(() => {
  'use strict';
  const API = 'http://127.0.0.1:17879';
  const STORE = 'classic-chat-ui-v1';
  const PAIR = 'classic-chat-pair-v1';
  // In sandboxed or storage-restricted browsers, keep the UI usable without persistence.
  const fallbackStorage = {getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
  const local = (()=>{try{return window.localStorage;}catch{return fallbackStorage;}})();
  const sessionStore = (()=>{try{return window.sessionStorage;}catch{return fallbackStorage;}})();
  const $ = (id) => document.getElementById(id);
  const app = $('app');
  let chats = [];
  let activeId = null;
  let bridgeHealthy = false;
  let pairing = sessionStore.getItem(PAIR) || '';
  let account = { status: 'disconnected', sharing: false };
  let models = [];
  let model = '';
  let signingIn = false;
  let sending = false;
  let abort = null;
  let poll = null;
  const randomId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const active = () => chats.find(c => c.id === activeId);
  const clear = (n) => n.replaceChildren();
  const safeText = (s, n=24000) => typeof s === 'string' ? s.slice(0,n) : '';
  const display = (node, show) => node.classList.toggle('hidden', !show);
  const notice = (text, error=false) => { $('notice').textContent = text; $('notice').classList.toggle('error', error); };

  function load() {
    try {
      const x = JSON.parse(local.getItem(STORE) || '{}');
      if (Array.isArray(x.chats)) chats = x.chats.slice(0,150).filter(c => c && typeof c.id === 'string' && Array.isArray(c.messages)).map(c => ({
        id: c.id.slice(0,80), title: safeText(c.title,90), messages: c.messages.slice(-70).filter(m => m && ['user','assistant'].includes(m.role) && typeof m.content === 'string').map(m => ({ id: safeText(m.id,80) || randomId(), role:m.role, content:safeText(m.content), status:'done' }))
      }));
      if (typeof x.activeId === 'string' && chats.some(c=>c.id===x.activeId)) activeId=x.activeId;
    } catch { /* Corrupted local state never prevents use */ }
  }
  function persist() {
    try { local.setItem(STORE,JSON.stringify({chats:chats.slice(0,150),activeId})); }
    catch { notice('Your browser could not save this chat locally. Export the conversations if you need a copy.', true); }
  }
  function newChat() {
    const chat = {id: randomId(), title:'New chat', messages:[]}; chats.unshift(chat); activeId=chat.id;
    $('prompt').value=''; resize(); persist(); render(); $('prompt').focus();
    if (window.innerWidth < 751) app.classList.add('mobile-closed');
    return chat;
  }
  function renderSidebar() {
    const box=$('chats'); clear(box); const term=$('search').value.trim().toLowerCase();
    for(const chat of chats) {
      if(term && !(chat.title+' '+chat.messages.map(m=>m.content).join(' ')).toLowerCase().includes(term))continue;
      const row=document.createElement('button'); row.type='button'; row.className='chat-item'+(chat.id===activeId?' active':'');
      const del=document.createElement('span');del.textContent='×';del.className='tiny-delete';del.title='Delete chat';
      del.addEventListener('click',e=>{e.stopPropagation();if(sending)return;chats=chats.filter(c=>c.id!==chat.id);if(activeId===chat.id) activeId=chats[0]?.id??null;persist();render();});
      row.append(document.createTextNode(chat.title||'Untitled'),del);
      row.addEventListener('click',()=>{if(sending)return;activeId=chat.id;persist();render();if(window.innerWidth<751)app.classList.add('mobile-closed');});
      box.append(row);
    }
  }
  function renderMessages() {
    const box=$('messages');clear(box);const chat=active();
    const hasMessages=Boolean(chat?.messages.length);
    display($('welcome'),!hasMessages);display(box,hasMessages);
    if(!chat)return;
    for(const msg of chat.messages) {
      const div=document.createElement('div');div.className='message '+msg.role+(msg.status==='error'?' error':'');
      const bubble=document.createElement('div'); bubble.className='bubble';bubble.textContent=msg.content || (msg.status==='streaming'?'Thinking...':'');
      const meta=document.createElement('div');meta.className='message-meta';
      const role=document.createElement('span');role.textContent=msg.role==='assistant'?'Assistant':'You';
      const copy=document.createElement('button');copy.className='mini-btn';copy.type='button';copy.textContent='Copy';copy.addEventListener('click',()=>copyText(msg.content));
      meta.append(role,copy);div.append(bubble,meta);box.append(div);
    }
    if(sending)box.scrollTop=box.scrollHeight;
  }
  function render() {renderSidebar();renderMessages();renderConnection();}
  function resize() {const t=$('prompt');t.style.height='auto';t.style.height=Math.min(t.scrollHeight,190)+'px';}
  async function copyText(text){try{await navigator.clipboard.writeText(text);notice('Copied to clipboard.');}catch{notice('Clipboard access was blocked. Select the message text and copy manually.',true);}}
  function selectedModel(){return $('model').value || model || models[0]?.slug || '';}
  function renderConnection(){
    const paired = bridgeHealthy && Boolean(pairing);
    const connected=paired && account.status==='connected' && account.sharing;
    $('connection-label').textContent=!bridgeHealthy?'Local bridge offline':!paired?'Pair local bridge':connected?'ChatGPT plan connected':signingIn?'Signing in...':'Bridge paired';
    $('status-dot').className='dot '+(connected?'connected':!paired?'offline':'paired');
    $('bridge-status').textContent=!bridgeHealthy?'No local service is running. See the installation instructions below.':paired?'Local bridge reachable and paired.':'Local service detected. Paste the pairing code from its terminal.';
    display($('account-area'),paired);
    $('account-status').textContent=connected?`Connected${account.identity?.email?' as '+account.identity.email:''}`:signingIn?'Complete authorization in your browser':account.status==='connected'&&!account.sharing?'Signed in, but plan sharing not enabled':'Not signed in';
    display($('sign-in'),!connected);display($('sign-out'),account.status==='connected');
    $('sign-in').disabled=signingIn;
    $('test-plan').disabled=!connected||!selectedModel()||sending;
    display($('send'),!sending);display($('stop'),sending);
    const select=$('model'),previous=select.value || model;
    clear(select);
    if(!models.length){const o=document.createElement('option');o.value='';o.textContent='No model';select.append(o);}
    else for(const m of models){const o=document.createElement('option');o.value=m.slug;o.textContent=m.displayName;select.append(o);}
    select.disabled=!connected||sending;
    select.value=models.some(m=>m.slug===previous)?previous:(models[0]?.slug||'');model=select.value;
  }
  function reportAPIError(err){const msg=safeText(err?.message || String(err),500);notice(msg||'The local bridge returned an error.',true);}
  async function request(path,options={}){
    const {json,method='GET',signal}=options;
    const headers={...(pairing?{'X-Classic-Pairing':pairing}:{})};
    if(json!==undefined)headers['Content-Type']='application/json';
    const resp=await fetch(API+path,{method,headers,body:json===undefined?undefined:JSON.stringify(json),signal,cache:'no-store'});
    const data=await resp.json().catch(()=>({}));
    if(!resp.ok)throw new Error(data.error||`Local bridge HTTP ${resp.status}`);
    return data;
  }
  async function health(){try{const r=await fetch(API+'/health',{cache:'no-store',signal:AbortSignal.timeout(2500)});bridgeHealthy=r.ok;}catch{bridgeHealthy=false;}return bridgeHealthy;}
  async function refresh(){
    await health();
    if(!bridgeHealthy){account={status:'disconnected',sharing:false};models=[];renderConnection();return;}
    if(pairing){
      try {const state=await request('/api/state');account=state.session||{status:'disconnected',sharing:false};models=Array.isArray(state.models)?state.models:[];signingIn=Boolean(state.signingIn);if(state.lastError&&!signingIn)notice(state.lastError,true);}
      catch(err){if(/pairing/i.test(String(err))) {pairing='';sessionStore.removeItem(PAIR);account={status:'disconnected',sharing:false};models=[];}else reportAPIError(err);}
    }
    renderConnection();
  }
  async function pair(){const x=$('pairing-code').value.trim();if(!/^[a-f0-9]{32}$/i.test(x)){notice('Enter the 32-character pairing code displayed by the local bridge.',true);return;}
    pairing=x;try{const r=await request('/api/state');sessionStore.setItem(PAIR,pairing);account=r.session;models=r.models||[];signingIn=Boolean(r.signingIn);$('pairing-code').value='';notice('Local bridge paired. You can sign in with ChatGPT now.');renderConnection();}
    catch(err){pairing='';sessionStore.removeItem(PAIR);reportAPIError(err);} }
  async function signIn(){if(signingIn)return;try{await request('/api/sign-in',{method:'POST',json:{}});signingIn=true;notice('Complete sign-in on OpenAI’s website, then return here.');renderConnection();}catch(err){reportAPIError(err);}}
  async function signOut(){if(sending)return;try{await request('/api/disconnect',{method:'POST',json:{}});account={status:'disconnected',sharing:false};models=[];notice('Disconnected.');renderConnection();}catch(err){reportAPIError(err);}}
  async function testPlan(){const chosen=selectedModel();if(!chosen)return;notice('Sending a real test request through your authorized ChatGPT plan...');try{const r=await request('/api/test',{method:'POST',json:{model:chosen}});notice('Model '+chosen+' replied: '+safeText(r.reply,150).replace(/\s+/g,' '));}catch(err){reportAPIError(err);}}
  function addMessage(chat,role,content,status='done'){const msg={id:randomId(),role,content,status};chat.messages.push(msg);return msg;}
  async function send(){
    const prompt=$('prompt').value.trim();if(!prompt||sending)return;
    let chat=active()||newChat();
    if(!chat.messages.length)chat.title=prompt.replace(/\s+/g,' ').slice(0,55);
    const user=addMessage(chat,'user',prompt);$('prompt').value='';resize();persist();render();
    const canSend=bridgeHealthy&&pairing&&account.status==='connected'&&account.sharing&&selectedModel();
    if(!canSend){notice('Message saved locally, NOT sent to AI. Pair and sign in to the local bridge, or copy the message into official ChatGPT.',true);return;}
    const context=chat.messages.filter(x=>x.status==='done'&&['user','assistant'].includes(x.role)).slice(-30).map(x=>({role:x.role,content:x.content}));
    const response=addMessage(chat,'assistant','', 'streaming');sending=true;abort=new AbortController();render();
    try{
      const http=await fetch(API+'/api/send',{method:'POST',headers:{'Content-Type':'application/json','X-Classic-Pairing':pairing},body:JSON.stringify({model:selectedModel(),messages:context}),signal:abort.signal,cache:'no-store'});
      if(!http.ok){const err=await http.json().catch(()=>({}));throw new Error(err.error||`HTTP ${http.status}`);}
      if(!http.body)throw new Error('No response stream was returned.');
      const reader=http.body.getReader();let buf='';let finished=false;const decoder=new TextDecoder();
      const handle=(line)=>{if(!line.startsWith('data: '))return;const ev=JSON.parse(line.slice(6));if(ev.type==='delta'){response.content+=ev.text||'';renderMessages();$('chat-area').scrollTop=$('chat-area').scrollHeight;}
        if(ev.type==='done'){finished=true;response.status='done';}
        if(ev.type==='error')throw new Error(ev.message||'Response failed.');};
      while(true){const {value,done}=await reader.read();if(done)break;buf+=decoder.decode(value,{stream:true});if(buf.length>1024*1024)throw new Error('Unexpectedly large stream event.');let pos;while((pos=buf.indexOf('\n'))!==-1){const line=buf.slice(0,pos).trim();buf=buf.slice(pos+1);handle(line);}}
      if(!finished)throw new Error('Response ended without completion.');notice('Response complete.');
    }catch(err){response.status='error';if(!response.content)response.content=abort?.signal.aborted?'Response stopped.':'Unable to complete request.';reportAPIError(err);}
    finally{sending=false;abort=null;persist();render();$('chat-area').scrollTop=$('chat-area').scrollHeight;}
  }
  async function stop(){abort?.abort();try{await request('/api/stop',{method:'POST',json:{}});}catch{ /* fetch cancellation already stops the local reader */ }}
  function exportChats(){const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),chats},null,2)],{type:'application/json'});const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download='classic-chat-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),5000);}
  $('new-chat').addEventListener('click',newChat);$('new-chat-wide').addEventListener('click',newChat);$('sidebar-toggle').addEventListener('click',()=>{app.classList.add('mobile-closed');$('show-sidebar').classList.remove('hidden');});
  $('show-sidebar').addEventListener('click',()=>{app.classList.remove('mobile-closed');$('show-sidebar').classList.add('hidden');});
  $('search-toggle').addEventListener('click',()=>{const n=$('search');n.classList.toggle('hidden');if(!n.classList.contains('hidden'))n.focus();});$('search').addEventListener('input',renderSidebar);
  $('export').addEventListener('click',exportChats);$('status-button').addEventListener('click',()=>{$('connection-panel').classList.toggle('hidden');refresh();});
  $('pair-button').addEventListener('click',pair);$('sign-in').addEventListener('click',signIn);$('sign-out').addEventListener('click',signOut);$('test-plan').addEventListener('click',testPlan);
  $('copy-prompt').addEventListener('click',()=>copyText($('prompt').value));$('composer').addEventListener('submit',e=>{e.preventDefault();send();});
  $('prompt').addEventListener('input',resize);$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send();}});
  $('model').addEventListener('change',()=>{model=$('model').value;});$('stop').addEventListener('click',stop);
  load();if(window.innerWidth<751)app.classList.add('mobile-closed');render();resize();refresh();poll=setInterval(refresh,3500);
})();
