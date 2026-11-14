/**
 * X8 — the Light Card's read-only facts.
 *
 * What the Card says about a Light (kind, brightness, position, aim, reach, beam,
 * shadow) and what it says about an object a light
 * reaches ("Lit by"). Pure reads of the accepted snapshot and the binding's
 * camera-free scene pick: no lifetime, no lease, no write. The Card's field
 * writer stays `LightCardFields`; its commands stay in `light-actions`.
 */
import type { SceneEntity, Vec3 } from '@portfolio/project-model';
import type {
	StageAdapterContext,
	StageAdapterServices,
	StageCardFact,
	StageCardSubject
} from '$lib/authoring/stage/stage-adapter-host';
import { stageScene } from '$lib/authoring/stage/stage-adapter-host';
import { sceneEntityReference } from '../scene/placement';
import { lightForward } from '../../look/light-aim';
import { lightKindLabel, radiansToDegrees } from '../../look/light-units';
import {
	formatDegrees,
	formatExactIntensity,
	formatMeters,
	formatMultiplier
} from '../../look/light-presentation';
import {
	boundsCorners,
	distance,
	dot,
	nearestPointInBounds,
	sub,
	type SceneBounds
} from './light-math';
import { isLight, lightById, lightRange, spotTargetFor, type Light } from './light-subjects';


/** A light illuminates an object only when it reaches its bounds, not its centre. */
function illuminates(light: Light, bounds: SceneBounds): boolean {
	const range = lightRange(light);
	if (light.light === 'point') {
		if (range === undefined) return true;
		return distance(light.position, nearestPointInBounds(light.position, bounds)) <= range;
	}
	return boundsCorners(bounds).some((corner) => {
		if (range !== undefined && distance(light.position, corner) > range) return false;
		const direction = lightForward(light.rotation);
		const toPoint = sub(corner, light.position);
		const distanceAlong = dot(toPoint, direction);
		if (!(distanceAlong > 0)) return false;
		const perpendicular = Math.hypot(
			toPoint[0] - direction[0] * distanceAlong,
			toPoint[1] - direction[1] * distanceAlong,
			toPoint[2] - direction[2] * distanceAlong
		);
		return Math.atan2(perpendicular, distanceAlong) <= light.angle;
	});
}

export function lightFacts(light: Light, adapterContext: StageAdapterContext): readonly StageCardFact[] {
	const facts: StageCardFact[] = [
		{ label: 'Kind', value: lightKindLabel(light.light), fieldId: 'kind' },
		{
			label: 'Brightness',
			value: `${formatMultiplier(light.intensity)} · ${formatExactIntensity(light.intensity)}`,
			fieldId: 'brightness'
		}
	];
	facts.push({
		label: 'Position',
		value: `${formatMeters(light.position[0])} · ${formatMeters(light.position[1])} · ${formatMeters(light.position[2])}`,
		fieldId: 'position'
	});
	if (light.light === 'spot') {
		const target = spotTargetFor(light, adapterContext);
		facts.push({
			label: 'Aim',
			value: `${formatMeters(target.target[0])} · ${formatMeters(target.target[1])} · ${formatMeters(target.target[2])}`,
			fieldId: 'aim'
		});
	}
	const range = lightRange(light);
	if (range !== undefined) {
		facts.push({ label: 'Reach', value: formatMeters(range), fieldId: 'reach' });
	}
	if (light.light === 'spot') {
		facts.push({
			label: 'Beam',
			value: formatDegrees(radiansToDegrees(light.angle)),
			fieldId: 'angle'
		});
	}
	facts.push({
		label: 'Shadow',
		value: light.castShadow ? 'On' : 'Off',
		fieldId: 'shadow'
	});
	return facts;
}

/** The facts for a Card subject: a light's own, or "Lit by" for an object it reaches. */
export function lightCardFacts(
	services: StageAdapterServices,
	subject: StageCardSubject,
	cardPickContext: StageAdapterContext
): readonly StageCardFact[] {
	if (subject.sourceKind !== 'entity') return [];
	const snapshot = services.stage.snapshot();
	const light = lightById(snapshot, subject.sourceId);
	if (light !== null) return lightFacts(light, cardPickContext);
	const target = stageScene(snapshot).entities.find(
		(candidate) => candidate.id === subject.sourceId
	);
	if (target === undefined) return [];
	const bounds = services.stage.sceneBounds(target.id);
	if (bounds === null) return [];
	const lights = stageScene(snapshot).entities.filter(
		(candidate): candidate is Light =>
			isLight(candidate) && illuminates(candidate, bounds)
	);
	if (lights.length === 0) return [];
	const names = lights.slice(0, 2).map((candidate) => candidate.name);
	const first = lights[0]!;
	const reference = sceneEntityReference(
		first.id,
		snapshot.domain.unitRevisions.scene
	);
	return [
		{
			label: 'Lit by',
			value: `${names.join(', ')}${lights.length > 2 ? ` +${lights.length - 2}` : ''}`,
			select: {
				reference,
				onSelect: () => services.stage.setSelection({ ordered: [{ reference }], primary: reference })
			}
		}
	];
}
