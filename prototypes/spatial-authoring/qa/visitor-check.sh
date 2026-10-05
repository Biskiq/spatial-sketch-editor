#!/usr/bin/env bash
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QA_QUERY="${QA_QUERY:-motion=instant}"
source "$QA_DIR/lib.sh"
qa_open
qa_faults_clear
agent-browser click '[data-act="lens"][data-lens="experience"]' >/dev/null
qa_frames
agent-browser click '.experience-presenter summary' >/dev/null
agent-browser click '[data-act="exp-example"]' >/dev/null
qa_frames
qa_ok 'Load Example is deterministic and never starts playback' "$(qa_js '(!__me.S.visitor && __me.ctx.experience.guide.length===2 && __me.ctx.experience.presentations[__me.S.sel].uses.length===3)')" 'true'
qa_js '__me.S.presenterSource=JSON.stringify(__me.A.domainSnapshot())' >/dev/null
# The outside-product disclosure stays open across source changes.
agent-browser click '[data-act="exp-presenter"][data-delta="1"]' >/dev/null
qa_frames
qa_ok 'Presenter Skip observes without source or playback' "$(qa_js '(!__me.S.visitor && __me.S.presenterSource===JSON.stringify(__me.A.domainSnapshot()))')" 'true'
# Author a visit-local Gate on the independent Piano offer, then exercise real visitor controls.
# The example's own offers are triggered by subjects the first Stop does not frame, so the harness
# authors one offer on the framed subject. It is authored source like any other, never a runtime hook:
# the click below goes through the real Stage pointer path, the panel is not used at all.
qa_js '(()=>{const d="definition-frame-offer",u="use-frame-offer";return __me.E.command("Framed offer fixture",e=>{e.definitions[d]={id:d,kind:"control",name:"Pulse machine",subjectId:"machine",capabilityId:"rotor",value:true};e.uses[u]={id:u,kind:"interaction",definitionId:d,presentationId:null,triggerSubjectId:"machine",start:{kind:"experience"},end:{kind:"experience"},interruption:null,availability:null,toggle:false};return u;});})()' >/dev/null
# Author the visit-local Gate on the independent Piano offer, then freeze the source the visitor must
# never write. The snapshot is taken after all fixture authoring so it measures the session, not the setup.
qa_js '(()=>{const e=__me.ctx.experience;const id=Object.values(e.uses).find(u=>u.kind==="interaction"&&u.triggerSubjectId==="piano").id;__me.E.command("Gate fixture",e=>e.stops[e.guide[0]].gate={useId:id,signal:"complete"});__me.S.visitorBefore={source:JSON.stringify(__me.A.domainSnapshot()),sel:__me.S.sel,undo:__me.S.undo.length,pose:JSON.stringify(__me.nav.plainPose())};return true;})()' >/dev/null
agent-browser click '[data-act="exp-preview"]' >/dev/null
qa_frames
agent-browser click '[data-command="start"]' >/dev/null
qa_frames
qa_ok 'visitor takeover hides authoring and fills viewport' "$(qa_js '(getComputedStyle(document.querySelector(".head")).display==="none" && document.querySelector("#gl").getBoundingClientRect().width===innerWidth && __me.S.sel===__me.S.visitorBefore.sel)')" 'true'
qa_key_dispatch ArrowRight
qa_ok 'keyboard Next obeys same Gate as disabled button' "$(qa_js '(__me.S.visitor.runtime.stopId===__me.ctx.experience.guide[0] && document.querySelector("[data-command=next]").disabled)')" 'true'
id="$(qa_jsv 'Object.values(__me.S.visitor.source.experience.uses).find(u=>u.triggerSubjectId==="switch").id')"
agent-browser click "[data-command=activate][data-id='$id']" >/dev/null
qa_frames
qa_ok 'Switch activation affects Light only in session' "$(qa_js '(__me.S.visitor.runtime.overrides.light.intensity.value===3 && __me.ctx.sceneSource.subjects.light.properties.intensity===2)')" 'true'
qa_ok 'Light intensity is realized as a visible session effect' "$(qa_js '(()=>{const m=__me.ctx.stage.items.get("light").mesh.material;return m.emissive.getHex()!==0&&m.emissiveIntensity===.75;})()')" 'true'
# C9.5 direct subject activation: a real click on a framed, used subject activates what that subject
# offers, while a drag over the same subject activates nothing. Neither goes through the DOM panel.
framed="$(qa_jsv "(()=>{const v=__me.S.visitor,e=v.source.experience,s=__me.ctx.stage,r=s.canvas.getBoundingClientRect(),u=e.uses[__me.S.visitorFrameOffer||'use-frame-offer']||Object.values(e.uses).find(x=>x.kind==='interaction');if(!u)return 'none';const p=__me.A.worldOf(u.triggerSubjectId);if(!p)return 'none';const q=s.project(p);if(q.behind)return 'none';for(let dy=-70;dy<=70;dy+=14)for(let dx=-70;dx<=70;dx+=14){const x=Math.round(r.left+q.x+dx),y=Math.round(r.top+q.y+dy);if(document.elementFromPoint(x,y)!==s.canvas)continue;const h=s.pick(x,y);if((h?.object?.userData?.id||h?.id)===u.triggerSubjectId)return u.id+' '+x+' '+y;}return 'none';})()")"
read -r offer ox oy <<< "$framed"
qa_ok 'a framed used subject offers an activatable interaction' "$( [ -n "${offer:-}" ] && [ "$offer" != none ] && echo true || echo false )" 'true'
qa_move "$ox" "$oy"; qa_down; qa_move "$((ox+90))" "$((oy+40))" ; qa_up; qa_frames
qa_ok 'a drag over that subject activates nothing and offers nothing' "$(qa_js "(!__me.S.visitor.runtime.active['$offer']&&!__me.S.visitorChoice&&!__me.ctx.sceneSource.subjects.machine.properties.running)")" 'true'
qa_move "$ox" "$oy"; qa_down; qa_up; qa_frames
qa_ok 'a real click activates the offered interaction, or opens the explicit choice' "$(qa_js "(!!__me.S.visitor.runtime.active['$offer']||(!!__me.S.visitorChoice&&__me.S.visitorChoice.offers.includes('$offer')))")" 'true'
id="$(qa_jsv 'Object.values(__me.S.visitor.source.experience.uses).find(u=>u.triggerSubjectId==="piano").id')"
agent-browser click "[data-command=activate][data-id='$id']" >/dev/null
qa_frames
qa_ok 'independent Piano playback is running' "$(qa_js '__me.S.visitor.runtime.overrides.piano.playing.value')" 'true'
qa_js '__me.E.stepVisitor(12)' >/dev/null
qa_frames
qa_ok 'caption and cue execute from same clock' "$(qa_js '(!!document.querySelector(".visitor-caption").textContent && __me.S.visitor.runtime.viewUseId!==null)')" 'true'
qa_key_dispatch ArrowRight
qa_ok 'completed visit-local Gate allows manual Next' "$(qa_js '(__me.S.visitor.runtime.stopId===__me.ctx.experience.guide[1])')" 'true'
# C9.5 deliberate visitor navigation: opening another available Presentation from a Guide parks this
# Stop with exactly one bounded return bookmark, and Return restores it without a second entry.
other="$(qa_jsv "Object.values(__me.S.visitor.source.experience.presentations).find(p=>p.id!==__me.S.visitor.runtime.presentationId).id")"
parked="$(qa_jsv '__me.S.visitor.runtime.stopId')"
agent-browser click "[data-command=open][data-id='$other']" >/dev/null
qa_frames
qa_ok 'opening another Presentation saves one bounded return instead of restarting' "$(qa_js "(__me.S.visitor.runtime.stopId===null&&__me.S.visitor.runtime.presentationId==='$other'&&__me.S.visitor.runtime.bookmarks.length===1&&__me.S.visitor.runtime.bookmarks[0].stopId==='$parked'&&!!document.querySelector('[data-command=return]'))")" 'true'
agent-browser click '[data-command="return"]' >/dev/null
qa_frames
qa_ok 'Return restores the parked Stop with no duplicate entry' "$(qa_js "(__me.S.visitor.runtime.stopId==='$parked'&&__me.S.visitor.runtime.bookmarks.length===0&&!document.querySelector('[data-command=return]'))")" 'true'
agent-browser click '[data-command="explore"]' >/dev/null
qa_frames
p="$(qa_at '#gl' 400 250)"; qa_move "${p%,*}" "${p#*,}"; qa_down; qa_move "$(( ${p%,*} + 80 ))" "${p#*,}"; qa_up; qa_frames
qa_ok 'visitor exploration never writes selection' "$(qa_js '(__me.S.visitor.runtime.exploring && __me.S.sel===__me.S.visitorBefore.sel)')" 'true'
agent-browser click '[data-command="rejoin"]' >/dev/null
qa_frames
qa_ok 'rejoin leaves Auto off' "$(qa_js '(!__me.S.visitor.runtime.autoplay && !__me.S.visitor.runtime.exploring)')" 'true'
agent-browser click '[data-act="exp-exit-preview"]' >/dev/null
qa_frames
qa_ok 'runtime freezes source/history and restores authoring' "$(qa_js '(__me.S.visitorBefore.source===JSON.stringify(__me.A.domainSnapshot()) && __me.S.visitorBefore.undo===__me.S.undo.length && __me.S.visitorBefore.sel===__me.S.sel && __me.S.visitorBefore.pose===JSON.stringify(__me.nav.plainPose()))')" 'true'
qa_faults_ok 'visitor commands'
qa_browser_errors_ok 'visitor browser'
qa_summary 'Visitor execution'
