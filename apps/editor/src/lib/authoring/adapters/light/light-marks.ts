/**
 * X8 — the Light mark descriptors.
 *
 * One pure function turns the effective Light (the dragged copy during a
 * gesture, otherwise the selected one) into the ordered edit marks the Stage
 * hit-tests: body, height, aim, reach, beam and soft edge for Point and Spot.
 * It reads the live context a caller supplies; it holds no lifetime and never
 * writes. The host admits, projects and hit-tests the descriptors, and every gesture they start
 * is owned by the gesture session.
 */
import type { Vec3 } from '@portfolio/project-model';
import type {
	StageAdapterContext,
	StageHandleDescriptor
} from '$lib/authoring/stage/stage-adapter-host';
import { lightForward } from '../../look/light-aim';
import { radiansToDegrees } from '../../look/light-units';
import {
	formatDegrees,
	formatMeters,
	isWideBeam,
	pointReachRingRadius,
	spotFootprintRadius,
	spotInnerRadius
} from '../../look/light-presentation';
import { add, normalize, scale, sub } from './light-math';
import { ringPhase, screenRingExtent } from './light-guides';
import { lightRange, spotTargetFor, type Light } from './light-subjects';

/**
 * The marks of one Light. `refusalNow` is the grip's current message.
 */
export function lightMarkDescriptors(
	light: Light,
	adapterContext: StageAdapterContext,
	refusalNow: string | null
): readonly StageHandleDescriptor[] {
	const forward = lightForward(light.rotation);
	const datum = adapterContext.snapshot.domain.datumMeters;
	const range = lightRange(light);
	const height = Math.max(0, light.position[1] - datum);
	const handles: StageHandleDescriptor[] = [
		{
			role: 'edit',
			id: 'light-body',
			kind: 'point',
			anchor: [...light.position],
			label: 'Move light',
			fact: 'position',
			verb: 'Move {value}',
			planner: 'update-light',
			draw: { pointRadius: 6.5 },
			value: `${formatMeters(light.position[0])}, ${formatMeters(light.position[2])}`,
			refusal: refusalNow
		},
		{
			role: 'edit',
			id: 'light-height',
			kind: 'ray',
			anchor: [...light.position],
			axis: [0, 1, 0],
			extent: Math.max(0.05, height) + 0.25,
			label: 'Height',
			fact: 'height',
			verb: 'Height {value} m',
			planner: 'update-light',
			draw: { glyph: 'lift-knob' },
			screen: { offset: [0, -26] },
			value: formatMeters(height),
			refusal: refusalNow
		}
	];
	if (light.light === 'spot') {
		const target = spotTargetFor(light, adapterContext);
		const wide = isWideBeam(light.angle);
		handles.push({
			role: 'edit',
			id: 'light-aim',
			kind: 'point',
			anchor: [...target.target],
			label: 'Aim light',
			fact: 'aim',
			verb: wide
				? `Aim · {value} m · Beam ${formatDegrees(radiansToDegrees(light.angle), 0)} · wider than the guide`
				: 'Aim · {value} m',
			planner: 'update-light',
			draw: { pointRadius: 4.5 },
			value: wide
				? `Aim · ${target.distance.toFixed(2)} m · Beam ${formatDegrees(radiansToDegrees(light.angle), 0)} · wider than the guide`
				: `Aim · ${target.distance.toFixed(2)} m`,
			refusal: refusalNow
		});
		if (range !== undefined) {
			const capCenter = add(light.position, scale(forward, range));
			handles.push({
				role: 'edit',
				id: 'light-range',
				kind: 'ray',
				anchor: capCenter,
				axis: forward,
				extent: 0.2,
				label: 'Reach',
				fact: 'range',
				verb: 'Reach {value} m',
				planner: 'update-light',
				value:
					range < target.distance
						? `${formatMeters(range)} · stops before the target`
						: formatMeters(range),
				refusal: refusalNow
			});
		}
		if (!wide) {
			const footprintCenter = add(light.position, scale(forward, target.distance));
			const footprintRadius = spotFootprintRadius(target.distance, light.angle);
			handles.push({
				role: 'edit',
				id: 'light-angle',
				kind: 'ring',
				anchor: footprintCenter,
				axis: forward,
				phase: ringPhase(adapterContext, forward, 'right'),
				extent: Math.max(0.02, footprintRadius),
				label: 'Beam',
				fact: 'angle',
				verb: 'Beam {value}°',
				planner: 'update-light',
				value: formatDegrees(radiansToDegrees(light.angle), 0),
				refusal: refusalNow
			});
			const innerRadius = spotInnerRadius(
				target.distance,
				light.angle,
				light.penumbra ?? 0
			);
			handles.push({
				role: 'edit',
				id: 'light-penumbra',
				kind: 'ring',
				anchor: footprintCenter,
				axis: forward,
				phase: ringPhase(adapterContext, forward, 'left'),
				extent: Math.max(0.02, innerRadius),
				label: 'Soft edge',
				fact: 'soft-edge',
				verb: 'Soft edge {value}%',
				planner: 'update-light',
				value: `${Math.round((light.penumbra ?? 0) * 100)}%`,
				refusal: refusalNow
			});
		}
	} else if (range !== undefined) {
		// Unlimited Point lights have no ring: the sphere fades to nothing
		// and a drawn half-scene ring would state a reach that is not stored.
		const ring = pointReachRingRadius(range, height);
		if (ring.onDatum) {
			handles.push({
				role: 'edit',
				id: 'light-reach',
				kind: 'ring',
				anchor: [light.position[0], datum, light.position[2]],
				axis: [0, 1, 0],
				phase: ringPhase(adapterContext, [0, 1, 0], 'right'),
				extent: Math.max(0.02, ring.radius),
				label: 'Reach',
				fact: 'range',
				verb: 'Reach {value} m',
				planner: 'update-light',
				value: `${formatMeters(range)} · fades to nothing here`,
				refusal: refusalNow
			});
		} else {
			// The sphere does not meet the datum: a 30 px screen-facing ring
			// around the glyph is the reach control.
			const cameraForward = normalize(
				sub(adapterContext.evaluation.pose.target, adapterContext.evaluation.eye)
			);
			handles.push({
				role: 'edit',
				id: 'light-reach',
				kind: 'ring',
				anchor: [...light.position],
				axis: cameraForward,
				phase: ringPhase(adapterContext, cameraForward, 'right'),
				extent: screenRingExtent(adapterContext, light.position, 30),
				label: 'Reach',
				fact: 'range',
				verb: 'Reach {value} m',
				planner: 'update-light',
				value: `${formatMeters(range)} · does not reach the floor`,
				refusal: refusalNow
			});
		}
	}
	return handles;
}
