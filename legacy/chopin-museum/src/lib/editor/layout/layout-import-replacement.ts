import { decodeLayoutJsonCompatible } from '$lib/layout/layout-codec';
import {
	importLayoutPreviewJson,
	setLayoutPreviewImportError,
	type LayoutPreviewState
} from './layout-preview-state.svelte';

/**
 * P23.6I review — shell-owned Layout import replacement.
 *
 * Preflight with the compatible decoder, confirm once for every recognized
 * Layout format, then mutate. The previous routing let the legacy-only
 * `parseLayoutDocumentJson()` decide UX behavior, so a canonical wall-first
 * v5 document fell into a confirm-free, history-preserving fallback path.
 * That path replaced the document while old cross-document history survived,
 * so a later Undo could reinstall pre-import state.
 *
 * Contract:
 * - unrecognized payload → import error, no mutation, no history clear.
 * - confirm refused → no mutation, no history clear.
 * - successful import → shared history cleared, `onReplaced` fired (the
 *   shell ends the in-flight Wall run there), paste clearing stays with
 *   the caller.
 * `importLayoutPreviewJson()` itself only installs the Layout and its new
 * baseline; it never owns the shared history controller.
 */
export function requestLayoutImportReplacement(input: {
	layoutPreview: LayoutPreviewState;
	json: string;
	confirmReplacement: () => boolean;
	clearSharedHistory: () => void;
	onReplaced?: () => void;
}): boolean {
	const decoded = decodeLayoutJsonCompatible(input.json);
	if (decoded.kind === 'unrecognized') {
		setLayoutPreviewImportError(
			input.layoutPreview,
			decoded.issues[0]?.message ?? 'Invalid layout document'
		);
		return false;
	}
	if (!input.confirmReplacement()) return false;
	const imported = importLayoutPreviewJson(input.layoutPreview, input.json);
	if (!imported) return false;
	input.clearSharedHistory();
	input.onReplaced?.();
	return true;
}
