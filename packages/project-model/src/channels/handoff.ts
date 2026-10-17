/**
 * `F3.channels@1:camera-handoff-v1` — the Experience handoff discipline over the
 * landed Camera-output ticket protocol (T3.P01.S06).
 *
 * The landed protocol (`./camera-output`) owns ownership order: acquire /
 * request / replace / return / cancel, a qualified ticket context (`outputId`,
 * `sessionEpoch`, `sourceRevision`), an epoch floor that makes a spent run
 * unrecoverable, and exactly one nested return obligation. This module does
 * **not** restate any of that. It adds the rules that belong to a *handoff*
 * between Experience-facing runs and delegates every transition:
 *
 * - guided and free navigation own the output through their own acquisition;
 *   they replace one another in order, but never preempt a handoff role
 *   (Follow, Look-through, Preview) that must be ended or returned explicitly;
 * - only a declared handoff role may take the output from another role:
 *   Follow, Look-through and Preview. Inspection and the navigation roles hold
 *   the output through their own acquisition; a handoff preempts a run, it does
 *   not become one;
 * - a handoff must transfer to a *different* role. Same-role takeover is an
 *   ordered replacement, and naming it a handoff would issue a return obligation
 *   to a run that still means the same thing;
 * - the return path and the cancellation path refuse to act on behalf of a run
 *   that did not receive the output as a handoff, so an inspection or navigation
 *   run is never ended by Experience cleanup;
 * - `pendingCameraHandoff` is the one read a cleanup pass needs: which role owes
 *   a return, and to whom. It returns no ticket that could be replayed; the
 *   return token is disclosed because the holder must present it, exactly as the
 *   landed protocol requires.
 *
 * There is no pose, FOV or order authority here: the Camera authority evaluates
 * pose and projection, Experience owns editorial order, and this module only
 * answers ownership questions. Every function is pure.
 */

import {
	acquireCameraOutput,
	cancelCameraOutput,
	returnCameraOutput,
	type CameraOutputCancelDecision,
	type CameraOutputClaim,
	type CameraOutputDecision,
	type CameraOutputExpectation,
	type CameraOutputRefusal,
	type CameraOutputReturnDecision,
	type CameraOutputRole,
	type CameraOutputState,
	type CameraOutputTicket
} from './camera-output';

/** The exact scope this module provides, complete over the landed ticket protocol. */
export const CAMERA_HANDOFF_SCOPE = 'camera-handoff-v1' as const;

/**
 * The roles a handoff may transfer the output **to**. Follow and Look-through
 * are Experience runs over the shared camera; Preview is the capture surface.
 * Inspection and the guided/free navigation roles keep their own acquisition and
 * are never a handoff target.
 */
export const CAMERA_HANDOFF_ROLES = ['follow', 'look-through', 'preview'] as const;

export type CameraHandoffRole = (typeof CAMERA_HANDOFF_ROLES)[number];

/** Guided and free navigation: the two Experience-owned navigation modes. */
export const EXPERIENCE_NAVIGATION_ROLES = ['guided-navigation', 'free-navigation'] as const;

export type ExperienceNavigationRole = (typeof EXPERIENCE_NAVIGATION_ROLES)[number];

export function isCameraHandoffRole(role: CameraOutputRole): role is CameraHandoffRole {
	return (CAMERA_HANDOFF_ROLES as readonly string[]).includes(role);
}

export function isExperienceNavigationRole(role: CameraOutputRole): role is ExperienceNavigationRole {
	return (EXPERIENCE_NAVIGATION_ROLES as readonly string[]).includes(role);
}

export type CameraHandoffRequest = {
	/** The prospective run's ticket. Ownership moves only to a strictly newer run. */
	readonly ticket: CameraOutputTicket;
	readonly role: CameraHandoffRole;
	/** What the caller observed before requesting; a different live claim is stale. */
	readonly expected: CameraOutputExpectation;
	/** The return token issued to the displaced run. Required, never defaulted. */
	readonly returnToken: string;
};

function refuse(
	state: CameraOutputState,
	reason: CameraOutputRefusal,
	message: string
): Extract<CameraOutputDecision, { kind: 'refused' }> {
	return { kind: 'refused', state, reason, message, owners: state.claim === null ? [] : [state.claim.ticket.ownerId] };
}

/**
 * Hand the output to an Experience run, issuing the displaced run's return
 * obligation. The displaced run keeps its identity and role; a return restores it
 * under a fresh, strictly newer run epoch (the landed protocol's rule), so the
 * returning run's old ticket is spent.
 */
export function handoffCameraOutput(
	state: CameraOutputState,
	request: CameraHandoffRequest
): CameraOutputDecision {
	if (!isCameraHandoffRole(request.role)) {
		return refuse(
			state,
			'unsupported-role',
			`"${String(request.role)}" is not a declared handoff role; only ${CAMERA_HANDOFF_ROLES.join(', ')} receive a handoff`
		);
	}
	const current = state.claim;
	if (current !== null && current.role === request.role) {
		return refuse(
			state,
			'invalid-request',
			`the output is already held as "${current.role}"; a same-role takeover is an ordered replacement, not a handoff`
		);
	}
	return acquireCameraOutput(state, {
		ticket: request.ticket,
		role: request.role,
		expected: request.expected,
		policy: 'ordered-handoff',
		returnToken: request.returnToken
	});
}

export type ExperienceNavigationRequest = {
	readonly ticket: CameraOutputTicket;
	readonly mode: ExperienceNavigationRole;
	readonly expected: CameraOutputExpectation;
};

/**
 * Begin guided or free Experience navigation.
 *
 * The two navigation modes are ordered replacements of one another: moving from
 * guided to free (or back on rejoin) is an ordered takeover, and the displaced
 * run cannot reclaim the output. A handoff role is **not** displaced this way —
 * Follow, Look-through and Preview end through their own cancel/return path, so a
 * navigation start never silently discards their pending obligation.
 */
export function beginExperienceNavigation(
	state: CameraOutputState,
	request: ExperienceNavigationRequest
): CameraOutputDecision {
	if (!isExperienceNavigationRole(request.mode)) {
		return refuse(
			state,
			'unsupported-role',
			`"${String(request.mode)}" is not an Experience navigation mode; expected ${EXPERIENCE_NAVIGATION_ROLES.join(' or ')}`
		);
	}
	const current = state.claim;
	if (current !== null && isCameraHandoffRole(current.role)) {
		return refuse(
			state,
			'invalid-request',
			`the output is held as "${current.role}", a handoff role; end or return that run before navigation takes ownership`
		);
	}
	return acquireCameraOutput(state, {
		ticket: request.ticket,
		role: request.mode,
		expected: request.expected,
		policy: current === null ? 'exclusive' : 'ordered-replacement'
	});
}

/**
 * End guided or free navigation. Only the active navigation claim can be ended;
 * a handoff claim is refused so navigation cleanup never discards a return
 * obligation it did not receive.
 */
export function endExperienceNavigation(
	state: CameraOutputState,
	ticket: unknown
): CameraOutputCancelDecision {
	const current = state.claim;
	if (current !== null && !isExperienceNavigationRole(current.role)) {
		return {
			kind: 'ignored',
			state,
			reason: 'unsupported-role',
			message: `the active run holds the output as "${current.role}", not as navigation; navigation cleanup does not end it`
		};
	}
	return cancelCameraOutput(state, ticket);
}

/**
 * Return the output to the run a handoff displaced.
 *
 * Only a handoff run can return it: an Inspection or navigation claim ends
 * through cancellation, and pretending its claim were a handoff would let
 * Experience cleanup discard a run it never held.
 */
export function returnCameraHandoff(
	state: CameraOutputState,
	ticket: unknown,
	returnToken: string | null
): CameraOutputReturnDecision {
	const current = state.claim;
	if (current !== null && !isCameraHandoffRole(current.role)) {
		return {
			kind: 'refused',
			state,
			reason: 'unsupported-role',
			message: `the active run holds the output as "${current.role}", not as a handoff; it cannot return a handoff it never received`,
			owners: [current.ticket.ownerId]
		};
	}
	return returnCameraOutput(state, ticket, returnToken);
}

/**
 * End a handoff run. The landed cancellation is epoch-qualified and idempotent;
 * this wrapper adds only the ownership rule, so cancelling a handoff never ends
 * the inspection or navigation claim it was layered over.
 */
export function cancelCameraHandoff(
	state: CameraOutputState,
	ticket: unknown
): CameraOutputCancelDecision {
	const current = state.claim;
	if (current !== null && !isCameraHandoffRole(current.role)) {
		return {
			kind: 'ignored',
			state,
			reason: 'unsupported-role',
			message: `the active run holds the output as "${current.role}", not as a handoff; handoff cleanup does not end it`
		};
	}
	return cancelCameraOutput(state, ticket);
}

/**
 * Stale-run cleanup for a handoff or navigation claim. The ticket is
 * epoch-qualified by the landed protocol: a completion or cancellation from an
 * ended run is ignored and cannot clear the newer claim. This is the one entry a
 * host cleanup pass needs; it never fabricates a ticket for the current owner.
 */
export function cleanupCameraHandoff(
	state: CameraOutputState,
	ticket: unknown
): CameraOutputCancelDecision {
	const current = state.claim;
	// Even with no active claim the ticket must still be qualified: reporting
	// "cancelled" for a foreign or malformed ticket would let a cleanup pass
	// believe it ended a run it never held.
	if (current === null) return cancelCameraOutput(state, ticket);
	return isCameraHandoffRole(current.role)
		? cancelCameraOutput(state, ticket)
		: endExperienceNavigation(state, ticket);
}

/** The obligation a cleanup pass must discharge: a role and its owner, never a ticket. */
export type PendingCameraHandoff = {
	readonly role: CameraOutputRole;
	readonly ownerId: string;
	readonly runEpoch: number;
	readonly returnToken: string;
};

/**
 * Read the **displaced run's** pending return obligation for one output.
 *
 * This is the obligation a handoff issued to the run it preempted — the role and
 * owner that must get the output back — not the current holder's own claim. A
 * cleanup pass reads it to decide whose return is outstanding.
 *
 * The token is disclosed because the *holder* must present it to return; that is
 * the landed protocol's own contract. The ticket is not disclosed, so reading the
 * obligation cannot act as the displaced run.
 */
export function pendingCameraHandoff(state: CameraOutputState): PendingCameraHandoff | null {
	const claim: CameraOutputClaim | null = state.claim;
	if (claim === null || claim.returnContext === null) return null;
	return {
		role: claim.returnContext.role,
		ownerId: claim.returnContext.issuedTo.ownerId,
		runEpoch: claim.returnContext.issuedTo.runEpoch,
		returnToken: claim.returnContext.token
	};
}
