/** Provides My library to the Finish Card and Library; readers see only the port. */
import { getContext, setContext } from 'svelte';
import type { PrivateLibrarySession } from './private-library.svelte';

export const PRIVATE_LIBRARY_CONTEXT_KEY = Symbol('biskiq.private-library');

export function providePrivateLibrary(session: PrivateLibrarySession): PrivateLibrarySession {
	setContext(PRIVATE_LIBRARY_CONTEXT_KEY, session);
	return session;
}

/** The nearest session, or null where none is provided (a harness, a test). */
export function tryUsePrivateLibrary(): PrivateLibrarySession | null {
	try {
		return getContext<PrivateLibrarySession | undefined>(PRIVATE_LIBRARY_CONTEXT_KEY) ?? null;
	} catch {
		return null;
	}
}
