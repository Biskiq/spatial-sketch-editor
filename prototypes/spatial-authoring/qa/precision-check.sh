#!/usr/bin/env bash
# Stage S3 axis: spatial tasks and Precision.
#
# Minimum testing (see qa/README.md; session lifecycle in .agents/skills/browser-hygiene): one browser,
# one pass, and one eval per block — a block performs its command and returns every value its
# assertions need as a single JSON blob, compared in bash. An assertion therefore costs no browser
# round trip, and the whole axis stays well under the ~100 evals after which the CLI starts dropping
# results.
#
# What it proves, and only this:
#   * Look is one work reached three ways (Card verb, keyboard, Index row verb), with the identity that
#     asked kept apart from the technical target and its local focus named.
#   * The first gesture is retained: dragging the wall's dog-ear opens and unrolls in one motion.
#   * Measuring in place opens no reading, moves no camera and reports the subject's real numbers.
#   * One active task surface: measuring over a reading leaves the reading untouched and gives its own
#     work back when dismissed.
#   * Precision reaches the work's numbers without a pointer, commits exactly one Undo entry, refuses an
#     invalid value in place with a reason and no history, and is left before the reading is.
#   * A number is editable where no handle is legible, and Precision cannot outlive the work.
#
# Two rules keep it honest: a key press may be delivered late, so key-driven checks wait for the state
# the key causes; and the ordinary state a block needs is established and then verified, never assumed.
#
# Usage: qa/precision-check.sh
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

export QA_OUT="${QA_OUT:-$QA_DIR/out/precision}"
export QA_SHOT="${QA_SHOT:-0}"

# Everything an assertion here may need, read in the page, once per block.
BLOB='(() => {
  const S = window.__me.S, q = window.__me.qa, ctx = window.__me.ctx;
  const t = document.querySelector.bind(document);
  const txt = (s) => { const e = t(s); return e ? e.textContent : null; };
  const rect = (s) => { const e = t(s); if (!e) return null; const b = e.getBoundingClientRect(); return Math.round(b.width) + "x" + Math.round(b.height); };
  const gwin = (() => { try { return ctx.museum.walls.find((w) => w.id === "rotunda").openings.find((o) => o.id === "gwin").w; } catch (e) { return null; } })();
  const prec = t("#precision"), pf = prec ? t("#precision .pf input") : null;
  return JSON.stringify({
    sel: S.sel,
    reading: S.session ? [S.session.kind, S.session.wallId || S.session.ceilId || "", S.session.focusId || ""].join("/") : "none",
    task: S.task ? [S.task.kind, S.task.subject, (S.task.target && S.task.target.id) || "", (S.task.focus && S.task.focus.kind) || "", (S.task.focus && S.task.focus.label) || ""].join("|") : "none",
    u: S.session && S.session.u != null ? S.session.u : null,
    direct: !!(S.task && S.task.params && S.task.params.directly === true),
    precision: !!(S.task && S.task.precision),
    eye: q.realized().eye.map((v) => v.toFixed(3)).join(" "),
    stage: rect("#stage"),
    undo: S.undo.length,
    undoLabel: S.undo.length ? (S.undo[S.undo.length - 1].label || null) : null,
    trail: S.trail.length,
    faults: S.faults.length,
    w: gwin,
    cardTitle: txt("#card .c-t"),
    verbs: [...document.querySelectorAll("#card .verb")].map((b) => b.dataset.act).join(" "),
    instrHidden: t("#instrument") ? t("#instrument").hidden : null,
    instrKind: txt("#stKind") || txt("#instrument .st-kind"),
    instrMeta: txt("#instrument .st-meta"),
    instrFocus: txt("#instrument .st-focus b"),
    precLabels: prec ? [...prec.querySelectorAll(".pf .pk")].map((k) => k.textContent).join(", ") : null,
    precInput: pf ? pf.value : null,
    isField: !!pf && document.activeElement === pf,
    refused: txt("#precision .pf.bad .perr"),
    indexUnroll: !!t("#index [data-act=\"look-unroll\"][data-id=\"rotunda\"]"),
    numbersRow: !!prec,
  });
})()'

# ---------------------------------------------------------------- driving

# One eval that performs a command and returns the blob, with the queue settled and a frame drawn.
step() { # step <javascript statements>
  qa_jsv "(async () => { const A = window.__me.A; $1 await window.__me.qa.idle(); await window.__me.qa.render(); return ${BLOB}; })()"
}

# One value out of the last blob. Local, so an assertion costs nothing in the browser.
field() { python3 -c 'import json, sys
d = json.loads(sys.argv[1]); v = d.get(sys.argv[2])
print("None" if v is None else v)' "$last" "$1" 2>/dev/null; }
blob() { python3 -c 'import json, sys
v = eval(sys.argv[2], {"d": json.loads(sys.argv[1])})
print(v if isinstance(v, str) else json.dumps(v))' "$last" "$1" 2>/dev/null; }
near() { python3 -c 'import json, sys
v = json.loads(sys.argv[1]).get(sys.argv[2])
sys.exit(0 if v is not None and abs(float(v) - float(sys.argv[3])) <= float(sys.argv[4]) else 1)' "$last" "$1" "$2" "${3:-0.0001}" 2>/dev/null; }

# Wait for the effect, not for the press: a key can land after the eval that followed it.
wait_field() { # wait_field <field> <expected> [polls]
  local i
  for i in $(seq 1 "${3:-8}"); do
    last="$(step '')"
    [ "$(field "$1")" = "$2" ] && return 0
  done
  return 1
}
wait_near() { # wait_near <field> <value> [tol] [polls]
  local i
  for i in $(seq 1 "${4:-4}"); do
    last="$(step '')"
    near "$1" "$2" "${3:-0.0001}" && return 0
  done
  return 1
}
key_wait() { # key_wait <key> <field> <expected> [polls]
  qa_press "$1"
  wait_field "$2" "$3" "${4:-8}"
}

# The ordinary state: no reading, no work in hand, the selection this block needs. Established and
# verified; retried once because a late key from the previous block can reopen what was just closed.
ordinary() { # ordinary [selection id]
  local id="${1:-gwin}" i
  for i in 1 2 3; do
    last="$(step "await A.closeAll(); A.endTaskInHand(); A.select('$id');")"
    [ "$(field reading)" = none ] && [ "$(field task)" = none ] && return 0
  done
  return 1
}

# A number typed through the one cast: real caret, real value, real Enter, then wait for the effect.
type_value() { # type_value <value> accept|refuse
  local v="$1" mode="$2" i p x y
  for i in 1 2 3; do
    p="$(qa_at '#precision .pf input')"
    case "$p" in none | '' | null) last="$(step 'A.setPrecision(true);')"; continue ;; esac
    x="${p%,*}"; y="${p#*,}"
    qa_move "$x" "$y"; qa_down; qa_up
    last="$(step '')"
    [ "$(field isField)" = True ] || continue # the field itself must hold the caret
    agent-browser fill '#precision .pf input' "$v" >/dev/null 2>&1
    qa_press Enter
    if [ "$mode" = accept ]; then
      wait_near w "$v" 0.0001 && return 0
    else
      last="$(step '')"
      [ -n "$(field refused)" ] && return 0
    fi
  done
  return 1
}

leave_field() { qa_js 'document.activeElement && document.activeElement.blur() && true' >/dev/null; }

# ---------------------------------------------------------------- the axis

qa_open
qa_say "== Stage S3 · spatial tasks and Precision"
qa_faults_clear

qa_say "-- Look is one work, reached three ways; identity, target and local focus stay apart"
ordinary || qa_fail_msg "could not reach the ordinary state before the Card route"
last="$(step "A.select('gwin');")"
qa_ok "the Card is the subject, its own verbs offered, spatial and in place kept apart" "$(field cardTitle) / $(field verbs)" "Garden window / look-face look-unroll look-dims"
qa_ok "nothing is in hand at rest" "$(field task) / $(field instrHidden)" "none / True"
last="$(step "document.querySelector('#card [data-act=\"look-face\"][data-id=\"gwin\"]').click();")"
qa_ok "the Card's verb opens the work it names" "$(field reading)" "face/rotunda/gwin"
qa_ok "…the identity that asked kept apart from the target, with the local focus named" "$(field task)" "face|gwin|rotunda|opening|Garden window in the Rotunda wall"
qa_ok "…and the Instrument says what it is and where" "$(field instrKind) / $(field instrFocus)" "Facing / Garden window in the Rotunda wall"
ordinary || qa_fail_msg "could not reach the ordinary state before the keyboard route"
key_wait f reading face/rotunda/gwin || qa_fail_msg "the F key did not open the reading within its wait"
qa_ok "the keyboard reaches the same work, identity and all" "$(field task)" "face|gwin|rotunda|opening|Garden window in the Rotunda wall"
ordinary || qa_fail_msg "could not reach the ordinary state before the Index route"
qa_ok "the wall it hangs on carries its own verb in the Index" "$(field indexUnroll)" "True"
last="$(step "document.querySelector('#index [data-act=\"look-unroll\"][data-id=\"rotunda\"]').click();")"
qa_ok "the Index row's verb acts on the wall the row names" "$(field reading)" "face/rotunda/rotunda"
qa_okn "…laid flat" "$(field u)" "1" 0.001
qa_ok "…leaving the selection alone" "$(field sel)" "gwin"

qa_say "-- the first gesture is retained: the wall unrolls under the hand, no invocation step"
ordinary || qa_fail_msg "could not reach the ordinary state before the gesture"
p="$(qa_at '[data-peel]')"
if [ "$p" = none ] || [ -z "$p" ] || [ "$p" = null ]; then
  qa_fail_msg "no dog-ear on the drawing to pull"
else
  x="${p%,*}"; y="${p#*,}"
  qa_move "$x" "$y"; qa_down
  qa_move "$((x + 120))" "$((y + 120))"
  last="$(step '')"
  qa_ok "mid-gesture the reading is already open, around the window that asked" "$(field reading) / $(field task)" "face/rotunda/gwin / face|gwin|rotunda|opening|Garden window in the Rotunda wall"
  qa_ok "…unrolling under the hand, dispatched by the gesture itself" "$(blob 'd["u"] > 0.05') / $(field direct)" "true / True"
  qa_move "$((x + 170))" "$((y + 170))"; qa_up
  last="$(step '')"
  qa_ok "letting go leaves the curvature where it was" "$(blob 'd["u"] > 0.05')" "true"
fi

qa_say "-- measuring in place opens nothing and moves nothing"
ordinary || qa_fail_msg "could not reach the ordinary state before measuring"
REST_EYE="$(field eye)"; REST_STAGE="$(field stage)"
last="$(step "document.querySelector('#card [data-act=\"look-dims\"][data-id=\"gwin\"]').click();")"
qa_ok "the in-place task is the work in hand" "$(field task)" "dims|gwin|gwin|measure|Garden window"
qa_ok "…with no reading opened" "$(field reading)" "none"
qa_ok "…the camera exactly where it was, and the world the same size" "$(field eye) / $(field stage)" "$REST_EYE / $REST_STAGE"
qa_ok "…and the Instrument says it is in place" "$(field instrKind) / $(field instrMeta)" "Measured / in place · nothing opened, nothing moved"
qa_okn "…showing the subject's real width without being asked" "$(field precInput)" "$(field w)" 0.001

qa_say "-- one active surface, Precision, refusal, and Esc order"
ordinary || qa_fail_msg "could not reach the ordinary state before the surface block"
last="$(step "await A.face('gwin');")"
qa_ok "a face reading for the work to sit over" "$(field reading)" "face/rotunda/gwin"
FACE_EYE="$(field eye)"
last="$(step "document.querySelector('#card [data-act=\"look-dims\"][data-id=\"gwin\"]').click();")"
qa_ok "measuring takes the surface, touching neither the reading nor the camera" "$(field instrKind) / $(field reading) / $(field eye)" "Measured / face/rotunda/gwin / $FACE_EYE"
key_wait Escape instrKind Facing || qa_fail_msg "Escape did not give the reading's own surface back"
qa_ok "…and leaving it returns the reading's own work" "$(field reading) / $(field task)" "face/rotunda/gwin / face|gwin|rotunda|opening|Garden window in the Rotunda wall"
key_wait p precision True || qa_fail_msg "the P key did not enter Precision"
qa_ok "Precision is entered from the keyboard, as one labelled row on the same surface" "$(field precision) / $(field precLabels)" "True / Width, Centre along wall, Sill, Head, Arch rise, Clear height"
qa_ok "…still the reading it belongs to" "$(field reading)" "face/rotunda/gwin"
UNDO0="$(field undo)"
BEFORE_EYE="$(field eye)"
type_value 2.6 accept || qa_fail_msg "the width field never took 2.6"
last="$(step '')"
qa_okn "a typed value is accepted through the one cast" "$(field w)" "2.6" 0.0001
qa_ok "…as exactly one Undo entry, labelled for the value" "$(field undo) / $(field undoLabel)" "$((UNDO0 + 1)) / Garden window width"
qa_ok "…without any view change" "$(field eye)" "$BEFORE_EYE"
UNDO1="$(field undo)"
type_value -4 refuse || qa_fail_msg "the invalid value was not refused in place"
last="$(step '')"
qa_okc "an invalid number is refused in place, with a reason" "$(field refused)" "at least 0.40 wide"
qa_ok "…writing no history and leaving the accepted value alone" "$(field undo) / $(field w)" "$UNDO1 / 2.6"
leave_field
key_wait Escape precision False || qa_fail_msg "Escape did not leave Precision"
qa_ok "Escape leaves Precision first, the reading untouched" "$(field precision) / $(field reading)" "False / face/rotunda/gwin"
key_wait Escape reading none || qa_fail_msg "the next Escape did not leave the reading"
qa_ok "…and the next Escape leaves the reading, keeping the selection" "$(field reading) / $(field sel)" "none / gwin"

qa_say "-- a number is reachable where no handle is legible, and Precision cannot outlive the work"
ordinary || qa_fail_msg "could not reach the ordinary state before the hidden-axis block"
last="$(step "await A.face('gwin'); A.setPrecision(true);")"
qa_ok "a reading with Precision asked for" "$(field reading) / $(field precision)" "face/rotunda/gwin / True"
last="$(step "document.querySelector('#instrument [data-unroll=\"1\"]').click();")"
qa_okn "the wall is laid flat, so widths are foreshortened" "$(field u)" "1" 0.001
UNDO_FLAT="$(field undo)"; TRAIL_FLAT="$(field trail)"
type_value 2.2 accept || qa_fail_msg "the width was not editable by number while flat"
last="$(step '')"
qa_okn "the width is still measured on the wall, and still editable by number" "$(field w)" "2.2" 0.0001
qa_ok "…as one accepted edit, with no view change from typing" "$(field undo) / $(field trail)" "$((UNDO_FLAT + 1)) / $TRAIL_FLAT"
leave_field
last="$(step 'await A.closeAll();')"
qa_ok "leaving the reading ends the work in hand" "$(field task)" "none"
qa_ok "…and its numbers row goes with it" "$(field numbersRow) / $(field instrHidden)" "False / True"
qa_ok "no command or page fault through any of it" "$(field faults)" "0"

qa_browser_errors_ok "no console or page errors"
qa_summary "Stage S3 · tasks and Precision"
