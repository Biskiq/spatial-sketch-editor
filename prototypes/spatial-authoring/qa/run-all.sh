#!/usr/bin/env bash
# The World Authoring Prototype's own acceptance run: everything the prototype can prove about
# itself, with a nonzero exit if any axis fails.
#
#   qa/run-all.sh              both axes
#   qa/run-all.sh journey      Axis B journeys A–F only
#   qa/run-all.sh interaction  Axis B real interaction paths only
#   qa/run-all.sh flows        Axis B pointer flows and exact return only
#   qa/run-all.sh policy       the lifecycle seams only
#   qa/run-all.sh shell        the World shell's composition only
#   qa/run-all.sh precision    spatial tasks and Precision only
#   qa/run-all.sh browse       Browse/Search and the Details grammar only
#   qa/run-all.sh repair       the unresolved reference and its Repair only
#   qa/run-all.sh lens         the lens, parked World work and explicit Resume only
#
# Each script gets its own harness session and tears its browser down, so one wedged session cannot
# make the next axis look broken and no browser helper is left behind for the next axis (or the next
# run) to fight with. Later stages add axes here rather than in private scripts.
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
  # The axis closes its own browser on every exit path; this is belt and braces for a hard kill, so
  # the next axis never starts behind a live helper. Never --all: that would close another agent's.
  QA_SESSION="p26-qa-$2" agent-browser close >/dev/null 2>&1 || true
}

case "$WHICH" in
  journey) run "Axis B · journeys A–F" journey-check ;;
  interaction) run "Axis B · real interaction" interaction-check ;;
  flows) run "Axis B · pointer flows" flow-check ;;
  policy) run "Lifecycle · cancellation, identity, seams" policy-check ;;
  shell) run "Stage S2 · the ordinary World shell" shell-check ;;
  precision) run "Stage S3 · spatial tasks and Precision" precision-check ;;
  browse) run "Stage S4 · Browse/Search and Details" browse-check ;;
  repair) run "Stage S5 · an unresolved reference and its repair" repair-check ;;
  lens) run "Stage S6 · the lens, parked work and explicit Resume" lens-check ;;
  all)
    run "Axis B · journeys A–F" journey-check
    run "Axis B · real interaction" interaction-check
    run "Axis B · pointer flows" flow-check
    run "Lifecycle · cancellation, identity, seams" policy-check
    run "Stage S2 · the ordinary World shell" shell-check
    run "Stage S3 · spatial tasks and Precision" precision-check
    run "Stage S4 · Browse/Search and Details" browse-check
    run "Stage S5 · an unresolved reference and its repair" repair-check
    run "Stage S6 · the lens, parked work and explicit Resume" lens-check
    ;;
  *)
    echo "qa: unknown axis '$WHICH' (journey|interaction|flows|policy|shell|precision|browse|repair|lens|all)"
    exit 2
    ;;
esac

echo
if [ "$rc" -eq 0 ]; then echo "qa: all requested axes passed"; else echo "qa: FAILURES above"; fi
exit "$rc"
