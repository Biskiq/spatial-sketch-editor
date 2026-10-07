import { conformanceFixture } from './conformance-fixture.js';
import { createSceneCapabilities, capability, capabilities, setSceneValue, replaceProfile, isRealized } from './experience-capabilities.js';
import { buildCapabilitySubjects, realizeCapabilities, captureRepresentation, restoreRepresentation } from './experience-scene.js';
import * as nav from './navigation.js';
import * as T from './tasks.js';
import { cancelProposal, onCancel } from './cancel.js';
import * as R from './experience-runtime.js';
import { createRuntime, tickRuntime } from './experience-runtime.js';
import { S, ctx, thing } from './state.js';
import * as A from './actions.js';
import { createExperience, createCamera, subject, addPresentation, validateFocus, addView, entryUse, setRole, addStop, moveStop, resolveNext, editSeam, stopEntry, originCoverage, addConnection, addAnchor, resolveUse, viewReach, detachUse, editView, addBeat, connectionReach, addContribution, fresh, reuseView, lowerCamera, addInvocationBeat, clearExperience, setPrimaryExplanation, primaryExplanation, captureUses, captureCapability, captureNew, presentationUses, narrationDuration, narrationPassages, eligibleViews, prepareTravelSupport, renamePresentation, removePresentation, removeContribution, duplicateContribution, makeDefinitionLocal, linkDefinition, renameContribution, rebindContribution, orphanContributions, definitionReachByUse, gripLabels, removeChoice, repointChoice } from './experience-model.js';
export function initExperience() {
  ctx.sceneSource=createSceneCapabilities();
  ctx.experience = createExperience(); ctx.cameraSource = createCamera();
  S.experienceContext = { presentation: null, depth: 'ordinary', stop: null, seam: null };
}
export const resolveExperience = (id) => subject(ctx.experience, ctx.cameraSource, id);
export function command(label, edit) {
  if (S.visitor) return false;
  A.beginEdit();
  try { const result = edit(ctx.experience, ctx.cameraSource); A.commitEdit(label); S.expReview.writes++; ctx.ui(); return result; }
  catch (error) { A.cancelEdit(); throw error; }
}
// The review aid reads what the product actually reported. `review` merges one named outcome; a loader
// names the document's provenance and restarts the authored count, so content that arrived from a loader
// can never be credited as authorship, and an outcome observed on one document is never carried into
// another.
export function review(patch) { S.expReview = { ...S.expReview, ...patch }; return S.expReview; }
// What this session authored is recorded by outcome, never as one global count: a quickstart topic reads the
// outcomes its own instruction produces, so an unrelated edit — renaming a loaded Presentation, say — can
// never qualify a predicate that the loader made true.
export function reviewAuthored(outcome) { const authored={...(S.expReview.authored||{})}; authored[outcome]=(authored[outcome]||0)+1; return review({authored}); }
// An outcome that belongs to one moment rather than to the session is recorded against that Presentation as
// well as in the session's tally: a View an author captures, or an explanation they write, is that moment's,
// and a topic assessing a different moment can never be credited for it. Reset with the document's
// provenance, so framing that arrived from a loader is never counted as the author's own.
export function reviewMoment(pid,outcome){if(!pid)return false;reviewAuthored(outcome);
 const at={...(S.expReview.at||{})};at[pid]=[...new Set([...(at[pid]||[]),outcome])];return review({at});}
export const authoredHere = (outcome) => (S.expReview.authored?.[outcome]||0) > 0;
export const momentAuthored = (pid,outcome) => !!pid&&(S.expReview.at?.[pid]||[]).includes(outcome);
export function reviewSource(source) { return review({ source, writes: 0, authored: {}, at: {}, auditions: 0, previews: 0, peeks: 0, visit: null, visitor: null, scope: null, loss: null, coordination: null }); }
// The ledger a visit opens with. A Guide visit that begins inside its first Stop has already visited it,
// so entry seeds the ledger with where the visit actually is; nothing else is assumed before a command.
// `traversed` is the last transition and `entries` every Stop entry that really ran, so the aid can tell
// a policy the author configured from one a visit executed; `stopped` records the visitor's own Stops.
// `at` is the Stop the visit is standing in: a command and Auto both move a visit, so the ledger follows the
// runtime's own state instead of whichever path arrived there, and the transition it records is the last
// one between two of them.
const emptyVisitorLedger=()=>({stops:[],at:null,traversed:null,travelArrivals:0,entries:[],explored:false,rejoined:false,viewStep:0,activated:[],stopped:[],detoured:false,returned:false,opened:[]});
// What a private visit reported, read from the visitor's own session: the authored work that ran, the
// framing that arrived and the stop it happened on. Never a counter of the authoring side. `completed`
// counts capability work only — an explanation that finished playing is not a finite operation that ran
// to its end — and `handoffs` counts capability runs begun by another capability's completion: a dependent still armed, one
// this Stage could not run, or one the visit disarmed before it ever ran is no handover, and a dependent
// the visitor stopped after it began still is.
function visitOutcome(v) {
  const e = v.source.experience, r = v.runtime, kind = (id) => e.definitions[e.uses[id]?.definitionId]?.kind || null;
  const ran = Object.values(r.activities), dependent = (a) => {const start=e.uses[a.useId]?.start;return kind(a.useId)==='control'&&start?.kind==='after'&&start.signal==='complete'&&kind(start.useId)==='control';};
  return { stop: r.stopId, stops: r.history.length, framing: !!r.arrivedViewUseId, exploring: r.exploring, caption: r.captions && !!R.narrationCaption(e, r), narration: ran.filter((a) => kind(a.useId) === 'narration').length, controls: ran.filter((a) => kind(a.useId) === 'control').length, completed: ran.filter((a) => kind(a.useId) === 'control' && a.status === 'complete').length, handoffs: ran.filter((a) => dependent(a) && a.began).length, invoked: ran.filter((a) => e.uses[a.useId]?.start?.kind === 'station').length };
}
// The Stop entry the author configured, as it is about to run: which policy it is (a Presentation entry,
// one specific View, or an explicit hold), whether that View is a later one rather than the Presentation's
// own entry, and the View it names. `arrived`/`ran` stay false here: a configured policy is never evidence
// that a visit entered it, and only the visit's own runtime reports those two outcomes. `since` is the
// Camera serial the entry was made at, so an arrival only ever counts for the entry that asked for it — two
// Stops naming one shared Presentation entry must never lend each other their arrival.
function entryRecord(e,stopId,r){
 const s=e.stops[stopId];if(!s)return null;
 const own=stopEntry(e,stopId);
 return {stopId,kind:s.entry.kind,later:s.entry.kind==='use'&&own.id!==(entryUse(e,s.presentationId)?.id??null),viewUseId:own.id,hold:!!own.hold,arrived:!own.id,ran:false,since:r?.serial??0};
}
// The Camera's own completed movements, never the request: the View a visit asked for is reached when the
// Camera reports a finished movement to exactly that View — read from the movement that made it, not from
// the last arrival slot, so a cue the destination's own content starts in the same tick cannot hide the
// Travel that just finished, and not from `movement` either, since a later cue being in flight says nothing
// about the arrival that already happened. An entry that names no View asks for no Camera move at all, so
// entering it is its own arrival.
const arrivalFor=(r,useId,since=0)=>!useId?null:(r.arrivals||[]).filter(a=>a.useId===useId&&a.token>=since).pop()||null;
// What the visitor's own session reports about the ledger while it runs. Where the visit is, which Stop
// entry it made and how the Camera's movements ended are all read from the runtime, so a command and Auto
// are one story rather than two: Auto advances through the same tick that a Next does, and a visit the
// visitor never commanded is still a visit whose Stops and entries ran. Arrival is read from completed
// movements rather than at the request, a Travel is counted where the Camera made it, and a hold is credited
// once content ran under it. Reconciling is idempotent: it writes only the facts that actually changed.
export function reconcileVisitor(){
 const v=S.visitor,led=S.expReview.visitor;if(!v||!led)return false;
 const r=v.runtime,e=v.source.experience;let next=led,changed=false;
 // Read the entries where the runtime made them, including every intermediate Auto visit. Camera arrival
 // and held work stay attached to that visit even after later movement or a Return changes the live state.
 const entries=r.entries||[],fresh=entries.slice((led.entries||[]).length),last=fresh[fresh.length-1];
 if(last){next={...next,traversed:{from:last.from,to:last.stopId,dest:last.viewUseId,visit:last.visit,arrived:last.arrived,travel:!!last.travel}};changed=true;}
 else if(r.stopId&&(r.stopId!==led.at)){
  // Return resumes an existing visit; its new framing can arrive without inventing another policy entry.
  const dest=entryRecord(e,r.stopId,r);
  next={...next,traversed:{from:led.at??null,to:r.stopId,dest:dest.viewUseId,arrived:!dest.viewUseId,since:dest.since}};changed=true;
 }
 if((r.stopId??null)!==(led.at??null)){next={...next,at:r.stopId??null};changed=true;}
 const stops=[...new Set([...(next.stops||[]),...entries.map(x=>x.stopId)])];
 if(stops.length!==(next.stops||[]).length){next={...next,stops};changed=true;}
 if(JSON.stringify(entries)!==JSON.stringify(led.entries||[])){next={...next,entries};changed=true;}
 // Every Travel the visit really made, mirrored from the Camera's own count so a Travel that completed
 // between two readings is never lost. Monotonic: a later reading never lowers it.
 const travels=Math.max(next.travelArrivals||0,r.travelArrivals||0);
 if(travels!==(next.travelArrivals||0)){next={...next,travelArrivals:travels};changed=true;}
 const t=next.traversed;
 if(t&&!t.arrived){const arrival=t.visit!==undefined?entries.find(x=>x.visit===t.visit&&x.arrived):arrivalFor(r,t.dest,t.since);
  if(arrival){next={...next,traversed:{...t,arrived:true,travel:!!arrival.travel}};changed=true;}}
 if(changed)review({visitor:next});
 return changed;
}
export function present(focus = null) {
  const f = focus || (S.sel && !resolveExperience(S.sel) ? { kind: 'subjects', ids: [S.sel] } : { kind: 'environment' });
  const label = f.kind === 'subjects' && f.ids.length === 1 ? thing(f.ids[0])?.item?.name : null;
  const id = command('Create Presentation', e => addPresentation(e, f, label || 'Untitled Presentation'));
  if (id) reviewAuthored('presentation');
  // A fresh subject-focused moment suggests Camera framing immediately: derived intent, never an
  // authored View, and Capture is what accepts it.
  const derived = nav.deriveFraming(ctx.experience.presentations[id]);
  if (derived) S.derivedView = { presentation: id, ...derived };
  openPresentation(id); return id;
}
export function openPresentation(id) {
  if (!ctx.experience.presentations[id]) return false;
  A.select(id); S.experienceContext.presentation = id; ctx.ui(); return true;
}
const definitionReach=(e,id)=>Object.values(e.uses).filter(u=>u.definitionId===id).flatMap(u=>{const stops=Object.values(e.stops).filter(s=>s.presentationId===u.presentationId);return stops.length?stops.map(s=>({id:u.id+'@'+s.id,name:`${e.definitions[id]?.name} · Stop ${e.guide.indexOf(s.id)+1}`})):[{id:u.id,name:e.presentations[u.presentationId]?.name||'Experience-wide interaction'}];});
const presentationReach=(e,id)=>Object.values(e.stops).filter(s=>s.presentationId===id).map(s=>({id:s.id,name:`Stop ${e.guide.indexOf(s.id)+1} · ${s.name}`}));
function sourceProposal(label,kind,id,key,value){
 const pid=kind==='definition'?ctx.experience.uses[id]?.definitionId:kind==='presentation'?id:ctx.experience.uses[id]?.presentationId;if(!pid)return false;
 const affected=kind==='definition'?definitionReach(ctx.experience,pid):presentationReach(ctx.experience,pid);S.expSourceAsk={label,kind,id,key,value:structuredClone(value),pid,affected};
 if(affected.length<=1)return acceptSource();ctx.ui();return true;
}
export function updatePresentation(id,key,value){if(!['name','meaning','focus'].includes(key))return false;return sourceProposal(`Edit Presentation ${key}`,'presentation',id,key,value);}
export function acceptSource(){
 const ask=S.expSourceAsk;if(!ask)return false;const affected=ask.kind==='definition'?definitionReach(ctx.experience,ask.pid):presentationReach(ctx.experience,ask.pid);
 if(JSON.stringify(affected)!==JSON.stringify(ask.affected)){ask.affected=affected;ctx.ui();return false;}
 const result=command(ask.label,e=>{if(ask.kind==='definition'){const u=e.uses[ask.id],d=e.definitions[ask.pid];if(!d||u?.definitionId!==ask.pid)throw Error('Contribution removed or rebound');d[ask.key]=ask.key==='markers'?ask.value.map(m=>m.id?m:{...m,id:fresh(e,'phrase')}):ask.value;}else if(ask.kind==='presentation'){const p=e.presentations[ask.id];if(!p)throw Error('Presentation removed');p[ask.key]=ask.value;}else{const u=e.uses[ask.id];if(!u||u.presentationId!==ask.pid)throw Error('View use removed or rebound');if(ask.key==='role')setRole(e,ask.id,ask.value);else u[ask.key]=ask.value;}});S.expSourceAsk=null;ctx.ui();return result;
}
onCancel(()=>{S.expSourceAsk=null;},12,'Shared Experience proposal');
export const updateUse=(id,key,value)=>sourceProposal('Edit shared View '+key,'use',id,key,value);
export function handleExperienceAction(el) {
  const action = el?.dataset?.act;
  if (!action?.startsWith('exp-')) return false;
  // A private visit is read-only for authoring, but the review aid's own navigation is not authoring:
  // Back, Next and Skip move its cursor and never the documents, so they stay usable during Preview.
  if(S.visitor&&!['exp-visitor','exp-exit-preview','exp-presenter','exp-presenter-skip'].includes(action))return true;
  if (action === 'exp-create') present();
  if (action === 'exp-open') openPresentation(el.dataset.id);
  if (action === 'exp-add-guide') addToGuide(el.dataset.id||undefined);
  if (action === 'exp-guide') guideOverview();
  if (action === 'exp-stop') selectStop(el.dataset.id);
  if (action === 'exp-expand-stop') expandStop(el.dataset.id);
  if (action === 'exp-preview-guide') previewGuide();
  if (action === 'exp-preview-experience') previewExperience();
  if (action === 'exp-view-order') suggestViews(el.dataset.id,el.dataset.clear==='true');
  if (action === 'exp-view-order-move') moveSuggestedView(el.dataset.id,Number(el.dataset.delta));
  if (action === 'exp-close') closeExperienceWork();
  if (action === 'exp-move-stop') moveOccurrence(el.dataset.id,Number(el.dataset.delta));
  if (action === 'exp-seam') openSeam(el.dataset.from,el.dataset.to);
  if (action === 'exp-cut') setSeamMode('cut');
  if (action === 'exp-travel') setSeamMode('travel');
  if (action === 'exp-prepare') prepareSeamSupport();
  if (action === 'exp-connect') connectOrigin(el.dataset.id);
  if (action === 'exp-route') editRoute(el.dataset.id);
  if (action === 'exp-route-return') returnRouteReading();
  if(action==='exp-hints'&&autoView()){S.experienceContext.depth='hints';ctx.ui();}
  if (action === 'exp-hint') {const v=ctx.cameraSource.views[S.task?.target?.id];if(v)proposeFraming(el.dataset.key,Number(el.dataset.value));}
  if (action === 'exp-precise') preciseView(el.dataset.id);
  if (action === 'exp-precise-property') {if(!preciseProperty(el.dataset.id,el.dataset.grip))A.setStatus('That property needs a resolving Camera View','refuse');}
  if (action === 'exp-posture') posture(el.dataset.posture);
  if (action === 'exp-grip') {if(S.task?.kind==='experience-camera')S.task.params.grip=el.dataset.grip;ctx.ui();}
  if (action === 'exp-scope-shared') acceptFraming('shared');
  if (action === 'exp-scope-local') acceptFraming('local');
  // A declined proposal is a cancellation like any other: the one pipeline restores the typed draft, so
  // a tape can never keep displaying a value the source does not hold once its Ask is gone.
  // Cancellation is its own observation: accepting a later edit must never erase the fact that a shared
  // proposal was cancelled, so the scope record is merged rather than replaced.
  if (action === 'exp-scope-cancel') { review({scope:{...(S.expReview.scope||{}),cancelled:true}}); cancelProposal('scope-cancel'); }
  if (action === 'exp-rebind-shared') acceptRebind('shared');
  if (action === 'exp-rebind-local') acceptRebind('local');
  if (action === 'exp-rebind-cancel') {S.expRebindAsk=null;cancelProposal('rebind-cancel');}
  // Focusing a station or one of its events records that the author addressed coordination here, and an
  // event-shaped focus also carries the beat identity so the Card and the Stage read that exact event.
  if(action==='exp-station-focus'){if(S.task){S.task.params.station=el.dataset.id;if(el.dataset.beat)S.task.params.beat=el.dataset.beat;else delete S.task.params.beat;review({coordination:{...(S.expReview.coordination||{}),stationSelected:true}});}ctx.ui();}
  if(action==='exp-route-choice'){if(S.task){S.task.params.connection=el.dataset.id;S.task.params.station='departure';}coordinate();}
  if (action === 'exp-coordinate') coordinate();
  if (action === 'exp-mark-station') command('Name Camera station',(e,c)=>{const r=c.connections[S.task.params.connection];r.markers.push({id:fresh(c,'marker'),name:'Mid-route station',progress:.5});});
  // Binding a station moves that Activity's trigger onto the chosen Camera station, so a refused target
  // is an ordinary refusal the author can read — never a page fault and never a silent second trigger.
  if (action === 'exp-invoke-beat') {const s=S.experienceContext.seam;try{command('Invoke Activity at Camera station',(e,c)=>addInvocationBeat(e,c,s.from,s.to,S.task.params.connection,S.task.params.station,S.task.params.invokeUse,ctx.sceneSource));}catch(error){A.setStatus(error.message,'refuse');ctx.ui();}}
  if (action === 'exp-beat') beatAtStation(S.task?.params.station||'departure');
  if (action === 'exp-route-scope') acceptRoutePace();
  if (action === 'exp-narration') addNarration();
  if (action === 'exp-offer') beginOffer(el.dataset.kind||'behavior',el.dataset.id||null);
  if (action === 'exp-offer-accept') acceptOffer();
  if (action === 'exp-offer-cancel') cancelProposal('offer-cancel');
  if (action === 'exp-audition') auditionCapability(el.dataset.id,el.dataset.cap,el.dataset.value==='true');
  if (action === 'exp-audition-clear') clearAudition(el.dataset.id);
  if (action === 'exp-use') useCapability(el.dataset.id,el.dataset.cap);
  if (action === 'exp-use-scope') useCapability(el.dataset.id,el.dataset.cap,'experience');
  if (action === 'exp-capture-choice') chooseCaptureUse(el.dataset.id);
  if (action === 'exp-capture-new') captureAnother();
  if (action === 'exp-capture-cancel') cancelCaptureAsk();
  if (action === 'exp-marker') addMarker(el.dataset.id);
  if (action === 'exp-marker-remove') removeMarker(el.dataset.id,el.dataset.marker);
  if (action === 'exp-passage') addMarker(el.dataset.id,el.dataset.label,Number(el.dataset.time));
  if (action === 'exp-visitor') visitorCommand(el.dataset.command,el.dataset.id);
  if (action === 'exp-remove-stop') command('Remove Guide Stop',e=>{e.guide=e.guide.filter(id=>id!==el.dataset.id);delete e.stops[el.dataset.id];});
  if (action === 'exp-remove-contribution') removeContributionCommand(el.dataset.id);
  // ----- C9.6 revision and repair (J8) -----
  if (action === 'exp-remove-presentation') removePresentationCommand(el.dataset.id);
  if (action === 'exp-duplicate-contribution') duplicateContributionCommand(el.dataset.id);
  if (action === 'exp-make-local') makeLocalCommand(el.dataset.id);
  if (action === 'exp-choice-remove') choiceRemoveCommand(el.dataset.id,el.dataset.choice);
  if (action === 'exp-select-orphan') { A.select(el.dataset.id); ctx.ui(); }
  if (action === 'exp-reset') resetExperience();
  if (action === 'exp-conformance') loadConformance();
  if (action === 'exp-example') loadExample();
  // Next is earned: it advances only when the current topic's own outcome holds. Skip stays the
  // deliberate way to move on without claiming the topic was observed.
  if (action === 'exp-presenter') {const d=Number(el.dataset.delta);if(d>0){if(!presenterNext())A.setStatus('Complete this topic, or Skip it','refuse');}else presenterStep(d);}
  if (action === 'exp-presenter-skip') presenterSkip();
  if (action === 'exp-resume') resumeExperience();
  if (action === 'exp-dismiss-parked') {S.parkedByLens.experience=null;ctx.ui();}
  if (action === 'exp-capture') captureView();
  if (action === 'exp-auto') autoView();
  if (action === 'exp-role') changeRole(el.dataset.id,el.dataset.role);
  if(action==='exp-derived-hint')derivedHint(el.dataset.hint);
  if(action==='exp-bring')bringIntoView();
  if(action==='exp-source-accept')acceptSource();  if (action === 'exp-source-cancel') cancelProposal('source-cancel');
  if(action==='exp-camera-return'){nav.putBack();if(S.task)S.task.params.posture=nav.readingFor(cameraSnapshot().views[S.task.target.id]);ctx.ui();}
  if(action==='exp-route-cancel')cancelProposal('route-cancel');
  if (action === 'exp-preview') preview(el.dataset.id || undefined);
  if (action === 'exp-exit-preview') exitPreview();
  if (action === 'exp-region') { cancelProposal('invoke'); T.begin({kind:'experience-region',subject:S.sel,params:{first:null}}); A.setStatus('Choose two corners on the Stage to present a region'); }
  if (action === 'exp-environment') present({ kind: 'environment' });
  return true;
}
export function presentationValid(id) { const p = ctx.experience.presentations[id]; return !!p && validateFocus(p, id => !!A.worldOf(id)); }

export function captureView(pid=S.experienceContext.presentation){
 const p=ctx.experience.presentations[pid];if(!p)return false;
 const derived=S.derivedView?.presentation===pid?nav.deriveFraming(p,S.task?.params.hints||[]):null;
 const result=command('Capture Camera View',(e,c)=>{const id=addView(e,c,pid,derived?.pose||nav.plainPose(),derived?.name||(entryUse(e,pid)?'Captured perspective':'Entry framing'),entryUse(e,pid)?'choice':'entry');const v=c.views[e.uses[id].viewId];v.focusAt=e.presentations[pid].focus.kind==='subjects'?A.worldOf(e.presentations[pid].focus.ids[0]):null;return id;});S.derivedView=null;if(S.task?.kind==='experience-hints'){T.end();S.experienceContext.depth='ordinary';}
 // Accepting a framing is the outcome the explanation topic pairs with: the capture authors a View this
 // Presentation now carries, which is exactly what a loader-provided framing can never claim — and it is
 // recorded against this moment, so a Capture on another Presentation is never this one's framing.
 if(result)reviewMoment(pid,'framing');
 ctx.ui();return result;
}
export function autoView(pid=S.experienceContext.presentation){
 const p=ctx.experience.presentations[pid];if(!p)return false;const derived=nav.deriveFraming(p);if(!derived){A.setStatus('Focus unresolved · repair before framing','refuse');return false;}
 cancelProposal('invoke');T.begin({kind:'experience-hints',subject:S.sel,target:{id:pid},params:{hints:[]}});S.derivedView={presentation:pid,...derived};ctx.ui();return true;
}
export function derivedHint(label){if(!S.derivedView)autoView();if(!S.task||!S.derivedView)return false;S.task.params.hints.push(label);const p=ctx.experience.presentations[S.derivedView.presentation];S.derivedView={presentation:p.id,...nav.deriveFraming(p,S.task.params.hints)};ctx.ui();return true;}
export function bringIntoView(){const c=cameraSnapshot(),e=ctx.experience,x=S.experienceContext;let points=[];
 if(x.seam){for(const row of originCoverage(e,c,x.seam.from,x.seam.to)){for(const id of [row.viewId,row.targetId])if(c.views[id])points.push(nav.eye(c.views[id].pose),c.views[id].pose.target);const r=nav.routeGeometry(c,row.connectionId);if(r)points.push(...r.samples.map(s=>s.observer));}}
 else if(x.depth==='overview'){points=e.guide.map(id=>resolveUse(e,c,stopEntry(e,id).id)?.view?.pose.target).filter(Boolean);}
 else{const p=e.presentations[x.presentation];points=(p?.uses||[]).flatMap(id=>{const v=c.views[e.uses[id]?.viewId];return v?[nav.eye(v.pose),v.pose.target]:[];});if(S.derivedView)points.push(nav.eye(S.derivedView.pose),S.derivedView.pose.target);if(!points.length&&p?.focus.kind==='subjects')points=p.focus.ids.map(A.worldOf).filter(Boolean);}
 return nav.framePoints(points,{plan:nav.plainPose().el>1.4||!!x.seam});
}
export const changeRole=(id,role)=>updateUse(id,'role',role);
export function preview(pid=S.experienceContext.presentation,guide=false,experience=false) {
 // Three entries, one runtime: Preview this Presentation, Preview Guide, and Preview Experience — the
 // world-only session that needs no Presentation, Stop or Guide at all (I3/J6). The Experience entry
 // refuses only when there is genuinely nothing to visit: no Experience-wide offer to participate in.
 const wide=Object.values(ctx.experience.uses).some(u=>u.kind==='interaction'&&!u.availability);
 if(S.visitor || (!guide&&!experience&&!ctx.experience.presentations[pid]) || (guide&&!ctx.experience.guide.length) || (experience&&!wide)) return false;
 cancelProposal('preview');
 const token={lens:S.lens,sel:S.sel,context:structuredClone(S.experienceContext),origin:nav.captureOrigin('Preview return'),inspection:A.captureInspection(),expand:S.expand,sheet:{...S.sheet},browse:{...S.browse},representation:captureRepresentation()};
 // Suspend authoring without writing source or passing through lens parking. Auditions are cleared
 // before entry: the visit sees authored source, never an authoring projection.
 T.park();
 nav.releaseHold();
 S.expAudition=null;
 S.visitorChoice=null;S.visitorPress=null;S.visitorDrag=null;
 S.visitor={returnToken:token,source:structuredClone({experience:ctx.experience,camera:cameraSnapshot(),scene:ctx.sceneSource}),runtime:createRuntime(ctx.experience,cameraSnapshot(),guide||experience?null:pid,nav.plainPose(),ctx.sceneSource)};
 S.visitorChoice=null;S.visitorPress=null;S.visitorDrag=null;  if(guide)S.visitor.runtime=R.startGuide(S.visitor.source.experience,S.visitor.source.camera,S.visitor.runtime,S.visitor.source.scene);
  // A visit starts with a clean ledger: what the previous visit did is evidence about another document. A
  // Guide visit that enters its first Stop has already visited it, so the ledger opens with that Stop — and
  // with the entry policy the runtime actually ran there — instead of recording only what a later command
  // reaches. Whether the Camera arrived at that entry's View, and whether content ran under a hold, are read
  // from the visit as it runs, never assumed at the moment of entry.
  const entered=S.visitor.runtime.stopId,entries=S.visitor.runtime.entries;
  review({visit:null,visitor:entered?{...emptyVisitorLedger(),stops:[entered],at:entered,entries}:null});
  reconcileVisitor();
 nav.applyPose(S.visitor.runtime.pose);ctx.ui();return true;
}
export async function exitPreview() {
 const v=S.visitor;if(!v)return false;
 S.visitor=null;S.visitorDrag=null;S.visitorPress=null;S.visitorChoice=null;const t=v.returnToken;
 S.lens=t.lens;S.sel=t.sel;S.experienceContext=t.context;S.expand=t.expand;S.sheet=t.sheet;S.browse=t.browse;
 await A.restoreInspection(t.inspection);nav.restoreCapture(t.origin);
 // A transient Layout representation invoked during the visit is not authored state: the author's own
 // reading is put back, exactly as the Lens/Presentation/Camera contexts are.
 restoreRepresentation(t.representation);
 if(S.task?.kind==='experience-hints'){const p=ctx.experience.presentations[S.task.target.id];S.derivedView=p?{presentation:p.id,...nav.deriveFraming(p,S.task.params.hints)}:null;}
 review({visit:visitOutcome(v),previews:(S.expReview.previews||0)+1,visitor:S.expReview.visitor});
 ctx.ui();return true;
}
let runtimeAt=0;
export function visitorFrame(now) {
 if(!S.visitor) {runtimeAt=now;return;}
 const v=S.visitor,dt=Math.min(.25,Math.max(0,(now-runtimeAt)/1000));runtimeAt=now;
 v.runtime=tickRuntime(v.source.experience,v.source.camera,v.runtime,dt,v.source.scene);
 // The visit's own frame is where an arrival becomes the ledger's: the Camera reaches the View it was
 // travelling to between commands, so waiting for the next command would never record it.
 reconcileVisitor();
 if(now-(v.uiAt||0)>160){v.uiAt=now;ctx.ui();}
 if(!v.runtime.exploring)nav.applyPose(v.runtime.pose);
}

export function regionPoint(p) {
 if(S.task?.kind!=='experience-region') return false;
 if(!S.task.params.first) { S.task.params.first=[p.x,0,p.z];A.setStatus('Choose the opposite corner'); }
 else { const first=S.task.params.first,second=[p.x,3,p.z];T.end();present({kind:'region',min:first.map((n,i)=>Math.min(n,second[i])),max:first.map((n,i)=>Math.max(n,second[i]))}); }
 ctx.ui();return true;
}

export function previewGuide(){return preview(null,true);}
export function previewExperience(){return preview(null,false,true);}
export function selectStop(id){
 const stop=ctx.experience.stops[id];if(!stop)return false;
 // Selecting a Stop is the Peek the quickstart asks for: awareness of the occurrence, recorded where it
 // actually happens rather than only when the occurrence's own work is expanded.
 review({peeks:(S.expReview.peeks||0)+1});
 cancelProposal('selection');A.select(id);
 const x=S.experienceContext;
 // Selecting a Stop ends any writer or procedure that belonged to the previous context: an old route
 // writer must not stay armed behind the new selection. Peek is awareness, not disclosure, so the
 // context normalizes to the same Peek-level reading; the realized viewpoint is preserved.
 const procedure=['occurrence','seam','route','coordination','precision','hints'].includes(x.depth);
 if(procedure){S.derivedView=null;T.end();}
 const depth=procedure?'overview':x.depth;
 S.experienceContext={...x,depth,stop:null,presentation:stop.presentationId,seam:null};
 if(depth==='overview')T.begin({kind:'experience-overview',subject:id,params:{}});
 ctx.ui();return true;
}
export function suggestViews(pid,clear=false){return command(clear?'Free View choice':'Suggest a View order',e=>{const p=e.presentations[pid];if(!p)throw Error('Presentation removed');if(clear)delete p.viewOrder;else p.viewOrder=eligibleViews(e,pid);});}
export function moveSuggestedView(uid,delta){return command('Reorder suggested Views',e=>{const p=e.presentations[e.uses[uid]?.presentationId],ids=p?.viewOrder;if(!ids)return;const at=ids.indexOf(uid),to=at+delta;if(at>=0&&to>=0&&to<ids.length)[ids[at],ids[to]]=[ids[to],ids[at]];});}
export function addToGuide(pid=S.experienceContext.presentation) {const id=command('Add Presentation to Guide',e=>addStop(e,pid));if(id)reviewAuthored('guide');return id;}
export function guideOverview() {cancelProposal('invoke');S.experienceContext.depth='overview';S.experienceContext.stop=null;T.begin({kind:'experience-overview',subject:S.sel,params:{}});ctx.ui();}
export function expandStop(id) {
  // A Peek is awareness, not work: the review aid records that it happened, never that it wrote anything.
  review({ peeks: (S.expReview.peeks || 0) + 1 });
 const stop=ctx.experience.stops[id];if(!stop)return false;
 cancelProposal('invoke');A.select(id);S.experienceContext={...S.experienceContext,depth:'occurrence',stop:id,presentation:stop.presentationId,seam:null};
 T.begin({kind:'experience-occurrence',subject:id,target:{id},params:{stop:id}});ctx.ui();return true;
}
export function closeExperienceWork() {cancelProposal('task-end');S.derivedView=null;T.end();S.experienceContext.depth='ordinary';S.experienceContext.stop=null;S.experienceContext.seam=null;ctx.ui();}
export function moveOccurrence(id,delta) {return command('Reorder Guide Stop',e=>moveStop(e,id,delta));}

export function openSeam(a,b) {
 if(resolveNext(ctx.experience,a).id!==b)return false;
 cancelProposal('invoke');S.experienceContext.depth='seam';S.experienceContext.seam={from:a,to:b};S.experienceContext.stop=null;
 T.begin({kind:'experience-seam',subject:S.sel,target:{id:b},params:{from:a,to:b,originUse:null,connection:null}});if(ctx.experience.seams[`${a}>${b}`]?.beats.length)coordinate();ctx.ui();return true;
}
// N1 — choosing Travel is one explicit aggregate transaction: it prepares exactly the missing direct
// Camera support for every legitimate origin of this Seam and selects Travel. Camera creates and owns
// the routes; the report names prepared versus reused support. Selecting Cut never creates connectivity.
export function setSeamMode(mode) {
 const {from,to}=S.experienceContext.seam;let report=null;
 try{
  const result=command(mode==='travel'?'Prepare Camera routes and select Travel':'Set Seam transition',(e,c)=>{if(mode==='travel')report=prepareTravelSupport(e,c,from,to);editSeam(e,from,to,{mode});return report;});
  if(mode==='travel')A.setStatus(supportReport(report),report?.gaps.length?'refuse':'edit');
  return result;
 }catch(error){A.setStatus(error.message,'refuse');ctx.ui();return false;}
}
// The explicit repair for a Seam that gained a legitimate origin after Travel was chosen: one action
// prepares exactly the missing direct routes and reuses the rest. Nothing here runs automatically when
// a View is added, an entry changes or a Preview starts.
export function prepareSeamSupport() {
 const seam=S.experienceContext.seam;if(!seam)return false;let report=null;
 try{
  const result=command('Prepare missing Camera routes',(e,c)=>{report=prepareTravelSupport(e,c,seam.from,seam.to);return report;});
  A.setStatus(supportReport(report),report?.gaps.length?'refuse':'edit');ctx.ui();return result;
 }catch(error){A.setStatus(error.message,'refuse');ctx.ui();return false;}
}
// Prepared versus reused support, with the owner named: an explicit transaction a reviewer can read.
function supportReport(report){
 if(!report)return 'No Seam selected';
 const parts=[];
 if(report.prepared.length)parts.push(`Prepared ${report.prepared.length} Camera route${report.prepared.length===1?'':'s'}`);
 if(report.reused.length)parts.push(`reused ${report.reused.length} existing`);
 if(report.direct.length)parts.push(`${report.direct.length} already at the same View`);
 if(report.gaps.length)parts.push(`${report.gaps.length} origin${report.gaps.length===1?'':'s'} need repair`);
 return `${parts.length?parts.join(' · '):'All origins already supported'} · Camera owns route geometry`;
}
export function connectOrigin(uid) {
 const {from,to}=S.experienceContext.seam;
 const row=originCoverage(ctx.experience,ctx.cameraSource,from,to).find(r=>r.useId===uid);
 if(!row||row.missing){A.setStatus('Route needs a resolving origin and destination entry View','refuse');return false;}
 const id=command('Connect Camera Views',(e,c)=>addConnection(c,row.viewId,row.targetId));
 S.task.params.originUse=uid;S.task.params.connection=id;ctx.ui();return id;
}
export async function editRoute(id) {
 const route=ctx.cameraSource.connections[id];if(!route)return false;
 cancelProposal('invoke');
 const epoch=nav.travelEpoch();
 nav.beginReturn('Return to Seam reading');
 S.experienceContext.depth='route';S.task.params.connection=id;
 await bringIntoView();if(epoch!==nav.travelEpoch())return false;review({routeWrite:{...S.expReview.routeWrite,edited:true}});ctx.ui();return true;
}
export function returnRouteReading(){nav.putBack();S.experienceContext.depth='seam';review({routeWrite:{...S.expReview.routeWrite,returned:true}});ctx.ui();}
function routeProposal(id,patch,label){
 const route=ctx.cameraSource.connections[id];if(!route)return false;
 // A proposal is only ever made by the writer the context currently holds: a stale route selection
 // cannot be edited through a later gesture, while a drawn reachable route stays editable.
 if(!['experience-seam','experience-coordination'].includes(S.task?.kind)||!S.task?.params?.connection)return false;
 const affected=connectionReach(ctx.experience,ctx.cameraSource,id);S.expRouteAsk={id,patch,label,affected};
 if(affected.length<=1)return acceptRoutePace();ctx.ui();return true;
}
export function routePoint(p){
 const x=S.experienceContext,t=S.task,id=t?.params?.connection;
 if(!['route','coordination'].includes(x.depth)||!x.seam||!id)return false;
 if(!['experience-seam','experience-coordination'].includes(t.kind))return false;
 if(!ctx.cameraSource.connections[id])return false;
 const position=[p.x,1.5,p.z];
 return routeProposal(id,{addAnchor:position},'Add Camera interior anchor');
}
export function beginAnchorDrag(event){
 const el=event.target.closest('[data-exp-anchor]');if(!el||S.visitor)return false;event.preventDefault();event.stopPropagation();cancelProposal('gesture');
 const a=ctx.cameraSource.connections[el.dataset.connection]?.anchors.find(a=>a.id===el.dataset.expAnchor);if(!a)return false;
 S.expDrag={connection:el.dataset.connection,anchor:a.id,position:[...a.position],base:[...a.position],moved:false};S.anchorFocus={connection:el.dataset.connection,anchor:a.id};el.setPointerCapture(event.pointerId);return true;
}
export function moveAnchorDrag(p){const d=S.expDrag;if(!d)return false;d.position=[p.x,d.base[1],p.z];d.moved=d.position.some((n,i)=>Math.abs(n-d.base[i])>.01);ctx.ui();return true;}
export function endAnchorDrag(){const d=S.expDrag;if(!d)return false;S.expDrag=null;if(d.moved)routeProposal(d.connection,{anchor:d.anchor,position:d.position},'Move Camera interior anchor');ctx.ui();return true;}
export function nudgeAnchor(id,anchor,dx,dz){const a=ctx.cameraSource.connections[id]?.anchors.find(a=>a.id===anchor);if(!a)return false;return routeProposal(id,{anchor,position:[a.position[0]+dx,a.position[1],a.position[2]+dz]},'Move Camera interior anchor');}
onCancel(()=>{S.expDrag=null;},5,'Experience pointer');

export function preciseView(uid) {
 const resolved=resolveUse(ctx.experience,ctx.cameraSource,uid);if(!resolved)return false;
 cancelProposal('invoke');A.select(uid);S.experienceContext={...S.experienceContext,depth:'precision',presentation:resolved.use.presentationId};
 nav.beginReturn('Before precise Camera');
 T.begin({kind:'experience-camera',subject:uid,target:{id:resolved.view.id},params:{useId:uid,posture:'outside',grip:'frameH'}});ctx.ui();return true;
}
// A Camera Card property is deliberate depth, not a second manipulation system: it opens the same
// Precision task on the same View and selects the grip the author asked for. The Stage's own grip chips
// stay the direct path, and the value is still written once, on its one tape.
export function preciseProperty(uid,grip){ if(!(grip in gripLabels))return false;
 const resolved=resolveUse(ctx.experience,ctx.cameraSource,uid);
 const same=S.task?.kind==='experience-camera'&&S.task.params.useId===uid&&!!resolved&&S.task.target?.id===resolved.view.id;
 // Switching the addressed property within the same View is not a new entry: the return position taken
 // when Precision began is kept, so Put it back returns where the author actually started.
 if(same){S.task.params.grip=grip;ctx.ui();return true;}
 if(!preciseView(uid))return false; S.task.params.grip=grip;ctx.ui();return true; }
export async function posture(which){
 if(S.task?.kind!=='experience-camera')return false;const v=cameraSnapshot().views[S.task.target.id];if(!v)return false;
 cancelProposal('posture');
 if(which==='through')nav.lookThrough(v.pose);
 else if(which==='plan')await nav.framePoints([nav.eye(v.pose),v.pose.target],{plan:true,captureReturn:false});
 else if(which==='outside')await nav.framePoints([nav.eye(v.pose),v.pose.target,...nav.framingInstrument(v.pose).corners],{captureReturn:false});
 if(S.task?.kind==='experience-camera')S.task.params.posture=nav.readingFor(v);ctx.ui();return true;
}
export function proposeFraming(key,value) {
 const t=S.task;if(t?.kind!=='experience-camera')return false;
 const v=cameraSnapshot().views[t.target.id];if(!v)return false;
 const n=Number(value);if(!Number.isFinite(n)){A.setStatus('Use a finite Camera value','refuse');return false;}
 let patch={[key]:n};if(['x','y','z'].includes(key)){const target=[...v.pose.target];target[['x','y','z'].indexOf(key)]=n;patch={target};}
 return proposePatch(patch);
}
export function proposePatch(patch) {
 const t=S.task,v=ctx.cameraSource.views[t?.target?.id];if(!v)return false;
 try{editView({views:{[v.id]:structuredClone(v)}},v.id,patch);}catch(error){S.expAsk=null;A.setStatus(error.message,'refuse');ctx.ui();return false;}
 const reach=viewReach(ctx.experience,v.id);
 S.expAsk={viewId:v.id,useId:t.params.useId,stopId:S.experienceContext.stop,patch,reach};
 if(reach.uses.length<=1&&reach.stops.length<=1)acceptFraming('shared');else ctx.ui();return true;
}
export function acceptFraming(scope) {
 const ask=S.expAsk;if(!ask)return false;
 const reach=viewReach(ctx.experience,ask.viewId);if(JSON.stringify(reach)!==JSON.stringify(ask.reach)){ask.reach=reach;ctx.ui();return false;}
 const label=scope==='shared'?'Update shared Camera framing':'Detach and retarget local Camera framing';
 const result=command(label,(e,c)=>{
  const resolved=resolveUse(e,c,ask.useId);if(!resolved||resolved.view.id!==ask.viewId)throw Error('Framing removed or rebound');
  let vid=ask.viewId,uid=ask.useId;
  if(scope==='local'){uid=detachUse(e,c,uid,ask.stopId);vid=e.uses[uid].viewId;}
  editView(c,vid,ask.patch);return {uid,vid};
 });
 S.expAsk=null;
 // Cancellation, acceptance and Undo are separate observations: the accepted edit records its own
 // history label so its Undo is observed later, and the earlier cancellation is never overwritten.
 review({scope:{...(S.expReview.scope||{}),kind:scope,accepted:true,viewId:ask.viewId,stops:reach.stops.length,uses:reach.uses.length,label}});
 if(S.task?.kind==='experience-camera'){S.task.target.id=result.vid;S.task.params.useId=result.uid;if(S.sel===ask.useId&&result.uid!==ask.useId){S.sel=result.uid;S.task.subject=result.uid;}if(S.task.params.posture==='through')nav.lookThrough(cameraSnapshot().views[result.vid].pose);}
 ctx.ui();return result;
}
onCancel(()=>{S.expAsk=null;},12,'Experience scope proposal');
onCancel(reason=>{if(['preview','lens','reset','task-end','invoke'].includes(reason))S.derivedView=null;},13,'Derived framing suspension');

export function beginCameraDrag(event) {
 const el=event.target.closest('[data-exp-camera]');if(!el||S.task?.kind!=='experience-camera')return false;
 event.preventDefault();event.stopPropagation();cancelProposal('gesture');
 const v=cameraSnapshot().views[S.task.target.id];if(!v)return false;
 S.cameraDraft={pose:structuredClone(v.pose),base:structuredClone(v.pose),grip:S.task.params.grip,origin:nav.captureOrigin('Before Camera gesture'),through:nav.readingFor(v)==='through',x:event.clientX,y:event.clientY};
 el.setPointerCapture(event.pointerId);return true;
}
export function moveCameraDrag(event,point) {
 const d=S.cameraDraft;if(!d)return false;
 if(['x','y','z'].includes(d.grip)&&point) {const index=['x','y','z'].indexOf(d.grip);d.pose.target[index]=d.grip==='y'?d.base.target[1]-(event.clientY-d.y)*.025:d.grip==='x'?point.x:point.z;}
 else if(d.grip==='frameH')d.pose.frameH=Math.max(.2,d.base.frameH+(event.clientY-d.y)*.04);
 else d.pose[d.grip]=d.base[d.grip]+(d.grip==='el'?-(event.clientY-d.y):(event.clientX-d.x))*.008;
 if(d.through)nav.applyPose(d.pose);ctx.ui();return true;
}
export function endCameraDrag() {const d=S.cameraDraft;if(!d)return false;nav.restoreCapture(d.origin);S.cameraDraft=null;proposePatch(d.pose);return true;}
onCancel(()=>{if(S.cameraDraft?.origin)nav.restoreCapture(S.cameraDraft.origin);S.cameraDraft=null;},5,'Camera framing gesture');

export function coordinate(){
 const x=S.experienceContext,s=x.seam;if(!s||!S.task)return false;
 const seam=ctx.experience.seams[`${s.from}>${s.to}`];if(!seam||seam.mode!=='travel'){A.setStatus('Coordinate needs Travel on a supported Camera route','refuse');return false;}
 const ids=[...new Set(originCoverage(ctx.experience,cameraSnapshot(),s.from,s.to).filter(r=>!r.missing).map(r=>r.connectionId).filter(Boolean))];
 if(S.task.params.connection&&!ids.includes(S.task.params.connection))S.task.params.connection=null;
 if(!S.task.params.connection){const used=[...new Set(seam.beats.map(b=>b.connectionId).filter(id=>ids.includes(id)))];if(used.length===1)S.task.params.connection=used[0];else if(ids.length===1)S.task.params.connection=ids[0];else {x.depth='coordination';S.task.kind='experience-coordination';S.task.params.chooseRoute=true;ctx.ui();return true;}}
 if(!S.task.params.connection){A.setStatus('Connect a Camera route before coordinating','refuse');return false;}
 x.depth='coordination';S.task.kind='experience-coordination';S.task.params.chooseRoute=false;
 const route=ctx.cameraSource.connections[S.task.params.connection];if(!nav.stations(route).some(s=>s.id===S.task.params.station))S.task.params.station='departure';ctx.ui();return true;
}
export function beatAtStation(stationId,seconds=1) {
 const {from,to}=S.experienceContext.seam;return command('Add station-bound Experience hold',(e,c)=>addBeat(e,c,from,to,S.task.params.connection,stationId,seconds));
}
export function routePace(speed){const id=S.task?.params.connection;if(!id||!['slow','auto','fast'].includes(speed))return false;return routeProposal(id,{speed},'Set Camera route pace');}
export function acceptRoutePace(){
 const ask=S.expRouteAsk;if(!ask)return false;const affected=connectionReach(ctx.experience,ctx.cameraSource,ask.id);
 if(JSON.stringify(affected)!==JSON.stringify(ask.affected)){ask.affected=affected;ctx.ui();return false;}
 command(ask.label,(e,c)=>{const route=c.connections[ask.id];if(!route)throw Error('Route removed');if(ask.patch.speed)route.speed=ask.patch.speed;if(ask.patch.addAnchor)addAnchor(c,ask.id,ask.patch.addAnchor);if(ask.patch.anchor){const a=route.anchors.find(a=>a.id===ask.patch.anchor);if(!a)throw Error('Anchor removed');a.position=[...ask.patch.position];}});S.expRouteAsk=null;ctx.ui();return true;
}
onCancel(()=>{S.expRouteAsk=null;},12,'Camera route pace proposal');

export function addNarration(pid=S.experienceContext.presentation) {
 return command('Add narration',e=>addContribution(e,pid,{kind:'narration',name:'Narration',text:e.presentations[pid]?.meaning||'An explanation of this place.',markers:[]},'narration'));
}
export const editDefinition=(uid,key,value)=>sourceProposal('Edit shared contribution','definition',uid,key,value);
export function addMarker(uid,label='Named phrase',time=null) {
 const d=ctx.experience.definitions[ctx.experience.uses[uid]?.definitionId];if(d?.kind!=='narration')return false;
 return sourceProposal('Add shared narration phrase','definition',uid,'markers',[...d.markers,{label,time:time??narrationDuration(d)/2}]);
}
export function removeMarker(uid,id){const d=ctx.experience.definitions[ctx.experience.uses[uid]?.definitionId];if(d?.kind!=='narration')return false;return sourceProposal('Remove narration phrase','definition',uid,'markers',d.markers.filter(m=>m.id!==id));}
export function updateMarker(uid,id,key,value){const d=ctx.experience.definitions[ctx.experience.uses[uid]?.definitionId];if(d?.kind!=='narration')return false;if(key==='time'&&(!Number.isFinite(value)||value<0))return false;return sourceProposal('Edit narration phrase','definition',uid,'markers',d.markers.map(m=>m.id===id?{...m,[key]:value}:m));}
export function updateActivity(uid,key,value){return command('Edit Activity '+key,e=>{const u=e.uses[uid];if(!u||u.viewId)throw Error('Activity removed');u[key]=structuredClone(value);});}
export function updateStop(id,key,value){return command('Edit this Stop '+key,e=>{const s=e.stops[id];if(!s)throw Error('Stop removed');s[key]=structuredClone(value);});}
export function updateViewSpeed(uid,speed){if(!['cut','slow','auto','fast'].includes(speed))return false;return command('Set Camera View movement',(e,c)=>{const v=c.views[e.uses[uid]?.viewId||uid];if(!v)throw Error('View removed');v.speed=speed;});}export function beginOffer(kind='behavior', subjectId=null) {
  const p=ctx.experience.presentations[S.experienceContext.presentation];
  const subject=subjectId&&ctx.sceneSource.subjects[subjectId]?subjectId:p?.focus.kind==='subjects'&&ctx.sceneSource.subjects[p.focus.ids[0]]?p.focus.ids[0]:'machine';
  // I4: availability is independent of organization — the offer is homed in the Presentation being
  // edited, but it is available Experience-wide until the author says otherwise.
  // The draft opens on a capability this Stage actually realizes, so the offer never starts on declared
  // work the visitor could not run.
  S.expOfferDraft={kind,subjectId:subject,trigger:subject,capabilityId:capabilities(ctx.sceneSource,subject).find(isRealized)?.id,value:true,availability:null};ctx.ui();
}
export function acceptOffer() {
 const draft=S.expOfferDraft;if(!draft)return false;const cap=capability(ctx.sceneSource,draft.subjectId,draft.capabilityId);
 if(!cap){A.setStatus('Choose a capability this subject declares','refuse');ctx.ui();return false;}
 if(!isRealized(cap)){A.setStatus(`${cap.label} · declared by the provider but not realized by this Stage`,'refuse');ctx.ui();return false;}
 const value=cap.control==='range'?Number(draft.value):draft.value===true||draft.value==='true';
 if(cap.control==='range'&&(!Number.isFinite(value)||value<cap.min||value>cap.max)){A.setStatus(`Use a value between ${cap.min} and ${cap.max}`,'refuse');return false;}
 // The authored availability is written inside the same aggregate edit as the offer itself, so the
 // default and an explicit contextual choice are each one ordinary Undo step.
 const id=command('Add '+draft.kind,e=>{const uid=addContribution(e,S.experienceContext.presentation,{kind:'control',name:cap.label,subjectId:draft.subjectId,capabilityId:cap.id,value},draft.kind,draft.trigger);const u=e.uses[uid];if(u&&draft.kind==='interaction')u.availability=draft.availability||null;return uid;});
 S.expOfferDraft=null;ctx.ui();return id;
}
export function changeOfferField(key,value){if(!S.expOfferDraft)return;if(key==='availability'){S.expOfferDraft.availability=value||null;ctx.ui();return;}S.expOfferDraft[key]=value;if(key==='subjectId'){const cap=capabilities(ctx.sceneSource,value).find(isRealized);S.expOfferDraft.capabilityId=cap?.id;S.expOfferDraft.value=cap?.control==='range'?cap.max:true;}ctx.ui();}

// ----- subject-local capability auditions and capture ---------------------

// The audition projects a supported value on the real Stage without touching Scene source, Experience
// source or Undo. It is the donor's "operate the subject" step, kept distinct from authored Activity.
export function auditionedValue(sid,cap){
  const s=ctx.sceneSource.subjects[sid];if(!s)return null;
  const held=S.expAudition?.[sid]?.[cap.channel];return held===undefined?s.properties[cap.channel]:held;
}
export function auditionCapability(sid,cid,value,quiet=false){
  const scene=ctx.sceneSource,cap=capability(scene,sid,cid),s=scene.subjects[sid];
  if(!cap||!s)return false;
  // A capability the provider declares but this Stage does not realize is reported as unrealized rather
  // than projected as if operating it had changed anything.
  if(cap.realized===false){A.setStatus(`${cap.label} · declared by the provider but not realized by this Stage`,'refuse');ctx.ui();return false;}
  const v=cap.control==='range'?Number(value):(value===true||value==='true');
  if(cap.control==='range'&&(!Number.isFinite(v)||v<cap.min||v>cap.max)){A.setStatus(`Use a value between ${cap.min} and ${cap.max}`,'refuse');ctx.ui();return false;}
  (S.expAudition??={})[sid]??={};S.expAudition[sid][cap.channel]=v;
  if(!quiet){review({auditions:(S.expReview.auditions||0)+1});A.setStatus(`${cap.label} · audition only — source and history untouched`,'view');ctx.ui();}
  return true;
}
export function clearAudition(sid){if(!S.expAudition||!(sid in S.expAudition))return false;delete S.expAudition[sid];ctx.ui();return true;}
// The explanation is the outcome Q2 names: its own accepted text is what the aid records as authored here,
// so a cleared field or a merely re-committed value never counts as writing one.
export function explainPresentation(pid,text){const result=command('Edit explanation',e=>setPrimaryExplanation(e,pid,text));if(result&&String(text??'').trim())reviewMoment(pid,'explanation');return result;}
// Use in Experience: one uniquely matching captured use is updated in place; no match captures a new
// Activity; several matches require a choice and never mutate the first enumerated one. Ambiguity is
// decided before any command, so a refused choice never leaves an empty history step behind.
export function useCapability(sid,cid,scope='presentation'){
  const cap=capability(ctx.sceneSource,sid,cid);if(!cap)return false;
  // A capability this Stage does not realize is never captured as Activity either: the same eligibility the
  // audition reports governs the descriptor a visitor would later run.
  if(!isRealized(cap)){A.setStatus(`${cap.label} · declared by the provider but not realized by this Stage`,'refuse');ctx.ui();return false;}
  const pid=scope==='experience'?null:S.experienceContext.presentation;
  if(scope!=='experience'&&!pid){A.setStatus('Open a Presentation first, or capture explicitly at Experience scope','refuse');ctx.ui();return false;}
  const value=auditionedValue(sid,cap);
  const matches=captureUses(ctx.experience,pid,sid,cid);
  if(matches.length>1){S.expCaptureAsk={sid,cid,pid,value,matches:matches.map(u=>u.id)};ctx.ui();return false;}
  const result=command(`${cap.label} · ${scope==='experience'?'use at Experience scope':'use in this Presentation'}`,e=>captureCapability(e,pid,sid,cid,value,cap.label));
  if(result)reviewAuthored('capture');
  S.expCaptureAsk=null;ctx.ui();return result;
}
export function chooseCaptureUse(uid){
  const ask=S.expCaptureAsk;if(!ask||!ask.matches.includes(uid))return false;
  const cap=capability(ctx.sceneSource,ask.sid,ask.cid);
  const result=command('Update captured '+((cap?.label)||'capability'),e=>{const u=e.uses[uid];if(!u||!ask.matches.includes(uid))throw Error('Captured use changed');const d=e.definitions[u.definitionId];if(!d)throw Error('Captured definition missing');d.value=ask.value;return{id:uid,updated:true};});
  if(result)reviewAuthored('capture');
  S.expCaptureAsk=null;ctx.ui();return result;
}
export function captureAnother(){
 const ask=S.expCaptureAsk;if(!ask)return false;
 const cap=capability(ctx.sceneSource,ask.sid,ask.cid);
 // Choosing "another" must never be refused by the ambiguity it is escaping: this is an explicit
 // create, distinct from the update-a-match path every other capture decision takes.
 const result=command('Capture another '+((cap?.label)||'use'),e=>captureNew(e,ask.pid,ask.sid,ask.cid,ask.value,cap?.label||ask.cid));
 if(result)reviewAuthored('capture');
 S.expCaptureAsk=null;ctx.ui();return result;
}
export function cancelCaptureAsk(){if(!S.expCaptureAsk)return false;S.expCaptureAsk=null;ctx.ui();return true;}

// ----- C9.6 revision and repair commands (J8) -----------------------------
// Rename is a direct identity-preserving edit: a Presentation's name affects no Stop, View use, cue or
// activation, so it accepts once rather than routing through the shared-effect Ask.
export function renamePresentationById(id,name){if(!ctx.experience.presentations[id])return false;return command('Rename Presentation',e=>renamePresentation(e,id,name));}
// Remove a Presentation and its own Guide occurrences as one Undo. Retained contributions, View uses,
// shared definitions and Camera Views survive as explicit, repairable references.
export function removePresentationCommand(pid){if(!ctx.experience.presentations[pid])return false;const stops=Object.values(ctx.experience.stops).filter(s=>s.presentationId===pid).length;const result=command('Remove Presentation',e=>removePresentation(e,pid));settleExperienceSelection();if(stops)A.setStatus(`Presentation removed · ${stops} Stop${stops===1?'':'s'} left the Guide · retained references need local repair`,'edit');ctx.ui();return result;}
export function removeContributionCommand(id){const u=ctx.experience.uses[id];if(!u)return false;const home=u.presentationId;const result=command('Remove contribution',ed=>removeContribution(ed,id));if(S.sel===id)A.select(home&&ctx.experience.presentations[home]?home:null);ctx.ui();return result;}
// Duplicate as an explicit new identity; a View duplicate shares the Camera View, a contribution duplicate
// gets its own definition, so editing one copy never mutates the other.
export function duplicateContributionCommand(id){if(!ctx.experience.uses[id])return false;const nid=command('Duplicate contribution',ed=>duplicateContribution(ed,id));if(nid)A.select(nid);ctx.ui();return nid;}
export function makeLocalCommand(id){if(!ctx.experience.uses[id]||!ctx.experience.definitions[ctx.experience.uses[id].definitionId])return false;return command('Make definition local',ed=>makeDefinitionLocal(ed,id));}
export function linkDefinitionCommand(id,definitionId){if(!definitionId)return false;try{return command('Link shared definition',ed=>linkDefinition(ed,id,definitionId));}catch(error){A.setStatus(error.message,'refuse');ctx.ui();return false;}}
export function renameContributionCommand(id,name){if(!ctx.experience.uses[id])return false;return command('Rename contribution',ed=>renameContribution(ed,id,name));}
// Routed repair: rebind a retained instruction to a compatible descriptor/target without changing its
// identity, home, activation or boundary. Trigger and target stay distinct.
export function rebindContributionCommand(id,patch){
 if(!ctx.experience.uses[id])return false;
 // Replacing a descriptor edits the shared definition every linked Activity reads. When more than one
 // Activity links it, that reach is disclosed and the author explicitly chooses a local fork or a shared
 // edit instead of every linked use changing silently.
 const definitionId=ctx.experience.uses[id].definitionId;
 // A pending disclosure accumulates its edits, so choosing a subject and then a capability is one shared
 // acceptance rather than the second choice silently dropping the first.
 const prior=S.expRebindAsk&&S.expRebindAsk.id===id&&S.expRebindAsk.definitionId===definitionId?S.expRebindAsk.patch:{};
 const merged={...prior,...patch};
 // Reach is read from the whole proposal, not only from the field this call touched: a pending subject
 // replacement stays behind the scope acceptance even when the next change (a trigger, an availability)
 // edits no definition field itself, so a merged write can never slip past the disclosure.
 const reachesDefinition=['subjectId','capabilityId','value'].some(k=>merged[k]!==undefined);
 const reach=reachesDefinition?definitionReachByUse(ctx.experience,definitionId):[];
 if(reach.length>1){S.expRebindAsk={id,patch:merged,definitionId,reach};ctx.ui();return true;}
 return applyRebind(id,merged);
}
function applyRebind(id,patch,mode='shared'){
 const stored=ctx.experience.definitions[ctx.experience.uses[id].definitionId];
 const from=stored?.capabilityId||null;
 // A replacement onto a capability this Stage does not realize is refused before anything is written: the
 // author is told why, and the retained instruction keeps needing a different repair.
 if(patch.capabilityId!==undefined){
  const cap=stored?.kind==='control'?capability(ctx.sceneSource,patch.subjectId??stored.subjectId,patch.capabilityId):null;
  if(cap&&!isRealized(cap)){A.setStatus(`${cap.label} · declared by the provider but not realized by this Stage`,'refuse');ctx.ui();return false;}
 }
 const result=command(mode==='local'?'Rebind only this Activity':'Repair contribution',ed=>{if(mode==='local')makeDefinitionLocal(ed,id);return rebindContribution(ed,id,patch,ctx.sceneSource);});
 // A repair is an authored operation; the review aid records the capability it replaced and whether that
 // capability was the one a profile change had just taken away, so a repaired loss is distinguishable
 // from an unrelated rebind. It is credited only when the retained instruction now resolves: a replacement
 // that leaves the descriptor unsupported stays an open repair issue rather than reporting completion.
 const repaired=ctx.experience.definitions[ctx.experience.uses[id]?.definitionId];
 const resolves=!!repaired&&(repaired.kind!=='control'||!!capability(ctx.sceneSource,repaired.subjectId,repaired.capabilityId));
 if(result!==false&&resolves)review({repair:{id,from,to:repaired.capabilityId||null,restored:!!(S.expReview.loss&&(S.expReview.loss.lost||[]).includes(from))}});
 return result;
}
// The disclosure is re-checked before it is applied: a reach that changed while the author was reading is
// re-presented rather than committed against a stale count.
export function acceptRebind(scope){
 const ask=S.expRebindAsk;if(!ask)return false;
 const reach=definitionReachByUse(ctx.experience,ask.definitionId);
 if(reach.length>1&&JSON.stringify(reach)!==JSON.stringify(ask.reach)){ask.reach=reach;ctx.ui();return false;}
 S.expRebindAsk=null;
 if(reach.length<=1)return applyRebind(ask.id,ask.patch);
 return applyRebind(ask.id,ask.patch,scope==='local'?'local':'shared');
}
onCancel(()=>{S.expRebindAsk=null;},12,'Shared contribution rebind');
// Provider profile replacement is an explicit source operation: the instance and geometry are kept, and the
// adapter reports exactly which declared capabilities were gained or lost.
export function replaceProfileCommand(sid,profile){
 if(!profile||!ctx.sceneSource.subjects[sid])return false;
 const before=capabilities(ctx.sceneSource,sid).map(c=>c.id);
 try{
  const result=command('Replace provider profile',()=>replaceProfile(ctx.sceneSource,sid,profile));
  const after=capabilities(ctx.sceneSource,sid).map(c=>c.id);
  const gained=after.filter(id=>!before.includes(id)),lost=before.filter(id=>!after.includes(id));
  if(lost.length||gained.length)review({loss:{subjectId:sid,profile,before,after,gained,lost}});
  // A gained capability this Stage does not realize is named as declared-but-unrealized, so the demo is
  // never read as something the visitor will actually see.
  const unrealized=gained.filter(id=>capability(ctx.sceneSource,sid,id)?.realized===false);
  const parts=[gained.length?`gained ${gained.join(', ')}${unrealized.length?` (${unrealized.join(', ')} not realized by this Stage)`:''}`:'',lost.length?`lost ${lost.join(', ')}`:''].filter(Boolean);
  A.setStatus(`Profile ${profile} · ${parts.length?parts.join(' · '):'same capabilities'} · instance unchanged`,'edit');ctx.ui();return result;
 }catch(error){A.setStatus(error.message,'refuse');ctx.ui();return false;}
}
// Retained contributions whose organizational home no longer resolves: an Experience-level inventory so a
// repair writer stays reachable without resurrecting the removed Presentation.
export const retainedContributions=()=>orphanContributions(ctx.experience);
export const linkedDefinitionReach=(definitionId)=>definitionReachByUse(ctx.experience,definitionId);
// The descriptor the Card's Replace and Repair controls must render while a scoped replacement is pending:
// the author is proposing a subject or capability the write has deliberately not reached yet, so the
// counterpart control lists that proposal's own capabilities instead of resetting to the stored descriptor.
export function pendingDescriptor(id,d){
 const patch=S.expRebindAsk?.id===id?S.expRebindAsk.patch:null;
 return {subjectId:patch?.subjectId??d?.subjectId??null,capabilityId:patch?.capabilityId??d?.capabilityId??null};
}
// A retained choice whose destination left with its Presentation is repaired or removed where its own Stop
// is read, so Preview is never offered a continuation that cannot resolve.
export function choiceRemoveCommand(stopId,choiceId){if(!ctx.experience.stops[stopId])return false;return command('Remove choice',e=>removeChoice(e,stopId,choiceId));}
export function choiceRepointCommand(stopId,choiceId,targetId){
 if(!targetId||!ctx.experience.stops[stopId])return false;
 try{return command('Repair choice destination',e=>repointChoice(e,stopId,choiceId,targetId));}
 catch(error){A.setStatus(error.message,'refuse');ctx.ui();return false;}
}
export function reuseFraming(pid,vid){const result=command('Reuse Camera View',(e,c)=>reuseView(e,c,pid,vid));if(result)reviewMoment(pid,'framing');return result;}
export function visitorCommand(action,id=null){
 const v=S.visitor;if(!v)return false;const e=v.source.experience,c=v.source.camera,scene=v.source.scene,r=v.runtime;
 if(action==='choice-cancel'){S.visitorChoice=null;ctx.ui();return true;}
 if(action==='next')v.runtime=R.nextRuntime(e,c,r,scene);
 if(action==='back')v.runtime=R.previousRuntime(e,c,r,scene);
 if(action==='start')v.runtime=R.startGuide(e,c,r,scene);
 if(action==='auto') v.runtime=R.autoRuntime(e,r);
 if(action==='activate')v.runtime=R.activateRuntime(e,c,r,id,scene);
 if(action==='stop')v.runtime=R.stopActivityRuntime(e,r,id);
 if(action==='explore')v.runtime=R.exploreRuntime(r,nav.plainPose());
 if(action==='rejoin')v.runtime=R.resumeGuide(e,c,r,nav.plainPose());
 if(action==='look')v.runtime=R.lookRuntime(e,c,r,id,nav.plainPose());
 if(action==='next-view'||action==='previous-view')v.runtime=R.viewStepRuntime(e,c,r,action==='next-view'?1:-1);
 if(action==='captions')v.runtime.captions=!r.captions;
 if(action==='detour')v.runtime=R.chooseRuntime(e,c,r,id,true,scene);
 // A go choice continues: it abandons any parked parent instead of parking one, so Back (not Return) is
 // the way it can be revisited.
 if(action==='go')v.runtime=R.chooseRuntime(e,c,r,id,false,scene);
 if(action==='return')v.runtime=R.returnDetour(e,c,r,scene);
 // Opening another available Presentation is a deliberate navigation request: from a Guide it parks
 // this Stop with one bounded bookmark, otherwise it starts a fresh visit. Closing a standalone
 // Presentation returns to exploration, never to authoring. Both only read authored documents.
 if(action==='open')v.runtime=R.openPresentationRuntime(e,c,r,id,scene);
 if(action==='close')v.runtime=R.closePresentationRuntime(r);
 // Any deliberate visitor command settles a pending offer choice: a choice is never left armed
 // behind a navigation the visitor already made.
 S.visitorChoice=null;
 // The visitor's own session is the only witness to what a visit did: what it traversed, explored,
 // resumed and activated is read from the runtime this command produced, never assumed from authoring.
 const led=S.expReview.visitor||emptyVisitorLedger();
 const next={...led};
 // Where the visit moved to, which Stop entry it made there and how the Camera's movements ended are not
 // recorded here: `reconcileVisitor` reads them from the runtime, so a Stop reached by Auto is as real as
 // one reached by Next. This command only writes the facts its own action produced.
 // A visitor Stop is recorded with the run it actually ended: only the runtime knows whether that run was
 // live at the moment, and only the authored descriptor says whether its lifetime is carried by the
 // Experience rather than owned by the visit. Both facts are what the capability-sequence topic reads.
 if(action==='stop'&&id){
  const run=r.activities[id],u=e.uses[run?.useId];
  if(run)next.stopped=[...(next.stopped||[]),{useId:run.useId,live:run.status==='running',carried:run.status==='running'&&(u?.end?.kind==='experience'||u?.retention?.kind==='experience')}];
 }
 if(action==='explore')next.explored=true;
 if(action==='rejoin')next.rejoined=true;
 if(action==='next-view'||action==='previous-view')next.viewStep=led.viewStep+1;
 if(action==='activate'&&id&&!next.activated.includes(id))next.activated=[...next.activated,id];
 if(action==='detour')next.detoured=true;
 if(action==='return')next.returned=true;
 if(action==='open'&&id)next.opened=[...next.opened,id];
 review({visitor:next});
 reconcileVisitor();
 if(!v.runtime.exploring)nav.applyPose(v.runtime.pose);ctx.ui();return true;
}
// Direct subject activation during Preview and exploration: a real click activates the offer(s) the used
// subject offers, while a drag orbits the visitor's own viewpoint and never activates. The release is
// the only place a click decides, so click and drag stay distinguishable in both modes.
export const VISITOR_DRAG_SLOP=6;
export function visitorPointer(event){
 const v=S.visitor;if(!v)return false;
 const hit=ctx.stage.pick?.(event.clientX,event.clientY),id=hit?.object?.userData?.id||hit?.id||null;
 S.visitorPress={x:event.clientX,y:event.clientY,id,moved:false};
 if(v.runtime.exploring)S.visitorDrag={x:event.clientX,y:event.clientY};
 return true;
}
export function visitorMove(event){
 const v=S.visitor;if(!v)return false;
 const press=S.visitorPress;
 if(press&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>VISITOR_DRAG_SLOP)press.moved=true;
 const d=S.visitorDrag;
 if(d&&press?.moved){nav.manipulate({dx:event.clientX-d.x,dy:event.clientY-d.y});d.x=event.clientX;d.y=event.clientY;v.runtime.pose=nav.plainPose();}
 return true;
}
export function visitorRelease(){
 const v=S.visitor,press=S.visitorPress;S.visitorPress=null;S.visitorDrag=null;
 if(!v||!press||press.moved||!press.id)return false;
 const offers=Object.values(v.source.experience.uses).filter(u=>u.kind==='interaction'&&u.triggerSubjectId===press.id&&(!u.availability||u.availability===v.runtime.presentationId));
 if(!offers.length)return false;
 // Several offers for one subject open an explicit choice: the first enumerated offer is never the
 // visitor's decision. One offer is executed directly, still activation by deliberate click.
 if(offers.length>1){S.visitorChoice={triggerId:press.id,offers:offers.map(u=>u.id)};ctx.ui();return true;}
 return visitorCommand('activate',offers[0].id);
}
export function sourceCapability(sid,cid,value){
 const cap=capability(ctx.sceneSource,sid,cid);
 if(!cap?.sourceEditable||!Number.isFinite(value)||value<(cap.min??0)||value>(cap.max??1)){A.setStatus('Value outside supported Scene capability range','refuse');ctx.ui();return false;}
 return command('Edit Scene capability',()=>setSceneValue(ctx.sceneSource,sid,cid,value));
}
onCancel(()=>{S.expOfferDraft=null;},12,'Experience offer draft');
onCancel(reason=>{
 if(!['esc','lens','preview','reset','task-end','invoke','selection'].includes(reason))return;
 S.expAudition=null;
 // The ambiguity choice holds the same session work as the audition: dropping the audition must also
 // drop the stale choice, so a value the user walked away from can never be accepted later.
 S.expCaptureAsk=null;
},9,'Experience audition and capture proposal');
// Session transients every Experience reset or load clears: context, auditions, drafts and the
// review observations. It never touches selection, Camera or World truth — those are settled by the
// caller against the retained domains.
function clearExperienceTransients(){
 S.experienceContext={presentation:null,depth:'ordinary',stop:null,seam:null};
 S.derivedView=null;S.expAudition=null;S.expOfferDraft=null;S.expCaptureAsk=null;S.expAsk=null;S.expSourceAsk=null;S.expRouteAsk=null;S.expRebindAsk=null;
 S.expReview={auditions:0,previews:0};S.parkedByLens.experience=null;T.end();
}
// Remove only the context that no longer resolves: a World subject or a retained Camera View stays
// selected, an Experience identity does not survive its own removal.
function settleExperienceSelection(){
 if(S.sel&&!resolveExperience(S.sel)&&!thing(S.sel))A.select(null);
}
// Reset Experience replaces only Experience-authored content with a genuinely empty Experience. Scene,
// Camera (including unreferenced Views) and the aggregate Undo history are preserved, and the reset is
// one ordinary Undoable edit; Undo restores it without restoring a viewpoint.
export function resetExperience() {
 if(S.visitor)return false;
 cancelProposal('reset');T.park();nav.discardReturn();clearExperienceTransients();
 const result=command('Reset Experience',e=>{clearExperience(e);return true;});
 // Reset authors an empty Experience here; whatever a loader had put on screen is gone with it.
 reviewSource('reset');
 settleExperienceSelection();ctx.ui();return result;
}
// Load Example / Load Conformance explicitly replace Experience fixture content and add Camera fixture
// artifacts through Camera operations: fresh identities from the retained serials, no deletion of
// existing Camera truth, no history wipe. One aggregate command holds the whole load, so Undo leaves
// the independent domains exactly as they were before it. A labelled load is the one place that rebuilds
// deterministic Experience identities: the whole domain is replaced by the fixture, never merged with it.
function loadExperienceFixture(label,build,openMain=false,source='fixture'){
 if(S.visitor)return false;
 cancelProposal('reset');T.park();nav.discardReturn();clearExperienceTransients();
 // A labelled rebuild reissues deterministic fixture identities (the Experience serial resets), so an
 // Experience-owned selection would silently point at whatever the fixture names the same way. It is
 // invalidated before the rebuild; World and Camera identities are not Experience-owned and survive,
 // and Load Example's explicit main Presentation is selected only after the build.
 if(resolveExperience(S.sel)?.owner==='Experience')A.select(null);
 const result=command(label,(e,c)=>{clearExperience(e);e.serial=0;return build(e,c);});
 // The load is labelled provenance, not authorship: the review aid says where this document came from
 // and counts no authored edit until the reviewer makes one.
 reviewSource(source);
 // Which identity the author was on is settled against the retained World/Camera domains, never adopted
 // from the loader. Load Example lands on the example's main Presentation because it is loaded to be
 // edited; the conformance fixture is explicit content only and never selects or opens work.
 settleExperienceSelection();
 if(openMain&&result?.presentation&&ctx.experience.presentations[result.presentation]){S.experienceContext.presentation=result.presentation;A.select(result.presentation);}
 ctx.ui();return result;
}
export function loadExample(){return loadExperienceFixture('Load Example',(e,c)=>buildExampleFixture(e,c,ctx.sceneSource),true,'example');}
export function loadConformance(){return loadExperienceFixture('Load Conformance fixture',(e,c)=>conformanceFixture(e,c),false,'conformance');}
function buildExampleFixture(e,c,scene){
 const pid=addPresentation(e,{kind:'subjects',ids:['machine']},'Understand the drive');
 e.presentations[pid].meaning='The casing protects the rotor. See how power travels through the machine.';
 const base={target:[-10,1.2,1],az:1.2,el:.25,frameH:3,flat:0};
 const entry=addView(e,c,pid,base,'Machine overview','entry'),inside=addView(e,c,pid,{...base,frameH:1.8},'Inside','choice'),output=addView(e,c,pid,{...base,az:.9},'Output','choice');
 const n=addContribution(e,pid,{kind:'narration',name:'Explanation',text:e.presentations[pid].meaning,duration:18,markers:[{id:'inside',label:'Look inside',time:6},{id:'output',label:'Follow output',time:12}]},'narration');
 e.uses[n].primary=true;e.uses[n].primaryFor=pid;
 e.uses[inside].cue={useId:n,signal:'marker:inside'};e.uses[output].cue={useId:n,signal:'marker:output'};
 const open=addContribution(e,pid,{kind:'control',name:'Open casing',subjectId:'machine',capabilityId:'casing',value:1});e.uses[open].end={kind:'experience'};e.uses[open].retention={kind:'experience'};
 const run=addContribution(e,pid,{kind:'control',name:'Run rotor',subjectId:'machine',capabilityId:'rotor',value:true});e.uses[run].start={kind:'after',useId:open,signal:'complete',scope:'visit',presentationId:pid};e.uses[run].end={kind:'experience'};
 const piano=addContribution(e,null,{kind:'control',name:'Play Piano',subjectId:'piano',capabilityId:'music',value:true},'interaction','piano');e.uses[piano].availability=null;
 const light=addContribution(e,null,{kind:'control',name:'Light from Switch',subjectId:'light',capabilityId:'intensity',value:3},'interaction','switch');e.uses[light].availability=null;
 const compare=addPresentation(e,{kind:'subjects',ids:['machine','mesh']},'Compare materials');reuseView(e,c,compare,e.uses[entry].viewId);setRole(e,e.presentations[compare].uses[0],'entry');
 const a=addStop(e,pid),b=addStop(e,compare);e.stops[a].choices.push({id:fresh(e,'choice'),label:'Compare materials detour',targetId:b,kind:'detour'});
 // ---- C9.7 rich fixture, appended after the retained identities above so the earlier example content
 // is byte-comparable. It adapts the donor's remaining concepts into this World: a repeated occurrence,
 // a contextual offer beside the Experience-wide ones, the native Wall assembly as an off-Guide detour,
 // a no-View atmosphere moment, and one supported Travel Seam carrying an authored route, a named
 // station, an Experience hold and a station-only capability invocation.
 const repeat=addStop(e,compare);                        // a repeated occurrence: distinct Stop identity, no Camera edge
 const cEntry=addView(e,c,compare,{...base,target:[-9,1.4,-1.2],az:-2.1},'Materials close-up','entry');
 setRole(e,cEntry,'entry');                              // the shared overview stays a deliberate choice
 const contextual=addContribution(e,pid,{kind:'control',name:'Listen inside',subjectId:'piano',capabilityId:'music',value:true},'interaction','piano');e.uses[contextual].availability=pid;
 const wall=addPresentation(e,{kind:'environment'},'The wall assembly');
 e.presentations[wall].meaning='The round wall unrolls to a flat sheet without stretching.';
 addContribution(e,wall,{kind:'control',name:'Unfold the assembly',subjectId:'wallAssembly',capabilityId:'unfold',value:true});
 const wallStop=addStop(e,wall);e.guide=e.guide.filter(id=>id!==wallStop);   // off the main Guide: a deliberate detour only
 e.stops[a].choices.push({id:fresh(e,'choice'),label:'See the wall assembly',targetId:wallStop,kind:'detour'});
 const mood=addPresentation(e,{kind:'environment'},'Evening atmosphere');
 e.presentations[mood].meaning='The gallery dims as evening comes in.';
 addContribution(e,mood,{kind:'control',name:'Dim the atmosphere',subjectId:'atmosphere',capabilityId:'ambient',value:.35});
 // The Wall detour is framed by Camera like any other moment: appended after the retained identities so
 // the earlier fixture is untouched, it gives the off-Guide Stop a Wall entry rather than leaving the
 // visitor on the previous machine close-up while the assembly unrolls out of sight.
 addView(e,c,wall,{target:[5.5,1.2,0],az:1.05,el:.2,frameH:5,flat:0},'Wall assembly','entry');
 // The Seam's own entry route is authored first and carries the coordination; the remaining legitimate
 // origins are prepared beside it, so every origin the visitor can actually select is supported.
 const route=addConnection(c,e.uses[entry].viewId,e.uses[cEntry].viewId);
 const anchor=addAnchor(c,route,[-4,2,1.2]);
 const marker=fresh(c,'marker');c.connections[route].markers.push({id:marker,name:'Power station',progress:.5});
 prepareTravelSupport(e,c,a,b);
 editSeam(e,a,b,{mode:'travel'});
 addBeat(e,c,a,b,route,anchor,2);                        // an Experience hold of visible duration
 const stationWork=addContribution(e,compare,{kind:'control',name:'Highlight at the station',subjectId:'mesh',capabilityId:'emphasis',value:true});
 addInvocationBeat(e,c,a,b,route,marker,stationWork,scene);  // its only authored activation is this station
 // The atmosphere moment has no View of its own and never joins the Guide; its visitor entry is one
 // deliberate continuation from the repeated occurrence, so the no-View Presentation stays reachable.
 const moodStop=addStop(e,mood);e.guide=e.guide.filter(id=>id!==moodStop);
 e.stops[repeat].choices.push({id:fresh(e,'choice'),label:'Evening atmosphere',targetId:moodStop,kind:'detour'});
 // The machine explanation's own local highlight: a visit-scoped effect that never outlives its visit and
 // never edits the Scene source.
 addContribution(e,pid,{kind:'control',name:'Highlight the casing',subjectId:'machine',capabilityId:'highlight',value:true});
 return {presentation:pid};
}
// The review aid's eighteen topics. Each one reads a real product outcome: authored documents, the
// Camera's own resolution, or what a visit actually reported (the ledger in `expReview`, written by the
// paths that produce those outcomes). A topic is never credited for a field being present or a button
// having been pressed, and a quickstart topic names the authored outcomes of its own instruction, so
// loaded content can never complete one: the predicate must hold and its own work must have been authored
// here. An advanced topic may be reviewed on explicitly loaded content, and says so.
export function presenterSteps(){
 const e=ctx.experience;
 const working=()=>e.presentations[S.experienceContext.presentation]||Object.values(e.presentations).find(p=>p.focus.kind==='subjects')||null;
 const primary=pid=>primaryExplanation(e,pid);
 const captured=()=>Object.values(e.uses).find(u=>!u.viewId&&u.presentationId&&u.kind!=='interaction'&&e.definitions[u.definitionId]?.kind==='control')||null;
 return [
  {family:'Q',title:'Q1 · Subject and Presentation',authored:['presentation'],instruction:'Select a real World subject in the Index, then Present this. One Presentation, no Guide.',
   done:()=>Object.values(e.presentations).some(p=>p.focus.kind==='subjects'&&p.focus.ids.length&&p.focus.ids.every(id=>!!A.worldOf(id)))&&e.guide.length===0,
   observed:()=>{const p=working();if(!p)return 'No Presentation yet';const ids=p.focus.ids||[],real=ids.filter(id=>!!A.worldOf(id));return `${p.name} · focus ${real.join(', ')||p.focus.kind}${real.length<ids.length?' · unresolved':''} · Guide ${e.guide.length}`;}},
  {family:'Q',title:'Q2 · Explanation and framing',
   // Both outcomes belong to the moment this topic assesses: an explanation or a Capture authored on another
   // Presentation is that other moment's, so neither one can complete the topic on screen.
   authored:[()=>momentAuthored(working()?.id,'explanation'),()=>momentAuthored(working()?.id,'framing')],
   instruction:'Write the explanation in the Presentation Card, then Capture the suggested framing.',
   done:()=>{const p=working();if(!p)return false;const u=primary(p.id);return !!(u&&e.definitions[u.definitionId]?.text.trim())&&p.uses.some(id=>e.uses[id]?.viewId);},
   observed:()=>{const p=working();if(!p)return 'Waiting for a Presentation';const u=primary(p.id),text=u?e.definitions[u.definitionId]?.text.trim():'',framed=momentAuthored(p.id,'framing');return `${text?`“${text.slice(0,48)}${text.length>48?'…':''}”`:'No explanation'} · framing ${framed?`accepted here (${p.uses.filter(id=>e.uses[id]?.viewId).length} View(s))`:p.uses.some(id=>e.uses[id]?.viewId)?'came with the document, not accepted here':'not accepted here'}`;}},
  {family:'Q',title:'Q3 · Operate and Use',authored:['capture'],instruction:'Select the subject again, operate a capability, then Use in this Presentation.',
   done:()=>!!captured()&&(S.expReview?.auditions||0)>0,
   observed:()=>{const u=captured();const d=u&&e.definitions[u.definitionId],tries=S.expReview?.auditions||0;return `${d?`${d.name||d.capabilityId} captured${u.presentationId?` in ${e.presentations[u.presentationId]?.name||'a Presentation'}`:''}`:'No captured capability yet'}${tries?` · ${tries} audition${tries===1?'':'s'}`:''}`;}},
  {family:'Q',title:'Q4 · Preview without a Guide',authored:['explanation'],instruction:'Preview the Presentation; the explanation, framing and capability run in a private visit. Exit returns exactly.',
   done:()=>{const v=S.expReview.visit,controls=Object.values(e.uses).filter(u=>!u.viewId&&e.definitions[u.definitionId]?.kind==='control').length;return (S.expReview.previews||0)>0&&!!v&&v.narration>=1&&v.framing&&(controls===0||v.controls>=1);},
   observed:()=>{const v=S.expReview.visit;return v?`Visit ${v.stop?'at a Stop':'standalone'} · explanation ${v.narration} · framing ${v.framing?'arrived':'not arrived'} · capability ${v.controls}`:'No completed Preview yet';}},
  {family:'Q',title:'Q5 · Add to the Guide',authored:['guide'],instruction:'Exit Preview, then add the Presentation to the Guide. One Stop, and Peek the occurrence without disturbing the work.',
   done:()=>e.guide.length===1&&(S.expReview.peeks||0)>0&&!!stopEntry(e,e.guide[0]).id,
   observed:()=>`${e.guide.length} Stop · ${S.expReview.peeks||0} Peek${(S.expReview.peeks||0)===1?'':'s'} · entry ${e.guide.length?stopEntry(e,e.guide[0]).id:'none'}`},
  {family:'Q',title:'Q6 · A second Presentation',authored:['presentation','guide'],instruction:'Present another moment and add it to the Guide. Two whole-moment Stops from the order resolver, no manual edge.',
   done:()=>e.guide.length===2&&Object.keys(e.seams).length===0,
   observed:()=>`${e.guide.length} Stops · ${Object.keys(e.seams).length} authored edges`},
  {family:'Q',title:'Q7 · Preview the Guide',authored:['guide'],instruction:'Preview the Guide and press Next from the first Stop to the second: the order resolver and the destination entry run.',
   done:()=>{const t=S.expReview.visitor?.traversed;return !!t&&t.from===e.guide[0]&&t.to===e.guide[1]&&t.arrived;},
   observed:()=>{const t=S.expReview.visitor?.traversed;return t?`Traversed ${e.guide.indexOf(t.from)+1} → ${e.guide.indexOf(t.to)+1} · destination entry ${t.arrived?'reached by the Camera':'still travelling'}`:'No traversal yet';}},
  {family:'Q',title:'Q8 · Explore and rejoin',authored:['presentation'],instruction:'Explore the World during the visit, then Rejoin: participation is kept and framing resumes from where you are, with Auto off.',
   done:()=>!!S.expReview.visitor?.explored&&!!S.expReview.visitor?.rejoined,
   observed:()=>{const v=S.expReview.visitor;return `${v?.explored?'explored':'not explored'} · ${v?.rejoined?'rejoined':'not rejoined'} · ${v?.viewStep||0} View step${(v?.viewStep||0)===1?'':'s'}`;}},
  {family:'A',title:'A1 · Additional Views',instruction:'Add or reuse another Camera View in a Presentation: no new Stop or edge, explanation continues, and Next View stays distinct from Next Stop.',
   done:()=>Object.values(e.presentations).some(p=>p.uses.filter(id=>e.uses[id]?.viewId).length>=2)&&(S.expReview.visitor?.viewStep||0)>0,
   observed:()=>{const p=Object.values(e.presentations).sort((a,b)=>b.uses.filter(id=>e.uses[id]?.viewId).length-a.uses.filter(id=>e.uses[id]?.viewId).length)[0];return `${p?.uses.filter(id=>e.uses[id]?.viewId).length||0} framed Views · Guide ${e.guide.length} · View steps ${S.expReview.visitor?.viewStep||0}`;}},
  {family:'A',title:'A2 · Capability sequence',instruction:'Load the rich example or author a capability sequence: watch a finite operation complete and hand over, then stop a carried run.',
   done:()=>{const v=S.expReview.visit,stopped=S.expReview.visitor?.stopped||[];return !!v&&v.controls>=1&&v.completed>=1&&v.handoffs>=1&&stopped.some(s=>s.carried);},
   observed:()=>{const v=S.expReview.visit,stopped=S.expReview.visitor?.stopped||[];return v?`capabilities ${v.controls} · completed ${v.completed} · handovers ${v.handoffs} · carried runs stopped ${stopped.filter(s=>s.carried).length}`:'No completed visit yet';}},
  {family:'A',title:'A3 · Stop entry policies',instruction:'Compare entries: a Presentation entry, a specific later View, and a hold while the content still runs.',
   done:()=>{const ent=S.expReview.visitor?.entries||[];return ent.some(x=>x.kind==='presentation'&&x.arrived)&&ent.some(x=>x.kind==='use'&&x.later&&x.arrived)&&ent.some(x=>x.kind==='hold'&&x.ran);},
   observed:()=>{const ent=S.expReview.visitor?.entries||[],n=k=>ent.filter(x=>x.kind===k&&(x.arrived||x.ran)).length;return `entries the visit ran · Presentation ${n('presentation')} · later View ${ent.filter(x=>x.kind==='use'&&x.later&&x.arrived).length} · hold with content running ${ent.filter(x=>x.kind==='hold'&&x.ran).length}`;}},
  {family:'A',title:'A4 · Request simple Travel',instruction:'Open the Seam and Travel: Camera prepares the missing support, and the visitor travels without any graph surgery.',
   done:()=>{const c=cameraSnapshot(),led=S.expReview.visitor;return Object.values(e.seams).some(s=>s.mode==='travel'&&originCoverage(e,c,s.from,s.to).every(r=>!r.missing&&(r.connectionId||r.viewId===r.targetId)))&&(led?.stops||[]).length>=2&&(led?.travelArrivals||0)>0;},
   observed:()=>{const c=cameraSnapshot(),s=Object.values(e.seams)[0],led=S.expReview.visitor;if(!s)return 'No Seam yet';const rows=originCoverage(e,c,s.from,s.to);return `${s.mode} · ${rows.filter(r=>r.connectionId).length}/${rows.length} origins routed · ${(led?.stops||[]).length} stops visited · ${led?.travelArrivals||0} Travel arrived`;}},
  {family:'A',title:'A5 · Edit the route',instruction:'Edit the Camera route from the Seam: see the real origins, path, anchors and pace, then return explicitly.',
   done:()=>!!(S.expReview.routeWrite?.edited&&S.expReview.routeWrite?.returned),
   observed:()=>{const w=S.expReview.routeWrite||{},r=Object.values(ctx.cameraSource.connections)[0];return `${w.edited?'edited':'not edited'} · ${w.returned?'returned':'not returned'} · ${r?`${r.anchors.length} anchor(s), ${r.markers.length} marker(s), pace ${r.speed}`:'no route'}`;}},
  {family:'A',title:'A6 · Coordinate the Seam',instruction:'Coordinate the local Seam: select a station or event, edit a Hold duration, and Preview exactly-once invocation.',
   done:()=>{const authored=Object.values(e.seams).some(s=>s.beats.some(b=>b.kind==='hold')&&s.beats.some(b=>b.kind==='invoke'));const worked=!!(S.expReview.coordination?.stationSelected&&S.expReview.coordination?.holdEdited);return authored&&worked&&S.expReview.visit?.invoked===1;},
   observed:()=>{const s=Object.values(e.seams)[0],beats=s?s.beats:[],c=S.expReview.coordination||{};return `station ${c.stationSelected?'focused':'not focused'} · hold ${c.holdEdited?'edited':'not edited'} · invocations ${beats.filter(b=>b.kind==='invoke').length} · last visit ran ${S.expReview.visit?.invoked??'—'} invocation(s)`;}},
  {family:'A',title:'A7 · Visitor interaction',instruction:'Activate an interaction while exploring: the real subject answers on the Stage, without leaving exploration.',
   done:()=>(S.expReview.visitor?.activated?.length||0)>0,
   observed:()=>{const ids=S.expReview.visitor?.activated||[];return ids.length?`activated ${ids.map(id=>e.definitions[e.uses[id]?.definitionId]?.name||id).join(', ')}`:'Nothing activated yet';}},
  {family:'A',title:'A8 · Detour and return',instruction:'Take an authored detour, then Return: the parent narration and playhead resume without a second entry.',
   done:()=>!!S.expReview.visitor?.detoured&&!!S.expReview.visitor?.returned,
   observed:()=>{const v=S.expReview.visitor;return `${v?.detoured?'detoured':'no detour'} · ${v?.returned?'returned':'not returned'}`;}},
  {family:'A',title:'A9 · Shared or local scope',instruction:'Predict the reach before editing, cancel one shared proposal, then accept a supported local or shared edit and Undo it.',
   done:()=>{const s=S.expReview.scope||{};return !!s.cancelled&&!!s.accepted&&!!s.label&&(S.redo||[]).some(entry=>entry.label===s.label);},
   observed:()=>{const s=S.expReview.scope||{},undone=!!s.label&&(S.redo||[]).some(entry=>entry.label===s.label);return `${s.cancelled?'cancelled once':'nothing cancelled'} · ${s.accepted?`accepted ${s.kind} (${s.uses} use(s), ${s.stops} Stop(s))`:'nothing accepted'} · ${undone?'undone':'not undone yet'}`;}},
  {family:'A',title:'A10 · Lose and repair a capability',instruction:'Replace a provider profile in the World lens, follow the routed notice, and repair the retained Activity.',
   done:()=>!!(S.expReview.loss?.lost?.length)&&!!S.expReview.repair?.restored,
   observed:()=>{const l=S.expReview.loss,r=S.expReview.repair;return `${l?`${l.subjectId} lost ${l.lost.join(', ')||'nothing'}`:'no profile change'} · ${r?.restored?'repaired here':'not repaired'}`;}},
 ];
}
// The review aid moves its own cursor and nothing else: Back, Next and Skip change which instruction is
// shown, never the reading, the selection, the Camera or the documents. Skip is deliberately not a
// completion: it moves on without claiming the topic was observed.
export function presenterStep(delta=0) {const n=presenterSteps().length;S.experiencePresenter=Math.max(0,Math.min(n-1,(S.experiencePresenter||0)+delta));ctx.ui();return S.experiencePresenter;}
export const presenterSkip = () => presenterStep(1);
// Next is earned: it advances only when the current topic's outcome actually holds, so a reviewer cannot
// move on from a topic they have not completed. Skip is the deliberate alternative.
export function presenterNext(){const steps=presenterSteps(),i=Math.max(0,Math.min(steps.length-1,S.experiencePresenter||0));if(!presenterCredit(steps[i]).credited)return false;presenterStep(1);return true;}
// A quickstart topic is credited only when the outcomes its own instruction produces were authored on this
// document in this session; an advanced topic may be reviewed on explicitly loaded content, and its line
// says so.
// A step's authored requirement is a list of outcomes. Most are the session's own record; one that belongs to
// a particular moment is named by a predicate closing over the moment the topic assesses, so work authored on
// another Presentation can never stand in for the one on screen.
export function presenterCredit(step) {const seen=!!step.done(),required=step.family==='Q'?(step.authored||[]):[],authored=required.length?required.every(r=>typeof r==='function'?!!r():authoredHere(r)):S.expReview.writes>0;return {seen,credited:seen&&(step.family==='A'||authored),authored};}
// The provenance line names the loader that produced the document on screen, and the authored count says
// whether anything in it was authored here. Loaded content is never counted as authorship.
export const presenterSource = () => ({ kind: S.expReview.source, label: { none: 'prototype boot', reset: 'Reset Experience', example: 'Load Example', conformance: 'Load Conformance fixture' }[S.expReview.source] || S.expReview.source, writes: S.expReview.writes });

export function stepVisitor(seconds){const v=S.visitor;if(!v)return false;v.runtime=R.tickRuntime(v.source.experience,v.source.camera,v.runtime,seconds,v.source.scene);reconcileVisitor();if(!v.runtime.exploring)nav.applyPose(v.runtime.pose);ctx.ui();return true;}

export const cameraSnapshot=()=>nav.resolvedCamera();

export function parkExperience() {
 const t=S.task,x=S.experienceContext;
 if(t?.kind.startsWith('experience-')) {
  const acceptedKeys=['useId','posture','grip','from','to','originUse','connection','station','beat','invokeUse','stop','hints'];
  S.parkedByLens.experience={lens:'experience',identity:t.subject,name:resolveExperience(t.subject)?.item.name||t.subject||'Guide',kind:t.kind,context:structuredClone(x),target:structuredClone(t.target),params:Object.fromEntries(acceptedKeys.filter(k=>k in t.params).map(k=>[k,structuredClone(t.params[k])]))};
 }
 cancelProposal('lens');T.park();nav.discardReturn();S.derivedView=null;S.experienceContext={...x,depth:'ordinary',stop:null,seam:null};ctx.ui();return S.parkedByLens.experience;
}
export function experienceParkedContext() {
 const p=S.parkedByLens.experience;if(!p)return null;
 const result={ok:false,reason:'',identity:p.identity,name:p.name,wrongLens:S.lens!=='experience'};
 if(p.identity&&!resolveExperience(p.identity)&&!thing(p.identity)){result.reason='Original identity removed';return result;}
 if(S.sel!==p.identity){result.reason='Select the original identity explicitly';result.fix='select';return result;}
 const x=p.context;
 if(x.presentation&&!ctx.experience.presentations[x.presentation]){result.reason='Presentation removed';return result;}
 if(x.presentation&&!presentationValid(x.presentation)){result.reason='Focus binding unresolved';return result;}
 if(x.stop&&!ctx.experience.stops[x.stop]){result.reason='Stop removed';return result;}
 if(x.seam&&resolveNext(ctx.experience,x.seam.from).id!==x.seam.to){result.reason='Seam bookends changed';return result;}
 if(p.params.useId){const use=resolveUse(ctx.experience,ctx.cameraSource,p.params.useId);if(!use||use.view.id!==p.target?.id){result.reason='Framing removed or rebound';return result;}}
 if(p.params.connection&&(!ctx.cameraSource.connections[p.params.connection]||(x.seam&&!originCoverage(ctx.experience,ctx.cameraSource,x.seam.from,x.seam.to).some(row=>row.connectionId===p.params.connection&&!row.missing)))){result.reason='Camera connection removed or rebound';return result;}
 if(p.params.station){const route=ctx.cameraSource.connections[p.params.connection];if(!route||!nav.stations(route).some(s=>s.id===p.params.station)){result.reason='Camera station removed';return result;}}
 result.ok=true;return result;
}
export async function resumeExperience() {
 const p=S.parkedByLens.experience,v=experienceParkedContext();
 if(!p||!v?.ok||v.wrongLens){A.setStatus(v?.reason||'Experience work cannot resume here','refuse');return false;}
 cancelProposal('resume');await nav.neutralInvocation(()=>{S.experienceContext=structuredClone(p.context);
 T.begin({kind:p.kind,subject:p.identity,target:structuredClone(p.target),params:structuredClone(p.params)});
 if(['route','coordination','precision'].includes(p.context.depth))nav.beginReturn('Current reading');
 if(p.kind==='experience-hints')S.derivedView={presentation:p.target.id,...nav.deriveFraming(ctx.experience.presentations[p.target.id],p.params.hints)};
 if(p.kind==='experience-camera')S.task.params.posture=nav.readingFor(cameraSnapshot().views[p.target.id]);});
 // Surface reactivation is neutral even when the remembered posture was Through or Plan.
 S.parkedByLens.experience=null;ctx.ui();return true;
}
A.registerLensWork({park:parkExperience,resume:resumeExperience});

// Focusing a Hold's own duration field addresses that beat, and only that beat: the Card, the station row
// and the Stage read one focus, so the focused event's own station becomes the selected station instead of
// leaving a stale one highlighted beside the identified Hold.
export function focusHoldBeat(id) {
 const t=S.task,seam=S.experienceContext.seam;
 if(t?.kind!=='experience-coordination'||!seam)return false;
 const beat=ctx.experience.seams[`${seam.from}>${seam.to}`]?.beats.find(b=>b.id===id);if(!beat)return false;
 const changed=t.params.beat!==id||(!!beat.stationId&&t.params.station!==beat.stationId);
 t.params.beat=id;
 if(beat.stationId)t.params.station=beat.stationId;
 // Addressing an event is recorded only when the focus actually moved: focusing the beat already in hand
 // is not new work, so it writes no observation.
 if(changed)review({coordination:{...(S.expReview.coordination||{}),eventFocused:true}});
 return changed;
}

export function updateHold(id,seconds) {
 if(!Number.isFinite(seconds)||seconds<0){A.setStatus('Hold needs a finite nonnegative duration','refuse');return false;}
 const s=S.experienceContext.seam;if(!s)return false;
 const result=command('Edit Experience station hold',e=>{const beat=e.seams[`${s.from}>${s.to}`]?.beats.find(b=>b.id===id&&b.kind==='hold');if(!beat)throw Error('Hold removed');beat.seconds=seconds;});
 // The review aid credits coordination only for work that actually happened: a Hold edit is its own
 // observation, distinct from a station being selected or a route being traversed.
 if(result!==false)review({coordination:{...(S.expReview.coordination||{}),holdEdited:true}});
 return result;
}
