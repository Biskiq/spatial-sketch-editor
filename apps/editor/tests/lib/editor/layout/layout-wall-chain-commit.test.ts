import { describe, expect, it } from 'vitest';
import {
	createEmptyLayoutPreviewState,
	commitWallChain,
	commitWallSegment,
	layoutPreviewDocument,
	layoutPreviewIsDirty
} from '$lib/editor/layout/layout-preview-state.svelte';
import {
	createEmptyWallFirstLayoutDocument,
	serializeWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';
import { importLayoutPreviewJson } from '$lib/editor/layout/layout-preview-state.svelte';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';

function wallFirstPreviewState(): ReturnType<typeof createEmptyLayoutPreviewState> {
	const state = createEmptyLayoutPreviewState();
	const document = createEmptyWallFirstLayoutDocument();
	document.floor = { id: 'floor-1', name: 'Floor 1', elevation: 0 };
	const imported = importLayoutPreviewJson(state, serializeWallFirstLayoutDocument(document));
	if (!imported) throw new Error('wall-first import failed');
	return state;
}

function wallFirstDocument(state: ReturnType<typeof createEmptyLayoutPreviewState>): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(state);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

describe('P23.9 commitWallChain editor path', () => {
	it('commits a closed boundary chain and births a Room through the preview state', () => {
		const state = wallFirstPreviewState();
		const result = commitWallChain(
			state,
			[[0, 0], [4, 0], [4, 3], [0, 3]],
			'boundary',
			{ close: true }
		);
		expect(result.success).toBe(true);
		if (!result.success || result.operation !== 'wall-chain-commit') return;
		expect(result.wallIds).toHaveLength(4);
		expect(result.roomIds).toHaveLength(1);

		const document = wallFirstDocument(state);
		expect(document.rooms).toHaveLength(1);
		expect(document.walls).toHaveLength(4);
		expect(layoutPreviewIsDirty(state)).toBe(true);
	});

	it('a rejected chain leaves the document unchanged', () => {
		const state = wallFirstPreviewState();
		const before = serializeWallFirstLayoutDocument(wallFirstDocument(state));
		// Collinear overlapping legs must reject atomically.
		const result = commitWallChain(state, [[0, 0], [4, 0], [2, 0]], 'boundary', { close: false });
		expect(result.success).toBe(false);
		expect(serializeWallFirstLayoutDocument(wallFirstDocument(state))).toBe(before);
		expect(layoutPreviewIsDirty(state)).toBe(false);
	});

	it('a partition chain never touches Rooms', () => {
		const state = wallFirstPreviewState();
		const enclosure = commitWallChain(state, [[0, 0], [4, 0], [4, 3], [0, 3]], 'boundary', { close: true });
		expect(enclosure.success).toBe(true);

		const partition = commitWallChain(state, [[1, 1], [2, 1]], 'partition', { close: false });
		expect(partition.success).toBe(true);
		if (!partition.success || partition.operation !== 'wall-chain-commit') return;
		expect(partition.roomIds).toHaveLength(0);
		const document = wallFirstDocument(state);
		expect(document.rooms).toHaveLength(1);
		expect(document.walls.some((wall) => wall.role === 'partition')).toBe(true);
	});

	it('an open boundary chain commits without creating a Room', () => {
		const state = wallFirstPreviewState();
		const result = commitWallChain(state, [[0, 0], [4, 0]], 'boundary', { close: false });
		expect(result.success).toBe(true);
		if (!result.success || result.operation !== 'wall-chain-commit') return;
		expect(result.roomIds).toHaveLength(0);
		expect(wallFirstDocument(state).rooms).toHaveLength(0);
	});

	it('rejects when the preview is not wall-first', () => {
		const state = createEmptyLayoutPreviewState(); // legacy empty layout
		const result = commitWallChain(state, [[0, 0], [4, 0]], 'boundary', { close: false });
		expect(result.success).toBe(false);
	});
});

describe('P23.9 commitWallSegment editor path (segment-first)', () => {
	function junctionPoint(document: LayoutDocumentWallFirst, junctionId: string): [number, number] {
		const junction = document.junctions.find((candidate) => candidate.id === junctionId);
		if (!junction) throw new Error(`missing junction ${junctionId}`);
		return [...junction.point] as [number, number];
	}

	it('click A, click B commits one Wall; click C commits a second; Undo reverts only BC', () => {
		const state = wallFirstPreviewState();
		const ab = commitWallSegment(state, [0, 0], [4, 0], 'boundary');
		expect(ab.success).toBe(true);
		if (!ab.success || ab.operation !== 'wall-segment-commit') return;
		expect(ab.wallIds).toHaveLength(1);
		expect(ab.roomIds).toHaveLength(0);
		expect(wallFirstDocument(state).walls).toHaveLength(1);

		const bPoint = junctionPoint(wallFirstDocument(state), ab.endJunctionId);
		const bc = commitWallSegment(state, bPoint, [4, 3], 'boundary');
		expect(bc.success).toBe(true);
		if (!bc.success || bc.operation !== 'wall-segment-commit') return;
		expect(wallFirstDocument(state).walls).toHaveLength(2);
		// Continuation uses the canonical end, not createdWallIds.
		expect(bc.startJunctionId).toBe(ab.endJunctionId);
	});

	it('room closure: DA onto the run-start Junction commits DA plus Room effects atomically', () => {
		const state = wallFirstPreviewState();
		const ab = commitWallSegment(state, [0, 0], [4, 0], 'boundary');
		if (!ab.success || ab.operation !== 'wall-segment-commit') throw new Error('ab failed');
		const bc = commitWallSegment(state, junctionPoint(wallFirstDocument(state), ab.endJunctionId), [4, 3], 'boundary');
		if (!bc.success || bc.operation !== 'wall-segment-commit') throw new Error('bc failed');
		const cd = commitWallSegment(state, junctionPoint(wallFirstDocument(state), bc.endJunctionId), [0, 3], 'boundary');
		if (!cd.success || cd.operation !== 'wall-segment-commit') throw new Error('cd failed');
		expect(wallFirstDocument(state).rooms).toHaveLength(0);
		const runStart = ab.startJunctionId;
		const da = commitWallSegment(
			state,
			junctionPoint(wallFirstDocument(state), cd.endJunctionId),
			junctionPoint(wallFirstDocument(state), runStart),
			'boundary'
		);
		expect(da.success).toBe(true);
		if (!da.success || da.operation !== 'wall-segment-commit') return;
		expect(da.endJunctionId).toBe(runStart);
		expect(wallFirstDocument(state).rooms).toHaveLength(1);
		expect(wallFirstDocument(state).walls).toHaveLength(4);
	});

	it('rejection commits nothing and preserves prior Walls for retry', () => {
		const state = wallFirstPreviewState();
		const ab = commitWallSegment(state, [0, 0], [4, 0], 'boundary');
		expect(ab.success).toBe(true);
		const before = serializeWallFirstLayoutDocument(wallFirstDocument(state));
		// Overlap along the existing wall rejects.
		const rejected = commitWallSegment(state, [0, 0], [4, 0], 'boundary');
		expect(rejected.success).toBe(false);
		expect(serializeWallFirstLayoutDocument(wallFirstDocument(state))).toBe(before);
	});

	it('partition segments commit individually without splitting Rooms', () => {
		const state = wallFirstPreviewState();
		const enclosure = commitWallChain(state, [[0, 0], [4, 0], [4, 3], [0, 3]], 'boundary', { close: true });
		expect(enclosure.success).toBe(true);
		const first = commitWallSegment(state, [1, 1], [2, 1], 'partition');
		expect(first.success).toBe(true);
		if (!first.success || first.operation !== 'wall-segment-commit') return;
		expect(first.roomIds).toHaveLength(0);
		expect(wallFirstDocument(state).rooms).toHaveLength(1);
	});

	it('typed exact length commits exactly one segment from the canonical start', () => {
		const state = wallFirstPreviewState();
		const result = commitWallSegment(state, [1, 1], [1 + 2.75, 1], 'boundary');
		expect(result.success).toBe(true);
		if (!result.success || result.operation !== 'wall-segment-commit') return;
		expect(result.wallIds).toHaveLength(1);
		const document = wallFirstDocument(state);
		const wall = document.walls.find((candidate) => candidate.id === result.wallIds[0])!;
		const [ax, az] = junctionPoint(document, wall.startJunctionId);
		const [bx, bz] = junctionPoint(document, wall.endJunctionId);
		expect(Math.hypot(bx - ax, bz - az)).toBeCloseTo(2.75, 12);
	});
});