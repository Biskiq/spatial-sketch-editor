// Deterministic authored content only. Loading never selects, opens work or moves Camera.
import {createExperience,createCamera,addPresentation,addView,addStop,addContribution} from './experience-model.js';
export function conformanceFixture() {
 const experience=createExperience(),camera=createCamera();
 experience.name='Saltmarsh evening Guide';
 const pose=(target,az,frameH=3,el=.3)=>({target,az,el,frameH,flat:0,mirror:false});
 const machine=addPresentation(experience,{kind:'subjects',ids:['machine']},'How the drive works');
 experience.presentations[machine].meaning='The casing protects the rotor. Follow the power from entry to output.';
 addView(experience,camera,machine,pose([-10,1.1,1],-1.4,3.5),'Entry','entry');
 addView(experience,camera,machine,pose([-10,1.1,1],2.9,2.8,.55),'Inside','choice');
 addView(experience,camera,machine,pose([-10,1.1,1],.25,3.1),'Output','choice');
 const definitions=[['mesh','Materials',[-12,1,-1.8],.9],['piano','Piano',[-5,1,-1.8],1.4],['switch','Power switch',[-11,1,2.6],-.7],['light','Gallery light',[-3,1,2.2],-1.1]];
 const ids=definitions.map(([subject,name,target,az])=>{const id=addPresentation(experience,{kind:'subjects',ids:[subject]},name);experience.presentations[id].meaning='A different perspective on the gallery.';addView(experience,camera,id,pose(target,az),'Gallery entry','entry');return id;});
 for(const id of [ids[0],ids[1],ids[2],machine,ids[3],machine])addStop(experience,id);
 addContribution(experience,machine,{kind:'control',name:'Open casing',subjectId:'machine',capabilityId:'casing',value:1});
 return {experience,camera};
}
