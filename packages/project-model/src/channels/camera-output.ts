/**
 * F.3 — the shared Camera-output ticket protocol (AM-3).
 *
 * `{outputId, sourceRevision, sessionEpoch, ownerId, runEpoch}` governs
 * inspection, guided/free navigation, Follow, Look-through and Preview through
 * acquire / request / replace / return / cancel. Exactly one Camera output owner
 * exists per viewport/session, and ownership order is monotonic: every accepted
 * transition — including a return to a replaced run — moves to a strictly newer
 * run epoch, so a spent ticket can never re-enter.
 *
 * Scope boundary: this module is the **validated ticket protocol only**. It
 * resolves ownership from immutable state and returns a decision — there is no
 * Camera runtime, evaluator, output controller, renderer realisation, projection
 * or navigation here, and no clock, subscription, callback or pending work. The
 * Stage owner (T1.P01.S02) realises the output; the Camera authority evaluates
 * pose and projection. Every function is pure: it takes a state and returns the
 * next state, so a caller can replay or discard a decision without side effects.
 */

import { ShapeReader, type ShapeIssue } from '../strict-shape';

/** Declared controller roles. A role outside this set is an unsupported capability. */
export const CAMERA_OUTPUT_ROLES = [
	'inspection',
	'guided-navigation',
	'free-navigation',
	'follow',
	'look-through',
	'preview'
] as const;

export type CameraOutputRole = (typeof CAMERA_OUTPUT_ROLES)[number];

/** The ownership ticket: one per acquired output run. */
export type CameraOutputTicket = {
	outputId: string;
	sourceRevision: string;
	sessionEpoch: string;
	ownerId: string;
	runEpoch: number;
};

/** A Camera-owned return context issued when an ordered transfer replaces a run. */
export type CameraReturnContext = {
	/** Opaque token the returning run must present. */
	token: string;
	/** The run that may return the output after the replacement completes. */
	issuedTo: CameraOutputTicket;
	role: CameraOutputRole;
	sourceRevision: string;
	sessionEpoch: string;
};

export type CameraOutputClaim = {
	ticket: CameraOutputTicket;
	role: CameraOutputRole;
	/** Set only by an ordered transfer that declared a return; otherwise `null`. */
	returnContext: CameraReturnContext | null;
};

/**
 * One viewport/session's ownership state.
 *
 * `claim: null` means the output is free. `epochFloor` is the highest run epoch
 * ever accepted for this output — including a run that has since been replaced,
 * cancelled or returned. Every ownership transition must be strictly newer than
 * it, so a ticket from an ended ownership period can never re-enter: a completed
 * run cannot reclaim or clear a later one, and a handoff cannot be undone by
 * replaying the ticket that handed it back. `-1` means no run has ever been
 * accepted here, so the first accepted run may use epoch 0.
 */
export type CameraOutputState = {
	viewportId: string;
	claim: CameraOutputClaim | null;
	epochFloor: number;
};

/** How a request relates to a competing claim. */
export const CAMERA_OUTPUT_POLICIES = ['exclusive', 'ordered-replacement', 'ordered-handoff'] as const;

export type CameraOutputPolicy = (typeof CAMERA_OUTPUT_POLICIES)[number];

/** What the caller observed before requesting; a different live claim is stale. */
export type CameraOutputExpectation = { kind: 'unowned' } | { kind: 'held'; ticket: CameraOutputTicket };

export type CameraOutputRequest = {
	/** The prospective ticket. Ownership only ever moves to a strictly newer run. */
	ticket: CameraOutputTicket;
	role: CameraOutputRole;
	expected: CameraOutputExpectation;
	policy: CameraOutputPolicy;
	/** The return token to issue for `ordered-handoff`; required by that policy. */
	returnToken?: string;
};

export const CAMERA_OUTPUT_REFUSALS = [
	'invalid-ticket',
	'invalid-request',
	'unsupported-role',
	'output-mismatch',
	'competing-exclusive-owner',
	'stale-run-epoch',
	'stale-session-epoch',
	'stale-source-revision',
	'not-owner',
	'invalid-return-token'
] as const;

export type CameraOutputRefusal = (typeof CAMERA_OUTPUT_REFUSALS)[number];

export type CameraOutputDecision =
	| {
			kind: 'acquired';
			state: CameraOutputState;
			claim: CameraOutputClaim;
			/** The claim the new run replaced, if any. */
			replaced: CameraOutputClaim | null;
	  }
	| { kind: 'refused'; state: CameraOutputState; reason: CameraOutputRefusal; message: string; owners: readonly string[] };

/** Strict ticket validation: opaque nonempty ids and a non-negative integer run epoch. */
export function validateCameraOutputTicket(input: unknown): { valid: boolean; issues: ShapeIssue[]; ticket?: CameraOutputTicket } {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', ['outputId', 'sourceRevision', 'sessionEpoch', 'ownerId', 'runEpoch']);
	if (record === null) return { valid: false, issues: reader.issues };
	const outputId = reader.opaqueId(record.outputId, '$.outputId');
	const sourceRevision = reader.opaqueId(record.sourceRevision, '$.sourceRevision');
	const sessionEpoch = reader.opaqueId(record.sessionEpoch, '$.sessionEpoch');
	const ownerId = reader.opaqueId(record.ownerId, '$.ownerId');
	const runEpoch = reader.integerAtLeast(record.runEpoch, '$.runEpoch', 0);
	if (reader.issues.length > 0 || outputId === null || sourceRevision === null || sessionEpoch === null || ownerId === null || runEpoch === null) {
		return { valid: false, issues: reader.issues };
	}
	return { valid: true, issues: [], ticket: { outputId, sourceRevision, sessionEpoch, ownerId, runEpoch } };
}

/** A free viewport/session state: no claim and no accepted run epoch yet. */
export function createCameraOutputState(viewportId: string): CameraOutputState {
	return { viewportId, claim: null, epochFloor: -1 };
}

function refuses(
	state: CameraOutputState,
	reason: CameraOutputRefusal,
	message: string,
	owners: readonly string[] = []
): CameraOutputDecision {
	return { kind: 'refused', state, reason, message, owners };
}

function sameTicket(left: CameraOutputTicket, right: CameraOutputTicket): boolean {
	return (
		left.outputId === right.outputId &&
		left.sourceRevision === right.sourceRevision &&
		left.sessionEpoch === right.sessionEpoch &&
		left.ownerId === right.ownerId &&
		left.runEpoch === right.runEpoch
	);
}

/**
 * Acquire exclusive ownership of one viewport/session output.
 *
 * `exclusive` refuses any live claim (including a newer run of the same owner);
 * `ordered-replacement` and `ordered-handoff` accept a strictly newer
 * `runEpoch` than **every run epoch this output has ever accepted**, and
 * `ordered-handoff` additionally issues a Camera-owned return context so the
 * replaced run can return later. A request whose `expected` observation no
 * longer matches the live claim is refused: it was made against state that has
 * already changed. A ticket whose epoch is at or below the output's floor is
 * refused even while the output is free, so a completed, cancelled or returned
 * run cannot re-enter with the epoch it already spent.
 */
export function acquireCameraOutput(state: CameraOutputState, request: CameraOutputRequest): CameraOutputDecision {
	const ticket = validateCameraOutputTicket(request.ticket);
	if (!ticket.valid) {
		return refuses(state, 'invalid-ticket', ticket.issues[0]?.message ?? 'the ticket is not a valid Camera output ticket');
	}
	if (!CAMERA_OUTPUT_ROLES.includes(request.role)) {
		return refuses(state, 'unsupported-role', `role "${request.role}" is not a declared Camera output role`);
	}
	if (!CAMERA_OUTPUT_POLICIES.includes(request.policy)) {
		return refuses(state, 'invalid-request', `policy "${request.policy}" is not a declared Camera output policy`);
	}
	const current = state.claim;
	const expectedMatches =
		current === null
			? request.expected.kind === 'unowned'
			: request.expected.kind === 'held' && sameTicket(request.expected.ticket, current.ticket);
	if (!expectedMatches) {
		return refuses(
			state,
			'output-mismatch',
			'the request was made against an ownership observation that no longer matches the live output',
			current === null ? [] : [current.ticket.ownerId]
		);
	}
	if (current === null) {
		if (ticket.ticket!.runEpoch <= state.epochFloor) {
			return refuses(
				state,
				'stale-run-epoch',
				`run epoch ${ticket.ticket!.runEpoch} cannot take this free output; the highest accepted run epoch was ${state.epochFloor}`
			);
		}
		const claim: CameraOutputClaim = { ticket: ticket.ticket!, role: request.role, returnContext: null };
		return { kind: 'acquired', state: { ...state, claim, epochFloor: ticket.ticket!.runEpoch }, claim, replaced: null };
	}
	if (request.policy === 'exclusive') {
		return refuses(
			state,
			'competing-exclusive-owner',
			`the output is exclusively held by run ${current.ticket.runEpoch} of owner "${current.ticket.ownerId}" as "${current.role}"`,
			[current.ticket.ownerId]
		);
	}
	const floor = Math.max(state.epochFloor, current.ticket.runEpoch);
	if (ticket.ticket!.runEpoch <= floor) {
		return refuses(
			state,
			'stale-run-epoch',
			`run epoch ${ticket.ticket!.runEpoch} cannot replace the active run epoch ${current.ticket.runEpoch}`,
			[current.ticket.ownerId]
		);
	}
	if (ticket.ticket!.sessionEpoch !== current.ticket.sessionEpoch) {
		return refuses(state, 'stale-session-epoch', 'the request belongs to a different host session than the active output');
	}
	if (ticket.ticket!.sourceRevision !== current.ticket.sourceRevision) {
		return refuses(state, 'stale-source-revision', 'the request belongs to a different source revision than the active output');
	}
	let returnContext: CameraReturnContext | null = null;
	if (request.policy === 'ordered-handoff') {
		const token = request.returnToken;
		if (token === undefined || token.trim() === '') {
			return refuses(state, 'invalid-request', 'an ordered handoff must supply the return token it issues');
		}
		returnContext = {
			token,
			issuedTo: current.ticket,
			role: current.role,
			sourceRevision: current.ticket.sourceRevision,
			sessionEpoch: current.ticket.sessionEpoch
		};
	}
	const claim: CameraOutputClaim = { ticket: ticket.ticket!, role: request.role, returnContext };
	return { kind: 'acquired', state: { ...state, claim, epochFloor: ticket.ticket!.runEpoch }, claim, replaced: current };
}

export type CameraOutputRequestDecision =
	| { kind: 'accepted'; state: CameraOutputState; claim: CameraOutputClaim }
	| { kind: 'superseded'; state: CameraOutputState; holder: CameraOutputTicket }
	| { kind: 'refused'; state: CameraOutputState; reason: CameraOutputRefusal; message: string; owners: readonly string[] };

/**
 * Confirm that a run still owns the output and may continue its declared intent.
 * A caller whose run has been superseded is told so (`superseded`) instead of
 * being left to write into an output it no longer owns; a wrong-epoch or foreign
 * ticket is refused. No intent is evaluated here — the Camera authority evaluates
 * pose and projection.
 */
export function requestCameraOutput(state: CameraOutputState, ticket: unknown): CameraOutputRequestDecision {
	const validation = validateCameraOutputTicket(ticket);
	if (!validation.valid) {
		return { kind: 'refused', state, reason: 'invalid-ticket', message: validation.issues[0]?.message ?? 'invalid ticket', owners: [] };
	}
	const request = validation.ticket!;
	const current = state.claim;
	if (current === null) {
		return { kind: 'refused', state, reason: 'not-owner', message: 'the output is unowned', owners: [] };
	}
	// An older run learns that it was superseded, whoever now holds the output.
	if (request.runEpoch < current.ticket.runEpoch) {
		return { kind: 'superseded', state, holder: current.ticket };
	}
	if (current.ticket.ownerId !== request.ownerId || current.ticket.outputId !== request.outputId) {
		return {
			kind: 'refused',
			state,
			reason: 'not-owner',
			message: `owner "${request.ownerId}" does not hold output "${request.outputId}"`,
			owners: [current.ticket.ownerId]
		};
	}
	if (request.runEpoch > current.ticket.runEpoch) {
		return {
			kind: 'refused',
			state,
			reason: 'stale-run-epoch',
			message: `run epoch ${request.runEpoch} is not the active run epoch ${current.ticket.runEpoch}`,
			owners: [current.ticket.ownerId]
		};
	}
	if (request.sessionEpoch !== current.ticket.sessionEpoch) {
		return { kind: 'refused', state, reason: 'stale-session-epoch', message: 'the ticket belongs to a different host session', owners: [] };
	}
	if (request.sourceRevision !== current.ticket.sourceRevision) {
		return { kind: 'refused', state, reason: 'stale-source-revision', message: 'the ticket belongs to a different source revision', owners: [] };
	}
	return { kind: 'accepted', state, claim: current };
}

/**
 * Replace the active output under the ordered-transfer rules, issuing a
 * Camera-owned return context for the replaced run. Kept as a named entry point
 * so a transfer reads as a transfer at the call site.
 */
export function replaceCameraOutput(
	state: CameraOutputState,
	request: Omit<CameraOutputRequest, 'policy'> & { returnToken: string }
): CameraOutputDecision {
	return acquireCameraOutput(state, { ...request, policy: 'ordered-handoff' });
}

export type CameraOutputReturnDecision =
	| { kind: 'returned'; state: CameraOutputState; claim: CameraOutputClaim }
	| { kind: 'refused'; state: CameraOutputState; reason: CameraOutputRefusal; message: string; owners: readonly string[] };

/**
 * Return the output to the run that a handoff replaced. The returning run must
 * still hold the output, and the return context is validated against the
 * **current** source/output context — a stale token, a different source revision
 * or a different host session refuses with a reason instead of transferring
 * ownership to a run that no longer means the same thing.
 *
 * A return is an ownership transition like any other, so the restored run keeps
 * its identity and role but receives a **new, strictly newer** run epoch (the
 * returned claim carries it). Restoring the original epoch would move the
 * output's ordering backwards: the returned ticket would be able to re-acquire
 * the output it just gave up, and the handoff would not be binding. The
 * returning run's old ticket is therefore spent, and a delayed callback holding
 * it learns `superseded` instead of reclaiming the output.
 */
export function returnCameraOutput(
	state: CameraOutputState,
	ticket: unknown,
	returnToken: string | null
): CameraOutputReturnDecision {
	const validation = validateCameraOutputTicket(ticket);
	if (!validation.valid) {
		return { kind: 'refused', state, reason: 'invalid-ticket', message: validation.issues[0]?.message ?? 'invalid ticket', owners: [] };
	}
	const request = validation.ticket!;
	const current = state.claim;
	if (current === null) {
		return { kind: 'refused', state, reason: 'not-owner', message: 'the output is unowned and nothing can be returned', owners: [] };
	}
	if (!sameTicket(current.ticket, request)) {
		return { kind: 'refused', state, reason: 'not-owner', message: 'the ticket does not hold the active output', owners: [current.ticket.ownerId] };
	}
	const context = current.returnContext;
	if (context === null || returnToken === null || returnToken !== context.token) {
		return { kind: 'refused', state, reason: 'invalid-return-token', message: 'the return token does not name this output transfer', owners: [current.ticket.ownerId] };
	}
	if (context.sourceRevision !== current.ticket.sourceRevision) {
		return { kind: 'refused', state, reason: 'stale-source-revision', message: 'the return context belongs to a different source revision', owners: [] };
	}
	if (context.sessionEpoch !== current.ticket.sessionEpoch) {
		return { kind: 'refused', state, reason: 'stale-session-epoch', message: 'the return context belongs to a different host session', owners: [] };
	}
	if (context.issuedTo.runEpoch >= current.ticket.runEpoch) {
		return { kind: 'refused', state, reason: 'stale-run-epoch', message: 'the return context does not name an older run than the active output', owners: [] };
	}
	// The restored run continues under a fresh epoch: ownership order never moves backwards.
	const restored: CameraOutputTicket = { ...context.issuedTo, runEpoch: current.ticket.runEpoch + 1 };
	const claim: CameraOutputClaim = { ticket: restored, role: context.role, returnContext: null };
	return { kind: 'returned', state: { ...state, claim, epochFloor: restored.runEpoch }, claim };
}

export type CameraOutputCancelDecision =
	| { kind: 'cancelled'; state: CameraOutputState }
	| { kind: 'ignored'; state: CameraOutputState; reason: CameraOutputRefusal; message: string };

/**
 * Epoch-qualified, idempotent cancellation. Only the run that currently holds the
 * output can release it: the presented ticket must match the active one in **every**
 * field — output, source revision, host session, owner and run epoch — so a
 * completion from another source revision or another host session cannot clear
 * this output, and a wrong-epoch or foreign owner cannot clear, reclaim or
 * replace it. Cancelling an unowned or already-cancelled output is a no-op, not
 * an error, and the output's epoch floor is retained so the cancelled run cannot
 * re-acquire with the epoch it already spent.
 */
export function cancelCameraOutput(state: CameraOutputState, ticket: unknown): CameraOutputCancelDecision {
	const validation = validateCameraOutputTicket(ticket);
	if (!validation.valid) {
		return { kind: 'ignored', state, reason: 'invalid-ticket', message: validation.issues[0]?.message ?? 'invalid ticket' };
	}
	const request = validation.ticket!;
	const current = state.claim;
	if (current === null) return { kind: 'cancelled', state };
	if (request.runEpoch < current.ticket.runEpoch) {
		return {
			kind: 'ignored',
			state,
			reason: 'stale-run-epoch',
			message: `run epoch ${request.runEpoch} cannot clear the active run epoch ${current.ticket.runEpoch}`
		};
	}
	if (!sameTicket(current.ticket, request)) {
		return { kind: 'ignored', state, reason: 'not-owner', message: 'the ticket does not hold the active output' };
	}
	return { kind: 'cancelled', state: { ...state, claim: null } };
}
