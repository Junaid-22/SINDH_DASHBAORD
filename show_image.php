<?php
$file = $_GET['file'] ?? '';

if (empty($file)) {
    http_response_code(404);
    exit('Image not found.');
}

// Allow only network share
$allowedRoot = "\\\\Server\\efap-ss\\";

if (stripos($file, $allowedRoot) !== 0) {
    http_response_code(403);
    exit('Access denied.');
}

if (!file_exists($file)) {
    http_response_code(404);
    exit('File not found.');
}

$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));

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
    default:
        http_response_code(415);
        exit('Unsupported image type.');
}

header('Content-Length: ' . filesize($file));
readfile($file);
exit;
?>