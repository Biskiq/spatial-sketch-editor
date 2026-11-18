/**
 * P23B.11 — the production default-carry comparison for the four historical
 * retirement rows.
 *
 * `p23b11-correspondence-reference.ts` preserves the pre-SP1c behaviour: its
 * reconciliation rebuild has no carried virtual edges, so those four rows record
 * `fidelity: false` and their old retirement documents. That history stays as it
 * was. This table is the other half the workflow requires: the SAME case, the
 * SAME planner operation, rebuilt under the carry rule production Wall deletion
 * actually uses (removed Walls named, so their sides become virtual edges).
 *
 * Each row is a compact projection of one `analyzeCorrespondenceCase(...,
 * 'production-carry')` result. `fidelity: true` is the claim the differential
 * must reproduce: the rebuilt pass equals the planner's own reconciled Rooms,
 * objects and openings.
 */
import { sha256, type P23B11PassAnalysis } from './p23b11-correspondence-cases';

export type P23B11ProductionCarryRow = {
	readonly id: string;
	readonly operationDocumentSha256: string;
	readonly fidelity: boolean;
	readonly reconciliation: {
		readonly documentSha256: string;
		readonly retiredRoomIds: readonly string[];
		readonly rooms: ReadonlyArray<{ readonly id: string; readonly name: string }>;
		readonly lineage: ReadonlyArray<{
			readonly faceKey: string;
			readonly roomId: string;
			readonly kind: string;
		}>;
	};
};

/** The four rows whose historical rebuild intentionally models retirement. */
export const P23B11_PRODUCTION_CARRY_IDS = [
	'd-connected-outer-wall-retire',
	'd-straight-12-outer-wall-retire',
	'f-d12-exact-coincidence-role-change',
	'f-d12-full-containment-role-change'
] as const;

export const P23B11_PRODUCTION_CARRY_REFERENCE: readonly P23B11ProductionCarryRow[] = [
	{
		id: 'd-connected-outer-wall-retire',
		operationDocumentSha256: '36ddadd441dfce297617ba46ae0bfce07768722619de358a9fe3583b74dc333b',
		fidelity: true,
		reconciliation: {
			documentSha256: '36ddadd441dfce297617ba46ae0bfce07768722619de358a9fe3583b74dc333b',
			retiredRoomIds: [],
			rooms: [
				{ id: 'grid:room-0-1', name: 'Grid Room 0-1' },
				{ id: 'grid:room-1-0', name: 'Grid Room 1-0' },
				{ id: 'grid:room-1-1', name: 'Grid Room 1-1' },
				{ id: 'grid:room-0-0', name: 'Grid Room 0-0' }
			],
			lineage: [
				{
					faceKey: '5:4:face12:grid:h-0-1~F12:grid:v-1-1~F12:grid:h-0-2~R12:grid:v-0-1~R',
					roomId: 'grid:room-0-1',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face12:grid:h-1-0~F12:grid:v-2-0~F12:grid:h-1-1~R12:grid:v-1-0~R',
					roomId: 'grid:room-1-0',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face12:grid:h-1-1~F12:grid:v-2-1~F12:grid:h-1-2~R12:grid:v-1-1~R',
					roomId: 'grid:room-1-1',
					kind: 'preserved'
				}
			]
		}
	},
	{
		id: 'd-straight-12-outer-wall-retire',
		operationDocumentSha256: '4a78f54886b4a29d697718ea5e0318d3bd5342a88d814c0038b2fdde189428ba',
		fidelity: true,
		reconciliation: {
			documentSha256: '4a78f54886b4a29d697718ea5e0318d3bd5342a88d814c0038b2fdde189428ba',
			retiredRoomIds: [],
			rooms: [
				{ id: 'room-1', name: 'Room 1' },
				{ id: 'room-2', name: 'Room 2' },
				{ id: 'room-0', name: 'Room 0' }
			],
			lineage: [
				{
					faceKey: '5:4:face15:room-1:wall-0~F15:room-1:wall-1~F15:room-1:wall-2~F15:room-1:wall-3~F',
					roomId: 'room-1',
					kind: 'preserved'
				},
				{
					faceKey: '5:4:face15:room-2:wall-0~F15:room-2:wall-1~F15:room-2:wall-2~F15:room-2:wall-3~F',
					roomId: 'room-2',
					kind: 'preserved'
				}
			]
		}
	},
	{
		id: 'f-d12-exact-coincidence-role-change',
		operationDocumentSha256: '7a3481ed82760f17c4fcf400304b6d0475de487d3bdcb799cc2cf84880b18e94',
		fidelity: true,
		reconciliation: {
			documentSha256: '7a3481ed82760f17c4fcf400304b6d0475de487d3bdcb799cc2cf84880b18e94',
			retiredRoomIds: [],
			rooms: [
				{ id: 'room-k', name: 'Room k' },
				{ id: 'room-c', name: 'Room c' }
			],
			lineage: [
				{
					faceKey: '5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F',
					roomId: 'room-k',
					kind: 'preserved'
				}
			]
		}
	},
	{
		id: 'f-d12-full-containment-role-change',
		operationDocumentSha256: '7a3481ed82760f17c4fcf400304b6d0475de487d3bdcb799cc2cf84880b18e94',
		fidelity: true,
		reconciliation: {
			documentSha256: '7a3481ed82760f17c4fcf400304b6d0475de487d3bdcb799cc2cf84880b18e94',
			retiredRoomIds: [],
			rooms: [
				{ id: 'room-k', name: 'Room k' },
				{ id: 'room-c', name: 'Room c' }
			],
			lineage: [
				{
					faceKey: '5:4:face6:k-a1~F6:k-b1~F6:k-c1~F6:k-d1~F',
					roomId: 'room-k',
					kind: 'preserved'
				}
			]
		}
	}
];

/** Reduce a production-carry analysis to the frozen row shape. */
export function productionCarryRow(analysis: P23B11PassAnalysis): P23B11ProductionCarryRow {
	if (analysis.operation.verdict !== 'success') {
		throw new Error(`${analysis.caseId}: the production operation did not plan`);
	}
	if (analysis.reconciliation.kind !== 'ok') {
		throw new Error(`${analysis.caseId}: the production-carry rebuild did not reconcile`);
	}
	return {
		id: analysis.caseId,
		operationDocumentSha256: sha256(analysis.operation.documentJson),
		fidelity: analysis.fidelity === true,
		reconciliation: {
			documentSha256: sha256(analysis.reconciliation.documentJson),
			retiredRoomIds: analysis.reconciliation.retiredRoomIds,
			rooms: analysis.reconciliation.rooms,
			lineage: analysis.reconciliation.lineage
		}
	};
}
