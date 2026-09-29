#!/usr/bin/env bash
# Interaction regression checks for the visual-system refinement: real pointer drags, release,
# refusal, numeric entry, keyboard activation, the focus grammar, stale pooled attributes, and the
# rule that a presentation change writes no history.
#
# Requires the prototype served on :8826 and agent-browser.
# Usage: interaction-check.sh [label]        (writes qa/interaction-report-<label>.txt)
set -e
cd "$(dirname "$0")"
LABEL="${1:-revised}"
export AGENT_BROWSER_SESSION="p26vs-int-$LABEL"
U="http://localhost:8826/index.html?shot=1&motion=instant"
PASS=0; FAIL=0
# agent-browser returns the eval result as a JSON-encoded string; decode it once so assertions
# compare against the value the page actually produced.
js() { agent-browser eval "$1" | tail -1 | python3 -c 'import sys,json
s = sys.stdin.read().strip()
print(json.loads(s) if s else "")' 2>/dev/null; }
snap() { agent-browser screenshot "$1" >/dev/null; }
ok() { if [ "$2" = "$3" ]; then echo "PASS  $1  ($2)"; PASS=$((PASS+1)); else echo "FAIL  $1  expected [$3] got [$2]"; FAIL=$((FAIL+1)); fi; }
okc() { case "$2" in *"$3"*) echo "PASS  $1  ($2)"; PASS=$((PASS+1));; *) echo "FAIL  $1  expected to contain [$3] got [$2]"; FAIL=$((FAIL+1));; esac; }
at() { agent-browser eval "(() => { const e = document.querySelector('$1'); if (!e) return '0,0'; const r = e.getBoundingClientRect(); return Math.round(r.x + ${2:-r.width/2}) + ',' + Math.round(r.y + ${3:-r.height/2}); })()" | tr -d '"'; }
ready() { agent-browser open "$U" >/dev/null; sleep 2.4; }

agent-browser set viewport 1440 900 >/dev/null
ready

echo "== V8 · real handle drag, release =="
js "__me.A.select('gwin'); __me.A.face('gwin'); 1" >/dev/null; sleep 1.6
U0=$(js "__me.S.undo.length")
H0=$(js "__me.A && __me.S && document.body ? __me.ctx.museum.walls.find(w=>w.id==='rotunda').openings.find(o=>o.id==='gwin').head : 0")
P=$(at '[data-h="h-head"]'); X=${P%,*}; Y=${P#*,}
agent-browser mouse move "$X" "$Y" >/dev/null; agent-browser mouse down left >/dev/null
agent-browser mouse move "$X" $((Y-30)) >/dev/null; agent-browser mouse move "$X" $((Y-70)) >/dev/null; sleep 0.4
MID=$(js "JSON.stringify({ manipulating: !!document.querySelector('.handle.manipulating'), active: [...document.querySelectorAll('#ovHtml .tape.active')].map(e=>e.textContent) })")
okc "active handle present during drag" "$MID" '"manipulating":true'
snap "$(pwd)/$LABEL/drag-active.png"
agent-browser mouse up left >/dev/null; sleep 0.6
U1=$(js "__me.S.undo.length"); H1=$(js "__me.ctx.museum.walls.find(w=>w.id==='rotunda').openings.find(o=>o.id==='gwin').head")
AFTER=$(js "JSON.stringify({ manipulating: !!document.querySelector('.handle.manipulating'), active: document.querySelectorAll('#ovHtml .tape.active').length, refused: !!document.querySelector('.handle.refused') })")
ok "one drag = one Undo entry" "$U1" "$((U0+1))"
okc "drag changed the value" "$(echo "$H1 > $H0" | bc)" "1"
okc "emphasis cleared after release" "$AFTER" '"manipulating":false'
okc "no stale active chip after release" "$AFTER" '"active":0'
js "__me.A.undo(); 1" >/dev/null; sleep 0.5
ok "Undo restored the value" "$(js "__me.ctx.museum.walls.find(w=>w.id==='rotunda').openings.find(o=>o.id==='gwin').head")" "$H0"

echo "== V8b · refused drag cancels cleanly =="
U2=$(js "__me.S.undo.length")
Y=$(at '[data-h="h-head"]' 0 0 | cut -d, -f2); X=$(at '[data-h="h-head"]' 0 0 | cut -d, -f1)
agent-browser mouse move "$X" "$Y" >/dev/null; agent-browser mouse down left >/dev/null
agent-browser mouse move "$X" $((Y-160)) >/dev/null; agent-browser mouse move "$X" $((Y-420)) >/dev/null; sleep 0.4
REF=$(js "JSON.stringify({ refusal: !!__me.S.refusal, refusedStyle: !!document.querySelector('.handle.refused') })")
okc "refusal is offered during the gesture" "$REF" '"refusal":true'
snap "$(pwd)/$LABEL/refused-drag.png"
agent-browser mouse up left >/dev/null; sleep 0.6
ok "refused drag wrote no history" "$(js "__me.S.undo.length")" "$U2"
ok "refused drag left the value" "$(js "__me.ctx.museum.walls.find(w=>w.id==='rotunda').openings.find(o=>o.id==='gwin').head")" "$H0"
okc "refusal announced in the status rail" "$(js "__me.S.status ? __me.S.status.text : ''")" "Refused"

echo "== V9 · numeric entry, invalid input, cancel =="
js "__me.A.face('gwin'); 1" >/dev/null; sleep 1.4
U3=$(js "__me.S.undo.length")
CHIP=$(js "[...document.querySelectorAll('#ovHtml [data-edit]')].map(e=>e.textContent.trim())[0] || ''")
okc "editable dimensions render as buttons" "$(js "[...document.querySelectorAll('#ovHtml [data-edit]')].map(e=>e.tagName).join(',')")" "BUTTON"
EL=$(at '#ovHtml [data-edit]')
agent-browser mouse move "${EL%,*}" "${EL#*,}" >/dev/null; agent-browser mouse down left >/dev/null; agent-browser mouse up left >/dev/null; sleep 0.5
ok "editor opens on the value" "$(js "String(!document.getElementById('typein').hidden)")" "true"
js "(() => { const i = document.getElementById('typeinInput'); i.value = 'abc'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1; })()" >/dev/null; sleep 0.4
BAD=$(js "JSON.stringify({ err: document.getElementById('typeinErr').textContent, bad: document.getElementById('typein').classList.contains('bad'), open: !document.getElementById('typein').hidden })")
okc "invalid input shows a reason beside the editor" "$BAD" '"bad":true'
okc "invalid input keeps the editor open" "$BAD" '"open":true'
ok "invalid input wrote no history" "$(js "__me.S.undo.length")" "$U3"
snap "$(pwd)/$LABEL/invalid-entry.png"
agent-browser press Escape >/dev/null; sleep 0.4
ok "Escape cancels the editor" "$(js "String(document.getElementById('typein').hidden)")" "true"
ok "Escape clears the active emphasis" "$(js "String(__me.S.activeEdit)")" "null"

echo "== V9b · Enter accepts, Tab keeps focus continuity =="
EL=$(at '#ovHtml [data-edit]')
agent-browser mouse move "${EL%,*}" "${EL#*,}" >/dev/null; agent-browser mouse down left >/dev/null; agent-browser mouse up left >/dev/null; sleep 0.4
js "(() => { const i = document.getElementById('typeinInput'); i.value = String(parseFloat(i.value)); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return 1; })()" >/dev/null; sleep 0.4
ok "accepted value keeps editor closed" "$(js "String(document.getElementById('typein').hidden)")" "true"
EL=$(at '#ovHtml [data-edit]')
agent-browser mouse move "${EL%,*}" "${EL#*,}" >/dev/null; agent-browser mouse down left >/dev/null; agent-browser mouse up left >/dev/null; sleep 0.4
agent-browser press Tab >/dev/null; sleep 0.5
okc "Tab moves to the next value's editor" "$(js "document.activeElement && document.activeElement.id")" "typeinInput"
agent-browser press Escape >/dev/null; sleep 0.3

echo "== V11 · keyboard focus grammar =="
ready
js "__me.A.select('gwin'); __me.A.face('gwin'); 1" >/dev/null; sleep 1.6
js "document.querySelector('[data-h=\"h-head\"]').focus(); 1" >/dev/null
agent-browser press Tab >/dev/null; agent-browser press Shift+Tab >/dev/null; sleep 0.3
FOC=$(js "(() => { const b = document.querySelector('[data-h=\"h-head\"]'); const cs = getComputedStyle(b); return JSON.stringify({ visible: b.matches(':focus-visible'), w: cs.outlineWidth, colour: cs.outlineColor, offset: cs.outlineOffset, shadow: cs.boxShadow }); })()")
okc "keyboard focus shows an offset dark ring" "$FOC" '"w":"2px"'
okc "focus ring is offset clear of the control" "$FOC" '"offset":"2px"'
okc "focus ring carries a light halo" "$FOC" "rgba(243, 244, 238"
snap "$(pwd)/$LABEL/focus-ring.png"

echo "== V10/V12 · view-only changes write no history =="
U4=$(js "__me.S.undo.length")
js "__me.A.closeSession(); 1" >/dev/null; sleep 1.0
js "__me.A.goPlan(); 1" >/dev/null; sleep 1.0
js "__me.A.face('rotunda'); __me.A.unrollTo(0.5); __me.A.setSide(-1); 1" >/dev/null; sleep 2.4
js "__me.A.closeSession(); 1" >/dev/null; sleep 1.0
js "__me.A.startKnife(); __me.A.presetKnife([-17,0.25],[13,0.25],-1,6); 1" >/dev/null; sleep 0.6
js "__me.A.cancelKnife(); 1" >/dev/null; sleep 0.5
ok "view navigation wrote no history" "$(js "__me.S.undo.length")" "$U4"

echo "== pooled label must not keep a stale role attribute =="
ready
js "__me.A.go3D(); 1" >/dev/null; sleep 1.2
js "__me.A.select('north'); 1" >/dev/null; sleep 0.5
BEFORE=$(js "JSON.stringify([...document.querySelectorAll('#ovHtml > *')].filter(e=>/^top/.test(e.textContent.trim())).map(e=>({edit:e.hasAttribute('data-edit'), tag:e.tagName})))")
js "__me.A.setTopForm('north','slope'); 1" >/dev/null; sleep 0.6
AFTER1=$(js "JSON.stringify([...document.querySelectorAll('#ovHtml > *')].filter(e=>/^top/.test(e.textContent.trim())).map(e=>({edit:e.hasAttribute('data-edit'), tag:e.tagName})))")
js "__me.A.setTopForm('north','constant'); 1" >/dev/null; sleep 0.6
AFTER2=$(js "JSON.stringify([...document.querySelectorAll('#ovHtml > *')].filter(e=>/^top/.test(e.textContent.trim())).map(e=>({edit:e.hasAttribute('data-edit'), tag:e.tagName})))")
okc "editable top value carries data-edit" "$BEFORE" '"edit":true'
okc "non-editable top value drops data-edit" "$AFTER1" '"edit":false'
okc "role change back restores data-edit" "$AFTER2" '"edit":true'

echo "== console errors =="
agent-browser errors --clear >/dev/null 2>&1 || true
ready
ERR=$(agent-browser errors | wc -l | tr -d ' ')
ok "no page errors on load" "$ERR" "0"

echo
echo "PASS=$PASS FAIL=$FAIL"
