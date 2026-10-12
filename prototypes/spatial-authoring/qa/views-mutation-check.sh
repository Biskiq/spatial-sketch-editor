#!/usr/bin/env bash
# UX2 replacement proof. Each regression the Presentation/Views slice retired or introduced is
# reintroduced in a disposable copy, and the assertion that protects it must reject the copy while
# unaffected controls stay green — a crashed harness or an empty observation proves nothing.
#
# The two laws behind these legs are §3.8's aggregate Present (one Undo step that really writes the
# Presentation, its first View use as the Default and the Camera View it reads; a Plan reading asks
# before it creates anything, and each door authors the reading its own name promises) and §3.10's
# bounded local unlink (one step, no replacement Default, the Camera truth kept). The image pass's own
# laws — bounded, neutral, keyed on the World it was drawn from and fogged for its own projection — are
# protected through the shell axis, which owns that interaction.
#
# Usage: qa/views-mutation-check.sh [leg ...]   (default: every leg)
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/ux2-mutations.XXXXXX")"
trap 'rm -rf "$work"' EXIT
for kind in ${@:-present-no-use present-choice plan-silent remove-two-steps default-without-ask second-presenter plan-pose view-metric image-world image-fog image-paper image-cam}; do
  python3 - "$QA_DIR/.." "$work/$kind" "$kind" <<'PY'
import pathlib, shutil, sys
src, dst, kind = sys.argv[1:]
shutil.copytree(src, dst, ignore=shutil.ignore_patterns('out', 'screens', 'review'))

def replace(file, old, new):
    p = pathlib.Path(dst) / 'app' / file
    s = p.read_text()
    assert s.count(old) == 1, (kind, file, 'mutation anchor moved', s.count(old))
    p.write_text(s.replace(old, new))

if kind == 'present-no-use':
    # Aggregate Present writes the Presentation but forgets the Default View use it reads.
    replace('experience.js', "    addView(e, c, id, authored, name, 'entry');\n", '')
elif kind == 'present-choice':
    # The View it writes is not the Default: every use of the Presentation would be a visitor choice.
    replace('experience.js', "    addView(e, c, id, authored, name, 'entry');",
            "    addView(e, c, id, authored, name, 'choice');")
elif kind == 'plan-silent':
    # Presenting from a Plan reading captures the plan without asking how the visitor should meet it.
    replace('experience.js', '  if (planReading() && !S.expPlanAsk) {', '  if (false && planReading() && !S.expPlanAsk) {')
elif kind == 'remove-two-steps':
    # Unlinking one use takes two history steps, so one Undo no longer restores the Presentation whole.
    # The second step has to write something the shared history really records: a command whose edit
    # changes no source is not a step at all, and would prove nothing either way.
    replace('experience.js', "  const result = command('Remove View from Presentation', e => removeContribution(e, useId));",
            "  const result = command('Remove View from Presentation', e => removeContribution(e, useId));\n  if (result) command('Record the unlink', e => { const p = e.presentations[home]; if (p) p.meaning = 'Unlinked'; });")
elif kind == 'default-without-ask':
    # Set as Default writes straight to source, bypassing the shared-use Ask every Stop entry discloses.
    replace('experience.js', "  return changeRole(useId, 'entry');",
            "  return command('Set as Default', (e) => { e.uses[useId].role = 'entry'; });")
elif kind == 'second-presenter':
    # The retired `Present region` row, restored in the Index beside the one aggregate `+ Present`.
    replace('experience-ui.js',
            """+ `<div class=\"ix-row\"><button class=\"ix-go\" data-act=\"exp-create\">+ Present""",
            """+ `<div class=\"ix-row\"><button class=\"ix-go\" data-act=\"exp-region\">Present region</button></div>`
  + `<div class=\"ix-row\"><button class=\"ix-go\" data-act=\"exp-create\">+ Present""")
elif kind == 'plan-pose':
    # The recommended framing is preferred over the reading the author actually chose, so choosing `Use the
    # plan as the visitor View` still saves the recommended 3D framing of the same subject. Both halves of
    # the fix are undone: the derivation is asked for even when a pose was supplied, and that derivation
    # then wins the precedence.
    replace('experience.js', '  const derived = recommended && !pose ? nav.deriveFraming({ focus: f }) : null;',
            '  const derived = nav.deriveFraming({ focus: f });')
    replace('experience.js', '  const authored = pose || derived?.pose || live;',
            '  const authored = derived?.pose || pose || live;')
elif kind == 'image-world':
    # The picture is keyed on the museum's object identity alone, so a World write that mutates the museum
    # in place leaves the View serving a picture of the World before the write.
    replace('experience-scene.js', '  const epoch = S.sourceEpoch ?? 0;', '  const epoch = 0;')
elif kind == 'image-fog':
    # The thumbnail's fog is read from the live camera's distance, so a picture drawn from another View's
    # standpoint is fogged for the standpoint the author is standing at.
    replace('stage.js', '      this.scene.fog.near = previewDist + 40;\n      this.scene.fog.far = previewDist + 200;',
            '      this.scene.fog.near = this.dist + 40;\n      this.scene.fog.far = this.dist + 200;')
elif kind == 'view-metric':
    # The constellation claims a metric location again: each View's glyph is drawn at its projected
    # standpoint, joined to the compressed marker by a leader, with the origin square beside it. This is
    # the reviewed defect — a screen length drawn between a metric position and a schematic one.
    replace('experience-draw.js',
            "  ov().path('view-glyph-'+item.id,[apex,a,b],'exp-view-glyph',true,{'data-view-direction':item.view.id});",
            "  const metricAt=project(observer);\n"
            "  if(!metricAt.behind&&Math.hypot(metricAt.x-at.x,metricAt.y-at.y)>5)ov().line('leader-'+item.id,metricAt,at,'exp-leader');\n"
            "  const mA={x:metricAt.x+Math.cos(aimAngle-.5)*20,y:metricAt.y+Math.sin(aimAngle-.5)*20},mB={x:metricAt.x+Math.cos(aimAngle+.5)*20,y:metricAt.y+Math.sin(aimAngle+.5)*20};\n"
            "  ov().path('view-glyph-'+item.id,[metricAt,mA,mB],'exp-view-glyph',true,{'data-view-direction':item.view.id});\n"
            "  ov().path('view-origin-'+item.id,[{x:metricAt.x-3,y:metricAt.y-3},{x:metricAt.x+3,y:metricAt.y-3},{x:metricAt.x+3,y:metricAt.y+3},{x:metricAt.x-3,y:metricAt.y+3}],'exp-view-origin',true);\n")
elif kind == 'image-paper':
    # The derivative image is drawn with the authoring treatment — selection highlight, ghost, drafting
    # aids — instead of the normal-World reading a visitor would see. Six spaces of indent: this is the
    # derivative image's own projection, not the constructor's default.
    replace('stage.js', '      this.authoring = false;\n', '      this.authoring = true;\n')
else:
    # The image pass never gives the live camera back, so a derivative reading moves the author's view.
    replace('stage.js', '      this.cam = saved.cam;\n', '')
PY
  case "$kind" in
    present-no-use) axis=conformance; expected='Present this is one aggregate command' ;;
    present-choice) axis=conformance; expected='Present this is one aggregate command' ;;
    plan-silent) axis=conformance; expected='Presenting from a Plan reading offers the intent choice' ;;
    remove-two-steps) axis=conformance; expected='Remove from Presentation unlinks one use in one history step' ;;
    default-without-ask) axis=conformance; expected='shared Set role change asks before' ;;
    second-presenter) axis=conformance; expected='exactly one creation entry' ;;
    plan-pose) axis=conformance; expected='Use the plan as the visitor View authors the plan reading itself' ;;
    image-world) axis=experience-shell; expected='an accepted World write moves the generation' ;;
    image-fog) axis=experience-shell; expected='the picture is fogged at its own eye distance' ;;
    view-metric) axis=conformance; expected='the constellation makes no metric claim' ;;
    image-paper) axis=experience-shell; expected='one idle turn drew the picture once' ;;
    image-cam) axis=experience-shell; expected='the pass wrote nothing' ;;
  esac
  log="$work/$kind.log"
  if QA_SHOT=0 QA_SESSION="ux2-mutation-$kind-$$" bash "$work/$kind/qa/$axis-check.sh" >"$log" 2>&1; then
    echo "FAIL: $axis accepted the $kind regression"
    exit 1
  fi
  # The protected assertion itself, plus unaffected controls still passing, and no crash in place of one.
  rg "^FAIL.*($expected)" "$log" >/dev/null || { cat "$log"; echo "FAIL: $kind did not reach its protected boundary"; exit 1; }
  rg '^PASS' "$log" >/dev/null
  # A regression that makes the harness itself crash proves nothing: the named assertion must have run.
  # The word boundaries matter here — one protected boundary is named `…a Presentation, one Default View
  # use…`, and a loose `fault` would match the `fault` inside `Default`.
  if rg '^FAIL.*(\bfaults?\b|error|empty observation)' "$log"; then echo 'FAIL: mutation crashed or lost observations'; exit 1; fi
  echo "PASS: $axis rejects $kind regression, with unaffected controls green"
  rg '^FAIL|PASS=[0-9]+ FAIL=' "$log"
done
