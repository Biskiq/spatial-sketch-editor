import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { createVisitorWallMaterialFactory } from '$lib/render/layout/wall-material-factory';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { PAPER_GROUND_INK } from '$lib/authoring/stage/paper-plan';
import { DEFAULT_FLOOR_COLOR, DEFAULT_WALL_COLOR, DEFAULT_WALL_UNLIT_SHARE } from '$lib/visitor/room-presentation';
import type { RuntimeScene } from '@portfolio/project-model/scene';
import { resolveSceneSurfaceLook } from '$lib/render/layout/scene-surface-look';

const source = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('the default Wall surface', () => {
	it('holds part of its colour unlit and untoned', () => {
		const store = createMaterialStore();
		const { factory, dispose } = createVisitorWallMaterialFactory(store, () => DEFAULT_WALL_COLOR, DEFAULT_WALL_UNLIT_SHARE);
		const material = factory('surface', { roomId: 'wall' } as never).material as MeshStandardMaterial;
		expect(material.emissiveIntensity).toBe(DEFAULT_WALL_UNLIT_SHARE);
		expect(material.toneMapped).toBe(false);
		expect(material.color.getHexString()).toBe(DEFAULT_WALL_COLOR.slice(1));
		dispose();
		store.dispose();
	});

	it('leaves a plain tint exactly as it was', () => {
		const store = createMaterialStore();
		const { factory, dispose } = createVisitorWallMaterialFactory(store, () => '#4b4b52');
		const material = factory('surface', { roomId: 'room' } as never).material as MeshStandardMaterial;
		expect(material.emissiveIntensity).toBe(0);
		expect(material.toneMapped).toBe(true);
		dispose();
		store.dispose();
	});

	it('resolves each authored Wall side through the shared Scene look', () => {
		const store = createMaterialStore();
		const scene: RuntimeScene = {
			textures: [], materials: [], entities: [], objects: [],
			surfaceFinishes: [{
				surface: { kind: 'wall-side', wallId: 'wall-painted', side: 'left' },
				finish: { materialId: 'marble-light' }
			}]
		};
		const { factory, dispose } = createVisitorWallMaterialFactory(store, () => DEFAULT_WALL_COLOR, DEFAULT_WALL_UNLIT_SHARE, undefined, {
			resolveSurfaceLook: (surface) => resolveSceneSurfaceLook(scene, surface, undefined)
		});
		const mesh = { roomId: 'wall-painted', wallRanges: [{ segmentId: 'wall-painted' }] } as never;
		const left = factory('side', mesh, 'left').material as MeshStandardMaterial;
		const right = factory('side', mesh, 'right').material as MeshStandardMaterial;
		expect(left.color.getHexString()).toBe('e8e4dc');
		expect(left.emissiveIntensity).toBe(1);
		expect(left.emissive.getHex()).toBe(0x000000);
		expect(right.color.getHexString()).toBe(DEFAULT_WALL_COLOR.slice(1));
		expect(right.emissiveIntensity).toBe(DEFAULT_WALL_UNLIT_SHARE);
		dispose();
		store.dispose();
	});

	it('acquires every Wall surface from the Canvas store, so a compile creates none', () => {
		const store = createMaterialStore();
		const { factory, dispose } = createVisitorWallMaterialFactory(store, () => DEFAULT_WALL_COLOR, DEFAULT_WALL_UNLIT_SHARE);
		const first = factory('surface', { roomId: 'wall' } as never).material;
		const second = factory('surface', { roomId: 'wall' } as never).material;
		expect(second).toBe(first);
		// One material for the whole representation, acquired once and shared.
		expect(store.stats().created).toBe(1);
		expect(store.stats().acquired).toBe(1);
		dispose();
		expect(store.stats().live).toBe(0);
		store.dispose();
	});

	it('reaches Stage and Visitor through the same Scene-aware representations', () => {
		expect(source('src/lib/render/layout-wall-representation.ts')).toContain(
			'createVisitorWallMaterialFactory('
		);
		const shell = source('src/lib/visitor/VisitorLayoutShell.svelte');
		expect(shell).toMatch(
			/createWallRepresentation\(\s*materials,\s*undefined,\s*null,\s*null,\s*\(\) => invalidate\(\),\s*resolveSurfaceLook,\s*viewGeneration(?:,\s*\(outcome\) => onFinishOutcome\?\.\(outcome\))?\s*\)/
		);
		expect(shell).toContain('walls.setScene(scene, textureScope)');
		expect(shell).toContain('rooms.setScene(scene, textureScope)');
		expect(source('src/lib/authoring/stage/shell/StageCanvas.svelte')).toContain(
			'<VisitorLayoutShell {geometry} {scene} textureScope={textureScope}'
		);
	});

	it('passes a texture Retry from the Stage to the Layout shell', () => {
		const stage = source('src/lib/authoring/stage/shell/StageCanvas.svelte');
		expect(/<VisitorLayoutShell[^]*?\/>/u.exec(stage)?.[0]).toContain('{textureRevision}');
	});

	it('draws the default Room floor as the ground: same colour, unlit and untoned', () => {
		expect(DEFAULT_FLOOR_COLOR).toBe(PAPER_GROUND_INK);
		expect(source('src/lib/render/layout-room-representation.ts')).toContain(
			"floor: { kind: 'basic', color: floor.color, toneMapped: false }"
		);
	});

	it('keeps selection paint independent of authored Wall materials', () => {
		const layer = source('src/lib/authoring/stage/shell/StageSelectionLayer.svelte');
		expect(layer).toContain("toneMapped: false");
		expect(layer).not.toContain("tintGeometry");
		expect(layer).toContain("color: tone === 'selection' ? GOLD");
	});
});
