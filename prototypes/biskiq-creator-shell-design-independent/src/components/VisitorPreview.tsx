import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Compass, Eye, GitBranch, Music2, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { getIssues, type Project } from '../model';
import { muteAudio, playNote, playPhrase, primeAudio } from '../audio';
import { Brand } from './ui';
import { PlanScene, subjectScreenPosition } from './SpatialCanvas';

export default function VisitorPreview({ project, presentationId, stopId, onExit }: { project: Project; presentationId: string | null; stopId: string | null; onExit: () => void }) {
  const guide = project.guide;
  const initialStop = guide?.stops.findIndex(s => s.id === stopId) ?? -1;
  const [guided, setGuided] = useState(initialStop >= 0);
  const [cursor, setCursorValue] = useState(Math.max(0, initialStop));
  const [arrival, setArrival] = useState(0);
  const setCursor = (value: number) => {
    setCursorValue(value);
    setElapsed(rememberedPacing.current.get(guide?.stops[value]?.id ?? '') ?? 0);
    setActivityComplete(false);
    setArrival(v => v + 1);
  };
  const [currentId, setCurrentId] = useState(initialStop >= 0 ? guide!.stops[initialStop].presentationId : presentationId ?? project.presentations.find(p => p.discoverable)?.id ?? project.presentations[0]?.id ?? null);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [sound, setSound] = useState(true);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const [interacted, setInteracted] = useState<Set<string>>(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [activityComplete, setActivityComplete] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const completedActivities = useRef(new Set<string>());
  const rememberedPacing = useRef(new Map<string, number>());
  const [variantId, setVariantId] = useState('default');
  const [look, setLook] = useState({ x: 0, y: 0, zoom: 1 });
  const drag = useRef<{ x: number; y: number; initialX: number; initialY: number } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presentation = project.presentations.find(p => p.id === currentId);
  const stop = guide?.stops[cursor];
  const view = project.views.find(v => v.id === (guided ? stop?.entryViewId ?? presentation?.viewId : presentation?.viewId));
  const issues = presentation ? getIssues(project, presentation) : null;
  const missingEntry = Boolean(guided && stop?.entryViewId && !view);
  const broken = guided && stop?.entryViewId ? missingEntry : issues?.missingView;
  const tilt = view?.tilt ?? 62;
  const isEye = tilt > 85;
  const isPlan = tilt < 25;
  const gateSatisfied = !guided || !stop || stop.gate === 'none' || interacted.has(stop.id);
  const next = () => {
    if (!guide || !gateSatisfied) return;
    if (cursor < guide.stops.length - 1) {
      setCursor(cursor + 1);
      setCurrentId(guide.stops[cursor + 1].presentationId);
    } else setGuided(false);
  };
  const nextRef = useRef(next);
  nextRef.current = next;

  useEffect(() => {
    const entryKey = guided && stop ? stop.id : `explore:${currentId}`;
    const finish = () => { completedActivities.current.add(entryKey); setPlaying(false); setActivityComplete(true); };
    setDetailOpen(false);
    setVariantId('default');
    setLook({ x: 0, y: 0, zoom: 1 });
    setActivityComplete(false);
    setElapsed(guided && stop ? rememberedPacing.current.get(stop.id) ?? 0 : 0);
    setPlaying(false);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (completedActivities.current.has(entryKey)) setActivityComplete(true);
    else if (presentation?.activity === 'phrase') {
      if (soundRef.current) playPhrase();
      setPlaying(true);
      timer = setTimeout(finish, 3300);
    } else if (presentation?.activity === 'highlight') timer = setTimeout(finish, 1600);
    else finish();
    return () => { if (timer) clearTimeout(timer); };
  }, [currentId, arrival, presentation?.activity]);

  useEffect(() => {
    if (guided && stop) rememberedPacing.current.set(stop.id, elapsed);
  }, [elapsed, guided, stop?.id]);

  useEffect(() => {
    if (!guided || !stop || broken) return;
    if (stop.continuation === 'activity' && activityComplete && gateSatisfied) {
      const timer = setTimeout(() => nextRef.current(), 900);
      return () => clearTimeout(timer);
    }
    if (stop.continuation === 'timed') {
      const interval = setInterval(() => setElapsed(v => Math.min(stop.seconds, v + 1)), 1000);
      return () => clearInterval(interval);
    }
  }, [guided, stop?.id, stop?.continuation, stop?.seconds, activityComplete, gateSatisfied, broken]);

  useEffect(() => {
    if (guided && stop?.continuation === 'timed' && elapsed >= stop.seconds && gateSatisfied) nextRef.current();
  }, [elapsed, gateSatisfied, guided, stop?.continuation, stop?.seconds]);

  useEffect(() => () => { muteAudio(); if (noteTimer.current) clearTimeout(noteTimer.current); }, []);

  const interact = () => {
    if (!presentation) return;
    setInteracted(old => {
      const updated = new Set(old);
      updated.add(presentation.id);
      if (stop?.presentationId === presentation.id) updated.add(stop.id);
      return updated;
    });
    if (presentation.interaction === 'note') {
      if (sound) playNote();
      setPlaying(true);
      if (noteTimer.current) clearTimeout(noteTimer.current);
      noteTimer.current = setTimeout(() => setPlaying(false), 1400);
    } else setDetailOpen(!detailOpen);
  };

  const explorePresentation = (id: string) => { setGuided(false); setCurrentId(id); setExploreOpen(false); if (id !== currentId) setArrival(v => v + 1); };
  const resumeGuide = () => {
    if (!guide?.stops.length) return;
    const resume = guide.rejoin === 'next' && interacted.has(guide.stops[cursor].id) ? Math.min(cursor + 1, guide.stops.length - 1) : cursor;
    setCursor(resume);
    setCurrentId(guide.stops[resume].presentationId);
    setGuided(true);
    setExploreOpen(false);
  };
  const variant = presentation?.variants.find(v => v.id === variantId);
  return <motion.div className="visitor-preview" initial={{ opacity: 0, scale: 1.015 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.99 }} transition={{ duration: 0.35 }}>
    <div className="preview-control-bar"><span><Eye size={14} />VISITOR PREVIEW</span><span className="preview-safety">Explore, interact, leave, rejoin. Your project is unchanged.</span><button onClick={onExit}><ArrowLeft size={14} />Back to editing<kbd>Esc</kbd></button></div>
    <div className={`visitor-stage ${isEye ? 'visitor-interior' : 'visitor-isometric'} ${presentation?.activity === 'highlight' && !activityComplete ? 'visitor-highlight' : ''}`} onPointerDown={event => {
      if ((event.target as HTMLElement).closest('button, select, a')) return;
      drag.current = { x: event.clientX, y: event.clientY, initialX: look.x, initialY: look.y };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerMove={event => {
      if (drag.current) setLook({ ...look, x: Math.max(-100, Math.min(100, drag.current.initialX + (event.clientX - drag.current.x) * 0.25)), y: Math.max(-60, Math.min(60, drag.current.initialY + (event.clientY - drag.current.y) * 0.2)) });
    }} onPointerUp={() => { drag.current = null; }} onWheel={event => setLook({ ...look, zoom: Math.max(1, Math.min(1.5, look.zoom - event.deltaY * 0.0005)) })}>
      <AnimatePresence mode="wait"><motion.div key={view?.id ?? 'free-room'} className={`visitor-image-wrap ${view?.motion === 'arc' ? 'visitor-arc' : view?.motion === 'approach' ? 'visitor-approach' : ''}`} style={{ animationDuration: `${view?.duration ?? 6}s` }} initial={{ opacity: 0 }} animate={{ opacity: broken ? 0.18 : 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.55 }}><motion.div className="visitor-camera" animate={{ x: look.x + (view?.pan.x ?? 0) * 0.25, y: look.y + (view?.pan.y ?? 0) * 0.25, scale: look.zoom * (view?.zoom ?? 100) / 100, rotate: (view?.angle ?? 0) * 0.2 }} transition={{ type: 'spring', stiffness: 80, damping: 30 }}>{isPlan ? <PlanScene project={project} /> : <img src={isEye ? '/images/piano-view.png' : '/images/listening-room.png'} alt="The Listening Room as a visitor encounters it" draggable={false} />}</motion.div></motion.div></AnimatePresence>
      <div className="visitor-shade" />
      <div className="visitor-nav"><div><Brand light /><span className="visitor-project-name">{project.name}</span></div><div><button onClick={() => setExploreOpen(!exploreOpen)}><Compass size={16} />Explore</button><button className="visitor-icon-button" aria-label={sound ? 'Mute sound' : 'Enable sound'} onClick={() => { setSound(!sound); if (sound) muteAudio(); else primeAudio(); }}>{sound ? <Volume2 size={18} /> : <VolumeX size={18} />}</button></div></div>
      {!broken && <div className="visitor-touchpoints">{project.presentations.filter(p => p.discoverable && p.id !== currentId).map(p => {
        const focus = project.subjects.find(s => p.focusIds.includes(s.id) && s.available);
        if (!focus) return null;
        const [x, y] = subjectScreenPosition(focus, tilt);
        return <button className="visitor-touchpoint" key={p.id} style={{ left: `${x}%`, top: `${y}%` }} aria-label={`Discover ${p.title}`} onClick={() => explorePresentation(p.id)}><span /><span className="visitor-touchpoint-label">{p.title}</span></button>;
      })}</div>}
      {broken ? <div className="visitor-repair"><CameraMissing /><span className="eyebrow">AN AUTHORING ISSUE, NOT A VISITOR GUESS</span><h1>This view needs a little attention.</h1><p>The presentation still exists. Its saved View does not.<br />Choose a replacement before sharing this experience.</p><button className="primary-button" onClick={onExit}><ArrowLeft size={15} />Return and repair</button></div> : <motion.div className="visitor-story" key={currentId} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.15 }}><span className="visitor-eyebrow">{guided ? `A MOMENT ON YOUR PATH / ${String(cursor + 1).padStart(2, '0')}` : 'A MOMENT IN THE ROOM'}</span><h1>{presentation?.title || 'Make yourself at home.'}</h1>{guided && stop?.prompt && <p className="visitor-entry-prompt">{stop.prompt}</p>}{presentation && presentation.variants.length > 0 && <select className="visitor-variant" aria-label="Reading variant" value={variantId} onChange={e => setVariantId(e.target.value)}><option value="default">Original</option>{presentation.variants.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select>}<p className="visitor-body">{variant?.body ?? presentation?.body ?? 'There is no prescribed path here. Take a look around, and see what catches your attention.'}</p>{issues?.missingSubjects.length ? <p className="preview-focus-warning">This presentation has an unavailable focus. Exit Preview to repair it.</p> : null}{presentation?.interaction !== 'none' && presentation && <button className={`visitor-action ${playing ? 'playing' : ''}`} onClick={interact}>{presentation.interaction === 'note' ? <Music2 size={17} /> : detailOpen ? <Check size={16} /> : <Eye size={16} />}{presentation.interaction === 'note' ? playing ? 'A little space between the notes...' : 'Play a note' : detailOpen ? 'Detail discovered' : 'Look a little closer'}<span className="visitor-action-arrow"><ArrowRight size={15} /></span></button>}{presentation?.activity === 'phrase' && <button className="visitor-replay" onClick={() => { if (sound) playPhrase(); }}><RotateCcw size={13} />{playing ? 'The piano is playing' : 'Listen again'}</button>}<AnimatePresence>{detailOpen && <motion.p className="visitor-detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>{presentation?.detailText || 'Sometimes the smallest details tell the most interesting stories.'}</motion.p>}</AnimatePresence></motion.div>}
      {!broken && <div className="visitor-path-controls">{guided && guide && stop ? <><div className="guide-session-label"><GitBranch size={14} /><span>{guide.title}</span><small>{cursor + 1} / {guide.stops.length}</small></div><div className="guide-session-buttons"><button className="visitor-prev" aria-label="Previous guide stop" disabled={cursor === 0} onClick={() => { setCursor(cursor - 1); setCurrentId(guide.stops[cursor - 1].presentationId); }}><ChevronLeft size={18} /></button><button className="visitor-next" disabled={!gateSatisfied} onClick={next}><span>{cursor === guide.stops.length - 1 ? 'Finish & explore' : 'Continue'}{stop.continuation === 'timed' && elapsed < stop.seconds && <small>In {stop.seconds - elapsed}s, or when you are ready</small>}</span><ChevronRight size={18} /></button></div>{!gateSatisfied && <p className="visitor-gate-hint">Try the interaction to continue on this path.</p>}<button className="leave-guide" onClick={() => setGuided(false)}><Compass size={13} />Explore freely. Rejoin whenever.</button></> : <><span className="visitor-freedom-label">No wrong turns.</span>{guide?.stops.length ? <button className="resume-guide" onClick={resumeGuide}><GitBranch size={16} /><span>{interacted.size || cursor ? 'Rejoin your guide' : 'Follow the guide'}<small>{guide.title}</small></span><ArrowRight size={15} /></button> : <button className="explore-room-button" onClick={() => setExploreOpen(!exploreOpen)}><Compass size={17} />Explore the room<ArrowRight size={15} /></button>}<span className="visitor-look-hint">Drag to look around</span></>}</div>}
      <AnimatePresence>{exploreOpen && <motion.div className="visitor-explore-menu" initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}><div><span>Follow your curiosity.</span><button aria-label="Close exploration menu" onClick={() => setExploreOpen(false)}><X size={17} /></button></div>{project.presentations.filter(p => p.discoverable).map(p => <button key={p.id} onClick={() => explorePresentation(p.id)} className={p.id === currentId ? 'current' : ''}><span>{p.title}</span><ArrowRight size={15} /></button>)}{!project.presentations.some(p => p.discoverable) && <p>No presentations are exposed for exploration yet.</p>}{guide?.stops.length ? <button className="explore-guide-option" onClick={resumeGuide}><GitBranch size={15} />Rejoin the guide<Play size={13} /></button> : null}</motion.div>}</AnimatePresence>
    </div>
  </motion.div>;
}

function CameraMissing() { return <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 7h5l2-3h5l2 3h4v13H3V7Z" /><circle cx="12" cy="13" r="4" /><path d="m3 3 18 18" /></svg>; }