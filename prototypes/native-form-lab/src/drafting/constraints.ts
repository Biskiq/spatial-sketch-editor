import type { Frame, Vec3 } from '../model/types';

export type AxisLock = 'none' | 'x' | 'y' | 'z' | 'u' | 'v';
export type AxisConstraintMode = 'plane' | 'space';

export const AXIS_TANGENT_EPSILON = 1e-6;

function normalize(value: Vec3): Vec3 | null {
  const length = Math.hypot(value[0], value[1], value[2]);
  if (!Number.isFinite(length) || length < 1e-12) return null;
  return [value[0] / length, value[1] / length, value[2] / length];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function axisDirection(frame: Frame, lock: AxisLock): Vec3 | null {
  if (lock === 'none') return null;
  const direction: Vec3 = lock === 'x'
    ? [1, 0, 0]
    : lock === 'y'
      ? [0, 1, 0]
      : lock === 'z'
        ? [0, 0, 1]
        : lock === 'u'
          ? frame.u
          : frame.v;
  return normalize(direction);
}

export function isAxisLockCompatible(frame: Frame, lock: AxisLock, mode: AxisConstraintMode = 'plane'): boolean {
  if (lock === 'none') return true;
  const direction = axisDirection(frame, lock);
  if (!direction) return false;
  if (mode === 'space') return true;
  const normal = normalize(frame.normal);
  return normal !== null && Math.abs(dot(direction, normal)) <= AXIS_TANGENT_EPSILON;
}

export function constrainWorldPointToAxis(
  frame: Frame,
  start: Vec3,
  candidate: Vec3,
  lock: AxisLock,
  mode: AxisConstraintMode = 'plane',
  snapStep?: number,
): { compatible: boolean; point: Vec3 | null } {
  if (lock === 'none') return { compatible: true, point: [...candidate] };
  if (!isAxisLockCompatible(frame, lock, mode)) return { compatible: false, point: null };
  const direction = axisDirection(frame, lock);
  if (!direction) return { compatible: false, point: null };
  const offset: Vec3 = [candidate[0] - start[0], candidate[1] - start[1], candidate[2] - start[2]];
  let distance = dot(offset, direction);
  if (snapStep !== undefined && Number.isFinite(snapStep) && snapStep > 0) {
    distance = Math.round(distance / snapStep) * snapStep;
  }
  return {
    compatible: true,
    point: [
      start[0] + direction[0] * distance,
      start[1] + direction[1] * distance,
      start[2] + direction[2] * distance,
    ],
  };
}
