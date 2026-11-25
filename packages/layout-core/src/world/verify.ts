import type { LayoutVec2 } from '../geometry/coordinates';
import type { CurveSample } from '../geometry/curve';
import { coincidesAsJunction } from '../wall/junction-identity';
import type { WallFirstWallIndex } from '../wall/opening-set';
import { OPENING_SET_EPSILON, validateWallFirstOpeningSubset } from '../wall/opening-set';
import type { PlanBox } from './plan-box-index';
import { expandPlanBox, mergePlanBoxes } from './bvh';
import type { WallSamplingDerivation } from '../wall/centerline';
import type { LayoutDocumentWallFirst, LayoutJunction, LayoutWall } from '../wall/types';
import type { SampledTopologyWall, TopologySegment } from '../wall/topology';
import { classifyWallIntersection, sampledWallExtentsOverlap, sampledWallSelfIntersects, sampledWallsCross } from '../wall/topology';
import { countWork } from '../kernel/work-observer';
import { layoutItem, layoutLength } from '../kernel/source-collections';
import { computeIndexedWallBox, installCertifiedPatch, isValidObjectRecord, isValidVec2, isValidWallRecord, sharedJunctions } from './certified-index';
import type { IndexedOpeningEntry } from './cow';
import { WORLD_INDEX_BY_DOC } from './cow';
import { ID_PATTERN, POINT_EPSILON, SWEPT_INDEX_PAD } from './index-types';
import { ensureLayoutWorldIndex } from './lookups';
import type { EdgeAreaContribution, WalkSummary } from './planar-map';
import { WALK_AREA_GUARD_EPSILON, areaRoundingBound, chordSamples, compareHalfEdgesWithPoints, computeHalfEdgeTwiceAreaContrib, roundingAllowance, sameCyclicHalfEdgeOrder, upperErrorSum } from './planar-map';

// =====================================================================
// Swept-Bounds Geometry Delta Certificate
// =====================================================================

/**
 * Verify a coordinate/centerline candidate derived via COW from `baseline`.
 *
 * Returns `'certified-valid'` ONLY when `baseline` is certified clean AND every
 * structural, topological, planar-rotation-system, Green's-theorem face-area,
 * opening-set, and portal-relation invariant is proven to hold on `candidate`.
 * Returns `'delegate-cold'` on any potential failure or uncertified baseline.
 */
export function verifySweptBoundsGeometryDelta(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
	changedJunctionIds: readonly string[];
	changedWallIds: readonly string[];
	sampling: WallSamplingDerivation;
}): 'certified-valid' | 'delegate-cold' {
	const { baseline, candidate, changedJunctionIds, changedWallIds, sampling } = options;
	const worldIndex = ensureLayoutWorldIndex(baseline);
	if (!worldIndex) return 'delegate-cold';
	// Open Spaces are certified by their composed outline and the placement
	// gate, which this swept-bounds proof knows nothing about. Any changed Wall
	// or Junction on an open boundary therefore delegates to the canonical cold
	// gate instead of being certified incrementally.
	if (changedWallIds.some((id) => worldIndex.openRoomWallIdSet.has(id))) return 'delegate-cold';
	if (changedJunctionIds.some((id) => worldIndex.openRoomJunctionIdSet.has(id))) {
		return 'delegate-cold';
	}
	if (changedWallIds.some((id) => worldIndex.roundRoomWallIdSet.has(id))) return 'delegate-cold';
	if (changedJunctionIds.some((id) => worldIndex.roundRoomJunctionIdSet.has(id))) {
		return 'delegate-cold';
	}

	// Guard against in-place mutation of non-frozen test baselines on touched entities.
	for (const jId of changedJunctionIds) {
		const jIdx = worldIndex.junctionIndexById.get(jId);
		const baseJ = jIdx !== undefined ? layoutItem(baseline, 'junctions', jIdx) : undefined;
		const storedPt = worldIndex.pointById.get(jId);
		if (!baseJ || !storedPt || baseJ.point[0] !== storedPt[0] || baseJ.point[1] !== storedPt[1]) {
			WORLD_INDEX_BY_DOC.delete(baseline);
			return 'delegate-cold';
		}
	}

	// 1. Structural codec verification on changed Junctions and Walls.
	const nextJunctionById = new Map<string, LayoutJunction>();
	for (const jId of changedJunctionIds) {
		const idx = worldIndex.junctionIndexById.get(jId);
		if (idx === undefined) return 'delegate-cold';
		const j = layoutItem(candidate, 'junctions', idx);
		if (!j || j.id !== jId || !isValidVec2(j.point)) return 'delegate-cold';
		nextJunctionById.set(jId, j);
	}

	// Affected walls = union of `changedWallIds` and all walls incident to `changedJunctionIds`.
	const affectedWallIdSet = new Set<string>(changedWallIds);
	for (const jId of changedJunctionIds) {
		const incident = worldIndex.incidentWallIdsByJunctionId.get(jId);
		if (incident) {
			for (const wId of incident) affectedWallIdSet.add(wId);
		}
	}
	const affectedWallIds = [...affectedWallIdSet].sort(
		(a, b) => (worldIndex.wallIndexById.get(a) ?? 0) - (worldIndex.wallIndexById.get(b) ?? 0)
	);

	const nextWallById = new Map<string, LayoutWall>();
	for (const wId of affectedWallIds) {
		const idx = worldIndex.wallIndexById.get(wId);
		if (idx === undefined) return 'delegate-cold';
		const w = layoutItem(candidate, 'walls', idx);
		if (!w || w.id !== wId || !isValidWallRecord(w)) return 'delegate-cold';
		nextWallById.set(wId, w);
	}

	const pointOf = (jId: string): LayoutVec2 | undefined =>
		nextJunctionById.get(jId)?.point ?? worldIndex.pointById.get(jId);
	const wallOf = (wId: string): LayoutWall | undefined =>
		nextWallById.get(wId) ?? worldIndex.wallById.get(wId);

	// 2. Resolve affected Wall segments, check zero-length, sample centerlines & compute swept box.
	const nextSegments = new Map<string, TopologySegment>();
	const nextSampledWalls = new Map<string, SampledTopologyWall>();
	const nextWallBoxes = new Map<string, PlanBox>();
	let sweptBox: PlanBox | null = null;

	for (const jId of changedJunctionIds) {
		const oldPt = worldIndex.pointById.get(jId)!;
		const newPt = nextJunctionById.get(jId)!.point;
		const ptBox = expandPlanBox(
			{
				minX: Math.min(oldPt[0], newPt[0]),
				minZ: Math.min(oldPt[1], newPt[1]),
				maxX: Math.max(oldPt[0], newPt[0]),
				maxZ: Math.max(oldPt[1], newPt[1])
			},
			SWEPT_INDEX_PAD
		);
		sweptBox = sweptBox ? mergePlanBoxes(sweptBox, ptBox) : ptBox;
	}

	for (const wId of affectedWallIds) {
		const wall = nextWallById.get(wId)!;
		countWork('lookup:junctions', 2);
		const start = pointOf(wall.startJunctionId);
		const end = pointOf(wall.endJunctionId);
		if (!start || !end) return 'delegate-cold';
		const len = Math.hypot(end[0] - start[0], end[1] - start[1]);
		if (!(len > POINT_EPSILON)) {
			// Zero-length wall detected — delegate to cold for canonical issue formatting.
			return 'delegate-cold';
		}
		const segment: TopologySegment = { id: wId, start, end };
		nextSegments.set(wId, segment);

		let samples: readonly CurveSample[];
		if (wall.centerline.kind === 'line') {
			samples = chordSamples(segment, len);
		} else {
			const sampled = sampling.samples(wall, start, end, 'forward');
			if (!sampled) return 'delegate-cold';
			samples = sampled.samples;
		}
		const sampledWall: SampledTopologyWall = {
			id: wId,
			startJunctionId: wall.startJunctionId,
			endJunctionId: wall.endJunctionId,
			samples
		};
		if (wall.centerline.kind !== 'line' && sampledWallSelfIntersects(sampledWall)) {
			return 'delegate-cold';
		}
		nextSampledWalls.set(wId, sampledWall);

		const newBox = computeIndexedWallBox(segment, samples);
		nextWallBoxes.set(wId, newBox);
		const wIdx = worldIndex.wallIndexById.get(wId)!;
		const oldBox = worldIndex.wallBvh.boxOf(wIdx);
		const unionWallBox = mergePlanBoxes(oldBox, newBox);
		sweptBox = sweptBox ? mergePlanBoxes(sweptBox, unionWallBox) : unionWallBox;
	}

	// 3. Single unified swept-bounds BVH query (counts `index:node-visit` once).
	const nearbyWallIndices = sweptBox ? worldIndex.wallBvh.overlaps(sweptBox) : [];

	// 4. Component-scoped Junction coincidence in the swept neighborhood.
	if (changedJunctionIds.length > 0) {
		const nearbyJunctionIds = new Set<string>(changedJunctionIds);
		for (let i = 0; i < nearbyWallIndices.length; i += 1) {
			const w = layoutItem(baseline, 'walls', nearbyWallIndices[i]!)!;
			nearbyJunctionIds.add(w.startJunctionId);
			nearbyJunctionIds.add(w.endJunctionId);
		}
		// Include unattached junctions if any moved junction is unattached.
		for (const jId of changedJunctionIds) {
			if ((worldIndex.incidentWallIdsByJunctionId.get(jId)?.length ?? 0) === 0) {
				for (const uId of worldIndex.unattachedJunctionIds) nearbyJunctionIds.add(uId);
				break;
			}
		}
		const movedSet = new Set(changedJunctionIds);
		const nearbyList = [...nearbyJunctionIds];
		for (const movedId of changedJunctionIds) {
			const movedPt = pointOf(movedId)!;
			const movedComp = worldIndex.componentKeyByJunctionId.get(movedId);
			for (let i = 0; i < nearbyList.length; i += 1) {
				const otherId = nearbyList[i]!;
				if (otherId === movedId) continue;
				if (movedSet.has(otherId) && otherId < movedId) continue;
				const otherPt = pointOf(otherId)!;
				if (
					Math.abs(movedPt[0] - otherPt[0]) > SWEPT_INDEX_PAD ||
					Math.abs(movedPt[1] - otherPt[1]) > SWEPT_INDEX_PAD
				) {
					continue;
				}
				countWork('pairs:junction-junction');
				if (worldIndex.componentKeyByJunctionId.get(otherId) !== movedComp) continue;
				countWork('pairs:junction-junction:same-component');
				if (coincidesAsJunction(movedPt, otherPt)) {
					return 'delegate-cold';
				}
			}
		}
	}

	// 5. Component-scoped Wall chord & curve crossings in the swept neighborhood.
	const candidateNeighborWallIds = new Set<string>(affectedWallIds);
	for (let i = 0; i < nearbyWallIndices.length; i += 1) {
		candidateNeighborWallIds.add(layoutItem(baseline, 'walls', nearbyWallIndices[i]!)!.id);
	}
	for (const wAId of affectedWallIds) {
		const wA = wallOf(wAId)!;
		const segA = nextSegments.get(wAId)!;
		const sampA = nextSampledWalls.get(wAId)!;
		const compA = worldIndex.componentKeyByWallId.get(wAId);

		for (const wBId of candidateNeighborWallIds) {
			if (wBId === wAId) continue;
			if (affectedWallIdSet.has(wBId) && wBId < wAId) continue;
			const wB = wallOf(wBId)!;
			const segB =
				nextSegments.get(wBId) ??
				(() => {
					const s = pointOf(wB.startJunctionId)!;
					const e = pointOf(wB.endJunctionId)!;
					return { id: wBId, start: s, end: e };
				})();

			// Chord overlap check (padded by POINT_EPSILON so boundary/near-boundary touches reach `classifyWallIntersection`)
			if (
				Math.max(segA.start[0], segA.end[0]) + POINT_EPSILON >= Math.min(segB.start[0], segB.end[0]) &&
				Math.min(segA.start[0], segA.end[0]) - POINT_EPSILON <= Math.max(segB.start[0], segB.end[0]) &&
				Math.max(segA.start[1], segA.end[1]) + POINT_EPSILON >= Math.min(segB.start[1], segB.end[1]) &&
				Math.min(segA.start[1], segA.end[1]) - POINT_EPSILON <= Math.max(segB.start[1], segB.end[1])
			) {
				countWork('pairs:wall-wall');
				if (worldIndex.componentKeyByWallId.get(wBId) === compA) {
					countWork('pairs:wall-wall:same-component');
					const shared = sharedJunctions(wA, wB);
					const inter = classifyWallIntersection(segA, segB, shared);
					if (inter.kind === 'shared-explicit-junction') {
						const geom = classifyWallIntersection(segA, segB, []);
						const twoWallCurvedLens =
							shared.length === 2 &&
							wA.centerline.kind === 'cubic-chain' &&
							wB.centerline.kind === 'cubic-chain';
						if (geom.kind === 'collinear-overlap' && !twoWallCurvedLens) return 'delegate-cold';
					} else if (inter.kind !== 'none') {
						return 'delegate-cold';
					}
				}
			}

			// Curve crossing check (when at least one Wall is curved)
			if (wA.centerline.kind !== 'line' || wB.centerline.kind !== 'line') {
				const sampB = nextSampledWalls.get(wBId) ?? worldIndex.sampledWallById.get(wBId);
				if (!sampB) return 'delegate-cold';
				if (sampledWallExtentsOverlap(sampA, sampB)) {
					countWork('pairs:wall-wall-curve');
					if (worldIndex.componentKeyByWallId.get(wBId) === compA) {
						const shared = sharedJunctions(wA, wB)[0];
						if (sampledWallsCross(sampA, sampB, shared)) {
							return 'delegate-cold';
						}
					}
				}
			}
		}
	}

	// 6. Planar Combinatorial Map invariance (cyclic star order at 1-hop junctions)
	//    + Green's-theorem boundary-chain differential on affected closed walks.
	const starCheckJunctionIds = new Set<string>();
	for (const jId of changedJunctionIds) {
		if (worldIndex.starOrderByJunctionId.has(jId)) starCheckJunctionIds.add(jId);
	}
	for (const wId of affectedWallIds) {
		if (!worldIndex.faceGraphWallIdSet.has(wId)) continue;
		const w = wallOf(wId)!;
		if (worldIndex.starOrderByJunctionId.has(w.startJunctionId)) {
			starCheckJunctionIds.add(w.startJunctionId);
		}
		if (worldIndex.starOrderByJunctionId.has(w.endJunctionId)) {
			starCheckJunctionIds.add(w.endJunctionId);
		}
	}

	for (const jId of starCheckJunctionIds) {
		const baseStar = worldIndex.starOrderByJunctionId.get(jId);
		if (!baseStar || baseStar.length <= 1) continue;
		const nextStar = [...baseStar].sort((a, b) => compareHalfEdgesWithPoints(pointOf, jId, a, b));
		if (!sameCyclicHalfEdgeOrder(baseStar, nextStar)) {
			return 'delegate-cold';
		}
	}

	const walkDeltaByIndex = new Map<number, { delta: number; error: number; terms: number; magnitude: number }>();
	const nextHalfEdgeContribs = new Map<string, EdgeAreaContribution>();
	for (const wId of affectedWallIds) {
		if (!worldIndex.faceGraphWallIdSet.has(wId)) continue;
		const wall = wallOf(wId)!;
		const start = pointOf(wall.startJunctionId)!;
		const end = pointOf(wall.endJunctionId)!;
		for (const direction of ['forward', 'reverse'] as const) {
			const heKey = `${wId}:${direction}`, link = worldIndex.halfEdgeWalkByKey.get(heKey);
			if (!link) return 'delegate-cold';
			const walk = worldIndex.walks.get(link.walkIndex)!;
			const contribution = computeHalfEdgeTwiceAreaContrib(wall, start, end, direction, sampling);
			if (!contribution || !Number.isFinite(contribution.value)) return 'delegate-cold';
			nextHalfEdgeContribs.set(heKey, contribution);
			const update = walkDeltaByIndex.get(link.walkIndex) ?? { delta: 0, error: 0, terms: walk.termCount, magnitude: walk.magnitude };
			const diff = contribution.value - link.twiceEdgeContrib;
			update.error = upperErrorSum(update.error,
				areaRoundingBound(link.termCount, walk.magnitude),
				areaRoundingBound(contribution.termCount, contribution.magnitude),
				roundingAllowance(contribution.value, link.twiceEdgeContrib), roundingAllowance(update.delta, diff));
			update.delta += diff;
			update.terms += contribution.termCount - link.termCount;
			update.magnitude = Math.max(update.magnitude, contribution.magnitude);
			walkDeltaByIndex.set(link.walkIndex, update);
			countWork('certificate:area-edge-update');
		}
	}
	const nextWalkSummaries = new Map<number, WalkSummary>();
	for (const [index, update] of walkDeltaByIndex) {
		const walk = worldIndex.walks.get(index)!;
		const twiceSignedArea = walk.twiceSignedArea + update.delta;
		const accumulatedError = upperErrorSum(walk.accumulatedError, update.error, roundingAllowance(walk.twiceSignedArea, update.delta));
		// A fresh cold sum has its own rounding order. Certify its sign only
		// when BOTH error intervals exclude zero; otherwise the cold gate decides.
		const guard = upperErrorSum(WALK_AREA_GUARD_EPSILON, accumulatedError, areaRoundingBound(update.terms, update.magnitude));
		if (!Number.isFinite(twiceSignedArea) || !Number.isFinite(guard) || Math.abs(twiceSignedArea) <= guard || (twiceSignedArea > 0) !== walk.wasPositive) return 'delegate-cold';
		nextWalkSummaries.set(index, { twiceSignedArea, wasPositive: walk.wasPositive, termCount: update.terms, magnitude: update.magnitude, accumulatedError });
	}

	// 7. Opening-set fit/height/profile/overlap on affected Walls only.
	const affectedOpeningEntries: IndexedOpeningEntry[] = [];
	for (const wId of affectedWallIds) {
		const entries = worldIndex.openingsByWallId.get(wId);
		if (entries) {
			for (const entry of entries) affectedOpeningEntries.push(entry);
		}
	}
	if (affectedOpeningEntries.length > 0) {
		affectedOpeningEntries.sort((a, b) => a.index - b.index);
		const wallIdxView: WallFirstWallIndex = {
			wallById: {
				get: (id: string) => wallOf(id),
				has: (id: string) => worldIndex.wallById.has(id)
			} as ReadonlyMap<string, LayoutWall>,
			pointById: {
				get: (id: string) => pointOf(id),
				has: (id: string) => worldIndex.pointById.has(id)
			} as ReadonlyMap<string, LayoutVec2>
		};
		const openingIssues = validateWallFirstOpeningSubset(
			candidate,
			affectedOpeningEntries,
			wallIdxView,
			sampling
		);
		if (openingIssues.length > 0) {
			return 'delegate-cold';
		}
	}

	// Install persistent roots now; no pending patch retains a parent document.
	installCertifiedPatch(candidate, {
		parentDoc: baseline,
		changedJunctionIds,
		affectedWallIds,
		changedObjectIds: [],
		nextSampledWalls,
		nextWallBoxes,
		nextWalkSummaries,
		nextHalfEdgeContribs
	});

	return 'certified-valid';
}


/**
 * Verify a non-topological Wall scalar (`wall-thickness`, `wall-height`) or
 * `LayoutObject` (`create`, `transform`, `delete`) COW edit against a certified
 * clean baseline.
 */
export function verifyScalarOrObjectDelta(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
	operation:
		| 'wall-thickness'
		| 'wall-height'
		| 'layout-object-preset-create'
		| 'layout-object-transform'
		| 'layout-object-delete';
	changedWallIds: readonly string[];
	changedObjectIds: readonly string[];
}): 'certified-valid' | 'delegate-cold' {
	const { baseline, candidate, operation, changedWallIds, changedObjectIds } = options;
	const worldIndex = ensureLayoutWorldIndex(baseline);
	if (!worldIndex) return 'delegate-cold';

	if (operation === 'wall-thickness' || operation === 'wall-height') {
		for (const wId of changedWallIds) {
			const idx = worldIndex.wallIndexById.get(wId);
			if (idx === undefined) return 'delegate-cold';
			const w = layoutItem(candidate, 'walls', idx);
			if (!w || !isValidWallRecord(w)) return 'delegate-cold';
			if (operation === 'wall-height') {
				const entries = worldIndex.openingsByWallId.get(wId);
				if (entries && entries.length > 0) {
					for (const { opening } of entries) {
						if (opening.sillHeight + opening.height > w.height + OPENING_SET_EPSILON) {
							return 'delegate-cold';
						}
					}
				}
			}
		}
		installCertifiedPatch(candidate, {
			parentDoc: baseline,
			changedJunctionIds: [],
			affectedWallIds: changedWallIds,
			changedObjectIds: []
		});
		return 'certified-valid';
	}

	// Object operations: verify ID pattern, uniqueness and optional `roomId` reference.
	if (operation === 'layout-object-preset-create') {
		const createdId = changedObjectIds[0];
		if (!createdId || !ID_PATTERN.test(createdId) || worldIndex.objectById.has(createdId)) {
			return 'delegate-cold';
		}
		const obj = layoutItem(candidate, 'objects', layoutLength(candidate, 'objects') - 1);
		if (!obj || obj.id !== createdId || !isValidObjectRecord(obj, worldIndex.roomById)) {
			return 'delegate-cold';
		}
	} else if (operation === 'layout-object-transform') {
		const objId = changedObjectIds[0];
		const idx = objId ? worldIndex.objectIndexById.get(objId) : undefined;
		if (idx === undefined) return 'delegate-cold';
		const obj = layoutItem(candidate, 'objects', idx);
		if (!obj || obj.id !== objId || !isValidObjectRecord(obj, worldIndex.roomById)) {
			return 'delegate-cold';
		}
	}

	installCertifiedPatch(candidate, {
		parentDoc: baseline,
		changedJunctionIds: [],
		affectedWallIds: [],
		changedObjectIds
	});
	return 'certified-valid';
}


/**
 * Verify a rectangular Opening scalar update (`offset`, `width`, `height`,
 * `sillHeight`) on a certified clean baseline without scanning unrelated Walls.
 */
export function verifyOpeningUpdateDelta(options: {
	baseline: LayoutDocumentWallFirst;
	candidate: LayoutDocumentWallFirst;
	openingId: string;
	wallId: string;
}): 'certified-valid' | 'delegate-cold' {
	const { baseline, candidate, openingId, wallId } = options;
	const worldIndex = ensureLayoutWorldIndex(baseline);
	if (!worldIndex) return 'delegate-cold';
	const opIdx = worldIndex.openingIndexById.get(openingId);
	if (opIdx === undefined) return 'delegate-cold';
	const nextOp = layoutItem(candidate, 'openings', opIdx);
	if (
		!nextOp ||
		nextOp.id !== openingId ||
		nextOp.wallId !== wallId ||
		!ID_PATTERN.test(nextOp.id) ||
		!ID_PATTERN.test(nextOp.wallId) ||
		(nextOp.kind !== 'door' && nextOp.kind !== 'window') ||
		!Number.isFinite(nextOp.offset) ||
		nextOp.offset < 0 ||
		!Number.isFinite(nextOp.width) ||
		nextOp.width <= 0 ||
		!Number.isFinite(nextOp.height) ||
		nextOp.height <= 0 ||
		!Number.isFinite(nextOp.sillHeight) ||
		nextOp.sillHeight < 0 ||
		(nextOp.name !== undefined &&
			(typeof nextOp.name !== 'string' || nextOp.name.trim().length === 0)) ||
		(nextOp.profile !== undefined && nextOp.profile !== 'rectangular') ||
		nextOp.connectsRoomIds !== undefined
	) {
		return 'delegate-cold';
	}
	if (!worldIndex.wallById.has(wallId)) return 'delegate-cold';

	const baseWallEntries = worldIndex.openingsByWallId.get(wallId) ?? [];
	const updatedEntries: IndexedOpeningEntry[] = baseWallEntries.map((entry) =>
		entry.index === opIdx ? { opening: nextOp, index: opIdx } : entry
	);
	const subsetIssues = validateWallFirstOpeningSubset(candidate, updatedEntries, {
		wallById: worldIndex.wallById,
		pointById: worldIndex.pointById
	});
	if (subsetIssues.length > 0) return 'delegate-cold';

	installCertifiedPatch(candidate, {
		parentDoc: baseline,
		changedJunctionIds: [],
		affectedWallIds: [],
		changedObjectIds: [],
		changedOpeningWallIds: [wallId]
	});
	return 'certified-valid';
}
