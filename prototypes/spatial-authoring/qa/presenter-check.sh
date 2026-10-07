#!/usr/bin/env bash
# C9.9 product axis: the review aid's eighteen topics and its own honesty (C9 §8, J1–J11).
#
# What it proves, and only this:
#   * the aid carries eighteen topics, each with a real instruction and a predicate read from authored
#     documents or from what the product actually reported — never from a field being present or a
#     button having been pressed;
#   * provenance is explicit: the aid names the loader that produced the document on screen and how many
#     edits were authored here, and loaded content credits no quickstart topic;
#   * one authored edit is what flips a quickstart topic to complete, on the document it was authored on;
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

# Two authored commands precede this one: the rename above, and this topic's own explanation edit.
qa_say "-- one authored edit is what credits a quickstart topic"
W1=$((W0 + 2)); PL=$([ "$W1" = 1 ] && echo '' || echo 's')
UNDO_0="$(field undo)"; HASH_0="$(field hash)"
author_once "The casing protects the rotor, and this is authored here"
last="$(step '')"
qa_ok "an edit authored here is counted, named as authored, and is one Undo" "$(field source) / $(field writes) / $(field undo)" "Source · Load Example · $W1 authored edit$PL / $W1 / $((UNDO_0 + 1))"
qa_ok "…crediting the topic whose outcome that authoring completes, where the reviewer is reading" "$(field stepText) / $(field credited) / $(field creditState) / $(field credit)" "2/18 · Q2 · Explanation and framing / Q2 / complete / Outcome seen · this topic is complete"
qa_ok "…and the tally counts it once" "$(field tallyCount)" "1"
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
qa_ok "…while its cursor and its tally stay readable" "$(field stepText) / $(field tallyCount)" "1/18 · Q1 · Subject and Presentation / 1"
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
press '[data-act=exp-exit-preview]'
last="$(step '')"
qa_ok "…so the supported Travel topic is credited by the visit that really made it" "$(field a4)" "True"
checkpoint advanced

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
