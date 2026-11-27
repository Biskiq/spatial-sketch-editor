/**
 * SL1 P1 — the cap inputs' source scope (§2.2).
 *
 * The Slice caps come from Layout meshes only, in one structure group for the Walls
 * and **one group per Layout object**. This suite pins the three defects a
 * mount-order walk produced:
 *
 * - Scene models are clipped but **never capped** (owner A-2): an imported model's
 *   open triangles must not enter a Wall union.
 * - Two Layout objects must not share a group, or one object's section can eat the
 *   other's boundary.
 * - A floor must not join the Wall group: it would weld into every Wall's bottom
 *   edge and close a boundary the builder left open on purpose.
 *
 * It also pins the ghost input: a subject wholly above the cut is hidden, one that
 * crosses the cut is not.
 */
import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh } from 'three';
import { createScenePickSource, LAYOUT_STRUCTURE_GROUP } from '$lib/authoring/scene/scene-pick-source';
import { tagRenderIdentity } from '$lib/render/render-identity';
import {
	clusterObjectsOf,
	ghostSubjectOf
} from '$lib/authoring/stage/shell/stage-selection-source';
import { subjectWhollyHidden } from '$lib/authoring/stage/slice/slice-ghost';

function box(
	position: readonly [number, number, number],
	size: readonly [number, number, number] = [1, 1, 1]
): Mesh {
	const mesh = new Mesh(new BoxGeometry(size[0], size[1], size[2]));
	mesh.position.set(position[0], position[1], position[2]);
	mesh.updateMatrixWorld(true);
	return mesh;
}

function layoutOf(): { root: Group; wall: Mesh; floor: Mesh; objectA: Mesh; objectB: Mesh; ceiling: Mesh } {
	const root = new Group();
	const wall = tagRenderIdentity(box([0, 1.5, 0], [4, 3, 0.2]), 'wall', 'w1');
	const floor = tagRenderIdentity(box([2, 0, 2], [6, 0.05, 6]), 'floor', 'r1');
	const objectA = tagRenderIdentity(box([2, 0.3, 2], [1, 0.6, 1]), 'object', 'o1');
	const objectB = tagRenderIdentity(box([4, 0.3, 2], [1, 0.6, 1]), 'object', 'o2');
	// The derived ceiling and the floor's shadow catcher carry no identity: they are
	// not Layout cap candidates and must not be guessed at.
	const ceiling = box([2, 3, 2], [6, 0.05, 6]);
	root.add(wall, floor, objectA, objectB, ceiling);
	return { root, wall, floor, objectA, objectB, ceiling };
}

describe('Slice cap sources: Layout identity decides the scope', () => {
	it('caps the Walls and each Layout object, and nothing else', () => {
		const { root } = layoutOf();
		const pick = createScenePickSource();
		pick.registerLayout(root);

		const sources = pick.sectionSources();

		expect(sources.map((source) => source.identity)).toEqual([
			'wall:w1',
			'object:o1',
			'object:o2'
		]);
		// One structure union for the Walls; a group per object, so unrelated plinths
		// can never be unioned into one solid.
		expect(sources.map((source) => source.group)).toEqual([
			LAYOUT_STRUCTURE_GROUP,
			'layout-object:o1',
			'layout-object:o2'
		]);
	});

	it('never caps a floor, a derived ceiling or a Scene model', () => {
		const { root, floor } = layoutOf();
		const pick = createScenePickSource();
		pick.registerLayout(root);
		const sceneRoot = new Group();
		sceneRoot.add(box([9, 1, 9], [1, 1, 1]));
		pick.register('model-entity', sceneRoot);

		const sources = pick.sectionSources();

		expect(sources.some((source) => source.identity.includes(floor.uuid))).toBe(false);
		expect(sources.every((source) => !source.identity.includes('model-entity'))).toBe(true);
		// The floor's identity is not a cap source at all, in any group.
		expect(sources.some((source) => source.identity.startsWith('floor:'))).toBe(false);
		// Nothing untagged entered a union either.
		expect(sources.length).toBe(3);
	});

	it('caps a Wall but never its failure surface', () => {
		const root = new Group();
		const wall = tagRenderIdentity(box([0, 1.5, 0], [4, 3, 0.2]), 'wall', 'w1');
		const failure = tagRenderIdentity(box([8, 1.5, 0], [4, 3, 0.2]), 'wall-failure', 'w2');
		root.add(wall, failure);
		const pick = createScenePickSource();
		pick.registerLayout(root);

		const sources = pick.sectionSources();

		// A failure surface is the builder's fallback body for a Wall it could not
		// close. Capping it would draw a solid paper section over a defect and read as
		// a resolved Wall, so it keeps its edges and contributes no cap source.
		expect(sources.map((source) => source.identity)).toEqual(['wall:w1']);
		expect(sources.map((source) => source.group)).toEqual([LAYOUT_STRUCTURE_GROUP]);
	});
});

describe('group marks resolve every member body', () => {
	it('returns the mounted member roots in the group\'s own order', () => {
		const pick = createScenePickSource();
		const first = new Group();
		const second = new Group();
		pick.register('a', first);
		pick.register('b', second);
		// A retired member has no body to ink; the group still marks the rest.
		expect(clusterObjectsOf(pick, ['b', 'missing', 'a'])).toEqual([second, first]);
	});

	it('hands the group\'s union of bodies to the ghost rule', () => {
		const pick = createScenePickSource();
		const above = new Group();
		above.add(box([0, 2, 0], [1, 1, 1]));
		pick.register('a', above);
		const subject = ghostSubjectOf(clusterObjectsOf(pick, ['a']));
		expect(subject).not.toBeNull();
		expect(subjectWhollyHidden({ kind: 'level', cutY: 1.2, lowerY: null }, subject!)).toBe(true);
	});
});

describe('Slice ghost input: wholly hidden, not merely touched', () => {
	const cut = { kind: 'level' as const, cutY: 1.2, lowerY: null };

	it('classifies a subject wholly above the cut as hidden', () => {
		const above = box([0, 2, 0], [1, 1, 1]);
		const subject = ghostSubjectOf([above]);
		expect(subject).not.toBeNull();
		expect(subjectWhollyHidden(cut, subject!)).toBe(true);
	});

	it('does not ghost a subject that crosses the cut', () => {
		const crossing = box([0, 1.2, 0], [1, 2.4, 1]);
		const subject = ghostSubjectOf([crossing]);
		expect(subjectWhollyHidden(cut, subject!)).toBe(false);
	});

	it('reports nothing for a subject with no drawn mesh', () => {
		expect(ghostSubjectOf([])).toBeNull();
		expect(ghostSubjectOf([new Group()])).toBeNull();
	});
});
