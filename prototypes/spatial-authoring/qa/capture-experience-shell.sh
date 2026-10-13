#!/usr/bin/env bash
# The Experience shell's four review states, captured at both review sizes (PR #114).
#
# This is the pair tool for #114's before/after comparison: run it against the pre-#114 tree for the
# before side and against the slice's tree for the after side, then compare each state side by side
# with its board. It asserts nothing about appearance — it drives the four states through controls that
# survive the overhaul (the lens, the explicit loaders, the Guide entry and the Head Preview) and
# writes one image per state.
#
# It is deliberately NOT part of run-all.sh: evidence is taken on purpose, like capture-baseline.sh.
#
# `screens/experience-ux-before/` is UX0's genuine pre-overhaul baseline and is never written by a bare
# run: the before side was taken from the start-head tree, so refreshing it is a deliberate act that names
# that directory itself (`QA_OUT=…/screens/experience-ux-before bash qa/capture-experience-shell.sh`). A
# passive run writes its own, current-tree directory instead.
#
# Usage: qa/capture-experience-shell.sh [outdir]      (default: screens/experience-shell)
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export QA_SHOT=1
export QA_OUT="${1:-${QA_OUT:-$QA_DIR/../screens/experience-shell}}"
export QA_QUERY="${QA_QUERY:-motion=instant}"
source "$QA_DIR/lib.sh"

tap() { # tap <selector>
  local r
  r="$(qa_js "(async () => { const e = document.querySelector('$1'); if (!e) return 'missing'; e.click(); await window.__me.qa.idle(); return 'ok'; })()")"
  qa_frames
  [ "$r" = "\"ok\"" ] || qa_fail_msg "no live control at $1"
}
shot() { # shot <name>
  qa_snap "$1"
  qa_say "qa: captured $QA_OUT/$1.png"
}

qa_open
qa_say "qa: capturing the Experience shell from $QA_BASE into $QA_OUT"

tap '#lens [data-lens=experience]'
tap '#experienceExamples [data-act=exp-example]'
shot 'experience-shell-1440-ordinary'

tap '#experienceDeck [data-act=exp-guide]'
shot 'experience-shell-1440-guide'

qa_preview_presentation
shot 'experience-shell-1440-preview'
tap '[data-act=exp-exit-preview]'

# Closing the Guide home is what lets the narrow pair start from the ordinary lane again.
tap '#experienceDeck [data-act=exp-close]'
agent-browser set viewport 1024 768 >/dev/null
qa_frames
shot 'experience-shell-1024-ordinary'
tap '#experienceDeck [data-act=exp-guide]'
shot 'experience-shell-1024-guide'

qa_faults_ok 'no command or page faults while capturing'
qa_summary "Experience shell captures ($QA_OUT)"
