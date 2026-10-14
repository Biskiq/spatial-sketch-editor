import {
	createEmptyWallFirstLayoutDocument,
	validateWallFirstLayoutDocument
} from '@portfolio/layout-core';
import { createEmptyWorldLocalSceneDocument } from './scene';
import {
	validateSceneDocument,
	type SceneDocumentValidationResult,
	type SceneValidationOptions
} from './scene-codec';
import { validateProjectSceneCameraPoses } from './project-layout-semantics';
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
 * Authoring-empty project — the canonical new-project boot.
 *
 * One valid empty wall-first Layout (current format, `formatVersion: 5`) plus
 * one valid empty world-local Scene (`formatVersion: 1`): the pair the readers
 * accept, and the pair the writers emit. Booting it is what makes the wall-first
 * Layout path (canonical Junctions/Walls/Rooms/Openings) reachable without
 * importing JSON.
 *
 * `ProjectDocument` names this pair directly, so the boot value needs no cast
 * to cross the codec boundary.
 */
export function createEmptyWallFirstProject(input: EmptyProjectInput): Project {
	return {
		id: input.id,
		name: input.name,
		layout: createEmptyWallFirstLayoutDocument(),
		scene: createEmptyWorldLocalSceneDocument()
	};
}

/**
 * Read a Project document.
 *
 * PR #115 (WP3) — current-format-only. There is exactly one supported document
 * pair: a wall-first Layout (`formatVersion: 5`) and a world-local Scene
 * (`formatVersion: 1`). Both halves go straight to their current-format
 * validators; there is no generation dispatch, no migration branch and no
 * compatibility fallback, and nothing about the payload's shape is inferred
 * from which keys happen to be present.
 *
 * Malformed, incomplete or unsupported input still fails, through those same
 * ordinary validators: no schema rule is relaxed, no unknown field or missing
 * `formatVersion` is tolerated, and no malformed document gains a path to
 * success. The failure message is the validator's own.
 */
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
	const layoutResult = validateWallFirstLayoutDocument(input.layout);
	const sceneResult = validateSceneDocument(input.scene, options.scene);
	issues.push(...prefixIssues('$.layout', layoutResult));
	issues.push(...prefixIssues('$.scene', sceneResult));
	if (layoutResult.success && sceneResult.success) {
		issues.push(...validateProjectSceneCameraPoses(sceneResult.document));
	}
	if (!id || !name || !layoutResult.success || !sceneResult.success || issues.length > 0) {
		return { success: false, issues };
	}
	const project: ProjectDocument = {
		id,
		name,
		layout: layoutResult.document,
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
 * Canonical project writer: validate against the current format, then serialize.
 *
 * The gate is the current-format validator itself — there is no separate
 * generation check to keep in step with it. A Layout that declares any version
 * other than the single current one, and a Scene that is not world-local, are
 * reported by their own validators (`unsupported_format_version`,
 * `invalid_type`) rather than by a project-level compatibility rule, and a
 * document that fails never reaches storage.
 */
export function serializeProject(
	project: unknown,
	options: ProjectValidationOptions = {}
): string {
	const result = validateProject(project, options);
	if (!result.success) throw new ProjectValidationError(result.issues[0]!);
	return result.canonicalJson;
}

function prefixIssues(
	prefix: '$.layout' | '$.scene',
	result:
		| ReturnType<typeof validateWallFirstLayoutDocument>
		| SceneDocumentValidationResult
): ProjectIssue[] {
	if (result.success) return [];
	return result.issues.map((item) => ({
		...item,
		path: item.path === '$' ? prefix : `${prefix}${item.path.slice(1)}`
	}));
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
