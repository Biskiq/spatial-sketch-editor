/**
 * The canonical deletion disclosure for one Wall.
 *
 * The same plan the acceptance runs, so the words the creator reads and the
 * change that lands cannot disagree. The answer is remembered per content
 * revision and Wall; the cache is presentation state, never authored.
 */
import { mintLayoutIdCapture } from '@portfolio/layout-core/plan';
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { stageEnvelope, type StageAdapterContext } from '$lib/authoring/stage/stage-adapter-host';
import { planWallDeletion, type WallDeletionPreview } from './drawing-planners';
import { layoutSurfaceLineageConsequence } from './precision';

export function layoutDeletionPreview(input: {
	readonly context: StageAdapterContext;
	readonly document: LayoutDocumentWallFirst;
	readonly levelId: string;
	readonly deletionDisclosures: Map<string, WallDeletionPreview>;
	readonly wallId: string;
}): WallDeletionPreview {
	const { context, document, levelId, deletionDisclosures, wallId } = input;
	const key = `${context.snapshot.sourceContentId}\u0000${wallId}`;
	const remembered = deletionDisclosures.get(key);
	if (remembered !== undefined) return remembered;
	const preview = planWallDeletion({
		document,
		wallId,
		capture: mintLayoutIdCapture(),
		levelId,
	});
	const disclosed =
		preview.kind === 'planned'
			? (() => {
					const lineage = layoutSurfaceLineageConsequence({
						source: stageEnvelope(context.snapshot),
						beforeLayout: document,
						afterLayout: preview.document,
						lineage: preview.surfaceLineage,
					});
					return lineage === 'No competing surface Finishes.'
						? preview
						: { ...preview, summary: `${preview.summary} ${lineage}` };
				})()
			: preview;
	if (deletionDisclosures.size >= 32) {
		const oldest = deletionDisclosures.keys().next().value;
		if (oldest !== undefined) deletionDisclosures.delete(oldest);
	}
	deletionDisclosures.set(key, disclosed);
	return disclosed;
}
