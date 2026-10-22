/**
 * RR-4 Q3 — identity ABA / allocator non-reuse (disposable).
 *
 * Uses the landed Wall planners' own default allocation, the occupancy noding
 * adapter shape, the P23.12 presentation ledger, and the F.1 unit resolver over a
 * real F.2 envelope. Undo is modelled exactly as the landed history models it:
 * restoring the prior accepted state (snapshot), not replaying an inverse.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planDeleteWall,
	planWallSegment,
	nextLayoutPresetObjectId,
	planCommitLayoutObjectPresetWithId,
	planWallSplit,
	promoteLayoutIdentity,
	referenceFor,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { REFERENCES_VERSION, type SemanticReference } from '@portfolio/project-model';
import { createEmptyUnitEnvelope } from '@portfolio/project-model/units';
import { resolveUnitReference } from '@portfolio/project-model/references/unit-resolution';
import { emptyDoc, lineWall, occupancyAllocator } from './rr4-support';

const log = (label: string, value: unknown) => console.log(`RR4 Q3 ${label} ${JSON.stringify(value)}`);

function must<T extends { kind: string }>(plan: T): Extract<T, { kind: 'success' }> {
	if (plan.kind !== 'success') throw new Error(JSON.stringify(plan));
	return plan as Extract<T, { kind: 'success' }>;
}

const segment = (baseline: LayoutDocumentWallFirst, start: [number, number], end: [number, number]) =>
	must(planWallSegment({ baseline, start, end, role: 'boundary' }));

async function resolveWall(layout: LayoutDocumentWallFirst, wallId: string, contentRevision?: string) {
	const envelope = await createEmptyUnitEnvelope({ id: 'rr4', name: 'RR4', acceptedRevision: { projectId: 'rr4', revisionId: 'r1' }, layout });
	const revision = contentRevision ?? envelope.units.layout.header.contentRevision;
	const reference: SemanticReference = {
		version: REFERENCES_VERSION,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: revision },
		subject: { kind: 'wall', id: wallId },
		instancePath: [],
		location: { kind: 'layout-location', levelId: layout.floor.id, structureInstancePath: [] },
		componentId: null,
		capabilityId: null
	};
	const resolution = await resolveUnitReference(reference, { envelope, sessionEpoch: 'rr4' });
	return { resolution: resolution.kind, layoutRevision: envelope.units.layout.header.contentRevision };
}

describe('RR-4 Q3 identity ABA', () => {
	it('default chain allocation: delete then recreate re-mints the deleted Wall ID', async () => {
		const empty = createEmptyWallFirstLayoutDocument();
		const created = segment(empty, [0, 0], [4, 0]);
		const firstId = created.createdWallIds[0]!;
		const bound = await resolveWall(created.document, firstId);
		const deleted = must(planDeleteWall(created.document, firstId)).document;
		const afterDelete = await resolveWall(deleted, firstId, bound.layoutRevision);
		const sameGeometry = segment(deleted, [0, 0], [4, 0]);
		const elsewhere = segment(deleted, [10, 5], [10, 9]);
		const sameBytes = JSON.stringify(sameGeometry.document) === JSON.stringify(created.document);
		// The retained (unresolved) binding is an exact reference to the ORIGINAL subject.
		const exactOld = await resolveWall(sameGeometry.document, firstId, bound.layoutRevision);
		const latestElsewhere = await resolveWall(elsewhere.document, firstId);
		const row = {
			firstId,
			recreatedId: sameGeometry.createdWallIds[0],
			elsewhereId: elsewhere.createdWallIds[0],
			boundResolution: bound.resolution,
			afterDeleteResolution: afterDelete.resolution,
			recreatedDocumentByteIdentical: sameBytes,
			exactOldRevisionResolvesRecreated: exactOld.resolution,
			currentRevisionResolvesElsewhereWall: latestElsewhere.resolution
		};
		log('delete-recreate', row);
		expect(row.recreatedId).toBe(firstId);
		expect(row.elsewhereId).toBe(firstId);
		expect(sameBytes).toBe(true);
	});

	it('split → Undo → different split re-mints the undone child ID for a different interval', () => {
		const d0 = emptyDoc({ A: [0, 0], B: [8, 0] }, [lineWall('W', 'A', 'B')]);
		const first = must(planWallSplit(d0, 'W', 4, occupancyAllocator));
		// Undo = restore d0 (snapshot history). A new edit then allocates from d0.
		const second = must(planWallSplit(d0, 'W', 6, occupancyAllocator));
		const interval = (doc: LayoutDocumentWallFirst, id: string) => {
			const wall = doc.walls.find((entry) => entry.id === id)!;
			return [doc.junctions.find((j) => j.id === wall.startJunctionId)!.point, doc.junctions.find((j) => j.id === wall.endJunctionId)!.point];
		};
		const row = {
			firstChild: first.createdWallIds[0],
			secondChild: second.createdWallIds[0],
			firstJunction: first.junctionId,
			secondJunction: second.junctionId,
			firstInterval: interval(first.document, first.createdWallIds[0]!),
			secondInterval: interval(second.document, second.createdWallIds[0]!)
		};
		log('undo-branch', row);
		expect(row.secondChild).toBe(row.firstChild);
		expect(row.secondJunction).toBe(row.firstJunction);
	});

	it('Undo of a deletion restores the same subject legitimately', async () => {
		const created = segment(createEmptyWallFirstLayoutDocument(), [0, 0], [4, 0]);
		const id = created.createdWallIds[0]!;
		const bound = await resolveWall(created.document, id);
		// Delete then Undo = reinstall the recorded state byte-for-byte.
		const restored = JSON.parse(JSON.stringify(created.document)) as LayoutDocumentWallFirst;
		const again = await resolveWall(restored, id, bound.layoutRevision);
		log('undo-delete', { resolution: again.resolution, sameRevision: again.layoutRevision === bound.layoutRevision });
		expect(again.resolution).toBe('resolved');
	});

	it('presentation ledger cursor rewinds with the snapshot; only the in-memory high-water mark prevents reuse', () => {
		const d0 = promoteLayoutIdentity(createEmptyWallFirstLayoutDocument()).document;
		const a = segment(d0, [0, 0], [4, 0]);
		const promotedA = promoteLayoutIdentity(a.document, { base: d0.identity?.cursor ?? 0 });
		const refA = referenceFor(promotedA.document, 'walls', a.createdWallIds[0]!);
		// Undo → back to d0 (cursor rewound). Save + reload loses the session mark.
		const b = segment(d0, [10, 5], [10, 9]);
		const promotedBCold = promoteLayoutIdentity(b.document, { base: d0.identity?.cursor ?? 0 });
		const promotedBSession = promoteLayoutIdentity(b.document, { base: promotedA.cursor });
		const row = {
			refA,
			refB_afterReload: referenceFor(promotedBCold.document, 'walls', b.createdWallIds[0]!),
			refB_inSession: referenceFor(promotedBSession.document, 'walls', b.createdWallIds[0]!),
			canonicalIdA: a.createdWallIds[0],
			canonicalIdB: b.createdWallIds[0]
		};
		log('ledger', row);
		expect(row.refB_afterReload).toBe(refA);
		expect(row.refB_inSession).not.toBe(refA);
		expect(row.canonicalIdB).toBe(row.canonicalIdA);
	});

	it('captured-nonce allocation (unratified sketch): non-reuse across delete/recreate and Undo branches; replay deterministic', () => {
		// The host captures one opaque nonce per operation in intent.allocatedIds; the
		// planner derives every new ID from it plus its own deterministic seed.
		const nonceAllocator = (nonce: string) => ({
			nextWallId: (_taken: ReadonlySet<string>, seed: string) => `${nonce}:${seed}`,
			nextJunctionId: (_taken: ReadonlySet<string>, seed: string) => `${nonce}:${seed}`
		});
		const nodingNonce = (nonce: string) => ({
			nextWallId: (_doc: LayoutDocumentWallFirst, seed: string) => `${nonce}:${seed}`,
			nextJunctionId: (_doc: LayoutDocumentWallFirst, seed: string) => `${nonce}:${seed}`
		});
		const empty = createEmptyWallFirstLayoutDocument();
		const a = must(planWallSegment({ baseline: empty, start: [0, 0], end: [4, 0], role: 'boundary', allocator: nonceAllocator('op-7f3a') }));
		const deleted = must(planDeleteWall(a.document, a.createdWallIds[0]!)).document;
		const b = must(planWallSegment({ baseline: deleted, start: [0, 0], end: [4, 0], role: 'boundary', allocator: nonceAllocator('op-91c2') }));
		const replay = must(planWallSegment({ baseline: empty, start: [0, 0], end: [4, 0], role: 'boundary', allocator: nonceAllocator('op-7f3a') }));
		const d0 = emptyDoc({ A: [0, 0], B: [8, 0] }, [lineWall('W', 'A', 'B')]);
		const s1 = must(planWallSplit(d0, 'W', 4, nodingNonce('op-1111')));
		const s2 = must(planWallSplit(d0, 'W', 6, nodingNonce('op-2222')));
		const row = { a: a.createdWallIds[0], recreated: b.createdWallIds[0], replay: replay.createdWallIds[0], split1: s1.createdWallIds[0], split2AfterUndo: s2.createdWallIds[0] };
		log('nonce', row);
		expect(row.recreated).not.toBe(row.a);
		expect(row.replay).toBe(row.a);
		expect(row.split2AfterUndo).not.toBe(row.split1);
	});

	it('live plinth path: captured Layout-object ID is forced to the occupancy ID, so Undo + new placement re-mints it', () => {
		const d0 = createEmptyWallFirstLayoutDocument();
		const idA = nextLayoutPresetObjectId(d0);
		const a = planCommitLayoutObjectPresetWithId(d0, 'plinth', [1, 1], 0, idA);
		// Undo = back to d0; the adapter captures again from the restored document.
		const idB = nextLayoutPresetObjectId(d0);
		const b = planCommitLayoutObjectPresetWithId(d0, 'plinth', [5, 5], 0, idB);
		const nonce = planCommitLayoutObjectPresetWithId(d0, 'plinth', [5, 5], 0, 'op-91c2:layout-object-1');
		const row = { idA, idB, aKind: a.kind, bKind: b.kind, nonceCaptureKind: nonce.kind, nonceCode: nonce.kind === 'rejected' ? nonce.rejection.code : null };
		log('plinth', row);
		expect(idB).toBe(idA);
		expect(nonce.kind).toBe('rejected');
	});
});
