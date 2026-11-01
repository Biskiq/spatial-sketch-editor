<script lang="ts">
	/**
	 * R217.S19 — the finite mat ground and its per-pixel grid.
	 *
	 * The mat is a unit plane scaled from the Camera's own ground reach. It is an
	 * opaque ground, as before S19: it writes depth, so anything below the datum
	 * stays under it. The grid is one subdivided quad with `stage-mat-grid`'s
	 * shader, sharing the mat's transform; it is occluded only by real geometry,
	 * and a pan or zoom updates uniforms and never rebuilds geometry. Neither is a
	 * pick root, and neither enters bounds or Fit.
	 */
	import { onDestroy } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import type { Mesh } from 'three';
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import { MAT_GROUND_INK, STAGE_OVERLAY_LAYER } from '../paper-plan';
	import { matGroundFor } from '../stage-grid';
	import {
		createMatGridMaterial,
		MAT_GRID_LIFT_METERS,
		MAT_GRID_RENDER_ORDER,
		MAT_GRID_SEGMENTS,
		updateMatGridMaterial
	} from './stage-mat-grid';

	let {
		evaluation,
		datumMeters = 0,
		gridVisible
	}: {
		evaluation: ViewportEvaluation;
		/** The level datum the mat sits at. */
		datumMeters?: number;
		/** Grid/Snap view state; the mat itself always draws. */
		gridVisible: boolean;
	} = $props();

	const { dpr, invalidate } = useThrelte();
	const gridMaterial = createMatGridMaterial();
	onDestroy(() => gridMaterial.dispose());

	const ground = $derived(matGroundFor(evaluation, datumMeters));
	const size = $derived(2 * ground.halfExtentMeters);

	$effect(() => {
		updateMatGridMaterial(gridMaterial, ground, $dpr);
		invalidate();
	});

	function overlayOnly(mesh: Mesh): void {
		mesh.layers.set(STAGE_OVERLAY_LAYER);
	}
</script>

<T.Mesh
	position={[ground.centerXZ[0], datumMeters - 0.004, ground.centerXZ[1]]}
	scale={[size, size, 1]}
	rotation={[-Math.PI / 2, 0, 0]}
>
	<T.PlaneGeometry args={[1, 1]} />
	<T.MeshStandardMaterial color={MAT_GROUND_INK} roughness={1} metalness={0} />
</T.Mesh>
{#if gridVisible}
	<T.Mesh
		position={[ground.centerXZ[0], datumMeters + MAT_GRID_LIFT_METERS, ground.centerXZ[1]]}
		scale={[size, size, 1]}
		rotation={[-Math.PI / 2, 0, 0]}
		renderOrder={MAT_GRID_RENDER_ORDER}
		frustumCulled={false}
		oncreate={overlayOnly}
	>
		<T.PlaneGeometry args={[1, 1, MAT_GRID_SEGMENTS, MAT_GRID_SEGMENTS]} />
		<T is={gridMaterial} />
	</T.Mesh>
{/if}
