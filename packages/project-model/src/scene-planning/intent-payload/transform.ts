import { readPoint, readFrame, readFrameReference, readSupportChoice } from './readers';
import { type SceneOperationPayload } from './types';
import { ShapeReader } from '../../strict-shape';

export function readSupportMovePayload(
	reader: ShapeReader,
	raw: unknown,
	kind: 'move-horizontal',
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'entityId',
		'worldXZ',
		'frame',
		'frameReference',
		'contactMinY',
		'supportChoice',
	]);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const worldXZ = readPoint(reader, record.worldXZ, `${path}.worldXZ`);
	const frame = readFrame(reader, record.frame, `${path}.frame`);
	const frameReference = readFrameReference(
		reader,
		record.frameReference,
		`${path}.frameReference`,
		frame,
	);
	const contactMinY = reader.number(record.contactMinY, `${path}.contactMinY`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (
		entityId === null ||
		worldXZ === null ||
		frame === null ||
		!frameReference.ok ||
		contactMinY === null ||
		choice === undefined
	) {
		return null;
	}
	return {
		kind,
		entityId,
		worldXZ,
		frame,
		frameReference: frameReference.value,
		contactMinY,
		...(choice.choice === undefined ? {} : { choice: choice.choice }),
	};
}

export function readSetYawPayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['entityId', 'yaw', 'frame', 'frameReference']);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const yaw = reader.number(record.yaw, `${path}.yaw`);
	const frame = readFrame(reader, record.frame, `${path}.frame`);
	const frameReference = readFrameReference(
		reader,
		record.frameReference,
		`${path}.frameReference`,
		frame,
	);
	if (entityId === null || yaw === null || frame === null || !frameReference.ok) return null;
	return { kind: 'set-yaw', entityId, yaw, frame, frameReference: frameReference.value };
}

export function readPlaceOnFloorPayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'entityId',
		'worldXZ',
		'frame',
		'frameReference',
		'contactMinY',
		'yaw',
		'supportChoice',
	]);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const worldXZ = readPoint(reader, record.worldXZ, `${path}.worldXZ`);
	const frame = readFrame(reader, record.frame, `${path}.frame`);
	const frameReference = readFrameReference(
		reader,
		record.frameReference,
		`${path}.frameReference`,
		frame,
	);
	const contactMinY = reader.number(record.contactMinY, `${path}.contactMinY`);
	const yaw = record.yaw === undefined ? undefined : reader.number(record.yaw, `${path}.yaw`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (
		entityId === null ||
		worldXZ === null ||
		frame === null ||
		!frameReference.ok ||
		contactMinY === null ||
		yaw === null ||
		choice === undefined
	) {
		return null;
	}
	return {
		kind: 'place-on-floor',
		entityId,
		worldXZ,
		frame,
		frameReference: frameReference.value,
		contactMinY,
		...(yaw === undefined ? {} : { yaw }),
		...(choice.choice === undefined ? {} : { choice: choice.choice }),
	};
}

export function readResizePayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['entityId', 'scale', 'contactMinY', 'supportChoice']);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const scale = reader.numberAtLeast(record.scale, `${path}.scale`, 0, true);
	const contactMinY = reader.number(record.contactMinY, `${path}.contactMinY`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (entityId === null || scale === null || contactMinY === null || choice === undefined)
		return null;
	return {
		kind: 'resize-on-floor',
		entityId,
		scale,
		contactMinY,
		...(choice.choice === undefined ? {} : { choice: choice.choice }),
	};
}

export function readSetLiftPayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['entityId', 'lift', 'contactMinY', 'supportChoice']);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const lift = reader.number(record.lift, `${path}.lift`);
	const contactMinY = reader.number(record.contactMinY, `${path}.contactMinY`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (entityId === null || lift === null || contactMinY === null || choice === undefined)
		return null;
	return {
		kind: 'set-lift',
		entityId,
		lift,
		contactMinY,
		...(choice.choice === undefined ? {} : { choice: choice.choice }),
	};
}
