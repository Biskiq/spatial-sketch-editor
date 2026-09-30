import { useEffect, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, BookOpen, Box, Camera, ChevronDown, Download, GitBranch, Keyboard, Link2, LockKeyhole, PanelLeftClose, PanelLeftOpen, Pencil, Play, Redo2, RotateCcw, Search, Sparkles, Trash2, Undo2, X } from 'lucide-react';
import { captureView, initialInspection, initialProject, toInspection, uid, viewUsage, type CameraView, type Guide, type GuideStop, type Inspection, type Lens, type Presentation, type Project, type SubjectKind, type WorldSubject } from './model';
import { primeAudio } from './audio';
import SpatialCanvas, { subjectScreenPosition } from './components/SpatialCanvas';
import ProjectIndex from './components/ProjectIndex';
import { CameraEditor, EmptyPanel, PresentationPanel, StopPanel, WorldPanel } from './components/AuthoringPanels';
import { FocusDialog, GuideDialog, NewSubjectDialog, PresentationPicker, RenameDialog, SearchDialog, VariantDialog, ViewPicker, VisitorSettingsDialog, type SearchResult } from './components/AuthoringDialogs';
import VisitorPreview from './components/VisitorPreview';
import DesignNotebook from './components/DesignNotebook';
import { Brand, Dialog, Toast } from './components/ui';

const STORAGE_KEY = 'biskiq-shared-canvas-concept-v1';
interface History { past: Project[]; present: Project; future: Project[] }
type HistoryAction = { type: 'edit'; update: (project: Project) => Project } | { type: 'undo' } | { type: 'redo' } | { type: 'reset' };

function historyReducer(state: History, action: HistoryAction): History {
  if (action.type === 'reset') return { past: [], present: structuredClone(initialProject), future: [] };
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return { past: state.past.slice(0, -1), present: state.past[state.past.length - 1], future: [state.present, ...state.future] };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return { past: [...state.past, state.present], present: state.future[0], future: state.future.slice(1) };
  }
  return { past: [...state.past, state.present].slice(-60), present: action.update(state.present), future: [] };
}

function loadHistory(): History {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const project = JSON.parse(saved) as Project;
      if (Array.isArray(project.subjects) && Array.isArray(project.presentations) && Array.isArray(project.views)) return { past: [], present: project, future: [] };
    }
  } catch { /* Storage can be unavailable in a private browser session. */ }
  return { past: [], present: structuredClone(initialProject), future: [] };
}

type Attachment = { kind: 'presentation' | 'stop'; id: string } | null;
type CameraSession = { viewId: string | null; attachment: Attachment; before: Inspection };
type DialogState =
  | { kind: 'search' | 'subject' | 'pick-presentation' | 'visitor' | 'rename' | 'shortcuts' }
  | { kind: 'focus' | 'variant'; id: string }
  | { kind: 'views'; mode: 'inspect' | 'assign' | 'stop'; targetId?: string }
  | { kind: 'guide'; addingId?: string }
  | { kind: 'references'; entity: 'subject' | 'presentation' | 'view'; id: string }
  | { kind: 'confirm'; what: 'presentation' | 'subject' | 'view' | 'guide' | 'stop' | 'reset'; id?: string }
  | null;

export default function App() {
  const [history, dispatch] = useReducer(historyReducer, undefined, loadHistory);
  const project = history.present;
  const [lens, setLens] = useState<Lens>('experience');
  const [selectionIds, setSelectionIds] = useState<string[]>(() => project.presentations[0]?.focusIds ?? ['piano']);
  const [activePresentationId, setActivePresentationId] = useState<string | null>(() => project.presentations[0]?.id ?? null);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [inspection, setInspection] = useState<Inspection>(initialInspection);
  const [indexOpen, setIndexOpen] = useState(() => window.innerWidth > 1000);
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 800);
  const [showGuide, setShowGuide] = useState(false);
  const [cameraSession, setCameraSession] = useState<CameraSession | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [projectMenu, setProjectMenu] = useState(false);
  const [notebook, setNotebook] = useState(false);
  const [preview, setPreview] = useState<{ project: Project; presentationId: string | null; stopId: string | null } | null>(null);
  const [saveStatus, setSaveStatus] = useState<'Saved' | 'Saving' | 'Not saved'>('Saved');
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activePresentation = project.presentations.find(p => p.id === activePresentationId);
  const activeStop = project.guide?.stops.find(s => s.id === activeStopId);
  const selectedSubject = project.subjects.find(s => selectionIds.includes(s.id));
  const editingView = project.views.find(v => v.id === cameraSession?.viewId);

  const edit = (update: (project: Project) => Project) => dispatch({ type: 'edit', update });
  const notify = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  };

  useEffect(() => {
    setSaveStatus('Saving');
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      const timer = setTimeout(() => setSaveStatus('Saved'), 450);
      return () => clearTimeout(timer);
    } catch { setSaveStatus('Not saved'); }
  }, [project]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);
  useEffect(() => {
    const resize = () => {
      if (window.innerWidth <= 1000) setIndexOpen(false);
      if (window.innerWidth <= 800) setPanelOpen(false);
    };
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  const closeFraming = () => {
    if (cameraSession) setInspection(cameraSession.before);
    setCameraSession(null);
  };
  const leaveFramingForSelection = () => {
    if (cameraSession) { closeFraming(); notify('Framing closed. No View changes were saved.'); }
  };

  const switchLens = (nextLens: Lens) => {
    if (nextLens === lens) return;
    if (nextLens === 'experience') {
      const stillRelevant = activePresentation && (selectionIds.length === 0 ? activePresentation.focusIds.length === 0 : selectionIds.every(id => activePresentation.focusIds.includes(id)));
      if (!stillRelevant) {
        const related = project.presentations.find(p => selectionIds.some(id => p.focusIds.includes(id)));
        setActivePresentationId(related?.id ?? null);
        setActiveStopId(null);
      }
    }
    setLens(nextLens);
  };

  const selectSubject = (id: string) => {
    leaveFramingForSelection();
    setSelectionIds([id]);
    setPanelOpen(true);
    if (window.innerWidth <= 800) setIndexOpen(false);
    if (lens === 'experience') {
      const related = activePresentation?.focusIds.includes(id) ? activePresentation : project.presentations.find(p => p.focusIds.includes(id));
      setActivePresentationId(related?.id ?? null);
      setActiveStopId(null);
    } else if (!activePresentation?.focusIds.includes(id)) setActiveStopId(null);
  };

  const selectPresentation = (id: string) => {
    const presentation = project.presentations.find(p => p.id === id);
    if (!presentation) return;
    leaveFramingForSelection();
    setActivePresentationId(id);
    setActiveStopId(null);
    setSelectionIds([...presentation.focusIds]);
    setLens('experience');
    setPanelOpen(true);
    if (window.innerWidth <= 800) setIndexOpen(false);
  };

  const selectStop = (id: string) => {
    const stop = project.guide?.stops.find(s => s.id === id);
    if (!stop) return;
    leaveFramingForSelection();
    setActiveStopId(id);
    setActivePresentationId(stop.presentationId);
    setSelectionIds([...(project.presentations.find(p => p.id === stop.presentationId)?.focusIds ?? [])]);
    setLens('experience');
    setShowGuide(true);
    setPanelOpen(true);
    if (window.innerWidth <= 800) setIndexOpen(false);
  };

  const updatePresentation = (id: string, changes: Partial<Presentation>) => {
    edit(p => ({ ...p, presentations: p.presentations.map(presentation => presentation.id === id ? { ...presentation, ...changes } : presentation) }));
    if (changes.focusIds && id === activePresentationId) setSelectionIds([...changes.focusIds]);
  };
  const updateSubject = (id: string, changes: Partial<WorldSubject>, spatial = false) => edit(p => ({ ...p, subjects: p.subjects.map(subject => subject.id === id ? { ...subject, ...changes, spatialRevision: subject.spatialRevision + (spatial ? 1 : 0) } : subject) }));
  const updateStop = (id: string, changes: Partial<GuideStop>) => edit(p => ({ ...p, guide: p.guide ? { ...p.guide, stops: p.guide.stops.map(stop => stop.id === id ? { ...stop, ...changes } : stop) } : null }));

  const createPresentation = () => {
    leaveFramingForSelection();
    const focusIds = selectionIds.filter(id => project.subjects.some(s => s.id === id && s.available));
    const subject = project.subjects.find(s => focusIds.includes(s.id));
    const presentation: Presentation = { id: uid('presentation'), title: focusIds.length > 1 ? 'A shared moment' : subject?.name ?? 'A new story', body: '', focusIds, viewId: null, discoverable: true, interaction: 'none', detailText: '', activity: 'none', variants: [] };
    edit(p => ({ ...p, presentations: [...p.presentations, presentation] }));
    setActivePresentationId(presentation.id);
    setActiveStopId(null);
    setSelectionIds(focusIds);
    setLens('experience');
    setShowGuide(false);
    setPanelOpen(true);
    if (window.innerWidth <= 800) setIndexOpen(false);
    notify('A new Presentation. Same subjects, same place. Choose a View when you are ready.');
  };

  const createSubject = (name: string, kind: SubjectKind) => {
    const dimensions: Record<SubjectKind, [number, number, number]> = { piano: [1.55, 2.27, 1.02], bench: [2, 0.6, 0.46], plant: [0.7, 0.7, 1.8], artwork: [0.1, 1, 1.2], window: [0.2, 1, 2], architecture: [3, 0.2, 2.5], plinth: [0.8, 0.8, 0.9] };
    const subject: WorldSubject = { id: uid('subject'), name, kind, dimensions: dimensions[kind], position: [4, 2.4, 0], rotation: 0, material: kind === 'bench' ? 'Natural oak' : 'Limestone', available: true, spatialRevision: 0 };
    edit(p => ({ ...p, subjects: [...p.subjects, subject] }));
    setSelectionIds([subject.id]);
    setLens('world');
    setActivePresentationId(null);
    setActiveStopId(null);
    setInspection({ ...initialInspection, tilt: 0 });
    setPanelOpen(true);
    if (window.innerWidth <= 800) setIndexOpen(false);
    setDialog(null);
    notify(`${name} added to World. Use Move to arrange it from above.`);
  };

  const captureCurrent = (attachment: Attachment) => {
    const name = selectedSubject ? `${selectedSubject.name}, captured frame` : 'The room, captured frame';
    const view = captureView(project, inspection, selectionIds, name);
    edit(p => ({ ...p, views: [...p.views, view], presentations: attachment?.kind === 'presentation' ? p.presentations.map(presentation => presentation.id === attachment.id ? { ...presentation, viewId: view.id } : presentation) : p.presentations, guide: attachment?.kind === 'stop' && p.guide ? { ...p.guide, stops: p.guide.stops.map(stop => stop.id === attachment.id ? { ...stop, entryViewId: view.id } : stop) } : p.guide }));
    setDialog(null);
    notify(attachment ? 'Current inspection captured as a shared View and explicitly linked.' : 'Current inspection captured in the shared View library.');
  };

  const openCamera = (viewId: string | null, attachment: Attachment = null) => {
    const view = project.views.find(v => v.id === viewId);
    setCameraSession({ viewId, attachment, before: { ...inspection, pan: { ...inspection.pan } } });
    if (view) setInspection(toInspection(view));
    setPanelOpen(true);
    setDialog(null);
  };

  const saveCamera = (draft: CameraView, asNew: boolean) => {
    const view: CameraView = { ...draft, id: asNew ? uid('view') : draft.id, name: draft.name.trim() || 'Untitled View', subjectRevisions: Object.fromEntries(project.subjects.filter(s => draft.focusIds.includes(s.id)).map(s => [s.id, s.spatialRevision])) };
    const attachment = cameraSession?.attachment;
    const attach = asNew || !cameraSession?.viewId;
    edit(p => ({ ...p, views: p.views.some(v => v.id === view.id) ? p.views.map(v => v.id === view.id ? view : v) : [...p.views, view], presentations: attach && attachment?.kind === 'presentation' ? p.presentations.map(presentation => presentation.id === attachment.id ? { ...presentation, viewId: view.id } : presentation) : p.presentations, guide: attach && attachment?.kind === 'stop' && p.guide ? { ...p.guide, stops: p.guide.stops.map(stop => stop.id === attachment.id ? { ...stop, entryViewId: view.id } : stop) } : p.guide }));
    setInspection(toInspection(view));
    setCameraSession(null);
    notify(asNew ? 'A separate View saved. Other uses keep their original View.' : 'View saved to the shared Camera. World source truth is unchanged.');
  };

  const inspectView = (id: string) => {
    const view = project.views.find(v => v.id === id);
    if (!view) return;
    setInspection(toInspection(view));
    notify(`Inspecting "${view.name}". No authored framing was changed.`);
  };

  const makeStop = (presentationId: string): GuideStop => ({ id: uid('stop'), presentationId, entryViewId: null, prompt: '', continuation: 'manual', seconds: 8, gate: 'none' });
  const addStop = (presentationId: string) => {
    if (!project.guide) { setDialog({ kind: 'guide', addingId: presentationId }); return; }
    const stop = makeStop(presentationId);
    edit(p => ({ ...p, guide: p.guide ? { ...p.guide, stops: [...p.guide.stops, stop] } : null }));
    setActiveStopId(stop.id);
    setActivePresentationId(presentationId);
    setSelectionIds([...(project.presentations.find(p => p.id === presentationId)?.focusIds ?? [])]);
    setLens('experience');
    setShowGuide(true);
    setPanelOpen(true);
    setDialog(null);
    notify('One occurrence added. The Presentation stays reusable.');
  };

  const saveGuide = (title: string, rejoin: Guide['rejoin']) => {
    const addingId = dialog?.kind === 'guide' ? dialog.addingId : undefined;
    const stop = addingId ? makeStop(addingId) : undefined;
    edit(p => ({ ...p, guide: p.guide ? { ...p.guide, title, rejoin } : { id: uid('guide'), title, rejoin, stops: stop ? [stop] : [] } }));
    setShowGuide(true);
    setLens('experience');
    if (stop) { setActiveStopId(stop.id); setActivePresentationId(stop.presentationId); }
    setDialog(null);
    notify(project.guide ? 'Guide settings saved. Visitor exploration remains available.' : 'An optional path created. Your Presentations remain independent.');
  };

  const moveStop = (id: string, direction: -1 | 1) => edit(p => {
    if (!p.guide) return p;
    const index = p.guide.stops.findIndex(s => s.id === id);
    const target = index + direction;
    if (target < 0 || target >= p.guide.stops.length) return p;
    const stops = [...p.guide.stops];
    [stops[index], stops[target]] = [stops[target], stops[index]];
    return { ...p, guide: { ...p.guide, stops } };
  });

  const deleteView = (id: string) => {
    const uses = viewUsage(project, id);
    edit(p => ({ ...p, views: p.views.filter(v => v.id !== id) }));
    if (cameraSession?.viewId === id) closeFraming();
    notify(uses ? `View removed. ${uses} ${uses === 1 ? 'reference needs' : 'references need'} explicit repair.` : 'Unused View removed from the shared library.');
  };

  const performDeletion = () => {
    if (dialog?.kind !== 'confirm') return;
    const { what, id } = dialog;
    if (what === 'view' && id) deleteView(id);
    if (what === 'subject' && id) { updateSubject(id, { available: false }); notify('Subject removed. Linked Presentations retain their meaning and reveal the missing focus.'); }
    if (what === 'presentation' && id) {
      edit(p => ({ ...p, presentations: p.presentations.filter(presentation => presentation.id !== id), guide: p.guide ? { ...p.guide, stops: p.guide.stops.filter(s => s.presentationId !== id) } : null }));
      if (activePresentationId === id) { setActivePresentationId(null); setActiveStopId(null); }
      notify('Presentation and its Guide occurrences removed. World subjects and Views are unchanged.');
    }
    if (what === 'guide') { edit(p => ({ ...p, guide: null })); setActiveStopId(null); setShowGuide(false); notify('Guide removed. All Presentations remain available for exploration.'); }
    if (what === 'stop' && id) { edit(p => ({ ...p, guide: p.guide ? { ...p.guide, stops: p.guide.stops.filter(s => s.id !== id) } : null })); setActiveStopId(null); notify('Occurrence removed. Its Presentation is unchanged.'); }
    if (what === 'reset') {
      dispatch({ type: 'reset' }); setSelectionIds(['piano']); setActivePresentationId('story-piano'); setActiveStopId(null); setInspection(initialInspection); setCameraSession(null); setLens('experience'); setShowGuide(false); setPanelOpen(true); setIndexOpen(true); notify('The concept is back to its original Listening Room.');
    }
    setDialog(null);
  };

  const duplicatePresentation = () => {
    if (!activePresentation) return;
    const duplicate = { ...structuredClone(activePresentation), id: uid('presentation'), title: `${activePresentation.title} / another perspective` };
    edit(p => ({ ...p, presentations: [...p.presentations, duplicate] }));
    setActivePresentationId(duplicate.id);
    setActiveStopId(null);
    notify('A new Presentation. Its source subjects and shared View remain linked.');
  };

  const startPreview = () => {
    if (cameraSession) { notify('Save or cancel the working View before visitor Preview.'); return; }
    primeAudio();
    const relevantMeaning = activePresentation && selectionIds.every(id => activePresentation.focusIds.includes(id)) ? activePresentation : project.presentations.find(p => selectionIds.some(id => p.focusIds.includes(id)));
    // Preview receives a read-only snapshot, never an authoring mutation callback.
    setPreview({ project: structuredClone(project), presentationId: lens === 'world' ? relevantMeaning?.id ?? null : activePresentationId, stopId: lens === 'experience' ? activeStopId : null });
    setToast(null);
  };

  const chooseSearchResult = (result: SearchResult) => {
    setDialog(null);
    if (result.type === 'world') { setLens('world'); setSelectionIds([result.id]); setActiveStopId(null); setPanelOpen(true); leaveFramingForSelection(); }
    if (result.type === 'presentation') selectPresentation(result.id);
    if (result.type === 'stop') selectStop(result.id);
    if (result.type === 'view') openCamera(result.id);
  };

  const exportProject = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'biskiq-listening-room-concept.json'; link.click();
    URL.revokeObjectURL(url);
    setProjectMenu(false);
    notify('Authored concept exported. Visitor session state is not included.');
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (dialog) return;
        if (preview) setPreview(null);
        else if (notebook) setNotebook(false);
        else if (cameraSession) closeFraming();
        else setProjectMenu(false);
        return;
      }
      if (preview || notebook) return;
      const target = event.target as HTMLElement;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setDialog({ kind: 'search' }); return; }
      if (dialog || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      if (cameraSession && (event.metaKey || event.ctrlKey) && ['z', 'y'].includes(event.key.toLowerCase())) { event.preventDefault(); notify('Save or cancel the working View before changing source history.'); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); dispatch({ type: event.shiftKey ? 'redo' : 'undo' }); return; }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); dispatch({ type: 'redo' }); return; }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() === 'w') switchLens('world');
      if (event.key.toLowerCase() === 'e') switchLens('experience');
      if (event.key.toLowerCase() === 'p') startPreview();
      if (event.key === '0') setInspection(initialInspection);
      if (event.key.toLowerCase() === 'f' && selectedSubject) {
        const [x, y] = subjectScreenPosition(selectedSubject, inspection.tilt);
        setInspection({ ...inspection, zoom: 128, pan: { x: (50 - x) * 9, y: (50 - y) * 6 } });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const closeDialog = () => setDialog(null);
  const pickerAttachment: Attachment = dialog?.kind === 'views' && dialog.targetId && dialog.mode !== 'inspect' ? { kind: dialog.mode === 'stop' ? 'stop' : 'presentation', id: dialog.targetId } : null;
  const pickerPresentation = dialog?.kind === 'views' ? project.presentations.find(p => p.id === dialog.targetId) : undefined;
  const pickerStop = dialog?.kind === 'views' ? project.guide?.stops.find(s => s.id === dialog.targetId) : undefined;

  return <>
    <div className="app-shell" aria-hidden={Boolean(preview || notebook)} inert={preview || notebook ? true : undefined}>
      {projectMenu && <button className="menu-dismiss" aria-label="Close project menu" onClick={() => setProjectMenu(false)} />}
      <header className="app-header"><div className="header-project"><Brand /><span className="header-divider" /><div className="project-selector"><button className="project-name-button" onClick={() => setProjectMenu(!projectMenu)}><LockKeyhole size={12} /><span>{project.name}</span><ChevronDown size={13} /></button>{projectMenu && <div className="small-menu project-menu"><span className="menu-label">YOUR LOCAL PROJECT</span><button onClick={() => { setDialog({ kind: 'rename' }); setProjectMenu(false); }}><Pencil size={14} />Rename project</button><button onClick={exportProject}><Download size={14} />Export a concept copy</button><button onClick={() => { setNotebook(true); setProjectMenu(false); }}><BookOpen size={14} />About this direction</button><div className="menu-rule" /><button onClick={() => { setDialog({ kind: 'confirm', what: 'reset' }); setProjectMenu(false); }}><RotateCcw size={14} />Reset the demo</button></div>}</div></div><nav className="intention-switch" aria-label="Authoring intention">{(['world', 'experience'] as const).map(intent => <button key={intent} className={lens === intent ? 'selected' : ''} aria-pressed={lens === intent} onClick={() => switchLens(intent)}>{lens === intent && <motion.span className="intent-highlight" layoutId="intent-highlight" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />}<span>{intent === 'world' ? <Box size={15} /> : <Sparkles size={15} />}{intent.toUpperCase()}</span></button>)}</nav><div className="header-actions"><div className="history-controls"><button className="icon-button" title="Undo (Ctrl/Cmd Z)" aria-label="Undo authored change" disabled={!history.past.length || Boolean(cameraSession)} onClick={() => dispatch({ type: 'undo' })}><Undo2 size={17} /></button><button className="icon-button" title="Redo (Ctrl/Cmd Shift Z)" aria-label="Redo authored change" disabled={!history.future.length || Boolean(cameraSession)} onClick={() => dispatch({ type: 'redo' })}><Redo2 size={17} /></button></div><span className={`saved-status ${saveStatus === 'Not saved' ? 'not-saved' : ''}`} title="Authored changes are stored in this browser"><span />{saveStatus}</span><button className="primary-button preview-button" onClick={startPreview} disabled={Boolean(cameraSession)} title={cameraSession ? 'Save or cancel framing before Preview' : 'Visitor Preview (P)'}><Play size={14} fill="currentColor" />Preview</button><span className="creator-avatar" title="Jamie, creator">J</span></div></header>
      <main className={`shell-workspace ${!indexOpen ? 'index-closed' : ''} ${!panelOpen ? 'panel-closed' : ''}`}>
        {indexOpen && <ProjectIndex project={project} lens={lens} selectionIds={selectionIds} activePresentationId={activePresentationId} activeStopId={activeStopId} showGuide={showGuide} onShowGuide={setShowGuide} onSelectSubject={selectSubject} onSelectPresentation={selectPresentation} onSelectStop={selectStop} onNewPresentation={createPresentation} onNewSubject={() => setDialog({ kind: 'subject' })} onCreateGuide={() => setDialog({ kind: 'guide' })} onAddStop={() => setDialog({ kind: 'pick-presentation' })} onGuideSettings={() => setDialog({ kind: 'guide' })} onSearch={() => setDialog({ kind: 'search' })} onVisitorSettings={() => setDialog({ kind: 'visitor' })} />}
        <SpatialCanvas project={project} lens={lens} selectionIds={selectionIds} activePresentationId={activePresentationId} inspection={inspection} onInspection={setInspection} onSelectSubject={selectSubject} onSelectPresentation={selectPresentation} onMoveSubject={(id, x, y) => { const subject = project.subjects.find(s => s.id === id); if (subject) updateSubject(id, { position: [x, y, subject.position[2]] }, true); }} onOpenViews={() => setDialog({ kind: 'views', mode: 'inspect' })} onPresent={createPresentation} cameraEditing={Boolean(cameraSession)} panelOpen={panelOpen} onTogglePanel={() => { setPanelOpen(!panelOpen); if (!panelOpen && window.innerWidth <= 800) setIndexOpen(false); }} />
        {panelOpen && <aside className="context-workbench" aria-label="Contextual authoring tools">
          <button className="workbench-close-mobile" aria-label="Close contextual workbench" onClick={() => setPanelOpen(false)}><X size={15} /></button>
          <AnimatePresence mode="wait" initial={false}><motion.div className="workbench-content" key={cameraSession ? `camera-${cameraSession.viewId ?? 'new'}` : `${lens}-${activeStop?.id ?? activePresentationId ?? selectedSubject?.id ?? 'empty'}`} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 5 }} transition={{ duration: 0.16 }}>
          {cameraSession ? (
            <CameraEditor project={project} view={editingView} inspection={inspection} focusIds={selectionIds} onInspection={setInspection} onSave={saveCamera} onCancel={closeFraming}
              onDelete={() => editingView && setDialog({ kind: 'confirm', what: 'view', id: editingView.id })}
              onReferences={() => editingView && setDialog({ kind: 'references', entity: 'view', id: editingView.id })} />
          ) : lens === 'world' && selectedSubject ? (
            <WorldPanel project={project} subject={selectedSubject} onUpdate={(changes, spatial) => updateSubject(selectedSubject.id, changes, spatial)} onPresent={createPresentation}
              onReferences={() => setDialog({ kind: 'references', entity: 'subject', id: selectedSubject.id })}
              onRemove={() => setDialog({ kind: 'confirm', what: 'subject', id: selectedSubject.id })}
              onRestore={() => { updateSubject(selectedSubject.id, { available: true }); notify('Original subject restored. Its linked Presentations are connected again.'); }} />
          ) : lens === 'experience' && activeStop ? (
            <StopPanel project={project} stop={activeStop} onUpdate={changes => updateStop(activeStop.id, changes)}
              onEditPresentation={() => { setActiveStopId(null); setActivePresentationId(activeStop.presentationId); }}
              onChooseView={() => setDialog({ kind: 'views', mode: 'stop', targetId: activeStop.id })} onInspectView={inspectView}
              onMove={direction => moveStop(activeStop.id, direction)} onRemove={() => setDialog({ kind: 'confirm', what: 'stop', id: activeStop.id })} />
          ) : lens === 'experience' && activePresentation ? (
            <PresentationPanel project={project} presentation={activePresentation} onUpdate={changes => updatePresentation(activePresentation.id, changes)}
              onEditFocus={() => setDialog({ kind: 'focus', id: activePresentation.id })} onCapture={() => captureCurrent({ kind: 'presentation', id: activePresentation.id })}
              onChooseView={() => setDialog({ kind: 'views', mode: 'assign', targetId: activePresentation.id })} onEditView={id => openCamera(id, { kind: 'presentation', id: activePresentation.id })}
              onInspectView={inspectView} onAddGuide={() => addStop(activePresentation.id)} onAddVariant={() => setDialog({ kind: 'variant', id: activePresentation.id })}
              onDuplicate={duplicatePresentation} onDelete={() => setDialog({ kind: 'confirm', what: 'presentation', id: activePresentation.id })}
              onReferences={() => setDialog({ kind: 'references', entity: 'presentation', id: activePresentation.id })} />
          ) : <EmptyPanel subject={selectedSubject} lens={lens} onPresent={createPresentation} onNewSubject={() => setDialog({ kind: 'subject' })} />}
        </motion.div></AnimatePresence></aside>}
      </main>
      <footer className="app-footer">
        <div><button aria-label={indexOpen ? 'Hide scoped index' : 'Show scoped index'} onClick={() => { setIndexOpen(!indexOpen); if (!indexOpen && window.innerWidth <= 800) setPanelOpen(false); }} title="Toggle scoped index">{indexOpen ? <PanelLeftClose size={13} /> : <PanelLeftOpen size={13} />}<span>{indexOpen ? 'Hide index' : 'Show index'}</span></button><span className="footer-divider" /><button className="notebook-link" onClick={() => setNotebook(true)}><BookOpen size={12} />Design notebook<ArrowUpRight size={11} /></button></div>
        <span className="footer-inspection-hint">Inspection stays yours until you capture it.</span>
        <div><button className="shortcut-help" aria-label="Show keyboard shortcuts" onClick={() => setDialog({ kind: 'shortcuts' })}><Keyboard size={14} /></button><button onClick={() => setDialog({ kind: 'search' })}><Search size={12} />Quick find<kbd>Ctrl K</kbd></button></div>
      </footer>
    </div>
    <AnimatePresence>{preview && <VisitorPreview project={preview.project} presentationId={preview.presentationId} stopId={preview.stopId} onExit={() => { setPreview(null); notify('Back in your authoring context. Visitor session changes were not saved.'); }} />}{notebook && <DesignNotebook onClose={() => setNotebook(false)} />}</AnimatePresence>
    <AnimatePresence>
      {dialog?.kind === 'search' && <SearchDialog project={project} onChoose={chooseSearchResult} onClose={closeDialog} />}
      {dialog?.kind === 'focus' && (() => { const p = project.presentations.find(p => p.id === dialog.id); return p && <FocusDialog project={project} presentation={p} onSave={ids => { updatePresentation(p.id, { focusIds: ids }); closeDialog(); notify(ids.length ? 'Focus saved. World subjects are referenced, not copied.' : 'A subject-free Presentation. Its story and Guide uses remain.'); }} onClose={closeDialog} />; })()}
      {dialog?.kind === 'subject' && <NewSubjectDialog onSave={createSubject} onClose={closeDialog} />}
      {dialog?.kind === 'views' && <ViewPicker project={project} selectedId={dialog.mode === 'assign' ? pickerPresentation?.viewId ?? null : dialog.mode === 'stop' ? pickerStop?.entryViewId ?? null : null} mode={dialog.mode} onChoose={id => { if (pickerAttachment?.kind === 'presentation') updatePresentation(pickerAttachment.id, { viewId: id }); if (pickerAttachment?.kind === 'stop') updateStop(pickerAttachment.id, { entryViewId: id }); inspectView(id); closeDialog(); }} onCapture={() => captureCurrent(pickerAttachment)} onNew={() => openCamera(null, pickerAttachment)} onDelete={deleteView} onClear={dialog.mode === 'inspect' ? undefined : () => { if (pickerAttachment?.kind === 'presentation') updatePresentation(pickerAttachment.id, { viewId: null }); if (pickerAttachment?.kind === 'stop') updateStop(pickerAttachment.id, { entryViewId: null }); closeDialog(); notify(pickerAttachment?.kind === 'stop' ? 'This occurrence now uses its Presentation view.' : 'No authored View is required. Visitors retain their own inspection.'); }} onClose={closeDialog} />}
      {dialog?.kind === 'guide' && <GuideDialog guide={project.guide} addingPresentation={project.presentations.find(p => p.id === dialog.addingId)?.title} onSave={saveGuide} onDelete={() => setDialog({ kind: 'confirm', what: 'guide' })} onClose={closeDialog} />}
      {dialog?.kind === 'pick-presentation' && <PresentationPicker project={project} onChoose={addStop} onClose={closeDialog} />}
      {dialog?.kind === 'variant' && (() => { const p = project.presentations.find(p => p.id === dialog.id); return p && <VariantDialog presentation={p} onSave={(label, body) => { updatePresentation(p.id, { variants: [...p.variants, { id: uid('variant'), label, body }] }); closeDialog(); notify('Content variant added inside the same reusable Presentation.'); }} onClose={closeDialog} />; })()}
      {dialog?.kind === 'visitor' && <VisitorSettingsDialog project={project} onToggle={id => { const p = project.presentations.find(p => p.id === id); if (p) updatePresentation(id, { discoverable: !p.discoverable }); }} onClose={closeDialog} />}
      {dialog?.kind === 'rename' && <RenameDialog name={project.name} onSave={name => { edit(p => ({ ...p, name })); closeDialog(); }} onClose={closeDialog} />}
      {dialog?.kind === 'confirm' && <Dialog title={dialog.what === 'reset' ? 'Return to the original room?' : dialog.what === 'subject' ? 'Remove this World subject?' : dialog.what === 'view' ? 'Delete this shared View?' : dialog.what === 'stop' ? 'Remove this occurrence?' : dialog.what === 'guide' ? 'Remove the authored path?' : 'Delete this Presentation?'} eyebrow="AN EXPLICIT AUTHORING DECISION" onClose={closeDialog}><p className="dialog-description">{dialog.what === 'reset' ? 'This replaces the locally saved concept with the original sample. Export a copy first if you want to keep your work.' : dialog.what === 'subject' ? 'The source becomes unavailable. Presentations keep their meaning and reveal their missing focus so you can repair it. You can undo or restore the subject.' : dialog.what === 'view' ? `This View has ${viewUsage(project, dialog.id ?? '')} uses. Its references will be retained and flagged for explicit repair. No replacement will be guessed.` : dialog.what === 'stop' ? 'Only this moment is removed from the Guide. The reusable Presentation, its World subjects, and its Views stay unchanged.' : dialog.what === 'guide' ? 'The Guide and its Stops are removed. All Presentations, World subjects, and Views remain. Free exploration is still a complete Experience.' : `The Presentation and its ${project.guide?.stops.filter(s => s.presentationId === dialog.id).length ?? 0} Guide occurrences will be removed. World subjects and shared Views stay unchanged.`}</p><div className="dialog-footer"><button className="secondary-button" onClick={closeDialog}>Keep it</button><button className="danger-button" onClick={performDeletion}>{dialog.what === 'reset' ? <RotateCcw size={14} /> : <Trash2 size={14} />}{dialog.what === 'reset' ? 'Reset concept' : dialog.what === 'subject' ? 'Remove subject' : dialog.what === 'stop' ? 'Remove stop' : dialog.what === 'guide' ? 'Remove guide' : 'Delete'}</button></div></Dialog>}
      {dialog?.kind === 'references' && <Dialog title={dialog.entity === 'subject' ? `${project.subjects.find(s => s.id === dialog.id)?.name ?? 'This subject'} is connected.` : dialog.entity === 'presentation' ? 'One story. More than one moment.' : 'One View, shared.'} eyebrow="WHERE IT IS USED" onClose={closeDialog}><p className="dialog-description">These are live references, not copies. Open a use to understand its context.</p><div className="reference-list">
        {dialog.entity === 'subject' && <>{project.presentations.filter(p => p.focusIds.includes(dialog.id)).map(p => <button key={p.id} onClick={() => { selectPresentation(p.id); closeDialog(); }}><Sparkles size={17} /><span><strong>{p.title}</strong><small>Presentation focus</small></span><ArrowRight size={15} /></button>)}{project.views.filter(v => v.focusIds.includes(dialog.id)).map(v => <button key={v.id} onClick={() => openCamera(v.id)}><Camera size={17} /><span><strong>{v.name}</strong><small>Shared Camera focus</small></span><ArrowRight size={15} /></button>)}</>}
        {dialog.entity === 'presentation' && <>{project.guide?.stops.filter(s => s.presentationId === dialog.id).map(s => <button key={s.id} onClick={() => { selectStop(s.id); closeDialog(); }}><GitBranch size={17} /><span><strong>Stop {String((project.guide?.stops.findIndex(stop => stop.id === s.id) ?? 0) + 1).padStart(2, '0')} / {project.guide?.title}</strong><small>{s.prompt || 'Presentation entry context'}</small></span><ArrowRight size={15} /></button>)}{!project.guide?.stops.some(s => s.presentationId === dialog.id) && <div className="reference-empty"><Sparkles size={24} /><p>No Guide uses. This Presentation can still be discovered and interacted with freely.</p></div>}</>}
        {dialog.entity === 'view' && <>{project.presentations.filter(p => p.viewId === dialog.id).map(p => <button key={p.id} onClick={() => { selectPresentation(p.id); closeDialog(); }}><Sparkles size={17} /><span><strong>{p.title}</strong><small>Presentation View</small></span><ArrowRight size={15} /></button>)}{project.guide?.stops.filter(s => s.entryViewId === dialog.id).map(s => <button key={s.id} onClick={() => { selectStop(s.id); closeDialog(); }}><GitBranch size={17} /><span><strong>Stop {(project.guide?.stops.findIndex(stop => stop.id === s.id) ?? 0) + 1}</strong><small>Occurrence entry override</small></span><ArrowRight size={15} /></button>)}</>}
      </div><div className="dialog-footer"><span className="small-muted"><Link2 size={12} />Same identity. Different creative uses.</span><button className="secondary-button" onClick={closeDialog}>Back to context</button></div></Dialog>}
      {dialog?.kind === 'shortcuts' && <Dialog title="A little less reaching." eyebrow="KEYBOARD SHORTCUTS" onClose={closeDialog}><div className="shortcut-list">{[['World intention', 'W'], ['Experience intention', 'E'], ['Visitor Preview', 'P'], ['Focus selected subject', 'F'], ['Return to room', '0'], ['Find anything', 'Ctrl / Cmd K'], ['Undo source authoring', 'Ctrl / Cmd Z'], ['Redo', 'Ctrl / Cmd Shift Z'], ['Exit Preview, framing, or dialog', 'Esc']].map(([label, key]) => <div key={label}><span>{label}</span><kbd>{key}</kbd></div>)}</div><p className="dialog-description">Shortcuts pause while you are writing. Preview interactions and Camera inspection never enter source undo history.</p></Dialog>}
    </AnimatePresence>
    {!preview && !notebook && <Toast message={toast} />}
  </>;
}