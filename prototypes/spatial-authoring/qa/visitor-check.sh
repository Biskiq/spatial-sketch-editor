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
# C9.5 availability authoring (I4): the draft offers an explicit availability with Experience-wide as
# the default, the authored use is written in one ordinary edit, and the Card's own writer switches an
# existing offer to a contextual Presentation without touching its organizational home.
agent-browser click '#index [data-act="exp-open"]' >/dev/null
qa_frames
home="$(qa_jsv '__me.S.experienceContext.presentation')"
qa_js '(()=>{const b=document.querySelector("#card [data-act=exp-offer]");if(!b)return false;const d=b.closest("details");if(d)d.open=true;return true;})()' >/dev/null
qa_frames
qa_scroll_center '#card [data-act="exp-offer"]'
agent-browser click '#card [data-act="exp-offer"]' >/dev/null
qa_frames
agent-browser select '[data-exp-offer="kind"]' interaction >/dev/null
qa_frames
qa_ok 'the offer draft exposes availability, Experience-wide and independent of its home' "$(qa_js '(()=>{const s=document.querySelector("[data-exp-offer=availability]");return !!s&&s.value===""&&s.options[0].textContent==="Experience-wide";})()')" 'true'
qa_scroll_center '#card [data-act="exp-offer-accept"]'
agent-browser click '#card [data-act="exp-offer-accept"]' >/dev/null
qa_frames
wide="$(qa_jsv 'Object.values(__me.ctx.experience.uses).filter(u=>u.kind==="interaction").at(-1).id')"
qa_ok 'a new offer is authored Experience-wide while staying homed in the edited Presentation' "$(qa_js "(()=>{const u=__me.ctx.experience.uses['$wide'];return u&&u.kind==='interaction'&&u.availability===null&&u.presentationId==='$home';})()")" 'true'
qa_ok 'the Card reads the default back as Experience-wide' "$(qa_js "document.querySelector('#card').textContent.includes('Experience-wide')")" 'true'
other="$(qa_jsv "Object.values(__me.ctx.experience.presentations).find(p=>p.id!=='$home').id")"
qa_js '(()=>{const s=document.querySelector("[data-exp-availability]");if(!s)return false;s.closest("details").open=true;return true;})()' >/dev/null
undoBefore="$(qa_jsv '__me.S.undo.length')"
agent-browser select "[data-exp-availability='$wide']" "$other" >/dev/null
qa_frames
qa_ok 'availability switches to a named Presentation as one ordinary edit' "$(qa_js "(()=>{const u=__me.ctx.experience.uses['$wide'];return u.availability==='$other'&&u.presentationId==='$home'&&__me.S.undo.length===$undoBefore+1&&__me.S.undo.at(-1).label==='Edit Activity availability';})()")" 'true'
# C9.5 Preview Experience (I3/J6): the world-only visit needs no Presentation, Stop or Guide, and the
# Experience-wide participation stays reachable from it.
agent-browser click '[data-act="lens"][data-lens="experience"]' >/dev/null
qa_frames
qa_ok 'an Experience-wide offer exposes the Experience-only Preview entry' "$(qa_js '!!document.querySelector("#index [data-act=exp-preview-experience]")')" 'true'
qa_js '__me.S.wideBefore={source:JSON.stringify(__me.A.domainSnapshot()),undo:__me.S.undo.length}' >/dev/null
agent-browser click '#index [data-act="exp-preview-experience"]' >/dev/null
qa_frames
qa_ok 'Preview Experience starts a world-only visit with no Presentation, Stop or Guide' "$(qa_js '(()=>{const r=__me.S.visitor.runtime;return !!__me.S.visitor&&r.presentationId===null&&r.stopId===null&&!r.exploring&&r.overrides&&Object.keys(r.overrides).length===0;})()')" 'true'
wideOffer="$(qa_jsv 'Object.values(__me.S.visitor.source.experience.uses).find(u=>u.kind==="interaction"&&!u.availability&&__me.ctx.sceneSource.subjects[u.triggerSubjectId])?.id')"
qa_ok 'the world-only visit offers its Experience-wide participation' "$(qa_js "(()=>{const b=[...document.querySelectorAll('[data-command=activate]')].find(x=>x.dataset.id==='$wideOffer');return !!b&&b.disabled===false;})()")" 'true'
agent-browser click "[data-command=activate][data-id='$wideOffer']" >/dev/null
qa_frames
qa_ok 'an Experience-wide offer activates inside the world-only visit' "$(qa_js "typeof __me.S.visitor.runtime.active['$wideOffer']==='string'")" 'true'
agent-browser click '[data-act="exp-exit-preview"]' >/dev/null
qa_frames
qa_ok 'the world-only visit restores authoring without writing source' "$(qa_js '(!__me.S.visitor && __me.S.wideBefore.source===JSON.stringify(__me.A.domainSnapshot()) && __me.S.wideBefore.undo===__me.S.undo.length)')" 'true'
# C9.5 opening another standalone Presentation is an ordinary departure: the visit being left ends its own
# local work under its own identity instead of leaving a narration running and its effects projected.
agent-browser click '#index [data-act="exp-open"]' >/dev/null
qa_frames
agent-browser click '[data-act="exp-preview"]' >/dev/null
qa_frames
narration="$(qa_jsv '(()=>{const v=__me.S.visitor,r=v.runtime;return (Object.values(r.activities).find(a=>a.status==="running"&&v.source.experience.definitions[v.source.experience.uses[a.useId]?.definitionId]?.kind==="narration")||{}).token||"";})()')"
other="$(qa_jsv "Object.values(__me.S.visitor.source.experience.presentations).find(p=>p.id!==__me.S.visitor.runtime.presentationId).id")"
agent-browser click "[data-command=open][data-id='$other']" >/dev/null
qa_frames
qa_ok 'opening another standalone Presentation ends the departing visit local work' "$(qa_js "(()=>{const r=__me.S.visitor.runtime;return r.presentationId==='$other'&&r.stopId===null&&(!'$narration'||r.activities['$narration'].status==='stopped');})()")" 'true'
agent-browser click '[data-act="exp-exit-preview"]' >/dev/null
qa_frames
# C9.5 choice kinds: go and detour choices are authored through the real Stop control, the visitor panel
# renders each with its own command, a go choice continues (and keeps the visited parent in Back history)
# while a detour still parks for one bounded Return, and Return preserves the parent's Stop clock.
agent-browser click '#index [data-act="exp-open"]' >/dev/null
qa_frames
guideA="$(qa_jsv '__me.ctx.experience.guide[0]')"
guideB="$(qa_jsv '__me.ctx.experience.guide[1]')"
agent-browser click "[data-act='exp-stop'][data-id='$guideA']" >/dev/null
qa_frames
qa_scroll_center "[data-exp-choice-kind='go']"
agent-browser select '[data-exp-choice-kind="go"]' "$guideB" >/dev/null
qa_frames
qa_ok 'the Stop control authors a go choice with its own kind' "$(qa_js "(()=>{const c=__me.ctx.experience.stops['$guideA'].choices.at(-1);return c&&c.kind==='go'&&c.targetId==='$guideB';})()")" 'true'
agent-browser select '[data-exp-choice-kind="detour"]' "$guideB" >/dev/null
qa_frames
qa_ok 'the Stop control still authors a detour choice' "$(qa_js "(()=>{const c=__me.ctx.experience.stops['$guideA'].choices.at(-1);return c&&c.kind==='detour'&&c.targetId==='$guideB';})()")" 'true'
agent-browser click "[data-act='exp-stop'][data-id='$guideB']" >/dev/null
qa_frames
qa_scroll_center "[data-exp-choice-kind='go']"
agent-browser select '[data-exp-choice-kind="go"]' "$guideA" >/dev/null
qa_frames
# The detour review's product observation: a detour pauses the parent Stop's running narration, so once Go
# abandons the bookmark, work whose departure policy carries it (an invocation interruption of `finish`)
# must resume on its parked playhead and keep advancing rather than stay frozen at the time it was parked.
# The policy is authored before Preview opens, because the visitor session reads a frozen source.
carriedUse="$(qa_jsv "(()=>{const e=__me.ctx.experience,pid=e.stops['$guideA'].presentationId;const u=Object.values(e.uses).find(x=>!x.viewId&&e.definitions[x.definitionId]?.kind==='narration'&&(x.start?.kind==='experience'||((x.start?.kind==='visit'||!x.start)&&(x.start?.presentationId??x.presentationId)===pid)));if(u)__me.E.command('Set departure policy',e2=>e2.uses[u.id].interruption='finish');return u?u.id:'';})()")"
qa_ok 'a narration at this Stop carries departure policy finish rather than cancel' "$(qa_js "'$carriedUse'?true:false")" 'true'
agent-browser click '[data-act="exp-preview"]' >/dev/null
qa_frames
agent-browser click '[data-command="start"]' >/dev/null
qa_frames
qa_ok 'a go choice renders its own continuation command, the detour its park command' "$(qa_js "(()=>{const g=[...document.querySelectorAll('[data-command=go]')].find(b=>b.dataset.id==='$guideB');const d=[...document.querySelectorAll('[data-command=detour]')].find(b=>b.dataset.id==='$guideB');return !!g&&!!d;})()")" 'true'
qa_js '__me.E.stepVisitor(2)' >/dev/null
qa_frames
carriedTok="$(qa_jsv "(()=>{const v=__me.S.visitor,r=v.runtime,a=Object.values(r.activities).find(a=>a.useId==='$carriedUse'&&a.status==='running');return a?a.token:'';})()")"
qa_ok 'the carried narration runs while the visitor is at the parent Stop' "$(qa_js "'$carriedTok'?true:false")" 'true'
agent-browser click "[data-command='detour'][data-id='$guideB']" >/dev/null
qa_frames
qa_ok 'a detour choice parks the parent with one bounded Return' "$(qa_js '__me.S.visitor.runtime.bookmarks.length===1&&!!document.querySelector("[data-command=return]")')" 'true'
qa_ok 'the detour suspends the carried narration rather than ending it' "$(qa_js "'$carriedTok'&&__me.S.visitor.runtime.activities['$carriedTok'].status==='paused'")" 'true'
carriedAt="$(qa_jsv "__me.S.visitor.runtime.activities['$carriedTok']?.elapsed??0")"
agent-browser click "[data-command='go'][data-id='$guideA']" >/dev/null
qa_frames
qa_ok 'a go choice continues and keeps the visited parent in Back history' "$(qa_js "(()=>{const r=__me.S.visitor.runtime;return r.stopId==='$guideA'&&r.bookmarks.length===0&&!document.querySelector('[data-command=return]')&&r.history[0]==='$guideA'&&r.history[1]==='$guideB';})()")" 'true'
qa_ok 'Go resumes the carried narration on its parked playhead' "$(qa_js "(()=>{const a=__me.S.visitor.runtime.activities['$carriedTok'];return !!a&&a.status==='running'&&a.elapsed>=$carriedAt&&a.elapsed<$carriedAt+1;})()")" 'true'
qa_js '__me.E.stepVisitor(3)' >/dev/null
qa_frames
qa_ok 'and the resumed narration advances instead of staying frozen at its parked time' "$(qa_js "(()=>{const a=__me.S.visitor.runtime.activities['$carriedTok'];return !!a&&a.elapsed>$carriedAt;})()")" 'true'
agent-browser click '[data-command="back"]' >/dev/null
qa_frames
qa_ok 'Back reaches the detour stop first' "$(qa_js "__me.S.visitor.runtime.stopId==='$guideB'")" 'true'
agent-browser click '[data-command="back"]' >/dev/null
qa_frames
qa_ok 'and a second Back reaches the abandoned parent' "$(qa_js "__me.S.visitor.runtime.stopId==='$guideA'")" 'true'
qa_js '__me.E.stepVisitor(12)' >/dev/null
qa_frames
agent-browser click "[data-command='detour'][data-id='$guideB']" >/dev/null
qa_frames
agent-browser click '[data-command="return"]' >/dev/null
qa_frames
qa_ok 'Return preserves the parent Stop clock and rebases the remaining-work deadline' "$(qa_js "(()=>{const r=__me.S.visitor.runtime;return r.stopId==='$guideA'&&r.elapsed>1&&r.readiness<r.elapsed;})()")" 'true'
agent-browser click '[data-act="exp-exit-preview"]' >/dev/null
qa_frames
qa_faults_ok 'visitor commands'
qa_browser_errors_ok 'visitor browser'
qa_summary 'Visitor execution'
