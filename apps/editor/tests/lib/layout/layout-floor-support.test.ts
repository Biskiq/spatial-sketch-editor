/**
 * T2.P01.S01 exit criteria 1 — the Layout-owned floor-support query and chooser.
 *
 * The suite is split by contract, not by size:
 *
 * - **Real compiled Layout.** The query is exercised against canonical compiler
 *   output for a genuinely compiled Room, so elevation, correspondence and
 *   membership come from the features the planner will actually be handed. The
 *   current format compiles every Room floor at one datum, and that property is
 *   pinned here so a future multi-datum format fails loudly instead of
 *   resolving an elevation silently.
 * - **Constructed records.** Elevation ambiguity, coincident equivalent
 *   supports, ordering and the fact refusals cannot all be produced by today's
 *   single-datum format, so they are proven on constructed compiled records —
 *   the compiler is not bent to make a defect case.
 * - **Membership arithmetic** and **the chooser** are their own contracts: one
 *   is point-in-polygon with a declared tolerance, the other is the rule that no
 *   elevation is ever chosen for the creator.
 *
 * Nothing here mutates its input: the compiled geometry is deep-frozen and every
 * query runs against it.
 */
import { describe, expect, it } from 'vitest';
import {
	FLOOR_SUPPORT_TOLERANCES,
	FLOOR_SUPPORT_UP_NORMAL,
	chooseFloorSupport,
	compileWallFirstLayoutGeometry,
	floorSupportSnapshotOf,
	planWallChain,
	polygonContainsWithTolerance,
	queryFloorSupports,
	type FloorSupportCandidate,
	type FloorSupportQueryPolygon,
	type FloorSupportSnapshot,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';
import { baseDocument, p } from '../../helpers/angled-plan-fixtures';
import { freshCapture } from './__fixtures__/layout-id-capture';

/** A 7 m x 6 m rectangle enclosure: one reconciled Room at the floor datum. */
const RECT = [p(0, -4), p(7, -4), p(7, 2), p(0, 2)];
const INTERIOR = p(3, -1);
const OUTSIDE = p(100, 100);

function enclosure(floorElevation = 0): LayoutDocumentWallFirst {
	const baseline = baseDocument();
	if (floorElevation === 0) return closeChain(baseline);
	return closeChain({
		...baseline,
		floor: { ...baseline.floor, elevation: floorElevation }
	});
}

function closeChain(baseline: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	const plan = planWallChain({ baseline, points: RECT, close: true, capture: freshCapture(), levelId: baseline.floor.id });
	if (plan.kind !== 'success') throw new Error(`enclosure failed: ${JSON.stringify(plan)}`);
	return plan.document;
}

function compiledGeometry(floorElevation = 0) {
	const result = compileWallFirstLayoutGeometry(enclosure(floorElevation));
	expect(result.issues.filter((issue) => issue.severity !== 'warning')).toEqual([]);
	expect(result.geometry.rooms).toHaveLength(1);
	return result.geometry;
}

function polygonRecord(
	overrides: Partial<FloorSupportQueryPolygon> & { id: string }
): FloorSupportQueryPolygon {
	return {
		kind: 'room-floor',
		floorId: 'floor-1',
		roomId: 'room-1',
		cacheKey: `${overrides.id}:cache`,
		sourceId: `${overrides.id}:source`,
		polygon: RECT,
		...overrides
	};
}

function snapshotOf(
	floors: FloorSupportSnapshot['floors'],
	rooms: FloorSupportSnapshot['rooms'],
	queryPolygons: FloorSupportSnapshot['queryPolygons']
): FloorSupportSnapshot {
	return { floors, rooms, queryPolygons };
}

function candidateOf(
	elevation: number,
	orderKey: string,
	roomId: string
): FloorSupportCandidate {
	return {
		queryPoint: [3, -1],
		elevation,
		upNormal: [...FLOOR_SUPPORT_UP_NORMAL],
		generationId: 'generation-1',
		witnesses: [
			{
				floorId: 'floor-1',
				roomId,
				recordId: `${roomId}:record`,
				cacheKey: `${roomId}:cache`,
				sourceId: `${roomId}:source`,
				orderKey
			}
		],
		orderKey,
		label: `Floor floor-1 / Room ${roomId}`
	};
}

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object') {
		for (const key of Object.keys(value as object)) {
			deepFreeze((value as Record<string, unknown>)[key]);
		}
		Object.freeze(value);
	}
	return value;
}

describe('floor-support query over the canonical compiled Layout', () => {
	it('resolves the compiled Room floor under a point and echoes the compile generation', () => {
		const geometry = compiledGeometry();
		const room = geometry.rooms[0]!;
		const result = queryFloorSupports(floorSupportSnapshotOf(geometry), {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});

		expect(result.kind).toBe('candidates');
		if (result.kind !== 'candidates') return;
		expect(result.candidates).toHaveLength(1);
		const support = result.candidates[0]!;
		expect(support.elevation).toBe(room.floorElevation);
		expect(support.elevation).toBe(0);
		expect(support.upNormal).toEqual(FLOOR_SUPPORT_UP_NORMAL);
		expect(support.generationId).toBe('generation-1');
		expect(support.witnesses.map((witness) => witness.roomId)).toEqual([room.roomId]);
		expect(support.witnesses[0]!.floorId).toBe(geometry.floors[0]!.floorId);
		expect(support.orderKey).toBe(support.witnesses[0]!.orderKey);
	});

	it('reports no support outside every compiled floor', () => {
		const geometry = compiledGeometry();
		const result = queryFloorSupports(floorSupportSnapshotOf(geometry), {
			generationId: 'generation-1',
			x: OUTSIDE[0],
			z: OUTSIDE[1]
		});
		expect(result.kind).toBe('none');
	});

	it('includes a point on the boundary within the declared tolerance and excludes it beyond it', () => {
		const geometry = compiledGeometry();
		const snapshot = floorSupportSnapshotOf(geometry);
		const onBoundary = queryFloorSupports(snapshot, {
			generationId: 'generation-1',
			x: 7 + FLOOR_SUPPORT_TOLERANCES.boundaryMeters / 10,
			z: -1
		});
		expect(onBoundary.kind).toBe('candidates');

		const beyondBoundary = queryFloorSupports(snapshot, {
			generationId: 'generation-1',
			x: 7 + FLOOR_SUPPORT_TOLERANCES.boundaryMeters * 100,
			z: -1
		});
		expect(beyondBoundary.kind).toBe('none');
	});

	it('filters by an explicitly chosen floor and refuses a floor the Layout does not contain', () => {
		const geometry = compiledGeometry();
		const snapshot = floorSupportSnapshotOf(geometry);
		const chosen = geometry.floors[0]!.floorId;
		const scoped = queryFloorSupports(snapshot, {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1],
			scope: { floorId: chosen }
		});
		// The scope is a filter, not a resolver: the same point yields the same
		// support when the creator's own floor is named explicitly.
		expect(scoped).toEqual(
			queryFloorSupports(snapshot, { generationId: 'generation-1', x: INTERIOR[0], z: INTERIOR[1] })
		);

		const unknown = queryFloorSupports(snapshot, {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1],
			scope: { floorId: 'floor-not-in-this-layout' }
		});
		expect(unknown.kind).toBe('unsupported');
		if (unknown.kind !== 'unsupported') return;
		expect(unknown.code).toBe('unknown-scope-floor');
	});

	it('refuses evidence captured against another compile generation', () => {
		const geometry = compiledGeometry();
		const result = queryFloorSupports(floorSupportSnapshotOf(geometry), {
			generationId: 'generation-2',
			evidenceGenerationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});
		expect(result.kind).toBe('stale-generation');
		if (result.kind !== 'stale-generation') return;
		expect(result.evidenceGenerationId).toBe('generation-1');
		expect(result.generationId).toBe('generation-2');
	});

	it('refuses a non-finite point and a missing generation id', () => {
		const geometry = compiledGeometry();
		const snapshot = floorSupportSnapshotOf(geometry);
		const nonFinite = queryFloorSupports(snapshot, {
			generationId: 'generation-1',
			x: Number.NaN,
			z: INTERIOR[1]
		});
		expect(nonFinite.kind).toBe('invalid-input');
		if (nonFinite.kind === 'invalid-input') expect(nonFinite.code).toBe('non-finite-point');

		const missingGeneration = queryFloorSupports(snapshot, {
			generationId: '   ',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});
		expect(missingGeneration.kind).toBe('invalid-input');
		if (missingGeneration.kind === 'invalid-input') {
			expect(missingGeneration.code).toBe('missing-generation-id');
		}
	});

	it('pins the current single-datum real format so a future multi-datum format fails loudly', () => {
		const baseline = enclosure(2.5);
		const addition = planWallChain({
			baseline,
			points: [p(20, -4), p(27, -4), p(27, 2), p(20, 2)],
			close: true,
			capture: freshCapture(),
			levelId: baseline.floor.id
		});
		if (addition.kind !== 'success') throw new Error('second enclosure failed');
		const { geometry, issues } = compileWallFirstLayoutGeometry(addition.document);
		expect(issues.filter(issue => issue.severity !== 'warning')).toEqual([]);
		expect(geometry.rooms).toHaveLength(2);
		const datum = geometry.floors[0]!.elevation;
		for (const room of geometry.rooms) {
			// Today the canonical compiler places every Room floor at the one level
			// datum, so the query cannot yet produce two elevations from a real
			// document. When a multi-datum format lands this assertion is the
			// failure that says "the query needs a real ambiguity case now".
			expect(room.floorElevation).toBe(datum);
		}
		const result = queryFloorSupports(floorSupportSnapshotOf(geometry), {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});
		expect(result.kind).toBe('candidates');
		if (result.kind === 'candidates') expect(result.candidates[0]!.elevation).toBe(datum);
	});

	it('honours a nonzero floor datum through the compiled Room fact', () => {
		const geometry = compiledGeometry(2.5);
		const room = geometry.rooms[0]!;
		expect(room.floorElevation).toBeCloseTo(2.5, 9);
		const result = queryFloorSupports(floorSupportSnapshotOf(geometry), {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});
		expect(result.kind).toBe('candidates');
		if (result.kind === 'candidates') {
			expect(result.candidates[0]!.elevation).toBeCloseTo(2.5, 9);
		}
	});

	it('leaves the compiled input unmutated', () => {
		const geometry = deepFreeze(compiledGeometry());
		const snapshot = deepFreeze(floorSupportSnapshotOf(geometry));
		const before = JSON.stringify(snapshot);

		queryFloorSupports(snapshot, { generationId: 'generation-1', x: INTERIOR[0], z: INTERIOR[1] });
		queryFloorSupports(snapshot, { generationId: 'generation-1', x: OUTSIDE[0], z: OUTSIDE[1] });
		expect(
			chooseFloorSupport(
				resultCandidates(queryFloorSupports(snapshot, { generationId: 'generation-1', x: 0, z: -4 }))
			).kind
		).toBe('resolved');

		expect(JSON.stringify(snapshot)).toBe(before);
	});
});

function resultCandidates(
	result: ReturnType<typeof queryFloorSupports>
): readonly FloorSupportCandidate[] {
	return result.kind === 'candidates' ? result.candidates : [];
}

describe('floor-support candidates over constructed compiled records', () => {
	it('deduplicates coincident equivalent supports into one choice that keeps every witness', () => {
		const snapshot = snapshotOf(
			[{ floorId: 'floor-1', elevation: 0 }],
			[
				{ roomId: 'room-a', floorElevation: 0 },
				{ roomId: 'room-b', floorElevation: 0 }
			],
			[
				polygonRecord({ id: 'record-a', roomId: 'room-a' }),
				polygonRecord({ id: 'record-b', roomId: 'room-b' })
			]
		);
		const result = queryFloorSupports(snapshot, {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});
		expect(result.kind).toBe('candidates');
		if (result.kind !== 'candidates') return;
		// One support, both sources retained: two Rooms sharing a boundary at one
		// datum support the point at the same elevation.
		expect(result.candidates).toHaveLength(1);
		expect(result.candidates[0]!.witnesses.map((witness) => witness.roomId)).toEqual([
			'room-a',
			'room-b'
		]);
	});

	it('keeps distinct elevations separate and orders choices by source id, never by elevation', () => {
		const snapshot = snapshotOf(
			[
				{ floorId: 'floor-1', elevation: 0 },
				{ floorId: 'floor-2', elevation: 9 }
			],
			[
				// `room-a` sits higher than `room-z`: source-id order and elevation
				// order disagree, so the assertion below can tell them apart.
				{ roomId: 'room-a', floorElevation: 9 },
				{ roomId: 'room-z', floorElevation: 0 }
			],
			[
				polygonRecord({ id: 'record-a', roomId: 'room-a', floorId: 'floor-2' }),
				polygonRecord({ id: 'record-z', roomId: 'room-z', floorId: 'floor-1' })
			]
		);
		const result = queryFloorSupports(snapshot, {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});
		expect(result.kind).toBe('candidates');
		if (result.kind !== 'candidates') return;
		expect(result.candidates).toHaveLength(2);
		expect(result.candidates.map((candidate) => candidate.witnesses[0]!.roomId)).toEqual([
			'room-a',
			'room-z'
		]);
		// Ordering is by source id: the first choice carries the *higher* elevation.
		expect(result.candidates[0]!.elevation).toBe(9);
		expect(result.candidates[1]!.elevation).toBe(0);
	});

	it('is independent of record array order', () => {
		const rooms = [
			{ roomId: 'room-a', floorElevation: 9 },
			{ roomId: 'room-z', floorElevation: 0 }
		];
		const floors = [
			{ floorId: 'floor-1', elevation: 0 },
			{ floorId: 'floor-2', elevation: 9 }
		];
		const forward = [
			polygonRecord({ id: 'record-a', roomId: 'room-a', floorId: 'floor-2' }),
			polygonRecord({ id: 'record-z', roomId: 'room-z', floorId: 'floor-1' })
		];
		const input = { generationId: 'generation-1', x: INTERIOR[0], z: INTERIOR[1] };
		const first = queryFloorSupports(snapshotOf(floors, rooms, forward), input);
		const second = queryFloorSupports(snapshotOf([...floors].reverse(), [...rooms].reverse(), [...forward].reverse()), input);
		expect(second).toEqual(first);
	});

	it('refuses contradictory compiled facts and missing compiled facts', () => {
		const contradictory = snapshotOf(
			[{ floorId: 'floor-1', elevation: 0 }],
			[{ roomId: 'room-1', floorElevation: 2 }],
			[polygonRecord({ id: 'record-1' })]
		);
		const contradiction = queryFloorSupports(contradictory, {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});
		expect(contradiction.kind).toBe('unsupported');
		if (contradiction.kind === 'unsupported') {
			expect(contradiction.code).toBe('contradictory-support-facts');
		}

		const orphanedRoom = snapshotOf(
			[{ floorId: 'floor-1', elevation: 0 }],
			[],
			[polygonRecord({ id: 'record-1' })]
		);
		const missingRoom = queryFloorSupports(orphanedRoom, {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});
		expect(missingRoom.kind).toBe('unsupported');
		if (missingRoom.kind === 'unsupported') expect(missingRoom.code).toBe('missing-support-facts');

		const ownerless = snapshotOf(
			[{ floorId: 'floor-1', elevation: 0 }],
			[{ roomId: 'room-1', floorElevation: 0 }],
			[polygonRecord({ id: 'record-1', roomId: undefined })]
		);
		const missingOwner = queryFloorSupports(ownerless, {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});
		expect(missingOwner.kind).toBe('unsupported');
		if (missingOwner.kind === 'unsupported') {
			expect(missingOwner.code).toBe('missing-support-facts');
		}
	});

	it('refuses a degenerate room-floor record that reaches the queried point', () => {
		const snapshot = snapshotOf(
			[{ floorId: 'floor-1', elevation: 0 }],
			[{ roomId: 'room-1', floorElevation: 0 }],
			[polygonRecord({ id: 'record-degenerate', polygon: [p(0, -4), p(7, 2)] })]
		);
		const result = queryFloorSupports(snapshot, {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});
		expect(result.kind).toBe('unsupported');
		if (result.kind === 'unsupported') expect(result.code).toBe('missing-support-facts');
	});

	it('reports none when a degenerate record does not reach the queried point', () => {
		const snapshot = snapshotOf(
			[{ floorId: 'floor-1', elevation: 0 }],
			[{ roomId: 'room-1', floorElevation: 0 }],
			[polygonRecord({ id: 'record-degenerate', polygon: [p(40, -44), p(47, -38)] })]
		);
		const result = queryFloorSupports(snapshot, {
			generationId: 'generation-1',
			x: INTERIOR[0],
			z: INTERIOR[1]
		});
		expect(result.kind).toBe('none');
	});
});

describe('floor-support membership arithmetic', () => {
	it('treats an interior point as contained and a boundary point within the tolerance only', () => {
		expect(polygonContainsWithTolerance(INTERIOR, RECT)).toBe(true);
		expect(polygonContainsWithTolerance(p(7, -1), RECT)).toBe(true);
		expect(polygonContainsWithTolerance(p(7.0000001, -1), RECT)).toBe(true);
		expect(polygonContainsWithTolerance(p(7.001, -1), RECT)).toBe(false);
		expect(polygonContainsWithTolerance(OUTSIDE, RECT)).toBe(false);
	});

	it('never treats a degenerate polygon as containing', () => {
		expect(polygonContainsWithTolerance(p(3, -1), [p(0, -4), p(7, 2)])).toBe(false);
		expect(polygonContainsWithTolerance(p(3, -1), [])).toBe(false);
	});
});

describe('the floor-support chooser never chooses an elevation', () => {
	it('resolves a single candidate without a choice', () => {
		const resolved = chooseFloorSupport([candidateOf(0, 'a', 'room-a')]);
		expect(resolved.kind).toBe('resolved');
		if (resolved.kind === 'resolved') expect(resolved.support.elevation).toBe(0);
	});

	it('requires a choice between different elevations and resolves an explicit one', () => {
		const candidates = [candidateOf(0, 'a', 'room-a'), candidateOf(2.5, 'b', 'room-b')];
		const required = chooseFloorSupport(candidates);
		expect(required.kind).toBe('choice-required');
		if (required.kind === 'choice-required') expect(required.candidates).toHaveLength(2);

		const byElevation = chooseFloorSupport(candidates, { kind: 'elevation', elevation: 2.5 });
		expect(byElevation.kind).toBe('resolved');
		if (byElevation.kind === 'resolved') expect(byElevation.support.orderKey).toBe('b');

		const byOrderKey = chooseFloorSupport(candidates, { kind: 'order-key', orderKey: 'a' });
		expect(byOrderKey.kind).toBe('resolved');
		if (byOrderKey.kind === 'resolved') expect(byOrderKey.support.elevation).toBe(0);
	});

	it('refuses an unknown choice and an ambiguous elevation', () => {
		const candidates = [candidateOf(2.5, 'a', 'room-a'), candidateOf(2.5, 'b', 'room-b')];
		const unknown = chooseFloorSupport(candidates, { kind: 'order-key', orderKey: 'missing' });
		expect(unknown.kind).toBe('invalid-choice');
		if (unknown.kind === 'invalid-choice') expect(unknown.code).toBe('unknown-choice');

		const ambiguous = chooseFloorSupport(candidates, { kind: 'elevation', elevation: 2.5 });
		expect(ambiguous.kind).toBe('invalid-choice');
		if (ambiguous.kind === 'invalid-choice') expect(ambiguous.code).toBe('ambiguous-choice');

		const nonFinite = chooseFloorSupport(candidates, { kind: 'elevation', elevation: Number.NaN });
		expect(nonFinite.kind).toBe('invalid-choice');
		if (nonFinite.kind === 'invalid-choice') expect(nonFinite.code).toBe('unknown-choice');
	});

	it('refuses an empty candidate set', () => {
		const result = chooseFloorSupport([]);
		expect(result.kind).toBe('invalid-choice');
		if (result.kind === 'invalid-choice') expect(result.code).toBe('no-support');
	});
});


describe('independent floor-support regressions', () => {
	const input = { generationId: 'generation-1', x: 3, z: -1 };
	it('measures boundary tolerance as Euclidean distance, including outside corners', () => {
		const square: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
		const epsilon = FLOOR_SUPPORT_TOLERANCES.boundaryMeters;
		expect(polygonContainsWithTolerance([-epsilon, 0.5], square)).toBe(true);
		expect(polygonContainsWithTolerance([-epsilon * 1.01, 0.5], square)).toBe(false);
		expect(polygonContainsWithTolerance([-epsilon * 0.7, -epsilon * 0.7], square)).toBe(true);
		expect(polygonContainsWithTolerance([-epsilon * 0.8, -epsilon * 0.8], square)).toBe(false);
	});
	it('preserves the source-ordered canonical elevation when coplanar witnesses differ within tolerance', () => {
		const epsilon = FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters;
		const rooms = [{ roomId: 'room-a', floorElevation: epsilon }, { roomId: 'room-b', floorElevation: 0 }];
		const records = rooms.map(room => polygonRecord({ id: room.roomId, roomId: room.roomId, sourceId: room.roomId }));
		const snapshot = snapshotOf([{ floorId: 'floor-1', elevation: 0 }], rooms, records);
		const result = queryFloorSupports(snapshot, input);
		expect(resultCandidates(result)).toHaveLength(1);
		expect(resultCandidates(result)[0]!.elevation).toBe(epsilon);
		expect(resultCandidates(result)[0]!.witnesses).toHaveLength(2);
		expect(queryFloorSupports({ ...snapshot, rooms: [...rooms].reverse(), queryPolygons: [...records].reverse() }, input)).toEqual(result);
		expect(queryFloorSupports({ ...snapshot, rooms: [{ ...rooms[0]!, floorElevation: epsilon * 1.01 }, rooms[1]!] }, input)).toMatchObject({ kind: 'unsupported', code: 'contradictory-support-facts' });
	});
	it('orders unequal-length source ids lexically and orders every same-source fragment', () => {
		const records = [polygonRecord({ id: 'fragment-z', sourceId: 'a-long-source', roomId: 'room-a' }), polygonRecord({ id: 'fragment-a', sourceId: 'a-long-source', roomId: 'room-a' }), polygonRecord({ id: 'fragment-b', sourceId: 'b', roomId: 'room-b' })];
		const snapshot = snapshotOf([{ floorId: 'floor-1', elevation: 0 }], [{ roomId: 'room-a', floorElevation: 0 }, { roomId: 'room-b', floorElevation: 0 }], records);
		const forward = queryFloorSupports(snapshot, input);
		expect(queryFloorSupports({ ...snapshot, queryPolygons: [...records].reverse() }, input)).toEqual(forward);
		expect(resultCandidates(forward)[0]!.witnesses.map(w => w.recordId)).toEqual(['fragment-a', 'fragment-z', 'fragment-b']);
	});
	it('requires a choice between different floor contexts even at the same elevation', () => {
		const result = queryFloorSupports(snapshotOf([{ floorId: 'floor-1', elevation: 0 }, { floorId: 'floor-2', elevation: 0 }], [{ roomId: 'room-a', floorElevation: 0 }, { roomId: 'room-b', floorElevation: 0 }], [polygonRecord({ id: 'a', roomId: 'room-a' }), polygonRecord({ id: 'b', floorId: 'floor-2', roomId: 'room-b' })]), input);
		expect(chooseFloorSupport(resultCandidates(result)).kind).toBe('choice-required');
	});
	it('refuses contradictory duplicate Room and floor facts in either order', () => {
		const baseline = snapshotOf([{ floorId: 'floor-1', elevation: 0 }], [{ roomId: 'room-1', floorElevation: 0 }], [polygonRecord({ id: 'a' })]);
		for (const field of ['rooms', 'floors'] as const) {
			const extra = field === 'rooms' ? { roomId: 'room-1', floorElevation: 2 } : { floorId: 'floor-1', elevation: 2 };
			for (const reversed of [false, true]) {
				const values = [...baseline[field], extra];
				expect(queryFloorSupports({ ...baseline, [field]: reversed ? values.reverse() : values }, input)).toMatchObject({ kind: 'unsupported', code: 'contradictory-support-facts' });
			}
		}
	});
	it('refuses zero-area and non-finite boundaries', () => {
		for (const polygon of [[[0, 0], [1, 0], [2, 0]], [[0, 0], [7, 0], [Number.NaN, 2]]] as [number, number][][]) {
			expect(queryFloorSupports(snapshotOf([{ floorId: 'floor-1', elevation: 0 }], [{ roomId: 'room-1', floorElevation: 0 }], [polygonRecord({ id: 'bad', polygon })]), { ...input, x: 1, z: 0 }).kind).toBe('unsupported');
		}
	});
});


it('does not let a middle elevation bridge supports more than one tolerance apart', () => {
 const epsilon = FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters;
 const elevations = [epsilon * 0.75, 0, epsilon * 1.5];
 const rooms = elevations.map((floorElevation, index) => ({ roomId: `room-${index}`, floorElevation }));
 const records = rooms.map((room, index) => polygonRecord({ id: `record-${index}`, roomId: room.roomId }));
 const snapshot = snapshotOf([{ floorId: 'floor-1', elevation: epsilon * 0.75 }], rooms, records);
 const result = queryFloorSupports(snapshot, { generationId: 'generation-1', x: 3, z: -1 });
 expect(resultCandidates(result)).toHaveLength(2);
 expect(queryFloorSupports({ ...snapshot, queryPolygons: [...records].reverse() }, { generationId: 'generation-1', x: 3, z: -1 })).toEqual(result);
});
