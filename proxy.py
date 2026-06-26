#!/usr/bin/env python3
"""
Local WeChat article proxy server.
Run: python proxy.py
Then open index.html and use the proxy at http://localhost:51888/proxy?url=...
"""

import http.server
import urllib.request
import urllib.parse
import json
import sys
import gzip

PORT = 51888


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stdout.write(f"[proxy] {args[0]}\n")
        sys.stdout.flush()

    def do_GET(self):
        if '/proxy' not in self.path:
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(
                b"<html><body><h2>WeChat Proxy Server</h2>"
                b"<p>Use: <code>http://localhost:%d/proxy?url=ENCODED_URL</code></p>"
                b"<p>Example: <a href='/proxy?url=https%%3A%%2F%%2Fmp.weixin.qq.com%%2Fs%%2Fexample'>Test</a></p>"
                b"</body></html>" % PORT
            )
            return

        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)

        if 'url' not in params:
            self.send_json(400, {"error": "missing url param"})
            return

        target = params['url'][0]
        if not target.startswith(('http://', 'https://')):
            self.send_json(400, {"error": "invalid url"})
            return

        try:
            req = urllib.request.Request(
                target,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Encoding": "gzip, deflate",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                    "Referer": "https://mp.weixin.qq.com/",
                }
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read()

                # Decompress gzip if needed
                try:
                    decoded = gzip.decompress(raw)
                except Exception:
                    decoded = raw

                # WeChat often lies about charset=utf-8 but sends GBK
                # Try UTF-8 strict; if it fails, fall back to GBK
                try:
                    content = decoded.decode('utf-8', errors='strict')
                except UnicodeDecodeError:
                    try:
                        content = decoded.decode('gbk', errors='replace')
                    except Exception:
                        content = decoded.decode('utf-8', errors='replace')

                self.send_json(200, {"contents": content})

        except Exception as e:
            self.send_json(502, {"error": str(e)})

    def send_json(self, code, data):
        body = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    print(f"Starting WeChat proxy server on http://localhost:{PORT}")
    print(f"Set this URL in index.html: http://localhost:{PORT}/proxy?url=")
    print("Press Ctrl+C to stop\n")
    server = http.server.HTTPServer(("0.0.0.0", PORT), ProxyHandler)
    server.serve_forever()
