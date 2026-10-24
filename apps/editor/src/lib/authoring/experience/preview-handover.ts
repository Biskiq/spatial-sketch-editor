/**
 * Preview Camera handover (T3.P02.S02).
 *
 * Preview is an isolated visitor run, not a second Stage: entering it **hands the
 * Stage's one Camera output over** through the landed F3 ticket protocol's
 * ordered handoff, and leaving it **returns** the output to the inspection run
 * the handoff replaced. The protocol owns ownership order, qualification and the
 * return token; this module only sequences the two transitions the host's
 * lifecycle needs and mints the run epoch/return token they carry.
 *
 * What the handoff is not: unmounting a canvas, a second navigation model or a
 * host-minted ticket. The replaced run keeps its identity and role and receives a
 * strictly newer epoch on return, so a delayed Preview completion or cancel
 * arriving afterwards is `superseded` rather than reclaiming the output. A source
 * change ends both claims and voids the return (the protocol's rebase); exit then
 * restores nothing rather than reinstating a pose from a source that no longer
 * exists.
 *
 * Editor machinery is absent: no Svelte, no Three, no DOM.
 */
import {
	MAX_CAMERA_OUTPUT_RUN_EPOCH,
	type CameraOutputState,
	type CameraOutputTicket
} from '@portfolio/project-model';

import type { CameraSession } from '../stage/camera-session';

/** The session surface the handover drives; the Stage facade exposes exactly this. */
export type PreviewCameraPort = Pick<
	CameraSession,
	'output' | 'inspectionTicket' | 'handOffToPreview' | 'returnFromPreview' | 'cancelPreview' | 'previewTicket'
>;

export type PreviewEntryHandover =
	| {
			readonly kind: 'entered';
			/** The Preview run's ticket: the only credential that may return this output. */
			readonly ticket: CameraOutputTicket;
			readonly runEpoch: number;
			/** The inspection owner the handoff replaced, for the host's own accounting. */
			readonly replacedOwner: string | null;
	  }
	| { readonly kind: 'refused'; readonly reason: string; readonly message: string };

export type PreviewReturnHandover =
	| { readonly kind: 'returned'; readonly ticket: CameraOutputTicket }
	/** No Preview claim survives (a source change ended it): nothing is restored. */
	| { readonly kind: 'abandoned'; readonly reason: 'no-preview-claim' }
	| { readonly kind: 'refused'; readonly reason: string; readonly message: string };

/**
 * The run epoch a Preview entry must present.
 *
 * Ownership only ever moves to a strictly newer epoch than every run this output
 * has accepted, so the host's own increasing counter is raised over the protocol's
 * floor instead of being trusted on its own. At the protocol ceiling no newer
 * epoch exists; the handoff refuses rather than reusing a spent one.
 */
export function nextPreviewRunEpoch(output: CameraOutputState, counter: number): number {
	const floor = Math.max(output.epochFloor, output.claim?.ticket.runEpoch ?? -1, counter - 1);
	return Math.min(floor + 1, MAX_CAMERA_OUTPUT_RUN_EPOCH);
}

/**
 * The opaque token the handoff issues for the replaced inspection run.
 *
 * The protocol owns the return *context*; the host supplies only this value, and
 * it is never derived from anything a returning run could guess into a newer
 * ownership claim.
 */
export function previewReturnToken(sessionEpoch: string, runEpoch: number): string {
	return `${sessionEpoch}:preview-return:${runEpoch}`;
}

/**
 * Hand the Stage's output to a Preview run.
 *
 * The Stage must currently hold the output: a handoff of an unowned output would
 * transfer it without a return context, leaving the authoring session with no
 * valid way back. That case is a typed refusal, not a silent takeover.
 */
export function enterPreview(
	port: PreviewCameraPort,
	input: { readonly runEpoch: number; readonly returnToken: string }
): PreviewEntryHandover {
	if (port.inspectionTicket() === null) {
		return {
			kind: 'refused',
			reason: 'no-inspection-claim',
			message: 'The Stage does not hold its Camera output, so there is nothing to hand to Preview.'
		};
	}
	const decision = port.handOffToPreview(input.runEpoch, input.returnToken);
	if (decision.kind === 'refused') {
		return {
			kind: 'refused',
			reason: decision.reason,
			message: `Preview could not take the Camera output: ${decision.message}.`
		};
	}
	return {
		kind: 'entered',
		ticket: decision.claim.ticket,
		runEpoch: decision.claim.ticket.runEpoch,
		replacedOwner: decision.replaced?.ticket.ownerId ?? null
	};
}

/**
 * Return the output to the inspection run.
 *
 * `ticket` defaults to the live Preview claim; a caller may present an older one
 * (a delayed completion), which the protocol refuses as `not-owner` without
 * disturbing a newer owner.
 */
export function returnPreview(
	port: PreviewCameraPort,
	ticket?: CameraOutputTicket | null
): PreviewReturnHandover {
	const candidate = ticket === undefined ? port.previewTicket() : ticket;
	if (candidate === null) return { kind: 'abandoned', reason: 'no-preview-claim' };
	const decision = port.returnFromPreview(candidate);
	if (decision.kind === 'returned') return { kind: 'returned', ticket: decision.claim.ticket };
	return {
		kind: 'refused',
		reason: decision.reason,
		message: `The Camera output was not returned to the Stage: ${decision.message}.`
	};
}

/** End a Preview claim without a return; the protocol voids its return context. */
export function cancelPreview(
	port: PreviewCameraPort,
	ticket?: CameraOutputTicket | null
): { readonly kind: 'cancelled' } | { readonly kind: 'ignored'; readonly reason: string; readonly message: string } {
	const candidate = ticket === undefined ? port.previewTicket() : ticket;
	if (candidate === null) return { kind: 'cancelled' };
	const decision = port.cancelPreview(candidate);
	return decision.kind === 'cancelled'
		? { kind: 'cancelled' }
		: { kind: 'ignored', reason: decision.reason, message: decision.message };
}
