import { spawnSync } from 'node:child_process';

// User-bound DPAPI encryption. Plaintext is transported to PowerShell only through
// process stdin, never a command-line argument, URL, log, or environment variable.
const ENCRYPT_PS = `
$ErrorActionPreference = 'Stop'
$plaintext = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
try {
  $protected = [Security.Cryptography.ProtectedData]::Protect($plaintext, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
  [Console]::Out.Write([Convert]::ToBase64String($protected))
} finally { [Array]::Clear($plaintext, 0, $plaintext.Length) }
`;
const DECRYPT_PS = `
$ErrorActionPreference = 'Stop'
$ciphertext = [Convert]::FromBase64String([Console]::In.ReadToEnd().Trim())
$plaintext = [Security.Cryptography.ProtectedData]::Unprotect($ciphertext, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
try { [Console]::Out.Write([Convert]::ToBase64String($plaintext)) }
finally { [Array]::Clear($plaintext, 0, $plaintext.Length) }
`;
function dpapi(script, data) {
  if(process.platform!=='win32') throw new Error('This prototype bridge requires Windows DPAPI.');
  const input = Buffer.from(data).toString('base64');
  const result = spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{
    input, encoding:'utf8',windowsHide:true,shell:false,maxBuffer:4*1024*1024,timeout:30000
  });
  if(result.status!==0 || result.error || !/^[A-Za-z0-9+/]+={0,2}$/.test((result.stdout||'').trim())) throw new Error('Windows DPAPI encryption is unavailable.');
  return Buffer.from(result.stdout.trim(),'base64');
}
let verifiedAvailable;
export const windowsEncryption = {
  id:'windows-dpapi-current-user-v1',
  isAvailable(){
    if(process.platform!=='win32')return false;
    if(verifiedAvailable===true)return true;
    try {const c=dpapi(ENCRYPT_PS,Buffer.from('bridge-encryption-test'));verifiedAvailable=dpapi(DECRYPT_PS,c).toString('utf8')==='bridge-encryption-test';return verifiedAvailable;}catch{return false;}
  },
  encrypt(plaintext){return dpapi(ENCRYPT_PS,Buffer.from(plaintext,'utf8'));},
  decrypt(ciphertext){return dpapi(DECRYPT_PS,Buffer.from(ciphertext)).toString('utf8');},
};
