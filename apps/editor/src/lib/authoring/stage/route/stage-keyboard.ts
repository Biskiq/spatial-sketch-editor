/**
 * Keyboard routing as a leaf policy.
 *
 * This is the route's keyboard map over the **same** commands the pointer path
 * uses: reading/fit/zoom/pan, dock arming, Finish/Backtrack/Delete, and the
 * palette-first Escape unwind. It is not another gesture owner: it reads the
 * input arbiter's live press state, asks the existing facade intent commands
 * first, and calls the route's named shell commands. Every precedence step the
 * route had is preserved:
 *
 * - an Artwork resize, then an armed placement, owns Escape first;
 * - Preview is an isolated visitor run and only answers Escape;
 * - the Experience posture claims Escape before shared unwinding;
 * - typing in a text field never moves the camera;
 * - a focused control's activation key belongs to that control;
 * - a live direct-manipulation writer owns Tab and printable keys;
 * - a live numeric writer keeps the dock letters and `2`.
 */
import type { StageFacade, StageIntentResult } from '../stage-facade';
import type { StagePostureLayer } from '../stage-adapter-host';
import type { StageTask } from '../stage-session';
import type { StageMeasureController } from '../stage-measure';
import type { StageEraserController } from '../stage-eraser';
import type { StagePaintController } from '../stage-painter';
import {
	readingIntentClockSeconds,
	stageKeyAction,
	stageKeyFromControl,
	stageKeyFromTextEntry,
	type StageDockSlot
} from '../stage-input';
import type { StageInterruptionReason } from '../stage-interruption';
import type { ViewingIntent } from '@portfolio/camera-core';

export type StageKeyboardInput = {
	readonly artworkEscape: () => boolean;
	readonly previewActive: () => boolean;
	readonly closePreview: () => void;
	readonly activeLayer: () => StagePostureLayer | null;
	readonly pressing: () => boolean;
	readonly dragMode: () => 'pan' | 'orbit' | 'adapter' | 'host' | 'slice-draw' | null;
	readonly facade: () => StageFacade | null;
	readonly reducedMotion: () => boolean;
	readonly nowSeconds: () => number;
	readonly submit: (intent: ViewingIntent, clockSeconds: number) => StageIntentResult | null;
	readonly setReading: (reading: '3d' | 'plan') => void;
	readonly zoom: (scale: number) => void;
	readonly fit: () => void;
	readonly pan: (dx: number, dy: number) => void;
	readonly pressDockSlot: (slot: StageDockSlot) => void;
	readonly requestDelete: () => void;
	readonly openCard: () => void;
	readonly pendingDelete: () => boolean;
	readonly clearPendingDelete: () => void;
	/** Esc drops a live Finish Card gesture (preview) before anything else unwinds. */
	readonly cancelFinishGesture?: () => boolean;
	readonly interrupt: (reason: StageInterruptionReason) => void;
	readonly task: () => StageTask | null;
	readonly closeTask: () => void;
	readonly armedHostTool: () => string | null;
	readonly measureTool: () => StageMeasureController | null;
	readonly eraserTool: () => StageEraserController | null;
	readonly paintTool?: () => StagePaintController | null;
	readonly clearEraseHover: () => void;
	readonly clearPaintHover?: () => void;
	/**
	 * Paint's tray keys while Paint is armed: T flips tab, S flips reach, I toggles
	 * the dropper. Returns whether the key was Paint's.
	 */
	readonly paintKey?: (key: 'tab' | 'reach' | 'sample') => boolean;
	/** Paint's Escape rungs before the draft: the wheel, the dropper, then the expansion. */
	readonly dismissPaint?: () => boolean;
	readonly refreshHostTools: () => void;
	readonly armedDockKey: () => { readonly palette?: boolean } | undefined;
	readonly paletteOpen: () => boolean;
	readonly closePalette: () => void;
	readonly libraryOpen: () => boolean;
	readonly toggleLibrary: () => void;
	/** U6 Escape rungs: Align › editor › import › drawers (all after Library, before dropper/tray/draft). */
	readonly dismissAlign?: () => boolean;
	readonly dismissMaterialEditor?: () => boolean;
	readonly dismissMaterialImport?: () => boolean;
	readonly dismissRepairDrawer?: () => boolean;
	readonly activeWorldTool: () => string;
	readonly clearWorldTool: () => void;
	readonly worldPlateOpen: () => boolean;
	readonly closeWorldPlate: () => void;
	/** Furnish's quick strip is open with no tool armed; Escape folds it like a plate. */
	readonly furnishStripOpen?: () => boolean;
	readonly closeFurnishStrip?: () => void;
	/**
	 * Whether keyboard focus sits on a non-Select World dock key or inside a tool
	 * strip that an Escape rung may close. Read before the rung runs.
	 */
	readonly toolbarFocused?: () => boolean;
	/** Move focus to the dock's Select key after Escape returned the editor to Select. */
	readonly focusSelectKey?: () => void;
	readonly dismissSky?: () => boolean;
	readonly lens: () => 'world' | 'experience';
	readonly selectionPresent: () => boolean;
	readonly closeSelection: () => void;
	/**
	 * Object Studio's own rung: after every pending gesture, task and tool has unwound,
	 * Escape leaves a World-entered Studio. Returns whether it left (false: not in
	 * Studio, a standalone Studio whose way out is Back to Projects, or pending work refused).
	 */
	readonly leaveStudio?: () => boolean;
	/** A temporary reading is on (X1: Lift), and Escape puts it back. */
	readonly liftActive: () => boolean;
	readonly putBackLift: () => void;
	/** A drawn draft or handle edit is live; Escape cancels it before the cut. */
	readonly sliceDraftActive?: () => boolean;
	readonly cancelSliceDraft?: () => void;
	/** A Slice cut is on, and Escape exits it after every earlier rung. */
	readonly sliceActive: () => boolean;
	readonly putBackSlice: () => void;
	/** X2's hold-to-show-whole-Walls override. Session-only; released on keyup/blur. */
	readonly setCutawayHeld?: (held: boolean) => void;
};

export type StageKeyboard = {
	handleKey(event: KeyboardEvent): void;
	handleKeyUp(event: KeyboardEvent): void;
};

export function createStageKeyboard(input: StageKeyboardInput): StageKeyboard {
	function setReading(reading: '3d' | 'plan'): void {
		// Reduced motion cuts directly to the declared endpoint through the one
		// settling rule — it is not a shortened tween. The route's own `setReading`
		// repeats this call with its interruption rule; keeping the clock dated here
		// means the map has exactly one reading transition.
		void readingIntentClockSeconds;
		input.setReading(reading);
	}

	function handleKey(event: KeyboardEvent): void {
		// X2's `W` hold belongs to this map, not a second route listener. Text
		// entry, a focused control and a live press keep their precedence; a
		// printable key a gesture has claimed is left alone.
		if (
			(event.key === 'w' || event.key === 'W') &&
			!event.repeat &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			!event.shiftKey &&
			!stageKeyFromTextEntry(event.target) &&
			!stageKeyFromControl(event.target) &&
			!input.pressing()
		) {
			input.setCutawayHeld?.(true);
		}
		if (event.key === 'Escape' && input.artworkEscape()) {
			event.preventDefault();
			return;
		}
		// Preview is an isolated visitor run: Stage viewing keys do not apply there.
		if (input.previewActive()) {
			if (event.key === 'Escape') input.closePreview();
			return;
		}
		// Esc precedence: a live marker gesture, then place, then Look through,
		// then the Card's own unwinding.
		const activeLayer = input.activeLayer();
		if (event.key === 'Escape' && activeLayer !== null) {
			if (activeLayer.key(event, 'capture') === 'claimed') {
				event.preventDefault();
				event.stopPropagation();
				return;
			}
		}
		// Typing in the Index's subject search must never move the camera.
		if (stageKeyFromTextEntry(event.target)) return;
		// Alt+← is the Card's Back in the Experience lens. A focused Stop card
		// or View tile claims Alt+← for its own reorder first (it prevents the default).
		if (
			activeLayer !== null &&
			event.key === 'ArrowLeft' &&
			event.altKey &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.defaultPrevented
		) {
			if (activeLayer.key(event, 'capture') === 'claimed') {
				event.preventDefault();
				input.openCard();
			}
			return;
		}
		// While a press is live the dock letters and `2` keep reaching the gesture's
		// typed entry, exactly as before they were dock keys.
		const action = stageKeyAction(event.key, { pressing: input.pressing() });
		const gestureStage = input.facade();
		// S6 — B is the modifier-free Bend arm, owned by the selected Wall's adapter
		// only when no task or press already owns the key.
		if (
			action.kind === 'none' &&
			event.key.toLowerCase() === 'b' &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			gestureStage?.selectionKeyIntent({ kind: 'type', key: 'b' }).claimed === true
		) {
			event.preventDefault();
			return;
		}
		// A direct-manipulation writer keeps the keyboard while its press is live:
		// Tab moves between numeric fields and a printable key opens/extends entry.
		if (event.key === 'Tab' && input.dragMode() === 'adapter' && gestureStage !== null) {
			if (gestureStage.gestureKeyIntent({ kind: 'type', key: '\t' }).claimed) {
				event.preventDefault();
				return;
			}
		}
		if (
			action.kind === 'none' &&
			event.key.length === 1 &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			gestureStage !== null &&
			gestureStage.gestureKeyIntent({ kind: 'type', key: event.key }).claimed
		) {
			event.preventDefault();
			return;
		}
		// An activation key belongs to the focused control first: Enter on the palette's
		// Backtrack/Cancel button, a Find result or a Head control must run that
		// control, never the armed tool's command. The guard is limited to the three
		// command keys so the existing viewing map is unchanged.
		if (
			(action.kind === 'finish' || action.kind === 'backtrack' || action.kind === 'delete') &&
			stageKeyFromControl(event.target)
		) {
			return;
		}
		// Paint's own letters, only while its tray is up: no modifier, no live press,
		// text entry already returned above.
		if (
			action.kind === 'none' &&
			input.armedHostTool() === 'paint' &&
			input.lens() === 'world' &&
			!input.pressing() &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.altKey &&
			!event.shiftKey &&
			!event.repeat
		) {
			const key = event.key.toLowerCase();
			const paintKey = key === 't' ? 'tab' : key === 's' ? 'reach' : key === 'i' ? 'sample' : null;
			if (paintKey !== null && input.paintKey?.(paintKey) === true) {
				event.preventDefault();
				return;
			}
		}
		switch (action.kind) {
			case 'reading':
				setReading(action.reading);
				break;
			case 'zoom':
				if (!event.metaKey && !event.ctrlKey && !event.altKey) {
					event.preventDefault();
					input.zoom(action.scale);
				}
				break;
			case 'fit':
				input.fit();
				break;
			case 'tool':
				// A modified letter is the platform's (⌘P prints), and the dock is World's.
				if (event.metaKey || event.ctrlKey || event.altKey || input.lens() !== 'world') break;
				event.preventDefault();
				input.pressDockSlot(action.slot);
				break;
			case 'pan':
				input.pan(action.deltaCss[0], action.deltaCss[1]);
				break;
			case 'finish':
			case 'backtrack': {
				// A live direct-manipulation writer answers first (numeric entry's Enter
				// and Backspace); otherwise the armed tool's task owns the command.
				const stage = input.facade();
				if (stage === null) break;
				if (stage.gestureKeyIntent({ kind: action.kind }).claimed) {
					event.preventDefault();
					break;
				}
				if (stage.keyboardIntent({ kind: action.kind }).claimed) {
					// One key, one activation: the palette's own control must not also be
					// activated by the same keystroke.
					event.preventDefault();
					break;
				}
				// With no task or live press, the selected subject's adapter may own
				// Backspace (the active bend point). A straight Wall does not claim it, so
				// the existing command map is unchanged there.
				if (stage.selectionKeyIntent({ kind: action.kind }).claimed) {
					event.preventDefault();
					break;
				}
				break;
			}
			case 'delete': {
				if (input.activeLayer()?.key(event, 'capture') === 'claimed') {
					event.preventDefault();
					break;
				}
				// An active bend point owns Delete before the Wall's destructive
				// action. A curved Wall with no active knot claims and refuses the key, so
				// Delete cannot silently fall through to deleting the Wall; a straight
				// Wall is not claimed and keeps the existing `requestDelete` path.
				if (input.facade()?.selectionKeyIntent({ kind: 'delete' }).claimed === true) {
					event.preventDefault();
					break;
				}
				input.requestDelete();
				break;
			}
			case 'dismiss': {
				// The deepest open context closes first. A disclosed-but-unconfirmed
				// destructive action is deeper than the task; a **live proposal** is deeper
				// than the tool that produced it, so the armed tool cancels its own chain
				// before the unwind disarms it (palette-first Esc, no hidden proposal).
				if (input.pendingDelete()) {
					input.clearPendingDelete();
					break;
				}
				if (input.cancelFinishGesture?.() === true) break;
				const stage = input.facade();
				// A live mark writer cancels first, then an open disclosure closes; neither
				// is a task, and neither may reach the task/selection unwinding below.
				// The adapter claimed this Escape (first restores numeric entry, second
				// cancels the writer). Interrupting the press here would turn the first
				// Escape into the second, so only an unclaimed key unwinds the press.
				if (stage !== null && stage.gestureKeyIntent({ kind: 'cancel' }).claimed) break;
				if (stage !== null && stage.closeDisclosure()) { stage.notifySurfaceChange(); break; }
				if (stage !== null && stage.keyboardIntent({ kind: 'cancel' }).claimed) { input.interrupt('escape'); break; }
				const hadPress = input.pressing();
				input.interrupt('escape');
				if (hadPress) break;
				// U6 Escape precedence: Library › Align › editor › import › drawers › dropper › tray › draft.
				if (input.libraryOpen()) { input.toggleLibrary(); break; }
				if (input.dismissAlign?.() === true) break;
				if (input.dismissMaterialEditor?.() === true) break;
				if (input.dismissMaterialImport?.() === true) break;
				if (input.dismissRepairDrawer?.() === true) break;
				// A host tool clears its own measurement or words first, an open
				// palette folds next, and only then does the armed tool disarm.
				const armedHostTool = input.armedHostTool();
				if (armedHostTool === 'measure' && input.measureTool()?.clear()) { input.refreshHostTools(); break; }
				if (armedHostTool === 'erase' && input.eraserTool()?.clear()) { input.clearEraseHover(); input.refreshHostTools(); break; }
				if (armedHostTool === 'paint' && input.dismissPaint?.() === true) break;
				if (armedHostTool === 'paint' && input.paintTool?.()?.clear()) { input.clearPaintHover?.(); input.refreshHostTools(); break; }
				// A live drawn draft/edit is not the cut itself: Escape returns the cut to
				// its last committed segment first, and only a later Escape puts it back.
				if (input.sliceDraftActive?.() === true) { input.cancelSliceDraft?.(); break; }
				const armedKey = input.armedDockKey();
				if (input.task() !== null && armedKey?.palette === true && input.paletteOpen()) { input.closePalette(); break; }
				// A rung that returns the editor to Select must not leave keyboard focus
				// (and its halo) on the key or strip it just closed. Stage focus stays.
				const toolbarFocus = input.toolbarFocused?.() === true;
				const settleFocus = () => { if (toolbarFocus) input.focusSelectKey?.(); };
				if (input.task() !== null) { input.closeTask(); settleFocus(); }
				else if (input.activeWorldTool() !== 'select') { input.clearWorldTool(); settleFocus(); }
				// The plate is the last layer before Select: once the tool is clear,
				// Escape folds the parchment instead of moving the selection.
				else if (input.dismissSky?.()) { break; }
				else if (input.lens() === 'world' && input.furnishStripOpen?.() === true) { input.closeFurnishStrip?.(); settleFocus(); }
				else if (input.lens() === 'world' && input.worldPlateOpen()) { input.closeWorldPlate(); settleFocus(); }
				else {
					// A selection — including one made inside a temporary reading — closes
					// first, then the next Escape puts the reading back (X1: Lift). A claimed
					// unwind does neither, and every earlier rung has already won.
					const claimed = input.activeLayer()?.key(event, 'unwind') === 'claimed';
					if (!claimed && input.leaveStudio?.() === true) break;
					if (!claimed && input.selectionPresent()) input.closeSelection();
					else if (!claimed && input.liftActive()) input.putBackLift();
					// A-4: the tool rung above already returned the creator to Select with the
					// cut kept, so this next Escape is the one that puts the cut back.
					else if (!claimed && input.sliceActive()) input.putBackSlice();
				}
				break;
			}
			case 'none':
				break;
		}
	}

	function handleKeyUp(event: KeyboardEvent): void {
		if (event.key === 'w' || event.key === 'W') input.setCutawayHeld?.(false);
	}

	return { handleKey, handleKeyUp };
}
