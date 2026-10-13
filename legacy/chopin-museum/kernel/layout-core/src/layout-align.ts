/**
 * `layout-align.ts` — P23.2 bounded alignment for Layout objects.
 *
 * Scope (P23.2 plan §Alignment): one selected supported Layout object → one
 * explicit reference. References are canonical compiled records:
 *
 *   - another Layout object's compiled plan footprint AABB,
 *   - a Room's compiled boundary spans AABB,
 *   - a straight Wall's compiled span (bounded **Center on Wall**).
 *
 * Actions preserve the selected object's Y, rotation, dimensions and
 * document-level ownership: only document-level X/Z position changes. A no-op
 * (already aligned) reports `no_op` so the caller adds no history. This
 * module is pure planning — it never mutates a document and never writes
 * history; the editor transaction runner owns commit semantics.
 */
import type { LayoutVec2 } from './layout-types';
import type { CompiledLayoutGeometry, CompiledQuerySpan } from './layout-geometry-types';
import { dedupeWallSpans, objectFootprintCenter, type MergedWallSpan } from './layout-snap';

export type AlignAxis = 'x' | 'z';
export type AlignAxisAction = 'min' | 'center' | 'max';
export type AlignAction = AlignAxisAction | 'center-on-wall';
export type AlignReferenceKind = 'object' | 'room' | 'wall';

export type AlignReference = {
	kind: AlignReferenceKind;
	/** Canonical source ID: objectId / roomId / wall (segment) ID. */
	id: string;
};

/**
 * Collision-safe identity for one align reference. IDs are only unique
 * inside each collection (an object `foo` and a wall `foo` can both exist),
 * so UI options and lookups must key on `kind + ':' + id`, never `id` alone.
 */
export function alignReferenceKey(reference: AlignReference): string {
	return `${reference.kind}:${reference.id}`;
}

export type AlignPlan =
	| {
			kind: 'success';
			position: [number, number, number];
			reference: AlignReference;
			action: AlignAction;
			axis?: AlignAxis;
	  }
	| { kind: 'rejected'; code: AlignRejectionCode; message: string };

export type AlignRejectionCode =
	| 'unknown_object'
	| 'unknown_reference'
	| 'unsupported_reference'
	| 'invalid_action'
	| 'no_op';

type Bounds2 = { min: LayoutVec2; max: LayoutVec2 };

function footprintAabb(footprint: readonly LayoutVec2[]): Bounds2 | null {
	if (footprint.length === 0) return null;
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	for (const [x, z] of footprint) {
		minX = Math.min(minX, x);
		minZ = Math.min(minZ, z);
		maxX = Math.max(maxX, x);
		maxZ = Math.max(maxZ, z);
	}
	return { min: [minX, minZ], max: [maxX, maxZ] };
}

function spansAabb(spans: readonly CompiledQuerySpan[]): Bounds2 | null {
	if (spans.length === 0) return null;
	let minX = Infinity;
	let minZ = Infinity;
	let maxX = -Infinity;
	let maxZ = -Infinity;
	for (const span of spans) {
		minX = Math.min(minX, span.start[0], span.end[0]);
		minZ = Math.min(minZ, span.start[1], span.end[1]);
		maxX = Math.max(maxX, span.start[0], span.end[0]);
		maxZ = Math.max(maxZ, span.start[1], span.end[1]);
	}
	return { min: [minX, minZ], max: [maxX, maxZ] };
}

function referenceBounds(
	geometry: CompiledLayoutGeometry,
	reference: AlignReference,
	ownerRoomId?: string
): { bounds: Bounds2; wallSpan?: MergedWallSpan } | null {
	if (reference.kind === 'object') {
		for (const polygon of geometry.queries.polygons) {
			if (polygon.kind !== 'object-footprint' || polygon.objectId !== reference.id) continue;
			const bounds = footprintAabb(polygon.polygon);
			return bounds ? { bounds } : null;
		}
		return null;
	}
	if (reference.kind === 'room') {
		// Legacy/hand-built room spans carry roomId; wall-first canonical
		// spans carry none, so fall back to the room-floor polygon (which
		// retains roomId in every generation).
		const roomSpans = geometry.queries.spans.filter((span) => span.kind === 'wall' && span.roomId === reference.id);
		const spanBounds = spansAabb(roomSpans);
		if (spanBounds) return { bounds: spanBounds };
		for (const polygon of geometry.queries.polygons) {
			if (polygon.kind !== 'room-floor' || polygon.roomId !== reference.id) continue;
			const bounds = footprintAabb(polygon.polygon);
			return bounds ? { bounds } : null;
		}
		return null;
	}
	// Wall reference: the compiled wall spans for this segment (wall) ID.
	// Wall-first wall ids are document-global; legacy segment ids are only
	// unique inside their room, so the reference resolves against the
	// selected object's room. The compiler emits one span per sample
	// interval (0.25 m for straight lines), so the bounded Center-on-Wall
	// span must be the merged full-length extent, never a single sample
	// chunk.
	const wallSpans = geometry.queries.spans.filter(
		(span) =>
			span.kind === 'wall' &&
			span.segmentId === reference.id &&
			(span.wallKey === undefined || span.wallKey === span.segmentId || span.roomId === ownerRoomId)
	);
	if (wallSpans.length === 0) return null;
	const merged = dedupeWallSpans(wallSpans);
	const bounds = spansAabb(wallSpans);
	if (!bounds) return null;
	// Center-on-Wall is a straight-wall action (P23.2 scope): a curved wall
	// resolves to bounds only and is rejected by the planner below.
	const wallSpan = merged[0]!.straight ? merged[0] : undefined;
	return { bounds, wallSpan };
}

function axisIndex(axis: AlignAxis): 0 | 1 {
	return axis === 'x' ? 0 : 1;
}

/**
 * Plan aligning one compiled object to one reference along X or Z, or
 * centering its footprint on a straight Wall. Only document-level X/Z of the
 * object's position changes; Y, rotation, dimensions and roomId are
 * preserved. Pure: returns one plan for the caller's transaction runner.
 */
export function planLayoutObjectAlign(
	geometry: CompiledLayoutGeometry,
	objectId: string,
	reference: AlignReference,
	action: AlignAction,
	axis: AlignAxis = 'x'
): AlignPlan {
	const object = geometry.objects.find((candidate) => candidate.objectId === objectId);
	if (!object) return { kind: 'rejected', code: 'unknown_object', message: `Unknown layout object '${objectId}'` };
	if (object.kind === 'profile') {
		return { kind: 'rejected', code: 'unsupported_reference', message: 'Profile objects are read-only and cannot be aligned' };
	}
	if (action !== 'center-on-wall' && action !== 'min' && action !== 'center' && action !== 'max') {
		return { kind: 'rejected', code: 'invalid_action', message: `Invalid alignment action '${String(action)}'` };
	}
	if (action === 'center-on-wall' && reference.kind !== 'wall') {
		return { kind: 'rejected', code: 'unsupported_reference', message: 'Center on Wall requires a Wall reference' };
	}

	const resolved = referenceBounds(geometry, reference, object.roomId);
	if (!resolved) {
		return {
			kind: 'rejected',
			code: 'unknown_reference',
			message: `Unknown ${reference.kind} alignment reference '${reference.id}'`
		};
	}

	const selfBounds = footprintAabb(object.planFootprint);
	if (!selfBounds) {
		return {
			kind: 'rejected',
			code: 'unsupported_reference',
			message: `Object '${objectId}' has no plan footprint to align`
		};
	}

	const position: [number, number, number] = [...object.position] as [number, number, number];
	if (action === 'center-on-wall') {
		const span = resolved.wallSpan;
		if (!span) {
			return {
				kind: 'rejected',
				code: 'unsupported_reference',
				message: 'Center on Wall requires a straight Wall reference'
			};
		}
		// Canonical compiled wall geometry: project the object footprint
		// center onto the wall span and move the footprint center there.
		const center = objectFootprintCenter(object.planFootprint)!;
		const dx = span.end[0] - span.start[0];
		const dz = span.end[1] - span.start[1];
		const squared = dx * dx + dz * dz;
		const rawT = squared > 0 ? ((center[0] - span.start[0]) * dx + (center[1] - span.start[1]) * dz) / squared : 0;
		const amount = Math.min(1, Math.max(0, rawT));
		const projected: LayoutVec2 = [span.start[0] + dx * amount, span.start[1] + dz * amount];
		position[0] += projected[0] - center[0];
		position[2] += projected[1] - center[1];
	} else {
		const index = axisIndex(axis);
		const target =
			action === 'min'
				? resolved.bounds.min[index]
				: action === 'max'
					? resolved.bounds.max[index]
					: (resolved.bounds.min[index] + resolved.bounds.max[index]) / 2;
		const self =
			action === 'min'
				? selfBounds.min[index]
				: action === 'max'
					? selfBounds.max[index]
					: (selfBounds.min[index] + selfBounds.max[index]) / 2;
		if (index === 0) position[0] += target - self;
		else position[2] += target - self;
	}

	const changed =
		Math.abs(position[0] - object.position[0]) > 1e-9 ||
		Math.abs(position[2] - object.position[2]) > 1e-9;
	if (!changed) {
		return { kind: 'rejected', code: 'no_op', message: `Object '${objectId}' is already aligned to '${reference.id}'` };
	}
	return {
		kind: 'success',
		position,
		reference,
		action,
		...(action === 'center-on-wall' ? {} : { axis })
	};
}
