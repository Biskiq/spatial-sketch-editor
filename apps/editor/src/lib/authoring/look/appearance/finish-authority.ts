import { createFinishAuthoring, type FinishAuthoring } from '../finish-authoring.svelte';

type FinishesInput = Parameters<typeof createFinishAuthoring>[0];

/**
 * Appearance's one Finish authority.
 *
 * The retry projection reads the authority's own open issues, so it belongs
 * beside the construction rather than in the feature entry.
 */
export function createAppearanceFinishAuthority(
	input: Omit<FinishesInput, 'retryTextures'>,
): FinishAuthoring {
	let finishes!: FinishAuthoring;
	finishes = createFinishAuthoring({
		...input,
		retryTextures: () => {
			for (const issue of finishes.issues.open) {
				if (issue.assetId !== null) input.retryTexture?.(`project-asset://${issue.assetId}`);
			}
		},
	});
	return finishes;
}
