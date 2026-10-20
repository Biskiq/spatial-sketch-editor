// Story edits. They live in the same history as the building, but never touch it.
import type { Moment, Reveal } from '../model/types';
import { newId } from '../model/types';
import type { Op } from '../model/ops';
import type { V2 } from '../model/geom2d';

export const opRoute = (route: V2[], startY: number, resetMoments: boolean): Op => (p) => {
  p.story.route = route;
  p.story.routeStartY = startY;
  if (resetMoments) {
    // keep moments, re-spread them along the new walk
    p.story.moments.sort((a, b) => a.t - b.t);
  }
};

export const opAddMoment = (t: number, caption = ''): Op => (p) => {
  const m: Moment = { id: newId(p, 't'), t, caption, look: null, reveal: 'none', dwell: 3.5 };
  p.story.moments.push(m);
  p.story.moments.sort((a, b) => a.t - b.t);
  return { select: null };
};

export const opMoment = (id: string, patch: Partial<Moment>): Op => (p) => {
  const m = p.story.moments.find((x) => x.id === id);
  if (m) Object.assign(m, patch);
  p.story.moments.sort((a, b) => a.t - b.t);
};

export const opRemoveMoment = (id: string): Op => (p) => {
  p.story.moments = p.story.moments.filter((x) => x.id !== id);
};

export const opStoryIntro = (on: boolean): Op => (p) => {
  p.story.intro = on;
};

export const REVEALS: { id: Reveal; label: string; hint: string }[] = [
  { id: 'none', label: 'Just look', hint: 'the camera turns to what you aimed at' },
  { id: 'lift', label: 'Lift the roof', hint: 'overheads and upper floors float up so the plan reads' },
  { id: 'cut', label: 'Cut at this level', hint: 'everything above eye level is cut away' },
  { id: 'slice', label: 'Slice through', hint: 'a section opens along the line of sight' },
  { id: 'light', label: 'Light from above', hint: 'the sun stands overhead; light falls through openings' },
];
