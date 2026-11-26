import { createLibraryDraftSession } from './appearance/library-draft-session.svelte';
import { createAppearanceImportSession } from './appearance/import-session.svelte';
import { createCardSession } from './appearance/card-session.svelte';
import { createPaintSession } from './appearance/paint-session.svelte';
import { createAlignSession } from './appearance/align-session.svelte';
import { createRepairSession } from './appearance/repair-session.svelte';
import { createAppearanceOperations } from './appearance/operations';
import { createAppearanceFinishAuthority } from './appearance/finish-authority';
import { createAppearanceCanvasRegion } from './appearance/canvas-region';
import { createPrivateLibrarySession } from '../library/private-library.svelte';
import type { FinishTileSource } from '$lib/render/materials/finish-tiles.svelte';

/**
 * Appearance: Finish Card and Paint, Import and the Library Draft, Align,
 * Repair and the ordered end of all of them.
 *
 * Canonical writers: F4 planners through the adapter for Finish edits; the
 * project session for the repair and import acceptance paths; the Card's own
 * session for previews and gestures. This entry holds no state of its own.
 */
import type { createFinishAuthoring } from './finish-authoring.svelte';
type FinishesInput = Parameters<typeof createFinishAuthoring>[0];

export type AppearanceDependencies = {
	/** Appearance's one Finish authority; the entry constructs it. */
	readonly finishes: Omit<FinishesInput, 'retryTextures'>;
	readonly card: Omit<Parameters<typeof createCardSession>[0], 'draftPreview' | 'finishes'>;
	readonly draft: Omit<Parameters<typeof createLibraryDraftSession>[0], 'finishes' | 'privateLibrary'>;
	readonly materialImport: Omit<
		Parameters<typeof createAppearanceImportSession>[0],
		'previewing' | 'lens' | 'finishes'
	>;
	readonly paint: Omit<
		Parameters<typeof createPaintSession>[0],
		'finishTileSource' | 'endLibraryDraft' | 'finishes'
	>;
	readonly align: Omit<Parameters<typeof createAlignSession>[0], 'finishes'>;
	readonly repair: Omit<Parameters<typeof createRepairSession>[0], 'finishes'>;
	/** My library's one host-owned picture seam; Save installs a 256 px thumbnail. */
	readonly thumbnailBytes?: (source: FinishTileSource) => Promise<Blob | null>;
};

export function createAppearanceFeature(deps: AppearanceDependencies) {
	const finishes = createAppearanceFinishAuthority(deps.finishes);
	const privateLibrary = createPrivateLibrarySession({
		services: deps.finishes.services,
		onNotice: deps.finishes.onNotice,
		onInserted: (key) => finishes.noteUsedFinish(key),
		armPaint: () => deps.finishes.armPaint({ kind: 'paint' }),
		...(deps.thumbnailBytes === undefined ? {} : { thumbnailBytes: deps.thumbnailBytes }),
	});
	const card = createCardSession({
		...deps.card,
		finishes: () => finishes,
		draftPreview: () => draft.draftPreview(),
	});
	const paint = createPaintSession({
		...deps.paint,
		finishes: () => finishes,
		finishTileSource: (id) => draft.finishTileSource(id),
		endLibraryDraft: () => draft.endLibraryDraft(),
	});
	const draft = createLibraryDraftSession({
		...deps.draft,
		finishes: () => finishes,
		privateLibrary,
	});
	const materialImport = createAppearanceImportSession({
		...deps.materialImport,
		finishes: () => finishes,
		previewing: deps.paint.previewing,
		lens: deps.align.lens,
	});
	const align = createAlignSession({ ...deps.align, finishes: () => finishes });
	const repair = createRepairSession({ ...deps.repair, finishes: () => finishes });
	const canvasRegion = createAppearanceCanvasRegion({ card, align, repair });
	const operations = createAppearanceOperations({
		finishes: () => finishes,
		lens: deps.align.lens,
		repair,
		cancelImport: materialImport.cancel,
	});
	return {
		id: 'appearance' as const,
		lifecycle: {
			interruptForReplacement: {
				'end-operations-no-camera': operations.endNoCamera,
				'reset-issues': repair.reset,
			},
			historyStep: { 'cancel-card-gesture': card.cancelCardGesture },
			readingChange: { 'cancel-card-gesture': card.cancelCardGesture },
			settlePending: { 'cancel-card-gesture': card.cancelCardGesture },
			leaveLens: { 'end-operations-restore-camera': operations.endForLens },
			windowBlur: { 'cancel-card-gesture': card.cancelCardGesture },
			leaveProject: { 'cancel-image': operations.cancelImage },
			dispose: {
				'end-operations-no-camera': operations.endNoCamera,
				'reset-issues': repair.reset,
			},
		},
		rungs: {
			cancelFinishGesture: card.cancelGesture,
			dismissAlign: align.dismiss,
			dismissMaterialEditor: draft.dismissMaterialEditor,
			dismissMaterialImport: materialImport.dismissMaterialImport,
			dismissRepairDrawer: repair.dismiss,
			dismissPaint: paint.dismissPaint,
			paintKey: paint.paintKey,
		},
		ports: {
			finishes: () => finishes,
			privateLibrary: () => privateLibrary,
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
			alignFraming: align.framing,
		},
		regions: {
			regionsCanvas: canvasRegion,
			head: repair.head,
			toolbars: paint.toolbars,
			get importSheet() {
				return materialImport.props;
			},
			get align() {
				return align.props;
			},
			get materialEditor() {
				return draft.materialEditor;
			},
			get paint() {
				return paint.tray;
			},
			get repair() {
				return repair.props;
			},
			get finishShelf() {
				return draft.shelf;
			},
			get ownsPaintPlate() {
				return paint.ownsPlate;
			},
			get paintChip() {
				return paint.chip;
			},
			get planAppearance() {
				return align.planAppearance;
			},
		},
	};
}
