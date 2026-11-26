import { readMaterialDefinition } from '../../materials/definition';
import { ShapeReader, type ShapeValidation } from '../../strict-shape';
import {
	MODEL_DERIVATIVE_MAX_BYTES,
	MODEL_RESOURCE_MIME,
	MODEL_SOURCE_SET_MAX_BYTES,
	RESOURCE_KINDS,
	RESOURCE_UNIT_FORMAT_VERSION,
	type MaterialResourceDetail,
	type ModelResourceDetail,
	type ResourceUnitPayload,
	type TypedResource,
	type UnresolvedBinding,
} from '../types';
import { failed, validateUnresolvedBinding, readPin } from './shared';

export const RESOURCE_KEYS = [
	'kind',
	'id',
	'contentRevision',
	'pin',
	'unresolved',
	'model',
	'material',
] as const;
export const RESOURCE_PAYLOAD_KEYS = ['formatVersion', 'resources'] as const;
export const MODEL_KEYS = ['source', 'recipe', 'reportDigest', 'placement'] as const;
export const MODEL_SOURCE_KEYS = ['manifestHash', 'size', 'fileCount'] as const;
export const MODEL_RECIPE_KEYS = ['id', 'version'] as const;
export const MODEL_PLACEMENT_KEYS = [
	'metresPerSourceUnit',
	'pivot',
	'footprint',
	'contactMinY',
	'placement',
] as const;
export const MODEL_FOOTPRINT_KEYS = ['width', 'depth'] as const;
export const SHA256_PATTERN = /^sha256-[0-9a-f]{64}$/;

/**
 * Strict read of the typed-resource payload (format 2).
 *
 * A resource is either resolved — an exact content revision, and for external
 * bytes a real pin — or it carries the typed diagnostic that says what is
 * missing. A resource with neither is rejected: admission never fabricates a pin,
 * and an empty registry is valid only when nothing requires a resource (which the
 * envelope reader checks against the lock).
 *
 * A `model` resource is the creator-import kind: its derivative bytes are its
 * `pin` (content revision is that pin's hash), and the retained source pin, the
 * recipe, the report digest and the placement definition are required. It is
 * always an approved, immutable revision, so an unresolved model is a
defect rather than a repairable binding.
 */
export function validateResourcePayload(input: unknown): ShapeValidation<ResourceUnitPayload> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', RESOURCE_PAYLOAD_KEYS);
	if (record === null) return failed(reader);
	if (record.formatVersion !== RESOURCE_UNIT_FORMAT_VERSION) {
		reader.problem(
			'$.formatVersion',
			'unsupported_format_version',
			`$.formatVersion must be ${RESOURCE_UNIT_FORMAT_VERSION}`,
		);
		return failed(reader);
	}
	if (!Array.isArray(record.resources)) {
		reader.problem('$.resources', 'not-an-array', '$.resources must be an array');
		return failed(reader);
	}
	const resources: TypedResource[] = [];
	const ids = new Set<string>();
	for (const [index, entry] of record.resources.entries()) {
		const path = `$.resources[${index}]`;
		const value = reader.object(entry, path, RESOURCE_KEYS);
		if (value === null) return failed(reader);
		const kind = reader.tag(value.kind, `${path}.kind`, RESOURCE_KINDS);
		const id = reader.opaqueId(value.id, `${path}.id`);
		const contentRevision =
			value.contentRevision === null
				? null
				: reader.opaqueId(value.contentRevision, `${path}.contentRevision`);
		const pin = value.pin === null ? null : readPin(reader, value.pin, `${path}.pin`);
		let unresolved: UnresolvedBinding | null = null;
		if (value.unresolved !== null) {
			const binding = validateUnresolvedBinding(value.unresolved);
			if (!binding.success) {
				for (const issue of binding.issues)
					reader.problem(`${path}.unresolved${issue.path.slice(1)}`, issue.code, issue.message);
				return failed(reader);
			}
			unresolved = binding.value;
		}
		if (value.model === null) {
			reader.problem(
				`${path}.model`,
				'invalid-type',
				`${path}.model must be a model detail object when present, not null`,
			);
			return failed(reader);
		}
		if (value.material === null) {
			reader.problem(
				`${path}.material`,
				'invalid-type',
				`${path}.material must be a material definition object when present, not null`,
			);
			return failed(reader);
		}
		const model =
			value.model === undefined ? undefined : readModelDetail(reader, value.model, `${path}.model`);
		const material =
			value.material === undefined
				? undefined
				: readMaterialResourceDetail(reader, value.material, `${path}.material`);
		if (kind === null || id === null || (value.pin !== null && pin === null)) return failed(reader);
		if (value.model !== undefined && model === undefined) return failed(reader);
		if (value.material !== undefined && material === undefined) return failed(reader);
		if (contentRevision === null && pin === null && unresolved === null) {
			reader.problem(
				path,
				'unresolved-resource-without-diagnostic',
				`${path} is neither pinned nor revised and carries no diagnostic`,
			);
			return failed(reader);
		}
		if (kind === 'model') {
			if (model === undefined) {
				reader.problem(
					`${path}.model`,
					'missing-model-detail',
					`${path} is a model resource and must carry its retained source, recipe, report digest and placement`,
				);
				return failed(reader);
			}
			if (material !== undefined) {
				reader.problem(
					`${path}.material`,
					'unknown-key',
					`${path}.material is only part of a material resource`,
				);
				return failed(reader);
			}
			if (pin === null || unresolved !== null) {
				reader.problem(
					`${path}.pin`,
					'unapproved-model-resource',
					`${path} is a model resource and must be an approved revision with a derivative pin`,
				);
				return failed(reader);
			}
			if (pin.mime !== MODEL_RESOURCE_MIME) {
				reader.problem(
					`${path}.pin.mime`,
					'unsupported-media-type',
					`${path}.pin.mime must be ${MODEL_RESOURCE_MIME}`,
				);
				return failed(reader);
			}
			if (pin.size > MODEL_DERIVATIVE_MAX_BYTES) {
				reader.problem(
					`${path}.pin.size`,
					'out-of-range',
					`${path}.pin.size must not exceed ${MODEL_DERIVATIVE_MAX_BYTES} bytes`,
				);
				return failed(reader);
			}
			if (contentRevision === null || contentRevision !== pin.hash) {
				reader.problem(
					`${path}.contentRevision`,
					'content-revision-mismatch',
					`${path}.contentRevision must be the derivative pin's own hash`,
				);
				return failed(reader);
			}
		} else if (kind === 'material') {
			if (material === undefined) {
				reader.problem(
					`${path}.material`,
					'missing-material-detail',
					`${path} is a material resource and must carry its recipe and exact image mappings`,
				);
				return failed(reader);
			}
			if (model !== undefined) {
				reader.problem(
					`${path}.model`,
					'unknown-key',
					`${path}.model is only part of a model resource`,
				);
				return failed(reader);
			}
			if (pin !== null || unresolved !== null) {
				reader.problem(
					`${path}.pin`,
					'unapproved-material-resource',
					`${path} is an immutable in-project definition and must not carry an external pin or diagnostic`,
				);
				return failed(reader);
			}
			if (contentRevision === null || contentRevision !== id) {
				reader.problem(
					`${path}.contentRevision`,
					'content-revision-mismatch',
					`${path}.contentRevision must be the recipe identity itself`,
				);
				return failed(reader);
			}
			if (!SHA256_PATTERN.test(id)) {
				reader.problem(
					`${path}.id`,
					'invalid-hash',
					`${path}.id must be the lowercase sha256 recipe identity`,
				);
				return failed(reader);
			}
		} else {
			if (model !== undefined) {
				reader.problem(
					`${path}.model`,
					'unknown-key',
					`${path}.model is only part of a model resource`,
				);
				return failed(reader);
			}
			if (material !== undefined) {
				reader.problem(
					`${path}.material`,
					'unknown-key',
					`${path}.material is only part of a material resource`,
				);
				return failed(reader);
			}
		}
		const key = `${kind}:${id}`;
		if (ids.has(key))
			reader.problem(`${path}.id`, 'duplicate-identity', `resource "${key}" is declared twice`);
		ids.add(key);
		resources.push({
			kind: kind as TypedResource['kind'],
			id,
			contentRevision,
			pin,
			unresolved,
			...(model === undefined ? {} : { model }),
			...(material === undefined ? {} : { material }),
		});
	}
	if (reader.issues.length > 0) return failed(reader);
	return {
		success: true,
		value: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources },
		ignoredOptionalExtensions: [],
	};
}

/**
 * Strict read of a material resource's definition.
 *
 * The recipe/definition grammar is the portable v1 reader, not a second parser:
 * exact digest coverage, unique sorted images and every role/selector pairing
 * come from that one implementation. This function only maps its diagnostics
 * into the envelope reader's path space.
 */
export function readMaterialResourceDetail(
	reader: ShapeReader,
	input: unknown,
	path: string,
): MaterialResourceDetail | undefined {
	const read = readMaterialDefinition(input);
	if (!read.success) {
		for (const issue of read.issues) {
			reader.problem(
				issue.path === '$' ? path : `${path}${issue.path.slice(1)}`,
				issue.code,
				issue.action ?? issue.code,
			);
		}
		return undefined;
	}
	return read.definition;
}

/** Strict read of the retained model provenance and placement definition. */
export function readModelDetail(
	reader: ShapeReader,
	input: unknown,
	path: string,
): ModelResourceDetail | undefined {
	const record = reader.object(input, path, MODEL_KEYS);
	if (record === null) return undefined;

	const sourceRecord = reader.object(record.source, `${path}.source`, MODEL_SOURCE_KEYS);
	if (sourceRecord === null) return undefined;
	const manifestHash = readModelHash(
		reader,
		sourceRecord.manifestHash,
		`${path}.source.manifestHash`,
	);
	const size = reader.integerAtLeast(sourceRecord.size, `${path}.source.size`, 1);
	const fileCount = reader.integerAtLeast(sourceRecord.fileCount, `${path}.source.fileCount`, 1);
	if (size !== null && size > MODEL_SOURCE_SET_MAX_BYTES) {
		reader.problem(
			`${path}.source.size`,
			'out-of-range',
			`${path}.source.size must not exceed ${MODEL_SOURCE_SET_MAX_BYTES} bytes`,
		);
		return undefined;
	}

	const recipeRecord = reader.object(record.recipe, `${path}.recipe`, MODEL_RECIPE_KEYS);
	if (recipeRecord === null) return undefined;
	const recipeId = reader.string(recipeRecord.id, `${path}.recipe.id`);
	const recipeVersion = reader.integerAtLeast(recipeRecord.version, `${path}.recipe.version`, 1);
	const reportDigest = readModelHash(reader, record.reportDigest, `${path}.reportDigest`);

	const placementRecord = reader.object(
		record.placement,
		`${path}.placement`,
		MODEL_PLACEMENT_KEYS,
	);
	if (placementRecord === null) return undefined;
	const metresPerSourceUnit = reader.number(
		placementRecord.metresPerSourceUnit,
		`${path}.placement.metresPerSourceUnit`,
	);
	if (metresPerSourceUnit !== null && metresPerSourceUnit <= 0) {
		reader.problem(
			`${path}.placement.metresPerSourceUnit`,
			'out-of-range',
			`${path}.placement.metresPerSourceUnit must be greater than zero`,
		);
		return undefined;
	}
	const pivot = reader.vector3(placementRecord.pivot, `${path}.placement.pivot`);
	const footprintRecord = reader.object(
		placementRecord.footprint,
		`${path}.placement.footprint`,
		MODEL_FOOTPRINT_KEYS,
	);
	if (footprintRecord === null) return undefined;
	const width = reader.number(footprintRecord.width, `${path}.placement.footprint.width`);
	const depth = reader.number(footprintRecord.depth, `${path}.placement.footprint.depth`);
	if ((width !== null && width <= 0) || (depth !== null && depth <= 0)) {
		reader.problem(
			`${path}.placement.footprint`,
			'out-of-range',
			`${path}.placement.footprint width and depth must be greater than zero`,
		);
		return undefined;
	}
	const contactMinY = reader.number(placementRecord.contactMinY, `${path}.placement.contactMinY`);
	const placement = reader.tag(placementRecord.placement, `${path}.placement.placement`, [
		'floor',
	] as const);
	if (
		manifestHash === null ||
		size === null ||
		fileCount === null ||
		recipeId === null ||
		recipeVersion === null ||
		reportDigest === null ||
		metresPerSourceUnit === null ||
		pivot === null ||
		width === null ||
		depth === null ||
		contactMinY === null ||
		placement === null
	) {
		return undefined;
	}
	return {
		source: { manifestHash, size, fileCount },
		recipe: { id: recipeId, version: recipeVersion },
		reportDigest,
		placement: {
			metresPerSourceUnit,
			pivot,
			footprint: { width, depth },
			contactMinY,
			placement: placement as 'floor',
		},
	};
}

export function readModelHash(reader: ShapeReader, value: unknown, path: string): string | null {
	if (typeof value !== 'string' || !SHA256_PATTERN.test(value)) {
		reader.problem(path, 'invalid-identity', `${path} must be a sha256 digest`);
		return null;
	}
	return value;
}
