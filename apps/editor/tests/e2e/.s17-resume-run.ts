import { chromium, type Page } from '@playwright/test';
import { seedS17BrowserProject } from './s17-seed-mixed-project';
const editorOrigin='http://localhost:5173', apiOrigin='http://localhost:8787';
const seed=await seedS17BrowserProject({editorOrigin,apiOrigin,testAuthSecret:process.env.E2E_TEST_AUTH_SECRET!,user:'agent-user-a'});
console.log(JSON.stringify({phase:'seed',projectId:seed.projectId}));
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader']});
const headers={Cookie:seed.session.cookie,Origin:editorOrigin,'Content-Type':'application/json'};
const cases=JSON.parse(process.env.S17_CASES??'[["3d","catalogue"],["3d","primitive"],["plan","approved"],["3d","approved"],["plan","rectangular"],["3d","rectangular"],["plan","concave"],["3d","concave"]]') as [string,string][];
const results:unknown[]=[];
try {
for(const [reading,subject] of cases){
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const eq=seed.session.cookie.indexOf('=');
 await context.addCookies([{name:seed.session.cookie.slice(0,eq),value:seed.session.cookie.slice(eq+1),url:editorOrigin,httpOnly:true,sameSite:'Lax'}]);
 const page=await context.newPage();page.on('pageerror',error=>console.log('pageerror',error.message));let libraryId:string|null=null;
 const tag=`${subject}-${reading}`; console.log(JSON.stringify({phase:'start',tag}));
 try {
 await page.goto(`${editorOrigin}/project/${seed.projectId}/spatial`);await page.waitForTimeout(3000);
 const dismiss=async()=>{const got=page.getByRole('button',{name:'Got it',exact:true});if(await got.isVisible().catch(()=>false)){await got.evaluate(node=>(node as HTMLButtonElement).click());await got.waitFor({state:'hidden',timeout:5000});}};
 await dismiss();await page.locator(`[data-drafting-reading="${reading}"]`).click();await page.waitForTimeout(700);await dismiss();
 if(reading==='3d'){await page.mouse.move(1230,230);await page.mouse.down({button:'right'});await page.mouse.move(1230,285,{steps:10});await page.mouse.up({button:'right'});await page.waitForTimeout(400);}
 const isForm=subject==='rectangular'||subject==='concave';
 if(subject==='approved'){
  await page.locator('[data-head-find] summary').click();await page.locator('[data-head-find] input').fill('Import model');
  await page.locator('[data-head-find] button').filter({hasText:'Import model'}).click();await page.getByRole('button',{name:'Place another',exact:true}).click();
 const find=page.locator('[data-head-find]');if(await find.getAttribute('open')!==null)await find.locator('summary').click();
 }else if(isForm){
  const name=subject==='rectangular'?'Rectangular form':'Concave form';
  await page.getByPlaceholder('Search subjects by name or identity…').fill(name);await page.locator('.item-row').filter({hasText:name}).click();
  const response=page.waitForResponse(r=>r.url().endsWith('/library/items')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save to My Objects',exact:true}).click();const saved=await(await response).json();libraryId=saved.id??saved.item?.id??null;
  console.log(JSON.stringify({phase:'library-save',tag,saved}));
  await page.locator('[data-stage-dock] [aria-label="Library"]').click();await page.locator('[data-my-objects-toggle]').click();
  await page.locator(`[data-my-objects-item="${libraryId}"] [data-my-objects-insert]`).click();
  await page.getByText(/is ready: click its floor position/).first().waitFor();
 }else{
  await page.locator('[data-stage-dock] [aria-label="Library"]').click();
  if(subject==='catalogue'){await page.getByLabel('Place object',{exact:true}).selectOption('catalogue:paris-salon-chair');await page.getByText(/is ready: click its floor position/).waitFor();}
 }
 await page.waitForTimeout(300);const overlay=await page.locator('svg.overlay').boundingBox();if(!overlay)throw Error('no overlay');
 const center={x:overlay.x+overlay.width/2,y:overlay.y+overlay.height/2};
 let placed=false;
 const points=reading==='plan'?[{x:134,y:-53},{x:84,y:-73},{x:4,y:-23},{x:4,y:10},{x:84,y:10},{x:-76,y:-23}]:[{x:96,y:60},{x:96,y:75},{x:48,y:75},{x:48,y:110},{x:144,y:60},{x:-96,y:30}];
 for(const offset of points){
  const at={x:center.x+offset.x,y:center.y+offset.y};await page.mouse.move(at.x,at.y);await page.mouse.down();await page.mouse.move(at.x+2,at.y+2,{steps:2});await page.waitForTimeout(150);
  const labels=await page.locator('svg.overlay .task-marker title').allTextContents();
  const valid=reading==='plan'?await page.locator('[data-candidate-role="subject"]').count()>0:labels.some(t=>/^\s*-?\d+(?:\.\d+)?,\s*-?\d+(?:\.\d+)?\s+m/.test(t));
  if(valid)await page.screenshot({path:`/tmp/s17-${tag}-place-live.png`});await page.mouse.up();await page.waitForTimeout(350);
  if(!(await page.getByRole('button',{name:'Undo',exact:true}).isDisabled())){placed=true;break;}
 }
 if(!placed)throw Error('pointer Place not accepted');
 console.log(JSON.stringify({phase:'placed',tag}));
 const placedId=await page.locator('[aria-label="Selected subject"] h2.name').textContent();
 if(placedId===null||seed.project.units.scene.data.entities.some(e=>e.id===placedId))throw Error('Place did not select a new identity');
 const added=[{id:placedId}];
 console.log(JSON.stringify({phase:'placed-identity',tag,placedId}));
 const closePlace=page.getByRole('button',{name:'Close Place object',exact:true});await dismiss();if(await closePlace.count())await closePlace.click();await dismiss();
 await page.getByPlaceholder('Search subjects by name or identity…').fill(added[0].id);await page.locator('.item-row').filter({hasText:added[0].id}).click();
 const expand=async()=>{const b=page.getByRole('button',{name:'Expand',exact:true});if(await b.count())await b.click();};
 const collapse=async()=>{const b=page.getByRole('button',{name:'Collapse',exact:true});if(await b.count())await b.click();};
 const field=(id:string)=>isForm?page.getByLabel(({'x':'Form X (m)','z':'Form Z (m)','yaw':'Form yaw (rad)','size':'Form width (m)'} as Record<string,string>)[id]!):page.locator(`[data-field="${({x:'position-x',z:'position-z',yaw:'yaw',size:'size'} as Record<string,string>)[id]}"]`);
 const state=async()=>{await expand();return {x:await field('x').inputValue(),z:await field('z').inputValue(),yaw:await field('yaw').inputValue(),size:await field('size').inputValue()};};
 const ids=isForm?{move:'scene-form-mark-move',turn:'scene-form-mark-turn',scale:'scene-form-mark-scale',size:'scene-form-mark-width'}:{move:'scene-object-move',turn:'scene-object-turn',scale:'scene-object-scale-point',size:'scene-object-size'};
 const mark=(id:string)=>page.locator(`[data-mark-id="${id}"]`);
 const geometry=async(id:string)=>mark(id).evaluate(node=>({line:[...node.querySelectorAll('line.stroke')].map(l=>({x1:Number(l.getAttribute('x1')),y1:Number(l.getAttribute('y1')),x2:Number(l.getAttribute('x2')),y2:Number(l.getAttribute('y2'))}))[0],points:(node.querySelector('polyline.stroke')?.getAttribute('points')??'').trim().split(/\s+/).filter(Boolean).map(p=>p.split(',').map(Number)),circle:[...node.querySelectorAll('circle.anchor,circle.disclosure')].map(c=>({x:Number(c.getAttribute('cx')),y:Number(c.getAttribute('cy'))}))[0]}));
 const screen=(p:{x:number;y:number})=>({x:overlay.x+p.x,y:overlay.y+p.y});
 const drag=async(start:{x:number;y:number},end:{x:number;y:number},action:string)=>{await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:10});await page.waitForTimeout(200);console.log(JSON.stringify({phase:'live',tag,action,active:await page.locator('[data-mark-id].active').allTextContents(),candidate:await page.locator('[data-candidate-id]').count()}));await page.screenshot({path:`/tmp/s17-${tag}-${action}-live.png`});await page.mouse.up();await page.waitForTimeout(400);await dismiss();};
 await page.locator('.item-row').filter({hasText:placedId}).click();
 const before=await state();await collapse();const move=await geometry(ids.move);if(!move.line)throw Error('no Move line');
 let body=false;
 const offsets=isForm?[[0,0],[25,40],[40,40],[25,60],[50,25],[-20,20],[0,20]]:[[0,0],[14,0],[-45,-30],[0,-14],[20,-10],[-25,-20],[30,25],[-35,-25]];
 for(const [dx,dy]of offsets){
  await page.locator('.item-row').filter({hasText:placedId}).click();await collapse();
  const at=screen({x:move.line.x1+dx!,y:move.line.y1+dy!});
  for(const [travelX,travelY] of [[-50,0],[-40,35],[0,35],[-50,65],[0,60],[25,35],[-80,40]]){
   await page.mouse.move(at.x,at.y);await page.waitForTimeout(30);const hovered=await page.locator('[data-mark-id].hovered').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-mark-id')));if(hovered.some(id=>id!==ids.move))break;
   await page.mouse.down();const active=await mark(ids.move).getAttribute('class');if(!active?.includes('active')){await page.mouse.up();break;}
   await page.mouse.move(at.x+travelX!,at.y+travelY!,{steps:10});await page.waitForTimeout(100);
   const refusal=await mark(ids.move).locator('text.refused').count();
   console.log(JSON.stringify({phase:'body-live',tag,travelX,travelY,text:await mark(ids.move).textContent()}));
   if(refusal){await page.mouse.up();continue;}
   await page.screenshot({path:`/tmp/s17-${tag}-body-live.png`});await page.mouse.up();await page.waitForTimeout(250);
   const candidate=await state();await collapse();
   if(candidate.x===before.x&&candidate.z===before.z)continue;
   body=true;break;
  }
  if(body)break;
 }

 if(!body)throw Error('no body point claimed Move');
 const moved=await state();if(before.x===moved.x&&before.z===moved.z)throw Error('body Move source unchanged');await collapse();
 const ring=await geometry(ids.turn);if(ring.points.length<8)throw Error('no Turn ring');const bottom=ring.points.reduce((a,b)=>b[1]!>a[1]!?b:a),top=ring.points.reduce((a,b)=>b[1]!<a[1]!?b:a);
 await drag(screen({x:bottom[0]!,y:bottom[1]!}),screen({x:top[0]!,y:top[1]!}),'turn');const turned=await state();if(turned.yaw===moved.yaw)throw Error('Turn source unchanged');await collapse();
 const disclosure=await geometry(ids.scale);if(!disclosure.circle)throw Error('no Size disclosure');const scaleAt=screen(disclosure.circle);await page.mouse.click(scaleAt.x,scaleAt.y);await mark(ids.size).waitFor({state:'attached'});const size=await geometry(ids.size);if(!size.line)throw Error('no Size line');const dx=size.line.x2-size.line.x1,dy=size.line.y2-size.line.y1,len=Math.hypot(dx,dy)||1;
 await drag(screen({x:size.line.x2,y:size.line.y2}),screen({x:size.line.x2+16*dx/len,y:size.line.y2+16*dy/len}),'size');const sized=await state();if(sized.size===turned.size)throw Error('Size source unchanged');
 await collapse();
 const scaledMove=await geometry(ids.move);
 if(!scaledMove.line)throw Error('no scaled Move mark');
 const mStart=screen({x:scaledMove.line.x2,y:scaledMove.line.y2});
 await page.mouse.move(mStart.x,mStart.y);await page.mouse.down();await page.mouse.move(mStart.x-35,mStart.y+20,{steps:6});await page.waitForTimeout(150);
 await page.screenshot({path:`/tmp/s17-${tag}-sized-move-preview.png`});
 await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(200);
 const scaledRing=await geometry(ids.turn);
 const ringStart=scaledRing.points.reduce((best,point)=>point[1]!>best[1]!?point:best);
 const ringIndex=scaledRing.points.indexOf(ringStart);
 const quarter=scaledRing.points[(ringIndex+6)%scaledRing.points.length]!;
 const rStart=screen({x:ringStart[0]!,y:ringStart[1]!}),rEnd=screen({x:quarter[0]!,y:quarter[1]!});
 await page.mouse.move(rStart.x,rStart.y);await page.mouse.down();await page.mouse.move(rEnd.x,rEnd.y,{steps:6});await page.waitForTimeout(150);
 console.log(JSON.stringify({phase:'sized-turn-preview',tag,active:await page.locator('[data-mark-id].active').allTextContents()}));
 await page.screenshot({path:`/tmp/s17-${tag}-sized-turn-preview.png`});
 await page.keyboard.press('Escape');await page.mouse.up();await page.waitForTimeout(200);
 const afterPreviews=await state();if(JSON.stringify(afterPreviews)!==JSON.stringify(sized))throw Error('cancelled scaled previews changed accepted state');
 const name=()=>page.locator('[aria-label="Selected subject"] h2.name').textContent();const oldName=await name();await (isForm?page.getByRole('button',{name:'Duplicate',exact:true}):page.locator('[data-card-actions] button').filter({hasText:'Duplicate'})).click();await page.waitForTimeout(400);if(await name()===oldName)throw Error('Duplicate source unchanged');
 await collapse();const off=await geometry(ids.move);if(!off.line)throw Error('no duplicate Move');await drag(screen({x:off.line.x2,y:off.line.y2}),{x:overlay.x+8,y:overlay.y+overlay.height-20},'off-floor');
 const undo=page.getByRole('button',{name:'Undo',exact:true});const undoStates:boolean[]=[];for(let i=0;i<5;i++){if(await undo.isDisabled())throw Error(`Undo exhausted after ${i}`);await undo.click();await page.waitForTimeout(200);undoStates.push(await undo.isDisabled());}if(!undoStates[4]||undoStates.slice(0,4).some(Boolean))throw Error('Undo did not restore baseline');
 const result={tag,status:'passed',before,moved,turned,sized,undoStates};results.push(result);console.log(JSON.stringify(result));
 }catch(error){const result={tag,status:'failed',error:String(error)};results.push(result);console.error(JSON.stringify(result));await page.screenshot({path:`/tmp/s17-${tag}-failure.png`}).catch(()=>{});}
 finally{await context.close();if(libraryId){const removed=await fetch(`${apiOrigin}/library/items/${libraryId}`,{method:'DELETE',headers:{Cookie:seed.session.cookie,Origin:editorOrigin}});console.log('library cleanup',removed.status);}}
}
}finally{await browser.close();
 const latest=await(await fetch(`${apiOrigin}/projects/${seed.projectId}`,{headers})).json();
 const removed=await fetch(`${apiOrigin}/projects/${seed.projectId}`,{method:'DELETE',headers,body:JSON.stringify({precondition:{kind:'expected-saved-base',token:latest.savedBaseToken}})});
 console.log('project cleanup',removed.status);console.log(JSON.stringify({results}));}

if(results.some((r:any)=>r.status==='failed'))process.exitCode=1;
