import type { LayoutVec2 } from '../geometry/coordinates';
import { hasSampleSegmentObserverForTest } from '../geometry/curve';
import { hasFaceSamplingObserverForTest } from '../geometry/face-extraction';
import { hasWallSamplingObserverForTest } from '../wall/centerline';
import { exceedsLayoutDimension, layoutWallSpanMeters } from '../geometry/limits';
import type { LayoutDerivedWallRole, LayoutDocumentWallFirst, LayoutJunction, LayoutObject, LayoutWall, LayoutWallOpening } from '../wall/types';
import { layoutCollectionRef, layoutItem, layoutLength } from '../kernel/source-collections';
import { buildCertifiedWorldIndex } from './certified-index';
import { WORLD_INDEX_BY_DOC, getCowDocumentDelta, matchesArrayRefs } from './cow';
import type { DocumentWorldIndex } from './index-types';

/** Peek an already-materialized clean world index without triggering a build. */
export function peekLayoutWorldIndex(
	document: LayoutDocumentWallFirst
): DocumentWorldIndex | undefined {
	const existing = WORLD_INDEX_BY_DOC.get(document);
	if (!existing || existing === 'invalid') return undefined;
	if (!matchesArrayRefs(document, existing)) return undefined;
	return existing;
}


function peekOrParentWorldIndex(document: LayoutDocumentWallFirst): DocumentWorldIndex | undefined {
	const direct = peekLayoutWorldIndex(document);
	if (direct) return direct;
	const cow = getCowDocumentDelta(document);
	if (cow) {
		const baseIdx = peekLayoutWorldIndex(cow.baseline);
		if (baseIdx) return baseIdx;
	}
	return undefined;
}


/**
 * Ensure `document` has a certified-clean `DocumentWorldIndex`, returning
 * `undefined` if `document` fails any canonical baseline invariant (so callers
 * fall back to the exact cold gate).
 *
 * Invalidation is by **collection identity** (`matchesArrayRefs`), not by
 * content: an in-place write to an already-indexed array is invisible here, and
 * a cached index would then answer from the old values. That is sound only
 * because authored documents are immutable once indexed — COW candidates
 * replace a collection root through `withLayoutVectors`, and a Svelte `$state`
 * proxy is copied by `PersistentVector.from` (it is never frozen), not indexed.
 */
export function ensureLayoutWorldIndex(
	document: LayoutDocumentWallFirst
): DocumentWorldIndex | undefined {
	const cached = WORLD_INDEX_BY_DOC.get(document);
	if (cached === 'invalid') return undefined;
	if (cached !== undefined && matchesArrayRefs(document, cached)) {
		return cached;
	}


	const built = buildCertifiedWorldIndex(document);
	WORLD_INDEX_BY_DOC.set(document, built ?? 'invalid');
	return built;
}


/** Wall lookup through the ID directory and persistent source root: O(log N), with a linear unindexed fallback. */
export function lookupIndexedWall(
	document: LayoutDocumentWallFirst,
	wallId: string
): LayoutWall | undefined {
	const idx = peekOrParentWorldIndex(document);
	if (idx && idx.wallsRef.length === layoutLength(document, 'walls')) {
		const wIdx = idx.wallIndexById.get(wallId);
		if (wIdx === undefined) return undefined;
		const cand = layoutItem(document, 'walls', wIdx);
		if (cand && cand.id === wallId) return cand;
	}
	return document.walls.find((entry) => entry.id === wallId);
}


/** Junction lookup through the ID directory and persistent source root: O(log N), with a linear unindexed fallback. */
export function lookupIndexedJunction(
	document: LayoutDocumentWallFirst,
	junctionId: string
): LayoutJunction | undefined {
	const idx = peekOrParentWorldIndex(document);
	if (idx && idx.junctionsRef.length === layoutLength(document, 'junctions')) {
		const jIdx = idx.junctionIndexById.get(junctionId);
		if (jIdx === undefined) return undefined;
		const cand = layoutItem(document, 'junctions', jIdx);
		if (cand && cand.id === junctionId) return cand;
	}
	return document.junctions.find((entry) => entry.id === junctionId);
}


/** Opening lookup through the ID directory and persistent source root: O(log N), with a linear unindexed fallback. */
export function lookupIndexedOpening(
	document: LayoutDocumentWallFirst,
	openingId: string
): LayoutWallOpening | undefined {
	const idx = peekOrParentWorldIndex(document);
	if (idx && idx.openingsRef.length === layoutLength(document, 'openings')) {
		const oIdx = idx.openingIndexById.get(openingId);
		if (oIdx === undefined) return undefined;
		const cand = layoutItem(document, 'openings', oIdx);
		if (cand && cand.id === openingId) return cand;
	}
	return document.openings.find((entry) => entry.id === openingId);
}


/** Object lookup through the ID directory and persistent source root: O(log N), with a linear unindexed fallback. */
export function lookupIndexedObject(
	document: LayoutDocumentWallFirst,
	objectId: string
): LayoutObject | undefined {
	const idx = peekOrParentWorldIndex(document);
	if (idx && idx.objectsRef.length === layoutLength(document, 'objects')) {
		const oIdx = idx.objectIndexById.get(objectId);
		if (oIdx === undefined) return undefined;
		const cand = layoutItem(document, 'objects', oIdx);
		if (cand && cand.id === objectId) return cand;
	}
	return document.objects.find((entry) => entry.id === objectId);
}


/**
 * Incident Wall lookup in authored order: O(d log N + d log d) for degree d
 * (or COW-derived with unchanged topology); returns `undefined` when unindexed so
 * callers can fall back to scanning `layoutCollectionRef(document, 'walls')`.
 */
export function lookupIncidentWallsOrdered(
	document: LayoutDocumentWallFirst,
	junctionIds: readonly string[]
): readonly LayoutWall[] | undefined {
	const idx = peekOrParentWorldIndex(document);
	if (!idx || idx.wallsRef.length !== layoutLength(document, 'walls')) return undefined;
	if (junctionIds.length === 0) return [];
	const wallIndices = new Set<number>();
	for (let i = 0; i < junctionIds.length; i += 1) {
		const incident = idx.incidentWallIdsByJunctionId.get(junctionIds[i]!);
		if (!incident) continue;
		for (let w = 0; w < incident.length; w += 1) {
			const wId = incident[w]!;
			const wIdx = idx.wallIndexById.get(wId);
			if (wIdx === undefined || layoutItem(document, 'walls', wIdx)?.id !== wId) return undefined;
			wallIndices.add(wIdx);
		}
	}
	const sortedIndices = [...wallIndices].sort((a, b) => a - b);
	return sortedIndices.map((wIdx) => layoutItem(document, 'walls', wIdx)!);
}


/**
 * Derive a Wall's format-6 role in O(1) when `document` has an active world
 * index (or COW parent with unchanged Rooms), falling back to `undefined` when
 * unindexed so callers can run the cold scan.
 */
export function deriveIndexedWallRole(
	document: LayoutDocumentWallFirst,
	wallId: string
): LayoutDerivedWallRole | 'missing-wall' | undefined {
	let idx = peekLayoutWorldIndex(document);
	if (!idx) {
		const cow = getCowDocumentDelta(document);
		if (cow && cow.changedRoomIds.length === 0 && layoutCollectionRef(cow.baseline, 'rooms') === layoutCollectionRef(document, 'rooms')) {
			idx = peekLayoutWorldIndex(cow.baseline);
		}
	}

	if (!idx) return undefined;
	if (!idx.wallById.has(wallId)) return 'missing-wall';
	const count = idx.roomsByWallId.get(wallId)?.length ?? 0;
	return count === 0 ? 'free-standing' : count === 1 ? 'bounding' : 'dividing';
}


/**
 * True when any named Wall's authored span is outside the supported envelope.
 *
 * Uses the indexed Wall/Junction lookups so a COW candidate answers from its
 * persistent roots: a precision plan must not materialize a whole collection
 * just to check one changed Wall.
 */
export function exceedsLayoutWallSpan(
	document: LayoutDocumentWallFirst,
	wallIds: readonly string[]
): boolean {
	for (const wallId of wallIds) {
		const wall = lookupIndexedWall(document, wallId);
		if (wall === undefined) continue;
		const start = lookupIndexedJunction(document, wall.startJunctionId);
		const end = lookupIndexedJunction(document, wall.endJunctionId);
		if (start === undefined || end === undefined) continue;
		const pointById = new Map([
			[start.id, start.point],
			[end.id, end.point]
		]);
		const span = layoutWallSpanMeters(wall, pointById);
		if (span !== null && exceedsLayoutDimension(span)) return true;
	}
	return false;
}


/**
 * True when moving one Junction to `point` would stretch any incident Wall
 * outside the supported envelope. Reads the incident Walls through the index so
 * an uncommitted Card edit never materializes a collection.
 */
export function exceedsLayoutWallSpanAfterJunctionMove(
	document: LayoutDocumentWallFirst,
	junctionId: string,
	point: LayoutVec2
): boolean {
	const walls =
		lookupIncidentWallsOrdered(document, [junctionId]) ??
		document.walls.filter(
			(wall) => wall.startJunctionId === junctionId || wall.endJunctionId === junctionId
		);
	for (const wall of walls) {
		const startPoint =
			wall.startJunctionId === junctionId
				? point
				: lookupIndexedJunction(document, wall.startJunctionId)?.point;
		const endPoint =
			wall.endJunctionId === junctionId
				? point
				: lookupIndexedJunction(document, wall.endJunctionId)?.point;
		if (startPoint === undefined || endPoint === undefined) continue;
		const span = layoutWallSpanMeters(
			wall,
			new Map([
				[wall.startJunctionId, startPoint],
				[wall.endJunctionId, endPoint]
			])
		);
		if (span !== null && exceedsLayoutDimension(span)) return true;
	}
	return false;
}


/** True when any test-only curve/face/wall sampling observer is installed. */
export function hasAnySamplingTestObserver(): boolean {
	return (
		hasWallSamplingObserverForTest() ||
		hasFaceSamplingObserverForTest() ||
		hasSampleSegmentObserverForTest()
	);
}
