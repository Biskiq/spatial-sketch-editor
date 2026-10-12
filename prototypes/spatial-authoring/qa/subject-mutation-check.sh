#!/usr/bin/env bash
# UX3 replacement proof (Scene subject, plan §3.7 and §3.9 QA 5). Each regression this slice retired is
# reintroduced in a disposable copy, and the assertion that protects it must reject the copy while
# unaffected controls stay green — a crashed harness or an empty observation proves nothing.
#
# The laws behind these legs: a Scene subject's Card carries no capability control at rest; its own door
# opens a chooser over the descriptors the provider already declares and operates nothing by opening; the
# invoked operation is what puts the UX2 audition and capture writers on screen; the derived
# `Used in Experience` reach is read-only and marks no Presentation as the selection; and the declared
# descriptors are the only ones offered, so a capability this Stage does not realize is never invocable.
#
# Usage: qa/subject-mutation-check.sh [leg ...]   (default: every leg)
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/ux3-mutations.XXXXXX")"
trap 'rm -rf "$work"' EXIT
for kind in ${@:-rest-controls door-direct door-writes derived-selected order unrealized-offered}; do
  python3 - "$QA_DIR/.." "$work/$kind" "$kind" <<'PY'
import pathlib, shutil, sys
src, dst, kind = sys.argv[1:]
shutil.copytree(src, dst, ignore=shutil.ignore_patterns('out', 'screens', 'review'))

def replace(file, old, new):
    p = pathlib.Path(dst) / 'app' / file
    s = p.read_text()
    assert s.count(old) == 1, (kind, file, 'mutation anchor moved', s.count(old))
    p.write_text(s.replace(old, new))

if kind == 'rest-controls':
    # A capability control is on screen at rest: the first declared descriptor is rendered before anything
    # invoked it, so the Card is an operator again without the author asking for one.
    replace('experience-ui.js',
            " const invoked=S.expInvoked?.subject===s.id?caps.find(c=>c.id===S.expInvoked.capability):null;",
            " const invoked=caps.find(c=>c.id===(S.expInvoked?.subject===s.id?S.expInvoked.capability:null))||caps[0];")
elif kind == 'door-direct':
    # `+ Add behavior` skips the chooser and invokes the first declared descriptor itself, so the door
    # decides what the author works on and no chooser is ever offered.
    replace('experience.js',
            "  S.expChoose={subject:sid,door:'behavior'};ctx.ui();return true;",
            "  return invokeCapability(sid,capabilities(ctx.sceneSource,sid).find(isRealized)?.id);")
elif kind == 'door-writes':
    # Opening the door authors work: the declared capability is captured as an Activity on the way in, so
    # reading what a subject declares writes source and history.
    replace('experience.js',
            "  S.expChoose={subject:sid,door:'behavior'};ctx.ui();return true;",
            "  useCapability(sid,capabilities(ctx.sceneSource,sid).find(isRealized)?.id);\n  S.expChoose={subject:sid,door:'behavior'};ctx.ui();return true;")
elif kind == 'derived-selected':
    # The derived reach marks the Presentation it names as the current selection: a reference row that
    # looks like an editor row.
    replace('experience-ui.js',
            'const row=(kind,id,act,label,note)=>`<div class="exp-used" data-exp-used="${kind}"',
            'const row=(kind,id,act,label,note)=>`<div class="exp-used${kind===\'presentation\'?\' selected\':\'\'}" data-exp-used="${kind}"')
elif kind == 'order':
    # The derived reach is promoted above `Present this`, so the Card no longer reads in the order QA 5
    # fixes (identity → Present this → Used in Experience → the two doors).
    replace('experience-ui.js',
            '  +usedInExperienceHtml(s)\n  +subjectWorkHtml(s,caps)',
            '  +subjectWorkHtml(s,caps)\n  +usedInExperienceHtml(s)')
else:
    # The chooser offers a descriptor this Stage does not realize, so a capability that cannot run here is
    # authorable as if it could.
    replace('experience-ui.js',
            "caps.map(cap=>{\n  const unreal=cap.realized===false;\n  return `<div class=\"exp-cap\" data-exp-choice=",
            "caps.map(cap=>{\n  const unreal=false;\n  return `<div class=\"exp-cap\" data-exp-choice=")
PY
  case "$kind" in
    rest-controls) axis=conformance; expected='no capability control is at rest on a Scene subject Card' ;;
    door-direct) axis=conformance; expected='the behavior door opens a chooser over the declared descriptors' ;;
    door-writes) axis=conformance; expected='Cancel closes the chooser, leaving nothing operated and nothing written' ;;
    derived-selected) axis=conformance; expected='no Presentation looks selected while a Scene subject is' ;;
    order) axis=conformance; expected='a Scene subject Card is ordered identity' ;;
    unrealized-offered) axis=revision; expected='the unrealized Annotate is reported in the chooser' ;;
  esac
  log="$work/$kind.log"
  if QA_SHOT=0 QA_SESSION="ux3-mutation-$kind-$$" bash "$work/$kind/qa/$axis-check.sh" >"$log" 2>&1; then
    echo "FAIL: $axis accepted the $kind regression"
    exit 1
  fi
  # The protected assertion itself, plus unaffected controls still passing, and no crash in place of one.
  rg "^FAIL.*($expected)" "$log" >/dev/null || { cat "$log"; echo "FAIL: $kind did not reach its protected boundary"; exit 1; }
  rg '^PASS' "$log" >/dev/null
  if rg '^FAIL.*(\bfaults?\b|error|empty observation)' "$log"; then echo 'FAIL: mutation crashed or lost observations'; exit 1; fi
  echo "PASS: $axis rejects $kind regression, with unaffected controls green"
  rg '^FAIL|PASS=[0-9]+ FAIL=' "$log"
done
