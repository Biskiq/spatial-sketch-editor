/**
 * A reactive cell for component tests that must re-provide props.
 *
 * The Stage host re-renders its instrument home with a fresh `StageAdapterServices`
 * whenever contributions change; a test that only mounts once cannot exercise
 * that path. A getter over this cell is a real dependency, so assigning `value`
 * re-renders the mounted component exactly as the host's own update does.
 */
export function reactiveCell<T>(initial: T) {
	let value = $state(initial);
	return {
		get value(): T {
			return value;
		},
		set value(next: T) {
			value = next;
		}
	};
}
