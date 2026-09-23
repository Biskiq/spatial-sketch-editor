// REGISTER atlas verification. Design-artifact checks only: no production imports, no editor writes.
// Run: node docs/roadmap/p26-spatial-depth/design/proposals/register/check-atlas.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {atlasScript, atlasContext, frameDrawing, frameSvg, FRAMES, dir} from './export-frames.mjs';

const failures=[];
const note=[];
const fail=(what,detail)=>failures.push(`${what}${detail?` — ${detail}`:''}`);

// ---------------------------------------------------------------- matrix
// The scenario consistency matrix, executable. One row per atlas board:
// durable view control, canonical selected source in Navigator, status-bar reference,
// Inspector identity and the Navigator row that represents the selection.
const MATRIX=[
  ['section','Section A','O-DOOR','O-DOOR','O-DOOR'],
  ['entry','Place section','O-DOOR','O-DOOR','O-DOOR'],
  ['editcut','Plan · editing the section range','O-DOOR','O-DOOR','O-DOOR'],
  ['elevation','Wall Elevation','O-DOOR','O-DOOR','O-DOOR'],
  ['gable','Wall Elevation','W-SHARED','W-SHARED','W-SHARED'],
  ['arch','Wall Elevation','O-WINDOW','O-WINDOW','O-WINDOW'],
  ['curve','Wall Elevation','W-CURVE','W-CURVE','W-CURVE'],
  ['spanning','Ceiling','not created','Draft region','Draft · not in document'],
  ['ceiling-section','Section A','C-SPAN','C-SPAN','C-SPAN'],
  ['ceiling-three','3D','C-SPAN','C-SPAN','C-SPAN'],
  ['multiple','Ceiling','C-GABLE','C-GABLE','C-GABLE'],
  ['joint','Section B','C-GABLE','C-GABLE','C-GABLE'],
  ['focus','Ceiling Focus','C-GABLE','C-GABLE','C-GABLE'],
  ['dense-plan','Place section','W-N2M2','W-N2M2','W-N2M2'],
  ['dense','Section A','W-N2M2','W-N2M2','W-N2M2'],
  ['dense-reveal','Section A','O-N4','O-N4','O-N4'],
  ['excluded','Section A','O-WINDOW','O-WINDOW','O-WINDOW'],
  ['crop','Section A','O-DOOR','O-DOOR','O-DOOR'],
  ['return','Plan','O-DOOR','O-DOOR','O-DOOR'],
  ['three','3D','O-DOOR','O-DOOR','O-DOOR'],
  ['objects','Section C','P-PLAT','P-PLAT','P-PLAT'],
  ['invalid','Wall Elevation','O-DOOR','O-DOOR','O-DOOR'],
  ['ridge','Wall Elevation','W-SHARED','W-SHARED','W-SHARED'],
  ['deleted','Wall Elevation',null,'—','W-SHARED unavailable'],
  ['oblique','Wall Elevation','O-WINDOW','O-WINDOW','O-WINDOW'],
  ['empty','Place section',null,'—','No selection'],
  ['miss','Section A','O-DOOR','O-DOOR','O-DOOR'],
  ['unclosed','Ceiling','not created','Draft region','Draft · not in document'],
  ['stretch','Plan','O-DOOR','O-DOOR','O-DOOR']
];
// Actions that legitimately produce no document change in a headless context:
// they focus an Inspector field that only exists in the assembled atlas.
const FOCUS_ACTIONS=['head','sill','width'];

// ---------------------------------------------------------------- harness
function stubDom(){
  const nodes=new Map();
  const mk=owner=>({owner,innerHTML:'',textContent:'',value:'',style:{},dataset:{},setAttribute(){},removeAttribute(){},addEventListener(){},focus(){},select(){},closest(){return null},querySelector(){return null},querySelectorAll(){return []}});
  const document={querySelector(sel){if(!nodes.has(sel))nodes.set(sel,mk(sel));return nodes.get(sel);},querySelectorAll(){return [];},addEventListener(){},createElement(){return mk('created');},body:mk('body')};
  return {document,nodes};
}
const code=atlasScript();
const {document,nodes}=stubDom();
const context=vm.createContext({console,document,window:{innerWidth:1440,innerHeight:900,addEventListener(){}},location:{search:'',href:`file://${dir}/atlas.html`},URLSearchParams});
try{vm.runInContext(`${code}\n;globalThis.__ready=true`,context,{filename:'atlas.html'});}
catch(e){fail('atlas script does not evaluate',e.message);}
const run=expression=>vm.runInContext(expression,context);
const frameHtml=()=>nodes.get('#frame')?.innerHTML||'';
const notesHtml=()=>nodes.get('#notes')?.innerHTML||'';
const statusOf=html=>{const f=html.match(/<footer class="status">([\s\S]*?)<\/footer>/);if(!f)return null;const m=f[1].match(/<span class="mono">([^<]*)<\/span>/);return m?m[1].trim():null;};
const navSelectedRef=html=>{const m=html.match(/<div class="navrow[^"]*\bsel\b[^"]*">([\s\S]*?)<\/div>/);if(!m)return null;const r=m[1].match(/<span class="ref">([^<]*)<\/span>/);return r?r[1].trim():null;};
const inspectorRef=html=>{const i=html.match(/<aside class="inspector">([\s\S]*)<footer class="status">/);if(!i)return null;const r=i[1].match(/<p class="ref">([^<]*)<\/p>/);if(r)return r[1].trim();const h=i[1].match(/<h2>([^<]*)<\/h2>/);return h?h[1].trim():null;};
const actionsIn=html=>[...new Set([...html.matchAll(/data-action="([^"]+)"/g)].map(m=>m[1]))];

// ---------------------------------------------------------------- boards
const boards=run('boards').map(b=>b[0]);
note.push(`${boards.length} boards defined`);
const allActions=new Set();
for(const [id,view,navRef,statusRef,insRef] of MATRIX){
  if(!boards.includes(id)){fail(`board ${id} is missing from the atlas`,'');continue;}
  try{run(`go(${JSON.stringify(id)})`);}catch(e){fail(`board ${id} does not render`,e.message);continue;}
  const frame=frameHtml(),notes=notesHtml(),all=frame+notes;
  for(const bad of['undefined','NaN','[object','Infinity'])if(all.includes(bad))fail(`board ${id} renders ${bad}`,'');
  const shownView=frame.includes(`<strong>${view}</strong>`)||frame.includes(`>${view}</button>`);
  if(!shownView)fail(`board ${id} does not show its durable view control`,`expected “${view}”`);
  const actualNav=navSelectedRef(frame),actualStatus=statusOf(frame),actualIns=inspectorRef(frame);
  if(actualNav!==navRef)fail(`board ${id} Navigator/selection disagree`,navRef===null?`no row should be selected, got ${actualNav}`:`expected ${navRef}, got ${actualNav}`);
  if(actualStatus!==statusRef)fail(`board ${id} status bar disagrees`, `expected ${statusRef}, got ${actualStatus}`);
  if(actualIns!==insRef)fail(`board ${id} Inspector identity disagrees`,`expected ${insRef}, got ${actualIns}`);
  if(id==='deleted'&&!frame.includes('deleted'))fail('board deleted does not explain the missing host in Navigator','');
  if(id==='empty'&&!frame.includes('No architecture yet'))fail('board empty does not announce the empty project','');
  if(id==='dense-reveal'){
    run(`go('dense-reveal')`);
    if(!frameHtml().includes('>Reveal</button>'))fail('board dense-reveal offers no Reveal control','');
    run(`act('reveal')`);
    const revealed=frameHtml();
    if(!revealed.includes('>Restore view</button>'))fail('board dense-reveal leaves no Restore view control','');
    if(!/1 revealed/.test(revealed))fail('board dense-reveal does not report the revealed source','');
    if(!revealed.includes('6.00')&&!revealed.includes('6.00 m'))fail('board dense-reveal changes the depth range','');
    if(!/revealed for this view/.test(revealed))fail('board dense-reveal Navigator does not mark the admitted source','');
    run(`act('restore')`);
    if(!/outside depth · revealable/.test(frameHtml()))fail('board dense-reveal Navigator does not return to excluded','');
  }
  for(const a of actionsIn(frame))allActions.add(a);
}
if(boards.length!==MATRIX.length)fail('matrix covers a different board count',`${boards.length} boards, ${MATRIX.length} matrix rows`);

// ---------------------------------------------------------------- controls
const unhandled=[];
for(const [id] of MATRIX){
  if(!boards.includes(id))continue;
  run(`go(${JSON.stringify(id)})`);
  const html=frameHtml()+notesHtml();
  for(const action of actionsIn(html)){
    if(action===id)continue;// re-entering the board you are already on is a no-op by definition
    run(`go(${JSON.stringify(id)})`);
    const before=run(`JSON.stringify({board:state.board,message:state.message,s:state})`);
    let threw=null;
    try{run(`act(${JSON.stringify(action)})`);}catch(e){threw=e.message;}
    if(threw){unhandled.push(`${action} on ${id} → ${threw}`);continue;}
    const after=run(`JSON.stringify({board:state.board,message:state.message,s:state})`);
    if(before===after&&!FOCUS_ACTIONS.includes(action))unhandled.push(`${action} on ${id} → no state, selection or message change`);
  }
}
if(unhandled.length)fail('displayed controls with no effect',[...new Set(unhandled)].join('; '));
note.push(`${allActions.size} distinct control actions probed`);

// ---------------------------------------------------------------- disclosed geometry
// Claims a board makes in words must be visible in its own drawing.
const drawFor=id=>{run('go('+JSON.stringify(id)+')');return run('svg(draw())');};
const mustSay=(id,phrases)=>{const d=drawFor(id);for(const p of phrases)if(!d.includes(p))fail('board '+id+' does not disclose '+JSON.stringify(p),'the drawing says otherwise');};
mustSay('section',['1.00 gap','0.40 gap','maximum boundary-wall height']);
mustSay('ceiling-section',['0.745 gap','1.60 gap','0.80']);
mustSay('ceiling-three',['0.745 gap','1.60 gap','0.80 through']);
mustSay('joint',['0.50 m of footprint overlap; 0.35 m of real solid crossing','cut face stays C-GABLE\u2019s']);
mustSay('three',['North wall top Y 4.35','Shared wall top Y 3.35','South walls top Y 2.95','North ceiling Y 4.35','South ceiling Y 3.35']);
if(drawFor('excluded').includes('Curved partition'))fail('board excluded draws the partition its own narration excludes','');
if(!drawFor('excluded').includes('Scene prop'))fail('board excluded drops a source that is inside its 2.00 m depth','');
// One floor datum per 3D board, and the canonical wall and ceiling heights must be drawn, not just labelled.
const floorPath=run("axf([[0,0,0],[8,0,0],[8,11,0],[0,11,0]],'wash')");
const northWall=run("axf([[0,0,0],[8,0,0],[8,0,FIX.wallN],[0,0,FIX.wallN]],'wash')");
const northCeiling=run("axf([[0,0,FIX.ceilN-FIX.floor],[8,0,FIX.ceilN-FIX.floor],[8,6,FIX.ceilN-FIX.floor],[0,6,FIX.ceilN-FIX.floor]],'wash')");
for(const id of['three','ceiling-three']){
  const d=drawFor(id),floors=d.split(floorPath).length-1;
  if(floors!==1)fail('board '+id+' draws '+floors+' floor datums','exactly one floor is expected');
  if(!d.includes(northWall))fail('board '+id+' does not draw the north wall at its canonical height','');
}
if(!drawFor('three').includes(northCeiling))fail('board three does not draw the generated closure at its canonical height','');
const spanningPlane=run("axf([[0,0,3.55-FIX.floor],[8,0,3.55-FIX.floor],[8,11,4.55-FIX.floor],[0,11,4.55-FIX.floor]],'ceiling')");
if(!drawFor('ceiling-three').includes(spanningPlane))fail('board ceiling-three does not draw C-SPAN at its authored heights','');
if(drawFor('ceiling-three').includes(northCeiling))fail('board ceiling-three still draws the generated north closure C-SPAN replaces','');
// The curved-wall elevation must be foreshortened, and must follow a changed canonical curve.
const curveImage=extra=>{run("go('curve')"+extra);const d=run('svg(draw())'),m=/([\d.]+) m of picture for ([\d.]+) m of wall/.exec(d);return m&&{image:Number(m[1]),wall:Number(m[2])};};
const curveBefore=curveImage(''),curveAfter=curveImage(';state.curve=true');
const tangentAngle=()=>run('(()=>{const c=curveOf(),len=curveLength(c),pt=bezAt(c,curveParamAtStation(c,len/2)),t=bezTan(c,curveParamAtStation(c,len/2)),l=Math.hypot(t[0],t[1]);return Math.atan2(t[0]/l,t[1]/l)*180/Math.PI;})()');
run("go('curve')");const angleBefore=tangentAngle();
run("go('curve');state.curve=true");const angleAfter=tangentAngle();
run("go('curve')");
if(!curveBefore||!curveAfter)fail('board curve does not report its foreshortening','');
else if(!(curveBefore.image<curveBefore.wall))fail('board curve presents a flattened projection as an elevation','image '+curveBefore.image+' m of wall '+curveBefore.wall+' m');
else if(Math.abs(curveAfter.image-curveBefore.image)<0.1)fail('board curve shows an unchanged image after the bend','image '+curveBefore.image+' → '+curveAfter.image);
else if(Math.abs(angleAfter-angleBefore)<5)fail('board curve shows an unchanged tangent after the bend',angleBefore.toFixed(1)+'° → '+angleAfter.toFixed(1)+'°');
// The range editor must offer its own depth and direction controls, not reuse the span grip.
const editcut=drawFor('editcut');
for(const a of['depthEdge','lookFlip'])if(!editcut.includes('data-action="'+a+'"'))fail('board editcut has no '+a+' control','');
// Reveal must change the drawing, not only the highlight.
if(drawFor('dense-reveal').includes('revealed alone'))fail('board dense-reveal draws the excluded source before Reveal','');
run("act('reveal')");
if(!run('svg(draw())').includes('revealed alone'))fail('board dense-reveal does not draw the source Reveal admits','');
// An edge-on source must not offer the fields of the plane it is perpendicular to.
run("go('oblique')");
if(frameHtml().includes('name="width"'))fail('board oblique offers per-plane fields for an edge-on source','');
if(!frameHtml().includes('Edge-on target'))fail('board oblique does not explain its edge-on state','');

// ---------------------------------------------------------------- exports
for(const [id,file] of FRAMES){
  const full=path.join(dir,file),exists=fs.existsSync(full);
  if(!exists){fail(`exported frame ${file} is missing`,'');continue;}
  const svg=fs.readFileSync(full,'utf8');
  for(const bad of['undefined','NaN','[object','Infinity'])if(svg.includes(bad))fail(`exported frame ${file} contains ${bad}`,'');
  if(!/width="1440" height="900" viewBox="0 0 1440 900"/.test(svg))fail(`exported frame ${file} is not 1440 × 900`,'');
  const committed=svg.match(/<svg x="368" y="138" width="772" height="738"[\s\S]*?<\/svg>/);
  const fresh=frameDrawing(atlasContext(),id).replace('<svg ','<svg x="368" y="138" width="772" height="738" ');
  if(!committed)fail(`exported frame ${file} has no embedded drawing`,'');
  else if(committed[0]!==fresh)fail(`exported frame ${file} drawing is stale`,'regenerate with export-frames.mjs');
  if(frameSvg(atlasContext(),id)!==svg)fail(`exported frame ${file} chrome is stale`,'regenerate with export-frames.mjs');
}

// ---------------------------------------------------------------- docs
const readme=fs.readFileSync(path.join(dir,'README.md'),'utf8');
if(!readme.includes(`${boards.length} annotated states`))fail('README does not state the current board count',`expected “${boards.length} annotated states”`);
for(const [id,file] of FRAMES)if(!readme.includes(file))fail(`README does not link ${file}`,'');

if(failures.length){
  console.error(`REGISTER atlas checks failed (${failures.length}):`);
  for(const f of failures)console.error(`  ✗ ${f}`);
  process.exitCode=1;
}else{
  console.log(`REGISTER atlas checks passed · ${boards.length} boards · ${allActions.size} distinct control actions · ${FRAMES.length} exported frames current`);
  for(const n of note)console.log(`  · ${n}`);
}
