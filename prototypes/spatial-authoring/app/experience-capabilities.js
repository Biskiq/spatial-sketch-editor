// Scene-owned fixture subjects and declared capability policies. Prototype-only simulated media.
export const PROFILES = {
 machine:[{id:'casing',label:'Open casing',channel:'open',kind:'motion',control:'range',min:0,max:1,duration:1.5,sourceEditable:true,replace:'replace'},{id:'rotor',label:'Run rotor',channel:'running',kind:'loop',control:'toggle',sourceEditable:false,replace:'replace'}],
 piano:[{id:'music',label:'Play music',channel:'playing',kind:'playback',control:'buttons',duration:12,sourceEditable:false,replace:'replace'}],
 light:[{id:'intensity',label:'Intensity',channel:'intensity',kind:'state',control:'range',min:0,max:4,sourceEditable:true,replace:'replace'}],
 switch:[{id:'press',label:'Press',channel:'pressed',kind:'state',control:'toggle',sourceEditable:false,replace:'replace'}],
 wall:[{id:'unfold',label:'Unfold',channel:'unfolded',kind:'motion',control:'toggle',duration:1,sourceEditable:true,replace:'replace'}],
 environment:[{id:'ambient',label:'Atmosphere',channel:'ambient',kind:'state',control:'range',min:.05,max:1.5,sourceEditable:true,replace:'replace'}],
 mesh:[{id:'emphasis',label:'Highlight',channel:'highlight',kind:'state',control:'toggle',sourceEditable:false,replace:'replace'}],
 // C9.6 provider replacement: a declared alternative profile used to demonstrate capability loss and
 // gain through the ordinary World adapter. The same instance and geometry are kept; only the declared
 // capability set changes, so an Activity bound to a dropped capability becomes a repairable issue.
 machineBase:[{id:'casing',label:'Open casing',channel:'open',kind:'motion',control:'range',min:0,max:1,duration:1.5,sourceEditable:true,replace:'replace'}],
 meshAnnotated:[{id:'emphasis',label:'Highlight',channel:'highlight',kind:'state',control:'toggle',sourceEditable:false,replace:'replace'},{id:'annotate',label:'Annotate',channel:'annotated',kind:'state',control:'toggle',sourceEditable:false,replace:'replace'}],
 // A Layout representation subject has no mesh of its own: its declared capability projects through the
 // authored Wall's own evaluator (`wallSampler`/`unroll`), transiently and in session only. There is no
 // Scene-owned wall property and no fabricated geometry — the World representation is what moves.
 representation:[{id:'unfold',label:'Unfold the assembly',channel:'unfolded',kind:'motion',control:'toggle',duration:1,sourceEditable:false,replace:'replace'}],
};
// A provider profile is declared data, not authored Experience state: replacing it keeps the subject's
// instance, position and geometry, and only changes which capabilities the adapter enumerates. Gain and
// loss are therefore ordinary descriptor facts, never a rewrite of authored bindings.
export const profileOptions = () => Object.keys(PROFILES);
// Which declared channels this Stage actually realizes. A provider may declare a capability the renderer
// does not consume: the gain is still an honest descriptor fact, but operating it changes nothing, so it
// is reported as unrealized rather than being treated as a successful demonstration.
export const REALIZED_CHANNELS = new Set(['open','running','playing','intensity','pressed','unfolded','ambient','highlight','visible']);
// One authority for whether a declared capability can actually be operated here. Every writer that
// creates, rebinds or runs capability work consults this — the audition, an offer, a captured Activity, a
// station invocation and the visitor runtime — so a capability this Stage does not realize can never be
// authored as work that appears to run.
export const isRealized = (cap) => !!cap && cap.realized !== false;
export function replaceProfile(scene,sid,profile) {
 const s=scene.subjects[sid];if(!s)throw Error('Subject missing');
 if(!PROFILES[profile])throw Error('Unknown provider profile');
 if(s.profile===profile)return s.profile;
 s.profile=profile;scene.revision++;
 return s.profile;
}
export function createSceneCapabilities() {
 const fixtures=[['machine','Machine','machine',-10,1,{open:0,running:false}],['piano','Piano','piano',-5,-1.8,{playing:false}],['light','Light','light',-3,2.2,{intensity:2}],['switch','Switch','switch',-11,2.6,{pressed:false}],['mesh','Imported mesh','mesh',-12,-1.8,{highlight:false}],['atmosphere','Museum atmosphere','environment',0,0,{ambient:.65}]];
 const subjects=Object.fromEntries(fixtures.map(([id,name,profile,x,z,properties])=>[id,{id,name,profile,kind:profile,x,z,properties}]));
 // The Wall assembly is an authored Layout Wall represented through its own evaluator, so the subject
 // names which Wall it presents instead of carrying geometry.
 subjects.wallAssembly={id:'wallAssembly',name:'Round wall assembly',profile:'representation',kind:'representation',x:5.5,z:0,wallId:'rotunda',properties:{unfolded:false}};
 return {revision:0,subjects};
}
export function capability(scene,sid,id) {return capabilities(scene,sid).find(c=>c.id===id)||null;}
const LOCAL_EFFECTS=[{id:'highlight',label:'Highlight',channel:'highlight',kind:'state',control:'toggle',sourceEditable:false,replace:'replace'},{id:'visibility',label:'Visible',channel:'visible',kind:'state',control:'toggle',sourceEditable:false,replace:'replace'}];
export const capabilities = (scene,sid)=>{const s=scene.subjects[sid];if(!s)return[];const declared=[...(PROFILES[s.profile]||[]),...(s.profile==='environment'?[]:LOCAL_EFFECTS.filter(c=>!(PROFILES[s.profile]||[]).some(p=>p.channel===c.channel)))];return declared.map(c=>({...c,realized:REALIZED_CHANNELS.has(c.channel)}));};
export function setSceneValue(scene,sid,cid,value) {
 const c=capability(scene,sid,cid);if(!c?.sourceEditable)throw Error('Capability is session-only');
 if(c.control==='range'&&(!Number.isFinite(value)||value<c.min||value>c.max))throw Error('Value outside supported range');
 scene.subjects[sid].properties[c.channel]=value;scene.revision++;
}
