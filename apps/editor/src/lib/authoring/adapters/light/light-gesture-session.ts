/**
 * X8 — the Light mark-gesture session.
 *
 * One captured edit of the selected light: Move, Height, Aim, Reach, Beam, Soft
 * edge and the Directional From / Height-in-sky beads. The session owns the
 * captured copy and its frozen dial frame, takes the binding's one gesture lease
 * on press, publishes the dragged copy as a session-only preview, and on
 * release commits exactly one `update-light` through the Scene's shared Form
 * command path (so a refusal restores the accepted value). It never edits the
 * Scene itself, holds no placement state, and ends its capture on cancel, task
 * close, rebind and disposal through `drop`. A selection change does not end it:
 * the capture is the light that was pressed.
 *
 * The geometry of what a drag means is the pure arithmetic in `light-math` and
 * the Light presentation helpers; the session only decides which one applies.
 */
import type { Vec3 } from '@portfolio/project-model';
import type {
	StageAdapterContext,
	StageAdapterServices,
	StagePointerIntent
} from '$lib/authoring/stage/stage-adapter-host';
import { acceptFormCommand } from '../scene/form-card-command';
import { lightForward, rotationForLightDirection } from '../../look/light-aim';
import {
	directionForPresentationAngles,
	drawableSpotAngle,
	LIGHT_MIN_RANGE_METERS,
	penumbraForInnerRadius,
	pointReachRingRadius,
	presentationAngles
} from '../../look/light-presentation';
import {
	add,
	closestAxisPoint,
	distance,
	horizontalDistance,
	normalize,
	pointOf,
	rayPlane,
	scale,
	sub
} from './light-math';
import { dialFrameFor, type LightDialFrame } from './light-guides';
import {
	LIGHT_DEFAULT_SPOT_ANGLE,
	cloneLight,
	lightRange,
	selectedLight,
	spotTargetFor,
	viewportCss,
	type Light
} from './light-subjects';
import {
	clearLightPreview,
	publishLightPreview,
	type LightInstallWindow,
	type LightLease,
	type LightRefusal
} from './light-session-ports';

type GestureKind =
	| 'move'
	| 'aim'
	| 'range'
	| 'angle'
	| 'penumbra'
	| 'azimuth'
	| 'elevation'
	| 'height';

type Gesture = {
	readonly kind: GestureKind;
	readonly entity: Light;
	/** Point Reach ring: datum when the sphere reaches it, otherwise light height. */
	readonly pointRangePlaneY?: number;
	/** A Spot Move keeps a surface-bound target as a fixed world point. */
	readonly fixedTarget?: Vec3;
	/** The Directional presentation bearing at press, kept while overhead. */
	readonly lastFrom?: number;
	/** The dial frame is frozen from press to release of either bead. */
	readonly dialCenter?: Vec3;
	readonly dialRadius?: number;
};

/** How a mark press resolved: started, refused by the lease, or not a Light mark. */
export type LightGestureBegin = 'started' | 'blocked' | 'none';

export type LightGestureSession = {
	/** A mark gesture is captured. */
	readonly active: boolean;
	/** The dragged copy of the light, while captured; the marks and guides read it. */
	readonly entity: Light | null;
	/** The dial frame frozen at press, while either Directional bead is held. */
	readonly dialFrame: LightDialFrame | null;
	/** Press on a mark: capture the selected light, then take the lease. */
	begin(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext,
		shift: boolean
	): LightGestureBegin;
	/** Update the captured copy from the pointer and publish it as the session preview. */
	move(intent: StagePointerIntent, adapterContext: StageAdapterContext): void;
	/**
	 * Release: end the capture, release the lease, resolve the final move
	 * synchronously, publish that exact light and commit it. Returns `false` when
	 * no gesture was captured.
	 */
	finish(intent: StagePointerIntent, adapterContext: StageAdapterContext): boolean;
	/** Forget the capture without committing; returns the id it was editing. */
	drop(): string | undefined;
};

export type LightGestureDeps = {
	readonly services: StageAdapterServices;
	readonly lease: LightLease;
	readonly refusal: LightRefusal;
	readonly install: LightInstallWindow;
};

export function createLightGestureSession(deps: LightGestureDeps): LightGestureSession {
	const { services, lease, refusal, install } = deps;
	let gesture: Gesture | null = null;

	function beginGesture(
		handleId: string | undefined,
		adapterContext: StageAdapterContext,
		shift = false
	): Gesture | null {
		const entity = selectedLight(adapterContext);
		if (entity === null) return null;
		const kind: GestureKind | null =
			handleId === 'light-body'
				? 'move'
				: handleId === 'light-height'
					? 'height'
					: handleId === 'light-aim'
						? 'aim'
						: handleId === 'light-range' || handleId === 'light-reach'
							? 'range'
							: handleId === 'light-angle'
								? 'angle'
								: handleId === 'light-penumbra'
									? 'penumbra'
									: handleId === 'light-azimuth'
										? 'azimuth'
										: handleId === 'light-elevation'
											? 'elevation'
											: null;
		if (kind === null) return null;
		refusal.clear();
		if (kind === 'range' && entity.light === 'point') {
			const height = Math.max(0, entity.position[1] - adapterContext.snapshot.domain.datumMeters);
			const range = lightRange(entity) ?? 0;
			const supportPlaneReached = pointReachRingRadius(range, height).onDatum;
			return {
				kind,
				entity: cloneLight(entity),
				pointRangePlaneY: supportPlaneReached
					? adapterContext.snapshot.domain.datumMeters
					: entity.position[1]
			};
		}
		const angles = presentationAngles(entity.rotation);
		const target =
			kind === 'move' && entity.light === 'spot' && !shift
				? spotTargetFor(entity, adapterContext)
				: null;
		const dial = kind === 'azimuth' || kind === 'elevation'
			? dialFrameFor(adapterContext, services.stage)
			: null;
		return {
			kind,
			entity: cloneLight(entity),
			...(target?.surfaceBound ? { fixedTarget: [...target.target] as Vec3 } : {}),
			lastFrom: angles.from,
			...(dial === null ? {} : { dialCenter: [...dial.center] as Vec3, dialRadius: dial.radius })
		};
	}

	function updateGesture(
		intent: StagePointerIntent,
		adapterContext: StageAdapterContext
	): void {
		if (gesture === null) return;
		const ray = adapterContext.ray(viewportCss(intent.css, adapterContext));
		if (ray === null) return;
		const current = gesture.entity;
		if (gesture.kind === 'move') {
			const point = pointOf(ray, current.position[1]);
			if (point === null) return;
			current.position = [point[0], current.position[1], point[2]];
			if (current.light === 'spot' && gesture.fixedTarget !== undefined) {
				current.rotation = rotationForLightDirection(sub(gesture.fixedTarget, current.position));
			}
			return;
		}
		if (gesture.kind === 'height') {
			const axis = closestAxisPoint(ray, current.position, [0, 1, 0]);
			if (axis === null) return;
			current.position = [
				current.position[0],
				Math.max(adapterContext.snapshot.domain.datumMeters + 0.05, axis.point[1]),
				current.position[2]
			];
			return;
		}
		if (gesture.kind === 'aim') {
			const drawn = adapterContext.pickScene(ray);
			const rayPoint =
				drawn?.worldPoint ??
				add(
					ray.origin,
					scale(ray.direction, Math.max(3, distance(current.position, ray.origin)))
				);
			current.rotation = rotationForLightDirection(sub(rayPoint, current.position));
			// Aim writes rotation only. Reach is an authored cutoff and is
			// independent of where the beam lands.
			return;
		}
		const forward = lightForward(current.rotation);
		if (gesture.kind === 'range' && current.light === 'point') {
			const planeY =
				gesture.pointRangePlaneY ?? adapterContext.snapshot.domain.datumMeters;
			const point = pointOf(ray, planeY);
			if (point !== null) {
				(current as { range?: number }).range = Math.max(
					LIGHT_MIN_RANGE_METERS,
					planeY === adapterContext.snapshot.domain.datumMeters
						? distance(current.position, point)
						: horizontalDistance(current.position, point)
				);
			}
			return;
		}
		if (gesture.kind === 'range') {
			const axis = closestAxisPoint(ray, current.position, forward);
			if (axis === null) return;
			(current as { range?: number }).range = Math.max(
				LIGHT_MIN_RANGE_METERS,
				axis.distanceAlongAxis
			);
			return;
		}
		if (gesture.kind === 'angle' && current.light === 'spot') {
			const targetDistance = spotTargetFor(current, adapterContext).distance;
			const planeCenter = add(current.position, scale(forward, targetDistance));
			const point = rayPlane(ray, planeCenter, forward);
			if (point === null) return;
			const radius = distance(point, planeCenter);
			(current as { angle: number }).angle = Math.min(
				drawableSpotAngle(Math.PI),
				Math.max(Math.PI / 180, Math.atan2(radius, targetDistance))
			);
			return;
		}
		if (gesture.kind === 'penumbra' && current.light === 'spot') {
			const targetDistance = spotTargetFor(current, adapterContext).distance;
			const planeCenter = add(current.position, scale(forward, targetDistance));
			const point = rayPlane(ray, planeCenter, forward);
			if (point === null) return;
			(current as { penumbra: number }).penumbra = Math.min(
				0.95,
				penumbraForInnerRadius(
					targetDistance,
					current.angle,
					distance(point, planeCenter)
				)
			);
			return;
		}
		if (gesture.kind === 'azimuth') {
			const point = pointOf(ray, adapterContext.snapshot.domain.datumMeters);
			if (point === null) return;
			const angles = presentationAngles(current.rotation, gesture.lastFrom ?? 0);
			const origin: Vec3 = gesture.dialCenter ?? [0, adapterContext.snapshot.domain.datumMeters, 0];
			const from =
				((Math.atan2(point[0] - origin[0], -(point[2] - origin[2])) * 180) / Math.PI +
					360) %
				360;
			current.rotation = rotationForLightDirection(
				directionForPresentationAngles(from, angles.heightInSky)
			);
			return;
		}
		if (gesture.kind === 'elevation') {
			const worldMark: Vec3 = gesture.dialCenter ?? [0, adapterContext.snapshot.domain.datumMeters, 0];
			const angles = presentationAngles(current.rotation, gesture.lastFrom ?? 0);
			const azimuth = (angles.from * Math.PI) / 180;
			const horizontal: Vec3 = [Math.sin(azimuth), 0, -Math.cos(azimuth)];
			const normal = normalize([-horizontal[2], 0, horizontal[0]]);
			const point = rayPlane(ray, worldMark, normal);
			if (point === null) return;
			const heightInSky = Math.min(
				90,
				Math.max(
					5,
					(Math.atan2(point[1] - worldMark[1], horizontalDistance(worldMark, point)) *
						180) /
						Math.PI
				)
			);
			current.rotation = rotationForLightDirection(
				directionForPresentationAngles(angles.from, heightInSky)
			);
		}
	}

	async function commitGesture(
		current: Gesture,
		adapterContext: StageAdapterContext
	): Promise<void> {
		const entity = current.entity;
		const update =
			current.kind === 'move'
				? {
						position: [...entity.position],
						...(entity.light === 'spot' && current.fixedTarget !== undefined
							? { rotation: [...entity.rotation] }
							: {})
					}
				: current.kind === 'height'
					? { position: [...entity.position] }
					: current.kind === 'aim'
						? { rotation: [...entity.rotation] }
						: current.kind === 'range'
							? { range: lightRange(entity) ?? (entity.light === 'point' ? 3 : 5) }
							: current.kind === 'penumbra'
								? { penumbra: entity.light === 'spot' ? (entity.penumbra ?? 0) : 0 }
								: current.kind === 'angle'
									? { angle: entity.light === 'spot' ? entity.angle : LIGHT_DEFAULT_SPOT_ANGLE }
									: { rotation: [...entity.rotation] };
		install.open();
		try {
			const outcome = await acceptFormCommand(
				services,
				adapterContext.snapshot,
				entity.id,
				'update-light',
				{ entityId: entity.id, ...update } as never
			);
			if (outcome.kind === 'refused') refusal.note(outcome.message);
		} finally {
			install.close();
			// Clear in the same tick the outcome applies, so the accepted value
			// replaces the preview without a flash. Refusal restores it too.
			clearLightPreview(services, entity.id);
			services.stage.notifySurfaceChange();
		}
	}

	return {
		get active() {
			return gesture !== null;
		},
		get entity() {
			return gesture?.entity ?? null;
		},
		get dialFrame() {
			return gesture?.dialCenter !== undefined && gesture.dialRadius !== undefined
				? { center: gesture.dialCenter, radius: gesture.dialRadius }
				: null;
		},
		begin(intent, adapterContext, shift) {
			const next = beginGesture(intent.handleId, adapterContext, shift);
			if (next === null) return 'none';
			if (!lease.acquire(intent.evaluationId, 'light-marks')) return 'blocked';
			gesture = next;
			return 'started';
		},
		move(intent, adapterContext) {
			if (gesture === null) return;
			updateGesture(intent, adapterContext);
			publishLightPreview(services, gesture.entity);
		},
		finish(intent, adapterContext) {
			const pending = gesture;
			if (pending === null) return false;
			gesture = null;
			lease.release();
			// Resolve the release synchronously through the final-move function,
			// publish that exact light, then commit it. A queued frame cannot
			// replace the value the creator released on.
			gesture = pending;
			updateGesture(intent, adapterContext);
			publishLightPreview(services, pending.entity);
			gesture = null;
			void commitGesture(pending, adapterContext);
			return true;
		},
		drop() {
			const captured = gesture?.entity.id;
			gesture = null;
			return captured;
		}
	};
}
