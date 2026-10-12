#!/usr/bin/env bash
# PR #114 · UX1: the shared chrome and the one locator.
#
# This axis owns two claims the plan makes UX1's exit gate, and nothing else:
#   * Exactly one Preview control. Every element that can start a visit lives inside the Head's
#     `Preview ▾` menu; the Index, the Deck, the Stop Card and the Presentation no longer carry their
#     own entries; the scopes the menu offers are the ones that can actually start, and the menu closes
#     behind the visit it starts.
#   * Every subject the Experience's retired Scene list named is still reachable — by pointer and by
#     keyboard — through the one shared locator, deduplicated by identity, with a logical subject
#     marked as having no Stage geometry. Selecting through it presents nothing.
#
# Spatial behaviour, the visitor's execution and the shell's composition belong to the other axes; the
# World shell and its return regressions are re-run by their own scripts, which are re-pointed here.
#
# Usage: qa/locator-check.sh
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

export QA_OUT="${QA_OUT:-$QA_DIR/out/locator}"
export QA_SHOT="${QA_SHOT:-0}"

# The subjects the retired Index list named, read from the page itself: the Scene's own subjects, which
# is exactly the list that used to be a column of Select buttons in the Experience Index.
SUBJECTS='(() => JSON.stringify(Object.keys(window.__me.ctx.sceneSource.subjects)))()'
# One reading of everything an assertion here needs, so two measurements cannot straddle a change.
BLOB='(() => {
  const S = window.__me.S, q = window.__me.qa, ctx = window.__me.ctx;
  const t = (s) => document.querySelector(s);
  const menu = t("#headPreview");
  const scopes = [...document.querySelectorAll("#previewScopes button")].map((b) => b.dataset.scope);
  // Every control anywhere in the document that could start a visit — the only legal home is the menu.
  const starters = [...document.querySelectorAll("[data-act^=exp-preview]")].map((b) => (menu && menu.contains(b) ? "menu" : "elsewhere"));
  return JSON.stringify({
    lens: S.lens,
    sel: S.sel,
    menuHidden: menu ? menu.hidden : null,
    menuOpen: menu ? menu.open : null,
    scopes,
    starters,
    previewActsOutside: starters.filter((x) => x !== "menu").length,
    sceneSubjects: Object.keys(ctx.sceneSource.subjects),
    presentations: Object.keys(ctx.experience.presentations).length,
    guide: ctx.experience.guide.length,
    visitor: !!S.visitor,
    exitPreview: [...document.querySelectorAll("[data-act=exp-exit-preview]")].filter((b) => b.checkVisibility()).length,
    indexPresRef: document.querySelectorAll("#index [data-act=pres-ref]").length,
    browseWorld: !!t("#index [data-act=find-world]"),
    finder: t("#finder") ? !t("#finder").hidden : null,
    finderFocus: S.browse.focus ? JSON.stringify(S.browse.focus) : "none",
    rows: [...document.querySelectorAll("#finderList li.fx-row")].map((r) => r.dataset.rec),
    rowNotes: [...document.querySelectorAll("#finderList li.fx-row")].map((r) => r.dataset.rec + ":" + (r.querySelector(".fx-note") ? r.querySelector(".fx-note").textContent.replace(/[^a-zA-Z ]/g, "").trim().slice(0, 24) : "")),
    rowVerbs: [...document.querySelectorAll("#finderList li.fx-row")].map((r) => r.dataset.rec + ":" + [...r.querySelectorAll(".fx-v")].map((b) => b.dataset.act).join(",")),
    reading: S.session ? S.session.kind : "none",
    task: S.task ? S.task.kind : "none",
    undo: S.undo.length,
    hash: q.hash(),
    eye: q.realized().eye.map((v) => v.toFixed(3)).join(" "),
    chrome: {
      trail: !!t("#trail"),
      undoCount: !!t("#undoCount"),
      undoLabel: !!t("#undoLabel"),
      docState: !!t("#docState"),
      previewScopesRendered: !!t("#previewScopes"),
    },
    status: S.status ? S.status.text : null,
    faults: S.faults.length,
  });
})()'

step() { # step <javascript statements>
  qa_jsv "(async () => { const A = window.__me.A, S = window.__me.S, ctx = window.__me.ctx; $1 await window.__me.qa.idle(); await window.__me.qa.render(); return ${BLOB}; })()"
}
field() { python3 -c 'import json, sys
d = json.loads(sys.argv[1]); v = d.get(sys.argv[2])
print("None" if v is None else v)' "$last" "$1" 2>/dev/null; }
emp() { python3 -c 'import json, sys
print(1 if eval(sys.argv[2], {"d": json.loads(sys.argv[1])}) else 0)' "$last" "$1" 2>/dev/null; }

# A real pointer click on a live control, for the cases qa_click cannot reach (a control inside a closed
# disclosure is invoked through the page's own click, exactly as the other axes do).
tap() { # tap <selector>
  local r
  r="$(qa_js "(async () => { const e = document.querySelector('$1'); if (!e) return 'missing'; e.click(); await window.__me.qa.idle(); return 'ok'; })()")"
  qa_frames
  [ "$r" = "\"ok\"" ] || qa_fail_msg "no live control at $1"
}
lens() { # lens <world|experience> — a real pointer click, verified by the state it must produce
  qa_click "#lens [data-act=lens][data-lens=$1]" || return 1
  last="$(step '')"
  [ "$(field lens)" = "$1" ] || qa_fail_msg "the $1 lens did not come into hand"
}

qa_open
qa_say "== PR #114 · UX1 · the one Preview control and the one locator"
qa_faults_clear

qa_say "-- one Preview control for the whole shell, and the scopes that can really start"
last="$(step '')"
qa_ok "at rest, no visit is running and the shell is ordinary" "$(field visitor) / $(field lens)" "False / world"
qa_ok "the chrome carries no View trail, no transaction count, no last-change label and no claimed save" "$(field chrome)" "{'trail': False, 'undoCount': False, 'undoLabel': False, 'docState': False, 'previewScopesRendered': True}"
qa_ok "every control that can start a visit lives in the Head's one Preview menu" "$(field previewActsOutside) / $(field menuHidden)" "0 / False"
qa_ok "with one Presentation and no Guide, exactly that scope is offered — and it names the Presentation" \
  "$(field scopes) / $(qa_jsv 'document.querySelector("#previewScopes button").textContent')" \
  "['presentation'] / Presentation · Saltmarsh Highlights"
tap '#experienceExamples [data-act=exp-example]'
last="$(step '')"
scopes="$(field scopes)"
case "$scopes" in
  *guide*) qa_ok "a Guide adds its own scope to the same control, and adds no second control" "$(field previewActsOutside)" "0" ;;
  *) qa_fail_msg "a loaded Guide did not offer its scope: $scopes" ;;
esac

qa_say "-- the menu starts the scope it names, and closes behind the visit"
last="$(step '')"
before="$(field hash)"; before_sel="$(field sel)"
qa_preview presentation || qa_fail_msg "the Presentation scope did not start"
last="$(step '')"
qa_ok "the scope starts the visit, and the menu is closed behind it" "$(field visitor) / $(field menuOpen)" "True / False"
qa_ok "the visitor surface offers exactly one Exit Preview" "$(field exitPreview)" "1"
tap '[data-act=exp-exit-preview]'
last="$(step '')"
qa_ok "Exit returns the exact authoring context: same source, same identity, no visit running" "$(field hash) / $(field sel) / $(field visitor)" "$before / $before_sel / False"

qa_say "-- the retired Scene list is gone, and its subjects are reached through the one locator"
lens experience
last="$(step '')"
qa_ok "the Experience Index no longer lists Scene subjects as its own Select buttons" "$(field indexPresRef)" "0"
qa_ok "…and it names the one locator instead" "$(field browseWorld)" "True"
tap '#index [data-act=find-world]'
last="$(step '')"
qa_ok "Browse World opens the shared locator at the whole museum, not at a leftover context" "$(field finder) / $(field finderFocus)" "True / none"

SUBJ="$(qa_jsv "$SUBJECTS")"
qa_say "   formerly listed subjects: $SUBJ"

pointer_ok=0
keyboard_ok=0
total=0
for id in $(python3 -c 'import json,sys; print(" ".join(json.loads(sys.argv[1])))' "$SUBJ"); do
  total=$((total + 1))
  # Pointer: the real field, then the row's own Select.
  qa_locator_select "$id" pointer && last="$(step '')" || last="$(step '')"
  [ "$(field sel)" = "$id" ] && pointer_ok=$((pointer_ok + 1)) || qa_fail_msg "pointer: the locator did not select $id (got $(field sel))"
  # Keyboard: the same field, then ArrowDown and Enter on the highlighted row.
  qa_locator_select "$id" keyboard && last="$(step '')" || last="$(step '')"
  [ "$(field sel)" = "$id" ] && keyboard_ok=$((keyboard_ok + 1)) || qa_fail_msg "keyboard: ArrowDown/Enter did not select $id (got $(field sel))"
done
qa_ok "every formerly listed subject is reachable by pointer through the locator" "$pointer_ok / $total" "$total / $total"
qa_ok "…and by keyboard, on the row the locator highlights" "$keyboard_ok / $total" "$total / $total"

qa_say "-- one row per identity, and a logical subject is marked rather than promised a flight"
lens experience
qa_locator_open find >/dev/null
qa_locator_query ''
# Page the whole listing, the way an author would: the count below is over every row, not one page.
qa_js "(async () => { const { qa: q } = window.__me; for (let i = 0; i < 12; i++) { const b = document.querySelector('#finderMore [data-act=\"more\"]'); if (!b) break; b.click(); await q.idle(); await q.render(); } return 1; })()" >/dev/null
last="$(step '')"
qa_ok "every Scene subject is listed once, so Select can never be ambiguous" \
  "$(emp 'len(d["rows"]) == len(set(d["rows"])) and all(s in d["rows"] for s in d["sceneSubjects"])')" "1"
qa_ok "a logical subject says it has no Stage geometry and offers Select alone" \
  "$(emp 'all(any(n.startswith(s + ":no location here") for n in d["rowNotes"]) for s in ["atmosphere", "wallAssembly"]) and all((s + ":sel") in d["rowVerbs"] for s in ["atmosphere", "wallAssembly"])')" "1"
qa_ok "a realized subject keeps the recovery its real position calls for, acting on its own name" \
  "$(emp 'any(v.startswith("light:sel") and "," in v for v in d["rowVerbs"]) or any(v.startswith("switch:sel") and "," in v for v in d["rowVerbs"])')" "1"

qa_say "-- the register is still the register: it never borrows a Scene subject"
last="$(step "S.browse.focus = { kind: 'records' };")"
last="$(step '')"
qa_ok "the register lists records only, and no Scene subject is borrowed into it" \
  "$(emp 'len(d["rows"]) > 0 and not any(r.startswith("atmosphere") or r.startswith("machine") or r.startswith("light") for r in d["rows"])')" "1"

qa_say "-- selecting through the locator is identity only: it presents nothing and writes nothing"
last="$(step "S.browse.focus = null; await A.closeAll(); A.endTaskInHand(); A.select('gwin');")"
BEFORE_HASH="$(field hash)"; BEFORE_UNDO="$(field undo)"; BEFORE_PRES="$(field presentations)"; BEFORE_EYE="$(field eye)"
last="$(step '')"
qa_locator_select switch keyboard
last="$(step '')"
qa_ok "the identity changed" "$(field sel)" "switch"
qa_ok "…and nothing was presented, opened, written or moved" \
  "$(field presentations) / $(field reading) / $(field task) / $(field undo) / $(field hash) / $(field eye)" \
  "$BEFORE_PRES / none / none / $BEFORE_UNDO / $BEFORE_HASH / $BEFORE_EYE"

qa_say "-- with nothing that can start, the one control is absent rather than inert"
# The plan's rule for the menu is that a scope which cannot run is absent, and that the control itself
# is absent when nothing can start. Both halves are read here against the live Experience, then put back
# exactly as they were — a session probe of the shell's own rendering rule, not an edit.
no_scopes="$(qa_jsv "(async () => {
  const ctx = window.__me.ctx, e = ctx.experience;
  const saved = { presentations: e.presentations, guide: e.guide, uses: e.uses };
  e.presentations = {}; e.guide = []; e.uses = {};
  ctx.ui(); await window.__me.qa.idle(); await window.__me.qa.render();
  const hidden = document.querySelector('#headPreview').hidden;
  const scopes = document.querySelectorAll('#previewScopes button').length;
  e.presentations = saved.presentations; e.guide = saved.guide; e.uses = saved.uses;
  ctx.ui(); await window.__me.qa.idle(); await window.__me.qa.render();
  return JSON.stringify([hidden, scopes, document.querySelector('#headPreview').hidden, document.querySelectorAll('#previewScopes button').length > 0]);
})()")"
qa_ok "…and with nothing that can start, the one control is absent rather than inert" "$no_scopes" '[true,0,false,true]'

qa_say "-- and the World shell is where it was"
lens world
last="$(step "S.browse.focus = null; await A.closeAll();")"
qa_ok "the World Index is its own list again" "$(qa_js 'document.querySelectorAll("#index .ix-row").length >= 5')" "true"
qa_locator_select gwin pointer
last="$(step '')"
qa_ok "…and the one locator still reads the whole museum in the World lens" "$(field sel) / $(field finder)" "gwin / False"
qa_ok "no Visit, no visit-in-progress" "$(field visitor)" "False"
qa_ok "no command or page fault through any of it" "$(field faults)" "0"

qa_browser_errors_ok "no console or page errors"
qa_summary "PR #114 · UX1 · Preview consolidation and locator coverage"
