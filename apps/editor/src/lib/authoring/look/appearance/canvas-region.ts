import { contribution, type RegionContribution } from '../../workspace/region-ownership';
import type { StageReadSnapshot } from '../../stage/accepted-read';

/**
 * Appearance's canvas contribution.
 *
 * Appearance's canvas keys span three sub-owners (Card, Align, Repair); the
 * entry injects them so no sub-owner imports a sibling. The result is one
 * member reference the entry can expose without a wrapper method.
 */
type Canvas = RegionContribution<'appearance', 'canvas'>;

export function createAppearanceCanvasRegion(input: {
	readonly card: { canvasKeys(snapshot: StageReadSnapshot): Canvas };
	readonly align: { readonly canvasKeys: Partial<Canvas> };
	readonly repair: { readonly canvasKeys: Partial<Canvas> };
}) {
	return (snapshot: StageReadSnapshot) =>
		contribution<'appearance', 'canvas'>()({
			...input.card.canvasKeys(snapshot),
			...input.align.canvasKeys,
			...input.repair.canvasKeys
		} as Canvas);
}
