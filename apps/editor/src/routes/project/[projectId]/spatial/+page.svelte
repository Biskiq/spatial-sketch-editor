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
	import { onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import type { AppPreferences } from '$lib/platform/app-preferences';
	import { perfMark } from '$lib/platform/perf-marks';
	import { installPerfWorkObserver } from '$lib/platform/perf-work';
	import type { ProjectEnvelope } from '@portfolio/project-model/units';
	import type { SceneArtworkEntity } from '@portfolio/project-model';
	import { primaryEntry, type StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
	import { bootIntentFromSearch, type BootIntent } from '$lib/authoring/stage/boot-state';
	import type { StageDomainRead } from '$lib/authoring/stage/source-admission';
	import { STARTER_TEMPLATES } from '$lib/authoring/stage/starter-gallery';
	import { createStageSession } from '$lib/authoring/stage/stage-session';
	import {
		createLightLookThrough,
		lookThroughCone
	} from '$lib/authoring/adapters/light/light-look-through.svelte';
	import { lightById } from '$lib/authoring/adapters/light/light-subjects';
	import {
		createStageFacade,
		type StageFacade,
		type StageIntentResult,
		type StageCardActionRecord,
		type StageCardWriterRecord
	} from '$lib/authoring/stage/stage-facade';
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
	import { createStageProjectEpoch } from '$lib/authoring/stage/route/stage-project-epoch.svelte';
	import {
		developmentPointAtStationFromBuffers,
		overheadSourcesOf,
		LAYOUT_DIMENSION_LIMIT_MESSAGE,
		type PlanEvaluation
	} from '@portfolio/layout-core';
	import {
		eyeOfInspectionPose,
		fovYDegreesOf,
		type ViewingIntent,
		type ViewportEvaluation,
		type ViewportRect
	} from '@portfolio/camera-core';
	import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
	import { wallFace } from '$lib/authoring/layout/wall-face-store';
	import {
		initialLiftScope,
		interiorLift
	} from '$lib/authoring/layout/interior-lift-store.svelte';
	import {
		wallUnfoldShouldReturn,
		wallUnfoldViewCentreStation
	} from '$lib/layout/wall-unfold';
	import {
		createStagePressTracker,
		readingIntentClockSeconds
	} from '$lib/authoring/stage/stage-input';
	import { installStageInterruptions, type StageInterruptionReason } from '$lib/authoring/stage/stage-interruption';
	import '$lib/authoring/stage/shell/shell-roles.css';
	import '$lib/authoring/stage/shell/cursors.css';
	import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';
	import StagePanels from '$lib/authoring/stage/shell/StagePanels.svelte';
	import StageProjectNotices from '$lib/authoring/stage/shell/StageProjectNotices.svelte';
	import StageToolbars from '$lib/authoring/stage/shell/StageToolbars.svelte';
	import StageViewportRegion from '$lib/authoring/stage/shell/StageViewportRegion.svelte';
	import { artworkHangingGuides, snapArtworkHeight, activeArtworkHangGuide } from '$lib/authoring/artwork/artwork-hanging';
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
	import { isPaperPlanVisible, PAPER_TONES } from '$lib/authoring/stage/paper-plan';
	import { WORLD_ENVIRONMENT_GROUND_RADIUS_METERS } from '$lib/render/world-environment';
	import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
	import { experienceProblems, loweringProblem, type ExperienceProblem } from '$lib/authoring/experience/experience-problems';
	import { createExperiencePreview } from '$lib/authoring/experience/experience-preview.svelte';
	import { isAllowedShippedTextureUri } from '$lib/visitor/shipped-static-registry';
	import {
		scaleDetentIntent,
		type StageDraftingPatch
	} from '$lib/authoring/stage/stage-drafting';
	import type { GridRect } from '$lib/authoring/stage/stage-grid';
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
		type StageHeadFindEntry
	} from '$lib/authoring/stage/route/stage-contribution-view';
	import { createStageShellState } from '$lib/authoring/stage/route/stage-shell-state.svelte';
	import {
		createFinishAuthoring,
		type FinishAuthoring
	} from '$lib/authoring/look/finish-authoring.svelte';
	import { withFinishPreviews } from '@portfolio/project-model/scene-planning';
	import StagePaintPalette from '$lib/authoring/stage/shell/StagePaintPalette.svelte';
	import { createStageShellCommands } from '$lib/authoring/stage/route/stage-shell-commands';
	import {
		createStageExperienceBinding,
		type StageExperienceBinding
	} from '$lib/authoring/stage/route/stage-experience-binding.svelte';
	import type { ExperienceController } from '$lib/authoring/experience/experience-controller.svelte';
	import type { StageLightInspection } from '$lib/authoring/stage/stage-adapter-host';

	installPerfWorkObserver();

	const projectId = decodeURIComponent(page.params.projectId ?? '');
	const intent: BootIntent = bootIntentFromSearch(page.url.searchParams);

	const api: ProjectApi | null = createProjectApi({ apiOrigin: env.PUBLIC_API_ORIGIN });
	const auth = env.PUBLIC_API_ORIGIN ? createProjectAuth(env.PUBLIC_API_ORIGIN) : null;
	const session = createStageSession({ sessionEpoch: 'session:route-boot' });
	const lightPreview = createStageLightPreview();
	const scenePick = createScenePickSource();

	const stageAssets = createStageAssetLeases({
		session,
		apiOrigin: env.PUBLIC_API_ORIGIN ?? '',
		projectId,
		resolveArtwork: async (image, signal) => {
			if (api === null) throw new Error('Artwork storage is unavailable.');
			return readVerifiedArtwork(api, projectId, image, signal);
		},
		resolveTexture: async (assetId, signal) => {
			if (api === null) throw new Error('Finish image storage is unavailable.');
			return api.loadAssetContent(projectId, assetId, signal);
		},
		notice: { read: () => shell.notice, write: (message) => shell.setNotice(message) }
	});

	/** The route's one Spot Look-through session; created with the Stage wiring. */
	let lightInspection: ReturnType<typeof createLightLookThrough> | null = null;
	const lightInspectionPort: StageLightInspection = {
		enter: (lightId) =>
			lightInspection?.enter(lightId) ?? {
				kind: 'refused',
				message: 'The Stage is still opening; try again in a moment.'
			}
	};

	const stageEpoch = createStageProjectEpoch({
		session,
		assets: stageAssets,
		finishes: () => finishes,
		lightInspection: () => lightInspectionPort,
		projectSession: () => projectSession,
		preview: () => previewController,
		createFacade: (snapshot) => createStageFacade({
			snapshot,
			session,
			scenePick: scenePick.pick,
			sceneBounds: scenePick.bounds,
			lightPreview
		}),
		adapterFactories: stageAdapterFactories,
		interruptInput: interruptForReplacement,
		resetFocus: () => experienceFocus.reset(),
		resetPresentationBeforeSwap: resetPresentationBeforeSwap,
		resetPresentation: resetViewContext,
		onFacadeMounted: bindEpochFacade,
		onAdaptersChanged: refreshAdapterPresentation,
		onAccepted: refreshAcceptedPresentation,
		onHistoryInstalled: completeHistoryInstall,
		onNotice: (message) => shell.setNotice(message),
		refresh: () => refresh(),
		isActiveProject: () => boot.status === 'ready' || boot.status === 'empty'
	});

	const projectSession = createProjectSession({
		projectId, intent, api, auth, session,
		url: () => page.url,
		acceptance: () => stageEpoch.acceptance,
		tornDown: () => stageEpoch.tornDown,
		activate: (snapshot) => stageEpoch.activate(snapshot),
		get notice() { return shell.notice; },
		set notice(value) { shell.setNotice(value); }
	});
	const boot = $derived(projectSession.boot);
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
		finishes: () => finishes
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
			lightInspection?.cancel();
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
		return experience.lookThroughActive() || lightInspection?.active() === true;
	}

	lightInspection = createLightLookThrough({
		stage: () => facade,
		services: () => adapterServices,
		lens: () => experience.lensState,
		notice: (message) => shell.setNotice(message),
		refresh: () => refresh(),
		absoluteCss,
		capturePointer,
		stageElement: () => stageEl
	});

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
	const currentEnvelope = $derived.by((): ProjectEnvelope | null =>
		boot.status === 'ready' || boot.status === 'empty' ? stageEnvelope(boot.snapshot) : null
	);
	const experienceFloorDatum = $derived.by(() =>
		boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.datumMeters : 0
	);
	const activeLayer = $derived(
		experience.posture ?? (lightInspection?.active() ? lightInspection.posture : null)
	);
	// `bind:this` lands after the first look-through refresh; measure it then.
	$effect(() => {
		const frame = throughFrameEl;
		const currentView = experience.lookThroughSession();
		const currentLight = lightInspection?.session() ?? null;
		if (frame !== undefined && (currentView !== null || currentLight !== null)) untrack(() => refresh());
	});
	// A lens switch and a Preview takeover both replace the Stage's posture; the
	// Spot inspection must restore its entry before either can present another.
	$effect(() => {
		if (experience.lensState !== 'world') lightInspection?.cancel();
	});
	$effect(() => {
		if (preview !== null) lightInspection?.cancel();
	});

	function changeLens(next: 'world' | 'experience'): void {
		lightInspection?.cancel();
		experience.changeLens(next);
	}

	const selectionView = createStageSelectionView();
	let finishAskSelectionKey = '';
	$effect(() => {
		const entry = selection;
		const key = entry === null
			? ''
			: `${entry.reference.domain}\u0000${entry.reference.subject.kind}\u0000${entry.reference.subject.id}`;
		if (key === finishAskSelectionKey) return;
		finishAskSelectionKey = key;
		untrack(() => finishes.cancelAsk());
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
		planView,
		subjects: locatedSubjects,
		scope: shell.worldScope
	}));
	const dockView = $derived(stageDockView({ facade, revision: shell.contributionsVersion }));
	const paintPalette = $derived(finishes.paintPalette());
	const finishShelf = $derived.by(() => {
		void shell.contributionsVersion;
		return finishes.libraryShelf();
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
		dockKeys
	}));

	const heightSheet = session.heightSheet();
	const skyRects = createStagePanelRects();
	const look = createLookAuthoring({
		sky: () => currentEnvelope?.units.scene.data.environment?.sky ?? null,
		services: () => adapterServices,
		windowHeading: () => facade ? aimThroughWindows(facade.snapshot().domain.geometry) : null,
		onNotice: (message) => shell.setNotice(message)
	});

	let artworkInteraction!: ReturnType<typeof createStageArtworkInteraction>;
	let unfoldGestures!: ReturnType<typeof createStageUnfoldGestures>;
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
		showExperienceWelcome: () => experience.showWelcome()
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
			shell.setLibraryOpen(true);
			shell.requestLibraryCategory('materials');
			shell.setActiveWorldTool('objects');
			shell.setWorldPlateOpen(true);
			shell.setPaletteOpen(false);
		},
		armPaint: () => commands.armWorldTool('paint')
	});
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
		pickVisibleFace: scenePick.pickVisibleFace,
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
		planView: () => planView,
		previewing: () => preview !== null,
		pick: scenePick.pick,
		viewMarkAt: (event) => experience.viewMarkAt(event),
		eraseHover: () => shell.eraseHover,
		setEraseHover: (entry) => shell.setEraseHover(entry),
		setPaintHover: (entry) => shell.setPaintHover(entry),
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
		cancelFinishAsk: () => finishes.cancelAsk(),
		interrupt: interruptPress,
		task: () => shell.task,
		closeTask: () => commands.closeTask(),
		armedHostTool: () => shell.armedHostTool,
		measureTool: () => shell.measureTool,
		eraserTool: () => shell.eraserTool,
		paintTool: () => shell.paintTool,
		clearEraseHover: () => shell.setEraseHover(null),
		clearPaintHover: () => shell.setPaintHover(null),
		refreshHostTools: () => shell.refreshHostTools(),
		armedDockKey: () => dockKeys.find((key) => key.id === armedDockId),
		paletteOpen: () => shell.paletteOpen,
		closePalette: () => shell.setPaletteOpen(false),
		libraryOpen: () => shell.libraryOpen,
		toggleLibrary: () => commands.toggleWorldLibrary(),
		activeWorldTool: () => shell.activeWorldTool,
		clearWorldTool: () => { shell.setLibraryOpen(false); shell.setActiveWorldTool('select'); },
		worldPlateOpen: () => shell.worldPlateOpen,
		closeWorldPlate: () => shell.setWorldPlateOpen(false),
		dismissSky: () => {
			if (!look.panelOpen) return false;
			look.setPanelOpen(false);
			document.querySelector<HTMLButtonElement>('[data-stage-environment-control]')?.focus();
			return true;
		},
		lens: () => experience.lensState,
		selectionPresent: () => selection !== null,
		closeSelection: () => commands.closeSelection(),
		liftActive: () => interiorLift.isActive(),
		putBackLift: () => interiorLift.putBack()
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

	const paperVisible = $derived(isPaperPlanVisible(evaluation, shell.preferences.planAppearance));
	const modelUrls = $derived(stageAssets.urls);

	/**
	 * The Rooms whose generated lids the live Lift reading has lifted.
	 *
	 * The route only maps Layout's overhead sources to the representation's ids:
	 * which overheads a scope names is `overheadSourcesOf`'s answer, and V1's
	 * authored regions will need their own representation instead of this list.
	 * `VisitorPreviewSurface` never receives it, so Preview stays as-built.
	 */
	const liftedSources = $derived.by(() => {
		const reading = interiorLift.reading;
		if (reading === null) return [];
		if (boot.status !== 'ready' && boot.status !== 'empty') return [];
		return overheadSourcesOf(boot.snapshot.domain.geometry, reading.scope);
	});
	const liftedRoomIds = $derived(liftedSources.map((source) => source.subject.id));
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

	function readStageContentBounds(stage: StageFacade): {
		readonly min: [number, number, number];
		readonly max: [number, number, number];
	} | null {
		const layoutBounds = stage.snapshot().domain.geometry.bounds;
		let min: [number, number, number] | null =
			layoutBounds === null ? null : [layoutBounds.min[0], layoutBounds.min[1], layoutBounds.min[2]];
		let max: [number, number, number] | null =
			layoutBounds === null ? null : [layoutBounds.max[0], layoutBounds.max[1], layoutBounds.max[2]];
		for (const entity of stage.snapshot().domain.scene.entities) {
			const bounds = stage.sceneBounds(entity.id);
			if (bounds === null) continue;
			min = min === null
				? [bounds.min[0], bounds.min[1], bounds.min[2]]
				: [Math.min(min[0], bounds.min[0]), Math.min(min[1], bounds.min[1]), Math.min(min[2], bounds.min[2])];
			max = max === null
				? [bounds.max[0], bounds.max[1], bounds.max[2]]
				: [Math.max(max[0], bounds.max[0]), Math.max(max[1], bounds.max[1]), Math.max(max[2], bounds.max[2])];
		}
		return min === null || max === null ? null : { min, max };
	}

	let renderRootsRevision = $state(0);
	$effect(() => scenePick.onRenderRootsChanged(() => (renderRootsRevision += 1)));
	const stageContentBounds = $derived.by(() => {
		void renderRootsRevision;
		if (boot.status !== 'ready' && boot.status !== 'empty') return null;
		return facade === null ? null : readStageContentBounds(facade);
	});
	const paperContentBounds = $derived.by((): GridRect | null => {
		const bounds = stageContentBounds;
		return bounds === null
			? null
			: { minX: bounds.min[0], maxX: bounds.max[0], minZ: bounds.min[2], maxZ: bounds.max[2] };
	});
	$effect(() => facade?.camera.setContentBounds(stageContentBounds));

	function canPlaceArtwork(): boolean {
		return experience.lensState === 'world' && preview === null && wallUnfold.state === null;
	}

	$effect(() => () => {
		// Leaving the project ends the reading: Lift is never carried across routes.
		interiorLift.clear();
		finishes?.cancelImage();
		artworkInteraction.dispose();
		stageAssets.disposeArtwork();
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
			actions: worldCard.actions,
			functions: null,
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

	function resetViewContext(): void {
		// A replaced project has no standpoint to put back into the new Camera, and
		// no overhead to keep lifted: Lift is session state, never a document value.
		lightInspection?.cancel();
		wallFace.clear();
		interiorLift.clear();
		selection = null;
		shell.setTask(null);
		revealed = [];
		shell.setNotice('');
		shell.setPendingDelete(null);
		shell.setArmedTool(null);
		shell.setCardOpen(true);
		artworkInteraction.cancel();
		artworkInteraction.cancelResize();
		stageInput.reset();
		stageViewport.reset();
	}

	function interruptForReplacement(): void {
		// The old facade is about to be disposed; its inspection restores the entry
		// standpoint now, never through the replacement's Camera.
		lightInspection?.cancel();
		clearHover();
		interruptPress('replacement');
		// An image upload from the old source must not complete into the new one.
		finishes?.cancelImage();
	}

	function resetPresentationBeforeSwap(): void {
		shell.setExpandedPresentationId(null);
	}

	function bindEpochFacade(next: StageFacade): void {
		shell.bindFacade(next);
	}

	function refreshAdapterPresentation(): void {
		shell.bumpContributions();
		shell.setTask(facade?.session.task() ?? null);
		commands.syncPrimarySelection(facade ? primaryEntry(facade.selectionState()) : null);
		commands.syncContributedTask();
	}

	function refreshAcceptedPresentation(): void {
		// An accepted source can delete or move the Spot under inspection. End the
		// idle session now instead of waiting for the next pointer action.
		lightInspection?.reconcile();
		shell.setTask(facade?.session.task() ?? null);
		commands.syncPrimarySelection(facade ? primaryEntry(facade.selectionState()) : null);
		commands.syncContributedTask();
		stageViewport.invalidatePlan();
		refresh();
	}

	function completeHistoryInstall(outcome: {
		readonly selectionClearedReason: 'subject-retired' | 'no-correspondence' | null;
	}): void {
		selection = facade ? primaryEntry(facade.selectionState()) : null;
		if (outcome.selectionClearedReason !== null) {
			shell.setNotice('The selected subject no longer exists in the restored source.');
		}
		// Undo/Redo installs an accepted source too; the inspected Spot may have
		// changed or disappeared.
		lightInspection?.reconcile();
		stageViewport.invalidatePlan();
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

	function handleKey(event: KeyboardEvent): void {
		stageKeyboard.handleKey(event);
	}

	function submit(intent: ViewingIntent, clockSeconds: number): StageIntentResult | null {
		const stage = facade;
		if (stage === null) return null;
		if (stageInput.drag?.mode === 'adapter' && intent.kind !== 'set-reading') return null;
		const first = stage.requestViewingIntent(intent, stage.inspectionTicket(), clockSeconds);
		if (first.kind !== 'superseded') return first;
		stage.acquireInspection('exclusive');
		return stage.requestViewingIntent(intent, stage.inspectionTicket(), clockSeconds);
	}

	function setReading(reading: '3d' | 'plan'): void {
		finishes.cancelAsk();
		submit({ kind: 'set-reading', reading }, readingIntentClockSeconds(shell.reducedMotion, nowSeconds()));
		if (stageInput.drag !== null && session.gesture() === null) {
			if (stageInput.drag.mode === 'adapter' && facade !== null) {
				const css: [number, number] = [stageInput.drag.x - (rect?.left ?? 0), stageInput.drag.y - (rect?.top ?? 0)];
				refresh();
				const id = facade.evaluationId();
				if (id !== null) facade.pointerIntent({ phase: 'move', css, evaluationId: id });
			}
			interruptPress('reading-change');
		}
	}

	function patchDrafting(patch: StageDraftingPatch): void {
		shell.patchDrafting(patch);
	}

	function requestScaleDetent(ratio: number): void {
		const stage = facade;
		const viewport = rect;
		if (stage === null || viewport === null || viewport.height <= 0) return;
		const settledHeight = stage.camera.state().pose.targetPlaneHeightMeters;
		const intent = scaleDetentIntent(ratio, settledHeight / viewport.height);
		if (intent !== null) submit(intent, nowSeconds());
	}

	function fit(): void {
		const stage = facade;
		if (stage === null || rect === null) return;
		const bounds = readStageContentBounds(stage);
		if (bounds === null) return;
		submit({ kind: 'fit', bounds: { min: bounds.min, max: bounds.max }, rect }, nowSeconds());
	}

	function zoomIn(): void {
		zoom(1 / 1.25);
	}

	function zoomOut(): void {
		zoom(1.25);
	}

	function bringIntoView(target: readonly [number, number, number]): void {
		submit({ kind: 'bring-into-view', target: [target[0], target[1], target[2]] }, nowSeconds());
	}

	function zoom(scale: number): void {
		submit({ kind: 'zoom', scale }, nowSeconds());
	}

	function pan(dx: number, dy: number): void {
		if (rect === null) return;
		submit({ kind: 'pan', deltaCss: [dx, dy], rect }, nowSeconds());
	}

	function orbit(dAzimuth: number, dElevation: number): void {
		submit({ kind: 'orbit', deltaAzimuthRadians: dAzimuth, deltaElevationRadians: dElevation }, nowSeconds());
	}

	// A6 — the Face reading's one camera port. The route owns the session clock and
	// the reduced-motion rule; the Layout adapter supplies only bounds and a look
	// direction, and Put back restores the exact standpoint Face started from.
	$effect(() => {
		wallFace.setCameraPort({
			standpoint: () => facade?.camera.state() ?? null,
			face: (frame) => {
				const stage = facade;
				const viewport = rect;
				if (stage === null || viewport === null) return false;
				const result = submit(
					{ kind: 'face', bounds: frame.bounds, look: frame.look, rect: viewport },
					readingIntentClockSeconds(shell.reducedMotion, nowSeconds())
				);
				return result?.kind === 'accepted';
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

	onMount(() => {
		perfMark('stage:route-mounted');
		experience.start();
		shell.start();
		stageViewport.start();

		const onKey = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			if (event.altKey) shell.suspendSnap(true);
			handleKey(event);
		};
		const onReleaseSnap = (event: KeyboardEvent) => {
			if (event.key === 'Alt') shell.suspendSnap(false);
		};
		const onWindowBlur = () => shell.suspendSnap(false);
		window.addEventListener('keydown', onKey);
		window.addEventListener('keyup', onReleaseSnap);
		window.addEventListener('blur', onWindowBlur);
		const removeInterruptions = installStageInterruptions(window, document, interruptPress);

		void projectSession.load(projectId, intent);

		return () => {
			unfoldGestures.dispose();
			lightInspection?.dispose();
			experience.dispose();
			stageEpoch.markTornDown();
			stageViewport.dispose();
			shell.dispose();
			clearHover();
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('keyup', onReleaseSnap);
			window.removeEventListener('blur', onWindowBlur);
			removeInterruptions();
			stageEpoch.dispose();
		};
	});

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

	const canvas = $derived.by(() => {
		if (boot.status !== 'ready' && boot.status !== 'empty') return null;
		// Keep view updates from replaying the Canvas source and root-registration effects.
		// StageViewportRegion spreads these props, so each getter tracks its own inputs.
		return {
			scenePick,
			get dial() { return dial; },
			lightPreview,
			geometry: boot.snapshot.domain.geometry,
			sourceContentId: boot.snapshot.sourceContentId,
			layoutRevision: boot.snapshot.domain.unitRevisions.layout,
			get scene() {
				const accepted = boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.scene : null;
				if (accepted === null) return boot.snapshot.domain.scene;
				return finishes.previewFinish.size === 0
					? accepted
					: withFinishPreviews(accepted, finishes.previewFinish);
			},
			get evaluation() { return evaluation; },
			get ghosts() { return ghosts; },
			get modelUrls() { return modelUrls; },
			get textureScope() { return stageAssets.textureScope; },
			get textureRevision() { return stageAssets.textureRevision; },
			get artworkScope() { return stageAssets.artworkScope; },
			get artworkGhost() { return artworkInteraction.resizeGhost ?? artworkInteraction.ghost; },
			onArtworkError: (message: string) => shell.setNotice(message),
			get plan() { return planView; },
			get planAppearance() { return shell.preferences.planAppearance; },
			get paperInk2d() { return PAPER_TONES[shell.preferences.paperTone2d].ink; },
			get paperInk3d() { return PAPER_TONES[shell.preferences.paperTone3d].ink; },
			get drafting() { return shell.drafting; },
			datumMeters: boot.snapshot.domain.datumMeters,
			get contentBounds() { return paperContentBounds; },
			get snapshotBounds() { return stageContentBounds; },
			get sky() { return look.stageSky; },
			get framedViewport() { return lookThroughActiveNow() ? throughViewport : null; },
			get selection() { return selection; },
			get hover() {
				return shell.armedHostTool === 'erase'
					? shell.eraseHover
					: shell.armedHostTool === 'paint'
						? shell.paintHover
						: stageInput.hoverSelection;
			},
			get hoverTone() { return shell.armedHostTool === 'erase' ? 'erase' as const : 'hover' as const; },
			get liftedRoomIds() { return liftedRoomIds; },
			get liftSources() { return liftedSources; },
			get heightMeters() { return experience.lensState === 'world' ? shell.heightMeters : null; },
			get heightPlaneVisible() { return experience.lensState === 'world' && shell.heightPlaneVisible; },
			get unfoldPinHovered() { return unfoldGestures.pinHovered; },
			get unfoldPinActive() { return unfoldGestures.sheetPinActive; },
			unfoldAnchorPin: unfoldGestures.idlePin?.point ?? null
		};
	});

	const overlay = $derived({
		celestial: dial && evaluation ? { dial, camera: evaluation, haze: look.shownSky.haze, owner: look.gesture.owner } : null,
		markers,
		marks: [...marks, ...look.stageMarks],
		roomLabels,
		guides,
		candidates: [...candidatePreviews, ...(artworkInteraction.placementCandidate === null ? [] : [artworkInteraction.placementCandidate])],
		viewportWidth: rect?.width ?? 0,
		viewportHeight: rect?.height ?? 0,
		tracePreview,
		hostTools: shell.hostToolOverlay,
		lightGround: paperVisible || evaluation?.renderedReading === '3d'
	});

	const stageCursor = $derived(
		experience.viewEdit !== null ? (experience.viewEdit.kind === 'turn' ? 'turn' : 'grabbing')
			: stageInput.drag?.mode === 'pan' || stageInput.drag?.mode === 'orbit' || (stageInput.drag?.mode === 'adapter' && shell.task === null) ? 'grabbing'
				: lookThroughActiveNow() ? 'look'
					: experience.experienceTool === 'place' ? 'place-view'
						: stageInput.hoverMove ? 'move'
							: shell.task?.kind === 'layout-ink' || shell.armedHostTool !== null ? 'draw'
								: 'select'
	);

	const viewportLookThrough = $derived.by(() => {
		const controller = lightInspection;
		const inspection = controller?.session() ?? null;
		if (controller !== null && inspection !== null) {
			return {
				mode: 'light' as const,
				label: inspection.label,
				moved: controller.moved(),
				canUpdate: !controller.busy(),
				beam: controller.beam(),
				onUpdate: (): void => void controller.finish(),
				onExit: (): boolean => controller.exit()
			};
		}
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

	/** The inspected Spot's real cone, projected by the one evaluation. */
	const lightCoverage = $derived.by(() => {
		const inspection = lightInspection?.session() ?? null;
		const stage = facade;
		const current = evaluation;
		if (inspection === null || stage === null || current === null) return null;
		const light = lightById(stage.snapshot(), inspection.lightId);
		if (light === null || light.light !== 'spot') return null;
		const evaluationId = stage.evaluationId();
		if (evaluationId === null) return null;
		const projectRing = (points: readonly (readonly [number, number, number])[]) => {
			const projected: [number, number][] = [];
			for (const point of points) {
				const result = stage.projectWorld(point, evaluationId);
				if (result.kind !== 'projected') return null;
				projected.push([
					result.css[0] - current.rect.left,
					result.css[1] - current.rect.top
				]);
			}
			return projected;
		};
		const cone = lookThroughCone(light);
		const capRing = projectRing(cone.capRing);
		if (capRing === null || capRing.length === 0) return null;
		const innerRing = cone.innerRing === null ? null : projectRing(cone.innerRing);
		return { capRing, innerRing };
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

</script>

<div class="editor-host" data-shell="living-draft">
	{#if preview === null}
		<EditorHead
			{projectId}
			projectName={boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.name : 'Loading project'}
			lens={experience.lensState}
			onLens={changeLens}
			canDownloadSource={activeProject()}
			onDownloadSource={downloadSourceJson}
			onOpenSource={() => requestReplacement('source')}
			historyUnavailableReason={historyState.undoUnavailableReason ?? 'Nothing to undo yet.'}
			redoUnavailableReason={historyState.redoUnavailableReason ?? 'Nothing to redo.'}
			canUndo={historyState.canUndo}
			canRedo={historyState.canRedo}
			onUndo={() => { finishes.cancelAsk(); void stageEpoch.undo(); }}
			onRedo={() => { finishes.cancelAsk(); void stageEpoch.redo(); }}
			save={headSave}
			onReloadRemote={(offer) => void applyReloadOffer(offer)}
			saveUnavailableReason="Conditional Save needs the cloud client; this session has none."
			canPreview={previewAvailable}
			onPreview={() => void previewController.open()}
			previewUnavailableReason={currentEnvelope === null
				? 'Preview needs an admitted project source.'
				: 'Create an Experience in the Experience lens to Preview it.'}
			indexOpen={shell.indexOpen}
			onToggleIndex={() => shell.setIndexOpen(!shell.indexOpen)}
			locationLabel={selectionViewView.locationLabel}
			onOpenIndex={() => shell.setIndexOpen(true)}
			{projectActionsUnavailableReason}
			{projectActionBusy}
			onPrepareRename={() => prepareProjectLifecycle(false)}
			onRenameProject={renameCurrentProject}
			onPrepareDelete={() => prepareProjectLifecycle(true)}
			onDeleteProject={deleteCurrentProject}
			onProjectActionComplete={finishCurrentProjectAction}
			onProjectActionBusyChange={projectSession.setProjectActionBusy}
			onRefreshRemoteProject={reloadLifecycleRemote}
			find={{
				query: shell.findQuery,
				entries: findView.entries,
				onQuery: (value: string) => shell.setFindQuery(value),
				onRun: (entry: Pick<StageHeadFindEntry, 'id' | 'adapterId'>) => commands.runHeadFindEntry(entry)
			}}
		/>
	{/if}

	<StageProjectNotices
		resumeOffer={resumeOffer !== null}
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
	>
		<StageViewportRegion
			previewing={preview !== null}
			{canvas}
			{overlay}
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
			scaleBar={experience.lensState === 'world' && evaluation?.projectionKind === 'plan-orthographic'
				? { bar: shell.draftingScaleBar, quiet: paperVisible }
				: null}
			heightSheet={experience.lensState === 'world'
				? {
					heightMeters: shell.heightMeters,
					ticks: shell.heightTicks,
					pins: shell.heightPins,
					snapIncrement: shell.heightSnapIncrement,
					reducedMotion: shell.reducedMotion,
					side: shell.heightSheetSide,
					drawing: shell.task?.kind === 'layout-ink',
					onSetHeight: shell.setHeight,
					onAddPin: shell.addHeightPin,
					onActiveChange: shell.setHeightPlaneActive,
					onResetSubscribe: (onReset: () => void) => heightSheet.subscribeReset('height-sheet-control', onReset)
				}
				: null}
			lookThrough={viewportLookThrough}
			{lightCoverage}
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
			notice={experience.lensState !== 'experience' ? shell.notice : ''}
			preview={viewportPreview}
			previewLoading={preview !== null && viewportPreview === null}
			{stageCursor}
			styleCursor={stageInput.stageCursor}
			{paperVisible}
			homes={experience.lensState === 'experience' && adapterServices !== null && currentEnvelope !== null
				? { services: adapterServices, snapshot: currentEnvelope }
				: null}
			onLaneWidth={(width) => shell.setSheetLaneWidth(width)}
			onExperienceController={(controller: ExperienceController | null) => experience.setController(controller)}
			onActivateDisclosure={(id) => {
				if (facade?.activateDisclosure(id) === true) facade.notifySurfaceChange();
			}}
			input={viewportInput}
			bind:stageElement={stageEl}
			bind:throughFrameElement={throughFrameEl}
		/>

		{#snippet toolbars()}
			<StageToolbars
				previewing={preview !== null}
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
							lift: liftControl
						}
					}
					: null}
				show={preview === null && experience.lensState === 'experience'
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
					: null}
				world={preview === null && experience.lensState === 'world'
					? {
						activeTool: shell.activeWorldTool,
						libraryOpen: shell.libraryOpen,
						plateOpen: shell.worldPlateOpen,
						requestedCategory: shell.libraryCategoryRequest,
						onPlateOpen: (open: boolean) => shell.setWorldPlateOpen(open),
						onTool: (id) => commands.armWorldTool(id),
						onLibrary: () => commands.toggleWorldLibrary(),
						onObjectPick: (assetId: string) => commands.pickWorldObject(assetId),
						onMaterialPick: look.pickMaterial,
						finishShelf,
						onFinishPick: (ref) => void finishes.pickFinish(ref),
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
						plateKind: shell.activeWorldTool === 'walls' || shell.activeWorldTool === 'opening' ? 'ink' : shell.activeWorldTool === 'objects' ? 'objects' : null,
						inkReading: shell.inkReading,
						onTogglePalette: () => shell.togglePalette()
					}
					: null}
				instrument={preview === null && contributedInstrument !== null && (contributedInstrument.presentation !== 'palette' || shell.paletteOpen)
					? {
						task: taskHost,
						onClose: () => commands.closeTask(),
						onCollapse: () => shell.setPaletteOpen(false),
						instrument: contributedInstrument
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
				onLowerColumnHeight={(height) => shell.setLowerColumnHeight(height)}
			/>
		{/snippet}

		<StagePanels
			{toolbars}
			rects={skyRects}
			environment={adapterServices && experience.lensState === 'world' ? { look, fading: liveStageGesture || stageInput.drag?.mode === 'orbit' } : null}
			previewing={preview !== null}
			scrim={preview === null && shell.narrowShell && shell.indexOpen}
			onCloseScrim={() => shell.setIndexOpen(false)}
			index={{
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
			}}
			card={{
				identity: preview === null && shell.cardOpen ? shownCard.identity : null,
				facts: shownCard.facts,
				nameWriter: shownCard.nameWriter,
				renameRequest: shell.cardRenameRequest,
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
			}}
			inactiveTask={preview === null && inactiveTask !== null ? { label: inactiveTask.label } : null}
			onResumeTask={() => commands.resumeTask()}
			onCloseTask={() => commands.closeTask()}
			keysOpen={shell.keysOpen}
			onCloseKeys={() => shell.setKeysOpen(false)}
		/>

		{#if shell.armedHostTool === 'paint' && preview === null}
			<StagePaintPalette
				palette={paintPalette}
				onPick={(key) => finishes.setActiveFromKey(key)}
				onDropper={() => (finishes.dropperArmed ? finishes.cancelDropper() : finishes.armDropper(null))}
				onCancel={() => commands.armWorldTool('select')}
				onLibrary={() => finishes.openFinishes()}
			/>
		{/if}

	</div>

	{#if boot.status === 'new'}
		<div class="boot-panel" role="dialog" aria-label="Start a project">
			<h1>Start this project</h1>
			<p>Choose the canonical starter gallery, or begin genuinely empty.</p>
			{#each STARTER_TEMPLATES as template (template.id)}
				<button type="button" class="primary" onclick={() => void runReplacement('starter')}>{template.label}</button>
			{/each}
			<button type="button" onclick={() => void runReplacement('empty')}>Begin empty</button>
		</div>
	{:else if boot.status !== 'ready' && boot.status !== 'empty'}
		<div class="boot-panel" role="status" aria-live="polite">
			{#if boot.status === 'loading'}
				<span class="boot-brand">Biskiq Editor</span>
				<p class="boot-loading">Loading project…</p>
			{:else if boot.status === 'missing'}
				<h1>Project not found</h1>
				<p>This project does not exist for your account.</p>
			{:else if boot.status === 'forbidden'}
				<h1>Sign-in required</h1>
				<p>This project belongs to another session.</p>
			{:else if boot.status === 'refused'}
				<h1>Unsupported project source</h1>
				<p>
					{boot.reason === 'dimension-limit'
						? LAYOUT_DIMENSION_LIMIT_MESSAGE
						: boot.reason === 'invalid-json'
							? 'The source JSON did not parse.'
							: boot.reason === 'project-mismatch'
								? 'That source belongs to another project.'
								: 'The source is not the current document format.'}
				</p>
				<ul>
					{#each boot.issues.slice(0, 5) as issue (issue.path + issue.code)}
						<li>{issue.path}: {issue.message}</li>
					{/each}
				</ul>
			{:else if boot.status === 'diagnostics'}
				<h1>Canonical compile blocked</h1>
				<p>The source validated, but its canonical compile has blocking issues.</p>
				<ul>
					{#each boot.issues.slice(0, 5) as issue (issue.path + issue.code)}
						<li>{issue.path}: {issue.message}</li>
					{/each}
				</ul>
			{:else if boot.status === 'error'}
				<h1>Project unavailable</h1>
				<p>{boot.message}</p>
			{/if}
		</div>
	{/if}

	{#if pendingReplacement !== null}
		<div class="boot-panel" role="alertdialog" aria-label="Replace project">
			<h1>Replace the current project?</h1>
			<p>This cancels pending work and clears selection and task before swapping to the new baseline.</p>
			<button type="button" class="primary" onclick={() => void runReplacement(pendingReplacement!)}>Replace</button>
			<button type="button" onclick={projectSession.cancelReplacement}>Cancel</button>
		</div>
	{/if}
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
	@media (pointer: coarse) {
		.editor-host {
			--shell-touch-target: 44px;
			--shell-head-height: 52px;
		}
	}
	/* Boot, absence and replacement are dialogs, so they share the light Card
	   surface and field grammar rather than the dark stage's forest panel. */
	.boot-panel {
		position: absolute;
		z-index: 30;
		top: 4rem;
		left: 50%;
		transform: translateX(-50%);
		width: min(32rem, calc(100% - 2rem));
		padding: 1.1rem 1.2rem 1.15rem;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 14px;
		background: var(--shell-card);
		color: var(--shell-ink);
		box-shadow: var(--shell-shadow);
		box-sizing: border-box;
	}
	.boot-brand {
		color: var(--shell-forest-raised);
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.boot-panel h1,
	.boot-panel .boot-loading {
		margin: 0 0 0.4rem;
		color: var(--shell-ink);
		font: 600 var(--shell-text-title) / 1.25 var(--shell-sans);
		letter-spacing: -0.01em;
	}
	.boot-panel .boot-loading {
		margin: 0.3rem 0 0;
	}
	.boot-panel p {
		margin: 0 0 0.8rem;
		color: var(--shell-ink-2);
		font: var(--shell-text-body) / 1.45 var(--shell-sans);
	}
	.boot-panel button {
		margin: 0 0.4rem 0.35rem 0;
		min-height: 30px;
		padding: 0 0.7rem;
		border: 1px solid var(--shell-field-line-strong);
		border-radius: 7px;
		background: var(--shell-field);
		color: var(--shell-ink);
		font: 500 var(--shell-text-control) var(--shell-sans);
		cursor: pointer;
	}
	.boot-panel button:hover {
		background: var(--shell-hover);
	}
	.boot-panel button.primary {
		border-color: transparent;
		background: var(--shell-action);
		color: var(--shell-on-action);
	}
	.boot-panel button.primary:hover {
		background: var(--shell-forest-raised);
	}
	.boot-panel button:focus-visible {
		outline: var(--shell-focus-ring-light);
		outline-offset: 1px;
	}
</style>
