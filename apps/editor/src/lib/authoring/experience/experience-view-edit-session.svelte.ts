import { untrack } from 'svelte';
import {
	createEditorCameraFramingBasis,
	createEditorCameraFovDragBasis,
	evaluateEditorCameraFovDrag,
} from '../camera/editor-camera-framing';
import { axisTravelFromRay } from '../stage/stage-axis-travel';
import { CAMERA_LENS_OFFSET_METRES } from './experience-camera-mesh';
import { CAMERA_FRUSTUM_FAR_METRES } from './experience-marks';
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
	type ViewEditKind,
} from './experience-view-edit';
import type { ExperienceLensHost } from './experience-lens.svelte';

type StageTriple = [number, number, number];

export type ExperienceViewEditPorts = {
	readonly host: ExperienceLensHost;
	readonly advancedViewId: () => string | null;
};

export function createExperienceViewEditSession(ports: ExperienceViewEditPorts) {
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

	function viewEditResolver(
		event: PointerEvent,
		pose: AuthoredViewPose,
		kind: ViewEditKind,
		mark: Element,
		id: string,
		advanced: boolean,
	): ViewEditSession['resolve'] | null {
		const stage = ports.host.stage();
		if (stage === null) return null;
		const origin = ports.host.absoluteCss(event);
		const datum = ports.host.floorDatum();
		const framed = (frameKind: AdvancedViewFraming['kind'], value: number, next: PointerEvent) =>
			frameView(pose, { kind: frameKind, value: snapViewDrag(frameKind, value, next) }, datum);
		if (kind === 'move') {
			const grab = ports.host.pathAnchorPoint(origin, datum);
			if (grab === null) return null;
			return (next) => {
				const point = ports.host.pathAnchorPoint(ports.host.absoluteCss(next), datum);
				if (point === null) return null;
				const x = pose.eye[0] + point[0] - grab[0];
				const z = pose.eye[2] + point[2] - grab[2];
				return moveViewOnFloor(pose, [
					advanced ? snapViewDrag('move', x, next) : x,
					datum,
					advanced ? snapViewDrag('move', z, next) : z,
				]);
			};
		}
		if (kind === 'turn') {
			// Plan is orthographic. The datum gives the same X/Z even when the
			// authored eye is above Plan's depth range (including an empty World).
			const point = ports.host.pathAnchorPoint(origin, datum);
			const grab = point === null ? null : yawFromEye(pose, point);
			if (grab === null) return null;
			return (next) => {
				const hit = ports.host.pathAnchorPoint(ports.host.absoluteCss(next), datum);
				const yaw = hit === null ? null : yawFromEye(pose, hit);
				if (yaw === null) return null;
				const degrees = (angleDelta(yaw, grab) * 180) / Math.PI;
				return turnViewAboutEye(pose, (snapViewDrag('turn', degrees, next) * Math.PI) / 180);
			};
		}
		if (kind === 'lift') {
			const travel = (next: PointerEvent, evaluationId: string) => {
				const result = stage.pointerRay(ports.host.absoluteCss(next), evaluationId);
				return result.kind !== 'ray'
					? null
					: axisTravelFromRay({
							origin: [...pose.eye],
							direction: [0, 1, 0],
							rayOrigin: result.ray.origin,
							rayDirection: result.ray.direction,
						});
			};
			const grab = travel(event, id);
			if (grab === null) return null;
			return (next, evaluationId) => {
				const distance = travel(next, evaluationId);
				return distance === null
					? null
					: framed('lift', pose.eye[1] - datum + distance - grab, next);
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
				return current === null
					? null
					: framed('lens', planLensFromDrag(pose.fov, grab, current, side), next);
			};
		}
		const initialRay = stage.pointerRay(origin, id);
		if (
			initialRay.kind !== 'ray' ||
			Math.hypot(...pose.target.map((v, i) => v - pose.eye[i]!)) <= 1e-6
		)
			return null;
		const basis = createEditorCameraFramingBasis([...pose.eye], [...pose.target]);
		const forward: StageTriple = [basis.forward.x, basis.forward.y, basis.forward.z];
		const up: StageTriple = [basis.up.x, basis.up.y, basis.up.z];
		const depth = CAMERA_FRUSTUM_FAR_METRES;
		const center = basis.eye
			.clone()
			.addScaledVector(basis.forward, CAMERA_LENS_OFFSET_METRES + depth);
		const plane = {
			originMeters: [center.x, center.y, center.z] as StageTriple,
			normal: forward,
			yawRadians: Math.atan2(forward[0], forward[2]) + Math.PI / 2,
			datumMeters: null,
			supportedLocalExtent: null,
		};
		const grab = stage.intersectWorkingPlane(initialRay.ray, plane, id);
		const dragBasis = createEditorCameraFovDragBasis({
			eye: [...pose.eye],
			forward,
			up,
			depth,
			fov0: pose.fov,
			side: side === 1 ? 'top' : 'bottom',
			rayDirection: initialRay.ray.direction,
			p0: grab.kind === 'intersected' ? grab.worldPoint : null,
			startClientY: event.clientY,
		});
		return (next, evaluationId) => {
			const ray = stage.pointerRay(ports.host.absoluteCss(next), evaluationId);
			if (ray.kind !== 'ray') return null;
			const hit = stage.intersectWorkingPlane(ray.ray, plane, evaluationId);
			return framed(
				'lens',
				evaluateEditorCameraFovDrag(
					dragBasis,
					hit.kind === 'intersected' ? hit.worldPoint : null,
					side === -1 && dragBasis.useSlider ? origin[1] * 2 - next.clientY : next.clientY,
					ray.ray.direction,
				),
				next,
			);
		};
	}

	function beginViewEdit(
		event: PointerEvent,
		viewId: string,
		kind: ViewEditKind,
		mark: Element,
	): void {
		const stage = ports.host.stage();
		const controller = ports.host.activeController();
		const id = stage?.evaluationId() ?? null;
		const advanced = viewId === ports.advancedViewId();
		const handleId = mark.getAttribute('data-advanced-handle');
		if (
			event.button !== 0 ||
			(!advanced && event.shiftKey) ||
			viewEdit !== null ||
			pendingViewWrite !== null
		)
			return;
		if (
			stage === null ||
			controller === null ||
			controller.busy ||
			id === null ||
			ports.host.evaluation() === null
		)
			return;
		if (handleId !== null && !advanced) return;
		if (
			!advanced &&
			kind === 'move' &&
			ports.host.evaluation()?.projectionKind !== 'plan-orthographic'
		)
			return;
		const facts = controller.viewFacts(viewId);
		const pose = controller.viewPose(viewId);
		if (facts === null || pose === null) return;
		const resolve = viewEditResolver(event, pose, kind, mark, id, advanced);
		if (resolve === null) return;
		const acquisition = stage.acquireGesture({
			owner: 'experience-view-edit',
			evaluationId: id,
			policy: 'cancel-on-reading-change',
		});
		if (acquisition.kind !== 'granted') {
			ports.host.notice(
				`The ${acquisition.owner} gesture owns the pointer; finish or cancel it first.`,
			);
			return;
		}
		// Advanced handles may go out of frame while held. Capture on the stable Stage.
		const capture =
			handleId !== null
				? (ports.host.stageElement() ?? null)
				: event.target instanceof Element
					? event.target
					: null;
		if (capture === null || !ports.host.capturePointer(capture, event.pointerId)) {
			acquisition.lease.release();
			return;
		}
		if (handleId !== null) ports.host.refusePress(event.pointerId);
		ports.host.clearHover();
		viewEdit = {
			viewId,
			presentationId:
				controller.selectedView?.id === viewId
					? controller.selectedView.presentationId
					: facts.presentationId,
			kind,
			pointerId: event.pointerId,
			capture,
			start: pose,
			eye: [...pose.eye],
			target: [...pose.target],
			fov: pose.fov,
			advanced,
			handleId: handleId ?? '',
			origin: ports.host.absoluteCss(event),
			pointer: ports.host.stageCss(event),
			sourceRevision: controller.sourceRevision,
			lease: acquisition.lease,
			resolve,
			moved: false,
		};
	}

	function updateViewEdit(event: PointerEvent): void {
		const edit = viewEdit;
		const id = ports.host.stage()?.evaluationId() ?? null;
		if (edit === null || id === null || event.pointerId !== edit.pointerId) return;
		const distance = Math.hypot(event.clientX - edit.origin[0], event.clientY - edit.origin[1]);
		const pose = distance < 2 ? edit.start : edit.resolve(event, id);
		if (pose === null) return;
		viewEdit = {
			...edit,
			eye: [...pose.eye],
			target: [...pose.target],
			fov: pose.fov,
			pointer: ports.host.stageCss(event),
			moved: viewEditMoved(edit.kind, edit.start, pose),
		};
	}

	function releaseViewEditPointer(edit: ViewEditSession): void {
		if (edit.capture.hasPointerCapture?.(edit.pointerId))
			edit.capture.releasePointerCapture(edit.pointerId);
		edit.lease.release();
	}

	function viewEditIsCurrent(edit: ViewEditSession): boolean {
		return (
			ports.host.stage() !== null &&
			edit.lease.active &&
			ports.host.gestureActive() &&
			ports.host.activeController()?.sourceRevision === edit.sourceRevision &&
			(!edit.advanced ||
				(ports.advancedViewId() === edit.viewId &&
					ports.host.showMarkers() &&
					(ports.host.showFrustums() || (edit.kind !== 'tilt' && edit.kind !== 'lens'))))
		);
	}

	// Reading/source/selection changes cancel provisional work before it can become a write.
	$effect(() => {
		const edit = viewEdit;
		if (edit === null) return;
		void ports.host.evaluationGeneration();
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
		if (current && edit.moved)
			await writeViewEdit(edit.viewId, edit.presentationId, edit, edit.sourceRevision);
	}

	async function writeViewEdit(
		viewId: string,
		presentationId: string,
		pose: AuthoredViewPose,
		sourceRevision: string,
	): Promise<void> {
		const controller = ports.host.activeController();
		if (controller === null || controller.sourceRevision !== sourceRevision || controller.busy)
			return;
		// Keep only the Camera payload, never the captured pointer or its live gesture.
		const next = { eye: pose.eye, target: pose.target, fov: pose.fov };
		const outcome = await controller.updateViewPose(viewId, next, presentationId);
		if (outcome.kind === 'needs-confirmation') {
			pendingViewWrite = {
				viewId,
				presentationId,
				pose: next,
				alsoIn: outcome.alsoIn,
				sourceRevision,
			};
		} else if (outcome.kind === 'updated') {
			ports.host.refresh();
		} else {
			ports.host.notice(outcome.message);
		}
	}

	async function setAdvancedViewFraming(viewId: string, edit: AdvancedViewFraming): Promise<void> {
		const controller = ports.host.activeController();
		if (
			controller === null ||
			viewId !== ports.advancedViewId() ||
			viewEdit !== null ||
			pendingViewWrite !== null
		)
			return;
		const facts = controller.viewFacts(viewId);
		const start = controller.viewPose(viewId);
		if (facts === null || start === null) return;
		const pose = frameView(start, edit, ports.host.floorDatum());
		if (viewEditMoved(edit.kind, start, pose))
			await writeViewEdit(
				viewId,
				controller.selectedView?.presentationId ?? facts.presentationId,
				pose,
				controller.sourceRevision,
			);
	}

	async function confirmPendingViewWrite(): Promise<void> {
		const pending = pendingViewWrite;
		pendingViewWrite = null;
		if (pending === null) return;
		const controller = ports.host.activeController();
		if (controller === null || controller.sourceRevision !== pending.sourceRevision) return;
		const outcome = await controller.updateViewPose(
			pending.viewId,
			pending.pose,
			pending.presentationId,
			{
				confirmShared: true,
			},
		);
		if (outcome.kind === 'updated') {
			ports.host.refresh();
		} else if (outcome.kind === 'refused') {
			ports.host.notice(outcome.message);
		}
	}

	return {
		get active() {
			return viewEdit;
		},
		get pending() {
			return pendingViewWrite;
		},
		clearPending() {
			pendingViewWrite = null;
		},
		begin: beginViewEdit,
		update: updateViewEdit,
		end: endViewEdit,
		cancel: cancelViewEdit,
		setAdvancedFraming: setAdvancedViewFraming,
		confirmPending: confirmPendingViewWrite,
	};
}
