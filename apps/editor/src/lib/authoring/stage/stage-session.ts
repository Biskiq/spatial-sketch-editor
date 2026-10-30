/**
 * The editor **session host**: one replacement epoch, one cancellation registry,
 * one canonical selection, one task home and one gesture lease.
 *
 * The session is the single owner of the facts that must not survive a project
 * replacement. `replace()` is the whole lifetime transition, and its order is the
 * contract:
 *
 * 1. **Validate first.** The caller supplies an already-admitted snapshot, so a
 *    replacement cannot half-happen: nothing is cancelled or cleared for a source
 *    that then fails admission.
 * 2. **Cancel writers atomically.** Every registered load, gesture, camera run,
 *    task, command or project action is cancelled exactly once and its token becomes stale.
 * 3. **Clear the old context.** Selection, task and gesture leases are cleared;
 *    no project-specific singleton survives.
 * 4. **Swap.** The epoch advances and the new snapshot becomes current.
 *
 * Stale completions cannot affect the replacement because every writer is
 * registered **with the epoch it was started under** and `isCurrent` compares
 * against the live epoch: a prior-epoch load, ray, gesture or Camera completion
 * that resolves after the swap is refused rather than installed.
 */
import { immutableF4Data, resolveReference, type SemanticReference, type F4JsonValue, type AcceptedRevision } from '@portfolio/project-model';

import type { EntryRequalification } from './selection-requalification';
import type { PlanSourceKind, PlanSourceRef } from '@portfolio/layout-core';
import type { StageReadSnapshot } from './accepted-read';
import { EMPTY_SELECTION, admitSelection, primaryEntry, layoutSelectionReference, sameReference, type StageSelectionState, type StageSelectionChange, type StageSelectionEntry } from './semantic-selection';
import {
	STAGE_DRAFTING_DEFAULTS,
	applyDraftingPatch,
	type StageDraftingPatch,
	type StageDraftingState
} from './stage-drafting';
import { createStageHeightSheet, type StageHeightSheet } from './stage-height-sheet';

export type SessionEpoch = string;

/** The families of writer the session can cancel, for diagnostics and policy. */
export type WriterKind = 'load' | 'gesture' | 'camera' | 'task' | 'command' | 'project-action';

/** A registration is bounded by the epoch it was started under. */
export type WriterRegistration = {
	readonly kind: WriterKind;
	readonly token: ReplacementEpochToken;
};

export type CancellationRegistry = {
	register(kind: WriterKind, token: ReplacementEpochToken, cancel: () => void): () => void;
	/** Cancel every live registration exactly once; returns how many were cancelled. */
	cancelAll(reason?: string): number;
	cancelKinds(kinds: readonly WriterKind[]): number;
	readonly size: number;
};

export type ReplacementEpochToken = {
	readonly sessionEpoch: SessionEpoch;
	readonly epoch: number;
};

/** One canonical selection value. Never a task focus, reference or temporary geometry. */
export type StageSelection = {
	/** Canonical source identity (opaque, stable). */
	readonly sourceId: string;
	readonly sourceKind: PlanSourceKind;
	/** The compile/representation generation the fragment belongs to. */
	readonly generationId: string;
	/** The landed correspondence shape, qualified into `DerivedSourceRef` above the host. */
	readonly ref: PlanSourceRef;
};

export type StageLens = 'world' | 'experience';
export type StageTask = {
	readonly lens?: StageLens;
	readonly target?: SemanticReference | null;
	readonly configuration?: F4JsonValue;
	/** Registered task kind, e.g. a Wall-side procedure. */
	readonly kind: string;
	/** What the task works on; may differ from selection and stays explicit. */
	readonly targetRef: PlanSourceRef | null;
	readonly label: string;
};

/** One ordered entry the accepted change did not preserve, with the reason it went. */
export type SelectionRemoval = { readonly reference: SemanticReference; readonly reason: 'subject-retired' | 'no-correspondence' };
export type TaskResumeOutcome = { readonly kind: 'resumed' } | { readonly kind: 'refused'; readonly code: string; readonly message: string };
export type TaskLifecycle = { readonly status: 'active' | 'inactive'; readonly task: StageTask };

export type GestureTransitionPolicy =
	| 'continue-after-revalidation'
	| 'suspend-proposal'
	| 'cancel-on-reading-change';

export type GestureLease = {
	/**
	 * Whether this lease is **navigation** rather than authoring work.
	 *
	 * The declaration is what keeps `liveProposal()` free of a list of owner
	 * names: a navigation press explicitly says it is one and never blocks
	 * history; every other live lease is authored work whose candidate is not in
	 * the document yet, which is exactly what Undo must explain before it runs.
	 *
	 * Additive with a default: a lease that does not declare it is authored work,
	 * which is the conservative reading — an unknown holder may be previewing a
	 * candidate that is not in the document yet.
	 */
	readonly navigation?: boolean;
	readonly owner: string;
	readonly evaluationId: string;
	readonly acceptedRevision: AcceptedRevision;
	readonly policy: GestureTransitionPolicy;
	readonly token: ReplacementEpochToken;
	/** `true` until released, superseded by a replacement or ended by the host. */
	readonly active: boolean;
	release(): void;
};

export type GestureAcquisition =
	| { readonly kind: 'granted'; readonly lease: GestureLease }
	| { readonly kind: 'refused'; readonly code: 'gesture-held' | 'stale-epoch'; readonly owner: string };

/**
 * One live **proposal**: work the creator has named but not yet accepted.
 *
 * A proposal is the session-wide statement "Undo/Redo must explain finish or
 * cancel first", and it is deliberately *not* a list of gesture owners. A drag
 * that previews a candidate and a live Wall chain are both proposals, but a
 * chain outlives the press that started it, so the lease is its own object:
 * the writer acquires it when the proposal becomes visible and releases it when
 * the proposal is accepted, refused or cancelled — never earlier.
 *
 * The reason is carried **until release**, so a blocked Undo can name what must
 * settle first instead of guessing from whichever gesture happens to be live.
 */
export type ProposalLease = {
	readonly owner: string;
	readonly reason: string;
	/** `true` until released, superseded by a replacement or ended by the host. */
	readonly active: boolean;
	release(): void;
};

/** The oldest live proposal: the one an Undo/Redo refusal names. */
export type LiveProposal = { readonly owner: string; readonly reason: string };

/** One reading of the settled projection, before and after a reading change. */
export type GestureReadingChange = {
	readonly cancelled: boolean;
	readonly suspended: boolean;
	readonly owner: string | null;
};

/**
 * The host's decision about one live selection across an accepted content change.
 *
 * Requalification is supplied by the host because only the acceptance
 * correspondence knows whether a subject survived; the session validates nothing
 * about the mapping and never re-resolves a subject by coordinate or proximity.
 */
export type SelectionRequalification = (selection: StageSelection) => StageSelection | null | Extract<SelectionRequalificationOutcome, { kind: 'cleared' }>;

/** What happened to the previous selection when content changed. */
export type SelectionRequalificationOutcome =
	| { readonly kind: 'requalified'; readonly selection: StageSelection }
	| { readonly kind: 'cleared'; readonly reason: 'subject-retired' | 'no-correspondence' }
	| { readonly kind: 'none' };

/**
 * The outcome of installing changed content into the one accepted-source slot.
 *
 * A **content change** is deliberately not a replacement: the project identity is
 * the same, so the host session epoch does not advance and no writer is cancelled
 * for content that still belongs to the same project — but the task, gesture and
 * selection that named a fragment of the previous compile generation cannot
 * survive it unchanged. Selection is requalified through accepted correspondence
 * when the host supplies that mapping, and cleared with a reason otherwise.
 */
export type AcceptedSlotInstall =
	| {
			readonly kind: 'installed';
			readonly previousSourceContentId: string;
			readonly sourceContentId: string;
			readonly clearedSelection: boolean;
			readonly closedTask: boolean;
			/** The proposal bound to the replaced revision, released by the change. */
			readonly releasedGestures: number;
			/**
			 * What the retained Layout helper did with its primary projection. It is a
			 * compatibility report, not the canonical record: `selectionRemovals` names
			 * every ordered entry that did not survive, including Scene entries this field
			 * never described.
			 */
			readonly requalification: SelectionRequalificationOutcome;
			readonly selectionRemovals: readonly SelectionRemoval[];
	  }
	| { readonly kind: 'unchanged'; readonly sourceContentId: string }
	| {
			readonly kind: 'refused';
			readonly code: 'disposed' | 'no-current-source' | 'different-project' | 'stale-session';
			readonly message: string;
	  };

export type ReplacementResult = {
	readonly token: ReplacementEpochToken;
	readonly previousToken: ReplacementEpochToken;
	readonly cancelledWriters: number;
	readonly clearedSelection: boolean;
	readonly closedTask: boolean;
	readonly releasedGestures: number;
};

export type StageMetadataAdoption =
	| { readonly kind: 'adopted'; readonly previousSourceContentId: string; readonly sourceContentId: string }
	| { readonly kind: 'unchanged'; readonly sourceContentId: string }
	| { readonly kind: 'refused'; readonly code: 'disposed' | 'no-current-source' | 'different-project' | 'stale-session' | 'domain-changed'; readonly message: string };

export type StageSession = {
	readonly sessionEpoch: SessionEpoch;
	token(): ReplacementEpochToken;
	isCurrent(token: ReplacementEpochToken): boolean;
	writers(): CancellationRegistry;
	current(): StageReadSnapshot | null;
	/** Layout convenience view of the primary item; canonical state is selectionState(). */
	selection(): StageSelection | null;
	selectionState(): StageSelectionState;
	/** Ephemeral pointer hover; never part of accepted content or history. */
	hover(): StageSelectionEntry | null;
	setHover(entry: StageSelectionEntry | null): void;
	setSelection(value: StageSelectionState): StageSelectionChange;
	lens(): StageLens;
	changeLens(next: StageLens): boolean;
	/**
	 * The one Grid/Snap view state. It is view state only: changing it writes no
	 * source, no history entry and no Save, and a project replacement keeps it.
	 */
	drafting(): StageDraftingState;
	setDrafting(patch: StageDraftingPatch): StageDraftingState;
	/**
	 * The one Height Sheet height fact. Session view state: a replacement resets
	 * it, it is never serialized and it never reaches history or Save.
	 */
	heightSheet(): StageHeightSheet;
	taskLifecycle(): TaskLifecycle | null;
	resumeTask(validate: (task: StageTask, current: StageReadSnapshot) => TaskResumeOutcome): TaskResumeOutcome;
	/** Invalidates lens/task-bound asynchronous writers without replacing accepted content. */
	writerGeneration(): number;
	/** Tracks deliberate task and lens choices, excluding automatic install closure. */
	taskChoiceGeneration(): number;
	select(selection: StageSelection | null): void;
	task(): StageTask | null;
	openTask(task: StageTask): boolean;
	closeTask(): boolean;
	gesture(): GestureLease | null;
	/**
	 * Register one live proposal. Undo/Redo is unavailable while any lease is
	 * live, and a released lease (or one ended by an install, replacement or
	 * teardown) can never block history again.
	 */
	registerProposal(input: { readonly owner: string; readonly reason: string }): ProposalLease;
	/**
	 * The oldest live proposal, or `null` when nothing is proposed.
	 *
	 * A **gesture lease that is not navigation** is a proposal too (its candidate
	 * is not in the document yet), and this answers for it as well, so a caller
	 * never has to know which mechanism holds the live value.
	 */
	liveProposal(): LiveProposal | null;
	/** One lease at a time; a second request is refused and navigation cannot steal it. */
	acquireGesture(request: {
		owner: string;
		evaluationId: string;
		acceptedRevision: AcceptedRevision;
		policy: GestureTransitionPolicy;
		/** `true` for the host's own navigation press; default `false`. */
		navigation?: boolean;
	}): GestureAcquisition;
	/**
	 * Run the live lease's transition policy once, immediately before the host
	 * changes the reading.
	 *
	 * `cancel-on-reading-change` releases the lease (the samples the gesture took
	 * were projected in the reading that is ending). `continue-after-revalidation`
	 * keeps it: the accepted revision is unchanged, so the operation it names is
	 * still the same operation. `suspend-proposal` keeps the lease but reports the
	 * proposal suspended — S02 has no proposal writer, so that is the whole effect
	 * today and the reason it is reported rather than silently assumed.
	 */
	applyReadingChange(): GestureReadingChange;
	/** Validate-first, then atomically cancel/clear/swap. */
	replace(admitted: StageReadSnapshot): ReplacementResult;
	/**
	 * Install changed content for the **current** project into the one
	 * accepted-source slot: same session epoch, no cancellation, generation-bound
	 * task/gesture ended. A different project identity is refused — that is a
	 * replacement. Selection is requalified through the host's correspondence
	 * mapping, or cleared with a reason when it does not survive.
	 */
	installAccepted(next: StageReadSnapshot, options?: { readonly requalify?: SelectionRequalification; readonly requalifyEntry?: (entry: StageSelectionEntry) => EntryRequalification }): AcceptedSlotInstall;
	/** Adopt project-level metadata while domain units and their representation stay identical. */
	adoptMetadata(next: StageReadSnapshot): StageMetadataAdoption;
	/** Register a disposer run exactly once at session teardown. */
	addDisposable(dispose: () => void): () => void;
	/** Session teardown: cancel writers, release leases, run disposables exactly once. */
	dispose(): void;
};

export function createCancellationRegistry(): CancellationRegistry {
	const live = new Map<number, { kind: WriterKind; cancel: () => void }>();
	let nextHandle = 1;
	return {
		register(kind, _token, cancel) {
			const handle = nextHandle;
			nextHandle += 1;
			live.set(handle, { kind, cancel });
			return () => {
				live.delete(handle);
			};
		},
		cancelKinds(kinds) {
			const entries = [...live.entries()].filter(([, entry]) => kinds.includes(entry.kind));
			for (const [id] of entries) live.delete(id);
			for (const [, entry] of entries) { try { entry.cancel(); } catch { /* Finish all cancellations. */ } }
			return entries.length;
		},
		cancelAll() {
			const entries = [...live.entries()];
			live.clear();
			for (const [, entry] of entries) {
				try {
					entry.cancel();
				} catch {
					// A canceller that throws must not strand the remaining writers.
				}
			}
			return entries.length;
		},
		get size() {
			return live.size;
		}
	};
}

/**
 * Run one cloud read as a **bound load**.
 *
 * The load registers itself in the session's cancellation registry, so a
 * replacement or teardown aborts the request exactly once instead of leaving it
 * to resolve into a stage that has moved on. Its result is returned only when the
 * epoch it started under is still the current one — a completion that lands after
 * a replacement is `null`, never an install.
 *
 * This is the mechanism the session's contract already names ("every registered
 * load ... is cancelled exactly once", "a prior-epoch load ... is refused rather
 * than installed"); the route must use it rather than holding a private
 * `AbortController` nobody cancels.
 */
export async function runBoundLoad<T>(
	session: StageSession,
	start: (signal: AbortSignal) => Promise<T>
): Promise<T | null> {
	const token = session.token();
	const controller = new AbortController();
	const unregister = session.writers().register('load', token, () => controller.abort());
	try {
		const value = await start(controller.signal);
		if (controller.signal.aborted || !session.isCurrent(token)) return null;
		return value;
	} finally {
		unregister();
	}
}

let epochCounter = 0;

function freshSessionEpoch(): SessionEpoch {
	epochCounter += 1;
	return `session-${epochCounter}`;
}

/**
 * Create one session at an explicit epoch.
 *
 * `sessionEpoch` is the host lifetime guard the landed ticket protocol compares;
 * `epoch` is the monotonic replacement counter. They are deliberately separate:
 * the epoch orders replacements within a session, and the session epoch is what a
 * leftover ticket from a closed session fails against.
 */
/**
 * The standing words for a live authored gesture: the creator finishes or
 * cancels the edit, and Undo runs afterwards. A registered proposal may carry
 * its own more specific reason.
 */
export const PROPOSAL_REASON =
	'A proposal is live; finish or cancel it — Undo is available once it is accepted or refused.';

export function createStageSession(options: { sessionEpoch?: SessionEpoch; epoch?: number } = {}): StageSession {
	let sessionEpoch = options.sessionEpoch ?? freshSessionEpoch();
	let epoch = options.epoch ?? 0;
	let current: StageReadSnapshot | null = null;
	let selectionValue: StageSelectionState = EMPTY_SELECTION;
	let hoverValue: StageSelectionEntry | null = null;
	let lens: StageLens = 'world';
	// Grid/Snap are creator view state, not project state: they survive a content
	// change and a replacement exactly as the lens does.
	let draftingValue: StageDraftingState = STAGE_DRAFTING_DEFAULTS;
	// One Sheet per session, created here rather than per facade mount: a lens
	// exit rebuilds adapters but must not lose the creator's height. A
	// replacement resets the Sheet, and its subscribers stay registered.
	const heightSheetValue = createStageHeightSheet();
	let taskStatus: 'active' | 'inactive' = 'active';
	let writerGeneration = 0;
	let taskChoiceGeneration = 0;
	let task: StageTask | null = null;
	let activeGesture: { lease: InternalGesture } | null = null;
	/**
	 * Live proposals, in registration order. A `Set` of mutable lease records: the
	 * session holds them so an install, replacement or teardown ends every one of
	 * them, which is what makes "no hidden proposal" true even if a writer forgets.
	 */
	const liveProposals = new Set<InternalProposal>();
	let disposed = false;
	const registry = createCancellationRegistry();
	const disposables = new Set<() => void>();

	/** The mutable proposal record; `ProposalLease` is its readonly view. */
	type InternalProposal = {
		owner: string;
		reason: string;
		active: boolean;
		release(): void;
	};

	/** The mutable lease record the session holds; `GestureLease` is its readonly view. */
	type InternalGesture = {
		owner: string;
		evaluationId: string;
		acceptedRevision: AcceptedRevision;
		policy: GestureTransitionPolicy;
		navigation: boolean;
		token: ReplacementEpochToken;
		active: boolean;
		released: boolean;
		release(): void;
	};

	function token(): ReplacementEpochToken {
		return { sessionEpoch, epoch };
	}

	function layoutPrimary(): StageSelection | null {
		const entry = primaryEntry(selectionValue);
		const ref = entry?.representation;
		return ref ? { sourceId: ref.sourceId, sourceKind: ref.sourceKind, generationId: ref.generationId, ref } : null;
	}
/** What a convenience `select()` request did to the one selection value. */
type LegacySelectionOutcome = 'admitted' | 'cleared' | 'refused';

	function setLegacy(next: StageSelection | null): LegacySelectionOutcome {
		if (next === null) { selectionValue = EMPTY_SELECTION; return 'cleared'; }
		if (current === null) { selectionValue = EMPTY_SELECTION; return 'refused'; }
		// Retained Layout helper shares the exact same owner and ordered value.
		const reference = layoutSelectionReference(next.ref ?? { sourceId: next.sourceId, sourceKind: next.sourceKind, generationId: next.generationId, stream: 'projected', subRef: null }, current);
		const admitted = admitSelection({ ordered: [{ reference, representation: next.ref ?? { sourceId: next.sourceId, sourceKind: next.sourceKind, generationId: next.generationId, stream: 'projected', subRef: null } }], primary: reference }, current);
		// A refused convenience request clears rather than retaining a value that
		// names the previous revision: the caller re-reads the projection, and a
		// stale ref would otherwise be shown as the subject just clicked.
		if ('kind' in admitted) { selectionValue = EMPTY_SELECTION; return 'refused'; }
		selectionValue = admitted;
		return 'admitted';
	}
	/**
	 * Cancel the writers that belong to a task or gesture, never the command that is
	 * changing the content. Opening or closing a task must not abort a concurrent
	 * host accept.
	 */
	function cancelTaskWriters(): void {
		writerGeneration += 1;
		registry.cancelKinds(['gesture', 'task', 'camera']);
		activeGesture?.lease.release();
		activeGesture = null;
	}
	/** A lens transition ends every writer, including an in-flight acceptance. */
	function cancelAllWriters(): void {
		cancelTaskWriters();
		registry.cancelKinds(['command']);
	}

	const session: StageSession = {
		get sessionEpoch() {
			return sessionEpoch;
		},
		token,
		isCurrent(candidate) {
			// A disposed session has no current epoch: a load, gesture or Camera
			// completion that lands after teardown is stale by definition, and must not
			// mount a facade no one will ever dispose.
			if (disposed) return false;
			return candidate.sessionEpoch === sessionEpoch && candidate.epoch === epoch;
		},
		writers() {
			return registry;
		},
		current() {
			return current;
		},
		selection: layoutPrimary,
		selectionState: () => selectionValue,
		hover: () => hoverValue,
		setHover(entry) { if (!disposed) hoverValue = entry; },
		setSelection(value) {
			if (disposed || current === null) return { kind: 'refused', code: 'stale-session', message: 'Open a current source before selecting.' };
			const admitted = admitSelection(value, current);
			if ('kind' in admitted) return admitted;
			selectionValue = admitted;
			return { kind: 'selected' };
		},
		select: setLegacy,
		lens: () => lens,
		drafting: () => draftingValue,
		setDrafting(patch) {
			if (disposed) return draftingValue;
			draftingValue = applyDraftingPatch(draftingValue, patch);
			return draftingValue;
		},
		heightSheet: () => heightSheetValue,
		writerGeneration: () => writerGeneration,
		taskChoiceGeneration: () => taskChoiceGeneration,
		changeLens(next) {
			if (disposed || next === lens) return false;
			hoverValue = null;
			taskChoiceGeneration += 1;
			// Park before cancelling, and hold the parked task across cancellation: a
			// canceller then observes an inactive task, and one that closes it anyway
			// cannot take the only Resume path with it. Only a *cleared* task is held:
			// a canceller that opened a different task, or replaced the session, made a
			// deliberate change this transition must not overwrite.
			const parked = task;
			const parkedToken = token();
			if (task !== null) taskStatus = 'inactive';
			cancelAllWriters();
			if (parked !== null && task === null && !disposed && token().sessionEpoch === parkedToken.sessionEpoch && token().epoch === parkedToken.epoch) {
				task = parked;
				taskStatus = 'inactive';
			}
			// Reentrancy: a cancellation callback may have opened a task while this
			// transition was still departing the old lens. That replacement is kept,
			// but a task belongs to the lens it was opened for — one opened for the
			// departing lens is parked and its writers are cancelled here, so it can
			// never be active (or keep writing) in the destination lens. `openTask`
			// still sees the departing lens, so a canceller that has not itself
			// completed the transition always lands here. The equality case is left
			// alone for a canceller that changed lens itself first, so a future
			// ordering change cannot silently leave an unowned task active.
			if (task !== null && taskStatus === 'active' && (task.lens ?? 'world') !== next) {
				taskStatus = 'inactive';
				cancelTaskWriters();
			}
			lens = next;
			return true;
		},
		taskLifecycle: () => task === null ? null : { status: taskStatus, task },
		resumeTask(validate) {
			if (disposed || current === null) return { kind: 'refused', code: 'stale-session', message: 'Open a current source before resuming a task.' };
			if (task === null || taskStatus !== 'inactive') return { kind: 'refused', code: 'no-inactive-task', message: 'Choose an inactive task to resume.' };
			if ((task.lens ?? 'world') !== lens) return { kind: 'refused', code: 'wrong-lens', message: `Return to the ${task.lens ?? 'world'} lens before resuming.` };
			// Explicit identity requalification within this source; replacement clears tasks.
			let target = task.target;
			if (target) {
				// A subject reference names its owning unit's content revision. The
				// envelope digest would name content no domain resolver holds.
				target = {
					...target,
					revision: {
						kind: 'exact',
						contentRevision:
							current.domain.unitRevisions[target.domain as keyof typeof current.domain.unitRevisions] ??
							current.sourceContentId
					}
				};
				const resolved = resolveReference(target, current.domain.references);
				if (resolved.kind !== 'resolved') return { kind: 'refused', code: resolved.code, message: `${resolved.message} Choose another target or close this task.` };
			}
			const candidate = immutableF4Data({ ...task, ...(target ? { target } : {}), targetRef: task.targetRef ? { ...task.targetRef, generationId: current.compileGeneration } : null });
			let checked: TaskResumeOutcome;
			try { checked = validate(candidate, current); } catch { checked = { kind: 'refused', code: 'invalid-configuration', message: 'Reconfigure this task before resuming.' }; }
			if (checked.kind !== 'resumed') return checked;
			taskChoiceGeneration += 1;
			task = candidate;
			taskStatus = 'active';
			writerGeneration += 1;
			return { kind: 'resumed' };
		},
		task() {
			return taskStatus === 'active' ? task : null;
		},
		openTask(next) {
			if (disposed || (next.lens ?? 'world') !== lens) return false;
			taskChoiceGeneration += 1;
			if (task !== null) cancelTaskWriters();
			else writerGeneration += 1;
			task = immutableF4Data({ ...next, target: next.target ?? (next.targetRef && current ? layoutSelectionReference(next.targetRef, current) : null) });
			taskStatus = 'active';
			return true;
		},
		closeTask() {
			if (task === null) return false;
			taskChoiceGeneration += 1;
			cancelTaskWriters();
			task = null;
			return true;
		},
		gesture() {
			return activeGesture?.lease ?? null;
		},
		registerProposal(request) {
			const internal: InternalProposal = {
				owner: request.owner,
				reason: request.reason,
				active: true,
				release() {
					if (!internal.active) return;
					internal.active = false;
					liveProposals.delete(internal);
				}
			};
			liveProposals.add(internal);
			return internal;
		},
		liveProposal() {
			for (const proposal of liveProposals) {
				if (proposal.active) return { owner: proposal.owner, reason: proposal.reason };
			}
			const gesture = activeGesture?.lease;
			if (gesture !== undefined && gesture.active && !gesture.navigation) {
				return { owner: gesture.owner, reason: PROPOSAL_REASON };
			}
			return null;
		},
		acquireGesture(request) {
			if (disposed) return { kind: 'refused', code: 'stale-epoch', owner: request.owner };
			if (activeGesture !== null && activeGesture.lease.active) {
				return { kind: 'refused', code: 'gesture-held', owner: activeGesture.lease.owner };
			}
			const internal: InternalGesture = {
				owner: request.owner,
				evaluationId: request.evaluationId,
				acceptedRevision: request.acceptedRevision,
				policy: request.policy,
				navigation: request.navigation === true,
				token: token(),
				active: true,
				released: false,
				release() {
					if (internal.released) return;
					internal.released = true;
					internal.active = false;
					if (activeGesture?.lease === internal) activeGesture = null;
				}
			};
			activeGesture = { lease: internal };
			return { kind: 'granted', lease: internal };
		},
		applyReadingChange() {
			const lease = activeGesture?.lease;
			if (lease === undefined || !lease.active) {
				return { cancelled: false, suspended: false, owner: null };
			}
			if (lease.policy === 'cancel-on-reading-change') {
				lease.release();
				return { cancelled: true, suspended: false, owner: lease.owner };
			}
			// `continue-after-revalidation` and `suspend-proposal` both keep the lease:
			// the reading is a projection of the same accepted revision, so the captured
			// operation is unchanged. Only a proposal would be withheld, and S02 has no
			// proposal writer — reported rather than silently assumed.
			return { cancelled: false, suspended: lease.policy === 'suspend-proposal', owner: lease.owner };
		},
		installAccepted(next, options) {
				if (disposed) {
					return { kind: 'refused', code: 'disposed', message: 'the session is disposed and accepts no source' };
				}
				const active = current;
				if (active === null) {
					return {
						kind: 'refused',
						code: 'no-current-source',
						message: 'no accepted source is installed, so there is no content to change'
					};
				}
				if (active.acceptedRevision.projectId !== next.acceptedRevision.projectId) {
					return {
						kind: 'refused',
						code: 'different-project',
						message: 'a different project identity is a replacement, not a content change'
					};
				}
				if (next.sessionEpoch !== sessionEpoch) {
					// A content change is the same host lifetime. A snapshot admitted under
					// another epoch is a different session's source, and installing it here
					// would leave the output, the snapshot and the session disagreeing about
					// which lifetime they belong to.
					return {
						kind: 'refused',
						code: 'stale-session',
						message: 'the source was admitted under another host session epoch'
					};
				}
				if (active.sourceContentId === next.sourceContentId) {
					return { kind: 'unchanged', sourceContentId: next.sourceContentId };
				}
				// Same project, new content: the slot swaps in place. The epoch does not
				// advance, so a load, gesture or Camera completion started under it stays
				// current — the source revision, not the epoch, is what changed.
				const previousSelection = layoutPrimary();
				const previousOrdered = selectionValue;
				const closedTask = task !== null && taskStatus === 'active';
				// S02 has no operation-parameter revalidation, so a gesture lease whose
				// revision just expired cannot legitimately continue: it is released and
				// reported instead of silently carrying a stale proposal forward.
				const lease = activeGesture?.lease;
				const releasedGestures = lease !== undefined && lease.active ? 1 : 0;
				if (lease !== undefined) lease.release();
				activeGesture = null;
				// Accepted content settles every proposal that was made against the
				// previous source: the values they named are now either this document or
				// nothing, and a lease that outlived its baseline could block history
				// forever.
				for (const proposal of [...liveProposals]) proposal.release();
				// Selection is not cleared wholesale: the host asks the accepted
				// correspondence whether the subject survived. A requalification that
				// throws is a refusal to carry the selection, never a half-kept one.
				let requalification: SelectionRequalificationOutcome = { kind: 'none' };
				if (previousSelection !== null) {
					let requalified: ReturnType<SelectionRequalification> = null;
					try {
						requalified = options?.requalify?.(previousSelection) ?? null;
					} catch {
						requalified = null;
					}
					requalification = requalified === null
						? { kind: 'cleared', reason: 'no-correspondence' }
						: 'kind' in requalified ? requalified : { kind: 'requalified', selection: requalified };
				}
				const selectionRemovals: { reference: SemanticReference; reason: 'subject-retired' | 'no-correspondence' }[] = [];
				current = next;
				if (options?.requalifyEntry) {
					const ordered: StageSelectionEntry[] = [];
					let primary: SemanticReference | null = null;
					for (const entry of previousOrdered.ordered) {
						let result: EntryRequalification;
						try { result = options.requalifyEntry(entry); } catch { result = { kind: 'cleared', reason: 'no-correspondence' }; }
						if (result.kind === 'cleared') selectionRemovals.push({ reference: entry.reference, reason: result.reason });
						else {
							ordered.push(result.entry);
							if (previousOrdered.primary && sameReference(entry.reference, previousOrdered.primary)) primary = result.entry.reference;
						}
					}
					selectionValue = immutableF4Data({ ordered, primary: primary ?? ordered[0]?.reference ?? null });
				} else {
					const admittedLegacy = setLegacy(requalification.kind === 'requalified' ? requalification.selection : null) === 'admitted';
					// A convenience selection the new content refuses is gone even though the
					// requalification said it survived; the three reported fields must agree
					// instead of claiming a requalified selection that is no longer held.
					if (!admittedLegacy) requalification = previousOrdered.ordered.length === 0 ? requalification : { kind: 'cleared', reason: 'no-correspondence' };
					for (const entry of previousOrdered.ordered) if (requalification.kind !== 'requalified' || !admittedLegacy) selectionRemovals.push({ reference: entry.reference, reason: requalification.kind === 'cleared' ? requalification.reason : 'no-correspondence' });
				}
				// Accepted content closes an active task. Its writer callbacks are cancelled
				// for real (not merely generation-invalidated), but the acceptance's own
				// command writer must survive this install.
				if (taskStatus === 'active') { task = null; cancelTaskWriters(); }
				return {
					kind: 'installed',
					previousSourceContentId: active.sourceContentId,
					sourceContentId: next.sourceContentId,
					// A clear, not an emptiness: an install with nothing selected clears nothing.
					clearedSelection: previousOrdered.ordered.length > 0 && selectionValue.ordered.length === 0,
					closedTask,
					releasedGestures,
					requalification,
					selectionRemovals
				};
			},
			replace(admitted) {
			const previousToken = token();
			// The admitted snapshot is the validation: an unadmitted source never
			// reaches here, so cancellation and clearing cannot precede a failure.
			epoch += 1;
			// The host session epoch is the admitted snapshot's own: the host mints one
			// per replacement lifetime (a guard, not a counter), so the snapshot, the
			// session and every ticket spell one identity. A content change keeps it.
			sessionEpoch = admitted.sessionEpoch;
			const cancelledWriters = registry.cancelAll('replacement');
			const clearedSelection = selectionValue.ordered.length > 0;
			const closedTask = task !== null;
			const lease = activeGesture?.lease;
			const releasedGestures = lease !== undefined && lease.active ? 1 : 0;
			if (lease !== undefined) lease.release();
			activeGesture = null;
			for (const proposal of [...liveProposals]) proposal.release();
			selectionValue = EMPTY_SELECTION;
			hoverValue = null;
			task = null;
			heightSheetValue.reset();
			current = admitted;
			return {
				token: token(),
				previousToken,
				cancelledWriters,
				clearedSelection,
				closedTask,
				releasedGestures
			};
		},
		adoptMetadata(next) {
			if (disposed) return { kind: 'refused', code: 'disposed', message: 'The session is disposed.' };
			const active = current;
			if (active === null) return { kind: 'refused', code: 'no-current-source', message: 'No accepted source is installed.' };
			if (active.acceptedRevision.projectId !== next.acceptedRevision.projectId) {
				return { kind: 'refused', code: 'different-project', message: 'Metadata adoption cannot change project identity.' };
			}
			if (next.sessionEpoch !== sessionEpoch) {
				return { kind: 'refused', code: 'stale-session', message: 'Metadata belongs to another session.' };
			}
			const sameUnits = (Object.keys(active.domain.unitRevisions) as (keyof typeof active.domain.unitRevisions)[])
				.every((domain) => active.domain.unitRevisions[domain] === next.domain.unitRevisions[domain]);
			if (!sameUnits || active.compileGeneration !== next.compileGeneration) {
				return { kind: 'refused', code: 'domain-changed', message: 'Project metadata adoption cannot change authored domain content.' };
			}
			if (active.sourceContentId === next.sourceContentId && active.canonicalJson === next.canonicalJson) {
				return { kind: 'unchanged', sourceContentId: active.sourceContentId };
			}
			// An in-progress gesture is revision-bound. End it without clearing the
			// canonical selection or task; the metadata change leaves their domain
			// identities and compiled representation intact.
			registry.cancelKinds(['gesture']);
			activeGesture?.lease.release();
			activeGesture = null;
			// Metadata adoption keeps the domain content identical, so a proposal is
			// still valid: its leases are left alone deliberately.
			const previousSourceContentId = active.sourceContentId;
			current = next;
			return { kind: 'adopted', previousSourceContentId, sourceContentId: next.sourceContentId };
		},
		addDisposable(dispose) {
			disposables.add(dispose);
			return () => disposables.delete(dispose);
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			hoverValue = null;
			registry.cancelAll('teardown');
			activeGesture?.lease.release();
			activeGesture = null;
			for (const proposal of [...liveProposals]) proposal.release();
			selectionValue = EMPTY_SELECTION;
			task = null;
			const pending = [...disposables];
			disposables.clear();
			for (const dispose of pending) {
				try {
					dispose();
				} catch {
					// One failing disposer must not strand the rest.
				}
			}
			current = null;
		}
	};
	return session;
}
