/**
 * The workspace host's construction sequence.
 *
 * It is the route's only composition root now: core factories, feature entries,
 * the one lifecycle runner and the one `late()` cell are built here, once, during
 * the route's initialisation. The host view below is what `WorkspaceHost.svelte`
 * renders; regions and workspaces branch on single host members only.
 */
	import { onDestroy, tick, untrack } from 'svelte';
	import { createFeatureLifecycle } from '$lib/authoring/workspace/lifecycle-runner';
	import { late, type FeatureLifecycle } from '$lib/authoring/workspace/protocol';
	import { page } from '$app/state';
	import { goto, replaceState } from '$app/navigation';
	import { env } from '$env/dynamic/public';
	import type { AppPreferences } from '$lib/platform/app-preferences';
	import { aimThroughWindows } from '$lib/authoring/look/aim-through-windows';
	import { perfMark } from '$lib/platform/perf-marks';
	import { installPerfWorkObserver } from '$lib/platform/perf-work';
	import type { ProjectEnvelope } from '@portfolio/project-model/units';
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
import { createStageCanvasViews } from './wiring/stage-canvas-views.svelte';
import { createStageRegionModels } from './wiring/stage-region-models.svelte';
	import { installLookThroughFrame } from '$lib/authoring/stage/route/look-through-frame.svelte';
	import { createStageHistoryCommand } from '$lib/authoring/stage/route/stage-history-command';
	import { createStageWindowListeners } from '$lib/authoring/stage/route/stage-window-listeners';
	import { createBootRepair } from '$lib/authoring/stage/route/boot-repair.svelte';
	import StageBootPanels from '$lib/authoring/stage/shell/StageBootPanels.svelte';
	import StageReplaceDialog from '$lib/authoring/stage/shell/StageReplaceDialog.svelte';
	import { readStageCursor } from '$lib/authoring/stage/route/stage-cursor';
	import { createCoreLifecycleSteps, installLeaveProject, installStageMount } from '$lib/authoring/stage/route/core-lifecycle-steps.svelte';
	import { wireStageViewport } from '$lib/authoring/workspace/host/wiring/stage-viewport';
	import { createArtworkFeature } from '$lib/authoring/artwork/artwork-feature.svelte';
	import { createLayoutReadingsFeature } from '$lib/authoring/stage/readings/layout-readings-feature.svelte';
	import { wireStageInput } from '$lib/authoring/workspace/host/wiring/stage-input';
	import { wireStageKeyboard } from '$lib/authoring/workspace/host/wiring/stage-keyboard';
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
	import { wireStageProjectEpoch } from '$lib/authoring/workspace/host/wiring/stage-project-epoch';
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
	import { invalidateFinishViewsForSource } from '$lib/render/resources/finish-views';
	import { invalidateTextureSource } from '$lib/render/resources/texture-store';
	import StagePanels from '$lib/authoring/stage/shell/StagePanels.svelte';
	import StageProjectNotices from '$lib/authoring/stage/shell/StageProjectNotices.svelte';
	import StageToolbars from '$lib/authoring/stage/shell/StageToolbars.svelte';
	import StageViewportRegion from '$lib/authoring/stage/shell/StageViewportRegion.svelte';
	import { artworkReference } from '$lib/authoring/artwork/artwork-command';
	import { verifyArtworkDecode } from '$lib/render/artwork/artwork-decode';
	import { readVerifiedArtwork } from '$lib/authoring/artwork/project-artwork';
	import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	import { createSkyFeature } from '$lib/authoring/look/sky-feature.svelte';
	import { isPaperPlanVisible } from '$lib/authoring/stage/paper-plan';
	import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
	import { experienceProblems, loweringProblem, type ExperienceProblem } from '$lib/authoring/experience/experience-problems';
	import { createExperienceFeature, type ExperienceFeature } from '$lib/authoring/experience/experience-feature.svelte';
	import { isAllowedShippedTextureUri } from '$lib/visitor/shipped-static-registry';
	import { wireProjectSession } from '$lib/authoring/workspace/host/wiring/project-session';
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
		type StageHeadFindEntry
	} from '$lib/authoring/stage/route/stage-contribution-view';
	import { wireStageShellState } from '$lib/authoring/workspace/host/wiring/stage-shell-state';
	import {
		createFinishAuthoring,
		type FinishAuthoring
	} from '$lib/authoring/look/finish-authoring.svelte';
	import { createMaterialProofRegistry } from '$lib/authoring/material-proof';
	import { createAppearanceFeature } from '$lib/authoring/look/appearance-feature.svelte';
	import AppearanceSharedRegions from '$lib/authoring/look/AppearanceSharedRegions.svelte';
	import { createLibraryFeature } from '$lib/authoring/library/library-feature.svelte';
	import { createColourCoatPort } from '$lib/authoring/look/colour-coat-port';
	import { getMaterial, materialById } from '$lib/content/materials';
	import { wireStageShellCommands } from '$lib/authoring/workspace/host/wiring/stage-shell-commands';
	import {
		createStageExperienceBinding,
		type StageExperienceBinding
	} from '$lib/authoring/stage/route/stage-experience-binding.svelte';
	import type { ExperienceController } from '$lib/authoring/experience/experience-controller.svelte';
	import { isStudioOperation, isStudioWorldTool, studioAdmitsCardAction } from '$lib/authoring/studio/studio-model';
	import { createStudioFeature } from '$lib/authoring/studio/studio-feature.svelte';
	import { createSubjectScope } from '$lib/authoring/stage/subject-scope';
	import { sceneEntityReference } from '$lib/authoring/adapters/scene/placement';
	import {
		STUDIO_ENTRY_PARAM,
		STUDIO_ENTRY_VALUE,
		STUDIO_OBJECT_PARAM,
		PLACE_COPY_PARAM
	} from '$lib/platform/studio-entry';
	import { beginFormCopyTransfer } from '$lib/authoring/adapters/scene/library/transfer';
	import { runPlaceCopy } from '$lib/authoring/studio/place-copy-journey';

export type WorkspaceHostInput = {
	readonly page: () => { readonly params: Record<string, string | undefined>; readonly url: URL };
};

export function createWorkspaceHost(input: WorkspaceHostInput) {
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

	installPerfWorkObserver();

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

	const studioFeature = createStudioFeature({
		ports: {
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
			studioFeature.ports.bumpRevision();
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
		armCreation: () => studioFeature.ports.armCreation(),
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
	},
		lens: () => experience.lensState,
		previewing: () => preview !== null,
		ready: () => boot.status === 'ready' || boot.status === 'empty',
		entities: () => facade?.snapshot().domain.scene.entities ?? [],
		selectedEntityId: () =>
			selection !== null && selection.reference.domain === 'scene' ? selection.reference.subject.id : null,
		armObjects: () => commands.armWorldTool('objects'),
		dockReady: () => dockKeys.some((key) => key.slot === 'library'),
		intent,
		entry: studioEntry,
		placeCopyItem,
		projectId,
		renderRootsRevision: () => renderRootsRevision,
		taskOpen: () => shell.task !== null,
		activeWorldTool: () => shell.activeWorldTool,
		libraryOpen: () => shell.libraryOpen,
		navigate: (href) => void goto(href)
	});
	const studio = studioFeature.controller;

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

	const stageEpoch = wireStageProjectEpoch({
		session,
		assets: stageAssets,
		materialProofs,
		finishCard: () => appearance.ports.adapter(),
		lightInspection: () => lightInspection.ports.card,
		objectStudio: () => studioFeature.ports.objectStudio,
		openSpaceCreated: () => openSpaceCreated,
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

	const projectSession = wireProjectSession({
		projectId, intent, api, auth, session, images: verifiedImages, materialProofs,
		url: routeInput.url,
		acceptance: () => stageEpoch.acceptance,
		tornDown: () => stageEpoch.tornDown,
		activate: (snapshot) => stageEpoch.activate(snapshot),
		readNotice: () => shell.notice,
		writeNotice: (value) => shell.setNotice(value)
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

	/**
	 * The Experience feature composes the binding's owners. The binding itself is
	 * constructed here until the step 12 wiring modules, as Studio's controller is;
	 * the feature owns the Preview host, the host reads and its lifecycle stage.
	 */
	let experienceFeature!: ExperienceFeature;
	const shell = wireStageShellState({
		session,
		facade: () => facade,
		evaluation: () => evaluation,
		rect: () => rect,
		measure: () => stageViewport.measure(),
		previewing: () => preview !== null,
		lens: () => experience.lensState,
		selection: () => selection,
		finishes: () => finishes,
		selectSource: (id) => commands.selectSource(id)
	});
	const experienceBinding = createStageExperienceBinding({
		session,
		stage: () => facade,
		shell: () => shell,
		selection: () => selection,
		cardIdentity: () => selectionViewView?.cardIdentity ?? null,
		floorDatum: () => experienceFeature.ports.floorDatum,
		closeSelection: () => commands.closeSelection(),
		clearStageSelection: () => {
			facade?.select(null);
			selection = null;
		},
		preview: () => experienceFeature.ports.previewController,
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

	experienceFeature = createExperienceFeature({
		binding: experienceBinding,
		preview: {
			api,
			projectId,
			lens: () => experienceBinding.lensState,
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
				appearance.ports.endOperations(true);
				experienceBinding.stopAndRestore();
			},
			snapSuspended: () => shell.drafting.snapSuspended,
			patchDrafting: (patch) => shell.patchDrafting(patch),
			notice: (message) => shell.setNotice(message),
			perfMark: (name, data) => perfMark(name, data)
		},
		host: {
			services: () => adapterServices,
			selection: () => selection,
			cardIdentity: () => selectionViewView?.cardIdentity ?? null,
			bring: () => {
				const target = selectionViewView.selectedWorldPoint();
				if (target !== null) bringIntoView(target);
			},
			selectStageReference: (reference) => commands.selectStageReference(reference),
			referenceLabel: (reference) => selectionViewView.referenceLabel(reference),
			datumMeters: ready.datumMeters
		},
		regions: {
			shell: () => shell,
			evaluation: () => evaluation,
			lookThroughActive: lookThroughActiveNow,
			datum: () => experienceFeature.ports.floorDatum,
			setReading: (reading) => viewing.setReading(reading),
			patchDrafting: (patch) => viewing.patchDrafting(patch),
			armWorldTool: (tool) => commands.armWorldTool(tool),
			studioWhileEditing: () => sky.studioWhileEditing,
			setStudioWhileEditing: (value) => sky.ports.setStudioWhileEditing(value),
			liftControl: () => readings.liftControl,
			nearWallsControl: () => readings.nearWallsControl,
			refresh
		}
	});
	const experience = experienceFeature.ports.binding;

	const previewController = experienceFeature.ports.previewController;
	const preview = $derived(experienceFeature.ports.preview);
	const previewView = $derived(experienceFeature.ports.previewView);
	const previewViewRead = $derived(experienceFeature.ports.previewViewRead as StageDomainRead | null);
	const previewSurface = $derived(experienceFeature.ports.previewSurface);
	const previewRequestedMode = $derived(experienceFeature.ports.previewRequestedMode);
	const previewGuideStats = $derived(experienceFeature.ports.previewGuideStats);
	const previewViewLabels = $derived(experienceFeature.ports.previewViewLabels);
	const previewAvailable = $derived(experienceFeature.ports.previewAvailable);
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

	const stageViewport = wireStageViewport({
		facade: () => facade,
		stageElement: () => stageEl,
		throughFrameElement: () => throughFrameEl ?? null,
		lookThroughActive: lookThroughActiveNow,
		previewing: () => preview !== null,
		lens: () => experience.lensState,
		revealed: () => revealed,
		preferences: () => shell.preferences,
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
	const experienceHomes = $derived(
		experienceFeature.ports.regions.homes(adapterServices, currentEnvelope)
	);
	const activeLayer = $derived(
		experience.posture ?? (lightInspection.ports.active() ? lightInspection.posture : null)
	);
	installLookThroughFrame({
		frame: () => throughFrameEl,
		viewSession: () => experience.lookThroughSession(),
		lightSession: lightInspection.ports.session,
		refresh
	});

	function changeLens(next: 'world' | 'experience'): void {
		lifecycle.leaveLens(next);
	}

	const selectionView = createStageSelectionView();
	const appearance = createAppearanceFeature({
		finishes: {
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
},
		card: {
			selection: () => selection,
			snapshot: ready.snapshot
		},
		draft: {
			snapshot: ready.snapshot,
			textureScope: () => stageAssets.textureScope,
			selection: () => selection,
			shell,
			canShowEditor: () => preview === null && experience.lensState === 'world' && adapterServices !== null,
			entries: () => library.view.props.entries,
			tileSource: (entry) => library.ports.tileSource(entry),
			armWorldTool: (tool) => commands.armWorldTool(tool)
		},
		materialImport: {
			api, projectId, materialProofs,
			snapshot: ready.snapshot,
			services: () => adapterServices,
			onNotice: (message) => shell.setNotice(message),
		},
		paint: {
			shell,
			previewing: () => preview !== null,
			openLibrary: () => commands.toggleWorldLibrary('paint')
		},
		align: {
			shell,
			previewing: () => preview !== null,
			lens: () => experience.lensState,
			available: () => adapterServices !== null,
			rect: () => rect,
			facade: () => facade,
			evaluation: () => evaluation,
			snapshot: ready.snapshot,
			alignHiddenWallIds: () => readings.alignHiddenWallIds
		},
		repair: {
			projectId,
		}
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
	const dockView = $derived(stageDockView({ facade, revision: shell.contributionsVersion }));
	const library = createLibraryFeature({
		shell,
		selection: () => selection,
		finishes: () => finishes,
		commands: () => commands,
		scene: () => selectionViewView.scenePayload,
		looks: () => sky.libraryShelf,
		lens: () => experience.lensState,
		previewing: () => preview !== null,
		available: () => adapterServices !== null,
		finishTileSource: appearance.ports.finishTileSource,
		armArtwork: (entry) => artwork.ports.arm(entry),
		importArtwork: (files) => artwork.ports.importFiles(files),
		importMaterial: (files, invoker) => appearance.ports.importMaterial(files, invoker),
		pickLook: (id) => sky.ports.pickLibraryEntry(id)
	});

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
		studio: studioFeature.regions.find
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

	let stageInput!: ReturnType<typeof wireStageInput>;
	let stageKeyboard!: ReturnType<typeof wireStageKeyboard>;

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

	const commands = wireStageShellCommands({
		facade: () => facade,
		planView: () => planView,
		session,
		shell,
		selection: () => selection,
		setSelection: (entry) => { selection = entry; },
		focus: experienceFocus,
		lens: experience.lens,
		active: () => experience.active,
		cardActions: () => regionModels.worldCard.actions,
		dockKeys: () => dockKeys,
		notice: (message) => shell.setNotice(message),
		refreshHostTools: () => shell.refreshHostTools(),
		cancelArtwork: () => artwork.ports.cancel(),
		zoomIn: () => zoomIn(),
		zoomOut: () => zoomOut(),
		fit: () => fit(),
		requestScaleDetent: (ratio) => requestScaleDetent(ratio),
		requestReplacement: (kind) => requestReplacement(kind),
		downloadSourceJson: () => downloadSourceJson(),
		showExperienceWelcome: () => experience.showWelcome(),
		levelSlice: () => readings.ports.levelSlice(),
		lightArmed: lightInspection.ports.lightArmed,
		isStudioTool: isStudioWorldTool,
		studioActive: () => studio?.active === true,
		libraryReplaceQualified: () => appearance.ports.finishes().libraryTarget() != null,
		runStudioEntry: studioFeature.ports.runStudioEntry
	});




	const finishes = appearance.ports.finishes();
	appearance.attachAuthoring();
	const bootRepair = createBootRepair({
		boot: () => boot,
		projectId: () => projectId,
		repair: projectSession.repairBootImage
	});

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
			alignCutaway: appearance.ports.alignCutaway
		},
		wallFace: {
			facade: () => facade,
			rect: () => rect,
			alignFraming: appearance.ports.alignFraming,
			reducedMotion: () => shell.reducedMotion,
			nowSeconds,
			submit
		}
	});
	const sliceDraw = readings.ports.sliceDraw;

	stageInput = wireStageInput({
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
		planView: () => planView,
		previewing: () => preview !== null,
		pick: stagePick,
		viewMarkAt: (event) => experience.viewMarkAt(event),
		sliceDraw: () => (sliceDraw.armed ? sliceDraw : null),
		shell,
		selectHit: (hit) => commands.selectHit(hit),
		pan,
		orbit,
		zoom,
		submit,
		nowSeconds
	});

	stageKeyboard = wireStageKeyboard({
		appearanceRungs: appearance.rungs,
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
		interrupt: interruptPress,
		shell,
		closeTask: () => commands.closeTask(),
		armedDockKey: () => dockKeys.find((key) => key.id === armedDockId),
		libraryEscape: library.escape,
		toolbarFocused: () => {
			const active = document.activeElement;
			return active instanceof HTMLElement &&
				active.closest('[data-world-toolbar], [data-paint-tray]') !== null &&
				!active.matches('[data-world-select]');
		},
		focusSelectKey: () => document.querySelector<HTMLElement>('[data-world-toolbar] [data-world-select]')?.focus(),
		skyEscape: sky.escape,
		lens: () => experience.lensState,
		selectionPresent: () => selection !== null,
		closeSelection: () => commands.closeSelection(),
		leaveStudio: studioFeature.ports.leaveStudio,
		readingsEscape: readings.escape,
		setCutawayHeld: readings.ports.setCutawayHeld
	});

	const effectivePlanAppearance = $derived(appearance.regions.planAppearance);
	const paperVisible = $derived(isPaperPlanVisible(evaluation, effectivePlanAppearance));
	const modelUrls = $derived(stageAssets.urls);




	readings.attachReadings();

	let renderRootsRevision = $state(0);
	$effect(() => scenePick.onRenderRootsChanged(() => (renderRootsRevision += 1)));
	const contentBounds = createStageContentBounds({
		renderRootsRevision: () => renderRootsRevision,
		snapshot: ready.snapshot,
		facade: () => facade
	});
	const stageContentBounds = $derived(contentBounds.stage);
	const paperContentBounds = $derived(contentBounds.paper);

	installLeaveProject(lifecycleCell);
	artwork.attachGuard();

	const regionModels = createStageRegionModels({
		previewing: () => preview !== null,
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
		selectionViewView: () => selectionViewView,
		selection: () => selection,
		contributedInstrument: () => contributedInstrument,
		taskHost: () => taskHost,
		inactiveTask: () => inactiveTask,
		facade: () => facade,
		bringIntoView,
		lookThroughActive: lookThroughActiveNow,
		toggleReveal
	});

	function toggleReveal(sourceId: string): void {
		revealed = revealed.includes(sourceId)
			? revealed.filter((id) => id !== sourceId)
			: [...revealed, sourceId];
	}

	projectSession.bindNavigation();

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
			appearance,
			{ id: 'experience', lifecycle: experienceFeature.lifecycle },
			studioFeature,
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
		canvas: () => canvasViews.canvas,
		overlay: () => canvasViews.overlay,
		downloadSource: downloadSourceJson,
		locationLabel: () => selectionViewView.locationLabel,
		findEntries: () => findView.entries,
		projectActionsUnavailableReason: () => projectActionsUnavailableReason,
		index: () => regionModels.indexRegion,
		card: () => regionModels.cardRegion,
		inactiveTask: () => regionModels.inactiveTaskRegion,
		worldToolbar: () => regionModels.worldRegion,
		instrument: () => regionModels.instrumentRegion,
		show: () => regionModels.showRegion
	});

	const canvasViews = createStageCanvasViews({
		snapshot: ready.snapshot,
		coreRegions,
		appearance,
		readings,
		sky,
		artwork,
		studioFeature
	});

	const stageCursor = $derived(readStageCursor({
		...experienceFeature.ports.cursor,
		dragMode: () => stageInput.drag?.mode ?? null,
		taskKind: () => shell.task?.kind ?? null,
		lookThroughActive: lookThroughActiveNow,
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

	return {
		get experienceViewport() {
			return experienceFeature.ports.regions.viewport;
		},
		get experienceToolbar() {
			return experienceFeature.ports.regions.toolbars;
		},
		get experienceHomes() {
			return experienceHomes;
		},
		get world() {
			return experience.lensState === 'world';
		},
		get adapterServices() {
			return adapterServices;
		},
		get appearance() {
			return appearance;
		},
		get artwork() {
			return artwork;
		},
		get boot() {
			return boot;
		},
		get bootRepair() {
			return bootRepair;
		},
		get changeLens() {
			return changeLens;
		},
		get commands() {
			return commands;
		},
		get coreRegions() {
			return coreRegions;
		},
		get currentEnvelope() {
			return currentEnvelope;
		},
		get dismissResumeOffer() {
			return dismissResumeOffer;
		},
		get evaluation() {
			return evaluation;
		},
		get experience() {
			return experience;
		},
		get experienceFeature() {
			return experienceFeature;
		},
		get history() {
			return history;
		},
		get historyState() {
			return historyState;
		},
		get library() {
			return library;
		},
		get lightInspection() {
			return lightInspection;
		},
		get lookThroughActiveNow() {
			return lookThroughActiveNow;
		},
		get patchDrafting() {
			return patchDrafting;
		},
		get pendingReplacement() {
			return pendingReplacement;
		},
		get preview() {
			return preview;
		},
		get previewAvailable() {
			return previewAvailable;
		},
		get previewController() {
			return previewController;
		},
		get projectSession() {
			return projectSession;
		},
		get readings() {
			return readings;
		},
		get ready() {
			return ready;
		},
		get refresh() {
			return refresh;
		},
		get resumeOffer() {
			return resumeOffer;
		},
		get resumePendingSave() {
			return resumePendingSave;
		},
		get runReplacement() {
			return runReplacement;
		},
		get selection() {
			return selection;
		},
		get setReading() {
			return setReading;
		},
		get shell() {
			return shell;
		},
		get sky() {
			return sky;
		},
		get sourceFindings() {
			return sourceFindings;
		},
		get sourceProblems() {
			return sourceProblems;
		},
		get studioFeature() {
			return studioFeature;
		},
		get viewportPreview() {
			return viewportPreview;
		},
		get stageEl() {
			return stageEl;
		},
		set stageEl(value) {
			stageEl = value;
		},
		get throughFrameEl() {
			return throughFrameEl;
		},
		set throughFrameEl(value) {
			throughFrameEl = value;
		}
	};
}

export type WorkspaceHost = ReturnType<typeof createWorkspaceHost>;
