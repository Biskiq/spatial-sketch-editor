import { type Vec3 } from '../../scene';
import { type SceneOperationPayload } from './types';
import { readFrame, readFrameReference, readPoint } from './readers';
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
	const record = reader.object(raw, path, ['clusterId', 'entityIds', 'newClusterId', 'contacts']);
	if (record === null) return null;
	const clusterId = reader.opaqueId(record.clusterId, `${path}.clusterId`);
	const entityIds = readIds(reader, record.entityIds, `${path}.entityIds`);
	const newClusterId = reader.opaqueId(record.newClusterId, `${path}.newClusterId`);
	const contacts = readContacts(reader, record.contacts, `${path}.contacts`);
	if (clusterId === null || entityIds === null || newClusterId === null || contacts === null) {
		return null;
	}
	return { kind: 'scene-group-duplicate', clusterId, entityIds, newClusterId, contacts };
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
