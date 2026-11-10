// @vitest-environment jsdom
/**
 * Repeat-Unroll lifecycle regression.
 *
 * The developed display is cached by Wall, cut, Opening preview and canonical
 * layout revision. A Put back clears it; the next Unroll must build from the
 * Wall as it is then, not from the shape captured at the previous entry. These
 * assertions drive one mounted StageWallDevelopment instance through the real
 * Unroll store, so they fail if a revision change leaves a stale sheet behind.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@threlte/core', async () => ({
	T: (await import('./fixtures/StageRootProbe.svelte')).default,
	useThrelte: () => ({ invalidate: () => {} })
}));

import { mount, tick, unmount } from 'svelte';
import type { Object3D } from 'three';
import type { Mesh } from 'three';

import {
	compileWallFirstLayoutGeometry,
	createEmptyWallFirstLayoutDocument,
	LAYOUT_WALL_FIRST_FORMAT_VERSION,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutWall
} from '@portfolio/layout-core';

import StageWallDevelopment from '$lib/authoring/stage/shell/StageWallDevelopment.svelte';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import { reactiveCell } from './__fixtures__/reactive-cell.svelte';

function wallDocument(height: number): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.formatVersion = LAYOUT_WALL_FIRST_FORMAT_VERSION;
	document.junctions = [
		{ id: 'j-a', point: [0, 0] },
		{ id: 'j-b', point: [6, 0] }
	];
	document.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'j-a',
			endJunctionId: 'j-b',
			thickness: 0.2,
			height,
			centerline: { kind: 'line' }
		} as LayoutWall
	];
	return document;
}

function compiled(height: number): CompiledLayoutGeometry {
	return compileWallFirstLayoutGeometry(wallDocument(height)).geometry;
}

function stageRoot(): Object3D {
	const root = (globalThis as { __stageDevelopmentRoot?: Object3D }).__stageDevelopmentRoot;
	if (root === undefined) throw new Error('StageWallDevelopment did not expose its root');
	return root;
}

function developedTop(root: Object3D): number {
	const sheet = root.getObjectByName('StageWallDevelopmentSheet') as Mesh | undefined;
	if (sheet === undefined) throw new Error('StageWallDevelopment did not build its sheet');
	const position = sheet.geometry.getAttribute('position');
	let top = -Infinity;
	for (let index = 1; index < position.array.length; index += 3) {
		top = Math.max(top, position.array[index] as number);
	}
	return top;
}

let cleanup: (() => void) | null = null;

beforeEach(() => {
	wallUnfold.exit();
	(globalThis as { __stageDevelopmentRoot?: Object3D }).__stageDevelopmentRoot = undefined;
});

afterEach(() => {
	wallUnfold.exit();
	cleanup?.();
	cleanup = null;
	document.body.replaceChildren();
	(globalThis as { __stageDevelopmentRoot?: Object3D }).__stageDevelopmentRoot = undefined;
});

describe('mounted Unroll display lifecycle', () => {
	it('rebuilds after Put back and an accepted Wall edit without remounting', async () => {
		const geometry = reactiveCell(compiled(3));
		const layoutRevision = reactiveCell('revision-1');
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(StageWallDevelopment, {
			target,
			props: {
				get geometry() {
					return geometry.value;
				},
				datumMeters: 0,
				get layoutRevision() {
					return layoutRevision.value;
				}
			}
		});
		cleanup = () => void unmount(component);
		await tick();

		const root = stageRoot();
		expect(root.visible).toBe(false);
		const firstWall = geometry.value.walls.find((wall) => wall.wallId === 'wall-a')!;
		wallUnfold.enter(firstWall, 0);
		await tick();
		expect(root.visible).toBe(true);
		expect(developedTop(root)).toBeCloseTo(3, 6);

		// Put back clears the cache; the revision then changes under the same
		// mounted component. Re-entry must build the new Wall, not replay the old.
		wallUnfold.exit();
		await tick();
		expect(root.visible).toBe(false);
		geometry.value = compiled(3.5);
		layoutRevision.value = 'revision-2';
		await tick();
		expect(root.visible).toBe(false);
		const editedWall = geometry.value.walls.find((wall) => wall.wallId === 'wall-a')!;
		wallUnfold.enter(editedWall, 0);
		await tick();
		expect(root.visible).toBe(true);
		expect(developedTop(root)).toBeCloseTo(3.5, 6);

		// P1: an accepted edit during the active session also invalidates the
		// display, so the open sheet follows the canonical revision immediately.
		geometry.value = compiled(4);
		layoutRevision.value = 'revision-3';
		await tick();
		expect(root.visible).toBe(true);
		expect(developedTop(root)).toBeCloseTo(4, 6);
	});
});
