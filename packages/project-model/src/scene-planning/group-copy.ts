/**
 * T2 D8b — `place-group-copy`: one group template becomes ordinary Scene source.
 *
 * One pure preparation turns one captured template and one origin into one
 * candidate Scene or one typed refusal. It mints nothing, reads no clock and
 * writes no envelope: ids are captured in the payload exactly as G1 duplicate
 * captures its copies, and the resource grant is applied by the planner after
 * this candidate is proven.
 *
 * **Origins are resolved by existing authorities.** A `support` origin is the
 * landed Scene floor-support query; an `overhead` origin is the same compile
 * plus T1's `queryOverheadSupports` at the floor elevation the pointer resolved,
 * so Scene adds no ceiling authority and never reads a hit Y; a `wall` origin is
 * editor-derived, as Artwork's is, and stores no wall relation.
 *
 * **Composition is G1's rigid image about the origin.** An upright member adds
 * the yaw exactly; a light pre-multiplies `Ry(θ)` and decomposes through G1's
 * declared branch. Every support-bearing member is then revalidated at its
 * destination by the same `resolveDestinationSupport` Move and Duplicate use, so
 * a pendant longer than the room refuses instead of crossing the floor.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core/geometry';
import type { LayoutVec2 } from '@portfolio/layout-core/geometry';
import type { SceneEntity, SceneObjectCluster, Vec3 } from '../scene';
import { cloneEntityWithId } from './operations/finalization';
import { refusal } from './operations/refusals';
import { readContactMinY, resolveDestinationSupport } from './operations/support';
import type {
	SceneOperationContext,
	SceneOperationRefusal,
	SceneOperationSupportEvidence,
} from './operations/types';
import { finalizeSceneCandidate } from './record-scope';
import { framePointToWorld, frameYawToWorld, isFinitePlacementFrame } from './frame';
import { buildLightEntity } from './light-operations';
import { readGroupName } from './group-operations';
import {
	admittedModelContact,
	readGroupTemplate,
	type GroupTemplateMember,
} from './group-template';
import { rigidOriginPosition, rigidTurnRotation, rigidYawAdd } from './rigid';
import {
	resolveSceneOverheadSupportOnGeometry,
	resolveSceneSupportOnGeometry,
	sceneSupportGenerationId,
	type SceneOverheadSupportResolution,
	type SceneSupportChoice,
} from './support';
import type { LocalInputFrame, NormalizedPlacementDefinition } from './types';
import type { ShapeIssue } from '../strict-shape';
import type { CameraFreeSceneDocument as SceneDocument } from '../units/types';

/** Where the composed group's template origin sits in the world. */
export type SceneGroupCopyOrigin =
	| {
			readonly kind: 'support';
			readonly worldXZ: readonly [number, number];
			readonly choice?: SceneSupportChoice;
	  }
	| {
			readonly kind: 'overhead';
			readonly worldXZ: readonly [number, number];
			readonly choice?: SceneSupportChoice;
	  }
	| { readonly kind: 'wall'; readonly position: Vec3 };

export type SceneGroupCopyCorrespondence =
	| { readonly relation: 'created'; readonly clusterId: string }
	| { readonly relation: 'created'; readonly entityId: string };

export type SceneGroupCopyCandidate = {
	readonly kind: 'candidate';
	readonly operationKind: 'place-group-copy';
	readonly clusterId: string;
	readonly entityIds: readonly string[];
	readonly scene: SceneDocument;
	readonly fields: readonly string[];
	/** The distinct shipped model assets the copy needs, in member order. */
	readonly assets: readonly string[];
	readonly correspondence: readonly SceneGroupCopyCorrespondence[];
	readonly support?: SceneOperationSupportEvidence;
	readonly diagnostics: readonly ShapeIssue[];
};

export type SceneGroupCopyResult = SceneGroupCopyCandidate | SceneOperationRefusal;

type ResolvedOrigin = {
	readonly kind: 'resolved';
	readonly origin: Vec3;
	readonly support?: SceneOperationSupportEvidence;
};

/** One witness-bearing support candidate, floor or overhead. */
type SupportWitnessSource = {
	readonly elevation: number;
	readonly generationId: string;
	readonly orderKey: string;
	readonly witnesses: readonly {
		readonly source:
			| { readonly kind: 'room'; readonly roomId: string }
			| { readonly kind: 'region'; readonly regionId: string };
		readonly floorId: string;
		readonly recordId: string;
	}[];
};

function evidenceOf(support: SupportWitnessSource): SceneOperationSupportEvidence {
	return {
		elevation: support.elevation,
		generationId: support.generationId,
		orderKey: support.orderKey,
		witnesses: support.witnesses.map((witness) => ({
			source:
				witness.source.kind === 'room'
					? { kind: 'room', roomId: witness.source.roomId }
					: { kind: 'region', regionId: witness.source.regionId },
			floorId: witness.floorId,
			recordId: witness.recordId,
		})),
	};
}

function resolvedPoint(
	frame: LocalInputFrame,
	worldXZ: readonly [number, number],
): LayoutVec2 | null {
	const point = framePointToWorld(frame, [worldXZ[0], 0, worldXZ[1]]);
	return Number.isFinite(point[0]) && Number.isFinite(point[2]) ? [point[0], point[2]] : null;
}

/**
 * Resolve the template origin for one placement.
 *
 * The overhead branch compiles the snapshot Layout once and reads both the
 * floor support and T1's overhead query from that same compile and generation,
 * so the floor beneath the pointer and the face above it cannot come from two
 * different documents.
 */
function resolveOrigin(input: {
	readonly context: SceneOperationContext;
	readonly origin: SceneGroupCopyOrigin;
	readonly frame: LocalInputFrame;
}): ResolvedOrigin | SceneOperationRefusal {
	if (input.origin.kind === 'wall') {
		const position = input.origin.position;
		if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite)) {
			return refusal('invalid-value', 'A wall origin needs a finite world position.', ['position']);
		}
		const point = framePointToWorld(input.frame, position);
		if (!point.every(Number.isFinite)) {
			return refusal('invalid-value', 'The composed wall origin is not finite.', ['position']);
		}
		return { kind: 'resolved', origin: [point[0], point[1], point[2]] };
	}
	const point = resolvedPoint(input.frame, input.origin.worldXZ);
	if (point === null) {
		return refusal('invalid-value', 'A group origin needs a finite world X/Z point.', ['worldXZ']);
	}
	if (input.origin.kind === 'support') {
		const support = resolveSceneSupportOnGeometry({
			geometry: compileWallFirstLayoutGeometry(input.context.layout).geometry,
			generationId: sceneSupportGenerationId(input.context.sourceContentId),
			point,
			requiredElevation: null,
			...(input.origin.choice === undefined ? {} : { choice: input.origin.choice }),
		});
		if (support.kind === 'refused') {
			return refusal(
				support.code,
				support.message,
				support.candidates.map((candidate) => candidate.orderKey),
			);
		}
		return {
			kind: 'resolved',
			origin: [point[0], support.support.elevation, point[1]],
			support: evidenceOf(support.support),
		};
	}
	const geometry = compileWallFirstLayoutGeometry(input.context.layout).geometry;
	const generationId = sceneSupportGenerationId(input.context.sourceContentId);
	const floor = resolveSceneSupportOnGeometry({
		geometry,
		generationId,
		point,
		requiredElevation: null,
		...(input.origin.choice === undefined ? {} : { choice: input.origin.choice }),
	});
	if (floor.kind === 'refused') {
		return refusal(
			floor.code,
			floor.message,
			floor.candidates.map((candidate) => candidate.orderKey),
		);
	}
	const overhead = resolveSceneOverheadSupportOnGeometry({
		geometry,
		generationId,
		point,
		aboveElevation: floor.support.elevation,
		...(input.origin.choice === undefined
			? {}
			: { evidenceGenerationId: input.origin.choice.generationId }),
	});
	if (overhead.kind === 'refused') return overheadRefusal(overhead);
	return {
		kind: 'resolved',
		origin: [point[0], overhead.support.elevation, point[1]],
		support: evidenceOf(overhead.support),
	};
}

function overheadRefusal(refused: Extract<SceneOverheadSupportResolution, { kind: 'refused' }>) {
	return refusal(
		refused.code,
		refused.message,
		refused.candidates.map((candidate) => candidate.orderKey),
	);
}

/** Build one member record with the captured id at its composed pose. */
function buildMember(
	member: GroupTemplateMember,
	entityId: string,
	position: Vec3,
	rotation: Vec3,
): { readonly kind: 'entity'; readonly entity: SceneEntity } | SceneOperationRefusal {
	if (member.kind === 'light') {
		// The one light gate a `create-light` also passes; the template already
		// validated the record, so a failure here is a defect, not a repair.
		const built = buildLightEntity({
			entityId,
			...(member.light === 'spot'
				? {
						light: 'spot',
						name: member.name,
						color: member.color,
						intensity: member.intensity,
						castShadow: member.castShadow,
						position,
						rotation,
						angle: member.angle,
						...(member.range === undefined ? {} : { range: member.range }),
						...(member.penumbra === undefined ? {} : { penumbra: member.penumbra }),
					}
				: {
						light: 'point',
						name: member.name,
						color: member.color,
						intensity: member.intensity,
						castShadow: member.castShadow,
						position,
						rotation,
						...(member.range === undefined ? {} : { range: member.range }),
					}),
		});
		if (built.kind === 'rejected') return built;
	}
	const source = { ...member, id: entityId, position, rotation } as SceneEntity;
	return { kind: 'entity', entity: cloneEntityWithId(source, entityId) };
}

/**
 * Prepare one `place-group-copy` candidate.
 *
 * Refusal precedence is fixed: the template body, the captured cluster name, the
 * captured identities, the frame and contacts, then the origin (missing target,
 * support choice, stale generation, no overhead), then per-member admission and
 * destination support. A failure for any member refuses the whole copy and names
 * that member; nothing is appended.
 */
export function prepareGroupCopyCandidate(input: {
	readonly context: SceneOperationContext;
	readonly template: unknown;
	readonly name: string;
	readonly origin: SceneGroupCopyOrigin;
	readonly yaw: number;
	readonly frame: LocalInputFrame;
	readonly entityIds: readonly string[];
	readonly clusterId: string;
	readonly contacts: readonly (number | null)[];
	readonly definitions?: readonly NormalizedPlacementDefinition[];
}): SceneGroupCopyResult {
	const parsed = readGroupTemplate(input.template);
	if (!parsed.success) {
		return refusal(
			'invalid-template',
			`The group template refuses: ${parsed.issues[0]?.message ?? 'invalid template'}.`,
			parsed.issues.map((issue) => `${issue.path}: ${issue.code}`),
		);
	}
	const template = parsed.template;
	const scene = input.context.scene;
	const name = readGroupName(input.name);
	if (name.kind === 'rejected') return name;
	if (!Number.isFinite(input.yaw)) {
		return refusal('invalid-value', 'A group copy needs a finite yaw.', ['yaw']);
	}
	if (!isFinitePlacementFrame(input.frame)) {
		return refusal('invalid-value', 'A group copy needs a finite yaw-only input frame.', ['frame']);
	}
	const entityIds = input.entityIds;
	if (!Array.isArray(entityIds) || entityIds.length !== template.members.length) {
		return refusal(
			'invalid-value',
			`A group copy needs exactly ${template.members.length} captured entity ids, one per member.`,
			['entityIds'],
		);
	}
	const captured = new Set<string>();
	for (const [index, entityId] of entityIds.entries()) {
		if (typeof entityId !== 'string' || entityId.trim().length === 0) {
			return refusal('invalid-value', 'A captured member id must be a non-empty id.', [
				`entityIds[${index}]`,
			]);
		}
		if (captured.has(entityId)) {
			return refusal(
				'invalid-value',
				`Captured group id "${entityId}" is used twice in member order.`,
				[entityId],
			);
		}
		captured.add(entityId);
		if (scene.entities.some((entity) => entity.id === entityId)) {
			return refusal(
				'invalid-value',
				`Captured group id "${entityId}" already exists in the accepted source.`,
				[entityId, 'duplicate-entity-id'],
			);
		}
	}
	if (typeof input.clusterId !== 'string' || input.clusterId.trim().length === 0) {
		return refusal('invalid-value', 'A group copy needs a captured cluster id.', ['clusterId']);
	}
	if (captured.has(input.clusterId)) {
		return refusal('invalid-value', 'The captured cluster id must differ from every member id.', [
			input.clusterId,
		]);
	}
	if ((scene.clusters ?? []).some((cluster) => cluster.id === input.clusterId)) {
		return refusal(
			'invalid-value',
			`Captured cluster id "${input.clusterId}" already exists in the accepted source.`,
			[input.clusterId, 'duplicate-cluster-id'],
		);
	}
	if (!Array.isArray(input.contacts) || input.contacts.length !== template.members.length) {
		return refusal(
			'invalid-value',
			`A group copy needs exactly ${template.members.length} captured contacts, one per member.`,
			['contacts'],
		);
	}
	const definitions = new Map(
		(input.definitions ?? []).map((definition) => [definition.definitionKey, definition]),
	);
	for (const [index, member] of template.members.entries()) {
		const contact = input.contacts[index];
		if (member.kind === 'light') {
			if (contact !== null) {
				return refusal(
					'invalid-value',
					`Group member "${member.name}" is a light and carries no contact.`,
					[`contacts[${index}]`],
				);
			}
			continue;
		}
		if (typeof contact !== 'number' || !Number.isFinite(contact)) {
			return refusal(
				'missing-contact-metadata',
				`Group member "${member.name}" has no captured contact height.`,
				[`contacts[${index}]`, 'contactMinY'],
			);
		}
		if (member.kind === 'model') {
			const admitted = admittedModelContact({
				assetId: member.assetId,
				name: member.name,
				definitions,
				captured: contact,
			});
			if (admitted.kind === 'rejected') return admitted;
		}
	}
	const resolved = resolveOrigin({
		context: input.context,
		origin: input.origin,
		frame: input.frame,
	});
	if (resolved.kind === 'rejected') return resolved;
	const yaw = frameYawToWorld(input.frame, input.yaw);
	if (!Number.isFinite(yaw)) {
		return refusal('invalid-value', 'The composed group yaw is not finite.', ['yaw']);
	}

	const entities: SceneEntity[] = [];
	const assets: string[] = [];
	for (const [index, member] of template.members.entries()) {
		const entityId = entityIds[index]!;
		const position = rigidOriginPosition(member.position, resolved.origin, yaw);
		const rotation =
			member.kind === 'light'
				? rigidTurnRotation(member.rotation, yaw)
				: rigidYawAdd(member.rotation, yaw);
		if (!position.every(Number.isFinite) || !rotation.every(Number.isFinite)) {
			return refusal(
				'invalid-value',
				`Group member "${member.name}" composes to a non-finite pose.`,
				[entityId],
			);
		}
		const built = buildMember(member, entityId, position, rotation);
		if (built.kind === 'rejected') return built;
		const entity = built.entity;
		if (member.kind !== 'light') {
			const contact = input.contacts[index]!;
			const read = readContactMinY(entity, contact);
			if (read.kind === 'rejected') return read;
			const support = resolveDestinationSupport({
				context: input.context,
				entity,
				contactMinY: read.value,
				point: [position[0], position[2]],
			});
			if (support.kind !== 'resolved') {
				const available = support.diagnostics.map((diagnostic) => diagnostic.message).join('; ');
				return refusal(
					support.code,
					`Group member "${entity.name}" (${entity.id}) cannot keep its height at its destination (${position[0]}, ${position[2]}): ${support.message}${available.length === 0 ? '' : ` Available: ${available}`}`,
					[entity.id, ...support.diagnostics.map((diagnostic) => diagnostic.message)],
				);
			}
		}
		if (member.kind === 'model' && !assets.includes(member.assetId)) assets.push(member.assetId);
		entities.push(entity);
	}

	const cluster: SceneObjectCluster = {
		id: input.clusterId,
		name: name.value,
		memberIds: [...entityIds],
	};
	const after: SceneDocument = {
		...scene,
		entities: [...scene.entities, ...entities],
		clusters: [...(scene.clusters ?? []), cluster],
	};
	const finalized = finalizeSceneCandidate({
		before: scene,
		after,
		scope: {
			operationKind: 'place-group-copy',
			changedEntityIds: [],
			changedEntityFields: [],
			createdEntityIds: [...entityIds],
			removedEntityIds: [],
			clusters: {
				created: [{ id: cluster.id, memberIds: [...entityIds] }],
				removed: [],
				renamed: [],
				pruned: [],
			},
		},
	});
	if (finalized.kind === 'rejected') {
		return {
			kind: 'rejected',
			code: finalized.code,
			message: finalized.message,
			diagnostics: finalized.diagnostics,
		};
	}
	return {
		kind: 'candidate',
		operationKind: 'place-group-copy',
		clusterId: cluster.id,
		entityIds: [...entityIds],
		scene: finalized.scene,
		fields: ['entities', 'clusters'],
		assets,
		correspondence: [
			{ relation: 'created', clusterId: cluster.id },
			...entityIds.map((entityId) => ({ relation: 'created' as const, entityId })),
		],
		...(resolved.support === undefined ? {} : { support: resolved.support }),
		diagnostics: [],
	};
}
