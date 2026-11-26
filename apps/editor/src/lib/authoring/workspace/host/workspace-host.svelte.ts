/**
 * The workspace host's construction sequence.
 *
 * It is the route's only composition root now: core factories, feature entries,
 * the one lifecycle runner and the one `late` cell are built here, once, during
 * the route's initialisation. The host view below is what `WorkspaceHost.svelte`
 * renders; regions and workspaces branch on single host members only.
 */
import { onDestroy } from 'svelte';
import { createFeatureLifecycle } from '$lib/authoring/workspace/lifecycle-runner';
import { late, type FeatureLifecycle } from '$lib/authoring/workspace/protocol';
import { goto } from '$app/navigation';
import { env } from '$env/dynamic/public';
import { aimThroughWindows } from '$lib/authoring/look/aim-through-windows';
import { perfMark } from '$lib/platform/perf-marks';
import { installPerfWorkObserver } from '$lib/platform/perf-work';
import {
	createExperiencePreviewView,
	createExperienceSourceViews,
} from '$lib/authoring/experience/experience-region-views.svelte';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { createLightInspectionFeature } from '$lib/authoring/look/light-inspection-feature.svelte';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import {
	createCoreRegionViews,
	createViewportInput,
} from '$lib/authoring/stage/route/core-region-views';
import { createRouteInput } from '$lib/authoring/stage/route/route-input.svelte';
import { createProjectReadyPort } from '$lib/authoring/stage/route/project-ready-port.svelte';
import { createStageViewing } from '$lib/authoring/stage/route/stage-viewing';
import { createStageContentBounds } from '$lib/authoring/stage/route/stage-content-bounds.svelte';
import { createStageCanvasViews } from './wiring/stage-canvas-views.svelte';
import { createStageRegionModels } from './wiring/stage-region-models.svelte';
import { createLookThroughFrame } from '$lib/authoring/stage/route/look-through-frame.svelte';
import { createStageHistoryCommand } from '$lib/authoring/stage/route/stage-history-command';
import { createStageWindowListeners } from '$lib/authoring/stage/route/stage-window-listeners';
import { createBootRepair } from '$lib/authoring/stage/route/boot-repair.svelte';
import { createStageCursor } from '$lib/authoring/stage/route/stage-cursor';
import {
	createCoreLifecycleSteps,
	installLeaveProject,
	installStageMount,
} from '$lib/authoring/stage/route/core-lifecycle-steps.svelte';
import { absoluteCss, capturePointer } from '$lib/authoring/stage/route/stage-viewport.svelte';
import { wireStageViewport } from '$lib/authoring/workspace/host/wiring/stage-viewport';
import { createArtworkFeature } from '$lib/authoring/artwork/artwork-feature.svelte';
import { createLayoutReadingsFeature } from '$lib/authoring/stage/readings/layout-readings-feature.svelte';
import { wireStageInput } from '$lib/authoring/workspace/host/wiring/stage-input';
import { wireStageKeyboard } from '$lib/authoring/workspace/host/wiring/stage-keyboard';
import { createStageLightPreview } from '$lib/authoring/stage/stage-light-preview.svelte';
import { stageAdapterFactories } from '$lib/authoring/adapters/catalog';
import { createStageAssetLeases } from '$lib/authoring/stage/route/stage-asset-leases.svelte';
import { provideFinishTiles } from '$lib/authoring/look/finish-tiles-provider';
import {
	analyzeModelDerivativeBytes,
	createModelAnalysisCache,
} from '$lib/render/materials/model-derivative-analysis';
import { createVerifiedProjectImageCache } from '$lib/authoring/artwork/project-image-cache';
import { wireStageProjectEpoch } from '$lib/authoring/workspace/host/wiring/stage-project-epoch';
import { eyeOfInspectionPose } from '@portfolio/camera-core/viewport';
import { pickThroughSlice } from '$lib/authoring/stage/slice/stage-slice-pick';
import { createStagePressTracker } from '$lib/authoring/stage/stage-input';
import type { StageInterruptionReason } from '$lib/authoring/stage/stage-interruption';
import '$lib/authoring/stage/shell/shell-roles.css';
import '$lib/authoring/stage/shell/cursors.css';
import { invalidateFinishViewsForSource } from '$lib/render/resources/finish-views';
import { invalidateTextureSource } from '$lib/render/resources/texture-store';
import { artworkReference } from '$lib/authoring/artwork/artwork-command';
import { readVerifiedArtwork } from '$lib/authoring/artwork/project-artwork';
import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
import { createSkyFeature } from '$lib/authoring/look/sky-feature.svelte';
import type { ExperienceProblem } from '$lib/authoring/experience/experience-problems';
import { createExperienceFeature } from '$lib/authoring/experience/experience-feature.svelte';
import { createExperiencePreviewHost } from '$lib/authoring/experience/experience-preview-host';
import { wireProjectSession } from '$lib/authoring/workspace/host/wiring/project-session';
import {
	createProjectApi,
	createProjectAuth,
	type ProjectApi,
} from '$lib/platform/project-persistence';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import {
	createStageSelectionPresentation,
	createStageSelectionReadout,
	installStageCardRenameGuard,
} from '$lib/authoring/stage/route/stage-selection-presentation.svelte';
import { createStageContributionViews } from '$lib/authoring/stage/route/stage-contribution-views.svelte';
import { wireStageShellState } from '$lib/authoring/workspace/host/wiring/stage-shell-state';
import { createMaterialProofRegistry } from '$lib/authoring/material-proof';
import { createAppearanceFeature } from '$lib/authoring/look/appearance-feature.svelte';
import { createLibraryFeature } from '$lib/authoring/library/library-feature.svelte';
import { createColourCoatPort } from '$lib/authoring/look/colour-coat-port';
import { getMaterial, materialById } from '$lib/content/materials';
import { wireStageShellCommands } from '$lib/authoring/workspace/host/wiring/stage-shell-commands';
import { createStageExperienceBinding } from '$lib/authoring/stage/route/stage-experience-binding.svelte';
import { isStudioWorldTool } from '$lib/authoring/studio/studio-model';
import { createStudioStagePorts } from '$lib/authoring/studio/studio-stage-ports';
import { createStudioFeature } from '$lib/authoring/studio/studio-feature.svelte';
import { createSubjectScope } from '$lib/authoring/stage/subject-scope';

export type WorkspaceHostInput = {
	readonly page: () => { readonly params: Record<string, string | undefined>; readonly url: URL };
};

export function createWorkspaceHost(input: WorkspaceHostInput) {
	installPerfWorkObserver();

	const refresh = () => stageViewport.refresh();
	const clearHover = () => stageInput.clearHover();
	const interruptPress = (reason: StageInterruptionReason) => stageInput.interrupt(reason);

	const routeInput = createRouteInput(() => input.page());
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
	const stagePick = pickThroughSlice(
		scenePick,
		() => readings.ports.resolvedSlice(),
		subjectScope.get,
	);

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
			return (
				verifiedImages.take(projectId, image.assetId) ??
				readVerifiedArtwork(api, projectId, image, signal)
			);
		},
		resolveTexture: async (assetId, signal) => {
			if (api === null) throw new Error('Finish image storage is unavailable.');
			return (
				verifiedImages.take(projectId, assetId) ?? api.loadAssetContent(projectId, assetId, signal)
			);
		},
		analyzeModel: async (_assetId, digest, bytes) => {
			if (modelAnalyses.has(digest)) return;
			modelAnalyses.register(await analyzeModelDerivativeBytes(bytes, digest));
		},
		notice: { read: () => shell.notice, write: (message) => shell.setNotice(message) },
	});

	const studioPorts = createStudioStagePorts({
		projectId,
		facade: () => stageEpoch.facade,
		commands: () => commands,
		shell: () => shell,
		subjectScope,
		viewing: () => viewing,
		projectSession: () => projectSession,
		selection: () => selected.get(),
		entities: () => stageEpoch.facade?.snapshot().domain.scene.entities ?? [],
		rect: () => stageViewport.rect,
		stageElement: () => stageViewport.stageElement,
		clearHover,
		studioActive: () => studio.active,
		studioCreating: () => studio.creating,
		settlePending: () => lifecycle.settlePending(),
		bumpRevision: () => studioFeature.ports.bumpRevision(),
		armCreation: () => studioFeature.ports.armCreation(),
	});
	const studioFeature = createStudioFeature({
		ports: studioPorts,
		lens: () => experience.lensState,
		previewing: () => previewController.openState,
		ready: () => ready.active(),
		armObjects: () => commands.armWorldTool('objects'),
		dockReady: () => contributions.dockKeys().some((key) => key.slot === 'library'),
		intent,
		entry: studioEntry,
		placeCopyItem,
		projectId,
		renderRootsRevision: () => contentBounds.renderRootsRevision(),
		taskOpen: () => shell.task !== null,
		activeWorldTool: () => shell.activeWorldTool,
		libraryOpen: () => shell.libraryOpen,
		navigate: (href) => void goto(href),
	});
	const studio = studioFeature.controller;

	const lifecycleCell = late<FeatureLifecycle>();

	const stageEpoch = wireStageProjectEpoch({
		session,
		assets: stageAssets,
		materialProofs,
		finishCard: () => appearance.ports.adapter(),
		lightInspection: () => lightInspection.ports.card,
		objectStudio: () => studioFeature.ports.objectStudio,
		openSpaceCreated: () => commands.openSpaceCreated,
		projectSession: () => projectSession,
		preview: () => previewController,
		createFacade: (snapshot) =>
			createStageFacade({
				snapshot,
				session,
				scenePick: stagePick,
				sceneBounds: scenePick.bounds,
				lightPreview,
				subjectScope,
			}),
		adapterFactories: stageAdapterFactories,
		targetSources: { models: modelAnalyses.provider },
		lifecycle: lifecycleCell.get,
		onNotice: (message) => shell.setNotice(message),
		refresh: () => refresh(),
		isActiveProject: () => ready.active(),
	});

	const projectSession = wireProjectSession({
		projectId,
		intent,
		api,
		auth,
		session,
		images: verifiedImages,
		materialProofs,
		url: routeInput.url,
		acceptance: () => stageEpoch.acceptance,
		tornDown: () => stageEpoch.tornDown,
		activate: (snapshot) => stageEpoch.activate(snapshot),
		readNotice: () => shell.notice,
		writeNotice: (value) => shell.setNotice(value),
	});
	const ready = createProjectReadyPort(() => projectSession.boot);
	const { requestReplacement, runReplacement, resumePendingSave, dismissResumeOffer } =
		projectSession;

	const selected = createStageSelectionPresentation();

	const shell = wireStageShellState({
		session,
		facade: () => stageEpoch.facade,
		evaluation: () => stageViewport.evaluation,
		rect: () => stageViewport.rect,
		measure: () => stageViewport.measure(),
		previewing: () => previewController.openState,
		lens: session.lens,
		selection: selected.get,
		finishes: () => finishes,
		selectSource: (id) => commands.selectSource(id),
	});
	const experienceBinding = createStageExperienceBinding({
		session,
		stage: () => stageEpoch.facade,
		shell: () => shell,
		selection: selected.get,
		cardIdentity: () => selectionView().cardIdentity ?? null,
		floorDatum: ready.datumMeters,
		closeSelection: () => commands.closeSelection(),
		clearStageSelection: () => selected.clear(stageEpoch.facade),
		preview: () => previewController,
		reducedMotion: () => shell.reducedMotion,
		evaluation: () => stageViewport.evaluation,
		rect: () => stageViewport.rect,
		stageElement: () => stageViewport.stageElement,
		capturePointer,
		stageCss: (event) => stageViewport.stageCss(event),
		absoluteCss,
		refresh: () => refresh(),
		renameRequest: () => shell.requestCardRename(),
		clearHover,
		refusePress: (pointerId) => press.refuse(pointerId),
		interruptPress,
		gestureActive: () => session.gesture() !== null,
		notice: (message) => shell.setNotice(message),
		setPreviewProblem: (problem) => shell.setPreviewProblem(problem),
		setStagePickPresentationId: (id) => shell.setStagePickPresentationId(id),
	});

	const previewController = createExperiencePreviewHost({
		api,
		projectId,
		lens: session.lens,
		snapshot: ready.snapshot,
		token: () => session.token(),
		isCurrent: (token) => session.isCurrent(token as never),
		envelope: ready.envelope,
		envelopeOf: (snapshot) => stageEnvelope(snapshot as Parameters<typeof stageEnvelope>[0]),
		focus: experienceBinding.readFocus,
		setProblem: (problem) => shell.setPreviewProblem(problem as ExperienceProblem | null),
		stage: () => stageEpoch.facade,
		stopAndRestore: () => {
			// Preview takes the one Camera output: the light inspection restores its
			// entry standpoint synchronously before the ticket moves.
			lightInspection.ports.cancel();
			// Align, the material Editor, Import and the repair pickers end by their
			// cancel paths; Align restores its entry standpoint first (U6 lifecycle).
			appearance.ports.endOperations(true);
			experienceBinding.stopAndRestore();
		},
		snapSuspended: () => shell.drafting.snapSuspended,
		patchDrafting: (patch) => shell.patchDrafting(patch),
		notice: (message) => shell.setNotice(message),
		perfMark: (name, data) => perfMark(name, data),
	});
	const experienceFeature = createExperienceFeature({
		binding: experienceBinding,
		preview: previewController,
		host: {
			services: () => stageEpoch.services,
			selection: selected.get,
			cardIdentity: () => selectionView().cardIdentity ?? null,
			bring: () => {
				const target = selectionView().selectedWorldPoint();
				if (target !== null) bringIntoView(target);
			},
			selectStageReference: (reference) => commands.selectStageReference(reference),
			referenceLabel: (reference) => selectionView().referenceLabel(reference),
			datumMeters: ready.datumMeters,
		},
		regions: {
			shell: () => shell,
			evaluation: () => stageViewport.evaluation,
			lookThroughActive: () => lookThrough.active(),
			datum: ready.datumMeters,
			setReading: (reading) => viewing.setReading(reading),
			patchDrafting: (patch) => viewing.patchDrafting(patch),
			armWorldTool: (tool) => commands.armWorldTool(tool),
			studioWhileEditing: () => sky.studioWhileEditing,
			setStudioWhileEditing: (value) => sky.ports.setStudioWhileEditing(value),
			liftControl: () => readings.liftControl,
			nearWallsControl: () => readings.nearWallsControl,
			refresh,
		},
	});
	const experience = experienceFeature.ports.binding;

	const press = createStagePressTracker();

	const lightInspection = createLightInspectionFeature({
		stage: () => stageEpoch.facade,
		services: () => stageEpoch.services,
		lens: () => experience.lensState,
		notice: (message) => shell.setNotice(message),
		refresh: () => refresh(),
		absoluteCss,
		capturePointer,
		stageElement: () => stageViewport.stageElement,
		evaluation: () => stageViewport.evaluation,
		previewing: () => previewController.openState,
	});

	const viewing = createStageViewing({
		facade: () => stageEpoch.facade,
		rect: () => stageViewport.rect,
		stageInput: () => stageInput,
		shell,
		session,
		lifecycle: lifecycleCell.get,
		refresh,
	});
	const {
		submit,
		setReading,
		requestScaleDetent,
		fit,
		zoomIn,
		zoomOut,
		bringIntoView,
		zoom,
		pan,
		orbit,
	} = viewing;

	const stageViewport = wireStageViewport({
		facade: () => stageEpoch.facade,
		throughFrameElement: () => lookThrough.element ?? null,
		lookThroughActive: () => lookThrough.active(),
		previewing: () => previewController.openState,
		lens: () => experience.lensState,
		preferences: () => shell.preferences,
		groundReachMeters: () => sky.ports.groundReachMeters(),
		nowSeconds: shell.nowSeconds,
		advanceLookThroughZoom: (now) => experience.advanceLookThroughZoom(now),
		advancePlayback: (now) => experience.advancePlayback(now),
		onBeforeRefresh: () => {
			stageEpoch.refreshHistory();
			shell.syncGestureFade(session.gesture());
		},
		onAfterRefresh: () => shell.refreshHostTools(),
	});
	const sourceViews = createExperienceSourceViews(ready, experience, () => stageEpoch.services);

	const lookThrough = createLookThroughFrame({
		view: experience,
		light: () => lightInspection.frame,
		lightActive: lightInspection.ports.active,
		lightSession: lightInspection.ports.session,
		refresh,
	});

	const appearance = createAppearanceFeature({
		finishes: {
			services: () => stageEpoch.services,
			api: () => api,
			projectId: () => projectId,
			canEdit: () => artwork.ports.canPlace(),
			isSaved: () => projectSession.headSave?.snapshot().savedBaseToken != null,
			imageAspect: (textureId) => stageAssets.textureAspect(textureId),
			imageDimensions: (textureId) => stageAssets.textureDimensions(textureId),
			textureUri: (textureId) => {
				const scene = ready.snapshot()?.domain.scene ?? null;
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
				services: () => stageEpoch.services,
				onNotice: (message) => shell.setNotice(message),
				labelForMaterial: (id) => (materialById.has(id) ? getMaterial(id).label : id),
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
		},
		card: {
			selection: selected.get,
			snapshot: ready.snapshot,
		},
		draft: {
			snapshot: ready.snapshot,
			textureScope: () => stageAssets.textureScope,
			selection: selected.get,
			shell,
			canShowEditor: () =>
				!previewController.openState &&
				experience.lensState === 'world' &&
				stageEpoch.services !== null,
			entries: () => library.view.props.entries,
			tileSource: (entry) => library.ports.tileSource(entry),
			armWorldTool: (tool) => commands.armWorldTool(tool),
		},
		materialImport: {
			api,
			projectId,
			materialProofs,
			snapshot: ready.snapshot,
			services: () => stageEpoch.services,
			onNotice: (message) => shell.setNotice(message),
		},
		paint: {
			shell,
			previewing: () => previewController.openState,
			openLibrary: () => commands.toggleWorldLibrary('paint'),
		},
		align: {
			shell,
			previewing: () => previewController.openState,
			lens: () => experience.lensState,
			available: () => stageEpoch.services !== null,
			rect: () => stageViewport.rect,
			facade: () => stageEpoch.facade,
			evaluation: () => stageViewport.evaluation,
			snapshot: ready.snapshot,
			alignHiddenWallIds: () => readings.alignHiddenWallIds,
		},
		repair: {
			projectId,
		},
	});
	const selectionView = createStageSelectionReadout({
		ready,
		envelope: ready.envelope,
		facade: () => stageEpoch.facade,
		selection: selected.get,
		viewport: stageViewport,
		shell,
		studioActive: () => studio.active,
	});
	const contributions = createStageContributionViews({
		facade: () => stageEpoch.facade,
		selection: selectionView,
		lens: session.lens,
		shell,
		studio: () => studioFeature.regions.find,
	});
	const library = createLibraryFeature({
		shell,
		selection: selected.get,
		finishes: () => finishes,
		commands: () => commands,
		scene: () => selectionView().scenePayload,
		looks: () => sky.libraryShelf,
		lens: () => experience.lensState,
		previewing: () => previewController.openState,
		available: () => stageEpoch.services !== null,
		finishTileSource: appearance.ports.finishTileSource,
		armArtwork: (entry) => artwork.ports.arm(entry),
		importArtwork: (files) => artwork.ports.importFiles(files),
		importMaterial: (files, invoker) => appearance.ports.importMaterial(files, invoker),
		pickLook: (id) => sky.ports.pickLibraryEntry(id),
	});

	const heightSheet = session.heightSheet();
	const sky = createSkyFeature({
		look: {
			sky: () => ready.envelope()?.units.scene.data.environment?.sky ?? null,
			scene: () => ready.envelope()?.units.scene.data ?? null,
			sessionKey: () => ready.snapshot()?.sessionEpoch ?? '',
			services: () => stageEpoch.services,
			windowHeading: () =>
				stageEpoch.facade ? aimThroughWindows(stageEpoch.facade.snapshot().domain.geometry) : null,
			onNotice: (message) => shell.setNotice(message),
		},
		lens: () => experience.lensState,
		previewing: () => previewController.openState,
		taskActive: () => shell.task !== null,
		toolArmed: () => shell.armedHostTool !== null,
		facade: () => stageEpoch.facade,
		evaluation: () => stageViewport.evaluation,
		bounds: () => contentBounds.stage,
		services: () => stageEpoch.services,
		fading: () => shell.stageGesturing || stageInput.drag?.mode === 'orbit',
	});

	installStageCardRenameGuard({ facade: () => stageEpoch.facade, selection: selected.get, shell });

	const commands = wireStageShellCommands({
		facade: () => stageEpoch.facade,
		planView: () => stageViewport.planView,
		session,
		shell,
		selection: selected.get,
		setSelection: selected.set,
		clearExperienceFocus: experienceBinding.clearFocus,
		lens: experience.lens,
		active: () => experience.active,
		cardActions: () => regionModels.worldCard.actions,
		dockKeys: contributions.dockKeys,
		notice: (message) => shell.setNotice(message),
		refreshHostTools: () => shell.refreshHostTools(),
		cancelArtwork: () => artwork.ports.cancel(),
		zoomIn: () => zoomIn(),
		zoomOut: () => zoomOut(),
		fit: () => fit(),
		requestScaleDetent: (ratio) => requestScaleDetent(ratio),
		requestReplacement: (kind) => requestReplacement(kind),
		downloadSourceJson: projectSession.downloadSourceJson,
		showExperienceWelcome: () => experience.showWelcome(),
		levelSlice: () => readings.ports.levelSlice(),
		lightArmed: lightInspection.ports.lightArmed,
		isStudioTool: isStudioWorldTool,
		studioActive: () => studio?.active === true,
		libraryReplaceQualified: () => appearance.ports.finishes().libraryTarget() != null,
		runStudioEntry: studioFeature.ports.runStudioEntry,
	});

	const finishes = appearance.ports.finishes();
	const bootRepair = createBootRepair({
		boot: () => projectSession.boot,
		projectId: () => projectId,
		repair: projectSession.repairBootImage,
	});

	const readings = createLayoutReadingsFeature({
		unfold: {
			snapshot: ready.snapshot,
			selection: selected.get,
			gestures: {
				facade: () => stageEpoch.facade,
				evaluation: () => stageViewport.evaluation,
				rect: () => stageViewport.rect,
				measure: () => stageViewport.measure(),
				stageElement: () => stageViewport.stageElement,
				stageCss: (event) => stageViewport.stageCss(event),
				layout: () => selectionView().layoutPayload,
				task: () => shell.task,
				services: () => stageEpoch.services,
				acceptOpening: (services, intent) => services.authoring.accept(intent),
				selectSubject: (wallId, openingId) => commands.selectUnfoldedSubject(wallId, openingId),
				press,
				capturePointer,
				clearHover,
				onNotice: (message) => shell.setNotice(message),
			},
		},
		slice: {
			draw: {
				facade: () => stageEpoch.facade,
				evaluationId: () => stageEpoch.facade?.evaluationId() ?? null,
				renderedReading: () =>
					stageViewport.evaluation?.renderedReading === 'plan'
						? 'plan'
						: stageViewport.evaluation?.renderedReading === '3d'
							? '3d'
							: null,
				eye: () =>
					stageViewport.evaluation === null
						? null
						: eyeOfInspectionPose(stageViewport.evaluation.pose),
				bounds: () => contentBounds.stage,
				datumMeters: ready.datumMeters,
				notice: (message) => shell.setNotice(message),
			},
			shell,
			snapshot: ready.snapshot,
			lens: () => experience.lensState,
			evaluation: () => stageViewport.evaluation,
		},
		lift: {
			snapshot: ready.snapshot,
			envelope: ready.envelope,
			evaluation: () => stageViewport.evaluation,
			selection: selected.get,
			notice: shell.setNotice,
		},
		cutaway: {
			snapshot: ready.snapshot,
			selection: selected.get,
			selectedArtwork: () => selectionView().selectedArtwork,
			facade: () => stageEpoch.facade,
			evaluation: () => stageViewport.evaluation,
			lens: () => experience.lensState,
			scenePick,
			pressing: () => stageInput.drag !== null,
			previewing: () => previewController.openState,
			alignCutaway: appearance.ports.alignCutaway,
		},
		wallFace: {
			facade: () => stageEpoch.facade,
			rect: () => stageViewport.rect,
			alignFraming: appearance.ports.alignFraming,
			reducedMotion: () => shell.reducedMotion,
			nowSeconds: shell.nowSeconds,
			submit,
		},
	});
	const artwork = createArtworkFeature({
		interaction: {
			api,
			services: () => stageEpoch.services,
			isSaved: () => projectSession.headSave?.snapshot().savedBaseToken != null,
			selected: () => selectionView().selectedArtwork,
			facade: () => stageEpoch.facade,
			evaluation: () => stageViewport.evaluation,
			rect: () => stageViewport.rect,
			measure: () => stageViewport.measure(),
			stageElement: () => stageViewport.stageElement,
			press,
			capturePointer,
			onNotice: (message) => shell.setNotice(message),
			onSelect: (services, id) => commands.selectStageReference(artworkReference(services, id)),
			selectTool: () => commands.selectTool(),
		},
		ready: ready.active,
		lens: () => experience.lensState,
		previewing: () => previewController.openState,
		unfoldActive: () => readings.ports.unfoldActive(),
		resolvedSlice: () => readings.ports.resolvedSlice(),
		scenePick,
		artworkScope: () => stageAssets.artworkScope,
	});

	const sliceDraw = readings.ports.sliceDraw;

	const stageInput = wireStageInput({
		facade: () => stageEpoch.facade,
		evaluation: () => stageViewport.evaluation,
		rect: () => stageViewport.rect,
		measure: () => stageViewport.measure(),
		stageElement: () => stageViewport.stageElement,
		session,
		activeLayer: () =>
			experience.posture ?? (lightInspection.ports.active() ? lightInspection.posture : null),
		artwork: artwork.ports.input,
		unfold: readings.ports.unfold,
		stageCss: (event) => stageViewport.stageCss(event),
		capturePointer,
		press,
		planView: () => stageViewport.planView,
		previewing: () => previewController.openState,
		pick: stagePick,
		viewMarkAt: (event) => experience.viewMarkAt(event),
		sliceDraw: () => (sliceDraw.armed ? sliceDraw : null),
		shell,
		selectHit: (hit) => commands.selectHit(hit),
		pan,
		orbit,
		zoom,
		submit,
		nowSeconds: shell.nowSeconds,
	});

	const stageKeyboard = wireStageKeyboard({
		featureEscape: [sky],
		appearanceRungs: appearance.rungs,
		artworkEscape: artwork.ports.escape,
		previewActive: () => previewController.openState,
		closePreview: () => previewController.close(),
		activeLayer: () =>
			experience.posture ?? (lightInspection.ports.active() ? lightInspection.posture : null),
		pressing: () => stageInput.pressing,
		dragMode: () => stageInput.drag?.mode ?? null,
		facade: () => stageEpoch.facade,
		reducedMotion: () => shell.reducedMotion,
		nowSeconds: shell.nowSeconds,
		submit,
		setReading,
		zoom,
		fit,
		pan,
		pressDockSlot: (slot) => commands.pressDockSlot(slot),
		requestDelete: () => commands.requestDelete(),
		interrupt: interruptPress,
		shell,
		closeTask: () => commands.closeTask(),
		armedDockKey: contributions.armedDockKey,
		libraryEscape: library.escape,
		toolbarFocused: () => {
			const active = document.activeElement;
			return (
				active instanceof HTMLElement &&
				active.closest('[data-world-toolbar], [data-paint-tray]') !== null &&
				!active.matches('[data-world-select]')
			);
		},
		focusSelectKey: () =>
			document.querySelector<HTMLElement>('[data-world-toolbar] [data-world-select]')?.focus(),
		lens: () => experience.lensState,
		selectionPresent: () => selected.get() !== null,
		closeSelection: () => commands.closeSelection(),
		leaveStudio: studioFeature.ports.leaveStudio,
		readingsEscape: readings.escape,
		setCutawayHeld: readings.ports.setCutawayHeld,
	});

	const contentBounds = createStageContentBounds({
		scenePick,
		snapshot: ready.snapshot,
		facade: () => stageEpoch.facade,
	});

	installLeaveProject(lifecycleCell);

	const regionModels = createStageRegionModels({
		previewing: () => previewController.openState,
		shell,
		commands,
		experience,
		experienceFeature,
		studioFeature,
		appearance,
		readings,
		sky,
		artwork,
		library,
		selectionViewView: selectionView,
		selection: selected.get,
		contributedInstrument: contributions.instrument,
		taskHost: contributions.task,
		inactiveTask: contributions.inactiveTask,
		facade: () => stageEpoch.facade,
		bringIntoView,
		lookThroughActive: lookThrough.active,
		toggleReveal: stageViewport.toggleReveal,
	});

	projectSession.bindNavigation();

	const history = createStageHistoryCommand({ epoch: stageEpoch, lifecycle: lifecycleCell.get });
	const listeners = createStageWindowListeners({
		keyboard: stageKeyboard,
		suspendSnap: shell.suspendSnap,
		lifecycle: lifecycleCell.get,
	});
	installStageMount(lifecycleCell);

	const core = createCoreLifecycleSteps({
		projectId,
		intent,
		projectSession,
		stageEpoch,
		session,
		facade: () => stageEpoch.facade,
		setSelection: selected.set,
		clearRevealed: stageViewport.clearRevealed,
		assets: stageAssets,
		shell,
		commands,
		stageInput,
		history,
		viewing,
		listeners,
		viewport: stageViewport,
	});
	const lifecycle = createFeatureLifecycle({
		core,
		features: [
			lightInspection,
			appearance,
			{ id: 'experience', lifecycle: experienceFeature.lifecycle },
			studioFeature,
			readings,
			artwork,
		],
	});

	lifecycleCell.set(lifecycle);

	// The Stage input handlers are named once and passed as a group to the region.

	const stageCursor = createStageCursor({
		experience: experienceFeature.ports.cursor,
		stageInput,
		shell,
		lookThroughActive: lookThrough.active,
	});

	const viewportInput = createViewportInput(stageInput, artwork.ports, lookThrough.active);

	const coreRegions = createCoreRegionViews({
		projectId,
		heightSheet,
		project: projectSession,
		shell,
		history,
		scenePick,
		lightPreview,
		facade: () => stageEpoch.facade,
		snapshot: ready.snapshot,
		viewport: stageViewport,
		stageInput,
		commands,
		historyState: () => stageEpoch.history,
		assets: stageAssets,
		planAppearance: () => appearance.regions.planAppearance,
		paperContentBounds: () => contentBounds.paper,
		snapshotBounds: () => contentBounds.stage,
		selection: selected.get,
		studioSuppressesPlan: () => studio.active && studio.context === 'mat',
		lookThroughActive: lookThrough.active,
		lens: () => experience.lensState,
		previewing: () => previewController.openState,
		cursor: stageCursor,
		lookThrough: () => lookThrough.props,
		viewportInput,
		canvas: () => canvasViews.canvas,
		overlay: () => canvasViews.overlay,
		downloadSource: projectSession.downloadSourceJson,
		locationLabel: () => selectionView().locationLabel,
		findEntries: contributions.findEntries,
		projectActionsUnavailableReason: projectSession.projectActionsUnavailableReason,
		index: () => regionModels.indexRegion,
		card: () => regionModels.cardRegion,
		inactiveTask: () => regionModels.inactiveTaskRegion,
		worldToolbar: () => regionModels.worldRegion,
		instrument: () => regionModels.instrumentRegion,
		show: () => regionModels.showRegion,
	});

	const canvasViews = createStageCanvasViews({
		overlayLists: { sky: sky.regions.overlay, artwork: artwork.regions.overlay },
		snapshot: ready.snapshot,
		coreRegions,
		appearance,
		readings,
		sky,
		artwork,
		studioFeature,
	});

	const viewportPreview = createExperiencePreviewView({
		preview: previewController,
		assets: stageAssets,
		look: { reducedMotion: () => shell.reducedMotion, sky: () => sky.sky },
	});

	return {
		get experienceViewport() {
			return experienceFeature.ports.regions.viewport;
		},
		get experienceToolbar() {
			return experienceFeature.ports.regions.toolbars;
		},
		get experienceHomes() {
			return sourceViews.homes;
		},
		get world() {
			return experience.lensState === 'world';
		},
		appearance,
		artwork,
		get boot() {
			return projectSession.boot;
		},
		bootRepair,
		changeLens: lifecycle.leaveLens,
		coreRegions,
		get currentEnvelope() {
			return ready.envelope();
		},
		dismissResumeOffer,
		experience,
		history,
		get historyState() {
			return stageEpoch.history;
		},
		library,
		lightInspection,
		get pendingReplacement() {
			return projectSession.pendingReplacement;
		},
		get preview() {
			return previewController.preview;
		},
		get previewAvailable() {
			return previewController.available;
		},
		previewController,
		projectSession,
		readings,
		get resumeOffer() {
			return projectSession.resumeOffer;
		},
		resumePendingSave,
		runReplacement,
		shell,
		sky,
		get sourceFindings() {
			return ready.findings();
		},
		get sourceProblems() {
			return sourceViews.problems;
		},
		studioFeature,
		get viewportPreview() {
			return viewportPreview();
		},
		get stageEl() {
			return stageViewport.stageElement;
		},
		set stageEl(value) {
			stageViewport.stageElement = value;
		},
		get throughFrameEl() {
			return lookThrough.element;
		},
		set throughFrameEl(value) {
			lookThrough.element = value;
		},
	};
}

export type WorkspaceHost = ReturnType<typeof createWorkspaceHost>;
