/**
 * X3 / decomposition contract S — the mounted shell's presentation state.
 *
 * Disclosure and focus state, browser preferences, the responsive width facts
 * and the Grid/Snap + Height Sheet bindings used to be route-local variables.
 * They are session view state, never authored content, and they belong to one
 * owner so the route can remain a composition root.
 *
 * This controller writes only host view state:
 *
 * - drafting/height values go through the existing session/facade owners;
 * - the motion clock is the existing reduced-motion clock;
 * - host tools keep their existing controllers and projections;
 * - no selection, task, history, acceptance or renderer command is implemented
 *   here.
 *
 * `start()` installs the browser media listeners once and `dispose()` removes
 * them exactly once, so the route keeps one ordered teardown.
 */
import type { ViewportEvaluation, ViewportRect } from '@portfolio/camera-core';
import {
	DEFAULT_APP_PREFERENCES,
	readAppPreferences,
	writeAppPreferences,
	type AppPreferences
} from '$lib/platform/app-preferences';
import { createEditorMotionClock } from '$lib/platform/editor-motion-clock';
import { untrack } from 'svelte';
import type { StageSelectionEntry } from '../semantic-selection';
import type { StageFacade } from '../stage-facade';
import type { StageSession, StageTask } from '../stage-session';
import type { StageHeightTick } from '../stage-height-sheet';
import type { StageMeasureController } from '../stage-measure';
import { createStageMeasure } from '../stage-measure';
import { STAGE_MEASURE_TASK } from '../stage-measure';
import type { StageEraserController } from '../stage-eraser';
import { createStageEraser } from '../stage-eraser';
import { STAGE_ERASER_TASK } from '../stage-eraser';
import {
	applyDraftingPatch,
	draftingSnapIncrementMeters,
	gridWord as draftingWordForGrid,
	roundScaleBarLength,
	snapWord as draftingWordForSnap,
	type StageDraftingPatch,
	type StageDraftingState
} from '../stage-drafting';
import { STAGE_DRAFTING_DEFAULTS } from '../stage-drafting';
import type { WorldScope } from '../shell/world-index-model';
import type { WorldToolId } from '$lib/authoring/world-toolbar/registry';
import { worldTool } from '$lib/authoring/world-toolbar/registry';
import {
	sameEraseHover,
	stageArmedHostTool,
	stageHostToolOverlay,
	type StageHostToolOverlay
} from './stage-contribution-view';

export type StagePendingDelete = {
	readonly subjectKey: string;
	readonly actionId: string;
	readonly detail: string | null;
};

export type StageShellStateInput = {
	readonly session: StageSession;
	readonly facade: () => StageFacade | null;
	readonly evaluation: () => ViewportEvaluation | null;
	readonly rect: () => ViewportRect | null;
	readonly measure: () => ViewportRect;
	readonly previewing: () => boolean;
	readonly lens: () => 'world' | 'experience';
	readonly selection: () => StageSelectionEntry | null;
};

export function createStageShellState(input: StageShellStateInput) {
	const heightSheet = input.session.heightSheet();
	const motionClock = createEditorMotionClock();

	/** Session status words; every owner writes through these methods. */
	let notice = $state('');
	/** The last Preview lowering refusal, worded like a source problem. */
	let previewProblem = $state<unknown | null>(null);

	/** Measured lanes beside the Stage (the lower column and the Sheet). */
	let lowerColumnHeight = $state(0);
	let sheetLaneWidth = $state(0);

	const constrainedAtStart =
		typeof window !== 'undefined' &&
		typeof window.matchMedia === 'function' &&
		window.matchMedia('(max-width: 860px)').matches;
	let indexOpen = $state(!constrainedAtStart);
	let query = $state('');
	let narrowShell = $state(constrainedAtStart);

	let reducedMotion = $state(false);
	let preferences = $state<AppPreferences>({ ...DEFAULT_APP_PREFERENCES });

	/** Index scope, a navigation projection only. */
	let worldScope = $state<WorldScope>('project');
	/** The Presentation whose Views the Index shows: one at a time. */
	let expandedPresentationId = $state<string | null>(null);

	/** Whether the Keys reference is open; it lives in Find and closes with its own control. */
	let keysOpen = $state(false);
	/** R217.S29 Show ▾ — session-only Stage drawing flags; all on by default. */
	let showOpen = $state(false);
	let showMode = $state<'whole' | 'selection'>('whole');
	let showMarkers = $state(true);
	let showFrustums = $state(true);
	let showPaths = $state(true);
	let showLabels = $state(true);

	/** The contextual Card's disclosure; closing it never clears selection. */
	let cardOpen = $state(true);
	/** Bumped by an Index double-click: the Card opens its inline name editor. */
	let cardRenameRequest = $state(0);
	/** True while an authored (non-navigation) gesture holds the Stage: the Card fades (D36). */
	let cardGesturing = $state(false);

	/** Whether the armed tool's palette is open above the dock. */
	let paletteOpen = $state(true);
	/**
	 * The dock's armed contributed tool. Host state, not session state: an
	 * accepted install closes the task, not the creator's intent to keep drawing.
	 */
	let armedTool = $state<{ readonly id: string; readonly adapterId: string } | null>(null);

	/** The World toolbar's selected row; the task/selection controllers remain authoritative. */
	let activeWorldTool = $state<WorldToolId>('select');
	/** The upper parchment plate: opens on a family press and folds on a second one. */
	let worldPlateOpen = $state(false);
	let libraryOpen = $state(false);
	let toolBeforeLibrary = $state<WorldToolId>('select');
	let inkReading = $state<'wall' | 'opening'>('wall');

	/** The session's task, mirrored so the shell's chrome re-reads it. */
	let task = $state.raw<StageTask | null>(null);
	let contributedTaskId = $state<{ id: string; adapterId: string } | null>(null);
	/** Adapter registration/binding changes make contribution reads re-derive. */
	let contributionsVersion = $state(0);

	/** A one-shot Stage pick for linking a Presentation; Esc cancels it. */
	let stagePickPresentationId = $state<string | null>(null);

	/**
	 * A destructive Card action whose consequences have been disclosed and which
	 * awaits a second `Delete`. The offer is a fingerprint, never a stale record.
	 */
	let pendingDelete = $state<StagePendingDelete | null>(null);

	/** R217.S10 — the host's own tools, bound to the live facade. */
	let measureTool = $state.raw<StageMeasureController | null>(null);
	let eraserTool = $state.raw<StageEraserController | null>(null);
	let hostToolOverlay = $state.raw<StageHostToolOverlay | null>(null);
	/** The Eraser's winner, drawn with the erase treatment in place of hover. */
	let eraseHover = $state.raw<StageSelectionEntry | null>(null);

	let heightMeters = $state(heightSheet.height());
	let heightTicks = $state<readonly StageHeightTick[]>([]);
	let heightPins = $state<readonly number[]>(heightSheet.pins());
	let heightSheetSide = $state<'left' | 'right'>('right');
	let heightPlaneVisible = $state(false);
	let heightPlaneTimer: ReturnType<typeof setTimeout> | null = null;

	/** The Head's bounded Find query; discovery state, never a subject search. */
	let findQuery = $state('');

	/** The one Grid/Snap view state, mirrored from the session. */
	let drafting = $state<StageDraftingState>(STAGE_DRAFTING_DEFAULTS);

	/** Media-query listeners installed by `start()` and removed by `dispose()`. */
	let cleanups: (() => void) | null = null;
	let started = false;
	let disposed = false;

	$effect(() => {
		heightMeters = heightSheet.height();
		heightPins = heightSheet.pins();
		const unsubscribeHeight = heightSheet.subscribe('route-height-sheet', (height) => {
			heightMeters = height;
		});
		const unsubscribePins = heightSheet.subscribePins('route-height-sheet-pins', (pins) => {
			heightPins = pins;
		});
		return () => {
			unsubscribeHeight();
			unsubscribePins();
		};
	});

	$effect(() => {
		// A binding rebuild can add or remove owner surfaces, and a viewport output
		// is needed before the binding exists; read the merged set for both.
		void input.evaluation();
		void contributionsVersion;
		const stage = input.facade();
		heightTicks = stage === null ? [] : stage.heightTicks();
	});

	$effect(() => () => {
		if (heightPlaneTimer !== null) clearTimeout(heightPlaneTimer);
	});

	$effect(() => {
		// A lens switch can happen after the Sheet already went inactive (for
		// example focus moved to the lens button first), so cancel any live tail
		// on the lens change itself rather than relying on the unmount callback.
		if (input.lens() === 'world') return;
		if (heightPlaneTimer !== null) {
			clearTimeout(heightPlaneTimer);
			heightPlaneTimer = null;
		}
		heightPlaneVisible = false;
	});

	$effect(() => {
		// A completed task leaves no plate behind. A library visit is its own mode and
		// Select is already the empty state, so those two keep their word.
		if (task === null) {
			if (libraryOpen || activeWorldTool === 'library' || activeWorldTool === 'select') return;
			// A planned row is inspectable without a task; only a landed tool that has
			// just completed belongs back at Select.
			if (worldTool(activeWorldTool).stage === 'planned') return;
			activeWorldTool = 'select';
			worldPlateOpen = false;
			return;
		}
		if (task.kind === STAGE_MEASURE_TASK) activeWorldTool = 'measure';
		else if (task.kind === STAGE_ERASER_TASK) activeWorldTool = 'erase';
	});

	/** The selected subject's confirmation key, or `null` when nothing is selected. */
	const deleteSubjectKey = $derived.by(() => {
		const selected = input.selection();
		return selected === null
			? null
			: `${selected.reference.subject.kind}:${selected.reference.subject.id}`;
	});

	$effect(() => {
		// A selection change spends the offer: the disclosure was read for one
		// subject. Only the selection is tracked, so the press that opens an offer
		// cannot retrigger this and clear it.
		const key = deleteSubjectKey;
		untrack(() => {
			if (pendingDelete === null || pendingDelete.subjectKey === key) return;
			pendingDelete = null;
			notice = '';
		});
	});

	function nowSeconds(): number {
		const real =
			typeof performance === 'undefined' ? Date.now() / 1000 : performance.now() / 1000;
		return motionClock.read(real);
	}

	function start(): void {
		if (started || disposed) return;
		started = true;
		if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		preferences = readAppPreferences();
		motionClock.setSpeed(preferences.motionSpeed, performance.now() / 1000);
		reducedMotion = preferences.reducedMotion ?? media.matches;
		const onMedia = (event: MediaQueryListEvent) => {
			if (preferences.reducedMotion === null) reducedMotion = event.matches;
		};
		media.addEventListener('change', onMedia);

		// The shell's width rule: at a constrained width the Card folds to identity
		// rather than covering the dock/palette's one lower column.
		const narrow = window.matchMedia('(max-width: 1100px)');
		narrowShell = narrow.matches;
		const portrait = window.matchMedia('(max-width: 860px)');
		if (portrait.matches) indexOpen = false;
		const onNarrow = (event: MediaQueryListEvent) => {
			narrowShell = event.matches;
		};
		narrow.addEventListener('change', onNarrow);
		const onPortrait = (event: MediaQueryListEvent) => {
			if (event.matches) indexOpen = false;
		};
		portrait.addEventListener('change', onPortrait);

		cleanups = () => {
			media.removeEventListener('change', onMedia);
			narrow.removeEventListener('change', onNarrow);
			portrait.removeEventListener('change', onPortrait);
		};
	}

	function dispose(): void {
		if (disposed) return;
		disposed = true;
		cleanups?.();
		cleanups = null;
		if (heightPlaneTimer !== null) {
			clearTimeout(heightPlaneTimer);
			heightPlaneTimer = null;
		}
	}

	function updatePreferences(next: AppPreferences): void {
		const real = performance.now() / 1000;
		motionClock.setSpeed(next.motionSpeed, real);
		preferences = next;
		writeAppPreferences(next);
	}

	function setNotice(message: string): void {
		notice = message;
	}

	/** Clear a notice only when it is still the one that scheduled the clear. */
	function clearNotice(shown: string): void {
		if (notice === shown) notice = '';
	}

	function bumpContributions(): void {
		contributionsVersion += 1;
	}

	function setTask(next: StageTask | null): void {
		task = next;
	}

	function setContributedTask(next: { id: string; adapterId: string } | null): void {
		contributedTaskId = next;
	}

	function setPendingDelete(next: StagePendingDelete | null): void {
		pendingDelete = next;
	}

	function requestCardRename(): void {
		cardOpen = true;
		cardRenameRequest += 1;
	}

	/** The new facade exists: bind the host tools and re-read session view state. */
	function bindFacade(next: StageFacade): void {
		measureTool = createStageMeasure(next);
		eraserTool = createStageEraser(next, () => refreshHostTools());
		drafting = next.drafting();
		task = null;
		contributedTaskId = null;
	}

	const armedHostTool = $derived(stageArmedHostTool(task));
	const showOffCount = $derived(
		[showMarkers, showFrustums, showPaths, showLabels].filter((on) => !on).length
	);
	const sheetLaneRight = $derived(heightSheetSide === 'right' ? sheetLaneWidth : 0);
	const sheetLaneLeft = $derived(heightSheetSide === 'left' ? sheetLaneWidth : 0);
	const draftingReading: 'plan' | '3d' = $derived(
		input.evaluation()?.settledReading === 'plan' ? 'plan' : '3d'
	);
	const draftingGridWord = $derived(draftingWordForGrid(drafting));
	const draftingSnapWord = $derived(draftingWordForSnap(drafting));
	/** Arrow-key stepping follows the fixed increment, or 0.1 m while Snap is off. */
	const heightSnapIncrement = $derived(draftingSnapIncrementMeters(drafting) ?? 0.1);
	const draftingScaleBar = $derived(
		roundScaleBarLength(input.evaluation()?.targetPlaneMetersPerCssPixel ?? 0)
	);

	function refreshHostTools(): void {
		const result = stageHostToolOverlay({
			facade: input.facade(),
			armedHostTool,
			measureTool,
			eraserTool,
			rect: input.rect(),
			measure: input.measure
		});
		hostToolOverlay = result.overlay;
		if (result.eraseHover === null) {
			if (eraseHover !== null) eraseHover = null;
			return;
		}
		if (eraseHover !== null && sameEraseHover(eraseHover, result.eraseHover)) return;
		eraseHover = result.eraseHover;
	}

	/** End both host tools' view state; the command that closes a task calls this first. */
	function clearHostTools(): void {
		measureTool?.clear();
		eraserTool?.clear();
		eraseHover = null;
		hostToolOverlay = null;
	}

	/** Mirror the one session lease into the Card's gesture fade. */
	function syncGestureFade(lease: {
		readonly navigation?: boolean;
		readonly owner: string;
	} | null): void {
		const cameraEdit =
			lease !== null &&
			(lease.owner === 'experience-view-edit' || lease.owner === 'experience-path-point');
		const gesturing = lease !== null && lease.navigation !== true && !cameraEdit;
		if (gesturing !== cardGesturing) cardGesturing = gesturing;
	}

	/**
	 * Change the one Grid/Snap fact through the session authority.
	 *
	 * Nothing here touches acceptance, history or Save: the session's view state
	 * is not authored content, so a Grid/Snap toggle cannot dirty the project.
	 */
	function patchDrafting(patch: StageDraftingPatch): void {
		const stage = input.facade();
		drafting = stage === null ? applyDraftingPatch(drafting, patch) : stage.setDrafting(patch);
	}

	/**
	 * Alt/Option holds Snap off until release, blur or teardown. Entering the hold
	 * is ignored during Preview; releasing it always applies, so a keyup the
	 * Preview guard swallowed cannot strand `Snap held` after Exit.
	 */
	function suspendSnap(suspended: boolean): void {
		if (drafting.snapSuspended === suspended) return;
		if (input.previewing() && suspended) return;
		patchDrafting({ snapSuspended: suspended });
	}

	function setHeight(heightMetersValue: number, cause: 'drag' | 'key' | 'tick'): void {
		heightSheet.set(heightMetersValue, cause);
		heightMeters = heightSheet.height();
	}

	/** Session-only pin creation; pin removal is intentionally unexposed. */
	function addHeightPin(): void {
		heightSheet.addPin(heightMeters);
		heightPins = heightSheet.pins();
	}

	function setHeightPlaneActive(active: boolean): void {
		if (heightPlaneTimer !== null) {
			clearTimeout(heightPlaneTimer);
			heightPlaneTimer = null;
		}
		// The Sheet is World-lens chrome. Its teardown on a lens switch is not a
		// pointer release: do not leave a tail running behind the Experience lens.
		if (input.lens() !== 'world') {
			heightPlaneVisible = false;
			return;
		}
		if (active) {
			heightPlaneVisible = true;
			return;
		}
		if (reducedMotion) {
			heightPlaneVisible = false;
			return;
		}
		heightPlaneTimer = setTimeout(() => {
			heightPlaneVisible = false;
			heightPlaneTimer = null;
		}, 1000);
	}

	function toggleReducedMotion(): void {
		reducedMotion = !reducedMotion;
		updatePreferences({ ...preferences, reducedMotion });
	}

	return {
		get notice() {
			return notice;
		},
		get previewProblem() {
			return previewProblem;
		},
		setPreviewProblem(value: unknown | null) {
			previewProblem = value;
		},
		get lowerColumnHeight() {
			return lowerColumnHeight;
		},
		setLowerColumnHeight(value: number) {
			lowerColumnHeight = value;
		},
		get sheetLaneWidth() {
			return sheetLaneWidth;
		},
		setSheetLaneWidth(value: number) {
			sheetLaneWidth = value;
		},
		get sheetLaneRight() {
			return sheetLaneRight;
		},
		get sheetLaneLeft() {
			return sheetLaneLeft;
		},
		get indexOpen() {
			return indexOpen;
		},
		setIndexOpen(value: boolean) {
			indexOpen = value;
		},
		get query() {
			return query;
		},
		setQuery(value: string) {
			query = value;
		},
		get narrowShell() {
			return narrowShell;
		},
		get reducedMotion() {
			return reducedMotion;
		},
		get preferences() {
			return preferences;
		},
		updatePreferences,
		toggleReducedMotion,
		get worldScope() {
			return worldScope;
		},
		setWorldScope(value: WorldScope) {
			worldScope = value;
		},
		get expandedPresentationId() {
			return expandedPresentationId;
		},
		setExpandedPresentationId(value: string | null) {
			expandedPresentationId = value;
		},
		get keysOpen() {
			return keysOpen;
		},
		setKeysOpen(value: boolean) {
			keysOpen = value;
		},
		get findQuery() {
			return findQuery;
		},
		setFindQuery(value: string) {
			findQuery = value;
		},
		get showOpen() {
			return showOpen;
		},
		setShowOpen(value: boolean) {
			showOpen = value;
		},
		get showMode() {
			return showMode;
		},
		setShowMode(value: 'whole' | 'selection') {
			showMode = value;
		},
		get showMarkers() {
			return showMarkers;
		},
		setShowMarkers(value: boolean) {
			showMarkers = value;
		},
		get showFrustums() {
			return showFrustums;
		},
		setShowFrustums(value: boolean) {
			showFrustums = value;
		},
		get showPaths() {
			return showPaths;
		},
		setShowPaths(value: boolean) {
			showPaths = value;
		},
		get showLabels() {
			return showLabels;
		},
		setShowLabels(value: boolean) {
			showLabels = value;
		},
		get showOffCount() {
			return showOffCount;
		},
		showAll() {
			showMarkers = true;
			showFrustums = true;
			showPaths = true;
			showLabels = true;
		},
		get cardOpen() {
			return cardOpen;
		},
		setCardOpen(value: boolean) {
			cardOpen = value;
		},
		get cardRenameRequest() {
			return cardRenameRequest;
		},
		requestCardRename,
		get cardGesturing() {
			return cardGesturing;
		},
		get paletteOpen() {
			return paletteOpen;
		},
		setPaletteOpen(value: boolean) {
			paletteOpen = value;
		},
		togglePalette() {
			paletteOpen = !paletteOpen;
		},
		get armedTool() {
			return armedTool;
		},
		setArmedTool(value: { readonly id: string; readonly adapterId: string } | null) {
			armedTool = value;
		},
		get activeWorldTool() {
			return activeWorldTool;
		},
		setActiveWorldTool(value: WorldToolId) {
			activeWorldTool = value;
		},
		get worldPlateOpen() {
			return worldPlateOpen;
		},
		setWorldPlateOpen(value: boolean) {
			worldPlateOpen = value;
		},
		get libraryOpen() {
			return libraryOpen;
		},
		setLibraryOpen(value: boolean) {
			libraryOpen = value;
		},
		get toolBeforeLibrary() {
			return toolBeforeLibrary;
		},
		setToolBeforeLibrary(value: WorldToolId) {
			toolBeforeLibrary = value;
		},
		get inkReading() {
			return inkReading;
		},
		setInkReading(value: 'wall' | 'opening') {
			inkReading = value;
		},
		get task() {
			return task;
		},
		setTask,
		get contributedTaskId() {
			return contributedTaskId;
		},
		setContributedTask,
		get contributionsVersion() {
			return contributionsVersion;
		},
		bumpContributions,
		get stagePickPresentationId() {
			return stagePickPresentationId;
		},
		setStagePickPresentationId(value: string | null) {
			stagePickPresentationId = value;
		},
		get pendingDelete() {
			return pendingDelete;
		},
		setPendingDelete,
		get deleteSubjectKey() {
			return deleteSubjectKey;
		},
		get measureTool() {
			return measureTool;
		},
		get eraserTool() {
			return eraserTool;
		},
		get armedHostTool() {
			return armedHostTool;
		},
		get hostToolOverlay() {
			return hostToolOverlay;
		},
		get eraseHover() {
			return eraseHover;
		},
		setEraseHover(entry: StageSelectionEntry | null) {
			eraseHover = entry;
		},
		refreshHostTools,
		clearHostTools,
		get heightMeters() {
			return heightMeters;
		},
		get heightTicks() {
			return heightTicks;
		},
		get heightPins() {
			return heightPins;
		},
		get heightSheetSide() {
			return heightSheetSide;
		},
		setHeightSheetSide(value: 'left' | 'right') {
			heightSheetSide = value;
		},
		get heightPlaneVisible() {
			return heightPlaneVisible;
		},
		get heightSnapIncrement() {
			return heightSnapIncrement;
		},
		setHeight,
		addHeightPin,
		setHeightPlaneActive,
		get drafting() {
			return drafting;
		},
		get draftingReading() {
			return draftingReading;
		},
		get draftingGridWord() {
			return draftingGridWord;
		},
		get draftingSnapWord() {
			return draftingSnapWord;
		},
		get draftingScaleBar() {
			return draftingScaleBar;
		},
		patchDrafting,
		suspendSnap,
		bindFacade,
		syncGestureFade,
		setNotice,
		clearNotice,
		nowSeconds,
		start,
		dispose
	};
}

export type StageShellState = ReturnType<typeof createStageShellState>;
