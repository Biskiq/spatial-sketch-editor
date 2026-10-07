#!/usr/bin/env bash
# C9.9 product axis: the review aid's eighteen topics and its own honesty (C9 §8, J1–J11).
#
# What it proves, and only this:
#   * the aid carries eighteen topics, each with a real instruction and a predicate read from authored
#     documents or from what the product actually reported — never from a field being present or a
#     button having been pressed;
#   * provenance is explicit: the aid names the loader that produced the document on screen and how many
#     edits were authored here, and loaded content credits no quickstart topic;
#   * a quickstart topic is credited by every outcome its own instruction authors, on the moment it names —
#     an explanation without the framing the same instruction asks for is not the topic;
#   * the visit's own session is the only witness: a traversal arrives where the Camera arrives (never when
#     the Stop is entered), a Travel is credited only for the arrival its authored route produced, a Stop
#     entry policy counts only once a visit ran it, and a carried run counts only when content ran under a
#     hold or the visitor's own Stop ended the run;
#   * Back, Next and Skip move the aid's own cursor and nothing else, and skipping never invents a
#     completion;
#   * the aid stays usable during Preview as read-only guidance, with every authoring control unmounted
#     for the visit, and closing and reopening it disturbs nothing.
#
# Usage: qa/presenter-check.sh
# No `set -e`: an eval that comes back empty is a failed observation, and it must be reported as one
# rather than killing the run before an assertion can show it.
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_QUERY='motion=instant'
source "$QA_DIR/lib.sh"

export QA_OUT="${QA_OUT:-$QA_DIR/out/presenter}"
export QA_SHOT="${QA_SHOT:-0}"

# Everything an assertion here may need, read in the page, once per block.
BLOB='(() => {
  const S = window.__me.S, E = window.__me.E, ctx = window.__me.ctx;
  const t = (s) => document.querySelector(s);
  const all = (s) => [...document.querySelectorAll(s)];
  const text = (s) => { const e = t(s); return e ? e.textContent : null; };
  const p = t("#experienceExamples");
  const steps = E.presenterSteps();
  const credits = steps.map((s) => [s.title, E.presenterCredit(s).seen, E.presenterCredit(s).credited]);
  const authoring = all("#experienceExamples [data-authoring]");
  return JSON.stringify({
    index: S.experiencePresenter || 0,
    topics: steps.length,
    families: [steps.filter((s) => s.family === "Q").length, steps.filter((s) => s.family === "A").length].join("/"),
    predicates: steps.filter((s) => typeof s.done === "function" && typeof s.observed === "function" && typeof s.instruction === "string" && s.instruction.length > 20).length,
    titles: steps.map((s) => s.title.split(" · ")[0]).join(","),
    firstTitle: steps[0].title,
    lastTitle: steps[steps.length - 1].title,
    credited: credits.filter((c) => c[2]).map((c) => c[0].split(" · ")[0]).join(","),
    seenOpen: credits.filter((c) => c[1] && !c[2]).map((c) => c[0].split(" · ")[0]).join(","),
    seen: credits.filter((c) => c[1]).length,
    hidden: p ? p.hidden : null,
    open: p ? p.open : null,
    visiting: p ? p.classList.contains("presenter-visiting") : null,
    stepText: text("#experienceExamples [data-example-step]"),
    instruction: text("#experienceExamples [data-example-instruction]"),
    observed: text("#experienceExamples [data-example-observed]"),
    credit: text("#experienceExamples [data-example-credit]"),
    creditState: (t("#experienceExamples [data-example-credit]") || { dataset: {} }).dataset.state || null,
    tally: text("#experienceExamples [data-example-tally]"),
    tallyCount: (text("#experienceExamples [data-example-tally]") || "").split("/")[0],
    source: text("#experienceExamples [data-example-source]"),
    sourceKind: (t("#experienceExamples [data-example-source]") || { dataset: {} }).dataset.source || null,
    writes: S.expReview.writes,
    authoringHidden: authoring.map((e) => e.hidden),
    loadersVisible: all("#experienceExamples [data-authoring] button").filter((b) => !b.hidden && b.getBoundingClientRect().width > 0).length,
    a6: (() => { const s = steps.find((x) => x.title.startsWith("A6")); return s ? E.presenterCredit(s).credited : null; })(),
    a4: (() => { const s = steps.find((x) => x.title.startsWith("A4")); return s ? E.presenterCredit(s).credited : null; })(),
    ledger: S.expReview.visitor ? (S.expReview.visitor.stops || []).length : null,
    walked: S.expReview.visitor ? !!S.expReview.visitor.traversed : null,
    visited: S.expReview.visitor && S.expReview.visitor.traversed ? (S.expReview.visitor.traversed.arrived ? "arrived" : "travelling") : "none",
    travelArrivals: S.expReview.visitor ? (S.expReview.visitor.travelArrivals || 0) : null,
    entries: S.expReview.visitor ? (S.expReview.visitor.entries || []).map((x) => [x.kind, x.later, x.arrived, x.ran].join(":")).join(",") : null,
    stopped: S.expReview.visitor ? (S.expReview.visitor.stopped || []).filter((x) => x.carried && x.live).length : null,
    q2: (() => { const s = steps.find((x) => x.title.startsWith("Q2")); return s ? E.presenterCredit(s).credited : null; })(),
    handoffs: S.expReview.visit ? (S.expReview.visit.handoffs || 0) : null,
    at: S.expReview.visitor ? S.expReview.visitor.at : null,
    q7: (() => { const s = steps.find((x) => x.title.startsWith("Q7")); return s ? E.presenterCredit(s).seen : null; })(),
    a2: (() => { const s = steps.find((x) => x.title.startsWith("A2")); return s ? E.presenterCredit(s).credited : null; })(),
    a3: (() => { const s = steps.find((x) => x.title.startsWith("A3")); return s ? E.presenterCredit(s).credited : null; })(),
    rotor: (() => { const ex = ctx.experience, v = S.visitor; if (!v) return null; const u = Object.values(ex.uses).find((x) => ex.definitions[x.definitionId]?.capabilityId === "rotor"); return u ? (v.runtime.active[u.id] || null) : null; })(),
    rotorState: (() => { const ex = ctx.experience, v = S.visitor; if (!v) return null; const u = Object.values(ex.uses).find((x) => ex.definitions[x.definitionId]?.capabilityId === "rotor"); const run = u && v.runtime.active[u.id]; return run ? ((v.runtime.activities[run] || {}).status || null) : null; })(),
    entryKinds: Object.values(ctx.experience.stops).map((s) => s.entry.kind).join(","),
    a9: (() => { const s = steps.find((x) => x.title.startsWith("A9")); return s ? E.presenterCredit(s).credited : null; })(),
    q5: (() => { const s = steps.find((x) => x.title.startsWith("Q5")); return s ? E.presenterCredit(s).credited : null; })(),
    peeks: S.expReview.peeks || 0,
    coordination: S.expReview.coordination || null,
    expanded: !!document.querySelector(".stop-card.expanded"),
    nextDisabled: (() => { const b = [...document.querySelectorAll("#experienceExamples [data-act=exp-presenter]")].find((x) => x.dataset.delta === "1"); return b ? b.disabled : null; })(),
    visitor: !!S.visitor,
    hash: window.__me.qa.hash(),
    undo: S.undo.length,
    sel: S.sel,
    standing: JSON.stringify(__me.nav.plainPose()),
    guide: ctx.experience.guide.length,
    faults: S.faults.length,
  });
})()'

step() { # step <javascript statements>
  local i out
  for i in 1 2 3; do
    out="$(qa_jsv "(async () => { const A = window.__me.A; $1 await window.__me.qa.idle(); await window.__me.qa.render(); return ${BLOB}; })()")"
    [ -n "$out" ] && break
    sleep 0.4
  done
  printf '%s' "$out"
}
field() { python3 -c 'import json, sys
d = json.loads(sys.argv[1]); v = d.get(sys.argv[2])
print("None" if v is None else (v if isinstance(v, str) else (str(v) if isinstance(v, bool) else json.dumps(v))))' "$last" "$1" 2>/dev/null; }
is() { python3 -c 'import json, sys
d = json.loads(sys.argv[1]); print(eval(sys.argv[2], {"d": d, "json": json}))' "$last" "$1" 2>/dev/null; }
press() { qa_js "(()=>{const e=document.querySelector(\"$1\");if(!e)return false;e.click();return true;})()" >/dev/null; qa_frames; }
# The product's own Entry control, driven as a real select: what the author configures is the policy its
# visit will run.
select_control() { agent-browser select "$1" "$2" >/dev/null 2>&1; qa_frames; }
# One value read from the live page, bare, for use as a selector or a select value.
page() { qa_jsv "$1"; }
checkpoint() { if [ "${QA_PRESENTER_UNTIL:-}" = "$1" ]; then qa_summary "C9.9 boundary $1"; exit; fi; }
# Back is addressed by the delta it carries, not by a quoted attribute selector: the product's own click
# handler is still the one exercised, and no quotation can end the expression early.
back() { qa_js "(()=>{const b=[...document.querySelectorAll('[data-act=exp-presenter]')].find(e=>e.dataset.delta==='-1');if(!b)return false;b.click();return true;})()" >/dev/null; qa_frames; }
next_aid() { qa_js "(()=>{const b=[...document.querySelectorAll('[data-act=exp-presenter]')].find(e=>e.dataset.delta==='1');if(!b)return false;b.click();return true;})()" >/dev/null; qa_frames; }
open_aid() { press '#experienceExamples > summary'; }
close_aid() { qa_js "(()=>{const d=document.querySelector(\"#experienceExamples\");if(!d||!d.open)return false;d.querySelector(\"summary\").click();return true;})()" >/dev/null; qa_frames; }
# One authored edit through the product's own field: real caret, real value, real Enter. The explanation
# is the field whose own topic Q2 observes, so the credit it earns is the outcome, not a stray write.
author_once() { qa_scroll_center '#card [data-exp-primary]'; agent-browser click '#card [data-exp-primary]' >/dev/null 2>&1; qa_frames; agent-browser fill '#card [data-exp-primary]' "$1" >/dev/null 2>&1; qa_key_dispatch Enter; }
# An authored edit that is not the topic's own outcome: the Presentation's own name field, through the
# product's real control.
rename_once() { qa_scroll_center '#card [data-exp-field=name]'; agent-browser click '#card [data-exp-field=name]' >/dev/null 2>&1; qa_frames; agent-browser fill '#card [data-exp-field=name]' "$1" >/dev/null 2>&1; qa_key_dispatch Enter; }

qa_open
qa_say "== C9.9 · the review aid's eighteen topics"
qa_faults_clear

qa_say "-- eighteen topics, each instruction paired with a real predicate"
press '#lens [data-lens=experience]'
open_aid
last="$(step '')"
qa_ok "the aid carries all eighteen topics, quickstart and advanced" "$(field topics) / $(field families) / $(field titles)" "18 / 8/10 / Q1,Q2,Q3,Q4,Q5,Q6,Q7,Q8,A1,A2,A3,A4,A5,A6,A7,A8,A9,A10"
qa_ok "…each with an instruction and its own outcome predicate" "$(field predicates) / $(field firstTitle) / $(field lastTitle)" "18 / Q1 · Subject and Presentation / A10 · Lose and repair a capability"
qa_ok "…naming its provenance: the boot document, with nothing authored here" "$(field source) / $(field sourceKind)" "Source · prototype boot · 0 authored edits / none"
qa_ok "…and crediting no topic on a document nobody authored" "$(is 'd["credited"] == ""') / $(field tallyCount)" "True / 0"
qa_ok "the aid is closed until asked for, and open only in the Experience lens" "$(field hidden) / $(field open)" "False / True"
checkpoint inventory

qa_say "-- provenance is explicit, and loaded content credits no quickstart topic"
last="$(step 'document.querySelector("[data-act=exp-example]").click();')"
qa_ok "loading the example is named as the source and counts no authored edit" "$(field source) / $(field sourceKind) / $(field writes)" "Source · Load Example · 0 authored edits / example / 0"
qa_ok "…crediting no quickstart topic even though the example satisfies their outcomes" "$(is 'd["credited"] == ""') / $(field seenOpen) / $(field guide)" "True / Q2 / 3"
press '[data-act=exp-presenter-skip]'
last="$(step '')"
qa_ok "…and saying so where the reviewer is reading" "$(field stepText) / $(field credit)" "2/18 · Q2 · Explanation and framing / Loaded content · not authored here, so this quickstart topic stays open"
qa_ok "…and Next stays disabled while the topic outcome is not earned" "$(field nextDisabled)" "True"
IDX_P="$(field index)"
next_aid
last="$(step '')"
qa_ok "…and pressing Next on an unearned topic does not move the aid" "$(field index) / $(field stepText)" "$IDX_P / 2/18 · Q2 · Explanation and framing"
checkpoint provenance

qa_say "-- an unrelated authored edit never completes a quickstart topic"
W0="$(field writes)"
rename_once 'Renamed example'
last="$(step '')"
qa_ok "an authored edit that is not this topic's outcome is counted, and completes nothing" "$(field writes) / $(is 'd["credited"] == ""') / $(field stepText) / $(field nextDisabled)" "$((W0 + 1)) / True / 2/18 · Q2 · Explanation and framing / True"
checkpoint unrelated

# Three authored commands precede the capture: the rename above, this topic's own explanation edit, and the
# explanation of the moment whose framing the author accepts.
qa_say "-- a quickstart topic needs every outcome its own instruction authors"
W1=$((W0 + 2)); PL=$([ "$W1" = 1 ] && echo '' || echo 's')
UNDO_0="$(field undo)"; HASH_0="$(field hash)"
author_once "The casing protects the rotor, and this is authored here"
last="$(step '')"
qa_ok "an edit authored here is counted, named as authored, and is one Undo" "$(field source) / $(field writes) / $(field undo)" "Source · Load Example · $W1 authored edit$PL / $W1 / $((UNDO_0 + 1))"
# The explanation is one of the two outcomes this topic's instruction authors. The example's framing came
# with the loader, so writing the explanation alone leaves the topic open — and the aid says which half.
qa_ok "…while the explanation alone leaves the topic open: its framing came with the document" "$(field stepText) / $(field q2) / $(field creditState) / $(field credit)" "2/18 · Q2 · Explanation and framing / False / seen / Loaded content · not authored here, so this quickstart topic stays open"
checkpoint framing
# A moment of the author's own, made through the product's own doors: present the selected subject, write its
# explanation, then accept its framing by Capture. Those two authored outcomes are what complete the topic.
MOMENT="$(page '__me.S.experienceContext.presentation')"
last="$(step 'document.querySelector("#index [data-id=light]").click();')"
press '#card [data-act=exp-create]'
author_once "The light answers the machine, and this is authored here"
last="$(step '')"
qa_ok "…and an explanation on a moment made here is still only half of it" "$(field q2) / $(field writes)" "False / $((W1 + 2))"
press '#card [data-act=exp-capture]'
last="$(step '')"
qa_ok "…while an accepted Capture of the author's own framing completes it, where the reviewer is reading" "$(field stepText) / $(field q2) / $(field creditState) / $(field credit) / $(field writes)" "2/18 · Q2 · Explanation and framing / True / complete / Outcome seen · this topic is complete / $((W1 + 3))"
# The framing was accepted on that moment and no other. Back on the moment the topic was first read against —
# explained here, framed by the loader — the topic is open again, and says which half it is missing.
AUTHORED="$(page '__me.S.experienceContext.presentation')"
press "#index [data-act=exp-open][data-id=$MOMENT]"
last="$(step '')"
qa_ok "…and a Capture on another moment never stands in for the one the topic assesses" "$(field q2) / $(field creditState) / $(field credit)" "False / seen / Loaded content · not authored here, so this quickstart topic stays open"
checkpoint moment
# Back on the credited moment: the topic is about the moment the reviewer is looking at, and it is complete
# there again — the aid's own cursor never moved.
press "#index [data-act=exp-open][data-id=$AUTHORED]"
last="$(step '')"
qa_ok "…and returning to it credits the topic again, where the reviewer is reading" "$(field q2) / $(field tallyCount)" "True / 1"
checkpoint authored

qa_say "-- Next is earned by the topic outcome; Skip is the way past one that is not"
qa_ok "Next is enabled once the current topic outcome holds" "$(field nextDisabled)" "False"
next_aid
last="$(step '')"
qa_ok "…and Next advances to the next topic" "$(field index) / $(field stepText)" "2 / 3/18 · Q3 · Operate and Use"
back
last="$(step '')"
qa_ok "…and Back returns to the credited topic" "$(field index) / $(field stepText)" "1 / 2/18 · Q2 · Explanation and framing"
checkpoint earned-next

qa_say "-- Skip, Back and Next move the aid's cursor and nothing else"
IDX_0="$(field index)"
HASH_1="$(field hash)"; UNDO_1="$(field undo)"
BEFORE="$HASH_1 / $UNDO_1 / $(field sel) / $(field standing) / $(field tallyCount)"
press '[data-act=exp-presenter-skip]'
last="$(step '')"
qa_ok "Skip moves the aid exactly one topic on" "$(field index) / $(field stepText)" "$((IDX_0 + 1)) / 3/18 · Q3 · Operate and Use"
qa_ok "…without touching the documents, the history, the selection, the Camera or the tally" "$(field hash) / $(field undo) / $(field sel) / $(field standing) / $(field tallyCount)" "$BEFORE"
back
last="$(step '')"
qa_ok "Back returns it by exactly one, with everything else untouched" "$(field index) / $(field stepText) / $(field hash) / $(field undo)" "$IDX_0 / 2/18 · Q2 · Explanation and framing / $HASH_1 / $UNDO_1"
last="$(step 'for(let i=0;i<20;i++)__me.E.presenterSkip();')"
qa_ok "skipping past the end stops at the last topic instead of wrapping" "$(field index) / $(field stepText)" "17 / 18/18 · A10 · Lose and repair a capability"
qa_ok "…crediting no topic a reviewer only skipped through" "$(field credited) / $(field tallyCount)" "Q2 / 1"
last="$(step 'for(let i=0;i<20;i++)__me.E.presenterStep(-1);')"
qa_ok "Back stops at the first topic" "$(field index) / $(field stepText)" "0 / 1/18 · Q1 · Subject and Presentation"
qa_ok "…with the documents exactly as they were before the walk" "$(field hash) / $(field undo) / $(field sel) / $(field standing) / $(field tallyCount)" "$BEFORE"
checkpoint navigation

qa_say "-- the aid stays usable during Preview, read-only and without authoring controls"
last="$(step 'A.select(__me.ctx.experience.guide[0]);')"
press '[data-act=exp-expand-stop]'
press '[data-act=exp-preview-guide]'
last="$(step '')"
qa_ok "during the visit the aid is still there, marked as a visit's guidance" "$(field visitor) / $(field hidden) / $(field visiting)" "True / False / True"
qa_ok "…with every authoring control inside it unmounted" "$(is 'd["authoringHidden"] == [True]') / $(field loadersVisible)" "True / 0"
qa_okc "…and the instruction saying it is read-only" "$(field instruction)" "Read-only while Preview is active"
# Expanding a Stop moves the aid onto that moment, and Q2 is a topic about the moment on screen: the
# example's own framing came with the loader, so the topic is open there and the tally says so.
qa_ok "…while its cursor stays readable, and Q2 opens again on the moment the visit is about" "$(field stepText) / $(field q2) / $(field tallyCount)" "1/18 · Q1 · Subject and Presentation / False / 0"
# The aid's own navigation is not authoring: Back, Next and Skip stay usable while Preview is active.
IDX_V="$(field index)"
press '[data-act=exp-presenter-skip]'
last="$(step '')"
qa_ok "the aid's own navigation stays usable during Preview" "$(field visitor) / $(field index)" "True / $((IDX_V + 1))"
back
last="$(step '')"
qa_ok "…and Back returns to the same topic, still read-only" "$(field index) / $(field stepText)" "$IDX_V / 1/18 · Q1 · Subject and Presentation"
last="$(step 'document.querySelector("[data-act=exp-exit-preview]").click();')"
qa_ok "leaving the visit gives the authoring controls back, at the same topic" "$(field visitor) / $(is 'd["authoringHidden"] == [False]') / $(field loadersVisible) / $(field stepText)" "False / True / 3 / 1/18 · Q1 · Subject and Presentation"
checkpoint visit

qa_say "-- advanced topics read real outcomes, not loaded content"
PEEKS_0="$(field peeks)"
press '[data-act=exp-stop]'
last="$(step '')"
qa_ok "a quiet Peek selection records the Peek without expanding the occurrence" "$(field peeks) / $(field expanded)" "$((PEEKS_0 + 1)) / False"
last="$(step 'A.select(__me.ctx.experience.guide[0]);')"
press '[data-act=exp-preview-guide]'
last="$(step '__me.E.stepVisitor(6);')"
press '[data-act=exp-exit-preview]'
last="$(step '')"
qa_ok "a visit that ran no station invocation leaves Coordinate incomplete" "$(field a6) / $(field coordination)" "False / None"
# The visit's own ledger is the only witness to what it did: entering the first Stop is a visit to it, and
# Next travelling to the second is that Stop being reached. A topic about Travel reads both.
qa_say "-- a Guide visit that really travelled credits Travel with the Stop it entered"
last="$(step 'A.select(__me.ctx.experience.guide[0]);')"
press '[data-act=exp-preview-guide]'
last="$(step '')"
qa_ok "the visit opens its ledger with the Stop it entered, before any command" "$(field ledger) / $(field walked)" "1 / False"
press '[data-command=next]'
last="$(step '')"
qa_ok "…and records the Stop it travelled to as a traversal" "$(field ledger) / $(field walked)" "2 / True"
# The Stop is entered while the Camera is still flying its authored route: entering it is not arriving at it,
# and no journey is credited from the request — the destination entry is read from the Camera's own arrival.
qa_ok "…which stays travelling until the Camera really reaches the destination entry" "$(field visited) / $(field travelArrivals) / $(field q7) / $(field a4)" "travelling / 0 / False / False"
checkpoint arrival
last="$(step '__me.E.stepVisitor(6);')"
qa_ok "…and arrives where the Camera does, on the Seam's own route" "$(field visited) / $(field travelArrivals) / $(field q7)" "arrived / 1 / True"
press '[data-act=exp-exit-preview]'
last="$(step '')"
qa_ok "…so the supported Travel topic is credited by the visit that really made it" "$(field a4)" "True"
checkpoint advanced

qa_say "-- a capability sequence is the handover and the carried run the visitor ended"
last="$(step 'A.select(__me.ctx.experience.guide[0]);')"
press '[data-act=exp-preview-guide]'
last="$(step '__me.E.stepVisitor(6);')"
qa_ok "the casing completes and hands over to a rotor that is still carried as the visitor's live run" "$(field rotorState) / $(field stopped)" "running / 0"
press '[data-act=exp-exit-preview]'
last="$(step '')"
# The visit finished a capability and handed over to its dependent — and the topic is still not earned,
# because nothing carried was stopped by the visitor.
qa_ok "…while that sequence alone leaves the topic open: no carried run was stopped" "$(field a2) / $(field stopped)" "False / 0"
checkpoint sequence
last="$(step 'A.select(__me.ctx.experience.guide[0]);')"
press '[data-act=exp-preview-guide]'
last="$(step '__me.E.stepVisitor(6);')"
ROTOR="$(field rotor)"
press "[data-command=stop][data-id='$ROTOR']"
last="$(step '')"
qa_ok "…and the visitor's own Stop ends that carried run, live and on its authored lifetime" "$(field rotorState) / $(field stopped)" "stopped / 1"
press '[data-act=exp-exit-preview]'
last="$(step '')"
qa_ok "…which is what the capability-sequence topic is credited for" "$(field a2)" "True"
checkpoint a2

qa_say "-- narration completion is not a capability handover"
MAIN="$(page '__me.ctx.experience.stops[__me.ctx.experience.guide[0]].presentationId')"
ROTOR_USE="$(page 'Object.values(__me.ctx.experience.uses).find(u=>__me.ctx.experience.definitions[u.definitionId]?.capabilityId==="rotor").id')"
CASING_USE="$(page 'Object.values(__me.ctx.experience.uses).find(u=>__me.ctx.experience.definitions[u.definitionId]?.capabilityId==="casing").id')"
NARRATION_USE="$(page "Object.values(__me.ctx.experience.uses).find(u=>u.primaryFor==='$MAIN').id")"
open_rotor_relationships() {
  press "#index [data-act=exp-open][data-id=$MAIN]"
  qa_js '(()=>{[...document.querySelectorAll("#card summary")].find(s=>s.textContent.startsWith("Additional contributions")).click();return true;})()' >/dev/null
  press "#card [data-act=pres-ref][data-id=$ROTOR_USE]"
  qa_js '(()=>{[...document.querySelectorAll("#card summary")].find(s=>s.textContent.startsWith("Activity relationships")).click();return true;})()' >/dev/null
}
open_rotor_relationships
NARRATION_SIGNAL="$(page "JSON.stringify({useId:'$NARRATION_USE',signal:'complete'})")"
select_control "#card [data-exp-after='$ROTOR_USE']" "$NARRATION_SIGNAL"
press '[data-act=exp-preview-guide]'
last="$(step '__me.E.stepVisitor(20);')"
ROTOR="$(field rotor)"
press "[data-command=stop][data-id='$ROTOR']"
press '[data-act=exp-exit-preview]'
last="$(step '')"
qa_ok 'an explanation finishing never stands in for the capability completion handover' "$(field a2) / $(field handoffs)" 'False / 0'
checkpoint narration-handover
# Restore the example's capability dependency through the same authored door.
open_rotor_relationships
CASING_SIGNAL="$(page "JSON.stringify({useId:'$CASING_USE',signal:'complete'})")"
select_control "#card [data-exp-after='$ROTOR_USE']" "$CASING_SIGNAL"

qa_say "-- a handover is a dependent that really began, never one the visit left behind"
# Leaving the first Stop before its finite operation completes disarms the dependent: the rotor is stopped as
# a dependency the visit left, and it never starts, however the operation ends.
last="$(step 'A.select(__me.ctx.experience.guide[0]);')"
press '[data-act=exp-preview-guide]'
press '[data-command=next]'
last="$(step '__me.E.stepVisitor(6);')"
press '[data-act=exp-exit-preview]'
last="$(step '')"
qa_ok "…so the dependent the visit left behind is no handover, whatever else completed" "$(field handoffs) / $(field a2)" "0 / False"
checkpoint handover
# The policies comparison below reads the last visit's ledger, so leave it a single Stop entered once, exactly
# as a visit that was opened and closed without a command leaves it.
last="$(step 'A.select(__me.ctx.experience.guide[0]);')"
press '[data-act=exp-preview-guide]'
press '[data-act=exp-exit-preview]'
last="$(step '')"

qa_say "-- Stop entry policies are compared from the entries a visit ran"
# Two of the three policies through the product's own Stop control: a Stop entering through a specific later
# View of its Presentation, and one that keeps the visitor's viewpoint while its own content runs.
REPEAT="$(page '__me.ctx.experience.guide[2]')"
LATER="$(page '(()=>{const e=__me.ctx.experience,g=e.guide[2],p=e.presentations[e.stops[g].presentationId];const own=p.uses.find(id=>e.uses[id].role==="entry");return p.uses.find(id=>e.uses[id].viewId&&id!==own&&!e.uses[id].stopId)||null;})()')"
press "[data-act=exp-stop][data-id=$REPEAT]"
select_control '[data-exp-entry]' "$LATER"
WALL="$(page 'Object.values(__me.ctx.experience.presentations).find(p=>p.name==="The wall assembly").id')"
press "#index [data-act=exp-open][data-id=$WALL]"
press '#card [data-act=exp-add-guide]'
WALL_STOP="$(page '__me.ctx.experience.guide[3]')"
press "[data-act=exp-stop][data-id=$WALL_STOP]"
select_control '[data-exp-entry]' hold
last="$(step '')"
qa_ok "the three policies are authored through the Stop's own Entry control" "$(is 'all(k in d["entryKinds"].split(",") for k in ["presentation","use","hold"])') / $(field entryKinds)" "True / presentation,presentation,use,presentation,presentation,hold"
# Configuration is not a comparison: the policies above are what the author wrote, and the visit that ran
# them is the only witness. Until it runs all three, the topic stays open.
qa_ok "…while configured policies alone leave the topic open, with only the entries a visit really made" "$(field a3) / $(field entries)" "False / presentation:false:true:false"
checkpoint policies
last="$(step 'A.select(__me.ctx.experience.guide[0]);')"
press '[data-act=exp-preview-guide]'
last="$(step '__me.E.stepVisitor(6);')"
press '[data-command=next]'
last="$(step '__me.E.stepVisitor(6);')"
press '[data-command=next]'
last="$(step '__me.E.stepVisitor(6);')"
press '[data-command=next]'
last="$(step '__me.E.stepVisitor(1);')"
qa_ok "…and one visit that ran all three credits it, each where it actually happened" "$(field entries) / $(field a3)" "presentation:false:true:false,presentation:false:true:false,use:true:true:false,hold:false:true:true / True"
press '[data-act=exp-exit-preview]'
last="$(step '')"
qa_ok "…and the topic is still credited once the visit is over" "$(field a3)" "True"
checkpoint a3

qa_say "-- a Stop reached by Auto is as real as one reached by Next"
# The same four Stops, entered by the runtime's own pacing instead of by a command: Auto advances through the
# tick, so the visit's Stops and the policies they ran have to be read from the runtime, not from commands.
last="$(step 'A.select(__me.ctx.experience.guide[0]);')"
press '[data-act=exp-preview-guide]'
press '[data-command=auto]'
# One reading after the whole run: every intermediate entry and its outcomes must survive without the
# aid polling each Stop before the runtime proceeds to the next.
last="$(step '__me.E.stepVisitor(34);')"
qa_ok "…and with Auto on, all four Stops and their three entry policies land in the ledger" "$(field at) / $(field entries) / $(field a3)" "$WALL_STOP / presentation:false:true:false,presentation:false:true:false,use:true:true:false,hold:false:true:true / True"
checkpoint auto
press '[data-act=exp-exit-preview]'
last="$(step '')"
qa_ok "…and the Auto visit stays the evidence after it is over" "$(field a3)" "True"
checkpoint a3-auto

qa_say "-- a completed Travel survives the destination's queued View cues"
COMPARE="$(page '__me.ctx.experience.stops[__me.ctx.experience.guide[1]].presentationId')"
press "#index [data-act=exp-open][data-id=$COMPARE]"
author_once 'Look at the materials.'
TELLING="$(page "Object.values(__me.ctx.experience.uses).find(u=>u.primaryFor==='$COMPARE').id")"
qa_js '(()=>{[...document.querySelectorAll("#card summary")].find(s=>s.textContent.startsWith("Additional contributions")).click();return true;})()' >/dev/null
press "#card [data-act=pres-ref][data-id=$TELLING]"
qa_js '(()=>{[...document.querySelectorAll("#card summary")].find(s=>s.textContent.startsWith("Explanation timing")).click();return true;})()' >/dev/null
agent-browser fill '#card [data-exp-def=duration]' '0.1' >/dev/null 2>&1
qa_key_dispatch Enter
press '[data-act=exp-source-accept]'
CUE_SIGNAL="$(page "JSON.stringify({useId:'$TELLING',signal:'complete'})")"
for _ in $(seq 1 10); do
  press "#index [data-act=exp-open][data-id=$COMPARE]"
  press '#card [data-act=exp-capture]'
  CUE="$(page "__me.ctx.experience.presentations['$COMPARE'].uses.at(-1)")"
  press "#card [data-act=pres-ref][data-id=$CUE]"
  select_control '[data-exp-cue]' "$CUE_SIGNAL"
  press '[data-act=exp-source-accept]'
done
press '[data-act=exp-preview-guide]'
press '[data-command=next]'
last="$(step '__me.E.stepVisitor(60);')"
qa_ok 'a completed Travel stays credited after ten destination View cues' "$(field visited) / $(field travelArrivals) / $(field q7) / $(field a4)" 'arrived / 1 / True / True'
qa_ok 'the destination actually finishes its queued View cues' "$(page '__me.S.visitor.runtime.arrivedViewUseId')" "$CUE"
press '[data-act=exp-exit-preview]'
last="$(step '')"
checkpoint cues

qa_say "-- closing and reopening the aid disturbs nothing"
BEFORE="$(field hash) / $(field undo) / $(field sel) / $(field standing) / $(field stepText) / $(field tallyCount)"
close_aid
last="$(step '')"
qa_ok "the aid closes" "$(field open)" "False"
open_aid
last="$(step '')"
qa_ok "…and reopens at the same topic, on the same documents, with the same tally" "$(field hash) / $(field undo) / $(field sel) / $(field standing) / $(field stepText) / $(field tallyCount)" "$BEFORE"
qa_ok "no command or page fault through any of it" "$(field faults)" "0"
qa_browser_errors_ok "no console or page errors"
qa_summary "C9.9 · the review aid's eighteen topics"
