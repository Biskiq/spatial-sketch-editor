/**
 * P23.10 slice 4 — the **Add junction here** command and its reveal contract.
 *
 * The Plan context menu resolves a physical-Wall body hit, so the command it
 * offers must act on exactly the coordinate the hit already resolved. Pinned
 * here:
 *
 * - `subdivideWallFirstWall` is the only entry point, and one accepted split is
 *   exactly one Layout history entry with exact Undo/Redo;
 * - the split distance is canonical-start meters (the same value the hit
 *   projection carries), so the physical result does not depend on screen
 *   direction or boundary traversal direction;
 * - the authored Wall keeps its ID and stays selected (never a synthesized
 *   post-edit selection), and the new canonical rows appear without inventing
 *   Navigator data;
 * - rejected splits (through an Opening, at an endpoint, out of range) leave
 *   the document and history untouched.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	restoreLayoutPreviewSnapshot,
	subdivideWallFirstWall
} from '$lib/editor/layout/layout-preview-state.svelte';
import {
	createLayoutInteractionState,
	reconcileLayoutSelection,
	selectLayoutPhysicalWall
} from '$lib/editor/layout/layout-interaction';
import { resolvePlanHit } from '$lib/editor/layout/plan-hit';
import { buildHierarchySourceIndex } from '$lib/editor/hierarchy/hierarchy-source-index';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core';
import {
	createEmptyWallFirstLayoutDocument,
	serializeWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';
import type { LayoutDocumentWallFirst } from '$lib/layout/layout-wall-first-types';
import type { LayoutVec2 } from '$lib/layout/layout-types';

/** A closed 4×3 m Room with a door on `w1` (canonical start `j1`). */
function rectangleDocument(): LayoutDocumentWallFirst {
	const corners: Array<[string, number, number]> = [
		['j1', 0, 0],
		['j2', 4, 0],
		['j3', 4, 3],
		['j4', 0, 3]
	];
	return {
		units: 'meters',
		formatVersion: createEmptyWallFirstLayoutDocument().formatVersion,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: corners.map(([id, x, z]) => ({ id, point: [x, z] as LayoutVec2 })),
		walls: [
			['w1', 'j1', 'j2'],
			['w2', 'j2', 'j3'],
			['w3', 'j3', 'j4'],
			['w4', 'j4', 'j1']
		].map(([id, startJunctionId, endJunctionId]) => ({
			id,
			startJunctionId,
			endJunctionId,
			role: 'boundary' as const,
			thickness: 0.2,
			height: 3
		})),
		rooms: [
			{
				id: 'room-a',
				name: 'Room A',
				boundary: [
					{ wallId: 'w1', direction: 'forward' },
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w3', direction: 'forward' },
					{ wallId: 'w4', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [
			{
				id: 'door',
				wallId: 'w1',
				kind: 'door',
				offset: 1,
				width: 1,
				height: 2,
				sillHeight: 0,
				profile: 'rectangular'
			}
		],
		objects: []
	};
}

/**
 * One roomless partition Wall of the same 4 m span, authored in the requested
 * direction: `forward` runs `[0,0] → [4,0]`, `reverse` runs `[4,0] → [0,0]`.
 * The physical Wall is identical; only the canonical start Junction differs.
 */
function partitionDocument(direction: 'forward' | 'reverse'): LayoutDocumentWallFirst {
	const [start, end] =
		direction === 'forward' ? (['j-a', 'j-b'] as const) : (['j-b', 'j-a'] as const);
	return {
		units: 'meters',
		formatVersion: createEmptyWallFirstLayoutDocument().formatVersion,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'j-a', point: [0, 0] as LayoutVec2 },
			{ id: 'j-b', point: [4, 0] as LayoutVec2 }
		],
		walls: [
			{
				id: 'w1',
				startJunctionId: start,
				endJunctionId: end,
				role: 'partition' as const,
				thickness: 0.2,
				height: 3
			}
		],
		rooms: [],
		openings: [],
		objects: []
	};
}

function makeStore(seed: LayoutDocumentWallFirst = rectangleDocument()) {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const layoutPreview = createEmptyLayoutPreviewState();
	if (!importLayoutPreviewJson(layoutPreview, serializeWallFirstLayoutDocument(seed))) {
		throw new Error('wall-first import failed');
	}
	store.registerLayoutHistory({
		capture: () => captureLayoutPreviewSnapshot(layoutPreview),
		replace: (snapshot) => restoreLayoutPreviewSnapshot(layoutPreview, snapshot as never),
		matches: (a, b) =>
			JSON.stringify((a as { project: { layout: unknown } }).project.layout) ===
			JSON.stringify((b as { project: { layout: unknown } }).project.layout)
	});
	store.setLayoutFormatPolicySource(() => layoutPreview);
	return { store, layoutPreview };
}

type Preview = ReturnType<typeof createEmptyLayoutPreviewState>;

function wallFirstDocument(layoutPreview: Preview): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

/** Run one subdivision through the guarded runner (one transaction, one entry). */
function addJunction(layoutPreview: Preview, store: ReturnType<typeof createEditorStore>, distance: number) {
	return runLayoutMutation(
		layoutMutationRunnerFor(store, layoutPreview),
		() => subdivideWallFirstWall(layoutPreview, 'w1', distance),
		(result) => result.success
	);
}

const LIB_DIR = fileURLToPath(new URL('../../../../src/lib', import.meta.url));

function readLibSource(relativePath: string): string {
	return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
}

describe('P23.10 Add junction here — wiring contract', () => {
	it('lets canonical physical-Wall hits into the Plan menu with their own projection', () => {
		const viewport = readLibSource('editor/layout/LayoutPlanViewport.svelte');
		// The hit resolver's projection IS the menu offset: no second resolver.
		expect(viewport).toContain("target.kind !== 'physicalWall'");
		expect(viewport).toContain('splitDistance: target.projection.offset');
		expect(viewport).toContain('selectLayoutPhysicalWall(interaction, target.wallId)');
		// Never a stubbed action: the menu item exists only when the mount wired it.
		expect(viewport).toContain('...(onWallJunctionAdd');
	});

	it('routes the command through PlanWorkspace as one guarded Layout mutation', () => {
		const workspace = readLibSource('editor/app/PlanWorkspace.svelte');
		expect(workspace).toContain('subdivideWallFirstWall(layoutPreview, wallId, splitDistance)');
		expect(workspace).toContain('onWallJunctionAdd={addWallJunction}');
		// Selection is deliberately untouched: the retained fragment keeps the ID.
		expect(workspace).not.toContain("layoutInteraction.selection = { kind: 'none' }\n\t\tstore.setStatusMessage(result.success ? 'Added junction'");
	});
});

describe('P23.10 Add junction here — canonical subdivision through one adapter', () => {
	it('splits at canonical-start meters, keeps the authored Wall ID and commits one entry', () => {
		const { store, layoutPreview } = makeStore();
		const before = JSON.stringify(layoutPreviewDocument(layoutPreview));

		// The door occupies [1, 2]: split after it, on the retained fragment.
		const outcome = addJunction(layoutPreview, store, 2.5);
		if (outcome.kind !== 'committed') throw new Error(`expected commit: ${JSON.stringify(outcome)}`);
		expect(outcome.result).toMatchObject({ success: true, operation: 'wall-subdivision' });

		const after = wallFirstDocument(layoutPreview);
		// Retained fragment keeps the authored ID and fields; the new fragment is
		// deterministic for this baseline + allocator namespace.
		expect(after.junctions.map((junction) => junction.id)).toContain('w1-split:junction');
		expect(after.junctions.find((junction) => junction.id === 'w1-split:junction')?.point).toEqual([
			2.5,
			0
		]);
		const retained = after.walls.find((wall) => wall.id === 'w1')!;
		const fragment = after.walls.find((wall) => wall.id === 'w1-b:wall')!;
		expect(retained.startJunctionId).toBe('j1');
		expect(retained.endJunctionId).toBe('w1-split:junction');
		expect(fragment.startJunctionId).toBe('w1-split:junction');
		expect(fragment.endJunctionId).toBe('j2');
		// Room identity and metadata survive; the boundary gains exactly one ref.
		expect(after.rooms).toHaveLength(1);
		expect(after.rooms[0]).toMatchObject({ id: 'room-a', name: 'Room A' });
		expect(after.rooms[0]!.boundary.map((ref) => ref.wallId)).toEqual([
			'w1',
			'w1-b:wall',
			'w2',
			'w3',
			'w4'
		]);

		expect(store.canUndo).toBe(true);
		expect(store.undo()).toBe(true);
		expect(JSON.stringify(layoutPreviewDocument(layoutPreview))).toBe(before);
		expect(store.canUndo).toBe(false);
		expect(store.redo()).toBe(true);
		expect(JSON.stringify(layoutPreviewDocument(layoutPreview))).toBe(JSON.stringify(after));
	});

	it('measures the distance from the canonical start Junction, matching the hit projection', () => {
		// The command receives `projection.offset`, so the physical split point
		// must follow the authored start Junction — not the screen direction.
		for (const [direction, expectedX, tappedX] of [
			['forward', 1.5, 1.5],
			['reverse', 2.5, 2.5]
		] as const) {
			const { store, layoutPreview } = makeStore(partitionDocument(direction));
			// The viewport resolves the click through the compiled query geometry.
			const { geometry } = compileWallFirstLayoutGeometry(partitionDocument(direction));
			const hit = resolvePlanHit(geometry.queries, [tappedX, 0.05], 0.2);
			expect(hit).toMatchObject({ kind: 'physicalWall', wallId: 'w1' });
			if (hit?.kind !== 'physicalWall') return;
			expect(hit.projection.offset).toBeCloseTo(1.5, 6);

			const outcome = addJunction(layoutPreview, store, hit.projection.offset);
			expect(outcome.kind).toBe('committed');
			const after = wallFirstDocument(layoutPreview);
			expect(after.junctions.find((junction) => junction.id === 'w1-split:junction')?.point).toEqual([
				expectedX,
				0
			]);
		}
	});

	it('rejects through-Opening, endpoint and out-of-range splits without a history entry', () => {
		const { store, layoutPreview } = makeStore();
		const before = JSON.stringify(layoutPreviewDocument(layoutPreview));

		// The door occupies [1, 2] on `w1`: a split inside it is rejected.
		for (const distance of [1.5, 0, 4, 10, Number.NaN]) {
			const outcome = addJunction(layoutPreview, store, distance);
			expect(outcome.kind).toBe('cancelled');
		}
		expect(store.canUndo).toBe(false);
		expect(JSON.stringify(layoutPreviewDocument(layoutPreview))).toBe(before);
	});

	it('keeps the retained Wall selected without synthesizing a new selection', () => {
		const { store, layoutPreview } = makeStore();
		const interaction = createLayoutInteractionState();
		selectLayoutPhysicalWall(interaction, 'w1');

		const outcome = addJunction(layoutPreview, store, 2.5);
		expect(outcome.kind).toBe('committed');

		// The command touches selection nowhere; the retained fragment still
		// resolves, so reveal and the endpoint handles keep working.
		expect(interaction.selection).toEqual({ kind: 'physicalWall', wallId: 'w1' });
		const after = wallFirstDocument(layoutPreview);
		expect(reconcileLayoutSelection(interaction.selection, after as never)).toEqual({
			kind: 'physicalWall',
			wallId: 'w1'
		});
	});

	it('derives the retained and new hierarchy rows from the canonical document', () => {
		const { store, layoutPreview } = makeStore();
		const scene = createEmptySceneDocument();
		const beforeIndex = buildHierarchySourceIndex({ layout: wallFirstDocument(layoutPreview), scene });
		const beforeJunctions = new Set(beforeIndex.orderedJunctions.map((row) => row.junctionId));

		expect(addJunction(layoutPreview, store, 2.5).kind).toBe('committed');

		const afterIndex = buildHierarchySourceIndex({ layout: wallFirstDocument(layoutPreview), scene });
		expect(afterIndex.orderedWalls.map((row) => row.wallId)).toEqual([
			'w1',
			'w1-b:wall',
			'w2',
			'w3',
			'w4'
		]);
		const newJunctions = afterIndex.orderedJunctions
			.map((row) => row.junctionId)
			.filter((junctionId) => !beforeJunctions.has(junctionId));
		expect(newJunctions).toEqual(['w1-split:junction']);
		// The inserted endpoint is reachable from both fragments and the Room.
		expect(afterIndex.incidentWallIdsByJunctionId.get('w1-split:junction')).toEqual([
			'w1',
			'w1-b:wall'
		]);
		expect(afterIndex.roomIdsByWallId.get('w1')).toEqual(['room-a']);
		expect(afterIndex.roomIdsByWallId.get('w1-b:wall')).toEqual(['room-a']);
		// The door stays hosted by the retained fragment.
		expect(afterIndex.openingsByWallId.get('w1')).toEqual(['door']);
	});

	it('refuses the wall-first subdivision path on a legacy document', () => {
		const layoutPreview = createEmptyLayoutPreviewState();
		const result = subdivideWallFirstWall(layoutPreview, 'w1', 1.5);
		expect(result.success).toBe(false);
	});
});
