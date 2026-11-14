<?php
declare(strict_types=1);

// Creates a fresh ignored fixture and migrates the committed v1 schema. It never
// uses the operator's configured database and intentionally retains the fixture.
require_once __DIR__ . '/../cpanel/server/validation.php';
require_once __DIR__ . '/../cpanel/server/database.php';
require_once __DIR__ . '/../cpanel/server/privacy.php';
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) return false;
    throw new ErrorException($message, 0, $severity, $file, $line);
});
$checks = 0;
function check(bool $condition, string $message): void { global $checks; $checks++; if (!$condition) throw new RuntimeException($message); }
$fixture = dirname(__DIR__) . '/.sites-runtime/privacy-migration-' . bin2hex(random_bytes(8));
if (!mkdir($fixture . '/public', 0700, true) || !mkdir($fixture . '/private', 0700, true)) throw new RuntimeException('Cannot create migration fixture.');
$previousDirectory = getenv('SEARCHPARTY_DATA_DIR');
$previousRoot = $_SERVER['DOCUMENT_ROOT'] ?? null;
try {
    $now = (int)floor(microtime(true) * 1000);
    $old = $now - 365 * 86400000;
    $recent = $now - 86400000;
    $db = new PDO('sqlite:' . $fixture . '/private/searchparty.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
    $db->exec(file_get_contents(__DIR__ . '/fixtures/schema-v1.sql'));
    $db->exec('PRAGMA user_version = 1');
    $statement = $db->prepare('INSERT INTO guests(id,token_hash,name,created_at,expires_at) VALUES (?,?,?,?,?)');
    $statement->execute(['legacy-owner', 'hash', 'Legacy owner', $old, $now + 86400000]);
    foreach (['legacy-closed' => 'found', 'legacy-recent' => 'active', 'legacy-inactive' => 'active'] as $id => $status) {
        $statement = $db->prepare('INSERT INTO searches(id,code,pet_name,pet_type,description,location_label,lat,lng,last_seen_at,instructions,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
        $statement->execute([$id, strtoupper($id), 'Test', 'dog', 'Test only', 'Test', 51, -1, $old, '', $status, $old]);
        $statement = $db->prepare("INSERT INTO memberships(search_id,guest_id,role,status,joined_at) VALUES (?,'legacy-owner','organiser','approved',?)");
        $statement->execute([$id, $old]);
    }
    $statement = $db->prepare("INSERT INTO messages(id,search_id,author_id,kind,content,created_at) VALUES ('recent-message','legacy-recent','legacy-owner','update','Recent activity',?)");
    $statement->execute([$recent]);
    $statement = null;
    $db = null;
    putenv('SEARCHPARTY_DATA_DIR=' . $fixture . '/private');
    $_SERVER['DOCUMENT_ROOT'] = $fixture . '/public';
    $db = SearchParty\database();
    check((int)$db->query('PRAGMA user_version')->fetchColumn() === 2, 'Existing database migrates to version 2.');
    $closedAt = (int)$db->query("SELECT closed_at FROM searches WHERE id='legacy-closed'")->fetchColumn();
    check($closedAt >= $now && $closedAt <= (int)floor(microtime(true) * 1000), 'Unknown legacy closure gets the migration timestamp, not the old creation date.');
    check((int)$db->query("SELECT activity_at FROM searches WHERE id='legacy-recent'")->fetchColumn() === $recent, 'Migration preserves latest recorded participant activity.');
    check((int)$db->query("SELECT activity_at FROM searches WHERE id='legacy-inactive'")->fetchColumn() === $old, 'Migration retains old creation time when no later activity exists.');
    check($db->query("SELECT terms_version FROM guests WHERE id='legacy-owner'")->fetchColumn() === null, 'Existing profile is not falsely recorded as having accepted new terms.');
    $db->exec('BEGIN IMMEDIATE');
    $counts = SearchParty\Privacy::cleanup($db, $now + 1000);
    $db->exec('COMMIT');
    check($counts['searchesDeleted'] === 1 && (int)$db->query('SELECT COUNT(*) FROM searches')->fetchColumn() === 2, 'Only the genuinely inactive legacy room becomes retention-eligible.');
    check((int)$db->query("SELECT COUNT(*) FROM searches WHERE id='legacy-closed'")->fetchColumn() === 1, 'Recently introduced closure clock prevents immediate deletion of legacy completed room.');
    $db = null;
    $again = SearchParty\database();
    check((int)$again->query("SELECT closed_at FROM searches WHERE id='legacy-closed'")->fetchColumn() === $closedAt, 'Opening an already migrated database is idempotent.');
    check($again->query('PRAGMA foreign_key_check')->fetchAll() === [], 'Migrated and cleaned database retains foreign-key integrity.');
    echo "Passed $checks legacy SQLite migration assertions.\n";
} finally {
    putenv($previousDirectory === false ? 'SEARCHPARTY_DATA_DIR' : 'SEARCHPARTY_DATA_DIR=' . $previousDirectory);
    if ($previousRoot === null) unset($_SERVER['DOCUMENT_ROOT']); else $_SERVER['DOCUMENT_ROOT'] = $previousRoot;
}
