/**
 * `scene-codec/parse-entities.ts` — entity/resource parsers + cluster shape
 * mapping.
 *
 * Hosts the entity-related `parse*` functions (`parseTextureAsset`,
 * `parseMaterialInstance`, `parseEntityTransform`, `parseModelEntity`,
 * `parsePrimitiveEntity`, `parseLightEntity`, `parseEntity`, `parseCluster`)
 * plus the shared `readPositiveDimension` / `parsePrimitiveDimensions`
 * helpers. Reads all icon/reader helpers from `./readers`.
 *
 * Tagged `@internal` — never imported outside `scene-codec/`; consumers walk
 * documents through `validateSceneDocument` or `parseSceneDocumentJson`.
 */
import { PROFILE_LIMITS, validateProfile } from '@portfolio/geometry-core';
import type {
	SceneBoxDimensions,
	SceneCylinderDimensions,
	SceneEntity,
	SceneFormAnchor,
	SceneFormEntity,
	SceneFormPlane,
	SceneFormSource,
	SceneLightEntity,
	SceneLightKind,
	MaterialId,
	SceneModelEntity,
	SceneMaterialInstance,
	SceneObjectCluster,
	ScenePlaneDimensions,
	ScenePrimitiveEntity,
	ScenePrimitiveKind,
	SceneSphereDimensions,
	SceneTextureAsset,
	Vec3
} from '../scene';
import type { ResolvedSceneValidationOptions } from '../scene-validation';
import type { SceneDocumentIssue } from './index';
import type { JsonRecord } from './readers';
import {
	HEX_COLOR_PATTERN,
	SCENE_LIGHT_KINDS,
	SCENE_PRIMITIVE_KINDS,
	addIssue,
	assertAllowedKeys,
	isRecord,
	readOptionalString,
	readRequiredBoolean,
	readRequiredNumber,
	readRequiredString,
	rejectRoomId,
	readStringArray,
	readUnitInterval,
	readVec3
} from './readers';

type EntityParserOptions = {
	allowMaterialInstance: boolean;
} & ResolvedSceneValidationOptions;

export function parseTextureAsset(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[],
	validation: ResolvedSceneValidationOptions
): SceneTextureAsset | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a texture asset object');
		return undefined;
	}
	assertAllowedKeys(input, ['id', 'name', 'uri'], path, issues);
	const id = readRequiredString(input, 'id', path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	const uri = readRequiredString(input, 'uri', path, issues);
	const safeUri = uri !== undefined && validation.isSafeTextureUri(uri);
	if (uri && !safeUri) {
		addIssue(
			issues,
			`${path}.uri`,
			'unsafe_texture_uri',
			'Texture URI must be a safe root-relative public path'
		);
	}
	if (!id || !name || !uri || !safeUri) return undefined;
	return { id, name, uri };
}

export function parseMaterialInstance(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[],
	validation: ResolvedSceneValidationOptions
): SceneMaterialInstance | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a material instance object');
		return undefined;
	}
	assertAllowedKeys(
		input,
		['id', 'name', 'baseMaterialId', 'baseTextureId', 'roughness', 'metalness'],
		path,
		issues
	);
	const id = readRequiredString(input, 'id', path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	const baseMaterialIdRaw = readRequiredString(input, 'baseMaterialId', path, issues);
	const baseMaterialId =
		baseMaterialIdRaw && validation.isKnownMaterialId(baseMaterialIdRaw)
			? (baseMaterialIdRaw as MaterialId)
			: undefined;
	if (baseMaterialIdRaw && !baseMaterialId) {
		addIssue(
			issues,
			`${path}.baseMaterialId`,
			'unknown_material',
			`Unknown material: ${baseMaterialIdRaw}`
		);
	}
	const baseTextureId = readOptionalString(input, 'baseTextureId', path, issues);
	const roughness = readUnitInterval(input, 'roughness', path, issues);
	const metalness = readUnitInterval(input, 'metalness', path, issues);
	if (
		!id ||
		!name ||
		!baseMaterialId ||
		('baseTextureId' in input && !baseTextureId) ||
		('roughness' in input && roughness === undefined) ||
		('metalness' in input && metalness === undefined)
	) {
		return undefined;
	}
	return {
		id,
		name,
		baseMaterialId,
		...(baseTextureId === undefined ? {} : { baseTextureId }),
		...(roughness === undefined ? {} : { roughness }),
		...(metalness === undefined ? {} : { metalness })
	};
}
export function readPositiveDimension(
	value: JsonRecord,
	key: string,
	path: string,
	issues: SceneDocumentIssue[]
): number | undefined {
	const number = readRequiredNumber(value, key, path, issues);
	if (number === undefined) return undefined;
	if (!Number.isFinite(number) || number <= 0) {
		addIssue(issues, `${path}.${key}`, 'invalid_dimension', `${key} must be a finite number greater than zero`);
		return undefined;
	}
	return number;
}

export function parsePrimitiveDimensions(
	primitive: ScenePrimitiveKind,
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[]
): ScenePrimitiveEntity['dimensions'] | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a dimensions object');
		return undefined;
	}
	if (primitive === 'box') {
		assertAllowedKeys(input, ['width', 'height', 'depth'], path, issues);
		const width = readPositiveDimension(input, 'width', path, issues);
		const height = readPositiveDimension(input, 'height', path, issues);
		const depth = readPositiveDimension(input, 'depth', path, issues);
		if (width === undefined || height === undefined || depth === undefined) return undefined;
		return { width, height, depth } satisfies SceneBoxDimensions;
	}
	if (primitive === 'plane') {
		assertAllowedKeys(input, ['width', 'height'], path, issues);
		const width = readPositiveDimension(input, 'width', path, issues);
		const height = readPositiveDimension(input, 'height', path, issues);
		if (width === undefined || height === undefined) return undefined;
		return { width, height } satisfies ScenePlaneDimensions;
	}
	if (primitive === 'cylinder') {
		assertAllowedKeys(input, ['radius', 'height'], path, issues);
		const radius = readPositiveDimension(input, 'radius', path, issues);
		const height = readPositiveDimension(input, 'height', path, issues);
		if (radius === undefined || height === undefined) return undefined;
		return { radius, height } satisfies SceneCylinderDimensions;
	}
	assertAllowedKeys(input, ['radius'], path, issues);
	const radius = readPositiveDimension(input, 'radius', path, issues);
	if (radius === undefined) return undefined;
	return { radius } satisfies SceneSphereDimensions;
}

export function parseEntityTransform(
	input: JsonRecord,
	path: string,
	issues: SceneDocumentIssue[]
): { position: Vec3; rotation: Vec3; scale?: number } | undefined {
	const position = readVec3(input.position, `${path}.position`, issues);
	const rotation = readVec3(input.rotation, `${path}.rotation`, issues);
	let scale: number | undefined;
	if ('scale' in input) {
		scale = readRequiredNumber(input, 'scale', path, issues);
		if (scale !== undefined && scale <= 0) {
			addIssue(issues, `${path}.scale`, 'invalid_scale', 'Scale must be greater than zero');
			scale = undefined;
		}
	}
	if (!position || !rotation || ('scale' in input && scale === undefined)) return undefined;
	return { position, rotation, ...(scale === undefined ? {} : { scale }) };
}

export function parseModelEntity(
	input: JsonRecord,
	path: string,
	issues: SceneDocumentIssue[],
	options: EntityParserOptions
): SceneModelEntity | undefined {
	rejectRoomId(input, 'roomId', path, issues);
	assertAllowedKeys(
		input,
		[
			'kind',
			'id',
			'name',
			'roomId',
			'assetId',
			'fallback',
			'position',
			'rotation',
			'scale',
			...(options.allowMaterialInstance ? ['materialInstanceId'] : [])
		],
		path,
		issues
	);
	const id = readRequiredString(input, 'id', path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	const assetId = readRequiredString(input, 'assetId', path, issues);
	if (assetId && !options.isKnownAssetId(assetId)) {
		addIssue(issues, `${path}.assetId`, 'unknown_asset', `Unknown asset: ${assetId}`);
	}
	const fallback = readRequiredString(input, 'fallback', path, issues);
	if (fallback && !options.isSceneObjectFallback(fallback)) {
		addIssue(issues, `${path}.fallback`, 'invalid_fallback', `Invalid fallback: ${fallback}`);
	}
	const materialInstanceId = options.allowMaterialInstance
		? readOptionalString(input, 'materialInstanceId', path, issues)
		: undefined;
	const transform = parseEntityTransform(input, path, issues);
	if (
		!id ||
		!name ||
		!assetId ||
		!fallback ||
		!transform ||
		(options.allowMaterialInstance && 'materialInstanceId' in input && !materialInstanceId)
	) {
		return undefined;
	}
	return {
		kind: 'model',
		id,
		name,
		assetId,
		fallback: fallback as SceneModelEntity['fallback'],
		...transform,
		...(materialInstanceId === undefined ? {} : { materialInstanceId }),
	};
}

export function parsePrimitiveEntity(
	input: JsonRecord,
	path: string,
	issues: SceneDocumentIssue[],
	options: EntityParserOptions
): ScenePrimitiveEntity | undefined {
	assertAllowedKeys(
		input,
		[
			'kind',
			'id',
			'name',
			'roomId',
			'primitive',
			'dimensions',
			'materialId',
			'castShadow',
			'receiveShadow',
			'position',
			'rotation',
			'scale',
			...(options.allowMaterialInstance ? ['materialInstanceId'] : [])
		],
		path,
		issues
	);
	rejectRoomId(input, 'roomId', path, issues);
	const id = readRequiredString(input, 'id', path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	const primitiveRaw = readRequiredString(input, 'primitive', path, issues);
	const primitive =
		primitiveRaw && (SCENE_PRIMITIVE_KINDS as readonly string[]).includes(primitiveRaw)
			? (primitiveRaw as ScenePrimitiveKind)
			: undefined;
	if (primitiveRaw && !primitive) {
		addIssue(issues, `${path}.primitive`, 'invalid_primitive', `Invalid primitive kind: ${primitiveRaw}`);
	}
	const dimensions =
		primitive === undefined
			? undefined
			: parsePrimitiveDimensions(primitive, input.dimensions, `${path}.dimensions`, issues);
	const materialIdRaw = readRequiredString(input, 'materialId', path, issues);
	const materialId =
		materialIdRaw && options.isKnownMaterialId(materialIdRaw)
			? (materialIdRaw as ScenePrimitiveEntity['materialId'])
			: undefined;
	if (materialIdRaw && !materialId) {
		addIssue(issues, `${path}.materialId`, 'unknown_material', `Unknown material: ${materialIdRaw}`);
	}
	const castShadow = readRequiredBoolean(input, 'castShadow', path, issues);
	const receiveShadow = readRequiredBoolean(input, 'receiveShadow', path, issues);
	const materialInstanceId = options.allowMaterialInstance
		? readOptionalString(input, 'materialInstanceId', path, issues)
		: undefined;
	const transform = parseEntityTransform(input, path, issues);
	if (
		!id ||
		!name ||
		!primitive ||
		!dimensions ||
		!materialId ||
		castShadow === undefined ||
		receiveShadow === undefined ||
		!transform ||
		(options.allowMaterialInstance && 'materialInstanceId' in input && !materialInstanceId)
	) {
		return undefined;
	}
	return {
		kind: 'primitive',
		id,
		name,
		primitive,
		dimensions,
		materialId,
		castShadow,
		receiveShadow,
		...transform,
		...(materialInstanceId === undefined ? {} : { materialInstanceId }),
	} as ScenePrimitiveEntity;
}

function parseFormAnchor(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[]
): SceneFormAnchor | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected an outline anchor object');
		return undefined;
	}
	assertAllowedKeys(input, ['key', 'u', 'v', 'smooth'], path, issues);
	const key = readRequiredNumber(input, 'key', path, issues);
	if (key !== undefined && (!Number.isSafeInteger(key) || key <= 0)) {
		addIssue(issues, `${path}.key`, 'invalid_key', 'An outline anchor key must be a positive safe integer');
	}
	const u = readRequiredNumber(input, 'u', path, issues);
	const v = readRequiredNumber(input, 'v', path, issues);
	const smooth = readRequiredBoolean(input, 'smooth', path, issues);
	if (key === undefined || u === undefined || v === undefined || smooth === undefined) {
		return undefined;
	}
	return { key, u, v, smooth };
}

function parseFormSource(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[]
): SceneFormSource | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a form source object');
		return undefined;
	}
	assertAllowedKeys(input, ['generator', 'scale', 'nextKey'], path, issues);
	const generatorPath = `${path}.generator`;
	if (!isRecord(input.generator)) {
		addIssue(issues, generatorPath, 'invalid_type', 'Expected a form generator object');
		return undefined;
	}
	assertAllowedKeys(input.generator, ['kind', 'plane', 'outline', 'extent'], generatorPath, issues);
	const kind = readRequiredString(input.generator, 'kind', generatorPath, issues);
	if (kind !== undefined && kind !== 'extrude') {
		addIssue(issues, `${generatorPath}.kind`, 'unsupported_generator', `Unsupported form generator kind: ${kind}`);
	}
	const planeRaw = readRequiredString(input.generator, 'plane', generatorPath, issues);
	const plane: SceneFormPlane | undefined =
		planeRaw === 'plan' || planeRaw === 'elevation' ? planeRaw : undefined;
	if (planeRaw !== undefined && plane === undefined) {
		addIssue(issues, `${generatorPath}.plane`, 'unsupported_plane', `Unsupported form plane: ${planeRaw}`);
	}
	const outlinePath = `${generatorPath}.outline`;
	let outline: SceneFormAnchor[] | undefined;
	if (!Array.isArray(input.generator.outline)) {
		addIssue(issues, outlinePath, 'invalid_type', 'Expected an array of outline anchors');
	} else {
		const parsed = input.generator.outline.map((anchor, index) =>
			parseFormAnchor(anchor, `${outlinePath}[${index}]`, issues)
		);
		outline = parsed.every((anchor): anchor is SceneFormAnchor => anchor !== undefined)
			? parsed
			: undefined;
	}
	const extent = readRequiredNumber(input.generator, 'extent', generatorPath, issues);
	if (
		extent !== undefined &&
		(extent < PROFILE_LIMITS.minExtentMeters || extent > PROFILE_LIMITS.maxExtentMeters)
	) {
		addIssue(
			issues,
			`${generatorPath}.extent`,
			'invalid_extent',
			`Extent must be within [${PROFILE_LIMITS.minExtentMeters}, ${PROFILE_LIMITS.maxExtentMeters}] m`
		);
	}
	const scale = readVec3(input.scale, `${path}.scale`, issues);
	if (scale !== undefined) {
		for (const [index, factor] of scale.entries()) {
			if (factor < PROFILE_LIMITS.minScale || factor > PROFILE_LIMITS.maxScale) {
				addIssue(
					issues,
					`${path}.scale[${index}]`,
					'invalid_scale',
					`A form scale factor must be within [${PROFILE_LIMITS.minScale}, ${PROFILE_LIMITS.maxScale}]`
				);
			}
		}
	}
	const nextKey = readRequiredNumber(input, 'nextKey', path, issues);
	if (nextKey !== undefined && (!Number.isSafeInteger(nextKey) || nextKey <= 0)) {
		addIssue(issues, `${path}.nextKey`, 'invalid_next_key', 'nextKey must be a positive safe integer');
	}
	if (
		kind === 'extrude' &&
		plane !== undefined &&
		outline !== undefined &&
		extent !== undefined &&
		extent >= PROFILE_LIMITS.minExtentMeters &&
		extent <= PROFILE_LIMITS.maxExtentMeters &&
		scale !== undefined &&
		scale.every((factor) => factor >= PROFILE_LIMITS.minScale && factor <= PROFILE_LIMITS.maxScale) &&
		nextKey !== undefined &&
		Number.isSafeInteger(nextKey) &&
		nextKey > 0
	) {
		const issuesBeforeProfile = issues.length;
		for (const issue of validateProfile(outline)) {
			addIssue(
				issues,
				outlinePath,
				issue.code,
				`${issue.code} at outline anchors ${issue.anchorKeys.join(', ')}`
			);
		}
		if (outline.some((anchor) => nextKey <= anchor.key)) {
			addIssue(
				issues,
				`${path}.nextKey`,
				'invalid_next_key',
				'nextKey must be greater than every outline anchor key'
			);
		}
		if (issues.length > issuesBeforeProfile) return undefined;
		return {
			generator: { kind: 'extrude', plane, outline, extent },
			scale,
			nextKey
		};
	}
	return undefined;
}

export function parseFormEntity(
	input: JsonRecord,
	path: string,
	issues: SceneDocumentIssue[],
	options: EntityParserOptions
): SceneFormEntity | undefined {
	rejectRoomId(input, 'roomId', path, issues);
	assertAllowedKeys(
		input,
		['kind', 'id', 'name', 'roomId', 'form', 'materialId', 'castShadow', 'receiveShadow', 'position', 'rotation'],
		path,
		issues
	);
	const id = readRequiredString(input, 'id', path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	const form = parseFormSource(input.form, `${path}.form`, issues);
	const materialIdRaw = readRequiredString(input, 'materialId', path, issues);
	const materialId =
		materialIdRaw && options.isKnownMaterialId(materialIdRaw)
			? (materialIdRaw as SceneFormEntity['materialId'])
			: undefined;
	if (materialIdRaw && !materialId) {
		addIssue(issues, `${path}.materialId`, 'unknown_material', `Unknown material: ${materialIdRaw}`);
	}
	const castShadow = readRequiredBoolean(input, 'castShadow', path, issues);
	const receiveShadow = readRequiredBoolean(input, 'receiveShadow', path, issues);
	const transform = parseEntityTransform(input, path, issues);
	if (
		!id ||
		!name ||
		!form ||
		!materialId ||
		castShadow === undefined ||
		receiveShadow === undefined ||
		!transform
	) {
		return undefined;
	}
	return {
		kind: 'form',
		id,
		name,
		form,
		materialId,
		castShadow,
		receiveShadow,
		position: transform.position,
		rotation: transform.rotation
	};
}

export function parseLightEntity(
	input: JsonRecord,
	path: string,
	issues: SceneDocumentIssue[],
): SceneLightEntity | undefined {
	assertAllowedKeys(
		input,
		[
			'kind',
			'id',
			'name',
			'roomId',
			'light',
			'color',
			'intensity',
			'range',
			'angle',
			'penumbra',
			'castShadow',
			'position',
			'rotation',
			'scale'
		],
		path,
		issues
	);
	const id = readRequiredString(input, 'id', path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	rejectRoomId(input, 'roomId', path, issues);
	const lightRaw = readRequiredString(input, 'light', path, issues);
	const light =
		lightRaw && (SCENE_LIGHT_KINDS as readonly string[]).includes(lightRaw)
			? (lightRaw as SceneLightKind)
			: undefined;
	if (lightRaw && !light) {
		addIssue(issues, `${path}.light`, 'invalid_light', `Invalid light kind: ${lightRaw}`);
	}
	const color = readRequiredString(input, 'color', path, issues);
	if (color && !HEX_COLOR_PATTERN.test(color)) {
		addIssue(issues, `${path}.color`, 'invalid_color', 'Expected a #rrggbb color string');
	}
	const intensity = readRequiredNumber(input, 'intensity', path, issues);
	if (intensity !== undefined && (!Number.isFinite(intensity) || intensity < 0)) {
		addIssue(issues, `${path}.intensity`, 'invalid_intensity', 'Intensity must be a finite number ≥ 0');
	}
	let range: number | undefined;
	if ('range' in input) {
		range = readRequiredNumber(input, 'range', path, issues);
		if (range !== undefined && (!Number.isFinite(range) || range <= 0)) {
			addIssue(issues, `${path}.range`, 'invalid_range', 'Range must be a finite number greater than zero');
			range = undefined;
		}
	}
	let angle: number | undefined;
	if ('angle' in input) {
		angle = readRequiredNumber(input, 'angle', path, issues);
		if (angle !== undefined && (!Number.isFinite(angle) || angle <= 0 || angle > Math.PI)) {
			addIssue(issues, `${path}.angle`, 'invalid_angle', 'Angle must be in (0, π] radians');
			angle = undefined;
		}
	}
	let penumbra: number | undefined;
	if ('penumbra' in input) {
		penumbra = readRequiredNumber(input, 'penumbra', path, issues);
		if (penumbra !== undefined && (!Number.isFinite(penumbra) || penumbra < 0 || penumbra > 1)) {
			addIssue(issues, `${path}.penumbra`, 'invalid_penumbra', 'Penumbra must be in [0, 1]');
			penumbra = undefined;
		}
	}
	if (light === 'directional') {
		if ('range' in input) addIssue(issues, `${path}.range`, 'unexpected_property', 'Directional lights do not use range');
		if ('angle' in input) addIssue(issues, `${path}.angle`, 'unexpected_property', 'Directional lights do not use angle');
		if ('penumbra' in input) {
			addIssue(issues, `${path}.penumbra`, 'unexpected_property', 'Directional lights do not use penumbra');
		}
	} else if (light === 'point') {
		if ('angle' in input) addIssue(issues, `${path}.angle`, 'unexpected_property', 'Point lights do not use angle');
		if ('penumbra' in input) {
			addIssue(issues, `${path}.penumbra`, 'unexpected_property', 'Point lights do not use penumbra');
		}
	} else if (light === 'spot') {
		if (!('angle' in input)) {
			addIssue(issues, `${path}.angle`, 'missing_property', 'Spot lights require angle');
		}
	}
	const castShadow = readRequiredBoolean(input, 'castShadow', path, issues);
	const transform = parseEntityTransform(input, path, issues);
	const colorValid = Boolean(color && HEX_COLOR_PATTERN.test(color));
	const intensityValid = intensity !== undefined && Number.isFinite(intensity) && intensity >= 0;
	const rangeOk = !('range' in input) || range !== undefined;
	const angleOk =
		light === 'spot' ? angle !== undefined : !('angle' in input) || angle !== undefined;
	const penumbraOk = !('penumbra' in input) || penumbra !== undefined;
	if (
		!id ||
		!name ||
		!light ||
		!colorValid ||
		!intensityValid ||
		castShadow === undefined ||
		!transform ||
		!rangeOk ||
		!angleOk ||
		!penumbraOk
	) {
		return undefined;
	}
	if (light === 'spot') {
		return {
			kind: 'light',
			id,
			name,
			light: 'spot',
			color: color!,
			intensity: intensity!,
			angle: angle!,
			castShadow,
			...transform,
			...(range === undefined ? {} : { range }),
			...(penumbra === undefined ? {} : { penumbra })
		};
	}
	if (light === 'point') {
		return {
			kind: 'light',
			id,
			name,
			light: 'point',
			color: color!,
			intensity: intensity!,
			castShadow,
			...transform,
			...(range === undefined ? {} : { range })
		};
	}
	return {
		kind: 'light',
		id,
		name,
		light: 'directional',
		color: color!,
		intensity: intensity!,
		castShadow,
		...transform,
	};
}

export function parseEntity(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[],
	options: EntityParserOptions
): SceneEntity | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a scene entity object');
		return undefined;
	}
	const kind = readRequiredString(input, 'kind', path, issues);
	if (kind === 'model') return parseModelEntity(input, path, issues, options);
	if (kind === 'primitive') return parsePrimitiveEntity(input, path, issues, options);
	if (kind === 'form') return parseFormEntity(input, path, issues, options);
	if (kind === 'light') return parseLightEntity(input, path, issues);
	if (kind !== undefined) {
		addIssue(issues, `${path}.kind`, 'invalid_entity_kind', `Invalid scene entity kind: ${kind}`);
	}
	return undefined;
}

export function parseCluster(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[]
): SceneObjectCluster | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a cluster object');
		return undefined;
	}
	assertAllowedKeys(input, ['id', 'name', 'roomId', 'memberIds'], path, issues);
	const id = readRequiredString(input, 'id', path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	rejectRoomId(input, 'roomId', path, issues);
	const memberIds = readStringArray(input.memberIds, `${path}.memberIds`, issues);
	if (!id || !name || !memberIds) return undefined;
	return { id, name, memberIds };
}
