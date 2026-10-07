#!/usr/bin/env bash
# C9.6 product axis: useful revision and repair through their real homes (J8).
#   * rename accepts once, preserving stable identity and shared use;
#   * Duplicate is a new identity with its own definition, so editing the copy never reaches the original;
#   * Make local / Link change which reusable definition a use reads, and only that;
#   * removing a Presentation discloses what it leaves, keeps every shared definition, retained reference
#     and Camera View, lists the retained work for repair, and is one Undo;
#   * provider profile replacement gains and loses declared capabilities through the World adapter, and a
#     lost capability is a routed repair notice whose compatible rebind restores the work.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_QUERY='motion=instant'
source "$QA_DIR/lib.sh"
qa_open;qa_faults_clear
click(){ agent-browser scrollintoview "$1" >/dev/null;agent-browser click "$1" >/dev/null;qa_frames; }
fill(){ agent-browser fill "$1" "$2" >/dev/null;qa_press Enter; }
choose(){ agent-browser select "$1" "$2" >/dev/null;qa_frames; }
# A control inside a Card disclosure can be hidden when the disclosure is closed; the product's own
# click handler is still the one exercised, dispatched on the element itself.
press(){ qa_js "(()=>{const e=document.querySelector(\"$1\");if(!e)return false;e.click();return true;})()" >/dev/null;qa_frames; }
# The Revise disclosure is the Card's own named one, wherever it sits: a control use also carries the
# Activity-relationships disclosure, an offer does not, and a select needs the disclosure actually open.
revise_open(){ qa_js "(()=>{const d=[...document.querySelectorAll('#card > details')].find(x=>/Revise/.test(x.querySelector('summary')?.textContent||''));if(!d)return false;if(!d.open)d.querySelector('summary').click();return true;})()" >/dev/null;qa_frames; }
fixture(){ click '#experienceExamples > summary';click "[data-act='$1']";click '#experienceExamples > summary'; }
# A mutation stops at the first boundary it protects, so later unrelated state cannot mask it.
checkpoint(){ if [ "${QA_REVISION_UNTIL:-}" = "$1" ];then qa_summary "C9.6 boundary $1";exit;fi; }

# ---- From genuinely empty Reset: the ordinary creator loop, then real revision work.
click '#lens [data-lens=experience]';fixture exp-reset
click '#index [data-id=machine]';click '#card [data-act=exp-create]'
fill '[data-exp-primary]' 'The casing protects the rotor.'
click '#card [data-act=exp-capture]'
pid="$(qa_jsv '__me.S.experienceContext.presentation')"
click '#card [data-operate=machine]'
fill '[data-exp-audition=casing]' '1';click '#card [data-act=exp-use][data-cap=casing]'
click '#card [data-act=exp-use][data-cap=rotor]'
click "#index [data-act=exp-open][data-id='$pid']"
qa_ok 'Reset authoring captured two real Activities in one Presentation' "$(qa_js '(Object.values(__me.ctx.experience.uses).filter(u=>__me.ctx.experience.definitions[u.definitionId]?.kind==="control").length===2&&Object.keys(__me.ctx.experience.presentations).length===1)')" true
checkpoint authoring

# ---- Rename accepts once and keeps identity.
undo0="$(qa_jsv '__me.S.undo.length')"
fill '[data-exp-field=name]' 'The drive explained'
qa_ok 'rename accepts once, keeps stable identity and writes exactly one Undo step' "$(qa_js '(__me.ctx.experience.presentations[__me.S.sel].name==="The drive explained"&&__me.S.undo.at(-1).label==="Rename Presentation")') / $(($(qa_jsv '__me.S.undo.length')-undo0))" 'true / 1'
checkpoint rename

# ---- Duplicate is an independent identity; editing the copy never reaches the original.
casing="$(qa_jsv 'Object.values(__me.ctx.experience.uses).find(u=>__me.ctx.experience.definitions[u.definitionId]?.capabilityId==="casing").id')"
click '#card > details:nth-of-type(3) > summary'
click "#card [data-act=pres-ref][data-id='$casing']"
# The selected Activity Card's own disclosure order: (1) Activity relationships, (2) Revise.
click '#card > details:nth-of-type(2) > summary'
press '#card [data-act=exp-duplicate-contribution]'
dup="$(qa_jsv '__me.S.sel')"
qa_ok 'Duplicate creates a new identity with its own definition copy' "$(qa_js '(()=>{const e=__me.ctx.experience,cs=Object.values(e.uses).filter(u=>e.definitions[u.definitionId]?.capabilityId==="casing");return cs.length===2&&cs[0].definitionId!==cs[1].definitionId&&cs[0].id!==cs[1].id;})()')" true
# The Rename writer names the selected use, so a typed name saves to its definition as one Undo. The
# selection changed with the duplicate, so the Revise disclosure is reopened.
click '#card > details:nth-of-type(2) > summary'
fill '[data-exp-act-name]' 'Casing work'
qa_ok 'renaming the shared contribution saves as one Undo' "$(qa_js '(__me.ctx.experience.definitions[__me.ctx.experience.uses[__me.S.sel].definitionId].name==="Casing work"&&__me.S.undo.at(-1).label==="Rename contribution")')" true
choose '[data-exp-rebind-subject]' piano
choose '[data-exp-rebind-capability]' music
qa_ok 'the duplicate can be rebound independently; the original capture is untouched' "$(qa_js '(()=>{const e=__me.ctx.experience,d=e.definitions[e.uses[__me.S.sel].definitionId],o=e.definitions[e.uses["'"$casing"'"].definitionId];return d.subjectId==="piano"&&d.capabilityId==="music"&&o.subjectId==="machine"&&o.capabilityId==="casing";})()')" true
# Make local detaches the definition; Link shares an existing one again.
local="$(qa_jsv '(()=>{const e=__me.ctx.experience;return e.uses[__me.S.sel].definitionId;})()')"
shared="$(qa_jsv '(()=>{const e=__me.ctx.experience;return e.definitions[e.uses["'"$casing"'"].definitionId].id;})()')"
choose '[data-exp-link-definition]' "$shared"
qa_ok 'Link shares the chosen reusable definition' "$(qa_js '(()=>{const e=__me.ctx.experience;return e.uses[__me.S.sel].definitionId===e.uses["'"$casing"'"].definitionId;})()')" true
press '#card [data-act=exp-make-local]'
qa_ok 'Make local detaches it again without disturbing the other use' "$(qa_js '(()=>{const e=__me.ctx.experience;return e.uses[__me.S.sel].definitionId!==e.uses["'"$casing"'"].definitionId&&e.definitions[e.uses["'"$casing"'"].definitionId].subjectId==="machine";})()')" true
qa_ok 'the detached local definition is a fresh identity' "$(qa_js '(()=>{const e=__me.ctx.experience;return e.uses[__me.S.sel].definitionId!=="'"$local"'"&&e.uses[__me.S.sel].definitionId!=="'"$shared"'";})()')" true
checkpoint duplicate

# ---- P1: replacing a descriptor on a shared definition discloses its reach and waits for acceptance.
click '#card > details:nth-of-type(2) > summary'
choose '[data-exp-link-definition]' "$shared"
qa_ok 'the two Activities share one definition before the descriptor replacement' "$(qa_js '(()=>{const e=__me.ctx.experience;return e.uses[__me.S.sel].definitionId===e.uses["'"$casing"'"].definitionId;})()')" true
choose '[data-exp-rebind-subject]' light
qa_ok 'replacing a shared descriptor discloses its real reach and writes nothing yet' "$(qa_js '(()=>{const a=__me.S.expRebindAsk,e=__me.ctx.experience,d=e.definitions[e.uses[__me.S.sel].definitionId];return !!a&&a.reach.length===2&&d.subjectId==="machine"&&d.capabilityId==="casing";})()') / $(qa_js '/shared by 2 linked Activities/.test((document.querySelector(".ask-rule")||{}).textContent||"")')" "true / true"
# …and the pending subject drives the counterpart control: the second choice of one scope decision is made
# against what the author is proposing, not against the stored descriptor the write has not reached.
qa_ok 'the pending subject drives the capability picker of the shared proposal' "$(qa_js '(()=>{const o=[...document.querySelectorAll("[data-exp-rebind-capability] option")].map(x=>x.value);return o.includes("intensity")&&!o.includes("casing")&&!o.includes("rotor");})()')" true
click '#card [data-act=exp-rebind-local]'
qa_ok 'a local acceptance forks only this Activity and leaves the linked original untouched' "$(qa_js '(()=>{const e=__me.ctx.experience,d=e.definitions[e.uses[__me.S.sel].definitionId],o=e.definitions[e.uses["'"$casing"'"].definitionId];return e.uses[__me.S.sel].definitionId!==e.uses["'"$casing"'"].definitionId&&d.subjectId==="light"&&o.subjectId==="machine"&&o.capabilityId==="casing";})()')" true
click '#undoBtn'
qa_ok 'Undo restores the shared link so both Activities read one definition again' "$(qa_js '(()=>{const e=__me.ctx.experience;return e.uses[__me.S.sel].definitionId===e.uses["'"$casing"'"].definitionId;})()')" true
checkpoint shared-scope

# ---- P1/P2: a merged proposal waits as one decision, and a use-only change never writes the definition
# field a still-pending scope Ask is holding. Two linked offers, one subject (definition) choice, one
# activation (use-only) choice.
click '#index [data-id=light]'
press '#card [data-act=exp-offer][data-kind=interaction]'
press '#card [data-act=exp-offer-accept]'
offer="$(qa_jsv 'Object.values(__me.ctx.experience.uses).find(u=>u.kind==="interaction").id')"
offer_def="$(qa_jsv "__me.ctx.experience.uses['$offer'].definitionId")"
click "#index [data-act=exp-open][data-id='$pid']"
click '#card > details:nth-of-type(3) > summary'
click "#card [data-act=pres-ref][data-id='$offer']"
revise_open
press '#card [data-act=exp-duplicate-contribution]'
revise_open
choose '[data-exp-link-definition]' "$offer_def"
qa_ok 'two linked offers read one definition before the merged proposal' "$(qa_js '(()=>{const e=__me.ctx.experience;return Object.values(e.uses).filter(u=>u.definitionId==="'"$offer_def"'").length===2;})()')" true
dup="$(qa_jsv '__me.S.sel')"
choose '[data-exp-rebind-subject]' piano
qa_ok 'the linked offer proposal waits with its reach disclosed and nothing written' "$(qa_js '(()=>{const a=__me.S.expRebindAsk,e=__me.ctx.experience,d=e.definitions[e.uses[__me.S.sel].definitionId];return !!a&&a.reach.length===2&&d.subjectId==="light"&&e.uses[__me.S.sel].triggerSubjectId==="light";})()')" true
qa_ok 'the pending subject drives the capability picker of the linked offer proposal' "$(qa_js '(()=>{const o=[...document.querySelectorAll("[data-exp-rebind-capability] option")].map(x=>x.value);return o.includes("music")&&!o.includes("intensity");})()')" true
# The re-render that showed the Ask replaces the Card, so the disclosure the next choice lives in is reopened.
revise_open
choose '[data-exp-rebind-trigger]' switch
qa_ok 'a use-only change while the Ask is open never writes the merged definition edit' "$(qa_js '(()=>{const a=__me.S.expRebindAsk,e=__me.ctx.experience,d=e.definitions[e.uses[__me.S.sel].definitionId];return !!a&&d.subjectId==="light"&&e.uses[__me.S.sel].triggerSubjectId==="light"&&a.patch.subjectId==="piano"&&a.patch.triggerSubjectId==="switch";})()')" true
click '#card [data-act=exp-rebind-shared]'
qa_ok 'accepting the merged proposal writes the shared definition for every linked Activity and the use-owned trigger only for the Activity that was edited' "$(qa_js '(()=>{const e=__me.ctx.experience,sel="'"$dup"'",d=e.definitions[e.uses[sel].definitionId],linked=Object.values(e.uses).filter(u=>u.definitionId===d.id);return d.subjectId==="piano"&&linked.length===2&&e.uses[sel].triggerSubjectId==="switch"&&linked.filter(u=>u.id!==sel).every(u=>u.triggerSubjectId==="light")&&!__me.S.expRebindAsk;})()')" true
checkpoint merged-rebind

# ---- Remove Presentation: disclosed, retained and one Undo.
click "#index [data-act=exp-open][data-id='$pid']"
click '#card [data-act=exp-add-guide]'
qa_ok 'the Presentation has exactly one Guide occurrence before removal' "$(qa_jsv '__me.ctx.experience.guide.length')" 1
views_before="$(qa_jsv 'Object.keys(__me.ctx.cameraSource.views).length')"
undo_before="$(qa_jsv '__me.S.undo.length')"
click '#card > details:nth-of-type(5) > summary'
click '#card [data-act=exp-remove-presentation]'
qa_ok 'removal takes exactly its own occurrences and one Undo, and leaves the Presentation gone' "$(qa_js '(__me.ctx.experience.presentations["'"$pid"'"]===undefined&&__me.ctx.experience.guide.length===0)') / $(qa_js '(__me.S.undo.length===1+'"$undo_before"'&&__me.S.undo.at(-1).label==="Remove Presentation")')" 'true / true'
qa_ok 'shared definitions, retained references and Camera Views survive the removal' "$(qa_js '(()=>{const e=__me.ctx.experience,cs=Object.values(e.uses).filter(u=>e.definitions[u.definitionId]?.capabilityId==="casing");return cs.length===2&&cs.every(u=>e.definitions[u.definitionId]?.value!==undefined)&&e.definitions["'"$shared"'" ]!==undefined&&Object.keys(__me.ctx.cameraSource.views).length==='"$views_before"';})()')" true
qa_ok 'the retained contributions are listed for repair without resurrecting the removed home' "$(qa_js '(document.querySelectorAll("[data-act=exp-select-orphan]").length===Object.values(__me.ctx.experience.uses).length&&document.querySelector("#index").textContent.includes("Retained contributions"))')" true
click '#index [data-act=exp-select-orphan]'
qa_ok 'a retained contribution is reachable and reads its removed home honestly' "$(qa_js '(!!document.querySelector("#card").textContent.match(/Removed home · retained for repair/)&&!!document.querySelector("[data-act=exp-remove-contribution]"))')" true
# A retained View use whose home was removed has a real repair/removal path and never writes a role into
# the missing Presentation.
view_use="$(qa_jsv 'Object.values(__me.ctx.experience.uses).find(u=>u.viewId&&!__me.ctx.experience.presentations[u.presentationId]).id')"
click "#index [data-act=exp-select-orphan][data-id='$view_use']"
qa_ok 'a retained View use offers rehome and removal, and never a role write into the removed home' "$(qa_js '(!!document.querySelector("[data-exp-rehome]")&&!!document.querySelector("[data-act=exp-remove-contribution]")&&!document.querySelector("[data-act=exp-role]")&&/retained View use/.test(document.querySelector("#card").textContent))')" true
vu_undo="$(qa_jsv '__me.S.undo.length')"
click '#card [data-act=exp-remove-contribution]'
qa_ok 'the retained View use can be removed as one Undo' "$(qa_js '(__me.ctx.experience.uses["'"$view_use"'"]===undefined&&__me.S.undo.length=='"$((vu_undo+1))"')')" true
click '#undoBtn'
qa_ok 'Undo restores the retained View use' "$(qa_js '!!__me.ctx.experience.uses["'"$view_use"'"]')" true
click '#undoBtn'
qa_ok 'one Undo restores the Presentation, its Guide occurrence and its references' "$(qa_js '(__me.ctx.experience.presentations["'"$pid"'"]!==undefined&&__me.ctx.experience.guide.length===1&&!!__me.ctx.experience.uses["'"$casing"'"])')" true
checkpoint remove

# ---- Provider profile replacement: capability loss, routed repair notice, compatible rebind.
click '#index [data-id=machine]'
click '[data-act=lens][data-lens=world]'
qa_ok 'the World subject Details owns the declared profile' "$(qa_js '(!!document.querySelector("[data-exp-profile]")&&document.querySelector("[data-exp-profile]").value==="machine")')" true
choose '[data-exp-profile]' machineBase
qa_ok 'replacing the profile drops the rotor capability while keeping the casing and the instance' "$(qa_js '(()=>{const sc=__me.ctx.sceneSource,cap=(id)=>sc.subjects.machine.profile==="machineBase"&&id;return sc.subjects.machine.id==="machine"&&sc.subjects.machine.x===-10&&cap(1)&&!JSON.stringify(sc.subjects.machine).includes("rotor");})()')" true
click '[data-act=lens][data-lens=experience]'
rotor="$(qa_jsv 'Object.values(__me.ctx.experience.uses).find(u=>__me.ctx.experience.definitions[u.definitionId]?.capabilityId==="rotor").id')"
click "#index [data-act=exp-open][data-id='$pid']"
click '#card > details:nth-of-type(3) > summary'
click "#card [data-act=pres-ref][data-id='$rotor']"
qa_ok 'the lost capability is a routed repair notice on the retained Activity, not a silent change' "$(qa_js '(!!document.querySelector("[data-exp-rebind-capability]")&&/Repair/.test(document.querySelector("#card").textContent)&&document.querySelector("#card").textContent.includes("unavailable"))')" true
choose '[data-exp-rebind-capability]' casing
qa_ok 'a compatible rebind repairs the instruction in place, keeping its identity' "$(qa_js '(()=>{const e=__me.ctx.experience,d=e.definitions[e.uses["'"$rotor"'"].definitionId];return d.capabilityId==="casing"&&d.subjectId==="machine"&&e.uses["'"$rotor"'"].start.kind==="visit";})()')" true
checkpoint rebind

# ---- P2: a gained capability the Stage does not realize is reported, not demonstrated.
click '[data-act=lens][data-lens=world]'
qa_js '__me.A.select("mesh")' >/dev/null;qa_frames
choose '[data-exp-profile]' meshAnnotated
qa_ok 'the mesh provider now declares Annotate as a gained capability' "$(qa_js '__me.ctx.sceneSource.subjects.mesh.profile==="meshAnnotated"')" true
click '[data-act=lens][data-lens=experience]'
qa_js '__me.A.select("mesh")' >/dev/null;qa_frames
qa_ok 'the unrealized Annotate is reported unsupported on its Card, not offered as a working control' "$(qa_js '(document.querySelector("#card").textContent.includes("not realized")&&!document.querySelector("#card [data-act=exp-use][data-cap=annotate]"))')" true
qa_ok 'operating the unrealized capability is explicitly refused and records no audition' "$(qa_js '(__me.E.auditionCapability("mesh","annotate",true)===false&&!(__me.S.expAudition&&__me.S.expAudition.mesh&&"annotated" in __me.S.expAudition.mesh))')" true
# Offer creation reads the same eligibility: the picker lists only what this Stage realizes, and the
# declared-but-unrealized one can never be authored as visitor work.
qa_js '(()=>{__me.E.beginOffer("interaction","mesh");return true;})()' >/dev/null;qa_frames
qa_ok 'the offer picker lists only capabilities this Stage realizes' "$(qa_js '(()=>{const o=[...document.querySelectorAll("[data-exp-offer=capabilityId] option")].map(x=>x.value),d=__me.S.expOfferDraft;return o.includes("emphasis")&&!o.includes("annotate")&&o.includes(d.capabilityId);})()')" true
qa_js '(()=>{window.__uses=Object.keys(__me.ctx.experience.uses).length;__me.S.expOfferDraft.capabilityId="annotate";window.__refused=__me.E.acceptOffer()===false;return true;})()' >/dev/null
qa_ok 'a declared-but-unrealized capability can never be authored as visitor work' "$(qa_js '(!!window.__refused&&Object.keys(__me.ctx.experience.uses).length===window.__uses)')" true
checkpoint unrealized-offers
qa_faults_ok 'revision commands'
qa_browser_errors_ok 'revision browser'
qa_summary 'C9.6 revision and repair'
