import { layoutItem, layoutLength } from '../kernel/source-collections';
import { countWork } from '../kernel/work-observer';
import type { LayoutGeometryIssue } from '../geometry/types';
import type { LayoutDocumentWallFirst, LayoutWall } from '../wall/types';
import type { WallSamplingDerivation } from '../wall/centerline';
import { wallCenterlineSamples } from '../wall/centerline';
import type { CurveSample } from '../geometry/curve';
import { CURVE_SELF_INTERSECTION_TOLERANCE } from '../geometry/curve';
import type { PlanBox } from '../world/plan-box-index';
import { createPlanBoxIndex } from '../world/plan-box-index';
import { topologyComponentKeyByWallId } from '../room/topology-components';
import type { SampledTopologyWall, TopologySegment } from '../wall/topology';
import {
	sampledWallExtentsOverlap,
	sampledWallSelfIntersects,
	sampledWallsCross,
} from '../wall/topology';
import type { LayoutVec2 } from '../geometry/coordinates';
import {
	chordPolyline,
	sampledPlanBox,
	sharedJunctionIds,
	wallEndpoints,
} from '../precision/document';
import type { WallFirstArchitectureCandidatePair } from '../precision/types';

/**
 * A Wall pair (or one Wall against itself) that only the **sampled**
 * centerlines reveal.
 */
export type WallCurveTopologyCrossing =
	| { kind: 'self'; wallId: string }
	| { kind: 'pair'; wallIds: [string, string]; sharedJunctionId?: string };

/**
 * The canonical **curve-level** Wall-crossing gate.
 *
 * `classifyWallIntersection` is exact for straight Walls but blind to
 * curvature: two Walls whose endpoint chords miss each other can still cross
 * where they bow, and one curved Wall can cross a straight host its chord never
 * reaches. This walks both sampled centerlines through the curve kernel's own
 * polyline predicate (never a second intersection recipe) and reports the first
 * offending Wall or pair, or `undefined` when the document is clear.
 *
 * Shared by `validateWallFirstTopology` and the Wall-chain authoring path,
 * so a chain that would bow across an existing curved Wall — with a clear
 * endpoint chord — rejects before any commit through the same authority. A
 * straight Wall contributes just its two chord endpoints (a straight polyline
 * IS its chord), so a document with no curves pays nothing beyond one record
 * per Wall.
 *
 * THE SUBJECT IS THE CONNECTED COMPONENT: a pair of Walls in different components
 * is skipped BEFORE the sampled predicate runs, so their crossing is permitted
 * geometry rather than a verdict. The predicate, the self scan, the
 * first-crossing-in-`document.walls`-order rule and the reported pair are
 * unchanged; only which pairs are examined.
 *
 * Connectivity is the TRANSITIVE closure of explicit authored Junction identity,
 * never coordinates: two Walls can share a component through a third Wall, and
 * merely coincident endpoints never join anything. Every caller — the canonical
 * gate and the Wall-chain gate alike — gets the component subject.
 */
/**
 * Which candidate the crossing authority evaluates. Absent evaluates every Wall and
 * every same-component pair, exactly as before; a scoped pass names the Walls whose
 * self-intersection and the pairs whose crossing it evaluates, in the canonical gate's own order.
 * The SAMPLING loop is unaffected either way: every Wall is still sampled once per call, so a
 * scoped pass issues exactly the sample requests the canonical one would.
 */
export type WallCurveTopologyCrossingSubject = {
	/** Walls whose self-intersection is evaluated, in document order. */
	wallIds?: readonly string[];
	/** Pairs whose crossing is evaluated, in gate order. */
	pairs?: readonly WallFirstArchitectureCandidatePair[];
};

export function detectWallCurveTopologyCrossings(
	document: LayoutDocumentWallFirst,
	wallSegments: ReadonlyMap<string, TopologySegment>,
	sampling?: WallSamplingDerivation,
	disableExtentPruneForTest?: boolean,
	subject?: WallCurveTopologyCrossingSubject,
	points?: ReadonlyMap<string, LayoutVec2>,
): WallCurveTopologyCrossing | undefined {
	const sampledWalls = new Map<string, SampledTopologyWall>();
	for (const wall of document.walls) {
		const segment = wallSegments.get(wall.id);
		if (!segment) continue;
		let samples: readonly CurveSample[];
		if (wall.centerline.kind === 'line') {
			samples = chordPolyline(segment);
		} else {
			const endpoints = wallEndpoints(document, wall, points);
			const sampled = endpoints
				? sampling
					? sampling.samples(wall, endpoints.start, endpoints.end, 'forward')
					: wallCenterlineSamples(wall, endpoints.start, endpoints.end, 'forward')
				: undefined;
			if (!sampled) continue;
			samples = sampled.samples;
		}
		sampledWalls.set(wall.id, {
			id: wall.id,
			startJunctionId: wall.startJunctionId,
			endJunctionId: wall.endJunctionId,
			samples,
		});
	}
	const selfCandidates = subject?.wallIds
		? subject.wallIds
				.map((wallId) => document.walls.find((wall) => wall.id === wallId))
				.filter((wall): wall is LayoutWall => wall !== undefined)
		: document.walls;
	for (const wall of selfCandidates) {
		if (wall.centerline.kind === 'line') continue;
		const sampled = sampledWalls.get(wall.id);
		if (sampled && sampledWallSelfIntersects(sampled)) {
			return { kind: 'self', wallId: wall.id };
		}
	}
	// Two Walls from different components never reach the sampled
	// predicate. Every pair that does share a Junction id is in one component, so
	// `shared` below can never point at a pair this skips.
	const keyByWallId = topologyComponentKeyByWallId(document);
	const wallById = new Map(document.walls.map((wall) => [wall.id, wall] as const));
	if (subject?.pairs) {
		// The affected pairs of one move, in the canonical gate's own order. The
		// predicate, the component skip and the extent prune are the SAME ones the full loop uses.
		for (const [firstId, secondId] of subject.pairs) {
			const a = wallById.get(firstId);
			const b = wallById.get(secondId);
			if (!a || !b) continue;
			if (keyByWallId.get(a.id) !== keyByWallId.get(b.id)) continue;
			if (a.centerline.kind === 'line' && b.centerline.kind === 'line') continue;
			const sampledA = sampledWalls.get(a.id);
			const sampledB = sampledWalls.get(b.id);
			if (!sampledA || !sampledB) continue;
			if (!disableExtentPruneForTest && !sampledWallExtentsOverlap(sampledA, sampledB)) continue;
			const shared = sharedJunctionIds(a, b)[0];
			if (!sampledWallsCross(sampledA, sampledB, shared)) continue;
			return shared
				? { kind: 'pair', wallIds: [a.id, b.id], sharedJunctionId: shared }
				: { kind: 'pair', wallIds: [a.id, b.id] };
		}
		return undefined;
	}
	// Conservative extent prune: a pair whose swept extents cannot overlap cannot
	// newly cross. The test-only bypass recovers the exhaustive loop with only this
	// gate absent; never set in production.
	if (disableExtentPruneForTest) {
		for (let first = 0; first < layoutLength(document, 'walls'); first += 1) {
			countWork('pairs:wall-wall-curve', layoutLength(document, 'walls') - first - 1);
			for (let second = first + 1; second < layoutLength(document, 'walls'); second += 1) {
				const a = layoutItem(document, 'walls', first)!;
				const b = layoutItem(document, 'walls', second)!;
				if (keyByWallId.get(a.id) !== keyByWallId.get(b.id)) continue;
				// Two straight Walls are already fully decided by the chord gate.
				if (a.centerline.kind === 'line' && b.centerline.kind === 'line') continue;
				const sampledA = sampledWalls.get(a.id);
				const sampledB = sampledWalls.get(b.id);
				if (!sampledA || !sampledB) continue;
				const shared = sharedJunctionIds(a, b)[0];
				if (!sampledWallsCross(sampledA, sampledB, shared)) continue;
				return shared
					? { kind: 'pair', wallIds: [a.id, b.id], sharedJunctionId: shared }
					: { kind: 'pair', wallIds: [a.id, b.id] };
			}
		}
		return undefined;
	}
	// The same prune, made an index query. Every pair whose
	// tolerance-expanded sample boxes overlap is a candidate, in the shipped order;
	// a pair the index omits is one `sampledWallExtentsOverlap` would have
	// rejected anyway, so the verdict, the reporting and the first-wins rule are
	// unchanged. Boxes are computed once per Wall, not once per pair.
	const indexedWalls: LayoutWall[] = [];
	const sampledBoxes: PlanBox[] = [];
	for (const wall of document.walls) {
		const sampled = sampledWalls.get(wall.id);
		if (!sampled) continue;
		indexedWalls.push(wall);
		sampledBoxes.push(sampledPlanBox(sampled.samples, CURVE_SELF_INTERSECTION_TOLERANCE));
	}
	const sampledBoxIndex = createPlanBoxIndex(sampledBoxes);
	for (let first = 0; first < indexedWalls.length; first += 1) {
		const a = indexedWalls[first]!;
		const candidates = sampledBoxIndex.overlaps(sampledBoxes[first]!);
		for (const second of candidates) {
			if (second <= first) continue;
			// Per unique pair, as the nested loop counted it (the query returns a
			// pair from both sides plus a self hit).
			countWork('pairs:wall-wall-curve');
			const b = indexedWalls[second]!;
			if (keyByWallId.get(a.id) !== keyByWallId.get(b.id)) continue;
			// Two straight Walls are already fully decided by the chord gate.
			if (a.centerline.kind === 'line' && b.centerline.kind === 'line') continue;
			const sampledA = sampledWalls.get(a.id)!;
			const sampledB = sampledWalls.get(b.id)!;
			const shared = sharedJunctionIds(a, b)[0];
			if (!sampledWallsCross(sampledA, sampledB, shared)) continue;
			return shared
				? { kind: 'pair', wallIds: [a.id, b.id], sharedJunctionId: shared }
				: { kind: 'pair', wallIds: [a.id, b.id] };
		}
	}
	return undefined;
}

export function topologyFailure(
	firstId: string,
	secondId: string | undefined,
	message: string,
): LayoutGeometryIssue {
	return {
		path: `topology.${firstId}`,
		code: 'unsupported_wall_topology',
		message,
		targetId: secondId ?? firstId,
	};
}
