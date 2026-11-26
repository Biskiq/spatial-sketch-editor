import { advanceViewport } from './state';
import type { ViewportCameraState, ViewportSourceRebase } from './types';

/**
 * Move the session to a new current source.
 *
 * An install is not a camera move. The output, session, settled reading, pose and
 * target-plane scale are carried over exactly, so the host re-acquires inspection at
 * the current pose and the view neither moves nor refits. Identical content is
 * `unchanged` (the Undo-to-identical-contents case), and an in-flight flip settles to
 * its declared endpoint first so a content change never leaves a half-flip behind.
 * Ownership itself is not rebased here: the ticket protocol owns the claim.
 */
export function rebaseViewportSource(
	state: ViewportCameraState,
	sourceRevision: unknown,
): ViewportSourceRebase {
	if (
		typeof sourceRevision !== 'string' ||
		sourceRevision.trim() === '' ||
		/\s/.test(sourceRevision)
	) {
		return {
			kind: 'refused',
			state,
			reason: 'invalid-source-revision',
			message: 'a source revision must be a nonempty opaque identity',
		};
	}
	if (sourceRevision === state.sourceRevision) return { kind: 'unchanged', state };
	// An infinite clock is how "settle it now" reads through the one settling rule.
	const settled = advanceViewport(state, Number.POSITIVE_INFINITY);
	return {
		kind: 'rebased',
		state: { ...settled, sourceRevision },
		previousSourceRevision: state.sourceRevision,
		posePreserved: true,
	};
}
