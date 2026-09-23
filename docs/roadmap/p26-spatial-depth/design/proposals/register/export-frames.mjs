// Design-artifact export only. No production imports, geometry engine or editor writes.
// Regenerate: node docs/roadmap/p26-spatial-depth/design/proposals/register/export-frames.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const html=fs.readFileSync(path.join(dir,'atlas.html'),'utf8');
const source=html.match(/<script>([\s\S]*)<\/script>/)[1].split("\ndocument.addEventListener('click'")[0];
const context=vm.createContext({});vm.runInContext(source,context);
const t=(x,y,s,cl='ui')=>`<text class="shell ${cl}" x="${x}" y="${y}">${String(s).replaceAll('&','&amp;').replaceAll('<','&lt;')}</text>`;
const r=(x,y,w,h,fill,stroke='#b1b8bd')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"/>`;
const l=(x,y,xx,yy)=>`<path d="M${x} ${y}L${xx} ${yy}" stroke="#b1b8bd"/>`;
const btn=(x,y,w,s)=>r(x,y,w,24,'#E8E5DD')+t(x+8,y+16,s,'utility');
for(const [id,file] of [['section','section-1440x900.svg'],['focus','ceiling-focus-1440x900.svg'],['dense-plan','twelve-room-1440x900.svg']]){
 vm.runInContext(`state.board=${JSON.stringify(id)};state.target=targetFor(state.board);state.depth=${id==='dense-plan'?6:4.5}`,context);
 const drawing=vm.runInContext('svg(draw())',context).replace('<svg ','<svg x="368" y="138" width="772" height="738" ');
 const map=vm.runInContext('mapDrawing()',context).replace('<svg ','<svg x="68" y="650" width="242" height="170" ');
 const ref=vm.runInContext('selectedRef()',context),focus=id==='focus',dense=id==='dense-plan';
 let s=`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="900" viewBox="0 0 1440 900" role="img" aria-label="REGISTER unratified P26 ${id} design, 1440 by 900"><title>REGISTER · ${id} · independent unratified P26 proposal</title>`;
 s+=r(0,0,1440,900,'#D9DDE0')+r(0,0,56,900,'#CBD0D4')+r(324,70,816,806,'#F5F7F8')+r(324,138,44,738,'#E8E5DD')+l(56,36,1440,36)+l(56,876,1440,876)+l(324,36,324,876)+l(1140,36,1140,876);
 s+=r(0,36,56,74,'#dfe2e3')+r(53,44,3,58,'#A37A3D','#A37A3D')+t(10,79,'▱','heading')+t(11,98,'Scene','mode')+t(11,153,'◎','heading')+t(7,173,'Camera','mode');
 s+=t(68,23,'‹ Projects','utility')+t(150,24,dense?'Twelve-room wing':'Two galleries','identity')+t(285,23,'Local session','utility')+btn(845,6,54,'↶ Undo')+btn(905,6,54,'↷ Redo')+t(978,23,'Design specimen','utility')+t(1092,23,'Spatial','ui')+t(1160,23,'Publish','ui')+t(1230,23,'Preview','ui')+t(1301,23,'PLATE Light','utility');
 s+=r(324,36,816,34,'#D9DDE0')+r(334,37,51,32,'#e8ebed')+t(344,58,'Plan','ui')+t(405,58,'3D','ui')+t(462,58,'MODE','utility')+btn(509,42,62,'Layout')+t(583,58,'Arrange','mode')+t(963,58,'Snap .10','utility')+t(1031,58,'Grid','utility')+t(1084,58,'Panels','utility');
 s+=r(324,70,816,34,'#E8E5DD')+btn(334,75,116,'← Return to Plan')+t(467,92,focus?'Ceiling Focus':dense?'Section placement':'Section A','strong')+t(978,91,'REGISTERED TO PLAN','meta');
 s+=r(324,104,816,34,'#e1e3e3')+t(338,125,focus?'Cut Y  1.75 m':`Depth  ${dense?'6.00':'4.50'} m`,'mono')+btn(470,109,66,'Cut only')+btn(551,109,66,'Crop…')+btn(632,109,114,'Edit cut in Plan')+btn(1086,109,42,'Fit');
 s+=t(338,157,'EDIT','tray-group')+r(325,165,42,42,'#cecac0','#cecac0')+t(339,185,'↖','heading')+t(334,200,'Select','tray-tool')+t(330,231,'INSPECT','tray-group')+t(338,257,'↦','heading')+t(330,273,'Section','tray-tool')+t(338,303,'▥','heading')+t(327,319,'Elevation','tray-tool')+t(338,350,'⌃','heading')+t(330,366,'Ceiling','tray-tool');
 s+=t(70,65,'Navigator','heading')+r(68,79,244,30,'#e9edef')+t(79,99,'Search name or reference…','ui');
 let yy=138;
 const rows=dense?['Galleries · twelve rooms','Gallery                     R-N1','Gallery                     R-N2','Room N3                     R-N3','Room N4                     R-N4','Room M1                     R-M1','Gallery                     R-M2','Room M3                     R-M3','Room M4                     R-M4','Room S1                     R-S1','Gallery                     R-S2','Room S3                     R-S3','Room S4                     R-S4']:
 ['⌄ Galleries','  ⌄ North                   R-NORTH','    ↗ Shared wall          W-SHARED',focus?'    East window            O-WINDOW':'    Gallery door            O-DOOR','    Curved partition        W-CURVE','  ⌄ South                   R-SOUTH','    ↗ Shared wall          W-SHARED','  › East gallery            R-EAST','⌄ Ceilings',focus?'    North gable             C-GABLE':'    Generated overhead       Rooms','› Scene content'];
 for(let i=0;i<rows.length;i++){if((focus&&i===9)||(!focus&&!dense&&i===3))s+=r(57,yy-19,266,29,'#d0e2fb','#d0e2fb')+r(57,yy-19,3,29,'#145DA8','#145DA8');s+=t(70,yy,rows[i],i===0?'strong':'navmono');yy+=29;}
 s+=l(56,610,324,610)+t(69,635,'REGISTRATION MAP','meta')+t(235,635,dense?'6 IN / 6 OUT':focus?'PLAN':'SECTION A','meta')+map+t(70,840,dense?'Column 2 cut / column 3 projected':focus?'Plan east → right; Focus east → left':'One cut, finite depth, one source identity','utility')+l(56,850,324,850)+t(69,867,`Selected · ${ref}`,'mono');
 s+=drawing;
 s+=t(1156,65,focus?'North gable':dense?'Gallery shared wall':'Gallery door','heading')+t(1156,88,ref,'mono')+t(1156,109,focus?'Ceiling · independent region':dense?'Wall · R-N2 ↔ R-M2':'Opening · W-SHARED','utility')+l(1140,140,1440,140);
 const props=focus?[['UNDERSIDE',''],['Form','Gable'],['Eave Y','3.35 m'],['Ridge Y','4.05 m'],['Thickness','0.15 m'],['RELATIONSHIP',''],['Use','Closure'],['Rooms overlapped','North']]:dense?[['WALL PROFILE',''],['Form','Constant'],['Height','3.00 m'],['Base Y','0.15 m'],['CONTEXT',''],['Bounds','R-N2 / R-M2']]:[['OPENING GEOMETRY',''],['Width','1.00 m'],['Sill above floor','0.00 m'],['Head above floor','2.10 m'],['World head Y','2.25 m'],['Profile','Rectangular'],['SOURCE & CONTEXT',''],['Host','W-SHARED'],['Floor Y','+0.15 m']];
 yy=167;for(const [label,value]of props){if(!value){s+=t(1156,yy,label,'meta');yy+=32;}else{s+=t(1156,yy,label,'ui')+r(1324,yy-18,98,26,'#E8E5DD')+t(1334,yy,value,'mono');yy+=38;}}
 s+=l(1140,yy+3,1440,yy+3)+t(1156,yy+32,'PRECISION','meta')+btn(1156,yy+46,268,focus?'Open profile section':dense?'Open elevation':'Open elevation')+btn(1156,yy+81,268,focus?'Edit footprint in Plan':dense?'Reveal opening O-N4':'Inspect in 3D')+t(1156,yy+142,'Canonical identity across every view.','utility')+t(1156,yy+162,focus?'Generated east strip remains at Y 4.35.':'One physical source, one history system.','utility');
 s+=t(69,892,`Scene · Plan › ${focus?'Ceiling Focus':dense?'Section placement':'Section A'}`,'utility')+t(332,892,ref,'mono')+t(474,892,'REGISTER · UNRATIFIED DESIGN SPECIMEN','meta')+t(1189,892,'Metric · Floor Y +0.15','mono');
 // Specificity isolates shell type from the embedded drawing's stylesheet.
 s+=`<style>text.shell{font-family:'Trebuchet MS','Lucida Grande',sans-serif;fill:#252A2E;font-size:12px}text.shell.ui{font-size:12px}text.shell.strong{font-size:12px;font-weight:bold}text.shell.heading{font-size:15px;font-weight:bold}text.shell.identity{font-size:14px;font-weight:bold}text.shell.utility,text.shell.meta{font-size:10px}text.shell.meta{fill:#697177;letter-spacing:.035em}text.shell.mode{font-size:11px}text.shell.mono{font:11px 'Andale Mono',Consolas,monospace}text.shell.navmono{font:11px 'Andale Mono',Consolas,monospace}text.shell.tray-group{font-size:7px}text.shell.tray-tool{font-size:8px}</style></svg>`;
 fs.writeFileSync(path.join(dir,file),s);
 console.log(`${file}: 1440 × 900`);
}
