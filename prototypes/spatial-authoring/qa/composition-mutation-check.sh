#!/usr/bin/env bash
# C9.2/C9.3 successor proof: each named regression is reintroduced in a disposable copy and the
# assertion that protects it must reject the copy while unaffected controls stay green. The kinds
# mirror the authoring plan's targeted obligations: organization-as-start, hold cue leakage and
# entry-plus-station double invoke in the model/runtime; empty Reset hidden placeholder (C9.1),
# silent first-offer choice and Peek forcing L2 in the wiring; and the C9.4/C9.5 ownership classes —
# departure instead of live start, View addition creating connectivity, Cut flying the route, a
# non-traversed route's station executing, and visit-runtime work writing authored source.
set -eu
QA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/c9-mutations.XXXXXX")"
trap 'rm -rf "$work"' EXIT

# ------------------------------------------------- pure model/runtime obligations
# The protected test must be the one that fails, and a named neighbour must stay green: a suite
# that broke wholesale or crashed on import would prove nothing about the assertion.
for kind in organization hold-cue double-invoke invoke-repeat offer-invoke route-writer explanation-binding experience-output completed-work stopped-remainder carried-dependency live-move auto-clock cue-scope scope-validation live-departure implicit-connectivity cut-flight traversed-only offer-automatic visitor-source-write same-view-snap rejoin-full-estimate skip-fired-cue detour-readiness rejoin-held-cue offer-availability-write return-clock standalone-open shared-entry-origin go-continuation abandoned-parked-work return-dwell carried-pause abandoned-history detour-history-order; do
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
            "visitorButton(c.kind==='go'?'go':'detour',esc(c.label),c.targetId)",
            "visitorButton('detour',esc(c.label),c.targetId)")
    replace('app/experience.js',
            "\n // A go choice continues: it abandons any parked parent instead of parking one, so Back (not Return) is\n // the way it can be revisited.\n if(action==='go')v.runtime=R.chooseRuntime(e,c,r,id,false,scene);",
            "")
elif kind == 'abandoned-parked-work':
    # A go choice discards the parked bookmark without ending the parent's local work, so a paused
    # narration and its visit-retained effects survive into the next occurrence.
    replace('app/experience-runtime.js',
            " else while(r.bookmarks.length)endParkedVisit(r,e,scene,r.bookmarks.pop());",
            " else r.bookmarks=[];")
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
    standalone-open) name='C9.5 opening another standalone Presentation ends the departing visit local work'; control='C9.5 open/close/rejoin and one bounded detour never write authored documents' ;;
    shared-entry-origin) name='every eligible Presentation View and the private Stop entry are legitimate origins'; control='C9.4 preparation creates only missing scoped routes, reuses the rest, and is idempotent' ;;
    go-continuation) name='C9.5 a go choice is a distinct authored continuation'; control='C9.5 open/close/rejoin and one bounded detour never write authored documents' ;;
    abandoned-parked-work) name='C9.5 a go choice ends the parked parent local work'; control='C9.5 open/close/rejoin and one bounded detour never write authored documents' ;;
  esac
  log="$work/pure-$kind.log"
  if node --test "$work/pure-$kind/tests/experience-composition.test.mjs" "$work/pure-$kind/tests/experience-runtime.test.mjs" "$work/pure-$kind/tests/experience-mp2-review.test.mjs" "$work/pure-$kind/tests/camera-conformance.test.mjs" "$work/pure-$kind/tests/experience-travel-agency.test.mjs" >"$log" 2>&1; then
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
