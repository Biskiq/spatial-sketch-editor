<script lang="ts">
	import CanvasHost from '$lib/render/CanvasHost.svelte';
	import { perfMark } from '$lib/platform/perf-marks';
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
	 * a boolean `shadows`. Tone mapping is named for the same reason: Threlte would
	 * otherwise apply its `AgXToneMapping` default, and Gate A accepted
	 * `NoToneMapping` (see `CANVAS_TONE_MAPPING`).
	 */
	import { T } from '@threlte/core';
	import type { Object3D, Plane } from 'three';
	import {
		createStageClip,
		setStageClip
	} from '$lib/authoring/stage/slice/stage-clip';
	import type { ResolvedSlice } from '$lib/authoring/stage/slice/slice-cut';
	import type { SectionInput } from '$lib/authoring/stage/slice/mesh-plane-section';
	import StageSliceLayer from './StageSliceLayer.svelte';
	import StageCutawayLayer from '../cutaway/StageCutawayLayer.svelte';
	import StageClipPlanes from './StageClipPlanes.svelte';
	import { onDestroy } from 'svelte';
	import { provideRenderResources } from '$lib/render/resources/render-resources';
	import type { CompiledLayoutGeometry, OverheadSource, PlanEvaluation } from '@portfolio/layout-core';
	import type { RuntimeScene } from '@portfolio/project-model';
	import type { ViewportEvaluation } from '@portfolio/camera-core';
	import VisitorLayoutShell from '$lib/visitor/VisitorLayoutShell.svelte';
	import type { ScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import type { StageGhostMesh } from '$lib/authoring/stage/stage-facade';
	import type { StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
	import { planSceneFootprintsFor } from '$lib/authoring/scene/plan-scene-footprint';
import { paperStageComposition, PAPER_GROUND_INK } from '../paper-plan';
import { workspaceRectFor } from '../stage-grid';
import { STAGE_DRAFTING_DEFAULTS, type StageDraftingState } from '../stage-drafting';
import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
import StageCamera from './StageCamera.svelte';
import StageGrid from './StageGrid.svelte';
import StageMatGround from './StageMatGround.svelte';
	import StageArtworkGhost from './StageArtworkGhost.svelte';
	import type { ArtworkScope } from '$lib/render/artwork/artwork-scope';
	import type { TextureLoadScope } from '$lib/render/resources/texture-store';
	import type { SceneArtworkEntity } from '@portfolio/project-model';
	import StageEntities from './StageEntities.svelte';
	import StageStudioMute from './StageStudioMute.svelte';
	import StageFormGhost from './StageFormGhost.svelte';
	import StagePrimitiveGhost from './StagePrimitiveGhost.svelte';
	import StagePaper from './StagePaper.svelte';
	import StageLiftLayer from './StageLiftLayer.svelte';
	import StageOpenSideLayer from './StageOpenSideLayer.svelte';
	import StageSelectionLayer from './StageSelectionLayer.svelte';
	import StageRepairLayer from './StageRepairLayer.svelte';
	import type { FinishOutcomeSink } from '$lib/render/resources/finish-outcome-sink';
	import { ghostSubjectOf, selectionObjectsOf } from './stage-selection-source';
	import { subjectWhollyHidden } from '../slice/slice-ghost';
	import StageWallDevelopment from './StageWallDevelopment.svelte';
	import StageWallPin from './StageWallPin.svelte';
	import StageCelestialDial from './StageCelestialDial.svelte';
	import type { CelestialDialModel } from '../../look/celestial-dial';
	import StageShadowTriggers from './StageShadowTriggers.svelte';
	import StageSnapshotRenderer from './StageSnapshotRenderer.svelte';
	import FinishTileRenderer from './FinishTileRenderer.svelte';
	import WorldEnvironment from '$lib/render/WorldEnvironment.svelte';
	import { STAGE_NEUTRAL_AMBIENT_INTENSITY, STAGE_NEUTRAL_DIRECTIONALS } from '$lib/render/stage-neutral-lighting';
	import { sunShadowKey, worldEnvironmentLook } from '$lib/render/world-environment';
	import type { SceneSky } from '@portfolio/project-model/units';
	import type { GridRect } from '../stage-grid';
	import {
		LIGHT_PREVIEW_CANDIDATE_ID,
		mergeLightPreview,
		type StageLightPreview
	} from '../stage-light-preview.svelte';

	function ignoreRaycast(): void {}


	let {
		geometry,
		sourceContentId,
		layoutRevision,
		scene,
		/** The session-only light preview merged into the rendered entity list. */
		lightPreview = null,
		evaluation,
		ghosts = [],
		modelUrls = null,
		textureScope = null,
		textureRevision = 0,
		artworkScope = null,
		artworkGhost = null,
		onArtworkError,
		plan = null,
		planAppearance = 'paper',
		paperInk2d = PAPER_GROUND_INK,
		paperInk3d = PAPER_GROUND_INK,
		/** The one Grid/Snap view state; the grid is display-only. */
		drafting = STAGE_DRAFTING_DEFAULTS,
		/** Layout ∪ Scene datum bounds; Paper's grid draws a bounded sheet. */
		contentBounds = null,
		snapshotBounds = null,
		sky = null,
		framedViewport = null,
		/** The live candidate's extent; the sheet grows to include it. */
		datumMeters = 0,
		selection = null,
		hover = null,
		hoverTone = 'hover',
		proposals = [],
		scenePick,
		/** The Stage's captured pointer ids, read before a renderer generation retires. */
		capturedPointers = null,
		/**
		 * Display-only session overlay: the Rooms a Lift reading has lifted. Preview
		 * is a separate Canvas and never passes it. `VisitorPreviewSurface` does not
		 * even mount this component.
		 */
		liftedRoomIds = [],
		liftedRegionIds = [],
		/** The overheads a Lift reading lifts, as Layout names them (display-only). */
		liftSources = [],
		dial = null,
		/** The live Height Sheet height, or null in Experience. */
		heightMeters = null,
		/** Shown while the Sheet is active (plus its one-second tail). */
		heightPlaneVisible = false,
		unfoldPinHovered = false,
		unfoldPinActive = false,
		unfoldAnchorPin = null,
		resolvedSlice = null,
		sliceDraft = null,
		cutawayWallIds = [],
		cutawayStubTopY = null,
		alignHiddenWallIds = [],
		onCutawayFailure,
		studio = null,
		onFinishOutcome,
		repairAffectedTargets
	}: {
		geometry: CompiledLayoutGeometry;
		sourceContentId: string;
		layoutRevision: string;
		scene: RuntimeScene;
		lightPreview?: StageLightPreview | null;
		evaluation: ViewportEvaluation | null;
		/** Adapter-proposed poses, drawn here by the one Canvas. */
		ghosts?: readonly StageGhostMesh[];
		/** Resolved approved creator-model bytes, owned by the route's session. */
		modelUrls?: ReadonlyMap<string, string> | null;
		/** The route's authenticated project texture scope (S4b). */
		textureScope?: TextureLoadScope | null;
		/** Bumped by a targeted texture Retry. */
		textureRevision?: number;
		artworkScope?: ArtworkScope | null;
		artworkGhost?: SceneArtworkEntity | null;
		onArtworkError?: (message: string) => void;
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
		/** The Sky the Stage shows; `null` is Paper (and is what editing on Paper passes). */
		sky?: SceneSky | null;
		/** A Look-through capture frame in Stage-local CSS; null draws the whole Stage. */
		framedViewport?: { readonly left: number; readonly top: number; readonly width: number; readonly height: number } | null;
		/** The level datum the mat ground sits at. */
		datumMeters?: number;
		/** Canonical primary selection and pointer hover; ink is Stage-owned. */
		selection?: StageSelectionEntry | null;
		hover?: StageSelectionEntry | null;
		/** The armed Eraser draws its winner in red dashes instead of hover. */
		hoverTone?: 'hover' | 'erase' | 'paint';
		/** Finish Card reach proposals, inked in cobalt beside the selection. */
		proposals?: readonly StageSelectionEntry[];
		dial?: CelestialDialModel | null;
		scenePick: ScenePickSource;
		capturedPointers?: (() => readonly number[]) | null;
		liftedRoomIds?: readonly string[];
		liftedRegionIds?: readonly string[];
		liftSources?: readonly OverheadSource[];
		heightMeters?: number | null;
		heightPlaneVisible?: boolean;
		/** The sheet pin is hovered or being dragged; the route owns both. */
		unfoldPinHovered?: boolean;
		unfoldPinActive?: boolean;
		/** The idle pin shown on a selected curved Wall, before Unroll. */
		unfoldAnchorPin?: readonly [number, number, number] | null;
		/**
		 * The live Slice reading, or null. The Canvas owns the one clip instance and
		 * applies this to it; Preview is a separate Canvas and never passes it.
		 */
		resolvedSlice?: ResolvedSlice | null;
		/** The live drawn proposal, before it commits to the reading. */
		sliceDraft?: { readonly start: readonly [number, number, number]; readonly end: readonly [number, number, number] } | null;
		/**
		 * X2's effective cut set and stub height. Display-only session state: Preview
		 * is a separate Canvas that never passes them, so a release is as built.
		 */
		cutawayWallIds?: readonly string[];
		cutawayStubTopY?: number | null;
		/**
		 * Wall Align (T2.S8 U6): the Walls in front of the faced side, hidden for the
		 * session so nothing covers the surface being aligned. Display-only, never authored.
		 */
		alignHiddenWallIds?: readonly string[];
		/** Walls whose cap component failed; the route closes them to whole (D12). */
		onCutawayFailure?: (wallIds: readonly string[]) => void;
		/**
		 * Object Studio's display posture, or null. `mat` draws only the scoped root on the
		 * bare mat (the Layout shell and every other entity are unmounted, so they cannot
		 * be hit); `world` keeps the room drawn but quiet. Display only: the pick scope is
		 * set separately on the facade, and nothing here writes source.
		 */
		studio?: { readonly rootId: string | null; readonly context: 'world' | 'mat' } | null;
		/** Optional Stage-only sink for sampled Finish view outcomes (U6 Repair). */
		onFinishOutcome?: FinishOutcomeSink;
		/** Union of open appearance issues' affected target keys (U6 Repair hatch). */
		repairAffectedTargets?: ReadonlySet<string>;
	} = $props();

	/**
	 * One render-resource owner for this Canvas.
	 *
	 * The Layout shell and the Scene entity representation are siblings, so the
	 * stores live with the Canvas they belong to: equal looks and equal geometry
	 * are shared across both families, and no WebGL object can cross into another
	 * Canvas. The shell and the representation release their leases when they are
	 * destroyed; the stores free anything left here.
	 */
	/**
	 * The Canvas's one clip: created **before** the render resources, so the material
	 * store is born holding this exact array by reference. The array length never
	 * changes, so entering, dragging and leaving a Slice never recompiles a program.
	 */
	const stageClip = setStageClip(createStageClip());
	const resources = provideRenderResources({
		clippingPlanes: stageClip.planes as Plane[],
		clipMasks: (cutaway) => stageClip.clipMasks(cutaway)
	});
	onDestroy(() => resources.dispose());
	/**
	 * The selected subject **when the cut hides all of it**, or null.
	 *
	 * The Index can select anything, including a body the Slice removes from the frame
	 * entirely (a ceiling light above the cut). That selection must stay visible and
	 * editable, so the Slice layer draws it as a ghost and the selection ink draws its
	 * gold contour unclipped (§2.4). A partly cut subject is **not** ghosted: its stub
	 * and cap are visible and pickable already.
	 *
	 * Recomputed on selection, reading or geometry change only — `subjectWhollyHidden`
	 * walks the subject's own triangles, never the scene.
	 */
	const ghostSubject = $derived.by(() => {
		// A representation rebuild changes the drawn body without changing the object, so
		// the bake follows the revisions as well as the selection. Without these reads the
		// cached subject kept an outdated pose or classification after an edit.
		layoutRevision;
		sceneRootRevision;
		entityRenderRevision;
		if (selection === null || selection === undefined) return null;
		const objects = selectionObjectsOf(scenePick, selection);
		if (objects.length === 0) return null;
		const subject = ghostSubjectOf(objects);
		return subject === null ? null : { objects, subject };
	});
	/**
	 * Classification only. It reads `ghostSubject` (cached by Svelte against the
	 * selection and the drawn geometry), so a Sheet step re-runs one triangle test over
	 * the already-baked buffers instead of baking the subject again.
	 */
	const sliceGhostSelection = $derived.by((): readonly Object3D[] | null => {
		const cut = resolvedSlice ?? null;
		const subject = ghostSubject;
		if (cut === null || subject === null) return null;
		return subjectWhollyHidden(cut, subject.subject) ? subject.objects : null;
	});
	/** The selected Layout identity, for the section's gold edge (plan test 4). */
	const sliceSelectedIdentity = $derived(
		selection !== null &&
			selection !== undefined &&
			selection.reference.domain === 'layout' &&
			selection.reference.subject.kind !== 'room'
			? `${selection.reference.subject.kind}:${selection.reference.subject.id}`
			: null
	);
	/** The drawn meshes, as the caps section them; a mount or an edit is a new read. */
	const sectionInputs = $derived.by((): readonly SectionInput[] => {
		layoutRevision;
		sceneRootRevision;
		entityRenderRevision;
		return scenePick.sectionSources();
	});

	/** One footprint projection per accepted Scene snapshot, shared with the hit path. */
	const footprints = $derived(planSceneFootprintsFor(scene, scene.modelFootprints));
	/**
	 * The editor shell's one merge point for the session-only light preview: an
	 * overridden light is replaced by its preview value and a placement candidate
	 * is appended under a reserved id. Visitor entities and entity renderers are
	 * unchanged, and the accepted `scene` object is never mutated.
	 */
	const renderScene = $derived(mergeLightPreview(scene, lightPreview));
	// A live Artwork manipulation draws one opaque ghost; the accepted body is
	// hidden so the drag never shows two copies of the same Artwork.
	const entityScene = $derived(
		artworkGhost === null || !renderScene.entities.some((entity) => entity.id === artworkGhost.id)
			? renderScene
			: { ...renderScene, entities: renderScene.entities.filter((entity) => entity.id !== artworkGhost.id) }
	);
	/** The architectural shell's group: Studio's World context mutes it like the other bodies. */
	let layoutGroup = $state.raw<Object3D | null>(null);
	/** The Studio mat unmounts everything but the scoped root: unmounted roots cannot be picked. */
	const matStudio = $derived(studio?.context === 'mat');
	const drawnScene = $derived(
		matStudio
			? { ...entityScene, entities: entityScene.entities.filter((entity) => entity.id === studio?.rootId) }
			: entityScene
	);
	// One reveal for the sheet, grid, ink and Camera mask (see `paperStageComposition`).
	const paperComposition = $derived(
		paperStageComposition({ evaluation, appearance: planAppearance, framed: framedViewport !== null, hasPlan: plan !== null })
	);
	/** The display sheet owns the canonical body while a Wall is unfolded. */
	const unfoldedWallId = $derived(wallUnfold.state?.wallId ?? null);
	/**
	 * A lifted overhead is selected through its Room, so the Lift ink reads the same
	 * subject a floor click selects. No ceiling-specific selection exists in X1.
	 */
	const liftSelectedRoomId = $derived(
		selection !== null &&
			selection.reference.domain === 'layout' &&
			(selection.reference.subject.kind === 'room' || selection.reference.subject.kind === 'region')
			? selection.reference.subject.id
			: null
	);
	const liftHoveredRoomId = $derived(
		hover !== null &&
			hover.reference.domain === 'layout' &&
			(hover.reference.subject.kind === 'room' || hover.reference.subject.kind === 'region')
			? hover.reference.subject.id
			: null
	);
	/** The compiled virtual boundaries the open-side ink draws; no authored re-composition. */
	const openSideSources = $derived(
		geometry.rooms
			.filter((room) => (room.openSides?.length ?? 0) > 0)
			.map((room) => ({
				roomId: room.roomId,
				elevation: room.floorElevation,
				edges: room.openSides ?? []
			}))
	);
	const paperReveal = $derived(paperComposition.reveal);
	const paperVisible = $derived(paperComposition.visible);
	const paperCovers = $derived(paperComposition.covers);
	const matVisible = $derived(!paperCovers);
	/** Stable identity: an inline predicate would rebuild the Paper drawing every frame. */
	const footprintMounted = (entityId: string): boolean => scenePick.hasPickableBody(entityId);
	/**
	 * The quiet cut-plane cue: a neutral sheet at `datum + height`, spanning
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
	const environmentShown = $derived(sky !== null && sky.preset !== 'studio' && !paperCovers);
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

<CanvasHost surface="stage" {capturedPointers}>
	{#snippet children()}
	<!-- The one writer of the shared planes, and the frame request that follows. -->
	<StageClipPlanes clip={stageClip} reading={resolvedSlice ?? null} />
	<!--
		PLATE's two Paper materials: the light vellum while Paper draws, the dark cutting
		mat for the model, applied by the Camera's appearance realizer. No fog: the mat is
		a measured ground, not an atmospheric room.
	-->
	{#if environmentShown}
		<!-- The World's environment replaces the neutral lights, and the mat outside the plate. -->
		<WorldEnvironment {sky} bounds={snapshotBounds} {shadowBounds} groundY={datumMeters} flatGround />
	{:else}
		<T.AmbientLight intensity={STAGE_NEUTRAL_AMBIENT_INTENSITY} />
		<!-- Neutral illumination only: a cast shadow comes from an authored light. -->
		{#each STAGE_NEUTRAL_DIRECTIONALS as neutral (neutral.position.join(','))}
			<T.DirectionalLight position={[...neutral.position]} intensity={neutral.intensity} />
		{/each}
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
			litPlate={environmentShown ? (worldEnvironmentLook(sky)?.plate ?? null) : null}
		/>
	{/if}
	{#if heightPlane !== null && !paperVisible && framedViewport === null && resolvedSlice === null}
		<!-- A quiet neutral tint at the cut, never yellow or gold and never picked. -->
		<T.Mesh
			position={heightPlane.center}
			rotation={[-Math.PI / 2, 0, 0]}
			renderOrder={1}
		>
			<T.PlaneGeometry args={heightPlane.size} />
			<T.MeshBasicMaterial fog={false} color={0xf3f4ee} transparent opacity={0.12} depthWrite={false} />
		</T.Mesh>
	{/if}
	<!--
		The Stage's shadow maps are rendered when their own
		dependencies change, not on every frame. Mounted inside this one Canvas
		because it owns this renderer's shadow map; see the component for the full
		trigger contract.
	-->
	<!-- The preview projection is a shadow trigger too: an overridden or candidate
		light must move its cast shadow with its illumination. -->
	{#if dial}<StageCelestialDial {dial} />{/if}
	<StageShadowTriggers sunKey={sunShadowKey(environmentShown ? worldEnvironmentLook(sky) : null, { bounds: snapshotBounds, shadowBounds, groundY: datumMeters, flatGround: true })} {geometry} {scene} {lightPreview} {modelUrls} {formRenderRevision} />
	{#if !matStudio}
	<T.Group oncreate={(group) => {
		layoutGroup = group;
		const release = scenePick.registerLayout(group);
		return () => { if (layoutGroup === group) layoutGroup = null; release?.(); };
	}}>
		<!-- The mat is the Stage's ground; the visitor plinth would show through it. -->
		<VisitorLayoutShell {geometry} {scene} textureScope={textureScope} plinth={false} doorFrames={false}
			{textureRevision}
			treatment={scene.environment?.treatment}
			hiddenWallIds={unfoldedWallId === null ? alignHiddenWallIds : [unfoldedWallId, ...alignHiddenWallIds]}
			{liftedRoomIds}
			{liftedRegionIds}
			{cutawayWallIds}
			{onFinishOutcome}
			onIdentity={scenePick.registerLayoutIdentity} />
	</T.Group>
	{/if}
	<!-- The unfolded Wall's own developed body. It is a Canvas child,
		not a second scene, and never a registered pick root. -->
	<StageWallDevelopment {geometry} {datumMeters} {layoutRevision}
		selected={selection?.reference.domain === 'layout' && selection.reference.subject.kind === 'wall' &&
			selection.reference.subject.id === unfoldedWallId}
		pinHovered={unfoldPinHovered}
		pinActive={unfoldPinActive} />
	{#if unfoldedWallId === null && unfoldAnchorPin !== null}
		<StageWallPin position={unfoldAnchorPin} hovered={unfoldPinHovered} active={unfoldPinActive} />
	{/if}
	{#if artworkGhost !== null}
		<StageArtworkGhost entity={artworkGhost} scope={artworkScope} onError={onArtworkError} />
	{/if}
	{#if studio?.context === 'world'}
		<StageStudioMute
			{scenePick}
			entityIds={entityScene.entities.map((entity) => entity.id)}
			scopedId={studio.rootId}
			contextRoots={layoutGroup === null ? [] : [layoutGroup]}
			revision={`${layoutRevision}:${sceneRootRevision + entityRenderRevision}`}
		/>
	{/if}
	<StageEntities
		{textureScope}
		{textureRevision}
		{artworkScope}
		{onArtworkError}
		{scenePick}
		scene={drawnScene}
		{modelUrls}
		{onFinishOutcome}
		includeLights={sky !== null}
		onFormRendererReady={formRendererReady}
		onEntityRenderable={entityRendererReady}
		onEntityRoot={(id, root) =>
			// The placement candidate renders, but it is not an authored or pickable
			// entity: keep it out of the Stage pick registry.
			id === LIGHT_PREVIEW_CANDIDATE_ID ? () => {} : registerSceneRoot(id, root)}
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
			{resolvedSlice}
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
			{cutawayWallIds}
			{selection}
			{hover}
			{hoverTone}
			{proposals}
			{geometry}
			{scenePick}
			width={evaluation?.rect.width ?? 1}
			height={evaluation?.rect.height ?? 1}
			fade={1 - (paperReveal?.sheet ?? 0)}
			unclippedSelection={sliceGhostSelection !== null}
		/>
		{#if repairAffectedTargets && repairAffectedTargets.size > 0}
			<StageRepairLayer
				affectedTargets={repairAffectedTargets}
				{scenePick}
				revision={`${layoutRevision}:${sceneRootRevision + entityRenderRevision}`}
			/>
		{/if}
		{/if}
	{/if}
	{#if !paperVisible && framedViewport === null}
		<!--
			The Slice's own ink: the yellow plane, the depth outline and the section caps.
			Overlay-layer editor ink, never a pick root, never in a snapshot.
		-->
		<StageSliceLayer
			resolved={resolvedSlice ?? null}
			inputs={sectionInputs}
			bounds={geometry.bounds ?? null}
			revision={`${layoutRevision}:${sceneRootRevision + entityRenderRevision}`}
			ghostSelection={sliceGhostSelection}
			selectedIdentity={sliceSelectedIdentity}
			width={evaluation?.rect.width ?? 0}
			height={evaluation?.rect.height ?? 0}
			draft={sliceDraft}
		/>
		<!--
			X2's cutaway ink: the live stub top and its paper caps. Overlay-layer
			editor ink, never a pick root and never in a snapshot.
		-->
		<StageCutawayLayer
			wallIds={cutawayWallIds}
			stubTopY={cutawayStubTopY}
			junctions={geometry.junctions ?? []}
			walls={geometry.walls ?? []}
			floors={geometry.floors}
			inputs={sectionInputs}
			revision={`${layoutRevision}:${sceneRootRevision + entityRenderRevision}`}
			sliceCutY={resolvedSlice?.kind === 'level' ? resolvedSlice.cutY : null}
			width={evaluation?.rect.width ?? 0}
			height={evaluation?.rect.height ?? 0}
			onFailure={onCutawayFailure}
		/>
	{/if}
	{#if framedViewport === null && evaluation !== null}
		<!--
			The lifted overheads' dashed outlines, and the selected one's ghost. Editor
			ink on the overlay layer: never a pick root, never lit, never in a snapshot.
			It draws nothing in Plan and is absent from a Look-through capture frame.
		-->
		<StageLiftLayer
			sources={liftSources}
			selectedRoomId={liftSelectedRoomId}
			hoveredRoomId={liftHoveredRoomId}
			width={evaluation.rect.width}
			height={evaluation.rect.height}
			reading={evaluation.renderedReading}
		/>
		<!--
			Open sides are dashed in Plan and, in 3D, only for the selected Space.
			They are virtual boundaries: editor ink, never a pick root.
		-->
		<StageOpenSideLayer
			sources={openSideSources}
			selectedRoomId={liftSelectedRoomId}
			width={evaluation.rect.width}
			height={evaluation.rect.height}
			reading={evaluation.renderedReading}
		/>
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
		The Experience snapshot host: the same renderer, an offscreen target,
		and the authored View pose evaluated by Camera. It renders no frame of its own
		until a visible slot asks.
	-->
	<StageSnapshotRenderer
		revision={sceneRootRevision + entityRenderRevision}
		bounds={snapshotBounds}
		environment={environmentShown && sky ? JSON.stringify(sky) : 'paper'}
	/>
	<!-- The Finish picture host: the E7 inspection host on this renderer, drawing only when a shelf asks. -->
	<FinishTileRenderer />
	{/snippet}
</CanvasHost>
