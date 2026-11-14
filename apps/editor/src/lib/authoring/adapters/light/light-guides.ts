/**
 * X8 — the Light screen-space geometry.
 *
 * Pure projections of one Light and one live Stage context into the guide
 * segments and ring controls the Stage draws. Nothing here holds a lifetime,
 * opens a lease, reads the gesture or writes. The Light planners stay the only
 * authority on what a guide means.
 */
import type { Vec3 } from '@portfolio/project-model';
import type { StageAdapterContext } from '$lib/authoring/stage/stage-adapter-host';
import { lightForward } from '../../look/light-aim';
import {
	drawableSpotAngle,
	isWideBeam,
	lightDropStem,
	pointReachRingRadius,
	spotFootprintRadius,
	spotInnerRadius
} from '../../look/light-presentation';
import { add, cross, dot, normalize, scale, sub } from './light-math';
import { isLight, lightRange, spotTargetFor, type Light } from './light-subjects';

export type LightGuide = {
	readonly segments: readonly (readonly [Vec3, Vec3])[];
	readonly derivedSegments: readonly (readonly [Vec3, Vec3])[];
};

/**
 * A ring-plane direction that projects toward screen-right or screen-left.
 *
 * The Spot's Rim and Inner-ring controls share one ring plane; separating
 * their controls on opposite sides keeps the two beams editable even when the
 * soft edge is zero and the rings coincide. Presentation only: the gesture
 * still measures the ring's real radius.
 */
export function ringPhase(
	adapterContext: StageAdapterContext,
	axis: Vec3,
	side: 'left' | 'right'
): Vec3 | undefined {
	const view = normalize(sub(adapterContext.evaluation.pose.target, adapterContext.evaluation.eye));
	const right = cross(view, [0, 1, 0]);
	const normal = normalize(axis);
	const projected = sub(right, scale(normal, dot(right, normal)));
	if (Math.hypot(projected[0], projected[1], projected[2]) < 1e-6) return undefined;
	const unit = normalize(projected);
	return side === 'left' ? scale(unit, -1) : unit;
}

/**
 * The world radius whose screen projection is about `pixels`, measured at the
 * body along the camera's right. Used by the Point's reach control when the
 * sphere never meets the datum: that control is a screen-sized ring at the
 * light, not a world ring on the floor.
 */
export function screenRingExtent(
	adapterContext: StageAdapterContext,
	position: Vec3,
	pixels: number
): number {
	const forward = normalize(sub(adapterContext.evaluation.pose.target, adapterContext.evaluation.eye));
	const right = normalize(cross(forward, [0, 1, 0]));
	const anchor = adapterContext.project(position);
	const sample = adapterContext.project(add(position, right));
	if (anchor !== null && sample !== null) {
		const css = Math.hypot(sample[0] - anchor[0], sample[1] - anchor[1]);
		if (css > 0.5) return Math.max(0.02, pixels / css);
	}
	return 0.05;
}

function ringSegments(center: Vec3, radius: number, y: number): [Vec3, Vec3][] {
	const ring: Vec3[] = [];
	for (let index = 0; index < 64; index += 1) {
		const angle = (index / 64) * Math.PI * 2;
		ring.push([
			center[0] + Math.cos(angle) * radius,
			y,
			center[2] + Math.sin(angle) * radius
		]);
	}
	const segments: [Vec3, Vec3][] = [];
	for (let index = 0; index < ring.length; index += 1) {
		segments.push([ring[index]!, ring[(index + 1) % ring.length]!]);
	}
	return segments;
}

export function guideSegments(
	light: Light,
	adapterContext: StageAdapterContext
): LightGuide {
	const segments: [Vec3, Vec3][] = [];
	const derivedSegments: [Vec3, Vec3][] = [];
	const datumMeters = adapterContext.snapshot.domain.datumMeters;
	if (light.light === 'spot') {
		const forward = normalize(lightForward(light.rotation));
		const target = spotTargetFor(light, adapterContext);
		const drawAngle = drawableSpotAngle(light.angle);
		const distance = target.distance;
		const footprintRadius = spotFootprintRadius(distance, drawAngle);
		const center = add(light.position, scale(forward, distance));
		const reference: Vec3 = Math.abs(forward[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
		const right = normalize(cross(forward, reference));
		const up = normalize(cross(right, forward));
		const ring: Vec3[] = [];
		for (let index = 0; index < 48; index += 1) {
			const angle = (index / 48) * Math.PI * 2;
			ring.push(
				add(
					center,
					add(
						scale(right, Math.cos(angle) * footprintRadius),
						scale(up, Math.sin(angle) * footprintRadius)
					)
				)
			);
		}
		const range = lightRange(light);
		const behind = range !== undefined && range < distance;
		// A stored angle beyond 80° is drawn at the guide's 80° limit in
		// derived-guide ink: the footprint is an illustration, not the
		// authored beam, and the grips are not mounted to claim otherwise.
		const footprint = behind || isWideBeam(light.angle) ? derivedSegments : segments;
		for (let index = 0; index < ring.length; index += 1) {
			footprint.push([ring[index]!, ring[(index + 1) % ring.length]!]);
		}
		// A cone is two silhouette edges, never four struts.
		footprint.push([light.position, ring[0]!]);
		footprint.push([light.position, ring[24]!]);
		const penumbra = light.penumbra ?? 0;
		if (penumbra > 0.001) {
			const inner = spotInnerRadius(distance, drawAngle, penumbra);
			if (inner > 1e-4) {
				for (let index = 0; index < 48; index += 1) {
					const angle = (index / 48) * Math.PI * 2;
					const point = add(
						center,
						add(
							scale(right, Math.cos(angle) * inner),
							scale(up, Math.sin(angle) * inner)
						)
					);
					derivedSegments.push([
						point,
						add(
							center,
							add(
								scale(right, Math.cos(((index + 1) / 48) * Math.PI * 2) * inner),
								scale(up, Math.sin(((index + 1) / 48) * Math.PI * 2) * inner)
							)
						)
					]);
				}
			}
		}
		if (range !== undefined) {
			const capCenter = add(light.position, scale(forward, range));
			derivedSegments.push([light.position, capCenter]);
			segments.push([
				add(capCenter, scale(right, 0.07)),
				add(capCenter, scale(right, -0.07))
			]);
		}
	} else if (light.light === 'point') {
		const range = lightRange(light);
		const height = Math.max(0, light.position[1] - datumMeters);
		// The drop stem is derived geometry: it names the first surface
		// below the body, or the datum when nothing is under it. It never
		// states a stored reach.
		derivedSegments.push([
			light.position,
			lightDropStem(light.position, datumMeters, (ray) =>
				adapterContext.pickScene(ray)
			)
		]);
		if (range !== undefined) {
			const ring = pointReachRingRadius(range, height);
			if (ring.onDatum && ring.radius > 1e-4) {
				segments.push(...ringSegments(light.position, ring.radius, datumMeters));
			}
		}
	}
	return { segments, derivedSegments };
}
