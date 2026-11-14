<?php
declare(strict_types=1);

namespace SearchParty;

final class Api
{
    private const SESSION_SECONDS = 15552000;
    private const LOCATION_TTL = 1800000;
    private const SEARCH_COLUMNS = 's.id, s.code, s.pet_name AS petName, s.pet_type AS petType, s.description, s.photo, s.location_label AS locationLabel, s.lat, s.lng, s.last_seen_at AS lastSeenAt, s.instructions, s.status, s.join_paused AS joinPaused, s.created_at AS createdAt';
    private const MEMBER_COLUMNS = 'g.id, g.name, CASE WHEN m.avatar_hidden = 1 THEN NULL ELSE g.avatar END AS avatar, m.role, m.status, m.lat, m.lng, m.accuracy, m.location_at AS locationAt, m.location_version AS locationVersion, m.joined_at AS joinedAt';
    private int $now;

    public function __construct(private \PDO $db) { $this->now = (int)floor(microtime(true) * 1000); }

    private function query(string $sql, array $args = []): \PDOStatement
    {
        $statement = $this->db->prepare($sql);
        foreach (array_values($args) as $index => $value) {
            $type = is_int($value) ? \PDO::PARAM_INT : ($value === null ? \PDO::PARAM_NULL : \PDO::PARAM_STR);
            $statement->bindValue($index + 1, $value, $type);
        }
        $statement->execute();
        return $statement;
    }
    private function first(string $sql, array $args = []): ?array { return $this->query($sql, $args)->fetch() ?: null; }
    private function rows(string $sql, array $args = []): array { return $this->query($sql, $args)->fetchAll(); }
    private function run(string $sql, array $args = []): int { return $this->query($sql, $args)->rowCount(); }
    private function result(mixed $body, int $status = 200, array $headers = []): array { return ['body' => $body, 'status' => $status, 'headers' => $headers]; }
    private function ok(int $status = 200): array { return $this->result(['ok' => true], $status); }
    private function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);
        return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
    }
    private function code(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $code = '';
        for ($index = 0; $index < 8; $index++) $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        return $code;
    }
    private function guest(): ?array
    {
        $token = $_COOKIE['sp_guest'] ?? null;
        if (!is_string($token) || !preg_match('/^[A-Za-z0-9_-]{43}$/D', $token)) return null;
        return $this->first('SELECT id, name, avatar, expires_at AS expiresAt FROM guests WHERE token_hash = ? AND expires_at > ?', [hash('sha256', $token), $this->now]);
    }
    private function requireGuest(?array $guest): array { if ($guest === null) fail('Choose a name before joining a search.', 401); return $guest; }
    private function requireApproved(?array $member): array { if ($member === null || $member['status'] !== 'approved') fail('An organiser must approve you before you can do that.', 403); return $member; }
    private function requireStaff(?array $member): array
    {
        $approved = $this->requireApproved($member);
        if (!in_array($approved['role'], ['organiser', 'moderator'], true)) fail('Only organisers and moderators can do that.', 403);
        return $approved;
    }
    private function requireActive(array $search): void { if ($search['status'] !== 'active') fail('This search has ended. New search activity is disabled.', 409); }
    private function searchModel(array $row): array
    {
        $row['joinPaused'] = (bool)$row['joinPaused'];
        if ($row['photo'] !== null) $row['photo'] = '/api/searches/' . rawurlencode($row['code']) . '/photo';
        return $row;
    }
    private function memberModel(array $row, bool $hideLocation = false): array
    {
        $fresh = !$hideLocation && $row['status'] === 'approved' && $row['locationAt'] !== null && $row['locationAt'] > $this->now - self::LOCATION_TTL && $row['locationAt'] <= $this->now;
        if (!$fresh) foreach (['lat', 'lng', 'accuracy', 'locationAt'] as $key) $row[$key] = null;
        $row['locationVersion'] = (int)$row['locationVersion'];
        return $row;
    }
    private function profile(array $guest): array { return ['id' => $guest['id'], 'name' => $guest['name'], 'avatar' => $guest['avatar']]; }
    private function rateLimit(string $key, int $limit, int $duration): void
    {
        $this->run('INSERT INTO rate_limits (key, count, resets_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.resets_at <= ? THEN 1 ELSE rate_limits.count + 1 END, resets_at = CASE WHEN rate_limits.resets_at <= ? THEN excluded.resets_at ELSE rate_limits.resets_at END', [$key, $this->now + $duration, $this->now, $this->now]);
        $row = $this->first('SELECT count FROM rate_limits WHERE key = ?', [$key]);
        if ($row === null || $row['count'] > $limit) fail('Too many requests. Please wait a moment and try again.', 429);
    }
    private function session(?array $guest): array
    {
        if ($guest === null) return ['profile' => null, 'searches' => []];
        $joined = $this->rows('SELECT ' . self::SEARCH_COLUMNS . ', m.role, m.status AS memberStatus FROM searches s JOIN memberships m ON m.search_id = s.id WHERE m.guest_id = ? ORDER BY s.created_at DESC LIMIT 50', [$guest['id']]);
        $searches = [];
        foreach ($joined as $row) {
            $role = $row['role']; $status = $row['memberStatus'];
            unset($row['role'], $row['memberStatus']);
            $searches[] = ['search' => $this->searchModel($row), 'role' => $role, 'status' => $status];
        }
        return ['profile' => $this->profile($guest), 'searches' => $searches];
    }
    private function room(array $search, ?array $member): array
    {
        $room = ['search' => $this->searchModel($search), 'me' => $member ? $this->memberModel($member, true) : null, 'members' => [], 'messages' => [], 'reports' => [], 'abuseReports' => [], 'serverTime' => $this->now];
        if ($member === null || $member['status'] !== 'approved') return $room;
        $closed = $search['status'] === 'found';
        $this->run("UPDATE memberships SET lat = NULL, lng = NULL, accuracy = NULL, location_at = NULL WHERE search_id = ? AND location_at IS NOT NULL AND (location_at <= ? OR status != 'approved' OR ? = 'found')", [$search['id'], $this->now - self::LOCATION_TTL, $search['status']]);
        $staff = in_array($member['role'], ['organiser', 'moderator'], true);
        $members = $this->rows('SELECT ' . self::MEMBER_COLUMNS . ' FROM memberships m JOIN guests g ON g.id = m.guest_id WHERE m.search_id = ? ' . ($staff ? '' : "AND m.status = 'approved'") . ' ORDER BY m.joined_at ASC LIMIT 200', [$search['id']]);
        $room['members'] = array_map(fn(array $row): array => $this->memberModel($row, $closed), $members);
        $room['me'] = $this->memberModel($member, $closed);
        $messages = $this->rows('SELECT msg.id, msg.author_id AS authorId, g.name AS authorName, NULL AS authorAvatar, m.role, msg.kind, msg.content, msg.created_at AS createdAt, msg.flagged FROM messages msg JOIN guests g ON g.id = msg.author_id JOIN memberships m ON m.search_id = msg.search_id AND m.guest_id = msg.author_id WHERE msg.search_id = ? ORDER BY msg.created_at DESC, msg.id DESC LIMIT 150', [$search['id']]);
        foreach (array_reverse($messages) as $message) { $message['flagged'] = (bool)$message['flagged']; $room['messages'][] = $message; }
        $reports = $this->rows('SELECT r.id, r.author_id AS authorId, g.name AS authorName, r.kind, r.lat, r.lng, r.radius, r.note, r.occurred_at AS occurredAt, r.created_at AS createdAt, r.confirmed FROM map_reports r JOIN guests g ON g.id = r.author_id WHERE r.search_id = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 200', [$search['id']]);
        foreach ($reports as $report) { $report['confirmed'] = (bool)$report['confirmed']; $room['reports'][] = $report; }
        if ($staff) {
            $reports = $this->rows('SELECT a.id, g.name AS reporterName, a.target_type AS targetType, a.target_id AS targetId, a.reason, a.created_at AS createdAt, a.resolved FROM abuse_reports a JOIN guests g ON g.id = a.reporter_id WHERE a.search_id = ? AND a.resolved = 0 ORDER BY a.created_at DESC LIMIT 100', [$search['id']]);
            foreach ($reports as $report) { $report['resolved'] = (bool)$report['resolved']; $room['abuseReports'][] = $report; }
        }
        return $room;
    }

    public function handle(): array
    {
        $method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        if (!in_array($method, ['GET', 'POST', 'PATCH', 'DELETE'], true)) fail('Method not allowed.', 405);
        $urlPath = (string)parse_url((string)($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
        if (!str_starts_with($urlPath, '/api/')) fail('Endpoint not found.', 404);
        $path = array_values(array_filter(explode('/', substr($urlPath, 5)), static fn(string $part): bool => $part !== ''));
        if (count($path) === 0 || count($path) > 4) fail('Endpoint not found.', 404);
        $body = $method === 'GET' ? [] : readBody();
        // Serialise each short API operation. Permissions and writes share one
        // SQLite transaction, so ban/close checks cannot race the actual mutation.
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $response = $this->dispatch($path, $method, $body);
            $this->db->exec('COMMIT');
            return $response;
        } catch (ApiError $error) {
            // Expected failures happen before domain changes. Commit quota
            // counters so rejected traffic cannot evade persistent rate limits.
            $this->db->exec('COMMIT');
            throw $error;
        } catch (\Throwable $error) {
            $this->db->exec('ROLLBACK');
            throw $error;
        }
    }

    private function dispatch(array $path, string $method, array $body): array
    {
        $guest = $this->guest();
        // REMOTE_ADDR is supplied by the web server. Do not trust arbitrary
        // X-Forwarded-For/CF headers on shared hosting.
        $ipHash = hash('sha256', 'ip:' . (string)($_SERVER['REMOTE_ADDR'] ?? 'local-preview'));
        // A signed-in member must always be able to revoke their own location,
        // even when ordinary writes have exhausted a shared-network quota.
        $isLocationStop = $guest !== null && $method === 'POST' && count($path) === 3 && $path[0] === 'searches' && $path[2] === 'location' && count($body) === 1 && ($body['stop'] ?? false) === true;
        if ($method !== 'GET' && !$isLocationStop) {
            $this->rateLimit('write-ip:' . $ipHash, 240, 60000);
            if ($guest) $this->rateLimit('write-guest:' . $guest['id'], 120, 60000);
            if (random_int(0, 255) < 4) {
                $this->run('DELETE FROM rate_limits WHERE resets_at < ?', [$this->now - 86400000]);
                $this->run('DELETE FROM message_dedupes WHERE created_at < ?', [$this->now - 120000]);
                $this->run('UPDATE memberships SET lat = NULL, lng = NULL, accuracy = NULL, location_at = NULL WHERE location_at IS NOT NULL AND location_at <= ?', [$this->now - self::LOCATION_TTL]);
            }
        }

        if ($path[0] === 'session' && count($path) === 1) {
            if ($method === 'GET') return $this->result($this->session($guest));
            if ($method !== 'POST') fail('Method not allowed.', 405);
            allowedFields($body, ['name', 'avatar']);
            $this->rateLimit('profile:' . ($guest['id'] ?? $ipHash), 12, 60000);
            $name = stringField($body['name'] ?? null, 'Name', 40);
            $avatar = !array_key_exists('avatar', $body) && $guest ? $guest['avatar'] : jpegDataUrl($body['avatar'] ?? null, 'Profile photo', 48000);
            if ($guest) {
                $this->run('UPDATE guests SET name = ?, avatar = ? WHERE id = ?', [$name, $avatar, $guest['id']]);
                return $this->result($this->session(array_merge($guest, ['name' => $name, 'avatar' => $avatar])));
            }
            $this->rateLimit('new-profile:' . $ipHash, 20, 3600000);
            $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
            $created = ['id' => $this->uuid(), 'name' => $name, 'avatar' => $avatar, 'expiresAt' => $this->now + self::SESSION_SECONDS * 1000];
            $this->run('INSERT INTO guests (id, token_hash, name, avatar, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)', [$created['id'], hash('sha256', $token), $name, $avatar, $this->now, $created['expiresAt']]);
            $cookie = 'sp_guest=' . $token . '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' . self::SESSION_SECONDS . (isHttps() ? '; Secure' : '');
            return $this->result($this->session($created), 201, ['Set-Cookie' => $cookie]);
        }

        if ($path[0] !== 'searches') fail('Endpoint not found.', 404);
        if (count($path) === 1) {
            if ($method !== 'POST') fail('Method not allowed.', 405);
            $actor = $this->requireGuest($guest);
            allowedFields($body, ['petName', 'petType', 'description', 'photo', 'locationLabel', 'lat', 'lng', 'lastSeenAt', 'instructions']);
            $this->rateLimit('create:' . $actor['id'], 5, 3600000);
            $petName = stringField($body['petName'] ?? null, 'Pet name', 60);
            $petType = enumField($body['petType'] ?? null, ['dog', 'cat'], 'pet type');
            $description = stringField($body['description'] ?? null, 'Description', 1500);
            $photo = jpegDataUrl($body['photo'] ?? null, 'Pet photo', 180000);
            $label = stringField($body['locationLabel'] ?? null, 'Last-seen place', 160);
            [$lat, $lng] = coordinates($body);
            $lastSeen = timestampField($body['lastSeenAt'] ?? null, 'Last-seen time', $this->now);
            $instructions = stringField($body['instructions'] ?? '', 'Search instructions', 1200, 0);
            $count = $this->first("SELECT COUNT(*) AS total FROM memberships m JOIN searches s ON s.id = m.search_id WHERE m.guest_id = ? AND m.role = 'organiser' AND s.status = 'active'", [$actor['id']]);
            if ($count['total'] >= 20) fail('Close an existing search before creating another.', 409);
            $id = $this->uuid();
            do { $code = $this->code(); } while ($this->first('SELECT id FROM searches WHERE code = ?', [$code]));
            $this->run("INSERT INTO searches (id, code, pet_name, pet_type, description, photo, location_label, lat, lng, last_seen_at, instructions, status, join_paused, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?)", [$id, $code, $petName, $petType, $description, $photo, $label, $lat, $lng, $lastSeen, $instructions, $this->now]);
            $this->run("INSERT INTO memberships (search_id, guest_id, role, status, avatar_hidden, joined_at) VALUES (?, ?, 'organiser', 'approved', 0, ?)", [$id, $actor['id'], $this->now]);
            return $this->result(['code' => $code], 201);
        }

        $code = strtoupper($path[1]);
        if (!preg_match('/^[A-Z2-9]{8}$/D', $code)) fail('Search not found. Check the invite code.', 404);
        $search = $this->first('SELECT ' . self::SEARCH_COLUMNS . ' FROM searches s WHERE s.code = ?', [$code]);
        if ($search === null) fail('Search not found. Check the invite code.', 404);
        $searchId = $search['id'];
        $member = $guest ? $this->first('SELECT ' . self::MEMBER_COLUMNS . ' FROM memberships m JOIN guests g ON g.id = m.guest_id WHERE m.search_id = ? AND m.guest_id = ?', [$searchId, $guest['id']]) : null;
        if (count($path) === 2 && $method === 'GET') return $this->result($this->room($search, $member));
        $resource = $path[2] ?? '';
        if (count($path) === 3 && $resource === 'photo' && $method === 'GET') {
            if ($search['photo'] === null) fail('Photo not found.', 404);
            $bytes = base64_decode(substr($search['photo'], 23), true);
            if ($bytes === false) fail('Photo not found.', 404);
            return ['body' => $bytes, 'status' => 200, 'binary' => true, 'headers' => ['Content-Type' => 'image/jpeg', 'Cache-Control' => 'private, max-age=300', 'Content-Disposition' => 'inline; filename="pet-photo.jpg"']];
        }
        $actor = $this->requireGuest($guest);
        if (count($path) === 3 && $resource === 'join' && $method === 'POST') {
            allowedFields($body, []);
            $this->rateLimit('join:' . $actor['id'], 12, 60000);
            if (($member['status'] ?? '') === 'banned') fail('You have been removed from this search.', 403);
            if ($member) return $this->ok();
            $this->requireActive($search);
            if ($search['joinPaused']) fail('The organiser has paused new join requests.', 409);
            $count = $this->first('SELECT COUNT(*) AS total FROM memberships WHERE search_id = ?', [$searchId]);
            if ($count['total'] >= 200) fail('This search cannot accept more requests right now.', 409);
            $this->run("INSERT INTO memberships (search_id, guest_id, role, status, avatar_hidden, joined_at) VALUES (?, ?, 'helper', 'pending', 0, ?)", [$searchId, $actor['id'], $this->now]);
            return $this->ok();
        }

        $approved = $this->requireApproved($member);
        if (count($path) === 2 && $method === 'PATCH') {
            allowedFields($body, ['joinPaused', 'status']);
            if ($approved['role'] !== 'organiser') fail('Only the organiser can change search settings.', 403);
            if (!array_key_exists('joinPaused', $body) && !array_key_exists('status', $body)) fail('Choose a search setting to change.');
            $paused = array_key_exists('joinPaused', $body) ? booleanField($body['joinPaused'], 'Paused joins') : (bool)$search['joinPaused'];
            $status = array_key_exists('status', $body) ? enumField($body['status'], ['active', 'found'], 'search status') : $search['status'];
            if ($search['status'] === 'found' && $status === 'active') fail('A completed search cannot be reopened. Create a new search if needed.', 409);
            $this->run('UPDATE searches SET join_paused = ?, status = ? WHERE id = ?', [(int)$paused, $status, $searchId]);
            if ($status === 'found') $this->run('UPDATE memberships SET lat = NULL, lng = NULL, accuracy = NULL, location_at = NULL, location_changed_at = MAX(location_changed_at, ?), location_version = location_version + 1 WHERE search_id = ?', [$this->now, $searchId]);
            return $this->ok();
        }

        if ($resource === 'members' && count($path) === 4 && $method === 'PATCH') {
            $this->requireStaff($member);
            allowedFields($body, ['status', 'role', 'removeAvatar']);
            if (!$body) fail('Choose a member setting to change.');
            $target = $this->first('SELECT role, status FROM memberships WHERE search_id = ? AND guest_id = ?', [$searchId, $path[3]]);
            if ($target === null) fail('Member not found in this search.', 404);
            if ($path[3] === $actor['id'] || $target['role'] === 'organiser' || ($approved['role'] === 'moderator' && $target['role'] === 'moderator')) fail('You cannot change this member.', 403);
            if (array_key_exists('role', $body) && $approved['role'] !== 'organiser') fail('Only the organiser can assign moderators.', 403);
            if ($approved['role'] === 'moderator' && $target['status'] === 'banned' && ($body['status'] ?? '') === 'approved') fail('Only the organiser can restore a removed member.', 403);
            $status = array_key_exists('status', $body) ? enumField($body['status'], ['approved', 'banned'], 'member status') : $target['status'];
            $role = array_key_exists('role', $body) ? enumField($body['role'], ['helper', 'moderator'], 'member role') : $target['role'];
            if ($role === 'moderator' && $status !== 'approved' && array_key_exists('role', $body)) fail('Approve a member before making them a moderator.');
            if (array_key_exists('removeAvatar', $body) && $body['removeAvatar'] !== true) fail('Remove photo must be true.');
            $this->run('UPDATE memberships SET status = ?, role = ?, avatar_hidden = CASE WHEN ? = 1 THEN 1 ELSE avatar_hidden END WHERE search_id = ? AND guest_id = ?', [$status, $role, ($body['removeAvatar'] ?? false) ? 1 : 0, $searchId, $path[3]]);
            if ($status === 'banned') $this->run('UPDATE memberships SET lat = NULL, lng = NULL, accuracy = NULL, location_at = NULL, location_changed_at = MAX(location_changed_at, ?), location_version = location_version + 1 WHERE search_id = ? AND guest_id = ?', [$this->now, $searchId, $path[3]]);
            return $this->ok();
        }

        if (in_array($resource, ['messages', 'reports'], true) && count($path) === 4 && $method === 'DELETE') {
            allowedFields($body, []);
            $table = $resource === 'messages' ? 'messages' : 'map_reports';
            $target = $this->first("SELECT author_id AS authorId FROM $table WHERE id = ? AND search_id = ?", [$path[3], $searchId]);
            if ($target === null) fail('Item not found in this search.', 404);
            if ($target['authorId'] !== $actor['id']) $this->requireStaff($member);
            $this->run("DELETE FROM $table WHERE id = ? AND search_id = ?", [$path[3], $searchId]);
            return $this->ok();
        }

        if ($resource === 'abuse' && count($path) === 4 && $method === 'PATCH') {
            $this->requireStaff($member);
            allowedFields($body, ['resolved']);
            if (($body['resolved'] ?? null) !== true) fail('Resolved must be true.');
            if ($this->first('SELECT id FROM abuse_reports WHERE id = ? AND search_id = ?', [$path[3], $searchId]) === null) fail('Report not found in this search.', 404);
            $this->run('UPDATE abuse_reports SET resolved = 1 WHERE id = ? AND search_id = ?', [$path[3], $searchId]);
            return $this->ok();
        }
        if ($resource === 'abuse' && count($path) === 3 && $method === 'POST') {
            allowedFields($body, ['targetType', 'targetId', 'reason']);
            $this->rateLimit('abuse:' . $actor['id'] . ':' . $searchId, 10, 60000);
            $type = enumField($body['targetType'] ?? null, ['message', 'member'], 'report type');
            $id = stringField($body['targetId'] ?? null, 'Report target', 64);
            $reason = stringField($body['reason'] ?? null, 'Report reason', 500);
            $target = $type === 'message' ? $this->first('SELECT id FROM messages WHERE id = ? AND search_id = ?', [$id, $searchId]) : $this->first('SELECT guest_id FROM memberships WHERE guest_id = ? AND search_id = ?', [$id, $searchId]);
            if ($target === null) fail('That item is not in this search.', 404);
            if ($this->first('SELECT id FROM abuse_reports WHERE search_id = ? AND reporter_id = ? AND target_type = ? AND target_id = ? AND resolved = 0', [$searchId, $actor['id'], $type, $id])) fail('This item has already been reported. Please wait for a moderator.', 409);
            $this->run('INSERT INTO abuse_reports (id, search_id, reporter_id, target_type, target_id, reason, created_at, resolved) VALUES (?, ?, ?, ?, ?, ?, ?, 0)', [$this->uuid(), $searchId, $actor['id'], $type, $id, $reason, $this->now]);
            return $this->ok(201);
        }

        if ($resource === 'location' && count($path) === 3 && $method === 'POST' && ($body['stop'] ?? false) === true) {
            allowedFields($body, ['stop']);
            $this->run('UPDATE memberships SET lat = NULL, lng = NULL, accuracy = NULL, location_at = NULL, location_changed_at = MAX(location_changed_at, ?), location_version = location_version + 1 WHERE search_id = ? AND guest_id = ?', [$this->now, $searchId, $actor['id']]);
            $current = $this->first('SELECT location_version FROM memberships WHERE search_id = ? AND guest_id = ?', [$searchId, $actor['id']]);
            return $this->result(['ok' => true, 'version' => (int)$current['location_version']]);
        }
        $this->requireActive($search);

        if ($resource === 'messages' && count($path) === 3 && $method === 'POST') {
            allowedFields($body, ['content', 'kind']);
            $this->rateLimit('message:' . $actor['id'] . ':' . $searchId, 15, 60000);
            $kind = enumField($body['kind'] ?? null, ['chat', 'update'], 'message type');
            if ($kind === 'update') $this->requireStaff($member);
            $content = stringField($body['content'] ?? null, 'Message', 1500);
            if (preg_match_all('/https?:\/\/|www\./i', $content) > 3) fail('Please keep messages focused and use no more than three links.');
            $fingerprint = hash('sha256', spamFingerprint($content));
            $duplicate = $this->first('SELECT created_at FROM message_dedupes WHERE search_id = ? AND guest_id = ? AND fingerprint = ?', [$searchId, $actor['id'], $fingerprint]);
            if ($duplicate && $duplicate['created_at'] >= $this->now - 60000) fail('You already sent that message. Please wait before repeating it.', 409);
            $this->run('INSERT INTO message_dedupes (search_id, guest_id, fingerprint, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(search_id, guest_id, fingerprint) DO UPDATE SET created_at = excluded.created_at', [$searchId, $actor['id'], $fingerprint, $this->now]);
            $this->run('INSERT INTO messages (id, search_id, author_id, kind, content, flagged, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [$this->uuid(), $searchId, $actor['id'], $kind, $content, flagsAbusivePhrase($content) ? 1 : 0, $this->now]);
            return $this->ok(201);
        }

        if ($resource === 'reports' && count($path) === 3 && $method === 'POST') {
            allowedFields($body, ['kind', 'lat', 'lng', 'radius', 'note', 'occurredAt']);
            $this->rateLimit('map-report:' . $actor['id'] . ':' . $searchId, 15, 60000);
            $kind = enumField($body['kind'] ?? null, ['sighting', 'searched', 'searching'], 'map report type');
            [$lat, $lng] = coordinates($body);
            $radius = numberField($body['radius'] ?? null, 'Area radius', 10, 1000);
            $note = stringField($body['note'] ?? '', 'Map note', 800, 0);
            $occurredAt = timestampField($body['occurredAt'] ?? null, 'Report time', $this->now);
            $this->run('INSERT INTO map_reports (id, search_id, author_id, kind, lat, lng, radius, note, occurred_at, confirmed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)', [$this->uuid(), $searchId, $actor['id'], $kind, $lat, $lng, $radius, $note, $occurredAt, $this->now]);
            return $this->ok(201);
        }
        if ($resource === 'reports' && count($path) === 4 && $method === 'PATCH') {
            $this->requireStaff($member);
            allowedFields($body, ['confirmed']);
            $confirmed = booleanField($body['confirmed'] ?? null, 'Confirmed sighting');
            $report = $this->first('SELECT kind FROM map_reports WHERE id = ? AND search_id = ?', [$path[3], $searchId]);
            if ($report === null) fail('Map report not found in this search.', 404);
            if ($report['kind'] !== 'sighting') fail('Only sightings can be confirmed.');
            $this->run('UPDATE map_reports SET confirmed = ? WHERE id = ? AND search_id = ?', [(int)$confirmed, $path[3], $searchId]);
            return $this->ok();
        }
        if ($resource === 'location' && count($path) === 3 && $method === 'POST') {
            allowedFields($body, ['lat', 'lng', 'accuracy', 'version']);
            $this->rateLimit('location:' . $actor['id'] . ':' . $searchId, 30, 60000);
            [$lat, $lng] = coordinates($body);
            $accuracy = numberField($body['accuracy'] ?? null, 'Location accuracy', 0, 50000);
            $version = numberField($body['version'] ?? null, 'Location sharing version', 0, 2147483647);
            if (floor((float)$version) !== (float)$version) fail('Location sharing version must be an integer.');
            if ((int)$version !== (int)$member['locationVersion']) fail('Location sharing changed. Refresh the search before sharing again.', 409);
            $changed = $this->run('UPDATE memberships SET lat = ?, lng = ?, accuracy = ?, location_at = ?, location_changed_at = ? WHERE search_id = ? AND guest_id = ? AND location_changed_at < ?', [$lat, $lng, $accuracy, $this->now, $this->now, $searchId, $actor['id'], $this->now]);
            if (!$changed) fail('A newer location change has already been received. Please try again.', 409);
            return $this->ok();
        }
        fail('Endpoint not found.', 404);
    }
}
