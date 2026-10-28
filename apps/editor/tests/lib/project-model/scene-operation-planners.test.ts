/**
 * T2.P01.S02 — the Scene operation planner set.
 *
 * This suite owns the **pure plan**: one captured intent becomes one candidate
 * Scene or one typed refusal. Conformance through the F.4 coordinator (one
 * install, one undo result, chronological Undo across domains) lives in
 * `tests/lib/authoring/scene-operation-acceptance.test.ts`; S01's placement
 * math and the Layout floor-support query keep their own suites.
 *
 * The cases challenge four claims:
 *
 * 1. **Ownership.** Each operation changes exactly the fields it owns and the
 *    record-scope guard refuses an untargeted entity, cluster or field.
 * 2. **Support.** Every supported operation re-derives support from the
 *    snapshot's canonical compile; the resting elevation is preserved by move,
 *    duplicate and resize, and a missing or stale choice refuses.
 * 3. **Determinism.** Replaying captured inputs produces the identical
 *    candidate and never mutates the accepted source.
 * 4. **Camera preservation.** The Camera-bearing Scene bytes cannot change,
 *    because no planner rebuilds them.
 */
import { describe, expect, it } from 'vitest';
import {
	createScenePlanners,
	selectSceneSupport,
	checkSceneRecordScope,
	DUPLICATE_OFFSET_METERS,
	FORM_SCALE_SCOPE_FIELD,
	YAW_SCOPE_FIELD,
	sceneSupportGenerationId,
	type NormalizedPlacementDefinition
} from '@portfolio/project-model/scene-planning';
import {
	type AcceptedSnapshot,
	type AuthoringIntent,
	type DomainPlanner,
	type SceneEntity,
	type SceneFormEntity,
	type SceneObjectCluster,
	type ScenePrimitiveEntity,
	type SemanticReference,
	type Vec3
} from '@portfolio/project-model';
import {
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type CameraFreeSceneDocument,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import {
	admitUnitProject,
	createUnitProject
} from '../authoring/__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../layout/__fixtures__/layout-id-capture';
import {
	createEmptyWallFirstLayoutDocument,
	floorSupportSnapshotOf,
	compileWallFirstLayoutGeometry,
	queryFloorSupports,
	planWallChain,
	type FloorSupportCandidate
} from '@portfolio/layout-core';

const ELEVATION = 2.5;
const GENERATION = sceneSupportGenerationId('content-1');

function supportedLayout(elevation = 0) {
	const empty = createEmptyWallFirstLayoutDocument();
	const baseline = { ...empty, floor: { ...empty.floor, elevation } };
	const planned = planWallChain({
		baseline,
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id
	});
	if (planned.kind !== 'success') throw new Error('the support fixture enclosure was refused');
	return planned.document;
}

function box(
	id: string,
	position: Vec3,
	overrides: {
		readonly scale?: number;
		readonly rotation?: Vec3;
		readonly dimensions?: { readonly width: number; readonly height: number; readonly depth: number };
		readonly materialInstanceId?: string;
	} = {}
): ScenePrimitiveEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: id,
		dimensions: overrides.dimensions ?? { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: overrides.rotation ?? [0, 0, 0],
		scale: overrides.scale ?? 1,
		...(overrides.materialInstanceId === undefined
			? {}
			: { materialInstanceId: overrides.materialInstanceId })
	};
}

function sceneWith(
	entities: readonly SceneEntity[],
	clusters?: readonly SceneObjectCluster[],
	materials: CameraFreeSceneDocument['materials'] = []
): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials,
		entities: [...entities],
		...(clusters === undefined ? {} : { clusters: [...clusters] })
	};
}

/** The Camera unit every fixture carries, so preservation can be measured. */
const TOUR_CAMERA = {
	formatVersion: 1 as const,
	views: [
		{
			id: 'tour-a',
			label: 'Tour A',
			eye: [1, 1.65, 1] as [number, number, number],
			target: [1, 1.25, -2] as [number, number, number],
			fov: 54,
			connectedViewIds: ['tour-b']
		},
		{
			id: 'tour-b',
			label: 'Tour B',
			eye: [4, 1.65, 3] as [number, number, number],
			target: [4, 1.25, 0] as [number, number, number],
			fov: 54,
			connectedViewIds: ['tour-a']
		}
	],
	connections: [
		{
			id: 'tour-a-b',
			fromNodeId: 'tour-a',
			toNodeId: 'tour-b',
			clearance: 0.35,
			positionPath: { kind: 'auto-bezier' as const, anchors: [] }
		}
	]
};

function projectWith(
	scene: CameraFreeSceneDocument,
	elevation = 0
): Promise<ProjectEnvelope> {
	return createUnitProject({
		id: 'project-1',
		name: 'Gallery',
		layout: supportedLayout(elevation),
		scene,
		camera: TOUR_CAMERA
	});
}

async function snapshotOf(project: ProjectEnvelope): Promise<AcceptedSnapshot<ProjectEnvelope>> {
	const admitted = await admitUnitProject(project, {
		projectId: project.id,
		revisionId: 'revision-1'
	});
	if (admitted.kind !== 'admitted') {
		throw new Error(`the fixture was not admitted: ${JSON.stringify(admitted.issues)}`);
	}
	// The Stage snapshot carries compiled domain reads; a planner request carries
	// only the AM-4 identity and the envelope it names.
	return {
		acceptedRevision: admitted.snapshot.acceptedRevision,
		sourceContentId: admitted.snapshot.sourceContentId,
		sourceKind: admitted.snapshot.sourceKind,
		sourceVersion: admitted.snapshot.sourceVersion,
		domain: {
			identity: {
				acceptedRevision: admitted.snapshot.acceptedRevision,
				sourceContentId: admitted.snapshot.sourceContentId
			},
			source: project
		}
	};
}

function sceneTargetRevision(snapshot: AcceptedSnapshot<ProjectEnvelope>): string {
	return snapshot.domain.source.units.scene.header.contentRevision;
}

function cameraBytes(source: ProjectEnvelope): string {
	return JSON.stringify(source.units.camera.data);
}

function intent(input: {
	readonly kind: string;
	readonly operationId: string;
	readonly snapshot: AcceptedSnapshot<ProjectEnvelope>;
	readonly payload: unknown;
	readonly targets?: readonly SemanticReference[];
	readonly allocatedIds?: readonly { readonly kind: string; readonly id: string }[];
}): AuthoringIntent {
	return {
		version: 1,
		kind: input.kind,
		operationId: input.operationId,
		expectedRevision: input.snapshot.acceptedRevision,
		targets: input.targets ?? [],
		payload: input.payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds: input.allocatedIds ?? []
	};
}

function entityTarget(contentId: string, entityId: string): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: contentId },
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function formEntity(
	id: string,
	overrides: {
		readonly position?: Vec3;
		readonly rotation?: Vec3;
		readonly plane?: 'plan' | 'elevation';
		readonly scale?: Vec3;
		readonly outline?: SceneFormEntity['form']['generator']['outline'];
	} = {}
): SceneFormEntity {
	return {
		kind: 'form',
		id,
		name: id,
		position: overrides.position ?? [3, 0, 2],
		rotation: overrides.rotation ?? [0, 0, 0],
		form: {
			generator: {
				kind: 'extrude',
				plane: overrides.plane ?? 'plan',
				outline: overrides.outline ?? [
					{ key: 1, u: -1, v: -1, smooth: false },
					{ key: 2, u: 1, v: -1, smooth: false },
					{ key: 3, u: 1, v: 1, smooth: false },
					{ key: 4, u: -1, v: 1, smooth: false }
				],
				extent: 1
			},
			scale: overrides.scale ?? [1, 1, 1],
			nextKey: 5
		},
		materialId: 'wood-walnut',
		castShadow: true,
		receiveShadow: true
	};
}

function formCreatePayload(overrides: Record<string, unknown> = {}) {
	return {
		plane: 'plan',
		outline: [
			{ u: 0, v: 0, smooth: false },
			{ u: 2, v: 0, smooth: false },
			{ u: 2, v: 1, smooth: false },
			{ u: 0, v: 1, smooth: false }
		],
		extent: 0.8,
		position: [3, 0, 2],
		yaw: 0,
		materialId: 'wood-walnut',
		name: 'Display plinth',
		...overrides
	};
}

function projectWorldFrame(): { origin: Vec3; yaw: number } {
	return { origin: [0, 0, 0], yaw: 0 };
}

function frameReference() {
	return { version: 1 as const, kind: 'project-world' as const };
}

function plannerFor(
	kind: string,
	definitions: readonly NormalizedPlacementDefinition[] = []	): DomainPlanner<ProjectEnvelope> {
	const planner = createScenePlanners({ definitions }).find((candidate) => candidate.kind === kind);
	if (planner === undefined) throw new Error(`no planner for ${kind}`);
	return planner;
}

function prepare(
	kind: string,
	snapshot: AcceptedSnapshot<ProjectEnvelope>,
	captured: AuthoringIntent,
	definitions: readonly NormalizedPlacementDefinition[] = []
) {
	const planner = plannerFor(kind, definitions);
	return planner.prepare({
		snapshot,
		intent: captured,
		capturedInputs: captured.capturedInputs,
		allocatedIds: captured.allocatedIds
	});
}

function nativeBoxDefinition(): NormalizedPlacementDefinition {
	return {
		definitionKey: 'native:box',
		metadataContentId: 'sha256-0000000000000000000000000000000000000000000000000000000000000000',
		admission: {
			operations: ['place-object'],
			supportedSurfaces: ['floor'],
			uprightOnly: true,
			provenance: { kind: 'analytical', detail: 'Centered primitive: contactMinY = -height/2.' },
			exclusions: []
		},
		footprintMeters: [
			[-0.5, -0.5],
			[0.5, -0.5],
			[0.5, 0.5],
			[-0.5, 0.5]
		],
		contactMinY: -0.5,
		creationDefaults: {
			kind: 'primitive',
			primitive: 'box',
			name: 'Block',
			dimensions: { width: 1, height: 1, depth: 1 },
			materialId: 'plaster-warm',
			castShadow: true,
			receiveShadow: true
		},
		renderNormalization: { defaultScale: 1 }
	};
}

function placePayload(overrides: Record<string, unknown> = {}) {
	return {
		definitionKey: 'native:box',
		metadataContentId: nativeBoxDefinition().metadataContentId,
		worldXZ: [3, 2],
		yaw: 0,
		frame: projectWorldFrame(),
		frameReference: frameReference(),
		...overrides
	};
}

function supportCandidates(
	snapshot: AcceptedSnapshot<ProjectEnvelope>
): readonly FloorSupportCandidate[] {
	const compiled = compileWallFirstLayoutGeometry(snapshot.domain.source.units.layout.data);
	const queried = queryFloorSupports(floorSupportSnapshotOf(compiled.geometry), {
		generationId: sceneSupportGenerationId(snapshot.sourceContentId),
		x: 3,
		z: 2
	});
	if (queried.kind !== 'candidates') throw new Error('the support fixture yielded no candidate');
	return queried.candidates;
}

describe('scene operation planners — registration', () => {
	it('registers exactly the nine Scene operations as single-domain planners', () => {
		const planners = createScenePlanners({ definitions: [nativeBoxDefinition()] });
		expect(planners.map((planner) => planner.kind)).toEqual([
			'place-object',
			'create-form',
			'set-form-size',
			'move-horizontal',
			'set-yaw',
			'place-on-floor',
			'resize-on-floor',
			'duplicate-one',
			'delete-one'
		]);
		for (const planner of planners) {
			// `place-object` is the single Scene planner that declares typed-resource
			// staging: a creator model's first placement installs its resource, exact
			// lock and entity as one accepted result. Every other Scene operation
			// keeps Scene-only admission.
			expect(planner.admission).toEqual({
				domain: 'scene',
				compound: false,
				units: false,
				resources: planner.kind === 'place-object'
			});
			expect(planner.sourceKinds).toEqual([UNIT_SOURCE_KIND]);
			expect(planner.sourceVersions).toEqual([UNIT_SOURCE_VERSION]);
		}
	});
});

describe('scene operation planners — definition pins', () => {
	it('refuses a placement whose named definition was never admitted, and names the pin', async () => {
		const project = await projectWith(sceneWith([]), ELEVATION);
		const snapshot = await snapshotOf(project);
		// The catalogue model is excluded by S01's policy, so no session captures a
		// definition for it; a payload naming it must refuse rather than guess.
		const result = prepare(
			'place-object',
			snapshot,
			intent({
				kind: 'place-object',
				operationId: 'op-place-missing',
				snapshot,
				payload: placePayload({
					definitionKey: 'model:paris-grand-piano',
					metadataContentId: `sha256-${'0'.repeat(64)}`
				}),
				allocatedIds: [{ kind: 'scene-entity', id: 'entity-new' }]
			}),
			[]
		);
		expect(result).toMatchObject({ kind: 'rejected', code: 'missing-definition' });
		if (result.kind !== 'rejected') return;
		expect(result.diagnostics.map((issue) => issue.message)).toContain('model:paris-grand-piano');
	});

	it('refuses a placement whose captured metadata identity no longer matches the admitted definition', async () => {
		const project = await projectWith(sceneWith([]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const admitted = nativeBoxDefinition();
		const capturedIdentity = `sha256-${'1'.repeat(64)}`;
		expect(capturedIdentity).not.toBe(admitted.metadataContentId);
		const result = prepare(
			'place-object',
			snapshot,
			intent({
				kind: 'place-object',
				operationId: 'op-place-changed',
				snapshot,
				payload: placePayload({ metadataContentId: capturedIdentity }),
				allocatedIds: [{ kind: 'scene-entity', id: 'entity-new' }]
			}),
			[admitted]
		);
		expect(result).toMatchObject({ kind: 'rejected', code: 'definition-changed' });
		if (result.kind !== 'rejected') return;
		const messages = result.diagnostics.map((issue) => issue.message);
		expect(messages).toContain(admitted.metadataContentId);
		expect(messages).toContain(capturedIdentity);
	});
});

describe('scene operation planners — poses and ownership', () => {
	it('places one captured entity on the compiled floor, upright at relative scale 1', async () => {
		const project = await projectWith(sceneWith([]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'place-object',
			snapshot,
			intent({
				kind: 'place-object',
				operationId: 'op-place',
				snapshot,
				payload: placePayload({ yaw: 0.25 }),
				allocatedIds: [{ kind: 'scene-entity', id: 'entity-new' }]
			}),
			[nativeBoxDefinition()]
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;

		const scene = result.candidate.source.units.scene.data;
		const placed = scene.entities.at(-1)!;
		expect(placed.id).toBe('entity-new');
		expect(placed.position).toEqual([3, ELEVATION + 0.5, 2]);
		expect(placed.rotation[0]).toBe(0);
		expect(placed.rotation[1]).toBeCloseTo(0.25, 12);
		expect(placed.rotation[2]).toBe(0);
		expect(placed.scale).toBe(1);
		expect(result.candidate.correspondence).toEqual([
			{ relation: 'created', before: null, after: expect.objectContaining({ subject: { kind: 'entity', id: 'entity-new' } }) }
		]);
		expect(result.candidate.changes).toEqual([
			{ kind: 'scene-place-object', subjectIds: ['entity-new'], fields: ['entities'] }
		]);
		expect(cameraBytes(result.candidate.source)).toBe(cameraBytes(snapshot.domain.source));
	});

	it('moves horizontally while preserving Y, rotation, scale, dimensions and material', async () => {
		const entity = box('entity-a', [3, ELEVATION + 0.7, 2], {
			scale: 1.4,
			rotation: [0, 0.9, 0],
			materialInstanceId: 'material-1'
		});
		const project = await projectWith(
			sceneWith([entity], undefined, [
				{ id: 'material-1', name: 'Material', baseMaterialId: 'plaster-warm' }
			]),
			ELEVATION
		);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'move-horizontal',
			snapshot,
			intent({
				kind: 'move-horizontal',
				operationId: 'op-move',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-a',
					worldXZ: [5, 4],
					frame: projectWorldFrame(),
					frameReference: frameReference(),
					contactMinY: -0.5
				}
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const moved = result.candidate.source.units.scene.data.entities[0]!;
		expect(moved.position).toEqual([5, ELEVATION + 0.7, 4]);
		expect(moved.rotation).toEqual([0, 0.9, 0]);
		expect(moved.scale).toBe(1.4);
		expect(moved.kind === 'primitive' ? moved.dimensions : null).toEqual({ width: 1, height: 1, depth: 1 });
		expect('materialInstanceId' in moved ? moved.materialInstanceId : null).toBe('material-1');
		expect(cameraBytes(result.candidate.source)).toBe(cameraBytes(snapshot.domain.source));
		expect(result.candidate.correspondence[0]!.relation).toBe('preserved');
	});

	it('sets yaw without touching position, scale or Camera bytes', async () => {
		const entity = box('entity-a', [3, ELEVATION + 0.5, 2], {
			scale: 2,
			// Sub-tolerance pitch/roll are admitted as upright; yaw must not rewrite them.
			rotation: [5e-10, 0.4, -5e-10]
		});
		const project = await projectWith(sceneWith([entity]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'set-yaw',
			snapshot,
			intent({
				kind: 'set-yaw',
				operationId: 'op-yaw',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-a',
					yaw: 1.2,
					frame: projectWorldFrame(),
					frameReference: frameReference()
				}
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const yawed = result.candidate.source.units.scene.data.entities[0]!;
		expect(yawed.position).toEqual([3, ELEVATION + 0.5, 2]);
		expect(yawed.rotation[0]).toBe(5e-10);
		expect(yawed.rotation[1]).toBeCloseTo(1.2, 12);
		expect(yawed.rotation[2]).toBe(-5e-10);
		expect(yawed.scale).toBe(2);
	});

	it('preserves sub-tolerance pitch and roll when place-on-floor owns only yaw', async () => {
		const entity = box('entity-a', [3, ELEVATION + 0.5, 2], {
			rotation: [5e-10, 0.4, -5e-10]
		});
		const project = await projectWith(sceneWith([entity]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'place-on-floor',
			snapshot,
			intent({
				kind: 'place-on-floor',
				operationId: 'op-seat-yaw',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-a',
					worldXZ: [1, 1],
					frame: projectWorldFrame(),
					frameReference: frameReference(),
					contactMinY: -0.5,
					yaw: 0.9
				}
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const seated = result.candidate.source.units.scene.data.entities[0]!;
		expect(seated.rotation[0]).toBe(5e-10);
		expect(seated.rotation[1]).toBeCloseTo(0.9, 12);
		expect(seated.rotation[2]).toBe(-5e-10);
	});

	it('reseats on the floor and owns the resulting Y, preserving scale and rotation', async () => {
		const entity = box('entity-a', [3, ELEVATION + 0.5, 2], { scale: 1.5, rotation: [0, 0.4, 0] });
		const project = await projectWith(sceneWith([entity]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'place-on-floor',
			snapshot,
			intent({
				kind: 'place-on-floor',
				operationId: 'op-seat',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-a',
					worldXZ: [1, 1],
					frame: projectWorldFrame(),
					frameReference: frameReference(),
					contactMinY: -0.5
				}
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const seated = result.candidate.source.units.scene.data.entities[0]!;
		expect(seated.position).toEqual([1, ELEVATION + 0.75, 1]);
		expect(seated.rotation).toEqual([0, 0.4, 0]);
		expect(seated.scale).toBe(1.5);
	});

	it('resizes uniformly and compensates Y to keep the same contact elevation', async () => {
		const entity = box('entity-a', [3, ELEVATION + 0.5, 2], { rotation: [0, 0.4, 0] });
		const project = await projectWith(sceneWith([entity]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'resize-on-floor',
			snapshot,
			intent({
				kind: 'resize-on-floor',
				operationId: 'op-resize',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: { entityId: 'entity-a', scale: 2, contactMinY: -0.5 }
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const resized = result.candidate.source.units.scene.data.entities[0]!;
		expect(resized.scale).toBe(2);
		expect(resized.position).toEqual([3, ELEVATION + 1, 2]);
		expect(resized.rotation).toEqual([0, 0.4, 0]);
	});

	it('duplicates by exactly +0.5 m world X/Z, preserving every other component', async () => {
		const entity = box('entity-a', [3, ELEVATION + 0.65, 2], { scale: 1.3, rotation: [0, 0.7, 0] });
		const project = await projectWith(sceneWith([entity]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'duplicate-one',
			snapshot,
			intent({
				kind: 'duplicate-one',
				operationId: 'op-duplicate',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: { entityId: 'entity-a', contactMinY: -0.5 },
				allocatedIds: [{ kind: 'scene-entity', id: 'entity-copy' }]
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const duplicate = result.candidate.source.units.scene.data.entities.at(-1)!;
		expect(duplicate.id).toBe('entity-copy');
		expect(duplicate.position).toEqual([
			3 + DUPLICATE_OFFSET_METERS,
			ELEVATION + 0.65,
			2 + DUPLICATE_OFFSET_METERS
		]);
		expect(duplicate.rotation).toEqual([0, 0.7, 0]);
		expect(duplicate.scale).toBe(1.3);
		expect('materialId' in duplicate ? duplicate.materialId : null).toBe(entity.materialId);
		expect(result.candidate.correspondence).toEqual([
			{ relation: 'created', before: null, after: expect.objectContaining({ subject: { kind: 'entity', id: 'entity-copy' } }) }
		]);
	});

	it('deletes exactly one entity, cleans its cluster and drops a cluster below the codec minimum', async () => {
		const entities = [
			box('entity-a', [3, 0.5, 2]),
			box('entity-b', [1, 0.5, 1]),
			box('entity-c', [2, 0.5, 2]),
			box('entity-d', [1.5, 0.5, 2]),
			box('entity-e', [2.5, 0.5, 1])
		];
		const scene = sceneWith(entities, [
			{ id: 'cluster-keep', name: 'Keep', memberIds: ['entity-a', 'entity-b', 'entity-c'] },
			{ id: 'cluster-drop', name: 'Drop', memberIds: ['entity-d', 'entity-e'] }
		]);
		const snapshot = await snapshotOf(await projectWith(scene));
		const deleteOf = (entityId: string, operationId: string, from: AcceptedSnapshot<ProjectEnvelope>) =>
			prepare(
				'delete-one',
				from,
				intent({
					kind: 'delete-one',
					operationId,
					snapshot: from,
					targets: [entityTarget(sceneTargetRevision(from), entityId)],
					payload: { entityId }
				})
			);

		const kept = deleteOf('entity-c', 'op-delete-keep', snapshot);
		expect(kept.kind).toBe('prepared');
		if (kept.kind !== 'prepared') return;
		expect(kept.candidate.source.units.scene.data.entities.map((entity) => entity.id)).toEqual([
			'entity-a',
			'entity-b',
			'entity-d',
			'entity-e'
		]);
		expect(kept.candidate.source.units.scene.data.clusters).toEqual([
			{ id: 'cluster-keep', name: 'Keep', memberIds: ['entity-a', 'entity-b'] },
			{ id: 'cluster-drop', name: 'Drop', memberIds: ['entity-d', 'entity-e'] }
		]);
		expect(kept.candidate.correspondence).toEqual([
			{
				relation: 'retired',
				before: expect.objectContaining({ subject: { kind: 'entity', id: 'entity-c' } }),
				after: null
			}
		]);

		// Deleting a member of a two-member cluster leaves one member, which the
		// Scene format refuses; the cluster must be dropped in the same candidate.
		const dropped = deleteOf('entity-e', 'op-delete-drop', snapshot);
		expect(dropped.kind).toBe('prepared');
		if (dropped.kind !== 'prepared') return;
		expect(dropped.candidate.source.units.scene.data.clusters).toEqual([
			{ id: 'cluster-keep', name: 'Keep', memberIds: ['entity-a', 'entity-b', 'entity-c'] }
		]);
	});
});

describe('scene operation planners — support and refusals', () => {
	it('refuses a destination without support at the resting elevation', async () => {
		const project = await projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'move-horizontal',
			snapshot,
			intent({
				kind: 'move-horizontal',
				operationId: 'op-move-out',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-a',
					worldXZ: [20, 20],
					frame: projectWorldFrame(),
					frameReference: frameReference(),
					contactMinY: -0.5
				}
			})
		);
		expect(result).toMatchObject({ kind: 'rejected', code: 'no-support' });
	});

	it('refuses a duplicate whose shifted contact leaves the supported floor', async () => {
		const project = await projectWith(sceneWith([box('entity-corner', [6.6, 0.5, 5.6])]));
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'duplicate-one',
			snapshot,
			intent({
				kind: 'duplicate-one',
				operationId: 'op-duplicate-outside',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-corner')],
				payload: { entityId: 'entity-corner', contactMinY: -0.5 },
				allocatedIds: [{ kind: 'scene-entity', id: 'entity-copy' }]
			})
		);
		expect(result).toMatchObject({ kind: 'rejected', code: 'no-support' });
	});

	it('refuses a stale or unknown captured support choice instead of re-choosing', async () => {
		const project = await projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const source = sceneTargetRevision(snapshot);
		for (const [choice, code] of [
			[{ kind: 'order-key', orderKey: 'unknown', generationId: sceneSupportGenerationId(snapshot.sourceContentId) }, 'support-choice-required'],
			[{ kind: 'order-key', orderKey: 'unknown', generationId: 'old-generation' }, 'stale-generation']
		] as const) {
			const result = prepare(
				'move-horizontal',
				snapshot,
				intent({
					kind: 'move-horizontal',
					operationId: `op-choice-${code}`,
					snapshot,
					targets: [entityTarget(source, 'entity-a')],
					payload: {
						entityId: 'entity-a',
						worldXZ: [5, 4],
						frame: projectWorldFrame(),
						frameReference: frameReference(),
						contactMinY: -0.5,
						supportChoice: choice
					}
				})
			);
			expect(result).toMatchObject({ kind: 'rejected', code });
		}
	});

	it('resolves a valid captured support choice instead of refusing every choice', async () => {
		// The strict-issue check must not turn a legitimate captured choice into a
		// refusal: this is the positive half of the stale/unknown choice cases.
		const project = await projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const source = sceneTargetRevision(snapshot);
		const orderKey = supportCandidates(snapshot)[0]!.orderKey;
		const result = prepare(
			'move-horizontal',
			snapshot,
			intent({
				kind: 'move-horizontal',
				operationId: 'op-choice-valid',
				snapshot,
				targets: [entityTarget(source, 'entity-a')],
				payload: {
					entityId: 'entity-a',
					worldXZ: [4, 3],
					frame: projectWorldFrame(),
					frameReference: frameReference(),
					contactMinY: -0.5,
					supportChoice: {
						kind: 'order-key',
						orderKey,
						generationId: sceneSupportGenerationId(snapshot.sourceContentId)
					}
				}
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		expect(result.candidate.source.units.scene.data.entities[0]!.position).toEqual([4, 0.5, 3]);
	});

	it('refuses a captured contact that disagrees with the primitive dimensions', async () => {
		const project = await projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'move-horizontal',
			snapshot,
			intent({
				kind: 'move-horizontal',
				operationId: 'op-bad-contact',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-a',
					worldXZ: [5, 4],
					frame: projectWorldFrame(),
					frameReference: frameReference(),
					contactMinY: -0.25
				}
			})
		);
		expect(result).toMatchObject({ kind: 'rejected', code: 'missing-contact-metadata' });
	});

	it('refuses lights, planes, tilted objects, missing targets and set duplication', async () => {
		const light: SceneEntity = {
			kind: 'light',
			light: 'point',
			id: 'light-a',
			name: 'Lamp',
			color: '#ffffff',
			intensity: 1,
			castShadow: false,
			position: [1, 2, 1],
			rotation: [0, 0, 0]
		};
		const plane: ScenePrimitiveEntity = {
			kind: 'primitive',
			primitive: 'plane',
			id: 'plane-a',
			name: 'Plane',
			dimensions: { width: 1, height: 1 },
			materialId: 'plaster-warm',
			castShadow: false,
			receiveShadow: true,
			position: [1, 1, 1],
			rotation: [0, 0, 0]
		};
		const tilted = box('entity-tilted', [3, 0.5, 2], { rotation: [0.2, 0, 0] });
		const project = await projectWith(
			sceneWith([light, plane, tilted, box('entity-a', [3, 0.5, 2])], [
				{ id: 'cluster-1', name: 'Group', memberIds: ['entity-a', 'entity-tilted'] }
			])
		);
		const snapshot = await snapshotOf(project);
		const yawFor = (entityId: string, operationId: string) =>
			prepare(
				'set-yaw',
				snapshot,
				intent({
					kind: 'set-yaw',
					operationId,
					snapshot,
					targets: [entityTarget(sceneTargetRevision(snapshot), entityId)],
					payload: {
						entityId,
						yaw: 0.5,
						frame: projectWorldFrame(),
						frameReference: frameReference()
					}
				})
			);
		expect(yawFor('light-a', 'light')).toMatchObject({ kind: 'rejected', code: 'unsupported-transform' });
		expect(yawFor('plane-a', 'plane')).toMatchObject({ kind: 'rejected', code: 'unsupported-transform' });
		expect(yawFor('entity-tilted', 'tilted')).toMatchObject({ kind: 'rejected', code: 'unsupported-transform' });
		expect(yawFor('missing', 'missing')).toMatchObject({ kind: 'rejected', code: 'missing-target' });
		expect(
			prepare(
				'duplicate-one',
				snapshot,
				intent({
					kind: 'duplicate-one',
					operationId: 'cluster-duplicate',
					snapshot,
					targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
					payload: { entityId: 'entity-a', contactMinY: -0.5 },
					allocatedIds: [{ kind: 'scene-entity', id: 'entity-copy' }]
				})
			)
		).toMatchObject({ kind: 'rejected', code: 'unsupported-set' });
	});

	it('refuses a cluster-member duplicate and a captured id that already exists', async () => {
		const project = await projectWith(
			sceneWith([box('entity-a', [3, 0.5, 2]), box('entity-b', [2, 0.5, 2])], [
				{ id: 'cluster-1', name: 'Group', memberIds: ['entity-a', 'entity-b'] }
			])
		);
		const snapshot = await snapshotOf(project);
		for (const [newId, code, isExpectedDiagnostic] of [
			[
				'entity-copy',
				'unsupported-set',
				(issue: { readonly message: string }) => issue.message.includes('cluster-1')
			],
			[
				'entity-b',
				'invalid-value',
				(issue: { readonly code: string }) => issue.code === 'duplicate-entity-id'
			]
		] as const) {
			const result = prepare(
				'duplicate-one',
				snapshot,
				intent({
					kind: 'duplicate-one',
					operationId: `op-${newId}`,
					snapshot,
					targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
					payload: { entityId: 'entity-a', contactMinY: -0.5 },
					allocatedIds: [{ kind: 'scene-entity', id: newId }]
				})
			);
			expect(result, newId).toMatchObject({ kind: 'rejected', code });
			if (result.kind !== 'rejected') continue;
			expect(result.diagnostics.some(isExpectedDiagnostic), newId).toBe(true);
		}
	});

	it('refuses unknown payload keys and a mismatched support-choice variant', async () => {
		const project = await projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const source = sceneTargetRevision(snapshot);
		// An unknown key is a captured-data defect, not something to ignore: the
		// reader records it and the planner must refuse before doing any work.
		const unknownKey = prepare(
			'set-yaw',
			snapshot,
			intent({
				kind: 'set-yaw',
				operationId: 'op-unknown-key',
				snapshot,
				targets: [entityTarget(source, 'entity-a')],
				payload: {
					entityId: 'entity-a',
					yaw: 0.5,
					frame: projectWorldFrame(),
					frameReference: frameReference(),
					scale: 2
				}
			})
		);
		expect(unknownKey).toMatchObject({ kind: 'rejected', code: 'invalid-value' });
		if (unknownKey.kind === 'rejected') {
			expect(
				unknownKey.diagnostics.some(
					(issue) => issue.code === 'unknown-key' && issue.path === '$.payload.scale'
				)
			).toBe(true);
		}

		const mixedChoice = prepare(
			'move-horizontal',
			snapshot,
			intent({
				kind: 'move-horizontal',
				operationId: 'op-mixed-choice',
				snapshot,
				targets: [entityTarget(source, 'entity-a')],
				payload: {
					entityId: 'entity-a',
					worldXZ: [4, 3],
					frame: projectWorldFrame(),
					frameReference: frameReference(),
					contactMinY: -0.5,
					supportChoice: {
						kind: 'elevation',
						elevation: 0,
						orderKey: 'unused',
						generationId: sceneSupportGenerationId(source)
					}
				}
			})
		);
		expect(mixedChoice).toMatchObject({ kind: 'rejected', code: 'invalid-value' });
		if (mixedChoice.kind === 'rejected') {
			expect(
				mixedChoice.diagnostics.some((issue) => issue.path === '$.payload.supportChoice.orderKey')
			).toBe(true);
		}
	});

	it('returns no_op for an unchanged authored result', async () => {
		const project = await projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'set-yaw',
			snapshot,
			intent({
				kind: 'set-yaw',
				operationId: 'op-noop',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-a',
					yaw: 0,
					frame: projectWorldFrame(),
					frameReference: frameReference()
				}
			})
		);
		expect(result).toMatchObject({ kind: 'rejected', code: 'no_op' });

		// The same rotation stored in another representation is still no change: a
		// canonicalized equivalent must not install a history entry.
		const wrapped = await projectWith(sceneWith([box('entity-wrapped', [3, 0.5, 2], { rotation: [0, 4, 0] })]));
		const wrappedSnapshot = await snapshotOf(wrapped);
		const wrappedResult = prepare(
			'set-yaw',
			wrappedSnapshot,
			intent({
				kind: 'set-yaw',
				operationId: 'op-noop-wrapped',
				snapshot: wrappedSnapshot,
				targets: [entityTarget(sceneTargetRevision(wrappedSnapshot), 'entity-wrapped')],
				payload: {
					entityId: 'entity-wrapped',
					yaw: 4,
					frame: projectWorldFrame(),
					frameReference: frameReference()
				}
			})
		);
		expect(wrappedResult).toMatchObject({ kind: 'rejected', code: 'no_op' });
	});

	it('refuses a captured identity, target or frame that does not answer this snapshot', async () => {
		const project = await projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const cases: Array<[AuthoringIntent, string]> = [
			[intent({
				kind: 'set-yaw',
				operationId: 'wrong-target',
				snapshot,
				targets: [entityTarget('old-content', 'entity-a')],
				payload: {
					entityId: 'entity-a',
					yaw: 1,
					frame: projectWorldFrame(),
					frameReference: frameReference()
				}
			}), 'stale-revision'],
			[intent({
				kind: 'set-yaw',
				operationId: 'wrong-payload-target',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-b',
					yaw: 1,
					frame: projectWorldFrame(),
					frameReference: frameReference()
				}
			}), 'invalid-target'],
			[intent({
				kind: 'set-yaw',
				operationId: 'wrong-frame',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-a',
					yaw: 1,
					frame: { origin: [1, 0, 0], yaw: 0 },
					frameReference: frameReference()
				}
			}), 'frame-mismatch'],
			[intent({
				kind: 'set-yaw',
				operationId: 'unexpected-allocation',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-a',
					yaw: 1,
					frame: projectWorldFrame(),
					frameReference: frameReference()
				},
				allocatedIds: [{ kind: 'scene-entity', id: 'unexpected' }]
			}), 'unexpected-allocation']
		];
		for (const [captured, diagnostic] of cases) {
			const result = prepare('set-yaw', snapshot, captured);
			expect(result, diagnostic).toMatchObject({ kind: 'rejected', code: 'invalid-value' });
			if (result.kind !== 'rejected') continue;
			expect(result.diagnostics.some((issue) => issue.code === diagnostic), diagnostic).toBe(true);
		}
	});

	it('refuses an owner-qualified frame instead of trusting an unverified conversion', async () => {
		const project = await projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		// Structurally valid: owner, frame id and revision are all present, so the
		// reference's shape is not the problem. What is missing is the owner's
		// resolved placement — no frame resolver is admitted here — so the supplied
		// origin and yaw are an unverified claim, not a resolved frame.
		const ownerFrame = {
			version: 1 as const,
			kind: 'owner-frame' as const,
			owner: 'scene' as const,
			frameId: 'frame-1',
			revision: 'content-1'
		};
		const conversion = { origin: [1.5, 0, -2], yaw: 0.4 };
		const captured: readonly AuthoringIntent[] = [
			intent({
				kind: 'place-object',
				operationId: 'owner-frame-place',
				snapshot,
				payload: placePayload({ frame: conversion, frameReference: ownerFrame }),
				allocatedIds: [{ kind: 'scene-entity', id: 'entity-new' }]
			}),
			intent({
				kind: 'move-horizontal',
				operationId: 'owner-frame-move',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-a',
					worldXZ: [1, 1],
					frame: conversion,
					frameReference: ownerFrame,
					contactMinY: -0.5
				}
			}),
			intent({
				kind: 'set-yaw',
				operationId: 'owner-frame-yaw',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: { entityId: 'entity-a', yaw: 0.9, frame: conversion, frameReference: ownerFrame }
			}),
			intent({
				kind: 'place-on-floor',
				operationId: 'owner-frame-seat',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
				payload: {
					entityId: 'entity-a',
					worldXZ: [1, 1],
					frame: conversion,
					frameReference: ownerFrame,
					contactMinY: -0.5,
					yaw: 0.3
				}
			})
		];
		for (const capturedIntent of captured) {
			const result = prepare(capturedIntent.kind, snapshot, capturedIntent, [nativeBoxDefinition()]);
			expect(result, capturedIntent.kind).toMatchObject({ kind: 'rejected', code: 'unsupported-frame' });
			if (result.kind !== 'rejected') continue;
			expect(
				result.diagnostics.some((issue) => issue.code === 'unsupported-frame'),
				capturedIntent.kind
			).toBe(true);
		}

		// Refusing resolution is not a licence to accept a malformed reference: a
		// structurally invalid owner-frame stays `invalid-value`.
		const malformed = intent({
			kind: 'set-yaw',
			operationId: 'owner-frame-malformed',
			snapshot,
			targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
			payload: {
				entityId: 'entity-a',
				yaw: 0.9,
				frame: projectWorldFrame(),
				frameReference: { version: 1, kind: 'owner-frame', owner: 'scene', frameId: 'frame-1' }
			}
		});
		expect(prepare('set-yaw', snapshot, malformed)).toMatchObject({ kind: 'rejected', code: 'invalid-value' });

		// The identity frame still plans: the refusal is about unverified owner
		// data, not about frames as such.
		const identity = intent({
			kind: 'set-yaw',
			operationId: 'identity-frame-yaw',
			snapshot,
			targets: [entityTarget(sceneTargetRevision(snapshot), 'entity-a')],
			payload: { entityId: 'entity-a', yaw: 0.6, frame: projectWorldFrame(), frameReference: frameReference() }
		});
		expect(prepare('set-yaw', snapshot, identity)).toMatchObject({ kind: 'prepared' });
	});
});

describe('scene record-scope guard', () => {
	const before: CameraFreeSceneDocument = sceneWith(
		[box('entity-a', [3, 0.5, 2]), box('entity-b', [1, 0.5, 1])],
		[
			{ id: 'cluster-1', name: 'Group', memberIds: ['entity-a', 'entity-b'] },
			{ id: 'cluster-2', name: 'Other', memberIds: ['entity-a', 'entity-b'] }
		]
	);

	it('refuses an untargeted entity, an untargeted cluster and a field the operation does not own', () => {
		const rewrittenEntity = { ...before, entities: [before.entities[0]!, box('entity-b', [6, 0.5, 5])] };
		expect(
			checkSceneRecordScope(before, rewrittenEntity, {
				operationKind: 'move-horizontal',
				changedEntityIds: ['entity-a'],
				changedEntityFields: ['position[0]', 'position[2]'],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false
			})
		).toContainEqual({
			path: '$.scene.entities.entity-b',
			code: 'record-scope-violation',
			message: expect.stringContaining('untargeted')
		});

		const rewrittenCluster = {
			...before,
			clusters: [
				{ id: 'cluster-1', name: 'Group', memberIds: ['entity-b', 'entity-a'] },
				before.clusters![1]!
			]
		};
		expect(
			checkSceneRecordScope(before, rewrittenCluster, {
				operationKind: 'set-yaw',
				changedEntityIds: ['entity-a'],
				changedEntityFields: [YAW_SCOPE_FIELD],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false
			})
		).toContainEqual({
			path: '$.scene.clusters.cluster-1.memberIds',
			code: 'record-scope-violation',
			message: expect.stringContaining('membership')
		});

		const renamed = {
			...before,
			entities: [{ ...before.entities[0]!, name: 'Renamed' }, before.entities[1]!]
		};
		expect(
			checkSceneRecordScope(before, renamed, {
				operationKind: 'set-yaw',
				changedEntityIds: ['entity-a'],
				changedEntityFields: [YAW_SCOPE_FIELD],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false
			})
		).toContainEqual({
			path: '$.scene.entities.entity-a',
			code: 'record-scope-violation',
			message: expect.stringContaining('does not own')
		});
	});

	it('grants only the position components each horizontal operation owns', () => {
		const withEntity = (patch: Partial<ScenePrimitiveEntity>): CameraFreeSceneDocument => ({
			...before,
			entities: [{ ...before.entities[0]!, ...patch } as SceneEntity, before.entities[1]!]
		});
		const moveScope = {
			operationKind: 'move-horizontal',
			changedEntityIds: ['entity-a'],
			changedEntityFields: ['position[0]', 'position[2]'],
			createdEntityIds: [],
			removedEntityIds: [],
			allowClusterCleanup: false
		};
		const resizeScope = {
			operationKind: 'resize-on-floor',
			changedEntityIds: ['entity-a'],
			changedEntityFields: ['position[1]', 'scale'],
			createdEntityIds: [],
			removedEntityIds: [],
			allowClusterCleanup: false
		};

		expect(
			checkSceneRecordScope(
				before,
				withEntity({ position: [4, 0.5, 3] }),
				moveScope
			)
		).toEqual([]);
		expect(
			checkSceneRecordScope(
				before,
				withEntity({ position: [4, 0.75, 3] }),
				moveScope
			)
		).toContainEqual({
			path: '$.scene.entities.entity-a',
			code: 'record-scope-violation',
			message: expect.stringContaining('does not own')
		});

		expect(
			checkSceneRecordScope(
				before,
				withEntity({ position: [3, 1, 2], scale: 2 }),
				resizeScope
			)
		).toEqual([]);
		const forbiddenResizePositions: Vec3[] = [
			[3.25, 1, 2],
			[3, 1, 2.25]
		];
		for (const position of forbiddenResizePositions) {
			expect(
				checkSceneRecordScope(
					before,
					withEntity({ position, scale: 2 }),
					resizeScope
				)
			).toContainEqual({
				path: '$.scene.entities.entity-a',
				code: 'record-scope-violation',
				message: expect.stringContaining('does not own')
			});
		}
	});

	it('admits a yaw change but refuses one that rewrites the pitch or roll it does not own', () => {
		// This is the exact grant `set-yaw` (and `place-on-floor` with a captured
		// yaw) hands the guard: `rotation[1]`, one component of a vector field.
		// Pitch and roll stay inside the exact comparison, so a planner that spins
		// the object about another axis is refused rather than waved through as
		// "rotation changed".
		const scope = {
			operationKind: 'set-yaw',
			changedEntityIds: ['entity-a'],
			changedEntityFields: [YAW_SCOPE_FIELD],
			createdEntityIds: [],
			removedEntityIds: [],
			allowClusterCleanup: false
		};
		const withRotation = (rotation: readonly [number, number, number]): CameraFreeSceneDocument => ({
			...before,
			entities: [{ ...before.entities[0]!, rotation: [...rotation] as Vec3 }, before.entities[1]!]
		});

		expect(checkSceneRecordScope(before, withRotation([0, 0.75, 0]), scope)).toEqual([]);

		for (const rotation of [
			[0.25, 0.75, 0],
			[0, 0.75, 0.25]
		] as const) {
			expect(checkSceneRecordScope(before, withRotation(rotation), scope)).toContainEqual({
				path: '$.scene.entities.entity-a',
				code: 'record-scope-violation',
				message: expect.stringContaining('does not own')
			});
		}

		// The grant really is per-component, not a whole-field pass: granting
		// `rotation` instead admits both spins, which is what a coarse grant would
		// have allowed in production.
		const wholeField = { ...scope, changedEntityFields: ['rotation'] };
		expect(checkSceneRecordScope(before, withRotation([0.25, 0.75, 0.25]), wholeField)).toEqual([]);
	});

	it('refuses a top-level field the Scene format does not define yet', () => {
		// The comparison is derived from the documents, not a fixed list of known
		// fields, so a new Scene field is protected the day it lands.
		const withUnknownField = { ...before, storyboard: { frames: [] } } as unknown as CameraFreeSceneDocument;
		expect(
			checkSceneRecordScope(before, withUnknownField, {
				operationKind: 'set-yaw',
				changedEntityIds: ['entity-a'],
				changedEntityFields: [YAW_SCOPE_FIELD],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false
			})
		).toContainEqual({
			path: '$.scene.storyboard',
			code: 'record-scope-violation',
			message: expect.stringContaining('outside')
		});
	});

	it('refuses a created entity that joins a cluster or an uncaptured new cluster', () => {
		const created = box('entity-new', [3, 0.5, 2]);
		const joined = {
			...before,
			entities: [...before.entities, created],
			clusters: [{ id: 'cluster-1', name: 'Group', memberIds: [...before.clusters![0]!.memberIds, 'entity-new'] }]
		};
		expect(
			checkSceneRecordScope(before, joined, {
				operationKind: 'place-object',
				changedEntityIds: [],
				changedEntityFields: [],
				createdEntityIds: ['entity-new'],
				removedEntityIds: [],
				allowClusterCleanup: false
			})
		).toContainEqual({
			path: '$.scene.clusters.cluster-1.memberIds',
			code: 'record-scope-violation',
			message: expect.stringContaining('cannot join')
		});

		const newCluster = {
			...before,
			entities: [...before.entities, created],
			clusters: [...before.clusters!, { id: 'cluster-new', name: 'New', memberIds: ['entity-a', 'entity-new'] }]
		};
		expect(
			checkSceneRecordScope(before, newCluster, {
				operationKind: 'place-object',
				changedEntityIds: [],
				changedEntityFields: [],
				createdEntityIds: ['entity-new'],
				removedEntityIds: [],
				allowClusterCleanup: false
			})
		).toContainEqual({
			path: '$.scene.clusters.cluster-new',
			code: 'record-scope-violation',
			message: expect.stringContaining('is new')
		});
	});

	it('refuses a cluster field the Scene format does not define yet', () => {
		const withClusterField = {
			...before,
			clusters: [
				{ ...before.clusters![0]!, tint: '#ffffff' },
				before.clusters![1]!
			]
		} as unknown as CameraFreeSceneDocument;
		expect(
			checkSceneRecordScope(before, withClusterField, {
				operationKind: 'set-yaw',
				changedEntityIds: ['entity-a'],
				changedEntityFields: [YAW_SCOPE_FIELD],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false
			})
		).toContainEqual({
			path: '$.scene.clusters.cluster-1.tint',
			code: 'record-scope-violation',
			message: expect.stringContaining('outside')
		});
	});

	it('admits exactly the delete cleanup: removed id out of membership, below-minimum cluster dropped', () => {
		const after: CameraFreeSceneDocument = {
			...before,
			entities: [before.entities[0]!],
			clusters: [{ id: 'cluster-1', name: 'Group', memberIds: ['entity-a'] }, before.clusters![1]!]
		};
		// The remaining one-member cluster is invalid shape, so the *cleanup* must
		// drop it; the guard reports the kept cluster, and a correct candidate has
		// no cluster at all here.
		expect(
			checkSceneRecordScope(before, after, {
				operationKind: 'delete-one',
				changedEntityIds: [],
				changedEntityFields: [],
				createdEntityIds: [],
				removedEntityIds: ['entity-b'],
				allowClusterCleanup: true
			})
		).toContainEqual({
			path: '$.scene.clusters.cluster-1.memberIds',
			code: 'record-scope-violation',
			message: expect.stringContaining('two-member minimum')
		});

		const cleaned: CameraFreeSceneDocument = { ...before, entities: [before.entities[0]!], clusters: [] };
		expect(
			checkSceneRecordScope(before, cleaned, {
				operationKind: 'delete-one',
				changedEntityIds: [],
				changedEntityFields: [],
				createdEntityIds: [],
				removedEntityIds: ['entity-b'],
				allowClusterCleanup: true
			})
		).toEqual([]);
	});
});

describe('snapshot-qualified support selection', () => {
	function candidate(elevation: number, orderKey: string): FloorSupportCandidate {
		return {
			queryPoint: [3, 2],
			elevation,
			upNormal: [0, 1, 0],
			generationId: GENERATION,
			witnesses: [
				{
					floorId: 'floor',
					roomId: `room-${orderKey}`,
					recordId: `record-${orderKey}`,
					cacheKey: `cache-${orderKey}`,
					sourceId: `source-${orderKey}`,
					orderKey
				}
			],
			orderKey,
			label: `Floor floor / Room ${orderKey}`
		};
	}

	it('filters by the required resting elevation and never picks one', () => {
		const candidates = [candidate(0, 'a'), candidate(2.5, 'b')];
		expect(selectSceneSupport({ candidates, generationId: GENERATION, requiredElevation: 0 })).toMatchObject({
			kind: 'resolved',
			support: { orderKey: 'a' }
		});
		expect(selectSceneSupport({ candidates, generationId: GENERATION, requiredElevation: 2.5 })).toMatchObject({
			kind: 'resolved',
			support: { orderKey: 'b' }
		});
		expect(selectSceneSupport({ candidates: [candidate(0, 'a')], generationId: GENERATION, requiredElevation: 9 })).toMatchObject({
			kind: 'no-support',
			availableElevations: [0]
		});
	});

	it('asks for a choice when two floor contexts are eligible, whatever the candidate order', () => {
		const candidates = [candidate(0, 'a'), candidate(0, 'b')];
		expect(selectSceneSupport({ candidates, generationId: GENERATION, requiredElevation: 0 }).kind).toBe('choice-required');
		expect(selectSceneSupport({ candidates: [...candidates].reverse(), generationId: GENERATION, requiredElevation: 0 }).kind).toBe('choice-required');
		const chosen = selectSceneSupport({
			candidates,
			generationId: GENERATION,
			requiredElevation: 0,
			choice: { kind: 'order-key', orderKey: 'b', generationId: GENERATION }
		});
		expect(chosen).toMatchObject({ kind: 'resolved', support: { orderKey: 'b' } });
		const reordered = selectSceneSupport({
			candidates: [...candidates].reverse(),
			generationId: GENERATION,
			requiredElevation: 0,
			choice: { kind: 'order-key', orderKey: 'b', generationId: GENERATION }
		});
		expect(reordered).toEqual(chosen);
	});

	it('refuses a choice from another generation and one this snapshot no longer yields', () => {
		const candidates = [candidate(0, 'a')];
		expect(
			selectSceneSupport({
				candidates,
				generationId: GENERATION,
				requiredElevation: 0,
				choice: { kind: 'order-key', orderKey: 'a', generationId: 'old' }
			})
		).toMatchObject({ kind: 'stale-generation' });
		expect(
			selectSceneSupport({
				candidates,
				generationId: GENERATION,
				requiredElevation: 0,
				choice: { kind: 'order-key', orderKey: 'gone', generationId: GENERATION }
			}).kind
		).toBe('choice-required');
	});

	it('discloses only the contexts the operation could actually use', () => {
		const mixed = [candidate(0, 'a'), candidate(2.5, 'b')];
		const remains = selectSceneSupport({
			candidates: mixed,
			generationId: GENERATION,
			requiredElevation: 2.5,
			choice: { kind: 'order-key', orderKey: 'gone', generationId: GENERATION }
		});
		expect(remains.kind).toBe('choice-required');
		if (remains.kind !== 'choice-required') return;
		// A candidate at 0 m would refuse on selection, so it is not offered.
		expect(remains.candidates.map((entry) => entry.orderKey)).toEqual(['b']);

		const noneEligible = selectSceneSupport({
			candidates: [candidate(0, 'a'), candidate(0, 'b')],
			generationId: GENERATION,
			requiredElevation: 9,
			choice: { kind: 'order-key', orderKey: 'gone', generationId: GENERATION }
		});
		expect(noneEligible).toMatchObject({ kind: 'no-support', availableElevations: [0] });
	});

	it('derives a stable generation identity from the snapshot content', async () => {
		const project = await projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const candidates = supportCandidates(snapshot);
		expect(candidates).toHaveLength(1);
		expect(candidates[0]!.generationId).toBe(sceneSupportGenerationId(snapshot.sourceContentId));
	});
});

describe('scene operation determinism and write ownership', () => {
	it('prepares every operation as detached data without writing the accepted source', async () => {
		const project = await projectWith(
			sceneWith([box('entity-a', [3, ELEVATION + 0.5, 2]), box('entity-b', [1, ELEVATION + 0.5, 1])]),
			ELEVATION
		);
		const snapshot = await snapshotOf(project);
		const before = JSON.stringify(snapshot.domain.source);
		const contentId = sceneTargetRevision(snapshot);
		const target = (entityId: string) => [entityTarget(contentId, entityId)];
		const captured: Array<[string, AuthoringIntent]> = [
			['place-object', intent({ kind: 'place-object', operationId: 'all-place', snapshot, payload: placePayload(), allocatedIds: [{ kind: 'scene-entity', id: 'entity-new' }] })],
			['move-horizontal', intent({ kind: 'move-horizontal', operationId: 'all-move', snapshot, targets: target('entity-a'), payload: { entityId: 'entity-a', worldXZ: [4, 3], frame: projectWorldFrame(), frameReference: frameReference(), contactMinY: -0.5 } })],
			['set-yaw', intent({ kind: 'set-yaw', operationId: 'all-yaw', snapshot, targets: target('entity-a'), payload: { entityId: 'entity-a', yaw: 0.6, frame: projectWorldFrame(), frameReference: frameReference() } })],
			['place-on-floor', intent({ kind: 'place-on-floor', operationId: 'all-seat', snapshot, targets: target('entity-a'), payload: { entityId: 'entity-a', worldXZ: [1, 1], frame: projectWorldFrame(), frameReference: frameReference(), contactMinY: -0.5 } })],
			['resize-on-floor', intent({ kind: 'resize-on-floor', operationId: 'all-resize', snapshot, targets: target('entity-a'), payload: { entityId: 'entity-a', scale: 2, contactMinY: -0.5 } })],
			['duplicate-one', intent({ kind: 'duplicate-one', operationId: 'all-duplicate', snapshot, targets: target('entity-a'), payload: { entityId: 'entity-a', contactMinY: -0.5 }, allocatedIds: [{ kind: 'scene-entity', id: 'entity-copy' }] })],
			['delete-one', intent({ kind: 'delete-one', operationId: 'all-delete', snapshot, targets: target('entity-b'), payload: { entityId: 'entity-b' } })]
		];
		for (const [kind, capturedIntent] of captured) {
			const result = prepare(kind, snapshot, capturedIntent, [nativeBoxDefinition()]);
			expect(result.kind, kind).toBe('prepared');
			// Every planner is preparation only: the accepted source is untouched and
			// the candidate is new data. No Scene write exists outside F.4's install.
			expect(JSON.stringify(snapshot.domain.source), kind).toBe(before);
			if (result.kind !== 'prepared') continue;
			expect(result.candidate.source, kind).not.toBe(snapshot.domain.source);
			expect(result.candidate.source.units.scene.data, kind).not.toBe(snapshot.domain.source.units.scene.data);
			expect(result.candidate.source.units.layout.data, kind).toBe(snapshot.domain.source.units.layout.data);
		}
	});

	it('replays every operation to an identical candidate and never mutates the source', async () => {
		const project = await projectWith(
			sceneWith([box('entity-a', [3, ELEVATION + 0.5, 2]), box('entity-b', [1, ELEVATION + 0.5, 1])]),
			ELEVATION
		);
		const snapshot = await snapshotOf(project);
		const before = JSON.stringify(snapshot.domain.source);
		const target = (entityId: string) => [entityTarget(sceneTargetRevision(snapshot), entityId)];
		// Every operation replays: the ones with support queries, allocations and
		// array writes are where a hidden read of time, order or the catalogue would
		// surface, so a yaw-only replay would prove the least.
		const captured: Array<[string, AuthoringIntent]> = [
			['place-object', intent({ kind: 'place-object', operationId: 'replay-place', snapshot, payload: placePayload(), allocatedIds: [{ kind: 'scene-entity', id: 'entity-new' }] })],
			['move-horizontal', intent({ kind: 'move-horizontal', operationId: 'replay-move', snapshot, targets: target('entity-a'), payload: { entityId: 'entity-a', worldXZ: [4, 3], frame: projectWorldFrame(), frameReference: frameReference(), contactMinY: -0.5 } })],
			['set-yaw', intent({ kind: 'set-yaw', operationId: 'replay-yaw', snapshot, targets: target('entity-a'), payload: { entityId: 'entity-a', yaw: 0.6, frame: projectWorldFrame(), frameReference: frameReference() } })],
			['place-on-floor', intent({ kind: 'place-on-floor', operationId: 'replay-seat', snapshot, targets: target('entity-a'), payload: { entityId: 'entity-a', worldXZ: [1, 1], frame: projectWorldFrame(), frameReference: frameReference(), contactMinY: -0.5 } })],
			['resize-on-floor', intent({ kind: 'resize-on-floor', operationId: 'replay-resize', snapshot, targets: target('entity-a'), payload: { entityId: 'entity-a', scale: 2, contactMinY: -0.5 } })],
			['duplicate-one', intent({ kind: 'duplicate-one', operationId: 'replay-duplicate', snapshot, targets: target('entity-a'), payload: { entityId: 'entity-a', contactMinY: -0.5 }, allocatedIds: [{ kind: 'scene-entity', id: 'entity-copy' }] })],
			['delete-one', intent({ kind: 'delete-one', operationId: 'replay-delete', snapshot, targets: target('entity-b'), payload: { entityId: 'entity-b' } })]
		];
		expect(captured.map(([kind]) => kind).sort()).toEqual(
			[
				'place-object',
				'move-horizontal',
				'set-yaw',
				'place-on-floor',
				'resize-on-floor',
				'duplicate-one',
				'delete-one'
			].sort()
		);
		for (const [kind, capturedIntent] of captured) {
			const first = prepare(kind, snapshot, capturedIntent, [nativeBoxDefinition()]);
			const second = prepare(kind, snapshot, capturedIntent, [nativeBoxDefinition()]);
			expect(first.kind, kind).toBe('prepared');
			expect(second, kind).toEqual(first);
			expect(JSON.stringify(snapshot.domain.source), kind).toBe(before);
			if (first.kind !== 'prepared') continue;
			// A prepared candidate is new data, never the accepted source rewritten.
			expect(first.candidate.source, kind).not.toBe(snapshot.domain.source);
			expect(first.candidate.source.units.scene.data, kind).not.toBe(snapshot.domain.source.units.scene.data);
			expect(first.candidate.source.units.layout.data, kind).toBe(snapshot.domain.source.units.layout.data);
		}
	});
});

describe('scene operation planners — native forms', () => {
	it('creates one recentred, keyed form resting on floor support', async () => {
		const snapshot = await snapshotOf(await projectWith(sceneWith([]), 0));
		const captured = intent({
			kind: 'create-form',
			operationId: 'create-form-1',
			snapshot,
			payload: formCreatePayload(),
			allocatedIds: [{ kind: 'scene-entity', id: 'form-1' }]
		});
		const result = prepare('create-form', snapshot, captured);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const entity = result.candidate.source.units.scene.data.entities.find(
			(candidate) => candidate.id === 'form-1'
		);
		expect(entity?.kind).toBe('form');
		if (entity?.kind !== 'form') return;
		// The drawn 2 × 1 outline is recentred on its evaluated bounds; the world
		// base origin moves by the same offset, so it lands at (4, 0, 2.5).
		expect(entity.position).toEqual([4, 0, 2.5]);
		expect(entity.form.generator.outline).toEqual([
			{ key: 1, u: -1, v: -0.5, smooth: false },
			{ key: 2, u: 1, v: -0.5, smooth: false },
			{ key: 3, u: 1, v: 0.5, smooth: false },
			{ key: 4, u: -1, v: 0.5, smooth: false }
		]);
		expect(entity.form.nextKey).toBe(5);
		expect(entity.form.scale).toEqual([1, 1, 1]);
		expect(entity.rotation).toEqual([0, 0, 0]);
		expect(result.candidate.changes[0]?.kind).toBe('scene-create-form');
	});

	it('canonicalizes a clockwise drawn outline and recentres elevation forms at min v', async () => {
		const clockwise = [
			{ u: 0, v: 2, smooth: false },
			{ u: 0, v: 3, smooth: false },
			{ u: 2, v: 3, smooth: false },
			{ u: 2, v: 2, smooth: false }
		];
		const snapshot = await snapshotOf(await projectWith(sceneWith([]), 0));
		const captured = intent({
			kind: 'create-form',
			operationId: 'create-form-2',
			snapshot,
			payload: formCreatePayload({ plane: 'elevation', outline: clockwise }),
			allocatedIds: [{ kind: 'scene-entity', id: 'form-2' }]
		});
		const result = prepare('create-form', snapshot, captured);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const entity = result.candidate.source.units.scene.data.entities.find(
			(candidate) => candidate.id === 'form-2'
		);
		expect(entity?.kind).toBe('form');
		if (entity?.kind !== 'form') return;
		expect(entity.position).toEqual([4, 0, 2]);
		expect(entity.form.generator.plane).toBe('elevation');
		expect(entity.form.generator.outline.map((anchor) => anchor.key)).toEqual([1, 2, 3, 4]);
		expect(Math.min(...entity.form.generator.outline.map((anchor) => anchor.v))).toBe(0);
		expect(entity.form.generator.outline.map((anchor) => anchor.u)).toEqual([1, 1, -1, -1]);
	});

	it('refuses invalid outlines, missing allocations and occupied ids without a candidate', async () => {
		const snapshot = await snapshotOf(await projectWith(sceneWith([]), 0));
		const invalid = prepare(
			'create-form',
			snapshot,
			intent({
				kind: 'create-form',
				operationId: 'create-form-bad',
				snapshot,
				payload: formCreatePayload({
					outline: [
						{ u: 0, v: 0, smooth: false },
						{ u: 2, v: 2, smooth: false },
						{ u: 2, v: 0, smooth: false },
						{ u: 0, v: 2, smooth: false }
					]
				}),
				allocatedIds: [{ kind: 'scene-entity', id: 'form-bad' }]
			})
		);
		expect(invalid.kind).toBe('rejected');
		if (invalid.kind === 'rejected') {
			expect(invalid.code).toBe('invalid-value');
			expect(invalid.diagnostics.map((issue) => issue.message).join(' ')).toContain(
				'self-intersecting'
			);
		}

		const missing = prepare(
			'create-form',
			snapshot,
			intent({
				kind: 'create-form',
				operationId: 'create-form-missing',
				snapshot,
				payload: formCreatePayload()
			})
		);
		expect(missing.kind).toBe('rejected');

		const occupied = await projectWith(sceneWith([formEntity('form-1')]));
		const occupiedSnapshot = await snapshotOf(occupied);
		const duplicateId = prepare(
			'create-form',
			occupiedSnapshot,
			intent({
				kind: 'create-form',
				operationId: 'create-form-occupied',
				snapshot: occupiedSnapshot,
				payload: formCreatePayload(),
				allocatedIds: [{ kind: 'scene-entity', id: 'form-1' }]
			})
		);
		expect(duplicateId.kind).toBe('rejected');
	});

	it('sizes a form per axis, keeps its outline and rests it on support', async () => {
		const entity = formEntity('form-1', {
			plane: 'elevation',
			position: [3, 1, 2],
			outline: [
				{ key: 1, u: -1, v: -1, smooth: false },
				{ key: 2, u: 1, v: -1, smooth: false },
				{ key: 3, u: 1, v: 1, smooth: false },
				{ key: 4, u: -1, v: 1, smooth: false }
			]
		});
		const snapshot = await snapshotOf(await projectWith(sceneWith([entity])));
		const captured = intent({
			kind: 'set-form-size',
			operationId: 'size-form',
			snapshot,
			targets: [entityTarget(sceneTargetRevision(snapshot), 'form-1')],
			payload: { entityId: 'form-1', scale: [1, 2, 1] }
		});
		const result = prepare('set-form-size', snapshot, captured);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const sized = result.candidate.source.units.scene.data.entities[0]!;
		expect(sized.kind).toBe('form');
		if (sized.kind !== 'form') return;
		expect(sized.form.scale).toEqual([1, 2, 1]);
		expect(sized.form.generator.outline).toEqual(entity.form.generator.outline);
		expect(sized.position).toEqual([3, 2, 2]);
		expect(result.candidate.changes[0]?.fields).toEqual(['form', 'position']);
	});

	it('refuses a non-form target, an out-of-range or no-op size, and an outline key', async () => {
		const boxEntity = box('entity-a', [3, 0, 2]);
		const snapshot = await snapshotOf(await projectWith(sceneWith([boxEntity])));
		const target = entityTarget(sceneTargetRevision(snapshot), 'entity-a');
		const nonForm = prepare(
			'set-form-size',
			snapshot,
			intent({
				kind: 'set-form-size',
				operationId: 'size-box',
				snapshot,
				targets: [target],
				payload: { entityId: 'entity-a', scale: [2, 1, 3] }
			})
		);
		expect(nonForm.kind).toBe('rejected');
		if (nonForm.kind === 'rejected') expect(nonForm.code).toBe('unsupported-transform');

		const formProject = await projectWith(sceneWith([formEntity('form-1')]));
		const formSnapshot = await snapshotOf(formProject);
		const formTarget = entityTarget(sceneTargetRevision(formSnapshot), 'form-1');
		const outOfRange = prepare(
			'set-form-size',
			formSnapshot,
			intent({
				kind: 'set-form-size',
				operationId: 'size-form-bad',
				snapshot: formSnapshot,
				targets: [formTarget],
				payload: { entityId: 'form-1', scale: [0.001, 1, 1] }
			})
		);
		expect(outOfRange.kind).toBe('rejected');
		const noOp = prepare(
			'set-form-size',
			formSnapshot,
			intent({
				kind: 'set-form-size',
				operationId: 'size-form-noop',
				snapshot: formSnapshot,
				targets: [formTarget],
				payload: { entityId: 'form-1', scale: [1, 1, 1] }
			})
		);
		expect(noOp.kind).toBe('rejected');
		if (noOp.kind === 'rejected') expect(noOp.code).toBe('no_op');
		const outlineChange = prepare(
			'set-form-size',
			formSnapshot,
			intent({
				kind: 'set-form-size',
				operationId: 'size-form-outline',
				snapshot: formSnapshot,
				targets: [formTarget],
				payload: {
					entityId: 'form-1',
					scale: [2, 1, 3],
					outline: [{ u: 0, v: 0, smooth: false }]
				}
			})
		);
		expect(outlineChange.kind).toBe('rejected');
	});

	it('supports move, yaw, place, duplicate and delete on forms, and refuses uniform resize', async () => {
		const entity = formEntity('form-1');
		const snapshot = await snapshotOf(await projectWith(sceneWith([entity])));
		const target = entityTarget(sceneTargetRevision(snapshot), 'form-1');
		const move = prepare(
			'move-horizontal',
			snapshot,
			intent({
				kind: 'move-horizontal',
				operationId: 'move-form',
				snapshot,
				targets: [target],
				payload: {
					entityId: 'form-1',
					worldXZ: [4, 3],
					frame: projectWorldFrame(),
					frameReference: frameReference(),
					contactMinY: 0
				}
			})
		);
		expect(move.kind).toBe('prepared');
		const yaw = prepare(
			'set-yaw',
			snapshot,
			intent({
				kind: 'set-yaw',
				operationId: 'yaw-form',
				snapshot,
				targets: [target],
				payload: {
					entityId: 'form-1',
					yaw: 0.75,
					frame: projectWorldFrame(),
					frameReference: frameReference()
				}
			})
		);
		expect(yaw.kind).toBe('prepared');
		const place = prepare(
			'place-on-floor',
			snapshot,
			intent({
				kind: 'place-on-floor',
				operationId: 'place-form',
				snapshot,
				targets: [target],
				payload: {
					entityId: 'form-1',
					worldXZ: [1, 1],
					frame: projectWorldFrame(),
					frameReference: frameReference(),
					contactMinY: 0
				}
			})
		);
		expect(place.kind).toBe('prepared');
		const duplicate = prepare(
			'duplicate-one',
			snapshot,
			intent({
				kind: 'duplicate-one',
				operationId: 'duplicate-form',
				snapshot,
				targets: [target],
				payload: { entityId: 'form-1', contactMinY: 0 },
				allocatedIds: [{ kind: 'scene-entity', id: 'form-copy' }]
			})
		);
		expect(duplicate.kind).toBe('prepared');
		if (duplicate.kind === 'prepared') {
			const copy = duplicate.candidate.source.units.scene.data.entities.find(
				(candidate) => candidate.id === 'form-copy'
			);
			expect(copy?.kind).toBe('form');
			if (copy?.kind === 'form' && entity.kind === 'form') {
				expect(copy.form).toEqual(entity.form);
				expect(copy.form).not.toBe(entity.form);
				expect(copy.form.generator.outline).not.toBe(entity.form.generator.outline);
			}
		}
		const remove = prepare(
			'delete-one',
			snapshot,
			intent({
				kind: 'delete-one',
				operationId: 'delete-form',
				snapshot,
				targets: [target],
				payload: { entityId: 'form-1' }
			})
		);
		expect(remove.kind).toBe('prepared');
		const resize = prepare(
			'resize-on-floor',
			snapshot,
			intent({
				kind: 'resize-on-floor',
				operationId: 'resize-form',
				snapshot,
				targets: [target],
				payload: { entityId: 'form-1', scale: 2, contactMinY: 0 }
			})
		);
		expect(resize.kind).toBe('rejected');
		if (resize.kind === 'rejected') {
			expect(resize.code).toBe('unsupported-transform');
			expect(resize.message).toMatch(/per axis/);
		}
	});

	it('refuses a captured contact that disagrees with the form source', async () => {
		const snapshot = await snapshotOf(await projectWith(sceneWith([formEntity('form-1')])));
		const result = prepare(
			'move-horizontal',
			snapshot,
			intent({
				kind: 'move-horizontal',
				operationId: 'move-form-contact',
				snapshot,
				targets: [entityTarget(sceneTargetRevision(snapshot), 'form-1')],
				payload: {
					entityId: 'form-1',
					worldXZ: [4, 3],
					frame: projectWorldFrame(),
					frameReference: frameReference(),
					contactMinY: 1
				}
			})
		);
		expect(result.kind).toBe('rejected');
		if (result.kind === 'rejected') expect(result.code).toBe('missing-contact-metadata');
	});

	it('grants only form.scale and position[1] on a sized form', async () => {
		const before: CameraFreeSceneDocument = sceneWith([formEntity('form-1')]);
		const after = JSON.parse(JSON.stringify(before)) as CameraFreeSceneDocument;
		const target = after.entities[0];
		expect(target?.kind).toBe('form');
		if (target?.kind !== 'form') return;
		target.form.scale = [2, 1, 3];
		target.position = [3, 1, 2];
		expect(
			checkSceneRecordScope(before, after, {
				operationKind: 'set-form-size',
				changedEntityIds: ['form-1'],
				changedEntityFields: [FORM_SCALE_SCOPE_FIELD, 'position[1]'],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false
			})
		).toEqual([]);

		const overreach = JSON.parse(JSON.stringify(after)) as CameraFreeSceneDocument;
		const changed = overreach.entities[0];
		if (changed?.kind !== 'form') return;
		changed.form.generator.extent = 2;
		expect(
			checkSceneRecordScope(before, overreach, {
				operationKind: 'set-form-size',
				changedEntityIds: ['form-1'],
				changedEntityFields: [FORM_SCALE_SCOPE_FIELD, 'position[1]'],
				createdEntityIds: [],
				removedEntityIds: [],
				allowClusterCleanup: false
			}).map((issue) => issue.code)
		).toContain('record-scope-violation');
	});
});
