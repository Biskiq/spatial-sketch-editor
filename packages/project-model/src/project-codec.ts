import {
	createEmptyLayoutDocument,
	createEmptyWallFirstLayoutDocument,
	validateLayoutDocument,
	wallFirstCanonicalFormatVersionIssue,
	type LayoutValidationResult
} from '@portfolio/layout-core';
import { validateWallFirstLayoutDocument } from '@portfolio/layout-core';
import { createEmptySceneDocument, createEmptyWorldLocalSceneDocument } from './scene';
import {
	validateSceneDocument,
	type SceneDocumentValidationResult,
	type SceneValidationOptions
} from './scene-codec';
import { createLayoutRoomRegistry, validateProjectSceneRooms } from './project-layout-semantics';
import type {
	Project,
	ProjectDocument,
	ProjectIssue,
	ProjectValidationResult
} from './project-types';

export type ProjectValidationOptions = {
	scene?: SceneValidationOptions;
};

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const ROOT_KEYS = ['id', 'name', 'layout', 'scene'] as const;
type JsonRecord = Record<string, unknown>;

export type ProjectInput = {
	id: string;
	name: string;
	layout: unknown;
	scene: unknown;
};

export class ProjectValidationError extends Error {
	readonly issue: ProjectIssue;
	constructor(issue: ProjectIssue) {
		super(`${issue.path} (${issue.code}): ${issue.message}`);
		this.name = 'ProjectValidationError';
		this.issue = issue;
	}
}

export function createProject(input: ProjectInput, options: ProjectValidationOptions = {}): Project {
	const result = validateProject(input, options);
	if (!result.success) throw new ProjectValidationError(result.issues[0]!);
	return result.project;
}

export type EmptyProjectInput = {
	id: string;
	name: string;
};

/**
 * Authoring-empty project: one valid empty layout + one valid empty scene.
 * This is the editor's boot state. There is no New Project command — importing
 * a package is the only way to load prior work, and export is the only save.
 */
export function createEmptyProject(input: EmptyProjectInput): Project {
	return {
		id: input.id,
		name: input.name,
		layout: createEmptyLayoutDocument(),
		scene: createEmptySceneDocument()
	};
}

/**
 * Authoring-empty WALL-FIRST project — the canonical new-project boot.
 *
 * One valid empty wall-first Layout (current `LAYOUT_WALL_FIRST_FORMAT_VERSION`,
 * `5` since P23.6H) plus one valid empty
 * world-local Scene (`formatVersion: 1`): the pair `validateProject` requires,
 * since a wall-first Layout carrying the recognized legacy Scene is rejected
 * by name. Booting the canonical pair is what makes the wall-first Layout path
 * (canonical Junctions/Walls/Rooms/Openings) reachable without importing JSON,
 * while `createEmptyProject` keeps returning the legacy pair for the legacy
 * read path and compatibility fixtures.
 */
export function createEmptyWallFirstProject(input: EmptyProjectInput): Project {
	return {
		id: input.id,
		name: input.name,
		// The public `Project` document type stays the legacy compatibility
		// shape; a wall-first payload is carried through this boundary unchanged
		// at runtime and typed by the compatible runtime/save seams (same cast
		// `validateProject` performs).
		layout: createEmptyWallFirstLayoutDocument() as unknown as Project['layout'],
		scene: createEmptyWorldLocalSceneDocument()
	};
}

export function validateProject(
	input: unknown,
	options: ProjectValidationOptions = {}
): ProjectValidationResult {
	const issues: ProjectIssue[] = [];
	if (!record(input)) return { success: false, issues: [issue('$', 'invalid_type', 'Expected a project object')] };
	for (const key of Object.keys(input)) {
		if (!ROOT_KEYS.includes(key as (typeof ROOT_KEYS)[number])) {
			issues.push(issue(`$.${key}`, 'unknown_key', `Unknown key '${key}'`));
		}
	}
	const id = readId(input.id, '$.id', issues);
	const name = readName(input.name, '$.name', issues);
	const wallFirstLayout = isWallFirstLayoutValue(input.layout);
	const layoutResult = wallFirstLayout
		? validateWallFirstLayoutDocument(input.layout)
		: validateLayoutDocument(input.layout);
	const sceneResult = validateSceneDocument(input.scene, options.scene);
	issues.push(...prefixIssues('$.layout', layoutResult));
	issues.push(...prefixIssues('$.scene', sceneResult));
	if (wallFirstLayout && !isWorldLocalSceneValue(input.scene)) {
		issues.push(issue('$.scene.formatVersion', 'scene_not_world_local', 'Wall-first projects require a world-local Scene (formatVersion: 1)'));
	}
	if (layoutResult.success && sceneResult.success) {
		issues.push(...validateProjectSceneRooms(sceneResult.document, createLayoutRoomRegistry(layoutResult.document)));
	}
	if (!id || !name || !layoutResult.success || !sceneResult.success || issues.length > 0) {
		return { success: false, issues };
	}
	const project: ProjectDocument = {
		id,
		name,
		// The public legacy ProjectDocument type remains source-compatible for
		// the editor's existing legacy consumers. A wall-first payload is
		// carried through this compatibility boundary unchanged at runtime and
		// is typed by the compatible runtime/save seams.
		layout: layoutResult.document as ProjectDocument['layout'],
		scene: sceneResult.document
	};
	return { success: true, project, canonicalJson: JSON.stringify(project, null, 2) + '\n' };
}

export function parseProjectJson(
	json: string,
	options: ProjectValidationOptions = {}
): ProjectValidationResult {
	try {
		return validateProject(JSON.parse(json) as unknown, options);
	} catch (error) {
		return { success: false, issues: [issue('$', 'invalid_json', invalidJsonMessage(error, json))] };
	}
}

/**
 * P23.6H (S1b) — the canonical **writer** gate for the wall-first Layout half of
 * a project payload.
 *
 * Boundary, stated explicitly so there are not two silent writer contracts:
 *
 * - `validateProject()` / `parseProjectJson()` are **readers** and stay
 *   tolerant on purpose — a stored legacy (Room-owned, version-less) release
 *   must remain loadable, and `apps/api/src/publication-persistence.ts`
 *   validates already-persisted releases through `validateProject()`.
 * - `serializeProject()` (and the editor facade that re-exports it) is a
 *   **writer**: a Layout that declares a version other than the single current
 *   canonical one rejects here by name instead of being emitted unchanged. There
 *   is no read-side normalization seam to point at: P23.6I recognizes exactly one
 *   wall-first version (`5`) and a `4` payload fails as an unsupported version
 *   rather than being migrated (`docs/north-star.md` → *Development-stage schema
 *   compatibility*).
 * - A legacy (Room-owned, version-less) Layout is a different shape and is not
 *   gated here: the wall-first gate applies only when the payload declares a
 *   Layout format version. That path is retained **temporarily** for internal
 *   development assets — a development dependency, not a compatibility promise
 *   (`docs/north-star.md` → *Development-stage schema compatibility*).
 *   Retirement is tracked by GitHub Issue #26 and is explicitly post-P23, not a
 *   silent consequence of this gate.
 *
 * `createProject()` stays a tolerant constructor (it returns the validated
 * document and writes nothing); the one rule is exported so any other writer can
 * adopt it without re-deriving the version policy.
 */
export function wallFirstCanonicalProjectFormatIssue(
	project: unknown
): ProjectIssue | undefined {
	if (!record(project)) return undefined;
	const layout = project.layout;
	// Only a Layout that *declares* a format version is a wall-first payload; a
	// version-less Layout is the legacy Room-owned shape, which this gate does
	// not judge (structural validation owns that report).
	if (!record(layout) || !('formatVersion' in layout)) return undefined;
	const gate = wallFirstCanonicalFormatVersionIssue(layout);
	if (!gate) return undefined;
	return issue(`$.layout${gate.path.slice(1)}`, gate.code, gate.message);
}

export function serializeProject(
	project: unknown,
	options: ProjectValidationOptions = {}
): string {
	const writerIssue = wallFirstCanonicalProjectFormatIssue(project);
	if (writerIssue) throw new ProjectValidationError(writerIssue);
	const result = validateProject(project, options);
	if (!result.success) throw new ProjectValidationError(result.issues[0]!);
	return result.canonicalJson;
}

function prefixIssues(
	prefix: '$.layout' | '$.scene',
	result:
		| LayoutValidationResult
		| ReturnType<typeof import('@portfolio/layout-core')['validateWallFirstLayoutDocument']>
		| SceneDocumentValidationResult
): ProjectIssue[] {
	if (result.success) return [];
	return result.issues.map((item) => ({
		...item,
		path: item.path === '$' ? prefix : `${prefix}${item.path.slice(1)}`
	}));
}

function isWallFirstLayoutValue(input: unknown): boolean {
	return record(input) && 'formatVersion' in input;
}

function isWorldLocalSceneValue(input: unknown): boolean {
	return record(input) && input.formatVersion === 1;
}

function record(value: unknown): value is JsonRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readId(value: unknown, path: string, issues: ProjectIssue[]): string | undefined {
	if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
		issues.push(issue(path, 'invalid_id', 'Expected an ID matching /^[A-Za-z0-9][A-Za-z0-9._:-]*$/'));
		return undefined;
	}
	return value;
}

function readName(value: unknown, path: string, issues: ProjectIssue[]): string | undefined {
	if (typeof value !== 'string') {
		issues.push(issue(path, 'invalid_type', 'Expected a string'));
		return undefined;
	}
	if (value.trim().length === 0) {
		issues.push(issue(path, 'invalid_value', 'Expected a non-empty string'));
		return undefined;
	}
	return value;
}

function issue(path: string, code: string, message: string): ProjectIssue {
	return { path, code, message };
}

function invalidJsonMessage(error: unknown, json: string): string {
	const message = error instanceof Error ? error.message : 'Invalid JSON';
	const match = /position (\d+)/.exec(message);
	if (!match) return 'Invalid JSON';
	const offset = Number(match[1]);
	const before = json.slice(0, offset);
	const line = before.split('\n').length;
	const column = offset - before.lastIndexOf('\n');
	return `Invalid JSON near line ${line}, column ${column}.`;
}
