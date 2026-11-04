<script lang="ts">
	/**
	 * R217.S19 — the finite mat ground and its per-pixel grid.
	 *
	 * The mat is a unit plane scaled from the Camera's own ground reach. It is an
	 * opaque ground, as before S19: it writes depth, so anything below the datum
	 * stays under it. It is Paper's colour inside the plate around the work and plain
	 * forest outside, in one draw; only the plate carries grid lines. The grid is one subdivided quad with `stage-mat-grid`'s
	 * shader, sharing the mat's transform; it is occluded only by real geometry,
	 * and a pan or zoom updates uniforms and never rebuilds geometry. Neither is a
	 * pick root, and neither enters bounds or Fit.
	 *
	 * Under a World environment (Experience review 1) the same bounded plate stays,
	 * with its grid and Paper's unlit tone, plus a shadow catcher so the sun's
	 * shadows land on it; outside it the environment's own ground and horizon show
	 * instead of the forest mat.
	 */
	import { onDestroy } from 'svelte';
	import { T, useThrelte } from '@threlte/core';
	import type { Color, Mesh } from 'three';
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import { PAPER_GROUND_INK, STAGE_OVERLAY_LAYER } from '../paper-plan';
	import { matGroundFor, workspaceRectFor, type GridRect } from '../stage-grid';
	import {
		createMatGridMaterial,
		createMatGroundMaterial,
		MAT_GRID_LIFT_METERS,
		MAT_GRID_RENDER_ORDER,
		MAT_GRID_SEGMENTS,
		updateMatGridMaterial,
		updateMatMaterial
	} from './stage-mat-grid';

	let {
		evaluation,
		datumMeters = 0,
		gridVisible,
		contentBounds = null,
		plateInk = PAPER_GROUND_INK,
		litPlate = null
	}: {
		evaluation: ViewportEvaluation;
		/** The level datum the mat sits at. */
		datumMeters?: number;
		/** Grid/Snap view state; the mat itself always draws. */
		gridVisible: boolean;
		/** Layout ∪ Scene datum bounds; the plate is a sheet around them. */
		contentBounds?: GridRect | null;
		/** The viewer's 3D board tone (a ⚙ view preference). */
		plateInk?: string;
		/** A World environment's plate tone: draw only the bounded plate, catching shadows. */
		litPlate?: string | null;
	} = $props();

	const { dpr, invalidate } = useThrelte();
	const gridMaterial = createMatGridMaterial();
	const groundMaterial = createMatGroundMaterial();
	onDestroy(() => {
		gridMaterial.dispose();
		groundMaterial.dispose();
	});

	const ground = $derived(matGroundFor(evaluation, datumMeters));
	const plate = $derived(workspaceRectFor(contentBounds));
	const size = $derived(2 * ground.halfExtentMeters);
	const plateCenter = $derived<[number, number, number]>([(plate.minX + plate.maxX) / 2, datumMeters - 0.004, (plate.minZ + plate.maxZ) / 2]);

	$effect(() => {
		updateMatGridMaterial(gridMaterial, ground, $dpr, plate);
		updateMatMaterial(groundMaterial, ground, plate);
		(groundMaterial.uniforms.uPlateInk!.value as Color).set(plateInk);
		invalidate();
	});

	function overlayOnly(mesh: Mesh): void {
		mesh.layers.set(STAGE_OVERLAY_LAYER);
	}
</script>

{#if litPlate !== null}
	<T.Mesh position={plateCenter} scale={[plate.maxX - plate.minX, plate.maxZ - plate.minZ, 1]} rotation={[-Math.PI / 2, 0, 0]}>
		<T.PlaneGeometry args={[1, 1]} />
		<T.MeshBasicMaterial color={litPlate} toneMapped={false} />
	</T.Mesh>
	<T.Mesh
		position={plateCenter}
		scale={[plate.maxX - plate.minX, plate.maxZ - plate.minZ, 1]}
		rotation={[-Math.PI / 2, 0, 0]}
		receiveShadow
	>
		<T.PlaneGeometry args={[1, 1]} />
		<T.ShadowMaterial opacity={0.2} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} depthWrite={false} />
	</T.Mesh>
{:else}
	<T.Mesh
		position={[ground.centerXZ[0], datumMeters - 0.004, ground.centerXZ[1]]}
		scale={[size, size, 1]}
		rotation={[-Math.PI / 2, 0, 0]}
	>
		<T.PlaneGeometry args={[1, 1, MAT_GRID_SEGMENTS, MAT_GRID_SEGMENTS]} />
		<T is={groundMaterial} />
	</T.Mesh>
{/if}
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
