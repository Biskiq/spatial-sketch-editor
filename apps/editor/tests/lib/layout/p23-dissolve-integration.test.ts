/**
 * P23 Junction dissolve — editor history integration.
 *
 * `dissolveWallFirstJunction` through the guarded history runner:
 *
 * - one dissolve = exactly one history entry; Undo restores the exact
 *   pre-dissolve document (JSON-deep-equal: Wall/Junction/Opening/Room IDs
 *   and authored offsets), Redo re-applies;
 * - planner rejections write zero history entries and leave the document;
 * - the adapter refuses non-wall-first preview state.
 *
 * Caller selection policy (`none` after dissolve) lives in PlanWorkspace and
 * is pinned by source contract; keyboard dispatch is covered by the
 * `junction` + `layout`-mode branch in LayoutPlanViewport.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { createEmptySceneDocument } from '$lib/content/scene';
import {
	serializeWallFirstLayoutDocument,
	validateWallFirstLayoutDocument
} from '$lib/layout/layout-wall-first-codec';
import type {
	LayoutDocumentWallFirst,
	LayoutVec2
} from '$lib/layout/layout-wall-first-types';
import {
	captureLayoutPreviewSnapshot,
	createEmptyLayoutPreviewState,
	dissolveWallFirstJunction,
	importLayoutPreviewJson,
	layoutPreviewDocument,
	restoreLayoutPreviewSnapshot
} from '$lib/editor/layout/layout-preview-state.svelte';
import { layoutMutationRunnerFor, runLayoutMutation } from '$lib/editor/layout/layout-mutation-runner';
import {
	createLayoutInteractionState,
	selectLayoutJunction,
	setPlanViewMode
} from '$lib/editor/layout/layout-interaction';

/** 4×3 Room with a pre-split south edge (M) and a door on the survivor side. */
function seed(): LayoutDocumentWallFirst {
	return {
		units: 'meters',
		formatVersion: 5,
		floor: { id: 'floor-1', name: 'Floor 1', elevation: 0 },
		junctions: [
			{ id: 'A', point: [0, 0] as LayoutVec2 },
			{ id: 'M', point: [2, 0] as LayoutVec2 },
			{ id: 'B', point: [4, 0] as LayoutVec2 },
			{ id: 'C', point: [4, 3] as LayoutVec2 },
			{ id: 'D', point: [0, 3] as LayoutVec2 }
		],
		walls: [
			{ id: 'w1a', startJunctionId: 'A', endJunctionId: 'M', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'w1b', startJunctionId: 'M', endJunctionId: 'B', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'w2', startJunctionId: 'B', endJunctionId: 'C', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'w3', startJunctionId: 'C', endJunctionId: 'D', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'w4', startJunctionId: 'D', endJunctionId: 'A', role: 'boundary', thickness: 0.2, height: 3, centerline: { kind: 'line' } }
		],
		rooms: [
			{
				id: 'room',
				name: 'Room',
				boundary: [
					{ wallId: 'w1a', direction: 'forward' },
					{ wallId: 'w1b', direction: 'forward' },
					{ wallId: 'w2', direction: 'forward' },
					{ wallId: 'w3', direction: 'forward' },
					{ wallId: 'w4', direction: 'forward' }
				],
				floorThickness: 0.1,
				ceilingThickness: 0.1
			}
		],
		openings: [
			{ id: 'door', wallId: 'w1a', kind: 'door', offset: 0.5, width: 0.9, height: 2, sillHeight: 0, profile: 'rectangular' }
		],
		objects: [] as LayoutDocumentWallFirst['objects']
	};
}

function wallFirstDocument(
	layoutPreview: ReturnType<typeof createEmptyLayoutPreviewState>
): LayoutDocumentWallFirst {
	const document = layoutPreviewDocument(layoutPreview);
	if (!('formatVersion' in document)) throw new Error('expected wall-first document');
	return document;
}

function makeStore(document: LayoutDocumentWallFirst = seed()) {
	const store = createEditorStore({
		document: createEmptySceneDocument(),
		rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
	});
	const layoutPreview = createEmptyLayoutPreviewState();
	if (!importLayoutPreviewJson(layoutPreview, serializeWallFirstLayoutDocument(document))) {
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

describe('dissolveWallFirstJunction — editor history integration', () => {
	it('validates the fixture document before any operation', () => {
		expect(validateWallFirstLayoutDocument(seed()).success).toBe(true);
	});

	it('commits exactly one history entry and Undo restores the exact document', () => {
		const { store, layoutPreview } = makeStore();
		const before = JSON.stringify(wallFirstDocument(layoutPreview));
		expect(store.canUndo).toBe(false);

		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => dissolveWallFirstJunction(layoutPreview, 'M'),
			(result) => result.success
		);
		if (outcome.kind !== 'committed') throw new Error(`expected commit: ${JSON.stringify(outcome)}`);
		expect(store.canUndo).toBe(true);

		const after = wallFirstDocument(layoutPreview);
		expect(after.walls.map((wall) => wall.id)).toEqual(['w1a', 'w2', 'w3', 'w4']);
		expect(after.junctions.map((junction) => junction.id)).toEqual(['A', 'B', 'C', 'D']);
		expect(after.rooms.map((room) => room.id)).toEqual(['room']);
		expect(after.openings).toHaveLength(1);
		expect(after.openings[0]).toMatchObject({ id: 'door', wallId: 'w1a', offset: 0.5 });

		// A second dissolve of the retired junction is a rejection, not a
		// second entry: still exactly one undo step.
		const repeated = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => dissolveWallFirstJunction(layoutPreview, 'M'),
			(result) => result.success
		);
		expect(repeated.kind).toBe('cancelled');

		expect(store.undo()).toBe(true);
		expect(JSON.stringify(wallFirstDocument(layoutPreview))).toBe(before);
		expect(store.canUndo).toBe(false);

		expect(store.redo()).toBe(true);
		expect(wallFirstDocument(layoutPreview).walls.map((wall) => wall.id)).toEqual([
			'w1a',
			'w2',
			'w3',
			'w4'
		]);
	});

	it('writes zero history entries when the planner rejects', () => {
		const { store, layoutPreview } = makeStore();
		const before = JSON.stringify(wallFirstDocument(layoutPreview));
		// Corner B is an angled pair: the planner rejects, history stays empty.
		const outcome = runLayoutMutation(
			layoutMutationRunnerFor(store, layoutPreview),
			() => dissolveWallFirstJunction(layoutPreview, 'B'),
			(result) => result.success
		);
		expect(outcome.kind).toBe('cancelled');
		expect(store.canUndo).toBe(false);
		expect(JSON.stringify(wallFirstDocument(layoutPreview))).toBe(before);
	});

	it('refuses the dissolve path on a legacy document', () => {
		const store = createEditorStore({
			document: createEmptySceneDocument(),
			rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
		});
		const layoutPreview = createEmptyLayoutPreviewState();
		const result = dissolveWallFirstJunction(layoutPreview, 'M');
		expect(result.success).toBe(false);
		expect(store.canUndo).toBe(false);
	});

	it('surfaces the planner rejection message per code', () => {
		const { layoutPreview } = makeStore();
		const angled = dissolveWallFirstJunction(layoutPreview, 'B');
		expect(angled.success).toBe(false);
		if (angled.success) throw new Error('unreachable');
		expect(angled.message).toContain('angle');
		const unknown = dissolveWallFirstJunction(layoutPreview, 'missing');
		expect(unknown.success).toBe(false);
		if (unknown.success) throw new Error('unreachable');
		expect(unknown.message).toContain('missing');
	});
});

describe('dissolve caller wiring — source contract', () => {
	const LIB_DIR = fileURLToPath(new URL('../../../src/lib', import.meta.url));

	function readSource(relativePath: string): string {
		return fs.readFileSync(path.join(LIB_DIR, relativePath), 'utf8');
	}

	it('the Delete/Backspace junction branch dispatches the dissolve adapter under the Layout-authority gate', () => {
		const source = readSource('editor/layout/LayoutPlanViewport.svelte');
		const branchStart = source.indexOf(
			"interaction.selection.kind === 'junction'",
			source.indexOf('function onKeyDown')
		);
		expect(branchStart).toBeGreaterThan(-1);
		const branch = source.slice(branchStart, branchStart + 1200);
		expect(branch).toContain("interaction.planViewMode === 'layout'");
		expect(branch).toContain('onJunctionDissolve?.(interaction.selection.junctionId)');
	});

	it('a remembered junction selection survives the switch to Arrange and Delete cannot reach it from there', () => {
		// Premise (real behavior): `setPlanViewMode` keeps the committed
		// Layout selection as memory when switching to Arrange.
		const layoutInteraction = createLayoutInteractionState();
		selectLayoutJunction(layoutInteraction, 'M');
		setPlanViewMode(layoutInteraction, 'staging');
		expect(layoutInteraction.selection).toEqual({ kind: 'junction', junctionId: 'M' });
		// Authority: the viewport junction Delete branch requires Layout
		// mode, so the remembered selection is inert in Arrange.
		const source = readSource('editor/layout/LayoutPlanViewport.svelte');
		const dispatch = source.indexOf('onJunctionDissolve?.(interaction.selection.junctionId)');
		expect(dispatch).toBeGreaterThan(-1);
		const branchStart = source.lastIndexOf("interaction.selection.kind === 'junction'", dispatch);
		expect(branchStart).toBeGreaterThan(-1);
		const guard = source.slice(branchStart, dispatch);
		expect(guard).toContain("interaction.planViewMode === 'layout'");
	});

	it('PlanWorkspace wires the dissolve handler with the fixed none-selection policy', () => {
		const source = readSource('editor/app/PlanWorkspace.svelte');
		expect(source).toContain('dissolveWallFirstJunction(layoutPreview, junctionId)');
		expect(source).toContain('onJunctionDissolve={dissolveJunction}');
		expect(source).toContain("layoutInteraction.selection = { kind: 'none' }");
	});
});
