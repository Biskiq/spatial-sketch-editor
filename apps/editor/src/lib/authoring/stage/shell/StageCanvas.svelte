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
import { isPaperPlanVisible, MAT_GROUND_INK } from '../paper-plan';
import { gridIsVisible, matGroundFor } from '../stage-grid';
import { STAGE_DRAFTING_DEFAULTS, type StageDraftingState } from '../stage-drafting';
import StageCamera from './StageCamera.svelte';
import StageGrid from './StageGrid.svelte';
	import StageEntities from './StageEntities.svelte';
	import StageFormGhost from './StageFormGhost.svelte';
	import StagePrimitiveGhost from './StagePrimitiveGhost.svelte';
	import StagePaper from './StagePaper.svelte';
	import StageSelectionLayer from './StageSelectionLayer.svelte';
	import StageShadowTriggers from './StageShadowTriggers.svelte';
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
		/** R217.S05's one Grid/Snap view state; the grid is display-only. */
		drafting = STAGE_DRAFTING_DEFAULTS,
		/** Layout ∪ Scene datum bounds; Paper's grid draws a bounded sheet. */
		contentBounds = null,
		/** R217.S14 — the live candidate's extent; the sheet grows to include it. */
		candidateBounds = null,
		reducedMotion = false,
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
		/** Grid/Snap view state. It is never a pick source or a Camera mode. */
		drafting?: StageDraftingState;
		/** Layout ∪ Scene datum bounds for Paper's bounded sheet. */
		contentBounds?: GridRect | null;
		/** The live candidate's extent, added to Paper's sheet only. */
		candidateBounds?: GridRect | null;
		reducedMotion?: boolean;
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
	const paperVisible = $derived(isPaperPlanVisible(evaluation, planAppearance));
	/** The mat ground is the Stage's own surface in both mesh readings; Paper hides it. */
	const matVisible = $derived(!paperVisible);
	/** Stable identity: an inline predicate would rebuild the Paper drawing every frame. */
	const footprintMounted = (entityId: string): boolean => scenePick.hasPickableBody(entityId);
	/** R217.S19 — the finite mat, sized and centred from the Camera's ground reach. */
	const matGround = $derived.by(() => {
		if (evaluation === null) return null;
		const ground = matGroundFor(evaluation, datumMeters);
		const size = 2 * ground.halfExtentMeters;
		return {
			position: [ground.centerXZ[0], datumMeters - 0.004, ground.centerXZ[1]] as [number, number, number],
			scale: [size, size, 1] as [number, number, number]
		};
	});
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
	/**
	 * Grid visibility is one fact on both surfaces: under a Grid-off state, and in
	 * Shaded Plan it is never drawn. The mat keeps its grid in shaded 3D.
	 */
	const gridVisible = $derived(
		gridIsVisible({
			grid: drafting.grid,
			appearance: planAppearance,
			renderedReading: evaluation?.renderedReading ?? null
		})
	);

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
	{#if evaluation !== null && gridVisible && matVisible}
		<!-- The mat's grid is world geometry on the datum; walls occlude it. -->
		<StageGrid
			{evaluation}
			surface="mat"
			{datumMeters}
			{contentBounds}
		/>
	{/if}
	{#if matVisible && matGround !== null}
		<!--
			The mat ground gives depth and shadows; it is not a registered pick root. Its
			polygon offset pushes it behind the grid lifted above it, so far ground keeps
			its lines instead of fighting them in the depth buffer.
		-->
		<T.Mesh position={matGround.position} scale={matGround.scale} rotation={[-Math.PI / 2, 0, 0]}>
			<T.PlaneGeometry args={[1, 1]} />
			<T.MeshStandardMaterial
				color={MAT_GROUND_INK}
				roughness={1}
				metalness={0}
				polygonOffset
				polygonOffsetFactor={1}
				polygonOffsetUnits={1}
			/>
		</T.Mesh>
	{/if}
	{#if heightPlane !== null && !paperVisible}
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
		<VisitorLayoutShell {geometry} {presentation} />
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
	{#if paperVisible && plan !== null && evaluation !== null}
		<!--
			The Plan is a drawing on Paper: the same Plan evaluation the Layout pick
			provider reads, and the same Scene footprints the Scene pick reads.
		-->
		{#if gridVisible && evaluation !== null}
			<!-- Paper's grid is overlay ink beneath the drawing, on the same sheet. -->
			<StageGrid
				{evaluation}
				surface="paper"
				{datumMeters}
				{contentBounds}
				{candidateBounds}
			/>
		{/if}
		<StagePaper
			{plan}
			compiled={geometry}
			{footprints}
			width={evaluation.rect.width}
			height={evaluation.rect.height}
			instant={reducedMotion}
			isFootprintMounted={footprintMounted}
			{datumMeters}
			{selection}
			{hover}
			{hoverTone}
			revision={sceneRootRevision + entityRenderRevision}
		/>
	{/if}
	{#if !paperVisible}
		<!--
			Selection and hover ink on the mat: the same accepted meshes, gold for the
			selected identity and quiet neutral for hover. It is a Canvas child, never a
			pick root, and lives on the Stage overlay layer so raycasting cannot hit it.
			Paper re-strokes the same identity on the drawing instead; the two never run
			together, and neither writes `Object3D.visible` for appearance.
		-->
		<StageSelectionLayer
			{selection}
			{hover}
			{hoverTone}
			{geometry}
			{scenePick}
			width={evaluation?.rect.width ?? 1}
			height={evaluation?.rect.height ?? 1}
		/>
	{/if}
	<!--
		Proposed-pose ghosts: the object's own shape at the captured pose, translucent
		and depth-write-free so the accepted body stays readable underneath. They are
		one more child of the same Canvas — never a second renderer or scene.
	-->
	{#if !paperVisible}
		{#each ghosts as ghost (ghost.id)}
			{#if ghost.shape.kind === 'form'}
				<StageFormGhost
					form={ghost.shape.form}
					position={ghost.center}
					yaw={ghost.yaw}
					treatment={ghost.treatment}
				/>
			{:else}
				<StagePrimitiveGhost ghost={{ ...ghost, shape: ghost.shape }} />
			{/if}
		{/each}
	{/if}
</Canvas>
