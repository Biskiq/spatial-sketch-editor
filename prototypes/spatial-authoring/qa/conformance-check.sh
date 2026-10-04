#!/usr/bin/env bash
# Product-reachable specimens. Only deterministic authored fixture loading is outside the flow.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"
qa_open
qa_faults_clear
conformance_ok(){ if [ -z "$2" ]; then qa_fail_msg "empty observation: $1"; else qa_ok "$@"; fi; }
checkpoint(){ if [ "${QA_CONFORMANCE_UNTIL:-}" = "$1" ];then qa_summary "V2 boundary $1";exit;fi; }
capture(){
 [ "$QA_SHOT" = 0 ] && return 0
 # Observe the settled paper/material transition as well as Camera/DOM state.
 for frame in {1..12};do qa_frames;done
 qa_snap "$1"
 qa_js '({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,lens:__me.S.lens,selection:__me.S.sel,context:__me.S.experienceContext,task:__me.S.task,realized:__me.qa.realized(),source:__me.A.domainSnapshot()})' >"$QA_OUT/$1.json"
}
click(){ agent-browser click "$1" >/dev/null; qa_frames; }
fill(){ agent-browser fill "$1" "$2" >/dev/null; qa_press Enter; }
pose(){ qa_js '__me.qa.realized()'; }
source_hash(){ qa_js '(()=>{const s=JSON.stringify(__me.A.domainSnapshot());let h=0;for(const ch of s)h=(Math.imul(h,31)+ch.charCodeAt(0))|0;return h;})()'; }
undo(){ qa_jsv '__me.S.undo.length'; }
# Read-only observations never establish the state being tested.
visible='e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}'
hit='e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return at===e||e.contains(at);}'
# QA-1: Reset, select a subject, explicitly Present, edit Meaning, derive, Capture.
qa_js '__me.E.resetExperience(false)' >/dev/null
click '#lens [data-lens="experience"]'
click '#index [data-act="pres-ref"][data-id="machine"]'
click '#card [data-act="exp-create"]'
fill '[data-exp-field="name"]' 'Why the drive matters'
fill '[data-exp-field="meaning"]' 'A casing, a rotor, and a path for power.'
before="$(source_hash)";standpoint="$(pose)"
click '#headPreview'
conformance_ok 'no-Guide/no-View Preview runs from authored meaning alone' "$(qa_js '(!!__me.S.visitor&&__me.S.visitor.runtime.stopId===null&&Object.keys(__me.ctx.cameraSource.views).length===0)') / $(source_hash)" "true / $before"
click '[data-act="exp-exit-preview"]'
conformance_ok 'no-View Preview restores complete standpoint' "$(pose)" "$standpoint"
before="$(source_hash)"; count="$(undo)"
click '#card [data-act="exp-auto"]'
conformance_ok 'Auto is derived intent, with no source/history change' "$(source_hash) / $(undo)" "$before / $count"
click '#card [data-act="exp-hints"]'
click '[data-act="exp-derived-hint"][data-hint="Left"]'
click '#experienceInstrument [data-act="exp-capture"]'
click '#card [data-act="exp-hints"]'
click '[data-act="exp-derived-hint"][data-hint="Right"]'
click '#experienceInstrument [data-act="exp-capture"]'
click '#card [data-act="exp-bring"]'
conformance_ok 'QA-1 visible working Set, quiet Card, no Guide/graph/rig' "$(qa_js "(document.querySelectorAll('[data-exp-view]').length===2&&[...document.querySelectorAll('[data-exp-view]')].every($visible)&&!document.querySelector('#experienceDeck')&&!document.querySelector('[data-frame-gate]')&&__me.ctx.experience.guide.length===0&&Object.keys(__me.ctx.cameraSource.connections).length===0&&document.querySelectorAll('#card .verb').length===0)")" true
capture qa-1-ordinary
conformance_ok 'Set markers are actual hit targets' "$(qa_js "[...document.querySelectorAll('[data-exp-view]')].every($hit)")" true
conformance_ok 'Set has visible direction glyphs separate from identity plates' "$(qa_js '(document.querySelectorAll("[data-view-direction]").length===2&&[...document.querySelectorAll("[data-view-direction]")].every(e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width*r.height>30&&!at?.closest("[data-exp-view]");}))')" true
checkpoint ordinary
set_ids="$(qa_js '[...document.querySelectorAll("[data-exp-view]")].map(e=>e.dataset.id).sort()')";before="$(source_hash)"
click '.stage-tools [data-act="plan"]'
conformance_ok 'Plan shows the same unordered Set without authored edits' "$(qa_js '[...document.querySelectorAll("[data-exp-view]")].map(e=>e.dataset.id).sort()') / $(source_hash)" "$set_ids / $before"
capture qa-1-plan
click '.stage-tools [data-act="3d"]'
click '#card [data-act="exp-bring"]'
conformance_ok '3D returns the same Set through explicit navigation' "$(qa_js '[...document.querySelectorAll("[data-exp-view]")].map(e=>e.dataset.id).sort()') / $(source_hash)" "$set_ids / $before"
click '#headPreview'
conformance_ok 'visitor removes and deactivates every authoring instrument' "$(qa_js '(__me.S.task===null&&!document.querySelector("[data-exp-camera]")&&getComputedStyle(document.querySelector("#ovHtml")).display==="none")')" true
click '[data-act="exp-exit-preview"]'
click '#card [data-act="exp-add-guide"]'
conformance_ok 'first Stop gives Peek only' "$(qa_js '(__me.S.experienceContext.depth==="ordinary"&&document.querySelector("#experienceDeck").classList.contains("ordinary"))')" true
capture qa-1-peek
# QA-2/3: authored stress fixture has no active procedure or standpoint recipe.
qa_js '__me.E.loadConformance()' >/dev/null
conformance_ok 'fixture never selects or opens work' "$(qa_js '(__me.S.sel===null&&__me.S.experienceContext.depth==="ordinary"&&__me.ctx.experience.guide.length===6)')" true
click '#index [data-act="exp-open"][data-id="presentation-1"]'
click '#experienceDeck [data-act="exp-guide"]'
click '[data-act="plan"]'
# Explicit useful framing; opening overview itself is neutral.
# Bring into view stays a product control on the stable Card.
click '#card [data-act="exp-bring"]'
conformance_ok 'QA-2 six distinct reachable pins, L0/L1, no Set or graph' "$(qa_js '(()=>{const a=[...document.querySelectorAll(".exp-stop-pin")];return !!(a.length===6&&a.every(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&getComputedStyle(e).visibility!=="hidden"&&(hit===e||e.contains(hit));})&&a.every((e,i)=>a.every((f,j)=>i===j||Math.hypot(e.getBoundingClientRect().x-f.getBoundingClientRect().x,e.getBoundingClientRect().y-f.getBoundingClientRect().y)>12))&&!document.querySelector("[data-exp-view]")&&!document.querySelector("[data-exp-route]")&&document.querySelector(".stop-card.compact")&&document.querySelector(".stop-card.density-summary")&&__me.nav.plainPose().flat>.97);})()')" true
conformance_ok 'Overview owns shell breadth beneath Index and Card, with Guide locator and subject thumbnails' "$(qa_js '(()=>{const r=document.querySelector("#experienceDeck").getBoundingClientRect(),stage=document.querySelector("#stage").getBoundingClientRect();return r.left<stage.left&&r.right>stage.right&&r.width>innerWidth*.95&&!!document.querySelector("#index [data-act=exp-guide]")&&document.querySelectorAll(".stop-thumbnail[role=img]").length>=2;})()')" true
capture qa-2-overview
checkpoint overview
standpoint="$(pose)";camera="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')"
# All six identities are independently reachable from their real Stage pins and Deck cards.
for position in 0 1 2 3 4 5;do
 id="$(qa_jsv "__me.ctx.experience.guide[$position]")"
 click ".exp-stop-pin[data-id='$id']"
 conformance_ok "Stage pin selects occurrence $((position+1)) distinctly" "$(qa_js '__me.S.sel')" "\"$id\""
 click '#experienceDeck [data-act="exp-close"]'
 click '#experienceDeck [data-act="exp-guide"]'
 click ".stop-card[data-stop='$id'] [data-act='exp-stop']"
 conformance_ok "Deck selects that same occurrence $((position+1))" "$(qa_js '__me.S.sel')" "\"$id\""
 click '#experienceDeck [data-act="exp-close"]'
 click '#experienceDeck [data-act="exp-guide"]'
done
conformance_ok 'occurrence selection/disclosure preserves realized Camera and Camera source' "$(pose) / $(qa_js 'JSON.stringify(__me.ctx.cameraSource)')" "$standpoint / $camera"
capture qa-2-selected
stop="$(qa_jsv '__me.ctx.experience.guide[3]')"
click ".stop-card[data-stop='$stop'] [data-act='exp-stop']"
conformance_ok 'QA-3 unclipped L2 schematic Set and spatial Set' "$(qa_js "(document.querySelectorAll('.set-node').length===3&&document.querySelectorAll('[data-exp-view]').length===3&&[...document.querySelectorAll('.set-node')].every($visible)&&!document.querySelector('.stop-card.expanded input')&&document.querySelector('.stop-card.expanded').scrollHeight===document.querySelector('.stop-card.expanded').clientHeight)")" true
conformance_ok 'QA-3 all six occurrence cards stay readable and reachable at L2' "$(qa_js "[...document.querySelectorAll('.stop-card [data-act=exp-stop]')].every(e=>($visible)(e)&&($hit)(e))")" true
capture qa-3-occurrence
# Both Set projections select the same canonical use without navigating or mutating Camera.
uid="$(qa_jsv '__me.ctx.experience.presentations[__me.S.experienceContext.presentation].uses[1]')"
standpoint="$(pose)";before="$(source_hash)"
click ".set-node[data-id='$uid']"
conformance_ok 'schematic Set selects canonical View use without navigation/source edit' "$(qa_js '__me.S.sel') / $(pose) / $(source_hash)" "\"$uid\" / $standpoint / $before"
click ".stop-card[data-stop='$stop'] [data-act='exp-stop']"
click "[data-exp-view][data-id='$uid']"
conformance_ok 'spatial Set selects the same canonical use' "$(qa_js '__me.S.sel') / $(pose)" "\"$uid\" / $standpoint"
count="$(undo)"
click '#card [data-act="exp-role"][data-role="entry"]'
conformance_ok 'shared Set role change asks before source/history changes' "$(qa_js '(!!__me.S.expSourceAsk)') / $(source_hash) / $(undo)" "true / $before / $count"
click '[data-act="exp-source-cancel"]'
click ".stop-card[data-stop='$stop'] [data-act='exp-stop']"
click '#card .exp-more summary'
before="$(source_hash)"; count="$(undo)"
fill '[data-exp-field="meaning"]' 'Shared meaning proposed through the product.'
conformance_ok 'shared Meaning asks before source/history changes' "$(qa_js '(!!__me.S.expSourceAsk&&document.querySelector(".ask-rule").textContent.includes("Stop 6"))') / $(source_hash) / $(undo)" "true / $before / $count"
capture qa-3-scope
checkpoint shared
click '[data-act="exp-source-cancel"]'
conformance_ok 'Cancel writes zero history' "$(source_hash) / $(undo)" "$before / $count"
fill '[data-exp-field="meaning"]' 'Power travels through the protected rotor.'
click '[data-act="exp-source-accept"]'
conformance_ok 'accepted shared edit is one history step' "$(undo)" "$((count+1))"
# Entry belongs to this occurrence; selecting another shared View changes no Camera source.
click '.stop-details summary'
local_entry="$(qa_jsv '__me.ctx.experience.presentations[__me.S.experienceContext.presentation].uses[1]')"
camera="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')"
agent-browser select '[data-exp-entry]' "$local_entry" >/dev/null;qa_frames
conformance_ok 'local Stop entry leaves the shared Set and Camera source intact' "$(qa_js 'JSON.stringify(__me.ctx.cameraSource)') / $(qa_js "(__me.ctx.experience.stops['$stop'].entry.useId==='$local_entry'&&__me.ctx.experience.stops[__me.ctx.experience.guide[5]].entry.kind==='presentation')")" "$camera / true"
click '#undoBtn'
# QA-4: open adjacent Seam while 3D, then explicitly author Travel and useful Plan.
click '#card .stop-details summary'
click '#card .exp-more summary'
click '[data-act="3d"]'
standpoint="$(pose)"
to="$(qa_jsv '__me.ctx.experience.guide[4]')"
click "[data-act='exp-seam'][data-from='$stop'][data-to='$to']"
conformance_ok 'opening Seam does not move realized Camera' "$(pose)" "$standpoint"
click '[data-act="exp-travel"]'
first="$(qa_jsv '__me.ctx.experience.presentations[__me.ctx.experience.stops[__me.ctx.experience.guide[3]].presentationId].uses[0]')"
second="$(qa_jsv '__me.ctx.experience.presentations[__me.ctx.experience.stops[__me.ctx.experience.guide[3]].presentationId].uses[1]')"
click "[data-act='exp-connect'][data-id='$first']"
click "[data-act='exp-connect'][data-id='$second']"
route="$(qa_jsv '__me.S.task.params.connection')"
click "[data-act='exp-route'][data-id='$route']"
# Add a real observer anchor with pointer, away from panels and endpoint controls.
p="$(qa_jsv '(()=>{const r=document.querySelector("#gl").getBoundingClientRect();return Math.round(r.x+r.width*.53)+","+Math.round(r.y+r.height*.38)})()')"
qa_move "${p%,*}" "${p#*,}"; qa_down; qa_up; qa_frames
conformance_ok 'QA-4 actual Plan Camera graph, 2/3 reach, gap, endpoints, anchor and pace' "$(qa_js "(__me.nav.plainPose().flat>.97&&document.querySelectorAll('[data-exp-route]').length===2&&document.querySelectorAll('[data-endpoint=origin]').length===3&&document.querySelector('[data-endpoint=destination]')&&document.querySelector('[data-exp-gap]')&&document.querySelector('[data-exp-anchor]')&&document.querySelector('[data-exp-pace]')&&!document.querySelector('.station-projection')&&[...document.querySelectorAll('[data-endpoint]')].every($visible))")" true
conformance_ok 'Stage route samples exactly consume the Camera evaluator and remain above the Deck' "$(qa_js '(()=>{const stage=document.querySelector("#stage").getBoundingClientRect(),bottom=document.querySelector("#experienceDeck").getBoundingClientRect().top-stage.top;return [...document.querySelectorAll("[data-exp-route]")].every(el=>{const r=__me.nav.routeGeometry(__me.nav.resolvedCamera(),el.dataset.expRoute),numbers=el.getAttribute("d").match(/-?\d+(?:\.\d+)?/g).map(Number);return numbers.length===82&&r.samples.every((s,i)=>{const p=__me.ctx.stage.project(s.observer);return Math.abs(numbers[i*2]-p.x)<.06&&Math.abs(numbers[i*2+1]-p.y)<.06&&p.x>0&&p.x<stage.width&&p.y>0&&p.y<bottom;});})&&!document.querySelector("[data-endpoint][data-exp-anchor]");})()')" true
capture qa-4-route
checkpoint route
anchor="$(qa_jsv '__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors[0]?.id')"
count="$(undo)"; before="$(source_hash)"
qa_drag "[data-exp-anchor=\"$anchor\"]" 25 10
conformance_ok 'one accepted observer-anchor drag is one Undo step' "$(undo)" "$((count+1))"
click '#undoBtn'
conformance_ok 'Undo restores route source' "$(source_hash)" "$before"
# Capture route immediately before Coordinate so the QA-4/5 pair proves unchanged spatial route.
capture qa-4-route
standpoint="$(pose)"; before="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')"
click '[data-act="exp-coordinate"]'
agent-browser select '[data-exp-station]' "$anchor" >/dev/null;qa_frames
click '[data-act="exp-beat"]'
contribution="$(qa_jsv 'Object.values(__me.ctx.experience.uses).find(u=>u.definitionId)?.id')"
agent-browser select '[data-exp-invoke-use]' "$contribution" >/dev/null;qa_frames
click '[data-act="exp-invoke-beat"]'
identity="$(qa_js '__me.S.sel')"
click ".station-tick[data-id='$anchor']"
conformance_ok 'station focus highlights both projections without replacing canonical selection' "$(qa_js '__me.S.sel') / $(qa_js "(document.querySelector('.station-tick.active').dataset.id==='$anchor'&&document.querySelector('.exp-station.active').dataset.expStationLabel==='$anchor')")" "$identity / true"
conformance_ok 'QA-5 keeps exact QA-4 Camera source and realized standpoint' "$(pose) / $(qa_js 'JSON.stringify(__me.ctx.cameraSource)')" "$standpoint / $before"
conformance_ok 'QA-5 station projections mirror, with local beat/hold lanes' "$(qa_js '(()=>{const spatial=[...document.querySelectorAll("[data-exp-station-label]")],temporal=[...document.querySelectorAll("[data-station-counterpart]")];return temporal.length>=3&&temporal.every(t=>spatial.some(s=>s.dataset.expStationLabel===t.dataset.stationCounterpart))&&!!document.querySelector(".coord-beat")&&!!document.querySelector(".coord-hold")&&document.querySelector("[data-hold-duration]").getBoundingClientRect().width>20;})()')" true
conformance_ok 'coordination preserves reachable origin/destination identities and visible gap' "$(qa_js "([...document.querySelectorAll('[data-endpoint]')].every(e=>($visible)(e)&&($hit)(e))&&($visible)(document.querySelector('[data-exp-gap]')))")" true
conformance_ok 'Coordination composes inside the central triptych and Card exposes local binding/reach' "$(qa_js '(()=>{const central=document.querySelector(".seam-instrument"),strip=document.querySelector(".coordination-strip"),deck=document.querySelector("#experienceDeck").getBoundingClientRect(),stage=document.querySelector("#stage").getBoundingClientRect();return central.contains(strip)&&strip.getBoundingClientRect().right<=central.getBoundingClientRect().right&&deck.left<stage.left&&deck.right>stage.right&&!!document.querySelector("#card [data-coordination-detail]")&&document.querySelector("#card [data-coordination-detail]").textContent.includes("Reach · this transition ×1");})()')" true
capture qa-5-coordination
checkpoint coordination
# Reopen has both projections and resolves the route owning saved beats.
click '[data-act="exp-close"]'
click '[data-act="exp-guide"]'
click "[data-act='exp-seam'][data-from='$stop'][data-to='$to']"
conformance_ok 'saved coordination reopens route and both station projections' "$(qa_js '(!!document.querySelector(".station-projection")&&document.querySelectorAll("[data-exp-station-label]").length>=3&&!!__me.S.task.params.connection)')" true
# Camera pace and anchor geometry change derived timing without rebinding Experience stations.
refs="$(qa_js 'JSON.stringify(__me.ctx.experience.seams[`${__me.S.experienceContext.seam.from}>${__me.S.experienceContext.seam.to}`].beats)')"
timing="$(qa_js 'document.querySelector(".coord-hold").textContent')"
agent-browser select '[data-exp-pace]' slow >/dev/null;qa_frames
conformance_ok 'Camera pace updates displayed timing and retains beat/hold refs' "$(qa_js 'JSON.stringify(__me.ctx.experience.seams[`${__me.S.experienceContext.seam.from}>${__me.S.experienceContext.seam.to}`].beats)') / $(qa_js "(document.querySelector('.coord-hold').textContent!==$timing)")" "$refs / true"
agent-browser click "[data-exp-anchor='$anchor']" >/dev/null;qa_key_dispatch ArrowRight
conformance_ok 'keyboard anchor edit preserves stable beat/hold references' "$(qa_js 'JSON.stringify(__me.ctx.experience.seams[`${__me.S.experienceContext.seam.from}>${__me.S.experienceContext.seam.to}`].beats)')" "$refs"
# New route invocation after cross-lens navigation has a fresh return and no remembered pose.
click '#lens [data-lens="world"]'
click '.stage-tools [data-act="3d"]'
standpoint="$(pose)"
click '#lens [data-lens="experience"]'
click '#card [data-act="exp-resume"]'
conformance_ok 'coordination Resume keeps NOW and restores both projections neutrally' "$(pose) / $(qa_js '(!!document.querySelector(".station-projection")&&__me.S.experienceContext.depth==="coordination")')" "$standpoint / true"
click "[data-act='exp-route'][data-id='$route']"
click '[data-act="exp-route-return"]'
conformance_ok 'resumed route return uses the current invocation standpoint' "$(pose)" "$standpoint"
# Repair only the remaining gap, then Cut keeps Camera connectivity but paints no traversal.
remaining="$(qa_jsv '__me.ctx.experience.presentations[__me.ctx.experience.stops[__me.ctx.experience.guide[3]].presentationId].uses[2]')"
click "[data-act='exp-connect'][data-id='$remaining']"
conformance_ok 'one explicit gap repair yields 3/3 support' "$(qa_js 'document.querySelector("#experienceDeck").textContent.includes("Reachable from 3 of 3")')" true
camera="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')"
click '[data-act="exp-cut"]'
conformance_ok 'Cut preserves Camera source, paints no real route or anchor' "$(qa_js 'JSON.stringify(__me.ctx.cameraSource)') / $(qa_js '(!document.querySelector("[data-exp-route]")&&!document.querySelector("[data-exp-anchor]"))')" "$camera / true"
# Reusing that destination after Stop 6 makes the same Camera route reach two Seams.
click '[data-act="exp-close"]'
click '#index [data-act="exp-open"][data-id="presentation-11"]'
click '#card [data-act="exp-add-guide"]'
click '#experienceDeck [data-act="exp-guide"]'
six="$(qa_jsv '__me.ctx.experience.guide[5]')";seven="$(qa_jsv '__me.ctx.experience.guide[6]')"
click "[data-act='exp-seam'][data-from='$six'][data-to='$seven']"
click '[data-act="exp-travel"]'
click '[data-act="exp-coordinate"]'
conformance_ok 'multiple supported routes require an explicit coordination choice' "$(qa_js '(__me.S.task.params.chooseRoute===true&&!document.querySelector(".station-projection"))')" true
click "[data-act='exp-route-choice'][data-id='$route']"
before="$(source_hash)";count="$(undo)"
agent-browser select '[data-exp-pace]' fast >/dev/null;qa_frames
conformance_ok 'shared route pace asks with two Seams before writing source/history' "$(qa_js '(!!__me.S.expRouteAsk&&__me.S.expRouteAsk.affected.length===2)') / $(source_hash) / $(undo)" "true / $before / $count"
click '[data-act="exp-route-cancel"]'
conformance_ok 'shared route Cancel leaves source/history untouched' "$(source_hash) / $(undo)" "$before / $count"
agent-browser select '[data-exp-pace]' fast >/dev/null;qa_frames
click '[data-act="exp-route-scope"]'
conformance_ok 'accepting shared route pace writes one aggregate history step' "$(undo)" "$((count+1))"
click "[data-act='exp-route'][data-id='$route']"
before="$(source_hash)";count="$(undo)"
qa_drag "[data-exp-anchor=\"$anchor\"]" 20 12
conformance_ok 'shared observer-anchor gesture remains a proposal until scope acceptance' "$(qa_js '(!!__me.S.expRouteAsk)') / $(source_hash) / $(undo)" "true / $before / $count"
click '[data-act="exp-route-cancel"]'
conformance_ok 'canceling shared anchor proposal writes zero history' "$(source_hash) / $(undo)" "$before / $count"
# QA-6 no Guide; use the ordinary no-Guide example through actual controls again.
qa_js '__me.E.resetExperience(false)' >/dev/null
click '#index [data-act="pres-ref"][data-id="machine"]'
click '#card [data-act="exp-create"]'
click '#card [data-act="exp-auto"]'
click '#card [data-act="exp-capture"]'
click '#card [data-act="exp-bring"]'
click '#card .exp-view [data-act="pres-ref"]'
click '#card [data-act="exp-precise"]'
click '[data-act="exp-posture"][data-posture="through"]'
conformance_ok 'QA-6 Through has a framing gate, real grips and exactly one local tape; no Guide Deck' "$(qa_js "(!!document.querySelector('[data-frame-gate]')&&document.querySelectorAll('[data-exp-camera]').length===1&&document.querySelectorAll('[data-active-tape] input').length===1&&!document.querySelector('#experienceDeck')&&[...document.querySelectorAll('[data-exp-camera],[data-active-tape]')].every($visible))")" true
click '.camera-grips [data-grip="el"]'
conformance_ok 'switching the active grip removes the previous active input/gesture binding' "$(qa_js '(document.querySelectorAll("[data-exp-camera]").length===1&&document.querySelectorAll("[data-exp-precision]").length===1&&document.querySelector("[data-exp-camera]").dataset.grip==="el")')" true
click '.camera-grips [data-grip="frameH"]'
count="$(undo)";qa_drag '[data-exp-camera]' 0 20
conformance_ok 'framing gesture accepts one Camera transaction' "$(undo)" "$((count+1))"
count="$(undo)";fill '[data-exp-precision]' '4.0'
conformance_ok 'typed active framing value accepts one Camera transaction' "$(undo) / $(qa_js '(__me.ctx.cameraSource.views[__me.S.task.target.id].pose.frameH===4)')" "$((count+1)) / true"
capture qa-6-precise
standpoint="$(pose)";before="$(source_hash)"
click '#headPreview'
conformance_ok 'Preview rig and input removed; source frozen' "$(qa_js '(!document.querySelector("[data-exp-camera]")&&!document.querySelector("#experienceInstrument")&&__me.S.task===null)') / $(source_hash)" "true / $before"
capture qa-6-visitor
checkpoint preview
click '[data-act="exp-exit-preview"]'
conformance_ok 'Preview restores complete realized standpoint and precise context' "$(pose) / $(qa_js '(!!document.querySelector("[data-frame-gate]")&&__me.S.experienceContext.depth==="precision")')" "$standpoint / true"
click '[data-act="exp-posture"][data-posture="outside"]'
conformance_ok 'Outside actually shows observer/frustum and moves from Through explicitly' "$(qa_js '(!!document.querySelector("[data-camera-frustum]")&&!!document.querySelector("[data-exp-observer]")&&__me.S.task.params.posture==="outside")')" true
capture qa-6-outside
# Neutral Resume is proved against the complete rendered camera across successive frames.
click '[data-act="exp-posture"][data-posture="through"]'
click '#lens [data-lens="world"]'
click '.stage-tools [data-act="plan"]'
standpoint="$(pose)";before="$(source_hash)"
click '#lens [data-lens="experience"]'
conformance_ok 'lens return is ordinary with current standpoint and foreign identity intact' "$(pose) / $(qa_js '(__me.S.task===null&&__me.S.experienceContext.depth==="ordinary")')" "$standpoint / true"
click '#card [data-act="exp-resume"]'
for frame in 1 2 3;do qa_frames;conformance_ok "Neutral Resume rendered frame $frame preserves eye/direction/up/FOV/mirror/aspect" "$(pose)" "$standpoint";done
conformance_ok 'resumed precision truthfully says Plan, with no silent Through alignment' "$(qa_js '(__me.S.task.params.posture==="plan"&&!document.querySelector("[data-frame-gate]"))')" true
capture qa-6-plan-resume
checkpoint resume
click '[data-act="exp-posture"][data-posture="through"]'
click '[data-act="exp-camera-return"]'
conformance_ok 'resumed invocation Put it back returns to NOW, not the parked Through pose' "$(pose)" "$standpoint"
click '[data-act="exp-posture"][data-posture="through"]'
standpoint="$(pose)";count="$(undo)";before="$(source_hash)"
p="$(qa_at '[data-exp-camera]')";qa_move "${p%,*}" "${p#*,}";qa_down;qa_move "${p%,*}" "$(( ${p#*,}+35 ))";qa_frames
qa_key_dispatch Escape;qa_up;qa_frames
conformance_ok 'Escape rolls back a live framing audition exactly once, without source/history' "$(pose) / $(source_hash) / $(undo)" "$standpoint / $before / $count"
# Lost pointer capture follows the same cancel path; the late pointer release cannot accept.
p="$(qa_at '[data-exp-camera]')";qa_move "${p%,*}" "${p#*,}";qa_down;qa_move "${p%,*}" "$(( ${p#*,}+25 ))";qa_frames
agent-browser eval 'document.querySelector("[data-exp-camera]").dispatchEvent(new PointerEvent("lostpointercapture",{bubbles:true}))' >/dev/null
qa_up;qa_frames
conformance_ok 'lost capture cancels audition, with no late release commit' "$(pose) / $(source_hash) / $(undo)" "$standpoint / $before / $count"
qa_faults_ok 'conformance commands'
qa_browser_errors_ok 'conformance browser'
qa_summary 'V2 product conformance'
