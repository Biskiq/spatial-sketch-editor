#!/usr/bin/env bash
# C9.2/C9.3 successor proof: each named regression is reintroduced in a disposable copy and the
# assertion that protects it must reject the copy while unaffected controls stay green. The kinds
# mirror the authoring plan's targeted obligations: organization-as-start, hold cue leakage and
# entry-plus-station double invoke in the model/runtime; empty Reset hidden placeholder (C9.1),
# silent first-offer choice and Peek forcing L2 in the wiring; and the C9.4/C9.5 ownership classes —
# departure instead of live start, View addition creating connectivity, Cut flying the route, a
# non-traversed route's station executing, and visit-runtime work writing authored source. C9.7 adds the
# authored hold's real duration, the restored Layout representation after a visit, and the station-only
# Activity that must not also be armed on entry. C9.8 adds the precise Camera's deliberate depth: the
# property list belongs to the Camera Card, every offered grip must have its own hit test, one value is
# live on one tape, and a declined draft must not stay on screen. C9.9 adds the review aid's own
# honesty: loaded content must credit no quickstart topic, a quickstart topic is credited only by its own
# authored outcome, the aid's cursor must prepare nothing, and no authoring control may be mounted inside a
# visit. The review round adds a merged rebind proposal that must wait as one decision, a declared-but-
# unrealized capability that may not become visitor work, and a retained choice whose destination left with
# its Presentation.
# QA_MUTATIONS is an optional comma-separated subset for the inner loop; unset runs every obligation.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/c9-mutations.XXXXXX")"
trap 'rm -rf "$work"' EXIT

# ------------------------------------------------- pure model/runtime obligations
# The protected test must be the one that fails, and a named neighbour must stay green: a suite
# that broke wholesale or crashed on import would prove nothing about the assertion.
for kind in organization hold-cue double-invoke invoke-repeat offer-invoke route-writer explanation-binding experience-output completed-work stopped-remainder carried-dependency live-move auto-clock cue-scope scope-validation live-departure implicit-connectivity cut-flight traversed-only offer-automatic visitor-source-write same-view-snap rejoin-full-estimate skip-fired-cue detour-readiness rejoin-held-cue offer-availability-write return-clock standalone-open shared-entry-origin go-continuation abandoned-parked-work return-dwell carried-pause abandoned-history detour-history-order remove-preserves-content duplicate-shares-definition missing-entry-hold rebind-overwrites-trigger profile-unvalidated hold-seconds framing-global handover-stopped entry-auto-only arrival-slot arrival-evicted return-entry handover-narration handover-identity handover-run-identity quickstart-standalone quickstart-second-moment; do
  if [ -n "${QA_MUTATIONS:-}" ]; then
    case ",$QA_MUTATIONS," in *,"$kind",*) ;; *) continue ;; esac
  fi
  python3 - "$QA_DIR/.." "$work/pure-$kind" "$kind" <<'PY'
import pathlib, shutil, sys
src, dst, kind = sys.argv[1:]
shutil.copytree(pathlib.Path(src) / 'app', pathlib.Path(dst) / 'app')
shutil.copytree(pathlib.Path(src) / 'tests', pathlib.Path(dst) / 'tests')
# The MP2 review suite imports the real action layer, whose transitive 'three' import must resolve
# from the repository root even though the disposable copy lives outside the workspace.
modules = pathlib.Path(src).resolve().parent.parent / 'node_modules'
if modules.exists():
    (pathlib.Path(dst) / 'node_modules').symlink_to(modules)
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
            "if(r.exploring||r.viewingSuppressed)return;",
            "if(r.exploring)return;")
elif kind == 'double-invoke':
    # Attaching an Activity to a station stops replacing its entry trigger, so the same work runs on
    # entry and again at the station: the second trigger the contract forbids.
    replace('app/experience-model.js',
            " u.start={kind:'station',seam:{from:a,to:b},connectionId,stationId,presentationId:e.stops[b]?.presentationId??u.presentationId};",
            "")
elif kind == 'invoke-repeat':
    # The station invocation re-fires on every tick instead of running once per transition.
    replace('app/experience-runtime.js',
            "if(!invocation.fired&&m.elapsed>=invocation.at){invocation.fired=true;",
            "if(!invocation.fired&&m.elapsed>=invocation.at){")
elif kind == 'offer-invoke':
    # A visitor offer becomes automatic traversal work.
    replace('app/experience-model.js',
            " if(u.kind==='interaction')return 'A visitor offer is activated by its subject; bind a separate Activity to invoke automatically';\n",
            "")
elif kind == 'route-writer':
    # Selecting another Stop no longer ends the route writer.
    replace('app/experience.js',
            "const procedure=['occurrence','seam','route','coordination','precision','hints'].includes(x.depth);",
            "const procedure=['occurrence'].includes(x.depth);")
elif kind == 'explanation-binding':
    # The explanation binding collapses back onto the organizational home.
    replace('app/experience-model.js',
            "const explained=(u,pid)=>!u.viewId&&u.primary&&(u.primaryFor??u.presentationId)===pid;",
            "const explained=(u,pid)=>!u.viewId&&u.primary&&u.presentationId===pid;")
elif kind == 'experience-output':
    # Experience-scoped output is dropped once its own visit has passed.
    replace('app/experience-runtime.js',
            "if(activationScope(e.uses[a.useId])!==null&&a.visit!==r.visit)return;",
            "if(a.visit!==r.visit)return;")
elif kind == 'completed-work':
    # Completed Experience work is counted again as if it had never run.
    replace('app/experience-runtime.js',
            " if(a.status==='stopped'||a.status==='unavailable')return null;\n return {spent:Math.max(0,Number(a.elapsed)||0)};",
            " return a.status==='unavailable'?null:{spent:0};")
elif kind == 'live-move':
    # Auto advances while a Camera move is still in flight.
    replace('app/experience-runtime.js',
            "if(ready&&!r.movement&&gateState(e,c,r).allowed)goStop(r,e,c,scene,resolveNext(e,r.stopId).id);",
            "if(ready&&gateState(e,c,r).allowed)goStop(r,e,c,scene,resolveNext(e,r.stopId).id);")
elif kind == 'auto-clock':
    # Enabling Auto restarts the Stop's remaining-work clock.
    replace('app/experience-runtime.js',
            "export function autoRuntime(e,current){const r=copy(current);r.autoplay=!r.autoplay;",
            "export function autoRuntime(e,current){const r=copy(current);r.autoplay=!r.autoplay;r.elapsed=0;")
elif kind == 'stopped-remainder':
    # A stopped run is waited for as if it could still resume and complete.
    replace('app/experience-runtime.js',
            " if(a.status==='stopped'||a.status==='unavailable')return null;",
            "")
elif kind == 'carried-dependency':
    # A dependent pays its own spent time on top of the position its dependency already gave it.
    replace('app/experience-runtime.js',
            "   start=spent?start:parent.start+offset;",
            "   start=parent.start+offset-spent;")
elif kind == 'cue-scope':
    # Live Experience-wide output is treated as unable to cue the current Presentation.
    replace('app/experience-model.js',
            "export function signalCanCuePresentation(e,ref,pid){\n const u=e.uses[ref?.useId];if(!u)return false;\n if(u.kind==='interaction')return !u.availability||u.availability===pid;\n const scope=activationScope(u);return scope===pid||scope===null;\n}",
            "export function signalCanCuePresentation(e,ref,pid){return signalCanDriveVisitCondition(e,ref,pid);}")
elif kind == 'live-departure':
    # Travel stops being a live-start invocation: the move is built from the authored departure View
    # instead of the visitor's actual pose.
    replace('app/experience-runtime.js',
            " const path=liveConnectionPath(connection,to.view.pose,r.pose);",
            " const path=liveConnectionPath(connection,to.view.pose,c.views[connection.from].pose);")
elif kind == 'implicit-connectivity':
    # Adding a View silently authors Camera connectivity to it, so a graph edit is an inference from
    # coexistence instead of an explicit Travel preparation.
    replace('app/experience-model.js',
            " const id=fresh(e,'use'); e.uses[id]={id,name,presentationId:pid,viewId,role,cue:null}; p.uses.push(id);",
            " const id=fresh(e,'use'); e.uses[id]={id,name,presentationId:pid,viewId,role,cue:null}; p.uses.push(id);for(const st of Object.values(e.stops)){const t=stopEntry(e,st.id);const from=t.id&&e.uses[t.id]?.viewId;if(from&&from!==viewId&&!Object.values(c.connections).some(k=>k.from===from&&k.to===viewId))addConnection(c,from,viewId);}")
elif kind == 'cut-flight':
    # Cut executes the Seam's Camera traversal and its route beats as if it were Travel.
    replace('app/experience-runtime.js',
            " if(seam?.mode==='travel'&&!ignoreTravel){const invocation=travelInvocation(e,c,r,from,to,seam);",
            " if(seam&&!ignoreTravel){const invocation=travelInvocation(e,c,r,from,to,seam);")
elif kind == 'traversed-only':
    # Every beat authored on the Seam executes during a traversal, not only the traversed connection's.
    replace('app/experience-coordination.js',
            "  ? seam.beats.filter(beat => beat.connectionId === connectionId) : [];",
            "  ? seam.beats.slice() : [];")
elif kind == 'offer-automatic':
    # A visitor offer becomes automatic visit work instead of an offer the visitor activates.
    replace('app/experience-runtime.js',
            "  if(u.viewId||u.kind==='interaction'||u.start.kind==='station'||activationScope(u)!==pid)return false;",
            "  if(u.viewId||u.start.kind==='station'||activationScope(u)!==pid)return false;")
elif kind == 'same-view-snap':
    # A same-View Seam collapses to an unconditional Cut, so a visitor who moved away is snapped to the
    # destination instead of the invocation being evaluated from the live pose.
    replace('app/experience-runtime.js',
            "   if(sameViewPose(r.pose,to.view.pose))return {path:null,speed:'cut',connectionId:null};\n   return {path:viewPath(r.pose,to.view.pose),speed:to.view.speed||'auto',connectionId:null};",
            "   return {path:null,speed:'cut',connectionId:null};")
elif kind == 'rejoin-full-estimate':
    # Only Experience-scoped work carries its playhead again, so Rejoin and detour Return rebuild a full
    # estimate for a run that is live in this very visit.
    replace('app/experience-runtime.js',
            " const u=e.uses[id];if(!u)return undefined;\n const a=r.activities[r.active[id]];if(!a)return undefined;",
            " const u=e.uses[id];if(!u||activationScope(u)!==null)return undefined;\n const a=r.activities[r.active[id]];if(!a)return undefined;")
elif kind == 'skip-fired-cue':
    # A cue whose own signal already fired is counted as future work again, so a finished cue is owed a
    # Camera move the runtime will never emit.
    replace('app/experience-runtime.js',
            "&&!policy.skipCue?.(u.cue))requests.push({id:u.id,at});",
            ")requests.push({id:u.id,at});")
elif kind == 'detour-readiness':
    # Return restores the parked parent without recomputing its remaining work, leaving the detour's
    # readiness (and cue floor) attached to the parent Stop.
    replace('app/experience-runtime.js',
            " r.readiness=estimatePresentation(e,c,r.presentationId,r.pose,entry.id,r.movement,scene,{cues:!entry.hold,cueFloor:r.cueFloor,skipCue:cue=>signalEmitted(r,cue),carried:carriedWork(r,e)});\n note(r,'Returned without duplicate entry');",
            " note(r,'Returned without duplicate entry');")
elif kind == 'rejoin-held-cue':
    # Rejoin keeps whatever viewing state the visit happened to be in, so a Stop whose entry holds the
    # viewpoint resumes automatic cues the remainder never counted.
    replace('app/experience-runtime.js',
            "if(entry.id)requestView(r,e,c,entry.id);r.viewingSuppressed=!!entry.hold;",
            "if(entry.id)requestView(r,e,c,entry.id);")
elif kind == 'offer-availability-write':
    # The authored availability is dropped, so every offer silently keeps the organizer's Presentation as
    # its availability instead of the Experience-wide default the draft showed.
    replace('app/experience.js',
            "const u=e.uses[uid];if(u&&draft.kind==='interaction')u.availability=draft.availability||null;return uid;}",
            "return uid;}")
elif kind == 'visitor-source-write':
    # The visit runtime reads AND writes the authored documents instead of its own isolated copy, so
    # a visitor activation edits authored Scene source the moment it runs.
    replace('app/experience.js',
            " const v=S.visitor;if(!v)return false;const e=v.source.experience,c=v.source.camera,scene=v.source.scene,r=v.runtime;",
            " const v=S.visitor;if(!v)return false;const e=ctx.experience,c=ctx.cameraSource,scene=ctx.sceneSource,r=v.runtime;")
    replace('app/experience-runtime.js',
            "  put(r,d.subjectId,cap.channel,cap.kind==='motion'&&a.duration?current:value,token);",
            "  put(r,d.subjectId,cap.channel,cap.kind==='motion'&&a.duration?current:value,token);if(scene.subjects[d.subjectId])scene.subjects[d.subjectId].properties[cap.channel]=value;")
elif kind == 'return-clock':
    # Return preserves the parent's Stop clock but forgets to rebase the remaining-work clock, so Auto
    # reads a partially heard narration as already done and advances on its next tick, cancelling it.
    replace('app/experience-runtime.js',
            " r.remainingFrom=r.elapsed;\n for(const a of Object.values(r.activities))if(a.visit===b.visit",
            " for(const a of Object.values(r.activities))if(a.visit===b.visit")
elif kind == 'return-dwell':
    # Return rewinds the parent's Stop clock, so an authored dwell restarts in full instead of keeping the
    # time already spent at the Stop.
    replace('app/experience-runtime.js',
            " r.remainingFrom=r.elapsed;\n for(const a of Object.values(r.activities))if(a.visit===b.visit",
            " r.elapsed=0;\n for(const a of Object.values(r.activities))if(a.visit===b.visit")
elif kind == 'carried-pause':
    # Abandoning a parked parent leaves its carried runs suspended, so Finish/Continue/Experience-end work
    # that parkParent paused never resumes once the bookmark that owned the pause is gone.
    replace('app/experience-runtime.js',
            " for(const a of Object.values(r.activities))if(a.visit===b.visit&&a.status==='paused'){r.active[a.useId]=a.token;a.status='running';}\n",
            "")
elif kind == 'abandoned-history':
    # A go choice abandons the parent's bookmark without recording the Stop the visitor actually visited, so
    # the parent is unreachable through ordinary Back history.
    replace('app/experience-runtime.js',
            " if(b.stopId)r.history.splice(b.history.length,0,b.stopId);\n",
            "")
elif kind == 'detour-history-order':
    # The abandoned parent is appended after the entries the detour recorded instead of being restored at
    # the position the detour began, so a longer visit backs C → A → B rather than C → B → A.
    replace('app/experience-runtime.js',
            " if(b.stopId)r.history.splice(b.history.length,0,b.stopId);",
            " if(b.stopId)r.history.push(b.stopId);")
elif kind == 'standalone-open':
    # Opening another standalone Presentation clears the departing identity before entry, so the ordinary
    # departure cleanup can no longer match the Presentation being left.
    replace('app/experience-runtime.js',
            " r.stopId=null;r.exploring=false;r.autoplay=false;r.movement=null;r.queue=[];",
            " r.stopId=null;r.presentationId=null;r.exploring=false;r.autoplay=false;r.movement=null;r.queue=[];")
elif kind == 'shared-entry-origin':
    # Coverage drops the shared Presentation entry when the Stop enters through another View, while that
    # entry stays visitor-selectable: all origins read supported and selecting it disables Next.
    replace('app/experience-model.js',
            " const ids=[...eligibleViews(e,from?.presentationId),stopEntry(e,a).id].filter(Boolean);",
            " const entry=stopEntry(e,a).id;\n const ids=[...(e.presentations[from?.presentationId]?.uses||[]).filter(id=>id===entry||e.uses[id]?.role==='choice'||e.uses[id]?.cue),entry].filter(Boolean);")
elif kind == 'go-continuation':
    # A go choice is rendered and executed as a detour: it parks the parent and exposes Return instead of
    # continuing, and carries no distinct continuation command.
    replace('app/experience-ui.js',
            "visitorButton(c.kind==='go'?'go':'detour',esc(c.label)+(t.missing?' · repair required':''),c.targetId)",
            "visitorButton('detour',esc(c.label)+(t.missing?' · repair required':''),c.targetId)")
    replace('app/experience.js',
            "\n // A go choice continues: it abandons any parked parent instead of parking one, so Back (not Return) is\n // the way it can be revisited.\n if(action==='go')v.runtime=R.chooseRuntime(e,c,r,id,false,scene);",
            "")
elif kind == 'abandoned-parked-work':
    # A go choice discards the parked bookmark without ending the parent's local work, so a paused
    # narration and its visit-retained effects survive into the next occurrence.
    replace('app/experience-runtime.js',
            " else while(r.bookmarks.length)endParkedVisit(r,e,scene,r.bookmarks.pop());",
            " else r.bookmarks=[];")
elif kind == 'remove-preserves-content':
    # Removing a Presentation destroys its retained contributions with it, so nothing is left to repair.
    replace('app/experience-model.js',
            " delete e.presentations[pid];\n for(const id of stops){e.guide=e.guide.filter(x=>x!==id);delete e.stops[id];}",
            " delete e.presentations[pid];for(const id of uses)delete e.uses[id];\n for(const id of stops){e.guide=e.guide.filter(x=>x!==id);delete e.stops[id];}")
elif kind == 'duplicate-shares-definition':
    # Duplicate aliases the original definition, so editing the copy silently rewrites both uses.
    replace('app/experience-model.js',
            "  e.uses[nid]={...copy(u),id:nid,presentationId:home,definitionId:did,primary:false,primaryFor:undefined};",
            "  e.uses[nid]={...copy(u),id:nid,presentationId:home,definitionId:u.definitionId,primary:false,primaryFor:undefined};")
elif kind == 'missing-entry-hold':
    # A Stop whose explicit View reference was removed is read as an intentional hold instead of an
    # unresolved repair case, so the missing framing is silently accepted.
    replace('app/experience-model.js',
            " return {id:uid||null,hold:!uid&&s.entry.kind==='presentation',missing:s.entry.kind==='use'&&!e.uses[uid]};",
            " return {id:uid||null,hold:!uid||(s.entry.kind==='use'&&!e.uses[uid]),missing:false};")
elif kind == 'rebind-overwrites-trigger':
    # Rebinding the operated target also overwrites the activation subject, so an offer silently
    # changes what activates it.
    replace('app/experience-model.js',
            " if(patch.subjectId!==undefined)d.subjectId=patch.subjectId;",
            " if(patch.subjectId!==undefined){d.subjectId=patch.subjectId;u.triggerSubjectId=patch.subjectId;}")
elif kind == 'profile-unvalidated':
    # An undeclared provider profile is accepted, so capability gain/loss is invented.
    replace('app/experience-capabilities.js',
            " if(!PROFILES[profile])throw Error('Unknown provider profile');\n",
            "")
elif kind == 'framing-global':
    # The topic's outcomes are session-wide again, so a Capture or an explanation on another moment stands in
    # for the one the topic is assessing.
    replace('app/experience.js',
            "authored:[()=>momentAuthored(working()?.id,'explanation'),()=>momentAuthored(working()?.id,'framing')],",
            "authored:['explanation','framing'],")
elif kind == 'handover-stopped':
    # Every dependent that is not still armed counts as a handover, so a dependent the visit disarmed before
    # it ever ran is credited to the capability sequence.
    replace('app/experience.js',
            "handoffs: ran.filter((a) => dependent(a) && a.began).length",
            "handoffs: ran.filter((a) => dependent(a) && a.status !== 'waiting' && a.status !== 'unavailable').length")
elif kind == 'entry-auto-only':
    # Auto entries are omitted at the runtime path that actually makes them.
    replace('app/experience-runtime.js',
            " r.entries.push({stopId:id,",
            " if(!r.autoplay)r.entries.push({stopId:id,")
elif kind == 'arrival-slot':
    # A queued destination cue hides the completion of the entry movement.
    replace('app/experience-runtime.js',
            "if(!entry.arrived&&entry.visit===m.visit&&entry.viewUseId===m.useId)",
            "if(!r.queue.length&&!entry.arrived&&entry.visit===m.visit&&entry.viewUseId===m.useId)")
elif kind == 'arrival-evicted':
    # Entry outcomes are forgotten when their Camera diagnostic falls out of the short journal.
    replace('app/experience-runtime.js',
            "].slice(-ARRIVAL_JOURNAL);",
            "].slice(-ARRIVAL_JOURNAL);for(const entry of r.entries)if(entry.viewUseId&&!r.arrivals.some(a=>a.useId===entry.viewUseId&&a.token>=entry.since))entry.arrived=false;")
elif kind == 'return-entry':
    # Resuming the parent invents another entry, although no new visit starts.
    replace('app/experience-runtime.js',
            " Object.assign(r,b,{movement:null,queue:[],exploring:false,autoplay:false});",
            " Object.assign(r,b,{movement:null,queue:[],exploring:false,autoplay:false});r.entries.push({...r.entries.find(x=>x.visit===b.visit)});")
elif kind == 'quickstart-standalone':
    replace('app/experience.js', "&&!!v&&!v.stop&&v.narration", "&&!!v&&v.narration")
elif kind == 'quickstart-second-moment':
    replace('app/experience.js',
            "e.guide.length===2&&new Set(e.guide.map(id=>e.stops[id]?.presentationId)).size===2&&Object.keys(e.seams).length===0",
            "e.guide.length===2&&Object.keys(e.seams).length===0")
elif kind == 'handover-identity':
    replace('app/experience.js',
            "v.handoffRuns.some(h=>stopped.some(s=>s.carried&&s.live&&s.useId===h.toUseId&&s.token===h.toRun))",
            "stopped.some(s=>s.carried)")
elif kind == 'handover-run-identity':
    replace('app/experience.js',
            "v.handoffRuns.some(h=>stopped.some(s=>s.carried&&s.live&&s.useId===h.toUseId&&s.token===h.toRun))",
            "v.handoffRuns.some(h=>stopped.some(s=>s.carried&&s.live&&s.useId===h.toUseId))")
elif kind == 'handover-narration':
    # Any dependency, including narration completion, counts as a finite capability handover.
    replace('app/experience.js',
            "&&start.signal==='complete'&&kind(start.useId)==='control'",
            "")
elif kind == 'hold-seconds':
    # An authored Experience hold no longer delays arrival, so the visitor's move ignores it.
    replace('app/experience-coordination.js',
            "accumulated += hold.seconds;",
            "accumulated += 0;")
else:
    # An impossible dependency scope is accepted as if it could still fire.
    replace('app/experience-model.js',
            "function dependencyInScope(e,u){return u.start.scope==='experience'||signalCanDriveVisitCondition(e,u.start,activationScope(u));}",
            "function dependencyInScope(e,u){return true;}")
PY
  case "$kind" in
    organization) name='organization is independent of explicit activation and boundary'; control='Finish after local departure' ;;
    hold-cue) name='hold suppresses entry and all automatic cues'; control='explicit marker seconds survive' ;;
    double-invoke) name='P1 a station invocation replaces the Activity trigger'; control='P4 a stopped carried run and its disarmed dependents' ;;
    invoke-repeat) name='station-bound holds delay arrival; invoked controls run once at Camera station'; control='multi-origin coordination executes only the traversed connection' ;;
    offer-invoke) name='P1 station invocation targets automatic work only'; control='multi-origin coordination executes only the traversed connection' ;;
    route-writer) name='P1 selecting another Stop ends the route writer'; control='P2 a primary explanation keeps its binding' ;;
    explanation-binding) name='P2 a primary explanation keeps its binding'; control='P1 selecting another Stop ends the route writer' ;;
    experience-output) name='P3 Experience-start narration keeps captions and View cues'; control='P4 completed Experience work adds no wait' ;;
    completed-work) name='P4 completed Experience work adds no wait'; control='P3 Experience-start narration keeps captions and View cues' ;;
    live-move) name='P4 Auto waits for a live Camera move'; control='P4 enabling Auto keeps the Stop remaining-work clock' ;;
    auto-clock) name='P4 enabling Auto keeps the Stop remaining-work clock'; control='P4 Auto waits for a live Camera move' ;;
    stopped-remainder) name='P4 a stopped carried run and its disarmed dependents'; control='P4 completed Experience work adds no wait' ;;
    carried-dependency) name='P4 a carried dependency counts the remaining work once'; control='P4 completed Experience work adds no wait' ;;
    cue-scope) name='P3 a View cue driven by Experience-wide output is legitimate work'; control='P3 an Experience-scoped signal never satisfies a later visit Gate' ;;
    scope-validation) name='P5 a visit-local dependency in another scope'; control='P5 a View cue that can never fire' ;;
    live-departure) name='C9.4 early Next from the live pose traverses only the supported redirected route'; control='C9.4 Cut executes no Travel route beats or flight' ;;
    implicit-connectivity) name='C9.4 Travel selection is one aggregate Undo'; control='C9.5 offers are never automatic work and availability stays explicit' ;;
    cut-flight) name='C9.4 Cut executes no Travel route beats or flight'; control='C9.4 early Next from the live pose traverses only the supported redirected route' ;;
    traversed-only) name='C9.4 early Next from the live pose traverses only the supported redirected route'; control='C9.4 Cut executes no Travel route beats or flight' ;;
    offer-automatic) name='C9.5 offers are never automatic work and availability stays explicit'; control='C9.5 open/close/rejoin and one bounded detour never write authored documents' ;;
    visitor-source-write) name='C9.5 a full visitor session leaves authored documents, history and selection untouched'; control='C9.4 preparation creates only missing scoped routes, reuses the rest, and is idempotent' ;;
    same-view-snap) name='C9.4 same-View Travel from a moved live pose'; control='C9.4 Cut executes no Travel route beats or flight' ;;
    rejoin-full-estimate) name='C9.5 rejoin never rebuilds completed work'; control='C9.5 a click activates, a drag never does' ;;
    skip-fired-cue) name='C9.5 rejoin skips a cue whose signal already fired'; control='C9.5 rejoin keeps a future cue' ;;
    detour-readiness) name='C9.5 Return from one detour restores the parent remaining work'; control='C9.5 rejoin keeps a future cue' ;;
    rejoin-held-cue) name='C9.5 rejoin restores a held viewing intent'; control='C9.5 rejoin keeps a future cue' ;;
    offer-availability-write) name='C9.5 offer authoring defaults to Experience-wide'; control='C9.5 Preview Experience starts a world-only session' ;;
    return-clock) name='C9.5 Return preserves the parent Stop clock while Auto still waits the remaining work'; control='C9.5 Return from one detour restores the parent remaining work' ;;
    return-dwell) name='C9.5 Return preserves an authored dwell'; control='C9.5 Return from one detour restores the parent remaining work' ;;
    carried-pause) name='C9.5 a go choice resumes carried parent work'; control='C9.5 open/close/rejoin and one bounded detour never write authored documents' ;;
    abandoned-history) name='C9.5 a go choice keeps the visited parent reachable through Back history'; control='C9.5 open/close/rejoin and one bounded detour never write authored documents' ;;
    detour-history-order) name='C9.5 a go choice restores the parked parent before entries recorded during the detour'; control='C9.5 a go choice keeps the visited parent reachable through Back history' ;;
    remove-preserves-content) name='C9.6 removePresentation keeps definitions, Camera Views and dangling references repairable'; control='C9.6 rename Presentation keeps identity and shared use' ;;
    duplicate-shares-definition) name='C9.6 duplicate makes an independent identity and definition; a View duplicate shares Camera'; control='C9.6 make-local detaches a shared definition; link shares it again' ;;
    missing-entry-hold) name='C9.6 removeContribution unlinks a View use locally and leaves the Camera View intact'; control='C9.6 rename Presentation keeps identity and shared use' ;;
    rebind-overwrites-trigger) name='C9.6 rename and rebind repair a contribution while keeping trigger and target distinct'; control='C9.6 provider profile replacement gains and loses declared capabilities with the instance kept' ;;
    profile-unvalidated) name='C9.6 provider profile replacement gains and loses declared capabilities with the instance kept'; control='C9.6 rename Presentation keeps identity and shared use' ;;
    hold-seconds) name='C9.4 readiness and Auto count the route and its holds exactly once'; control='multi-origin coordination executes only the traversed connection' ;;
    standalone-open) name='C9.5 opening another standalone Presentation ends the departing visit local work'; control='C9.5 open/close/rejoin and one bounded detour never write authored documents' ;;
    shared-entry-origin) name='every eligible Presentation View and the private Stop entry are legitimate origins'; control='C9.4 preparation creates only missing scoped routes, reuses the rest, and is idempotent' ;;
    go-continuation) name='C9.5 a go choice is a distinct authored continuation'; control='C9.5 open/close/rejoin and one bounded detour never write authored documents' ;;
    abandoned-parked-work) name='C9.5 a go choice ends the parked parent local work'; control='C9.5 open/close/rejoin and one bounded detour never write authored documents' ;;
    framing-global) name='the framing a topic asks for belongs to the moment it was accepted in, through either authored door'; control='a quickstart topic names every outcome its instruction produces, not any one of them' ;;
    handover-stopped) name='a capability sequence counts a handover only when the dependent really began'; control='the capability-sequence topic needs the handover and the carried run the visitor stopped' ;;
    entry-auto-only) name='a Stop reached by Auto is as real as one reached by Next'; control='a quickstart topic names every outcome its instruction produces, not any one of them' ;;
    arrival-slot) name='a Travel arrival survives the destination starting its own cue'; control='a Guide visit opens its ledger with the Stop it entered and arrives where the Camera does' ;;
    arrival-evicted) name='entry arrival survives more cues than the Camera diagnostic journal retains'; control='a Guide visit opens its ledger with the Stop it entered and arrives where the Camera does' ;;
    return-entry) name='Return resumes its Stop without inventing another entry policy'; control='the capability-sequence topic needs the handover and the carried run the visitor stopped' ;;
    quickstart-standalone) name='the standalone walkthrough topic requires a standalone Preview, not a Guide visit'; control='the capability-sequence topic needs the handover and the carried run the visitor stopped' ;;
    quickstart-second-moment) name='the second-Presentation walkthrough topic cannot be earned with repeated Stops of one moment'; control='the capability-sequence topic needs the handover and the carried run the visitor stopped' ;;
    handover-identity) name='a capability handover plus an unrelated carried Stop never completes the sequence'; control='the capability-sequence topic needs the handover and the carried run the visitor stopped' ;;
    handover-run-identity) name='the sequence Stop must match the dependent run, even when the use identity matches'; control='the capability-sequence topic needs the handover and the carried run the visitor stopped' ;;
    handover-narration) name='an explanation finishing is not a capability completion handover'; control='the capability-sequence topic needs the handover and the carried run the visitor stopped' ;;
  esac
  log="$work/pure-$kind.log"
  if node --test "$work/pure-$kind/tests/experience-composition.test.mjs" "$work/pure-$kind/tests/experience-runtime.test.mjs" "$work/pure-$kind/tests/experience-mp2-review.test.mjs" "$work/pure-$kind/tests/camera-conformance.test.mjs" "$work/pure-$kind/tests/experience-travel-agency.test.mjs" "$work/pure-$kind/tests/experience-revision.test.mjs" "$work/pure-$kind/tests/experience-c9-review.test.mjs" >"$log" 2>&1; then
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
for kind in reset-placeholder first-offer peek-l2 orphan-hidden profile-loss-silent representation-restore station-entry-arming precision-cluster grip-seat tape-pair stale-draft rebind-shared-silent rebind-merged-silent offer-unrealized choice-unresolved presenter-unrelated-credit visit-entry-unseeded peek-unrecorded presenter-loaded-credit presenter-skip-prepares presenter-visit-controls presenter-next-unearned presenter-framing-uncharged presenter-sequence-credit presenter-entry-configuration visit-arrival-immediate presenter-framing-scope presenter-handover-disarmed visit-entries-auto visit-return-entry presenter-lens-content; do
  if [ -n "${QA_MUTATIONS:-}" ]; then
    case ",$QA_MUTATIONS," in *,"$kind",*) ;; *) continue ;; esac
  fi
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
    # The shared review aid's placeholder goes blank exactly when the Experience is empty.
    replace('app/journeys.js',
            "$('#jBody').textContent = (S.visitor ? 'Read-only while Preview is active · ' : '') + step.instruction;",
            "$('#jBody').textContent = Object.values(ctx.experience.presentations).length ? step.instruction : '';")
    replace('app/journeys.js',
            "observed.textContent = `Observed · ${step.observed()}`;",
            "observed.textContent = Object.values(ctx.experience.presentations).length ? `Observed · ${step.observed()}` : '';")
elif kind == 'first-offer':
    # Visitor View offers silently collapse to the first eligible one.
    replace('app/experience-ui.js',
            "eligibleViews(e,r.presentationId).map(id=>visitorButton('look'",
            "eligibleViews(e,r.presentationId).slice(0,1).map(id=>visitorButton('look'")
elif kind == 'orphan-hidden':
    # Retained contributions whose home was removed are dropped from the Experience inventory, so their
    # repair writer has no reachable home.
    replace('app/experience-ui.js',
            " + (retainedContributions().length?",
            " + (false?")
elif kind == 'representation-restore':
    # Exit no longer puts the authored Layout representation back, so a visit leaves the World unrolled.
    replace('app/experience-scene.js',
            " if(!snapshot?.length||!ctx.stage?.d)return;",
            " if(true||!snapshot?.length||!ctx.stage?.d)return;")
elif kind == 'station-entry-arming':
    # A station-only Activity is also armed on entry, so it runs on entry and again at its station.
    replace('app/experience-runtime.js',
            "if(u.viewId||u.kind==='interaction'||u.start.kind==='station'||activationScope(u)!==pid)return false;",
            "if(u.viewId||u.kind==='interaction'||activationScope(u)!==pid)return false;")
elif kind == 'precision-cluster':
    # The floating six-property cluster comes back into the Instrument, so deliberate depth is replaced
    # by a dashboard over the drawing while the Camera work is already active.
    replace('app/experience-ui.js',
            "<p class=\"c-hint\">Active property · ${esc(gripLabels[t.params.grip]||'none')} — select another grip on the drawing; the full list stays in the Camera Card.</p>",
            "<div class=\"camera-grips\">${Object.entries(gripLabels).map(([g,label])=>button('exp-grip',label).replace('data-id=',`data-grip=\"${g}\" data-id=`)).join('')}</div>")
elif kind == 'grip-seat':
    # Grips keep their nominal anchor even when another grip already covers it, so one supported grip
    # cannot be reached by the pointer at all.
    replace('app/experience-draw.js',
            " seats(anchors);\n",
            "")
elif kind == 'tape-pair':
    # A second tape is rendered beside the active one, so two values look live at the same time.
    replace('app/experience-draw.js',
            " if(at)ov().chip('camera-active-tape',",
            " if(at){ov().chip('camera-active-tape-b',at.x-150,at.y+60,`<label class=\"numeric-tape\">Frame height <input type=\"number\" data-exp-precision=\"frameH\" value=\"1\"></label>`,'exp-active-tape',{'data-active-tape':'frameH',tag:'div',pri:1000});ov().chip('camera-active-tape',")
    replace('app/experience-draw.js',
            ",'exp-active-tape',{'data-active-tape':grip,tag:'div',pri:1000});",
            ",'exp-active-tape',{'data-active-tape':grip,tag:'div',pri:1000});}")
elif kind == 'stale-draft':
    # Nothing puts a dropped draft back: the pooled tape keeps displaying the declined number and no
    # cancel restores the field, which is exactly the state this slice fixed.
    replace('app/overlay.js',
            "if (e._html === html && !this.stale(e)) return;",
            "if (e._html === html) return;")
    replace('app/main.js',
            "onCancel(()=>{fieldEpoch++;if(experienceDraft){const {el}=experienceDraft;if(el.isConnected)el.value=el.defaultValue;experienceDraft=null;}},8,'Experience field draft');",
            "onCancel(()=>{fieldEpoch++;experienceDraft=null;},8,'Experience field draft');")
elif kind == 'rebind-shared-silent':
    # Replacing a descriptor on a linked definition silently reaches every linked Activity.
    replace('app/experience.js',
            " if(reach.length>1){S.expRebindAsk={id,patch:merged,definitionId,reach};ctx.ui();return true;}",
            " if(false){S.expRebindAsk={id,patch:merged,definitionId,reach};ctx.ui();return true;}")
elif kind == 'rebind-merged-silent':
    # Reach is read from the field this call touched, so a use-only change applies the definition edit a
    # still-pending scope Ask was holding and every linked Activity changes before acceptance.
    replace('app/experience.js',
            "const reachesDefinition=['subjectId','capabilityId','value'].some(k=>merged[k]!==undefined);",
            "const reachesDefinition=['subjectId','capabilityId','value'].some(k=>patch[k]!==undefined);")
elif kind == 'offer-unrealized':
    # Offer creation ignores whether this Stage realizes the capability, so declared-but-unrealized work is
    # authored as a visitor offer that can never run.
    replace('app/experience.js',
            " const draft=S.expOfferDraft;if(!draft)return false;const cap=capability(ctx.sceneSource,draft.subjectId,draft.capabilityId);\n if(!cap){A.setStatus('Choose a capability this subject declares','refuse');ctx.ui();return false;}\n if(!isRealized(cap)){A.setStatus(`${cap.label} · declared by the provider but not realized by this Stage`,'refuse');ctx.ui();return false;}",
            " const draft=S.expOfferDraft;if(!draft)return false;const cap=capability(ctx.sceneSource,draft.subjectId,draft.capabilityId);if(!cap)return false;")
elif kind == 'choice-unresolved':
    # A choice whose destination left with its Presentation is followed anyway: the parent visit is parked
    # before the Stop is found missing, and the visitor loses their narration and their Stop.
    replace('app/experience-runtime.js',
            " const destination=e.stops[targetId];\n if(!destination||!e.presentations[destination.presentationId]){r.refusal='Choice destination needs repair before it can be followed';return r;}\n",
            "")
elif kind == 'presenter-unrelated-credit':
    # Any authored write counts as authorship for every satisfied quickstart topic, so an edit that is not
    # a topic's own outcome completes it on a document the loader produced.
    replace('app/experience.js',
            "const seen=!!step.done(),required=step.family==='Q'?(step.authored||[]):[],authored=required.length?required.every(r=>typeof r==='function'?!!r():authoredHere(r)):S.expReview.writes>0;",
            "const seen=!!step.done(),authored=S.expReview.writes>0;")
elif kind == 'visit-entry-unseeded':
    # The opening Stop is visited, but its entry outcome is absent.
    replace('app/experience-runtime.js',
            " r.entries.push({stopId:id,",
            " if(entryFrom)r.entries.push({stopId:id,")
elif kind == 'peek-unrecorded':
    # A quiet Peek selection is no longer recorded, so the quickstart Peek topic can never complete.
    replace('app/experience.js',
            " review({peeks:(S.expReview.peeks||0)+1});\n cancelProposal('selection');A.select(id);",
            " cancelProposal('selection');A.select(id);")
elif kind == 'presenter-lens-content':
    # The shared panel continues rendering World content in Experience.
    replace('app/journeys.js',
            "const experience = S.lens === 'experience';",
            "const experience = false;")
elif kind == 'presenter-next-unearned':
    # Next is offered past a topic whose outcome was never reached, and the aid advances anyway.
    replace('app/journeys.js',
            "next.disabled = !credit.credited;",
            "next.disabled = false;")
    replace('app/journeys.js',
            "if (a.dataset.jact === 'next') E.presenterNext();",
            "if (a.dataset.jact === 'next') E.presenterStep(1);")
elif kind == 'presenter-loaded-credit':
    # The review aid credits a topic whenever its outcome is visible, so loaded content counts as
    # authorship and a reviewer is told they have done work they never did.
    replace('app/experience.js',
            "return {seen,credited:seen&&(step.family==='A'||authored),authored};",
            "return {seen,credited:seen,authored};")
elif kind == 'presenter-skip-prepares':
    # Moving the aid's cursor also selects and positions the work, so navigation prepares state instead
    # of only changing which instruction is shown.
    replace('app/experience.js',
            "S.experiencePresenter=Math.max(0,Math.min(n-1,(S.experiencePresenter||0)+delta));ctx.ui();return S.experiencePresenter;}",
            "S.experiencePresenter=Math.max(0,Math.min(n-1,(S.experiencePresenter||0)+delta));if(ctx.experience.guide.length)A.select(ctx.experience.guide[S.experiencePresenter%ctx.experience.guide.length]);ctx.ui();return S.experiencePresenter;}")
elif kind == 'presenter-visit-controls':
    # Reintroduce the actual exposure, including the outer visibility guard: Preview mounts available
    # authoring loaders beside the otherwise read-only walkthrough.
    replace('app/experience-ui.js',
            "presenter.hidden=S.lens!=='experience'||visiting;",
            "presenter.hidden=S.lens!=='experience';if(visiting){presenter.open=true;presenter.style.setProperty('display','block','important');}")
    replace('app/experience-ui.js',
            "for(const el of presenter.querySelectorAll('[data-authoring]'))el.hidden=visiting;",
            "for(const el of presenter.querySelectorAll('[data-authoring]'))el.hidden=false;")
elif kind == 'presenter-framing-uncharged':
    # The framing outcome is dropped from the topic's authored requirement, so an explanation alone completes
    # a topic whose instruction also asks for an explicit Capture — on framing the loader supplied.
    replace('app/experience.js',
            "authored:[()=>momentAuthored(working()?.id,'explanation'),()=>momentAuthored(working()?.id,'framing')],",
            "authored:[()=>momentAuthored(working()?.id,'explanation')],")
elif kind == 'presenter-sequence-credit':
    # Any completed work credits the capability sequence, so a visit that finished an explanation and a bare
    # Activity is credited without the handover or the carried run the topic names.
    replace('app/experience.js',
            "const v=S.expReview.visit,stopped=S.expReview.visitor?.stopped||[];return !!v&&v.controls>=1&&v.completed>=1&&v.handoffs>=1&&v.handoffRuns.some(h=>stopped.some(s=>s.carried&&s.live&&s.useId===h.toUseId&&s.token===h.toRun));",
            "const v=S.expReview.visit;return !!v&&v.controls>=1&&v.completed>=1;")
elif kind == 'presenter-entry-configuration':
    # Configured entry policies are read as if the visit had run them, so two kinds of Entry in the document
    # complete a topic about comparing what the visitor actually met.
    replace('app/experience.js',
            "const ent=S.expReview.visitor?.entries||[];return ent.some(x=>x.kind==='presentation'&&x.arrived)&&ent.some(x=>x.kind==='use'&&x.later&&x.arrived)&&ent.some(x=>x.kind==='hold'&&x.ran);",
            "const kinds=new Set(Object.values(e.stops).map(s=>s.entry.kind));return kinds.size>=2&&!!S.expReview.visit;")
elif kind == 'presenter-framing-scope':
    # The topic's outcomes are session-wide again, so a Capture on another moment completes the topic that is
    # assessing a Presentation still framed by the loader.
    replace('app/experience.js',
            "authored:[()=>momentAuthored(working()?.id,'explanation'),()=>momentAuthored(working()?.id,'framing')],",
            "authored:['explanation','framing'],")
elif kind == 'presenter-handover-disarmed':
    # A dependent the visit disarmed before it ever ran is counted as a handover, so the capability sequence
    # is credited for a sequence that never happened.
    replace('app/experience.js',
            "handoffs: ran.filter((a) => dependent(a) && a.began).length",
            "handoffs: ran.filter((a) => dependent(a) && a.status !== 'waiting' && a.status !== 'unavailable').length")
elif kind == 'visit-entries-auto':
    # Auto makes visits without recording their entry outcomes.
    replace('app/experience-runtime.js',
            " r.entries.push({stopId:id,",
            " if(!r.autoplay)r.entries.push({stopId:id,")
elif kind == 'visit-arrival-immediate':
    # The destination borrows the last arrival while its own movement is still in flight.
    replace('app/experience-runtime.js',
            "hold:!!entry.hold,arrived:!entry.id,ran:false",
            "hold:!!entry.hold,arrived:!!r.arrivedViewUseId,ran:false")
elif kind == 'visit-return-entry':
    replace('app/experience-runtime.js',
            " Object.assign(r,b,{movement:null,queue:[],exploring:false,autoplay:false});",
            " Object.assign(r,b,{movement:null,queue:[],exploring:false,autoplay:false});r.entries.push({...r.entries.find(x=>x.visit===b.visit)});")
elif kind == 'profile-loss-silent':
    # Provider replacement applies the profile but the adapter keeps reporting the previous declared
    # capabilities, so loss/gain is silently invisible.
    replace('app/experience-capabilities.js',
            "export function capability(scene,sid,id) {return capabilities(scene,sid).find(c=>c.id===id)||null;}",
            "export function capability(scene,sid,id) {return capabilities({...scene,subjects:{...scene.subjects,[sid]:{...scene.subjects[sid],profile:scene.subjects[sid]?.profile==='machineBase'?'machine':scene.subjects[sid]?.profile}}},sid).find(c=>c.id===id)||null;}")
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
    orphan-hidden)
      axis=revision; boundary='QA_REVISION_UNTIL=remove'
      expected='the retained contributions are listed for repair without resurrecting the removed home'; control='rename accepts once' ;;
    profile-loss-silent)
      axis=revision; boundary='QA_REVISION_UNTIL=rebind'
      expected='the lost capability is a routed repair notice on the retained Activity, not a silent change'; control='rename accepts once' ;;
    representation-restore)
      axis=rich; boundary='QA_RICH_UNTIL=wall'
      expected='Exit restores the author Wall reading exactly'; control='Preview unrolls the authored World Wall through its own evaluator' ;;
    station-entry-arming)
      axis=rich; boundary='QA_RICH_UNTIL=traced'
      expected='the destination visit does not arm the station-only Activity on entry'; control='Next travels the authored route, carrying its hold and its station invocation' ;;
    precision-cluster)
      axis=precision-c9; boundary='QA_PRECISION_C9_UNTIL=entry'
      expected='…and the Instrument names it, keeping the full list in the Card'; control='the Card property opens the precise Camera on that View and use, with that grip selected' ;;
    grip-seat)
      axis=precision-c9; boundary='QA_PRECISION_C9_UNTIL=entry'
      expected='every offered grip has its own hit test, on a seat no other grip covers'; control='exactly one property is live on exactly one Stage tape' ;;
    tape-pair)
      axis=precision-c9; boundary='QA_PRECISION_C9_UNTIL=entry'
      expected='exactly one property is live on exactly one Stage tape'; control='the Card property opens the precise Camera on that View and use, with that grip selected' ;;
    stale-draft)
      axis=precision-c9; boundary='QA_PRECISION_C9_UNTIL=draft'
      expected='declining puts the authored value back on its one tape'; control='a typed value in a shared View is a proposal, not an edit' ;;
    rebind-shared-silent)
      axis=revision; boundary='QA_REVISION_UNTIL=shared-scope'
      expected='replacing a shared descriptor discloses its real reach and writes nothing yet'; control='rename accepts once' ;;
    rebind-merged-silent)
      axis=revision; boundary='QA_REVISION_UNTIL=merged-rebind'
      expected='a use-only change while the Ask is open never writes the merged definition edit'; control='rename accepts once' ;;
    offer-unrealized)
      axis=revision; boundary='QA_REVISION_UNTIL=unrealized-offers'
      expected='a declared-but-unrealized capability can never be authored as visitor work'; control='the mesh provider now declares Annotate as a gained capability' ;;
    choice-unresolved)
      axis=rich; boundary='QA_RICH_UNTIL=retained-choice'
      expected='the runtime refuses the unresolved destination without parking the parent visit'; control='removing a Presentation retains the authored labelled choice as an unresolved, repairable reference' ;;
    visit-entry-unseeded)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=policies'
      expected='…while configured policies alone leave the topic open, with only the entries a visit really made'; control='the visit opens its ledger with the Stop it entered, before any command' ;;
    presenter-unrelated-credit)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=unrelated'
      expected="an authored edit that is not this topic's outcome is counted, and completes nothing"; control='loading the example is named as the source and counts no authored edit' ;;
    peek-unrecorded)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=advanced'
      expected="a quiet Peek selection records the Peek without expanding the occurrence"; control='leaving the visit gives the authoring controls back' ;;
    presenter-lens-content)
      axis=walkthrough; boundary='QA_WALKTHROUGH_UNTIL=lens'
      expected='Experience switches the same panel to its workflow, with no World content or Replay'; control='World uses the retained A–F Presenter content and Replay' ;;
    presenter-next-unearned)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=provenance'
      expected='…and Next stays disabled while the topic outcome is not earned'; control='loading the example is named as the source and counts no authored edit' ;;
    presenter-loaded-credit)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=provenance'
      expected='…crediting no quickstart topic even though the example satisfies their outcomes'; control='loading the example is named as the source and counts no authored edit' ;;
    presenter-skip-prepares)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=navigation'
      expected='…without touching the documents, the history, the selection, the Camera or the tally'; control='the aid carries all eighteen topics' ;;
    presenter-visit-controls)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=visit'
      expected='…with every authoring control inside it unmounted'; control="during the visit the aid is still there, marked as a visit's guidance" ;;
    presenter-framing-uncharged)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=framing'
      expected='…while the explanation alone leaves the topic open: its framing came with the document'; control='an edit authored here is counted, named as authored, and is one Undo' ;;
    presenter-sequence-credit)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=sequence'
      expected='…while that sequence alone leaves the topic open: no carried run was stopped'; control='the visit opens its ledger with the Stop it entered, before any command' ;;
    presenter-entry-configuration)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=policies'
      expected='…while configured policies alone leave the topic open, with only the entries a visit really made'; control='the visit opens its ledger with the Stop it entered, before any command' ;;
    visit-arrival-immediate)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=arrival'
      expected='…which stays travelling until the Camera really reaches the destination entry'; control='…and records the Stop it travelled to as a traversal' ;;
    presenter-framing-scope)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=moment'
      expected='…and a Capture on another moment never stands in for the one the topic assesses'; control='an edit authored here is counted, named as authored, and is one Undo' ;;
    presenter-handover-disarmed)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=handover'
      expected='…so the dependent the visit left behind is no handover, whatever else completed'; control='the visit opens its ledger with the Stop it entered, before any command' ;;
    visit-return-entry)
      axis=rich; boundary='QA_RICH_UNTIL=wall'
      expected='Return resumes the parent without recording a duplicate Stop entry'; control='the unroll writes no source and no history' ;;
    visit-entries-auto)
      axis=presenter; boundary='QA_PRESENTER_UNTIL=auto'
      expected='…and with Auto on, all four Stops and their three entry policies land in the ledger'; control='the visit opens its ledger with the Stop it entered, before any command' ;;
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
