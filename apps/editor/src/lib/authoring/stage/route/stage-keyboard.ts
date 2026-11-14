/**
 * X2 / decomposition contract G — keyboard routing as a leaf policy.
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
	readonly dragMode: () => 'pan' | 'orbit' | 'adapter' | 'host' | null;
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
	readonly interrupt: (reason: StageInterruptionReason) => void;
	readonly task: () => StageTask | null;
	readonly closeTask: () => void;
	readonly armedHostTool: () => string | null;
	readonly measureTool: () => StageMeasureController | null;
	readonly eraserTool: () => StageEraserController | null;
	readonly clearEraseHover: () => void;
	readonly refreshHostTools: () => void;
	readonly armedDockKey: () => { readonly palette?: boolean } | undefined;
	readonly paletteOpen: () => boolean;
	readonly closePalette: () => void;
	readonly libraryOpen: () => boolean;
	readonly toggleLibrary: () => void;
	readonly activeWorldTool: () => string;
	readonly clearWorldTool: () => void;
	readonly worldPlateOpen: () => boolean;
	readonly closeWorldPlate: () => void;
	readonly lens: () => 'world' | 'experience';
	readonly selectionPresent: () => boolean;
	readonly closeSelection: () => void;
};

export type StageKeyboard = { handleKey(event: KeyboardEvent): void };

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
		if (event.key === 'Escape' && input.artworkEscape()) {
			event.preventDefault();
			return;
		}
		// Preview is an isolated visitor run: Stage viewing keys do not apply there.
		if (input.previewActive()) {
			if (event.key === 'Escape') input.closePreview();
			return;
		}
		// S28 Esc precedence: a live marker gesture, then place, then Look through,
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
		// R217.S26 (E17): Alt+← is the Card's Back in the Experience lens. A focused Stop card
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
				// D2 — with no task or live press, the selected subject's adapter may own
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
				// D2 — an active bend point owns Delete before the Wall's destructive
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
				// R217.S10: a host tool clears its own measurement or words first, an open
				// palette folds next, and only then does the armed tool disarm.
				const armedHostTool = input.armedHostTool();
				if (armedHostTool === 'measure' && input.measureTool()?.clear()) { input.refreshHostTools(); break; }
				if (armedHostTool === 'erase' && input.eraserTool()?.clear()) { input.clearEraseHover(); input.refreshHostTools(); break; }
				const armedKey = input.armedDockKey();
				if (input.task() !== null && armedKey?.palette === true && input.paletteOpen()) { input.closePalette(); break; }
				if (input.libraryOpen()) { input.toggleLibrary(); break; }
				if (input.task() !== null) input.closeTask();
				else if (input.activeWorldTool() !== 'select') { input.clearWorldTool(); }
				// The plate is the last layer before Select: once the tool is clear,
				// Escape folds the parchment instead of moving the selection.
				else if (input.lens() === 'world' && input.worldPlateOpen()) { input.closeWorldPlate(); }
				else if (input.activeLayer()?.key(event, 'unwind') !== 'claimed' && input.selectionPresent()) input.closeSelection();
				break;
			}
			case 'none':
				break;
		}
	}

	return { handleKey };
}
