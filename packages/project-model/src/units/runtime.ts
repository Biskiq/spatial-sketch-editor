/**
 * F.2 unit runtime preparation — the one live read path for an admitted project.
 *
 * The Layout compiles through the one canonical geometry core. The Scene
 * payload resolves through the landed Scene resolver, which is Camera-free. The
 * **Camera unit**, not the Scene, supplies navigation: its views and its
 * connections resolve into their own runtime value, indexed by the one
 * navigation graph. Hard rule 2 therefore holds at runtime too — a Camera edit
 * cannot change a Scene-keyed input, and a Scene edit cannot change navigation.
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
import {
	createNavigationGraph,
	resolveNavigationDocument,
	resolveSceneDocument,
	SCENE_WORLD_LOCAL_FORMAT_VERSION,
	type NavigationGraph,
	type RuntimeNavigation,
	type RuntimeScene,
	type SceneConnection,
	type SceneDocument
} from '../scene';
import type { SceneValidationOptions } from '../scene-codec';
import type { ShapeIssue } from '../strict-shape';
import { CAMERA_UNIT_SCENE_VALIDATION } from './camera-connectivity';
import type {
	CameraFreeSceneDocument,
	CameraUnitPayload,
	ProjectEnvelope,
	UnitDomain
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
	/** Object composition and world presentation, resolved from the Scene unit. */
	readonly runtimeScene: RuntimeScene;
	/** Navigation, resolved from the Camera unit and indexed for its one evaluator. */
	readonly graph: NavigationGraph;
};

/**
 * The parts of a prepared runtime a live host can offer back to preparation.
 *
 * A host passes the runtime it is already showing, exactly as it passes its
 * compile session: preparation then reuses the Scene and navigation values whose
 * authored units are unchanged instead of resolving them again. The envelope is
 * the record of the unit revisions those values were prepared from.
 */
export type RetainedUnitRuntime = Pick<UnitRuntimeReady, 'envelope' | 'runtimeScene' | 'graph'>;

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
 * The Camera-free Scene document for the landed resolver.
 *
 * The Scene unit is not a second source: this is a transient read projection of
 * the unit's own records, never installed, serialized or accepted. Navigation is
 * empty here by construction — the Camera unit never enters a Scene document on
 * this path.
 */
function cameraFreeSceneProjection(scene: CameraFreeSceneDocument): SceneDocument {
	return {
		formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION,
		textures: scene.textures,
		materials: scene.materials,
		entities: scene.entities,
		...(scene.clusters === undefined ? {} : { clusters: scene.clusters }),
		navigationNodes: [],
		connections: []
	};
}

/**
 * The Camera unit's navigation records for the navigation resolver.
 *
 * A view is the non-editorial half of a navigation node, so this is the one
 * landed mapping — the same records Camera-unit admission reads, not a second
 * graph.
 */
function navigationProjectionForRuntime(
	camera: CameraUnitPayload
): Pick<SceneDocument, 'navigationNodes' | 'connections'> {
	return {
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
 * Whether an authored unit of the previous runtime is the same content as the
 * unit being prepared.
 *
 * The unit content revision is F.2's own content identity for a unit and is
 * derived from that unit's data by the acceptance adapter
 * (`normalizeUnitEnvelope`), which is also the rule the coordinator uses to
 * share an unchanged unit object between accepted revisions. Identity is enough
 * here for the same reason: nothing downstream reads a unit header.
 */
function sameUnitContent(
	previous: ProjectEnvelope,
	next: ProjectEnvelope,
	domain: UnitDomain
): boolean {
	return (
		previous.id === next.id &&
		previous.units[domain].header.contentRevision === next.units[domain].header.contentRevision
	);
}

/** The previous Scene value, or `null` when either of its inputs moved. */
function retainedSceneOf(
	previous: RetainedUnitRuntime | undefined,
	envelope: ProjectEnvelope
): RuntimeScene | null {
	if (previous === undefined) return null;
	// The resolved Scene carries the resource unit's approved model footprints, so
	// both authored inputs must be unchanged before it can be reused.
	if (!sameUnitContent(previous.envelope, envelope, 'scene')) return null;
	if (!sameUnitContent(previous.envelope, envelope, 'resources')) return null;
	return previous.runtimeScene;
}

/** The previous navigation value, or `null` when the Camera unit moved. */
function retainedNavigationOf(
	previous: RetainedUnitRuntime | undefined,
	envelope: ProjectEnvelope
): NavigationGraph | null {
	if (previous === undefined) return null;
	if (!sameUnitContent(previous.envelope, envelope, 'camera')) return null;
	return previous.graph;
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
	compileSession?: LayoutCompileSession,
	/**
	 * The runtime the caller is already showing, if it has one.
	 *
	 * Each part is reused only when its own authored inputs are unchanged: the
	 * Scene when the Scene and resources units are, navigation when the Camera
	 * unit is. `sceneOptions` is the caller's host policy for those same units, so
	 * a caller whose policy changes while the units stay identical must not offer
	 * a previous runtime — admission derives it from the envelope and the host
	 * catalogue, which is what makes the reuse sound there.
	 *
	 * Absent, preparation resolves every part: boot, Preview and the visitor
	 * runtime keep the cold path and carry no editor state between sources.
	 */
	previous?: RetainedUnitRuntime
): UnitRuntimeReady | UnitRuntimeRejection {
	countWork('unit-runtime:prepare-validated');
	const envelope = validated.envelope;
	// The session's `compile` IS `compileWallFirstLayoutGeometry` over a retained
	// store: same builders, same assembly, same output shape.
	const compiled = compileSession
		? compileSession.compile(envelope.units.layout.data)
		: compileWallFirstLayoutGeometry(envelope.units.layout.data);

	// The approved placement is read-projection data, never authored into the
	// envelope: a model resource's footprint sizes its generic fallback.
	const modelFootprints = new Map<string, { width: number; depth: number }>();
	for (const resource of envelope.units.resources.data.resources) {
		if (resource.kind !== 'model' || resource.model === undefined) continue;
		const { width, depth } = resource.model.placement.footprint;
		modelFootprints.set(resource.id, { width, depth });
	}

	let runtimeScene = retainedSceneOf(previous, envelope);
	if (runtimeScene === null) {
		try {
			runtimeScene = p2311Measure('scene-resolve', () => {
				countWork('scene:resolve');
				return resolveSceneDocument(
					cameraFreeSceneProjection(envelope.units.scene.data),
					// Force the Camera-unit policy after merging the host's catalogue
					// options: editor admission and visitor preparation share one answer.
					{ ...sceneOptions, ...CAMERA_UNIT_SCENE_VALIDATION }
				);
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Scene preparation failed';
			return {
				kind: 'rejected',
				reason: 'scene-invalid',
				issues: [{ path: '$.units.scene', code: 'scene_invalid', message }]
			};
		}
		if (modelFootprints.size > 0) runtimeScene = { ...runtimeScene, modelFootprints };
	}

	let graph = retainedNavigationOf(previous, envelope);
	if (graph === null) {
		try {
			graph = p2311Measure('navigation-resolve', () => {
				countWork('navigation:resolve');
				return createNavigationGraph(
					resolveNavigationDocument(
						navigationProjectionForRuntime(envelope.units.camera.data),
						{ ...sceneOptions, ...CAMERA_UNIT_SCENE_VALIDATION }
					)
				);
			});
		} catch (error) {
			// Unreachable through admission — Camera-unit admission runs the same
			// validator — so this is the honest answer rather than a silent empty graph.
			const message = error instanceof Error ? error.message : 'Navigation preparation failed';
			return {
				kind: 'rejected',
				reason: 'scene-invalid',
				issues: [{ path: '$.units.camera', code: 'scene_invalid', message }]
			};
		}
	}

	return {
		kind: 'ready',
		envelope,
		geometry: compiled.geometry,
		issues: compiled.issues,
		diagnostics: validated.diagnostics,
		closure: validated.closure,
		runtimeScene,
		graph
	};
}
