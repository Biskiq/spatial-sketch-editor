#!/usr/bin/env bash
# Static design capture only. The named browser and server always close.
set -euo pipefail
v3_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
v3_dir="$v3_root/prototypes/experience-ux-v3"
v3_session="$(agent-browser session id --scope worktree --prefix experience-v3)"
v3_port="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1",0)); print(s.getsockname()[1]); s.close()')"
v3_server=''
cleanup() {
  agent-browser --session "$v3_session" close >/dev/null 2>&1 || true
  if [[ -n "$v3_server" ]]; then kill "$v3_server" 2>/dev/null || true; wait "$v3_server" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM
python3 -m http.server "$v3_port" --bind 127.0.0.1 --directory "$v3_root" >/tmp/museum-experience-v3-server.log 2>&1 &
v3_server=$!
python3 - "$v3_port" <<'PY'
import sys,time,urllib.request
for attempt in range(50):
    try:
        urllib.request.urlopen('http://127.0.0.1:'+sys.argv[1]+'/prototypes/experience-ux-v3/boards.html',timeout=1)
        break
    except OSError: time.sleep(.1)
else: raise SystemExit('Static specimen server did not start')
PY
v3_boards=(01-workspace-start 02-presentation-3d 03-view-plan 04-look-through-3d 05-guide-overview-3d 06-stop-plan 07-reorder-guide 08-movement-path-plan 09-playback-3d 10-follow-camera-3d 11-visitor-entry 12-visitor-guided 13-visitor-explore 14-narrow-stop 15-narrow-movement)
if [[ $# -gt 0 ]]; then v3_boards=("$@"); fi
for v3_board in "${v3_boards[@]}"; do
  v3_width=1440; v3_height=900
  if [[ "$v3_board" == 14-* ]]; then v3_width=1024; v3_height=768; fi
  if [[ "$v3_board" == 15-* ]]; then v3_width=768; v3_height=900; fi
  agent-browser --session "$v3_session" open "http://127.0.0.1:$v3_port/prototypes/experience-ux-v3/boards.html?board=$v3_board" >/dev/null
  agent-browser --session "$v3_session" set viewport "$v3_width" "$v3_height" >/dev/null
  # Re-open after viewport sizing so all deterministic canvas dimensions agree.
  agent-browser --session "$v3_session" open "http://127.0.0.1:$v3_port/prototypes/experience-ux-v3/boards.html?board=$v3_board" >/dev/null
  agent-browser --session "$v3_session" wait --fn 'window.__boardReady === true' >/dev/null
  agent-browser --session "$v3_session" screenshot "$v3_dir/boards/$v3_board.png" >/dev/null
  agent-browser --session "$v3_session" eval 'window.__boardInfo'
done
python3 "$v3_dir/scripts/build-gallery.py"
