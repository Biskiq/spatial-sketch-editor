<script lang="ts">
	import { roomLabelFacts, projectRoomLabels, type RoomLabelView } from '$lib/authoring/stage/room-labels';
	import { acceptedSceneRoomMembership } from '$lib/authoring/adapters/scene/room-membership';
	import { STAGE_PAINT_CSS } from '$lib/authoring/stage/shell/stage-paint';
	import {
		createWorldIndexModel,
		resolveWorldScope,
		type WorldScope
	} from '$lib/authoring/stage/shell/world-index-model';
	import { stageEnvelope, stageLayout, stageScene } from '$lib/authoring/stage/unit-stage-source';
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
	import { beforeNavigate, goto, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import {
		createProjectApi,
		createProjectAuth,
		ProjectPersistenceError,
		type ProjectApi,
		type PreparedProjectLifecycle,
		type ProjectLifecycleActionResult,
		type ProjectLifecyclePrepareResult
	} from '$lib/platform/project-persistence';
	import { perfInput, perfMark, perfMarksEnabled, perfMeasureSync, perfTracePreview, type PerfTracePreview } from '$lib/platform/perf-marks';
	import { installPerfWorkObserver } from '$lib/platform/perf-work';
	import {
		discardPendingCapture,
		persistPendingCapture,
		readPendingCapture
	} from '$lib/authoring/save/pending-capture';
	import { isSavedBaseToken, type SaveRequest } from '@portfolio/project-model/save';
	import {
		SCENE_ENVIRONMENT_SET_KIND,
		serializeProjectEnvelope,
		validateProjectEnvelope,
		type ProjectEnvelope,
		type SceneEnvironmentPreset
	} from '@portfolio/project-model/units';
	import { layoutSelectionReference, primaryEntry, sameReference, type StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
	import {
		bootEmpty,
		bootFromLoadOutcome,
		bootFromSourceJson,
		bootIntentFromSearch,
		bootStarterGallery,
		initialBootState,
		type BootIntent,
		type BootLoadOutcome,
		type BootState
	} from '$lib/authoring/stage/boot-state';
	import type { AdmissionContext, StageDomainRead, StageReadSnapshot } from '$lib/authoring/stage/source-admission';
	import { STARTER_TEMPLATES } from '$lib/authoring/stage/starter-gallery';
	import {
		createStageSession,
		runBoundLoad,
		type ReplacementEpochToken,
		type StageSession,
		type StageSelection,
		type StageTask
	} from '$lib/authoring/stage/stage-session';
	import {
		createStageFacade,
		type StageCardActionRecord,
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
		createApiSaveTransport,
		createHeadSave,
		createSaveState,
		type HeadSave,
		type ReloadOffer
	} from '$lib/authoring/save';
import {
	LAYOUT_DIMENSION_LIMIT_MESSAGE,
	planFragmentOf,
	planMembershipOf,
	type PlanEvaluation,
	type PlanMembershipReason
} from '@portfolio/layout-core';
	import { CAMERA_FOV, frameSubjectPose, viewPlacementPose, type ViewingIntent, type ViewportCameraState, type ViewportEvaluation, type ViewportRect } from '@portfolio/camera-core';
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
	import ShellIcon from '$lib/authoring/stage/shell/ShellIcon.svelte';
	import StageEnvironmentControl from '$lib/authoring/stage/shell/StageEnvironmentControl.svelte';
	import EditorCard from '$lib/authoring/stage/shell/EditorCard.svelte';
	import StageDock from '$lib/authoring/stage/shell/StageDock.svelte';
import StageDraftingControl from '$lib/authoring/stage/shell/StageDraftingControl.svelte';
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
	import ExperienceGuideWriter from '$lib/authoring/experience/ExperienceGuideWriter.svelte';
	import ExperienceSubjectWriter from '$lib/authoring/experience/ExperienceSubjectWriter.svelte';
	import {
		provideExperienceHomes,
		type ExperienceGuideTransport
	} from '$lib/authoring/experience/experience-homes';
	import type { ExperienceSubject } from '$lib/authoring/experience/experience-model';
	import {
		guideCardModel,
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
	import { previewEntryFor, type EnterablePreviewEntry } from '$lib/authoring/experience/preview-entry';
	import { guideTimeMapForProgram } from '$lib/authoring/experience/playback-map';
	import {
		createExperiencePlayback,
		shouldWritePlaybackSample
	} from '$lib/authoring/experience/playback.svelte';
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

	let boot = $state<BootState>(initialBootState(projectId, intent));
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
	/**
	 * The saved-base metadata of the project this host last loaded from the cloud.
	 *
	 * It is `null` for a baseline the host itself minted (starter, empty, opened
	 * source), so a Save there is a create rather than an update of someone else's
	 * version. It is read once, when the save state for that epoch is built.
	 */
	let pendingSavedBase = $state.raw<{
		readonly token: string | null;
		readonly revision: { readonly projectId: string; readonly revisionId: string;
		} | null;
		readonly contentId: string | null;
	} | null>(null);
	/**
	 * The PLATE Head's conditional-Save controller for the current epoch.
	 *
	 * T3.P01.S02 owns the state machine, the protocol and the server; this host only
	 * constructs it per epoch, mounts it, and keeps the replacement guard the only
	 * path that can install a remote document.
	 */
	let headSave = $state.raw<HeadSave | null>(null);
	/**
	 * TD-9 — the exact Save captured before a sign-in redirect, offered on return.
	 * It is never run until the creator chooses *Resume pending Save*.
	 */
	let resumeOffer = $state.raw<{
		readonly save: SaveRequest;
		readonly project: ProjectEnvelope;
	} | null>(null);
	/** Set only for the epoch that mounts a resumed capture. */
	let resumeSource: SaveRequest | null = null;
	/** The cloud row's canonical bytes, for the resumed capture's dirty comparison. */
	let remoteSavedCanonicalJson: string | null = null;
	let headSaveVersion = $state(0);
	let unsubscribeHeadSave: (() => void) | null = null;
	let projectActionBusy = $state(false);
	let deleteNavigationAuthorized = false;

	let historyState = $state<StageHistoryState>({
		canUndo: false,
		canRedo: false,
		depth: 1,
		position: 0,
		undoUnavailableReason: 'Nothing to undo yet — no change has been accepted.',
		redoUnavailableReason: 'Nothing to redo.'
	});
	let selection = $state<StageSelectionEntry | null>(null);
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

		// Preview returns to the lens it was entered from; a lens switch ends it.
		closePreview();
		clearHover();
		interruptPress('lens-change');
		// A notice describes the previous context; the lens is the new one.
		notice = '';
		if (facade?.changeLens(next)) {
			lens = session.lens();
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
			guideNamePrompt = null;
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
	/**
	 * The isolated visitor Preview session (T3.P02.S02).
	 *
	 * Entering is a **Camera handover**: the Stage's inspection run hands its one
	 * output to the Preview run through the landed F3 ticket protocol, and leaving
	 * returns it. `epoch` is the protocol run epoch and the interpreter's run
	 * identity at once, so an older Preview completion can neither drive the
	 * restored inspection output nor be accepted by a newer run.
	 */
	let preview = $state<{ readonly entry: EnterablePreviewEntry; readonly epoch: number;
	} | null>(null);
	/**
	 * The last entry a mounted visitor surface carries.
	 *
	 * The surface is built once and reused: leaving Preview hides it and ends its
	 * Camera claim, but keeps the loaded chunk, renderer and scene alive, so a
	 * repeat entry costs a fresh run rather than a rebuild. A new entry replaces
	 * these props and its epoch creates the next run.
	 */
	let previewView = $state<{ readonly entry: EnterablePreviewEntry; readonly epoch: number;
	} | null>(null);
	/**
	 * The read the mounted surface was built from, frozen at its entry.
	 *
	 * A hidden surface must not rebuild itself for every accepted authoring edit;
	 * the next entry supplies the current read instead.
	 */
	let previewViewRead = $state.raw<StageDomainRead | null>(null);
	type VisitorSurface = (typeof import('$lib/visitor/VisitorPreviewSurface.svelte'))['default'];
	let previewSurface = $state.raw<VisitorSurface | null>(null);
	let previewEpoch = 0;
	let previewBusy = $state(false);
	/** An explicit Card action's entry mode (guided or free), or null for the head Preview. */
	let previewRequestedMode = $state<'guided' | 'free' | null>(null);
	type PlaybackView = {
		readonly eye: [number, number, number];
		readonly target: [number, number, number];
		readonly fov: number;
	};
	/** S30 playback writes the one Camera through a set-view intent, never a pose copy. */
	function applyPlaybackView(view: PlaybackView): boolean {
		const stage = facade;
		if (stage === null) return false;
		const ticket = stage.inspectionTicket();
		if (ticket === null) return false;
		const result = stage.requestViewingIntent(
			{ kind: 'set-view', eye: view.eye, target: view.target, fovYDegrees: view.fov },
			ticket,
			performance.now() / 1000
		);
		return result.kind === 'accepted';
	}
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
	/** Experience review 1 (R5): the World's saved environment, and the unsaved "Plain Paper while editing". */
	const worldEnvironment = $derived.by(() => currentEnvelope?.units.scene.data.environment?.preset ?? 'paper');
	let editOnPaper = $state(false);
	let environmentWrite = $state.raw<StageAdapterServices | null>(null);

	async function setWorldEnvironment(preset: SceneEnvironmentPreset): Promise<void> {
		const services = adapterServices;
		if (services === null || environmentWrite === services || preset === worldEnvironment) return;
		environmentWrite = services;
		try {
			const outcome = await services.authoring.accept({
				version: 1,
				kind: SCENE_ENVIRONMENT_SET_KIND,
				operationId: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
				expectedRevision: services.stage.snapshot().acceptedRevision,
				targets: [],
				payload: { preset },
				allocatedIds: [],
				capturedInputs: []
			});
			if (adapterServices === services && outcome.kind === 'refused') notice = outcome.message;
		} finally {
			if (environmentWrite === services) environmentWrite = null;
		}
	}
	/** R217.S29 Show ▾ — session-only Stage drawing flags; all on by default. */
	let showOpen = $state(false);
	let showMode = $state<'whole' | 'selection'>('whole');
	let showMarkers = $state(true);
	let showFrustums = $state(true);
	let showPaths = $state(true);
	let showLabels = $state(true);
	const showOffCount = $derived([showMarkers, showFrustums, showPaths, showLabels].filter((on) => !on).length);
	/** The Presentation awaiting a first-Guide name (D8); null when none is asking. */
	let guideNamePrompt = $state<string | null>(null);
	/** The Presentation whose Views the Index shows: one at a time, following the selection. */
	let expandedPresentationId = $state<string | null>(null);
	/**
	 * R217.S25 (D10) — the one Card selection. A Presentation, View, Stop, transition or Guide
	 * replaces the Stage selection; nothing here moves the Camera.
	 */
	function selectExperienceSubject(subject: ExperienceSubject | null): void {
		facade?.select(null);
		selection = null;
		experienceController?.select(subject);
		cardOpen = true;
	}
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
	let placementPress = $state.raw<{ readonly pointerId: number; readonly start: StageTriple; readonly css: readonly [number, number] } | null>(null);
	let placementGhost = $state.raw<ReturnType<typeof viewPlacementPose>>(null);
	/** Present this in Plan aims the armed placement at the subject. */
	let placementAim = $state<StageTriple | null>(null);
	let lookThroughSession = $state<{ readonly viewId: string; readonly presentationId: string; readonly label: string } | null>(null);
	let lookThroughTick = $state(0);
	let lookThroughConfirm = $state<readonly string[] | null>(null);
	/** Scroll in Look through accumulates until one 0.25 m step is owed. */
	const EXPERIENCE_WELCOME_KEY = 'museum.experience.welcome-dismissed';
	let showExperienceWelcome = $state(false);

	function dismissExperienceWelcome(): void {
		showExperienceWelcome = false;
		try {
			localStorage.setItem(EXPERIENCE_WELCOME_KEY, '1');
		} catch {
			// A blocked preference store still allows dismissal for this visit.
		}
	}

	let lookThroughZoom: { pending: number; startedAt: number; applied: number } | null = null;
	const lookThroughPointers = new Map<number, { x: number; y: number; truck: boolean }>();
	/** The capture frame's measured local viewport for the one Stage renderer. */
	let throughViewport = $state<{ readonly left: number; readonly top: number; readonly width: number; readonly height: number } | null>(null);
	let throughFrameEl = $state<HTMLElement | null>(null);
	/** Monotone guard: only the newest Present-this run may capture framing. */


	/* --- R217.S30 — one Stage-owned ephemeral playback session ----------------- */

	const playback = createExperiencePlayback(() => activeExperience?.playbackSource ?? null);
	/** The exact settled inspection (pose **and** reading) Follow restores. */
	let playbackEntryStandpoint = $state.raw<ViewportCameraState | null>(null);
	/** The Stage that captured the standpoint; a replacement must never inherit it. */
	let playbackEntryStage = $state.raw<object | null>(null);
	/** A restore refused while a handoff owned the Camera; retry only on the same Stage. */
	let playbackRestorePending = $state.raw<{ readonly stage: object; readonly standpoint: ViewportCameraState } | null>(null);
	/** Playback is a Guide instrument: any takeover or armed tool ends it. */
	const playbackSuppressed = $derived(
		preview !== null ||
			previewBusy ||
			previewRequestedMode !== null ||
			lookThroughSession !== null ||
			placementPress !== null ||
			placementAim !== null ||
			experienceTool === 'place' ||
			lens !== 'experience' ||
			!experienceGuideOpen
	);

	/** A Card transport action opens its own Guide; the rail need not be open first. */
	function guideSeconds(guideId: string): number | null {
		const source = activeExperience?.playbackSourceFor(guideId) ?? null;
		if (source === null) return null;
		const map = guideTimeMapForProgram({
			program: source.program,
			transitions: source.transitions,
			graph: source.graph,
			entryStopId: source.entryStopId
		});
		return map.kind === 'ready' ? map.map.totalSeconds : null;
	}

	function playGuide(guideId: string, action: ExperienceGuideTransport): void {
		const controller = activeExperience;
		if (
			controller === null ||
			lens !== 'experience' ||
			preview !== null ||
			previewBusy ||
			previewRequestedMode !== null ||
			lookThroughSession !== null ||
			placementPress !== null ||
			placementAim !== null ||
			experienceTool === 'place'
		) return;
		controller.openGuide(guideId);
		experienceGuideOpen = true;
		void tick().then(() => {
			if (activeExperience !== controller || !experienceGuideOpen) return;
			playback.prepare();
			if (action.kind === 'start') playback.playFromStart();
			else if (action.kind === 'stop') playback.playFromStop(action.stopId);
			else playback.previewMove(action.occurrence);
		});
	}

	/** Synchronously end Follow and restore its exact entry before any handoff. */
	function stopPlaybackAndRestore(): void {
		const stage = facade;
		if (playbackRestorePending !== null && playbackRestorePending.stage !== stage) playbackRestorePending = null;
		playback.stop();
		if (playbackEntryStandpoint !== null) restorePlaybackEntry(stage);
	}

	function restorePlaybackEntry(stage: typeof facade = facade): boolean {
		const standpoint = playbackEntryStandpoint;
		if (standpoint === null) return true;
		if (stage === null || playbackEntryStage !== stage) {
			// Never write an old Stage's standpoint into a replacement.
			playbackEntryStandpoint = null;
			playbackEntryStage = null;
			return false;
		}
		if (!stage.camera.restoreStandpoint(standpoint)) {
			playbackRestorePending = { stage, standpoint };
			return false;
		}
		playbackEntryStandpoint = null;
		playbackEntryStage = null;
		playbackRestorePending = null;
		return true;
	}

	$effect(() => {
		const source = activeExperience?.playbackSource ?? null;
		playback.setReducedMotion(reducedMotion);
		playback.setBlocked(playbackSuppressed);
		if (source === null || lens !== 'experience' || !experienceGuideOpen) {
			stopPlaybackAndRestore();
			return;
		}
		// Derive as soon as the Guide opens; an accepted edit derives a new map
		// immediately and stops the old clock. Refused edits never reach here.
		if (playback.source !== source || playback.map === null) {
			if (playback.following) stopPlaybackAndRestore();
			playback.invalidate();
			playback.prepare();
		}
	});
	$effect(() => {
		if (playbackSuppressed && playback.status !== 'idle') stopPlaybackAndRestore();
	});
	$effect(() => {
		if (playback.following && playbackEntryStandpoint === null && facade !== null) {
			playbackEntryStandpoint = facade.camera.captureStandpoint();
			playbackEntryStage = facade;
		}
	});
	$effect(() => {
		if (!playback.following && playbackEntryStandpoint !== null) restorePlaybackEntry();
	});
	$effect(() => {
		const stage = facade;
		void lookThroughSession;
		void preview;
		if (playbackRestorePending === null) return;
		if (lookThroughSession !== null || preview !== null) return;
		if (playbackRestorePending.stage !== stage) {
			playbackRestorePending = null;
			return;
		}
		const pending = playbackRestorePending;
		playbackRestorePending = null;
		restorePlaybackEntry(stage);
		void pending;
	});
	$effect(() => {
		// A replacement owns a new Camera: drop, never transplant, the old entry.
		if (playbackEntryStage !== null && playbackEntryStage !== facade) {
			playbackEntryStandpoint = null;
			playbackEntryStage = null;
		}
		if (playbackRestorePending !== null && playbackRestorePending.stage !== facade) playbackRestorePending = null;
	});
	$effect(() => () => {
		if (playbackEntryStandpoint !== null) restorePlaybackEntry();
	});
	$effect(() => {
		if (playback.status !== 'playing' || playbackSuppressed) return;
		let last = performance.now();
		let frame = 0;
		const step = (now: number) => {
			const delta = (now - last) / 1000;
			last = now;
			playback.tick(delta);
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});
	// The one Camera write: an evaluated pose only during Follow. Plain play and
	// scrub move the playhead and rig puck, never the inspection.
	$effect(() => {
		const sample = playback.sample;
		if (sample === null || !shouldWritePlaybackSample(playback.following, playbackSuppressed)) return;
		const accepted = applyPlaybackView({
			eye: [sample.eye[0], sample.eye[1], sample.eye[2]],
			target: [sample.target[0], sample.target[1], sample.target[2]],
			fov: sample.fov
		});
		// A refused write stops the run instead of letting the playhead drift on
		// a Camera the Stage no longer owns.
		if (!accepted) playback.fail('The Stage refused the playback camera.');
	});
	$effect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			if (event.key === 'Escape' && playback.following) {
				event.preventDefault();
				playback.setFollow(false);
				return;
			}
			if (event.key !== ' ' || !experienceGuideOpen || lens !== 'experience' || preview !== null) return;
			if (activeExperience?.busy === true || playbackSuppressed) return;
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				target.closest('input, textarea, select, button, a[href], [contenteditable="true"], [role="menu"], [role="slider"]') !== null
			) return;
			event.preventDefault();
			playback.playPause();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	let advancedCamera = $state(false);
	const advancedViewId = $derived(
		advancedCamera && experienceTool === 'select' && lookThroughSession === null &&
			playback.status === 'idle' && preview === null && !previewBusy
			? activeExperience?.selectedView?.id ?? null : null
	);
	type ViewEditSession = {
		readonly viewId: string;
		readonly presentationId: string;
		readonly kind: ViewEditKind;
		readonly pointerId: number;
		readonly capture: Element;
		readonly start: AuthoredViewPose;
		eye: StageTriple;
		target: StageTriple;
		fov: number;
		readonly advanced: boolean;
		readonly sourceRevision: string;
		readonly handleId: string;
		readonly origin: readonly [number, number];
		readonly lease: { readonly active: boolean; release(): void };
		readonly resolve: (event: PointerEvent, id: string) => AuthoredViewPose | null;
		pointer: readonly [number, number];
		moved: boolean;
	};
	/** A live marker drag: the authored View is untouched until release. */
	let viewEdit = $state<ViewEditSession | null>(null);
	/** A marker edit that changes a View another Presentation also lists, awaiting confirmation. */
	let pendingViewWrite = $state<{
		readonly viewId: string;
		readonly presentationId: string;
		readonly pose: AuthoredViewPose;
		readonly alsoIn: readonly string[];
		readonly sourceRevision: string;
	} | null>(null);

	const experienceFloorDatum = $derived.by(() =>
		boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.datumMeters : 0
	);

	const lookThroughMoved = $derived.by(() => {
		void lookThroughTick;
		return facade?.camera.lookThrough()?.moved ?? false;
	});

	function floorPlane(): {
		readonly originMeters: StageTriple;
		readonly normal: StageTriple;
		readonly yawRadians: number;
		readonly datumMeters: number;
		readonly supportedLocalExtent: null;
	} {
		return {
			originMeters: [0, experienceFloorDatum, 0],
			normal: [0, 1, 0],
			yawRadians: 0,
			datumMeters: experienceFloorDatum,
			supportedLocalExtent: null
		};
	}

	/** The Floor point under one pointer, through Camera's own ray and plane hit. */
	function placementPoint(event: PointerEvent): StageTriple | null {
		const stage = facade;
		const id = stage?.evaluationId() ?? null;
		if (stage === null || id === null) return null;
		const ray = stage.pointerRay(absoluteCss(event), id);
		if (ray.kind !== 'ray') return null;
		const hit = stage.intersectWorkingPlane(ray.ray, floorPlane(), id);
		return hit.kind === 'intersected' ? hit.worldPoint : null;
	}

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

	function togglePlaceView(): void {
		if (lens !== 'experience' || viewEdit !== null) return;
		if (experienceTool === 'place') {
			experienceTool = 'select';
			placementAim = null;
			cancelPlacement();
			notice = '';
			return;
		}
		if (lookThroughSession !== null) exitLookThrough();
		stopPlaybackAndRestore();
		experienceTool = 'place';
		placementAim = null;
		notice = '';
	}

	function viewMarkAt(event: MouseEvent) {
		const target = event.target;
		if (!(target instanceof Element)) return null;
		const mark = target.closest('[data-view-mark]');
		const viewId = mark?.getAttribute('data-view-mark') ?? null;
		const kind = target.closest('[data-turn-grip]') !== null ? 'turn' : mark?.getAttribute('data-mark-kind') ?? null;
		return viewId === null || kind === null || mark === null ? null : { viewId, kind, mark };
	}

	function viewEditResolver(event: PointerEvent, pose: AuthoredViewPose, kind: ViewEditKind, mark: Element, id: string, advanced: boolean): ViewEditSession['resolve'] | null {
		const stage = facade;
		if (stage === null) return null;
		const origin = absoluteCss(event);
		const datum = experienceFloorDatum;
		const framed = (kind: AdvancedViewFraming['kind'], value: number, next: PointerEvent) =>
			frameView(pose, { kind, value: snapViewDrag(kind, value, next) }, datum);
		if (kind === 'move') {
			const grab = pathAnchorPoint(origin, datum);
			if (grab === null) return null;
			return (next) => {
				const point = pathAnchorPoint(absoluteCss(next), datum);
				if (point === null) return null;
				const x = pose.eye[0] + point[0] - grab[0];
				const z = pose.eye[2] + point[2] - grab[2];
				return moveViewOnFloor(pose, [advanced ? snapViewDrag('move', x, next) : x, datum,
					advanced ? snapViewDrag('move', z, next) : z]);
			};
		}
		if (kind === 'turn') {
			// Plan is orthographic. The datum gives the same X/Z even when the
			// authored eye is above Plan's depth range (including an empty World).
			const point = pathAnchorPoint(origin, datum);
			const grab = point === null ? null : yawFromEye(pose, point);
			if (grab === null) return null;
			return (next) => {
				const hit = pathAnchorPoint(absoluteCss(next), datum);
				const yaw = hit === null ? null : yawFromEye(pose, hit);
				if (yaw === null) return null;
				const degrees = angleDelta(yaw, grab) * 180 / Math.PI;
				return turnViewAboutEye(pose, snapViewDrag('turn', degrees, next) * Math.PI / 180);
			};
		}
		if (kind === 'lift') {
			const travel = (next: PointerEvent, evaluationId: string) => {
				const result = stage.pointerRay(absoluteCss(next), evaluationId);
				return result.kind !== 'ray' ? null : axisTravelFromRay({
					origin: [...pose.eye], direction: [0, 1, 0], rayOrigin: result.ray.origin, rayDirection: result.ray.direction
				});
			};
			const grab = travel(event, id);
			if (grab === null) return null;
			return (next, evaluationId) => {
				const distance = travel(next, evaluationId);
				return distance === null ? null : framed('lift', pose.eye[1] - datum + distance - grab, next);
			};
		}
		if (kind === 'tilt') {
			const tilt = viewTilt(pose);
			return (next) => framed('tilt', tilt - (next.clientY - origin[1]) * 0.45, next);
		}

		const side = mark.getAttribute('data-side') === '-1' ? -1 : 1;
		const apexX = mark.getAttribute('data-apex-x');
		const apexY = mark.getAttribute('data-apex-y');
		if (apexX !== null && apexY !== null) {
			const angle = (next: PointerEvent) => {
				const x = next.clientX - Number(apexX);
				const y = next.clientY - Number(apexY);
				return Math.hypot(x, y) < 4 ? null : Math.atan2(y, x);
			};
			const grab = angle(event);
			if (grab === null) return null;
			return (next) => {
				const current = angle(next);
				return current === null ? null : framed('lens', planLensFromDrag(pose.fov, grab, current, side), next);
			};
		}
		const initialRay = stage.pointerRay(origin, id);
		if (initialRay.kind !== 'ray' || Math.hypot(...pose.target.map((v, i) => v - pose.eye[i]!)) <= 1e-6) return null;
		const basis = createEditorCameraFramingBasis([...pose.eye], [...pose.target]);
		const forward: StageTriple = [basis.forward.x, basis.forward.y, basis.forward.z];
		const up: StageTriple = [basis.up.x, basis.up.y, basis.up.z];
		const depth = CAMERA_FRUSTUM_FAR_METRES;
		const center = basis.eye.clone().addScaledVector(basis.forward, CAMERA_LENS_OFFSET_METRES + depth);
		const plane = {
			originMeters: [center.x, center.y, center.z] as StageTriple,
			normal: forward,
			yawRadians: Math.atan2(forward[0], forward[2]) + Math.PI / 2,
			datumMeters: null,
			supportedLocalExtent: null
		};
		const grab = stage.intersectWorkingPlane(initialRay.ray, plane, id);
		const dragBasis = createEditorCameraFovDragBasis({
			eye: [...pose.eye], forward, up, depth, fov0: pose.fov,
			side: side === 1 ? 'top' : 'bottom',
			rayDirection: initialRay.ray.direction,
			p0: grab.kind === 'intersected' ? grab.worldPoint : null,
			startClientY: event.clientY
		});
		return (next, evaluationId) => {
			const ray = stage.pointerRay(absoluteCss(next), evaluationId);
			if (ray.kind !== 'ray') return null;
			const hit = stage.intersectWorkingPlane(ray.ray, plane, evaluationId);
			return framed('lens', evaluateEditorCameraFovDrag(
				dragBasis, hit.kind === 'intersected' ? hit.worldPoint : null,
				side === -1 && dragBasis.useSlider ? origin[1] * 2 - next.clientY : next.clientY,
				ray.ray.direction
			), next);
		};
	}

	function beginViewEdit(event: PointerEvent, viewId: string, kind: ViewEditKind, mark: Element): void {
		const stage = facade;
		const controller = activeExperience;
		const id = stage?.evaluationId() ?? null;
		const advanced = viewId === advancedViewId;
		const handleId = mark.getAttribute('data-advanced-handle');
		if (event.button !== 0 || (!advanced && event.shiftKey) || viewEdit !== null || pendingViewWrite !== null) return;
		if (stage === null || controller === null || controller.busy || id === null || evaluation === null) return;
		if (handleId !== null && !advanced) return;
		if (!advanced && kind === 'move' && evaluation.projectionKind !== 'plan-orthographic') return;
		const facts = controller.viewFacts(viewId);
		const pose = controller.viewPose(viewId);
		if (facts === null || pose === null) return;
		const resolve = viewEditResolver(event, pose, kind, mark, id, advanced);
		if (resolve === null) return;
		const acquisition = stage.acquireGesture({ owner: 'experience-view-edit', evaluationId: id, policy: 'cancel-on-reading-change' });
		if (acquisition.kind !== 'granted') {
			notice = `The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`;
			return;
		}
		// Advanced handles may go out of frame while held. Capture on the stable Stage.
		const capture = handleId !== null ? stageEl ?? null : event.target instanceof Element ? event.target : null;
		if (capture === null || !capturePointer(capture, event.pointerId)) {
			acquisition.lease.release();
			return;
		}
		if (handleId !== null) press.refuse(event.pointerId);
		clearHover();
		viewEdit = {
			viewId,
			presentationId: controller.selectedView?.id === viewId ? controller.selectedView.presentationId : facts.presentationId,
			kind,
			pointerId: event.pointerId,
			capture,
			start: pose,
			eye: [...pose.eye],
			target: [...pose.target],
			fov: pose.fov,
			advanced,
			handleId: handleId ?? '',
			origin: absoluteCss(event),
			pointer: stageCss(event),
			sourceRevision: controller.sourceRevision,
			lease: acquisition.lease,
			resolve,
			moved: false
		};
	}

	function updateViewEdit(event: PointerEvent): void {
		const edit = viewEdit;
		const id = facade?.evaluationId() ?? null;
		if (edit === null || id === null || event.pointerId !== edit.pointerId) return;
		const distance = Math.hypot(event.clientX - edit.origin[0], event.clientY - edit.origin[1]);
		const pose = distance < 2 ? edit.start : edit.resolve(event, id);
		if (pose === null) return;
		viewEdit = { ...edit, eye: [...pose.eye], target: [...pose.target], fov: pose.fov,
			pointer: stageCss(event), moved: viewEditMoved(edit.kind, edit.start, pose) };
	}

	function releaseViewEditPointer(edit: ViewEditSession): void {
		if (edit.capture.hasPointerCapture?.(edit.pointerId)) edit.capture.releasePointerCapture(edit.pointerId);
		edit.lease.release();
	}

	function viewEditIsCurrent(edit: ViewEditSession): boolean {
		return facade !== null && edit.lease.active && session.gesture() !== null &&
			activeExperience?.sourceRevision === edit.sourceRevision &&
			(!edit.advanced || (advancedViewId === edit.viewId && showMarkers &&
				(showFrustums || (edit.kind !== 'tilt' && edit.kind !== 'lens'))));
	}

	// Reading/source/selection changes cancel provisional work before it can become a write.
	$effect(() => {
		const edit = viewEdit;
		if (edit === null) return;
		void evaluation?.token.evaluationGeneration;
		if (!viewEditIsCurrent(edit)) untrack(cancelViewEdit);
	});

	function cancelViewEdit(): void {
		const edit = viewEdit;
		viewEdit = null;
		if (edit !== null) releaseViewEditPointer(edit);
	}

	async function endViewEdit(): Promise<void> {
		const edit = viewEdit;
		if (edit === null) return;
		const current = viewEditIsCurrent(edit);
		cancelViewEdit();
		if (current && edit.moved) await writeViewEdit(edit.viewId, edit.presentationId, edit, edit.sourceRevision);
	}

	async function writeViewEdit(viewId: string, presentationId: string, pose: AuthoredViewPose, sourceRevision: string): Promise<void> {
		const controller = activeExperience;
		if (controller === null || controller.sourceRevision !== sourceRevision || controller.busy) return;
		// Keep only the Camera payload, never the captured pointer or its live gesture.
		const next = { eye: pose.eye, target: pose.target, fov: pose.fov };
		const outcome = await controller.updateViewPose(viewId, next, presentationId);
		if (outcome.kind === 'needs-confirmation') {
			pendingViewWrite = { viewId, presentationId, pose: next, alsoIn: outcome.alsoIn, sourceRevision };
		} else if (outcome.kind === 'updated') {
			refresh();
		} else {
			notice = outcome.message;
		}
	}

	async function setAdvancedViewFraming(viewId: string, edit: AdvancedViewFraming): Promise<void> {
		const controller = activeExperience;
		if (controller === null || viewId !== advancedViewId || viewEdit !== null || pendingViewWrite !== null) return;
		const facts = controller.viewFacts(viewId);
		const start = controller.viewPose(viewId);
		if (facts === null || start === null) return;
		const pose = frameView(start, edit, experienceFloorDatum);
		if (viewEditMoved(edit.kind, start, pose)) await writeViewEdit(viewId, controller.selectedView?.presentationId ?? facts.presentationId, pose, controller.sourceRevision);
	}

	async function confirmPendingViewWrite(): Promise<void> {
		const pending = pendingViewWrite;
		pendingViewWrite = null;
		if (pending === null) return;
		const controller = activeExperience;
		if (controller === null || controller.sourceRevision !== pending.sourceRevision) return;
		const outcome = await controller.updateViewPose(pending.viewId, pending.pose, pending.presentationId, {
			confirmShared: true
		});
		if (outcome.kind === 'updated') {
			refresh();
		} else if (outcome.kind === 'refused') {
			notice = outcome.message;
		}
	}

	function beginPlacement(event: PointerEvent): void {
		if (event.button !== 0 || placementPress !== null) return;
		const point = placementPoint(event);
		if (point === null) {
			notice = 'Point at the Floor to place a View.';
			return;
		}
		if (!capturePointer(event.currentTarget as HTMLElement, event.pointerId)) return;
		placementPress = { pointerId: event.pointerId, start: point, css: absoluteCss(event) };
		placementGhost = placementPose(point, point);
	}

	function placementPose(start: StageTriple, current: StageTriple) {
		return viewPlacementPose({
			startFloorPoint: start,
			currentFloorPoint: current,
			aimPoint: placementAim,
			minimumDragMeters: 0,
			defaultAzimuthRadians: evaluation?.pose.azimuthRadians,
			floorDatumMeters: experienceFloorDatum,
			fovYDegrees: CAMERA_FOV.default
		});
	}

	function movePlacement(event: PointerEvent): void {
		const press = placementPress;
		if (press === null || event.pointerId !== press.pointerId) return;
		const point = placementPoint(event);
		if (point === null) return;
		const [x, y] = absoluteCss(event);
		const [startX, startY] = press.css;
		const dragged = isStageDrag({ x: startX, y: startY }, { x, y });
		placementGhost = placementPose(press.start, dragged ? point : press.start);
	}

	function cancelPlacement(): void {
		const press = placementPress;
		placementPress = null;
		placementGhost = null;
		if (press !== null && stageEl?.hasPointerCapture?.(press.pointerId)) stageEl.releasePointerCapture(press.pointerId);
	}

	function endPlacement(): void {
		const press = placementPress;
		const pose = placementGhost;
		placementPress = null;
		placementGhost = null;
		placementAim = null;
		if (press === null) return;
		if (stageEl?.hasPointerCapture?.(press.pointerId)) stageEl.releasePointerCapture(press.pointerId);
		if (pose === null) {
			notice = 'The View needs a target away from its eye.';
			return;
		}
		const controller = activeExperience;
		if (controller === null) return;
		void controller.placeView({ eye: pose.eye, target: pose.target, fov: pose.fovYDegrees }).then((outcome) => {
			if (outcome.kind === 'refused') {
				notice = outcome.message;
				return;
			}
			if (outcome.createdPresentation) {
				cardOpen = true;
				// X28.2: the new Presentation opens its existing inline name editor.
				cardRenameRequest += 1;
				notice = 'Presentation created; name it in the Card.';
			} else {
				notice = '';
			}
		});
	}

	function beginReaim(event: PointerEvent): void {
		if (event.button !== 0 && event.button !== 2) return;
		if (lookThroughPointers.size >= 2 || (lookThroughPointers.size > 0 && event.pointerType !== 'touch')) return;
		if (!capturePointer(event.currentTarget as HTMLElement, event.pointerId)) return;
		lookThroughPointers.set(event.pointerId, { x: event.clientX, y: event.clientY, truck: event.button === 2 });
	}

	function moveReaim(event: PointerEvent): void {
		const stage = facade;
		const press = lookThroughPointers.get(event.pointerId);
		if (stage === null || press === undefined) return;
		const dx = event.clientX - press.x;
		const dy = event.clientY - press.y;
		press.x = event.clientX;
		press.y = event.clientY;
		if (dx === 0 && dy === 0) return;
		const scale = evaluation?.targetPlaneMetersPerCssPixel ?? 0;
		const touches = lookThroughPointers.size === 2;
		const pan = press.truck || event.shiftKey || touches;
		const share = touches ? 0.5 : 1;
		const moved = pan
			? scale > 0 && stage.camera.truckLookThrough(-dx * scale * share, dy * scale * share)
			: stage.camera.turnLookThrough(dx * 0.0032, dy * 0.0032);
		if (moved) {
			lookThroughTick += 1;
			refresh();
		}
	}

	function endReaim(pointerId: number): void {
		lookThroughPointers.delete(pointerId);
		if (stageEl?.hasPointerCapture?.(pointerId)) stageEl.releasePointerCapture(pointerId);
	}

	/** Ease remaining wheel travel through Camera's existing step intent. */
	function advanceLookThroughZoom(now: number, finish = false): void {
		const zoom = lookThroughZoom;
		const stage = facade;
		if (zoom === null || stage === null || lookThroughSession === null) return;
		const progress = finish || reducedMotion ? 1 : Math.min(1, (now - zoom.startedAt) / 120);
		const next = zoom.pending * (1 - (1 - progress) ** 3);
		const delta = next - zoom.applied;
		zoom.applied = next;
		if (progress === 1) lookThroughZoom = null;
		if (delta !== 0 && stage.camera.stepLookThrough(delta)) lookThroughTick += 1;
	}

	function lookThroughView(viewId: string, presentationId?: string | null): void {
		if (viewEdit !== null) return;
		const stage = facade;
		const controller = activeExperience;
		if (stage === null || controller === null) return;
		const facts = controller.viewFacts(viewId);
		const pose = controller.viewPose(viewId);
		const owner = presentationId ?? facts?.presentationId ?? null;
		if (facts === null || pose === null || owner === null) {
			notice = 'That View is not in this project.';
			return;
		}
		// The moving Follow pose must never become Look through's entry memory.
		stopPlaybackAndRestore();
		const result = stage.camera.beginLookThrough({
			viewId,
			presentationId: owner,
			label: facts.label,
			eye: pose.eye,
			target: pose.target,
			fovYDegrees: pose.fov
		});
		if (result.kind === 'refused') {
			notice = result.message;
			return;
		}
		if (experienceTool === 'place') {
			experienceTool = 'select';
			cancelPlacement();
		}

		lookThroughSession = { viewId, presentationId: owner, label: facts.label };
		lookThroughConfirm = null;
		lookThroughTick += 1;
		refresh();
	}

	function exitLookThrough(): void {
		lookThroughZoom = null;
		for (const pointerId of lookThroughPointers.keys()) endReaim(pointerId);

		facade?.camera.endLookThrough();
		lookThroughSession = null;
		lookThroughConfirm = null;
		lookThroughTick += 1;
		refresh();
	}

	/** Lens and Eye height step only the provisional Camera; Update View commits them. */
	function setLookThroughLens(fovYDegrees: number): boolean {
		const stage = facade;
		if (stage === null || lookThroughSession === null) return false;
		if (!stage.camera.stepLookThroughLens(fovYDegrees)) return false;
		lookThroughTick += 1;
		refresh();
		return true;
	}

	function setLookThroughEyeHeight(metres: number): boolean {
		const stage = facade;
		if (stage === null || lookThroughSession === null) return false;
		if (!stage.camera.setLookThroughEyeHeight(metres, experienceFloorDatum)) return false;
		lookThroughTick += 1;
		refresh();
		return true;
	}

	async function updateLookThrough(confirmShared = false): Promise<void> {
		const controller = activeExperience;
		const stage = facade;
		const session = lookThroughSession;
		if (controller === null || stage === null || session === null) return;
		advanceLookThroughZoom(performance.now(), true);
		const provisional = stage.camera.provisionalView();
		if (provisional === null) return;
		const outcome = await controller.updateViewPose(
			session.viewId,
			{ eye: provisional.eye, target: provisional.target, fov: provisional.fovYDegrees },
			session.presentationId,
			{ confirmShared }
		);
		if (outcome.kind === 'needs-confirmation') {
			lookThroughConfirm = outcome.alsoIn;
			return;
		}
		if (outcome.kind === 'updated') {
			stage.camera.commitLookThrough();
			lookThroughConfirm = null;
			lookThroughTick += 1;
			refresh();
			return;
		}
		notice = outcome.message;
	}

	async function captureProvisional(): Promise<void> {
		const controller = activeExperience;
		const provisional = facade?.camera.provisionalView() ?? null;
		if (controller === null || provisional === null) return;
		await controller.capturePose({ eye: provisional.eye, target: provisional.target, fov: provisional.fovYDegrees });
	}

	/** Frame the new View through Camera without changing the Stage's reading. */
	async function presentThis(entityId: string, label: string): Promise<void> {
		const stage = facade;
		const controller = activeExperience;
		if (stage === null || controller === null) return;
		const bounds = stage.sceneBounds(entityId);
		if (stage.camera.state().reading === 'plan' || evaluation?.projectionKind === 'plan-orthographic') {
			placementAim = bounds === null ? null : [
				(bounds.min[0] + bounds.max[0]) / 2,
				(bounds.min[1] + bounds.max[1]) / 2,
				(bounds.min[2] + bounds.max[2]) / 2
			];
			stopPlaybackAndRestore();
			experienceTool = 'place';
			notice = `Place a View aimed at ${label}: click where the camera stands.`;
			return;
		}
		const viewerEye = stage.evaluation()?.eye;
		const framed = bounds === null || viewerEye === undefined ? null : frameSubjectPose({
			bounds,
			viewerEye,
			eyeYMeters: experienceFloorDatum + EYE_HEIGHT_STEPS[1]!.metres,
			fovYDegrees: LENS_STEPS[1]!.fovYDegrees,
			aspect: 16 / 10
		});
		if (framed === null) {
			notice = 'The Stage could not frame that subject.';
			return;
		}
		await controller.presentThisFramed(entityId, label, { eye: framed.eye, target: framed.target, fov: framed.fovYDegrees });
	}

	// Leaving the lens ends the provisional posture; the entry standpoint is never
	// restored into another lens's Camera.
	$effect(() => {
		if (lens !== 'experience' && lookThroughSession !== null) untrack(() => exitLookThrough());
	});

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

	provideExperienceHomes({
		controller: () => (lens === 'experience' ? experienceController : null),
		guideOpen: () => experienceGuideOpen,
		setGuideOpen: (open) => {
			experienceGuideOpen = open;
		},
		select: selectExperienceSubject,
		guideNamePrompt: () => guideNamePrompt,
		requestGuideName: (presentationId) => {
			guideNamePrompt = presentationId;
		},
		sceneSubject: () => experienceSceneSubject,
		openInWorld: () => changeLens('world'),
		advancedCamera: {
			on: () => advancedCamera,
			set: (on) => { advancedCamera = on; },
			eligible: (viewId) => advancedViewId === viewId,
			busy: () => viewEdit !== null || pendingViewWrite !== null,
			pose: (viewId) => viewEdit?.advanced && viewEdit.viewId === viewId && viewEdit.moved ? viewEdit : null,
			write: setAdvancedViewFraming
		},
		lookThroughViewId: () => lookThroughSession?.viewId ?? null,
		lookThroughMoved: () => {
			void lookThroughTick;
			return facade?.camera.lookThrough()?.moved ?? false;
		},
		lookThroughFraming: () => {
			void lookThroughTick;
			const provisional = facade?.camera.provisionalView() ?? null;
			return provisional === null
				? null
				: { fovYDegrees: provisional.fovYDegrees, eyeHeightMetres: provisional.eye[1] - experienceFloorDatum };
		},
		lookThroughLens: (fovYDegrees) => setLookThroughLens(fovYDegrees),
		lookThroughEyeHeight: (metres) => setLookThroughEyeHeight(metres),
		lookThrough: (viewId) => lookThroughView(viewId),
		exitLookThrough,
		updateLookThrough: () => updateLookThrough(),
		captureProvisional,
		presentThis,
		playback: () => playback,
		previewMode: (mode, guideId) => void openPreview(mode, guideId),
		guideSeconds,
		guideForStop: (stopId) => experienceController?.guideForStop(stopId) ?? null,
		playGuide
	});
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
			subject.kind === 'guide'
				? controller.guides.some((guide) => guide.id === subject.guideId)
				: subject.kind === 'view'
					? controller.selectedView !== null
					: subject.kind === 'stop' || subject.kind === 'transition'
						? controller.selectedStop !== null
						: controller.selectedPresentation !== null;
		if (!resolves) untrack(() => experienceFocus.select(null));
	});
	// A Guide-type subject (a Stop, a transition or the Guide itself) belongs to the Guide, so its
	// instrument opens. A Presentation, View or Stage subject never closes it. Lens entry clears the
	// subject, so this does not fight the closed-on-entry rule in changeLens.
	$effect(() => {
		const kind = activeExperience?.subject?.kind;
		if (kind !== 'stop' && kind !== 'transition' && kind !== 'guide') return;
		untrack(() => openExperienceGuide());
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
	/** The visitor-facing View labels Places reads; program ids stay the identity. */
	const previewViewLabels = $derived(
		new Map<string, string>(
			(currentEnvelope?.units.camera.data.views ?? []).map((view) => [view.id, view.label])
		)
	);
	/** The welcome chooser's guided estimate, from the one lowered time map. */
	const previewGuideStats = $derived.by(() => {
		const view = previewView;
		const graph = previewViewRead?.graph ?? null;
		if (view === null || view.entry.kind !== 'program' || graph === null) return { stops: 0, seconds: 0 };
		const read = guideTimeMapForProgram({
			program: view.entry.program,
			transitions: view.entry.transitions,
			graph,
			entryStopId: view.entry.program.entryStopId
		});
		return {
			stops: view.entry.program.stops.length,
			seconds: read.kind === 'ready' ? read.map.totalSeconds : 0
		};
	});
	let preparedLifecycleEpoch: ReplacementEpochToken | null = null;
	const projectActionsUnavailableReason = $derived.by(() => {
		void headSaveVersion;
		if (api === null) return 'Cloud project actions are unavailable because the Cloud service is not configured.';
		if (!activeProject()) return 'Open a saved Cloud project to rename or delete it.';
		if (!pendingSavedBase?.token) return 'Save this project to Cloud before renaming or deleting it.';
		const save = headSave?.snapshot();
		if (save?.busy || save?.pending) return 'Finish or retry the current Save before using project actions.';
		return null;
	});

	const previewAvailable = $derived(
		currentEnvelope !== null && currentEnvelope.units.experience.data.experiences.length > 0
	);
	let previewWarming = false;

	/**
	 * Build the visitor surface before the first press.
	 *
	 * The chunk, renderer and scene are the cold-entry cost, and none of them
	 * depends on the Camera handoff. Once the source can be Previewed the editor
	 * already knows its scene, so it builds the hidden surface at idle; the press
	 * then only mints the run and reveals it. A failed or skipped warm-up leaves
	 * the ordinary entry path untouched.
	 */
	async function warmPreview(): Promise<void> {
		if (previewWarming || previewSurface !== null || preview !== null) return;
		if (boot.status !== 'ready' && boot.status !== 'empty') return;
		const token = session.token();
		const snapshot = boot.snapshot;
		previewWarming = true;
		try {
			const module = await import('$lib/visitor/VisitorPreviewSurface.svelte');
			// A replacement during the load owns the source now: `activate` dropped
			// the old surface and the new source warms its own scene from its own
			// snapshot, so an old read is never installed over it.
			if (!session.isCurrent(token) || boot.snapshot !== snapshot) return;
			// A press that won the race owns the surface now; only the hidden
			// scene/read is ours to install, never its entry or epoch.
			if (preview !== null || previewView !== null) return;
			previewSurface = module.default;
			previewViewRead = snapshot.domain;
			const entry = previewEntryFor({
				envelope: stageEnvelope(snapshot),
				sourceContentId: snapshot.sourceContentId,
				sessionEpoch: snapshot.sessionEpoch,
				epoch: 0,
				focus: experienceFocus.read()
			});
			if (entry.kind !== 'unavailable' && previewView === null) previewView = { entry, epoch: 0 };
			perfMark('preview:warmed');
		} catch {
			// The press path loads and reports its own failure.
		} finally {
			previewWarming = false;
		}
	}

	$effect(() => {
		// The Experience lens is the intent to author what Preview shows; building
		// the hidden scene here means the first press is already warm. Building at
		// admission was measured to block the first dock interaction, so the cost
		// stays behind an explicit lens choice.
		const ready = boot.status === 'ready' || boot.status === 'empty';
		if (!ready || lens !== 'experience' || previewSurface !== null || preview !== null) return;
		void warmPreview();
	});

	/**
	 * Leave Preview and return the Camera output to the Stage.
	 *
	 * Only a valid return restores the inspection run. When no Preview claim
	 * survives — a source/project change ended it through the protocol's rebase —
	 * nothing is reinstated: the Stage continues under the claim the content change
	 * already minted, which is why a stale pose can never come back with it.
	 */
	function closePreview(): void {
		const stage = facade;
		const active = preview;
		preview = null;
		previewRequestedMode = null;
		// A hold entered before Preview may have been released while its keyup was
		// guarded; leaving Preview always reconciles Snap to the physical modifier.
		if (drafting.snapSuspended) patchDrafting({ snapSuspended: false });
		// The takeover stays mounted, so the Exit control the creator pressed is now
		// inside an inert subtree and would keep focus while invisible. Returning
		// drops focus to the document, as unmounting the takeover used to.
		if (typeof document !== 'undefined') {
			const focused = document.activeElement;
			if (focused instanceof HTMLElement && focused.closest('.preview-takeover') !== null) focused.blur();
		}
		if (active === null || stage === null) return;
		const returned = returnPreview(stage.camera);
		perfMark('preview:returned', { outcome: returned.kind });
		// A return can be refused when a newer owner claimed the output while the
		// isolated run was mounted. The Stage then owns nothing, so it mints its
		// own inspection claim before it reports rather than leaving every Stage
		// intent refused until a content change.
		if (returned.kind === 'refused') {
			stage.acquireInspection('exclusive');
			notice = returned.message;
		}
	}

	/**
	 * Enter Preview through the Camera handover.
	 *
	 * Order matters: the entry rule resolves first (an unavailable entry changes no
	 * ownership), then the isolated chunk loads (a failed load never takes the
	 * output), and only then does the Stage hand its output to the Preview run. A
	 * replacement or teardown that landed while the chunk loaded owns the Stage now,
	 * so the handover is not entered against the newer source.
	 */
	async function openPreview(mode: 'guided' | 'free' | null = null, guideId: string | null = null): Promise<void> {
		if (previewBusy || preview !== null || (boot.status !== 'ready' && boot.status !== 'empty')) return;
		perfMark('preview:press');
		const stage = facade;
		if (stage === null) return;
		previewRequestedMode = mode;
		// Playback is a Guide instrument, not an authoring mode that survives a
		// visitor takeover. Restore its exact entry synchronously before the
		// Camera ticket moves; waiting for an effect would capture the Follow pose.
		stopPlaybackAndRestore();
		const snapshot = boot.snapshot;
		const token = session.token();
		previewBusy = true;
		let entered = false;
		try {
			const runEpoch = nextPreviewRunEpoch(stage.camera.output(), ++previewEpoch);
			// A Card action names its own Guide; it must not inherit a selected Stop,
			// another open Guide, or a previously focused Presentation.
			const focus = guideId === null
				? experienceFocus.read()
				: { ...experienceFocus.read(), guideId, stopId: null, presentationId: null };
			const entry = previewEntryFor({
				envelope: stageEnvelope(snapshot),
				sourceContentId: snapshot.sourceContentId,
				sessionEpoch: snapshot.sessionEpoch,
				epoch: runEpoch,
				focus
			});
			if (entry.kind === 'unavailable') {
				notice = entry.message;
				return;
			}
			perfMark('preview:entry-resolved', { kind: entry.kind });
			// The visitor surface is its own chunk: the Stage first-load set never
			// carries it, and a second entry reuses what the first loaded. Only this
			// load can fail below, and it runs **before** ownership moves, so a failure
			// never leaves the output owned by a Preview that did not mount.
			if (previewSurface === null) {
				try {
					const module = await import('$lib/visitor/VisitorPreviewSurface.svelte');
					previewSurface = module.default;
					perfMark('preview:chunk-ready');
				} catch {
					notice = 'The visitor Preview could not be loaded; the Stage kept the Camera output.';
					return;
				}
			}
			// A load is asynchronous: the source this entry resolved against must still
			// be the mounted one before ownership moves.
			if (!session.isCurrent(token) || stage !== facade) return;
			const handover = enterPreview(stage.camera, {
				runEpoch,
				returnToken: previewReturnToken(snapshot.sessionEpoch, runEpoch)
			});
			if (handover.kind === 'refused') {
				notice = handover.message;
				return;
			}
			notice = '';
			perfMark('preview:handover', { runEpoch: handover.runEpoch });
			previewViewRead = snapshot.domain;
			previewView = { entry, epoch: handover.runEpoch };
			preview = { entry, epoch: handover.runEpoch };
			entered = true;
			perfMark('preview:entered', { runEpoch: handover.runEpoch, mode: entry.kind });
		} finally {
			// Any abandoned entry (unavailable, load failure, stale source or refused
			// handover) must not keep playback suppressed by a stale requested mode.
			if (!entered) previewRequestedMode = null;
			previewBusy = false;
		}
	}
	let evaluation = $state<ViewportEvaluation | null>(null);
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
	function addHeightPin(): void {
		heightSheet.addPin(heightMeters);
		heightPins = heightSheet.pins();
	}
	function removeHeightPin(heightMetersValue: number): void {
		heightSheet.removePin(heightMetersValue);
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
	$effect(() => {
		const shown = notice;
		if (lens !== 'experience' || shown === '') return;
		const timeout = setTimeout(() => { if (notice === shown) notice = ''; }, 4000);
		return () => clearTimeout(timeout);
	});
	let pendingReplacement = $state<null | 'starter' | 'empty' | 'source'>(null);
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
	 * TD-15 — the one pin hint belongs to this Stage session (this host), not to the
	 * module, so a fresh Stage shows its own first-pin hint.
	 */
	let pinHintSeen = $state(false);
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

	let epochCounter = 0;
	let revisionCounter = 0;

	/**
	 * Leaving the route is an exit like any other: unsaved work asks first.
	 *
	 * The signal is explicit (`unsavedWork`), not inferred from a counter, and a
	 * declined confirmation cancels the navigation. A clean project never sees a
	 * prompt, and this guard never saves anything by itself.
	 */
	beforeNavigate(({ cancel }) => {
		if (deleteNavigationAuthorized) return;
		if (confirmUnsavedWork()) return;
		cancel();
	});

	function admissionContext(): AdmissionContext {
		epochCounter += 1;
		revisionCounter += 1;
		return {
			sessionEpoch: `session-${epochCounter}-${projectId}`,
			acceptedRevision: { projectId, revisionId: `revision-${revisionCounter}` }
		};
	}

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

	/**
	 * Build the epoch's conditional-Save controller over T3.P01.S02's state machine.
	 *
	 * The saved base is what the cloud row reported when this project was loaded;
	 * a locally minted baseline has none. `loadRemote` is the conflict reader: it
	 * returns data to the Head, which hands the replacement offer to this host's
	 * guard — the state machine never installs a remote document itself.
	 */
	function buildHeadSave(mounted: StageAcceptanceHost, snapshot: StageReadSnapshot): HeadSave | null {
		if (api === null) return null;
		const saved = pendingSavedBase;
		const closure = snapshot.domain.closure;
		const state = createSaveState({
			coordinator: mounted.coordinator(),
			save: createApiSaveTransport(api),
			resume: resumeSource,
			onAuthRequired: async (request) => {
				// Capture the exact unit Save before the platform redirect. The draft
				// carries the precondition and operation ID, so the return visit can
				// resume it rather than mint a new write from a moved base. A redirect
				// without that draft would lose the operation, so storage failure keeps
				// the creator here with a visible reason instead of signing in.
				if (!persistPendingCapture(request)) {
					notice =
						'The pending Save could not be stored in this browser; sign-in was not started. Retry when browser storage is available.';
					return;
				}
				await auth?.signIn('save');
			},
			baseline: {
				savedBaseToken: saved?.token ?? null,
				// Only the cloud row knows the saved revision; a minted baseline and a
				// legacy row both report none rather than a locally invented one.
				savedRevision: saved?.revision ?? null,
				savedCanonicalJson: remoteSavedCanonicalJson ?? snapshot.canonicalJson,
				savedSourceContentId: saved?.contentId ?? snapshot.sourceContentId
			},
			loadRemote: async (id) => {
				const loaded = await api!.loadProject(id);
				return {
					projectId: id,
					document: loaded.document,
					savedBaseToken: loaded.savedBaseToken,
					savedRevision: loaded.savedRevision,
					savedSourceContentId: loaded.savedSourceContentId
				};
			}
		});
		return createHeadSave(state, {
			unavailableReason:
				closure.length === 0
					? null
					: `This source cannot execute (${closure[0]!.code}): ${closure[0]!.message} Save is unavailable until the resource requirement is satisfied.`
		});
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
		// A Preview run and the lens focus name identities from the replaced source.
		preview = null;
		// The warm surface was built from the replaced source's scene, compile and
		// program, so it cannot describe the new one: drop it (the chunk stays
		// cached) rather than keeping another project's scene alive behind the
		// editor. The lens effect warms the new source.
		previewView = null;
		previewViewRead = null;
		previewSurface = null;
		adapterServices = null;
		experienceFocus.reset();
		guideNamePrompt = null;
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
		unsubscribeHeadSave?.();
		unsubscribeHeadSave = null;
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
			if (preview !== null) closePreview();
			refreshHistory();
			// The Save state derives its status from the accepted source, so an
			// accepted edit is what makes the project dirty. Without this refresh
			// the Head keeps reporting the pre-edit status and the exit/replacement
			// guards never see unsaved work.
			headSave?.refresh();
			if (facade !== null && (boot.status === 'ready' || boot.status === 'empty')) {
				boot = { ...boot, snapshot: facade.snapshot() };
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
		headSave = buildHeadSave(mounted, snapshot);
		const mountedHeadSave = headSave;
		if (mountedHeadSave !== null) {
			unsubscribeHeadSave = mountedHeadSave.subscribe(() => {
				if (headSave === mountedHeadSave) {
					perfMeasureSync('save.page-state-signal', () => (headSaveVersion += 1));
				}
			});
		}
		// A resumed capture belongs to the epoch that consumed it.
		resumeSource = null;
		historyState = mounted.history();
		resetViewContext();
	}

	function applyState(next: BootState): void {
		// Every entry on this route is a replacement: a cloud boot, an explicit
		// current-format source open, the starter gallery or the empty baseline each
		// start a new project baseline, so they get a fresh session epoch and a fresh
		// view. The **content-change** transition (same project, new content, view
		// kept) is the seam's own install path, proved in `stage-content-change.test.ts`
		// and reached by accepted editing commands through the Stage acceptance host.
		if (next.status === 'ready' || next.status === 'empty') activate(next.snapshot);
		boot = next;
	}

	/**
	 * A refused **local** source action keeps the mounted project.
	 *
	 * An explicit Open or a conflict *Reload remote* is an attempt to replace the
	 * source on screen, not a fresh boot. The session, facade, acceptance history,
	 * selection and saved base all still describe the mounted project, so a
	 * refused parse, format or compile must be reported as a typed notice rather
	 * than assigned to `boot`: the template unmounts the Stage for a non-mounted
	 * state and offers no way back. Only an admitted replacement may reach
	 * `applyState`.
	 */
	function reportSourceRefusal(next: BootState, action: 'open' | 'reload'): void {
		const outcome = action === 'open' ? 'The source was not opened' : 'The remote copy was not installed';
		if (next.status === 'refused') {
			if (next.reason === 'dimension-limit') {
				notice = `${outcome}: ${LAYOUT_DIMENSION_LIMIT_MESSAGE} The current project is unchanged.`;
				return;
			}
			const reason =
				next.reason === 'invalid-json'
					? 'the JSON did not parse'
					: next.reason === 'project-mismatch'
						? 'it belongs to another project'
						: 'it is not the current document format';
			const issue = next.issues[0];
			notice = `${outcome}: ${reason}. The current project is unchanged.${
				issue === undefined ? '' : ` (${issue.path}: ${issue.message})`
			}`;
			return;
		}
		if (next.status === 'diagnostics') {
			const issue = next.issues[0];
			notice = `${outcome}: its canonical compile is blocked. The current project is unchanged.${
				issue === undefined ? '' : ` (${issue.path}: ${issue.message})`
			}`;
			return;
		}
		notice = `${outcome}: ${
			next.status === 'error' ? next.message : 'the source is unavailable'
		}. The current project is unchanged.`;
	}

	/* --- boot -------------------------------------------------------------- */

	async function load(projectIdToLoad: string, requestedIntent: BootIntent): Promise<void> {
		// A read is a new epoch's source: no previous saved base, saved bytes or
		// previous epoch's Save controller may survive into it.
		pendingSavedBase = null;
		remoteSavedCanonicalJson = null;
		headSave = null;
		boot = initialBootState(projectIdToLoad, requestedIntent);
		// A minted identity is a local editing intent, not a request to discover
		// whether the cloud happens to be reachable. Admit the empty baseline through
		// the same source path as every other mounted Stage and leave Save create-only.
		// Explicit opens still perform a cloud read so missing/forbidden/network
		// outcomes remain distinct.
		if (requestedIntent === 'create') {
			const token = session.token();
			const next = await bootEmpty(projectIdToLoad, admissionContext());
			if (!session.isCurrent(token)) return;
			applyState(next);
			perfMark(next.status === 'empty' ? 'f2:create-empty' : `f2:create-${next.status}`);
			if (next.status === 'empty') offerResumeSave({ createOnly: true });
			return;
		}
		if (api === null) {
			boot = { status: 'error', projectId: projectIdToLoad, message: 'Cloud service is unavailable' };
			return;
		}
		const token = session.token();
		// The cloud row's saved base is held per attempt, never in route state: a load
		// that a replacement or a local open supersedes must not leave its token behind.
		const captured: { base: typeof pendingSavedBase } = { base: null };
		let outcome: BootLoadOutcome | null;
		try {
			// The host performs only the project GET, as a load bound to this session
			// epoch: a replacement or teardown aborts it exactly once, and a completion
			// that lands after either is dropped instead of installing itself over the
			// newer source.
			outcome = await runBoundLoad(session, (signal) => fetchOutcome(projectIdToLoad, signal, captured, requestedIntent));
		} catch {
			// The GET was cancelled: the replacement that cancelled it owns the stage now.
			return;
		}
		if (outcome === null) return;
		const next = await bootFromLoadOutcome(boot, outcome, admissionContext());
		// Admission is asynchronous too, so the same question is asked again with its
		// answer: a replacement or teardown that happened during it still wins.
		if (!session.isCurrent(token)) return;
		// Only now, with the currency check passed, does this load's base become the
		// epoch's base: the save state built by `activate` reads it once, and only a
		// source that actually admitted gets a base to pair with.
		if (next.status === 'ready' || next.status === 'empty') {
			pendingSavedBase = captured.base;
			// The cloud row's canonical bytes are the saved side of a resumed capture's
			// dirty comparison; the captured bytes are the local work.
			remoteSavedCanonicalJson = next.snapshot.canonicalJson;
		}
		applyState(next);
		perfMark(next.status === 'ready' || next.status === 'empty' ? 'f2:cloud-admitted' : `f2:cloud-${next.status}`);
		// A loaded source is offered with whatever precondition its capture states.
		// An absent row is different: only a create-only capture can describe a Save
		// the server could still accept, so the offer is deliberately narrowed there.
		// The boot state itself is unchanged — `new` stays `new`, `missing` stays
		// `missing`; the offer is a separate, explicit creator action.
		if (next.status === 'ready' || next.status === 'empty') offerResumeSave({ createOnly: false });
		else if (next.status === 'new' || next.status === 'missing') offerResumeSave({ createOnly: true });
	}

	/**
	 * TD-9 — offer, never auto-run, a Save captured before the sign-in redirect.
	 *
	 * The `/` auth return path lands here with `resume-save=1`. A create-only
	 * capture is offered even when the cloud row is still absent: the Save never
	 * reached the server, so the return visit's 404 is exactly why the pending work
	 * must remain resumable. The draft's exact operation identity and precondition
	 * are preserved; mounting and retrying it are both explicit creator actions.
	 */
	function offerResumeSave(options: { readonly createOnly: boolean }): void {
		const url = new URL(page.url);
		if (url.searchParams.get('resume-save') !== '1') return;
		const pending = readPendingCapture();
		if (pending.status !== 'ready' || pending.project.id !== projectId) {
			// Consume the flag only once a draft was actually considered, so a direct
			// visit cannot leave a stale flag that re-offers a later draft by accident.
			url.searchParams.delete('resume-save');
			replaceState(`${url.pathname}${url.search}`, {});
			notice =
				pending.status === 'expired'
					? 'The pending Save expired; the cloud copy is unchanged.'
					: 'The pending Save is unavailable; the cloud copy is unchanged.';
			return;
		}
		if (options.createOnly && pending.save.capture.precondition.kind !== 'create-only') {
			// A row that does not exist cannot satisfy an expected saved base. Keep
			// the normal boot state and leave the flag for the next real load retry.
			return;
		}
		// Consume the flag so a refresh cannot re-offer a draft this visit resolved.
		url.searchParams.delete('resume-save');
		replaceState(`${url.pathname}${url.search}`, {});
		resumeOffer = pending;
		notice = 'A Save captured before sign-in is available. Resume it to save exactly that work.';
	}

	/**
	 * Mount the captured local source and replay its exact Save.
	 *
	 * Resuming is a **source replacement**, so it asks the same unsaved-work
	 * question as every other replacement: cancelling preserves the mounted
	 * content, selection, history and saved base. Admission is asynchronous, so the
	 * session token captured before it must still be current afterwards; a newer
	 * replacement wins and the captured source is never installed over it.
	 *
	 * The captured precondition is the base that Save states, so the server — not
	 * this host — decides whether that base still matches. A moved base answers a
	 * typed conflict and preserves the local work.
	 */
	async function resumePendingSave(): Promise<void> {
		const offer = resumeOffer;
		if (offer === null) return;
		// The Head disables Save for a source with executable closure. Resuming is
		// the same Save command, so it must respect the same visible refusal rather
		// than bypass the control and rely on the server to reject it.
		const control = headSave?.control();
		if (control?.unavailable === true) {
			notice = control.reason ?? 'Save is unavailable for this source.';
			return;
		}
		if (activeProject()) {
			const unsaved = headSave?.unsavedWork();
			if (
				unsaved?.kind === 'confirm' &&
				typeof window !== 'undefined' &&
				!window.confirm(unsaved.message)
			) {
				return;
			}
		}
		const token = session.token();
		// The captured Save states the local acceptance revision its operation was
		// minted under. Re-admitting the same bytes under a fresh revision would
		// make the retained capture un-replayable (the state compares revisions),
		// so the epoch is new but the acceptance identity is the capture's own.
		const context = admissionContext();
		const next = await bootFromSourceJson(offer.save.capture.canonicalJson, projectId, {
			sessionEpoch: context.sessionEpoch,
			acceptedRevision: offer.save.capture.acceptedRevision
		});
		// The admission is asynchronous: a replacement or teardown that happened
		// while it ran owns the Stage now, and this older capture must not overwrite
		// it. The offer remains available for an explicit retry.
		if (!session.isCurrent(token)) return;
		if (next.status !== 'ready' && next.status !== 'empty') {
			reportSourceRefusal(next, 'reload');
			return;
		}
		const precondition = offer.save.capture.precondition;
		pendingSavedBase = {
			token: precondition.kind === 'expected-saved-base' ? precondition.token : null,
			revision: pendingSavedBase?.revision ?? null,
			contentId: pendingSavedBase?.contentId ?? null
		};
		resumeSource = offer.save;
		resumeOffer = null;
		applyState(next);
		const outcome = await headSave?.retry();
		switch (outcome?.kind) {
			case 'saved':
				discardPendingCapture();
				notice = 'The pending Save completed.';
				break;
			case 'dirty':
				discardPendingCapture();
				notice = 'The pending Save completed; newer edits remain local.';
				break;
			case 'conflict':
				discardPendingCapture();
				notice = 'The cloud copy changed; the pending Save was not applied. Resolve the conflict explicitly.';
				break;
			case 'refused':
				notice = outcome.message;
				// A refused capture cannot become a successful replay under the same
				// operation ID; the state machine has already dropped it. Keep it only
				// for the resumable auth-required case.
				if (headSave?.snapshot().pending !== true) discardPendingCapture();
				break;
			case 'error':
				notice = outcome.message;
				break;
			default:
				break;
		}
	}

	function dismissResumeOffer(): void {
		resumeOffer = null;
		discardPendingCapture();
		notice = 'The pending Save was discarded; the cloud copy is unchanged.';
	}

	async function fetchOutcome(
		projectIdToLoad: string,
		signal: AbortSignal,
		captured: { base: typeof pendingSavedBase },
		requestedIntent: BootIntent
	): Promise<BootLoadOutcome> {
		try {
			const loaded = await api!.loadProject(projectIdToLoad, signal);
			// Capture the cloud row's saved base with the document it describes: the
			// save state is built from this pair, never from the admitted snapshot
			// alone (which cannot know the server's version token).
			captured.base = {
				token: loaded.savedBaseToken,
				revision: loaded.savedRevision,
				contentId: loaded.savedSourceContentId
			};
			return { kind: 'loaded', document: loaded.document };
		} catch (error) {
			// An abort is not a cloud answer, so it must not become one: rethrow so the
			// bound load drops the whole attempt.
			if (signal.aborted) throw error;
			// A minted guest identity starts local work before authentication. An
			// unrelated Open still reports forbidden, and Save remains create-only: no
			// project row is created until the creator explicitly saves.
			if (requestedIntent === 'create' && error instanceof ProjectPersistenceError && error.code === 'auth') {
				return { kind: 'not-found' };
			}
			return loadOutcomeFromError(error);
		}
	}

	function loadOutcomeFromError(error: unknown): BootLoadOutcome {
		if (error instanceof ProjectPersistenceError) {
			if (error.code === 'not-found') return { kind: 'not-found' };
			if (error.code === 'auth') return { kind: 'forbidden' };
			if (error.code === 'network') return { kind: 'network' };
			return { kind: 'server', message: error.message };
		}
		return { kind: 'network' };
	}

	function activeProject(): boolean {
		return boot.status === 'ready' || boot.status === 'empty';
	}

	function confirmUnsavedWork(): boolean {
		const unsaved = headSave?.unsavedWork();
		if (unsaved?.kind !== 'confirm') return true;
		return typeof window === 'undefined' || window.confirm(unsaved.message);
	}

	type LifecycleRead = {
		loaded: Awaited<ReturnType<ProjectApi['loadProject']>>;
		envelope: ProjectEnvelope;
		canonicalJson: string;
		publication: Awaited<ReturnType<ProjectApi['getPublicationStatus']>> | null;
	};

	function parseLifecycleEnvelope(loaded: Awaited<ReturnType<ProjectApi['loadProject']>>):
		| { kind: 'ready'; envelope: ProjectEnvelope; canonicalJson: string }
		| { kind: 'error'; message: string } {
		const validation = validateProjectEnvelope(loaded.document);
		if (
			!validation.success ||
			loaded.projectId !== projectId ||
			validation.envelope.id !== projectId ||
			loaded.name !== validation.envelope.name
		) {
			return { kind: 'error', message: 'Cloud returned an invalid or mismatched project document.' };
		}
		if (
			loaded.savedRevision !== null &&
			(loaded.savedRevision.projectId !== validation.envelope.acceptedRevision.projectId ||
				loaded.savedRevision.revisionId !== validation.envelope.acceptedRevision.revisionId)
		) {
			return { kind: 'error', message: 'Cloud project metadata does not match its saved document.' };
		}
		return {
			kind: 'ready',
			envelope: validation.envelope,
			canonicalJson: serializeProjectEnvelope(validation.envelope)
		};
	}

	function isMetadataOnlyRemoteChange(next: ProjectEnvelope): boolean {
		if (remoteSavedCanonicalJson === null) return false;
		let previous: ProjectEnvelope;
		try {
			const validation = validateProjectEnvelope(JSON.parse(remoteSavedCanonicalJson) as unknown);
			if (!validation.success || validation.envelope.id !== projectId) return false;
			previous = validation.envelope;
		} catch {
			return false;
		}
		return (
			serializeProjectEnvelope({
			...next,
			name: previous.name,
			acceptedRevision: previous.acceptedRevision
		}) === remoteSavedCanonicalJson
		);
	}

	function sameLifecycleEpoch(token: ReplacementEpochToken): boolean {
		return (
			session.isCurrent(token) && !tornDown && activeProject() && acceptance !== null
		);
	}

	async function readLifecycleProject(
		includePublication: boolean,
		token: ReplacementEpochToken
	): Promise<
		| { kind: 'ready'; value: LifecycleRead } | { kind: 'stale' } | { kind: 'error'; message: string }> {
		if (api === null) return { kind: 'error', message: 'Cloud project actions are unavailable.' };
		try {
			const value = await runBoundLoad(session, async (signal) => {
				const loaded = await api!.loadProject(projectId, signal);
				if (signal.aborted || !session.isCurrent(token)) return null;
				const publication = includePublication
					? await api!.getPublicationStatus(projectId, signal)
					: null;
				if (signal.aborted || !session.isCurrent(token)) return null;
				return { loaded, publication };
			});
			if (value === null || !session.isCurrent(token)) return { kind: 'stale' };
			const parsed = parseLifecycleEnvelope(value.loaded);
			if (parsed.kind !== 'ready') return parsed;
			return {
				kind: 'ready',
				value: { ...value, envelope: parsed.envelope, canonicalJson: parsed.canonicalJson }
			};
		} catch (error) {
			if (!session.isCurrent(token)) return { kind: 'stale' };
			return {
				kind: 'error',
				message: error instanceof ProjectPersistenceError
					? error.message
					: 'Cloud project metadata could not be loaded.'
			};
		}
	}

	function lifecyclePrepared(value: LifecycleRead): PreparedProjectLifecycle | null {
		if (!isSavedBaseToken(value.loaded.savedBaseToken)) return null;
		return {
			projectId,
			name: value.loaded.name,
			version: value.loaded.version,
			precondition: { kind: 'expected-saved-base', token: value.loaded.savedBaseToken },
			...(value.publication === null ? {} : { publication: value.publication })
		};
	}

	async function adoptRemoteLifecycleMetadata(
		value: LifecycleRead,
		token: ReplacementEpochToken,
		existingLock?: { release(): void }
	): Promise<{ kind: 'adopted' } | { kind: 'stale' } | { kind: 'error'; message: string }> {
		const mounted = acceptance;
		const save = headSave;
		const savedRevision = value.loaded.savedRevision ?? value.envelope.acceptedRevision;
		if (mounted === null || save === null || !sameLifecycleEpoch(token)) return { kind: 'stale' };
		const acquired = existingLock === undefined ? mounted.beginProjectAction() : null;
		if (acquired?.kind === 'refused') return { kind: 'error', message: acquired.message };
		try {
			const adopted = await mounted.adoptProjectName({ name: value.loaded.name, savedRevision });
			if (!sameLifecycleEpoch(token)) return { kind: 'stale' };
			if (adopted.kind === 'refused') return { kind: 'error', message: adopted.message };
			const baseline = {
				savedBaseToken: value.loaded.savedBaseToken,
				savedRevision,
				savedCanonicalJson: value.canonicalJson,
				savedSourceContentId: value.loaded.savedSourceContentId
			};
			if (!save.adoptSavedBase(baseline)) {
				return { kind: 'error', message: 'The current Save must finish before Cloud project metadata can be refreshed.' };
			}
			pendingSavedBase = {
				token: value.loaded.savedBaseToken,
				revision: savedRevision,
				contentId: value.loaded.savedSourceContentId
			};
			remoteSavedCanonicalJson = value.canonicalJson;
			return { kind: 'adopted' };
		} finally {
			if (existingLock === undefined && acquired?.kind === 'locked') acquired.release();
		}
	}

	async function prepareProjectLifecycle(includePublication: boolean): Promise<ProjectLifecyclePrepareResult> {
		if (api === null) return { kind: 'blocked', message: 'Cloud project actions are unavailable because the Cloud service is not configured.' };
		if (!activeProject() || pendingSavedBase?.token === null || pendingSavedBase?.token === undefined) {
			return { kind: 'blocked', message: 'Save this project to Cloud before renaming or deleting it.' };
		}
		const saveSnapshot = headSave?.snapshot();
		if (saveSnapshot === undefined || saveSnapshot.busy || saveSnapshot.pending) {
			return { kind: 'blocked', message: 'Finish or retry the current Save before using project actions.' };
		}
		const token = session.token();
		preparedLifecycleEpoch = token;
		const read = await readLifecycleProject(includePublication, token);
		if (read.kind === 'stale') return { kind: 'stale' };
		if (!sameLifecycleEpoch(token)) return { kind: 'stale' };
		if (read.kind === 'error') return { kind: 'error', message: read.message };
		const prepared = lifecyclePrepared(read.value);
		if (prepared === null) return { kind: 'blocked', message: 'This project has no current Cloud saved base. Reload it before renaming or deleting.' };
		if (includePublication && (read.value.publication === null || read.value.publication.activeVersion !== null)) {
			return { kind: 'blocked', message: 'Unpublish this project before deleting it.' };
		}
		if (!isMetadataOnlyRemoteChange(read.value.envelope)) {
			return { kind: 'blocked', message: 'Cloud project content changed. Resolve the Save conflict and reload remote before using project actions.' };
		}
		const savedRevision = read.value.loaded.savedRevision ?? read.value.envelope.acceptedRevision;
		if (
			pendingSavedBase?.token !== read.value.loaded.savedBaseToken ||
			read.value.canonicalJson !== remoteSavedCanonicalJson ||
			savedRevision.revisionId !== pendingSavedBase.revision?.revisionId ||
			read.value.loaded.name !== (boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.name : '')
		) {
			const adopted = await adoptRemoteLifecycleMetadata(read.value, token);
			if (adopted.kind === 'stale') return { kind: 'stale' };
			if (adopted.kind === 'error') return { kind: 'blocked', message: adopted.message };
		}
		if (!sameLifecycleEpoch(token)) return { kind: 'stale' };
		preparedLifecycleEpoch = token;
		return { kind: 'ready', prepared };
	}

	function retryableLifecycleError(error: unknown): boolean {
		return (
			error instanceof ProjectPersistenceError && ['network', 'server', 'project-busy'].includes(error.code)
		);
	}

	async function runBoundProjectAction<T>(
		token: ReplacementEpochToken,
		start: (signal: AbortSignal) => Promise<T>
	): Promise<{ kind: 'value'; value: T } | { kind: 'stale' }> {
		const controller = new AbortController();
		const unregister = session.writers().register('project-action', token, () => controller.abort());
		try {
			const value = await start(controller.signal);
			if (controller.signal.aborted || !sameLifecycleEpoch(token)) return { kind: 'stale' };
			return { kind: 'value', value };
		} catch (error) {
			if (controller.signal.aborted || !sameLifecycleEpoch(token)) return { kind: 'stale' };
			throw error;
		} finally {
			unregister();
		}
	}

	async function refreshLifecycleConflict(
		projectIdToRefresh: string,
		includePublication: boolean
	): Promise<ProjectLifecycleActionResult> {
		const token = session.token();
		preparedLifecycleEpoch = token;
		const read = await readLifecycleProject(includePublication, token);
		if (read.kind === 'stale' || !sameLifecycleEpoch(token)) return { kind: 'stale' };
		if (read.kind === 'error') return { kind: 'error', message: read.message, retryable: false };
		if (projectIdToRefresh !== projectId || !isSavedBaseToken(read.value.loaded.savedBaseToken)) {
			return { kind: 'error', message: 'Cloud returned invalid project metadata.', retryable: false };
		}
		if (includePublication && (read.value.publication === null || read.value.publication.activeVersion !== null)) {
			return { kind: 'refused', message: 'Unpublish this project before deleting it.' };
		}
		const safeToRetry = isMetadataOnlyRemoteChange(read.value.envelope);
		return {
			kind: 'conflict',
			message: safeToRetry
				? 'The Cloud saved base changed. Review the remote name, then explicitly refresh and retry.'
				: 'The Cloud project content changed. Reload remote to replace this session before retrying.',
			remoteName: read.value.loaded.name,
			retryPrepared: safeToRetry
				? { ...lifecyclePrepared(read.value)!, requiresExplicitRefresh: true }
				: null
		};
	}

	async function reconcileExplicitRenameRetry(
		prepared: PreparedProjectLifecycle,
		token: ReplacementEpochToken,
		lock: { release(): void }
	): Promise<
		| { kind: 'ready'; prepared: PreparedProjectLifecycle } | ProjectLifecycleActionResult> {
		if (!prepared.requiresExplicitRefresh) return { kind: 'ready', prepared };
		const read = await readLifecycleProject(false, token);
		if (read.kind === 'stale' || !sameLifecycleEpoch(token)) return { kind: 'stale' };
		if (read.kind === 'error') return { kind: 'error', message: read.message, retryable: false };
		if (!isSavedBaseToken(read.value.loaded.savedBaseToken) || !isMetadataOnlyRemoteChange(read.value.envelope)) {
			return { kind: 'refused', message: 'Cloud project content changed again. Reload remote before retrying.' };
		}
		const nextPrepared = lifecyclePrepared(read.value);
		if (nextPrepared === null) return { kind: 'refused', message: 'Cloud returned no current saved base.' };
		const adopted = await adoptRemoteLifecycleMetadata(read.value, token, lock);
		if (adopted.kind === 'stale') return { kind: 'stale' };
		if (adopted.kind === 'error') return { kind: 'refused', message: adopted.message };
		preparedLifecycleEpoch = token;
		return { kind: 'ready', prepared: nextPrepared };
	}

	async function renameCurrentProject(
		prepared: PreparedProjectLifecycle,
		name: string
	): Promise<ProjectLifecycleActionResult> {
		const token = preparedLifecycleEpoch;
		if (token === null || !sameLifecycleEpoch(token) || prepared.projectId !== projectId) return { kind: 'stale' };
		const mounted = acceptance;
		if (mounted === null) return { kind: 'stale' };
		const lock = mounted.beginProjectAction();
		if (lock.kind !== 'locked') return { kind: 'refused', message: lock.message };
		try {
			const reconciled = await reconcileExplicitRenameRetry(prepared, token, lock);
			if (reconciled.kind !== 'ready') return reconciled;
			const operation = reconciled.prepared;
			if (!sameLifecycleEpoch(token)) return { kind: 'stale' };
			if (name === operation.name && prepared.requiresExplicitRefresh) return { kind: 'unchanged' };
			const response = await runBoundProjectAction(token, (signal) =>
				api!.renameProject(projectId, { name, precondition: operation.precondition }, signal)
			);
			if (response.kind === 'stale') return { kind: 'stale' };
			const acknowledgement = response.value;
			const adopted = await mounted.adoptProjectName({ name: acknowledgement.name, savedRevision: acknowledgement.savedRevision });
			if (!sameLifecycleEpoch(token)) return { kind: 'stale' };
			if (adopted.kind === 'refused') return { kind: 'error', message: adopted.message, retryable: false };
			let baselineEnvelope: ProjectEnvelope;
			try {
				const validation = validateProjectEnvelope(JSON.parse(remoteSavedCanonicalJson ?? '') as unknown);
				if (!validation.success || validation.envelope.id !== projectId) throw new Error('Saved project baseline is unavailable.');
				baselineEnvelope = validation.envelope;
			} catch {
				return { kind: 'error', message: 'The saved project baseline could not be updated after rename.', retryable: false };
			}
			const canonicalJson = serializeProjectEnvelope({
				...baselineEnvelope,
				name: acknowledgement.name,
				acceptedRevision: acknowledgement.savedRevision
			});
			const nextBase = {
				savedBaseToken: acknowledgement.savedBaseToken,
				savedRevision: acknowledgement.savedRevision,
				savedCanonicalJson: canonicalJson,
				savedSourceContentId: acknowledgement.sourceContentId
			};
			if (!headSave?.adoptSavedBase(nextBase)) {
				return { kind: 'error', message: 'Rename completed, but the current Save baseline could not be refreshed.', retryable: false };
			}
			pendingSavedBase = {
				token: acknowledgement.savedBaseToken,
				revision: acknowledgement.savedRevision,
				contentId: acknowledgement.sourceContentId
			};
			remoteSavedCanonicalJson = canonicalJson;
			return { kind: 'renamed', name: acknowledgement.name, version: acknowledgement.version };
		} catch (error) {
			if (error instanceof ProjectPersistenceError && error.code === 'conflict') {
				return await refreshLifecycleConflict(projectId, false);
			}
			return {
				kind: error instanceof ProjectPersistenceError && ['invalid', 'auth', 'not-found'].includes(error.code) ? 'refused' : 'error',
				message: error instanceof ProjectPersistenceError ? error.message : 'Cloud rename failed.',
				retryable: retryableLifecycleError(error)
			};
		} finally {
			lock.release();
		}
	}

	async function deleteCurrentProject(prepared: PreparedProjectLifecycle): Promise<ProjectLifecycleActionResult> {
		const token = preparedLifecycleEpoch;
		if (token === null || !sameLifecycleEpoch(token) || prepared.projectId !== projectId) return { kind: 'stale' };
		if (!confirmUnsavedWork()) return { kind: 'refused', message: 'Delete canceled. Your local work is unchanged.' };
		const mounted = acceptance;
		if (mounted === null) return { kind: 'stale' };
		const lock = mounted.beginProjectAction();
		if (lock.kind !== 'locked') return { kind: 'refused', message: lock.message };
		try {
			const response = await runBoundProjectAction(token, (signal) =>
				api!.deleteProject(projectId, { precondition: prepared.precondition }, signal)
			);
			if (response.kind === 'stale') return { kind: 'stale' };
			return { kind: 'deleted', cleanup: response.value.cleanup };
		} catch (error) {
			if (error instanceof ProjectPersistenceError && error.code === 'conflict') {
				return await refreshLifecycleConflict(projectId, true);
			}
			if (error instanceof ProjectPersistenceError && error.code === 'unpublish-first') {
				return { kind: 'refused', message: error.message };
			}
			return {
				kind: error instanceof ProjectPersistenceError && ['invalid', 'auth', 'not-found'].includes(error.code) ? 'refused' : 'error',
				message: error instanceof ProjectPersistenceError ? error.message : 'Cloud deletion failed.',
				retryable: retryableLifecycleError(error)
			};
		} finally {
			lock.release();
		}
	}

	async function finishCurrentProjectAction(
		result: Extract<ProjectLifecycleActionResult, { kind: 'renamed' | 'deleted' | 'unchanged' }>
	): Promise<void> {
		if (result.kind !== 'deleted') return;
		const token = preparedLifecycleEpoch;
		if (token === null || !sameLifecycleEpoch(token)) return;
		deleteNavigationAuthorized = true;
		// A server acknowledgement is the only path that retires this session.
		// Route teardown then releases its normal Stage, history and asset owners.
		session.dispose();
		const query = new URLSearchParams({ deleted: result.cleanup });
		if (boot.status === 'ready' || boot.status === 'empty') query.set('name', boot.snapshot.domain.name);
		await goto(`/projects?${query.toString()}`);
	}

	async function reloadLifecycleRemote(): Promise<boolean> {
		if (api === null || !activeProject()) return false;
		const token = session.token();
		const loaded = await runBoundLoad(session, (signal) => api!.loadProject(projectId, signal));
		if (loaded === null || !session.isCurrent(token)) return false;
		return applyReloadOffer({
			kind: 'reload',
			projectId,
			document: loaded.document,
			savedBaseToken: loaded.savedBaseToken,
			savedRevision: loaded.savedRevision,
			savedSourceContentId: loaded.savedSourceContentId
		});
	}

	/**
	 * A conflict's explicit *Reload remote*: the offer is data, and this host's
	 * replacement path is the only thing that installs it.
	 */
	async function applyReloadOffer(offer: ReloadOffer): Promise<boolean> {
		if (offer.kind === 'unavailable') {
			notice = 'The remote copy could not be loaded; your local work is unchanged.';
			return false;
		}
		if (!confirmUnsavedWork()) return false;
		// TD-10: the accepted offer is this epoch's, not whichever epoch is mounted
		// when its admission resolves. Capture the token before admitting, so a
		// `Reload remote` that a newer replacement (or teardown) superseded is
		// abandoned instead of installing over the project the creator now has.
		const token = session.token();
		const next = await bootFromSourceJson(JSON.stringify(offer.document), projectId, admissionContext());
		// Admission itself is asynchronous: a stale offer installs nothing, adopts no
		// saved base and reports no refusal over the newer session.
		if (!session.isCurrent(token)) return false;
		// Only a source that actually admitted replaces the mounted project and
		// becomes this epoch's saved base. A failed reload keeps the local source,
		// its history/selection and the saved base the Head is still saving against.
		if (next.status !== 'ready' && next.status !== 'empty') {
			reportSourceRefusal(next, 'reload');
			return false;
		}
		pendingSavedBase = {
			token: offer.savedBaseToken,
			revision: offer.savedRevision,
			contentId: offer.savedSourceContentId
		};
		remoteSavedCanonicalJson = next.snapshot.canonicalJson;
		applyState(next);
		return true;
	}

	function requestReplacement(action: 'starter' | 'empty' | 'source'): void {
		if (projectActionBusy) return;
		if (activeProject()) {
			// Unsaved work is signalled explicitly and confirmed before the guard even
			// opens: a replacement would discard the local source, so no path may skip
			// this question.
			if (!confirmUnsavedWork()) return;
			// Explicit project-replacement guard: nothing is swapped until the creator
			// confirms, and the guard is the same host path for every entry.
			pendingReplacement = action;
			return;
		}
		void runReplacement(action);
	}

	async function runReplacement(action: 'starter' | 'empty' | 'source'): Promise<void> {
		pendingReplacement = null;
		if (action === 'starter') {
			// A minted baseline has no cloud saved base: its first Save is a create.
			pendingSavedBase = null;
			remoteSavedCanonicalJson = null;
			applyState(await bootStarterGallery(projectId, admissionContext()));
			return;
		}
		if (action === 'empty') {
			pendingSavedBase = null;
			remoteSavedCanonicalJson = null;
			applyState(await bootEmpty(projectId, admissionContext()));
			return;
		}
		if (action === 'source') {
			await openSourceJson();
		}
	}

	async function openSourceJson(): Promise<void> {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = 'application/json,.json';
		const file = await new Promise<File | null>((resolve) => {
			input.onchange = () => resolve(input.files?.[0] ?? null);
			input.click();
		});
		// A cancelled dialog changes nothing — including the saved base the current
		// Head is still saving against.
		if (file === null) return;
		// F2 starts when the file actually exists: the dialog itself is not the flow.
		perfMark('f2:open-requested', { bytes: file.size });
		// TD-10: reading and admitting the chosen file is asynchronous, and the epoch
		// this Open belongs to is the one captured here — not whichever project is
		// mounted when the admission resolves. A superseded Open is abandoned rather
		// than installed over the newer project, its history and its saved base.
		const token = session.token();
		const next = await bootFromSourceJson(await file.text(), projectId, admissionContext());
		// A stale result reports nothing: neither a success nor a refusal may appear
		// for an action the creator has already replaced.
		if (!session.isCurrent(token)) return;
		if (next.status !== 'ready' && next.status !== 'empty') {
			reportSourceRefusal(next, 'open');
			return;
		}
		// A successfully opened source is a locally minted baseline with no cloud
		// row behind it, so its first Save is a create. Set this only once the
		// source has actually admitted; a refused open must not clear it.
		pendingSavedBase = null;
		remoteSavedCanonicalJson = null;
		applyState(next);
		perfMark('f2:open-admitted', { sourceContentId: next.snapshot.sourceContentId });
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
		const session = lookThroughSession;
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
		advanceLookThroughZoom(performance.now());
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
		const framed = lookThroughSession === null ? null : measureThroughFrame();
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
		const groundReach = !editOnPaper && worldEnvironment !== 'paper' ? WORLD_ENVIRONMENT_GROUND_RADIUS_METERS : undefined;
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
			showExperienceWelcome = localStorage.getItem(EXPERIENCE_WELCOME_KEY) !== '1';
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

		void load(projectId, intent);

		return () => {
			// Order matters: the flag and the session teardown both run before the
			// facade is disposed, so a load already past its fetch sees a torn-down
			// session (`isCurrent` is false, the registered abort fires) and drops its
			// result instead of mounting a second stage.
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
			unsubscribeHeadSave?.();
			unsubscribeContributions = null;
			unsubscribeHeadSave = null;
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
		if (viewEdit !== null) return;
		if (lens === 'experience' && lookThroughSession !== null) { beginReaim(event); return; }
		if (lens === 'experience' && experienceTool === 'place') { beginPlacement(event); return; }
		if (lens === 'experience' && lookThroughSession === null && experienceTool === 'select' && event.button === 0) {
			const mark = viewMarkAt(event);
			if (mark !== null && (!event.shiftKey || mark.viewId === advancedViewId)) {
				if (mark.kind === 'eye' || mark.kind === 'move' || mark.kind === 'turn' ||
					mark.kind === 'lift' || mark.kind === 'tilt' || mark.kind === 'lens') {
					beginViewEdit(event, mark.viewId, mark.kind === 'eye' ? 'move' : mark.kind, mark.mark);
				}
				// A 3D glyph is a click entry, not navigation: never claim the Stage
				// pointer lease or capture on the Stage ancestor.
				return;
			}
		}
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
		if (viewEdit !== null) { updateViewEdit(event); return; }
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
		if (lookThroughSession !== null) { moveReaim(event); return; }
		if (placementPress !== null) { movePlacement(event); return; }
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
			stage.pointerIntent({ phase: 'move', css: stageCss(event), evaluationId: id, shift: event.shiftKey, coarse: event.pointerType !== 'mouse' });
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
		if (viewEdit !== null) {
			if (viewEdit.pointerId === event.pointerId) {
				updateViewEdit(event);
				void endViewEdit();
			}
			return;
		}
		if (lookThroughSession !== null) { endReaim(event.pointerId); return; }
		if (placementPress !== null) { if (placementPress.pointerId === event.pointerId) endPlacement(); return; }
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
				stage.pointerIntent({ phase, css: stageCss(event), evaluationId: id, shift: event.shiftKey, coarse: event.pointerType !== 'mouse' });
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
		if (viewEdit !== null) { cancelViewEdit(); return; }
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
		if (viewEdit !== null) { if (viewEdit.pointerId === event.pointerId) cancelViewEdit(); return; }
		if (lookThroughSession !== null) { endReaim(event.pointerId); return; }
		if (placementPress !== null) { if (placementPress.pointerId === event.pointerId) cancelPlacement(); return; }
		if (pinch?.has(event.pointerId) || press.ownsPointer(event.pointerId)) interruptPress('pointercancel');
	}

	function onLostPointerCapture(event: PointerEvent): void {
		if (viewEdit !== null && viewEdit.pointerId === event.pointerId) { cancelViewEdit(); return; }
		if (lookThroughPointers.has(event.pointerId)) { endReaim(event.pointerId); return; }
		if (placementPress !== null && placementPress.pointerId === event.pointerId) { cancelPlacement(); return; }
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
		// A frustum's captured release also dispatches a click. Its View owns that
		// click just as it owned the press; picking the floor here clears the Card.
		if (lens === 'experience' && viewMarkAt(event) !== null) return;
		// Look through owns the Stage: a drag turns the view and its release is not a pick.
		if (lens === 'experience' && (lookThroughSession !== null || experienceTool === 'place')) return;
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
		if (viewEdit !== null) return;
		const stage = facade;
		if (lens === 'experience' && lookThroughSession !== null && stage !== null) {
			const now = performance.now();
			advanceLookThroughZoom(now);
			const pixels = event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? (evaluation?.rect.height ?? 1) : 1);
			const remaining = lookThroughZoom === null ? 0 : lookThroughZoom.pending - lookThroughZoom.applied;
			lookThroughZoom = { pending: remaining - pixels * 0.004, startedAt: now, applied: 0 };
			if (reducedMotion) advanceLookThroughZoom(now, true);
			return;
		}
		zoom(Math.exp(event.deltaY * 0.001));
	}

	function handleKey(event: KeyboardEvent): void {
		// Preview is an isolated visitor run: Stage viewing keys do not apply there.
		if (preview !== null) {
			if (event.key === 'Escape') closePreview();
			return;
		}
		// S28 Esc precedence: a live marker gesture, then place, then Look through,
		// then the Card's own unwinding.
		if (event.key === 'Escape' && lens === 'experience') {
			if (pendingViewWrite !== null) {
				event.preventDefault();
				event.stopPropagation();
				pendingViewWrite = null;
				return;
			}
			if (viewEdit !== null) {
				event.preventDefault();
				event.stopPropagation();
				cancelViewEdit();
				return;
			}
			if (experienceTool === 'place') {
				event.preventDefault();
				event.stopPropagation();
				experienceTool = 'select';
				placementAim = null;
				cancelPlacement();
				notice = '';
				return;
			}
			if (lookThroughSession !== null) {
				event.preventDefault();
				event.stopPropagation();
				exitLookThrough();
				return;
			}
		}
		// Typing in the Index's subject search must never move the camera.
		if (stageKeyFromTextEntry(event.target)) return;
		// R217.S26 (E17): Alt+← is the Card's Back in the Experience lens. A focused Stop card
		// or View tile claims Alt+← for its own reorder first (it prevents the default).
		if (
			lens === 'experience' &&
			event.key === 'ArrowLeft' &&
			event.altKey &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.defaultPrevented
		) {
			if (experienceController?.back()) {
				event.preventDefault();
				cardOpen = true;
			}
			return;
		}
		// While a press is live the dock letters and `2` keep reaching the gesture's
		// typed entry, exactly as before they were dock keys.
		const action = stageKeyAction(event.key, { pressing: drag !== null || pinch !== null });
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
				if (!stage.keyboardIntent({ kind: action.kind }).claimed) break;
				// One key, one activation: the palette's own control must not also be
				// activated by the same keystroke.
				event.preventDefault();
				break;
			}
			case 'delete': {
				const controller = activeExperience;
				const anchorId = controller?.selectedAnchorId ?? null;
				if (lens === 'experience' && controller !== null && anchorId !== null) {
					event.preventDefault();
					void controller.removePathAnchor(anchorId);
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
				if (task !== null) closeTask();
				else if (lens === 'experience') {
					// R217.S25: Esc clears the Card selection (Experience subject or Stage), then
					// closes the Guide instrument. A menu or mode in a component answered first.
					if (experienceFocus.subject !== null) experienceFocus.select(null);
					else if (selection !== null) closeSelection();
					else if (experienceGuideOpen) experienceGuideOpen = false;
				} else if (selection !== null) closeSelection();
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
		return stageCardFacts(facade, { sourceId: selected.reference.subject.id, sourceKind: selected.reference.subject.kind, ref: selected.representation ?? null, reference: selected.reference }, own);
	});

	const cardNameWriter = $derived.by(() => {
		void contributionsVersion;
		const selected = selection;
		if (selected === null || facade === null) return null;
		return facade.cardNameWriter({
			sourceId: selected.reference.subject.id,
			sourceKind: selected.reference.subject.kind,
			reference: selected.reference,
			ref: selected.representation ?? null
		});
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
		const selected = selection;
		if (selected === null || facade === null) return null;
		return stageCardWriter(facade, {
			sourceId: selected.reference.subject.id,
			sourceKind: selected.reference.subject.kind,
			reference: selected.reference,
			ref: selected.representation ?? null
		});
	});

	/**
	 * The selected subject's scoped actions, each carrying the consequences its own
	 * adapter disclosed. A destructive one is what both the Card and `Delete` run.
	 */
	const cardActions = $derived.by((): readonly StageCardActionRecord[] => {
		void contributionsVersion;
		const selected = selection;
		if (selected === null || facade === null) return [];
		return stageCardActions(facade, {
			sourceId: selected.reference.subject.id,
			sourceKind: selected.reference.subject.kind,
			reference: selected.reference,
			ref: selected.representation ?? null
		});
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
	const experienceIndex = $derived.by((): ExperienceIndexGroups | null => {
		if (lens !== 'experience') return null;
		const controller = experienceController;
		if (controller === null) {
			return {
				pending: true,
				experiences: [],
				draftLabel: '',
				current: null,
				guides: [],
				presentations: [],
				totalPresentations: 0,
				query: '',
				busy: false,
				onQuery: () => {},
				onOpenExperience: () => {},
				onCreateExperience: () => {},
				onRenameExperience: async () => ({ kind: 'refused' as const }),
				onOpenGuide: () => {},
				onSelectPresentation: () => {},
				onToggleExpand: () => {},
				onSelectView: () => {}
			};
		}
		const current = controller.current;
		const subject = controller.subject;
		// The open chip reads the active Guide; the Stop numbers and On tour read the context Guide (entry before open).
		const activeGuideId = controller.currentGuide?.id ?? null;
		const stopNumbers = new Map<string, number[]>();
		controller.guideStops.forEach((stop, index) => {
			stopNumbers.set(stop.presentationId, [...(stopNumbers.get(stop.presentationId) ?? []), index + 1]);
		});
		return {
			pending: false,
			experiences: controller.experiences.map((entry) => ({
				id: entry.id,
				label: entry.label,
				stopCount: entry.stops.length,
				presentationCount: entry.presentations.length
			})),
			draftLabel: controller.draftLabel,
			current: current === null ? null : { id: current.id, label: current.label },
			guides: controller.guides.map((guide) => ({
				id: guide.id,
				label: guide.label,
				stopCount: guide.stopIds.length,
				open: experienceGuideOpen && guide.id === activeGuideId,
				selected: subject?.kind === 'guide' && subject.guideId === guide.id,
				opening: current?.entryGuideId === guide.id
			})),
			presentations: controller.filteredPresentations.map((entry) => ({
				id: entry.id,
				label: entry.label,
				viewCount: entry.views.length,
				explorable: entry.explorable,
				stopNumbers: stopNumbers.get(entry.id) ?? [],
				selected: subject?.kind === 'presentation' && subject.presentationId === entry.id,
				expanded: expandedPresentationId === entry.id,
				views: (controller.viewsOf.get(entry.id) ?? []).map((view) => ({
					id: view.id,
					label: view.label,
					onTour: controller.viewStops(view.id).length > 0,
					isDefault: entry.views[0]?.viewId === view.id,
					selected:
						subject?.kind === 'view' && subject.viewId === view.id && subject.presentationId === entry.id
				}))
			})),
			totalPresentations: current?.presentations.length ?? 0,
			query: controller.query,
			busy: controller.busy,
			onQuery: (query: string) => {
				controller.query = query;
			},
			onOpenExperience: (experienceId: string) => {
				controller.openExperience(experienceId);
				guideNamePrompt = null;
				expandedPresentationId = null;
				cardOpen = true;
			},
			onCreateExperience: (label?: string) => {
				// A pending name prompt or an expanded row belongs to the Experience it was opened in.
				guideNamePrompt = null;
				expandedPresentationId = null;
				return controller.createExperience(label);
			},
			onRenameExperience: (label: string) => controller.renameExperience(label),
			onOpenGuide: (guideId: string | null) => {
				if (guideId === null) {
					experienceGuideOpen = true;
					return;
				}
				controller.openGuide(guideId);
				experienceGuideOpen = true;
				selectExperienceSubject({ kind: 'guide', guideId });
			},
			onSelectPresentation: (presentationId: string) => {
				selectExperienceSubject({ kind: 'presentation', presentationId });
			},
			onToggleExpand: (presentationId: string) => {
				expandedPresentationId = expandedPresentationId === presentationId ? null : presentationId;
			},
			onSelectView: (viewId: string, presentationId: string) => {
				selectExperienceSubject({ kind: 'view', viewId, presentationId });
			}
		};
	});

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

	/**
	 * R217.S26 (E4) — a danger item for one removal. Its consequence block reads the same plan the
	 * removal planner installs; an item the plan refuses stays disabled with the reason as its hint.
	 * A Default View's removal asks for the new Default in the block (no automatic choice).
	 */
	function removalItem(
		controller: ExperienceController,
		id: string,
		label: string,
		target: ExperienceRemovalTarget
	): ExperienceCardMenuItem {
		const withChoice = (choice: string | null): ExperienceRemovalTarget =>
			target.kind === 'view' ? { ...target, newDefaultViewId: choice } : target;
		const initial = controller.removalPreview(target);
		return {
			id,
			label,
			danger: true,
			...(controller.busy
				? { disabled: true, reason: 'Wait for the current change' }
				: initial.kind === 'refused'
					? { disabled: true, reason: initial.reason }
					: {}),
			consequence: {
				read: (choice) => {
					const preview = controller.removalPreview(withChoice(choice));
					if (preview.kind === 'refused') return preview;
					return {
						kind: 'ready',
						lines: preview.lines,
						choose: preview.chooseDefault === null ? null : { label: 'New Default View', options: preview.chooseDefault },
						runnable: preview.runnable
					};
				},
				run: (choice) => controller.remove(withChoice(choice))
			}
		};
	}

	/**
	 * R217.S26 (E17): the kind line's *‹ Back* when the previous subject is not the kind line's
	 * own parent link (a View's Presentation is already its kind link).
	 */
	function backOf(controller: ExperienceController, parent: ExperienceSubject | null): ShownCard['back'] {
		const target = controller.backTarget;
		if (target === null) return null;
		if (parent !== null && JSON.stringify(parent) === JSON.stringify(target)) return null;
		// Review round 3: stepping between siblings (Stop ‹ › Stop) is not a drill-in, so the
		// Card names no "back" to the sibling it came from; Alt+← still returns there.
		if (controller.subject !== null && controller.subject.kind === target.kind) return null;
		return {
			label: controller.subjectName(target),
			onBack: () => {
				controller.back();
				cardOpen = true;
			}
		};
	}

	/** The Experience rename fields commit on Enter or blur and refuse an empty name (R217.S26). */
	function experienceNameWriter(value: () => string, commit: (name: string) => Promise<{ readonly kind: string; readonly message?: string }>): ShownCard['nameWriter'] {
		return {
			get value() {
				return value();
			},
			commit,
			commitOnBlur: true,
			emptyMessage: NAME_NEEDED
		};
	}

	/**
	 * R217.S25 (D10) — the one Card the Experience lens shows: the Experience subject when one is
	 * selected, otherwise the Stage selection as the subject Card, otherwise none. The latest
	 * selection always replaced the other, so there is never a second Card to arbitrate.
	 */
	const experienceShownCard = $derived.by((): ShownCard => {
		const controller = activeExperience;
		const services = adapterServices;
		// The ready draft (no Experience yet) still shows the Stage selection, so Present this can start it.
		if (controller === null || services === null) return NO_CARD;
		// The Stop and transition kind lines name the context Guide, so a tour Stop reads its Guide before it is opened.
		const guideLabel = controller.contextGuide?.label ?? '';
		const writerOf = (summary: string, component: NonNullable<StageCardWriterRecord['view']>['component']): StageCardWriterRecord => ({
			summary,
			adapterId: 'experience',
			fieldIds: [],
			view: { component, services }
		});
		const subject = controller.subject;
		if (subject?.kind === 'presentation') {
			const presentation = controller.selectedPresentation;
			if (presentation === null) return NO_CARD;
			const reference = presentation.subject;
			const subjectLabel = reference === null ? null : referenceLabel(reference as StageSelectionEntry['reference']);
			const model = presentationCardModel({
				presentationId: presentation.id,
				label: presentation.label,
				hasSubject: reference !== null && subjectLabel !== null,
				viewCount: presentation.views.length,
				stopCount: (controller.stopUsage.get(presentation.id) ?? []).length,
				hasDefaultView: presentation.views.length > 0
			});
			// E5: Add to Guide ▸ — the Guides, the active one first, with *again* where the
			// Presentation already has a Stop, then New Guide…, which asks the name inline (D8).
			const activeGuideId = controller.currentGuide?.id ?? controller.contextGuide?.id ?? null;
			const guidesInOrder = [
				...controller.guides.filter((guide) => guide.id === activeGuideId),
				...controller.guides.filter((guide) => guide.id !== activeGuideId)
			];
			const presentationStops = new Set(controller.stopUsage.get(presentation.id) ?? []);
			const busyReason = controller.busy ? { disabled: true, reason: 'Wait for the current change' } : {};
			const addToGuide: ExperienceCardMenuItem = {
				id: 'add-to-guide',
				label: 'Add to Guide',
				children: [
					...guidesInOrder.map((guide) => ({
						id: `add-to-guide:${guide.id}`,
						label: guide.label,
						...(guide.stopIds.some((stopId) => presentationStops.has(stopId)) ? { hint: 'again' } : {}),
						...busyReason,
						run: () => void controller.addToGuide(presentation.id, guide.id)
					})),
					{
						id: 'new-guide',
						label: 'New Guide…',
						...busyReason,
						run: () => {
							guideNamePrompt = presentation.id;
						}
					}
				]
			};
			return {
				...NO_CARD,
				identity: model.identity,
				facts: model.facts,
				nameWriter: experienceNameWriter(
					() => presentation.label,
					(name: string) => controller.renamePresentation(presentation.id, name)
				),
				menu: [
					addToGuide,
					removalItem(controller, 'remove-presentation', 'Remove Presentation', { kind: 'presentation', presentationId: presentation.id })
				],
				back: backOf(controller, null),
				writer: writerOf('Presentation', ExperiencePresentationWriter),
				kindLink:
					reference === null || subjectLabel === null
						? null
						: {
								label: subjectLabel,
								onOpen: () => selectStageReference(reference as StageSelectionEntry['reference'])
							}
			};
		}
		if (subject?.kind === 'view') {
			const view = controller.selectedView;
			if (view === null) return NO_CARD;
			const model = viewCardModel({
				viewId: view.id,
				label: view.label,
				presentationLabel: controller.presentationLabel(view.presentationId)
			});
			return {
				...NO_CARD,
				identity: model.identity,
				facts: model.facts,
				nameWriter: experienceNameWriter(
					() => view.label,
					(name: string) => controller.renameView(view.id, name)
				),
				menu: [
					removalItem(controller, 'remove-view', 'Remove View', {
						kind: 'view',
						presentationId: view.presentationId,
						viewId: view.id
					})
				],
				back: backOf(controller, { kind: 'presentation', presentationId: view.presentationId }),
				writer: writerOf('View', ExperienceViewWriter),
				kindLink: {
					label: controller.presentationLabel(view.presentationId),
					onOpen: () => selectExperienceSubject({ kind: 'presentation', presentationId: view.presentationId })
				}
			};
		}
		if (subject?.kind === 'stop') {
			const stop = controller.selectedStop;
			if (stop === null) return NO_CARD;
			const order = controller.guideStops;
			const at = order.findIndex((entry) => entry.id === stop.id);
			const position = at === -1 ? null : at + 1;
			const model = stopCardModel({
				stopId: stop.id,
				presentationLabel: controller.presentationLabel(stop.presentationId),
				position,
				guideLength: order.length,
				guideLabel
			});
			const items: ExperienceCardMenuItem[] = [
				{
					id: 'open-presentation',
					label: 'Open Presentation',
					run: () => selectExperienceSubject({ kind: 'presentation', presentationId: stop.presentationId })
				}
			];
			if (position !== null) {
				const first = position === 1;
				const last = position === order.length;
				const busy = controller.busy;
				const stuck = (atEnd: boolean, reason: string): { disabled: boolean; reason?: string } =>
					busy ? { disabled: true, reason: 'Wait for the current change' } : atEnd ? { disabled: true, reason } : { disabled: false };
				items.push(
					{ id: 'move-earlier', label: 'Move earlier', ...stuck(first, 'Already the first Stop'), run: () => void controller.moveStop(stop.id, -1) },
					{ id: 'move-later', label: 'Move later', ...stuck(last, 'Already the last Stop'), run: () => void controller.moveStop(stop.id, 1) }
				);
				if (order.length > 6) {
					items.push(
						{ id: 'move-start', label: 'Move to the start', ...stuck(first, 'Already the first Stop'), run: () => void controller.moveStopTo(stop.id, 0) },
						{ id: 'move-end', label: 'Move to the end', ...stuck(last, 'Already the last Stop'), run: () => void controller.moveStopTo(stop.id, order.length - 1) }
					);
				}
			}
			items.push(removalItem(controller, 'remove-stop', 'Remove Stop', { kind: 'stop', stopId: stop.id }));
			return {
				...NO_CARD,
				identity: model.identity,
				facts: model.facts,
				writer: writerOf('Stop', ExperienceStopWriter),
				menu: items,
				back: backOf(controller, null)
			};
		}
		if (subject?.kind === 'transition') {
			const stop = controller.selectedStop;
			if (stop === null) return NO_CARD;
			const at = controller.guideStops.findIndex((entry) => entry.id === stop.id);
			const continuation = controller.resolveContinuation(stop.id);
			if (at === -1 || continuation === null) return NO_CARD;
			const model = transitionCardModel({ stopId: stop.id, fromPosition: at + 1, guideLabel, continuation });
			return {
				...NO_CARD,
				identity: model.identity,
				facts: model.facts,
				writer: writerOf('Transition', ExperienceTransitionWriter),
				back: backOf(controller, { kind: 'stop', stopId: stop.id })
			};
		}
		if (subject?.kind === 'guide') {
			const guide = controller.guides.find((entry) => entry.id === subject.guideId);
			if (guide === undefined) return NO_CARD;
			const model = guideCardModel({ guideId: guide.id, label: guide.label, stopCount: guide.stopIds.length });
			return {
				...NO_CARD,
				identity: model.identity,
				facts: model.facts,
				nameWriter: experienceNameWriter(
					() => guide.label,
					(name: string) => controller.renameGuide(guide.id, name)
				),
				menu: [removalItem(controller, 'remove-guide', 'Remove Guide', { kind: 'guide', guideId: guide.id })],
				back: backOf(controller, null),
				writer: writerOf('Guide', ExperienceGuideWriter)
			};
		}
		// No Experience subject: the Stage selection is the Card.
		const selected = selection;
		if (selected === null) return NO_CARD;
		const bring = () => {
			const target = selectedWorldPoint();
			if (target !== null) bringIntoView(target);
		};
		const scene = experienceSceneSubject;
		if (scene !== null) {
			const model = subjectCardModel({ entityId: scene.entityId, label: scene.label });
			return {
				...NO_CARD,
				identity: model.identity,
				facts: model.facts,
				writer: writerOf('Scene object', ExperienceSubjectWriter),
				bringIntoView: bring
			};
		}
		// A Layout or other Stage subject: identity only, and the way back to its editing home.
		return {
			...NO_CARD,
			identity: cardIdentity,
			bringIntoView: bring,
			menu: [{ id: 'open-in-world', label: 'Open in World', run: () => changeLens('world') }]
		};
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

	/** Show the instrument on the active Guide, or on the entry Guide when none is active. */
	function openExperienceGuide(): void {
		const controller = activeExperience;
		const entryGuideId = controller?.current?.entryGuideId ?? null;
		if (controller !== null && controller.currentGuide === null && entryGuideId !== null) {
			controller.openGuide(entryGuideId);
		}
		experienceGuideOpen = true;
	}
	/** The dock's Guide key: show or hide the instrument for the active Guide. */
	function toggleExperienceGuide(): void {
		if (experienceGuideOpen) {
			experienceGuideOpen = false;
			return;
		}
		openExperienceGuide();
	}
	/** Why the dock's Capture cannot run, or undefined when it can. */
	const experienceCaptureReason = $derived.by((): string | undefined => {
		const controller = activeExperience;
		if (controller === null) return undefined;
		if (controller.busy) return 'Wait for the current change';
		return undefined;
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
		pendingDelete = null;
	}

	/** Select — the host's own tool: it closes the contributed task and keeps what is selected. */
	function selectTool(): void {
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
		pendingDelete = null;
		notice = '';
		refreshHostTools();
	}

	/** Arm one dock key (from the dock, its key or Find). */
	function armDockKey(key: StageDockKey): void {
		if (key.slot === 'select') selectTool();
		else if (key.adapterId === STAGE_HOST_ADAPTER_ID) armHostTool(key.id);
		else armDockTool({ id: key.id, adapterId: key.adapterId });
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

<div class="editor-host" style={`--shell-ink:${STAGE_PAINT_CSS.ink};--shell-leaf:${STAGE_PAINT_CSS.hover};--shell-gold:${STAGE_PAINT_CSS.selection}`}>
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
		onPreview={() => void openPreview()}
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
		onProjectActionBusyChange={(busy) => (projectActionBusy = busy)}
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

	{#if sourceFindings !== null}
		<!--
			Experience review 1: source problems are a quiet chip, not a page banner.
			The creator reads a count and one sentence; ids and paths stay behind
			Details, for copying into a report.
		-->
		<details class="source-findings" class:blocking={sourceFindings.closure.length > 0} aria-label="Source findings">
			<summary>
				{#if sourceFindings.closure.length > 0}
					<strong>This project can't be saved yet.</strong> Something it needs is missing.
				{:else}
					<strong>{sourceFindings.diagnostics.length} to fix</strong>
					{sourceFindings.diagnostics.length === 1 ? 'A link points at something that is gone.' : 'Some links point at things that are gone.'}
				{/if}
				<span class="source-findings-more">Details</span>
			</summary>
			<ul>
				{#each [...sourceFindings.closure, ...sourceFindings.diagnostics].slice(0, 8) as finding (finding.path + finding.code)}
					<li data-finding-code={finding.code}>{finding.message}</li>
				{/each}
			</ul>
			<button
				type="button"
				onclick={() =>
					void navigator.clipboard?.writeText(
						[...sourceFindings.closure, ...sourceFindings.diagnostics]
							.map((finding) => `${finding.path}: ${finding.message} (${finding.code})`)
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
				: lookThroughSession !== null ? 'look'
				: experienceTool === 'place' ? 'place-view'
				: hoverMove ? 'move'
				: task?.kind === 'layout-ink' || armedHostTool !== null ? 'draw'
				: 'select'}
				style:cursor={stageCursor ?? undefined}
				aria-label="Spatial stage"
				onpointerleave={clearHover}
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerCancel}
				onlostpointercapture={onLostPointerCapture}
				onclick={onClick}
				onwheel={onWheel}
				oncontextmenu={(event) => { if (lookThroughSession !== null) event.preventDefault(); }}
			>
				{#if boot.status === 'ready' || boot.status === 'empty'}
					<StageCanvas
						{scenePick}
						geometry={boot.snapshot.domain.geometry}
						sourceContentId={boot.snapshot.sourceContentId}
						scene={boot.snapshot.domain.scene}
						rooms={boot.snapshot.domain.rooms}
						{evaluation}
						{ghosts}
						{modelUrls}
						plan={planView}
						planAppearance={preferences.planAppearance}
						paperInk2d={PAPER_TONES[preferences.paperTone2d].ink}
						paperInk3d={PAPER_TONES[preferences.paperTone3d].ink}
						{drafting}
						datumMeters={boot.snapshot.domain.datumMeters}
						contentBounds={paperContentBounds}
						snapshotBounds={stageContentBounds}
						environment={editOnPaper ? 'paper' : worldEnvironment}
						framedViewport={lookThroughSession !== null ? throughViewport : null}
							{selection}
						hover={armedHostTool === 'erase' ? eraseHover : hoverSelection}
						hoverTone={armedHostTool === 'erase' ? 'erase' : 'hover'}
						heightMeters={lens === 'world' ? heightMeters : null}
						heightPlaneVisible={lens === 'world' && heightPlaneVisible}
					/>
				{/if}
				<div class="overlay-layer">
					{#if lookThroughSession === null}
						<StageOverlay
								lightGround={paperVisible || evaluation?.renderedReading === '3d'}
								{markers} {marks} {roomLabels} candidates={candidatePreviews} viewportWidth={rect?.width ?? 0} viewportHeight={rect?.height ?? 0} {tracePreview} hostTools={hostToolOverlay} onActivateDisclosure={(id) => { if (facade?.activateDisclosure(id) === true) { facade.notifySurfaceChange(); } }} />
					{/if}
					{#if lens === 'experience' && evaluation !== null && lookThroughSession === null}
						<ExperienceMarks
							{evaluation}
							{placementGhost}
							liveEdit={viewEdit}
							advanced={advancedViewId !== null}
							datum={experienceFloorDatum}
							rig={playback.status === 'idle' ? null : playback.sample}
							onLookThrough={lookThroughView}
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
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="stage-actions"
					style:display={lookThroughSession !== null ? 'none' : undefined}
					onclick={(event) => event.stopPropagation()}
					onpointerdown={(event) => event.stopPropagation()}
				>
					<!--
						R217.S20: the ⚙ holds the viewing preferences the Head used to hold. They
						are browser session values, so the cluster writes the same state the
						route always wrote, and Find reaches the same values.
					-->
					<StageDraftingControl
						{drafting}
						reading={draftingReading}
						quiet={paperVisible}
						gridWord={draftingGridWord}
						snapWord={draftingSnapWord}
						onReading={setReading}
						onPatch={patchDrafting}
						planAppearance={preferences.planAppearance}
						onPlanAppearance={(planAppearance) => updatePreferences({ ...preferences, planAppearance })}
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
					/>
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
					{#if adapterServices !== null}
						<StageEnvironmentControl
							environment={worldEnvironment}
							onEnvironment={(preset) => void setWorldEnvironment(preset)}
							{editOnPaper}
							onEditOnPaper={(value) => (editOnPaper = value)}
							busy={environmentWrite === adapterServices}
						/>
					{/if}
				</div>
				{#if lens === 'world'}
					<!--
						PLATE's Height Sheet in S02's right-edge slot. It is world-lens chrome:
						the control and its plane are hidden in Experience and return with the
						session height on the way back. The slot is a transparent wrapper: the
						Sheet places its own lane and its pin hint on the Stage, so neither is
						clipped by a box of the slot's own.
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
								{pinHintSeen}
								onPinHintSeen={() => (pinHintSeen = true)}
								bind:laneRef={sheetLaneEl}
								onSetHeight={setHeight}
								onAddPin={addHeightPin}
								onRemovePin={removeHeightPin}
								onActiveChange={setHeightPlaneActive}
								onResetSubscribe={(onReset) =>
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

				{#if lens === 'experience' && lookThroughSession !== null}
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
						<span>Looking through <b>{lookThroughSession.label}</b></span>
						{#if lookThroughMoved}<span class="moved">moved</span>{/if}
						<button
							type="button"
							class="pill-gold"
							disabled={!lookThroughMoved || (activeExperience?.busy ?? false)}
							title={lookThroughMoved ? 'Write the provisional pose back to this View' : 'Adjust the camera or lens first'}
							onclick={() => void updateLookThrough(lookThroughConfirm !== null)}>Update View</button
						>
						<button type="button" onclick={exitLookThrough}>Exit View Esc</button>
						<button type="button" title="Capture this provisional pose as a new View" onclick={() => void captureProvisional()}>Capture</button>
					</div>
					{#if lookThroughConfirm !== null}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div class="through-confirm" role="alertdialog" tabindex="-1" aria-label="Update a shared View" onclick={(event) => event.stopPropagation()} onpointerdown={(event) => event.stopPropagation()}>
							<p>Also changes {lookThroughConfirm.join(', ')}.</p>
							<div class="through-confirm-actions">
								<button type="button" class="pill-gold" onclick={() => void updateLookThrough(true)}>Update View</button>
								<button type="button" onclick={() => (lookThroughConfirm = null)}>Cancel</button>
							</div>
						</div>
					{/if}
				{/if}
				{#if pendingViewWrite !== null}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="through-confirm" role="alertdialog" tabindex="-1" aria-label="Update a shared View" onclick={(event) => event.stopPropagation()} onpointerdown={(event) => event.stopPropagation()}>
						<p>Also changes {pendingViewWrite.alsoIn.join(', ')}.</p>
						<div class="through-confirm-actions">
							<button type="button" class="pill-gold" onclick={() => void confirmPendingViewWrite()}>Update View</button>
							<button type="button" onclick={() => (pendingViewWrite = null)}>Cancel</button>
						</div>
					</div>
				{/if}
				{#if lens === 'experience' && showExperienceWelcome && lookThroughSession === null && experienceTool === 'select'}
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
							<button type="button" onclick={dismissExperienceWelcome}>Got it</button>
						</footer>
					</aside>
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
						{reducedMotion}
						title={entry?.title ?? null}
						experienceTitle={entry?.title ?? null}
						startMode={previewRequestedMode ?? (entry?.kind === 'program' && entry.entryPresentationId !== null ? 'presentation' : 'welcome')}
						guideStopCount={previewGuideStats.stops}
						guideSeconds={previewGuideStats.seconds}
						viewLabels={previewViewLabels}
						onExit={closePreview}
						environment={worldEnvironment}
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
				<StageDock keys={dockKeys} armedId={armedDockId} {paletteOpen} onPress={pressDockKey}
					>
						{#snippet palette()}<StageInstrumentHost
								task={paletteOpen ? taskHost : null}
								onClose={closeTask}
								onCollapse={() => (paletteOpen = false)}
								instrument={contributedInstrument}
							/>
				{/snippet}
					</StageDock>
				{/if}
				{#if activeExperience !== null}
					<!-- Column order is bottom-up: the dock, its feedback line, then the Guide instrument above them. -->
					<ExperienceDock
						captureDisabled={experienceCaptureReason !== undefined}
						captureReason={experienceCaptureReason}
						guideOpen={experienceGuideOpen}
						placeArmed={experienceTool === 'place'}
						onPlaceView={togglePlaceView}
						onCapture={() => void activeExperience?.capture()}
						onToggleGuide={toggleExperienceGuide}
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
			<button type="button" onclick={() => (pendingReplacement = null)}>Cancel</button>
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
		box-shadow: inset 0 0 0 1px #c9cfc2;
	}
	.stage:focus-visible {
		box-shadow: inset 0 0 0 1px #d4ad45;
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
		inset-inline-start: 12px;
		inset-inline-end: 12px;
		bottom: 10px;
		z-index: 6;
		display: flex;
		flex-direction: column-reverse;
		align-items: center;
		gap: 0.4rem;
		pointer-events: none;
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
	@media (width > 1100px) {
		.editor-body[data-index-open='true'] {
			--index-cover: var(--shell-index-width);
		}
	}
	/* The constrained Index ends above the lower column and has a close scrim. */
	@media (max-width: 1100px) {
		.editor-body > :global(.plate-index) {
			bottom: calc(0.75rem + var(--lower-column-height, 0px) + 0.5rem);
			width: min(var(--shell-index-width, 256px), 80%);
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
	.stage-actions {
		position: absolute;
		top: 10px;
		left: calc(10px + var(--index-cover, 0px));
		/* Its popovers (Show, Environment) open over the Stage's start card. */
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
		border: 1px solid var(--shell-hairline, #2f4a3d);
		border-radius: 0.4rem;
		background: var(--shell-forest, #11291f);
		color: var(--shell-ink-light, #f3f4ee);
		box-shadow: 0 0.6rem 1.4rem rgb(6 20 14 / 40%);
		font-family: var(--shell-sans, Inter, sans-serif);
		font-size: var(--shell-text-body, 13px);
	}
	.keys-panel:focus-visible {
		outline: 2px solid var(--shell-gold, #d4ad45);
		outline-offset: 2px;
	}
	.keys-panel h2 {
		margin: 0;
		font-size: var(--shell-text-body, 13px);
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
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--shell-text-utility, 12px);
		color: var(--shell-gold, #d4ad45);
		font-variant-numeric: tabular-nums;
	}
	.keys-panel dd {
		margin: 0;
		font-size: var(--shell-text-utility, 12px);
		color: var(--shell-ink-quiet, #9fb2a2);
	}
	.keys-panel button {
		justify-self: start;
		min-height: var(--shell-control-height, 32px);
		padding: 0 0.6rem;
		border: 1px solid var(--shell-hairline, #2f4a3d);
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
		stroke: var(--shell-gold-ink, #74560c);
		stroke-width: 1.2;
		stroke-dasharray: 3 3;
	}
	.view-edit-preview .turn-angle {
		fill: var(--shell-gold-ink, #74560c);
		font: 600 11px var(--shell-sans, system-ui, sans-serif);
		paint-order: stroke;
		stroke: rgb(255 255 255 / 0.85);
		stroke-width: 3px;
	}
	/* R217.S29 Show ▾: a light disclosure beside the Stage reading control. */
	.show-control {
		position: relative;
		display: flex;
		align-items: center;
		padding: 3px;
		border: 1px solid rgb(27 32 28 / 0.1);
		border-radius: 10px;
		background: rgb(255 255 255 / 0.94);
		box-shadow: 0 4px 14px rgb(17 41 31 / 0.12);
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
		color: var(--shell-ink, #1b201c);
		font: inherit;
		font-size: 12.5px;
		cursor: pointer;
	}
	.show-button:hover {
		background: rgb(27 32 28 / 0.06);
	}
	.show-button[aria-expanded='true'] {
		background: var(--shell-forest, #11291f);
		color: #fff;
	}
	.show-button:focus-visible,
	.show-mode button:focus-visible,
	.show-all:focus-visible {
		outline: 2px solid var(--shell-gold, #d4ad45);
		outline-offset: 1px;
	}
	.show-off {
		padding: 0 6px;
		border-radius: 999px;
		background: color-mix(in srgb, var(--shell-gold, #d4ad45) 28%, transparent);
		color: var(--shell-gold-ink, #74560c);
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
		border: 1px solid rgb(27 32 28 / 0.12);
		border-radius: 14px;
		background: #fff;
		color: var(--shell-ink, #1b201c);
		box-shadow: 0 10px 30px rgb(17 41 31 / 0.16);
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
		color: var(--shell-ink-3, #79817b);
		font-size: 11.5px;
	}
	.show-mode {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 3px;
		padding: 3px;
		border-radius: 10px;
		background: rgb(27 32 28 / 0.05);
	}
	.show-mode button {
		height: 28px;
		border: 0;
		border-radius: 8px;
		background: none;
		color: var(--shell-ink-2, #4a524c);
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.show-mode button[aria-pressed='true'] {
		background: #fff;
		color: var(--shell-ink, #1b201c);
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
		background: rgb(27 32 28 / 0.04);
	}
	.show-popover input[type='checkbox'] {
		appearance: none;
		-webkit-appearance: none;
		flex: none;
		width: 18px;
		height: 18px;
		margin: 0;
		border: 1.5px solid rgb(27 32 28 / 0.2);
		border-radius: 5px;
		background: #fff;
		cursor: pointer;
	}
	.show-popover input[type='checkbox']:checked {
		border-color: var(--shell-leaf, #4f8f6c);
		background: var(--shell-leaf, #4f8f6c) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3.5 8.5l3 3 6-7' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") center / 14px no-repeat;
	}
	.show-popover input[type='checkbox']:focus-visible {
		outline: 2px solid var(--shell-gold, #d4ad45);
		outline-offset: 2px;
	}
	.show-all {
		height: 28px;
		margin-top: 2px;
		border: 1px solid rgb(27 32 28 / 0.14);
		border-radius: 8px;
		background: #fff;
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
		box-shadow: inset 0 0 0 3px var(--shell-gold, #d4ad45);
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
		border: 0 solid rgb(255 255 255 / 0.9);
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
		background: var(--shell-glass-dark, rgb(14 30 25 / 0.8));
		color: var(--shell-ink-light, #eef1ec);
		font-size: 12px;
		box-shadow: 0 8px 20px rgb(0 0 0 / 0.28);
	}
	.mode-pill button {
		height: 28px;
		padding: 0 11px;
		border: 0;
		border-radius: 14px;
		background: rgb(255 255 255 / 0.12);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.mode-pill button:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.mode-pill button.pill-gold {
		background: var(--shell-gold, #d4ad45);
		color: #2a2208;
		font-weight: 600;
	}
	.mode-pill .live-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--shell-gold, #d4ad45);
	}
	.mode-pill .moved {
		color: var(--shell-gold, #d4ad45);
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
		background: var(--shell-popup-dark, rgb(17 41 31 / 0.97));
		color: var(--shell-ink-light, #eef1ec);
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
		background: rgb(255 255 255 / 0.14);
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}
	.through-confirm button.pill-gold {
		background: var(--shell-gold, #d4ad45);
		color: #2a2208;
		font-weight: 600;
	}
	.experience-welcome {
		position: absolute;
		left: calc(1rem + var(--index-cover, 0px));
		bottom: 4.75rem;
		width: min(18rem, calc(100% - 2rem));
		padding: 1rem;
		border: 1px solid var(--shell-hairline-strong, #cdd2ca);
		border-radius: 12px;
		background: var(--shell-card, #fff);
		box-shadow: var(--shell-shadow, 0 8px 24px rgb(0 0 0 / 0.12));
		color: var(--shell-ink, #1b201c);
		font-size: 0.8rem;
	}
	.experience-welcome > span {
		color: var(--shell-gold-ink, #74560c);
		font-size: 0.65rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.experience-welcome h2 {
		margin: 0.25rem 0 0.6rem;
		font: 400 1.15rem var(--shell-serif, Georgia, serif);
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
		background: var(--shell-forest, #11291f);
		color: white;
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
		background: rgb(17 41 31 / 0.92);
		color: white;
		font-size: 0.78rem;
		line-height: 1.35;
	}
	/* Kind decides the styling, never the words: a success is never a refusal. */
	.experience-feedback.success { background: #22503c; }
	.experience-feedback.info { background: #2c3b44; }
	.experience-feedback.refused { background: #623639; }
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
		background: rgb(25 24 31 / 88%);
		color: #e3c4c4;
	}
	.preview-actions-note {
		top: 0.5rem;
		bottom: auto;
		color: #f5e8b5;
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
		background: #19181f;
		border: 1px solid #635a6f;
	}
	.resume-offer {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 1rem;
		border-bottom: 1px solid #6b5426;
		background: #2b2417;
		color: #f4e5c8;
	}
	.resume-offer p {
		flex: 1 1 22rem;
		margin: 0;
		line-height: 1.4;
	}
	.resume-offer button {
		padding: 0.45rem 0.7rem;
		border: 1px solid #8a6a31;
		border-radius: 0.35rem;
		background: #3a3020;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.resume-offer button.primary {
		border-color: #d8b26a;
		background: #7a5a22;
		color: #fff;
	}
	.source-findings {
		position: absolute;
		top: calc(var(--shell-head-height, 48px) + 8px);
		left: 50%;
		z-index: 30;
		transform: translateX(-50%);
		max-width: min(32rem, calc(100% - 2rem));
		padding: 6px 12px;
		border: 1px solid rgb(27 32 28 / 0.12);
		border-radius: 12px;
		background: rgb(255 255 255 / 0.96);
		box-shadow: 0 6px 18px rgb(17 41 31 / 0.14);
		color: var(--shell-ink, #1b201c);
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
		color: var(--shell-gold-ink, #74560c);
	}
	.source-findings.blocking strong {
		color: var(--shell-caution, #c85a48);
	}
	.source-findings-more {
		margin-left: auto;
		color: var(--shell-ink-3, #79817b);
		text-decoration: underline;
	}
	.source-findings ul {
		margin: 6px 0 4px 1rem;
		padding: 0;
		color: var(--shell-ink-2, #4a524c);
	}
	.source-findings button {
		border: 1px solid rgb(27 32 28 / 0.14);
		border-radius: 8px;
		background: #fff;
		padding: 3px 9px;
		font: inherit;
		cursor: pointer;
	}
	.boot-panel {
		position: absolute;
		z-index: 30;
		top: 4rem;
		left: 50%;
		transform: translateX(-50%);
		width: min(32rem, calc(100% - 2rem));
		padding: 1.25rem;
		border: 1px solid color-mix(in srgb, var(--shell-ivory) 20%, transparent);
		border-radius: 16px;
		background: var(--shell-dock-surface);
		color: var(--shell-ivory);
		box-shadow: var(--shell-shadow);
		box-sizing: border-box;
	}
	.boot-brand {
		color: var(--shell-gold);
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.boot-panel h1,
	.boot-panel .boot-loading {
		margin: 0 0 0.5rem;
		color: var(--shell-ivory);
		font: 400 1.4rem/1.25 var(--shell-serif);
	}
	.boot-panel .boot-loading {
		margin: 0.35rem 0 0;
	}
	.boot-panel p {
		margin: 0 0 0.75rem;
		color: var(--shell-ink-light);
	}
	.boot-panel button {
		margin-right: 0.5rem;
		padding: 0.5rem 0.8rem;
		border: 1px solid color-mix(in srgb, var(--shell-ivory) 30%, transparent);
		border-radius: 8px;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.boot-panel button.primary {
		border-color: var(--shell-gold);
		background: var(--shell-gold);
		color: var(--shell-forest);
	}
	.boot-panel button:focus-visible {
		outline-color: var(--shell-gold);
	}

	@media (max-width: 720px) {
		/* Below the centered lens panel in a narrow shell, so the notice never
		   overlaps its buttons. */
		.stage-note {
			bottom: 0.5rem;
		}
	}
</style>
