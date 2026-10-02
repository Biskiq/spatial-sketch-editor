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
    STATE="$(qa_js "(async () => { const j = window.__me.JOURNEYS.find(x => x.id === \"$id\"); await j.steps[$STEP].run(); await window.__me.qa.idle(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const m = window.__me.ctx.museum, w = m.walls.find(w => w.id === 'rotunda'), o = w.openings.find(o => o.id === 'gwin'); return { ...window.__me.qa.state(), sourceValues: { window: o, top: w.top, doorHead: w.openings.find(o => o.id === 'gdoor').head, north: m.walls.find(w => w.id === 'north').top.h, soffit: m.ceilings.find(c => c.id === 'soffit').plane.base } }; })()")"
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
    # Exact authored outcomes complement the view/history baseline without another browser call.
    EXPECT=''
    case "$CASE" in
      A11) EXPECT='{"window":{"head":3.4,"rise":0.45,"w":2.2,"sill":0.7},"top":{"rh":7.2}}' ;;
      B10) EXPECT='{"doorHead":3.2}' ;;
      C9) EXPECT='{"north":4.2,"soffit":3}' ;;
      E8) EXPECT='{"window":{"s":6.399999999999999,"w":2,"head":3.8,"rise":0.6}}' ;;
      E9) EXPECT='{"window":{"s":6.399999999999999,"w":2,"head":3.4,"rise":0.8}}' ;;
    esac
    if [ -n "$EXPECT" ]; then
      if python3 "$QA_DIR/check.py" "$QA_OUT/.state.json" --expect "{\"sourceValues\":$EXPECT}" --tol 0 --name "$CASE exact source"; then qa_pass=$((qa_pass + 1)); else qa_fail=$((qa_fail + 1)); fi
    fi
    STEP=$((STEP + 1))
  done
done

qa_faults_ok "no command or page fault during the full A–F run"
qa_browser_errors_ok "no console or page errors"
qa_snap "journey-final"
qa_summary "Axis B journeys A–F"
