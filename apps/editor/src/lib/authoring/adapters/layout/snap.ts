/**
 * R217.S14 — Layout's **snap policy** for authoring gestures.
 *
 * Layout already owns snap geometry in `layout-core`; this module is only the
 * policy that decides *which* existing resolver a gesture may ask, and what the
 * creator is told when one wins. It computes no candidates and no alternatives:
 * every winner comes from `resolveLayoutSnap` or the
 * `resolveOpeningDragSnap` family, against the captured baseline geometry.
 *
 * The policy follows the target specification's operation table:
 *
 * - Ink Wall point: existing Junction and host targets, an orthogonal guide
 *   from the previous point, then the fixed 0.5 m grid.
 * - Opening slide: the Opening drag family's edge/centre targets, then the
 *   fixed 0.5 m grid.
 * Wall length and body-move fallbacks belong to R217.S15 and live here: the
 * normal distance or the length rounds to the fixed 0.5 m grid, and neither
 * ever snaps a Wall onto another Wall or Junction.
 *
 * `Snap held` (Alt) suspends every row. The callers pass the one shared
 * drafting state, so this module never invents a second Snap switch.
 */

import {
	resolveLayoutSnap,
	resolveOpeningDragSnapUseMode,
	type CompiledLayoutGeometry,
	type LayoutVec2,
	type SnapFeatureKind
} from '@portfolio/layout-core';

import { DRAFTING_SNAP_METERS, draftingSnapIncrementMeters } from '$lib/authoring/stage/stage-drafting';

import type { StageDraftingState } from '$lib/authoring/stage/stage-drafting';

/** The winning snap, in the words the marks use. */
export type LayoutSnapWinner = {
	readonly point: LayoutVec2;
	readonly kind: SnapFeatureKind;
	/** One-word tag: `Junction`, `Aligned`, `Grid`, `Wall` or `Opening`. */
	readonly name: string;
	/** The host Wall when the winner names a Wall span. */
	readonly wallId?: string;
};

/**
 * The visible word for one winning family.
 *
 * `orthogonal-guide` reads as **Aligned** because it says the point holds the
 * previous point's coordinate; a Wall span reads as **Wall**, the host the
 * chain would split. A bare grid point is **Grid**.
 */
export function layoutSnapName(kind: SnapFeatureKind): string {
	switch (kind) {
		case 'junction':
			return 'Junction';
		case 'orthogonal-guide':
		case 'extension-guide':
			return 'Aligned';
		case 'grid':
			return 'Grid';
		case 'wall-span':
		case 'wall-midpoint':
		case 'wall-intersection':
			return 'Wall';
		case 'opening-edge':
			return 'Opening';
		case 'object-bounds-edge':
		case 'object-bounds-center':
			return 'Object';
	}
	// Unreachable for the current union; a future or foreign kind still reads as
	// a neutral tag instead of a wrong relation.
	return 'Snap';
}

/** Resolve the Ink Wall point's semantic/guide/grid winner, or `null`. */
export function resolveInkPointSnap(input: {
	readonly geometry: CompiledLayoutGeometry;
	readonly point: LayoutVec2;
	readonly pixelsPerMeter: number;
	readonly anchor: LayoutVec2 | null;
	readonly drafting: StageDraftingState;
}): LayoutSnapWinner | null {
	if (draftingSnapIncrementMeters(input.drafting) === null) return null;
	const resolution = resolveLayoutSnap(
		input.geometry,
		input.point,
		{
			pixelsPerMeter: input.pixelsPerMeter,
			gridStep: DRAFTING_SNAP_METERS,
			...(input.anchor === null ? {} : { anchor: input.anchor })
		},
		// A chain point may connect to an existing Junction or split a host
		// Wall. A Wall intersection is not a legal endpoint target (the chain
		// policy refuses the undeclared contact), and an Opening edge is not a
		// legal host for a new Wall point, so both are deliberately absent.
		{ allowedKinds: ['junction', 'wall-span', 'orthogonal-guide', 'grid'] }
	);
	if (resolution.kind !== 'snap') return null;
	const { candidate } = resolution;
	return {
		point: [cleanCoordinate(candidate.point[0]), cleanCoordinate(candidate.point[1])],
		kind: candidate.kind,
		name: layoutSnapName(candidate.kind),
		...(candidate.wallId === undefined ? {} : { wallId: candidate.wallId })
	};
}

/**
 * R217.S15 — the end point's free Junction move: its orthogonal guide from the
 * Wall's other end, then the fixed grid. No Junction or Wall-span target is
 * offered here: attaching a point is Ink's job, and the drag is a free X/Z move.
 */
export function resolveJunctionPointSnap(input: {
	readonly geometry: CompiledLayoutGeometry;
	readonly point: LayoutVec2;
	readonly anchor: LayoutVec2;
	readonly pixelsPerMeter: number;
	readonly drafting: StageDraftingState;
}): LayoutSnapWinner | null {
	if (draftingSnapIncrementMeters(input.drafting) === null) return null;
	const resolution = resolveLayoutSnap(
		input.geometry,
		input.point,
		{
			pixelsPerMeter: input.pixelsPerMeter,
			gridStep: DRAFTING_SNAP_METERS,
			anchor: input.anchor
		},
		{ allowedKinds: ['orthogonal-guide', 'grid'] }
	);
	if (resolution.kind !== 'snap') return null;
	const { candidate } = resolution;
	return {
		point: [cleanCoordinate(candidate.point[0]), cleanCoordinate(candidate.point[1])],
		kind: candidate.kind,
		name: layoutSnapName(candidate.kind)
	};
}

/**
 * Round one signed distance on the fixed 0.5 m grid, or return it unchanged
 * while Snap is held. Zero stays zero: a body drag that never leaves its line
 * names no movement rather than the nearest half metre.
 */
export function snapWallDistance(distance: number, drafting: StageDraftingState): number {
	if (draftingSnapIncrementMeters(drafting) === null) return distance;
	const snapped = Math.round(distance / DRAFTING_SNAP_METERS) * DRAFTING_SNAP_METERS;
	return Math.abs(snapped) < 1e-9 ? 0 : cleanCoordinate(snapped);
}

/**
 * Round a positive Wall length on the fixed 0.5 m grid. A pointer that crossed
 * the fixed endpoint keeps its negative sign so the adapter can refuse it; it is
 * never laundered into a tiny positive Wall.
 */
export function snapWallLength(length: number, drafting: StageDraftingState): number {
	if (!(length > 0)) return length;
	if (draftingSnapIncrementMeters(drafting) === null) return length;
	const snapped = Math.round(length / DRAFTING_SNAP_METERS) * DRAFTING_SNAP_METERS;
	return snapped < DRAFTING_SNAP_METERS ? DRAFTING_SNAP_METERS : cleanCoordinate(snapped);
}

/** Resolve an Opening slide's start-edge offset, or the raw offset. */
export function resolveOpeningSlideSnap(input: {
	readonly geometry: CompiledLayoutGeometry;
	readonly hostSpan: { readonly segmentId: string; readonly start: LayoutVec2; readonly end: LayoutVec2 };
	readonly openingId: string;
	readonly pointerCenterOffset: number;
	readonly width: number;
	readonly pixelsPerMeter: number;
	readonly drafting: StageDraftingState;
}): { readonly offset: number; readonly winner: LayoutSnapWinner | null } {
	const rawOffset = input.pointerCenterOffset - input.width / 2;
	if (draftingSnapIncrementMeters(input.drafting) === null) {
		return { offset: rawOffset, winner: null };
	}
	const resolution = resolveOpeningDragSnapUseMode(
		input.geometry,
		compiledHostSpan(input.geometry, input.hostSpan),
		input.openingId,
		input.pointerCenterOffset,
		{
			anchor: { kind: 'center', width: input.width },
			context: { pixelsPerMeter: input.pixelsPerMeter, gridStep: DRAFTING_SNAP_METERS }
		}
	);
	// Never launder an out-of-fit raw candidate into a clamped snap win: the raw
	// candidate stands and the planner owns the refusal.
	if (!resolution.rawValid || resolution.snappedOffset === null || resolution.snappedKind === null) {
		return { offset: rawOffset, winner: null };
	}
	return {
		offset: resolution.snappedOffset,
		winner: {
			point: pointAtOffset(input.hostSpan, resolution.snappedOffset),
			kind: resolution.snappedKind,
			name: layoutSnapName(resolution.snappedKind)
		}
	};
}

/** Resolve an Opening width edge's offset, or the raw edge offset. */
export function resolveOpeningWidthSnap(input: {
	readonly geometry: CompiledLayoutGeometry;
	readonly hostSpan: { readonly segmentId: string; readonly start: LayoutVec2; readonly end: LayoutVec2 };
	readonly openingId: string;
	readonly pointerEdgeOffset: number;
	readonly pixelsPerMeter: number;
	readonly drafting: StageDraftingState;
}): { readonly edgeOffset: number; readonly winner: LayoutSnapWinner | null } {
	if (draftingSnapIncrementMeters(input.drafting) === null) {
		return { edgeOffset: input.pointerEdgeOffset, winner: null };
	}
	const resolution = resolveOpeningDragSnapUseMode(
		input.geometry,
		compiledHostSpan(input.geometry, input.hostSpan),
		input.openingId,
		input.pointerEdgeOffset,
		{
			anchor: { kind: 'edge' },
			// A width is authored in 0.1 m steps, not the Wall-point 0.5 m grid.
			context: { pixelsPerMeter: input.pixelsPerMeter, gridStep: 0.1 }
		}
	);
	if (!resolution.rawValid || resolution.snappedOffset === null || resolution.snappedKind === null) {
		return { edgeOffset: input.pointerEdgeOffset, winner: null };
	}
	return {
		edgeOffset: resolution.snappedOffset,
		winner: {
			point: pointAtOffset(input.hostSpan, resolution.snappedOffset),
			kind: resolution.snappedKind,
			name: layoutSnapName(resolution.snappedKind)
		}
	};
}

/**
 * The compiled Wall span that owns one authored Wall.
 *
 * Wall-first query records are keyed by `wallKey` (the bare Wall id), while
 * `segmentId` can be a sampled or room-qualified id. The opening-drag resolver
 * matches the host by `segmentId`, so the adapter passes the compiled record's
 * own id rather than assuming the authored id is the segment key.
 *
 * The **authored** start/end stay authoritative. The resolver, the winning
 * point and the offset the candidate applies must all be measured in the same
 * frame, so a sampled or room-qualified compiled span contributes its id and
 * room only — never a different origin or direction.
 */
function compiledHostSpan(
	geometry: CompiledLayoutGeometry,
	hostSpan: { readonly segmentId: string; readonly start: LayoutVec2; readonly end: LayoutVec2 }
): { readonly segmentId: string; readonly roomId?: string; readonly start: LayoutVec2; readonly end: LayoutVec2 } {
	const span = geometry.queries.spans.find(
		(candidate) =>
			candidate.kind === 'wall' &&
			(candidate.segmentId === hostSpan.segmentId ||
				candidate.wallKey === hostSpan.segmentId ||
				candidate.sourceId === hostSpan.segmentId)
	);
	return span === undefined
		? hostSpan
		: {
				segmentId: span.segmentId,
				...(span.roomId === undefined ? {} : { roomId: span.roomId }),
				start: hostSpan.start,
				end: hostSpan.end
			};
}

/** A finite coordinate with no negative zero; never a second grid rounding. */
function cleanCoordinate(value: number): number {
	const cleaned = Math.round(value * 1e9) / 1e9;
	return Object.is(cleaned, -0) ? 0 : cleaned;
}

/** A world point at one authored distance from a host span's start. */
function pointAtOffset(
	host: { readonly start: LayoutVec2; readonly end: LayoutVec2 },
	offset: number
): LayoutVec2 {
	const dx = host.end[0] - host.start[0];
	const dz = host.end[1] - host.start[1];
	const length = Math.hypot(dx, dz);
	if (!(length > 0)) return [host.start[0], host.start[1]];
	return [host.start[0] + (dx / length) * offset, host.start[1] + (dz / length) * offset];
}
