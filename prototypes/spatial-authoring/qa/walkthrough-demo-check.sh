#!/usr/bin/env bash
# The owner-directed Next: an optional task demonstration, with advisory outcomes and ordinary Undo.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_QUERY='motion=instant'
source "$QA_DIR/lib.sh"
qa_open; qa_faults_clear
click(){ qa_scroll_center "$1"; agent-browser click "$1" >/dev/null; qa_frames; }
at(){ qa_jsv '__me.S.experiencePresenter||0'; }
snapshot(){ qa_jsv 'JSON.stringify({source:__me.A.domainSnapshot(),undo:__me.S.undo,redo:__me.S.redo,sel:__me.S.sel})' | shasum | cut -d' ' -f1; }
wait_idle(){
  for ((n=0;n<400;n++)); do
    [ "$(qa_js 'document.querySelector("#journeys [data-jact=next]").disabled')" = false ] && return
    sleep .1
  done
  qa_ok 'the task demonstration returns to an available Next' false true
}
advance(){
  local index
  index="$(at)"; click '#journeys [data-jact=next]'; wait_idle
  qa_ok "Next demonstrates $1 and advances exactly once" "$(at)" "$2"
  qa_ok "$1 has an actual product outcome after Next" "$(qa_js "__me.E.presenterCredit(__me.E.presenterSteps()[$index]).credited")" true
}
click '#lens [data-lens=experience]'; click '#jToggle'
click '#experienceExamples > summary'; click '#experienceExamples [data-act=exp-reset]'; click '#experienceExamples > summary'
click '#journeys [data-jact=walkthrough]'
before="$(snapshot)"; click '#journeys [data-jact=next]'
qa_ok 'guidance-mode Next advances without a completion gate' "$(at)" 1
qa_ok 'guidance-mode Next never writes source or history' "$(snapshot)" "$before"
click '#journeys [data-jact=prev]'; click '#journeys [data-jact=walkthrough]'
qa_ok 'turning the optional walkthrough on is source-neutral' "$(snapshot)" "$before"
click '#journeys [data-jact=next]'; wait_idle
qa_ok 'Next performs Q1 through the actual Presentation command' "$(qa_js '(Object.values(__me.ctx.experience.presentations).length===1&&__me.E.presenterCredit(__me.E.presenterSteps()[0]).credited)')" true
qa_ok 'the demonstrated Presentation uses ordinary aggregate Undo' "$(qa_jsv '__me.S.undo.at(-1).label')" 'Create Presentation'
if [ "${QA_DEMO_UNTIL:-}" = first ]; then qa_summary 'C9 Next first task'; exit; fi
qa_js '__me.E.beginOffer("interaction","machine")' >/dev/null
draft="$(qa_jsv 'JSON.stringify(__me.S.expOfferDraft)')"; before="$(snapshot)"
click '#journeys [data-jact=next]'
qa_ok 'Next preserves an unfinished product draft and still advances' "$(snapshot) / $(at) / $(qa_jsv 'JSON.stringify(__me.S.expOfferDraft)')" "$before / 2 / $draft"
click '#journeys [data-jact=prev]'; qa_press Escape
qa_ok 'the ordinary cancellation pipeline releases the draft without authoring' "$(snapshot) / $(qa_js '__me.S.expOfferDraft===null')" "$before / true"
advance Q2 2; advance Q3 3

# A long narration makes cancellation observable before natural task completion. This is a real field.
agent-browser fill '[data-exp-primary]' 'The machine has a casing around its rotor. The protective casing keeps the moving rotor safe while the visitor explores the drive, studies its parts, compares its material, and listens to a longer explanation before moving to the next Presentation.' >/dev/null
qa_press Enter
click '#journeys [data-jact=next]'
qa_ok 'the demonstration enters the actual private Preview' "$(qa_js '!!__me.S.visitor')" true
qa_ok 'the walkthrough keeps the authored explanation during Preview' "$(qa_js 'Object.values(__me.ctx.experience.definitions).some(d=>d.text?.includes("a longer explanation"))')" true
click '#journeys [data-jact=close]'
for ((n=0;n<20;n++)); do [ "$(qa_js '!!__me.S.visitor')" = false ] && break; sleep .1; done
qa_ok 'closing guidance releases its owned Preview and leaves the cursor in place' "$(qa_js '!!__me.S.visitor') / $(at)" 'false / 3'
if [ "${QA_DEMO_UNTIL:-}" = cancel ]; then qa_summary 'C9 Next cancellation'; exit; fi
click '#jToggle'

# Preview authoring remains unavailable even when Next normally offers to do a task.
before="$(snapshot)"; click '#headPreview'
qa_ok 'Preview unmounts the walkthrough authoring option' "$(qa_js '(!document.querySelector("#journeys [data-jact=walkthrough]")&&document.querySelector("#jWalkthrough").textContent.includes("Next browses instructions"))')" true
click '#journeys [data-jact=next]'
qa_ok 'Next stays read-only during a separately entered Preview' "$(snapshot) / $(qa_js '!!__me.S.visitor') / $(at)" "$before / true / 4"
click '#journeys [data-jact=prev]'; click '[data-act=exp-exit-preview]'
agent-browser fill '[data-exp-primary]' 'The casing protects the rotor.' >/dev/null; qa_press Enter
advance Q4 4; advance Q5 5; advance Q6 6; advance Q7 7; advance Q8 8
advance A1 9; advance A2 10; advance A3 11; advance A4 12; advance A5 13
advance A6 14; advance A7 15; advance A8 16; advance A9 17; advance A10 17
qa_ok 'Finish closes the shared walkthrough after the repair task' "$(qa_js 'document.querySelector("#journeys").classList.contains("open")')" false
qa_ok 'advanced demonstrations finish outside Preview with no pending source edit' "$(qa_js '(!__me.S.visitor&&!__me.S.pending)')" true
qa_ok 'Back and Skip still do no authoring after the walkthrough' "$(qa_js '(()=>{const before=JSON.stringify(__me.A.domainSnapshot()),n=__me.S.undo.length;__me.E.presenterStep(-1);__me.E.presenterSkip();return before===JSON.stringify(__me.A.domainSnapshot())&&n===__me.S.undo.length;})()')" true
qa_faults_ok 'no product command faults during optional walkthrough'
qa_browser_errors_ok 'no console or page errors during optional walkthrough'
qa_summary 'C9 optional walkthrough · actual task completion on Next'
