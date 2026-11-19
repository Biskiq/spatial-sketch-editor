/**
 * T1 V1b — §5.6 Layout-owned queries: floor candidates above authored regions,
 * overhead supports over lids and region undersides, and the open-to-sky
 * association. T-V7, T-V8 and T-V10 live here; T-V4–T-V6 are in
 * `layout-region-planners.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometryFresh,
	createEmptyWallFirstLayoutDocument,
	floorSupportSnapshotOf,
	overheadSourcesOf,
	overheadSupportSnapshotOf,
	planCreateRegion,
	planMoveRegion,
	planRemoveRegion,
	planRoomMetadataUpdate,
	planSetRegionElevation,
	planWallChain,
	queryFloorSupports,
	queryOverheadSupports,
	regionsOverSpace,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import { captureFor, freshCapture } from './__fixtures__/layout-id-capture';

const RECT: LayoutVec2[] = [[0, 0], [7, 0], [7, 6], [0, 6]];
const POINT: LayoutVec2 = [3, 3];
const CANOPY: LayoutVec2[] = [[2, 2], [5, 2], [5, 4], [2, 4]];

function enclosure(height = 3): LayoutDocumentWallFirst {
	const baseline = createEmptyWallFirstLayoutDocument();
	const plan = planWallChain({
		baseline,
		points: RECT,
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id,
		height
	});
	if (plan.kind !== 'success') throw new Error(`enclosure failed: ${plan.rejection.message}`);
	return plan.document;
}

function compile(document: LayoutDocumentWallFirst) {
	const result = compileWallFirstLayoutGeometryFresh(document);
	expect(result.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	return result.geometry;
}

function addRegion(
	document: LayoutDocumentWallFirst,
	intent: {
		role: 'floor' | 'overhead';
		footprint: readonly LayoutVec2[];
		elevation: number;
		thickness?: number;
	},
	nonce: string
) {
	const plan = planCreateRegion({
		baseline: document,
		capture: captureFor(nonce),
		intent: { thickness: 0.2, ...intent }
	});
	if (plan.kind !== 'success') throw new Error(`region create failed: ${plan.rejection.message}`);
	return { document: plan.document, regionId: plan.regionId };
}

function withCanopy() {
	const base = enclosure();
	const canopy = addRegion(base, { role: 'overhead', footprint: CANOPY, elevation: 2.4 }, 'region-canopy');
	return { base, ...canopy };
}

describe('T-V8 — floor support includes authored region tops', () => {
	it('offers a Room floor and a floor-region top as separate choices', () => {
		const base = enclosure();
		const mezzanine = addRegion(base, { role: 'floor', footprint: CANOPY, elevation: 0.6 }, 'region-mezz');
		const result = queryFloorSupports(floorSupportSnapshotOf(compile(mezzanine.document)), {
			generationId: 'generation-1',
			x: POINT[0],
			z: POINT[1]
		});
		expect(result.kind).toBe('candidates');
		if (result.kind !== 'candidates') return;
		expect(result.candidates.map((candidate) => candidate.elevation).sort((a, b) => a - b)).toEqual([0, 0.6]);
		const regionCandidate = result.candidates.find((candidate) =>
			candidate.witnesses.some((witness) => witness.source.kind === 'region')
		)!;
		const regionWitness = regionCandidate.witnesses.find((witness) => witness.source.kind === 'region')!;
		expect(regionWitness.source).toEqual({ kind: 'region', regionId: mezzanine.regionId });
		expect(regionWitness.elevation).toBe(0.6);
	});

	it('groups a coplanar Room floor and region top into one choice with both witnesses', () => {
		const base = enclosure();
		const mat = addRegion(base, { role: 'floor', footprint: CANOPY, elevation: 0 }, 'region-mat');
		const result = queryFloorSupports(floorSupportSnapshotOf(compile(mat.document)), {
			generationId: 'generation-1',
			x: POINT[0],
			z: POINT[1]
		});
		expect(result.kind).toBe('candidates');
		if (result.kind !== 'candidates') return;
		expect(result.candidates).toHaveLength(1);
		expect(result.candidates[0]!.witnesses.map((witness) => witness.source.kind).sort()).toEqual([
			'region',
			'room'
		]);
	});

	it('refuses a region top that disagrees with the compiled footprint fact', () => {
		const base = enclosure();
		const mat = addRegion(base, { role: 'floor', footprint: CANOPY, elevation: 0 }, 'region-mat');
		const snapshot = floorSupportSnapshotOf(compile(mat.document));
		const contradictory = {
			...snapshot,
			regions: snapshot.regions.map((region) => ({ ...region, topY: region.topY + 1 }))
		};
		const result = queryFloorSupports(contradictory, {
			generationId: 'generation-1',
			x: POINT[0],
			z: POINT[1]
		});
		expect(result).toMatchObject({ kind: 'unsupported', code: 'contradictory-support-facts' });
	});

	it('moves a region top with the region and leaves the Room floor alone', () => {
		const base = enclosure();
		const mezzanine = addRegion(base, { role: 'floor', footprint: CANOPY, elevation: 0.6 }, 'region-mezz');
		const raised = planSetRegionElevation(mezzanine.document, mezzanine.regionId, 1.2);
		expect(raised.kind).toBe('success');
		if (raised.kind !== 'success') return;
		const result = queryFloorSupports(floorSupportSnapshotOf(compile(raised.document)), {
			generationId: 'generation-1',
			x: POINT[0],
			z: POINT[1]
		});
		expect(result.kind).toBe('candidates');
		if (result.kind !== 'candidates') return;
		expect(result.candidates.map((candidate) => candidate.elevation).sort((a, b) => a - b)).toEqual([0, 1.2]);
	});
});

describe('T-V7 / T-V10 — overheads, lift sources and open-to-sky', () => {
	it('lists a Room lid and an authored canopy as separate overhead sources', () => {
		const { document, regionId } = withCanopy();
		const sources = overheadSourcesOf(compile(document), { kind: 'all' });
		expect(sources.map((source) => source.key)).toEqual([
			{ kind: 'room-lid', roomId: document.rooms[0]!.id },
			{ kind: 'region', regionId }
		]);
		expect(sources[1]!.subject).toEqual({ kind: 'region', id: regionId });
		expect(sources[1]!.outline).toEqual(CANOPY);
		expect(sources[1]!.elevation).toBe(2.4);
	});

	it('associates an overhead region with a Space by overlap, without storing a Room id', () => {
		const { document, regionId } = withCanopy();
		const geometry = compile(document);
		expect(regionsOverSpace(geometry, document.rooms[0]!.id).map((region) => region.regionId)).toEqual([
			regionId
		]);
		expect('roomId' in document.regions[0]!).toBe(false);
		expect(regionsOverSpace(geometry, 'no-such-room')).toEqual([]);
	});

	it('keeps the region overhead when the Room opens to the sky, and the lid removal changes only the lid', () => {
		const { base, document, regionId } = withCanopy();
		const roomId = document.rooms[0]!.id;
		const opened = planRoomMetadataUpdate(document, roomId, { overhead: 'open-to-sky' });
		expect(opened.kind).toBe('success');
		if (opened.kind !== 'success') return;
		const beforeLid = compile(document).rooms[0]!;
		const afterLid = compile(opened.document).rooms[0]!;
		expect(beforeLid.ceilingPolygon.length).toBeGreaterThan(2);
		expect(afterLid.ceilingPolygon).toEqual([]);
		expect(opened.document.regions).toEqual(document.regions);
		expect(regionId).toBe(document.regions[0]!.id);

		const sources = overheadSourcesOf(compile(opened.document), { kind: 'all' });
		expect(sources.map((source) => source.key)).toEqual([{ kind: 'region', regionId }]);

		// Reopening restores exactly the original lid and keeps the region.
		const reopened = planRoomMetadataUpdate(opened.document, roomId, { overhead: 'closed' });
		expect(reopened.kind).toBe('success');
		if (reopened.kind !== 'success') return;
		expect(overheadSourcesOf(compile(reopened.document), { kind: 'all' })).toHaveLength(2);
		expect(compile(reopened.document).rooms[0]!.ceilingPolygon).toEqual(
			compile(base).rooms[0]!.ceilingPolygon
		);
	});

	it('keeps the Room lid unaffected by region edits and removal', () => {
		const { document, regionId } = withCanopy();
		const roomId = document.rooms[0]!.id;
		const lidBefore = compile(document).rooms.find((room) => room.roomId === roomId)!;
		const moved = planMoveRegion(document, regionId, [0, 0.5]);
		expect(moved.kind).toBe('success');
		if (moved.kind !== 'success') return;
		const lidAfterMove = compile(moved.document).rooms.find((room) => room.roomId === roomId)!;
		expect(lidAfterMove).toEqual(lidBefore);
		const removed = planRemoveRegion(moved.document, regionId);
		expect(removed.kind).toBe('success');
		if (removed.kind !== 'success') return;
		expect(overheadSourcesOf(compile(removed.document), { kind: 'all' }).map((source) => source.key)).toEqual([
			{ kind: 'room-lid', roomId }
		]);
	});

	it('orders overhead supports by increasing elevation, filters by starting height, and stores no clearance', () => {
		const { document } = withCanopy();
		const snapshot = overheadSupportSnapshotOf(compile(document));
		const result = queryOverheadSupports(snapshot, {
			generationId: 'generation-1',
			x: POINT[0],
			z: POINT[1]
		});
		expect(result.kind).toBe('candidates');
		if (result.kind !== 'candidates') return;
		expect(result.candidates.map((candidate) => candidate.elevation)).toEqual([2.4, 3]);
		expect(result.candidates.map((candidate) => candidate.witnesses[0]!.source.kind)).toEqual([
			'region',
			'room'
		]);
		// Clearance is derived by the caller from successive elevations; the
		// query does not invent a second vertical-authority fact.
		expect(Object.keys(result.candidates[0]!)).not.toContain('clearance');
		expect(result.candidates[1]!.elevation - result.candidates[0]!.elevation).toBeCloseTo(0.6, 9);

		const aboveCanopy = queryOverheadSupports(snapshot, {
			generationId: 'generation-1',
			x: POINT[0],
			z: POINT[1],
			aboveElevation: 2.5
		});
		expect(aboveCanopy.kind).toBe('candidates');
		if (aboveCanopy.kind !== 'candidates') return;
		expect(aboveCanopy.candidates.map((candidate) => candidate.elevation)).toEqual([3]);

		expect(
			queryOverheadSupports(snapshot, {
				generationId: 'generation-1',
				x: POINT[0],
				z: POINT[1],
				aboveElevation: 3
			})
		).toEqual({ kind: 'none' });
	});

	it('an open-to-sky Room contributes no lid but keeps its canopy', () => {
		const { document } = withCanopy();
		const opened = planRoomMetadataUpdate(document, document.rooms[0]!.id, { overhead: 'open-to-sky' });
		expect(opened.kind).toBe('success');
		if (opened.kind !== 'success') return;
		const result = queryOverheadSupports(overheadSupportSnapshotOf(compile(opened.document)), {
			generationId: 'generation-1',
			x: POINT[0],
			z: POINT[1]
		});
		expect(result.kind).toBe('candidates');
		if (result.kind !== 'candidates') return;
		expect(result.candidates).toHaveLength(1);
		expect(result.candidates[0]!.witnesses[0]!.source.kind).toBe('region');
	});
});
