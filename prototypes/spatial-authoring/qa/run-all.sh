#!/usr/bin/env bash
# The World Authoring Prototype's own acceptance run: everything the prototype can prove about
# itself, with a nonzero exit if any axis fails.
#
#   qa/run-all.sh              every axis
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
#   qa/run-all.sh experience-shell  the Experience shell's composition: homes, the Deck band and the visitor surface
#   qa/run-all.sh locator      UX1: the one Preview control and the one shared locator
#   qa/run-all.sh visitor      visitor execution controls and source isolation only
#   qa/run-all.sh revision     C9.6 revision, removal and repair only
#   qa/run-all.sh rich         C9.7 rich example, native Wall and local coordination only
#   qa/run-all.sh precision-c9 C9.8 the precise Camera, its property depth and one tape only
#   qa/run-all.sh presenter    C9.9 the review aid's eighteen topics and its own honesty only
#   qa/run-all.sh walkthrough shared lens workflow and advisory outcomes
#   qa/run-all.sh walkthrough-demo optional task demonstrations and cancellation
#   qa/run-all.sh reconciliation shared-shell, saved controls and narrow Experience proof
#   qa/run-all.sh continuity   both-directions parking, neutral Resume, Preview return, history only
#   qa/run-all.sh responsive   viewport/DPR, keyboard and motion only
#   qa/run-all.sh correctness  remaining source and nested-return obligations
#
# The `all` sweep runs several axes at once. That is safe by construction rather than by luck: each
# axis owns a browser session whose name carries this run's token, serves this checkout on its own
# ephemeral port, and writes its captures to its own qa/out/<axis> — so no axis can read another's
# page, port or output, and two concurrent runs (another worktree, another agent) cannot share a
# browser either. Each axis' output is buffered and printed as one block when that axis finishes,
# because twenty-six live streams interleaved on one terminal are not readable. A single axis
# (`qa/run-all.sh conformance`) is always run alone, with its output live.
#
# Environment:
#   QA_JOBS       how many axes the sweep runs at once (default 3; 1 = strictly one at a time).
#                 Every axis starts its own headless browser, and the axes are CPU-bound in this
#                 harness (one CLI process per eval, software-rendered pages), so this is bounded by
#                 cores rather than by waiting. Measured on an 8-core machine, whole sweep, the same
#                 tree: 1 → 285 s, 2 → 212 s, 3 → 174 s (all green); 6 → 290 s and *six* false
#                 failures, every one of them a timing-sensitive reading (the image pass's idle-turn
#                 and cache laws, a visitor caption, and the three Gate-completion reads this suite
#                 already documents as load-sensitive). Raise it only with a measurement in hand:
#                 more browsers than cores buys nothing and starts failing honest assertions.
#   QA_RUN_TOKEN  pin the run token carried in every session name (reproduce a run's session names).
#
# Each script gets its own harness session and tears its browser down, so one wedged session cannot
# make the next axis look broken and no browser helper is left behind for the next axis (or the next
# run) to fight with. Later stages add axes here rather than in private scripts.
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WHICH="${1:-all}"
rc=0
export QA_CLOSE_ON_EXIT=1
# This run's token: the axis names below stay readable while the session each axis uses is unique to this
# process. QA_RUN_TOKEN may be pinned to reproduce a run's session name.
RUN_TOKEN="${QA_RUN_TOKEN:-$$-$(date +%s)}"

run() { # run <name> <script>  — one axis, alone, live output
  echo
  echo "=================================================================="
  echo "  $1"
  echo "=================================================================="
  # One session name per axis *per run*: the axis is still named for the reader, but the run token keeps
  # two concurrent invocations (another worktree, another agent, a parallel mutation proof) from sharing
  # one browser. Cleanup uses the same name, so nothing is left behind either.
  local session="p26-qa-$2-$RUN_TOKEN"
  QA_SESSION="$session" QA_OUT="$QA_DIR/out/$2" bash "$QA_DIR/$2.sh" || rc=1
  # The axis closes its own browser on every exit path; this is belt and braces for a hard kill, so
  # the next axis never starts behind a live helper. Never --all: that would close another agent's.
  QA_SESSION="$session" agent-browser close >/dev/null 2>&1 || true
}

# ------------------------------------------------------------------ the sweep
# The sweep's axis list, in report order: "display name|script stem". One place to add a stage.
AXES=(
  "Axis B · journeys A–F|journey-check"
  "Axis B · real interaction|interaction-check"
  "Axis B · pointer flows|flow-check"
  "Lifecycle · cancellation, identity, seams|policy-check"
  "Stage S2 · the ordinary World shell|shell-check"
  "Stage S3 · spatial tasks and Precision|precision-check"
  "Stage S4 · Browse/Search and Details|browse-check"
  "Stage S5 · an unresolved reference and its repair|repair-check"
  "Stage S6 · the lens, parked work and explicit Resume|lens-check"
  "Stage S7 · Experience wiring and the visitor's isolated preview|experience-check"
  "PR #114 · the Experience shell's composition|experience-shell-check"
  "PR #114 · UX1 · Preview consolidation and locator coverage|locator-check"
  "V2 conformance · product journeys|conformance-check"
  "C9.1 · standalone creator and domain preservation|creator-check"
  "C9.2/C9.3 · composition and compact Guide|composition-check"
  "C9.6 · revision, removal and repair|revision-check"
  "C9.7 · rich example and local coordination|rich-check"
  "C9.8 · the precise Camera, its depth and one tape|precision-c9-check"
  "C9.9 · the review aid's eighteen topics|presenter-check"
  "C9 follow-up · shared Experience workflow|walkthrough-check"
  "C9 follow-up · optional task demonstrations|walkthrough-demo-check"
  "Visitor execution|visitor-check"
  "Shared shell and narrow Experience|reconciliation-check"
  "Stage S8 · full continuity between the two lenses|continuity-check"
  "Stage S7 · responsive and keyboard|responsive-check"
  "Additional source and nested correctness|correctness-check"
)

SWEEP_DIR=""
pids=()
names=()
logs=()

# A hard kill of the driver (Ctrl-C included) must not leave an axis running: these children are this
# run's own, and each one's session name carries this run's token, so nothing here can be another
# agent's browser. The buffers go with them.
sweep_cleanup() {
  local pid log
  for pid in "${pids[@]:-}"; do
    [ -n "$pid" ] || continue
    kill "$pid" 2>/dev/null || true
  done
  # A signal can reach an axis script before its own exit path does, so close this run's own sessions
  # too (the token in the name is what keeps this from touching another run's browser).
  for log in "${logs[@]:-}"; do
    [ -n "$log" ] || continue
    QA_SESSION="p26-qa-$(basename "$log" .log)-$RUN_TOKEN" agent-browser close >/dev/null 2>&1 || true
  done
  if [ -n "$SWEEP_DIR" ]; then rm -rf "$SWEEP_DIR"; fi
  return 0
}
# An INT/TERM trap that only cleaned up would leave the driver looping over a deleted buffer, so the
# interrupt exits here (130 = SIGINT, 143 = SIGTERM). The EXIT trap runs too, and both are idempotent.
trap sweep_cleanup EXIT
trap 'sweep_cleanup; exit 130' INT
trap 'sweep_cleanup; exit 143' TERM

launch_axis() { # launch_axis <display name> <script stem>
  local i="${#pids[@]}"
  QA_SESSION="p26-qa-$2-$RUN_TOKEN" QA_OUT="$QA_DIR/out/$2" bash "$QA_DIR/$2.sh" >"$SWEEP_DIR/$2.log" 2>&1 &
  pids[$i]=$!
  names[$i]="$1"
  logs[$i]="$SWEEP_DIR/$2.log"
}

# Print one finished axis' block and record its outcome. The window below is collected in launch
# order, so the transcript reads in the axis list's order however the finishes interleave.
collect_axis() { # collect_axis <index>
  local i="$1" child=0 summary state
  wait "${pids[$i]}" || child=$?
  [ "$child" -eq 0 ] || rc=1
  echo
  echo "=================================================================="
  echo "  ${names[$i]}"
  echo "=================================================================="
  cat "${logs[$i]}"
  # An axis that aborted — a missing element, a page that threw — never reaches its own summary line,
  # which is exactly the state a truncated log would otherwise hide: name it in the report.
  summary="$(grep -o 'PASS=[0-9]* FAIL=[0-9]*' "${logs[$i]}" | tail -1)"
  [ -n "$summary" ] || summary="no summary line"
  if [ "$child" -eq 0 ]; then state=ok; else state=FAILED; fi
  printf '%-7s %-16s %s\n' "$state" "$summary" "${names[$i]}" >>"$SWEEP_DIR/summary.txt"
}

sweep() {
  local jobs="${QA_JOBS:-3}" entry head=0 in_flight=0
  case "$jobs" in '' | *[!0-9]*) echo "qa: QA_JOBS='$jobs' is not a count; using 3"; jobs=3 ;; esac
  [ "$jobs" -ge 1 ] || jobs=1
  SWEEP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/qa-sweep.XXXXXX")"
  echo
  echo "qa: sweeping ${#AXES[@]} axes, $jobs at a time (its own browser session and port per axis)"
  for entry in "${AXES[@]}"; do
    launch_axis "${entry%%|*}" "${entry##*|}"
    in_flight=$((in_flight + 1))
    # Keep the window bounded: collect the oldest axis once QA_JOBS are in flight, so a failure is
    # reported as soon as it happens instead of at the end of the sweep.
    if [ "$in_flight" -ge "$jobs" ]; then
      collect_axis "$head"
      head=$((head + 1))
      in_flight=$((in_flight - 1))
    fi
  done
  while [ "$head" -lt "${#pids[@]}" ]; do
    collect_axis "$head"
    head=$((head + 1))
  done
  echo
  echo "=================================================================="
  echo "  Axis summary"
  echo "=================================================================="
  cat "$SWEEP_DIR/summary.txt"
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
  walkthrough-demo) run "C9 follow-up · optional task demonstrations" walkthrough-demo-check ;;
  experience) run "Stage S7 · Experience wiring and the visitor's isolated preview" experience-check ;;
  experience-shell) run "PR #114 · the Experience shell's composition" experience-shell-check ;;
  locator) run "PR #114 · UX1 · Preview consolidation and locator coverage" locator-check ;;
  visitor) run "Visitor execution" visitor-check ;;
  reconciliation) run "Shared shell and narrow Experience" reconciliation-check ;;
  continuity) run "Stage S8 · full continuity between the two lenses" continuity-check ;;
  responsive) run "Stage S7 · responsive and keyboard" responsive-check ;;
  correctness) run "Additional source and nested correctness" correctness-check ;;
  all) sweep ;;
  *)
    echo "qa: unknown axis '$WHICH' (journey|interaction|flows|policy|shell|precision|browse|repair|lens|locator|conformance|creator|composition|revision|rich|precision-c9|presenter|walkthrough|walkthrough-demo|experience|experience-shell|visitor|reconciliation|continuity|responsive|correctness|all)"
    exit 2
    ;;
esac

echo
if [ "$rc" -eq 0 ]; then echo "qa: all requested axes passed"; else echo "qa: FAILURES above"; fi
exit "$rc"
