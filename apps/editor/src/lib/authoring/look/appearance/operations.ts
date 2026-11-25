import type { StageLens } from '../../stage/stage-session';
import type { FinishAuthoring } from '../finish-authoring.svelte';

/**
 * The ordered end of Appearance's operations: Card gesture, Align, the material
 * Editor, the Library draft, the image picker, the repair pickers, Import and
 * the drawer. Align restores its entry standpoint first when asked, and may
 * refuse; steps that already ran are not rolled back (X9 §4.4).
 */
export function createAppearanceOperations(input: {
	readonly finishes: () => FinishAuthoring;
	readonly lens: () => StageLens;
	readonly repair: { close(): void };
	readonly cancelImport: (restoreCamera: boolean) => void;
}) {
	function endOperations(restoreCamera: boolean): boolean {
		const finishes = input.finishes();
		finishes.card.cancel();
		if (restoreCamera && finishes.align.active && !finishes.align.putBack(false)) return false;
		if (!restoreCamera) finishes.align.clear();
		finishes.editor.close(false);
		finishes.cancelLibraryDraft();
		finishes.cancelImage();
		finishes.issues.cancelRepairs();
		input.cancelImport(false);
		input.repair.close();
		return true;
	}

	function endNoCamera(): void {
		endOperations(false);
	}

	function endRestoreCamera(): boolean {
		return endOperations(true);
	}

	/** The lens-leave step keeps its condition verbatim inside its owner. */
	function endForLens(next: StageLens): boolean | void {
		if (next !== 'world' && input.lens() === 'world') return endOperations(true);
	}

	function cancelImage(): void {
		input.finishes().cancelImage();
	}

	return { endOperations, endNoCamera, endRestoreCamera, endForLens, cancelImage };
}
