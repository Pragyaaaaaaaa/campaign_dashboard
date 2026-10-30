"""Local server for the dashboard. Never caches, and picks the next free port if 8080 is busy,
so an older copy still running on 8080 can not be opened by mistake."""
import http.server, socketserver, os, sys, webbrowser

os.chdir(os.path.dirname(os.path.abspath(__file__)))
START = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = False
for port in range(START, START + 20):
    try:
        srv = socketserver.TCPServer(("", port), H)
        break
    except OSError:
        print(f"Port {port} is already in use, trying the next one...")
else:
    sys.exit("No free port found between %d and %d" % (START, START + 19))

url = f"http://localhost:{port}"
print(f"\nDashboard folder: {os.getcwd()}")
print(f"Open {url}   (Ctrl+C to stop)\n")
webbrowser.open(url)
srv.serve_forever()
