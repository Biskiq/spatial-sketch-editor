/**
 * `compat-runtime.ts` — P23.0 F0 stage 4: one shared compatible runtime
 * preparation for editor Preview and the visitor cold path.
 *
 * Both bundle composers used to open with the legacy-only `validateProject`
 * + `compileLayoutGeometry` prologue, so a wall-first Project died in both
 * places with unrelated errors. This adapter runs the explicit compatible
 * decode (`decodeProjectCompatible`) once, then prepares the canonical
 * runtime/compile source per generation through the one shared geometry
 * core (`compileLayoutGeometrySource` under both entries):
 *
 * ```text
 * wall-first | migrated  → compileWallFirstLayoutGeometry + empty Room
 *                           registry + world-local Scene used directly
 * legacy-compatible       → compileLayoutGeometry + legacy Room registry +
 *                           Scene resolved through Room frames once
 * ```
 *
 * After this boundary every consumer operates on one runtime/world
 * representation. World-local Scenes carry no `roomId` (codec-enforced), so
 * `resolveSceneDocument` clones them without ever consulting a frame — never
 * a second Room transform. Pure and non-mutating: the stored input bytes are
 * never rewritten on cold load.
 */
import {
	compileLayoutGeometry,
	compileWallFirstLayoutGeometry,
	type CompiledLayoutGeometry,
	type LayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutGeometryIssue
} from '@portfolio/layout-core';
import {
	decodeProjectCompatible,
	type ProjectMigrationReport
} from './project-compat';
import {
	createEmptyLayoutRoomRegistry,
	createLayoutRoomRegistry,
	validateProjectSceneRooms,
	type LayoutRoomRegistry
} from './project-layout-semantics';
import {
	createNavigationGraph,
	resolveSceneDocument,
	type NavigationGraph,
	type RuntimeScene,
	type SceneDocument
} from './scene';
import type { SceneValidationOptions } from './scene-codec';
import type { ProjectIssue } from './project-types';

export type CompatibleRuntimeProject = {
	id: string;
	name: string;
	layout: LayoutDocument | LayoutDocumentWallFirst;
	scene: SceneDocument;
};

export type CompatibleRuntimeReady = {
	kind: 'ready';
	/** Which compatible decode produced this preparation. */
	decodeKind: 'wall-first' | 'migrated' | 'legacy-compatible';
	/** Coordinate space of the prepared Scene; consumers branch on this once. */
	sceneSpace: 'project-world' | 'legacy-room-local';
	project: CompatibleRuntimeProject;
	/** Compiled through the one shared core for every generation. */
	geometry: CompiledLayoutGeometry;
	/** Raw compiler issues (blocking or warning); callers gate on blocking. */
	issues: readonly LayoutGeometryIssue[];
	/** Legacy Room registry, or the empty registry for wall-first Layouts. */
	rooms: LayoutRoomRegistry;
	/** Runtime/world Scene: Room-frame resolution applied at most once. */
	runtimeScene: RuntimeScene;
	graph: NavigationGraph;
	/** Migration/identification diagnostics; present for migrated/compat. */
	report: ProjectMigrationReport | undefined;
};

export type CompatibleRuntimeRejection = {
	kind: 'rejected';
	reason: 'unrecognized' | 'invalid-references' | 'scene-invalid';
	issues: ProjectIssue[];
};

export type CompatibleRuntimePreparation = CompatibleRuntimeReady | CompatibleRuntimeRejection;

/**
 * Prepare a parsed Project payload for Preview/visitor runtime. Accepts every
 * recognized generation; rejects anything else with a named reason before any
 * consumer installs state. Never mutates the input.
 */
export function prepareCompatibleRuntime(
	input: unknown,
	sceneOptions: SceneValidationOptions = {}
): CompatibleRuntimePreparation {
	const decoded = decodeProjectCompatible(input);
	if (decoded.kind === 'unrecognized') {
		return { kind: 'rejected', reason: 'unrecognized', issues: decoded.issues };
	}

	const rooms =
		decoded.kind === 'legacy-compatible'
			? createLayoutRoomRegistry(decoded.project.layout)
			: createEmptyLayoutRoomRegistry();

	// Same cross-generation scene↔room reference gate the legacy
	// `validateProject` enforced: dangling `roomId`s fail closed here, never
	// as an unknown-room throw deep inside resolution.
	const referenceIssues = validateProjectSceneRooms(decoded.project.scene, rooms);
	if (referenceIssues.length > 0) {
		return { kind: 'rejected', reason: 'invalid-references', issues: referenceIssues };
	}

	const compiled =
		decoded.kind === 'legacy-compatible'
			? compileLayoutGeometry(decoded.project.layout)
			: compileWallFirstLayoutGeometry(decoded.project.layout);

	let runtimeScene: RuntimeScene;
	try {
		runtimeScene = resolveSceneDocument(decoded.project.scene, rooms, sceneOptions);
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
		decodeKind: decoded.kind,
		sceneSpace: decoded.sceneSpace,
		project: {
			id: decoded.project.id,
			name: decoded.project.name,
			layout: decoded.project.layout,
			scene: decoded.project.scene
		},
		geometry: compiled.geometry,
		issues: compiled.issues,
		rooms,
		runtimeScene,
		graph: createNavigationGraph(runtimeScene),
		report: decoded.kind === 'wall-first' ? undefined : decoded.report
	};
}
