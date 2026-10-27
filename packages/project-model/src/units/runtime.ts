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
	countWork,
	p2311Measure,
	type CompiledLayoutGeometry,
	type LayoutCompileSession,
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

/** The successful half of `validateProjectEnvelope`, as preparation receives it. */
export type ValidatedProjectEnvelope = {
	readonly success: true;
	readonly envelope: ProjectEnvelope;
	readonly diagnostics: readonly EnvelopeDiagnostic[];
	readonly closure: readonly EnvelopeClosureFinding[];
};

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
	countWork('unit-runtime:prepare');
	const validated = validateProjectEnvelope(input);
	if (!validated.success) {
		return { kind: 'rejected', reason: 'invalid-envelope', issues: validated.issues };
	}
	return prepareValidatedUnitRuntime(validated, sceneOptions);
}

/**
 * The preparation half of `prepareUnitRuntime`, for a caller that has **already**
 * run `validateProjectEnvelope` on this exact value.
 *
 * Admission is such a caller: it validates the envelope to answer its own
 * question and would otherwise validate the same bytes a second time inside
 * preparation. The two halves are separate functions rather than a "skip
 * validation" flag so the one exported entry point keeps its single meaning, and
 * the validated value — not a bare envelope — is what proves the check ran.
 */
export function prepareValidatedUnitRuntime(
	validated: ValidatedProjectEnvelope,
	sceneOptions: SceneValidationOptions = {},
	/**
	 * An optional incremental compile store owned by the caller's surface. A long-
	 * lived host passes the same store for every preparation, so a compile after
	 * one accepted edit reuses every Layout entity the edit did not touch
	 * (T1.P02.S06 D.3). Absent, preparation is the cold canonical compile — the
	 * visitor runtime's own path, which must not carry editor state between sources.
	 */
	compileSession?: LayoutCompileSession
): UnitRuntimeReady | UnitRuntimeRejection {
	countWork('unit-runtime:prepare-validated');
	const envelope = validated.envelope;
	// The session's `compile` IS `compileWallFirstLayoutGeometry` over a retained
	// store: same builders, same assembly, same output shape.
	const compiled = compileSession
		? compileSession.compile(envelope.units.layout.data)
		: compileWallFirstLayoutGeometry(envelope.units.layout.data);

	let runtimeScene: RuntimeScene;
	try {
		runtimeScene = p2311Measure('scene-resolve', () =>
			resolveSceneDocument(
				sceneProjectionForRuntime(envelope.units.scene.data, envelope.units.camera.data),
				sceneOptions
			)
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Scene preparation failed';
		return {
			kind: 'rejected',
			reason: 'scene-invalid',
			issues: [{ path: '$.units.scene', code: 'scene_invalid', message }]
		};
	}

	// The approved placement is read-projection data, never authored into the
	// envelope: a model resource's footprint sizes its generic fallback.
	const modelFootprints = new Map<string, { width: number; depth: number }>();
	for (const resource of envelope.units.resources.data.resources) {
		if (resource.kind !== 'model' || resource.model === undefined) continue;
		const { width, depth } = resource.model.placement.footprint;
		modelFootprints.set(resource.id, { width, depth });
	}
	if (modelFootprints.size > 0) runtimeScene = { ...runtimeScene, modelFootprints };

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
