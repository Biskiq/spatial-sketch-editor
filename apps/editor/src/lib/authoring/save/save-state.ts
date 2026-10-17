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
 * - **acknowledgment marks only what it captured**: edits made during an
 *   in-flight Save stay dirty.
 * - **an old session epoch's response is dropped**: it neither marks saved nor
 *   installs anything.
 * - **a conflict preserves local source/history**: reload is an explicit offer,
 *   never an automatic merge or overwrite.
 */

import type { AcceptedRevision, ProjectDocument } from '@portfolio/project-model';
import { CURRENT_SOURCE_KIND, CURRENT_SOURCE_VERSION } from '@portfolio/project-model';
import type { SaveAcknowledgement, SaveRefusalCode, SaveRequest } from '@portfolio/project-model/save';
import { SAVE_CONTENT_IDENTITY_SCHEME, sameAcceptedRevision } from '@portfolio/project-model/save';

/** The exact source a Save captures, read from the coordinator. */
export type SaveSourceState = {
	readonly revision: AcceptedRevision;
	readonly source: ProjectDocument;
	readonly canonicalJson: string;
	readonly sourceContentId: string;
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
	/** The local canonical source; the Head offers a JSON download before reload. */
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
	/** Recompute saved/dirty from the current source (call after accepted edits). */
	refresh(): SaveSnapshot;
	/** The one command. Reuses a retained capture/precondition when it is still exact. */
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
	let pending: SaveRequest | null = null;
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

	function derivedStatus(): SaveStatus {
		if (baseline.savedBaseToken === null) return 'never-saved';
		return isDirty() ? 'dirty' : 'saved';
	}

	function snapshot(): SaveSnapshot {
		const currentDirty = isDirty();
		return {
			status,
			dirty: currentDirty,
			busy: inFlight !== null,
			pending: pending !== null,
			savedBaseToken: baseline.savedBaseToken,
			savedRevision: baseline.savedRevision,
			savedCanonicalJson: baseline.savedCanonicalJson,
			savedSourceContentId: baseline.savedSourceContentId,
			error,
			conflict
		};
	}

	function emit(): SaveSnapshot {
		const next = snapshot();
		for (const listener of listeners) listener(next);
		return next;
	}

	function prepareRequest(current: SaveSourceState): SaveRequest {
		// Reuse a retained capture only when it describes exactly this source and
		// the same precondition. Otherwise a fresh operation ID is minted; a
		// changed payload under the old ID would be refused by the server.
		const precondition = baseline.savedBaseToken === null
			? ({ kind: 'create-only' } as const)
			: ({ kind: 'expected-saved-base', token: baseline.savedBaseToken } as const);
		if (pending) {
			const sameCondition =
				precondition.kind === 'create-only'
					? pending.capture.precondition.kind === 'create-only'
					: pending.capture.precondition.kind === 'expected-saved-base' &&
						pending.capture.precondition.token === precondition.token;
			const sameSource =
				pending.capture.canonicalJson === current.canonicalJson &&
				sameAcceptedRevision(pending.capture.acceptedRevision, current.revision) &&
				sameCondition;
			if (sameSource) return pending;
		}
		return {
			contentIdentityScheme: SAVE_CONTENT_IDENTITY_SCHEME,
			capture: {
				protocol: 'SaveAcceptedSource@1',
				projectId: current.revision.projectId,
				operationId: mintOperationId(),
				precondition,
				sourceKind: CURRENT_SOURCE_KIND,
				sourceVersion: CURRENT_SOURCE_VERSION,
				acceptedRevision: current.revision,
				sourceContentId: current.sourceContentId,
				canonicalJson: current.canonicalJson
			}
		};
	}

	async function run(request: SaveRequest, signal?: AbortSignal): Promise<SaveOutcome> {
		if (inFlight) return { kind: 'busy' };
		pending = request;
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
			status = derivedStatus();
			emit();
			return { kind: 'stale-epoch' };
		}
		inFlight = null;

		switch (result.kind) {
			case 'saved': {
				baseline = {
					savedBaseToken: result.acknowledgement.savedBaseToken,
					savedRevision: result.acknowledgement.savedRevision,
					savedCanonicalJson: capturedJson,
					savedSourceContentId: result.acknowledgement.sourceContentId
				};
				pending = null;
				// Acknowledgment marks only the captured contents; edits made during
				// the Save stay dirty.
				const kind = currentCanonical() === capturedJson ? 'saved' : 'dirty';
				status = kind;
				emit();
				return { kind, acknowledgement: result.acknowledgement };
			}
			case 'conflict': {
				pending = null;
				const local = readCurrent();
				conflict = {
					localJson: capturedJson,
					localSourceContentId: local?.sourceContentId ?? request.capture.sourceContentId,
					remote: null
				};
				status = 'conflict';
				emit();
				if (options.loadRemote) {
					try {
						const remote = await options.loadRemote(request.capture.projectId);
						// Only install remote *data* into the conflict view, and only if
						// the session/epoch still describes this conflict.
						if (status === 'conflict' && conflict?.localJson === capturedJson) {
							conflict = { ...conflict, remote };
							emit();
						}
					} catch {
						// The conflict stands with local data; remote is an offer, not a prerequisite.
					}
				}
				return { kind: 'conflict' };
			}
			case 'auth-required':
				error = { code: 'auth-required', message: 'Sign-in is required', retryable: true };
				status = 'auth-required';
				emit();
				return { kind: 'refused', code: 'auth-required', message: error.message };
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

	function saveCommand(signal?: AbortSignal): Promise<SaveOutcome> {
		const current = readCurrent();
		if (!current) return Promise.resolve({ kind: 'unavailable' });
		return run(prepareRequest(current), signal);
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
			if (inFlight) return Promise.resolve({ kind: 'busy' });
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
