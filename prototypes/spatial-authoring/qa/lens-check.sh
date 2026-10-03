#!/usr/bin/env bash
# Stage S6 axis: the lens, parked World work and explicit Resume.
#
# Minimum testing (see qa/README.md; session lifecycle in .agents/skills/browser-hygiene): one browser,
# one pass, one eval per block — a block performs its command and returns every value its assertions
# need as a single JSON blob.
#
# What it proves, and only this:
#   * Crossing lenses parks World work as an *inactive* record, not a hidden session: the reading is
#     really torn down (the wall's unroll is back to zero, no Instrument stands, no knife, no preview),
#     the realized eye and FOV do not move, and no source, history or trail entry is written.
#   * The bridge is one read-only continuity fixture sharing this one selection slot and this Camera:
#     Select Presentation and Select referenced window are the only identities it offers, ordinary
#     Camera input still works, and World work and Search are refused by name from inside it.
#   * Return is ordinary: no reading, no Instrument, no restored Browse/Search and no Camera
#     restoration. Resume is contextual — offered on the parked identity, explained locally when the
#     selection moved on, and refused rather than guessed when the target or its relationship changed.
#   * Resume is a fresh invocation: reading parameters are reapplied, no Camera snapshot is restored,
#     the return context starts at the standpoint where Resume was asked for, and Put it back returns
#     there — movement made in the other lens survives.
#   * A lens switch cancels once: an open numeric draft and a live line aim leave no value behind, and
#     late keys cannot commit or revive anything.
#
# Usage: qa/lens-check.sh
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

export QA_OUT="${QA_OUT:-$QA_DIR/out/lens}"
export QA_SHOT="${QA_SHOT:-0}"

# Everything an assertion here may need, read in the page, once per block.
BLOB='(() => {
  const S = window.__me.S, q = window.__me.qa, A = window.__me.A, ctx = window.__me.ctx;
  const t = (s) => document.querySelector(s);
  const txt = (s) => { const e = t(s); return e ? e.textContent : null; };
  const st = q.state();
  const real = q.realized();
  const art = (id) => ctx.museum.art.find((a) => a.id === id) || null;
  const fieldOf = (needle) => { const i = [...document.querySelectorAll("#card input[data-field]")].find((x) => (x.getAttribute("data-field") || "").includes(needle)); return i ? i.value : null; };
  const w = ctx.museum.walls.find((x) => x.id === "rotunda");
  return JSON.stringify({
    lens: S.lens,
    sel: S.sel,
    reading: S.session ? [S.session.kind, S.session.wallId || S.session.ceilId || "", S.session.focusId || ""].join("/") : "none",
    u: S.session && S.session.u != null ? S.session.u.toFixed(3) : null,
    side: S.session ? String(S.session.side) : null,
    origin: S.session && S.session.origin ? S.session.origin.label : null,
    crumbs: A.crumbs().length,
    task: S.task ? [S.task.kind, S.task.subject, (S.task.target && S.task.target.id) || "", (S.task.params && "wall" in S.task.params) ? (S.task.params.wall === null ? "wall:null" : "wall:" + S.task.params.wall) : "", (S.task.focus && S.task.focus.kind) || ""].join("|") : "none",
    knife: !!S.knife,
    parked: st.parked,
    parkedJson: st.parked ? JSON.stringify(st.parked) : null,
    parkedChain: st.parked ? st.parked.chain.join(",") : null,
    parkedOk: st.parked ? st.parked.ok : null,
    held: st.flatHold != null,
    undo: S.undo.length, hash: q.hash(), trail: S.trail.length,
    eye: JSON.stringify(real.eye.map((v) => +v.toFixed(4))),
    fov: String(+real.fov.toFixed(4)),
    finder: t("#finder") ? !t("#finder").hidden : null,
    instr: !!(t("#instrument") && !t("#instrument").hidden && t("#instrument").children.length),
    indexTitle: txt("#index .ix-title"),
    indexRows: document.querySelectorAll("#index .ix-row").length,
    cardKick: txt("#card .c-k"), cardTitle: txt("#card .c-t"),
    resumeBtn: !!t("#card [data-act=\"resume\"]"),
    parkedSel: t("#card [data-act=\"sel\"]") ? t("#card [data-act=\"sel\"]").dataset.id : null,
    parkedNote: t("#card .relation.parked") ? t("#card .relation.parked").textContent : null,
    presVerb: !!t("#index [data-act=\"pres-sel\"]"),
    slotVerb: !!t("#index [data-act=\"pres-ref\"]"),
    preview: ctx.stage.previewPlace ? JSON.stringify(ctx.stage.previewPlace) : null,
    unroll: ctx.stage.items.has("rotunda") ? +(ctx.stage.d("rotunda").u || 0).toFixed(3) : null,
    gwinHead: w.openings.find((o) => o.id === "gwin").head,
    fieldW: w.openings.find(o => o.id === "gwin").w.toFixed(2),
    typein: t("#typein") ? !t("#typein").hidden : null,
    harborHost: art("harbor") ? art("harbor").wall : null,
    panelGone: !art("panel"),
    status: txt("#statusText"),
    faults: S.faults.length,
  });
})()'

# ---------------------------------------------------------------- driving

step() { # step <javascript statements>
  qa_jsv "(async () => { const A = window.__me.A, S = window.__me.S, ctx = window.__me.ctx; $1 await window.__me.qa.idle(); await window.__me.qa.render(); return ${BLOB}; })()"
}

field() { python3 -c 'import json, sys
d = json.loads(sys.argv[1]); v = d.get(sys.argv[2])
print("None" if v is None else v)' "$last" "$1" 2>/dev/null; }
eyediff() { python3 -c 'import json, sys
a = json.loads(sys.argv[1]); b = json.loads(sys.argv[2])
d = round(max(abs(x - y) for x, y in zip(a, b)), 4)
print(0 if d == 0 else d)' "$1" "$2" 2>/dev/null; }

# A real pointer click on a live control.
tap() { # tap <selector>
  local p x y
  p="$(qa_at "$1")"
  case "$p" in none | '' | null) qa_fail_msg "no live control at $1"; return 1 ;; esac
  x="${p%,*}"; y="${p#*,}"
  qa_move "$x" "$y"; qa_down; qa_up
  return 0
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

# A real click on a lens, verified by the document state it must produce — and retried once, because a
# click issued while the page is still settling is a harness race, not a product failure.
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
bridge() { lens_to experience; }
world() { lens_to world; }

# ---------------------------------------------------------------- the axis

qa_open
qa_say "== Stage S6 · the lens, parked work and explicit Resume"
qa_faults_clear

qa_say "-- crossing with nothing in hand: an ordinary context, and the same Camera"
ordinary gwin || qa_fail_msg "could not reach the ordinary state before the crossing block"
E0="$(field eye)"; F0="$(field fov)"; H0="$(field hash)"; U0="$(field undo)"; TR0="$(field trail)"
bridge
qa_ok "crossing changes the lens in hand" "$(field lens)" "experience"
qa_ok "nothing was in hand, so nothing was parked" "$(field parked)" "None"
qa_ok "the bridge lists its one Presentation and the World subject it references" "$(field indexTitle) / $(field indexRows) / $(field presVerb) / $(field slotVerb)" "Saltmarsh Highlights / 2 / True / True"
qa_okc "…and the Card for the selected World subject says whose subject it is" "$(field cardKick)" "From the World lens · read-only here"
qa_ok "the Camera is exactly where the World left it" "$(eyediff "$(field eye)" "$E0")" "0"
qa_okn "…FOV and framing included" "$(field fov)" "$F0" "0.001"
qa_ok "…and nothing was written: no building change, no history, no trail entry" "$(field hash) / $(field undo) / $(field trail)" "$H0 / $U0 / $TR0"
qa_ok "no World Instrument stands in the bridge" "$(field instr)" "False"
qa_press /
last="$(step '')"
qa_okc "Search is refused by name from inside the bridge" "$(field status)" "Search is World work"
qa_ok "…and no listing was opened" "$(field finder)" "False"
last="$(step "await A.face('gwin');")"
qa_okc "World work is refused by name too, and nothing opened" "$(field status)" "That is World work"
qa_ok "…with no reading, no work in hand and no history" "$(field reading) / $(field task) / $(field undo)" "none / none / $U0"

qa_say "-- the two identities the bridge offers: the Presentation, and the window it references"
tap '#index [data-act="pres-sel"]'
last="$(step '')"
qa_ok "Select Presentation changes the canonical identity to the fixture itself" "$(field sel) / $(field cardTitle)" "pres-highlights / Saltmarsh Highlights"
qa_ok "…and its Card is the fixture's own, not the World's" "$(field cardKick)" "Experience · continuity fixture"
qa_okc "…announcing what this lens really is" "$(field status)" "read-only continuity fixture"
qa_ok "…without opening anything or moving the Camera" "$(field reading) / $(field eye)" "none / $E0"
tap '#card [data-act="pres-ref"]'
last="$(step '')"
qa_ok "Select referenced window selects the World subject by identity" "$(field sel) / $(field cardTitle)" "gwin / Garden window"
qa_okc "…and the Card says whose subject it is" "$(field cardKick)" "From the World lens"
qa_ok "selection stays selection in the bridge: nothing opened, nothing written" "$(field reading) / $(field undo) / $(field eye)" "none / $U0 / $E0"
world
qa_ok "coming back is ordinary: no reading, no work, no Instrument, no listing" "$(field reading) / $(field task) / $(field instr) / $(field finder)" "none / none / False / False"
qa_ok "…with the Camera still where the bridge left it" "$(field eye)" "$E0"

qa_say "-- parking an unrolled reading: inactive, not hidden, and the eye does not move"
ordinary gwin || qa_fail_msg "could not reach the ordinary state before the parking block"
last="$(step "await A.face('gwin'); await A.unrollTo(0.5);")"
qa_ok "a half-unrolled reading is open about the window on its host wall" "$(field reading) / $(field u) / $(field task)" "face/rotunda/gwin / 0.500 / face|gwin|rotunda||opening"
P_EYE="$(field eye)"; P_FOV="$(field fov)"; P_HASH="$(field hash)"; P_UNDO="$(field undo)"; P_TRAIL="$(field trail)"
bridge
qa_ok "the parked record holds the identity, the host and the reading parameters" "$(field parkedJson)" '{"name":"Garden window","identity":"gwin","chain":["face"],"canceled":[],"ok":true,"reason":"","fix":null}'
qa_ok "the reading is really gone, not hidden: no session, no work, no knife" "$(field reading) / $(field task) / $(field knife)" "none / none / False"
qa_ok "…the wall is back where it was built, and the Instrument has no Work to show" "$(field unroll) / $(field instr)" "0 / False"
qa_ok "…and the realized eye survived the crossing exactly" "$(eyediff "$(field eye)" "$P_EYE")" "0"
qa_okn "…with the FOV and framing it was rendered with" "$(field fov)" "$P_FOV" "0.001"
qa_ok "…with no source, history or trail change" "$(field hash) / $(field undo) / $(field trail)" "$P_HASH / $P_UNDO / $P_TRAIL"
qa_ok "the parked standpoint is held, so a deactivated reading cannot dolly the eye" "$(field held)" "True"
qa_frames
last="$(step '')"
qa_ok "…and it is still held on a later frame" "$(eyediff "$(field eye)" "$P_EYE")" "0"

qa_say "-- movement in the other lens survives; a foreign selection makes Resume contextual"
qa_press 1
last="$(step '')"
M_EYE="$(field eye)"
qa_ok "Plan in the bridge is the same Camera: a real key moves the shared standpoint" "$(python3 -c 'import json,sys; print(1 if json.loads(sys.argv[1]) != json.loads(sys.argv[2]) else 0)' "$M_EYE" "$P_EYE")" "1"
qa_ok "…and explicit Camera input ends the parked pose's hold" "$(field held)" "False"
qa_ok "…and the parked reading is still inactive, still the same record" "$(field reading) / $(field parkedChain)" "none / face"
tap '#index [data-act="pres-sel"]'
last="$(step '')"
world
qa_ok "returning with the foreign identity keeps it, and the World Card says whose it is" "$(field sel) / $(field cardTitle) / $(field cardKick)" "pres-highlights / Saltmarsh Highlights / Foreign identity · not a World subject"
qa_ok "Resume is contextual: with another identity selected it is not offered" "$(field resumeBtn) / $(field parkedSel)" "False / gwin"
qa_okc "…and the reason is named locally, with the one act that would fix it" "$(field parkedNote)" "is selected now"
last="$(step 'await A.resumeParked();')"
qa_okc "asking for Resume anyway is refused, not guessed" "$(field status)" "Resume is not available"
qa_ok "…leaving the World ordinary and the record untouched" "$(field reading) / $(field task) / $(field parkedOk)" "none / none / False"

qa_say "-- explicit Select, then Resume: revalidated parameters, a fresh return context"
tap '#card [data-act="sel"][data-id="gwin"]'
last="$(step '')"
qa_ok "Selecting the parked identity by hand makes Resume available" "$(field sel) / $(field resumeBtn)" "gwin / True"
R_EYE="$(field eye)"
tap '#card [data-act="resume"]'
last="$(step '')"
qa_okc "Resume announces the fresh invocation it just made" "$(field status)" "Resumed the work on"
qa_ok "Resume re-enters the reading with its decoded parameters" "$(field reading) / $(field u) / $(field side)" "face/rotunda/gwin / 0.500 / 1"
qa_ok "…and the work in hand with it, about the window and its host wall" "$(field task)" "face|gwin|rotunda||opening"
qa_ok "…entered from the standpoint Resume was asked at, so the pre-crossing root is not reused" "$(field origin) / $(field crumbs)" "Plan / 0"
qa_ok "the record is consumed by the explicit request, and nothing was written" "$(field parked) / $(field hash) / $(field undo)" "None / $P_HASH / $P_UNDO"
qa_ok "the resumed work is a view state with a visible Instrument" "$(field instr)" "True"
qa_press Escape
last="$(step '')"
qa_ok "the first Esc clears the beacon the selection left, and the reading stands" "$(field reading) / $(field crumbs)" "face/rotunda/gwin / 0"
qa_press Escape
last="$(step '')"
qa_ok "Put it back returns within the new invocation, not to where it was parked" "$(field reading) / $(field crumbs)" "none / 0"
qa_ok "…to the standpoint Resume was asked from, so the bridge's own movement survives" "$(eyediff "$(field eye)" "$R_EYE")" "0"
qa_ok "…and never re-enters the parked reading" "$(field parked) / $(field task) / $(field undo)" "None / none / $P_UNDO"

qa_say "-- a repair: an unaccepted candidate is canceled, never parked"
ordinary panel || qa_fail_msg "could not reach the ordinary state before the repair block"
last="$(step "A.repairTask('panel'); await A.pickRepairWall('south'); A.declareRepair('s', 3.0);")"
qa_ok "a repair is in hand with a declared candidate drawn" "$(field task) / $(field preview)" "repair|panel|panel|wall:south|reference / {\"art\":\"panel\",\"wall\":\"south\",\"s\":3,\"y\":1.6}"
bridge
qa_ok "crossing parks the repair as its own work, with no reading invented" "$(field parkedJson)" '{"name":"Unplaced panel","identity":"panel","chain":["repair"],"canceled":[],"ok":true,"reason":"","fix":null}'
qa_ok "…the declared candidate is taken off the drawing, not carried over" "$(field preview) / $(field task)" "None / none"
world
tap '#card [data-act="resume"]'
last="$(step '')"
qa_ok "Resume re-invokes the repair: the reference is still the subject" "$(field task)" "repair|panel|panel|wall:null|reference"
qa_ok "…with no wall picked and no candidate drawn — a proposal is never restored" "$(field preview)" "None"
qa_ok "…and the source still holds the unresolved reference" "$(field harborHost) / $(field panelGone)" "north / False"
last="$(step 'A.leaveRepair();')"
qa_ok "leaving it unresolved writes nothing" "$(field task) / $(field undo)" "none / $U0"

qa_say "-- a crossing cancels once: a live draft and a live aim leave nothing behind"
ordinary gwin || qa_fail_msg "could not reach the ordinary state before the cancellation block"
last="$(step "await A.face('gwin');")"
W0="$(field fieldW)"; H1="$(field hash)"; U1="$(field undo)"
qa_click_chip 'op\",\"id\":\"gwin\",\"key\":\"sill' || qa_fail_msg "no on-drawing number to open a draft on"
agent-browser fill '#typeinInput' '2.4' >/dev/null 2>&1
last="$(step '')"
qa_ok "a real click on a number opens the draft writer, and it holds a typed value" "$(field typein)" "True"
bridge
qa_ok "crossing closes the writer and parks the reading underneath it" "$(field typein) / $(field parkedChain) / $(field held)" "False / face / True"
last="$(step "const i = document.querySelector('#typeinInput'); i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));")"
qa_ok "a late Enter on the writer that was dropped cannot commit the draft" "$(field hash) / $(field undo) / $(field gwinHead)" "$H1 / $U1 / 3.4"
world
qa_ok "the source value is the accepted one, and no draft was left in the Card" "$(field fieldW) / $(field undo)" "$W0 / $U1"
last="$(step 'await A.closeAll(); A.dismissParked(); await A.startKnife();')"
qa_ok "a line can be started with nothing open" "$(field knife) / $(field reading)" "True / none"
qa_drag '#gl' -160 8
last="$(step '')"
K_HASH="$(field hash)"; K_UNDO="$(field undo)"
qa_ok "a real drag leaves a live aim, not an open reading" "$(field knife) / $(field reading)" "True / none"
bridge
qa_ok "crossing cancels the aim and parks nothing: an aim is a proposal" "$(field knife) / $(field parked)" "False / None"
qa_press Enter
last="$(step '')"
qa_ok "a late Enter cannot open the line that was aimed" "$(field reading) / $(field hash) / $(field undo)" "none / $K_HASH / $K_UNDO"
world
qa_ok "the World is ordinary again: no reading, no knife, nothing parked" "$(field knife) / $(field reading) / $(field parked)" "False / none / None"

qa_say "-- changed and missing targets are explained, never substituted"
ordinary harbor || qa_fail_msg "could not reach the ordinary state before the changed-target block"
last="$(step "await A.face('harbor');")"
qa_ok "an artwork reading is open about its host wall" "$(field reading)" "face/north/north"
bridge
last="$(step "A.editOnce('QA: the Harbour at Dusk now hangs on the south wall', () => A.applyArtPlacement('harbor', { wall: 'south', s: 4.0, y: 1.6 }));")"
qa_ok "an accepted edit elsewhere moves the artwork to another host" "$(field harborHost)" "south"
world
qa_ok "with the relationship changed, Resume is not offered and not silently redirected" "$(field resumeBtn) / $(field parkedSel) / $(field parkedOk)" "False / None / False"
qa_okc "…and the reason names the host it no longer hangs on" "$(field parkedNote)" "no longer hangs on the North wall"
last="$(step 'await A.resumeParked();')"
qa_okc "asking anyway is refused, and stays refused" "$(field status)" "Resume is not available"
qa_ok "the model keeps its accepted host: nothing was rewritten by the refusal" "$(field harborHost)" "south"
last="$(step "await A.face('harbor');")"
qa_ok "fresh work on the same identity is the honest alternative" "$(field reading)" "face/south/south"
last="$(step 'await A.closeAll(); A.dismissParked();')"
ordinary panel || qa_fail_msg "could not reach the ordinary state before the missing-target block"
last="$(step "A.dimensionTask('panel');")"
qa_ok "in-place work on the unplaced panel is in hand" "$(field task)" "dims|panel|panel||measure"
bridge
last="$(step "ctx.museum.art = ctx.museum.art.filter((a) => a.id !== 'panel');")"
qa_ok "the fixture loses the artwork while the work is parked" "$(field panelGone)" "True"
world
qa_ok "a target that is gone makes Resume unavailable" "$(field resumeBtn) / $(field parkedOk)" "False / False"
qa_okc "…naming the subject it was about" "$(field parkedNote)" "not in this museum any more"
last="$(step 'await A.resumeParked();')"
qa_okc "asking anyway refuses without fabricating anything" "$(field status)" "Resume is not available"
qa_ok "…and nothing was opened or written" "$(field reading) / $(field task)" "none / none"

qa_say "-- through all of it"
qa_ok "no command or page fault" "$(field faults)" "0"

qa_browser_errors_ok "no console or page errors"
qa_summary "Stage S6 · the lens, parked work and explicit Resume"
