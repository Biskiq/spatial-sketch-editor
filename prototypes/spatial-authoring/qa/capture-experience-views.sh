#!/usr/bin/env bash
# QA 3's own capture pass (PR #114 · UX2): the Presentation Card, the Views list and the View Card at
# both review sizes.
#
# It is the pair tool for the QA 3 board: the Presentation with its unordered Views list and the Stage's
# own View markers at 1440×900, the rendered View preview with its operations, the one Advanced
# authoring home, and the narrow Card sheet at 1024×768. Each capture is accompanied by a reading of what
# was photographed — that the Views list is the unordered list with exactly one ★ Default, that the
# preview is the Stage's own rendered picture rather than its pending placeholder, and that the same
# controls are hit-reachable inside the narrow sheet — so a reader can trust the image to be the state
# the name claims. It asserts nothing about appearance: the visual review is the owner's.
#
# It is deliberately NOT part of run-all.sh: evidence is taken on purpose, like capture-baseline.sh.
#
# Usage: qa/capture-experience-views.sh [outdir]      (default: screens/experience-ux2)
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export QA_SHOT=1
export QA_OUT="${1:-${QA_OUT:-$QA_DIR/../screens/experience-ux2}}"
export QA_QUERY="${QA_QUERY:-motion=instant}"
source "$QA_DIR/lib.sh"
qa_pass=0; qa_fail=0

# A selector is handed to the page as a JSON string, never interpolated into JavaScript source: a
# selector legitimately contains quotes (an attribute value, a leading #), and a hand-built literal would
# turn a working control into a syntax error the harness reads as a missing one.
js_query() { python3 -c 'import json, sys; print("document.querySelector(%s)" % json.dumps(sys.argv[1]))' "$1"; }
tap() { # tap <selector>
  local js r
  js="(async () => { const e = $(js_query "$1"); if (!e) return 'missing'; e.click(); await window.__me.qa.idle(); return 'ok'; })()"
  r="$(qa_js "$js")"
  qa_frames
  [ "$r" = "\"ok\"" ] || qa_fail_msg "no live control at $1"
}
read_ok() { # read_ok <name> <expression of the page>
  qa_ok "$1" "$(qa_js "$2")" true
}
shot() { # shot <name>
  qa_snap "$1"
  qa_say "qa: captured $QA_OUT/$1.png"
}
# The rendered preview is produced by the Stage's own renderer, one idle turn at a time — and a turn
# only happens when a frame is drawn, because a backgrounded tab has no animation loop of its own. So the
# capture draws frames while it waits for the picture, rather than polling a page that is never asked to
# render; and it says so if the picture never arrives, instead of photographing the pending placeholder as
# if it were the finished reading.
wait_preview() { # wait_preview <useId>
  local state js
  js="$(js_query "[data-exp-preview=\"$1\"] [data-exp-preview-image]")!==null"
  for _ in $(seq 1 60); do
    qa_frames
    state="$(qa_js "$js")"
    [ "$state" = "true" ] && return 0
    sleep 0.15
  done
  qa_fail_msg "the View preview never rendered for $1"
  return 1
}
# Hit-reachability inside a scroll container: on screen, inside the viewport, and the point at its own
# centre actually addresses it (or something it contains) rather than a covering band. One predicate is
# shared by the single-element and whole-list readings, so a list cannot be read with a looser rule than a
# row.
reach_predicate_js() {
  echo "(e) => { if (!e) return false; const r = e.getBoundingClientRect(); if (!(r.width > 0 && r.height > 0 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight)) return false; const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return !!hit && (hit === e || e.contains(hit)); }"
}
reach_js() { echo "($(reach_predicate_js))($(js_query "$1"))"; }
# Exactly one row carries ★ — the span is rendered for every row and only the Default fills it in.
default_star_js() { echo "[...document.querySelectorAll('[data-exp-views] .exp-star')].filter((s) => s.textContent.trim() === '★').length === 1"; }

qa_open
qa_say "qa: capturing QA 3 (Presentation and Views) from $QA_BASE into $QA_OUT"

tap '#lens [data-lens=experience]'
tap '#experienceExamples [data-act=exp-example]'

# The Presentation Card: Focus, the unordered Views list with its one ★ Default, and the Stage's own
# View markers placed around the focus. Reached through the Index row, exactly as an author reaches it.
tap '#index [data-act=exp-open]'
shot 'qa3-1440-presentation-views'
read_ok 'the photographed Card is the Presentation, its Views list is unordered and exactly one row is ★ Default' \
  "(() => { const e = __me.ctx.experience, p = e.presentations[__me.S.experienceContext.presentation], rows = [...document.querySelectorAll('[data-exp-views] [data-exp-view-use]')]; return !!p && rows.length === p.uses.length && rows.every($(reach_predicate_js)) && $(default_star_js) && !document.querySelector('[data-exp-views] [data-view-order]') && document.querySelectorAll('.exp-view-pin').length === p.uses.length; })()"

# One View: its faithful rendered preview and its own operations, without moving the Camera.
VIEW_USE="$(qa_jsv '(() => { const p = __me.ctx.experience.presentations[__me.S.experienceContext.presentation]; return p ? p.uses[0] : ""; })()')"
pose_before="$(qa_js '__me.nav.plainPose()')"
tap "#card [data-exp-views] [data-exp-view-use='$VIEW_USE']"
wait_preview "$VIEW_USE"
shot 'qa3-1440-view-preview'
read_ok 'the photographed Card is that View, with its own operations and the rendered picture' \
  "(() => { const c = document.querySelector('#card'); return __me.S.sel === $(python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$VIEW_USE") && c.querySelector('.c-k').textContent.includes('View · Experience') && !!c.querySelector('[data-exp-ops]') && !!c.querySelector('[data-exp-preview] [data-exp-preview-image]'); })()"
qa_ok 'selecting a View in the list leaves the standpoint exactly where it was' "$(qa_js '__me.nav.plainPose()')" "$pose_before"

# The one Advanced authoring home: narration, behaviors and offers, View switching and the derived
# suggestions, behind the Card's own menu.
tap '#index [data-act=exp-open]'
tap '#card [data-exp-menu=presentation] > summary'
tap '#card [data-exp-menu=presentation] [data-act=exp-advanced]'
shot 'qa3-1440-advanced'
read_ok 'the photographed state is the one Advanced authoring home, with View switching for every View' \
  "(() => { const h = document.querySelector('#card [data-exp-advanced-home]'); const p = __me.ctx.experience.presentations[__me.S.experienceContext.presentation]; return !!h && h.open && !!h.querySelector('[data-act=exp-offer]') && h.querySelectorAll('[data-exp-cue]').length === p.uses.length; })()"

# The narrow pair: the Card is an invoked sheet over an unresized Stage, and the Views list and the
# rendered preview stay reachable inside it. The sheet shows what is selected, so the Presentation is
# selected again first — the narrow pair reads the same two states as the wide one.
tap '#index [data-act=exp-open]'
agent-browser set viewport 1024 768 >/dev/null
qa_frames
tap '[data-act=sheet-card]'
shot 'qa3-1024-presentation-views'
read_ok 'inside the narrow sheet the Views list is fully reachable and still carries its one ★ Default' \
  "(() => { const rows = [...document.querySelectorAll('[data-exp-views] [data-exp-view-use]')]; const c = document.querySelector('#card').getBoundingClientRect(); return !!__me.S.sheet.card && c.right <= innerWidth && c.left >= 0 && rows.length > 0 && rows.every($(reach_predicate_js)) && $(default_star_js); })()"
pose_before="$(qa_js '__me.nav.plainPose()')"
tap "#card [data-exp-views] [data-exp-view-use='$VIEW_USE']"
wait_preview "$VIEW_USE"
shot 'qa3-1024-view-preview'
read_ok 'inside the narrow sheet the View preview and its operations are reachable too' \
  "(() => { const ops = document.querySelector('#card [data-exp-ops]'); return !!ops && $(reach_js '#card [data-exp-ops]') && $(reach_js '[data-exp-preview-image]'); })()"
qa_ok 'the narrow View selection leaves the standpoint exactly where it was' "$(qa_js '__me.nav.plainPose()')" "$pose_before"

qa_faults_ok 'no command or page faults while capturing'
qa_ok 'every QA 3 reading above passed' "$qa_fail" 0
qa_summary "QA 3 captures ($QA_OUT)"
