import { SCENE_WORLD_LOCAL_FORMAT_VERSION, type SceneDocument } from '../scene';
import {
	withSceneValidationOptions,
	type ResolvedSceneValidationOptions,
	type SceneValidationOptions
} from '../scene-validation';
import { canonicalDocument } from './canonical';
import {
	parseArtworkLibraryEntry,
	parseCluster,
	parseEntity,
	parseMaterialInstance,
	parseTextureAsset
} from './parse-entities';
import { parseConnection, parseNode, validateSemantics } from './parse-document';
import { addIssue, assertAllowedKeys, isRecord } from './readers';
import type { SceneDocumentIssue, SceneDocumentValidationResult } from './types';

export function validateSceneDocument(
	input: unknown,
	options: SceneValidationOptions = {}
): SceneDocumentValidationResult {
	const validation: ResolvedSceneValidationOptions = withSceneValidationOptions(options);
	const issues: SceneDocumentIssue[] = [];
	if (!isRecord(input)) {
		addIssue(issues, '$', 'invalid_type', 'Expected a scene document object');
		return { success: false, issues };
	}
	// PR #115 — current-format-only. The one supported Scene format is the
	// world-local document, which carries the explicit discriminator
	// `formatVersion: 1`. A missing discriminator or any other explicit value
	// fails ordinary current-format validation right here: there is no legacy
	// decoder branch, no change of shape interpretation and no version
	// inference from field presence.
	if (typeof input.formatVersion !== 'number') {
		addIssue(issues, '$.formatVersion', 'invalid_type', 'Expected a number');
		return { success: false, issues };
	}
	if (input.formatVersion !== SCENE_WORLD_LOCAL_FORMAT_VERSION) {
		addIssue(
			issues,
			'$.formatVersion',
			'unsupported_format_version',
			`Unsupported Scene formatVersion ${JSON.stringify(input.formatVersion)}; recognized value: ${SCENE_WORLD_LOCAL_FORMAT_VERSION}`
		);
		return { success: false, issues };
	}
	const rootKeys = [
		'formatVersion',
		'textures',
		'materials',
		'entities',
		'clusters',
		'navigationNodes',
		'connections'
	] as const;
	assertAllowedKeys(input, rootKeys, '$', issues);
	const parseArray = <T>(key: string, parser: (value: unknown, path: string, target: SceneDocumentIssue[]) => T | undefined) => {
		const value = input[key];
		if (!Array.isArray(value)) {
			addIssue(issues, `$.${key}`, 'invalid_type', 'Expected an array');
			return undefined;
		}
		const values = value.map((item, index) => parser(item, `$.${key}[${index}]`, issues));
		return values.every((item): item is T => item !== undefined) ? values : undefined;
	};
	const textures = parseArray('textures', (value, path, target) =>
		parseTextureAsset(value, path, target, validation)
	);
	const materials = parseArray('materials', (value, path, target) =>
		parseMaterialInstance(value, path, target, validation)
	);
	const entities = parseArray('entities', (value, path, target) =>
		parseEntity(value, path, target, {
			allowMaterialInstance: true,
			...validation
		})
	);
	const clusters = 'clusters' in input
		? parseArray('clusters', (value, path, target) => parseCluster(value, path, target))
		: undefined;
	const navigationNodes = parseArray('navigationNodes', (value, path, target) =>
		parseNode(value, path, target)
	);
	const connections = parseArray('connections', parseConnection);
	if (
		!textures ||
		!materials ||
		!entities ||
		('clusters' in input && !clusters) ||
		!navigationNodes ||
		!connections ||
		issues.length
	) {
		return { success: false, issues };
	}
	// Room ownership is rejected at parse time for every record (entities,
	// clusters, navigation nodes, path anchors, waypoints and view keyframes),
	// so a valid document is project/world coordinates throughout by
	// construction.
	const document = {
		formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION,
		textures,
		materials,
		entities,
		...(clusters === undefined ? {} : { clusters }),
		navigationNodes,
		connections
	};
	validateSemantics(document, issues, validation);
	if (issues.length) return { success: false, issues };
	const normalized = canonicalDocument(document);
	return { success: true, document: normalized, canonicalJson: JSON.stringify(normalized, null, 2) + '\n' };
}

/** Artwork shelf admission belongs to the authored Scene unit. */
export function validateArtworkLibrary(input: unknown, entities: SceneDocument['entities']) {
	const issues: SceneDocumentIssue[] = [];
	const entries = new Map<string, NonNullable<ReturnType<typeof parseArtworkLibraryEntry>>>();
	if (input !== undefined) {
		if (!Array.isArray(input)) {
			addIssue(issues, '$.artworkLibrary', 'invalid_type', 'Expected an array');
		} else {
			for (const [index, value] of input.entries()) {
				const path = `$.artworkLibrary[${index}]`;
				const entry = parseArtworkLibraryEntry(value, path, issues);
				if (entry === undefined) continue;
				if (entries.has(entry.assetId)) {
					addIssue(issues, `${path}.assetId`, 'duplicate_asset_id', 'Artwork Library asset appears more than once');
				}
				entries.set(entry.assetId, entry);
			}
		}
	}
	for (const [index, entity] of entities.entries()) {
		if (entity.kind !== 'artwork') continue;
		const entry = entries.get(entity.source.assetId);
		if (entry?.pixelWidth !== entity.source.pixelWidth || entry.pixelHeight !== entity.source.pixelHeight) {
			addIssue(issues, `$.entities[${index}].source`, 'artwork_library_mismatch', 'Artwork must match its project Library image');
		}
	}
	const library = [...entries.values()].sort((a, b) => a.assetId < b.assetId ? -1 : a.assetId > b.assetId ? 1 : 0);
	return { library, issues };
}
