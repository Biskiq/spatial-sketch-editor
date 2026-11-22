"""Static server for the appearance study. It serves the REPOSITORY ROOT (not this folder) so the
prototype can read the shipped textures and E7 references in apps/editor/static without copying them.
Caching is disabled so edits show on reload. Bound to 127.0.0.1 only.

    python3 prototypes/appearance-ux/serve.py [port]   # then open http://127.0.0.1:8870/prototypes/appearance-ux/

The lab's "Save evidence" button PUTs its sweep to evidence/u-thumbnail-lab.json. That is the only
path this server writes, and only JSON from 127.0.0.1.
"""
import json
import functools
import http.server
import pathlib
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8870
ROOT = pathlib.Path(__file__).resolve().parents[2]
EVIDENCE = "/prototypes/appearance-ux/evidence/u-thumbnail-lab.json"


class NoCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".webp": "image/webp"}

    def do_PUT(self):
        if self.path != EVIDENCE or self.client_address[0] != "127.0.0.1":
            self.send_error(403)
            return
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        data = json.loads(body)
        target = pathlib.Path(__file__).resolve().parent / "evidence" / "u-thumbnail-lab.json"
        target.write_text(json.dumps(data, indent=1) + "\n")
        self.send_response(204)
        self.end_headers()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


handler = functools.partial(NoCache, directory=str(ROOT))
print(f"appearance study: http://127.0.0.1:{PORT}/prototypes/appearance-ux/")
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()
