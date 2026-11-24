/**
 * The keyboard wiring module.
 *
 * The host passes the Escape groups as owners (Library, Sky, readings) and its
 * own live reads; the module keeps the long key-map argument literal out of the
 * host body.
 */
import { createStageKeyboard } from '../../../stage/route/stage-keyboard';
import type { StageShellState } from '../../../stage/route/stage-shell-state.svelte';

type KeyboardInput = Parameters<typeof createStageKeyboard>[0];

export type StageKeyboardWiring = Omit<
	KeyboardInput,
	| 'libraryOpen'
	| 'toggleLibrary'
	| 'dismissSky'
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
> & {
	readonly shell: StageShellState;
	readonly libraryEscape: Pick<KeyboardInput, 'libraryOpen' | 'toggleLibrary'>;
	readonly skyEscape: Pick<KeyboardInput, 'dismissSky'>;
	readonly readingsEscape: Pick<
		KeyboardInput,
		'liftActive' | 'putBackLift' | 'sliceDraftActive' | 'cancelSliceDraft' | 'sliceActive' | 'putBackSlice'
	>;
};

export function wireStageKeyboard(input: StageKeyboardWiring) {
	return createStageKeyboard({
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
		clearPendingDelete: () => { input.shell.setPendingDelete(null); input.shell.setNotice(''); },
		cancelFinishGesture: input.cancelFinishGesture,
		interrupt: input.interrupt,
		task: () => input.shell.task,
		closeTask: input.closeTask,
		armedHostTool: () => input.shell.armedHostTool,
		measureTool: () => input.shell.measureTool,
		eraserTool: () => input.shell.eraserTool,
		paintTool: () => input.shell.paintTool,
		clearEraseHover: () => input.shell.setEraseHover(null),
		clearPaintHover: () => input.shell.setPaintHover(null),
		paintKey: input.paintKey,
		dismissAlign: input.dismissAlign,
		dismissMaterialEditor: input.dismissMaterialEditor,
		dismissMaterialImport: input.dismissMaterialImport,
		dismissRepairDrawer: input.dismissRepairDrawer,
		dismissPaint: input.dismissPaint,
		refreshHostTools: () => input.shell.refreshHostTools(),
		armedDockKey: input.armedDockKey,
		paletteOpen: () => input.shell.paletteOpen,
		closePalette: () => input.shell.setPaletteOpen(false),
		...input.libraryEscape,
		activeWorldTool: () => input.shell.activeWorldTool,
		clearWorldTool: () => { input.shell.setLibraryOpen(false); input.shell.setActiveWorldTool('select'); },
		worldPlateOpen: () => input.shell.worldPlateOpen,
		closeWorldPlate: () => input.shell.setWorldPlateOpen(false),
		furnishStripOpen: () => input.shell.furnishStripOpen,
		closeFurnishStrip: () => input.shell.setFurnishStripOpen(false),
		toolbarFocused: input.toolbarFocused,
		focusSelectKey: input.focusSelectKey,
		...input.skyEscape,
		lens: input.lens,
		selectionPresent: input.selectionPresent,
		closeSelection: input.closeSelection,
		leaveStudio: input.leaveStudio,
		...input.readingsEscape,
		setCutawayHeld: input.setCutawayHeld
	});
}
