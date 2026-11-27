import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { createChatGPT } from '@siwc/local';
import { windowsEncryption } from './windows-dpapi.mjs';
import { PORT,allowedOrigin,allowedHost,validateModel,validateMessages,safeError,checkPair } from './validation.mjs';

if(process.platform!=='win32') throw new Error('This bridge requires Windows 11 for DPAPI credential encryption.');
if(!(await windowsEncryption.isAvailable())) throw new Error(`Windows user-bound DPAPI encryption is unavailable: ${windowsEncryption.diagnostic()}`);
const HOME=dirname(fileURLToPath(import.meta.url));
const STATIC=resolve(HOME,'../../classic-chat');
const pairing=randomBytes(16).toString('hex');
const client=createChatGPT({
  appName:'Classic Chat local bridge',
  appId:'classic-chat-bridge',
  redirectPort:0,
  storageDir:join(homedir(),'.config','classic-chat-bridge'),
  credentialEncryption:windowsEncryption,
});
let models=[];let session={status:'disconnected',sharing:false};let signingIn=false;let activeRequest=null;let lastError='';
function logCode(prefix, error){console.error(prefix,typeof error?.code==='string'?error.code:'unexpected_error');}
async function refreshSession(){session=await client.getSession();return session;}
async function refreshModels(){
  if(session.status==='connected'&&session.sharing){try{models=await client.listModels();lastError='';}catch(error){logCode('Model discovery failed:',error);models=[];lastError=safeError(error);}}
  else models=[];
}
await refreshSession();
if(session.status==='connected'&&session.sharing) void refreshModels();

function reply(res,status,data){if(res.writableEnded||res.destroyed)return;res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function failure(res,status,message){reply(res,status,{error:message});}
function setCORS(req,res){const origin=req.headers.origin; if(origin&&allowedOrigin(origin)){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, X-Classic-Pairing');
  res.setHeader('Access-Control-Allow-Private-Network','true');res.setHeader('Cross-Origin-Resource-Policy','cross-origin');
  res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
}
function safePair(req){return checkPair(req.headers['x-classic-pairing'],pairing);}
async function body(req,cap=160000){
  let n=0;const chunks=[];
  for await(const c of req){n+=c.length;if(n>cap)throw Error('Request is too large.');chunks.push(c);}
  try{const v=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!v||typeof v!=='object'||Array.isArray(v))throw Error();return v;}
  catch{throw Error('Expected a valid JSON object.');}
}
async function serve(res,path){
  const table={'/':'index.html','/index.html':'index.html','/app.js':'app.js','/archive.js':'archive.js','/styles.css':'styles.css','/classic-chat/':'index.html'};
  if(!Object.hasOwn(table,path))return false;
  const filename=join(STATIC,table[path]);
  try{const data=await readFile(filename);res.writeHead(200,{'Content-Type':filename.endsWith('.css')?'text/css; charset=utf-8':filename.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; object-src 'none'",'Cache-Control':'no-store'});res.end(data);}catch{failure(res,404,'Local interface files not found.');}return true;
}
const server=createServer(async(req,res)=>{
  // Public origins cannot reach this service without the per-run terminal pairing code.
  // Strict host + Origin checks also defend against DNS rebinding and browser CSRF.
  if(!allowedHost(req.headers.host)||!allowedOrigin(req.headers.origin)){failure(res,403,'Not an allowed browser origin.');return;}
  setCORS(req,res);
  const method=req.method||'GET';
  if(method==='OPTIONS'){res.writeHead(204);res.end();return;}
  let url;try{url=new URL(req.url||'/',`http://127.0.0.1:${PORT}`);}catch{failure(res,400,'Bad request.');return;}
  if(method==='GET'&&await serve(res,url.pathname))return;
  if(url.pathname==='/health'&&method==='GET'){reply(res,200,{ok:true,pairingRequired:true});return;}
  if(!safePair(req)){failure(res,401,'Pairing code is missing or incorrect.');return;}
  try{
    if(url.pathname==='/api/state'&&method==='GET'){
      await refreshSession();
      reply(res,200,{session:{status:session.status,sharing:session.sharing,identity:session.identity||null},models,signingIn,lastError});return;
    }
    if(url.pathname==='/api/sign-in'&&method==='POST'){
      if(signingIn){failure(res,409,'An authorization is already in progress.');return;}
      await body(req);
      signingIn=true;lastError='';reply(res,202,{started:true});
      void client.signIn({reconsent:true}).then(async result=>{session=result;await refreshModels();console.log('ChatGPT sign-in complete.');})
      .catch(error=>{logCode('Sign-in failed:',error);lastError=safeError(error);})
      .finally(()=>{signingIn=false;void refreshSession().catch(()=>{});});return;
    }
    if(url.pathname==='/api/disconnect'&&method==='POST'){
      if(activeRequest){failure(res,409,'Stop the active response before disconnecting.');return;}
      await body(req);await client.disconnect();await refreshSession();models=[];reply(res,200,{ok:true});return;
    }
    if(url.pathname==='/api/stop'&&method==='POST'){
      await body(req);activeRequest?.abort();reply(res,200,{stopped:Boolean(activeRequest)});return;
    }
    if(url.pathname==='/api/models'&&method==='POST'){
      await body(req);await refreshSession();await refreshModels();reply(res,200,{models});return;
    }
    if(url.pathname==='/api/test'&&method==='POST'){
      if(activeRequest){failure(res,409,'Another request is running.');return;}
      await refreshSession();if(session.status!=='connected'||!session.sharing){failure(res,401,'Sign in with ChatGPT and enable plan sharing first.');return;}
      const data=await body(req);validateModel(data.model,models);
      const ac=new AbortController();activeRequest=ac;
      try{const result=await client.streamResponse({model:data.model,input:'Reply with the single word CONNECTED.',signal:ac.signal});reply(res,200,{reply:result.text});}
      finally{activeRequest=null;}return;
    }
    if(url.pathname==='/api/send'&&method==='POST'){
      if(activeRequest){failure(res,409,'Another response is already in progress.');return;}
      await refreshSession();if(session.status!=='connected'||!session.sharing){failure(res,401,'Sign in with ChatGPT and enable plan sharing first.');return;}
      const data=await body(req);validateModel(data.model,models);const messages=validateMessages(data.messages);
      const ac=new AbortController();activeRequest=ac;
      res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store','X-Accel-Buffering':'no','Connection':'keep-alive'});
      const send=ev=>{if(!res.destroyed&&!res.writableEnded)res.write('data: '+JSON.stringify(ev)+'\n\n');};
      res.on('close',()=>ac.abort());
      try{
        await client.streamResponse({model:data.model,input:messages,signal:ac.signal,onDelta:delta=>send({type:'delta',text:delta})});
        send({type:'done'});
      }catch(error){logCode('Response failed:',error);send({type:'error',message:safeError(error)});}
      finally{activeRequest=null;res.end();}
      return;
    }
    failure(res,404,'Not found.');
  }catch(error){logCode('Request failed:',error);const isInputError=['Select a model','Submit','Messages','The conversation','Expected','Request is','The final message'].some(prefix=>error?.message?.startsWith(prefix));failure(res,isInputError?400:500,isInputError?error.message:safeError(error));}
});
server.requestTimeout=220000;
server.headersTimeout=10000;
server.listen(PORT,'127.0.0.1',()=>{
  console.log('\nCLASSIC CHAT LOCAL BRIDGE');
  console.log('Open the local Classic Chat app: http://127.0.0.1:'+PORT+'/');
  console.log('The third-party raw preview is static only and cannot connect to this bridge.');
  console.log('Pairing code: '+pairing+'\n');
  console.log('Paste this pairing code into the website. It changes every time the bridge starts.');
  console.log('Press Ctrl+C here to stop the bridge.\n');
});
server.on('error',error=>{console.error('Could not bind local bridge on port '+PORT+':',error.code);process.exitCode=1;});
