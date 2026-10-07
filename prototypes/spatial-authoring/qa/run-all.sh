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
#   qa/run-all.sh experience   Experience wiring and the visitor's isolated preview only
#   qa/run-all.sh visitor      visitor execution controls and source isolation only
#   qa/run-all.sh revision     C9.6 revision, removal and repair only
#   qa/run-all.sh rich         C9.7 rich example, native Wall and local coordination only
#   qa/run-all.sh precision-c9 C9.8 the precise Camera, its property depth and one tape only
#   qa/run-all.sh presenter    C9.9 the review aid's eighteen topics and its own honesty only
#   qa/run-all.sh reconciliation shared-shell, saved controls and narrow Experience proof
#   qa/run-all.sh continuity   both-directions parking, neutral Resume, Preview return, history only
#   qa/run-all.sh responsive   viewport/DPR, keyboard and motion only
#   qa/run-all.sh correctness  remaining source and nested-return obligations
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
  conformance) run "V2 conformance · product journeys" conformance-check ;;
  creator) run "C9.1 · standalone creator and domain preservation" creator-check ;;
  composition) run "C9.2/C9.3 · composition and compact Guide" composition-check ;;
  revision) run "C9.6 · revision, removal and repair" revision-check ;;
  rich) run "C9.7 · rich example and local coordination" rich-check ;;
  precision-c9) run "C9.8 · the precise Camera, its depth and one tape" precision-c9-check ;;
  presenter) run "C9.9 · the review aid's eighteen topics" presenter-check ;;
  walkthrough) run "C9 follow-up · shared Experience workflow" walkthrough-check ;;
  experience) run "Stage S7 · Experience wiring and the visitor's isolated preview" experience-check ;;
  visitor) run "Visitor execution" visitor-check ;;
  reconciliation) run "Shared shell and narrow Experience" reconciliation-check ;;
  continuity) run "Stage S8 · full continuity between the two lenses" continuity-check ;;
  responsive) run "Stage S7 · responsive and keyboard" responsive-check ;;
  correctness) run "Additional source and nested correctness" correctness-check ;;
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
    run "Stage S7 · Experience wiring and the visitor's isolated preview" experience-check
    run "V2 conformance · product journeys" conformance-check
    run "C9.1 · standalone creator and domain preservation" creator-check
    run "C9.2/C9.3 · composition and compact Guide" composition-check
    run "C9.6 · revision, removal and repair" revision-check
    run "C9.7 · rich example and local coordination" rich-check
    run "C9.8 · the precise Camera, its depth and one tape" precision-c9-check
    run "C9.9 · the review aid's eighteen topics" presenter-check
    run "C9 follow-up · shared Experience workflow" walkthrough-check
    run "Visitor execution" visitor-check
    run "Shared shell and narrow Experience" reconciliation-check
    run "Stage S8 · full continuity between the two lenses" continuity-check
    run "Stage S7 · responsive and keyboard" responsive-check
    run "Additional source and nested correctness" correctness-check
    ;;
  *)
    echo "qa: unknown axis '$WHICH' (journey|interaction|flows|policy|shell|precision|browse|repair|lens|conformance|creator|composition|revision|rich|precision-c9|presenter|experience|visitor|reconciliation|continuity|responsive|correctness|all)"
    exit 2
    ;;
esac

echo
if [ "$rc" -eq 0 ]; then echo "qa: all requested axes passed"; else echo "qa: FAILURES above"; fi
exit "$rc"
