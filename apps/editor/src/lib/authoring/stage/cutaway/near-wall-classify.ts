/**
 * X2 — which Walls stand between the eye and the Space it is inspecting.
 *
 * Pure arithmetic over plain numbers and compiled Layout facts: no Three, no
 * Svelte, no session. The classifier is the **only** place a near Wall is decided,
 * so the material twin set, the caps, the pick clamp and the diagnostics all read
 * one answer. It deliberately submits no viewing intent and writes no document:
 * Camera supplies the eye and target, Layout supplies the geometry, and the session
 * store owns the switch, the hold and the decision memory.
 *
 * Two memories make the decision stable at rest, and both are inputs rather than
 * hidden state:
 *
 * - **Space hysteresis** (`SPACE_SWITCH_INSET`): orbiting across a shared Room
 *   boundary keeps the previous Space until the target is clearly inside a
 *   different one.
 * - **Wall hysteresis** (`CUT_THRESHOLD` / `WHOLE_THRESHOLD`): a sight margin
 *   that hovers near a Wall top keeps its previous state instead of flickering.
 *
 * The margin `m_w` is the largest vertical clearance of the Wall's top over the
 * sight lines from the eye to the inspected Space's interior samples: positive
 * when the Wall blocks, negative when the sight line passes above it. A Wall that
 * no sight line crosses has no margin (`-Infinity`) and is never cut.
 */
import {
	pointInPolygon,
	type CompiledPhysicalWall,
	type CompiledRoom,
	type LayoutVec2,
} from '@portfolio/layout-core/geometry';

/** The stub height above the inspected Space's floor. One height for every cut Wall. */
export const STUB_HEIGHT_METERS = 1.0;

/** A Wall whose solid top is this close to the stub top has nothing to remove. */
export const STUB_NOTHING_TO_REMOVE_METERS = 0.05;

/** How far the target must be inside a different Space before the Space switches. */
export const SPACE_SWITCH_INSET = 0.25;

/** Interior samples: moved this far toward the floor centroid, at this height. */
export const SAMPLE_INSET_METERS = 0.3;
export const SAMPLE_HEIGHT_METERS = 1.2;

/** The most sight segments a classification may use, per the plan's cost bound. */
export const MAX_SIGHT_SAMPLES = 32;

/** The margin at which a Wall becomes cut (and, negative, whole). */
export const CUT_MARGIN_METERS = 0.15;
export const WHOLE_MARGIN_METERS = -0.05;

/** A Wall must be this far inside the Space, past its own half thickness, to be interior. */
export const INTERIOR_CONTENT_CLEARANCE_METERS = 0.01;

export type NearWallSpace = {
	readonly roomId: string;
	readonly floorPolygon: readonly LayoutVec2[];
	readonly floorElevation: number;
	readonly ceilingElevation: number;
};

export type NearWallWall = {
	readonly wallId: string;
	readonly floorElevation: number;
	readonly bottomY: number;
	readonly topY: number;
	readonly thickness: number;
	readonly centerlinePolylines: readonly (readonly LayoutVec2[])[];
};

export type InspectedSpaceInput = {
	readonly eye: readonly [number, number, number];
	readonly target: readonly [number, number, number];
	readonly rooms: readonly CompiledRoom[];
	/** The previous Space, for the shared-boundary hysteresis. */
	readonly previousRoomId: string | null;
};

export type NearWallClassifyInput = {
	readonly eye: readonly [number, number, number];
	readonly target: readonly [number, number, number];
	readonly rooms: readonly CompiledRoom[];
	readonly walls: readonly CompiledPhysicalWall[];
	readonly floors: readonly { readonly floorId: string; readonly elevation: number }[];
	readonly previousSpaceId: string | null;
	/** The previous cut set, so the margin hysteresis has a state to keep. */
	readonly previousCut: ReadonlySet<string>;
};

export type NearWallClassification = {
	/** The inspected Space, or null when nothing is inspected. */
	readonly spaceId: string | null;
	/** The horizontal cap height, or null when nothing is cut. */
	readonly stubTopY: number | null;
	readonly cut: ReadonlySet<string>;
};

function polygonArea(polygon: readonly LayoutVec2[]): number {
	let twice = 0;
	for (let index = 0; index < polygon.length; index += 1) {
		const a = polygon[index]!;
		const b = polygon[(index + 1) % polygon.length]!;
		twice += a[0] * b[1] - a[1] * b[0];
	}
	return Math.abs(twice) / 2;
}

/** Distance from a point to a segment, in plan metres. */
function distanceToSegment(point: LayoutVec2, a: LayoutVec2, b: LayoutVec2): number {
	const dx = b[0] - a[0];
	const dz = b[1] - a[1];
	const squared = dx * dx + dz * dz;
	if (!(squared > 0)) return Math.hypot(point[0] - a[0], point[1] - a[1]);
	const raw = ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / squared;
	const amount = Math.min(1, Math.max(0, raw));
	return Math.hypot(point[0] - (a[0] + dx * amount), point[1] - (a[1] + dz * amount));
}

/**
 * Signed distance to a polygon's boundary: positive inside, negative outside.
 *
 * It is the switch rule's only geometric primitive, so it is written once and
 * tested directly rather than being re-derived at each caller.
 */
export function insetDistance(point: LayoutVec2, polygon: readonly LayoutVec2[]): number {
	if (polygon.length < 3) return Number.NEGATIVE_INFINITY;
	let nearest = Infinity;
	for (let index = 0; index < polygon.length; index += 1) {
		nearest = Math.min(
			nearest,
			distanceToSegment(point, polygon[index]!, polygon[(index + 1) % polygon.length]!),
		);
	}
	return pointInPolygon(point, polygon) ? nearest : -nearest;
}

/** The floor centroid; the first interior sample, and the inset target. */
export function floorCentroid(polygon: readonly LayoutVec2[]): LayoutVec2 {
	if (polygon.length === 0) return [0, 0];
	let x = 0;
	let z = 0;
	for (const point of polygon) {
		x += point[0];
		z += point[1];
	}
	return [x / polygon.length, z / polygon.length];
}

/** The smallest-area Room, with the smallest id breaking a tie. */
function innermostRoom(rooms: readonly CompiledRoom[]): CompiledRoom | null {
	let best: CompiledRoom | null = null;
	let bestArea = Infinity;
	for (const room of rooms) {
		const area = polygonArea(room.floorPolygon);
		if (
			area < bestArea - 1e-9 ||
			(Math.abs(area - bestArea) <= 1e-9 && best !== null && room.roomId < best.roomId)
		) {
			best = room;
			bestArea = area;
		}
	}
	return best;
}

/**
 * The inspected Space (§3.1).
 *
 * An occupied Room wins — the creator is standing in it. Otherwise the Room the
 * orbit target sits in is what they are inspecting, with a 25 cm inset before the
 * Space switches and the previous Space kept while the target is near a shared
 * boundary. No Room means nothing is inspected and nothing is cut.
 */
export function inspectedSpace(input: InspectedSpaceInput): CompiledRoom | null {
	const { eye, target, rooms } = input;
	const eyeXZ: LayoutVec2 = [eye[0], eye[2]];
	const targetXZ: LayoutVec2 = [target[0], target[2]];
	const occupied = rooms.filter(
		(room) =>
			room.floorElevation <= eye[1] &&
			eye[1] <= room.ceilingElevation &&
			pointInPolygon(eyeXZ, room.floorPolygon),
	);
	if (occupied.length > 0) return innermostRoom(occupied);

	const containing = rooms.filter(
		(room) =>
			room.floorElevation - 0.05 <= target[1] &&
			target[1] <= room.ceilingElevation + 0.05 &&
			pointInPolygon(targetXZ, room.floorPolygon),
	);
	const candidate = innermostRoom(containing);
	const previous =
		input.previousRoomId === null
			? null
			: (rooms.find((room) => room.roomId === input.previousRoomId) ?? null);
	if (previous === null) return candidate;
	if (candidate === null) {
		// Outside every Room: keep the previous Space until the target is clearly out.
		return insetDistance(targetXZ, previous.floorPolygon) <= -SPACE_SWITCH_INSET ? null : previous;
	}
	if (candidate.roomId === previous.roomId) return previous;
	// A different Room only wins once the target is clearly inside it.
	return insetDistance(targetXZ, candidate.floorPolygon) >= SPACE_SWITCH_INSET
		? candidate
		: previous;
}

/** The inspected Space's interior sight samples (§3.2). */
export function sightSamples(
	space: Pick<CompiledRoom, 'floorPolygon' | 'floorElevation'>,
): readonly [number, number, number][] {
	const centroid = floorCentroid(space.floorPolygon);
	// The vertex mean is not guaranteed to be inside a concave Space. Only use it
	// when it is; otherwise the inset vertex samples must supply the interior. With
	// none, the plan's no-valid-sample rule applies: no samples, so nothing is cut.
	const candidates: LayoutVec2[] = pointInPolygon(centroid, space.floorPolygon) ? [centroid] : [];
	for (const vertex of space.floorPolygon) {
		const dx = centroid[0] - vertex[0];
		const dz = centroid[1] - vertex[1];
		const length = Math.hypot(dx, dz);
		if (!(length > SAMPLE_INSET_METERS)) continue;
		const moved: LayoutVec2 = [
			vertex[0] + (dx / length) * SAMPLE_INSET_METERS,
			vertex[1] + (dz / length) * SAMPLE_INSET_METERS,
		];
		// Kept only if the inset sample is still inside; a very narrow Space keeps
		// fewer samples rather than inventing points outside it.
		if (pointInPolygon(moved, space.floorPolygon)) candidates.push(moved);
	}
	if (candidates.length === 0) return [];
	const stride = Math.max(1, Math.ceil(candidates.length / MAX_SIGHT_SAMPLES));
	const kept: [number, number, number][] = [];
	for (let index = 0; index < candidates.length; index += stride) {
		const point = candidates[index]!;
		kept.push([point[0], space.floorElevation + SAMPLE_HEIGHT_METERS, point[1]]);
	}
	return kept;
}

/** The wall's plan band as convex quads, one per centreline chord. */
function wallBandQuads(wall: NearWallWall): readonly (readonly LayoutVec2[])[] {
	const half = wall.thickness / 2;
	const quads: LayoutVec2[][] = [];
	for (const polyline of wall.centerlinePolylines) {
		for (let index = 0; index + 1 < polyline.length; index += 1) {
			const a = polyline[index]!;
			const b = polyline[index + 1]!;
			const dx = b[0] - a[0];
			const dz = b[1] - a[1];
			const length = Math.hypot(dx, dz);
			if (!(length > 1e-9) || !(half > 0)) continue;
			const nx = -dz / length;
			const nz = dx / length;
			quads.push([
				[a[0] + nx * half, a[1] + nz * half],
				[b[0] + nx * half, b[1] + nz * half],
				[b[0] - nx * half, b[1] - nz * half],
				[a[0] - nx * half, a[1] - nz * half],
			]);
		}
	}
	return quads;
}

/**
 * The parameter interval in which the plan segment `p0 → p1` is inside the convex
 * quad, or null. Both end caps are part of the quad, so a sight line that starts
 * inside a Wall is found exactly like one that enters it.
 */
function segmentQuadInterval(
	p0: LayoutVec2,
	p1: LayoutVec2,
	quad: readonly LayoutVec2[],
): readonly [number, number] | null {
	// The quad is built counter-clockwise; accept either winding by orienting on
	// its own signed area once.
	let area = 0;
	for (let index = 0; index < quad.length; index += 1) {
		const a = quad[index]!;
		const b = quad[(index + 1) % quad.length]!;
		area += a[0] * b[1] - a[1] * b[0];
	}
	const ring = area >= 0 ? quad : [...quad].reverse();
	let lo = 0;
	let hi = 1;
	const dx = p1[0] - p0[0];
	const dz = p1[1] - p0[1];
	for (let index = 0; index < ring.length; index += 1) {
		const a = ring[index]!;
		const b = ring[(index + 1) % ring.length]!;
		// Inside is to the left of a → b: cross(b - a, p - a) >= 0.
		const ex = b[0] - a[0];
		const ez = b[1] - a[1];
		const f0 = ex * (p0[1] - a[1]) - ez * (p0[0] - a[0]);
		const slope = ex * dz - ez * dx;
		if (Math.abs(slope) <= 1e-15) {
			if (f0 < -1e-12) return null;
			continue;
		}
		const t = -f0 / slope;
		if (slope > 0) {
			if (t > lo) lo = t;
		} else if (t < hi) {
			hi = t;
		}
		if (lo > hi) return null;
	}
	return [lo, hi];
}

/**
 * The largest top clearance of `wall` over the sight lines to `samples`, or
 * `-Infinity` when no sight line crosses its footprint (§3.2).
 */
export function obstructionMargin(
	eye: readonly [number, number, number],
	samples: readonly (readonly [number, number, number])[],
	wall: NearWallWall,
): number {
	const eyeXZ: LayoutVec2 = [eye[0], eye[2]];
	const quads = wallBandQuads(wall);
	let margin = Number.NEGATIVE_INFINITY;
	for (const sample of samples) {
		const sampleXZ: LayoutVec2 = [sample[0], sample[2]];
		let entered: number | null = null;
		for (const quad of quads) {
			const interval = segmentQuadInterval(eyeXZ, sampleXZ, quad);
			if (interval === null) continue;
			if (entered === null || interval[0] < entered) entered = interval[0];
		}
		if (entered === null) continue;
		const y = eye[1] + entered * (sample[1] - eye[1]);
		const clearance = wall.topY - y;
		if (clearance > margin) margin = clearance;
	}
	return margin;
}

/** Every drawn centerline point of the wall is clearly inside the Space. */
function whollyInsideSpace(wall: NearWallWall, space: CompiledRoom): boolean {
	const clearance = wall.thickness / 2 + INTERIOR_CONTENT_CLEARANCE_METERS;
	let sawPoint = false;
	for (const polyline of wall.centerlinePolylines) {
		for (const point of polyline) {
			sawPoint = true;
			if (insetDistance(point, space.floorPolygon) <= clearance) return false;
		}
	}
	return sawPoint;
}

function wallOf(wall: CompiledPhysicalWall, elevation: number): NearWallWall {
	return {
		wallId: wall.wallId,
		floorElevation: elevation,
		bottomY: elevation,
		topY: elevation + wall.height,
		thickness: wall.thickness,
		centerlinePolylines: wall.solidCenterlinePolylines,
	};
}

/**
 * The near Walls of the inspected Space (§3.2 and §3.3's classification half).
 *
 * A Wall is a candidate when it overlaps the Space vertically, is tall enough that
 * a stub would remove something, and is not wholly interior content. A candidate
 * is cut when its obstruction margin is clearly positive, left whole when it is
 * clearly negative, and otherwise keeps its previous state — which is what makes a
 * stationary Camera stable.
 */
export function classifyNearWalls(input: NearWallClassifyInput): NearWallClassification {
	const space = inspectedSpace({
		eye: input.eye,
		target: input.target,
		rooms: input.rooms,
		previousRoomId: input.previousSpaceId,
	});
	if (space === null) return { spaceId: null, stubTopY: null, cut: new Set() };
	const stubTopY = space.floorElevation + STUB_HEIGHT_METERS;
	const samples = sightSamples(space);
	if (samples.length === 0) return { spaceId: space.roomId, stubTopY, cut: new Set() };
	const elevationByFloor = new Map(input.floors.map((floor) => [floor.floorId, floor.elevation]));
	const cut = new Set<string>();
	for (const compiled of input.walls) {
		const elevation = elevationByFloor.get(compiled.floorId) ?? 0;
		const wall = wallOf(compiled, elevation);
		if (!(wall.topY > space.floorElevation + 1e-9 && wall.bottomY < space.ceilingElevation - 1e-9))
			continue;
		if (!(wall.topY > stubTopY + STUB_NOTHING_TO_REMOVE_METERS)) continue;
		if (whollyInsideSpace(wall, space)) continue;
		const margin = obstructionMargin(input.eye, samples, wall);
		if (margin > CUT_MARGIN_METERS) cut.add(wall.wallId);
		else if (margin >= WHOLE_MARGIN_METERS && input.previousCut.has(wall.wallId))
			cut.add(wall.wallId);
	}
	return { spaceId: space.roomId, stubTopY, cut };
}
