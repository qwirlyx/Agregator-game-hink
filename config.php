<?php
$configPath = getenv('GAME_CONFIG_PATH') ?: (__DIR__ . '/data/messengers.json');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: public, max-age=300');

if (is_readable($configPath)) {
    readfile($configPath);
    exit;
}

http_response_code(502);
echo json_encode(['error' => 'config_unavailable'], JSON_UNESCAPED_UNICODE);
