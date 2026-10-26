/**
 * T1.P02.S06 D.3 (H1) — the incremental compile session.
 *
 * Two obligations, and nothing else counts as evidence:
 *
 * 1. **Equal output.** For every edit in a sweep, a session compile must equal a
 *    cold `compileWallFirstLayoutGeometry` of the same document *including every
 *    `cacheKey`*. Keys are compared here on purpose (the D.1 differential strips
 *    them): retention is proved by keys, so a key that does not change when its
 *    entity does is a bug this suite must catch, not forgive.
 * 2. **Local evaluation.** A single-Wall edit must rebuild a bounded number of
 *    entities regardless of how many unrelated Rooms the document has. The
 *    assertion is a count, not a duration: these tests are deterministic.
 *
 * The sweep deliberately covers the three ways an entity can be invalidated —
 * its own authored fields, its host's geometry (an Opening when its Wall moves)
 * and its neighbour's identity (a Junction when an incident Wall's role or
 * openings change) — because each is a separate arm of the retention proof.
 */
import { describe, expect, it } from 'vitest';
import {
	compileWallFirstLayoutGeometry,
	createLayoutCompileSession,
	cowCreateObject,
	cowDeleteObject,
	cowMoveJunctions,
	cowMoveRigidWall,
	cowSetWallScalar,
	cowUpdateObject,
	cowUpdateOpening,
	ensureLayoutWorldIndex,
	linkClonedCowCandidate,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';
import { immutableF4Data } from '@portfolio/project-model';

import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from './__fixtures__/layout-scale-fixtures';

/** Whole compiled result, keys included: this is the retention proof's own claim. */
function exactCompiled(document: LayoutDocumentWallFirst): string {
	return JSON.stringify(compileWallFirstLayoutGeometry(document).geometry);
}

function issuesOf(document: LayoutDocumentWallFirst): string {
	return JSON.stringify(compileWallFirstLayoutGeometry(document).issues);
}

/** A deep copy through JSON, so an edit never mutates a retained document. */
function clone(document: LayoutDocumentWallFirst): LayoutDocumentWallFirst {
	return JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
}

function moveJunction(document: LayoutDocumentWallFirst, junctionId: string, point: LayoutVec2): LayoutDocumentWallFirst {
	const next = clone(document);
	const junction = next.junctions.find((candidate) => candidate.id === junctionId);
	if (!junction) throw new Error(`no junction ${junctionId}`);
	junction.point = [...point] as LayoutVec2;
	return next;
}

function setWallHeight(document: LayoutDocumentWallFirst, wallId: string, height: number): LayoutDocumentWallFirst {
	const next = clone(document);
	const wall = next.walls.find((candidate) => candidate.id === wallId);
	if (!wall) throw new Error(`no wall ${wallId}`);
	wall.height = height;
	return next;
}

function setWallThickness(document: LayoutDocumentWallFirst, wallId: string, thickness: number): LayoutDocumentWallFirst {
	const next = clone(document);
	const wall = next.walls.find((candidate) => candidate.id === wallId);
	if (!wall) throw new Error(`no wall ${wallId}`);
	wall.thickness = thickness;
	return next;
}

function setFloorElevation(document: LayoutDocumentWallFirst, elevation: number): LayoutDocumentWallFirst {
	const next = clone(document);
	next.floor.elevation = elevation;
	return next;
}

function renameFloor(document: LayoutDocumentWallFirst, floorId: string): LayoutDocumentWallFirst {
	const next = clone(document);
	next.floor.id = floorId;
	return next;
}

function moveOpening(document: LayoutDocumentWallFirst, openingId: string, offset: number): LayoutDocumentWallFirst {
	const next = clone(document);
	const opening = next.openings.find((candidate) => candidate.id === openingId);
	if (!opening) throw new Error(`no opening ${openingId}`);
	opening.offset = offset;
	return next;
}

describe('T1.P02.S06 H1 — incremental canonical compile', () => {
	it('equals a cold compile on an untouched document and rebuilds nothing twice', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const session = createLayoutCompileSession();
		const first = session.compile(document);
		const cold = compileWallFirstLayoutGeometry(document);
		expect(JSON.stringify(first.geometry)).toBe(JSON.stringify(cold.geometry));
		expect(JSON.stringify(first.issues)).toBe(JSON.stringify(cold.issues));
		expect(session.stats().cold).toBe(true);
		expect(session.stats().wallsReused).toBe(0);

		const second = session.compile(document);
		expect(JSON.stringify(second.geometry)).toBe(JSON.stringify(cold.geometry));
		const stats = session.stats();
		// A no-op recompile evaluates nothing: every entity's authored inputs are
		// the same values, so every unit is installed by reference.
		expect(stats.cold).toBe(false);
		expect(stats.wallsEvaluated).toBe(0);
		expect(stats.junctionsEvaluated).toBe(0);
		expect(stats.roomsEvaluated).toBe(0);
		expect(stats.objectsEvaluated).toBe(0);
		expect(stats.wallsReused).toBe(document.walls.length);
		expect(stats.roomsReused).toBe(document.rooms.length);
	});

	it('keeps identity by reference for an unchanged entity and rebuilds only the edited one', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const session = createLayoutCompileSession();
		const before = session.compile(document).geometry;

		const target = document.junctions[0]!;
		const moved = moveJunction(document, target.id, [target.point[0] + 0.25, target.point[1] + 0.25]);
		const after = session.compile(moved).geometry;

		// A Wall in an unrelated Room is the same object: its own authored fields,
		// its endpoint coordinates and its Junctions' joins are all untouched. The
		// edit's own neighbourhood may legitimately rebuild (a moved end re-miters
		// the Wall across the Junction), which is why the assertion is about a
		// *far* entity rather than every non-incident one.
		const farRoom = document.rooms.at(-1)!;
		const farWallIds = new Set(document.walls.filter((wall) => wall.id.startsWith(`${farRoom.id}:`)).map((wall) => wall.id));
		expect(farWallIds.size).toBeGreaterThan(0);
		const afterById = new Map(after.walls.map((wall) => [wall.wallId, wall]));
		for (const wall of before.walls) {
			if (!farWallIds.has(wall.wallId)) continue;
			expect(afterById.get(wall.wallId)).toBe(wall);
		}
		// Unrelated Rooms are untouched by reference too.
		const afterRooms = new Map(after.rooms.map((room) => [room.roomId, room]));
		expect(afterRooms.get(farRoom.id)).toBe(before.rooms.at(-1));

		// And the result still equals a cold compile, keys included.
		expect(JSON.stringify(after)).toBe(exactCompiled(moved));
	});

	it('equals a cold compile across a sweep of every edit class', () => {
		const base = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const session = createLayoutCompileSession();
		session.compile(base);

		const junction = base.junctions[3]!;
		const wall = base.walls[2]!;
		const opening = base.openings[0]!;

		const edits: Array<{ name: string; next: LayoutDocumentWallFirst; expectChange: boolean }> = [
			{ name: 'junction move', next: moveJunction(base, junction.id, [junction.point[0] + 0.4, junction.point[1]]), expectChange: true },
			{
				name: 'junction move back',
				next: moveJunction(base, junction.id, [junction.point[0] + 0.4, junction.point[1]]),
				expectChange: false
			},
			{ name: 'wall height', next: setWallHeight(base, wall.id, wall.height + 0.5), expectChange: true },
			{ name: 'wall thickness', next: setWallThickness(base, wall.id, wall.thickness + 0.02), expectChange: true },
			{ name: 'opening offset', next: moveOpening(base, opening.id, opening.offset + 0.1), expectChange: true },
			{ name: 'back to base', next: clone(base), expectChange: true }
		];

		let previous = exactCompiled(base);
		for (const edit of edits) {
			const compiled = session.compile(edit.next);
			// Exact equality, `cacheKey` included: the retention proof and the
			// canonical compiler must not disagree about a single entity.
			expect(JSON.stringify(compiled.geometry), edit.name).toBe(exactCompiled(edit.next));
			expect(JSON.stringify(compiled.issues), edit.name).toBe(issuesOf(edit.next));
			const changed = JSON.stringify(compiled.geometry) !== previous;
			expect(changed, `${edit.name} changed output`).toBe(edit.expectChange);
			previous = JSON.stringify(compiled.geometry);
		}
	});

	it('equals a cold compile when a document-level datum moves, including one no Room owns', () => {
		const base = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const session = createLayoutCompileSession();
		session.compile(base);

		// Each of these moves a compiled field of *every* Room or Junction without
		// touching the entity's own authored record, so a retention signature that
		// omits it would install a stale value: the Floor datum (Room and Junction
		// ids, Junction vertical extent), the Floor elevation (bounds), and the
		// document's first Wall thickness (the Room source's fallback thickness,
		// which reaches the compiled Room even when that Wall bounds no Room).
		const cases: Array<{ name: string; next: LayoutDocumentWallFirst }> = [
			{ name: 'floor elevation', next: setFloorElevation(base, base.floor.elevation + 0.4) },
			{ name: 'floor id', next: renameFloor(base, 'floor-renamed') },
			{ name: 'first wall thickness', next: setWallThickness(base, base.walls[0]!.id, base.walls[0]!.thickness + 0.03) }
		];

		for (const entry of cases) {
			const compiled = session.compile(entry.next);
			expect(JSON.stringify(compiled.geometry), entry.name).toBe(exactCompiled(entry.next));
			expect(JSON.stringify(compiled.issues), entry.name).toBe(issuesOf(entry.next));
		}
	});

	it('never reuses a unit across documents that share ids but differ in document data', () => {
		// The adapter keeps one session for its own planners (a page-level store),
		// so a session can be handed a different document. Units are keyed by id, so
		// the signatures must carry every document-level input the shared ids rely
		// on — this is the falsifier for that, not a claim that a session is scoped.
		const first = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const session = createLayoutCompileSession();
		session.compile(first);

		const other = clone(first);
		other.floor.elevation = 2.5;
		other.floor.id = 'floor-mezzanine';
		for (const room of other.rooms) room.ceilingThickness = 0.35;

		const compiled = session.compile(other);
		expect(JSON.stringify(compiled.geometry)).toBe(exactCompiled(other));
		expect(JSON.stringify(compiled.issues)).toBe(issuesOf(other));
	});

	it('rebuilds a bounded set of entities for one Wall edit, independent of unrelated Room count', () => {
		const small = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const medium = buildScaleFixture(SCALE_FIXTURE_SEEDS.medium);

		function editOneWall(document: LayoutDocumentWallFirst): {
			evaluated: number;
			walls: number;
			junctions: number;
			rooms: number;
			objects: number;
		} {
			const session = createLayoutCompileSession();
			session.compile(document);
			const wall = document.walls[0]!;
			// A Wall edit in this fixture moves one endpoint coordinate — the same
			// change a precision drag produces.
			const next = moveJunction(document, wall.startJunctionId!, [
				document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point[0],
				document.junctions.find((junction) => junction.id === wall.startJunctionId)!.point[1] - 0.3
			]);
			session.compile(next);
			const stats = session.stats();
			return {
				evaluated:
					stats.wallsEvaluated + stats.junctionsEvaluated + stats.roomsEvaluated + stats.objectsEvaluated,
				walls: stats.wallsEvaluated,
				junctions: stats.junctionsEvaluated,
				rooms: stats.roomsEvaluated,
				objects: stats.objectsEvaluated
			};
		}

		const smallRun = editOneWall(small);
		const mediumRun = editOneWall(medium);

		// The document grows 10× (10 rooms → 100 rooms, 40 → 400 Walls) while the
		// edit's evaluated set stays the same size: it is the moved Junction's
		// Walls, that Junction, and the Rooms those Walls bound.
		expect(mediumRun.evaluated).toBe(smallRun.evaluated);
		expect(mediumRun.walls).toBe(smallRun.walls);
		expect(mediumRun.rooms).toBe(smallRun.rooms);
		// A single-cell Wall is bounded by its two Junctions and four Walls; this
		// only guards against a regression that starts rebuilding the document.
		expect(mediumRun.evaluated).toBeLessThanOrEqual(12);
		expect(mediumRun.rooms).toBeLessThanOrEqual(2);
	});

	it('releases retained units for entities that leave the document', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const session = createLayoutCompileSession();
		session.compile(document);
		expect(session.retained().walls).toBe(document.walls.length);

		const next = clone(document);
		const removed = next.objects[0]!;
		next.objects = next.objects.filter((object) => object.id !== removed.id);
		session.compile(next);
		expect(session.released()).toBe(1);
		expect(session.retained().objects).toBe(document.objects.length - 1);
	});

	it('reports a warm compile for a document whose retained units are objects only', () => {
		// The store holds four classes of unit. A document with no Walls, Junctions
		// or Rooms retains objects only, and a "cold" test that looked at Walls and
		// Room sources alone would call its second compile cold while its objects
		// were in fact reused.
		const base = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const document: LayoutDocumentWallFirst = {
			...clone(base),
			walls: [],
			junctions: [],
			rooms: [],
			openings: []
		};
		expect(document.objects.length).toBeGreaterThan(0);
		const session = createLayoutCompileSession();
		const first = session.compile(document);
		expect(session.stats().cold).toBe(true);
		const second = session.compile(document);
		expect(session.stats().cold).toBe(false);
		expect(session.stats().objectsReused).toBe(document.objects.length);
		expect(JSON.stringify(second.geometry)).toBe(JSON.stringify(first.geometry));
	});

	// A differential sweep, not a latency check: its duration depends on how many other
	// files the lane is transforming at the same time, so it states its own budget rather
	// than inheriting the default that fits a single small unit test.
	it('equals a cold compile across mixed COW deltas, membership changes and historical restores', { timeout: 120000 }, () => {
		// The sweep above proves the canonical compiler's retention; this proves the
		// *persistent-root* path the planners actually take. Each candidate is a
		// copy-on-write delta, captured (frozen) exactly as F4 hands it to the Stage,
		// so the session alternates between delta compiles and snapshot restores —
		// including across an Object membership change and a branch from an old root.
		let state = 97 >>> 0;
		const random = (): number => {
			state = (state + 0x6d2b79f5) >>> 0;
			let t = state;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
		const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;

		const base = immutableF4Data(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		ensureLayoutWorldIndex(base);
		const session = createLayoutCompileSession();
		let document: LayoutDocumentWallFirst = base;
		session.compile(document);
		const history: LayoutDocumentWallFirst[] = [document];

		for (let step = 0; step < 24; step += 1) {
			const world = ensureLayoutWorldIndex(document);
			const roll = random();
			let candidate: LayoutDocumentWallFirst;
			if (roll < 0.3) {
				const junction = pick(document.junctions);
				const incident = document.walls.filter((wall) => wall.startJunctionId === junction.id || wall.endJunctionId === junction.id);
				candidate = cowMoveJunctions(
					document,
					new Map([[junction.id, [junction.point[0] + (random() - 0.5) * 0.05, junction.point[1] + (random() - 0.5) * 0.05] as LayoutVec2]]),
					incident.map((wall) => wall.id),
					world
				);
			} else if (roll < 0.5) {
				const wall = pick(document.walls);
				candidate = cowSetWallScalar(document, wall.id, { thickness: wall.thickness + (random() - 0.5) * 0.02 }, world);
			} else if (roll < 0.62) {
				const wall = pick(document.walls);
				candidate = cowMoveRigidWall(document, wall.id, [(random() - 0.5) * 0.03, (random() - 0.5) * 0.03], [wall.startJunctionId!, wall.endJunctionId!], [wall.id], world);
			} else if (roll < 0.74 && document.openings.length > 0) {
				const opening = pick(document.openings);
				candidate = cowUpdateOpening(document, opening.id, { ...opening, offset: Math.max(0.01, opening.offset + (random() - 0.5) * 0.05) }, world);
			} else if (roll < 0.86) {
				candidate = cowCreateObject(document, {
					id: `object-delta-${step}`, kind: 'box', position: [random() * 3, 0.25, random() * 3], rotation: [0, random(), 0], dimensions: [0.3, 0.4, 0.5]
				});
			} else if (document.objects.length > 8) {
				candidate = cowDeleteObject(document, pick(document.objects).id);
			} else {
				const object = pick(document.objects);
				candidate = cowUpdateObject(document, object.id, (current) => ({ ...current, rotation: [0, random() * 3, 0] }), world);
			}
			const captured = immutableF4Data(candidate);
			linkClonedCowCandidate(candidate, captured);
			const compiled = session.compile(captured);
			expect(JSON.stringify(compiled.geometry), `step ${step} geometry`).toBe(exactCompiled(captured));
			expect(JSON.stringify(compiled.issues), `step ${step} issues`).toBe(issuesOf(captured));
			document = captured;
			history.push(document);
			if (step % 7 === 6) {
				const root = history[Math.floor(random() * history.length)]!;
				const restored = session.compile(root);
				expect(JSON.stringify(restored.geometry), `step ${step} restore`).toBe(exactCompiled(root));
				document = root;
			}
		}
	});

	it('a reset session is cold again and still equal', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const session = createLayoutCompileSession();
		session.compile(document);
		session.reset();
		const compiled = session.compile(document);
		expect(session.stats().cold).toBe(true);
		expect(JSON.stringify(compiled.geometry)).toBe(exactCompiled(document));
	});
});
