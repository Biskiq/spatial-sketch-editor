#!/usr/bin/env bash
# Replacement proof on disposable copies; current assertions must reject the old protected defects.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/world-mutations.XXXXXX")"
trap 'rm -rf "$work"' EXIT
for kind in host camera selection; do
  python3 - "$QA_DIR/.." "$work/$kind" "$kind" <<'PY'
import pathlib, shutil, sys
src, dst, kind = sys.argv[1:]
shutil.copytree(src,dst,ignore=shutil.ignore_patterns('out','screens','review'))
p = pathlib.Path(dst)/'app/actions.js'
s = p.read_text()
if kind == 'host':
    old = '  const cur = S.session;\n  const side = opts.side || 1;'
    new = '  select(r.wall.id);\n'+old
elif kind == 'camera':
    old = "cancelProposal('lens');S.lens=which;"
    new = old+" if(which==='world'){nav.setCam(home3D());nav.releaseHold();}"
else:
    old = "cancelProposal('lens');S.lens=which;"
    new = old+" if(which==='experience')select('pres-highlights');"
assert s.count(old) == 1, 'mutation anchor moved'
p.write_text(s.replace(old,new))
PY
  axis=shell; [ "$kind" = host ] || axis=lens
  log="$work/$kind.log"
  if QA_SHOT=0 QA_SESSION="world-mutation-$kind" bash "$work/$kind/qa/$axis-check.sh" >"$log" 2>&1; then
    echo "FAIL: $axis accepted the $kind regression"; exit 1
  fi
  # Both an invariant failure and unaffected passing controls are required; a crashed harness proves nothing.
  rg '^FAIL' "$log" >/dev/null
  rg '^PASS' "$log" >/dev/null
  if rg '^FAIL.*(fault|error)' "$log"; then echo 'FAIL: mutation crashed instead of reaching assertions'; exit 1; fi
  echo "PASS: $axis rejects $kind regression, with unaffected controls green"
  rg '^FAIL|PASS=[0-9]+ FAIL=' "$log"
done
bash "$QA_DIR/conformance-mutation-check.sh"
