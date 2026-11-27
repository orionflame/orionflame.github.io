import test from 'node:test';
import assert from 'node:assert/strict';
import '../../../classic-chat/archive.js';
const {normalize, merge, MAX_IMPORT_BYTES} = globalThis.ClassicArchive;
const msg = (id, content, status = 'done') => ({id, role:'user', content, status});
const chat = (id, messages = [msg('m1','Hello')]) => ({id,title:'Test',messages});
const pack = (chats, activeId) => ({version:1,chats,activeId});

test('old local storage and exported archives retain complete histories',()=>{
  const long = '雪🙂'.repeat(15000);
  const many = Array.from({length:151},(_,i)=>chat('c'+i,Array.from({length:71},(_,j)=>msg('m'+j,i===150&&j===70?long:'hello'))));
  const original = {chats:many,activeId:'c150'};
  assert.deepEqual(normalize(original), original);
  assert.deepEqual(normalize(pack(many,'c150'),true), original);
});
test('reload preserves failed turns and marks interrupted streams as incomplete',()=>{
  const a = normalize(pack([chat('c',[msg('m','partial','streaming'),msg('n','failed','error')])]),true);
  assert.equal(a.chats[0].messages[0].status,'error');
  assert.equal(a.chats[0].messages[0].content,'partial');
  assert.equal(a.chats[0].messages[1].status,'error');
});
test('import never overwrites an existing conversation and repeated imports are idempotent',()=>{
  const current=[chat('c')];
  const incoming=[chat('c',[msg('m1','different')]),chat('d')];
  const a=merge(current,incoming);
  assert.deepEqual(a.chats.map(c=>c.id),['c','c~import-1','d']);
  assert.equal(a.chats[0].messages[0].content,'Hello');
  assert.equal(a.imported,2);
  assert.equal(merge(a.chats,incoming).skipped,2);
  assert.equal(current.length,1);
});
test('malformed, ambiguous and unsupported backups are rejected',()=>{
  for(const x of [null,{}, {version:2,chats:[]},pack([chat('c'),chat('c')]),pack([chat('c',[msg('m','a'),msg('m','b')])]),pack([chat('c',[{id:'x',role:'system',content:'no'}])])])assert.throws(()=>normalize(x,true));
  assert.equal(MAX_IMPORT_BYTES,16*1024*1024);
});
test('only conversation fields enter the archive and content stays literal',()=>{
  const x=pack([{...chat('c',[{...msg('m','<script>alert(1)</script>'),extra:'unused'}]),token:'not a conversation field'}]);
  const a=normalize(x,true);
  assert.equal(a.chats[0].messages[0].content,'<script>alert(1)</script>');
  assert.equal('token' in a.chats[0],false);
  assert.equal('extra' in a.chats[0].messages[0],false);
});
