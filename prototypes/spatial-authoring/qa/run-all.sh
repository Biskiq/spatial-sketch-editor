#!/usr/bin/env bash
# The World Authoring Prototype's own acceptance run: everything the prototype can prove about
# itself, with a nonzero exit if any axis fails.
#
#   qa/run-all.sh              both axes
#   qa/run-all.sh journey      Axis B journeys A–F only
#   qa/run-all.sh interaction  Axis B real interaction paths only
#   qa/run-all.sh flows        Axis B pointer flows and exact return only
#
# Each script gets its own harness session and tears its browser down, so one wedged session cannot
# make the next axis look broken. Later stages add axes here rather than in private scripts.
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WHICH="${1:-all}"
rc=0
export QA_CLOSE_ON_EXIT=1

run() { # run <name> <script>
  echo
  echo "=================================================================="
  echo "  $1"
  echo "=================================================================="
  QA_SESSION="p26-qa-$2" QA_OUT="$QA_DIR/out/$2" bash "$QA_DIR/$2.sh" || rc=1
}

case "$WHICH" in
  journey) run "Axis B · journeys A–F" journey-check ;;
  interaction) run "Axis B · real interaction" interaction-check ;;
  flows) run "Axis B · pointer flows" flow-check ;;
  all)
    run "Axis B · journeys A–F" journey-check
    run "Axis B · real interaction" interaction-check
    run "Axis B · pointer flows" flow-check
    ;;
  *)
    echo "qa: unknown axis '$WHICH' (journey|interaction|flows|all)"
    exit 2
    ;;
esac

echo
if [ "$rc" -eq 0 ]; then echo "qa: all requested axes passed"; else echo "qa: FAILURES above"; fi
exit "$rc"
