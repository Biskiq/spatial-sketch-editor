#!/usr/bin/env bash
# Unified Experience wiring; owns one browser/server through lib.sh.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"
qa_open
qa_faults_clear
# A control inside the scrollable Card can be on screen yet under the fixed Guide band at non-ordinary
# Experience depth (UX4/UX5), so a real click would land on the band. Center it in the Card's own scroll
# container first, the same way the shell's pointer path does, and only then click it.
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
qa_ok 'Overview has occurrence cards and keeps Camera' "$(qa_js '(document.querySelectorAll(".stop-card").length === 2 && __me.S.guidePose === JSON.stringify(__me.nav.plainPose()))')" 'true'
agent-browser click '.stop-card [data-act="exp-expand-stop"]' >/dev/null
qa_frames
# UX4: the L2 Set strip is retired; the expanded Stop is the Deck's own chip and its Card is the Stop
# Card. The shared Presentation still carries the same three Views.
qa_ok 'expanded Stop is the Deck chip and reads its Stop Card, with the shared Views intact' "$(qa_js '(document.querySelectorAll(".stop-card.expanded").length === 1 && __me.ctx.experience.presentations["pres-highlights"].uses.length === 3 && !!document.querySelector("#card [data-stop-entry]"))')" 'true'
agent-browser click '.stop-card.expanded [data-act="exp-move-stop"][data-delta="1"]' >/dev/null
qa_frames
qa_ok 'reorder changes order only' "$(qa_js '(__me.ctx.experience.guide[1] === __me.S.sel && Object.keys(__me.ctx.cameraSource.connections).length === 0)')" 'true'
qa_js '__me.S.seamPose=JSON.stringify(__me.nav.plainPose())' >/dev/null
agent-browser click '[data-act="exp-seam"]' >/dev/null
qa_frames
qa_ok 'opening Seam keeps pose and projection' "$(qa_js '(__me.S.seamPose === JSON.stringify(__me.nav.plainPose()) && __me.S.experienceContext.depth === "seam")')" 'true'
agent-browser click '[data-act="exp-connect"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-connect"]' >/dev/null
qa_frames
# UX4: the coverage reading lives on the edge Card, not the Deck.
qa_ok 'two origins have reach; third remains a gap' "$(qa_js 'document.querySelector("#card [data-edge-coverage]").textContent.includes("Reachable from 2 of 3")')" 'true'
agent-browser click '[data-act="exp-cut"]' >/dev/null
qa_frames
qa_ok 'Cut creates no edge' "$(qa_js 'Object.keys(__me.ctx.cameraSource.connections).length')" '2'
# N1: choosing Travel is ONE authored transaction that completes the Seam's Camera support — it keeps
# the routes authored per origin above, prepares only the origin still missing one, and selects Travel.
# No per-origin graph surgery is left to the author, and no duplicate edge is written.
agent-browser click '[data-act="exp-travel"]' >/dev/null
qa_frames
qa_ok 'explicit Travel completes the Seam support in one authored step' "$(qa_js '(Object.keys(__me.ctx.cameraSource.connections).length === 3 && document.querySelector("#card [data-edge-coverage]").textContent.includes("Reachable from 3 of 3") && document.querySelector("#card").textContent.includes("All origins supported"))')" 'true'
qa_ok 'Travel reports prepared versus reused support with the Camera owner' "$(qa_js '(/Prepared 1 Camera route/.test(__me.S.status.text) && /Camera owns route geometry/.test(__me.S.status.text))')" 'true'
agent-browser click '[data-act="exp-route"]' >/dev/null
qa_frames
qa_ok 'explicit route work requests Plan and return crumb' "$(qa_js '(__me.S.experienceContext.depth === "route" && !!document.querySelector("[data-act=exp-route-return]") && __me.ctx.stage.cam.el > 1.5)')" 'true'
card_click '[data-act="exp-route-return"]'
qa_frames
qa_ok 'route crumb restores previous standpoint' "$(qa_js '(__me.S.seamPose === JSON.stringify(__me.nav.plainPose()))')" 'true'
agent-browser click '[data-act="exp-close"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-guide"]' >/dev/null
qa_frames
agent-browser click '.stop-card [data-act="exp-expand-stop"]' >/dev/null
qa_frames
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
qa_ok 'explicit Stop-entry detachment is one Undo step' "$(qa_js '(__me.S.undo.length === __me.S.preciseBefore.undo + 1 && __me.ctx.experience.stops[__me.S.experienceContext.stop].entry.kind === "use")')" 'true'
agent-browser click '[data-act="exp-posture"][data-posture="through"]' >/dev/null
qa_frames
qa_ok 'Through visibly remains authoring' "$(qa_js '(__me.S.task.params.posture === "through" && !__me.S.visitor && !document.body.classList.contains("visitor-preview") && document.querySelector("#experienceInstrument").textContent.includes("Authoring"))')" 'true'
agent-browser click '#undoBtn' >/dev/null
qa_frames
qa_ok 'Undo reunites original Stop entry without restoring Camera' "$(qa_js '(__me.ctx.experience.stops[__me.S.experienceContext.stop].entry.kind === "presentation")')" 'true'
agent-browser click '[data-act="exp-close"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-guide"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-seam"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-route"]' >/dev/null
qa_frames
# UX5: a plain Stage press is never a new point. The author arms `+ Path point`, and that is the only
# creation path; an unarmed press leaves the route exactly as it was.
p="$(qa_at '#gl' 360 180)"; qa_move "${p%,*}" "${p#*,}"; qa_down; qa_up; qa_frames
qa_ok 'a plain Stage press adds no Camera path point' "$(qa_js '__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors.length')" '0'
card_click '[data-act="exp-path-point"]'
qa_ok 'arming the Path point writes nothing and names the click it waits for' "$(qa_jsv 'JSON.stringify([!!__me.S.experienceContext.armed, __me.S.experienceContext.point===null, __me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors.length])')" '[true,true,0]'
p="$(qa_at '#gl' 360 180)"; qa_move "${p%,*}" "${p#*,}"; qa_down; qa_up; qa_frames
qa_ok 'Stage authors one interior anchor' "$(qa_js '__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors.length')" '1'
qa_ok 'placing the point disarms the insertion' "$(qa_js '__me.S.experienceContext.armed')" 'false'
# UX5: the point is an identity of its own — selecting it reads its position on the route, its evaluated
# Camera preview and its operations, and Look through adopts that pose through Camera's own seam.
card_click "[data-act='exp-point-select']"
qa_ok 'selecting a path point reads its identity, position and preview without writing' "$(qa_jsv 'JSON.stringify([__me.S.experienceContext.point?.anchorId===__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors[0].id, !!document.querySelector("#card [data-path-point]"), document.querySelector("#card [data-point-read]").textContent.includes("% along the route"), !!document.querySelector("#card [data-exp-point-preview]"), !!document.querySelector("#card [data-act=exp-look-point]"), !!document.querySelector("#card [data-act=exp-point-remove]")])')" '[true,true,true,true,true,true]'
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
card_click '[data-act="exp-route-return"]'
qa_frames
card_click '[data-act="exp-coordinate"]'
station="$(qa_jsv '__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors[0].id')"
agent-browser select '[data-exp-station]' "$station" >/dev/null
qa_frames
card_click '[data-act="exp-beat"]'
qa_js '__me.S.beatBefore={ref:JSON.stringify(Object.values(__me.ctx.experience.seams)[0].beats),time:document.querySelector(".coord-hold").textContent}' >/dev/null
agent-browser select '[data-exp-pace]' 'slow' >/dev/null
qa_frames
qa_ok 'pace derives timing and keeps stable beat reference' "$(qa_js '(__me.S.beatBefore.ref === JSON.stringify(Object.values(__me.ctx.experience.seams)[0].beats) && __me.S.beatBefore.time !== document.querySelector(".coord-hold").textContent)')" 'true'
qa_ok 'station options contain no generated samples' "$(qa_js '([...document.querySelectorAll("[data-exp-station] option")].every(o=>!o.value.startsWith("sample")))')" 'true'

# ---- UX6: the Journey posture — the time Deck, the Cue Card, the atomic move and Rehearse
# The time Deck reads the edge as time through the same mapping the visit runs on, in the posture the
# author is already in (coordination), so this block only asserts the reading, never a new entry path.
qa_ok 'the time Deck runs 0:00 to the derived total and names its edge and origin' "$(qa_js '(()=>{const r=__me.E.rehearsalReading(),t=document.querySelector("[data-exp-journey-total]"),o=document.querySelector("[data-exp-journey-origin]"),c=__me.ctx.cameraSource.connections[__me.S.task.params.connection],h=document.querySelector(".journey-deck .jd-head b");return !!(document.querySelector("[data-exp-journey-deck]")&&t&&t.textContent.includes("0:00.0")&&Math.abs(r.clock.duration-(r.clock.travelDuration+r.clock.pause))<1e-9&&o&&o.value===c.from&&h&&h.textContent.includes("Journey · Stop"))})()')" 'true'
qa_ok 'every authored Cue is a marker on the Deck and a row on the Card, placed at its own time' "$(qa_js '(()=>{const r=__me.E.rehearsalReading(),marks=[...document.querySelectorAll(".jd-cue")],rows=[...document.querySelectorAll("#card .jd-cue-row")];return !!(marks.length===r.clock.cues.length&&rows.length===r.clock.cues.length&&marks.every((m,i)=>m.dataset.id===r.clock.cues[i].stationId&&m.textContent.includes(":"))&&document.querySelector("#card [data-exp-cue-list]"))})()')" 'true'
qa_ok 'the Cue Card reads occurrence, time, pause, actions, projection and Pace' "$(qa_js '(()=>{const k=document.querySelector("#card .c-k");return !!(k&&k.textContent.includes("Cue · Journey")&&document.querySelector("#card [data-cue-at]")&&document.querySelector("#card [data-cue-pause]")&&document.querySelector("#card [data-exp-cue-move]")&&document.querySelector("#card .station-projection")&&document.querySelector("#card [data-exp-pace]")&&document.querySelector("#card [data-act=exp-beat]")&&document.querySelector("#card [data-act=exp-invoke-beat]"))})()')" 'true'
# QA 2: the authored point is a station a Cue can sit on, never a path handle, in this posture.
qa_ok 'path handles are not hit-eligible in the Journey' "$(qa_js '(!document.querySelector("[data-exp-anchor]")&&!!document.querySelector("[data-exp-station-point]"))')" 'true'
# The atomic move: every beat of the Cue and each invoked Activity's binding move together, once.
station="$(qa_jsv '__me.S.task.params.station')"
destination="$(qa_jsv '[...document.querySelectorAll("#card [data-exp-cue-move] option")].map(o=>o.value).filter(Boolean)[0]||""')"
qa_js 'window.__undoBefore=__me.S.undo.length' >/dev/null; qa_js 'window.__sourceBefore=JSON.stringify(__me.A.domainSnapshot())' >/dev/null
agent-browser select '[data-exp-cue-move]' "$destination" >/dev/null
qa_frames
qa_ok 'moving a Cue rebinds every one of its beats and its Activity binding in one Undo step' "$(qa_js "(()=>{const s=__me.ctx.experience.seams[Object.keys(__me.ctx.experience.seams)[0]],moved=s.beats.filter(b=>b.stationId==='$destination');return !!(moved.length>=1&&__me.S.task.params.station==='$destination'&&__me.S.undo.length===window.__undoBefore+1&&moved.every(b=>b.kind!=='invoke'||__me.ctx.experience.uses[b.useId].start.stationId==='$destination')&&s.beats.length===JSON.parse(JSON.stringify(s.beats)).length&&__me.ctx.experience.seams[Object.keys(__me.ctx.experience.seams)[0]].beats.filter(b=>b.stationId==='$station').length===0)})()")" 'true'
agent-browser click '#undoBtn' >/dev/null
qa_frames
qa_ok 'Undo restores the Cue and its Activity binding together' "$(qa_js 'JSON.stringify([__me.S.undo.length===window.__undoBefore, JSON.stringify(__me.A.domainSnapshot())===window.__sourceBefore])')" '[true,true]'
# Only stations the Cue can take are offered, and a forced move onto one it already holds refuses.
qa_ok 'only stations this Cue can take are offered' "$(qa_js "(()=>{const o=[...document.querySelectorAll('#card [data-exp-cue-move] option')].map(x=>x.value).filter(Boolean);return !!(o.length>0&&!o.includes('$station'))})()")" 'true'
qa_js "window.__hashBefore=JSON.stringify(__me.A.domainSnapshot());window.__countBefore=__me.S.undo.length" >/dev/null
qa_js "__me.E.moveCueCommand('$station')" >/dev/null
qa_ok 'a refused move reports the reason and mutates nothing' "$(qa_js '(/already the Cue/.test(__me.S.status.text)&&__me.S.undo.length===window.__countBefore&&JSON.stringify(__me.A.domainSnapshot())===window.__hashBefore)')" 'true'
# Rehearse is a playhead: it moves a rig on Stage and writes nothing.
qa_js 'window.__poseBefore=JSON.stringify(__me.nav.plainPose());window.__srcBefore=JSON.stringify(__me.A.domainSnapshot());window.__undoCount=__me.S.undo.length' >/dev/null
card_click '[data-act="exp-rehearse-play"]'
qa_frames; qa_frames; qa_frames
qa_ok 'Rehearse advances a playhead rig without writing source, history or the author standpoint' "$(qa_js '(()=>{const r=__me.S.rehearse;return !!(r&&r.t>0&&document.querySelector("[data-exp-rig]")&&document.querySelector("[data-exp-rig-playing=true]")&&JSON.stringify(__me.nav.plainPose())===window.__poseBefore&&__me.S.undo.length===window.__undoCount&&JSON.stringify(__me.A.domainSnapshot())===window.__srcBefore)})()')" 'true'
card_click '[data-act="exp-rehearse-pause"]'
qa_ok 'Pause stops the playhead where it stands' "$(qa_js '(__me.S.rehearse&&__me.S.rehearse.playing===false)')" 'true'
fill '[data-exp-rehearse]' '0.5'
qa_frames
qa_ok 'scrubbing the Deck moves the playhead and its rig, writing nothing' "$(qa_js '(()=>{const r=__me.S.rehearse;return !!(r&&Math.abs(r.t-0.5)<0.01&&document.querySelector("[data-exp-playhead]")&&__me.S.undo.length===window.__undoCount&&JSON.stringify(__me.A.domainSnapshot())===window.__srcBefore)})()')" 'true'
card_click '[data-act="exp-rehearse-look"]'
qa_ok 'Look through at the playhead moves the standpoint and writes no source' "$(qa_js '(JSON.stringify(__me.nav.plainPose())!==window.__poseBefore&&JSON.stringify(__me.A.domainSnapshot())===window.__srcBefore)')" 'true'
card_click '[data-act="exp-rehearse-stop"]'
qa_ok 'Stop drops the rehearsal and leaves the edge as it was' "$(qa_js '(__me.S.rehearse===null&&!document.querySelector("[data-exp-rig]")&&JSON.stringify(__me.A.domainSnapshot())===window.__srcBefore)')" 'true'
qa_faults_ok 'Experience commands'
qa_browser_errors_ok 'Experience browser'
qa_summary 'Unified Experience'
