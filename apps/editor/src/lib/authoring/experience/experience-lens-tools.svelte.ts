import { untrack } from 'svelte';
import { CAMERA_FOV } from '@portfolio/camera-core/camera';
import { frameSubjectPose, viewPlacementPose } from '@portfolio/camera-core/viewport';
import { isStageDrag } from '../stage/stage-input';
import { EYE_HEIGHT_STEPS, LENS_STEPS } from './look-through';
import type { ExperienceLensHost } from './experience-lens.svelte';

type StageTriple = [number, number, number];

export type ExperienceLensToolsPorts = {
	readonly host: ExperienceLensHost;
	readonly stopAndRestore: () => void;
	readonly viewEditActive: () => boolean;
};

export function createExperienceLensTools(ports: ExperienceLensToolsPorts) {
	/** Manual placement state: the press, its ghost and Present this's aim. */
	let placementPress = $state.raw<{
		readonly pointerId: number;
		readonly start: StageTriple;
		readonly css: readonly [number, number];
	} | null>(null);
	let placementGhost = $state.raw<ReturnType<typeof viewPlacementPose>>(null);
	let placementAim = $state<StageTriple | null>(null);
	/** Look through is a provisional posture over one authored View. */
	let lookThroughSession = $state<{
		readonly viewId: string;
		readonly presentationId: string;
		readonly label: string;
	} | null>(null);
	let lookThroughTick = $state(0);
	let lookThroughConfirm = $state<readonly string[] | null>(null);
	let lookThroughZoom: { pending: number; startedAt: number; applied: number } | null = null;
	const lookThroughPointers = new Map<number, { x: number; y: number; truck: boolean }>();

	function floorPlane() {
		const datum = ports.host.floorDatum();
		return {
			originMeters: [0, datum, 0] as StageTriple,
			normal: [0, 1, 0] as StageTriple,
			yawRadians: 0,
			datumMeters: datum,
			supportedLocalExtent: null,
		};
	}

	/** The Floor point under one pointer, through Camera's own ray and plane hit. */
	function placementPoint(event: PointerEvent): StageTriple | null {
		const stage = ports.host.stage();
		const id = stage?.evaluationId() ?? null;
		if (stage === null || id === null) return null;
		const ray = stage.pointerRay([...ports.host.absoluteCss(event)], id);
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
			defaultAzimuthRadians: ports.host.evaluation()?.pose.azimuthRadians,
			floorDatumMeters: ports.host.floorDatum(),
			fovYDegrees: CAMERA_FOV.default,
		});
	}

	function beginPlacement(event: PointerEvent): void {
		if (event.button !== 0 || placementPress !== null) return;
		const point = placementPoint(event);
		if (point === null) {
			ports.host.notice('Point at the Floor to place a View.');
			return;
		}
		if (!ports.host.capturePointer(event.currentTarget as HTMLElement, event.pointerId)) return;
		placementPress = {
			pointerId: event.pointerId,
			start: point,
			css: ports.host.absoluteCss(event),
		};
		placementGhost = placementPose(point, point);
	}

	function movePlacement(event: PointerEvent): void {
		const press = placementPress;
		if (press === null || event.pointerId !== press.pointerId) return;
		const point = placementPoint(event);
		if (point === null) return;
		const [x, y] = ports.host.absoluteCss(event);
		const dragged = isStageDrag({ x: press.css[0], y: press.css[1] }, { x, y });
		placementGhost = placementPose(press.start, dragged ? point : press.start);
	}

	function cancelPlacement(): void {
		const press = placementPress;
		placementPress = null;
		placementGhost = null;
		const stageEl = ports.host.stageElement();
		if (press !== null && stageEl?.hasPointerCapture?.(press.pointerId))
			stageEl.releasePointerCapture(press.pointerId);
	}

	function endPlacement(): void {
		const press = placementPress;
		const pose = placementGhost;
		placementPress = null;
		placementGhost = null;
		placementAim = null;
		if (press === null) return;
		const stageEl = ports.host.stageElement();
		if (stageEl?.hasPointerCapture?.(press.pointerId))
			stageEl.releasePointerCapture(press.pointerId);
		if (pose === null) {
			ports.host.notice('The View needs a target away from its eye.');
			return;
		}
		const controller = ports.host.activeController();
		if (controller === null) return;
		void controller
			.placeView({ eye: pose.eye, target: pose.target, fov: pose.fovYDegrees })
			.then((outcome) => {
				if (outcome.kind === 'refused') {
					ports.host.notice(outcome.message);
					return;
				}
				if (outcome.createdPresentation) {
					ports.host.renameRequest();
					ports.host.notice('Presentation created; name it in the Card.');
				} else {
					ports.host.notice('');
				}
			});
	}

	function togglePlaceView(): void {
		if (ports.host.lens() !== 'experience' || ports.viewEditActive()) return;
		if (ports.host.tool() === 'place') {
			ports.host.setTool('select');
			placementAim = null;
			cancelPlacement();
			ports.host.notice('');
			return;
		}
		if (lookThroughSession !== null) exitLookThrough();
		ports.stopAndRestore();
		ports.host.setTool('place');
		placementAim = null;
		ports.host.notice('');
	}

	/** Wheel travel accumulates until one 0.25 m Camera step is owed. */
	function queueLookThroughZoom(pixels: number, now: number): void {
		if (lookThroughSession === null) return;
		const remaining =
			lookThroughZoom === null ? 0 : lookThroughZoom.pending - lookThroughZoom.applied;
		lookThroughZoom = { pending: remaining - pixels * 0.004, startedAt: now, applied: 0 };
		lookThroughTick += 1;
	}

	function beginReaim(event: PointerEvent): void {
		if (event.button !== 0 && event.button !== 2) return;
		if (
			lookThroughPointers.size >= 2 ||
			(lookThroughPointers.size > 0 && event.pointerType !== 'touch')
		)
			return;
		if (!ports.host.capturePointer(event.currentTarget as HTMLElement, event.pointerId)) return;
		lookThroughPointers.set(event.pointerId, {
			x: event.clientX,
			y: event.clientY,
			truck: event.button === 2,
		});
	}

	function moveReaim(event: PointerEvent): void {
		const stage = ports.host.stage();
		const press = lookThroughPointers.get(event.pointerId);
		if (stage === null || press === undefined) return;
		const dx = event.clientX - press.x;
		const dy = event.clientY - press.y;
		press.x = event.clientX;
		press.y = event.clientY;
		if (dx === 0 && dy === 0) return;
		const scale = ports.host.evaluation()?.targetPlaneMetersPerCssPixel ?? 0;
		const touches = lookThroughPointers.size === 2;
		const pan = press.truck || event.shiftKey || touches;
		const share = touches ? 0.5 : 1;
		const moved = pan
			? scale > 0 && stage.camera.truckLookThrough(-dx * scale * share, dy * scale * share)
			: stage.camera.turnLookThrough(dx * 0.0032, dy * 0.0032);
		if (moved) {
			lookThroughTick += 1;
			ports.host.refresh();
		}
	}

	function endReaim(pointerId: number): void {
		lookThroughPointers.delete(pointerId);
		const stageEl = ports.host.stageElement();
		if (stageEl?.hasPointerCapture?.(pointerId)) stageEl.releasePointerCapture(pointerId);
	}

	function hasLookThroughPointer(pointerId: number): boolean {
		return lookThroughPointers.has(pointerId);
	}

	/** Ease remaining wheel travel through Camera's existing step intent. */
	function advanceLookThroughZoom(now: number, finish = false): void {
		const zoom = lookThroughZoom;
		const stage = ports.host.stage();
		if (zoom === null || stage === null || lookThroughSession === null) return;
		const progress =
			finish || ports.host.reducedMotion() ? 1 : Math.min(1, (now - zoom.startedAt) / 120);
		const next = zoom.pending * (1 - (1 - progress) ** 3);
		const delta = next - zoom.applied;
		zoom.applied = next;
		if (progress === 1) lookThroughZoom = null;
		if (delta !== 0 && stage.camera.stepLookThrough(delta)) lookThroughTick += 1;
	}

	function lookThroughView(viewId: string, presentationId?: string | null): void {
		if (ports.viewEditActive()) return;
		const stage = ports.host.stage();
		const controller = ports.host.activeController();
		if (stage === null || controller === null) return;
		const facts = controller.viewFacts(viewId);
		const pose = controller.viewPose(viewId);
		const owner = presentationId ?? facts?.presentationId ?? null;
		if (facts === null || pose === null || owner === null) {
			ports.host.notice('That View is not in this project.');
			return;
		}
		// The moving Follow pose must never become Look through's entry memory.
		ports.stopAndRestore();
		const result = stage.camera.beginLookThrough({
			viewId,
			presentationId: owner,
			label: facts.label,
			eye: pose.eye,
			target: pose.target,
			fovYDegrees: pose.fov,
		});
		if (result.kind === 'refused') {
			ports.host.notice(result.message);
			return;
		}
		if (ports.host.tool() === 'place') {
			ports.host.setTool('select');
			cancelPlacement();
		}
		lookThroughSession = { viewId, presentationId: owner, label: facts.label };
		lookThroughConfirm = null;
		lookThroughTick += 1;
		ports.host.refresh();
	}

	function exitLookThrough(): void {
		lookThroughZoom = null;
		for (const pointerId of lookThroughPointers.keys()) endReaim(pointerId);
		ports.host.stage()?.camera.endLookThrough();
		lookThroughSession = null;
		lookThroughConfirm = null;
		lookThroughTick += 1;
		ports.host.refresh();
	}

	/** Lens and Eye height step only the provisional Camera; Update View commits them. */
	function setLookThroughLens(fovYDegrees: number): boolean {
		const stage = ports.host.stage();
		if (stage === null || lookThroughSession === null) return false;
		if (!stage.camera.stepLookThroughLens(fovYDegrees)) return false;
		lookThroughTick += 1;
		ports.host.refresh();
		return true;
	}

	function setLookThroughEyeHeight(metres: number): boolean {
		const stage = ports.host.stage();
		if (stage === null || lookThroughSession === null) return false;
		if (!stage.camera.setLookThroughEyeHeight(metres, ports.host.floorDatum())) return false;
		lookThroughTick += 1;
		ports.host.refresh();
		return true;
	}

	async function updateLookThrough(confirmShared = false): Promise<void> {
		const controller = ports.host.activeController();
		const stage = ports.host.stage();
		const session = lookThroughSession;
		if (controller === null || stage === null || session === null) return;
		advanceLookThroughZoom(performance.now(), true);
		const provisional = stage.camera.provisionalView();
		if (provisional === null) return;
		const outcome = await controller.updateViewPose(
			session.viewId,
			{ eye: provisional.eye, target: provisional.target, fov: provisional.fovYDegrees },
			session.presentationId,
			{ confirmShared },
		);
		if (outcome.kind === 'needs-confirmation') {
			lookThroughConfirm = outcome.alsoIn;
			return;
		}
		if (outcome.kind === 'updated') {
			stage.camera.commitLookThrough();
			lookThroughConfirm = null;
			lookThroughTick += 1;
			ports.host.refresh();
			return;
		}
		ports.host.notice(outcome.message);
	}

	async function captureProvisional(): Promise<void> {
		const controller = ports.host.activeController();
		const provisional = ports.host.stage()?.camera.provisionalView() ?? null;
		if (controller === null || provisional === null) return;
		await controller.capturePose({
			eye: provisional.eye,
			target: provisional.target,
			fov: provisional.fovYDegrees,
		});
	}

	/** Frame the new View through Camera without changing the Stage's reading. */
	async function presentThis(entityId: string, label: string): Promise<void> {
		const stage = ports.host.stage();
		const controller = ports.host.activeController();
		if (stage === null || controller === null) return;
		const bounds = stage.sceneBounds(entityId);
		if (
			stage.camera.state().reading === 'plan' ||
			ports.host.evaluation()?.projectionKind === 'plan-orthographic'
		) {
			placementAim =
				bounds === null
					? null
					: [
							(bounds.min[0] + bounds.max[0]) / 2,
							(bounds.min[1] + bounds.max[1]) / 2,
							(bounds.min[2] + bounds.max[2]) / 2,
						];
			ports.stopAndRestore();
			ports.host.setTool('place');
			ports.host.notice(`Place a View aimed at ${label}: click where the camera stands.`);
			return;
		}
		const viewerEye = stage.evaluation()?.eye;
		const framed =
			bounds === null || viewerEye === undefined
				? null
				: frameSubjectPose({
						bounds,
						viewerEye,
						eyeYMeters: ports.host.floorDatum() + EYE_HEIGHT_STEPS[1]!.metres,
						fovYDegrees: LENS_STEPS[1]!.fovYDegrees,
						aspect: 16 / 10,
					});
		if (framed === null) {
			ports.host.notice('The Stage could not frame that subject.');
			return;
		}
		await controller.presentThisFramed(entityId, label, {
			eye: framed.eye,
			target: framed.target,
			fov: framed.fovYDegrees,
		});
	}

	const lookThroughMoved = $derived.by(() => {
		void lookThroughTick;
		return ports.host.stage()?.camera.lookThrough()?.moved ?? false;
	});

	const lookThroughFraming = $derived.by(() => {
		void lookThroughTick;
		const provisional = ports.host.stage()?.camera.provisionalView() ?? null;
		return provisional === null
			? null
			: {
					fovYDegrees: provisional.fovYDegrees,
					eyeHeightMetres: provisional.eye[1] - ports.host.floorDatum(),
				};
	});

	// Leaving the lens ends the provisional posture; the entry standpoint is never
	// restored into another lens's Camera.
	$effect(() => {
		if (ports.host.lens() !== 'experience' && lookThroughSession !== null) untrack(exitLookThrough);
	});

	return {
		get placementPress() {
			return placementPress;
		},
		get placementGhost() {
			return placementGhost;
		},
		get placementAim() {
			return placementAim;
		},
		aimPlacement(point: StageTriple | null) {
			placementAim = point;
		},
		beginPlacement,
		movePlacement,
		cancelPlacement,
		endPlacement,
		togglePlaceView,
		get lookThroughSession() {
			return lookThroughSession;
		},
		get lookThroughTick() {
			return lookThroughTick;
		},
		get lookThroughConfirm() {
			return lookThroughConfirm;
		},
		clearLookThroughConfirm() {
			lookThroughConfirm = null;
		},
		get lookThroughMoved() {
			return lookThroughMoved;
		},
		get lookThroughFraming() {
			return lookThroughFraming;
		},
		get lookThroughViewId() {
			return lookThroughSession?.viewId ?? null;
		},
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
	};
}
