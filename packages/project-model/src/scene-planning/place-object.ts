/**
 * T2.P01.S01 — deterministic `place-object` candidate preparation.
 *
 * One pure function turns captured inputs into one candidate Scene or one typed
 * refusal. It allocates nothing, reads no clock, no catalogue, no mesh and no
 * renderer object; a replayed preparation produces the identical candidate.
 *
 * Two invariants are structural rather than policed:
 *
 * - **A mesh hit's Y is never an input.** The point arrives as world X/Z only,
 *   with the compile generation its evidence belongs to; the contact elevation
 *   comes from the chosen Layout support. A 3D hit's face height therefore
 *   cannot corrupt the committed pose, because there is nowhere to put it.
 * - **Camera-bearing Scene fields cannot change.** The candidate replaces the
 *   entity list and carries every other Scene field over by reference, so
 *   `navigationNodes`, `connections`, `clusters`, `textures` and `materials`
 *   are the same objects the accepted source already held.
 *
 * Support resolution is the caller's: query the Layout floor supports, choose
 * one through the chooser, then prepare. This function never queries and never
 * picks an elevation — a `choice-required` support is a refusal, not a guess.
 *
 * Refusal precedence is fixed and documented so a caller can depend on it:
 * captured input (`invalid-value`), definition completeness
 * (`missing-footprint`, then `missing-contact-metadata`), admission
 * (`unsupported-surface`), support resolution (`no-support` /
 * `support-choice-required`), a refused support query (`invalid-value` with the
 * query's code), then staleness (`stale-generation`).
 */
import type { FloorSupportCandidate, LayoutVec2 } from '@portfolio/layout-core';
import type {
	SceneBoxDimensions,
	SceneCylinderDimensions,
	SceneDocument,
	SceneEntity,
	ScenePrimitiveEntity,
	SceneSphereDimensions,
	Vec3
} from '../scene';
import { framePointToWorld, frameYawToWorld, isFinitePlacementFrame } from './frame';
import type { LocalInputFrame, NormalizedPlacementDefinition } from './types';

/**
 * The support the caller resolved for this placement.
 *
 * `choice-required` and `none` are first-class here: they are the two honest
 * outcomes of a query that could not name one support, and the planner refuses
 * on both rather than defaulting.
 */
export type PlaceObjectSupportInput =
	| { kind: 'resolved'; support: FloorSupportCandidate }
	| { kind: 'choice-required'; candidates: readonly FloorSupportCandidate[] }
	| { kind: 'none' }
	| { kind: 'refused'; code: string; message: string };

export type PlaceObjectInput = {
	/** The accepted source the candidate is prepared against. */
	document: SceneDocument;
	/** Captured before preparation; never allocated during it. */
	entityId: string;
	definition: NormalizedPlacementDefinition;
	/** World X/Z in the declared frame's local X/Z. */
	worldXZ: LayoutVec2;
	/** Local yaw in radians, composed with the frame once. */
	yaw: number;
	frame: LocalInputFrame;
	/** The caller's compile generation; a support from another one is stale. */
	generationId: string;
	support: PlaceObjectSupportInput;
};

export type PlaceObjectRefusalCode =
	| 'no-support'
	| 'support-choice-required'
	| 'unsupported-surface'
	| 'missing-footprint'
	| 'missing-contact-metadata'
	| 'invalid-value'
	| 'stale-generation';

/** The read-only Layout evidence the accepted pose rests on. */
export type PlacementSupportEvidence = {
	floorId: string;
	roomId: string;
	elevation: number;
	generationId: string;
	orderKey: string;
	upNormal: Vec3;
};

export type PlaceObjectWorldPose = {
	position: Vec3;
	rotation: Vec3;
	/** The prepared relative scalar scale: 1, always. */
	scale: 1;
};

export type PlaceObjectCandidate = {
	operationKind: 'place-object';
	entityId: string;
	definitionKey: string;
	metadataContentId: string;
	/** The one new entity; nothing else in the Scene is touched. */
	entity: SceneEntity;
	/** The candidate Scene: the entity list replaced, every other field carried over. */
	scene: SceneDocument;
	worldPose: PlaceObjectWorldPose;
	support: PlacementSupportEvidence;
};

export type PlaceObjectResult =
	| { kind: 'candidate'; candidate: PlaceObjectCandidate }
	| {
			kind: 'refusal';
			code: PlaceObjectRefusalCode;
			message: string;
			diagnostics: readonly string[];
	  };

export function preparePlaceObjectCandidate(input: PlaceObjectInput): PlaceObjectResult {
	const invalid = validateCapturedInput(input);
	if (invalid !== null) return invalid;

	const footprint = validateFootprint(input.definition);
	if (footprint !== null) return footprint;

	if (!Number.isFinite(input.definition.contactMinY)) {
		return refuse(
			'missing-contact-metadata',
			`Definition "${input.definition.definitionKey}" declares no finite contact height.`,
			['contactMinY']
		);
	}

	const unsupported = validateAdmission(input.definition);
	if (unsupported !== null) return unsupported;

	if (input.support.kind === 'none') {
		return refuse(
			'no-support',
			'No compiled Room floor supports this point, so nothing can rest on it.',
			['no-support']
		);
	}
	if (input.support.kind === 'choice-required') {
		return refuse(
			'support-choice-required',
			`${input.support.candidates.length} floor supports contain this point at different elevations; the creator must choose one.`,
			input.support.candidates.map((candidate) => candidate.orderKey)
		);
	}
	if (input.support.kind === 'refused') {
		return refuse('invalid-value', input.support.message, [input.support.code]);
	}

	const support = input.support.support;
	if (support.generationId !== input.generationId) {
		return refuse(
			'stale-generation',
			`Support was resolved against compile generation "${support.generationId}" and this preparation is generation "${input.generationId}".`,
			[support.orderKey, support.generationId, input.generationId]
		);
	}

	if (support.witnesses.length === 0) {
		return refuse(
			'invalid-value',
			'A resolved floor support carries no compiled source witness, so its evidence is unqualified.',
			['no-witness']
		);
	}

	// Contact elevation is Layout support, never the frame's incidental origin
	// height: the frame's Y contributes nothing to the resting pose.
	const worldPoint = framePointToWorld(input.frame, [input.worldXZ[0], 0, input.worldXZ[1]]);
	const scale = 1 as const;
	const position: Vec3 = [
		worldPoint[0],
		support.elevation - scale * input.definition.contactMinY,
		worldPoint[2]
	];
	if (position.some((value) => !Number.isFinite(value))) {
		return refuse(
			'invalid-value',
			'The composed world pose is not finite, so this placement cannot be prepared.',
			['non-finite-pose']
		);
	}
	const rotation: Vec3 = [0, frameYawToWorld(input.frame, input.yaw), 0];

	const entity = buildEntity(input, position, rotation);
	if (entity === null) {
		return refuse(
			'invalid-value',
			`Definition "${input.definition.definitionKey}" has no constructible entity kind.`,
			['creationDefaults']
		);
	}

	const scene: SceneDocument = { ...input.document, entities: [...input.document.entities, entity] };

	return {
		kind: 'candidate',
		candidate: {
			operationKind: 'place-object',
			entityId: input.entityId,
			definitionKey: input.definition.definitionKey,
			metadataContentId: input.definition.metadataContentId,
			entity,
			scene,
			worldPose: { position, rotation, scale },
			support: {
				floorId: support.witnesses[0]!.floorId,
				roomId: support.witnesses[0]!.roomId,
				elevation: support.elevation,
				generationId: support.generationId,
				orderKey: support.orderKey,
				upNormal: [support.upNormal[0], support.upNormal[1], support.upNormal[2]] as Vec3
			}
		}
	};
}

function validateCapturedInput(input: PlaceObjectInput): PlaceObjectResult | null {
	if (typeof input.entityId !== 'string' || input.entityId.trim().length === 0) {
		return refuse('invalid-value', 'A placement needs a captured entity id.', ['entityId']);
	}
	if (input.document.entities.some((entity) => entity.id === input.entityId)) {
		return refuse(
			'invalid-value',
			`Entity id "${input.entityId}" is already used by the accepted source.`,
			['entityId', 'duplicate-entity-id']
		);
	}
	if (typeof input.generationId !== 'string' || input.generationId.trim().length === 0) {
		return refuse('invalid-value', 'A placement needs the compile generation it is prepared against.', [
			'generationId'
		]);
	}
	if (typeof input.definition.definitionKey !== 'string' || input.definition.definitionKey.trim().length === 0) {
		return refuse('invalid-value', 'A placement needs a definition key.', ['definitionKey']);
	}
	if (
		typeof input.definition.metadataContentId !== 'string' ||
		input.definition.metadataContentId.trim().length === 0
	) {
		return refuse(
			'invalid-value',
			'A placement needs the captured metadata identity of its definition.',
			['metadataContentId']
		);
	}
	if (
		!Array.isArray(input.worldXZ) ||
		input.worldXZ.length !== 2 ||
		!Number.isFinite(input.worldXZ[0]) ||
		!Number.isFinite(input.worldXZ[1])
	) {
		return refuse(
			'invalid-value',
			`A placement needs a finite world X/Z point; received ${JSON.stringify(input.worldXZ)}.`,
			['worldXZ']
		);
	}
	if (!Number.isFinite(input.yaw)) {
		return refuse('invalid-value', 'A placement needs a finite local yaw.', ['yaw']);
	}
	if (!isFinitePlacementFrame(input.frame)) {
		return refuse(
			'invalid-value',
			'A placement needs a finite yaw-only input frame (finite origin and yaw).',
			['frame']
		);
	}
	return null;
}

function validateFootprint(definition: NormalizedPlacementDefinition): PlaceObjectResult | null {
	const footprint = definition.footprintMeters;
	if (!Array.isArray(footprint) || footprint.length < 3) {
		return refuse(
			'missing-footprint',
			`Definition "${definition.definitionKey}" has no canonical local footprint polygon.`,
			['footprintMeters']
		);
	}
	for (const point of footprint) {
		if (
			!Array.isArray(point) ||
			point.length !== 2 ||
			!Number.isFinite(point[0]) ||
			!Number.isFinite(point[1])
		) {
			return refuse(
				'missing-footprint',
				`Definition "${definition.definitionKey}" has a non-finite footprint point.`,
				['footprintMeters']
			);
		}
	}
	return null;
}

function validateAdmission(definition: NormalizedPlacementDefinition): PlaceObjectResult | null {
	const admission = definition.admission;
	if (!admission.supportedSurfaces.includes('floor') || !admission.uprightOnly) {
		return refuse(
			'unsupported-surface',
			`Definition "${definition.definitionKey}" is not admitted for upright floor support (surfaces: ${admission.supportedSurfaces.join(', ') || 'none'}, uprightOnly: ${String(admission.uprightOnly)}).`,
			[...admission.supportedSurfaces, ...admission.exclusions.map((exclusion) => exclusion.code)]
		);
	}
	return null;
}

function buildEntity(input: PlaceObjectInput, position: Vec3, rotation: Vec3): SceneEntity | null {
	const defaults = input.definition.creationDefaults;
	const materialInstanceId = defaults.materialInstanceId;
	if (defaults.kind === 'model') {
		return {
			kind: 'model',
			id: input.entityId,
			name: defaults.name,
			assetId: defaults.assetId,
			fallback: defaults.fallback,
			position,
			rotation,
			scale: 1,
			...(materialInstanceId === undefined ? {} : { materialInstanceId })
		};
	}
	switch (defaults.primitive) {
		case 'box': {
			const dimensions: SceneBoxDimensions = {
				width: defaults.dimensions.width,
				height: defaults.dimensions.height,
				depth: defaults.dimensions.depth
			};
			const entity: ScenePrimitiveEntity = {
				kind: 'primitive',
				primitive: 'box',
				dimensions,
				id: input.entityId,
				name: defaults.name,
				materialId: defaults.materialId,
				castShadow: defaults.castShadow,
				receiveShadow: defaults.receiveShadow,
				position,
				rotation,
				scale: 1,
				...(materialInstanceId === undefined ? {} : { materialInstanceId })
			};
			return entity;
		}
		case 'cylinder': {
			const dimensions: SceneCylinderDimensions = {
				radius: defaults.dimensions.radius,
				height: defaults.dimensions.height
			};
			const entity: ScenePrimitiveEntity = {
				kind: 'primitive',
				primitive: 'cylinder',
				dimensions,
				id: input.entityId,
				name: defaults.name,
				materialId: defaults.materialId,
				castShadow: defaults.castShadow,
				receiveShadow: defaults.receiveShadow,
				position,
				rotation,
				scale: 1,
				...(materialInstanceId === undefined ? {} : { materialInstanceId })
			};
			return entity;
		}
		case 'sphere': {
			const dimensions: SceneSphereDimensions = { radius: defaults.dimensions.radius };
			const entity: ScenePrimitiveEntity = {
				kind: 'primitive',
				primitive: 'sphere',
				dimensions,
				id: input.entityId,
				name: defaults.name,
				materialId: defaults.materialId,
				castShadow: defaults.castShadow,
				receiveShadow: defaults.receiveShadow,
				position,
				rotation,
				scale: 1,
				...(materialInstanceId === undefined ? {} : { materialInstanceId })
			};
			return entity;
		}
	}
	return null;
}

function refuse(
	code: PlaceObjectRefusalCode,
	message: string,
	diagnostics: readonly string[] = []
): PlaceObjectResult {
	return { kind: 'refusal', code, message, diagnostics };
}
