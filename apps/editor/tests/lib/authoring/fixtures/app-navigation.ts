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
