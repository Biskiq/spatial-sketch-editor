import { createLibraryHost } from './library-host.svelte';

export type LibraryDependencies = Parameters<typeof createLibraryHost>[0];

export function createLibraryFeature(deps: LibraryDependencies) {
	const library = createLibraryHost(deps);
	return {
		id: 'library' as const,
		view: library.view,
		ports: library.ports,
		escape: library.escape,
	};
}
