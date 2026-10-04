// The one owner of the prototype's standpoint: the requested camera, its realization, movement,
// and the view history. Shell, tasks and the presenter all ask this seam; none of them keeps a pose
// of its own, and none of them restores one behind its back.
//
// Two things live here that used to be spread across callers:
//
//   * the REALIZED pose. Flatness is derived from what is open and where the camera is looking, so
//     FOV and eye distance change when a reading is dropped even if az/el/target/frameH do not. A
//     reading that parks holds the realized flatness until explicit spatial input arrives, so
//     deactivating it cannot silently dolly the camera.
//   * the trail. Entries are complete reading recipes supplied by the spatial operations; this seam
//     stores them, guards re-entry, and asks the operation layer to enter one.
import * as THREE from 'three';
import { S, ctx } from './state.js';
import { onCancel } from './cancel.js';
import { worldInterpolate, resolveCamera, realization, sameViewPose, framingInstrument as cameraFramingInstrument } from './camera-evaluation.js';
import { tween, cancelTweens, dur, run } from './anim.js';

const st = () => ctx.stage;
const V3 = THREE.Vector3;

export const camState = () => st().camState();

export function setCam(c) {
  if(neutralDepth)return;
  const cam = st().cam;
  if (c.target) cam.target.copy(c.target);
  if (c.az != null) cam.az = c.az;
  if (c.el != null) cam.el = c.el;
  if (c.frameH != null) cam.frameH = c.frameH;
  if (c.flat != null) cam.flat = c.flat;
  if (c.mirror != null) cam.mirror = c.mirror;
}

export function lerpCam(a,b,e,tFlat=e){applyPose(worldInterpolate({...a,target:a.target.toArray()},{...b,target:b.target.toArray()},e,tFlat));}

// The camera travels on one eased curve. `arc` lifts the eye mid-flight so the floor is seen on the
// way: a single beat that explains the move instead of a stop-and-go sequence.
export function camAt(a, b, e, arc = 0) {
  lerpCam(a,b,e);
  if(arc)setCam({el:st().cam.el+Math.sin(Math.PI*e)*arc});
}

let travelGeneration=0;
export const travelEpoch=()=>travelGeneration;
onCancel(reason=>{if(['lens','preview','reset','presenter-reset'].includes(reason)){travelGeneration++;cancelTweens();}},1,'Camera interruption');
export async function fly(to, ms, arc = 0) {
  const token=travelGeneration;
  // An explicit move is the moment the standpoint is re-derived: any parked hold is released.
  releaseHold();
  const a = camState();
  await tween(ms, (t) => {if(token===travelGeneration)camAt(a, to, ease(t), arc);});
  if(token!==travelGeneration)return false;
  if(to.mirror!=null)setCam({mirror:to.mirror});
}

export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// ----- what is actually rendered -----------------------------------------

// Read from the camera the renderer used, not from the request: eye, up, direction, FOV and the
// world height the frame covers at the target. This is the distinction parking and resizing keep.
export function realized() {
  const cam = st().camera;
  const tgt = st().cam.target;
  const dist = cam.position.distanceTo(tgt);
  const fov = cam.fov;
  return {
    eye: [cam.position.x, cam.position.y, cam.position.z],
    up: [cam.up.x, cam.up.y, cam.up.z],
    target: [tgt.x, tgt.y, tgt.z],
    dir: (() => { const d = new V3(); cam.getWorldDirection(d); return [d.x, d.y, d.z]; })(),
    fov, dist, frameH: 2 * dist * Math.tan((fov * Math.PI) / 360), mirror: !!st().cam.mirror,
  };
}

// Freeze the realized flatness: the picture must not change because a reading stopped being open.
export function holdRealized() {
  S.flatHold = st().cam.flat;
  return S.flatHold;
}
export const hold = () => (S.flatHold == null ? null : S.flatHold);
export function releaseHold(){if(!neutralDepth)S.flatHold=null;}
// A new invocation can start at a neutral, parked realization. Its explicit return must preserve
// that realization as well as the requested pose; this belongs to navigation, never parked tasks.
const origins=new Map();let originSerial=0,neutralDepth=0;
export function captureOrigin(label){const id=++originSerial;origins.set(id,{cam:camState(),hold:hold()});return {id,label};}
export const originPose=token=>origins.get(token?.id)?.cam;
export function restoreOriginHold(origin) { S.flatHold = origins.get(origin?.id)?.hold ?? null; }

// ----- the view history -------------------------------------------------

// Entries are reading recipes built by the spatial operations (complete: open kind, parameters and
// the standpoint to arrive at). The trail owns their storage and position, nothing else.
export function pushTrail(label, recipe) {
  if (S.navTrail) return;
  const entry = { ...(recipe || {}), label: label || recipe?.label || readingLabel() };
  const t = S.trail.slice(0, S.trailPos + 1);
  const last = t[t.length - 1];
  if (last && last.label === entry.label) t[t.length - 1] = entry;
  else t.push(entry);
  S.trail = t.slice(-12);
  S.trailPos = S.trail.length - 1;
  ctx.ui();
}

let enterRecipe = null;
// The operation layer registers how a recipe is re-entered; it owns the spatial know-how, this seam
// owns the record and the guarding flag.
export function setEnterRecipe(fn) { enterRecipe = fn; }

export function trail() { return S.trail; }
export function trailPos() { return S.trailPos; }

export async function gotoTrail(i) {
  const e = S.trail[i];
  if (!e || !enterRecipe) return;
  S.navTrail = true;
  try { await enterRecipe(e); } finally { S.navTrail = false; }
  S.trailPos = i;
}

export function backTo(depth, crumbs) {
  const target = crumbs[depth];
  if (depth < 0 || !target) return null;
  S.navTrail = true;
  return enterRecipe(target).finally(() => { S.navTrail = false; });
}

let readingLabel = () => '';
export function setReadingLabel(fn) { readingLabel = fn; }

// Camera's shared prototype evaluation kernel; authored sources contain no generated endpoints.
export { pathSeconds, evaluatePath, connectionPath, findConnection, stations, stationProgress, eye, routeGeometry } from './camera-evaluation.js';
export const framingInstrument=p=>cameraFramingInstrument(p,st().w/st().h);
export function plainPose() {
 const p=camState(); return {...p,target:[p.target.x,p.target.y,p.target.z]};
}
export function applyPose(p) { setCam({...p,target:new V3(...p.target)}); }
export function lookThrough(p){releaseHold();applyPose(p);holdRealized();}
export function restoreCapture(token){const p=originPose(token);if(p){setCam(p);restoreOriginHold(token);}return !!p;}
export async function neutralInvocation(activate){holdRealized();neutralDepth++;try{return await activate();}finally{neutralDepth--;}}
export const resolvedCamera=()=>resolveCamera(ctx.cameraSource,Object.fromEntries(Object.values(ctx.cameraSource.views).flatMap(v=>(v.focus?.ids||[]).map(id=>[id,worldPosition(id)]))));
let worldPosition=()=>null;
export function setWorldPositionResolver(fn){worldPosition=fn;}
export function readingProjection(){
 const c=st().cam,s=S.session,smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 const free=smooth(70,88.5,c.el*180/Math.PI);let flat=free,planF=free;
 if(s){const dir=p=>new V3(Math.cos(p.el)*Math.sin(p.az),Math.sin(p.el),Math.cos(p.el)*Math.cos(p.az));const det=1-smooth(4,30,dir(c).angleTo(dir(s.home))*180/Math.PI);flat=free+(det*(s.flatWanted??1)-free)*s.settle;planF=free*(1-s.settle);}
 if(hold()!=null)flat=planF=hold();if(S.visitor)flat=planF=S.visitor.runtime.pose.flat??0;
 setCam({flat});return {flat,planF};
}
export function settleAfterOrbit({onPlan=()=>{},on3D=()=>{}}={}){
 const s=S.session,c=st().cam,dir=p=>new V3(Math.cos(p.el)*Math.sin(p.az),Math.sin(p.el),Math.cos(p.el)*Math.cos(p.az));
 if(s){if(dir(c).angleTo(dir(s.home))*180/Math.PI<14)return run(()=>fly({...camState(),az:s.home.az,el:s.home.el},dur('settle',420)));return;}
 const degrees=c.el*180/Math.PI;
 if(degrees>79&&degrees<89.99)return run(async()=>{await fly({...camState(),el:Math.PI/2,az:Math.round(c.az/(Math.PI/2))*(Math.PI/2)},dur('settle',420));onPlan();});
 if(degrees<=79){S.last3D=camState();on3D();}
}
export function manipulate({dx=0,dy=0,mode='orbit',zoom=null,point=null,el=null}){
 releaseHold();const c=st().cam;
 if(el!=null){setCam({el});return;}
 if(zoom!=null){const target=c.target.clone();if(point)target.lerp(point,1-zoom);setCam({frameH:Math.max(S.lens==='experience'?.5:2.5,Math.min(120,c.frameH*zoom)),target});}
 else if(mode==='orbit'){const lo=S.session?.kind==='lookup'?-Math.PI/2+1e-4:S.session?-.2:.06;setCam({az:c.az-dx*.006,el:Math.max(lo,Math.min(Math.PI/2,c.el+dy*.005))});}
 else{const m=st().camera.matrixWorld.elements,wpp=st().worldPerPx(),target=c.target.clone();target.addScaledVector(new V3(m[0],m[1],m[2]),-dx*wpp*(c.mirror?-1:1)).addScaledVector(new V3(m[4],m[5],m[6]),dy*wpp);setCam({target});}
}
export function realize(camera,c,aspect){const p=realization({...c,target:c.target.toArray()},aspect);camera.position.fromArray(p.eye);camera.up.fromArray(p.up);camera.lookAt(new V3(...p.target));Object.assign(camera,{fov:p.fov,aspect:p.aspect,near:p.near,far:p.far});camera.updateProjectionMatrix();if(p.mirror){camera.projectionMatrix.elements[0]*=-1;camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();}camera.updateMatrixWorld();return p.dist;}
let activeReturn=null;
export function beginReturn(label){activeReturn=captureOrigin(label);return activeReturn;}
export function putBack(){const result=restoreCapture(activeReturn);activeReturn=null;return result;}
export function discardReturn(){activeReturn=null;}
export function readingFor(view){const p=plainPose();return sameViewPose(p,view?.pose)?'through':p.flat>.97?'plan':'outside';}
export function framePoints(points,{plan=false,captureReturn=true}={}){
 if(!points.length)return false;if(captureReturn)beginReturn('Previous reading');
 const min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))),target=min.map((n,i)=>(n+max[i])/2);
 const frameH=Math.max(plan?12:8,(max[0]-min[0])/(st().w/st().h),max[2]-min[2],max[1]-min[1])*1.45;
 const deck=document.querySelector('#experienceDeck'),offset=(deck?.getBoundingClientRect().height||0)/st().h;
 if(plan)target[2]+=frameH*offset*.6;else target[1]-=frameH*offset*.4;
 return fly({target:new V3(...target),az:plan?0:.7,el:plan?Math.PI/2:1.08,flat:plan?1:0,frameH,mirror:false},dur('camera',600));
}
// Derived framing is Camera intent, never an authored View or an Experience pose policy.
export function deriveFraming(p,hints=[]){
 const target=p.focus.kind==='subjects'?worldPosition(p.focus.ids[0]):p.focus.kind==='region'?p.focus.min.map((n,i)=>(n+p.focus.max[i])/2):[-2,1,0];
 if(!target)return null;
 const pose={target:[...target],az:1.2,el:.25,frameH:3,flat:0,mirror:false};
 for(const hint of hints){if(hint==='Near')pose.frameH=2.5;if(hint==='Far')pose.frameH=5;if(hint==='Left')pose.az-=.65;if(hint==='Right')pose.az+=.65;}
 return {pose,name:hints.length?hints.at(-1)+' of focus':'Auto framing'};
}
