#!/usr/bin/env bash
# Stage S5 axis: a decision-point reference and its repair.
#
# Minimum testing (see .agents/skills/browser-test-hygiene): one browser, one pass, and one eval per
# block — a block performs its command and returns every value its assertions need as a single JSON
# blob, compared in bash. The whole axis costs about twenty browser round trips.
#
# What it proves, and only this:
#   * The fixture leaves one artwork's wall reference explicitly unresolved and the shell says so at
#     rest: a quiet warning in the Index whatever context is showing, a Card that states the reason and
#     offers Repair instead of a Look that would need a host. Nothing flies to, reveals or includes it.
#   * The cached last position is a display locator, never a host: membership, worldOf and every verb
#     that would need a wall refuse with the reason, and the marker is drawn without being read.
#   * Repair is its own work: it opens no reading, moves no camera, writes no history; it offers the
#     walls explicitly; a declared station and height are previewed; the fixture's own validation
#     refuses what will not fit, in place, with a reason and no write.
#   * Accept writes exactly one Undo entry, and the reference — not the view — is what moves. Undo and
#     Redo move the body with it.
#   * Canceled and left-unresolved work writes nothing, takes the drawn candidate off the drawing, and
#     the reference stays unresolved.
#   * Owner/Source/Reach are separate, supported facts at a real edit decision: Layout for an opening,
#     Scene for an artwork, with no shared-use or source-fork language anywhere.
#
# Declared values are typed into the real fields; the picker, the warning row and the Card's verbs are
# driven through their own DOM handlers, as the presenter's journeys drive them.
#
# Usage: qa/repair-check.sh
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

export QA_OUT="${QA_OUT:-$QA_DIR/out/repair}"
export QA_SHOT="${QA_SHOT:-0}"

# Everything an assertion here may need, read in the page, once per block.
BLOB='(() => {
  const S = window.__me.S, q = window.__me.qa, A = window.__me.A, ctx = window.__me.ctx;
  const t = document.querySelector.bind(document);
  const txt = (s) => { const e = t(s); return e ? e.textContent : null; };
  const a = ctx.museum.art.find((x) => x.id === "panel");
  const st = q.state();
  const num = (v) => (typeof v === "number" ? v.toFixed(2) : String(v));
  return JSON.stringify({
    sel: S.sel,
    reading: S.session ? S.session.kind : "none",
    task: S.task ? [S.task.kind, S.task.subject, (S.task.target && S.task.target.id) || "", (S.task.focus && S.task.focus.kind) || ""].join("|") : "none",
    eye: q.realized().eye.map((v) => v.toFixed(3)).join(" "),
    undo: S.undo.length,
    undoLabel: S.undo.length ? (S.undo[S.undo.length - 1].label || null) : null,
    faults: S.faults.length,
    art: a ? [a.wall === null ? "unresolved" : a.wall, num(a.s), num(a.y)].join("|") : "none",
    unplaced: !!(ctx.stage.items.get("panel") || {}).unplaced,
    where: A.whereIs("panel").state,
    member: A.memberOf("panel").state,
    reason: A.whereIs("panel").reason || null,
    caps: window.__me.tasks.capabilities("panel").join(","),
    preview: st.preview ? [st.preview.wall, num(st.preview.s), num(st.preview.y)].join("|") : "none",
    drawn: !!t("#stage canvas"),
    warnRows: document.querySelectorAll("#index .ix-row.warn").length,
    warnText: txt("#index .ix-row.warn .ix-note"),
    cardTitle: txt("#card .c-t"),
    cardVerbs: [...document.querySelectorAll("#card .verb")].map((b) => b.dataset.act).join(","),
    cardWarn: txt("#card .where"),
    own: [...document.querySelectorAll("#card .own-row")].map((r) => r.textContent).join(" || "),
    cardText: t("#card") ? t("#card").textContent : "",
    indexText: t("#index") ? t("#index").textContent : "",
    instrKind: txt("#instrument .st-kind"),
    instrMeta: txt("#instrument .st-meta"),
    picks: [...document.querySelectorAll("#instrument [data-act=\"repair-pick\"]")].map((b) => b.dataset.id).join(","),
    pickOn: (t("#instrument [data-act=\"repair-pick\"].on") || {}).dataset ? t("#instrument [data-act=\"repair-pick\"].on").dataset.id : null,
    hasAccept: !!t("#instrument [data-act=\"repair-accept\"]"),
    declaredLabels: [...document.querySelectorAll("#precision .pf .pk")].map((k) => k.textContent).join(", "),
    declared: [...document.querySelectorAll("#precision .pf input")].map((i) => i.value).join(" / "),
    focusField: [...document.querySelectorAll("#precision .pf input")].indexOf(document.activeElement),
    refused: txt("#precision .pf.bad .perr"),
    status: txt("#statusText"),
    depth: null,
  });
})()'

# ---------------------------------------------------------------- driving

step() { # step <javascript statements>
  qa_jsv "(async () => { const A = window.__me.A, S = window.__me.S, ctx = window.__me.ctx; $1 await window.__me.qa.idle(); await window.__me.qa.render(); return ${BLOB}; })()"
}

field() { python3 -c 'import json, sys
d = json.loads(sys.argv[1]); v = d.get(sys.argv[2])
print("None" if v is None else v)' "$last" "$1" 2>/dev/null; }

# The ordinary state at the panel: no reading, no work in hand, the unresolved reference selected.
panel() {
  local i
  for i in 1 2 3; do
    last="$(step "await A.closeAll(); A.endTaskInHand(); A.select('panel');")"
    [ "$(field reading)" = none ] && [ "$(field task)" = none ] && return 0
  done
  return 1
}

# A declared value typed through the one cast: real caret, real value, real Enter, then the effect or the
# reason. Index 0 is the station, 1 the centre height.
declare() { # declare <index> <value> accept|refuse
  local i="$1" v="$2" mode="$3" p x y
  p="$(qa_js "(() => { const e = document.querySelectorAll('#precision .pf input')[$i]; if (!e) return 'none'; const r = e.getBoundingClientRect(); return Math.round(r.x + r.width / 2) + ',' + Math.round(r.y + r.height / 2); })()" | tail -1 | tr -d '"')"
  case "$p" in none | '' | null) qa_fail_msg "no declared field $i to type into"; return 1 ;; esac
  x="${p%,*}"; y="${p#*,}"
  qa_move "$x" "$y"; qa_down; qa_up
  last="$(step '')"
  [ "$(field focusField)" = "$i" ] || { qa_fail_msg "declared field $i did not take the caret"; return 1; }
  qa_js "(() => { document.querySelectorAll('#precision .pf input')[$i].value = '$v'; return 1; })()" >/dev/null
  qa_press Enter
  last="$(step '')"
  if [ "$mode" = accept ]; then
    [ "$(field refused)" = None ] || return 1
    return 0
  fi
  [ -n "$(field refused)" ] && return 0
  return 1
}

leave_field() { qa_js 'document.activeElement && document.activeElement.blur() && true' >/dev/null; }

# ---------------------------------------------------------------- the axis

qa_open
qa_say "== Stage S5 · an unresolved reference and its repair"
qa_faults_clear

qa_say "-- at rest: the warning is there, quiet, in every context, and it says what is really missing"
last="$(step "A.select(null);")"
qa_ok "the Index carries one unresolved-reference warning, with no task in hand" "$(field warnRows) / $(field task)" "1 / none"
qa_okc "…naming what is missing, not where anything 'should' be" "$(field warnText)" "no wall reference"
last="$(step "A.select('gwin');")"
qa_ok "…and it survives a place context: a document fact, not a place" "$(field warnRows) / $(field sel)" "1 / gwin"
last="$(step "document.querySelector('#index .ix-row.warn [data-sel]').click();")"
qa_ok "selecting it is an ordinary Select, and the Card is its identity" "$(field sel) / $(field cardTitle)" "panel / Unplaced panel"
qa_ok "the Card states the reason and offers Repair, never a Look that would need a host" "$(field cardVerbs) / $(field caps)" "look-repair,look-dims / repair,dims"
qa_okc "…in the Card's own words, about the marker" "$(field cardWarn)" "where it was last seen, not where it hangs"

qa_say "-- the cached position is a display locator, never a host: nothing flies to it"
last="$(step "A.select('gwin'); A.select('panel');")"
E0="$(field eye)"; U0="$(field undo)"
qa_ok "the resolver refuses to call it visible, or to place it in a reading" "$(field where) / $(field member)" "unresolved / unresolved"
last="$(step "await A.openLocation('panel');")"
qa_okc "Open location refuses with the reason, and offers the one real route" "$(field status)" "name the wall it belongs on with Repair"
last="$(step "await A.face('panel');")"
qa_okc "Look refuses the same way, on the same identity" "$(field status)" "its wall reference is unresolved"
last="$(step "await A.lookAt('panel');")"
qa_okc "Bring into view has nothing to bring: the locator is not a standpoint" "$(field status)" "There is nothing to bring into view"
qa_ok "…and none of the three moved the camera, the selection or history" "$(field eye) / $(field sel) / $(field undo)" "$E0 / panel / $U0"

qa_say "-- Repair is its own work: no reading, no camera, no history, and the walls offered explicitly"
panel || qa_fail_msg "could not reach the ordinary state before invoking Repair"
last="$(step "document.querySelector('#card [data-act=\"look-repair\"][data-id=\"panel\"]').click();")"
qa_ok "invoking Repair records the work, with no reading opened and the camera where it was" "$(field task) / $(field reading) / $(field eye)" "repair|panel|panel|reference / none / $E0"
qa_ok "…offering every wall in the museum, none of them chosen yet" "$(field picks) / $(field pickOn) / $(field hasAccept)" "north,south,west,rotunda / None / False"
qa_ok "…and declaring the two values it will use, before anything is drawn" "$(field declaredLabels)" "Station along the wall, Centre height"
qa_ok "…with nothing drawn and nothing written yet" "$(field preview) / $(field art) / $(field undo)" "none / unresolved|0.00|1.60 / $U0"

qa_say "-- an explicit pick, and a declared candidate the fixture refuses — in place, with the reason"
last="$(step "document.querySelector('#instrument [data-act=\"repair-pick\"][data-id=\"west\"]').click();")"
qa_ok "picking a wall is explicit: it becomes the candidate, and the panel's own height is declared with it" "$(field pickOn) / $(field preview)" "west / west|3.50|1.60"
qa_okc "…the fixture's own check refuses the declared default rather than nudging it" "$(field status)" "Unplaced panel would cover the Entrance"
qa_ok "…leaving the reference untouched: a drawn candidate is not a source" "$(field art) / $(field undo)" "unresolved|0.00|1.60 / $U0"
declare 0 5.6 accept || qa_fail_msg "the declared station never took"
last="$(step '')"
qa_ok "a declared station is drawn where it would hang, and still writes nothing" "$(field preview) / $(field undo)" "west|5.60|1.60 / $U0"
declare 1 3.8 refuse || qa_fail_msg "a height through the wall top was not refused"
qa_okc "a height that would cross the wall top is refused in place, with the number" "$(field refused)" "only 4.20 high"
qa_ok "…and the candidate is exactly as it was: refusals change nothing" "$(field preview) / $(field undo)" "west|5.60|1.60 / $U0"
declare 1 2.0 accept || qa_fail_msg "the declared height never took"
last="$(step '')"
qa_ok "the declared height is taken the same way, recorded in the drawing and not the source" "$(field preview) / $(field art) / $(field undo)" "west|5.60|2.00 / unresolved|0.00|1.60 / $U0"

qa_say "-- accept once: one validated edit, and the reference — not the view — is what moves"
leave_field
A_EYE="$(field eye)"
qa_press Enter
last="$(step '')"
qa_ok "Enter accepts the declared candidate as one source edit" "$(field art)" "west|5.60|2.00"
qa_ok "…one Undo entry, labelled for the reference it repaired" "$(field undo) / $(field undoLabel)" "$((U0 + 1)) / Repaired the wall reference of the Unplaced panel"
qa_ok "…the work ends because the reference it was about is resolved" "$(field task) / $(field preview)" "none / none"
qa_ok "…the panel is really hung on the wall that was chosen" "$(field unplaced) / $(field art)" "False / west|5.60|2.00"
qa_ok "…and the resolver places it again, with Look back among its capabilities" "$(python3 -c 'import json,sys; print(1 if json.loads(sys.argv[1])["where"] != "unresolved" else 0)' "$last") / $(field caps)" "1 / face,dims"
qa_ok "…the rest warning goes, because the document has no unresolved reference any more" "$(field warnRows)" "0"
qa_ok "…and the camera never moved: accepting a reference is not a view" "$(field eye)" "$A_EYE"

qa_say "-- Undo and Redo move the reference, and the body follows it"
last="$(step "A.undo();")"
qa_ok "Undo puts the reference back to unresolved" "$(field art) / $(field where) / $(field unplaced)" "unresolved|0.00|1.60 / unresolved / True"
qa_ok "…and the warning returns with it" "$(field warnRows)" "1"
qa_ok "…with the camera untouched by history" "$(field eye)" "$A_EYE"
last="$(step "A.redo();")"
qa_ok "Redo hangs it again on the wall that was chosen" "$(field art) / $(field unplaced)" "west|5.60|2.00 / False"

qa_say "-- canceled and left-unresolved work writes nothing"
last="$(step "A.undo();")"
U1="$(field undo)"
panel || qa_fail_msg "could not reach the ordinary state before the cancel block"
last="$(step "document.querySelector('#card [data-act=\"look-repair\"][data-id=\"panel\"]').click();")"
last="$(step "document.querySelector('#instrument [data-act=\"repair-pick\"][data-id=\"north\"]').click();")"
declare 0 4.0 accept || qa_fail_msg "the declared station never took before the cancel"
last="$(step '')"
qa_ok "a candidate is drawn, on a wall that would hold it" "$(field preview)" "north|4.00|1.60"
qa_press Escape
last="$(step '')"
qa_ok "Escape leaves the work unresolved: nothing written, nothing drawn, no work in hand" "$(field task) / $(field preview) / $(field art)" "none / none / unresolved|0.00|1.60"
qa_ok "…with the same history it started with" "$(field undo) / $(field warnRows)" "$U1 / 1"
last="$(step "document.querySelector('#card [data-act=\"look-repair\"][data-id=\"panel\"]').click();")"
last="$(step "document.querySelector('#instrument [data-act=\"repair-pick\"][data-id=\"rotunda\"]').click();")"
last="$(step "document.querySelector('#instrument [data-act=\"repair-leave\"]').click();")"
qa_okc "Leave unresolved is the other honest ending, said out loud" "$(field status)" "stays unresolved"
qa_ok "…and it writes nothing either" "$(field task) / $(field preview) / $(field art) / $(field undo)" "none / none / unresolved|0.00|1.60 / $U1"
qa_ok "no command or page fault through any of it" "$(field faults)" "0"

qa_say "-- Owner/Source/Reach: three supported facts at the edit decision, and no invented scope"
last="$(step "A.select('gwin');")"
OW="$(field own)"
qa_okc "an opening's fact is owned by the Layout document" "$OW" "Layout document"
qa_okc "…its source is named as this prototype's fixture" "$OW" "prototype-local fixture"
qa_okc "…and what it reaches is that opening and its wall alone" "$OW" "this opening only"
last="$(step "A.select('panel');")"
OW="$(field own)"
qa_okc "an artwork's fact is owned by the Scene document" "$OW" "Scene document"
qa_okc "…its source is named as unresolved rather than a place" "$OW" "wall reference, unresolved"
qa_okc "…and Repair reaches the reference, never the wall" "$OW" "never the wall"
qa_ok "…with no shared-use, fork or instance-only language anywhere in the shell" "$(python3 -c 'import json,sys
d = json.loads(sys.argv[1])
bad = [w for w in ("shared use", "shared-use", "fork", "instance-only", "3 uses") if w in d["cardText"] or w in d["indexText"]]
print(",".join(bad) if bad else "clean")' "$last")" "clean"

qa_browser_errors_ok "no console or page errors"
qa_summary "Stage S5 · unresolved reference and repair"
