// Soft detents for Hold gestures: click-stops that help the hand, never hard limits. Pure. The gesture owns the
// active stop and its hysteresis, so a stop holds until the pointer leaves 1.5× its capture radius.
import { ohFrame, profilePeak, sampleProfile, ohSpan, PEAK_MARGIN } from './overheadGeom';
import type { Overhead, ProfilePt } from './types';

export interface Stop {
  at: number;
  label: string;
  /** identity for hysteresis; defaults to `label:at` */
  key?: string;
}

export interface DetentResult {
  v: number;
  label?: string;
  active?: number;
}

const keyOf = (s: Stop, i: number) => s.key ?? `${s.label}@${s.at.toFixed(6)}:${i}`;

/** Merge stops that land on the same place; the first label wins so ordering stays predictable. */
export function mergeStops(stops: Stop[], tol = 1e-6): Stop[] {
  const out: Stop[] = [];
  for (const s of stops) {
    if (!Number.isFinite(s.at)) continue;
    if (out.some((k) => Math.abs(k.at - s.at) <= tol)) continue;
    out.push(s);
  }
  return out;
}

/**
 * Snap `v` to the nearest stop inside `radius` (`free` disables it). `active` is the stop index the gesture is
 * already holding: it keeps that stop until `v` leaves 1.5× the radius, then the nearest stop is chosen and
 * coincident distances resolve to the lower index.
 */
export function detent(v: number, stops: Stop[], radius: number, free = false, active?: number): DetentResult {
  if (free || radius <= 0) return { v };
  const live = mergeStops(stops);
  if (!live.length) return { v };
  if (active !== undefined && live[active] && Math.abs(v - live[active].at) <= radius * 1.5)
    return { v: live[active].at, label: live[active].label, active };
  let best = -1;
  let bd = radius;
  for (let i = 0; i < live.length; i++) {
    const d = Math.abs(v - live[i].at);
    if (d <= bd + 1e-12) {
      if (d < bd - 1e-12 || best < 0) { best = i; bd = d; }
    }
  }
  if (best < 0) return { v };
  return { v: live[best].at, label: live[best].label, active: best };
}

/** Drop stops a hard limit would never let the hand reach. */
export function reachable(stops: Stop[], lo: number, hi: number): Stop[] {
  return mergeStops(stops.filter((s) => s.at >= lo - 1e-9 && s.at <= hi + 1e-9));
}

/** Heights that give 30°, 45° and 60° on the longer side of a straight section. */
export function pitchStops(oh: Overhead): Stop[] {
  const f = ohFrame(oh);
  const pk = profilePeak(oh.profile);
  const span = ohSpan(oh);
  const runL = pk.u * span;
  const runR = (1 - pk.u) * span;
  const run = Math.max(runL, runR);
  if (run < 0.05) return [];
  return [30, 45, 60].map((deg) => ({ at: run * Math.tan((deg * Math.PI) / 180), label: `${deg}° pitch`, key: `pitch:${deg}` }));
}

/** Hip stops: gable ends, even hips for a symmetric straight gable, and ends meeting. */
export function hipStops(oh: Overhead): Stop[] {
  const f = ohFrame(oh);
  const half = (f.emax - f.emin) / 2;
  if (half < 0.2) return [];
  const pk = profilePeak(oh.profile);
  const sym = Math.abs(pk.u - 0.5) < 0.02;
  const straight = oh.profile.every((p) => p.crease);
  const out: Stop[] = [{ at: 0, label: 'gable ends', key: 'hip:0' }];
  // "even hip": each hip as long as half the roof's width, a balanced look that is not the same as the ends meeting
  const even = ohSpan(oh) / 2;
  if (sym && straight && even < half - 1e-6) out.push({ at: even, label: 'even hip', key: 'hip:even' });
  out.push({ at: half, label: 'ends meet', key: 'hip:full' });
  return reachable(out, 0, half + 1e-9);
}

export const OVERHANG_STOPS: Stop[] = [0, 0.3, 0.45, 0.6].map((at) => ({ at, label: at === 0 ? 'no overhang' : `${Math.round(at * 100)} cm overhang`, key: `oh:${at}` }));

/**
 * The fullness stop: the mean offset of a side's smooth points from its chord, in metres. Moving the shoulder back
 * by that much returns the slope to straight; a side with no smooth point has no stop (0 would be mislabelled
 * "straight" while the slope is already straight).
 */
export function straighteningStop(profile: ProfilePt[], side: 'L' | 'R', span: number): Stop[] {
  const pk = profilePeak(profile);
  const eave = profile[side === 'L' ? 0 : profile.length - 1];
  if (!eave || pk.h < 0.05) return [];
  const interior = profile.filter((p) => !p.crease && (side === 'L' ? p.u > eave.u && p.u < pk.u : p.u > pk.u && p.u < eave.u));
  if (!interior.length) return [];
  const chord = (u: number) => eave.h + ((pk.h - eave.h) * (u - eave.u)) / Math.max(pk.u - eave.u, 1e-9);
  const offs = interior.map((p) => p.h - chord(p.u));
  const mean = offs.reduce((a, b) => a + b, 0) / offs.length;
  return [{ at: mean, label: 'straight', key: `straight:${side}` }];
}

export const PEAK_MARGIN_U = PEAK_MARGIN;

/** A stable "as it was" stop, so a gesture can return to its start exactly. */
export const gestureStartStop = (v: number): Stop => ({ at: v, label: 'as it was', key: 'as-was' });

/** The sampled peak height, for readouts. */
export const sampledPeak = (oh: Overhead) => Math.max(...sampleProfile(oh.profile).map((s) => s.h));
