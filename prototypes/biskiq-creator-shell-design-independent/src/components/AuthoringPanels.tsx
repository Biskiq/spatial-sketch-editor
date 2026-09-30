import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, Box, Camera, Check, ChevronDown, ChevronRight, Copy, Crosshair, Ellipsis, GitBranch, Languages, Link2, Maximize2, MousePointer2, Music2, Play, Plus, Repeat2, RotateCcw, Sparkles, Text, Trash2, TriangleAlert, X } from 'lucide-react';
import { captureView, getIssues, subjectType, toInspection, viewUsage, type CameraView, type GuideStop, type Inspection, type Presentation, type Project, type WorldSubject } from '../model';
import { Toggle } from './ui';
import SubjectIcon from './SubjectIcon';

export function ViewThumbnail({ view, onClick }: { view: CameraView; onClick: () => void }) {
  return <button className={`view-thumbnail ${view.tilt > 85 ? 'interior-thumb' : ''}`} onClick={onClick} aria-label={`Adjust view: ${view.name}`}><img src={view.tilt > 85 ? '/images/piano-view.png' : '/images/listening-room.png'} alt="Saved camera framing" /><span className="view-thumb-caption"><Camera size={12} /><span>{view.name}</span><Maximize2 size={13} /></span></button>;
}

interface PresentationProps {
  project: Project;
  presentation: Presentation;
  onUpdate: (changes: Partial<Presentation>) => void;
  onEditFocus: () => void;
  onCapture: () => void;
  onChooseView: () => void;
  onEditView: (id: string) => void;
  onInspectView: (id: string) => void;
  onAddGuide: () => void;
  onAddVariant: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onReferences: () => void;
}

export function PresentationPanel({ project, presentation, onUpdate, onEditFocus, onCapture, onChooseView, onEditView, onInspectView, onAddGuide, onAddVariant, onDuplicate, onDelete, onReferences }: PresentationProps) {
  const [menu, setMenu] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [variantId, setVariantId] = useState('default');
  const subjects = project.subjects.filter(s => presentation.focusIds.includes(s.id));
  const isPiano = subjects.some(s => s.kind === 'piano' && s.available);
  const view = project.views.find(v => v.id === presentation.viewId);
  const issues = getIssues(project, presentation);
  const occurrences = project.guide?.stops.filter(s => s.presentationId === presentation.id).length ?? 0;
  const variant = presentation.variants.find(v => v.id === variantId);
  return <div className="authoring-panel presentation-panel">
    <div className="panel-scroll">
      <div className="panel-eyebrow"><span><Sparkles size={13} />PRESENTATION</span><div className="relative"><button className="icon-button" aria-label="Presentation actions" onClick={() => setMenu(!menu)}><Ellipsis size={18} /></button>{menu && <div className="small-menu panel-menu"><button onClick={() => { onDuplicate(); setMenu(false); }}><Copy size={14} />Duplicate presentation</button><button onClick={() => { onReferences(); setMenu(false); }}><Link2 size={14} />Where it is used</button><button className="danger-text" onClick={() => { onDelete(); setMenu(false); }}><Trash2 size={14} />Delete presentation</button></div>}</div></div>
      <input className="presentation-title" aria-label="Presentation title" value={presentation.title} placeholder="Give this a name" onChange={e => onUpdate({ title: e.target.value })} />
      <button className={`focus-row ${issues.missingSubjects.length ? 'needs-repair' : ''}`} onClick={onEditFocus}><span className="focus-subject-icon">{subjects.length === 1 ? <SubjectIcon kind={subjects[0].kind} size={17} /> : <Box size={17} />}</span><span><strong>{subjects.length > 1 ? `${subjects[0].name} + ${subjects.length - 1}` : subjects[0]?.name ?? 'A story of its own'}</strong><small>{issues.missingSubjects.length ? 'Focus unavailable' : `${subjects.length > 1 ? 'World subjects' : subjects.length ? 'World subject' : 'No subject required'}`}</small></span><Plus size={14} /></button>
      {issues.missingSubjects.length > 0 && <div className="repair-notice"><TriangleAlert size={15} /><span>A subject is no longer available.<button onClick={onEditFocus}>Repair focus<ArrowRight size={12} /></button></span></div>}
      {issues.missingView && <div className="repair-notice"><TriangleAlert size={15} /><span>This saved View is unavailable.<button onClick={onChooseView}>Choose a replacement<ArrowRight size={12} /></button></span></div>}
      {issues.changedFocus && !issues.missingSubjects.length && view && <div className="repair-notice"><TriangleAlert size={15} /><span>The focus moved. Check its framing.<button onClick={() => onEditView(view.id)}>Review view<ArrowRight size={12} /></button></span></div>}
      <section className="composer-section story-section"><div className="section-heading"><h3><Text size={15} />Story</h3>{presentation.variants.length > 0 && <select className="variant-select" aria-label="Content variant" value={variantId} onChange={e => setVariantId(e.target.value)}><option value="default">Original</option>{presentation.variants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select>}</div><textarea className="story-textarea" aria-label={variant ? `${variant.label} explanation` : 'Presentation explanation'} value={variant?.body ?? presentation.body} placeholder="What should someone discover here?" onChange={e => variant ? onUpdate({ variants: presentation.variants.map(v => v.id === variant.id ? { ...v, body: e.target.value } : v) }) : onUpdate({ body: e.target.value })} /><div className="content-add-container"><button className="text-button subtle" onClick={() => setAddMenu(!addMenu)}><Plus size={12} />Add to this story</button>{addMenu && <div className="small-menu content-menu"><button onClick={() => { onAddVariant(); setAddMenu(false); }}><Languages size={14} />Content variant</button><button onClick={() => { onUpdate({ activity: isPiano ? 'phrase' : 'highlight' }); setAddMenu(false); }}><Sparkles size={14} />On-arrival activity</button><button onClick={() => { onUpdate({ interaction: isPiano ? 'note' : 'detail' }); setInteractionOpen(true); setAddMenu(false); }}><MousePointer2 size={14} />Visitor interaction</button></div>}</div></section>
      <section className="composer-section view-section"><div className="section-heading"><h3><Camera size={15} />View</h3><button className="text-button" onClick={onChooseView}>{view ? 'Change' : 'Choose saved'}</button></div>{view ? <><ViewThumbnail view={view} onClick={() => onEditView(view.id)} /><div className="view-actions"><button className="text-button" onClick={() => onEditView(view.id)}><Crosshair size={12} />Adjust framing</button><button className="icon-button" title="Inspect saved view without changing it" aria-label="Go to saved view" onClick={() => onInspectView(view.id)}><ArrowRight size={14} /></button></div><button className="text-button capture-button" onClick={onCapture}><Plus size={12} />Use current view instead</button></> : <button className="empty-view" onClick={onCapture}><Camera size={23} /><strong>Use current view</strong><span>Make this moment part of the story</span></button>}</section>
      {presentation.activity !== 'none' && <section className="composer-section activity-section"><div className="section-heading"><h3><Sparkles size={14} />On arrival</h3><button className="icon-button" aria-label="Remove arrival activity" onClick={() => onUpdate({ activity: 'none' })}><X size={13} /></button></div><div className="activity-label"><Play size={13} /><span>{presentation.activity === 'phrase' ? 'Play a short piano phrase' : 'Bring the focus into the light'}</span></div><p className="field-hint">A supported activity, not a change to World.</p></section>}
      <section className="composer-section interaction-section"><div className="section-heading"><h3><MousePointer2 size={14} />Visitor interaction</h3><Toggle checked={presentation.interaction !== 'none'} label="Allow visitor interaction" onChange={() => onUpdate({ interaction: presentation.interaction === 'none' ? isPiano ? 'note' : 'detail' : 'none' })} /></div>{presentation.interaction !== 'none' ? <><button className="interaction-row" onClick={() => setInteractionOpen(!interactionOpen)}><span className="interaction-icon">{presentation.interaction === 'note' ? <Music2 size={16} /> : <Text size={16} />}</span><span><strong>{presentation.interaction === 'note' ? 'Play a note' : 'Look a little closer'}</strong><small>{presentation.interaction === 'note' ? 'Tap the piano to hear it' : 'Reveal another detail'}</small></span><ChevronRight size={14} /></button>{interactionOpen && <div className="interaction-options"><label>When a visitor taps the subject<select value={presentation.interaction} onChange={e => onUpdate({ interaction: e.target.value as Presentation['interaction'] })}>{isPiano && <option value="note">Play a piano note</option>}<option value="detail">Reveal a detail</option></select></label>{presentation.interaction === 'detail' && <textarea aria-label="Revealed detail" placeholder="The detail you want them to find..." value={presentation.detailText} onChange={e => onUpdate({ detailText: e.target.value })} />}</div>}</> : <p className="field-hint">Let the visitor do more than look.</p>}</section>
    </div>
    <div className="panel-footer"><button className="add-to-guide" onClick={onAddGuide}><GitBranch size={15} /><span>{occurrences ? 'Add another stop' : 'Add to guide'}</span><span className="optional-label">{occurrences ? `${occurrences} ${occurrences === 1 ? 'use' : 'uses'}` : 'Optional'}</span><Plus size={13} /></button><div className="discoverability-row"><span><Check size={12} />Available while exploring</span><Toggle checked={presentation.discoverable} label="Make presentation discoverable during free exploration" onChange={() => onUpdate({ discoverable: !presentation.discoverable })} /></div></div>
  </div>;
}

function NumericField({ label, value, unit = 'm', onChange }: { label: string; value: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="numeric-field"><span>{label}</span><input aria-label={`${label} in ${unit}`} type="number" step="0.01" value={value} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(n); }} /><small>{unit}</small></label>;
}

export function WorldPanel({ project, subject, onUpdate, onPresent, onReferences, onRemove, onRestore }: { project: Project; subject: WorldSubject; onUpdate: (changes: Partial<WorldSubject>, spatial?: boolean) => void; onPresent: () => void; onReferences: () => void; onRemove: () => void; onRestore: () => void }) {
  const related = project.presentations.filter(p => p.focusIds.includes(subject.id));
  const vector = (key: 'position' | 'dimensions', index: number, value: number) => {
    const next = [...subject[key]] as [number, number, number];
    next[index] = key === 'dimensions' ? Math.max(0.01, value) : value;
    onUpdate({ [key]: next }, true);
  };
  return <div className="authoring-panel world-panel"><div className="panel-scroll"><div className="panel-eyebrow"><span><Box size={13} />WORLD SUBJECT</span><button className="icon-button" title="Remove subject from World" aria-label="Remove subject from World" onClick={onRemove}><Trash2 size={15} /></button></div><input className="presentation-title" aria-label="World subject name" value={subject.name} onChange={e => onUpdate({ name: e.target.value })} /><div className="world-type"><SubjectIcon kind={subject.kind} size={13} />{subjectType[subject.kind]}<span>/</span>Listening room</div>{!subject.available && <div className="repair-notice"><TriangleAlert size={15} /><span>This subject was removed.<button onClick={onRestore}>Restore to World<ArrowRight size={12} /></button></span></div>}<div className="world-object-illustration"><SubjectIcon kind={subject.kind} size={70} /><span>{subject.material}</span></div><section className="composer-section"><div className="section-heading"><h3>Position</h3><span className="small-muted">Room coordinates</span></div><div className="numeric-grid">{['X', 'Y', 'Z'].map((label, i) => <NumericField key={label} label={label} value={subject.position[i]} onChange={v => vector('position', i, v)} />)}</div></section><section className="composer-section"><div className="section-heading"><h3>Dimensions</h3></div><div className="numeric-grid">{['Width', 'Depth', 'Height'].map((label, i) => <NumericField key={label} label={label} value={subject.dimensions[i]} onChange={v => vector('dimensions', i, v)} />)}</div><div className="rotation-field"><span>Rotation</span><NumericField label="R" value={subject.rotation} unit="deg" onChange={v => onUpdate({ rotation: v }, true)} /></div></section><section className="composer-section"><div className="section-heading"><h3>Material</h3></div><select className="full-select" aria-label="Subject material" value={subject.material} onChange={e => onUpdate({ material: e.target.value })}>{Array.from(new Set([subject.material, 'Black lacquer', 'Natural oak', 'Limestone', 'Terracotta', 'Cream upholstery', 'Clear glass', 'Framed print'])).map(m => <option key={m}>{m}</option>)}</select></section><section className="source-relationships"><div className="section-heading"><h3>In the experience</h3></div><button onClick={onReferences}><Link2 size={15} /><span>{related.length ? `Used in ${related.length} ${related.length === 1 ? 'presentation' : 'presentations'}` : 'Not presented yet'}</span><ArrowRight size={14} /></button><p>World changes stay connected.<br />The story stays yours.</p></section></div><div className="panel-footer"><button className="primary-button full-width present-primary" onClick={onPresent} disabled={!subject.available}><Sparkles size={16} />Present this<ArrowRight size={15} /></button><p className="footer-hint">A new story around this subject.</p></div></div>;
}

export function EmptyPanel({ subject, lens, onPresent, onNewSubject }: { subject?: WorldSubject; lens: 'world' | 'experience'; onPresent: () => void; onNewSubject: () => void }) {
  return <div className="authoring-panel empty-panel"><span className="eyebrow">{lens === 'world' ? 'WORLD' : 'EXPERIENCE'}</span><div className="empty-panel-content"><span className="empty-panel-symbol">{lens === 'world' ? <Box size={32} /> : <Sparkles size={32} />}</span><h2>{lens === 'world' ? 'A place for possibility.' : subject ? `What matters about ${subject.name.toLowerCase()}?` : 'Give the world a little meaning.'}</h2><p>{lens === 'world' ? 'Select something to shape it. Or bring something new into the room.' : 'A presentation can tell a story around one subject, several, or none at all.'}</p><button className="primary-button" onClick={lens === 'world' ? onNewSubject : onPresent}><Plus size={15} />{lens === 'world' ? 'Add to World' : subject ? 'Present this' : 'Create a presentation'}</button></div></div>;
}

export function StopPanel({ project, stop, onUpdate, onEditPresentation, onChooseView, onInspectView, onMove, onRemove }: { project: Project; stop: GuideStop; onUpdate: (changes: Partial<GuideStop>) => void; onEditPresentation: () => void; onChooseView: () => void; onInspectView: (id: string) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  const [advanced, setAdvanced] = useState(stop.gate !== 'none');
  const presentation = project.presentations.find(p => p.id === stop.presentationId);
  const index = project.guide?.stops.findIndex(s => s.id === stop.id) ?? 0;
  const used = project.guide?.stops.filter(s => s.presentationId === stop.presentationId).length ?? 1;
  const view = project.views.find(v => v.id === (stop.entryViewId ?? presentation?.viewId));
  return <div className="authoring-panel stop-panel"><div className="panel-scroll"><div className="panel-eyebrow"><span><GitBranch size={13} />GUIDE STOP {String(index + 1).padStart(2, '0')}</span><button className="icon-button" title="Remove this occurrence" aria-label="Remove this stop from guide" onClick={onRemove}><Trash2 size={15} /></button></div><h2 className="panel-heading">{presentation?.title ?? 'Unavailable presentation'}</h2><p className="stop-subtitle">One moment along the way.</p><button className="shared-presentation" onClick={onEditPresentation}><Repeat2 size={18} /><span><strong>Edit the presentation</strong><small>{used > 1 ? `Shared by ${used} stops` : 'Reusable, beyond this guide'}</small></span><ArrowRight size={15} /></button><section className="composer-section"><div className="section-heading"><h3><Camera size={15} />Entry view</h3><button className="text-button" onClick={onChooseView}>Choose</button></div><label className="radio-line"><input type="radio" checked={!stop.entryViewId} onChange={() => onUpdate({ entryViewId: null })} />Use the presentation's view</label>{stop.entryViewId && <span className="custom-entry-label">A different view for this occurrence</span>}{view ? <><ViewThumbnail view={view} onClick={() => onInspectView(view.id)} /><button className="text-button entry-inspect" onClick={() => onInspectView(view.id)}><Crosshair size={12} />Inspect entry framing</button></> : <div className="repair-notice"><TriangleAlert size={14} /><span>No entry view available.<button onClick={onChooseView}>Choose a view</button></span></div>}</section><section className="composer-section"><div className="section-heading"><h3>Entry prompt</h3><span className="small-muted">Optional</span></div><textarea className="entry-prompt" aria-label="Stop entry prompt" value={stop.prompt} placeholder="A different way into the same story..." onChange={e => onUpdate({ prompt: e.target.value })} /><p className="field-hint">Only shown at this stop. The original story is unchanged.</p></section><section className="composer-section"><div className="section-heading"><h3>Continue when</h3></div><select className="full-select" aria-label="Stop continuation" value={stop.continuation} onChange={e => onUpdate({ continuation: e.target.value as GuideStop['continuation'] })}><option value="manual">The visitor is ready</option><option value="activity" disabled={presentation?.activity === 'none'}>The arrival activity finishes</option><option value="timed">A little time has passed</option></select>{stop.continuation === 'timed' && <div className="timing-row"><span>Wait</span><NumericField label="Time" value={stop.seconds} unit="s" onChange={v => onUpdate({ seconds: Math.max(1, v) })} /></div>}</section><button className="advanced-disclosure" onClick={() => setAdvanced(!advanced)}><SettingsIcon />More control<ChevronDown size={13} className={advanced ? 'rotated' : ''} /></button>{advanced && <div className="advanced-stop"><label>Before continuing<select className="full-select" aria-label="Stop gate" value={stop.gate} onChange={e => onUpdate({ gate: e.target.value as GuideStop['gate'] })}><option value="none">Nothing is required</option><option value="interaction" disabled={presentation?.interaction === 'none'}>Visitor tries the interaction</option></select></label><p className="field-hint">Gates apply to this path. Visitors can still leave to explore.</p></div>}</div><div className="panel-footer"><div className="stop-order-controls"><span>Move this stop</span><button className="icon-button" aria-label="Move stop earlier" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp size={16} /></button><button className="icon-button" aria-label="Move stop later" disabled={index === (project.guide?.stops.length ?? 0) - 1} onClick={() => onMove(1)}><ArrowDown size={16} /></button></div><p className="footer-hint">A stop is an occurrence, not a copy.</p></div></div>;
}

function SettingsIcon() { return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 5h14M3 10h14M3 15h14" /><circle cx="7" cy="5" r="1.7" fill="white" /><circle cx="13" cy="10" r="1.7" fill="white" /><circle cx="8" cy="15" r="1.7" fill="white" /></svg>; }

export function CameraEditor({ project, view, inspection, focusIds, onInspection, onSave, onCancel, onDelete, onReferences }: { project: Project; view?: CameraView; inspection: Inspection; focusIds: string[]; onInspection: (inspection: Inspection) => void; onSave: (view: CameraView, asNew: boolean) => void; onCancel: () => void; onDelete: () => void; onReferences: () => void }) {
  const [draft, setDraft] = useState<CameraView>(() => view ? { ...view, pan: { ...view.pan } } : captureView(project, inspection, focusIds, 'A new point of view'));
  const [movementOpen, setMovementOpen] = useState(draft.motion !== 'still');
  const [rehearsing, setRehearsing] = useState(false);
  const callbackRef = useRef(onInspection);
  callbackRef.current = onInspection;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  useEffect(() => {
    if (rehearsing) return;
    setDraft(current => ({ ...current, ...inspection, pan: { ...inspection.pan } }));
  }, [inspection.tilt, inspection.zoom, inspection.pan.x, inspection.pan.y, inspection.angle, inspection.projection, rehearsing]);
  const update = (changes: Partial<CameraView>) => {
    const next = { ...draft, ...changes };
    setDraft(next);
    onInspection(toInspection(next));
  };
  useEffect(() => {
    if (!rehearsing) return;
    const start = performance.now();
    const startView = draftRef.current;
    let frame = 0;
    const run = (time: number) => {
      const progress = Math.min(1, (time - start) / (startView.duration * 1000));
      const eased = (1 - Math.cos(progress * Math.PI)) / 2;
      callbackRef.current({ ...toInspection(startView), angle: startView.motion === 'arc' ? startView.angle - 6 + eased * 12 : startView.angle, zoom: startView.motion === 'approach' ? startView.zoom + eased * 25 : startView.zoom });
      if (progress < 1) frame = requestAnimationFrame(run);
      else { setRehearsing(false); callbackRef.current(toInspection(startView)); }
    };
    frame = requestAnimationFrame(run);
    return () => cancelAnimationFrame(frame);
  }, [rehearsing]);
  const used = view ? viewUsage(project, view.id) : 0;
  const names = project.subjects.filter(s => draft.focusIds.includes(s.id)).map(s => s.name).join(', ');
  return <div className="authoring-panel camera-panel">
    <div className="panel-scroll">
      <div className="panel-eyebrow"><span><Camera size={13} />SHARED CAMERA VIEW</span><button className="icon-button" aria-label="Cancel framing changes" onClick={onCancel}><X size={17} /></button></div>
      <input className="presentation-title" aria-label="Camera view name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} />
      <p className="camera-subtitle">A point of view. Not another workspace.</p>
      {used > 0 && <button className="shared-view-notice" onClick={onReferences} title="See all uses of this shared View"><Link2 size={14} /><span>{used === 1 ? 'Used in one place. See its context.' : `Used in ${used} places. Saving updates all of them.`}</span><ChevronRight size={12} /></button>}
      <div className="camera-focus"><Crosshair size={15} /><span>{names || 'Room-wide framing'}</span></div>
      <section className="composer-section">
        <div className="section-heading"><h3>Framing</h3><button className="icon-button" aria-label="Reset framing to saved view" title="Reset framing" onClick={() => update(view ? { ...view, pan: { ...view.pan } } : inspection)}><RotateCcw size={13} /></button></div>
        <div className="slider-field"><label htmlFor="frame-zoom">Frame scale<span>{Math.round(draft.zoom)}%</span></label><input id="frame-zoom" type="range" min="55" max="180" value={draft.zoom} onChange={e => update({ zoom: Number(e.target.value) })} /></div>
        <div className="slider-field"><label htmlFor="frame-angle">View angle<span>{draft.tilt < 25 ? 'Above' : draft.tilt > 85 ? 'Eye level' : 'Spatial'}</span></label><input id="frame-angle" type="range" min="0" max="100" value={draft.tilt} onChange={e => update({ tilt: Number(e.target.value) })} /></div>
        <div className="frame-offsets"><NumericField label="Offset X" unit="px" value={Math.round(draft.pan.x)} onChange={v => update({ pan: { ...draft.pan, x: v } })} /><NumericField label="Offset Y" unit="px" value={Math.round(draft.pan.y)} onChange={v => update({ pan: { ...draft.pan, y: v } })} /></div>
        <div className="slider-field"><label htmlFor="frame-orbit">Orbit<span>{draft.angle} deg</span></label><input id="frame-orbit" type="range" min="-15" max="15" value={draft.angle} onChange={e => update({ angle: Number(e.target.value) })} /></div>
      </section>
      <section className="composer-section"><div className="section-heading"><h3>Projection</h3></div><select className="full-select" aria-label="Saved camera projection" value={draft.projection} onChange={e => update({ projection: e.target.value as CameraView['projection'] })}><option value="perspective">Perspective</option><option value="orthographic">Orthographic</option></select></section>
      <section className="composer-section movement-section">
        <button className="movement-heading" onClick={() => setMovementOpen(!movementOpen)}><span><Sparkles size={14} />Movement</span><small>{draft.motion === 'still' ? 'Still view' : draft.motion === 'arc' ? 'Arc' : 'Approach'}</small><ChevronDown size={14} className={movementOpen ? 'rotated' : ''} /></button>
        {movementOpen && <div className="movement-controls">
          <label>How the view arrives<select className="full-select" aria-label="Camera movement" value={draft.motion} onChange={e => update({ motion: e.target.value as CameraView['motion'] })}><option value="still">Hold the frame</option><option value="arc">A gentle arc around the focus</option><option value="approach">Approach the focus</option></select></label>
          {draft.motion !== 'still' && <><div className="timing-row"><span>Ease in and out</span><NumericField label="Duration" value={draft.duration} unit="s" onChange={v => update({ duration: Math.max(1, Math.min(30, v)) })} /></div><button className="secondary-button full-width" disabled={rehearsing} onClick={() => setRehearsing(true)}><Play size={13} />{rehearsing ? 'Rehearsing...' : 'Rehearse movement'}</button></>}
          <p className="field-hint">Movement belongs to this shared View. No Guide is needed.</p>
        </div>}
      </section>
    </div>
    <div className="panel-footer camera-footer">
      <div className="camera-save-row"><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={rehearsing} onClick={() => onSave(draft, false)}><Check size={15} />Save view</button></div>
      {view && <div className="camera-secondary-actions"><button className="text-button" disabled={rehearsing} onClick={() => onSave(draft, true)}><Copy size={12} />Save as a separate view</button><button className="icon-button danger-text" aria-label="Delete this saved view" title="Delete shared view" onClick={onDelete}><Trash2 size={13} /></button></div>}
      <p className="footer-hint">Only saving changes the authored View.</p>
    </div>
  </div>;
}