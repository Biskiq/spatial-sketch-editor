#!/usr/bin/env bash
# Shared Presenter call-site proof: actual authoring completes Q1–Q8; navigation observes only.
# Completion is session evidence, never MP3/MP4 owner acceptance.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_QUERY='motion=instant'
source "$QA_DIR/lib.sh"
qa_open
qa_faults_clear
click(){ qa_scroll_center "$1"; agent-browser click "$1" >/dev/null; qa_frames; }
fill(){ agent-browser fill "$1" "$2" >/dev/null; qa_press Enter; }
snapshot(){ qa_jsv 'JSON.stringify({world:__me.qa.museum(),source:__me.A.domainSnapshot(),undo:__me.S.undo,redo:__me.S.redo,sel:__me.S.sel,pose:__me.nav.plainPose()})' | shasum | cut -d' ' -f1; }
at(){ qa_jsv '__me.S.experiencePresenter||0'; }
earned(){ qa_ok "$1 is earned by its product outcome" "$(qa_js '(()=>{const i=__me.S.experiencePresenter||0,s=__me.E.presenterSteps()[i];return __me.E.presenterCredit(s).credited&&!document.querySelector("#journeys [data-jact=next]").disabled;})()')" true; }
advance(){ click '#journeys [data-jact=next]'; qa_ok "$1 advances exactly once" "$(at)" "$2"; }
sheet(){ # Product sheets are the supported narrow-screen entry, rather than hidden DOM clicks.
 local visible
 visible="$(qa_js "document.querySelector('#${1}').checkVisibility()")"
 if [ "$visible" = false ]; then click "[data-act=sheet-$1]"; fi
}

click '#jToggle'
world_title="$(qa_jsv 'document.querySelector("#jTitle").textContent')"
qa_ok 'World uses the retained A–F Presenter content and Replay' "$(qa_js '(document.querySelectorAll("#jTabs [data-j]").length===6&&!document.querySelector("#journeys [data-jact=replay]").hidden)')" true
before="$(snapshot)"
click '#lens [data-lens=experience]'
qa_ok 'Experience switches the same panel to its workflow, with no World content or Replay' "$(qa_js '(document.querySelectorAll(".journeys").length===1&&document.querySelector("#jTitle").textContent.includes("Q1")&&document.querySelectorAll("#jTabs [data-j]").length===0&&document.querySelector("#journeys [data-jact=replay]").hidden&&!document.querySelector("#journeys [data-jact=skip]").hidden)')" true
qa_ok 'switching the Presenter content preserves source, history, selection and Camera' "$(snapshot)" "$before"
if [ "${QA_WALKTHROUGH_UNTIL:-}" = lens ]; then qa_summary 'C9 follow-up · lens boundary'; exit; fi
click '#journeys [data-jact=walkthrough]'
click '#experienceExamples > summary'; click '#experienceExamples [data-act=exp-reset]'; click '#experienceExamples > summary'
before="$(snapshot)"
qa_ok 'empty Reset leaves Next available without inventing an outcome' "$(qa_js '(!document.querySelector("#journeys [data-jact=next]").disabled&&!__me.E.presenterCredit(__me.E.presenterSteps()[0]).credited)')" true
click '#journeys [data-jact=skip]'; click '#journeys [data-jact=prev]'
qa_ok 'explicit Skip and Back author nothing and credit no skipped outcome' "$(snapshot) / $(at) / $(qa_js '__me.E.presenterCredit(__me.E.presenterSteps()[0]).credited')" "$before / 0 / false"
click '#lens [data-lens=world]'
qa_ok 'World returns to its own Presenter step' "$(qa_jsv 'document.querySelector("#jTitle").textContent')" "$world_title"
click '#lens [data-lens=experience]'
qa_ok 'Experience returns to its own instruction cursor' "$(at)" 0

sheet index; click '#index [data-id=machine]'
sheet card; click '#card [data-act=exp-create]'
earned Q1; advance Q1 1
fill '[data-exp-primary]' 'The casing protects the rotor.'
click '#card [data-act=exp-capture]'
earned Q2; advance Q2 2
click '#card [data-operate=machine]'
before="$(qa_jsv 'JSON.stringify(__me.A.domainSnapshot())')"
fill '[data-exp-audition=casing]' '0.6'
qa_ok 'operating the capability auditions without authoring' "$(qa_jsv 'JSON.stringify(__me.A.domainSnapshot())')" "$before"
click '#card [data-act=exp-use][data-cap=casing]'
earned Q3; advance Q3 3
pid="$(qa_jsv '__me.S.experienceContext.presentation')"
sheet index; click "#index [data-act=exp-open][data-id='$pid']"
before="$(snapshot)"
click '#headPreview'
qa_ok 'Preview keeps the shared walkthrough visible and read-only, with authoring unavailable' "$(qa_js '(()=>{const p=document.querySelector("#journeys"),field=document.querySelector("#card [data-exp-primary]");return !!__me.S.visitor&&p.checkVisibility()&&p.classList.contains("presenter-visiting")&&p.querySelector("#jBody").textContent.startsWith("Read-only")&&p.querySelectorAll("[data-authoring]").length===0&&!document.querySelector("#experienceExamples").checkVisibility()&&!field?.checkVisibility();})()')" true
qa_js '__me.E.stepVisitor(4)' >/dev/null; qa_frames
click '[data-act=exp-exit-preview]'
qa_ok 'Preview returns the exact authoring context without source/history writes' "$(snapshot)" "$before"
earned Q4; advance Q4 4
sheet card; click '#card [data-act=exp-add-guide]'
stop="$(qa_jsv '__me.ctx.experience.guide[0]')"
click ".peek-stop[data-id='$stop']"
earned Q5; advance Q5 5
sheet index; click '#index [data-id=piano]'
sheet card; click '#card [data-act=exp-create]'
fill '[data-exp-primary]' 'Listen to the piano.'
click '#card [data-act=exp-add-guide]'
qa_ok 'the second Presentation becomes a distinct Stop with no manual Camera graph' "$(qa_js '(()=>{const e=__me.ctx.experience;return e.guide.length===2&&e.stops[e.guide[0]].presentationId!==e.stops[e.guide[1]].presentationId&&Object.keys(e.seams).length===0;})()')" true
earned Q6; advance Q6 6
click '#experienceDeck [data-act=exp-preview-guide]'
click '[data-command=next]'
earned Q7; advance Q7 7
click '[data-command=explore]'
pose="$(qa_jsv 'JSON.stringify(__me.nav.plainPose())')"
point="$(qa_jsv '(()=>{const c=document.querySelector("#gl"),r=c.getBoundingClientRect();for(const fy of [.1,.3,.5])for(const fx of [.1,.3,.6,.85]){const x=Math.round(r.left+r.width*fx),y=Math.round(r.top+r.height*fy);if(document.elementFromPoint(x,y)===c&&document.elementFromPoint(x+40,y+20)===c)return [x,y].join(",");}return "none";})()')"
qa_ok 'guidance leaves real Stage space available for exploration' "$( [ "$point" != none ] && echo true || echo false )" true
IFS=, read -r x y <<< "$point"
qa_move "$x" "$y"; qa_down; qa_move "$((x+40))" "$((y+20))"; qa_up
qa_ok 'the exploration gesture changed the viewpoint' "$(qa_js "JSON.stringify(__me.nav.plainPose())!==JSON.stringify($pose)")" true
click '[data-command=rejoin]'
earned Q8; advance Q8 8
qa_ok 'the ordinary workflow reaches Advanced after all eight earned Next actions' "$(qa_js '(document.querySelector("#jTitle").textContent.includes("A1")&&__me.ctx.experience.guide.length===2&&!__me.S.visitor.runtime.autoplay)')" true
click '[data-act=exp-exit-preview]'
before="$(snapshot)"
click '#journeys [data-jact=close]'; click '#jToggle'
qa_ok 'close and reopen preserve work and the instruction cursor' "$(snapshot) / $(at)" "$before / 8"
qa_snap experience-walkthrough
qa_ok 'no command faults through the complete workflow' "$(qa_js '__me.S.faults.length')" 0
qa_browser_errors_ok 'no console or page errors'
qa_summary 'C9 follow-up · shared Experience workflow'
