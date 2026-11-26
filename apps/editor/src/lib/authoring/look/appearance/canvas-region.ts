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
type CardKeys = Pick<Canvas, 'scene' | 'proposals'>;
type AlignKeys = Pick<Canvas, 'alignHiddenWallIds'>;
type RepairKeys = Pick<Canvas, 'onFinishOutcome' | 'repairAffectedTargets'>;

export function createAppearanceCanvasRegion(input: {
	readonly card: { canvasKeys(snapshot: StageReadSnapshot): CardKeys };
	readonly align: { readonly canvasKeys: AlignKeys };
	readonly repair: { readonly canvasKeys: RepairKeys };
}) {
	return (snapshot: StageReadSnapshot) => {
		const card = input.card.canvasKeys(snapshot);
		return contribution<'appearance', 'canvas'>()({
			get scene() {
				return card.scene;
			},
			get proposals() {
				return card.proposals;
			},
			get alignHiddenWallIds() {
				return input.align.canvasKeys.alignHiddenWallIds;
			},
			onFinishOutcome: input.repair.canvasKeys.onFinishOutcome,
			get repairAffectedTargets() {
				return input.repair.canvasKeys.repairAffectedTargets;
			},
		});
	};
}
