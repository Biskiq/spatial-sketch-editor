/**
 * T1 X1 — a snapshot is **as-built** during an active Lift.
 *
 * Snapshots are drawn from the Stage's own renderer and cached by pose and source
 * revision, so an image rendered while a lid is lifted would be reused after Put
 * back. The mask alone does not prove the image: this suite drives the real
 * `renderStageSnapshot` with a recording renderer and compares what three would
 * actually draw with Lift off and Lift on, then proves the cache serves the same
 * as-built image across a Put back.
 *
 * The unit lane has no WebGL context, so pixel equality is proven in the plan's
 * browser QA; what is proven here is the draw set, the materials, the world
 * matrices and the camera mask.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	Camera,
	Color,
	Group,
	Mesh,
	MeshBasicMaterial,
	ShapeGeometry,
	Shape,
	Vector4,
	type Material,
	type Object3D,
	type Scene
} from 'three';
import type { WebGPURenderer } from 'three/webgpu';
import { Line2NodeMaterial } from 'three/webgpu';
import { Line2 } from 'three/addons/lines/webgpu/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { compileWallFirstLayoutGeometry, type CompiledLayoutGeometry } from '@portfolio/layout-core/geometry';

import { renderStageSnapshot } from '$lib/authoring/stage/shell/StageSnapshotRenderer.svelte';
import { STAGE_LIFTED_LAYER, STAGE_OVERLAY_LAYER, STAGE_WORLD_LAYER } from '$lib/authoring/stage/paper-plan';
import {
	clearStageSnapshotCache,
	registerStageSnapshotRenderer,
	requestStageSnapshot,
	type SnapshotRequest
} from '$lib/authoring/stage/stage-snapshots';
import { createRoomRepresentation } from '$lib/render/layout-room-representation';
import { createWallRepresentation } from '$lib/render/layout-wall-representation';
import { createObjectRepresentation } from '$lib/render/layout-object-representation';
import { createGeometryStore } from '$lib/render/resources/geometry-store';
import { createMaterialStore } from '$lib/render/resources/material-store';
import { buildScaleFixture, SCALE_FIXTURE_SEEDS } from '../layout/__fixtures__/layout-scale-fixtures';

const REQUEST: SnapshotRequest = {
	viewId: 'view-gallery-up',
	sourceRevision: 'revision-1',
	// Inside Gallery, looking up at its lid, with enough horizontal offset that the
	// pose has a real yaw: a perfectly vertical aim is not an inspection pose.
	pose: { eye: [3, 1.6, 2], target: [3.6, 4, 2.8], fovDegrees: 60 },
	aspect: 1.6
};

type Drawn = {
	readonly name: string;
	readonly material: Material | Material[] | null;
	readonly matrix: number[];
};

/**
 * A renderer that records what three **would** draw: every visible object whose
 * layers intersect the camera's mask, in scene order, with its material identity
 * and world matrix.
 */
function recordingRenderer(): {
	readonly renderer: WebGPURenderer;
	readonly drawn: Drawn[];
	readonly renders: () => number;
} {
	const drawn: Drawn[] = [];
	let renders = 0;
	const stub = {
		autoClear: true,
		getRenderTarget: () => null,
		setRenderTarget: () => {},
		getClearColor: (color: Color) => color,
		getClearAlpha: () => 1,
		setClearColor: () => {},
		getScissorTest: () => false,
		setScissorTest: () => {},
		getViewport: (vector: Vector4) => vector,
		setViewport: () => {},
		getScissor: (vector: Vector4) => vector,
		setScissor: () => {},
		clear: () => {},
		render: (scene: Scene, camera: Camera) => {
			renders += 1;
			scene.traverseVisible((object: Object3D) => {
				if (!object.layers.test(camera.layers)) return;
				if (object.name === '') return;
				const material = (object as Mesh).material as Material | Material[] | undefined;
				object.updateWorldMatrix(true, false);
				drawn.push({
					name: object.name,
					material: material ?? null,
					matrix: object.matrixWorld.toArray()
				});
			});
		},
		readRenderTargetPixelsAsync: async (
			_target: unknown,
			_x: number,
			_y: number,
			width: number,
			height: number
		) => new Uint8Array(width * height * 4)
	};
	return {
		renderer: stub as unknown as WebGPURenderer,
		drawn,
		renders: () => renders
	};
}

function compiled(): CompiledLayoutGeometry {
	return compileWallFirstLayoutGeometry(buildScaleFixture(SCALE_FIXTURE_SEEDS.small)).geometry;
}

type Shell = {
	readonly scene: Scene;
	readonly rooms: ReturnType<typeof createRoomRepresentation>;
	readonly ink: readonly string[];
	dispose(): void;
};

/**
 * The real Layout representations under one root, as `VisitorLayoutShell` mounts
 * them, plus the two pieces of `StageLiftLayer` ink standing in for the outline
 * and the selected ghost.
 */
function buildShell(geometry: CompiledLayoutGeometry): Shell {
	const materials = createMaterialStore();
	const geometryStore = createGeometryStore();
	const root = new Group();
	root.name = 'VisitorLayoutShell';

	const rooms = createRoomRepresentation(materials);
	const walls = createWallRepresentation(materials);
	const objects = createObjectRepresentation(materials, geometryStore);
	rooms.update(geometry);
	walls.update(geometry);
	objects.update(geometry);
	root.add(rooms.object3d, walls.object3d, objects.object3d);

	// Editor ink at the lifted lid's elevation: a dashed closed outline and the
	// selected overhead's translucent ghost. Neither is ever a world surface.
	const ring = geometry.rooms[0]!.ceilingPolygon;
	const outlineGeometry = new LineGeometry();
	outlineGeometry.setPositions(
		[...ring, ring[0]!].flatMap(([x, z]) => [x, geometry.rooms[0]!.ceilingElevation - 0.01, z])
	);
	const outlineMaterial = new Line2NodeMaterial({
		color: 0xffffff,
		linewidth: 2,
		dashed: true,
		dashSize: 0.12,
		gapSize: 0.08
	});
	const outline = new Line2(outlineGeometry, outlineMaterial);
	outline.name = 'LiftOutline';
	outline.computeLineDistances();
	outline.layers.set(STAGE_OVERLAY_LAYER);
	outline.raycast = () => {};

	const ghostShape = new Shape();
	ghostShape.moveTo(ring[0]![0], ring[0]![1]);
	for (const [x, z] of ring.slice(1)) ghostShape.lineTo(x, z);
	ghostShape.closePath();
	const ghost = new Mesh(
		new ShapeGeometry(ghostShape),
		new MeshBasicMaterial({ transparent: true, opacity: 0.18, depthWrite: false })
	);
	ghost.name = 'LiftGhost';
	ghost.position.set(0, geometry.rooms[0]!.ceilingElevation, 0);
	ghost.rotation.set(Math.PI / 2, 0, 0);
	ghost.layers.set(STAGE_OVERLAY_LAYER);
	ghost.raycast = () => {};

	const inkGroup = new Group();
	inkGroup.add(outline, ghost);
	root.add(inkGroup);

	return {
		scene: root as unknown as Scene,
		rooms,
		ink: ['LiftOutline', 'LiftGhost'],
		dispose() {
			rooms.dispose();
			walls.dispose();
			objects.dispose();
			outlineGeometry.dispose();
			outlineMaterial.dispose();
			(ghost.material as MeshBasicMaterial).dispose();
			ghost.geometry.dispose();
			materials.dispose();
			geometryStore.dispose();
		}
	};
}

afterEach(() => {
	registerStageSnapshotRenderer(null);
	clearStageSnapshotCache();
});

describe('T1 X1 — a snapshot is as-built during Lift', () => {
	it('draws the identical world, every lid included, and no Lift ink', async () => {
		const geometry = compiled();
		const shell = buildShell(geometry);
		const lidNames = geometry.rooms.map((room) => `VisitorCeiling:${room.roomId}`);

		const off = recordingRenderer();
		const offFrame = await renderStageSnapshot(off.renderer, shell.scene, REQUEST, null, null, 'webgpu');
		expect(offFrame).not.toBeNull();
		expect(off.renders()).toBe(1);
		for (const lid of lidNames) expect(off.drawn.map((object) => object.name)).toContain(lid);

		shell.rooms.setLifted(new Set([geometry.rooms[0]!.roomId]));
		const on = recordingRenderer();
		const onFrame = await renderStageSnapshot(on.renderer, shell.scene, REQUEST, null, null, 'webgpu');
		expect(onFrame).not.toBeNull();

		// As-built: the same objects, the same material instances, the same world
		// matrices — one lifted lid included, not one lid missing.
		expect(on.drawn.map((object) => object.name)).toEqual(off.drawn.map((object) => object.name));
		for (let index = 0; index < off.drawn.length; index += 1) {
			expect(on.drawn[index]!.material).toBe(off.drawn[index]!.material);
			expect(on.drawn[index]!.matrix).toEqual(off.drawn[index]!.matrix);
		}
		for (const lid of lidNames) expect(on.drawn.map((object) => object.name)).toContain(lid);

		// The Lift layer is editor ink, never world content in a snapshot.
		const drawnNames = on.drawn.map((object) => object.name);
		for (const name of shell.ink) expect(drawnNames).not.toContain(name);

		// Exactly the world and the lifted layer; the overlay layer stays out.
		expect(onFrame!.camera.layers.mask).toBe((1 << STAGE_WORLD_LAYER) | (1 << STAGE_LIFTED_LAYER));
		expect(onFrame!.camera.layers.mask & (1 << STAGE_OVERLAY_LAYER)).toBe(0);
		// The Stage's own mask is unchanged by any of this: a snapshot's camera is
		// its own, and the view it renders is not the authoring view.
		expect(offFrame!.camera.layers.mask).toBe((1 << STAGE_WORLD_LAYER) | (1 << STAGE_LIFTED_LAYER));

		shell.dispose();
	});

	it('serves the image rendered during Lift, unchanged, after Put back', async () => {
		const geometry = compiled();
		const shell = buildShell(geometry);
		const renderer = vi.fn(async () => 'data:image/png;base64,lifted-but-as-built');
		registerStageSnapshotRenderer(renderer);
		clearStageSnapshotCache();

		shell.rooms.setLifted(new Set(geometry.rooms.map((room) => room.roomId)));
		const duringLift = await requestStageSnapshot(REQUEST);
		shell.rooms.setLifted(new Set());
		const afterPutBack = await requestStageSnapshot(REQUEST);

		// One render for both: the cache is keyed by pose and source revision, and
		// Lift changes neither, so the as-built image is what a Put back serves.
		expect(renderer).toHaveBeenCalledTimes(1);
		expect(afterPutBack).toBe(duringLift);

		shell.dispose();
	});
});
