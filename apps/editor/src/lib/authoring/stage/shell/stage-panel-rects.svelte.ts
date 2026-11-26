export function createStagePanelRects() {
	let panel = $state.raw<DOMRectReadOnly | null>(null);
	let stage = $state.raw<DOMRectReadOnly | null>(null);
	let dock = $state.raw<DOMRectReadOnly | null>(null);
	let fixed = $state.raw<readonly DOMRectReadOnly[]>([]);
	return {
		get fixed() {
			return fixed;
		},
		setFixed(value: readonly DOMRectReadOnly[]) {
			fixed = value;
		},
		get panel() {
			return panel;
		},
		get stage() {
			return stage;
		},
		get dock() {
			return dock;
		},
		setPanel(value: DOMRectReadOnly | null) {
			panel = value;
		},
		setStage(value: DOMRectReadOnly) {
			stage = value;
		},
		setDock(value: DOMRectReadOnly | null) {
			dock = value;
		},
	};
}
export type StagePanelRects = ReturnType<typeof createStagePanelRects>;
