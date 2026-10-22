/**
 * T1.P01.S03 conformance fixtures: the current-source projects, the host Scene
 * options and the **conformance-scoped** proof planners.
 *
 * The planners are test-only on purpose (plan §Admission: "proof registrations
 * are conformance-scoped"). S03 ships the registration seam and Layout/Scene
 * admission, not production operations: production Layout operations are
 * S04/S05's and Scene operations are `T2.P01.S02`'s, so nothing here is exported
 * from a package or reachable from `src/`.
 *
 * Every Layout candidate goes through a **retained** planner
 * (`planCommitLayoutObjectPreset` for object birth, `planExactLayoutObjectTransform`
 * for the change) rather than hand-mutated geometry: the planner's own
 * acceptance path validates, reconciles Rooms and maintains the identity ledger,
 * so a fixture that survives it is a real current-format document rather than a
 * shape that merely resembles one.
 *
 * Two skeletons are mirrored from proven fixtures: the Scene tour (two mutually
 * adjacent nodes in Sequence order, one connection, no interior anchors) from
 * `tests/lib/visitor/visitor-public-route.test.ts`, and the thick partition from
 * the P23.11 render-safe fixture in
 * `tests/lib/layout/layout-render-safe-validation.test.ts` — same constants,
 * same chain write path, so the blocking issue it produces is the one that file
 * already pins.
 */

import {
	type AuthoringIntent,
	type CapturedInput,
	type DomainPlanner,
	type F4JsonValue,
	type SceneDocument,
	type SceneEntity,
	type SceneModelEntity,
	type ScenePrimitiveEntity,
	type SceneValidationOptions,
	type SemanticDomain,
	type SemanticReference,
	type Vec3
} from '@portfolio/project-model';
import {
	replaceUnitData,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createUnitProject } from './unit-envelope-fixtures';
import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	planCommitLayoutObjectPreset,
	planExactLayoutObjectTransform,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCurveKnot
} from '@portfolio/layout-core';

/** Two distinct proof operation kinds; no production operation kind is named. */
export const PROOF_LAYOUT_TRANSFORM_KIND = 'conformance-layout-object-transform';
export const PROOF_SCENE_SCALAR_KIND = 'conformance-scene-entity-scalar';
export const PROOF_INVALID_CANDIDATE_KIND = 'conformance-invalid-candidate';

export const FIXTURE_PROJECT_ID = 'project-conformance';
export const FIXTURE_FLOOR_ID = 'floor';
export const FIXTURE_ENTITY_ID = 'entity-plinth';
export const FIXTURE_UNKNOWN_ASSET_ID = 'asset-not-in-the-host-catalogue';
/** The one asset id these host options know, for the discriminating refusal. */
export const FIXTURE_KNOWN_ASSET_ID = 'asset-host-knows';

/**
 * The host's Scene options. A model whose `assetId` the host does not know is
 * refused by these and accepted by the option-less default reader — exactly the
 * "the visitor cold runtime would refuse it" case admission must catch.
 */
export const HOST_SCENE_OPTIONS: SceneValidationOptions = {
	isKnownAssetId: (assetId: string) => assetId === FIXTURE_KNOWN_ASSET_ID
};

export type ProofLayoutSeed = {
	readonly document: LayoutDocumentWallFirst;
	readonly objectId: string;
};

/**
 * One real Layout object in an otherwise empty wall-first document, created
 * through the canonical preset planner so the identity ledger is the writer's.
 */
export function layoutSeed(): ProofLayoutSeed {
	const plan = planCommitLayoutObjectPreset(createEmptyWallFirstLayoutDocument(), 'plinth', [0, 0], 0);
	if (plan.kind !== 'success' || plan.createdObjectId === undefined) {
		throw new Error(
			`the conformance Layout seed was refused: ${plan.kind === 'rejected' ? plan.rejection.message : 'no created object id'}`
		);
	}
	return { document: plan.document, objectId: plan.createdObjectId };
}

/** `count` further real Layout objects at exact X/Z, through the same planner. */
export function withLayoutObjects(base: ProofLayoutSeed, count: number): ProofLayoutSeed {
	let document = base.document;
	let objectId = base.objectId;
	for (let index = 1; index <= count; index += 1) {
		const plan = planCommitLayoutObjectPreset(
			document,
			index % 2 === 0 ? 'column' : 'platform',
			[index * 3, index * 2],
			0
		);
		if (plan.kind !== 'success' || plan.createdObjectId === undefined) {
			throw new Error(`conformance Layout object ${index} was refused`);
		}
		document = plan.document;
		objectId = plan.createdObjectId;
	}
	return { document, objectId };
}

/** One deterministic primitive entity; `receiveShadow` is the proof scalar. */
export function primitiveEntity(index: number): ScenePrimitiveEntity {
	return {
		kind: 'primitive',
		id: index === 0 ? FIXTURE_ENTITY_ID : `entity-${index}`,
		name: `Plinth ${index}`,
		primitive: 'box',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: false,
		position: [index * 0.5, 0.5, 0],
		rotation: [0, 0, 0]
	};
}

/** A model entity naming an asset the host options above do not know. */
export function unknownAssetEntity(): SceneModelEntity {
	return {
		kind: 'model',
		id: 'entity-imported',
		name: 'Imported model',
		assetId: FIXTURE_UNKNOWN_ASSET_ID,
		fallback: 'piano',
		position: [0, 0, 0],
		rotation: [0, 0, 0]
	};
}

/**
 * The Scene: two adjacent nodes in Sequence order with one connection between
 * them (Camera-bearing data), plus the requested primitive entities.
 */
export function buildScene(entityCount: number, extraEntity?: SceneEntity): SceneDocument {
	const entities: SceneEntity[] = [];
	for (let index = 0; index < entityCount; index += 1) {
		entities.push(primitiveEntity(index));
	}
	if (extraEntity !== undefined) entities.push(extraEntity);
	return {
		formatVersion: 1,
		textures: [],
		materials: [],
		entities,
		navigationNodes: [
			{
				id: 'tour-a',
				label: 'Tour A',
				position: [1, 1.65, 1],
				cameraTarget: [1, 1.25, -2],
				fov: 54,
				connectedNodeIds: ['tour-b'],
			},
			{
				id: 'tour-b',
				label: 'Tour B',
				position: [4, 1.65, 3],
				cameraTarget: [4, 1.25, 0],
				fov: 54,
				connectedNodeIds: ['tour-a'],
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

/** A conformance source and the Layout object its proof planner transforms. */
export type CurrentSourceFixture = {
	readonly project: ProjectEnvelope;
	readonly objectId: string;
};

/** The conformance project: one Layout object, one entity, Camera-bearing Scene data. */
export async function buildCurrentSourceFixture(): Promise<CurrentSourceFixture> {
	const seed = layoutSeed();
	return {
		project: await createUnitProject({
			id: FIXTURE_PROJECT_ID,
			name: 'Conformance project',
			layout: seed.document,
			scene: buildScene(1)
		}),
		objectId: seed.objectId
	};
}

/** The densest current-format source this slice builds: many objects and entities. */
export async function buildDenseCurrentSourceFixture(): Promise<CurrentSourceFixture> {
	const seed = withLayoutObjects(layoutSeed(), 40);
	return {
		project: await createUnitProject({
			id: FIXTURE_PROJECT_ID,
			name: 'Dense conformance project',
			layout: seed.document,
			scene: buildScene(240)
		}),
		objectId: seed.objectId
	};
}

/** A project whose model entity names an asset only the option-less reader accepts. */
export async function buildUnknownAssetProject(): Promise<ProjectEnvelope> {
	return createUnitProject({
		id: FIXTURE_PROJECT_ID,
		name: 'Unknown asset project',
		layout: layoutSeed().document,
		scene: buildScene(0, unknownAssetEntity())
	});
}

const CHORD = 6;
/** The deliberately thick partition (P23.11 fixture): its own solid folds. */
const THICK = 8;

/**
 * A roomless partition Wall whose bend is mild at `[3, 0.5]` and folds the
 * offset polyline at `[3, 2]`: the document passes the strict codec and compiles
 * with one blocking `wall_offset_fold`. Mirrors `thickWallDocument` from
 * `tests/lib/layout/layout-render-safe-validation.test.ts`.
 */
export function foldedPartitionDocument(anchor: LayoutVec2 = [3, 2]): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	document.junctions = [
		{ id: 'j-p1', point: [0, 0] },
		{ id: 'j-p2', point: [CHORD, 0] }
	];
	const knot: LayoutWallCurveKnot = { id: 'anchor:1', point: [anchor[0], anchor[1]] };
	document.walls = [
		{
			id: 'wall-p',
			startJunctionId: 'j-p1',
			endJunctionId: 'j-p2',
			role: 'partition',
			thickness: THICK,
			height: 3,
			centerline: wallCubicChain([knot], deriveChainSpans([[0, 0], knot.point, [CHORD, 0]]))
		} as LayoutWall
	];
	return document;
}

/** A project whose Layout compiles with one blocking issue but passes the codec. */
export async function buildFoldedPartitionProject(anchor: LayoutVec2 = [3, 2]): Promise<ProjectEnvelope> {
	return createUnitProject({
		id: FIXTURE_PROJECT_ID,
		name: 'Folded partition project',
		layout: foldedPartitionDocument(anchor),
		scene: buildScene(0)
	});
}

/** An exact F.1 reference to one Layout object. */
export function layoutObjectReference(contentRevision: string, objectId: string): SemanticReference {
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision },
		subject: { kind: 'object', id: objectId },
		instancePath: [],
		location: { kind: 'layout-location', levelId: FIXTURE_FLOOR_ID, structureInstancePath: [] },
		componentId: null,
		capabilityId: null
	};
}

/** An exact F.1 reference to one Scene entity. */
export function sceneEntityReference(contentRevision: string, entityId: string): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision },
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

/** One captured intent, with the payload a proof planner expects. */
export function proofIntent(input: {
	readonly kind: string;
	readonly operationId: string;
	readonly expectedRevision: string;
	readonly projectId: string;
	readonly contentRevision: string;
	readonly targets: readonly SemanticReference[];
	readonly payload: F4JsonValue;
	readonly capturedInputs?: readonly CapturedInput[];
}): AuthoringIntent {
	return {
		version: 1,
		kind: input.kind,
		operationId: input.operationId,
		expectedRevision: { projectId: input.projectId, revisionId: input.expectedRevision },
		targets: input.targets,
		payload: input.payload,
		capturedInputs: input.capturedInputs ?? [],
		allocatedIds: []
	};
}

/**
 * The proof Layout planner: one exact object transform through the retained
 * `planExactLayoutObjectTransform` planner. Entity-level only — nothing outside
 * the object list changes, so Scene bytes (Camera included) cannot move.
 */
export function createProofLayoutPlanner(fallbackObjectId: string): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'conformance.layout-object-transform',
		kind: PROOF_LAYOUT_TRANSFORM_KIND,
		admission: { domain: 'layout', compound: false, units: false, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare({ snapshot, intent }) {
			const payload = intent.payload as { objectId?: unknown; position?: unknown };
			const targetId = typeof payload.objectId === 'string' ? payload.objectId : fallbackObjectId;
			const position = payload.position;
			if (
				!Array.isArray(position) ||
				position.length !== 3 ||
				!position.every((value) => typeof value === 'number' && Number.isFinite(value))
			) {
				return {
					kind: 'rejected',
					code: 'invalid_payload',
					message: 'position must be three finite numbers',
					diagnostics: []
				};
			}
			const project = snapshot.domain.source;
			const plan = planExactLayoutObjectTransform(project.units.layout.data, targetId, {
				position: [position[0], position[1], position[2]]
			});
			if (plan.kind === 'rejected') {
				return { kind: 'rejected', code: plan.rejection.code, message: plan.rejection.message, diagnostics: [] };
			}
			return {
				kind: 'prepared',
				candidate: {
					operationId: intent.operationId,
					sourceKind: UNIT_SOURCE_KIND,
					sourceVersion: UNIT_SOURCE_VERSION,
					source: replaceUnitData(project, 'layout', plan.document),
					changes: [
						{
							kind: 'layout-object-transform',
							subjectIds: [...(plan.changedObjectIds ?? [targetId])],
							fields: ['position']
						}
					],
					correspondence: [
						{
							relation: 'preserved',
							before: layoutObjectReference(project.units.layout.header.contentRevision, targetId),
							after: layoutObjectReference(project.units.layout.header.contentRevision, targetId)
						}
					],
					diagnostics: []
				}
			};
		}
	};
}

/**
 * The proof Scene planner: one boolean scalar on one existing primitive entity.
 * Entity-level, codec-validated and Camera-free by construction — the Scene's
 * navigation nodes and connections are carried over structurally.
 */
export function createProofSceneScalarPlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'conformance.scene-entity-scalar',
		kind: PROOF_SCENE_SCALAR_KIND,
		admission: { domain: 'scene', compound: false, units: false, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare({ snapshot, intent }) {
			const payload = intent.payload as { entityId?: unknown; receiveShadow?: unknown };
			const entityId = typeof payload.entityId === 'string' ? payload.entityId : FIXTURE_ENTITY_ID;
			if (typeof payload.receiveShadow !== 'boolean') {
				return {
					kind: 'rejected',
					code: 'invalid_payload',
					message: 'receiveShadow must be a boolean',
					diagnostics: []
				};
			}
			const project = snapshot.domain.source;
			const index = project.units.scene.data.entities.findIndex((entity) => entity.id === entityId);
			const entity = index < 0 ? undefined : project.units.scene.data.entities[index];
			if (entity === undefined) {
				return { kind: 'rejected', code: 'unknown_entity', message: `No Scene entity "${entityId}"`, diagnostics: [] };
			}
			if (entity.kind !== 'primitive') {
				return {
					kind: 'rejected',
					code: 'unsupported_entity',
					message: `Scene entity "${entityId}" is not a primitive, so it carries no shadow scalar`,
					diagnostics: []
				};
			}
			if (entity.receiveShadow === payload.receiveShadow) {
				return {
					kind: 'rejected',
					code: 'no_op',
					message: `Scene entity "${entityId}" already has receiveShadow ${payload.receiveShadow}`,
					diagnostics: []
				};
			}
			const entities = [...project.units.scene.data.entities];
			entities[index] = { ...entity, receiveShadow: payload.receiveShadow };
			return {
				kind: 'prepared',
				candidate: {
					operationId: intent.operationId,
					sourceKind: UNIT_SOURCE_KIND,
					sourceVersion: UNIT_SOURCE_VERSION,
					source: replaceUnitData(project, 'scene', { ...project.units.scene.data, entities }),
					changes: [{ kind: 'scene-entity-scalar', subjectIds: [entityId], fields: ['receiveShadow'] }],
					correspondence: [
						{
							relation: 'preserved',
							before: sceneEntityReference(project.units.scene.header.contentRevision, entityId),
							after: sceneEntityReference(project.units.scene.header.contentRevision, entityId)
						}
					],
					diagnostics: []
				}
			};
		}
	};
}

/**
 * A planner whose candidate the shared validator must refuse: an entity list
 * that keeps its shape but names a material instance that does not exist. Proves
 * the install rolls back completely — no revision, no history entry, no mutated
 * source.
 */
export function createInvalidCandidatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'conformance.invalid-candidate',
		kind: PROOF_INVALID_CANDIDATE_KIND,
		admission: { domain: 'scene', compound: false, units: false, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare({ snapshot, intent }) {
			const project = snapshot.domain.source;
			const index = project.units.scene.data.entities.findIndex((entity) => entity.id === FIXTURE_ENTITY_ID);
			const entity = index < 0 ? undefined : project.units.scene.data.entities[index];
			if (entity === undefined || entity.kind !== 'primitive') {
				return {
					kind: 'rejected',
					code: 'unsupported_entity',
					message: `The invalid-candidate fixture needs primitive "${FIXTURE_ENTITY_ID}"`,
					diagnostics: []
				};
			}
			const entities = [...project.units.scene.data.entities];
			entities[index] = { ...entity, materialInstanceId: 'material-does-not-exist' };
			return {
				kind: 'prepared',
				candidate: {
					operationId: intent.operationId,
					sourceKind: UNIT_SOURCE_KIND,
					sourceVersion: UNIT_SOURCE_VERSION,
					source: replaceUnitData(project, 'scene', { ...project.units.scene.data, entities }),
					changes: [
						{
							kind: 'conformance-invalid-candidate',
							subjectIds: [FIXTURE_ENTITY_ID],
							fields: ['materialInstanceId']
						}
					],
					correspondence: [],
					diagnostics: []
				}
			};
		}
	};
}

/** The RR-4 overreach operation kind: declared Scene, its candidate also writes Layout. */
export const PROOF_SCENE_WALL_MOVE_KIND = 'conformance-scene-with-layout-write';

/**
 * The RR-4 counterexample, kept as the scope-regression fixture: a planner that
 * declares single-domain Scene and produces an **envelope-valid** candidate that
 * moves a Layout object as well. Nothing about its shape is wrong — one
 * operation, one install, valid source — so only per-planner scope enforcement
 * can refuse it, targeted or untargeted.
 */
export function createSceneWithLayoutWritePlanner(fallbackObjectId: string): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'conformance.scene-with-layout-write',
		kind: PROOF_SCENE_WALL_MOVE_KIND,
		admission: { domain: 'scene', compound: false, units: false, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare({ snapshot, intent }) {
			const project = snapshot.domain.source;
			const index = project.units.scene.data.entities.findIndex((entity) => entity.id === FIXTURE_ENTITY_ID);
			const entity = index < 0 ? undefined : project.units.scene.data.entities[index];
			if (entity === undefined || entity.kind !== 'primitive') {
				return {
					kind: 'rejected',
					code: 'unsupported_entity',
					message: `The overreach fixture needs primitive "${FIXTURE_ENTITY_ID}"`,
					diagnostics: []
				};
			}
			const plan = planExactLayoutObjectTransform(project.units.layout.data, fallbackObjectId, {
				position: [3, 0.5, 0]
			});
			if (plan.kind === 'rejected') {
				return { kind: 'rejected', code: plan.rejection.code, message: plan.rejection.message, diagnostics: [] };
			}
			const entities = [...project.units.scene.data.entities];
			entities[index] = { ...entity, receiveShadow: true };
			return {
				kind: 'prepared',
				candidate: {
					operationId: intent.operationId,
					sourceKind: UNIT_SOURCE_KIND,
					sourceVersion: UNIT_SOURCE_VERSION,
					source: replaceUnitData(
						replaceUnitData(project, 'layout', plan.document),
						'scene',
						{ ...project.units.scene.data, entities }
					),
					changes: [
						{ kind: 'layout-object-transform', subjectIds: [fallbackObjectId], fields: ['position'] },
						{ kind: 'scene-entity-scalar', subjectIds: [FIXTURE_ENTITY_ID], fields: ['receiveShadow'] }
					],
					correspondence: [],
					diagnostics: []
				}
			};
		}
	};
}

/** A planner asking for a wider scope than `local-single-domain-v1` grants. */
export function createOverreachingPlanner(scope: {
	readonly compound?: boolean;
	readonly units?: boolean;
	readonly resources?: boolean;
	readonly writes?: readonly SemanticDomain[];
}): DomainPlanner<ProjectEnvelope> {
	const compound = scope.compound ?? false;
	// A compound planner must declare its write set and a single-domain planner
	// must not, so the default declaration follows the requested admission. These
	// fixtures never prepare.
	const writes = scope.writes ?? (compound ? (['layout'] as const) : undefined);
	return {
		id: 'conformance.overreaching',
		kind: 'conformance-overreaching',
		admission: {
			domain: 'scene',
			compound,
			...(writes === undefined ? {} : { writes }),
			units: scope.units ?? false,
			resources: scope.resources ?? false
		},
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare({ intent }) {
			return {
				kind: 'rejected',
				code: 'not_reached',
				message: `unreachable planner reached for ${intent.operationId}`,
				diagnostics: []
			};
		}
	};
}
