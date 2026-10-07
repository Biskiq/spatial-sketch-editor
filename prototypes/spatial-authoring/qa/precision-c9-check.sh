#!/usr/bin/env bash
# C9.8 product axis: the precise Camera as one deliberate task (C9 C6, §8, J10, J11).
#
# What it proves, and only this:
#   * the full property list is deliberate depth in the Camera Card — never a floating cluster over the
#     drawing — and a Card property opens Precision on that View with that grip already selected;
#   * exactly one property is live on exactly one Stage tape, whichever route selected it: the Card's
#     property, a Stage grip by pointer, a Stage grip by keyboard, or the narrow shell's Card sheet;
#   * the drawn observer, aim and frustum are the evaluated geometry of the authored intent (checked
#     against an independent evaluation of the same pose), follow a live gesture and come back with it;
#   * Outside, Through and Plan keep their own marks on one tape, and Put it back returns to the
#     context the work was entered from rather than to a pose remembered when the task opened;
#   * a proposal still goes through Ask, and a declined one puts its tape back to the authored value:
#     no stale number, no history and no late commit.
#
# Two rules keep it honest: every value an assertion needs is read in the page once per block and
# compared locally, so an assertion costs no browser round trip; and nothing is assembled from a
# shell-expanded fragment, so a comparison can never be between two pieces of the same string.
#
# Usage: qa/precision-c9-check.sh
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_QUERY='motion=instant'
source "$QA_DIR/lib.sh"

export QA_OUT="${QA_OUT:-$QA_DIR/out/precision-c9}"
export QA_SHOT="${QA_SHOT:-0}"

# Everything an assertion here may need, read in the page, once per block.
BLOB='(() => {
  const S = window.__me.S, ctx = window.__me.ctx;
  const t = (s) => document.querySelector(s);
  const all = (s) => [...document.querySelectorAll(s)];
  const text = (s) => { const e = t(s); return e ? e.textContent : null; };
  const box = (s) => { const e = t(s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; };
  const v = S.task && S.task.target ? __me.nav.resolvedCamera().views[S.task.target.id] : null;
  // Independent evaluation of the authored intent: the documented field of view and the documented
  // eye/right/up construction, with no call into the page helpers that drew the marks.
  const indep = (p) => {
    const fov = Math.exp(Math.log(40) + (Math.log(.9) - Math.log(40)) * (p.flat || 0));
    const dist = p.frameH / (2 * Math.tan(fov * Math.PI / 360));
    const eye = p.target.map((n, i) => n + dist * [Math.cos(p.el) * Math.sin(p.az), Math.sin(p.el), Math.cos(p.el) * Math.cos(p.az)][i]);
    const right = [Math.cos(p.az), 0, -Math.sin(p.az)];
    const up = [-Math.sin(p.el) * Math.sin(p.az), Math.cos(p.el), -Math.sin(p.el) * Math.cos(p.az)];
    const h = p.frameH / 2;
    const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map((c) => ctx.stage.project(p.target.map((n, i) => n + right[i] * h * c[0] + up[i] * h * c[1])));
    return { eye, target: ctx.stage.project(p.target), corners };
  };
  const livePose = () => (S.cameraDraft && S.cameraDraft.pose) || (v && v.pose) || null;
  const want = (pt, dy) => [pt.x.toFixed(1) + "px", (pt.y + dy).toFixed(1) + "px"];
  const obs = t("[data-exp-observer]");
  const pose = livePose();
  const geom = pose ? (() => {
    const mine = indep(pose);
    const at = ctx.stage.project(mine.eye);
    const inst = __me.nav.framingInstrument(pose);
    const expFrustum = "M" + inst.corners.map((c) => ctx.stage.project(c)).map((c) => c.x.toFixed(1) + "," + c.y.toFixed(1)).join("L") + "Z";
    const aim = t(".exp-focus-ray"), fr = t("[data-camera-frustum]"), tg = mine.target;
    return {
      obsMatch: !!obs && obs.style.left === want(at, 28)[0] && obs.style.top === want(at, 28)[1],
      obsAt: obs ? [obs.style.left, obs.style.top] : null,
      obsWant: want(at, 28),
      aimExpected: "M" + at.x.toFixed(1) + "," + at.y.toFixed(1) + "L" + tg.x.toFixed(1) + "," + tg.y.toFixed(1),
      aimGot: aim ? aim.getAttribute("d") : null,
      frustumMatch: !!fr && fr.getAttribute("d") === expFrustum,
      rays: all(".exp-frustum-ray").length,
      gates: all("[data-frame-gate]").length,
      crosses: all(".exp-target").length,
      marks: all("[data-exp-observer],[data-camera-frustum],[data-frame-gate]").length,
      obs: !!t("[data-exp-observer]"),
      poseIsView: !!v && JSON.stringify(pose) === JSON.stringify(v.pose),
      poseNow: JSON.stringify(pose),
    };
  })() : null;
  const tape = t("[data-active-tape] input");
  const speed = t("#card [data-exp-view-speed]");
  return JSON.stringify({
    task: S.task ? [S.task.kind, S.task.subject, S.task.target && S.task.target.id, S.task.params.useId, S.task.params.grip, S.task.params.posture].join("|") : "none",
    grip: S.task && S.task.params ? S.task.params.grip : null,
    posture: S.task && S.task.params ? S.task.params.posture : null,
    depth: S.experienceContext.depth,
    undo: S.undo.length,
    undoLabel: S.undo.length ? (S.undo[S.undo.length - 1].label || null) : null,
    faults: S.faults.length,
    scopeCancelled: !!(S.expReview.scope && S.expReview.scope.cancelled),
    scopeAccepted: !!(S.expReview.scope && S.expReview.scope.accepted),
    scopeUndone: !!(S.expReview.scope && S.expReview.scope.label && (S.redo || []).some((e) => e.label === S.expReview.scope.label)),
    a9: (() => { const st = window.__me.E.presenterSteps().find((s) => s.title.startsWith("A9")); return st ? window.__me.E.presenterCredit(st).credited : null; })(),
    hash: window.__me.qa.hash(),
    viewHash: v ? JSON.stringify(ctx.cameraSource.views[v.id].pose) : null,
    standing: JSON.stringify(__me.nav.plainPose()),
    cardTitle: text("#card .c-t"),
    cardVerbs: (() => { const b = t("#card > .c-acts"); return b ? [...b.querySelectorAll("[data-act]")].map((x) => x.dataset.act).join(" ") : null; })(),
    focusedGrip: (() => { const e = document.activeElement; return e && e.dataset ? (e.dataset.grip || null) : null; })(),
    gripHits: all("#ovHtml [data-grip]").map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.grip, document.elementFromPoint(Math.round(r.x + r.width / 2), Math.round(r.y + r.height / 2)) === e]; }),
    preciseEntry: !!t("#card [data-act=exp-precise]"),
    propSummary: text("#card details.exp-more summary"),
    propOpen: !!(t("#card details.exp-more") || {}).open,
    propLabels: all("#card details.exp-more [data-grip]").map((b) => b.textContent).join(", "),
    propHint: text("#card details.exp-more .c-hint"),
    movement: speed ? ((speed.closest("details") || {}).querySelector ? (speed.closest("details").querySelector("summary") || {}).textContent || null : null) : null,
    movementExposed: speed ? (speed.closest("details") ? "in detail" : "in the card") : "missing",
    cardGrips: all("#card [data-grip]").length,
    instr: !!t("#experienceInstrument"),
    instrBox: box("#experienceInstrument"),
    instrGrips: all("#experienceInstrument [data-grip]").length,
    instrClusters: all("#experienceInstrument .camera-grips").length,
    clusters: all(".camera-grips").length,
    instrText: (t("#experienceInstrument") || {}).textContent || null,
    tapes: all("[data-active-tape]").length,
    tapeGrip: (t("[data-active-tape]") || { dataset: {} }).dataset.activeTape || null,
    inputs: all("[data-exp-precision]").length,
    inputGrip: (t("[data-exp-precision]") || { dataset: {} }).dataset.expPrecision || null,
    tapeValue: tape ? tape.value : null,
    tapeAttr: tape ? tape.getAttribute("value") : null,
    activeChips: all("[data-exp-camera]").length,
    plainChips: all("[data-act=exp-grip]").length,
    ask: !!S.expAsk,
    askActs: all(".ask-rule [data-act]").map((b) => b.dataset.act).join(" "),
    askText: (t(".ask-rule") || {}).textContent || null,
    draft: !!(S.cameraDraft && S.cameraDraft.pose),
    stageVisible: (() => { const r = box("#stage"); return !!r && r[2] > 300 && r[3] > 300; })(),
    sheetOpen: document.body.classList.contains("sheet-card"),
    sheetToggle: !!t("[data-act=sheet-card]"),
    geom,
  });
})()'

# ---------------------------------------------------------------- driving

# One eval that performs a command and returns the blob, with the queue settled and a frame drawn.
step() { # step <javascript statements>
  qa_jsv "(async () => { const A = window.__me.A; $1 await window.__me.qa.idle(); await window.__me.qa.render(); return ${BLOB}; })()"
}

# Values out of the last blob, compared locally so an assertion costs nothing in the browser.
field() { python3 -c 'import json, sys
d = json.loads(sys.argv[1]); v = d.get(sys.argv[2])
print("None" if v is None else (v if isinstance(v, str) else (str(v) if isinstance(v, bool) else json.dumps(v))))' "$last" "$1" 2>/dev/null; }
# A computed comparison inside the blob, so a list or a nested value never has to be formatted twice.
is() { python3 -c 'import json, sys
d = json.loads(sys.argv[1]); print(eval(sys.argv[2], {"d": d, "json": json}))' "$last" "$1" 2>/dev/null; }

# A real pointer click on the control itself, through the product's own handler where a covering band
# would otherwise take the hit — the same rule the other product recipes use.
press() { qa_js "(()=>{const e=document.querySelector(\"$1\");if(!e)return false;e.click();return true;})()" >/dev/null; qa_frames; }
pointer() { # pointer <selector>
  local p x y
  p="$(qa_at "$1")"
  case "$p" in none | '' | null) qa_fail_msg "no element to click: $1"; return 1 ;; esac
  x="${p%,*}"; y="${p#*,}"
  qa_move "$x" "$y"; qa_down; qa_up
}
# The example is a disclosure in the head; open it, load, close it again.
fixture() { press '#experienceExamples > summary'; press "[data-act='$1']"; press '#experienceExamples > summary'; }
# A mutation stops at the first boundary it protects, so later unrelated state cannot mask it.
checkpoint() { if [ "${QA_PRECISION_C9_UNTIL:-}" = "$1" ]; then qa_summary "C9.8 boundary $1"; exit; fi; }
# A disclosure is deliberate depth: the author opens it before choosing. A closed details still reports a
# layout box in this shell, but its content is not hit-testable, so the list is opened the way an author
# opens it and the property is then reached by a real pointer.
open_props() { qa_js "(()=>{const d=document.querySelector(\"#card details.exp-more\");if(!d||d.open)return false;d.querySelector(\"summary\").click();return true;})()" >/dev/null; qa_frames; }
caret_here() { [ "$(qa_jsv '(()=>{const e=document.activeElement;return !!(e&&e.dataset&&"expPrecision" in e.dataset)})()')" = "true" ]; }
# Type a number into the one live tape with a real caret and a real Enter.
type_tape() { # type_tape <value>
  local i p
  for i in 1 2 3; do
    p="$(qa_at '[data-exp-precision]')"
    case "$p" in none | '' | null) last="$(step '')"; continue ;; esac
    qa_move "${p%,*}" "${p#*,}"; qa_down; qa_up
    caret_here || continue
    agent-browser fill '[data-exp-precision]' "$1" >/dev/null 2>&1
    caret_here || continue
    qa_key_dispatch Enter
    return 0
  done
  qa_fail_msg "the tape never took the caret for $1"
  return 1
}

# ---------------------------------------------------------------- the axis

qa_open
qa_say "== C9.8 · the precise Camera, its depth and one tape"
qa_faults_clear

qa_say "-- the property list is deliberate depth in the Camera Card"
press '#lens [data-lens=experience]'
fixture exp-example
press '#experienceDeck [data-act=exp-guide]'
last="$(step 'A.select("use-16");')"
UNDO_0="$(field undo)"
STANDING="$(field standing)"
qa_ok "the Camera Card names the View use and offers the precise Camera while no Camera work is active" "$(field cardTitle) / $(field preciseEntry) / $(field cardVerbs)" "Machine overview / True / exp-precise exp-bring"
qa_ok "the full property list is one Card disclosure, named for what each property does" "$(field propSummary) / $(field propLabels)" "Precise Camera · properties / Frame height, Aim horizontally, Aim vertically, Target X, Target height, Target Z"
qa_okc "…and says where the value will be live" "$(field propHint)" "one value is live at a time on its Stage tape"
qa_ok "the ordinary Movement writer is deliberate depth in the Card, not an exposed field" "$(field movement) / $(field movementExposed)" "Camera request preference · Movement / in detail"

qa_say "-- one Card property opens Precision on that View with that grip already selected"
open_props
last="$(step '')"
qa_ok "the property list is a disclosure the author opens, closed until asked for" "$(field propOpen)" "True"
pointer '#card details.exp-more [data-grip=x]'
last="$(step '')"
qa_ok "the Card property opens the precise Camera on that View and use, with that grip selected" "$(field task)" "experience-camera|use-16|view-1|use-16|x|outside"
qa_ok "…as the precision depth of the Experience lens" "$(field depth)" "precision"
qa_ok "exactly one property is live on exactly one Stage tape" "$(field tapes) / $(field tapeGrip) / $(field inputs) / $(field inputGrip)" "1 / x / 1 / x"
qa_ok "…with one gesture grip and the other five offered as direct selection" "$(field activeChips) / $(field plainChips)" "1 / 5"
qa_ok "every offered grip has its own hit test, on a seat no other grip covers" "$(is 'all(h[1] for h in d["gripHits"])') / $(is 'sorted(h[0] for h in d["gripHits"]) == ["az","el","frameH","x","y","z"]')" "True / True"
qa_ok "…and the Instrument names it, keeping the full list in the Card" "$(field cardGrips) / $(field instrGrips) / $(field instrClusters) / $(field clusters)" "6 / 0 / 0 / 0"
qa_okc "the deliberate depth is named where the author is working" "$(field instrText)" "Active property · Target X"
qa_ok "no redundant precise-entry button is offered while the precise Camera work is active" "$(field preciseEntry)" "False"
checkpoint entry

qa_say "-- a supported grip is selected directly on the drawing, by pointer and by keyboard"
pointer '[data-act=exp-grip][data-grip=el]'
last="$(step '')"
qa_ok "a pointer on a drawing grip makes that property the one live value" "$(field grip) / $(field tapeGrip) / $(field tapes) / $(field activeChips) / $(field plainChips)" "el / el / 1 / 1 / 5"
qa_okc "…and the Instrument says which one it is" "$(field instrText)" "Active property · Aim vertically"
qa_ok "switching the property writes nothing and asks nothing" "$(field undo) / $(field ask)" "$UNDO_0 / False"
last="$(step 'document.querySelector("[data-act=exp-grip][data-grip=frameH]").focus();')"
qa_ok "a drawing grip is a real control, so the keyboard can reach it" "$(field focusedGrip)" "frameH"
qa_key_dispatch Enter
last="$(step '')"
qa_ok "activating that grip from the keyboard leaves the same single tape and one input" "$(field grip) / $(field tapeGrip) / $(field tapes) / $(field inputs)" "frameH / frameH / 1 / 1"
checkpoint grips

qa_say "-- the drawn observer, aim and frustum are the evaluated geometry of the authored intent"
qa_ok "the observer mark is the independently evaluated eye of the View's own pose" "$(is 'd["geom"]["obsMatch"]') / $(is 'd["geom"]["obsAt"] == d["geom"]["obsWant"]')" "True / True"
qa_ok "…the aim ray runs from that same eye to that same target" "$(is 'd["geom"]["aimGot"] == d["geom"]["aimExpected"] and d["geom"]["aimGot"] is not None')" "True"
qa_ok "…and the frustum is the same View's evaluated instrument, ray by ray" "$(is 'd["geom"]["frustumMatch"] and d["geom"]["rays"] == 4')" "True"
UNDO_G="$(field undo)"; HASH_G="$(field hash)"; VIEW_G="$(field viewHash)"
POSE_G="$(field standing)"
P="$(qa_at '[data-exp-camera]')"
qa_move "${P%,*}" "${P#*,}"; qa_down; qa_move "${P%,*}" "$(( ${P#*,} + 40 ))"
last="$(step '')"
qa_ok "a live gesture draws the observer from the pose being proposed, not from the last accepted one" "$(field draft) / $(is 'd["geom"]["obsMatch"]') / $(is 'd["geom"]["poseIsView"]')" "True / True / False"
qa_ok "…while the authored Camera and the history are untouched mid-gesture" "$(field viewHash) / $(field undo)" "$VIEW_G / $UNDO_G"
qa_key_dispatch Escape; qa_up
last="$(step '')"
qa_ok "cancelling the gesture puts the drawn geometry back on the authored pose exactly" "$(field draft) / $(is 'd["geom"]["obsMatch"] and d["geom"]["aimGot"] == d["geom"]["aimExpected"] and d["geom"]["frustumMatch"]')" "False / True"
qa_ok "…with no source write and no history from the gesture" "$(field viewHash) / $(field hash) / $(field undo) / $(field standing)" "$VIEW_G / $HASH_G / $UNDO_G / $POSE_G"
checkpoint geometry

qa_say "-- Outside, Through and Plan keep their own marks, and Put it back returns to the context entered"
press '[data-act=exp-posture][data-posture=through]'
last="$(step '')"
qa_ok "Through stands the Camera at the View's own intent" "$(field posture) / $(is 'd["geom"]["poseIsView"]')" "through / True"
qa_ok "…drawing its gate and both target axes instead of the observer frustum" "$(is 'd["geom"]["gates"] == 1 and d["geom"]["crosses"] == 2 and d["geom"]["rays"] == 0')" "True"
qa_ok "…with one live tape and no observer mark standing inside the view" "$(field tapes) / $(is 'd["geom"]["rays"] == 0 and not d["geom"]["obs"]')" "1 / True"
press '[data-act=exp-posture][data-posture=plan]'
last="$(step '')"
qa_ok "Plan reports the plan reading and keeps the evaluated observer and frustum on one tape" "$(field posture) / $(is 'd["geom"]["obsMatch"] and d["geom"]["frustumMatch"] and d["geom"]["rays"] == 4') / $(field tapes)" "plan / True / 1"
qa_ok "no posture write reaches history" "$(field undo)" "$UNDO_G"
# P2: choosing another property from the Card addresses the same View without restarting Precision, so the
# return position captured when the work began is kept rather than overwritten at the second property.
open_props
pointer '#card details.exp-more [data-grip=z]'
last="$(step '')"
qa_ok "a Card property switch addresses the same View without restarting Precision" "$(field grip) / $(field task)" "z / experience-camera|use-16|view-1|use-16|z|plan"
press '[data-act=exp-camera-return]'
last="$(step '')"
qa_ok "Put it back returns to the standpoint the work was entered from, not to a pose captured at the second property" "$(field standing)" "$STANDING"
qa_ok "…reporting the reading there rather than the pose it was moved to" "$(field posture) / $(field undo)" "outside / $UNDO_G"
qa_ok "…and leaving the one tape and its switched property alone" "$(field tapes) / $(field tapeGrip)" "1 / z"
open_props
pointer '#card details.exp-more [data-grip=frameH]'
last="$(step '')"
qa_ok "…the Card property list still addresses the same one View" "$(field grip) / $(field tapes)" "frameH / 1"
checkpoint postures

qa_say "-- a proposal goes through Ask; a declined one puts its one tape back with no late commit"
AUTHORED="$(field tapeValue)"
NEXT="$(python3 -c "print(round(float('$AUTHORED')+1.5,3))")"
type_tape "$NEXT"
last="$(step '')"
qa_ok "a typed value in a shared View is a proposal, not an edit" "$(field ask) / $(field undo) / $(field askActs)" "True / $UNDO_G / exp-scope-shared exp-scope-local exp-scope-cancel"
qa_okc "…naming the affected uses before anything is written" "$(field askText)" "Affects Understand the drive, Compare materials"
press '[data-act=exp-scope-cancel]'
last="$(step '')"
qa_ok "declining puts the authored value back on its one tape" "$(field tapeValue) / $(field tapeAttr)" "$AUTHORED / $AUTHORED"
qa_ok "…writing nothing, asking nothing and keeping the one tape" "$(field hash) / $(field undo) / $(field ask) / $(field tapes)" "$HASH_G / $UNDO_G / False / 1"
qa_key_dispatch Enter
last="$(step '')"
qa_ok "a late Enter cannot commit the value that was just declined" "$(field ask) / $(field undo) / $(field hash)" "False / $UNDO_G / $HASH_G"
type_tape "$NEXT"
last="$(step '')"
qa_ok "typing again is a fresh proposal" "$(field ask)" "True"
press '[data-act=exp-scope-shared]'
last="$(step '')"
qa_ok "accepting the proposal is exactly one Undo, labelled for the shared Camera framing" "$(field undo) / $(field undoLabel) / $(field ask)" "$((UNDO_G + 1)) / Update shared Camera framing / False"
qa_ok "…re-rendering the one tape at the accepted value, on the same single property" "$(field tapeValue) / $(field tapes) / $(field inputs) / $(field tapeGrip)" "$NEXT / 1 / 1 / frameH"
checkpoint draft

qa_say "-- the narrow shell's Card sheet reaches the same property depth"
agent-browser set viewport 540 900 >/dev/null 2>&1
last="$(step '')"
qa_ok "at the narrow width the Stage is still the working surface, with the work and its one tape intact" "$(field stageVisible) / $(field tapes) / $(field grip) / $(is 'd["instrBox"] and d["instrBox"][2] > 100')" "True / 1 / frameH / True"
qa_ok "…and the Card is offered as a sheet over it, closed and carrying the full list" "$(field sheetToggle) / $(field sheetOpen) / $(field cardGrips)" "True / False / 6"
press '[data-act=sheet-card]'
last="$(step '')"
qa_ok "the sheet opens with the same six properties" "$(field sheetOpen) / $(field cardGrips)" "True / 6"
open_props
pointer '#card details.exp-more [data-grip=y]'
last="$(step '')"
qa_ok "a property chosen in the sheet becomes the one live value, exactly as on the wide Card" "$(field grip) / $(field tapeGrip) / $(field tapes) / $(field inputs) / $(field depth)" "y / y / 1 / 1 / precision"
press '[data-act=sheet-card]'
last="$(step '')"
qa_ok "closing the sheet leaves the precise work and its tape untouched" "$(field sheetOpen) / $(field grip) / $(field tapes) / $(field undo)" "False / y / 1 / $((UNDO_G + 1))"
agent-browser set viewport 1440 900 >/dev/null 2>&1
last="$(step '')"
qa_ok "the wide shell returns with the same single live property" "$(field tapes) / $(field grip) / $(field stageVisible)" "1 / y / True"
checkpoint narrow

qa_say "-- the scope topic reads cancellation, acceptance and Undo as separate observations (C9.9 A9)"
qa_ok "a cancelled proposal and an accepted shared edit are both remembered, before any Undo" "$(is 'd["scopeCancelled"] and d["scopeAccepted"]') / $(field scopeUndone) / $(field a9)" "True / False / False"
press '#undoBtn'
last="$(step '')"
qa_ok "…and Undo of that accepted edit is observed, completing the scope topic" "$(field scopeUndone) / $(field a9)" "True / True"

qa_say "-- closing ends the precise Camera work and gives the ordinary entry back"
press '[data-act=exp-close]'
last="$(step '')"
qa_ok "closing ends the precise work and takes its tape with it" "$(field task) / $(field tapes) / $(field instr)" "none / 0 / False"
qa_ok "…offering the precise Camera again as the ordinary Card verb" "$(field preciseEntry) / $(field cardGrips)" "True / 6"
qa_ok "no command or page fault through any of it" "$(field faults)" "0"
qa_browser_errors_ok "no console or page errors"
qa_summary "C9.8 · the precise Camera, its depth and one tape"
