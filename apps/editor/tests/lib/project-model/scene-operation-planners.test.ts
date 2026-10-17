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
	createEmptyWallFirstProject,
	admitCurrentSource,
	createScenePlanners,
	selectSceneSupport,
	checkSceneRecordScope,
	DUPLICATE_OFFSET_METERS,
	YAW_SCOPE_FIELD,
	sceneSupportGenerationId,
	type AcceptedSnapshot,
	type AuthoringIntent,
	type DomainPlanner,
	type NormalizedPlacementDefinition,
	type ProjectDocument,
	type SceneDocument,
	type SceneEntity,
	type SceneObjectCluster,
	type ScenePrimitiveEntity,
	type SemanticReference,
	type Vec3
} from '@portfolio/project-model';
import {
	floorSupportSnapshotOf,
	compileWallFirstLayoutGeometry,
	queryFloorSupports,
	planWallChain,
	type FloorSupportCandidate
} from '@portfolio/layout-core';

const ELEVATION = 2.5;
const GENERATION = sceneSupportGenerationId('content-1');

function supportedProject(elevation = 0): ProjectDocument {
	const base = createEmptyWallFirstProject({ id: 'project-1', name: 'Gallery' });
	const baseline = { ...base.layout, floor: { ...base.layout.floor, elevation } };
	const planned = planWallChain({
		baseline,
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6]
		],
		close: true,
		role: 'boundary'
	});
	if (planned.kind !== 'success') throw new Error('the support fixture enclosure was refused');
	return { ...base, layout: planned.document };
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
	materials: SceneDocument['materials'] = []
): SceneDocument {
	return {
		formatVersion: 1,
		textures: [],
		materials,
		entities: [...entities],
		...(clusters === undefined ? {} : { clusters: [...clusters] }),
		navigationNodes: [
			{
				id: 'tour-a',
				label: 'Tour A',
				position: [1, 1.65, 1],
				cameraTarget: [1, 1.25, -2],
				fov: 54,
				connectedNodeIds: ['tour-b'],
				nextNodeId: 'tour-b'
			},
			{
				id: 'tour-b',
				label: 'Tour B',
				position: [4, 1.65, 3],
				cameraTarget: [4, 1.25, 0],
				fov: 54,
				connectedNodeIds: ['tour-a'],
				previousNodeId: 'tour-a'
			}
		],
		connections: [
			{
				id: 'tour-a-b',
				fromNodeId: 'tour-a',
				toNodeId: 'tour-b',
				clearance: 0.35,
				positionPath: { kind: 'auto-bezier', anchors: [] }
			}
		]
	};
}

function projectWith(
	scene: SceneDocument,
	elevation = 0
): ProjectDocument {
	return { ...supportedProject(elevation), scene };
}

async function snapshotOf(project: ProjectDocument): Promise<AcceptedSnapshot<ProjectDocument>> {
	const admitted = await admitCurrentSource(project, {
		acceptedRevision: { projectId: project.id, revisionId: 'revision-1' }
	});
	if (admitted.kind !== 'admitted') {
		throw new Error(`the fixture was not admitted: ${JSON.stringify(admitted.issues)}`);
	}
	return admitted.snapshot;
}

function intent(input: {
	readonly kind: string;
	readonly operationId: string;
	readonly snapshot: AcceptedSnapshot<ProjectDocument>;
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

function projectWorldFrame(): { origin: Vec3; yaw: number } {
	return { origin: [0, 0, 0], yaw: 0 };
}

function frameReference() {
	return { version: 1 as const, kind: 'project-world' as const };
}

function plannerFor(
	kind: string,
	definitions: readonly NormalizedPlacementDefinition[] = []
): DomainPlanner<ProjectDocument> {
	const planner = createScenePlanners({ definitions }).find((candidate) => candidate.kind === kind);
	if (planner === undefined) throw new Error(`no planner for ${kind}`);
	return planner;
}

function prepare(
	kind: string,
	snapshot: AcceptedSnapshot<ProjectDocument>,
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

function cameraBytes(scene: SceneDocument): string {
	return JSON.stringify({
		navigationNodes: scene.navigationNodes,
		connections: scene.connections
	});
}

function supportCandidates(
	snapshot: AcceptedSnapshot<ProjectDocument>
): readonly FloorSupportCandidate[] {
	const compiled = compileWallFirstLayoutGeometry(snapshot.domain.source.layout);
	const queried = queryFloorSupports(floorSupportSnapshotOf(compiled.geometry), {
		generationId: sceneSupportGenerationId(snapshot.sourceContentId),
		x: 3,
		z: 2
	});
	if (queried.kind !== 'candidates') throw new Error('the support fixture yielded no candidate');
	return queried.candidates;
}

describe('scene operation planners — registration', () => {
	it('registers exactly the seven Scene operations as single-domain planners', () => {
		const planners = createScenePlanners({ definitions: [nativeBoxDefinition()] });
		expect(planners.map((planner) => planner.kind)).toEqual([
			'place-object',
			'move-horizontal',
			'set-yaw',
			'place-on-floor',
			'resize-on-floor',
			'duplicate-one',
			'delete-one'
		]);
		for (const planner of planners) {
			expect(planner.admission).toEqual({
				domain: 'scene',
				compound: false,
				units: false,
				resources: false
			});
			expect(planner.sourceKinds).toEqual(['current-source']);
			expect(planner.sourceVersions).toEqual([5]);
		}
	});
});

describe('scene operation planners — poses and ownership', () => {
	it('places one captured entity on the compiled floor, upright at relative scale 1', async () => {
		const project = projectWith(sceneWith([]), ELEVATION);
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

		const scene = result.candidate.source.scene;
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
		expect(cameraBytes(scene)).toBe(cameraBytes(snapshot.domain.source.scene));
	});

	it('moves horizontally while preserving Y, rotation, scale, dimensions and material', async () => {
		const entity = box('entity-a', [3, ELEVATION + 0.7, 2], {
			scale: 1.4,
			rotation: [0, 0.9, 0],
			materialInstanceId: 'material-1'
		});
		const project = projectWith(
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
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
		const moved = result.candidate.source.scene.entities[0]!;
		expect(moved.position).toEqual([5, ELEVATION + 0.7, 4]);
		expect(moved.rotation).toEqual([0, 0.9, 0]);
		expect(moved.scale).toBe(1.4);
		expect(moved.kind === 'primitive' ? moved.dimensions : null).toEqual({ width: 1, height: 1, depth: 1 });
		expect('materialInstanceId' in moved ? moved.materialInstanceId : null).toBe('material-1');
		expect(cameraBytes(result.candidate.source.scene)).toBe(cameraBytes(snapshot.domain.source.scene));
		expect(result.candidate.correspondence[0]!.relation).toBe('preserved');
	});

	it('sets yaw without touching position, scale or Camera bytes', async () => {
		const entity = box('entity-a', [3, ELEVATION + 0.5, 2], {
			scale: 2,
			// Sub-tolerance pitch/roll are admitted as upright; yaw must not rewrite them.
			rotation: [5e-10, 0.4, -5e-10]
		});
		const project = projectWith(sceneWith([entity]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'set-yaw',
			snapshot,
			intent({
				kind: 'set-yaw',
				operationId: 'op-yaw',
				snapshot,
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
		const yawed = result.candidate.source.scene.entities[0]!;
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
		const project = projectWith(sceneWith([entity]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'place-on-floor',
			snapshot,
			intent({
				kind: 'place-on-floor',
				operationId: 'op-seat-yaw',
				snapshot,
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
		const seated = result.candidate.source.scene.entities[0]!;
		expect(seated.rotation[0]).toBe(5e-10);
		expect(seated.rotation[1]).toBeCloseTo(0.9, 12);
		expect(seated.rotation[2]).toBe(-5e-10);
	});

	it('reseats on the floor and owns the resulting Y, preserving scale and rotation', async () => {
		const entity = box('entity-a', [3, ELEVATION + 0.5, 2], { scale: 1.5, rotation: [0, 0.4, 0] });
		const project = projectWith(sceneWith([entity]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'place-on-floor',
			snapshot,
			intent({
				kind: 'place-on-floor',
				operationId: 'op-seat',
				snapshot,
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
		const seated = result.candidate.source.scene.entities[0]!;
		expect(seated.position).toEqual([1, ELEVATION + 0.75, 1]);
		expect(seated.rotation).toEqual([0, 0.4, 0]);
		expect(seated.scale).toBe(1.5);
	});

	it('resizes uniformly and compensates Y to keep the same contact elevation', async () => {
		const entity = box('entity-a', [3, ELEVATION + 0.5, 2], { rotation: [0, 0.4, 0] });
		const project = projectWith(sceneWith([entity]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'resize-on-floor',
			snapshot,
			intent({
				kind: 'resize-on-floor',
				operationId: 'op-resize',
				snapshot,
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
				payload: { entityId: 'entity-a', scale: 2, contactMinY: -0.5 }
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const resized = result.candidate.source.scene.entities[0]!;
		expect(resized.scale).toBe(2);
		expect(resized.position).toEqual([3, ELEVATION + 1, 2]);
		expect(resized.rotation).toEqual([0, 0.4, 0]);
	});

	it('duplicates by exactly +0.5 m world X/Z, preserving every other component', async () => {
		const entity = box('entity-a', [3, ELEVATION + 0.65, 2], { scale: 1.3, rotation: [0, 0.7, 0] });
		const project = projectWith(sceneWith([entity]), ELEVATION);
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'duplicate-one',
			snapshot,
			intent({
				kind: 'duplicate-one',
				operationId: 'op-duplicate',
				snapshot,
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
				payload: { entityId: 'entity-a', contactMinY: -0.5 },
				allocatedIds: [{ kind: 'scene-entity', id: 'entity-copy' }]
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		const duplicate = result.candidate.source.scene.entities.at(-1)!;
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
		const snapshot = await snapshotOf(projectWith(scene));
		const deleteOf = (entityId: string, operationId: string, from: AcceptedSnapshot<ProjectDocument>) =>
			prepare(
				'delete-one',
				from,
				intent({
					kind: 'delete-one',
					operationId,
					snapshot: from,
					targets: [entityTarget(from.sourceContentId, entityId)],
					payload: { entityId }
				})
			);

		const kept = deleteOf('entity-c', 'op-delete-keep', snapshot);
		expect(kept.kind).toBe('prepared');
		if (kept.kind !== 'prepared') return;
		expect(kept.candidate.source.scene.entities.map((entity) => entity.id)).toEqual([
			'entity-a',
			'entity-b',
			'entity-d',
			'entity-e'
		]);
		expect(kept.candidate.source.scene.clusters).toEqual([
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
		expect(dropped.candidate.source.scene.clusters).toEqual([
			{ id: 'cluster-keep', name: 'Keep', memberIds: ['entity-a', 'entity-b', 'entity-c'] }
		]);
	});
});

describe('scene operation planners — support and refusals', () => {
	it('refuses a destination without support at the resting elevation', async () => {
		const project = projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'move-horizontal',
			snapshot,
			intent({
				kind: 'move-horizontal',
				operationId: 'op-move-out',
				snapshot,
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
		const project = projectWith(sceneWith([box('entity-corner', [6.6, 0.5, 5.6])]));
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'duplicate-one',
			snapshot,
			intent({
				kind: 'duplicate-one',
				operationId: 'op-duplicate-outside',
				snapshot,
				targets: [entityTarget(snapshot.sourceContentId, 'entity-corner')],
				payload: { entityId: 'entity-corner', contactMinY: -0.5 },
				allocatedIds: [{ kind: 'scene-entity', id: 'entity-copy' }]
			})
		);
		expect(result).toMatchObject({ kind: 'rejected', code: 'no-support' });
	});

	it('refuses a stale or unknown captured support choice instead of re-choosing', async () => {
		const project = projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const source = snapshot.sourceContentId;
		for (const [choice, code] of [
			[{ kind: 'order-key', orderKey: 'unknown', generationId: sceneSupportGenerationId(source) }, 'support-choice-required'],
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
		const project = projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const source = snapshot.sourceContentId;
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
						generationId: sceneSupportGenerationId(source)
					}
				}
			})
		);
		expect(result.kind).toBe('prepared');
		if (result.kind !== 'prepared') return;
		expect(result.candidate.source.scene.entities[0]!.position).toEqual([4, 0.5, 3]);
	});

	it('refuses a captured contact that disagrees with the primitive dimensions', async () => {
		const project = projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'move-horizontal',
			snapshot,
			intent({
				kind: 'move-horizontal',
				operationId: 'op-bad-contact',
				snapshot,
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
		const project = projectWith(
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
					targets: [entityTarget(snapshot.sourceContentId, entityId)],
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
					targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
					payload: { entityId: 'entity-a', contactMinY: -0.5 },
					allocatedIds: [{ kind: 'scene-entity', id: 'entity-copy' }]
				})
			)
		).toMatchObject({ kind: 'rejected', code: 'unsupported-set' });
	});

	it('refuses a cluster-member duplicate and a captured id that already exists', async () => {
		const project = projectWith(
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
					targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
		const project = projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const source = snapshot.sourceContentId;
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
		const project = projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const result = prepare(
			'set-yaw',
			snapshot,
			intent({
				kind: 'set-yaw',
				operationId: 'op-noop',
				snapshot,
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
		const wrapped = projectWith(sceneWith([box('entity-wrapped', [3, 0.5, 2], { rotation: [0, 4, 0] })]));
		const wrappedSnapshot = await snapshotOf(wrapped);
		const wrappedResult = prepare(
			'set-yaw',
			wrappedSnapshot,
			intent({
				kind: 'set-yaw',
				operationId: 'op-noop-wrapped',
				snapshot: wrappedSnapshot,
				targets: [entityTarget(wrappedSnapshot.sourceContentId, 'entity-wrapped')],
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
		const project = projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
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
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
		const project = projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
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
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
				payload: { entityId: 'entity-a', yaw: 0.9, frame: conversion, frameReference: ownerFrame }
			}),
			intent({
				kind: 'place-on-floor',
				operationId: 'owner-frame-seat',
				snapshot,
				targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
			targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
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
			targets: [entityTarget(snapshot.sourceContentId, 'entity-a')],
			payload: { entityId: 'entity-a', yaw: 0.6, frame: projectWorldFrame(), frameReference: frameReference() }
		});
		expect(prepare('set-yaw', snapshot, identity)).toMatchObject({ kind: 'prepared' });
	});
});

describe('scene record-scope guard', () => {
	const before: SceneDocument = sceneWith(
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
		const withEntity = (patch: Partial<ScenePrimitiveEntity>): SceneDocument => ({
			...before,
			entities: [{ ...before.entities[0]!, ...patch }, before.entities[1]!]
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
		for (const position of [
			[3.25, 1, 2],
			[3, 1, 2.25]
		] as const) {
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
		const withRotation = (rotation: readonly [number, number, number]): SceneDocument => ({
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
		const withUnknownField = { ...before, storyboard: { frames: [] } } as unknown as SceneDocument;
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
		} as unknown as SceneDocument;
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
		const after: SceneDocument = {
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

		const cleaned: SceneDocument = { ...before, entities: [before.entities[0]!], clusters: [] };
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
		const project = projectWith(sceneWith([box('entity-a', [3, 0.5, 2])]));
		const snapshot = await snapshotOf(project);
		const candidates = supportCandidates(snapshot);
		expect(candidates).toHaveLength(1);
		expect(candidates[0]!.generationId).toBe(sceneSupportGenerationId(snapshot.sourceContentId));
	});
});

describe('scene operation determinism and write ownership', () => {
	it('prepares every operation as detached data without writing the accepted source', async () => {
		const project = projectWith(
			sceneWith([box('entity-a', [3, ELEVATION + 0.5, 2]), box('entity-b', [1, ELEVATION + 0.5, 1])]),
			ELEVATION
		);
		const snapshot = await snapshotOf(project);
		const before = JSON.stringify(snapshot.domain.source);
		const contentId = snapshot.sourceContentId;
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
			expect(result.candidate.source.scene, kind).not.toBe(snapshot.domain.source.scene);
			expect(result.candidate.source.layout, kind).toBe(snapshot.domain.source.layout);
		}
	});

	it('replays every operation to an identical candidate and never mutates the source', async () => {
		const project = projectWith(
			sceneWith([box('entity-a', [3, ELEVATION + 0.5, 2]), box('entity-b', [1, ELEVATION + 0.5, 1])]),
			ELEVATION
		);
		const snapshot = await snapshotOf(project);
		const before = JSON.stringify(snapshot.domain.source);
		const target = (entityId: string) => [entityTarget(snapshot.sourceContentId, entityId)];
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
			expect(first.candidate.source.scene, kind).not.toBe(snapshot.domain.source.scene);
			expect(first.candidate.source.layout, kind).toBe(snapshot.domain.source.layout);
		}
	});
});
