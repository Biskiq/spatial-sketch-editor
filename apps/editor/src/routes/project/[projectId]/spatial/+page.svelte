<script lang="ts">
	import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';

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
	 * missing, forbidden and error. A minted identity the server does not have offers
	 * the gallery; an explicitly opened absence is `missing`.
	 *
	 * One Stage canvas serves both readings and both lenses. Reading flips are
	 * Camera-evaluated (never a shell tween); pointer input becomes viewing intent;
	 * a click selects through the eligible Plan fragments so a hidden or excluded
	 * target can never intercept input.
	 */
	import { onMount, untrack } from 'svelte';
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
		serializeProjectEnvelope,
		validateProjectEnvelope,
		type ProjectEnvelope
	} from '@portfolio/project-model/units';
	import { primaryEntry, type StageSelectionEntry } from '$lib/authoring/stage/semantic-selection';
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
		type StageFacade,
		type StageIntentResult,
		type StageInstrumentContent,
	type StageGhostMesh,
	type StageOverlayContribution,
	type StageSourceHit
} from '$lib/authoring/stage/stage-facade';
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
		stageContributionGroups,
		stageDockTools
	} from '$lib/authoring/stage/stage-contributions';
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
		planFragmentOf,
		planMembershipOf,
		type PlanEvaluation,
		type PlanMembershipReason
	} from '@portfolio/layout-core';
	import type { ViewingIntent, ViewportEvaluation, ViewportRect } from '@portfolio/camera-core';
	import {
		createStagePressTracker,
		readingIntentClockSeconds,
		stageKeyAction,
		stageKeyFromControl,
		stageKeyFromTextEntry
	} from '$lib/authoring/stage/stage-input';
	import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';
	import EditorIndex from '$lib/authoring/stage/shell/EditorIndex.svelte';
	import EditorCard from '$lib/authoring/stage/shell/EditorCard.svelte';
	import StageDock from '$lib/authoring/stage/shell/StageDock.svelte';
	import StageInstrumentHost from '$lib/authoring/stage/shell/StageInstrumentHost.svelte';
	import StageCanvas from '$lib/authoring/stage/shell/StageCanvas.svelte';
	import {
		approvedModelPins,
		resolveApprovedModels,
		type ApprovedModelSources
	} from '$lib/authoring/scene/model-bytes';
	import StageOverlay from '$lib/authoring/stage/shell/StageOverlay.svelte';
	import ExperienceSurface from '$lib/authoring/experience/ExperienceSurface.svelte';
	import { experienceFocus } from '$lib/authoring/experience/focus.svelte';
	import { previewEntryFor, type EnterablePreviewEntry } from '$lib/authoring/experience/preview-entry';
	import {
		enterPreview,
		nextPreviewRunEpoch,
		previewReturnToken,
		returnPreview
	} from '$lib/authoring/experience/preview-handover';
	import { isAllowedShippedTextureUri } from '$lib/visitor/shipped-static-registry';

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
		readonly revision: { readonly projectId: string; readonly revisionId: string } | null;
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
	let task = $state<StageTask | null>(null);
	/** Instrument content contributed by the adapter whose task is open, if any. */
	const contributedInstrument = $derived.by((): StageInstrumentContent | null => {
		void contributionsVersion;
		return contributedTaskId === null ? null : facade?.instrumentForTask(contributedTaskId.id, contributedTaskId.adapterId) ?? null;
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
		// Preview returns to the lens it was entered from; a lens switch ends it.
		closePreview();
		abortGesture();
		// A notice describes the previous context; the lens is the new one.
		notice = '';
		if (facade?.changeLens(next)) {
			lens = session.lens();
			task = null;
			contributionsVersion += 1;
		}
		// Arming the Experience dock's Guide key is not a mode: the lens owns it.
	}
	function resumeTask(): void {
		const result = facade?.resumeTask();
		if (result?.kind === 'refused') notice = result.message;
		else { task = session.task(); notice = ''; }
		contributionsVersion += 1;
	}
	let revealed = $state<string[]>([]);
	let lens = $state<'world' | 'experience'>('world');
	let indexOpen = $state(true);
	let query = $state('');
	let reducedMotion = $state(false);
	/**
	 * The isolated visitor Preview session (T3.P02.S02).
	 *
	 * Entering is a **Camera handover**: the Stage's inspection run hands its one
	 * output to the Preview run through the landed F3 ticket protocol, and leaving
	 * returns it. `epoch` is the protocol run epoch and the interpreter's run
	 * identity at once, so an older Preview completion can neither drive the
	 * restored inspection output nor be accepted by a newer run.
	 */
	let preview = $state<{ readonly entry: EnterablePreviewEntry; readonly epoch: number } | null>(null);
	/**
	 * The last entry a mounted visitor surface carries.
	 *
	 * The surface is built once and reused: leaving Preview hides it and ends its
	 * Camera claim, but keeps the loaded chunk, renderer and scene alive, so a
	 * repeat entry costs a fresh run rather than a rebuild. A new entry replaces
	 * these props and its epoch creates the next run.
	 */
	let previewView = $state<{ readonly entry: EnterablePreviewEntry; readonly epoch: number } | null>(null);
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
	/** The adapter services the Experience lens surface edits through. */
	let adapterServices = $state.raw<StageAdapterServices | null>(null);
	const currentEnvelope = $derived.by((): ProjectEnvelope | null =>
		boot.status === 'ready' || boot.status === 'empty' ? stageEnvelope(boot.snapshot) : null
	);
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
	async function openPreview(): Promise<void> {
		if (previewBusy || preview !== null || (boot.status !== 'ready' && boot.status !== 'empty')) return;
		perfMark('preview:press');
		const stage = facade;
		if (stage === null) return;
		const snapshot = boot.snapshot;
		const token = session.token();
		previewBusy = true;
		try {
			const runEpoch = nextPreviewRunEpoch(stage.camera.output(), ++previewEpoch);
			const entry = previewEntryFor({
				envelope: stageEnvelope(snapshot),
				sourceContentId: snapshot.sourceContentId,
				sessionEpoch: snapshot.sessionEpoch,
				epoch: runEpoch,
				focus: experienceFocus.read()
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
			perfMark('preview:entered', { runEpoch: handover.runEpoch, mode: entry.kind });
		} finally {
			previewBusy = false;
		}
	}
	let evaluation = $state<ViewportEvaluation | null>(null);
	// Generated Plan evaluations are replaced whole; raw data keeps their references
	// cloneable when Index selection crosses the immutable selection boundary.
	let planView = $state.raw<PlanEvaluation | null>(null);
	let rect = $state<ViewportRect | null>(null);
	let markers = $state<readonly StageOverlayContribution[]>([]);
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
	let selectionMarker = $state<{ css: readonly [number, number]; label: string } | null>(null);
	let notice = $state('');
	let pendingReplacement = $state<null | 'starter' | 'empty' | 'source'>(null);
	/** Set by the route's teardown: no late completion may mount a stage after it. */
	let tornDown = false;
	let stageEl: HTMLDivElement | undefined = $state(undefined);
	/** The one lower column's measured height; the Card clears it at narrow widths. */
	let lowerColumnEl: HTMLDivElement | undefined = $state(undefined);
	let lowerColumnHeight = $state(0);
	/**
	 * Whether the contextual Card is shown. Closing the Card never clears the
	 * selection: the Index keeps echoing it, and selecting the subject again (or
	 * another one) brings the Card back, so identity is never lost to a dismissal.
	 */
	let cardOpen = $state(true);
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
	let armedTool = $state<{ readonly id: string; readonly adapterId: string } | null>(null);
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
	let narrowShell = $state(false);
	let cardExpanded = $state<boolean | null>(null);

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
		selectionMarker = null;
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
		// The previous facade's listeners are dropped before its replacement exists,
		// so a disposal-time notification cannot write through the new facade.
		unsubscribeContributions?.();
		unsubscribeContributions = null;
		facade?.dispose();
		acceptance?.dispose();
		facade = createStageFacade({ snapshot, session });
		unsubscribeContributions = facade.onAdaptersChanged(() => {
			contributionsVersion += 1;
			task = facade?.session.task() ?? null;
			selection = facade ? primaryEntry(facade.selectionState()) : null;
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
			selection = facade ? primaryEntry(facade.selectionState()) : null;
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
		if (api === null) {
			boot =
				requestedIntent === 'create'
					? { status: 'new', projectId: projectIdToLoad, intent: 'create' }
					: { status: 'error', projectId: projectIdToLoad, message: 'Cloud service is unavailable' };
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
		return serializeProjectEnvelope({
			...next,
			name: previous.name,
			acceptedRevision: previous.acceptedRevision
		}) === remoteSavedCanonicalJson;
	}

	function sameLifecycleEpoch(token: ReplacementEpochToken): boolean {
		return session.isCurrent(token) && !tornDown && activeProject() && acceptance !== null;
	}

	async function readLifecycleProject(
		includePublication: boolean,
		token: ReplacementEpochToken
	): Promise<{ kind: 'ready'; value: LifecycleRead } | { kind: 'stale' } | { kind: 'error'; message: string }> {
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
		return error instanceof ProjectPersistenceError && ['network', 'server', 'project-busy'].includes(error.code);
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
	): Promise<{ kind: 'ready'; prepared: PreparedProjectLifecycle } | ProjectLifecycleActionResult> {
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
		perfMark('f2:open-admitted');
	}

	/* --- viewport measurement and evaluation -------------------------------- */

	function measure(): ViewportRect {
		const element = stageEl;
		const width = element?.clientWidth ?? 0;
		const height = element?.clientHeight ?? 0;
		const left = element?.getBoundingClientRect().left ?? 0;
		const top = element?.getBoundingClientRect().top ?? 0;
		return { left, top, width, height, devicePixelRatio: window.devicePixelRatio || 1 };
	}

	function acceptRect(next: ViewportRect): void {
		rect = next;
	}

	function nowSeconds(): number {
		return typeof performance === 'undefined' ? Date.now() / 1000 : performance.now() / 1000;
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
		const stage = facade;
		if (stage === null) return;
		// The gesture lease is host state that changes what Undo can do without an
		// acceptance, so the Head's reported history follows it on the same frame as
		// the render rather than only on the next accepted change.
		refreshHistory();
		const currentRect = rect ?? measure();
		const result = stage.camera.evaluate(currentRect, nowSeconds());
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
		ghosts = stage.ghosts();
		const selected = selection;
		selectionMarker = selected === null ? null : selectionEcho(selected);
	}

	function selectionEcho(selected: StageSelectionEntry): { css: readonly [number, number]; label: string } | null {
		const stage = facade;
		if (stage === null) return null;
		const plan = planView;
		// `planFragmentOf` is indexed against the fragment array, so this lookup —
		// which runs on every presented frame while something is selected — costs a
		// map probe rather than a scan of the project.
		const fragment = plan === null ? undefined : planFragmentOf(plan, selected.reference.subject.id);
		if (fragment === undefined) return null;
		const points =
			fragment.geometry.kind === 'span'
				? [fragment.geometry.start, fragment.geometry.end]
				: fragment.geometry.kind === 'polyline'
					? fragment.geometry.polyline
					: fragment.geometry.polygon;
		const center = points.reduce<[number, number]>(
			(accumulator, point) => [accumulator[0] + point[0] / points.length, accumulator[1] + point[1] / points.length],
			[0, 0]
		);
		const projected = stage.projectWorld([center[0], fragment.elevationMeters, center[1]], stage.evaluationId() ?? '');
		if (projected.kind !== 'projected') return null;
		// The Camera projects into viewport CSS; the overlay paints inside the Stage
		// surface, so the echo subtracts the same evaluation rect the hit path adds.
		const evaluationRect = stage.evaluation()?.rect ?? rect;
		const offsetX = evaluationRect?.left ?? 0;
		const offsetY = evaluationRect?.top ?? 0;
		return {
			css: [projected.css[0] - offsetX, projected.css[1] - offsetY],
			label: selected.reference.subject.id
		};
	}

	onMount(() => {
		perfMark('stage:route-mounted');
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
		reducedMotion = media.matches;
		const onMedia = (event: MediaQueryListEvent) => {
			reducedMotion = event.matches;
		};
		media.addEventListener('change', onMedia);

		// The shell's width rule: at a constrained width the Card folds to identity
		// rather than covering the dock/palette's one lower column.
		const narrow = window.matchMedia('(max-width: 72rem)');
		narrowShell = narrow.matches;
		const onNarrow = (event: MediaQueryListEvent) => {
			narrowShell = event.matches;
		};
		narrow.addEventListener('change', onNarrow);

		const onKey = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			handleKey(event);
		};
		window.addEventListener('keydown', onKey);

		void load(projectId, intent);

		return () => {
			// Order matters: the flag and the session teardown both run before the
			// facade is disposed, so a load already past its fetch sees a torn-down
			// session (`isCurrent` is false, the registered abort fires) and drops its
			// result instead of mounting a second stage.
			tornDown = true;
			cancelAnimationFrame(frame);
			media.removeEventListener('change', onMedia);
			narrow.removeEventListener('change', onNarrow);
			window.removeEventListener('keydown', onKey);
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
					facade.pointerIntent({ phase: 'cancel', css, evaluationId: id });
				}
			}
			abortGesture();
		}
	}

	function fit(): void {
		const stage = facade;
		if (stage === null) return;
		const bounds = stage.snapshot().domain.geometry.bounds;
		if (bounds === null || rect === null) return;
		submit({ kind: 'fit', bounds: { min: bounds.min, max: bounds.max }, rect }, nowSeconds());
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

	function selectHit(hit: StageSourceHit): void {
		const stage = facade;
		if (stage === null) return;
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
		cardOpen = true;
	}

	function selectSource(sourceId: string): void {
		const stage = facade;
		const plan = planView;
		if (stage === null || plan === null) return;
		cardOpen = true;
		const fragment = planFragmentOf(plan, sourceId);
		if (fragment === undefined) return;
		stage.select({
			sourceId,
			sourceKind: fragment.ref.sourceKind,
			generationId: fragment.ref.generationId,
			ref: fragment.ref
		});
		selection = primaryEntry(stage.selectionState());
	}

	function openTask(): void {
		const stage = facade;
		const selected = selection;
		if (stage === null || selected === null) return;
		notice = '';
		if (selected.reference.domain !== 'layout') {
			// The host's own task is Plan membership, a Layout projection. A Scene or
			// other-domain subject is worked through its adapter's contributed task.
			notice = 'This subject has no Plan membership task. Invoke a contributed operation from the Index.';
			return;
		}
		const next: StageTask = {
			kind: 'subject-membership',
			label: 'Plan membership',
			targetRef: selected.representation ?? null, target: selected.reference
		};
		if (stage.openTask(next)) {
			task = next;
			// The host's own task: no adapter contributed this instrument.
			contributedTaskId = null;
		}
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
	function invokeContribution(adapterId: string, id: string): void {
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
		contributedTaskId = { id: opened.taskId, adapterId: opened.adapterId };
	}

	function closeTask(): void {
		// Disarm **before** closing: the close notifies the contribution surface, and a
		// notification re-arms an armed dock tool. An explicit close puts the tool down
		// first, so the notification it causes cannot pick it back up.
		armedTool = null;
		facade?.closeTask();
		task = null;
		contributedTaskId = null;
		// The Card's fold is reconsidered for the next task: a hand expansion belongs
		// to the work it was made for, not to the shell forever.
		cardExpanded = null;
	}

	function toggleReveal(sourceId: string): void {
		revealed = revealed.includes(sourceId)
			? revealed.filter((id) => id !== sourceId)
			: [...revealed, sourceId];
	}

	/* --- pointer and keyboard ---------------------------------------------- */

	let drag: { x: number; y: number; mode: 'pan' | 'orbit' | 'adapter' } | null = null;
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
	/**
	 * The drag-versus-click decision. It is **not** the gesture: pointer up ends the
	 * gesture, but the click that follows still has to know how far the pointer
	 * travelled, and an interruption has to stop that click from selecting. It also
	 * owns which pointer the press belongs to, so a second pointer cannot end the
	 * first one's lease or select through its refused press.
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

	function onPointerDown(event: PointerEvent): void {
		const stage = facade;
		if (stage === null || evaluation === null) return;
		// The adapters get the press first: the binding that owns an open task (a Scene
		// transform, an armed Ink chain) may claim it, and so may a binding that offers
		// direct manipulation with no task at all (a selected Wall's handles). Only a
		// refusal falls through to navigation.
		const pointerEvaluationId = stage.evaluationId();
		if (pointerEvaluationId !== null) {
			const css = stageCss(event);
			if (stage.pointerIntent({ phase: 'down', css, evaluationId: pointerEvaluationId, shift: event.shiftKey }).claimed) {
				(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
				if (press.begin({ x: event.clientX, y: event.clientY }, event.pointerId) === 'refused') {
					stage.pointerIntent({ phase: 'cancel', css, evaluationId: pointerEvaluationId, shift: event.shiftKey });
					return;
				}
				adapterEvaluationId = pointerEvaluationId;
				drag = { x: event.clientX, y: event.clientY, mode: 'adapter' };
				return;
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
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		if (press.begin({ x: event.clientX, y: event.clientY }, event.pointerId) === 'refused') {
			// Defensive: the lease said yes but the tracker already has a live press.
			session.gesture()?.release();
			return;
		}
		drag = { x: event.clientX, y: event.clientY, mode: event.button === 0 && !event.shiftKey ? 'pan' : 'orbit' };
	}

	function onPointerMove(event: PointerEvent): void {
		if (drag === null) {
			// Preview-only hover: the facade offers the unpressed move to the open
			// task's adapter but never claims it, so navigation stays untouched.
			const stage = facade;
			const id = adapterEvaluationId ?? stage?.evaluationId() ?? null;
			if (stage !== null && id !== null) {
				stage.pointerIntent({ phase: 'move', css: stageCss(event), evaluationId: id, shift: event.shiftKey });
			}
			return;
		}
		if (drag.mode === 'adapter') {
			if (!press.ownsPointer(event.pointerId)) return;
			// A reading change cancels the adapter's gesture lease before the next
			// frame. The pointer mapping was measured in the old projection, so the
			// press ends instead of dragging a proposal through a view it was never
			// measured in.
			if (session.gesture() === null) {
				cancelAdapterDrag(event);
				return;
			}
			const stage = facade;
			const id = adapterEvaluationId ?? stage?.evaluationId() ?? null;
			if (stage === null || id === null) return;
			// T3.P03.S02: one monotonic sequence per continuous input sample. The
			// adapter's preview installation and the accepted result inherit it.
			if (perfMarksEnabled()) perfInput('pointermove', { wallMode: true, eventTimeStamp: event.timeStamp, timeOrigin: performance.timeOrigin });
			stage.pointerIntent({ phase: 'move', css: stageCss(event), evaluationId: id, shift: event.shiftKey });
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
	function endGesture(): void {
		drag = null;
		adapterEvaluationId = null;
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
		endGesture();
	}

	function onPointerUp(event: PointerEvent): void {
		// A normal ending: the click that follows decides by distance, so the press is
		// ended, not aborted. Only the owning pointer may end it — a refused second
		// pointer's release must not release the first pointer's lease.
		if (!press.end(event.pointerId)) return;
		if (drag?.mode === 'adapter') {
			// The press belonged to an adapter: its tap is the tool's own command
			// (place a point, split a Wall, or a refusal) and never a selection, so the
			// click that follows selects nothing at all.
			press.claim(event.pointerId);
			const stage = facade;
			const id = adapterEvaluationId ?? stage?.evaluationId() ?? null;
			drag = null;
			adapterEvaluationId = null;
			if (stage !== null && id !== null) {
				// After a reading change the lease is already gone: the press is cancelled
				// rather than released, so no stale projection commits.
				const phase = session.gesture() === null ? 'cancel' : 'up';
				perfMark('input:release', { phase });
				stage.pointerIntent({ phase, css: stageCss(event), evaluationId: id, shift: event.shiftKey });
			}
			return;
		}
		endGesture();
	}

	/**
	 * Tell an adapter drag the press was interrupted, then drop it.
	 *
	 * The adapter owns its own candidate and baseline; ending only the host's
	 * gesture would leave it showing (and able to commit) a proposal from a press
	 * the creator never finished. The explicit `cancel` is the same one a real
	 * pointer cancel sends, so pointer cancel and capture loss converge on one adapter path. A reading
	 * interruption first reaches the adapter's changed-evaluation path above.
	 */
	function cancelAdapterDrag(event: PointerEvent): void {
		const stage = facade;
		const id = adapterEvaluationId ?? stage?.evaluationId() ?? null;
		drag = null;
		adapterEvaluationId = null;
		if (stage !== null && id !== null) {
			stage.pointerIntent({ phase: 'cancel', css: stageCss(event), evaluationId: id, shift: event.shiftKey });
		}
	}

	function onPointerCancel(event: PointerEvent): void {
		// The browser took the pointer back (touch interruption, a system gesture, the
		// window losing focus). Without this the lease would stay held and the next
		// stray move would pan with samples from a gesture the creator never finished.
		if (!press.abort(event.pointerId)) return;
		if (drag?.mode === 'adapter') {
			cancelAdapterDrag(event);
			return;
		}
		endGesture();
	}

	function onLostPointerCapture(event: PointerEvent): void {
		// Capture is also released implicitly *after* a normal pointer up, and that click
		// is still owed its drag decision. Losing it while the press is live is an
		// interruption instead. A non-owning pointer's capture is not this gesture.
		if (!press.ownsPointer(event.pointerId)) return;
		if (drag?.mode === 'adapter') {
			cancelAdapterDrag(event);
			press.abort(event.pointerId);
			return;
		}
		if (drag !== null) abortGesture();
		else endGesture();
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
		// An **armed dock tool** owns the Stage surface: its tap already placed a
		// point, split a Wall or was refused, and re-selecting underneath it would
		// silently move what the tool is editing. Another adapter's task (Compose,
		// Arrange, Import) does not: clicking the Stage stays the host's own Select,
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
			// Index, and this notice points there without pretending to localize.
			notice =
				planView !== null && planView.membership.some((row) => !row.eligible)
					? 'Nothing selectable there — some subjects are excluded from this Plan; Reveal one from the Index.'
					: 'Nothing selectable there.';
			return;
		}
		notice = 'That click did not land on the Plan.';
	}

	function onWheel(event: WheelEvent): void {
		event.preventDefault();
		zoom(Math.exp(event.deltaY * 0.001));
	}

	function handleKey(event: KeyboardEvent): void {
		// Preview is an isolated visitor run: Stage viewing keys do not apply there.
		if (preview !== null) {
			if (event.key === 'Escape') closePreview();
			return;
		}
		// Typing in the Index's subject search must never move the camera.
		if (stageKeyFromTextEntry(event.target)) return;
		const action = stageKeyAction(event.key);
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
			case 'fit':
				fit();
				break;
			case 'pan':
				pan(action.deltaCss[0], action.deltaCss[1]);
				break;
			case 'finish':
			case 'backtrack': {
				// The armed tool's own command, answered by the task that owns it. A tool
				// with nothing to finish refuses and the key does nothing at all.
				const stage = facade;
				if (stage === null || !stage.keyboardIntent({ kind: action.kind }).claimed) break;
				// One key, one activation: the palette's own control must not also be
				// activated by the same keystroke.
				event.preventDefault();
				break;
			}
			case 'delete':
				requestDelete();
				break;
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
				if (stage !== null && stage.keyboardIntent({ kind: 'cancel' }).claimed) break;
				abortGesture();
				if (task !== null) closeTask();
				else if (selection !== null) closeSelection();
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

	const indexGroups = $derived.by(() => {
		const plan = planView;
		if (plan === null) return [];
		const byKind = new Map<
			string,
			{ sourceId: string; label: string; kind: string; eligible: boolean; revealed: boolean; membership: string }[]
		>();
		for (const membership of plan.membership) {
			const items = byKind.get(membership.sourceKind) ?? [];
			items.push({
				sourceId: membership.sourceId,
				label: sourceLabel(membership.sourceId, membership.sourceKind),
				kind: membership.sourceKind,
				eligible: membership.eligible,
				revealed: membership.revealed,
				membership: membership.reason
			});
			byKind.set(membership.sourceKind, items);
		}
		const filtered = [...byKind.entries()]
			.filter(([, items]) => items.length > 0)
			.map(([kind, items]) => ({ id: kind, label: kind.replace('-', ' '), items }));
		if (query.trim() === '') return filtered;
		const needle = query.trim().toLowerCase();
		return filtered
			.map((group) => ({ ...group, items: group.items.filter((item) => item.label.toLowerCase().includes(needle)) }))
			.filter((group) => group.items.length > 0);
	});

	/**
	 * The collapsed Index header's one-line "Selected: …".
	 *
	 * Resolved from the membership row rather than from the Index's own item list:
	 * the panel is `hidden` when closed, so its body still evaluates, and letting it
	 * search the complete located-subject list made the whole list a dependency of a
	 * closed panel on every Plan evaluation. `planMembershipOf` is indexed, so this is
	 * the same string for `O(1)`.
	 */
	const selectedSubjectLabel = $derived.by((): string | null => {
		const plan = planView;
		const selected = selection;
		if (plan === null || selected === null) return null;
		const row = planMembershipOf(plan, selected.reference.subject.id);
		return row === null ? null : sourceLabel(row.sourceId, row.sourceKind);
	});

	/** Plan membership is a Layout fact; another domain's subject has none to report. */
	const selectedMembership = $derived.by((): PlanMembershipReason | null => {
		const plan = planView;
		const selected = selection;
		if (plan === null || selected === null || selected.reference.domain !== 'layout') return null;
		// Indexed against the membership array: this is read on every presented frame
		// while something is selected, so it must not scan the project.
		return planMembershipOf(plan, selected.reference.subject.id)?.reason ?? null;
	});

	/** The Card's identity: the canonical subject and, for Layout, its membership. */
	const cardIdentity = $derived(
		selection === null
			? null
			: {
					sourceId: selection.reference.subject.id,
					label: selection.reference.subject.id,
					kind: selection.reference.subject.kind,
					// Plan membership is the Layout status; a non-Layout subject names its
					// own domain instead of claiming an "unknown" Layout membership.
					status: selectedMembership ?? (selection.reference.domain === 'layout' ? 'unknown' : selection.reference.domain)
				}
	);

	/**
	 * The Card's owner/source/reach facts, read from the same Plan evaluation the
	 * Stage draws: the Card can never disagree with the render about membership.
	 */
	const cardFacts = $derived.by((): readonly { readonly label: string; readonly value: string }[] => {
		// Reading the version makes an adapter registration or disposal re-derive.
		void contributionsVersion;
		const selected = selection;
		if (selected === null) return [];
		const own = selected.reference.domain === 'layout'
			? [
				{ label: 'Stream', value: selected.representation?.stream ?? 'canonical' },
				{
					label: 'Eligible',
					value: String(
						(planView === null ? null : planMembershipOf(planView, selected.reference.subject.id))?.eligible ?? false
					)
				},
				{ label: 'Revealed', value: String(revealed.includes(selected.reference.subject.id)) },
				{
					label: 'Datum',
					value: `${boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain.datumMeters : 0} m`
				}
			]
			// Plan eligibility, Reveal and datum are Layout projections. A Scene or
			// other-domain subject shows its domain here and lets its own adapter
			// contribute the facts it actually owns.
			: [{ label: 'Domain', value: selected.reference.domain }];
		// Whatever adapters registered for this subject appears here without this
		// route knowing which domain contributed it.
		return stageCardFacts(facade, { sourceId: selected.reference.subject.id, sourceKind: selected.reference.subject.kind, ref: selected.representation ?? null, reference: selected.reference }, own);
	});

	/**
	 * The Card's name writer: the adapter that owns the selected subject delegates
	 * to its canonical planner. A non-Layout or read-only subject contributes none.
	 */
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

	/**
	 * Whether the Card is folded to identity.
	 *
	 * PLATE's arbitration: the Card keeps its facts readable *beside* the one lower
	 * column, so at constrained width it folds instead of covering the task. The
	 * creator's explicit expansion wins, and the fold is reconsidered once the task
	 * closes.
	 */
	const cardCollapsed = $derived(cardExpanded === null ? narrowShell && task !== null : !cardExpanded);

	/** Every contributed Find/rail entry from the adapters currently mounted. */
	const contributionGroups = $derived.by(() => {
		// Same signal: a newly registered adapter's Find entries appear at once.
		void contributionsVersion;
		return stageContributionGroups(facade);
	});

	/** The bottom dock's armable tools: the contributed entries whose home is the dock. */
	const dockTools = $derived.by(() => {
		void contributionsVersion;
		return stageDockTools(facade);
	});

	/** The armed contributed task's kind, or `null` when the host's Select is armed. */
	const armedTaskKind = $derived(task?.kind ?? null);

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
			...dockTools.map((tool) => ({
				id: tool.id,
				adapterId: tool.adapterId,
				label: tool.label,
				verb: 'Arm'
			})),
			...contributionGroups.flatMap((group) =>
				group.entries.map((entry) => ({
					id: entry.id,
					adapterId: entry.adapterId,
					label: entry.label,
					verb: 'Invoke'
				}))
			)
		];
		return needle === '' ? entries : entries.filter((entry) => entry.label.toLowerCase().includes(needle));
	});

	/**
	 * Arm a dock tool: the very same contributed task the Index invokes, so a tool
	 * has one operation behind it, never a second dock-only path into the domain.
	 */
	function armDockTool(tool: { readonly id: string; readonly adapterId: string }): void {
		invokeContribution(tool.adapterId, tool.id);
		armedTool = { id: tool.id, adapterId: tool.adapterId };
		paletteOpen = true;
		pendingDelete = null;
	}

	/** Select — the host's own tool: it closes the contributed task and keeps what is selected. */
	function selectTool(): void {
		closeTask();
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
		const stillContributed = stage
			.findEntries()
			.some((entry) => entry.id === armed.id && entry.adapterId === armed.adapterId);
		if (!stillContributed) return;
		invokeContribution(armed.adapterId, armed.id);
	}

	/** Pressing the armed key again folds or re-opens its palette without disarming the tool. */
	function togglePalette(): void {
		paletteOpen = !paletteOpen;
	}

	/** Reach a Find result: a dock tool arms, an Index entry invokes. */
	function runHeadFindEntry(entry: { readonly id: string; readonly adapterId: string }): void {
		const tool = dockTools.find(
			(candidate) => candidate.id === entry.id && candidate.adapterId === entry.adapterId
		);
		if (tool !== undefined) {
			armDockTool(tool);
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
		notice = outcome.kind === 'accepted' ? '' : outcome.message ?? `${record.label} was not applied.`;
	}

	/**
	 * The instrument host's task view. The target is named explicitly and may differ
	 * from the canonical selection — an Opening can stay selected while the task
	 * works on its host Wall.
	 */
	const taskHost = $derived(
		task === null
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

<div class="editor-host">
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
		{reducedMotion}
		onToggleReducedMotion={() => (reducedMotion = !reducedMotion)}
		projectActionsUnavailableReason={projectActionsUnavailableReason}
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
		<div class="source-findings" role="status" aria-label="Source findings">
			{#if sourceFindings.closure.length > 0}
				<p>
					<strong>This source cannot execute.</strong> Its resource requirements are not
					satisfied, so Save, accepted edits and release are unavailable. The source stays
					visible for inspection; nothing is repaired or pinned automatically.
				</p>
				<ul>
					{#each sourceFindings.closure.slice(0, 5) as finding (finding.path + finding.code)}
						<li>{finding.path}: {finding.message} ({finding.code})</li>
					{/each}
				</ul>
			{/if}
			{#if sourceFindings.diagnostics.length > 0}
				<p>
					{sourceFindings.diagnostics.length} repairable authored
					{sourceFindings.diagnostics.length === 1 ? 'binding is' : 'bindings are'} unresolved.
					They are disclosed as authored; they do not block this source.
				</p>
				<ul>
					{#each sourceFindings.diagnostics.slice(0, 5) as finding (finding.path + finding.code)}
						<li>{finding.path}: {finding.message} ({finding.code})</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	<div class="editor-body">
		{#if preview === null}
		<EditorIndex
			open={indexOpen}
			onToggle={() => (indexOpen = !indexOpen)}
			groups={indexGroups}
			contributions={contributionGroups}
			selectionId={selection?.reference.subject.id ?? null}
			selectedLabel={selectedSubjectLabel}
			{query}
			onQuery={(next) => (query = next)}
			onSelect={selectSource}
			onInvokeContribution={invokeContribution}
			onBringIntoView={(sourceId) => {
				const plan = planView;
				const fragment = plan === null ? undefined : planFragmentOf(plan, sourceId);
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
			onReveal={toggleReveal}
		/>
		{/if}

		<div class="stage-frame" style={`--lower-column-height: ${lowerColumnHeight}px`}>
			{#if preview === null}
			<!--
				The Stage surface is a pointer-driven viewport, not a widget: it handles
				click (selection through eligible Plan fragments) and wheel (zoom), while
				keyboard viewing intents are handled once by the host's own window listener
				(3/p/f/arrows/Escape) so a focused element handler cannot double-apply them.
			-->
			<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions, a11y_no_noninteractive_tabindex -->
			<div
				class="stage"
				bind:this={stageEl}
				role="application"
				tabindex="0"
				aria-label="Spatial stage"
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerCancel}
				onlostpointercapture={onLostPointerCapture}
				onclick={onClick}
				onwheel={onWheel}
			>
				{#if boot.status === 'ready' || boot.status === 'empty'}
					<StageCanvas
						geometry={boot.snapshot.domain.geometry}
						scene={boot.snapshot.domain.scene}
						rooms={boot.snapshot.domain.rooms}
						{evaluation}
						{ghosts}
						{modelUrls}
					/>
				{/if}
				<div class="overlay-layer">
					<StageOverlay {markers} {selectionMarker} {tracePreview} />
				</div>

				{#if boot.status === 'empty' && (currentEnvelope?.units.layout.data.rooms.length ?? 0) === 0}
					<p class="stage-note" role="status">Empty baseline — draw an enclosure with Ink to create a Room floor, or start from the gallery for a compilable room.</p>
				{/if}

				<!--
					The toolbar sits over the pointer-driven Stage surface, so it stops its
					own pointer and click events: pressing Plan/3D/Fit must never also
					hit-test the world underneath the button.
				-->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="stage-actions"
					onclick={(event) => event.stopPropagation()}
					onpointerdown={(event) => event.stopPropagation()}
				>
					<button type="button" onclick={() => setReading('plan')} aria-pressed={evaluation?.settledReading === 'plan'}>Plan</button>
					<button type="button" onclick={() => setReading('3d')} aria-pressed={evaluation?.settledReading === '3d'}>3D</button>
					<button type="button" onclick={fit}>Fit</button>
					<button type="button" onclick={() => requestReplacement('source')}>Open source JSON</button>
				</div>

				{#if lens === 'experience'}
					<!--
						Like the toolbar, this panel stops its own pointer/click events: the
						Stage surface below is pointer-driven and captures the pointer on press,
						so a bubbled press would move the click onto the Stage and a control
						inside the lens would never receive it.
					-->
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
					<div
						class="lens-surface"
						role="region"
						aria-label="Experience lens"
						onpointerdown={(event) => event.stopPropagation()}
						onclick={(event) => event.stopPropagation()}
					>
						{#if adapterServices !== null && currentEnvelope !== null}
							<ExperienceSurface
								services={adapterServices}
								snapshot={currentEnvelope}
								onEnterPreview={() => void openPreview()}
							/>
						{:else}
							<p class="lens-pending" role="status">The Experience lens mounts with the admitted project source.</p>
						{/if}
					</div>
				{/if}

				{#if notice}<p class="stage-note" role="status">{notice}</p>{/if}
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
						program={entry === null ? null : entry.kind === 'presentations' ? entry.program ?? null : entry.program}
						experienceOptions={entry === null ? null : entry.kind === 'presentations' ? entry.options ?? null : entry.options}
						entryPresentationId={entry?.kind === 'program' ? entry.entryPresentationId : null}
						runEpoch={previewView?.epoch ?? 0}
						active={preview !== null}
						resolveTexture={(uri: string) => (isAllowedShippedTextureUri(uri) ? uri : null)}
						{modelUrls}
						{reducedMotion}
						title={entry?.title ?? null}
						onExit={closePreview}
					/>
				</div>
			{:else if preview !== null}
				<p class="stage-note" role="status">Loading the visitor Preview…</p>
			{/if}
			{#if preview !== null}
				<p class="stage-note preview-actions-note" role="status">Project rename and delete are unavailable in Preview. Exit Preview to manage this project.</p>
			{/if}

			<EditorCard
				identity={cardOpen ? cardIdentity : null}
				facts={cardFacts}
				nameWriter={cardNameWriter}
				writer={cardWriter}
				actions={cardActions}
				collapsed={cardCollapsed}
				onToggleCollapsed={() => (cardExpanded = cardCollapsed)}
				onClose={closeCard}
				onFocusTask={() => {
					notice = 'Focus deepens the current task; task depth arrives with T1.P01.S04.';
				}}
				onOpenTask={openTask}
				onBringIntoView={() => {
					const target = selectedWorldPoint();
					if (target !== null) bringIntoView(target);
				}}
			/>

			{#if inactiveTask}
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
			<div class="lower-column" data-lower-column bind:this={lowerColumnEl}>
				<StageDock
					{armedTaskKind}
					tools={dockTools}
					{paletteOpen}
					onSelect={selectTool}
					onArm={armDockTool}
					onTogglePalette={togglePalette}
				/>
				<StageInstrumentHost
					task={paletteOpen ? taskHost : null}
					onClose={closeTask}
					instrument={contributedInstrument}
				>
					{#if selection !== null}
						{@const selectedId = selection.reference.subject.id}
						<div class="instrument-body">
							<p>Declared membership: <strong>{selectedMembership ?? 'unknown'}</strong></p>
							<button type="button" onclick={() => toggleReveal(selectedId)}>
								{revealed.includes(selectedId) ? 'Hide' : 'Reveal'}
							</button>
						</div>
					{/if}
				</StageInstrumentHost>
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
				<p>Loading project…</p>
			{:else if boot.status === 'missing'}
				<h1>Project not found</h1>
				<p>This project does not exist for your account.</p>
			{:else if boot.status === 'forbidden'}
				<h1>Sign-in required</h1>
				<p>This project belongs to another session.</p>
			{:else if boot.status === 'refused'}
				<h1>Unsupported project source</h1>
				<p>
					{boot.reason === 'invalid-json'
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
		background: #111117;
		color: #f4f0e9;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	.editor-host {
		display: flex;
		flex-direction: column;
		height: 100dvh;
	}
	.editor-body {
		display: flex;
		min-height: 0;
		flex: 1;
		overflow: hidden;
	}
	.stage-frame {
		position: relative;
		min-width: 0;
		flex: 1;
	}
	.stage {
		position: absolute;
		inset: 0;
		background: #111117;
		outline: none;
		touch-action: none;
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
	.lower-column {
		position: absolute;
		inset-inline: 0.75rem;
		bottom: 0.75rem;
		z-index: 6;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		pointer-events: none;
	}
	.lower-column > :global(*) {
		pointer-events: auto;
	}
	.stage-actions {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		display: flex;
		gap: 0.4rem;
	}
	.stage-actions button {
		padding: 0.4rem 0.6rem;
		border: 1px solid #635a6f;
		border-radius: 0.35rem;
		background: rgb(25 24 31 / 85%);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.stage-actions button[aria-pressed='true'] {
		border-color: #d4ad45;
		color: #f4d98a;
	}
	/*
		Round 2's one lower working edge: the invited Guide instrument sits above the
		surface's own dock, centred on the Stage, and the Stage stays dominant. This is
		the Capture/Guide contribution, not a second shell column.
	*/
	.lens-surface {
		position: absolute;
		left: 50%;
		bottom: 0.75rem;
		transform: translateX(-50%);
		max-height: calc(100% - 5rem);
		width: min(52rem, calc(100% - 1.5rem));
		display: flex;
		min-height: 0;
	}
	.lens-surface :global(.experience-surface) {
		flex: 1;
		min-height: 0;
	}
	.lens-pending {
		margin: 0;
		padding: 0.6rem 0.75rem;
		color: #bcb5c4;
		font-size: 0.86rem;
		line-height: 1.45;
	}
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
	.instrument-body {
		display: flex;
		align-items: center;
		gap: 0.75rem;
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
		padding: 0.7rem 1rem;
		border-bottom: 1px solid #635a6f;
		background: #201d29;
		color: #ddd6e6;
	}
	.source-findings p {
		margin: 0 0 0.35rem;
		line-height: 1.4;
	}
	.source-findings ul {
		margin: 0 0 0.35rem 1rem;
		padding: 0;
		font-size: 0.85rem;
	}
	.source-findings li {
		margin-bottom: 0.2rem;
	}
	.boot-panel {
		position: absolute;
		top: 4rem;
		left: 50%;
		transform: translateX(-50%);
		width: min(32rem, calc(100% - 2rem));
		padding: 1.25rem;
		border: 1px solid #4d4655;
		border-radius: 0.6rem;
		background: rgb(25 24 31 / 96%);
		box-sizing: border-box;
	}
	.boot-panel h1 {
		margin: 0 0 0.5rem;
		font-size: 1.15rem;
	}
	.boot-panel p {
		margin: 0 0 0.75rem;
		color: #bcb5c4;
	}
	.boot-panel button {
		margin-right: 0.5rem;
		padding: 0.5rem 0.8rem;
		border: 1px solid #635a6f;
		border-radius: 0.35rem;
		background: #292632;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.boot-panel button.primary {
		border-color: #b997f2;
		background: #8f69c8;
		color: #fff;
	}
	@media (max-width: 720px) {
		.editor-body {
			flex-direction: column;
		}
		/* Below the centered lens panel in a narrow shell, so the notice never
		   overlaps its buttons. */
		.stage-note {
			bottom: 0.5rem;
		}
	}
</style>
