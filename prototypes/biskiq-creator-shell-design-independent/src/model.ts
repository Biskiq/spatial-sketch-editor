export type Lens = 'world' | 'experience';
export type SubjectKind = 'piano' | 'bench' | 'plant' | 'artwork' | 'window' | 'architecture' | 'plinth';
export type Vector3 = [number, number, number];

export interface WorldSubject {
  id: string;
  name: string;
  kind: SubjectKind;
  position: Vector3;
  dimensions: Vector3;
  rotation: number;
  material: string;
  available: boolean;
  spatialRevision: number;
}

export interface Inspection {
  tilt: number;
  zoom: number;
  pan: { x: number; y: number };
  angle: number;
  projection: 'perspective' | 'orthographic';
}

export interface CameraView extends Inspection {
  id: string;
  name: string;
  focusIds: string[];
  motion: 'still' | 'arc' | 'approach';
  duration: number;
  subjectRevisions: Record<string, number>;
}

export interface ContentVariant {
  id: string;
  label: string;
  body: string;
}

export interface Presentation {
  id: string;
  title: string;
  body: string;
  focusIds: string[];
  viewId: string | null;
  discoverable: boolean;
  interaction: 'none' | 'note' | 'detail';
  detailText: string;
  activity: 'none' | 'phrase' | 'highlight';
  variants: ContentVariant[];
}

export interface GuideStop {
  id: string;
  presentationId: string;
  entryViewId: string | null;
  prompt: string;
  continuation: 'manual' | 'activity' | 'timed';
  seconds: number;
  gate: 'none' | 'interaction';
}

export interface Guide {
  id: string;
  title: string;
  stops: GuideStop[];
  rejoin: 'resume' | 'next';
}

export interface Project {
  name: string;
  subjects: WorldSubject[];
  presentations: Presentation[];
  views: CameraView[];
  guide: Guide | null;
}

export const initialInspection: Inspection = {
  tilt: 62,
  zoom: 100,
  pan: { x: 0, y: 0 },
  angle: 0,
  projection: 'perspective',
};

export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export const initialProject: Project = {
  name: 'The Listening Room',
  subjects: [
    { id: 'room', name: 'Listening room', kind: 'architecture', position: [4, 3, 0], dimensions: [8, 6, 3.6], rotation: 0, material: 'Limestone', available: true, spatialRevision: 0 },
    { id: 'piano', name: 'Grand piano', kind: 'piano', position: [3, 3.1, 0], dimensions: [1.55, 2.27, 1.02], rotation: 32, material: 'Black lacquer', available: true, spatialRevision: 0 },
    { id: 'bench', name: 'Oak bench', kind: 'bench', position: [5.9, 1.9, 0], dimensions: [2.2, 0.6, 0.46], rotation: 0, material: 'Natural oak', available: true, spatialRevision: 0 },
    { id: 'plant', name: 'Olive tree', kind: 'plant', position: [4.1, 5.3, 0], dimensions: [0.8, 0.8, 2.1], rotation: 0, material: 'Terracotta', available: true, spatialRevision: 0 },
    { id: 'art-1', name: 'Study in earth', kind: 'artwork', position: [0.1, 3.6, 1.4], dimensions: [0.05, 1, 1.2], rotation: 0, material: 'Framed print', available: true, spatialRevision: 0 },
    { id: 'art-2', name: 'Study in shadow', kind: 'artwork', position: [0.1, 5, 1.4], dimensions: [0.05, 1, 1.2], rotation: 0, material: 'Framed print', available: true, spatialRevision: 0 },
    { id: 'windows', name: 'Gallery windows', kind: 'window', position: [7.9, 4.5, 1.2], dimensions: [0.2, 3.5, 2.1], rotation: 0, material: 'Clear glass', available: true, spatialRevision: 0 },
  ],
  views: [
    { id: 'view-piano', name: 'Piano, three-quarter', focusIds: ['piano'], tilt: 92, zoom: 100, pan: { x: 0, y: 0 }, angle: 0, projection: 'perspective', motion: 'still', duration: 6, subjectRevisions: { piano: 0 } },
    { id: 'view-bench', name: 'A little breathing room', focusIds: ['bench'], tilt: 62, zoom: 105, pan: { x: -40, y: -35 }, angle: 0, projection: 'orthographic', motion: 'still', duration: 6, subjectRevisions: { bench: 0 } },
    { id: 'view-light', name: 'Light across the room', focusIds: ['windows'], tilt: 92, zoom: 110, pan: { x: -35, y: 10 }, angle: -4, projection: 'perspective', motion: 'still', duration: 8, subjectRevisions: { windows: 0 } },
  ],
  presentations: [
    { id: 'story-piano', title: 'The grand piano', body: 'At the heart of this room is a piano. An invitation to slow down, listen, and find a little space between the notes.', focusIds: ['piano'], viewId: 'view-piano', discoverable: true, interaction: 'note', detailText: '', activity: 'none', variants: [] },
    { id: 'story-bench', title: 'A place to pause', body: 'Not every moment needs a destination. Take a seat, watch the light move, and let the room come to you.', focusIds: ['bench'], viewId: 'view-bench', discoverable: true, interaction: 'detail', detailText: 'The bench is made from solid oak. Its grain is left visible, a quiet reminder of the material it came from.', activity: 'none', variants: [] },
    { id: 'story-light', title: 'Following the light', body: 'The windows turn the passing hours into something you can see. Each visit finds the room a little different.', focusIds: ['windows'], viewId: 'view-light', discoverable: true, interaction: 'none', detailText: '', activity: 'none', variants: [] },
  ],
  guide: null,
};

export function getIssues(project: Project, presentation: Presentation) {
  const missingSubjects = presentation.focusIds.filter(id => !project.subjects.some(s => s.id === id && s.available));
  const view = project.views.find(v => v.id === presentation.viewId);
  const missingView = Boolean(presentation.viewId && !view);
  const changedFocus = Boolean(view && presentation.focusIds.some(id => {
    const subject = project.subjects.find(s => s.id === id);
    return subject && view.subjectRevisions[id] !== undefined && subject.spatialRevision !== view.subjectRevisions[id];
  }));
  return { missingSubjects, missingView, changedFocus, any: missingSubjects.length > 0 || missingView || changedFocus };
}

export function viewUsage(project: Project, viewId: string) {
  return project.presentations.filter(p => p.viewId === viewId).length + (project.guide?.stops.filter(s => s.entryViewId === viewId).length ?? 0);
}

export function captureView(project: Project, inspection: Inspection, focusIds: string[], name: string): CameraView {
  return {
    ...inspection,
    pan: { ...inspection.pan },
    id: uid('view'),
    name,
    focusIds: [...focusIds],
    motion: 'still',
    duration: 6,
    subjectRevisions: Object.fromEntries(project.subjects.filter(s => focusIds.includes(s.id)).map(s => [s.id, s.spatialRevision])),
  };
}

export function toInspection(view: CameraView): Inspection {
  return { tilt: view.tilt, zoom: view.zoom, pan: { ...view.pan }, angle: view.angle, projection: view.projection };
}

export const subjectType: Record<SubjectKind, string> = {
  piano: 'Instrument', bench: 'Furniture', plant: 'Plant', artwork: 'Artwork', window: 'Architecture', architecture: 'Space', plinth: 'Geometry',
};