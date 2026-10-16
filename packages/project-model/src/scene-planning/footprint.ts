import { orientXZ, type LayoutVec2 } from '@portfolio/layout-core';

/** Exact finite simple-polygon admission; no compiler tolerance is changed. */
export function isSimplePlacementFootprint(points: readonly LayoutVec2[]): boolean {
	if (points.length < 3) return false;
	let area = 0;
	const origin = points[0]!;
	for (let i = 0; i < points.length; i++) {
		const a = points[i]!;
		const b = points[(i + 1) % points.length]!;
		if (a[0] === b[0] && a[1] === b[1]) return false;
		area += (a[0] - origin[0]) * (b[1] - origin[1]) - (a[1] - origin[1]) * (b[0] - origin[0]);
		const previous = points[(i + points.length - 1) % points.length]!;
		// Adjacent collinear edges may continue straight, but cannot double back.
		if (orientXZ(previous, a, b) === 0 &&
			(a[0] - previous[0]) * (b[0] - a[0]) + (a[1] - previous[1]) * (b[1] - a[1]) <= 0) return false;
		for (let j = i + 1; j < points.length; j++) {
			if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
			const c = points[j]!;
			const d = points[(j + 1) % points.length]!;
			const abC = orientXZ(a, b, c), abD = orientXZ(a, b, d);
			const cdA = orientXZ(c, d, a), cdB = orientXZ(c, d, b);
			if ((abC === 0 && onSegment(c, a, b)) || (abD === 0 && onSegment(d, a, b)) ||
				(cdA === 0 && onSegment(a, c, d)) || (cdB === 0 && onSegment(b, c, d)) ||
				(Math.sign(abC) * Math.sign(abD) < 0 && Math.sign(cdA) * Math.sign(cdB) < 0)) return false;
		}
	}
	return Number.isFinite(area) && area !== 0;
}

function onSegment(point: LayoutVec2, start: LayoutVec2, end: LayoutVec2): boolean {
	return point[0] >= Math.min(start[0], end[0]) && point[0] <= Math.max(start[0], end[0]) &&
		point[1] >= Math.min(start[1], end[1]) && point[1] <= Math.max(start[1], end[1]);
}
