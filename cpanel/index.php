<?php
declare(strict_types=1);

// HTML-only entry point. The build places index.html beside this file. The
// pathname is fixed; request parameters never select a file on the server.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: private, no-store, max-age=0');
header('Vary: Cookie');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: origin');
header('X-Frame-Options: SAMEORIGIN');
header('Permissions-Policy: geolocation=(self), camera=(), microphone=()');

try {
    $shellPath = __DIR__ . '/index.html';
    $html = @file_get_contents($shellPath);
    if ($html === false || !preg_match('/<\/head\s*>/i', $html)) throw new RuntimeException('The built HTML shell is unavailable.');

    $path = (string)(parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?? '/');
    $homePath = in_array($path, ['/', '/index.php', '/index.html'], true);
    $privateQuery = false;
    // PHP parses search[]=... into the same key, so malformed/array forms are
    // also treated conservatively as private rather than opting into ads.
    foreach (array_keys($_GET) as $key) {
        if (in_array(strtolower((string)$key), ['search', 'demo', 'create', 'app'], true)) {
            $privateQuery = true;
            break;
        }
    }
    $host = rtrim(strtolower((string)(parse_url('http://' . (string)($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST) ?? '')), '.');
    $localHost = $host === '' || $host === 'localhost' || str_ends_with($host, '.localhost') || in_array($host, ['[::1]', '::1'], true) || (bool)preg_match('/^127\./D', $host);
    // Advertising remains off until the operator explicitly enables it and has
    // configured Google's certified consent platform. This flag is a deployment
    // safeguard, not a substitute for consent or a consent-management platform.
    $adsEnabled = getenv('SEARCHPARTY_ADSENSE_ENABLED') === '1' && getenv('SEARCHPARTY_CMP_READY') === '1';
    // Returning members never load advertising code, even on the public home.
    $hasGuestCookie = array_key_exists('sp_guest', $_COOKIE);
    $adPage = $homePath && !$privateQuery && !$localHost && !$hasGuestCookie && $adsEnabled;
    $nonce = base64_encode(random_bytes(18));

    if ($adPage) {
        // Google supports nonce-based strict CSP for AdSense; the trusted script
        // may load its changing HTTPS resources. Keep this policy off all search
        // documents and use a full navigation when entering those documents.
        // https://support.google.com/adsense/answer/16283098
        header("Content-Security-Policy: object-src 'none'; script-src 'nonce-$nonce' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https:; base-uri 'none'; frame-ancestors 'self'");
        $ads = "    <meta name=\"google-adsense-account\" content=\"ca-pub-8610536439975607\" />\n"
            . "    <script async src=\"https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8610536439975607\" crossorigin=\"anonymous\"></script>\n";
        $html = preg_replace('/<\/head\s*>/i', $ads . '  </head>', $html, 1);
    } else {
        header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://tile.openstreetmap.org; connect-src 'self'; font-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
    }

    // Every existing module/script and the optional AdSense loader receives the
    // same fresh nonce. Built source is trusted; visitor values are never inserted.
    $html = preg_replace_callback('/<script\b([^>]*)>/i', static function (array $match) use ($nonce): string {
        $attributes = preg_replace('/\snonce(?:\s*=\s*(?:"[^"]*"|\x27[^\x27]*\x27|[^\s>]+))?/i', '', $match[1]);
        return '<script nonce="' . $nonce . '"' . $attributes . '>';
    }, $html);
    if (!is_string($html)) throw new RuntimeException('The HTML shell could not be prepared.');
    echo $html;
} catch (Throwable $error) {
    error_log('SearchParty HTML entry: ' . $error->getMessage());
    http_response_code(503);
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>SearchParty</title><body><h1>SearchParty is temporarily unavailable</h1><p>Please try again shortly.</p></body></html>';
}
