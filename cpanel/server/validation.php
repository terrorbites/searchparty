<?php
declare(strict_types=1);

namespace SearchParty;

final class ApiError extends \RuntimeException
{
    public function __construct(public int $status, string $message) { parent::__construct($message); }
}

function fail(string $message, int $status = 400): never { throw new ApiError($status, $message); }

function normalise(string $text): string
{
    if (class_exists('Normalizer')) return \Normalizer::normalize($text, \Normalizer::FORM_KC) ?: $text;
    // intl is recommended. This conservative fallback also catches the common
    // fullwidth-ASCII obfuscation without requiring a Composer dependency.
    $fullwidth = preg_split('//u', '！＂＃＄％＆＇（）＊＋，－．／０１２３４５６７８９：；＜＝＞？＠ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ［＼］＾＿｀ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ｛｜｝～', -1, PREG_SPLIT_NO_EMPTY);
    return strtr($text, array_combine($fullwidth, str_split(implode('', array_map('chr', range(33, 126))))) + ["\u{3000}" => ' ']);
}

function stringField(mixed $value, string $label, int $max, int $min = 1): string
{
    if (!is_string($value) || !preg_match('//u', $value)) fail("$label is required.");
    $clean = trim(preg_replace('/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/u', '', normalise($value)) ?? '');
    // Count UTF-16 code units, matching the browser/TypeScript contract.
    $length = 0;
    foreach (preg_split('//u', $clean, -1, PREG_SPLIT_NO_EMPTY) as $character) $length += strlen($character) === 4 ? 2 : 1;
    if ($length < $min || $length > $max) fail("$label must be {$min}–{$max} characters.");
    return $clean;
}

function numberField(mixed $value, string $label, int|float $min, int|float $max): int|float
{
    if ((!is_int($value) && !is_float($value)) || !is_finite((float)$value) || $value < $min || $value > $max) fail("$label must be between $min and $max.");
    return $value;
}

function enumField(mixed $value, array $choices, string $label): string
{
    if (!is_string($value) || !in_array($value, $choices, true)) fail("Choose a valid $label.");
    return $value;
}

function booleanField(mixed $value, string $label): bool
{
    if (!is_bool($value)) fail("$label must be true or false.");
    return $value;
}

function timestampField(mixed $value, string $label, int $now): int
{
    $number = numberField($value, $label, $now - 366 * 86400000, $now + 60000);
    if (floor((float)$number) !== (float)$number) fail("$label must be a timestamp.");
    return (int)$number;
}

function coordinates(array $body): array
{
    return [numberField($body['lat'] ?? null, 'Latitude', -90, 90), numberField($body['lng'] ?? null, 'Longitude', -180, 180)];
}

function allowedFields(array $body, array $fields): void
{
    if (array_diff(array_keys($body), $fields)) fail('This request contains an unsupported field.');
}

function isHttps(): bool
{
    return (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
}

function requestOrigin(): string
{
    $configured = getenv('SEARCHPARTY_ORIGIN');
    if ($configured !== false && $configured !== '') return rtrim($configured, '/');
    $host = (string)($_SERVER['HTTP_HOST'] ?? '');
    if (!preg_match('/^[a-zA-Z0-9.\-:\[\]]+$/D', $host)) fail('The request host is invalid.', 400);
    return (isHttps() ? 'https://' : 'http://') . $host;
}

function readBody(): array
{
    if (($_SERVER['HTTP_ORIGIN'] ?? '') !== requestOrigin()) fail('Open Search Pals on this site to make changes.', 403);
    $fetchSite = $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '';
    if ($fetchSite !== '' && !in_array($fetchSite, ['same-origin', 'none'], true)) fail('Cross-site changes are not allowed.', 403);
    if (strtolower(trim(explode(';', (string)($_SERVER['CONTENT_TYPE'] ?? ''))[0])) !== 'application/json') fail('Send changes as JSON.', 415);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 300000) fail('This upload is too large.', 413);
    $stream = fopen('php://input', 'rb');
    $raw = $stream ? stream_get_contents($stream, 300001) : false;
    if (is_resource($stream)) fclose($stream);
    if ($raw === false || $raw === '') fail('A JSON request body is required.');
    if (strlen($raw) > 300000) fail('This upload is too large.', 413);
    try { $decoded = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
    catch (\JsonException) { fail('The request contains invalid JSON.'); }
    if (!$decoded instanceof \stdClass) fail('A JSON object is required.');
    return (array)$decoded;
}

function flagsAbusivePhrase(string $content): bool
{
    $text = preg_replace('/\s+/u', ' ', preg_replace('/[.!?_,;:]+/', ' ', strtolower(normalise($content))));
    return (bool)preg_match('/\b(?:fuck you|you(?:\x27re| are)? (?:an? )?(?:fucking |stupid )?(?:idiot|moron|cunt)|kill yourself|go kill yourself)\b/u', $text);
}

function spamFingerprint(string $content): string
{
    $normal = normalise($content);
    $lower = function_exists('mb_strtolower') ? mb_strtolower($normal, 'UTF-8') : strtolower($normal);
    return trim(preg_replace('/\s+/u', ' ', $lower));
}

function jpegDataUrl(mixed $value, string $label, int $maxBytes): ?string
{
    if ($value === null || $value === '') return null;
    if (!is_string($value) || !str_starts_with($value, 'data:image/jpeg;base64,')) fail("$label must be a JPEG image.");
    $encoded = substr($value, 23);
    if (strlen($encoded) > (int)ceil($maxBytes / 3) * 4 || !preg_match('/^[A-Za-z0-9+\/]+={0,2}$/D', $encoded) || strlen($encoded) % 4 !== 0) fail("$label is too large or invalid.");
    $bytes = base64_decode($encoded, true);
    if ($bytes === false || strlen($bytes) > $maxBytes || strlen($bytes) < 12 || substr($bytes, 0, 2) !== "\xff\xd8" || substr($bytes, -2) !== "\xff\xd9") fail("$label is not a valid JPEG.");
    if (function_exists('getimagesizefromstring')) {
        $size = @getimagesizefromstring($bytes);
        if ($size === false || $size[2] !== IMAGETYPE_JPEG) fail("$label is not a valid JPEG.");
        if (!$size[0] || !$size[1] || $size[0] > 4096 || $size[1] > 4096 || $size[0] * $size[1] > 16000000) fail("$label dimensions are too large.");
    }
    $size = strlen($bytes);
    $clean = substr($bytes, 0, 2);
    $offset = 2;
    $hasFrame = false;
    $hasScan = false;
    while ($offset < $size - 2) {
        $start = $offset;
        if (ord($bytes[$offset++]) !== 255) fail("$label is not a valid JPEG.");
        while ($offset < $size && ord($bytes[$offset]) === 255) $offset++;
        if ($offset >= $size) fail("$label is not a valid JPEG.");
        $marker = ord($bytes[$offset++]);
        if (in_array($marker, [0, 0xd8, 0xd9], true)) fail("$label is not a valid JPEG.");
        if ($marker === 1 || ($marker >= 0xd0 && $marker <= 0xd7)) { $clean .= substr($bytes, $start, $offset - $start); continue; }
        if ($offset + 2 > $size) fail("$label is not a valid JPEG.");
        $length = ord($bytes[$offset]) * 256 + ord($bytes[$offset + 1]);
        if ($length < 2 || $offset + $length > $size - 2) fail("$label is not a valid JPEG.");
        if (in_array($marker, [0xc0, 0xc1, 0xc2], true)) {
            if ($length < 8) fail("$label is not a valid JPEG.");
            $height = ord($bytes[$offset + 3]) * 256 + ord($bytes[$offset + 4]);
            $width = ord($bytes[$offset + 5]) * 256 + ord($bytes[$offset + 6]);
            if (!$width || !$height || $width > 4096 || $height > 4096 || $width * $height > 16000000) fail("$label dimensions are too large.");
            $hasFrame = true;
        }
        if ($marker === 0xda) {
            if (!$hasFrame) fail("$label is not a valid JPEG.");
            $hasScan = true;
            $headerEnd = $offset + $length;
            $clean .= substr($bytes, $start, $headerEnd - $start);
            $scanEnd = $headerEnd;
            while ($scanEnd < $size - 2) {
                $byte = ord($bytes[$scanEnd]);
                $next = ord($bytes[$scanEnd + 1]);
                if ($byte === 255 && $next !== 0 && !($next >= 0xd0 && $next <= 0xd7)) break;
                $scanEnd += $byte === 255 ? 2 : 1;
            }
            $clean .= substr($bytes, $headerEnd, $scanEnd - $headerEnd);
            $offset = $scanEnd;
            continue;
        }
        // Strip every APP segment and COM, including GPS/EXIF and image comments.
        if (!(0xe0 <= $marker && $marker <= 0xef) && $marker !== 0xfe) $clean .= substr($bytes, $start, $offset + $length - $start);
        $offset += $length;
    }
    if (!$hasFrame || !$hasScan || $offset !== $size - 2) fail("$label is not a valid JPEG.");
    return 'data:image/jpeg;base64,' . base64_encode($clean . "\xff\xd9");
}
