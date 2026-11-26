/**
 * The Paint tray's own session state (T2.S8 U2): which tab is showing, whether
 * the tray is expanded and whether the floating *Paint colour* picker is open. None of it is
 * project data or a preference; it resets when Paint is left.
 */
export type PaintTrayTab = 'colours' | 'materials';

export function createPaintTrayState() {
	let tab = $state<PaintTrayTab>('materials');
	let expanded = $state(false);
	let wheelOpen = $state(false);

	return {
		get tab() {
			return tab;
		},
		get expanded() {
			return expanded;
		},
		get wheelOpen() {
			return wheelOpen;
		},
		setTab(next: PaintTrayTab): void {
			tab = next;
			wheelOpen = false;
		},
		/** T flips tabs, but only when Colours exists. */
		toggleTab(colourEnabled: boolean): void {
			tab = colourEnabled && tab === 'materials' ? 'colours' : 'materials';
			wheelOpen = false;
		},
		toggleExpanded(): void {
			expanded = !expanded;
		},
		/**
		 * *Paint colour*: a floating picker anchored on *Custom colour*. It opens
		 * whether or not the tray is expanded and never changes the expansion.
		 */
		setWheelOpen(open: boolean): void {
			wheelOpen = open;
		},
		/**
		 * One Escape rung: the wheel, then the expansion. Returns whether it closed
		 * something, so the dismiss ladder moves on to the dropper and the tool.
		 */
		dismiss(): boolean {
			if (wheelOpen) {
				wheelOpen = false;
				return true;
			}
			if (expanded) {
				expanded = false;
				return true;
			}
			return false;
		},
		reset(): void {
			expanded = false;
			wheelOpen = false;
		},
	};
}

export type PaintTrayState = ReturnType<typeof createPaintTrayState>;
