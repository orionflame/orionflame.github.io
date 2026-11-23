/*
 * Same-origin browser-session Chat adapter (EXPERIMENTAL / unofficial).
 * No API keys, credential files, HTTP proxy, service worker, or Work/Codex API.
 * A valid login is necessary. Server-side Sentinel challenges are never bypassed.
 */
(function (root, factory) {
  'use strict';
  const api = factory(root, root.NativeChatWireCore);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root && root.location && root.location.origin === 'https://chatgpt.com') root.NativeChatWireTransport = api;
})(typeof globalThis !== 'undefined' ? globalThis : undefined, function (root, core) {
  'use strict';
  const STORAGE_KEY = 'independent-classic-chat-observed-options-v1';
  function cleanObserved(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const out = {};
    if (typeof raw.model === 'string' && /^[a-zA-Z0-9._-]{1,128}$/.test(raw.model)) out.model = raw.model;
    if (typeof raw.thinking_effort === 'string' && /^[a-zA-Z0-9_-]{1,32}$/.test(raw.thinking_effort)) out.thinking_effort = raw.thinking_effort;
    if (typeof raw.endpoint === 'string' && core.ENDPOINTS.includes(raw.endpoint)) out.endpoint = raw.endpoint;
    if (raw.conversation_mode?.kind === 'primary_assistant') out.conversation_mode = {kind:'primary_assistant'};
    if (typeof raw.enable_message_followups === 'boolean') out.enable_message_followups = raw.enable_message_followups;
    if (typeof raw.force_parallel_switch === 'string' && /^(auto|on|off)$/.test(raw.force_parallel_switch)) out.force_parallel_switch = raw.force_parallel_switch;
    if (typeof raw.paragen_cot_summary_display_override === 'string' && /^(allow|block)$/.test(raw.paragen_cot_summary_display_override)) out.paragen_cot_summary_display_override = raw.paragen_cot_summary_display_override;
    return Object.keys(out).length ? out : null;
  }
  function saveObserved(raw) {
    const safe = cleanObserved(raw);
    if (!safe) return;
    try { root.localStorage?.setItem(STORAGE_KEY,JSON.stringify(safe)); } catch { /* optional */ }
  }
  function loadObserved() {
    try { return cleanObserved(JSON.parse(root.localStorage?.getItem(STORAGE_KEY)||'null')); }
    catch {return null;}
  }
  function observeLiveChatRequests() {
    // Captures only the whitelist of nonsecret model/effort/options used by normal Chat.
    // Never copies prompt text, response content, cookies or header values.
    if (!root || !root.fetch || root.__independentChatCaptureInstalled) return;
    Object.defineProperty(root,'__independentChatCaptureInstalled',{value:true});
    const original = root.fetch;
    root.fetch = function(input, init) {
      try {
        const urlText = typeof input === 'string' || input instanceof URL ? String(input) : input?.url;
        const method = init?.method || input?.method || 'GET';
        const url = new URL(urlText,root.location.href);
        if (method.toUpperCase() === 'POST' && url.origin === 'https://chatgpt.com' && core.ENDPOINTS.includes(url.pathname)) {
          if (typeof init?.body === 'string' && init.body.length < 1_000_000) {
            const data = JSON.parse(init.body);
            if (data?.conversation_mode?.kind === 'primary_assistant') saveObserved({...data,endpoint:url.pathname});
          }
        }
      } catch { /* never affect official page */ }
      return Reflect.apply(original,this,arguments);
    };
  }

  function responseError(status, raw) {
    let code = '';
    try { const body = JSON.parse(raw); code = typeof body?.error?.code==='string'?body.error.code:''; } catch {}
    const err = new Error(core.backendError(status));
    err.status = status; err.code = code.slice(0,100);
    return err;
  }
  function service(fetcher = root.fetch.bind(root), origin = 'https://chatgpt.com') {
    if(origin !== 'https://chatgpt.com') throw new Error('Chat service is restricted to the first-party site.');
    let accessToken = '';
    let signedIn = false;
    let models = [];
    let lastTrace = null;
    let previous = { conversationId:'', parentMessageId:'' };
    async function request(path, {method='GET', body, signal, auth=true, accept='application/json'}={}) {
      if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Only same-origin relative paths are permitted.');
      const headers = { 'Accept': accept };
      if (body !== undefined) headers['Content-Type']='application/json';
      if (auth && accessToken) headers.Authorization='Bearer '+accessToken;
      return fetcher(origin+path, {
        method, headers, ...(body===undefined?{}:{body:JSON.stringify(body)}),
        credentials:'same-origin', cache:'no-store', redirect:'error', signal,
      });
    }
    async function connect() {
      // In-memory accessToken ONLY. Never persisted, logged, exported or sent anywhere else.
      const resp=await request('/api/auth/session',{auth:false});
      if(!resp.ok)throw responseError(resp.status,'');
      const session=await resp.json();
      signedIn=Boolean(session && (session.accessToken || session.user));
      if(!signedIn)throw new Error('No authenticated ChatGPT session in this browser. Sign in on chatgpt.com.');
      accessToken=typeof session.accessToken==='string' ? session.accessToken : '';
      return {connected:true,tokenPresent:Boolean(accessToken)};
    }
    async function discoverModels() {
      if(!signedIn)await connect();
      const resp=await request('/backend-api/models');
      if(!resp.ok)throw responseError(resp.status,'');
      const body=await resp.json();
      models=core.parseCatalog(body);
      return models;
    }
    async function requirements(signal) {
      // Negotiate only the ordinary first-party server requirements.
      // If a human verification, PoW, Turnstile or other challenge is required,
      // stop, rather than solve around it or forge a completion token.
      const prepare=await request('/backend-api/sentinel/chat-requirements/prepare',{method:'POST',body:{},signal});
      if(prepare.status===404 || prepare.status===405) return {status:'not_supported', headers:{}};
      if(!prepare.ok)throw responseError(prepare.status,'');
      const body=await prepare.json();
      const challenges=['turnstile','proofofwork','so'].filter(key => body?.[key]?.required === true);
      if (challenges.length) {
        const err=new Error('Server requires '+challenges.join(', ')+' verification. Independent requests cannot proceed without the supported verification flow.');
        err.code='challenge_required';
        throw err;
      }
      if (typeof body?.prepare_token !== 'string') return {status:'no_token',headers:{}};
      const finalize=await request('/backend-api/sentinel/chat-requirements/finalize',{
        method:'POST',body:{prepare_token:body.prepare_token},signal,
      });
      if(!finalize.ok)throw responseError(finalize.status,'');
      const data=await finalize.json();
      const token=typeof data?.token==='string'?data.token:(typeof data?.chat_requirements_token==='string'?data.chat_requirements_token:'');
      return {status:'finalized', headers: token ? {'OpenAI-Sentinel-Chat-Requirements-Token':token}: {}};
    }
    function readStream(resp,onProgress,signal) {
      let current = {};
      const decoder=new TextDecoder();
      const events=core.sseAccumulator(raw=>{current=core.parseEvent(raw,current);if(onProgress)onProgress({...current});});
      return (async()=>{
        if(!resp.body || !resp.body.getReader) {
          const text=await resp.text();
          if(text.length > 300000)throw new Error('Unexpected response size.');
          events.feed(text); events.finish();
          return current;
        }
        const reader=resp.body.getReader();
        try {
          while(true) {
            if(signal?.aborted)throw new DOMException('Aborted','AbortError');
            const {done,value}=await reader.read();
            if(done)break;
            events.feed(decoder.decode(value,{stream:true}));
          }
          events.feed(decoder.decode());events.finish();
          return current;
        }finally {reader.releaseLock();}
      })();
    }
    async function send({prompt,model='auto',effort='',signal,onProgress,conversationId=undefined,parentMessageId=undefined,performPreflight=true}={}) {
      if(!signedIn)await connect();
      const observed=loadObserved()||{};
      const timezone=(()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'';}catch{return '';}})();
      const built=core.buildPayload({prompt,model,effort,conversationId:conversationId===undefined?previous.conversationId:conversationId,
        parentMessageId:parentMessageId===undefined?previous.parentMessageId:parentMessageId,capturedOptions:observed,
        timezone,timezoneOffsetMinutes:new Date().getTimezoneOffset()});
      const trace={status:'preparing', endpoint:observed.endpoint||core.ENDPOINTS[0],httpStatus:null,channel:'regular_chat_backend',model,effort:effort||'unspecified',challenge:'unchecked',timestamp:new Date().toISOString()};
      lastTrace=trace;
      let verified={status:'not_attempted',headers:{}};
      if(performPreflight) {
        verified=await requirements(signal);
        trace.challenge=verified.status;
        if(verified.status==='finalized') built.payload.client_prepare_state='success';
      }
      const headerExtras=verified.headers;
      let resp;let endpoint=trace.endpoint;
      async function post(path) {
        const headers={Accept:'text/event-stream','Content-Type':'application/json',...headerExtras};
        if(accessToken)headers.Authorization='Bearer '+accessToken;
        return fetcher(origin+path,{
          method:'POST', headers, body:JSON.stringify(built.payload),credentials:'same-origin',
          cache:'no-store',redirect:'error',signal,
        });
      }
      resp=await post(endpoint);
      if((resp.status===404 || resp.status===405) && !built.payload.conversation_id) {
        const fallback=core.ENDPOINTS.find(x=>x!==endpoint);
        if(fallback){endpoint=fallback;resp=await post(endpoint);}
      }
      trace.endpoint=endpoint;trace.httpStatus=resp.status;trace.status=resp.ok?'streaming':'rejected';
      if(!resp.ok) {
        const snippet=await resp.text().catch(()=>'');
        throw responseError(resp.status,snippet.slice(0,5000));
      }
      const result=await readStream(resp,onProgress,signal);
      if(result.error) {
        trace.status='backend_error';throw new Error(result.error+' '+(result.errorCode||''));
      }
      if(!result.text){trace.status='missing_assistant_text';throw new Error('Request was accepted but no supported assistant text events were decoded. Check the response schema.');}
      if(!result.done){trace.status='partial_stream';previous={conversationId:'',parentMessageId:''};}
      else if(!result.conversationId || !result.lastAssistantMessageId) {
        trace.status='partial';
        // Preserve answer, but do not guess continuation identifiers.
        previous={conversationId:'',parentMessageId:''};
      }else{
        trace.status='complete';
        previous={conversationId:result.conversationId,parentMessageId:result.lastAssistantMessageId};
      }
      return {text:result.text,conversationId:result.conversationId||'',parentMessageId:result.lastAssistantMessageId||'',
        trace:{...trace},streamCompleted:Boolean(result.done),continued:Boolean(previous.conversationId&&previous.parentMessageId)};
    }
    function reset() {previous={conversationId:'',parentMessageId:''};lastTrace=null;}
    function state() {return {signedIn,modelCount:models.length,trace:lastTrace?{...lastTrace}:null,
      conversationId:previous.conversationId||'',canContinue:Boolean(previous.conversationId&&previous.parentMessageId)};}
    function disconnect() {accessToken='';signedIn=false;models=[];reset();}
    return Object.freeze({connect,discoverModels,send,reset,state,disconnect,requirements});
  }
  if(root?.location?.origin==='https://chatgpt.com')observeLiveChatRequests();
  return Object.freeze({service,loadObserved,cleanObserved,observeLiveChatRequests});
});
