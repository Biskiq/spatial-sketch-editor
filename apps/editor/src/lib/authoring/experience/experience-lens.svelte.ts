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
import { EYE_HEIGHT_STEPS, LENS_STEPS } from './look-through';
import { isStageDrag } from '../stage/stage-input';
import type { StageFacade } from '../stage/stage-facade';
import type { ExperienceController } from './experience-controller.svelte';
import type { ExperienceGuideTransport } from './experience-homes';
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
	/** A live View-edit gesture owns the pointer. */
	viewEditActive: () => boolean;
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
		if (host.lens() !== 'experience' || host.viewEditActive()) return;
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
		if (host.viewEditActive()) return;
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
		advancePlayback,
		stopAndRestore,
		dispose
	};
}

export type ExperienceLens = ReturnType<typeof createExperienceLens>;
