/**
 * `scene-format.ts` — P23.0a explicit Scene format identification.
 *
 * The Scene counterpart of Layout's `formatVersion` dispatch (P23.0 child
 * plan, "target schema and identification" required policy):
 *
 * - the **new** (world-local) Scene shape carries the explicit discriminator
 *   `formatVersion: 1` (P23.0b) and routes to the world-local decoder;
 *   every other explicit value is rejected as an unsupported version rather
 *   than guessed at;
 * - a payload **without** `formatVersion` is accepted only through the
 *   explicit recognized legacy decoder (`validateSceneDocument`, the current
 *   room-local shape). Missing version never silently means "whatever
 *   parses";
 * - schema version is never inferred from presence/absence of arbitrary
 *   fields (H5 §10.1).
 *
 * Separation note (P23.0 required policy): the portable package manifest's
 * generator string and package format are **separate concepts** from this
 * nested Scene schema version — package orchestration must never dispatch on
 * the generator string, and this module never reads package data.
 */
import { SCENE_WORLD_LOCAL_FORMAT_VERSION, type SceneDocument } from './scene';
import type { SceneDocumentIssue } from './scene-codec';
import { validateSceneDocument } from './scene-codec';

/** Where Scene physical values must still be resolved from. */
export type SceneCoordinateSpace = 'legacy-room-local' | 'project-world';

export type RecognizedLegacySceneDecode = {
	kind: 'recognized-legacy';
	/** Recognized legacy room-local compatibility shape (versionless). */
	document: SceneDocument;
	/** Legacy Scene/Camera values require Room-frame resolution. */
	sceneSpace: 'legacy-room-local';
};

export type WorldLocalSceneDecode = {
	kind: 'world-local';
	/** New canonical world-local Scene document (`formatVersion: 1`). */
	document: SceneDocument;
	/** World-local values are runtime-final; no Room resolution. */
	sceneSpace: 'project-world';
};

export type UnrecognizedSceneDecode = {
	kind: 'unrecognized';
	reason: 'invalid-json-payload' | 'legacy-invalid' | 'unsupported-format-version';
	issues: SceneDocumentIssue[];
};

export type SceneFormatIdentification =
	| RecognizedLegacySceneDecode
	| WorldLocalSceneDecode
	| UnrecognizedSceneDecode;

/**
 * Identify a parsed Scene payload's format explicitly.
 *
 * `formatVersion: 1` routes to the world-local decoder (P23.0b); a missing
 * `formatVersion` routes to the recognized legacy room-local decoder; any
 * other explicit value is rejected with `unsupported-format-version`.
 */
export function identifySceneFormat(input: unknown): SceneFormatIdentification {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		return {
			kind: 'unrecognized',
			reason: 'invalid-json-payload',
			issues: [
				{ path: '$', code: 'invalid_type', message: 'Expected a scene document object' }
			]
		};
	}
	if ('formatVersion' in input) {
		if (input.formatVersion === SCENE_WORLD_LOCAL_FORMAT_VERSION) {
			const worldLocal = validateSceneDocument(input);
			if (worldLocal.success) {
				return {
					kind: 'world-local',
					document: worldLocal.document,
					sceneSpace: 'project-world'
				};
			}
			return { kind: 'unrecognized', reason: 'legacy-invalid', issues: worldLocal.issues };
		}
		return {
			kind: 'unrecognized',
			reason: 'unsupported-format-version',
			issues: [
				{
					path: '$.formatVersion',
					code: 'unsupported_format_version',
					message: `Unsupported Scene formatVersion ${JSON.stringify(input.formatVersion)}; recognized values: ${SCENE_WORLD_LOCAL_FORMAT_VERSION} (world-local) and missing (recognized legacy)`
				}
			]
		};
	}
	const legacy = validateSceneDocument(input);
	if (legacy.success) {
		return { kind: 'recognized-legacy', document: legacy.document, sceneSpace: 'legacy-room-local' };
	}
	return { kind: 'unrecognized', reason: 'legacy-invalid', issues: legacy.issues };
}
