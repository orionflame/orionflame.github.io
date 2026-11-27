import { existsSync, mkdirSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const ROOT=dirname(fileURLToPath(import.meta.url));
const VENDOR=resolve(ROOT,'vendor/siwc-devkit');
const PIN='0a36fefeb913055c8c7a1a29b63d82b96b2e841a';
function call(command,args,cwd){
  process.stdout.write(`\n> ${command} ${args.join(' ')}\n`);
  const r=spawnSync(command,args,{cwd,stdio:'inherit',shell:process.platform==='win32',timeout:600000});
  if(r.status!==0)throw new Error(`${command} failed with ${r.status}`);
}
const [nodeMajor,nodeMinor]=process.versions.node.split('.').map(Number);
if(nodeMajor<22||(nodeMajor===22&&nodeMinor<12))throw Error('Node.js 22.12+ is required.');
mkdirSync(resolve(ROOT,'vendor'),{recursive:true});
if(!existsSync(resolve(VENDOR,'.git'))){
  call('git',['clone','--filter=blob:none','--no-checkout','https://github.com/openai/sign-in-with-chatgpt-devkit.git',VENDOR],ROOT);
}
call('git',['fetch','--depth=1','origin',PIN],VENDOR);
call('git',['checkout','--detach',PIN],VENDOR);
call('npm',['install','--no-audit','--no-fund'],VENDOR);
call('npm',['run','build','-w','@siwc/local'],VENDOR);
call('npm',['install','--no-audit','--no-fund'],ROOT);
process.stdout.write('\nSetup complete. Start with: npm start\n');
