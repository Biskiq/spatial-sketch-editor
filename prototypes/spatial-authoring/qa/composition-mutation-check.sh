#!/usr/bin/env bash
# C9.2/C9.3 successor proof: each named regression is reintroduced in a disposable copy and the
# assertion that protects it must reject the copy while unaffected controls stay green. The kinds
# mirror the authoring plan's targeted obligations: organization-as-start, hold cue leakage and
# entry-plus-station double invoke in the model/runtime; empty Reset hidden placeholder (C9.1),
# silent first-offer choice and Peek forcing L2 in the wiring.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/c9-mutations.XXXXXX")"
trap 'rm -rf "$work"' EXIT

# ------------------------------------------------- pure model/runtime obligations
# The protected test must be the one that fails, and a named neighbour must stay green: a suite
# that broke wholesale or crashed on import would prove nothing about the assertion.
for kind in organization hold-cue double-invoke; do
  python3 - "$QA_DIR/.." "$work/pure-$kind" "$kind" <<'PY'
import pathlib, shutil, sys
src, dst, kind = sys.argv[1:]
shutil.copytree(pathlib.Path(src) / 'app', pathlib.Path(dst) / 'app')
shutil.copytree(pathlib.Path(src) / 'tests', pathlib.Path(dst) / 'tests')
def replace(rel, old, new):
    p = pathlib.Path(dst) / rel
    s = p.read_text()
    assert s.count(old) == 1, (kind, rel, 'mutation anchor moved', s.count(old))
    p.write_text(s.replace(old, new))
if kind == 'organization':
    # Organizational home silently becomes the activation authority.
    replace('app/experience-runtime.js',
            "if(u.viewId||u.kind==='interaction'||u.start.kind==='station'||activationScope(u)!==pid)return false;",
            "if(u.viewId||u.kind==='interaction'||u.start.kind==='station'||(u.presentationId??activationScope(u))!==pid)return false;")
elif kind == 'hold-cue':
    # Keeping the viewpoint no longer suppresses automatic Camera cues.
    replace('app/experience-runtime.js',
            "if(a.visit!==r.visit||r.exploring||r.viewingSuppressed)return;",
            "if(a.visit!==r.visit||r.exploring)return;")
else:
    # A station invocation re-fires on every tick instead of running once.
    replace('app/experience-runtime.js',
            "if(!invocation.fired&&m.elapsed>=invocation.at){invocation.fired=true;",
            "if(!invocation.fired&&m.elapsed>=invocation.at){")
PY
  case "$kind" in
    organization) name='organization is independent of explicit activation and boundary'; control='Finish after local departure' ;;
    hold-cue) name='hold suppresses entry and all automatic cues'; control='explicit marker seconds survive' ;;
    double-invoke) name='station-bound holds delay arrival; invoked controls run once at Camera station'; control='multi-origin coordination executes only the traversed connection' ;;
  esac
  log="$work/pure-$kind.log"
  if node --test "$work/pure-$kind/tests/experience-composition.test.mjs" "$work/pure-$kind/tests/experience-runtime.test.mjs" >"$log" 2>&1; then
    echo "FAIL: model/runtime accepted the $kind regression"
    exit 1
  fi
  if ! rg '^✖' "$log" | rg -F "$name" >/dev/null; then
    cat "$log"
    echo "FAIL: $kind did not reach its protected test [$name]"
    exit 1
  fi
  if ! rg '^✔' "$log" | rg -F "$control" >/dev/null; then
    cat "$log"
    echo "FAIL: $kind lost its unaffected green control [$control]"
    exit 1
  fi
  echo "PASS: model/runtime rejects $kind; unrelated control stays green"
  rg '^✖|ℹ (pass|fail)' "$log" | head -8
done

# ------------------------------------------------- browser wiring obligations
for kind in reset-placeholder first-offer peek-l2; do
  python3 - "$QA_DIR/.." "$work/$kind" "$kind" <<'PY'
import pathlib, shutil, sys
src, dst, kind = sys.argv[1:]
shutil.copytree(src, dst, ignore=shutil.ignore_patterns('out', 'screens', 'review'))
def replace(rel, old, new):
    p = pathlib.Path(dst) / rel
    s = p.read_text()
    assert s.count(old) == 1, (kind, rel, 'mutation anchor moved', s.count(old))
    p.write_text(s.replace(old, new))
if kind == 'reset-placeholder':
    # The quickstart placeholder goes blank exactly when the Experience is empty.
    replace('app/experience-ui.js',
            "if(instruction)instruction.textContent=steps[i].instruction;",
            "if(instruction)instruction.textContent=Object.values(ctx.experience.presentations).length?steps[i].instruction:'';")
    replace('app/experience-ui.js',
            "observed.textContent=`Observed · ${steps[i].observed()}${done?' · outcome seen':''}`;",
            "observed.textContent=Object.values(ctx.experience.presentations).length?`Observed · ${steps[i].observed()}${done?' · outcome seen':''}`:'';")
elif kind == 'first-offer':
    # Visitor View offers silently collapse to the first eligible one.
    replace('app/experience-ui.js',
            "eligibleViews(e,r.presentationId).map(id=>visitorButton('look'",
            "eligibleViews(e,r.presentationId).slice(0,1).map(id=>visitorButton('look'")
else:
    # Peek (awareness) forces the explicit L2 occurrence disclosure.
    replace('app/experience.js',
            "cancelProposal('selection');A.select(id);",
            "cancelProposal('selection');A.select(id);S.experienceContext.depth='occurrence';")
PY
  case "$kind" in
    reset-placeholder)
      axis=creator; boundary='QA_CREATOR_UNTIL=reset-placeholder'
      expected='empty Reset keeps the quickstart placeholder'; control='Reset adds one aggregate Undo' ;;
    first-offer)
      axis=composition; boundary='QA_COMPOSITION_UNTIL=offers'
      expected='visitor offers entry and all three Views'; control='two Presentations create exactly two Stops' ;;
    peek-l2)
      axis=composition; boundary='QA_COMPOSITION_UNTIL=peek'
      expected='Peek selects the Stop'; control='two Presentations create exactly two Stops' ;;
  esac
  log="$work/$kind.log"
  if QA_SHOT=0 QA_SESSION="c9-mutation-$kind" env "$boundary" bash "$work/$kind/qa/$axis-check.sh" >"$log" 2>&1; then
    echo "FAIL: $axis accepted the $kind regression"
    exit 1
  fi
  # A reached failed boundary plus a named unaffected green control, never a crash.
  if ! rg '^FAIL' "$log" | rg -F "$expected" >/dev/null; then
    cat "$log"
    echo "FAIL: $kind did not reach its protected assertion [$expected]"
    exit 1
  fi
  if ! rg '^PASS' "$log" | rg -F "$control" >/dev/null; then
    cat "$log"
    echo "FAIL: $kind lost its unaffected green control [$control]"
    exit 1
  fi
  if rg '^FAIL.*(fault|error|empty observation)' "$log"; then
    echo "FAIL: $kind crashed or lost observations"
    exit 1
  fi
  echo "PASS: $axis rejects $kind regression; unaffected control stays green"
  rg '^FAIL|PASS=[0-9]+ FAIL=' "$log"
done
