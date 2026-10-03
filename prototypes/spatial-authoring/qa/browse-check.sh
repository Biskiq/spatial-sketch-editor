#!/usr/bin/env bash
# Stage S4 axis: Browse/Search and the Details grammar.
#
# Minimum testing (see qa/README.md; session lifecycle in .agents/skills/browser-hygiene): one browser,
# one pass, and one eval per block — a block performs its command and returns every value its
# assertions need as a single JSON blob, compared in bash. The whole axis costs about twenty browser
# round trips.
#
# What it proves, and only this:
#   * One bounded list: the museum's own subjects and the dense metadata fixture, with repeated names,
#     more rows than a page, an empty result and a paging control; the register is visible as context.
#   * Browse is context: typing, paging and moving the place context select nothing, open nothing,
#     write no history and leave the Camera exactly where it was — including while a reading is open.
#   * Select is the identity and nothing else: it changes S.sel, never the reading, the work in hand,
#     the camera or history — and a record with no Stage geometry is labelled, offered Select alone,
#     and refused honestly if a flight is asked for anyway.
#   * Open location, Bring into view, Include, Reveal and Face are separate verbs, each acting on the
#     record the row names rather than on whatever happens to be selected.
#   * Details Expand (disclosure), Focus (local context), Select (identity) and Open task (specialist
#     work on the named target) have four distinct state effects; Focus leaves the Card's identity and
#     the view exactly where they were.
#
# Buttons are driven through their own DOM handlers (the presenter path the journeys use); the first
# query is typed into the real field, the context chips and the Index title are real pointer clicks.
#
# Usage: qa/browse-check.sh
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

export QA_OUT="${QA_OUT:-$QA_DIR/out/browse}"
export QA_SHOT="${QA_SHOT:-0}"

# Everything an assertion here may need, read in the page, once per block.
BLOB='(() => {
  const S = window.__me.S, q = window.__me.qa, A = window.__me.A;
  const t = document.querySelector.bind(document);
  const txt = (s) => { const e = t(s); return e ? e.textContent : null; };
  const row = (id) => `.fx-row[data-rec="${id}"]`;
  return JSON.stringify({
    sel: S.sel,
    reading: S.session ? [S.session.kind, S.session.wallId || S.session.ceilId || "", S.session.focusId || ""].join("/") : "none",
    task: S.task ? [S.task.kind, S.task.subject, (S.task.target && S.task.target.id) || "", (S.task.focus && S.task.focus.kind) || "", (S.task.focus && S.task.focus.label) || ""].join("|") : "none",
    eye: q.realized().eye.map((v) => v.toFixed(3)).join(" "),
    undo: S.undo.length,
    trail: S.trail.length,
    faults: S.faults.length,
    expand: !!S.expand,
    bq: S.browse.q,
    browseFocus: S.browse.focus ? JSON.stringify(S.browse.focus) : "none",
    bpage: S.browse.page,
    finder: t("#finder") ? !t("#finder").hidden : null,
    rows: [...document.querySelectorAll("#finderList li.fx-row")].map((r) => r.dataset.rec).join(","),
    rowCount: document.querySelectorAll("#finderList li.fx-row").length,
    names: [...document.querySelectorAll("#finderList li.fx-row .fn")].map((e) => e.textContent).join("|"),
    empty: txt("#finderList li.empty"),
    more: txt("#finderMore"),
    hasMore: !!t("#finderMore [data-act=\"more\"]"),
    chips: [...document.querySelectorAll("#finderCtx .fx-chip")].map((c) => c.textContent + (c.classList.contains("on") ? "*" : "")).join(","),
    nameSurvey: txt(row("survey-1") + " .fn"),
    verbsSurvey: [...document.querySelectorAll(row("survey-1") + " .fx-v")].map((b) => b.dataset.act).join(","),
    verbsHarbor: [...document.querySelectorAll(row("harbor") + " .fx-v")].map((b) => b.dataset.act).join(","),
    verbsKestrel: [...document.querySelectorAll(row("kestrel") + " .fx-v")].map((b) => b.dataset.act).join(","),
    verbsVessel: [...document.querySelectorAll(row("vessel") + " .fx-v")].map((b) => b.dataset.act).join(","),
    noteSurvey: txt(row("survey-1") + " .fx-note"),
    kestrelState: A.whereIs("kestrel").state,
    member: A.memberOf("harbor").state,
    depth: S.session && S.session.cut ? S.session.cut.depth : null,
    reveal: S.reveal,
    cardTitle: txt("#card .c-t"),
    relRows: document.querySelectorAll("#card .rels .rel-row").length,
    relNames: [...document.querySelectorAll("#card .rels .rel-what")].map((e) => e.textContent).join(" | "),
    relActs: [...document.querySelectorAll("#card .rels .rel-row .c-v")].map((b) => b.dataset.act + ":" + b.dataset.id).join(" "),
    indexVerbs: document.querySelectorAll("#index .ix-verb").length,
    indexTitle: txt("#index .ix-title"),
    indexFocused: document.querySelectorAll("#index .ix-row.focused").length,
    instrKind: txt("#instrument .st-kind"),
    instrFocus: txt("#instrument .st-focus b"),
    // The display expires after six seconds; assert the emitted outcome independent of CLI latency.
    status: S.status?.text || txt("#statusText"),
  });
})()'

# ---------------------------------------------------------------- driving

# One eval that performs a command and returns the blob, with the queue settled and a frame drawn.
step() { # step <javascript statements>
  qa_jsv "(async () => { const A = window.__me.A, S = window.__me.S, ctx = window.__me.ctx; $1 await window.__me.qa.idle(); await window.__me.qa.render(); return ${BLOB}; })()"
}

field() { python3 -c 'import json, sys
d = json.loads(sys.argv[1]); v = d.get(sys.argv[2])
print("None" if v is None else v)' "$last" "$1" 2>/dev/null; }
emp() { python3 -c 'import json, sys
print(1 if eval(sys.argv[2], {"d": json.loads(sys.argv[1])}) else 0)' "$last" "$1" 2>/dev/null; }

# A real pointer click on a live control.
tap() { # tap <selector>
  local p x y
  p="$(qa_at "$1")"
  case "$p" in none | '' | null) qa_fail_msg "no live control at $1"; return 1 ;; esac
  x="${p%,*}"; y="${p#*,}"
  qa_move "$x" "$y"; qa_down; qa_up
  return 0
}

# The ordinary state, established and verified before a block relies on it.
ordinary() { # ordinary [selection id]
  local id="${1:-gwin}" i
  for i in 1 2 3; do
    last="$(step "await A.closeAll(); A.endTaskInHand(); A.select('$id');")"
    [ "$(field reading)" = none ] && [ "$(field task)" = none ] && return 0
  done
  return 1
}

# The list, open and holding one query. The first call types into the real field; later ones open with
# the shell's own Search button and set the value the way the presenter's journey does.
query() { # query <text> [real|set]
  local text
  text="$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1")"
  if [ "${2:-set}" = real ]; then
    qa_press /
    agent-browser fill '#finderInput' "$1" >/dev/null 2>&1
    return 0
  fi
  qa_js "(() => {
    const f = document.querySelector('#finder');
    if (f.hidden) document.querySelector('[data-act=\"find\"]').click();
    const i = document.querySelector('#finderInput');
    i.value = $text;
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return 1;
  })()" >/dev/null
}

# ---------------------------------------------------------------- the axis

qa_open
qa_say "== Stage S4 · Browse/Search and Details"
qa_faults_clear

qa_say "-- one bounded list: dense, repeated names, paging, and a register that says where it lives"
ordinary gwin || qa_fail_msg "could not reach the ordinary state before the list block"
SET_SEL="$(field sel)"; SET_EYE="$(field eye)"; SET_UNDO="$(field undo)"
query 'condition survey' real
last="$(step '')"
qa_ok "the listing opens on the query typed into the real field" "$(field bq) / $(field finder)" "condition survey / True"
qa_ok "repeated display names, distinct records: four survey sheets" "$(field names)" "Condition survey|Condition survey|Condition survey|Condition survey"
qa_ok "a record with no Stage geometry offers Select alone" "$(field verbsSurvey) / $(field nameSurvey)" "sel / Condition survey"
qa_okc "…and says where it really lives" "$(field noteSurvey)" "no location here"
query ''
last="$(step '')"
qa_ok "an empty query fills one page and offers more: $(field more)" "$(field rowCount) / $(field hasMore)" "9 / True"
qa_ok "the museum's own subjects are listed first, and the records after them" "$(emp 'd["rows"].split(",")[0] == "north" and "rotunda" in d["rows"] and "survey-1" not in d["rows"]')" "1"
last="$(step "document.querySelector('#finderMore [data-act=\"more\"]').click();")"
qa_ok "More pages the list, keeping the page in shell state: $(field more)" "$(field rowCount) / $(field bpage)" "18 / 1"
query 'zzzz'
last="$(step '')"
qa_okc "an empty result names the query and the context it looked in" "$(field empty)" "Nothing matches “zzzz” in the whole museum"
qa_ok "…and no result row is invented" "$(field rowCount)" "0"
qa_ok "browsing selected nothing, opened nothing and moved nothing" "$(field sel) / $(field reading) / $(field eye) / $(field undo)" "$SET_SEL / none / $SET_EYE / $SET_UNDO"

qa_say "-- context is context: a place, the register, and an Index that follows it"
qa_press Escape
last="$(step '')"
qa_ok "Escape closes the listing" "$(field finder)" "False"
last="$(step "A.select('tide1');")"
qa_ok "the selection is set for the context block, with the listing closed" "$(field sel) / $(field finder)" "tide1 / False"
tap '#index [data-act="place"][data-id="rotunda"]'
last="$(step '')"
qa_ok "the Index place title focuses that place as context" "$(field browseFocus)" '{"kind":"place","id":"rotunda"}'
qa_ok "…without touching the selection or opening anything" "$(field sel) / $(field reading)" "tide1 / none"
qa_press /
last="$(step '')"
qa_ok "opening Search keeps the context it was left in" "$(field chips)" "All places,Long Gallery,Rotunda*,Records register"
tap '#finderCtx [data-ctx="records"]'
last="$(step '')"
qa_ok "the register is a context of its own" "$(field browseFocus) / $(field chips)" '{"kind":"records"} / All places,Long Gallery,Rotunda,Records register*'
qa_ok "…showing records only, with the selection exactly where it was" "$(field names) / $(field sel)" "Condition survey|Condition survey|Condition survey|Condition survey|Conservation file|Conservation file|Conservation file|Loan agreement|Loan agreement / tide1"
qa_okc "…and the Index follows the context: the register, offering no Look" "$(field indexTitle) / $(field indexVerbs)" "Records register / 0"
tap '#finderCtx [data-ctx="records"]'
last="$(step '')"
qa_ok "clicking the active context leaves it, back to the whole museum" "$(field browseFocus)" "none"

qa_say "-- Select is the identity, and nothing else"
ordinary gwin || qa_fail_msg "could not reach the ordinary state before the Select block"
SEL_EYE="$(field eye)"; SEL_UNDO="$(field undo)"; SEL_TRAIL="$(field trail)"
query 'pears'
last="$(step '')"
last="$(step "document.querySelector('#finderList [data-rec=\"pears\"] [data-act=\"sel\"]').click();")"
qa_ok "Select changes the canonical identity" "$(field sel)" "pears"
qa_ok "…and the reading, the work in hand, the camera and history are untouched" "$(field reading) / $(field task) / $(field eye) / $(field undo) / $(field trail)" "none / none / $SEL_EYE / $SEL_UNDO / $SEL_TRAIL"
qa_ok "…and choosing a result dismisses the listing" "$(field finder)" "False"
last="$(step "await A.face('gwin');")"
OPEN_EYE="$(field eye)"
query 'harbor'
last="$(step "document.querySelector('#finderList [data-rec=\"harbor\"] [data-act=\"sel\"]').click();")"
qa_ok "Select inside an open reading changes the selection and not the reading" "$(field sel) / $(field reading)" "harbor / face/rotunda/gwin"
qa_ok "…with the camera exactly where the reading put it" "$(field eye)" "$OPEN_EYE"
query 'Loan agreement'
last="$(step "document.querySelector('#finderList [data-rec=\"loan-1\"] [data-act=\"sel\"]').click();")"
qa_ok "a register record can be selected: an identity is an identity" "$(field sel) / $(field cardTitle)" "loan-1 / Loan agreement"
qa_okc "…and the shell says it has no Stage location" "$(field status)" "no Stage location"
REC_EYE="$(field eye)"
last="$(step "await A.openLocation('loan-1');")"
qa_ok "Open location refuses for it with the real reason, moving nothing" "$(field status) / $(field eye) / $(field reading) / $(field sel)" "The Loan agreement is a record with no Stage location — kept in the Loans register, so there is nothing here to open / $REC_EYE / face/rotunda/gwin / loan-1"

qa_say "-- Open location, Bring into view and Face: one promise each, on the record the row names"
ordinary gwin || qa_fail_msg "could not reach the ordinary state before the verbs block"
last="$(step "document.querySelector('#card [data-act=\"look-dims\"][data-id=\"gwin\"]').click();")"
qa_ok "in-place work is in hand, with the camera where it was" "$(field task)" "dims|gwin|gwin|measure|Garden window"
OL_EYE="$(field eye)"
query 'marsh'
last="$(step "document.querySelector('#finderList [data-rec=\"marsh\"] [data-act=\"open-loc\"]').click();")"
qa_ok "Open location opens the specialist reading for the record the row names" "$(field reading) / $(field task)" "face/rotunda/rotunda / face|marsh|rotunda|wall-top|Rotunda wall top"
qa_ok "…leaving the selection where it was, the in-place work put away" "$(field sel) / $(emp 'd["task"].startswith("dims")')" "gwin / 0"
qa_ok "…with the camera moved to the reading it opened" "$(python3 -c 'import json,sys; print("moved" if json.loads(sys.argv[1])["eye"] != sys.argv[2] else "still")' "$last" "$OL_EYE")" "moved"
qa_ok "…as a view state, writing no history" "$(field undo)" "0"
last="$(step "await A.closeAll(); A.select('gwin'); ctx.stage.cam.frameH = 3;")"
KESTREL="$(field kestrelState)"
qa_ok "a zoomed-in standpoint reports the artwork as $KESTREL" "$(python3 -c 'import sys; print(1 if sys.argv[1] in ("off", "behind") else 0)' "$KESTREL")" "1"
query 'kestrel'
last="$(step '')"
qa_ok "…and its row offers the recovery that reason calls for, and no other" "$(field verbsKestrel)" "sel,open-loc,lookat,faceit"
BEFORE_EYE="$(field eye)"
query 'kestrel'
last="$(step "document.querySelector('#finderList [data-rec=\"kestrel\"] [data-act=\"lookat\"]').click();")"
qa_ok "Bring into view opens nothing and keeps the selection" "$(field reading) / $(field sel)" "none / gwin"
qa_ok "…and the camera really moved" "$(python3 -c 'import json,sys; print("moved" if json.loads(sys.argv[1])["eye"] != sys.argv[2] else "still")' "$last" "$BEFORE_EYE")" "moved"
last="$(step "await A.closeAll(); A.select('gwin');")"
query 'rotunda'
last="$(step "document.querySelector('#finderList [data-rec=\"rotunda\"] [data-act=\"faceit\"]').click();")"
qa_ok "Face works on the record the row names, not on the selection" "$(field reading) / $(field task) / $(field sel)" "face/rotunda/rotunda / face|rotunda|rotunda|wall-top|Rotunda wall top / gwin"
last="$(step "await A.closeAll(); A.select('vessel');")"
query 'vessel'
last="$(step '')"
qa_ok "staged content has no specialist depth, so its row offers no Open location" "$(field sel) / $(emp 'd["verbsVessel"] and "open-loc" not in d["verbsVessel"] and "include" not in d["verbsVessel"]')" "vessel / 1"
last="$(step "await A.openLocation('vessel');")"
qa_okc "…and asking for a flight anyway refuses with a reason" "$(field status)" "no specialist depth"

qa_say "-- Include and Reveal are view settings, reachable from a result row"
ordinary gwin || qa_fail_msg "could not reach the ordinary state before the recovery block"
last="$(step "await A.startKnife(); A.presetKnife([-17, 0.25], [13, 0.25], -1, 6); A.commitKnife();")"
last="$(step 'A.setDepth(3);')"
qa_ok "the cut excludes the painting beyond its depth" "$(field depth) / $(field member) / $(field reading)" "3 / beyond / section//"
U_REC="$(field undo)"
query 'harbor'
last="$(step '')"
qa_ok "its row offers exactly the recovery a hidden subject has" "$(field verbsHarbor)" "sel,open-loc,include,reveal,faceit"
last="$(step "document.querySelector('#finderList [data-rec=\"harbor\"] [data-act=\"include\"]').click();")"
qa_ok "Include reaches exactly as far as it must" "$(field depth) / $(field member)" "4 / in"
qa_ok "…as a view change, writing no history" "$(field undo)" "$U_REC"
last="$(step "A.setDepth(3);")"
last="$(step "document.querySelector('#finderList [data-rec=\"harbor\"] [data-act=\"reveal\"]').click();")"
qa_ok "Reveal shows it through at its true place" "$(field reveal) / $(field member)" "harbor / beyond"
qa_ok "…without touching the depth or history" "$(field depth) / $(field undo)" "3 / $U_REC"
last="$(step "A.toggleReveal('harbor'); await A.closeAll();")"
qa_ok "and the reading can be put back with nothing left showing" "$(field reading) / $(field reveal)" "none / None"

qa_say "-- Details: Expand, Focus, Select and Open task are four different things"
ordinary gwin || qa_fail_msg "could not reach the ordinary state before the Details block"
qa_ok "at rest the Card offers the disclosure, shut" "$(field relRows) / $(field expand)" "0 / False"
D_EYE="$(field eye)"; D_UNDO="$(field undo)"
last="$(step "document.querySelector('#card [data-act=\"expand\"]').click();")"
qa_ok "Expand opens the relations and nothing else" "$(field expand) / $(field relRows)" "True / 1"
qa_ok "…the relations are named, with their own verbs" "$(field relNames) / $(field relActs)" "Host Rotunda wall / sel:rotunda look-face:rotunda focus:rotunda"
qa_ok "…changing nothing but what is shown" "$(field sel) / $(field reading) / $(field eye)" "gwin / none / $D_EYE"
last="$(step "document.querySelector('#card [data-act=\"look-dims\"][data-id=\"gwin\"]').click();")"
qa_ok "the subject's own in-place work is in hand" "$(field task)" "dims|gwin|gwin|measure|Garden window"
last="$(step "document.querySelector('#card .rel-row [data-act=\"focus\"][data-id=\"rotunda\"]').click();")"
qa_ok "Focus records the local context without rewriting a measurement of the whole subject" "$(field browseFocus) / $(field task)" '{"kind":"rel","at":"rotunda","what":"wall-top","label":"Rotunda wall top"} / dims|gwin|gwin|measure|Garden window'
last="$(step "A.endTaskInHand(); document.querySelector('#card [data-act=\"look-face\"][data-id=\"gwin\"]').click();")"
qa_ok "the reading for the selection is open, about the opening it walked to" "$(field reading) / $(field task) / $(field instrFocus)" "face/rotunda/gwin / face|gwin|rotunda|opening|Garden window in the Rotunda wall / Garden window in the Rotunda wall"
R_EYE="$(field eye)"
last="$(step "document.querySelector('#card .rel-row [data-act=\"focus\"][data-id=\"rotunda\"]').click();")"
qa_ok "Focus on a reading sets the local point it is about, and the Instrument says so" "$(field task) / $(field instrFocus)" "face|gwin|rotunda|wall-top|Rotunda wall top / Rotunda wall top"
qa_ok "…leaving the identity, the reading and the view exactly where they were" "$(field sel) / $(field cardTitle) / $(field reading) / $(field eye)" "gwin / Garden window / face/rotunda/gwin / $R_EYE"
qa_ok "…and the Index marks the focused relation" "$(field indexFocused)" "1"
last="$(step "document.querySelector('#card .rel-row [data-act=\"sel\"][data-id=\"rotunda\"]').click();")"
qa_ok "Select on a relation changes identity only, reading and all" "$(field sel) / $(field cardTitle) / $(field reading) / $(field eye) / $(field undo)" "rotunda / Rotunda wall / face/rotunda/gwin / $R_EYE / $D_UNDO"
last="$(step "A.endTaskInHand(); A.select('gwin');")"
last="$(step "document.querySelector('#card .rel-row [data-act=\"look-face\"][data-id=\"rotunda\"]').click();")"
qa_ok "Open task does specialist work on the named target, not on the selection" "$(field reading) / $(field task) / $(field sel)" "face/rotunda/rotunda / face|rotunda|rotunda|wall-top|Rotunda wall top / gwin"
last="$(step "await A.closeAll();")"
qa_ok "no command or page fault through any of it" "$(field faults)" "0"

qa_browser_errors_ok "no console or page errors"
qa_summary "Stage S4 · Browse/Search and Details"
