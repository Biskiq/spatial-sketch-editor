import { readFormLibraryPayload, type FormLibraryPayload } from '../../library/form-library';
import { type MaterialId, type SceneFormPlane } from '../../scene';
import { readPoint, readSupportChoice } from './readers';
import { type SceneOperationPayload } from './types';
import { ShapeReader } from '../../strict-shape';

export function readCreateFormPayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'plane',
		'outline',
		'extent',
		'position',
		'yaw',
		'materialId',
		'name',
		'supportChoice'
	]);
	if (record === null) return null;
	const plane = reader.tag(record.plane, `${path}.plane`, ['plan', 'elevation']);
	const extent = reader.number(record.extent, `${path}.extent`);
	const position = reader.vector3(record.position, `${path}.position`);
	const yaw = reader.number(record.yaw, `${path}.yaw`);
	const materialId = reader.string(record.materialId, `${path}.materialId`);
	const name = reader.string(record.name, `${path}.name`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	let outline: { u: number; v: number; smooth: boolean }[] | null = null;
	if (!Array.isArray(record.outline)) {
		reader.problem(`${path}.outline`, 'not-an-array', `${path}.outline must be an array`);
	} else {
		const parsed: { u: number; v: number; smooth: boolean }[] = [];
		let valid = true;
		for (const [index, entry] of record.outline.entries()) {
			const anchorPath = `${path}.outline[${index}]`;
			const anchor = reader.object(entry, anchorPath, ['u', 'v', 'smooth']);
			if (anchor === null) {
				valid = false;
				break;
			}
			const u = reader.number(anchor.u, `${anchorPath}.u`);
			const v = reader.number(anchor.v, `${anchorPath}.v`);
			const smooth = reader.boolean(anchor.smooth, `${anchorPath}.smooth`);
			if (u === null || v === null || smooth === null) {
				valid = false;
				break;
			}
			parsed.push({ u, v, smooth });
		}
		if (valid) outline = parsed;
	}
	if (
		plane === null ||
		extent === null ||
		position === null ||
		yaw === null ||
		materialId === null ||
		name === null ||
		choice === undefined ||
		outline === null
	) {
		return null;
	}
	return {
		kind: 'create-form',
		plane: plane as SceneFormPlane,
		outline,
		extent,
		position,
		yaw,
		materialId: materialId as MaterialId,
		name,
		...(choice.choice === undefined ? {} : { choice: choice.choice })
	};
}

export function readPlaceFormCopyPayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'item',
		'worldXZ',
		'yaw',
		'contactMinY',
		'supportChoice'
	]);
	if (record === null) return null;
	const item = readFormLibraryItem(reader, record.item, `${path}.item`);
	const worldXZ = readPoint(reader, record.worldXZ, `${path}.worldXZ`);
	const yaw = reader.number(record.yaw, `${path}.yaw`);
	const contactMinY = reader.number(record.contactMinY, `${path}.contactMinY`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (
		item === null ||
		worldXZ === null ||
		yaw === null ||
		contactMinY === null ||
		choice === undefined
	) {
		return null;
	}
	return {
		kind: 'place-form-copy',
		item,
		worldXZ,
		yaw,
		contactMinY,
		...(choice.choice === undefined ? {} : { choice: choice.choice })
	};
}

/** Reuse the one library payload reader; its `$` paths become payload paths. */
export function readFormLibraryItem(
	reader: ShapeReader,
	raw: unknown,
	path: string
): FormLibraryPayload | null {
	const parsed = readFormLibraryPayload(raw);
	if (parsed.success) return parsed.payload;
	for (const issue of parsed.issues) {
		reader.problem(`${path}${issue.path.slice(1)}`, issue.code, issue.message);
	}
	return null;
}

export function readSetFormSizePayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['entityId', 'scale', 'supportChoice']);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const scale = reader.vector3(record.scale, `${path}.scale`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (scale !== null) {
		for (const [index, value] of scale.entries()) {
			if (value <= 0) {
				reader.problem(`${path}.scale[${index}]`, 'out-of-range', `${path}.scale[${index}] must be greater than zero`);
			}
		}
	}
	if (entityId === null || scale === null || choice === undefined) return null;
	return {
		kind: 'set-form-size',
		entityId,
		scale,
		...(choice.choice === undefined ? {} : { choice: choice.choice })
	};
}

/**
 * The complete replacement outline and extent a profile revision carries.
 *
 * Keys are read as positive safe integers, so a payload cannot smuggle in a
 * fresh or fractional identity; the planner separately proves the captured key
 * sequence is the accepted one. Plane, scale and `nextKey` are deliberately
 * absent: this intent cannot change them.
 */
export function readSetFormProfilePayload(reader: ShapeReader, raw: unknown): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['entityId', 'outline', 'extent', 'supportChoice']);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const extent = reader.number(record.extent, `${path}.extent`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	let outline: { key: number; u: number; v: number; smooth: boolean }[] | null = null;
	if (!Array.isArray(record.outline)) {
		reader.problem(`${path}.outline`, 'not-an-array', `${path}.outline must be an array`);
	} else {
		const parsed: { key: number; u: number; v: number; smooth: boolean }[] = [];
		let valid = true;
		for (const [index, entry] of record.outline.entries()) {
			const anchorPath = `${path}.outline[${index}]`;
			const anchor = reader.object(entry, anchorPath, ['key', 'u', 'v', 'smooth']);
			if (anchor === null) {
				valid = false;
				break;
			}
			const key = reader.integerAtLeast(anchor.key, `${anchorPath}.key`, 1);
			const u = reader.number(anchor.u, `${anchorPath}.u`);
			const v = reader.number(anchor.v, `${anchorPath}.v`);
			const smooth = reader.boolean(anchor.smooth, `${anchorPath}.smooth`);
			if (key === null || u === null || v === null || smooth === null) {
				valid = false;
				break;
			}
			parsed.push({ key, u, v, smooth });
		}
		if (valid) outline = parsed;
	}
	if (entityId === null || outline === null || extent === null || choice === undefined) {
		return null;
	}
	return {
		kind: 'set-form-profile',
		entityId,
		outline,
		extent,
		...(choice.choice === undefined ? {} : { choice: choice.choice })
	};
}
