import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	planWallSegment,
	validateWallFirstTopology,
	wallsShareTopologyComponent,
	type LayoutDocumentWallFirst
} from '@portfolio/layout-core';

/** Empty wall-first document with a real floor record. */
function baseDocument(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	return {
		...document,
		floor: { ...document.floor, id: 'floor-1', name: 'Floor 1', elevation: 0 }
	};
}

const p = (x: number, z: number): [number, number] => [x, z];

/** Closed 4×3 rectangle corners in click order. */
const RECT = [p(0, 0), p(4, 0), p(4, 3), p(0, 3)] as const;

function expectSuccess(plan: ReturnType<typeof planWallChain>) {
	if (plan.kind !== 'success') throw new Error(`expected success, got: ${JSON.stringify(plan.kind === 'rejected' ? plan.rejection : plan)}`);
	return plan;
}

function expectReturnedJunctionIdsLive(plan: Extract<ReturnType<typeof planWallChain>, { kind: 'success' }>) {
	const junctionIds = new Set(plan.document.junctions.map((junction) => junction.id));
	for (const junctionId of [plan.startJunctionId, plan.endJunctionId, ...plan.createdJunctionIds]) {
		expect(junctionIds.has(junctionId), `returned Junction '${junctionId}' is not in the committed document`).toBe(true);
	}
}

function expectRejected(plan: ReturnType<typeof planWallChain>, code: string) {
	if (plan.kind !== 'rejected') throw new Error(`expected rejection ${code}, got success`);
	expect(plan.rejection.code).toBe(code);
	return plan;
}

/**
 * The Wall of `document` whose two endpoints both sit on `z` — the host a
 * divider T-nodes into.
 */
function horizontalWallAt(document: LayoutDocumentWallFirst, z: number): string {
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const wall = document.walls.find((candidate) => {
		const start = junctionById.get(candidate.startJunctionId)!;
		const end = junctionById.get(candidate.endJunctionId)!;
		return start.point[1] === z && end.point[1] === z;
	});
	if (!wall) throw new Error(`no horizontal wall at z=${z}`);
	return wall.id;
}

/** The Wall of `document` whose centerline runs vertically at x. */
function verticalWallAt(document: LayoutDocumentWallFirst, x: number): string {
	const junctionById = new Map(document.junctions.map((junction) => [junction.id, junction]));
	const wall = document.walls.find((candidate) => {
		const start = junctionById.get(candidate.startJunctionId)!;
		const end = junctionById.get(candidate.endJunctionId)!;
		return start.point[0] === x && end.point[0] === x;
	});
	if (!wall) throw new Error(`no vertical wall at x=${x}`);
	return wall.id;
}

/** The authored Junction of `document` whose point is exactly (x, z). */
function junctionIdAt(document: LayoutDocumentWallFirst, x: number, z: number): string {
	const junction = document.junctions.find(
		(candidate) => candidate.point[0] === x && candidate.point[1] === z
	);
	if (!junction) throw new Error(`no junction at (${x}, ${z})`);
	return junction.id;
}

describe('P23.9 open wall chains', () => {
	it('commits an open two-point chain once and creates no Room', () => {
		const baseline = baseDocument();
		const plan = expectSuccess(
			planWallChain({ baseline, points: [p(0, 0), p(4, 0)], close: false, role: 'boundary' })
		);
		expect(plan.document.walls).toHaveLength(1);
		expect(plan.document.junctions).toHaveLength(2);
		expect(plan.document.rooms).toHaveLength(0);
		expect(plan.createdWallIds).toHaveLength(1);
		expect(plan.createdJunctionIds).toHaveLength(2);
		expect(plan.lineage).toHaveLength(0);
		expect(plan.document.walls[0]).toMatchObject({
			role: 'boundary',
			thickness: 0.2,
			height: 3
		});
	});

	it('commits a multi-leg open chain with one wall per leg', () => {
		const baseline = baseDocument();
		const plan = expectSuccess(
			planWallChain({ baseline, points: [p(0, 0), p(4, 0), p(4, 3)], close: false, role: 'boundary' })
		);
		expect(plan.document.walls).toHaveLength(2);
		expect(plan.document.junctions).toHaveLength(3);
		// The shared middle junction is reused: 3 junctions, not 4.
		expect(plan.document.walls.map((wall) => wall.startJunctionId)).toEqual([
			plan.document.walls[0]!.startJunctionId,
			plan.document.walls[1]!.startJunctionId
		]);
		expect(plan.document.walls[0]!.endJunctionId).toBe(plan.document.walls[1]!.startJunctionId);
		expect(plan.document.rooms).toHaveLength(0);
	});

	it('a partition open chain never creates Rooms', () => {
		const baseline = baseDocument();
		const plan = expectSuccess(
			planWallChain({ baseline, points: RECT, close: true, role: 'partition' })
		);
		expect(plan.document.walls.every((wall) => wall.role === 'partition')).toBe(true);
		expect(plan.document.rooms).toHaveLength(0);
	});

	it('rejects an open chain with fewer than two vertices', () => {
		expectRejected(
			planWallChain({ baseline: baseDocument(), points: [p(0, 0)], close: false, role: 'boundary' }),
			'insufficient_chain'
		);
	});

	it('rejects a closed chain with fewer than three vertices', () => {
		expectRejected(
			planWallChain({ baseline: baseDocument(), points: [p(0, 0), p(4, 0)], close: true, role: 'boundary' }),
			'insufficient_chain'
		);
	});

	it('rejects non-finite input and implicitly-closed zero-vertex drafts', () => {
		expectRejected(
			planWallChain({ baseline: baseDocument(), points: [p(0, 0), p(Number.NaN, 0)], close: false, role: 'boundary' }),
			'non_finite_point'
		);
		// Two coincident points close implicitly and collapse to nothing.
		expectRejected(
			planWallChain({ baseline: baseDocument(), points: [p(0, 0), p(0, 0)], close: false, role: 'boundary' }),
			'insufficient_chain'
		);
		// An explicit zero-length leg between distinct vertices rejects.
		expectRejected(
			planWallChain({ baseline: baseDocument(), points: [p(0, 0), p(2, 0), p(2, 0), p(2, 3)], close: false, role: 'boundary' }),
			'zero_length_leg'
		);
	});

	it('rejects a self-crossing chain', () => {
		const baseline = baseDocument();
		expectRejected(
			planWallChain({
				baseline,
				points: [p(0, 0), p(4, 0), p(4, 3), p(0, 3), p(4, -1)],
				close: false,
				role: 'boundary'
			}),
			'self_intersecting_chain'
		);
	});

	it('rejects collinear overlapping legs', () => {
		const baseline = baseDocument();
		expectRejected(
			planWallChain({
				baseline,
				points: [p(0, 0), p(4, 0), p(2, 0), p(2, 3)],
				close: false,
				role: 'boundary'
			}),
			'collinear_overlap'
		);
	});
});

describe('P23.9 closed boundary chains and Rooms', () => {
	it('a closed outer loop births one deterministic Room', () => {
		const baseline = baseDocument();
		const plan = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		expect(plan.document.walls).toHaveLength(4);
		expect(plan.document.rooms).toHaveLength(1);
		expect(plan.document.rooms[0]!.name).toBe('Draft Room 1');
		expect(plan.document.rooms[0]!.boundary).toHaveLength(4);
		expect(plan.lineage).toEqual([
			{ faceKey: plan.lineage[0]!.faceKey, roomId: plan.document.rooms[0]!.id, kind: 'created' }
		]);
	});

	it('clicking the start point closes the chain implicitly', () => {
		const baseline = baseDocument();
		// Same rectangle but the draft repeats the first point as the last click.
		const plan = expectSuccess(
			planWallChain({ baseline, points: [...RECT, p(0, 0)], close: false, role: 'boundary' })
		);
		const closed = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		expect(plan.document.walls).toHaveLength(closed.document.walls.length);
		expect(plan.document.junctions).toHaveLength(closed.document.junctions.length);
		expect(plan.document.rooms).toHaveLength(1);
	});

	it('a complete divider through an existing Room splits it 1→2', () => {
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		const withRoom = enclosure.document;
		expect(withRoom.rooms).toHaveLength(1);

		// Vertical divider from the top wall midpoint to the bottom wall midpoint:
		// T-nodes into both existing walls, splitting the room in two. P23B.3a S6 —
		// the DECLARED host anchors are what make this an extension of the
		// enclosure's own group; without them the same draft is independent
		// placement and splits nothing.
		const divider = expectSuccess(
			planWallChain({
				baseline: withRoom,
				points: [p(2, 0), p(2, 3)],
				close: false,
				role: 'boundary',
				endpointHostSnaps: [
					{ pointIndex: 0, wallId: horizontalWallAt(withRoom, 0) },
					{ pointIndex: 1, wallId: horizontalWallAt(withRoom, 3) }
				]
			})
		);
		expect(divider.document.rooms).toHaveLength(2);
		expect(divider.splitWallIds).toHaveLength(2);
		// The divider walls plus the split fragments exist: 4 baseline walls
		// become 6 fragments (both T-hosts split), plus the 1 divider wall.
		expect(divider.document.walls.length).toBe(withRoom.walls.length + 1 + 2);
		// The room split 1→2: one face preserves the predecessor's ID through
		// lineage, the other births a fresh deterministic Room.
		const survivorRoomId = withRoom.rooms[0]!.id;
		const roomIds = divider.document.rooms.map((room) => room.id);
		expect(roomIds.filter((id) => id === survivorRoomId)).toHaveLength(1);
		expect(roomIds).toHaveLength(2);
	});

	it('a chain drawn exactly along an existing wall rejects atomically — when it declares that group', () => {
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		// A chain drawn exactly along the existing wall (0,0)→(4,0), DECLARING the
		// Junction it starts from (P23B.3a S6): the overlap is now inside one
		// connected group, which is the permanent collinear rule and still refuses
		// atomically. The same draft with NO declaration is permitted independent
		// overlap — asserted in the S6 oracle and in the flips below.
		expectRejected(
			planWallChain({
				baseline: enclosure.document,
				points: [p(0, 0), p(4, 0)],
				close: false,
				role: 'boundary',
				endpointJunctionSnaps: [
					{ pointIndex: 0, junctionId: junctionIdAt(enclosure.document, 0, 0) }
				]
			}),
			'collinear_overlap'
		);
	});

	it('a chain drawn along an existing wall WITHOUT a declared connection is permitted independent overlap', () => {
		// PRE-S6 (recorded history): this draft rejected with `collinear_overlap`,
		// because every draft was examined against every Wall in the document. S6
		// makes implicit placement its own component and S4/S5 already permit
		// collinear overlap BETWEEN components (F5), so the same draft is admitted
		// geometry now: no Wall is split, trimmed or merged, and the drawn Wall keeps
		// its own Junction identity.
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		const hostWallIds = new Set(enclosure.document.walls.map((wall) => wall.id));
		const plan = expectSuccess(
			planWallChain({
				baseline: enclosure.document,
				points: [p(0, 0), p(4, 0)],
				close: false,
				role: 'partition'
			})
		);
		expect(plan.splitWallIds).toHaveLength(0);
		// Every baseline Wall survives exactly as authored.
		expect(plan.document.walls.filter((wall) => hostWallIds.has(wall.id))).toEqual(
			enclosure.document.walls
		);
	});

	it('a chain T-ing into a wall interior performs canonical subdivision', () => {
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		const withRoom = enclosure.document;
		// Dead-end spur hitting the bottom wall's interior at x=3. P23B.3a S6 — the
		// endpoint DECLARES its host (the author snapped onto that Wall), so the T is
		// an extension of the enclosure's own group and still subdivides it.
		const spur = expectSuccess(
			planWallChain({
				baseline: withRoom,
				points: [p(3, -2), p(3, 0)],
				close: false,
				role: 'boundary',
				endpointHostSnaps: [{ pointIndex: 1, wallId: horizontalWallAt(withRoom, 0) }]
			})
		);
		// The hit wall is split; the spur's endpoint junction is reused (no new
		// junction at the touch point).
		expect(spur.splitWallIds).toHaveLength(1);
		expect(spur.document.walls.length).toBe(withRoom.walls.length + 1 + 1);
		// The touched junction is shared between the spur and a fragment.
		const spurWall = spur.document.walls.find((wall) => wall.id === spur.createdWallIds[0])!;
		const touched = spurWall.endJunctionId;
		const fragment = spur.document.walls.filter(
			(wall) => wall.startJunctionId === touched || wall.endJunctionId === touched
		);
		expect(fragment.length).toBeGreaterThanOrEqual(2);
	});

	it('an UNDECLARED X crossing between the chain and an existing wall is permitted, un-noded geometry', () => {
		// PRE-S6 (recorded history): this draft NODED both crossed walls and
		// fragmented the chain at each crossing, because every draft was examined
		// against every Wall in the document. S6 withdraws that reflex from
		// INDEPENDENT placement (operation class 2): the chain declares no
		// connection, so it is its own component, its crossings are cross-group, and
		// the crossing is the permitted geometry S4/S5 already admit (F8's scoped
		// negative half) — nothing is split, adopted or merged.
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		const withRoom = enclosure.document;
		const crossing = expectSuccess(
			planWallChain({ baseline: withRoom, points: [p(-1, 1.5), p(5, 1.5)], close: false, role: 'partition' })
		);
		expect(crossing.splitWallIds).toHaveLength(0);
		expect(crossing.document.walls).toHaveLength(withRoom.walls.length + 1);
		expect(crossing.document.junctions).toHaveLength(withRoom.junctions.length + 2);
		// The baseline Walls are byte-identical: a permitted crossing is not a repair.
		for (const wall of withRoom.walls) {
			expect(crossing.document.walls.find((candidate) => candidate.id === wall.id)).toEqual(wall);
		}
	});

	it('a partition inside a Room leaves the Room 1→1', () => {
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		const withRoom = enclosure.document;
		const partition = expectSuccess(
			planWallChain({ baseline: withRoom, points: [p(1, 1), p(2, 1)], close: false, role: 'partition' })
		);
		expect(partition.document.rooms).toHaveLength(1);
		expect(partition.document.rooms[0]!.id).toBe(withRoom.rooms[0]!.id);
		expect(partition.lineage).toHaveLength(0);
	});

	it('allocation is deterministic across equal replans (no timestamps/randomness)', () => {
		const baseline = baseDocument();
		const first = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		const second = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		expect(second.document.junctions.map((junction) => junction.id)).toEqual(
			first.document.junctions.map((junction) => junction.id)
		);
		expect(second.document.walls.map((wall) => wall.id)).toEqual(first.document.walls.map((wall) => wall.id));
		expect(second.document.rooms.map((room) => room.id)).toEqual(first.document.rooms.map((room) => room.id));
	});

	it('the baseline is never mutated by planning', () => {
		const baseline = baseDocument();
		const snapshot = structuredClone(baseline);
		planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' });
		expect(baseline).toEqual(snapshot);
	});
});	describe('P23.9 junction reuse', () => {
	it('reuses an existing junction when the chain DECLARES it', () => {
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		const withRoom = enclosure.document;
		const cornerJunction = withRoom.walls[0]!.startJunctionId;
		const before = withRoom.junctions.length;

		// Spur starting exactly at an existing corner junction and DECLARING it
		// (P23B.3a S6 — the deliberate reuse the node snap expresses; an undeclared
		// coincidence mints its own Junction instead, asserted in the S6 oracle).
		const spur = expectSuccess(
			planWallChain({
				baseline: withRoom,
				points: [p(0, 0), p(0, -2)],
				close: false,
				role: 'partition',
				endpointJunctionSnaps: [{ pointIndex: 0, junctionId: cornerJunction }]
			})
		);
		expect(spur.createdJunctionIds).toHaveLength(1); // only the far endpoint
		const spurWall = spur.document.walls.find((wall) => wall.id === spur.createdWallIds[0])!;
		expect(spurWall.startJunctionId).toBe(cornerJunction);
		expect(spur.document.junctions).toHaveLength(before + 1);
	});

	it('a near-miss coordinate allocates a fresh junction (exact match only)', () => {
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		const withRoom = enclosure.document;
		// The editor's snap pipeline resolves exact junction coordinates before
		// the planner runs; a near-miss without snap is a genuinely new vertex.
		const spur = expectSuccess(
			planWallChain({ baseline: withRoom, points: [p(0.0000001, -0.0000001), p(0, -2)], close: false, role: 'partition' })
		);
		expect(spur.createdJunctionIds).toHaveLength(2);
		const spurWall = spur.document.walls.find((wall) => wall.id === spur.createdWallIds[0])!;
		const startJunction = spur.document.junctions.find((junction) => junction.id === spurWall.startJunctionId)!;
		expect(startJunction.point).toEqual([0.0000001, -0.0000001]);
	});
});describe('P23.9 multi-component atomicity', () => {
	/** Two disjoint rooms: left (0,0)-(4,3), right (6,0)-(10,3). */
	function twoRoomBaseline(): LayoutDocumentWallFirst {
		const empty = baseDocument();
		const left = expectSuccess(
			planWallChain({ baseline: empty, points: [p(0, 0), p(4, 0), p(4, 3), p(0, 3)], close: true, role: 'boundary' })
		);
		const both = expectSuccess(
			planWallChain({ baseline: left.document, points: [p(6, 0), p(10, 0), p(10, 3), p(6, 3)], close: true, role: 'boundary' })
		);
		expect(both.document.rooms).toHaveLength(2);
		return both.document;
	}

	it('one boundary chain splitting two rooms commits once with both splits', () => {
		const baseline = twoRoomBaseline();
		// East-west divider across both rooms: two 1→2 splits in a single chain
		// command. P23B.3a S6 records the pre-policy shape here as history — the
		// chain used to be drawn from (-1, 1.5) to (11, 1.5), overshooting into free
		// space, and the planner inferred a connection to any Wall it crossed. The
		// divider now TERMINATES on the two outer Walls and declares them (operation
		// class 3, what an author's wall-span snap expresses), and the overshooting
		// shape asserts the opposite verdict in the companion test below.
		const plan = expectSuccess(
			planWallChain({
				baseline,
				points: [p(0, 1.5), p(10, 1.5)],
				close: false,
				role: 'boundary',
				endpointHostSnaps: [
					{ pointIndex: 0, wallId: verticalWallAt(baseline, 0) },
					{ pointIndex: 1, wallId: verticalWallAt(baseline, 10) }
				]
			})
		);
		expect(plan.document.rooms).toHaveLength(4);
		// One survivor per split: both predecessor IDs persist by lineage.
		const before = new Set(baseline.rooms.map((room) => room.id));
		const survivors = plan.document.rooms.filter((room) => before.has(room.id));
		expect(survivors).toHaveLength(2);
	});

	it('the SAME divider is independent placement when nothing is declared (P23B.3a S6)', () => {
		// The pre-policy shape, now read as class 2: endpoints in free space declare
		// nothing, so the chain neither adopts a Junction nor splits a host — both
		// Rooms stay whole and every baseline Wall is byte-identical. Overlap is
		// permitted geometry; it is never a join.
		const baseline = twoRoomBaseline();
		const snapshot = structuredClone(baseline);
		const plan = expectSuccess(
			planWallChain({ baseline, points: [p(-1, 1.5), p(11, 1.5)], close: false, role: 'boundary' })
		);
		expect(plan.splitWallIds).toHaveLength(0);
		expect(plan.document.rooms).toHaveLength(2);
		expect(plan.document.walls).toHaveLength(baseline.walls.length + 1);
		expect(baseline).toEqual(snapshot);
	});

	it('a chain with a valid prefix plus an overlapping leg rejects atomically', () => {
		const baseline = twoRoomBaseline();
		const snapshot = structuredClone(baseline);
		// Leg 1 stubs into the left room's bottom-wall interior (valid T);
		// leg 2 runs along the existing bottom wall (collinear overlap).
		// P23B.3a S6 — the T is DECLARED (the author attached leg 1's endpoint to
		// the bottom Wall's span), which is what makes the collinear leg a
		// same-component overlap rather than permitted independent geometry.
		const plan = planWallChain({
			baseline,
			points: [p(2, -1), p(2, 0), p(4, 0)],
			close: false,
			role: 'boundary',
			endpointHostSnaps: [{ pointIndex: 1, wallId: horizontalWallAt(baseline, 0) }]
		});
		expectRejected(plan, 'collinear_overlap');
		// Nothing committed: the valid prefix does not survive the rejection.
		expect(baseline).toEqual(snapshot);
	});
});

describe('P23.9 planner input handling', () => {
	it('accepts a Svelte-state-style proxy baseline (no structuredClone)', () => {
		// The editor passes a `$state` proxy; `structuredClone` throws
		// DataCloneError on it in the browser while these plain-object tests
		// stay green. A Proxy reproduces the observable failure in Node.
		const proxy = new Proxy(baseDocument(), {});
		const plan = planWallChain({ baseline: proxy, points: [...RECT], close: true, role: 'boundary' });
		expect(plan.kind).toBe('success');
	});
});

describe('P23.9 convenience-tool equivalence', () => {
	it('a rectangle equals the equivalent four-wall boundary chain (P23.9 outcome)', () => {
		// The Rect Room frontend submits its four corners with close: true —
		// the committed graph must equal the same chain clicked by hand.
		const viaRect = planWallChain({ baseline: baseDocument(), points: [...RECT], close: true, role: 'boundary' });
		const viaChain = planWallChain({ baseline: baseDocument(), points: [...RECT, RECT[0]!], close: false, role: 'boundary' });
		expect(viaRect.kind).toBe('success');
		expect(viaChain.kind).toBe('success');
		if (viaRect.kind !== 'success' || viaChain.kind !== 'success') return;
		// Deterministic allocation from the same baseline must produce the
		// same canonical graph — not just the same shape.
		expect(viaChain.document).toEqual(viaRect.document);
		expect(viaRect.document.walls).toHaveLength(viaChain.document.walls.length);
		const rectPoints = viaRect.document.junctions.map((j) => j.point).sort(([ax, az], [bx, bz]) => ax - bx || az - bz);
		const chainPoints = viaChain.document.junctions.map((j) => j.point).sort(([ax, az], [bx, bz]) => ax - bx || az - bz);
		expect(rectPoints).toEqual(chainPoints);
		// Both birth exactly one Room from the enclosed face.
		expect(viaRect.lineage).toHaveLength(1);
		expect(viaChain.lineage).toHaveLength(1);
	});

	it('a polygon close equals the equivalent open chain with a closing leg', () => {
		const pentagon = [p(0, 0), p(2, 0), p(3, 1.5), p(1.5, 3), p(0, 2)] as const;
		const viaClose = planWallChain({ baseline: baseDocument(), points: [...pentagon], close: true, role: 'boundary' });
		const viaChain = planWallChain({ baseline: baseDocument(), points: [...pentagon, pentagon[0]!], close: false, role: 'boundary' });
		expect(viaClose.kind).toBe('success');
		expect(viaChain.kind).toBe('success');
		if (viaClose.kind !== 'success' || viaChain.kind !== 'success') return;
		expect(viaClose.document.walls).toHaveLength(5);
		expect(viaClose.document.walls).toHaveLength(viaChain.document.walls.length);
		expect(viaClose.lineage).toHaveLength(1);
	});

	it('exact numeric length input produces the authored Wall length (P23.9 precision)', () => {
		// The editor resolves a typed length to an exact endpoint before the
		// planner runs; the committed wall length must equal the typed value.
		const baseline = baseDocument();
		const start = p(1, 1);
		const length = 2.75;
		const end = p(1 + length, 1);
		const plan = planWallChain({ baseline, points: [start, end], close: false, role: 'boundary' });
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		const wall = plan.document.walls.find((candidate) => candidate.id === plan.createdWallIds[0])!;
		const [ax, az] = plan.document.junctions.find((j) => j.id === wall.startJunctionId)!.point;
		const [bx, bz] = plan.document.junctions.find((j) => j.id === wall.endJunctionId)!.point;
		expect(Math.hypot(bx - ax, bz - az)).toBeCloseTo(length, 12);
	});
});

describe('P23.9 segment-first boundary (ratified 2026-09-11)', () => {
	function junctionPoint(document: LayoutDocumentWallFirst, junctionId: string): [number, number] {
		const junction = document.junctions.find((candidate) => candidate.id === junctionId);
		if (!junction) throw new Error(`missing junction ${junctionId}`);
		return [...junction.point] as [number, number];
	}

	it('one segment = one Wall with canonical start/end Junctions for continuation', () => {
		const baseline = baseDocument();
		const first = planWallSegment({ baseline, start: p(0, 0), end: p(4, 0), role: 'boundary' });
		expect(first.kind).toBe('success');
		if (first.kind !== 'success') return;
		expect(first.authoredWallIds).toHaveLength(1);
		expect(first.document.walls).toHaveLength(1);
		expect(first.document.rooms).toHaveLength(0);
		const startPoint = junctionPoint(first.document, first.startJunctionId);
		const endPoint = junctionPoint(first.document, first.endJunctionId);
		expect(startPoint).toEqual([0, 0]);
		expect(endPoint).toEqual([4, 0]);

		// Continuous drawing: the canonical end becomes the next start (no tool
		// re-entry). P23B.3a S6 — the run DECLARES that continuation, because
		// intent is declared and never inferred from coordinates: passing the
		// run's own canonical Junction IS the operation saying "extend this run"
		// (operation class 3), and adoption then happens exactly as it always did.
		const second = planWallSegment({
			baseline: first.document,
			start: endPoint,
			end: p(4, 3),
			role: 'boundary',
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: first.endJunctionId }]
		});
		expect(second.kind).toBe('success');
		if (second.kind !== 'success') return;
		expect(second.document.walls).toHaveLength(2);
		expect(second.document.rooms).toHaveLength(0);
		// The shared junction is reused, not duplicated.
		expect(second.startJunctionId).toBe(first.endJunctionId);
	});

	it('the SAME continuation WITHOUT the declaration is independent placement (P23B.3a S6)', () => {
		// The differential for the case above and the point of the whole step: the
		// coordinates are identical, the declaration is the only difference, and
		// without it the second segment mints its own Junction — no shared topology,
		// no silent join (F3/F8's scoped negative half).
		const baseline = baseDocument();
		const first = planWallSegment({ baseline, start: p(0, 0), end: p(4, 0), role: 'boundary' });
		expect(first.kind).toBe('success');
		if (first.kind !== 'success') return;
		const endPoint = junctionPoint(first.document, first.endJunctionId);
		const second = planWallSegment({
			baseline: first.document,
			start: endPoint,
			end: p(4, 3),
			role: 'boundary'
		});
		expect(second.kind).toBe('success');
		if (second.kind !== 'success') return;
		expect(second.startJunctionId).not.toBe(first.endJunctionId);
		expect(second.document.walls).toHaveLength(2);
		expect(second.document.rooms).toHaveLength(0);
		// Two coincident records at (4, 0) — one per segment — and the baseline Wall
		// is untouched by the second placement.
		const coincident = second.document.junctions.filter(
			(junction) => Math.hypot(junction.point[0] - 4, junction.point[1]) < 1e-9
		);
		expect(coincident).toHaveLength(2);
		expect(second.document.walls.find((wall) => wall.id === first.authoredWallIds[0])).toEqual(
			first.document.walls[0]
		);
	});

	it('room closure: AB+BC+CD then DA onto the run-start Junction births one Room atomically', () => {
		const empty = baseDocument();
		const ab = planWallSegment({ baseline: empty, start: p(0, 0), end: p(4, 0), role: 'boundary' });
		if (ab.kind !== 'success') throw new Error('ab failed');
		// P23B.3a S6 — every continuation leg DECLARES the run Junction it starts
		// from (class 3), and the closing leg declares the run's start Junction as
		// the endpoint it extends to. Closure is still Junction identity; what
		// changed is that the caller now says so instead of the planner inferring it
		// from coordinates.
		const bc = planWallSegment({
			baseline: ab.document,
			start: junctionPoint(ab.document, ab.endJunctionId),
			end: p(4, 3),
			role: 'boundary',
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: ab.endJunctionId }]
		});
		if (bc.kind !== 'success') throw new Error('bc failed');
		const cd = planWallSegment({
			baseline: bc.document,
			start: junctionPoint(bc.document, bc.endJunctionId),
			end: p(0, 3),
			role: 'boundary',
			endpointJunctionSnaps: [{ pointIndex: 0, junctionId: bc.endJunctionId }]
		});
		if (cd.kind !== 'success') throw new Error('cd failed');
		expect(cd.document.rooms).toHaveLength(0);
		const runStart = ab.startJunctionId;
		const da = planWallSegment({
			baseline: cd.document,
			start: junctionPoint(cd.document, cd.endJunctionId),
			end: junctionPoint(cd.document, runStart),
			role: 'boundary',
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: cd.endJunctionId },
				{ pointIndex: 1, junctionId: runStart }
			]
		});
		expect(da.kind).toBe('success');
		if (da.kind !== 'success') return;
		expect(da.document.rooms).toHaveLength(1);
		expect(da.document.walls).toHaveLength(4);
		// Closure is Junction identity: the final end is the run start.
		expect(da.endJunctionId).toBe(runStart);
	});

	it('closure requires explicit Junction reuse; near-coordinates do not close', () => {
		const empty = baseDocument();
		const ab = planWallSegment({ baseline: empty, start: p(0, 0), end: p(4, 0), role: 'boundary' });
		if (ab.kind !== 'success') throw new Error('ab failed');
		const nearStart = junctionPoint(ab.document, ab.startJunctionId);
		// Near-miss without exact reuse allocates a fresh Junction.
		const near = planWallSegment({
			baseline: ab.document,
			start: junctionPoint(ab.document, ab.endJunctionId),
			end: [nearStart[0] + 1e-7, nearStart[1] - 1e-7],
			role: 'boundary'
		});
		expect(near.kind).toBe('success');
		if (near.kind !== 'success') return;
		expect(near.endJunctionId).not.toBe(ab.startJunctionId);
		expect(near.document.rooms).toHaveLength(0);
	});

	it('rejection mutates nothing and preserves prior Walls', () => {
		const empty = baseDocument();
		const enclosure = planWallChain({ baseline: empty, points: [p(0, 0), p(4, 0), p(4, 3), p(0, 3)], close: true, role: 'boundary' });
		if (enclosure.kind !== 'success') throw new Error('enclosure failed');
		const snapshot = structuredClone(enclosure.document);
		// P23B.3a S6 — redrawing the enclosure's own Wall along its exact span is an
		// INTENTIONAL extension of that group, so the operation declares both of the
		// Junctions it joins (class 3). Collinear overlap within a group is an
		// intrinsic failure that the policy does not relax, so the refusal — and its
		// atomicity — are exactly what P23.9 pinned.
		const rejected = planWallSegment({
			baseline: enclosure.document,
			start: p(0, 0),
			end: p(4, 0),
			role: 'boundary',
			endpointJunctionSnaps: [
				{ pointIndex: 0, junctionId: junctionIdAt(enclosure.document, 0, 0) },
				{ pointIndex: 1, junctionId: junctionIdAt(enclosure.document, 4, 0) }
			]
		});
		expect(rejected.kind).toBe('rejected');
		if (rejected.kind !== 'rejected') return;
		expect(rejected.rejection.code).toBe('collinear_overlap');
		expect(enclosure.document).toEqual(snapshot);
	});

	it('the SAME overlapping segment WITHOUT a declaration is permitted, un-noded geometry (P23B.3a S6)', () => {
		// The class-2 half, which P23.9 could not express: identical coordinates, no
		// declaration, so no shared topology — the new Wall is its own component and
		// the enclosure is byte-identical afterwards (F5's permitted overlap and
		// F8's scoped negative half).
		const empty = baseDocument();
		const enclosure = planWallChain({ baseline: empty, points: [p(0, 0), p(4, 0), p(4, 3), p(0, 3)], close: true, role: 'boundary' });
		if (enclosure.kind !== 'success') throw new Error('enclosure failed');
		const snapshot = structuredClone(enclosure.document);
		const placed = planWallSegment({
			baseline: enclosure.document,
			start: p(0, 0),
			end: p(4, 0),
			role: 'boundary'
		});
		expect(placed.kind).toBe('success');
		if (placed.kind !== 'success') return;
		expect(placed.splitWallIds).toHaveLength(0);
		expect(placed.document.walls).toHaveLength(enclosure.document.walls.length + 1);
		for (const wall of enclosure.document.walls) {
			expect(placed.document.walls.find((candidate) => candidate.id === wall.id)).toEqual(wall);
		}
		expect(enclosure.document).toEqual(snapshot);
	});

	it('a divider is a genuine 1→2 with predecessor metadata on survivor and child', () => {
		const empty = baseDocument();
		const enclosure = planWallChain({ baseline: empty, points: [p(0, 0), p(4, 0), p(4, 3), p(0, 3)], close: true, role: 'boundary' });
		if (enclosure.kind !== 'success') throw new Error('enclosure failed');
		const withMeta: LayoutDocumentWallFirst = {
			...enclosure.document,
			rooms: enclosure.document.rooms.map((room) => ({
				...room,
				name: 'Custom',
				floorThickness: 0.2,
				ceilingThickness: 0.3
			}))
		};
		const survivorId = withMeta.rooms[0]!.id;
		// P23B.3a S6 — the divider DECLARES both hosts it terminates on (the
		// enclosure's bottom and top Walls), which is what an author expresses by
		// snapping the segment's endpoints onto those faces. Without the declaration
		// the same segment is independent placement and splits nothing (asserted
		// below), so the Room contract here is reached by declaring the intent, not
		// by the coordinates happening to land on the Walls.
		const divider = planWallSegment({
			baseline: withMeta,
			start: p(2, 0),
			end: p(2, 3),
			role: 'boundary',
			endpointHostSnaps: [
				{ pointIndex: 0, wallId: horizontalWallAt(withMeta, 0) },
				{ pointIndex: 1, wallId: horizontalWallAt(withMeta, 3) }
			]
		});
		expect(divider.kind).toBe('success');
		if (divider.kind !== 'success') return;
		expect(divider.document.rooms).toHaveLength(2);
		const ids = divider.document.rooms.map((room) => room.id);
		expect(ids.filter((id) => id === survivorId)).toHaveLength(1);
		// Both children inherit non-default predecessor metadata (not birth defaults).
		for (const room of divider.document.rooms) {
			expect(room.floorThickness).toBe(0.2);
			expect(room.ceilingThickness).toBe(0.3);
		}
		expect(divider.document.rooms.find((room) => room.id === survivorId)!.name).toBe('Custom');
		// Authored provenance excludes host fragments.
		expect(divider.authoredWallIds).toHaveLength(1);
		expect(divider.splitWallIds).toHaveLength(2);
		expect(divider.createdWallIds).toContain(divider.authoredWallIds[0]);
	});

	it('1→2 divider: every Wall has exactly one physical/query representation', () => {
		const empty = baseDocument();
		const enclosure = planWallChain({ baseline: empty, points: [p(0, 0), p(4, 0), p(4, 3), p(0, 3)], close: true, role: 'boundary' });
		if (enclosure.kind !== 'success') throw new Error('enclosure failed');
		const divider = planWallSegment({
			baseline: enclosure.document,
			start: p(2, 0),
			end: p(2, 3),
			role: 'boundary',
			// P23B.3a S6 — both hosts declared (see the 1→2 divider suite above).
			endpointHostSnaps: [
				{ pointIndex: 0, wallId: horizontalWallAt(enclosure.document, 0) },
				{ pointIndex: 1, wallId: horizontalWallAt(enclosure.document, 3) }
			]
		});
		if (divider.kind !== 'success') throw new Error('divider failed');
		expect(divider.document.rooms).toHaveLength(2);
		const compiled = compileWallFirstLayoutGeometry(divider.document);
		// Canonical walls cover every document Wall exactly once.
		const documentWallIds = [...divider.document.walls.map((wall) => wall.id)].sort();
		expect(compiled.geometry.walls.map((wall) => wall.wallId).sort()).toEqual(documentWallIds);
		// Query spans group to one wallKey per Wall with no fake roomId.
		const wallSpans = compiled.geometry.queries.spans.filter((span) => span.kind === 'wall');
		const byWall = new Map<string, typeof wallSpans>();
		for (const span of wallSpans) {
			expect(span.roomId).toBeUndefined();
			const key = span.wallKey ?? span.segmentId;
			const list = byWall.get(key) ?? [];
			list.push(span);
			byWall.set(key, list);
		}
		expect([...byWall.keys()].sort()).toEqual(documentWallIds);
		// The shared divider Wall exists once although two Rooms reference it.
		const dividerId = divider.authoredWallIds[0]!;
		expect(byWall.has(dividerId)).toBe(true);
		const dividerWall = divider.document.walls.find((wall) => wall.id === dividerId)!;
		const referencingRooms = divider.document.rooms.filter((room) =>
			room.boundary.some((ref) => ref.wallId === dividerId)
		);
		expect(referencingRooms).toHaveLength(2);
		expect(dividerWall).toBeDefined();
	});

	it('partition segments never split Rooms', () => {
		const empty = baseDocument();
		const enclosure = planWallChain({ baseline: empty, points: [p(0, 0), p(4, 0), p(4, 3), p(0, 3)], close: true, role: 'boundary' });
		if (enclosure.kind !== 'success') throw new Error('enclosure failed');
		const first = planWallSegment({
			baseline: enclosure.document,
			start: p(1, 1),
			end: p(2, 1),
			role: 'partition'
		});
		expect(first.kind).toBe('success');
		if (first.kind !== 'success') return;
		expect(first.document.rooms).toHaveLength(1);
		const second = planWallSegment({
			baseline: first.document,
			start: junctionPoint(first.document, first.endJunctionId),
			end: p(3, 1),
			role: 'partition'
		});
		expect(second.kind).toBe('success');
		if (second.kind !== 'success') return;
		expect(second.document.rooms).toHaveLength(1);
		expect(second.document.rooms[0]!.id).toBe(enclosure.document.rooms[0]!.id);
	});

	it('roomless Wall exists in canonical compiled/query output (acceptance-blocking)', () => {
		const empty = baseDocument();
		const plan = planWallSegment({ baseline: empty, start: p(0, 0), end: p(4, 0), role: 'boundary' });
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.document.rooms).toHaveLength(0);
		const compiled = compileWallFirstLayoutGeometry(plan.document);
		expect(compiled.issues.filter((issue) => issue.severity !== 'warning')).toHaveLength(0);
		expect(compiled.geometry.walls).toHaveLength(1);
		expect(compiled.geometry.walls[0]!.wallId).toBe(plan.authoredWallIds[0]);
		// No fake Room ownership: roomless query records carry no roomId.
		const spans = compiled.geometry.queries.spans.filter((span) => span.segmentId === plan.authoredWallIds[0]);
		expect(spans.length).toBeGreaterThan(0);
		for (const span of spans) expect(span.roomId).toBeUndefined();
		const points = compiled.geometry.queries.points.filter((point) => point.segmentId === plan.authoredWallIds[0]);
		expect(points.length).toBeGreaterThan(0);
		for (const point of points) expect(point.roomId).toBeUndefined();
	});

	it('returns only Junction IDs that survive noding adoption', () => {
		const baseline = expectSuccess(
			planWallChain({ baseline: baseDocument(), points: [p(0, 0), p(4, 0), p(4, 3), p(0, 3)], close: true, role: 'boundary' })
		);
		const plan = expectSuccess(
			planWallSegment({
				baseline: baseline.document,
				start: [1e-16, 0],
				end: p(6, 6),
				role: 'boundary'
			})
		);
		expectReturnedJunctionIdsLive(plan);
	});

	it('typed exact length commits exactly one segment with the authored length', () => {
		const baseline = baseDocument();
		const start = p(1, 1);
		const length = 2.75;
		const end = p(1 + length, 1);
		const plan = planWallSegment({ baseline, start, end, role: 'boundary' });
		expect(plan.kind).toBe('success');
		if (plan.kind !== 'success') return;
		expect(plan.authoredWallIds).toHaveLength(1);
		const wall = plan.document.walls.find((candidate) => candidate.id === plan.authoredWallIds[0])!;
		const [ax, az] = plan.document.junctions.find((j) => j.id === wall.startJunctionId)!.point;
		const [bx, bz] = plan.document.junctions.find((j) => j.id === wall.endJunctionId)!.point;
		expect(Math.hypot(bx - ax, bz - az)).toBeCloseTo(length, 12);
		// The canonical end becomes the next continuation start.
		expect(junctionPoint(plan.document, plan.endJunctionId)).toEqual([1 + length, 1]);
	});
});

describe('P23B.3a S6 (review correction) — a declared host is validated and authorizes only its OWN component', () => {
	/**
	 * THREE components for the cascade proof:
	 *
	 * ```text
	 * A   two Walls sharing the corner (4,0):   a-horizontal (0,0)-(4,0)
	 *                                           a-vertical   (4,0)-(4,4)
	 * B   one independent Wall crossing A:      b           (-1,2)-(6,2)
	 * far a remote Wall no draft can meet:      remote      (20,20)-(24,20)
	 * ```
	 *
	 * A and B intersect (b crosses a-vertical at (4,2)) and that overlap is committed
	 * as PERMITTED independent geometry — the S4/S5 baseline the cascade test then
	 * draws against. Nothing here declares anything, so A and B stay two components.
	 */
	function threeComponentBaseline(): LayoutDocumentWallFirst {
		const a = expectSuccess(
			planWallChain({
				baseline: baseDocument(),
				points: [p(0, 0), p(4, 0), p(4, 4)],
				close: false,
				role: 'partition'
			})
		);
		const b = expectSuccess(
			planWallChain({
				baseline: a.document,
				points: [p(-1, 2), p(6, 2)],
				close: false,
				role: 'partition'
			})
		);
		const remote = expectSuccess(
			planWallChain({
				baseline: b.document,
				points: [p(20, 20), p(24, 20)],
				close: false,
				role: 'partition'
			})
		);
		return remote.document;
	}

	it('a declared connection to A cascades noding within A while intersecting independent B stays untouched', () => {
		const baseline = threeComponentBaseline();
		const aHorizontal = horizontalWallAt(baseline, 0);
		const aVertical = verticalWallAt(baseline, 4);
		const bWall = horizontalWallAt(baseline, 2);
		const bBefore = baseline.walls.find((wall) => wall.id === bWall)!;
		// Sanity: B really is an independent component that crosses A.
		expect(wallsShareTopologyComponent(baseline, bWall, aVertical)).toBe(false);

		// Draft from a station ON a-horizontal (the wall-span snap an author makes)
		// to a point past a-vertical. The declaration names ONE host; the crossing of
		// its sibling Wall is authorized by the COMPONENT, not by a second declaration.
		const plan = expectSuccess(
			planWallChain({
				baseline,
				points: [p(2, 0), p(6, 3)],
				close: false,
				role: 'partition',
				endpointHostSnaps: [{ pointIndex: 0, wallId: aHorizontal }]
			})
		);
		const chainWallId = plan.authoredWallIds[0]!;

		// CASCADE WITHIN A: both A Walls are noded, and the drafted Wall joins A.
		expect(plan.splitWallIds).toContain(aHorizontal);
		expect(plan.splitWallIds).toContain(aVertical);
		expect(wallsShareTopologyComponent(plan.document, aHorizontal, chainWallId)).toBe(true);
		expect(wallsShareTopologyComponent(plan.document, aVertical, chainWallId)).toBe(true);

		// INDEPENDENT B IS UNTOUCHED: not split, byte-identical, still its own
		// component, with NO junction minted at the crossing of the drafted Wall.
		expect(plan.splitWallIds).not.toContain(bWall);
		expect(plan.document.walls.find((wall) => wall.id === bWall)).toEqual(bBefore);
		expect(wallsShareTopologyComponent(plan.document, bWall, chainWallId)).toBe(false);
		expect(wallsShareTopologyComponent(plan.document, bWall, aHorizontal)).toBe(false);
		const crossing: [number, number] = [14 / 3, 2]; // drafted Wall meets b at y = 2
		expect(
			plan.document.junctions.filter(
				(junction) =>
					Math.hypot(junction.point[0] - crossing[0], junction.point[1] - crossing[1]) < 1e-9
			)
		).toHaveLength(0);

		// The planner and the shipped gate agree (R-3).
		expect(validateWallFirstTopology(plan.document)).toBeUndefined();
	});

	it('rejects a declaration naming a Wall the baseline does not have', () => {
		const baseline = threeComponentBaseline();
		expectRejected(
			planWallChain({
				baseline,
				points: [p(2, 0), p(6, 3)],
				close: false,
				role: 'partition',
				endpointHostSnaps: [{ pointIndex: 0, wallId: 'no-such-wall' }]
			}),
			'invalid_candidate_document'
		);
	});

	it('rejects a STALE declaration: a real host the operation neither touches nor meets', () => {
		// The remote Wall exists in the baseline, so this is exactly the claim a
		// malformed caller could try to use as blanket permission to node a distant
		// group. The declaration must fail closed rather than be ignored.
		const baseline = threeComponentBaseline();
		const remote = horizontalWallAt(baseline, 20);
		expectRejected(
			planWallChain({
				baseline,
				points: [p(2, 0), p(6, 3)],
				close: false,
				role: 'partition',
				endpointHostSnaps: [{ pointIndex: 0, wallId: remote }]
			}),
			'invalid_candidate_document'
		);
	});

	it('rejects a declaration naming a draft point the chain does not have', () => {
		const baseline = threeComponentBaseline();
		expectRejected(
			planWallChain({
				baseline,
				points: [p(2, 0), p(6, 3)],
				close: false,
				role: 'partition',
				endpointHostSnaps: [{ pointIndex: 2, wallId: horizontalWallAt(baseline, 0) }]
			}),
			'invalid_candidate_document'
		);
	});

	it('rejects two host declarations for one draft point instead of letting the last one win', () => {
		const baseline = threeComponentBaseline();
		expectRejected(
			planWallChain({
				baseline,
				points: [p(2, 0), p(6, 3)],
				close: false,
				role: 'partition',
				endpointHostSnaps: [
					{ pointIndex: 0, wallId: horizontalWallAt(baseline, 0) },
					{ pointIndex: 0, wallId: verticalWallAt(baseline, 4) }
				]
			}),
			'invalid_candidate_document'
		);
	});

	it('rejects a Junction anchor and a host from different components on one endpoint', () => {
		// Point 0 coincides with A's corner and DECLARES it, while the host
		// declaration names B — the two statements disagree about which group the
		// operation extends, and honoring both would join A to B implicitly.
		const baseline = threeComponentBaseline();
		expectRejected(
			planWallChain({
				baseline,
				points: [p(4, 0), p(6, 3)],
				close: false,
				role: 'partition',
				endpointJunctionSnaps: [{ pointIndex: 0, junctionId: junctionIdAt(baseline, 4, 0) }],
				endpointHostSnaps: [{ pointIndex: 0, wallId: horizontalWallAt(baseline, 2) }]
			}),
			'invalid_candidate_document'
		);
	});
});
