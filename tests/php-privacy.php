<?php
declare(strict_types=1);

// Frozen-clock, in-memory tests: never opens the configured production database.
require_once __DIR__ . '/../cpanel/server/validation.php';
require_once __DIR__ . '/../cpanel/server/privacy.php';
use SearchParty\Privacy;
use SearchParty\ApiError;

set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) return false;
    throw new ErrorException($message, 0, $severity, $file, $line);
});
$checks = 0;
function check(bool $condition, string $message): void { global $checks; $checks++; if (!$condition) throw new RuntimeException($message); }
function sql(PDO $db, string $query, array $args = []): PDOStatement { $statement = $db->prepare($query); $statement->execute($args); return $statement; }
function countRows(PDO $db, string $table, string $where = '1=1', array $args = []): int { return (int)sql($db, "SELECT COUNT(*) FROM $table WHERE $where", $args)->fetchColumn(); }
function fixture(): PDO
{
    $db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec(file_get_contents(__DIR__ . '/../cpanel/server/schema.sql'));
    return $db;
}
function guest(PDO $db, string $id, int $now, bool $expired = false): void
{
    sql($db, 'INSERT INTO guests(id,token_hash,name,created_at,expires_at,terms_accepted_at,terms_version,adult_confirmed_at) VALUES (?,?,?,?,?,?,?,?)', [$id, 'hash-' . $id, $id, $now - 200 * 86400000, $now + ($expired ? -1 : 1) * 86400000, $now - 1000, '2026-11-14', $now - 1000]);
}
function search(PDO $db, string $id, string $owner, int $now, string $status = 'active', ?int $closed = null, ?int $activity = null): void
{
    sql($db, 'INSERT INTO searches(id,code,pet_name,pet_type,description,location_label,lat,lng,last_seen_at,instructions,status,created_at,closed_at,activity_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [$id, strtoupper($id), 'Test pet', 'dog', 'Test only', 'Test', 51, -1, $now, '', $status, $now - 300 * 86400000, $closed, $activity ?? $now]);
    sql($db, "INSERT INTO memberships(search_id,guest_id,role,status,joined_at) VALUES (?,?,'organiser','approved',?)", [$id, $owner, $now]);
}
function member(PDO $db, string $search, string $guest, int $now): void { sql($db, "INSERT INTO memberships(search_id,guest_id,role,status,joined_at) VALUES (?,?,'helper','approved',?)", [$search, $guest, $now]); }
function message(PDO $db, string $id, string $search, string $author, int $now): void { sql($db, "INSERT INTO messages(id,search_id,author_id,kind,content,created_at) VALUES (?,?,?,'chat',?,?)", [$id, $search, $author, $id, $now]); }
function report(PDO $db, string $id, string $search, string $author, int $now): void { sql($db, "INSERT INTO map_reports(id,search_id,author_id,kind,lat,lng,radius,note,occurred_at,created_at) VALUES (?,?,?,'sighting',51,-1,50,?,?,?)", [$id, $search, $author, $id, $now, $now]); }
$now = 1800000000000;
$day = 86400000;

$db = fixture();
foreach (['owner', 'helper', 'other'] as $id) guest($db, $id, $now);
search($db, 'owned', 'owner', $now);
search($db, 'other', 'other', $now);
member($db, 'owned', 'helper', $now);
member($db, 'other', 'owner', $now);
message($db, 'owner-own-message', 'owned', 'owner', $now);
message($db, 'helper-message', 'owned', 'helper', $now);
message($db, 'owner-other-message', 'other', 'owner', $now);
message($db, 'other-message', 'other', 'other', $now);
report($db, 'helper-sighting', 'owned', 'helper', $now);
sql($db, "INSERT INTO abuse_reports(id,search_id,reporter_id,target_type,target_id,reason,created_at) VALUES ('abuse','owned','owner','member','helper','Test report',?)", [$now]);
ob_start(); Privacy::streamExport($db, 'owner', $now); $export = json_decode(ob_get_clean(), true, 512, JSON_THROW_ON_ERROR);
check($export['profile']['id'] === 'owner' && $export['profile']['termsVersion'] === '2026-11-14', 'Export includes own acknowledgement record.');
check(!isset($export['profile']['token_hash']) && !str_contains(json_encode($export), 'hash-owner'), 'Export never includes authentication hashes.');
check(count($export['messages']) === 2 && count($export['ownedSearches']) === 1 && count($export['memberships']) === 2, 'Complete export spans owned and joined searches.');
check(!str_contains(json_encode($export), 'helper-message') && !$export['mapReports'], 'Export excludes other helpers’ contributions.');
try { Privacy::deleteProfile($db, 'owner', false); throw new RuntimeException('Owner deletion should require acknowledgement.'); }
catch (ApiError $error) { check($error->status === 409, 'Owner deletion requires explicit owned-room acknowledgement.'); }
check(countRows($db, 'searches') === 2 && countRows($db, 'messages') === 4, 'Missing deletion acknowledgement changes nothing.');
Privacy::deleteProfile($db, 'helper', false);
check(countRows($db, 'guests', 'id = ?', ['helper']) === 0 && countRows($db, 'memberships', 'guest_id = ?', ['helper']) === 0, 'Profile deletion removes its session identity and joins.');
check(countRows($db, 'map_reports') === 0 && countRows($db, 'abuse_reports') === 0 && countRows($db, 'messages') === 3, 'Profile deletion removes own content and reports pointing to deleted profile.');
Privacy::deleteProfile($db, 'owner', true);
check(countRows($db, 'searches') === 1 && countRows($db, 'searches', 'id = ?', ['other']) === 1, 'Acknowledged owner deletion removes only owned rooms.');
check(countRows($db, 'messages') === 1 && countRows($db, 'messages', 'id = ?', ['other-message']) === 1, 'Other people’s separate room and content survive.');
check(countRows($db, 'guests') === 1, 'Other profiles survive deleted room cleanup.');
check($db->query('PRAGMA foreign_key_check')->fetchAll() === [], 'Deletion preserves foreign-key integrity.');

$db = fixture();
guest($db, 'owner', $now);
guest($db, 'helper', $now);
foreach (['expired-orphan', 'expired-reporter', 'expired-target', 'expired-member'] as $id) guest($db, $id, $now, true);
search($db, 'closed-old', 'owner', $now, 'found', $now - 90 * $day, $now);
search($db, 'closed-new', 'owner', $now, 'found', $now - 89 * $day, $now - 300 * $day);
search($db, 'inactive-old', 'owner', $now, 'active', null, $now - 180 * $day);
search($db, 'active-recent', 'owner', $now, 'active', null, $now - $day);
member($db, 'active-recent', 'helper', $now);
member($db, 'active-recent', 'expired-member', $now);
message($db, 'old-chat', 'closed-old', 'helper', $now - 91 * $day);
report($db, 'old-report', 'closed-old', 'helper', $now - 91 * $day);
sql($db, "INSERT INTO abuse_reports(id,search_id,reporter_id,target_type,target_id,reason,created_at) VALUES ('retained-abuse','active-recent','expired-reporter','member','expired-target','Test report',?)", [$now]);
sql($db, "UPDATE memberships SET lat=51,lng=-1,accuracy=10,location_at=? WHERE search_id='active-recent' AND guest_id='helper'", [$now - 30 * 60000]);
sql($db, "UPDATE memberships SET lat=51,lng=-1,accuracy=10,location_at=? WHERE search_id='active-recent' AND guest_id='owner'", [$now - 60000]);
sql($db, 'INSERT INTO rate_limits(key,count,resets_at) VALUES (?,?,?)', ['old', 1, $now - 2 * $day]);
sql($db, 'INSERT INTO rate_limits(key,count,resets_at) VALUES (?,?,?)', ['fresh', 1, $now + $day]);
sql($db, 'INSERT INTO message_dedupes(search_id,guest_id,fingerprint,created_at) VALUES (?,?,?,?)', ['active-recent', 'helper', 'old-fingerprint', $now - 120001]);
$before = Privacy::eligibleCounts($db, $now);
check($before['searches'] === 2 && $before['locations'] === 1 && $before['profiles'] === 1, 'Frozen-clock eligibility uses exact closure/inactivity/location boundaries.');
$db->exec('BEGIN IMMEDIATE');
$counts = Privacy::cleanup($db, $now);
$db->exec('COMMIT');
check($counts['searchesDeleted'] === 2 && $counts['locationsCleared'] === 1 && $counts['profilesDeleted'] === 1, 'Cleanup removes eligible searches, location and unreferenced expired profile.');
check(countRows($db, 'searches', 'id IN (?,?)', ['closed-new', 'active-recent']) === 2, 'Recent closure and recent activity protect otherwise old searches.');
check(countRows($db, 'messages') === 0 && countRows($db, 'map_reports') === 0, 'Search retention removes associated content.');
check(countRows($db, 'guests', 'id IN (?,?,?)', ['expired-member', 'expired-reporter', 'expired-target']) === 3, 'Expired profiles remain while memberships or moderation references need attribution.');
check(sql($db, "SELECT lat FROM memberships WHERE search_id='active-recent' AND guest_id='helper'")->fetchColumn() === null, 'Expired GPS is physically cleared.');
check((float)sql($db, "SELECT lat FROM memberships WHERE search_id='active-recent' AND guest_id='owner'")->fetchColumn() === 51.0, 'Fresh shared GPS remains.');
check($counts['securityCountersDeleted'] === 1 && $counts['dedupeRowsDeleted'] === 1, 'Security counters and duplicate fingerprints expire.');
check(countRows($db, 'rate_limits', 'key = ?', ['fresh']) === 1, 'Current quota counters are preserved.');
check($db->query('PRAGMA foreign_key_check')->fetchAll() === [], 'Retention preserves foreign-key integrity.');
for ($index = 0; $index < 3; $index++) search($db, 'bounded-' . $index, 'owner', $now, 'found', $now - 91 * $day);
$limited = Privacy::cleanup($db, $now, 1);
check($limited['searchesDeleted'] === 1 && Privacy::eligibleCounts($db, $now)['searches'] === 2, 'Request cleanup respects the search batch limit.');
echo "Passed $checks frozen-clock PHP privacy and retention assertions.\n";
