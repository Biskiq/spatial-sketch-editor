import type { LayoutVec2 } from '../geometry/coordinates';
import type { CurveSample } from '../geometry/curve';
import { CURVE_SELF_INTERSECTION_TOLERANCE } from '../geometry/curve';
import { coincidentJunctionPairs, coincidesAsJunction } from '../wall/junction-identity';
import type { PlanBox } from './plan-box-index';
import { createDynamicBvh } from './bvh';
import {
	topologyComponentKeyByJunctionId,
	topologyComponentKeyByWallId,
} from '../room/topology-components';
import { validateWallFirstLayoutDocument } from '../wall/codec';
import type {
	LayoutDocumentWallFirst,
	LayoutJunction,
	LayoutObject,
	LayoutWall,
	LayoutWallFirstRoom,
} from '../wall/types';
import { validateWallFirstPortalRelations } from '../wall/portals';
import {
	composeSpaceBoundary,
	spaceBoundaryPolygonFromEdges,
} from '../room/reconciliation-boundary';
import {
	isOpenSpace,
	spaceOutlineSelfIntersects,
	spaceOutlineSignedArea,
	spacePlacementIssues,
} from '../room/space-placement';
import type { SampledTopologyWall, TopologySegment } from '../wall/topology';
import {
	classifyWallIntersection,
	sampledWallExtentsOverlap,
	sampledWallSelfIntersects,
	sampledWallsCross,
} from '../wall/topology';
import { countWork } from '../kernel/work-observer';
import { PersistentMap, PersistentVector } from '../kernel/persistent-store';
import {
	layoutCollectionRef,
	layoutItem,
	layoutLength,
	mappedReadonlyMap,
	seedLayoutVectors,
} from '../kernel/source-collections';
import type { IndexedOpeningEntry } from './cow';
import { WORLD_INDEX_BY_DOC } from './cow';
import type { CertifiedWorldPatch, DocumentWorldIndex } from './index-types';
import { ID_PATTERN, POINT_EPSILON, SWEPT_INDEX_PAD } from './index-types';
import { ensureLayoutWorldIndex } from './lookups';
import {
	buildPlanarCombinatorialMap,
	certifyOpeningsQuietly,
	chordSamples,
	sampleSegmentQuietly,
} from './planar-map';

// =====================================================================
// Certified World-Index Construction & Incremental Patch Materialization
// =====================================================================

export function buildCertifiedWorldIndex(
	document: LayoutDocumentWallFirst,
): DocumentWorldIndex | undefined {
	// 1. Complete structural validation (with lazy canonicalJson getter — zero stringify).
	const structural = validateWallFirstLayoutDocument(document);
	if (!structural.success) return undefined;

	const junctionById = new Map<string, LayoutJunction>();
	const junctionIndexById = new Map<string, number>();
	const pointById = new Map<string, LayoutVec2>();
	for (let i = 0; i < layoutLength(document, 'junctions'); i += 1) {
		const j = layoutItem(document, 'junctions', i)!;
		junctionById.set(j.id, j);
		junctionIndexById.set(j.id, i);
		pointById.set(j.id, j.point);
	}

	const wallById = new Map<string, LayoutWall>();
	const wallIndexById = new Map<string, number>();
	const incidentMutable = new Map<string, string[]>();
	for (let i = 0; i < layoutLength(document, 'walls'); i += 1) {
		const w = layoutItem(document, 'walls', i)!;
		wallById.set(w.id, w);
		wallIndexById.set(w.id, i);
		let sList = incidentMutable.get(w.startJunctionId);
		if (!sList) {
			sList = [];
			incidentMutable.set(w.startJunctionId, sList);
		}
		sList.push(w.id);
		if (w.endJunctionId !== w.startJunctionId) {
			let eList = incidentMutable.get(w.endJunctionId);
			if (!eList) {
				eList = [];
				incidentMutable.set(w.endJunctionId, eList);
			}
			eList.push(w.id);
		}
	}

	const unattachedJunctionIds: string[] = [];
	for (let i = 0; i < layoutLength(document, 'junctions'); i += 1) {
		const jId = layoutItem(document, 'junctions', i)!.id;
		if (!incidentMutable.has(jId)) {
			unattachedJunctionIds.push(jId);
		}
	}

	const roomById = new Map<string, LayoutWallFirstRoom>();
	const roomIndexById = new Map<string, number>();
	const roomsByWallMutable = new Map<string, string[]>();
	const openRoomWallIdSet = new Set<string>();
	const openRoomJunctionIdSet = new Set<string>();
	const roundRoomWallIdSet = new Set<string>();
	const roundRoomJunctionIdSet = new Set<string>();
	for (let i = 0; i < layoutLength(document, 'rooms'); i += 1) {
		const r = layoutItem(document, 'rooms', i)!;
		// Enclosed one-Wall Rooms keep their preexisting certification behaviour:
		// this guard is deliberately unchanged for a closed Space. An open Space
		// is certified by its composed outline instead, which the checks below
		// require to have at least three vertices.
		if (r.virtualEdges.length === 0 && r.boundary.length < 2) return undefined;
		roomById.set(r.id, r);
		roomIndexById.set(r.id, i);
		let prevEnd: string | undefined;
		let firstStart: string | undefined;
		const seenOnRoom = new Set<string>();
		for (let b = 0; b < r.boundary.length; b += 1) {
			const ref = r.boundary[b]!;
			const w = wallById.get(ref.wallId);
			if (!w) return undefined;
			const s = ref.direction === 'forward' ? w.startJunctionId : w.endJunctionId;
			const e = ref.direction === 'forward' ? w.endJunctionId : w.startJunctionId;
			if (b === 0) firstStart = s;
			// Enclosed Spaces chain Wall-to-Wall. An open Space's gaps are the
			// composer's job, not a reason to reject it here.
			if (r.virtualEdges.length === 0 && prevEnd !== undefined && prevEnd !== s) return undefined;
			prevEnd = e;
			if (!seenOnRoom.has(ref.wallId)) {
				seenOnRoom.add(ref.wallId);
				const list = roomsByWallMutable.get(ref.wallId);
				if (list) list.push(r.id);
				else roomsByWallMutable.set(ref.wallId, [r.id]);
			}
		}
		if (r.virtualEdges.length === 0 && prevEnd !== firstStart) return undefined;
		if (r.round !== undefined) {
			for (const ref of r.boundary) {
				roundRoomWallIdSet.add(ref.wallId);
				const wall = wallById.get(ref.wallId);
				if (wall) {
					roundRoomJunctionIdSet.add(wall.startJunctionId);
					roundRoomJunctionIdSet.add(wall.endJunctionId);
				}
			}
		}
		if (!isOpenSpace(r)) continue;
		// I4/I5 — an open Space is certified by its composed outline, never by a
		// Wall face. The composer proves one closed cycle that consumes every
		// virtual edge; this certifier proves positive simple area.
		const composed = composeSpaceBoundary(document, r);
		if (composed.kind === 'failed') return undefined;
		const outline = spaceBoundaryPolygonFromEdges(composed.edges, document);
		if (!outline) return undefined;
		const signedArea = spaceOutlineSignedArea(outline);
		if (!Number.isFinite(signedArea) || signedArea <= POINT_EPSILON) return undefined;
		if (spaceOutlineSelfIntersects(outline)) return undefined;
		for (const edge of r.virtualEdges) {
			const start = pointById.get(edge.startJunctionId);
			const end = pointById.get(edge.endJunctionId);
			if (!start || !end) return undefined;
			if (!(Math.hypot(end[0] - start[0], end[1] - start[1]) > POINT_EPSILON)) return undefined;
			openRoomJunctionIdSet.add(edge.startJunctionId);
			openRoomJunctionIdSet.add(edge.endJunctionId);
		}
		for (const ref of r.boundary) {
			openRoomWallIdSet.add(ref.wallId);
			const wall = wallById.get(ref.wallId)!;
			openRoomJunctionIdSet.add(wall.startJunctionId);
			openRoomJunctionIdSet.add(wall.endJunctionId);
		}
	}
	// I7 — the one placement gate, shared with the compiler.
	if (spacePlacementIssues(document).length > 0) return undefined;

	const openingsByWallMutable = new Map<string, IndexedOpeningEntry[]>();
	const openingIndexById = new Map<string, number>();
	for (let i = 0; i < layoutLength(document, 'openings'); i += 1) {
		const opening = layoutItem(document, 'openings', i)!;
		openingIndexById.set(opening.id, i);
		const list = openingsByWallMutable.get(opening.wallId);
		if (list) list.push({ opening, index: i });
		else openingsByWallMutable.set(opening.wallId, [{ opening, index: i }]);
	}

	const objectById = new Map<string, LayoutObject>();
	const objectIndexById = new Map<string, number>();
	for (let i = 0; i < layoutLength(document, 'objects'); i += 1) {
		const obj = layoutItem(document, 'objects', i)!;
		objectById.set(obj.id, obj);
		objectIndexById.set(obj.id, i);
	}

	const componentKeyByJunctionId = topologyComponentKeyByJunctionId(document);
	const componentKeyByWallId = topologyComponentKeyByWallId(document);

	// 2. Certify baseline Junction coincidence cleanly (silent — index build).
	const candidateJuncPairs = coincidentJunctionPairs(document.junctions);
	for (let i = 0; i < candidateJuncPairs.length; i += 1) {
		const [aIdx, bIdx] = candidateJuncPairs[i]!;
		const a = layoutItem(document, 'junctions', aIdx)!;
		const b = layoutItem(document, 'junctions', bIdx)!;
		if (componentKeyByJunctionId.get(a.id) !== componentKeyByJunctionId.get(b.id)) continue;
		if (coincidesAsJunction(a.point, b.point)) return undefined;
	}

	// 3. Resolve all Wall segments, sampled centerlines & build BVH8.
	const wallSegments = new Map<string, TopologySegment>();
	const sampledWallById = new Map<string, SampledTopologyWall>();
	const wallBoxes: PlanBox[] = new Array<PlanBox>(layoutLength(document, 'walls'));

	for (let i = 0; i < layoutLength(document, 'walls'); i += 1) {
		const w = layoutItem(document, 'walls', i)!;
		const start = pointById.get(w.startJunctionId);
		const end = pointById.get(w.endJunctionId);
		if (!start || !end) return undefined;
		const len = Math.hypot(end[0] - start[0], end[1] - start[1]);
		if (!(len > POINT_EPSILON)) return undefined;
		const seg: TopologySegment = { id: w.id, start, end };
		wallSegments.set(w.id, seg);

		let samples: readonly CurveSample[];
		if (w.centerline.kind === 'line') {
			samples = chordSamples(seg, len);
		} else {
			const sampled = sampleSegmentQuietly(w, start, end, 'forward');
			if (!sampled) return undefined;
			samples = sampled.samples;
		}
		const sampledWall: SampledTopologyWall = {
			id: w.id,
			startJunctionId: w.startJunctionId,
			endJunctionId: w.endJunctionId,
			samples,
		};
		if (w.centerline.kind !== 'line' && sampledWallSelfIntersects(sampledWall)) {
			return undefined;
		}
		sampledWallById.set(w.id, sampledWall);
		wallBoxes[i] = computeIndexedWallBox(seg, samples);
	}

	const wallBvh = createDynamicBvh(wallBoxes);

	// 4. Certify baseline Wall chord & curve crossings via `wallBvh` (`countVisits: false`).
	for (let first = 0; first < layoutLength(document, 'walls'); first += 1) {
		const wA = layoutItem(document, 'walls', first)!;
		const segA = wallSegments.get(wA.id)!;
		const sampA = sampledWallById.get(wA.id)!;
		const compA = componentKeyByWallId.get(wA.id);
		const candidates = wallBvh.overlaps(wallBoxes[first]!, { countVisits: false });
		for (let c = 0; c < candidates.length; c += 1) {
			const second = candidates[c]!;
			if (second <= first) continue;
			const wB = layoutItem(document, 'walls', second)!;
			if (componentKeyByWallId.get(wB.id) !== compA) continue;
			const segB = wallSegments.get(wB.id)!;
			const shared = sharedJunctions(wA, wB);
			const inter = classifyWallIntersection(segA, segB, shared);
			if (inter.kind === 'shared-explicit-junction') {
				const twoWallCurvedLens =
					shared.length === 2 &&
					wA.centerline.kind === 'cubic-chain' &&
					wB.centerline.kind === 'cubic-chain';
				if (
					!twoWallCurvedLens &&
					classifyWallIntersection(segA, segB, []).kind === 'collinear-overlap'
				) {
					return undefined;
				}
			} else if (inter.kind !== 'none') {
				return undefined;
			}
			if (wA.centerline.kind !== 'line' || wB.centerline.kind !== 'line') {
				const sampB = sampledWallById.get(wB.id)!;
				if (sampledWallExtentsOverlap(sampA, sampB) && sampledWallsCross(sampA, sampB, shared[0])) {
					return undefined;
				}
			}
		}
	}

	// 5. Certify planar combinatorial map, exact 1-to-1 Room face correspondence
	//    and canonical `room.boundary` element equality.
	const mapInfo = buildPlanarCombinatorialMap(document, pointById, wallById);
	if (!mapInfo) return undefined;

	// 6. Certify Opening set and Portal relations on baseline.
	if (layoutLength(document, 'openings') > 0) {
		if (!certifyOpeningsQuietly(document, wallById, pointById)) return undefined;
		if (validateWallFirstPortalRelations(document).length > 0) return undefined;
	}

	const openingIndicesByWallId = new Map<string, readonly number[]>();
	for (const [id, entries] of openingsByWallMutable)
		openingIndicesByWallId.set(
			id,
			entries.map((entry) => entry.index),
		);
	seedLayoutVectors(document);
	return {
		junctionsRef: layoutCollectionRef(document, 'junctions'),
		wallsRef: layoutCollectionRef(document, 'walls'),
		roomsRef: layoutCollectionRef(document, 'rooms'),
		openingsRef: layoutCollectionRef(document, 'openings'),
		objectsRef: layoutCollectionRef(document, 'objects'),
		...sourceRecordViews(document, {
			junctionIndexById,
			wallIndexById,
			objectIndexById,
			openingIndicesByWallId,
		}),
		junctionIndexById,
		wallIndexById,
		roomById,
		roomIndexById,
		objectIndexById: PersistentMap.from(objectIndexById),
		openingIndexById: PersistentMap.from(openingIndexById),
		incidentWallIdsByJunctionId: incidentMutable,
		roomsByWallId: roomsByWallMutable,
		openRoomWallIdSet,
		openRoomJunctionIdSet,
		roundRoomWallIdSet,
		roundRoomJunctionIdSet,
		openingIndicesByWallId,
		componentKeyByJunctionId,
		componentKeyByWallId,
		unattachedJunctionIds,
		wallBvh,
		sampledWallById: PersistentMap.from(sampledWallById),
		faceGraphWallIdSet: mapInfo.faceGraphWallIdSet,
		starOrderByJunctionId: mapInfo.starOrderByJunctionId,
		walks: PersistentVector.from(mapInfo.walks),
		halfEdgeWalkByKey: PersistentMap.from(mapInfo.halfEdgeWalkByKey),
	};
}

function forkPersistent<K extends string | number, V>(
	source: ReadonlyMap<K, V>,
): PersistentMap<K, V> {
	return source instanceof PersistentMap ? source.fork() : PersistentMap.from(source);
}

export function installCertifiedPatch(
	document: LayoutDocumentWallFirst,
	patch: CertifiedWorldPatch,
): void {
	const parent = ensureLayoutWorldIndex(patch.parentDoc);
	const index = parent ? materializePatchedWorldIndex(parent, document, patch) : undefined;
	if (index) WORLD_INDEX_BY_DOC.set(document, index);
}

export function sourceRecordViews(
	document: LayoutDocumentWallFirst,
	indexes: Pick<
		DocumentWorldIndex,
		'junctionIndexById' | 'wallIndexById' | 'objectIndexById' | 'openingIndicesByWallId'
	>,
) {
	const { junctionIndexById, wallIndexById, objectIndexById, openingIndicesByWallId } = indexes;
	return {
		junctionById: mappedReadonlyMap(
			junctionIndexById,
			(index) => layoutItem(document, 'junctions', index)!,
		),
		pointById: mappedReadonlyMap(
			junctionIndexById,
			(index) => layoutItem(document, 'junctions', index)!.point,
		),
		wallById: mappedReadonlyMap(wallIndexById, (index) => layoutItem(document, 'walls', index)!),
		objectById: mappedReadonlyMap(
			objectIndexById,
			(index) => layoutItem(document, 'objects', index)!,
		),
		openingsByWallId: mappedReadonlyMap(openingIndicesByWallId, (indices) =>
			indices.map((index) => ({ index, opening: layoutItem(document, 'openings', index)! })),
		),
	};
}

function materializePatchedWorldIndex(
	prev: DocumentWorldIndex,
	document: LayoutDocumentWallFirst,
	patch: CertifiedWorldPatch,
): DocumentWorldIndex | undefined {
	const sampledWallById = forkPersistent(prev.sampledWallById);
	const wallBvh =
		patch.nextWallBoxes && patch.nextWallBoxes.size > 0 ? prev.wallBvh.clone() : prev.wallBvh;
	for (const wId of patch.affectedWallIds) {
		const idx = prev.wallIndexById.get(wId);
		if (idx === undefined) return undefined;

		const nextSamp = patch.nextSampledWalls?.get(wId);
		if (nextSamp) sampledWallById.set(wId, nextSamp);
		const nextBox = patch.nextWallBoxes?.get(wId);
		if (nextBox) wallBvh.update(idx, nextBox);
	}

	let objectIndexById = prev.objectIndexById;
	if (layoutLength(document, 'objects') !== prev.objectsRef.length) {
		countWork('index:global-object-reindex', layoutLength(document, 'objects'));
		const nextIndex = new Map<string, number>();
		for (let i = 0; i < layoutLength(document, 'objects'); i += 1)
			nextIndex.set(layoutItem(document, 'objects', i)!.id, i);
		objectIndexById = nextIndex;
	}

	let walks = prev.walks;
	if (patch.nextWalkSummaries)
		for (const [index, summary] of patch.nextWalkSummaries) walks = walks.set(index, summary);

	let halfEdgeWalkByKey = prev.halfEdgeWalkByKey;
	if (patch.nextHalfEdgeContribs && patch.nextHalfEdgeContribs.size > 0) {
		const copy = forkPersistent(prev.halfEdgeWalkByKey);
		for (const [heKey, contrib] of patch.nextHalfEdgeContribs) {
			const old = copy.get(heKey)!;
			copy.set(heKey, {
				walkIndex: old.walkIndex,
				twiceEdgeContrib: contrib.value,
				termCount: contrib.termCount,
			});
		}
		halfEdgeWalkByKey = copy;
	}

	return {
		...prev,
		...sourceRecordViews(document, { ...prev, objectIndexById }),
		junctionsRef: layoutCollectionRef(document, 'junctions'),
		wallsRef: layoutCollectionRef(document, 'walls'),
		roomsRef: layoutCollectionRef(document, 'rooms'),
		openingsRef: layoutCollectionRef(document, 'openings'),
		objectsRef: layoutCollectionRef(document, 'objects'),
		objectIndexById,
		wallBvh,
		sampledWallById,
		walks,
		halfEdgeWalkByKey,
	};
}

export function computeIndexedWallBox(
	segment: TopologySegment,
	samples: readonly CurveSample[],
): PlanBox {
	let minX = Math.min(segment.start[0], segment.end[0]);
	let minZ = Math.min(segment.start[1], segment.end[1]);
	let maxX = Math.max(segment.start[0], segment.end[0]);
	let maxZ = Math.max(segment.start[1], segment.end[1]);
	for (let i = 0; i < samples.length; i += 1) {
		const pt = samples[i]!.point;
		if (pt[0] < minX) minX = pt[0];
		if (pt[1] < minZ) minZ = pt[1];
		if (pt[0] > maxX) maxX = pt[0];
		if (pt[1] > maxZ) maxZ = pt[1];
	}
	const pad = Math.max(SWEPT_INDEX_PAD, CURVE_SELF_INTERSECTION_TOLERANCE);
	return { minX: minX - pad, minZ: minZ - pad, maxX: maxX + pad, maxZ: maxZ + pad };
}

export function sharedJunctions(a: LayoutWall, b: LayoutWall): string[] {
	const shared: string[] = [];
	if (a.startJunctionId === b.startJunctionId || a.startJunctionId === b.endJunctionId) {
		shared.push(a.startJunctionId);
	}
	if (
		a.endJunctionId !== a.startJunctionId &&
		(a.endJunctionId === b.startJunctionId || a.endJunctionId === b.endJunctionId)
	) {
		shared.push(a.endJunctionId);
	}
	return shared;
}

export function isValidVec2(value: readonly number[]): value is LayoutVec2 {
	return (
		Array.isArray(value) &&
		value.length === 2 &&
		typeof value[0] === 'number' &&
		Number.isFinite(value[0]) &&
		typeof value[1] === 'number' &&
		Number.isFinite(value[1])
	);
}

export function isValidWallRecord(wall: LayoutWall): boolean {
	if (!ID_PATTERN.test(wall.id)) return false;
	if (!ID_PATTERN.test(wall.startJunctionId) || !ID_PATTERN.test(wall.endJunctionId)) return false;
	if (wall.startJunctionId === wall.endJunctionId) return false;
	if (
		typeof wall.thickness !== 'number' ||
		!Number.isFinite(wall.thickness) ||
		wall.thickness <= 0
	) {
		return false;
	}
	if (typeof wall.height !== 'number' || !Number.isFinite(wall.height) || wall.height <= 0) {
		return false;
	}
	if (wall.name !== undefined && (typeof wall.name !== 'string' || wall.name.trim().length === 0)) {
		return false;
	}
	const cl = wall.centerline;
	if (cl.kind === 'line') return true;
	if (cl.kind !== 'cubic-chain') return false;
	if (cl.spans.length !== cl.knots.length + 1) return false;
	const seenKnotIds = new Set<string>();
	for (let i = 0; i < cl.knots.length; i += 1) {
		const knot = cl.knots[i]!;
		if (!ID_PATTERN.test(knot.id) || seenKnotIds.has(knot.id) || !isValidVec2(knot.point)) {
			return false;
		}
		seenKnotIds.add(knot.id);
	}
	for (let i = 0; i < cl.spans.length; i += 1) {
		const span = cl.spans[i]!;
		if (!isValidVec2(span.handleOut) || !isValidVec2(span.handleIn)) return false;
	}
	return true;
}

export function isValidObjectRecord(
	obj: LayoutObject,
	roomById: ReadonlyMap<string, LayoutWallFirstRoom>,
): boolean {
	if (!ID_PATTERN.test(obj.id)) return false;
	if (
		obj.position.length !== 3 ||
		!obj.position.every((n) => typeof n === 'number' && Number.isFinite(n))
	) {
		return false;
	}
	if (
		obj.rotation.length !== 3 ||
		!obj.rotation.every((n) => typeof n === 'number' && Number.isFinite(n))
	) {
		return false;
	}
	if (
		obj.dimensions.length !== 3 ||
		!obj.dimensions.every((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)
	) {
		return false;
	}
	if (obj.roomId !== undefined && !roomById.has(obj.roomId)) return false;
	return true;
}
