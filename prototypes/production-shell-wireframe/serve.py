"""Static server for the wireframe that disables caching, so edits show on reload."""
import functools
import http.server
import pathlib
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8850


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


handler = functools.partial(NoCache, directory=str(pathlib.Path(__file__).parent))
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
