import { surfaceKey } from '@portfolio/layout-core/plan';
import { SCENE_WORLD_LOCAL_FORMAT_VERSION, type SceneSurfaceFinish, type SceneSurfaceRef } from '../../scene';
import { validateArtworkLibrary, validateSceneDocument } from '../../scene-codec/validate';
import { withSceneValidationOptions } from '../../scene-validation';
import { ShapeReader, type ShapeValidation } from '../../strict-shape';
import { sameSky, SCENE_SKY_DEFAULT } from '../sky-presets';
import { SCENE_PALETTE_MAX_SLOTS, SCENE_SKY_PRESETS, SCENE_TREATMENTS, SCENE_UNIT_FORMAT_VERSION, type SceneEnvironment, type ScenePaletteSlot, type SceneSky, type SceneTreatment, type CameraFreeSceneDocument } from '../types';
import { failed, delegatedIssues } from './shared';

export const PALETTE_NAME_MAX_LENGTH = 40;
export const PALETTE_ID_MAX_LENGTH = 64;
export const SCENE_HEX_COLOR = /^#[0-9a-f]{6}$/;

export function readSceneColor(reader: ShapeReader, input: unknown, path: string): string | null {
	const value = reader.string(input, path);
	if (value === null) return null;
	if (!SCENE_HEX_COLOR.test(value)) {
		reader.problem(path, 'invalid_color', `${path} must be a lowercase #rrggbb colour`);
		return null;
	}
	return value;
}

export function readSky(reader: ShapeReader, input: unknown, path: string): SceneSky | null {
	const firstIssue = reader.issues.length;
	const record = reader.object(input, path, [
		'preset', 'time', 'heading', 'arcHeight', 'haze', 'exposure', 'softness',
		'sunShadows', 'moon', 'skyColor', 'groundColor'
	]);
	if (record === null) return null;

	const preset = SCENE_SKY_PRESETS.find((choice) => choice === record.preset);
	if (preset === undefined) {
		reader.problem(`${path}.preset`, 'invalid_sky_field', `${path}.preset must be one of ${SCENE_SKY_PRESETS.join(', ')}`);
	}
	function number(input: unknown, field: string, min: number, max: number, inclusiveMax = true): number {
		if (typeof input === 'number' && Number.isFinite(input) &&
			input >= min && (inclusiveMax ? input <= max : input < max)) return input;
		reader.problem(`${path}.${field}`, 'invalid_sky_field', `${path}.${field} must be within [${min}, ${max}${inclusiveMax ? ']' : ')'}`);
		return min;
	}
	function color(input: unknown, field: string): string {
		if (typeof input === 'string' && SCENE_HEX_COLOR.test(input)) return input;
		reader.problem(`${path}.${field}`, 'invalid_sky_field', `${path}.${field} must be a lowercase #rrggbb colour`);
		return '';
	}

	const moon = reader.object(record.moon, `${path}.moon`, ['color', 'strength']);
	if (typeof record.sunShadows !== 'boolean') {
		reader.problem(`${path}.sunShadows`, 'invalid_sky_field', `${path}.sunShadows must be a boolean`);
	}
	const sky: SceneSky = {
		preset: preset ?? 'studio',
		time: number(record.time, 'time', 0, 24, false),
		heading: number(record.heading, 'heading', 0, 360, false),
		arcHeight: number(record.arcHeight, 'arcHeight', 20, 80),
		haze: number(record.haze, 'haze', 0, 100),
		exposure: number(record.exposure, 'exposure', -2, 2),
		softness: number(record.softness, 'softness', 0, 1),
		sunShadows: record.sunShadows === true,
		moon: { color: color(moon?.color, 'moon.color'), strength: number(moon?.strength, 'moon.strength', 0, 1) },
		skyColor: color(record.skyColor, 'skyColor'),
		groundColor: color(record.groundColor, 'groundColor')
	};
	return reader.issues.length === firstIssue ? sky : null;
}

export function validateSceneSky(input: unknown, path = '$.environment.sky'): ShapeValidation<SceneSky> {
	const reader = new ShapeReader();
	const value = readSky(reader, input, path);
	return value === null
		? { success: false, issues: reader.issues }
		: { success: true, value, ignoredOptionalExtensions: [] };
}

export function readEnvironment(reader: ShapeReader, input: unknown): SceneEnvironment | undefined {
	const path = '$.environment';
	const record = reader.object(input, path, ['sky', 'treatment']);
	if (record === null) return undefined;
	let sky: SceneSky | undefined;
	if ('sky' in record) {
		const parsed = readSky(reader, record.sky, `${path}.sky`);
		if (parsed !== null && !sameSky(parsed, SCENE_SKY_DEFAULT)) sky = parsed;
	}
	let treatment: SceneTreatment | undefined;
	if ('treatment' in record) {
		const raw = record.treatment;
		if (typeof raw !== 'string' || !(SCENE_TREATMENTS as readonly string[]).includes(raw)) {
			reader.problem(
				`${path}.treatment`,
				'invalid_value',
				`${path}.treatment must be one of ${SCENE_TREATMENTS.join(', ')}`
			);
		} else treatment = raw as SceneTreatment;
	}
	if (sky === undefined && treatment === undefined) return undefined;
	return { ...(sky === undefined ? {} : { sky }), ...(treatment === undefined ? {} : { treatment }) };
}

export function readPalette(reader: ShapeReader, input: unknown): ScenePaletteSlot[] | undefined {
	if (!Array.isArray(input)) {
		reader.problem('$.palette', 'invalid_palette', '$.palette must be an array');
		return undefined;
	}
	// An empty palette is the field's absence; only a real overrun is refused.
	if (input.length === 0) return undefined;
	if (input.length > SCENE_PALETTE_MAX_SLOTS) {
		reader.problem(
			'$.palette',
			'invalid_palette',
			`$.palette holds at most ${SCENE_PALETTE_MAX_SLOTS} slots`
		);
		return undefined;
	}
	const slots: ScenePaletteSlot[] = [];
	const ids = new Set<string>();
	let valid = true;
	for (const [index, entry] of input.entries()) {
		const path = `$.palette[${index}]`;
		const record = reader.object(entry, path, ['id', 'name', 'color']);
		if (record === null) {
			valid = false;
			continue;
		}
		let slotValid = true;
		const id = typeof record.id === 'string' ? record.id : null;
		if (id === null || id.trim() === '' || id.length > PALETTE_ID_MAX_LENGTH) {
			reader.problem(
				`${path}.id`,
				'invalid_value',
				`${path}.id must be a non-empty id of at most ${PALETTE_ID_MAX_LENGTH} characters`
			);
			slotValid = false;
		} else if (ids.has(id)) {
			reader.problem(`${path}.id`, 'duplicate_id', `Duplicate palette slot id: ${id}`);
			slotValid = false;
		} else ids.add(id);
		const name = typeof record.name === 'string' ? record.name.trim() : '';
		if (name === '' || name.length > PALETTE_NAME_MAX_LENGTH) {
			reader.problem(
				`${path}.name`,
				'invalid_value',
				`${path}.name must be a non-empty name of at most ${PALETTE_NAME_MAX_LENGTH} characters`
			);
			slotValid = false;
		}
		const color = readSceneColor(reader, record.color, `${path}.color`);
		if (color === null) slotValid = false;
		if (!slotValid || id === null) {
			valid = false;
			continue;
		}
		slots.push({ id, name, color: color! });
	}
	return valid ? slots : undefined;
}

export function readSurfaceFinishes(
	reader: ShapeReader,
	input: unknown,
	materials: CameraFreeSceneDocument['materials']
): SceneSurfaceFinish[] | undefined {
	if (input === undefined) return undefined;
	if (!Array.isArray(input)) {
		reader.problem('$.surfaceFinishes', 'invalid_type', '$.surfaceFinishes must be an array');
		return undefined;
	}
	if (input.length === 0) {
		reader.problem('$.surfaceFinishes', 'surface_finish_not_normal', 'An empty surfaceFinishes field must be omitted');
		return undefined;
	}
	const assignments: SceneSurfaceFinish[] = [];
	const seen = new Set<string>();
	let previousKey: string | null = null;
	for (const [index, raw] of input.entries()) {
		const path = `$.surfaceFinishes[${index}]`;
		const assignment = reader.object(raw, path, ['surface', 'finish']);
		if (assignment === null) continue;
		if (typeof assignment.surface !== 'object' || assignment.surface === null || Array.isArray(assignment.surface)) {
			reader.problem(`${path}.surface`, 'invalid_type', `${path}.surface must be a tagged Layout surface reference`);
			continue;
		}
		const rawSurface = assignment.surface as Record<string, unknown>;
		const kind = rawSurface.kind;
		if (kind !== 'wall-side' && kind !== 'room-floor' && kind !== 'room-lid' && kind !== 'region-face') {
			reader.problem(`${path}.surface.kind`, 'unknown_surface_kind', `${path}.surface.kind is not admitted by Scene 12`);
			continue;
		}
		const surfaceRecord = reader.object(
			rawSurface,
			`${path}.surface`,
			kind === 'wall-side' ? ['kind', 'wallId', 'side']
				: kind === 'region-face' ? ['kind', 'regionId', 'face']
					: ['kind', 'roomId']
		);
		if (surfaceRecord === null) continue;
		let surface: SceneSurfaceRef | null = null;
		if (kind === 'wall-side') {
			const wallId = reader.opaqueId(surfaceRecord.wallId, `${path}.surface.wallId`);
			const side = reader.tag(surfaceRecord.side, `${path}.surface.side`, ['left', 'right']);
			if (wallId !== null && side !== null) surface = { kind, wallId, side: side as 'left' | 'right' };
		} else if (kind === 'region-face') {
			const regionId = reader.opaqueId(surfaceRecord.regionId, `${path}.surface.regionId`);
			const rawFace = surfaceRecord.face;
			const face = rawFace === 'top' || rawFace === 'underside' ? rawFace : null;
			if (face === null) {
				reader.problem(`${path}.surface.face`, 'unknown_surface_face', `${path}.surface.face must be 'top' or 'underside'; a region edge has no Finish`);
			}
			if (regionId !== null && face !== null) surface = { kind, regionId, face };
		} else {
			const roomId = reader.opaqueId(surfaceRecord.roomId, `${path}.surface.roomId`);
			if (roomId !== null) surface = { kind, roomId };
		}
		const finishRecord = reader.object(assignment.finish, `${path}.finish`, ['materialId', 'materialInstanceId']);
		if (finishRecord === null) continue;
		const finishKeys = Object.keys(finishRecord);
		let finish: SceneSurfaceFinish['finish'] | null = null;
		if (finishKeys.length !== 1) {
			reader.problem(`${path}.finish`, 'surface_finish_not_normal', `${path}.finish must name exactly one catalogue or project Finish`);
		} else if ('materialId' in finishRecord) {
			const materialId = reader.opaqueId(finishRecord.materialId, `${path}.finish.materialId`);
			if (materialId !== null && !withSceneValidationOptions().isKnownMaterialId(materialId)) {
				reader.problem(`${path}.finish.materialId`, 'missing_reference', `Unknown catalogue Finish "${materialId}"`);
			} else if (materialId !== null) finish = { materialId: materialId as import('../../scene').MaterialId };
		} else if ('materialInstanceId' in finishRecord) {
			const materialInstanceId = reader.opaqueId(finishRecord.materialInstanceId, `${path}.finish.materialInstanceId`);
			const instance = materialInstanceId === null ? undefined : materials.find((material) => material.id === materialInstanceId);
			if (materialInstanceId !== null && instance === undefined) {
				reader.problem(`${path}.finish.materialInstanceId`, 'missing_reference', `Unknown project Finish "${materialInstanceId}"`);
			} else if (materialInstanceId !== null && instance !== undefined) {
				const keys = Object.keys(instance).sort();
				const pristine =
					keys.length === 3 &&
					keys[0] === 'base' &&
					keys[1] === 'id' &&
					keys[2] === 'name' &&
					'catalogue' in (instance as { base?: { catalogue?: unknown } }).base!;
				if (pristine) {
					reader.problem(`${path}.finish.materialInstanceId`, 'surface_finish_not_normal', 'A project surface Finish must reference a non-pristine material instance');
				} else finish = { materialInstanceId };
			}
		}
		if (surface === null || finish === null) continue;
		const key = surfaceKey(surface);
		if (seen.has(key)) {
			reader.problem(`${path}.surface`, 'duplicate_surface_finish', `Surface "${key}" has more than one Finish assignment`);
			continue;
		}
		seen.add(key);
		if (previousKey !== null && key < previousKey) {
			reader.problem('$.surfaceFinishes', 'surface_finish_not_normal', 'Surface Finish records must be sorted by surface identity');
		}
		previousKey = key;
		assignments.push({ surface, finish });
	}
	return assignments;
}

/**
 * Strict read of the Camera-free Scene payload. Its shared entity grammar
 * uses the internal world-local projection with an empty Camera graph.
 * Artwork Library closure is checked only on the authored Scene unit.
 *
 * New Scene 8 defaults are dropped here, so the normalized value is what the
 * canonical bytes and the content revision hash.
 */
export function validateCameraFreeScenePayload(input: unknown): ShapeValidation<CameraFreeSceneDocument> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', ['formatVersion', 'textures', 'materials', 'entities', 'palette', 'clusters', 'environment', 'artworkLibrary', 'surfaceFinishes']);
	if (record === null) return failed(reader);
	if (record.formatVersion !== SCENE_UNIT_FORMAT_VERSION) {
		reader.problem(
			'$.formatVersion',
			'unsupported_format_version',
			`$.formatVersion must be ${SCENE_UNIT_FORMAT_VERSION} for the Scene unit`
		);
		return failed(reader);
	}
	const palette = record.palette === undefined ? undefined : readPalette(reader, record.palette);
	const environment =
		record.environment === undefined ? undefined : readEnvironment(reader, record.environment);
	if (reader.issues.length > 0) return failed(reader);
	const delegated = validateSceneDocument({
		formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION,
		textures: record.textures,
		materials: record.materials,
		entities: record.entities,
		...(record.clusters === undefined ? {} : { clusters: record.clusters }),
		navigationNodes: [],
		connections: []
	});
	if (!delegated.success) return { success: false, issues: delegatedIssues(delegated.issues) };
	const document = delegated.document;
	const surfaceFinishes = readSurfaceFinishes(reader, record.surfaceFinishes, document.materials);
	// The follower check is the unit validator's because only this reader holds
	// the palette; the Scene codec never sees it.
	const paletteIds = new Set((palette ?? []).map((slot) => slot.id));
	for (const [index, material] of document.materials.entries()) {
		const color = material.overrides?.color;
		if (color === undefined || typeof color === 'string') continue;
		if (!paletteIds.has(color.slot)) {
			reader.problem(
				`$.materials[${index}].overrides.color.slot`,
				'unknown_palette_slot',
				`Unknown palette slot: ${color.slot}`
			);
		}
	}
	if (reader.issues.length > 0) return failed(reader);
	const { library, issues } = validateArtworkLibrary(record.artworkLibrary, document.entities);
	if (issues.length > 0) return { success: false, issues: delegatedIssues(issues) };
	return {
		success: true,
		value: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: document.textures,
			materials: document.materials,
			entities: document.entities,
			...(surfaceFinishes === undefined ? {} : { surfaceFinishes }),
			...(library.length === 0 ? {} : { artworkLibrary: library }),
			...(palette === undefined ? {} : { palette }),
			...(document.clusters === undefined ? {} : { clusters: document.clusters }),
			...(environment === undefined ? {} : { environment })
		},
		ignoredOptionalExtensions: []
	};
}
