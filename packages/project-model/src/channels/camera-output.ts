/**
 * F.3 — the shared Camera-output ticket protocol (AM-3).
 *
 * `{outputId, sourceRevision, sessionEpoch, ownerId, runEpoch}` governs
 * inspection, guided/free navigation, Follow, Look-through and Preview through
 * acquire / request / replace / return / cancel. Exactly one Camera output owner
 * exists per output, and ownership order is monotonic: every accepted transition —
 * including a return to a replaced run — moves to a strictly newer run epoch, so a
 * spent ticket can never re-enter.
 *
 * **One ticket context.** A state is the ownership of *one output* in *one host
 * session* over *one current source*, and it names all three: `outputId`,
 * `sessionEpoch` and `sourceRevision`. Every operation qualifies the presented
 * ticket against that context first (`qualifyTicket`), before the live claim is
 * consulted — so a ticket for another output, another host session or another
 * source cannot acquire, request, return or cancel here, whether the output is
 * free, held or handed off. Because only a qualified ticket is ever accepted, a
 * live claim always carries the state's own output, session and source.
 *
 * **Output vs viewport.** `outputId` is the identity a ticket names; `viewportId`
 * is the Stage viewport that realises the output. They are separate fields
 * because they are separate identities — AM-3 says a second viewport is a distinct
 * output, which the Stage owner (T1.P01.S02) enforces when it creates states, and
 * this protocol never assumes the two strings are equal. Tickets are qualified by
 * `outputId` only.
 *
 * **Source lifetime.** `sourceRevision` is the current-source content identity the
 * host's Camera evaluation reads (the snapshot's `sourceContentId`, the same
 * identity F.3 contribution staleness uses). When the host's source changes, it
 * calls `rebaseCameraOutputSource`: the live claim **ends** (the output becomes
 * free), any pending return context is voided, and both are reported so the host
 * can re-acquire for the new source with a new ticket. Ownership is deliberately
 * not requalified onto the new source on the owner's behalf — that would mint
 * authority for a run whose intent was never evaluated against the new source, and
 * would let a return context cross sources. The epoch floor is kept across the
 * change, so ticket order stays monotonic for the output's whole session.
 *
 * **Returns nest exactly one deep**, deliberately. A handoff issues a return
 * context only for the run it replaced, and the run a return restores is left
 * holding none, so unwinding a chain (A → B → C) needs no retained history: when C
 * replaces B, B's pending return to A is **voided** and reported on that decision
 * (`voidedReturn`), and a later return from B to A is refused. Every transition that
 * ends a claim — replacement, cancellation, source rebase — reports the return
 * obligation it voids, so no obligation disappears silently. A deeper unwind is a
 * future admitted capability, not something this protocol fakes.
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
 * One output's ownership state in one host session over one current source.
 *
 * `claim: null` means the output is free. `epochFloor` is the highest run epoch
 * ever accepted for this output — including a run that has since been replaced,
 * cancelled, returned or ended by a source rebase. Every ownership transition must
 * be strictly newer than it, so a ticket from an ended ownership period can never
 * re-enter. `-1` means no run has ever been accepted here.
 */
export type CameraOutputState = {
	/** The output identity every ticket names. */
	outputId: string;
	/** The Stage viewport realising this output; never used to qualify a ticket. */
	viewportId: string;
	/** The host session this state belongs to. */
	sessionEpoch: string;
	/** The current-source content identity the output is evaluated against. */
	sourceRevision: string;
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
	'foreign-output',
	'stale-observation',
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
			/** The replaced claim's pending return, which can no longer be honoured. */
			voidedReturn: CameraReturnContext | null;
	  }
	| { kind: 'refused'; state: CameraOutputState; reason: CameraOutputRefusal; message: string; owners: readonly string[] };

/**
 * The highest run epoch this protocol accepts. Ownership order must always be able
 * to move forward, and `Number.MAX_SAFE_INTEGER + 1 === Number.MAX_SAFE_INTEGER`, so
 * accepting that value would let a transition mint an epoch equal to the one it
 * replaced instead of a strictly newer one. Bounding every accepted **and minted**
 * epoch here is what keeps "strictly newer" true at the numerical boundary. An
 * output that reaches the ceiling can still be cancelled; a new host session (a new
 * state) is what starts ordering again.
 */
export const MAX_CAMERA_OUTPUT_RUN_EPOCH = Number.MAX_SAFE_INTEGER - 1;

/** Strict ticket validation: opaque nonempty ids and a bounded non-negative integer run epoch. */
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
	if (runEpoch > MAX_CAMERA_OUTPUT_RUN_EPOCH) {
		reader.problem(
			'$.runEpoch',
			'out-of-range',
			`$.runEpoch must be at most ${MAX_CAMERA_OUTPUT_RUN_EPOCH}, so a strictly newer run epoch always exists`
		);
		return { valid: false, issues: reader.issues };
	}
	return { valid: true, issues: [], ticket: { outputId, sourceRevision, sessionEpoch, ownerId, runEpoch } };
}

/** The context a new, free output state is created for. */
export type CameraOutputContext = {
	outputId: string;
	viewportId: string;
	sessionEpoch: string;
	sourceRevision: string;
};

/**
 * A free output state: the output, the viewport realising it, the host session it
 * belongs to and the current source — no claim and no accepted run epoch yet. A
 * new host session starts from a new state, and a ticket left over from the
 * previous one is refused instead of being honoured against state it never
 * belonged to.
 */
export function createCameraOutputState(context: CameraOutputContext): CameraOutputState {
	return {
		outputId: context.outputId,
		viewportId: context.viewportId,
		sessionEpoch: context.sessionEpoch,
		sourceRevision: context.sourceRevision,
		claim: null,
		epochFloor: -1
	};
}

type Refusal = { reason: CameraOutputRefusal; message: string };

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
 * The one ticket-context check every operation runs first: the ticket must name
 * this output, this host session and this current source. It is what keeps a
 * ticket for another output, a closed session or an obsolete source from touching
 * this state — whether the output is free, held or handed off.
 */
function qualifyTicket(state: CameraOutputState, ticket: CameraOutputTicket): Refusal | null {
	if (ticket.outputId !== state.outputId) {
		return {
			reason: 'foreign-output',
			message: `the ticket names output "${ticket.outputId}" and this state is output "${state.outputId}"; address the output the ticket was issued for`
		};
	}
	if (ticket.sessionEpoch !== state.sessionEpoch) {
		return {
			reason: 'stale-session-epoch',
			message: `the ticket belongs to host session "${ticket.sessionEpoch}" and this output belongs to "${state.sessionEpoch}"; acquire again in the current session`
		};
	}
	if (ticket.sourceRevision !== state.sourceRevision) {
		return {
			reason: 'stale-source-revision',
			message: `the ticket was issued for source "${ticket.sourceRevision}" and this output now reads source "${state.sourceRevision}"; re-evaluate the intent and acquire for the current source`
		};
	}
	return null;
}

function readTicket(state: CameraOutputState, input: unknown): { ticket: CameraOutputTicket } | Refusal {
	const validation = validateCameraOutputTicket(input);
	if (!validation.valid) {
		return { reason: 'invalid-ticket', message: validation.issues[0]?.message ?? 'the ticket is not a valid Camera output ticket' };
	}
	const refusal = qualifyTicket(state, validation.ticket!);
	return refusal ?? { ticket: validation.ticket! };
}

/**
 * Acquire exclusive ownership of one output.
 *
 * `exclusive` refuses any live claim (including a newer run of the same owner);
 * `ordered-replacement` and `ordered-handoff` accept a strictly newer `runEpoch`
 * than **every run epoch this output has ever accepted**, and `ordered-handoff`
 * additionally issues a Camera-owned return context so the replaced run can
 * return later. A request whose `expected` observation no longer matches the live
 * claim is refused (`stale-observation`): it was made against state that has
 * already changed. A ticket at or below the output's floor is refused even while
 * the output is free, so a completed, cancelled, returned or rebased run cannot
 * re-enter with the epoch it already spent.
 */
export function acquireCameraOutput(state: CameraOutputState, request: CameraOutputRequest): CameraOutputDecision {
	const refuse = (reason: CameraOutputRefusal, message: string, owners: readonly string[] = []): CameraOutputDecision => ({
		kind: 'refused',
		state,
		reason,
		message,
		owners
	});
	const read = readTicket(state, request.ticket);
	if (!('ticket' in read)) return refuse(read.reason, read.message);
	const ticket = read.ticket;
	if (!CAMERA_OUTPUT_ROLES.includes(request.role)) {
		return refuse('unsupported-role', `role "${request.role}" is not a declared Camera output role`);
	}
	if (!CAMERA_OUTPUT_POLICIES.includes(request.policy)) {
		return refuse('invalid-request', `policy "${request.policy}" is not a declared Camera output policy`);
	}
	const current = state.claim;
	const expectedMatches =
		current === null
			? request.expected.kind === 'unowned'
			: request.expected.kind === 'held' && sameTicket(request.expected.ticket, current.ticket);
	if (!expectedMatches) {
		return refuse(
			'stale-observation',
			'the request was made against an ownership observation that no longer matches the live output; observe it again before requesting',
			current === null ? [] : [current.ticket.ownerId]
		);
	}
	if (ticket.runEpoch <= state.epochFloor) {
		return refuse(
			'stale-run-epoch',
			`run epoch ${ticket.runEpoch} is not newer than the highest run epoch this output accepted (${state.epochFloor})`,
			current === null ? [] : [current.ticket.ownerId]
		);
	}
	if (current === null) {
		const claim: CameraOutputClaim = { ticket, role: request.role, returnContext: null };
		return { kind: 'acquired', state: { ...state, claim, epochFloor: ticket.runEpoch }, claim, replaced: null, voidedReturn: null };
	}
	if (request.policy === 'exclusive') {
		return refuse(
			'competing-exclusive-owner',
			`the output is exclusively held by run ${current.ticket.runEpoch} of owner "${current.ticket.ownerId}" as "${current.role}"; request an ordered replacement or handoff, or wait for it to end`,
			[current.ticket.ownerId]
		);
	}
	let returnContext: CameraReturnContext | null = null;
	if (request.policy === 'ordered-handoff') {
		const token = request.returnToken;
		if (token === undefined || token.trim() === '') {
			return refuse('invalid-request', 'an ordered handoff must supply the return token it issues');
		}
		returnContext = {
			token,
			issuedTo: current.ticket,
			role: current.role,
			sourceRevision: current.ticket.sourceRevision,
			sessionEpoch: current.ticket.sessionEpoch
		};
	}
	const claim: CameraOutputClaim = { ticket, role: request.role, returnContext };
	return {
		kind: 'acquired',
		state: { ...state, claim, epochFloor: ticket.runEpoch },
		claim,
		replaced: current,
		voidedReturn: current.returnContext
	};
}

export type CameraOutputRequestDecision =
	| { kind: 'accepted'; state: CameraOutputState; claim: CameraOutputClaim }
	/** The run no longer holds this output. `owners` names the holder; no reusable ticket is disclosed. */
	| { kind: 'superseded'; state: CameraOutputState; owners: readonly string[] }
	| { kind: 'refused'; state: CameraOutputState; reason: CameraOutputRefusal; message: string; owners: readonly string[] };

/**
 * Confirm that a run still owns the output and may continue its declared intent.
 * A qualified run whose ownership has ended is told so (`superseded`) instead of
 * being left to write into an output it no longer owns; the answer names the
 * holder's owner only, never the holder's ticket, so a superseded caller cannot
 * use it to act as the holder. A ticket for another output, session or source is
 * refused before the claim is consulted. No intent is evaluated here — the Camera
 * authority evaluates pose and projection.
 */
export function requestCameraOutput(state: CameraOutputState, ticket: unknown): CameraOutputRequestDecision {
	const read = readTicket(state, ticket);
	if (!('ticket' in read)) return { kind: 'refused', state, reason: read.reason, message: read.message, owners: [] };
	const request = read.ticket;
	const current = state.claim;
	if (current !== null && sameTicket(current.ticket, request)) return { kind: 'accepted', state, claim: current };
	// A run this output already accepted (its epoch is at or below the floor) has ended.
	if (request.runEpoch <= state.epochFloor) {
		return { kind: 'superseded', state, owners: current === null ? [] : [current.ticket.ownerId] };
	}
	return {
		kind: 'refused',
		state,
		reason: 'not-owner',
		message:
			current === null
				? 'the output is free; acquire it before requesting'
				: `run ${request.runEpoch} of owner "${request.ownerId}" was never accepted for this output`,
		owners: current === null ? [] : [current.ticket.ownerId]
	};
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
 * still hold the output with a qualified ticket, and the return context must have
 * been issued in this session for this source — a stale token, a context from an
 * obsolete source or a foreign session refuses with a reason instead of
 * transferring ownership to a run that no longer means the same thing.
 *
 * A return is an ownership transition like any other, so the restored run keeps
 * its identity and role but receives a **new, strictly newer** run epoch (the
 * returned claim carries it). The returning run's old ticket is therefore spent,
 * and a delayed callback holding it learns `superseded` instead of reclaiming.
 */
export function returnCameraOutput(
	state: CameraOutputState,
	ticket: unknown,
	returnToken: string | null
): CameraOutputReturnDecision {
	const refuse = (reason: CameraOutputRefusal, message: string, owners: readonly string[] = []): CameraOutputReturnDecision => ({
		kind: 'refused',
		state,
		reason,
		message,
		owners
	});
	const read = readTicket(state, ticket);
	if (!('ticket' in read)) return refuse(read.reason, read.message);
	const current = state.claim;
	if (current === null) return refuse('not-owner', 'the output is free and nothing can be returned');
	if (!sameTicket(current.ticket, read.ticket)) {
		return refuse('not-owner', 'the ticket does not hold the active output', [current.ticket.ownerId]);
	}
	const context = current.returnContext;
	if (context === null || returnToken === null || returnToken !== context.token) {
		return refuse('invalid-return-token', 'the return token does not name a pending return of this output', [current.ticket.ownerId]);
	}
	if (context.sourceRevision !== state.sourceRevision || context.issuedTo.sourceRevision !== state.sourceRevision) {
		return refuse('stale-source-revision', 'the return context was issued for another source than the output now reads');
	}
	if (context.sessionEpoch !== state.sessionEpoch || context.issuedTo.sessionEpoch !== state.sessionEpoch) {
		return refuse('stale-session-epoch', 'the return context was issued in another host session');
	}
	if (context.issuedTo.outputId !== state.outputId) {
		return refuse('foreign-output', 'the return context names another output');
	}
	if (current.ticket.runEpoch >= MAX_CAMERA_OUTPUT_RUN_EPOCH) {
		return refuse(
			'stale-run-epoch',
			`run epoch ${current.ticket.runEpoch} is the highest this protocol accepts, so a return cannot mint a strictly newer epoch`
		);
	}
	// The restored run continues under a fresh epoch: ownership order never moves backwards.
	const restored: CameraOutputTicket = { ...context.issuedTo, runEpoch: Math.max(state.epochFloor, current.ticket.runEpoch) + 1 };
	const claim: CameraOutputClaim = { ticket: restored, role: context.role, returnContext: null };
	return { kind: 'returned', state: { ...state, claim, epochFloor: restored.runEpoch }, claim };
}

export type CameraOutputCancelDecision =
	| { kind: 'cancelled'; state: CameraOutputState; voidedReturn: CameraReturnContext | null }
	| { kind: 'ignored'; state: CameraOutputState; reason: CameraOutputRefusal; message: string };

/**
 * Epoch-qualified, idempotent cancellation. Only the run that currently holds the
 * output can release it: the ticket is qualified against this output, session and
 * source, and must then equal the active ticket in every field, so a wrong-epoch,
 * foreign or obsolete completion cannot clear, reclaim or replace it. Cancelling a
 * free output with a qualified ticket is a no-op, not an error, and the epoch floor
 * is retained so the cancelled run cannot re-acquire with the epoch it spent. A
 * cancelled claim's pending return is voided and reported.
 */
export function cancelCameraOutput(state: CameraOutputState, ticket: unknown): CameraOutputCancelDecision {
	const read = readTicket(state, ticket);
	if (!('ticket' in read)) return { kind: 'ignored', state, reason: read.reason, message: read.message };
	const current = state.claim;
	if (current === null) return { kind: 'cancelled', state, voidedReturn: null };
	if (!sameTicket(current.ticket, read.ticket)) {
		return read.ticket.runEpoch < current.ticket.runEpoch
			? {
					kind: 'ignored',
					state,
					reason: 'stale-run-epoch',
					message: `run epoch ${read.ticket.runEpoch} cannot clear the active run epoch ${current.ticket.runEpoch}`
				}
			: { kind: 'ignored', state, reason: 'not-owner', message: 'the ticket does not hold the active output' };
	}
	return { kind: 'cancelled', state: { ...state, claim: null }, voidedReturn: current.returnContext };
}

export type CameraOutputRebaseDecision =
	| { kind: 'unchanged'; state: CameraOutputState }
	| {
			kind: 'rebased';
			state: CameraOutputState;
			/** The claim the source change ended, or `null` when the output was free. */
			ended: CameraOutputClaim | null;
			/** The ended claim's pending return, which can no longer be honoured. */
			voidedReturn: CameraReturnContext | null;
	  }
	| { kind: 'refused'; state: CameraOutputState; reason: 'invalid-request'; message: string };

/**
 * Move the output to a new current source. The host calls this whenever the
 * source its Camera evaluation reads changes (a replacement or an accepted edit
 * that changes content). The live claim and its pending return end here; the
 * output becomes free for the new source, and every ticket issued for the old
 * source is refused from now on. Rebasing to the source the output already reads
 * changes nothing, so an Undo that restores identical content does not end a run.
 */
export function rebaseCameraOutputSource(state: CameraOutputState, sourceRevision: unknown): CameraOutputRebaseDecision {
	const reader = new ShapeReader();
	const next = reader.opaqueId(sourceRevision, '$.sourceRevision');
	if (next === null) {
		return { kind: 'refused', state, reason: 'invalid-request', message: reader.issues[0]?.message ?? 'the source revision is not an opaque id' };
	}
	if (next === state.sourceRevision) return { kind: 'unchanged', state };
	return {
		kind: 'rebased',
		state: { ...state, sourceRevision: next, claim: null },
		ended: state.claim,
		voidedReturn: state.claim?.returnContext ?? null
	};
}
