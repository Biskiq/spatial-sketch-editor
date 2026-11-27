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
	type StageDockSlot,
} from '../stage-input';
import type { StageInterruptionReason } from '../stage-interruption';
import type { ViewingIntent } from '@portfolio/camera-core/viewport';
import {
	compileEscapeLadder,
	type BuiltInEscapeRung,
	type FeatureEscapeRegistration,
} from '../../workspace/escape-ladder';
import type { EscapeContext, EscapeResult } from '../../workspace/protocol';

export type StageKeyboardInput = {
	readonly featureEscape: readonly FeatureEscapeRegistration[];
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
	/** Finish and appearance Escape rungs: Align › editor › import › drawers (all after Library, before dropper/tray/draft). */
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
	readonly lens: () => 'world' | 'experience';
	readonly selectionPresent: () => boolean;
	readonly closeSelection: () => void;
	/** A single drilled member returns to its group; false leaves the rung. */
	readonly exitSelectMore?: () => boolean;
	readonly drillOutOfGroup?: () => boolean;
	/** ⌘G groups the set; ⇧⌘G ungroups the selected group. */
	readonly groupSelection?: (ungroup: boolean) => void;
	/**
	 * Object Studio's own rung: after every pending gesture, task and tool has unwound,
	 * Escape leaves a World-entered Studio. Returns whether it left (false: not in
	 * Studio, a standalone Studio whose way out is Back to Projects, or pending work refused).
	 */
	readonly leaveStudio?: () => boolean;
	/** A temporary reading is on (Lift), and Escape puts it back. */
	readonly liftActive: () => boolean;
	readonly putBackLift: () => void;
	/** A drawn draft or handle edit is live; Escape cancels it before the cut. */
	readonly sliceDraftActive?: () => boolean;
	readonly cancelSliceDraft?: () => void;
	/** A Slice cut is on, and Escape exits it after every earlier rung. */
	readonly sliceActive: () => boolean;
	readonly putBackSlice: () => void;
	/** The hold-to-show-whole-Walls override. Session-only; released on keyup/blur. */
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

	function settleFocus(context: EscapeContext): void {
		if (context.toolbarFocus) input.focusSelectKey?.();
	}

	const builtInEscape: Record<BuiltInEscapeRung, (context: EscapeContext) => EscapeResult> = {
		'pending-delete': () => {
			if (!input.pendingDelete()) return 'pass';
			input.clearPendingDelete();
			return 'handled';
		},
		'finish-gesture': () => (input.cancelFinishGesture?.() === true ? 'handled' : 'pass'),
		'adapter-gesture-cancel': (context) => {
			context.stage = input.facade();
			return context.stage?.gestureKeyIntent({ kind: 'cancel' }).claimed ? 'handled' : 'pass';
		},
		disclosure: ({ stage }) => {
			if (!stage?.closeDisclosure()) return 'pass';
			stage.notifySurfaceChange();
			return 'handled';
		},
		'adapter-keyboard-cancel': ({ stage }) => {
			if (!stage?.keyboardIntent({ kind: 'cancel' }).claimed) return 'pass';
			input.interrupt('escape');
			return 'handled';
		},
		press: () => {
			const hadPress = input.pressing();
			input.interrupt('escape');
			return hadPress ? 'handled' : 'pass';
		},
		library: () => {
			if (!input.libraryOpen()) return 'pass';
			input.toggleLibrary();
			return 'handled';
		},
		align: () => (input.dismissAlign?.() === true ? 'handled' : 'pass'),
		'material-editor': () => (input.dismissMaterialEditor?.() === true ? 'handled' : 'pass'),
		'material-import': () => (input.dismissMaterialImport?.() === true ? 'handled' : 'pass'),
		'repair-drawer': () => (input.dismissRepairDrawer?.() === true ? 'handled' : 'pass'),
		measure: (context) => {
			context.armedHostTool = input.armedHostTool();
			if (context.armedHostTool !== 'measure' || !input.measureTool()?.clear()) return 'pass';
			input.refreshHostTools();
			return 'handled';
		},
		erase: ({ armedHostTool }) => {
			if (armedHostTool !== 'erase' || !input.eraserTool()?.clear()) return 'pass';
			input.clearEraseHover();
			input.refreshHostTools();
			return 'handled';
		},
		'paint-picker': ({ armedHostTool }) =>
			armedHostTool === 'paint' && input.dismissPaint?.() === true ? 'handled' : 'pass',
		'paint-tool': ({ armedHostTool }) => {
			if (armedHostTool !== 'paint' || !input.paintTool?.()?.clear()) return 'pass';
			input.clearPaintHover?.();
			input.refreshHostTools();
			return 'handled';
		},
		'slice-draft': () => {
			if (input.sliceDraftActive?.() !== true) return 'pass';
			input.cancelSliceDraft?.();
			return 'handled';
		},
		'select-more': () => (input.exitSelectMore?.() === true ? 'handled' : 'pass'),
		palette: () => {
			const armedKey = input.armedDockKey();
			if (input.task() === null || armedKey?.palette !== true || !input.paletteOpen())
				return 'pass';
			input.closePalette();
			return 'handled';
		},
		task: (context) => {
			context.toolbarFocus = input.toolbarFocused?.() === true;
			if (input.task() === null) return 'pass';
			input.closeTask();
			settleFocus(context);
			return 'handled';
		},
		'world-tool': (context) => {
			if (input.activeWorldTool() === 'select') return 'pass';
			input.clearWorldTool();
			settleFocus(context);
			return 'handled';
		},
		'furnish-strip': (context) => {
			if (input.lens() !== 'world' || input.furnishStripOpen?.() !== true) return 'pass';
			input.closeFurnishStrip?.();
			settleFocus(context);
			return 'handled';
		},
		'world-plate': (context) => {
			if (input.lens() !== 'world' || !input.worldPlateOpen()) return 'pass';
			input.closeWorldPlate();
			settleFocus(context);
			return 'handled';
		},
		'unwind-claim': (context) => {
			context.claimed = input.activeLayer()?.key(context.event, 'unwind') === 'claimed';
			return 'pass';
		},
		leave: ({ claimed }) => (!claimed && input.leaveStudio?.() === true ? 'handled' : 'pass'),
		'group-drill': ({ claimed }) =>
			claimed || input.drillOutOfGroup?.() !== true ? 'pass' : 'handled',
		selection: ({ claimed }) => {
			if (claimed || !input.selectionPresent()) return 'pass';
			input.closeSelection();
			return 'handled';
		},
		lift: ({ claimed }) => {
			if (claimed || !input.liftActive()) return 'pass';
			input.putBackLift();
			return 'handled';
		},
		slice: ({ claimed }) => {
			if (claimed || !input.sliceActive()) return 'pass';
			input.putBackSlice();
			return 'handled';
		},
	};

	const escapeSteps = compileEscapeLadder(builtInEscape, input.featureEscape);

	function dismiss(event: KeyboardEvent): void {
		const context: EscapeContext = {
			event,
			stage: null,
			claimed: false,
			armedHostTool: null,
			toolbarFocus: false,
		};
		for (const handle of escapeSteps) {
			if (handle(context) === 'handled') return;
		}
	}

	function handleKey(event: KeyboardEvent): void {
		// The `W` hold belongs to this map, not a second route listener. Text
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
		// Group and Ungroup are the two chorded keys of the group interaction.
		if (
			(event.key === 'g' || event.key === 'G') &&
			(event.metaKey || event.ctrlKey) &&
			!event.altKey &&
			!stageKeyFromTextEntry(event.target)
		) {
			event.preventDefault();
			input.groupSelection?.(event.shiftKey === true);
			return;
		}
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
			case 'dismiss':
				dismiss(event);
				break;
			case 'none':
				break;
		}
	}

	function handleKeyUp(event: KeyboardEvent): void {
		if (event.key === 'w' || event.key === 'W') input.setCutawayHeld?.(false);
	}

	return { handleKey, handleKeyUp };
}
