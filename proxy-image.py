#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Image Proxy Server - Z: DRIVE FINAL
Run: python proxy-image.py
"""

import http.server
import socketserver
import urllib.parse
import os
import mimetypes

PORT = 8000

class CORSHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin')
        self.send_header('Access-Control-Max-Age', '86400')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()
    
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # PROXY IMAGE REQUEST
        if parsed.path in ['/proxy-image', '/proxy-image.php', '/proxy-image/']:
            query = urllib.parse.parse_qs(parsed.query)
            file_path = query.get('file', [''])[0]
            
            if file_path:
                file_path = urllib.parse.unquote(file_path)
                print(f'📁 Proxy: {file_path}')
                self.serve_file(file_path)
            else:
                self.send_error(400, "Missing file parameter")
            return
        
        # DIRECT FILE ACCESS - Z: DRIVE
        if parsed.path.startswith('/efap-ss/'):
            decoded_path = urllib.parse.unquote(parsed.path)
            print(f'🔍 Decoded: {decoded_path}')
            
            # 🔥 Z: DRIVE PATH
            file_path = decoded_path.replace('/efap-ss/', 'Z:/')
            file_path = file_path.replace('/', '\\')
            
            print(f'📁 Z: Drive path: {file_path}')
            
            if os.path.exists(file_path):
                print(f'✅ File exists!')
                self.serve_file(file_path)
            else:
                print(f'❌ File not found: {file_path}')
                self.send_response(404)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'File not found')
            return
        
        # PROXY HTML STATUS
        if parsed.path in ['/proxy.html', '/proxy.html/']:
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            
            html_content = r'''
            <!DOCTYPE html>
            <html>
            <head><title>Proxy Status</title>
            <style>
                body{font-family:Arial;text-align:center;padding:50px;background:#0b2a4a;color:white;}
                .status{color:#22c55e;font-size:2rem;}
                .info{background:rgba(255,255,255,0.1);padding:20px;border-radius:10px;margin-top:20px;}
            </style>
            </head>
            <body>
                <h1>🟢 Proxy Server is Running</h1>
                <p class="status">✅ Status: Active</p>
                <div class="info">
                    <p>CORS: Enabled ✅</p>
                    <p>Drive: Z: (\\Server\efap-ss)</p>
                </div>
            </body>
            </html>
            '''
            self.wfile.write(html_content.encode('utf-8'))
            return
        
        # Serve static files
        super().do_GET()
    
    def serve_file(self, file_path):
        try:
            print(f'📁 Serving: {file_path}')
            
            if not os.path.exists(file_path):
                print(f'❌ NOT FOUND: {file_path}')
                self.send_response(404)
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'File not found')
                return
            
            # Get content type
            content_type = mimetypes.guess_type(file_path)[0]
            if not content_type:
                ext = os.path.splitext(file_path)[1].lower()
                if ext in ['.jpg', '.jpeg']:
                    content_type = 'image/jpeg'
                elif ext == '.png':
                    content_type = 'image/png'
                elif ext == '.gif':
                    content_type = 'image/gif'
                elif ext == '.html':
                    content_type = 'text/html'
                else:
                    content_type = 'application/octet-stream'
            
            # Send response
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', os.path.getsize(file_path))
            self.end_headers()
            
            # Send file
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
                
            print(f'✅ SERVED: {os.path.basename(file_path)}')
            
        except Exception as e:
            print(f'❌ ERROR: {e}')
            self.send_error(500, str(e))
    
    def log_message(self, format, *args):
        print(f'📡 {format % args}')

def run_server():
    try:
        with socketserver.TCPServer(("0.0.0.0", PORT), CORSHTTPRequestHandler) as httpd:
            print("=" * 60)
            print("🟢 IMAGE PROXY SERVER (Z: DRIVE)")
            print("=" * 60)
            print(f"📍 http://localhost:{PORT}")
            print(f"📁 Z: Drive mapped to \\Server\efap-ss")
            print("=" * 60)
            print("Press Ctrl+C to stop")
            print("=" * 60)
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n🛑 Server stopped")

if __name__ == "__main__":
    run_server()