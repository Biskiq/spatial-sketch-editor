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
	import type { ArtworkLibraryEntry } from '@portfolio/project-model';
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
	import { createArtworkFeature } from '$lib/authoring/artwork/artwork-feature.svelte';
	import { createLayoutReadingsFeature } from '$lib/authoring/stage/readings/layout-readings-feature.svelte';
	import type { AlignCutawayRequest } from '$lib/authoring/stage/readings/layout-readings-view';
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
		type PlanEvaluation
	} from '@portfolio/layout-core';
	import {
		eyeOfInspectionPose,
		fovYDegreesOf,
		type ViewportEvaluation,
		type ViewportRect
	} from '@portfolio/camera-core';
	import { pickThroughSlice } from '$lib/authoring/stage/slice/stage-slice-pick';
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
	import { artworkReference } from '$lib/authoring/artwork/artwork-command';
	import { verifyArtworkDecode } from '$lib/render/artwork/artwork-decode';
	import { readVerifiedArtwork } from '$lib/authoring/artwork/project-artwork';
	import { createArtworkScope, type ArtworkBytes } from '$lib/render/artwork/artwork-scope';
	import { aimThroughWindows } from '$lib/authoring/look/aim-through-windows';
	import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import { createSkyFeature } from '$lib/authoring/look/sky-feature.svelte';
	import { isPaperPlanVisible } from '$lib/authoring/stage/paper-plan';
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
	const stagePick = pickThroughSlice(scenePick, () => readings.ports.resolvedSlice(), subjectScope.get);

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
		groundReachMeters: () => sky.ports.groundReachMeters(),
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
	const sky = createSkyFeature({
		look: {
			sky: () => currentEnvelope?.units.scene.data.environment?.sky ?? null,
			scene: () => currentEnvelope?.units.scene.data ?? null,
			sessionKey: () => boot.status === 'ready' || boot.status === 'empty'
				? boot.snapshot.sessionEpoch
				: '',
			services: () => adapterServices,
			windowHeading: () => facade ? aimThroughWindows(facade.snapshot().domain.geometry) : null,
			onNotice: (message) => shell.setNotice(message)
		},
		lens: () => experience.lensState,
		previewing: () => preview !== null,
		taskActive: () => shell.task !== null,
		toolArmed: () => shell.armedHostTool !== null,
		facade: () => facade,
		evaluation: () => evaluation,
		bounds: () => stageContentBounds,
		services: () => adapterServices,
		fading: () => liveStageGesture || stageInput.drag?.mode === 'orbit'
	});

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
		cancelArtwork: () => artwork.ports.cancel(),
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
		levelSlice: () => readings.ports.levelSlice(),
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
		canEdit: () => artwork.ports.canPlace(),
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
	const artwork = createArtworkFeature({
		interaction: {
			api,
			services: () => adapterServices,
			isSaved: () => headSave?.snapshot().savedBaseToken != null,
			selected: () => selectionViewView.selectedArtwork,
			facade: () => facade,
			evaluation: () => evaluation,
			rect: () => rect,
			measure: () => stageViewport.measure(),
			stageElement: () => stageEl,
			press,
			capturePointer,
			onNotice: (message) => shell.setNotice(message),
			onSelect: (services, id) => commands.selectStageReference(artworkReference(services, id)),
			selectTool: () => commands.selectTool()
		},
		ready: () => boot.status === 'ready' || boot.status === 'empty',
		lens: () => experience.lensState,
		previewing: () => preview !== null,
		unfoldActive: () => readings.ports.unfoldActive(),
		resolvedSlice: () => readings.ports.resolvedSlice(),
		scenePick,
		artworkScope: () => stageAssets.artworkScope
	});

	const readings = createLayoutReadingsFeature({
		unfold: {
			snapshot: ready.snapshot,
			selection: () => selection,
			gestures: {
				facade: () => facade,
				evaluation: () => evaluation,
				rect: () => rect,
				measure: () => stageViewport.measure(),
				stageElement: () => stageEl,
				stageCss,
				layout: () => selectionViewView.layoutPayload,
				task: () => shell.task,
				services: () => adapterServices,
				acceptOpening: (services, intent) => services.authoring.accept(intent),
				selectSubject: (wallId, openingId) => commands.selectUnfoldedSubject(wallId, openingId),
				press,
				capturePointer,
				clearHover,
				onNotice: (message) => shell.setNotice(message)
			}
		},
		slice: {
			draw: {
				facade: () => facade,
				evaluationId: () => facade?.evaluationId() ?? null,
				renderedReading: () => (evaluation?.renderedReading === 'plan' ? 'plan' : evaluation?.renderedReading === '3d' ? '3d' : null),
				eye: () => (evaluation === null ? null : eyeOfInspectionPose(evaluation.pose)),
				bounds: () => stageContentBounds,
				datumMeters: ready.datumMeters,
				notice: (message) => shell.setNotice(message)
			},
			shell,
			snapshot: ready.snapshot,
			lens: () => experience.lensState,
			evaluation: () => evaluation
		},
		lift: {
			snapshot: ready.snapshot,
			envelope: ready.envelope,
			evaluation: () => evaluation,
			selection: () => selection,
			notice: shell.setNotice
		},
		cutaway: {
			snapshot: ready.snapshot,
			selection: () => selection,
			selectedArtwork: () => selectionViewView.selectedArtwork,
			facade: () => facade,
			evaluation: () => evaluation,
			lens: () => experience.lensState,
			scenePick,
			pressing: () => stageInput.drag !== null,
			previewing: () => preview !== null,
			alignCutaway: readAlignCutaway
		},
		wallFace: {
			facade: () => facade,
			rect: () => rect,
			alignFraming,
			reducedMotion: () => shell.reducedMotion,
			nowSeconds,
			submit
		}
	});
	const sliceDraw = readings.ports.sliceDraw;

	stageInput = createStageInputArbiter({
		facade: () => facade,
		evaluation: () => evaluation,
		rect: () => rect,
		measure: () => stageViewport.measure(),
		stageElement: () => stageEl,
		session,
		activeLayer: () => activeLayer,
		artwork: artwork.ports.input,
		unfold: readings.ports.unfold,
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
		artworkEscape: artwork.ports.escape,
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
		...sky.escape,
		lens: () => experience.lensState,
		selectionPresent: () => selection !== null,
		closeSelection: () => commands.closeSelection(),
		leaveStudio: () => studio.active && studio.backToWorld(),
		...readings.escape,
		setCutawayHeld: readings.ports.setCutawayHeld
	});

	const effectivePlanAppearance = $derived(
		finishes.align.active?.surface === 'floor' ? 'shaded' : shell.preferences.planAppearance
	);
	const paperVisible = $derived(isPaperPlanVisible(evaluation, effectivePlanAppearance));
	const modelUrls = $derived(stageAssets.urls);

	function readAlignCutaway(): AlignCutawayRequest | null {
		const active = finishes.align.active;
		return active === null || active.surface !== 'wall'
			? null
			: { ids: active.occluders, top: (active.corners[0]?.[1] ?? 0) + 0.005 };
	}

	readings.attachReadings();


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

	installLeaveProject(lifecycleCell);
	readings.attachTeardown();
	artwork.attachGuard();

	const lookCardStratum = $derived.by(() => {
		void shell.contributionsVersion;
		const subject = selectionViewView.cardSubject;
		const entity = subject?.reference?.domain === 'scene'
			? selectionViewView.scenePayload?.entities.find((entry) => entry.id === subject.sourceId)
			: undefined;
		return (entity?.kind === 'artwork' ? artwork.ports.card(entity) : null) ?? sky.ports.cardStratum(subject);
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

	readings.attachCameraPorts();

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
			readings,
			artwork
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
		pointerLeave: () => { clearHover(); artwork.ports.leave(); },
		dragOver: artwork.ports.dragOver,
		drop: artwork.ports.drop,
		contextMenu: (event: MouseEvent) => { if (lookThroughActiveNow()) event.preventDefault(); }
	};

	sky.attachSession();

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
			get scene() {
				const accepted = ready.snapshot()?.domain.scene;
				return accepted === undefined ? snapshot.domain.scene : withFinishInstancePreview(accepted, libraryDraftPreview ?? finishes.card.preview);
			},
			get studio() {
				void studioRevision;
				return studio.active ? { rootId: studio.rootId, context: studio.context } : null;
			},
			get proposals() { return finishes.card.proposalEntries(); },
			get alignHiddenWallIds() { return readings.alignHiddenWallIds; },
			onFinishOutcome: finishes.issues.recordOutcome,
			get repairAffectedTargets() { return finishes.issues.hatchedTargets; }
		};
		// Assemble descriptors once per admitted source so Svelte reads each
		// Canvas getter independently of the other regions and source props.
		const { liftCanvas, cutawayCanvas, sliceCanvas, unfoldCanvas } = readings.regions;
		// The idle Unfold anchor was sampled with the source props.
		const unfold = {
			...Object.getOwnPropertyDescriptors(unfoldCanvas),
			unfoldAnchorPin: { value: unfoldCanvas.unfoldAnchorPin, enumerable: true }
		};
		return Object.defineProperties(coreCanvas, {
			...Object.getOwnPropertyDescriptors(features),
			...Object.getOwnPropertyDescriptors(sky.regions.canvas),
			...Object.getOwnPropertyDescriptors(artwork.regions.canvas),
			...Object.getOwnPropertyDescriptors(liftCanvas),
			...Object.getOwnPropertyDescriptors(cutawayCanvas),
			...Object.getOwnPropertyDescriptors(sliceCanvas),
			...unfold
		}) as typeof coreCanvas & typeof features & typeof sky.regions.canvas & typeof artwork.regions.canvas & typeof liftCanvas & typeof cutawayCanvas & typeof sliceCanvas & typeof unfoldCanvas;
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

	const overlay = $derived({
		...coreRegions.overlay,
		celestial: sky.regions.overlay.celestial,
		marks: [...coreRegions.overlay.marks!, ...(sky.regions.overlay.marks ?? [])],
		candidates: [...coreRegions.overlay.candidates!, ...(artwork.regions.overlay.candidates ?? [])],
		sliceDraft: readings.regions.overlay.sliceDraft
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
				sky: sky.sky
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
			onMaterialPick: sky.ports.pickMaterial,
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
			lookShelf: sky.libraryShelf,
			artworkShelf: selectionViewView.scenePayload === null ? null : selectionViewView.scenePayload.artworkLibrary ?? [],
			onArtworkPick: (entry) => { commands.selectTool(); artwork.ports.arm(entry); },
			onArtworkImport: (files: File[]) => { commands.selectTool(); void artwork.ports.importFiles(files); },
			onLookPick: sky.ports.pickLibraryEntry,
			trayOwnsPlate: shell.armedHostTool === 'paint' && preview === null && !shell.libraryOpen,
			paintChip: paintTray.active === null ? null : { color: paintTray.active.color, shape: paintTray.active.kind === 'colour' ? 'colour' : 'material', source: paintTray.active.kind === 'finish' ? paintTileSource(paintTray.active.key, finishTileSource) : null },
			plateKind: shell.activeWorldTool === 'walls' || shell.activeWorldTool === 'opening' || shell.activeWorldTool === 'room' || shell.activeWorldTool === 'terrace' || shell.activeWorldTool === 'roofline' ? 'ink' : shell.activeWorldTool === 'objects' ? 'objects' : shell.activeWorldTool === 'slice' ? 'slice' : null,
			inkReading: shell.inkReading,
			sliceMode: readings.sliceMode,
			sliceDrawing: sliceDraw.armed,
			onSliceLevel: readings.ports.levelSlice,
			onSliceDrawn: readings.ports.drawSlice,
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
			{...readings.regions.liftViewport}
			{...readings.regions.sliceViewport}
			{...lightInspection.regions.viewport}
			pendingViewWrite={experience.pendingViewWrite}
			onResolvePendingViewWrite={() => void experience.confirmPendingViewWrite()}
			onCancelPendingViewWrite={() => experience.clearPendingViewWrite()}
			welcome={experience.lensState === 'experience' && experience.welcome && !lookThroughActiveNow() && experience.experienceTool === 'select'}
			onDismissWelcome={() => experience.dismissWelcome()}
			{...artwork.regions.viewport}
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
							studioWhileEditing: sky.studioWhileEditing,
							onStudioWhileEditing: sky.ports.setStudioWhileEditing,
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
							lift: readings.liftControl,
							nearWalls: readings.nearWallsControl
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
			{...sky.regions.panels}
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
				looks={sky.libraryShelf}
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
					artwork.ports.arm(entry);
				}}
				onArtworkImport={(files) => {
					closeLibrary();
					commands.selectTool();
					void artwork.ports.importFiles(files);
				}}
				onMaterialImport={(files, invoker) => {
					closeLibrary();
					void materialImport.start(files, currentImportTargets(), invoker);
				}}
				onLook={(id) => {
					closeLibrary();
					sky.ports.pickLibraryEntry(id);
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
