/* Original ChatGPT web-UI companion. No direct API calls, credential capture, or request replay. */
(() => {
  'use strict';
  if (location.origin !== 'https://chatgpt.com' || document.getElementById('chat-classic-overlay-root')) return;
  const D = globalThis.ClassicChatDomAdapter;
  if (!D) return;
  const HOST_ID = 'chat-classic-overlay-root';
  const CSS = String.raw`
    :host {all:initial; color-scheme:dark; font:15px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif; color:#f3f3f3}
    *{box-sizing:border-box} button,textarea,input{font:inherit} button{cursor:pointer;color:inherit} button:disabled{opacity:.48;cursor:not-allowed}
    button:focus-visible,textarea:focus-visible,input:focus-visible{outline:2px solid #88b8fd;outline-offset:2px}
    .launcher{position:fixed;left:16px;bottom:17px;z-index:2147483645;border:1px solid #4a4a4a;border-radius:99px;background:#202020;box-shadow:0 8px 28px #000b;padding:11px 17px;font-weight:650}
    .screen{position:fixed;inset:0;z-index:2147483645;display:grid;grid-template-columns:255px minmax(0,1fr);background:#0b0b0b;min-width:320px}
    [hidden]{display:none!important}.sidebar{background:#171717;display:flex;flex-direction:column;min-height:0;padding:16px 11px;gap:9px;border-right:1px solid #292929}
    .srow{display:flex;align-items:center;justify-content:space-between;gap:10px}.brand{font-weight:750;font-size:16px;padding:9px}
    .side-btn,.history-item,.soft-btn{border:0;background:transparent;border-radius:9px;padding:10px 11px;text-align:left;color:#e9e9e9}
    .side-btn:hover,.history-item:hover,.soft-btn:hover{background:#303030}.history-list{display:flex;flex-direction:column;min-height:0;overflow-y:auto;gap:2px}
    .history-item{width:100%;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;font-size:13px}
    .muted{font-size:12px;color:#a9a9a9}.side-foot{margin-top:auto;padding:11px 8px;border-top:1px solid #333}
    .main{display:flex;flex-direction:column;min-width:0;min-height:0;position:relative}
    .top{height:69px;display:flex;align-items:center;justify-content:space-between;padding:0 21px;border-bottom:1px solid #282828;gap:12px}
    .top-title{font-weight:650;font-size:17px}.top-sub{font-size:11px;color:#b1b1b1}
    .actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:end}
    .control{background:#222;border:1px solid #434343;border-radius:10px;padding:8px 12px;font-size:12px;white-space:nowrap}
    .control:hover{background:#303030}.primary{background:#2b6dc6;border:1px solid #3175d3;color:white}
    .status{padding:7px 18px;min-height:34px;background:#141414;border-bottom:1px solid #282828;color:#bdbdbd;font-size:12px;overflow-wrap:anywhere}
    .status.bad{color:#ffaaaa}.status.good{color:#b9e9c7}
    .thread{max-width:820px;width:100%;margin:0 auto;padding:32px 26px 48px;display:flex;flex-direction:column;gap:30px}
    .thread-outer{flex:1;overflow-y:auto;min-height:0;overflow-wrap:anywhere}
    .message{max-width:94%;white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.65}
    .message.user{align-self:flex-end;background:#292929;padding:13px 16px;border-radius:18px;max-width:80%}
    .message.assistant{align-self:flex-start;max-width:100%}
    .role{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#aaa;margin-bottom:5px}
    .welcome{font-size:31px;font-weight:550;text-align:center;align-self:center;margin:auto;color:#eee}
    .composer-outer{width:min(870px,calc(100% - 24px));margin:0 auto 14px;flex:none}
    .composer{padding:10px 12px;background:#232323;border:1px solid #343434;border-radius:25px;box-shadow:0 8px 20px #0005}
    textarea{display:block;width:100%;resize:vertical;min-height:68px;max-height:280px;background:transparent;border:0;outline:0;color:#f6f6f6;padding:9px 13px;font-size:15px}
    .compose-row{display:flex;gap:12px;justify-content:space-between;align-items:center;padding:0 4px 2px}
    .compose-hint{font-size:11px;color:#aaa}.send{border-radius:99px;background:#f2f2f2;color:#151515;border:0;min-width:72px;padding:9px 15px;font-weight:700}
    .send:hover{background:#d7d7d7}.disclaimer{font-size:11px;color:#888;text-align:center;padding:7px 0}
    .guard{display:flex;align-items:center;gap:7px;padding:7px 18px;background:#1a1a1a;color:#eee;font-size:12px}
    input[type=checkbox]{accent-color:#4c9cff}
    @media(max-width:720px){.screen{grid-template-columns:1fr}.sidebar{display:none}.top{height:auto;padding:11px 13px;align-items:start}.top-title{font-size:14px}.actions{gap:4px}.control{padding:6px;font-size:11px}.thread{padding:20px 13px}.welcome{font-size:24px}.message.user{max-width:95%}}
  `;
  let host, shadow, launcher, screen, status, thread, prompt, send, historyBox, confirm, guard, modeState;
  let open = false, busy = false, lastSignature = '', lastAddress = '', pendingSync = false, timer = null;
  const state = { mode: 'unknown', message: 'This uses the existing ChatGPT page, not Work/Codex API.', kind: 'neutral' };
  const el = (tag, attrs = {}, text) => {
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) { if (k === 'class') n.className = v; else if (k === 'id') n.id = v; else if (k === 'type') n.type = v; else n.setAttribute(k,v); }
    if (text !== undefined) n.textContent = text;
    return n;
  };
  function info(text, kind='neutral') { state.message = text; state.kind = kind; if (status) { status.textContent=text;status.className='status '+(kind==='error'?'bad':kind==='success'?'good':''); } }
  function addBtn(container, label, fn, cls='control') { const b=el('button',{type:'button',class:cls},label);b.addEventListener('click',fn);container.append(b);return b; }
  function nativeMode() { return D.mode(document, location.pathname); }
  function syncGuard() {
    state.mode = nativeMode();
    modeState.textContent = state.mode==='chat'?'Chat selected in original UI':state.mode==='work'?'Work selected in original UI':'Mode not detectable automatically';
    guard.hidden = state.mode==='chat';
    send.disabled = busy || state.mode==='work' || (state.mode==='unknown' && !confirm.checked);
  }
  function showOriginal() { open=false;screen.hidden=true;launcher.hidden=false; }
  function showOverlay() {open=true;screen.hidden=false;launcher.hidden=true;sync(true);prompt.focus();}
  function refreshHistory() {
    const found = D.history(document);
    historyBox.replaceChildren();
    for(const entry of found) addBtn(historyBox,entry.title,()=>{location.assign('https://chatgpt.com'+entry.path);},'history-item');
    if(!found.length)historyBox.append(el('div',{class:'muted'},'Open a conversation in the original sidebar to show its contents here.'));
  }
  function refreshMessages(force=false) {
    const turns = D.turns(document);
    const signature = location.pathname+'|'+turns.length+'|'+turns.map(t=>t.role+':'+t.content.length+':'+t.content.slice(-28)).join(';');
    if(!force && signature===lastSignature)return;
    lastSignature=signature;
    const container = thread.parentElement;
    const atBottom = container.scrollHeight-container.scrollTop-container.clientHeight < 150;
    thread.replaceChildren();
    if(!turns.length)thread.append(el('div',{class:'welcome'},'What can I help with?'));
    else for(const msg of turns){
      const bubble=el('div',{class:'message '+msg.role});
      bubble.append(el('div',{class:'role'},msg.role==='assistant'?'ChatGPT':'You'));
      bubble.append(el('div',{},msg.content));
      thread.append(bubble);
    }
    if(atBottom||force)container.scrollTop=container.scrollHeight;
  }
  function sync(force=false) {
    if(!open)return;
    if(force||lastAddress!==location.href) {lastAddress=location.href;lastSignature='';refreshHistory();}
    syncGuard();refreshMessages(force);
  }
  function scheduleSync(){
    if(!open || pendingSync)return;pendingSync=true;
    timer=setTimeout(()=>{pendingSync=false;sync();},220);
  }
  async function waitFor(get,ms=6500) {
    const deadline=performance.now()+ms;
    while(performance.now()<deadline){const result=get();if(result)return result;await new Promise(resolve=>setTimeout(resolve,100));}
    return null;
  }
  function originalDraft(native) {
    return native instanceof HTMLTextAreaElement ? native.value : (native.innerText || native.textContent || '');
  }
  function insertNative(native,text) {
    native.focus();
    if(native instanceof HTMLTextAreaElement) {
      const setter=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')?.set;
      if(!setter) return false;
      setter.call(native,text);
      native.dispatchEvent(new Event('input',{bubbles:true}));
    } else {
      let inserted=false;
      try { inserted=document.execCommand('insertText',false,text); } catch { /* Leave native composer intact */ }
      if(!inserted) return false;
    }
    return D.normalize(originalDraft(native))===D.normalize(text);
  }
  async function deliver() {
    const text=prompt.value.trim();
    if(busy||!text)return;
    syncGuard();
    if(state.mode==='work')return info('Work is selected. Switch to Chat in the original website first.','error');
    if(state.mode==='unknown'&&!confirm.checked)return info('Confirm you selected regular Chat in the original website first.','error');
    const native=D.composer(document);
    if(!native)return info('Original ChatGPT composer not found. Open the official interface and select Chat.','error');
    if(D.normalize(originalDraft(native)))return info('Original composer already has an unsent draft. Open the original interface to preserve it.','error');
    const oldTurns=D.turns(document);
    const oldUsers=oldTurns.filter(x=>x.role==='user').length;
    busy=true;send.disabled=true;
    info('Writing to the original ChatGPT composer...');
    try {
      if(!insertNative(native,text))throw new Error('The original editor rejected the text. Nothing was submitted.');
      const button=await waitFor(()=>D.sendButton(document),6500);
      if(!button)throw new Error('Original send button did not become ready. Your text remains in the original composer.');
      button.click();
      info('Clicked the original Send button. Checking for the new user turn...');
      const confirmed=await waitFor(()=>{
        const all=D.turns(document).filter(x=>x.role==='user');
        return all.length>oldUsers && D.normalize(all[all.length-1]?.content).includes(D.normalize(text).slice(0,100));
      },12500);
      if(confirmed){prompt.value='';info('Message submitted through the original ChatGPT website.','success');sync(true);}
      else info('Submission not confirmed. Check the original website before retrying to avoid duplicates.','error');
    } catch(e) {info(e instanceof Error?e.message:'Original ChatGPT controls are unavailable.','error');}
    finally {busy=false;syncGuard();}
  }
  function newConversation(){
    if(busy)return;
    const native=D.newChatControl(document);
    if(native) {native.click();info('Requested a new conversation through the original UI.');scheduleSync();}
    else location.assign('https://chatgpt.com/');
  }
  function build() {
    host=el('div',{id:HOST_ID});
    shadow=host.attachShadow({mode:'open'});
    shadow.append(el('style',{},CSS));
    launcher=el('button',{type:'button',class:'launcher'},'Classic Chat UI');
    launcher.addEventListener('click',showOverlay);shadow.append(launcher);
    screen=el('div',{class:'screen'});screen.hidden=true;shadow.append(screen);
    const sidebar=el('aside',{class:'sidebar'});screen.append(sidebar);
    sidebar.append(el('div',{class:'brand'},'Classic Chat'));
    addBtn(sidebar,'+ New chat',newConversation,'side-btn');
    sidebar.append(el('div',{class:'muted'},'Your original ChatGPT conversations'));
    historyBox=el('div',{class:'history-list'});sidebar.append(historyBox);
    sidebar.append(el('div',{class:'muted side-foot'},'No separate account or API billing. This panel controls the existing website and follows its permissions.'));
    const main=el('main',{class:'main'});screen.append(main);
    const top=el('header',{class:'top'});main.append(top);
    const left=el('div');left.append(el('div',{class:'top-title'},'ChatGPT · classic overlay'));
    modeState=el('div',{class:'top-sub'},'Checking Chat / Work selection');left.append(modeState);top.append(left);
    const actions=el('div',{class:'actions'});top.append(actions);
    addBtn(actions,'Model / reasoning: official UI',()=>{showOriginal();},'control');
    addBtn(actions,'Show original',showOriginal,'control primary');
    status=el('div',{class:'status'},state.message);main.append(status);
    guard=el('label',{class:'guard'});main.append(guard);
    confirm=el('input',{type:'checkbox'});guard.append(confirm);
    guard.append(el('span',{},'I selected regular Chat, not Work, in the original ChatGPT page.'));
    confirm.addEventListener('change',syncGuard);
    const outer=el('section',{class:'thread-outer'});main.append(outer);
    thread=el('div',{class:'thread'});outer.append(thread);
    const footer=el('footer',{class:'composer-outer'});main.append(footer);
    const form=el('form',{class:'composer'});footer.append(form);
    prompt=el('textarea',{rows:'3',placeholder:'Message the original ChatGPT website (Ctrl+Enter to send)','aria-label':'Classic Chat message'});form.append(prompt);
    const row=el('div',{class:'compose-row'});form.append(row);
    row.append(el('div',{class:'compose-hint'},'Sent through official webpage controls only'));
    send=el('button',{type:'submit',class:'send'},'Send');row.append(send);
    form.addEventListener('submit',event=>{event.preventDefault();void deliver();});
    prompt.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();void deliver();}});
    footer.append(el('div',{class:'disclaimer'},'Not an official OpenAI client. The original Chat service must remain accessible and authorized.'));
    document.documentElement.append(host);
    new MutationObserver(scheduleSync).observe(document.body||document.documentElement,{childList:true,characterData:true,subtree:true});
    setInterval(()=>{if(open)sync();},1100);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});
  else build();
})();
