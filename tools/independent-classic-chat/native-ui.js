/*
 * Completely independent Chat interface, injected at chatgpt.com.
 * Uses no selectors, components or runtime functions from the ChatGPT frontend.
 * Sends user-initiated requests ONLY to the same-origin Chat backend adapter.
 */
(() => {
  'use strict';
  if (location.origin !== 'https://chatgpt.com' || globalThis.__nativeIndependentChatUI) return;
  Object.defineProperty(globalThis,'__nativeIndependentChatUI',{value:true});
  const T=globalThis.NativeChatWireTransport;
  if(!T)return;
  const client=T.service();
  const state={
    open:false,connected:false,busy:false,modelList:[],chats:[],active:null,controller:null,
    model:'auto',effort:'',preflight:true,status:'Standalone Chat adapter ready. Sign in is required.',error:false,
    lastDiagnostic:null,
  };
  const NEW_CHAT=()=>({id:crypto.randomUUID(),title:'New chat',messages:[],conversationId:'',parentMessageId:''});
  const text=(s,n=250)=>typeof s==='string'?s.slice(0,n):'';
  const ui={};
  function mk(tag,id,className,content){
    const node=document.createElement(tag);
    if(id)node.id='nchat-'+id;
    if(className)node.className='nchat-'+className;
    if(content!==undefined)node.textContent=content;
    return node;
  }
  function button(label,className,click){const b=mk('button','',className,label);b.type='button';b.addEventListener('click',click);return b;}
  function setting(message,error=false){state.status=message;state.error=error;if(ui.status){ui.status.textContent=message;ui.status.classList.toggle('error',error);}}
  function selectedChat(){return state.chats.find(x=>x.id===state.active);}
  function startChat(){const ch=NEW_CHAT();state.chats.unshift(ch);state.active=ch.id;client.reset();render();return ch;}
  function open(){state.open=true;ui.app.classList.remove('nchat-hidden');ui.launch.classList.add('nchat-hidden');ui.prompt.focus();}
  function close(){state.open=false;ui.app.classList.add('nchat-hidden');ui.launch.classList.remove('nchat-hidden');}
  function render(){
    if(!ui.chatlist)return;
    ui.chatlist.replaceChildren();
    for(const ch of state.chats){
      const b=button(ch.title,'chatitem'+(ch.id===state.active?' active':''),()=>{
        if(state.busy)return;
        state.active=ch.id;client.reset();render();
      });
      ui.chatlist.append(b);
    }
    ui.log.replaceChildren();
    const ch=selectedChat();
    if(!ch || !ch.messages.length)ui.log.append(mk('div','', 'empty','What can I help with?'));
    else for(const msg of ch.messages){
      const bubble=mk('div','', 'message '+msg.role);
      bubble.append(mk('span','','msgmeta',msg.role==='user'?'You':'Assistant'));
      bubble.append(document.createTextNode(msg.text|| (msg.role==='assistant'&&state.busy?'Waiting for response...':'')));
      ui.log.append(bubble);
    }
    ui.log.scrollTop=ui.log.scrollHeight;
    ui.send.disabled=state.busy||!state.connected;
    ui.stop.disabled=!state.busy;
    ui.connect.disabled=state.busy;
    ui.modelCustom.disabled=state.busy;
    ui.effortCustom.disabled=state.busy;
    ui.newChat.disabled=state.busy;
    ui.modelCustom.value=state.model;
    ui.effortCustom.value=state.effort;
    ui.preflight.checked=state.preflight;
    const safeTrace=client.state().trace;
    ui.debug.textContent=safeTrace?JSON.stringify(safeTrace,null,2):'No direct Chat request attempted yet.';
    ui.modelSelect.replaceChildren();
    const autoOption=document.createElement('option');autoOption.value='auto';autoOption.textContent='auto';ui.modelSelect.append(autoOption);
    for(const model of state.modelList){
      const op=document.createElement('option');op.value=model.slug;op.textContent=model.name;ui.modelSelect.append(op);
    }
    ui.modelSelect.value=state.modelList.some(x=>x.slug===state.model)||state.model==='auto'?state.model:'auto';
  }
  async function connect(){
    if(state.busy)return;
    setting('Checking your existing chatgpt.com sign-in...');
    try{
      const auth=await client.connect();
      state.connected=true;
      setting('Authenticated browser session found'+(auth.tokenPresent?' (access token in memory only).':'.')+' No Chat request has been verified yet.');
      try{
        state.modelList=await client.discoverModels();
        const obs=T.loadObserved();
        if(obs?.model)state.model=obs.model;
        if(obs?.thinking_effort)state.effort=obs.thinking_effort;
        setting('Authenticated. '+state.modelList.length+' model(s) discovered. Send a short message to test the legacy Chat backend.');
      }catch(error){
        setting('Session authenticated, but model discovery failed. Use a known model slug such as auto. '+text(error.message,180),true);
      }
    }catch(error){state.connected=false;setting(text(error.message,300),true);}
    render();
  }
  function safeTraceExport(){
    // No prompts, message bodies, auth values or cookies, even on explicit export.
    const trace=client.state().trace;
    return {generatedAt:new Date().toISOString(),origin:'https://chatgpt.com',kind:'direct_chat_prototype',
      connected:state.connected,modelCount:state.modelList.length,observed:T.loadObserved(),
      trace:trace?{...trace}:null};
  }
  async function copyDiagnostics(){
    try{await navigator.clipboard.writeText(JSON.stringify(safeTraceExport(),null,2));setting('Safe diagnostics copied. No prompts or credentials included.');}
    catch{setting('Browser blocked clipboard. Use Download diagnostics.',true);}
  }
  function downloadDiagnostics(){
    const blob=new Blob([JSON.stringify(safeTraceExport(),null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='independent-chat-diagnostic.json';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),500);
  }
  async function send(){
    if(state.busy)return;
    if(!state.connected){setting('Click Connect to use your currently signed-in ChatGPT account.',true);return;}
    const prompt=ui.prompt.value.trim();if(!prompt)return;
    const model=ui.modelCustom.value.trim()||'auto';
    const effort=ui.effortCustom.value.trim();
    state.preflight=ui.preflight.checked;
    const ch=selectedChat()||startChat();
    if(!ch.messages.length)ch.title=prompt.replace(/\s+/g,' ').slice(0,60);
    ch.messages.push({role:'user',text:prompt});
    const assistant={role:'assistant',text:''};ch.messages.push(assistant);
    ui.prompt.value='';state.busy=true;
    state.controller=new AbortController();
    setting('Sending an independent request to the regular Chat backend. This creates a real user turn if accepted.');render();
    try{
      const result=await client.send({prompt,model,effort,conversationId:ch.conversationId,
        parentMessageId:ch.parentMessageId,performPreflight:state.preflight,signal:state.controller.signal,
        onProgress:(update)=>{if(update.text && update.text!==assistant.text){assistant.text=update.text;renderMessagesOnly();}},
      });
      assistant.text=result.text;
      ch.conversationId=result.conversationId;
      ch.parentMessageId=result.parentMessageId;
      setting(!result.streamCompleted?'Partial reply received; backend stream did not report completion.':result.continued?'Direct Chat request succeeded; reply complete.':'Reply received, but continuation IDs were not available. Start a new conversation for another message.', !result.streamCompleted);
    }catch(error){
      if(!assistant.text)assistant.text='[No assistant response]';
      setting('Direct Chat attempt failed: '+text(error.message,400),true);
    }finally{
      state.controller=null;state.busy=false;
      render();
    }
  }
  function renderMessagesOnly(){
    const ch=selectedChat();if(!ch)return;
    const bubbles=ui.log.querySelectorAll('.nchat-message');
    if(bubbles.length!==ch.messages.length){render();return;}
    const bubble=bubbles[bubbles.length-1];if(!bubble)return;
    bubble.replaceChildren(mk('span','','msgmeta','Assistant'),document.createTextNode(ch.messages.at(-1)?.text||''));
    ui.log.scrollTop=ui.log.scrollHeight;
  }
  function stop(){state.controller?.abort();setting('Request cancelled.');}
  function mount(){
    if(ui.app || !document.documentElement)return;
    const host=mk('div','root');
    const launch=button('Independent Chat','launch',open);
    const app=mk('section','','app nchat-hidden');app.setAttribute('aria-label','Independent Classic Chat');
    const side=mk('aside','','side');
    side.append(mk('div','','side-title','Independent Chat'));
    const newChat=button('+ New chat','pill',startChat);side.append(newChat);
    const chatlist=mk('nav','','chatlist');side.append(chatlist);
    const help=mk('div','','help','This interface has no dependency on the original ChatGPT composer, model picker, or Send button. It uses experimental same-origin Chat requests. It cannot override server access controls.');side.append(help);
    const main=mk('main','','main');
    const top=mk('header','','top');
    top.append(mk('strong','','brand','Independent Classic Chat'));
    const sub=mk('span','','sub','Legacy backend test, not Work/Codex');top.append(sub);
    top.append(mk('span','','flex'));
    const connectBtn=button('Connect','pill nchat-primary',connect);top.append(connectBtn);
    const modelSelect=mk('select','','pill');modelSelect.setAttribute('aria-label','Available models');
    modelSelect.addEventListener('change',()=>{state.model=modelSelect.value;ui.modelCustom.value=state.model;});top.append(modelSelect);
    const closeBtn=button('Close','pill',close);top.append(closeBtn);
    const log=mk('div','','log');
    const bottom=mk('footer','','bottom');
    const advanced=mk('div','','advanced');
    advanced.append(document.createTextNode('Model slug'));
    const modelCustom=mk('input');modelCustom.placeholder='auto';modelCustom.value='auto';
    modelCustom.setAttribute('aria-label','Model slug');modelCustom.addEventListener('change',()=>state.model=modelCustom.value);advanced.append(modelCustom);
    advanced.append(document.createTextNode('Thinking effort'));
    const effortCustom=mk('input');effortCustom.placeholder='unset';effortCustom.setAttribute('aria-label','Thinking effort');
    effortCustom.addEventListener('change',()=>state.effort=effortCustom.value);advanced.append(effortCustom);
    const label=mk('label');const preflight=mk('input');preflight.type='checkbox';preflight.checked=true;
    label.append(preflight,document.createTextNode(' Negotiate server requirements'));advanced.append(label);
    const copy=button('Copy diagnostics','pill',copyDiagnostics);
    const download=button('Download diagnostics','pill',downloadDiagnostics);
    advanced.append(copy,download);
    const debug=mk('pre','','debug','No request attempted.');
    const status=mk('div','','status',state.status);status.setAttribute('role','status');
    const composer=mk('div','','composer');
    const prompt=mk('textarea','','prompt');prompt.placeholder='Ask ChatGPT through the original Chat backend';prompt.setAttribute('aria-label','Prompt');
    prompt.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();void send();}});
    const sendBtn=button('Send','pill nchat-primary nchat-send',send);
    const stopBtn=button('Stop','pill nchat-send',stop);composer.append(prompt,sendBtn,stopBtn);
    const warning=mk('div','','warning','Unofficial experiment. Prompts are not stored by this extension, but accepted requests may appear in your real ChatGPT history and consume allowance. Never paste tokens or cookies.');
    bottom.append(advanced,debug,status,composer,warning);main.append(top,log,bottom);app.append(side,main);host.append(launch,app);
    document.documentElement.append(host);
    Object.assign(ui,{host,launch,app,chatlist,log,prompt,status,debug,send:sendBtn,stop:stopBtn,connect:connectBtn,
      modelSelect,modelCustom,effortCustom,preflight,newChat});
    startChat();render();
    if(new URLSearchParams(location.search).get('independent-chat')==='1')open();
    // React/router hydration must not unmount the extension when changing app roots.
    const monitor=new MutationObserver(()=>{
      if(ui.host && !document.documentElement.contains(ui.host))document.documentElement.append(ui.host);
    });
    monitor.observe(document.documentElement,{childList:true});
    document.addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&e.key.toLowerCase()==='c'){e.preventDefault();state.open?close():open();}});
  }
  if(document.documentElement)mount();
  else document.addEventListener('DOMContentLoaded',mount,{once:true});
})();
