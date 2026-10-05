#!/usr/bin/env bash
# Product-only MP2 preparation. Human comprehension remains separate from these assertions.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_QUERY='motion=instant'
source "$QA_DIR/lib.sh"
qa_open;qa_faults_clear
click(){ agent-browser scrollintoview "$1" >/dev/null;agent-browser click "$1" >/dev/null;qa_frames; }
fill(){ agent-browser fill "$1" "$2" >/dev/null;qa_press Enter; }
choose(){ agent-browser select "$1" "$2" >/dev/null;qa_frames; }
fixture(){ click '#experienceExamples > summary';click "[data-act='$1']";click '#experienceExamples > summary'; }
source_json(){ qa_js 'JSON.stringify({world:__me.qa.museum(),domains:__me.A.domainSnapshot()})'; }
pose(){ qa_js '__me.qa.realized()'; }
# A mutation stops at the first boundary it protects, so later unrelated state cannot mask it.
checkpoint(){ if [ "${QA_COMPOSITION_UNTIL:-}" = "$1" ];then qa_summary "C9 boundary $1";exit;fi; }
# Repeat J1, then extend it without learning lifecycle or Camera graphs.
click '#lens [data-lens=experience]';fixture exp-reset
click '#index [data-id=machine]';click '#card [data-act=exp-create]'
fill '[data-exp-primary]' 'The casing protects the rotor. Power travels through the drive.'
click '#card [data-act=exp-capture]';click '#card [data-operate=machine]'
fill '[data-exp-audition=casing]' '1';click '#card [data-act=exp-use][data-cap=casing]'
pid="$(qa_jsv '__me.S.experienceContext.presentation')"
click "#index [data-act=exp-open][data-id='$pid']";click '#card [data-act=exp-add-guide]'
a="$(qa_jsv '__me.ctx.experience.guide[0]')"
click '#index [data-id=piano]';click '#card [data-act=exp-create]'
fill '[data-exp-primary]' 'Listen to the piano.'
click '#card [data-act=exp-add-guide]'
b="$(qa_jsv '__me.ctx.experience.guide[1]')"
qa_ok 'two Presentations create exactly two Stops and one explicit Camera View, no edges' "$(qa_js '(Object.keys(__me.ctx.experience.presentations).length===2&&__me.ctx.experience.guide.length===2&&Object.keys(__me.ctx.cameraSource.views).length===1&&Object.keys(__me.ctx.cameraSource.connections).length===0&&__me.S.experienceContext.depth==="ordinary")')" true
camera="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')";standpoint="$(pose)"
click ".peek-stop[data-id='$a']"
qa_ok 'Peek selects the Stop and exposes normal Entry/Next without opening L2 or moving Camera' "$(qa_js '(__me.S.sel===__me.ctx.experience.guide[0]&&__me.S.experienceContext.depth==="ordinary"&&__me.S.task===null&&document.querySelector("[data-exp-entry]")&&document.querySelector("[data-exp-next]")&&!document.querySelector(".stop-card.expanded"))') / $(pose)" "true / $standpoint"
checkpoint peek
choose '[data-exp-entry]' hold
qa_ok 'local Stop entry affects neither shared Presentation entry nor Camera' "$(qa_js 'JSON.stringify(__me.ctx.cameraSource)') / $(qa_js '(__me.ctx.experience.stops[__me.ctx.experience.guide[0]].entry.kind==="hold"&&Object.values(__me.ctx.experience.uses).some(u=>u.role==="entry"))')" "$camera / true"
click '#undoBtn';click '#experienceDeck [data-act=exp-preview-guide]'
qa_ok 'Preview Guide enters the first Stop directly; manual Next is immediately available' "$(qa_js '(__me.S.visitor.runtime.stopId===__me.ctx.experience.guide[0]&&!document.querySelector("[data-command=next]").disabled&&!document.querySelector("[data-command=start]"))')" true
before="$(source_json)"
click '[data-command=next]'
qa_ok 'early Next reaches the no-View Piano Stop without readiness or graph setup' "$(qa_js '(__me.S.visitor.runtime.stopId===__me.ctx.experience.guide[1]&&__me.S.visitor.runtime.presentationId!==__me.ctx.experience.stops[__me.ctx.experience.guide[0]].presentationId)') / $(source_json)" "true / $before"
click '[data-command=back]'
qa_ok 'ordinary Back creates a fresh visit and restarts local explanation' "$(qa_js '(()=>{const r=__me.S.visitor.runtime,e=__me.S.visitor.source.experience;return r.stopId===e.guide[0]&&r.visitCounter>=3&&Object.values(r.activities).filter(a=>e.definitions[e.uses[a.useId]?.definitionId]?.kind==="narration"&&a.visit===r.visit).some(a=>a.elapsed<1);})()')" true
click '[data-act=exp-exit-preview]'
# Deliberate disclosure stays distinct from selection.
click '#experienceDeck [data-act=exp-guide]'
click ".stop-card[data-stop='$a'] [data-act=exp-stop]"
qa_ok 'Overview selection remains L1 until Expand is explicitly invoked' "$(qa_js '(__me.S.experienceContext.depth==="overview"&&!document.querySelector(".stop-card.expanded"))')" true
click ".stop-card[data-stop='$a'] [data-act=exp-expand-stop]"
qa_ok 'explicit Expand reaches L2 and both projections of the same View use' "$(qa_js '(__me.S.experienceContext.depth==="occurrence"&&!!document.querySelector(".set-node")&&!!document.querySelector("[data-exp-view]"))')" true
click '#experienceDeck [data-act=exp-close]'
qa_ok 'leaving Overview returns to compact Peek without changing Camera source' "$(qa_js 'JSON.stringify(__me.ctx.cameraSource)') / $(qa_js '(__me.S.experienceContext.depth==="ordinary")')" "$camera / true"
# Loaded richer composition is editable; definitions and relationships are real source controls.
fixture exp-example
pid="$(qa_jsv '__me.S.experienceContext.presentation')"
click '#card > details:nth-of-type(3) > summary'
click '#card [data-act=pres-ref][data-id=contribution-6]'
click '#card > details:nth-of-type(1) > summary'
fill '[data-exp-def=duration]' '20'
click '#card [data-act=exp-passage]'
phrase="$(qa_jsv '__me.ctx.experience.definitions[__me.ctx.experience.uses[__me.S.sel].definitionId].markers.at(-1).id')"
fill "[data-exp-marker-field=time][data-marker='$phrase']" '4'
fill "[data-exp-marker-field=label][data-marker='$phrase']" 'Protected rotor'
# The observation is hoisted into its own assignment: this shell (bash 3.2) mis-parses a
# double-quoted qa_js argument containing {a,b} braces when the substitution follows another word,
# silently sending several empty evals and comparing two empty strings.
passage="$(qa_js "(()=>{const e=__me.ctx.experience,d=e.definitions[e.uses[__me.S.sel].definitionId],m=d.markers.find(m=>m.id==='$phrase');return m.time===4&&m.label==='Protected rotor'&&d.duration===20;})()")"
qa_ok 'named passage has stable explicit seconds and editable label' "$passage" true
fill '[data-exp-def=text]' 'The casing protects the rotor. Follow the output.'
marker_time="$(qa_js "__me.ctx.experience.definitions[__me.ctx.experience.uses[__me.S.sel].definitionId].markers.find(m=>m.id==='$phrase').time")"
qa_ok 'text edit preserves explicit marker placement rather than rescaling' "$marker_time" 4
click "#index [data-act=exp-open][data-id='$pid']";click '#card > details:nth-of-type(3) > summary'
click '#card [data-act=pres-ref][data-id=contribution-8]';click '#card > details > summary'
choose '[data-exp-home]' presentation-15
qa_ok 'regrouping Activity changes only its home, preserving explicit activation and boundary' "$(qa_js '(()=>{const u=__me.ctx.experience.uses["contribution-8"];return u.presentationId==="presentation-15"&&u.start.presentationId==="presentation-1"&&u.end.kind==="experience";})()')" true
checkpoint regroup
choose '[data-exp-retention]' experience
click "#index [data-act=exp-open][data-id='$pid']";click '#card > details:nth-of-type(3) > summary'
click '#card [data-act=pres-ref][data-id=contribution-10]';click '#card > details > summary'
choose '[data-exp-start-presentation]' ''
qa_ok 'dependency listener scope is editable independently of Activity home and lifetime' "$(qa_js '(()=>{const u=__me.ctx.experience.uses["contribution-10"];return u.start.scope==="experience"&&u.start.presentationId===null&&u.presentationId==="presentation-1"&&u.end.kind==="experience";})()')" true
choose '[data-exp-start-presentation]' presentation-1
# Optional View suggestions are not entry or Guide authority.
click "#index [data-act=exp-open][data-id='$pid']"
click '#card > details:last-of-type > summary'
click '#card [data-act=exp-view-order]'
source_camera="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')"
click '#card [data-act=exp-view-order-move][data-id=use-2][data-delta="1"]'
qa_ok 'suggestion reorder leaves entry, Stop order and Camera connectivity unchanged' "$(qa_js '(__me.ctx.experience.uses["use-2"].role==="entry"&&__me.ctx.experience.guide.length===2)') / $(qa_js 'JSON.stringify(__me.ctx.cameraSource)')" "true / $source_camera"
click '#headPreview'
qa_ok 'visitor offers entry and all three Views, explicit suggestion steps, coherent transcript and captions' "$(qa_js '(document.querySelectorAll("[data-command=look]").length===3&&document.querySelector("[data-command=next-view]")&&document.querySelector(".visitor-transcript").textContent.includes("Follow the output")&&document.querySelector(".visitor-caption").textContent.includes("The casing"))')" true
checkpoint offers
click '[data-command=captions]'
qa_ok 'caption toggle is session-only and leaves transcript available' "$(qa_js '(!__me.S.visitor.runtime.captions&&!document.querySelector(".visitor-caption").textContent&&!!document.querySelector(".visitor-transcript"))')" true
click '[data-act=exp-exit-preview]'
# Compact Stop section supports advanced pacing and Gate at Peek with no Deck expansion.
a="$(qa_jsv '__me.ctx.experience.guide[0]')";click ".peek-stop[data-id='$a']"
click '.stop-details > details > summary';choose '[data-exp-pacing]' dwell
fill '[data-exp-stop-number=dwell]' '3'
choose '[data-exp-gate]' '{"useId":"contribution-8","signal":"complete"}'
qa_ok 'compact Stop Card authors advanced dwell and explicit Gate without Overview' "$(qa_js '(()=>{const s=__me.ctx.experience.stops[__me.S.sel];return s.pacing.seconds===3&&s.gate.useId==="contribution-8"&&__me.S.experienceContext.depth==="ordinary";})()')" true
click '#experienceDeck [data-act=exp-preview-guide]'
qa_ok 'authored Gate blocks button and keyboard continuation, independent of natural readiness' "$(qa_js '(document.querySelector("[data-command=next]").disabled&&__me.S.visitor.runtime.stopId===__me.S.visitor.source.experience.guide[0])')" true
qa_key_dispatch ArrowRight
qa_ok 'keyboard observes the same Gate' "$(qa_js '(__me.S.visitor.runtime.stopId===__me.S.visitor.source.experience.guide[0])')" true
qa_js '__me.E.stepVisitor(2)' >/dev/null;qa_frames
qa_ok 'genuine casing completion releases authored permission' "$(qa_js '(!document.querySelector("[data-command=next]").disabled&&__me.S.visitor.runtime.signals[`${__me.S.visitor.runtime.visit}|contribution-8|complete`])')" true
click '[data-command=next]';click '[data-command=back]'
qa_ok 'new Stop visit cannot borrow prior Gate completion' "$(qa_js '(document.querySelector("[data-command=next]").disabled)')" true
click '[data-act=exp-exit-preview]'
qa_faults_ok 'composition commands';qa_browser_errors_ok 'composition browser'
qa_summary 'C9.2/C9.3 composition and compact Guide'
