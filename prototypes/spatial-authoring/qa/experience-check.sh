#!/usr/bin/env bash
# Unified Experience wiring; owns one browser/server through lib.sh.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"
qa_open
qa_faults_clear
# A control inside the scrollable Card can be on screen yet under the fixed Guide band at non-ordinary
# Experience depth (UX4/UX5), so a real click would land on the band. Center it in the Card's own scroll
# container first, the same way the shell's pointer path does, and only then click it. The same path serves
# the Index's own controls (the Camera Path home), which sit above the band for the same reason.
card_click(){ agent-browser scrollintoview "$1" >/dev/null;qa_scroll_center "$1";agent-browser click "$1" >/dev/null;qa_frames; }

agent-browser click '[data-act="lens"][data-lens="experience"]' >/dev/null
qa_frames
qa_ok 'ordinary Experience has no Deck or reading' "$(qa_js '(!__me.S.session && !document.querySelector("#experienceDeck"))')" 'true'
agent-browser click '[data-act="exp-open"][data-id="pres-highlights"]' >/dev/null
qa_frames
qa_ok 'explicit Presentation uses canonical identity' "$(qa_js '__me.S.sel')" '"pres-highlights"'
qa_card_menu
agent-browser fill '[data-exp-field="name"]' 'Garden meaning' >/dev/null
agent-browser press Enter >/dev/null
qa_frames
qa_ok 'rename writes one source step' "$(qa_js '(__me.ctx.experience.presentations[__me.S.sel].name === "Garden meaning" && __me.S.undo.length === 1)')" 'true'
agent-browser click '[data-act="lens"][data-lens="world"]' >/dev/null
qa_frames
qa_ok 'foreign identity crosses unchanged and inert' "$(qa_js '(__me.S.sel === "pres-highlights" && document.querySelector("#card").textContent.includes("Foreign identity") && !__me.S.session)')" 'true'
agent-browser click '#undoBtn' >/dev/null
qa_frames
qa_ok 'shared Undo restores Experience from World' "$(qa_js '__me.ctx.experience.presentations["pres-highlights"].name')" '"Saltmarsh Highlights"'
agent-browser click '#redoBtn' >/dev/null
qa_frames
qa_ok 'shared Redo restores rename' "$(qa_js '__me.ctx.experience.presentations["pres-highlights"].name')" '"Garden meaning"'
agent-browser click '[data-act="lens"][data-lens="experience"]' >/dev/null
qa_frames
# Opening, Capture and Auto are exercised through controls.
agent-browser click '[data-act="exp-open"][data-id="pres-highlights"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-capture"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-auto"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-capture"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-capture"]' >/dev/null
qa_frames
qa_ok 'three Views coexist without Guide or edges' "$(qa_js '(__me.ctx.experience.presentations["pres-highlights"].uses.length === 3 && __me.ctx.experience.guide.length === 0 && Object.keys(__me.ctx.cameraSource.connections).length === 0)')" 'true'
qa_js '__me.S.previewBefore = { source:JSON.stringify(__me.A.domainSnapshot()),pose:JSON.stringify(__me.nav.plainPose()),sel:__me.S.sel,lens:__me.S.lens }' >/dev/null
qa_preview_presentation
qa_ok 'Preview without Guide takes over authoring' "$(qa_js '(!!__me.S.visitor && document.body.classList.contains("visitor-preview") && __me.S.visitor.runtime.stopId === null)')" 'true'
agent-browser click '[data-act="exp-exit-preview"]' >/dev/null
qa_frames
qa_ok 'Preview restores lens selection pose and frozen source' "$(qa_js '(__me.S.previewBefore.source === JSON.stringify(__me.A.domainSnapshot()) && __me.S.previewBefore.pose === JSON.stringify(__me.nav.plainPose()) && __me.S.previewBefore.sel === __me.S.sel && __me.S.previewBefore.lens === __me.S.lens)')" 'true'
agent-browser click '[data-act="exp-add-guide"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-add-guide"]' >/dev/null
qa_frames
qa_ok 'Guide begins at Peek with distinct repeated Stops' "$(qa_js '(__me.ctx.experience.guide.length === 2 && __me.ctx.experience.guide[0] !== __me.ctx.experience.guide[1] && document.querySelector("#experienceDeck").classList.contains("ordinary"))')" 'true'
qa_js '__me.S.guidePose=JSON.stringify(__me.nav.plainPose())' >/dev/null
agent-browser click '[data-act="exp-guide"]' >/dev/null
qa_frames
qa_ok 'Guide posture is one lane of named chips and keeps Camera' "$(qa_js '(document.querySelectorAll("#experienceDeck .gd-stop-card").length === 2 && !!document.querySelector("#experienceDeck .gd-lane") && __me.S.guidePose === JSON.stringify(__me.nav.plainPose()))')" 'true'
# §5.4: the Expand is retired. A chip selects the Stop, and what the Card shows next is the Stop Card.
agent-browser click '#experienceDeck .gd-stop-card [data-act="exp-stop"]' >/dev/null
qa_frames
qa_js 'window.__stop=__me.S.sel' >/dev/null
qa_ok 'a chip selects the Stop and its Card reads it, with the shared Views intact' "$(qa_js '(()=>{const chips=[...document.querySelectorAll("#experienceDeck .gd-stop-card")];return !!(chips.length===2&&chips.filter(c=>c.classList.contains("selected")).length===1&&!document.querySelector("#experienceDeck .gd-stop-card.expanded")&&!document.querySelector("[data-act=exp-expand-stop]")&&__me.ctx.experience.presentations["pres-highlights"].uses.length===3&&!!document.querySelector("#card [data-stop-entry]"))})()')" 'true'
# §5.4: ordering lives in the Deck's Edit Guide menu, one row per Stop, and the menu keeps its own open
# state across the move it just wrote.
qa_card_door '#experienceDeck [data-exp-guide-menu]'
agent-browser click '#experienceDeck [data-exp-guide-menu] [data-edit-stop][aria-current="true"] [data-act="exp-move-stop"][data-delta="1"]' >/dev/null
qa_frames
qa_ok 'reorder changes order only' "$(qa_js '(__me.ctx.experience.guide[1] === window.__stop && Object.keys(__me.ctx.cameraSource.connections).length === 0)')" 'true'
qa_ok 'the Edit Guide menu stays open through the move' "$(qa_js 'document.querySelector("#experienceDeck [data-exp-guide-menu]").open')" 'true'
agent-browser click '#experienceDeck [data-exp-guide-menu] > summary' >/dev/null
qa_frames
qa_js '__me.S.seamPose=JSON.stringify(__me.nav.plainPose())' >/dev/null
agent-browser click '#experienceDeck [data-act="exp-seam"]' >/dev/null
qa_frames
qa_ok 'opening an edge keeps pose and projection, and reads as an edge' "$(qa_js '(__me.S.seamPose === JSON.stringify(__me.nav.plainPose()) && __me.S.experienceContext.depth === "seam" && __me.S.experienceContext.seam !== null)')" 'true'
# §5.5: per-origin work is the Path posture's own *From* list, so one gap origin is connected there and
# the last one is left to Travel; the edge Card keeps only the aggregate coverage reading. The posture is
# the Camera home, so it opens on an edge Camera has no route for at all — that is where the first origin
# is connected. One origin needs no route: the one that *is* the destination entry's View.
agent-browser click '#card [data-act="exp-route"]' >/dev/null
qa_frames
qa_ok 'the Path posture opens on an edge with no route and reads the same-View origin without one' "$(qa_js '(()=>{const rows=[...document.querySelectorAll("#index [data-path-from] .origin-row")];return !!(__me.S.experienceContext.depth==="route"&&__me.S.task.params.connection===null&&rows.length===3&&rows.filter(r=>r.querySelector("[data-act=exp-connect]")).length===2&&rows.filter(r=>r.textContent.includes("same View")).length===1)})()')" 'true'
card_click '#index [data-path-from] [data-act="exp-connect"]'
qa_js 'window.__connsAfterConnect=Object.keys(__me.ctx.cameraSource.connections).length' >/dev/null
card_click '#index [data-act="exp-route-return"]'
# UX4: the coverage reading lives on the edge Card, not the Deck.
qa_ok 'two origins have reach; third remains a gap' "$(qa_js 'document.querySelector("#card [data-edge-coverage]").textContent.includes("Reachable from 2 of 3")')" 'true'
agent-browser click '#card [data-act="exp-cut"]' >/dev/null
qa_frames
qa_ok 'Cut creates no edge' "$(qa_js 'Object.keys(__me.ctx.cameraSource.connections).length')" "$(qa_js 'window.__connsAfterConnect')"
qa_js 'window.__connsAfterCut=Object.keys(__me.ctx.cameraSource.connections).length' >/dev/null
# N1: choosing Travel is ONE authored transaction that completes the Seam's Camera support — it keeps
# the routes authored per origin above, prepares only the origin still missing one, and selects Travel.
# No per-origin graph surgery is left to the author, and no duplicate edge is written.
agent-browser click '#card [data-act="exp-travel"]' >/dev/null
qa_frames
qa_ok 'explicit Travel completes the Seam support in one authored step' "$(qa_js '(Object.keys(__me.ctx.cameraSource.connections).length === window.__connsAfterCut + 1 && document.querySelector("#card [data-edge-coverage]").textContent.includes("Reachable from 3 of 3") && document.querySelector("#card").textContent.includes("All origins supported"))')" 'true'
qa_ok 'Travel reports prepared versus reused support with the Camera owner' "$(qa_js '(/Prepared 1 Camera route/.test(__me.S.status.text) && /Camera owns route geometry/.test(__me.S.status.text))')" 'true'
# §5.5: entering the Path posture moves no Camera and requests no Plan reading — bringing the route into
# view is the posture's own explicit request, and the crumb is what hands the standpoint back.
agent-browser click '#card [data-act="exp-route"]' >/dev/null
qa_frames
qa_ok 'entering the Path posture keeps the standpoint and names the edge crumb' "$(qa_js '(__me.S.experienceContext.depth === "route" && __me.S.seamPose === JSON.stringify(__me.nav.plainPose()) && !!document.querySelector("#index [data-act=exp-route-return]"))')" 'true'
card_click '#card [data-act="exp-bring"]'
qa_ok 'Bring route into view is the posture own framing request, and requests Plan' "$(qa_js '(__me.ctx.stage.cam.el > 1.5 && !!document.querySelector("#index [data-exp-posture-switch]"))')" 'true'
card_click '#index [data-act="exp-route-return"]'
qa_ok 'route crumb restores previous standpoint' "$(qa_js '(__me.S.seamPose === JSON.stringify(__me.nav.plainPose()))')" 'true'
agent-browser click '[data-act="exp-close"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-guide"]' >/dev/null
qa_frames
# §5.4: the Stop Card is reached by selecting the chip, which is also what makes the Stop the canonical
# selection — there is no Expand, so the recipe holds the Stop's identity where it really lives.
agent-browser click '#experienceDeck .gd-stop-card [data-act="exp-stop"]' >/dev/null
qa_frames
qa_js 'window.__stop2=__me.S.sel' >/dev/null
qa_js '__me.S.preciseBefore={pose:JSON.stringify(__me.nav.plainPose()),undo:__me.S.undo.length}' >/dev/null
# The occurrence band is fixed over the viewport bottom; scroll Card content clear of it before any
# real pointer click, exactly as the other product recipes do.
# UX4: the Stop Card no longer carries the retired L2 Set. A View use is reached from the shared
# Presentation the Stop names, then selected in that Presentation's own Views list.
agent-browser click '#card [data-act="exp-open"]' >/dev/null
qa_frames
agent-browser scrollintoview '#card [data-exp-views] [data-exp-view-use]' >/dev/null
agent-browser click '#card [data-exp-views] [data-exp-view-use]' >/dev/null
qa_frames
agent-browser scrollintoview '#card [data-act="exp-precise"]' >/dev/null
agent-browser click '#card [data-act="exp-precise"]' >/dev/null
qa_frames
qa_ok 'precision opens neutrally with one tape and reports the actual Camera reading' "$(qa_js '(__me.S.preciseBefore.pose === JSON.stringify(__me.nav.plainPose()) && document.querySelectorAll("[data-exp-precision]").length === 1 && __me.S.task.params.posture === __me.nav.readingFor(__me.nav.resolvedCamera().views[__me.S.task.target.id]))')" 'true'
agent-browser fill '[data-exp-precision="frameH"]' '6' >/dev/null
agent-browser press Enter >/dev/null
qa_frames
qa_ok 'Ask Rule names affected Stops before source edit' "$(qa_js '(!!__me.S.expAsk && __me.S.expAsk.reach.stops.length === 2 && __me.S.preciseBefore.undo === __me.S.undo.length)')" 'true'
agent-browser click '[data-act="exp-scope-local"]' >/dev/null
qa_frames
# §5.4: the Ask's local scope is a local Camera framing: it retargets this use to its own View in exactly
# one Undo step, and the use keeps its own identity (no second use is invented for it).
qa_ok 'the Ask local scope writes one Undo step and keeps the use own identity' "$(qa_js '(__me.S.undo.length === __me.S.preciseBefore.undo + 1 && __me.S.undo.at(-1).label === "Detach and retarget local Camera framing" && !!__me.ctx.experience.uses[__me.S.task.params.useId])')" 'true'
agent-browser click '[data-act="exp-posture"][data-posture="through"]' >/dev/null
qa_frames
qa_ok 'Through visibly remains authoring' "$(qa_js '(__me.S.task.params.posture === "through" && !__me.S.visitor && !document.body.classList.contains("visitor-preview") && document.querySelector("#experienceInstrument").textContent.includes("Authoring"))')" 'true'
agent-browser click '#undoBtn' >/dev/null
qa_frames
qa_ok 'Undo restores the shared framing this Stop Entry inherits' "$(qa_js '(__me.ctx.experience.stops[window.__stop2].entry.kind === "presentation" && __me.S.undo.length === __me.S.preciseBefore.undo)')" 'true'
# §5.4: a Stop's own Entry is written in its own Card, and choosing a View use there is what gives this
# Stop its own entry — one Undo step, and Undo reunites the Presentation Default it inherited.
agent-browser click '#experienceDeck .gd-stop-card [data-act="exp-stop"]' >/dev/null
qa_frames
qa_js 'window.__stop3=__me.S.sel' >/dev/null
qa_js 'window.__undoEntry=__me.S.undo.length' >/dev/null
qa_js 'window.__poseEntry=JSON.stringify(__me.nav.plainPose())' >/dev/null
entry_use="$(qa_jsv '[...document.querySelectorAll("#card [data-exp-entry] option")].map(o=>o.value).filter(v=>v.startsWith("use-"))[0]||""')"
agent-browser select '#card [data-exp-entry]' "$entry_use" >/dev/null
qa_frames
qa_ok 'the Stop Card gives this Stop its own Entry View in one Undo step' "$(qa_jsv 'JSON.stringify([__me.ctx.experience.stops[window.__stop3].entry.kind, __me.S.undo.length === window.__undoEntry + 1, __me.S.undo.at(-1).label])')" '["use",true,"Set explicit Stop entry"]'
agent-browser click '#undoBtn' >/dev/null
qa_frames
qa_ok 'Undo reunites the Presentation Default this Stop inherited, without moving Camera' "$(qa_jsv 'JSON.stringify([__me.ctx.experience.stops[window.__stop3].entry.kind, __me.S.undo.length === window.__undoEntry, window.__poseEntry === JSON.stringify(__me.nav.plainPose())])')" '["presentation",true,true]'
agent-browser click '[data-act="exp-close"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-guide"]' >/dev/null
qa_frames
agent-browser click '#experienceDeck [data-act="exp-seam"]' >/dev/null
qa_frames
agent-browser click '#card [data-act="exp-route"]' >/dev/null
qa_frames
# UX5: a plain Stage press is never a new point. The author arms `+ Path point`, and that is the only
# creation path; an unarmed press leaves the route exactly as it was. The press is still the shell's own
# click, so a pick under it is an outside selection and puts the reading away (§3.1) — the route is read by
# its own id, and the posture is re-entered through the edge chip's door.
qa_js 'window.__path=__me.S.task.params.connection' >/dev/null
qa_js 'window.__undoBefore=__me.S.undo.length' >/dev/null
p="$(qa_at '#gl' 360 180)"; qa_move "${p%,*}" "${p#*,}"; qa_down; qa_up; qa_frames
qa_ok 'a plain Stage press adds no Camera path point' "$(qa_jsv 'JSON.stringify([__me.ctx.cameraSource.connections[window.__path].anchors.length, __me.S.undo.length===window.__undoBefore])')" '[0,true]'
# §5.5: `+ Path point` is the one creation path and it lives on the Stage instrument, beside the drawing.
agent-browser click '[data-act="exp-guide"]' >/dev/null
qa_frames
agent-browser click '#experienceDeck [data-act="exp-seam"]' >/dev/null
qa_frames
agent-browser click '#card [data-act="exp-route"]' >/dev/null
qa_frames
card_click '#pathInstrument [data-act="exp-path-point"]'
qa_ok 'arming the Path point writes nothing and names the click it waits for' "$(qa_jsv 'JSON.stringify([!!__me.S.experienceContext.armed, __me.S.experienceContext.point===null, __me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors.length, (document.querySelector("#pathInstrument .exp-armed")||{}).textContent.indexOf("Esc cancels")>=0])')" '[true,true,0,true]'
p="$(qa_at '#gl' 360 180)"; qa_move "${p%,*}" "${p#*,}"; qa_down; qa_up; qa_frames
qa_ok 'Stage authors one interior anchor' "$(qa_js '__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors.length')" '1'
qa_ok 'placing the point disarms the insertion' "$(qa_js '__me.S.experienceContext.armed')" 'false'
# §5.5: the point is an identity of its own. Selecting it — the Deck lane mirrors the Stage — makes the
# Card that point's own inspector: its evaluated Camera preview and its operations, with no coordinates,
# no percentage and nowhere the stored Anchor name is shown.
agent-browser click '#experienceDeck [data-act="exp-point-select"]' >/dev/null
qa_frames
qa_ok 'selecting a path point reads its own inspector, mirroring the Deck, without writing' "$(qa_jsv 'JSON.stringify([__me.S.experienceContext.point?.anchorId===__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors[0].id, document.querySelector("#card .c-k").textContent.includes("Path point"), document.querySelector("#card [data-point-read]").textContent.includes("Drag the point on the Stage"), !!document.querySelector("#card [data-exp-point-preview]"), !!document.querySelector("#card [data-act=exp-look-point]"), !!document.querySelector("#card [data-act=exp-point-remove]"), !!document.querySelector("#experienceDeck [data-act=exp-point-select].selected"), !document.querySelector("#card [data-path-points]"), !document.querySelector("#card").textContent.includes("Anchor ")])')" '[true,true,true,true,true,true,true,true,true]'
# One assignment per eval: the harness evaluates a single expression, so two statements in one call
# would never run.
qa_js 'window.__poseBefore=JSON.stringify(__me.nav.plainPose())' >/dev/null
qa_js 'window.__undoBefore=__me.S.undo.length' >/dev/null
card_click "[data-act='exp-look-point']"
qa_ok 'Look through a path point moves the standpoint and writes no history' "$(qa_js '(JSON.stringify(__me.nav.plainPose())!==window.__poseBefore&&__me.S.undo.length===window.__undoBefore)')" 'true'
card_click "[data-act='exp-point-remove']"
qa_ok 'removing the selected point is one ordinary Camera edit' "$(qa_jsv 'JSON.stringify([__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors.length, __me.S.experienceContext.point===null, __me.S.undo.at(-1).label])')" '[0,true,"Remove Camera path point"]'
agent-browser click '#undoBtn' >/dev/null
qa_frames
qa_ok 'Undo restores the removed path point' "$(qa_js '__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors.length')" '1'
card_click '#index [data-act="exp-route-return"]'
qa_frames
# §5.8: the Journey is entered from the Index's own Path | Journey switch; the edge Card's door is the
# Camera Path, which is where that switch lives.
card_click '#card [data-act="exp-route"]'
card_click '#index [data-exp-posture-switch] [data-act="exp-coordinate"]'
qa_ok 'entering the Journey names the edge and offers only free stations to add a Cue' "$(qa_js '(()=>{const foot=document.querySelector("#experienceDeck .deck-block .deck-foot .deck-s"),sel=document.querySelector("#card [data-exp-station]");return !!(foot&&foot.textContent.includes("Guide · Stop")&&sel&&sel.options.length>0&&__me.S.experienceContext.depth==="coordination")})()')" 'true'
qa_ok 'station options contain no generated samples' "$(qa_js '(()=>{const o=[...document.querySelectorAll("#card [data-exp-station] option")];return o.length>0&&o.every(x=>!x.value.startsWith("sample"))})()')" 'true'
station="$(qa_jsv '__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors[0].id')"
agent-browser select '#card [data-exp-station]' "$station" >/dev/null
qa_frames
card_click '#card [data-act="exp-beat"].primary'
qa_frames
qa_js 'window.__beatsBefore=JSON.stringify(Object.values(__me.ctx.experience.seams)[0].beats)' >/dev/null
qa_js 'window.__cueAtBefore=document.querySelector("#card [data-cue-at]").textContent' >/dev/null
qa_js "window.__cueStation='$station'" >/dev/null
qa_js 'window.__cuePose=JSON.stringify(__me.nav.plainPose())' >/dev/null
# §5.8: Pace is Camera's and lives only on the Camera Path Card, so the reading is changed there and read
# back here; the switch that leaves and re-enters the Journey moves neither the selection nor the Camera.
card_click '#index [data-exp-posture-switch] [data-act="exp-route"]'
agent-browser select '#card [data-exp-pace]' 'slow' >/dev/null
qa_frames
card_click '#index [data-exp-posture-switch] [data-act="exp-coordinate"]'
qa_frames
qa_ok 'the Path | Journey switch keeps the Cue selection and the standpoint' "$(qa_js '(window.__cueStation===__me.S.task.params.station && window.__cuePose===JSON.stringify(__me.nav.plainPose()))')" 'true'
qa_ok 'pace derives timing and keeps stable beat reference' "$(qa_js '(window.__beatsBefore === JSON.stringify(Object.values(__me.ctx.experience.seams)[0].beats) && window.__cueAtBefore !== document.querySelector("#card [data-cue-at]").textContent)')" 'true'

# ---- UX6: the Journey posture — the time Deck, the Cue Card, the atomic move and Rehearse
# §5.6/§5.8: the posture was entered above through the Index's own Path | Journey switch, and the time Deck
# reads the edge as time through the same mapping the visit runs on. Nothing here re-enters the Journey.
qa_ok 'the time Deck runs 0:00 to the derived total and names its edge and origin' "$(qa_js '(()=>{const r=__me.E.rehearsalReading(),ends=[...document.querySelectorAll(".jd-ends .jd-end")].map(e=>e.textContent.trim()),foot=document.querySelector("#experienceDeck .deck-block .deck-foot .deck-s"),from=document.querySelector("#index [data-path-from] .ix-row[aria-current=true] [data-path-origin]");return !!(document.querySelector("[data-journey-deck]")&&ends.length===2&&ends[0]==="0:00.0"&&Math.abs(r.clock.duration-(r.clock.travelDuration+r.clock.pause))<1e-9&&!!document.querySelector("[data-exp-journey-total]")&&!!from&&!!foot&&foot.textContent.includes("Guide · Stop"))})()')" 'true'
qa_ok 'every authored Cue is a marker on the Deck at its own time, and no Card repeats the list' "$(qa_js '(()=>{const r=__me.E.rehearsalReading(),marks=[...document.querySelectorAll(".jd-cue")];return !!(marks.length===r.clock.cues.length&&marks.every((m,i)=>m.dataset.id===r.clock.cues[i].stationId&&m.dataset.cueAt!=="")&&!document.querySelector("#card [data-exp-cue-list]")&&!document.querySelector("#card .jd-cue-row")&&!document.querySelector("#card .station-projection"))})()')" 'true'
qa_ok 'the Cue Card reads occurrence, time, pause and actions, with no Pace and no C9 strip' "$(qa_js '(()=>{const k=document.querySelector("#card .c-k"),t=document.querySelector("#card .c-t");return !!(k&&k.textContent.includes("Cue")&&t&&!t.textContent.includes("Anchor ")&&!!document.querySelector("#card [data-cue-at]")&&!!document.querySelector("#card [data-cue-pause]")&&!!document.querySelector("#card [data-cue-actions]")&&!!document.querySelector("#card [data-exp-cue-edit]")&&!document.querySelector("#card [data-exp-pace]")&&!document.querySelector("#card [data-coordination-detail]"))})()')" 'true'
# QA 2: the authored point is a station a Cue sits on, never a path handle, in this posture.
qa_ok 'path handles are not hit-eligible in the Journey, and a Cue is a named ◆ chip' "$(qa_js '(!document.querySelector("[data-exp-anchor]")&&!!document.querySelector("[data-exp-station-label]")&&document.querySelector("[data-exp-station-label]").textContent.includes("◆"))')" 'true'
# §5.8: the Deck marker and the Stage chip are the same Cue, selected together.
qa_ok 'the selected Cue is mirrored on the Deck and the Stage' "$(qa_js '(()=>{const m=document.querySelector(".jd-cue.selected"),s=document.querySelector(".exp-station.active");return !!(m&&s&&m.dataset.id===__me.S.task.params.station&&s.dataset.id===__me.S.task.params.station)})()')" 'true'
# The Stage chip is a real hit target for that same Cue, so the recipe can address it there.
cue_at="$(qa_at "[data-act='exp-cue-select'][data-id='$station']")"
if [ -n "$cue_at" ] && [ "$cue_at" != none ]; then qa_move "${cue_at%,*}" "${cue_at#*,}"; qa_down; qa_up; qa_frames; fi
# The atomic move: every beat of the Cue and each invoked Activity's binding move together, once.
station="$(qa_jsv '__me.S.task.params.station')"
# §5.6: the Cue Card's editing writers are behind its own `Edit cue` disclosure.
qa_card_door '#card [data-exp-cue-edit]'
destination="$(qa_jsv '[...document.querySelectorAll("#card [data-exp-cue-move] option")].map(o=>o.value).filter(Boolean)[0]||""')"
qa_js 'window.__undoBefore=__me.S.undo.length' >/dev/null
qa_js 'window.__sourceBefore=JSON.stringify(__me.A.domainSnapshot())' >/dev/null
agent-browser select '#card [data-exp-cue-move]' "$destination" >/dev/null
qa_frames
qa_js "window.__moved=(()=>{const s=__me.ctx.experience.seams[Object.keys(__me.ctx.experience.seams)[0]],moved=s.beats.filter(b=>b.stationId==='$destination');return !!(moved.length>=1&&__me.S.task.params.station==='$destination'&&__me.S.undo.length===window.__undoBefore+1&&moved.every(b=>b.kind!=='invoke'||__me.ctx.experience.uses[b.useId].start.stationId==='$destination')&&s.beats.filter(b=>b.stationId==='$station').length===0)})()" >/dev/null
qa_ok 'moving a Cue rebinds every one of its beats and its Activity binding in one Undo step' "$(qa_jsv 'window.__moved')" 'true'
agent-browser click '#undoBtn' >/dev/null
qa_frames
qa_ok 'Undo restores the Cue and its Activity binding together' "$(qa_jsv 'JSON.stringify([__me.S.undo.length===window.__undoBefore, JSON.stringify(__me.A.domainSnapshot())===window.__sourceBefore])')" '[true,true]'
# Undo restores the document, never the reading (§3.1), so the Cue is selected again — on the Deck, where
# it now is — before the offered destinations and the refusal are read.
card_click "#experienceDeck .jd-cue[data-id='$station']"
qa_js "window.__offered=[...document.querySelectorAll('#card [data-exp-cue-move] option')].map(x=>x.value).filter(Boolean)" >/dev/null
# Only stations this Cue can take are offered: its own is not one of them, and neither is a station
# another Cue already holds.
qa_ok 'only stations this Cue can take are offered' "$(qa_jsv "JSON.stringify([window.__offered.length>0, window.__offered.includes('$station'), __me.S.task.params.station==='$station'])" )" '[true,false,true]'
qa_js 'window.__hashBefore=JSON.stringify(__me.A.domainSnapshot())' >/dev/null
qa_js 'window.__countBefore=__me.S.undo.length' >/dev/null
qa_js "__me.E.moveCueCommand('$station')" >/dev/null
qa_ok 'a refused move reports the reason and mutates nothing' "$(qa_js '(/already the Cue/.test(__me.S.status.text)&&__me.S.undo.length===window.__countBefore&&JSON.stringify(__me.A.domainSnapshot())===window.__hashBefore)')" 'true'
# Rehearse is a playhead: it moves a rig on Stage and writes nothing.
qa_js 'window.__poseBefore=JSON.stringify(__me.nav.plainPose())' >/dev/null
qa_js 'window.__srcBefore=JSON.stringify(__me.A.domainSnapshot())' >/dev/null
qa_js 'window.__undoCount=__me.S.undo.length' >/dev/null
# §5.6: Rehearse is the Journey name block's own ops row, so its controls are the Deck's, not the Card's.
agent-browser click '#experienceDeck [data-act="exp-rehearse-play"]' >/dev/null
qa_frames; qa_frames; qa_frames
qa_ok 'Rehearse advances a playhead without writing source, history or the author standpoint' "$(qa_js '(()=>{const r=__me.S.rehearse;return !!(r&&r.t>0&&r.playing===true&&!!document.querySelector("[data-exp-playhead]")&&!!document.querySelector("[data-exp-rehearse-time]")&&JSON.stringify(__me.nav.plainPose())===window.__poseBefore&&__me.S.undo.length===window.__undoCount&&JSON.stringify(__me.A.domainSnapshot())===window.__srcBefore)})()')" 'true'
agent-browser click '#experienceDeck [data-act="exp-rehearse-pause"]' >/dev/null
qa_frames
qa_ok 'Pause stops the playhead where it stands, and offers the rest of the ops row' "$(qa_js '(__me.S.rehearse&&__me.S.rehearse.playing===false&&!!document.querySelector("#experienceDeck [data-act=exp-rehearse-look]")&&!!document.querySelector("#experienceDeck [data-act=exp-rehearse-play]"))')" 'true'
# §5.6: `Look through` frames the playhead's own pose — Camera's operation, so the standpoint moves and no
# source is written. It is what puts the playhead in front of the author, and the Stage rig is drawn then:
# a reading on the drawing, never a move.
agent-browser click '#experienceDeck [data-act="exp-rehearse-look"]' >/dev/null
qa_frames
qa_ok 'Look through at the playhead moves the standpoint and writes no source' "$(qa_js '(JSON.stringify(__me.nav.plainPose())!==window.__poseBefore&&JSON.stringify(__me.A.domainSnapshot())===window.__srcBefore)')" 'true'
# The Deck's own scrub is a range input, which the harness's `fill` cannot drive; the recipe dispatches the
# input event the control really emits, exactly as qa_press dispatches the keydowns a native press drops.
qa_js "(()=>{const el=document.querySelector('[data-exp-rehearse]');el.value='0.5';el.dispatchEvent(new Event('input',{bubbles:true}));return el.value;})()" >/dev/null
qa_frames
qa_ok 'scrubbing the Deck moves the playhead and its rig, writing nothing' "$(qa_js '(()=>{const r=__me.S.rehearse,rig=document.querySelector("[data-exp-rig]");return !!(r&&Math.abs(r.t-0.5)<0.01&&rig&&rig.dataset.expRigPlaying==="false"&&!!document.querySelector("[data-exp-playhead]")&&__me.S.undo.length===window.__undoCount&&JSON.stringify(__me.A.domainSnapshot())===window.__srcBefore)})()')" 'true'
agent-browser click '#experienceDeck [data-act="exp-rehearse-stop"]' >/dev/null
qa_frames
qa_ok 'Stop drops the rehearsal and its rig, and leaves the edge as it was' "$(qa_js '(__me.S.rehearse===null&&!document.querySelector("[data-exp-rig]")&&JSON.stringify(__me.A.domainSnapshot())===window.__srcBefore)')" 'true'

qa_browser_errors_ok 'Experience browser'
qa_summary 'Unified Experience'
