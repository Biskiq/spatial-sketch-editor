import { type LayoutVec2 } from '@portfolio/layout-core/geometry';
import { FLOOR_SUPPORT_TOLERANCES } from '@portfolio/layout-core/room';
import { sceneFormContactMinY } from '../../form';
import { type SceneEntity, type ScenePrimitiveEntity } from '../../scene';
import { framePointToWorld, frameYawToWorld } from '../frame';
import { unsupportedTransform, refusal } from './refusals';
import {
	type SceneOperationRefusal,
	type SceneOperationSupportEvidence,
	type SceneOperationContext,
	UPRIGHT_TOLERANCE,
	CONTACT_TOLERANCE_METERS,
} from './types';
import {
	resolveSceneSupport,
	resolveSceneSupportAtOrBelow,
	type SceneSupportChoice,
	type SceneSupportResolution,
} from '../support';
import { type LocalInputFrame } from '../types';
import { type CameraFreeSceneDocument as SceneDocument } from '../../units/types';

export function resolveSupport(
	context: SceneOperationContext,
	point: LayoutVec2,
	requiredElevation: number | null,
	choice: SceneSupportChoice | undefined,
):
	| { readonly kind: 'resolved'; readonly support: SceneOperationSupportEvidence }
	| SceneOperationRefusal {
	const resolution = resolveSceneSupport({
		layout: context.layout,
		sourceContentId: context.sourceContentId,
		point,
		requiredElevation,
		...(choice === undefined ? {} : { choice }),
	});
	return supportResolutionResult(resolution);
}

/**
 * The destination support for a Move or Duplicate that keeps Y.
 *
 * A resting member must find its unchanged resting elevation at the new point
 * (the `move-horizontal` rule). A lifted member must find the highest support
 * at or below its unchanged base; a surface above the base is not its support
 * and is ignored. The single and group planners share this one rule (G-6).
 *
 * The captured choice is applied at the **destination only**. The origin is read
 * from the encoded pose by `movableSupport`, so a choice the destination yields
 * is never vetoed by an origin that also has a higher support beneath it.
 */
export function resolveDestinationSupport(input: {
	readonly context: SceneOperationContext;
	readonly entity: SceneEntity;
	readonly contactMinY: number;
	readonly point: LayoutVec2;
	readonly choice?: SceneSupportChoice | undefined;
}):
	| { readonly kind: 'resolved'; readonly support: SceneOperationSupportEvidence }
	| SceneOperationRefusal {
	const rest = movableSupport(input.context, input.entity, input.contactMinY);
	if (rest.kind !== 'resolved') return rest;
	if (rest.lift <= CONTACT_TOLERANCE_METERS) {
		return resolveSupport(input.context, input.point, rest.resting, input.choice);
	}
	const resolution = resolveSceneSupportAtOrBelow({
		layout: input.context.layout,
		sourceContentId: input.context.sourceContentId,
		point: input.point,
		ceiling: rest.resting,
		...(input.choice === undefined ? {} : { choice: input.choice }),
	});
	return supportResolutionResult(resolution);
}

function supportResolutionResult(
	resolution: SceneSupportResolution,
):
	| { readonly kind: 'resolved'; readonly support: SceneOperationSupportEvidence }
	| SceneOperationRefusal {
	if (resolution.kind === 'resolved') {
		return {
			kind: 'resolved',
			support: {
				elevation: resolution.support.elevation,
				generationId: resolution.generationId,
				orderKey: resolution.support.orderKey,
				witnesses: resolution.support.witnesses.map((witness) => ({
					source:
						witness.source.kind === 'room'
							? { kind: 'room', roomId: witness.source.roomId }
							: { kind: 'region', regionId: witness.source.regionId },
					floorId: witness.floorId,
					recordId: witness.recordId,
				})),
			},
		};
	}
	return refusal(
		resolution.code,
		resolution.message,
		resolution.candidates.map(
			(candidate) => `${candidate.orderKey} · ${candidate.label} at ${candidate.elevation} m`,
		),
	);
}

/**
 * Whether the floor-transform planners may own this entity at all, with the
 * exact refusal they would give.
 *
 * The editor's Compose surface reads this same predicate, so a disabled control
 * and a planner refusal cannot disagree: lights, vertical planes, tilted
 * primitives and primitives without an analytic contact are all unsupported.
 * This is not a second capability model — it is the planner's own gate, exposed
 * for the one UI that must not offer a command it cannot run.
 */
export type FloorTransformSupport =
	| { readonly supported: true }
	| {
			readonly supported: false;
			readonly code: 'unsupported-transform';
			readonly message: string;
	  };

export function floorTransformSupport(entity: SceneEntity): FloorTransformSupport {
	if (entity.kind === 'artwork') {
		return {
			supported: false,
			code: 'unsupported-transform',
			message: 'Artwork is positioned by its centre and has no floor contact.',
		};
	}
	if (entity.kind === 'light') {
		return {
			supported: false,
			code: 'unsupported-transform',
			message: `Entity "${entity.id}" is a light; lights have no object footprint or floor placement to transform.`,
		};
	}
	if (entity.kind === 'primitive' && entity.primitive === 'plane') {
		return {
			supported: false,
			code: 'unsupported-transform',
			message: `Entity "${entity.id}" is a vertical plane, which has no honest floor footprint for this operation.`,
		};
	}
	if (!upright(entity)) {
		return {
			supported: false,
			code: 'unsupported-transform',
			message: `Entity "${entity.id}" is not a truthful upright floor object, so this operation cannot own its transform.`,
		};
	}
	if (entity.kind === 'form') {
		if (sceneFormContactMinY(entity.form) === null) {
			return {
				supported: false,
				code: 'unsupported-transform',
				message: `Entity "${entity.id}" has no honest floor contact, so this operation cannot own its transform.`,
			};
		}
		return { supported: true };
	}
	if (entity.kind === 'primitive' && analyticalContactMinY(entity) === null) {
		return {
			supported: false,
			code: 'unsupported-transform',
			message: `Entity "${entity.id}" has no honest floor footprint for this operation.`,
		};
	}
	return { supported: true };
}

export function readContactMinY(
	entity: SceneEntity,
	captured: number,
): { readonly kind: 'value'; readonly value: number } | SceneOperationRefusal {
	if (!Number.isFinite(captured)) {
		return refusal(
			'missing-contact-metadata',
			`Entity "${entity.id}" has no finite captured contact height.`,
			['contactMinY'],
		);
	}
	if (entity.kind === 'primitive') {
		const analytical = analyticalContactMinY(entity);
		if (analytical === null) return unsupportedTransform(entity.id, 'support');
		if (Math.abs(captured - analytical) > CONTACT_TOLERANCE_METERS) {
			return refusal(
				'missing-contact-metadata',
				`Entity "${entity.id}" declares contact ${captured} m but its ${entity.primitive} dimensions give ${analytical} m.`,
				['contactMinY', 'dimensions'],
			);
		}
	}
	if (entity.kind === 'form') {
		const analytical = sceneFormContactMinY(entity.form);
		if (analytical === null) return unsupportedTransform(entity.id, 'support');
		if (Math.abs(captured - analytical) > CONTACT_TOLERANCE_METERS) {
			return refusal(
				'missing-contact-metadata',
				`Entity "${entity.id}" declares contact ${captured} m but its form source gives ${analytical} m.`,
				['contactMinY', 'form'],
			);
		}
	}
	return { kind: 'value', value: captured };
}

export function analyticalContactMinY(entity: ScenePrimitiveEntity): number | null {
	switch (entity.primitive) {
		case 'box':
			return -entity.dimensions.height / 2;
		case 'cylinder':
			return -entity.dimensions.height / 2;
		case 'sphere':
			return -entity.dimensions.radius;
		case 'plane':
			return null;
	}
}

export function upright(entity: SceneEntity): boolean {
	const rotation = entity.rotation;
	return (
		Array.isArray(rotation) &&
		rotation.length === 3 &&
		rotation.every((value) => Number.isFinite(value)) &&
		Math.abs(rotation[0]) <= UPRIGHT_TOLERANCE &&
		Math.abs(rotation[2]) <= UPRIGHT_TOLERANCE
	);
}

export function entityScale(entity: SceneEntity): number {
	// Admission guarantees a finite positive scale (the codec refuses anything
	// else), so this is a defensive default for a corrupt source, not a repair.
	const scale = entity.scale ?? 1;
	return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

/**
 * The stored yaw when the captured angle is the same rotation, so a
 * canonicalized equivalent (e.g. 4.0 rad stored, -2.283… composed) does not
 * install a history entry for a change nobody can see.
 */
export function ownedYaw(existing: number, frame: LocalInputFrame, yaw: number): number {
	const next = frameYawToWorld(frame, yaw);
	const delta = Math.abs(Math.atan2(Math.sin(next - existing), Math.cos(next - existing)));
	return delta <= UPRIGHT_TOLERANCE ? existing : next;
}

export function restingElevation(entity: SceneEntity, contactMinY: number): number {
	return entity.position[1] + entityScale(entity) * contactMinY;
}

/**
 * The support a Move or Duplicate keeps its unchanged Y over, with its lift.
 *
 * This is the destination rule's origin half. A base that meets a support is
 * resting; any other base is lifted above the highest support at or below it. A
 * support within the platform's coplanar tolerance of the base counts as
 * resting even when it lies just above — a platform seam both sides of which a
 * destination query accepts. The captured choice belongs to the destination and
 * is not an input here.
 */
function movableSupport(
	context: SceneOperationContext,
	entity: SceneEntity,
	contactMinY: number,
):
	| {
			readonly kind: 'resolved';
			readonly support: SceneOperationSupportEvidence;
			readonly resting: number;
			readonly lift: number;
	  }
	| SceneOperationRefusal {
	const point: LayoutVec2 = [entity.position[0], entity.position[2]];
	const resting = restingElevation(entity, contactMinY);
	const onIt = resolveSupport(context, point, resting, undefined);
	if (onIt.kind === 'resolved')
		return { kind: 'resolved', support: onIt.support, resting, lift: 0 };
	const beneath = resolveSceneSupportAtOrBelow({
		layout: context.layout,
		sourceContentId: context.sourceContentId,
		point,
		ceiling: resting,
	});
	if (beneath.kind === 'resolved') {
		const lift = resting - beneath.support.elevation;
		if (lift > CONTACT_TOLERANCE_METERS) {
			return { kind: 'resolved', support: beneath.support, resting, lift };
		}
		// A seam admits a support just above the base; it is the same support the
		// destination query accepts, so the pose is resting on it, not stranded.
		if (Math.abs(lift) <= FLOOR_SUPPORT_TOLERANCES.coplanarElevationMeters) {
			return { kind: 'resolved', support: beneath.support, resting, lift: 0 };
		}
	}
	return onIt;
}

/**
 * The accepted lift of one entity above the support beneath it, or `null` when
 * neither its resting base nor anything beneath it resolves. Read-only: the
 * lift knob and the Card's Elevation field show this; `set-lift` changes it.
 */
export function sceneEntityLift(
	context: SceneOperationContext,
	entity: SceneEntity,
	contactMinY: number,
): { readonly lift: number; readonly supportY: number } | null {
	const rest = restSupport(context, entity, contactMinY, undefined);
	return rest.kind === 'resolved' ? { lift: rest.lift, supportY: rest.support.elevation } : null;
}

/**
 * The support an object rests on, or — when it is lifted — the support directly
 * beneath it, with the lift between them.
 *
 * A resting object resolves exactly as before (its resting elevation must be a
 * support). Only when that fails and a support lies strictly below the base is
 * the object lifted from it; any other failure is the original refusal. A form's
 * `contactMinY` already includes its per-axis scale, so its entity scale is 1.
 *
 * This is the explicit-reseating reading: `place-on-floor`, `resize-on-floor`
 * and `set-lift` keep their pre-G1 semantics, including a capture that the
 * unconstrained query cannot disambiguate. Move and Duplicate use
 * `movableSupport` instead.
 */
export function restSupport(
	context: SceneOperationContext,
	entity: SceneEntity,
	contactMinY: number,
	choice: SceneSupportChoice | undefined,
):
	| {
			readonly kind: 'resolved';
			readonly support: SceneOperationSupportEvidence;
			readonly resting: number;
			readonly lift: number;
	  }
	| SceneOperationRefusal {
	const point: LayoutVec2 = [entity.position[0], entity.position[2]];
	const resting = restingElevation(entity, contactMinY);
	const onIt = resolveSupport(context, point, resting, choice);
	if (onIt.kind === 'resolved')
		return { kind: 'resolved', support: onIt.support, resting, lift: 0 };
	const beneath = resolveSupport(context, point, null, choice);
	if (
		beneath.kind === 'resolved' &&
		resting > beneath.support.elevation + CONTACT_TOLERANCE_METERS
	) {
		return {
			kind: 'resolved',
			support: beneath.support,
			resting,
			lift: resting - beneath.support.elevation,
		};
	}
	return onIt;
}

export function worldPoint(
	frame: LocalInputFrame,
	worldXZ: readonly [number, number],
): LayoutVec2 | null {
	if (!Array.isArray(worldXZ) || worldXZ.length !== 2 || !worldXZ.every(Number.isFinite)) {
		return null;
	}
	const point = framePointToWorld(frame, [worldXZ[0], 0, worldXZ[1]]);
	return Number.isFinite(point[0]) && Number.isFinite(point[2]) ? [point[0], point[2]] : null;
}

export function readObject(
	scene: SceneDocument,
	entityId: string,
): { readonly kind: 'object'; readonly entity: SceneEntity } | SceneOperationRefusal {
	const entity = scene.entities.find((candidate) => candidate.id === entityId);
	if (entity === undefined) {
		return refusal(
			'missing-target',
			`No Scene entity "${entityId}" exists in the accepted source.`,
			[entityId],
		);
	}
	const support = floorTransformSupport(entity);
	if (!support.supported) return refusal(support.code, support.message, [entityId]);
	return { kind: 'object', entity };
}
