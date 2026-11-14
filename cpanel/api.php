<?php
declare(strict_types=1);

// This is the single HTTP API entry point. Apache routes /api/* here.
// No secret or database file belongs in the web directory.
ini_set('display_errors', '0');
ini_set('log_errors', '1');

require_once __DIR__ . '/server/validation.php';
require_once __DIR__ . '/server/database.php';
require_once __DIR__ . '/server/privacy.php';
require_once __DIR__ . '/server/api.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('Vary: Cookie');
header('X-Content-Type-Options: nosniff');

try {
    $api = new \SearchParty\Api(\SearchParty\database());
    $response = $api->handle();
    http_response_code($response['status']);
    foreach ($response['headers'] as $name => $value) header($name . ': ' . $value);
    if (isset($response['stream'])) $response['stream']();
    else echo !empty($response['binary']) ? $response['body'] : json_encode($response['body'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (\SearchParty\ApiError $error) {
    http_response_code($error->status);
    if ($error->status === 429) header('Retry-After: 60');
    echo json_encode(['error' => $error->getMessage()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
} catch (\Throwable $error) {
    error_log('SearchParty API: ' . $error->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'SearchParty could not save or load this change. Please try again.']);
}
