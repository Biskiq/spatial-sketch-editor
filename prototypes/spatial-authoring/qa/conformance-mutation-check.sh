#!/usr/bin/env bash
# Same-defect successor proof. Every mutation is confined to a disposable executable copy.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/experience-mutations.XXXXXX")"
trap 'rm -rf "$work"' EXIT
for kind in evaluator parked shared endpoints pins stations preview;do
  python3 - "$QA_DIR/.." "$work/$kind" "$kind" <<'PY'
import pathlib, shutil, sys
src,dst,kind=sys.argv[1:]
shutil.copytree(src,dst,ignore=shutil.ignore_patterns('out','screens','review'))
def replace(file,old,new):
    p=pathlib.Path(dst)/'app'/file;s=p.read_text()
    assert s.count(old)==1,(kind,file,'mutation anchor moved',s.count(old))
    p.write_text(s.replace(old,new))
if kind=='evaluator':
    replace('experience-draw.js','geometry.samples.map(s=>project(s.observer))','geometry.samples.map(s=>project(s.pose.target))')
elif kind=='parked':
    replace('experience.js'," cancelProposal('lens');T.park();nav.discardReturn();", " if(S.parkedByLens.experience)S.parkedByLens.experience.obsoletePose=nav.plainPose();\n cancelProposal('lens');T.park();nav.discardReturn();")
    replace('experience.js'," cancelProposal('resume');await nav.neutralInvocation("," cancelProposal('resume');nav.releaseHold();nav.applyPose(p.obsoletePose);await nav.neutralInvocation(")
elif kind=='shared':
    replace('experience.js',' if(affected.length<=1)return acceptSource();'," if(affected.length<=1||kind==='presentation')return acceptSource();")
elif kind=='endpoints':
    replace('experience-draw.js',"layout(items).forEach(item=>{marker(item,{end:item.end||'origin'});", "layout(items).forEach(item=>{")
    replace('experience-draw.js','for(const a of route.anchors){','for(const a of []){')
elif kind=='pins':
    replace('experience-draw.js','if(number!==null){ov().chip(', 'if(number!==null){at.x=120;at.y=150;ov().chip(')
elif kind=='stations':
    replace('experience-ui.js','data-station-counterpart="${s.id}"','data-missing-counterpart="${s.id}"')
else:
    replace('experience.js'," nav.applyPose(S.visitor.runtime.pose);ctx.ui();return true;", " S.task=structuredClone(token.inspection.task);nav.applyPose(S.visitor.runtime.pose);ctx.ui();return true;")
    replace('experience-ui.js','const html=visitorHtml();', '''const html=visitorHtml()+(S.task?.kind==='experience-camera'?`<input data-exp-camera="leaked" aria-label="Leaked authoring input">`:'');''')
PY
  case "$kind" in
    evaluator|endpoints) boundary=route;expected='Stage route samples|QA-4 actual Plan' ;;
    parked) boundary=resume;expected='Resume|resumes|resumed|coordination Resume' ;;
    shared) boundary=shared;expected='shared Meaning asks' ;;
    pins) boundary=overview;expected='QA-2 six distinct reachable pins' ;;
    stations) boundary=coordination;expected='QA-5 station projections mirror' ;;
    preview) boundary=preview;expected='Preview rig and input removed' ;;
  esac
  log="$work/$kind.log"
  if QA_SHOT=0 QA_SESSION="v2-mutation-$kind" QA_CONFORMANCE_UNTIL="$boundary" bash "$work/$kind/qa/conformance-check.sh" >"$log" 2>&1;then
    echo "FAIL: successor accepted $kind regression";exit 1
  fi
  # A reached failed boundary plus unaffected green controls, never a crash or empty observation.
  rg "^FAIL.*($expected)" "$log" >/dev/null || { cat "$log";echo "FAIL: $kind did not reach its protected boundary";exit 1; }
  rg '^PASS.*Auto is derived intent' "$log" >/dev/null
  if rg '^FAIL.*(fault|error|empty observation)' "$log";then echo 'FAIL: mutation crashed or lost observations';exit 1;fi
  echo "PASS: conformance rejects $kind regression; unrelated derived-intent control stays green"
  rg '^FAIL|PASS=[0-9]+ FAIL=' "$log"
done
