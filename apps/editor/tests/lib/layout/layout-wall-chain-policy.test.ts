/**
 * T1.P02.S02 — the drawing policy's bounded refusals.
 *
 * The phase's owner-accepted policy (2026-10-22) is narrower than what the
 * document format tolerates: while a creator *draws*, a crossing without a
 * Junction, a point that merely lands on a Wall's interior, and a closed ring
 * nested inside a Room without sharing a Junction with it all refuse in words,
 * with a repair, and leave no partial source.
 *
 * `detectUnsupportedChainConnections` is that refusal, and these tests pin the
 * two halves a defect could get wrong in a browser and nowhere else: the
 * *refusals* (permitted-looking overlap authored by accident) and the
 * *permissions* (refusing a join the creator deliberately declared, which would
 * make deliberate drawing impossible). The declared-anchor cases are the load
 * bearing half — `planWallChain` treats a declared anchor as the operation's
 * statement of connection, so the policy must read the same declaration and not
 * a second, stricter rule of its own.
 */
import { describe, expect, it } from 'vitest';
import {
	classifyWallIntersection,
	createEmptyWallFirstLayoutDocument,
	detectUnsupportedChainConnections,
	planInsertWallCurveKnot,
	planMoveWallCurveKnot,
	planWallChain,
	wallCenterlineSamples,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type WallEndpointJunctionSnap
} from '@portfolio/layout-core';
import { freshCapture } from './__fixtures__/layout-id-capture';

const p = (x: number, z: number): LayoutVec2 => [x, z];

/** Empty wall-first document with a real floor record. */
function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return { ...document, floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 } };
}

/**
 * Commit one chain through the canonical planner, returning the new document.
 *
 * A caller that means to extend existing topology **declares** the Junction it
 * draws from (`endpointJunctionSnaps`); without the declaration the chain is
 * independent placement and mints its own Junction even at a coordinate an
 * existing one occupies, which would make every co-located fixture two
 * components and this suite's component assertions meaningless.
 */
function chain(
	baseline: LayoutDocumentWallFirst,
	points: readonly LayoutVec2[],
	close = false,
	endpointJunctionSnaps?: readonly WallEndpointJunctionSnap[]
): LayoutDocumentWallFirst {
	const plan = planWallChain({
		baseline,
		points,
		close,
		capture: freshCapture(),
		levelId: baseline.floor.id,
		...(endpointJunctionSnaps === undefined ? {} : { endpointJunctionSnaps })
	});
	if (plan.kind !== 'success') {
		throw new Error(`fixture chain rejected: ${JSON.stringify(plan.kind === 'rejected' ? plan.rejection : plan)}`);
	}
	return plan.document;
}

/** The authored Wall joining two points, by its endpoints' coordinates. */
function wallBetween(document: LayoutDocumentWallFirst, first: LayoutVec2, second: LayoutVec2): string {
	const pointOf = (junctionId: string) =>
		document.junctions.find((junction) => junction.id === junctionId)?.point;
	const same = (a: LayoutVec2 | undefined, b: LayoutVec2) => a !== undefined && a[0] === b[0] && a[1] === b[1];
	const wall = document.walls.find((candidate) => {
		const start = pointOf(candidate.startJunctionId);
		const end = pointOf(candidate.endJunctionId);
		return (same(start, first) && same(end, second)) || (same(start, second) && same(end, first));
	});
	if (wall === undefined) throw new Error(`no Wall joins ${JSON.stringify([first, second])}`);
	return wall.id;
}

describe('T1.P02.S02 — drawing policy refusals', () => {
	it('refuses a leg that crosses a Wall the operation does not join', () => {
		const baseline = chain(baseDocument(), [p(0, 0), p(4, 0)]);
		const host = wallBetween(baseline, p(0, 0), p(4, 0));

		const rejection = detectUnsupportedChainConnections({
			baseline,
			points: [p(2, -2), p(2, 2)],
			close: false
		});
		expect(rejection).toMatchObject({ code: 'unconnected_crossing', wallIds: [host] });
		// The words name the repair, not only the fault.
		expect(rejection?.message).toContain(host);
		expect(rejection?.message.length ?? 0).toBeGreaterThan(40);

		// The same draft is allowed once the operation **declares** that host: the
		// planner splits the Wall there and the creator asked for it.
		expect(
			detectUnsupportedChainConnections({
				baseline,
				points: [p(2, -2), p(2, 2)],
				close: false,
				endpointHostSnaps: [{ pointIndex: 1, wallId: host }]
			})
		).toBeNull();
	});

	it('refuses a point that merely lands on a Wall, and allows the declared host', () => {
		const baseline = chain(baseDocument(), [p(0, 0), p(4, 0)]);
		const host = wallBetween(baseline, p(0, 0), p(4, 0));

		// Nearness never adopts a coordinate: the chain stops ON the Wall without
		// declaring it, which is exactly the accident the policy refuses.
		expect(
			detectUnsupportedChainConnections({ baseline, points: [p(2, -2), p(2, 0)], close: false })
		).toMatchObject({ code: 'unconnected_interior_contact', wallIds: [host] });

		// Declared, the same geometry is the deliberate interior split.
		expect(
			detectUnsupportedChainConnections({
				baseline,
				points: [p(2, -2), p(2, 0)],
				close: false,
				endpointHostSnaps: [{ pointIndex: 1, wallId: host }]
			})
		).toBeNull();
	});

	it('allows crossing inside the connected group the operation declared', () => {
		// Two Walls sharing a Junction are one topology component: declaring the
		// operation on either one names the group, and in-group noding is the
		// planner's own business.
		const first = chain(baseDocument(), [p(0, 0), p(4, 0)]);
		const corner = first.junctions.find((junction) => junction.point[0] === 4 && junction.point[1] === 0)!;
		const baseline = chain(first, [p(4, 0), p(4, 3)], false, [{ pointIndex: 0, junctionId: corner.id }]);
		const west = wallBetween(baseline, p(0, 0), p(4, 0));
		const north = wallBetween(baseline, p(4, 0), p(4, 3));
		expect(west).not.toBe(north);

		expect(
			detectUnsupportedChainConnections({
				baseline,
				points: [p(2, -1), p(2, 1)],
				close: false,
				endpointHostSnaps: [{ pointIndex: 1, wallId: north }]
			})
		).toBeNull();

		// Positive control: the same draft on a Wall of a **different** component
		// still refuses, so the permission above is the declaration and not a
		// blanket "something was declared".
		const separate = chain(baseline, [p(0, 8), p(4, 8)]);
		expect(
			detectUnsupportedChainConnections({
				baseline: separate,
				points: [p(2, 7), p(2, 9)],
				close: false,
				endpointHostSnaps: [{ pointIndex: 1, wallId: north }]
			})
		).toMatchObject({ code: 'unconnected_crossing' });
	});

	it('refuses a ring nested in a Room without a shared Junction, and allows a connected one', () => {
		const baseline = chain(baseDocument(), [p(0, 0), p(4, 0), p(4, 3), p(0, 3)], true);
		expect(baseline.rooms).toHaveLength(1);
		const room = baseline.rooms[0]!;

		// Strictly inside: every vertex is in the Room, none of them is a Junction of
		// its boundary, so the ring would be a courtyard the format cannot express.
		const nested = detectUnsupportedChainConnections({
			baseline,
			points: [p(1, 1), p(2, 1), p(2, 2), p(1, 2)],
			close: true
		});
		expect(nested).toMatchObject({ code: 'nested_ring_without_shared_junction' });
		expect(nested?.wallIds).toEqual(room.boundary.map((ref) => ref.wallId));

		// A ring that crosses the Room's boundary refuses as the crossing it is: the
		// crossing rule is read first, so the repair names the right problem.
		expect(
			detectUnsupportedChainConnections({
				baseline,
				points: [p(1, 1), p(5, 1), p(5, 2), p(1, 2)],
				close: true
			})
		).toMatchObject({ code: 'unconnected_crossing' });

		// The same enclosed ring, drawn from a Junction of that Room, is connected
		// work: the creator declared the anchor, and the policy allows it.
		const corner = baseline.junctions.find((junction) => junction.point[0] === 0 && junction.point[1] === 0)!;
		expect(
			detectUnsupportedChainConnections({
				baseline,
				points: [p(0, 0), p(1, 0), p(1, 1), p(0, 1)],
				close: true,
				endpointJunctionSnaps: [{ pointIndex: 0, junctionId: corner.id }]
			})
		).toBeNull();
	});

	it('answers nothing for a draft that names no leg', () => {
		const baseline = chain(baseDocument(), [p(0, 0), p(4, 0)]);
		// One point is not a chain yet; the planner's own `insufficient_chain` owns it.
		expect(detectUnsupportedChainConnections({ baseline, points: [p(2, 2)], close: false })).toBeNull();
		// A repeated point names no segment either.
		expect(
			detectUnsupportedChainConnections({ baseline, points: [p(2, 2), p(2, 2)], close: false })
		).toBeNull();
	});
});

/**
 * A curved host Wall: the chain `(0, 0) → (6, 0)` bent at its own midpoint up to
 * `(3, 2.5)` through the canonical curve planners, so the Wall's endpoint chord
 * and its real centerline disagree in exactly the two ways a drawing policy has
 * to answer — a leg the arc crosses and the chord does not, and a leg the chord
 * crosses and the arc does not.
 */
function curvedBaseline(): { baseline: LayoutDocumentWallFirst; wallId: string } {
	const straight = chain(baseDocument(), [p(0, 0), p(6, 0)]);
	const wallId = wallBetween(straight, p(0, 0), p(6, 0));
	const inserted = planInsertWallCurveKnot(straight, wallId, 3, { knotId: 'bend-1' });
	if (inserted.kind !== 'success') throw new Error(`curve fixture: ${JSON.stringify(inserted)}`);
	const bent = planMoveWallCurveKnot(inserted.document, wallId, 'bend-1', p(3, 2.5));
	if (bent.kind !== 'success') throw new Error(`curve fixture: ${JSON.stringify(bent)}`);
	return { baseline: bent.document, wallId };
}

/** The host Wall's canonical sampled centerline, as the kernel reads it. */
function hostSamples(baseline: LayoutDocumentWallFirst, wallId: string) {
	const wall = baseline.walls.find((candidate) => candidate.id === wallId)!;
	const start = baseline.junctions.find((junction) => junction.id === wall.startJunctionId)!.point;
	const end = baseline.junctions.find((junction) => junction.id === wall.endJunctionId)!.point;
	const sampled = wallCenterlineSamples(wall, start, end, 'forward');
	if (!sampled) throw new Error('the curve fixture does not sample');
	return sampled.samples;
}

describe('T1.P02.S02 — drawing policy reads the Wall geometry the document stores', () => {
	it('refuses a leg the curved centerline crosses while the endpoint chord is clear', () => {
		const { baseline, wallId } = curvedBaseline();
		const host = baseline.walls.find((candidate) => candidate.id === wallId)!;
		const start = baseline.junctions.find((junction) => junction.id === host.startJunctionId)!.point;
		const end = baseline.junctions.find((junction) => junction.id === host.endJunctionId)!.point;
		// A point ON the bow's own left branch (one the document really has), reached
		// by a horizontal leg from outside the Wall.
		const onArc = hostSamples(baseline, wallId).find(
			(sample) => sample.point[0] > 0.5 && sample.point[0] < 3 && sample.point[1] > 0.8
		)!.point;
		const leg: [LayoutVec2, LayoutVec2] = [p(-1, onArc[1]), p(onArc[0] + 1, onArc[1])];
		// The chord the old reading used is clear: this refusal can only come from the
		// arc the creator actually drew into.
		expect(classifyWallIntersection({ id: 'leg', start: leg[0], end: leg[1] }, { id: wallId, start, end })).toMatchObject({
			kind: 'none'
		});

		expect(detectUnsupportedChainConnections({ baseline, points: leg, close: false })).toMatchObject({
			code: 'unconnected_crossing',
			wallIds: [wallId]
		});

		// The deliberate repair the words name: declaring the host allows the same
		// draft, because the planner owns the split it implies.
		expect(
			detectUnsupportedChainConnections({
				baseline,
				points: leg,
				close: false,
				endpointHostSnaps: [{ pointIndex: 1, wallId }]
			})
		).toBeNull();
	});

	it('allows a leg that only crosses the chord where the curved Wall has no geometry', () => {
		const { baseline, wallId } = curvedBaseline();
		const host = baseline.walls.find((candidate) => candidate.id === wallId)!;
		const start = baseline.junctions.find((junction) => junction.id === host.startJunctionId)!.point;
		const end = baseline.junctions.find((junction) => junction.id === host.endJunctionId)!.point;
		// Straight up through the chord's midpoint: under the bow, clear of the arc.
		const points = [p(3, -1), p(3, 1)];
		expect(
			classifyWallIntersection({ id: 'leg', start: points[0]!, end: points[1]! }, { id: wallId, start, end })
		).toMatchObject({ kind: 'proper-crossing' });

		expect(detectUnsupportedChainConnections({ baseline, points, close: false })).toBeNull();
		// The permission is real work, not a refusal one layer down: the canonical
		// planner accepts the same draft against the same baseline.
		const plan = planWallChain({
			baseline,
			points,
			close: false,
			capture: freshCapture(),
			levelId: baseline.floor.id
		});
		expect(plan.kind).toBe('success');
	});

	it('leaves an undeclared coincidence at the curved Wall\u2019s own station alone, but not a crossing', () => {
		const { baseline } = curvedBaseline();
		const samples = hostSamples(baseline, baseline.walls[0]!.id);
		const station = samples[0]!.point;
		// A leg that leaves the station below the bow touches the Wall at that one
		// point: an undeclared coincidence between independent groups is permitted
		// geometry, exactly as it is for a straight host.
		expect(
			detectUnsupportedChainConnections({ baseline, points: [station, p(1.5, 0.2)], close: false })
		).toBeNull();

		// The same start, aimed THROUGH the bow: the station coincidence is ignored
		// and the crossing it really makes is what refuses.
		const through = samples.find(
			(sample) => sample.point[0] > 0.5 && sample.point[0] < 3 && sample.point[1] > 0.8
		)!.point;
		expect(
			detectUnsupportedChainConnections({
				baseline,
				points: [station, p(through[0] + 1, through[1])],
				close: false
			})
		).toMatchObject({ code: 'unconnected_crossing' });
	});
});
