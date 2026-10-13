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
# UX4/§5.2: the Stop Card no longer narrates its own scope. Shared reach is the reach line itself — the
# Presentation it presents and how many Stops present it — and local is the Stop's own Entry and Next rows.
qa_ok 'Stop Card names local and shared reach' "$(qa_js '(document.querySelector("#card [data-stop-reach]").textContent.includes("Presentation ·")&&/in [0-9]+ Stops?/.test(document.querySelector("#card [data-stop-reach]").textContent)&&!!document.querySelector("#card [data-exp-entry]")&&!!document.querySelector("#card [data-exp-next]")&&!!document.querySelector("#card [data-stop-entry]"))')" true
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
# UX4: Expand and the expanded chip are retired — a chip selection always reads the Stop Card, and the
# Guide band is opened by its own door (the ordinary strip's name block). The law is now the band's own
# height plus the selected chip's visibility inside the lane it scrolls in.
# The band is opened only when it is closed: this recipe already has it open above, and a click on a door
# that is not rendered would be a silent no-op. The state is read first, and the precondition is asserted
# below, so the step can neither miss nor quietly do nothing.
if [ "$(qa_js 'document.querySelector("#experienceDeck")?.classList.contains("ordinary")===true')" = true ]; then
  click '#experienceDeck .deck-open[data-act="exp-guide"]'
fi
qa_ok 'the Guide band is open, with its lane, before the narrow measurement' "$(qa_js '(()=>{const d=document.querySelector("#experienceDeck");return !!d&&!d.classList.contains("ordinary")&&!!d.querySelector(".gd-lane");})()')" true
requested="$(qa_js '__me.nav.plainPose()')"
agent-browser set viewport 1024 768 >/dev/null;qa_frames
qa_ok 'narrow Guide keeps Camera intent and a bounded band with the selected chip in the lane' "$(qa_js '__me.nav.plainPose()') / $(qa_js '(() => { const d=document.querySelector("#experienceDeck"), lane=document.querySelector("#experienceDeck .gd-lane"), chip=lane&&lane.querySelector(".gd-stop-card.selected"); if(!d||d.classList.contains("ordinary")||!lane||!chip)return false; const r=d.getBoundingClientRect(), l=lane.getBoundingClientRect(), c=chip.getBoundingClientRect(); return r.height<innerHeight*.4&&r.height<=112&&c.left>=l.left-1&&c.right<=l.right+1&&document.documentElement.scrollWidth===innerWidth; })()')" "$requested / true"
qa_snap narrow-guide
click '[data-act="sheet-card"]'
# The Guide band overlays the lower shell; deliberately return to rest for local Card work.
click '#experienceDeck [data-act="exp-close"]'

qa_ok 'narrow Card sheet exposes the selected Stop and local Entry control' "$(qa_js '(document.querySelector("#card").getBoundingClientRect().right<=innerWidth&&getComputedStyle(document.querySelector("#card")).display!=="none"&&(()=>{const e=document.querySelector("[data-exp-entry]"),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&r.bottom<innerHeight&&(hit===e||e.contains(hit));})())')" true
qa_snap narrow-card
click '[data-act="sheet-card"]'
agent-browser set viewport 1440 900 >/dev/null;qa_frames
# UX4: the Stop Card's retired L2 Set is gone; a View use is reached from the shared Presentation the Stop
# names, then selected in that Presentation's own Views list.
click '#card [data-act="exp-open"]'
click '#card [data-exp-views] [data-exp-view-use]'
# UX2/§5.3: the View Card names the Presentation it belongs to and its own current role (★ Default, or a
# visitor View choice) on a second line, plus its own operations — the same canonical identity the Views list
# and the Stage's View markers select, never a second reading of the same thing.
owner="$(qa_jsv '(() => { const e = __me.ctx.experience, u = e.uses[__me.S.sel]; return e.presentations[u && u.presentationId] ? e.presentations[u.presentationId].name : ""; })()')"
# §5.3: the View Card's kind is the kind alone, and its reach line is exactly two lines — the owning
# Presentation, then its own current role. `Reach · …` is retired because the Ask carries reach when it
# matters; the two-line structure is asserted rather than its old wording.
qa_ok 'View use Card shows its owning Presentation and its own current meaning' "$(qa_js "(() => { const c = document.querySelector('#card'), ref = c.querySelector('.c-ref'), lines = ref.innerHTML.split('<br>'); return c.querySelector('.c-k').textContent.trim() === 'View' && lines.length === 2 && lines[0].includes('Presentation ·') && lines[0].includes('$owner') && /★ Default|Visitor choice/.test(lines[1]) && !!c.querySelector('[data-exp-ops]'); })()")" true
click '#card [data-act=exp-precise]'
click '[data-act=exp-posture][data-posture=through]'
requested="$(qa_js '__me.nav.plainPose()')";source="$(qa_js '__me.qa.hash()')"
agent-browser set viewport 1024 768 >/dev/null;qa_frames
# Aspect necessarily changes; requested camera and source stay fixed, no refit.
qa_ok 'compact desktop preserves source and requested Camera without refit, and exposes sheet controls' "$(qa_js '__me.qa.hash()') / $(qa_js '__me.nav.plainPose()') / $(qa_js '(document.querySelector("#headPreview").getBoundingClientRect().right<=innerWidth&&document.documentElement.scrollWidth===innerWidth)')" "$source / $requested / true"
qa_snap narrow-precision
pose="$(qa_js '__me.qa.realized()')"
qa_preview_presentation
qa_ok 'narrow visitor fills viewport, authoring controls inactive' "$(qa_js '(document.querySelector("#gl").getBoundingClientRect().width===innerWidth&&!__me.S.task&&document.querySelector("[data-act=exp-exit-preview]").getBoundingClientRect().right<=innerWidth)')" true
qa_snap narrow-visitor
click '[data-act=exp-exit-preview]'
qa_ok 'narrow Preview returns to exact accepted source' "$(qa_js '__me.qa.hash()')" "$source"
qa_ok 'narrow Preview restores complete authoring Camera' "$(qa_js '__me.qa.realized()')" "$pose"
qa_faults_ok 'reconciliation commands'
qa_browser_errors_ok 'reconciliation browser'
qa_summary 'Saved controls and narrow Experience'
