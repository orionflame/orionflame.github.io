import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

// Pin the exact public DevKit revision used while implementing this prototype.
// Review upstream updates and their noncommercial licence before changing it.
const DEVKIT_REVISION = '0a36fefeb913055c8c7a1a29b63d82b96b2e841a';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VENDOR = resolve(ROOT, 'vendor/siwc-devkit');

function command(file, args, cwd) {
  process.stdout.write(`\n> ${file} ${args.join(' ')}\n`);
  const result = spawnSync(file, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' },
  });
  if (result.status !== 0) throw new Error(`${file} exited with status ${result.status ?? 'unknown'}`);
}

function capture(file, args, cwd) {
  const result = spawnSync(file, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32' });
  if (result.status !== 0) throw new Error(`${file} ${args[0]} failed: ${result.stderr || 'unknown error'}`);
  return result.stdout.trim();
}

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  throw new Error('This prototype requires Node.js 22.12 or newer.');
}

if (!existsSync(resolve(VENDOR, '.git'))) {
  if (existsSync(VENDOR)) throw new Error('vendor/siwc-devkit exists but is not a Git clone. Inspect it before retrying.');
  mkdirSync(resolve(ROOT, 'vendor'), { recursive: true });
  command('git', ['init', 'siwc-devkit'], resolve(ROOT, 'vendor'));
  command('git', ['remote', 'add', 'origin', 'https://github.com/openai/sign-in-with-chatgpt-devkit.git'], VENDOR);
}

// Use a fixed upstream snapshot, rather than silently pulling mutable main.
const revProbe = spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: VENDOR, encoding: 'utf8', shell: process.platform === 'win32' });
const current = revProbe.status === 0 ? revProbe.stdout.trim().toLowerCase() : '';
if (current !== DEVKIT_REVISION) {
  command('git', ['fetch', '--depth', '1', 'origin', DEVKIT_REVISION], VENDOR);
  command('git', ['checkout', '--detach', DEVKIT_REVISION], VENDOR);
}
if (capture('git', ['rev-parse', 'HEAD'], VENDOR).toLowerCase() !== DEVKIT_REVISION) {
  throw new Error('The DevKit checkout does not match its pinned revision.');
}

command('npm', ['ci', '--ignore-scripts'], VENDOR);
command('npm', ['run', 'build', '-w', '@siwc/local'], VENDOR);
command('npm', ['install', '--ignore-scripts'], ROOT);
// Electron binaries require their install script. Run just Electron's installer,
// never a postinstall script from an unrelated dependency.
const electronInstall = resolve(ROOT, 'node_modules/electron/install.js');
if (!existsSync(electronInstall)) throw new Error('Electron installer not found after npm install.');
command('node', [electronInstall], ROOT);
console.log('\nSetup complete. Run: npm start');
