#!/usr/bin/env bash
# Runs prototype journeys A–F end to end through their own scripted steps, which is the
# experience/QA authority for this direction. A visual-only change must not add history entries or
# console errors, and must not break any journey step.
#
# One step per eval: a whole-journey pass exceeds the harness eval timeout.
#
# Requires the prototype served on :8826 and agent-browser.
# Usage: journey-check.sh [label]
set -e
cd "$(dirname "$0")"
LABEL="${1:-revised}"
export AGENT_BROWSER_SESSION="p26vs-journey-$LABEL"
U="http://localhost:8826/index.html?shot=1&motion=instant"

js() { agent-browser eval "$1" | tail -1 | python3 -c 'import sys,json
s = sys.stdin.read().strip()
print(json.loads(s) if s else "")' 2>/dev/null; }

agent-browser set viewport 1440 900 >/dev/null
agent-browser open "$U" >/dev/null; sleep 2.4

MAP=$(js "JSON.stringify(__me.JOURNEYS.map(j => ({ id: j.id, name: j.name, steps: j.steps.length })))")
echo "journeys: $MAP"
echo

PASS=0; FAIL=0
while IFS=$'\t' read -r id name steps; do
  [ -z "$id" ] && continue
  for ((i = 0; i < steps; i++)); do
    RES=$(js "(async () => { try { await __me.JOURNEYS.find(j => j.id === '$id').steps[$i].run(); return 'ok'; } catch (e) { return 'ERR ' + (e && e.message ? e.message : String(e)); } })()")
    if [ "$RES" = "ok" ]; then
      echo "PASS  Journey $id · step $((i+1))/$steps · $name"
      PASS=$((PASS+1))
    else
      echo "FAIL  Journey $id · step $((i+1))/$steps · $name -- $RES"
      FAIL=$((FAIL+1))
    fi
  done
done < <(python3 -c "
import json,sys
for j in json.loads('''$MAP'''):
    print(j['id'] + '\t' + j['name'] + '\t' + str(j['steps']))
")

echo
echo "journey steps PASS=$PASS FAIL=$FAIL"

echo "== console/page errors after the full run =="
agent-browser errors | head -20
echo "errors: $(agent-browser errors | wc -l | tr -d ' ')"
