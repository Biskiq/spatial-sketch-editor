/**
 * Framework-free conditional Save state (T3.P01.S02).
 *
 * Explicit inputs, explicit commands, an observable snapshot: no Svelte, host,
 * Stage, route or renderer import, so the T1 Head integration can mount it
 * without this module owning shell composition. It reads the current admitted
 * source and session epoch through the landed `lib/authoring/f4` coordinator and
 * calls an injected transport — it never edits the source, never records
 * history, and never installs a remote document itself.
 *
 * Semantics that matter:
 * - **saved/dirty compares the full captured canonical source**, not the digest:
 *   the digest excludes `layout.identity.cursor`, so a cursor-only divergence
 *   must still read dirty.
 * - **the persistence capture is stamped at the same boundary as the server**:
 *   `captureUnitSave` writes the coordinator's accepted revision into the saved
 *   bytes. The admitted source keeps its embedded baseline revision untouched, so
 *   that unstamped canonical text is tracked separately for dirty/conflict and
 *   history comparisons.
 * - **acknowledgment marks only what it captured**: edits made during an
 *   in-flight Save stay dirty.
 * - **an old session epoch's response is dropped**: it neither marks saved nor
 *   installs anything, and its capture is discarded with it — the state now
 *   describes another project, so retrying it would write the previous one.
 * - **a conflict preserves local source/history**: the offer carries the
 *   *current* local source (edits made during the Save included), reload is an
 *   explicit offer, never an automatic merge or overwrite, and a load is
 *   installed only into the conflict that requested it.
 * - **a snapshot is self-consistent**: a steady-state `status` is derived from
 *   the same full-source comparison as `dirty`, so it can never read `saved`
 *   over unsaved edits. An acknowledgement that does not describe the captured
 *   source is refused instead of adopted.
 * - **the state belongs to the project it was constructed for**: the saved base
 *   is fixed at construction. A Head that replaces the session with a
 *   *different* project must create a new state; reusing this one would send the
 *   old project's token with the new project's capture (the server refuses and
 *   writes nothing, but the token would never be repaired here). A returned
 *   outcome likewise describes the request that produced it — `getSnapshot()` is
 *   the live view.
 */

import type { AcceptedRevision } from '@portfolio/project-model';
import {
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	captureUnitSave,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import type {
	SaveAcknowledgement,
	SavePrecondition,
	SaveRefusalCode,
	SaveRequest
} from '@portfolio/project-model/save';
import { SAVE_CONTENT_IDENTITY_SCHEME, sameAcceptedRevision } from '@portfolio/project-model/save';

/** The exact source a Save captures, read from the coordinator. */
export type SaveSourceState = {
	readonly revision: AcceptedRevision;
	readonly source: ProjectEnvelope;
	readonly canonicalJson: string;
	readonly sourceContentId: string;
};

/**
 * One capture retained for retry, together with the **unstamped** admitted
 * source text it describes. `request.capture.canonicalJson` names the accepted
 * revision it is saved under; `sourceCanonicalJson` is what the coordinator
 * installed (whose embedded revision is the baseline provenance). Keeping both
 * lets dirty/conflict report the local source while the server receives the
 * bytes it requires.
 */
type PendingCapture = {
	readonly request: SaveRequest;
	readonly sourceCanonicalJson: string;
};

/**
 * The narrow coordinator port this state needs: the current admitted source and
 * the session epoch. The landed `AcceptanceCoordinator` satisfies it; a test
 * double can too. Read-only — Save never accepts, undoes or replaces.
 */
export type SaveCoordinatorPort = {
	current(): SaveSourceState;
	sessionEpoch(): unknown;
};

/** The durable base a Save starts from; `null` metadata means a legacy row. */
export type SaveBaseline = {
	readonly savedBaseToken: string | null;
	readonly savedRevision: AcceptedRevision | null;
	readonly savedCanonicalJson: string | null;
	readonly savedSourceContentId: string | null;
};

/** A loaded project, as the conflict/reload path needs it (data only). */
export type SaveRemoteProject = {
	readonly projectId: string;
	readonly document: unknown;
	readonly savedBaseToken: string | null;
	readonly savedRevision: AcceptedRevision | null;
	readonly savedSourceContentId: string | null;
};

/**
 * The transport's normalized answer. The platform adapter maps HTTP/network
 * errors into these cases; the state machine never sees a `Response`.
 */
export type SaveTransportResult =
	| { readonly kind: 'saved'; readonly acknowledgement: SaveAcknowledgement }
	| { readonly kind: 'conflict' }
	| { readonly kind: 'auth-required' }
	| { readonly kind: 'error'; readonly message: string; readonly retryable: boolean }
	| {
			readonly kind: 'refused';
			readonly code: SaveRefusalCode | 'invalid';
			readonly message: string;
			readonly issues?: readonly { path: string; code: string; message: string }[];
	  };

export type SaveTransport = (request: SaveRequest, signal?: AbortSignal) => Promise<SaveTransportResult>;

export type SaveStatus =
	| 'never-saved'
	| 'saved'
	| 'dirty'
	| 'saving'
	| 'conflict'
	| 'refused'
	| 'error'
	| 'auth-required';

export type SaveConflict = {
	/**
	 * The local canonical source **as of this snapshot**: editing and Undo stay
	 * immediate while a conflict stands, so the download the Head offers must be
	 * the newest local work, not the bytes local when the server answered.
	 */
	readonly localJson: string;
	readonly localSourceContentId: string;
	/** Remote data, when the load port answered. */
	readonly remote: SaveRemoteProject | null;
};

export type SaveError = {
	readonly code: SaveRefusalCode | 'invalid' | 'auth-required' | 'network' | 'server';
	readonly message: string;
	readonly issues?: readonly { path: string; code: string; message: string }[];
	readonly retryable: boolean;
};

export type SaveSnapshot = {
	readonly status: SaveStatus;
	readonly dirty: boolean;
	readonly busy: boolean;
	/** A capture is retained for an unambiguous retry (network ambiguity). */
	readonly pending: boolean;
	readonly savedBaseToken: string | null;
	readonly savedRevision: AcceptedRevision | null;
	readonly savedCanonicalJson: string | null;
	readonly savedSourceContentId: string | null;
	readonly error: SaveError | null;
	readonly conflict: SaveConflict | null;
};

export type SaveOutcome =
	| { readonly kind: 'saved'; readonly acknowledgement: SaveAcknowledgement }
	| { readonly kind: 'dirty'; readonly acknowledgement: SaveAcknowledgement }
	| { readonly kind: 'conflict' }
	| { readonly kind: 'busy' }
	| { readonly kind: 'stale-epoch' }
	| { readonly kind: 'unavailable' }
	/** A prior Save is unresolved; `retry()` must settle it through its receipt. */
	| { readonly kind: 'unresolved' }
	| { readonly kind: 'refused'; readonly code: SaveError['code']; readonly message: string }
	| { readonly kind: 'error'; readonly message: string };

export type ReloadOffer =
	| {
			readonly kind: 'reload';
			readonly projectId: string;
			readonly document: unknown;
			readonly savedBaseToken: string | null;
			readonly savedRevision: AcceptedRevision | null;
			readonly savedSourceContentId: string | null;
	  }
	| { readonly kind: 'unavailable' };

export type SaveState = {
	getSnapshot(): SaveSnapshot;
	subscribe(listener: (snapshot: SaveSnapshot) => void): () => void;
	/**
	 * Recompute saved/dirty and notify listeners. Optional for correctness: a
	 * snapshot derives its steady status from the current source already, so an
	 * accepted edit is never reported as saved.
	 */
	refresh(): SaveSnapshot;
	/**
	 * The one command. Reuses a retained capture/precondition when it is still
	 * exact. An outcome is a historical fact about that request; read the snapshot
	 * for the current view (a newer run may already have replaced it).
	 */
	save(signal?: AbortSignal): Promise<SaveOutcome>;
	/** Retry the retained capture, resolving network ambiguity through its receipt. */
	retry(signal?: AbortSignal): Promise<SaveOutcome>;
	/** Explicit conflict resolution: hand data to the Head's replacement guard. */
	reloadRemote(): ReloadOffer;
	/** Leave a refusal/error state and return to saved/dirty. */
	clearError(): SaveSnapshot;
};

export type SaveStateOptions = {
	readonly coordinator: SaveCoordinatorPort;
	readonly save: SaveTransport;
	readonly baseline?: SaveBaseline;
	/** Optional read port for the remote side of a conflict (never auto-installs). */
	readonly loadRemote?: (projectId: string) => Promise<SaveRemoteProject>;
	readonly mintOperationId?: () => string;
	/**
	 * A Save captured before a sign-in redirect (TD-9). It is retained as the
	 * unresolved capture so `retry()` replays the **exact** operation identity and
	 * precondition. Constructing the state never runs it: the Head offers it and
	 * the creator resumes deliberately.
	 */
	readonly resume?: SaveRequest | null;
	/**
	 * Called when the server answers `auth-required`, before the platform redirect.
	 * The host persists the exact request (precondition and operation ID included)
	 * so the return visit can offer it. It is never called for any other outcome.
	 */
	readonly onAuthRequired?: (request: SaveRequest) => void | Promise<void>;
};

const EMPTY_BASELINE: SaveBaseline = {
	savedBaseToken: null,
	savedRevision: null,
	savedCanonicalJson: null,
	savedSourceContentId: null
};

export function createSaveState(options: SaveStateOptions): SaveState {
	const mintOperationId = options.mintOperationId ?? (() => globalThis.crypto.randomUUID());
	let baseline = options.baseline ?? EMPTY_BASELINE;
	let status: SaveStatus = baseline.savedBaseToken === null ? 'never-saved' : 'saved';
	let error: SaveError | null = null;
	let conflict: SaveConflict | null = null;
	let inFlight: { readonly epoch: string; readonly canonicalJson: string } | null = null;
	/** A capture is being stamped/normalized by the Save boundary. */
	let preparing = false;
	let pending: PendingCapture | null = null;
	if (options.resume) {
		// Only a capture for this project under this exact saved base is resumable.
		// Anything else would pair one project's operation with another's baseline.
		const current = options.coordinator.current();
		const precondition = options.resume.capture.precondition;
		const sameBase =
			precondition.kind === 'create-only'
				? baseline.savedBaseToken === null
				: precondition.kind === 'expected-saved-base' && precondition.token === baseline.savedBaseToken;
		if (options.resume.capture.projectId === current.revision.projectId && sameBase) {
			// A resumed source is admitted from the captured bytes themselves, so the
			// unstamped source text is those same bytes until the creator edits.
			pending = { request: options.resume, sourceCanonicalJson: options.resume.capture.canonicalJson };
		}
	}
	const listeners = new Set<(snapshot: SaveSnapshot) => void>();

	function readCurrent(): SaveSourceState | null {
		try {
			const admitted = options.coordinator.current();
			return {
				revision: admitted.revision,
				source: admitted.source,
				canonicalJson: admitted.canonicalJson,
				sourceContentId: admitted.sourceContentId
			};
		} catch {
			return null;
		}
	}

	function epoch(): string {
		return String(options.coordinator.sessionEpoch());
	}

	function currentCanonical(): string | null {
		return readCurrent()?.canonicalJson ?? null;
	}

	function isDirty(): boolean {
		const current = currentCanonical();
		if (current === null) return false;
		if (baseline.savedCanonicalJson === null) return true;
		return current !== baseline.savedCanonicalJson;
	}

	function steadyStatus(currentDirty: boolean): SaveStatus {
		if (baseline.savedBaseToken === null) return 'never-saved';
		return currentDirty ? 'dirty' : 'saved';
	}

	function derivedStatus(): SaveStatus {
		return steadyStatus(isDirty());
	}

	/**
	 * The status one snapshot reports. A transient state keeps its own name; a
	 * steady state is derived from the **same** full-source comparison the
	 * `dirty` flag uses, so a snapshot can never claim `saved` while `dirty` is
	 * true. An accepted edit is therefore visible without waiting for
	 * `refresh()` — the Head renders one consistent answer either way.
	 */
	function reportedStatus(currentDirty: boolean): SaveStatus {
		const transient =
			status === 'saving' ||
			status === 'conflict' ||
			status === 'refused' ||
			status === 'error' ||
			status === 'auth-required';
		return transient ? status : steadyStatus(currentDirty);
	}

	// A pre-migration row has a token but no captured contents to compare, so it
	// starts dirty rather than claiming saved. The token alone is its precondition.
	status = derivedStatus();

	/**
	 * The conflict view a snapshot reports. Its remote side and its lifetime are
	 * fixed when the conflict is detected; only the local side is derived, because
	 * the creator can keep editing (and undoing) while the conflict stands.
	 */
	function conflictView(): SaveConflict | null {
		if (!conflict) return null;
		const local = readCurrent();
		if (!local) return conflict;
		return {
			...conflict,
			localJson: local.canonicalJson,
			localSourceContentId: local.sourceContentId
		};
	}

	function snapshot(): SaveSnapshot {
		const currentDirty = isDirty();
		return {
			status: reportedStatus(currentDirty),
			dirty: currentDirty,
			busy: inFlight !== null || preparing,
			pending: pending !== null,
			savedBaseToken: baseline.savedBaseToken,
			savedRevision: baseline.savedRevision,
			savedCanonicalJson: baseline.savedCanonicalJson,
			savedSourceContentId: baseline.savedSourceContentId,
			error,
			conflict: conflictView()
		};
	}

	function emit(): SaveSnapshot {
		const next = snapshot();
		for (const listener of listeners) listener(next);
		return next;
	}

	function currentPrecondition(): SavePrecondition {
		return baseline.savedBaseToken === null
			? { kind: 'create-only' }
			: { kind: 'expected-saved-base', token: baseline.savedBaseToken };
	}

	/**
	 * The retained capture, but only when it describes exactly this source and
	 * this precondition. A changed payload under the retained operation ID would be
	 * refused by the server, so it never qualifies.
	 */
	function retainedCapture(current: SaveSourceState): PendingCapture | null {
		if (!pending) return null;
		const request = pending.request;
		const precondition = currentPrecondition();
		const sameCondition =
			precondition.kind === 'create-only'
				? request.capture.precondition.kind === 'create-only'
				: request.capture.precondition.kind === 'expected-saved-base' &&
					request.capture.precondition.token === precondition.token;
		const sameSource =
			pending.sourceCanonicalJson === current.canonicalJson &&
			sameAcceptedRevision(request.capture.acceptedRevision, current.revision) &&
			sameCondition;
		return sameSource ? pending : null;
	}

	type CapturePreparation =
		| { readonly kind: 'ready'; readonly pending: PendingCapture }
		| {
				readonly kind: 'refused';
				readonly code: 'invalid-project' | 'content-identity-mismatch' | 'invalid-save-request';
				readonly message: string;
				readonly issues?: readonly { path: string; code: string; message: string }[];
		  };

	async function prepareRequest(current: SaveSourceState): Promise<CapturePreparation> {
		const retained = retainedCapture(current);
		if (retained) return { kind: 'ready', pending: retained };
		// Capture through the persistence boundary the server reads, not by
		// hand-serializing the admitted source: the coordinator's revision is
		// stamped into the saved bytes while the source itself keeps its embedded
		// baseline revision. A hand-built capture would disagree with the server's
		// re-serialization and be refused on every live Save.
		const captured = await captureUnitSave({
			snapshot: {
				acceptedRevision: current.revision,
				sourceContentId: current.sourceContentId,
				sourceKind: UNIT_SOURCE_KIND,
				sourceVersion: UNIT_SOURCE_VERSION,
				domain: {
					identity: { acceptedRevision: current.revision, sourceContentId: current.sourceContentId },
					source: current.source
				}
			},
			operationId: mintOperationId(),
			precondition: currentPrecondition()
		});
		if (captured.kind === 'refused') return captured;
		return {
			kind: 'ready',
			pending: {
				request: { contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME, capture: captured.capture },
				sourceCanonicalJson: current.canonicalJson
			}
		};
	}

	async function run(prepared: PendingCapture, signal?: AbortSignal): Promise<SaveOutcome> {
		if (inFlight) return { kind: 'busy' };
		const request = prepared.request;
		pending = prepared;
		const requestEpoch = epoch();
		const capturedJson = request.capture.canonicalJson;
		inFlight = { epoch: requestEpoch, canonicalJson: capturedJson };
		status = 'saving';
		error = null;
		conflict = null;
		emit();

		let result: SaveTransportResult;
		try {
			result = await options.save(request, signal);
		} catch (failure) {
			result = {
				kind: 'error',
				message: failure instanceof Error ? failure.message : 'Save failed',
				retryable: true
			};
		}

		// A response from a replaced session epoch is dropped. It neither marks
		// anything saved nor installs anything, and it cannot clear the new
		// session's state.
		if (epoch() !== requestEpoch || inFlight?.epoch !== requestEpoch) {
			inFlight = null;
			// The replaced session owns neither this outcome nor its capture: the
			// state now describes another project, so retrying the old capture
			// would write the previous one under a token this session never held.
			pending = null;
			status = derivedStatus();
			emit();
			return { kind: 'stale-epoch' };
		}
		inFlight = null;

		switch (result.kind) {
			case 'saved': {
				const acknowledged = result.acknowledgement;
				// The acknowledgement answers exactly this capture. A response that
				// describes other contents or another project is a protocol
				// violation, not a saved state: adopting it would pair a foreign
				// token/digest with these bytes. Refuse it instead of marking saved,
				// and do not keep the capture — a replay returns the same answer.
				if (
					acknowledged.projectId !== request.capture.projectId ||
					!sameAcceptedRevision(acknowledged.savedRevision, request.capture.acceptedRevision) ||
					acknowledged.sourceContentId !== request.capture.sourceContentId
				) {
					pending = null;
					error = {
						code: 'server',
						message: 'The Save acknowledgement does not describe the captured source',
						retryable: false
					};
					status = 'error';
					emit();
					return { kind: 'error', message: error.message };
				}
				baseline = {
					savedBaseToken: acknowledged.savedBaseToken,
					savedRevision: acknowledged.savedRevision,
					// The saved base compares against the admitted source text, not the
					// stamped persistence bytes: the envelope's embedded revision is
					// baseline provenance and does not move when the coordinator mints.
					savedCanonicalJson: prepared.sourceCanonicalJson,
					savedSourceContentId: acknowledged.sourceContentId
				};
				pending = null;
				// Acknowledgment marks only the captured contents; edits made during
				// the Save stay dirty.
				const kind = currentCanonical() === prepared.sourceCanonicalJson ? 'saved' : 'dirty';
				status = kind;
				emit();
				return { kind, acknowledgement: acknowledged };
			}
			case 'conflict': {
				pending = null;
				// Offer the *current* local source, not the bytes this Save captured:
				// edits made while it was in flight are newer unsaved work, and a
				// conflict is exactly when the user must be able to keep them. The
				// digest travels with the bytes it describes.
				const local = readCurrent();
				const offer: SaveConflict = {
					localJson: local?.canonicalJson ?? capturedJson,
					localSourceContentId: local?.sourceContentId ?? request.capture.sourceContentId,
					remote: null
				};
				conflict = offer;
				status = 'conflict';
				emit();
				if (options.loadRemote) {
					try {
						const remote = await options.loadRemote(request.capture.projectId);
						// Only install remote *data* into the exact conflict this call
						// created. A second Save can run while this load is outstanding
						// (`busy` already cleared), and its conflict may capture the same
						// bytes for another project — comparing bytes alone would install
						// the wrong offer.
						if (conflict === offer) {
							conflict = { ...offer, remote };
							emit();
						}
					} catch {
						// The conflict stands with local data; remote is an offer, not a prerequisite.
					}
				}
				return { kind: 'conflict' };
			}
			case 'auth-required': {
				error = { code: 'auth-required', message: 'Sign-in is required', retryable: true };
				status = 'auth-required';
				emit();
				// TD-9: capture the exact request before the platform redirect. The
				// capture stays retained, so the return visit resumes this operation
				// rather than minting a new one from a base the server may have moved.
				if (options.onAuthRequired) {
					try {
						await options.onAuthRequired(request);
					} catch {
						// A failed handoff must not turn the Save into a different outcome; the
						// retained capture still lets the creator retry from the Head.
					}
				}
				return { kind: 'refused', code: 'auth-required', message: error.message };
			}
			case 'refused':
				error = {
					code: result.code,
					message: result.message,
					issues: result.issues,
					retryable: false
				};
				// A refused payload must not be retried under the same operation ID.
				pending = null;
				status = 'refused';
				emit();
				return { kind: 'refused', code: result.code, message: result.message };
			case 'error':
				error = {
					code: result.retryable ? 'network' : 'server',
					message: result.message,
					retryable: result.retryable
				};
				// Keep the capture: a network-ambiguous Save resolves through its
				// receipt before any retry from a new base.
				status = 'error';
				emit();
				return { kind: 'error', message: result.message };
		}
	}

	async function saveCommand(signal?: AbortSignal): Promise<SaveOutcome> {
		const current = readCurrent();
		if (!current) return { kind: 'unavailable' };
		// An in-flight Save is busy, not unresolved: its own response is still the
		// answer, and `retry()` must not race it either. Capture preparation is part
		// of the command, so it holds the same exclusivity.
		if (inFlight || preparing) return { kind: 'busy' };
		// A retained capture is an unresolved Save: it may still have committed,
		// and only its receipt can say. Minting a new operation from newer bytes
		// would drop that recovery and send a precondition the server may already
		// have moved, so the ambiguity is settled first (`retry()`). Once it is, the
		// newer contents save normally under a fresh operation ID.
		if (pending && retainedCapture(current) === null) return { kind: 'unresolved' };

		preparing = true;
		const requestEpoch = epoch();
		status = 'saving';
		error = null;
		conflict = null;
		emit();
		let preparation: CapturePreparation;
		try {
			preparation = await prepareRequest(current);
		} catch (failure) {
			preparing = false;
			error = {
				code: 'invalid',
				message: failure instanceof Error ? failure.message : 'The accepted source could not be captured',
				retryable: false
			};
			status = 'error';
			emit();
			return { kind: 'error', message: error.message };
		}
		preparing = false;

		// The capture was stamped from a session that may no longer be installed.
		// Do not retain it under the new session's state.
		if (epoch() !== requestEpoch) {
			status = derivedStatus();
			emit();
			return { kind: 'stale-epoch' };
		}
		if (preparation.kind === 'refused') {
			error = {
				code: preparation.code,
				message: preparation.message,
				issues: preparation.issues,
				retryable: false
			};
			pending = null;
			status = 'refused';
			emit();
			return { kind: 'refused', code: preparation.code, message: preparation.message };
		}
		return run(preparation.pending, signal);
	}

	return {
		getSnapshot: snapshot,
		subscribe(listener) {
			listeners.add(listener);
			listener(snapshot());
			return () => listeners.delete(listener);
		},
		refresh() {
			if (status === 'saving' || status === 'conflict') return emit();
			if (status === 'refused' || status === 'error' || status === 'auth-required') return snapshot();
			status = derivedStatus();
			return emit();
		},
		save: saveCommand,
		retry(signal) {
			if (inFlight || preparing) return Promise.resolve({ kind: 'busy' });
			if (pending) return run(pending, signal);
			return saveCommand(signal);
		},
		reloadRemote() {
			if (!conflict?.remote) return { kind: 'unavailable' };
			return {
				kind: 'reload',
				projectId: conflict.remote.projectId,
				document: conflict.remote.document,
				savedBaseToken: conflict.remote.savedBaseToken,
				savedRevision: conflict.remote.savedRevision,
				savedSourceContentId: conflict.remote.savedSourceContentId
			};
		},
		clearError() {
			error = null;
			if (status === 'refused' || status === 'error' || status === 'auth-required') {
				status = derivedStatus();
			}
			return emit();
		}
	};
}
