/**
 * `runtime.ts` — one current-format runtime preparation for every consumer that
 * installs a parsed Project: the visitor cold path today, and whatever route
 * next needs a compiled, resolved project.
 *
 * PR #115 (WP3) — current-format-only. There is exactly one supported document
 * pair (wall-first Layout, `formatVersion: 5`; world-local Scene,
 * `formatVersion: 1`), so this module opens through the project's one canonical
 * validator (`validateProject`) instead of a compatible decode: no generation
 * dispatch, no migration, no compatibility branch and no decode report. A
 * payload that is not the current pair — including an unknown root key — is
 * rejected with that validator's own issues before any consumer installs state,
 * and the input is never mutated.
 *
 * Preparation is a pure read: the Layout compiles through the one shared
 * geometry core (`compileWallFirstLayoutGeometry`) and the Scene resolves to
 * runtime values exactly once. Because a current-format Scene carries no Room
 * ownership, resolution consults no Room frame; the registry handed to
 * consumers is the empty current-format registry.
 */
import {
	compileWallFirstLayoutGeometry,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutGeometryIssue
} from '@portfolio/layout-core';
import { validateProject } from './project-codec';
import { createEmptyLayoutRoomRegistry, type LayoutRoomRegistry } from './project-layout-semantics';
import {
	createNavigationGraph,
	resolveSceneDocument,
	type NavigationGraph,
	type RuntimeScene,
	type SceneDocument
} from './scene';
import type { SceneValidationOptions } from './scene-codec';
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

/**
 * Prepare a Project payload for a runtime. Accepts the current format only,
 * through the project's canonical validator: `validateProject` owns the root
 * shape (unknown keys included), the id, the name, both nested documents and
 * the project-level Camera-pose rule, so runtime preparation cannot drift from
 * what the persisted-document readers and writers accept. Anything that is not
 * the current document pair is rejected with the validator's own named issues
 * before any consumer installs state. Never mutates the input.
 */
export function prepareRuntime(
	input: unknown,
	sceneOptions: SceneValidationOptions = {}
): RuntimePreparation {
	const validated = validateProject(input, { scene: sceneOptions });
	if (!validated.success) {
		return { kind: 'rejected', reason: 'invalid-project', issues: validated.issues };
	}
	const { project } = validated;

	const compiled = compileWallFirstLayoutGeometry(project.layout);

	let runtimeScene: RuntimeScene;
	try {
		runtimeScene = resolveSceneDocument(project.scene, sceneOptions);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Scene preparation failed';
		return {
			kind: 'rejected',
			reason: 'scene-invalid',
			issues: [{ path: '$.scene', code: 'scene_invalid', message }]
		};
	}

	return {
		kind: 'ready',
		project,
		geometry: compiled.geometry,
		issues: compiled.issues,
		rooms: createEmptyLayoutRoomRegistry(),
		runtimeScene,
		graph: createNavigationGraph(runtimeScene)
	};
}
