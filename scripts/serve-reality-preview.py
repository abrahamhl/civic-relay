"""Local static preview with the same ES/NL paths as the exported site. No deploy."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "investor-next" / "out"

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)

    def do_GET(self):
        route = self.path.split("?", 1)[0]
        if route in ("/es/", "/es", "/nl/", "/nl"):
            self.path = route.rstrip("/") + ".html"
        super().do_GET()

if __name__ == "__main__":
    print("OEP local preview: http://127.0.0.1:8766 (Ctrl+C to stop)", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8766), Handler).serve_forever()
