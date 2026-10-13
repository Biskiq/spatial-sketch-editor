#!/usr/bin/env bash
# Product-reachable specimens. Only deterministic authored fixture loading is outside the flow.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_QUERY='motion=instant'
source "$QA_DIR/lib.sh"
qa_open
fixture(){
 click '#experienceExamples > summary'
 click "#experienceExamples [data-act=\"$1\"]"
 click '#experienceExamples > summary'
}
qa_faults_clear
conformance_ok(){ if [ -z "$2" ]; then qa_fail_msg "empty observation: $1"; else qa_ok "$@"; fi; }
checkpoint(){ if [ "${QA_CONFORMANCE_UNTIL:-}" = "$1" ];then qa_summary "V2 boundary $1";exit;fi; }
capture(){
 [ "$QA_SHOT" = 0 ] && return 0
 # Observe the settled paper/material transition as well as Camera/DOM state.
 for frame in {1..12};do qa_frames;done
 qa_snap "$1"
 qa_js '({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,lens:__me.S.lens,selection:__me.S.sel,context:__me.S.experienceContext,task:__me.S.task,realized:__me.qa.realized(),source:__me.A.domainSnapshot()})' >"$QA_OUT/$1.json"
}
click(){ agent-browser scrollintoview "$1" >/dev/null;qa_scroll_center "$1";agent-browser click "$1" >/dev/null;qa_frames; }
fill(){ agent-browser fill "$1" "$2" >/dev/null; qa_press Enter; }
pose(){ qa_js '__me.qa.realized()'; }
source_hash(){ qa_js '(()=>{const s=JSON.stringify(__me.A.domainSnapshot());let h=0;for(const ch of s)h=(Math.imul(h,31)+ch.charCodeAt(0))|0;return h;})()'; }
undo(){ qa_jsv '__me.S.undo.length'; }
# Read-only observations never establish the state being tested.
visible='e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}'
hit='e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return at===e||e.contains(at);}'
# QA-1: Reset, select a subject, explicitly Present, edit Meaning, derive, Capture.
click '#lens [data-lens="experience"]'
fixture exp-reset
qa_locator_select machine
click '#card [data-act="exp-create-this"]'
# UX2: `Present this` is aggregate. One Undo step writes the Presentation, its first View use as the
# Default and the Camera View that use reads, so the Card names that View in its own Views list before
# anything else happens. The accepted no-View reading this axis proves further down is reached the way an
# author reaches it — by unlinking that one use — rather than by a creation command that no longer exists.
conformance_ok 'Present this is one aggregate command: a Presentation, one Default View use and the Camera View it reads' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,p=e.presentations[pid],c=__me.ctx.cameraSource,us=p.uses.map(id=>e.uses[id]);return Object.keys(e.presentations).length===1&&us.length===1&&us[0].role==="entry"&&!!c.views[us[0].viewId]&&!!document.querySelector("[data-exp-views] [data-exp-view-use]");})()')" true
# The ordinary explanation is one door on the Card, and the Presentation's name is written in the Card's
# own menu: both are opened the way an author opens them, never through a selector the control never had.
click '#card [data-exp-explain] > summary'
fill '[data-exp-primary]' 'A casing, a rotor, and a path for power.'
click '#card [data-exp-menu="presentation"] > summary'
fill '[data-exp-field="name"]' 'Why the drive matters'
conformance_ok 'the explanation field commits one authored narration through the real control' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,primary=Object.values(e.uses).filter(u=>u.primary);return primary.length===1&&primary[0].presentationId===pid&&e.definitions[primary[0].definitionId].kind==="narration"&&e.definitions[primary[0].definitionId].text==="A casing, a rotor, and a path for power.";})()')" true
conformance_ok 'quickstart observes the real Presentation it was asked for, not a button press' "$(qa_js '(()=>{const s=document.querySelector("[data-example-step]").textContent,o=document.querySelector("[data-example-observed]").textContent;return s.includes("1/18")&&o.includes("Why the drive matters");})()')" true
# C9.1 ordinary loop: the subject-local audition is session state; Use captures one honest Activity.
click '#card [data-exp-focus-subject="machine"]'
conformance_ok 'the Presentation Card reaches the subject it presents' "$(qa_js '__me.S.sel')" '"machine"'
pid_now="$(qa_jsv '__me.S.experienceContext.presentation')"
before="$(source_hash)"; count="$(undo)"
# QA 5: the subject's own Card reads identity → Present this → Used in Experience → the two doors, and no
# capability control is on screen at rest. The derivation is read-only, so it is present with nothing yet.
# The order is read from the Card's own children: identity is its `.c-head`, `Present this` is its own
# `.c-acts` row, and the two `.c-sec` sections follow. The retired `Presentation` section — a second editor
# of what the door already does — is gone, so the law is the order of what the Card really reads.
conformance_ok 'a Scene subject Card is ordered identity → Present this → Used in Experience → the two doors' \
  "$(qa_jsv 'JSON.stringify((()=>{const at=e=>e.classList.contains("c-head")?"identity":e.querySelector("[data-act=exp-create-this]")?"Present this":e.classList.contains("c-sec")?e.textContent.trim().split(" · ")[0]:null;return [...document.querySelector("#card").children].map(at).filter(Boolean);})())')" \
  '["identity","Present this","Used in Experience","Behavior"]'
conformance_ok 'no capability control is at rest on a Scene subject Card' "$(qa_js '(!document.querySelector("#card [data-exp-audition]")&&!document.querySelector("#card [data-act=exp-use]")&&!document.querySelector("#card [data-act=exp-use-scope]")&&!document.querySelector("#card [data-act=exp-audition]")&&!!document.querySelector("#card [data-act=exp-add-behavior]")&&!!document.querySelector("#card [data-act=exp-add-interaction]"))')" true
# The door itself: opening it is a session choice that operates nothing, and what it offers is exactly what
# the provider declares — the machine declares casing and rotor plus the two local effects every subject has.
click '#card [data-act=exp-add-behavior]'
conformance_ok 'the behavior door opens a chooser over the declared descriptors and operates nothing' \
  "$(qa_jsv 'JSON.stringify((()=>{const c=document.querySelector("#card [data-exp-chooser]"),rows=[...document.querySelectorAll("#card [data-exp-choice]")].map(e=>e.dataset.expChoice);return [!!c,rows.join(","),!document.querySelector("#card [data-exp-audition]"),!document.querySelector("#card [data-act=exp-use]"),!!c&&!!c.querySelector("[data-act=exp-choose-cancel]")];})())')" \
  '[true,"casing,rotor,highlight,visibility",true,true,true]'
click '#card [data-act=exp-choose-cancel]'
conformance_ok 'Cancel closes the chooser, leaving nothing operated and nothing written' "$(qa_js '(!document.querySelector("#card [data-exp-chooser]")&&!document.querySelector("#card [data-exp-audition]")&&!document.querySelector("#card [data-exp-invoked]"))') / $(source_hash) / $(undo)" "true / $before / $count"
# A Presentation is never the current selection while a Scene subject is: the derived rows are references,
# and neither they nor the Index carry the selection treatment.
conformance_ok 'no Presentation looks selected while a Scene subject is' "$(qa_js '(__me.S.sel==="machine"&&!document.querySelector("#card .exp-view.selected")&&!document.querySelector("#index .ix-row.selected")&&![...document.querySelectorAll("#card [data-exp-used]")].some(e=>e.matches(".selected,.on,[aria-current]")))')" true
# The derivation is read from existing references and read-only: the Presentation that focuses this
# subject is listed as a reference to its owner, and opening that row is the same selection the Index makes.
conformance_ok 'the derivation lists the Presentation focusing this subject as a reference to its owner' \
  "$(qa_jsv 'JSON.stringify((()=>{const rows=[...document.querySelectorAll("#card [data-exp-used-in] [data-exp-used=presentation]")];return [rows.length>0,rows.every(r=>r.querySelector("button").dataset.act==="exp-open"),rows.some(r=>r.dataset.id===__me.S.experienceContext.presentation)];})())')" \
  '[true,true,true]'
conformance_ok 'reading that derivation selects nothing and writes nothing' "$(qa_js '__me.S.sel') / $(source_hash) / $(undo)" "\"machine\" / $before / $count"
click '#card [data-exp-used-in] [data-exp-used=presentation] button'
conformance_ok '…and the row opens its owner: that Presentation is the selection, not a second editor' "$(qa_js '__me.S.sel') / $(qa_js 'document.querySelector("#card .c-k").textContent.includes("Presentation")')" "\"$pid_now\" / true"
click '#card [data-exp-focus-subject="machine"]'
before="$(source_hash)"; count="$(undo)"; views="$(qa_js 'Object.keys(__me.ctx.cameraSource.views).length')"
qa_subject_invoke casing
conformance_ok 'the subject door and the descriptor chooser write nothing on their way to the operation' "$(source_hash) / $(undo)" "$before / $count"
fill '[data-exp-audition="casing"]' '0.6'
conformance_ok 'operating the subject auditions on the real Stage without source or history' "$(qa_jsv 'JSON.stringify(__me.S.expAudition)')" '{"machine":{"open":0.6}}'
conformance_ok '…and the audition writes no source and no history' "$(source_hash) / $(undo)" "$before / $count"
conformance_ok 'the audition is stated as a temporary projection' "$(qa_js 'document.querySelector("#card").textContent.includes("Temporary projection")')" true
# Outside Preview there is no visitor runtime: a real session clock must turn a running audition so the
# effect is visible, and stopping drops the phase again — still with no source or history.
qa_subject_invoke rotor
click '#card [data-act="exp-audition"][data-cap="rotor"][data-value="true"]'
conformance_ok 'an auditioned running capability advances on a session clock outside Preview' "$(qa_js '(async()=>{const rot=()=>__me.ctx.stage.items.get("machine").capabilityParts.rotor.rotation.y;await __me.qa.render();const a=rot();await new Promise(r=>setTimeout(r,60));await __me.qa.render();return __me.S.expAudition.machine.running===true&&a>=0&&rot()>a;})()')" true
conformance_ok '…with source and history still untouched' "$(source_hash) / $(undo)" "$before / $count"
click '#card [data-act="exp-audition"][data-cap="rotor"][data-value="false"]'
conformance_ok 'stopping the audition drops the phase' "$(qa_js '(__me.S.expAudition.machine.running===false&&__me.ctx.stage.items.get("machine").capabilityParts.rotor.rotation.y===0)')" true
qa_subject_invoke casing
click '#card [data-act="exp-use"][data-cap="casing"]'
conformance_ok 'Use in this Presentation captures one Activity holding the auditioned value' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,us=Object.values(e.uses).filter(u=>!u.viewId&&e.definitions[u.definitionId]?.kind==="control"),d=us[0]&&e.definitions[us[0].definitionId];return us.length===1&&us[0].presentationId===pid&&d.subjectId==="machine"&&d.capabilityId==="casing"&&d.value===0.6&&e.guide.length===0&&Object.keys(e.stops).length===0;})()')" true
conformance_ok 'the Activity capture writes one history step and creates no Camera View of its own' "$(undo) / $(qa_js 'Object.keys(__me.ctx.cameraSource.views).length')" "$((count+1)) / $views"
fill '[data-exp-audition="casing"]' '0.9'
click '#card [data-act="exp-use"][data-cap="casing"]'
conformance_ok 'updating the captured value reuses that Activity and never duplicates it' "$(qa_js '(()=>{const e=__me.ctx.experience,us=Object.values(e.uses).filter(u=>!u.viewId&&e.definitions[u.definitionId]?.kind==="control");return us.length===1&&e.definitions[us[0].definitionId].value===0.9&&document.querySelector("#card").textContent.includes("Captured in this Presentation");})()')" true
pid="$(qa_jsv '__me.S.experienceContext.presentation')"
click "#index [data-act=\"exp-open\"][data-id=\"$pid\"]"
# UX2: the Presentation's ordinary Card carries identity, its Views and one explanation door. The captured
# Activity is not an ordinary field, so it reads in the one Advanced authoring home — still by what it
# operates, where it belongs and how it starts, opened from the Card rather than by a positional details.
click '#card [data-act="exp-advanced"]'
conformance_ok 'Advanced authoring lists the captured Activity by what it operates, where and how it starts' "$(qa_js '(()=>{const t=document.querySelector("#card [data-exp-advanced-home]").textContent;return t.includes("Open casing")&&t.includes("Machine")&&t.includes("in Why the drive matters")&&t.includes("Starts on Presentation entry");})()')" true
# Open the Activity through its real, scroll-reachable contribution row.
click '#card [data-exp-advanced-home] .contribution [data-act="pres-ref"]'
conformance_ok 'the captured Activity reads as an honest identity, never a schema term' "$(qa_js 'document.querySelector("#card .c-k").textContent.includes("Activity")+"|"+(document.querySelector("#card").textContent.includes("Operates Machine · Open casing"))')" '"true|true"'
click "#index [data-act=\"exp-open\"][data-id=\"$pid\"]"
# UX2: the accepted no-View Presentation is reached the way an author reaches it — Remove from
# Presentation unlinks the use — and the unlink is proven here rather than assumed: one history step, the
# Default left unset with no replacement picked, and the Camera framing kept as Camera truth for every
# other use. Nothing is destroyed to prove a View is optional.
click '#card [data-exp-views] [data-exp-view-use]'
conformance_ok 'selecting a View opens the View’s own Card, never the Presentation’s' "$(qa_js 'document.querySelector("#card .c-k").textContent.includes("View")&&__me.S.sel!==__me.S.experienceContext.presentation')" true
before="$(source_hash)"; count="$(undo)"; camera_views="$(qa_js 'Object.keys(__me.ctx.cameraSource.views).length')"
# §3.10: the bounded unlink states what it will leave behind before it happens, and says what it left
# behind once it has. Both are read from the product's own words on the Card and in the status rail: while
# the door is still there the Card's line names the one use it unlinks, the Camera framing it keeps for
# every other use and the Stop entry it leaves repairable, and the status rail then names the Default's
# fate once the unlink has happened (asserted next).
conformance_ok 'the removal states what it leaves behind before it happens' \
  "$(qa_js '(()=>{const t=document.querySelector("#card [data-view-consequences]")?.textContent||"";return t.includes("unlinks this use only")&&t.includes("Camera framing is kept")&&t.includes("no replacement Default is chosen")&&t.includes("repairable missing entry")&&!!document.querySelector("#card [data-act=exp-remove-view]");})()')" true
click '#card [data-act="exp-remove-view"]'
conformance_ok '…and the status names what the unlink left: the Default unset, the Camera framing kept' \
  "$(qa_js '(/Camera framing kept/.test(__me.S.status.text)&&/the Default is now unset/.test(__me.S.status.text))')" true
conformance_ok 'Remove from Presentation unlinks one use in one history step' "$(undo)" "$((count+1))"
conformance_ok '…leaving the Default unset, no replacement chosen and the Camera framing intact' "$(qa_jsv "JSON.stringify((__me.ctx.experience.presentations['$pid']||{uses:[]}).uses)") / $(qa_js 'Object.keys(__me.ctx.cameraSource.views).length')" "[] / $camera_views"
click "#index [data-act=\"exp-open\"][data-id=\"$pid\"]"
before="$(source_hash)";standpoint="$(pose)"
qa_preview_presentation
conformance_ok 'no-Guide/no-View Preview runs the authored explanation and captured capability' "$(qa_js "(()=>{const e=__me.ctx.experience,p=e.presentations['$pid'];return !!__me.S.visitor&&__me.S.visitor.runtime.stopId===null&&!!p&&p.uses.map(id=>e.uses[id]).filter(u=>u.viewId).length===0&&!!__me.S.visitor.runtime.overrides.machine?.open&&Object.values(__me.S.visitor.runtime.activities).some(a=>a.status==='running');})()") / $(source_hash)" "true / $before"
conformance_ok 'the visitor caption speaks the explanation typed through the real control' "$(qa_js 'document.querySelector(".visitor-caption").textContent.includes("A casing, a rotor")')" true
click '[data-act="exp-exit-preview"]'
conformance_ok 'no-View Preview restores complete standpoint' "$(pose)" "$standpoint"
before="$(source_hash)"; count="$(undo)"
click '#card [data-act="exp-auto"]'
conformance_ok 'Auto is derived intent, with no source/history change' "$(source_hash) / $(undo)" "$before / $count"
# UX2: the recommended framing is asked for in the Views section of the Card that offers it, and the
# derived suggestions it arms appear in that same Card. There is no Framing Hints Stage toolbar any more;
# Capture is the same ordinary `+ Capture view`, and it is what accepts a recommendation. Accepting one
# selects the View it authored, so the author returns to the Presentation to ask for the next.
click '#card [data-act="exp-auto"]'
click '[data-exp-hints] [data-act="exp-derived-hint"][data-hint="Left"]'
conformance_ok 'a derived suggestion is offered in the Card and re-derives intent, not source' "$(source_hash) / $(qa_js '(__me.S.derivedView?.name||"")')" "$before / \"Left of focus\""
click '#card [data-act="exp-capture"]'
click "#index [data-act=\"exp-open\"][data-id=\"$pid\"]"
click '#card [data-act="exp-auto"]'
click '[data-exp-hints] [data-act="exp-derived-hint"][data-hint="Right"]'
click '#card [data-act="exp-capture"]'
click "#index [data-act=\"exp-open\"][data-id=\"$pid\"]"
click '#card [data-act="exp-bring"]'
conformance_ok 'QA-1 visible working Set, quiet Card, no Guide/graph/rig' "$(qa_js "(document.querySelectorAll('[data-exp-view]').length===2&&[...document.querySelectorAll('[data-exp-view]')].every($visible)&&!document.querySelector('#experienceDeck')&&!document.querySelector('[data-frame-gate]')&&__me.ctx.experience.guide.length===0&&Object.keys(__me.ctx.cameraSource.connections).length===0&&document.querySelectorAll('#card .verb').length===0)")" true
capture qa-1-ordinary
conformance_ok 'Set markers are actual hit targets' "$(qa_js "[...document.querySelectorAll('[data-exp-view]')].every($hit)")" true
# The constellation's own law (§0.8.1, spatial-instrument grammar): compact named markers around the
# focus, each carrying *its own direction*, and no metric claim — so no marker stands at a projected
# standpoint, no leader joins one reading to another, and nothing here implies a View order. The direction
# is still a rendered fact and not part of the name: each glyph is its own element, visible, and its centre
# addresses the glyph itself rather than the identity plate. UX2 review: projecting the eye and joining it
# to the compressed marker drew a screen length between two different readings.
conformance_ok 'each View marker carries its own visible direction glyph, drawn with it and not in the plate' \
  "$(qa_js '(document.querySelectorAll("[data-view-direction]").length===2&&document.querySelectorAll(".exp-view-pin").length===2&&[...document.querySelectorAll("[data-view-direction]")].every(e=>{const r=e.getBoundingClientRect(),at=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width*r.height>30&&!at?.closest("[data-exp-view]");}))')" true
conformance_ok 'each glyph is drawn beside its own marker, not at a projected standpoint' \
  "$(qa_js '(()=>{const pins=[...document.querySelectorAll(".exp-view-pin")].map(p=>p.getBoundingClientRect()).sort((a,b)=>a.top-b.top);const gl=[...document.querySelectorAll("[data-view-direction]")].map(g=>g.getBoundingClientRect()).sort((a,b)=>a.top-b.top);return pins.length===gl.length&&pins.every((p,i)=>{const g=gl[i];return Math.abs((p.x+p.width/2)-(g.x+g.width/2))<24&&g.top>=p.top-1&&g.top<=p.bottom+44;});})()')" true
conformance_ok 'the constellation makes no metric claim: no standpoint glyph, no leader, no origin square' \
  "$(qa_js '(!document.querySelector(".exp-leader")&&!document.querySelector(".exp-view-origin")&&!document.querySelector("[data-view-order]")&&!document.querySelector(".exp-route-path"))')" true
# The Presentation this block re-focuses is opened the way an author opens it — from its Index row, and
# only here, at the end of the QA-1 journey: re-focusing a Presentation on its environment is a real
# change of what it presents, so nothing downstream may still depend on it naming the machine subject.
click '#index [data-act=exp-open]'
# §7 QA 3 asks for exactly one creation entry, and UX2 consolidated the retired `Present environment` and
# `Present region` rows into the Card's own Change focus menu. A capability that moved has to stay
# reachable, so both are exercised here on the real controls: each re-focuses *this* Presentation rather
# than creating a second one, and the environment focus is one history step.
conformance_ok 'the Index offers exactly one creation entry, with no second presenter beside it' \
  "$(qa_js '[...document.querySelectorAll("#index [data-act]")].map((b) => b.dataset.act).filter((a) => a === "exp-create" || a?.startsWith("exp-environment") || a?.startsWith("exp-region")).join(",")')" \
  '"exp-create"'
focus_pid="$(qa_jsv '__me.S.experienceContext.presentation')"
focus_pres="$(qa_js 'Object.keys(__me.ctx.experience.presentations).length')"
focus_undo="$(undo)"
qa_card_door '#card [data-exp-menu=focus]'
conformance_ok 'the Presentation offers the retired environment and region presenters as focus operations on itself' \
  "$(qa_js '(()=>{const d=document.querySelector("#card [data-exp-menu=focus]");return !!d&&!!d.querySelector("[data-act=exp-focus-environment]")&&!!d.querySelector("[data-act=exp-focus-region]");})()')" true
click '#card [data-act="exp-focus-environment"]'
conformance_ok 'focusing this environment re-focuses that Presentation in one history step and creates no second one' \
  "$(qa_jsv "JSON.stringify([Object.keys(__me.ctx.experience.presentations).length, __me.ctx.experience.presentations['$focus_pid'].focus])") / $(undo)" \
  "[$focus_pres,{\"kind\":\"environment\"}] / $((focus_undo+1))"
qa_card_door '#card [data-exp-menu=focus]'
click '#card [data-act="exp-focus-region"]'
conformance_ok 'focusing a region opens the existing region work on that Presentation, still without a second one' \
  "$(qa_js "(__me.S.task?.kind==='experience-region'&&__me.S.task.params.presentation==='$focus_pid'&&Object.keys(__me.ctx.experience.presentations).length===$focus_pres)")" true
qa_press Escape
qa_frames
conformance_ok '…and cancelling leaves that Presentation focusing its environment, with nothing written' \
  "$(qa_js "(!__me.S.task&&Object.keys(__me.ctx.experience.presentations).length===$focus_pres&&__me.ctx.experience.presentations['$focus_pid'].focus.kind==='environment')")" true
checkpoint ordinary
set_ids="$(qa_js '[...document.querySelectorAll("[data-exp-view]")].map(e=>e.dataset.id).sort()')";before="$(source_hash)"
click '.stage-tools [data-act="plan"]'
conformance_ok 'Plan shows the same unordered Set without authored edits' "$(qa_js '[...document.querySelectorAll("[data-exp-view]")].map(e=>e.dataset.id).sort()') / $(source_hash)" "$set_ids / $before"
capture qa-1-plan
click '.stage-tools [data-act="3d"]'
click '#card [data-act="exp-bring"]'
conformance_ok '3D returns the same Set through explicit navigation' "$(qa_js '[...document.querySelectorAll("[data-exp-view]")].map(e=>e.dataset.id).sort()') / $(source_hash)" "$set_ids / $before"
qa_preview_presentation
conformance_ok 'visitor removes and deactivates every authoring instrument' "$(qa_js '(__me.S.task===null&&!document.querySelector("[data-exp-camera]")&&getComputedStyle(document.querySelector("#ovHtml")).display==="none")')" true
click '[data-act="exp-exit-preview"]'
click '#card [data-act="exp-add-guide"]'
conformance_ok 'first Stop gives Peek only' "$(qa_js '(__me.S.experienceContext.depth==="ordinary"&&document.querySelector("#experienceDeck").classList.contains("ordinary"))')" true
capture qa-1-peek
# QA-2/3: authored stress fixture has no active procedure or standpoint recipe.
# Selection never silently retargets a replaced Experience identity: the loader invalidates it before
# the deterministic fixture identities are reissued. World context survives the same load.
fixture exp-conformance
conformance_ok 'fixture never selects or opens work, and a replaced Experience selection is invalidated, never retargeted' "$(qa_js '__me.S.sel') / $(qa_js '(__me.S.experienceContext.depth==="ordinary"&&__me.ctx.experience.guide.length===6&&__me.S.task===null)')" 'null / true'
qa_locator_select machine
fixture exp-conformance
conformance_ok 'a World subject selection survives the same labelled load' "$(qa_js '__me.S.sel')" '"machine"'
# Ambiguous captures: two matching Activities in one Presentation. The choice is real product UI;
# Escape drops it whole, and Capture another is an explicit create that touches neither existing value.
click '#index [data-act="exp-open"][data-id="presentation-1"]'
# UX2: a behavior or offer is authored in the one Advanced authoring home, reached from the Card; the
# offer draft, its kind and its acceptance are the same writers the Card reached before.
click '#card [data-act="exp-advanced"]'
click '#card [data-exp-advanced-home] [data-act="exp-offer"]'
agent-browser select '[data-exp-offer="kind"]' behavior >/dev/null;qa_frames
fill '[data-exp-offer="value"]' '1'
click '#card [data-act="exp-offer-accept"]'
qa_locator_select machine
qa_subject_invoke casing
click '#card [data-act="exp-use"][data-cap="casing"]'
conformance_ok 'two matching captures ask which Activity to update, never mutating either' "$(qa_js '(()=>{const e=__me.ctx.experience,a=__me.S.expCaptureAsk,pid=__me.S.experienceContext.presentation,us=Object.values(e.uses).filter(u=>!u.viewId&&u.presentationId===pid&&e.definitions[u.definitionId]?.capabilityId==="casing");return !!a&&a.matches.length===2&&us.length===2&&us.every(u=>e.definitions[u.definitionId].value===1);})()')" true
qa_press Escape
conformance_ok 'Escape drops the ambiguous proposal with its audition: no stale choice survives' "$(qa_js '(__me.S.expCaptureAsk===null&&__me.S.expAudition===null)')" true
# Escape dropped the invoked operation with the ambiguous proposal, so the door is walked again.
qa_subject_invoke casing
click '#card [data-act="exp-use"][data-cap="casing"]'
count="$(undo)"; views="$(qa_js 'Object.keys(__me.ctx.cameraSource.views).length')"
click '#card [data-act="exp-capture-new"]'
conformance_ok 'Capture another creates a third Activity and leaves both existing values untouched' "$(qa_js '(()=>{const e=__me.ctx.experience,us=Object.values(e.uses).filter(u=>!u.viewId&&e.definitions[u.definitionId]?.capabilityId==="casing");return us.length===3&&us.filter(u=>e.definitions[u.definitionId].value===1).length===2&&__me.S.expCaptureAsk===null;})()')" true
conformance_ok 'Capture another writes one history step and creates no Camera View' "$(undo) / $(qa_js 'Object.keys(__me.ctx.cameraSource.views).length')" "$((count+1)) / $views"
# A visitor offer is authored through the real subject control and stays an offer: subject-activated
# availability work, never an automatic Activity a traversal could start.
qa_locator_select piano
# UX3: the subject's own offer door opens the same draft with this subject as target and activation.
click '#card [data-act="exp-add-interaction"]'
click '#card [data-act="exp-offer-accept"]'
offer="$(qa_jsv 'Object.values(__me.ctx.experience.uses).find(u=>u.kind==="interaction")?.id')"
conformance_ok 'a visitor offer is authored as an offer, never as automatic work' "$(qa_js "(()=>{const u=__me.ctx.experience.uses['$offer'];return !!u&&u.kind==='interaction'&&u.triggerSubjectId==='piano'&&u.start.kind==='visit'&&!u.viewId;})()")" true
click '#index [data-act="exp-open"][data-id="presentation-1"]'
click '#experienceDeck [data-act="exp-guide"]'
click '[data-act="plan"]'
# Explicit useful framing; opening overview itself is neutral.
# Bring into view stays a product control on the stable Card.
click '#card [data-act="exp-bring"]'
conformance_ok 'QA-2 six distinct reachable pins, L0/L1, no Set or graph' "$(qa_js '(()=>{const a=[...document.querySelectorAll(".exp-stop-pin")];return !!(a.length===6&&a.every(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&getComputedStyle(e).visibility!=="hidden"&&(hit===e||e.contains(hit));})&&a.every((e,i)=>a.every((f,j)=>i===j||Math.hypot(e.getBoundingClientRect().x-f.getBoundingClientRect().x,e.getBoundingClientRect().y-f.getBoundingClientRect().y)>12))&&!document.querySelector("[data-exp-view]")&&!document.querySelector("[data-exp-route]")&&document.querySelectorAll(".gd-stop-card").length===6&&document.querySelectorAll(".gd-stop-card.compact").length===6&&document.querySelectorAll(".gd-edge").length>=5&&!document.querySelector(".set-constellation")&&__me.nav.plainPose().flat>.97);})()')" true
# UX4: the Overview L2 thumbnail strip is retired. The one Guide home is the Deck's lane, and every Stop
# is a named chip with its own continuation chip.
conformance_ok 'Overview owns shell breadth beneath Index and Card, with the one Guide lane naming every Stop' "$(qa_js '(()=>{const r=document.querySelector("#experienceDeck").getBoundingClientRect(),stage=document.querySelector("#stage").getBoundingClientRect();return r.left<stage.left&&r.right>stage.right&&r.width>innerWidth*.95&&!!document.querySelector("#index [data-act=exp-guide]")&&document.querySelectorAll(".gd-stop-card").length===6&&[...document.querySelectorAll(".gd-stop-card .peek-stop")].length===6&&!document.querySelector(".stop-thumbnail");})()')" true
capture qa-2-overview
checkpoint overview
standpoint="$(pose)";camera="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')"
# All six identities are independently reachable from their real Stage pins and Deck cards.
for position in 0 1 2 3 4 5;do
 id="$(qa_jsv "__me.ctx.experience.guide[$position]")"
 click ".exp-stop-pin[data-id='$id']"
 conformance_ok "Stage pin selects occurrence $((position+1)) distinctly" "$(qa_js '__me.S.sel')" "\"$id\""
 click '#experienceDeck [data-act="exp-close"]'
 click '#experienceDeck [data-act="exp-guide"]'
 click ".stop-card[data-stop='$id'] [data-act='exp-stop']"
 conformance_ok "Deck selects that same occurrence $((position+1))" "$(qa_js '__me.S.sel')" "\"$id\""
 click '#experienceDeck [data-act="exp-close"]'
 click '#experienceDeck [data-act="exp-guide"]'
done
conformance_ok 'occurrence selection/disclosure preserves realized Camera and Camera source' "$(pose) / $(qa_js 'JSON.stringify(__me.ctx.cameraSource)')" "$standpoint / $camera"
capture qa-2-selected
stop="$(qa_jsv '__me.ctx.experience.guide[3]')"
# §5.4/§5.8: Expand and Peek are retired — the chip carries no detail control of its own, and selecting a
# chip is L1: the chip is marked, the Card reads Entry/Next, and no detail opens.
click ".stop-card[data-stop='$stop'] [data-act='exp-stop']"
conformance_ok 'selecting a chip reads its Stop Card, with no Expand left in the Deck' "$(qa_js "(!!document.querySelector('#card [data-stop-entry]')&&!document.querySelector('.gd-stop-card.expanded')&&!document.querySelector('[data-act=exp-expand-stop]')&&!document.querySelector('.set-node')&&!document.querySelector('.gd-stop-card input'))")" true
conformance_ok 'all six occurrence chips stay readable and reachable at 1440×900' "$(qa_js "[...document.querySelectorAll('.stop-card [data-act=exp-stop]')].every(e=>($visible)(e)&&($hit)(e))")" true
capture qa-3-occurrence
# Both Set projections select the same canonical use without navigating or mutating Camera.
uid="$(qa_jsv '__me.ctx.experience.presentations[__me.S.experienceContext.presentation].uses[1]')"
standpoint="$(pose)";before="$(source_hash)"
# UX4: a View use is selected from the shared Presentation's own Views list (the Stop Card's retired L2
# Set is gone), without navigating or editing Camera source.
click '#card [data-act="exp-open"]'
click "#card [data-exp-views] [data-exp-view-use='$uid']"
conformance_ok 'the Presentation Views list selects the canonical View use without navigation/source edit' "$(qa_js '__me.S.sel') / $(pose) / $(source_hash)" "\"$uid\" / $standpoint / $before"
click ".stop-card[data-stop='$stop'] [data-act='exp-stop']"
# §5.3: the Stage draws a Presentation's View constellation while one of its Stops is the selection in
# ordinary depth, so the Guide band is left first — neither the selection nor the Camera moves.
qa_js '(() => { const b = document.querySelector("#experienceDeck [data-act=exp-close]"); if (b) b.click(); return true; })()' >/dev/null
qa_frames
click "[data-exp-view][data-id='$uid']"
conformance_ok 'spatial Set selects the same canonical use' "$(qa_js '__me.S.sel') / $(pose)" "\"$uid\" / $standpoint"
count="$(undo)"
# UX2: one Default is written by one ordinary control, Set as Default, and it goes through the same
# shared-use writer the role pair used — so every Stop that enters through this View is disclosed first.
click '#card [data-act="exp-default"]'
conformance_ok 'shared Set role change asks before source/history changes' "$(qa_js '(!!__me.S.expSourceAsk)') / $(source_hash) / $(undo)" "true / $before / $count"
click '[data-act="exp-source-cancel"]'
# §7 QA 3: Set as Default leaves Guide order, Camera routes and Stop overrides intact. The proposal is
# accepted here — the cancel above already proved nothing is written without it — and the whole change is
# the one history step the ask promised. A Stop's entry record is read as what it is: the default
# presentation entry, or the explicit override the local-entry block below and the reconciliation axis
# author and re-read.
role_state='JSON.stringify({guide:__me.ctx.experience.guide,connections:Object.keys(__me.ctx.cameraSource.connections),entries:Object.values(__me.ctx.experience.stops).map((s)=>s.entry),defaults:(()=>{const e=__me.ctx.experience,p=e.presentations[__me.S.experienceContext.presentation];return p?p.uses.filter((id)=>e.uses[id]?.role==="entry"):[]})()})'
strip_defaults(){ python3 -c 'import json,sys; d=json.loads(sys.argv[1]); d.pop("defaults",None); print(json.dumps(d,sort_keys=True))' "$1"; }
only_default(){ python3 -c 'import json,sys; print(json.dumps(json.loads(sys.argv[1])["defaults"]))' "$1"; }
role_before="$(qa_jsv "$role_state")"
click '#card [data-act="exp-default"]'
click '[data-act="exp-source-accept"]'
role_after="$(qa_jsv "$role_state")"
conformance_ok 'accepting it leaves Guide order, Camera routes and every Stop entry record byte-identical' "$(strip_defaults "$role_after")" "$(strip_defaults "$role_before")"
conformance_ok '…and the one ★ Default is the View that asked for it, in one history step' "$(only_default "$role_after") / $(undo)" "[\"$uid\"] / $((count+1))"
click '#undoBtn'
conformance_ok 'Undo restores the former Default and the same untouched Guide, routes and Stop entries' "$(only_default "$(qa_jsv "$role_state")") / $(strip_defaults "$(qa_jsv "$role_state")")" "$(only_default "$role_before") / $(strip_defaults "$role_before")"
click ".stop-card[data-stop='$stop'] [data-act='exp-stop']"
# §5.4: the Stop Card's own shared-Meaning editor is retired — Meaning is edited from its Presentation. The
# recipe reaches the same shared summary through the Presentation's own door on the Stop Card, opens its
# Advanced authoring home, and returns to the Stop for the occurrence-local entry further down.
click '#card [data-stop-reach] [data-act="exp-open"]'
qa_card_advanced
before="$(source_hash)"; count="$(undo)"
fill '[data-exp-field="meaning"]' 'Shared meaning proposed through the product.'
conformance_ok 'shared Meaning asks before source/history changes' "$(qa_js '(!!__me.S.expSourceAsk&&document.querySelector(".ask-rule").textContent.includes("Stop 6"))') / $(source_hash) / $(undo)" "true / $before / $count"
capture qa-3-scope
checkpoint shared
click '[data-act="exp-source-cancel"]'
conformance_ok 'Cancel writes zero history' "$(source_hash) / $(undo)" "$before / $count"
fill '[data-exp-field="meaning"]' 'Power travels through the protected rotor.'
click '[data-act="exp-source-accept"]'
conformance_ok 'accepted shared edit is one history step' "$(undo)" "$((count+1))"
# Back on the Stop itself: the entry below is occurrence-local, not the Presentation's.
click ".stop-card[data-stop='$stop'] [data-act='exp-stop']"
# Entry belongs to this occurrence; selecting another shared View changes no Camera source.
local_entry="$(qa_jsv '__me.ctx.experience.presentations[__me.S.experienceContext.presentation].uses[1]')"
camera="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')"
agent-browser select '[data-exp-entry]' "$local_entry" >/dev/null;qa_frames
conformance_ok 'local Stop entry leaves the shared Set and Camera source intact' "$(qa_js 'JSON.stringify(__me.ctx.cameraSource)') / $(qa_js "(__me.ctx.experience.stops['$stop'].entry.useId==='$local_entry'&&__me.ctx.experience.stops[__me.ctx.experience.guide[5]].entry.kind==='presentation')")" "$camera / true"
click '#undoBtn'
# QA-4: open adjacent Seam while 3D, then explicitly author Travel and useful Plan.
# §5.4: the Stop Card carries exactly one disclosure — its own occurrence detail, reached through
# `.stop-details`, whose direct `<details>` child is `[data-exp-stop-detail]`. The retired Card menu (and
# the shared-Meaning section behind it) is gone, so the recipe opens the detail it still has.
click '#card [data-exp-stop-detail] > summary'
click '[data-act="3d"]'
standpoint="$(pose)"
to="$(qa_jsv '__me.ctx.experience.guide[4]')"
click "[data-act='exp-seam'][data-from='$stop'][data-to='$to']"
conformance_ok 'opening Seam does not move realized Camera' "$(pose)" "$standpoint"
# N1: one explicit Travel preparation transaction authors the whole directed Seam graph. Every
# legitimate origin is left supported — an origin already at the destination View by Camera's own
# zero-distance evaluation, a reused authored route, or one newly created direct connection — and no
# origin is left as a gap. Nothing here was connected per origin by the author.
click '[data-act="exp-travel"]'
qa_frames
route="$(qa_jsv '[...document.querySelectorAll("[data-exp-route]")][0].dataset.expRoute')"
conformance_ok 'explicit Travel supports every legitimate origin in one authored step' "$(qa_js "(document.querySelector('#card [data-edge-coverage]').textContent.includes('Reachable from 3 of 3')&&document.querySelector('#card').textContent.includes('All origins supported'))")" 'true'
conformance_ok 'Travel leaves no origin as a gap and offers no per-origin surgery' "$(qa_js "(!document.querySelector('[data-exp-gap]')&&!document.querySelector('[data-act=exp-prepare]'))")" 'true'
conformance_ok 'Travel reports prepared versus reused support with the Camera owner' "$(qa_js "(/Prepared [0-9]+ Camera route/.test(__me.S.status.text)&&/Camera owns route geometry/.test(__me.S.status.text))")" 'true'
conformance_ok 'one Travel preparation is one aggregate Undo step' "$(qa_js "__me.S.undo.at(-1).label==='Prepare Camera routes and select Travel'")" 'true'
standpoint="$(pose)"
click "[data-act='exp-route'][data-id='$route']"
# §5.5: opening the Path posture keeps the author's standpoint — only the framing goes, and it goes with the
# author's own `Bring route into view`. The Index home holds the crumb, the switch and the From list, and
# `+ Path point` is a Stage instrument: the only creation path, so a plain Stage press still adds nothing.
conformance_ok 'entering the Path posture keeps the authoring standpoint' "$(pose)" "$standpoint"
click '#card [data-act=exp-bring]'
qa_frames
conformance_ok 'Bring route into view is the explicit framing, to Plan, with the crumb back to the edge' "$(qa_js '(__me.nav.plainPose().flat>.97&&!!document.querySelector("#index [data-act=exp-route-return]"))')" true
conformance_ok 'the Path posture is one Camera home with an armed-only point insertion' "$(qa_js '(document.querySelector("#card .c-k").textContent.includes("Camera Path")&&document.querySelector("[data-path-lane]")&&!!document.querySelector("#index [data-path-from]")&&!!document.querySelector("#pathInstrument [data-act=exp-path-point]")&&__me.S.experienceContext.armed===false)')" true
p="$(qa_jsv '(()=>{const r=document.querySelector("#gl").getBoundingClientRect();return Math.round(r.x+r.width*.53)+","+Math.round(r.y+r.height*.38)})()')"
qa_move "${p%,*}" "${p#*,}"; qa_down; qa_up; qa_frames
conformance_ok 'an unarmed Stage press adds no path point' "$(qa_js '__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors.length')" '0'
# §3.1: that press is still the shell's own click, so a pick under it is an outside selection and puts the
# reading away. The posture is re-entered through the edge's own door, on the same route, before the author
# arms the insertion — the law above is about the press, never about the posture surviving it.
click '#experienceDeck [data-act="exp-guide"]'
click "[data-act='exp-seam'][data-from='$stop'][data-to='$to']"
click '#card [data-act="exp-route"]'
qa_frames
click "#index [data-path-from] [data-act='exp-route'][data-id='$route']"
qa_frames
click '#pathInstrument [data-act="exp-path-point"]'
qa_frames
# Add a real observer anchor with pointer, away from panels and endpoint controls.
qa_move "${p%,*}" "${p#*,}"; qa_down; qa_up; qa_frames
conformance_ok 'QA-4 actual Plan Camera graph, full support, endpoints, anchor and pace' "$(qa_js "(__me.nav.plainPose().flat>.97&&document.querySelectorAll('[data-exp-route]').length===3&&!document.querySelector('[data-exp-gap]')&&document.querySelectorAll('[data-endpoint=origin]').length===3&&document.querySelector('[data-endpoint=destination]')&&document.querySelector('[data-exp-anchor]')&&document.querySelector('[data-exp-pace]')&&!document.querySelector('.station-projection')&&[...document.querySelectorAll('[data-endpoint]')].every($visible))")" true
conformance_ok 'Stage route samples exactly consume the Camera evaluator and remain above the Deck' "$(qa_js '(()=>{const stage=document.querySelector("#stage").getBoundingClientRect(),bottom=document.querySelector("#experienceDeck").getBoundingClientRect().top-stage.top;return [...document.querySelectorAll("[data-exp-route]")].every(el=>{const r=__me.nav.routeGeometry(__me.nav.resolvedCamera(),el.dataset.expRoute),numbers=el.getAttribute("d").match(/-?\d+(?:\.\d+)?/g).map(Number);return numbers.length===82&&r.samples.every((s,i)=>{const p=__me.ctx.stage.project(s.observer);return Math.abs(numbers[i*2]-p.x)<.06&&Math.abs(numbers[i*2+1]-p.y)<.06&&p.x>0&&p.x<stage.width&&p.y>0&&p.y<bottom;});})&&!document.querySelector("[data-endpoint][data-exp-anchor]");})()')" true
capture qa-4-route
checkpoint route
anchor="$(qa_jsv '__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors[0]?.id')"
count="$(undo)"; before="$(source_hash)"
qa_drag "[data-exp-anchor=\"$anchor\"]" 25 10
conformance_ok 'one accepted observer-anchor drag is one Undo step' "$(undo)" "$((count+1))"
click '#undoBtn'
conformance_ok 'Undo restores route source' "$(source_hash)" "$before"
# Capture route immediately before Coordinate so the QA-4/5 pair proves unchanged spatial route.
capture qa-4-route
# §5.4/§5.5: the Path Card carries no cue-timing door any more — the Journey is reached from the edge Card
# and the Index's Path | Journey switch, and nothing about the standpoint or the Camera source moves.
conformance_ok 'the Path Card carries no cue-timing door: the Journey is the Index switch' "$(qa_js "(!!document.querySelector('#index [data-exp-posture-switch] [data-act=exp-coordinate]')&&!document.querySelector('#card [data-act=exp-coordinate]'))")" true
standpoint="$(pose)"; before="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')"
click '#index [data-exp-posture-switch] [data-act="exp-coordinate"]'
qa_frames
# §5.6: the station choice is the Journey Card's own select and `+ Cue` is what selects the new Cue; the
# Hold/Invoke writers live behind `Edit cue`, which is closed by default (§5.2.7).
agent-browser select '#card [data-exp-station]' "$anchor" >/dev/null;qa_frames
click '#card [data-act="exp-beat"]'
conformance_ok 'Edit cue is closed at rest and holds the writers once opened' "$(qa_js '(document.querySelector("#card [data-exp-cue-edit]").open===false)')" true
click '#card [data-exp-cue-edit] > summary'
qa_frames
contribution="$(qa_jsv 'Object.values(__me.ctx.experience.uses).find(u=>u.definitionId)?.id')"
agent-browser select '#card [data-exp-invoke-use]' "$contribution" >/dev/null;qa_frames
click '#card [data-act="exp-invoke-beat"]'
picker="$(qa_js "(()=>{const e=__me.ctx.experience,opts=[...document.querySelectorAll('#card [data-exp-invoke-use] option')].map(o=>o.value).filter(Boolean);return opts.includes('$contribution')&&!opts.includes('$offer')&&opts.every(id=>e.uses[id]&&!e.uses[id].viewId&&e.uses[id].kind!=='interaction');})()")"
conformance_ok 'the station picker offers automatic work only: the visitor offer is never traversal work' "$picker" true
binding="$(qa_js "(()=>{const e=__me.ctx.experience,x=__me.S.experienceContext,u=e.uses['$contribution'],seam=e.seams[x.seam.from+'>'+x.seam.to];return u.start.kind==='station'&&u.start.stationId==='$anchor'&&u.start.connectionId===__me.S.task.params.connection&&u.start.presentationId===e.stops[x.seam.to].presentationId&&seam.beats.filter(b=>b.kind==='invoke'&&b.useId==='$contribution').length===1;})()")"
conformance_ok 'invoking moves that Activity trigger to the station instead of adding a second trigger' "$binding" true
identity="$(qa_js '__me.S.sel')"
# §5.6: the Stage's Cue chip selects the same Cue its Deck marker shows, without replacing the canonical
# selection; the Card then reads that one Cue.
click "[data-exp-station-label='$anchor']"
conformance_ok 'the Stage Cue chip selects the Cue its Deck marker shows, without replacing canonical selection' "$(qa_js '__me.S.sel') / $(qa_js "(document.querySelector('.jd-cue.selected').dataset.id==='$anchor'&&document.querySelector('.exp-station.active').dataset.expStationLabel==='$anchor')")" "$identity / true"
conformance_ok 'QA-5 keeps exact QA-4 Camera source and realized standpoint' "$(pose) / $(qa_js 'JSON.stringify(__me.ctx.cameraSource)')" "$standpoint / $before"
conformance_ok 'QA-5 the Deck time axis and the Cue Card read the same Cue, with its own pause and actions' "$(qa_js '(()=>{const markers=[...document.querySelectorAll(".jd-cue")],spatial=[...document.querySelectorAll("[data-exp-station-label]")];return markers.length>=1&&markers.every(m=>spatial.some(s=>s.dataset.expStationLabel===m.dataset.id))&&!!document.querySelector(".jd-track")&&!!document.querySelector("[data-exp-playhead]")&&!!document.querySelector("#card [data-cue-at]")&&!!document.querySelector("#card [data-cue-pause]")&&!!document.querySelector("#card [data-cue-actions]");})()')" true
conformance_ok 'coordination preserves every supported origin identity and the destination' "$(qa_js "([...document.querySelectorAll('[data-endpoint]')].every(e=>($visible)(e)&&($hit)(e))&&!document.querySelector('[data-exp-gap]'))")" true
# §5.6: the C9 strip is retired from every Card. The Journey Card is the one home for a Cue, the Deck's ◆
# markers and the Stage's Cue chips are the projection, and an Activity whose trigger lives elsewhere says
# so on the Card rather than in a second dashboard.
conformance_ok 'the C9 strip is retired: the Journey Card is the one Cue home, inside one Card and one Deck' "$(qa_js '(()=>{const card=document.querySelector("#card"),deck=document.querySelector("#experienceDeck").getBoundingClientRect(),stage=document.querySelector("#stage").getBoundingClientRect();return !!card&&!document.querySelector(".coordination-strip")&&!document.querySelector(".station-projection")&&!document.querySelector(".coord-hold")&&!document.querySelector("[data-coordination-detail]")&&!!document.querySelector("#card [data-cue-at]")&&deck.left<stage.left&&deck.right>stage.right&&document.querySelector("#experienceDeck").dataset.deckPosture==="coordination";})()')" true
conformance_ok 'the Cue Card reads its own action line instead of a second trigger' "$(qa_js 'document.querySelector("#card [data-cue-action]").textContent.includes("Open casing")')" true
capture qa-5-coordination
checkpoint coordination
# §5.4: an edge always shows the edge Card, so a saved Cue is re-read through its own posture: reopen the
# edge, then `Edit Camera Path` → `Journey`.
click '#index [data-act="exp-route-return"]'
click "#experienceDeck [data-act='exp-stop'][data-id='$stop']"
click "[data-act='exp-seam'][data-from='$stop'][data-to='$to']"
conformance_ok 'reopening an edge shows the edge Card, not the Journey' "$(qa_js '(document.querySelector("#card .c-k").textContent.includes("Guide edge")&&!!document.querySelector("#card [data-act=exp-route]"))')" true
click '#card [data-act="exp-route"]'
click '#index [data-exp-posture-switch] [data-act="exp-coordinate"]'
qa_frames
conformance_ok 'the saved Cues reopen on the Deck and the Stage' "$(qa_js '(document.querySelectorAll(".jd-cue").length>=1&&document.querySelectorAll("[data-exp-station-label]").length>=1&&!!__me.S.task.params.connection)')" true
# Camera pace and anchor geometry change derived timing without rebinding Experience stations. The one Pace
# writer lives on the Camera Path Card, so the recipe changes it there and switches back (§5.8).
refs="$(qa_js 'JSON.stringify(__me.ctx.experience.seams[`${__me.S.experienceContext.seam.from}>${__me.S.experienceContext.seam.to}`].beats)')"
# Both readings are of the same Cue: selecting it is what puts its At on the Card.
click "[data-exp-station-label='$anchor']"
timing="$(qa_js 'document.querySelector("#card [data-cue-at]").textContent')"
click '#index [data-exp-posture-switch] [data-act="exp-route"]'
qa_frames
agent-browser select '#card [data-exp-pace]' slow >/dev/null;qa_frames
# A keyboard anchor edit is Camera route work like a drag: the same one proposal, and every authored beat
# keeps its identity across it because stations bind to anchors by id.
agent-browser click "[data-exp-anchor='$anchor']" >/dev/null;qa_key_dispatch ArrowRight
conformance_ok 'keyboard anchor edit preserves stable beat/hold references' "$(qa_js 'JSON.stringify(__me.ctx.experience.seams[`${__me.S.experienceContext.seam.from}>${__me.S.experienceContext.seam.to}`].beats)')" "$refs"
click '#index [data-exp-posture-switch] [data-act="exp-coordinate"]'
qa_frames
click "[data-exp-station-label='$anchor']"
conformance_ok 'Camera pace updates displayed timing and retains beat/hold refs' "$(qa_js 'JSON.stringify(__me.ctx.experience.seams[`${__me.S.experienceContext.seam.from}>${__me.S.experienceContext.seam.to}`].beats)') / $(qa_js "(document.querySelector('#card [data-cue-at]').textContent!==$timing)")" "$refs / true"
# New route invocation after cross-lens navigation has a fresh return and no remembered pose.
click '#lens [data-lens="world"]'
click '.stage-tools [data-act="3d"]'
standpoint="$(pose)"
click '#lens [data-lens="experience"]'
click '#card [data-act="exp-resume"]'
conformance_ok 'coordination Resume keeps NOW and restores both projections neutrally' "$(pose) / $(qa_js '(document.querySelector(".jd-cue")!==null&&__me.S.experienceContext.depth==="coordination")')" "$standpoint / true"
click "[data-act='exp-route'][data-id='$route']"
click '[data-act="exp-route-return"]'
conformance_ok 'resumed route return uses the current invocation standpoint' "$(pose)" "$standpoint"
# Every origin was already supported by the one Travel preparation; Cut then keeps that Camera
# connectivity while painting and executing no traversal.
conformance_ok 'the prepared support survives the resumed route work unrepaired' "$(qa_js 'document.querySelector("#card [data-edge-coverage]").textContent.includes("Reachable from 3 of 3")&&!document.querySelector("[data-act=exp-prepare]")')" true
camera="$(qa_js 'JSON.stringify(__me.ctx.cameraSource)')"
click '[data-act="exp-cut"]'
conformance_ok 'Cut preserves Camera source, paints no real route or anchor' "$(qa_js 'JSON.stringify(__me.ctx.cameraSource)') / $(qa_js '(!document.querySelector("[data-exp-route]")&&!document.querySelector("[data-exp-anchor]"))')" "$camera / true"
# Reusing that destination after Stop 6 makes the same Camera route reach two Seams. The edge Card carries
# no Close; Guide posture's own `Done` on the Deck is the way back out (§5.7).
click '#experienceDeck [data-act="exp-close"]'
click '#index [data-act="exp-open"][data-id="presentation-11"]'
click '#card [data-act="exp-add-guide"]'
click '#experienceDeck [data-act="exp-guide"]'
six="$(qa_jsv '__me.ctx.experience.guide[5]')";seven="$(qa_jsv '__me.ctx.experience.guide[6]')"
click "[data-act='exp-seam'][data-from='$six'][data-to='$seven']"
click '[data-act="exp-travel"]'
# §5.5: the From list is the explicit origin choice, so a two-route edge asks no second question. The Path
# posture is where the origin is chosen and where the one Pace writer lives.
click '#card [data-act="exp-route"]'
qa_frames
conformance_ok 'the From list is the explicit choice among the origins that reach this edge' "$(qa_js "(document.querySelectorAll('#index [data-path-from] [data-path-origin]').length>=2&&!!document.querySelector('#index [data-path-from] [aria-current=true]'))")" true
click "#index [data-path-from] [data-id='$route']"
qa_frames
before="$(source_hash)";count="$(undo)"
agent-browser select '#card [data-exp-pace]' fast >/dev/null;qa_frames
conformance_ok 'shared route pace asks with two Seams before writing source/history' "$(qa_js '(!!__me.S.expRouteAsk&&__me.S.expRouteAsk.affected.length===2)') / $(source_hash) / $(undo)" "true / $before / $count"
click '[data-act="exp-route-cancel"]'
conformance_ok 'shared route Cancel leaves source/history untouched' "$(source_hash) / $(undo)" "$before / $count"
agent-browser select '#card [data-exp-pace]' fast >/dev/null;qa_frames
click '[data-act="exp-route-scope"]'
conformance_ok 'accepting shared route pace writes one aggregate history step' "$(undo)" "$((count+1))"
# Still the Path posture: the From row re-states which route is being edited, so a shared gesture reaches
# the same route a second time without a second door.
click "#index [data-path-from] [data-id='$route']"
before="$(source_hash)";count="$(undo)"
qa_drag "[data-exp-anchor=\"$anchor\"]" 20 12
conformance_ok 'shared observer-anchor gesture remains a proposal until scope acceptance' "$(qa_js '(!!__me.S.expRouteAsk)') / $(source_hash) / $(undo)" "true / $before / $count"
click '[data-act="exp-route-cancel"]'
conformance_ok 'canceling shared anchor proposal writes zero history' "$(source_hash) / $(undo)" "$before / $count"
# MP2: selecting an unrelated Stop ends the route writer; a later Stage press cannot add an anchor.
route_id="$(qa_jsv '__me.S.task.params.connection')"
anchors_before="$(qa_js 'JSON.stringify(__me.ctx.cameraSource.connections[__me.S.task.params.connection].anchors)')"
unrelated="$(qa_jsv '__me.ctx.experience.guide.find(id=>id!==__me.S.experienceContext.seam.from&&id!==__me.S.experienceContext.seam.to)')"
# §5.5: while the Path posture is open the Deck speaks the route's own topology, not the Guide's Stop chips,
# so the author leaves by the posture's own crumb — the edge Card — and only then selects the unrelated
# Stop. The crumb's return is the law proved above; what this block adds is that selecting a Stop is what
# ends the route writer, and that the selection itself moves no Camera.
click '#index [data-act="exp-route-return"]'
qa_frames
standpoint="$(pose)"
click "#experienceDeck [data-act='exp-stop'][data-id='$unrelated']"
conformance_ok 'selecting an unrelated Stop ends the route writer without moving Camera' "$(qa_js '(__me.S.experienceContext.depth!=="route"&&__me.S.experienceContext.seam===null&&__me.S.task?.kind==="experience-overview")') / $(pose)" "true / $standpoint"
stage_point="$(qa_jsv '(()=>{const r=document.querySelector("#stage canvas").getBoundingClientRect();return Math.round(r.x+r.width/2)+","+Math.round(r.y+r.height/2);})()')"
qa_move "${stage_point%,*}" "${stage_point#*,}";qa_down;qa_up
conformance_ok 'a later Stage press cannot add an anchor to the old route' "$(qa_js "JSON.stringify(__me.ctx.cameraSource.connections['$route_id'].anchors)")" "$anchors_before"
# QA-6 no Guide; use the ordinary no-Guide example through actual controls again.
fixture exp-reset
qa_locator_select machine
# UX2: presenting from a Plan reading is a real choice rather than a silent capture — nothing is created
# until the author says how the visitor should meet this subject. The reading is taken with the shell's own
# depth control, so what is proven is the state the shell really puts the author in. Cancel writes nothing
# and leaves the reading alone; the author then works in 3D again, which is the reading this example is
# authored from, and the rest of the block is the same ordinary path it always was.
click '.stage-tools [data-act="plan"]'
pres_before="$(qa_js 'Object.keys(__me.ctx.experience.presentations).length')"
before="$(source_hash)"; count="$(undo)"
click '#card [data-act="exp-create-this"]'
conformance_ok 'Presenting from a Plan reading offers the intent choice and creates nothing yet' "$(qa_js 'Object.keys(__me.ctx.experience.presentations).length') / $(qa_js '(()=>{const a=document.querySelector("[data-plan-ask]");return !!a&&!!document.querySelector("[data-act=exp-plan-compose]")&&!!document.querySelector("[data-act=exp-plan-cancel]");})()') / $(source_hash)" "$pres_before / true / $before"
click '#card [data-act="exp-plan-cancel"]'
conformance_ok 'Cancel creates nothing, keeps the Plan reading and closes the choice' "$(qa_js 'Object.keys(__me.ctx.experience.presentations).length') / $(undo) / $(qa_js '(__me.nav.plainPose().el>1.5&&!__me.S.expPlanAsk&&!document.querySelector("[data-plan-ask]"))')" "$pres_before / $count / true"
click '.stage-tools [data-act="3d"]'
click '#card [data-act="exp-create-this"]'
click '#card [data-act="exp-auto"]'
click '#card [data-act="exp-capture"]'
click '#card [data-act="exp-bring"]'
click '#card .exp-view [data-act="pres-ref"]'
click '#card [data-act="exp-precise"]'
click '[data-act="exp-posture"][data-posture="through"]'
conformance_ok 'QA-6 Through has a framing gate, real grips and exactly one local tape; no Guide Deck' "$(qa_js "(!!document.querySelector('[data-frame-gate]')&&document.querySelectorAll('[data-exp-camera]').length===1&&document.querySelectorAll('[data-active-tape] input').length===1&&!document.querySelector('#experienceDeck')&&[...document.querySelectorAll('[data-exp-camera],[data-active-tape]')].every($visible))")" true
# C9.8: the six-property cluster is gone; a supported grip is selected directly on the drawing.
click '[data-grip="el"]'
conformance_ok 'switching the active grip removes the previous active input/gesture binding' "$(qa_js '(document.querySelectorAll("[data-exp-camera]").length===1&&document.querySelectorAll("[data-exp-precision]").length===1&&document.querySelector("[data-exp-camera]").dataset.grip==="el")')" true
click '[data-grip="frameH"]'
count="$(undo)";qa_drag '[data-exp-camera]' 0 20
conformance_ok 'framing gesture accepts one Camera transaction' "$(undo)" "$((count+1))"
count="$(undo)";fill '[data-exp-precision]' '4.0'
conformance_ok 'typed active framing value accepts one Camera transaction' "$(undo) / $(qa_js '(__me.ctx.cameraSource.views[__me.S.task.target.id].pose.frameH===4)')" "$((count+1)) / true"
capture qa-6-precise
standpoint="$(pose)";before="$(source_hash)"
qa_preview_presentation
conformance_ok 'Preview rig and input removed; source frozen' "$(qa_js '(!document.querySelector("[data-exp-camera]")&&!document.querySelector("#experienceInstrument")&&__me.S.task===null)') / $(source_hash)" "true / $before"
capture qa-6-visitor
checkpoint preview
click '[data-act="exp-exit-preview"]'
conformance_ok 'Preview restores complete realized standpoint and precise context' "$(pose) / $(qa_js '(!!document.querySelector("[data-frame-gate]")&&__me.S.experienceContext.depth==="precision")')" "$standpoint / true"
click '[data-act="exp-posture"][data-posture="outside"]'
conformance_ok 'Outside actually shows observer/frustum and moves from Through explicitly' "$(qa_js '(!!document.querySelector("[data-camera-frustum]")&&!!document.querySelector("[data-exp-observer]")&&__me.S.task.params.posture==="outside")')" true
capture qa-6-outside
# Neutral Resume is proved against the complete rendered camera across successive frames.
click '[data-act="exp-posture"][data-posture="through"]'
click '#lens [data-lens="world"]'
click '.stage-tools [data-act="plan"]'
standpoint="$(pose)";before="$(source_hash)"
click '#lens [data-lens="experience"]'
conformance_ok 'lens return is ordinary with current standpoint and foreign identity intact' "$(pose) / $(qa_js '(__me.S.task===null&&__me.S.experienceContext.depth==="ordinary")')" "$standpoint / true"
click '#card [data-act="exp-resume"]'
for frame in 1 2 3;do qa_frames;conformance_ok "Neutral Resume rendered frame $frame preserves eye/direction/up/FOV/mirror/aspect" "$(pose)" "$standpoint";done
conformance_ok 'resumed precision truthfully says Plan, with no silent Through alignment' "$(qa_js '(__me.S.task.params.posture==="plan"&&!document.querySelector("[data-frame-gate]"))')" true
capture qa-6-plan-resume
checkpoint resume
click '[data-act="exp-posture"][data-posture="through"]'
click '[data-act="exp-camera-return"]'
conformance_ok 'resumed invocation Put it back returns to NOW, not the parked Through pose' "$(pose)" "$standpoint"
click '[data-act="exp-posture"][data-posture="through"]'
standpoint="$(pose)";count="$(undo)";before="$(source_hash)"
p="$(qa_at '[data-exp-camera]')";qa_move "${p%,*}" "${p#*,}";qa_down;qa_move "${p%,*}" "$(( ${p#*,}+35 ))";qa_frames
qa_key_dispatch Escape;qa_up;qa_frames
conformance_ok 'Escape rolls back a live framing audition exactly once, without source/history' "$(pose) / $(source_hash) / $(undo)" "$standpoint / $before / $count"
# Lost pointer capture follows the same cancel path; the late pointer release cannot accept.
p="$(qa_at '[data-exp-camera]')";qa_move "${p%,*}" "${p#*,}";qa_down;qa_move "${p%,*}" "$(( ${p#*,}+25 ))";qa_frames
agent-browser eval 'document.querySelector("[data-exp-camera]").dispatchEvent(new PointerEvent("lostpointercapture",{bubbles:true}))' >/dev/null
qa_up;qa_frames
conformance_ok 'lost capture cancels audition, with no late release commit' "$(pose) / $(source_hash) / $(undo)" "$standpoint / $before / $count"
# -------------------------------------------------------------------------------------------------
# UX2 review (P1, creation fidelity): one aggregate command, two doors, and the reading each door
# authors. `+ Present` captures the live composition; `Present this` authors Camera's recommended framing
# for the subject's extent. Every reading below is the pose the Camera source actually persisted — the
# request the author authored — compared against the same authority that produced it, never against what
# happened to be on screen when the assertion ran.
fixture exp-reset
click '#lens [data-lens="experience"]'
qa_locator_select machine
click '#index [data-act="exp-create"]'
conformance_ok '+ Present captures the live composition, focused on the selected subject' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,p=e.presentations[pid],u=e.uses[p.uses.find(id=>e.uses[id].viewId)],v=__me.ctx.cameraSource.views[u.viewId];return [p.focus.kind+"|"+p.focus.ids.join(","), u.role, u.name, v.pose.flat].join(" / ");})()')" '"subjects|machine / entry / Current view / 0"'
conformance_ok '…and the pose it persists is the standpoint the author was standing at' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,p=e.presentations[pid],u=e.uses[p.uses.find(id=>e.uses[id].viewId)],v=__me.ctx.cameraSource.views[u.viewId].pose,q=__me.nav.plainPose(),near=(a,b)=>Math.abs(a-b)<0.002;return near(v.az,q.az)&&near(v.el,q.el)&&near(v.frameH,q.frameH)&&v.target.every((n,i)=>near(n,q.target[i]));})()')" true
conformance_ok '…and never the recommended framing of the same subject, which is a different reading' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,p=e.presentations[pid],u=e.uses[p.uses.find(id=>e.uses[id].viewId)],v=__me.ctx.cameraSource.views[u.viewId].pose,d=__me.nav.deriveFraming({focus:p.focus}).pose;return !(Math.abs(v.az-d.az)<1e-6&&Math.abs(v.el-d.el)<1e-6&&Math.abs(v.frameH-d.frameH)<1e-6);})()')" true
# The subject's own door asks Camera for the framing, and what it persists is that framing — the same
# numbers `deriveFraming` answers with, read back from the authored View rather than from the call.
qa_locator_select machine
click '#card [data-act="exp-create-this"]'
conformance_ok 'Present this authors Camera'"'"'s recommended framing for the subject extent' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,p=e.presentations[pid],u=e.uses[p.uses.find(id=>e.uses[id].viewId)],v=__me.ctx.cameraSource.views[u.viewId],d=__me.nav.deriveFraming({focus:p.focus}).pose,near=(a,b)=>Math.abs(a-b)<0.002;return [u.name, v.pose.flat===0&&near(v.pose.az,d.az)&&near(v.pose.el,d.el)&&near(v.pose.frameH,d.frameH)&&v.pose.target.every((n,i)=>near(n,d.target[i]))].join(" / ");})()')" '"Auto framing / true"'
# With motion in flight the live capture samples where the Camera actually is: the pose that is authored
# is the pose that was on screen, and the move is stopped rather than hurried to its destination.
qa_locator_select machine
qa_js '(__me.A.go3D(), true)' >/dev/null
click '#index [data-act="exp-create"]'
conformance_ok '+ Present with motion in flight authors the sampled pose, not a destination' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,p=e.presentations[pid],u=e.uses[p.uses.find(id=>e.uses[id].viewId)],v=__me.ctx.cameraSource.views[u.viewId].pose,q=__me.nav.plainPose(),near=(a,b)=>Math.abs(a-b)<0.002;return near(v.az,q.az)&&near(v.el,q.el)&&near(v.frameH,q.frameH)&&near(v.flat,q.flat);})()')" true
conformance_ok '…and the interruption leaves the standpoint there, with nothing still travelling' "$(qa_js '(async()=>{const q=__me.nav.plainPose();await new Promise(r=>setTimeout(r,320));await __me.qa.render();const p=__me.nav.plainPose();return Math.abs(p.az-q.az)<1e-9&&Math.abs(p.frameH-q.frameH)<1e-9;})()')" true
# From a Plan reading the author is asked first, and each answer authors its own reading: the plan itself,
# or the recommended 3D framing that composing in 3D arrives at. The plan is never captured silently.
click '.stage-tools [data-act="plan"]'
qa_locator_select machine
click '#card [data-act="exp-create-this"]'
conformance_ok 'from a Plan reading the door still asks before it creates' "$(qa_js '(()=>{const p=__me.S.expPlanAsk;return !!p&&!!document.querySelector("[data-plan-ask]");})()')" true
click '#card [data-act="exp-plan-view"]'
conformance_ok 'Use the plan as the visitor View authors the plan reading itself' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,p=e.presentations[pid],u=e.uses[p.uses.find(id=>e.uses[id].viewId)],v=__me.ctx.cameraSource.views[u.viewId];return [u.name, v.pose.flat===1, !!p].join(" / ");})()')" '"Plan reading / true / true"'
conformance_ok '…not the recommended 3D framing of the same subject' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,p=e.presentations[pid],u=e.uses[p.uses.find(id=>e.uses[id].viewId)],v=__me.ctx.cameraSource.views[u.viewId].pose,d=__me.nav.deriveFraming({focus:p.focus}).pose;return !(v.flat===d.flat&&Math.abs(v.az-d.az)<1e-6&&Math.abs(v.frameH-d.frameH)<1e-6);})()')" true
click '.stage-tools [data-act="plan"]'
qa_locator_select machine
click '#card [data-act="exp-create-this"]'
click '#card [data-act="exp-plan-compose"]'
conformance_ok 'Compose in 3D from a Plan reading authors the recommended framing it arrived at' "$(qa_js '(()=>{const e=__me.ctx.experience,pid=__me.S.experienceContext.presentation,p=e.presentations[pid],u=e.uses[p.uses.find(id=>e.uses[id].viewId)],v=__me.ctx.cameraSource.views[u.viewId],d=__me.nav.deriveFraming({focus:p.focus}).pose,near=(a,b)=>Math.abs(a-b)<0.002;return [u.name, v.pose.flat===0&&near(v.pose.az,d.az)&&near(v.pose.frameH,d.frameH), __me.nav.plainPose().flat===0].join(" / ");})()')" '"Auto framing / true / true"'

qa_faults_ok 'conformance commands'
qa_browser_errors_ok 'conformance browser'
qa_summary 'V2 product conformance'
