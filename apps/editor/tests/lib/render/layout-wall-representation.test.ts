/**
 * T1.P02.S06 D.3 (H4) — the retained Stage wall representation.
 *
 * The obligations, as counts rather than durations:
 *
 * - a compile that changed nothing builds nothing and creates no material;
 * - a compile that moved one Wall rebuilds a bounded set (that Wall and whatever
 *   its moved Junction re-miters), keeps every other mesh object, and releases
 *   nothing;
 * - a Wall that leaves the document has its buffers released in the same update;
 * - a rebuilt Wall's buffers equal a from-scratch rebuild's, so "retained" never
 *   means "stale";
 * - `dispose()` releases everything exactly once.
 */
import { describe, expect, it, vi } from 'vitest';
import { BufferGeometry } from 'three';
import {
	compileWallFirstLayoutGeometry,
	createLayoutCompileSession,
	ensureLayoutWorldIndex,
	planRigidWallMove,
	withLayoutCompileSession,
	type LayoutDocumentWallFirst,
	type LayoutVec2
} from '@portfolio/layout-core';

import { immutableF4Data } from '@portfolio/project-model';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from '../layout/__fixtures__/layout-scale-fixtures';
import { createWallRepresentation } from '$lib/render/layout-wall-representation';
import { renderIdentityOf } from '$lib/render/render-identity';
import { startStageCounting } from '../../helpers/stage-counts';

function compiled(document: LayoutDocumentWallFirst) {
	return compileWallFirstLayoutGeometry(document).geometry;
}

function moved(document: LayoutDocumentWallFirst, wallIndex = 0): LayoutDocumentWallFirst {
	const next = JSON.parse(JSON.stringify(document)) as LayoutDocumentWallFirst;
	const wall = next.walls[wallIndex]!;
	const junction = next.junctions.find((candidate) => candidate.id === wall.startJunctionId)!;
	junction.point = [junction.point[0] + 0.35, junction.point[1] + 0.2] as LayoutVec2;
	return next;
}

/** Every mesh the representation holds, keyed by name. */
function meshes(representation: ReturnType<typeof createWallRepresentation>) {
	const found = new Map<string, import('three').Mesh>();
	representation.object3d.traverse((object) => {
		if ((object as { isMesh?: boolean }).isMesh) found.set(object.name, object as import('three').Mesh);
	});
	return found;
}

describe('T1.P02.S06 H4 — retained wall representation', () => {
	it('builds one mesh per Wall on the first update and nothing on the second', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const geometry = compiled(document);
		const representation = createWallRepresentation();

		const first = representation.update(geometry);
		expect(first.walls).toBe(geometry.walls.length);
		expect(first.built).toBe(geometry.walls.length);
		expect(first.retained).toBe(0);
		expect(first.released).toBe(0);
		expect(representation.object3d.children).toHaveLength(geometry.walls.length);

		const before = meshes(representation);
		const second = representation.update(geometry);
		expect(second.built).toBe(0);
		expect(second.retained).toBe(geometry.walls.length);
		expect(second.released).toBe(0);
		// The same mesh objects, not equal ones.
		for (const [name, mesh] of meshes(representation)) expect(mesh).toBe(before.get(name));
		// One material per tint, and a compile creates none.
		expect(second.materials).toBe(first.materials);

		representation.dispose();
	});

	it('rebuilds only the Walls a single Wall edit moved, and keeps every other mesh (isolated-cell fixture)', () => {
		// This fixture is the isolated-cell plan, where a Junction edit touches that
		// cell's two Walls and their neighbours (measured bound: ≤ 4). A *chained*
		// plan re-miters further along the chain — `probe-h4-representation.ts`
		// counts 10.2 / 11.7 / 12.7 of 24 / 112 / 420 Walls at S / M / L — so the
		// absolute bound here is fixture-specific and the invariant below
		// (built + retained = walls) is the one that holds everywhere.
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const representation = createWallRepresentation();
		const base = compiled(document);
		representation.update(base);
		const before = meshes(representation);

		const next = compiled(moved(document));
		const stats = representation.update(next);

		// A moved endpoint re-resolves its Junction, so that Junction's Walls
		// re-miter; nothing else may be rebuilt.
		expect(stats.built).toBeLessThanOrEqual(4);
		expect(stats.built).toBeGreaterThan(0);
		expect(stats.built + stats.retained).toBe(stats.walls);
		expect(stats.retained).toBe(next.walls.length - stats.built);
		expect(stats.released).toBe(0);

		const after = meshes(representation);
		let kept = 0;
		for (const [name, mesh] of after) {
			const previous = before.get(name);
			if (previous === mesh) kept += 1;
		}
		expect(kept).toBe(stats.retained);
		// Every mounted mesh is really a child of the group. Assigning
		// `children[index]` instead of attaching through `add()` leaves `parent`
		// unset, which makes `removeFromParent()` a no-op and leaks the mesh.
		for (const child of representation.object3d.children) expect(child.parent).toBe(representation.object3d);
		expect(representation.object3d.children).toHaveLength(next.walls.length);

		representation.dispose();
	});

	it('releases a departed Wall s buffers in the same update', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const representation = createWallRepresentation();
		const base = compiled(document);
		representation.update(base);

		const removed = base.walls.at(-1)!;
		const pruned = {
			...base,
			walls: base.walls.filter((wall) => wall.wallId !== removed.wallId)
		};
		const disposeSpy = vi.spyOn(BufferGeometry.prototype, 'dispose');
		const stats = representation.update(pruned);
		expect(stats.released).toBe(1);
		expect(stats.built).toBe(0);
		expect(disposeSpy).toHaveBeenCalled();
		disposeSpy.mockRestore();
		expect(meshes(representation).has(`VisitorPhysicalWall:${removed.wallId}`)).toBe(false);

		representation.dispose();
	});

	it('a retained rebuild equals a from-scratch build buffer for buffer', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const edited = moved(document);
		const geometry = compiled(edited);

		const incremental = createWallRepresentation();
		const base = compiled(document);
		incremental.update(base);
		incremental.update(geometry);

		const fresh = createWallRepresentation();
		fresh.update(geometry);

		const incrementalMeshes = meshes(incremental);
		const freshMeshes = meshes(fresh);
		expect([...incrementalMeshes.keys()].sort()).toEqual([...freshMeshes.keys()].sort());
		for (const [name, mesh] of freshMeshes) {
			const other = incrementalMeshes.get(name)!;
			const left = mesh.geometry.getAttribute('position');
			const right = other.geometry.getAttribute('position');
			expect(right.count, name).toBe(left.count);
			expect(Array.from(right.array as Float32Array), name).toEqual(Array.from(left.array as Float32Array));
		}

		incremental.dispose();
		fresh.dispose();
	});

	it('disposes every mesh buffer exactly once', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const geometry = compiled(document);
		const representation = createWallRepresentation();
		representation.update(geometry);
		// Count per geometry, not per call: "at least N calls" also passes on a
		// double dispose, which is the failure mode that matters here.
		const disposed = new Map<object, number>();
		const original = BufferGeometry.prototype.dispose;
		const disposeSpy = vi
			.spyOn(BufferGeometry.prototype, 'dispose')
			.mockImplementation(function counted(this: BufferGeometry) {
				disposed.set(this, (disposed.get(this) ?? 0) + 1);
				original.call(this);
			});

		representation.dispose();
		expect(disposed.size).toBe(geometry.walls.length);
		expect([...disposed.values()].every((count) => count === 1)).toBe(true);
		expect(representation.object3d.children).toHaveLength(0);

		disposeSpy.mockClear();
		representation.dispose();
		expect(disposeSpy).not.toHaveBeenCalled();
		disposeSpy.mockRestore();
	});
});

describe('E1/R1 — owned render identity on the wall representation', () => {
	it('objectOf returns the retained mesh, tagged with its id, for every compiled Wall', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const representation = createWallRepresentation();
		representation.update(geometry);
		for (const wall of geometry.walls) {
			const object = representation.objectOf(wall.wallId);
			expect(object, wall.wallId).not.toBeNull();
			expect(object!.parent).toBe(representation.object3d);
			expect(renderIdentityOf(object!)).toEqual({ kind: 'wall', id: wall.wallId });
		}
		expect(representation.objectOf('no-such-wall')).toBeNull();
		representation.dispose();
	});

	it('resolves by identity, so renaming an object changes nothing', () => {
		const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const representation = createWallRepresentation();
		representation.update(geometry);
		const wall = geometry.walls[0]!;
		const object = representation.objectOf(wall.wallId)!;
		object.name = 'renamed';
		expect(representation.objectOf(wall.wallId)).toBe(object);
		expect(renderIdentityOf(object)?.id).toBe(wall.wallId);
		representation.dispose();
	});

	it('indexes whatever object currently draws each Wall after an edit, and is null after release', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const representation = createWallRepresentation();
		const base = compiled(document);
		representation.update(base);
		const before = new Map(base.walls.map((wall) => [wall.wallId, representation.objectOf(wall.wallId)!] as const));

		const next = compiled(moved(document));
		const stats = representation.update(next);
		expect(stats.built).toBeGreaterThan(0);
		let kept = 0;
		for (const wall of next.walls) {
			const object = representation.objectOf(wall.wallId)!;
			// The index never points at a detached or superseded object.
			expect(object.parent, wall.wallId).toBe(representation.object3d);
			expect(renderIdentityOf(object)).toEqual({ kind: 'wall', id: wall.wallId });
			if (object === before.get(wall.wallId)) kept += 1;
		}
		expect(kept).toBeGreaterThanOrEqual(stats.retained);

		const removed = next.walls.at(-1)!;
		representation.update({ ...next, walls: next.walls.filter((wall) => wall.wallId !== removed.wallId) });
		expect(representation.objectOf(removed.wallId)).toBeNull();

		representation.dispose();
		for (const wall of next.walls) expect(representation.objectOf(wall.wallId)).toBeNull();
	});

	it('hides k of W Walls with k writes, independent of W', () => {
		const counting = startStageCounting();
		try {
			const writes = [] as number[];
			for (const tier of ['small', 'medium'] as const) {
				const geometry = compiled(buildScaleFixture(SCALE_FIXTURE_SEEDS[tier]));
				const representation = createWallRepresentation();
				representation.update(geometry);
				const ids = geometry.walls.map((wall) => wall.wallId);
				counting.reset();
				const hide = new Set(ids.slice(0, 3));
				representation.setHidden(hide);
				writes.push(counting.count('representation:visibility-write'));
				// Nothing but the three changed Walls was visited: no scan of the other W - 3.
				expect(counting.count('representation:wall-entry-test')).toBe(0);
				expect(counting.count('representation:child-array-scan-bound')).toBe(0);
				for (const id of ids) expect(representation.objectOf(id)!.visible, id).toBe(!hide.has(id));

				// The same set again is free; moving to a disjoint set costs unhide + hide.
				counting.reset();
				representation.setHidden(new Set(hide));
				expect(counting.count('representation:visibility-write')).toBe(0);
				representation.setHidden(new Set(ids.slice(3, 5)));
				expect(counting.count('representation:visibility-write')).toBe(5);
				representation.setHidden(new Set());
				for (const id of ids) expect(representation.objectOf(id)!.visible, id).toBe(true);
				representation.dispose();
			}
			expect(writes).toEqual([3, 3]);
		} finally {
			counting.stop();
		}
	}, 60_000);

	it('remembers the hidden set: a rebuilt Wall stays hidden and a later Wall is born hidden', () => {
		const document = buildScaleFixture(SCALE_FIXTURE_SEEDS.small);
		const representation = createWallRepresentation();
		const base = compiled(document);
		// Hidden before the Wall exists: it must be born hidden.
		const early = base.walls[0]!.wallId;
		representation.setHidden(new Set([early]));
		representation.update(base);
		expect(representation.objectOf(early)!.visible).toBe(false);

		// Hide a Wall the next edit rebuilds: copy() resets visibility, so it must be reapplied.
		const next = compiled(moved(document));
		const rebuilt = base.walls.find((wall) => next.walls.find((other) => other.wallId === wall.wallId)!.cacheKey !== wall.cacheKey)!.wallId;
		representation.setHidden(new Set([early, rebuilt]));
		const stats = representation.update(next);
		expect(stats.built).toBeGreaterThan(0);
		expect(representation.objectOf(rebuilt)!.visible).toBe(false);
		expect(representation.objectOf(early)!.visible).toBe(false);
		for (const wall of next.walls) {
			if (wall.wallId !== early && wall.wallId !== rebuilt) expect(representation.objectOf(wall.wallId)!.visible).toBe(true);
		}
		representation.dispose();
	}, 60_000);

	it('keeps a hidden Wall hidden, tagged and the same mesh across a session delta (the copy path)', () => {
		let document = immutableF4Data(buildScaleFixture(SCALE_FIXTURE_SEEDS.small));
		const session = createLayoutCompileSession();
		const base = session.compile(document).geometry;
		ensureLayoutWorldIndex(document);
		const target = document.walls[4]!.id;
		const representation = createWallRepresentation();
		representation.update(base);
		const mesh = representation.objectOf(target)!;
		representation.setHidden(new Set([target]));
		expect(mesh.visible).toBe(false);

		const plan = withLayoutCompileSession(session, () => planRigidWallMove(document, { wallId: target, delta: [0, 0.01] }));
		if (plan.kind !== 'success') throw new Error(plan.rejection.message);
		document = plan.document;
		const stats = representation.update(plan.acceptance!.geometry);
		// The delta path patches the attached mesh in place: copy() would otherwise show it again.
		expect(stats.built).toBeGreaterThan(0);
		expect(representation.objectOf(target)).toBe(mesh);
		expect(mesh.visible).toBe(false);
		expect(renderIdentityOf(mesh)).toEqual({ kind: 'wall', id: target });

		representation.setHidden(new Set());
		expect(mesh.visible).toBe(true);
		representation.dispose();
	}, 60_000);
});
