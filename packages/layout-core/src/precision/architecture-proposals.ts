import { p2311Measure } from '../kernel/work-observer';
import { ensureLayoutWorldIndex, exceedsLayoutWallSpan } from '../world/lookups';
import { validateWallFirstOpeningSet, validateWallFirstOpeningSubset } from '../wall/opening-set';
import type { LayoutDocumentWallFirst } from '../wall/types';
import type { LayoutWall } from '../wall/types';
import type { LayoutWallCenterline } from '../wall/types';
import type { LayoutWallCurveKnot } from '../wall/types';
import type { WallSamplingDerivation } from '../wall/centerline';
import { translateWallCenterline, wallCenterlineSamples, wallCubicChain } from '../wall/centerline';
import { guardRoundRoomMemberGeometryEdit } from '../room/round-room';
import { moveWallCurveKnot, resolveWallCurveSplit } from '../wall/curve-algebra';
import type { LayoutVec2 } from '../geometry/coordinates';
import type { ArchitectureCandidatePatch, WallCurveProposeIntent, WallFirstArchitectureProposalIntent, WallFirstArchitectureProposalWall, WallFirstArchitectureVerdictScope } from './types';
import { MAX_WALL_CURVE_KNOTS } from './types';
import { preflightWallFirstArchitectureCandidate } from './architecture-verdict';
import { resolveCurveTarget } from './curve-edits';
import { incidentWallIds, wallEndpoints } from './document';
import { finitePoint } from './rejections';
import { guardRoundRoomIntent } from './scalar-edits';

/**
 * Pure, non-validating curve **proposal**.
 *
 * Runs the canonical chain algebra (`moveWallCurveKnot`, the exact subdivision
 * authority) WITHOUT acceptance and samples the result through the one
 * centerline adapter, so a rejected drag can render the attempted Wall shape
 * transiently. It installs no document, validates nothing and persists nothing:
 * the caller keeps the immutable baseline and draws this only as overlay truth.
 *
 * Returns the attempted centerline plus the endpoints it spans, or `undefined`
 * when the intent cannot even be proposed (unknown Wall or knot, a non-finite
 * point, an out-of-range bend distance, a split that resolves onto an
 * endpoint).
 *
 * It is the single intent→curve mapping: `proposeWallCurveShape` samples what
 * it returns, and `architectureCandidatePatch` below splices it, so the drawn
 * attempt and any preflight can never describe different geometry.
 */
export function resolveProposedCurveChain(
	document: LayoutDocumentWallFirst,
	wallId: string,
	intent: WallCurveProposeIntent
): { start: LayoutVec2; end: LayoutVec2; centerline: LayoutWallCenterline } | undefined {
	const target = resolveCurveTarget(document, wallId, { allowStraight: true });
	if ('plan' in target) return undefined;
	if (guardRoundRoomMemberGeometryEdit(document, { wallIds: [wallId] })) return undefined;
	const { start, end, chain } = target;
	if (intent.kind === 'knot-move') {
		if (!finitePoint(intent.point)) return undefined;
		const moved = moveWallCurveKnot(chain, intent.knotId, intent.point);
		if (moved.kind === 'rejected') return undefined;
		return { start, end, centerline: wallCubicChain(moved.knots, moved.spans) };
	}
	if (!Number.isFinite(intent.distance) || !finitePoint(intent.point)) return undefined;
	const resolution = p2311Measure('proposal-exact-split', () => resolveWallCurveSplit(chain, intent.distance));
	if (resolution.kind === 'rejected') return undefined;
	const { fragments, promotedKnotId, point } = resolution.result;
	if (!promotedKnotId && chain.knots.length >= MAX_WALL_CURVE_KNOTS) return undefined;
	// A preview id is stable and never persisted: an occupancy-derived id here
	// would be a second allocation authority, and a preview is exactly the place
	// where the same grab must produce the same transient shape each frame.
	const knotId = promotedKnotId ?? `${wallId}:knot.preview`;
	const knots = promotedKnotId
		? chain.knots.map((knot) => ({ id: knot.id, point: [knot.point[0], knot.point[1]] as LayoutVec2 }))
		: [
				...fragments.a.knots,
				{ id: knotId, point: [point[0], point[1]] as LayoutVec2 } satisfies LayoutWallCurveKnot,
				...fragments.b.knots
		  ];
	const spans = promotedKnotId ? chain.spans : [...fragments.a.spans, ...fragments.b.spans];
	const moved = p2311Measure('proposal-curve-algebra', () =>
		moveWallCurveKnot({ startPoint: start, endPoint: end, knots, spans }, knotId, intent.point)
	);
	if (moved.kind === 'rejected') return undefined;
	return { start, end, centerline: wallCubicChain(moved.knots, moved.spans) };
}


/**
 * Sample a proposed curve intent through the one canonical Wall
 * adapter, without acceptance. A thin sampler over `resolveProposedCurveChain`,
 * so the drawn attempt and the preflight below can never describe different
 * geometry.
 */
export function proposeWallCurveShape(
	document: LayoutDocumentWallFirst,
	wallId: string,
	intent: WallCurveProposeIntent
): LayoutVec2[] | undefined {
	const target = resolveProposedCurveChain(document, wallId, intent);
	if (!target) return undefined;
	return sampleProposedChain(wallId, target.start, target.end, target.centerline);
}


/**
 * Derive the complete local geometry requested by one direct architecture
 * edit, without validating or installing a candidate document.
 *
 * Junction moves reshape every incident Wall through the moved shared
 * Junction. Rigid Wall moves translate the selected Wall's complete centerline
 * and reshape neighbouring Walls through their moved shared Junctions. Curve
 * controls and Bend reuse the existing curve proposal authority. The result is
 * overlay truth only: callers must keep the canonical baseline installed.
 */export function proposeWallFirstArchitectureGeometry(
	document: LayoutDocumentWallFirst,
	intent: WallFirstArchitectureProposalIntent
): WallFirstArchitectureProposalWall[] | undefined {
	if (guardRoundRoomIntent(document, intent)) return undefined;
	const patch = architectureCandidatePatch(document, intent);
	if (!patch) return undefined;
	const candidate = spliceWallFirstArchitectureCandidate(document, patch);
	return sampleArchitectureProposal(candidate, patch.affectedWallIds);
}


function sampleArchitectureProposal(
	candidate: LayoutDocumentWallFirst,
	wallIds: readonly string[],
	sampling?: WallSamplingDerivation
): WallFirstArchitectureProposalWall[] {
	const proposals: WallFirstArchitectureProposalWall[] = [];
	for (const wallId of wallIds) {
		const wall = candidate.walls.find((entry) => entry.id === wallId);
		const endpoints = wall ? wallEndpoints(candidate, wall) : undefined;
		if (!wall || !endpoints) continue;
		// Straight lines already have their exact render geometry in their endpoints.
		const points = sampling !== undefined && wall.centerline.kind === 'line'
			? [endpoints.start, endpoints.end]
			: (sampling
				? sampling.samples(wall, endpoints.start, endpoints.end, 'forward')
				: wallCenterlineSamples(wall, endpoints.start, endpoints.end, 'forward'))
				?.samples.map((sample) => sample.point);
		if (points !== undefined) proposals.push({ wallId, points });
	}
	return proposals;
}


/** A live Wall drag checks local geometry and Opening fit without reconciling or compiling. */
export function readWallFirstDragProposal(
	document: LayoutDocumentWallFirst,
	intent: Extract<
		WallFirstArchitectureProposalIntent,
		{ kind: 'junction-move' | 'wall-move' | 'curve-control-move' | 'wall-bend' }
	>,
	sampling: WallSamplingDerivation,
	scope: WallFirstArchitectureVerdictScope
): { kind: 'pending'; walls: WallFirstArchitectureProposalWall[] } |
	{ kind: 'refused'; code: string } {
	if (guardRoundRoomIntent(document, intent)) return { kind: 'refused', code: 'round_room_member_locked' };
	const patch = architectureCandidatePatch(document, intent);
	if (!patch) return { kind: 'refused', code: 'unsupported_geometry' };
	const candidate = spliceWallFirstArchitectureCandidate(document, patch);
	if (exceedsLayoutWallSpan(candidate, patch.affectedWallIds)) return { kind: 'refused', code: 'dimension_out_of_range' };
	const failure = preflightWallFirstArchitectureCandidate(document, intent, sampling, scope);
	if (failure) return {
		kind: 'refused',
		code: failure.code === 'unsupported_wall_topology' ? 'topology_invalid' : failure.code
	};
	if (document.openings.length > 0) {
		const index = ensureLayoutWorldIndex(document);
		if (index === undefined) {
			const [issue] = validateWallFirstOpeningSet(candidate, sampling);
			if (issue) return { kind: 'refused', code: issue.code };
		} else {
			const openings = patch.affectedWallIds.flatMap((id) => index.openingsByWallId.get(id) ?? []);
			if (openings.length > 0) {
				const points = new Map<string, LayoutVec2>();
				const walls = new Map<string, LayoutWall>();
				for (const wallId of patch.affectedWallIds) {
					const wallIndex = index.wallIndexById.get(wallId);
					const wall = wallIndex === undefined ? undefined : candidate.walls[wallIndex];
					if (wall === undefined) continue;
					walls.set(wallId, wall);
					for (const id of [wall.startJunctionId, wall.endJunctionId]) {
						const point = patch.junctionPoints.get(id) ?? index.pointById.get(id);
						if (point !== undefined) points.set(id, point);
					}
				}
				const [issue] = validateWallFirstOpeningSubset(
					candidate, openings.sort((a, b) => a.index - b.index), { pointById: points, wallById: walls }, sampling
				);
				if (issue) return { kind: 'refused', code: issue.code };
			}
		}
	}
	return { kind: 'pending', walls: sampleArchitectureProposal(candidate, patch.affectedWallIds, sampling) };
}


export function architectureCandidatePatch(
	document: LayoutDocumentWallFirst,
	intent: WallFirstArchitectureProposalIntent
): ArchitectureCandidatePatch | undefined {
	if (guardRoundRoomIntent(document, intent)) return undefined;
	if (intent.kind === 'curve-control-move') {
		const proposed = resolveProposedCurveChain(document, intent.wallId, {
			kind: 'knot-move',
			knotId: intent.knotId,
			point: intent.point
		});
		if (!proposed) return undefined;
		return {
			junctionPoints: new Map(),
			wallCenterlines: new Map([[intent.wallId, proposed.centerline]]),
			affectedWallIds: [intent.wallId]
		};
	}
	if (intent.kind === 'wall-bend') {
		const proposed = resolveProposedCurveChain(document, intent.wallId, {
			kind: 'bend',
			distance: intent.distance,
			point: intent.point
		});
		if (!proposed) return undefined;
		return {
			junctionPoints: new Map(),
			wallCenterlines: new Map([[intent.wallId, proposed.centerline]]),
			affectedWallIds: [intent.wallId]
		};
	}
	if (!finitePoint(intent.kind === 'junction-move' ? intent.point : intent.delta)) return undefined;

	if (intent.kind === 'junction-move') {
		const junction = document.junctions.find((entry) => entry.id === intent.junctionId);
		if (!junction) return undefined;
		return {
			junctionPoints: new Map([[intent.junctionId, [intent.point[0], intent.point[1]] as LayoutVec2]]),
			// A Junction move leaves every Wall's own anchors alone: a straight Wall
			// follows its shared endpoint, and a curved Wall's anchors are absolute.
			wallCenterlines: new Map(),
			affectedWallIds: incidentWallIds(document, intent.junctionId)
		};
	}
	const wall = document.walls.find((entry) => entry.id === intent.wallId);
	if (!wall) return undefined;
	const changedJunctionIds = [...new Set([wall.startJunctionId, wall.endJunctionId])];
	const junctionPoints = new Map<string, LayoutVec2>();
	for (const junctionId of changedJunctionIds) {
		const junction = document.junctions.find((entry) => entry.id === junctionId);
		if (!junction) continue;
		junctionPoints.set(junctionId, [
			junction.point[0] + intent.delta[0],
			junction.point[1] + intent.delta[1]
		]);
	}
	return {
		junctionPoints,
		// The moved Wall's own curve anchors are absolute document X/Z and receive
		// the identical rigid delta, or the Wall would change SHAPE.
		wallCenterlines: new Map([[wall.id, translateWallCenterline(wall.centerline, intent.delta)]]),
		affectedWallIds: document.walls
			.filter((entry) =>
				changedJunctionIds.some(
					(junctionId) =>
						entry.startJunctionId === junctionId || entry.endJunctionId === junctionId
				)
			)
			.map((entry) => entry.id)
	};
}


/**
 * Apply a patch as a **shallow** splice of the baseline: changed records are
 * replaced, everything else is shared.
 *
 * Sharing is deliberate and safe: the only consumers are the read-only
 * canonical gates below (and the render sampler), which read the document and
 * never write it. The deep clone the planner builds exists because planners
 * hand the candidate on to further mutation — a preflight does not.
 *
 * This is why the affected extent below is sound: a Wall outside the extent keeps
 * the baseline's OWN Junction records and centreline object, so no predicate that
 * reads only those records can change its verdict.
 */
export function spliceWallFirstArchitectureCandidate(
	document: LayoutDocumentWallFirst,
	patch: ArchitectureCandidatePatch
): LayoutDocumentWallFirst {
	return {
		...document,
		junctions: document.junctions.map((junction) => {
			const point = patch.junctionPoints.get(junction.id);
			return point ? { ...junction, point: [point[0], point[1]] as LayoutVec2 } : junction;
		}),
		walls: document.walls.map((wall) => {
			const centerline = patch.wallCenterlines.get(wall.id);
			return centerline ? { ...wall, centerline } : wall;
		})
	};
}


/** Sample an attempted centerline through the one canonical Wall adapter. */
function sampleProposedChain(
	wallId: string,
	start: LayoutVec2,
	end: LayoutVec2,
	centerline: LayoutWallCenterline
): LayoutVec2[] | undefined {
	const sampled = wallCenterlineSamples({ id: wallId, centerline }, start, end, 'forward');
	if (!sampled) return undefined;
	return sampled.samples.map((sample) => [sample.point[0], sample.point[1]] as LayoutVec2);
}
