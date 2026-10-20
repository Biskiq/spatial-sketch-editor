/**
 * F.2 unit runtime preparation — the one live read path for an admitted project.
 *
 * The Layout compiles through the one canonical geometry core. The Scene 2
 * payload resolves through the landed Scene resolver. The **Camera unit**, not
 * the Scene, supplies the navigation graph: views become navigation nodes and
 * the Camera connections stay Camera-owned records. A source that the editor
 * shows is therefore exactly a source the visitor can prepare.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */

import {
	compileWallFirstLayoutGeometry,
	type CompiledLayoutGeometry,
	type LayoutGeometryIssue
} from '@portfolio/layout-core';
import { createEmptyLayoutRoomRegistry, type LayoutRoomRegistry } from '../project-layout-semantics';
import {
	createNavigationGraph,
	resolveSceneDocument,
	SCENE_WORLD_LOCAL_FORMAT_VERSION,
	type NavigationGraph,
	type RuntimeScene,
	type SceneConnection,
	type SceneDocument
} from '../scene';
import type { SceneValidationOptions } from '../scene-codec';
import type { ShapeIssue } from '../strict-shape';
import type {
	CameraFreeSceneDocument,
	CameraUnitPayload,
	ProjectEnvelope
} from './types';
import {
	validateProjectEnvelope,
	type EnvelopeClosureFinding,
	type EnvelopeDiagnostic
} from './validate';

export type UnitRuntimeReady = {
	readonly kind: 'ready';
	readonly envelope: ProjectEnvelope;
	readonly geometry: CompiledLayoutGeometry;
	readonly issues: readonly LayoutGeometryIssue[];
	/**
	 * Repairable authored bindings the envelope does not resolve yet. They are
	 * disclosed, never rewritten into a fabricated resolution, and do not block
	 * preparation or admission.
	 */
	readonly diagnostics: readonly EnvelopeDiagnostic[];
	/**
	 * Executable resource requirements the envelope cannot satisfy. This is a
	 * separate answer from structural refusal: the source can be read and shown,
	 * but execution (F4 acceptance, Save, release) must refuse it.
	 */
	readonly closure: readonly EnvelopeClosureFinding[];
	readonly rooms: LayoutRoomRegistry;
	readonly runtimeScene: RuntimeScene;
	readonly graph: NavigationGraph;
};

export type UnitRuntimeRejection = {
	readonly kind: 'rejected';
	readonly reason: 'invalid-envelope' | 'scene-invalid';
	readonly issues: readonly ShapeIssue[];
};

export type UnitRuntimePreparation = UnitRuntimeReady | UnitRuntimeRejection;

/**
 * Build the Scene 1 view of an envelope for the landed resolver.
 *
 * Scene 1 is not a second source: this value is a transient read projection built
 * from the two authored units, never installed, serialized or accepted. The
 * resolved graph is the Camera unit's own connectivity, and the Scene entity
 * records are the Scene unit's own records.
 */
function sceneProjectionForRuntime(
	scene: CameraFreeSceneDocument,
	camera: CameraUnitPayload
): SceneDocument {
	return {
		formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION,
		textures: scene.textures,
		materials: scene.materials,
		entities: scene.entities,
		...(scene.clusters === undefined ? {} : { clusters: scene.clusters }),
		navigationNodes: camera.views.map((view) => ({
			id: view.id,
			label: view.label,
			position: [...view.eye] as [number, number, number],
			cameraTarget: [...view.target] as [number, number, number],
			fov: view.fov,
			connectedNodeIds: [...view.connectedViewIds]
		})),
		connections: camera.connections as SceneConnection[]
	};
}

/**
 * Validate and prepare one envelope for a live runtime.
 *
 * Structural validation is `validateProjectEnvelope`; preparation is the one
 * canonical compile plus the one Scene resolve. Blocking Layout issues are
 * returned, not swallowed: the caller decides whether they block its surface.
 */
export function prepareUnitRuntime(
	input: unknown,
	sceneOptions: SceneValidationOptions = {}
): UnitRuntimePreparation {
	const validated = validateProjectEnvelope(input);
	if (!validated.success) {
		return { kind: 'rejected', reason: 'invalid-envelope', issues: validated.issues };
	}
	const envelope = validated.envelope;
	const compiled = compileWallFirstLayoutGeometry(envelope.units.layout.data);

	let runtimeScene: RuntimeScene;
	try {
		runtimeScene = resolveSceneDocument(
			sceneProjectionForRuntime(envelope.units.scene.data, envelope.units.camera.data),
			sceneOptions
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Scene preparation failed';
		return {
			kind: 'rejected',
			reason: 'scene-invalid',
			issues: [{ path: '$.units.scene', code: 'scene_invalid', message }]
		};
	}

	return {
		kind: 'ready',
		envelope,
		geometry: compiled.geometry,
		issues: compiled.issues,
		diagnostics: validated.diagnostics,
		closure: validated.closure,
		rooms: createEmptyLayoutRoomRegistry(),
		runtimeScene,
		graph: createNavigationGraph(runtimeScene)
	};
}
