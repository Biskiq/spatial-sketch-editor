import type { FeatureLifecycle } from '../../workspace/protocol';
import type { StageKeyboard } from './stage-keyboard';

export function createStageWindowListeners(input: {
	readonly keyboard: StageKeyboard;
	readonly suspendSnap: (suspended: boolean) => void;
	readonly lifecycle: () => Pick<FeatureLifecycle, 'windowBlur'>;
}) {
	function onKey(event: KeyboardEvent): void {
		if (event.defaultPrevented) return;
		if (event.altKey) input.suspendSnap(true);
		input.keyboard.handleKey(event);
	}

	function onReleaseSnap(event: KeyboardEvent): void {
		if (event.key === 'Alt') input.suspendSnap(false);
		input.keyboard.handleKeyUp(event);
	}

	function onWindowBlur(): void {
		input.lifecycle().windowBlur();
	}

	return {
		install(): void {
			window.addEventListener('keydown', onKey);
			window.addEventListener('keyup', onReleaseSnap);
			window.addEventListener('blur', onWindowBlur);
		},
		remove(): void {
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('keyup', onReleaseSnap);
			window.removeEventListener('blur', onWindowBlur);
		},
	};
}
