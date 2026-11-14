import { spawnSync } from 'node:child_process';

const php = process.env.PHP_BINARY || 'php';
const result = spawnSync(php, ['tests/php-validation.php'], { stdio: 'inherit' });
if (result.error?.code === 'ENOENT') {
  console.error('PHP was not found. Install PHP 8.1+ on PATH, or set PHP_BINARY to your php executable.');
}
process.exit(result.status ?? 1);
