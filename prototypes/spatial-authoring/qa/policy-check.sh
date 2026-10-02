#!/usr/bin/env bash
# Lifecycle and seam checks (stage S1): one cancellation policy, one owner of the view history, the
# initiating identity kept apart from the technical target, and a teardown that leaves the realized
# camera exactly where it was.
#
# Usage: qa/policy-check.sh [label]
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

LABEL="${1:-world}"
export QA_OUT="${QA_OUT:-$QA_DIR/out/$LABEL}"

run_js() {
  [ -n "${1:-}" ] && qa_js "$1" >/dev/null
  qa_frames
  qa_js 'window.__me.qa.idle()' >/dev/null
  qa_frames
}
head_of() { qa_js 'window.__me.ctx.museum.walls.find(w => w.id === "rotunda").openings.find(o => o.id === "gwin").head'; }
task() { qa_js 'window.__me.qa.state().task'; }

qa_open
qa_say "== Stage S1 · lifecycle and seams"
qa_faults_clear

echo "-- an interrupted drag is dropped, and the next drag still commits exactly once"
run_js "(() => { const A = window.__me.A; A.select('gwin'); A.face('gwin'); return 1; })()"
H0="$(head_of)"
U0="$(qa_js 'window.__me.S.undo.length')"
p="$(qa_at '[data-h="h-head"]')"
x="${p%,*}"; y="${p#*,}"
qa_move "$x" "$y"; qa_down; qa_move "$x" "$((y - 40))"
qa_ok "the drag is holding a candidate while the pointer is down" "$(qa_js '!!window.__me.S.pending')" "true"
qa_js "(() => { window.dispatchEvent(new Event('pointercancel')); return 1; })()" >/dev/null
qa_up
run_js
qa_ok "an interrupted drag writes no history" "$(qa_js 'window.__me.S.undo.length')" "$U0"
qa_okn "an interrupted drag leaves the value" "$(head_of)" "$H0" 0.0001
qa_ok "the candidate snapshot was released" "$(qa_js 'window.__me.S.pending === null')" "true"
qa_ok "no writer is left emphasising a value" "$(qa_js 'window.__me.S.activeEdit === null')" "true"
qa_drag '[data-h="h-head"]' 0 -30
run_js
qa_ok "a drag after the interruption still commits once" "$(qa_js 'window.__me.S.undo.length')" "$((U0 + 1))"
qa_ok "…with the building changed, not just the history" "$(python3 -c "print(1 if abs($(head_of) - $H0) > 0.05 else 0)")" "1"
run_js "window.__me.A.undo()"

echo "-- an interrupted refused drag leaves nothing behind"
U1="$(qa_js 'window.__me.S.undo.length')"
p="$(qa_at '[data-h="h-head"]')"
x="${p%,*}"; y="${p#*,}"
qa_move "$x" "$y"; qa_down; qa_move "$x" "$((y - 300))"; qa_move "$x" "$((y - 460))"
qa_ok "the refusal is offered while the pointer is down" "$(qa_js '!!window.__me.S.refusal')" "true"
qa_js "(() => { window.dispatchEvent(new Event('pointercancel')); return 1; })()" >/dev/null
qa_up
run_js
qa_ok "an interrupted refusal writes no history" "$(qa_js 'window.__me.S.undo.length')" "$U1"
qa_ok "the refusal was cleared with it" "$(qa_js 'window.__me.S.refusal === null')" "true"
qa_okn "the value never moved" "$(head_of)" "$H0" 0.0001

echo "-- Esc drops a numeric draft before it touches the reading"
qa_click_chip 'op","id":"gwin","key":"sill' ""
agent-browser fill '#typeinInput' '1.10' >/dev/null 2>&1
qa_ok "a draft is open" "$(qa_js '!document.getElementById("typein").hidden')" "true"
qa_press Escape
qa_ok "Esc closed the draft" "$(qa_js 'document.getElementById("typein").hidden')" "true"
qa_ok "Esc wrote no history for a draft" "$(qa_js 'window.__me.S.undo.length')" "$U1"
qa_ok "the draft was not applied" "$(qa_js 'window.__me.ctx.museum.walls.find(w => w.id === "rotunda").openings.find(o => o.id === "gwin").sill')" "0.9"
qa_ok "the reading is untouched by that Esc" "$(qa_js 'window.__me.S.session !== null')" "true"
qa_press Escape
run_js
qa_ok "the next Esc leaves the reading" "$(qa_js 'window.__me.S.session === null')" "true"

echo "-- one validator: the same invalid value is refused the same way from every path"
run_js "(() => { const A = window.__me.A; A.select('gwin'); A.face('gwin'); return 1; })()"
DIRECT="$(qa_jsv 'window.__me.A.applyOpening("gwin", { head: 7.5 })')"
qa_okc "the field path refuses with a reason" "$DIRECT" "wall top"
qa_okn "a refused direct proposal changes nothing" "$(head_of)" "$H0" 0.0001
p="$(qa_at '[data-h="h-head"]')"
x="${p%,*}"; y="${p#*,}"
qa_move "$x" "$y"; qa_down; qa_move "$x" "$((y - 300))"; qa_move "$x" "$((y - 460))"
DRAGGED="$(qa_jsv 'window.__me.S.refusal && window.__me.S.refusal.msg')"
qa_up
run_js
qa_ok "the handle path refuses with the same reason as the field path" "$DRAGGED" "$DIRECT"
qa_okn "and the refused drag changed nothing either" "$(head_of)" "$H0" 0.0001

echo "-- the initiating identity is not the technical target"
run_js "(() => { const A = window.__me.A; A.select('gwin'); A.unfold(); return 1; })()"
qa_ok "unrolling around the window keeps the window as the subject" "$(python3 -c "import json,sys; t=json.loads('''$(task)'''); print(1 if t['kind']=='face' and t['subject']=='gwin' and t['target']['id']=='rotunda' else 0)")" "1"
run_js "(() => { window.__me.A.closeSession(); return 1; })()"
run_js "(() => { const A = window.__me.A; A.select('harbor'); A.face('harbor'); return 1; })()"
qa_ok "facing an artwork keeps the artwork as the subject" "$(python3 -c "import json,sys; t=json.loads('''$(task)'''); print(1 if t['subject']=='harbor' and t['target']['id']=='north' else 0)")" "1"
qa_ok "the title names the subject and the target separately" "$(qa_jsv 'window.__me.qa.state().taskTitle')" "Facing Harbor at Dusk"
run_js "(() => { window.__me.A.closeSession(); return 1; })()"
run_js "(() => { const A = window.__me.A; A.select('rotunda'); A.beginPeel('rotunda', 1.2); A.peelTo(0.4); A.endPeel(); return 1; })()"
qa_ok "a hand peel also describes its work" "$(python3 -c "import json,sys; t=json.loads('''$(task)'''); print(1 if t and t['kind']=='face' else 0)")" "1"
run_js "(() => { window.__me.A.closeSession(); return 1; })()"
qa_ok "the task ends with the reading" "$(qa_js 'window.__me.S.task === null')" "true"

echo "-- parking holds the realized standpoint instead of restoring an origin"
run_js "(() => { const A = window.__me.A; A.goPlan(); return 1; })()"
run_js "(() => { const A = window.__me.A; A.startKnife(); return 1; })()"
run_js "(() => { const A = window.__me.A; A.presetKnife([-17, 0.25], [13, 0.25], -1, 6); A.commitKnife(); return 1; })()"
run_js "(() => { const A = window.__me.A; A.setDepth(3); return 1; })()"
BEFORE="$(qa_js 'window.__me.qa.realized()')"
PARK="$(qa_js 'window.__me.tasks.park()')"
run_js
qa_ok "parking deactivates the reading" "$(qa_js 'window.__me.S.session === null')" "true"
qa_ok "parking leaves no temporary geometry" "$(qa_js 'Object.keys(window.__me.ctx.stage.aways).length')" "0"
qa_ok "parking releases the aim and the reveal" "$(qa_js 'window.__me.S.knife === null && window.__me.S.reveal === null')" "true"
python3 - "$BEFORE" "$(qa_js 'window.__me.qa.realized()')" <<'PY'
import json, sys
b, a = json.loads(sys.argv[1]), json.loads(sys.argv[2])
same = max(abs(b["eye"][i] - a["eye"][i]) for i in range(3)) < 0.002 and abs(b["fov"] - a["fov"]) < 0.01 and abs(b["frameH"] - a["frameH"]) < 0.01
print(("PASS" if same else "FAIL") + f"  the realized eye, FOV and framing survive parking  (eye {[round(v,3) for v in a['eye']]} fov {a['fov']})")
sys.exit(0 if same else 1)
PY
if [ $? -eq 0 ]; then qa_pass=$((qa_pass + 1)); else qa_fail=$((qa_fail + 1)); fi
qa_ok "the held flatness is the flatness that was rendered" "$(qa_js 'window.__me.nav.hold() !== null')" "true"
qa_ok "no origin pose was restored by parking" "$(qa_js 'window.__me.qa.state().cam.flat > 0.9')" "true"
run_js "(() => { window.__me.nav.releaseHold(); window.__me.A.go3D(); return 1; })()"
qa_ok "explicit movement releases the hold" "$(qa_js 'window.__me.nav.hold() === null')" "true"
qa_ok "…and the camera is ordinary again" "$(qa_js 'window.__me.ctx.stage.cam.flat < 0.5')" "true"

echo "-- one owner of the view history"
run_js "(() => { const A = window.__me.A; A.startKnife(); return 1; })()"
run_js "(() => { const A = window.__me.A; A.presetKnife([-17, 0.25], [13, 0.25], -1, 6); A.commitKnife(); return 1; })()"
T1="$(qa_js 'window.__me.nav.trail().length')"
run_js "(() => { const A = window.__me.A; A.select('harbor'); A.goToHost('harbor'); return 1; })()"
run_js "(() => { window.__me.A.closeSession(); return 1; })()"
qa_ok "a nested return lands on the entry it came from" "$(qa_js 'window.__me.nav.trailPos()')" "$(python3 -c "print($T1 - 1)")"
qa_ok "the trail is the seam's, not a copy in the shell" "$(qa_js 'window.__me.S.trail === window.__me.nav.trail()')" "true"
LEN0="$(qa_js 'window.__me.nav.trail().length')"
run_js "(() => { window.__me.A.startKnife(); return 1; })()"
qa_ok "an aim is open and unaccepted" "$(qa_js '!!window.__me.S.knife')" "true"
# The real press cannot be delivered while the aim's overlay is live (the CLI hangs on it and drops
# the key); the page's own shortcut handler is what this block is about, so the keydown is dispatched.
qa_key_dispatch Escape
run_js
qa_ok "a canceled aim records no view change" "$(qa_js 'window.__me.nav.trail().length')" "$LEN0"
qa_ok "…and leaves no aim behind" "$(qa_js 'window.__me.S.knife === null')" "true"

qa_faults_ok "no command or page fault during lifecycle checks"
qa_browser_errors_ok "no console or page errors"
qa_summary "Stage S1 lifecycle"
