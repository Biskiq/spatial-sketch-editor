/**
 * The reactive cell a component test mutates to change a prop.
 *
 * Runes are compiled only in `.svelte.ts` modules, so the cell lives here and the
 * test passes a getter over it as the prop. Assigning `value` is a real prop
 * change: the effect under test re-runs exactly as it does when the route's
 * reading store changes.
 */
export function liftCell(initial: readonly string[]) {
	let value = $state<readonly string[]>(initial);
	return {
		get value(): readonly string[] {
			return value;
		},
		set value(next: readonly string[]) {
			value = next;
		}
	};
}
