<?php
// ============================================
// IMAGE PROXY - PHP
// ============================================

// 🔥 ALLOWED NETWORK PATH
$allowedRoot = "\\\\Server\\efap-ss\\EFAP SINDH STRUCTURES\\";

// 🔥 GET FILE PATH
$file = isset($_GET['file']) ? $_GET['file'] : '';

if (empty($file)) {
    http_response_code(404);
    exit('Image not found.');
}

// 🔥 DECODE URL ENCODED PATH
$file = urldecode($file);

// 🔥 SECURITY CHECK - Sirf allowed path se access
if (stripos($file, $allowedRoot) !== 0) {
    http_response_code(403);
    exit('Access denied.');
}

// 🔥 CHECK FILE EXISTS
if (!file_exists($file)) {
    http_response_code(404);
    exit('File not found.');
}

// 🔥 GET FILE EXTENSION
$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));

// 🔥 SET CONTENT TYPE
switch ($ext) {
    case 'jpg':
    case 'jpeg':
        header('Content-Type: image/jpeg');
        break;
    case 'png':
        header('Content-Type: image/png');
        break;
    case 'gif':
        header('Content-Type: image/gif');
        break;
    case 'webp':
        header('Content-Type: image/webp');
        break;
    case 'svg':
        header('Content-Type: image/svg+xml');
        break;
    default:
        http_response_code(415);
        exit('Unsupported image type.');
}

// 🔥 CORS HEADERS - GitHub Pages ke liye
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 🔥 CACHE HEADERS - Fast load ke liye
header('Cache-Control: public, max-age=86400'); // 24 hours cache
header('Content-Length: ' . filesize($file));

// 🔥 OUTPUT IMAGE
readfile($file);
exit;
?>