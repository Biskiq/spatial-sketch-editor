import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	planWallSegment,
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

function expectRejected(plan: ReturnType<typeof planWallChain>, code: string) {
	if (plan.kind !== 'rejected') throw new Error(`expected rejection ${code}, got success`);
	expect(plan.rejection.code).toBe(code);
	return plan;
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
		// T-nodes into both existing walls, splitting the room in two.
		const divider = expectSuccess(
			planWallChain({ baseline: withRoom, points: [p(2, 0), p(2, 3)], close: false, role: 'boundary' })
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

	it('a boundary chain that overlaps an existing wall rejects atomically', () => {
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		// A chain drawn exactly along the existing wall (0,0)→(4,0).
		expectRejected(
			planWallChain({
				baseline: enclosure.document,
				points: [p(0, 0), p(4, 0)],
				close: false,
				role: 'boundary'
			}),
			'collinear_overlap'
		);
	});

	it('a chain T-ing into a wall interior performs canonical subdivision', () => {
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		const withRoom = enclosure.document;
		// Dead-end spur hitting the bottom wall's interior at x=3.
		const spur = expectSuccess(
			planWallChain({ baseline: withRoom, points: [p(3, -2), p(3, 0)], close: false, role: 'boundary' })
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

	it('an X crossing between the chain and an existing wall nodes explicitly', () => {
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		const withRoom = enclosure.document;
		// A long partition crossing the whole room east-west at z=1.5, extending
		// past both side walls: crosses wall (4,0)→(4,3) and (0,3)→(0,0)? No —
		// inside the rect it only crosses nothing; extend outside to cross the
		// left and right boundary walls.
		const crossing = expectSuccess(
			planWallChain({ baseline: withRoom, points: [p(-1, 1.5), p(5, 1.5)], close: false, role: 'partition' })
		);
		// Both side walls noded at the crossing junction; the chain wall also
		// fragments at both crossings, and two new junctions arrive from the
		// chain endpoints (the crossing junction is shared).
		expect(crossing.splitWallIds).toHaveLength(3);
		expect(crossing.document.junctions.length).toBe(withRoom.junctions.length + 3 + 1);
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
});

describe('P23.9 junction reuse', () => {
	it('reuses an existing junction when a chain endpoint lands on it', () => {
		const baseline = baseDocument();
		const enclosure = expectSuccess(
			planWallChain({ baseline, points: [...RECT], close: true, role: 'boundary' })
		);
		const withRoom = enclosure.document;
		const cornerJunction = withRoom.walls[0]!.startJunctionId;
		const before = withRoom.junctions.length;

		// Spur starting exactly at an existing corner junction.
		const spur = expectSuccess(
			planWallChain({ baseline: withRoom, points: [p(0, 0), p(0, -2)], close: false, role: 'partition' })
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
		// East-west divider across both rooms plus the open gap between them:
		// two independent 1→2 components in a single chain command.
		const plan = expectSuccess(
			planWallChain({ baseline, points: [p(-1, 1.5), p(11, 1.5)], close: false, role: 'boundary' })
		);
		expect(plan.document.rooms).toHaveLength(4);
		// One survivor per split: both predecessor IDs persist by lineage.
		const before = new Set(baseline.rooms.map((room) => room.id));
		const survivors = plan.document.rooms.filter((room) => before.has(room.id));
		expect(survivors).toHaveLength(2);
	});

	it('a chain with a valid prefix plus an overlapping leg rejects atomically', () => {
		const baseline = twoRoomBaseline();
		const snapshot = structuredClone(baseline);
		// Leg 1 stubs into the left room's bottom-wall interior (valid T);
		// leg 2 runs along the existing bottom wall (collinear overlap).
		const plan = planWallChain({
			baseline,
			points: [p(2, -1), p(2, 0), p(4, 0)],
			close: false,
			role: 'boundary'
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

		// Continuous drawing: the canonical end becomes the next start (exact
		// coordinate reuse, no tool re-entry).
		const second = planWallSegment({
			baseline: first.document,
			start: endPoint,
			end: p(4, 3),
			role: 'boundary'
		});
		expect(second.kind).toBe('success');
		if (second.kind !== 'success') return;
		expect(second.document.walls).toHaveLength(2);
		expect(second.document.rooms).toHaveLength(0);
		// The shared junction is reused, not duplicated.
		expect(second.startJunctionId).toBe(first.endJunctionId);
	});

	it('room closure: AB+BC+CD then DA onto the run-start Junction births one Room atomically', () => {
		const empty = baseDocument();
		const ab = planWallSegment({ baseline: empty, start: p(0, 0), end: p(4, 0), role: 'boundary' });
		if (ab.kind !== 'success') throw new Error('ab failed');
		const bc = planWallSegment({
			baseline: ab.document,
			start: junctionPoint(ab.document, ab.endJunctionId),
			end: p(4, 3),
			role: 'boundary'
		});
		if (bc.kind !== 'success') throw new Error('bc failed');
		const cd = planWallSegment({
			baseline: bc.document,
			start: junctionPoint(bc.document, bc.endJunctionId),
			end: p(0, 3),
			role: 'boundary'
		});
		if (cd.kind !== 'success') throw new Error('cd failed');
		expect(cd.document.rooms).toHaveLength(0);
		const runStart = ab.startJunctionId;
		const da = planWallSegment({
			baseline: cd.document,
			start: junctionPoint(cd.document, cd.endJunctionId),
			end: junctionPoint(cd.document, runStart),
			role: 'boundary'
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
		const rejected = planWallSegment({
			baseline: enclosure.document,
			start: p(0, 0),
			end: p(4, 0),
			role: 'boundary'
		});
		expect(rejected.kind).toBe('rejected');
		if (rejected.kind !== 'rejected') return;
		expect(rejected.rejection.code).toBe('collinear_overlap');
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
		const divider = planWallSegment({ baseline: withMeta, start: p(2, 0), end: p(2, 3), role: 'boundary' });
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
		const divider = planWallSegment({ baseline: enclosure.document, start: p(2, 0), end: p(2, 3), role: 'boundary' });
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
