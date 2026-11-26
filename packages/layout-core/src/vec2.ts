import { LAYOUT_GEOMETRY_EPSILON } from './geometry/openings';
import type { LayoutVec2 } from './geometry/coordinates';

export const POINT_EPSILON = LAYOUT_GEOMETRY_EPSILON;

export function distance(a: LayoutVec2, b: LayoutVec2): number {
	return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function subtract(a: LayoutVec2, b: LayoutVec2): LayoutVec2 {
	return [a[0] - b[0], a[1] - b[1]];
}

export function add(a: LayoutVec2, b: LayoutVec2): LayoutVec2 {
	return [a[0] + b[0], a[1] + b[1]];
}

export function scale(a: LayoutVec2, factor: number): LayoutVec2 {
	return [a[0] * factor, a[1] * factor];
}

export function normalize(a: LayoutVec2): LayoutVec2 | undefined {
	const length = Math.hypot(a[0], a[1]);
	return length > POINT_EPSILON ? [a[0] / length, a[1] / length] : undefined;
}

export function dot(a: LayoutVec2, b: LayoutVec2): number {
	return a[0] * b[0] + a[1] * b[1];
}

export function vectorEqual(a: readonly number[], b: readonly number[]): boolean {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}
