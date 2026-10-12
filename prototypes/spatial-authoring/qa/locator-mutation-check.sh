#!/usr/bin/env bash
# UX1 replacement proof. Each regression the locator/Preview consolidation retired is reintroduced in a
# disposable copy, and the assertion that protects it must reject the copy while unaffected controls stay
# green — a crashed harness or an empty observation proves nothing.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/ux1-mutations.XXXXXX")"
trap 'rm -rf "$work"' EXIT
for kind in second-entry scene-list no-scene-subjects register-borrowed always-offered; do
  python3 - "$QA_DIR/.." "$work/$kind" "$kind" <<'PY'
import pathlib, shutil, sys
src, dst, kind = sys.argv[1:]
shutil.copytree(src, dst, ignore=shutil.ignore_patterns('out', 'screens', 'review'))

def replace(file, old, new, root='app'):
    p = pathlib.Path(dst) / root / file
    s = p.read_text()
    assert s.count(old) == 1, (kind, file, 'mutation anchor moved', s.count(old))
    p.write_text(s.replace(old, new))

if kind == 'second-entry':
    # A second Preview entry, back in the Index, beside the one menu in the Head.
    replace('experience-ui.js',
            """+ `<div class="ix-row"><button class="ix-go" data-act="find-world">Browse World<span class="ix-note">""",
            """+ button('exp-preview-guide', 'Preview Guide')
  + `<div class="ix-row"><button class="ix-go" data-act="find-world">Browse World<span class="ix-note">""")
elif kind == 'scene-list':
    # The retired Scene-subject list, restored as its own column of Select buttons.
    replace('experience-ui.js',
            """+ `<div class="ix-row"><button class="ix-go" data-act="find-world">Browse World<span class="ix-note">""",
            """+ `<div class="ix-group">Scene subjects</div>${Object.values(ctx.sceneSource.subjects).map((s) => `<div class="ix-row"><button class="ix-go" data-act="pres-ref" data-id="${s.id}">${esc(s.name)}</button></div>`).join('')}`
  + `<div class="ix-row"><button class="ix-go" data-act="find-world">Browse World<span class="ix-note">""")
elif kind == 'no-scene-subjects':
    # The locator stops listing the Scene's own subjects.
    replace('ui.js', 'for (const s of Object.values(ctx.sceneSource?.subjects || {})) {', 'for (const s of []) {')
elif kind == 'register-borrowed':
    # A record without Stage geometry is no longer marked as a register record, so the register empties.
    replace('fixtures.js', 'for (const r of METADATA) out.push({ ...r, geom: false, register: true });',
            'for (const r of METADATA) out.push({ ...r, geom: false });')
else:
    # The one control stops being conditioned on what can start: it is offered even when it cannot act.
    replace('ui.js', 'menu.hidden = !list.length;', 'menu.hidden = false;')
PY
  case "$kind" in
    second-entry) axis=experience-shell; expected='exactly one Preview control' ;;
    scene-list) axis=locator; expected='no longer lists Scene subjects' ;;
    no-scene-subjects) axis=locator; expected='reachable by pointer through the locator' ;;
    register-borrowed) axis=locator; expected='the register lists records only' ;;
    always-offered) axis=locator; expected='absent rather than inert' ;;
  esac
  log="$work/$kind.log"
  if QA_SHOT=0 QA_SESSION="ux1-mutation-$kind-$$" bash "$work/$kind/qa/$axis-check.sh" >"$log" 2>&1; then
    echo "FAIL: $axis accepted the $kind regression"
    exit 1
  fi
  # The protected assertion itself, plus unaffected controls still passing, and no crash in place of one.
  rg "^FAIL.*($expected)" "$log" >/dev/null || { cat "$log"; echo "FAIL: $kind did not reach its protected boundary"; exit 1; }
  rg '^PASS' "$log" >/dev/null
  if rg '^FAIL.*(fault|error|empty observation)' "$log"; then echo 'FAIL: mutation crashed or lost observations'; exit 1; fi
  echo "PASS: $axis rejects $kind regression, with unaffected controls green"
  rg '^FAIL|PASS=[0-9]+ FAIL=' "$log"
done
