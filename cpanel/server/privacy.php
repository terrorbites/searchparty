<?php
declare(strict_types=1);

namespace SearchParty;

/** Database-only privacy operations. Call mutations inside the caller's transaction. */
final class Privacy
{
    public const CLOSED_RETENTION_MS = 90 * 86400000;
    public const INACTIVE_RETENTION_MS = 180 * 86400000;
    public const LOCATION_RETENTION_MS = 30 * 60000;

    private static function query(\PDO $db, string $sql, array $args = []): \PDOStatement
    {
        $statement = $db->prepare($sql);
        foreach (array_values($args) as $index => $value) $statement->bindValue($index + 1, $value, is_int($value) ? \PDO::PARAM_INT : ($value === null ? \PDO::PARAM_NULL : \PDO::PARAM_STR));
        $statement->execute();
        return $statement;
    }

    public static function deleteSearch(\PDO $db, string $searchId): void
    {
        foreach (['abuse_reports', 'message_dedupes', 'map_reports', 'messages', 'memberships'] as $table) self::query($db, "DELETE FROM $table WHERE search_id = ?", [$searchId]);
        self::query($db, 'DELETE FROM searches WHERE id = ?', [$searchId]);
    }

    private static function unreferencedGuests(): string
    {
        return "NOT EXISTS (SELECT 1 FROM memberships WHERE guest_id = guests.id)
            AND NOT EXISTS (SELECT 1 FROM messages WHERE author_id = guests.id)
            AND NOT EXISTS (SELECT 1 FROM map_reports WHERE author_id = guests.id)
            AND NOT EXISTS (SELECT 1 FROM message_dedupes WHERE guest_id = guests.id)
            AND NOT EXISTS (SELECT 1 FROM abuse_reports WHERE reporter_id = guests.id OR (target_type = 'member' AND target_id = guests.id))";
    }

    public static function eligibleCounts(\PDO $db, int $now): array
    {
        return [
            'searches' => (int)self::query($db, "SELECT COUNT(*) FROM searches WHERE (status = 'found' AND closed_at <= ?) OR (status = 'active' AND activity_at <= ?)", [$now - self::CLOSED_RETENTION_MS, $now - self::INACTIVE_RETENTION_MS])->fetchColumn(),
            'locations' => (int)self::query($db, 'SELECT COUNT(*) FROM memberships WHERE location_at IS NOT NULL AND location_at <= ?', [$now - self::LOCATION_RETENTION_MS])->fetchColumn(),
            'profiles' => (int)self::query($db, 'SELECT COUNT(*) FROM guests WHERE expires_at <= ? AND ' . self::unreferencedGuests(), [$now])->fetchColumn(),
        ];
    }

    public static function cleanup(\PDO $db, int $now, int $searchLimit = 20): array
    {
        $searchLimit = max(1, min($searchLimit, 1000));
        $counts = ['searchesDeleted' => 0, 'locationsCleared' => 0, 'profilesDeleted' => 0, 'securityCountersDeleted' => 0, 'dedupeRowsDeleted' => 0];
        $counts['locationsCleared'] = self::query($db, 'UPDATE memberships SET lat = NULL, lng = NULL, accuracy = NULL, location_at = NULL WHERE rowid IN (SELECT rowid FROM memberships WHERE location_at IS NOT NULL AND location_at <= ? LIMIT 500)', [$now - self::LOCATION_RETENTION_MS])->rowCount();
        $searches = self::query($db, "SELECT id FROM searches WHERE (status = 'found' AND closed_at <= ?) OR (status = 'active' AND activity_at <= ?) ORDER BY COALESCE(closed_at, activity_at), id LIMIT ?", [$now - self::CLOSED_RETENTION_MS, $now - self::INACTIVE_RETENTION_MS, $searchLimit])->fetchAll(\PDO::FETCH_COLUMN);
        foreach ($searches as $searchId) { self::deleteSearch($db, $searchId); $counts['searchesDeleted']++; }
        $counts['securityCountersDeleted'] = self::query($db, 'DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE resets_at < ? LIMIT 500)', [$now - 86400000])->rowCount();
        $counts['dedupeRowsDeleted'] = self::query($db, 'DELETE FROM message_dedupes WHERE rowid IN (SELECT rowid FROM message_dedupes WHERE created_at < ? LIMIT 500)', [$now - 120000])->rowCount();
        $counts['profilesDeleted'] = self::query($db, 'DELETE FROM guests WHERE id IN (SELECT id FROM guests WHERE expires_at <= ? AND ' . self::unreferencedGuests() . ' LIMIT 100)', [$now])->rowCount();
        return $counts;
    }

    public static function ownedSearches(\PDO $db, string $guestId): array
    {
        return self::query($db, "SELECT search_id FROM memberships WHERE guest_id = ? AND role = 'organiser'", [$guestId])->fetchAll(\PDO::FETCH_COLUMN);
    }

    public static function deleteProfile(\PDO $db, string $guestId, bool $deleteOwnedSearches): array
    {
        $owned = self::ownedSearches($db, $guestId);
        if ($owned && !$deleteOwnedSearches) fail('You organise searches. Confirm that these search rooms and everyone’s contributions in them will also be deleted.', 409);
        foreach ($owned as $searchId) self::deleteSearch($db, $searchId);
        // Delete reports containing or pointing to the removed profile/content,
        // while leaving unrelated reports and other members' contributions intact.
        self::query($db, "DELETE FROM abuse_reports WHERE reporter_id = ? OR (target_type = 'member' AND target_id = ?) OR (target_type = 'message' AND target_id IN (SELECT id FROM messages WHERE author_id = ?))", [$guestId, $guestId, $guestId]);
        self::query($db, 'DELETE FROM messages WHERE author_id = ?', [$guestId]);
        self::query($db, 'DELETE FROM map_reports WHERE author_id = ?', [$guestId]);
        self::query($db, 'DELETE FROM message_dedupes WHERE guest_id = ?', [$guestId]);
        self::query($db, 'DELETE FROM memberships WHERE guest_id = ?', [$guestId]);
        self::query($db, 'DELETE FROM rate_limits WHERE key LIKE ?', ['%:' . $guestId . '%']);
        self::query($db, 'DELETE FROM guests WHERE id = ?', [$guestId]);
        return ['ok' => true, 'ownedSearchesDeleted' => count($owned)];
    }

    /** Stream a complete export without accumulating message/photo arrays in PHP memory. */
    public static function streamExport(\PDO $db, string $guestId, int $now): void
    {
        $db->exec('BEGIN');
        try {
            $profile = self::query($db, 'SELECT id, name, avatar, created_at AS createdAt, expires_at AS expiresAt, terms_accepted_at AS termsAcceptedAt, terms_version AS termsVersion, adult_confirmed_at AS adultConfirmedAt FROM guests WHERE id = ?', [$guestId])->fetch(\PDO::FETCH_ASSOC);
            if (!$profile) fail('This profile is no longer available.', 401);
            $flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR;
            echo '{"exportedAt":' . $now . ',"profile":' . json_encode($profile, $flags);
            $sections = [
                'memberships' => 'SELECT m.search_id AS searchId, s.code AS searchCode, m.role, m.status, m.joined_at AS joinedAt, m.lat, m.lng, m.accuracy, m.location_at AS locationAt FROM memberships m JOIN searches s ON s.id = m.search_id WHERE m.guest_id = ? ORDER BY m.joined_at, m.search_id',
                'ownedSearches' => "SELECT s.id, s.code, s.pet_name AS petName, s.pet_type AS petType, s.description, s.photo, s.location_label AS locationLabel, s.lat, s.lng, s.last_seen_at AS lastSeenAt, s.instructions, s.status, s.created_at AS createdAt, s.closed_at AS closedAt, s.activity_at AS lastActivityAt FROM searches s JOIN memberships m ON m.search_id = s.id WHERE m.guest_id = ? AND m.role = 'organiser' ORDER BY s.created_at, s.id",
                'messages' => 'SELECT id, search_id AS searchId, kind, content, created_at AS createdAt FROM messages WHERE author_id = ? ORDER BY created_at, id',
                'mapReports' => 'SELECT id, search_id AS searchId, kind, lat, lng, radius, note, occurred_at AS occurredAt, confirmed, created_at AS createdAt FROM map_reports WHERE author_id = ? ORDER BY created_at, id',
                'abuseReportsSubmitted' => 'SELECT id, search_id AS searchId, target_type AS targetType, target_id AS targetId, reason, created_at AS createdAt, resolved FROM abuse_reports WHERE reporter_id = ? ORDER BY created_at, id',
            ];
            foreach ($sections as $name => $sql) {
                echo ',"' . $name . '":[';
                $statement = self::query($db, $sql, [$guestId]);
                $first = true;
                while ($row = $statement->fetch(\PDO::FETCH_ASSOC)) {
                    if ($name === 'memberships' && $row['locationAt'] !== null && $row['locationAt'] <= $now - self::LOCATION_RETENTION_MS) foreach (['lat', 'lng', 'accuracy', 'locationAt'] as $key) $row[$key] = null;
                    if (array_key_exists('confirmed', $row)) $row['confirmed'] = (bool)$row['confirmed'];
                    if (array_key_exists('resolved', $row)) $row['resolved'] = (bool)$row['resolved'];
                    echo ($first ? '' : ',') . json_encode($row, $flags);
                    $first = false;
                }
                $statement->closeCursor();
                echo ']';
            }
            echo '}';
            $db->exec('COMMIT');
        } catch (\Throwable $error) { $db->exec('ROLLBACK'); throw $error; }
    }
}
