/**
 * V3c — the roof-local section behind Edit shape.
 *
 * This is editor-session geometry, not a second evaluator: every height comes
 * from the canonical `regionUndersideAt` / `regionFormProfile` pair in
 * `@portfolio/layout-core`, and the section only chooses where to draw the
 * profile and which joint a drag writes. A flat Region has no section; a Shed
 * has a low and a high eave; a Gable has an eave, a ridge and an eave.
 *
 * The section is perpendicular to the ridge, through the ridge's own segment
 * for a gable and through the high-eave segment for a shed, then clipped to the
 * footprint. It is a reading of the authored form, never an authored fact.
 */
import {
	normalizeRegionAzimuth,
	regionFormProfile,
	regionUndersideAt,
	type RegionFormFacts,
} from '@portfolio/layout-core/room';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { LayoutRegion } from '@portfolio/layout-core/wall';
import type { Vec3 } from '@portfolio/camera-core/camera';

import type { WallFaceFrame } from '$lib/layout/wall-face';

export type RegionSectionJointId = 'low' | 'ridge' | 'high';

export type RegionSectionJoint = {
	readonly id: RegionSectionJointId;
	readonly point: LayoutVec2;
	readonly height: number;
	readonly label: string;
};

export type RegionSection = {
	readonly form: 'shed' | 'gable';
	readonly azimuth: number;
	/** Unit plan direction uphill (the section's own direction). */
	readonly direction: LayoutVec2;
	/** Unit plan direction along the ridge/eave line. */
	readonly along: LayoutVec2;
	readonly low: RegionSectionJoint;
	readonly ridge: RegionSectionJoint | null;
	readonly high: RegionSectionJoint;
	/** The shed-only midpoint ＋, where a gable's centred ridge would sit. */
	readonly midpoint: RegionSectionJoint | null;
	readonly thickness: number;
};

type LineHit = { readonly t: number; readonly point: LayoutVec2 };

function cross(left: LayoutVec2, right: LayoutVec2): number {
	return left[0] * right[1] - left[1] * right[0];
}

/** Intersections of the infinite line `origin + t * direction` with the ring. */
function lineHits(
	points: readonly LayoutVec2[],
	origin: LayoutVec2,
	direction: LayoutVec2,
): LineHit[] {
	const hits: LineHit[] = [];
	for (let index = 0; index < points.length; index += 1) {
		const start = points[index]!;
		const end = points[(index + 1) % points.length]!;
		const edge: LayoutVec2 = [end[0] - start[0], end[1] - start[1]];
		const denominator = cross(direction, edge);
		if (Math.abs(denominator) <= 1e-12) continue;
		const relative: LayoutVec2 = [start[0] - origin[0], start[1] - origin[1]];
		const t = cross(relative, edge) / denominator;
		const s = cross(relative, direction) / denominator;
		if (s < -1e-9 || s > 1 + 1e-9) continue;
		hits.push({ t, point: [origin[0] + direction[0] * t, origin[1] + direction[1] * t] });
	}
	return hits.sort((left, right) => left.t - right.t);
}

function pointAt(origin: LayoutVec2, direction: LayoutVec2, t: number): LayoutVec2 {
	return [origin[0] + direction[0] * t, origin[1] + direction[1] * t];
}

function qOf(azimuth: number, point: LayoutVec2): number {
	return point[0] * Math.cos(azimuth) + point[1] * Math.sin(azimuth);
}

/**
 * One top or underside station on the section. The section is clipped to the
 * footprint, so an end joint is the roof edge at that section, not necessarily
 * the footprint's global eave. It still writes the global form value.
 */
function joint(
	id: RegionSectionJointId,
	label: string,
	point: LayoutVec2,
	facts: RegionFormFacts,
): RegionSectionJoint {
	return { id, label, point, height: regionUndersideAt(facts, point) };
}

/**
 * The selected overhead Region's section. A flat form, an overhead with no
 * usable projected extent (the planner's own refusal), or a section that cannot
 * be clipped returns `null`; no other geometry is invented.
 */
export function regionSectionOf(
	region: LayoutRegion,
	floorElevation: number,
): RegionSection | null {
	const form = region.form;
	if (form.kind === 'flat' || region.role !== 'overhead') return null;
	const profile = regionFormProfile(form, region.footprint.points);
	if (profile === null) return null;
	const azimuth = normalizeRegionAzimuth(form.azimuth);
	const direction: LayoutVec2 = [Math.cos(azimuth), Math.sin(azimuth)];
	const along: LayoutVec2 = [-Math.sin(azimuth), Math.cos(azimuth)];
	const facts: RegionFormFacts = {
		role: region.role,
		form,
		footprint: region.footprint.points,
		datumY: floorElevation + region.elevation,
		thickness: region.thickness,
	};
	// The ridge (gable) or high eave (shed) is a line of constant q. Find the
	// visible stretch of that line and take its midpoint as the section station.
	const qLine = form.kind === 'gable' ? profile.qRidge : profile.qMax;
	const onLine: LayoutVec2 = [direction[0] * qLine, direction[1] * qLine];
	const ridgeHits = lineHits(region.footprint.points, onLine, along);
	let anchor: LayoutVec2 | null = null;
	if (ridgeHits.length >= 2) {
		const first = ridgeHits[0]!;
		const last = ridgeHits.at(-1)!;
		anchor = [(first.point[0] + last.point[0]) / 2, (first.point[1] + last.point[1]) / 2];
	} else if (ridgeHits.length === 1) {
		anchor = ridgeHits[0]!.point;
	}
	if (anchor === null) return null;
	const spanHits = lineHits(region.footprint.points, anchor, direction);
	if (spanHits.length < 2) return null;
	const lowPoint = spanHits[0]!.point;
	const highPoint = spanHits.at(-1)!.point;
	const low = joint('low', 'Low eave', lowPoint, facts);
	const high = joint('high', 'High eave', highPoint, facts);
	if (form.kind === 'shed') {
		const qMid = (profile.qMin + profile.qMax) / 2;
		const tMid = qMid - qOf(azimuth, anchor);
		let midPoint: LayoutVec2 = [(lowPoint[0] + highPoint[0]) / 2, (lowPoint[1] + highPoint[1]) / 2];
		if (tMid >= spanHits[0]!.t && tMid <= spanHits.at(-1)!.t) {
			midPoint = pointAt(anchor, direction, tMid);
		}
		return {
			form: 'shed',
			azimuth,
			direction,
			along,
			low,
			ridge: null,
			high: { ...high, label: 'High eave' },
			midpoint: joint('ridge', 'Add ridge', midPoint, facts),
			thickness: region.thickness,
		};
	}
	const tRidge = profile.qRidge - qOf(azimuth, anchor);
	if (tRidge < spanHits[0]!.t || tRidge > spanHits.at(-1)!.t) return null;
	const ridgePoint = pointAt(anchor, direction, tRidge);
	return {
		form: 'gable',
		azimuth,
		direction,
		along,
		low: { ...low, label: 'Eave' },
		ridge: joint('ridge', 'Ridge', ridgePoint, facts),
		high: { ...high, label: 'Eave' },
		midpoint: null,
		thickness: region.thickness,
	};
}

/** The section's underside profile, in the order the geometry meets it. */
export function regionSectionProfile(section: RegionSection): RegionSectionJoint[] {
	return section.ridge === null
		? [section.low, section.high]
		: [section.low, section.ridge, section.high];
}

/** The slab's section: underside, top and the two end caps. */
export function regionSectionSegments(section: RegionSection): readonly (readonly [Vec3, Vec3])[] {
	const profile = regionSectionProfile(section);
	const underside = profile.map((entry) => [entry.point[0], entry.height, entry.point[1]] as Vec3);
	const top = profile.map(
		(entry) => [entry.point[0], entry.height + section.thickness, entry.point[1]] as Vec3,
	);
	const segments: (readonly [Vec3, Vec3])[] = [];
	for (let index = 0; index < profile.length - 1; index += 1) {
		segments.push([underside[index]!, underside[index + 1]!]);
		segments.push([top[index]!, top[index + 1]!]);
	}
	const last = profile.length - 1;
	segments.push([underside[0]!, top[0]!]);
	segments.push([underside[last]!, top[last]!]);
	return segments;
}

/**
 * A6's one `face` frame for the roof-local Section reading. Layout supplies a
 * world bounds and the look direction along the ridge; camera-core derives the
 * eye, target and lens. This is a conservative frame of the section, exactly as
 * Face this wall is for a Wall.
 */
export function regionSectionFrame(section: RegionSection): WallFaceFrame | null {
	const profile = regionSectionProfile(section);
	const points = profile.flatMap((entry) => [
		[entry.point[0], entry.height, entry.point[1]] as Vec3,
		[entry.point[0], entry.height + section.thickness, entry.point[1]] as Vec3,
	]);
	let min: Vec3 = [Infinity, Infinity, Infinity];
	let max: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (const point of points) {
		min = [Math.min(min[0], point[0]), Math.min(min[1], point[1]), Math.min(min[2], point[2])];
		max = [Math.max(max[0], point[0]), Math.max(max[1], point[1]), Math.max(max[2], point[2])];
	}
	// A face intent needs a real face. A degenerate section refuses rather than
	// asking the Camera to frame a line.
	const span = Math.hypot(max[0] - min[0], max[2] - min[2]);
	if (!(max[1] > min[1]) || !(span > 1e-9)) return null;
	const look: Vec3 = [section.along[0], 0, section.along[1]];
	return { bounds: { min, max }, look };
}

/** The section key A6's one Face reading uses for a Region. */
export function regionSectionKey(regionId: string): string {
	return `region-section:${regionId}`;
}
