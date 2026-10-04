// Deterministic authored content only. Loading never selects, opens work or moves Camera.
// The fixture builds into the caller's domains so a load adds Experience content and Camera artifacts
// with fresh identities instead of replacing retained Camera truth.
import {createExperience,createCamera,addPresentation,addView,addStop,addContribution} from './experience-model.js';
export function conformanceFixture(experience=createExperience(),camera=createCamera()) {
 const e=experience,c=camera;
 e.name='Saltmarsh evening Guide';
 const pose=(target,az,frameH=3,el=.3)=>({target,az,el,frameH,flat:0,mirror:false});
 const machine=addPresentation(e,{kind:'subjects',ids:['machine']},'How the drive works');
 e.presentations[machine].meaning='The casing protects the rotor. Follow the power from entry to output.';
 addView(e,c,machine,pose([-10,1.1,1],-1.4,3.5),'Entry','entry');
 addView(e,c,machine,pose([-10,1.1,1],2.9,2.8,.55),'Inside','choice');
 addView(e,c,machine,pose([-10,1.1,1],.25,3.1),'Output','choice');
 const definitions=[['mesh','Materials',[-12,1,-1.8],.9],['piano','Piano',[-5,1,-1.8],1.4],['switch','Power switch',[-11,1,2.6],-.7],['light','Gallery light',[-3,1,2.2],-1.1]];
 const ids=definitions.map(([subject,name,target,az])=>{const id=addPresentation(e,{kind:'subjects',ids:[subject]},name);e.presentations[id].meaning='A different perspective on the gallery.';addView(e,c,id,pose(target,az),'Gallery entry','entry');return id;});
 for(const id of [ids[0],ids[1],ids[2],machine,ids[3],machine])addStop(e,id);
 addContribution(e,machine,{kind:'control',name:'Open casing',subjectId:'machine',capabilityId:'casing',value:1});
 return {experience:e,camera:c};
}
