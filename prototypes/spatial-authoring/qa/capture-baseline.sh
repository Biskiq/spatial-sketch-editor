#!/usr/bin/env bash
# Record the baseline the World Authoring Prototype must keep: the fixture's source values and
# their digest, the A–F step inventory, and one checkpoint per presenter step (reading, canonical
# selection, reading/session parameters, Undo depth, Reveal, crumbs, standpoint).
#
# The checkpoints are the regression oracle for journey-check.sh. Regenerating this file is a
# deliberate act: it means the accepted baseline changed, not that a run was inconvenient.
#
# Usage: qa/capture-baseline.sh [output.json]      (default: qa/baseline.json)
set -u
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$QA_DIR/lib.sh"

OUT="${1:-$QA_DIR/baseline.json}"

qa_open
qa_say "qa: capturing baseline from $QA_BASE"

MAP="$(qa_js 'window.__me.JOURNEYS.map(j => ({ id: j.id, name: j.name, steps: j.steps.length }))')"
FIXTURE="$(qa_js 'window.__me.qa.museum()')"
HASH="$(qa_jsv 'window.__me.qa.hash()')"

python3 - "$OUT" "$FIXTURE" "$HASH" "$MAP" <<'PY'
import json, sys, subprocess, os
out, fixture, digest, journey_map = sys.argv[1], json.loads(sys.argv[2]), sys.argv[3], json.loads(sys.argv[4])
base = {"fixtureHash": digest, "fixture": fixture, "journeys": journey_map, "checkpoints": {}}
with open(out, "w", encoding="utf-8") as fh:
    json.dump(base, fh, indent=1, sort_keys=True)
    fh.write("\n")
print(f"baseline: {len(journey_map)} journeys, fixture hash {digest}")
PY

COUNTS="$(qa_jsv 'window.__me.JOURNEYS.map(j => j.id + "=" + j.steps.length).join(" ")')"
qa_say "qa: journeys $COUNTS"

for pair in $COUNTS; do
  id="${pair%%=*}"
  n="${pair##*=}"
  i=0
  while [ "$i" -lt "$n" ]; do
    STATE="$(qa_js "(async () => { const j = window.__me.JOURNEYS.find(x => x.id === \"$id\"); await j.steps[$i].run(); await window.__me.qa.idle(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return window.__me.qa.state(); })()")"
    python3 - "$OUT" "$id$((i + 1))" "$STATE" <<'PY'
import json, sys
out, case, state = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
with open(out, "r", encoding="utf-8") as fh:
    base = json.load(fh)
state = {k: v for k, v in state.items() if k not in ("faults",)}
base["checkpoints"][case] = state
with open(out, "w", encoding="utf-8") as fh:
    json.dump(base, fh, indent=1, sort_keys=True)
    fh.write("\n")
print(f"  {case}  {state['view']}  sel={state['sel']}  undo={state['undo']}")
PY
    i=$((i + 1))
  done
done

qa_say "qa: wrote $OUT"
