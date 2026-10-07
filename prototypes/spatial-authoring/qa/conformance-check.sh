#!/usr/bin/env bash
# Product-reachable specimens. Only deterministic authored fixture loading is outside the flow.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_QUERY='motion=instant'
source "$QA_DIR/lib.sh"
qa_open
fixture(){
 click '#experienceExamples > summary'
 click "#experienceExamples [data-act=\"$1\"]"
 click '#experienceExamples > summary'
}
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
click(){ agent-browser scrollintoview "$1" >/dev/null;qa_scroll_center "$1";agent-browser click "$1" >/dev/null;qa_frames; }
fill(){ agent-browser fill "$1" "$2" >/dev/null; qa_press Enter; }
pose(){ qa_js '__me.qa.realized()'; }
source_hash(){ qa_js '(()=>{const s=JSON.stringify(__me.A.domainSnapshot());let h=0;for(const ch of s)h=(Math.imul(h,31)+ch.charCodeAt(0))|0;return h;})()'; }
undo(){ qa_jsv '__me.S.undo.length'; }
# Read-only observations never establish the state being tested.
visible='e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}'
hit='e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return at===e||e.contains(at);}'
# QA-1: Reset, select a subject, explicitly Present, edit Meaning, derive, Capture.
click '#lens [data-lens="experience"]'
fixture exp-reset
click '#index [data-act="pres-ref"][data-id="machine"]'
click '#card [data-act="exp-create"]'
fill '[data-exp-field="name"]' 'Why the drive matters'
fill '[data-exp-primary]' 'A casing, a rotor, and a path for power.'
conformance_ok 'the explanation field commits one authored narration through the real control' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,primary=Object.values(e.uses).filter(u=>u.primary);return primary.length===1&&primary[0].presentationId===pid&&e.definitions[primary[0].definitionId].kind==="narration"&&e.definitions[primary[0].definitionId].text==="A casing, a rotor, and a path for power.";})()')" true
conformance_ok 'quickstart observes the real Presentation it was asked for, not a button press' "$(qa_js '(()=>{const s=document.querySelector("[data-example-step]").textContent,o=document.querySelector("[data-example-observed]").textContent;return s.includes("1/18")&&o.includes("Why the drive matters");})()')" true
# C9.1 ordinary loop: the subject-local audition is session state; Use captures one honest Activity.
click '#card .exp-focus [data-operate="machine"]'
conformance_ok 'the Presentation Card reaches the subject it presents' "$(qa_js '__me.S.sel')" '"machine"'
before="$(source_hash)"; count="$(undo)"
fill '[data-exp-audition="casing"]' '0.6'
conformance_ok 'operating the subject auditions on the real Stage without source or history' "$(qa_jsv 'JSON.stringify(__me.S.expAudition)')" '{"machine":{"open":0.6}}'
conformance_ok '…and the audition writes no source and no history' "$(source_hash) / $(undo)" "$before / $count"
conformance_ok 'the audition is stated as a temporary projection' "$(qa_js 'document.querySelector("#card").textContent.includes("Temporary projection")')" true
# Outside Preview there is no visitor runtime: a real session clock must turn a running audition so the
# effect is visible, and stopping drops the phase again — still with no source or history.
click '#card [data-act="exp-audition"][data-cap="rotor"][data-value="true"]'
conformance_ok 'an auditioned running capability advances on a session clock outside Preview' "$(qa_js '(async()=>{const rot=()=>__me.ctx.stage.items.get("machine").capabilityParts.rotor.rotation.y;await __me.qa.render();const a=rot();await new Promise(r=>setTimeout(r,60));await __me.qa.render();return __me.S.expAudition.machine.running===true&&a>=0&&rot()>a;})()')" true
conformance_ok '…with source and history still untouched' "$(source_hash) / $(undo)" "$before / $count"
click '#card [data-act="exp-audition"][data-cap="rotor"][data-value="false"]'
conformance_ok 'stopping the audition drops the phase' "$(qa_js '(__me.S.expAudition.machine.running===false&&__me.ctx.stage.items.get("machine").capabilityParts.rotor.rotation.y===0)')" true
click '#card [data-act="exp-use"][data-cap="casing"]'
conformance_ok 'Use in this Presentation captures one Activity holding the auditioned value' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,us=Object.values(e.uses).filter(u=>!u.viewId&&e.definitions[u.definitionId]?.kind==="control"),d=us[0]&&e.definitions[us[0].definitionId];return us.length===1&&us[0].presentationId===pid&&d.subjectId==="machine"&&d.capabilityId==="casing"&&d.value===0.6&&e.guide.length===0&&Object.keys(e.stops).length===0;})()')" true
conformance_ok 'the capture writes one history step and creates no Camera View' "$(undo) / $(qa_js 'Object.keys(__me.ctx.cameraSource.views).length')" "$((count+1)) / 0"
fill '[data-exp-audition="casing"]' '0.9'
click '#card [data-act="exp-use"][data-cap="casing"]'
conformance_ok 'updating the captured value reuses that Activity and never duplicates it' "$(qa_js '(()=>{const e=__me.ctx.experience,us=Object.values(e.uses).filter(u=>!u.viewId&&e.definitions[u.definitionId]?.kind==="control");return us.length===1&&e.definitions[us[0].definitionId].value===0.9&&document.querySelector("#card").textContent.includes("Captured in this Presentation");})()')" true
pid="$(qa_jsv '__me.S.experienceContext.presentation')"
click "#index [data-act=\"exp-open\"][data-id=\"$pid\"]"
conformance_ok 'the Presentation lists the captured Activity by what it operates, where and how it starts' "$(qa_js '(()=>{const t=document.querySelector("#card details:nth-of-type(3)").textContent;return t.includes("Open casing")&&t.includes("Machine")&&t.includes("in Why the drive matters")&&t.includes("Starts on Presentation entry");})()')" true
# Open the Activity through its real, scroll-reachable contribution row.
click '#card details:nth-of-type(3) > summary'
click '#card > details:nth-of-type(3) .contribution [data-act="pres-ref"]'
conformance_ok 'the captured Activity reads as an honest identity, never a schema term' "$(qa_js 'document.querySelector("#card .c-k").textContent.includes("Activity · Experience")+"|"+(document.querySelector("#card").textContent.includes("Operates Machine · Open casing"))')" '"true|true"'
click "#index [data-act=\"exp-open\"][data-id=\"$pid\"]"
before="$(source_hash)";standpoint="$(pose)"
click '#headPreview'
conformance_ok 'no-Guide/no-View Preview runs the authored explanation and captured capability' "$(qa_js '(!!__me.S.visitor&&__me.S.visitor.runtime.stopId===null&&Object.keys(__me.ctx.cameraSource.views).length===0&&!!__me.S.visitor.runtime.overrides.machine?.open&&Object.values(__me.S.visitor.runtime.activities).some(a=>a.status==="running"))') / $(source_hash)" "true / $before"
conformance_ok 'the visitor caption speaks the explanation typed through the real control' "$(qa_js 'document.querySelector(".visitor-caption").textContent.includes("A casing, a rotor")')" true
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
# Selection never silently retargets a replaced Experience identity: the loader invalidates it before
# the deterministic fixture identities are reissued. World context survives the same load.
fixture exp-conformance
conformance_ok 'fixture never selects or opens work, and a replaced Experience selection is invalidated, never retargeted' "$(qa_js '__me.S.sel') / $(qa_js '(__me.S.experienceContext.depth==="ordinary"&&__me.ctx.experience.guide.length===6&&__me.S.task===null)')" 'null / true'
click '#index [data-act="pres-ref"][data-id="machine"]'
fixture exp-conformance
conformance_ok 'a World subject selection survives the same labelled load' "$(qa_js '__me.S.sel')" '"machine"'
# Ambiguous captures: two matching Activities in one Presentation. The choice is real product UI;
# Escape drops it whole, and Capture another is an explicit create that touches neither existing value.
click '#index [data-act="exp-open"][data-id="presentation-1"]'
click '#card > details:nth-of-type(4) > summary'
click '#card [data-act="exp-offer"]'
agent-browser select '[data-exp-offer="kind"]' behavior >/dev/null;qa_frames
fill '[data-exp-offer="value"]' '1'
click '#card [data-act="exp-offer-accept"]'
click '#index [data-act="pres-ref"][data-id="machine"]'
click '#card [data-act="exp-use"][data-cap="casing"]'
conformance_ok 'two matching captures ask which Activity to update, never mutating either' "$(qa_js '(()=>{const e=__me.ctx.experience,a=__me.S.expCaptureAsk,pid=__me.S.experienceContext.presentation,us=Object.values(e.uses).filter(u=>!u.viewId&&u.presentationId===pid&&e.definitions[u.definitionId]?.capabilityId==="casing");return !!a&&a.matches.length===2&&us.length===2&&us.every(u=>e.definitions[u.definitionId].value===1);})()')" true
qa_press Escape
conformance_ok 'Escape drops the ambiguous proposal with its audition: no stale choice survives' "$(qa_js '(__me.S.expCaptureAsk===null&&__me.S.expAudition===null)')" true
click '#card [data-act="exp-use"][data-cap="casing"]'
count="$(undo)"; views="$(qa_js 'Object.keys(__me.ctx.cameraSource.views).length')"
click '#card [data-act="exp-capture-new"]'
conformance_ok 'Capture another creates a third Activity and leaves both existing values untouched' "$(qa_js '(()=>{const e=__me.ctx.experience,us=Object.values(e.uses).filter(u=>!u.viewId&&e.definitions[u.definitionId]?.capabilityId==="casing");return us.length===3&&us.filter(u=>e.definitions[u.definitionId].value===1).length===2&&__me.S.expCaptureAsk===null;})()')" true
conformance_ok 'Capture another writes one history step and creates no Camera View' "$(undo) / $(qa_js 'Object.keys(__me.ctx.cameraSource.views).length')" "$((count+1)) / $views"
# A visitor offer is authored through the real subject control and stays an offer: subject-activated
# availability work, never an automatic Activity a traversal could start.
click '#index [data-act="pres-ref"][data-id="piano"]'
click '#card [data-act="exp-offer"][data-kind="interaction"]'
click '#card [data-act="exp-offer-accept"]'
offer="$(qa_jsv 'Object.values(__me.ctx.experience.uses).find(u=>u.kind==="interaction")?.id')"
conformance_ok 'a visitor offer is authored as an offer, never as automatic work' "$(qa_js "(()=>{const u=__me.ctx.experience.uses['$offer'];return !!u&&u.kind==='interaction'&&u.triggerSubjectId==='piano'&&u.start.kind==='visit'&&!u.viewId;})()")" true
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
click ".stop-card[data-stop='$stop'] [data-act='exp-expand-stop']"
conformance_ok 'QA-3 unclipped L2 schematic Set and spatial Set' "$(qa_js "(document.querySelectorAll('.set-node').length===3&&document.querySelectorAll('[data-exp-view]').length===3&&[...document.querySelectorAll('.set-node')].every($visible)&&!document.querySelector('.stop-card.expanded input')&&document.querySelector('.stop-card.expanded').scrollHeight===document.querySelector('.stop-card.expanded').clientHeight)")" true
conformance_ok 'QA-3 all six occurrence cards stay readable and reachable at L2' "$(qa_js "[...document.querySelectorAll('.stop-card [data-act=exp-stop]')].every(e=>($visible)(e)&&($hit)(e))")" true
capture qa-3-occurrence
# Both Set projections select the same canonical use without navigating or mutating Camera.
uid="$(qa_jsv '__me.ctx.experience.presentations[__me.S.experienceContext.presentation].uses[1]')"
standpoint="$(pose)";before="$(source_hash)"
click ".set-node[data-id='$uid']"
conformance_ok 'schematic Set selects canonical View use without navigation/source edit' "$(qa_js '__me.S.sel') / $(pose) / $(source_hash)" "\"$uid\" / $standpoint / $before"
click ".stop-card[data-stop='$stop'] [data-act='exp-expand-stop']"
click "[data-exp-view][data-id='$uid']"
conformance_ok 'spatial Set selects the same canonical use' "$(qa_js '__me.S.sel') / $(pose)" "\"$uid\" / $standpoint"
count="$(undo)"
click '#card [data-act="exp-role"][data-role="entry"]'
conformance_ok 'shared Set role change asks before source/history changes' "$(qa_js '(!!__me.S.expSourceAsk)') / $(source_hash) / $(undo)" "true / $before / $count"
click '[data-act="exp-source-cancel"]'
click ".stop-card[data-stop='$stop'] [data-act='exp-expand-stop']"
click '#card > .exp-more > summary'
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
local_entry="$(qa_jsv '__me.ctx.experience.presentations[__me.S.experienceContext.presentation].uses[1]')"
camera="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')"
agent-browser select '[data-exp-entry]' "$local_entry" >/dev/null;qa_frames
conformance_ok 'local Stop entry leaves the shared Set and Camera source intact' "$(qa_js 'JSON.stringify(__me.ctx.cameraSource)') / $(qa_js "(__me.ctx.experience.stops['$stop'].entry.useId==='$local_entry'&&__me.ctx.experience.stops[__me.ctx.experience.guide[5]].entry.kind==='presentation')")" "$camera / true"
click '#undoBtn'
# QA-4: open adjacent Seam while 3D, then explicitly author Travel and useful Plan.
click '#card .stop-details summary'
click '#card > .exp-more > summary'
click '[data-act="3d"]'
standpoint="$(pose)"
to="$(qa_jsv '__me.ctx.experience.guide[4]')"
click "[data-act='exp-seam'][data-from='$stop'][data-to='$to']"
conformance_ok 'opening Seam does not move realized Camera' "$(pose)" "$standpoint"
# N1: one explicit Travel preparation transaction authors the whole directed Seam graph. Every
# legitimate origin is left supported — an origin already at the destination View by Camera's own
# zero-distance evaluation, a reused authored route, or one newly created direct connection — and no
# origin is left as a gap. Nothing here was connected per origin by the author.
click '[data-act="exp-travel"]'
qa_frames
route="$(qa_jsv '[...document.querySelectorAll("[data-exp-route]")][0].dataset.expRoute')"
conformance_ok 'explicit Travel supports every legitimate origin in one authored step' "$(qa_js "(document.querySelector('#experienceDeck').textContent.includes('Reachable from 3 of 3')&&document.querySelector('#experienceDeck').textContent.includes('All origins supported'))")" 'true'
conformance_ok 'Travel leaves no origin as a gap and offers no per-origin surgery' "$(qa_js "(!document.querySelector('[data-exp-gap]')&&!document.querySelector('[data-act=exp-prepare]'))")" 'true'
conformance_ok 'Travel reports prepared versus reused support with the Camera owner' "$(qa_js "(/Prepared [0-9]+ Camera route/.test(__me.S.status.text)&&/Camera owns route geometry/.test(__me.S.status.text))")" 'true'
conformance_ok 'one Travel preparation is one aggregate Undo step' "$(qa_js "__me.S.undo.at(-1).label==='Prepare Camera routes and select Travel'")" 'true'
click "[data-act='exp-route'][data-id='$route']"
# Add a real observer anchor with pointer, away from panels and endpoint controls.
p="$(qa_jsv '(()=>{const r=document.querySelector("#gl").getBoundingClientRect();return Math.round(r.x+r.width*.53)+","+Math.round(r.y+r.height*.38)})()')"
qa_move "${p%,*}" "${p#*,}"; qa_down; qa_up; qa_frames
conformance_ok 'QA-4 actual Plan Camera graph, full support, endpoints, anchor and pace' "$(qa_js "(__me.nav.plainPose().flat>.97&&document.querySelectorAll('[data-exp-route]').length===3&&!document.querySelector('[data-exp-gap]')&&document.querySelectorAll('[data-endpoint=origin]').length===3&&document.querySelector('[data-endpoint=destination]')&&document.querySelector('[data-exp-anchor]')&&document.querySelector('[data-exp-pace]')&&!document.querySelector('.station-projection')&&[...document.querySelectorAll('[data-endpoint]')].every($visible))")" true
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
picker="$(qa_js "(()=>{const e=__me.ctx.experience,opts=[...document.querySelectorAll('[data-exp-invoke-use] option')].map(o=>o.value).filter(Boolean);return opts.includes('$contribution')&&!opts.includes('$offer')&&opts.every(id=>e.uses[id]&&!e.uses[id].viewId&&e.uses[id].kind!=='interaction');})()")"
conformance_ok 'the station picker offers automatic work only: the visitor offer is never traversal work' "$picker" true
binding="$(qa_js "(()=>{const e=__me.ctx.experience,x=__me.S.experienceContext,u=e.uses['$contribution'],seam=e.seams[x.seam.from+'>'+x.seam.to];return u.start.kind==='station'&&u.start.stationId==='$anchor'&&u.start.connectionId===__me.S.task.params.connection&&u.start.presentationId===e.stops[x.seam.to].presentationId&&seam.beats.filter(b=>b.kind==='invoke'&&b.useId==='$contribution').length===1;})()")"
conformance_ok 'invoking moves that Activity trigger to the station instead of adding a second trigger' "$binding" true
identity="$(qa_js '__me.S.sel')"
click ".station-tick[data-id='$anchor']"
conformance_ok 'station focus highlights both projections without replacing canonical selection' "$(qa_js '__me.S.sel') / $(qa_js "(document.querySelector('.station-tick.active').dataset.id==='$anchor'&&document.querySelector('.exp-station.active').dataset.expStationLabel==='$anchor')")" "$identity / true"
conformance_ok 'QA-5 keeps exact QA-4 Camera source and realized standpoint' "$(pose) / $(qa_js 'JSON.stringify(__me.ctx.cameraSource)')" "$standpoint / $before"
conformance_ok 'QA-5 station projections mirror, with local beat/hold lanes' "$(qa_js '(()=>{const spatial=[...document.querySelectorAll("[data-exp-station-label]")],temporal=[...document.querySelectorAll("[data-station-counterpart]")];return temporal.length>=3&&temporal.every(t=>spatial.some(s=>s.dataset.expStationLabel===t.dataset.stationCounterpart))&&!!document.querySelector(".coord-beat")&&!!document.querySelector(".coord-hold")&&document.querySelector("[data-hold-duration]").getBoundingClientRect().width>20;})()')" true
conformance_ok 'coordination preserves every supported origin identity and the destination' "$(qa_js "([...document.querySelectorAll('[data-endpoint]')].every(e=>($visible)(e)&&($hit)(e))&&!document.querySelector('[data-exp-gap]'))")" true
conformance_ok 'Coordination composes inside the central triptych and Card exposes local binding/reach' "$(qa_js '(()=>{const central=document.querySelector(".seam-instrument"),strip=document.querySelector(".coordination-strip"),deck=document.querySelector("#experienceDeck").getBoundingClientRect(),stage=document.querySelector("#stage").getBoundingClientRect();return central.contains(strip)&&strip.getBoundingClientRect().right<=central.getBoundingClientRect().right&&deck.left<stage.left&&deck.right>stage.right&&!!document.querySelector("#card [data-coordination-detail]")&&document.querySelector("#card [data-coordination-detail]").textContent.includes("Reach · this transition ×1");})()')" true
conformance_ok 'the Stop Card declares the station binding instead of a second trigger' "$(qa_js 'document.querySelector("#card [data-coordination-detail]").textContent.includes("trigger moves here")')" true
capture qa-5-coordination
checkpoint coordination
# Reopen has both projections and resolves the route owning saved beats.
click '[data-act="exp-close"]'
click '#experienceDeck [data-act="exp-guide"]'
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
# Every origin was already supported by the one Travel preparation; Cut then keeps that Camera
# connectivity while painting and executing no traversal.
conformance_ok 'the prepared support survives the resumed route work unrepaired' "$(qa_js 'document.querySelector("#experienceDeck").textContent.includes("Reachable from 3 of 3")&&!document.querySelector("[data-act=exp-prepare]")')" true
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
# MP2: selecting an unrelated Stop ends the route writer; a later Stage press cannot add an anchor.
route_id="$(qa_jsv '__me.S.task.params.connection')"
anchors_before="$(qa_js 'JSON.stringify(__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors)')"
standpoint="$(pose)"
unrelated="$(qa_jsv '__me.ctx.experience.guide.find(id=>id!==__me.S.experienceContext.seam.from&&id!==__me.S.experienceContext.seam.to)')"
click "[data-act='exp-stop'][data-id='$unrelated']"
conformance_ok 'selecting an unrelated Stop ends the route writer without moving Camera' "$(qa_js '(__me.S.experienceContext.depth!=="route"&&__me.S.experienceContext.seam===null&&__me.S.task?.kind==="experience-overview")') / $(pose)" "true / $standpoint"
stage_point="$(qa_jsv '(()=>{const r=document.querySelector("#stage canvas").getBoundingClientRect();return Math.round(r.x+r.width/2)+","+Math.round(r.y+r.height/2);})()')"
qa_move "${stage_point%,*}" "${stage_point#*,}";qa_down;qa_up
conformance_ok 'a later Stage press cannot add an anchor to the old route' "$(qa_js "JSON.stringify(__me.ctx.cameraSource.connections['$route_id'].anchors)")" "$anchors_before"
# QA-6 no Guide; use the ordinary no-Guide example through actual controls again.
fixture exp-reset
click '#index [data-act="pres-ref"][data-id="machine"]'
click '#card [data-act="exp-create"]'
click '#card [data-act="exp-auto"]'
click '#card [data-act="exp-capture"]'
click '#card [data-act="exp-bring"]'
click '#card .exp-view [data-act="pres-ref"]'
click '#card [data-act="exp-precise"]'
click '[data-act="exp-posture"][data-posture="through"]'
conformance_ok 'QA-6 Through has a framing gate, real grips and exactly one local tape; no Guide Deck' "$(qa_js "(!!document.querySelector('[data-frame-gate]')&&document.querySelectorAll('[data-exp-camera]').length===1&&document.querySelectorAll('[data-active-tape] input').length===1&&!document.querySelector('#experienceDeck')&&[...document.querySelectorAll('[data-exp-camera],[data-active-tape]')].every($visible))")" true
# C9.8: the six-property cluster is gone; a supported grip is selected directly on the drawing.
click '[data-grip="el"]'
conformance_ok 'switching the active grip removes the previous active input/gesture binding' "$(qa_js '(document.querySelectorAll("[data-exp-camera]").length===1&&document.querySelectorAll("[data-exp-precision]").length===1&&document.querySelector("[data-exp-camera]").dataset.grip==="el")')" true
click '[data-grip="frameH"]'
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
