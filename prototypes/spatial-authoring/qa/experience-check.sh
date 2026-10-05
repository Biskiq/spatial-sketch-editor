#!/usr/bin/env bash
# Unified Experience wiring; owns one browser/server through lib.sh.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"
qa_open
qa_faults_clear
agent-browser click '[data-act="lens"][data-lens="experience"]' >/dev/null
qa_frames
qa_ok 'ordinary Experience has no Deck or reading' "$(qa_js '(!__me.S.session && !document.querySelector("#experienceDeck"))')" 'true'
agent-browser click '[data-act="exp-open"][data-id="pres-highlights"]' >/dev/null
qa_frames
qa_ok 'explicit Presentation uses canonical identity' "$(qa_js '__me.S.sel')" '"pres-highlights"'
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
agent-browser click '#headPreview' >/dev/null
qa_frames
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
qa_ok 'expanded occurrence exposes same unordered Set' "$(qa_js '(document.querySelectorAll(".stop-card.expanded .set-node").length === 3 && __me.ctx.experience.presentations["pres-highlights"].uses.length === 3)')" 'true'
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
qa_ok 'two origins have reach; third remains a gap' "$(qa_js 'document.querySelector("#experienceDeck").textContent.includes("Reachable from 2 of 3")')" 'true'
agent-browser click '[data-act="exp-cut"]' >/dev/null
qa_frames
qa_ok 'Cut creates no edge' "$(qa_js 'Object.keys(__me.ctx.cameraSource.connections).length')" '2'
# N1: choosing Travel is ONE authored transaction that completes the Seam's Camera support — it keeps
# the routes authored per origin above, prepares only the origin still missing one, and selects Travel.
# No per-origin graph surgery is left to the author, and no duplicate edge is written.
agent-browser click '[data-act="exp-travel"]' >/dev/null
qa_frames
qa_ok 'explicit Travel completes the Seam support in one authored step' "$(qa_js '(Object.keys(__me.ctx.cameraSource.connections).length === 3 && document.querySelector("#experienceDeck").textContent.includes("Reachable from 3 of 3") && document.querySelector("#experienceDeck").textContent.includes("All origins supported"))')" 'true'
qa_ok 'Travel reports prepared versus reused support with the Camera owner' "$(qa_js '(/Prepared 1 Camera route/.test(__me.S.status.text) && /Camera owns route geometry/.test(__me.S.status.text))')" 'true'
agent-browser click '[data-act="exp-route"]' >/dev/null
qa_frames
qa_ok 'explicit route work requests Plan and return crumb' "$(qa_js '(__me.S.experienceContext.depth === "route" && !!document.querySelector("[data-act=exp-route-return]") && __me.ctx.stage.cam.el > 1.5)')" 'true'
agent-browser click '[data-act="exp-route-return"]' >/dev/null
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
agent-browser scrollintoview '#card .exp-view [data-act="pres-ref"]' >/dev/null
agent-browser click '#card .exp-view [data-act="pres-ref"]' >/dev/null
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
p="$(qa_at '#gl' 360 180)"; qa_move "${p%,*}" "${p#*,}"; qa_down; qa_up; qa_frames
qa_ok 'Stage authors one interior anchor' "$(qa_js '__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors.length')" '1'
agent-browser click '[data-act="exp-route-return"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-coordinate"]' >/dev/null
qa_frames
station="$(qa_jsv '__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors[0].id')"
agent-browser select '[data-exp-station]' "$station" >/dev/null
qa_frames
agent-browser click '[data-act="exp-beat"]' >/dev/null
qa_frames
qa_js '__me.S.beatBefore={ref:JSON.stringify(Object.values(__me.ctx.experience.seams)[0].beats),time:document.querySelector(".coord-hold").textContent}' >/dev/null
agent-browser select '[data-exp-pace]' 'slow' >/dev/null
qa_frames
qa_ok 'pace derives timing and keeps stable beat reference' "$(qa_js '(__me.S.beatBefore.ref === JSON.stringify(Object.values(__me.ctx.experience.seams)[0].beats) && __me.S.beatBefore.time !== document.querySelector(".coord-hold").textContent)')" 'true'
qa_ok 'station options contain no generated samples' "$(qa_js '([...document.querySelectorAll("[data-exp-station] option")].every(o=>!o.value.startsWith("sample")))')" 'true'
qa_faults_ok 'Experience commands'
qa_browser_errors_ok 'Experience browser'
qa_summary 'Unified Experience'
