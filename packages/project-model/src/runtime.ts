/**
 * `runtime.ts` — one current-format runtime preparation for every consumer that
 * installs a parsed Project: the visitor cold path today, and whatever route
 * next needs a compiled, resolved project.
 *
 * PR #115 (WP3) — current-format-only. There is exactly one supported document
 * pair (wall-first Layout, `formatVersion: 5`; world-local Scene,
 * `formatVersion: 1`), so this module opens with those two validators directly
 * instead of a compatible decode: no generation dispatch, no migration, no
 * compatibility branch and no decode report. A payload that is not the current
 * pair is rejected with its validators' own issues before any consumer installs
 * state, and the input is never mutated.
 *
 * Preparation is a pure read: the Layout compiles through the one shared
 * geometry core (`compileWallFirstLayoutGeometry`) and the Scene resolves to
 * runtime values exactly once. Because a current-format Scene carries no Room
 * ownership, resolution consults no Room frame; the registry handed to
 * consumers is the empty current-format registry.
 */
import {
	compileWallFirstLayoutGeometry,
	validateWallFirstLayoutDocument,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutGeometryIssue
} from '@portfolio/layout-core';
import {
	createEmptyLayoutRoomRegistry,
	validateProjectSceneCameraPoses,
	type LayoutRoomRegistry
} from './project-layout-semantics';
import {
	createNavigationGraph,
	resolveSceneDocument,
	type NavigationGraph,
	type RuntimeScene,
	type SceneDocument
} from './scene';
import { validateSceneDocument, type SceneValidationOptions } from './scene-codec';
import type { ProjectIssue } from './project-types';

export type RuntimeProject = {
	id: string;
	name: string;
	layout: LayoutDocumentWallFirst;
	scene: SceneDocument;
};

export type RuntimeReady = {
	kind: 'ready';
	project: RuntimeProject;
	/** Compiled through the one shared geometry core. */
	geometry: CompiledLayoutGeometry;
	/** Raw compiler issues (blocking or warning); callers gate on blocking. */
	issues: readonly LayoutGeometryIssue[];
	/**
	 * The current-format Room registry: empty. Room-keyed lookups throw, so a
	 * record that still names a room fails loudly instead of transforming twice.
	 */
	rooms: LayoutRoomRegistry;
	/** Runtime/world Scene: values are already final, cloned once. */
	runtimeScene: RuntimeScene;
	graph: NavigationGraph;
};

export type RuntimeRejection = {
	kind: 'rejected';
	reason: 'invalid-project' | 'scene-invalid';
	issues: ProjectIssue[];
};

export type RuntimePreparation = RuntimeReady | RuntimeRejection;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

/**
 * Prepare a Project payload for a runtime. Accepts the current format only;
 * rejects anything else with the validator's own named reason before any
 * consumer installs state. Never mutates the input.
 */
export function prepareRuntime(
	input: unknown,
	sceneOptions: SceneValidationOptions = {}
): RuntimePreparation {
	if (typeof input !== 'object' || input === null || Array.isArray(input)) {
		return rejected([issue('$', 'invalid_type', 'Expected a project object')]);
	}
	const record = input as Record<string, unknown>;
	const id = record.id;
	if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
		return rejected([
			issue('$.id', 'invalid_id', 'Expected an ID matching /^[A-Za-z0-9][A-Za-z0-9._:-]*$/')
		]);
	}
	const name = record.name;
	if (typeof name !== 'string' || name.trim().length === 0) {
		return rejected([issue('$.name', 'invalid_value', 'Expected a non-empty name')]);
	}

	const layout = validateWallFirstLayoutDocument(record.layout);
	if (!layout.success) return rejected(prefixIssues('$.layout', layout.issues));

	const scene = validateSceneDocument(record.scene, sceneOptions);
	if (!scene.success) return rejected(prefixIssues('$.scene', scene.issues));

	// One project-level rule the codec cannot express on its own.
	const poseIssues = validateProjectSceneCameraPoses(scene.document);
	if (poseIssues.length > 0) return rejected(poseIssues);

	const compiled = compileWallFirstLayoutGeometry(layout.document);

	let runtimeScene: RuntimeScene;
	try {
		runtimeScene = resolveSceneDocument(scene.document, sceneOptions);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Scene preparation failed';
		return {
			kind: 'rejected',
			reason: 'scene-invalid',
			issues: [issue('$.scene', 'scene_invalid', message)]
		};
	}

	return {
		kind: 'ready',
		project: {
			id,
			name,
			layout: layout.document,
			scene: scene.document
		},
		geometry: compiled.geometry,
		issues: compiled.issues,
		rooms: createEmptyLayoutRoomRegistry(),
		runtimeScene,
		graph: createNavigationGraph(runtimeScene)
	};
}

function rejected(issues: ProjectIssue[]): RuntimeRejection {
	return { kind: 'rejected', reason: 'invalid-project', issues };
}

function prefixIssues(
	prefix: '$.layout' | '$.scene',
	issues: readonly { path: string; code: string; message: string }[]
): ProjectIssue[] {
	return issues.map((item) => ({
		...item,
		path: item.path === '$' ? prefix : `${prefix}${item.path.slice(1)}`
	}));
}

function issue(path: string, code: string, message: string): ProjectIssue {
	return { path, code, message };
}
