#!/usr/bin/env bash
# Stage S8 axis: full continuity between the two lenses.
#
# Minimum testing (see qa/README.md; session lifecycle in .agents/skills/browser-hygiene): one browser,
# one pass, one eval per block — a block performs its commands and returns every value its assertions
# need as a single JSON blob.
#
# What it proves, and only this:
#   * Both directions park: World readings/repairs/in-place work and Experience Guide/Seam/coordination/
#     Precision procedures each become an inactive record in their own lens, with no Camera snapshot.
#   * Resume is neutral: the reading or procedure is reactivated where the Camera actually stands, so
#     complete rendered Camera is identical before and after — for either lens.
#   * Preview return is exact: lens, canonical selection, Card context, accepted inspection (reading,
#     task, Reveal) and standpoint all come back, and the visitor's isolated session wrote nothing.
#   * History interleaves: crossings and Preview write no source step; accepted edits in either lens
#     share one Undo/Redo sequence; canceled drags write nothing.
#   * A lens switch cancels once: a live Camera framing drag is dropped, not parked or committed.
#
# Usage: qa/continuity-check.sh
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

export QA_OUT="${QA_OUT:-$QA_DIR/out/continuity}"
export QA_SHOT="${QA_SHOT:-0}"

# Everything an assertion here may need, read in the page, once per block.
BLOB='(() => {
  const S = window.__me.S, q = window.__me.qa, A = window.__me.A, ctx = window.__me.ctx, nav = window.__me.nav;
  const t = (s) => document.querySelector(s);
  const txt = (s) => { const e = t(s); return e ? e.textContent : null; };
  const real = q.realized();
  // One stable shape for both records: the World records readings as a chain, the Experience records a
  // procedure kind and its accepted parameter keys. Neither ever holds a Camera.
  const parked = (p) => p ? JSON.stringify({ name: p.name, identity: p.identity, kind: p.kind || null, chain: (p.chain||[]).map((c) => c.kind), params: Object.keys(p.params || {}), canceled: p.canceled || [] }) : null;
  return JSON.stringify({
    lens: S.lens, sel: S.sel,
    reading: S.session ? S.session.kind : "none",
    u: S.session && S.session.u != null ? S.session.u.toFixed(3) : null,
    task: S.task ? [S.task.kind, S.task.subject || "", (S.task.target && S.task.target.id) || "", (S.task.params && S.task.params.posture) || ""].join("|") : "none",
    depth: S.experienceContext.depth,
    parkedW: parked(S.parkedByLens.world), parkedE: parked(S.parkedByLens.experience),
    visitor: !!S.visitor,
    undo: S.undo.length, redo: S.redo.length, lastUndo: S.undo[S.undo.length - 1]?.label || null,
    hash: q.hash(), trail: S.trail.length,
    eye: JSON.stringify(real),
    cardKick: txt("#card .c-k"), cardTitle: txt("#card .c-t"),
    resumeBtn: !!t("#card [data-act=\"resume\"]"), expResumeBtn: !!t("#card [data-act=\"exp-resume\"]"),
    parkedNote: t("#card .relation.parked") ? t("#card .relation.parked").textContent : null,
    finder: t("#finder") ? !t("#finder").hidden : null,
    instr: !!(t("#instrument") && !t("#instrument").hidden && t("#instrument").children.length),
    deck: t("#experienceDeck") ? t("#experienceDeck").className : null,
    gripChip: !!t("#ovHtml [data-exp-camera]"),
    cameraDraft: !!S.cameraDraft, expDrag: !!S.expDrag,
    status: txt("#statusText"),
    faults: S.faults.length,
    drafting: S.wallDrafting !== false, motion: S.motion, trailPos: S.trailPos,
    rect: JSON.stringify(document.querySelector("#stage").getBoundingClientRect()),
  });
})()'

# One block: perform commands, then settle and read everything.
step() { # step <javascript statements>
  qa_jsv "(async () => { const A = window.__me.A, S = window.__me.S, E = window.__me.E, ctx = window.__me.ctx; $1 await window.__me.qa.idle(); await window.__me.qa.render(); return ${BLOB}; })()"
}
field() { python3 -c 'import json, sys
d = json.loads(sys.argv[1]); v = d.get(sys.argv[2])
print("None" if v is None else v)' "$last" "$1" 2>/dev/null; }
same() {
 # Complete rendered state, preserving the established World absolute tolerance.
 python3 - "$1" "$2" <<'PY'
import json,sys
def same(a,b):
    if type(a)!=type(b) and not isinstance(a,(float,int)):return False
    if isinstance(a,bool):return a==b
    if isinstance(a,(float,int)):return abs(a-b)<=.002
    if isinstance(a,dict):return a.keys()==b.keys() and all(same(a[k],b[k]) for k in a)
    if isinstance(a,list):return len(a)==len(b) and all(same(x,y) for x,y in zip(a,b))
    return a==b
a,b=json.loads(sys.argv[1]),json.loads(sys.argv[2]);matched=same(a,b)
if not matched: print(json.dumps({'actual_rendered':a,'expected_rendered':b}),file=sys.stderr)
print('same' if matched else 'MOVED')
PY
}

# The ordinary World state, established and verified before a block relies on it.
ordinary() { # ordinary [selection id]
  local id="${1:-gwin}" i
  for i in 1 2 3; do
    last="$(step "await A.closeAll(); A.endTaskInHand(); A.dismissParked(); A.select('$id');")"
    [ "$(field reading)" = none ] && [ "$(field task)" = none ] && return 0
  done
  return 1
}
# The ordinary Experience state, with nothing parked there and no procedure open.
ordinaryExp() {
  local i
  for i in 1 2 3; do
    last="$(step "A.switchLens('experience'); E.closeExperienceWork(); S.parkedByLens.experience = null;")"
    [ "$(field depth)" = ordinary ] && [ "$(field task)" = none ] && [ "$(field parkedE)" = None ] && return 0
  done
  return 1
}
# A real click on a lens, verified by the document state it must produce.
lens_to() { # lens_to <world|experience>
  local want="$1" i p x y
  for i in 1 2; do
    p="$(qa_at "#lens [data-act=\"lens\"][data-lens=\"$want\"]")"
    case "$p" in none | '' | null) sleep 0.5; continue ;; esac
    x="${p%,*}"; y="${p#*,}"
    qa_move "$x" "$y"; qa_down; qa_up
    last="$(step '')"
    [ "$(field lens)" = "$want" ] && return 0
  done
  qa_fail_msg "the $want lens did not come into hand"
  return 1
}
world() { lens_to world; }
experience() { lens_to experience; }
tap() { # tap <selector>
  local p x y
  p="$(qa_at "$1")"
  case "$p" in none | '' | null) qa_fail_msg "no live control at $1"; return 1 ;; esac
  x="${p%,*}"; y="${p#*,}"
  qa_move "$x" "$y"; qa_down; qa_up
  return 0
}

# ---------------------------------------------------------------- the axis

qa_open
qa_say "== Stage S8 · full continuity between the two lenses"
qa_faults_clear

qa_say "-- World reading, neutral Resume: the rendered standpoint does not move"
ordinary gwin || qa_fail_msg "could not reach the ordinary World state"
last="$(step "await A.face('gwin'); await A.unrollTo(0.5);")"
qa_ok "a half-unrolled World reading is open" "$(field reading) / $(field u)" "face / 0.500"
W_EYE="$(field eye)"; W_HASH="$(field hash)"; W_UNDO="$(field undo)"; W_TRAIL="$(field trail)"
experience
qa_ok "crossing parks the reading as an inactive record in the World's own map" "$(field parkedW) / $(field parkedE)" '{"name":"Garden window","identity":"gwin","kind":null,"chain":["face"],"params":[],"canceled":[]} / None'
qa_ok "…and the reading is really gone, with no Instrument in the other lens" "$(field reading) / $(field task) / $(field instr)" "none / none / False"
qa_ok "…with the realized eye and FOV exactly where the World left them" "$(same "$(field eye)" "$W_EYE")" "same"
qa_ok "…and no source, history or trail change" "$(field hash) / $(field undo) / $(field trail)" "$W_HASH / $W_UNDO / $W_TRAIL"
qa_press 1
last="$(step '')"
qa_ok "a real Camera key in the Experience moves the shared standpoint" "$(same "$(field eye)" "$W_EYE")" "MOVED"
M_EYE="$(field eye)"
world
last="$(step 'A.resumeParked();')"
qa_ok "Resume re-enters the reading with its decoded parameters" "$(field reading) / $(field u)" "face / 0.500"
qa_ok "…about the window and its host wall" "$(field task)" "face|gwin|rotunda|"
qa_ok "World Resume is neutral: complete rendered Camera stays at the current standpoint" "$(same "$(field eye)" "$M_EYE")" "same"
for frame in 1 2 3;do
 last="$(step '')"
 qa_ok "World neutral Resume remains fixed at rendered frame $frame" "$(same "$(field eye)" "$M_EYE")" same
done
qa_ok "…and it is a fresh invocation with a visible Instrument" "$(field instr) / $(field parkedW)" "True / None"
last="$(step "await A.closeAll(); A.dismissParked();")"

qa_say "-- Experience Guide, neutral Resume: the procedure is reactivated where you stand"
last="$(step "A.switchLens('experience'); await E.openPresentation('pres-highlights'); E.addToGuide(); E.guideOverview();")"
qa_ok "a Guide procedure is open in the Experience" "$(field depth) / $(field task) / $(field deck)" "overview / experience-overview|pres-highlights|| / exp-deck overview"
E_EYE="$(field eye)"
world
qa_ok "crossing parks the Experience procedure in its own map" "$(field parkedE) / $(field parkedW)" '{"name":"Saltmarsh Highlights","identity":"pres-highlights","kind":"experience-overview","chain":[],"params":[],"canceled":[]} / None'
qa_ok "…and the World's own reading is not parked by it" "$(field reading)" "none"
experience
qa_ok "coming back is ordinary: the procedure is inactive and the Camera has not moved" "$(field depth) / $(same "$(field eye)" "$E_EYE")" "ordinary / same"
qa_ok "…and Resume is offered on its own identity" "$(field expResumeBtn) / $(field parkedE)" 'True / {"name":"Saltmarsh Highlights","identity":"pres-highlights","kind":"experience-overview","chain":[],"params":[],"canceled":[]}'
tap '#card [data-act="exp-resume"]'
last="$(step '')"
qa_ok "Resume re-opens the Overview without moving the rendered standpoint" "$(field depth) / $(field task) / $(same "$(field eye)" "$E_EYE")" "overview / experience-overview|pres-highlights|| / same"
qa_ok "…and the record is consumed" "$(field parkedE)" "None"
last="$(step 'E.closeExperienceWork();')"

qa_say "-- Experience Precision parks and resumes with no Camera remembered"
last="$(step "await E.openPresentation('pres-highlights'); E.captureView(); const u=ctx.experience.presentations['pres-highlights'].uses[0]; S.probe={u}; E.preciseView(u);")"
PREC_USE="$(qa_jsv 'window.__me.S.probe.u')"
qa_ok "a Precision procedure is open on the captured framing" "$(field depth) / $(field task)" "precision / experience-camera|$PREC_USE|view-1|through"
P_EYE="$(field eye)"
world
qa_ok "crossing parks it with only the accepted parameters" "$(field parkedE)" "{\"name\":\"Entry framing\",\"identity\":\"$PREC_USE\",\"kind\":\"experience-camera\",\"chain\":[],\"params\":[\"useId\",\"posture\",\"grip\"],\"canceled\":[]}"
experience
tap '#card [data-act="exp-resume"]'
last="$(step '')"
qa_ok "Resume reports actual Through reading with Stage-local tape" "$(field depth) / $(field task) / $(field deck)" "precision / experience-camera|$PREC_USE|view-1|through / exp-deck ordinary"
qa_ok "…without moving the rendered standpoint" "$(same "$(field eye)" "$P_EYE")" "same"
last="$(step 'E.closeExperienceWork();')"

qa_say "-- Preview return: lens, selection, accepted inspection and standpoint all come back"
# Preview is entered where the inspection lives: the World lens holding a reading. Its return must be
# that reading's, not a lens-switch restore, and the visitor's isolated session must write nothing.
last="$(step "A.switchLens('world'); await A.closeAll(); A.select('gwin'); await A.face('gwin'); await A.unrollTo(0.5);")"
qa_ok "an accepted World reading stands before Preview" "$(field reading) / $(field task)" "face / face|gwin|rotunda|"
V_EYE="$(field eye)"; V_UNDO="$(field undo)"; V_HASH="$(field hash)"
last="$(step "E.preview('pres-highlights');")"
qa_ok "Preview takes the visitor over with authoring work suspended" "$(field visitor) / $(field reading) / $(field task) / $(field instr)" "True / none / none / False"
last="$(step 'await E.exitPreview();')"
qa_ok "exit restores the lens, the reading and the work in hand" "$(field lens) / $(field reading) / $(field task)" "world / face / face|gwin|rotunda|"
qa_ok "…the rendered standpoint exactly" "$(same "$(field eye)" "$V_EYE")" "same"
qa_ok "…and the isolated session wrote no source step" "$(field undo) / $(field hash)" "$V_UNDO / $V_HASH"
last="$(step 'await A.closeAll();')"

qa_say "-- Preview from an Experience procedure returns to that procedure"
last="$(step "A.switchLens('experience'); await E.openPresentation('pres-highlights'); const u=ctx.experience.presentations['pres-highlights'].uses[0]; S.probe={u}; E.preciseView(u);")"
PREC_USE2="$(qa_jsv 'window.__me.S.probe.u')"
qa_ok "a Precision procedure is open before Preview" "$(field depth) / $(field task)" "precision / experience-camera|$PREC_USE2|view-1|through"
Q_EYE="$(field eye)"
last="$(step "E.preview('pres-highlights');")"
qa_ok "Preview is running against isolated state" "$(field visitor)" "True"
last="$(step 'await E.exitPreview();')"
qa_ok "exit restores the same procedure, not the Experience's ordinary context" "$(field depth) / $(field task) / $(field deck)" "precision / experience-camera|$PREC_USE2|view-1|through / exp-deck ordinary"
qa_ok "…at the same rendered standpoint" "$(same "$(field eye)" "$Q_EYE")" "same"
last="$(step 'E.closeExperienceWork();')"

qa_say "-- interleaved history: crossings write nothing, edits share one sequence"
last="$(step "A.switchLens('world'); await A.closeAll(); A.select('gwin');")"
U0="$(field undo)"
last="$(step "await A.face('gwin');")"
last="$(step "A.switchLens('experience'); await E.openPresentation('pres-highlights'); E.updatePresentation('pres-highlights','meaning','QA continuity meaning');")"
U1="$(field undo)"
last="$(step "A.switchLens('world'); A.switchLens('experience'); A.switchLens('world'); A.switchLens('experience');")"
qa_ok "four crossings wrote no source step" "$(field undo)" "$U1"
qa_ok "…and the accepted Experience edit is the one step since the World reading" "$(python3 -c 'import sys; print(1 if int(sys.argv[1]) == int(sys.argv[2]) + 1 else 0)' "$U1" "$U0")" "1"
last="$(step "A.switchLens('world'); await A.closeAll(); await A.face('gwin');")"
qa_ok "a fresh World reading stands for the history block" "$(field reading) / $(field lastUndo) / $(field undo)" "face / Edit Presentation meaning / $U1"
U2="$(field undo)"
last="$(step "A.undo();")"
qa_okc "one Undo reaches the Experience edit from the World lens" "$(field status)" "Undid “Edit Presentation meaning”"
qa_ok "…and the World's own reading is untouched by it" "$(field reading) / $(field undo)" "face / $U0"
last="$(step "A.redo();")"
qa_okc "Redo restores the Experience edit" "$(field status)" "Redid “Edit Presentation meaning”"
qa_ok "…without restoring a standpoint, so the reading is still open" "$(field reading) / $(field undo)" "face / $U2"

qa_say "-- a crossing cancels a live Camera framing drag once, and parks nothing for it"
# The home 3D standpoint first: a Plan eye puts the authored position behind the camera, where no
# pointer can honestly reach it, and the home orbit keeps the framed target off the docked Deck — a
# grip projected under the Deck is as unreachable to a real author as to this harness.
last="$(step "await A.closeAll(); A.switchLens('world'); await A.resetView(); A.switchLens('experience'); E.captureView(); const u=ctx.experience.presentations['pres-highlights'].uses[0]; S.probe={u}; E.preciseView(u); S.task.params.grip='x'; ctx.ui();")"
PREC_USE3="$(qa_jsv 'window.__me.S.probe.u')"
qa_ok "the Precision procedure is open with a position grip" "$(field depth) / $(field task)" "precision / experience-camera|$PREC_USE3|view-1|outside"
D_HASH="$(field hash)"; D_UNDO="$(field undo)"
# A real pointer press on the grip chip, held across the crossing.
GRIP="$(qa_at '#ovHtml [data-exp-camera]')"
if [ -n "$GRIP" ] && [ "$GRIP" != none ] && [ "$GRIP" != null ]; then
  GX="${GRIP%,*}"; GY="${GRIP#*,}"
  qa_move "$GX" "$GY"; qa_down; qa_move "$((GX + 40))" "$((GY + 8))"
  last="$(step '')"
  qa_ok "a real pointer press on the grip chip starts a framing draft" "$(field cameraDraft)" "True"
  # Crossing while the pointer is still held. The mouse cannot do this — pointer capture routes any
  # release to the grip, so a click on the other lens ends (and may accept) the drag first. The real
  # path that can is the same lens button from the keyboard: Enter on the focused control crosses
  # with no pointer event, exactly the composition the cancel-once rule has to cover.
  qa_js "document.querySelector('#lens [data-lens=\"world\"]').focus()" >/dev/null
  qa_press Enter
  last="$(step '')"
  qa_ok "the crossing lands while the drag is still live" "$(field lens) / $(field cameraDraft)" "world / False"
  qa_ok "crossing drops the live framing drag, not a parked proposal" "$(field expDrag)" "False"
  qa_ok "…and the crossing wrote nothing for it" "$(field hash) / $(field undo)" "$D_HASH / $D_UNDO"
  experience
  qa_ok "the procedure is parked as the accepted work it was" "$(field parkedE) / $(field expResumeBtn)" "{\"name\":\"Entry framing\",\"identity\":\"$PREC_USE3\",\"kind\":\"experience-camera\",\"chain\":[],\"params\":[\"useId\",\"posture\",\"grip\"],\"canceled\":[]} / True"
  tap '#card [data-act="exp-resume"]'
  last="$(step '')"
  qa_ok "Resume re-opens it with no draft carried over" "$(field cameraDraft) / $(field depth) / $(field task)" "False / precision / experience-camera|$PREC_USE3|view-1|outside"
  qa_up
else
  qa_fail_msg "no grip chip on the drawing, so the framing-drag cancellation could not be exercised"
fi
last="$(step 'E.closeExperienceWork();')"

qa_say "-- World-only footer controls are inert in the Experience: refused in words, layout unchanged"
experience
last="$(step '')"
F_RECT="$(field rect)"; F_HASH="$(field hash)"; F_DRAFT="$(field drafting)"; F_MOTION="$(field motion)"; F_POS="$(field trailPos)"
tap '#draftBtn'
last="$(step '')"
qa_okc "Wall grid refuses by name from the Experience" "$(field status)" "Wall grid is World work"
tap '#motion [data-motion="instant"]'
last="$(step '')"
qa_okc "a Motion speed refuses by name too" "$(field status)" "Motion speeds are World work"
# The trail auto-scrolls to its newest entry, so the first stop can sit scrolled out of the strip —
# transport is refused whichever stop is pressed, and the newest one is the one a pointer reaches.
TRAILN="$(qa_js 'window.__me.S.trail.length')"
TRAILN="$((TRAILN - 1))"
tap "#trail [data-trail=\"$TRAILN\"]"
last="$(step '')"
qa_okc "trail transport refuses by name as well" "$(field status)" "That is World work"
qa_ok "…and nothing happened: no drafting, speed or trail change" "$(field drafting) / $(field motion) / $(field trailPos)" "$F_DRAFT / $F_MOTION / $F_POS"
qa_ok "…no source step, and the footer's layout and stage rect are exactly what they were" "$(field hash) / $(field rect)" "$F_HASH / $F_RECT"
last="$(step "A.switchLens('world');")"
qa_ok "back in the World the same controls work again" "$(field drafting) / $(field motion)" "$F_DRAFT / $F_MOTION"

qa_say "-- through all of it"
qa_ok "no command or page fault" "$(field faults)" "0"

qa_browser_errors_ok "no console or page errors"
qa_summary "Stage S8 · full continuity between the two lenses"
