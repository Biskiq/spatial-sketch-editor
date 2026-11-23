/** Deeply reactive props for a mounted component, so a test can change them after mount. */
export function reactiveProps<T extends Record<string, unknown>>(initial: T): T {
	const props = $state(initial);
	return props;
}
