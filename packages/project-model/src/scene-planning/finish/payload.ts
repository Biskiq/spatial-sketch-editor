/** Strict payload readers for Finish and palette intents. */

import { type MaterialId, type SceneColor } from '../../scene';
import { type SceneFinishEdit, type SceneFinishRef } from './model';
import { MATERIAL_ID, HEX_COLOR } from './shared';
import { type FinishTexturePin } from '../texture-resource';
import { ShapeReader } from '../../strict-shape';

export function readColor(
	reader: ShapeReader,
	raw: unknown,
	path: string
): { readonly ok: true; readonly value: SceneColor } | { readonly ok: false } {
	if (typeof raw === 'string') {
		if (!HEX_COLOR.test(raw)) {
			reader.problem(path, 'invalid-color', `${path} must be a lowercase #rrggbb colour`);
			return { ok: false };
		}
		return { ok: true, value: raw };
	}
	const record = reader.object(raw, path, ['slot']);
	const slot = record === null ? null : reader.opaqueId(record.slot, `${path}.slot`);
	if (slot === null) return { ok: false };
	return { ok: true, value: { slot } };
}

export type AdoptionMappingEntry = {
	readonly color: string;
	readonly slotId: string;
	readonly slotColor: string;
};

export function readAdoptionMapping(
	reader: ShapeReader,
	raw: unknown
): AdoptionMappingEntry[] | null {
	if (!Array.isArray(raw)) {
		reader.problem('$.payload.mapping', 'invalid-value', '$.payload.mapping must be a list');
		return null;
	}
	const entries: AdoptionMappingEntry[] = [];
	for (const [index, item] of raw.entries()) {
		const path = `$.payload.mapping[${index}]`;
		const record = reader.object(item, path, ['color', 'slotId', 'slotColor']);
		if (record === null) return null;
		const color = reader.string(record.color, `${path}.color`);
		const slotId = reader.opaqueId(record.slotId, `${path}.slotId`);
		const slotColor = reader.string(record.slotColor, `${path}.slotColor`);
		if (color === null || slotId === null || slotColor === null) return null;
		if (!HEX_COLOR.test(color) || !HEX_COLOR.test(slotColor)) {
			reader.problem(path, 'invalid-color', `${path} must name lowercase #rrggbb colours`);
			return null;
		}
		entries.push({ color, slotId, slotColor });
	}
	return entries;
}

export function readFinishRef(reader: ShapeReader, raw: unknown, path: string): SceneFinishRef | null {
	if (raw === 'model-own') return 'model-own';
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		reader.problem(path, 'invalid-value', `${path} must name a curated Finish, a project Finish or Model's own`);
		return null;
	}
	// Discriminate on the key before reading: reading both shapes would report the
	// other shape's key as unknown.
	if ('project' in raw) {
		const project = reader.object(raw, path, ['project']);
		const id = project === null ? null : reader.opaqueId(project.project, `${path}.project`);
		return id === null ? null : { project: id };
	}
	const curated = reader.object(raw, path, ['curated']);
	if (curated === null) return null;
	const materialId = reader.string(curated.curated, `${path}.curated`);
	if (materialId === null || !MATERIAL_ID.test(materialId)) {
		if (materialId !== null) {
			reader.problem(`${path}.curated`, 'unknown-catalogue', `${path}.curated must name a curated Finish`);
		}
		return null;
	}
	return { curated: materialId as MaterialId };
}

export const TILE_MIN_METERS = 0.01;
export const TILE_MAX_METERS = 100;
export const TWO_PI = Math.PI * 2;
export const FINISH_NAME_MAX_LENGTH = 120;

/** Normalise radians into the Scene format's [0, 2π) domain. */
export function normalizeRotation(value: number): number {
	const wrapped = value % TWO_PI;
	return wrapped < 0 ? wrapped + TWO_PI : wrapped;
}

export function readFinishEdit(reader: ShapeReader, raw: unknown, path: string): SceneFinishEdit | null {
	const record = reader.object(raw, path, [
		'color',
		'roughness',
		'metalness',
		'colorMap',
		'tileMeters',
		'rotation'
	]);
	if (record === null) return null;
	const edit: {
		color?: SceneColor | null;
		roughness?: number | null;
		metalness?: 0 | 1 | null;
		colorMap?: string | null;
		tileMeters?: readonly [number, number] | null;
		rotation?: number | null;
	} = {};
	if ('color' in record) {
		if (record.color === null) edit.color = null;
		else {
			const parsed = readColor(reader, record.color, `${path}.color`);
			if (!parsed.ok) return null;
			edit.color = parsed.value;
		}
	}
	for (const key of ['roughness', 'metalness'] as const) {
		if (!(key in record)) continue;
		if (record[key] === null) {
			edit[key] = null;
			continue;
		}
		const value = reader.number(record[key], `${path}.${key}`);
		if (value === null) return null;
		if (key === 'roughness') {
			if (value < 0 || value > 1) {
				reader.problem(`${path}.roughness`, 'invalid-value', `${path}.roughness must be within [0, 1]`);
				return null;
			}
			edit.roughness = value;
		} else {
			if (value !== 0 && value !== 1) {
				reader.problem(`${path}.metalness`, 'invalid-value', `${path}.metalness must be 0 or 1`);
				return null;
			}
			edit.metalness = value;
		}
	}
	if ('colorMap' in record) {
		if (record.colorMap === null) edit.colorMap = null;
		else {
			const textureId = reader.opaqueId(record.colorMap, `${path}.colorMap`);
			if (textureId === null) return null;
			edit.colorMap = textureId;
		}
	}
	if ('tileMeters' in record) {
		if (record.tileMeters === null) edit.tileMeters = null;
		else {
			if (!Array.isArray(record.tileMeters) || record.tileMeters.length !== 2) {
				reader.problem(`${path}.tileMeters`, 'invalid-value', `${path}.tileMeters must be a [width, height] pair`);
				return null;
			}
			const width = reader.number(record.tileMeters[0], `${path}.tileMeters[0]`);
			const height = reader.number(record.tileMeters[1], `${path}.tileMeters[1]`);
			if (width === null || height === null) return null;
			if (
				width < TILE_MIN_METERS || width > TILE_MAX_METERS ||
				height < TILE_MIN_METERS || height > TILE_MAX_METERS
			) {
				reader.problem(
					`${path}.tileMeters`,
					'invalid-value',
					`${path}.tileMeters must be within [${TILE_MIN_METERS}, ${TILE_MAX_METERS}] m`
				);
				return null;
			}
			edit.tileMeters = [width, height];
		}
	}
	if ('rotation' in record) {
		if (record.rotation === null) edit.rotation = null;
		else {
			const value = reader.number(record.rotation, `${path}.rotation`);
			if (value === null) return null;
			if (!Number.isFinite(value)) {
				reader.problem(`${path}.rotation`, 'invalid-value', `${path}.rotation must be finite`);
				return null;
			}
			edit.rotation = normalizeRotation(value);
		}
	}
	if (
		!('color' in edit) && !('roughness' in edit) && !('metalness' in edit) &&
		!('colorMap' in edit) && !('tileMeters' in edit) && !('rotation' in edit)
	) {
		reader.problem(path, 'invalid-value', `${path} must change at least one Finish value`);
		return null;
	}
	return edit;
}

export function readTexturePin(reader: ShapeReader, raw: unknown, path: string): FinishTexturePin | null {
	const record = reader.object(raw, path, ['hash', 'mime', 'size', 'locator']);
	if (record === null) return null;
	const hash = reader.string(record.hash, `${path}.hash`);
	const mime = reader.string(record.mime, `${path}.mime`);
	const size = reader.integerAtLeast(record.size, `${path}.size`, 1);
	const locator = reader.string(record.locator, `${path}.locator`);
	if (hash === null || mime === null || size === null || locator === null) return null;
	return { hash, mime, size, locator };
}

export function readEntityIdList(
	reader: ShapeReader,
	raw: unknown,
	path: string,
	allowEmpty: boolean
): string[] | null {
	if (!Array.isArray(raw) || (!allowEmpty && raw.length === 0)) {
		reader.problem(path, 'invalid-value', `${path} must be ${allowEmpty ? 'an' : 'a non-empty'} array of Scene entity ids`);
		return null;
	}
	const ids: string[] = [];
	for (const [index, entry] of raw.entries()) {
		const id = reader.opaqueId(entry, `${path}[${index}]`);
		if (id === null) return null;
		if (ids.includes(id)) {
			reader.problem(`${path}[${index}]`, 'duplicate-id', `${path} must not repeat an entity id`);
			return null;
		}
		ids.push(id);
	}
	return ids;
}

export function readMaterialIdList(reader: ShapeReader, raw: unknown, path: string): string[] | null {
	if (!Array.isArray(raw) || raw.length === 0) {
		reader.problem(path, 'invalid-value', `${path} must be a non-empty array of Scene entity ids`);
		return null;
	}
	const ids: string[] = [];
	for (const [index, entry] of raw.entries()) {
		const id = reader.opaqueId(entry, `${path}[${index}]`);
		if (id === null) return null;
		if (ids.includes(id)) {
			reader.problem(`${path}[${index}]`, 'duplicate-id', `${path} must not repeat an entity id`);
			return null;
		}
		ids.push(id);
	}
	return ids;
}

export const TARGET_SUBJECT_MAX_LENGTH = 200;

export function readIndexPair(reader: ShapeReader, raw: unknown, path: string): (0 | 1)[] | null {
	if (!Array.isArray(raw) || raw.length > 2) {
		reader.problem(path, 'invalid-value', `${path} must hold at most the two native UV sets`);
		return null;
	}
	const sets: (0 | 1)[] = [];
	for (const [index, value] of raw.entries()) {
		if (value !== 0 && value !== 1) {
			reader.problem(`${path}[${index}]`, 'invalid-value', `${path} may name only UV set 0 or 1`);
			return null;
		}
		if (sets.includes(value)) {
			reader.problem(`${path}[${index}]`, 'duplicate-id', `${path} must not repeat a UV set`);
			return null;
		}
		sets.push(value);
	}
	return sets;
}

export function readMetrePair(reader: ShapeReader, raw: unknown, path: string): readonly [number, number] | null {
	if (!Array.isArray(raw) || raw.length !== 2) {
		reader.problem(path, 'invalid-value', `${path} must be a [u, v] pair in metres`);
		return null;
	}
	const u = reader.number(raw[0], `${path}[0]`);
	const v = reader.number(raw[1], `${path}[1]`);
	if (u === null || v === null) return null;
	if (u <= 0 || v <= 0) {
		reader.problem(path, 'invalid-value', `${path} must be greater than zero`);
		return null;
	}
	return [u, v];
}
