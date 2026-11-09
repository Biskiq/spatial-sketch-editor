/**
 * T1 C1 — curved-Wall prerequisites.
 *
 * The Bend gesture needs one addressable curved frame before any editor surface
 * can exist: a sampled arc length (never the chord), an arc-distance inverse
 * that names the same place a station does, and one captured-identity intent
 * whose planner is registered under the shared Layout admission. These are the
 * contracts the marks and the pointer path consume, proved against the real
 * retained planners rather than a hand-built centerline.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	planBendWallCurveKnot,
	planWallChain,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

import {
	LAYOUT_WALL_BEND_KIND,
	createLayoutPlanners,
	curvedWallFrame,
	curvedWallPointAt,
	wallBendIntent
} from '$lib/authoring/adapters/layout/precision';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';

function straightWall(): { document: LayoutDocumentWallFirst; wallId: string } {
	const base = createEmptyWallFirstLayoutDocument();
	const chained = planWallChain({
		baseline: base,
		points: [
			[0, 0],
			[6, 0]
		],
		close: false,
		capture: freshCapture(),
		levelId: base.floor.id
	});
	if (chained.kind !== 'success') throw new Error('the fixture Wall was refused');
	return { document: chained.document, wallId: chained.document.walls[0]!.id };
}

function bentWall(): { document: LayoutDocumentWallFirst; wallId: string } {
	const straight = straightWall();
	const bent = planBendWallCurveKnot(
		straight.document,
		straight.wallId,
		{ distance: 3, point: [3, 1.5] },
		{ knotId: 'knot-prerequisite' }
	);
	if (bent.kind !== 'success') {
		throw new Error(`the fixture bend was refused: ${bent.rejection.message}`);
	}
	return { document: bent.document, wallId: straight.wallId };
}

describe('C1 curved Wall frame', () => {
	it('has no curved frame for a straight Wall', () => {
		const { document, wallId } = straightWall();
		expect(curvedWallFrame(document, wallId)).toBeNull();
	});

	it('reads the sampled arc length, never the chord', () => {
		const { document, wallId } = bentWall();
		const frame = curvedWallFrame(document, wallId);
		expect(frame).not.toBeNull();
		// The bowed path is longer than the 6 m chord; a frame that reported 6
		// would place every Opening station in the wrong place.
		expect(frame!.length).toBeGreaterThan(6);
		expect(frame!.samples.length).toBeGreaterThan(1);
		expect(frame!.samples.at(-1)!.distance).toBeCloseTo(frame!.length, 9);
		expect(frame!.start[0]).toBeCloseTo(0, 9);
		expect(frame!.start[1]).toBeCloseTo(0, 9);
		expect(frame!.end[0]).toBeCloseTo(6, 9);
		expect(frame!.end[1]).toBeCloseTo(0, 9);
	});

	it('inverts an arc distance to the same place and refuses outside the span', () => {
		const { document, wallId } = bentWall();
		const frame = curvedWallFrame(document, wallId)!;
		const start = curvedWallPointAt(frame, 0)!;
		const end = curvedWallPointAt(frame, frame.length)!;
		expect(start.point[0]).toBeCloseTo(0, 9);
		expect(start.point[1]).toBeCloseTo(0, 9);
		expect(end.point[0]).toBeCloseTo(6, 9);
		expect(end.point[1]).toBeCloseTo(0, 9);
		// A station outside the Wall is refused, never clamped onto an endpoint.
		expect(curvedWallPointAt(frame, -0.001)).toBeNull();
		expect(curvedWallPointAt(frame, frame.length + 0.001)).toBeNull();
		// The grab station sits on the bowed side, so the address is not the chord.
		const middle = curvedWallPointAt(frame, frame.length / 2)!;
		expect(Math.abs(middle.point[1])).toBeGreaterThan(0.1);
	});
});

describe('C1 Bend intent and planner', () => {
	it('captures the station, point and knot id in one bend intent', () => {
		const intent = wallBendIntent({
			wallId: 'wall-a',
			distance: 2.5,
			point: [2.5, 1],
			knotId: 'knot-captured',
			operationId: 'operation-1',
			projectId: 'project-1',
			revisionId: 'revision-1',
			contentRevision: 'content-1',
			levelId: 'level-1'
		});
		expect(intent.kind).toBe(LAYOUT_WALL_BEND_KIND);
		expect(intent.payload).toEqual({
			wallId: 'wall-a',
			distance: 2.5,
			x: 2.5,
			z: 1,
			knotId: 'knot-captured'
		});
		expect(intent.targets[0]!.subject).toEqual({ kind: 'wall', id: 'wall-a' });
	});

	it('registers the bend planner under the shared Layout admission', () => {
		const planner = createLayoutPlanners().find(
			(candidate) => candidate.kind === LAYOUT_WALL_BEND_KIND
		);
		expect(planner).toBeDefined();
		expect(planner!.admission.domain).toBe('layout');
	});
});
