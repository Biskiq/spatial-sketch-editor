/**
 * The Experience lens: the route-local posture that runs before adapter routing.
 *
 * It owns the ephemeral Guide playback session and the exact settled inspection Follow
 * restores. It never owns selection, history or Camera state: a Follow sample is written
 * through the Stage's one set-view intent, and the entry standpoint is restored through
 * Camera's own command.
 *
 * Construct it during route initialisation so its `$effect`s belong to the route's effect
 * tree. `dispose()` is idempotent: lens exit, project replacement and route teardown may
 * each ask, and only the first restore happens.
 */
import { tick, untrack } from 'svelte';
import { type ViewportCameraState } from '@portfolio/camera-core/viewport';
import { createExperienceViewEditSession } from './experience-view-edit-session.svelte';
import { createExperienceLensTools } from './experience-lens-tools.svelte';
import type { StageFacade } from '../stage/stage-facade';
import type {
	StagePostureClaim,
	StagePostureLayer,
	StagePostureMark,
} from '../stage/stage-adapter-host';
import type { ExperienceController } from './experience-controller.svelte';
import type { ExperienceGuideTransport, ExperienceHomes } from './experience-homes';
import type { ExperienceSubject } from './experience-model';
import { guideTimeMapForProgram } from './playback-map';
import { createExperiencePlayback, shouldWritePlaybackSample } from './playback.svelte';

export type ExperienceLensHost = {
	/** The controller the lens shows; null in World. */
	activeController: () => ExperienceController | null;
	stage: () => StageFacade | null;
	lens: () => 'world' | 'experience';
	guideOpen: () => boolean;
	setGuideOpen: (open: boolean) => void;
	reducedMotion: () => boolean;
	previewOpen: () => boolean;
	previewBusy: () => boolean;
	previewRequested: () => boolean;
	readonly tool: () => 'select' | 'place';
	readonly setTool: (tool: 'select' | 'place') => void;
	readonly absoluteCss: (event: PointerEvent) => readonly [number, number];
	readonly stageElement: () => HTMLElement | undefined;
	readonly capturePointer: (target: Element, pointerId: number) => boolean;
	readonly floorDatum: () => number;
	readonly evaluation: () => {
		readonly pose: { readonly azimuthRadians: number };
		readonly targetPlaneMetersPerCssPixel?: number;
		readonly projectionKind?: string;
	} | null;
	/** The new Presentation's inline name editor is the Card's. */
	readonly renameRequest: () => void;
	readonly refresh: () => void;
	readonly pathAnchorPoint: (css: readonly [number, number], height: number) => StageTriple | null;
	readonly stageCss: (event: PointerEvent) => readonly [number, number];
	readonly showMarkers: () => boolean;
	readonly showFrustums: () => boolean;
	readonly gestureActive: () => boolean;
	readonly refusePress: (pointerId: number) => void;
	readonly clearHover: () => void;
	readonly evaluationGeneration: () => number;
	notice: (message: string) => void;
	/** The one Card selection: the Stage selection it replaces is cleared first. */
	readonly clearStageSelection: () => void;
	readonly openCard: () => void;
	/** The Card's link-to-Stage pick, owned by the route's selection slot. */
	readonly pickActive: () => boolean;
	readonly cancelPick: () => void;
	/** Experience Esc unwinding after the route's shared dismiss checks. */
	readonly dismiss: () => boolean;
};

type StageTriple = [number, number, number];

type PlaybackView = {
	readonly eye: [number, number, number];
	readonly target: [number, number, number];
	readonly fov: number;
};

export function createExperienceLens(host: ExperienceLensHost) {
	const playback = createExperiencePlayback(() => host.activeController()?.playbackSource ?? null);
	/** The exact settled inspection (pose **and** reading) Follow restores. */
	let entryStandpoint = $state.raw<ViewportCameraState | null>(null);
	/** The Stage that captured the standpoint; a replacement must never inherit it. */
	let entryStage = $state.raw<object | null>(null);
	/** A restore refused while a handoff owned the Camera; retry only on the same Stage. */
	let restorePending = $state.raw<{
		readonly stage: object;
		readonly standpoint: ViewportCameraState;
	} | null>(null);
	let disposed = false;

	const tools = createExperienceLensTools({
		host,
		stopAndRestore: () => stopAndRestore(),
		viewEditActive: () => viewEditSession.active !== null,
	});

	let advancedCamera = $state(false);
	const advancedViewId = $derived(
		advancedCamera &&
			host.tool() === 'select' &&
			tools.lookThroughSession === null &&
			playback.status === 'idle' &&
			!host.previewOpen() &&
			!host.previewBusy()
			? (host.activeController()?.selectedView?.id ?? null)
			: null,
	);

	const viewEditSession = createExperienceViewEditSession({
		host,
		advancedViewId: () => advancedViewId,
	});

	/** Playback is a Guide instrument: any takeover or armed tool ends it. */
	const suppressed = $derived(
		host.previewOpen() ||
			host.previewBusy() ||
			host.previewRequested() ||
			tools.lookThroughSession !== null ||
			tools.placementPress !== null ||
			tools.placementAim !== null ||
			host.tool() === 'place' ||
			host.lens() !== 'experience' ||
			!host.guideOpen(),
	);

	/** Playback writes the one Camera through a set-view intent, never a pose copy. */
	function applyView(view: PlaybackView): boolean {
		const stage = host.stage();
		if (stage === null) return false;
		const ticket = stage.inspectionTicket();
		if (ticket === null) return false;
		const result = stage.requestViewingIntent(
			{ kind: 'set-view', eye: view.eye, target: view.target, fovYDegrees: view.fov },
			ticket,
			performance.now() / 1000,
		);
		return result.kind === 'accepted';
	}

	/** A Card transport action opens its own Guide; the rail need not be open first. */
	function guideSeconds(guideId: string): number | null {
		const source = host.activeController()?.playbackSourceFor(guideId) ?? null;
		if (source === null) return null;
		const map = guideTimeMapForProgram({
			program: source.program,
			transitions: source.transitions,
			graph: source.graph,
			entryStopId: source.entryStopId,
		});
		return map.kind === 'ready' ? map.map.totalSeconds : null;
	}

	/** Show the instrument on the active Guide, or on the entry Guide when none is active. */
	function openGuide(guideId?: string): void {
		const controller = host.activeController();
		if (guideId !== undefined) controller?.openGuide(guideId);
		else if (controller !== null && controller.currentGuide === null) {
			const entryGuideId = controller.current?.entryGuideId ?? null;
			if (entryGuideId !== null) controller.openGuide(entryGuideId);
		}
		host.setGuideOpen(true);
	}

	/** The dock's Guide key: show or hide the instrument for the active Guide. */
	function toggleGuide(): void {
		if (host.guideOpen()) {
			host.setGuideOpen(false);
			return;
		}
		openGuide();
	}

	/** Why Capture cannot run, or undefined when it can. */
	function captureReason(): string | undefined {
		const controller = host.activeController();
		if (controller === null) return undefined;
		if (controller.busy) return 'Wait for the current change';
		return undefined;
	}

	/**
	 * A Card subject replaces the Stage selection. Nothing here moves the Camera.
	 */
	function selectSubject(subject: ExperienceSubject | null): void {
		host.clearStageSelection();
		host.activeController()?.select(subject);
		host.openCard();
	}

	function playGuide(guideId: string, action: ExperienceGuideTransport): void {
		const controller = host.activeController();
		if (
			controller === null ||
			host.lens() !== 'experience' ||
			host.previewOpen() ||
			host.previewBusy() ||
			host.previewRequested() ||
			tools.lookThroughSession !== null ||
			tools.placementPress !== null ||
			tools.placementAim !== null ||
			host.tool() === 'place'
		)
			return;
		controller.openGuide(guideId);
		host.setGuideOpen(true);
		void tick().then(() => {
			if (host.activeController() !== controller || !host.guideOpen()) return;
			playback.prepare();
			if (action.kind === 'start') playback.playFromStart();
			else if (action.kind === 'stop') playback.playFromStop(action.stopId);
			else playback.previewMove(action.occurrence);
		});
	}

	/** Synchronously end Follow and restore its exact entry before any handoff. */
	function stopAndRestore(): void {
		const stage = host.stage();
		if (restorePending !== null && restorePending.stage !== stage) restorePending = null;
		playback.stop();
		if (entryStandpoint !== null) restoreEntry(stage);
	}

	function restoreEntry(stage: StageFacade | null = host.stage()): boolean {
		const standpoint = entryStandpoint;
		if (standpoint === null) return true;
		if (stage === null || entryStage !== stage) {
			// Never write an old Stage's standpoint into a replacement.
			entryStandpoint = null;
			entryStage = null;
			return false;
		}
		if (!stage.camera.restoreStandpoint(standpoint)) {
			restorePending = { stage, standpoint };
			return false;
		}
		entryStandpoint = null;
		entryStage = null;
		restorePending = null;
		return true;
	}

	/** Register the lens's lifecycle effects during route initialisation. */
	/** Press precedence after pinch: a live edit, then Look through, place, a View glyph. */
	function pointerDown(event: PointerEvent, mark: StagePostureMark | null): boolean {
		if (viewEditSession.active !== null) return true;
		if (tools.lookThroughSession !== null) {
			tools.beginReaim(event);
			return true;
		}
		if (host.tool() === 'place') {
			tools.beginPlacement(event);
			return true;
		}
		if (
			host.tool() === 'select' &&
			event.button === 0 &&
			mark !== null &&
			(!event.shiftKey || mark.viewId === advancedViewId)
		) {
			if (
				mark.kind === 'eye' ||
				mark.kind === 'move' ||
				mark.kind === 'turn' ||
				mark.kind === 'lift' ||
				mark.kind === 'tilt' ||
				mark.kind === 'lens'
			) {
				viewEditSession.begin(
					event,
					mark.viewId,
					mark.kind === 'eye' ? 'move' : mark.kind,
					mark.mark,
				);
			}
			// A 3D glyph is a click entry, not navigation: never claim the Stage
			// pointer lease or capture on the Stage ancestor.
			return true;
		}
		return false;
	}

	/** A Stage click belongs to the lens over a glyph, in Look through, or while placing. */
	function ownsClick(overMark: boolean): boolean {
		return (
			host.lens() === 'experience' &&
			(overMark || tools.lookThroughSession !== null || host.tool() === 'place')
		);
	}

	/** Move precedence after pinch: a marker edit, then re-aim, then placement. */
	function pointerMove(event: PointerEvent): boolean {
		if (viewEditSession.active !== null) {
			viewEditSession.update(event);
			return true;
		}
		if (tools.lookThroughSession !== null) {
			tools.moveReaim(event);
			return true;
		}
		if (tools.placementPress !== null) {
			tools.movePlacement(event);
			return true;
		}
		return false;
	}

	function pointerUp(event: PointerEvent): boolean {
		const edit = viewEditSession.active;
		if (edit !== null) {
			if (edit.pointerId === event.pointerId) {
				viewEditSession.update(event);
				void viewEditSession.end();
			}
			return true;
		}
		if (tools.lookThroughSession !== null) {
			tools.endReaim(event.pointerId);
			return true;
		}
		if (tools.placementPress?.pointerId === event.pointerId) {
			tools.endPlacement();
			return true;
		}
		return false;
	}

	function pointerCancel(event: PointerEvent): boolean {
		if (viewEditSession.active !== null) {
			if (viewEditSession.active.pointerId === event.pointerId) viewEditSession.cancel();
			return true;
		}
		if (tools.lookThroughSession !== null) {
			tools.endReaim(event.pointerId);
			return true;
		}
		if (tools.placementPress?.pointerId === event.pointerId) {
			tools.cancelPlacement();
			return true;
		}
		return false;
	}

	function lostCapture(event: PointerEvent): boolean {
		if (viewEditSession.active?.pointerId === event.pointerId) {
			viewEditSession.cancel();
			return true;
		}
		if (tools.hasLookThroughPointer(event.pointerId)) {
			tools.endReaim(event.pointerId);
			return true;
		}
		if (tools.placementPress?.pointerId === event.pointerId) {
			tools.cancelPlacement();
			return true;
		}
		return false;
	}

	/** Escape precedence: provisional write, marker edit, place, then Look through. */
	function escape(): boolean {
		if (viewEditSession.pending !== null) {
			viewEditSession.clearPending();
			return true;
		}
		if (viewEditSession.active !== null) {
			viewEditSession.cancel();
			return true;
		}
		if (host.tool() === 'place') {
			host.setTool('select');
			tools.aimPlacement(null);
			tools.cancelPlacement();
			host.notice('');
			return true;
		}
		if (tools.lookThroughSession !== null) {
			tools.exitLookThrough();
			return true;
		}
		return false;
	}

	/**
	 * Experience keys. `capture` runs before Stage key handling; `unwind` runs after the
	 * route has exhausted its shared dismiss checks.
	 */
	function key(event: KeyboardEvent, phase: 'capture' | 'unwind' = 'capture'): StagePostureClaim {
		if (phase === 'unwind') return event.key === 'Escape' && host.dismiss() ? 'claimed' : 'pass';
		if (event.key === 'Escape') {
			if (host.pickActive()) {
				host.cancelPick();
				return 'claimed';
			}
			return escape() ? 'claimed' : 'pass';
		}
		if (
			event.key === 'ArrowLeft' &&
			event.altKey &&
			!event.metaKey &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.defaultPrevented
		) {
			if (host.activeController()?.back()) {
				host.openCard();
				return 'claimed';
			}
			return 'pass';
		}
		if (event.key === 'Backspace' || event.key === 'Delete') {
			const controller = host.activeController();
			const anchorId = controller?.selectedAnchorId ?? null;
			if (controller !== null && anchorId !== null) {
				void controller.removePathAnchor(anchorId);
				return 'claimed';
			}
		}
		return 'pass';
	}

	/** Leaving the lens ends transient posture; an armed Place never survives into World. */
	function deactivate(): void {
		if (host.tool() === 'place') {
			host.setTool('select');
			tools.aimPlacement(null);
			tools.cancelPlacement();
			host.notice('');
		}
		if (tools.lookThroughSession !== null) tools.exitLookThrough();
		if (viewEditSession.pending !== null) viewEditSession.clearPending();
		if (viewEditSession.active !== null) viewEditSession.cancel();
	}

	/** Look through owns the wheel: a drag turns the provisional view, never the Stage. */
	function wheelZoom(event: WheelEvent, viewportHeight: number): boolean {
		if (viewEditSession.active !== null) return true;
		if (tools.lookThroughSession === null) return false;
		const now = performance.now();
		tools.advanceLookThroughZoom(now);
		const pixels =
			event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? viewportHeight : 1);
		tools.queueLookThroughZoom(pixels, now);
		return true;
	}

	/** The Card and Guide homes, wired from the lens's own posture. */
	function homes(slots: {
		readonly controller: () => ExperienceController | null;
		readonly guideOpen: () => boolean;
		readonly setGuideOpen: (open: boolean) => void;
		readonly select: (subject: ExperienceSubject | null) => void;
		readonly sceneSubject: () => { readonly entityId: string; readonly label: string } | null;
		readonly openInWorld: () => void;
		readonly pickStageSubject?: (presentationId: string) => boolean;
		readonly previewMode: (mode: 'guided' | 'free', guideId: string | null) => void;
		readonly guideForStop: (stopId: string) => string | null;
	}): ExperienceHomes {
		return {
			controller: slots.controller,
			guideOpen: slots.guideOpen,
			setGuideOpen: slots.setGuideOpen,
			select: slots.select,
			sceneSubject: slots.sceneSubject,
			openInWorld: slots.openInWorld,
			pickStageSubject: slots.pickStageSubject,
			advancedCamera: {
				on: () => advancedCamera,
				set: (on) => {
					advancedCamera = on;
				},
				eligible: (viewId) => advancedViewId === viewId,
				busy: () => viewEditSession.active !== null || viewEditSession.pending !== null,
				pose: (viewId) => {
					const edit = viewEditSession.active;
					return edit?.advanced && edit.viewId === viewId && edit.moved ? edit : null;
				},
				write: viewEditSession.setAdvancedFraming,
			},
			lookThroughViewId: () => tools.lookThroughViewId,
			lookThroughMoved: () => tools.lookThroughMoved,
			lookThroughFraming: () => tools.lookThroughFraming,
			lookThroughLens: tools.setLookThroughLens,
			lookThroughEyeHeight: tools.setLookThroughEyeHeight,
			lookThrough: tools.lookThroughView,
			exitLookThrough: tools.exitLookThrough,
			updateLookThrough: () => tools.updateLookThrough(),
			captureProvisional: tools.captureProvisional,
			presentThis: tools.presentThis,
			playback: () => playback,
			previewMode: slots.previewMode,
			guideSeconds,
			guideForStop: slots.guideForStop,
			playGuide,
		};
	}

	function install(): void {
		$effect(() => {
			const source = host.activeController()?.playbackSource ?? null;
			playback.setReducedMotion(host.reducedMotion());
			playback.setBlocked(suppressed);
			if (source === null || host.lens() !== 'experience' || !host.guideOpen()) {
				stopAndRestore();
				return;
			}
			// Derive as soon as the Guide opens; an accepted edit derives a new map
			// immediately and stops the old clock. Refused edits never reach here.
			if (playback.source !== source || playback.map === null) {
				if (playback.following) stopAndRestore();
				playback.invalidate();
				playback.prepare();
			}
		});
		$effect(() => {
			if (suppressed && playback.status !== 'idle') stopAndRestore();
		});
		$effect(() => {
			if (playback.following && entryStandpoint === null && host.stage() !== null) {
				entryStandpoint = host.stage()!.camera.captureStandpoint();
				entryStage = host.stage();
			}
		});
		$effect(() => {
			if (!playback.following && entryStandpoint !== null) restoreEntry();
		});
		$effect(() => {
			const stage = host.stage();
			void tools.lookThroughSession !== null;
			void host.previewOpen();
			if (restorePending === null) return;
			if (tools.lookThroughSession !== null || host.previewOpen()) return;
			if (restorePending.stage !== stage) {
				restorePending = null;
				return;
			}
			const pending = restorePending;
			restorePending = null;
			restoreEntry(stage);
			void pending;
		});
		$effect(() => {
			// A replacement owns a new Camera: drop, never transplant, the old entry.
			const stage = host.stage();
			if (entryStage !== null && entryStage !== stage) {
				entryStandpoint = null;
				entryStage = null;
			}
			if (restorePending !== null && restorePending.stage !== stage) restorePending = null;
		});
	}

	/**
	 * The playback clock runs inside the Stage's own frame loop (`advancePlayback`,
	 * called just before the Camera is evaluated), so a Follow pose is written and
	 * drawn in the same frame.
	 */
	let playbackClock: number | null = null;
	let lastFollowSample: typeof playback.sample = null;
	function writeFollowSample(): void {
		const sample = playback.sample;
		if (sample === null || !shouldWritePlaybackSample(playback.following, suppressed)) {
			lastFollowSample = null;
			return;
		}
		if (sample === lastFollowSample) return;
		lastFollowSample = sample;
		const accepted = applyView({
			eye: [sample.eye[0], sample.eye[1], sample.eye[2]],
			target: [sample.target[0], sample.target[1], sample.target[2]],
			fov: sample.fov,
		});
		// A refused write stops the run instead of letting the playhead drift on
		// a Camera the Stage no longer owns.
		if (!accepted) playback.fail('The Stage refused the playback camera.');
	}
	function advancePlayback(now: number): void {
		if (playback.status !== 'playing' || suppressed) {
			playbackClock = null;
		} else {
			if (playbackClock !== null) playback.tick((now - playbackClock) / 1000);
			playbackClock = now;
		}
		writeFollowSample();
	}
	// A seek, a Stop press or Follow turning on while paused writes at once; the
	// frame loop covers playing.
	$effect(() => {
		void playback.sample;
		void playback.following;
		untrack(() => writeFollowSample());
	});

	$effect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.defaultPrevented) return;
			if (event.key === 'Escape' && playback.following) {
				event.preventDefault();
				playback.setFollow(false);
				return;
			}
			if (
				event.key !== ' ' ||
				!host.guideOpen() ||
				host.lens() !== 'experience' ||
				host.previewOpen()
			)
				return;
			if (host.activeController()?.busy === true || suppressed) return;
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				target.closest(
					'input, textarea, select, button, a[href], [contenteditable="true"], [role="menu"], [role="slider"]',
				) !== null
			)
				return;
			event.preventDefault();
			playback.playPause();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	const posture: StagePostureLayer = {
		id: 'experience-lens',
		pointerDown: (event, mark) => (pointerDown(event, mark) ? 'claimed' : 'pass'),
		pointerMove: (event) => (pointerMove(event) ? 'claimed' : 'pass'),
		pointerUp: (event) => (pointerUp(event) ? 'claimed' : 'pass'),
		pointerCancel: (event) => (pointerCancel(event) ? 'claimed' : 'pass'),
		lostCapture: (event) => (lostCapture(event) ? 'claimed' : 'pass'),
		pinch: () => 'pass',
		click: (_event, overMark) => (ownsClick(overMark) ? 'claimed' : 'pass'),
		wheel: (event, viewportHeight) => (wheelZoom(event, viewportHeight) ? 'claimed' : 'pass'),
		interrupt: () => {
			if (viewEditSession.active === null) return 'pass';
			viewEditSession.cancel();
			return 'claimed';
		},
		key,
		deactivate,
		dispose,
	};

	/** Idempotent: the first caller restores the entry and stops the session. */
	function dispose(): void {
		if (disposed) return;
		disposed = true;
		stopAndRestore();
	}

	return {
		playback,
		get suppressed() {
			return suppressed;
		},
		guideSeconds,
		openGuide,
		toggleGuide,
		captureReason,
		selectSubject,
		playGuide,
		install,
		homes,
		posture,
		escape,
		key,
		deactivate,
		wheelZoom,
		pointerDown,
		ownsClick,
		pointerMove,
		pointerUp,
		pointerCancel,
		lostCapture,
		// Manual placement
		placementPress: () => tools.placementPress,
		placementGhost: () => tools.placementGhost,
		placementAim: () => tools.placementAim,
		aimPlacement: tools.aimPlacement,
		beginPlacement: tools.beginPlacement,
		movePlacement: tools.movePlacement,
		cancelPlacement: tools.cancelPlacement,
		endPlacement: tools.endPlacement,
		togglePlaceView: tools.togglePlaceView,
		// Look through
		lookThroughSession: () => tools.lookThroughSession,
		lookThroughTick: () => tools.lookThroughTick,
		lookThroughConfirm: () => tools.lookThroughConfirm,
		clearLookThroughConfirm: tools.clearLookThroughConfirm,
		lookThroughMoved: () => tools.lookThroughMoved,
		lookThroughFraming: () => tools.lookThroughFraming,
		lookThroughViewId: () => tools.lookThroughViewId,
		queueLookThroughZoom: tools.queueLookThroughZoom,
		advanceLookThroughZoom: tools.advanceLookThroughZoom,
		beginReaim: tools.beginReaim,
		moveReaim: tools.moveReaim,
		endReaim: tools.endReaim,
		hasLookThroughPointer: tools.hasLookThroughPointer,
		lookThroughView: tools.lookThroughView,
		exitLookThrough: tools.exitLookThrough,
		setLookThroughLens: tools.setLookThroughLens,
		setLookThroughEyeHeight: tools.setLookThroughEyeHeight,
		updateLookThrough: tools.updateLookThrough,
		captureProvisional: tools.captureProvisional,
		presentThis: tools.presentThis,
		// View edit
		advancedCamera: () => advancedCamera,
		setAdvancedCamera: (on: boolean) => {
			advancedCamera = on;
		},
		advancedViewId: () => advancedViewId,
		viewEdit: () => viewEditSession.active,
		pendingViewWrite: () => viewEditSession.pending,
		clearPendingViewWrite: () => {
			viewEditSession.clearPending();
		},
		beginViewEdit: viewEditSession.begin,
		updateViewEdit: viewEditSession.update,
		cancelViewEdit: viewEditSession.cancel,
		endViewEdit: viewEditSession.end,
		setAdvancedViewFraming: viewEditSession.setAdvancedFraming,
		confirmPendingViewWrite: viewEditSession.confirmPending,
		advancePlayback,
		stopAndRestore,
		dispose,
	};
}

export type ExperienceLens = ReturnType<typeof createExperienceLens>;
