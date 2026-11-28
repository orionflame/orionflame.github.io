/* A local-first browser UI. This file deliberately has no OpenAI token or ChatGPT cookie access. */
(() => {
  'use strict';
  const bridgeAllowed = ['http://127.0.0.1:17879','http://localhost:17879'].includes(location.origin);
  const API = bridgeAllowed ? location.origin : '';
  const remotePreview = !bridgeAllowed && location.protocol !== 'file:';
  const Archive = globalThis.ClassicArchive;
  const STORE = 'classic-chat-ui-v1';
  const PAIR = 'classic-chat-pair-v1';
  // Shared preview origins are memory-only; never read or write their storage.
  const storage = name => {try{return window[name];}catch{return null;}};
  const local = remotePreview ? null : storage('localStorage');
  const sessionStore = bridgeAllowed ? storage('sessionStorage') : null;
  const readPair = () => {try{return sessionStore?.getItem(PAIR) || '';}catch{return '';}};
  const savePair = value => {try{if(value)sessionStore?.setItem(PAIR,value);else sessionStore?.removeItem(PAIR);}catch{}};
  const $ = (id) => document.getElementById(id);
  const app = $('app');
  let chats = [];
  let activeId = null;
  let bridgeHealthy = false;
  let pairing = readPair();
  let preserveUnreadableStorage = false;
  let account = { status: 'disconnected', sharing: false };
  let models = [];
  let model = '';
  let signingIn = false;
  let sending = false;
  let abort = null;
  let poll = null;
  let streamSaveTimer = null;
  const randomId = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const active = () => chats.find(c => c.id === activeId);
  const clear = (n) => n.replaceChildren();
  const safeText = (s, n=24000) => typeof s === 'string' ? s.slice(0,n) : '';
  const display = (node, show) => node.classList.toggle('hidden', !show);
  const notice = (text, error=false) => { $('notice').textContent = text; $('notice').classList.toggle('error', error); };

  function storageStatus(text) { $('storage-status').textContent = text; }
  function load() {
    if(!local){storageStatus('Memory only. Export to keep your chats.');return;}
    try {
      const raw = local.getItem(STORE);
      if(raw){const x=Archive.normalize(JSON.parse(raw));chats=x.chats;activeId=x.activeId;}
      storageStatus('Saved in this browser only');
    } catch {
      preserveUnreadableStorage=true;
      storageStatus('Stored chats could not be read. Original storage is preserved; export new chats.');
    }
  }
  function persist() {
    if(!local || preserveUnreadableStorage)return false;
    try {
      local.setItem(STORE,JSON.stringify({version:1,chats,activeId}));
      storageStatus('Saved in this browser only');return true;
    } catch {
      storageStatus('Browser storage unavailable or full. Export to keep your chats.');return false;
    }
  }
  // Checkpoint partial replies without writing the full archive on every token.
  function queueStreamSave() {
    if(streamSaveTimer!==null)return;
    streamSaveTimer=setTimeout(()=>{streamSaveTimer=null;persist();},1000);
  }
  function flushStreamSave() {
    if(streamSaveTimer!==null){clearTimeout(streamSaveTimer);streamSaveTimer=null;}
    persist();
  }
  window.addEventListener('pagehide',()=>{if(sending)flushStreamSave();});
  function newChat() {
    if(sending)return;
    const chat = {id: randomId(), title:'New chat', messages:[]}; chats.unshift(chat); activeId=chat.id;
    $('prompt').value=''; resize(); persist(); render(); $('prompt').focus();
    if (window.innerWidth < 751) {app.classList.add('mobile-closed');display($('show-sidebar'),true);}
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
      row.addEventListener('click',()=>{if(sending)return;activeId=chat.id;persist();render();if(window.innerWidth<751){app.classList.add('mobile-closed');display($('show-sidebar'),true);}});
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
  // The pinned DevKit exposes only slug and displayName. Interpret explicit suffixes,
  // never invent an effort for a bare model or send an unsupported effort parameter.
  function modelTier(value){
    const normalized=String(value||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const match=normalized.match(/(?:^| )(extra high|x high|xhigh|low|medium|high|pro)$/);
    if(!match)return '';
    return ({'extra high':'Extra High','x high':'Extra High',xhigh:'Extra High',low:'Low',medium:'Medium',high:'High',pro:'Pro'})[match[1]];
  }
  function modelPickerLabel(m){
    const name=m.displayName||m.slug;
    const byName=modelTier(name),bySlug=modelTier(m.slug);
    const tier=byName&&bySlug&&byName!==bySlug?'':byName||bySlug;
    if(!tier)return name+' (Effort not exposed) ['+m.slug+']';
    const base=byName?name.replace(/(?:^|[\s._:/\-(\[])(?:extra[\s_-]+high|x[\s_-]*high|low|medium|high|pro)[\s)\]]*$/i,'').trim():name;
    return (base||name)+' ('+tier+')';
  }
  function selectedModel(){return $('model').value || model || models[0]?.slug || '';}
  function renderConnection(){
    const paired = bridgeHealthy && Boolean(pairing);
    const connected=paired && account.status==='connected' && account.sharing;
    $('connection-label').textContent=!bridgeAllowed?'Offline backup':!bridgeHealthy?'Local bridge offline':!paired?'Pair local bridge':connected?'ChatGPT plan connected':signingIn?'Signing in...':'Bridge paired';
    $('status-dot').className='dot '+(connected?'connected':!paired?'offline':'paired');
    $('bridge-status').textContent=!bridgeAllowed?'This copy is offline only. Open the local app for AI replies.':!bridgeHealthy?'No local service is running. See the installation instructions below.':paired?'Local bridge reachable and paired.':'Local service detected. Paste the pairing code from its terminal.';
    display($('pair-controls'),bridgeAllowed);
    display($('account-area'),paired);
    $('import').disabled=sending;
    $('account-status').textContent=connected?`Connected${account.identity?.email?' as '+account.identity.email:''}`:signingIn?'Complete authorization in your browser':account.status==='connected'&&!account.sharing?'Signed in, but plan sharing not enabled':'Not signed in';
    display($('sign-in'),!connected);display($('sign-out'),account.status==='connected');
    $('sign-in').disabled=signingIn;
    display($('send'),!sending);display($('stop'),sending);
    const select=$('model'),previous=select.value || model;
    clear(select);
    if(!models.length){const o=document.createElement('option');o.value='';o.textContent='No model';select.append(o);}
    else {
      const labels=models.map(modelPickerLabel);
      const counts=new Map();
      for(const label of labels)counts.set(label,(counts.get(label)||0)+1);
      for(let i=0;i<models.length;i++){
        const m=models[i],label=labels[i],o=document.createElement('option');
        o.value=m.slug;o.textContent=counts.get(label)>1?label+' ['+m.slug+']':label;
        o.title='Model ID: '+m.slug;
        select.append(o);
      }
    }
    select.disabled=!connected||sending;
    select.value=models.some(m=>m.slug===previous)?previous:(models[0]?.slug||'');model=select.value;
    $('test-plan').disabled=!connected||!model||sending;
  }
  function reportAPIError(err){const msg=safeText(err?.message || String(err),500);notice(msg||'The local bridge returned an error.',true);}
  async function request(path,options={}){
    if(!bridgeAllowed)throw new Error('The offline backup does not connect to a bridge.');
    const {json,method='GET',signal}=options;
    const headers={...(pairing?{'X-Classic-Pairing':pairing}:{})};
    if(json!==undefined)headers['Content-Type']='application/json';
    const resp=await fetch(API+path,{method,headers,body:json===undefined?undefined:JSON.stringify(json),signal,cache:'no-store'});
    const data=await resp.json().catch(()=>({}));
    if(!resp.ok)throw new Error(data.error||`Local bridge HTTP ${resp.status}`);
    return data;
  }
  async function health(){if(!bridgeAllowed)return false;try{const r=await fetch(API+'/health',{cache:'no-store',signal:AbortSignal.timeout(2500)});bridgeHealthy=r.ok;}catch{bridgeHealthy=false;}return bridgeHealthy;}
  async function refresh(){
    await health();
    if(!bridgeHealthy){account={status:'disconnected',sharing:false};models=[];renderConnection();return;}
    if(pairing){
      try {const state=await request('/api/state');account=state.session||{status:'disconnected',sharing:false};models=Array.isArray(state.models)?state.models:[];signingIn=Boolean(state.signingIn);if(state.lastError&&!signingIn)notice(state.lastError,true);}
      catch(err){if(/pairing/i.test(String(err))) {pairing='';savePair('');account={status:'disconnected',sharing:false};models=[];}else reportAPIError(err);}
    }
    renderConnection();
  }
  async function pair(){if(!bridgeAllowed)return;const x=$('pairing-code').value.trim();if(!/^[a-f0-9]{32}$/i.test(x)){notice('Enter the 32-character pairing code displayed by the local bridge.',true);return;}
    pairing=x;try{const r=await request('/api/state');savePair(pairing);account=r.session;models=r.models||[];signingIn=Boolean(r.signingIn);$('pairing-code').value='';notice('Local bridge paired. You can sign in with ChatGPT now.');renderConnection();}
    catch(err){pairing='';savePair('');reportAPIError(err);} }
  async function signIn(){if(signingIn)return;try{await request('/api/sign-in',{method:'POST',json:{}});signingIn=true;notice('Complete sign-in on OpenAI’s website, then return here.');renderConnection();}catch(err){reportAPIError(err);}}
  async function signOut(){if(sending)return;try{await request('/api/disconnect',{method:'POST',json:{}});account={status:'disconnected',sharing:false};models=[];notice('Disconnected.');renderConnection();}catch(err){reportAPIError(err);}}
  async function testPlan(){const chosen=selectedModel();if(!chosen)return;notice('Sending a real test request through your authorized ChatGPT plan...');try{const r=await request('/api/test',{method:'POST',json:{model:chosen}});notice('Model '+chosen+' replied: '+safeText(r.reply,150).replace(/\s+/g,' '));}catch(err){reportAPIError(err);}}
  function addMessage(chat,role,content,status='done'){const msg={id:randomId(),role,content,status};chat.messages.push(msg);return msg;}
  async function send(){
    const prompt=$('prompt').value.trim();if(!prompt||sending)return;
    let chat=active()||newChat();
    if(!chat.messages.length)chat.title=prompt.replace(/\s+/g,' ').slice(0,55);
    const user=addMessage(chat,'user',prompt);$('prompt').value='';resize();persist();render();
    const canSend=bridgeAllowed&&bridgeHealthy&&pairing&&account.status==='connected'&&account.sharing&&selectedModel();
    if(!canSend){notice(bridgeAllowed?'Message kept locally, NOT sent to AI. Pair and sign in to the local bridge.':'Message kept in this offline chat, NOT sent to AI. Export to keep a backup.',true);return;}
    const context=chat.messages.filter(x=>x.status==='done'&&['user','assistant'].includes(x.role)).slice(-30).map(x=>({role:x.role,content:x.content}));
    const response=addMessage(chat,'assistant','', 'streaming');sending=true;abort=new AbortController();persist();render();
    try{
      const http=await fetch(API+'/api/send',{method:'POST',headers:{'Content-Type':'application/json','X-Classic-Pairing':pairing},body:JSON.stringify({model:selectedModel(),messages:context}),signal:abort.signal,cache:'no-store'});
      if(!http.ok){const err=await http.json().catch(()=>({}));throw new Error(err.error||`HTTP ${http.status}`);}
      if(!http.body)throw new Error('No response stream was returned.');
      const reader=http.body.getReader();let buf='';let finished=false;const decoder=new TextDecoder();
      const handle=(line)=>{if(!line.startsWith('data: '))return;const ev=JSON.parse(line.slice(6));if(ev.type==='delta'){response.content+=ev.text||'';queueStreamSave();renderMessages();$('chat-area').scrollTop=$('chat-area').scrollHeight;}
        if(ev.type==='done'){finished=true;response.status='done';}
        if(ev.type==='error')throw new Error(ev.message||'Response failed.');};
      while(true){const {value,done}=await reader.read();if(done)break;buf+=decoder.decode(value,{stream:true});if(buf.length>1024*1024)throw new Error('Unexpectedly large stream event.');let pos;while((pos=buf.indexOf('\n'))!==-1){const line=buf.slice(0,pos).trim();buf=buf.slice(pos+1);handle(line);}}
      if(!finished)throw new Error('Response ended without completion.');notice('Response complete.');
    }catch(err){const stopped=abort?.signal.aborted;abort?.abort();response.status='error';if(!response.content)response.content=stopped?'Response stopped.':'Unable to complete request.';if(stopped)notice('Response stopped. Partial text is retained.');else reportAPIError(err);}
    finally{sending=false;abort=null;flushStreamSave();render();$('chat-area').scrollTop=$('chat-area').scrollHeight;}
  }
  async function stop(){abort?.abort();try{await request('/api/stop',{method:'POST',json:{}});}catch{ /* fetch cancellation already stops the local reader */ }}
  function exportChats(){const blob=new Blob([JSON.stringify({version:1,exportedAt:new Date().toISOString(),activeId,chats},null,2)],{type:'application/json'});if(blob.size>Archive.MAX_IMPORT_BYTES)notice('This export exceeds the automatic import limit. Keep it as a manual archive.',true);const href=URL.createObjectURL(blob);const a=document.createElement('a');a.href=href;a.download='classic-chat-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),5000);}
  async function importChats(file){
    if(!file || sending)return;
    if(file.size>Archive.MAX_IMPORT_BYTES){notice('Backup exceeds the 16 MiB import limit.',true);return;}
    try {
      const incoming=Archive.normalize(JSON.parse(await file.text()),true);
      if(sending){notice('Stop the active response before importing.',true);return;}
      const result=Archive.merge(chats,incoming.chats);
      chats=result.chats;
      if(!activeId)activeId=chats[0]?.id ?? null;
      const saved=persist();render();
      notice(`Imported ${result.imported} chat(s); skipped ${result.skipped} identical chat(s).${saved?'':' Export to keep your changes.'}`);
    } catch {notice('Import failed. Choose a valid Classic Chat version 1 JSON backup. Existing chats are unchanged.',true);}
  }
  $('import').addEventListener('click',()=>{if(!sending)$('import-file').click();});
  $('import-file').addEventListener('change',()=>{const input=$('import-file');const file=input.files?.[0];input.value='';void importChats(file);});
  $('new-chat').addEventListener('click',newChat);$('new-chat-wide').addEventListener('click',newChat);$('sidebar-toggle').addEventListener('click',()=>{app.classList.add('mobile-closed');$('show-sidebar').classList.remove('hidden');});
  $('show-sidebar').addEventListener('click',()=>{app.classList.remove('mobile-closed');$('show-sidebar').classList.add('hidden');});
  $('search-toggle').addEventListener('click',()=>{const n=$('search');n.classList.toggle('hidden');if(!n.classList.contains('hidden'))n.focus();});$('search').addEventListener('input',renderSidebar);
  $('export').addEventListener('click',exportChats);$('status-button').addEventListener('click',()=>{$('connection-panel').classList.toggle('hidden');refresh();});
  $('pair-button').addEventListener('click',pair);$('sign-in').addEventListener('click',signIn);$('sign-out').addEventListener('click',signOut);$('test-plan').addEventListener('click',testPlan);
  $('copy-prompt').addEventListener('click',()=>copyText($('prompt').value));$('composer').addEventListener('submit',e=>{e.preventDefault();send();});
  $('prompt').addEventListener('input',resize);$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send();}});
  $('model').addEventListener('change',()=>{model=$('model').value;});$('stop').addEventListener('click',stop);
  load();if(window.innerWidth<751){app.classList.add('mobile-closed');display($('show-sidebar'),true);}
  render();resize();
  if(bridgeAllowed){refresh();poll=setInterval(refresh,3500);}
  else notice(remotePreview?'Static preview only. Use synthetic text; private chats belong in the local app. Export to keep your session.':'Offline backup. Open the local app for AI replies.');
})();
