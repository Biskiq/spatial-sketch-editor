import { type Vec3 } from '../../scene';
import {
	readNullableNumber,
	readPoint,
	readFrame,
	readFrameReference,
	readSupportChoice,
} from './readers';
import { type SceneOperationPayload } from './types';
import { type CreatorModelResourcePayload } from '../model-resource';
import { ShapeReader } from '../../strict-shape';

export function readPlaceObjectPayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'definitionKey',
		'metadataContentId',
		'worldXZ',
		'yaw',
		'frame',
		'frameReference',
		'supportChoice',
		'modelResource',
	]);
	if (record === null) return null;
	const definitionKey = reader.opaqueId(record.definitionKey, `${path}.definitionKey`);
	const metadataContentId = reader.opaqueId(record.metadataContentId, `${path}.metadataContentId`);
	const worldXZ = readPoint(reader, record.worldXZ, `${path}.worldXZ`);
	const yaw = reader.number(record.yaw, `${path}.yaw`);
	const frame = readFrame(reader, record.frame, `${path}.frame`);
	const frameReference = readFrameReference(
		reader,
		record.frameReference,
		`${path}.frameReference`,
		frame,
	);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	const modelResource =
		record.modelResource === undefined
			? null
			: readCreatorModelResourcePayload(reader, record.modelResource, `${path}.modelResource`);
	if (
		definitionKey === null ||
		metadataContentId === null ||
		worldXZ === null ||
		yaw === null ||
		frame === null ||
		!frameReference.ok ||
		choice === undefined ||
		(record.modelResource !== undefined && modelResource === null)
	) {
		return null;
	}
	return {
		kind: 'place-object',
		definitionKey,
		metadataContentId,
		worldXZ,
		yaw,
		frame,
		frameReference: frameReference.value,
		...(choice.choice === undefined ? {} : { choice: choice.choice }),
		...(modelResource === null ? {} : { modelResource }),
	};
}

/**
 * Read the optional first-placement resource introduction.
 *
 * Every field is required and finite; the planner re-validates the pin against
 * the approved model rules before installing anything, so this reader only
 * proves the captured payload is shaped like a resource at all.
 */
export function readCreatorModelResourcePayload(
	reader: ShapeReader,
	raw: unknown,
	path: string,
): ({ readonly id: string } & CreatorModelResourcePayload) | null {
	const record = reader.object(raw, path, [
		'id',
		'derivative',
		'source',
		'recipe',
		'reportDigest',
		'placement',
	]);
	if (record === null) return null;
	const id = reader.opaqueId(record.id, `${path}.id`);
	const derivative = reader.object(record.derivative, `${path}.derivative`, [
		'hash',
		'mime',
		'size',
		'locator',
	]);
	const source = reader.object(record.source, `${path}.source`, [
		'manifestHash',
		'size',
		'fileCount',
	]);
	const recipe = reader.object(record.recipe, `${path}.recipe`, ['id', 'version']);
	const reportDigest = reader.opaqueId(record.reportDigest, `${path}.reportDigest`);
	const placement = reader.object(record.placement, `${path}.placement`, [
		'metresPerSourceUnit',
		'pivot',
		'footprint',
		'contactMinY',
	]);
	if (
		id === null ||
		derivative === null ||
		source === null ||
		recipe === null ||
		reportDigest === null ||
		placement === null
	) {
		return null;
	}
	const hash = reader.opaqueId(derivative.hash, `${path}.derivative.hash`);
	const mime = reader.string(derivative.mime, `${path}.derivative.mime`);
	const size = reader.integerAtLeast(derivative.size, `${path}.derivative.size`, 1);
	const locator = reader.string(derivative.locator, `${path}.derivative.locator`);
	const manifestHash = reader.opaqueId(source.manifestHash, `${path}.source.manifestHash`);
	const sourceSize = reader.integerAtLeast(source.size, `${path}.source.size`, 0);
	const fileCount = reader.integerAtLeast(source.fileCount, `${path}.source.fileCount`, 1);
	const recipeId = reader.string(recipe.id, `${path}.recipe.id`);
	const recipeVersion = reader.integerAtLeast(recipe.version, `${path}.recipe.version`, 1);
	const metresPerSourceUnit = reader.numberAtLeast(
		placement.metresPerSourceUnit,
		`${path}.placement.metresPerSourceUnit`,
		0,
		true,
	);
	const pivot = reader.vector3(placement.pivot, `${path}.placement.pivot`);
	const footprint = reader.object(placement.footprint, `${path}.placement.footprint`, [
		'width',
		'depth',
	]);
	const contactMinY = reader.number(placement.contactMinY, `${path}.placement.contactMinY`);
	if (
		hash === null ||
		mime === null ||
		size === null ||
		locator === null ||
		manifestHash === null ||
		sourceSize === null ||
		fileCount === null ||
		recipeId === null ||
		recipeVersion === null ||
		metresPerSourceUnit === null ||
		pivot === null ||
		footprint === null ||
		contactMinY === null
	) {
		return null;
	}
	const width = reader.numberAtLeast(footprint.width, `${path}.placement.footprint.width`, 0, true);
	const depth = reader.numberAtLeast(footprint.depth, `${path}.placement.footprint.depth`, 0, true);
	if (width === null || depth === null) return null;
	return {
		id,
		derivative: { hash, mime, size, locator },
		source: { manifestHash, size: sourceSize, fileCount },
		recipe: { id: recipeId, version: recipeVersion },
		reportDigest,
		placement: {
			metresPerSourceUnit,
			pivot: [pivot[0], pivot[1], pivot[2]],
			footprint: { width, depth },
			contactMinY,
		},
	};
}

export function readCreateLightPayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
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
		kind: 'create-light',
		light,
		name,
		color,
		intensity,
		castShadow,
		position,
		rotation,
		...(range === undefined || range === null ? {} : { range }),
		...(angle === undefined || angle === null ? {} : { angle }),
		...(penumbra === undefined || penumbra === null ? {} : { penumbra }),
	};
}

export function readUpdateLightPayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, [
		'entityId',
		'position',
		'rotation',
		'color',
		'intensity',
		'range',
		'angle',
		'penumbra',
		'castShadow',
	]);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const position =
		record.position === undefined ? undefined : reader.vector3(record.position, `${path}.position`);
	const rotation =
		record.rotation === undefined ? undefined : reader.vector3(record.rotation, `${path}.rotation`);
	const color =
		record.color === undefined ? undefined : reader.string(record.color, `${path}.color`);
	const intensity =
		record.intensity === undefined
			? undefined
			: reader.number(record.intensity, `${path}.intensity`);
	const range = readNullableNumber(reader, record.range, `${path}.range`);
	const angle =
		record.angle === undefined ? undefined : reader.number(record.angle, `${path}.angle`);
	const penumbra = readNullableNumber(reader, record.penumbra, `${path}.penumbra`);
	const castShadow =
		record.castShadow === undefined
			? undefined
			: reader.boolean(record.castShadow, `${path}.castShadow`);
	if (
		entityId === null ||
		(record.position !== undefined && position === null) ||
		(record.rotation !== undefined && rotation === null) ||
		(record.color !== undefined && color === null) ||
		(record.intensity !== undefined && intensity === null) ||
		range === null ||
		(record.angle !== undefined && angle === null) ||
		penumbra === null ||
		(record.castShadow !== undefined && castShadow === null)
	) {
		return null;
	}
	return {
		kind: 'update-light',
		entityId,
		...(position === undefined ? {} : { position: position as Vec3 }),
		...(rotation === undefined ? {} : { rotation: rotation as Vec3 }),
		...(color === undefined ? {} : { color: color as string }),
		...(intensity === undefined ? {} : { intensity: intensity as number }),
		...(range.present ? { range: range.value } : {}),
		...(angle === undefined ? {} : { angle: angle as number }),
		...(penumbra.present ? { penumbra: penumbra.value } : {}),
		...(castShadow === undefined ? {} : { castShadow: castShadow as boolean }),
	};
}

export function readDuplicatePayload(
	reader: ShapeReader,
	raw: unknown,
): SceneOperationPayload | null {
	const path = '$.payload';
	const record = reader.object(raw, path, ['entityId', 'contactMinY', 'supportChoice']);
	if (record === null) return null;
	const entityId = reader.opaqueId(record.entityId, `${path}.entityId`);
	const contactMinY = reader.number(record.contactMinY, `${path}.contactMinY`);
	const choice = readSupportChoice(reader, record.supportChoice, `${path}.supportChoice`);
	if (entityId === null || contactMinY === null || choice === undefined) return null;
	return {
		kind: 'duplicate-one',
		entityId,
		contactMinY,
		...(choice.choice === undefined ? {} : { choice: choice.choice }),
	};
}
