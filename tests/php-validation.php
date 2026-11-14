<?php
declare(strict_types=1);

// Tests the deployed PHP validation functions directly, without a database,
// HTTP server, Composer, PHPUnit or the retired TypeScript implementation.
require_once __DIR__ . '/../cpanel/server/validation.php';

// Treat unsuppressed runtime warnings as failures too: successful status codes
// must not hide notices that would corrupt JSON or flood production logs.
set_error_handler(static function (int $severity, string $message, string $file, int $line): bool {
    if (!(error_reporting() & $severity)) return false;
    throw new ErrorException($message, 0, $severity, $file, $line);
});

use SearchParty\ApiError;
use function SearchParty\{allowedFields, booleanField, coordinates, enumField, flagsAbusivePhrase, jpegDataUrl, numberField, readBody, requestOrigin, spamFingerprint, stringField, timestampField};

$assertions = 0;
$cases = 0;
function check(bool $condition, string $message): void
{
    global $assertions;
    $assertions++;
    if (!$condition) throw new RuntimeException($message);
}
function same(mixed $actual, mixed $expected, string $message): void { check($actual === $expected, $message); }
function rejects(callable $callback, int $status = 400): void
{
    try { $callback(); }
    catch (ApiError $error) { same($error->status, $status, 'Unexpected HTTP error status: ' . $error->getMessage()); return; }
    throw new RuntimeException('Expected input to be rejected with HTTP ' . $status);
}
function testCase(string $name, callable $callback): void
{
    global $cases;
    $callback();
    $cases++;
    echo "ok - $name\n";
}
function dataUrl(string $bytes): string { return 'data:image/jpeg;base64,' . base64_encode($bytes); }
function segment(int $marker, string $content): string { return "\xff" . chr($marker) . pack('n', strlen($content) + 2) . $content; }

// Real 2×2 RGB JPEG generated with Pillow. It contains no private metadata.
$jpeg = base64_decode('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDIooorA88//9k=', true);
if ($jpeg === false) throw new RuntimeException('Invalid JPEG test fixture.');
$now = 1794657600000;

testCase('names normalise fullwidth characters, reject invalid UTF-8 and preserve useful line breaks', function (): void {
    same(stringField("  Ａｌｉｃｅ\0 ", 'Name', 32), 'Alice', 'Fullwidth name must normalise.');
    same(stringField("Line one\nLine two", 'Note', 100), "Line one\nLine two", 'Line breaks must remain useful.');
    same(stringField('', 'Optional note', 100, 0), '', 'Optional note may be empty.');
    same(stringField('🐾', 'Name', 2), '🐾', 'An emoji counts as two UTF-16 code units.');
    foreach ([null, new stdClass(), 10, '', '   ', str_repeat('a', 33), "\xc3\x28"] as $bad) rejects(fn() => stringField($bad, 'Name', 32));
    rejects(fn() => stringField('🐾', 'Name', 1));
});

testCase('coordinates reject coercion, booleans, NaN, infinity and out-of-range values', function (): void {
    same(coordinates(['lat' => 51.5, 'lng' => -0.12]), [51.5, -0.12], 'Valid coordinates must be unchanged.');
    same(coordinates(['lat' => -90, 'lng' => 180]), [-90, 180], 'Coordinate boundaries are valid.');
    foreach (['51.5', null, false, NAN, INF, 90.01, -90.01] as $lat) rejects(fn() => coordinates(['lat' => $lat, 'lng' => 0]));
    foreach ([181, -181, -INF, '0'] as $lng) rejects(fn() => coordinates(['lat' => 0, 'lng' => $lng]));
    rejects(fn() => numberField(10001, 'Accuracy', 0, 10000));
});

testCase('timestamps reject seconds, fractions, old dates and future reports', function () use ($now): void {
    same(timestampField($now, 'Last seen', $now), $now, 'Current timestamp is valid.');
    same(timestampField($now + 60000, 'Last seen', $now), $now + 60000, 'Allowed clock-skew boundary is valid.');
    foreach ([$now / 1000, $now + 60001, $now - 367 * 86400000, $now + 0.5, 'today', NAN] as $value) rejects(fn() => timestampField($value, 'Last seen', $now));
});

testCase('enums, strict booleans and allowed fields reject privilege injection', function (): void {
    same(enumField('helper', ['helper', 'moderator'], 'role'), 'helper', 'Known role is valid.');
    rejects(fn() => enumField('organiser', ['helper', 'moderator'], 'role'));
    rejects(fn() => enumField(['helper'], ['helper', 'moderator'], 'role'));
    same(booleanField(false, 'Paused'), false, 'False must remain false.');
    foreach (['false', 0, 1, null] as $value) rejects(fn() => booleanField($value, 'Paused'));
    allowedFields(['content' => 'Hello'], ['content']);
    rejects(fn() => allowedFields(['content' => 'Hello', 'role' => 'organiser'], ['content']));
});

testCase('origin construction supports HTTPS and rejects malformed hosts', function (): void {
    $savedServer = $_SERVER;
    $savedOrigin = getenv('SEARCHPARTY_ORIGIN');
    try {
        putenv('SEARCHPARTY_ORIGIN');
        $_SERVER = ['HTTP_HOST' => 'searchparty.example', 'HTTPS' => 'on'];
        same(requestOrigin(), 'https://searchparty.example', 'HTTPS origin must match the host.');
        $_SERVER = ['HTTP_HOST' => 'localhost:8789', 'SERVER_PORT' => '8789'];
        same(requestOrigin(), 'http://localhost:8789', 'Local HTTP origin retains its port.');
        $_SERVER['HTTP_HOST'] = "example.com\r\nInjected: yes";
        rejects(fn() => requestOrigin());
        putenv('SEARCHPARTY_ORIGIN=https://configured.example/');
        same(requestOrigin(), 'https://configured.example', 'Configured origin takes precedence.');
    } finally { $_SERVER = $savedServer; putenv($savedOrigin === false ? 'SEARCHPARTY_ORIGIN' : 'SEARCHPARTY_ORIGIN=' . $savedOrigin); }
});

testCase('request guard rejects cross-origin, cross-site, form and oversized requests before input parsing', function (): void {
    $savedServer = $_SERVER;
    $savedOrigin = getenv('SEARCHPARTY_ORIGIN');
    try {
        putenv('SEARCHPARTY_ORIGIN=https://searchparty.example');
        $valid = ['HTTP_HOST' => 'searchparty.example', 'HTTPS' => 'on', 'HTTP_ORIGIN' => 'https://searchparty.example', 'CONTENT_TYPE' => 'application/json'];
        foreach (['https://attacker.example', ''] as $origin) { $_SERVER = array_merge($valid, ['HTTP_ORIGIN' => $origin]); rejects(fn() => readBody(), 403); }
        foreach (['cross-site', 'same-site'] as $site) { $_SERVER = array_merge($valid, ['HTTP_SEC_FETCH_SITE' => $site]); rejects(fn() => readBody(), 403); }
        $_SERVER = array_merge($valid, ['CONTENT_TYPE' => 'text/plain']); rejects(fn() => readBody(), 415);
        $_SERVER = array_merge($valid, ['CONTENT_LENGTH' => '300001']); rejects(fn() => readBody(), 413);
        // CLI has no php://input. A valid request context must reach the empty
        // JSON check; actual JSON streams are covered by HTTP integration tests.
        $_SERVER = array_merge($valid, ['CONTENT_TYPE' => 'application/json; charset=utf-8', 'HTTP_SEC_FETCH_SITE' => 'same-origin']); rejects(fn() => readBody());
    } finally { $_SERVER = $savedServer; putenv($savedOrigin === false ? 'SEARCHPARTY_ORIGIN' : 'SEARCHPARTY_ORIGIN=' . $savedOrigin); }
});

testCase('moderation flags direct abuse while preserving ordinary search language', function (): void {
    foreach (['ＦＵＣＫ　ＹＯＵ!!!', 'You are a stupid idiot.', 'You are an idiot.', 'go kill yourself', "you\n moron"] as $content) check(flagsAbusivePhrase($content), 'Expected phrase flag: ' . $content);
    foreach (['The dog looks injured near the gate.', 'Please do not chase him.', 'I checked the bloody brambles.', 'We need help urgently.', 'We found him safe.'] as $content) check(!flagsAbusivePhrase($content), 'Unexpected phrase flag: ' . $content);
    same(spamFingerprint("  ＨＥＬＬＯ\n\t everyone  "), 'hello everyone', 'Duplicate normalisation must collapse spacing and case.');
    same(spamFingerprint('Message here'), spamFingerprint('MESSAGE   HERE'), 'Equivalent messages must share a fingerprint.');
});

testCase('photo sanitizer accepts a real JPEG and optional empty photos', function () use ($jpeg): void {
    $clean = jpegDataUrl(dataUrl($jpeg), 'Photo', 2000);
    check(is_string($clean) && str_starts_with($clean, 'data:image/jpeg;base64,'), 'Valid JPEG must return an image data URL.');
    $bytes = base64_decode(substr($clean, 23), true);
    same(substr($bytes, 0, 2), "\xff\xd8", 'JPEG start marker must remain.');
    same(substr($bytes, -2), "\xff\xd9", 'JPEG end marker must remain.');
    check(strlen($bytes) < strlen($jpeg), 'JFIF application metadata must be stripped.');
    foreach ([null, ''] as $empty) same(jpegDataUrl($empty, 'Photo', 2000), null, 'Optional image must remain null.');
});

testCase('JPEG metadata and comments are stripped before and after entropy scan data', function () use ($jpeg): void {
    $metadata = segment(0xe1, "Exif\0\0GPSLatitude=51.123456;Owner=Private Owner");
    $comment = segment(0xfe, 'Private image comment');
    $supplied = substr($jpeg, 0, 2) . $metadata . substr($jpeg, 2, -2) . $comment . $metadata . substr($jpeg, -2);
    $clean = base64_decode(substr(jpegDataUrl(dataUrl($supplied), 'Photo', 2000), 23), true);
    check(!str_contains($clean, 'GPSLatitude'), 'EXIF location must be removed.');
    check(!str_contains($clean, 'Private image comment'), 'Image comments must be removed.');
    same($clean, base64_decode(substr(jpegDataUrl(dataUrl($jpeg), 'Photo', 2000), 23), true), 'Metadata removal must preserve the same image payload.');
});

testCase('JPEG parser rejects MIME disguises, invalid base64, truncation and malformed segments', function () use ($jpeg): void {
    foreach ([42, new stdClass(), 'data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,' . base64_encode($jpeg), 'data:image/jpeg;base64,!!!!', 'data:image/jpeg;base64,AAAAA', dataUrl('<svg onload="alert(1)">'), dataUrl(substr($jpeg, 0, -2)), dataUrl($jpeg . 'trailing-data')] as $bad) rejects(fn() => jpegDataUrl($bad, 'Photo', 2000));
    rejects(fn() => jpegDataUrl(dataUrl($jpeg), 'Photo', 32));
    $corrupt = $jpeg; $corrupt[4] = "\xff"; $corrupt[5] = "\xff";
    rejects(fn() => jpegDataUrl(dataUrl($corrupt), 'Photo', 2000));
    rejects(fn() => jpegDataUrl(dataUrl("\xff\xd8\xff\xe0\0\2\xff\xe0\0\2\xff\xd9"), 'Photo', 2000));
});

testCase('JPEG dimensions are bounded before images are accepted', function () use ($jpeg): void {
    $frame = strpos($jpeg, "\xff\xc0");
    check($frame !== false, 'Fixture needs a baseline frame.');
    $large = substr_replace($jpeg, pack('n', 5000), $frame + 5, 2);
    rejects(fn() => jpegDataUrl(dataUrl($large), 'Photo', 2000));
    $empty = substr_replace($jpeg, "\0\0", $frame + 5, 2);
    rejects(fn() => jpegDataUrl(dataUrl($empty), 'Photo', 2000));
});

echo "Passed $assertions PHP validation assertions across $cases cases.\n";
