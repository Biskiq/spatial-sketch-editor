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
export function realizeCapabilities() {
 const runtime=S.visitor?.runtime,scene=S.visitor?.source.scene||ctx.sceneSource;if(!scene)return;
 for(const s of Object.values(scene.subjects)) {
  const item=ctx.stage.items.get(s.id);if(!item?.capabilityParts)continue;
  const value=channel=>runtime?.overrides[s.id]?.[channel]?.value??s.properties[channel];
  item.capabilityParts.lid.rotation.z=Number(value('open')||0)*1.2;
  item.capabilityParts.rotor.rotation.y=value('running')?(runtime?.time||0)*5:0;
  const highlight=value('highlight')||value('playing');item.mesh.material.emissive.setHex(highlight?0x856023:0);
  if(s.profile==='light')item.mesh.material.emissiveIntensity=Number(value('intensity')||0)/4;
 }
 const atmosphere=scene.subjects.atmosphere;if(atmosphere&&ctx.stage.ambient)ctx.stage.ambient.intensity=runtime?.overrides.atmosphere?.ambient?.value??atmosphere.properties.ambient;
}
