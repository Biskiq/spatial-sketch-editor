#!/usr/bin/env bash
# S9 shared-shell, saved-control wiring, canonical specimens and narrow Experience.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"
qa_open
qa_faults_clear
step() { qa_js "(async()=>{const {A,E,S,ctx,qa:q}=__me; $1; await q.idle(); await q.render(); return true;})()" >/dev/null; }
# Let visual transitions finish before preserving specimens; assertions still use live state.
capture() { [ "$QA_SHOT" = "0" ] || qa_js 'new Promise(resolve=>setTimeout(resolve,450))' >/dev/null; qa_snap "$1"; }
agent-browser click '#lens [data-lens="experience"]' >/dev/null
qa_frames
qa_ok 'Head names the active Experience; Index contains no prototype disclosure' "$(qa_js '(!document.querySelector("#activeExperience").hidden && document.querySelector("#activeExperience").textContent==="Saltmarsh Experience" && !document.querySelector("#index .experience-presenter") && document.querySelectorAll("#index [data-act=pres-ref]").length===6)')" true
step 'A.select("gwin"); S.createPose=JSON.stringify(__me.nav.plainPose());'
agent-browser click '#index [data-act="exp-create"]' >/dev/null
qa_frames
qa_ok 'Create makes a distinct Presentation for an already-referenced World subject' "$(qa_js '(Object.keys(__me.ctx.experience.presentations).length===2 && __me.S.sel!=="pres-highlights" && __me.ctx.experience.presentations[__me.S.sel].focus.ids[0]==="gwin" && __me.S.undo.length===1 && __me.S.createPose===JSON.stringify(__me.nav.plainPose()) && __me.ctx.experience.guide.length===0)')" true
step 'E.resetExperience(false); E.openPresentation("pres-highlights"); E.captureView(); E.autoView(); E.captureView();'
capture qa-1-ordinary
agent-browser click '#headPreview' >/dev/null
qa_frames
qa_ok 'Head Preview invokes the active Presentation with no Guide' "$(qa_js '(!!__me.S.visitor && __me.S.visitor.runtime.presentationId==="pres-highlights" && __me.S.visitor.runtime.stopId===null)')" true
agent-browser click '[data-act="exp-exit-preview"]' >/dev/null
qa_frames
step 'E.resetExperience(true); await A.goPlan(); E.guideOverview();'
capture qa-2-overview
agent-browser click '.stop-card [data-act="exp-stop"]' >/dev/null
qa_frames
capture qa-3-occurrence
qa_ok 'Stop Card names property owner and local versus shared reach' "$(qa_js '(()=>{const t=document.querySelector("#card .c-ref").textContent;return t.includes("Owner · Experience")&&t.includes("affect this Stop")&&t.includes("Meaning and Set");})()')" true
agent-browser click '.stop-details summary' >/dev/null
agent-browser select '[data-exp-next]' end >/dev/null
qa_frames
agent-browser select '[data-exp-pacing]' dwell >/dev/null
qa_frames
agent-browser select '[data-exp-entry]' hold >/dev/null
qa_frames
step 'S.savedStop=S.sel; E.closeExperienceWork(); E.expandStop(S.savedStop);'
qa_ok 'reopened Stop controls reflect accepted Next, Pacing and Entry' "$(qa_js '(document.querySelector("[data-exp-next]").value==="end" && document.querySelector("[data-exp-pacing]").value==="dwell" && document.querySelector("[data-exp-entry]").value==="hold")')" true
agent-browser click '#undoBtn' >/dev/null
qa_frames
qa_ok 'Undo displays the restored Stop entry, leaving other accepted fields' "$(qa_js '(document.querySelector("[data-exp-entry]").value==="presentation" && document.querySelector("[data-exp-next]").value==="end" && document.querySelector("[data-exp-pacing]").value==="dwell")')" true
step 'E.resetExperience(true); E.guideOverview(); E.expandStop(ctx.experience.guide[0]);'
agent-browser click '#card .exp-view [data-act="pres-ref"]' >/dev/null
qa_frames
qa_ok 'View use Card distinguishes Experience role from shared Camera framing and reach' "$(qa_js '(()=>{const t=document.querySelector("#card").textContent;return t.includes("View use · Experience")&&t.includes("Experience role / Camera framing")&&t.includes("2 uses · 2 Stops");})()')" true
step 'const compare=ctx.experience.stops[ctx.experience.guide[1]].presentationId; __me.nav.applyPose({target:[-3,1.2,1],az:1.2,el:.25,frameH:3,flat:0}); const entry=E.captureView(compare); E.changeRole(entry,"entry"); await A.goPlan(); E.openSeam(ctx.experience.guide[0],ctx.experience.guide[1]);'
agent-browser click '[data-act="exp-connect"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-travel"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-route"]' >/dev/null
qa_frames
step 'E.routePoint({x:-7,z:1});'
capture qa-4-route
agent-browser click '[data-act="exp-coordinate"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-mark-station"]' >/dev/null
qa_frames
qa_ok 'named Camera stations appear on Stage and in the coordination selector' "$(qa_js '(()=>{const id=__me.ctx.cameraSource.connections[__me.S.task.params.connection].markers[0].id;return !!document.querySelector("[data-exp-station-label=\""+id+"\"]")&&!!document.querySelector("[data-exp-station] option[value=\""+id+"\"]");})()')" true
agent-browser click '[data-act="exp-beat"]' >/dev/null
qa_frames
agent-browser fill '[data-exp-hold]' 2.5 >/dev/null
agent-browser press Enter >/dev/null
qa_frames
qa_ok 'coordination edits an Experience hold without moving Camera stations' "$(qa_js '(__me.ctx.experience.seams[__me.S.experienceContext.seam.from+">"+__me.S.experienceContext.seam.to].beats[0].seconds===2.5 && __me.ctx.cameraSource.connections[__me.S.task.params.connection].markers.length===1)')" true
capture qa-5-coordination
step 'E.closeExperienceWork(); const id=ctx.experience.presentations[S.experienceContext.presentation].uses[0]; E.preciseView(id); E.posture("through");'
qa_ok 'Through exposes the active Camera grip on Stage' "$(qa_js '(!!document.querySelector("[data-exp-camera]"))')" true
step 'S.invalidBefore=JSON.stringify(A.domainSnapshot()); S.invalidUndo=S.undo.length;'
agent-browser fill '[data-exp-precision]' -4 >/dev/null
agent-browser press Enter >/dev/null
qa_frames
qa_ok 'invalid framing refuses in words without source/history or page fault' "$(qa_js '(__me.S.invalidBefore===JSON.stringify(__me.A.domainSnapshot()) && __me.S.invalidUndo===__me.S.undo.length && __me.S.faults.length===0 && document.querySelector("#statusText").textContent.includes("Invalid Camera framing"))')" true
step 'S.preciseUse=S.task.params.useId; E.closeExperienceWork();'
step 'E.preciseView(S.preciseUse); E.posture("through"); A.setStatus("Precise Camera authoring","view");'
capture qa-6-precise
qa_ok 'Through is visibly authoring with one accepted numeric tape' "$(qa_js '(!__me.S.visitor && getComputedStyle(document.querySelector(".head")).display!=="none" && document.querySelectorAll(".numeric-tape input").length===1 && Number(document.querySelector(".numeric-tape input").value)===__me.ctx.cameraSource.views[__me.S.task.target.id].pose.frameH && document.querySelector("#experienceDeck").textContent.includes("Authoring") && __me.A.viewKind()==="3d" && document.querySelector("#stViewNow").textContent==="3D")')" true
agent-browser click '#headPreview' >/dev/null
qa_frames
capture visitor
agent-browser click '[data-act="exp-exit-preview"]' >/dev/null
qa_frames
step 'A.switchLens("world");'
capture foreign-selection
step 'A.switchLens("experience");'
capture parked-procedure
step 'E.resumeExperience(); S.resizePose=JSON.stringify(__me.nav.plainPose()); S.resizeSource=JSON.stringify(A.domainSnapshot());'
agent-browser set viewport 1024 768 >/dev/null
qa_frames
qa_ok 'narrow desktop keeps Camera pose and source; Deck and Head stay inside viewport' "$(qa_js '(__me.S.resizePose===JSON.stringify(__me.nav.plainPose()) && __me.S.resizeSource===JSON.stringify(__me.A.domainSnapshot()) && document.querySelector("#experienceDeck").getBoundingClientRect().right<=innerWidth && document.querySelector("#headPreview").getBoundingClientRect().right<=innerWidth && document.documentElement.scrollWidth===innerWidth)')" true
capture narrow-deck
agent-browser click '#headPreview' >/dev/null
qa_frames
qa_ok 'narrow visitor fills viewport and keeps controls reachable' "$(qa_js '(document.querySelector("#gl").getBoundingClientRect().width===innerWidth && document.querySelector("#visitorSurface").getBoundingClientRect().bottom<=innerHeight && document.querySelector("[data-act=exp-exit-preview]").getBoundingClientRect().right<=innerWidth)')" true
capture narrow-visitor
agent-browser click '[data-act="exp-exit-preview"]' >/dev/null
qa_frames
qa_ok 'narrow Preview restores the accepted authoring pose and source' "$(qa_js '(__me.S.resizePose===JSON.stringify(__me.nav.plainPose()) && __me.S.resizeSource===JSON.stringify(__me.A.domainSnapshot()))')" true
qa_faults_ok 'reconciliation commands'
qa_browser_errors_ok 'reconciliation browser'
qa_summary 'Shared shell and narrow Experience'
