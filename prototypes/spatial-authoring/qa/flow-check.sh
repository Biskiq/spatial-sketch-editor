#!/usr/bin/env bash
# Axis B · flows: the pointer and return behaviours the old review scripts probed by hand, harvested
# into assertions (review/test-flows.sh: peel by hand, nested section → host → Esc → the same cut and
# depth, exact restoration through the trail, knife slide; review/test-plan.sh: real Plan and 3D
# drags, legibility gate, exact tilted return, Undo without Camera motion).
#
# Setup uses __me (controlled state); every behaviour under test is driven through real pointer
# events or the shell's own controls.
#
# Usage: qa/flow-check.sh [label]
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

LABEL="${1:-world}"
export QA_OUT="${QA_OUT:-$QA_DIR/out/$LABEL}"

cam() { qa_js 'window.__me.qa.state().cam'; }
gwin() { qa_js 'window.__me.ctx.museum.walls.find(w => w.id === "rotunda").openings.find(o => o.id === "gwin")'; }
run_js() { # setup through the API, then settle: idle queue, two frames, idle again
  [ -n "${1:-}" ] && qa_js "$1" >/dev/null
  qa_frames
  qa_js 'window.__me.qa.idle()' >/dev/null
  qa_frames
}

qa_open
qa_say "== Axis B · pointer flows and exact return"
qa_faults_clear

echo "-- peel a curved wall by hand, from where you stand"
run_js "(() => { window.__me.A.select('rotunda'); return 1; })()"
qa_ok "the pull corner is offered on the selected curved wall" "$(qa_js '[!!document.querySelector("[data-peel]")][0]')" "true"
U0="$(qa_js 'window.__me.S.undo.length')"
qa_drag '[data-peel]' -40 45 "peel-mid"
run_js
S="$(qa_js 'window.__me.qa.state().session')"
qa_okc "the drag opened a face reading" "$S" '"kind": "face"'
qa_ok "the intermediate curvature is a real editable stop" "$(qa_js '(() => { const u = window.__me.qa.state().session.u; return u > 0.02 && u < 0.98; })()')" "true"
qa_ok "the peel wrote no history" "$(qa_js 'window.__me.S.undo.length')" "$U0"
qa_ok "handles stay live at an intermediate curvature" "$(qa_js '[...document.querySelectorAll("#ovHtml [data-h]")].length > 0')" "true"
qa_okc "the reading names the intermediate state" "$(qa_jsv 'window.__me.qa.reading()')" "Rotunda wall at"
run_js "(() => { window.__me.A.setSide(1); return 1; })()"
qa_ok "inside and outside are real standpoints" "$(qa_js 'window.__me.qa.state().session.side')" "1"
run_js "(() => { const A = window.__me.A; A.squareUp(); A.unrollTo(1); return 1; })()"
qa_okc "the wall reaches the flat sheet" "$(qa_jsv 'window.__me.qa.reading()')" "laid flat"
run_js "(() => { window.__me.A.closeSession(); return 1; })()"
qa_ok "Esc rolls the wall back onto its footprint" "$(qa_js 'window.__me.qa.state().session === null')" "true"
qa_okc "…to where it started" "$(qa_jsv 'window.__me.qa.reading()')" "3D"

echo "-- Plan withholds an edge-on axis, tilt brings it back, and the tilted standpoint returns exactly"
run_js "(() => { const A = window.__me.A; A.goPlan(); A.select('gwin'); return 1; })()"
qa_okc "Plan is a real standpoint" "$(qa_jsv 'window.__me.qa.reading()')" "Plan"
qa_ok "Plan withholds the height handle" "$(qa_js '!!document.querySelector("[data-h=\"h-head\"]")')" "false"
qa_ok "…and offers the along-wall handle" "$(qa_js '!!document.querySelector("[data-h=\"h-move\"]")')" "true"
qa_ok "…while the height number stays typeable" "$(qa_js '[...document.querySelectorAll("#ovHtml [data-edit]")].some((x) => x.dataset.edit.includes("head"))')" "true"
S0="$(qa_js 'window.__me.ctx.museum.walls.find(w => w.id === "rotunda").openings.find(o => o.id === "gwin").s')"
qa_drag '[data-h="h-move"]' -50 30 "plan-move"
run_js
S1="$(qa_js 'window.__me.ctx.museum.walls.find(w => w.id === "rotunda").openings.find(o => o.id === "gwin").s')"
qa_ok "a real Plan drag moves the window along the wall" "$(python3 -c "print(1 if abs($S1 - $S0) > 0.1 else 0)")" "1"
qa_ok "the Plan move is one named Undo entry" "$(qa_jsv 'window.__me.S.undo[window.__me.S.undo.length - 1].label')" "Garden window position"
CAM_TILT="$(qa_js '(() => { window.__me.ctx.stage.cam.el = 0.8; return window.__me.qa.state().cam; })()')"
qa_frames
qa_ok "tilted, the height handle arrives" "$(qa_js '!!document.querySelector("[data-h=\"h-head\"]")')" "true"
qa_drag '[data-h="h-head"]' 0 -40 "tilt-head"
run_js
qa_ok "a real 3D drag raises the head" "$(qa_jsv 'window.__me.S.undo[window.__me.S.undo.length - 1].label')" "Garden window head"
run_js "(() => { window.__me.A.face('gwin'); return 1; })()"
qa_okc "Face stands square to the opening" "$(qa_jsv 'window.__me.qa.reading()')" "Facing Garden window"
qa_ok "the profile handle is offered square on" "$(qa_js '!!document.querySelector("[data-h=\"h-rise\"]")')" "true"
qa_drag '[data-h="h-rise"]' 0 30 "face-rise"
run_js
qa_ok "a real profile drag is one Undo entry" "$(qa_jsv 'window.__me.S.undo[window.__me.S.undo.length - 1].label')" "Garden window arch rise"
run_js "(() => { window.__me.A.closeSession(); return 1; })()"
qa_ok "Esc returns to the tilted standpoint, not a default 3D" "$(qa_js 'Math.abs(window.__me.ctx.stage.cam.el - 0.8) < 0.001')" "true"
qa_okc "…with the selection intact" "$(qa_jsv 'window.__me.qa.state().sel')" "gwin"
qa_okc "…and the work named in the summary" "$(qa_js 'window.__me.S.summary ? window.__me.S.summary.labels.length : 0')" "1"

echo "-- the Wall grid is a reading, not an edit"
U1="$(qa_js 'window.__me.S.undo.length')"
before_cam="$(cam)"
qa_js "(() => { const S = window.__me.S; S.wallDrafting = !S.wallDrafting; window.__me.A.syncSheets(); return 1; })()" >/dev/null
qa_frames
qa_ok "the grid changes no source value" "$(qa_js 'window.__me.S.undo.length')" "$U1"
qa_ok "the grid moves no standpoint" "$(cam)" "$before_cam"
qa_ok "the grid keeps the selection" "$(qa_jsv 'window.__me.qa.state().sel')" "gwin"

echo "-- section → go to the host's wall → Esc → the same cut and depth"
run_js "(() => { const A = window.__me.A; A.startKnife(); return 1; })()"
run_js "(() => { const A = window.__me.A; A.presetKnife([-17, 0.25], [13, 0.25], -1, 6); A.commitKnife(); return 1; })()"
run_js "(() => { const A = window.__me.A; A.setDepth(3); A.select('harbor'); return 1; })()"
qa_okc "the cut excludes the painting beyond depth" "$(qa_jsv 'window.__me.A.memberOf("harbor").state')" "beyond"
run_js "(() => { window.__me.A.goToHost('harbor'); return 1; })()"
qa_okc "going to the wall nests inside the cut" "$(qa_jsv 'window.__me.qa.state().crumbs.join(" > ")')" "Opened along a line"
run_js "(() => { window.__me.A.closeSession(); return 1; })()"
qa_ok "Esc lands back in the cut, not in ordinary 3D" "$(qa_jsv 'window.__me.S.session.kind')" "section"
qa_ok "…at the same depth" "$(qa_js 'window.__me.S.session.cut.depth')" "3"
run_js "(() => { window.__me.A.includeIt('harbor'); return 1; })()"
qa_ok "Include reaches exactly as far as it must" "$(qa_js 'window.__me.S.session.cut.depth')" "4"
qa_ok "Include writes no history" "$(qa_js 'window.__me.S.undo.length')" "$U1"

echo "-- exact restoration through the view trail"
BEFORE="$(qa_js '(() => { const { S, A, ctx } = window.__me; A.toggleReveal("harbor"); const c = ctx.stage.cam; c.az += 0.05; c.frameH *= 0.8; A.pushTrail("Section tweaked"); return { az: c.az, fh: c.frameH, depth: S.session.cut.depth, reveal: S.reveal }; })()')"
run_js "(() => { window.__me.A.go3D(); return 1; })()"
run_js "(() => { window.__me.A.trailStep(-1); return 1; })()"
AFTER="$(qa_js '(() => { const { S, ctx } = window.__me; return { az: ctx.stage.cam.az, fh: ctx.stage.cam.frameH, depth: S.session && S.session.cut.depth, reveal: S.reveal }; })()')"
python3 - "$BEFORE" "$AFTER" <<'PY'
import json, sys
b, a = json.loads(sys.argv[1]), json.loads(sys.argv[2])
ok = abs(b["az"] - a["az"]) < 0.002 and abs(b["fh"] - a["fh"]) < 0.02 and b["depth"] == a["depth"] and b["reveal"] == a["reveal"]
print(("PASS" if ok else "FAIL") + f"  the trail restores standpoint, framing, depth and Reveal exactly  ({json.dumps(a)})")
sys.exit(0 if ok else 1)
PY
if [ $? -eq 0 ]; then qa_pass=$((qa_pass + 1)); else qa_fail=$((qa_fail + 1)); fi

echo "-- the drawn line slides before anything opens, and writes nothing"
run_js "(() => { const A = window.__me.A; A.closeAll(); return 1; })()"
run_js "(() => { const A = window.__me.A; A.goPlan(); A.startKnife(); return 1; })()"
run_js "(() => { const A = window.__me.A; A.presetKnife([-17, 0.25], [13, 0.25], -1, 6); return 1; })()"
qa_ok "the aim offers a slide grip" "$(qa_js '!!document.querySelector("[data-h=\"kn-slide\"]")')" "true"
P0="$(qa_js 'window.__me.S.knife.p0[1]')"
qa_drag '[data-h="kn-slide"]' 0 -60 "knife-slide"
run_js
P1="$(qa_js 'window.__me.S.knife.p0[1]')"
qa_ok "the real slide moved the line" "$(python3 -c "print(1 if abs($P1 - $P0) > 0.2 else 0)")" "1"
qa_ok "the slide opened nothing" "$(qa_js 'window.__me.qa.state().session === null')" "true"
qa_ok "the slide wrote no history" "$(qa_js 'window.__me.S.undo.length')" "$U1"
qa_ok "the aim is still cancellable" "$(qa_js '!!window.__me.S.knife')" "true"

echo "-- a closed cut keeps an explicit way back"
run_js "(() => { const A = window.__me.A; A.commitKnife(); return 1; })()"
run_js "(() => { window.__me.A.closeSession(); return 1; })()"
qa_ok "the cut is remembered as a quiet line with a way back" "$(qa_js '!!document.querySelector("[data-act=\"reopen-cut\"]")')" "true"
run_js "(() => { document.querySelector('[data-act=\"reopen-cut\"]').click(); return 1; })()"
qa_okc "clicking it reopens the same cut" "$(qa_jsv 'window.__me.qa.reading()')" "Opened along a line"
qa_ok "reopening writes no history" "$(qa_js 'window.__me.S.undo.length')" "$U1"

qa_faults_ok "no command or page fault during flow checks"
qa_browser_errors_ok "no console or page errors"
qa_summary "Axis B flows"
