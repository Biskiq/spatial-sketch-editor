import { expect, it } from 'vitest';
import {
	type CompiledLayoutGeometry,
	type CompiledOpening,
	type LayoutVec2
} from '@portfolio/layout-core';
import { prepareUnitRuntime } from '@portfolio/project-model/units';
import { aimThroughWindows } from '$lib/authoring/look/aim-through-windows';
import { DEFAULT_STARTER_TEMPLATE } from '$lib/authoring/stage/starter-gallery';

const room: LayoutVec2[] = [[0, 0], [8, 0], [8, 4], [0, 4]];

function windowAt(point: LayoutVec2, normal: LayoutVec2, width = 1, height = 1) {
	return { kind: 'window', center: { point, normal }, width, height };
}

function geometry(...openings: ReturnType<typeof windowAt>[]): CompiledLayoutGeometry {
	return {
		rooms: [{ floorPolygon: room }],
		walls: [{ thickness: 0.2, openings: openings as CompiledOpening[] }]
	} as CompiledLayoutGeometry;
}

it('aims the noon light from the exterior side of a window regardless of its normal orientation', () => {
	expect(aimThroughWindows(geometry(windowAt([8, 2], [-1, 0])))).toBe(90);
	expect(aimThroughWindows(geometry(windowAt([8, 2], [1, 0])))).toBe(90);
});

it('weights opposing exterior windows by area and ignores interior windows', () => {
	const east = windowAt([8, 2], [1, 0], 2, 2);
	const west = windowAt([0, 2], [-1, 0], 3, 1);
	const interior = windowAt([4, 2], [-1, 0], 2, 2);
	expect(aimThroughWindows(geometry(east, west, interior))).toBe(90);
	expect(aimThroughWindows(geometry(east, windowAt([0, 2], [-1, 0], 2, 2), interior))).toBeNull();
	expect(aimThroughWindows(geometry(interior))).toBeNull();
	expect(aimThroughWindows(geometry())).toBeNull();
});

it('keeps the current windowless starter at the canonical Studio default', async () => {
	const envelope = await DEFAULT_STARTER_TEMPLATE.build('seed', 'Seed', { projectId: 'seed', revisionId: 'seed-1' });
	const runtime = prepareUnitRuntime(envelope);
	expect(runtime.kind).toBe('ready');
	if (runtime.kind === 'ready') expect(aimThroughWindows(runtime.geometry)).toBeNull();
	expect(envelope.units.scene.data.environment?.sky).toBeUndefined();
});
