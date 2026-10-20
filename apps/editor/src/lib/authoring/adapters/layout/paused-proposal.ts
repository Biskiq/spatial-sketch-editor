/**
 * T1.P01.S05 — a Wall proposal preserved across a **reading change**.
 *
 * A reading flip ends the pointer writer, because the CSS the drag was measured
 * in no longer describes what is drawn. The work is not wrong, though: the
 * parameter the creator named is exact and belongs to the accepted source, so
 * it is kept as a proposal the Dimensions instrument can apply deliberately.
 *
 * The store is keyed by the accepted source and the Wall. It is not a document
 * and not a second authority: resuming rebuilds the same F.4 intent and the
 * retained planner revalidates it against the current accepted source, exactly
 * as a typed value would. The adapter publishes; the instrument reads and (on
 * resume/discard) clears.
 */

import type { FixedWallEndpoint } from '@portfolio/layout-core';

import type { WallManipulationRequest } from './precision';

export type PausedWallProposal = {
	/** The accepted source the parameter was solved against. */
	readonly sourceContentId: string;
	readonly wallId: string;
	readonly request: WallManipulationRequest;
	readonly fixed: FixedWallEndpoint;
	/** Full-precision display text; never the rounded overlay label. */
	readonly label: string;
};

const proposals = new Map<string, PausedWallProposal>();

function keyOf(sourceContentId: string, wallId: string): string {
	return `${sourceContentId}\u0000${wallId}`;
}

export function publishPausedProposal(proposal: PausedWallProposal): void {
	proposals.set(keyOf(proposal.sourceContentId, proposal.wallId), proposal);
}

export function pausedWallProposal(sourceContentId: string, wallId: string): PausedWallProposal | null {
	return proposals.get(keyOf(sourceContentId, wallId)) ?? null;
}

export function clearPausedProposal(sourceContentId: string, wallId: string): void {
	proposals.delete(keyOf(sourceContentId, wallId));
}

/** A binding that ends (close/dispose/install) drops every proposal it published. */
export function clearPausedProposalsForSource(sourceContentId: string): void {
	for (const key of [...proposals.keys()]) {
		if (key.startsWith(`${sourceContentId}\u0000`)) proposals.delete(key);
	}
}
