/**
 * `$app/navigation` test double.
 *
 * Route components import SvelteKit's virtual modules, which do not exist in
 * Vitest's plain Vite graph. `vitest.shared.ts` aliases them to these doubles;
 * a mounted route therefore gets a navigation guard registration rather than an
 * unresolved import.
 */
export function beforeNavigate(_guard: (event: { cancel: () => void }) => void): void {
	// The route registers its unsaved-work guard; the harness never navigates.
}

export const navigations: string[] = [];
export const replaceStates: string[] = [];

export async function goto(url: string): Promise<void> {
	navigations.push(url);
}

export function resetNavigations(): void {
	navigations.length = 0;
}

/**
 * The route consumes `resume-save` and `create=1` with `replaceState`. Record
 * each call so mounted tests can assert the address the route leaves behind
 * without introducing a second navigation source.
 */
export function replaceState(url: string, _state: unknown): void {
	replaceStates.push(url);
}
