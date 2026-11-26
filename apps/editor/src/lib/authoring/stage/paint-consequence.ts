/**
 * The armed Paint tool's one-line consequence (T2.S8 U2): what the next press
 * does, read on the Stage's view bar as in the accepted appearance prototype.
 * Pure wording over the painter's candidate and stroke; it owns no state.
 */
import type { StagePaintCandidate, StagePaintStroke } from './stage-painter';

export type PaintConsequence = {
	/** The bar's tool word: the dropper samples, everything else paints. */
	readonly tool: 'Paint' | 'Sample';
	readonly text: string;
	readonly refused: boolean;
};

export function paintConsequence(input: {
	readonly stroke: StagePaintStroke | null;
	readonly dropper: boolean;
	readonly picked: boolean;
	readonly tab: 'colours' | 'materials';
	readonly candidate: StagePaintCandidate | null;
}): PaintConsequence {
	const { stroke, dropper, picked, tab, candidate } = input;
	const tool = dropper ? 'Sample' : 'Paint';
	if (stroke !== null && stroke.count > 0) {
		const noun =
			stroke.kind === 'surface'
				? stroke.count === 1
					? 'surface'
					: 'surfaces'
				: stroke.count === 1
					? 'object'
					: 'objects';
		return { tool, text: `${stroke.count} ${noun} · release to paint`, refused: false };
	}
	if (dropper) return { tool, text: 'Click to sample a Finish', refused: false };
	if (!picked)
		return {
			tool,
			text: tab === 'colours' ? 'Choose a colour' : 'Choose a material',
			refused: false,
		};
	if (candidate?.refusal) return { tool, text: candidate.refusal, refused: true };
	if (candidate?.consequence) return { tool, text: candidate.consequence, refused: false };
	return { tool, text: 'Point at a surface or an object', refused: false };
}
