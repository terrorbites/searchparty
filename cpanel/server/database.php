<?php
declare(strict_types=1);

namespace SearchParty;

function insidePath(string $path, string $root): bool
{
    $normal = static fn(string $value): string => rtrim(str_replace('\\', '/', $value), '/');
    $path = $normal($path);
    $root = $normal($root);
    if (PHP_OS_FAMILY === 'Windows') { $path = strtolower($path); $root = strtolower($root); }
    return $path === $root || str_starts_with($path, $root . '/');
}

function database(): \PDO
{
    if (!extension_loaded('pdo_sqlite')) throw new \RuntimeException('Enable the pdo_sqlite PHP extension.');
    // Resolve every path before opening the database; a writable public directory
    // is never used as a fallback for private search data.
    $documentRoot = realpath((string)($_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__)));
    if ($documentRoot === false) throw new \RuntimeException('Cannot determine the document root.');
    $normalRoot = str_replace('\\', '/', $documentRoot);
    $publicRoot = $documentRoot;
    if (preg_match('~^(.*?)/(public_html|htdocs|www)(?:/|$)~i', $normalRoot, $match)) $publicRoot = $match[1] . '/' . $match[2];
    $configured = getenv('SEARCHPARTY_DATA_DIR');
    $directory = $configured !== false && $configured !== '' ? $configured : dirname($publicRoot) . DIRECTORY_SEPARATOR . '.searchparty-data';
    $normalDirectory = str_replace('\\', '/', $directory);
    if (!preg_match('~^(?:[A-Za-z]:/|/)~', $normalDirectory)) throw new \RuntimeException('SEARCHPARTY_DATA_DIR must be an absolute path outside the document root.');
    $previousMask = umask(0077);
    try {
        if (!is_dir($directory) && !@mkdir($directory, 0700, true)) throw new \RuntimeException('Private data directory is unavailable. Set SEARCHPARTY_DATA_DIR outside the document root.');
        $realDirectory = realpath($directory);
        if ($realDirectory === false || insidePath($realDirectory, $documentRoot) || insidePath($realDirectory, $publicRoot) || !is_writable($realDirectory)) throw new \RuntimeException('The data directory must be writable and outside all public document roots.');
        $file = $realDirectory . DIRECTORY_SEPARATOR . 'searchparty.sqlite';
        if (is_link($file)) throw new \RuntimeException('The database file must not be a symbolic link.');
        $db = new \PDO('sqlite:' . $file, null, null, [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION, \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC, \PDO::ATTR_STRINGIFY_FETCHES => false]);
        @chmod($file, 0600);
        $db->exec('PRAGMA busy_timeout = 5000');
        $db->exec('PRAGMA foreign_keys = ON');
        $db->exec('PRAGMA journal_mode = WAL');
        $version = (int)$db->query('PRAGMA user_version')->fetchColumn();
        if ($version < 2) {
            $db->exec('BEGIN IMMEDIATE');
            try {
                $currentVersion = (int)$db->query('PRAGMA user_version')->fetchColumn();
                if ($currentVersion === 0) {
                    $schema = file_get_contents(__DIR__ . '/schema.sql');
                    if ($schema === false) throw new \RuntimeException('Database schema is unavailable.');
                    $db->exec($schema);
                    $db->exec('PRAGMA user_version = 2');
                } elseif ($currentVersion === 1) {
                    $db->exec('ALTER TABLE guests ADD COLUMN terms_accepted_at INTEGER');
                    $db->exec('ALTER TABLE guests ADD COLUMN terms_version TEXT');
                    $db->exec('ALTER TABLE guests ADD COLUMN adult_confirmed_at INTEGER');
                    $db->exec('ALTER TABLE searches ADD COLUMN closed_at INTEGER');
                    $db->exec('ALTER TABLE searches ADD COLUMN activity_at INTEGER NOT NULL DEFAULT 0');
                    // The original schema did not record closure time. Give legacy
                    // completed searches a full retention period from migration.
                    $migrationTime = (int)floor(microtime(true) * 1000);
                    $statement = $db->prepare("UPDATE searches SET closed_at = ? WHERE status = 'found'");
                    $statement->execute([$migrationTime]);
                    $db->exec('UPDATE searches SET activity_at = MAX(created_at,
                        COALESCE((SELECT MAX(created_at) FROM messages WHERE search_id = searches.id), created_at),
                        COALESCE((SELECT MAX(created_at) FROM map_reports WHERE search_id = searches.id), created_at),
                        COALESCE((SELECT MAX(joined_at) FROM memberships WHERE search_id = searches.id), created_at),
                        COALESCE((SELECT MAX(location_changed_at) FROM memberships WHERE search_id = searches.id), created_at))');
                    $db->exec('CREATE INDEX searches_closed_retention_idx ON searches(status, closed_at)');
                    $db->exec('CREATE INDEX searches_active_retention_idx ON searches(status, activity_at)');
                    $db->exec('CREATE INDEX memberships_location_time_idx ON memberships(location_at)');
                    $db->exec('CREATE INDEX messages_author_idx ON messages(author_id, created_at)');
                    $db->exec('CREATE INDEX reports_author_idx ON map_reports(author_id, created_at)');
                    $db->exec('CREATE INDEX abuse_reporter_idx ON abuse_reports(reporter_id, created_at)');
                    $db->exec('PRAGMA user_version = 2');
                }
                $db->exec('COMMIT');
            } catch (\Throwable $error) { $db->exec('ROLLBACK'); throw $error; }
        } elseif ($version !== 2) throw new \RuntimeException('Database version is not supported by this release.');
        return $db;
    } finally { umask($previousMask); }
}
