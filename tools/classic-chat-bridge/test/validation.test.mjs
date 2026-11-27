import test from 'node:test';
import assert from 'node:assert/strict';
import {PORT,allowedOrigin,allowedHost,checkPair,validateMessages,validateModel,safeError} from '../validation.mjs';

test('strict local host and origin rules',()=>{
  assert.equal(allowedHost(`127.0.0.1:${PORT}`),true);
  assert.equal(allowedHost('evil.local:17879'),false);
  assert.equal(allowedOrigin('https://pragmatic-vfx.com'),true);
  assert.equal(allowedOrigin('https://evil.example'),false);
  assert.equal(allowedOrigin('https://raw.githack.com'),false);
  assert.equal(allowedOrigin('http://127.0.0.1:17879'),true);
});
test('constant time paired token comparator',()=>{
  assert.equal(checkPair('f'.repeat(32),'f'.repeat(32)),true);
  assert.equal(checkPair('f'.repeat(32),'e'.repeat(32)),false);
  assert.equal(checkPair(undefined,'f'.repeat(32)),false);
});
test('valid user messages',()=>{
  assert.deepEqual(validateMessages([{role:'user',content:'Hello'}]),[{role:'user',content:'Hello'}]);
});
test('reject assistant as final turn',()=>{
  assert.throws(()=>validateMessages([{role:'assistant',content:'oops'}]));
});
test('reject invalid role',()=>{
  assert.throws(()=>validateMessages([{role:'system',content:'oops'}]));
});
test('reject oversize content',()=>{
  assert.throws(()=>validateMessages([{role:'user',content:'x'.repeat(24001)}]));
});
test('reject missing or unauthorized models',()=>{
  assert.equal(validateModel('example',[{slug:'example'}]),'example');
  assert.throws(()=>validateModel('unknown',[{slug:'example'}]));
});
test('safe errors do not expose tokens',()=>{
  assert.equal(safeError(new Error('Authorization: Bearer secret')),'The local bridge could not complete this request. See the terminal for a non-secret error code.');
});
