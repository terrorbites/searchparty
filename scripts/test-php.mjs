import { spawnSync } from 'node:child_process';

const php = process.env.PHP_BINARY || 'php';
for (const test of ['tests/php-validation.php', 'tests/php-privacy.php', 'tests/php-migration.php']) {
  const result = spawnSync(php, [test], { stdio: 'inherit' });
  if (result.error?.code === 'ENOENT') {
    console.error('PHP was not found. Install PHP 8.1+ with PDO SQLite on PATH, or set PHP_BINARY to your php executable.');
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
