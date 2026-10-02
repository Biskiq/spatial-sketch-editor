#!/usr/bin/env bash
# Current shell specimens, one private server/browser; no automatic replacement of checked-in evidence.
set -u
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export QA_OUT="${QA_OUT:-$SCRIPT_DIR/../qa/out/specimens}"
export QA_SHOT=1
source "$SCRIPT_DIR/../qa/lib.sh"
qa_open
shot() {
  local result
  result="$(qa_jsv "(async () => { const {A,S,ctx,qa:q}=__me; $2; await q.idle(); await q.render(); return 'ok'; })()")"
  qa_ok "$1 ready" "$result" ok
  qa_snap "$1"
}
reset='await A.closeAll(); A.endTaskInHand(); A.dismissParked(); A.select("gwin");'
shot world-bench 'A.select("bench");'
shot world-window 'A.select("gwin");'
shot unroll-half 'await A.face("gwin"); await A.unrollTo(.5);'
shot unroll-outside 'await A.setSide(-1); A.squareUp();'
shot unroll-inside 'await A.setSide(1); A.squareUp();'
shot unroll-flat 'await A.unrollTo(1); A.squareUp();'
shot unroll-step-back 'await A.unrollTo(.5); await A.stepBack();'
shot plan-edit "$reset await A.goPlan(); A.dimensionTask(\"gwin\");"
shot tilted-edit 'ctx.stage.cam.el=.8;'
shot section-aim "$reset A.startKnife(); await q.idle(); await q.render(); A.presetKnife([-17,.25],[13,.25],-1,6);"
shot section-slid 'A.slideKnife(.5);'
shot section-mid 'await A.commitKnife(); S.session.part=.5;'
shot section-depth 'S.session.part=1; A.setDepth(3); A.select("harbor");'
shot section-nested 'await A.face("harbor");'
shot section-reveal 'await A.closeSession(); A.toggleReveal("harbor");'
shot ceiling-partial "$reset A.select(\"longc\"); A.beginLid(\"longc\"); A.lidTo(.45);"
shot ceiling-gap-preview 'A.endLid(); await q.idle(); const opts=A.gapOptions("north","longc"); S.popover={wall:"north",ceil:"longc",opts}; A.previewOption(opts[1]);'
shot lookup-mid 'A.unpreview(); S.popover=null; await A.lookUp("longc"); S.session.settle=.5; S.session.h=.5; ctx.stage.cam.el=-.8;'
shot lookup-mirrored 'await A.lookUp("longc"); A.toggleMirror(); A.select("soffit"); A.setPrecision(true);'
shot precision-refusal "$reset await A.face(\"gwin\"); A.setPrecision(true); await q.render(); const f=document.querySelector(\"#precision input\"); f.focus(); f.value=\"-4\"; f.dispatchEvent(new KeyboardEvent(\"keydown\",{key:\"Enter\",bubbles:true}));"
shot exit-summary "A.editOnce(\"Garden window arch rise\",()=>A.applyOpening(\"gwin\",{rise:.45})); await A.closeAll();"
shot repair-preview "A.undo(); $reset"' A.select("panel"); A.repairTask("panel"); A.pickRepairWall("south"); A.declareRepair("s",3); A.declareRepair("y",1.6);'
shot world-search "$reset document.querySelector(\"[data-act=find]\").click(); const i=document.querySelector(\"#finderInput\"); i.value=\"panel\"; i.dispatchEvent(new Event(\"input\",{bubbles:true}));"
shot lens-parked 'document.querySelector("#finderInput").dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true})); await A.face("gwin"); await A.unrollTo(.5); A.switchLens("experience");'
shot lens-foreign 'A.selectBridge("pres-highlights");'
shot world-resume 'A.switchLens("world"); A.select("gwin");'
agent-browser set viewport 1024 768 >/dev/null
shot narrow-card 'await new Promise(r=>setTimeout(r,80)); document.querySelector("[data-act=sheet-card]").click();'
qa_faults_ok 'no specimen command faults'
qa_summary 'Current specimens'
