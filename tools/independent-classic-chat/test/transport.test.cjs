const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../native-core.js');
globalThis.NativeChatWireCore = core;
const wire = require('../native-transport.js');
const dummy = (body, status=200, type='application/json') => new Response(type==='text/event-stream'?body:JSON.stringify(body),{
  status,headers:{'content-type':type},
});
const stream=(reply='Hello from Chat')=>[
  'data: '+JSON.stringify({conversation_id:'8fc88a6c-590d-4cee-b95a-aa25db6889c1',message:{id:'61f071fb-3388-4307-8dbf-a469b5558787',author:{role:'assistant'},content:{parts:[reply]}}}),
  'data: [DONE]',
].join('\n\n')+'\n\n';

test('direct Chat send uses browser session only, never Work/Codex',async()=>{
  const calls=[];
  const f=async (url, init)=>{
    calls.push({url,init});
    if(url.endsWith('/api/auth/session'))return dummy({user:{name:'Test'},accessToken:'NEVER_EXPORT_ACCESS_TOKEN'});
    if(url.endsWith('/backend-api/models'))return dummy({models:[{slug:'auto',title:'Auto'}]});
    if(url.endsWith('/backend-api/f/conversation'))return dummy(stream(),'200','text/event-stream');
    throw Error('Unexpected route: '+url);
  };
  const client=wire.service(f);
  const connected=await client.connect();
  assert.equal(connected.connected,true);
  assert.deepEqual(await client.discoverModels(),[{slug:'auto',name:'Auto'}]);
  const result=await client.send({prompt:'Hello?',model:'auto',performPreflight:false});
  assert.equal(result.text,'Hello from Chat');
  assert.equal(result.continued,true);
  assert.equal(calls.length,3);
  assert.ok(calls.every(c=>c.url.startsWith('https://chatgpt.com/')));
  assert.ok(calls.every(c=>c.init.credentials==='same-origin' && c.init.redirect==='error'));
  assert.equal(calls[2].init.headers.Authorization,'Bearer NEVER_EXPORT_ACCESS_TOKEN');
  assert.equal(calls[2].init.method,'POST');
  assert.equal(calls[2].url,'https://chatgpt.com/backend-api/f/conversation');
  assert.equal(Object.hasOwn(calls[2].init.headers,'Cookie'),false);
  assert.ok(!JSON.stringify(client.state()).includes('NEVER_EXPORT_ACCESS_TOKEN'));
  assert.ok(!JSON.stringify(result.trace).includes('NEVER_EXPORT_ACCESS_TOKEN'));
  assert.ok(!JSON.stringify(result.trace).includes('Hello?'));
});

test('server-side Sentinel requirement halts direct requests',async()=>{
  const paths=[];
  const f=async(url,init)=>{
    paths.push(url);
    if(url.endsWith('/api/auth/session'))return dummy({user:{name:'test'},accessToken:'secret'});
    if(url.endsWith('/sentinel/chat-requirements/prepare'))return dummy({prepare_token:'redacted',turnstile:{required:true}});
    throw Error('POST conversation must never occur after challenge');
  };
  const client=wire.service(f);await client.connect();
  await assert.rejects(client.send({prompt:'Test'}),/verification/);
  assert.equal(paths.some(p=>p.endsWith('/f/conversation')),false);
});

test('403 is accurately surfaced with no unauthorized fallback',async()=>{
  const paths=[];
  const f=async(url)=>{
    paths.push(url);
    if(url.endsWith('/api/auth/session'))return dummy({user:{id:'test'},accessToken:'secret'});
    return dummy({error:{message:'server refuses'}},403);
  };
  const client=wire.service(f);await client.connect();
  await assert.rejects(client.send({prompt:'test',performPreflight:false}),/HTTP 403/);
  assert.deepEqual(paths.slice(1),['https://chatgpt.com/backend-api/f/conversation']);
  assert.equal(client.state().trace.httpStatus,403);
  assert.equal(client.state().trace.status,'rejected');
});

test('fallback is limited to 404/405 and native Chat endpoint',async()=>{
  const paths=[];
  const f=async(url)=>{
    paths.push(url);
    if(url.endsWith('/api/auth/session'))return dummy({user:{id:'test'},accessToken:'secret'});
    if(url.endsWith('/f/conversation'))return dummy({},404);
    if(url.endsWith('/backend-api/conversation'))return dummy(stream(),'200','text/event-stream');
    throw Error('Wrong route');
  };
  const client=wire.service(f);await client.connect();
  const result=await client.send({prompt:'Hello',performPreflight:false});
  assert.equal(result.trace.endpoint,'/backend-api/conversation');
  assert.equal(paths.length,3);
});

test('a fresh turn cannot accidentally continue another conversation',async()=>{
  const payloads=[];
  const f=async(url,init)=>{
    if(url.endsWith('/api/auth/session'))return dummy({user:{id:'test'},accessToken:'secret'});
    payloads.push(JSON.parse(init.body));return dummy(stream(),'200','text/event-stream');
  };
  const client=wire.service(f);await client.connect();
  await client.send({prompt:'First',performPreflight:false});
  await client.send({prompt:'New chat',conversationId:'',parentMessageId:'',performPreflight:false});
  assert.equal(Object.hasOwn(payloads[1],'conversation_id'),false);
  assert.equal(payloads[1].parent_message_id,'client-created-root');
});

test('only whitelisted observed settings can be stored',()=>{
  const observed=wire.cleanObserved({model:'gpt-6',thinking_effort:'extended',cookie:'secret',token:'secret2', messages:[{content:'private'}],client_prepare_state:'success'});
  assert.deepEqual(observed,{model:'gpt-6',thinking_effort:'extended'});
});
