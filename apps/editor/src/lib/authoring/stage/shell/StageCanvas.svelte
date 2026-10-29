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
	import type { CompiledLayoutGeometry, PlanEvaluation } from '@portfolio/layout-core';
	import type { LayoutRoomRegistry, RuntimeScene } from '@portfolio/project-model';
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import VisitorLayoutShell from '$lib/visitor/VisitorLayoutShell.svelte';
	import type { ScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import type { StageGhostMesh } from '$lib/authoring/stage/stage-facade';
	import {
		neutralVisitorRoomPresentation,
		type VisitorRoomPresentation
	} from '$lib/visitor/room-presentation';
	import { planSceneFootprintsFor } from '$lib/authoring/scene/plan-scene-footprint';
	import { isPaperPlanVisible, MAT_GROUND_INK } from '../paper-plan';
	import StageCamera from './StageCamera.svelte';
	import StageEntities from './StageEntities.svelte';
	import StageFormGhost from './StageFormGhost.svelte';
	import StagePaper from './StagePaper.svelte';
	import StageShadowTriggers from './StageShadowTriggers.svelte';

	let {
		geometry,
		sourceContentId,
		scene,
		rooms,
		evaluation,
		ghosts = [],
		modelUrls = null,
		plan = null,
		planAppearance = 'paper',
		reducedMotion = false,
		datumMeters = 0,
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
		/** The facade's retained Plan: the drawing and the hit path share this object. */
		plan?: PlanEvaluation | null;
		/** PLATE's app preference; Paper is the default. */
		planAppearance?: 'paper' | 'shaded';
		reducedMotion?: boolean;
		/** The level datum the mat ground sits at. */
		datumMeters?: number;
		scenePick: ScenePickSource;
	} = $props();

	/** One footprint projection per accepted Scene snapshot, shared with the hit path. */
	const footprints = $derived(planSceneFootprintsFor(scene, scene.modelFootprints));
	const paperVisible = $derived(isPaperPlanVisible(evaluation, planAppearance));
	/** The mat ground is the Stage's own surface in both mesh readings; Paper hides it. */
	const matVisible = $derived(!paperVisible);
	/** Stable identity: an inline predicate would rebuild the Paper drawing every frame. */
	const footprintMounted = (entityId: string): boolean => scenePick.hasVisibleRoot(entityId);
	const matGroundArgs = [6000, 6000] as [number, number];

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
	/** A Scene root arriving or leaving changes which footprints Paper may draw. */
	let sceneRootRevision = $state(0);
	function registerSceneRoot(id: string, root: import('three').Object3D): () => void {
		const unregister = scenePick.register(id, root);
		sceneRootRevision += 1;
		return () => {
			unregister();
			sceneRootRevision += 1;
		};
	}
</script>

<Canvas createRenderer={(canvas) => perfRenderer(createManagedWebGLRenderer(canvas), 'stage')} dpr={[1, 1.5]} shadows={PCFShadowMap}>
	<!--
		PLATE's two Paper materials: the light vellum while Paper draws, the dark cutting
		mat for the model, applied by the Camera's appearance realizer. No fog: the mat is
		a measured ground, not an atmospheric room.
	-->
	<T.AmbientLight intensity={0.35} />
	<T.DirectionalLight position={[6, 12, 8]} intensity={1.1} castShadow />
	<T.DirectionalLight position={[-8, 6, -6]} intensity={0.35} />
	<StageCamera {evaluation} {paperVisible} />
	{#if matVisible}
		<!-- The mat ground gives depth and shadows; it is not a registered pick root. -->
		<T.Mesh position={[0, datumMeters - 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
			<T.PlaneGeometry args={matGroundArgs} />
			<T.MeshStandardMaterial color={MAT_GROUND_INK} roughness={1} metalness={0} />
		</T.Mesh>
	{/if}
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
	<StageEntities {scenePick} {scene} {rooms} {modelUrls} onFormRendererReady={formRendererReady} onEntityRoot={registerSceneRoot} />
	{#if paperVisible && plan !== null && evaluation !== null}
		<!--
			The Plan is a drawing on Paper: the same Plan evaluation the Layout pick
			provider reads, and the same Scene footprints the Scene pick reads.
		-->
		<StagePaper
			{plan}
			compiled={geometry}
			{footprints}
			width={evaluation.rect.width}
			height={evaluation.rect.height}
			instant={reducedMotion}
			isFootprintMounted={footprintMounted}
			{datumMeters}
			revision={sceneRootRevision}
		/>
	{/if}
	<!--
		Proposed-pose ghosts: the object's own shape at the captured pose, translucent
		and depth-write-free so the accepted body stays readable underneath. They are
		one more child of the same Canvas — never a second renderer or scene.
	-->
	{#each ghosts as ghost (ghost.id)}
		{#if ghost.shape.kind === 'form'}
			<StageFormGhost form={ghost.shape.form} position={ghost.center} yaw={ghost.yaw} />
		{:else}
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
		{/if}
	{/each}
</Canvas>
