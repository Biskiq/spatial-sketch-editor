<script lang="ts">
	/**
	 * The spatial route composition root.
	 *
	 * The route keeps only composition: boot, project epoch, Preview handover,
	 * source admission and the one ordered teardown. Presentation state machines,
	 * projections and the large Stage regions live with their owners:
	 *
	 * - `stage-selection-view` reads selection, Index, Source locator and Card;
	 * - `stage-contribution-view` reads Dock/Find/task/host-tool projections;
	 * - `stage-shell-state` owns disclosure, preferences, responsive and view state;
	 * - `stage-shell-commands` is the one named selection/task/tool/delete dispatch;
	 * - `stage-experience-binding` owns the route-local lens/View/Look Through wiring;
	 * - `StageProjectNotices`, `StageViewportRegion`, `StagePanels` and
	 *   `StageToolbars` own their DOM regions.
	 *
	 * Existing authorities are unchanged: the Stage facade/session, Camera, Canvas,
	 * EditorHead/Index/Card, Unfold, Artwork, Experience lens/controller, drafting
	 * and the Height Sheet remain exactly where they were.
	 */
	import { onDestroy, tick, untrack } from 'svelte';
	import { createFeatureLifecycle } from '$lib/authoring/workspace/lifecycle-runner';
	import { late, type FeatureLifecycle } from '$lib/authoring/workspace/protocol';
	import { page } from '$app/state';
	import { goto, replaceState } from '$app/navigation';
	import { env } from '$env/dynamic/public';
	import type { AppPreferences } from '$lib/platform/app-preferences';
	import { perfMark } from '$lib/platform/perf-marks';
	import { installPerfWorkObserver } from '$lib/platform/perf-work';
	import type { ProjectEnvelope } from '@portfolio/project-model/units';
	import type { ArtworkLibraryEntry, SceneArtworkEntity } from '@portfolio/project-model';
	import { primaryEntry, sameReference, type StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
	import type { StageDomainRead } from '$lib/authoring/stage/source-admission';
	import { createStageSession } from '$lib/authoring/stage/stage-session';
	import { createLightInspectionFeature } from '$lib/authoring/look/light-inspection-feature.svelte';
	import {
		createStageFacade,
		type StageFacade,
		type StageCardActionRecord,
		type StageCardWriterRecord
	} from '$lib/authoring/stage/stage-facade';
	import { createCoreRegionViews } from '$lib/authoring/stage/route/core-region-views';
	import type { RegionProps } from '$lib/authoring/workspace/region-ownership';
	import { createRouteInput } from '$lib/authoring/stage/route/route-input.svelte';
	import { createProjectReadyPort } from '$lib/authoring/stage/route/project-ready-port.svelte';
	import { createStageViewing } from '$lib/authoring/stage/route/stage-viewing';
	import { createStageContentBounds, readStageContentBounds } from '$lib/authoring/stage/route/stage-content-bounds.svelte';
	import { installLookThroughFrame } from '$lib/authoring/stage/route/look-through-frame.svelte';
	import { createStageHistoryCommand } from '$lib/authoring/stage/route/stage-history-command';
	import { createStageWindowListeners } from '$lib/authoring/stage/route/stage-window-listeners';
	import { createBootRepair } from '$lib/authoring/stage/route/boot-repair.svelte';
	import StageBootPanels from '$lib/authoring/stage/shell/StageBootPanels.svelte';
	import StageReplaceDialog from '$lib/authoring/stage/shell/StageReplaceDialog.svelte';
	import { readStageCursor } from '$lib/authoring/stage/route/stage-cursor';
	import { createCoreLifecycleSteps, installLeaveProject, installStageMount } from '$lib/authoring/stage/route/core-lifecycle-steps.svelte';
	import { createStageViewport } from '$lib/authoring/stage/route/stage-viewport.svelte';
	import { createStageArtworkInteraction } from '$lib/authoring/stage/route/stage-artwork-interaction.svelte';
	import { createStageUnfoldGestures, selectedCurvedWallOf } from '$lib/authoring/stage/route/stage-unfold-gestures.svelte';
	import { createStageInputArbiter } from '$lib/authoring/stage/route/stage-input.svelte';
	import { createStageKeyboard } from '$lib/authoring/stage/route/stage-keyboard';
	import { createStageLightPreview } from '$lib/authoring/stage/stage-light-preview.svelte';
	import { stageAdapterFactories } from '$lib/authoring/adapters/catalog';
	import { createStageMeasure, STAGE_MEASURE_TASK } from '$lib/authoring/stage/stage-measure';
	import { createStageEraser, STAGE_ERASER_TASK } from '$lib/authoring/stage/stage-eraser';
	import { createStageAssetLeases } from '$lib/authoring/stage/route/stage-asset-leases.svelte';
	import { provideFinishTiles } from '$lib/authoring/look/finish-tiles-provider';
	import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';
	import {
		analyzeModelDerivativeBytes,
		createModelAnalysisCache
	} from '$lib/render/materials/model-derivative-analysis';
	import { createVerifiedProjectImageCache } from '$lib/authoring/artwork/project-image-cache';
	import { createStageProjectEpoch } from '$lib/authoring/stage/route/stage-project-epoch.svelte';
	import {
		developmentPointAtStationFromBuffers,
		overheadSourcesOf,
		type PlanEvaluation
	} from '@portfolio/layout-core';
	import {
		eyeOfInspectionPose,
		fovYDegreesOf,
		type ViewportEvaluation,
		type ViewportRect
	} from '@portfolio/camera-core';
	import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
	import { wallFace } from '$lib/authoring/layout/wall-face-store';
	import {
		initialLiftScope,
		interiorLift
	} from '$lib/authoring/layout/interior-lift-store.svelte';
	import { nearWallCutaway } from '$lib/authoring/stage/cutaway/near-wall-cutaway.svelte';
	import { setResolvedCutaway } from '$lib/authoring/stage/cutaway/cutaway-resolved';
	import { sliceReading } from '$lib/authoring/stage/slice/slice-reading.svelte';
	import { createSliceDraw } from '$lib/authoring/stage/slice/slice-draw.svelte';
	import { pickThroughSlice, pickVisibleFaceThroughSlice } from '$lib/authoring/stage/slice/stage-slice-pick';
	import { setResolvedSlice } from '$lib/authoring/stage/slice/slice-resolved';
	import {
		planOverridesOf,
		resolveSlice,
		sliceDepthItems,
		type ResolvedSlice
	} from '$lib/authoring/stage/slice/slice-cut';
	import { PLAN_DEFAULT_DEPTH_METERS } from '$lib/authoring/stage/plan-parameters';
	import {
		wallUnfoldShouldReturn,
		wallUnfoldViewCentreStation
	} from '$lib/layout/wall-unfold';
	import {
		createStagePressTracker,
		readingIntentClockSeconds,
		stageKeyFromControl,
		stageKeyFromTextEntry
	} from '$lib/authoring/stage/stage-input';
	import type { StageInterruptionReason } from '$lib/authoring/stage/stage-interruption';
	import '$lib/authoring/stage/shell/shell-roles.css';
	import '$lib/authoring/stage/shell/cursors.css';
	import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';
	import StageRepairDrawer from '$lib/authoring/stage/shell/StageRepairDrawer.svelte';
	import { invalidateFinishViewsForSource } from '$lib/render/resources/finish-views';
	import { invalidateTextureSource } from '$lib/render/resources/texture-store';
	import StagePanels from '$lib/authoring/stage/shell/StagePanels.svelte';
	import StageProjectNotices from '$lib/authoring/stage/shell/StageProjectNotices.svelte';
	import StageToolbars from '$lib/authoring/stage/shell/StageToolbars.svelte';
	import StageViewportRegion from '$lib/authoring/stage/shell/StageViewportRegion.svelte';
	import { artworkHangingGuides, snapArtworkHeight, activeArtworkHangGuide } from '$lib/authoring/artwork/artwork-hanging';
	import { artworkBackWallHit } from '$lib/authoring/artwork/artwork-wall-move';
	import { isArtworkWallFace } from '$lib/authoring/artwork/artwork-placement';
	import { artworkReference } from '$lib/authoring/artwork/artwork-command';
	import { verifyArtworkDecode } from '$lib/render/artwork/artwork-decode';
	import { readVerifiedArtwork } from '$lib/authoring/artwork/project-artwork';
	import { createArtworkScope, type ArtworkBytes } from '$lib/render/artwork/artwork-scope';
	import { pointInPolygon } from '@portfolio/layout-core';
	import { createStagePanelRects } from '$lib/authoring/stage/shell/stage-panel-rects.svelte';
	import { celestialDialModel, placeCelestialDial } from '$lib/authoring/look/celestial-dial';
	import { bindSkySession } from '$lib/authoring/look/sky-session.svelte';
	import { sunMarkAnchor } from '$lib/render/world-environment';
	import { aimThroughWindows } from '$lib/authoring/look/aim-through-windows';
	import { createLookAuthoring } from '$lib/authoring/look/look-authoring.svelte';
	import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import { isPaperPlanVisible } from '$lib/authoring/stage/paper-plan';
	import { WORLD_ENVIRONMENT_GROUND_RADIUS_METERS } from '$lib/render/world-environment';
	import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
	import { experienceProblems, loweringProblem, type ExperienceProblem } from '$lib/authoring/experience/experience-problems';
	import { createExperiencePreview } from '$lib/authoring/experience/experience-preview.svelte';
	import { isAllowedShippedTextureUri } from '$lib/visitor/shipped-static-registry';
	import { createProjectSession } from '$lib/authoring/project-session/project-session.svelte';
	import { createProjectApi, createProjectAuth, type ProjectApi } from '$lib/platform/project-persistence';
	import { acceptedSceneRoomMembership } from '$lib/authoring/adapters/scene/room-membership';
	import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
	import { createStageSelectionView, stageWorldCardView } from '$lib/authoring/stage/route/stage-selection-view';
	import {
		stageArmedDockId,
		stageContributedInstrument,
		stageDockView,
		stageFindView,
		stageInactiveTask,
		stageTaskHost,
		type StageHeadFindEntry,
		type StudioFindState
	} from '$lib/authoring/stage/route/stage-contribution-view';
	import { createStageShellState } from '$lib/authoring/stage/route/stage-shell-state.svelte';
	import {
		createFinishAuthoring,
		type FinishAuthoring
	} from '$lib/authoring/look/finish-authoring.svelte';
	import { createMaterialProofRegistry } from '$lib/authoring/material-proof';
	import { withFinishInstancePreview } from '@portfolio/project-model/scene-planning';
	import StagePaintTray from '$lib/authoring/stage/shell/StagePaintTray.svelte';
	import StageLibrary from '$lib/authoring/library/StageLibrary.svelte';
	import LibraryMaterialEditor from '$lib/authoring/library/LibraryMaterialEditor.svelte';
	import MaterialImportSheet from '$lib/authoring/library/MaterialImportSheet.svelte';
	import { createMaterialImportSession, type ImportTargetChoice } from '$lib/authoring/library/material-import.svelte';
	import StageFinishAlign from '$lib/authoring/stage/shell/StageFinishAlign.svelte';
	import {
		ALIGN_CARD_COVER_PX,
		ALIGN_INDEX_LANE_PX,
		faceBoundsOf,
		faceScreenAxes,
		planFitBoundsOf,
		planScreenAxes,
		regionFraming
	} from '$lib/authoring/look/align-chart';
	import { paintConsequence } from '$lib/authoring/stage/paint-consequence';
	import { paintTileSource, parseColourKey } from '$lib/authoring/look/paint-pick';
	import { finishCardTargetKey } from '$lib/authoring/look/finish-card.svelte';
	import { createPaintTrayState } from '$lib/authoring/look/paint-tray-state.svelte';
	import { createColourCoatPort } from '$lib/authoring/look/colour-coat-port';
	import { getMaterial, materialById } from '$lib/content/materials';
	import { materialTreatmentFacts } from '$lib/content/material-presentation';
	import { assets } from '$lib/content/assets';
	import { createStageShellCommands } from '$lib/authoring/stage/route/stage-shell-commands';
	import {
		createStageExperienceBinding,
		type StageExperienceBinding
	} from '$lib/authoring/stage/route/stage-experience-binding.svelte';
	import type { ExperienceController } from '$lib/authoring/experience/experience-controller.svelte';
	import type { StageObjectStudio } from '$lib/authoring/stage/stage-adapter-host';
	import { isStudioOperation, isStudioWorldTool, studioAdmitsCardAction } from '$lib/authoring/studio/studio-model';
	import { createStudioController, type StudioController } from '$lib/authoring/studio/studio-controller.svelte';
	import StudioScopeStrip from '$lib/authoring/studio/StudioScopeStrip.svelte';
	import StudioTransferStrip from '$lib/authoring/studio/StudioTransferStrip.svelte';
	import StudioRootPanel from '$lib/authoring/studio/StudioRootPanel.svelte';
	import { createSubjectScope } from '$lib/authoring/stage/subject-scope';
	import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
	import {
		STUDIO_ENTRY_PARAM,
		STUDIO_ENTRY_VALUE,
		STUDIO_OBJECT_PARAM,
		PLACE_COPY_PARAM,
		studioProjectUrl
	} from '$lib/platform/studio-entry';
	import { requestFormCopyIntake } from '$lib/authoring/adapters/scene/library/intake';
	import { beginFormCopyTransfer, copyLanded, endFormCopyTransfer, peekFormCopyTransfer, type FormCopyTransfer } from '$lib/authoring/adapters/scene/library/transfer';
	import { runPlaceCopy } from '$lib/authoring/studio/place-copy-journey';

	installPerfWorkObserver();

	const routeInput = createRouteInput(() => page);
	const { projectId, intent, studioEntry, placeCopyItem } = routeInput;
	const subjectScope = createSubjectScope();

	const api: ProjectApi | null = createProjectApi({ apiOrigin: env.PUBLIC_API_ORIGIN });
	const auth = env.PUBLIC_API_ORIGIN ? createProjectAuth(env.PUBLIC_API_ORIGIN) : null;
	const session = createStageSession({ sessionEpoch: 'session:route-boot' });
	const materialProofs = createMaterialProofRegistry();
	// Finish target analysis reads the exact approved derivative bytes the Stage
	// draws, keyed by their pin digest. It is host-owned and never authored.
	const modelAnalyses = createModelAnalysisCache();
	const lightPreview = createStageLightPreview();
	const scenePick = createScenePickSource();

	/*
	 * SL1: the Stage's one hit path, with the cut folded in. The reading is read on
	 * the pointer rather than captured, so arming a Slice, dragging it and putting it
	 * back change what a click can select without re-creating the facade or its
	 * adapters. With no reading the wrapper is the unwrapped pick exactly.
	 */
	const stagePick = pickThroughSlice(scenePick, () => resolvedSlice, subjectScope.get);

	/**
	 * The cold-load scope's verified bytes. `verifyProjectImageClosure` fills this
	 * before the candidate installs; the Stage consumes each entry once instead of
	 * downloading the same image again. A miss falls back to the normal verified
	 * route, so the cache is an optimisation, never a second authority.
	 */
	const verifiedImages = createVerifiedProjectImageCache();
	// The Stage's Finish pictures (U1): the shelf asks, the Stage-mounted host draws.
	const finishTiles = provideFinishTiles();
	onDestroy(() => finishTiles.dispose());
	const stageAssets = createStageAssetLeases({
		session,
		apiOrigin: env.PUBLIC_API_ORIGIN ?? '',
		projectId,
		resolveArtwork: async (image, signal) => {
			if (api === null) throw new Error('Artwork storage is unavailable.');
			return verifiedImages.take(projectId, image.assetId) ?? readVerifiedArtwork(api, projectId, image, signal);
		},
		resolveTexture: async (assetId, signal) => {
			if (api === null) throw new Error('Finish image storage is unavailable.');
			return verifiedImages.take(projectId, assetId) ?? api.loadAssetContent(projectId, assetId, signal);
		},
		analyzeModel: async (_assetId, digest, bytes) => {
			if (modelAnalyses.has(digest)) return;
			modelAnalyses.register(await analyzeModelDerivativeBytes(bytes, digest));
		},
		notice: { read: () => shell.notice, write: (message) => shell.setNotice(message) }
	});

	/** Object Studio's one session value, created once the commands it calls exist. */
	let studio!: StudioController;
	let studioRevision = $state(0);
	let studioArmPending = $state(false);
	const objectStudioPort: StageObjectStudio = {
		available: () =>
			studio !== undefined && !studio.active && experience.lensState === 'world' && preview === null,
		edit: (entityId) =>
			studio.enterFromWorld(entityId, 'edit-in-studio')
				? { kind: 'entered' }
				: { kind: 'refused', message: 'That object cannot be edited in Object Studio.' }
	};

	function openSpaceCreated(reference: Parameters<typeof sameReference>[0]): void {
		const stage = facade;
		if (stage === null) return;
		const selected = primaryEntry(stage.selectionState());
		if (selected === null || !sameReference(selected.reference, reference)) return;
		commands.armWorldTool('select');
		commands.syncPrimarySelection(selected);
		shell.requestCardRename(reference);
	}

	const lifecycleCell = late<FeatureLifecycle>();

	const stageEpoch = createStageProjectEpoch({
		session,
		assets: stageAssets,
		materialProofs,
		ports: {
			finishCard: () => finishes,
			lightInspection: () => lightInspection.ports.card,
			objectStudio: () => objectStudioPort,
			openSpaceCreated: () => openSpaceCreated
		},
		projectSession: () => projectSession,
		preview: () => previewController,
		createFacade: (snapshot) => createStageFacade({
			snapshot,
			session,
			scenePick: stagePick,
			sceneBounds: scenePick.bounds,
			lightPreview,
			subjectScope
		}),
		adapterFactories: stageAdapterFactories,
		targetSources: { models: modelAnalyses.provider },
		lifecycle: lifecycleCell.get,
		onNotice: (message) => shell.setNotice(message),
		refresh: () => refresh(),
		isActiveProject: () => boot.status === 'ready' || boot.status === 'empty'
	});

	const projectSession = createProjectSession({
		projectId, intent, api, auth, session, images: verifiedImages, materialProofs,
		url: routeInput.url,
		acceptance: () => stageEpoch.acceptance,
		tornDown: () => stageEpoch.tornDown,
		activate: (snapshot) => stageEpoch.activate(snapshot),
		get notice() { return shell.notice; },
		set notice(value) { shell.setNotice(value); }
	});
	const boot = $derived(projectSession.boot);
	const ready = createProjectReadyPort(() => boot);
	const headSave = $derived(projectSession.headSave);
	const resumeOffer = $derived(projectSession.resumeOffer);
	const pendingReplacement = $derived(projectSession.pendingReplacement);
	const projectActionBusy = $derived(projectSession.projectActionBusy);
	const {
		activeProject, requestReplacement, runReplacement, resumePendingSave, dismissResumeOffer,
		prepareProjectLifecycle, renameCurrentProject, deleteCurrentProject, finishCurrentProjectAction,
		reloadLifecycleRemote, applyReloadOffer
	} = projectSession;

	const sourceFindings = $derived.by(() => {
		if (boot.status !== 'ready' && boot.status !== 'empty') return null;
		const { diagnostics, closure } = boot.snapshot.domain;
		return diagnostics.length === 0 && closure.length === 0 ? null : { diagnostics, closure };
	});
	const sourceProblems = $derived.by(() => {
		if (boot.status !== 'ready' && boot.status !== 'empty') return [] as readonly ExperienceProblem[];
		return experienceProblems(stageEnvelope(boot.snapshot), boot.snapshot.domain.diagnostics);
	});

	const facade = $derived(stageEpoch.facade);
	const acceptance = $derived(stageEpoch.acceptance);
	const historyState = $derived(stageEpoch.history);
	let selection = $state<StageSelectionEntry | null>(null);
	let revealed = $state<string[]>([]);
	let stageEl: HTMLDivElement | undefined = $state(undefined);
	let throughFrameEl: HTMLElement | undefined = $state(undefined);
	let liveStageGesture = $state(false);

	/** The Experience binding owns lens/View/Look Through; the shell state owns chrome. */
	let experience!: StageExperienceBinding;
	/** Paint's one Finish intent home, built after the commands it calls. */
	let finishes!: FinishAuthoring;
	const shell = createStageShellState({
		session,
		facade: () => facade,
		evaluation: () => evaluation,
		rect: () => rect,
		measure: () => stageViewport.measure(),
		previewing: () => preview !== null,
		lens: () => experience.lensState,
		selection: () => selection,
		finishes: () => finishes,
		onPaintedOne: (target) => {
			// A Paint click selects what it painted and opens that Finish; Paint stays
			// armed. The stroke's hit names the pre-write revision, so the subject is
			// selected by id against the source the write just installed.
			commands.selectSource(target.entityId ?? target.hit.sourceId);
			const surface = target.assignmentSurfaces[0] ?? target.surface;
			if (target.entityId !== null) finishes?.card.requestOpen({ kind: 'entity', entityId: target.entityId });
			else if (surface !== null) finishes?.card.requestOpen({ kind: 'surface', surface });
		}
	});
	experience = createStageExperienceBinding({
		session,
		stage: () => facade,
		shell: () => shell,
		selection: () => selection,
		cardIdentity: () => selectionViewView?.cardIdentity ?? null,
		floorDatum: () => experienceFloorDatum,
		closeSelection: () => commands.closeSelection(),
		clearStageSelection: () => {
			facade?.select(null);
			selection = null;
		},
		preview: () => previewController,
		reducedMotion: () => shell.reducedMotion,
		evaluation: () => evaluation,
		rect: () => rect,
		stageElement: () => stageEl,
		capturePointer,
		stageCss,
		absoluteCss,
		refresh: () => refresh(),
		renameRequest: () => shell.requestCardRename(),
		clearHover,
		refusePress: (pointerId) => press.refuse(pointerId),
		interruptPress,
		gestureActive: () => session.gesture() !== null,
		notice: (message) => shell.setNotice(message),
		setPreviewProblem: (problem) => shell.setPreviewProblem(problem),
		setStagePickPresentationId: (id) => shell.setStagePickPresentationId(id)
	});

	const previewController = createExperiencePreview({
		lens: () => experience.lensState,
		snapshot: () => (boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot : null),
		token: () => session.token(),
		isCurrent: (token) => session.isCurrent(token as never),
		envelope: () => currentEnvelope,
		envelopeOf: (snapshot) => stageEnvelope(snapshot as Parameters<typeof stageEnvelope>[0]),
		focus: () => experienceFocus.read(),
		setProblem: (problem) => shell.setPreviewProblem(problem as ExperienceProblem | null),
		stage: () => facade,
		stopAndRestore: () => {
			// Preview takes the one Camera output: the light inspection restores its
			// entry standpoint synchronously before the ticket moves.
			lightInspection.ports.cancel();
			// Align, the material Editor, Import and the repair pickers end by their
			// cancel paths; Align restores its entry standpoint first (U6 lifecycle).
			endMaterialOperations(true);
			experience.stopAndRestore();
		},
		snapSuspended: () => shell.drafting.snapSuspended,
		patchDrafting: (patch) => shell.patchDrafting(patch),
		notice: (message) => shell.setNotice(message),
		perfMark: (name, data) => perfMark(name, data),
		async prepareArtwork(domain, signal) {
			const read = domain as StageDomainRead;
			const images = new Map(read.scene.entities.flatMap((entity) =>
				entity.kind === 'artwork' ? [[entity.source.assetId, entity.source] as const] : []));
			if (!images.size) return null;
			if (api === null) throw new Error('Artwork images are unavailable in Preview.');
			const bytes = new Map<string, ArtworkBytes>();
			const rows = new Map((await api.listAssets(projectId, signal)).map((row) => [row.id, row]));
			for (const [id, image] of images) {
				const row = rows.get(id);
				if (!row) throw new Error('A placed Artwork is missing. Retry entering Preview.');
				const content = await readVerifiedArtwork(api, projectId, image, signal, row);
				await verifyArtworkDecode(content.bytes, content.mime, image);
				signal.throwIfAborted();
				bytes.set(id, content);
			}
			return createArtworkScope(async (image) => {
				const content = bytes.get(image.assetId);
				if (!content) throw new Error('Artwork is missing in this Preview.');
				return content;
			});
		}
	});
	const preview = $derived(previewController.preview);
	const previewView = $derived(previewController.view);
	const previewViewRead = $derived(previewController.viewRead as StageDomainRead | null);
	const previewSurface = $derived(previewController.surface);
	const previewRequestedMode = $derived(previewController.requestedMode);
	const previewGuideStats = $derived(previewController.stats);
	const previewViewLabels = $derived(previewController.labels);
	const previewAvailable = $derived(previewController.available);
	const projectActionsUnavailableReason = $derived(projectSession.projectActionsUnavailableReason());
	const adapterServices = $derived(stageEpoch.services);
	const press = createStagePressTracker();

	/** The one Look-through predicate: a View inspection or a Spot inspection. */
	function lookThroughActiveNow(): boolean {
		return experience.lookThroughActive() || lightInspection.ports.active();
	}

	const lightInspection = createLightInspectionFeature({
		stage: () => facade,
		services: () => adapterServices,
		lens: () => experience.lensState,
		notice: (message) => shell.setNotice(message),
		refresh: () => refresh(),
		absoluteCss,
		capturePointer,
		stageElement: () => stageEl,
		evaluation: () => evaluation,
		previewing: () => preview !== null
	});

	const viewing = createStageViewing({
		facade: () => facade,
		rect: () => rect,
		stageInput: () => stageInput,
		shell,
		session,
		lifecycle: lifecycleCell.get,
		refresh
	});
	const {
		submit, setReading, patchDrafting, requestScaleDetent, fit,
		zoomIn, zoomOut, bringIntoView, zoom, pan, orbit
	} = viewing;

	const stageViewport = createStageViewport({
		facade: () => facade,
		stageElement: () => stageEl,
		throughFrameElement: () => throughFrameEl ?? null,
		lookThroughActive: lookThroughActiveNow,
		previewing: () => preview !== null,
		lens: () => experience.lensState,
		revealed: () => revealed,
		roomLabels: () => ({ plan: shell.preferences.roomLabels2d, threeD: shell.preferences.roomLabels3d }),
		groundReachMeters: () =>
			look.sky !== null && look.sky.preset !== 'studio'
				? WORLD_ENVIRONMENT_GROUND_RADIUS_METERS
				: undefined,
		nowSeconds,
		advanceLookThroughZoom: (now) => experience.advanceLookThroughZoom(now),
		advancePlayback: (now) => experience.advancePlayback(now),
		onBeforeRefresh: () => {
			stageEpoch.refreshHistory();
			shell.syncGestureFade(session.gesture());
			liveStageGesture = session.gesture() !== null;
		},
		onAfterRefresh: () => shell.refreshHostTools()
	});
	const throughViewport = $derived(stageViewport.framedViewport);
	const evaluation = $derived(stageViewport.evaluation);
	const planView = $derived(stageViewport.planView);
	const rect = $derived(stageViewport.rect);
	const markers = $derived(stageViewport.markers);
	const candidatePreviews = $derived(stageViewport.candidatePreviews);
	const guides = $derived(stageViewport.guides);
	const ghosts = $derived(stageViewport.ghosts);
	const roomLabels = $derived(stageViewport.roomLabels);
	const marks = $derived(stageViewport.marks);
	const tracePreview = $derived(stageViewport.tracePreview);
	const currentEnvelope = $derived(ready.envelope());
	const experienceFloorDatum = $derived(ready.datumMeters());
	const activeLayer = $derived(
		experience.posture ?? (lightInspection.ports.active() ? lightInspection.posture : null)
	);
	installLookThroughFrame({
		frame: () => throughFrameEl,
		viewSession: () => experience.lookThroughSession(),
		lightSession: lightInspection.ports.session,
		refresh
	});
	lightInspection.attachGuards();

	function changeLens(next: 'world' | 'experience'): void {
		lifecycle.leaveLens(next);
	}

	const selectionView = createStageSelectionView();
	let finishCardSelectionKey = '';
	$effect(() => {
		const entry = selection;
		const key = entry === null
			? ''
			: `${entry.reference.domain}\u0000${entry.reference.subject.kind}\u0000${entry.reference.subject.id}`;
		if (key === finishCardSelectionKey) return;
		finishCardSelectionKey = key;
		// A selection change discards a Card gesture: nothing is written. The
		// material Editor and the image/repair pickers it opened belong to the old
		// target and close by their cancel paths (U6 lifecycle); Align follows the
		// Card's open user below.
		untrack(() => {
			finishes.card.cancel();
			if (finishes.editor.open) finishes.editor.close(false);
			finishes.cancelImage();
			finishes.issues.cancelRepairs();
		});
	});
	const sceneRooms = $derived(
		currentEnvelope === null ? new Map<string, string>() : acceptedSceneRoomMembership(currentEnvelope)
	);
	const locatedSubjects = $derived.by(() => {
		void shell.contributionsVersion;
		return facade?.subjects() ?? [];
	});
	const selectionViewView = $derived(selectionView.read({
		snapshot: boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot : null,
		envelope: currentEnvelope,
		sceneRooms,
		selection,
		// Object Studio's Index is the root alone: the World's rooms and walls are not offered.
		planView: studio?.active ? null : planView,
		subjects: locatedSubjects,
		scope: shell.worldScope
	}));
	/** What Find knows of Object Studio: the selected form it can open, and its own entries. */
	const studioFind = $derived.by((): StudioFindState | null => {
		if (experience.lensState !== 'world' || preview !== null) return null;
		void studioRevision;
		const selectedId =
			selection !== null && selection.reference.domain === 'scene' ? selection.reference.subject.id : null;
		const selectedForm =
			selectedId !== null &&
			(facade?.snapshot().domain.scene.entities ?? []).some((entity) => entity.id === selectedId && entity.kind === 'form');
		return {
			active: studio?.active === true,
			origin: studio?.origin ?? 'world',
			context: studio?.context ?? 'world',
			canEdit: selectedForm && studio?.active !== true,
			rootCount: studio?.roots.length ?? 0
		};
	});
	const dockView = $derived(stageDockView({ facade, revision: shell.contributionsVersion }));
	const paintTray = $derived(finishes.paintTray());
	const paintTrayState = createPaintTrayState();
	// Paint's consequence line, read on the Stage view bar while the tray is up.
	const paintLine = $derived(
		shell.armedHostTool === 'paint' && preview === null && !shell.libraryOpen && finishes.libraryDraft === null
			? paintConsequence({
				stroke: shell.paintTool?.stroke() ?? null,
				dropper: paintTray.dropper,
				picked: paintTray.active !== null,
				tab: paintTray.colourEnabled ? paintTrayState.tab : 'materials',
				candidate: shell.paintCandidate
			})
			: null
	);
	$effect(() => {
		if (shell.armedHostTool !== 'paint') paintTrayState.reset();
	});
	/** One project Finish's picture source: the accepted Scene, read at its content id, through the project's texture scope. */
	function finishTileSource(finishId: string): FinishTileSource | null {
		if (boot.status !== 'ready' && boot.status !== 'empty') return null;
		return {
			kind: 'finish',
			subject: {
				kind: 'finish',
				document: boot.snapshot.domain.scene,
				finishId,
				revision: boot.snapshot.sourceContentId,
				scope: stageAssets.textureScope
			}
		};
	}
	const finishShelf = $derived.by(() => {
		void shell.contributionsVersion;
		return finishes.libraryShelf();
	});
	const libraryEntries = $derived.by(() => {
		void shell.contributionsVersion;
		return finishes.libraryBrowse();
	});
	const libraryTarget = $derived.by(() => {
		void selection;
		void shell.contributionsVersion;
		return finishes.libraryTarget();
	});
	/**
	 * The draft's render-only Stage projection, held stable between scene reads:
	 * a fresh object per read would make every Stage evaluation look changed.
	 */
	const materialImport = createMaterialImportSession({
		acceptHost: () => {
			if ((boot.status !== 'ready' && boot.status !== 'empty') || adapterServices === null || api === null) return null;
			const services = adapterServices;
			const cloudApi = api;
			return {
				api: cloudApi,
				projectId,
				current: () => {
					const shot = services.stage.snapshot();
					return { revision: shot.acceptedRevision, source: stageEnvelope(shot) };
				},
				accept: async (intent) => {
					const outcome = await services.authoring.accept(intent);
					if (outcome.kind === 'installed') return { kind: 'accepted' };
					if (outcome.kind === 'refused') return { kind: 'rejected', code: outcome.code, message: outcome.message };
					return { kind: 'rejected', code: outcome.kind, message: 'No change was made.' };
				},
				entityReference: (source, entityId) => ({
					version: 1 as const,
					domain: 'scene' as const,
					revision: { kind: 'exact' as const, contentRevision: source.units.scene.header.contentRevision },
					subject: { kind: 'entity' as const, id: entityId },
					instancePath: [],
					location: { kind: 'project-root' as const },
					componentId: null,
					capabilityId: null
				}),
				surfaceReference: (source, surface) => ({
					version: 1 as const,
					domain: 'layout' as const,
					revision: { kind: 'exact' as const, contentRevision: source.units.layout.header.contentRevision },
					subject:
						surface.kind === 'wall-side'
							? { kind: 'wall' as const, id: surface.wallId }
							: surface.kind === 'region-face'
								? { kind: 'region' as const, id: surface.regionId }
								: { kind: 'room' as const, id: surface.roomId },
					instancePath: [],
					location: { kind: 'project-root' as const },
					componentId: null,
					capabilityId: null
				})
			};
		},
		expectedRevision: () => (boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.acceptedRevision : null),
		materialProofs: () => materialProofs,
		onAccepted: ({ finishKey, name, targetCount, targetKind, firstTarget }) => {
			finishes.noteUsedFinish?.(finishKey);
			if (targetCount > 0 && firstTarget !== null) {
				const nouns = targetKind === 'layout' ? 'surfaces' : 'parts';
				const other = targetKind === 'layout' ? 'objects' : 'walls';
				shell.setNotice(`${name} is on ${targetCount} ${nouns} · paint it on ${other} from Materials — same Finish`);
				if (firstTarget.kind === 'surface') {
					finishes.card.requestOpen({ kind: 'surface', surface: firstTarget.surface });
				} else {
					finishes.card.requestOpen({ kind: 'entity', entityId: firstTarget.id });
				}
			} else {
				shell.setNotice(`${name} added to This project`);
			}
		}
	});

	function currentImportTargets(): ImportTargetChoice[] {
		const out: ImportTargetChoice[] = [];
		const target = finishes.libraryTarget();
		if (target !== null) {
			if (target.kind === 'entity') {
				out.push({ kind: 'entity', id: target.entityId, label: target.label });
			} else {
				out.push({ kind: 'surface', surface: target.surface, label: target.label });
			}
		}
		return out;
	}

	const editorTreatmentFacts = materialTreatmentFacts((id) => (materialById.has(id) ? getMaterial(id).label : id));

	function baseSourceOfInstance(instance: { readonly base: { readonly catalogue: string } | { readonly material: string } }): FinishTileSource | null {
		if ('catalogue' in instance.base) {
			return { kind: 'catalogue', id: instance.base.catalogue as import('$lib/types/materials').MaterialId };
		}
		if (boot.status !== 'ready' && boot.status !== 'empty') return null;
		const scene = boot.snapshot.domain.scene;
		const id = 'material-editor-base-inspection';
		return {
			kind: 'finish',
			subject: {
				kind: 'finish',
				document: {
					...scene,
					materials: [
						...scene.materials.filter((material) => material.id !== id),
						{ id, name: 'Original', base: instance.base }
					]
				},
				finishId: id,
				revision: `${boot.snapshot.sourceContentId}#base:${instance.base.material}`,
				scope: stageAssets.textureScope
			}
		};
	}

	const finishEditorView = $derived.by(() => {
		void shell.contributionsVersion;
		void finishes.card.preview;
		return finishes.editor.view();
	});

	/** The draft's own render subject for Compare: the patched Finish in a draft-only document. */
	const libraryDraftRender = $derived.by((): { source: FinishTileSource | null; reason: string | null } => {
		void shell.contributionsVersion;
		const drafted = finishes.libraryDraftInstance();
		if (drafted === null) return { source: null, reason: null };
		if (!drafted.ok) return { source: null, reason: drafted.reason };
		if (!drafted.changed) return { source: null, reason: null };
		if (boot.status !== 'ready' && boot.status !== 'empty') {
			return { source: null, reason: 'The project is not loaded.' };
		}
		const scene = boot.snapshot.domain.scene;
		const id = 'library-draft-inspection';
		const editsSig = JSON.stringify(finishes.libraryDraft?.edits ?? []);
		return {
			reason: null,
			source: {
				kind: 'finish',
				subject: {
					kind: 'finish',
					document: {
						...scene,
						materials: [...scene.materials.filter((material) => material.id !== id), { ...drafted.instance, id }]
					},
					finishId: id,
					revision: `${boot.snapshot.sourceContentId}#draft:${finishes.libraryDraft?.finishKey}:${editsSig}`,
					scope: stageAssets.textureScope
				}
			}
		};
	});
	const libraryDraftPreview = $derived.by(() => {
		void finishes.libraryDraft;
		void shell.contributionsVersion;
		return finishes.libraryDraftPreview();
	});
	const libraryDraftStatus = $derived.by(() => {
		void selection;
		void shell.contributionsVersion;
		return finishes.libraryDraftStatus();
	});
	function libraryTileSource(entry: (typeof libraryEntries)[number]): FinishTileSource | null {
		if (entry.source === 'curated' && entry.curatedId !== null) return { kind: 'catalogue', id: entry.curatedId };
		return entry.projectId === null ? null : finishTileSource(entry.projectId);
	}
	const libraryObjects = assets
		.filter((asset) => asset.status === 'approved')
		.slice(0, 8)
		.map((asset) => ({ id: asset.id, name: asset.name }));

	/** Where focus lands when the Library closes: the control that opened it. */
	const LIBRARY_INVOKERS = {
		dock: '[data-world-library-key]',
		lights: '[data-world-library-key]',
		paint: '[data-paint-library], [data-paint-library-open]',
		furnish: '[data-furnish-browse]',
		card: '[data-finish-swap]'
	} as const;
	function returnLibraryFocus(from: keyof typeof LIBRARY_INVOKERS): void {
		void tick().then(() => {
			const invoker =
				document.querySelector<HTMLElement>(LIBRARY_INVOKERS[from]) ??
				document.querySelector<HTMLElement>(LIBRARY_INVOKERS.dock);
			invoker?.focus();
		});
	}
	/**
	 * Close the external Library; a Paint pick behind it returns to the tray,
	 * never Select, and a Furnish visit returns to its strip. Focus goes back to
	 * the invoking control unless the close hands the creator to the Stage.
	 */
	function closeLibrary(returnFocus = true): void {
		finishes.clearLibrarySwap();
		if (!shell.libraryOpen) return;
		const returnsToPaint = shell.toolBeforeLibrary === 'paint';
		const from = shell.libraryInvocation.from;
		commands.toggleWorldLibrary();
		if (returnsToPaint || shell.armedHostTool === 'paint') commands.armWorldTool('paint');
		if (returnFocus) returnLibraryFocus(from);
	}
	const dockKeys = $derived(dockView.keys);
	const inactiveTask = $derived(stageInactiveTask({
		facade,
		lens: experience.lensState,
		revision: shell.contributionsVersion
	}));
	const contributedInstrument = $derived(stageContributedInstrument({
		facade,
		contributedTaskId: shell.contributedTaskId,
		revision: shell.contributionsVersion
	}));
	const taskHost = $derived(stageTaskHost({
		task: shell.task,
		armedHostTool: shell.armedHostTool
	}));
	const armedDockId = $derived(stageArmedDockId({
		task: shell.task,
		armedHostTool: shell.armedHostTool,
		armedTool: shell.armedTool,
		dockKeys
	}));
	const findView = $derived(stageFindView({
		facade,
		revision: shell.contributionsVersion,
		lens: experience.lensState,
		query: shell.findQuery,
		worldIndex: selectionViewView.worldIndex,
		dockKeys,
		studio: studioFind
	}));

	const heightSheet = session.heightSheet();
	const skyRects = createStagePanelRects();
	const look = createLookAuthoring({
		sky: () => currentEnvelope?.units.scene.data.environment?.sky ?? null,
		scene: () => currentEnvelope?.units.scene.data ?? null,
		sessionKey: () => boot.status === 'ready' || boot.status === 'empty'
			? boot.snapshot.sessionEpoch
			: '',
		services: () => adapterServices,
		windowHeading: () => facade ? aimThroughWindows(facade.snapshot().domain.geometry) : null,
		onNotice: (message) => shell.setNotice(message)
	});

	let artworkInteraction!: ReturnType<typeof createStageArtworkInteraction>;
	let unfoldGestures!: ReturnType<typeof createStageUnfoldGestures>;
	let sliceDraw!: ReturnType<typeof createSliceDraw>;
	let stageInput!: ReturnType<typeof createStageInputArbiter>;
	let stageKeyboard!: ReturnType<typeof createStageKeyboard>;

	function downloadSourceJson(): void {
		const snapshot = boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot : null;
		if (snapshot === null) return;
		const canonical = snapshot.canonicalJson;
		const url = URL.createObjectURL(new Blob([canonical], { type: 'application/json' }));
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `${snapshot.domain.name.replace(/[^\w.-]+/g, '-') || 'project'}.json`;
		anchor.click();
		URL.revokeObjectURL(url);
	}

	$effect(() => {
		const target = shell.cardRenameTarget;
		const primary = facade?.selectionState().primary;
		if (target && (primary == null || !sameReference(primary, target) ||
			(selection !== null && !sameReference(selection.reference, target)))) {
			shell.consumeCardRename(shell.cardRenameRequest);
		}
	});

	const commands = createStageShellCommands({
		facade: () => facade,
		planView: () => planView,
		session,
		shell,
		selection: () => selection,
		setSelection: (entry) => { selection = entry; },
		focus: experienceFocus,
		experience: {
			lens: experience.lens,
			active: () => experience.active
		},
		cardActions: () => worldCard.actions,
		dockKeys: () => dockKeys,
		notice: (message) => shell.setNotice(message),
		refreshHostTools: () => shell.refreshHostTools(),
		cancelArtwork: () => artworkInteraction.cancel(),
		view: {
			zoomIn: () => zoomIn(),
			zoomOut: () => zoomOut(),
			fit: () => fit(),
			requestScaleDetent: (ratio) => requestScaleDetent(ratio)
		},
		project: {
			requestReplacement: (kind) => requestReplacement(kind),
			downloadSourceJson: () => downloadSourceJson()
		},
		showExperienceWelcome: () => experience.showWelcome(),
		levelSlice: () => {
			sliceDraw.disarm();
			sliceReading.level();
		},
		lightArmed: lightInspection.ports.lightArmed,
		isStudioTool: isStudioWorldTool,
		studioActive: () => studio?.active === true,
		libraryReplaceQualified: () => finishes?.libraryTarget() != null,
		runStudioEntry: (id) => {
			if (id === 'edit') {
				const selectedId =
					selection !== null && selection.reference.domain === 'scene' ? selection.reference.subject.id : null;
				if (selectedId !== null) void objectStudioPort.edit(selectedId);
			} else if (id === 'back-to-world') studio.backToWorld();
			else if (id === 'back-to-projects') studio.backToProjects();
			else if (id === 'open-in-world') studio.openInWorld();
			else if (id === 'new-object-here') studio.newObjectHere();
			else if (id === 'choose-object') studio.openChooser();
			else if (id === 'context-world') studio.setContext('world');
			else if (id === 'context-mat') studio.setContext('mat');
			else if (id === 'new-object-project') void goto('/studio');
		}
	});

	studio = createStudioController({
		entities: () =>
			(facade?.snapshot().domain.scene.entities ?? []).map((entity) => ({
				id: entity.id,
				name: entity.name,
				kind: entity.kind
			})),
		selectedEntityId: () =>
			selection !== null && selection.reference.domain === 'scene' ? selection.reference.subject.id : null,
		select: (entityId) => {
			const stage = facade;
			if (stage === null) return false;
			if (entityId === null) {
				commands.closeSelection();
				return true;
			}
			commands.selectStageReference(
				sceneEntityReference(entityId, stage.snapshot().domain.unitRevisions.scene)
			);
			return true;
		},
		setScope: (scope) => {
			subjectScope.set(scope === null ? null : { entityId: scope.entityId, admitsOperation: isStudioOperation, admitsCardAction: (adapterId, subjectId, actionId) => studioAdmitsCardAction(scope.entityId, adapterId, subjectId, actionId) });
			clearHover();
			shell.bumpContributions();
			facade?.notifySurfaceChange();
			studioRevision += 1;
		},
		captureView: () => {
			const camera = facade?.camera.state();
			if (camera === undefined) return null;
			return {
				reading: camera.reading,
				eye: eyeOfInspectionPose(camera.pose),
				target: camera.pose.target,
				fovYDegrees: fovYDegreesOf(camera.pose),
				targetPlaneHeightMeters: camera.pose.targetPlaneHeightMeters
			};
		},
		restoreView: (record) => {
			const result = submit(
				{
					kind: 'set-view',
					eye: [record.eye[0], record.eye[1], record.eye[2]],
					target: [record.target[0], record.target[1], record.target[2]],
					fovYDegrees: record.fovYDegrees,
					transition: !shell.reducedMotion
				},
				nowSeconds()
			);
			if (result?.kind !== 'accepted') return false;
			if (record.reading === 'plan') {
				submit({ kind: 'set-reading', reading: 'plan' }, readingIntentClockSeconds(shell.reducedMotion, nowSeconds()));
			}
			return true;
		},
		rootBounds: (entityId) => facade?.sceneBounds(entityId) ?? null,
		fit: (bounds) => {
			if (facade === null || rect === null) return false;
			return submit(
				{
					kind: 'fit',
					bounds: { min: [...bounds.min], max: [...bounds.max] },
					rect,
					// A lone object is framed with room around it, not edge to edge.
					paddingFraction: 0.3
				},
				nowSeconds()
			)?.kind === 'accepted';
		},
		contentBounds: () => (facade === null ? null : readStageContentBounds(facade)),
		fitAll: () => {
			const bounds = facade === null ? null : readStageContentBounds(facade);
			if (bounds === null || rect === null) return;
			submit({ kind: 'fit', bounds: { min: bounds.min, max: bounds.max }, rect, paddingFraction: 0.25 }, nowSeconds());
		},
		armCreation: () => {
			// The dock's Objects key appears once the adapters have bound: wait for it
			// instead of refusing a creation the creator just asked for.
			if (dockKeys.some((key) => key.slot === 'library')) commands.armWorldTool('objects');
			else studioArmPending = true;
		},
		closeCreation: () => {
			const close = (): void => {
				// The placement task stays armed for repeat placing: Studio has its root now.
				commands.closeTask();
				if (shell.activeWorldTool === 'objects' || shell.libraryOpen) commands.armWorldTool('select');
				shell.setWorldPlateOpen(false);
				shell.setLibraryOpen(false);
			};
			close();
			// Placement settles its own tray after the accepted source: close it once more then.
			setTimeout(() => {
				if (studio.active && !studio.creating) close();
			}, 0);
		},
		settlePending: () => lifecycle.settlePending(),
		notice: (message) => shell.setNotice(message),
		syncUrl: (state) => {
			try {
				const url = new URL(window.location.href);
				if (state === null) {
					url.searchParams.delete(STUDIO_ENTRY_PARAM);
					url.searchParams.delete(STUDIO_OBJECT_PARAM);
				} else {
					url.searchParams.set(STUDIO_ENTRY_PARAM, STUDIO_ENTRY_VALUE);
					if (state.objectId === null) url.searchParams.delete(STUDIO_OBJECT_PARAM);
					else url.searchParams.set(STUDIO_OBJECT_PARAM, state.objectId);
				}
				replaceState(`${url.pathname}${url.search}`, {});
			} catch {
				// The address is a courtesy: a router that is not ready keeps the posture.
			}
		},
		navigate: (href) => void goto(href),
		placeCopy: async (rootId, current) => {
			const { saveFormCopyToMyObjects } = await import('$lib/authoring/adapters/scene/library/save');
			if (!current()) return false;
			const outcome = await runPlaceCopy(rootId, current, {
				entity: (id) => {
					const entry = facade?.snapshot().domain.scene.entities.find((candidate) => candidate.id === id);
					return entry?.kind === 'form' ? entry : null;
				},
				isDirty: () => headSave?.isDirty() === true,
				saveFirst: () => projectSession.saveBeforeSwitch(),
				saveToLibrary: (entity) => saveFormCopyToMyObjects(entity),
				beginTransfer: (itemId, name) => beginFormCopyTransfer({
					sourceProjectId: projectId, objectId: rootId, objectName: name, itemId,
					// Mint the exact entity the copy will occupy; it travels through the
					// intake to place-form-copy and identifies this insertion at settlement.
					entityId: `entity-${crypto.randomUUID()}`
				}),
				openChooser: (itemId) => goto(`/projects?${PLACE_COPY_PARAM}=${encodeURIComponent(itemId)}`),
				notice: (message) => shell.setNotice(message)
			});
			return outcome === 'navigated';
		},
		focusReturn: () => {
			setTimeout(() => {
				const card = document.querySelector<HTMLElement>('[data-editor-card], .card');
				const target = card?.querySelector<HTMLElement>('button, [tabindex]') ?? stageEl ?? null;
				target?.focus({ preventScroll: true });
			}, 0);
		},
		indexOpen: () => shell.indexOpen,
		setIndexOpen: (open) => shell.setIndexOpen(open)
	});

	finishes = createFinishAuthoring({
		services: () => adapterServices,
		api: () => api,
		projectId: () => projectId,
		canEdit: canPlaceArtwork,
		isSaved: () => headSave?.snapshot().savedBaseToken != null,
		imageAspect: (textureId) => stageAssets.textureAspect(textureId),
		imageDimensions: (textureId) => stageAssets.textureDimensions(textureId),
		textureUri: (textureId) => {
			const scene = boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.scene : null;
			return scene?.textures.find((texture) => texture.id === textureId)?.uri ?? null;
		},
		texturePreviewUri: (textureId) => stageAssets.texturePreviewUri(textureId),
		textureFailed: (uri) => stageAssets.textureFailed(uri),
		retryTexture: (uri) => stageAssets.retryTexture(uri),
		onNotice: (message) => shell.setNotice(message),
		openFinishes: () => {
			if (!shell.libraryOpen) commands.toggleWorldLibrary();
			shell.setWorldPlateOpen(true);
		},
		// The Card's Swap… opens the Library on its Swap intent (a fresh invocation).
		openLibrarySwap: () => {
			if (shell.libraryOpen) commands.toggleWorldLibrary();
			commands.toggleWorldLibrary('card');
		},
		isPaintArmed: () => shell.armedHostTool === 'paint',
		armPaint: () => commands.armWorldTool('paint'),
		colourCoat: createColourCoatPort({
			services: () => adapterServices,
			onNotice: (message) => shell.setNotice(message),
			labelForMaterial: (id) => (materialById.has(id) ? getMaterial(id).label : id)
		}),
		repairAsset: (assetId, bytes, expectedPin, signal) =>
			projectSession.repairProjectAsset(assetId, bytes, expectedPin, signal),
		invalidateAndReloadAsset: (assetId) => {
			const uri = `project-asset://${assetId}`;
			const scopeId = stageAssets.textureScope?.scopeId ?? null;
			if (scopeId !== null) invalidateFinishViewsForSource(scopeId, uri);
			invalidateTextureSource(scopeId, uri);
			stageAssets.retryTexture(uri);
		},
		retryTextures: () => {
			for (const issue of finishes.issues.open) {
				if (issue.assetId !== null) {
					stageAssets.retryTexture(`project-asset://${issue.assetId}`);
				}
			}
		}
	});
	let repairDrawerOpen = $state(false);
	$effect(() => {
		void projectId;
		untrack(() => {
			finishes.issues.reset();
			repairDrawerOpen = false;
		});
	});
	const bootRepair = createBootRepair({
		boot: () => boot,
		projectId: () => projectId,
		repair: projectSession.repairBootImage
	});

	/**
	 * The Customise… draft lives in the Material editor while Paint is armed for
	 * its Stage retarget; putting Paint down discards it. Only Apply writes.
	 */
	$effect(() => {
		if (finishes.libraryDraft !== null && shell.armedHostTool !== 'paint') finishes.cancelLibraryDraft();
	});
	$effect(() => {
		if (!shell.libraryOpen && finishes.librarySwap !== null) untrack(() => finishes.clearLibrarySwap());
	});
	/** Leave the draft editor: discard the draft and hand focus back to the Library key. */
	function endLibraryDraft(): void {
		finishes.cancelLibraryDraft();
		commands.armWorldTool('select');
		void tick().then(() => document.querySelector<HTMLElement>('[data-world-library-key]')?.focus());
	}
	artworkInteraction = createStageArtworkInteraction({
		api,
		services: () => adapterServices,
		canEdit: canPlaceArtwork,
		isSaved: () => headSave?.snapshot().savedBaseToken != null,
		selected: () => selectionViewView.selectedArtwork,
		facade: () => facade,
		evaluation: () => evaluation,
		rect: () => rect,
		measure: () => stageViewport.measure(),
		stageElement: () => stageEl,
		// Artwork hangs on a **drawn** face: the cut's filter applies to the placement
		// ray too, so a click through a removed Wall reaches the one behind it.
		pickVisibleFace: pickVisibleFaceThroughSlice(scenePick, () => resolvedSlice),
		press,
		capturePointer,
		onNotice: (message) => shell.setNotice(message),
		onSelect: (services, id) => commands.selectStageReference(artworkReference(services, id)),
		selectTool: () => commands.selectTool()
	});

	unfoldGestures = createStageUnfoldGestures({
		facade: () => facade,
		evaluation: () => evaluation,
		rect: () => rect,
		measure: () => stageViewport.measure(),
		stageElement: () => stageEl,
		stageCss,
		layout: () => selectionViewView.layoutPayload,
		task: () => shell.task,
		selectedCurvedWall: () => selectedCurvedWall,
		services: () => adapterServices,
		acceptOpening: (services, intent) => services.authoring.accept(intent),
		selectSubject: (wallId, openingId) => commands.selectUnfoldedSubject(wallId, openingId),
		press,
		capturePointer,
		clearHover,
		onNotice: (message) => shell.setNotice(message)
	});

	sliceDraw = createSliceDraw({
		facade: () => facade,
		evaluationId: () => facade?.evaluationId() ?? null,
		renderedReading: () => (evaluation?.renderedReading === 'plan' ? 'plan' : evaluation?.renderedReading === '3d' ? '3d' : null),
		eye: () => (evaluation === null ? null : eyeOfInspectionPose(evaluation.pose)),
		bounds: () => stageContentBounds,
		datumMeters: () => boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.datumMeters : 0,
		notice: (message) => shell.setNotice(message)
	});

	stageInput = createStageInputArbiter({
		facade: () => facade,
		evaluation: () => evaluation,
		rect: () => rect,
		measure: () => stageViewport.measure(),
		stageElement: () => stageEl,
		session,
		activeLayer: () => activeLayer,
		artwork: artworkInteraction,
		unfold: unfoldGestures,
		stageCss,
		capturePointer,
		press,
		armedHostTool: () => shell.armedHostTool,
		measureTool: () => shell.measureTool,
		eraserTool: () => shell.eraserTool,
		paintTool: () => shell.paintTool,
		task: () => shell.task,
		dockToolArmed: () => shell.armedTool !== null,
		adapterTapOnly: () => shell.activeWorldTool === 'room',
		planView: () => planView,
		previewing: () => preview !== null,
		pick: stagePick,
		viewMarkAt: (event) => experience.viewMarkAt(event),
		eraseHover: () => shell.eraseHover,
		setEraseHover: (entry) => shell.setEraseHover(entry),
		setPaintHover: (entry) => shell.setPaintHover(entry),
		// The refusal belongs to the armed Slice **tool**, not to a live cut: back on
		// Select, the creator selects and drags everything below the cut.
		sliceToolArmed: () => shell.activeWorldTool === 'slice' && !sliceDraw.armed,
		sliceDraw: () => (sliceDraw.armed ? sliceDraw : null),
		onNotice: (message) => shell.setNotice(message),
		onRefreshHostTools: () => shell.refreshHostTools(),
		selectHit: (hit) => commands.selectHit(hit),
		pan,
		orbit,
		zoom,
		submit,
		nowSeconds
	});

	stageKeyboard = createStageKeyboard({
		artworkEscape: () => artworkInteraction.escape(),
		previewActive: () => preview !== null,
		closePreview: () => previewController.close(),
		activeLayer: () => activeLayer,
		pressing: () => stageInput.pressing,
		dragMode: () => stageInput.drag?.mode ?? null,
		facade: () => facade,
		reducedMotion: () => shell.reducedMotion,
		nowSeconds,
		submit,
		setReading,
		zoom,
		fit,
		pan,
		pressDockSlot: (slot) => commands.pressDockSlot(slot),
		requestDelete: () => commands.requestDelete(),
		openCard: () => shell.setCardOpen(true),
		pendingDelete: () => shell.pendingDelete !== null,
		clearPendingDelete: () => { shell.setPendingDelete(null); shell.setNotice(''); },
		cancelFinishGesture: () => finishes.card.cancel(),
		interrupt: interruptPress,
		task: () => shell.task,
		closeTask: () => commands.closeTask(),
		armedHostTool: () => shell.armedHostTool,
		measureTool: () => shell.measureTool,
		eraserTool: () => shell.eraserTool,
		paintTool: () => shell.paintTool,
		clearEraseHover: () => shell.setEraseHover(null),
		clearPaintHover: () => shell.setPaintHover(null),
		paintKey: (key) => {
			if (key === 'tab') {
				if (!finishes.paintTray().colourEnabled) return false;
				paintTrayState.toggleTab(true);
			} else if (key === 'reach') {
				const next = shell.paintTool?.surfaceScope() === 'space' ? 'surface' : 'space';
				shell.paintTool?.setSurfaceScope(next);
			} else {
				if (finishes.dropperArmed) finishes.cancelDropper();
				else finishes.armDropper();
			}
			return true;
		},
		dismissAlign: () => {
			if (!finishes.align.active) return false;
			finishes.align.putBack();
			return true;
		},
		dismissMaterialEditor: () => {
			if (finishes.editor.open) {
				finishes.editor.close(true);
				return true;
			}
			if (finishes.libraryDraft !== null) {
				endLibraryDraft();
				return true;
			}
			return false;
		},
		dismissMaterialImport: () => {
			if (!materialImport.open) return false;
			materialImport.cancel();
			return true;
		},
		dismissRepairDrawer: () => {
			if (!repairDrawerOpen) return false;
			repairDrawerOpen = false;
			return true;
		},
		dismissPaint: () => {
			if (finishes.libraryDraft !== null) {
				endLibraryDraft();
				return true;
			}
			if (paintTrayState.wheelOpen) {
				// Paint colour closes first and hands focus back to Custom colour.
				paintTrayState.setWheelOpen(false);
				document.querySelector<HTMLElement>('[data-paint-wheel-open]')?.focus();
				return true;
			}
			if (finishes.dropperArmed) {
				finishes.cancelDropper();
				return true;
			}
			return paintTrayState.dismiss();
		},
		refreshHostTools: () => shell.refreshHostTools(),
		armedDockKey: () => dockKeys.find((key) => key.id === armedDockId),
		paletteOpen: () => shell.paletteOpen,
		closePalette: () => shell.setPaletteOpen(false),
		libraryOpen: () => shell.libraryOpen,
		toggleLibrary: () => closeLibrary(),
		activeWorldTool: () => shell.activeWorldTool,
		clearWorldTool: () => { shell.setLibraryOpen(false); shell.setActiveWorldTool('select'); },
		worldPlateOpen: () => shell.worldPlateOpen,
		closeWorldPlate: () => shell.setWorldPlateOpen(false),
		furnishStripOpen: () => shell.furnishStripOpen,
		closeFurnishStrip: () => shell.setFurnishStripOpen(false),
		toolbarFocused: () => {
			const active = document.activeElement;
			return active instanceof HTMLElement &&
				active.closest('[data-world-toolbar], [data-paint-tray]') !== null &&
				!active.matches('[data-world-select]');
		},
		focusSelectKey: () => document.querySelector<HTMLElement>('[data-world-toolbar] [data-world-select]')?.focus(),
		dismissSky: () => {
			if (!look.panelOpen) return false;
			look.setPanelOpen(false);
			document.querySelector<HTMLButtonElement>('[data-stage-environment-control]')?.focus();
			return true;
		},
		lens: () => experience.lensState,
		selectionPresent: () => selection !== null,
		closeSelection: () => commands.closeSelection(),
		leaveStudio: () => studio.active && studio.backToWorld(),
		liftActive: () => interiorLift.isActive(),
		putBackLift: () => interiorLift.putBack(),
		sliceDraftActive: () => sliceDraw.hasDraft(),
		cancelSliceDraft: () => sliceDraw.cancelDraft(),
		sliceActive: () => sliceReading.isActive(),
		putBackSlice,
		setCutawayHeld: (held) => nearWallCutaway.setHeld(held)
	});

	const selectedCurvedWall = $derived.by(() =>
		boot.status === 'ready' || boot.status === 'empty'
			? selectedCurvedWallOf(
				selection,
				boot.snapshot.domain.geometry,
				boot.snapshot.domain.datumMeters,
				evaluation?.pose.target ?? null,
				wallUnfoldViewCentreStation
			)
			: null
	);
	$effect(() => {
		const candidate = selectedCurvedWall;
		if (candidate === null) return;
		wallUnfold.ensureAnchor(candidate.wall, candidate.defaultStation);
	});

	const effectivePlanAppearance = $derived(
		finishes.align.active?.surface === 'floor' ? 'shaded' : shell.preferences.planAppearance
	);
	const paperVisible = $derived(isPaperPlanVisible(evaluation, effectivePlanAppearance));
	const modelUrls = $derived(stageAssets.urls);

	/**
	 * The overheads the live Lift reading has lifted: Room lids **and** authored
	 * region slabs. The route only maps Layout's sources to representation ids;
	 * which overheads a scope names is `overheadSourcesOf`'s answer.
	 * `VisitorPreviewSurface` never receives either list, so Preview stays as-built.
	 */
	const liftedSources = $derived.by(() => {
		const reading = interiorLift.reading;
		if (reading === null) return [];
		if (boot.status !== 'ready' && boot.status !== 'empty') return [];
		return overheadSourcesOf(boot.snapshot.domain.geometry, reading.scope);
	});
	const liftedRoomIds = $derived(
		liftedSources
			.filter((source) => source.key.kind === 'room-lid')
			.map((source) => source.subject.id)
	);
	const liftedRegionIds = $derived(
		liftedSources
			.filter((source) => source.key.kind === 'region')
			.map((source) => source.subject.id)
	);
	/** The selected Room, when the selection is one: a lift is selected through its Room. */
	const selectedLiftRoomId = $derived(
		selection !== null &&
			selection.reference.domain === 'layout' &&
			selection.reference.subject.kind === 'room'
			? selection.reference.subject.id
			: null
	);

	/**
	 * The entry rule, stated once: a Room selection wins, then the Room the eye is
	 * inside in 3D, then everything. Plan has no eye to be occupied by, and the
	 * reading never re-derives its scope after entry.
	 */
	function toggleLift(): void {
		if (interiorLift.isActive()) {
			interiorLift.putBack();
			return;
		}
		if (boot.status !== 'ready' && boot.status !== 'empty') return;
		interiorLift.lift(
			initialLiftScope({
				selectedRoomId: selectedLiftRoomId,
				reading: evaluation?.renderedReading === 'plan' ? 'plan' : '3d',
				eye: evaluation === null ? null : eyeOfInspectionPose(evaluation.pose),
				compiled: boot.snapshot.domain.geometry
			})
		);
	}

	const liftControl = $derived({ active: interiorLift.isActive(), toggle: toggleLift });

	/** X2's two-way switch, under Lift in the reading control's ▾ (never a pill). */
	const nearWallsControl = $derived({
		mode: nearWallCutaway.mode,
		set: (mode: 'cut' | 'whole') => nearWallCutaway.setMode(mode)
	});

	// Preview is an isolated visitor run: a held `W` never leaks into it.
	$effect(() => {
		if (preview !== null) nearWallCutaway.setHeld(false);
	});

	/**
	 * The Lift pill's reads. The scoped Room is named as its Card titles it, and the
	 * menu's candidate is the same rule entry uses: selected Room, occupied Room,
	 * then the Room already scoped. Everything else is Today's scope.
	 */
	const liftPill = $derived.by(() => {
		const reading = interiorLift.reading;
		if (reading === null) return null;
		const scopeRoomId = reading.scope.kind === 'space' ? reading.scope.roomId : null;
		const nameOf = (roomId: string | null): string | null =>
			roomId === null
				? null
				: (currentEnvelope?.units.layout.data.rooms.find((room) => room.id === roomId)?.name ??
					null);
		const geometry = boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.geometry : null;
		const occupiedRoomId =
			geometry === null || evaluation === null
				? null
				: (() => {
						const occupied = initialLiftScope({
							selectedRoomId: null,
							reading: '3d',
							eye: eyeOfInspectionPose(evaluation.pose),
							compiled: geometry
						});
						return occupied.kind === 'space' ? occupied.roomId : null;
					})();
		const candidateId = selectedLiftRoomId ?? occupiedRoomId ?? scopeRoomId;
		const candidateName = nameOf(candidateId);
		return {
			scopeRoomId,
			scopeLabel: nameOf(scopeRoomId),
			candidate:
				candidateId === null || candidateName === null
					? null
					: { id: candidateId, label: candidateName },
			onScope: (roomId: string | null) => {
				interiorLift.setScope(roomId === null ? { kind: 'all' } : { kind: 'space', roomId });
			},
			onPutBack: () => interiorLift.putBack()
		};
	});

	/**
	 * The live Slice, resolved against the Sheet. World only: Preview is the visitor's
	 * as-built world and never receives a cut.
	 */
	const resolvedSlice = $derived.by((): ResolvedSlice | null => {
		const reading = sliceReading.reading;
		if (reading === null) return null;
		if (experience.lensState !== 'world') return null;
		if (boot.status !== 'ready' && boot.status !== 'empty') return null;
		return resolveSlice(reading, {
			sheetHeight: shell.heightMeters,
			datumMeters: boot.snapshot.domain.datumMeters
		});
	});

	/**
	 * Publish the resolved reading to the plain-module pick providers.
	 *
	 * `layout.adapter.ts` is created by an adapter factory, not by a component, so it
	 * reads the same value through this mirror (the shape `liftedSourcesNow` already
	 * uses). Written here — the one place the value is derived — so no consumer can
	 * hold a cut the Canvas is not drawing.
	 */
	$effect(() => {
		setResolvedSlice(resolvedSlice);
	});

	/**
	 * X2 — the selection's host Walls (D9).
	 *
	 * A selected Wall, a selected Opening's host Wall, and a selected hung
	 * Artwork's **derived** host (O-1 keeps Scene objects as built; the derived host
	 * is what the as-built back-wall ray finds within 1 cm). These Walls are exempt
	 * from the cutaway so the thing the creator selected keeps its whole body.
	 */
	const cutawaySelectionHosts = $derived.by((): ReadonlySet<string> => {
		const hosts = new Set<string>();
		const entry = selection;
		const geometry =
			boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.geometry : null;
		if (entry === null || geometry === null) return hosts;
		if (entry.reference.domain === 'layout') {
			const subject = entry.reference.subject;
			if (subject.kind === 'wall') hosts.add(subject.id);
			else if (subject.kind === 'opening') {
				for (const wall of geometry.walls) {
					if (wall.openings.some((opening) => opening.openingId === subject.id)) hosts.add(wall.wallId);
				}
			}
		}
		const artwork = selectionViewView.selectedArtwork;
		const stage = facade;
		if (artwork !== null && stage !== null && experience.lensState === 'world') {
			const snapshot = stage.snapshot();
			// An as-built query, never the display predicate: a host is a document fact
			// (plan §3.6 step 8).
			const hit = artworkBackWallHit(artwork.position, artwork.rotation[1], (ray) =>
				scenePick.pickVisibleFace(ray, snapshot.domain.scene, (candidate) =>
					isArtworkWallFace(candidate, snapshot.domain.geometry)
				)
			);
			if (hit !== null && hit.wallId !== undefined && hit.distanceMeters <= 0.01) hosts.add(hit.wallId);
		}
		return hosts;
	});

	/** D12: Walls whose cap component failed close to whole until the next decision. */
	let cutawayFailedIds = $state<ReadonlySet<string>>(new Set());

	const cutawayEffective = $derived.by((): ReadonlySet<string> => {
		// Read the decision so the mask re-evaluates when classification changes.
		nearWallCutaway.classified;
		const effective = nearWallCutaway.effective(cutawaySelectionHosts);
		if (cutawayFailedIds.size === 0) return effective;
		const next = new Set<string>();
		for (const wallId of effective) if (!cutawayFailedIds.has(wallId)) next.add(wallId);
		return next;
	});
	/**
	 * Wall Align (T2.S8 U6) — a view-only mask while a wall side is faced: every
	 * other Wall in front of the faced plane is cut to the floor (picks pass
	 * through) and hidden, so nothing covers the surface being aligned. Hiding is
	 * what draws it: a cutaway twin of a plain material can reuse the uncut program
	 * (reported on the PR), so the cut alone is not relied on for display. Whole,
	 * the hold key and the classifier are ignored for the session, as Paper is
	 * during floor Align; no preference changes.
	 */
	const alignCutaway = $derived.by((): { readonly ids: readonly string[]; readonly top: number } | null => {
		const active = finishes.align.active;
		if (active === null || active.surface !== 'wall') return null;
		const ids = active.occluders.filter((wallId) => !cutawayFailedIds.has(wallId));
		return { ids, top: (active.corners[0]?.[1] ?? 0) + 0.005 };
	});
	const cutawayWallIds = $derived.by(() => {
		if (alignCutaway !== null) return alignCutaway.ids;
		const unfolded = wallUnfold.state?.wallId ?? null;
		return [...cutawayEffective].filter((wallId) => wallId !== unfolded).sort();
	});
	const cutawayStubTopY = $derived(alignCutaway !== null && alignCutaway.ids.length > 0 ? alignCutaway.top : nearWallCutaway.stubTopY);

	/**
	 * The one classification write (§3.3). Pose, geometry revision, reading and press
	 * state are the only inputs; selection, mode and hold are presentation masks.
	 */
	$effect(() => {
		const stage = facade;
		const current = evaluation;
		const snapshot = boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot : null;
		if (stage === null || snapshot === null || current === null) {
			if (nearWallCutaway.decision !== null) nearWallCutaway.reset();
			return;
		}
		const geometry = snapshot.domain.geometry;
		const reading =
			experience.lensState === 'world' && current.renderedReading === '3d'
				? '3d'
				: experience.lensState === 'world' && current.renderedReading === 'plan'
					? 'plan'
					: 'transition';
		const changed = nearWallCutaway.evaluate({
			eye: eyeOfInspectionPose(current.pose),
			target: current.pose.target,
			rooms: geometry.rooms,
			walls: geometry.walls,
			floors: geometry.floors,
			renderedReading: reading,
			geometryRevision: snapshot.domain.unitRevisions.layout,
			pressing: stageInput.drag !== null
		});
		// A new decision is the moment a D12 failure is retried.
		if (changed && cutawayFailedIds.size > 0) cutawayFailedIds = new Set();
	});

	$effect(() => {
		nearWallCutaway.setSelectionHosts(cutawaySelectionHosts);
	});

	/** Publish the effective set to the plain pick providers (the Slice mirror's shape). */
	$effect(() => {
		const ids = cutawayWallIds;
		const top = cutawayStubTopY;
		setResolvedCutaway(
			ids.length > 0 && top !== null ? { wallIds: new Set(ids), stubTopY: top } : null
		);
	});

	/** Plan's membership follows the cut: a finite depth narrows what Plan shows. */
	$effect(() => {
		const reading = resolvedSlice;
		if (facade === null) return;
		facade.setPlanParameters({
			depthMeters:
				reading === null
					? PLAN_DEFAULT_DEPTH_METERS
					: (planOverridesOf(reading).depthMeters ?? PLAN_DEFAULT_DEPTH_METERS)
		});
	});

	/**
	 * The Slice pill: **Cut at {h} m · depth ▾ · Put back**. Its depth rows are the
	 * Sheet's own ticks strictly below the cut, labelled as the Sheet labels them,
	 * and there are no disabled rows: an item that could not be below the cut is not
	 * offered at all.
	 */
	const slicePill = $derived.by(() => {
		const reading = sliceReading.reading;
		if (reading === null) return null;
		if (reading.kind === 'drawn') {
			return {
				mode: 'drawn' as const,
				cutLabel: 'Drawn cut',
				depthLabel: `${reading.depthMeters.toFixed(2)} m`,
				items: [],
				onDepth: () => {},
				onFlip: () => sliceDraw.flip(),
				onPutBack: () => putBackSlice()
			};
		}
		const items = sliceDepthItems({
			reading,
			sheetHeightMeters: shell.heightMeters,
			ticks: shell.heightTicks
		});
		const depth = reading.depth;
		const current =
			depth.kind === 'below'
				? items.find(
						(item) =>
							item.kind === 'below' &&
							Math.abs(item.meters - depth.meters) <= 1e-3
					)
				: undefined;
		const depthLabel =
			depth.kind === 'below'
				? (current?.label ?? `${depth.meters.toFixed(2)} m below`)
				: 'To the floor';
		return {
			cutLabel: shell.heightMeters.toFixed(2),
			depthLabel,
			items: items.map((item) =>
				item.kind === 'below'
					? { kind: item.kind, label: item.label, checked: item.checked, meters: item.meters }
					: { kind: item.kind, label: item.label, checked: item.checked }
			),
			onDepth: (item: { readonly kind: 'to-floor' | 'below'; readonly meters?: number }) => {
				sliceReading.setDepth(
					item.kind === 'below' && item.meters !== undefined
						? { kind: 'below', meters: item.meters }
						: { kind: 'to-floor' }
				);
			},
			onPutBack: () => putBackSlice()
		};
	});

	function putBackSlice(): void {
		sliceDraw.disarm();
		sliceReading.putBack();
		shell.setActiveWorldTool('select');
	}

	/**
	 * A scoped Space that stops compiling (deleted, merged, undone away) ends the
	 * reading in words instead of leaving a pill pointing at nothing. This is a
	 * read-side reconciliation: it writes no document and no history.
	 */
	$effect(() => {
		const reading = interiorLift.reading;
		if (reading === null || reading.scope.kind !== 'space') return;
		if (boot.status !== 'ready' && boot.status !== 'empty') return;
		const roomId = reading.scope.roomId;
		if (boot.snapshot.domain.geometry.rooms.some((room) => room.roomId === roomId)) return;
		interiorLift.clear();
		shell.setNotice('Lift ended: the Space is gone.');
	});


	let renderRootsRevision = $state(0);
	$effect(() => scenePick.onRenderRootsChanged(() => (renderRootsRevision += 1)));
	// A frame that waited for the scoped body to mount is retried as bodies change.
	$effect(() => {
		void renderRootsRevision;
		untrack(() => studio.retryFrame());
	});
	// Open the posture named by the address once, when the project is on the Stage.
	let studioOpened = false;
	$effect(() => {
		if (!studioEntry.studio || studioOpened) return;
		if ((boot.status !== 'ready' && boot.status !== 'empty') || facade === null) return;
		studioOpened = true;
		// Open editable copy: only a freshly minted project takes it, at the datum, through
		// the Place instrument's ordinary typed Place.
		if (studioEntry.copyId !== null && intent === 'create') {
			requestFormCopyIntake(projectId, { itemId: studioEntry.copyId, mode: 'datum' });
		}
		untrack(() => studio.openFromEntry({ objectId: studioEntry.objectId, minted: intent === 'create' }));
	});
	// Place copy in World: arm the saved copy once the project is on the Stage; the creator
	// then clicks where it goes, through the same Place session as My Objects.
	let placeCopyArmed = false;
	/**
	 * The way back from a cross-project Place copy, while one is pending. Read once: it
	 * belongs to this arrival, and a different project's visit never inherits it.
	 */
	let transfer = $state<FormCopyTransfer | null>(
		placeCopyItem !== null && peekFormCopyTransfer()?.itemId === placeCopyItem && peekFormCopyTransfer()?.sourceProjectId !== projectId
			? peekFormCopyTransfer()
			: null
	);
	/** The intended copy landed: its exact minted entity id is in the accepted source. */
	function settleTransfer(): void {
		if (transfer === null) return;
		const entities = facade?.snapshot().domain.scene.entities ?? [];
		if (!copyLanded(transfer, entities)) return;
		transfer = null;
		endFormCopyTransfer();
	}
	function returnToObject(): void {
		if (transfer === null) return;
		const back = transfer;
		void goto(studioProjectUrl(back.sourceProjectId, { load: true, object: back.objectId })).then(() => {
			endFormCopyTransfer();
		});
	}
	const transferArmed = $derived(shell.task !== null || shell.activeWorldTool === 'objects' || shell.libraryOpen);
	$effect(() => {
		if (placeCopyItem === null || placeCopyArmed || studioEntry.studio) return;
		if ((boot.status !== 'ready' && boot.status !== 'empty') || facade === null) return;
		if (!dockKeys.some((key) => key.slot === 'library')) return;
		placeCopyArmed = true;
		requestFormCopyIntake(projectId, { itemId: placeCopyItem, mode: 'arm', entityId: transfer?.entityId });
		untrack(() => commands.armWorldTool('objects'));
		// One-shot: a reload must not re-arm a copy the creator already placed or dismissed.
		const url = new URL(window.location.href);
		if (url.searchParams.has(PLACE_COPY_PARAM)) {
			url.searchParams.delete(PLACE_COPY_PARAM);
			replaceState(`${url.pathname}${url.search}`, {});
		}
	});
	$effect(() => {
		if (!studioArmPending) return;
		if (!studio.active) {
			studioArmPending = false;
			return;
		}
		if (!dockKeys.some((key) => key.slot === 'library')) return;
		studioArmPending = false;
		untrack(() => commands.armWorldTool('objects'));
	});
	// A creation gesture that ends with no new form returns the creator to the scoped root.
	$effect(() => {
		if (!studio.creating || studioArmPending) return;
		if (shell.task !== null || shell.activeWorldTool === 'objects' || shell.libraryOpen) return;
		untrack(() => studio.cancelCreation());
	});
	const contentBounds = createStageContentBounds({
		renderRootsRevision: () => renderRootsRevision,
		snapshot: ready.snapshot,
		facade: () => facade
	});
	const stageContentBounds = $derived(contentBounds.stage);
	const paperContentBounds = $derived(contentBounds.paper);

	function canPlaceArtwork(): boolean {
		return experience.lensState === 'world' && preview === null && wallUnfold.state === null;
	}

	installLeaveProject(lifecycleCell);
	$effect(() => {
		if (experience.lensState === 'world') return;
		// The Slice reads the world Stage: leaving the lens ends it exactly as a replaced
		// project does, or the pill would offer a cut over an uncut Stage.
		if (!sliceReading.isActive()) return;
		sliceDraw.disarm();
		sliceReading.clear();
		setResolvedSlice(null);
	});
	$effect(() => {
		// Changing the World row away from Slice ends the drawn gesture; the cut
		// itself stays and is edited after Put back or under Select as usual.
		if (shell.activeWorldTool !== 'slice' && sliceDraw.armed) sliceDraw.disarm();
	});
	$effect(() => {
		if (boot.status !== 'ready' && boot.status !== 'empty') artworkInteraction.cancel();
		if (!canPlaceArtwork()) {
			artworkInteraction.cancel();
			artworkInteraction.cancelResize();
		}
	});

	const selectedArtwork = $derived(selectionViewView.selectedArtwork);
	const hangingCandidate = $derived(artworkInteraction.hangingCandidate);
	const hangingGuides = $derived.by(() => {
		const stage = facade;
		const candidate = hangingCandidate;
		if (stage === null || candidate === null) return [];
		const snapshot = stage.snapshot();
		return artworkHangingGuides(snapshot.domain.scene, candidate, snapshot.domain.datumMeters);
	});
	const activeHangingGuide = $derived.by(() => {
		const candidate = hangingCandidate;
		return candidate === null ? null : activeArtworkHangGuide(hangingGuides, candidate.position[1]);
	});
	const lookCardStratum = $derived.by(() => {
		void shell.contributionsVersion;
		const subject = selectionViewView.cardSubject;
		const entity = subject?.reference?.domain === 'scene'
			? selectionViewView.scenePayload?.entities.find((entry) => entry.id === subject.sourceId)
			: undefined;
		return (entity?.kind === 'artwork' ? artworkInteraction.card(entity) : null) ?? look.cardStratum(subject);
	});
	const worldCard = $derived(stageWorldCardView({
		facade,
		subject: selectionViewView.cardSubject,
		datumMeters: experienceFloorDatum,
		look: lookCardStratum,
		revision: shell.contributionsVersion
	}));
	const experienceShownCard = $derived.by(() => experience.cardView({
		services: adapterServices,
		selection,
		sceneSubject: experience.sceneSubject,
		cardIdentity: selectionViewView.cardIdentity,
		bring: () => {
			const target = selectionViewView.selectedWorldPoint();
			if (target !== null) bringIntoView(target);
		},
		selectStageReference: (reference) => commands.selectStageReference(reference),
		referenceLabel: (reference) => selectionViewView.referenceLabel(reference)
	}));
	const shownCard = $derived.by(() => {
		if (experience.lensState === 'experience') return experienceShownCard;
		return {
			identity: selectionViewView.cardIdentity,
			facts: worldCard.facts,
			nameWriter: worldCard.nameWriter,
			writer: worldCard.writer,
			// Studio offers only what it owns: no World functions (Paint, Section, Present),
			// no Look recipes; the facade withholds Duplicate/Delete of the root being edited.
			actions: worldCard.actions,
			functions: studio.active ? [] : null,
			kindLink: null,
			menu: null,
			back: null,
			bringIntoView: () => {
				const target = selectionViewView.selectedWorldPoint();
				if (target !== null) bringIntoView(target);
			}
		};
	});

	function toggleReveal(sourceId: string): void {
		revealed = revealed.includes(sourceId)
			? revealed.filter((id) => id !== sourceId)
			: [...revealed, sourceId];
	}

	projectSession.bindNavigation();

	function resetLayoutReadings(): void {
		// A replaced project starts with no Wall Face, Lift, Slice or cutaway.
		wallFace.clear();
		clearProjectReadings();
		cutawayFailedIds = new Set();
	}

	function clearProjectReadings(): void {
		interiorLift.clear();
		sliceDraw.disarm();
		sliceReading.clear();
		setResolvedSlice(null);
		nearWallCutaway.reset();
		setResolvedCutaway(null);
	}

	function endMaterialOperations(restoreCamera: boolean): boolean {
		finishes?.card.cancel();
		if (restoreCamera && finishes?.align.active && !finishes.align.putBack(false)) return false;
		if (!restoreCamera) finishes?.align.clear();
		finishes?.editor.close(false);
		finishes?.cancelLibraryDraft();
		finishes?.cancelImage();
		finishes?.issues.cancelRepairs();
		materialImport.cancel(false);
		repairDrawerOpen = false;
		return true;
	}

	function nowSeconds(): number {
		return shell.nowSeconds();
	}

	function refresh(): void {
		stageViewport.refresh();
	}

	function stageCss(event: PointerEvent): [number, number] {
		const current = rect ?? stageViewport.measure();
		return [event.clientX - current.left, event.clientY - current.top];
	}

	function capturePointer(target: Element, pointerId: number): boolean {
		try {
			target.setPointerCapture(pointerId);
			return true;
		} catch {
			return false;
		}
	}

	function absoluteCss(event: PointerEvent): [number, number] {
		return [event.clientX, event.clientY];
	}

	function clearHover(): void {
		stageInput.clearHover();
	}

	function interruptPress(reason: StageInterruptionReason): void {
		stageInput.interrupt(reason);
	}

	/**
	 * The Align surface region in canvas-local CSS px, from JS-known shell values
	 * only (no DOM measurement). It mirrors the overlay CSS: the Stage inset
	 * (10 px; 14 px above the lower column), the Index lane above 860 px, the
	 * Card lane, then the bar (41 px, or 107 px wrapped in a narrow region), the
	 * note (46 px) and the ruler padding (l 44, r 24, t 20, b 40).
	 */
	function alignRegion(viewport: { readonly width: number; readonly height: number }): { x: number; y: number; width: number; height: number } | null {
		const windowWidth = typeof window === 'undefined' ? viewport.width : window.innerWidth;
		const indexCover = preview === null && shell.indexOpen && windowWidth > 860 ? ALIGN_INDEX_LANE_PX : 0;
		const left = indexCover + 10;
		const right = viewport.width - ALIGN_CARD_COVER_PX - 10;
		const bar = right - left < 640 ? 107 : 41;
		const top = 10 + bar;
		const bottom = viewport.height - shell.lowerColumnHeight - 14 - 46;
		const region = { x: left + 44, y: top + 20, width: right - left - 44 - 24, height: bottom - top - 20 - 40 };
		return region.width > 40 && region.height > 40 ? region : null;
	}

	function alignFraming(
		fit: { readonly center: readonly [number, number, number]; readonly surfaceMeters: readonly [number, number] },
		axes: { readonly right: readonly [number, number, number]; readonly up: readonly [number, number, number] },
		viewport: { readonly width: number; readonly height: number }
	) {
		const region = alignRegion(viewport);
		if (region === null) return null;
		return regionFraming({ center: fit.center, right: axes.right, up: axes.up, surfaceMeters: fit.surfaceMeters, canvas: viewport, region });
	}

	// A6 — the Face reading's one camera port. The route owns the session clock and
	// the reduced-motion rule; the Layout adapter supplies only bounds and a look
	// direction, and Put back restores the exact standpoint Face started from.
	$effect(() => {
		wallFace.setCameraPort({
			standpoint: () => facade?.camera.state() ?? null,
			face: (frame, fit) => {
				const stage = facade;
				const viewport = rect;
				if (stage === null || viewport === null) return false;
				// Align (U6): frame the surface inside the chrome-free region, not the
				// whole canvas. Plain Face keeps its conservative whole-canvas frame.
				const axes = faceScreenAxes(frame.look);
				const framing = fit === undefined ? null : alignFraming(fit, axes, viewport);
				const result = submit(
					framing === null
						? { kind: 'face', bounds: frame.bounds, look: frame.look, rect: viewport }
						: { kind: 'face', bounds: faceBoundsOf(framing, axes.right), look: frame.look, rect: viewport, paddingFraction: 0 },
					readingIntentClockSeconds(shell.reducedMotion, nowSeconds())
				);
				return result?.kind === 'accepted';
			},
			frameFloor: (bounds, fit) => {
				const stage = facade;
				const viewport = rect;
				if (stage === null || viewport === null) return false;
				const t = readingIntentClockSeconds(shell.reducedMotion, nowSeconds());
				const current = stage.camera.state();
				if (current.reading !== 'plan') {
					const flip = submit({ kind: 'set-reading', reading: 'plan' }, t);
					if (flip?.kind !== 'accepted') return false;
				}
				// Plan snaps its azimuth to a quarter turn; frame with the axes it lands on.
				const framing = fit === undefined ? null : alignFraming(fit, planScreenAxes(current.pose.azimuthRadians), viewport);
				const fitted = submit(
					framing === null
						? {
								kind: 'fit',
								bounds: {
									min: [bounds.min[0], bounds.min[1], bounds.min[2]],
									max: [bounds.max[0], bounds.max[1], bounds.max[2]]
								},
								rect: viewport,
								paddingFraction: 0.14
							}
						: { kind: 'fit', bounds: planFitBoundsOf(framing), rect: viewport, paddingFraction: 0 },
					t
				);
				return fitted?.kind === 'accepted';
			},
			putBack: (entry) => facade?.camera.restoreStandpoint(entry) ?? false
		});
		return () => {
			wallFace.setCameraPort(null);
			wallFace.clear();
		};
	});

	$effect(() => {
		wallUnfold.setCameraExecutor((request) => {
			const stage = facade;
			const current = stage?.evaluation() ?? null;
			if (stage === null || current === null) return false;
			const ticket = stage.inspectionTicket();
			if (ticket === null) return false;
			const camera = stage.camera.state();
			if (!wallUnfoldShouldReturn({
				entryAdjusted: request.entryAdjusted,
				settled: request.settled,
				current: { pose: camera.pose, reading: camera.reading }
			})) return false;
			return stage.requestViewingIntent(
				{
					kind: 'set-view',
					eye: eyeOfInspectionPose(request.pose),
					target: request.pose.target,
					fovYDegrees: fovYDegreesOf(request.pose),
					transition: true
				},
				ticket,
				performance.now() / 1000
			).kind === 'accepted';
		});
		return () => wallUnfold.setCameraExecutor(null);
	});

	const history = createStageHistoryCommand({ epoch: stageEpoch, lifecycle: lifecycleCell.get });
	const listeners = createStageWindowListeners({
		keyboard: stageKeyboard,
		suspendSnap: shell.suspendSnap,
		lifecycle: lifecycleCell.get
	});
	installStageMount(lifecycleCell);

	const core = createCoreLifecycleSteps({
		projectId, intent, projectSession, stageEpoch, session,
		facade: () => facade,
		setSelection: (entry) => { selection = entry; },
		clearRevealed: () => { revealed = []; },
		assets: stageAssets,
		shell, commands, stageInput, history, viewing, listeners,
		viewport: stageViewport
	});
	const lifecycle = createFeatureLifecycle({
		core,
		features: [
			lightInspection,
			{
				id: 'appearance',
				lifecycle: {
					interruptForReplacement: {
						'end-operations-no-camera': () => { endMaterialOperations(false); },
						'reset-issues': () => finishes?.issues.reset()
					},
					historyStep: { 'cancel-card-gesture': () => { finishes.card.cancel(); } },
					readingChange: { 'cancel-card-gesture': () => { finishes.card.cancel(); } },
					settlePending: { 'cancel-card-gesture': () => { finishes.card.cancel(); } },
					leaveLens: {
						'end-operations-restore-camera': (next) => {
							if (next !== 'world' && experience.lensState === 'world') return endMaterialOperations(true);
						}
					},
					windowBlur: { 'cancel-card-gesture': () => { finishes?.card.cancel(); } },
					leaveProject: { 'cancel-image': () => finishes?.cancelImage() },
					dispose: {
						'end-operations-no-camera': () => { endMaterialOperations(false); },
						'reset-issues': () => finishes.issues.reset()
					}
				}
			},
			{
				id: 'experience',
				lifecycle: {
					resetFocus: { 'reset-focus': () => experienceFocus.reset() },
					leaveLens: { 'change-lens': (next) => experience.changeLens(next) },
					start: { start: () => experience.start() },
					dispose: { dispose: () => experience.dispose() }
				}
			},
			{
				id: 'studio',
				lifecycle: {
					resetPresentation: { end: () => studio?.end() },
					accepted: { reconcile: () => studio?.reconcile(), 'settle-transfer': settleTransfer },
					historyInstalled: { reconcile: () => studio?.reconcile() },
					leaveLens: {
						'leave-for-lens': (next) => {
							if (next !== 'world' && studio !== undefined) return studio.leaveForLens();
						}
					}
				}
			},
			{
				id: 'layout-readings',
				lifecycle: {
					resetPresentation: { reset: resetLayoutReadings },
					windowBlur: { 'release-hold': () => nearWallCutaway.setHeld(false) },
					leaveProject: { 'clear-readings': clearProjectReadings },
					dispose: {
						'dispose-unfold': () => unfoldGestures.dispose(),
						'release-hold': () => nearWallCutaway.setHeld(false),
						'clear-cutaway-mirror': () => setResolvedCutaway(null)
					}
				}
			},
			{
				id: 'artwork',
				lifecycle: {
					resetPresentation: {
						cancel: () => {
							artworkInteraction.cancel();
							artworkInteraction.cancelResize();
						}
					},
					settlePending: { cancel: () => { artworkInteraction.cancel(); } },
					leaveProject: { dispose: () => artworkInteraction.dispose() }
				}
			}
		]
	});

	lifecycleCell.set(lifecycle);

	// The Stage input handlers are named once and passed as a group to the region.
	const viewportInput = {
		pointerDown: (event: PointerEvent) => stageInput.pointerDown(event),
		pointerMove: (event: PointerEvent) => stageInput.pointerMove(event),
		pointerUp: (event: PointerEvent) => stageInput.pointerUp(event),
		pointerCancel: (event: PointerEvent) => stageInput.pointerCancel(event),
		lostPointerCapture: (event: PointerEvent) => stageInput.lostPointerCapture(event),
		click: (event: MouseEvent) => stageInput.click(event),
		wheel: (event: WheelEvent) => stageInput.wheel(event),
		pointerLeave: () => { clearHover(); artworkInteraction.leave(); },
		dragOver: (event: DragEvent) => { if (artworkInteraction.acceptsDrop(event.dataTransfer)) event.preventDefault(); },
		drop: (event: DragEvent) => artworkInteraction.drop(event),
		contextMenu: (event: MouseEvent) => { if (lookThroughActiveNow()) event.preventDefault(); }
	};

	const dialPlacement = $derived.by(() => {
		if (!look.panelOpen || experience.lensState !== 'world' || preview !== null ||
			shell.task !== null || shell.armedHostTool !== null || look.studioWhileEditing ||
			look.sky?.preset === 'studio' || !look.sky || !evaluation || !facade) return null;
		void stageContentBounds;
		const domain = facade.snapshot().domain;
		const geometry = domain.geometry;
		const datum = domain.datumMeters;
		const boxes = [
			...geometry.walls.map((wall) => wall.bounds3),
			...domain.scene.entities.flatMap((entity) => {
				const bounds = facade?.sceneBounds(entity.id);
				return bounds ? [bounds] : [];
			})
		];
		// Client rects: placement tests them against `dialProject`, which is in the
		// viewport frame (`camera.rect`), not the stage-local frame of the marks.
		const obstacles = [skyRects.panel, skyRects.dock, ...skyRects.fixed].flatMap((rect) => {
			if (!rect || rect.width <= 0) return [];
			return [{ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }];
		});
		const origin = sunMarkAnchor({ bounds: stageContentBounds, groundY: datum + 0.008 });
		return placeCelestialDial(origin, evaluation, obstacles, ([x, , z]) => boxes.some(({ min, max }) =>
			max[1] > datum + 0.05 && min[1] <= datum + 0.3 && x >= min[0] && x <= max[0] && z >= min[2] && z <= max[2]),
		([x, , z]) => geometry.rooms.length === 0 || geometry.rooms.some(({ floorPolygon }) => pointInPolygon([x, z], floorPolygon)), geometry.bounds);
	});
	const dial = $derived(dialPlacement ? celestialDialModel(look.shownSky, dialPlacement) : null);
	$effect(() => adapterServices ? bindSkySession(adapterServices.stage.session, { look, dial: () => dial }) : undefined);

	const coreRegions = createCoreRegionViews({
		projectId, heightSheet, project: projectSession, shell, history, scenePick, lightPreview,
		facade: () => facade,
		snapshot: ready.snapshot,
		viewport: stageViewport,
		stageInput,
		commands,
		historyState: () => historyState,
		assets: stageAssets,
		planAppearance: () => effectivePlanAppearance,
		paperContentBounds: () => paperContentBounds,
		snapshotBounds: () => stageContentBounds,
		selection: () => selection,
		studioSuppressesPlan: () => studio.active && studio.context === 'mat',
		lookThroughActive: lookThroughActiveNow,
		lens: () => experience.lensState,
		previewing: () => preview !== null,
		paperVisible: () => paperVisible,
		cursor: () => stageCursor,
		lookThrough: () => viewportLookThrough,
		viewportInput,
		canvas: () => canvas,
		overlay: () => overlay,
		downloadSource: downloadSourceJson,
		locationLabel: () => selectionViewView.locationLabel,
		findEntries: () => findView.entries,
		projectActionsUnavailableReason: () => projectActionsUnavailableReason,
		rects: () => skyRects,
		index: () => indexRegion,
		card: () => cardRegion,
		inactiveTask: () => inactiveTaskRegion,
		worldToolbar: () => worldRegion,
		instrument: () => instrumentRegion,
		show: () => showRegion
	});

	const canvas = $derived.by(() => {
		const snapshot = ready.snapshot();
		if (snapshot === null) return null;
		const coreCanvas = coreRegions.canvas(snapshot);
		const features = {
			get dial() { return dial; },
			get scene() {
				const accepted = ready.snapshot()?.domain.scene;
				return accepted === undefined ? snapshot.domain.scene : withFinishInstancePreview(accepted, libraryDraftPreview ?? finishes.card.preview);
			},
			get artworkScope() { return stageAssets.artworkScope; },
			get artworkGhost() { return artworkInteraction.resizeGhost ?? artworkInteraction.ghost; },
			onArtworkError: (message: string) => shell.setNotice(message),
			get studio() {
				void studioRevision;
				return studio.active ? { rootId: studio.rootId, context: studio.context } : null;
			},
			get sky() { return look.stageSky; },
			get proposals() { return finishes.card.proposalEntries(); },
			get liftedRoomIds() { return liftedRoomIds; },
			get liftedRegionIds() { return liftedRegionIds; },
			get liftSources() { return liftedSources; },
			get cutawayWallIds() { return cutawayWallIds; },
			get cutawayStubTopY() { return cutawayStubTopY; },
			get alignHiddenWallIds() { return alignCutaway?.ids ?? []; },
			onCutawayFailure: (wallIds: readonly string[]) => {
				cutawayFailedIds = new Set([...cutawayFailedIds, ...wallIds]);
			},
			get resolvedSlice() { return resolvedSlice; },
			get sliceDraft() { return sliceDraftWorld; },
			get unfoldPinHovered() { return unfoldGestures.pinHovered; },
			get unfoldPinActive() { return unfoldGestures.sheetPinActive; },
			unfoldAnchorPin: unfoldGestures.idlePin?.point ?? null,
			onFinishOutcome: finishes.issues.recordOutcome,
			get repairAffectedTargets() { return finishes.issues.hatchedTargets; }
		};
		// Assemble descriptors once per admitted source so Svelte reads each
		// Canvas getter independently of the other regions and source props.
		return Object.defineProperties(coreCanvas, Object.getOwnPropertyDescriptors(features)) as typeof coreCanvas & typeof features;
	});

	/**
	 * World → canvas-local CSS px through the live Camera evaluation, for the
	 * Align overlay. Null while there is no evaluation; the overlay then shows
	 * a waiting line and disables its handles instead of inventing a frame.
	 */
	const alignProject = $derived.by(() => {
		const stage = facade;
		const current = evaluation;
		if (finishes.align.active === null || stage === null || current === null) return null;
		const id = stage.evaluationId();
		if (id === null) return null;
		const left = current.rect.left;
		const top = current.rect.top;
		return (point: readonly [number, number, number]): readonly [number, number] | null => {
			const projected = stage.projectWorld(point, id);
			return projected.kind === 'projected' ? [projected.css[0] - left, projected.css[1] - top] : null;
		};
	});

	// Re-frame Align when its chrome-free region changes (resize, Index toggled,
	// lower column resized). The first run per Align only records the region.
	/** The Align target's Finish, re-read whenever an adapter commit lands (the Card's own signal). */
	const alignInspectedNow = $derived.by(() => {
		void shell.contributionsVersion;
		const active = finishes.align.active;
		return active === null ? null : finishes.card.inspectedOf(active.target);
	});

	// Align belongs to the Card's open user: deselect, delete, another surface or
	// Back ends it exactly as Put back does (U6 lifecycle).
	$effect(() => {
		const active = finishes.align.active;
		if (active === null) return;
		if (finishes.card.focusedKey === finishCardTargetKey(active.target)) return;
		untrack(() => finishes.align.putBack(false));
	});

	let alignRegionKey: string | null = null;
	let alignRegionFor: object | null = null;
	$effect(() => {
		const active = finishes.align.active;
		const viewport = rect;
		if (active === null || viewport === null) {
			alignRegionFor = null;
			return;
		}
		const key = JSON.stringify(alignRegion(viewport));
		if (alignRegionFor !== active) {
			alignRegionFor = active;
			alignRegionKey = key;
			return;
		}
		if (key === alignRegionKey) return;
		alignRegionKey = key;
		untrack(() => finishes.align.reframe());
	});

	/** The live drawn proposal in both worlds: one for the ink, one for the tag. */
	const sliceDraftWorld = $derived.by(() => {
		const draft = sliceDraw.view().draft;
		return draft === null ? null : { start: draft.start, end: draft.end };
	});
	const sliceDraftOverlay = $derived.by(() => {
		const draft = sliceDraw.view().draft;
		const stage = facade;
		const id = stage?.evaluationId() ?? null;
		const rect = evaluation?.rect ?? null;
		if (draft === null || stage === null || id === null || rect === null) return null;
		const project = (point: readonly [number, number, number]): readonly [number, number] | null => {
			const projected = stage.projectWorld(point, id);
			return projected.kind === 'projected'
				? [projected.css[0] - rect.left, projected.css[1] - rect.top]
				: null;
		};
		const from = project(draft.start);
		const to = project(draft.end);
		return from === null || to === null ? null : { from, to, label: draft.label };
	});

	const overlay = $derived({
		...coreRegions.overlay,
		celestial: dial && evaluation ? { dial, camera: evaluation, haze: look.shownSky.haze, owner: look.gesture.owner } : null,
		marks: [...coreRegions.overlay.marks!, ...look.stageMarks],
		candidates: [...coreRegions.overlay.candidates!, ...(artworkInteraction.placementCandidate === null ? [] : [artworkInteraction.placementCandidate])],
		sliceDraft: sliceDraftOverlay
	});

	const stageCursor = $derived(readStageCursor({
		viewEditKind: () => experience.viewEdit?.kind ?? null,
		dragMode: () => stageInput.drag?.mode ?? null,
		taskKind: () => shell.task?.kind ?? null,
		lookThroughActive: lookThroughActiveNow,
		placingView: () => experience.experienceTool === 'place',
		hoverMove: () => stageInput.hoverMove,
		toolArmed: () => shell.armedHostTool !== null
	}));

	const viewportLookThrough = $derived.by(() => {
		const lightFrame = lightInspection.frame;
		if (lightFrame !== null) return lightFrame;
		const current = experience.lookThroughSession();
		if (current === null) return null;
		return {
			mode: 'view' as const,
			label: current.label,
			moved: experience.lookThroughMoved(),
			confirm: experience.lookThroughConfirm(),
			canUpdate: !(experience.active?.busy ?? false),
			onUpdate: (): void => void experience.updateLookThrough(experience.lookThroughConfirm() !== null),
			onExit: (): void => experience.exitLookThrough(),
			onCapture: (): void => void experience.captureProvisional(),
			onClearConfirm: (): void => experience.clearLookThroughConfirm()
		};
	});


	const viewportPreview = $derived.by(() => {
		if (previewSurface === null || previewViewRead === null) return null;
		const entry = previewView?.entry ?? null;
		const read = previewViewRead;
		return {
			surface: previewSurface,
			props: {
				geometry: read.geometry,
				scene: read.scene,
				graph: read.graph,
				program: entry === null ? null : entry.kind === 'presentations' ? (entry.program ?? null) : entry.program,
				experienceOptions: entry === null ? null : entry.kind === 'presentations' ? (entry.options ?? null) : entry.options,
				entryPresentationId: entry?.kind === 'program' ? entry.entryPresentationId : null,
				runEpoch: previewView?.epoch ?? 0,
				active: preview !== null,
				resolveTexture: (uri: string) => isAllowedShippedTextureUri(uri) ? uri : null,
				modelUrls,
				textureScope: stageAssets.textureScope,
				artworkScope: previewController.artworkScope,
				reducedMotion: shell.reducedMotion,
				title: entry?.title ?? null,
				experienceTitle: entry?.title ?? null,
				startMode: previewRequestedMode ?? (entry?.kind === 'program' && entry.entryPresentationId !== null ? 'presentation' : 'welcome'),
				guideStopCount: previewGuideStats.stops,
				guideSeconds: previewGuideStats.seconds,
				viewLabels: previewViewLabels,
				onExit: previewController.close,
				sky: look.sky
			},
			active: preview !== null
		};
	});

	const showRegion = $derived.by((): RegionProps['toolbars']['show'] => (preview === null && experience.lensState === 'experience'
		? {
			open: shell.showOpen,
			mode: shell.showMode,
			markers: shell.showMarkers,
			frustums: shell.showFrustums,
			paths: shell.showPaths,
			labels: shell.showLabels,
			offCount: shell.showOffCount,
			hidden: lookThroughActiveNow(),
			onToggle: () => shell.setShowOpen(!shell.showOpen),
			onClose: () => shell.setShowOpen(false),
			onMode: (mode) => shell.setShowMode(mode),
			onMarkers: (value) => shell.setShowMarkers(value),
			onFrustums: (value) => shell.setShowFrustums(value),
			onPaths: (value) => shell.setShowPaths(value),
			onLabels: (value) => shell.setShowLabels(value),
			onShowAll: () => shell.showAll()
		}
		: null));
	const worldRegion = $derived.by((): RegionProps['toolbars']['world'] => (preview === null && experience.lensState === 'world'
		? {
			studio: studio.active,
			activeTool: shell.activeWorldTool,
			libraryOpen: shell.libraryOpen,
			plateOpen: shell.worldPlateOpen,
			requestedCategory: shell.libraryCategoryRequest,
			onPlateOpen: (open: boolean) => shell.setWorldPlateOpen(open),
			onTool: (id) => commands.armWorldTool(id),
			onLibrary: () => (shell.libraryOpen ? closeLibrary() : commands.toggleWorldLibrary('dock')),
			furnishOpen: shell.furnishStripOpen,
			onFurnish: () => commands.toggleFurnishStrip(),
			onFurnishBrowse: () => commands.browseFurnish(),
			onObjectPick: (assetId: string) => commands.pickWorldObject(assetId),
			onMaterialPick: look.pickMaterial,
			finishShelf,
			onFinishPick: (ref) => {
				// Library opened from the Paint tray: a pick arms Paint and hands back to the tray.
				const fromPaint = shell.armedHostTool === 'paint';
				void finishes.pickFinish(ref);
				if (fromPaint && shell.libraryOpen) commands.armWorldTool('paint');
			},
			finishTileSource,
			finishImage: finishes.image,
			onFinishImageImport: (file: File) => void finishes.addFromImage(file),
			onFinishImageCancel: () => finishes.cancelImage(),
			onFinishImageRetry: () => void finishes.retryImageUpload(),
			onFinishImageReset: () => finishes.resetImage(),
			lookShelf: look.libraryShelf,
			artworkShelf: selectionViewView.scenePayload === null ? null : selectionViewView.scenePayload.artworkLibrary ?? [],
			onArtworkPick: (entry) => { commands.selectTool(); artworkInteraction.arm(entry); },
			onArtworkImport: (files: File[]) => { commands.selectTool(); void artworkInteraction.importFiles(files); },
			onLookPick: look.pickLibraryEntry,
			trayOwnsPlate: shell.armedHostTool === 'paint' && preview === null && !shell.libraryOpen,
			paintChip: paintTray.active === null ? null : { color: paintTray.active.color, shape: paintTray.active.kind === 'colour' ? 'colour' : 'material', source: paintTray.active.kind === 'finish' ? paintTileSource(paintTray.active.key, finishTileSource) : null },
			plateKind: shell.activeWorldTool === 'walls' || shell.activeWorldTool === 'opening' || shell.activeWorldTool === 'room' || shell.activeWorldTool === 'terrace' || shell.activeWorldTool === 'roofline' ? 'ink' : shell.activeWorldTool === 'objects' ? 'objects' : shell.activeWorldTool === 'slice' ? 'slice' : null,
			inkReading: shell.inkReading,
			sliceMode: sliceReading.reading?.kind ?? null,
			sliceDrawing: sliceDraw.armed,
			onSliceLevel: () => { sliceDraw.disarm(); sliceReading.level(); },
			onSliceDrawn: () => { sliceDraw.arm(); shell.setActiveWorldTool('slice'); },
			onTogglePalette: () => shell.togglePalette()
		}
		: null));
	const instrumentRegion = $derived.by((): RegionProps['toolbars']['instrument'] => (preview === null && contributedInstrument !== null && (contributedInstrument.presentation !== 'palette' || shell.paletteOpen)
		? {
			task: taskHost,
			onClose: () => commands.closeTask(),
			onCollapse: () => shell.setPaletteOpen(false),
			instrument: contributedInstrument
		}
		: null));
	const indexRegion = $derived.by((): RegionProps['panels']['index'] => ({
		open: shell.indexOpen,
		model: selectionViewView.worldIndex,
		scope: selectionViewView.resolvedScope,
		onScope: (scope) => shell.setWorldScope(scope),
		onClose: () => shell.setIndexOpen(false),
		selectionId: selectionViewView.selectedLocatorId,
		query: shell.query,
		onQuery: (next: string) => shell.setQuery(next),
		onSelect: (sourceId: string) => commands.selectSource(sourceId),
		onBringIntoView: (sourceId: string) => {
			const target = selectionViewView.sourceWorldPoint(sourceId);
			if (target !== null) bringIntoView(target);
		},
		onReveal: (id: string) => { if (id.startsWith('layout:')) toggleReveal(id.slice(id.indexOf(':', 7) + 1)); },
		onRename: () => shell.requestCardRename(),
		experience: experience.index
	}));
	const cardRegion = $derived.by((): RegionProps['panels']['card'] => ({
		identity: preview === null && shell.cardOpen ? shownCard.identity : null,
		facts: shownCard.facts,
		nameWriter: shownCard.nameWriter,
		renameRequest: shell.cardRenameTarget === null || (selection !== null && sameReference(selection.reference, shell.cardRenameTarget))
			? shell.cardRenameRequest : 0,
		onRenameRequestConsumed: shell.consumeCardRename,
		writer: shownCard.writer as StageCardWriterRecord | null,
		actions: shownCard.actions as readonly StageCardActionRecord[],
		functions: shownCard.functions,
		kindLink: shownCard.kindLink,
		menu: shownCard.menu,
		back: shownCard.back,
		gesturing: shell.cardGesturing,
		onClose: () => commands.closeCard(),
		onBringIntoView: shownCard.bringIntoView,
		onPaint: shownCard.identity !== null &&
			!['wall', 'room', 'opening', 'light', 'artwork'].includes(
				shownCard.identity.kind.toLowerCase()
			)
			? () => commands.armWorldTool('paint')
			: null
	}));
	const inactiveTaskRegion = $derived.by((): RegionProps['panels']['inactiveTask'] => (preview === null && inactiveTask !== null ? { label: inactiveTask.label } : null));

</script>

<div class="editor-host" data-shell="living-draft">
	{#if preview === null}
		<EditorHead
			{...coreRegions.head}
			lens={experience.lensState}
			onLens={changeLens}
			canPreview={previewAvailable}
			onPreview={() => void previewController.open()}
			previewUnavailableReason={currentEnvelope === null
				? 'Preview needs an admitted project source.'
				: 'Create an Experience in the Experience lens to Preview it.'}
			repairIssueCount={finishes.issues.count}
			repairOpen={repairDrawerOpen}
			onToggleRepair={() => (repairDrawerOpen = !repairDrawerOpen)}
		/>
	{/if}

	<StageProjectNotices
		resumeOffer={resumeOffer !== null}
		recoveryOffer={projectSession.recoveryOffer}
		onDiscardRecovery={projectSession.dismissRecoveryOffer}
		onResume={() => void resumePendingSave()}
		onDiscard={dismissResumeOffer}
		{sourceFindings}
		{sourceProblems}
		previewProblem={shell.previewProblem as ExperienceProblem | null}
		onShowProblem={(problem) => experience.showProblem(problem)}
	/>

	<div
		class="editor-body"
		style={`--lower-column-height: ${shell.lowerColumnHeight}px; ${experience.lensState === 'experience' ? '--card-right: 10px; ' : ''}${experience.lensState === 'experience' && !experience.guideOpen ? '--card-bottom-clearance: 96px; ' : ''}--sheet-lane-right: ${shell.sheetLaneRight}px; --sheet-lane-left: ${shell.sheetLaneLeft}px`}
		data-index-open={preview === null && shell.indexOpen}
		data-library-open={shell.libraryOpen && preview === null}
	>
		{#if preview === null && experience.lensState === 'world' && transfer !== null && !studio.active && (boot.status === 'ready' || boot.status === 'empty')}
			<StudioTransferStrip
				name={transfer.objectName}
				armed={transferArmed}
				onReturn={returnToObject}
				onDismiss={() => { transfer = null; endFormCopyTransfer(); }}
			/>
		{/if}
		{#if preview === null && experience.lensState === 'world' && studio.active}
			<StudioScopeStrip
				phase={studio.phase}
				origin={studio.origin}
				context={studio.context}
				name={studio.rootName}
				rootCount={studio.roots.length}
				onContext={(next) => studio.setContext(next)}
				onNewObject={() => studio.newObjectHere()}
				onChoose={() => studio.openChooser()}
				onBackToWorld={() => studio.backToWorld()}
				onBackToProjects={() => studio.backToProjects()}
				onOpenInWorld={() => studio.openInWorld()}
				onPlaceCopy={() => void studio.placeCopyInWorld()}
				placingCopy={studio.placingCopy}
			/>
			<StudioRootPanel
				phase={studio.phase}
				roots={studio.roots}
				origin={studio.origin}
				canUndo={historyState.canUndo}
				creating={studio.creating}
				onChoose={(id) => studio.chooseRoot(id)}
				onOpenChooser={() => studio.openChooser()}
				onNewObject={() => studio.newObjectHere()}
				onUndo={history.undo}
				onBackToWorld={() => studio.backToWorld()}
				onBackToProjects={() => studio.backToProjects()}
				onOpenInWorld={() => studio.openInWorld()}
				onCancelCreation={() => studio.cancelCreation()}
			/>
		{/if}

		<StageViewportRegion
			{...coreRegions.viewport}
			previewing={preview !== null}
			experienceMarks={experience.lensState === 'experience' && evaluation !== null && !experience.lookThroughActive()
				? {
					evaluation,
					placementGhost: experience.placementGhost(),
					liveEdit: experience.viewEdit,
					advanced: experience.advancedViewId !== null,
					datum: experienceFloorDatum,
					rig: experience.playback.status === 'idle' ? null : experience.playback.sample,
					onLookThrough: (viewId: string) => experience.lookThroughView(viewId),
					showMarkers: shell.showMarkers,
					showFrustums: shell.showFrustums,
					showPaths: shell.showPaths,
					showLabels: shell.showLabels,
					selectionOnly: shell.showMode === 'selection',
					onPlanePoint: experience.pathAnchorPoint,
					beginPathDragLease: experience.beginPathDragLease,
					endPathDragLease: experience.endPathDragLease
				}
				: null}
			viewEditTurn={experience.viewEdit?.moved && !experience.viewEdit.advanced && experience.viewEditPreview?.turn
				? experience.viewEditPreview.turn
				: null}
			lift={liftPill}
			slice={slicePill}
			{...lightInspection.regions.viewport}
			pendingViewWrite={experience.pendingViewWrite}
			onResolvePendingViewWrite={() => void experience.confirmPendingViewWrite()}
			onCancelPendingViewWrite={() => experience.clearPendingViewWrite()}
			welcome={experience.lensState === 'experience' && experience.welcome && !lookThroughActiveNow() && experience.experienceTool === 'select'}
			onDismissWelcome={() => experience.dismissWelcome()}
			hanging={facade !== null && evaluation?.renderedReading === '3d' && hangingGuides.length > 0
				? { guides: hangingGuides, stage: facade, evaluation, activeGuideId: activeHangingGuide }
				: null}
			artwork={selectedArtwork !== null && facade !== null && evaluation?.renderedReading === '3d' && canPlaceArtwork() && !artworkInteraction.armed
				? {
					entity: artworkInteraction.resizeGhost ?? selectedArtwork,
					stage: facade,
					evaluation,
					resizing: artworkInteraction.resizeGhost !== null,
					blocked: artworkInteraction.resizeBlocked,
					canTurn: selectedArtwork === null || !artworkInteraction.isHungNow(selectedArtwork),
					onStart: artworkInteraction.startResize
				}
				: null}
			preview={viewportPreview}
			previewLoading={preview !== null && viewportPreview === null}
			homes={experience.lensState === 'experience' && adapterServices !== null && currentEnvelope !== null
				? { services: adapterServices, snapshot: currentEnvelope }
				: null}
			onExperienceController={(controller: ExperienceController | null) => experience.setController(controller)}
			bind:stageElement={stageEl}
			bind:throughFrameElement={throughFrameEl}
		/>

		{#snippet toolbars()}
			<StageToolbars
				{...coreRegions.toolbars}
				previewing={preview !== null}
				{paintLine}
				viewLine={preview === null
					? {
						drafting: {
							drafting: shell.drafting,
							reading: shell.draftingReading,
							gridWord: shell.draftingGridWord,
							snapWord: shell.draftingSnapWord,
							onReading: setReading,
							onPatch: patchDrafting,
							planAppearance: shell.preferences.planAppearance,
							onPlanAppearance: (planAppearance: 'paper' | 'shaded') =>
								shell.updatePreferences({ ...shell.preferences, planAppearance }),
							measureActive: shell.activeWorldTool === 'measure',
							onMeasure: () => commands.armWorldTool('measure'),
							studioWhileEditing: look.studioWhileEditing,
							onStudioWhileEditing: look.setStudioWhileEditing,
							roomLabels2d: shell.preferences.roomLabels2d,
							roomLabels3d: shell.preferences.roomLabels3d,
							paperTone2d: shell.preferences.paperTone2d,
							paperTone3d: shell.preferences.paperTone3d,
							onViewPreference: (patch) => { shell.updatePreferences({ ...shell.preferences, ...patch }); refresh(); },
							heightSheetSide: shell.heightSheetSide,
							onHeightSheetSide: (side: 'left' | 'right') => shell.setHeightSheetSide(side),
							reducedMotion: shell.reducedMotion,
							onToggleReducedMotion: () => shell.toggleReducedMotion(),
							motionSpeed: shell.preferences.motionSpeed,
							onMotionSpeed: (motionSpeed) => shell.updatePreferences({ ...shell.preferences, motionSpeed }),
							lift: liftControl,
							nearWalls: nearWallsControl
						}
					}
					: null}
				experience={preview === null && experience.active !== null
					? {
						dock: {
							captureDisabled: experience.captureReason() !== undefined,
							captureReason: experience.captureReason(),
							guideOpen: experience.guideOpen,
							placeArmed: experience.experienceTool === 'place',
							onPlaceView: () => experience.togglePlaceView(),
							onCapture: () => experience.capture(),
							onToggleGuide: () => experience.toggleGuide()
						},
						feedback: shell.notice || experience.feedback !== null
							? {
								text: shell.notice || experience.feedback!.text,
								kind: shell.notice ? null : experience.feedback!.kind
							}
							: null,
						guide: experience.guideOpen ? { onClose: () => experience.toggleGuide(), playback: experience.playback } : null
					}
					: null}
			/>
		{/snippet}

		<StagePanels
			{...coreRegions.panels}
			{toolbars}
			environment={adapterServices && experience.lensState === 'world' ? { look, fading: liveStageGesture || stageInput.drag?.mode === 'orbit' } : null}
			previewing={preview !== null}
		/>

		{#if shell.libraryOpen && preview === null && experience.lensState === 'world' && adapterServices !== null}
			{#key shell.libraryInvocation.nonce}
			<StageLibrary
				entries={libraryEntries}
				intent={shell.libraryInvocation.intent}
				target={libraryTarget}
				swap={finishes.librarySwap}
				view={shell.libraryView}
				openKind={shell.libraryInvocation.kind}
				busy={finishes.busy}
				tileSource={libraryTileSource}
				objects={libraryObjects}
				artwork={selectionViewView.scenePayload === null ? null : selectionViewView.scenePayload.artworkLibrary ?? []}
				looks={look.libraryShelf}
				inspection={shell.libraryInspection}
				onInspection={(next) => shell.setLibraryInspection(next)}
				onView={(next) => shell.setLibraryView(next)}
				onClose={closeLibrary}
				onPaint={(entry, keepOpen) => {
					finishes.pickMaterialKey(entry.key);
					if (keepOpen) return;
					if (shell.libraryOpen) commands.toggleWorldLibrary();
					commands.armWorldTool('paint');
				}}
				onReplace={async (entry, keepOpen) => {
					const accepted = await finishes.applyLibraryFinish(entry.ref);
					if (!accepted) {
						return {
							ok: false,
							message: libraryTarget === null
								? 'Select an object or surface first. Nothing changed.'
								: libraryTarget.finishKey === entry.key
									? `${libraryTarget.label} already wears ${entry.name}.`
									: 'That change could not be made. Nothing changed.'
						};
					}
					if (!keepOpen) closeLibrary();
					return { ok: true };
				}}
				onSwap={async (materialId, keepOpen) => {
					const outcome = await finishes.applyLibrarySwap(materialId);
					if (outcome.ok && !keepOpen) closeLibrary();
					return outcome;
				}}
				onSelectUsers={async (entry) => {
					const selected = await finishes.selectFinishUsers(entry.ref);
					if (selected) closeLibrary();
					return selected;
				}}
				onCustomise={(entry) => {
					closeLibrary(false);
					if (!finishes.openLibraryDraft(entry.ref)) return;
					commands.armWorldTool('paint');
				}}
				onToggleFavourite={(key) => finishes.toggleFavouriteMaterial(key)}
				onObject={(assetId) => commands.pickWorldObject(assetId)}
				onArtwork={(entry: ArtworkLibraryEntry) => {
					closeLibrary();
					commands.selectTool();
					artworkInteraction.arm(entry);
				}}
				onArtworkImport={(files) => {
					closeLibrary();
					commands.selectTool();
					void artworkInteraction.importFiles(files);
				}}
				onMaterialImport={(files, invoker) => {
					closeLibrary();
					void materialImport.start(files, currentImportTargets(), invoker);
				}}
				onLook={(id) => {
					closeLibrary();
					look.pickLibraryEntry(id);
				}}
			/>
			{/key}
		{/if}

		{#if materialImport.open && preview === null && experience.lensState === 'world'}
			<MaterialImportSheet session={materialImport} />
		{/if}

		{#if finishes.align.active !== null && preview === null && experience.lensState === 'world' && adapterServices !== null}
			{@const activeAlign = finishes.align.active}
			{@const alignInspected = alignInspectedNow}
			{@const sceneNow = boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.scene : null}
			{#if alignInspected !== null && sceneNow !== null}
				{@const alignSource = { base: alignInspected.instance.base, overrides: alignInspected.instance.overrides }}
				{@const alignRecipes = sceneNow.materialIndex?.definitions ?? new Map()}
				<StageFinishAlign
					align={activeAlign}
					refusal={finishes.align.refusal}
					project={alignProject}
					viewportWidth={rect?.width ?? 856}
					viewportHeight={rect?.height ?? 608}
					source={alignSource}
					recipes={alignRecipes}
					onMaterialPreview={(edits) => finishes.card.previewEdits(activeAlign.target, () => edits)}
					onCancelPreview={() => finishes.card.cancel()}
					onCommit={(edits) => finishes.card.edit(activeAlign.target, () => edits)}
					onPutBack={() => finishes.align.putBack(true)}
				/>
			{/if}
		{/if}

		{#if finishes.libraryDraft !== null && preview === null && experience.lensState === 'world' && adapterServices !== null}
			{@const draftEntry = libraryEntries.find((entry) => entry.key === finishes.libraryDraft?.finishKey) ?? null}
			{@const draftInst = finishes.libraryDraftInstance()}
			{@const draftFields = finishes.libraryDraftFields()}
			{@const sceneNow = boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.scene : null}
			{#if draftFields !== null && draftInst !== null && draftInst.ok && sceneNow !== null}
				{@const origTile = draftEntry === null ? null : libraryTileSource(draftEntry)}
				<LibraryMaterialEditor
					mode="draft"
					name={finishes.libraryDraft.name}
					baseLabel={finishes.libraryDraft.baseLabel}
					finishKey={finishes.libraryDraft.finishKey}
					color={draftEntry?.color ?? '#999999'}
					imageUri={draftEntry?.imageUri ?? null}
					tileSource={libraryDraftRender.source ?? origTile}
					originalSource={origTile}
					fields={draftFields}
					source={{ base: draftInst.instance.base, overrides: draftInst.instance.overrides }}
					recipes={sceneNow.materialIndex?.definitions ?? new Map()}
					palette={sceneNow.palette ?? []}
					facts={editorTreatmentFacts}
					inspection={shell.libraryInspection}
					onInspection={(next) => shell.setLibraryInspection(next)}
					display={finishes.editor.display}
					onDisplay={(next) => finishes.editor.setDisplay(next)}
					lightTurnRadians={finishes.editor.lightTurnRadians}
					onTurnLight={() => finishes.editor.turnLight()}
					compare={finishes.editor.compare}
					onCompare={(next) => finishes.editor.setCompare(next)}
					draftStatus={libraryDraftStatus}
					previewing={libraryDraftPreview !== null}
					busy={finishes.busy}
					onCommit={(_field, edits) => finishes.patchLibraryDraft(edits)}
					onResetAll={() => finishes.resetLibraryDraftStep()}
					onApplyDraft={async () => {
						const accepted = await finishes.applyLibraryDraft();
						if (accepted) {
							commands.armWorldTool('select');
							void tick().then(() => document.querySelector<HTMLElement>('[data-world-library-key]')?.focus());
						}
						return accepted;
					}}
					onPaintDraft={() => finishes.paintLibraryDraft()}
					onCancelDraft={endLibraryDraft}
				/>
			{/if}
		{:else if finishes.editor.open && finishEditorView !== null && preview === null && experience.lensState === 'world' && adapterServices !== null}
			{@const sceneNow = boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.scene : null}
			{#if sceneNow !== null}
				{@const liveSource =
					finishEditorView.curated && 'catalogue' in finishEditorView.instance.base
						? { kind: 'catalogue' as const, id: finishEditorView.instance.base.catalogue as import('$lib/types/materials').MaterialId }
						: finishTileSource(finishEditorView.instance.id)}
				<LibraryMaterialEditor
					mode="finish"
					name={finishEditorView.name}
					baseLabel={finishEditorView.fields.raw.label}
					canRename={finishEditorView.canRename}
					onRename={(nextName) => finishes.card.rename(finishEditorView.target, nextName)}
					finishKey={finishEditorView.finishKey}
					tileSource={liveSource}
					originalSource={baseSourceOfInstance(finishEditorView.instance)}
					fields={finishEditorView.fields}
					source={{ base: finishEditorView.instance.base, overrides: finishEditorView.instance.overrides }}
					recipes={sceneNow.materialIndex?.definitions ?? new Map()}
					palette={sceneNow.palette ?? []}
					facts={editorTreatmentFacts}
					inspection={shell.libraryInspection}
					onInspection={(next) => shell.setLibraryInspection(next)}
					display={finishes.editor.display}
					onDisplay={(next) => finishes.editor.setDisplay(next)}
					lightTurnRadians={finishes.editor.lightTurnRadians}
					onTurnLight={() => finishes.editor.turnLight()}
					compare={finishes.editor.compare}
					onCompare={(next) => finishes.editor.setCompare(next)}
					fieldRefusal={finishes.editor.fieldRefusal}
					usersCount={finishEditorView.usersCount}
					reach={finishEditorView.reach}
					place={finishEditorView.place}
					onToggleReach={() => finishes.editor.toggleReach()}
					align={finishEditorView.align}
					onAlign={() => {
						const res = finishes.requestAlign(finishEditorView.target, finishEditorView.place);
						if (!res.ok && res.message) finishes.editor.setFieldRefusal('pattern', res.message);
					}}
					onMaterialPreview={(edits) => finishes.editor.preview(() => edits)}
					onCancelPreview={() => finishes.editor.cancelPreview()}
					onCommit={(field, edits) => finishes.editor.commit(field, () => edits)}
					onResetAll={() => finishes.editor.resetAll()}
					onDone={() => finishes.editor.close(true)}
				/>
			{/if}
		{/if}

		{#if shell.armedHostTool === 'paint' && preview === null && !shell.libraryOpen && finishes.libraryDraft === null}
			<StagePaintTray
				tray={paintTray}
				view={paintTrayState}
				radius={shell.paintTool?.surfaceScope() ?? 'surface'}
				onRadius={(radius) => shell.paintTool?.setSurfaceScope(radius)}
				onPick={(swatch) => {
					const colour = swatch.kind === 'colour' ? parseColourKey(swatch.key) : null;
					if (colour !== null) finishes.pickColour(colour);
					else finishes.pickMaterialKey(swatch.key);
				}}
				onColour={(colour) => finishes.pickColour(colour)}
				onFavourite={() => finishes.toggleActiveFavourite()}
				onDropper={() => (finishes.dropperArmed ? finishes.cancelDropper() : finishes.armDropper())}
				onLibrary={() => commands.toggleWorldLibrary('paint')}
				palette={{
					...finishes.paletteView(),
					rename: (slotId, name) => void finishes.renamePaletteSlot(slotId, name),
					setColor: (slotId, color) => void finishes.setPaletteSlotColor(slotId, color),
					remove: (slotId) => void finishes.removePaletteSlot(slotId),
					add: (color) => finishes.addPaletteSlot(color)
				}}
				tileSource={finishTileSource}
			/>
		{/if}

		{#if preview === null}
			<StageRepairDrawer
				open={repairDrawerOpen}
				issues={finishes.issues.open}
				repaired={finishes.issues.repaired}
				onOpenCard={(issue) => {
					finishes.focusIssueTarget(issue);
					repairDrawerOpen = false;
				}}
				onClose={() => (repairDrawerOpen = false)}
			/>
		{/if}

	</div>

	<StageBootPanels {boot} repair={bootRepair} transferName={transfer?.objectName ?? null} {runReplacement} {returnToObject} />
	<StageReplaceDialog {pendingReplacement} {runReplacement} cancelReplacement={projectSession.cancelReplacement} />

</div>

<style>
	:global(body) {
		margin: 0;
	}
	.editor-host {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		background: var(--shell-forest);
		color: var(--shell-ivory);
	}
	.editor-body {
		position: relative;
		min-height: 0;
		flex: 1;
		overflow: hidden;
	}
	/* The Card takes its surface, type and radius from the shared roles; only its
	   lane beside the Height Sheet is the route's business. */
	.editor-host[data-shell='living-draft'] :global(.card) {
		top: 10px;
		right: 10px;
		box-shadow: var(--shell-shadow);
	}
	@media (width > 1100px) {
		.editor-body[data-index-open='true'] {
			--index-cover: var(--shell-index-width);
		}
	}
	/*
		Below 1100 px the Index floats over the Stage and reserves no lane, but the
		Library and its draft editor still keep clear of an open Index so it stays
		visible beside them (owner decision on #408). Under 860 px the Library is
		a full-width sheet and takes the Stage.
	*/
	@media (860px < width <= 1100px) {
		.editor-body[data-index-open='true'] {
			--library-index-cover: var(--shell-index-width);
		}
	}
	/*
		The Library and the draft editor keep clear of a shown Card: --card-cover is
		the span from the Stage's right edge to the Card's left edge, matching the
		Card's own placement.
	*/
	.editor-body:has(> :global(aside.card)) {
		--card-cover: calc(var(--shell-card-width) + var(--sheet-lane-right, 0px) + 18px);
	}
	.editor-host[data-shell='living-draft'] .editor-body:has(> :global(aside.card)) {
		--card-cover: calc(var(--shell-card-width) + 10px);
	}
	/*
		Where the Library is a full-width sheet it takes the Index's place while
		open. The Index keeps its open state, contents and scroll (visibility only),
		and comes back as it was when the Library closes. Above 860 px the Library
		keeps clear of the Index instead (--library-index-cover).
	*/
	@media (max-width: 860px) {
		.editor-body[data-library-open='true'] > :global(.plate-index),
		.editor-body[data-library-open='true'] > :global([data-index-scrim]) {
			visibility: hidden;
		}
	}
	@media (pointer: coarse) {
		.editor-host {
			--shell-touch-target: 44px;
			--shell-head-height: 52px;
		}
	}
</style>
