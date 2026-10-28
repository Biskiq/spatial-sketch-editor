<script lang="ts">
	import { createManagedWebGLRenderer } from '$lib/render/managed-webgl-renderer';
	import { perfMark, perfRenderer } from '$lib/platform/perf-marks';
	/**
	 * The **one persistent Stage Canvas**.
	 *
	 * There is a single Threlte `<Canvas>` for every reading (Plan and 3D) and every
	 * lens: a reading flip or a lens change re-evaluates the camera, it never
	 * launches a second renderer or a second scene. Canonical Layout and the existing
	 * Scene render through the same runtime-safe adapters the visitor runtime uses
	 * (the Junction-aware wall mesh builders and the scene entity/material
	 * resolution), so editor and visitor geometry cannot drift.
	 *
	 * The shadow-map type is selected **explicitly** as the landed r186 upgrade does
	 * (`PCFShadowMap`); the removed PCFSoft filtering path is never reachable through
	 * a boolean `shadows`.
	 */
	import { Canvas, T } from '@threlte/core';
	import { PCFShadowMap } from 'three';
	import type { CompiledLayoutGeometry } from '@portfolio/layout-core';
	import type { LayoutRoomRegistry, RuntimeScene } from '@portfolio/project-model';
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import VisitorLayoutShell from '$lib/visitor/VisitorLayoutShell.svelte';
	import type { ScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import type { StageGhostMesh } from '$lib/authoring/stage/stage-facade';
	import {
		neutralVisitorRoomPresentation,
		type VisitorRoomPresentation
	} from '$lib/visitor/room-presentation';
	import StageCamera from './StageCamera.svelte';
	import StageEntities from './StageEntities.svelte';
	import StageShadowTriggers from './StageShadowTriggers.svelte';

	let {
		geometry,
		sourceContentId,
		scene,
		rooms,
		evaluation,
		ghosts = [],
		modelUrls = null,
		scenePick
	}: {
		geometry: CompiledLayoutGeometry;
		sourceContentId: string;
		scene: RuntimeScene;
		rooms: LayoutRoomRegistry;
		evaluation: ViewportEvaluation | null;
		/** Adapter-proposed poses, drawn here by the one Canvas. */
		ghosts?: readonly StageGhostMesh[];
		/** Resolved approved creator-model bytes, owned by the route's session. */
		modelUrls?: ReadonlyMap<string, string> | null;
		scenePick: ScenePickSource;
	} = $props();

	const presentation = $derived.by(() => {
		const record: Record<string, VisitorRoomPresentation> = {};
		for (const room of geometry.rooms) record[room.roomId] = neutralVisitorRoomPresentation;
		return record;
	});

	// Runs after the accepted props update, before Threlte submits the next frame.
	$effect(() => {
		geometry;
		perfMark('stage:source-ready', { sourceContentId });
	});
	$effect(() => scenePick.setSource(scene));
	let formRenderRevision = $state(0);
	function formRendererReady(): void {
		formRenderRevision += 1;
		scenePick.refresh();
	}
</script>

<Canvas createRenderer={(canvas) => perfRenderer(createManagedWebGLRenderer(canvas), 'stage')} dpr={[1, 1.5]} shadows={PCFShadowMap}>
	<T.Color attach="background" args={[0x111117]} />
	<T.Fog attach="fog" args={[0x111117, 40, 120]} />
	<T.AmbientLight intensity={0.35} />
	<T.DirectionalLight position={[6, 12, 8]} intensity={1.1} castShadow />
	<T.DirectionalLight position={[-8, 6, -6]} intensity={0.35} />
	<StageCamera {evaluation} />
	<!--
		T1.P02.S06 D.6 (H9) — the Stage's shadow maps are rendered when their own
		dependencies change, not on every frame. Mounted inside this one Canvas
		because it owns this renderer's shadow map; see the component for the full
		trigger contract.
	-->
	<StageShadowTriggers {geometry} {scene} {rooms} {modelUrls} {formRenderRevision} />
	<T.Group oncreate={scenePick.registerLayout}>
		<VisitorLayoutShell {geometry} {presentation} />
	</T.Group>
	<StageEntities {scenePick} {scene} {rooms} {modelUrls} onFormRendererReady={formRendererReady} />
	<!--
		Proposed-pose ghosts: the object's own shape at the captured pose, translucent
		and depth-write-free so the accepted body stays readable underneath. They are
		one more child of the same Canvas — never a second renderer or scene.
	-->
	{#each ghosts as ghost (ghost.id)}
		<T.Mesh position={ghost.center} rotation={[0, ghost.yaw, 0]} renderOrder={2}>
			{#if ghost.shape.kind === 'box'}
				<T.BoxGeometry args={ghost.shape.size} />
			{:else if ghost.shape.kind === 'cylinder'}
				<T.CylinderGeometry args={[ghost.shape.radius, ghost.shape.radius, ghost.shape.height, 24]} />
			{:else}
				<T.SphereGeometry args={[ghost.shape.radius, 24, 16]} />
			{/if}
			<T.MeshStandardMaterial color={0xc9a9ff} transparent opacity={0.38} depthWrite={false} />
		</T.Mesh>
	{/each}
</Canvas>
