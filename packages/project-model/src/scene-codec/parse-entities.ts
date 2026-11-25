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
import {
	GeometryCoreError,
	PROFILE_LIMITS,
	evaluateProfile,
	extrudeProfile,
	type EvaluatedProfile
} from '@portfolio/geometry-core';
import { ARTWORK_MAX_IMAGE_EDGE, isArtworkAssetId, isArtworkImageEdge, isArtworkWidth } from '../artwork';
import type { ArtworkImage, ArtworkLibraryEntry } from '../artwork';
import { readArtworkFrame } from '../artwork-frame';
import { readFinish } from '../materials/read';
import type { ArtworkFrame } from '../artwork-frame';
import type {
	SceneArtworkEntity,
	SceneBoxDimensions,
	SceneCylinderDimensions,
	SceneEntity,
	SceneFormAnchor,
	SceneFormEntity,
	SceneFormPlane,
	SceneFormSource,
	SceneLightEntity,
	SceneLightKind,
	SceneColor,
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
import type { SceneDocumentIssue } from './types';
import type { JsonRecord } from './readers';
import {
	HEX_COLOR_PATTERN,
	LOWER_HEX_COLOR_PATTERN,
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
	readVec3
} from './readers';

type EntityParserOptions = {
	allowMaterialInstance: boolean;
} & ResolvedSceneValidationOptions;

/** A project texture's `id` must equal the P20 asset its URI names. */
const PROJECT_ASSET_URI_PATTERN = /^\/project-assets\/([^/]+)$/;

const FINISH_COLOR_SLOT_MAX_LENGTH = 64;

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
	// One P20 image has exactly one texture record, so every Finish made from
	// the same image shares it and release pinning keeps one URI handle.
	const assetMatch = uri === undefined ? null : PROJECT_ASSET_URI_PATTERN.exec(uri);
	if (id !== undefined && assetMatch !== null && assetMatch[1] !== id) {
		addIssue(
			issues,
			`${path}.id`,
			'texture_id_mismatch',
			`A project texture's id must equal its asset id: ${assetMatch[1]}`
		);
		return undefined;
	}
	if (!id || !name || !uri || !safeUri) return undefined;
	return { id, name, uri };
}

/**
 * A finish colour: a lowercase `#rrggbb` literal or a `{ slot }` follower. The
 * follower is closed against the palette by the unit validator, which is the
 * only reader that holds the palette.
 */
export function parseSceneColor(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[]
): SceneColor | undefined {
	if (typeof input === 'string') {
		if (!LOWER_HEX_COLOR_PATTERN.test(input)) {
			addIssue(issues, path, 'invalid_color', 'Expected a lowercase #rrggbb color string');
			return undefined;
		}
		return input;
	}
	if (!isRecord(input)) {
		addIssue(
			issues,
			path,
			'invalid_type',
			'Expected a lowercase #rrggbb color string or a palette slot reference'
		);
		return undefined;
	}
	assertAllowedKeys(input, ['slot'], path, issues);
	const slot = readRequiredString(input, 'slot', path, issues);
	if (slot === undefined) return undefined;
	if (slot.length > FINISH_COLOR_SLOT_MAX_LENGTH) {
		addIssue(
			issues,
			`${path}.slot`,
			'invalid_value',
			`A palette slot id is at most ${FINISH_COLOR_SLOT_MAX_LENGTH} characters`
		);
		return undefined;
	}
	return { slot };
}

/**
 * Read one Scene 12 material instance through the portable Finish reader.
 *
 * The Scene codec owns Finish identity and the assignment normal form; the
 * grammar itself is the accepted v1 contract, so a second parser here would be
 * a second authority. A catalogue base must name a known catalogue id; a
 * resource base is a digest and is resolved against the resources unit by
 * envelope closure, not by this record reader.
 */
export function parseMaterialInstance(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[],
	validation: ResolvedSceneValidationOptions
): SceneMaterialInstance | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected a Finish object');
		return undefined;
	}
	const read = readFinish(input);
	if (!read.success) {
		for (const issue of read.issues) {
			addIssue(
				issues,
				issue.path === '$' ? path : `${path}${issue.path.slice(1)}`,
				issue.code,
				issue.action ?? issue.code
			);
		}
		return undefined;
	}
	const finish = read.finish;
	if ('catalogue' in finish.base && !validation.isKnownMaterialId(finish.base.catalogue)) {
		addIssue(
			issues,
			`${path}.base.catalogue`,
			'unknown_material',
			`Unknown material: ${finish.base.catalogue}`
		);
		return undefined;
	}
	return finish;
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

export function parseFormSource(
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
		let profile: EvaluatedProfile | undefined;
		try {
			// evaluateProfile performs validation itself; retain its typed issues
			// rather than validating and sampling the same outline twice.
			profile = evaluateProfile(outline);
		} catch (error) {
			if (error instanceof GeometryCoreError && error.issues.length > 0) {
				for (const issue of error.issues) addIssue(issues, outlinePath, issue.code,
					`${issue.code} at outline anchors ${issue.anchorKeys.join(', ')}`);
			} else addIssue(issues, outlinePath, 'invalid_form_body', error instanceof Error ? error.message : 'The form body cannot evaluate');
		}
		if (outline.some((anchor) => nextKey <= anchor.key)) {
			addIssue(
				issues,
				`${path}.nextKey`,
				'invalid_next_key',
				'nextKey must be greater than every outline anchor key'
			);
		}
		if (issues.length === issuesBeforeProfile && profile !== undefined) {
			// Admission is the first reader: a source the renderer's own evaluator
			// refuses (for example an extent and a scale whose product leaves the
			// scaled-dimension limits) must not load and then draw nothing.
			try {
				extrudeProfile({
					profile,
					extent,
					scale,
					plane
				});
			} catch (error) {
				addIssue(
					issues,
					outlinePath,
					'invalid_form_body',
					error instanceof GeometryCoreError
						? error.message
						: 'The form body is outside the admitted limits'
				);
			}
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
		[
			'kind',
			'id',
			'name',
			'roomId',
			'form',
			'materialId',
			'castShadow',
			'receiveShadow',
			'position',
			'rotation',
			'materialInstanceId'
		],
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
	// A form is a renderable entity like any other, so the shared material
	// instance override is admitted exactly when the caller's policy allows it.
	const materialInstanceId = options.allowMaterialInstance
		? readOptionalString(input, 'materialInstanceId', path, issues)
		: undefined;
	const transform = parseEntityTransform(input, path, issues);
	if (
		!id ||
		!name ||
		!form ||
		!materialId ||
		castShadow === undefined ||
		receiveShadow === undefined ||
		!transform ||
		(options.allowMaterialInstance && 'materialInstanceId' in input && !materialInstanceId)
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
		rotation: transform.rotation,
		...(materialInstanceId === undefined ? {} : { materialInstanceId })
	};
}

/**
 * The retired authored light kind. It is not in `SCENE_LIGHT_KINDS`; it is
 * recognised only so the codec can refuse it with a typed error that names the
 * entity. There is no conversion: the Sky owns the only Sun.
 */
const RETIRED_DIRECTIONAL_LIGHT = 'directional';

function describeRetiredLight(id: string | undefined, name: string | undefined): string {
	if (id && name) return `entity "${id}" ("${name}")`;
	if (id) return `entity "${id}"`;
	return 'an entity';
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
	if (lightRaw === RETIRED_DIRECTIONAL_LIGHT) {
		addIssue(
			issues,
			`${path}.light`,
			'unsupported_light_kind',
			`This project uses a light kind that is no longer supported: ${describeRetiredLight(id, name)} is a Directional light. The Sky owns the only Sun.`
		);
	} else if (lightRaw && !light) {
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
	if (light === 'point') {
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

function readArtworkImage(input: JsonRecord, path: string, issues: SceneDocumentIssue[]): ArtworkImage | undefined {
	const assetId = readRequiredString(input, 'assetId', path, issues);
	const pixelWidth = readRequiredNumber(input, 'pixelWidth', path, issues);
	const pixelHeight = readRequiredNumber(input, 'pixelHeight', path, issues);
	if (assetId === undefined || !isArtworkAssetId(assetId)) {
		addIssue(issues, `${path}.assetId`, 'invalid_asset_id', 'Expected a canonical project asset UUID');
		return undefined;
	}
	if (pixelWidth === undefined || pixelHeight === undefined ||
		!isArtworkImageEdge(pixelWidth) || !isArtworkImageEdge(pixelHeight)) {
		addIssue(issues, path, 'invalid_dimension', `Artwork image edges must be whole pixels from 1 to ${ARTWORK_MAX_IMAGE_EDGE}`);
		return undefined;
	}
	return { assetId, pixelWidth, pixelHeight };
}

export function parseArtworkLibraryEntry(input: unknown, path: string, issues: SceneDocumentIssue[]): ArtworkLibraryEntry | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected an Artwork Library image');
		return undefined;
	}
	assertAllowedKeys(input, ['assetId', 'name', 'pixelWidth', 'pixelHeight'], path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	const image = readArtworkImage(input, path, issues);
	return name && image ? { ...image, name } : undefined;
}

function parseArtworkEntity(input: JsonRecord, path: string, issues: SceneDocumentIssue[]): SceneArtworkEntity | undefined {
	assertAllowedKeys(input, ['kind', 'id', 'name', 'position', 'rotation', 'source', 'widthMeters', 'frame'], path, issues);
	const id = readRequiredString(input, 'id', path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	const position = readVec3(input.position, `${path}.position`, issues);
	const rotation = readVec3(input.rotation, `${path}.rotation`, issues);
	const widthMeters = readRequiredNumber(input, 'widthMeters', path, issues);
	let frame: ArtworkFrame | undefined;
	let frameInvalid = false;
	if ('frame' in input) {
		const parsed = readArtworkFrame(input.frame);
		if (parsed.error !== undefined) {
			addIssue(issues, `${path}.frame`, 'invalid_frame', parsed.error);
			frameInvalid = true;
		} else frame = parsed.frame;
	}
	const sourcePath = `${path}.source`;
	const source = input.source;
	if (!isRecord(source) || source.kind !== 'image') {
		addIssue(issues, sourcePath, 'invalid_artwork_source', 'Expected an image source');
		return undefined;
	}
	assertAllowedKeys(source, ['kind', 'assetId', 'pixelWidth', 'pixelHeight'], sourcePath, issues);
	const image = readArtworkImage(source, sourcePath, issues);
	if (!id || !name || !position || !rotation || !image || widthMeters === undefined || frameInvalid) return undefined;
	if (!isArtworkWidth(widthMeters, image)) {
		addIssue(issues, `${path}.widthMeters`, 'invalid_dimension', 'Artwork width and height must be between 0.001 and 1000 m');
		return undefined;
	}
	return {
		kind: 'artwork', id, name, position, rotation, widthMeters,
		source: { kind: 'image', ...image },
		...(frame === undefined ? {} : { frame })
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
	if (kind === 'artwork') return parseArtworkEntity(input, path, issues);
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
