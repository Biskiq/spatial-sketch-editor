/**
 * The supported authored-geometry envelope.
 *
 * One measured limit (`MAX_LAYOUT_DIMENSION_METERS`, see
 * `packages/layout-core/src/layout-geometry-limits.ts`) refuses oversized
 * dimensions and Wall spans at every authoring entry point and at import:
 *
 * 1. the exact-length, Junction, chain and curve-knot planners refuse just over
 *    the limit while accepting just under it and the limit itself (the 1,000 m
 *    path from PR #235 stays inside the envelope);
 * 2. Wall height/thickness and Opening measures carry the same limit;
 * 3. a source whose geometry exceeds the envelope is refused by the canonical
 *    read validator, so imported geometry never reaches the compiler or Stage;
 * 4. a refusal writes nothing: every planner returns without a candidate.
 */
import { describe, expect, it } from 'vitest';
import {
	MAX_LAYOUT_DIMENSION_METERS,
	LAYOUT_DIMENSION_LIMIT_MESSAGE,
	createEmptyWallFirstLayoutDocument,
	planConvertWallToCurve,
	planCreateWallFirstOpening,
	planExactJunctionMove,
	planExactRectangleDimensions,
	planExactWallHeight,
	planExactWallLength,
	planExactWallThickness,
	planMoveWallCurveKnot,
	planUpdateWallFirstOpening,
	planWallChain,
	validateWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import { validateProjectEnvelope } from '@portfolio/project-model/units';
import { admitSource } from '$lib/authoring/stage/source-admission';
import { createUnitProject } from './__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

const LIMIT = MAX_LAYOUT_DIMENSION_METERS;
const OVER_LIMIT = LIMIT + 0.001;

/** An open two-Junction Wall, so a length edit has no Room to reconcile. */
function standaloneWall(length = 6): { document: LayoutDocumentWallFirst; wallId: string } {
	const baseline = createEmptyWallFirstLayoutDocument();
	const planned = planWallChain({
		baseline,
		points: [[0, 0], [length, 0]],
		close: false,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (planned.kind !== 'success') throw new Error(`the dimension fixture was refused: ${planned.rejection.code}`);
	return { document: planned.document, wallId: planned.document.walls[0]!.id };
}

/** The same two-Junction Wall closed into a four-Wall Room at `size`. */
function enclosure(size: number): LayoutDocumentWallFirst {
	const baseline = createEmptyWallFirstLayoutDocument();
	const planned = planWallChain({
		baseline,
		points: [[0, 0], [size, 0], [size, size / 1.5], [0, size / 1.5]],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (planned.kind !== 'success') throw new Error(`the enclosure fixture was refused: ${planned.rejection.code}`);
	return planned.document;
}

describe('the supported geometry dimension', () => {
	it('accepts the limit and just under it, and refuses just over it with one message', () => {
		const { document, wallId } = standaloneWall();
		const before = JSON.stringify(document);

		const justUnder = planExactWallLength(document, { wallId, length: LIMIT - 0.001, fixedEndpoint: 'start' });
		expect(justUnder.kind).toBe('success');

		const atLimit = planExactWallLength(document, { wallId, length: LIMIT, fixedEndpoint: 'start' });
		expect(atLimit.kind).toBe('success');

		const justOver = planExactWallLength(document, { wallId, length: OVER_LIMIT, fixedEndpoint: 'start' });
		expect(justOver).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'dimension_out_of_range', message: LAYOUT_DIMENSION_LIMIT_MESSAGE }
		});

		// A refused plan is a pure read: the accepted source is byte-identical.
		expect(JSON.stringify(document)).toBe(before);
	});

	it('accepts exactly 1,000 m on a diagonal Wall, where the direction round trip is one ULP over', () => {
		const baseline = createEmptyWallFirstLayoutDocument();
		const planned = planWallChain({
			baseline,
			// 1-6 is not a Pythagorean direction: the normalized round trip lands a
			// floating-point ULP above 1,000 m. The limit must still accept the value
			// the creator typed, or the 1,000 m optimization would be orientation-dependent.
			points: [[0, 0], [6, 1]],
			close: false,
			capture: freshCapture(),
			levelId: baseline.floor.id
		});
		if (planned.kind !== 'success') throw new Error(planned.rejection.code);
		const result = planExactWallLength(planned.document, {
			wallId: planned.document.walls[0]!.id,
			length: LIMIT,
			fixedEndpoint: 'start'
		});
		expect(result.kind).toBe('success');
	});

	it('refuses an oversized Junction move and accepts the same move just under the limit', () => {
		const { document, wallId } = standaloneWall();
		const wall = document.walls.find((candidate) => candidate.id === wallId)!;
		const before = JSON.stringify(document);

		const accepted = planExactJunctionMove(document, wall.endJunctionId, [LIMIT - 0.001, 0]);
		expect(accepted.kind).toBe('success');

		const refused = planExactJunctionMove(document, wall.endJunctionId, [OVER_LIMIT, 0]);
		expect(refused).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'dimension_out_of_range', message: LAYOUT_DIMENSION_LIMIT_MESSAGE }
		});
		expect(JSON.stringify(document)).toBe(before);
	});

	it('refuses an oversized Wall chain leg before noding or compiling it', () => {
		const baseline = createEmptyWallFirstLayoutDocument();
		const refused = planWallChain({
			baseline,
			points: [[0, 0], [OVER_LIMIT, 0]],
			close: false,
			capture: freshCapture(),
			levelId: baseline.floor.id
		});
		expect(refused).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'dimension_out_of_range', message: LAYOUT_DIMENSION_LIMIT_MESSAGE }
		});

		const accepted = planWallChain({
			baseline,
			points: [[0, 0], [LIMIT, 0]],
			close: false,
			capture: freshCapture(),
			levelId: baseline.floor.id
		});
		expect(accepted.kind).toBe('success');
	});

	it('refuses a rectangle width past the limit and accepts one just under it', () => {
		const document = enclosure(6);
		const roomId = document.rooms[0]!.id;
		const before = JSON.stringify(document);

		expect(planExactRectangleDimensions(document, roomId, LIMIT - 1, 4).kind).toBe('success');
		const refused = planExactRectangleDimensions(document, roomId, OVER_LIMIT, 4);
		expect(refused).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'dimension_out_of_range', message: LAYOUT_DIMENSION_LIMIT_MESSAGE }
		});
		expect(JSON.stringify(document)).toBe(before);
	});

	it('refuses dragging a bend point far enough to stretch the control polygon past the limit', () => {
		const { document, wallId } = standaloneWall();
		const curved = planConvertWallToCurve(document, wallId);
		if (curved.kind !== 'success') throw new Error(`the curve fixture was refused: ${curved.rejection.code}`);
		const wall = curved.document.walls.find((candidate) => candidate.id === wallId)!;
		if (wall.centerline.kind !== 'cubic-chain') throw new Error('the fixture is not a cubic chain');
		const knotId = wall.centerline.knots[0]!.id;
		const before = JSON.stringify(curved.document);

		const refused = planMoveWallCurveKnot(curved.document, wallId, knotId, [OVER_LIMIT, 0]);
		expect(refused).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'dimension_out_of_range', message: LAYOUT_DIMENSION_LIMIT_MESSAGE }
		});
		expect(JSON.stringify(curved.document)).toBe(before);
	});

	it('refuses oversized Wall height and thickness and Opening measures', () => {
		const { document, wallId } = standaloneWall();

		expect(planExactWallHeight(document, wallId, LIMIT - 0.001).kind).toBe('success');
		expect(planExactWallHeight(document, wallId, OVER_LIMIT)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'dimension_out_of_range', message: LAYOUT_DIMENSION_LIMIT_MESSAGE }
		});

		expect(planExactWallThickness(document, wallId, LIMIT - 0.001).kind).toBe('success');
		expect(planExactWallThickness(document, wallId, OVER_LIMIT)).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'dimension_out_of_range', message: LAYOUT_DIMENSION_LIMIT_MESSAGE }
		});

		const opening = planCreateWallFirstOpening(
			document,
			{ wallId, kind: 'door', offset: 1, width: 1, height: 2.1, sillHeight: 0 },
			freshCapture(),
			document.floor.id
		);
		if (opening.kind === 'rejected') throw new Error(`the Opening fixture was refused: ${opening.rejection.code}`);
		const openingId = opening.changedOpeningIds[0]!;
		expect(
			planCreateWallFirstOpening(
				opening.document,
				{ wallId, kind: 'door', offset: 1, width: OVER_LIMIT, height: 2.1, sillHeight: 0 },
				freshCapture(),
				document.floor.id
			)
		).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'dimension_out_of_range', message: LAYOUT_DIMENSION_LIMIT_MESSAGE }
		});
		expect(planUpdateWallFirstOpening(opening.document, openingId, { width: OVER_LIMIT })).toMatchObject({
			kind: 'rejected',
			rejection: { code: 'dimension_out_of_range', message: LAYOUT_DIMENSION_LIMIT_MESSAGE }
		});
	});
});

describe('the supported geometry envelope at import', () => {
	it('keeps a 1,000 m Room inside the envelope', () => {
		const document = enclosure(LIMIT);
		const validated = validateWallFirstLayoutDocument(document);
		expect(validated.success).toBe(true);
	});

	it('refuses a legacy-sized Wall span in the canonical read validator', () => {
		const document = enclosure(6);
		// Scale every Junction by 2000/6: the Room stays connected and its long
		// Wall now spans 2,000 m, outside the supported envelope.
		const scale = 2000 / 6;
		const oversized: LayoutDocumentWallFirst = {
			...document,
			junctions: document.junctions.map((junction) => ({
				...junction,
				point: [junction.point[0] * scale, junction.point[1] * scale] as LayoutVec2
			}))
		};
		const validated = validateWallFirstLayoutDocument(oversized);
		expect(validated.success).toBe(false);
		if (validated.success) return;
		const issue = validated.issues.find((candidate) => candidate.code === 'dimension_out_of_range');
		expect(issue).toBeDefined();
		expect(issue!.message).toContain(`geometry is limited to ${LIMIT} m`);
	});

	it('refuses an imported envelope whose Layout carries an oversized Wall before admission', async () => {
		const document = enclosure(6);
		const project = await createUnitProject({
			id: 'project-dimension-limit',
			name: 'Oversized imported geometry',
			layout: document
		});
		// The shape a source JSON open arrives in: the same envelope, with a Layout
		// whose Junction coordinates were authored outside the supported envelope.
		const scale = 2000 / 6;
		const oversized: LayoutDocumentWallFirst = {
			...document,
			junctions: document.junctions.map((junction) => ({
				...junction,
				point: [junction.point[0] * scale, junction.point[1] * scale] as LayoutVec2
			}))
		};
		const imported = {
			...project,
			units: { ...project.units, layout: { ...project.units.layout, data: oversized } }
		};
		const read = validateProjectEnvelope(imported);
		expect(read.success).toBe(false);
		if (read.success) return;
		expect(read.issues.some((issue) => issue.code === 'dimension_out_of_range')).toBe(true);

		const admitted = await admitSource(imported, {
			sessionEpoch: 'session-dimension-limit',
			acceptedRevision: { projectId: 'project-dimension-limit', revisionId: 'revision-boot' }
		});
		expect(admitted).toMatchObject({ kind: 'refused', reason: 'dimension-limit' });
		if (admitted.kind !== 'refused') return;
		expect(admitted.issues.length).toBeGreaterThan(0);
		expect(admitted.issues.every((issue) => issue.code === 'dimension_out_of_range')).toBe(true);
	});
});
