const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../native-core.js');

test('constructs new Chat turn without official DOM dependency',()=>{
  const {payload,userMessageId}=core.buildPayload({prompt:'   hello  ',model:'auto',effort:'extended',idFactory:()=> '3f2190a5-c564-4f7e-86f1-135f4e3cff1a', timezone:'Asia/Bangkok',timezoneOffsetMinutes:-420});
  assert.equal(userMessageId,payload.messages[0].id);
  assert.equal(payload.messages[0].content.parts[0],'hello');
  assert.equal(payload.parent_message_id,'client-created-root');
  assert.equal(payload.model,'auto');
  assert.equal(payload.thinking_effort,'extended');
  assert.equal(payload.timezone,'Asia/Bangkok');
  assert.equal(payload.timezone_offset_min,-420);
  assert.equal(payload.conversation_mode.kind,'primary_assistant');
  assert.equal(Object.hasOwn(payload,'client_prepare_state'),false);
});

test('continues a conversation with correct IDs',()=>{
  const {payload}=core.buildPayload({prompt:'next',model:'gpt-6-2-thinking',conversationId:'7be025ec-ecbb-4d8a-85d9-a91f73b208d0',
    parentMessageId:'b8475487-4b34-4d44-b258-a828a7382755',idFactory:()=>'m-12345678'});
  assert.equal(payload.conversation_id,'7be025ec-ecbb-4d8a-85d9-a91f73b208d0');
  assert.equal(payload.parent_message_id,'b8475487-4b34-4d44-b258-a828a7382755');
});

test('rejects insecure inputs and ignores unknown captured settings',()=>{
  assert.throws(()=>core.buildPayload({prompt:'  '}));
  assert.throws(()=>core.buildPayload({prompt:'text',model:'bad space'}));
  assert.throws(()=>core.buildPayload({prompt:'text',effort:'<>bad'}));
  const {payload}=core.buildPayload({prompt:'okay', capturedOptions:{authorization:'SECRET',client_prepare_state:'success',force_parallel_switch:'auto',enable_message_followups:true},idFactory:()=>'m-12345678'});
  assert.equal(JSON.stringify(payload).includes('SECRET'),false);
  assert.equal(Object.hasOwn(payload,'client_prepare_state'),false);
  assert.equal(payload.force_parallel_switch,'auto');
  assert.equal(payload.enable_message_followups,true);
});

test('parses common Chat catalog shapes',()=>{
  assert.deepEqual(core.parseCatalog({models:[{slug:'auto',title:'Automatic'},{slug:'gpt-6-thinking',display_name:'GPT 6 Thinking'}]}),[
    {slug:'auto',name:'Automatic'},{slug:'gpt-6-thinking',name:'GPT 6 Thinking'},
  ]);
});

test('streams fragmented SSE and extracts conversation lineage',()=>{
  let current={};
  const sse=core.sseAccumulator(data=>current=core.parseEvent(data,current));
  sse.feed('data: {"conversation_id":"conv-cb9b0f26","message":{"author":{"role":"assistant"},');
  sse.feed('"id":"msg-56a92b33","content":{"parts":["hello world"]}}}\r\n\r\ndata: [DON');
  sse.feed('E]\n\n');sse.finish();
  assert.equal(current.conversationId,'conv-cb9b0f26');
  assert.equal(current.lastAssistantMessageId,'msg-56a92b33');
  assert.equal(current.text,'hello world');
  assert.equal(current.done,true);
});

test('handles patch and Response API delta styles',()=>{
  let s={};
  s=core.parseEvent({v:[{p:'/message/content/parts/0',o:'append',v:'hello '}]},s);
  s=core.parseEvent({v:[{p:'/message/content/parts/0',o:'append',v:'world'}]},s);
  assert.equal(s.text,'hello world');
  s=core.parseEvent({type:'response.output_text.delta',delta:'!'},s);
  assert.equal(s.text,'hello world!');
});

test('states 403 rejection without pretending service is available',()=>{
  assert.match(core.backendError(403),/Sentinel requirements may block/);
  assert.match(core.backendError(429),/allowance/);
});
