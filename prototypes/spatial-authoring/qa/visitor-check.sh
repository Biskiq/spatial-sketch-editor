#!/usr/bin/env bash
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"
qa_open
qa_faults_clear
agent-browser click '[data-act="lens"][data-lens="experience"]' >/dev/null
qa_frames
agent-browser click '.experience-presenter summary' >/dev/null
agent-browser click '[data-act="exp-example"]' >/dev/null
qa_frames
qa_ok 'Load Example is deterministic and never starts playback' "$(qa_js '(!__me.S.visitor && __me.ctx.experience.guide.length===2 && __me.ctx.experience.presentations[__me.S.sel].uses.length===3)')" 'true'
qa_js '__me.S.presenterSource=JSON.stringify(__me.A.domainSnapshot())' >/dev/null
# Disclosure is recreated by the source change.
agent-browser click '.experience-presenter summary' >/dev/null
agent-browser click '[data-act="exp-presenter"][data-delta="1"]' >/dev/null
qa_frames
qa_ok 'Presenter Skip observes without source or playback' "$(qa_js '(!__me.S.visitor && __me.S.presenterSource===JSON.stringify(__me.A.domainSnapshot()))')" 'true'
# Author a visit-local Gate on the independent Piano offer, then exercise real visitor controls.
qa_js '(()=>{const e=__me.ctx.experience;const id=Object.values(e.uses).find(u=>u.kind==="interaction"&&u.triggerSubjectId==="piano").id;__me.E.command("Gate fixture",e=>e.stops[e.guide[0]].gate={useId:id,signal:"complete"});__me.S.visitorBefore={source:JSON.stringify(__me.A.domainSnapshot()),sel:__me.S.sel,undo:__me.S.undo.length,pose:JSON.stringify(__me.nav.plainPose())};return true;})()' >/dev/null
agent-browser click '[data-act="exp-preview"]' >/dev/null
qa_frames
agent-browser click '[data-command="start"]' >/dev/null
qa_frames
qa_ok 'visitor takeover hides authoring and fills viewport' "$(qa_js '(getComputedStyle(document.querySelector(".head")).display==="none" && document.querySelector("#gl").getBoundingClientRect().width===innerWidth && __me.S.sel===__me.S.visitorBefore.sel)')" 'true'
qa_key_dispatch ArrowRight
qa_ok 'keyboard Next obeys same Gate as disabled button' "$(qa_js '(__me.S.visitor.runtime.stopId===__me.ctx.experience.guide[0] && document.querySelector("[data-command=next]").disabled)')" 'true'
id="$(qa_jsv 'Object.values(__me.S.visitor.source.experience.uses).find(u=>u.triggerSubjectId==="switch").id')"
agent-browser click "[data-command=activate][data-id='$id']" >/dev/null
qa_frames
qa_ok 'Switch activation affects Light only in session' "$(qa_js '(__me.S.visitor.runtime.overrides.light.intensity.value===3 && __me.ctx.sceneSource.subjects.light.properties.intensity===2)')" 'true'
id="$(qa_jsv 'Object.values(__me.S.visitor.source.experience.uses).find(u=>u.triggerSubjectId==="piano").id')"
agent-browser click "[data-command=activate][data-id='$id']" >/dev/null
qa_frames
qa_ok 'independent Piano playback is running' "$(qa_js '__me.S.visitor.runtime.overrides.piano.playing.value')" 'true'
qa_js '__me.E.stepVisitor(12)' >/dev/null
qa_frames
qa_ok 'caption and cue execute from same clock' "$(qa_js '(!!document.querySelector(".visitor-caption").textContent && __me.S.visitor.runtime.viewUseId!==null)')" 'true'
qa_key_dispatch ArrowRight
qa_ok 'completed visit-local Gate allows manual Next' "$(qa_js '(__me.S.visitor.runtime.stopId===__me.ctx.experience.guide[1])')" 'true'
agent-browser click '[data-command="explore"]' >/dev/null
qa_frames
p="$(qa_at '#gl' 400 250)"; qa_move "${p%,*}" "${p#*,}"; qa_down; qa_move "$(( ${p%,*} + 80 ))" "${p#*,}"; qa_up; qa_frames
qa_ok 'visitor exploration never writes selection' "$(qa_js '(__me.S.visitor.runtime.exploring && __me.S.sel===__me.S.visitorBefore.sel)')" 'true'
agent-browser click '[data-command="rejoin"]' >/dev/null
qa_frames
qa_ok 'rejoin leaves Auto off' "$(qa_js '(!__me.S.visitor.runtime.autoplay && !__me.S.visitor.runtime.exploring)')" 'true'
agent-browser click '[data-act="exp-exit-preview"]' >/dev/null
qa_frames
qa_ok 'runtime freezes source/history and restores authoring' "$(qa_js '(__me.S.visitorBefore.source===JSON.stringify(__me.A.domainSnapshot()) && __me.S.visitorBefore.undo===__me.S.undo.length && __me.S.visitorBefore.sel===__me.S.sel && __me.S.visitorBefore.pose===JSON.stringify(__me.nav.plainPose()))')" 'true'
qa_faults_ok 'visitor commands'
qa_browser_errors_ok 'visitor browser'
qa_summary 'Visitor execution'
