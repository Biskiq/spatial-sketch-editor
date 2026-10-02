#!/usr/bin/env bash
# Shared harness for the World Authoring Prototype QA (prototypes/spatial-authoring/qa).
#
# It owns four things the old review scripts did not:
#   * a private static server for THIS checkout, so a page already served on 8826 by another
#     worktree can never be measured by accident;
#   * readiness waits that observe the page (boot flag, idle queue, two rendered frames) instead of
#     sleeping and hoping;
#   * assertion counters with a nonzero exit, and fault observation: every command that threw
#     inside anim.run and every page error is a failure, not a log line;
#   * decoded eval results, so assertions compare the value the page produced.
#
# Environment overrides:
#   QA_BASE     base URL to measure; when unset the harness serves $QA_PROTO itself
#   QA_PORT     preferred port for that server (default: an ephemeral one)
#   QA_OUT      directory for captures (default qa/out)
#   QA_SESSION  agent-browser session name (default qa-<pid>)
#   QA_VIEW_W / QA_VIEW_H   viewport (default 1440x900)
#   QA_QUERY    query string appended to index.html (default shot=1&motion=instant)
#   QA_SHOT     set to 0 to skip screenshots
# Sourcing this file is enough: it starts the server and installs the exit trap.
set -u

QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_PROTO="$(cd "$QA_DIR/.." && pwd)"
QA_OUT="${QA_OUT:-$QA_DIR/out}"
QA_SESSION="${QA_SESSION:-p26-qa}"
QA_BASE="${QA_BASE:-}"
QA_PORT="${QA_PORT:-}"
QA_VIEW_W="${QA_VIEW_W:-1440}"
QA_VIEW_H="${QA_VIEW_H:-900}"
QA_QUERY="${QA_QUERY:-shot=1&motion=instant}"
QA_SHOT="${QA_SHOT:-1}"
qa_pass=0
qa_fail=0
qa_srv_pid=""
qa_srv_log="${TMPDIR:-/tmp}/qa-serve-$QA_SESSION.log"

export AGENT_BROWSER_SESSION="$QA_SESSION"

qa_say() { printf '%s\n' "$*"; }

qa_require_tools() {
  for t in agent-browser python3; do
    command -v "$t" >/dev/null 2>&1 || { qa_say "qa: missing $t"; exit 2; }
  done
}

# ---------------------------------------------------------------- server

qa_serve_start() {
  if [ -n "$QA_BASE" ]; then
    qa_say "qa: measuring $QA_BASE (harness server not started)"
    return 0
  fi
  : >"$qa_srv_log"
  # -u: the harness reads the chosen ephemeral port from the server's own first line, so the
  # banner must not sit in a block buffer when stdout is a file.
  if [ -n "$QA_PORT" ]; then
    ( cd "$QA_PROTO" && exec python3 -u -m http.server "$QA_PORT" --bind 127.0.0.1 ) >>"$qa_srv_log" 2>&1 &
  else
    ( cd "$QA_PROTO" && exec python3 -u -m http.server 0 --bind 127.0.0.1 ) >>"$qa_srv_log" 2>&1 &
  fi
  qa_srv_pid=$!
  local port=""
  for _ in $(seq 1 100); do
    port="$(sed -n 's/.*port \([0-9][0-9]*\).*/\1/p' "$qa_srv_log" | head -1)"
    [ -n "$port" ] && break
    sleep 0.1
  done
  if [ -z "$port" ]; then
    qa_say "qa: harness server did not start; see $qa_srv_log"
    exit 2
  fi
  QA_BASE="http://127.0.0.1:$port"
  for _ in $(seq 1 100); do
    if curl -sf "$QA_BASE/index.html" >/dev/null 2>&1; then
      qa_say "qa: serving $QA_PROTO at $QA_BASE"
      return 0
    fi
    sleep 0.1
  done
  qa_say "qa: $QA_BASE/index.html did not answer"
  exit 2
}

qa_serve_stop() {
  if [ -n "$qa_srv_pid" ]; then
    kill "$qa_srv_pid" 2>/dev/null || true
    wait "$qa_srv_pid" 2>/dev/null || true
    qa_srv_pid=""
  fi
}
# Both the private server and this script's own browser are released however the script ends — a pass,
# a failure, or an interrupt. A browser left running slows every later run down; a long-lived session
# driven for a hundred evals also starts dropping results, which would read as a product failure.
trap 'qa_close_browser; qa_serve_stop' EXIT

# ---------------------------------------------------------------- page driving

# Evaluate an expression in the page and print its JSON-serialised value on one line. The expression
# is awaited, so an async IIFE works. agent-browser prints a resolved string as a JSON string; this
# decodes it once and re-encodes it, so callers always compare JSON.
# One attempt at an eval, decoded.
qa_js_once() {
  agent-browser eval "(async () => { const v = await ($1); return JSON.stringify(v === undefined ? null : v); })()" 2>/dev/null | tail -1 | python3 -c 'import sys, json
s = sys.stdin.read().strip()
v = json.loads(s)
if isinstance(v, str):
    try:
        v = json.loads(v)
    except ValueError:
        pass
print(json.dumps(v))' 2>/dev/null
}

# An eval issued while the page is still handling a key press or a pointer release can come back with
# no output at all; that is a race in the harness, not a result. Short retries cover the race, and a
# long wait on a trivial probe covers a wedged session, so a slow environment cannot masquerade as a
# behaviour failure.
qa_js() {
  local out="" i probe
  for i in 1 2 3; do
    out="$(qa_js_once "$1")"
    [ -n "$out" ] && break
    sleep 0.4
  done
  if [ -z "$out" ]; then
    for _ in $(seq 1 30); do
      probe="$(agent-browser eval '1+1' 2>/dev/null | tail -1)"
      [ "$probe" = "2" ] && break
      sleep 1
    done
    out="$(qa_js_once "$1")"
  fi
  printf '%s' "$out"
}

# Same as qa_js, but string values print bare: qa_js '"A=11 B=10"' -> qa_jsv prints A=11 B=10
qa_jsv() { qa_js "$1" | python3 -c 'import sys, json
s = sys.stdin.read().strip()
v = json.loads(s) if s else None
print(v if isinstance(v, str) else json.dumps(v))' 2>/dev/null; }

# Draw a frame on demand. A backgrounded tab stops requestAnimationFrame, so waiting for frames
# would hang the harness and leave the session wedged; the page exposes a render instead.
qa_frames() {
  agent-browser eval "(async () => { if (window.__me && window.__me.qa) { await window.__me.qa.render(); } else { await new Promise((r) => setTimeout(r, 60)); } return true; })()" >/dev/null 2>&1
}

# The page answered at all (its module booted). Under load an eval can come back empty for a
# while even though the page is healthy, so readiness is gated on this before anything else.
qa_alive() {
  for _ in $(seq 1 120); do
    local v
    v="$(agent-browser eval "typeof window.__me" 2>/dev/null | tail -1 | tr -d '"')"
    [ "$v" = "object" ] && return 0
    sleep 0.3
  done
  qa_fail_msg "page at $QA_BASE never answered an eval"
  return 1
}

qa_wait_ready() {
  qa_alive || return 1
  for _ in $(seq 1 150); do
    local v
    v="$(agent-browser eval "!!(window.__me && window.__me.ready && document.body.dataset.ready === '1')" 2>/dev/null | tail -1)"
    if [ "$v" = "true" ]; then
      agent-browser eval "(async () => { await __me.qa.idle(); await __me.qa.render(); return true; })()" >/dev/null 2>&1
      qa_frames
      return 0
    fi
    sleep 0.2
  done
  qa_fail_msg "page never reported readiness at $QA_BASE"
  return 1
}

# qa_open [extra query]
qa_open() {
  local q="$QA_QUERY"
  [ -n "${1:-}" ] && q="$q&$1"
  agent-browser open "$QA_BASE/index.html?$q" >/dev/null 2>&1
  qa_wait_ready
}

qa_snap() { # qa_snap <name>
  [ "$QA_SHOT" = "0" ] && return 0
  mkdir -p "$QA_OUT"
  agent-browser screenshot "$QA_OUT/$1.png" >/dev/null 2>&1
}

qa_at() { # qa_at <selector> [dx] [dy]  -> "x,y" (or none)
  agent-browser eval "(() => { const e = document.querySelector('$1'); if (!e) return 'none'; const r = e.getBoundingClientRect(); if (r.width < 0.5 && r.height < 0.5) return 'none'; return Math.round(r.x + ${2:-r.width / 2}) + ',' + Math.round(r.y + ${3:-r.height / 2}); })()" 2>/dev/null | tail -1 | tr -d '"'
}

# A chip on the drawing, found by a substring of its data-edit spec. The overlay pool rewrites its
# children's attributes every frame, so a chip is addressed by position found at click time, never by
# an id written into the page earlier.
qa_chip_at() { # qa_chip_at <data-edit substring> -> "x,y" (or none)
  agent-browser eval "(() => { const e = [...document.querySelectorAll('#ovHtml [data-edit]')].find((x) => x.dataset.edit.includes('$1')); if (!e) return 'none'; const r = e.getBoundingClientRect(); return Math.round(r.x + r.width / 2) + ',' + Math.round(r.y + r.height / 2); })()" 2>/dev/null | tail -1 | tr -d '"'
}

# Real pointer click on a drawing chip (down + up at its centre).
qa_click_chip() { # qa_click_chip <data-edit substring> [name]
  local p x y
  p="$(qa_chip_at "$1")"
  case "$p" in none | '' | null) qa_fail_msg "no chip for $1"; return 1 ;; esac
  x="${p%,*}"; y="${p#*,}"
  qa_move "$x" "$y"; qa_down; qa_up
  qa_frames
  return 0
}

qa_move() { agent-browser mouse move "$1" "$2" >/dev/null 2>&1; }

# A key press, then a real settle. Two things must be true of the press itself:
#   * in this environment `agent-browser press <letter>` leaves the key held down — the page keeps
#     receiving thousands of keydowns a second, forever, so the key's command re-runs at every later
#     state change (closing a reading and watching it open again is the visible symptom). A printable
#     key is therefore dispatched as the keydown the page listens for; `press` is kept for the keys
#     the browser does not repeat (Escape, Enter, Tab, arrows).
#   * a press and an eval issued back to back race: the eval can come back empty while the page is
#     still handling the key, which reads as a behaviour failure. The settle below covers that, and
#     callers that need the key's *effect* wait for the state it causes.
qa_press() { # qa_press <key>
  local k
  case "$1" in
    ?)
      k="$(python3 -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$1")"
      agent-browser eval "(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: $k, bubbles: true, cancelable: true })); return true; })()" >/dev/null 2>&1
      ;;
    *) agent-browser press "$1" >/dev/null 2>&1 ;;
  esac
  agent-browser eval "(async () => { await window.__me.qa.idle(); return true; })()" >/dev/null 2>&1
  qa_frames
}
# Dispatch the keydown the page listens for, once, on the focused element so it travels the whole
# path (document capture listeners for a field first, then the window's shortcut handler). This is the
# fallback for the states where the CLI's real press cannot be delivered: with a live knife aim the
# press hangs for 30 s and drops the key, which reads as a failure of the policy under test.
qa_key_dispatch() { # qa_key_dispatch <key> [shift]
  local k
  k="$(python3 -c 'import json, sys; print(json.dumps(sys.argv[1]))' "$1")"
  agent-browser eval "(() => { const t = document.activeElement || document.body; t.dispatchEvent(new KeyboardEvent('keydown', { key: $k, bubbles: true, cancelable: true, shiftKey: ${2:-false} })); return true; })()" >/dev/null 2>&1
  agent-browser eval "(async () => { await window.__me.qa.idle(); return true; })()" >/dev/null 2>&1
  qa_frames
}

qa_down() { agent-browser mouse down left >/dev/null 2>&1; }
qa_up() { agent-browser mouse up left >/dev/null 2>&1; }

# Real pointer drag from the centre of an element, in steps, then release.
qa_drag() { # qa_drag <selector> <dx> <dy> [name]
  local p x y
  p="$(qa_at "$1")"
  if [ "$p" = "none" ] || [ -z "$p" ] || [ "$p" = "null" ]; then
    qa_fail_msg "no element to drag: $1"
    return 1
  fi
  x="${p%,*}"; y="${p#*,}"
  qa_move "$x" "$y"; qa_down
  qa_move "$((x + $2 / 3))" "$((y + $3 / 3))"
  qa_move "$((x + $2))" "$((y + $3))"
  qa_up
  qa_frames
  [ -n "${4:-}" ] && qa_snap "$4"
  return 0
}

# ---------------------------------------------------------------- assertions

qa_ok() { # name actual expected
  if [ "$2" = "$3" ]; then
    qa_say "PASS  $1  ($2)"
    qa_pass=$((qa_pass + 1))
  else
    qa_say "FAIL  $1  expected [$3] got [$2]"
    qa_fail=$((qa_fail + 1))
  fi
}

qa_okc() { # name actual substring
  case "$2" in
    *"$3"*) qa_say "PASS  $1  ($2)"; qa_pass=$((qa_pass + 1)) ;;
    *) qa_say "FAIL  $1  expected to contain [$3] got [$2]"; qa_fail=$((qa_fail + 1)) ;;
  esac
}

# Numbers compared with an absolute tolerance, so floating-point framing never reads as a
# behaviour change while a real move still fails.
qa_okn() { # name actual expected [tol]
  local tol="${4:-0.002}"
  if python3 -c "import sys; a=float(sys.argv[1]); b=float(sys.argv[2]); t=float(sys.argv[3]); sys.exit(0 if abs(a-b) <= t else 1)" "$2" "$3" "$tol" 2>/dev/null; then
    qa_say "PASS  $1  ($2 vs $3 ±$tol)"
    qa_pass=$((qa_pass + 1))
  else
    qa_say "FAIL  $1  expected $3 ±$tol got $2"
    qa_fail=$((qa_fail + 1))
  fi
}

qa_num() { # name expression-using-a-and-b actual expected [tol]
  local tol="${4:-0.002}"
  if python3 -c "import sys; a=float(sys.argv[1]); b=float(sys.argv[2]); t=float(sys.argv[3]); sys.exit(0 if abs(a-b) <= t else 1)" "$2" "$3" "$tol" 2>/dev/null; then
    qa_say "PASS  $1  ($2 vs $3 ±$tol)"; qa_pass=$((qa_pass + 1))
  else
    qa_say "FAIL  $1  expected $3 ±$tol got $2"; qa_fail=$((qa_fail + 1))
  fi
}

qa_fail_msg() { qa_say "FAIL  $1"; qa_fail=$((qa_fail + 1)); }

# The prototype's own fault list: every command error inside anim.run and every page error.
qa_faults_clear() { agent-browser eval "__me.qa.clearFaults()" >/dev/null 2>&1; }

qa_faults_ok() { # name
  local list
  list="$(qa_js 'window.__me.qa.faultList()')"
  if [ "$list" = "[]" ] || [ "$list" = "null" ]; then
    qa_say "PASS  $1  (no command or page faults)"
    qa_pass=$((qa_pass + 1))
  else
    qa_say "FAIL  $1  faults: $list"
    qa_fail=$((qa_fail + 1))
  fi
}

qa_browser_errors_ok() { # name
  # The CLI prints a bare marker line ("✗ ") even with nothing to report, so a real error is a
  # marker followed by text.
  local out n
  out="$(agent-browser errors 2>/dev/null | grep -E '✗ .' || true)"
  n="$(printf '%s' "$out" | grep -c . || true)"
  if [ "${n:-0}" -eq 0 ]; then
    qa_say "PASS  $1  (no console/page errors)"
    qa_pass=$((qa_pass + 1))
  else
    qa_say "FAIL  $1  browser errors:"
    printf '%s\n' "$out" | head -20 | sed 's/^/      /'
    qa_fail=$((qa_fail + 1))
  fi
}

# One browser per script, closed when that script ends. Sessions are reused inside a script, so the
# cost of starting one is paid once per run, not once per assertion. Teardown is this script's own
# session only — never --all, which would close another agent's browser.
#   QA_CLOSE_ON_EXIT=0   leave it running (the caller owns teardown)
QA_CLOSE_ON_EXIT="${QA_CLOSE_ON_EXIT:-1}"
qa_close_browser() {
  [ "$QA_CLOSE_ON_EXIT" = "0" ] && return 0
  agent-browser close >/dev/null 2>&1
  return 0
}

qa_summary() { # qa_summary <label>
  qa_say ""
  qa_say "$1: PASS=$qa_pass FAIL=$qa_fail"
  qa_close_browser
  [ "$qa_fail" -eq 0 ] || exit 1
  return 0
}

qa_require_tools
qa_serve_start
mkdir -p "$QA_OUT"
agent-browser set viewport "$QA_VIEW_W" "$QA_VIEW_H" >/dev/null 2>&1
