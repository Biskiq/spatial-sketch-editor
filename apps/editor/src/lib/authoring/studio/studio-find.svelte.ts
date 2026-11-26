import type { StudioFindView, StudioLens } from './studio-view';
import type { StudioController } from './studio-controller.svelte';

/**
 * What Find knows of Object Studio: the selected form it can open, and Studio's
 * own state. Null outside World, during Preview, so Find never offers Studio
 * where it cannot run.
 */
export function createStudioFind(input: {
	readonly controller: () => StudioController | undefined;
	readonly revision: () => number;
	readonly lens: () => StudioLens;
	readonly previewing: () => boolean;
	readonly selectedEntityId: () => string | null;
	readonly entities: () => readonly { readonly id: string; readonly kind: string }[];
}) {
	const state = $derived.by((): StudioFindView | null => {
		if (input.lens() !== 'world' || input.previewing()) return null;
		void input.revision();
		const studio = input.controller();
		const selectedId = input.selectedEntityId();
		const selectedForm =
			selectedId !== null &&
			input.entities().some((entity) => entity.id === selectedId && entity.kind === 'form');
		return {
			active: studio?.active === true,
			origin: studio?.origin ?? 'world',
			context: studio?.context ?? 'world',
			canEdit: selectedForm && studio?.active !== true,
			rootCount: studio?.roots.length ?? 0,
		};
	});

	return {
		get state() {
			return state;
		},
	};
}
