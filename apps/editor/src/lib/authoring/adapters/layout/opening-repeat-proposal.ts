/**
 * T1 A8 — the live Opening Repeat proposal, shared by the Card and the Stage.
 *
 * The Card owns the typed count and spacing; the adapter reads the same values
 * to draw every proposed copy as a candidate along the host Wall. The planner
 * is the only thing that decides fit, so both readers call
 * `previewOpeningRepeat` and cannot disagree.
 *
 * This is session state, never authored data: it is not serialized, never
 * enters history and is cleared when the panel closes or the operation commits.
 * Keying by the accepted source and the Opening means a stale proposal can
 * never describe a document it was not made against.
 */

export type OpeningRepeatProposal = {
	/** The accepted source the typed values were read against. */
	readonly sourceContentId: string;
	readonly openingId: string;
	readonly wallId: string;
	readonly count: number;
	readonly spacing: number;
};

const proposals = new Map<string, OpeningRepeatProposal>();

function keyOf(sourceContentId: string, openingId: string): string {
	return `${sourceContentId}\u0000${openingId}`;
}

export function publishOpeningRepeatProposal(proposal: OpeningRepeatProposal): void {
	proposals.set(keyOf(proposal.sourceContentId, proposal.openingId), proposal);
}

export function openingRepeatProposal(
	sourceContentId: string,
	openingId: string
): OpeningRepeatProposal | null {
	return proposals.get(keyOf(sourceContentId, openingId)) ?? null;
}

export function clearOpeningRepeatProposal(sourceContentId: string, openingId: string): void {
	proposals.delete(keyOf(sourceContentId, openingId));
}

/** A binding that ends (close/dispose/install) drops every proposal it published. */
export function clearOpeningRepeatProposalsForSource(sourceContentId: string): void {
	for (const key of [...proposals.keys()]) {
		if (key.startsWith(`${sourceContentId}\u0000`)) proposals.delete(key);
	}
}
