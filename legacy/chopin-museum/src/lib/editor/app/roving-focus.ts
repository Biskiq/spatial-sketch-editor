/**
 * #39/#40 (§23) — the editor shell's one roving-focus model.
 *
 * Plain buttons in a strip (`role="tablist"`) and plain buttons in a popover
 * (`role="menu"`, `role="menuitemradio"`) are both "one tab stop plus arrow
 * keys", and both were previously reachable only by clicking. The model lives
 * here so the behaviour cannot drift between the Navigator's Hierarchy | Assets
 * row, the Asset library's four sections, and the Project Head popovers.
 *
 * The axis is explicit rather than inferred: a horizontal strip moves on
 * Left/Right, a vertical popover moves on Up/Down, and neither accepts the
 * other's keys (a strip that answered Down would swallow the keystroke the
 * surface below it wants).
 *
 * Returns the index to focus/activate, or `null` when the key is not this
 * control's business, so the caller can let it through untouched.
 */
export type RovingAxis = 'horizontal' | 'vertical';

export function resolveRovingIndex(
	count: number,
	currentIndex: number,
	key: string,
	axis: RovingAxis
): number | null {
	if (count <= 0) return null;
	const nextKey = axis === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
	const previousKey = axis === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
	switch (key) {
		case nextKey:
			return (currentIndex + 1 + count) % count;
		case previousKey:
			return (currentIndex - 1 + count) % count;
		case 'Home':
			return 0;
		case 'End':
			return count - 1;
		default:
			return null;
	}
}

/** Roving `tabindex`: only the selected member is a tab stop. */
export function tablistTabIndex(index: number, selectedIndex: number): 0 | -1 {
	return index === selectedIndex ? 0 : -1;
}
