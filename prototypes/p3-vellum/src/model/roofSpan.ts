// One span or wings: decided by the plan and the section, never by how many rooms were clicked or which tool drew
// the outline. A plan the wings can carry gets them; a plan that needs none (one rectangle, a convex shape) keeps one
// span; and a plan where one span would leave a cliff at an inner eave, but the wings can't carry the section, is
// refused with the reason instead of being placed as a malformed single-span roof.
import { V2, dot, fmtM } from './geom2d';
import type { Overhead } from './types';
import { ohFrame, ohH } from './overheadGeom';
import { roofWingsState } from './wings';

/** A cliff shorter than this is a drawing tolerance, not a step a person would see. */
export const CLIFF_MIN = 0.1;
/** An edge counts as running along the ridge within this angle (sin), matching the wings' 2° frame tolerance. */
const ALONG_RIDGE = Math.sin((2 * Math.PI) / 180);
/** Edges this close (as a fraction of the span) to the frame's own sides are the section's ends, not inner eaves. */
const END_U = 0.01;

export interface SpanCliff {
  /** the outline edge that stands as a cliff */
  edge: number;
  /** its height above the eave, m */
  h: number;
  at: V2;
}

/**
 * Where a single-span extruded roof stops in mid-air: an outline edge running along the ridge, strictly inside the
 * span, over which the section still stands above its eave. That is the L-plan failure (the inner corner of an L
 * covered as one span).
 *
 * Deliberately not a cliff: a shed's high eave and a gable's end triangle. Both sit on the frame's own sides (u = 0 or
 * 1, or an edge across the ridge), so an intentional slope is never reported. Wing roofs, domes and revolves are never
 * single-span extrusions and return null.
 */
export function spanCliff(oh: Overhead): SpanCliff | null {
  if (oh.form !== 'extrude' || roofWingsState(oh).kind !== 'single') return null;
  const f = ohFrame(oh);
  const span = f.wmax - f.wmin;
  if (span < 1e-6) return null;
  let worst: SpanCliff | null = null;
  const n = oh.outline.length;
  for (let i = 0; i < n; i++) {
    const a = oh.outline[i], b = oh.outline[(i + 1) % n];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    const t: V2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L];
    if (Math.abs(dot(t, f.d)) > ALONG_RIDGE) continue; // crosses the ridge: an end, never a cliff
    const mid: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const u = (dot(mid, f.d) - f.wmin) / span;
    if (u < END_U || u > 1 - END_U) continue; // the section's own side: an eave, high or low as authored
    const h = ohH(oh, mid);
    if (h > CLIFF_MIN && (!worst || h > worst.h)) worst = { edge: i, h, at: mid };
  }
  return worst;
}

export interface SpanChoice {
  /** the field to store: false = wings, undefined = one span */
  oneSpan: false | undefined;
  ok: boolean;
  /** why it was refused, said plainly; empty when ok */
  reason: string;
}

/**
 * The span a new or re-covered roof should have. One answer for every route that makes a roof — the cover chips,
 * their preview and commit, and the pen's roof readings — so an L covered as one room and an L covered as two rooms
 * are the same roof.
 */
export function chooseSpan(oh: Overhead): SpanChoice {
  if (oh.form !== 'extrude') return { oneSpan: undefined, ok: true, reason: '' };
  const wings = roofWingsState({ ...oh, oneSpan: false });
  if (wings.kind === 'compound') return { oneSpan: false, ok: true, reason: '' };
  const cliff = spanCliff({ ...oh, oneSpan: undefined });
  if (!cliff) return { oneSpan: undefined, ok: true, reason: '' };
  const why = wings.kind === 'unsupported' ? wings.reason : 'the plan has no wings to divide';
  return {
    oneSpan: undefined,
    ok: false,
    reason: `as one span it would stop ${fmtM(cliff.h)} up at an inner eave, and its wings can't carry it (${why})`,
  };
}
