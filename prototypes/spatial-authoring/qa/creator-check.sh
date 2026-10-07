#!/usr/bin/env bash
# C9.1 product proof; snapshots observe only. MP1 comprehension remains a human gate.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_QUERY='motion=instant'
source "$QA_DIR/lib.sh"
qa_open
qa_faults_clear
click(){ agent-browser scrollintoview "$1" >/dev/null;agent-browser click "$1" >/dev/null;qa_frames; }
fill(){ agent-browser fill "$1" "$2" >/dev/null;qa_press Enter; }
fixture(){
 click '#experienceExamples > summary'
 click "#experienceExamples [data-act=\"$1\"]"
 click '#experienceExamples > summary'
}
# A mutation stops at the first boundary it protects, so later unrelated state cannot mask it.
checkpoint(){ if [ "${QA_CREATOR_UNTIL:-}" = "$1" ];then qa_summary "C9.1 boundary $1";exit;fi; }
# Compare complete snapshots; keep successful assertion output compact.
source_json(){ qa_js 'JSON.stringify({world:__me.qa.museum(),domains:__me.A.domainSnapshot()})'; }
independent(){ qa_js 'JSON.stringify({world:__me.qa.museum(),scene:__me.ctx.sceneSource,camera:__me.ctx.cameraSource})'; }
qa_ok(){
 if [ "$2" = "$3" ];then qa_say "PASS  $1";qa_pass=$((qa_pass+1));
 else qa_say "FAIL  $1  expected [$3] got [$2]";qa_fail=$((qa_fail+1));fi
}
pose(){ qa_js '__me.qa.realized()'; }
undo(){ qa_jsv '__me.S.undo.length'; }
# Retained Camera baseline (including shared and unreferenced Views) is deliberately non-empty.
click '#lens [data-lens="experience"]'
fixture exp-example
baseline="$(independent)";old="$(source_json)";count="$(undo)";standpoint="$(pose)"
fixture exp-reset
qa_ok 'Reset is genuinely empty and the Presenter is closed' "$(qa_js '(()=>{const e=__me.ctx.experience;return !document.querySelector("#experienceExamples").open&&e.guide.length===0&&[e.presentations,e.uses,e.stops,e.seams,e.definitions].every(x=>Object.keys(x).length===0);})()')" true
qa_ok 'Reset preserves all World/Scene/Camera truth, including shared and unreferenced artifacts' "$(independent)" "$baseline"
qa_ok 'Reset adds one aggregate Undo without wiping prior history or moving Camera' "$(undo) / $(pose)" "$((count+1)) / $standpoint"
# The low floor needs its guidance where the work is: an empty Reset must not hide the placeholder.
qa_ok 'empty Reset keeps the quickstart placeholder and its observed state truthful' "$(qa_js '(()=>{const p=document.querySelector("#experienceExamples"),step=p?.querySelector("[data-example-step]")?.textContent||"",observed=p?.querySelector("[data-example-observed]")?.textContent||"";return !p?.hidden&&step.includes("1/18")&&observed.includes("No Presentation yet");})()')" true
checkpoint reset-placeholder
click '#undoBtn'
qa_ok 'one Undo restores Experience only, at the same standpoint' "$(source_json) / $(pose)" "$old / $standpoint"
click '#redoBtn'
# A World source edit is also retained across Reset and its Undo; normal edit cuts the Redo branch.
click '#index [data-act="pres-ref"][data-id="machine"]'
click '#lens [data-lens="world"]'
fill '[data-exp-scene="casing"]' '0.2'
click '#lens [data-lens="experience"]'
# J1's eight core actions: subject, Present, explanation/accept, Capture, Operate, audition/accept, Use, Preview.
# The job's own effect on Camera is measured against the retained baseline, not a hard-coded count:
# the example fixture may legitimately carry more Views and Seam connections than it once did.
qa_js 'window.__jobViews=Object.keys(__me.ctx.cameraSource.views).length,window.__jobConns=Object.keys(__me.ctx.cameraSource.connections).length' >/dev/null
click '#index [data-act="pres-ref"][data-id="machine"]'
click '#card [data-act="exp-create"]'
fill '[data-exp-primary]' 'The casing opens to reveal the drive.'
click '#card [data-act="exp-capture"]'
click '#card .exp-focus [data-operate="machine"]'
before="$(source_json)";count="$(undo)"
fill '[data-exp-audition="casing"]' '0.6'
qa_ok 'audition realizes casing geometry without changing any source/history' "$(qa_js 'Math.abs(__me.ctx.stage.items.get("machine").capabilityParts.lid.rotation.z-.72)<.0001') / $(source_json) / $(undo)" "true / $before / $count"
click '#card [data-act="exp-use"][data-cap="casing"]'
qa_ok 'eight-action job authors one Presentation, explanation, captured View/use and Activity; no Stop/edge' "$(qa_js '(()=>{const e=__me.ctx.experience,c=__me.ctx.cameraSource,p=Object.values(e.presentations)[0],us=Object.values(e.uses),n=us.filter(u=>e.definitions[u.definitionId]?.kind==="narration"),a=us.filter(u=>e.definitions[u.definitionId]?.kind==="control");return Object.keys(e.presentations).length===1&&p.uses.length===1&&n.length===1&&n[0].primary&&a.length===1&&e.definitions[a[0].definitionId].value===.6&&Object.keys(c.views).length===window.__jobViews+1&&Object.keys(c.connections).length===window.__jobConns&&e.guide.length===0&&!document.querySelector("#experienceExamples").open&&__me.S.experienceContext.depth==="ordinary"&&__me.S.task===null;})()')" true
before="$(source_json)";count="$(undo)";standpoint="$(pose)"
context="$(qa_js '({lens:__me.S.lens,sel:__me.S.sel,context:__me.S.experienceContext,sheet:__me.S.sheet})')"
click '#headPreview'
qa_ok 'standalone Preview has private visit, actual explanation/casing and no editor writers' "$(qa_js '(!!__me.S.visitor&&__me.S.visitor.runtime.stopId===null&&document.querySelector(".visitor-caption").textContent.includes("The casing opens")&&!!__me.S.visitor.runtime.overrides.machine?.open&&__me.S.task===null&&!document.querySelector("#experienceInstrument")&&getComputedStyle(document.querySelector("#ovHtml")).display==="none")')" true
# At least one real-clock pass; no clock-stepping or source-building test API.
qa_ok 'real-clock Preview runs the visible casing effect and keeps all source/history frozen' "$(qa_js '(async()=>{await new Promise(r=>setTimeout(r,120));await __me.qa.render();return __me.S.visitor.runtime.time>0&&__me.ctx.stage.items.get("machine").capabilityParts.lid.rotation.z>.24;})()') / $(source_json) / $(undo)" "true / $before / $count"
click '[data-act="exp-exit-preview"]'
qa_ok 'Preview exit restores exact lens/identity/context/sheets, realized Camera and frozen source/history' "$(qa_js '({lens:__me.S.lens,sel:__me.S.sel,context:__me.S.experienceContext,sheet:__me.S.sheet})') / $(pose) / $(source_json) / $(undo)" "$context / $standpoint / $before / $count"
qa_ok 'exit removes audition/visitor effects and restores the authored World value' "$(qa_js '(__me.S.expAudition===null&&__me.S.visitor===null&&Math.abs(__me.ctx.stage.items.get("machine").capabilityParts.lid.rotation.z-.24)<.0001)')" true
# Update rather than duplicate, then cancel an explanation draft.
fill '[data-exp-audition="casing"]' '0.9'
click '#card [data-act="exp-use"][data-cap="casing"]'
qa_ok 're-capture updates the uniquely matching Activity, never duplicating it' "$(qa_js '(()=>{const e=__me.ctx.experience,a=Object.values(e.uses).filter(u=>e.definitions[u.definitionId]?.kind==="control");return a.length===1&&e.definitions[a[0].definitionId].value===.9;})()')" true
pid="$(qa_jsv '__me.S.experienceContext.presentation')"
click "#index [data-act=\"exp-open\"][data-id=\"$pid\"]"
before="$(source_json)";count="$(undo)"
agent-browser fill '[data-exp-primary]' 'Unaccepted replacement.' >/dev/null
qa_press Escape
qa_ok 'Escape cancels the explanation draft with zero source/history writes' "$(source_json) / $(undo) / $(qa_js 'document.querySelector("[data-exp-primary]").value')" "$before / $count / \"The casing opens to reveal the drive.\""
# Preserve the edited World, every retained View, current selection and aggregate history on Reset.
click '#index [data-act="pres-ref"][data-id="machine"]'
baseline="$(independent)";old="$(source_json)";count="$(undo)";standpoint="$(pose)"
fixture exp-reset
qa_ok 'Reset after prior World/Camera history preserves independent truth, selected subject and standpoint' "$(independent) / $(qa_js '__me.S.sel') / $(pose) / $(undo)" "$baseline / \"machine\" / $standpoint / $((count+1))"
click '#undoBtn'
qa_ok 'Undo restores only removed Experience references to the same Camera artifacts' "$(source_json) / $(pose)" "$old / $standpoint"
# Load twice never overwrites retained source; Undo unwinds each aggregate load separately.
fixture exp-example
loaded="$(source_json)";camera="$(qa_js '__me.ctx.cameraSource')";count="$(undo)";standpoint="$(pose)"
fixture exp-example
# Hoisted like the composition observation: bash 3.2 mis-parses a double-quoted qa_js argument with
# {a,b} braces when its substitution follows another word, which silently compared empty strings.
retained="$(qa_js "(()=>{const old=$camera,c=__me.ctx.cameraSource;return Object.entries(old.views).every(([id,v])=>JSON.stringify(c.views[id])===JSON.stringify(v))&&Object.entries(old.connections).every(([id,r])=>JSON.stringify(c.connections[id])===JSON.stringify(r))&&Object.keys(c.views).length===Object.keys(old.views).length+5;})()")"
qa_ok 'second load retains every pre-existing Camera artifact byte-for-byte with fresh IDs' "$retained / $(undo) / $(pose)" "true / $((count+1)) / $standpoint"
click '#undoBtn'
qa_ok 'Undo second load restores first load exactly without moving Camera' "$(source_json) / $(pose)" "$loaded / $standpoint"
click '#undoBtn'
qa_ok 'Undo first load restores independent World/Camera and prior Experience exactly' "$(source_json)" "$old"
qa_ok 'Undo invalidates replaced working context without losing the valid World selection' "$(qa_js '(__me.S.experienceContext.presentation===null&&__me.S.experienceContext.depth==="ordinary"&&__me.S.sel==="machine"&&document.querySelector("#card").textContent.includes("Use at Experience scope"))')" true
# Compact viewport: ordinary controls remain reachable through accepted sheets, no advanced depth.
agent-browser set viewport 1024 768 >/dev/null;qa_frames
click '[data-act="sheet-index"]'
click "#index [data-act=\"exp-open\"][data-id=\"$pid\"]"
click '[data-act="sheet-card"]'
qa_ok 'narrow ordinary Card reaches explanation and Capture with no Overview, lifecycle or precision work' "$(qa_js '(()=>{const el=document.querySelector("[data-exp-primary]"),r=el.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===el&&__me.S.experienceContext.depth==="ordinary"&&__me.S.task===null&&!document.querySelector("#experienceDeck");})()')" true
click '#card .exp-focus [data-operate="machine"]'
qa_ok 'narrow subject Card reaches casing audition and Use' "$(qa_js '(()=>{const els=[document.querySelector("[data-exp-audition=casing]"),document.querySelector("[data-act=exp-use][data-cap=casing]")];return els.every(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&(hit===el||el.contains(hit));});})()')" true
qa_snap c9-creator-narrow
qa_faults_ok 'creator commands'
qa_browser_errors_ok 'creator browser'
qa_summary 'C9.1 standalone creator'
