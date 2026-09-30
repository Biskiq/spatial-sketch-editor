import { useState } from 'react';
import { ArrowDownAZ, ArrowLeft, ArrowRight, ChevronDown, Compass, GitBranch, Plus, Repeat2, Search, Settings2, TriangleAlert } from 'lucide-react';
import { getIssues, type Lens, type Project } from '../model';
import SubjectIcon from './SubjectIcon';

interface Props {
  project: Project;
  lens: Lens;
  selectionIds: string[];
  activePresentationId: string | null;
  activeStopId: string | null;
  showGuide: boolean;
  onShowGuide: (show: boolean) => void;
  onSelectSubject: (id: string) => void;
  onSelectPresentation: (id: string) => void;
  onSelectStop: (id: string) => void;
  onNewPresentation: () => void;
  onNewSubject: () => void;
  onCreateGuide: () => void;
  onAddStop: () => void;
  onGuideSettings: () => void;
  onSearch: () => void;
  onVisitorSettings: () => void;
}

export default function ProjectIndex({ project, lens, selectionIds, activePresentationId, activeStopId, showGuide, onShowGuide, onSelectSubject, onSelectPresentation, onSelectStop, onNewPresentation, onNewSubject, onCreateGuide, onAddStop, onGuideSettings, onSearch, onVisitorSettings }: Props) {
  const [alphabetical, setAlphabetical] = useState(false);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const issueCount = project.presentations.filter(p => getIssues(project, p).any).length;
  const presentations = [...project.presentations].filter(p => !attentionOnly || getIssues(project, p).any).sort((a, b) => alphabetical ? a.title.localeCompare(b.title) : 0);
  return <aside className="project-index" aria-label={lens === 'world' ? 'World index' : 'Experience index'}>
    <div className="index-heading"><h2>{lens === 'world' ? 'In this room' : showGuide && project.guide ? 'Your guide' : 'Presentations'}<span>{lens === 'world' ? project.subjects.filter(s => s.available).length : showGuide && project.guide ? project.guide.stops.length : project.presentations.length}</span></h2><button className="icon-button" title="Search the project" aria-label="Search the project" onClick={onSearch}><Search size={16} /></button></div>
    <div className="index-scroll">
      {lens === 'world' ? <>
        <div className="index-scope"><button onClick={() => onSelectSubject('room')}><span className="scope-dot" />Listening room<ChevronDown size={12} /></button></div>
        {(['Architecture', 'Objects'] as const).map(group => <div className="world-group" key={group}><div className="index-group-label">{group}</div>{project.subjects.filter(subject => subject.available && (group === 'Architecture' ? ['architecture', 'window'].includes(subject.kind) : !['architecture', 'window'].includes(subject.kind))).map(subject => <button key={subject.id} className={`world-index-row ${selectionIds.includes(subject.id) ? 'selected' : ''}`} onClick={() => onSelectSubject(subject.id)}><SubjectIcon kind={subject.kind} /><span>{subject.name}</span></button>)}</div>)}
        <button className="index-add" onClick={onNewSubject}><Plus size={15} />Add to World</button>
        <p className="index-hint">Build the place.<br />Then decide what matters.</p>
      </> : showGuide && project.guide ? <>
        <button className="index-back" onClick={() => onShowGuide(false)}><ArrowLeft size={13} />All presentations</button>
        <div className="guide-title"><GitBranch size={17} /><h3>{project.guide.title}</h3><button className="icon-button" title="Guide settings" aria-label="Guide settings" onClick={onGuideSettings}><Settings2 size={14} /></button></div>
        <p className="guide-intro">A path, not the whole experience.</p>
        <div className="guide-stop-list">{project.guide.stops.map((stop, index) => {
          const presentation = project.presentations.find(p => p.id === stop.presentationId);
          const reused = project.guide!.stops.filter(s => s.presentationId === stop.presentationId).length > 1;
          return <button key={stop.id} className={`guide-index-row ${activeStopId === stop.id ? 'selected' : ''}`} onClick={() => onSelectStop(stop.id)}><span className="stop-number">{String(index + 1).padStart(2, '0')}</span><span className="index-row-copy"><strong>{presentation?.title ?? 'Unavailable presentation'}</strong><small>{stop.prompt || (stop.entryViewId ? 'Custom entry view' : 'Presentation view')}</small></span>{reused && <Repeat2 size={13} className="reuse-icon" />}</button>;
        })}</div>
        {!project.guide.stops.length && <p className="index-empty">Add a presentation to begin. Each stop is one moment along the way.</p>}
        <button className="index-add" onClick={onAddStop}><Plus size={15} />Add a stop</button>
        <button className="guide-settings-link" onClick={onGuideSettings}><Settings2 size={13} />Continuation & rejoining</button>
      </> : <>
        <div className="index-subline"><span>Meaning, made discoverable.</span><button className={`icon-button ${alphabetical ? 'active' : ''}`} title={alphabetical ? 'Use creation order' : 'Sort alphabetically'} aria-label="Toggle alphabetical sorting" onClick={() => setAlphabetical(!alphabetical)}><ArrowDownAZ size={14} /></button></div>
        {issueCount > 0 && <button className={`attention-filter ${attentionOnly ? 'active' : ''}`} onClick={() => setAttentionOnly(!attentionOnly)}><TriangleAlert size={13} />{issueCount} {issueCount === 1 ? 'needs' : 'need'} attention<span>{attentionOnly ? 'Show all' : 'Review'}</span></button>}
        <div className="presentation-index-list">{presentations.map(presentation => {
          const index = project.presentations.findIndex(p => p.id === presentation.id);
          const subjects = project.subjects.filter(s => presentation.focusIds.includes(s.id));
          const issue = getIssues(project, presentation).any;
          return <button key={presentation.id} className={`presentation-index-row ${activePresentationId === presentation.id ? 'selected' : ''}`} onClick={() => onSelectPresentation(presentation.id)}><span className="index-number">{String(index + 1).padStart(2, '0')}</span><span className="index-row-copy"><strong>{presentation.title || 'Untitled presentation'}</strong><small>{subjects.length > 1 ? `${subjects.length} subjects` : subjects[0]?.name ?? 'A story of its own'}</small></span>{issue && <TriangleAlert size={13} className="issue-icon" />}</button>;
        })}</div>
        {attentionOnly && presentations.length === 0 && <p className="index-empty">Everything is connected. No repairs needed.</p>}
        <button className="index-add" onClick={onNewPresentation}><Plus size={15} />New presentation</button>
        <div className="optional-guide"><div className="index-group-label"><GitBranch size={13} />Guide<span>OPTIONAL</span></div>{project.guide ? <button className="open-guide" onClick={() => onShowGuide(true)}><span>{project.guide.title}<small>{project.guide.stops.length} {project.guide.stops.length === 1 ? 'stop' : 'stops'}</small></span><ArrowRight size={15} /></button> : <><button className="create-guide" onClick={onCreateGuide}><Plus size={14} />Create a guide</button><p>A little direction, when<br />your visitors need it.</p></>}</div>
      </>}
    </div>
    <button className="visitor-settings-link" onClick={onVisitorSettings}><span className="compass-disc"><Compass size={17} /></span><span><strong>{project.guide ? 'Explore + follow a guide' : 'Free exploration'}</strong><small>The visitor is free to wander</small></span><Settings2 size={13} /></button>
  </aside>;
}