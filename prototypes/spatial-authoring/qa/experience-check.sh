#!/usr/bin/env bash
# Unified Experience wiring; owns one browser/server through lib.sh.
set -u
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
agent-browser press Tab >/dev/null
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
qa_ok 'three Views coexist without Guide or edges' "$(qa_js '(__me.ctx.experience.presentations["pres-highlights"].uses.length === 3 && __me.ctx.experience.guide.length === 0 && Object.keys(__me.ctx.cameraSource.connections).length === 0)')" 'true'
qa_js '__me.S.previewBefore = { source:JSON.stringify(__me.A.domainSnapshot()),pose:JSON.stringify(__me.nav.plainPose()),sel:__me.S.sel,lens:__me.S.lens }' >/dev/null
agent-browser click '[data-act="exp-preview"]' >/dev/null
qa_frames
qa_ok 'Preview without Guide takes over authoring' "$(qa_js '(!!__me.S.visitor && document.body.classList.contains("visitor-preview") && __me.S.visitor.runtime.stopId === null)')" 'true'
agent-browser click '[data-act="exp-exit-preview"]' >/dev/null
qa_frames
qa_ok 'Preview restores lens selection pose and frozen source' "$(qa_js '(__me.S.previewBefore.source === JSON.stringify(__me.A.domainSnapshot()) && __me.S.previewBefore.pose === JSON.stringify(__me.nav.plainPose()) && __me.S.previewBefore.sel === __me.S.sel && __me.S.previewBefore.lens === __me.S.lens)')" 'true'
qa_faults_ok 'Experience commands'
qa_browser_errors_ok 'Experience browser'
qa_summary 'Unified Experience'
