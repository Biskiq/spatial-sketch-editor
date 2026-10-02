#!/usr/bin/env bash
# The ordinary World shell (stage S2): one head with one search entry, a local relation Index, the
# stable identity Card, and an Instrument that exists only while work is invoked.
#
# These are composition laws, so they are checked as composition: what exists, what no longer exists,
# where a thing sits, and which verbs a subject actually offers. Spatial behaviour is not re-tested
# here — the other axes own it.
#
# Usage: qa/shell-check.sh [label]
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

LABEL="${1:-shell}"
export QA_OUT="${QA_OUT:-$QA_DIR/out/$LABEL}"

run_js() { # run_js [expression] — with no expression it only settles the page
  [ -n "${1:-}" ] && qa_js "$1" >/dev/null
  qa_frames
  qa_js 'window.__me.qa.idle()' >/dev/null
  qa_frames
}
# Every rect in one eval, so two measurements cannot straddle a layout change.
RECTS='(() => { const R = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
 return JSON.stringify({ stage: R("#stage"), index: R("#index"), card: R("#card"), instr: R("#instrument"), tools: R(".stage-tools"), where: R("#where"), head: R(".head"), status: R(".status") }); })()'
rects() { qa_jsv "$RECTS"; }
# rect <name> <field>
rect() { python3 -c "import json,sys; r=json.loads(sys.argv[1]); v=(r.get(sys.argv[2]) or {}).get(sys.argv[3]); print('none' if v is None else v)" "$(rects)" "$1" "$2"; }
# does <a> overlap <b>?  (a hidden box has no rect and cannot collide)
overlap() { python3 -c "
import json,sys
r = json.loads(sys.argv[1]); a, b = r[sys.argv[2]], r[sys.argv[3]]
if not a or not b: print('none'); raise SystemExit
ox = min(a['x']+a['w'], b['x']+b['w']) - max(a['x'], b['x'])
oy = min(a['y']+a['h'], b['y']+b['h']) - max(a['y'], b['y'])
print('yes' if ox > 0 and oy > 0 else 'no')" "$(rects)" "$1" "$2"; }
# the verbs a subject offers, as a plain list of capabilities
verbs() { qa_jsv "[...document.querySelectorAll('$1')].map(b => b.dataset.act).join(' ')"; }
bounds_ok() { python3 -c "
import json,sys
r = json.loads(sys.argv[1]); s = r['stage']
def ol(a, b):
    if not a or not b: return False
    return (min(a['x']+a['w'], b['x']+b['w']) - max(a['x'], b['x']) > 0
            and min(a['y']+a['h'], b['y']+b['h']) - max(a['y'], b['y']) > 0)
print('true' if not any(ol(s, r[k]) for k in ('index', 'card', 'head', 'status')) else 'false')" "$(rects)"; }
inside_stage() { python3 -c "
import json,sys
r = json.loads(sys.argv[1]); s, i = r['stage'], r['instr']
inside = (i and s) and i['x'] >= s['x'] and i['y'] >= s['y'] and i['x']+i['w'] <= s['x']+s['w'] and i['y']+i['h'] <= s['y']+s['h']
print('true' if inside else 'false')" "$(rects)"; }

qa_open
qa_say "== Stage S2 · the ordinary World shell"
qa_faults_clear

echo "-- one shell, and none of the retired one"
qa_ok "the Index panel is the relation Index" "$(qa_jsv 'document.querySelector("#index")?.getAttribute("aria-label")')" "Index of this place"
qa_ok "the Card panel is the selected subject" "$(qa_jsv 'document.querySelector("#card")?.getAttribute("aria-label")')" "Selected subject"
qa_ok "the stage is the world" "$(qa_js '!!document.querySelector("#stage #gl")')" "true"
qa_ok "no domain spine" "$(qa_js '!!document.querySelector(".spine, .station")')" "false"
qa_ok "no navigator tree" "$(qa_js '!!document.querySelector("#nav, .nv-row")')" "false"
qa_ok "no inspector panel" "$(qa_js '!!document.querySelector("#insp, .in-head")')" "false"
qa_ok "no permanent tool tray" "$(qa_js '!!document.querySelector(".tray, [data-tool]")')" "false"
qa_ok "no permanent instrument strip" "$(qa_js '!!document.querySelector("#strip")')" "false"
qa_ok "exactly one search entry" "$(qa_js 'document.querySelectorAll("[data-act=\"find\"]").length')" "1"
qa_ok "the lens names the World, with no second lens to click" "$(qa_jsv 'document.querySelector("#lens").textContent.trim() + "/" + document.querySelectorAll("#lens button").length')" "World/0"

echo "-- nothing offered is inert"
qa_ok "no disabled control outside the building history" "$(qa_js '[...document.querySelectorAll("button:disabled")].filter(b => !b.closest(".head-hist")).length')" "0"
qa_ok "no modal is open at rest" "$(qa_js 'document.querySelector("#finder").hidden')" "true"
qa_ok "no work is in hand at rest" "$(qa_js 'document.querySelector("#instrument").hidden')" "true"
run_js "window.__me.A.select('bench')"
qa_ok "a subject with nothing to offer offers nothing" "$(qa_js 'document.querySelectorAll("#card .verb").length')" "0"
run_js "window.__me.A.select('rotunda')"
qa_ok "a curved wall offers looking at it, unrolling it, and its numbers in place" "$(verbs '#card .verb')" "look-face look-unroll look-dims"
run_js "window.__me.A.select('soffit')"
qa_ok "a ceiling offers lifting it, looking up at it, and its numbers in place" "$(verbs '#card .verb')" "look-lift look-lookup look-dims"
qa_ok "every verb a subject offers is dispatchable" "$(qa_js '[...document.querySelectorAll(".ix-verb, #card .verb")].every(b => window.__me.tasks.dispatchable().includes(b.dataset.act.slice(5)))')" "true"
qa_ok "…and every offered verb names its own subject" "$(qa_js '[...document.querySelectorAll(".ix-verb, #card .verb")].every(b => !!b.dataset.id)')" "true"

echo "-- the Instrument appears with work, and takes no space from the world"
run_js "window.__me.A.select(null)"
qa_ok "the world's navigation sits on the world" "$(qa_js 'document.querySelector("#stage").contains(document.querySelector(".stage-tools"))')" "true"
qa_ok "the Instrument sits on the world" "$(qa_js 'document.querySelector("#stage").contains(document.querySelector("#instrument"))')" "true"
qa_ok "…and takes no layout space" "$(qa_jsv 'getComputedStyle(document.querySelector("#instrument")).position')" "absolute"
qa_okn "the stage is 820 wide at rest" "$(rect stage w)" "820" 0
qa_okn "…and 834 high at rest" "$(rect stage h)" "834" 0
run_js "(async () => { const A = window.__me.A; A.select('soffit'); await A.lift('soffit'); return 1; })()"
qa_ok "invoking work shows the Instrument" "$(qa_js 'document.querySelector("#instrument").hidden')" "false"
qa_ok "the Instrument shows the reading it is in" "$(qa_jsv 'document.querySelector("#instrument #stKind").textContent + ": " + document.querySelector("#instrument .st-title").textContent')" "Lifted: Entrance soffit"
qa_ok "…and the seam names the work in hand" "$(qa_jsv 'window.__me.qa.state().taskTitle')" "Entrance soffit lifted"
qa_okn "the world did not resize for it" "$(rect stage w)" "820" 0
qa_okn "…nor change its height" "$(rect stage h)" "834" 0
qa_ok "the Instrument is inside the stage it overlays" "$(inside_stage)" "true"
qa_ok "the locator does not collide with the navigation on the world" "$(overlap where tools)" "no"
run_js "(async () => { await window.__me.A.closeAll(); return 1; })()"
qa_ok "the Instrument leaves when the work does" "$(qa_js 'document.querySelector("#instrument").hidden')" "true"

echo "-- a row's verb acts on the row's subject, and never rewrites the identity"
run_js "window.__me.A.select('tide1')"
qa_ok "the artwork's Card is the artwork" "$(qa_jsv 'document.querySelector("#card .c-t").textContent')" "Tide Study I"
qa_ok "the artwork offers its own verbs, not the wall's" "$(verbs '#card .verb')" "look-face look-dims"
qa_ok "the wall it hangs on is in the Index, with the wall's own verb" "$(qa_js '!!document.querySelector("#index [data-act=\"look-unroll\"][data-id=\"rotunda\"]")')" "true"
qa_js 'document.querySelector("#index [data-act=\"look-unroll\"][data-id=\"rotunda\"]").click()' >/dev/null
run_js
qa_ok "the verb opened the work it named" "$(qa_jsv 'window.__me.S.session?.wallId')" "rotunda"
qa_ok "…on the subject the row named, not on the selection" "$(qa_jsv 'window.__me.S.task.subject + ">" + window.__me.S.task.target.id')" "rotunda>rotunda"
qa_ok "…and left the selection alone" "$(qa_jsv 'window.__me.S.sel')" "tide1"
qa_ok "the Card still shows the identity, mid-reading" "$(qa_jsv 'document.querySelector("#card .c-t").textContent')" "Tide Study I"
qa_okn "the reading is the wall, unrolled" "$(qa_js 'window.__me.S.session.u')" "1" 0.001
run_js "(async () => { await window.__me.A.closeAll(); return 1; })()"

# The other half of the same law: when the artwork asks, the artwork stays the subject and the wall
# it hangs on is only the technical target — the Card's own verb carries its own identity.
qa_js 'document.querySelector("#card [data-act=\"look-face\"][data-id=\"tide1\"]").click()' >/dev/null
run_js
qa_ok "the artwork's own verb walks to its wall" "$(qa_jsv 'window.__me.S.session?.wallId + ":" + window.__me.S.session?.focusName')" "rotunda:Tide Study I on the Rotunda wall"
qa_ok "…keeping the artwork as the subject that asked" "$(qa_jsv 'window.__me.S.task.subject + ">" + window.__me.S.task.target.id')" "tide1>rotunda"
qa_ok "no shell panel overlaps the world it frames" "$(bounds_ok)" "true"

qa_faults_ok "no command or page fault while driving the shell"
qa_browser_errors_ok "no console or page errors"
qa_summary "Stage S2 · World shell"
