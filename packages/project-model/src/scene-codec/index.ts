/**
 * `scene-codec/index.ts` — public surface for the scene document codec.
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
 *   - `./types`         — issue, result and error types
 *   - `./validate`      — document and artwork-library validation
 *
 * Public surface frozen to: `SceneDocumentIssue`,
 * `SceneDocumentValidationResult`, `SceneDocumentValidationError`,
 * `cameraSceneConnectionTimingFailureReason`, `validateSceneDocument`,
 * `parseSceneDocumentJson`, `serializeSceneDocument`. Everything else is
 * `@internal` and consumers should not import the sibling modules
 * directly.
 */
import type { SceneValidationOptions } from '../scene-validation';
import { SceneDocumentValidationError as ValidationError, type SceneDocumentValidationResult } from './types';
import { validateSceneDocument as validate } from './validate';

export { cameraSceneConnectionTimingFailureReason } from './parse-document';
export { SceneDocumentValidationError, type SceneDocumentIssue, type SceneDocumentValidationResult } from './types';
export type { SceneValidationOptions } from '../scene-validation';
export { validateArtworkLibrary, validateSceneDocument } from './validate';

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
		return validate(JSON.parse(json), options);
	} catch (error) {
		return { success: false, issues: [{ path: '$', code: 'invalid_json', message: jsonErrorMessage(error, json) }] };
	}
}

export function serializeSceneDocument(
	document: unknown,
	options: SceneValidationOptions = {}
): string {
	const result = validate(document, options);
	if (!result.success) throw new ValidationError(result.issues[0]!);
	return result.canonicalJson;
}
