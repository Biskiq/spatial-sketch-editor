import { SPEED_RATES, definition, solveView, type Document, type Speed, type Vec3 } from './model';
export type CameraPose = { position: Vec3; target: Vec3 };
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** One movement duration used by both runtime playback and presentation estimates. Cut is instantaneous. */
export function travelSeconds(from: CameraPose, to: CameraPose, speed: Speed): number { const rate = SPEED_RATES[speed]; return rate <= 0 ? 0 : Math.max(distance(from.position, to.position), distance(from.target, to.target)) / rate; }
export function viewPose(d: Document, useId: string | null): CameraPose | null { const def = definition(d, useId); return def?.kind === 'view' ? solveView(d, def) : null; }
export function lerpPose(from: CameraPose, to: CameraPose, t: number): CameraPose { const mix = (a: Vec3, b: Vec3) => a.map((n, i) => n + (b[i] - n) * t) as Vec3; return { position: mix(from.position, to.position), target: mix(from.target, to.target) }; }
export const smoothstep = (t: number) => t * t * (3 - 2 * t);
