<script lang="ts">
	import { roomLabelFacts, projectRoomLabels, type RoomLabelView } from '$lib/authoring/stage/room-labels';
	import { acceptedSceneRoomMembership } from '$lib/authoring/adapters/scene/room-membership';
	import {
		createWorldIndexModel,
		resolveWorldScope,
		type WorldScope
	} from '$lib/authoring/stage/shell/world-index-model';
	import { stageEnvelope, stageLayout, stageScene, stageUnitRevision } from '$lib/authoring/stage/unit-stage-source';
	import {
		indexLabels,
		layoutKindWord,
		membershipLabel,
		sceneKindWord,
		type IndexLabelInput
	} from '$lib/authoring/stage/shell/index-labels';

	/**
	 * T1.P01.S02 — the editor **route host**.
	 *
	 * This replaces the foundation-reset notice. It performs a **read-only cloud
	 * boot** (only `loadProject`), admits the source through the one admission path
	 * (canonical validation + canonical compile + runtime Scene resolution), and
	 * mounts the Stage shell on the admitted snapshot. The route reaches no raw
	 * writer: the Head owns `api.saveAcceptedSource` behind its Save transport, and
	 * TD-9's sign-in capture is written and cleared only through the Save-owned
	 * `pending-capture` seam (see `editor-host-no-write.test.ts`).
	 *
	 * Every explicit state is rendered: loading, new (starter gallery/empty), empty,
	 * ready, diagnostics (blocking compile), refused (invalid/non-current format),
	 * missing, forbidden and error. A minted identity starts directly on an admitted
	 * empty baseline; starter replacement remains available through Find. An
	 * explicitly opened absence is `missing`.
	 *
	 * One Stage canvas serves both readings and both lenses. Reading flips are
	 * Camera-evaluated (never a shell tween); pointer input becomes viewing intent;
	 * a click selects through the eligible Plan fragments so a hidden or excluded
	 * target can never intercept input.
	 */
	import { onMount, tick, untrack } from 'svelte';
	import { DEFAULT_APP_PREFERENCES, readAppPreferences, writeAppPreferences, type AppPreferences } from '$lib/platform/app-preferences';
	import { createEditorMotionClock } from '$lib/platform/editor-motion-clock';
	import { createProjectSession } from '$lib/authoring/project-session/project-session.svelte';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import { createProjectApi, createProjectAuth, type ProjectApi } from '$lib/platform/project-persistence';
	import { perfInput, perfMark, perfMarksEnabled, perfTracePreview, type PerfTracePreview } from '$lib/platform/perf-marks';
	import { installPerfWorkObserver } from '$lib/platform/perf-work';
	import type { ProjectEnvelope } from '@portfolio/project-model/units';
	import { layoutSelectionReference, primaryEntry, sameReference, type StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
	import { bootIntentFromSearch, type BootIntent } from '$lib/authoring/stage/boot-state';
	import type { StageDomainRead, StageReadSnapshot } from '$lib/authoring/stage/source-admission';
	import { STARTER_TEMPLATES } from '$lib/authoring/stage/starter-gallery';
	import {
		createStageSession,
		runBoundLoad,
		type StageSession,
		type StageSelection,
		type StageTask
	} from '$lib/authoring/stage/stage-session';
	import {
		createStageFacade,
		type StageCardActionRecord,
		type StageCardSubject,
		type StageCardWriterRecord,
		type StageFacade,
		type StageIntentResult,
		type StageInstrumentContent,
		type StageCandidatePreviewView,
		type StageGhostMesh,
		type StageOverlayContribution,
		type StageSourceHit
	} from '$lib/authoring/stage/stage-facade';
	import type { StageMarkView } from '$lib/authoring/stage/stage-handles';
	import { stageResizeCursorCss } from '$lib/authoring/stage/stage-glyphs';
	import { stageAdapterFactories } from '$lib/authoring/adapters/catalog';
	import {
		createStageAdapterServices,
		mountStageAdapter,
		type StageAdapterServices
	} from '$lib/authoring/stage/stage-adapter-host';
	import {
		stageCardActions,
		stageCardFacts,
		stageCardWriter,
		stageFindEntries,
		stageDockKeys,
		stageDockTools,
		STAGE_HOST_ADAPTER_ID,
		type StageDockKey
	} from '$lib/authoring/stage/stage-contributions';
	import { createStageMeasure, STAGE_MEASURE_TASK, type StageMeasureController } from '$lib/authoring/stage/stage-measure';
	import { createStageEraser, STAGE_ERASER_TASK, type StageEraserController } from '$lib/authoring/stage/stage-eraser';
	import {
		createStageAcceptanceHost,
		type StageAcceptanceHost,
		type StageHistoryState
	} from '$lib/authoring/stage/host-acceptance';
	import {
		developmentPointAtStationFromBuffers,
		LAYOUT_DIMENSION_LIMIT_MESSAGE,
		type CompiledPhysicalWall,
		planFragmentOf,
		planMembershipOf,
		type PlanEvaluation,
		type PlanMembershipReason
	} from '@portfolio/layout-core';
	import { buildLayoutIntent, LAYOUT_OPENING_MEASURE_KIND } from '$lib/authoring/adapters/layout/precision';
	import { LAYOUT_OPENING_RESIZE_KIND } from '$lib/authoring/adapters/layout/opening-planners';
	import { CAMERA_FOV, eyeOfInspectionPose, fovYDegreesOf, frameSubjectPose, pointerRay, viewPlacementPose, type ViewingIntent, type ViewportEvaluation, type ViewportRect } from '@portfolio/camera-core';
	import { wallUnfold } from '$lib/authoring/layout/wall-unfold-store.svelte';
	import {
		chooseUnfoldAmount,
		isStraightCompiledWall,
		snapWallUnfoldAmount,
		wallUnfoldAnchor,
		wallUnfoldFreeEdgeStation,
		wallUnfoldShouldReturn,
		wallUnfoldSourceSpans,
		wallUnfoldTopPoint,
		wallUnfoldViewCentreStation,
		WALL_UNFOLD_EDGE_HIT_COARSE_CSS,
		WALL_UNFOLD_EDGE_HIT_CSS,
		WALL_UNFOLD_PIN_HIT_COARSE_CSS,
		WALL_UNFOLD_PIN_HIT_CSS,
		type WallUnfoldEdgeCandidate
	} from '$lib/layout/wall-unfold';
	import {
		buildWallUnfoldDisplay,
		evaluateWallUnfoldDisplay,
		pickWallUnfold,
		type WallUnfoldDisplay,
		type WallUnfoldPick,
		unfoldDisplayPointAtStation
	} from '$lib/layout/wall-unfold-pick';
	import {
		mapSheetOpeningDrag,
		sheetOpeningModeFromEdges,
		type SheetOpeningMode
	} from '$lib/layout/wall-unfold-opening-drag';
	import {
		createStagePressTracker,
		readingIntentClockSeconds,
		stageKeyAction,
		stageKeyFromControl,
		stageKeyFromTextEntry,
		STAGE_DOCK_SHORTCUTS,
		isStageDrag,
		type StageDockSlot
	} from '$lib/authoring/stage/stage-input';
	import { installStageInterruptions, type StageInterruptionReason } from '$lib/authoring/stage/stage-interruption';
	import '$lib/authoring/stage/shell/shell-roles.css';
	import '$lib/authoring/stage/shell/cursors.css';
	import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';
	import EditorIndex from '$lib/authoring/stage/shell/EditorIndex.svelte';
	import EditorCard from '$lib/authoring/stage/shell/EditorCard.svelte';
	import StageDraftingControl from '$lib/authoring/stage/shell/StageDraftingControl.svelte';
	import WorldIcon from '$lib/authoring/world-toolbar/WorldIcon.svelte';

import WorldToolbar from '$lib/authoring/world-toolbar/WorldToolbar.svelte';
import InkPlate from '$lib/authoring/world-toolbar/InkPlate.svelte';
import ObjectsPlate from '$lib/authoring/world-toolbar/ObjectsPlate.svelte';
import SkyControl from '$lib/authoring/world-toolbar/SkyControl.svelte';
import { createArtworkAuthoring } from '$lib/authoring/artwork/artwork-authoring.svelte';
	import ArtworkResizeOverlay from '$lib/authoring/artwork/ArtworkResizeOverlay.svelte';
	import { artworkPlanePoint, resizeArtworkAtRay, type ArtworkCorner } from '$lib/authoring/artwork/artwork-resize';
	import { ARTWORK_TRANSFORM } from '@portfolio/project-model/scene-planning';
	import type { SceneArtworkEntity } from '@portfolio/project-model';
	import { artworkCommand, artworkReference } from '$lib/authoring/artwork/artwork-command';
	import { artworkPlacement } from '$lib/authoring/artwork/artwork-placement';
	import { readVerifiedArtwork, verifyArtworkDecode } from '$lib/authoring/artwork/project-artwork';
	import { createArtworkScope, type ArtworkBytes } from '$lib/render/artwork/artwork-scope';
	import { Vector3 } from 'three';
	import { createLookAuthoring } from '$lib/authoring/look/look-authoring.svelte';
import { worldTool, type WorldToolId } from '$lib/authoring/world-toolbar/registry';
import StageHeightSheet from '$lib/authoring/stage/shell/StageHeightSheet.svelte';
import StageScaleBar from '$lib/authoring/stage/shell/StageScaleBar.svelte';
import type { StageHeightTick } from '$lib/authoring/stage/stage-height-sheet';
	import StageInstrumentHost from '$lib/authoring/stage/shell/StageInstrumentHost.svelte';
	import { createScenePickSource } from '$lib/authoring/scene/scene-pick-source';
	const scenePick = createScenePickSource();
	import StageCanvas from '$lib/authoring/stage/shell/StageCanvas.svelte';
	import { isPaperPlanVisible, PAPER_TONES } from '$lib/authoring/stage/paper-plan';
	import {
		approvedModelPins,
		resolveApprovedModels,
		type ApprovedModelSources
	} from '$lib/authoring/scene/model-bytes';
	import StageOverlay from '$lib/authoring/stage/shell/StageOverlay.svelte';
	import ExperienceHomesHost from '$lib/authoring/experience/ExperienceHomesHost.svelte';
	import ExperienceDock from '$lib/authoring/experience/ExperienceDock.svelte';
	import ExperienceMarks from '$lib/authoring/experience/ExperienceMarks.svelte';
	import { WORLD_ENVIRONMENT_GROUND_RADIUS_METERS } from '$lib/render/world-environment';
	import { EYE_HEIGHT_STEPS, LENS_STEPS } from '$lib/authoring/experience/look-through';
	import { angleDelta, frameView, moveViewOnFloor, planLensFromDrag, snapViewDrag, turnViewAboutEye, viewEditMoved, viewTilt, yawFromEye, type AdvancedViewFraming, type AuthoredViewPose, type ViewEditKind } from '$lib/authoring/experience/experience-view-edit';
	import { CAMERA_FRUSTUM_FAR_METRES, CAMERA_LENS_OFFSET_METRES } from '$lib/authoring/experience/experience-marks';
	import { createEditorCameraFramingBasis, createEditorCameraFovDragBasis, evaluateEditorCameraFovDrag } from '$lib/authoring/camera/editor-camera-framing';
	import { axisTravelFromRay } from '$lib/authoring/stage/stage-axis-travel';
	import ExperienceGuide from '$lib/authoring/experience/ExperienceGuide.svelte';
	import ExperiencePresentationWriter from '$lib/authoring/experience/ExperiencePresentationWriter.svelte';
	import ExperienceViewWriter from '$lib/authoring/experience/ExperienceViewWriter.svelte';
	import ExperienceStopWriter from '$lib/authoring/experience/ExperienceStopWriter.svelte';
	import ExperienceTransitionWriter from '$lib/authoring/experience/ExperienceTransitionWriter.svelte';
	import ExperienceExperienceWriter from '$lib/authoring/experience/ExperienceExperienceWriter.svelte';
	import ExperienceSubjectWriter from '$lib/authoring/experience/ExperienceSubjectWriter.svelte';
	import { provideExperienceHomes } from '$lib/authoring/experience/experience-homes';
	import type { ExperienceSubject } from '$lib/authoring/experience/experience-model';
	import {
		experienceCardModel,
		presentationCardModel,
		stopCardModel,
		subjectCardModel,
		transitionCardModel,
		viewCardModel
	} from '$lib/authoring/experience/experience-card-model';
	import { NAME_NEEDED, type ExperienceController } from '$lib/authoring/experience/experience-controller.svelte';
	import type { ExperienceRemovalTarget } from '$lib/authoring/experience/experience-removal';
	import type { ComponentProps } from 'svelte';
	import type { ExperienceIndexGroups } from '$lib/authoring/stage/shell/experience-index-groups';
	import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
	import {
		experienceProblems,
		loweringProblem,
		type ExperienceProblem
	} from '$lib/authoring/experience/experience-problems';
	import { previewEntryFor, type EnterablePreviewEntry } from '$lib/authoring/experience/preview-entry';
	import { createExperienceLens } from '$lib/authoring/experience/experience-lens.svelte';
	import type { StagePostureLayer } from '$lib/authoring/stage/stage-adapter-host';
import { createExperiencePreview } from '$lib/authoring/experience/experience-preview.svelte';
import { experienceIndexFor } from '$lib/authoring/experience/experience-index';
import { removalItem, backOf, experienceNameWriter, experienceShownCardFor } from '$lib/authoring/experience/experience-card-wiring';
import { rememberWelcomeDismissed, welcomeDismissed } from '$lib/authoring/experience/experience-welcome';
import { guideTimeMapForProgram } from '$lib/authoring/experience/playback-map';
	import {
		enterPreview,
		nextPreviewRunEpoch,
		previewReturnToken,
		returnPreview
	} from '$lib/authoring/experience/preview-handover';
	import { isAllowedShippedTextureUri } from '$lib/visitor/shipped-static-registry';
import {
	SCALE_DETENTS,
	STAGE_DRAFTING_DEFAULTS,
	applyDraftingPatch,
	draftingSnapIncrementMeters,
	gridWord as draftingWordForGrid,
	roundScaleBarLength,
	scaleDetentIntent,
	snapWord as draftingWordForSnap,
	type StageDraftingPatch,
	type StageDraftingState
} from '$lib/authoring/stage/stage-drafting';
import type { GridRect } from '$lib/authoring/stage/stage-grid';

	// Harness-gated work ledger (T1.P02.S06); inert without the perf flag.
	installPerfWorkObserver();

	const projectId = decodeURIComponent(page.params.projectId ?? '');
	const intent: BootIntent = bootIntentFromSearch(page.url.searchParams);

	const api: ProjectApi | null = createProjectApi({ apiOrigin: env.PUBLIC_API_ORIGIN });
	const auth = env.PUBLIC_API_ORIGIN ? createProjectAuth(env.PUBLIC_API_ORIGIN) : null;
	const session = createStageSession({ sessionEpoch: 'session:route-boot' });

	const projectSession = createProjectSession({
		projectId, intent, api, auth, session,
		url: () => page.url,
		acceptance: () => acceptance,
		tornDown: () => tornDown,
		activate,
		get notice() { return notice; },
		set notice(value) { notice = value; }
	});
	const boot = $derived(projectSession.boot);
	const headSave = $derived(projectSession.headSave);
	const resumeOffer = $derived(projectSession.resumeOffer);
	const pendingReplacement = $derived(projectSession.pendingReplacement);
	const projectActionBusy = $derived(projectSession.projectActionBusy);
	const { activeProject, requestReplacement, runReplacement, resumePendingSave, dismissResumeOffer,
		prepareProjectLifecycle, renameCurrentProject, deleteCurrentProject, finishCurrentProjectAction,
		reloadLifecycleRemote, applyReloadOffer } = projectSession;
	/**
	 * Validator findings of the mounted source, disclosed without being repaired.
	 * `closure` is executable and blocks Save; `diagnostics` are repairable
	 * authored bindings and stay visible without blocking inspection or edits.
	 */
	const sourceFindings = $derived.by(() => {
		if (boot.status !== 'ready' && boot.status !== 'empty') return null;
		const { diagnostics, closure } = boot.snapshot.domain;
		return diagnostics.length === 0 && closure.length === 0 ? null : { diagnostics, closure };
	});
	/** Plain-language source problems; one validator pass feeds every sentence. */
	const sourceProblems = $derived.by(() => {
		if (boot.status !== 'ready' && boot.status !== 'empty') return [] as readonly ExperienceProblem[];
		return experienceProblems(stageEnvelope(boot.snapshot), boot.snapshot.domain.diagnostics);
	});
	/** The last Preview lowering refusal, worded like a source problem. */
	let previewProblem = $state<ExperienceProblem | null>(null);
	let facade = $state.raw<StageFacade | null>(null);
	/**
	 * The host↔F4 acceptance host for the current project epoch. There is exactly
	 * one per epoch, recreated by `activate` on every replacement; it is the only
	 * acceptance writer, and the Head's history controls are its commands.
	 */
	let acceptance = $state.raw<StageAcceptanceHost | null>(null);
	/**
	 * Bumped whenever the mounted facade's adapter registrations or bindings change.
	 * The contribution views below read a `$state.raw` facade whose adapter map is
	 * plain data, so this signal is what makes a registration after mount reach the
	 * Index, the Card and the instrument host.
	 */
	let contributionsVersion = $state(0);
	let unsubscribeContributions: (() => void) | null = null;
	let unsubscribeAcceptance: (() => void) | null = null;
	let contributedTaskId = $state<{ id: string; adapterId: string } | null>(null);

	let historyState = $state<StageHistoryState>({
		canUndo: false,
		canRedo: false,
		depth: 1,
		position: 0,
		undoUnavailableReason: 'Nothing to undo yet — no change has been accepted.',
		redoUnavailableReason: 'Nothing to redo.'
	});
	let selection = $state<StageSelectionEntry | null>(null);
	/** A one-shot Stage pick for linking a Presentation; Esc cancels it. */
	let stagePickPresentationId = $state<string | null>(null);
	/** The hovered subject's echoed entry; never the primary selection. */
	let hoverSelection = $state<StageSelectionEntry | null>(null);
	/** R217.S15 — whether the pointer is over a draggable selected Wall body or grip. */
	let hoverMove = $state(false);
	let task = $state<StageTask | null>(null);
	/** Instrument content contributed by the adapter whose task is open, if any. */
	const contributedInstrument = $derived.by((): StageInstrumentContent | null => {
		void contributionsVersion;
		return contributedTaskId === null ? null : (facade?.instrumentForTask(contributedTaskId.id, contributedTaskId.adapterId) ?? null);
	});
	const inactiveTask = $derived.by(() => {
		void contributionsVersion;
		const lifecycle = facade?.session.taskLifecycle();
		if (lifecycle?.status !== 'inactive') return null;
		// Only where it can actually be resumed: a world task in the Experience lens
		// refuses Resume, so showing its panel there would stack two controls that
		// cannot act on each other.
		return (lifecycle.task.lens ?? 'world') === lens ? lifecycle.task : null;
	});
	function changeLens(next: 'world' | 'experience'): void {
		// A lens switch invalidates any Present-this framing run still waiting.
		stagePickPresentationId = null;

		const previous = lens;
		// Preview returns to the lens it was entered from; a lens switch ends it.
		previewController.close();
		clearHover();
		interruptPress('lens-change');
		// A notice describes the previous context; the lens is the new one.
		notice = '';
		if (facade?.changeLens(next)) {
			lens = session.lens();
			// Leaving the lens ends its transient posture; a refused switch keeps it.
			if (previous === 'experience' && lens !== 'experience') experienceLens.deactivate();
			task = null;
			contributionsVersion += 1;
			// R217.S25: the Guide instrument is closed by default, so every entry starts closed. A Card
			// subject left from the last visit is cleared too, or its Guide-type subject would reopen it.
			if (lens === 'experience') {
				experienceGuideOpen = false;
				experienceFocus.select(null);
				// With no Experience there is no Card for a carried-over World selection, so it goes too.
				if (experienceController?.current == null && selection !== null) closeSelection();
			}
		}
		// Arming the Experience dock's Guide key is not a mode: the lens owns it.
	}
	function resumeTask(): void {
		const result = facade?.resumeTask();
		if (result?.kind === 'refused') notice = result.message;
		else { task = session.task(); notice = ''; }
		contributionsVersion += 1;
	}
	/**
	 * R217.S20 — the viewing preferences the Head's Find reaches. The Stage's ⚙ holds
	 * the same values; Find is the second door, and both write the one preference.
	 */
	const HEAD_PREFERENCE_ENTRIES: readonly { id: string; adapterId: string; label: string; verb: string;
	}[] = [
		{ id: 'appearance:paper', adapterId: 'preference', label: '2D appearance: Paper', verb: 'Set' },
		{ id: 'appearance:shaded', adapterId: 'preference', label: '2D appearance: Shaded', verb: 'Set' },
		{ id: 'height-sheet:right', adapterId: 'preference', label: 'Height Sheet: Right', verb: 'Set' },
		{ id: 'height-sheet:left', adapterId: 'preference', label: 'Height Sheet: Left', verb: 'Set' },
		{ id: 'reduce-motion', adapterId: 'preference', label: 'Reduce motion', verb: 'Toggle' },
		{ id: 'motion-speed:slow', adapterId: 'preference', label: 'Motion speed: Slow', verb: 'Set' },
		{ id: 'motion-speed:normal', adapterId: 'preference', label: 'Motion speed: Normal', verb: 'Set' },
		{ id: 'motion-speed:fast', adapterId: 'preference', label: 'Motion speed: Fast', verb: 'Set' }
	];
	/**
	 * R217.S20 — the project procedures under the project name. Rename and delete run
	 * in the Head's own lifecycle dialog; download and source replacement run the
	 * same route functions the project menu runs.
	 */
	const HEAD_PROJECT_ENTRIES: readonly { id: string; adapterId: string; label: string; verb: string;
	}[] = [
		{ id: 'rename', adapterId: 'project-menu', label: 'Rename project', verb: 'Run' },
		{ id: 'delete', adapterId: 'project-menu', label: 'Delete project', verb: 'Run' },
		{ id: 'download', adapterId: 'project-menu', label: 'Download source JSON', verb: 'Run' },
		{ id: 'source', adapterId: 'project-menu', label: 'Open source JSON', verb: 'Replace' }
	];
	/** Whether the Keys reference is open; it lives in Find and closes with its own control. */
	let keysOpen = $state(false);
	/** Moves focus into an opened reference, so a keyboard user lands in what Find opened. */
	function focusOnOpen(node: HTMLElement): void {
		node.focus();
	}
	let revealed = $state<string[]>([]);
	let lens = $state<'world' | 'experience'>('world');
	/**
	 * R217.S23 — below 1280 px the Index starts collapsed. The starting state is read once
	 * here, as session state the creator then changes: it is not a CSS-only hide, so a
	 * later Index toggle is never undone by a re-render at the same width.
	 */
	const constrainedAtStart =
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(max-width: 860px)').matches;
	let indexOpen = $state(!constrainedAtStart);
	let query = $state('');
	let reducedMotion = $state(false);
	let preferences = $state<AppPreferences>({ ...DEFAULT_APP_PREFERENCES });
	const motionClock = createEditorMotionClock();
	function updatePreferences(next: AppPreferences): void {
		const real = performance.now() / 1000;
		motionClock.setSpeed(next.motionSpeed, real);
		preferences = next;
		writeAppPreferences(next);
	}
	const previewController = createExperiencePreview({
		lens: () => lens,
		snapshot: () => (boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot : null),
		token: () => session.token(),
		isCurrent: (token) => session.isCurrent(token as never),
		envelope: () => currentEnvelope,
		envelopeOf: (snapshot) => stageEnvelope(snapshot as Parameters<typeof stageEnvelope>[0]),
		focus: () => experienceFocus.read(),
		setProblem: (problem) => { previewProblem = problem as ExperienceProblem | null; },
		stage: () => facade,
		stopAndRestore: () => experienceLens.stopAndRestore(),
		snapSuspended: () => drafting.snapSuspended,
		patchDrafting: (patch) => patchDrafting(patch),
		notice: (message) => { notice = message; },
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
	type PlaybackView = {
		readonly eye: [number, number, number];
		readonly target: [number, number, number];
		readonly fov: number;
	};
	/** The adapter services the Stage and the Experience homes edit through. */
	let adapterServices = $state.raw<StageAdapterServices | null>(null);
	/**
	 * R217.S25 — the Experience controller the shared homes read. ExperienceHomesHost creates it
	 * while the Experience lens is open and binds it here; it is null in World.
	 */
	let experienceController = $state.raw<ExperienceController | null>(null);
	/** Whether the Guide instrument is open in the lower edge. Closed by default. */
	let experienceGuideOpen = $state(false);
	/** The controller the homes read; null outside the Experience lens. */
	const activeExperience = $derived(lens === 'experience' ? experienceController : null);
	/** The World toolbar's selected row; the task/selection controllers remain authoritative. */
	let activeWorldTool = $state<WorldToolId>('select');
	/** The upper parchment plate: opens on a family press and folds on a second one. */
	let worldPlateOpen = $state(false);
	let libraryOpen = $state(false);
	let toolBeforeLibrary = $state<WorldToolId>('select');
	let inkReading = $state<'wall' | 'opening'>('wall');

	// A completed task leaves no plate behind. A library visit is its own mode and
	// Select is already the empty state, so those two keep their word.
	$effect(() => {
		if (task === null) {
			if (activeWorldTool === 'library' || activeWorldTool === 'select') return;
			// A planned row is inspectable without a task; only a landed tool that has
			// just completed belongs back at Select.
			if (worldTool(activeWorldTool).stage === 'planned') return;
			activeWorldTool = 'select';
			worldPlateOpen = false;
			return;
		}
		if (task.kind === STAGE_MEASURE_TASK) activeWorldTool = 'measure';
		else if (task.kind === STAGE_ERASER_TASK) activeWorldTool = 'erase';
	});

	/** R217.S29 Show ▾ — session-only Stage drawing flags; all on by default. */
	let showOpen = $state(false);
	let showMode = $state<'whole' | 'selection'>('whole');
	let showMarkers = $state(true);
	let showFrustums = $state(true);
	let showPaths = $state(true);
	let showLabels = $state(true);
	const showOffCount = $derived([showMarkers, showFrustums, showPaths, showLabels].filter((on) => !on).length);
	/** The Presentation whose Views the Index shows: one at a time, following the selection. */
	let expandedPresentationId = $state<string | null>(null);
	/** The Scene entity the Card shows in the Experience lens: the Stage's primary Scene selection. */
	const experienceSceneSubject = $derived.by(() => {
		const selected = selection;
		if (selected === null || selected.reference.domain !== 'scene' || selected.reference.subject.kind !== 'entity') {
			return null;
		}
		return { entityId: selected.reference.subject.id, label: cardIdentity?.label ?? 'Object' };
	});
	/* --- R217.S28 — Place a View, Look through and Present this --------------- */

	type StageTriple = [number, number, number];

	/** Place a View is an armed Stage tool; Look through is a provisional posture. */
	let experienceTool = $state<'select' | 'place'>('select');
	/** Scroll in Look through accumulates until one 0.25 m step is owed. */
	let showExperienceWelcome = $state(false);

	/** The capture frame's measured local viewport for the one Stage renderer. */
	let throughViewport = $state<{ readonly left: number; readonly top: number; readonly width: number; readonly height: number } | null>(null);
	let throughFrameEl = $state<HTMLElement | null>(null);
	/** Monotone guard: only the newest Present-this run may capture framing. */


	/* --- R217.S30 — the Experience lens owns playback and its Follow entry ---- */

	const experienceLens = createExperienceLens({
		activeController: () => activeExperience,
		stage: () => facade,
		lens: () => lens,
		guideOpen: () => experienceGuideOpen,
		setGuideOpen: (open) => { experienceGuideOpen = open; },
		clearStageSelection: () => {
			stagePickPresentationId = null;
			facade?.select(null);
			selection = null;
		},
		openCard: () => { cardOpen = true; },
		pickActive: () => stagePickPresentationId !== null,
		cancelPick: () => {
			stagePickPresentationId = null;
			notice = 'Pick cancelled.';
		},
		dismiss: () => {
			if (experienceFocus.subject !== null) { experienceFocus.select(null); return true; }
			if (selection !== null) { closeSelection(); return true; }
			if (experienceGuideOpen) { experienceGuideOpen = false; return true; }
			return false;
		},
		reducedMotion: () => reducedMotion,
		previewOpen: () => previewController.openState,
		previewBusy: () => previewController.busy,
		previewRequested: () => previewController.requestedMode !== null,
		pathAnchorPoint: (css, height) => pathAnchorPoint(css, height),
		stageCss: (event) => stageCss(event),
		showMarkers: () => showMarkers,
		showFrustums: () => showFrustums,
		gestureActive: () => session.gesture() !== null,
		refusePress: (pointerId) => press.refuse(pointerId),
		clearHover: () => clearHover(),
		evaluationGeneration: () => evaluation?.token.evaluationGeneration ?? 0,
		tool: () => experienceTool,
		setTool: (next) => { experienceTool = next; },
		absoluteCss: (event) => absoluteCss(event),
		stageElement: () => stageEl,
		capturePointer: (target, pointerId) => capturePointer(target, pointerId),
		floorDatum: () => experienceFloorDatum,
		evaluation: () => evaluation,
		refresh: () => refresh(),
		renameRequest: () => { cardOpen = true; cardRenameRequest += 1; },
		notice: (message) => { notice = message; }
	});
	/** The one active posture; World dispatches to adapters and navigation directly. */
	const activeLayer = $derived<StagePostureLayer | null>(lens === 'experience' ? experienceLens.posture : null);
	/** The lens's one playback session, read by the Guide instrument. */
	const playback = experienceLens.playback;
	experienceLens.install();

	const advancedCamera = $derived(experienceLens.advancedCamera());
	const advancedViewId = $derived(experienceLens.advancedViewId());
	const viewEdit = $derived(experienceLens.viewEdit());
	const pendingViewWrite = $derived(experienceLens.pendingViewWrite());

	const experienceFloorDatum = $derived.by(() =>
		boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.datumMeters : 0
	);

	/** One path anchor drag point, through the same Camera ray and a level plane at its height. */
	let pathDragLease: { release(): void } | null = null;
	function beginPathDragLease(): boolean {
		const stage = facade;
		const id = stage?.evaluationId() ?? null;
		if (stage === null || id === null || pathDragLease !== null) return false;
		const outcome = stage.acquireGesture({
			owner: 'experience-path-point',
			evaluationId: id,
			policy: 'cancel-on-reading-change'
		});
		if (outcome.kind !== 'granted') return false;
		pathDragLease = outcome.lease;
		return true;
	}
	function endPathDragLease(): void {
		pathDragLease?.release();
		pathDragLease = null;
	}

	function pathAnchorPoint(css: readonly [number, number], height: number): StageTriple | null {
		const stage = facade;
		const id = stage?.evaluationId() ?? null;
		if (stage === null || id === null) return null;
		const ray = stage.pointerRay([css[0], css[1]], id);
		if (ray.kind !== 'ray') return null;
		const hit = stage.intersectWorkingPlane(
			ray.ray,
			{
				originMeters: [0, height, 0],
				normal: [0, 1, 0],
				yawRadians: 0,
				datumMeters: experienceFloorDatum,
				supportedLocalExtent: null
			},
			id
		);
		return hit.kind === 'intersected' ? hit.worldPoint : null;
	}

	function viewMarkAt(event: MouseEvent) {
		const target = event.target;
		if (!(target instanceof Element)) return null;
		const mark = target.closest('[data-view-mark]');
		const viewId = mark?.getAttribute('data-view-mark') ?? null;
		const kind = target.closest('[data-turn-grip]') !== null ? 'turn' : mark?.getAttribute('data-mark-kind') ?? null;
		return viewId === null || kind === null || mark === null ? null : { viewId, kind, mark };
	}

	const viewEditPreview = $derived.by(() => {
		const stage = facade;
		const id = stage?.evaluationId() ?? null;
		const edit = viewEdit;
		const origin = rect;
		if (stage === null || id === null || edit === null || origin === null) return null;
		const local = (point: readonly [number, number]): [number, number] => [point[0] - origin.left, point[1] - origin.top];
		const eye = stage.projectWorld(edit.eye, id);
		if (eye.kind !== 'projected') return null;
		const target = stage.projectWorld(edit.target, id);
		const eyeCss = local(eye.css);
		const targetCss = target.kind === 'projected' ? local(target.css) : null;
		// Turn (G1): a ghost wedge along the new direction, an arc from the start
		// direction and the angle; never a line that stretches with the pointer.
		let turn: { readonly wedge: string; readonly arc: string; readonly label: string; readonly labelAt: readonly [number, number] } | null = null;
		if (edit.kind === 'turn' && targetCss !== null) {
			const start = stage.projectWorld(edit.start.target, id);
			if (start.kind === 'projected') {
				const startCss = local(start.css);
				const a0 = Math.atan2(startCss[1] - eyeCss[1], startCss[0] - eyeCss[0]);
				const a1 = Math.atan2(targetCss[1] - eyeCss[1], targetCss[0] - eyeCss[0]);
				let delta = a1 - a0;
				while (delta > Math.PI) delta -= 2 * Math.PI;
				while (delta < -Math.PI) delta += 2 * Math.PI;
				const half = (Math.max(10, Math.min(110, edit.start.fov)) * Math.PI) / 360;
				const at = (angle: number, radius: number): string =>
					`${(eyeCss[0] + Math.cos(angle) * radius).toFixed(1)},${(eyeCss[1] + Math.sin(angle) * radius).toFixed(1)}`;
				const length = 90;
				const arcRadius = 46;
				const startYaw = yawFromEye(edit.start, edit.start.target);
				const turnedYaw = yawFromEye(edit.start, edit.target);
				const yawChange = startYaw === null || turnedYaw === null ? 0 : turnedYaw - startYaw;
				const degrees = Math.round(Math.abs(Math.atan2(Math.sin(yawChange), Math.cos(yawChange))) * 180 / Math.PI);
				turn = {
					wedge: `M${eyeCss[0]},${eyeCss[1]}L${at(a1 - half, length)}A${length},${length} 0 0 1 ${at(a1 + half, length)}Z`,
					arc: `M${at(a0, arcRadius)}A${arcRadius},${arcRadius} 0 0 ${delta > 0 ? 1 : 0} ${at(a1, arcRadius)}`,
					label: `${degrees}°`,
					labelAt: [eyeCss[0] + Math.cos(a0 + delta / 2) * (arcRadius + 16), eyeCss[1] + Math.sin(a0 + delta / 2) * (arcRadius + 16)]
				};
			}
		}
		return {
			kind: edit.kind,
			eye: eyeCss,
			target: targetCss,
			turn
		};
	});

	provideExperienceHomes(experienceLens.homes({
		controller: () => (lens === 'experience' ? experienceController : null),
		guideOpen: () => experienceGuideOpen,
		setGuideOpen: (open) => {
			experienceGuideOpen = open;
		},
		select: experienceLens.selectSubject,
		sceneSubject: () => experienceSceneSubject,
		openInWorld: () => changeLens('world'),
		pickStageSubject: (presentationId) => {
			if (lens !== 'experience') return false;
			stagePickPresentationId = presentationId;
			notice = 'Pick a Stage object to link. Esc cancels.';
			return true;
		},
		previewMode: (mode, guideId) => void previewController.open(mode, guideId),
		guideForStop: (stopId) => experienceController?.guideForStop(stopId) ?? null
	}));
	// The controller can set a subject itself (a Capture, an added Stop); the Stage selection it
	// replaces must not linger beside it.
	$effect(() => {
		if (activeExperience?.subject == null) return;
		untrack(() => {
			if (selection === null) return;
			facade?.select(null);
			selection = null;
		});
	});
	// A subject whose ids no longer resolve (an undo, a redo or a removed Presentation) would leave the
	// Card blank: clear it, so the Card falls back to the Stage selection or to nothing.
	$effect(() => {
		const controller = activeExperience;
		const subject = controller?.subject ?? null;
		if (controller === null || subject === null) return;
		const resolves =
			subject.kind === 'experience'
				? controller.current !== null
				: subject.kind === 'view'
					? controller.selectedView !== null
					: subject.kind === 'stop' || subject.kind === 'transition'
						? controller.selectedStop !== null
						: controller.selectedPresentation !== null;
		if (!resolves) untrack(() => experienceFocus.select(null));
	});
	// A Stop or transition belongs to the Guide, so its instrument opens. A Presentation, View,
	// Experience or Stage subject never closes it. Lens entry clears the subject, so this does not
	// fight the closed-on-entry rule in changeLens.
	$effect(() => {
		const kind = activeExperience?.subject?.kind;
		if (kind !== 'stop' && kind !== 'transition') return;
		untrack(() => experienceLens.openGuide());
	});
	// The Index opens the selected Presentation's Views. Only its id drives the effect, so a new object
	// for the same Presentation (a rename, a capture) cannot re-expand a row the user collapsed.
	const selectedPresentationId = $derived(activeExperience?.selectedPresentation?.id ?? null);
	$effect(() => {
		if (selectedPresentationId !== null) expandedPresentationId = selectedPresentationId;
	});
	const currentEnvelope = $derived.by((): ProjectEnvelope | null =>
		boot.status === 'ready' || boot.status === 'empty' ? stageEnvelope(boot.snapshot) : null
	);
	let evaluation = $state<ViewportEvaluation | null>(null);
	/**
	 * C3/D14 — the single executor for unfold camera requests.
	 *
	 * Entry no longer fits or otherwise moves the Camera, so the only request is
	 * the conditional Put-back return. It is refused unless the entry performed a
	 * fit (legacy state only) and the settled pose still matches the current one.
	 * Scrub, peel and face changes never move the Camera; Bring into view is the
	 * explicit framing action.
	 */
	$effect(() => {
		wallUnfold.setCameraExecutor((request) => {
			const stage = facade;
			const current = stage?.evaluation() ?? null;
			if (stage === null || current === null) return false;
			const ticket = stage.inspectionTicket();
			if (ticket === null) return false;
			const camera = stage.camera.state();
			if (
				!wallUnfoldShouldReturn({
					entryAdjusted: request.entryAdjusted,
					settled: request.settled,
					current: { pose: camera.pose, reading: camera.reading }
				})
			) return false;
			return (
				stage.requestViewingIntent(
					{
						kind: 'set-view',
						eye: eyeOfInspectionPose(request.pose),
						target: request.pose.target,
						fovYDegrees: fovYDegreesOf(request.pose),
						transition: true
					},
					ticket,
					performance.now() / 1000
				).kind === 'accepted'
			);
		});
		return () => wallUnfold.setCameraExecutor(null);
	});
	/**
	 * R217.S05's one Grid/Snap view state. It is host view state, mirrored from the
	 * session so the furniture re-renders; it is never part of the project source,
	 * history or Save, and a replacement keeps it.
	 */
	let drafting = $state<StageDraftingState>(STAGE_DRAFTING_DEFAULTS);
	/** Re-evaluates content bounds when a lazy model or form root mounts. */
	let renderRootsRevision = $state(0);
	$effect(() => scenePick.onRenderRootsChanged(() => (renderRootsRevision += 1)));
	/**
	 * R217.S06's one Height Sheet fact, mirrored from the session so the control,
	 * the Canvas plane and the mounted chrome all read the same height. It is
	 * session view state: a replacement resets it, and nothing here is saved.
	 */
	const heightSheet = session.heightSheet();
	let heightMeters = $state(heightSheet.height());
	let heightTicks = $state<readonly StageHeightTick[]>([]);
	let heightPins = $state<readonly number[]>([]);
	let heightSheetSide = $state<'left' | 'right'>('right');
	let heightPlaneVisible = $state(false);
	let heightPlaneTimer: ReturnType<typeof setTimeout> | null = null;
	$effect(() => {
		heightMeters = heightSheet.height();
		heightPins = heightSheet.pins();
		const unsubscribeHeight = heightSheet.subscribe('route-height-sheet', (height) => {
			heightMeters = height;
		});
		const unsubscribePins = heightSheet.subscribePins('route-height-sheet-pins', (pins) => {
			heightPins = pins;
		});
		return () => {
			unsubscribeHeight();
			unsubscribePins();
		};
	});
	$effect(() => {
		// A binding rebuild can add or remove owner surfaces, and a viewport output
		// is needed before the binding exists; read the merged set for both.
		evaluation;
		contributionsVersion;
		const stage = facade;
		heightTicks = stage === null ? [] : stage.heightTicks();
	});
	$effect(() => () => {
		if (heightPlaneTimer !== null) clearTimeout(heightPlaneTimer);
	});
	function setHeight(heightMetersValue: number, cause: 'drag' | 'key' | 'tick'): void {
		heightSheet.set(heightMetersValue, cause);
		heightMeters = heightSheet.height();
	}
	/** Session-only pin creation; pin removal is intentionally unexposed. */
	function addHeightPin(): void {
		heightSheet.addPin(heightMeters);
		heightPins = heightSheet.pins();
	}
	function setHeightPlaneActive(active: boolean): void {
		if (heightPlaneTimer !== null) {
			clearTimeout(heightPlaneTimer);
			heightPlaneTimer = null;
		}
		// The Sheet is World-lens chrome. Its teardown on a lens switch is not a
		// pointer release: do not leave a tail running behind the Experience lens.
		if (lens !== 'world') {
			heightPlaneVisible = false;
			return;
		}
		if (active) {
			heightPlaneVisible = true;
			return;
		}
		if (reducedMotion) {
			heightPlaneVisible = false;
			return;
		}
		heightPlaneTimer = setTimeout(() => {
			heightPlaneVisible = false;
			heightPlaneTimer = null;
		}, 1000);
	}
	$effect(() => {
		// A lens switch can happen after the Sheet already went inactive (for
		// example focus moved to the lens button first), so cancel any live tail
		// on the lens change itself rather than relying on the unmount callback.
		if (lens === 'world') return;
		if (heightPlaneTimer !== null) {
			clearTimeout(heightPlaneTimer);
			heightPlaneTimer = null;
		}
		heightPlaneVisible = false;
	});
	const draftingReading: 'plan' | '3d' = $derived(
		evaluation?.settledReading === 'plan' ? 'plan' : '3d'
	);
	const draftingGridWord = $derived(draftingWordForGrid(drafting));
	const draftingSnapWord = $derived(draftingWordForSnap(drafting));
	/** Arrow-key stepping follows the fixed increment, or 0.1 m while Snap is off. */
	const heightSnapIncrement = $derived(
		draftingSnapIncrementMeters(drafting) ?? 0.1
	);
	const draftingScaleBar = $derived(
		roundScaleBarLength(evaluation?.targetPlaneMetersPerCssPixel ?? 0)
	);
	/**
	 * Layout ∪ Scene datum bounds, the one read Fit and Paper's sheet share.
	 *
	 * A free Scene object outside the drawing is still on the Stage, so the sheet
	 * and Fit must see it. The bounds contain no Camera state: they never move a
	 * pose or ask the Camera to reframe.
	 */
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
			min =
				min === null
					? [bounds.min[0], bounds.min[1], bounds.min[2]]
					: [Math.min(min[0], bounds.min[0]), Math.min(min[1], bounds.min[1]), Math.min(min[2], bounds.min[2])];
			max =
				max === null
					? [bounds.max[0], bounds.max[1], bounds.max[2]]
					: [Math.max(max[0], bounds.max[0]), Math.max(max[1], bounds.max[1]), Math.max(max[2], bounds.max[2])];
		}
		return min === null || max === null ? null : { min, max };
	}
	const stageContentBounds = $derived.by(() => {
		void renderRootsRevision;
		if (boot.status !== 'ready' && boot.status !== 'empty') return null;
		const stage = facade;
		return stage === null ? null : readStageContentBounds(stage);
	});
	const paperContentBounds = $derived.by((): GridRect | null => {
		const bounds = stageContentBounds;
		return bounds === null
			? null
			: { minX: bounds.min[0], maxX: bounds.max[0], minZ: bounds.min[2], maxZ: bounds.max[2] };
	});
	$effect(() => facade?.camera.setContentBounds(stageContentBounds));
	// Generated Plan evaluations are replaced whole; raw data keeps their references
	// cloneable when Index selection crosses the immutable selection boundary.
	let planView = $state.raw<PlanEvaluation | null>(null);
	// The chrome's own paper/material cue follows the same truth as the Canvas: a
	// settled Plan in the Paper appearance. It is a CSS inset perimeter only, never a
	// second drawing surface or a pointer target.
	const paperVisible = $derived(isPaperPlanVisible(evaluation, preferences.planAppearance));
	let rect = $state<ViewportRect | null>(null);
	let markers = $state<readonly StageOverlayContribution[]>([]);
	let candidatePreviews = $state.raw<readonly StageCandidatePreviewView[]>([]);
	let ghosts = $state<readonly StageGhostMesh[]>([]);
	/**
	 * Approved creator-model bytes for the accepted source, keyed by model resource
	 * id. They are resolved from the resource pins — never from an import
	 * session — so a fresh reopen fetches the same immutable derivative, and the
	 * Preview surface receives plain URLs without learning how they were
	 * authorised.
	 */
	let modelUrls = $state<ReadonlyMap<string, string>>(new Map());
	let modelResolution: { dispose(): void } | null = null;
	/** Monotone ticket: only the newest resolution may install its URLs. */
	let modelGeneration = 0;
	/** The pin set of the newest request, installed or in flight; an unchanged set is reused. */
	let modelPinSignature = '';
	/** The pin set the installed URLs were resolved for. */
	let installedModelSignature = '';
	/** The model-failure notice this resolver last set, so an unrelated notice survives. */
	let modelNotice: string | null = null;
	let roomLabels = $state<readonly RoomLabelView[]>([]);
	let marks = $state<readonly StageMarkView[]>([]);
	let stageCursor = $state<string | null>(null);
	let notice = $state('');
	/**
	 * T2 P0 — the route's one Look authoring module. The Sky popover, the Card's
	 * look stratum, the Stage's Look mark layer and the Library's Look shelf all
	 * consume this one construction; later T2 slices fill the strata without
	 * growing a second route writer.
	 */
	const canPlaceArtwork = () => lens === 'world' && preview === null && wallUnfold.state === null;
	const artwork = createArtworkAuthoring({
		api,
		services: () => adapterServices,
		canEdit: canPlaceArtwork,
		isSaved: () => headSave?.snapshot().savedBaseToken != null,
		notice: (message) => { notice = message; },
		select: (services, id) => selectStageReference(artworkReference(services, id))
	});
	const stageArtworkScope = createArtworkScope(async (image, signal) => {
		if (api === null) throw new Error('Artwork storage is unavailable.');
		return readVerifiedArtwork(api, projectId, image, signal);
	});
	$effect(() => () => { artwork.cancel(); stageArtworkScope.dispose(); });
	$effect(() => {
		if (boot.status !== 'ready' && boot.status !== 'empty') artwork.cancel();
		if (!canPlaceArtwork()) {
			artwork.cancel();
			cancelArtworkResize();
		}
	});

	let artworkResize = $state.raw<{
		entity: SceneArtworkEntity; mode: ArtworkCorner | 'move' | 'turn'; pointerId: number;
		startX: number; startPoint: Vector3 | null;
		lease: Extract<ReturnType<StageFacade['acquireGesture']>, { kind: 'granted' }>['lease'];
	} | null>(null);
	let artworkResizeGhost = $state.raw<SceneArtworkEntity | null>(null);
	function cancelArtworkResize(): void {
		artworkResize?.lease.release();
		artworkResize = null;
		artworkResizeGhost = null;
	}
	function startArtworkResize(event: PointerEvent, mode: ArtworkCorner | 'move' | 'turn'): void {
		const stage = facade;
		const entity = selectedArtwork;
		const evaluationId = stage?.evaluationId();
		if (event.button !== 0 || stage === null || !entity || !evaluationId || stageEl == null) return;
		event.preventDefault();
		event.stopPropagation();
		const acquired = stage.acquireGesture({ owner: 'artwork-resize', evaluationId, policy: 'cancel-on-reading-change' });
		if (acquired.kind !== 'granted') return;
		if (!capturePointer(stageEl, event.pointerId)) { acquired.lease.release(); return; }
		press.refuse(event.pointerId);
		const ray = evaluation === null ? null : pointerRay([event.clientX, event.clientY], evaluation, evaluation.token);
		const startPoint = mode === 'move' && ray?.kind === 'ray' ? artworkPlanePoint(entity, ray.ray) : null;
		artworkResize = { entity, mode, startPoint, startX: event.clientX, pointerId: event.pointerId, lease: acquired.lease };
	}
	function readArtworkResize(event: PointerEvent) {
		const drag = artworkResize;
		if (!drag?.lease.active || evaluation === null || drag.pointerId !== event.pointerId) return null;
		const ray = pointerRay([event.clientX, event.clientY], evaluation, evaluation.token);
		if (drag.mode === 'turn') {
			const rotation = [...drag.entity.rotation] as SceneArtworkEntity['rotation'];
			rotation[1] += (event.clientX - drag.startX) * Math.PI / 360;
			return { ...drag.entity, rotation };
		}
		if (ray.kind !== 'ray') return null;
		if (drag.mode === 'move') {
			const point = artworkPlanePoint(drag.entity, ray.ray);
			if (!point || !drag.startPoint) return null;
			return { ...drag.entity, position: point.sub(drag.startPoint).add(new Vector3(...drag.entity.position)).toArray() };
		}
		return resizeArtworkAtRay(drag.entity, drag.mode, ray.ray);
	}
	async function finishArtworkResize(event: PointerEvent): Promise<void> {
		const drag = artworkResize;
		const services = adapterServices;
		const candidate = readArtworkResize(event);
		cancelArtworkResize();
		if (!drag || !candidate || !services) return;
		const changed = (a: readonly number[], b: readonly number[]) => a.some((value, i) => Math.abs(value - b[i]!) > 1e-7);
		if (!changed([candidate.widthMeters, ...candidate.position, ...candidate.rotation],
			[drag.entity.widthMeters, ...drag.entity.position, ...drag.entity.rotation])) return;
		const result = await artworkCommand(services, ARTWORK_TRANSFORM,
			drag.mode === 'turn' ? { rotation: candidate.rotation }
				: drag.mode === 'move' ? { position: candidate.position }
				: { position: candidate.position, widthMeters: candidate.widthMeters },
			{ target: candidate.id, expectedRevision: drag.lease.acceptedRevision });
		if (adapterServices === services && result.kind === 'refused') notice = result.message;
	}

	function artworkPoseAt(event: MouseEvent) {
		const stage = facade;
		const reading = evaluation;
		if (!canPlaceArtwork() || stage === null || reading === null || reading.renderedReading !== '3d') return null;
		const ray = pointerRay([event.clientX, event.clientY], reading, reading.token);
		if (ray.kind !== 'ray') return null;
		const snapshot = stage.snapshot();
		const hit = scenePick.pick(ray.ray, snapshot.domain.scene);
		const forward = new Vector3(...reading.target).sub(new Vector3(...reading.eye)).normalize().toArray();
		return artworkPlacement(ray.ray, hit, snapshot.domain.datumMeters, reading.eye, forward, snapshot.domain.geometry);
	}

	function acceptsArtworkDrop(transfer: DataTransfer | null): boolean {
		return canPlaceArtwork() && transfer !== null && [...transfer.items].some((item) =>
			item.kind === 'file' && ['', 'image/png', 'image/jpeg', 'image/webp'].includes(item.type));
	}

	function onArtworkDrop(event: DragEvent) {
		if (!acceptsArtworkDrop(event.dataTransfer)) return;
		event.preventDefault();
		selectTool();
		void artwork.importFiles(Array.from(event.dataTransfer?.files ?? []));
	}

	const look = createLookAuthoring({
		environment: () => currentEnvelope?.units.scene.data.environment?.preset ?? 'paper',
		services: () => adapterServices,
		onNotice: (message) => { notice = message; }
	});
	$effect(() => {
		const shown = notice;
		if (lens !== 'experience' || shown === '') return;
		const timeout = setTimeout(() => { if (notice === shown) notice = ''; }, 4000);
		return () => clearTimeout(timeout);
	});
	/** Set by the route's teardown: no late completion may mount a stage after it. */
	let tornDown = false;
	let stageEl: HTMLDivElement | undefined = $state(undefined);
	/** The one lower column's measured height; the Card clears it at narrow widths. */
	let lowerColumnEl: HTMLDivElement | undefined = $state(undefined);
	let lowerColumnHeight = $state(0);
	/**
	 * R217.S22 — the measured lanes beside the Stage. The Height Sheet's lane box and the
	 * zoom cluster are measured here, and the Card clears them through CSS variables on
	 * the Stage frame. A lane measurement only changes placement: it never submits a
	 * Camera intent and never refits the view.
	 */
	let sheetLaneEl = $state<HTMLElement | null>(null);
	let sheetLaneWidth = $state(0);
	/** True while an authored (non-navigation) gesture holds the Stage: the Card fades (D36). */
	let cardGesturing = $state(false);
	/**
	 * Whether the contextual Card is shown. Closing the Card never clears the
	 * selection: the Index keeps echoing it, and selecting the subject again (or
	 * another one) brings the Card back, so identity is never lost to a dismissal.
	 */
	let cardOpen = $state(true);
	/** Bumped by an Index double-click: the Card opens its inline name editor. */
	let cardRenameRequest = $state(0);
	/**
	 * Whether the armed tool's palette is open above the dock. Folding it hides the
	 * instrument without disarming the tool: the creator collapses the palette to see
	 * the Stage, not to drop what they were drawing.
	 */
	let paletteOpen = $state(true);
	/**
	 * The dock's armed contributed tool.
	 *
	 * Host state, not session state: an accepted install closes the active task — its
	 * subject belonged to the source that was replaced — and the creator's armed tool
	 * must not vanish with it. Every explicit close (Select, the palette's close, Esc
	 * once the chain has settled) disarms, so this never resurrects a tool the
	 * creator put down.
	 */
	let armedTool = $state<{ readonly id: string; readonly adapterId: string;
	} | null>(null);
	/**
	 * R217.S10 — the host's own tools. Each is bound to the live facade and keeps
	 * only session view state (a measurement, an erase candidate or its words).
	 */
	let measureTool: StageMeasureController | null = null;
	let eraserTool: StageEraserController | null = null;
	/** What the host tools draw this frame, in Stage-local CSS. */
	let hostToolOverlay = $state<{
		readonly measure: { readonly from: readonly [number, number]; readonly to: readonly [number, number]; readonly label: string; readonly live: boolean;
		} | null;
		readonly notice: { readonly css: readonly [number, number]; readonly message: string; readonly kind: string;
		} | null;
	} | null>(null);
	/** The Eraser's winner, drawn with the erase treatment in place of hover. */
	let eraseHover = $state<StageSelectionEntry | null>(null);
	/** The Head's bounded Find query. */
	let findQuery = $state('');
	/**
	 * A destructive Card action whose consequences have been disclosed and which
	 * awaits a second `Delete`.
	 *
	 * The offer is a **fingerprint**, not the record it was read from: the exact
	 * subject and the words that subject's adapter disclosed. The second press
	 * compares it with the **live** Card action, so a different Wall — or the same
	 * Wall whose consequences changed — is disclosed again, and a stale record can
	 * never run against a later subject.
	 */
	let pendingDelete = $state<{
		readonly subjectKey: string;
		readonly actionId: string;
		readonly detail: string | null;
	} | null>(null);
	/** The selected subject's confirmation key, or `null` when nothing is selected. */
	const deleteSubjectKey = $derived.by(() => {
		const selected = selection;
		return selected === null
			? null
			: `${selected.reference.subject.kind}:${selected.reference.subject.id}`;
	});
	$effect(() => {
		// A selection change spends the offer: the disclosure was read for one
		// subject, and the notice beside it named that subject's consequences. Only
		// the selection is tracked — the press that opens an offer must not retrigger
		// this and clear it.
		const key = deleteSubjectKey;
		untrack(() => {
			if (pendingDelete === null || pendingDelete.subjectKey === key) return;
			pendingDelete = null;
			notice = '';
		});
	});
	/**
	 * PLATE arbitration at constrained width: the Card folds to identity so the
	 * dock/palette's one lower column stays readable. The creator's own toggle wins
	 * over the width rule until the task closes.
	 */
	let narrowShell = $state(constrainedAtStart);

	$effect(() => {
		const element = lowerColumnEl;
		if (element === undefined) return;
		// jsdom (the route contract lane) has no layout and no ResizeObserver.
		if (typeof ResizeObserver === 'undefined') return;
		// The observed box is the measurement: reading the element again here would
		// be a second layout read beside the one viewport function above.
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			lowerColumnHeight = entry?.borderBoxSize?.[0]?.blockSize ?? entry?.contentRect.height ?? 0;
		});
		observer.observe(element);
		return () => observer.disconnect();
	});
	$effect(() => {
		// The Sheet lane: its border-box width, measured wherever the Sheet is mounted.
		const element = sheetLaneEl;
		// Unmounting the Sheet (leaving World) may leave the binding null or undefined.
		if (element === null || element === undefined) {
			sheetLaneWidth = 0;
			return;
		}
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			sheetLaneWidth = entry?.borderBoxSize?.[0]?.inlineSize ?? entry?.contentRect.width ?? 0;
		});
		observer.observe(element);
		return () => observer.disconnect();
	});
	/** The lane on each edge: a Sheet on the right (or left) owns that edge; the other is clear. */
	const sheetLaneRight = $derived(heightSheetSide === 'right' ? sheetLaneWidth : 0);
	const sheetLaneLeft = $derived(heightSheetSide === 'left' ? sheetLaneWidth : 0);

	// Register the session's unsaved-work navigation guard during route initialization.
	projectSession.bindNavigation();

	/* --- activation, content change and the replacement epoch --------------- */

	/** Everything a project swap or a content change invalidates in the host's view. */
	function resetViewContext(): void {
		selection = null;
		task = null;
		revealed = [];
		notice = '';
		// A replacement is not a disclosure the creator read: no offer survives into
		// a source its words were never derived from.
		pendingDelete = null;
		// A replaced project is not the run the tool was armed for: drop it with
		// the task it belonged to, so a later notification cannot re-arm it.
		armedTool = null;
		cardOpen = true;
		drag = null;
		// A replacement is not a press the creator finished: no click from the old
		// project may select into the new one.
		press.abort();
		planView = null;
		// The key must be dropped with the view it described, or the recompute that
		// follows a swap would be skipped as unchanged.
		planKey = '';
		planParametersKey = '';
		markers = [];
		marks = [];
		hoverSelection = null;
	}

	function activate(snapshot: StageReadSnapshot): void {

		// A completion that arrives after the route tore down must not mount a stage:
		// nothing would ever dispose it, and it would hold a camera for a page that
		// no longer exists.
		if (tornDown) return;
		// Replacement: validate first (the snapshot is already admitted), then the
		// session atomically cancels writers, clears selection/task and swaps.
		clearHover();
		interruptPress('replacement');
		session.replace(snapshot);
		// A Preview run and the lens focus name identities from the replaced source;
		// the warm surface cannot describe the new one. Drop both (the chunk stays
		// cached) rather than keeping another project's scene alive behind the editor.
		previewController.reset();
		adapterServices = null;
		experienceFocus.reset();
		expandedPresentationId = null;
		// The previous facade's listeners are dropped before its replacement exists,
		// so a disposal-time notification cannot write through the new facade.
		unsubscribeContributions?.();
		unsubscribeContributions = null;
		facade?.dispose();
		acceptance?.dispose();
		facade = createStageFacade({ snapshot, session, scenePick: scenePick.pick, sceneBounds: scenePick.bounds });
		measureTool = createStageMeasure(facade);
		eraserTool = createStageEraser(facade, () => refreshHostTools());
		// The session keeps Grid/Snap across a replacement; the presenter re-reads it
		// from the mounted authority rather than assuming its own default.
		drafting = facade.drafting();
		unsubscribeContributions = facade.onAdaptersChanged(() => {
			contributionsVersion += 1;
			task = facade?.session.task() ?? null;
			syncPrimarySelection(facade ? primaryEntry(facade.selectionState()) : null);
			syncContributedTask();
		});
		task = null;
		contributedTaskId = null;
		// The host owns one inspection output; every viewing intent below presents
		// this claim's ticket, so a replaced or rebased output cannot keep writing.
		facade.acquireInspection('exclusive');
		// One acceptance coordinator per project epoch, starting from the admitted
		// baseline. The coordinator's bounded history is the single history; this
		// host never keeps a second one.
		const mounted = createStageAcceptanceHost({
			sessionEpoch: snapshot.sessionEpoch,
			baseline: {
				revision: snapshot.acceptedRevision,
				source: stageEnvelope(snapshot),
				// The baseline's bytes must be the snapshot's own canonical form: the F4
				// adapter re-admits them on Undo and refuses a different serialization.
				canonicalJson: snapshot.canonicalJson,
				sourceContentId: snapshot.sourceContentId
			},
			facade
		});
		unsubscribeAcceptance?.();
		projectSession.unmountSave();
		// The mounted facade is the epoch's source. The mark is the anchor the
		// performance harness uses for the first architectural frame (F1/F2).
		perfMark('build:identity', { version: typeof __BISKIQ_BUILD_REVISION__ === 'string' ? __BISKIQ_BUILD_REVISION__ : 'unverified' });
		perfMark('stage:activated', { sourceContentId: snapshot.sourceContentId });
		acceptance = mounted;
		adapterServices = createStageAdapterServices(facade, mounted);
		void resolveModels(snapshot);
		unsubscribeAcceptance = mounted.onChanged(() => {
			if (acceptance !== mounted || tornDown) return;
			// A source change ends the Preview claim through the protocol's rebase (the
			// output's source identity is no longer current), so leaving it restores
			// nothing: the Stage continues under the claim the content change minted.
			if (previewController.openState) previewController.close();
			refreshHistory();
			// The Save state derives its status from the accepted source, so an
			// accepted edit is what makes the project dirty. Without this refresh
			// the Head keeps reporting the pre-edit status and the exit/replacement
			// guards never see unsaved work.
			headSave?.refresh();
			if (facade !== null && (boot.status === 'ready' || boot.status === 'empty')) {
				projectSession.updateSnapshot(facade.snapshot());
				// A newly placed (or removed) model changes the pins this route holds.
				void resolveModels(facade.snapshot());
			}
			task = facade?.session.task() ?? null;
			syncPrimarySelection(facade ? primaryEntry(facade.selectionState()) : null);
			syncContributedTask();
			planKey = '';
		planParametersKey = '';
			refresh();
		});
		for (const factory of stageAdapterFactories) mountStageAdapter(facade, mounted, factory);
		// The previous epoch's controller belongs to its disposed coordinator; this
		// epoch gets exactly one state machine over the new one.
		projectSession.mountSave(mounted, snapshot);
		historyState = mounted.history();
		resetViewContext();
	}


	/* --- viewport measurement and evaluation -------------------------------- */

	function measure(): ViewportRect {
		const element = stageEl;
		const width = element?.clientWidth ?? 0;
		const height = element?.clientHeight ?? 0;
		const bounds = element?.getBoundingClientRect();
		return { left: bounds?.left ?? 0, top: bounds?.top ?? 0, width, height, devicePixelRatio: window.devicePixelRatio || 1 };
	}

	/** The gold frame's content box: absolute for Camera, Stage-local for the scissor. */
	function measureThroughFrame():
		| { readonly absolute: ViewportRect; readonly local: { readonly left: number; readonly top: number; readonly width: number; readonly height: number } }
		| null {
		const frame = throughFrameEl;
		if (stageEl === undefined || frame === null) return null;
		const stageRect = rect ?? measure();
		const frameRect = frame.getBoundingClientRect();
		const width = frameRect.width;
		const height = frameRect.height;
		if (!(width > 0 && height > 0)) return null;
		const left = frameRect.left + frame.clientLeft;
		const top = frameRect.top + frame.clientTop;
		return {
			absolute: { left, top, width, height, devicePixelRatio: window.devicePixelRatio || 1 },
			local: { left: left - stageRect.left, top: top - stageRect.top, width, height }
		};
	}

	// `bind:this` lands after the first look-through refresh; measure it then.
	$effect(() => {
		const frame = throughFrameEl;
		const session = experienceLens.lookThroughSession();
		if (frame !== null && session !== null) untrack(() => refresh());
	});

	function acceptRect(next: ViewportRect): void {
		rect = next;
	}

	function nowSeconds(): number {
		const real = typeof performance === 'undefined' ? Date.now() / 1000 : performance.now() / 1000;
		return motionClock.read(real);
	}

	let planKey = '';
	/**
	 * The last reveal union this route handed the facade.
	 *
	 * Separate from `planKey` because the two answer different questions: this one
	 * says whether host parameters need sending, and `planKey` says whether the
	 * evaluation they name needs recomputing. Both are reset with the mount.
	 */
	let planParametersKey = '';
	/**
	 * The last overlay marker set the route painted, as a cheap identity key.
	 * T3.P03.S02 marks a change only: the harness pairs the newest dragged input with
	 * the frame that carried its preview, so a presentation is never inferred from an
	 * install timestamp.
	 */
	let lastOverlayKey = '';
	let tracePreview = $state<PerfTracePreview | null>(null);

	function refresh(): void {
		experienceLens.advanceLookThroughZoom(performance.now());
		const stage = facade;
		if (stage === null) return;
		// The gesture lease is host state that changes what Undo can do without an
		// acceptance, so the Head's reported history follows it on the same frame as
		// the render rather than only on the next accepted change.
		refreshHistory();
		// R217.S22 (D36): an authored gesture is a non-navigation lease. The Card fades while
		// it lives. A navigation press (pan, orbit, zoom) never fades the Card.
		const lease = session.gesture();
		// Review round 3 (sheet §24, Card only): a camera edit keeps the Card clear, so its
		// framing and picture read beside the camera being moved. Other authored gestures fade it.
		const cameraEdit = lease !== null && (lease.owner === 'experience-view-edit' || lease.owner === 'experience-path-point');
		const gesturing = lease !== null && lease.navigation !== true && !cameraEdit;
		if (gesturing !== cardGesturing) cardGesturing = gesturing;
		// Look through renders the real picture inside its 16:10 capture frame; the
		// same measured rect is both Camera's evaluation and the Canvas scissor.
		let currentRect = rect ?? measure();
		const framed = experienceLens.lookThroughSession() === null ? null : measureThroughFrame();
		if (framed !== null) currentRect = framed.absolute;
		if (framed === null) {
			if (throughViewport !== null) throughViewport = null;
		} else if (
			throughViewport === null ||
			throughViewport.left !== framed.local.left ||
			throughViewport.top !== framed.local.top ||
			throughViewport.width !== framed.local.width ||
			throughViewport.height !== framed.local.height
		) {
			throughViewport = framed.local;
		}
		const groundReach = !look.editOnPaper && look.environment !== 'paper' ? WORLD_ENVIRONMENT_GROUND_RADIUS_METERS : undefined;
		const result = stage.camera.evaluate(currentRect, nowSeconds(), groundReach);
		evaluation = result.kind === 'evaluated' ? result.evaluation : null;
		if (evaluation === null) return;

		// The Plan evaluation is recomputed only when it would actually differ, and
		// **the facade is the authority on that**, not this presenter.
		//
		// `evaluateLayoutPlan` reads the inspection target in exactly one place, the
		// `lateral-span` membership stage, whose provider default is explicit
		// unbounded coverage — so a pan cannot change a fragment, a membership row, a
		// stream or a bound. Keying on the target here unconditionally made every pan
		// frame re-evaluate the whole Plan (four full-array sorts and a fresh
		// candidate object per source) and then hand a new `planView` to the Index,
		// which re-grouped every membership row on the same frame. `planDependencyKey`
		// names the inputs the evaluation really reads, including the target when a
		// producer has bounded the lateral span, so this needs no knowledge of which
		// case it is in.
		// Reveal is host state the facade holds, so the Plan the Stage draws and the
		// Plan its hit path resolves agree about which sources are eligible.
		const parameters = { reveal: [...revealed].sort() };
		// Encoded only when non-empty: a reveal set is usually empty, and a source id
		// must never be able to make two different sets compare equal.
		const parametersKey =
			parameters.reveal.length === 0 ? '' : JSON.stringify(parameters.reveal);
		if (parametersKey !== planParametersKey) {
			planParametersKey = parametersKey;
			stage.setPlanParameters(parameters);
		}
		const key = stage.planDependencyKey();
		if (key !== planKey) {
			planKey = key;
			const planResult = stage.plan();
			planView = planResult.kind === 'evaluated' ? planResult.plan : null;
		}

		// Overlays project through the *same* evaluation: adapter contributions and
		// the selection echo are CSS points from `projectWorld`, never a second
		// projection.
		markers = stage.overlays();
		candidatePreviews = stage.candidatePreviews();
		// The key is only evidence for the harness, so it must cost nothing in the
		// ordinary build: no string building or marker scan when the flag is absent.
		if (perfMarksEnabled()) {
			// Tenths of a CSS pixel: a slow drag moves a preview by less than one pixel
			// per sample, and a coarse key would make those presentations invisible.
			const overlayKey = markers
				.map((marker) => `${marker.id}:${Math.round(marker.css[0] * 10)},${Math.round(marker.css[1] * 10)}`)
				.join('|');
			if (overlayKey !== lastOverlayKey) {
				lastOverlayKey = overlayKey;
				tracePreview = perfTracePreview(markers);
				// The preview is presented by the frame that paints this overlay state; the
				// ledger's sequence says which input sample it belongs to. `preview` keeps a
				// later overlay change (release, selection) from being counted as the
				// presentation of the drag that produced it.
				perfMark('overlay:updated', {
					markers: markers.length,
					preview: markers.some((marker) => marker.id.endsWith('-preview'))
				});
			}
		}
		const snapshot = stage.snapshot();
		const evaluationId = stage.evaluationId();
		// Room labels are a per-view ⚙ preference: on in 2D, off in 3D by default.
		const labelsShown = evaluation?.settledReading === 'plan' ? preferences.roomLabels2d : preferences.roomLabels3d;
		roomLabels = evaluationId === null || !evaluation || lens !== 'world' || !labelsShown ? [] : projectRoomLabels(
			roomLabelFacts(snapshot.domain.geometry, stageEnvelope(snapshot).units.layout.data.rooms),
			point => {
				const projected = stage.projectWorld(point, evaluationId);
				return projected.kind === 'projected' && projected.visibility === 'visible' && rect
					? [projected.css[0] - rect.left, projected.css[1] - rect.top] : null;
			}, evaluation.targetPlaneMetersPerCssPixel
		);
		ghosts = stage.ghosts();
		marks = stage.marks();
		refreshHostTools();
	}

	/**
	 * Project what the host tools draw through the same evaluation as everything
	 * else: Measure's dimension line and tag, the Eraser's words, and its winner as
	 * the erase-treated hover. Identity is kept while the subject is unchanged so a
	 * pointer moving within one subject does not rebuild the Stage's ink.
	 */
	function refreshHostTools(): void {
		const stage = facade;
		const id = stage?.evaluationId() ?? null;
		if (stage === null || id === null || armedHostTool === null) {
			if (hostToolOverlay !== null) hostToolOverlay = null;
			if (eraseHover !== null) eraseHover = null;
			return;
		}
		const local = (point: readonly [number, number, number]): readonly [number, number] | null => {
			const projected = stage.projectWorld([point[0], point[1], point[2]], id);
			if (projected.kind !== 'projected') return null;
			const current = rect ?? measure();
			return [projected.css[0] - current.left, projected.css[1] - current.top];
		};
		let measured: NonNullable<typeof hostToolOverlay>['measure'] = null;
		const view = armedHostTool === 'measure' ? (measureTool?.view() ?? null) : null;
		if (view !== null) {
			const from = local(view.from.point);
			const to = local(view.to.point);
			if (from !== null && to !== null) measured = { from, to, label: view.label, live: view.live };
		}
		const eraseNotice = armedHostTool === 'erase' ? (eraserTool?.notice() ?? null) : null;
		hostToolOverlay = { measure: measured, notice: eraseNotice };
		const candidate = armedHostTool === 'erase' ? (eraserTool?.candidate() ?? null) : null;
		if (candidate === null || candidate.refusal !== null) {
			if (eraseHover !== null) eraseHover = null;
			return;
		}
		const hit = candidate.hit;
		const representation = hit.reference === undefined
			? { sourceId: hit.sourceId, sourceKind: hit.sourceKind, generationId: hit.generationId, stream: hit.stream, subRef: hit.subRef }
			: undefined;
		const reference = hit.reference ?? layoutSelectionReference(representation!, stage.snapshot());
		if (eraseHover !== null && sameReference(eraseHover.reference, reference)) return;
		eraseHover = representation === undefined ? { reference } : { reference, representation };
	}

	onMount(() => {
		perfMark('stage:route-mounted');
		try {
			showExperienceWelcome = !welcomeDismissed();
		} catch {
			showExperienceWelcome = true;
		}
		const initial = measure();
		acceptRect(initial);
		let frame = 0;
		const tick = () => {
			// The next frame is scheduled in `finally`: one throwing adapter
			// contribution must not stop the Stage's own rendering for the rest of
			// the session.
			try {
				// The isolated Preview owns the Camera output and the Stage's canvas is
				// unmounted: evaluating or refreshing an inspection view here would be a
				// second reader of an output this run no longer owns.
				if (preview !== null) return;
				const stage = stageEl;
				if (stage !== undefined) {
					const next = measure();
					if (
						rect === null ||
						next.width !== rect.width ||
						next.height !== rect.height ||
						next.left !== rect.left ||
						next.top !== rect.top ||
						next.devicePixelRatio !== rect.devicePixelRatio
					) {
						acceptRect(next);
					}
				}
				experienceLens.advancePlayback(performance.now());
				refresh();
			} finally {
				frame = requestAnimationFrame(tick);
			}
		};
		frame = requestAnimationFrame(tick);

		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		preferences = readAppPreferences();
		motionClock.setSpeed(preferences.motionSpeed, performance.now() / 1000);
		reducedMotion = preferences.reducedMotion ?? media.matches;
		const onMedia = (event: MediaQueryListEvent) => {
			if (preferences.reducedMotion === null) reducedMotion = event.matches;
		};
		media.addEventListener('change', onMedia);

		// The shell's width rule: at a constrained width the Card folds to identity
		// rather than covering the dock/palette's one lower column.
		const narrow = window.matchMedia('(max-width: 1100px)');
		narrowShell = narrow.matches;
		const portrait = window.matchMedia('(max-width: 860px)');
		if (portrait.matches) indexOpen = false;
		const onNarrow = (event: MediaQueryListEvent) => {
			narrowShell = event.matches;
		};
		narrow.addEventListener('change', onNarrow);
		const onPortrait = (event: MediaQueryListEvent) => {
			if (event.matches) indexOpen = false;
		};
		portrait.addEventListener('change', onPortrait);

		const onKey = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			// A held Alt/Option is the shared Snap suspension. Reading it from the
			// event's own modifier keeps the fact true for a key pressed while Alt was
			// already down, not only for Alt's own keydown.
			if (event.altKey) suspendSnap(true);
			handleKey(event);
		};
		// Releasing the modifier — or losing the window — always restores Snap: a
		// modifier the browser never delivers a keyup for must not strand it off.
		const onReleaseSnap = (event: KeyboardEvent) => {
			if (event.key === 'Alt') suspendSnap(false);
		};
		const onWindowBlur = () => suspendSnap(false);
		window.addEventListener('keydown', onKey);
		window.addEventListener('keyup', onReleaseSnap);
		window.addEventListener('blur', onWindowBlur);
		const removeInterruptions = installStageInterruptions(window, document, interruptPress);

		void projectSession.load(projectId, intent);

		return () => {
			// Order matters: the flag and the session teardown both run before the
			// facade is disposed, so a load already past its fetch sees a torn-down
			// session (`isCurrent` is false, the registered abort fires) and drops its
			// result instead of mounting a second stage.
			experienceLens.dispose();
			tornDown = true;
			cancelAnimationFrame(frame);
			clearHover();
			media.removeEventListener('change', onMedia);
			narrow.removeEventListener('change', onNarrow);
			portrait.removeEventListener('change', onPortrait);
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('keyup', onReleaseSnap);
			window.removeEventListener('blur', onWindowBlur);
			removeInterruptions();
			// Session teardown cancels every registered writer (including an in-flight
			// project GET) and runs every registered disposer exactly once; no
			// project-specific singleton — acceptance host, history or facade — survives
			// the route.
			unsubscribeContributions?.();
			unsubscribeAcceptance?.();
			projectSession.dispose();
			unsubscribeContributions = null;
			acceptance?.dispose();
			facade?.dispose();
			// The route owns every approved-model URL it acquired; the visitor
			// surface never revokes what it was handed.
			modelResolution?.dispose();
			modelResolution = null;
			modelUrls = new Map();
			modelPinSignature = '';
			installedModelSignature = '';
			session.dispose();
		};
	});

	/**
	 * Resolve every approved creator-model derivative for one accepted source.
	 *
	 * The pins come from the envelope's `model` resources, so this is the same
	 * resolution a fresh reopen performs: a stale import-session URL is never
	 * reused, and a source change releases exactly the URLs the previous source
	 * acquired. A failed model stays a failure and the fallback box carries the
	 * approved footprint; it is never drawn as if the bytes had loaded.
	 */
	async function resolveModels(snapshot: Parameters<typeof stageEnvelope>[0]): Promise<void> {
		const pins = approvedModelPins(stageEnvelope(snapshot));
		// An edit that does not change the approved pins keeps the URLs it already
		// has: revoking and re-downloading every derivative on each accepted command
		// would flash the fallback box and re-fetch immutable bytes.
		const signature = pins.map((pin) => `${pin.assetId}@${pin.hash}`).join('|');
		if (signature === modelPinSignature) return;
		modelPinSignature = signature;
		const generation = ++modelGeneration;
		// The installed set stays live while the new one resolves. Shared hashes keep
		// their references through the object-URL ref count, so they are neither
		// revoked nor re-fetched; the old set is released only once its replacement
		// is installed.
		const landed: { value: ApprovedModelSources | null } = { value: null };
		let installable = false;
		try {
			// The session's cancellation registry is the one abort authority: a
			// replacement or teardown ends this read, exactly like a project load.
			// `runBoundLoad` discards the value of a cancelled read, so the value is
			// captured here and released below rather than leaked.
			installable =
				(await runBoundLoad(session, async (signal) => {
					landed.value = await resolveApprovedModels({
						envelope: stageEnvelope(snapshot),
						projectId: snapshot.acceptedRevision.projectId,
						apiOrigin: env.PUBLIC_API_ORIGIN ?? '',
						signal
					});
					return landed.value;
				})) !== null;
		} catch {
			// A failed resolution installs nothing: the Stage keeps the installed set
			// and the fallback for any model outside it.
		}
		const resolved = landed.value;
		if (!installable || resolved === null || tornDown || generation !== modelGeneration) {
			// A stale, cancelled or failed attempt releases only what it acquired.
			resolved?.dispose();
			if (!tornDown && generation === modelGeneration) modelPinSignature = installedModelSignature;
			return;
		}
		const previous = modelResolution;
		modelResolution = resolved;
		installedModelSignature = signature;
		modelUrls = resolved.urls;
		previous?.dispose();
		// A model whose bytes are unavailable is stated, not dressed as a loaded
		// mesh: the fallback box carries the approved footprint and this note names
		// the reason. A successful resolution clears only a notice it set itself.
		const failure = resolved.failures.size === 0 ? null : [...resolved.failures.values()][0]!;
		if (failure !== null) {
			notice = failure;
			modelNotice = failure;
		} else {
			if (modelNotice !== null && notice === modelNotice) notice = '';
			modelNotice = null;
		}
	}

	/* --- Camera intents ----------------------------------------------------- */

	/**
	 * Submit one viewing intent through the seam, presenting the host's own
	 * inspection claim.
	 *
	 * `superseded` is the ownership answer, not a domain rejection: the output was
	 * replaced or ended by a content change and this run no longer holds it. The
	 * host re-acquires its own inspection output once and retries the same intent.
	 */
	function submit(intent: ViewingIntent, clockSeconds: number): StageIntentResult | null {
		const stage = facade;
		if (stage === null) return null;
		// A claimed adapter press owns its projection until release or an explicit
		// reading interruption. Wheel/Fit/keyboard navigation must not remap that
		// press while its evaluation identity is deliberately retained.
		if (drag?.mode === 'adapter' && intent.kind !== 'set-reading') return null;
		const first = stage.requestViewingIntent(intent, stage.inspectionTicket(), clockSeconds);
		if (first.kind !== 'superseded') return first;
		stage.acquireInspection('exclusive');
		return stage.requestViewingIntent(intent, stage.inspectionTicket(), clockSeconds);
	}

	function setReading(reading: '3d' | 'plan'): void {

		// Reduced motion cuts directly to the declared endpoint through the one
		// settling rule — it is not a shortened tween.
		submit({ kind: 'set-reading', reading }, readingIntentClockSeconds(reducedMotion, nowSeconds()));
		// The host ran the live lease's policy as part of that request: a lease that
		// `cancel-on-reading-change` ended is already gone, and its delta samples were
		// taken against the reading that is ending. Dropping them here is what makes
		// T2.S03's "cancel before the flip" mean the gesture also stops moving.
		if (drag !== null && session.gesture() === null) {
			if (drag.mode === 'adapter' && facade !== null) {
				// Evaluate through Camera before notifying the claimed adapter: ordinary
				// frame generations retain the press id, but this explicit reading change
				// must reach its existing mismatch path and preserve the exact request.
				// A move cannot commit; cancel then clears the pointer owner (including
				// adapters whose reading-change contract simply discards the preview).
				const css: [number, number] = [drag.x - (rect?.left ?? 0), drag.y - (rect?.top ?? 0)];
				refresh();
				const id = facade.evaluationId();
				if (id !== null) {
					facade.pointerIntent({ phase: 'move', css, evaluationId: id });
				}
			}
			interruptPress('reading-change');
		}
	}

	/**
	 * Change the one Grid/Snap fact through the session authority.
	 *
	 * Nothing here touches acceptance, history or Save: the session's view state
	 * is not authored content, so a Grid/Snap toggle cannot dirty the project.
	 */
	function patchDrafting(patch: StageDraftingPatch): void {
		drafting = facade === null ? applyDraftingPatch(drafting, patch) : facade.setDrafting(patch);
	}

	/**
	 * A Scale detent as the **existing** zoom viewing intent.
	 *
	 * The shell computes no pose: it converts the requested ratio to the settled
	 * target-plane size and lets the Camera's own zoom semantics land on it.
	 */
	function requestScaleDetent(ratio: number): void {
		const stage = facade;
		const viewport = rect;
		if (stage === null || viewport === null || viewport.height <= 0) return;
		// Derive the ratio from the live settled pose, not the last painted frame:
		// a zoom or Fit between frames must not leave the detent computed against a
		// stale evaluation. The multiply stays in Camera's `zoom` intent.
		const settledHeight = stage.camera.state().pose.targetPlaneHeightMeters;
		const metersPerCssPixel = settledHeight / viewport.height;
		const intent = scaleDetentIntent(ratio, metersPerCssPixel);
		if (intent !== null) submit(intent, nowSeconds());
	}

	/**
	 * Alt/Option holds Snap off until release, blur or teardown.
	 *
	 * Entering the hold is ignored during Preview (the Stage is not listening for
	 * drawing there), but releasing it always applies: a keyup the Preview guard
	 * swallowed would otherwise strand `Snap held` after Exit forever.
	 */
	function suspendSnap(suspended: boolean): void {
		if (drafting.snapSuspended === suspended) return;
		if (preview !== null && suspended) return;
		patchDrafting({ snapSuspended: suspended });
	}

	/**
	 * Fit all through the existing `fit` intent.
	 *
	 * The frame is the union of the compiled Layout bounds and every placed Scene
	 * entity's drawn body: a free Scene object outside the drawing is still on the
	 * Stage, so "Fit all" must not leave it off-screen. No pose is composed here.
	 */
	function fit(): void {
		const stage = facade;
		if (stage === null || rect === null) return;

		const bounds = readStageContentBounds(stage);
		if (bounds === null) return;
		submit({ kind: 'fit', bounds: { min: bounds.min, max: bounds.max }, rect }, nowSeconds());
	}

	/** Zoom steps use the same Camera `zoom` the wheel drives: 1.25 per press. */
	function zoomIn(): void {
		zoom(1 / 1.25);
	}
	function zoomOut(): void {
		zoom(1.25);
	}

	function bringIntoView(target: readonly [number, number, number]): void {
		// A Card action competes with any Present-this run still waiting for its frame.

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

	/* --- source history (host commands through the F4 boundary) -------------- */

	function refreshHistory(): void {
		const next = acceptance?.history() ?? {
			canUndo: false,
			canRedo: false,
			depth: 1,
			position: 0,
			undoUnavailableReason: 'History belongs to the mounted project.',
			redoUnavailableReason: 'History belongs to the mounted project.'
		};
		// Assigned only when something changed: this runs on the animation frame, so
		// an unconditional assignment would re-render the Head 60 times a second.
		if (
			next.canUndo === historyState.canUndo &&
			next.canRedo === historyState.canRedo &&
			next.depth === historyState.depth &&
			next.position === historyState.position &&
			next.undoUnavailableReason === historyState.undoUnavailableReason &&
			next.redoUnavailableReason === historyState.redoUnavailableReason
		) {
			return;
		}
		historyState = next;
	}

	async function undo(): Promise<void> {
		const host = acceptance;
		if (host === null) return;
		perfMark('command:undo');
		const outcome = await host.undo();
		if (acceptance !== host || tornDown) return;
		if (outcome.kind === 'installed') {
			// The restored state installed through the same facade path an accept uses:
			// the view stays, the selection was requalified against the restored
			// correspondence, and the plan/markers refresh below reads the new snapshot.
			selection = facade ? primaryEntry(facade.selectionState()) : null;
			if (outcome.selectionClearedReason !== null) {
				notice = 'The selected subject no longer exists in the restored source.';
			}
			planKey = '';
		planParametersKey = '';
		} else if (outcome.kind === 'unavailable') {
			notice = outcome.reason === 'live-proposal' ? 'A proposal is live; Undo runs once it settles.' : 'Nothing to undo.';
		} else if (outcome.kind === 'refused') {
			notice =
				outcome.compensation === 'failed'
					? `${outcome.message} The history could not be rolled back to match what is shown.`
					: outcome.message;
		}
		refreshHistory();
		refresh();
	}

	async function redo(): Promise<void> {
		const host = acceptance;
		if (host === null) return;
		perfMark('command:redo');
		const outcome = await host.redo();
		if (acceptance !== host || tornDown) return;
		if (outcome.kind === 'installed') {
			selection = facade ? primaryEntry(facade.selectionState()) : null;
			if (outcome.selectionClearedReason !== null) {
				notice = 'The selected subject no longer exists in the restored source.';
			}
			planKey = '';
		planParametersKey = '';
		} else if (outcome.kind === 'unavailable') {
			notice = outcome.reason === 'live-proposal' ? 'A proposal is live; Redo runs once it settles.' : 'Nothing to redo.';
		} else if (outcome.kind === 'refused') {
			notice =
				outcome.compensation === 'failed'
					? `${outcome.message} The history could not be rolled back to match what is shown.`
					: outcome.message;
		}
		refreshHistory();
		refresh();
	}

	/* --- selection, tasks and Reveal ---------------------------------------- */

	/** A compact, complete reference: the source kind plus its canonical identity. */
	function sourceLabel(sourceId: string, kind: string): string {
		return `${kind === 'room-floor' ? 'floor' : kind} · ${sourceId}`;
	}

	/**
	 * Mirror a selection the host or an adapter made canonically.
	 *
	 * A contributed task may select a new subject after its own accepted install
	 * (Create, Place, Duplicate). A new primary selection replaces the Experience
	 * subject (D10, one Card selection); a revision-only requalification of the same
	 * subject leaves the current Card selection alone.
	 */
	function syncPrimarySelection(next: StageSelectionEntry | null): void {
		const pick = stagePickPresentationId;
		if (
			pick !== null &&
			next !== null &&
			next.reference.domain === 'scene' &&
			next.reference.subject.kind === 'entity'
		) {
			stagePickPresentationId = null;
			selection = null;
			cardOpen = true;
			void activeExperience?.linkPresentation(pick, next.reference.subject.id).then((accepted) => {
				if (accepted) experienceLens.selectSubject({ kind: 'presentation', presentationId: pick });
			});
			return;
		}
		const keyOf = (entry: StageSelectionEntry | null) =>
			entry === null
				? ''
				: `${entry.reference.domain}\u0000${entry.reference.subject.kind}\u0000${entry.reference.subject.id}`;
		const previous = keyOf(selection);
		const key = keyOf(next);
		selection = next;
		if (key !== '' && key !== previous) {
			experienceFocus.select(null);
			cardOpen = true;
		}
	}

	function selectHit(hit: StageSourceHit): void {
		const stage = facade;
		if (stage === null) return;
		const pick = stagePickPresentationId;
		if (
			pick !== null &&
			hit.reference !== undefined &&
			hit.reference.domain === 'scene' &&
			hit.reference.subject.kind === 'entity'
		) {
			stagePickPresentationId = null;
			selection = null;
			cardOpen = true;
			void activeExperience?.linkPresentation(pick, hit.reference.subject.id);
			return;
		}
		if (hit.reference !== undefined) {
			stage.setSelection({ ordered: [{ reference: hit.reference }], primary: hit.reference });
			selection = primaryEntry(stage.selectionState());
			experienceFocus.select(null);
			cardOpen = true;
			return;
		}
		const selected: StageSelection = {
			sourceId: hit.sourceId,
			sourceKind: hit.sourceKind,
			generationId: hit.generationId,
			ref: {
				sourceId: hit.sourceId,
				sourceKind: hit.sourceKind,
				generationId: hit.generationId,
				stream: hit.stream,
				subRef: hit.subRef
			}
		};
		stage.select(selected);
		selection = primaryEntry(stage.selectionState());
		experienceFocus.select(null);
		cardOpen = true;
	}

	/** The Card is an overlay: hiding it is not a selection change. */
	function closeCard(): void {
		cardOpen = false;
	}

	/** Clearing the selection does reopen the Card for the next subject. */
	function closeSelection(): void {
		facade?.select(null);
		selection = null;
		experienceFocus.select(null);
		cardOpen = true;
	}

	/** Open the Card a problem names; the chip itself never edits the source. */
	function showProblem(problem: ExperienceProblem): void {
		if (problem.subject === null) return;
		if (lens !== 'experience') changeLens('experience');
		cardOpen = true;
		const subject = problem.subject;
			if (subject.kind === 'guide') {
			// D-2: a Guide has no Card. Show opens its instrument and keeps the Experience Card.
			const controller = activeExperience;
			const guide = controller?.guides.find((entry) => entry.id === subject.guideId);
			if (controller == null || guide === undefined) return;
			experienceLens.openGuide(guide.id);
			experienceFocus.select({ kind: 'experience' });
			return;
		}
		experienceFocus.select(subject);
	}

	/**
	 * C3 checkpoint 5 — the live unfolded press.
	 *
	 * The developed sheet is the addressed surface while unfolded, so a primary
	 * press is cast through the accepted Camera evaluation into the same
	 * checkpoint-4 display strip the Stage draws. The nearest positive hit is
	 * attributed to canonical Station/span/knot/face (ties keep the first display
	 * triangle in mesh order; a closed Station wraps modulo L; a seam-crossing
	 * Opening resolves through `developmentOpeningIdentity`) and selected through
	 * the route's ordinary selection state. This reads geometry and writes only
	 * selection/pick evidence: no document write, no edit, no undo entry.
	 *
	 * An open adapter task keeps the press: Opening placement/editing is still
	 * canonical work under D13. A miss falls through to ordinary Stage navigation
	 * and the click guard in `onClick` prevents a canonical hit behind the sheet.
	 */
	type UnfoldPinHit = { readonly css: readonly [number, number] };
	type UnfoldPinContext = {
		readonly wallId: string;
		readonly station: number;
		readonly point: readonly [number, number, number];
		readonly active: boolean;
	};

	/** The curved Wall whose idle pin should accompany the current selection. */
	const selectedCurvedWall = $derived.by(() => {
		if (boot.status !== 'ready' && boot.status !== 'empty') return null;
		const selected = selection;
		if (
			selected === null ||
			selected.reference.domain !== 'layout' ||
			selected.reference.subject.kind !== 'wall'
		) return null;
		const snapshot = boot.snapshot;
		const wall = snapshot.domain.geometry.walls.find(
			(candidate) => candidate.wallId === selected.reference.subject.id
		);
		if (wall === undefined || isStraightCompiledWall(wall)) return null;
		const viewCentre = evaluation === null
			? null
			: wallUnfoldViewCentreStation(wall, evaluation.pose.target);
		return {
			wall,
			datumMeters: snapshot.domain.datumMeters,
			defaultStation: wallUnfoldAnchor({ wall, pinStation: viewCentre })
		};
	});

	// Seed once when the Wall is selected. The route, Card and pin all read the
	// remembered session station after this; selecting an Opening never re-seeds.
	$effect(() => {
		const candidate = selectedCurvedWall;
		if (candidate === null) return;
		wallUnfold.ensureAnchor(candidate.wall, candidate.defaultStation);
	});

	/** The idle pin drawn before Unroll; the active sheet draws its own copy. */
	const idleUnfoldPin = $derived.by(() => {
		if (wallUnfold.state !== null) return null;
		const candidate = selectedCurvedWall;
		if (candidate === null) return null;
		const station = wallUnfold.anchorForWall(candidate.wall) ?? candidate.defaultStation;
		const point = wallUnfoldTopPoint(candidate.wall, station, candidate.datumMeters);
		return point === null ? null : { wallId: candidate.wall.wallId, station, point };
	});

	/** The one pin context shared by hover, press and rendering. */
	function unfoldPinContext(stage: StageFacade): UnfoldPinContext | null {
		const state = wallUnfold.state;
		if (state !== null) {
			const snapshot = stage.snapshot();
			const wall = snapshot.domain.geometry.walls.find((candidate) => candidate.wallId === state.wallId);
			if (wall === undefined) return null;
			const point = wallUnfoldTopPoint(wall, state.anchorStation, snapshot.domain.datumMeters);
			return point === null
				? null
				: { wallId: wall.wallId, station: state.anchorStation, point, active: true };
		}
		const candidate = selectedCurvedWall;
		if (candidate === null) return null;
		const station = wallUnfold.anchorForWall(candidate.wall) ?? candidate.defaultStation;
		const point = wallUnfoldTopPoint(candidate.wall, station, candidate.datumMeters);
		return point === null ? null : { wallId: candidate.wall.wallId, station, point, active: false };
	}

	function beginSheetPin(event: PointerEvent, wallId: string, activeAtPress: boolean): boolean {
		// A failed capture still consumes the pin press: releasing it to navigation
		// or the canonical pick would make the same press mean two different things.
		if (stageEl === undefined || !capturePointer(stageEl, event.pointerId)) {
			press.refuse(event.pointerId);
			return true;
		}
		sheetPinDrag = {
			pointerId: event.pointerId,
			wallId,
			pressX: event.clientX,
			pressY: event.clientY,
			moved: false,
			activeAtPress
		};
		press.refuse(event.pointerId);
		return true;
	}

	/** The pin's Stage-local screen point, using the same canonical top point. */
	function unfoldedPinAt(
		css: readonly [number, number],
		coarse: boolean,
		stage: StageFacade
	): UnfoldPinHit | null {
		const projectionId = stage.evaluationId();
		if (projectionId === null) return null;
		const pin = unfoldPinContext(stage);
		if (pin === null) return null;
		const projected = stage.projectWorld(
			[pin.point[0], pin.point[1], pin.point[2]],
			projectionId
		);
		if (projected.kind !== 'projected') return null;
		// `projectWorld` is viewport CSS; `sample.css` and edge picks are local
		// to the Stage. Normalise here so hover and press agree on the handle.
		const current = rect ?? measure();
		const local: [number, number] = [projected.css[0] - current.left, projected.css[1] - current.top];
		const distance = Math.hypot(local[0] - css[0], local[1] - css[1]);
		const threshold = coarse ? WALL_UNFOLD_PIN_HIT_COARSE_CSS : WALL_UNFOLD_PIN_HIT_CSS;
		return distance <= threshold ? { css: local } : null;
	}

	/** Map a pointer sample onto the as-built centreline, for a pin drag. */
	function wallStationAtPointer(
		wall: CompiledPhysicalWall,
		datum: number,
		stage: StageFacade,
		event: PointerEvent
	): number | null {
		const projectionId = stage.evaluationId();
		if (projectionId === null || wall.samples.length < 2) return null;
		const height = datum + wall.height + 0.09;
		let nearest: number | null = null;
		let nearestDistance = Number.POSITIVE_INFINITY;
		for (let index = 0; index < wall.samples.length - 1; index += 1) {
			const from = wall.samples[index]!;
			const to = wall.samples[index + 1]!;
			const a = stage.projectWorld([from.point[0], height, from.point[1]], projectionId);
			const b = stage.projectWorld([to.point[0], height, to.point[1]], projectionId);
			if (a.kind !== 'projected' || b.kind !== 'projected') continue;
			const dx = b.css[0] - a.css[0];
			const dy = b.css[1] - a.css[1];
			const lengthSq = dx * dx + dy * dy;
			const t = lengthSq <= 1e-9
				? 0
				: Math.min(1, Math.max(0, ((event.clientX - a.css[0]) * dx + (event.clientY - a.css[1]) * dy) / lengthSq));
			const distance = Math.hypot(
				event.clientX - (a.css[0] + dx * t),
				event.clientY - (a.css[1] + dy * t)
			);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearest = from.distance + (to.distance - from.distance) * t;
			}
		}
		return nearest;
	}

	function unfoldedPointerPress(event: PointerEvent): boolean {
		const stage = facade;
		const state = wallUnfold.state;
		const current = evaluation;
		const layout = layoutPayload;
		if (stage === null || current === null || layout === null || task !== null) return false;
		if (state === null) {
			// Before Unroll the pin is the only developed-sheet gesture: it seeds the
			// anchor and never starts a peel.
			const pin = unfoldPinContext(stage);
			if (pin === null) return false;
			if (unfoldedPinAt(stageCss(event), event.pointerType !== 'mouse', stage) === null) return false;
			return beginSheetPin(event, pin.wallId, false);
		}
		const snapshot = stage.snapshot();
		const wall = snapshot.domain.geometry.walls.find((candidate) => candidate.wallId === state.wallId);
		if (wall === undefined) return false;
		const spans = wallUnfoldSourceSpans(layout, wall.wallId, wall.length);
		const preview = wallUnfold.previewOpening;
		const displayWall = preview?.wallId === wall.wallId ? {
			...wall,
			openings: wall.openings.map((opening) => opening.openingId === preview.openingId
				? { ...opening, offset: preview.offset, width: preview.width }
				: opening)
		} : wall;
		const display = buildWallUnfoldDisplay(displayWall, state, {
			floorY: snapshot.domain.datumMeters,
			spans,
			sideAngle: wallUnfold.presentationAngle
		});
		if (display === null) return false;
		// The sheet pick wins when the ray lands on the developed Wall. The free
		// edge is only a peel target when the pick is empty; otherwise a press on
		// an Opening or Wall near the edge would become an accidental refold.
		const ray = pointerRay([event.clientX, event.clientY], current, current.token);
		const pick = ray.kind === 'ray' ? pickWallUnfold(display, ray.ray) : null;
		if (pick === null) {
			// Peel starts on the free edge, using the same development map. The
			// candidates are a display solve, not a second geometry authority. A short
			// screen path falls back to the bounded vertical mapping in `sheetEdgeMove`.
			const candidates = sheetEdgeCandidates(display, state, wall, stage);
			if (candidates.length >= 2) {
				const threshold = event.pointerType === 'mouse' ? WALL_UNFOLD_EDGE_HIT_CSS : WALL_UNFOLD_EDGE_HIT_COARSE_CSS;
				let nearest: WallUnfoldEdgeCandidate | null = null;
				let nearestDistance = Number.POSITIVE_INFINITY;
				for (const candidate of candidates) {
					const distance = Math.hypot(candidate.css[0] - event.clientX, candidate.css[1] - event.clientY);
					if (distance < nearestDistance) {
						nearest = candidate;
						nearestDistance = distance;
					}
				}
				if (nearest !== null && nearestDistance <= threshold) {
					// The peel consumes the press even if capture fails, so the failure
					// cannot leave a half-started edge drag behind or fall through to a pick.
					if (stageEl === undefined || !capturePointer(stageEl, event.pointerId)) {
						press.refuse(event.pointerId);
						return true;
					}
					sheetEdgeDrag = {
						pointerId: event.pointerId,
						wallId: wall.wallId,
						pressY: event.clientY,
						startU: state.u,
						grabOffset: [event.clientX - nearest.css[0], event.clientY - nearest.css[1]],
						candidates
					};
					press.refuse(event.pointerId);
					return true;
				}
			}
		}
		// The pin is the next handle: press-and-release selects its Opening
		// (or the Wall on solid Wall); press-and-move slides the anchor along the
		// canonical centreline. It never moves the Camera or changes the face.
		const pin = unfoldPinContext(stage);
		if (pin !== null && unfoldedPinAt(stageCss(event), event.pointerType !== 'mouse', stage) !== null) {
			return beginSheetPin(event, wall.wallId, true);
		}
		if (ray.kind !== 'ray' || pick === null) return false;
		wallUnfold.recordPick(pick, event.pointerId);
		selectUnfoldedPick(wall.wallId, pick);
		// S5b — a press on an Opening void starts a canonical offset/width edit.
		// The jamb is chosen by the projected edge distance; the void's analytic
		// pick returns its centre, so edge proximity must be measured separately.
		const sourceOpening = pick.openingId === null ? undefined : layout.openings.find((opening) => opening.id === pick.openingId);
		const band = pick.openingId === null ? undefined : display.openingBands.find((candidate) => candidate.openingId === pick.openingId);
		if (sourceOpening !== undefined && band !== undefined && pick.openingId !== null) {
			// Measure each jamb at the height the pointer actually picked, not the
			// void's mid-height. On a tall Opening those are visibly different points.
			const height = snapshot.domain.datumMeters + Math.max(
				band.sillHeight,
				Math.min(band.headHeight, pick.height)
			);
			const projectionId = stage.evaluationId();
			const edgeAt = (station: number): number => {
				if (projectionId === null) return Infinity;
				// A station past a closed Wall's seam wraps to the drawn strip's other
				// end, where the crossing jamb is actually rendered; clamping would put
				// the hit test on the wrong side of the strip.
				const wrapped = display.development.closed
					? ((station % wall.length) + wall.length) % wall.length
					: station;
				const at = unfoldDisplayPointAtStation(display, wrapped, wallUnfold.presentationAngle);
				const projected = stage.projectWorld([at.point[0], height, at.point[1]], projectionId);
				return projected.kind === 'projected'
					? Math.hypot(projected.css[0] - event.clientX, projected.css[1] - event.clientY)
					: Infinity;
			};
			const mode = sheetOpeningModeFromEdges(edgeAt(band.stationStart), edgeAt(band.stationEnd));
			// A failed capture keeps the new Opening selection but installs no drag
			// preview, so there is no orphaned edit to strand the next press.
			if (stageEl !== undefined && capturePointer(stageEl, event.pointerId)) {
				sheetOpeningDrag = {
					pointerId: event.pointerId,
					wallId: wall.wallId,
					openingId: pick.openingId,
					mode,
					grabStation: mode === 'left' ? band.stationStart : mode === 'right' ? band.stationEnd : pick.station,
					startOffset: sourceOpening.offset,
					startWidth: sourceOpening.width,
					length: wall.length,
					closed: display.development.closed,
					pressX: event.clientX,
					pressY: event.clientY,
					moved: false,
					previewOffset: sourceOpening.offset,
					previewWidth: sourceOpening.width
				};
				wallUnfold.setOpeningPreview({ wallId: wall.wallId, openingId: pick.openingId, offset: sourceOpening.offset, width: sourceOpening.width });
			} else {
				sheetOpeningDrag = null;
				wallUnfold.setOpeningPreview(null);
			}
		}
		// The press is consumed: its release must not run the canonical Stage pick.
		press.refuse(event.pointerId);
		return true;
	}

	/** Sample the free edge across the peel range, then restore the live display. */
	function sheetEdgeCandidates(
		display: WallUnfoldDisplay | null,
		state: NonNullable<typeof wallUnfold.state>,
		wall: CompiledPhysicalWall,
		stage: StageFacade
	): WallUnfoldEdgeCandidate[] {
		if (display === null) return [];
		const projectionId = stage.evaluationId();
		if (projectionId === null) return [];
		const station = wallUnfoldFreeEdgeStation(state, wall.length);
		const candidates: WallUnfoldEdgeCandidate[] = [];
		for (let step = 0; step <= 40; step += 1) {
			const u = step / 40;
			evaluateWallUnfoldDisplay(display, { ...state, u }, wallUnfold.presentationAngle);
			const at = unfoldDisplayPointAtStation(display, station, wallUnfold.presentationAngle);
			const projected = stage.projectWorld(
				[at.point[0], display.floorY + display.height / 2, at.point[1]],
				projectionId
			);
			if (projected.kind === 'projected') {
				candidates.push({ u, css: [projected.css[0], projected.css[1]] });
			}
		}
		evaluateWallUnfoldDisplay(display, state, wallUnfold.presentationAngle);
		return candidates;
	}

	function sheetEdgeMove(event: PointerEvent): void {
		const active = sheetEdgeDrag;
		const state = wallUnfold.state;
		const stage = facade;
		if (active === null || active.pointerId !== event.pointerId || state === null || stage === null) return;
		const wall = stage.snapshot().domain.geometry.walls.find((candidate) => candidate.wallId === active.wallId);
		if (wall === undefined) return;
		const chosen = chooseUnfoldAmount({
			candidates: active.candidates,
			pointer: [event.clientX, event.clientY],
			currentU: state.u,
			grabOffset: active.grabOffset
		});
		const next = chosen ?? Math.min(
			1,
			Math.max(0, active.startU - (event.clientY - active.grabOffset[1] - active.pressY) / 260)
		);
		wallUnfold.setU(wall, next);
	}

	function finishSheetEdge(): void {
		const active = sheetEdgeDrag;
		const state = wallUnfold.state;
		const stage = facade;
		sheetEdgeDrag = null;
		if (active === null || state === null || stage === null) return;
		const wall = stage.snapshot().domain.geometry.walls.find((candidate) => candidate.wallId === active.wallId);
		if (wall !== undefined) wallUnfold.setU(wall, snapWallUnfoldAmount(state.u));
	}

	function cancelSheetEdge(): void {
		sheetEdgeDrag = null;
	}

	function sheetPinMove(event: PointerEvent): void {
		const active = sheetPinDrag;
		const stage = facade;
		if (active === null || active.pointerId !== event.pointerId || stage === null) return;
		if (!active.moved) {
			if (Math.hypot(event.clientX - active.pressX, event.clientY - active.pressY) < 3) return;
			active.moved = true;
			unfoldPinHovered = false;
		}
		const snapshot = stage.snapshot();
		const wall = snapshot.domain.geometry.walls.find((candidate) => candidate.wallId === active.wallId);
		if (wall === undefined) return;
		const station = wallStationAtPointer(wall, snapshot.domain.datumMeters, stage, event);
		if (station !== null) wallUnfold.setAnchor(wall, station);
	}

	function finishSheetPin(): void {
		const active = sheetPinDrag;
		sheetPinDrag = null;
		if (active === null) return;
		if (!active.moved && active.activeAtPress) selectUnfoldedSubject(active.wallId, wallUnfold.pinnedOpeningId);
		clearHover();
	}

	function cancelSheetPin(): void {
		sheetPinDrag = null;
	}

	function sheetOpeningMove(event: PointerEvent): void {
		const active = sheetOpeningDrag;
		const stage = facade;
		const current = evaluation;
		const layout = layoutPayload;
		const state = wallUnfold.state;
		if (active === null || active.pointerId !== event.pointerId || stage === null || current === null || layout === null || state === null) return;
		const snapshot = stage.snapshot();
		const wall = snapshot.domain.geometry.walls.find((candidate) => candidate.wallId === active.wallId);
		if (wall === undefined) return;
		const preview = wallUnfold.previewOpening;
		const displayWall = preview?.wallId === wall.wallId ? {
			...wall,
			openings: wall.openings.map((opening) => opening.openingId === preview.openingId
				? { ...opening, offset: preview.offset, width: preview.width }
				: opening)
		} : wall;
		const display = buildWallUnfoldDisplay(displayWall, state, {
			floorY: snapshot.domain.datumMeters,
			spans: wallUnfoldSourceSpans(layout, wall.wallId, wall.length),
			sideAngle: wallUnfold.presentationAngle
		});
		if (display === null) return;
		const ray = pointerRay([event.clientX, event.clientY], current, current.token);
		if (ray.kind !== 'ray') return;
		const pick = pickWallUnfold(display, ray.ray);
		if (pick === null) return;
		// A press without travel is a click, not an edit: leave the preview at the
		// canonical values so release commits nothing and the selection stands.
		if (!active.moved && Math.hypot(event.clientX - active.pressX, event.clientY - active.pressY) <= 3) return;
		active.moved = true;
		const edit = mapSheetOpeningDrag({
			mode: active.mode,
			startOffset: active.startOffset,
			startWidth: active.startWidth,
			grabStation: active.grabStation,
			pointerStation: pick.station,
			length: active.length,
			closed: active.closed
		});
		active.previewOffset = edit.offset;
		active.previewWidth = edit.width;
		wallUnfold.setOpeningPreview({ wallId: active.wallId, openingId: active.openingId, offset: edit.offset, width: edit.width });
	}

	async function finishSheetOpening(event: PointerEvent): Promise<void> {
		const active = sheetOpeningDrag;
		if (active === null || active.pointerId !== event.pointerId) return;
		sheetOpeningDrag = null;
		// An unmoved press selected the Opening at press time; it owes no edit.
		if (!active.moved) {
			wallUnfold.setOpeningPreview(null);
			return;
		}
		const services = adapterServices;
		const stage = facade;
		if (services === null || stage === null) { wallUnfold.setOpeningPreview(null); return; }
		const snapshot = stage.snapshot();
		// A jamb drag previews both fields. The left edge therefore commits through
		// the coupled resize planner (fixed right edge), not a width-only measure.
		const edge = active.mode === 'left' ? 'left' as const : 'right' as const;
		const value = edge === 'left'
			? active.previewOffset
			: active.previewOffset + active.previewWidth;
		const target = {
			version: 1 as const,
			domain: 'layout' as const,
			subject: { kind: 'opening' as const, id: active.openingId },
			revision: { kind: 'exact' as const, contentRevision: stageUnitRevision(snapshot, 'layout') },
			instancePath: [] as const,
			location: {
				kind: 'layout-location' as const,
				levelId: snapshot.domain.layoutLevelId,
				structureInstancePath: [] as const
			},
			componentId: null,
			capabilityId: null
		};
		const request = {
			operationId: globalThis.crypto.randomUUID(),
			projectId: snapshot.acceptedRevision.projectId,
			revisionId: services.authoring.acceptedRevision().revisionId,
			contentRevision: stageUnitRevision(snapshot, 'layout'),
			levelId: snapshot.domain.layoutLevelId,
			targets: [target]
		};
		const outcome = active.mode === 'slide'
			? await services.authoring.accept(buildLayoutIntent({
				...request,
				kind: LAYOUT_OPENING_MEASURE_KIND,
				payload: { openingId: active.openingId, field: 'offset', value: active.previewOffset }
			}))
			: await services.authoring.accept(buildLayoutIntent({
				...request,
				kind: LAYOUT_OPENING_RESIZE_KIND,
				payload: { openingId: active.openingId, kind: 'edge', edge, value }
			}));
		if (outcome.kind === 'refused') notice = outcome.message;
		wallUnfold.setOpeningPreview(null);
		stage.notifySurfaceChange();
	}

	function cancelSheetOpening(): void {
		if (sheetOpeningDrag === null) return;
		sheetOpeningDrag = null;
		wallUnfold.setOpeningPreview(null);
	}

	/** Select a developed pick through the same `StageFacade` selection as a canonical hit. */
	function selectUnfoldedPick(wallId: string, pick: WallUnfoldPick): void {
		selectUnfoldedSubject(wallId, pick.openingId);
	}

	function selectUnfoldedSubject(wallId: string, openingId: string | null): void {
		const stage = facade;
		if (stage === null) return;
		const sourceId = openingId ?? wallId;
		// Use the snapshot's resolved subject reference, exactly as `selectSource`
		// does. Constructing the reference here would re-state a revision the
		// resolver already owns and can disagree with the current qualification.
		const subject = stage.subjects().find((candidate) => candidate.id === sourceId);
		if (subject !== undefined) {
			const change = stage.setSelection({ ordered: [{ reference: subject.reference }], primary: subject.reference });
			if (change.kind === 'selected') {
				selection = primaryEntry(stage.selectionState());
				experienceFocus.select(null);
				cardOpen = true;
				return;
			}
		}
		// A compiled Wall/Opening can be present in the Plan while its resolved
		// subject is not contributed to the Index. `selectSource` already handles
		// that case from the Plan fragment; the unfolded pick uses the same fallback.
		const fragment = planView === null ? undefined : planFragmentOf(planView, sourceId);
		if (fragment === undefined) return;
		stage.select({
			sourceId: fragment.ref.sourceId,
			sourceKind: fragment.ref.sourceKind,
			generationId: fragment.ref.generationId,
			ref: fragment.ref
		});
		selection = primaryEntry(stage.selectionState());
		experienceFocus.select(null);
		cardOpen = true;
	}

	function selectSource(sourceId: string): void {
		const stage = facade;
		const plan = planView;
		if (stage === null || plan === null) return;
		cardOpen = true;
		const subject = stage.subjects().find((item) => item.id === sourceId);
		if (subject !== undefined) {
			stage.setSelection({ ordered: [{ reference: subject.reference }], primary: subject.reference });
			selection = primaryEntry(stage.selectionState());
			experienceFocus.select(null);
			return;
		}
		const layoutId = sourceId.startsWith('layout:') ? sourceId.slice(sourceId.indexOf(':', 7) + 1) : sourceId;
		const fragment = planFragmentOf(plan, layoutId);
		if (fragment === undefined) return;
		stage.select({
			sourceId: layoutId,
			sourceKind: fragment.ref.sourceKind,
			generationId: fragment.ref.generationId,
			ref: fragment.ref
		});
		selection = primaryEntry(stage.selectionState());
		experienceFocus.select(null);
	}

	/**
	 * Keep the instrument home's mirror of the facade's contributed task in step.
	 *
	 * The facade owns the task and its instrument content: an adapter can reopen its
	 * own persistent task after an accepted install closed it, so this host cannot
	 * rely on its own invocation alone. `instrumentForTask` carries the facade-side
	 * owner check, so probing the contributed entries re-identifies the one live
	 * task — and yields the very content the home renders. A parked (inactive) task
	 * keeps whatever mirror it had, as before.
	 */
	function syncContributedTask(): void {
		const stage = facade;
		if (stage === null) return;
		const lifecycle = stage.session.taskLifecycle();
		if (lifecycle === null) {
			contributedTaskId = null;
			rearmDockTool();
			return;
		}
		if (lifecycle.status !== 'active') return;
		const current = contributedTaskId;
		if (current !== null && stage.instrumentForTask(current.id, current.adapterId) !== null) return;
		for (const entry of stage.tasks()) {
			if (stage.instrumentForTask(entry.id, entry.adapterId) !== null) {
				contributedTaskId = { id: entry.id, adapterId: entry.adapterId };
				return;
			}
		}
		contributedTaskId = null;
	}

	/**
	 * Invoke a contributed operation. The facade owns the task and its instrument
	 * content; this host only mirrors them into the one instrument home, so a new
	 * domain adapter needs no change here.
	 */
	function invokeContribution(adapterId: string, id: string, revealInstrument = true): void {
		const stage = facade;
		if (stage === null) return;
		// Opening any other contributed operation takes the lower column: put the
		// dock tool down first, or a completion that closes this task would re-arm a
		// tool the creator had already left (the only re-arm is the armed tool's own).
		const keepsArmedTool =
			armedTool !== null && armedTool.id === id && armedTool.adapterId === adapterId;
		if (!keepsArmedTool) armedTool = null;
		const opened = stage.openFindEntry(adapterId, id);
		if (opened.kind !== 'opened') {
			notice = opened.message;
			return;
		}
		task = opened.task;
		if (revealInstrument) paletteOpen = true;
		contributedTaskId = { id: opened.taskId, adapterId: opened.adapterId };
	}

	function closeTask(): void {
		// Disarm **before** closing: the close notifies the contribution surface, and a
		// notification re-arms an armed dock tool. An explicit close puts the tool down
		// first, so the notification it causes cannot pick it back up.
		armedTool = null;
		measureTool?.clear();
		eraserTool?.clear();
		eraseHover = null;
		hostToolOverlay = null;
		facade?.closeTask();
		task = null;
		contributedTaskId = null;
		// The Card's fold is reconsidered for the next task: a hand expansion belongs
		// to the work it was made for, not to the shell forever.
	}

	function toggleReveal(sourceId: string): void {
		revealed = revealed.includes(sourceId)
			? revealed.filter((id) => id !== sourceId)
			: [...revealed, sourceId];
	}

	/* --- pointer and keyboard ---------------------------------------------- */

	let drag = $state<{ x: number; y: number; mode: 'pan' | 'orbit' | 'adapter' | 'host' } | null>(null);
	/** S5b — one canonical Opening edit on the developed sheet. */
	type SheetOpeningDrag = {
		readonly pointerId: number;
		readonly wallId: string;
		readonly openingId: string;
		readonly mode: SheetOpeningMode;
		readonly grabStation: number;
		readonly startOffset: number;
		readonly startWidth: number;
		readonly length: number;
		readonly closed: boolean;
		readonly pressX: number;
		readonly pressY: number;
		moved: boolean;
		previewOffset: number;
		previewWidth: number;
	};
	let sheetOpeningDrag = $state<SheetOpeningDrag | null>(null);
	/** The free-edge peel: a display-only drag that scrubs the same session amount. */
	type SheetEdgeDrag = {
		readonly pointerId: number;
		readonly wallId: string;
		readonly pressY: number;
		readonly startU: number;
		/** Pointer minus the grabbed edge point at press, so the edge does not jump. */
		readonly grabOffset: readonly [number, number];
		readonly candidates: readonly WallUnfoldEdgeCandidate[];
	};
	let sheetEdgeDrag = $state<SheetEdgeDrag | null>(null);
	/** The pin drag: a click selects its Opening; movement slides the anchor. */
	type SheetPinDrag = {
		readonly pointerId: number;
		readonly wallId: string;
		readonly pressX: number;
		readonly pressY: number;
		moved: boolean;
		/** Only a press on the live sheet pin may select on release. */
		readonly activeAtPress: boolean;
	};
	let sheetPinDrag = $state<SheetPinDrag | null>(null);
	let unfoldPinHovered = $state(false);
	/** R217.S15 — this press began on an edit mark, so its tap is a command. */
	let adapterMarkPress = false;
	/** A dragging disclosure's press: a release within click tolerance toggles it. */
	let disclosurePress: { readonly id: string; readonly x: number; readonly y: number } | null = null;
	/**
	 * The evaluation a claimed adapter press was measured in.
	 *
	 * The Camera raises a new evaluation generation every frame, so reading
	 * `evaluationId()` again on each move would tell the adapter its projection had
	 * changed on every sample: a drag would pause on its first move and a release
	 * would look stale, making direct manipulation unreachable. `StagePointerIntent`
	 * names *the evaluation the press was measured in*, so this one value is carried
	 * from the claimed down through every later phase of that press and cleared with
	 * it. A genuine reading change still ends the drag through the gesture lease's
	 * `cancel-on-reading-change` policy.
	 */
	let adapterEvaluationId: string | null = null;
	let pinch: Map<number, [number, number]> | null = null;
	let hoverFrame: number | null = null;
	let hoverSample: { css: [number, number]; shift: boolean; coarse: boolean;
	} | null = null;
	/**
	 * The drag-versus-click decision. It is **not** the gesture: pointer up ends the
	 * gesture, but the click that follows still has to know how far the pointer
	 * travelled, and an interruption has to stop that click from selecting. It also
	 * owns which pointer the press belongs to, including cancellation before a
	 * two-pointer navigation handoff.
	 */
	const press = createStagePressTracker();

	/**
	 * CSS pixels relative to the Stage surface, the space adapter pointer intents
	 * use. This reads the one accepted rect (`measure()`), never a second DOM
	 * measurement: the drawn image, the ray and the adapter intent must share a
	 * coordinate space.
	 */
	function stageCss(event: PointerEvent): [number, number] {
		const current = rect ?? measure();
		return [event.clientX - current.left, event.clientY - current.top];
	}

	/** Camera's pointerRay consumes absolute viewport CSS. */
	/** Capture a pointer, reporting failure instead of throwing: `setPointerCapture`
	 * throws NotFoundError for a pointer that has already ended, and every caller must
	 * then roll back whatever lease, press or session it claimed before capturing. */
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

	function onPointerDown(event: PointerEvent): void {
		const stage = facade;
		if (stage === null || evaluation === null) return;
		clearHover();
		const firstId = press.owner();
		if (firstId !== null && firstId !== event.pointerId && drag !== null) {
			if (activeLayer?.pinch(event) === 'claimed') return;
			const first: [number, number] = [drag.x, drag.y];
			interruptPress('second-pointer');
			press.refuse(firstId); press.refuse(event.pointerId);
			const acquisition = stage.acquireGesture({ owner: 'stage-pinch', evaluationId: stage.evaluationId() ?? '', policy: 'continue-after-revalidation', navigation: true });
			if (acquisition.kind === 'granted') {
				pinch = new Map([[firstId, first], [event.pointerId, [event.clientX, event.clientY]]]);
				const surface = event.currentTarget as HTMLElement;
				try { surface.setPointerCapture(event.pointerId); } catch { /* A pointer may already have ended. */ }
			} else if (stageEl?.hasPointerCapture?.(firstId)) stageEl.releasePointerCapture(firstId);
			return;
		}
		if (pinch !== null) { press.refuse(event.pointerId); return; }
		// Primary, unmodified presses address the developed sheet while a Wall is
		// unfolded. Shift/secondary presses stay navigation, which is how the
		// creator can still orbit the sheet.
		if (event.button === 0 && !event.shiftKey && unfoldedPointerPress(event)) return;
		if (activeLayer?.pointerDown(event, viewMarkAt(event)) === 'claimed') return;
		// The adapters get the press first: the binding that owns an open task (a Scene
		// transform, an armed Ink chain) may claim it, and so may a binding that offers
		// direct manipulation with no task at all (a selected Wall's handles). Only a
		// refusal falls through to navigation.
		const pointerEvaluationId = stage.evaluationId();
		if (pointerEvaluationId !== null) {
			const css = stageCss(event);
			const coarse = event.pointerType !== 'mouse';
			// R217.S10: an armed host tool asks every declaring domain for its winner. A
			// press that names nothing to measure or erase stays the host's navigation.
			const hostTool = armedHostTool === 'measure' ? measureTool : armedHostTool === 'erase' ? eraserTool : null;
			if (hostTool !== null) {
				const claimed = hostTool.down({ css, evaluationId: pointerEvaluationId, coarse });
				refreshHostTools();
				if (claimed) {
					if (!capturePointer(event.currentTarget as HTMLElement, event.pointerId)) {
						hostTool.cancel();
						refreshHostTools();
						return;
					}
					if (press.begin({ x: event.clientX, y: event.clientY }, event.pointerId) === 'refused') {
						hostTool.cancel();
						refreshHostTools();
						return;
					}
					adapterEvaluationId = pointerEvaluationId;
					drag = { x: event.clientX, y: event.clientY, mode: 'host' };
					return;
				}
			}
			const mark = stage.hitMark({ css, coarse });
			// A disclosure is a press, not a drag: it reveals grips while the same
			// gesture context stays selected, and no adapter may claim the pointer for it.
			if (mark?.role === 'disclose' && mark.mark.drags !== true) {
				press.refuse(event.pointerId);
				if (stage.activateDisclosure(mark.id)) stage.notifySurfaceChange();
				return;
			}
			const claimAdapterPress = (handleId?: string, handleAdapterId?: string): boolean => {
				if (!stage.pointerIntent({
					phase: 'down',
					css,
					evaluationId: pointerEvaluationId,
					shift: event.shiftKey,
					metaKey: event.metaKey,
					ctrlKey: event.ctrlKey,
					coarse,
					...(handleId === undefined ? {} : { handleId }),
					...(handleAdapterId === undefined ? {} : { handleAdapterId })
				}).claimed) return false;
				if (
					!capturePointer(event.currentTarget as HTMLElement, event.pointerId) ||
					press.begin({ x: event.clientX, y: event.clientY }, event.pointerId) === 'refused'
				) {
					stage.pointerIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
					return true;
				}
				adapterEvaluationId = pointerEvaluationId;
				adapterMarkPress = handleId !== undefined;
				drag = { x: event.clientX, y: event.clientY, mode: 'adapter' };
				return true;
			};
			if (mark?.role === 'disclose') {
				// The W·D·H chip: the adapter owns the press so a drag scales; a
				// release inside click tolerance still toggles the grips.
				stage.idleHoverIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
				if (claimAdapterPress(mark.id, mark.adapterId)) {
					disclosurePress = { id: mark.id, x: event.clientX, y: event.clientY };
					return;
				}
				press.refuse(event.pointerId);
				if (stage.activateDisclosure(mark.id)) stage.notifySurfaceChange();
				return;
			}
			if (mark?.role === 'edit') {
				stage.idleHoverIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
				if (claimAdapterPress(mark.id, mark.adapterId)) return;
			} else {
				// Hit priority: a selected subject body gets the press before an idle
				// Junction can offer its overlapping point mark.
				if (claimAdapterPress()) {
					stage.idleHoverIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
					return;
				}
				if (mark === null) {
					const idleMark = stage.idleHoverIntent({ phase: 'move', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
					if (idleMark?.role === 'edit' && claimAdapterPress(idleMark.id, idleMark.adapterId)) return;
				} else {
					stage.idleHoverIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey, coarse });
				}
			}
		}
		// A gesture is one captured writer with an explicit transition policy; a
		// replacement cancels it exactly once. Navigation cannot steal the lease, so a
		// refused acquisition means this press does not move the view at all — the
		// capture is taken only once the lease is actually ours.
		const acquisition = stage.acquireGesture({
			owner: 'stage-pointer',
			evaluationId: stage.evaluationId() ?? '',
			policy: 'continue-after-revalidation',
			// The host's own press is navigation, not authored work: it explicitly
			// declares so, which is why a pan never blocks Undo.
			navigation: true
		});
		if (acquisition.kind !== 'granted') {
			// This pointer is not ours: record it so its click cannot select, and leave the
			// holder's press and lease untouched.
			press.refuse(event.pointerId);
			notice = `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`;
			return;
		}
		// A capture that throws (the pointer already ended) must hand the lease back,
		// or every later gesture is refused against a press that no longer exists.
		if (
			!capturePointer(event.currentTarget as HTMLElement, event.pointerId) ||
			press.begin({ x: event.clientX, y: event.clientY }, event.pointerId) === 'refused'
		) {
			// Defensive: the lease said yes but the tracker already has a live press.
			session.gesture()?.release();
			return;
		}
		drag = { x: event.clientX, y: event.clientY, mode: event.button === 0 && !event.shiftKey ? 'pan' : 'orbit' };
	}

	function clearHover(): void {
		if (hoverFrame !== null) cancelAnimationFrame(hoverFrame);
		hoverFrame = null;
		hoverSample = null;
		unfoldPinHovered = false;
		facade?.setMarkHover(null);
		stageCursor = null;
		session.setHover(null);
		hoverSelection = null;
		hoverMove = false;
		if (drag?.mode !== 'host') {
			measureTool?.hover(null);
			eraserTool?.hover(null);
			eraseHover = null;
		}
	}

	function resolveHover(): void {
		hoverFrame = null;
		const sample = hoverSample;
		hoverSample = null;
		const stage = facade;
		const id = stage?.evaluationId() ?? null;
		if (sample === null || stage === null || id === null || session.gesture() !== null || drag !== null) return;
		stageCursor = null;
		// An armed host tool previews its own winner (the Eraser's dashes, Measure's
		// second point); the ordinary subject hover would compete with it.
		if (armedHostTool !== null) {
			stage.idleHoverIntent({ phase: 'cancel', css: sample.css, evaluationId: id, coarse: sample.coarse, shift: sample.shift });
			const input = { css: sample.css, evaluationId: id, coarse: sample.coarse };
			if (armedHostTool === 'measure') measureTool?.hover(input);
			else eraserTool?.hover(input);
			session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			refreshHostTools();
			return;
		}
		// The pin is the sheet's one display handle. It sits above the sheet pick
		// so a tap can select its Opening and a drag can move the anchor without
		// selecting the Wall body underneath.
		if (unfoldedPinAt(sample.css, sample.coarse, stage) !== null) {
			stage.idleHoverIntent({ phase: 'cancel', css: sample.css, evaluationId: id, coarse: sample.coarse, shift: sample.shift });
			stage.setMarkHover(null);
			session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			unfoldPinHovered = true;
			stageCursor = 'grab';
			return;
		}
		unfoldPinHovered = false;
		// The mark tier is above world candidates: a hovered grip suppresses the
		// subject tint underneath, so two emphases never compete for one pointer.
		const mark = stage.hitMark({ css: sample.css, coarse: sample.coarse });
		if (mark !== null) {
			stage.idleHoverIntent({ phase: 'cancel', css: sample.css, evaluationId: id, coarse: sample.coarse, shift: sample.shift });
			stage.setMarkHover({ adapterId: mark.adapterId, id: mark.id });
			stageCursor = mark.mark.resizeCursor === undefined
				? null
				: stageResizeCursorCss(mark.mark.resizeCursor, mark.mark.direction);
			session.setHover(null);
			hoverSelection = null;
			// R217.S15 — a selected Wall's own grips are draggable; every other
			// mark (an Opening's track, a disclosure) is not a body move.
			const primary = primaryEntry(stage.selectionState());
			hoverMove =
				primary !== null &&
				primary.reference.domain === 'layout' &&
				primary.reference.subject.kind === 'wall' &&
				mark.adapterId === 'layout' &&
				mark.id.startsWith('layout-wall-') &&
				mark.id !== 'layout-wall-preview';
			return;
		}
		stage.setMarkHover(null);
		stageCursor = null;
		const idleMark = stage.idleHoverIntent({ phase: 'move', css: sample.css, evaluationId: id, coarse: sample.coarse, shift: sample.shift });
		if (idleMark !== null) {
			stage.setMarkHover({ adapterId: idleMark.adapterId, id: idleMark.id });
			session.setHover(null);
			hoverSelection = null;
			hoverMove = true;
			return;
		}
		stage.idleHoverIntent({ phase: 'cancel', css: sample.css, evaluationId: id, coarse: sample.coarse, shift: sample.shift });
		if (stage.hoverIntent({ phase: 'move', css: sample.css, evaluationId: id, shift: sample.shift })) {
			session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			return;
		}
		const result = stage.resolvePick({ css: sample.css, evaluationId: id, purpose: 'hover', tool: null });
		if (result.kind !== 'resolved') {
			session.setHover(null);
			hoverSelection = null;
			hoverMove = false;
			return;
		}
		const hit = result.hit;
		const representation = hit.reference === undefined
			? { sourceId: hit.sourceId, sourceKind: hit.sourceKind, generationId: hit.generationId, stream: hit.stream, subRef: hit.subRef }
			: undefined;
		const reference = hit.reference ?? layoutSelectionReference(representation!, stage.snapshot());
		session.setHover({ reference });
		const primary = primaryEntry(stage.selectionState());
		// R217.S15 — the pick winner is the selected Wall itself, so a press here
		// would be claimed as its body drag. Select keeps the host Wall first until
		// S16 makes an Opening over it its own winner.
		hoverMove =
			primary !== null &&
			primary.reference.domain === 'layout' &&
			primary.reference.subject.kind === 'wall' &&
			hit.sourceKind === 'wall' &&
			hit.sourceId === primary.reference.subject.id;
		const nextHover =
			primary !== null && sameReference(primary.reference, reference)
				? null
				: representation === undefined
					? { reference }
					: { reference, representation };
		// Identity, not object identity: a pointer moving within one subject must not
		// rebuild the Stage's ink every frame.
		if (nextHover === null) hoverSelection = null;
		else if (hoverSelection === null || !sameReference(hoverSelection.reference, nextHover.reference)) hoverSelection = nextHover;
	}

	function onPointerMove(event: PointerEvent): void {
		if (artworkResize?.pointerId === event.pointerId) {
			artworkResizeGhost = readArtworkResize(event);
			return;
		}
		if (artwork.armed && event.buttons === 0) artwork.move(artworkPoseAt(event));
		if (sheetPinDrag !== null) {
			if (event.pointerId === sheetPinDrag.pointerId) sheetPinMove(event);
			return;
		}
		if (sheetEdgeDrag !== null) {
			if (event.pointerId === sheetEdgeDrag.pointerId) sheetEdgeMove(event);
			return;
		}
		if (sheetOpeningDrag !== null) {
			if (event.pointerId === sheetOpeningDrag.pointerId) sheetOpeningMove(event);
			return;
		}
		if (pinch !== null) {
			if (!pinch.has(event.pointerId)) return;
			if (session.gesture() === null) { endPinch(); return; }
			const before = [...pinch.values()];
			pinch.set(event.pointerId, [event.clientX, event.clientY]);
			const after = [...pinch.values()];
			const oldDistance = Math.hypot(before[0]![0] - before[1]![0], before[0]![1] - before[1]![1]);
			const newDistance = Math.hypot(after[0]![0] - after[1]![0], after[0]![1] - after[1]![1]);
			pan((after[0]![0] + after[1]![0] - before[0]![0] - before[1]![0]) / 2, (after[0]![1] + after[1]![1] - before[0]![1] - before[1]![1]) / 2);
			if (oldDistance > 0 && newDistance > 0) zoom(oldDistance / newDistance);
			return;
		}
		if (activeLayer?.pointerMove(event) === 'claimed') return;
		if (drag === null) {
			if (event.pointerType === 'touch' || session.gesture() !== null) { clearHover(); return; }
			hoverSample = { css: stageCss(event), shift: event.shiftKey, coarse: event.pointerType !== 'mouse' };
			if (hoverFrame === null) hoverFrame = requestAnimationFrame(resolveHover);
			return;
		}
		if (drag.mode === 'host') {
			if (!press.ownsPointer(event.pointerId)) return;
			if (session.gesture() === null) {
				interruptPress('reading-change');
				return;
			}
			const id = facade?.evaluationId() ?? null;
			if (id === null) return;
			const input = { css: stageCss(event), evaluationId: id, coarse: event.pointerType !== 'mouse' };
			if (armedHostTool === 'measure') measureTool?.move(input);
			else eraserTool?.move(input);
			drag = { x: event.clientX, y: event.clientY, mode: 'host' };
			refreshHostTools();
			return;
		}
		if (drag.mode === 'adapter') {
			if (!press.ownsPointer(event.pointerId)) return;
			// A reading change cancels the adapter's gesture lease before the next
			// frame. The pointer mapping was measured in the old projection, so the
			// press ends instead of dragging a proposal through a view it was never
			// measured in.
			if (session.gesture() === null) {
				interruptPress('reading-change');
				return;
			}
			const stage = facade;
			const id = adapterEvaluationId ?? stage?.evaluationId() ?? null;
			if (stage === null || id === null) return;
			// T3.P03.S02: one monotonic sequence per continuous input sample. The
			// adapter's preview installation and the accepted result inherit it.
			if (perfMarksEnabled()) perfInput('pointermove', { wallMode: true, eventTimeStamp: event.timeStamp, timeOrigin: performance.timeOrigin });
			stage.pointerIntent({ phase: 'move', css: stageCss(event), evaluationId: id, shift: event.shiftKey, metaKey: event.metaKey, ctrlKey: event.ctrlKey, coarse: event.pointerType !== 'mouse' });
			drag = { x: event.clientX, y: event.clientY, mode: 'adapter' };
			return;
		}
		// Movement is the one thing a refused pointer still produces. Its samples are at
		// its own position, not the owner's, so taking them would pan by the distance
		// between two fingers — the camera would jump while the owner held the gesture.
		if (!press.ownsPointer(event.pointerId)) return;
		// The lease can end underneath us (a cancel-on-reading-change policy, a task
		// exit, an adapter taking the pointer). Samples taken under a lease we no
		// longer hold must not keep moving the view.
		if (session.gesture() === null) {
			abortGesture();
			return;
		}
		const dx = event.clientX - drag.x;
		const dy = event.clientY - drag.y;
		drag = { x: event.clientX, y: event.clientY, mode: drag.mode };
		if (drag.mode === 'orbit') orbit(-dx * 0.01, dy * 0.01);
		else pan(dx, dy);
	}

	/**
	 * End the live gesture exactly once.
	 *
	 * Release is idempotent, so every ending can call this without a second cancel of
	 * a lease that was already ended by the host’s own policy run. It ends the
	 * **gesture** only: a normal pointer up still owes the following click its
	 * drag-versus-click decision, which is why the press tracker is not touched here.
	 */
	function endPinch(): void {
		const ending = pinch;
		pinch = null;
		if (ending === null) return;
		for (const id of ending.keys()) {
			press.refuse(id);
			if (stageEl?.hasPointerCapture?.(id)) stageEl.releasePointerCapture(id);
		}
		session.gesture()?.release();
	}

	function endGesture(): void {
		drag = null;
		adapterEvaluationId = null;
		adapterMarkPress = false;
		disclosurePress = null;
		session.gesture()?.release();
	}

	/**
	 * End the gesture **and** refuse the click that may still arrive.
	 *
	 * Pointer cancel, a capture lost while the pointer is down, Escape and a policy
	 * cancel all mean the creator did not finish this press, so nothing it would
	 * select is theirs to select.
	 */
	function abortGesture(): void {
		press.abort();
		endPinch();
		endGesture();
	}

	function onPointerUp(event: PointerEvent): void {
		if (artworkResize?.pointerId === event.pointerId) { void finishArtworkResize(event); return; }
		if (sheetPinDrag !== null && event.pointerId === sheetPinDrag.pointerId) {
			finishSheetPin();
			return;
		}
		if (sheetEdgeDrag !== null && event.pointerId === sheetEdgeDrag.pointerId) {
			finishSheetEdge();
			return;
		}
		if (sheetOpeningDrag !== null && event.pointerId === sheetOpeningDrag.pointerId) {
			void finishSheetOpening(event);
			return;
		}
		if (activeLayer?.pointerUp(event) === 'claimed') return;
		if (pinch?.has(event.pointerId)) { endPinch(); return; }
		// A normal ending: the click that follows decides by distance, so the press is
		// ended, not aborted. Only the owning pointer may end it — a refused second
		// pointer's release must not release the first pointer's lease.
		if (!press.end(event.pointerId)) return;
		if (drag?.mode === 'host') {
			// The host tool's tap is its own command, never a selection.
			press.claim(event.pointerId);
			// Host tools resolve against the current image on every sample. Unlike a
			// domain writer, they do not carry a press-time projection into a planner.
			const id = facade?.evaluationId() ?? null;
			drag = null;
			adapterEvaluationId = null;
			const tool = armedHostTool === 'measure' ? measureTool : eraserTool;
			if (tool === null) return;
			if (session.gesture() === null || id === null) {
				tool.cancel();
				refreshHostTools();
				return;
			}
			const input = { css: stageCss(event), evaluationId: id, coarse: event.pointerType !== 'mouse' };
			void Promise.resolve(tool.up(input)).then(() => refreshHostTools());
			refreshHostTools();
			return;
		}
		if (drag?.mode === 'adapter') {
			// A task's tap is its own command (place a point, split a Wall, or a
			// refusal) and never a selection, so it claims the click. Direct
			// manipulation with no task is different: a release within tolerance
			// produces no request, so the ordinary click still runs and keeps the
			// selection; a real drag is longer than the click tolerance and the
			// click's own distance check discards it.
			if (task !== null || adapterMarkPress) press.claim(event.pointerId);
			const stage = facade;
			const id = adapterEvaluationId ?? stage?.evaluationId() ?? null;
			const chip = disclosurePress;
			drag = null;
			adapterEvaluationId = null;
			adapterMarkPress = false;
			disclosurePress = null;
			if (stage !== null && id !== null) {
				// After a reading change the lease is already gone: the press is cancelled
				// rather than released, so no stale projection commits.
				const phase = session.gesture() === null ? 'cancel' : 'up';
				perfMark('input:release', { phase });
				stage.pointerIntent({ phase, css: stageCss(event), evaluationId: id, shift: event.shiftKey, metaKey: event.metaKey, ctrlKey: event.ctrlKey, coarse: event.pointerType !== 'mouse' });
				if (
					chip !== null &&
					phase === 'up' &&
					!isStageDrag(chip, { x: event.clientX, y: event.clientY }) &&
					stage.activateDisclosure(chip.id)
				) stage.notifySurfaceChange();
			}
			return;
		}
		endGesture();
	}

	/** End the captured press without ending an independent multi-step proposal. */
	function interruptPress(reason: StageInterruptionReason): void {
		if (sheetPinDrag !== null) {
			cancelSheetPin();
			clearHover();
			return;
		}
		if (sheetEdgeDrag !== null) {
			cancelSheetEdge();
			clearHover();
			return;
		}
		if (sheetOpeningDrag !== null) {
			cancelSheetOpening();
			clearHover();
			return;
		}
		if (activeLayer?.interrupt?.() === 'claimed') return;
		if (pinch !== null) { endPinch(); clearHover(); return; }
		const pointerId = press.owner();
		if (pointerId === null || drag === null) { clearHover(); return; }
		perfMark('input:interruption', { reason });
		if (drag.mode === 'adapter') {
			const id = adapterEvaluationId ?? facade?.evaluationId() ?? null;
			const css: [number, number] = [drag.x - (rect?.left ?? 0), drag.y - (rect?.top ?? 0)];
			if (id !== null) facade?.pointerIntent({ phase: 'cancel', css, evaluationId: id });
		}
		if (drag.mode === 'host') {
			measureTool?.cancel();
			eraserTool?.cancel();
			refreshHostTools();
		}
		abortGesture();
		clearHover();
		if (reason !== 'second-pointer' && stageEl?.hasPointerCapture?.(pointerId)) stageEl.releasePointerCapture(pointerId);
	}

	function onPointerCancel(event: PointerEvent): void {
		if (artworkResize?.pointerId === event.pointerId) { cancelArtworkResize(); return; }
		if (sheetPinDrag !== null && event.pointerId === sheetPinDrag.pointerId) {
			cancelSheetPin();
			clearHover();
			return;
		}
		if (sheetEdgeDrag !== null && event.pointerId === sheetEdgeDrag.pointerId) {
			cancelSheetEdge();
			return;
		}
		if (sheetOpeningDrag !== null && event.pointerId === sheetOpeningDrag.pointerId) {
			cancelSheetOpening();
			return;
		}
		if (activeLayer?.pointerCancel(event) === 'claimed') return;
		if (pinch?.has(event.pointerId) || press.ownsPointer(event.pointerId)) interruptPress('pointercancel');
	}

	function onLostPointerCapture(event: PointerEvent): void {
		if (artworkResize?.pointerId === event.pointerId) { cancelArtworkResize(); return; }
		if (sheetPinDrag !== null && event.pointerId === sheetPinDrag.pointerId) {
			cancelSheetPin();
			clearHover();
			return;
		}
		if (sheetEdgeDrag !== null && event.pointerId === sheetEdgeDrag.pointerId) {
			cancelSheetEdge();
			return;
		}
		if (sheetOpeningDrag !== null && event.pointerId === sheetOpeningDrag.pointerId) {
			cancelSheetOpening();
			return;
		}
		if (activeLayer?.lostCapture(event) === 'claimed') return;
		if (pinch?.has(event.pointerId) || (press.ownsPointer(event.pointerId) && drag !== null)) interruptPress('lostpointercapture');
	}

	/** A click's pointer id, when the event carries one (a `PointerEvent` click does). */
	function pointerIdOf(event: MouseEvent): number | null {
		const candidate = (event as MouseEvent & { readonly pointerId?: unknown }).pointerId;
		return typeof candidate === 'number' ? candidate : null;
	}

	function onClick(event: MouseEvent): void {
		// A pan or orbit drag ends with a click too; it moved the view, so it must not
		// also select (or report that nothing was selectable). The decision is consumed
		// here, after the pointer sequence has ended, and only by the pointer it belongs to.
		if (!press.decide({ x: event.clientX, y: event.clientY }, pointerIdOf(event))) return;
		// The unfolded display is the addressed surface. A click that missed it must
		// not select the canonical Wall/Opening drawn behind the sheet (and so must
		// not disagree with the pointer pick); an empty click stays non-selecting.
		if (wallUnfold.state !== null) return;
		if (artwork.armed) {
			if (evaluation?.renderedReading !== '3d') notice = 'Switch to 3D to place Artwork.';
			else void artwork.place(artworkPoseAt(event));
			return;
		}
		// A frustum's captured release also dispatches a click. Its View owns that
		// click just as it owned the press; picking the floor here clears the Card.
		// A View glyph, Look through or placement owns the release; it must not pick the Floor.
		if (activeLayer?.click(event, viewMarkAt(event) !== null) === 'claimed') return;
		// An **armed dock tool** owns the Stage surface: its tap already placed a
		// point, split a Wall or was refused, and re-selecting underneath it would
		// silently move what the tool is editing. Another adapter's task (Compose,
		// Import) does not: clicking the Stage stays the host's own Select,
		// which those tasks already depend on to reach their subject.
		if (task !== null && armedTool !== null) return;
		const stage = facade;
		const id = stage?.evaluationId() ?? null;
		if (stage === null || id === null || rect === null) return;
		const css: [number, number] = [event.clientX - rect.left, event.clientY - rect.top];
		const hit = stage.resolveSourceHit({ evaluationId: id, css });
		if (hit.kind === 'resolved') {
			selectHit(hit.hit);
			notice = '';
			return;
		}
		if (hit.kind === 'none') {
			// The Plan places no fragment for an excluded source, so a miss cannot say
			// which subject the creator meant. Exclusion reasons and Reveal live on the
			// Index, and this notice points there without pretending to localize. An
			// ordinary empty click says nothing (R217.S22, D42).
			if (planView !== null && planView.membership.some((row) => !row.eligible)) {
				notice = 'Nothing selectable there — some subjects are excluded from this Plan; Reveal one from the Index.';
			}
			return;
		}
		notice = 'That click did not land on the Plan.';
	}

	function onWheel(event: WheelEvent): void {
		event.preventDefault();
		if (activeLayer?.wheel(event, evaluation?.rect.height ?? 1) === 'claimed') return;
		zoom(Math.exp(event.deltaY * 0.001));
	}

	function handleKey(event: KeyboardEvent): void {
		if (event.key === 'Escape' && artworkResize !== null) {
			cancelArtworkResize();
			event.preventDefault();
			return;
		}
		if (event.key === 'Escape' && (artwork.armed || artwork.importing)) {
			artwork.cancel();
			notice = '';
			event.preventDefault();
			return;
		}
		// Preview is an isolated visitor run: Stage viewing keys do not apply there.
		if (preview !== null) {
			if (event.key === 'Escape') previewController.close();
			return;
		}
		// S28 Esc precedence: a live marker gesture, then place, then Look through,
		// then the Card's own unwinding.
		if (event.key === 'Escape' && activeLayer !== null) {
			if (activeLayer.key(event, 'capture') === 'claimed') {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
		}
		// Typing in the Index's subject search must never move the camera.
		if (stageKeyFromTextEntry(event.target)) return;
		// R217.S26 (E17): Alt+← is the Card's Back in the Experience lens. A focused Stop card
		// or View tile claims Alt+← for its own reorder first (it prevents the default).
		if (
			activeLayer !== null &&
			event.key === 'ArrowLeft' &&
			event.altKey &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.defaultPrevented
		) {
			if (activeLayer.key(event, 'capture') === 'claimed') {
				event.preventDefault();
				cardOpen = true;
			}
			return;
		}
		// While a press is live the dock letters and `2` keep reaching the gesture's
		// typed entry, exactly as before they were dock keys.
		const action = stageKeyAction(event.key, { pressing: drag !== null || pinch !== null });
		// S6 — B is the modifier-free Bend arm, owned by the selected Wall's adapter
		// only when no task or press already owns the key.
		if (
			action.kind === 'none' &&
			event.key.toLowerCase() === 'b' &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			facade?.selectionKeyIntent({ kind: 'type', key: 'b' }).claimed === true
		) {
			event.preventDefault();
			return;
		}
		// A direct-manipulation writer keeps the keyboard while its press is live:
		// Tab moves between numeric fields and a printable key opens/extends entry.
		const gestureStage = facade;
		if (event.key === 'Tab' && drag?.mode === 'adapter' && gestureStage !== null) {
			if (gestureStage.gestureKeyIntent({ kind: 'type', key: '\t' }).claimed) {
				event.preventDefault();
				return;
			}
		}
		if (
			action.kind === 'none' &&
			event.key.length === 1 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			gestureStage !== null &&
			gestureStage.gestureKeyIntent({ kind: 'type', key: event.key }).claimed
		) {
			event.preventDefault();
			return;
		}
		// An activation key belongs to the focused control first: Enter on the palette's
		// Backtrack/Cancel button, a Find result or a Head control must run that
		// control, never the armed tool's command. The guard is limited to the three
		// command keys so the existing viewing map is unchanged.
		if (
			(action.kind === 'finish' || action.kind === 'backtrack' || action.kind === 'delete') &&
			stageKeyFromControl(event.target)
		) {
			return;
		}
		switch (action.kind) {
			case 'reading':
				setReading(action.reading);
				break;
			case 'zoom':
				if (!event.metaKey && !event.ctrlKey && !event.altKey) {
					event.preventDefault();
					zoom(action.scale);
				}
				break;
			case 'fit':
				fit();
				break;
			case 'tool':
				// A modified letter is the platform's (⌘P prints), and the dock is World's.
				if (event.metaKey || event.ctrlKey || event.altKey || lens !== 'world') break;
				event.preventDefault();
				pressDockSlot(action.slot);
				break;
			case 'pan':
				pan(action.deltaCss[0], action.deltaCss[1]);
				break;
			case 'finish':
			case 'backtrack': {
				// A live direct-manipulation writer answers first (numeric entry's Enter
				// and Backspace); otherwise the armed tool's task owns the command.
				const stage = facade;
				if (stage === null) break;
				if (stage.gestureKeyIntent({ kind: action.kind }).claimed) {
					event.preventDefault();
					break;
				}
				if (stage.keyboardIntent({ kind: action.kind }).claimed) {
					// One key, one activation: the palette's own control must not also be
					// activated by the same keystroke.
					event.preventDefault();
					break;
				}
				// D2 — with no task or live press, the selected subject's adapter may own
				// Backspace (the active bend point). A straight Wall does not claim it, so
				// the existing command map is unchanged there.
				if (stage.selectionKeyIntent({ kind: action.kind }).claimed) {
					event.preventDefault();
					break;
				}
				break;
			}
			case 'delete': {
				if (activeLayer?.key(event, 'capture') === 'claimed') {
					event.preventDefault();
					break;
				}
				// D2 — an active bend point owns Delete before the Wall's destructive
				// action. A curved Wall with no active knot claims and refuses the key, so
				// Delete cannot silently fall through to deleting the Wall; a straight
				// Wall is not claimed and keeps the existing `requestDelete` path.
				if (facade?.selectionKeyIntent({ kind: 'delete' }).claimed === true) {
					event.preventDefault();
					break;
				}
				requestDelete();
				break;
			}
			case 'dismiss': {
				// The deepest open context closes first. A disclosed-but-unconfirmed
				// destructive action is deeper than the task; a **live proposal** is deeper
				// than the tool that produced it, so the armed tool cancels its own chain
				// before the unwind disarms it (palette-first Esc, no hidden proposal).
				if (pendingDelete !== null) {
					pendingDelete = null;
					notice = '';
					break;
				}
				const stage = facade;
				// A live mark writer cancels first, then an open disclosure closes; neither
				// is a task, and neither may reach the task/selection unwinding below.
				// The adapter claimed this Escape (first restores numeric entry, second
				// cancels the writer). Interrupting the press here would turn the first
				// Escape into the second, so only an unclaimed key unwinds the press.
				if (stage !== null && stage.gestureKeyIntent({ kind: 'cancel' }).claimed) break;
				if (stage !== null && stage.closeDisclosure()) { stage.notifySurfaceChange(); break; }
				if (stage !== null && stage.keyboardIntent({ kind: 'cancel' }).claimed) { interruptPress('escape'); break; }
				const hadPress = drag !== null || pinch !== null;
				interruptPress('escape');
				if (hadPress) break;
				// R217.S10: a host tool clears its own measurement or words first, an open
				// palette folds next, and only then does the armed tool disarm.
				if (armedHostTool === 'measure' && measureTool?.clear()) { refreshHostTools(); break; }
				if (armedHostTool === 'erase' && eraserTool?.clear()) { eraseHover = null; refreshHostTools(); break; }
				const armedKey = dockKeys.find((key) => key.id === armedDockId);
				if (task !== null && armedKey?.palette === true && paletteOpen) { paletteOpen = false; break; }
				if (libraryOpen) { toggleWorldLibrary(); break; }
				if (task !== null) closeTask();
				else if (activeWorldTool !== 'select') { libraryOpen = false; activeWorldTool = 'select'; }
				// The plate is the last layer before Select: once the tool is clear,
				// Escape folds the parchment instead of moving the selection.
				else if (lens === 'world' && worldPlateOpen) { worldPlateOpen = false; }
				else if (activeLayer?.key(event, 'unwind') !== 'claimed' && selection !== null) closeSelection();
				break;
			}
			case 'none':
				break;
		}
	}

	/* --- shell view data ---------------------------------------------------- */

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

	const locatedSubjects = $derived.by(() => {
		void contributionsVersion;
		return facade?.subjects() ?? [];
	});
	const locatedSubjectMap = $derived(new Map(locatedSubjects.map((subject) => [subject.id, subject])));
	const selectedLocatorId = $derived.by(() => {
		const selected = selection;
		if (selected === null) return null;
		return `${selected.reference.domain}:${selected.reference.subject.kind === 'room' ? 'room-floor' : selected.reference.subject.kind}:${selected.reference.subject.id}`;
	});
	/**
	 * R217.S21 — the authored names and kind words the Index and the Card read, taken from
	 * the admitted source: Layout walls, openings and floors, and Scene entities. A read
	 * only. A generated `Kind n` is shown and never written back.
	 */
	const layoutPayload = $derived.by(() => {
		if (boot.status !== 'ready' && boot.status !== 'empty') return null;
		try {
			return stageLayout(boot.snapshot);
		} catch {
			return null;
		}
	});
	const scenePayload = $derived.by(() => {
		if (boot.status !== 'ready' && boot.status !== 'empty') return null;
		try {
			return stageScene(boot.snapshot);
		} catch {
			return null;
		}
	});

	/** The authored name of one Layout subject, or `null` when it has none (objects never do). */
	function layoutNameOf(sourceKind: string, sourceId: string): string | null {
		const document = layoutPayload;
		if (document === null) return null;
		if (sourceKind === 'wall') return document.walls.find((wall) => wall.id === sourceId)?.name ?? null;
		if (sourceKind === 'opening') return (
				document.openings.find((opening) => opening.id === sourceId)?.name ?? null
			);
		if (sourceKind === 'room-floor' || sourceKind === 'room') {
			return document.rooms.find((room) => room.id === sourceId)?.name ?? null;
		}
		return null;
	}

	/** The kind word of one Layout subject; an Opening reads its own door or window. */
	function layoutKindWordOf(sourceKind: string, sourceId: string): string {
		if (sourceKind !== 'opening') return layoutKindWord(sourceKind);
		const opening = layoutPayload?.openings.find((candidate) => candidate.id === sourceId);
		return layoutKindWord(sourceKind, opening?.kind);
	}

	/** One Scene entity's authored name and kind word, from the admitted Scene. */
	function sceneEntityOf(entityId: string) {
		return (
			scenePayload?.entities.find((entity) => entity.id === entityId) ?? null
		);
	}

	/**
	 * Every located subject, before any search: the Plan's Layout membership rows and the
	 * contributed subjects. The labels are numbered over this whole list, so a search never
	 * changes a label.
	 */
	const indexEntries = $derived.by(() => {
		const entries: {
			group: string;
			sourceId: string;
			kindWord: string;
			name: string | null;
			eligible: boolean;
			revealed: boolean;
			membership: string;
		}[] = [];
		const plan = planView;
		if (plan === null) return entries;
		for (const membership of plan.membership) {
			entries.push({
				group: membership.sourceKind,
				sourceId: `layout:${membership.sourceKind}:${membership.sourceId}`,
				kindWord: layoutKindWordOf(membership.sourceKind, membership.sourceId),
				name: layoutNameOf(membership.sourceKind, membership.sourceId),
				eligible: membership.eligible,
				revealed: membership.revealed,
				membership: membership.reason
			});
		}
		for (const subject of locatedSubjects) {
			const entity = subject.reference.domain === 'scene' ? sceneEntityOf(subject.reference.subject.id) : null;
			entries.push({
				group: subject.reference.domain,
				sourceId: subject.id,
				kindWord: entity === null ? 'Subject' : sceneKindWord(entity.kind),
				name: entity?.name ?? null,
				eligible: true,
				revealed: false,
				membership: 'included'
			});
		}
		return entries;
	});

	/** Each located subject's display label, keyed by its Index row. */
	const indexLabelMap = $derived(
		indexLabels(
			indexEntries.map((entry): IndexLabelInput => ({
				identity: entry.sourceId,
				kind: entry.kindWord,
				name: entry.name
			}))
		)
	);
	const indexEntryMap = $derived(new Map(indexEntries.map((entry) => [entry.sourceId, entry])));

	const worldIndexModel = createWorldIndexModel();
	let worldScope = $state<WorldScope>('project');
	const worldIndex = $derived(
		worldIndexModel(
			layoutPayload,
			indexEntries.map((entry) => ({
				...entry,
				label: indexLabelMap.get(entry.sourceId) ?.label ?? entry.kindWord, authored: indexLabelMap.get(entry.sourceId)?.authored ?? false,
				kind: entry.kindWord
			})),
			boot.status === 'ready' || boot.status === 'empty'
				? boot.snapshot.domain.name
				: 'Project',
			currentEnvelope ? acceptedSceneRoomMembership(currentEnvelope) : new Map()
		)
	);
	const resolvedScope = $derived(resolveWorldScope(worldIndex, worldScope));
	const locationLabel = $derived(
		worldIndex.contexts
			.filter((c) =>
					c.id === 'project' ||

					c.id === resolvedScope
			)
			.map((c) => c.label)
			.join(' › ')
	);

	/** Plan membership is a Layout fact; another domain's subject has none to report. */
	const selectedMembership = $derived.by((): PlanMembershipReason | null => {
		const plan = planView;
		const selected = selection;
		if (plan === null || selected === null || selected.reference.domain !== 'layout') return null;
		// Indexed against the membership array: this is read on every presented frame
		// while something is selected, so it must not scan the project.
		return (
			planMembershipOf(plan, selected.reference.subject.id)?.reason ?? null
		);
	});

	/**
	 * The Card's identity: the subject's name (authored, or its generated `Kind n`), its
	 * kind word and, for Layout, its Plan membership in words. The canonical ID stays in
	 * Technical details.
	 */
	const cardIdentity = $derived.by(() => {
		const selected = selection;
		if (selected === null) return null;
		const key = selectedLocatorId ?? '';
		const entry = indexEntryMap.get(key);
		const label = indexLabelMap.get(key);
		const domainWord = selected.reference.domain === 'layout' ? 'Layout' : 'Scene';
		return {
			sourceId: selected.reference.subject.id,
			label: label?.label ?? entry?.kindWord ?? domainWord,
			kind: entry?.kindWord ?? domainWord,
			// A Layout subject states its Plan membership; a Scene subject names its own domain.
			status:
				selected.reference.domain !== 'layout'
					? domainWord
					: selectedMembership !== null
						? membershipLabel(selectedMembership)
						: 'Not in the current Plan'
		};
	});

	/**
	 * The selected subject in the shared Card vocabulary. The Look stratum and every
	 * adapter contribution read the one subject; the route does not rebuild it.
	 */
	const cardSubject = $derived.by((): StageCardSubject | null => {
		const selected = selection;
		if (selected === null) return null;
		return {
			sourceId: selected.reference.subject.id,
			sourceKind: selected.reference.subject.kind,
			reference: selected.reference,
			ref: selected.representation ?? null
		};
	});

	const selectedArtwork = $derived.by(() => {
		if (cardSubject?.reference?.domain !== 'scene') return null;
		const entity = scenePayload?.entities.find((candidate) => candidate.id === cardSubject.sourceId);
		return entity?.kind === 'artwork' ? entity : null;
	});

	/** The Card's Look stratum: empty in P0, filled by later Finish, Light or Artwork slices. */
	const lookCardStratum = $derived.by(() => {
		void contributionsVersion;
		const subject = cardSubject;
		const entity = subject?.reference?.domain === 'scene'
			? scenePayload?.entities.find((entry) => entry.id === subject.sourceId)
			: undefined;
		return (entity?.kind === 'artwork' ? artwork.card(entity) : null) ?? look.cardStratum(subject);
	});

	/**
	 * The Card's ordinary facts: the Layout datum, then whatever adapters registered for
	 * this subject, without this route knowing which domain contributed them. A fact whose
	 * field the header or the writer shows is dropped by the Card, so each value appears once.
	 */
	const cardFacts = $derived.by((): readonly { readonly label: string; readonly value: string; readonly fieldId?: string;
		}[] => {
		// Reading the version makes an adapter registration or disposal re-derive.
		void contributionsVersion;
		const selected = selection;
		if (selected === null) return [];
		const own = selected.reference.domain === 'layout'
			? [
				{
					label: 'Datum',
					value: `${boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.datumMeters : 0} m`
				}
			]
			: [];
		return [...stageCardFacts(facade, cardSubject, own), ...lookCardStratum.facts];
	});

	const cardNameWriter = $derived.by(() => {
		void contributionsVersion;
		const subject = cardSubject;
		if (subject === null || facade === null) return null;
		return facade.cardNameWriter(subject);
	});

	/**
	 * The Card's contributed **field writer** for the selected subject.
	 *
	 * Round 2 D9 makes the Card the one writer for ordinary dimensions, so the
	 * migrated Layout fields render there through the same controller the retired
	 * Dimensions task used. The route knows nothing about the fields themselves.
	 */
	const cardWriter = $derived.by(() => {
		void contributionsVersion;
		const subject = cardSubject;
		if (subject === null) return null;
		return lookCardStratum.writer ?? (facade === null ? null : stageCardWriter(facade, subject));
	});

	/**
	 * The selected subject's scoped actions, each carrying the consequences its own
	 * adapter disclosed. A destructive one is what both the Card and `Delete` run.
	 */
	const cardActions = $derived.by((): readonly StageCardActionRecord[] => {
		void contributionsVersion;
		const subject = cardSubject;
		if (subject === null) return [];
		return [
			...(facade === null ? [] : stageCardActions(facade, subject)),
			...lookCardStratum.actions
		];
	});

	/** The display label of a located Stage subject, or null when the Index does not list it. */
	function referenceLabel(reference: StageSelectionEntry['reference']): string | null {
		const kind = reference.subject.kind === 'room' ? 'room-floor' : reference.subject.kind;
		return indexLabelMap.get(`${reference.domain}:${kind}:${reference.subject.id}`)?.label ?? null;
	}

	/** Stage-select a subject from an Experience Card link: the Stage selection replaces the Card subject. */
	function selectStageReference(reference: StageSelectionEntry['reference']): void {
		const stage = facade;
		if (stage === null) return;
		const change = stage.setSelection({ ordered: [{ reference }], primary: reference });
		if (change.kind === 'refused') return;
		selection = primaryEntry(stage.selectionState());
		experienceFocus.select(null);
		cardOpen = true;
	}

	/**
	 * R217.S25 — the Experience lens's groups for the shared Index: the Experience switch, the
	 * Guides, and the Presentations with their Views and Stop numbers. A read of the controller;
	 * every action is one of its commands or the one Card selection.
	 */
	const experienceIndex = $derived(experienceIndexFor({
		lens,
		controller: experienceController,
		guideOpen: experienceGuideOpen,
		expandedPresentationId,
		select: experienceLens.selectSubject,
		setExpanded: (presentationId) => { expandedPresentationId = presentationId; },
		setCardOpen: (open) => { cardOpen = open; },
		setGuideOpen: (open) => { experienceGuideOpen = open; }
	}));

	/** The Card's `menu` item shape (R217.S26: danger items, consequence blocks and submenus). */
	type ExperienceCardMenuItem = NonNullable<ComponentProps<typeof EditorCard>['menu']>[number];
	type ShownCard = {
		readonly identity: { sourceId: string; label: string; kind: string; status: string } | null;
		readonly facts: readonly { readonly label: string; readonly value: string; readonly fieldId?: string }[];
		readonly nameWriter: ComponentProps<typeof EditorCard>['nameWriter'];
		readonly writer: StageCardWriterRecord | null;
		readonly actions: readonly StageCardActionRecord[];
		readonly functions: readonly string[] | null;
		readonly bringIntoView: (() => void) | null;
		readonly kindLink: { readonly label: string; readonly onOpen: () => void } | null;
		readonly menu: readonly ExperienceCardMenuItem[] | null;
		readonly back: { readonly label: string; readonly onBack: () => void } | null;
	};
	const NO_CARD: ShownCard = {
		identity: null,
		facts: [],
		nameWriter: null,
		writer: null,
		actions: [],
		functions: [],
		bringIntoView: null,
		kindLink: null,
		menu: null,
		back: null
	};

	const cardBack = (controller: ExperienceController, parent: Parameters<typeof backOf>[1]) =>
		backOf(controller, parent, () => { cardOpen = true; });

	const experienceShownCard = $derived.by((): ShownCard => {
		const controller = activeExperience;
		const services = adapterServices;
		// The ready draft (no Experience yet) still shows the Stage selection, so Present this can start it.
		if (controller === null || services === null) return NO_CARD;
		const bring = () => {
			const target = selectedWorldPoint();
			if (target !== null) bringIntoView(target);
		};
		return experienceShownCardFor({
			controller,
			services,
			selection,
			sceneSubject: experienceSceneSubject,
			cardIdentity,
			select: experienceLens.selectSubject,
			changeLens: () => changeLens('world'),
			bring,
			selectStageReference,
			referenceLabel,
			openCard: () => { cardOpen = true; }
		}) as unknown as ShownCard;
	});

	/**
	 * What the one Card shows for the current lens. The Experience lens shows its own Card (one
	 * selection, D10); World shows the Stage selection exactly as before.
	 */
	const shownCard = $derived.by((): ShownCard => {
		if (lens === 'experience') return experienceShownCard;
		return {
			identity: cardIdentity,
			facts: cardFacts,
			nameWriter: cardNameWriter,
			writer: cardWriter,
			actions: cardActions,
			functions: null,
			kindLink: null,
			menu: null,
			back: null,
			bringIntoView: () => {
				const target = selectedWorldPoint();
				if (target !== null) bringIntoView(target);
			}
		};
	});

	/**
	 * Whether the Card is folded to identity.
	 *
	 * PLATE's arbitration: the Card keeps its facts readable *beside* the one lower
	 * column, so at constrained width it folds instead of covering the task. The
	 * creator's explicit expansion wins. A constrained stage folds the Card once, when a
	 * task opens (below), and the fold is never re-derived from the live task: a commit
	 * that closes the task therefore cannot expand a folded Card (R217.S22, D36). Closing
	 * a task by hand reconsiders the fold (`closeTask` clears the explicit choice).
	 */

	/** Every contributed Find/rail entry from the adapters currently mounted. */
	const findContributions = $derived.by(() => {
		// Same signal: a newly registered adapter's Find entries appear at once.
		void contributionsVersion;
		return stageFindEntries(facade);
	});

	/** The bottom dock's armable tools: the contributed entries whose home is the dock. */
	const dockTools = $derived.by(() => {
		void contributionsVersion;
		return stageDockTools(facade);
	});

	/** R217.S10 — the dock's keys: Select · Ink · Measure · Eraser | Objects. */
	const dockKeys = $derived(stageDockKeys(dockTools));

	/** The armed host tool, read from the one task the session holds. */
	const armedHostTool = $derived<'measure' | 'erase' | null>(
		task?.kind === STAGE_MEASURE_TASK ? 'measure' : task?.kind === STAGE_ERASER_TASK ? 'erase' : null
	);

	/**
	 * The armed dock key: Select when no task is open, the armed tool's key while
	 * one is, and none while a non-dock task (Compose, Import) holds the column.
	 */
	const armedDockId = $derived.by(() => {
		if (task === null) return 'host-select';
		if (armedHostTool !== null) return task.kind;
		const armed = armedTool;
		if (armed !== null && dockKeys.some((key) => key.id === armed.id && key.adapterId === armed.adapterId)) return armed.id;
		return (
			dockKeys.find((key) => key.taskKind === task?.kind && key.adapterId !== STAGE_HOST_ADAPTER_ID)?.id ?? ''
		);
	});

	/**
	 * The bounded **Find in Head** list: every contributed entry by label, with the
	 * verb that reaches it — `Arm` for a dock tool, `Invoke` for an Index task.
	 *
	 * It is a discovery route to what the mounted adapters contributed, not a subject
	 * search and not the scope-model Index.
	 */
	const headFindEntries = $derived.by(() => {
		const needle = findQuery.trim().toLowerCase();
		const entries = [
			{ id: 'starter', adapterId: 'project-replacement', label: 'Use enclosed room starter', verb: 'Replace' },
			...worldIndex.rows.map((row) => ({ id: row.sourceId, adapterId: 'subject', label: row.label, verb: 'Select' })),
			...worldIndex.contexts.map((context) => ({
				id: context.id,
				adapterId: 'scope',
				label: context.label,
				verb: 'Go to'
			})),
			...['Zoom in', 'Zoom out', 'Fit'].map((label, index) => ({
				id: String(index),
				adapterId: 'view-command',
				label,
				verb: 'Run'
			})),
			...dockKeys
				.filter((key) => !key.unavailableReason)
				.map((key) => ({
				id: key.id,
				adapterId: key.adapterId,
				label: key.label,
				verb: 'Arm'
			})),
			...findContributions.map((entry) => ({
				id: entry.id, adapterId: entry.adapterId, label: entry.label, verb: 'Invoke'
			})),
			// O8: the Scale detents stay reachable after the Scale word leaves the
			// toolbar. They are the same existing zoom intent, not a second control.
			...SCALE_DETENTS.map((ratio) => ({
				id: `scale:${ratio}`,
				adapterId: 'scale',
				label: `Scale 1:${ratio}`,
				verb: 'Zoom'
			})),
			// R217.S20: the former ☰ menu's capabilities keep a Find entry beside their
			// permanent homes (viewing preferences in the Stage's ⚙, the project
			// procedures under the project name), and Keys, which has no other home.
			...HEAD_PREFERENCE_ENTRIES,
			{ id: 'keys', adapterId: 'keys', label: 'Keys', verb: 'Show' },
			...(lens === 'experience'
				? [{ id: 'tips', adapterId: 'experience', label: 'Show Experience tips', verb: '' }]
				: []),
			...HEAD_PROJECT_ENTRIES
		];
		return needle === '' ? entries : entries.filter((entry) => entry.label.toLowerCase().includes(needle));
	});

	/**
	 * Arm a dock tool: the very same contributed task the Index invokes, so a tool
	 * has one operation behind it, never a second dock-only path into the domain.
	 */
	function armDockTool(tool: { readonly id: string; readonly adapterId: string;
	}): void {
		invokeContribution(tool.adapterId, tool.id);
		armedTool = { id: tool.id, adapterId: tool.adapterId };
		paletteOpen = true;
		worldPlateOpen = true;
		pendingDelete = null;
	}

	/** Select — the host's own tool: it closes the contributed task and keeps what is selected. */
	function selectTool(): void {
		artwork.cancel();
		closeTask();
	}

	/** The host task an armed Measure or Eraser holds. It names no target. */
	function hostToolTask(kind: string): StageTask | null {
		if (kind === STAGE_MEASURE_TASK) return { kind, label: 'Measure', targetRef: null, target: null };
		if (kind === STAGE_ERASER_TASK) return { kind, label: 'Eraser', targetRef: null, target: null };
		return null;
	}

	/**
	 * Arm Measure or Eraser. Like every dock key it takes the lower column and leaves
	 * the selection exactly as it was; it opens no adapter instrument.
	 */
	function armHostTool(kind: string): void {
		const stage = facade;
		const next = hostToolTask(kind);
		if (stage === null || next === null) return;
		closeTask();
		if (!stage.openTask(next)) return;
		task = next;
		armedTool = { id: kind, adapterId: STAGE_HOST_ADAPTER_ID };
		paletteOpen = true;
		worldPlateOpen = true;
		pendingDelete = null;
		notice = '';
		refreshHostTools();
	}

	/** Arm one dock key (from the dock, its key or Find). */
	function armDockKey(key: StageDockKey): void {
		if (key.slot === 'select') {
			activeWorldTool = 'select';
			libraryOpen = false;
			selectTool();
		} else if (key.adapterId === STAGE_HOST_ADAPTER_ID) {
			activeWorldTool = key.id === STAGE_MEASURE_TASK ? 'measure' : 'erase';
			libraryOpen = false;
			armHostTool(key.id);
		} else if (key.slot === 'library') {
			activeWorldTool = 'objects';
			libraryOpen = false;
			armDockTool({ id: key.id, adapterId: key.adapterId });
		} else if (key.slot === 'ink') {
			activeWorldTool = inkReading === 'opening' ? 'opening' : 'walls';
			libraryOpen = false;
			armDockTool({ id: key.id, adapterId: key.adapterId });
			paletteOpen = false;
		} else {
			armDockTool({ id: key.id, adapterId: key.adapterId });
		}
	}

	/** The Living Draft row's one bridge into the existing dock/host controllers. */
	function armWorldTool(id: WorldToolId): void {
		artwork.cancel();
		worldPlateOpen = id !== 'select';
		if (id === 'library') {
			toggleWorldLibrary();
			return;
		}
		libraryOpen = false;
		if (id === 'select') {
			activeWorldTool = 'select';
			selectTool();
			return;
		}
		if (id === 'walls' || id === 'opening') {
			const key = dockKeys.find((candidate) => candidate.slot === 'ink');
			if (key === undefined) {
				notice = 'Ink is not available in this project.';
				return;
			}
			inkReading = id === 'opening' ? 'opening' : 'wall';
			armDockTool({ id: key.id, adapterId: key.adapterId });
			activeWorldTool = id;
			paletteOpen = false;
			return;
		}
		if (id === 'objects') {
			const key = dockKeys.find((candidate) => candidate.slot === 'library');
			if (key === undefined) {
				notice = 'Objects is not available in this project.';
				return;
			}
			armDockTool({ id: key.id, adapterId: key.adapterId });
			activeWorldTool = 'objects';
			paletteOpen = false;
			return;
		}
		if (id === 'measure' || id === 'erase') {
			armHostTool(id === 'measure' ? STAGE_MEASURE_TASK : STAGE_ERASER_TASK);
			activeWorldTool = id;
			paletteOpen = false;
			return;
		}
		// A planned row is inspectable, but it writes nothing until its post-merge branch.
		closeTask();
		activeWorldTool = id;
		paletteOpen = false;
	}

	function toggleWorldLibrary(): void {
		if (libraryOpen) {
			libraryOpen = false;
			activeWorldTool = toolBeforeLibrary === 'library' ? 'select' : toolBeforeLibrary;
			return;
		}
		toolBeforeLibrary = activeWorldTool === 'library' ? 'select' : activeWorldTool;
		closeTask();
		libraryOpen = true;
		activeWorldTool = 'library';
		worldPlateOpen = true;
		paletteOpen = false;
	}

	function pickWorldObject(assetId: string): void {
		libraryOpen = false;
		armWorldTool('objects');
		notice = assetId === '' ? 'Choose a placement in the Objects panel.' : 'Choose the object in the Objects panel to place it.';
	}

	/** A dock press: arm the key, or fold/unfold the armed key's own palette. */
	function pressDockKey(key: StageDockKey): void {
		if (key.id === armedDockId && key.slot !== 'select') {
			if (key.palette) togglePalette();
			return;
		}
		armDockKey(key);
	}

	/** A dock shortcut: the same press as the key, or a word when the key is absent. */
	function pressDockSlot(slot: StageDockSlot): void {
		const key = dockKeys.find((candidate) => candidate.slot === slot);
		if (key === undefined) {
			notice = 'That tool is not available in this project.';
			return;
		}
		pressDockKey(key);
	}

	/**
	 * Re-arm the dock's tool after an accepted install.
	 *
	 * The install closed the task; this re-opens the **same** contributed entry once
	 * its rebound adapter publishes it again, so the next Wall of a run does not need
	 * a second trip to the dock. It is a no-op for a tool the creator disarmed, and
	 * for an entry whose adapter no longer contributes it.
	 */
	function rearmDockTool(): void {
		const armed = armedTool;
		const stage = facade;
		if (armed === null || stage === null) return;
		if (armed.adapterId === STAGE_HOST_ADAPTER_ID) {
			// An erase installs new content, which closes the task; the Eraser stays armed.
			const next = hostToolTask(armed.id);
			if (next !== null && stage.session.task() === null && stage.openTask(next)) task = next;
			return;
		}
		const stillContributed = stage
			.findEntries()
			.some((entry) => entry.id === armed.id && entry.adapterId === armed.adapterId);
		if (!stillContributed) return;
		invokeContribution(armed.adapterId, armed.id, false);
		// The install briefly closed the task, so the task/chrome sync reset the World
		// tool to Select. Keep the re-armed Ink row attached to the task it drives.
		if (armed.id === 'layout-ink') {
			activeWorldTool = inkReading === 'opening' ? 'opening' : 'walls';
			worldPlateOpen = true;
		}
	}

	/** Pressing the armed key again folds or re-opens its palette without disarming the tool. */
	function togglePalette(): void {
		paletteOpen = !paletteOpen;
	}

	/** R217.S20 — a Find preference entry writes the same browser preference the Stage's ⚙ writes. */
	function runPreferenceEntry(id: string): void {
		if (id === 'reduce-motion') {
			reducedMotion = !reducedMotion;
			updatePreferences({ ...preferences, reducedMotion });
			return;
		}
		const [name, value] = id.split(':');
		if (name === 'appearance' && (value === 'paper' || value === 'shaded')) updatePreferences({ ...preferences, planAppearance: value });
		else if (name === 'height-sheet' && (value === 'left' || value === 'right')) heightSheetSide = value;
		else if (name === 'motion-speed' && (value === 'slow' || value === 'normal' || value === 'fast')) updatePreferences({ ...preferences, motionSpeed: value });
	}

	/** Reach a Find result: a dock tool arms, an Index entry invokes. */
	function runHeadFindEntry(entry: { readonly id: string; readonly adapterId: string;
	}): void {
		if (entry.adapterId === 'project-replacement' && entry.id === 'starter') {
			requestReplacement('starter');
			return;
		}
		if (entry.adapterId === 'scope') {
			worldScope = entry.id as WorldScope;
			indexOpen = true;
			return;
		}
		if (entry.adapterId === 'view-command') {
			if (entry.id === '0') zoomIn();
			else if (entry.id === '1') zoomOut();
			else fit();
			return;
		}
		if (entry.adapterId === 'subject') { selectSource(entry.id); return; }
		if (entry.adapterId === 'scale') {
			requestScaleDetent(Number(entry.id.slice('scale:'.length)));
			return;
		}
		if (entry.adapterId === 'preference') { runPreferenceEntry(entry.id); return; }
		if (entry.adapterId === 'keys') { keysOpen = true; return; }
		if (entry.adapterId === 'experience' && entry.id === 'tips') {
			showExperienceWelcome = true;
			return;
		}
		if (entry.adapterId === 'project-menu') {
			// Rename and delete open the Head's own dialog and never reach the route.
			if (entry.id === 'download') downloadSourceJson();
			else if (entry.id === 'source') requestReplacement('source');
			return;
		}
		const key = dockKeys.find(
			(candidate) => candidate.id === entry.id && candidate.adapterId === entry.adapterId
		);
		if (key !== undefined) {
			armDockKey(key);
			if (key.palette) paletteOpen = true;
			return;
		}
		invokeContribution(entry.adapterId, entry.id);
	}

	/**
	 * The keyboard route to a subject's own destructive action.
	 *
	 * The first press **names the consequences the owning adapter disclosed** — the
	 * same planner-derived words the Card shows, hosted Openings and Room merge/open
	 * included — and the second confirms. The first press writes nothing, and a
	 * domain that contributes no destructive action is never offered one. The
	 * confirmation is bound to that exact disclosure: a different subject, or the
	 * same subject disclosed differently, reserves a fresh offer instead of
	 * spending the one that was read.
	 */
	function requestDelete(): void {
		const selected = selection;
		const destructive = cardActions.filter((action) => action.destructive === true);
		if (selected === null || destructive.length !== 1) {
			pendingDelete = null;
			notice = selected === null ? 'Select a subject to delete it.' : 'Nothing here can be deleted.';
			return;
		}
		const record = destructive[0]!;
		const subjectKey = `${selected.reference.subject.kind}:${selected.reference.subject.id}`;
		const detail = record.detail ?? null;
		if (
			pendingDelete !== null &&
			pendingDelete.subjectKey === subjectKey &&
			pendingDelete.actionId === record.id &&
			pendingDelete.detail === detail
		) {
			pendingDelete = null;
			void runCardAction(record, subjectKey);
			return;
		}
		pendingDelete = { subjectKey, actionId: record.id, detail };
		const disclosed = record.detail ?? 'the owning domain disclosed no consequences';
		notice = `${record.label} — ${disclosed.endsWith('.') ? disclosed : `${disclosed}.`} Press Delete again to confirm, or Escape to keep it.`;
	}

	/** Run one contributed Card action and report exactly what it said. */
	async function runCardAction(record: StageCardActionRecord, subjectKey: string): Promise<void> {
		const outcome = await record.run();
		if (pendingDelete?.subjectKey === subjectKey) pendingDelete = null;
		notice = outcome.kind === 'accepted' ? '' : (outcome.message ?? `${record.label} was not applied.`);
	}

	/**
	 * The instrument host's task view. The target is named explicitly and may differ
	 * from the canonical selection — an Opening can stay selected while the task
	 * works on its host Wall.
	 */
	const taskHost = $derived(
		task === null || armedHostTool !== null
			? null
			: {
					kind: task.kind,
					label: task.label,
					targetLabel:
						task.targetRef === null
							? null
							: sourceLabel(task.targetRef.sourceId, task.targetRef.sourceKind)
				}
	);

	/** The world point a "Bring into view" request targets, from the selected fragment. */
	function selectedWorldPoint(): [number, number, number] | null {
		const plan = planView;
		const selected = selection;
		if (plan === null || selected === null) return null;
		if (selected.reference.domain !== 'layout') {
			const subject = locatedSubjects.find((item) => item.reference.domain === selected.reference.domain && item.reference.subject.id === selected.reference.subject.id);
			return subject === undefined ? null : [...subject.worldPoint];
		}
		const fragment = planFragmentOf(plan, selected.reference.subject.id);
		if (fragment === undefined) return null;
		const points =
			fragment.geometry.kind === 'span'
				? [fragment.geometry.start, fragment.geometry.end]
				: fragment.geometry.kind === 'polyline'
					? fragment.geometry.polyline
					: fragment.geometry.polygon;
		if (points.length === 0) return null;
		const center = points.reduce<[number, number]>(
			(accumulator, point) => [accumulator[0] + point[0] / points.length, accumulator[1] + point[1] / points.length],
			[0, 0]
		);
		return [center[0], fragment.elevationMeters, center[1]];
	}
</script>

<div class="editor-host" data-shell="living-draft">
	<!--
		The Head and the Index are authoring chrome, so they are not mounted while
		the isolated Preview run owns the Camera output: a visible Undo, Save or
		selection there would be a second writer reaching the source this run does
		not own. Leaving Preview remounts the same host and selection state.
	-->
	{#if preview === null}
	<EditorHead
		{projectId}
		projectName={boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.name : 'Loading project'}
		{lens}
		onLens={changeLens}
		canDownloadSource={activeProject()}
		onDownloadSource={downloadSourceJson}
		onOpenSource={() => requestReplacement('source')}
		historyUnavailableReason={historyState.undoUnavailableReason ?? 'Nothing to undo yet.'}
		redoUnavailableReason={historyState.redoUnavailableReason ?? 'Nothing to redo.'}
		canUndo={historyState.canUndo}
		canRedo={historyState.canRedo}
		onUndo={() => void undo()}
		onRedo={() => void redo()}
		save={headSave}
		onReloadRemote={(offer) => void applyReloadOffer(offer)}
		saveUnavailableReason="Conditional Save needs the cloud client; this session has none."
		canPreview={previewAvailable}
		onPreview={() => void previewController.open()}
		previewUnavailableReason={currentEnvelope === null
			? 'Preview needs an admitted project source.'
			: 'Create an Experience in the Experience lens to Preview it.'}
		{indexOpen}
		onToggleIndex={() => (indexOpen = !indexOpen)}
			{locationLabel}
		onOpenIndex={() => (indexOpen = true)}
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
			query: findQuery,
			entries: headFindEntries,
			onQuery: (value) => (findQuery = value),
			onRun: runHeadFindEntry
		}}
	/>
	{/if}

	{#if resumeOffer}
		<div class="resume-offer" role="region" aria-label="Pending cloud save">
			<p>
				A cloud Save was captured before sign-in. Resuming mounts your captured work and
				replays that exact Save — it is never applied automatically.
			</p>
			<button type="button" class="primary" onclick={() => void resumePendingSave()}>Resume pending Save</button>
			<button type="button" onclick={dismissResumeOffer}>Discard captured Save</button>
		</div>
	{/if}

	{#if sourceFindings !== null || sourceProblems.length > 0 || previewProblem !== null}
		<!--
			Experience review 1: source problems are a quiet chip, not a page banner.
			The creator reads a plain sentence and uses *Show* to open the Stop's
			Transition Card; ids, paths and codes stay in *Copy details*.
		-->
		<details
			class="source-findings"
			class:blocking={(sourceFindings?.closure.length ?? 0) > 0}
			aria-label="Source findings"
		>
			<summary>
				{#if (sourceFindings?.closure.length ?? 0) > 0}
					<strong>This project can't be saved yet.</strong> Something it needs is missing.
				{:else}
					<strong>{sourceProblems.length + (previewProblem === null ? 0 : 1)} to review</strong>
					{previewProblem === null
						? 'This file needs attention before every move plays.'
						: 'Preview cannot start from this file.'}
				{/if}
				<span class="source-findings-more">Details</span>
			</summary>
			<ul>
				{#each (previewProblem === null ? sourceProblems : [previewProblem, ...sourceProblems]).slice(0, 8) as problem (problem.code + problem.detail)}
					<li data-finding-code={problem.code}>
						<span
							>{problem.sentence}{#if problem.fix}<span class="source-problem-fix">{problem.fix}</span>{/if}</span
						>
						{#if problem.subject !== null}
							<button type="button" class="source-problem-show" onclick={() => showProblem(problem)}
								>Show</button
							>
						{/if}
					</li>
				{/each}
				{#each (sourceFindings?.closure ?? []).slice(0, 8) as finding (finding.path + finding.code)}
					<li data-finding-code={finding.code}>{finding.message}</li>
				{/each}
			</ul>
			<button
				type="button"
				onclick={() =>
					void navigator.clipboard?.writeText(
						[...(previewProblem === null ? [] : [previewProblem]), ...sourceProblems]
							.map((problem) => problem.detail)
							.concat(
								(sourceFindings?.closure ?? []).map(
									(finding) => `${finding.path}: ${finding.message} (${finding.code})`
								)
							)
							.join('\n')
					)}>Copy details</button
			>
		</details>
	{/if}

	<div
		class="editor-body"
		style={`--lower-column-height: ${lowerColumnHeight}px; ${lens === 'experience' ? '--card-right: 10px; ' : ''}${lens === 'experience' && !experienceGuideOpen ? '--card-bottom-clearance: 96px; ' : ''}--sheet-lane-right: ${sheetLaneRight}px; --sheet-lane-left: ${sheetLaneLeft}px`}
		data-index-open={preview === null && indexOpen}
	>
		{#if preview === null}
		<EditorIndex
			open={indexOpen}
				model={worldIndex}
				scope={resolvedScope}
				onScope={(scope) => (worldScope = scope)}
				onClose={() => (indexOpen = false)}
			selectionId={selectedLocatorId}
			{query}
			onQuery={(next) => (query = next)}
			onSelect={selectSource}
			onBringIntoView={(sourceId) => {
				const subject = locatedSubjects.find((item) => item.id === sourceId);
				if (subject !== undefined) { bringIntoView(subject.worldPoint); return; }
				const plan = planView;
				const layoutId = sourceId.startsWith('layout:') ? sourceId.slice(sourceId.indexOf(':', 7) + 1) : sourceId;
				const fragment = plan === null ? undefined : planFragmentOf(plan, layoutId);
				if (fragment === undefined) return;
				const points =
					fragment.geometry.kind === 'span'
						? [fragment.geometry.start, fragment.geometry.end]
						: fragment.geometry.kind === 'polyline'
							? fragment.geometry.polyline
							: fragment.geometry.polygon;
				if (points.length === 0) return;
				const center = points.reduce<[number, number]>(
					(accumulator, point) => [accumulator[0] + point[0] / points.length, accumulator[1] + point[1] / points.length],
					[0, 0]
				);
				bringIntoView([center[0], fragment.elevationMeters, center[1]]);
			}}
			onReveal={(id) => { if (id.startsWith('layout:')) toggleReveal(id.slice(id.indexOf(':', 7) + 1)); }}
			onRename={() => { cardOpen = true; cardRenameRequest += 1; }}
			experience={experienceIndex}
		/>
		{/if}
		<!--
			R217.S23 — at a constrained width an open Index is a sheet over the Stage. Its
			scrim is an explicit, bounded close target: it covers the Stage above the lower
			column's measured span and sits beneath the dock, palette, drafting controls and
			Card, so every one of them stays usable behind the sheet.
		-->
		{#if preview === null && narrowShell && indexOpen}
			<button
				type="button"
				class="index-scrim"
				tabindex="-1"
				aria-label="Close the Index"
				data-index-scrim
				onclick={() => (indexOpen = false)}
			></button>
		{/if}

		<!--
			The old second line is restored: the reading grid and 2D/3D controls sit
			under the project Head, and the new Measure, Slice and Sky controls join
			that line rather than replacing it.
		-->
		{#if preview === null}
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
			<div
				class="view-line"
				data-view-line
				onclick={(event) => event.stopPropagation()}
				onpointerdown={(event) => event.stopPropagation()}
			>
				<StageDraftingControl
					{drafting}
					reading={draftingReading}
					gridWord={draftingGridWord}
					snapWord={draftingSnapWord}
					onReading={setReading}
					onPatch={patchDrafting}
					planAppearance={preferences.planAppearance}
					onPlanAppearance={(planAppearance) => updatePreferences({ ...preferences, planAppearance })}
					measureActive={activeWorldTool === 'measure'}
					onMeasure={() => armWorldTool('measure')}
					roomLabels2d={preferences.roomLabels2d}
					roomLabels3d={preferences.roomLabels3d}
					paperTone2d={preferences.paperTone2d}
					paperTone3d={preferences.paperTone3d}
					onViewPreference={(patch) => { updatePreferences({ ...preferences, ...patch }); refresh(); }}
					{heightSheetSide}
					onHeightSheetSide={(side) => (heightSheetSide = side)}
					{reducedMotion}
					onToggleReducedMotion={() => { reducedMotion = !reducedMotion; updatePreferences({ ...preferences, reducedMotion }); }}
					motionSpeed={preferences.motionSpeed}
					onMotionSpeed={(motionSpeed) => updatePreferences({ ...preferences, motionSpeed })}
				>
					{#snippet sky()}
						{#if adapterServices !== null}
							<SkyControl
								environment={look.environment}
								onEnvironment={(preset) => void look.setEnvironment(preset)}
								editOnPaper={look.editOnPaper}
								onEditOnPaper={(value) => look.setEditOnPaper(value)}
								busy={look.busy}
							/>
						{/if}
					{/snippet}
				</StageDraftingControl>
			</div>
		{/if}

		<div class="stage-frame">
			{#if preview === null}
				<!--
				The Stage surface is a pointer-driven viewport, not a widget: it handles
				click (selection through eligible Plan fragments) and wheel (zoom), while
				keyboard viewing intents are handled once by the host's own window listener
				(3/2/f/arrows/Escape) so a focused element handler cannot double-apply them.
			-->
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
			<div
				class="stage"
				bind:this={stageEl}
				role="application"
				tabindex="0"
				data-paper={paperVisible ? 'true' : 'false'}
				data-cursor={viewEdit !== null ? (viewEdit.kind === 'turn' ? 'turn' : 'grabbing')
				: drag?.mode === 'pan' || drag?.mode === 'orbit' || (drag?.mode === 'adapter' && task === null) ? 'grabbing'
				: experienceLens.lookThroughSession() !== null ? 'look'
				: experienceTool === 'place' ? 'place-view'
				: hoverMove ? 'move'
				: task?.kind === 'layout-ink' || armedHostTool !== null ? 'draw'
				: 'select'}
				style:cursor={stageCursor ?? undefined}
				aria-label="Spatial stage"
				onpointerleave={() => { clearHover(); artwork.move(null); }}
				ondragover={(event) => { if (acceptsArtworkDrop(event.dataTransfer)) event.preventDefault(); }}
				ondrop={onArtworkDrop}
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerCancel}
				onlostpointercapture={onLostPointerCapture}
				onclick={onClick}
				onwheel={onWheel}
				oncontextmenu={(event) => { if (experienceLens.lookThroughSession() !== null) event.preventDefault(); }}
			>
				{#if boot.status === 'ready' || boot.status === 'empty'}
					<StageCanvas
						{scenePick}
						geometry={boot.snapshot.domain.geometry}
						sourceContentId={boot.snapshot.sourceContentId}
						layoutRevision={boot.snapshot.domain.unitRevisions.layout}
						scene={boot.snapshot.domain.scene}
						rooms={boot.snapshot.domain.rooms}
						{evaluation}
						{ghosts}
						{modelUrls}
						artworkScope={stageArtworkScope}
						artworkGhost={artworkResizeGhost ?? artwork.ghost}
						onArtworkError={(message) => { notice = message; }}
						plan={planView}
						planAppearance={preferences.planAppearance}
						paperInk2d={PAPER_TONES[preferences.paperTone2d].ink}
						paperInk3d={PAPER_TONES[preferences.paperTone3d].ink}
						{drafting}
						datumMeters={boot.snapshot.domain.datumMeters}
						contentBounds={paperContentBounds}
						snapshotBounds={stageContentBounds}
						environment={look.stageEnvironment}
						framedViewport={experienceLens.lookThroughSession() !== null ? throughViewport : null}
							{selection}
						hover={armedHostTool === 'erase' ? eraseHover : hoverSelection}
						hoverTone={armedHostTool === 'erase' ? 'erase' : 'hover'}
						heightMeters={lens === 'world' ? heightMeters : null}
						heightPlaneVisible={lens === 'world' && heightPlaneVisible}
						unfoldPinHovered={unfoldPinHovered}
						unfoldPinActive={sheetPinDrag !== null}
						unfoldAnchorPin={idleUnfoldPin?.point ?? null}
					/>
				{/if}
				<div class="overlay-layer">
					{#if experienceLens.lookThroughSession() === null}
						<StageOverlay
								lightGround={paperVisible || evaluation?.renderedReading === '3d'}
								{markers} marks={[...marks, ...look.stageMarks]} {roomLabels} candidates={candidatePreviews} viewportWidth={rect?.width ?? 0} viewportHeight={rect?.height ?? 0} {tracePreview} hostTools={hostToolOverlay} onActivateDisclosure={(id) => { if (facade?.activateDisclosure(id) === true) { facade.notifySurfaceChange(); } }} />
					{/if}
					{#if lens === 'experience' && evaluation !== null && experienceLens.lookThroughSession() === null}
						<ExperienceMarks
							{evaluation}
							placementGhost={experienceLens.placementGhost()}
							liveEdit={viewEdit}
							advanced={advancedViewId !== null}
							datum={experienceFloorDatum}
							rig={playback.status === 'idle' ? null : playback.sample}
							onLookThrough={experienceLens.lookThroughView}
							{showMarkers}
							{showFrustums}
							{showPaths}
							{showLabels}
							selectionOnly={showMode === 'selection'}
							onPlanePoint={pathAnchorPoint}
							beginPathDragLease={beginPathDragLease}
							endPathDragLease={endPathDragLease}
						/>
					{/if}
					{#if viewEdit?.moved && !viewEdit.advanced && viewEditPreview?.turn}
						<!-- Review round 3 (sheet §23): the View itself turns live and ExperienceMarks
						     draws the start-pose ghost; this layer adds only the arc and the angle. -->
						<svg class="view-edit-preview" data-view-edit-turn aria-hidden="true">
							<path class="turn-arc" d={viewEditPreview.turn.arc} />
							<text class="turn-angle" x={viewEditPreview.turn.labelAt[0]} y={viewEditPreview.turn.labelAt[1]} text-anchor="middle" dominant-baseline="middle">{viewEditPreview.turn.label}</text>
						</svg>
					{/if}
				</div>
				<!--
					The measured ruler is a Plan-only reading of the same evaluation. It
					hides as soon as the projection leaves Plan, not only once 3D settles,
					so it cannot float over a transition. World-lens chrome, like the Sheet.
				-->
				{#if lens === 'world' && evaluation?.projectionKind === 'plan-orthographic'}
					<StageScaleBar bar={draftingScaleBar} quiet={paperVisible} />
				{/if}



				<!--
					The toolbar sits over the pointer-driven Stage surface, so it stops its
					own pointer and click events: pressing Plan/3D/Fit must never also
					hit-test the world underneath the button.
				-->
				{#if lens === 'experience'}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="stage-actions"
					style:display={experienceLens.lookThroughSession() !== null ? 'none' : undefined}
					onclick={(event) => event.stopPropagation()}
					onpointerdown={(event) => event.stopPropagation()}
				>
					{#if lens === 'experience'}
						<!-- R217.S29 Show ▾: session-only Stage drawing flags beside the reading control. -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="show-control"
							data-show-control
							onclick={(event) => event.stopPropagation()}
							onpointerdown={(event) => event.stopPropagation()}
						>
							<button
								type="button"
								class="show-button"
								aria-expanded={showOpen}
								aria-haspopup="true"
								title="Show: what the Guide draws on the Stage"
								onclick={() => (showOpen = !showOpen)}
							>
								<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M8 2 1.5 5.5 8 9l6.5-3.5z" /><path d="m1.5 8.5 6.5 3.5 6.5-3.5" /></svg>Show
								{#if showOffCount > 0}<span class="show-off" data-show-off>{showOffCount} off</span>{/if}
							</button>
							{#if showOpen}
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="show-popover"
									role="dialog"
									tabindex="-1"
									aria-label="Show on the Stage"
									onkeydown={(event) => {
										if (event.key !== 'Escape') return;
										event.stopPropagation();
										showOpen = false;
									}}
								>
									<header><strong>Show</strong><span>editor only</span></header>
									<div class="show-mode" role="group" aria-label="Guide reading">
										<button type="button" aria-pressed={showMode === 'whole'} onclick={() => (showMode = 'whole')}>Whole Guide</button>
										<button type="button" aria-pressed={showMode === 'selection'} onclick={() => (showMode = 'selection')}>Selection only</button>
									</div>
									<label><input type="checkbox" bind:checked={showMarkers} /> Camera markers</label>
									<label><input type="checkbox" bind:checked={showFrustums} /> View frustums</label>
									<label><input type="checkbox" bind:checked={showPaths} /> Camera paths</label>
									<label><input type="checkbox" bind:checked={showLabels} /> View labels</label>
									<button
										type="button"
										class="show-all"
										onclick={() => {
											showMarkers = true;
											showFrustums = true;
											showPaths = true;
											showLabels = true;
										}}
									>Show all</button>
								</div>
							{/if}
						</div>
					{/if}
				</div>
				{/if}
				{#if lens === 'world'}
					<!--
						PLATE's Height Sheet in S02's right-edge slot. It is world-lens chrome:
						the control and its plane are hidden in Experience and return with the
						session height on the way back. The slot is a transparent wrapper: the
						Sheet places its own lane on the Stage, so it is not clipped by a box of
						the slot's own.
					-->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="stage-height-slot"
							onclick={(event) => event.stopPropagation()}
							onpointerdown={(event) => event.stopPropagation()}
						>
							<StageHeightSheet
								{heightMeters}
								ticks={heightTicks}
								pins={heightPins}
								snapIncrement={heightSnapIncrement}
								{reducedMotion}
								side={heightSheetSide}
								drawing={task?.kind === 'layout-ink'}
								bind:laneRef={sheetLaneEl}
								onSetHeight={setHeight}
								onAddPin={addHeightPin}
								onActiveChange={setHeightPlaneActive}
								onResetSubscribe={(onReset: () => void) =>
									heightSheet.subscribeReset('height-sheet-control', onReset)}
							/>
						</div>
					{/if}

					{#if keysOpen}
						<!--
						R217.S20: the Keys reference, opened from Find. Its rows read the dock's
						own shortcut map, so the list cannot drift from the keys that work.
					-->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<section
						class="keys-panel"
						aria-labelledby="keys-panel-title"
						data-keys-panel
						tabindex="-1"
						use:focusOnOpen
						onclick={(event) => event.stopPropagation()}
						onpointerdown={(event) => event.stopPropagation()}
						onkeydown={(event) => {
							if (event.key !== 'Escape') return;
							event.stopPropagation();
							keysOpen = false;
						}}
					>
						<h2 id="keys-panel-title">Keys</h2>
						<dl>
							<div><dt>⌘K · Ctrl+K</dt><dd>Find a subject, tool or operation</dd></div>
							<div><dt>3 · 2</dt><dd>3D and 2D readings</dd></div>
							<div><dt>F</dt><dd>Fit</dd></div>
							<div><dt>{STAGE_DOCK_SHORTCUTS.select} · {STAGE_DOCK_SHORTCUTS.ink} · {STAGE_DOCK_SHORTCUTS.measure} · {STAGE_DOCK_SHORTCUTS.erase} · {STAGE_DOCK_SHORTCUTS.library}</dt><dd>Select · Ink · Measure · Eraser · Objects</dd></div>
							<div><dt>Esc</dt><dd>Cancel the current step</dd></div>
						</dl>
						<button type="button" onclick={() => (keysOpen = false)}>Close keys</button>
					</section>
				{/if}

				{#if lens === 'experience' && adapterServices !== null && currentEnvelope !== null}
					<!-- The shared homes' controller: it renders nothing; the Index, Card and lower edge read it. -->
					{#key adapterServices}
						<ExperienceHomesHost services={adapterServices} snapshot={currentEnvelope} bind:controller={experienceController} />
					{/key}
				{/if}

				{#if lens === 'experience' && experienceLens.lookThroughSession() !== null}
					<!-- The capture frame sits beside the Card and above the Guide; helpers are hidden. -->
					<div class="through-slot" bind:this={throughFrameEl} data-through-frame>
						<div class="through-frame" aria-hidden="true"></div>
						<div class="through-safe" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
					</div>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="mode-pill through-pill"
						data-look-through-pill
						onclick={(event) => event.stopPropagation()}
						onpointerdown={(event) => event.stopPropagation()}
					>
						<span class="live-dot" aria-hidden="true"></span>
						<span>Looking through <b>{experienceLens.lookThroughSession()!.label}</b></span>
						{#if experienceLens.lookThroughMoved()}<span class="moved">moved</span>{/if}
						<button
							type="button"
							class="pill-primary"
							disabled={!experienceLens.lookThroughMoved() || (activeExperience?.busy ?? false)}
							title={experienceLens.lookThroughMoved() ? 'Write the provisional pose back to this View' : 'Adjust the camera or lens first'}
							onclick={() => void experienceLens.updateLookThrough(experienceLens.lookThroughConfirm() !== null)}>Update View</button
						>
						<button type="button" onclick={experienceLens.exitLookThrough}>Exit View Esc</button>
						<button type="button" title="Capture this provisional pose as a new View" onclick={() => void experienceLens.captureProvisional()}>Capture</button>
					</div>
					{#if experienceLens.lookThroughConfirm() !== null}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="through-confirm" role="alertdialog" tabindex="-1" aria-label="Update a shared View" onclick={(event) => event.stopPropagation()} onpointerdown={(event) => event.stopPropagation()}>
							<p>Also changes {experienceLens.lookThroughConfirm()!.join(', ')}.</p>
							<div class="through-confirm-actions">
								<button type="button" class="pill-primary" onclick={() => void experienceLens.updateLookThrough(true)}>Update View</button>
								<button type="button" onclick={() => experienceLens.clearLookThroughConfirm()}>Cancel</button>
							</div>
						</div>
					{/if}
				{/if}
				{#if pendingViewWrite !== null}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="through-confirm" role="alertdialog" tabindex="-1" aria-label="Update a shared View" onclick={(event) => event.stopPropagation()} onpointerdown={(event) => event.stopPropagation()}>
						<p>Also changes {pendingViewWrite.alsoIn.join(', ')}.</p>
						<div class="through-confirm-actions">
							<button type="button" class="pill-primary" onclick={() => void experienceLens.confirmPendingViewWrite()}>Update View</button>
							<button type="button" onclick={() => (experienceLens.clearPendingViewWrite())}>Cancel</button>
						</div>
					</div>
				{/if}
				{#if lens === 'experience' && showExperienceWelcome && experienceLens.lookThroughSession() === null && experienceTool === 'select'}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<aside class="experience-welcome" aria-label="Welcome to Experience" onpointerdown={(event) => event.stopPropagation()} onclick={(event) => event.stopPropagation()}>
						<span>Welcome to Experience</span>
						<h2>Turn this World into a visit</h2>
						<ol>
							<li><b>Present an object.</b> Select it, then choose <em>Present this</em> in its Card.</li>
							<li><b>Capture</b> keeps what the Stage shows as a View.</li>
							<li><b>Open a Guide</b> to put Stops in order, then press Play.</li>
						</ol>
						<footer>
							<small>Tips again: ⌘K → Show Experience tips</small>
							<button type="button" onclick={() => { showExperienceWelcome = false; rememberWelcomeDismissed(); }}>Got it</button>
						</footer>
					</aside>
				{/if}
				{#if selectedArtwork && facade && evaluation?.renderedReading === '3d' && canPlaceArtwork() && !artwork.armed}
					<ArtworkResizeOverlay entity={artworkResizeGhost ?? selectedArtwork} stage={facade}
						{evaluation} resizing={artworkResizeGhost !== null} onStart={startArtworkResize} />
				{/if}
				{#if lens !== 'experience' && notice}<p class="stage-note" role="status">{notice}</p>{/if}
			</div>
			{/if}

			{#if previewSurface !== null && previewViewRead !== null}
				{@const Surface = previewSurface}
				{@const entry = previewView?.entry ?? null}
				{@const read = previewViewRead}
				<!--
					The Preview takeover replaces the Stage rather than sitting on top of
					a live one: the authoring canvas is unmounted, so no inspection claim,
					gesture or overlay survives into the isolated visitor run.

					Once built, the visitor surface stays mounted and is hidden between
					sessions. Cleanup was never the ownership protocol: the Camera claim ends
					with the return, while keeping the renderer and scene alive turns a repeat
					entry into a new run instead of a rebuild. A hidden surface renders no
					frames (`on-demand` while inactive) and is inert, so it cannot take input.
				-->
				<div
					class="preview-takeover"
					role="region"
					aria-label="Visitor preview"
					hidden={preview === null}
					inert={preview === null}
				>
					<Surface
						geometry={read.geometry}
						scene={read.scene}
						rooms={read.rooms}
						graph={read.graph}
						program={entry === null ? null : entry.kind === 'presentations' ? (entry.program ?? null)
								: entry.program}
						experienceOptions={entry === null ? null : entry.kind === 'presentations' ? (entry.options ?? null)
								: entry.options}
						entryPresentationId={entry?.kind === 'program' ? entry.entryPresentationId : null}
						runEpoch={previewView?.epoch ?? 0}
						active={preview !== null}
						resolveTexture={(uri: string) =>
							isAllowedShippedTextureUri(uri) ? uri : null}
						{modelUrls}
						artworkScope={previewController.artworkScope}
						{reducedMotion}
						title={entry?.title ?? null}
						experienceTitle={entry?.title ?? null}
						startMode={previewRequestedMode ?? (entry?.kind === 'program' && entry.entryPresentationId !== null ? 'presentation' : 'welcome')}
						guideStopCount={previewGuideStats.stops}
						guideSeconds={previewGuideStats.seconds}
						viewLabels={previewViewLabels}
						onExit={previewController.close}
						environment={look.environment}
					/>
				</div>
			{:else if preview !== null}
				<p class="stage-note" role="status">Loading the visitor Preview…</p>
			{/if}
			{#if preview !== null}
				<p class="stage-note preview-actions-note" role="status">Project rename and delete are unavailable in Preview. Exit Preview to manage this project.</p>
			{/if}

			<EditorCard
				identity={preview === null && cardOpen ? shownCard.identity : null}
				facts={shownCard.facts}
				nameWriter={shownCard.nameWriter}
				renameRequest={cardRenameRequest}
				writer={shownCard.writer}
				actions={shownCard.actions}
				functions={shownCard.functions}
				kindLink={shownCard.kindLink}
				menu={shownCard.menu}
				back={shownCard.back}
				gesturing={cardGesturing}
				onClose={closeCard}
				onBringIntoView={shownCard.bringIntoView}
			/>

			{#if preview === null && inactiveTask}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
				<div
					class="inactive-task"
					role="region"
					aria-label="Inactive task"
					onpointerdown={(event) => event.stopPropagation()}
					onclick={(event) => event.stopPropagation()}
				>
					<p aria-live="polite">{inactiveTask.label} is inactive. Resume to continue, or close it.</p>
					<button type="button" onclick={resumeTask}>Resume {inactiveTask.label}</button>
					<button type="button" onclick={closeTask}>Close inactive task</button>
				</div>
			{/if}
			<!--
				PLATE's one lower column: the dock, the armed tool's palette (the invoked
				Instrument) and nothing else. A contributed tool appears here because its
				entry declares `home: 'dock'`; the shell owns no domain slot of its own.
			-->
			<div class="lower-column" hidden={preview !== null} inert={preview !== null} data-lower-column bind:this={lowerColumnEl}>
				{#if lens === 'world'}
					<WorldToolbar
						activeTool={activeWorldTool}
						{libraryOpen}
						plateOpen={worldPlateOpen}
						onPlateOpen={(open) => (worldPlateOpen = open)}
						onTool={armWorldTool}
						onLibrary={toggleWorldLibrary}
						onObjectPick={pickWorldObject}
						onMaterialPick={look.pickMaterial}
						lookShelf={look.libraryShelf}
						artworkShelf={scenePayload === null ? null : scenePayload.artworkLibrary ?? []}
						onArtworkPick={(entry) => { selectTool(); artwork.arm(entry); }}
						onArtworkImport={(files) => { selectTool(); void artwork.importFiles(files); }}
						onLookPick={look.pickLibraryEntry}
					>
						{#snippet plate()}
							{#if activeWorldTool === 'walls' || activeWorldTool === 'opening'}
								<InkPlate reading={inkReading} onMore={() => (paletteOpen = !paletteOpen)} />
							{:else if activeWorldTool === 'objects'}
								<ObjectsPlate onOpen={pickWorldObject} />
							{/if}
						{/snippet}
					</WorldToolbar>
					{#if contributedInstrument !== null && (contributedInstrument.presentation !== 'palette' || paletteOpen)}
						<StageInstrumentHost
							task={taskHost}
							onClose={closeTask}
							onCollapse={() => (paletteOpen = false)}
							instrument={contributedInstrument}
						/>
					{/if}
				{/if}
				{#if activeExperience !== null}
					<!-- Column order is bottom-up: the dock, its feedback line, then the Guide instrument above them. -->
					<ExperienceDock
						captureDisabled={experienceLens.captureReason() !== undefined}
						captureReason={experienceLens.captureReason()}
						guideOpen={experienceGuideOpen}
						placeArmed={experienceTool === 'place'}
						onPlaceView={experienceLens.togglePlaceView}
						onCapture={() => void activeExperience?.capture()}
						onToggleGuide={experienceLens.toggleGuide}
					/>
					{#if notice || activeExperience.feedback}
						<p
							class="experience-feedback"
							class:refused={!notice && activeExperience.feedback?.kind === 'refusal'}
							class:info={!notice && activeExperience.feedback?.kind === 'info'}
							class:success={!notice && activeExperience.feedback?.kind === 'success'}
							role="status"
						>
							{notice || activeExperience.feedback?.text}
						</p>
					{/if}
					{#if experienceGuideOpen}							<ExperienceGuide
								onClose={() => (experienceGuideOpen = false)}
								{playback}
							/>
					{/if}
				{/if}
				{#if contributedInstrument!==null && contributedInstrument.presentation !== 'palette'}
                <StageInstrumentHost task={paletteOpen ? taskHost : null} onClose={closeTask} instrument={contributedInstrument} />
				{/if}
			</div>
		</div>
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
	.stage-frame {
		position: absolute;
		inset: 0;
	}
	.stage {
		position: absolute;
		inset: 0;
		/* The mat is the Stage's default surface; Paper's vellum is drawn in the Canvas. */
		background: #152c26;
		outline: none;
		touch-action: none;
		cursor: var(--cursor-select);
	}
	.stage[data-cursor='turn'] { cursor: var(--cursor-turn); }
	.stage[data-cursor='grabbing'] { cursor: var(--cursor-grabbing); }
	.stage[data-cursor='look'] { cursor: var(--cursor-look); }
	.stage[data-cursor='place-view'] { cursor: var(--cursor-place-view); }
	.stage[data-cursor='draw'] { cursor: var(--cursor-draw); }
	/*
		PLATE's 1 CSS px inset perimeter separates Paper from the chassis. It is an
		inset shadow, not a border: the canvas rectangle, Camera aspect and pointer
		mapping stay unchanged, and it intercepts no picking.
	*/
	.stage[data-paper='true'] {
		box-shadow: inset 0 0 0 1px var(--stage-paper-edge);
	}
	.stage:focus-visible {
		box-shadow: inset 0 0 0 1px var(--shell-leaf);
	}
	.stage :global(canvas) {
		display: block;
		width: 100%;
		height: 100%;
	}
	.overlay-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	/*
		PLATE's one lower working edge: the dock, the armed tool's palette and nothing
		else, centred on the Stage. The column itself is a layout, not a surface — the
		Stage stays pointer-driven around it, and only the dock and the instrument take
		input — so it never turns the lower strip into a control bar.
	*/
	/*
		R217.S23 — the lower column never enters the Height Sheet's lane on either side. The
		lane is the Sheet's measured width (S22); the 1.5 rem is the Stage inset plus the gap the
		zoom cluster and the Card already keep. The dock is centred in what remains, and the
		palette and its upward disclosures wrap inside that width rather than overlap the Sheet.
	*/
	.lower-column {
		position: absolute;
		inset-inline-start: calc(12px + var(--index-cover, 0px));
		inset-inline-end: 12px;
		bottom: 10px;
		z-index: 11;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 0.4rem;
		pointer-events: none;
	}
	.lower-column > :global(.world-toolbar) {
		align-self: center;
	}
	.lower-column > :global(*) {
		pointer-events: auto;
	}
	.lower-column[hidden] { display: none; }
	/* The Index covers the Stage without participating in viewport layout. */
	.editor-body > :global(.plate-index) {
		position: absolute;
		z-index: 20;
		inset: 0 auto 0 0;
		box-shadow: 0 0.5rem 1.25rem rgb(6 20 14 / 35%);
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
	/* The constrained Index ends above the lower column and has a close scrim. */
	@media (max-width: 1100px) {
		.editor-body > :global(.plate-index) {
			/* Keep the dock's measured span, but never trust a stale zero reading. */
			bottom: calc(0.75rem + var(--lower-column-height, 0px) + 0.5rem);
			bottom: calc(0.75rem + max(var(--lower-column-height, 0px), 166px) + 0.5rem);
			width: min(var(--shell-index-width), 80%);
		}
		/*
			The scrim covers the Stage above the lower column and beneath it: the dock, the
			palette, the drafting controls and the Card all stack above it (z-index 6 to 12).
			Its tint is the forest chassis role, so the Stage reads as dimmed, not as a second
			surface.
		*/
		.index-scrim {
			position: absolute;
			z-index: 5;
			top: 0;
			right: 0;
			bottom: calc(0.75rem + var(--lower-column-height, 0px));
			left: 0;
			margin: 0;
			padding: 0;
			border: 0;
			background: rgb(0 0 0 / 0.12);
			cursor: pointer;
		}
		.index-scrim:focus-visible {
			outline: none;
		}
	}
	@media (pointer: coarse) {
		.editor-host { --shell-touch-target:44px; --shell-head-height:52px; }
	}
	/* The old second line, with the new tools beside it rather than replacing it. */
	.view-line {
		position: absolute;
		top: 10px;
		left: calc(10px + var(--index-cover, 0px));
		z-index: 8;
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 6px;
		max-width: calc(100% - 20px - var(--index-cover, 0px));
	}
	.view-line > :global(*) {
		pointer-events: auto;
	}
	/* Experience's Show control sits below the restored reading line. */
	.stage-actions {
		position: absolute;
		top: 54px;
		left: calc(10px + var(--index-cover, 0px));
		z-index: 6;
		display: flex;
		gap: 0.4rem;
	}
	/*
		R217.S20: the Keys reference Find opens. It sits where the stage's top-right
		action used to be, clear of the Height Sheet, and takes no pointer outside itself.
	*/
	.keys-panel {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		z-index: 9;
		display: grid;
		gap: 0.5rem;
		width: min(20rem, calc(100% - 1.5rem));
		padding: 0.75rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.4rem;
		background: var(--shell-forest);
		color: var(--shell-ink-light);
		box-shadow: 0 0.6rem 1.4rem rgb(6 20 14 / 40%);
		font-family: var(--shell-sans);
		font-size: var(--shell-text-body);
	}
	.keys-panel:focus-visible {
		outline: var(--shell-focus-ring);
		outline-offset: 2px;
	}
	.keys-panel h2 {
		margin: 0;
		font-size: var(--shell-text-body);
		font-weight: 600;
	}
	.keys-panel dl {
		display: grid;
		gap: 0.3rem;
		margin: 0;
	}
	.keys-panel dl > div {
		display: grid;
		grid-template-columns: 7.5rem 1fr;
		gap: 0.5rem;
	}
	.keys-panel dt {
		font-family: var(--shell-mono);
		font-size: var(--shell-text-utility);
		color: var(--shell-leaf-soft);
		font-variant-numeric: tabular-nums;
	}
	.keys-panel dd {
		margin: 0;
		font-size: var(--shell-text-utility);
		color: var(--shell-ink-quiet);
	}
	.keys-panel button {
		justify-self: start;
		min-height: var(--shell-control-height);
		padding: 0 0.6rem;
		border: 1px solid var(--shell-hairline);
		border-radius: 0.35rem;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	/*
		R217.S22: the slot is a transparent wrapper (the Sheet places its own lane and
		hint on the Stage). It keeps the Sheet's pointer isolation without a box.
	*/
	.stage-height-slot {
		display: contents;
	}
	/* R217.S28 — Place a View, Look through and the empty Stage coach. */
	.view-edit-preview {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.view-edit-preview .turn-arc {
		fill: none;
		stroke: var(--shell-gold-ink);
		stroke-width: 1.2;
		stroke-dasharray: 3 3;
	}
	.view-edit-preview .turn-angle {
		fill: var(--shell-gold-ink);
		font: 600 11px var(--shell-sans);
		paint-order: stroke;
		stroke: var(--shell-focus-halo);
		stroke-width: 3px;
	}
	/* R217.S29 Show ▾: a light disclosure beside the Stage reading control. */
	.show-control {
		position: relative;
		display: flex;
		align-items: center;
		padding: 3px;
		border: 1px solid var(--shell-hairline);
		border-radius: 10px;
		background: var(--shell-glass-light);
		box-shadow: var(--shell-furniture-shadow);
		backdrop-filter: blur(10px);
	}
	.show-button {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 28px;
		padding: 0 10px;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--shell-ink);
		font: inherit;
		font-size: 12.5px;
		cursor: pointer;
	}
	.show-button:hover {
		background: rgb(27 32 28 / 0.06);
	}
	.show-button[aria-expanded='true'] {
		background: var(--shell-action);
		color: var(--shell-on-action);
	}
	.show-button:focus-visible,
	.show-mode button:focus-visible,
	.show-all:focus-visible {
		outline: var(--shell-focus-ring-light);
		outline-offset: 1px;
	}
	.show-off {
		padding: 0 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--shell-gold) 28%, transparent);
		color: var(--shell-gold-ink);
		font-size: 11px;
		font-weight: 600;
	}
	.show-popover {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 8;
		width: 268px;
		display: grid;
		gap: 6px;
		padding: 12px;
		border: 1px solid var(--shell-hairline);
		border-radius: 14px;
		background: var(--shell-popover);
		color: var(--shell-ink);
		box-shadow: var(--shell-shadow);
		font-size: 12.5px;
	}
	.show-popover header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		margin-bottom: 2px;
	}
	.show-popover header strong {
		font-size: 13.5px;
	}
	.show-popover header span {
		color: var(--shell-ink-3);
		font-size: 11.5px;
	}
	.show-mode {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3px;
		padding: 3px;
		border-radius: 10px;
		background: var(--shell-surface-sunken);
	}
	.show-mode button {
		height: 28px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: var(--shell-ink-2);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.show-mode button[aria-pressed='true'] {
		background: var(--shell-field-focus);
		color: var(--shell-ink);
		font-weight: 600;
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.08);
	}
	.show-popover label {
		display: flex;
		align-items: center;
		gap: 9px;
		min-height: 30px;
		padding: 0 2px;
		border-radius: 8px;
		cursor: pointer;
	}
	.show-popover label:hover {
		background: var(--shell-hover);
	}
	.show-popover input[type='checkbox'] {
		appearance: none;
		-webkit-appearance: none;
		flex: none;
		width: 18px;
		height: 18px;
		margin: 0;
		border: 1.5px solid var(--shell-field-line-strong);
		border-radius: 5px;
		background: var(--shell-field);
		cursor: pointer;
	}
	.show-popover input[type='checkbox']:checked {
		border-color: var(--shell-leaf);
		background: var(--shell-leaf) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 14px no-repeat;
	}
	.show-popover input[type='checkbox']:focus-visible {
		outline: var(--shell-focus-ring-light);
		outline-offset: 2px;
	}
	.show-all {
		height: 28px;
		margin-top: 2px;
		border: 1px solid var(--shell-field-line);
		border-radius: 8px;
		background: var(--shell-field);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	/* Look through fills the Stage: a gold edge and 16:10 safe-frame ticks. */
	.through-slot {
		position: absolute;
		inset: 0;
		z-index: 2;
		container-type: size;
		pointer-events: none;
	}
	.through-frame {
		position: absolute;
		inset: 0;
		box-shadow: inset 0 0 0 3px var(--shell-gold);
	}
	.through-safe {
		position: absolute;
		left: 50%;
		top: 50%;
		width: min(100cqw - 48px, (100cqh - 24px) * 1.6);
		aspect-ratio: 16 / 10;
		transform: translate(-50%, -50%);
	}
	.through-safe i {
		position: absolute;
		width: 22px;
		height: 22px;
		border: 0 solid var(--shell-ink-light);
		filter: drop-shadow(0 0 1px rgb(0 0 0 / 0.6));
	}
	.through-safe i:nth-child(1) { left: 0; top: 0; border-width: 2px 0 0 2px; }
	.through-safe i:nth-child(2) { right: 0; top: 0; border-width: 2px 2px 0 0; }
	.through-safe i:nth-child(3) { left: 0; bottom: 0; border-width: 0 0 2px 2px; }
	.through-safe i:nth-child(4) { right: 0; bottom: 0; border-width: 0 2px 2px 0; }
	.mode-pill {
		position: absolute;
		left: 50%;
		top: 0.75rem;
		z-index: 6;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 4px 4px 12px;
		border-radius: 20px;
		background: var(--shell-glass-dark);
		color: var(--shell-ink-light);
		font-size: 12px;
		box-shadow: 0 8px 20px rgb(0 0 0 / 0.28);
	}
	.mode-pill button {
		height: 28px;
		padding: 0 11px;
		border: 0;
		border-radius: 14px;
		background: var(--shell-on-forest-wash-strong);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.mode-pill button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.mode-pill button.pill-primary {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
		font-weight: 600;
	}
	.mode-pill .live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--shell-leaf-soft);
	}
	.mode-pill .moved {
		color: var(--shell-leaf-soft);
		font-weight: 600;
	}
	/* Center Look through in the part of the Stage that the Index leaves visible. */
	.mode-pill.through-pill {
		--through-index-cover: var(--index-cover, 0px);
		left: calc((100% + var(--through-index-cover)) / 2);
		width: max-content;
		max-width: calc(100% - var(--through-index-cover) - 1.5rem);
		flex-wrap: wrap;
		justify-content: center;
	}
	@media (width <= 1100px) {
		.editor-body[data-index-open='true'] .through-pill {
			--through-index-cover: min(var(--shell-index-width), 256px, 80%);
		}
	}
	@media (width <= 440px) {
		.editor-body[data-index-open='true'] .through-pill {
			/* The narrow Index leaves too little room beside it for the controls. */
			--through-index-cover: 0px;
			z-index: 21;
		}
	}
	.through-confirm {
		position: absolute;
		left: 50%;
		top: 3.4rem;
		z-index: 7;
		transform: translateX(-50%);
		width: min(22rem, calc(100% - 2rem));
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--shell-popup-dark);
		color: var(--shell-ink-light);
		box-shadow: 0 10px 28px rgb(0 0 0 / 0.35);
		font-size: 12px;
	}
	.through-confirm p {
		margin: 0 0 8px;
	}
	.through-confirm-actions {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
	}
	.through-confirm button {
		height: 28px;
		padding: 0 10px;
		border: 0;
		border-radius: 7px;
		background: var(--shell-on-forest-wash-strong);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.through-confirm button.pill-primary {
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
		font-weight: 600;
	}
	.experience-welcome {
		position: absolute;
		left: calc(1rem + var(--index-cover, 0px));
		bottom: 4.75rem;
		width: min(18rem, calc(100% - 2rem));
		padding: 1rem;
		border: 1px solid var(--shell-hairline-strong);
		border-radius: 12px;
		background: var(--shell-surface-raised);
		box-shadow: var(--shell-shadow);
		color: var(--shell-ink);
		font-size: 0.8rem;
	}
	.experience-welcome > span {
		color: var(--shell-ink-3);
		font-size: var(--shell-text-meta);
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.experience-welcome h2 {
		margin: 0.25rem 0 0.6rem;
		font: 600 var(--shell-text-title)/1.25 var(--shell-sans);
	}
	.experience-welcome ol {
		margin: 0 0 0.75rem;
		padding-left: 1.1rem;
	}
	.experience-welcome li + li { margin-top: 0.35rem; }
	.experience-welcome footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.experience-welcome button {
		flex: none;
		padding: 0.35rem 0.65rem;
		border: 0;
		border-radius: 6px;
		background: var(--shell-action);
		color: var(--shell-on-action);
		cursor: pointer;
	}
	@media (pointer: coarse) {
		.mode-pill button,
		.through-confirm button {
			min-width: 44px;
			min-height: 44px;
		}
	}
		/* R217.S25: the Experience dock's feedback line sits on the lower edge, above its dock. */
	.experience-feedback {
		max-width: min(30rem, 100%);
		margin: 0;
		padding: 0.25rem 0.6rem;
		border-radius: 8px;
		background: var(--shell-dock-surface);
		color: var(--shell-ink-light);
		font-size: 0.78rem;
		line-height: 1.35;
	}
	/* Kind decides the styling, never the words: a success is never a refusal. */
	.experience-feedback.success { background: var(--shell-forest-raised); }
	.experience-feedback.info { background: var(--shell-forest-3); }
	.experience-feedback.refused { background: color-mix(in srgb, var(--shell-refuse) 70%, var(--shell-forest)); }
	.preview-takeover {
		position: absolute;
		inset: 0;
		z-index: 20;
		background: #050508;
	}
	.stage-note {
		position: absolute;
		left: 1rem;
		bottom: 6rem;
		/* A notice is information, never a control surface: it must not swallow a
		   click meant for a panel or a button underneath it. */
		pointer-events: none;
		max-width: min(28rem, calc(100% - 2rem));
		margin: 0;
		padding: 0.4rem 0.6rem;
		border-radius: 0.35rem;
		background: var(--shell-popup-dark);
		color: var(--shell-ink-light);
	}
	.preview-actions-note {
		top: 0.5rem;
		bottom: auto;
		color: var(--shell-leaf-soft);
	}
	/*
	 * Parked-task notice. It sits at the top-left because the lower edge already
	 * belongs to the instrument and the selection Card, and it must never be covered
	 * by another control: Resume is the only way back into a parked task.
	 */
	.inactive-task {
		position: absolute;
		/* Below the toolbar band: at a narrow width the two would overlap and this
		   panel would cover the only reading controls. */
		top: 3.5rem;
		left: 1rem;
		z-index: 9;
		max-width: min(22rem, calc(100% - 2rem));
		padding: 0.75rem;
		box-sizing: border-box;
		background: var(--shell-popup-dark);
		border: 1px solid var(--shell-line-on-forest);
	}
	.resume-offer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid var(--shell-hairline-dark);
		background: var(--shell-forest-raised);
		color: var(--shell-ink-light);
	}
	.resume-offer p {
		flex: 1 1 22rem;
		margin: 0;
		line-height: 1.4;
	}
	.resume-offer button {
		padding: 0.45rem 0.7rem;
		border: 1px solid var(--shell-line-on-forest);
		border-radius: 0.35rem;
		background: var(--shell-forest-raised);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.resume-offer button.primary {
		border-color: transparent;
		background: var(--shell-mode-active-bg);
		color: var(--shell-mode-active-ink);
	}
	.source-findings {
		position: absolute;
		top: calc(var(--shell-head-height) + 8px);
		left: 50%;
		z-index: 30;
		transform: translateX(-50%);
		max-width: min(32rem, calc(100% - 2rem));
		padding: 6px 12px;
		border: 1px solid var(--shell-hairline);
		border-radius: 12px;
		background: var(--shell-popover);
		box-shadow: var(--shell-shadow);
		color: var(--shell-ink);
		font-size: 12.5px;
	}
	.source-findings summary {
		display: flex;
		gap: 6px;
		align-items: baseline;
		cursor: pointer;
		list-style: none;
	}
	.source-findings strong {
		color: var(--shell-ink);
	}
	.source-findings.blocking strong {
		color: var(--shell-caution);
	}
	.source-findings-more {
		margin-left: auto;
		color: var(--shell-ink-3);
		text-decoration: underline;
	}
	.source-findings ul {
		margin: 6px 0 4px 1rem;
		padding: 0;
		color: var(--shell-ink-2);
	}
	.source-findings button {
		border: 1px solid var(--shell-field-line);
		border-radius: 8px;
		background: var(--shell-field);
		padding: 3px 9px;
		font: inherit;
		cursor: pointer;
	}
	/* Boot, absence and replacement are dialogs, so they share the light Card
	   surface and field grammar rather than the dark stage\'s forest panel. */
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
		font: 600 var(--shell-text-title)/1.25 var(--shell-sans);
		letter-spacing: -0.01em;
	}
	.boot-panel .boot-loading {
		margin: 0.3rem 0 0;
	}
	.boot-panel p {
		margin: 0 0 0.8rem;
		color: var(--shell-ink-2);
		font: var(--shell-text-body)/1.45 var(--shell-sans);
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

	@media (max-width: 720px) {
		/* Below the centered lens panel in a narrow shell, so the notice never
		   overlaps its buttons. */
		.stage-note {
			bottom: 0.5rem;
		}
	}
</style>
