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
import { CAMERA_FOV, frameSubjectPose, viewPlacementPose, type ViewportCameraState } from '@portfolio/camera-core';
import { CAMERA_FRUSTUM_FAR_METRES, CAMERA_LENS_OFFSET_METRES } from './experience-marks';
import { createEditorCameraFramingBasis, createEditorCameraFovDragBasis, evaluateEditorCameraFovDrag } from '../camera/editor-camera-framing';
import { axisTravelFromRay } from '../stage/stage-axis-travel';
import { EYE_HEIGHT_STEPS, LENS_STEPS } from './look-through';
import {
	angleDelta,
	frameView,
	moveViewOnFloor,
	planLensFromDrag,
	snapViewDrag,
	turnViewAboutEye,
	viewEditMoved,
	viewTilt,
	yawFromEye,
	type AdvancedViewFraming,
	type AuthoredViewPose,
	type ViewEditKind
} from './experience-view-edit';
import { isStageDrag } from '../stage/stage-input';
import type { StageFacade } from '../stage/stage-facade';
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
	let restorePending = $state.raw<{ readonly stage: object; readonly standpoint: ViewportCameraState } | null>(null);
	let disposed = false;

	/** Manual placement state: the press, its ghost and Present this's aim. */
	let placementPress = $state.raw<{ readonly pointerId: number; readonly start: StageTriple; readonly css: readonly [number, number] } | null>(null);
	let placementGhost = $state.raw<ReturnType<typeof viewPlacementPose>>(null);
	let placementAim = $state<StageTriple | null>(null);
	/** Look through is a provisional posture over one authored View. */
	let lookThroughSession = $state<{ readonly viewId: string; readonly presentationId: string; readonly label: string } | null>(null);
	let lookThroughTick = $state(0);
	let lookThroughConfirm = $state<readonly string[] | null>(null);
	let lookThroughZoom: { pending: number; startedAt: number; applied: number } | null = null;
	const lookThroughPointers = new Map<number, { x: number; y: number; truck: boolean }>();

	let advancedCamera = $state(false);
	const advancedViewId = $derived(
		advancedCamera && host.tool() === 'select' && lookThroughSession === null &&
			playback.status === 'idle' && !host.previewOpen() && !host.previewBusy()
			? host.activeController()?.selectedView?.id ?? null : null
	);
	type ViewEditSession = {
		readonly viewId: string;
		readonly presentationId: string;
		readonly kind: ViewEditKind;
		readonly pointerId: number;
		readonly capture: Element;
		readonly start: AuthoredViewPose;
		eye: StageTriple;
		target: StageTriple;
		fov: number;
		readonly advanced: boolean;
		readonly sourceRevision: string;
		readonly handleId: string;
		readonly origin: readonly [number, number];
		readonly lease: { readonly active: boolean; release(): void };
		readonly resolve: (event: PointerEvent, id: string) => AuthoredViewPose | null;
		pointer: readonly [number, number];
		moved: boolean;
	};
	/** A live marker drag: the authored View is untouched until release. */
	let viewEdit = $state<ViewEditSession | null>(null);
	/** A marker edit that changes a View another Presentation also lists, awaiting confirmation. */
	let pendingViewWrite = $state<{
		readonly viewId: string;
		readonly presentationId: string;
		readonly pose: AuthoredViewPose;
		readonly alsoIn: readonly string[];
		readonly sourceRevision: string;
	} | null>(null);

	/** Playback is a Guide instrument: any takeover or armed tool ends it. */
	const suppressed = $derived(
		host.previewOpen() ||
			host.previewBusy() ||
			host.previewRequested() ||
			lookThroughSession !== null ||
			placementPress !== null ||
			placementAim !== null ||
			host.tool() === 'place' ||
			host.lens() !== 'experience' ||
			!host.guideOpen()
	);

	/** S30 playback writes the one Camera through a set-view intent, never a pose copy. */
	function applyView(view: PlaybackView): boolean {
		const stage = host.stage();
		if (stage === null) return false;
		const ticket = stage.inspectionTicket();
		if (ticket === null) return false;
		const result = stage.requestViewingIntent(
			{ kind: 'set-view', eye: view.eye, target: view.target, fovYDegrees: view.fov },
			ticket,
			performance.now() / 1000
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
			entryStopId: source.entryStopId
		});
		return map.kind === 'ready' ? map.map.totalSeconds : null;
	}

	function playGuide(guideId: string, action: ExperienceGuideTransport): void {
		const controller = host.activeController();
		if (
			controller === null ||
			host.lens() !== 'experience' ||
			host.previewOpen() ||
			host.previewBusy() ||
			host.previewRequested() ||
			lookThroughSession !== null ||
			placementPress !== null ||
			placementAim !== null ||
			host.tool() === 'place'
		) return;
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
	/** S28 Escape precedence: provisional write, marker edit, place, then Look through. */
	function escape(): boolean {
		if (pendingViewWrite !== null) {
			pendingViewWrite = null;
			return true;
		}
		if (viewEdit !== null) {
			cancelViewEdit();
			return true;
		}
		if (host.tool() === 'place') {
			host.setTool('select');
			placementAim = null;
			cancelPlacement();
			host.notice('');
			return true;
		}
		if (lookThroughSession !== null) {
			exitLookThrough();
			return true;
		}
		return false;
	}

	/** Look through owns the wheel: a drag turns the provisional view, never the Stage. */
	function wheelZoom(event: WheelEvent, viewportHeight: number): boolean {
		if (viewEdit !== null) return true;
		if (lookThroughSession === null) return false;
		const now = performance.now();
		advanceLookThroughZoom(now);
		const pixels = event.deltaY * (event.deltaMode === 1 ? 40 : event.deltaMode === 2 ? viewportHeight : 1);
		queueLookThroughZoom(pixels, now);
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
				set: (on) => { advancedCamera = on; },
				eligible: (viewId) => advancedViewId === viewId,
				busy: () => viewEdit !== null || pendingViewWrite !== null,
				pose: (viewId) => {
					const edit = viewEdit;
					return edit?.advanced && edit.viewId === viewId && edit.moved ? edit : null;
				},
				write: setAdvancedViewFraming
			},
			lookThroughViewId: () => lookThroughSession?.viewId ?? null,
			lookThroughMoved: () => lookThroughMoved,
			lookThroughFraming: () => lookThroughFraming,
			lookThroughLens: setLookThroughLens,
			lookThroughEyeHeight: setLookThroughEyeHeight,
			lookThrough: lookThroughView,
			exitLookThrough,
			updateLookThrough: () => updateLookThrough(),
			captureProvisional,
			presentThis,
			playback: () => playback,
			previewMode: slots.previewMode,
			guideSeconds,
			guideForStop: slots.guideForStop,
			playGuide
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
		void lookThroughSession !== null;
		void host.previewOpen();
		if (restorePending === null) return;
		if (lookThroughSession !== null || host.previewOpen()) return;
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
			fov: sample.fov
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
			if (event.key !== ' ' || !host.guideOpen() || host.lens() !== 'experience' || host.previewOpen()) return;
			if (host.activeController()?.busy === true || suppressed) return;
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				target.closest('input, textarea, select, button, a[href], [contenteditable="true"], [role="menu"], [role="slider"]') !== null
			) return;
			event.preventDefault();
			playback.playPause();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function floorPlane() {
		const datum = host.floorDatum();
		return {
			originMeters: [0, datum, 0] as StageTriple,
			normal: [0, 1, 0] as StageTriple,
			yawRadians: 0,
			datumMeters: datum,
			supportedLocalExtent: null
		};
	}

	/** The Floor point under one pointer, through Camera's own ray and plane hit. */
	function placementPoint(event: PointerEvent): StageTriple | null {
		const stage = host.stage();
		const id = stage?.evaluationId() ?? null;
		if (stage === null || id === null) return null;
		const ray = stage.pointerRay([...host.absoluteCss(event)], id);
		if (ray.kind !== 'ray') return null;
		const hit = stage.intersectWorkingPlane(ray.ray, floorPlane(), id);
		return hit.kind === 'intersected' ? hit.worldPoint : null;
	}

	function placementPose(start: StageTriple, current: StageTriple) {
		return viewPlacementPose({
			startFloorPoint: start,
			currentFloorPoint: current,
			aimPoint: placementAim,
			minimumDragMeters: 0,
			defaultAzimuthRadians: host.evaluation()?.pose.azimuthRadians,
			floorDatumMeters: host.floorDatum(),
			fovYDegrees: CAMERA_FOV.default
		});
	}

	function beginPlacement(event: PointerEvent): void {
		if (event.button !== 0 || placementPress !== null) return;
		const point = placementPoint(event);
		if (point === null) {
			host.notice('Point at the Floor to place a View.');
			return;
		}
		if (!host.capturePointer(event.currentTarget as HTMLElement, event.pointerId)) return;
		placementPress = { pointerId: event.pointerId, start: point, css: host.absoluteCss(event) };
		placementGhost = placementPose(point, point);
	}

	function movePlacement(event: PointerEvent): void {
		const press = placementPress;
		if (press === null || event.pointerId !== press.pointerId) return;
		const point = placementPoint(event);
		if (point === null) return;
		const [x, y] = host.absoluteCss(event);
		const dragged = isStageDrag({ x: press.css[0], y: press.css[1] }, { x, y });
		placementGhost = placementPose(press.start, dragged ? point : press.start);
	}

	function cancelPlacement(): void {
		const press = placementPress;
		placementPress = null;
		placementGhost = null;
		const stageEl = host.stageElement();
		if (press !== null && stageEl?.hasPointerCapture?.(press.pointerId)) stageEl.releasePointerCapture(press.pointerId);
	}

	function endPlacement(): void {
		const press = placementPress;
		const pose = placementGhost;
		placementPress = null;
		placementGhost = null;
		placementAim = null;
		if (press === null) return;
		const stageEl = host.stageElement();
		if (stageEl?.hasPointerCapture?.(press.pointerId)) stageEl.releasePointerCapture(press.pointerId);
		if (pose === null) {
			host.notice('The View needs a target away from its eye.');
			return;
		}
		const controller = host.activeController();
		if (controller === null) return;
		void controller.placeView({ eye: pose.eye, target: pose.target, fov: pose.fovYDegrees }).then((outcome) => {
			if (outcome.kind === 'refused') {
				host.notice(outcome.message);
				return;
			}
			if (outcome.createdPresentation) {
				host.renameRequest();
				host.notice('Presentation created; name it in the Card.');
			} else {
				host.notice('');
			}
		});
	}

	function togglePlaceView(): void {
		if (host.lens() !== 'experience' || viewEdit !== null) return;
		if (host.tool() === 'place') {
			host.setTool('select');
			placementAim = null;
			cancelPlacement();
			host.notice('');
			return;
		}
		if (lookThroughSession !== null) exitLookThrough();
		stopAndRestore();
		host.setTool('place');
		placementAim = null;
		host.notice('');
	}

	/** Wheel travel accumulates until one 0.25 m Camera step is owed. */
	function queueLookThroughZoom(pixels: number, now: number): void {
		if (lookThroughSession === null) return;
		const remaining = lookThroughZoom === null ? 0 : lookThroughZoom.pending - lookThroughZoom.applied;
		lookThroughZoom = { pending: remaining - pixels * 0.004, startedAt: now, applied: 0 };
		lookThroughTick += 1;
	}

	function beginReaim(event: PointerEvent): void {
		if (event.button !== 0 && event.button !== 2) return;
		if (lookThroughPointers.size >= 2 || (lookThroughPointers.size > 0 && event.pointerType !== 'touch')) return;
		if (!host.capturePointer(event.currentTarget as HTMLElement, event.pointerId)) return;
		lookThroughPointers.set(event.pointerId, { x: event.clientX, y: event.clientY, truck: event.button === 2 });
	}

	function moveReaim(event: PointerEvent): void {
		const stage = host.stage();
		const press = lookThroughPointers.get(event.pointerId);
		if (stage === null || press === undefined) return;
		const dx = event.clientX - press.x;
		const dy = event.clientY - press.y;
		press.x = event.clientX;
		press.y = event.clientY;
		if (dx === 0 && dy === 0) return;
		const scale = host.evaluation()?.targetPlaneMetersPerCssPixel ?? 0;
		const touches = lookThroughPointers.size === 2;
		const pan = press.truck || event.shiftKey || touches;
		const share = touches ? 0.5 : 1;
		const moved = pan
			? scale > 0 && stage.camera.truckLookThrough(-dx * scale * share, dy * scale * share)
			: stage.camera.turnLookThrough(dx * 0.0032, dy * 0.0032);
		if (moved) {
			lookThroughTick += 1;
			host.refresh();
		}
	}

	function endReaim(pointerId: number): void {
		lookThroughPointers.delete(pointerId);
		const stageEl = host.stageElement();
		if (stageEl?.hasPointerCapture?.(pointerId)) stageEl.releasePointerCapture(pointerId);
	}

	function hasLookThroughPointer(pointerId: number): boolean {
		return lookThroughPointers.has(pointerId);
	}

	/** Ease remaining wheel travel through Camera's existing step intent. */
	function advanceLookThroughZoom(now: number, finish = false): void {
		const zoom = lookThroughZoom;
		const stage = host.stage();
		if (zoom === null || stage === null || lookThroughSession === null) return;
		const progress = finish || host.reducedMotion() ? 1 : Math.min(1, (now - zoom.startedAt) / 120);
		const next = zoom.pending * (1 - (1 - progress) ** 3);
		const delta = next - zoom.applied;
		zoom.applied = next;
		if (progress === 1) lookThroughZoom = null;
		if (delta !== 0 && stage.camera.stepLookThrough(delta)) lookThroughTick += 1;
	}

	function lookThroughView(viewId: string, presentationId?: string | null): void {
		if (viewEdit !== null) return;
		const stage = host.stage();
		const controller = host.activeController();
		if (stage === null || controller === null) return;
		const facts = controller.viewFacts(viewId);
		const pose = controller.viewPose(viewId);
		const owner = presentationId ?? facts?.presentationId ?? null;
		if (facts === null || pose === null || owner === null) {
			host.notice('That View is not in this project.');
			return;
		}
		// The moving Follow pose must never become Look through's entry memory.
		stopAndRestore();
		const result = stage.camera.beginLookThrough({
			viewId,
			presentationId: owner,
			label: facts.label,
			eye: pose.eye,
			target: pose.target,
			fovYDegrees: pose.fov
		});
		if (result.kind === 'refused') {
			host.notice(result.message);
			return;
		}
		if (host.tool() === 'place') {
			host.setTool('select');
			cancelPlacement();
		}
		lookThroughSession = { viewId, presentationId: owner, label: facts.label };
		lookThroughConfirm = null;
		lookThroughTick += 1;
		host.refresh();
	}

	function exitLookThrough(): void {
		lookThroughZoom = null;
		for (const pointerId of lookThroughPointers.keys()) endReaim(pointerId);
		host.stage()?.camera.endLookThrough();
		lookThroughSession = null;
		lookThroughConfirm = null;
		lookThroughTick += 1;
		host.refresh();
	}

	/** Lens and Eye height step only the provisional Camera; Update View commits them. */
	function setLookThroughLens(fovYDegrees: number): boolean {
		const stage = host.stage();
		if (stage === null || lookThroughSession === null) return false;
		if (!stage.camera.stepLookThroughLens(fovYDegrees)) return false;
		lookThroughTick += 1;
		host.refresh();
		return true;
	}

	function setLookThroughEyeHeight(metres: number): boolean {
		const stage = host.stage();
		if (stage === null || lookThroughSession === null) return false;
		if (!stage.camera.setLookThroughEyeHeight(metres, host.floorDatum())) return false;
		lookThroughTick += 1;
		host.refresh();
		return true;
	}

	async function updateLookThrough(confirmShared = false): Promise<void> {
		const controller = host.activeController();
		const stage = host.stage();
		const session = lookThroughSession;
		if (controller === null || stage === null || session === null) return;
		advanceLookThroughZoom(performance.now(), true);
		const provisional = stage.camera.provisionalView();
		if (provisional === null) return;
		const outcome = await controller.updateViewPose(
			session.viewId,
			{ eye: provisional.eye, target: provisional.target, fov: provisional.fovYDegrees },
			session.presentationId,
			{ confirmShared }
		);
		if (outcome.kind === 'needs-confirmation') {
			lookThroughConfirm = outcome.alsoIn;
			return;
		}
		if (outcome.kind === 'updated') {
			stage.camera.commitLookThrough();
			lookThroughConfirm = null;
			lookThroughTick += 1;
			host.refresh();
			return;
		}
		host.notice(outcome.message);
	}

	async function captureProvisional(): Promise<void> {
		const controller = host.activeController();
		const provisional = host.stage()?.camera.provisionalView() ?? null;
		if (controller === null || provisional === null) return;
		await controller.capturePose({ eye: provisional.eye, target: provisional.target, fov: provisional.fovYDegrees });
	}

	/** Frame the new View through Camera without changing the Stage's reading. */
	async function presentThis(entityId: string, label: string): Promise<void> {
		const stage = host.stage();
		const controller = host.activeController();
		if (stage === null || controller === null) return;
		const bounds = stage.sceneBounds(entityId);
		if (stage.camera.state().reading === 'plan' || host.evaluation()?.projectionKind === 'plan-orthographic') {
			placementAim = bounds === null ? null : [
				(bounds.min[0] + bounds.max[0]) / 2,
				(bounds.min[1] + bounds.max[1]) / 2,
				(bounds.min[2] + bounds.max[2]) / 2
			];
			stopAndRestore();
			host.setTool('place');
			host.notice(`Place a View aimed at ${label}: click where the camera stands.`);
			return;
		}
		const viewerEye = stage.evaluation()?.eye;
		const framed = bounds === null || viewerEye === undefined ? null : frameSubjectPose({
			bounds,
			viewerEye,
			eyeYMeters: host.floorDatum() + EYE_HEIGHT_STEPS[1]!.metres,
			fovYDegrees: LENS_STEPS[1]!.fovYDegrees,
			aspect: 16 / 10
		});
		if (framed === null) {
			host.notice('The Stage could not frame that subject.');
			return;
		}
		await controller.presentThisFramed(entityId, label, { eye: framed.eye, target: framed.target, fov: framed.fovYDegrees });
	}

	const lookThroughMoved = $derived.by(() => {
		void lookThroughTick;
		return host.stage()?.camera.lookThrough()?.moved ?? false;
	});

	const lookThroughFraming = $derived.by(() => {
		void lookThroughTick;
		const provisional = host.stage()?.camera.provisionalView() ?? null;
		return provisional === null
			? null
			: { fovYDegrees: provisional.fovYDegrees, eyeHeightMetres: provisional.eye[1] - host.floorDatum() };
	});

	// Leaving the lens ends the provisional posture; the entry standpoint is never
	// restored into another lens's Camera.
	$effect(() => {
		if (host.lens() !== 'experience' && lookThroughSession !== null) untrack(exitLookThrough);
	});

	function viewEditResolver(event: PointerEvent, pose: AuthoredViewPose, kind: ViewEditKind, mark: Element, id: string, advanced: boolean): ViewEditSession['resolve'] | null {
		const stage = host.stage();
		if (stage === null) return null;
		const origin = host.absoluteCss(event);
		const datum = host.floorDatum();
		const framed = (frameKind: AdvancedViewFraming['kind'], value: number, next: PointerEvent) =>
			frameView(pose, { kind: frameKind, value: snapViewDrag(frameKind, value, next) }, datum);
		if (kind === 'move') {
			const grab = host.pathAnchorPoint(origin, datum);
			if (grab === null) return null;
			return (next) => {
				const point = host.pathAnchorPoint(host.absoluteCss(next), datum);
				if (point === null) return null;
				const x = pose.eye[0] + point[0] - grab[0];
				const z = pose.eye[2] + point[2] - grab[2];
				return moveViewOnFloor(pose, [advanced ? snapViewDrag('move', x, next) : x, datum,
					advanced ? snapViewDrag('move', z, next) : z]);
			};
		}
		if (kind === 'turn') {
			// Plan is orthographic. The datum gives the same X/Z even when the
			// authored eye is above Plan's depth range (including an empty World).
			const point = host.pathAnchorPoint(origin, datum);
			const grab = point === null ? null : yawFromEye(pose, point);
			if (grab === null) return null;
			return (next) => {
				const hit = host.pathAnchorPoint(host.absoluteCss(next), datum);
				const yaw = hit === null ? null : yawFromEye(pose, hit);
				if (yaw === null) return null;
				const degrees = angleDelta(yaw, grab) * 180 / Math.PI;
				return turnViewAboutEye(pose, snapViewDrag('turn', degrees, next) * Math.PI / 180);
			};
		}
		if (kind === 'lift') {
			const travel = (next: PointerEvent, evaluationId: string) => {
				const result = stage.pointerRay(host.absoluteCss(next), evaluationId);
				return result.kind !== 'ray' ? null : axisTravelFromRay({
					origin: [...pose.eye], direction: [0, 1, 0], rayOrigin: result.ray.origin, rayDirection: result.ray.direction
				});
			};
			const grab = travel(event, id);
			if (grab === null) return null;
			return (next, evaluationId) => {
				const distance = travel(next, evaluationId);
				return distance === null ? null : framed('lift', pose.eye[1] - datum + distance - grab, next);
			};
		}
		if (kind === 'tilt') {
			const tilt = viewTilt(pose);
			return (next) => framed('tilt', tilt - (next.clientY - origin[1]) * 0.45, next);
		}

		const side = mark.getAttribute('data-side') === '-1' ? -1 : 1;
		const apexX = mark.getAttribute('data-apex-x');
		const apexY = mark.getAttribute('data-apex-y');
		if (apexX !== null && apexY !== null) {
			const angle = (next: PointerEvent) => {
				const x = next.clientX - Number(apexX);
				const y = next.clientY - Number(apexY);
				return Math.hypot(x, y) < 4 ? null : Math.atan2(y, x);
			};
			const grab = angle(event);
			if (grab === null) return null;
			return (next) => {
				const current = angle(next);
				return current === null ? null : framed('lens', planLensFromDrag(pose.fov, grab, current, side), next);
			};
		}
		const initialRay = stage.pointerRay(origin, id);
		if (initialRay.kind !== 'ray' || Math.hypot(...pose.target.map((v, i) => v - pose.eye[i]!)) <= 1e-6) return null;
		const basis = createEditorCameraFramingBasis([...pose.eye], [...pose.target]);
		const forward: StageTriple = [basis.forward.x, basis.forward.y, basis.forward.z];
		const up: StageTriple = [basis.up.x, basis.up.y, basis.up.z];
		const depth = CAMERA_FRUSTUM_FAR_METRES;
		const center = basis.eye.clone().addScaledVector(basis.forward, CAMERA_LENS_OFFSET_METRES + depth);
		const plane = {
			originMeters: [center.x, center.y, center.z] as StageTriple,
			normal: forward,
			yawRadians: Math.atan2(forward[0], forward[2]) + Math.PI / 2,
			datumMeters: null,
			supportedLocalExtent: null
		};
		const grab = stage.intersectWorkingPlane(initialRay.ray, plane, id);
		const dragBasis = createEditorCameraFovDragBasis({
			eye: [...pose.eye], forward, up, depth, fov0: pose.fov,
			side: side === 1 ? 'top' : 'bottom',
			rayDirection: initialRay.ray.direction,
			p0: grab.kind === 'intersected' ? grab.worldPoint : null,
			startClientY: event.clientY
		});
		return (next, evaluationId) => {
			const ray = stage.pointerRay(host.absoluteCss(next), evaluationId);
			if (ray.kind !== 'ray') return null;
			const hit = stage.intersectWorkingPlane(ray.ray, plane, evaluationId);
			return framed('lens', evaluateEditorCameraFovDrag(
				dragBasis, hit.kind === 'intersected' ? hit.worldPoint : null,
				side === -1 && dragBasis.useSlider ? origin[1] * 2 - next.clientY : next.clientY,
				ray.ray.direction
			), next);
		};
	}

	function beginViewEdit(event: PointerEvent, viewId: string, kind: ViewEditKind, mark: Element): void {
		const stage = host.stage();
		const controller = host.activeController();
		const id = stage?.evaluationId() ?? null;
		const advanced = viewId === advancedViewId;
		const handleId = mark.getAttribute('data-advanced-handle');
		if (event.button !== 0 || (!advanced && event.shiftKey) || viewEdit !== null || pendingViewWrite !== null) return;
		if (stage === null || controller === null || controller.busy || id === null || host.evaluation() === null) return;
		if (handleId !== null && !advanced) return;
		if (!advanced && kind === 'move' && host.evaluation()?.projectionKind !== 'plan-orthographic') return;
		const facts = controller.viewFacts(viewId);
		const pose = controller.viewPose(viewId);
		if (facts === null || pose === null) return;
		const resolve = viewEditResolver(event, pose, kind, mark, id, advanced);
		if (resolve === null) return;
		const acquisition = stage.acquireGesture({ owner: 'experience-view-edit', evaluationId: id, policy: 'cancel-on-reading-change' });
		if (acquisition.kind !== 'granted') {
			host.notice(`The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`);
			return;
		}
		// Advanced handles may go out of frame while held. Capture on the stable Stage.
		const capture = handleId !== null ? host.stageElement() ?? null : event.target instanceof Element ? event.target : null;
		if (capture === null || !host.capturePointer(capture, event.pointerId)) {
			acquisition.lease.release();
			return;
		}
		if (handleId !== null) host.refusePress(event.pointerId);
		host.clearHover();
		viewEdit = {
			viewId,
			presentationId: controller.selectedView?.id === viewId ? controller.selectedView.presentationId : facts.presentationId,
			kind,
			pointerId: event.pointerId,
			capture,
			start: pose,
			eye: [...pose.eye],
			target: [...pose.target],
			fov: pose.fov,
			advanced,
			handleId: handleId ?? '',
			origin: host.absoluteCss(event),
			pointer: host.stageCss(event),
			sourceRevision: controller.sourceRevision,
			lease: acquisition.lease,
			resolve,
			moved: false
		};
	}

	function updateViewEdit(event: PointerEvent): void {
		const edit = viewEdit;
		const id = host.stage()?.evaluationId() ?? null;
		if (edit === null || id === null || event.pointerId !== edit.pointerId) return;
		const distance = Math.hypot(event.clientX - edit.origin[0], event.clientY - edit.origin[1]);
		const pose = distance < 2 ? edit.start : edit.resolve(event, id);
		if (pose === null) return;
		viewEdit = { ...edit, eye: [...pose.eye], target: [...pose.target], fov: pose.fov,
			pointer: host.stageCss(event), moved: viewEditMoved(edit.kind, edit.start, pose) };
	}

	function releaseViewEditPointer(edit: ViewEditSession): void {
		if (edit.capture.hasPointerCapture?.(edit.pointerId)) edit.capture.releasePointerCapture(edit.pointerId);
		edit.lease.release();
	}

	function viewEditIsCurrent(edit: ViewEditSession): boolean {
		return host.stage() !== null && edit.lease.active && host.gestureActive() &&
			host.activeController()?.sourceRevision === edit.sourceRevision &&
			(!edit.advanced || (advancedViewId === edit.viewId && host.showMarkers() &&
				(host.showFrustums() || (edit.kind !== 'tilt' && edit.kind !== 'lens'))));
	}

	// Reading/source/selection changes cancel provisional work before it can become a write.
	$effect(() => {
		const edit = viewEdit;
		if (edit === null) return;
		void host.evaluationGeneration();
		if (!viewEditIsCurrent(edit)) untrack(cancelViewEdit);
	});

	function cancelViewEdit(): void {
		const edit = viewEdit;
		viewEdit = null;
		if (edit !== null) releaseViewEditPointer(edit);
	}

	async function endViewEdit(): Promise<void> {
		const edit = viewEdit;
		if (edit === null) return;
		const current = viewEditIsCurrent(edit);
		cancelViewEdit();
		if (current && edit.moved) await writeViewEdit(edit.viewId, edit.presentationId, edit, edit.sourceRevision);
	}

	async function writeViewEdit(viewId: string, presentationId: string, pose: AuthoredViewPose, sourceRevision: string): Promise<void> {
		const controller = host.activeController();
		if (controller === null || controller.sourceRevision !== sourceRevision || controller.busy) return;
		// Keep only the Camera payload, never the captured pointer or its live gesture.
		const next = { eye: pose.eye, target: pose.target, fov: pose.fov };
		const outcome = await controller.updateViewPose(viewId, next, presentationId);
		if (outcome.kind === 'needs-confirmation') {
			pendingViewWrite = { viewId, presentationId, pose: next, alsoIn: outcome.alsoIn, sourceRevision };
		} else if (outcome.kind === 'updated') {
			host.refresh();
		} else {
			host.notice(outcome.message);
		}
	}

	async function setAdvancedViewFraming(viewId: string, edit: AdvancedViewFraming): Promise<void> {
		const controller = host.activeController();
		if (controller === null || viewId !== advancedViewId || viewEdit !== null || pendingViewWrite !== null) return;
		const facts = controller.viewFacts(viewId);
		const start = controller.viewPose(viewId);
		if (facts === null || start === null) return;
		const pose = frameView(start, edit, host.floorDatum());
		if (viewEditMoved(edit.kind, start, pose)) await writeViewEdit(viewId, controller.selectedView?.presentationId ?? facts.presentationId, pose, controller.sourceRevision);
	}

	async function confirmPendingViewWrite(): Promise<void> {
		const pending = pendingViewWrite;
		pendingViewWrite = null;
		if (pending === null) return;
		const controller = host.activeController();
		if (controller === null || controller.sourceRevision !== pending.sourceRevision) return;
		const outcome = await controller.updateViewPose(pending.viewId, pending.pose, pending.presentationId, {
			confirmShared: true
		});
		if (outcome.kind === 'updated') {
			host.refresh();
		} else if (outcome.kind === 'refused') {
			host.notice(outcome.message);
		}
	}

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
		playGuide,
		install,
		homes,
		escape,
		wheelZoom,
		// Manual placement
		placementPress: () => placementPress,
		placementGhost: () => placementGhost,
		placementAim: () => placementAim,
		aimPlacement: (point: StageTriple | null) => { placementAim = point; },
		beginPlacement,
		movePlacement,
		cancelPlacement,
		endPlacement,
		togglePlaceView,
		// Look through
		lookThroughSession: () => lookThroughSession,
		lookThroughTick: () => lookThroughTick,
		lookThroughConfirm: () => lookThroughConfirm,
		clearLookThroughConfirm: () => { lookThroughConfirm = null; },
		lookThroughMoved: () => lookThroughMoved,
		lookThroughFraming: () => lookThroughFraming,
		lookThroughViewId: () => lookThroughSession?.viewId ?? null,
		queueLookThroughZoom,
		advanceLookThroughZoom,
		beginReaim,
		moveReaim,
		endReaim,
		hasLookThroughPointer,
		lookThroughView,
		exitLookThrough,
		setLookThroughLens,
		setLookThroughEyeHeight,
		updateLookThrough,
		captureProvisional,
		presentThis,
		// View edit
		advancedCamera: () => advancedCamera,
		setAdvancedCamera: (on: boolean) => { advancedCamera = on; },
		advancedViewId: () => advancedViewId,
		viewEdit: () => viewEdit,
		pendingViewWrite: () => pendingViewWrite,
		clearPendingViewWrite: () => { pendingViewWrite = null; },
		beginViewEdit,
		updateViewEdit,
		cancelViewEdit,
		endViewEdit,
		setAdvancedViewFraming,
		confirmPendingViewWrite,
		advancePlayback,
		stopAndRestore,
		dispose
	};
}

export type ExperienceLens = ReturnType<typeof createExperienceLens>;
