<?php
// site.php — Local router (direct, no bridge)
// All bot files are in the same directory

$page = $_GET['page'] ?? '';

switch ($page) {
    case 'dashboard':
        require __DIR__ . '/admin-dashboard.php';
        break;
    case 'lp':
        require __DIR__ . '/landing-preset.php';
        break;
    case 'webhook':
        require __DIR__ . '/webhook.php';
        break;
    case 'letter':
        require __DIR__ . '/letter.php';
        break;
    case 'login':
        require __DIR__ . '/login.php';
        break;
    case 'mobile':
        require __DIR__ . '/mobile.php';
        break;
    case 'tracking':
        require __DIR__ . '/tracking.php';
        break;
    case 'downloader':
        require __DIR__ . '/downloader.php';
        break;
    default:
        require __DIR__ . '/download.php';
        break;
}
