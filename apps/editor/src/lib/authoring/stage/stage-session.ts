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
 *    task or command is cancelled exactly once and its token becomes stale.
 * 3. **Clear the old context.** Selection, task and gesture leases are cleared;
 *    no project-specific singleton survives.
 * 4. **Swap.** The epoch advances and the new snapshot becomes current.
 *
 * Stale completions cannot affect the replacement because every writer is
 * registered **with the epoch it was started under** and `isCurrent` compares
 * against the live epoch: a prior-epoch load, ray, gesture or Camera completion
 * that resolves after the swap is refused rather than installed.
 */
import type { AcceptedRevision } from '@portfolio/project-model';

import type { PlanSourceKind, PlanSourceRef } from '@portfolio/layout-core';
import type { StageReadSnapshot } from './source-admission';

export type SessionEpoch = string;

/** The families of writer the session can cancel, for diagnostics and policy. */
export type WriterKind = 'load' | 'gesture' | 'camera' | 'task' | 'command';

/** A registration is bounded by the epoch it was started under. */
export type WriterRegistration = {
	readonly kind: WriterKind;
	readonly token: ReplacementEpochToken;
};

export type CancellationRegistry = {
	register(kind: WriterKind, token: ReplacementEpochToken, cancel: () => void): () => void;
	/** Cancel every live registration exactly once; returns how many were cancelled. */
	cancelAll(reason?: string): number;
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

export type StageTask = {
	/** Registered task kind, e.g. a Wall-side procedure. */
	readonly kind: string;
	/** What the task works on; may differ from selection and stays explicit. */
	readonly targetRef: PlanSourceRef | null;
	readonly label: string;
};

export type GestureTransitionPolicy =
	| 'continue-after-revalidation'
	| 'suspend-proposal'
	| 'cancel-on-reading-change';

export type GestureLease = {
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

/** What the host's reading-change policy run did, so the caller can drop its samples. */
export type GestureReadingChange = {
	readonly cancelled: boolean;
	readonly suspended: boolean;
	readonly owner: string | null;
};

/**
 * The outcome of installing changed content into the one accepted-source slot.
 *
 * A **content change** is deliberately not a replacement: the project identity is
 * the same, so the host session epoch does not advance and no writer is cancelled
 * for content that still belongs to the same project — but the selection and task
 * that named a fragment of the previous compile generation cannot survive it.
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

export type StageSession = {
	readonly sessionEpoch: SessionEpoch;
	token(): ReplacementEpochToken;
	isCurrent(token: ReplacementEpochToken): boolean;
	writers(): CancellationRegistry;
	current(): StageReadSnapshot | null;
	selection(): StageSelection | null;
	select(selection: StageSelection | null): void;
	task(): StageTask | null;
	openTask(task: StageTask): boolean;
	closeTask(): boolean;
	gesture(): GestureLease | null;
	/** One lease at a time; a second request is refused and navigation cannot steal it. */
	acquireGesture(request: {
		owner: string;
		evaluationId: string;
		acceptedRevision: AcceptedRevision;
		policy: GestureTransitionPolicy;
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
	 * selection/task cleared. A different project identity is refused — that is a
	 * replacement.
	 */
	installAccepted(next: StageReadSnapshot): AcceptedSlotInstall;
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
export function createStageSession(options: { sessionEpoch?: SessionEpoch; epoch?: number } = {}): StageSession {
	let sessionEpoch = options.sessionEpoch ?? freshSessionEpoch();
	let epoch = options.epoch ?? 0;
	let current: StageReadSnapshot | null = null;
	let selection: StageSelection | null = null;
	let task: StageTask | null = null;
	let activeGesture: { lease: InternalGesture } | null = null;
	let disposed = false;
	const registry = createCancellationRegistry();
	const disposables = new Set<() => void>();

	/** The mutable lease record the session holds; `GestureLease` is its readonly view. */
	type InternalGesture = {
		owner: string;
		evaluationId: string;
		acceptedRevision: AcceptedRevision;
		policy: GestureTransitionPolicy;
		token: ReplacementEpochToken;
		active: boolean;
		released: boolean;
		release(): void;
	};

	function token(): ReplacementEpochToken {
		return { sessionEpoch, epoch };
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
		selection() {
			return selection;
		},
		select(next) {
			selection = next;
		},
		task() {
			return task;
		},
		openTask(next) {
			if (disposed) return false;
			task = next;
			return true;
		},
		closeTask() {
			if (task === null) return false;
			task = null;
			return true;
		},
		gesture() {
			return activeGesture?.lease ?? null;
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
		installAccepted(next) {
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
				const clearedSelection = selection !== null;
				const closedTask = task !== null;
				// S02 has no operation-parameter revalidation, so a gesture lease whose
				// revision just expired cannot legitimately continue: it is released and
				// reported instead of silently carrying a stale proposal forward.
				const lease = activeGesture?.lease;
				const releasedGestures = lease !== undefined && lease.active ? 1 : 0;
				if (lease !== undefined) lease.release();
				activeGesture = null;
				selection = null;
				task = null;
				current = next;
				return {
					kind: 'installed',
					previousSourceContentId: active.sourceContentId,
					sourceContentId: next.sourceContentId,
					clearedSelection,
					closedTask,
					releasedGestures
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
			const clearedSelection = selection !== null;
			const closedTask = task !== null;
			const lease = activeGesture?.lease;
			const releasedGestures = lease !== undefined && lease.active ? 1 : 0;
			if (lease !== undefined) lease.release();
			activeGesture = null;
			selection = null;
			task = null;
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
		addDisposable(dispose) {
			disposables.add(dispose);
			return () => disposables.delete(dispose);
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			registry.cancelAll('teardown');
			activeGesture?.lease.release();
			activeGesture = null;
			selection = null;
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
