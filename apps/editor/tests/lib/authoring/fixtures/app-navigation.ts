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

export async function goto(url: string): Promise<void> {
	navigations.push(url);
}

export function resetNavigations(): void {
	navigations.length = 0;
}

/**
 * The route consumes `resume-save` with `replaceState` after considering a
 * draft. The mounted harness owns the URL it is testing, so this is a no-op
 * instead of a second navigation source.
 */
export function replaceState(_url: string, _state: unknown): void {
	// The suite sets `page.url` before each mount and asserts the offer behaviour,
	// not the browser history entry.
}
