/* Static, deterministic design-board compositor. No authored data, application
 * controllers, editing behavior, navigation evaluator or production imports. */
import * as THREE from 'three';

const BOARD = new URLSearchParams(location.search).get('board') || '02-presentation-3d';
const names = ['The drive', 'Materials', 'Gallery light', 'Evening atmosphere'];
const icons = {
  museum:'M3 20V8l9-6 9 6v12H3Zm5 0V10m8 10V10M3 8h18',
  plus:'M12 5v14M5 12h14', search:'m20 20-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  left:'m14 5-7 7 7 7',right:'m10 5 7 7-7 7',down:'m6 9 6 6 6-6',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  camera:'M3 7h5l2-3h5l2 3h4v13H3V7Zm12 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  path:'M4 19c4 0 1-13 6-13s0 13 6 13 3-12 5-12M4 19h.01M21 7h.01',
  play:'m8 4 12 8-12 8V4',pause:'M8 5v14M16 5v14',
  undo:'m8 5-5 5 5 5M3 10h11a7 7 0 0 1 7 7',redo:'m16 5 5 5-5 5M21 10H10a7 7 0 0 0-7 7',
  star:'m12 3 2.7 5.6 6.2.9-4.5 4.4 1 6.1-5.4-2.9L6.5 20l1-6.1L3 9.5l6.3-.9L12 3',
  guide:'M4 4h5v5H4V4Zm11 11h5v5h-5v-5M9 6h8v9M6 9v8h9',
  object:'m12 2 9 5v10l-9 5-9-5V7l9-5Zm0 10L3 7m9 5 9-5m-9 5v10',
  edit:'m4 16 12-12 4 4-12 12H4v-4Zm10-10 4 4',
  more:'M5 12h.01M12 12h.01M19 12h.01',close:'m6 6 12 12M6 18 18 6',
  check:'m5 12 4 4L20 5',warning:'m12 3 10 18H2L12 3Zm0 6v5m0 3v.01',
  link:'M10 8 8 10a4 4 0 0 0 6 6l2-2M14 16l2-2a4 4 0 0 0-6-6l-2 2M8 16l8-8',
  collapse:'m14 5-7 7 7 7M20 5v14',trash:'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  grip:'M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01',
};
function ic(name,cls='icon'){return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]||icons.object}"/></svg>`}
function btn(label,icon,cls=''){return `<button class="btn ${cls}" type="button">${icon?ic(icon):''}<span>${label}</span></button>`}
function ib(name,label){return `<button class="icon-btn" aria-label="${label||name}">${ic(name)}</button>`}
function thumb(mode='overview',cls='thumb'){return `<div class="${cls}" data-scene="${mode}"></div>`}
const is = (s)=>BOARD.includes(s);
const narrow = is('narrow');
const empty = is('01-');
const plan = is('plan')||is('reorder')||is('narrow-stop');
const presentation = is('02-');
const view = is('03-')||is('04-');
const stop = is('06-')||is('07-')||is('14-');
const guide = is('05-');
const path = is('08-')||is('15-');
const playback = is('09-')||is('10-');
const through = is('04-')||is('10-');
const visitor = is('11-')||is('12-')||is('13-');

function index(){
  return `<aside class="index"><div class="index-top"><strong>Experience</strong>${ib('collapse','Collapse Index')}</div>
  <div class="search">${ic('search')}<span>Find a Presentation</span></div>
  <div class="section-label"><span>Presentations</span><span>${empty?'0':'4'}</span></div>
  ${empty?'<p class="index-empty">Your museum is ready for its first Presentation.</p>':`<div class="index-list">${names.map((n,i)=>`<div class="index-row ${i===0&&presentation?'selected':i===0&&view?'active-task':''}"><span class="mini">${ic(i===0?'object':i===1?'camera':i===2?'museum':'eye')}</span><span class="row-label"><strong>${n}</strong><small>${[3,2,1,2][i]} available Views</small></span></div>`).join('')}</div>
  <div class="guide-link"><div class="section-label"><span>Guide</span></div><div class="index-row ${stop||guide||path||playback?'active-task':''}"><span class="mini">${ic('guide')}</span><span class="row-label"><strong>Museum highlights</strong><small>4 Stops</small></span></div></div>`}
  <div class="index-bottom">${empty?'':btn('New Presentation','plus','primary')}${btn('Browse World','search','quiet')}</div></aside>`;
}
function availableViews(){return `<div class="view-list">${[['Overview','overview',true],['Inside','inside',false],['Output','output',false]].map(([name,mode,def])=>`<div class="view-row">${thumb(mode)}<div><strong>${name}</strong><small>${def?'★ Default View':'Available to visitors'}</small></div></div>`).join('')}</div>`}
function title(kind,name,description=''){return `<header><div class="kind">${kind}</div><h1>${name}</h1>${description?`<p>${description}</p>`:''}</header>`}
function card(){
 let content='';
 const top=`<div class="card-top"><span class="crumb">${ic('left')}${view?'The drive':path||playback?'Stop 2 · The drive':'Experience'}</span>${ib('more','More actions')}</div>`;
 if(presentation){
   content=title('Presentation','The drive','A closer look at the mechanism.')+`<section><h2 class="flex">Available Views <span class="pill">3</span></h2>${availableViews()}<div style="margin-top:10px">${btn('Capture View','camera','full')}</div></section>
   <section><h2>Guide use</h2><p>Appears in 2 Stops. Each Stop curates its own Views.</p><div style="margin-top:12px">${btn('Add to Guide','plus','primary full')}</div></section>
   <section><div class="property"><span>Scene subject</span><strong>Machine</strong></div><div class="link">${ic('right')}Open subject</div></section>`;
 }else if(view){
   content=title('View · The drive','Inside','Shared framing for this Presentation.')+`<div class="preview-image" data-scene="inside"><span class="caption">Camera View · Perspective</span></div>
   ${through?'<div class="notice">'+ic('eye')+'Looking through · Exit View is on the Stage</div>':btn('Look through','eye','primary full')}
   <div class="view-actions">${btn('Adjust View','edit')}</div>
   <section><div class="property"><span>Default View</span><span class="pill">Overview</span></div>${btn('Make Default','star','full')}<p class="tiny" style="margin-top:8px">Changes future arrivals in free exploration.</p></section>
   <section><h2>Used in this Guide</h2><p>Stop 2 and Stop 4 use this framing.</p><div class="link">${ic('right')}Open Presentation</div></section>`;
 }else if(stop){
   content=title('Stop 2 · Museum highlights','The drive','Views in this guided occurrence.')+`<div class="stop-source"><span>Presentation · <b>The drive</b></span>${ic('right')}</div>
   <section><h2 class="flex">Views in this Stop <span class="pill">2 of 3</span></h2>
   <div class="slot"><span class="grip">⠿</span>${thumb('overview')}<div><strong>Overview</strong><small>First View · entry</small><div class="time"><span>Hold</span><span class="small-field">4.0 s</span></div></div></div>
   <div class="slot-connector">${ic('path')}Travel · 2.6 s</div>
   <div class="slot"><span class="grip">⠿</span>${thumb('inside')}<div><strong>Inside</strong><small>Last View</small><div class="time"><span>Hold</span><span class="small-field">5.0 s</span></div></div></div>
   <div class="ghost-action">${ic('plus')}Add View to this Stop</div>
   <div class="notice">${ic('check')}Output stays available in free exploration.</div></section>
   <section><h2>Next Stop</h2><div class="stop-next"><span class="n">3</span><div><strong>Materials</strong><small>Entry · Close-up</small></div></div><div class="property"><span>After the last View</span><span class="pill camera">Travel</span></div>${btn('Edit movement','path','full')}</section>
   <div class="link">${ic('play')}Play this Stop</div>`;
 }else if(guide){
   content=title('Guide','Museum highlights','A curated visit through the same museum.')+`<div class="summary-stat"><div><strong>4</strong><small>Stops</small></div><div><strong>6</strong><small>guided Views</small></div><div><strong>3</strong><small>Presentations</small></div></div>
   <section><h2>Compose the visit</h2><p>Drag Stops in the Guide below. Select a Stop to choose its Views.</p><div style="margin-top:15px">${btn('Add Presentation','plus','primary full')}</div></section>
   <section><h2>Available beyond the Guide</h2><p>Evening atmosphere and omitted Views remain available in free exploration.</p></section>
   <section><h2>First encounter</h2><p>Gallery light · entrance View</p></section>`;
 }else if(path||playback){
   content=title('Stop 2 · The drive',path?'Movement':'Playback',path?'The drive → Materials':'Overview → Inside · this Stop')+`<section><h2>${path?'After the last View':'This Stop'}</h2>
   ${path?`<div class="segment-control"><span>Cut</span><span class="selected">Travel</span></div><div class="endpoints">From<strong>Inside · The drive</strong>To<strong>Close-up · Materials</strong></div><div class="property"><span>Camera Path</span><span class="pill camera">Ready</span></div><div class="property"><span>Movement time</span><strong>3.2 s</strong></div>`:`<div class="endpoints">First View<strong>Overview · hold 4.0 s</strong>Movement<strong>Travel · 2.6 s</strong>Last View<strong>Inside · hold 5.0 s</strong></div><div class="property"><span>Total</span><strong>11.6 s</strong></div>`}
   </section><div class="notice">${ic('link')}${path?'This path is reused in another transition. Editing it changes both.':'Playback reads the same Camera movement as the visitor run.'}</div>
   ${path?`<section><h2>Selected path point</h2><p>Drag on the Stage to reshape the route.</p><div class="link">${ic('trash')}Remove point</div></section>`:`<section><h2>At the end</h2><p>The last View waits for Next. Next during playback skips to Materials using Cut.</p></section>`}
   <section><div class="link">${ic('left')}Back to Stop 2</div></section>`;
 }
 return `<aside class="card">${top}${content}</aside>`;
}
function guideDeck(){
 const titles=['Gallery light','The drive','Materials','The drive'];
 const views=[1,2,1,2];
 return `<div class="guide-deck"><div class="guide-head">${ic('guide')}<strong>Museum highlights</strong><span class="meta">4 Stops · drag to reorder</span><span class="push"></span>${ib('plus','Add a Stop')}${ib('collapse','Collapse Guide')}</div><div class="guide-lane">${titles.map((n,i)=>`${is('07-')&&i===1?'<span class="drop-marker"></span>':''}<div class="stop-chip ${i===1&&!guide?'selected':''} ${is('07-')&&i===2?'dragged':''}"><span class="num">${i+1}</span><span><strong>${n}</strong><small>${views[i]} ${views[i]===1?'View':'Views'}</small></span>${is('07-')&&i===1?'<span class="chip-menu">···</span>':''}</div>${i<3?`<div class="edge-chip">${ic(i===0?'right':'path')}<span>${i===0?'Cut':'Travel'}</span></div>`:''}`).join('')}</div></div>
 ${is('07-')?`<div class="menu reorder-menu"><div class="item">${ic('right')}Open Presentation</div><div class="item">${ic('left')}Move earlier</div><div class="item">${ic('right')}Move later</div><div class="item separator">${ic('trash')}Remove Stop</div></div>`:''}`;
}
function instrument(){
 if(path) return `<div class="route-instrument"><div class="inst-head">${ic('path')}<strong>Inside → Close-up</strong><span class="pill camera">Camera Path</span><span class="spacer"></span>${ib('close','Close movement')}</div><div class="path-buttons">${btn('Add path point','plus')}<span class="tiny">Drag points on the Stage</span>${btn('Play movement','play')}</div></div>`;
 return `<div class="route-instrument"><div class="inst-head">${ic('play')}<strong>Play this Stop</strong><span class="pill">The drive</span><span class="spacer"></span>${ib('close','Close playback')}</div><div class="player-row"><button class="play" aria-label="Pause">${ic('pause')}</button><div class="timeline"><span class="part" style="left:0;width:34.5%">Overview</span><span class="part travel" style="left:34.5%;width:22.4%">Travel</span><span class="part" style="left:56.9%;width:43.1%">Inside</span><span class="playhead"></span></div><span class="clock">0:09.2 / 0:11.6</span></div><div class="follow"><span class="switch ${through?'on':''}"></span><b>Follow Camera</b><span>${through?'Exit restores your authoring standpoint':'Off · observe the Camera rig'}</span></div></div>`;
}
function context(){
 if(through) return `<div class="inspection-bar"><span class="dot"></span><span>${playback?'Following Camera · The drive':'Looking through · Inside'}</span>${playback?'':btn('Exit View','left')}</div>`;
 return `<div class="stage-top"><div class="context">${stop||guide||path||playback?`<span class="back">${ic('left')}${path||playback?'Back to Stop 2':'Back to Presentations'}</span>`:''}<span class="overline">${empty?'World · ready to compose':path?'Movement · Stop 2 → Stop 3':playback?'Playback · Stop 2':stop?'Guide · Stop 2 of 4':guide?'Guide overview':'Presentation · The drive'}</span><strong>${empty?'Saltmarsh Museum':path?'Inside → Close-up':playback?'Overview → Inside':stop||presentation||view?'The drive':'Museum highlights'}</strong></div><div class="representation"><span class="${!plan?'selected':''}">3D</span><span class="${plan?'selected':''}">Plan</span></div></div>`;
}
function authoring(){
 return `<main class="app ${empty?'empty':''}"><header class="head"><div class="brand">${ic('museum')}<span>Museum Editor</span></div><div class="project">Saltmarsh Museum</div><div class="lens"><span>World</span><span class="chosen">Experience</span></div><span class="spacer"></span><span class="state"><i></i>Session draft</span><div class="history-controls" style="display:flex">${ib('undo','Undo')}${ib('redo','Redo')}</div>${btn('Preview','play','gold')}</header>
 ${index()}<section class="stage ${plan?'plan':''}"><div data-scene="${through?'inside':plan?'plan':'stage'}" class="museum-canvas"></div>${context()}
 ${empty?`<div class="empty-invite"><div class="step">START WITH A COMPOSITION</div><h1>Give your museum<br>a first encounter.</h1><p>Choose a viewpoint, then save it as a reusable Presentation.</p>${btn('New Presentation','plus','gold')}<div class="text-link">Or select an object → Present this</div></div>`:''}
 ${through?'<div class="frame-corners"></div>':'<div class="stage-markers"></div>'}
 ${stop||guide?guideDeck():path||playback?instrument():''}
 <div class="stage-foot"><span class="scale"><span class="scale-line"></span>0 &nbsp;&nbsp; 3 m</span><span class="axis">${plan?'X  →   Z  ↑':'Y ↑'} &nbsp; · &nbsp; ${through?'Perspective':plan?'Plan':'3D'}</span></div></section>
 ${empty?'':card()}<footer class="status-bar"><span>${through?'Inspecting a View':path?'Drag a path point · release to finish':is('07-')?'Drag Stop · release to reorder · Esc cancels':'Select to inspect · Look through to visit'}</span><span class="proposal-tag">EXPERIENCE V3 · PROPOSED DESIGN SPECIMEN</span></footer></main>`;
}
function visitorBoard(){
 const entry=is('11-'),explore=is('13-');
 return `<main class="visitor"><div class="museum-canvas" data-scene="visitor"></div><div class="visitor-top"><span class="visitor-brand">Saltmarsh Museum</span>${btn('Exit Preview','close','exit')}</div>
 ${entry?`<div class="visitor-entry"><span class="kind">WELCOME TO THE MUSEUM</span><h1>Ways of seeing<br>Saltmarsh.</h1><p>Follow a curated visit, or choose what catches your eye.</p><div class="choices">${btn('Start guided tour','play','gold')}${btn('Explore freely','right','light-on-dark')}</div><div class="detail">Museum highlights · 4 moments &nbsp; / &nbsp; Explore every available viewpoint</div></div>`:explore?`<div class="visitor-mode">Exploring freely</div><div class="explore-tray"><header><strong>The drive</strong><span>Choose a viewpoint</span><span>Browse the museum ${ic('right')}</span></header><div class="explore-items">${[['Overview','overview'],['Inside','inside'],['Output','output']].map(([n,m],i)=>`<div class="explore-item ${i===2?'selected':''}">${thumb(m)}<span><strong>${n}</strong><small>${['See the full machine','Look into the housing','Follow the output shaft'][i]}</small></span></div>`).join('')}</div></div>`:`<div class="visitor-mode">Museum highlights · 2 of 4</div><div class="visitor-nav">${btn('Previous stop','left','exit')}<div class="visitor-info"><h1>The drive</h1><p>See how the mechanism turns motion into power.</p><div class="progress"><i class="done"></i><i></i></div><div class="visitor-controls">${btn('Pause','pause','quiet')}<span>Overview &nbsp; · &nbsp; 1 of 2</span>${btn('Inside','right','quiet')}</div></div>${btn('Next · Materials','right','gold')}</div>`}
 <div class="review-footer">PROPOSED DESIGN SPECIMEN · ILLUSTRATIVE GEOMETRY, NOT A RUNTIME CAPTURE</div></main>`;
}
document.getElementById('specimen').innerHTML=visitor?visitorBoard():authoring();

// One illustrative museum fixture for every specimen. Camera positions are fixed
// and marker projections below come from this same fixture and its actual camera.
const scene=new THREE.Scene();
scene.background=new THREE.Color('#163d32');
scene.add(new THREE.HemisphereLight('#f4f8f1','#517463',2.1));
const sun=new THREE.DirectionalLight('#fff4d6',3);sun.position.set(-5,18,10);scene.add(sun);
const fill=new THREE.DirectionalLight('#d1e7ef',1.2);fill.position.set(12,6,-5);scene.add(fill);
const material=(color,roughness=.85,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
const walls=material('#c9d2ca'),floors=material('#d4dcd2'),dark=material('#315444'),brass=material('#b59a5d',.38,.58),iron=material('#53695e',.5,.3),wood=material('#755b3b');
function box(w,h,d,x,y,z,mat){const obj=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);obj.position.set(x,y,z);scene.add(obj);return obj}
box(16,.20,9,-2,-.1,0,floors);box(16,2.75,.22,-2,1.375,-4.5,walls);
box(.22,2.75,9,-10,1.375,0,walls);box(16,.35,.22,-2,.175,4.5,walls);
box(.24,2.75,3,6,1.375,-3,walls);box(.24,2.75,3,6,1.375,3,walls);box(.24,.8,3,6,2.4,0,walls);
for(let i=0;i<48;i++){const t=(i+.5)/48*Math.PI*2;if(t<.14*Math.PI||t>1.75*Math.PI||t>1.11*Math.PI&&t<1.24*Math.PI)continue;
 const x=9.3+Math.cos(t)*3.25,z=Math.sin(t)*3.25;const h=z>1.1?.45:2.75;const b=box(.44,h,.22,x,h/2,z,walls);b.rotation.y=-t-Math.PI/2;}
const disk=new THREE.Mesh(new THREE.CylinderGeometry(3.25,3.25,.2,64),floors);disk.position.set(9.3,-.1,0);scene.add(disk);
const g=new THREE.GridHelper(50,50,'#496b56','#274a3b');g.position.y=-.25;scene.add(g);
const planGrid=new THREE.GridHelper(50,50,'#ccd9d0','#dce5df');planGrid.position.y=-.25;planGrid.visible=false;scene.add(planGrid);
// Machine exhibit: plinth, crank wheels, housing and readable mechanical details.
box(2.5,.55,1.8,-4,.275,.5,wood);box(2.3,.12,1.65,-4,.61,.5,iron);
box(1.25,.85,.9,-4.5,1.10,.4,dark);box(.45,.55,1.05,-3.45,.92,.4,iron);
function wheel(x,y,z,r){const torus=new THREE.Mesh(new THREE.TorusGeometry(r,.065,12,48),brass);torus.position.set(x,y,z);scene.add(torus);
 for(let i=0;i<8;i++){const angle=i*Math.PI/4;const sp=new THREE.Mesh(new THREE.BoxGeometry(r*1.8,.045,.07),brass);sp.rotation.z=angle;sp.position.set(x,y,z);scene.add(sp)}
 const hub=new THREE.Mesh(new THREE.CylinderGeometry(.14,.14,.18,16),iron);hub.rotation.x=Math.PI/2;hub.position.set(x,y,z);scene.add(hub)}
wheel(-4.35,1.52,1.0,.55);wheel(-3.30,1.18,1.0,.32);
const shaft=box(1.75,.12,.12,-3.95,1.2,.75,brass);
box(1.5,.48,.8,1,.24,-1.7,walls);const sculpture=new THREE.Mesh(new THREE.IcosahedronGeometry(.42,0),brass);sculpture.position.set(1,.94,-1.7);scene.add(sculpture);
box(2.3,.35,.62,1.0,.35,2.9,wood);box(.08,.4,.58,.1,.15,2.9,dark);box(.08,.4,.58,1.9,.15,2.9,dark);
box(1.2,.7,1.2,9.3,.35,0,walls);const stone=new THREE.Mesh(new THREE.SphereGeometry(.42,18,12),iron);stone.scale.y=1.6;stone.position.set(9.3,1.32,0);scene.add(stone);
for(let i=0;i<4;i++){const x=-8.0+i*3.4;box(1.95,1.18,.08,x,1.65,-4.32,wood);box(1.76,.99,.095,x,1.65,-4.26,material(['#769594','#47745b','#879ba2','#c3ae7c'][i]));box(1.76,.13,.11,x,1.44,-4.23,material('#d1b875'))}
// Small wall labels and floor boards encode plausible scale without decorative imagery.
for(let x=-9;x<6;x+=1.1)box(.018,.005,8.9,x,.011,0,material('#bfc9bd'));
const planOutlines=new THREE.Group();
for(const mesh of scene.children.filter(o=>o.isMesh&&o.material===walls)){
 const lines=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry),new THREE.LineBasicMaterial({color:'#42634e'}));
 lines.position.copy(mesh.position);lines.rotation.copy(mesh.rotation);planOutlines.add(lines);
}
planOutlines.visible=false;scene.add(planOutlines);
const poses={
 overview:{pos:[-1.8,2.25,5.3],target:[-4,1.2,.5],fov:47},
 inside:{pos:[-6.55,1.8,2.4],target:[-4.05,1.4,.65],fov:49},
 output:{pos:[-1.7,1.7,2.0],target:[-3.6,1.1,.6],fov:48},
 closeup:{pos:[.6,1.7,.8],target:[1,.9,-1.7],fov:45},
 visitor:{pos:[2.8,2.2,5.7],target:[-3,1.25,0],fov:57},
 stage:{pos:[20,23,28],target:[.2,.25,0],fov:40},
 plan:{pos:[1.3,40,.1],target:[1.3,0,0],fov:40},
};
const cameras=[];
function renderScene(host,mode){
 const w=host.clientWidth||300,h=host.clientHeight||200,p=poses[mode]||poses.overview;
 const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(w,h);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
 const camera=mode==='plan'?new THREE.OrthographicCamera(-12.5,12.5,12.5*h/w,-12.5*h/w,.1,200):new THREE.PerspectiveCamera(p.fov,w/h,.1,200);
 camera.position.set(...p.pos);if(mode==='plan')camera.up.set(0,0,-1);camera.lookAt(...p.target);camera.updateMatrixWorld();
 const previous=scene.background;scene.background=new THREE.Color(mode==='plan'?'#edf2ee':mode==='stage'?'#163d32':'#d0d8ce');
 planOutlines.visible=mode==='plan';
 g.visible=mode==='stage';planGrid.visible=mode==='plan';
 renderer.render(scene,camera);scene.background=previous;planOutlines.visible=false;planGrid.visible=false;g.visible=true;
 renderer.domElement.className='museum-canvas';host.prepend(renderer.domElement);cameras.push({host,camera,renderer,w,h,mode});return camera;
}
for(const host of document.querySelectorAll('[data-scene]'))renderScene(host,host.dataset.scene);
const main=cameras.find(c=>c.host.closest('.stage'));
function project(pos){const v=new THREE.Vector3(...pos).project(main.camera);return {x:(v.x+1)*main.w/2,y:(1-v.y)*main.h/2}}
function marker(name,mode,selected=false,number=''){
 const p=project(poses[mode].pos);
 const target=project(poses[mode].target),bearing=Math.atan2(target.y-p.y,target.x-p.x)*180/Math.PI+90;
 return `<div class="marker ${selected?'selected':''}" style="left:${p.x}px;top:${p.y}px"><svg viewBox="0 0 28 28" fill="none"><path d="M14 14 5 2 23 2Z" transform="rotate(${bearing},14,16)" fill="#79c6de33" stroke="#79c6de" stroke-width="1"/><circle cx="14" cy="16" r="4.5" fill="#176b88" stroke="${selected?'#e6b85c':'#d4edf5'}" stroke-width="${selected?3:1.5}"/>${number?`<text x="14" y="19" text-anchor="middle" font-family="sans-serif" font-size="8" fill="white">${number}</text>`:''}</svg><span class="label">${name}</span></div>`;
}
if(main&&!empty&&!through){
 let markers='';
 if(presentation||view)markers=marker('★ Overview','overview')+marker('Inside','inside',view)+marker('Output','output');
 if(stop)markers=marker('1 · Overview','overview',false,'1')+marker('2 · Inside','inside',true,'2');
 if(path)markers=marker('Inside · from','inside')+marker('Close-up · to','closeup');
 if(playback)markers=marker('Overview','overview')+marker('Inside','inside');
 const labels=[['Machine gallery',[-6,0,-2]],['Rotunda',[9.3,0,2]]];
 markers+=labels.map(([n,pos])=>{const p=project(pos);return `<span class="location-label" style="left:${p.x}px;top:${p.y}px">${n}</span>`}).join('');
 document.querySelector('.stage-markers').innerHTML=markers;
 if(path||playback){
   const pts=path?[poses.inside.pos,[-4.6,1.65,2.4],[-1.4,1.7,2.3],poses.closeup.pos]:[poses.overview.pos,[-3.3,1.95,3.4],[-4.8,1.85,2.7],poses.inside.pos];
   const projected=pts.map(project),line=projected.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
   const circles=path?projected.slice(1,-1).map((p,i)=>`<circle cx="${p.x}" cy="${p.y}" r="${i===0?7:5}" fill="#ffffff" stroke="${i===0?'#b38b3d':'#176b88'}" stroke-width="${i===0?3:2}"/>`).join(''):'';
   const rig=projected[projected.length-1];
   document.querySelector('.stage').insertAdjacentHTML('beforeend',`<svg class="route-overlay" viewBox="0 0 ${main.w} ${main.h}"><path d="${line}" fill="none" stroke="${plan?'#176b88':'#79c6de'}" stroke-width="2"/>${circles}${playback?`<rect x="${rig.x-7}" y="${rig.y-6}" width="14" height="12" rx="2" fill="#e6b85c" stroke="#102e26" stroke-width="2"/>`:''}</svg>`);
 }
}
await document.fonts.ready;
window.__boardReady=true;
window.__boardInfo={board:BOARD,width:innerWidth,height:innerHeight,canvases:cameras.length,kind:'static-generated-mockup'};
