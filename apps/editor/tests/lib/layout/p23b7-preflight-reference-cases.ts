/**
 * P23B.7 S2 — THE FROZEN WHOLE-DOCUMENT PREFLIGHT CASE TABLE.
 *
 * This module IS the freeze: every OR-3 case (a)–(d), the OR-8 lifecycle baseline
 * and the issue-order row, each with the verdict, code and exact message the
 * SHIPPED whole-document `preflightWallFirstArchitectureCandidate` returned when
 * S2 landed — plus, for the issue-order row, the control that proves the later
 * defect is genuinely present rather than merely absent.
 *
 * WHY IT IS ITS OWN MODULE. S4's differential must compare its scoped path
 * against THIS table, not against a copy and not against another scoped variant.
 * Two consumers, one table: `p23b7-preflight-reference.test.ts` keeps asserting
 * the live whole-document preflight against it (so the freeze cannot drift), and
 * `p23b7-verdict-scope.test.ts` asserts the scoped path returns the same entries.
 * It lives here rather than in the test file so importing it registers no suites.
 *
 * NO VALUE IN THIS MODULE MAY CHANGE. `preflightWallFirstArchitectureCandidate`
 * remains the reference oracle; a change here would silently move what both
 * tests treat as frozen.
 */
import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWallCenterline,
	type WallFirstArchitectureProposalIntent
} from '@portfolio/layout-core';
import {
	P23B_CORRECTNESS_SPECS,
	P23B_MATRIX_SPECS,
	P23B_OWNER_LAYOUT,
	buildP23BCorrectnessFixture,
	buildP23BMatrixFixture
} from '$lib/bench/p23b-fixtures';

export type P23B7PreflightReference = {
	/** `known-invalid` (the gate refuted) or `pending` (nothing cheap rejected it). */
	status: 'known-invalid' | 'pending';
	code?: string;
	message?: string;
};

export type P23B7PreflightReferenceCase = {
	id: string;
	/** The OR-3 letter (a)–(d) or OR-8 clause this row covers. */
	covers: string;
	document: LayoutDocumentWallFirst;
	intent: WallFirstArchitectureProposalIntent;
	expected: P23B7PreflightReference;
	/**
	 * A LATER-stage defect the same case also carries, with the control row that
	 * proves it is genuinely present through the same single authority.
	 */
	laterDefect?: {
		control: { document: LayoutDocumentWallFirst; intent: WallFirstArchitectureProposalIntent };
		expected: P23B7PreflightReference;
	};
};

const LINE = { kind: 'line' } as const;

const FAILURE = { status: 'known-invalid' } as const;
const PENDING = { status: 'pending' } as const;

function curve(start: LayoutVec2, end: LayoutVec2, knot: LayoutVec2, knotId: string): LayoutWallCenterline {
	return wallCubicChain([{ id: knotId, point: knot }], deriveChainSpans([start, knot, end]));
}

function matrixFixture(id: string): LayoutDocumentWallFirst {
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === id);
	if (!spec) throw new Error(`unknown matrix fixture ${id}`);
	return buildP23BMatrixFixture(spec);
}

function correctnessFixture(id: string): LayoutDocumentWallFirst {
	const spec = P23B_CORRECTNESS_SPECS.find((entry) => entry.id === id);
	if (!spec) throw new Error(`unknown correctness fixture ${id}`);
	return buildP23BCorrectnessFixture(spec);
}

function junctionMove(junctionId: string, point: LayoutVec2): WallFirstArchitectureProposalIntent {
	return { kind: 'junction-move', junctionId, point };
}

function junctionMoveBy(document: LayoutDocumentWallFirst, junctionId: string, delta: LayoutVec2): WallFirstArchitectureProposalIntent {
	const junction = document.junctions.find((entry) => entry.id === junctionId);
	if (!junction) throw new Error(`unknown junction ${junctionId}`);
	return junctionMove(junctionId, [junction.point[0] + delta[0], junction.point[1] + delta[1]]);
}

function knotMove(wallId: string, knotId: string, point: LayoutVec2): WallFirstArchitectureProposalIntent {
	return { kind: 'curve-control-move', wallId, knotId, point };
}

/** One 8×8 Room, four boundary Walls, two of them curved. */
function sharedRoomDocument(curved: boolean): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument() as LayoutDocumentWallFirst;
	document.junctions.push(
		{ id: 'a0', point: [0, 0] },
		{ id: 'a1', point: [8, 0] },
		{ id: 'a2', point: [8, 8] },
		{ id: 'a3', point: [0, 8] }
	);
	document.walls.push(
		{ id: 'w-south', startJunctionId: 'a0', endJunctionId: 'a1', role: 'boundary', thickness: 0.2, height: 3, centerline: curved ? curve([0, 0], [8, 0], [4, 0], 'w-south:knot:1') : LINE },
		{ id: 'w-east', startJunctionId: 'a1', endJunctionId: 'a2', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'w-north', startJunctionId: 'a2', endJunctionId: 'a3', role: 'boundary', thickness: 0.2, height: 3, centerline: curved ? curve([8, 8], [0, 8], [4, 8], 'w-north:knot:1') : LINE },
		{ id: 'w-west', startJunctionId: 'a3', endJunctionId: 'a0', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
	);
	document.rooms.push({
		id: 'room-1',
		name: 'Room',
		floorThickness: 0.1,
		ceilingThickness: 0.1,
		boundary: [
			{ wallId: 'w-south', direction: 'forward' },
			{ wallId: 'w-east', direction: 'forward' },
			{ wallId: 'w-north', direction: 'forward' },
			{ wallId: 'w-west', direction: 'forward' }
		]
	});
	return document;
}

/** OR-3 (c) — a baseline that ALREADY carries a same-component crossing. */
function alreadyCrossedDocument(): LayoutDocumentWallFirst {
	const document = sharedRoomDocument(true);
	const south = document.walls.find((wall) => wall.id === 'w-south')!;
	south.centerline = curve([0, 0], [8, 0], [4, 12], 'w-south:knot:1');
	return document;
}

/** OR-3 (b) — the cross-Room family P23B.4 built for exactly this shape. */
function crossRoomDocument(eastKnot: LayoutVec2 | null): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument() as LayoutDocumentWallFirst;
	document.junctions.push(
		{ id: 'a0', point: [0, 0] },
		{ id: 'a1', point: [8, 0] },
		{ id: 'a2', point: [8, 8] },
		{ id: 'a3', point: [0, 8] },
		{ id: 'b1', point: [16, 8] },
		{ id: 'b2', point: [16, 16] },
		{ id: 'b3', point: [8, 16] }
	);
	document.walls.push(
		{ id: 'r1-south', startJunctionId: 'a0', endJunctionId: 'a1', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'r1-east', startJunctionId: 'a1', endJunctionId: 'a2', role: 'boundary', thickness: 0.2, height: 3, centerline: eastKnot ? curve([8, 0], [8, 8], eastKnot, 'r1-east:knot:1') : LINE },
		{ id: 'r1-north', startJunctionId: 'a2', endJunctionId: 'a3', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'r1-west', startJunctionId: 'a3', endJunctionId: 'a0', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'r2-south', startJunctionId: 'a2', endJunctionId: 'b1', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'r2-east', startJunctionId: 'b1', endJunctionId: 'b2', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'r2-north', startJunctionId: 'b2', endJunctionId: 'b3', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE },
		{ id: 'r2-west', startJunctionId: 'b3', endJunctionId: 'a2', role: 'boundary', thickness: 0.2, height: 3, centerline: LINE }
	);
	document.rooms.push(
		{ id: 'room-1', name: 'SW', floorThickness: 0.1, ceilingThickness: 0.1, boundary: [
			{ wallId: 'r1-south', direction: 'forward' },
			{ wallId: 'r1-east', direction: 'forward' },
			{ wallId: 'r1-north', direction: 'forward' },
			{ wallId: 'r1-west', direction: 'forward' }
		] },
		{ id: 'room-2', name: 'NE', floorThickness: 0.1, ceilingThickness: 0.1, boundary: [
			{ wallId: 'r2-south', direction: 'forward' },
			{ wallId: 'r2-east', direction: 'forward' },
			{ wallId: 'r2-north', direction: 'forward' },
			{ wallId: 'r2-west', direction: 'forward' }
		] }
	);
	return document;
}

export function p23b7PreflightReferenceCases(): P23B7PreflightReferenceCase[] {
	const rows: P23B7PreflightReferenceCase[] = [];

	// ---- (a) committed fixtures: the gesture the slice actually drives --------
	rows.push({
		id: 'a-matrix-12-target-curved',
		covers: 'OR-3a',
		document: matrixFixture('p23b-12-wall-target-curved-v1'),
		intent: junctionMoveBy(matrixFixture('p23b-12-wall-target-curved-v1'), 'room-0:j0', [0.05, 0]),
		expected: PENDING
	});
	rows.push({
		id: 'a-matrix-40-target-curved',
		covers: 'OR-3a',
		document: matrixFixture('p23b-40-wall-target-curved-v1'),
		intent: junctionMoveBy(matrixFixture('p23b-40-wall-target-curved-v1'), 'room-0:j0', [0.05, 0]),
		expected: PENDING
	});
	rows.push({
		id: 'a-owner-40-curved',
		covers: 'OR-3a',
		document: P23B_OWNER_LAYOUT,
		intent: junctionMoveBy(P23B_OWNER_LAYOUT, P23B_OWNER_LAYOUT.junctions[0]!.id, [0.05, 0]),
		expected: PENDING
	});

	// ---- (b) a patch edited toward an inter-Room crossing (F-C3 shape) -------
	const admitted = crossRoomDocument([12, 4]);
	rows.push({
		id: 'b-crossroom-admitted-control',
		covers: 'OR-3b',
		document: admitted,
		intent: junctionMoveBy(admitted, 'a3', [0, 0.02]),
		expected: PENDING
	});
	rows.push({
		id: 'b-crossroom-edited-into-crossing',
		covers: 'OR-3b',
		document: admitted,
		intent: knotMove('r1-east', 'r1-east:knot:1', [12, 9]),
		expected: {
			status: 'known-invalid',
			code: 'unsupported_wall_topology',
			message: "Walls 'r1-east' and 'r2-south' cross away from their shared Junction"
		}
	});
	// Independent components: the SAME crossing shape is permitted geometry, not a
	// verdict (Option E) — the frozen reference records the admission so no scoped
	// variant may start rejecting it.
	rows.push({
		id: 'b-independent-components-crossing-admitted',
		covers: 'OR-3b',
		document: correctnessFixture('N-2'),
		intent: junctionMoveBy(correctnessFixture('N-2'), 'j-c', [0.05, 0]),
		expected: PENDING
	});

	// ---- (c) a baseline that ALREADY carries a crossing ----------------------
	rows.push({
		id: 'c-crossing-in-baseline',
		covers: 'OR-3c',
		document: alreadyCrossedDocument(),
		intent: junctionMoveBy(alreadyCrossedDocument(), 'a3', [0, 0.05]),
		expected: {
			status: 'known-invalid',
			code: 'unsupported_wall_topology',
			message: "Walls 'w-south' and 'w-north' have unsupported centerline crossing"
		}
	});
	rows.push({
		id: 'c-crossing-in-baseline-independent-components',
		covers: 'OR-3c',
		document: correctnessFixture('N-2'),
		intent: junctionMoveBy(correctnessFixture('N-2'), 'j-a', [0.05, 0]),
		expected: PENDING
	});
	rows.push({
		id: 'c-same-component-crossing-fixture',
		covers: 'OR-3c',
		document: correctnessFixture('N-2i'),
		intent: junctionMoveBy(correctnessFixture('N-2i'), 'j-a', [0.05, 0]),
		expected: {
			status: 'known-invalid',
			code: 'unsupported_wall_topology',
			message: "Walls 'wall-straight' and 'wall-curved' cross away from their shared Junction"
		}
	});
	// The crossed state as the BASELINE and a harmless move elsewhere: the
	// wall-pair stage reports it, and that is the row order check below uses.
	rows.push({
		id: 'c-crossing-in-baseline-with-harmless-patch',
		covers: 'OR-3c',
		document: crossRoomDocument([12, 9]),
		intent: junctionMoveBy(crossRoomDocument([12, 9]), 'a3', [0, 0.02]),
		expected: {
			status: 'known-invalid',
			code: 'unsupported_wall_topology',
			message: "Walls 'r1-east' and 'r2-south' cross away from their shared Junction"
		}
	});

	// ---- (d) a patch that produces self-intersection / duplicate points / ----
	//          a zero-length Wall
	const roomForDuplicate = sharedRoomDocument(true);
	rows.push({
		id: 'd-duplicate-junction-point',
		covers: 'OR-3d',
		document: roomForDuplicate,
		intent: junctionMove('a2', [0, 0]),
		expected: {
			status: 'known-invalid',
			code: 'duplicate_junction_point',
			message: "Junction 'a2' duplicates the point of 'a0'"
		}
	});
	// A Wall whose endpoints coincide ALWAYS has its two Junctions in one
	// component, so the Junction stage reports it first. The recorded verdict is
	// therefore the ordering fact, not the zero-length message; the later-defect
	// control is the same shape edited so the duplicate cannot form (a Wall move
	// that translates BOTH endpoint Junctions onto two distinct points).
	const roomForZeroLength = sharedRoomDocument(true);
	rows.push({
		id: 'd-zero-length-wall-is-shadowed-by-the-junction-stage',
		covers: 'OR-3d',
		document: roomForZeroLength,
		intent: junctionMove('a1', [8, 8]),
		expected: {
			status: 'known-invalid',
			code: 'duplicate_junction_point',
			message: "Junction 'a2' duplicates the point of 'a1'"
		}
	});
	rows.push({
		id: 'd-zero-length-wall-fixture',
		covers: 'OR-3d',
		document: correctnessFixture('class4-zero-length-wall-v1'),
		intent: junctionMoveBy(correctnessFixture('class4-zero-length-wall-v1'), 'j-a', [0, 0]),
		expected: {
			status: 'known-invalid',
			code: 'duplicate_junction_point',
			message: "Junction 'j-b' duplicates the point of 'j-a'"
		}
	});
	rows.push({
		id: 'd-self-intersection',
		covers: 'OR-3d',
		document: correctnessFixture('class4-self-intersection-v1'),
		intent: junctionMoveBy(correctnessFixture('class4-self-intersection-v1'), 'j-a', [0, 0]),
		expected: {
			status: 'known-invalid',
			code: 'unsupported_wall_topology',
			message: "Wall 'wall-self-crossing' centerline intersects itself"
		}
	});
	rows.push({
		id: 'd-coincident-component-junctions',
		covers: 'OR-3d',
		document: correctnessFixture('class4-component-duplicate-junction-v1'),
		intent: junctionMoveBy(correctnessFixture('class4-component-duplicate-junction-v1'), 'p-a', [0, 0]),
		expected: {
			status: 'known-invalid',
			code: 'duplicate_junction_point',
			message: "Junction 'p-dup' duplicates the point of 'p-b'"
		}
	});

	// ---- ISSUE ORDER: an earlier stage wins while the later defect is proven --
	// Stage 1 (Junction coincidence) against stage 3 (Wall-pair classification):
	// the crossed baseline is edited to introduce coincident Junctions, and the
	// control is the SAME baseline with a patch that does not.
	// Stage 1 (Junction coincidence) against stage 4 (curve crossing): the crossed
	// baseline is edited to introduce coincident Junctions, and the control is the
	// SAME baseline with a patch that does not — so the crossing is proven to be
	// present while the Junction stage is the one that reports.
	const crossed = crossRoomDocument([12, 9]);
	const crossedControl = crossRoomDocument([12, 9]);
	rows.push({
		id: 'order-junction-stage-before-crossing-stage',
		covers: 'OR-3 issue order',
		document: crossed,
		intent: junctionMove('a3', [0, 0]),
		expected: {
			status: 'known-invalid',
			code: 'duplicate_junction_point',
			message: "Junction 'a3' duplicates the point of 'a0'"
		},
		laterDefect: {
			control: { document: crossedControl, intent: junctionMoveBy(crossedControl, 'a3', [0, 0.02]) },
			expected: {
				status: 'known-invalid',
				code: 'unsupported_wall_topology',
				message: "Walls 'r1-east' and 'r2-south' cross away from their shared Junction"
			}
		}
	});

	// ---- OR-8: the lifecycle baseline a scope must not leak across -----------
	// The refusal is recorded, and the untouched baseline's own verdict is
	// recorded beside it, so a later scoped run has both ends of the pair to hit.
	rows.push({
		id: 'or8-refusal',
		covers: 'OR-8',
		document: sharedRoomDocument(true),
		intent: junctionMove('a2', [8, 0]),
		expected: {
			status: 'known-invalid',
			code: 'duplicate_junction_point',
			message: "Junction 'a2' duplicates the point of 'a1'"
		}
	});
	rows.push({
		id: 'or8-untouched-baseline',
		covers: 'OR-8',
		document: sharedRoomDocument(true),
		intent: junctionMoveBy(sharedRoomDocument(true), 'a3', [0, 0.05]),
		expected: PENDING
	});

	// ---- Unterivable intents: `pending` is the contract ----------------------
	rows.push({
		id: 'underivable-unknown-wall',
		covers: 'OR-3d',
		document: sharedRoomDocument(false),
		intent: { kind: 'wall-move', wallId: 'no-such-wall', delta: [1, 0] },
		expected: PENDING
	});
	rows.push({
		id: 'underivable-non-finite-point',
		covers: 'OR-3d',
		document: sharedRoomDocument(false),
		intent: junctionMove('a1', [Number.NaN, 0]),
		expected: PENDING
	});

	return rows;
}
