import { Fragment, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Box, Camera, ChevronDown, Eye, EyeOff, Hand, Layers, Minus, MousePointer2, Move, Plus, RotateCcw, Target, X } from 'lucide-react';
import { initialInspection, initialProject, type Inspection, type Lens, type Project, type WorldSubject } from '../model';

type Tool = 'select' | 'pan' | 'move';

const isoPositions: Record<string, [number, number]> = {
  piano: [41.9, 63.4], bench: [60.9, 73.6], plant: [49.4, 38.2], 'art-1': [28, 42.3], 'art-2': [39, 31.8], windows: [70.8, 38], room: [50, 60],
};
const eyePositions: Record<string, [number, number]> = {
  piano: [44, 66], bench: [86, 78], plant: [66, 45], 'art-1': [24, 36], 'art-2': [41, 34], windows: [84, 39], room: [50, 55],
};

export function subjectScreenPosition(subject: WorldSubject, tilt: number): [number, number] {
  if (tilt < 25) return [(96 + subject.position[0] / 8 * 610) / 800 * 100, (86 + (6 - subject.position[1]) / 6 * 470) / 650 * 100];
  const base = (tilt > 85 ? eyePositions : isoPositions)[subject.id];
  if (base) {
    const original = initialProject.subjects.find(s => s.id === subject.id);
    const dx = subject.position[0] - (original?.position[0] ?? subject.position[0]);
    const dy = subject.position[1] - (original?.position[1] ?? subject.position[1]);
    return [base[0] + (dx + dy) * 4.3, base[1] + dx * 2.4 - dy * 3.2];
  }
  return [16 + (subject.position[0] / 8 + subject.position[1] / 6) * 34, 66 + subject.position[0] / 8 * 26 - subject.position[1] / 6 * 23];
}

export function PlanScene({ project, selectionIds = [], onSelect, onMove, tool = 'select', world = false }: { project: Project; selectionIds?: string[]; onSelect?: (id: string) => void; onMove?: (id: string, x: number, y: number) => void; tool?: Tool; world?: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; x: number; y: number } | null>(null);
  const [live, setLive] = useState<{ id: string; x: number; y: number } | null>(null);
  const point = (clientX: number, clientY: number) => {
    const matrix = svgRef.current?.getScreenCTM();
    const local = matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse()) : { x: 0, y: 0 };
    return { x: local.x, y: local.y };
  };
  return <svg className="plan-scene" viewBox="0 0 800 650" ref={svgRef} aria-label="Overhead spatial representation of the listening room" onPointerMove={event => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = point(event.clientX, event.clientY);
    setLive({ id: drag.id, x: Math.min(7.8, Math.max(0.2, drag.x + (p.x - drag.startX) / 610 * 8)), y: Math.min(5.8, Math.max(0.2, drag.y - (p.y - drag.startY) / 470 * 6)) });
  }} onPointerUp={() => {
    if (live && dragRef.current) onMove?.(live.id, Math.round(live.x * 100) / 100, Math.round(live.y * 100) / 100);
    dragRef.current = null;
    setLive(null);
  }} onPointerCancel={() => { dragRef.current = null; setLive(null); }}>
    <defs><pattern id="plan-grid" x="96" y="86" width="76.25" height="78.33" patternUnits="userSpaceOnUse"><path d="M 76.25 0 L 0 0 0 78.33" fill="none" stroke="#d8d4ca" strokeWidth="0.7" /></pattern><pattern id="plan-oak" width="6" height="8" patternUnits="userSpaceOnUse"><path d="M0 0v8" stroke="#c9b493" strokeWidth="1" /></pattern></defs>
    <rect x="96" y="86" width="610" height="470" fill="#eeeae1" stroke="#a9a79c" strokeWidth="9" onClick={() => onSelect?.('room')} />
    <rect x="96" y="86" width="610" height="470" fill="url(#plan-grid)" pointerEvents="none" />
    {[130, 240, 350].map(y => <g key={y}><rect x="700" y={y} width="12" height="70" fill="#fafbf8" /><path d={`M700 ${y}h12m-12 70h12`} stroke="#aaa99e" /></g>)}
    <path d="M92 552h90m-90 0a90 90 0 0 0 90-90" fill="none" stroke="#c4bfb4" strokeWidth="1" />
    {project.subjects.filter(s => s.available && s.id !== 'room' && s.kind !== 'window').map(subject => {
      const x = 96 + (live?.id === subject.id ? live.x : subject.position[0]) / 8 * 610;
      const y = 86 + (6 - (live?.id === subject.id ? live.y : subject.position[1])) / 6 * 470;
      const w = Math.max(8, subject.dimensions[0] / 8 * 610);
      const h = Math.max(8, subject.dimensions[1] / 6 * 470);
      const selected = selectionIds.includes(subject.id);
      return <g key={subject.id} transform={`translate(${x},${y}) rotate(${-subject.rotation})`} className={world && tool === 'move' ? 'plan-draggable' : 'plan-object'} role="button" tabIndex={0} aria-label={subject.name} onKeyDown={event => { if (event.key === 'Enter') onSelect?.(subject.id); }} onPointerDown={event => {
        event.stopPropagation();
        onSelect?.(subject.id);
        if (world && tool === 'move') {
          const p = point(event.clientX, event.clientY);
          dragRef.current = { id: subject.id, startX: p.x, startY: p.y, x: subject.position[0], y: subject.position[1] };
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      }}>
        {selected && <rect x={-w / 2 - 7} y={-h / 2 - 7} width={w + 14} height={h + 14} rx={subject.kind === 'plant' ? w : 3} fill="#a38bc312" stroke="#987bbb" strokeWidth="1.5" />}
        {subject.kind === 'piano' ? <><path d={`M${-w / 2},${h / 2}V${-h / 2}h${w * 0.72}q${w * 0.55} ${h * 0.18} ${w * 0.18} ${h * 0.55}Q${w * 0.1} ${h * 0.36} ${w / 2} ${h / 2}Z`} fill="#333330" stroke="#242421" /><rect x={-w / 2 + 3} y={h / 2 - 13} width={w - 6} height="9" fill="#f2eee6" />{Array.from({ length: 14 }, (_, i) => <path key={i} d={`M${-w / 2 + 6 + i * (w - 10) / 14} ${h / 2 - 13}v9`} stroke="#494840" strokeWidth="0.7" />)}</> : subject.kind === 'plant' ? <><circle r={w / 2} fill="#a3a48a" stroke="#7e826a" /><path d="M-12-10 12 10M-12 10 12-10M0-17v34M-17 0h34" stroke="#737b63" strokeWidth="3" /></> : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={subject.kind === 'bench' ? 3 : 0} fill={subject.kind === 'bench' ? '#ded2ba' : '#b9b4a7'} stroke="#a69b86" />}
        {subject.kind === 'bench' && <rect x={-w / 2 + 4} y={-h / 2 + 4} width={Math.max(1, w - 8)} height={Math.max(1, h - 8)} fill="#f4f0e6" rx="2" />}
      </g>;
    })}
    <g className="plan-dimension"><path d="M96 62h610M96 55v14M706 55v14" stroke="#b3afa4" /><text x="401" y="51" textAnchor="middle">8.00 m</text><path d="M737 86v470M730 86h14M730 556h14" stroke="#b3afa4" /><text x="756" y="325" textAnchor="middle" transform="rotate(90 756 325)">6.00 m</text></g>
  </svg>;
}

interface CanvasProps {
  project: Project;
  lens: Lens;
  selectionIds: string[];
  activePresentationId: string | null;
  inspection: Inspection;
  onInspection: (inspection: Inspection) => void;
  onSelectSubject: (id: string) => void;
  onSelectPresentation: (id: string) => void;
  onMoveSubject: (id: string, x: number, y: number) => void;
  onOpenViews: () => void;
  onPresent: () => void;
  cameraEditing: boolean;
  panelOpen: boolean;
  onTogglePanel: () => void;
}

export default function SpatialCanvas({ project, lens, selectionIds, activePresentationId, inspection, onInspection, onSelectSubject, onSelectPresentation, onMoveSubject, onOpenViews, onPresent, cameraEditing, panelOpen, onTogglePanel }: CanvasProps) {
  const [tool, setTool] = useState<Tool>('select');
  const [representationOpen, setRepresentationOpen] = useState(false);
  const [showMarkers, setShowMarkers] = useState(true);
  const [openStoryStack, setOpenStoryStack] = useState<string | null>(null);
  const panRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const selected = project.subjects.find(s => selectionIds.includes(s.id) && s.available);
  const isPlan = inspection.tilt < 25;
  const isEye = inspection.tilt > 85;
  const focus = () => {
    if (!selected) return;
    const [x, y] = subjectScreenPosition(selected, inspection.tilt);
    const width = planeRef.current?.clientWidth ?? 850;
    const height = planeRef.current?.clientHeight ?? 570;
    onInspection({ ...inspection, zoom: 128, pan: { x: (50 - x) / 100 * width, y: (50 - y) / 100 * height } });
  };
  return <section className={`spatial-canvas tool-${tool} ${cameraEditing ? 'framing-canvas' : ''}`} aria-label="Shared spatial canvas" onPointerDown={event => {
    if (tool === 'pan' || event.button === 1) {
      panRef.current = { x: event.clientX, y: event.clientY, panX: inspection.pan.x, panY: inspection.pan.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }} onPointerMove={event => {
    if (panRef.current) onInspection({ ...inspection, pan: { x: panRef.current.panX + event.clientX - panRef.current.x, y: panRef.current.panY + event.clientY - panRef.current.y } });
  }} onPointerUp={() => { panRef.current = null; }} onPointerCancel={() => { panRef.current = null; }} onWheel={event => {
    if (event.ctrlKey || event.metaKey) return;
    onInspection({ ...inspection, zoom: Math.min(180, Math.max(55, inspection.zoom - event.deltaY * 0.06)) });
  }}>
    <div className="canvas-topline"><div className="space-breadcrumb"><Layers size={14} /><button onClick={() => onInspection({ ...initialInspection, tilt: 0, zoom: 90 })}>Ground floor</button><span>/</span><button className="current-space" onClick={() => onInspection(initialInspection)}>Listening room</button></div><div className="canvas-top-actions"><button className={`icon-button ${!showMarkers ? 'muted' : ''}`} aria-label={showMarkers ? 'Hide canvas markers' : 'Show canvas markers'} title={showMarkers ? 'Hide markers' : 'Show markers'} onClick={() => setShowMarkers(!showMarkers)}>{showMarkers ? <Eye size={16} /> : <EyeOff size={16} />}</button><button className={`icon-button panel-toggle ${!panelOpen ? 'active' : ''}`} aria-label={panelOpen ? 'Hide contextual tools' : 'Show contextual tools'} title="Toggle contextual tools" onClick={onTogglePanel}>{panelOpen ? <X size={16} /> : <Layers size={16} />}</button></div></div>
    <motion.div className={`scene-plane ${isEye ? 'eye-plane' : ''} ${isPlan ? 'overhead-plane' : ''}`} ref={planeRef} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
      <motion.div className="scene-transform" animate={{ x: inspection.pan.x, y: inspection.pan.y, scale: inspection.zoom / 100, rotate: inspection.angle, rotateX: isPlan || isEye ? 0 : (62 - inspection.tilt) * 0.22 }} transition={{ type: 'spring', stiffness: 140, damping: 30 }}>
        <motion.img className="room-render" src="/images/listening-room.png" alt="Isometric listening room with a grand piano, oak bench, framed art, and sunlit gallery windows" animate={{ opacity: isPlan || isEye ? 0 : 1 }} draggable={false} />
        <motion.img className="eye-render" src="/images/piano-view.png" alt="Eye-level view into the listening room" animate={{ opacity: isEye ? 1 : 0 }} draggable={false} />
        <motion.div className="plan-layer" animate={{ opacity: isPlan ? 1 : 0 }} style={{ pointerEvents: isPlan ? 'auto' : 'none' }}><PlanScene project={project} selectionIds={selectionIds} onSelect={onSelectSubject} onMove={onMoveSubject} world={lens === 'world'} tool={tool} /></motion.div>
        {!isPlan && !isEye && selectionIds.includes('piano') && project.subjects.find(s => s.id === 'piano')?.available && <svg className="subject-outline" viewBox="0 0 1264 848" aria-hidden="true"><path d="M426 485 436 455 569 425Q631 416 639 451L640 479Q639 510 601 527L552 556 506 580 504 599 491 603 486 583 466 574 458 548 436 521Z" /><path d="M405 550h-10v12m225 39v12h-12" className="selection-corner" /></svg>}
        {!isPlan && project.subjects.filter(s => s.available && !isoPositions[s.id]).map(subject => {
          const pos = subjectScreenPosition(subject, inspection.tilt);
          return <button key={subject.id} className={`extra-world-object ${selectionIds.includes(subject.id) ? 'selected' : ''}`} style={{ left: `${pos[0]}%`, top: `${pos[1]}%`, width: Math.max(28, subject.dimensions[0] * 30), height: Math.max(22, subject.dimensions[1] * 24) }} aria-label={subject.name} onClick={() => onSelectSubject(subject.id)}><Box size={20} /></button>;
        })}
        {showMarkers && !cameraEditing && lens === 'world' && !isPlan && project.subjects.filter(s => s.available && s.kind !== 'architecture').map(subject => {
          const [x, y] = subjectScreenPosition(subject, inspection.tilt);
          const active = selectionIds.includes(subject.id);
          return <button className={`world-hotspot ${active ? 'selected' : ''}`} style={{ left: `${x}%`, top: `${y}%` }} key={subject.id} aria-label={`Select ${subject.name}`} onPointerDown={event => event.stopPropagation()} onClick={() => onSelectSubject(subject.id)}><span className="world-dot" /><span className="subject-name">{subject.name}</span>{active && <span className="world-selection-caption">World subject</span>}</button>;
        })}
        {showMarkers && !cameraEditing && lens === 'experience' && project.presentations.map((presentation, index) => {
          const key = [...presentation.focusIds].sort().join('|');
          const storiesHere = project.presentations.filter(p => [...p.focusIds].sort().join('|') === key);
          const representative = storiesHere.find(p => p.id === activePresentationId) ?? storiesHere[0];
          if (representative.id !== presentation.id) return null;
          const subjects = project.subjects.filter(s => s.available && presentation.focusIds.includes(s.id));
          if (!subjects.length) return null;
          const positions = subjects.map(s => subjectScreenPosition(s, inspection.tilt));
          const x = positions.reduce((sum, p) => sum + p[0], 0) / positions.length;
          const y = positions.reduce((sum, p) => sum + p[1], 0) / positions.length;
          const active = presentation.id === activePresentationId;
          return <Fragment key={presentation.id}>
            <button className={`presentation-hotspot ${active ? 'selected' : ''} ${!presentation.discoverable ? 'not-discoverable' : ''}`} style={{ left: `${x}%`, top: `${y + (isPlan ? -4 : 2)}%` }} aria-label={storiesHere.length > 1 ? `Choose from ${storiesHere.length} presentations here` : `Open presentation: ${presentation.title}`} onPointerDown={event => event.stopPropagation()} onClick={() => storiesHere.length > 1 ? setOpenStoryStack(openStoryStack === key ? null : key) : onSelectPresentation(presentation.id)}>
              <span className="presentation-number">{String(index + 1).padStart(2, '0')}</span>
              <AnimatePresence>{active && <motion.span className="hotspot-label" initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}><Box size={12} />{subjects.length > 1 ? `${subjects.length} subjects` : subjects[0].name}{storiesHere.length > 1 && <span className="story-stack-count">{storiesHere.length} stories</span>}</motion.span>}</AnimatePresence>
              <span className="hotspot-tooltip">{storiesHere.length > 1 ? `${storiesHere.length} stories around this focus` : presentation.title}</span>
            </button>
            {openStoryStack === key && storiesHere.length > 1 && <div className="canvas-story-menu" style={{ left: `${x}%`, top: `${y + 8}%` }} onPointerDown={event => event.stopPropagation()}><div><span>MEANING AROUND THIS FOCUS</span><button aria-label="Close presentation stack" onClick={() => setOpenStoryStack(null)}><X size={12} /></button></div>{storiesHere.map(story => <button className={story.id === activePresentationId ? 'selected' : ''} key={story.id} onClick={() => { onSelectPresentation(story.id); setOpenStoryStack(null); }}><SparkleMark /><span>{story.title || 'Untitled presentation'}</span></button>)}</div>}
          </Fragment>;
        })}
        {showMarkers && lens === 'experience' && selected && !project.presentations.some(p => p.focusIds.includes(selected.id)) && <button className="unpresented-hotspot" style={{ left: `${subjectScreenPosition(selected, inspection.tilt)[0]}%`, top: `${subjectScreenPosition(selected, inspection.tilt)[1]}%` }} onClick={onPresent}><Plus size={13} />Present this</button>}
      </motion.div>
    </motion.div>
    {cameraEditing && <div className="camera-frame"><span className="frame-label">VIEW FRAMING</span><div className="rule-thirds rule-v one" /><div className="rule-thirds rule-v two" /><div className="rule-thirds rule-h one" /><div className="rule-thirds rule-h two" /><span className="frame-corner top-left" /><span className="frame-corner top-right" /><span className="frame-corner bottom-left" /><span className="frame-corner bottom-right" /></div>}
    <div className="canvas-bottom" onPointerDown={event => event.stopPropagation()}>
      <div className="representation-container"><button className={`representation-button ${representationOpen ? 'active' : ''}`} onClick={() => setRepresentationOpen(!representationOpen)}><Box size={15} /><span>{isPlan ? 'From above' : isEye ? 'Eye level' : 'Perspective'}</span><ChevronDown size={12} /></button><AnimatePresence>{representationOpen && <motion.div className="representation-popover" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }}><div className="popover-title">Your angle on the World<button className="icon-button" aria-label="Close view angle controls" onClick={() => setRepresentationOpen(false)}><X size={13} /></button></div><input aria-label="Spatial view angle" type="range" min="0" max="100" value={inspection.tilt} onChange={e => onInspection({ ...inspection, tilt: Number(e.target.value) })} /><div className="range-labels"><button onClick={() => onInspection({ ...inspection, tilt: 0 })}>From above</button><button onClick={() => onInspection({ ...inspection, tilt: 62 })}>Spatial</button><button onClick={() => onInspection({ ...inspection, tilt: 92 })}>Eye level</button></div><div className="projection-control"><span>Projection</span><select aria-label="Inspection projection" value={inspection.projection} onChange={e => onInspection({ ...inspection, projection: e.target.value as Inspection['projection'] })}><option value="perspective">Perspective</option><option value="orthographic">Orthographic</option></select></div><p>Inspection only. Capture a View to author this framing.</p></motion.div>}</AnimatePresence></div>
      <div className="canvas-toolstrip"><button className={tool === 'select' ? 'active' : ''} title="Select" aria-label="Select tool" onClick={() => setTool('select')}><MousePointer2 size={17} /></button><button className={tool === 'pan' ? 'active' : ''} title="Pan" aria-label="Pan tool" onClick={() => setTool('pan')}><Hand size={17} /></button>{lens === 'world' && <button className={tool === 'move' ? 'active' : ''} title="Move subjects in the overhead view" aria-label="Move subjects" onClick={() => { setTool('move'); onInspection({ ...inspection, tilt: 0 }); }}><Move size={17} /></button>}<button title="Focus selection" aria-label="Focus selected subject" onClick={focus} disabled={!selected}><Target size={17} /></button><span className="tool-divider" /><button className="views-tool" title="Shared Camera Views" onClick={onOpenViews}><Camera size={16} /><span>Views</span></button></div>
      <div className="zoom-controls"><button aria-label="Zoom out" onClick={() => onInspection({ ...inspection, zoom: Math.max(55, inspection.zoom - 10) })}><Minus size={14} /></button><button className="zoom-value" title="Reset zoom" onClick={() => onInspection({ ...inspection, zoom: 100 })}>{Math.round(inspection.zoom)}%</button><button aria-label="Zoom in" onClick={() => onInspection({ ...inspection, zoom: Math.min(180, inspection.zoom + 10) })}><Plus size={14} /></button><span className="tool-divider" /><button title="Return to room" aria-label="Reset inspection to the room" onClick={() => onInspection(initialInspection)}><RotateCcw size={14} /></button></div>
    </div>
  </section>;
}

function SparkleMark() { return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.1"><path d="m8 1 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5Z" /></svg>; }