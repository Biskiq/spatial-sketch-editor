// Scene-owned fixture subjects and declared capability policies. Prototype-only simulated media.
export const PROFILES = {
 machine:[{id:'casing',label:'Open casing',channel:'open',kind:'motion',control:'range',min:0,max:1,duration:1.5,sourceEditable:true,replace:'replace'},{id:'rotor',label:'Run rotor',channel:'running',kind:'loop',control:'toggle',sourceEditable:false,replace:'replace'}],
 piano:[{id:'music',label:'Play music',channel:'playing',kind:'playback',control:'buttons',duration:12,sourceEditable:false,replace:'replace'}],
 light:[{id:'intensity',label:'Intensity',channel:'intensity',kind:'state',control:'range',min:0,max:4,sourceEditable:true,replace:'replace'}],
 switch:[{id:'press',label:'Press',channel:'pressed',kind:'state',control:'toggle',sourceEditable:false,replace:'replace'}],
 wall:[{id:'unfold',label:'Unfold',channel:'unfolded',kind:'motion',control:'toggle',duration:1,sourceEditable:true,replace:'replace'}],
 environment:[{id:'ambient',label:'Atmosphere',channel:'ambient',kind:'state',control:'range',min:.05,max:1.5,sourceEditable:true,replace:'replace'}],
 mesh:[{id:'emphasis',label:'Highlight',channel:'highlight',kind:'state',control:'toggle',sourceEditable:false,replace:'replace'}],
};
export function createSceneCapabilities() {
 const fixtures=[['machine','Machine','machine',-10,1,{open:0,running:false}],['piano','Piano','piano',-5,-1.8,{playing:false}],['light','Light','light',-3,2.2,{intensity:2}],['switch','Switch','switch',-11,2.6,{pressed:false}],['mesh','Imported mesh','mesh',-12,-1.8,{highlight:false}],['atmosphere','Museum atmosphere','environment',0,0,{ambient:.65}]];
 return {revision:0,subjects:Object.fromEntries(fixtures.map(([id,name,profile,x,z,properties])=>[id,{id,name,profile,kind:profile,x,z,properties}]))};
}
export function capability(scene,sid,id) {const s=scene.subjects[sid];return s?PROFILES[s.profile]?.find(c=>c.id===id)||null:null;}
export const capabilities = (scene,sid)=>PROFILES[scene.subjects[sid]?.profile]||[];
export function setSceneValue(scene,sid,cid,value) {
 const c=capability(scene,sid,cid);if(!c?.sourceEditable)throw Error('Capability is session-only');
 if(c.control==='range'&&(!Number.isFinite(value)||value<c.min||value>c.max))throw Error('Value outside supported range');
 scene.subjects[sid].properties[c.channel]=value;scene.revision++;
}
