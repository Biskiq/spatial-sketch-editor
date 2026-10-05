import * as THREE from 'three';
import { S, ctx } from './state.js';
// Renderer realizes Scene fixtures and session effects; it never writes authored properties.
export function buildCapabilitySubjects() {
 const stage=ctx.stage;if(!stage||!ctx.sceneSource)return;
 for(const s of Object.values(ctx.sceneSource.subjects)) {
  if(s.profile==='environment'||stage.items.has(s.id))continue;
  const group=new THREE.Group(),color={machine:0x78917c,piano:0x333b39,light:0xd6aa5e,switch:0xa86046,mesh:0x8a93a0}[s.profile];
  const material=new THREE.MeshStandardMaterial({color,roughness:.8});
  const box=new THREE.Mesh(new THREE.BoxGeometry(s.profile==='piano'?2:1.2,s.profile==='switch'?.5:1.4,.8),material);box.position.y=.7;box.userData={id:s.id,kind:'object'};group.add(box);
  const lid=new THREE.Mesh(new THREE.BoxGeometry(1.2,.1,.8),material.clone());lid.position.y=1.45;lid.userData={id:s.id,kind:'object'};group.add(lid);
  const rotor=new THREE.Mesh(new THREE.CylinderGeometry(.3,.3,.2,12),material.clone());rotor.position.set(0,1.5,0);group.add(rotor);
  group.position.set(s.x,0,s.z);stage.root.add(group);stage.items.set(s.id,{kind:'object',data:s,mesh:box,group,lines:null,capabilityParts:{lid,rotor}});
 }
}
// Outside a visitor runtime there is no authored timeline. A session clock advances only while a
// projected running value is on, so Play/audition visibly turns the rotor instead of freezing at zero;
// stopping drops the phase, and Preview still runs on the visitor's own simulated clock.
const sessionPhase=new Map();let sessionLast=null;
export function realizeCapabilities() {
 const runtime=S.visitor?.runtime,scene=S.visitor?.source.scene||ctx.sceneSource;if(!scene)return;
 const now=performance.now(),dt=sessionLast===null?0:Math.min(.25,Math.max(0,(now-sessionLast)/1000));sessionLast=now;
 // A subject-local audition projects supported values temporarily: it is session state, never a source
 // write, never history, and it is cleared before Preview takes the visitor over.
 const audition=S.visitor?null:S.expAudition;
 for(const s of Object.values(scene.subjects)) {
  const item=ctx.stage.items.get(s.id);if(!item?.capabilityParts)continue;
  const value=channel=>runtime?.overrides[s.id]?.[channel]?.value??audition?.[s.id]?.[channel]??s.properties[channel];
  item.group.visible=value('visible')!==false;
  item.capabilityParts.lid.rotation.z=Number(value('open')||0)*1.2;
  const running=!!value('running'),rotor=item.capabilityParts.rotor;
  if(runtime)rotor.rotation.y=running?(runtime.time||0)*5:0;
  else if(running){const phase=(sessionPhase.get(s.id)||0)+dt*5;sessionPhase.set(s.id,phase);rotor.rotation.y=phase;}
  else{sessionPhase.delete(s.id);rotor.rotation.y=0;}
  // The authored material, never the one a reading swapped in: a ghost or a selection highlight is a
  // render state with no emissive of its own, and the capability value must survive both.
  const mat=item.mesh.userData.baseMat||item.mesh.material;
  if(mat?.emissive){const highlight=value('highlight')||value('playing');mat.emissive.setHex(s.profile==='light'?0xffd273:highlight?0x856023:0);
   if(s.profile==='light')mat.emissiveIntensity=Number(value('intensity')||0)/4;}
 }
 const atmosphere=scene.subjects.atmosphere;if(atmosphere&&ctx.stage.ambient)ctx.stage.ambient.intensity=runtime?.overrides.atmosphere?.ambient?.value??atmosphere.properties.ambient;
}
