/**
 * TD-9 — the one transport for a Save capture that outlives the sign-in redirect.
 *
 * The capture is not a document and not an automatic write: it records the exact
 * operation the creator chose, the precondition it was minted against and the
 * source bytes it would save. The platform persistence module owns the
 * session-storage slot and its validation; this module is the Save-owned seam the
 * route host may reach, so the host's write budget stays explicit instead of
 * growing raw helper calls. Reading is not a write and never resumes anything;
 * only the creator's explicit Resume action replays the captured Save.
 */
import {
	clearPendingCloudSave,
	readPendingCloudSave,
	writePendingCloudSave,
	type PendingCloudSaveResult
} from '$lib/platform/project-persistence';
import type { SaveRequest } from '@portfolio/project-model/save';

/** Persist the exact capture before the auth redirect. */
export function persistPendingCapture(save: SaveRequest): boolean {
	return writePendingCloudSave(save);
}

/** Read the capture a return visit may offer; never applies it. */
export function readPendingCapture(): PendingCloudSaveResult {
	return readPendingCloudSave();
}

/** Drop the capture once the creator resolved it (completed, conflicted or dismissed). */
export function discardPendingCapture(): void {
	clearPendingCloudSave();
}
