/**
 * The mounted shell's presentation state.
 *
 * Disclosure and focus state, browser preferences, the responsive width facts
 * and the Grid/Snap + Height Sheet bindings are session view state, never authored content, and they belong to one
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
import type { SemanticReference } from '@portfolio/project-model/references';
import type { ViewportEvaluation, ViewportRect } from '@portfolio/camera-core/viewport';
import {
	DEFAULT_APP_PREFERENCES,
	readAppPreferences,
	writeAppPreferences,
	type AppPreferences
} from '$lib/platform/app-preferences';
import { createEditorMotionClock } from '$lib/platform/editor-motion-clock';
import { createStageHeightState } from './stage-height-state.svelte';
import { createStageShellStatus } from './stage-shell-status.svelte';
import { untrack } from 'svelte';
import type { StageSelectionEntry } from '../semantic-selection';
import type { StageFacade } from '../stage-facade';
import type { StageSession, StageTask } from '../stage-session';
import type { StageMeasureController } from '../stage-measure';
import { createStageMeasure } from '../stage-measure';
import { STAGE_MEASURE_TASK } from '../stage-measure';
import type { StageEraserController } from '../stage-eraser';
import { createStageEraser } from '../stage-eraser';
import { STAGE_ERASER_TASK } from '../stage-eraser';
import type { StagePaintCandidate, StagePaintController } from '../stage-painter';
import { createStagePainter } from '../stage-painter';
import type { PaintRadius } from '../../look/paint-pick';
import type { FinishAuthoring } from '$lib/authoring/look/finish-authoring.svelte';
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
import type { WorldLibraryCategory, WorldToolId } from '$lib/authoring/world-toolbar/registry';

/**
 * Why the Library opened (T2.S8 U5 recovery): Paint's *Browse all* picks for
 * Paint, the dock and `L` Replace a qualified selection, the Card's *Swap…*
 * swaps, Furnish browses Objects, anything else browses. `kind` names the shelf
 * to open on; null keeps the session's last view.
 */
/**
 * The Library's last browse view (U5): session state, never saved. It survives
 * closing and reopening the Library; detail and invocation do not.
 */
export type StageLibraryView = {
	readonly kind: 'materials' | 'objects' | 'artwork' | 'lights';
	readonly source: string;
	readonly category: string;
	readonly filters: readonly string[];
	readonly query: string;
};

export const STAGE_LIBRARY_VIEW_DEFAULT: StageLibraryView = {
	kind: 'materials',
	source: 'all',
	category: 'all',
	filters: [],
	query: ''
};

export type StageLibraryInvocation = {
	readonly intent: 'browse' | 'paint' | 'replace' | 'swap';
	readonly kind: 'materials' | 'objects' | 'artwork' | 'lights' | null;
	readonly from: 'dock' | 'paint' | 'furnish' | 'card' | 'lights';
	readonly nonce: number;
};
import { worldTool } from '$lib/authoring/world-toolbar/registry';
import {
	LIBRARY_INSPECTION_DEFAULT,
	type LibraryInspectionSettings
} from '$lib/authoring/library/library-inspection';
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
	/** The Finish service Paint consumes; `null` until the route has built it. */
	readonly finishes: () => FinishAuthoring | null;
	/** A click that painted one subject: select it and open that Finish (U4). */
	readonly onPaintedOne?: (target: StagePaintCandidate) => void;
};

export function createStageShellState(input: StageShellStateInput) {
	const heightSheet = input.session.heightSheet();
	const motionClock = createEditorMotionClock();

	const status = createStageShellStatus({
		openCard: () => {
			cardOpen = true;
		}
	});

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
	/** Show ▾ — session-only Stage drawing flags; all on by default. */
	let showOpen = $state(false);
	let showMode = $state<'whole' | 'selection'>('whole');
	let showMarkers = $state(true);
	let showFrustums = $state(true);
	let showPaths = $state(true);
	let showLabels = $state(true);

	/** The contextual Card's disclosure; closing it never clears selection. */
	let cardOpen = $state(true);
	/** One pending request to open the Card name editor, optionally qualified by selection. */

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
	/**
	 * Furnish's quick strip (owner decision, supersedes #399's direct Library
	 * launch): a placeholder strip over the dock with no tool armed.
	 */
	let furnishStripOpen = $state(false);
	/** Why the Library is open; set by the command that opened it, cleared on close. */
	let libraryInvocation = $state.raw<StageLibraryInvocation>({ intent: 'browse', kind: null, from: 'dock', nonce: 0 });
	let libraryView = $state.raw<StageLibraryView>(STAGE_LIBRARY_VIEW_DEFAULT);
	/** Library detail and Customise… share one remembered geometry and lighting. */
	let libraryInspection = $state.raw<LibraryInspectionSettings>(LIBRARY_INSPECTION_DEFAULT);
	/** A one-shot Library shelf request; the World toolbar consumes the nonce. */
	let libraryCategoryRequest = $state<{
		readonly category: WorldLibraryCategory;
		readonly nonce: number;
	} | null>(null);
	let inkReading = $state<'wall' | 'opening' | 'room' | 'terrace' | 'roof'>('wall');

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

	/** The host's own tools, bound to the live facade. */
	let measureTool = $state.raw<StageMeasureController | null>(null);
	let eraserTool = $state.raw<StageEraserController | null>(null);
	let paintTool = $state.raw<StagePaintController | null>(null);
	let paintScope = $state<PaintRadius>('surface');
	let paintCandidate = $state.raw<StagePaintCandidate | null>(null);
	let hostToolOverlay = $state.raw<StageHostToolOverlay | null>(null);
	/** The Eraser's winner, drawn with the erase treatment in place of hover. */
	let eraseHover = $state.raw<StageSelectionEntry | null>(null);
	/** Paint's winner, drawn with the paint treatment in place of hover. */
	let paintHover = $state.raw<StageSelectionEntry | null>(null);

	const height = createStageHeightState({
		sheet: heightSheet,
		lensWorld: () => input.lens() === 'world',
		reducedMotion: () => reducedMotion
	});

	let findQuery = $state('');

	/** The one Grid/Snap view state, mirrored from the session. */
	let drafting = $state<StageDraftingState>(STAGE_DRAFTING_DEFAULTS);

	/** Media-query listeners installed by `start()` and removed by `dispose()`. */
	let cleanups: (() => void) | null = null;
	let started = false;
	let disposed = false;

	$effect(() => {
		// A binding rebuild can add or remove owner surfaces, and a viewport output
		// is needed before the binding exists; read the merged set for both.
		void input.evaluation();
		void contributionsVersion;
		const stage = input.facade();
		height.setTicks(stage === null ? [] : stage.heightTicks());
	});

	$effect(() => {
		// A completed task leaves no plate behind. A library visit is its own mode and
		// Select is already the empty state, so those two keep their word.
		if (task === null) {
			if (libraryOpen || activeWorldTool === 'library' || activeWorldTool === 'select') return;
			// A planned row is inspectable without a task; only a landed tool that has
			// just completed belongs back at Select.
			if (worldTool(activeWorldTool).stage === 'planned') return;
			// Slice is landed but opens no task: it is a **reading**, and the reading is
			// its own state. Without this it bounced straight back to Select on arming,
			// which would also have emptied the A-4 tool rung.
			if (activeWorldTool === 'slice') return;
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
			status.setNotice('');
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
		height.cancelPlane();
	}

	function updatePreferences(next: AppPreferences): void {
		const real = performance.now() / 1000;
		motionClock.setSpeed(next.motionSpeed, real);
		preferences = next;
		writeAppPreferences(next);
	}

	function bumpContributions(): void {
		contributionsVersion += 1;
	}

	function _setTask(next: StageTask | null): void {
		task = next;
	}

	function _setContributedTask(next: { id: string; adapterId: string } | null): void {
		contributedTaskId = next;
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

	function setNotice(message: string): void {
		status.setNotice(message);
	}

	/** Clear a notice only when it is still the one that scheduled the clear. */
	function clearNotice(shown: string): void {
		status.clearNotice(shown);
	}

	function requestCardRename(target: SemanticReference | null = null): void {
		status.requestCardRename(target);
	}

	function consumeCardRename(request: number): void {
		status.consumeCardRename(request);
	}

	/** The new facade exists: bind the host tools and re-read session view state. */
	function bindFacade(next: StageFacade): void {
		measureTool = createStageMeasure(next);
		eraserTool = createStageEraser(next, () => refreshHostTools());
		paintTool = createStagePainter(
			next,
			{
				hasActive: () => input.finishes()?.hasActive() ?? false,
				isAlready: (entityIds) => input.finishes()?.activeIsAlready(entityIds) ?? false,
				assign: async (entityIds) =>
					(await input.finishes()?.paintEntities(entityIds)) === 'accepted',
				isSurfaceAlready: (surfaces) => input.finishes()?.activeSurfaceIsAlready(surfaces) ?? false,
				assignSurface: async (surfaces) => (await input.finishes()?.paintSurface(surfaces)) ?? false,
				dropperArmed: () => input.finishes()?.dropperArmed ?? false,
				copy: async (hit) => (await input.finishes()?.copyFrom(hit)) ?? false,
				copySurface: async (surface) => (await input.finishes()?.copySurface(surface)) ?? false,
				surfaceScope: () => paintScope,
				setSurfaceScope: (scope) => { paintScope = scope; },
				activeLabel: () => input.finishes()?.activeLabel() ?? 'Finish',
				sampleMessage: () => {
					const target = input.finishes()?.libraryDraft != null ? input.finishes()?.libraryDraftTarget() : undefined;
					return target == null ? null : `Draft preview on ${target.label} · nothing is written`;
				},
				wornLabel: (target) => input.finishes()?.wornLabel(target) ?? null,
				coatReading: (target) => input.finishes()?.coatReading(target) ?? null,
				onPaintedOne: (target) => input.onPaintedOne?.(target)
			},
			() => refreshHostTools()
		);
		drafting = next.drafting();
		task = null;
		contributedTaskId = null;
	}

	const armedHostTool = $derived(stageArmedHostTool(task));
	const showOffCount = $derived(
		[showMarkers, showFrustums, showPaths, showLabels].filter((on) => !on).length
	);
	const sheetLaneRight = $derived(height.side === 'right' ? sheetLaneWidth : 0);
	const sheetLaneLeft = $derived(height.side === 'left' ? sheetLaneWidth : 0);
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
		paintCandidate = paintTool?.candidate() ?? null;
		const result = stageHostToolOverlay({
			facade: input.facade(),
			armedHostTool,
			measureTool,
			eraserTool,
			paintTool,
			rect: input.rect(),
			measure: input.measure
		});
		hostToolOverlay = result.overlay;
		if (result.eraseHover === null) {
			if (eraseHover !== null) eraseHover = null;
		} else if (eraseHover === null || !sameEraseHover(eraseHover, result.eraseHover)) {
			eraseHover = result.eraseHover;
		}
		if (result.paintHover === null) {
			if (paintHover !== null) paintHover = null;
		} else if (paintHover === null || !sameEraseHover(paintHover, result.paintHover)) {
			paintHover = result.paintHover;
		}
	}

	/** End both host tools' view state; the command that closes a task calls this first. */
	function clearHostTools(): void {
		measureTool?.clear();
		eraserTool?.clear();
		paintTool?.clear();
		paintCandidate = null;
		eraseHover = null;
		paintHover = null;
		hostToolOverlay = null;
	}

	function syncGestureFade(lease: { readonly navigation?: boolean; readonly owner: string } | null): void {
		status.syncGestureFade(lease);
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
		height.setHeight(heightMetersValue, cause);
	}

	/** Session-only pin creation; pin removal is intentionally unexposed. */
	function addHeightPin(): void {
		height.addPin();
	}

	function setHeightPlaneActive(active: boolean): void {
		height.setPlaneActive(active);
	}

	function toggleReducedMotion(): void {
		reducedMotion = !reducedMotion;
		updatePreferences({ ...preferences, reducedMotion });
	}

	return {
		get notice() {
			return status.notice;
		},
		get previewProblem() {
			return status.previewProblem;
		},
		setPreviewProblem(value: unknown | null) {
			status.setPreviewProblem(value);
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
			return status.cardRenameRequest;
		},
		get cardRenameTarget() { return status.cardRenameTarget; },
		requestCardRename,
		consumeCardRename,
		get stageGesturing() { return status.stageGesturing; },
		get cardGesturing() {
			return status.cardGesturing;
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
		get furnishStripOpen() {
			return furnishStripOpen;
		},
		setFurnishStripOpen(value: boolean) {
			furnishStripOpen = value;
		},
		get libraryInvocation() {
			return libraryInvocation;
		},
		get libraryView() {
			return libraryView;
		},
		setLibraryView(value: StageLibraryView) {
			libraryView = value;
		},
		get libraryInspection() {
			return libraryInspection;
		},
		setLibraryInspection(value: LibraryInspectionSettings) {
			libraryInspection = value;
		},
		setLibraryInvocation(value: Omit<StageLibraryInvocation, 'nonce'>) {
			libraryInvocation = { ...value, nonce: libraryInvocation.nonce + 1 };
		},
		setToolBeforeLibrary(value: WorldToolId) {
			toolBeforeLibrary = value;
		},
		get inkReading() {
			return inkReading;
		},
		setInkReading(value: 'wall' | 'opening' | 'room' | 'terrace' | 'roof') {
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
		get libraryCategoryRequest() {
			return libraryCategoryRequest;
		},
		requestLibraryCategory(category: WorldLibraryCategory) {
			libraryCategoryRequest = { category, nonce: (libraryCategoryRequest?.nonce ?? 0) + 1 };
		},
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
		get paintTool() {
			return paintTool;
		},
		get paintCandidate() {
			return paintCandidate;
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
		get paintHover() {
			return paintHover;
		},
		setEraseHover(entry: StageSelectionEntry | null) {
			eraseHover = entry;
		},
		setPaintHover(entry: StageSelectionEntry | null) {
			paintHover = entry;
			if (entry === null) paintCandidate = null;
		},
		refreshHostTools,
		clearHostTools,
		get heightMeters() {
			return height.meters;
		},
		get heightTicks() {
			return height.ticks;
		},
		get heightPins() {
			return height.pins;
		},
		get heightSheetSide() {
			return height.side;
		},
		setHeightSheetSide(value: 'left' | 'right') {
			height.setSide(value);
		},
		get heightPlaneVisible() {
			return height.planeVisible;
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
