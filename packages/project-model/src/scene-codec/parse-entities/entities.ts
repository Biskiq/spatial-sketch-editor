import type { ArtworkImage, ArtworkLibraryEntry } from '../../artwork';
import {
	ARTWORK_MAX_IMAGE_EDGE,
	isArtworkAssetId,
	isArtworkImageEdge,
	isArtworkWidth,
} from '../../artwork';
import type { ArtworkFrame } from '../../artwork-frame';
import { readArtworkFrame } from '../../artwork-frame';
import type {
	SceneArtworkEntity,
	SceneEntity,
	SceneLightEntity,
	SceneLightKind,
	SceneModelEntity,
	SceneObjectCluster,
	ScenePrimitiveEntity,
	ScenePrimitiveKind,
	Vec3,
} from '../../scene';
import type { SceneDocumentIssue } from '../types';
import type { JsonRecord } from '../readers';
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
	readStringArray,
	readVec3,
	rejectRoomId,
} from '../readers';
import type { EntityParserOptions } from './contracts';
import { parseFormEntity } from './forms';
import { parsePrimitiveDimensions } from './materials';

export function parseEntityTransform(
	input: JsonRecord,
	path: string,
	issues: SceneDocumentIssue[],
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
	options: EntityParserOptions,
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
			...(options.allowMaterialInstance ? ['materialInstanceId'] : []),
		],
		path,
		issues,
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
	options: EntityParserOptions,
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
			...(options.allowMaterialInstance ? ['materialInstanceId'] : []),
		],
		path,
		issues,
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
		addIssue(
			issues,
			`${path}.primitive`,
			'invalid_primitive',
			`Invalid primitive kind: ${primitiveRaw}`,
		);
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
		addIssue(
			issues,
			`${path}.materialId`,
			'unknown_material',
			`Unknown material: ${materialIdRaw}`,
		);
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
			'scale',
		],
		path,
		issues,
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
			`This project uses a light kind that is no longer supported: ${describeRetiredLight(id, name)} is a Directional light. The Sky owns the only Sun.`,
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
		addIssue(
			issues,
			`${path}.intensity`,
			'invalid_intensity',
			'Intensity must be a finite number ≥ 0',
		);
	}
	let range: number | undefined;
	if ('range' in input) {
		range = readRequiredNumber(input, 'range', path, issues);
		if (range !== undefined && (!Number.isFinite(range) || range <= 0)) {
			addIssue(
				issues,
				`${path}.range`,
				'invalid_range',
				'Range must be a finite number greater than zero',
			);
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
		if ('angle' in input)
			addIssue(issues, `${path}.angle`, 'unexpected_property', 'Point lights do not use angle');
		if ('penumbra' in input) {
			addIssue(
				issues,
				`${path}.penumbra`,
				'unexpected_property',
				'Point lights do not use penumbra',
			);
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
			...(penumbra === undefined ? {} : { penumbra }),
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
		...(range === undefined ? {} : { range }),
	};
}

function readArtworkImage(
	input: JsonRecord,
	path: string,
	issues: SceneDocumentIssue[],
): ArtworkImage | undefined {
	const assetId = readRequiredString(input, 'assetId', path, issues);
	const pixelWidth = readRequiredNumber(input, 'pixelWidth', path, issues);
	const pixelHeight = readRequiredNumber(input, 'pixelHeight', path, issues);
	if (assetId === undefined || !isArtworkAssetId(assetId)) {
		addIssue(
			issues,
			`${path}.assetId`,
			'invalid_asset_id',
			'Expected a canonical project asset UUID',
		);
		return undefined;
	}
	if (
		pixelWidth === undefined ||
		pixelHeight === undefined ||
		!isArtworkImageEdge(pixelWidth) ||
		!isArtworkImageEdge(pixelHeight)
	) {
		addIssue(
			issues,
			path,
			'invalid_dimension',
			`Artwork image edges must be whole pixels from 1 to ${ARTWORK_MAX_IMAGE_EDGE}`,
		);
		return undefined;
	}
	return { assetId, pixelWidth, pixelHeight };
}

export function parseArtworkLibraryEntry(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[],
): ArtworkLibraryEntry | undefined {
	if (!isRecord(input)) {
		addIssue(issues, path, 'invalid_type', 'Expected an Artwork Library image');
		return undefined;
	}
	assertAllowedKeys(input, ['assetId', 'name', 'pixelWidth', 'pixelHeight'], path, issues);
	const name = readRequiredString(input, 'name', path, issues);
	const image = readArtworkImage(input, path, issues);
	return name && image ? { ...image, name } : undefined;
}

function parseArtworkEntity(
	input: JsonRecord,
	path: string,
	issues: SceneDocumentIssue[],
): SceneArtworkEntity | undefined {
	assertAllowedKeys(
		input,
		['kind', 'id', 'name', 'position', 'rotation', 'source', 'widthMeters', 'frame'],
		path,
		issues,
	);
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
	if (!id || !name || !position || !rotation || !image || widthMeters === undefined || frameInvalid)
		return undefined;
	if (!isArtworkWidth(widthMeters, image)) {
		addIssue(
			issues,
			`${path}.widthMeters`,
			'invalid_dimension',
			'Artwork width and height must be between 0.001 and 1000 m',
		);
		return undefined;
	}
	return {
		kind: 'artwork',
		id,
		name,
		position,
		rotation,
		widthMeters,
		source: { kind: 'image', ...image },
		...(frame === undefined ? {} : { frame }),
	};
}

export function parseEntity(
	input: unknown,
	path: string,
	issues: SceneDocumentIssue[],
	options: EntityParserOptions,
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
	issues: SceneDocumentIssue[],
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
