<?php
// Development router only. Never included in the upload directory.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (preg_match('#^/api(?:/|$)#', $path)) {
    require dirname(__DIR__) . '/cpanel/api.php';
    return true;
}
if (str_contains($path, '..') || preg_match('#/(?:server|\.)#', $path)) {
    http_response_code(403);
    return true;
}
$public = dirname(__DIR__) . '/release-upload';
if (preg_match('#^/(privacy|cookies|terms|safety)(?:/|\.html)?$#', $path, $matches)) {
    header('Content-Type: text/html; charset=utf-8');
    header("Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'self'");
    header('Cache-Control: no-cache');
    header('X-Content-Type-Options: nosniff');
    readfile($public . '/' . $matches[1] . '.html');
    return true;
}
if (!in_array($path, ['/', '/index.html', '/index.php'], true) && is_file($public . $path)) return false;
require $public . '/index.php';
