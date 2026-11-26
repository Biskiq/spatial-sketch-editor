import type { LayoutVec2 } from '../../geometry/coordinates';
import type { CompiledLayoutGeometry } from '../../geometry/types';
import { snapAcquisitionRadiusWorld, snapToGridStep } from './features';
import type { SnapQueryContext } from './types';
import { LAYOUT_PLAN_GRID_STEP } from './types';

/** Semantic rank per candidate family in the opening-drag context — lower wins. */
const OPENING_DRAG_SEMANTIC_RANK: Record<OpeningDragSnapCandidate['kind'], number> = {
	junction: 0,
	'opening-edge': 1,
	'wall-midpoint': 2,
	grid: 9,
};

export type OpeningDragSnapCandidate = {
	/**
	 * The coordinate this candidate commits for the drag's anchor, already
	 * clamped into the anchor's legal range and expressed in the caller's
	 * authored-segment frame (same frame as `pointerOffset`): the Opening
	 * **start edge** in `[0, length - width]` for a `center` anchor, the
	 * **moving edge** in `[0, length]` for an `edge` anchor.
	 */
	offset: number;
	/** Semantic family in the opening-drag context. */
	kind: 'junction' | 'opening-edge' | 'wall-midpoint' | 'grid';
	/** Canonical source identity (`${openingId}#start` / `#end` for opening edges). */
	sourceId: string;
	/** Distance from the pointer offset to the implied opening center, in meters. */
	distance: number;
};

export type OpeningDragSnapResolution =
	| { kind: 'snap'; candidate: OpeningDragSnapCandidate }
	| { kind: 'none' };

/**
 * Which authored Opening coordinate the pointer drives.
 *
 * `center` (body drag): the pointer projects onto the Opening **center**, so
 * candidates resolve in center space and are emitted as start-edge offsets
 * (the P23.2 semantics, unchanged).
 *
 * `edge` (width-handle drag): the pointer projects onto the **moving edge**
 * itself, so candidates resolve in edge space and are emitted as that edge's
 * own offset. No surrogate width is involved, and an alignment target reached
 * from either side resolves to exactly the same coordinate.
 */
export type OpeningDragAnchor = { kind: 'center'; width: number } | { kind: 'edge' };

/**
 * Resolve one opening drag along its host wall in offset space
 * (meters from the authored segment start) for an explicit
 * {@link OpeningDragAnchor}. The public `resolveOpeningDragSnap` (center) and
 * `resolveOpeningDragEdgeSnap` (edge) both funnel through here, so body and
 * width-handle drags can never drift apart.
 *
 * The opening is confined to its host wall, so candidates are the host
 * wall's features projected onto the authored span direction: the wall's
 * junction endpoints, its midpoint, other openings' edges on the same wall,
 * and the grid fallback. The dragged opening's own spans are skipped
 * entirely, so its own edges can never act as external reference candidates
 * (the moving self-snap loop — P23.2 §Moving-target exclusion). Grid
 * candidates snap the dragged anchor (the opening **center** for body drags,
 * the moving **edge** for width handles) to the step exactly like opening
 * creation (`createDefaultOpening`), so drag and create share one grid
 * semantic.
 *
 * `hostSpan.roomId` disambiguates same-named legacy segments: an opening on
 * another room's same-named segment is a different wall and never becomes a
 * candidate (wall-first wall ids are document-global, so room scoping does
 * not apply there).
 *
 * `hostSpan` must be the host wall span in the caller's frame (the room
 * boundary segment the opening lives on): offsets are measured from its
 * start, so shared walls traversed in reverse resolve correctly without
 * mirroring. Deterministic winner order is the same pipeline as
 * `resolveLayoutSnap`: context rank → offset distance → stable key. Pure —
 * no mutation, no history.
 */
function resolveOpeningDragAnchoredSnap(
	geometry: CompiledLayoutGeometry,
	hostSpan: { segmentId: string; roomId?: string; start: LayoutVec2; end: LayoutVec2 },
	draggedOpeningId: string,
	pointerOffset: number,
	anchor: OpeningDragAnchor,
	context: SnapQueryContext,
): OpeningDragSnapResolution {
	const radius = snapAcquisitionRadiusWorld(context);
	if (radius <= 0) return { kind: 'none' };
	if (!Number.isFinite(pointerOffset)) return { kind: 'none' };
	if (anchor.kind === 'center' && (!Number.isFinite(anchor.width) || anchor.width <= 0)) {
		return { kind: 'none' };
	}
	const dx = hostSpan.end[0] - hostSpan.start[0];
	const dz = hostSpan.end[1] - hostSpan.start[1];
	const length = Math.hypot(dx, dz);
	if (length <= 0) return { kind: 'none' };
	const dirX = dx / length;
	const dirZ = dz / length;
	const step = context.gridStep ?? LAYOUT_PLAN_GRID_STEP;
	// The anchor's own legal range: a body drag keeps the whole Opening on the
	// Wall (`[0, length - width]`); a width handle moves one edge, which is
	// bounded only by the Wall itself (`[0, length]`).
	const maxAnchorOffset = anchor.kind === 'center' ? Math.max(0, length - anchor.width) : length;
	const anchorOffset = (target: number): number => {
		const raw = anchor.kind === 'center' ? target - anchor.width / 2 : target;
		return Math.min(maxAnchorOffset, Math.max(0, raw));
	};

	const candidates: OpeningDragSnapCandidate[] = [];
	/**
	 * Add one anchor-space target. `target` is the coordinate the pointer is
	 * approaching (the opening center for `center` anchors, the moving edge for
	 * `edge` anchors); clamping only happens when the candidate is emitted.
	 */
	const addAnchorCandidate = (
		target: number,
		kind: OpeningDragSnapCandidate['kind'],
		sourceId: string,
		acquisition = radius,
	): void => {
		const distance = Math.abs(pointerOffset - target);
		if (distance > acquisition) return;
		candidates.push({ offset: anchorOffset(target), kind, sourceId, distance });
	};

	// Junction candidates: the host wall's two endpoints. Clamping resolves the
	// anchor onto the junction, which makes the opening flush with the wall end
	// (a body drag centers the opening there; a width handle lands the moving
	// edge exactly on it).
	addAnchorCandidate(0, 'junction', `${hostSpan.segmentId}#start`);
	addAnchorCandidate(length, 'junction', `${hostSpan.segmentId}#end`);

	// Host wall midpoint (anchor-aligned).
	addAnchorCandidate(length / 2, 'wall-midpoint', hostSpan.segmentId);

	// Other openings' edges on the same wall. Body drags use nearest-edge
	// alignment (the dragged opening's approaching edge lands on the reference
	// edge); width handles land the moving edge on the reference edge itself,
	// which is therefore the same coordinate from either approach side.
	// Legacy segment ids are only unique inside their room, so an opening on
	// a same-named segment of another room belongs to a different wall.
	for (const other of geometry.queries.spans) {
		if (other.kind !== 'opening' || !other.openingId) continue;
		if (other.segmentId !== hostSpan.segmentId || other.openingId === draggedOpeningId) continue;
		const roomScoped = other.wallKey !== undefined && other.wallKey !== other.segmentId;
		if (roomScoped && other.roomId !== hostSpan.roomId) continue;
		const edges: Array<[LayoutVec2, 'start' | 'end']> = [
			[other.start, 'start'],
			[other.end, 'end'],
		];
		for (const [edgePoint, key] of edges) {
			const edgeOffset =
				(edgePoint[0] - hostSpan.start[0]) * dirX + (edgePoint[1] - hostSpan.start[1]) * dirZ;
			if (edgeOffset < -1e-9 || edgeOffset > length + 1e-9) continue;
			const target =
				anchor.kind === 'edge'
					? edgeOffset
					: pointerOffset < edgeOffset
						? edgeOffset - anchor.width / 2
						: edgeOffset + anchor.width / 2;
			addAnchorCandidate(target, 'opening-edge', `${other.openingId}#${key}`);
		}
	}

	// Grid fallback — always in range within max(radius, step / 2) exactly
	// like `resolveLayoutSnap`, and lower-ranked than every semantic family.
	const gridCenter = snapToGridStep([pointerOffset, 0], step)[0]!;
	addAnchorCandidate(gridCenter, 'grid', 'grid', Math.max(radius, step / 2));

	let best: OpeningDragSnapCandidate | null = null;
	let bestKey = '';
	for (const candidate of candidates) {
		const key = `${OPENING_DRAG_SEMANTIC_RANK[candidate.kind]}|${candidate.kind}|${candidate.sourceId}|${candidate.offset}`;
		if (!best) {
			best = candidate;
			bestKey = key;
			continue;
		}
		const rankDiff =
			OPENING_DRAG_SEMANTIC_RANK[candidate.kind] - OPENING_DRAG_SEMANTIC_RANK[best.kind];
		const distanceDiff = candidate.distance - best.distance;
		if (
			rankDiff < 0 ||
			(rankDiff === 0 && (distanceDiff < 0 || (distanceDiff === 0 && key < bestKey)))
		) {
			best = candidate;
			bestKey = key;
		}
	}
	return best ? { kind: 'snap', candidate: best } : { kind: 'none' };
}

/**
 * Body drag: resolve one Opening's drag position in **center** space, emitting
 * start-edge offsets clamped into `[0, length - width]` (P23.2 semantics).
 */
export function resolveOpeningDragSnap(
	geometry: CompiledLayoutGeometry,
	hostSpan: { segmentId: string; roomId?: string; start: LayoutVec2; end: LayoutVec2 },
	draggedOpeningId: string,
	pointerOffset: number,
	openingWidth: number,
	context: SnapQueryContext,
): OpeningDragSnapResolution {
	return resolveOpeningDragAnchoredSnap(
		geometry,
		hostSpan,
		draggedOpeningId,
		pointerOffset,
		{ kind: 'center', width: openingWidth },
		context,
	);
}

/**
 * Width-handle drag: resolve the **moving edge** directly in edge space,
 * emitting that edge's own offset clamped into `[0, length]`.
 *
 * Deliberately not a surrogate-width center drag: resolving an edge against a
 * fake ~0 m width shifts every candidate by half of it, so a width handle
 * could never reach the Wall end flush and same-target alignments would differ
 * by approach side. Here the candidate **is** the edge coordinate.
 */
export function resolveOpeningDragEdgeSnap(
	geometry: CompiledLayoutGeometry,
	hostSpan: { segmentId: string; roomId?: string; start: LayoutVec2; end: LayoutVec2 },
	draggedOpeningId: string,
	pointerEdgeOffset: number,
	context: SnapQueryContext,
): OpeningDragSnapResolution {
	return resolveOpeningDragAnchoredSnap(
		geometry,
		hostSpan,
		draggedOpeningId,
		pointerEdgeOffset,
		{ kind: 'edge' },
		context,
	);
}

/** Fit tolerance for raw drag validity (matches the compiler epsilon order). */
const OPENING_DRAG_EPSILON = 1e-6;

/**
 * Raw drag candidate validity, kept **separate** from the bounded
 * P23.2 snap result.
 *
 * The snap resolvers clamp every candidate into the anchor's legal range,
 * which is correct as a *suggestion* but must never be laundered into
 * validity: a drag 2 m past the Wall end would otherwise commit as an
 * end-flush placement. This use-mode therefore returns the unclamped raw
 * candidate (and its own fit result) next to an optional **honored** snap win:
 *
 * ```text
 * raw candidate outside fit bounds        → rawValid false, candidate invalid
 *                                            (transient invalid preview, reject)
 * snap win inside the acquisition radius  → committable snapped candidate
 * snap win only reachable by clamping far → NOT honored (raw candidate stands)
 * ```
 *
 * The anchor decides where the raw candidate comes from: a `center` anchor
 * treats `pointerOffset` as the opening center (raw start edge
 * `pointerOffset - width / 2`, fit width = the authored opening width), while
 * an `edge` anchor treats `pointerOffset` as the moving edge itself (raw edge
 * offset = `pointerOffset`, fit width = `0`). Neither value is clamped or
 * repaired.
 */
export type OpeningDragRawResolution = {
	/** Raw pointer projection in the caller's frame (unclamped). */
	rawPointerOffset: number;
	/** Raw candidate start/edge offset derived from the pointer (unclamped). */
	rawOffset: number;
	/** Raw candidate fit against the host Wall — never snap-derived. */
	rawValid: boolean;
	/** Honored in-fit snap win's offset, or `null` when the raw candidate stands. */
	snappedOffset: number | null;
	snappedKind: OpeningDragSnapCandidate['kind'] | null;
	snappedSourceId: string | null;
	/** The candidate a commit would use (`snappedOffset ?? rawOffset`). */
	candidateOffset: number;
	/** Whether that candidate may commit (one history entry) or must reject. */
	candidateValid: boolean;
};

export function resolveOpeningDragSnapUseMode(
	geometry: CompiledLayoutGeometry,
	hostSpan: { segmentId: string; roomId?: string; start: LayoutVec2; end: LayoutVec2 },
	draggedOpeningId: string,
	pointerOffset: number,
	options: { anchor: OpeningDragAnchor; context: SnapQueryContext },
): OpeningDragRawResolution {
	const resolution =
		options.anchor.kind === 'center'
			? resolveOpeningDragSnap(
					geometry,
					hostSpan,
					draggedOpeningId,
					pointerOffset,
					options.anchor.width,
					options.context,
				)
			: resolveOpeningDragEdgeSnap(
					geometry,
					hostSpan,
					draggedOpeningId,
					pointerOffset,
					options.context,
				);
	return resolveOpeningDragRawValidity(resolution, {
		hostSpan,
		pointerOffset,
		anchor: options.anchor,
		context: options.context,
	});
}

/**
 * Pure projection of a (already resolved) snap result into the P23.3 raw
 * validity pair. Splitting this from `resolveOpeningDragSnapUseMode` keeps the
 * contract unit-testable without geometry fixtures.
 */
export function resolveOpeningDragRawValidity(
	resolution: OpeningDragSnapResolution,
	options: {
		hostSpan: { start: LayoutVec2; end: LayoutVec2 };
		pointerOffset: number;
		anchor: OpeningDragAnchor;
		context: SnapQueryContext;
	},
): OpeningDragRawResolution {
	const { hostSpan, pointerOffset, anchor, context } = options;
	const length = Math.hypot(
		hostSpan.end[0] - hostSpan.start[0],
		hostSpan.end[1] - hostSpan.start[1],
	);
	const rawOffset = anchor.kind === 'center' ? pointerOffset - anchor.width / 2 : pointerOffset;
	const fitWidth = anchor.kind === 'center' ? anchor.width : 0;
	const fits = (offset: number): boolean =>
		offset >= -OPENING_DRAG_EPSILON && offset + fitWidth <= length + OPENING_DRAG_EPSILON;
	const rawValid = fits(rawOffset);

	const radius = snapAcquisitionRadiusWorld(context);
	// Mirror the candidate emission exactly (see `resolveOpeningDragAnchoredSnap`):
	// a body drag's anchor range is `[0, length - width]`, an edge's `[0, length]`.
	const maxSnapOffset = anchor.kind === 'center' ? Math.max(0, length - anchor.width) : length;
	// A candidate strictly inside the fit range cannot have been produced by
	// the endpoint clamp; one sitting exactly on a clamp boundary may have
	// been. Only the `junction` family is *meant* to be flushed to a Wall end
	// (that is the endpoint-clearance snap the plan ratifies), and only while
	// the pointer is inside its own acquisition radius.
	const strictlyInside =
		resolution.kind === 'snap' &&
		resolution.candidate.offset > OPENING_DRAG_EPSILON &&
		resolution.candidate.offset < maxSnapOffset - OPENING_DRAG_EPSILON;
	const snapHonored =
		resolution.kind === 'snap' &&
		radius > 0 &&
		resolution.candidate.distance <= radius &&
		fits(resolution.candidate.offset) &&
		(resolution.candidate.kind === 'junction' || strictlyInside);

	const snappedOffset = snapHonored ? resolution.candidate.offset : null;
	return {
		rawPointerOffset: pointerOffset,
		rawOffset,
		rawValid,
		snappedOffset,
		snappedKind:
			snappedOffset === null ? null : resolution.kind === 'snap' ? resolution.candidate.kind : null,
		snappedSourceId:
			snappedOffset === null
				? null
				: resolution.kind === 'snap'
					? resolution.candidate.sourceId
					: null,
		candidateOffset: snappedOffset ?? rawOffset,
		candidateValid: snappedOffset === null ? rawValid : true,
	};
}
