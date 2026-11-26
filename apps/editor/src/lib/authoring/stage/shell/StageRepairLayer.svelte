<script lang="ts">
	/**
	 * Stage amber repair hatch layer.
	 *
	 * Render-only overlay beside `StageSelectionLayer.svelte` on Stage overlay
	 * layer 2 (never under a pick root, never hit by raycasts). Draws a diagonal
	 * hatch in `SPATIAL_PAINT_ROLES.repair` (`#a9631f`) strictly on the union of
	 * open issues' `affected` targets.
	 */
	import { T, useThrelte } from '@threlte/core';
	import {
		CanvasTexture,
		DoubleSide,
		Group,
		Mesh,
		MeshBasicMaterial,
		RepeatWrapping
	} from 'three';
	import { SPATIAL_PAINT_ROLES } from '$lib/design/spatial-paint';
	import type { ScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import { STAGE_OVERLAY_LAYER } from '../paper-plan';
	import { drawnMeshesOf, repairSurfaceGeometry } from './stage-selection-source';
	import { repairSurfaceRef } from '$lib/authoring/look/appearance-issues.svelte';

	let {
		affectedTargets = new Set<string>(),
		scenePick,
		revision = ''
	}: {
		readonly affectedTargets?: ReadonlySet<string>;
		readonly scenePick: ScenePickSource;
		/** Changes whenever geometry/meshes may have rebuilt so overlays stay aligned. */
		readonly revision?: string;
	} = $props();

	const { invalidate } = useThrelte();
	const root = new Group();
	root.name = 'StageRepairHatchLayer';
	root.layers.set(STAGE_OVERLAY_LAYER);

	function createHatchTexture(): CanvasTexture | null {
		if (typeof document === 'undefined') return null;
		const size = 64;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');
		if (ctx === null) return null;
		ctx.clearRect(0, 0, size, size);
		ctx.strokeStyle = SPATIAL_PAINT_ROLES.repair;
		ctx.lineWidth = 6;
		ctx.globalAlpha = 0.72;
		ctx.beginPath();
		for (let offset = -size; offset < size * 2; offset += 16) {
			ctx.moveTo(offset, 0);
			ctx.lineTo(offset + size, size);
		}
		ctx.stroke();
		const texture = new CanvasTexture(canvas);
		texture.wrapS = RepeatWrapping;
		texture.wrapT = RepeatWrapping;
		texture.repeat.set(4, 4);
		texture.needsUpdate = true;
		return texture;
	}

	const hatchTexture = createHatchTexture();
	const hatchMaterial = new MeshBasicMaterial({
		color: hatchTexture === null ? SPATIAL_PAINT_ROLES.repair : 0xffffff,
		map: hatchTexture,
		transparent: true,
		opacity: hatchTexture === null ? 0.32 : 0.85,
		depthWrite: false,
		side: DoubleSide,
		polygonOffset: true,
		polygonOffsetFactor: -3,
		polygonOffsetUnits: -3
	});

	function clearOverlays(): void {
		while (root.children.length > 0) {
			const child = root.children[0]!;
			if (child instanceof Mesh && child.userData.ownsRepairGeometry === true) child.geometry.dispose();
			root.remove(child);
		}
	}

	function collectTargetMeshes(targetKey: string): Mesh[] {
		if (targetKey.startsWith('entity:')) {
			const entityId = targetKey.slice('entity:'.length);
			const obj = scenePick.entityObject(entityId);
			return obj === null ? [] : drawnMeshesOf([obj]);
		}
		if (targetKey.startsWith('surface:')) {
			const surface = repairSurfaceRef(targetKey);
			if (surface === null) return [];
			if (surface.kind === 'wall-side') {
				const obj = scenePick.layoutObjectOf('wall', surface.wallId);
				return obj === null ? [] : drawnMeshesOf([obj]);
			}
			if (surface.kind === 'room-floor' || surface.kind === 'room-lid') {
				const obj = scenePick.layoutObjectOf('floor', surface.roomId);
				if (obj === null) return [];
				return drawnMeshesOf([obj.parent ?? obj]);
			}
			if (surface.kind === 'region-face') {
				const obj = scenePick.layoutObjectOf('region', surface.regionId);
				return obj === null ? [] : drawnMeshesOf([obj]);
			}
		}
		return [];
	}

	$effect(() => {
		void revision;
		clearOverlays();
		if (affectedTargets.size === 0) {
			invalidate();
			return;
		}
		for (const targetKey of affectedTargets) {
			for (const sourceMesh of collectTargetMeshes(targetKey)) {
				const surface = repairSurfaceRef(targetKey);
				const geometry = surface === null ? sourceMesh.geometry : repairSurfaceGeometry(sourceMesh, surface);
				if (geometry === null) continue;
				sourceMesh.updateWorldMatrix(true, false);
				const overlay = new Mesh(geometry, hatchMaterial);
				overlay.userData.ownsRepairGeometry = geometry !== sourceMesh.geometry;
				overlay.matrixAutoUpdate = false;
				overlay.matrix.copy(sourceMesh.matrixWorld);
				overlay.matrixWorldNeedsUpdate = true;
				overlay.layers.set(STAGE_OVERLAY_LAYER);
				overlay.renderOrder = 14;
				overlay.frustumCulled = false;
				root.add(overlay);
			}
		}
		invalidate();
	});

	$effect(() => {
		return () => {
			clearOverlays();
			hatchMaterial.dispose();
			hatchTexture?.dispose();
		};
	});
</script>

<T is={root} />
