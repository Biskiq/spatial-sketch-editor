/**
 * `scene-codec/index.ts` — public barrel for the scene document codec.
 *
 * The current canonical Scene is world-local (`formatVersion: 1`):
 * project/world coordinates, no `roomId`. The versionless room-local shape
 * is recognized legacy compatibility, accepted only through the explicit
 * legacy identification path (`formatVersion` dispatch is explicit).
 *
 * Internal helpers live in:
 *
 *   - `./readers`       — leaf typed JSON readers + `JsonRecord`
 *   - `./parse-entities`— entities, materials, textures
 *   - `./parse-document`— nodes, waypoints, connections, timing, semantics
 *   - `./canonical`     — clone helpers + deterministic serializer
 *
 * Public surface frozen to: `SceneDocumentIssue`,
 * `SceneDocumentValidationResult`, `SceneDocumentValidationError`,
 * `cameraSceneConnectionTimingFailureReason`, `validateSceneDocument`,
 * `parseSceneDocumentJson`, `serializeSceneDocument`. Everything else is
 * `@internal` and consumers should not import the sibling modules
 * directly.
 */
import { SCENE_WORLD_LOCAL_FORMAT_VERSION, type SceneDocument } from '../scene';
import { addIssue, assertAllowedKeys, isRecord } from './readers';
import {
	parseCluster,
	parseEntity,
	parseMaterialInstance,
	parseTextureAsset
} from './parse-entities';
import { parseConnection, parseNode, validateSemantics } from './parse-document';
import { canonicalDocument } from './canonical';
import {
	withSceneValidationOptions,
	type ResolvedSceneValidationOptions,
	type SceneValidationOptions
} from '../scene-validation';

/**
 * Public surface types for the scene document codec. The current canonical
 * shape is world-local (`formatVersion: 1`); the versionless room-local
 * shape is recognized legacy compatibility decoded through the explicit
 * legacy path.
 */
export type SceneDocumentIssue = {
	path: string;
	code: string;
	message: string;
};

export type SceneDocumentValidationResult =
	| { success: true; document: SceneDocument; canonicalJson: string }
	| { success: false; issues: SceneDocumentIssue[] };

export class SceneDocumentValidationError extends Error {
	readonly issue: SceneDocumentIssue;

	constructor(issue: SceneDocumentIssue) {
		super(`${issue.path} (${issue.code}): ${issue.message}`);
		this.name = 'SceneDocumentValidationError';
		this.issue = issue;
	}
}

export { cameraSceneConnectionTimingFailureReason } from './parse-document';

export type { SceneValidationOptions } from '../scene-validation';

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
	// P23.0b: an explicit `formatVersion` selects the world-local decoder; the
	// recognized legacy shape carries no formatVersion. Any other value is
	// rejected by name (never inferred from field shapes — H5 §10.1).
	let worldLocal = false;
	if ('formatVersion' in input) {
		if (input.formatVersion !== SCENE_WORLD_LOCAL_FORMAT_VERSION) {
			addIssue(
				issues,
				'$.formatVersion',
				'unsupported_format_version',
				`Unsupported Scene formatVersion ${JSON.stringify(input.formatVersion)}; recognized values: ${SCENE_WORLD_LOCAL_FORMAT_VERSION}`
			);
			return { success: false, issues };
		}
		worldLocal = true;
	}
	const rootKeys = [
		...(worldLocal ? (['formatVersion'] as const) : []),
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
			worldLocal,
			...validation
		})
	);
	const clusters = 'clusters' in input
		? parseArray('clusters', (value, path, target) => parseCluster(value, path, target, { worldLocal }))
		: undefined;
	const navigationNodes = parseArray('navigationNodes', (value, path, target) =>
		parseNode(value, path, target, { worldLocal })
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
	const document = {
		...(worldLocal ? { formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION } : {}),
		textures,
		materials,
		entities,
		...(clusters === undefined ? {} : { clusters }),
		navigationNodes,
		connections
	};
	if (worldLocal) {
		// P23.0b: world-local documents must not carry Room ownership anywhere.
		// Entities/nodes/clusters are rejected at parse time; connection-scoped
		// records (anchors, waypoints, view keys) are checked here in one place.
		for (const [index, connection] of document.connections.entries()) {
			const prefix = `$.connections[${index}]`;
			for (const [anchorIndex, anchor] of connection.positionPath.anchors.entries()) {
				if (anchor.roomId !== undefined) {
					addIssue(
						issues,
						`${prefix}.positionPath.anchors[${anchorIndex}].roomId`,
						'room_id_forbidden_in_world_local',
						'World-local scene documents must not carry roomId; convert legacy records instead'
					);
				}
			}
			for (const [waypointIndex, waypoint] of (connection.targetWaypoints ?? []).entries()) {
				if (waypoint.roomId !== undefined) {
					addIssue(
						issues,
						`${prefix}.targetWaypoints[${waypointIndex}].roomId`,
						'room_id_forbidden_in_world_local',
						'World-local scene documents must not carry roomId; convert legacy records instead'
					);
				}
			}
			for (const direction of ['forward', 'reverse'] as const) {
				for (const [keyframeIndex, keyframe] of (connection.viewTracks?.[direction] ?? []).entries()) {
					if (keyframe.roomId !== undefined) {
						addIssue(
							issues,
							`${prefix}.viewTracks.${direction}[${keyframeIndex}].roomId`,
							'room_id_forbidden_in_world_local',
							'World-local scene documents must not carry roomId; convert legacy records instead'
						);
					}
				}
			}
		}
	}
	validateSemantics(document, issues);
	if (issues.length) return { success: false, issues };
	const normalized = canonicalDocument(document);
	return { success: true, document: normalized, canonicalJson: JSON.stringify(normalized, null, 2) + '\n' };
}


function jsonErrorMessage(error: unknown, json: string) {
	const message = error instanceof Error ? error.message : 'Invalid JSON';
	const match = /position (\d+)/.exec(message);
	if (!match) return 'Invalid JSON';
	const offset = Number(match[1]);
	const before = json.slice(0, offset);
	const line = before.split('\n').length;
	const column = offset - before.lastIndexOf('\n');
	return `Invalid JSON near line ${line}, column ${column}.`;
}


export function parseSceneDocumentJson(
	json: string,
	options: SceneValidationOptions = {}
): SceneDocumentValidationResult {
	try {
		return validateSceneDocument(JSON.parse(json), options);
	} catch (error) {
		return { success: false, issues: [{ path: '$', code: 'invalid_json', message: jsonErrorMessage(error, json) }] };
	}
}


export function serializeSceneDocument(
	document: unknown,
	options: SceneValidationOptions = {}
): string {
	const result = validateSceneDocument(document, options);
	if (!result.success) throw new SceneDocumentValidationError(result.issues[0]!);
	return result.canonicalJson;
}
