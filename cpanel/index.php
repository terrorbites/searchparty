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
// Never pass a search code or other private URL to a following document.
header('Referrer-Policy: strict-origin');
header('X-Frame-Options: SAMEORIGIN');
header('Permissions-Policy: geolocation=(self), camera=(), microphone=()');

try {
    $path = (string)(parse_url((string)($_SERVER['REQUEST_URI'] ?? '/'), PHP_URL_PATH) ?? '/');
    $settingsPage = in_array($path, ['/ad-settings', '/ad-settings/', '/ad-settings.html'], true);
    $homePath = in_array($path, ['/', '/index.php', '/index.html'], true);
    $privateQuery = false;
    foreach (array_keys($_GET) as $key) {
        if (in_array(strtolower((string)$key), ['search', 'demo', 'create', 'app', 'privacy'], true)) {
            $privateQuery = true;
            break;
        }
    }
    $hasQuery = (string)($_SERVER['QUERY_STRING'] ?? '') !== '';
    // Google must never receive arbitrary query values or room return URLs.
    // Redirect the standalone preferences page and anonymous campaign links to
    // a clean URL before any third-party script can run.
    if (($settingsPage && ($path !== '/ad-settings' || $hasQuery)) || ($homePath && !$privateQuery && $hasQuery)) {
        header('Referrer-Policy: no-referrer');
        header("Content-Security-Policy: default-src 'none'; base-uri 'none'; frame-ancestors 'none'");
        header('Location: ' . ($settingsPage ? '/ad-settings' : '/'), true, 303);
        exit;
    }

    $shellPath = __DIR__ . ($settingsPage ? '/ad-settings.html' : '/index.html');
    $html = @file_get_contents($shellPath);
    if ($html === false || !preg_match('/<\/head\s*>/i', $html)) throw new RuntimeException('The built HTML shell is unavailable.');

    $host = rtrim(strtolower((string)(parse_url('http://' . (string)($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST) ?? '')), '.');
    $productionHost = in_array($host, ['searchpals.co.uk', 'www.searchpals.co.uk'], true);
    // Advertising remains off until the operator explicitly enables it and has
    // configured Google's certified consent platform. This flag is a deployment
    // safeguard, not a substitute for consent or a consent-management platform.
    $cmpReady = getenv('SEARCHPARTY_CMP_READY') === '1';
    $adsEnabled = getenv('SEARCHPARTY_ADSENSE_ENABLED') === '1' && $cmpReady;
    // Returning members never load advertising code, even on the public home.
    $hasGuestCookie = array_key_exists('sp_guest', $_COOKIE);
    $adPage = $homePath && !$privateQuery && !$hasQuery && $productionHost && !$hasGuestCookie && $adsEnabled;
    // Preferences remain available to existing members even if ads are disabled.
    // This document contains no application/session code or personal search data.
    $googlePage = $adPage || ($settingsPage && $productionHost && $cmpReady);
    $nonce = base64_encode(random_bytes(18));

    if ($googlePage) {
        // Google supports nonce-based strict CSP for AdSense; the trusted script
        // may load its changing HTTPS resources. Keep this policy off all search
        // documents and use a full navigation when entering those documents.
        // https://support.google.com/adsense/answer/16283098
        header("Content-Security-Policy: object-src 'none'; script-src 'nonce-$nonce' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https:; base-uri 'none'; frame-ancestors 'self'");
        $settingsAttribute = $settingsPage ? ' data-ad-settings="true"' : '';
        $ads = "    <meta name=\"google-adsense-account\" content=\"ca-pub-8610536439975607\" />\n"
            // Synchronous bootstrap pauses ad requests before the async loader.
            . '    <script src="/assets/advertising.js"' . $settingsAttribute . "></script>\n"
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
    error_log('Search Pals HTML entry: ' . $error->getMessage());
    http_response_code(503);
    header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    echo '<!doctype html><html lang="en"><meta charset="utf-8"><title>Search Pals</title><body><h1>Search Pals is temporarily unavailable</h1><p>Please try again shortly.</p></body></html>';
}
