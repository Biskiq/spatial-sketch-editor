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
	import type { StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
	import {
		neutralVisitorRoomPresentation,
		type VisitorRoomPresentation
	} from '$lib/visitor/room-presentation';
	import { planSceneFootprintsFor } from '$lib/authoring/scene/plan-scene-footprint';
import { isPaperPlanVisible, paperRevealFor, PAPER_GROUND_INK } from '../paper-plan';
import { workspaceRectFor } from '../stage-grid';
import { STAGE_DRAFTING_DEFAULTS, type StageDraftingState } from '../stage-drafting';
import StageCamera from './StageCamera.svelte';
import StageGrid from './StageGrid.svelte';
import StageMatGround from './StageMatGround.svelte';
	import StageEntities from './StageEntities.svelte';
	import StageFormGhost from './StageFormGhost.svelte';
	import StagePrimitiveGhost from './StagePrimitiveGhost.svelte';
	import StagePaper from './StagePaper.svelte';
	import StageSelectionLayer from './StageSelectionLayer.svelte';
	import StageShadowTriggers from './StageShadowTriggers.svelte';
	import StageSnapshotRenderer from './StageSnapshotRenderer.svelte';
	import WorldEnvironment from '$lib/render/WorldEnvironment.svelte';
	import { worldEnvironmentLook } from '$lib/render/world-environment';
	import type { SceneEnvironmentPreset } from '@portfolio/project-model/units';
	import type { GridRect } from '../stage-grid';

	function ignoreRaycast(): void {}


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
		paperInk2d = PAPER_GROUND_INK,
		paperInk3d = PAPER_GROUND_INK,
		/** R217.S05's one Grid/Snap view state; the grid is display-only. */
		drafting = STAGE_DRAFTING_DEFAULTS,
		/** Layout ∪ Scene datum bounds; Paper's grid draws a bounded sheet. */
		contentBounds = null,
		snapshotBounds = null,
		environment = 'paper',
		framedViewport = null,
		/** R217.S14 — the live candidate's extent; the sheet grows to include it. */
		datumMeters = 0,
		selection = null,
		hover = null,
		hoverTone = 'hover',
		scenePick,
		/** R217.S06's live Height Sheet height, or null in Experience. */
		heightMeters = null,
		/** Shown while the Sheet is active (plus its one-second tail). */
		heightPlaneVisible = false
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
		/** The viewer's per-view Paper tones (⚙ view preferences, never authored). */
		paperInk2d?: string;
		paperInk3d?: string;
		/** Grid/Snap view state. It is never a pick source or a Camera mode. */
		drafting?: StageDraftingState;
		/** Layout ∪ Scene datum bounds for Paper's bounded sheet. */
		contentBounds?: GridRect | null;
		/** Layout ∪ Scene world bounds for the snapshot host's depth range. */
		snapshotBounds?: { readonly min: readonly [number, number, number]; readonly max: readonly [number, number, number] } | null;
		/** Experience review 1 (R5) — the environment the Stage shows (already `paper` while editing on Paper). */
		environment?: SceneEnvironmentPreset;
		/** A Look-through capture frame in Stage-local CSS; null draws the whole Stage. */
		framedViewport?: { readonly left: number; readonly top: number; readonly width: number; readonly height: number } | null;
		/** The level datum the mat ground sits at. */
		datumMeters?: number;
		/** Canonical primary selection and pointer hover; ink is Stage-owned. */
		selection?: StageSelectionEntry | null;
		hover?: StageSelectionEntry | null;
		/** R217.S10: the armed Eraser draws its winner in red dashes instead of hover. */
		hoverTone?: 'hover' | 'erase';
		scenePick: ScenePickSource;
		heightMeters?: number | null;
		heightPlaneVisible?: boolean;
	} = $props();

	/** One footprint projection per accepted Scene snapshot, shared with the hit path. */
	const footprints = $derived(planSceneFootprintsFor(scene, scene.modelFootprints));
	// Use the same reveal for the sheet, grid, ink and Camera mask. Keep the
	// shaded world available until the complete Paper drawing can cover it.
	const paperReveal = $derived(
		framedViewport === null && plan !== null ? paperRevealFor(evaluation, planAppearance) : null
	);
	const paperVisible = $derived(paperReveal !== null && isPaperPlanVisible(evaluation, planAppearance));
	const paperCovers = $derived(paperVisible && paperReveal?.poche === 1);
	const matVisible = $derived(!paperCovers);
	/** Stable identity: an inline predicate would rebuild the Paper drawing every frame. */
	const footprintMounted = (entityId: string): boolean => scenePick.hasPickableBody(entityId);
	/**
	 * R217.S06's quiet cut-plane cue: a neutral sheet at `datum + height`, spanning
	 * the Layout bounds. It is drawn only while the Sheet is active, carries no
	 * depth write and is never a pick root; it is not the future Slice's yellow
	 * inspection or cut-away.
	 */
	const heightPlane = $derived.by(() => {
		if (!heightPlaneVisible || heightMeters === null || geometry.bounds === null) return null;
		const { min, max } = geometry.bounds;
		return {
			center: [
				(min[0] + max[0]) / 2,
				datumMeters + heightMeters,
				(min[2] + max[2]) / 2
			] as [number, number, number],
			size: [Math.max(0.1, max[0] - min[0]), Math.max(0.1, max[2] - min[2])] as [number, number]
		};
	});
	// Both readings and appearances honor the same Grid toggle.
	const gridVisible = $derived(drafting.grid && framedViewport === null);

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
		entityRenderRevision += 1;
		scenePick.refresh();
	}
	/** A Scene root or lazy body arriving or leaving changes what Paper may draw. */
	let sceneRootRevision = $state(0);
	const environmentShown = $derived(environment !== 'paper' && !paperCovers);
	const workspace = $derived(workspaceRectFor(contentBounds));
	const shadowBounds = $derived({
		min: [workspace.minX, Math.min(datumMeters, snapshotBounds?.min[1] ?? datumMeters), workspace.minZ] as const,
		max: [workspace.maxX, Math.max(datumMeters, snapshotBounds?.max[1] ?? datumMeters), workspace.maxZ] as const
	});
	let entityRenderRevision = $state(0);
	/** A model/form renderer has mounted geometry for already-registered roots. */
	function entityRendererReady(): void {
		entityRenderRevision += 1;
		scenePick.refresh();
	}
	function registerSceneRoot(id: string, root: import('three').Object3D): () => void {
		const unregister = scenePick.register(id, root);
		sceneRootRevision += 1;
		// A primitive mounts in the same render as its root; a model's fallback can
		// still mount on the next frame. Ask once more after children settle.
		const frame = requestAnimationFrame(() => {
			sceneRootRevision += 1;
			scenePick.refresh();
		});
		return () => {
			cancelAnimationFrame(frame);
			unregister();
			sceneRootRevision += 1;
		};
	}
</script>

<Canvas createRenderer={(canvas) => perfRenderer(createManagedWebGLRenderer(canvas, { stencil: true }), 'stage')} dpr={[1, 1.5]} shadows={PCFShadowMap}>
	<!--
		PLATE's two Paper materials: the light vellum while Paper draws, the dark cutting
		mat for the model, applied by the Camera's appearance realizer. No fog: the mat is
		a measured ground, not an atmospheric room.
	-->
	{#if environmentShown}
		<!-- R5: the World's environment replaces the neutral lights, and the mat outside the plate. -->
		<T.AmbientLight intensity={0.12} />
		<WorldEnvironment preset={environment} bounds={snapshotBounds} {shadowBounds} groundY={datumMeters} flatGround />
	{:else}
		<T.AmbientLight intensity={0.35} />
		<!-- Neutral illumination only: a cast shadow comes from an authored light. -->
		<T.DirectionalLight position={[6, 12, 8]} intensity={1.1} />
		<T.DirectionalLight position={[-8, 6, -6]} intensity={0.35} />
	{/if}
	<StageCamera {evaluation} paperVisible={paperCovers} paperInk={paperInk2d} frameViewport={framedViewport} worldOnly={framedViewport !== null} environmentSky={environmentShown} />
	{#if evaluation !== null && matVisible}
		<!--
			The mat ground and its per-pixel grid: world-anchored, occluded by walls,
			never a registered pick root. Under an environment the bounded plate and
			its grid stay; the environment's ground and horizon replace the mat around it.
		-->
		<StageMatGround
			{evaluation}
			{datumMeters}
			{gridVisible}
			{contentBounds}
			plateInk={paperInk3d}
			litPlate={environmentShown ? (worldEnvironmentLook(environment)?.plate ?? null) : null}
		/>
	{/if}
	{#if heightPlane !== null && !paperVisible && framedViewport === null}
		<!-- A quiet neutral tint at the cut, never yellow or gold and never picked. -->
		<T.Mesh
			position={heightPlane.center}
			rotation={[-Math.PI / 2, 0, 0]}
			renderOrder={1}
		>
			<T.PlaneGeometry args={heightPlane.size} />
			<T.MeshBasicMaterial color={0xf3f4ee} transparent opacity={0.12} depthWrite={false} />
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
		<!-- The mat is the Stage's ground; the visitor plinth would show through it (R217.S19). -->
		<VisitorLayoutShell {geometry} {presentation} plinth={false} />
	</T.Group>
	<StageEntities
		{scenePick}
		{scene}
		{rooms}
		{modelUrls}
		onFormRendererReady={formRendererReady}
		onEntityRenderable={entityRendererReady}
		onEntityRoot={registerSceneRoot}
	/>
	{#if paperReveal !== null && gridVisible}
		<StageGrid {evaluation} {datumMeters} {contentBounds} fade={paperReveal.sheet} />
	{/if}
	{#if framedViewport === null && paperReveal !== null && plan !== null && evaluation !== null}
		<!-- Paper's drawing shares the same Plan and Scene footprints as the pick providers. -->
		<StagePaper
			{plan}
			compiled={geometry}
			{footprints}
			width={evaluation.rect.width}
			height={evaluation.rect.height}
			reveal={paperReveal}
			isFootprintMounted={footprintMounted}
			{datumMeters}
			{selection}
			{hover}
			{hoverTone}
			revision={sceneRootRevision + entityRenderRevision}
		/>
	{/if}
	{#if !paperVisible}
		{#if framedViewport === null}
		<!--
			Selection and hover ink on the mat: the same accepted meshes, gold for the
			selected identity and quiet neutral for hover. It is a Canvas child, never a
			pick root, and lives on the Stage overlay layer so raycasting cannot hit it.
			Paper re-strokes the same identity on the drawing instead; the two never run
			together, and neither writes `Object3D.visible` for appearance.
		-->
		<StageSelectionLayer
			eye={evaluation ? [evaluation.inverseViewMatrix[12]!, evaluation.inverseViewMatrix[13]!, evaluation.inverseViewMatrix[14]!] : [0, 10, 10]}
			{selection}
			{hover}
			{hoverTone}
			{geometry}
			{scenePick}
			width={evaluation?.rect.width ?? 1}
			height={evaluation?.rect.height ?? 1}
			fade={1 - (paperReveal?.sheet ?? 0)}
		/>
		{/if}
	{/if}
	<!--
		Proposed-pose ghosts: the object's own shape at the captured pose, translucent
		and depth-write-free so the accepted body stays readable underneath. They are
		one more child of the same Canvas — never a second renderer or scene.
	-->
	{#if framedViewport === null && !paperVisible}
		{#each ghosts as ghost (ghost.id)}
			{#if ghost.shape.kind === 'form'}
				<StageFormGhost
					metersPerCssPixel={evaluation?.targetPlaneMetersPerCssPixel ?? 0.01}
					form={ghost.shape.form}
					position={ghost.center}
					yaw={ghost.yaw}
					treatment={ghost.treatment}
				/>
			{:else}
				<StagePrimitiveGhost metersPerCssPixel={evaluation?.targetPlaneMetersPerCssPixel ?? 0.01} ghost={{ ...ghost, shape: ghost.shape }} />
			{/if}
		{/each}
	{/if}
	<!--
		R217.S28 — the Experience snapshot host: the same renderer, an offscreen target,
		and the authored View pose evaluated by Camera. It renders no frame of its own
		until a visible slot asks.
	-->
	<StageSnapshotRenderer
		revision={sceneRootRevision + entityRenderRevision}
		bounds={snapshotBounds}
		environment={environmentShown ? environment : 'paper'}
	/>
</Canvas>
