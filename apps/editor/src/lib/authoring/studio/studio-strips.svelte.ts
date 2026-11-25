import type { StudioController } from './studio-controller.svelte';
import type { StudioLens, StudioRootView, StudioScopeView } from './studio-view';

/**
 * The Studio strips' projections.
 *
 * The entry composes them; the controller stays the only writer. Both views are
 * null while Preview is open or the World workspace is not active, which is the
 * base route's mount condition for the Studio strips.
 */
export function createStudioStrips(input: {
	readonly controller: () => StudioController | undefined;
	readonly previewing: () => boolean;
	readonly lens: () => StudioLens;
}) {
	const scope = $derived.by((): StudioScopeView | null => {
		const studio = input.controller();
		if (studio === undefined || !studio.active || input.previewing() || input.lens() !== 'world') return null;
		return {
			phase: studio.phase,
			origin: studio.origin,
			context: studio.context,
			name: studio.rootName,
			rootCount: studio.roots.length,
			onContext: (next) => studio.setContext(next),
			onNewObject: () => studio.newObjectHere(),
			onChoose: () => studio.openChooser(),
			onBackToWorld: () => studio.backToWorld(),
			onBackToProjects: () => studio.backToProjects(),
			onOpenInWorld: () => studio.openInWorld(),
			onPlaceCopy: () => void studio.placeCopyInWorld(),
			placingCopy: studio.placingCopy
		};
	});

	const root = $derived.by((): StudioRootView | null => {
		const studio = input.controller();
		if (studio === undefined || !studio.active || input.previewing() || input.lens() !== 'world') return null;
		return {
			phase: studio.phase,
			roots: studio.roots,
			origin: studio.origin,
			creating: studio.creating,
			onChoose: (id) => studio.chooseRoot(id),
			onOpenChooser: () => studio.openChooser(),
			onNewObject: () => studio.newObjectHere(),
			onBackToWorld: () => studio.backToWorld(),
			onBackToProjects: () => studio.backToProjects(),
			onOpenInWorld: () => studio.openInWorld(),
			onCancelCreation: () => studio.cancelCreation()
		};
	});

	return {
		get scope() { return scope; },
		get root() { return root; }
	};
}
