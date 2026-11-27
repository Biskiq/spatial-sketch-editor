import type { StageAdapterServices } from '$lib/authoring/stage/stage-adapter-host';

type Session = StageAdapterServices['stage']['session'];
type GroupWithOffer = { readonly lightId: string; readonly subjectId: string };

// Each mounted Stage has its own offer, and replacing the Stage retires it.
const offers = new WeakMap<Session, GroupWithOffer>();

export function setGroupWithOffer(session: Session, offer: GroupWithOffer): void {
	offers.set(session, offer);
}

export function groupWithOfferFor(session: Session, lightId: string): GroupWithOffer | null {
	const offer = offers.get(session);
	return offer?.lightId === lightId ? offer : null;
}

export function reconcileGroupWithOffer(session: Session, selectedLightId: string | null): void {
	if (offers.get(session)?.lightId !== selectedLightId) offers.delete(session);
}
