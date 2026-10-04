#!/usr/bin/env bash
# Axis B · interaction: real pointer and keyboard paths on the drawing, the wiring the presenter
# replay cannot prove. Harvested from the visual-system-refinement interaction checks (drag and
# release, refusal, numeric validation and cancel, Tab continuity, view-only history exclusion,
# pooled overlay attribute cleanup) and re-based on this harness.
#
# Usage: qa/interaction-check.sh [label]
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

LABEL="${1:-world}"
export QA_OUT="${QA_OUT:-$QA_DIR/out/$LABEL}"

head_of() { qa_jsv 'window.__me.ctx.museum.walls.find(w => w.id === "rotunda").openings.find(o => o.id === "gwin").head'; }
sill_of() { qa_jsv 'window.__me.ctx.museum.walls.find(w => w.id === "rotunda").openings.find(o => o.id === "gwin").sill'; }
gwin_chips() { qa_js '[...document.querySelectorAll("#ovHtml [data-edit]")].filter((x) => x.dataset.edit.includes("gwin")).length'; }

# One real gesture, with an optional mid-gesture probe: drag_to <selector> <probe-js> <dy...>
drag_probe() {
  local sel="$1" probe="$2"; shift 2
  local p x y
  p="$(qa_at "$sel")"
  case "$p" in none | '' | null) qa_fail_msg "no element $sel"; return 1 ;; esac
  x="${p%,*}"; y="${p#*,}"
  qa_move "$x" "$y"; qa_down
  for dy in "$@"; do qa_move "$x" "$((y + dy))"; done
  if [ "$probe" != "-" ]; then qa_js "$probe" >/dev/null; fi
  return 0
}

qa_open
qa_say "== Axis B · real interaction paths"
qa_faults_clear

echo "-- keyboard: search, selection and unwind, from an ordinary state"
qa_js "(() => { document.activeElement && document.activeElement.blur(); return 1; })()" >/dev/null
qa_press /
qa_ok "the search field takes focus" "$(qa_jsv 'document.activeElement.id')" "finderInput"
agent-browser type '#finderInput' 'pears' >/dev/null 2>&1
qa_frames
qa_press Enter
qa_js "window.__me.qa.idle()" >/dev/null
qa_ok "a search result becomes the selection" "$(qa_jsv 'window.__me.qa.state().sel')" "pears"
qa_ok "finding something writes no history" "$(qa_js 'window.__me.qa.state().undo')" "0"
qa_ok "the beacon marks where the found subject is" "$(qa_jsv 'window.__me.S.beacon')" "pears"
qa_snap "search-result"
qa_press Escape
qa_ok "a first Esc clears the beacon" "$(qa_jsv 'window.__me.S.beacon === null ? "cleared" : "set"')" "cleared"
qa_ok "and keeps the selection" "$(qa_jsv 'window.__me.qa.state().sel')" "pears"

echo "-- facing the Garden window"
qa_js "(() => { const A = window.__me.A; A.select('gwin'); A.face('gwin'); return 'ok'; })()" >/dev/null
qa_js "window.__me.qa.idle()" >/dev/null
qa_frames
qa_ok "setup: facing the Garden window" "$(qa_jsv 'window.__me.qa.reading()')" "Facing Garden window"

echo "-- a real handle drag, released"
U0="$(qa_js 'window.__me.qa.state().undo')"
H0="$(head_of)"
drag_probe '[data-h="h-head"]' '({ manipulating: !!document.querySelector(".handle.manipulating"), active: [...document.querySelectorAll("#ovHtml .tape.active")].map((e) => e.textContent) })' -30 -70
qa_okc "the dragged handle is marked while the pointer is down" "$(qa_js '!!document.querySelector(".handle.manipulating")')" "true"
qa_ok "exactly one measurement is emphasised" "$(qa_js '[...document.querySelectorAll("#ovHtml .tape.active")].length')" "1"
qa_snap "drag-active"
qa_up
qa_js "window.__me.qa.idle()" >/dev/null
qa_ok "one drag = one Undo entry" "$(qa_js 'window.__me.qa.state().undo')" "$((U0 + 1))"
qa_ok "the drag is one named building change" "$(qa_jsv 'window.__me.qa.state().lastUndo')" "Garden window head"
qa_ok "the drag moved the value up" "$(python3 -c "print(1 if float('$(head_of)') > $H0 + 0.05 else 0)")" "1"
qa_okc "emphasis cleared on release" "$(qa_js '!!document.querySelector(".handle.manipulating")')" "false"
qa_ok "no stale active chip after release" "$(qa_js '[...document.querySelectorAll("#ovHtml .tape.active")].length')" "0"
qa_okc "no refusal left on the handle" "$(qa_js '!!document.querySelector(".handle.refused")')" "false"
qa_js "window.__me.A.undo()" >/dev/null
qa_okn "Undo restored the value" "$(head_of)" "$H0" 0.0001

echo "-- a refused drag rolls back completely"
U2="$(qa_js 'window.__me.qa.state().undo')"
drag_probe '[data-h="h-head"]' - -60 -260 -420
qa_okc "the refusal is offered during the gesture" "$(qa_js '!!window.__me.S.refusal')" "true"
qa_okc "the handle shows the refusal" "$(qa_js '!!document.querySelector(".handle.refused")')" "true"
qa_okn "the candidate is stated as a reason, not applied" "$(qa_jsv 'window.__me.S.refusal.msg.includes("wall top") ? 1 : 0')" 1 0
qa_snap "refused-drag"
qa_up
qa_js "window.__me.qa.idle()" >/dev/null
qa_ok "a refused release writes no history" "$(qa_js 'window.__me.qa.state().undo')" "$U2"
qa_okn "a refused release leaves the value" "$(head_of)" "$H0" 0.0001
qa_okc "the refusal is announced" "$(qa_jsv 'window.__me.S.status.text')" "Refused"
qa_okc "the announcement says nothing changed" "$(qa_jsv 'window.__me.S.status.text')" "Nothing changed"
qa_ok "the refusal cleared after release" "$(qa_js '!!window.__me.S.refusal')" "false"

echo "-- pooled overlay attributes do not survive a selection change"
qa_ok "the selected opening's numbers are on the drawing" "$(python3 -c "print(1 if $(gwin_chips) >= 3 else 0)")" "1"
qa_js "(() => { window.__me.A.select('north'); return 1; })()" >/dev/null
qa_frames
qa_ok "no chip for the previous subject" "$(gwin_chips)" "0"
qa_js "(() => { window.__me.A.select('gwin'); return 1; })()" >/dev/null
qa_frames
qa_ok "the numbers return with the selection" "$(python3 -c "print(1 if $(gwin_chips) >= 3 else 0)")" "1"

echo "-- a number typed on the drawing"
qa_click_chip 'op","id":"gwin","key":"sill' "typed-chip"
qa_ok "clicking the number opens the type-in" "$(qa_js '!document.getElementById("typein").hidden')" "true"
agent-browser fill '#typeinInput' '0.55' >/dev/null 2>&1
qa_press Enter
qa_js "window.__me.qa.idle()" >/dev/null
qa_okn "Enter applied the typed value" "$(sill_of)" "0.55" 0.0001
qa_okc "the typed value is one Undo entry" "$(qa_jsv 'window.__me.qa.state().lastUndo')" "Garden window sill"

echo "-- an invalid number is refused locally"
U3="$(qa_js 'window.__me.qa.state().undo')"
qa_click_chip 'op","id":"gwin","key":"sill' ""
agent-browser fill '#typeinInput' '-4' >/dev/null 2>&1
qa_press Enter
qa_frames
qa_okc "an invalid number states the reason" "$(qa_jsv 'document.getElementById("typeinErr").textContent')" "cannot go below the floor"
qa_ok "the type-in stays open for correction" "$(qa_js '!document.getElementById("typein").hidden')" "true"
qa_ok "an invalid number writes no history" "$(qa_js 'window.__me.qa.state().undo')" "$U3"
qa_press Escape
qa_frames
qa_okn "Escape leaves the value alone" "$(sill_of)" "0.55" 0.0001
qa_ok "Escape closed the type-in" "$(qa_js 'document.getElementById("typein").hidden')" "true"
qa_ok "a canceled type-in writes no history" "$(qa_js 'window.__me.qa.state().undo')" "$U3"

echo "-- Tab moves between numbers without losing the edit"
qa_click_chip 'op","id":"gwin","key":"head' ""
qa_ok "the head number opened" "$(qa_js '!document.getElementById("typein").hidden')" "true"
agent-browser fill '#typeinInput' '3.30' >/dev/null 2>&1
qa_press Tab
qa_js "window.__me.qa.idle()" >/dev/null
qa_okn "Tab committed the field it was in" "$(head_of)" "3.30" 0.0001
qa_ok "Tab lands on the next number" "$(qa_js '!document.getElementById("typein").hidden')" "true"
qa_press Escape
qa_frames

echo "-- view state never reaches Undo"
U4="$(qa_js 'window.__me.qa.state().undo')"
for call in "A.unrollTo(0.5)" "A.squareUp()" "A.setSide(-1)"; do
  qa_js "(() => { window.__me.$call; return 1; })()" >/dev/null
  qa_js "window.__me.qa.idle()" >/dev/null
done
qa_ok "curvature, square up and inside/outside write no history" "$(qa_js 'window.__me.qa.state().undo')" "$U4"
qa_okc "the curvature is a real intermediate standpoint" "$(qa_jsv 'window.__me.qa.reading()')" "at 180"
qa_js "(() => { window.__me.A.closeSession(); return 1; })()" >/dev/null
qa_js "window.__me.qa.idle()" >/dev/null

echo "-- section, depth and Reveal are view changes, and a nested return is exact"
qa_js "(() => { window.__me.A.startKnife(); return 1; })()" >/dev/null
qa_js "window.__me.qa.idle()" >/dev/null
qa_js "(() => { const A = window.__me.A; A.presetKnife([-17, 0.25], [13, 0.25], -1, 6); A.commitKnife(); return 1; })()" >/dev/null
qa_js "window.__me.qa.idle()" >/dev/null
U5="$(qa_js 'window.__me.qa.state().undo')"
qa_js "(() => { const A = window.__me.A; A.setDepth(3); A.select('harbor'); return 1; })()" >/dev/null
qa_frames
qa_okc "the depth is applied as a reading" "$(qa_jsv 'window.__me.qa.state().session.cut.depth')" "3"
qa_okc "the set-aside painting states its reason" "$(qa_jsv 'window.__me.A.whereIs("harbor").reason')" "beyond the 3.00 m depth"
qa_ok "depth writes no history" "$(qa_js 'window.__me.qa.state().undo')" "$U5"
qa_js "(() => { window.__me.A.toggleReveal('harbor'); return 1; })()" >/dev/null
qa_frames
qa_ok "Reveal writes no history" "$(qa_js 'window.__me.qa.state().undo')" "$U5"
qa_okc "Reveal leaves the depth alone" "$(qa_jsv 'window.__me.qa.state().session.cut.depth')" "3"
qa_js "(() => { window.__me.A.goToHost('harbor'); return 1; })()" >/dev/null
qa_js "window.__me.qa.idle()" >/dev/null
qa_okc "the cut reports its nested situation" "$(qa_jsv 'window.__me.qa.state().crumbs.join(" > ")')" "Opened along a line"
qa_js "(() => { window.__me.A.closeSession(); return 1; })()" >/dev/null
qa_js "window.__me.qa.idle()" >/dev/null
qa_okc "Esc returns to the same cut" "$(qa_jsv 'window.__me.qa.reading()')" "Opened along a line"
qa_okn "…at the same depth" "$(qa_jsv 'window.__me.qa.state().session.cut.depth')" 3 0.0001
qa_okc "…with Reveal still on" "$(qa_jsv 'window.__me.qa.state().reveal')" "harbor"

echo "-- an accepted edit survives the return home, and Undo moves the building only"
qa_ok "accepted edits are still in history" "$(python3 -c "print(1 if $(qa_js 'window.__me.S.undo.length') >= 2 else 0)")" "1"
EYE0="$(qa_js 'window.__me.qa.realized().eye')"
SILL1="$(sill_of)"
qa_js "(() => { window.__me.A.undo(); window.__me.A.undo(); return 1; })()" >/dev/null
qa_frames
qa_ok "Undo left the reading where it was" "$(qa_js 'window.__me.qa.state().session !== null')" "true"
qa_ok "Undo left the standpoint alone" "$(qa_js 'window.__me.qa.realized().eye')" "$EYE0"
qa_ok "Undo changed the building" "$(python3 -c "print(1 if abs(float('$(sill_of)') - float('$SILL1')) > 0.001 else 0)")" "1"

qa_faults_ok "no command or page fault during interaction checks"
qa_browser_errors_ok "no console or page errors"
qa_summary "Axis B interaction"
