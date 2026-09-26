/** Client-runtime proof that S-R raw field signals still wake each display consumer. */
import { describe, expect, it } from 'vitest';
import { effect_root, flush, render_effect } from 'svelte/internal/client';

import { createEmptySceneDocument } from '$lib/content/scene';
import { createEditorStore } from '$lib/editor/editor-store.svelte';
import { buildP23BMatrixFixture, P23B_MATRIX_SPECS } from '$lib/bench/p23b-fixtures';
import { createEmptyLayoutDocument } from '$lib/layout/layout-codec';
import { buildPlanRenderModel } from '$lib/layout/plan-render-model';
import { serializeWallFirstLayoutDocument } from '$lib/layout/layout-wall-first-codec';
import { createLayoutRoomRegistry } from '$lib/project/project-layout-semantics';
import type { LayoutPreviewState } from '$lib/editor/layout/layout-preview-state.svelte';
import {
	createClientReactiveLayoutPreviewState,
	loadClientCompiledPreviewModule
} from './p23b7-reactive-preview-state';

const SMALL_FIXTURE = 'p23b-12-wall-target-curved-v1';
const LARGE_FIXTURE = 'p23b-40-wall-straight-v1';
const EDIT_WALL = 'room-0:wall-0';

type Surface = 'plan' | '3d' | 'inspector';
type SurfaceReads = Record<Surface, string[]>;

function fixtureJson(id: typeof SMALL_FIXTURE | typeof LARGE_FIXTURE): string {
	const spec = P23B_MATRIX_SPECS.find((entry) => entry.id === id);
	if (!spec) throw new Error(`unknown fixture ${id}`);
	return serializeWallFirstLayoutDocument(buildP23BMatrixFixture(spec));
}

function planRead(state: LayoutPreviewState): string {
	const rendered = buildPlanRenderModel(state.geometry);
	return JSON.stringify({
		layers: rendered.layers,
		rooms: state.model.rooms.map((room) => [room.roomId, room.floorPolygon]),
		objects: state.model.objects.map((object) => [object.objectId, object.planFootprint])
	});
}

/** Mirrors the generation/model/map props read by LayoutPreviewScene's effects. */
function sceneRead(state: LayoutPreviewState): string {
	const target = state.geometry.walls.find((wall) => wall.wallId === EDIT_WALL);
	const targetMesh = state.wallMeshesByWall.get(EDIT_WALL);
	return JSON.stringify({
		modelRooms: state.model.rooms.map((room) => room.roomId),
		modelObjects: state.model.objects.map((object) => object.objectId),
		roomShapes: state.geometry.rooms.map((room) => [room.roomId, room.floorPolygon, room.ceilingPolygon]),
		wallCount: state.geometry.walls.length,
		roomMeshIds: [...state.wallMeshesByRoom.keys()],
		wallMeshIds: [...state.wallMeshesByWall.keys()],
		targetWall: target,
		targetMesh: targetMesh
			? [targetMesh.positions.length, targetMesh.indices.length, Array.from(targetMesh.positions.slice(0, 12))]
			: null
	});
}

/** Mirrors the selected Wall and compiled Room data read by EditorInspector. */
function inspectorRead(state: LayoutPreviewState): string {
	const wall = state.geometry.walls.find((candidate) => candidate.wallId === EDIT_WALL);
	const room = state.model.rooms.find((candidate) => candidate.roomId === 'room-0');
	return JSON.stringify({
		wall,
		room: room ? [room.roomId, room.floorPolygon] : null,
		issues: state.issues.map((issue) => [issue.code, issue.targetId ?? null])
	});
}

function watchConsumers(state: LayoutPreviewState): { reads: SurfaceReads; stop: () => void } {
	const reads: SurfaceReads = { plan: [], '3d': [], inspector: [] };
	const stop = effect_root(() => {
		render_effect(() => {
			reads.plan.push(planRead(state));
		});
		render_effect(() => {
			reads['3d'].push(sceneRead(state));
		});
		render_effect(() => {
			reads.inspector.push(inspectorRead(state));
		});
	});
	flush();
	return { reads, stop };
}

function signature(reads: SurfaceReads): Record<Surface, string> {
	return {
		plan: reads.plan.at(-1) ?? '',
		'3d': reads['3d'].at(-1) ?? '',
		inspector: reads.inspector.at(-1) ?? ''
	};
}

function applyAndFlush(reads: SurfaceReads, label: string, action: () => void): void {
	const before = {
		plan: reads.plan.length,
		'3d': reads['3d'].length,
		inspector: reads.inspector.length
	};
	action();
	flush();
	for (const surface of ['plan', '3d', 'inspector'] as const) {
		expect(reads[surface].length, `${label} invalidates ${surface}`).toBeGreaterThan(before[surface]);
	}
}

describe('P23B.6 S-R — client-compiled consumer reactivity', () => {
	it('updates Plan, 3D, and Inspector reads on install, restore, history, import, and reset', async () => {
		const runtime = await loadClientCompiledPreviewModule();
		const preview = await createClientReactiveLayoutPreviewState();
		const store = createEditorStore({
			document: createEmptySceneDocument(),
			rooms: createLayoutRoomRegistry(createEmptyLayoutDocument())
		});
		store.registerLayoutHistory({
			capture: () => runtime.captureLayoutPreviewSnapshot(preview),
			replace: (snapshot) => runtime.restoreLayoutPreviewSnapshot(preview, snapshot as never),
			matches: (left, right) =>
				JSON.stringify((left as { project: { layout: unknown } }).project.layout) ===
				JSON.stringify((right as { project: { layout: unknown } }).project.layout)
		});
		store.setLayoutFormatPolicySource(() => preview);

		const { reads, stop } = watchConsumers(preview);
		try {
			const empty = signature(reads);
			applyAndFlush(reads, 'fixture import', () => {
				expect(runtime.importLayoutPreviewJson(preview, fixtureJson(SMALL_FIXTURE))).toBe(true);
			});
			const imported = signature(reads);
			expect(imported).not.toEqual(empty);
			const importedSnapshot = runtime.captureLayoutPreviewSnapshot(preview);

			applyAndFlush(reads, 'accepted edit install', () => {
				const result = runtime.updateWallFirstWallMove(preview, EDIT_WALL, [0, 1]);
				expect(result.success, result.success ? '' : result.message).toBe(true);
			});
			const installed = signature(reads);
			expect(installed).not.toEqual(imported);

			applyAndFlush(reads, 'explicit snapshot restore', () =>
				runtime.restoreLayoutPreviewSnapshot(preview, importedSnapshot)
			);
			expect(signature(reads)).toEqual(imported);

			expect(store.beginLayoutTransaction()).toBe(true);
			applyAndFlush(reads, 'committed edit install', () => {
				const result = runtime.updateWallFirstWallMove(preview, EDIT_WALL, [0, 1]);
				expect(result.success, result.success ? '' : result.message).toBe(true);
				const snapshot = runtime.captureLayoutPreviewSnapshot(preview);
				expect(store.commitLayoutTransaction(snapshot)).toBe(true);
			});
			const committed = signature(reads);
			expect(committed).not.toEqual(imported);

			applyAndFlush(reads, 'Undo restore', () => expect(store.undo()).toBe(true));
			expect(signature(reads)).toEqual(imported);
			applyAndFlush(reads, 'Redo restore', () => expect(store.redo()).toBe(true));
			expect(signature(reads)).toEqual(committed);

			applyAndFlush(reads, 'replacement import', () =>
				expect(runtime.importLayoutPreviewJson(preview, fixtureJson(LARGE_FIXTURE))).toBe(true)
			);
			const replacement = signature(reads);
			expect(preview.geometry.walls).toHaveLength(40);
			expect(replacement).not.toEqual(committed);

			applyAndFlush(reads, 'replacement edit install', () => {
				const result = runtime.updateWallFirstWallMove(preview, EDIT_WALL, [0, 1]);
				expect(result.success, result.success ? '' : result.message).toBe(true);
			});
			expect(signature(reads)).not.toEqual(replacement);

			applyAndFlush(reads, 'reset', () => expect(runtime.resetLayoutPreview(preview)).toBe(true));
			expect(preview.geometry.walls).toHaveLength(0);
			expect(signature(reads)).toEqual(empty);
		} finally {
			stop();
		}
	});

	it('negative control: a nonreactive holder changes data but does not wake the consumers', async () => {
		const runtime = await loadClientCompiledPreviewModule();
		const source = runtime.createEmptyWallFirstLayoutPreviewState();
		const holder = { ...source } as LayoutPreviewState;
		const { reads, stop } = watchConsumers(holder);
		try {
			const initial = signature(reads);
			expect(runtime.importLayoutPreviewJson(holder, fixtureJson(SMALL_FIXTURE))).toBe(true);
			flush();
			expect(reads.plan).toHaveLength(1);
			expect(reads['3d']).toHaveLength(1);
			expect(reads.inspector).toHaveLength(1);
			expect(planRead(holder)).not.toBe(initial.plan);
			expect(sceneRead(holder)).not.toBe(initial['3d']);
			expect(inspectorRead(holder)).not.toBe(initial.inspector);
		} finally {
			stop();
		}
	});
});
