/**
 * `wall-first-project.ts` — P23.0 F0 stage 2: canonical wall-first Project
 * writer.
 *
 * Stage-2 scope (P23.0 execution order, item 2): the Save half of the
 * canonical writers — a wall-first Layout (current
 * `LAYOUT_WALL_FIRST_FORMAT_VERSION`, `5` since P23.6H) plus a
 * world-local Scene (`formatVersion: 1`) serialized through one canonical
 * Project validation gate, with the portable package manifest versioned so
 * package orchestration can never dispatch on the generator string.
 *
 * **Gate boundary.** These writers are the canonical Save path after the F0
 * acceptance gate. The editor's wall-first transaction path and project
 * codec now select this format explicitly, and PR #115 (WP3) made it the only
 * format any reader accepts: there is no compatibility decoding left to fall
 * back to, so a payload that is not this pair fails in its own validator.
 */
import {
	validateWallFirstLayoutDocument,
	validateWallFirstPortalRelations,
	wallFirstCanonicalFormatVersionIssue,
	type LayoutDocumentWallFirst,
	type LayoutDocumentIssue
} from '@portfolio/layout-core';
import type { SceneDocument } from './scene';
import {
	serializeSceneDocument,
	validateSceneDocument,
	type SceneDocumentIssue
} from './scene-codec';
import type { ProjectIssue } from './project-types';

export type { LayoutDocumentWallFirst, SceneDocument };

/**
 * Canonical wall-first Save payload: `{ id, name, layout, scene }` with the
 * explicit format discriminators on both nested documents. The Project root
 * carries no second schema number: the only version discrimination lives on
 * the nested documents themselves.
 */
export type WallFirstProjectPayload = {
	id: string;
	name: string;
	layout: LayoutDocumentWallFirst;
	scene: SceneDocument;
};

export type WallFirstSaveIssue = ProjectIssue & {
	/** `layout` / `scene` — which nested decoder produced the issue. */
	side: 'layout' | 'scene';
};

export type WallFirstProjectValidationResult =
	| {
			success: true;
			/** The parsed canonical documents. */
			project: WallFirstProjectPayload;
			/** Canonical JSON of the whole payload (`JSON.stringify(payload, null, 2) + '\n'`). */
			canonicalJson: string;
			/** Canonical JSON of the wall-first Layout document alone. */
			layoutCanonicalJson: string;
			/** Canonical JSON of the world-local Scene document alone. */
			sceneCanonicalJson: string;
	  }
	| {
			success: false;
			issues: WallFirstSaveIssue[];
	  };

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

function toSaveIssue(
	side: 'layout' | 'scene',
	issue: LayoutDocumentIssue | SceneDocumentIssue
): WallFirstSaveIssue {
	return { ...issue, side };
}

/**
 * Rebase a nested document's issue onto the project root.
 *
 * The nested validators report root-relative paths (`$`, `$.formatVersion`), so
 * the leading `$` is replaced rather than concatenated: the previous form
 * doubled it (`$.scene$.formatVersion`) and made a Save-side issue impossible to
 * locate in the payload it described.
 */
function prefixIssue(
	prefix: string,
	issue: LayoutDocumentIssue | SceneDocumentIssue
): LayoutDocumentIssue | SceneDocumentIssue {
	return {
		...issue,
		path: issue.path === '$' ? prefix : `${prefix}${issue.path.slice(1)}`
	};
}

/**
 * Validate a wall-first Save payload: the Layout must decode through the
 * wall-first codec **at the current canonical format** (P23.6H: a historical
 * `formatVersion: 4` payload is rejected by name here) and the Scene through
 * the current-format Scene validator (`formatVersion: 1`).
 *
 * PR #115 (WP3) — the writers are current-format-only, like the readers, and
 * reach the validators directly: there is no generation identification step, no
 * migration and no Save-side normalization, so a payload the reader would refuse
 * cannot become writable here.
 */
export function validateWallFirstProject(input: unknown): WallFirstProjectValidationResult {
	const issues: WallFirstSaveIssue[] = [];
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		return {
			success: false,
			issues: [
				{ side: 'layout', path: '$', code: 'invalid_type', message: 'Expected a project object' }
			]
		};
	}
	const record = input as Record<string, unknown>;
	for (const key of Object.keys(record)) {
		if (key !== 'id' && key !== 'name' && key !== 'layout' && key !== 'scene') {
			issues.push({
				side: 'layout',
				path: `$.${key}`,
				code: 'unknown_key',
				message: `Unknown key '${key}'`
			});
		}
	}
	const id = record.id;
	if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
		issues.push({
			side: 'layout',
			path: '$.id',
			code: 'invalid_id',
			message: 'Expected an ID matching /^[A-Za-z0-9][A-Za-z0-9._:-]*$/'
		});
	}
	const name = record.name;
	if (typeof name !== 'string' || name.trim().length === 0) {
		issues.push({
			side: 'layout',
			path: '$.name',
			code: 'invalid_value',
			message: 'Expected a non-empty name'
		});
	}
	const validatedId = typeof id === 'string' ? id : '';
	const validatedName = typeof name === 'string' ? name : '';
	if (record.layout === undefined || record.scene === undefined) {
		issues.push({
			side: 'layout',
			path: '$',
			code: 'missing_field',
			message: 'Expected both layout and scene documents'
		});
		return { success: false, issues };
	}

	const layout = validateWallFirstLayoutDocument(record.layout);
	if (!layout.success) {
		issues.push(...layout.issues.map((issue) => toSaveIssue('layout', prefixIssue('$.layout', issue))));
	}

	// P23.6H (S1b): the canonical Save writer requires canonical current-format
	// state. A non-current wall-first payload rejects by name here instead of
	// being persisted with a superseded field meaning — there is no
	// normalization seam: v5 is the only recognized wall-first version and a
	// `4` payload fails as `unsupported_format_version` on every boundary
	// (pre-baseline policy).
	const layoutVersionIssue = wallFirstCanonicalFormatVersionIssue(record.layout);
	if (layoutVersionIssue) {
		issues.push(toSaveIssue('layout', prefixIssue('$.layout', layoutVersionIssue)));
	}

	// The Scene half reads through the current-format validator directly, so the
	// Save gate and the read gate cannot drift apart: anything the reader would
	// refuse (a missing or non-current `formatVersion`, room-owned records) is
	// refused here with the same issue.
	const scene = validateSceneDocument(record.scene);
	if (!scene.success) {
		issues.push(...scene.issues.map((issue) => toSaveIssue('scene', prefixIssue('$.scene', issue))));
	}

	if (!layout.success || !scene.success || issues.length > 0) {
		return { success: false, issues };
	}

	// P23.0 portal Save-blocker (F0 stage 5): a legacy nonadjacent relation
	// stays compatibility-readable on the read path, but new-schema Save
	// requires the strict P23.3 adjacency contract — resolve or remove the
	// relation first. This runs after the codec gate so endpoint existence is
	// already established; adjacency is the Save-side rule, never a codec rule.
	const portalIssues = validateWallFirstPortalRelations(layout.document);
	if (portalIssues.length > 0) {
		return {
			success: false,
			issues: portalIssues.map((issue) => ({
				side: 'layout' as const,
				path: `$.layout${issue.path.slice(1)}`,
				code: issue.code,
				message: issue.message
			}))
		};
	}

	const project: WallFirstProjectPayload = {
		id: validatedId,
		name: validatedName,
		layout: layout.document,
		scene: scene.document
	};
	return {
		success: true,
		project,
		canonicalJson: JSON.stringify(project, null, 2) + '\n',
		layoutCanonicalJson: layout.canonicalJson,
		sceneCanonicalJson: serializeSceneDocument(scene.document)
	};
}

/** Strict canonical serialization. Throws on invalid input. */
export class WallFirstProjectValidationError extends Error {
	readonly issue: WallFirstSaveIssue;
	constructor(issue: WallFirstSaveIssue) {
		super(`${issue.path} (${issue.code}): ${issue.message}`);
		this.name = 'WallFirstProjectValidationError';
		this.issue = issue;
	}
}

/**
 * Canonical wall-first Save writer: validate then serialize. Returns the
 * canonical whole-project JSON plus the per-document canonical JSON strings
 * the persistence layers store alongside the payload.
 */
export function serializeWallFirstProject(payload: unknown): {
	canonicalJson: string;
	layoutCanonicalJson: string;
	sceneCanonicalJson: string;
} {
	const result = validateWallFirstProject(payload);
	if (!result.success) {
		throw new WallFirstProjectValidationError(result.issues[0] ?? {
			side: 'layout',
			path: '$',
			code: 'invalid_payload',
			message: 'Wall-first project validation failed'
		});
	}
	return {
		canonicalJson: result.canonicalJson,
		layoutCanonicalJson: result.layoutCanonicalJson,
		sceneCanonicalJson: result.sceneCanonicalJson
	};
}
