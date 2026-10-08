#!/usr/bin/env bash
# Saved controls, shared identities and compact/sheet reachability. Canonical captures: conformance.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"
qa_open
qa_faults_clear
click(){ agent-browser scrollintoview "$1" >/dev/null;agent-browser click "$1" >/dev/null;qa_frames; }
qa_js '__me.E.loadConformance()' >/dev/null
click '#lens [data-lens="experience"]'
qa_ok 'Head names active Experience and Index is only a locator' "$(qa_js '(!document.querySelector("#activeExperience").hidden&&!document.querySelector("#index .experience-presenter"))')" true
click '#index [data-act="exp-open"][data-id="presentation-1"]'
click '[data-act="exp-guide"]'
id="$(qa_jsv '__me.ctx.experience.guide[3]')"
click ".stop-card[data-stop='$id'] [data-act=exp-stop]"
qa_ok 'Stop Card names local and shared reach' "$(qa_js '(document.querySelector("#card").textContent.includes("affect this Stop")&&document.querySelector("#card").textContent.includes("Meaning and Set"))')" true
click '.stop-details > details > summary'
agent-browser select '[data-exp-next]' end >/dev/null;qa_frames
agent-browser select '[data-exp-pacing]' dwell >/dev/null;qa_frames
agent-browser select '[data-exp-entry]' hold >/dev/null;qa_frames
click '[data-act="exp-close"]'
click '[data-act="exp-guide"]'
click ".stop-card[data-stop='$id'] [data-act=exp-stop]"
click '.stop-details > details > summary'
qa_ok 'reopened Stop displays accepted Next, Pacing, Entry' "$(qa_js '(document.querySelector("[data-exp-next]").value==="end"&&document.querySelector("[data-exp-pacing]").value==="dwell"&&document.querySelector("[data-exp-entry]").value==="hold")')" true
click '#undoBtn'
qa_ok 'Undo restores entry without changing other fields' "$(qa_js '(document.querySelector("[data-exp-entry]").value==="presentation"&&document.querySelector("[data-exp-next]").value==="end"&&document.querySelector("[data-exp-pacing]").value==="dwell")')" true
click "#card [data-act=exp-expand-stop][data-id='$id']"
requested="$(qa_js '__me.nav.plainPose()')"
agent-browser set viewport 1024 768 >/dev/null;qa_frames
qa_ok 'narrow Guide keeps Camera intent and a meaningful Stage with unclipped L2' "$(qa_js '__me.nav.plainPose()') / $(qa_js '(document.querySelector("#experienceDeck").getBoundingClientRect().height<innerHeight*.4&&document.querySelector(".stop-card.expanded").scrollHeight===document.querySelector(".stop-card.expanded").clientHeight&&document.documentElement.scrollWidth===innerWidth)')" "$requested / true"
qa_snap narrow-guide
click '[data-act="sheet-card"]'
# The expanded Deck overlays the lower shell; deliberately return to Peek for local Card work.
click '#experienceDeck [data-act="exp-close"]'

qa_ok 'narrow Card sheet exposes the selected Stop and local Entry control' "$(qa_js '(document.querySelector("#card").getBoundingClientRect().right<=innerWidth&&getComputedStyle(document.querySelector("#card")).display!=="none"&&(()=>{const e=document.querySelector("[data-exp-entry]"),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&r.bottom<innerHeight&&(hit===e||e.contains(hit));})())')" true
qa_snap narrow-card
click '[data-act="sheet-card"]'
agent-browser set viewport 1440 900 >/dev/null;qa_frames
click '#card .exp-view [data-act=pres-ref]'
qa_ok 'View use Card shows owner and current-use meaning' "$(qa_js '(document.querySelector("#card").textContent.includes("Experience role / Camera framing")&&document.querySelector("#card").textContent.includes("Current use"))')" true
click '#card [data-act=exp-precise]'
click '[data-act=exp-posture][data-posture=through]'
requested="$(qa_js '__me.nav.plainPose()')";source="$(qa_js '__me.qa.hash()')"
agent-browser set viewport 1024 768 >/dev/null;qa_frames
# Aspect necessarily changes; requested camera and source stay fixed, no refit.
qa_ok 'compact desktop preserves source and requested Camera without refit, and exposes sheet controls' "$(qa_js '__me.qa.hash()') / $(qa_js '__me.nav.plainPose()') / $(qa_js '(document.querySelector("#headPreview").getBoundingClientRect().right<=innerWidth&&document.documentElement.scrollWidth===innerWidth)')" "$source / $requested / true"
qa_snap narrow-precision
pose="$(qa_js '__me.qa.realized()')"
click '#headPreview'
qa_ok 'narrow visitor fills viewport, authoring controls inactive' "$(qa_js '(document.querySelector("#gl").getBoundingClientRect().width===innerWidth&&!__me.S.task&&document.querySelector("[data-act=exp-exit-preview]").getBoundingClientRect().right<=innerWidth)')" true
qa_snap narrow-visitor
click '[data-act=exp-exit-preview]'
qa_ok 'narrow Preview returns to exact accepted source' "$(qa_js '__me.qa.hash()')" "$source"
qa_ok 'narrow Preview restores complete authoring Camera' "$(qa_js '__me.qa.realized()')" "$pose"
qa_faults_ok 'reconciliation commands'
qa_browser_errors_ok 'reconciliation browser'
qa_summary 'Saved controls and narrow Experience'
