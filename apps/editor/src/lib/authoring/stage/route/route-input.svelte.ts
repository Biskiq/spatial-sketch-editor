import { placeCopyFromSearch, studioEntryFromSearch } from '$lib/platform/studio-entry';
import { bootIntentFromSearch } from '../boot-state';

export function createRouteInput(
	page: () => { readonly params: Record<string, string | undefined>; readonly url: URL },
) {
	const current = page();
	const search = current.url.searchParams;

	// The project session consumes the address actually shown after Studio has
	// used shallow routing. SvelteKit's page URL keeps the original address.
	function url(): URL {
		if (typeof window === 'undefined') return page().url;
		const shown = new URL(window.location.href);
		return shown.pathname === page().url.pathname ? shown : page().url;
	}

	return {
		projectId: decodeURIComponent(current.params.projectId ?? ''),
		intent: bootIntentFromSearch(search),
		studioEntry: studioEntryFromSearch(search),
		placeCopyItem: placeCopyFromSearch(search),
		url,
	};
}
