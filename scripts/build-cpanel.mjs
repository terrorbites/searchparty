import { cpSync, existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['./node_modules/vite/bin/vite.js', 'build', '--config', 'vite.cpanel.config.ts'], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
if (!existsSync('cpanel/api.php')) throw new Error('The PHP backend is missing.');
for (const name of readdirSync('cpanel')) cpSync(resolve('cpanel', name), resolve('release-upload', name), { recursive: true });
await import('./build-legal.mjs');
console.log('cPanel upload folder ready: ' + resolve('release-upload'));
