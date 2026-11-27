/**
 * The keyboard wiring module.
 *
 * The host passes the Escape handlers and its
 * own live reads; the module keeps the long key-map argument literal out of the
 * host body.
 */
import { createStageKeyboard } from '../../../stage/route/stage-keyboard';
import type { StageShellState } from '../../../stage/route/stage-shell-state.svelte';

type KeyboardInput = Parameters<typeof createStageKeyboard>[0];
type AppearanceRungs = Pick<
	KeyboardInput,
	| 'cancelFinishGesture'
	| 'dismissAlign'
	| 'dismissMaterialEditor'
	| 'dismissMaterialImport'
	| 'dismissRepairDrawer'
	| 'dismissPaint'
	| 'paintKey'
>;

export type StageKeyboardWiring = Omit<
	KeyboardInput,
	| 'libraryOpen'
	| 'toggleLibrary'
	| 'liftActive'
	| 'putBackLift'
	| 'sliceDraftActive'
	| 'cancelSliceDraft'
	| 'sliceActive'
	| 'putBackSlice'
	| 'openCard'
	| 'pendingDelete'
	| 'clearPendingDelete'
	| 'refreshHostTools'
	| 'paletteOpen'
	| 'closePalette'
	| 'activeWorldTool'
	| 'clearWorldTool'
	| 'worldPlateOpen'
	| 'closeWorldPlate'
	| 'furnishStripOpen'
	| 'closeFurnishStrip'
	| 'task'
	| 'armedHostTool'
	| 'measureTool'
	| 'eraserTool'
	| 'paintTool'
	| 'clearEraseHover'
	| 'clearPaintHover'
	| 'cancelFinishGesture'
	| 'dismissAlign'
	| 'dismissMaterialEditor'
	| 'dismissMaterialImport'
	| 'dismissRepairDrawer'
	| 'dismissPaint'
	| 'paintKey'
> & {
	readonly shell: StageShellState;
	readonly appearanceRungs: AppearanceRungs;
	readonly libraryEscape: Pick<KeyboardInput, 'libraryOpen' | 'toggleLibrary'>;
	readonly readingsEscape: Pick<
		KeyboardInput,
		| 'liftActive'
		| 'putBackLift'
		| 'sliceDraftActive'
		| 'cancelSliceDraft'
		| 'sliceActive'
		| 'putBackSlice'
	>;
};

export function wireStageKeyboard(input: StageKeyboardWiring) {
	return createStageKeyboard({
		featureEscape: input.featureEscape,
		artworkEscape: input.artworkEscape,
		previewActive: input.previewActive,
		closePreview: input.closePreview,
		activeLayer: input.activeLayer,
		pressing: input.pressing,
		dragMode: input.dragMode,
		facade: input.facade,
		reducedMotion: input.reducedMotion,
		nowSeconds: input.nowSeconds,
		submit: input.submit,
		setReading: input.setReading,
		zoom: input.zoom,
		fit: input.fit,
		pan: input.pan,
		pressDockSlot: input.pressDockSlot,
		requestDelete: input.requestDelete,
		openCard: () => input.shell.setCardOpen(true),
		pendingDelete: () => input.shell.pendingDelete !== null,
		clearPendingDelete: () => {
			input.shell.setPendingDelete(null);
			input.shell.setNotice('');
		},
		...input.appearanceRungs,
		interrupt: input.interrupt,
		task: () => input.shell.task,
		closeTask: input.closeTask,
		armedHostTool: () => input.shell.armedHostTool,
		measureTool: () => input.shell.measureTool,
		eraserTool: () => input.shell.eraserTool,
		paintTool: () => input.shell.paintTool,
		clearEraseHover: () => input.shell.setEraseHover(null),
		clearPaintHover: () => input.shell.setPaintHover(null),
		refreshHostTools: () => input.shell.refreshHostTools(),
		armedDockKey: input.armedDockKey,
		paletteOpen: () => input.shell.paletteOpen,
		closePalette: () => input.shell.setPaletteOpen(false),
		...input.libraryEscape,
		activeWorldTool: () => input.shell.activeWorldTool,
		clearWorldTool: () => {
			input.shell.setLibraryOpen(false);
			input.shell.setActiveWorldTool('select');
		},
		worldPlateOpen: () => input.shell.worldPlateOpen,
		closeWorldPlate: () => input.shell.setWorldPlateOpen(false),
		furnishStripOpen: () => input.shell.furnishStripOpen,
		closeFurnishStrip: () => input.shell.setFurnishStripOpen(false),
		toolbarFocused: input.toolbarFocused,
		focusSelectKey: input.focusSelectKey,
		lens: input.lens,
		selectionPresent: input.selectionPresent,
		closeSelection: input.closeSelection,
		leaveStudio: input.leaveStudio,
		...input.readingsEscape,
		setCutawayHeld: input.setCutawayHeld,
		groupSelection: input.groupSelection,
	});
}
