// Starts a fresh, unauthenticated Windows bridge for a local smoke test.
// Child logs are discarded because the bridge prints an ephemeral pairing code.
// No pairing, sign-in, model request, or account data is used.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';

assert.equal(process.platform,'win32','Startup smoke requires Windows DPAPI');
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const origin='http://127.0.0.1:17879';
const home=await mkdtemp(join(tmpdir(),'classic-chat-smoke-'));
let child;
try {
  // Refuse to start if another service already occupies this port.
  const probe=createServer();
  await new Promise((ok,fail)=>{
    probe.once('error',fail);
    probe.listen(17879,'127.0.0.1',()=>probe.close(error=>error?fail(error):ok()));
  });
  child=spawn(process.execPath,[join(root,'server.mjs')],{
    cwd:root,
    env:{...process.env,USERPROFILE:home,HOME:home,APPDATA:join(home,'AppData','Roaming'),LOCALAPPDATA:join(home,'AppData','Local')},
    windowsHide:true,stdio:'ignore'
  });
  let spawnFailed=false;
  child.once('error',()=>{spawnFailed=true;});
  const get=path=>fetch(origin+path,{signal:AbortSignal.timeout(2000)});
  let ready=false;
  for(let i=0;i<60;i++){
    assert.ok(!spawnFailed&&child.exitCode===null&&child.signalCode===null,'Bridge exited before becoming ready');
    try {
      const response=await get('/health');
      ready=response.ok&&(await response.json()).pairingRequired===true;
      if(ready)break;
    } catch {}
    await delay(500);
  }
  assert.ok(ready,'Bridge did not become ready');
  const html=await get('/');
  assert.equal(html.status,200);
  assert.match(await html.text(),/Classic Chat/);
  for(const name of ['archive.js','app.js','styles.css']){
    const res=await get('/'+name);
    assert.equal(res.status,200);
    assert.equal(await res.text(),await readFile(join(root,'../../classic-chat',name),'utf8'));
  }
  const state=await get('/api/state');
  assert.equal(state.status,401,'Unauthenticated session state must remain private');
  console.log('PASS installed bridge: loopback startup, health, static assets, unpaired access rejected');
} finally {
  if(child && child.exitCode===null&&child.signalCode===null){
    const exited=once(child,'exit').catch(()=>{});
    child.kill();
    await Promise.race([exited,delay(5000)]);
  }
  await rm(home,{recursive:true,force:true,maxRetries:4,retryDelay:200});
}
