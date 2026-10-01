#!/usr/bin/env bash
# Axis B — the inherited P26 presenter: journeys A–F, one step per eval, each step compared against
# the recorded checkpoint (reading, canonical selection, reading/session parameters, Undo depth,
# Reveal, crumbs, standpoint) rather than merely returning. A command that throws inside anim.run and
# any page error both fail the run.
#
# Usage: qa/journey-check.sh [label]
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

LABEL="${1:-world}"
BASELINE="$QA_DIR/baseline.json"
[ -f "$BASELINE" ] || { qa_say "qa: no baseline at $BASELINE — run qa/capture-baseline.sh first"; exit 2; }
export QA_OUT="${QA_OUT:-$QA_DIR/out/$LABEL}"

qa_open
qa_say "== Axis B · journeys A–F against $BASELINE"
qa_faults_clear

qa_ok "fixture source digest unchanged" "$(qa_jsv 'window.__me.qa.hash()')" "$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["fixtureHash"])' "$BASELINE")"

COUNTS="$(qa_jsv 'window.__me.JOURNEYS.map(j => j.id + "=" + j.steps.length).join(" ")')"
qa_ok "50 presenter steps present" "$(python3 -c "print(sum(int(p.split('=')[1]) for p in '$COUNTS'.split()))")" "50"

for pair in $COUNTS; do
  id="${pair%%=*}"
  n="${pair##*=}"
  STEP=0
  while [ "$STEP" -lt "$n" ]; do
    CASE="$id$((STEP + 1))"
    STATE="$(qa_js "(async () => { const j = window.__me.JOURNEYS.find(x => x.id === \"$id\"); await j.steps[$STEP].run(); await window.__me.qa.idle(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return window.__me.qa.state(); })()")"
    if [ "$STATE" = "null" ] || [ -z "$STATE" ]; then
      qa_fail_msg "Journey $id step $((STEP + 1)) did not return a state (the step threw)"
    else
      printf '%s' "$STATE" >"$QA_OUT/.state.json"
      if python3 "$QA_DIR/check.py" "$QA_OUT/.state.json" --baseline "$BASELINE" --case "$CASE" --name "Journey $id · step $((STEP + 1))/$n"; then
        qa_pass=$((qa_pass + 1))
      else
        qa_fail=$((qa_fail + 1))
      fi
    fi
    STEP=$((STEP + 1))
  done
done

qa_faults_ok "no command or page fault during the full A–F run"
qa_browser_errors_ok "no console or page errors"
qa_snap "journey-final"
qa_summary "Axis B journeys A–F"
