import { createLibraryDraftSession } from './appearance/library-draft-session.svelte';
import { createAppearanceImportSession } from './appearance/import-session.svelte';
import { createCardSession } from './appearance/card-session.svelte';
import { createPaintSession } from './appearance/paint-session.svelte';
import { createAlignSession } from './appearance/align-session.svelte';
import { createRepairSession } from './appearance/repair-session.svelte';
import { createAppearanceOperations } from './appearance/operations';
import { contribution } from '../workspace/region-ownership';
import type { StageReadSnapshot } from '../stage/accepted-read';

/**
 * Appearance: Finish Card and Paint, Import and the Library Draft, Align,
 * Repair and the ordered end of all of them.
 *
 * Canonical writers: F4 planners through the adapter for Finish edits; the
 * project session for the repair and import acceptance paths; the Card's own
 * session for previews and gestures. This entry holds no state of its own.
 */
export type AppearanceDependencies = {
	readonly card: Omit<Parameters<typeof createCardSession>[0], 'draftPreview'>;
	readonly draft: Parameters<typeof createLibraryDraftSession>[0];
	readonly materialImport: Omit<Parameters<typeof createAppearanceImportSession>[0], 'previewing' | 'lens'>;
	readonly paint: Omit<Parameters<typeof createPaintSession>[0], 'finishTileSource' | 'endLibraryDraft'>;
	readonly align: Parameters<typeof createAlignSession>[0];
	readonly repair: Parameters<typeof createRepairSession>[0];
};

export function createAppearanceFeature(deps: AppearanceDependencies) {
	const draft = createLibraryDraftSession(deps.draft);
	const card = createCardSession({ ...deps.card, draftPreview: draft.draftPreview });
	const paint = createPaintSession({
		...deps.paint,
		finishTileSource: draft.finishTileSource,
		endLibraryDraft: draft.endLibraryDraft
	});
	const materialImport = createAppearanceImportSession({
		...deps.materialImport,
		previewing: deps.paint.previewing,
		lens: deps.align.lens
	});
	const align = createAlignSession(deps.align);
	const repair = createRepairSession(deps.repair);
	const operations = createAppearanceOperations({
		finishes: deps.card.finishes,
		lens: deps.align.lens,
		repair,
		cancelImport: materialImport.cancel
	});
	return {
		id: 'appearance' as const,
		/** Appendix A row 17: the draft swap and the project issue reset. */
		attachAuthoring: () => {
			draft.attachGuards();
			repair.attachAuthoring();
		},
		/** Appendix A row 27: Align ownership, then its region reframe. */
		attachAlign: align.attach,
		lifecycle: {
			interruptForReplacement: {
				'end-operations-no-camera': operations.endNoCamera,
				'reset-issues': repair.reset
			},
			historyStep: { 'cancel-card-gesture': card.cancelCardGesture },
			readingChange: { 'cancel-card-gesture': card.cancelCardGesture },
			settlePending: { 'cancel-card-gesture': card.cancelCardGesture },
			leaveLens: { 'end-operations-restore-camera': operations.endForLens },
			windowBlur: { 'cancel-card-gesture': card.cancelCardGesture },
			leaveProject: { 'cancel-image': operations.cancelImage },
			dispose: {
				'end-operations-no-camera': operations.endNoCamera,
				'reset-issues': repair.reset
			}
		},
		ports: {
			adapter: card.adapter,
			finishTileSource: draft.finishTileSource,
			dismissMaterialEditor: draft.dismissMaterialEditor,
			importMaterial: materialImport.start,
			cancelImport: materialImport.cancel,
			dismissMaterialImport: materialImport.dismissMaterialImport,
			cancelGesture: card.cancelGesture,
			paintKey: paint.paintKey,
			dismissPaint: paint.dismissPaint,
			dismissAlign: align.dismiss,
			dismissRepairDrawer: repair.dismiss,
			endOperations: operations.endOperations,
			alignCutaway: align.cutaway,
			alignFraming: align.framing
		},
		regions: {
			/**
			 * Appearance's canvas keys span three sub-owners, so the entry composes
			 * the one contribution the region ownership type requires.
			 */
			regionsCanvas: (snapshot: StageReadSnapshot) =>
				contribution<'appearance', 'canvas'>()({
					...card.canvasKeys(snapshot),
					...align.canvasKeys,
					...repair.canvasKeys
				}),
			head: repair.head,
			toolbars: paint.toolbars,
			get importSheet() { return materialImport.props; },
			get align() { return align.props; },
			get materialEditor() { return draft.materialEditor; },
			get paint() { return paint.tray; },
			get repair() { return repair.props; },
			get finishShelf() { return draft.shelf; },
			get ownsPaintPlate() { return paint.ownsPlate; },
			get paintChip() { return paint.chip; },
			get planAppearance() { return align.planAppearance; }
		}
	};
}
