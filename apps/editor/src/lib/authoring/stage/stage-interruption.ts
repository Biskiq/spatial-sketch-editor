/** Reasons a live Stage press can be interrupted by the host environment. */
export type StageInterruptionReason = 'pointercancel' | 'lostpointercapture' | 'blur' | 'hidden' | 'second-pointer' | 'escape' | 'lens-change' | 'reading-change' | 'replacement';

/** One installation per Stage mount; it does not cancel open multi-step proposals. */
export function installStageInterruptions(
	windowTarget: Pick<Window, 'addEventListener' | 'removeEventListener'>,
	documentTarget: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>,
	interrupt: (reason: StageInterruptionReason) => void
): () => void {
	const blur = () => interrupt('blur');
	const visibility = () => { if (documentTarget.visibilityState === 'hidden') interrupt('hidden'); };
	windowTarget.addEventListener('blur', blur);
	documentTarget.addEventListener('visibilitychange', visibility);
	return () => {
		windowTarget.removeEventListener('blur', blur);
		documentTarget.removeEventListener('visibilitychange', visibility);
	};
}
