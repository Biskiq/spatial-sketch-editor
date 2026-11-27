/**
 * T2 D8b — the one reusable group template.
 *
 * A Scene cluster has no frame and no closure, so it cannot be a reusable
 * resource by itself. This module supplies that shape: a bounded list of
 * ordinary Scene entity records posed in one axis-aligned frame, with the strict
 * read, the canonical bytes and the read-only extraction from an accepted
 * cluster.
 *
 * The Scene 13 entity codec decides what a member is; on top of it the template
 * refuses what could never travel: Artwork (its image is project-private), a
 * vertical plane, a non-upright body and a model without a shipped pin. A member
 * carries no `id` and no project Finish. Extraction stores positions relative to
 * the group's X/Z rigid pivot at the support beneath its lowest point, so a
 * replay at yaw 0 on the same floor reproduces every pose and another floor
 * preserves every height above it. Canonical bytes are the writer's projection:
 * fixed fields and recursively sorted keys, so equal templates hash equally.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */
import type { LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { sceneFormContactMinY } from '../form';
import type {
	SceneEntity,
	SceneFormEntity,
	SceneLightEntity,
	SceneModelEntity,
	ScenePrimitiveEntity,
	Vec3,
} from '../scene';
import { cloneFormSource } from '../scene';
import { parseEntity } from '../scene-codec/parse-entities';
import type { SceneDocumentIssue } from '../scene-codec/types';
import { addIssue, assertAllowedKeys, isRecord, readRequiredString } from '../scene-codec/readers';
import { withSceneValidationOptions } from '../scene-validation';
import { getShippedModelByAssetId } from '../shipped-static';
import type { CameraFreeSceneDocument as SceneDocument } from '../units/types';
import {
	analyticalContactMinY,
	entityScale,
	floorTransformSupport,
	readContactMinY,
	upright,
} from './operations/support';
import type { SceneOperationRefusal } from './operations/types';
import { CONTACT_TOLERANCE_METERS, SCENE_NAME_LIMIT } from './operations/types';
import { refusal } from './operations/refusals';
import { rigidPivot } from './rigid';
import { resolveSceneSupportAtOrBelow } from './support';
import type { NormalizedPlacementDefinition } from './types';

/** A template needs two members, exactly like a Scene cluster. */
export const GROUP_TEMPLATE_MIN_MEMBERS = 2;

/** The largest group that may be saved or inserted, matching the plan's bound. */
export const GROUP_TEMPLATE_MAX_MEMBERS = 64;

/** The one name rule a template and its cluster share. */
export const GROUP_TEMPLATE_NAME_MAX_LENGTH = SCENE_NAME_LIMIT;

type DistributiveOmit<T, Key extends PropertyKey> = T extends unknown ? Omit<T, Key> : never;

/**
 * One member is a Scene entity record without its captured id and without a
 * project Finish. `scale` is carried exactly; a form's size is its own source.
 */
export type GroupTemplateMember =
	| DistributiveOmit<SceneLightEntity, 'id'>
	| DistributiveOmit<SceneModelEntity, 'id' | 'materialInstanceId'>
	| DistributiveOmit<SceneFormEntity, 'id' | 'materialInstanceId'>
	| DistributiveOmit<ScenePrimitiveEntity, 'id' | 'materialInstanceId'>;

/** The reusable description of one group, in its own frame. */
export type GroupTemplate = {
	/** The cluster name the template came from; 1–120 characters, trimmed. */
	readonly name: string;
	/** 2–64 members; order is the cluster's member order. */
	readonly members: readonly GroupTemplateMember[];
};

export type GroupTemplateIssue = SceneDocumentIssue;

export type GroupTemplateReadResult =
	| {
			readonly success: true;
			readonly template: GroupTemplate;
			readonly canonicalJson: string;
	  }
	| { readonly success: false; readonly issues: readonly GroupTemplateIssue[] };

/** The member source the canonical writer and the parser share. */
type TemplateMemberSource = GroupTemplateMember | SceneEntity;

function copyVec3(value: readonly [number, number, number]): Vec3 {
	return [value[0], value[1], value[2]];
}

/**
 * The canonical shape of one admitted member: explicit fields only, so a
 * captured id or project Finish is dropped. Artwork has no template shape.
 */
function templateMemberOf(source: TemplateMemberSource): GroupTemplateMember | null {
	switch (source.kind) {
		case 'artwork':
			return null;
		case 'light':
			return source.light === 'spot'
				? {
						kind: 'light',
						name: source.name,
						light: 'spot',
						color: source.color,
						intensity: source.intensity,
						castShadow: source.castShadow,
						position: copyVec3(source.position),
						rotation: copyVec3(source.rotation),
						...(source.scale === undefined ? {} : { scale: source.scale }),
						...(source.range === undefined ? {} : { range: source.range }),
						angle: source.angle,
						...(source.penumbra === undefined ? {} : { penumbra: source.penumbra }),
					}
				: {
						kind: 'light',
						name: source.name,
						light: 'point',
						color: source.color,
						intensity: source.intensity,
						castShadow: source.castShadow,
						position: copyVec3(source.position),
						rotation: copyVec3(source.rotation),
						...(source.scale === undefined ? {} : { scale: source.scale }),
						...(source.range === undefined ? {} : { range: source.range }),
					};
		case 'model':
			return {
				kind: 'model',
				name: source.name,
				assetId: source.assetId,
				fallback: source.fallback,
				position: copyVec3(source.position),
				rotation: copyVec3(source.rotation),
				...(source.scale === undefined ? {} : { scale: source.scale }),
			};
		case 'form':
			return {
				kind: 'form',
				name: source.name,
				form: cloneFormSource(source.form),
				materialId: source.materialId,
				castShadow: source.castShadow,
				receiveShadow: source.receiveShadow,
				position: copyVec3(source.position),
				rotation: copyVec3(source.rotation),
			};
		case 'primitive':
			return {
				kind: 'primitive',
				name: source.name,
				primitive: source.primitive,
				dimensions: { ...source.dimensions },
				materialId: source.materialId,
				castShadow: source.castShadow,
				receiveShadow: source.receiveShadow,
				position: copyVec3(source.position),
				rotation: copyVec3(source.rotation),
				...(source.scale === undefined ? {} : { scale: source.scale }),
			} as GroupTemplateMember;
	}
}

/**
 * The one canonical template object. Member order is authored source, so it is
 * preserved and never renumbered.
 */
export function canonicalGroupTemplate(template: GroupTemplate): GroupTemplate {
	return {
		name: template.name.trim(),
		members: template.members.map((member) => {
			const normalized = templateMemberOf(member);
			if (normalized === null) {
				throw new Error('A group template member cannot be Artwork.');
			}
			return normalized;
		}),
	};
}

/** Recursively sort object keys so equal templates always have equal bytes. */
function sortedKeys(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sortedKeys);
	if (value !== null && typeof value === 'object') {
		const record = value as Record<string, unknown>;
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(record).sort()) sorted[key] = sortedKeys(record[key]);
		return sorted;
	}
	return value;
}

/** The canonical JSON text of one template. */
export function canonicalGroupTemplateJson(template: GroupTemplate): string {
	return JSON.stringify(sortedKeys(canonicalGroupTemplate(template)));
}

/** The only canonical byte producer for a group template. */
export function canonicalGroupTemplateBytes(template: GroupTemplate): Uint8Array {
	return new TextEncoder().encode(canonicalGroupTemplateJson(template));
}

const TEMPLATE_MEMBER_ID = '__group-template-member__';

const memberParserOptions = {
	allowMaterialInstance: false,
	...withSceneValidationOptions(),
};

/**
 * Read one template strictly. The root admits exactly `name` and `members`; each
 * member is read by the Scene entity codec under a sentinel id, so a stray `id`,
 * `materialInstanceId` or unknown key refuses instead of being dropped. The model
 * pin is checked here because it is a shipped-registry fact; the admitted
 * contact is checked by the planner and by Save, where definitions are available.
 */
export function readGroupTemplate(input: unknown): GroupTemplateReadResult {
	const issues: GroupTemplateIssue[] = [];
	if (!isRecord(input)) {
		return {
			success: false,
			issues: [{ path: '$', code: 'invalid_type', message: 'Expected a group template object' }],
		};
	}
	assertAllowedKeys(input, ['name', 'members'], '$', issues);
	const rawName = readRequiredString(input, 'name', '$', issues);
	if (rawName !== undefined) {
		const trimmed = rawName.trim();
		if (trimmed.length === 0) {
			addIssue(issues, '$.name', 'empty_name', 'A group template needs a name');
		} else if (trimmed.length > GROUP_TEMPLATE_NAME_MAX_LENGTH) {
			addIssue(
				issues,
				'$.name',
				'name_too_long',
				`A group template name is at most ${GROUP_TEMPLATE_NAME_MAX_LENGTH} characters`,
			);
		}
	}
	const members: GroupTemplateMember[] = [];
	if (!Array.isArray(input.members)) {
		addIssue(issues, '$.members', 'not-an-array', '$.members must be an array of members');
	} else if (input.members.length < GROUP_TEMPLATE_MIN_MEMBERS) {
		addIssue(
			issues,
			'$.members',
			'group_too_small',
			`A group template needs at least ${GROUP_TEMPLATE_MIN_MEMBERS} members`,
		);
	} else if (input.members.length > GROUP_TEMPLATE_MAX_MEMBERS) {
		addIssue(
			issues,
			'$.members',
			'group_too_large',
			`A group template holds at most ${GROUP_TEMPLATE_MAX_MEMBERS} members`,
		);
	} else {
		for (const [index, raw] of input.members.entries()) {
			const member = readGroupTemplateMember(raw, `$.members[${index}]`, issues);
			if (member !== null) members.push(member);
		}
	}
	if (issues.length > 0 || rawName === undefined) return { success: false, issues };
	const template = canonicalGroupTemplate({ name: rawName, members });
	return { success: true, template, canonicalJson: canonicalGroupTemplateJson(template) };
}

function readGroupTemplateMember(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[],
): GroupTemplateMember | null {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a Scene entity object');
		return null;
	}
	for (const forbidden of ['id', 'materialInstanceId', 'roomId']) {
		if (forbidden in input) {
			addIssue(
				issues,
				`${path}.${forbidden}`,
				'unknown-key',
				`A group template member carries no ${forbidden}; it is captured per insertion`,
			);
			return null;
		}
	}
	const parsed = parseEntity(
		{ ...input, id: TEMPLATE_MEMBER_ID },
		path,
		issues,
		memberParserOptions,
	);
	if (parsed === undefined) return null;
	const member = templateMemberOf(parsed);
	if (member === null) {
		addIssue(
			issues,
			path,
			'ineligible-member',
			'Artwork stays in its project and cannot be saved in a group',
		);
		return null;
	}
	if (member.kind === 'primitive' && member.primitive === 'plane') {
		addIssue(
			issues,
			path,
			'ineligible-member',
			'A plane has no honest floor contact and cannot be saved in a group',
		);
		return null;
	}
	// Only a support-bearing member must be upright: a downward spot is what a
	// mounted fixture's emitter is, and G1 admits any light while checking the
	// floor objects.
	if (member.kind !== 'light' && !upright(parsed)) {
		addIssue(
			issues,
			path,
			'ineligible-member',
			`"${member.name}" is not upright, so this group cannot be saved`,
		);
		return null;
	}
	if (member.kind === 'model' && pinnedShippedModel(member.assetId) === null) {
		addIssue(
			issues,
			`${path}.assetId`,
			'ineligible-member',
			`"${member.assetId}" is not a pinned shipped catalogue model, so it stays in its project`,
		);
		return null;
	}
	return member;
}

/** The pinned production record of one shipped model, or `null`. */
function pinnedShippedModel(
	assetId: string,
): { readonly sha256: string; readonly byteSize: number } | null {
	const entry = getShippedModelByAssetId(assetId);
	if (entry === undefined || entry.pin === null || entry.productionFile === null) return null;
	return entry.pin;
}

/**
 * One model member's admitted contact, or the refusal that keeps it out. A pin
 * alone is not eligibility: the host definition must record a contact, and a
 * captured contact must agree with it, so a payload cannot shift the body.
 */
export function admittedModelContact(input: {
	readonly assetId: string;
	readonly name: string;
	readonly definitions: ReadonlyMap<string, NormalizedPlacementDefinition>;
	readonly captured?: number;
}): { readonly kind: 'contact'; readonly value: number } | SceneOperationRefusal {
	if (pinnedShippedModel(input.assetId) === null) {
		return refusal('unknown_asset', `Model "${input.assetId}" is not available in this version.`, [
			input.assetId,
			'unknown-shipped-asset',
		]);
	}
	const definition = input.definitions.get(`model:${input.assetId}`);
	const defaults = definition?.creationDefaults;
	if (
		definition === undefined ||
		defaults === undefined ||
		defaults.kind !== 'model' ||
		defaults.assetId !== input.assetId
	) {
		return refusal(
			'missing-definition',
			`"${input.name}" has no admitted placement definition in this session.`,
			[input.assetId, 'missing-definition'],
		);
	}
	const provenance = definition.admission.provenance;
	const operations = definition.admission.operations;
	if (
		provenance.kind !== 'verified-model' ||
		!provenance.verificationId.trim() ||
		!Number.isFinite(definition.contactMinY) ||
		(!operations.includes('place-object') && !operations.includes('place-group-copy')) ||
		!definition.admission.supportedSurfaces.includes('floor') ||
		!definition.admission.uprightOnly
	) {
		return refusal(
			'missing-contact-metadata',
			`"${input.name}" has no recorded contact height, so it cannot be placed in a group.`,
			[input.assetId, 'missing-contact-metadata'],
		);
	}
	if (
		input.captured !== undefined &&
		(!Number.isFinite(input.captured) ||
			Math.abs(input.captured - definition.contactMinY) > CONTACT_TOLERANCE_METERS)
	) {
		return refusal(
			'missing-contact-metadata',
			`"${input.name}" declares contact ${String(input.captured)} m but its admitted definition records ${definition.contactMinY} m.`,
			[input.assetId, 'contactMinY'],
		);
	}
	return { kind: 'contact', value: definition.contactMinY };
}

export type GroupTemplateExtraction =
	| {
			readonly kind: 'template';
			readonly template: GroupTemplate;
			/** The frame origin each member's stored position is relative to. */
			readonly origin: Vec3;
			/** The admitted contact used per member; `null` for a light. */
			readonly contacts: readonly (number | null)[];
	  }
	| SceneOperationRefusal;

/**
 * Extract one accepted cluster as a template frame. Read-only: nothing is
 * mutated, minted or written. The origin X/Z is the rigid pivot; the origin Y is
 * the highest support at or below the group's lowest point, resolved there.
 */
export function groupTemplateFromCluster(input: {
	readonly scene: SceneDocument;
	readonly layout: LayoutDocumentWallFirst;
	readonly sourceContentId: string;
	readonly clusterId: string;
	readonly definitions?: readonly NormalizedPlacementDefinition[];
}): GroupTemplateExtraction {
	const cluster = (input.scene.clusters ?? []).find(
		(candidate) => candidate.id === input.clusterId,
	);
	if (cluster === undefined) {
		return refusal(
			'missing-target',
			`No Scene cluster "${input.clusterId}" exists in the accepted source.`,
			[input.clusterId],
		);
	}
	if (cluster.memberIds.length < GROUP_TEMPLATE_MIN_MEMBERS) {
		return refusal(
			'invalid-template',
			`Group "${cluster.name}" has fewer than ${GROUP_TEMPLATE_MIN_MEMBERS} members.`,
			[input.clusterId],
		);
	}
	if (cluster.memberIds.length > GROUP_TEMPLATE_MAX_MEMBERS) {
		return refusal(
			'invalid-template',
			`Group "${cluster.name}" has more than ${GROUP_TEMPLATE_MAX_MEMBERS} members.`,
			[input.clusterId, 'group-too-large'],
		);
	}
	const definitions = new Map(
		(input.definitions ?? []).map((definition) => [definition.definitionKey, definition]),
	);
	const members: GroupTemplateMember[] = [];
	const contacts: (number | null)[] = [];
	const positions: Vec3[] = [];
	let lowest = Infinity;
	for (const memberId of cluster.memberIds) {
		const entity = input.scene.entities.find((candidate) => candidate.id === memberId);
		if (entity === undefined) {
			return refusal(
				'missing-target',
				`Group "${cluster.name}" names Scene entity "${memberId}", which does not exist.`,
				[input.clusterId, memberId],
			);
		}
		const contact = memberContact(entity, definitions);
		if (contact.kind === 'rejected') return contact;
		const member = templateMemberOf(entity);
		if (member === null) {
			return refusal(
				'ineligible-member',
				`"${entity.name}" cannot be saved in a group: Artwork stays in its project.`,
				[memberId],
			);
		}
		// A form already carries its per-axis size in its source, and the contact
		// read below includes it, so only a whole-entity scale multiplies it.
		const base =
			contact.value === null
				? entity.position[1]
				: entity.position[1] + entityScale(entity) * contact.value;
		lowest = Math.min(lowest, base);
		members.push(member);
		contacts.push(contact.value);
		positions.push(entity.position);
	}
	if (!Number.isFinite(lowest)) {
		return refusal('invalid-value', 'A group needs finite member positions.', [cluster.id]);
	}
	const pivot = rigidPivot(positions);
	if (pivot === null) {
		return refusal('invalid-value', 'A group needs finite member positions.', [cluster.id]);
	}
	const support = resolveSceneSupportAtOrBelow({
		layout: input.layout,
		sourceContentId: input.sourceContentId,
		point: [pivot.x, pivot.z],
		ceiling: lowest,
	});
	if (support.kind === 'refused') {
		return refusal(
			support.code,
			`Group "${cluster.name}" has no support beneath it: ${support.message}`,
			support.candidates.map((candidate) => candidate.orderKey),
		);
	}
	const origin: Vec3 = [pivot.x, support.support.elevation, pivot.z];
	const framed = members.map((member): GroupTemplateMember => {
		const local: Vec3 = [
			member.position[0] - origin[0],
			member.position[1] - origin[1],
			member.position[2] - origin[2],
		];
		return templateMemberOf({ ...member, position: local } as GroupTemplateMember) ?? member;
	});
	return {
		kind: 'template',
		template: canonicalGroupTemplate({ name: cluster.name, members: framed }),
		origin,
		contacts,
	};
}

function memberContact(
	entity: SceneEntity,
	definitions: ReadonlyMap<string, NormalizedPlacementDefinition>,
): { readonly kind: 'contact'; readonly value: number | null } | SceneOperationRefusal {
	if (entity.kind === 'light') return { kind: 'contact', value: null };
	if (entity.kind === 'artwork') {
		return refusal(
			'ineligible-member',
			`"${entity.name}" cannot be saved in a group: Artwork stays in its project.`,
			[entity.id],
		);
	}
	if (entity.kind === 'model') {
		const admitted = admittedModelContact({
			assetId: entity.assetId,
			name: entity.name,
			definitions,
		});
		if (admitted.kind === 'rejected') {
			return refusal(
				'ineligible-member',
				`"${entity.name}" cannot be saved yet: ${admitted.message}`,
				[entity.id, ...admitted.diagnostics.map((diagnostic) => diagnostic.message)],
			);
		}
		return { kind: 'contact', value: admitted.value };
	}
	const support = floorTransformSupport(entity);
	if (!support.supported) {
		return refusal(
			'ineligible-member',
			`"${entity.name}" cannot be saved in a group: ${support.message}`,
			[entity.id],
		);
	}
	const analytical =
		entity.kind === 'form' ? sceneFormContactMinY(entity.form) : analyticalContactMinY(entity);
	if (analytical === null) {
		return refusal(
			'ineligible-member',
			`"${entity.name}" has no honest floor contact and cannot be saved in a group.`,
			[entity.id],
		);
	}
	const read = readContactMinY(entity, analytical);
	if (read.kind === 'rejected') {
		return refusal(
			'ineligible-member',
			`"${entity.name}" cannot be saved in a group: ${read.message}`,
			[entity.id],
		);
	}
	return { kind: 'contact', value: read.value };
}
