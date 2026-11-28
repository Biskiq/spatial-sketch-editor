import { type Vec3 } from '../../scene';
import { type SceneOperationPayload } from './types';
import { readFrame, readFrameReference, readPoint, readSupportChoice } from './readers';
import { readGroupTemplate, type GroupTemplate } from '../group-template';
import { ShapeReader } from '../../strict-shape';

/** Read a non-empty list of captured opaque ids. */
function readIds(reader: ShapeReader, input: unknown, path: string): string[] | null {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array of ids`);
		return null;
	}
	const ids: string[] = [];
	for (const [index, value] of input.entries()) {
		const id = reader.opaqueId(value, `${path}[${index}]`);
		if (id === null) return null;
		ids.push(id);
	}
	return ids;
}

function readCopies(reader: ShapeReader, input: unknown, path: string) {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array of captured member copies`);
		return null;
	}
	const copies: { sourceEntityId: string; entityId: string }[] = [];
	for (const [index, value] of input.entries()) {
		const entryPath = `${path}[${index}]`;
		const record = reader.object(value, entryPath, ['sourceEntityId', 'entityId']);
		if (record === null) return null;
		const sourceEntityId = reader.opaqueId(record.sourceEntityId, `${entryPath}.sourceEntityId`);
		const entityId = reader.opaqueId(record.entityId, `${entryPath}.entityId`);
		if (sourceEntityId === null || entityId === null) return null;
		copies.push({ sourceEntityId, entityId });
	}
	return copies;
}

function readContacts(
	reader: ShapeReader,
	input: unknown,
	path: string,
): readonly { readonly entityId: string; readonly contactMinY: number }[] | null {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array of captured contacts`);
		return null;
	}
	const contacts: { entityId: string; contactMinY: number }[] = [];
	for (const [index, value] of input.entries()) {
		const entryPath = `${path}[${index}]`;
		const record = reader.object(value, entryPath, ['entityId', 'contactMinY']);
		if (record === null) return null;
		const entityId = reader.opaqueId(record.entityId, `${entryPath}.entityId`);
		const contactMinY = reader.number(record.contactMinY, `${entryPath}.contactMinY`);
		if (entityId === null || contactMinY === null) return null;
		contacts.push({ entityId, contactMinY });
	}
	return contacts;
}

export function readGroupCreatePayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['clusterId', 'memberIds', 'name']);
	if (record === null) return null;
	const clusterId = reader.opaqueId(record.clusterId, `${path}.clusterId`);
	const memberIds = readIds(reader, record.memberIds, `${path}.memberIds`);
	const name = reader.string(record.name, `${path}.name`);
	if (clusterId === null || memberIds === null || name === null) return null;
	return { kind: 'scene-group-create', clusterId, memberIds, name };
}

export function readGroupUngroupPayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['clusterId']);
	if (record === null) return null;
	const clusterId = reader.opaqueId(record.clusterId, `${path}.clusterId`);
	return clusterId === null ? null : { kind: 'scene-group-ungroup', clusterId };
}

export function readGroupRenamePayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['clusterId', 'name']);
	if (record === null) return null;
	const clusterId = reader.opaqueId(record.clusterId, `${path}.clusterId`);
	const name = reader.string(record.name, `${path}.name`);
	return clusterId === null || name === null
		? null
		: { kind: 'scene-group-rename', clusterId, name };
}

export function readGroupTransformPayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'clusterId',
		'motion',
		'frame',
		'frameReference',
		'contacts',
	]);
	if (record === null) return null;
	const clusterId = reader.opaqueId(record.clusterId, `${path}.clusterId`);
	const motionPath = `${path}.motion`;
	const motionRecord = reader.object(record.motion, motionPath, ['kind', 'deltaXZ', 'yaw']);
	if (motionRecord === null) return null;
	const motionKind = reader.tag(motionRecord.kind, `${motionPath}.kind`, ['move', 'turn']);
	let motion: { kind: 'move'; deltaXZ: [number, number] } | { kind: 'turn'; yaw: number } | null =
		null;
	if (motionKind === 'move') {
		const deltaXZ = readPoint(reader, motionRecord.deltaXZ, `${motionPath}.deltaXZ`);
		if (motionRecord.yaw !== undefined) {
			reader.problem(`${motionPath}.yaw`, 'unknown-key', `${motionPath}.yaw belongs to a Turn`);
		}
		if (deltaXZ !== null) motion = { kind: 'move', deltaXZ };
	} else if (motionKind === 'turn') {
		const yaw = reader.number(motionRecord.yaw, `${motionPath}.yaw`);
		if (motionRecord.deltaXZ !== undefined) {
			reader.problem(
				`${motionPath}.deltaXZ`,
				'unknown-key',
				`${motionPath}.deltaXZ belongs to a Move`,
			);
		}
		if (yaw !== null) motion = { kind: 'turn', yaw };
	}
	const frame = readFrame(reader, record.frame, `${path}.frame`);
	const frameReference = readFrameReference(
		reader,
		record.frameReference,
		`${path}.frameReference`,
		frame,
	);
	const contacts = readContacts(reader, record.contacts, `${path}.contacts`);
	if (
		clusterId === null ||
		motion === null ||
		frame === null ||
		!frameReference.ok ||
		contacts === null
	) {
		return null;
	}
	return {
		kind: 'scene-group-transform',
		clusterId,
		motion,
		frame,
		frameReference: frameReference.value,
		contacts,
	};
}

export function readGroupDuplicatePayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['clusterId', 'copies', 'newClusterId', 'contacts']);
	if (record === null) return null;
	const clusterId = reader.opaqueId(record.clusterId, `${path}.clusterId`);
	const copies = readCopies(reader, record.copies, `${path}.copies`);
	const newClusterId = reader.opaqueId(record.newClusterId, `${path}.newClusterId`);
	const contacts = readContacts(reader, record.contacts, `${path}.contacts`);
	if (clusterId === null || copies === null || newClusterId === null || contacts === null) {
		return null;
	}
	return { kind: 'scene-group-duplicate', clusterId, copies, newClusterId, contacts };
}

export function readGroupErasePayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['clusterId']);
	if (record === null) return null;
	const clusterId = reader.opaqueId(record.clusterId, `${path}.clusterId`);
	return clusterId === null ? null : { kind: 'scene-group-erase', clusterId };
}

export function readCreateLightRigPayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['clusterId', 'name', 'lights']);
	if (record === null) return null;
	const clusterId = reader.opaqueId(record.clusterId, `${path}.clusterId`);
	const name = reader.string(record.name, `${path}.name`);
	if (!Array.isArray(record.lights)) {
		reader.problem(`${path}.lights`, 'not-an-array', `${path}.lights must be an array`);
		return null;
	}
	const lights = record.lights.map((value, index) =>
		readRigLight(reader, value, `${path}.lights[${index}]`),
	);
	if (clusterId === null || name === null || lights.some((light) => light === null)) return null;
	return {
		kind: 'create-light-rig',
		clusterId,
		name,
		lights: lights as NonNullable<(typeof lights)[number]>[],
	};
}

/** One `place-group-copy` origin: a resolved floor, an overhead face or a wall pose. */
type GroupCopyOriginPayload = Extract<
	SceneOperationPayload,
	{ kind: 'place-group-copy' }
>['origin'];

/**
 * Read one `place-group-copy` payload.
 *
 * The template is read by the one template codec, so a member Scene 13 does not
 * admit, an Artwork, a plane, a non-upright body or an unpinned model refuses
 * here as well as in the planner's own re-read. `supportChoice` belongs to the
 * floor beneath a `support` or `overhead` origin; a `wall` origin carries a
 * frame-local position and no choice.
 */
export function readPlaceGroupCopyPayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'kind',
		'template',
		'name',
		'origin',
		'yaw',
		'frame',
		'frameReference',
		'entityIds',
		'clusterId',
		'contacts',
	]);
	if (record === null) return null;
	const template = readGroupTemplateWithReader(reader, record.template, `${path}.template`);
	const name = reader.string(record.name, `${path}.name`);
	const origin = readGroupCopyOrigin(reader, record.origin, `${path}.origin`);
	const yaw = reader.number(record.yaw, `${path}.yaw`);
	const frame = readFrame(reader, record.frame, `${path}.frame`);
	const frameReference = readFrameReference(
		reader,
		record.frameReference,
		`${path}.frameReference`,
		frame,
	);
	const entityIds = readIds(reader, record.entityIds, `${path}.entityIds`);
	const clusterId = reader.opaqueId(record.clusterId, `${path}.clusterId`);
	const contacts = readGroupCopyContacts(reader, record.contacts, `${path}.contacts`);
	if (
		template === null ||
		name === null ||
		origin === null ||
		yaw === null ||
		frame === null ||
		!frameReference.ok ||
		entityIds === null ||
		clusterId === null ||
		contacts === null
	) {
		return null;
	}
	return {
		kind: 'place-group-copy',
		template,
		name,
		origin,
		yaw,
		frame,
		frameReference: frameReference.value,
		entityIds,
		clusterId,
		contacts,
	};
}

function readGroupTemplateWithReader(
	reader: ShapeReader,
	raw: unknown,
	path: string,
): GroupTemplate | null {
	const parsed = readGroupTemplate(raw);
	if (parsed.success) return parsed.template;
	for (const issue of parsed.issues) {
		reader.problem(`${path}${issue.path.slice(1)}`, issue.code, issue.message);
	}
	return null;
}

function readGroupCopyOrigin(
	reader: ShapeReader,
	raw: unknown,
	path: string,
): GroupCopyOriginPayload | null {
	const record = reader.object(raw, path, ['kind', 'worldXZ', 'position', 'supportChoice']);
	if (record === null) return null;
	const kind = reader.tag(record.kind, `${path}.kind`, ['support', 'overhead', 'wall']);
	if (kind === null) return null;
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (choice === undefined) return null;
	if (kind === 'wall') {
		if (record.worldXZ !== undefined) {
			reader.problem(`${path}.worldXZ`, 'unknown-key', `${path}.worldXZ belongs to a floor origin`);
		}
		if (choice.choice !== undefined) {
			reader.problem(
				`${path}.supportChoice`,
				'unknown-key',
				`${path}.supportChoice belongs to a floor origin`,
			);
		}
		const position = reader.vector3(record.position, `${path}.position`);
		return position === null ? null : { kind: 'wall', position };
	}
	if (record.position !== undefined) {
		reader.problem(`${path}.position`, 'unknown-key', `${path}.position belongs to a wall origin`);
	}
	const worldXZ = readPoint(reader, record.worldXZ, `${path}.worldXZ`);
	if (worldXZ === null) return null;
	return {
		kind: kind as 'support' | 'overhead',
		worldXZ,
		...(choice.choice === undefined ? {} : { choice: choice.choice }),
	};
}

function readGroupCopyContacts(
	reader: ShapeReader,
	input: unknown,
	path: string,
): readonly (number | null)[] | null {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array of member contacts`);
		return null;
	}
	const contacts: (number | null)[] = [];
	for (const [index, value] of input.entries()) {
		if (value === null) {
			contacts.push(null);
			continue;
		}
		const contact = reader.number(value, `${path}[${index}]`);
		if (contact === null) return null;
		contacts.push(contact);
	}
	return contacts;
}

function readRigLight(reader: ShapeReader, raw: unknown, path: string) {
	const record = reader.object(raw, path, [
		'entityId',
		'light',
		'name',
		'color',
		'intensity',
		'castShadow',
		'position',
		'rotation',
		'range',
		'angle',
		'penumbra',
	]);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const light = reader.tag(record.light, `${path}.light`, ['point', 'spot']) as
		| 'point'
		| 'spot'
		| null;
	const name = reader.string(record.name, `${path}.name`);
	const color = reader.string(record.color, `${path}.color`);
	const intensity = reader.number(record.intensity, `${path}.intensity`);
	const castShadow = reader.boolean(record.castShadow, `${path}.castShadow`);
	const position = reader.vector3(record.position, `${path}.position`);
	const rotation = reader.vector3(record.rotation, `${path}.rotation`);
	const range =
		record.range === undefined ? undefined : reader.number(record.range, `${path}.range`);
	const angle =
		record.angle === undefined ? undefined : reader.number(record.angle, `${path}.angle`);
	const penumbra =
		record.penumbra === undefined ? undefined : reader.number(record.penumbra, `${path}.penumbra`);
	if (
		entityId === null ||
		light === null ||
		name === null ||
		color === null ||
		intensity === null ||
		castShadow === null ||
		position === null ||
		rotation === null ||
		(record.range !== undefined && range === null) ||
		(record.angle !== undefined && angle === null) ||
		(record.penumbra !== undefined && penumbra === null)
	) {
		return null;
	}
	return {
		entityId,
		light,
		name,
		color,
		intensity,
		castShadow,
		position: position as Vec3,
		rotation: rotation as Vec3,
		...(range === undefined || range === null ? {} : { range }),
		...(angle === undefined || angle === null ? {} : { angle }),
		...(penumbra === undefined || penumbra === null ? {} : { penumbra }),
	};
}
