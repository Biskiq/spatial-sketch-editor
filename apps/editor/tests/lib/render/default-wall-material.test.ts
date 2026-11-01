import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { createVisitorWallMaterialFactory } from '$lib/museum/layout/wall-material-factory';
import { DEFAULT_WALL_COLOR, DEFAULT_WALL_UNLIT_SHARE } from '$lib/visitor/room-presentation';

const source = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('the default Wall surface', () => {
	it('holds part of its colour unlit and untoned', () => {
		const { factory, dispose } = createVisitorWallMaterialFactory(() => DEFAULT_WALL_COLOR, DEFAULT_WALL_UNLIT_SHARE);
		const material = factory('surface', { roomId: 'wall' } as never).material as MeshStandardMaterial;
		expect(material.emissiveIntensity).toBe(DEFAULT_WALL_UNLIT_SHARE);
		expect(material.toneMapped).toBe(false);
		expect(material.color.getHexString()).toBe(DEFAULT_WALL_COLOR.slice(1));
		dispose();
	});

	it('leaves a plain tint exactly as it was', () => {
		const { factory, dispose } = createVisitorWallMaterialFactory(() => '#4b4b52');
		const material = factory('surface', { roomId: 'room' } as never).material as MeshStandardMaterial;
		expect(material.emissiveIntensity).toBe(0);
		expect(material.toneMapped).toBe(true);
		dispose();
	});

	it('reaches both the Stage and Preview through the one representation', () => {
		expect(source('src/lib/render/layout-wall-representation.ts')).toContain(
			'createVisitorWallMaterialFactory(() => DEFAULT_WALL_COLOR, DEFAULT_WALL_UNLIT_SHARE)'
		);
		expect(source('src/lib/visitor/VisitorLayoutShell.svelte')).toContain('createWallRepresentation');
		// The Room floor keeps its own tint.
		expect(source('src/lib/visitor/VisitorLayoutShell.svelte')).toContain('tint={colors.color}');
	});

	it('selects with Paper\'s two-tone contour, which holds on cream and on forest', () => {
		const layer = source('src/lib/authoring/stage/shell/StageSelectionLayer.svelte');
		expect(layer).toContain("color: tone === 'selection' ? SELECTION_EDGE : 0x152c26");
		expect(layer).toContain("color: tone === 'selection' ? GOLD");
	});
});
