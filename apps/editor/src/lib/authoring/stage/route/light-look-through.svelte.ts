/**
 * T2.S3b — Spot *Look through*.
 *
 * One session-only Camera inspection posture over one authored Spot. The light's
 * position is the eye; aiming is the existing Camera inspection API
 * (`turnLookThrough` / `reaimLookThroughRay`); the only document write is the one
 * `update-light { rotation }` Done submits. Exit and Cancel write nothing.
 *
 * The Camera owns the viewpoint, the entry standpoint and the reading:
 * `beginLookThrough` enters 3D (Living) from Plan (Paper), and `endLookThrough`
 * restores the exact settled inspection — pose **and** reading — captured at
 * entry. This module never holds a second camera, pose evaluator or FOV rule.
 *
 * A session is bound to the facade that entered it. A project replacement disposes
 * that facade, so a late completion or a stale UI read can never end, aim or write
 * through the replacement's Camera.
 */
import { fovYDegreesOf, type PointerRay, type Vec3 } from '@portfolio/camera-core';
import type { StageAdapterServices } from '../stage-adapter-host';
import type { StageFacade } from '../stage-facade';
import { acceptFormCommand } from '../../adapters/scene/form-card-command';
import { sceneEntityReference } from '../../adapters/scene/placement';
import {
	aimTarget,
	LIGHT_AIM_GUIDE_METERS,
	lightForward,
	rotationForLightDirection
} from '../../look/light-aim';
import {
	drawableSpotAngle,
	LIGHT_SPOT_TARGET_FALLBACK_METERS,
	spotFootprintRadius,
	spotInnerRadius
} from '../../look/light-presentation';
import { radiansToDegrees } from '../../look/light-units';
import { lightById, lightRange, type Light } from '../../adapters/light/light-subjects';

/** The Camera presentation id every Spot inspection names; never an authored View. */
export const LIGHT_LOOK_THROUGH_PRESENTATION = 'light-inspection';
/** The Camera view id: `light:`. The plan's fixed id shape, never persisted. */
export const LIGHT_LOOK_THROUGH_VIEW_PREFIX = 'light:';

const TURN_RADIANS_PER_CSS_PIXEL = 0.0032;
const SAME_VECTOR_EPSILON = 1e-6;

export type LightLookThroughSession = {
	readonly lightId: string;
	readonly label: string;
	/** The facade whose Camera holds the inspection; never a replacement's. */
	readonly stage: StageFacade;
	/** The light's authored pose at entry; an external change ends the session. */
	readonly entryPosition: Vec3;
	readonly entryRotation: Vec3;
	/** The reading `endLookThrough` restores; 3D while the session is open. */
	readonly entryReading: '3d' | 'plan';
};

export type LightLookThroughEnter =
	| { readonly kind: 'entered' }
	| { readonly kind: 'refused'; readonly message: string };

export type LightLookThroughFinish =
	| { readonly kind: 'written' }
	| { readonly kind: 'unchanged' }
	| { readonly kind: 'ended'; readonly message?: string }
	| { readonly kind: 'refused'; readonly message: string };

export type LightLookThroughBeam = {
	readonly halfAngleDegrees: number;
	/** The authored cutoff, or null for an unbounded Spot. */
	readonly reachMeters: number | null;
};

/** The actual cone S3a publishes, as world-space rings for the one Camera to project. */
export type LightLookThroughCone = {
	readonly capRing: readonly Vec3[];
	readonly innerRing: readonly Vec3[] | null;
	readonly halfAngleDegrees: number;
	readonly reachMeters: number | null;
};

function add(left: Vec3, right: Vec3): Vec3 {
	return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

function sub(left: Vec3, right: Vec3): Vec3 {
	return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

function scaledBy(value: Vec3, amount: number): Vec3 {
	return [value[0] * amount, value[1] * amount, value[2] * amount];
}

function cross(left: Vec3, right: Vec3): Vec3 {
	return [
		left[1] * right[2] - left[2] * right[1],
		left[2] * right[0] - left[0] * right[2],
		left[0] * right[1] - left[1] * right[0]
	];
}

function normalize(value: Vec3): Vec3 {
	const length = Math.hypot(value[0], value[1], value[2]);
	if (!(length > 1e-9)) return [0, -1, 0];
	return [value[0] / length, value[1] / length, value[2] / length];
}

function sameVector(left: Vec3, right: Vec3): boolean {
	return (
		Math.abs(left[0] - right[0]) <= SAME_VECTOR_EPSILON &&
		Math.abs(left[1] - right[1]) <= SAME_VECTOR_EPSILON &&
		Math.abs(left[2] - right[2]) <= SAME_VECTOR_EPSILON
	);
}

function ringFor(
	center: Vec3,
	direction: Vec3,
	radius: number,
	segments = 64
): Vec3[] {
	// The same orthonormal basis `spotConeGuide` uses, so the coverage ring and
	// the Stage's published cone cannot disagree about which way is "up".
	const reference: Vec3 = Math.abs(direction[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
	const right = normalize(cross(direction, reference));
	const up = normalize(cross(right, direction));
	const ring: Vec3[] = [];
	for (let index = 0; index < segments; index += 1) {
		const angle = (index / segments) * Math.PI * 2;
		ring.push(
			add(
				center,
				add(scaledBy(right, Math.cos(angle) * radius), scaledBy(up, Math.sin(angle) * radius))
			)
		);
	}
	return ring;
}

/**
 * The Spot cone as two world-space rings.
 *
 * `capRing` is the authored cutoff (or the same 3 m guide reach an unbounded Spot
 * already uses). `innerRing` is the full-brightness edge the renderer uses. The
 * ring angle is S3a's drawable angle — the stored angle up to its 80° guide limit
 * — never the Camera FOV, so the Stage can show the beam truthfully however the
 * inspection lens is cropped. `halfAngleDegrees` reports the stored angle.
 */
export function lookThroughCone(light: Light): LightLookThroughCone {
	if (light.light !== 'spot') {
		return {
			capRing: [],
			innerRing: null,
			halfAngleDegrees: 0,
			reachMeters: lightRange(light) ?? null
		};
	}
	const direction = normalize(lightForward(light.rotation));
	const distance = lightRange(light) ?? LIGHT_SPOT_TARGET_FALLBACK_METERS;
	const center = add(light.position, scaledBy(direction, distance));
	// S3a draws every stored angle above 80° at its guide limit. Reuse the same
	// drawable angle so a near-90° beam cannot project an enormous polygon that
	// disagrees with the selected Spot's guide.
	const drawAngle = drawableSpotAngle(light.angle);
	const capRadius = spotFootprintRadius(distance, drawAngle);
	const penumbra = light.penumbra ?? 0;
	const innerRadius =
		penumbra > 0.001 ? spotInnerRadius(distance, drawAngle, penumbra) : 0;
	return {
		capRing: capRadius > 1e-6 ? ringFor(center, direction, capRadius) : [],
		innerRing: innerRadius > 1e-4 ? ringFor(center, direction, innerRadius) : null,
		halfAngleDegrees: radiansToDegrees(light.angle),
		reachMeters: lightRange(light) ?? null
	};
}

/** The fixed-eye inspection View for a Spot, derived from its stored aim. */
export function lightLookThroughView(
	light: Light,
	cameraState: { readonly pose: Parameters<typeof fovYDegreesOf>[0] }
) {
	return {
		viewId: `${LIGHT_LOOK_THROUGH_VIEW_PREFIX}${light.id}`,
		presentationId: LIGHT_LOOK_THROUGH_PRESENTATION,
		label: light.name,
		eye: [...light.position] as Vec3,
		target: aimTarget(light.position, light.rotation, LIGHT_AIM_GUIDE_METERS),
		fovYDegrees: fovYDegreesOf(cameraState.pose)
	};
}

export type LightLookThroughHost = {
	/** The mounted facade, or null before activation and after teardown. */
	readonly stage: () => StageFacade | null;
	readonly services: () => StageAdapterServices | null;
	/** Look through is a World-lens posture; the Experience lens owns its own. */
	readonly lens: () => 'world' | 'experience';
	readonly notice: (message: string) => void;
	readonly refresh: () => void;
	readonly absoluteCss: (event: PointerEvent) => readonly [number, number];
	readonly capturePointer: (target: Element, pointerId: number) => boolean;
	readonly stageElement: () => HTMLElement | undefined;
};

export type LightLookThrough = ReturnType<typeof createLightLookThrough>;

/**
 * The route's one Spot inspection session.
 *
 * It is created once per route lifetime, not per adapter epoch: the session is
 * bound to one facade and is explicitly cancelled when that facade is replaced or
 * torn down. The Light Card enters through the `lightInspection` adapter port.
 */
export function createLightLookThrough(host: LightLookThroughHost) {
	let session = $state.raw<LightLookThroughSession | null>(null);
	let busy = $state(false);
	let revision = $state(0);
	let disposed = false;
	/** One or more live inspection pointers; a click aims only after a clean tap. */
	const pointers = new Map<number, { x: number; y: number; moved: boolean }>();
	const suppressClick = new Set<number>();

	function touched(): void {
		revision += 1;
	}

	function endCamera(current: LightLookThroughSession): boolean {
		return current.stage.camera.endLookThrough();
	}

	function refresh(): void {
		touched();
		host.refresh();
	}

	/** End the inspection without a write and state why. */
	function abandon(message: string): void {
		const current = session;
		session = null;
		busy = false;
		if (current !== null) endCamera(current);
		host.notice(message);
		refresh();
	}

	/**
	 * The session's light still exists and still has the pose it entered with.
	 * A deletion or an external aim/move ends the inspection rather than writing
	 * a rotation derived from a stale eye.
	 */
	function assertCurrent(): Light | null {
		const current = session;
		if (current === null) return null;
		const light = lightById(current.stage.snapshot(), current.lightId);
		if (light === null) {
			abandon('That light is no longer in this project. Nothing was written.');
			return null;
		}
		if (
			!sameVector(light.position, current.entryPosition) ||
			!sameVector(light.rotation, current.entryRotation)
		) {
			abandon('The light changed while you were looking through. Nothing was written.');
			return null;
		}
		return light;
	}

	function currentLight(): Light | null {
		const current = session;
		return current === null ? null : lightById(current.stage.snapshot(), current.lightId);
	}

	/**
	 * Reconcile an idle session with the mounted accepted source. The route calls
	 * this when an accepted revision or history install lands, so an external
	 * deletion, move or aim change ends the inspection without waiting for the
	 * next pointer action. A pending Done owns its own acceptance.
	 */
	function reconcile(): void {
		if (session === null || busy) return;
		assertCurrent();
	}

	function enter(lightId: string): LightLookThroughEnter {
		if (disposed) return { kind: 'refused', message: 'This Stage is no longer mounted.' };
		if (session !== null) {
			return { kind: 'refused', message: 'Already looking through a light; finish or exit it first.' };
		}
		if (host.lens() !== 'world') {
			return { kind: 'refused', message: 'Look through is available in the World lens.' };
		}
		const stage = host.stage();
		const services = host.services();
		if (stage === null || services === null) {
			return { kind: 'refused', message: 'The Stage is still opening; try again in a moment.' };
		}
		const light = lightById(stage.snapshot(), lightId);
		if (light === null) return { kind: 'refused', message: 'That light is no longer in this project.' };
		if (light.light !== 'spot') {
			return { kind: 'refused', message: 'Only a Spot has an eye and a cone to look through.' };
		}
		const camera = stage.camera;
		if (camera.lookThrough() !== null) {
			return { kind: 'refused', message: 'Exit the current Look through first.' };
		}
		const entry = camera.state();
		const view = lightLookThroughView(light, entry);
		const result = camera.beginLookThrough(view);
		if (result.kind === 'refused') return { kind: 'refused', message: result.message };
		session = {
			lightId: light.id,
			label: light.name,
			stage,
			entryPosition: [...light.position] as Vec3,
			entryRotation: [...light.rotation] as Vec3,
			entryReading: entry.reading
		};
		host.notice('');
		refresh();
		return { kind: 'entered' };
	}

	function aimByRay(ray: PointerRay): boolean {
		const current = session;
		if (current === null || busy || assertCurrent() === null) return false;
		const moved = current.stage.camera.reaimLookThroughRay(ray);
		if (moved) refresh();
		return moved;
	}

	function turn(deltaYawRadians: number, deltaPitchRadians: number): boolean {
		const current = session;
		if (current === null || busy || assertCurrent() === null) return false;
		const moved = current.stage.camera.turnLookThrough(deltaYawRadians, deltaPitchRadians);
		if (moved) refresh();
		return moved;
	}

	function stepLens(fovYDegrees: number): boolean {
		const current = session;
		if (current === null || busy) return false;
		const moved = current.stage.camera.stepLookThroughLens(fovYDegrees);
		if (moved) refresh();
		return moved;
	}

	/** Done: one `update-light { rotation }`, then the entry standpoint returns. */
	async function finish(): Promise<LightLookThroughFinish> {
		const current = session;
		if (current === null) return { kind: 'ended' };
		if (busy) return { kind: 'refused', message: 'The current change is still settling.' };
		const stage = current.stage;
		const services = host.services();
		if (services === null || host.stage() !== stage) {
			// A replacement owns a new Camera and a new acceptance host; the old
			// session has already been cancelled or is about to be.
			abandon('The project changed while you were looking through. Nothing was written.');
			return { kind: 'ended', message: 'The project changed while you were looking through.' };
		}
		const light = assertCurrent();
		if (light === null) {
			return { kind: 'refused', message: 'The light is no longer available to aim.' };
		}
		const provisional = stage.camera.provisionalView();
		if (provisional === null) {
			abandon('The Camera ended the inspection before Done. Nothing was written.');
			return { kind: 'ended' };
		}
		const direction = sub(provisional.target, provisional.eye);
		if (Math.hypot(direction[0], direction[1], direction[2]) <= SAME_VECTOR_EPSILON) {
			abandon('The aim is too close to the light to store. Nothing was written.');
			return { kind: 'ended' };
		}
		const rotation = rotationForLightDirection(direction);
		if (sameVector(rotation, light.rotation)) {
			// No turn was authored: Done is a clean exit, not a no-op history entry.
			const ended = exitInternal();
			return ended ? { kind: 'unchanged' } : { kind: 'ended' };
		}
		busy = true;
		try {
			const outcome = await acceptFormCommand(services, stage.snapshot(), light.id, 'update-light', {
				entityId: light.id,
				rotation
			});
			// Exit, Cancel, a replacement or teardown may have ended the session
			// while the acceptance was in flight. Its completion must not restore,
			// select or write through another Camera.
			if (session !== current) return { kind: 'ended' };
			if (outcome.kind === 'refused') {
				host.notice(outcome.message);
				return { kind: 'refused', message: outcome.message };
			}
			if (outcome.kind === 'no-op' || outcome.kind === 'unchanged') {
				exitInternal();
				return { kind: 'unchanged' };
			}
			session = null;
			endCamera(current);
			// Done selects the light: the accepted source is the one the Card and
			// the next inspection read.
			const accepted = stage.snapshot();
			const reference = sceneEntityReference(light.id, accepted.domain.unitRevisions.scene);
			services.stage.setSelection({ ordered: [{ reference }], primary: reference });
			host.notice('');
			refresh();
			return { kind: 'written' };
		} finally {
			if (session === current) busy = false;
		}
	}

	function exitInternal(): boolean {
		const current = session;
		if (current === null) return false;
		session = null;
		busy = false;
		const ended = endCamera(current);
		refresh();
		return ended;
	}

	/** Esc / Exit: restore the entry standpoint and write nothing. */
	function exit(): boolean {
		if (busy) return false;
		return exitInternal();
	}

	/**
	 * End the session without a notice. The route calls this before a project
	 * replacement, on lens change and on teardown; it is idempotent.
	 */
	function cancel(): void {
		const current = session;
		if (current === null) return;
		session = null;
		busy = false;
		endCamera(current);
		releasePointers();
		refresh();
	}

	function dispose(): void {
		if (disposed) return;
		disposed = true;
		cancel();
	}

	function releasePointers(): void {
		for (const pointerId of pointers.keys()) {
			const element = host.stageElement();
			if (element?.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
		}
		pointers.clear();
		suppressClick.clear();
	}

	function moved(): boolean {
		void revision;
		return session?.stage.camera.lookThrough()?.moved ?? false;
	}

	function beam(): LightLookThroughBeam | null {
		void revision;
		const light = currentLight();
		if (light === null || light.light !== 'spot') return null;
		return {
			halfAngleDegrees: radiansToDegrees(light.angle),
			reachMeters: lightRange(light) ?? null
		};
	}

	/* ----- The World-lens inspection posture ----------------------------- */

	function beginAim(event: PointerEvent): void {
		if (event.button !== 0) return;
		if (pointers.size > 0) return;
		if (!host.capturePointer(event.currentTarget as HTMLElement, event.pointerId)) return;
		pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false });
	}

	function moveAim(event: PointerEvent): void {
		const press = pointers.get(event.pointerId);
		if (press === undefined || session === null) return;
		const dx = event.clientX - press.x;
		const dy = event.clientY - press.y;
		press.x = event.clientX;
		press.y = event.clientY;
		if (Math.hypot(dx, dy) >= 1) press.moved = true;
		if (dx === 0 && dy === 0) return;
		turn(dx * TURN_RADIANS_PER_CSS_PIXEL, dy * TURN_RADIANS_PER_CSS_PIXEL);
	}

	function endAim(event: PointerEvent): void {
		const press = pointers.get(event.pointerId);
		if (press === undefined) return;
		if (press.moved) suppressClick.add(event.pointerId);
		pointers.delete(event.pointerId);
		const element = host.stageElement();
		if (element?.hasPointerCapture?.(event.pointerId)) {
			element.releasePointerCapture(event.pointerId);
		}
	}

	/**
	 * A plain tap aims at the surface under the pointer through Camera's own
	 * pointer ray. A release that turned the view is not also an aim click.
	 */
	function aimAtClick(event: MouseEvent): boolean {
		const pointerId = (event as MouseEvent & { readonly pointerId?: unknown }).pointerId;
		if (typeof pointerId === 'number' && suppressClick.delete(pointerId)) return true;
		const current = session;
		if (current === null || busy) return true;
		const stage = current.stage;
		const evaluationId = stage.evaluationId();
		if (evaluationId === null) return true;
		const origin = host.absoluteCss(event as PointerEvent);
		const ray = stage.pointerRay(origin, evaluationId);
		if (ray.kind === 'ray') aimByRay(ray.ray);
		return true;
	}

	const posture = {
		id: 'light-look-through',
		pointerDown(event: PointerEvent) {
			if (session === null) return 'pass' as const;
			beginAim(event);
			return 'claimed' as const;
		},
		pointerMove(event: PointerEvent) {
			if (session === null) return 'pass' as const;
			moveAim(event);
			return 'claimed' as const;
		},
		pointerUp(event: PointerEvent) {
			if (session === null) return 'pass' as const;
			endAim(event);
			return 'claimed' as const;
		},
		pointerCancel(event: PointerEvent) {
			if (session === null) return 'pass' as const;
			endAim(event);
			return 'claimed' as const;
		},
		lostCapture(event: PointerEvent) {
			if (session === null) return 'pass' as const;
			endAim(event);
			return 'claimed' as const;
		},
		pinch(event: PointerEvent) {
			// The eye is fixed: a second pointer cannot pinch, truck or dolly it.
			event.preventDefault();
			return session === null ? 'pass' as const : 'claimed' as const;
		},
		click(event: MouseEvent) {
			if (session === null) return 'pass' as const;
			return aimAtClick(event) ? 'claimed' as const : 'pass' as const;
		},
		wheel(event: WheelEvent) {
			if (session === null) return 'pass' as const;
			const current = session.stage.camera.provisionalView();
			if (current !== null) {
				const next = Math.min(120, Math.max(10, current.fovYDegrees - event.deltaY * 0.02));
				stepLens(next);
			}
			// Look through owns the wheel: it crops the inspection lens, never the
			// Stage's ordinary zoom and never the light's position.
			return 'claimed' as const;
		},
		key(event: KeyboardEvent) {
			if (session === null) return 'pass' as const;
			if (event.key === 'Escape') {
				event.preventDefault();
				// Escape obeys the Exit button's policy: once Done has submitted its
				// one write, let acceptance resolve instead of claiming a cancel that
				// the in-flight intent can still overwrite.
				if (!busy) exitInternal();
				return 'claimed' as const;
			}
			// Editing keys must not delete or rename the light under inspection.
			if (event.key === 'Delete' || event.key === 'Backspace') return 'claimed' as const;
			return 'pass' as const;
		},
		interrupt() {
			if (session === null) return 'pass' as const;
			// A window blur or a lost pointer cancels the live aim, not the
			// inspection: the creator returns to the same measured viewpoint.
			releasePointers();
			return 'claimed' as const;
		},
		deactivate() {
			// A lens change waits for a pending Done just as Exit does. The route's
			// explicit replacement/teardown cancel still owns the destructive path.
			if (session !== null && !busy) exitInternal();
		},
		dispose
	};

	return {
		posture,
		active: () => session !== null,
		session: () => session,
		enter,
		aimByRay,
		turn,
		stepLens,
		finish,
		exit,
		reconcile,
		cancel,
		dispose,
		moved,
		beam,
		busy: () => busy
	};
}
