/**
 * T1.P02.S01 §1 — captured, non-reusing Layout identity (acceptance guards).
 *
 * Every operation mints one opaque nonce **before** planning and every id it
 * creates derives from that nonce plus the allocator's own seed. These tests
 * exercise the guards the acceptance criterion names, on the real planners:
 *
 * - delete then recreate a Wall, an Opening and a Room-birthing chain: no id of
 *   the deleted subject returns;
 * - Undo, then a different edit: ids from the undone branch do not reappear;
 * - Redo (the same captured operation replayed): the same ids return;
 * - save, reload, edit: no collision with the saved ids;
 * - byte-identical recreation: a genuinely new id.
 *
 * Occupancy is only the refusal check: reusing a capture on a document that
 * already holds its derived ids refuses instead of suffixing.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	layoutCapturedId,
	planCreateWallFirstOpening,
	planDeleteWall,
	planDeleteWallFirstOpening,
	planWallChain,
	planWallSegment,
	type LayoutDocumentWallFirst,
	type LayoutIdCapture,
	type LayoutVec2
} from '@portfolio/layout-core';
import { captureFor, capturedId, freshCapture } from './__fixtures__/layout-id-capture';

const RECT: readonly LayoutVec2[] = [
	[0, 0],
	[6, 0],
	[6, 4],
	[0, 4]
];

function enclosure(capture: LayoutIdCapture) {
	const plan = planWallChain({
		baseline: createEmptyWallFirstLayoutDocument(),
		points: RECT,
		close: true,
		capture
	});
	if (plan.kind !== 'success') throw new Error(`enclosure refused: ${plan.rejection.code}`);
	return plan;
}

/** The two surviving endpoints of the deleted Wall, in canonical order. */
function gap(document: LayoutDocumentWallFirst, startId: string, endId: string) {
	const start = document.junctions.find((junction) => junction.id === startId);
	const end = document.junctions.find((junction) => junction.id === endId);
	if (!start || !end) throw new Error('the deleted Wall endpoints did not survive');
	return { start: start.point, end: end.point, startId, endId };
}

describe('T1.P02.S01 §1 — captured identity guards', () => {
	it('delete then recreate a Wall, an Opening and a Room-birthing chain: no identity returns', () => {
		const first = enclosure(freshCapture());
		const roomId = first.document.rooms[0]!.id;
		const deletedWallId = first.createdWallIds[0]!;
		const deletedWall = first.document.walls.find((wall) => wall.id === deletedWallId)!;
		const deletedStart = deletedWall.startJunctionId;
		const deletedEnd = deletedWall.endJunctionId;

		// Delete one boundary Wall; its Room retires.
		const deleted = planDeleteWall(first.document, deletedWallId, freshCapture());
		expect(deleted.kind).toBe('success');
		if (deleted.kind !== 'success') return;
		expect(deleted.document.rooms.find((room) => room.id === roomId)).toBeUndefined();

		// Recreate the Wall and let the ring birth a Room again — both operations
		// carry fresh captures, so neither the Wall/Junction ids nor the Room id
		// can be an old one.
		const rebuilt = planWallSegment({
			baseline: deleted.document,
			start: gap(deleted.document, deletedStart, deletedEnd).start,
			end: gap(deleted.document, deletedStart, deletedEnd).end,
			capture: freshCapture(),
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: deletedStart },
				{ pointIndex: 1, junctionId: deletedEnd }
			]
		});
		expect(rebuilt.kind).toBe('success');
		if (rebuilt.kind !== 'success') return;
		expect(rebuilt.createdWallIds).not.toContain(deletedWallId);
		// The snapped endpoints are the SURVIVING Junctions, so reuse is the correct
		// outcome here and the assertion says that rather than pretending to test a
		// mint. The mint is tested by the no-snap rebuild below.
		expect(rebuilt.createdJunctionIds).toEqual([]);
		expect(rebuilt.document.junctions.map((junction) => junction.id)).toEqual(
			expect.arrayContaining([deletedStart, deletedEnd])
		);
		expect(rebuilt.document.rooms).toHaveLength(1);
		expect(rebuilt.document.rooms[0]!.id).not.toBe(roomId);

		// The same gap rebuilt WITHOUT snaps: independent placement mints both
		// endpoints, so the minted ids can actually be compared with the deleted
		// ones (they are the same coordinates, never the same identities).
		const rebuiltGap = gap(deleted.document, deletedStart, deletedEnd);
		const minted = planWallSegment({
			baseline: deleted.document,
			start: rebuiltGap.start,
			end: rebuiltGap.end,
			capture: freshCapture()
		});
		expect(minted.kind).toBe('success');
		if (minted.kind !== 'success') return;
		expect(minted.createdJunctionIds.length).toBeGreaterThan(0);
		for (const id of minted.createdJunctionIds) {
			expect([deletedStart, deletedEnd], 'a minted Junction reuses a deleted id').not.toContain(id);
		}
		expect(minted.createdWallIds).not.toContain(deletedWallId);

		// An Opening deleted and recreated on the rebuilt Wall also receives a new id.
		const wallId = rebuilt.createdWallIds[0]!;
		const openingCapture = freshCapture();
		const createdOpening = planCreateWallFirstOpening(
			rebuilt.document,
			{ wallId, kind: 'door', offset: 1 },
			openingCapture
		);
		expect(createdOpening.kind).toBe('success');
		if (createdOpening.kind !== 'success') return;
		const openingId = createdOpening.changedOpeningIds[0]!;
		expect(openingId).toBe(capturedId(openingCapture, `opening:door:${wallId}`));
		const removedOpening = planDeleteWallFirstOpening(createdOpening.document, openingId);
		expect(removedOpening.kind).toBe('success');
		if (removedOpening.kind !== 'success') return;
		const recreatedOpening = planCreateWallFirstOpening(
			removedOpening.document,
			{ wallId, kind: 'door', offset: 1 },
			freshCapture()
		);
		expect(recreatedOpening.kind).toBe('success');
		if (recreatedOpening.kind !== 'success') return;
		expect(recreatedOpening.changedOpeningIds[0]).not.toBe(openingId);
	});

	it('Undo then a different edit cannot recycle an id; replaying the captured operation returns the same ids', () => {
		const baseline = createEmptyWallFirstLayoutDocument();
		const undoneCapture = captureFor('undone-branch');
		const undone = planWallChain({
			baseline,
			points: RECT,
			close: true,
			capture: undoneCapture
		});
		expect(undone.kind).toBe('success');
		if (undone.kind !== 'success') return;

		// Undo returns to `baseline`; the different edit draws elsewhere and mints
		// its own capture, so no undone identity can reappear.
		const different = planWallChain({
			baseline,
			points: [
				[20, 0],
				[26, 0],
				[26, 4],
				[20, 4]
			],
			close: true,
			capture: freshCapture()
		});
		expect(different.kind).toBe('success');
		if (different.kind !== 'success') return;
		const undoneIds = new Set([
			...undone.createdWallIds,
			...undone.createdJunctionIds,
			...undone.document.rooms.map((room) => room.id)
		]);
		for (const id of [...different.createdWallIds, ...different.createdJunctionIds]) {
			expect(undoneIds.has(id), `undone id '${id}' must not reappear`).toBe(false);
		}

		// Redo replays the captured operation — identical ids and document.
		const replay = planWallChain({ baseline, points: RECT, close: true, capture: undoneCapture });
		expect(replay.kind).toBe('success');
		if (replay.kind !== 'success') return;
		expect(replay.createdWallIds).toEqual(undone.createdWallIds);
		expect(replay.createdJunctionIds).toEqual(undone.createdJunctionIds);
		expect(replay.document).toEqual(undone.document);
	});

	it('save, reload, edit: the reloaded document refuses no captured id and reuses none', () => {
		const saved = enclosure(captureFor('saved-project'));
		const savedIds = new Set([
			...saved.createdWallIds,
			...saved.createdJunctionIds,
			...saved.document.rooms.map((room) => room.id)
		]);

		// Save/load is a JSON round-trip; nothing about capture lives in the file.
		const reloaded = JSON.parse(JSON.stringify(saved.document)) as LayoutDocumentWallFirst;
		const editCapture = freshCapture();
		const addition = planWallChain({
			baseline: reloaded,
			points: [
				[20, 0],
				[26, 0],
				[26, 4],
				[20, 4]
			],
			close: true,
			capture: editCapture
		});
		expect(addition.kind).toBe('success');
		if (addition.kind !== 'success') return;
		expect(addition.createdWallIds).toContain(layoutCapturedId(editCapture, 'wall-chain-1'));
		for (const id of [...addition.createdWallIds, ...addition.createdJunctionIds]) {
			expect(savedIds.has(id), `saved id '${id}' must not be reused`).toBe(false);
		}
		// The saved document is untouched by planning.
		expect(saved.document.walls).toHaveLength(4);
	});

	it('a byte-identical recreation still receives a new identity', () => {
		const first = enclosure(captureFor('first-identical'));
		const second = enclosure(captureFor('second-identical'));
		expect(first.document.walls).toHaveLength(second.document.walls.length);
		expect(first.document.junctions).toHaveLength(second.document.junctions.length);
		expect(first.createdWallIds).not.toEqual(second.createdWallIds);
		expect(first.createdJunctionIds).not.toEqual(second.createdJunctionIds);
		expect(first.document.rooms[0]!.id).not.toBe(second.document.rooms[0]!.id);
	});

	it('occupancy refuses a captured id instead of suffixing it', () => {
		const capture = captureFor('reused-capture');
		const first = enclosure(capture);
		const reuse = planWallChain({
			baseline: first.document,
			points: [
				[20, 0],
				[26, 0],
				[26, 4],
				[20, 4]
			],
			close: true,
			capture
		});
		expect(reuse.kind).toBe('rejected');
		if (reuse.kind !== 'rejected') return;
		expect(reuse.rejection.code).toBe('captured_id_in_use');
		expect(reuse.rejection.message).toContain(capture.nonce);
	});
});
