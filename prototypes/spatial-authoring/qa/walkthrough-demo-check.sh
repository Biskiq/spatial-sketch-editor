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
# What Next reported about the task it was offered: the panel's own demonstration line, and the module the
# card is drawn from. Never inferred from the cursor or from a button having been pressed.
state(){ qa_jsv 'document.querySelector("#journeys [data-example-demonstration]").dataset.state'; }
demo(){ qa_jsv 'document.querySelector("#journeys [data-example-demonstration]").textContent'; }
credit(){ qa_jsv "__me.E.presenterCredit(__me.E.presenterSteps()[$1]).credited"; }
# Select one Guide Stop through whichever Guide surface is currently rendered: the ordinary band's Peek
# button, or the Overview strip's own occurrence card. Never a synthetic selection.
stop_card(){
  if [ "$(qa_js "!!document.querySelector(\"[data-act=exp-stop][data-id='$1']\")")" = true ]; then click "[data-act=exp-stop][data-id='$1']"; return; fi
  click '#experienceDeck [data-act=exp-guide]'
  click ".stop-card[data-stop='$1'] [data-act=exp-stop]"
}
set_next(){ qa_scroll_center '[data-exp-next]'; agent-browser select '[data-exp-next]' "$1" >/dev/null; qa_frames; }
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
qa_ok 'Next with the walkthrough off is reported as browsing, not as a demonstrated task' "$(state) / $(demo)" "browsed / Browsed, not demonstrated · Q1 · Subject and Presentation · The walkthrough is off, so Next browsed the instruction"
click '#journeys [data-jact=prev]'; click '#journeys [data-jact=walkthrough]'
qa_ok 'turning the optional walkthrough on is source-neutral' "$(snapshot)" "$before"
# An explicit Skip is its own outcome: the cursor moves, the task does not run, and nothing is credited.
click '#journeys [data-jact=skip]'
qa_ok 'an explicit Skip is named as a skip, not as a demonstrated task' "$(state) / $(at) / $(credit 0)" 'skipped / 1 / false'
click '#journeys [data-jact=prev]'
click '#journeys [data-jact=next]'; wait_idle
qa_ok 'Next performs Q1 through the actual Presentation command' "$(qa_js '(Object.values(__me.ctx.experience.presentations).length===1&&__me.E.presenterCredit(__me.E.presenterSteps()[0]).credited)')" true
qa_ok 'a task that really ran is reported as demonstrated, from what the product did' "$(state) / $(demo)" "demonstrated / Demonstrated by Next · Q1 · Subject and Presentation · The task ran in the product"
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
qa_ok 'Next inside a private Preview is reported as browsing, not as a failed or successful task' "$(state)" 'browsed'
click '#journeys [data-jact=prev]'; click '[data-act=exp-exit-preview]'
agent-browser fill '[data-exp-primary]' 'The casing protects the rotor.' >/dev/null; qa_press Enter
advance Q4 4; advance Q5 5; advance Q6 6; advance Q7 7; advance Q8 8
advance A1 9; advance A2 10
# A traversal the runtime refuses must fail the demonstration cleanly rather than spin: the Stop the Guide
# visit starts in is authored to End, so every Next the demonstration issues is refused. Next still
# advances the cursor, the panel names the refusal it was given, and the topic earns nothing from the
# attempt. The authored Next is then restored and the same demonstration runs for real below.
FIRST_STOP="$(qa_jsv '__me.ctx.experience.guide[0]')"
stop_card "$FIRST_STOP"; set_next end
click '#journeys [data-jact=next]'; wait_idle
qa_ok 'a refused traversal still advances the instruction cursor' "$(at)" 11
qa_ok 'a refused traversal is reported as a failed demonstration, never as a successful one' "$(state)" 'failed'
qa_okc 'naming the runtime refusal where the reviewer is reading' "$(demo)" 'End of Guide'
qa_ok 'and crediting the task nothing it could not do' "$(credit 10)" false
if [ "${QA_DEMO_UNTIL:-}" = refused ]; then qa_summary 'C9 Next refused demonstration'; exit; fi
stop_card "$FIRST_STOP"; set_next order
click '#journeys [data-jact=prev]'
advance A3 11; advance A4 12; advance A5 13
advance A6 14; advance A7 15; advance A8 16; advance A9 17; advance A10 17
qa_ok 'Finish closes the shared walkthrough after the repair task' "$(qa_js 'document.querySelector("#journeys").classList.contains("open")')" false
qa_ok 'advanced demonstrations finish outside Preview with no pending source edit' "$(qa_js '(!__me.S.visitor&&!__me.S.pending)')" true
qa_ok 'Back and Skip still do no authoring after the walkthrough' "$(qa_js '(()=>{const before=JSON.stringify(__me.A.domainSnapshot()),n=__me.S.undo.length;__me.E.presenterStep(-1);__me.E.presenterSkip();return before===JSON.stringify(__me.A.domainSnapshot())&&n===__me.S.undo.length;})()')" true
qa_faults_ok 'no product command faults during optional walkthrough'
qa_browser_errors_ok 'no console or page errors during optional walkthrough'
qa_summary 'C9 optional walkthrough · actual task completion on Next'
