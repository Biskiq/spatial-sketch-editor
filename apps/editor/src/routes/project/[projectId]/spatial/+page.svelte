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
	import { onMount } from 'svelte';
	import { beforeNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { env } from '$env/dynamic/public';
	import {
		createProjectApi,
		createProjectAuth,
		ProjectPersistenceError,
		type ProjectApi
	} from '$lib/platform/project-persistence';
	import { perfInput, perfMark, perfMarksEnabled, perfTracePreview, type PerfTracePreview } from '$lib/platform/perf-marks';
	import {
		discardPendingCapture,
		persistPendingCapture,
		readPendingCapture
	} from '$lib/authoring/save/pending-capture';
	import type { SaveRequest } from '@portfolio/project-model/save';
	import type { ProjectEnvelope } from '@portfolio/project-model/units';
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
	import type { AdmissionContext, StageReadSnapshot } from '$lib/authoring/stage/source-admission';
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
	import { stageCardFacts, stageContributionGroups } from '$lib/authoring/stage/stage-contributions';
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
	import type { PlanEvaluation, PlanMembershipReason } from '@portfolio/layout-core';
	import type { ViewingIntent, ViewportEvaluation, ViewportRect } from '@portfolio/camera-core';
	import {
		createStagePressTracker,
		readingIntentClockSeconds,
		stageKeyAction,
		stageKeyFromTextEntry
	} from '$lib/authoring/stage/stage-input';
	import EditorHead from '$lib/authoring/stage/shell/EditorHead.svelte';
	import EditorIndex from '$lib/authoring/stage/shell/EditorIndex.svelte';
	import EditorCard from '$lib/authoring/stage/shell/EditorCard.svelte';
	import StageInstrumentHost from '$lib/authoring/stage/shell/StageInstrumentHost.svelte';
	import StageCanvas from '$lib/authoring/stage/shell/StageCanvas.svelte';
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
	type VisitorSurface = (typeof import('$lib/visitor/VisitorPreviewSurface.svelte'))['default'];
	let previewSurface = $state.raw<VisitorSurface | null>(null);
	let previewEpoch = 0;
	let previewBusy = $state(false);
	/** The adapter services the Experience lens surface edits through. */
	let adapterServices = $state.raw<StageAdapterServices | null>(null);
	const currentEnvelope = $derived.by((): ProjectEnvelope | null =>
		boot.status === 'ready' || boot.status === 'empty' ? stageEnvelope(boot.snapshot) : null
	);
	const previewRead = $derived(
		boot.status === 'ready' || boot.status === 'empty' ? boot.snapshot.domain : null
	);
	const previewAvailable = $derived(
		currentEnvelope !== null && currentEnvelope.units.experience.data.experiences.length > 0
	);

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
		if (active === null || stage === null) return;
		const returned = returnPreview(stage.camera);
		perfMark('preview:returned', { outcome: returned.kind });
		if (returned.kind === 'refused') notice = returned.message;
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
			// The visitor surface is its own chunk: the Stage first-load set never
			// carries it, and a second entry reuses what the first loaded. Only this
			// load can fail below, and it runs **before** ownership moves, so a failure
			// never leaves the output owned by a Preview that did not mount.
			if (previewSurface === null) {
				try {
					const module = await import('$lib/visitor/VisitorPreviewSurface.svelte');
					previewSurface = module.default;
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
	let selectionMarker = $state<{ css: readonly [number, number]; label: string } | null>(null);
	let notice = $state('');
	let pendingReplacement = $state<null | 'starter' | 'empty' | 'source'>(null);
	/** Set by the route's teardown: no late completion may mount a stage after it. */
	let tornDown = false;
	let stageEl: HTMLDivElement | undefined = $state(undefined);
	/**
	 * Whether the contextual Card is shown. Closing the Card never clears the
	 * selection: the Index keeps echoing it, and selecting the subject again (or
	 * another one) brings the Card back, so identity is never lost to a dismissal.
	 */
	let cardOpen = $state(true);

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
		const unsaved = headSave?.unsavedWork();
		if (unsaved?.kind !== 'confirm') return;
		if (typeof window === 'undefined' || window.confirm(unsaved.message)) return;
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
		cardOpen = true;
		drag = null;
		// A replacement is not a press the creator finished: no click from the old
		// project may select into the new one.
		press.abort();
		planView = null;
		// The key must be dropped with the view it described, or the recompute that
		// follows a swap would be skipped as unchanged.
		planKey = '';
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
		// The mounted facade is the epoch's source. The mark is the anchor the
		// performance harness uses for the first architectural frame (F1/F2).
		perfMark('stage:activated', { sourceContentId: snapshot.sourceContentId });
		acceptance = mounted;
		adapterServices = createStageAdapterServices(facade, mounted);
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
			}
			task = facade?.session.task() ?? null;
			selection = facade ? primaryEntry(facade.selectionState()) : null;
			syncContributedTask();
			planKey = '';
			refresh();
		});
		for (const factory of stageAdapterFactories) mountStageAdapter(facade, mounted, factory);
		// The previous epoch's controller belongs to its disposed coordinator; this
		// epoch gets exactly one state machine over the new one.
		headSave = buildHeadSave(mounted, snapshot);
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

	/**
	 * A conflict's explicit *Reload remote*: the offer is data, and this host's
	 * replacement path is the only thing that installs it.
	 */
	async function applyReloadOffer(offer: ReloadOffer): Promise<void> {
		if (offer.kind === 'unavailable') {
			notice = 'The remote copy could not be loaded; your local work is unchanged.';
			return;
		}
		const unsaved = headSave?.unsavedWork();
		if (
			unsaved?.kind === 'confirm' &&
			typeof window !== 'undefined' &&
			!window.confirm(unsaved.message)
		) {
			return;
		}
		// TD-10: the accepted offer is this epoch's, not whichever epoch is mounted
		// when its admission resolves. Capture the token before admitting, so a
		// `Reload remote` that a newer replacement (or teardown) superseded is
		// abandoned instead of installing over the project the creator now has.
		const token = session.token();
		const next = await bootFromSourceJson(JSON.stringify(offer.document), projectId, admissionContext());
		// Admission itself is asynchronous: a stale offer installs nothing, adopts no
		// saved base and reports no refusal over the newer session.
		if (!session.isCurrent(token)) return;
		// Only a source that actually admitted replaces the mounted project and
		// becomes this epoch's saved base. A failed reload keeps the local source,
		// its history/selection and the saved base the Head is still saving against.
		if (next.status !== 'ready' && next.status !== 'empty') {
			reportSourceRefusal(next, 'reload');
			return;
		}
		pendingSavedBase = {
			token: offer.savedBaseToken,
			revision: offer.savedRevision,
			contentId: offer.savedSourceContentId
		};
		remoteSavedCanonicalJson = next.snapshot.canonicalJson;
		applyState(next);
	}

	function requestReplacement(action: 'starter' | 'empty' | 'source'): void {
		if (activeProject()) {
			// Unsaved work is signalled explicitly and confirmed before the guard even
			// opens: a replacement would discard the local source, so no path may skip
			// this question.
			const unsaved = headSave?.unsavedWork();
			if (
				unsaved?.kind === 'confirm' &&
				typeof window !== 'undefined' &&
				!window.confirm(unsaved.message)
			) {
				return;
			}
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

		// The Plan evaluation is recomputed only when its inputs move: pose target,
		// reveal union or generation. It is pure, but a per-frame compile sweep is
		// waste, not evidence.
		const target = stage.camera.state().pose.target;
		// One value is both what the facade is told and what the cache key names, so a
		// parameter change can never leave a stale Plan behind the live hit path.
		const parameters = { reveal: [...revealed].sort() };
		const key = `${stage.snapshot().compileGeneration}|${target[0]}:${target[2]}|${JSON.stringify(parameters)}`;
		if (key !== planKey) {
			planKey = key;
			// Reveal is host state the facade holds, so the Plan the Stage draws and
			// the Plan its hit path resolves agree about which sources are eligible.
			stage.setPlanParameters(parameters);
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
		const fragment = plan?.fragments.find((candidate) => candidate.ref.sourceId === selected.reference.subject.id);
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
			window.removeEventListener('keydown', onKey);
			// Session teardown cancels every registered writer (including an in-flight
			// project GET) and runs every registered disposer exactly once; no
			// project-specific singleton — acceptance host, history or facade — survives
			// the route.
			unsubscribeContributions?.();
			unsubscribeAcceptance?.();
			unsubscribeContributions = null;
			acceptance?.dispose();
			facade?.dispose();
			session.dispose();
		};
	});

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
		const fragment = plan.fragments.find((candidate) => candidate.ref.sourceId === sourceId);
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
		const opened = stage.openFindEntry(adapterId, id);
		if (opened.kind !== 'opened') {
			notice = opened.message;
			return;
		}
		task = opened.task;
		contributedTaskId = { id: opened.taskId, adapterId: opened.adapterId };
	}

	function closeTask(): void {
		facade?.closeTask();
		task = null;
		contributedTaskId = null;
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
		// A contributed task gets the press first: its adapter may claim a drag
		// (a Scene transform), and only a refusal falls through to navigation.
		const pointerEvaluationId = stage.evaluationId();
		if (task !== null && pointerEvaluationId !== null) {
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
			policy: 'continue-after-revalidation'
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
		if (drag === null) return;
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
			case 'dismiss':
				// The deepest open context closes first: the task, then the selection.
				abortGesture();
				if (task !== null) closeTask();
				else if (selection !== null) closeSelection();
				break;
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

	/** Plan membership is a Layout fact; another domain's subject has none to report. */
	const selectedMembership = $derived.by((): PlanMembershipReason | null => {
		const plan = planView;
		const selected = selection;
		if (plan === null || selected === null || selected.reference.domain !== 'layout') return null;
		return plan.membership.find((row) => row.sourceId === selected.reference.subject.id)?.reason ?? null;
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
				{ label: 'Eligible', value: String(planView?.membership.find((row) => row.sourceId === selected.reference.subject.id)?.eligible ?? false) },
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

	/** Every contributed Find/rail entry from the adapters currently mounted. */
	const contributionGroups = $derived.by(() => {
		// Same signal: a newly registered adapter's Find entries appear at once.
		void contributionsVersion;
		return stageContributionGroups(facade);
	});

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
		const fragment = plan.fragments.find((candidate) => candidate.ref.sourceId === selected.reference.subject.id);
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
	/>

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
		<EditorIndex
			open={indexOpen}
			onToggle={() => (indexOpen = !indexOpen)}
			groups={indexGroups}
			contributions={contributionGroups}
			selectionId={selection?.reference.subject.id ?? null}
			{query}
			onQuery={(next) => (query = next)}
			onSelect={selectSource}
			onInvokeContribution={invokeContribution}
			onBringIntoView={(sourceId) => {
				const plan = planView;
				const fragment = plan?.fragments.find((candidate) => candidate.ref.sourceId === sourceId);
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

		<div class="stage-frame">
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
					/>
				{/if}
				<div class="overlay-layer">
					<StageOverlay {markers} {selectionMarker} {tracePreview} />
				</div>

				{#if boot.status === 'empty'}
					<p class="stage-note" role="status">Empty baseline — no enclosure drawn yet. Start from the gallery for a compilable room.</p>
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

			{#if preview !== null && previewSurface !== null && previewRead !== null}
				{@const Surface = previewSurface}
				{@const entry = preview.entry}
				<!--
					The Preview takeover replaces the Stage rather than sitting on top of
					a live one: the authoring canvas is unmounted, so no inspection claim,
					gesture or overlay survives into the isolated visitor run.
				-->
				<div class="preview-takeover" role="region" aria-label="Visitor preview">
					{#key preview.epoch}
						<Surface
							geometry={previewRead.geometry}
							scene={previewRead.scene}
							rooms={previewRead.rooms}
							graph={previewRead.graph}
							program={entry.kind === 'presentations' ? entry.program ?? null : entry.program}
							experienceOptions={entry.kind === 'presentations' ? entry.options ?? null : entry.options}
							entryPresentationId={entry.kind === 'program' ? entry.entryPresentationId : null}
							resolveTexture={(uri: string) => (isAllowedShippedTextureUri(uri) ? uri : null)}
							{reducedMotion}
							title={entry.title}
							onExit={closePreview}
						/>
					{/key}
				</div>
			{:else if preview !== null}
				<p class="stage-note" role="status">Loading the visitor Preview…</p>
			{/if}

			<EditorCard
				identity={cardOpen ? cardIdentity : null}
				facts={cardFacts}
				nameWriter={cardNameWriter}
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
			<StageInstrumentHost task={taskHost} onClose={closeTask} instrument={contributedInstrument}>
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
