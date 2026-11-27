/**
 * The Light it → Group with… offer.
 *
 * One accepted Light it on a single ungrouped subject leaves a session-only
 * offer on that light's Card: the light and the subject it was aimed at. The
 * offer writes nothing; it is replaced by the next offer, cleared when the
 * selection leaves the light, and never survives the project.
 */
export type GroupWithOffer = {
	readonly projectId: string;
	readonly lightId: string;
	readonly subjectId: string;
	readonly subjectName: string;
};

let offer: GroupWithOffer | null = null;

export function setGroupWithOffer(next: GroupWithOffer | null): void {
	offer = next;
}

/** The live offer for one light in one project, or `null`. */
export function groupWithOfferFor(projectId: string, lightId: string): GroupWithOffer | null {
	return offer !== null && offer.projectId === projectId && offer.lightId === lightId
		? offer
		: null;
}

export function clearGroupWithOffer(): void {
	offer = null;
}

/** A selection change keeps the offer only while it still selects its light. */
export function reconcileGroupWithOffer(projectId: string, selectedLightId: string | null): void {
	if (offer !== null && (offer.projectId !== projectId || offer.lightId !== selectedLightId))
		offer = null;
}
