/**
 * The remote document the Head double offers through *Reload remote*.
 *
 * The default offer cannot admit — the route's preservation branch (report, keep
 * the mounted project and its saved base) is what most route regressions need.
 * A test that has to exercise an **admitted** reload sets an offer whose
 * document is a current unit envelope and calls `resetReloadOffer` afterwards,
 * so the suite cannot leak one test's remote copy into the next.
 */
import type { ReloadOffer } from '$lib/authoring/save/save-state';

// A remote row that cannot be admitted: the route must report it and keep the
// mounted project, not install the offer.
const refusing: ReloadOffer = {
	kind: 'reload',
	projectId: 'project-1',
	document: { nope: true },
	savedBaseToken: 'remote-token',
	savedRevision: { projectId: 'project-1', revisionId: 'remote-revision' },
	savedSourceContentId: 'remote-content'
};

let offered: ReloadOffer = refusing;

export function reloadOffer(): ReloadOffer {
	return offered;
}

export function setReloadOffer(offer: ReloadOffer): void {
	offered = offer;
}

export function resetReloadOffer(): void {
	offered = refusing;
}
