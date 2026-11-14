<?php
declare(strict_types=1);

// Invoke with the hosting account's PHP CLI. Never expose maintenance over HTTP.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/validation.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/privacy.php';

try {
    $dryRun = false;
    foreach (array_slice($argv, 1) as $argument) {
        if ($argument === '--dry-run') $dryRun = true;
        else throw new RuntimeException('Usage: php maintenance.php [--dry-run]');
    }
    $_SERVER['DOCUMENT_ROOT'] = dirname(__DIR__);
    $db = \SearchParty\database();
    $now = (int)floor(microtime(true) * 1000);
    $db->exec('BEGIN IMMEDIATE');
    try {
        $result = $dryRun ? ['eligible' => \SearchParty\Privacy::eligibleCounts($db, $now)] : \SearchParty\Privacy::cleanup($db, $now, 100);
        $db->exec('COMMIT');
    } catch (Throwable $error) { $db->exec('ROLLBACK'); throw $error; }
    echo json_encode(['dryRun' => $dryRun, 'checkedAt' => $now, 'result' => $result], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
} catch (Throwable $error) {
    fwrite(STDERR, 'SearchParty maintenance failed: ' . $error->getMessage() . PHP_EOL);
    exit(1);
}
