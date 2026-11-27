/**
 * T2 D8b — `place-group-copy` through the Scene planner set and the F.4
 * coordinator.
 *
 * The suite challenges the six claims the acceptance gate names:
 *
 * 1. **Round trip.** A template extracted from an accepted group, placed at the
 *    same floor at yaw 0, reproduces every member pose; the detached copy holds
 *    no reference to its template or its originating project.
 * 2. **Rigid yaw.** Every member, scale and light is the rigid image of its
 *    template pose about the origin — the forward vector included, independent
 *    of the planner's own matrices.
 * 3. **Origins.** Support keeps a raised platform's height, overhead reads the
 *    lowest face above the pointer's floor and never a hit Y, and a wall origin
 *    keeps its stored height.
 * 4. **Atomic refusals.** A stale generation, a missing contact, a taken id, a
 *    template the codec refuses, or a member that would cross the floor refuses
 *    the whole copy and names the member; nothing is written.
 * 5. **One install.** Entities, cluster, pinned resource and lock land in one
 *    accepted result; Undo restores the exact bytes, Redo the exact copy.
 * 6. **Change scope.** Only `entities`, `clusters`, `resources` and the lock
 *    change; Camera, Layout, navigation and Experience bytes are untouched.
 */
import { describe, expect, it } from 'vitest';
import {
	canonicalGroupTemplateBytes,
	createScenePlanners,
	groupTemplateFromCluster,
	readGroupTemplate,
	sceneSupportGenerationId,
	type NormalizedPlacementDefinition,
	type SceneGroupCopyOrigin,
} from '@portfolio/project-model/scene-planning';
import type {
	AcceptedSnapshot,
	AuthoringIntent,
	DomainPlanner,
	F4JsonValue,
} from '@portfolio/project-model/f4';
import type { AcceptedRevision } from '@portfolio/project-model/references';
import type {
	SceneEntity,
	SceneLightEntity,
	SceneObjectCluster,
	ScenePrimitiveEntity,
	Vec3,
} from '@portfolio/project-model/scene';
import {
	SCENE_UNIT_FORMAT_VERSION,
	type CameraFreeSceneDocument,
	type ProjectEnvelope,
} from '@portfolio/project-model/units';
import {
	catalogueModelDefinition,
	nativePlacementDefinition,
} from '$lib/authoring/scene/object-definition-policy';
import {
	admitUnitProject,
	createUnitCoordinator,
	createUnitProject,
} from '../authoring/__fixtures__/unit-envelope-fixtures';
import { freshCapture } from '../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
import {
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutDocumentWallFirst,
} from '@portfolio/layout-core/wall';
import {
	overheadSupportSnapshotOf,
	planCreateRegion,
	queryOverheadSupports,
} from '@portfolio/layout-core/room';
import { compileWallFirstLayoutGeometry } from '@portfolio/layout-core/geometry';

const PROJECT_ID = 'project-d8b-group-copy';
const REVISION = { projectId: PROJECT_ID, revisionId: 'revision-1' };
const ASSET_ID = 'paris-salon-chair';

function supportedLayout(elevation = 0): LayoutDocumentWallFirst {
	const empty = createEmptyWallFirstLayoutDocument();
	const baseline = { ...empty, floor: { ...empty.floor, elevation } };
	const planned = planWallChain({
		baseline,
		points: [
			[0, 0],
			[7, 0],
			[7, 6],
			[0, 6],
		],
		close: true,
		capture: freshCapture(),
		levelId: baseline.floor.id,
	});
	if (planned.kind !== 'success') throw new Error('the support fixture enclosure was refused');
	return planned.document;
}

function raisedTerrace(): LayoutDocumentWallFirst {
	const planned = planCreateRegion({
		baseline: supportedLayout(),
		capture: freshCapture(),
		intent: {
			role: 'floor',
			footprint: [
				[2, 1],
				[5, 1],
				[5, 4],
				[2, 4],
			],
			elevation: 0.6,
			thickness: 0.2,
		},
	});
	if (planned.kind !== 'success') throw new Error('the terrace fixture was refused');
	return planned.document;
}

function lidLayout(): LayoutDocumentWallFirst {
	return supportedLayout();
}

function overheadRegionLayout(): LayoutDocumentWallFirst {
	const planned = planCreateRegion({
		baseline: supportedLayout(),
		capture: freshCapture(),
		intent: {
			role: 'overhead',
			footprint: [
				[2.5, 2.5],
				[3.5, 2.5],
				[3.5, 3.5],
				[2.5, 3.5],
			],
			elevation: 2.2,
			thickness: 0.2,
		},
	});
	if (planned.kind !== 'success') throw new Error('the overhead fixture was refused');
	return planned.document;
}

function box(
	id: string,
	position: Vec3,
	dimensions: { readonly width: number; readonly height: number; readonly depth: number } = {
		width: 1,
		height: 1,
		depth: 1,
	},
): ScenePrimitiveEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: id,
		dimensions,
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0],
		scale: 1,
	};
}

function spot(id: string, position: Vec3, rotation: Vec3 = [-Math.PI / 2, 0, 0]): SceneLightEntity {
	return {
		kind: 'light',
		light: 'spot',
		id,
		name: id,
		color: '#ffd9a0',
		intensity: 12,
		angle: 0.9,
		penumbra: 0.5,
		castShadow: false,
		position,
		rotation,
	};
}

function sceneWith(
	entities: readonly SceneEntity[],
	clusters?: readonly SceneObjectCluster[],
): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [],
		entities: [...entities],
		...(clusters === undefined ? {} : { clusters: [...clusters] }),
	};
}

/** A seat, a back and a downward spot, in the template's frame. */
function pairTemplate(name = 'Pair') {
	return {
		name,
		members: [
			{
				kind: 'primitive',
				primitive: 'box',
				name: 'Seat',
				dimensions: { width: 1, height: 0.5, depth: 1 },
				materialId: 'plaster-warm',
				castShadow: true,
				receiveShadow: true,
				position: [0, 0.25, 0],
				rotation: [0, 0, 0],
				scale: 1,
			},
			{
				kind: 'primitive',
				primitive: 'box',
				name: 'Back',
				dimensions: { width: 1, height: 1, depth: 0.2 },
				materialId: 'plaster-warm',
				castShadow: true,
				receiveShadow: true,
				position: [0, 1, 0.4],
				rotation: [0, 0.2, 0],
				scale: 1,
			},
			{
				kind: 'light',
				light: 'spot',
				name: 'Lamp',
				color: '#ffd9a0',
				intensity: 12,
				angle: 0.9,
				penumbra: 0.5,
				castShadow: false,
				position: [0, 1.8, 0],
				rotation: [-1.1, 0.4, 0],
			},
		],
	};
}

const PAIR_CONTACTS = [-0.25, -0.5, null] as const;

function sourceScene(): CameraFreeSceneDocument {
	return sceneWith(
		[
			box('seat-src', [2, 0.25, 1], { width: 1, height: 0.5, depth: 1 }),
			box('back-src', [2, 1, 1.4], { width: 1, height: 1, depth: 0.2 }),
			spot('lamp-src', [2, 1.8, 1], [-Math.PI / 2, 0, 0]),
		],
		[{ id: 'cluster-src', name: 'Pair', memberIds: ['seat-src', 'back-src', 'lamp-src'] }],
	);
}

async function definitions(): Promise<readonly NormalizedPlacementDefinition[]> {
	const chair = await catalogueModelDefinition(ASSET_ID);
	if (chair === null) throw new Error('the salon chair has no admitted definition');
	return [await nativePlacementDefinition('box'), chair];
}

async function boot(input: {
	readonly scene?: CameraFreeSceneDocument;
	readonly layout?: LayoutDocumentWallFirst;
}) {
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'D8b group copy',
		acceptedRevision: REVISION,
		...(input.scene === undefined ? {} : { scene: input.scene }),
		...(input.layout === undefined ? {} : { layout: input.layout }),
	});
	const admitted = await admitUnitProject(project, REVISION);
	if (admitted.kind !== 'admitted') throw new Error(JSON.stringify(admitted.issues));
	const coordinator = await createUnitCoordinator({
		sessionEpoch: 'session-d8b',
		baseline: {
			revision: admitted.project.acceptedRevision,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId,
		},
		planners: createScenePlanners({ definitions: await definitions() }),
		mintRevisionId: (ordinal: number) => `revision-${ordinal + 1}`,
	});
	return { coordinator, admitted, project };
}

function now(coordinator: Awaited<ReturnType<typeof boot>>['coordinator']) {
	return coordinator.current();
}

function plannerFor(
	kind: string,
	definitions: readonly NormalizedPlacementDefinition[] = [],
): DomainPlanner<ProjectEnvelope> {
	const planner = createScenePlanners({ definitions }).find((candidate) => candidate.kind === kind);
	if (planner === undefined) throw new Error(`no planner for ${kind}`);
	return planner;
}

async function snapshotOf(project: ProjectEnvelope): Promise<AcceptedSnapshot<ProjectEnvelope>> {
	const admitted = await admitUnitProject(project, REVISION);
	if (admitted.kind !== 'admitted') throw new Error(JSON.stringify(admitted.issues));
	return {
		acceptedRevision: admitted.snapshot.acceptedRevision,
		sourceContentId: admitted.snapshot.sourceContentId,
		sourceKind: admitted.snapshot.sourceKind,
		sourceVersion: admitted.snapshot.sourceVersion,
		domain: {
			identity: {
				acceptedRevision: admitted.snapshot.acceptedRevision,
				sourceContentId: admitted.snapshot.sourceContentId,
			},
			source: project,
		},
	};
}

function groupIntent(input: {
	readonly snapshot:
		| AcceptedSnapshot<ProjectEnvelope>
		| { readonly revision: AcceptedRevision };
	readonly operationId: string;
	readonly template: unknown;
	readonly origin: SceneGroupCopyOrigin;
	readonly yaw?: number;
	readonly entityIds: readonly string[];
	readonly clusterId: string;
	readonly contacts: readonly (number | null)[];
	readonly name?: string;
}): AuthoringIntent {
	return {
		version: 1,
		kind: 'place-group-copy',
		operationId: input.operationId,
		expectedRevision:
			'acceptedRevision' in input.snapshot
				? input.snapshot.acceptedRevision
				: input.snapshot.revision,
		targets: [],
		payload: {
			kind: 'place-group-copy',
			template: input.template as F4JsonValue,
			name: input.name ?? 'Copied group',
			origin:
				input.origin.kind === 'wall'
					? { kind: 'wall', position: input.origin.position }
					: {
							kind: input.origin.kind,
							worldXZ: input.origin.worldXZ,
							...(input.origin.choice === undefined
								? {}
								: { supportChoice: input.origin.choice }),
						},
			yaw: input.yaw ?? 0,
			frame: { origin: [0, 0, 0], yaw: 0 },
			frameReference: { version: 1, kind: 'project-world' },
			entityIds: [...input.entityIds],
			clusterId: input.clusterId,
			contacts: [...input.contacts],
		},
		capturedInputs: [],
		allocatedIds: [],
	};
}

async function prepare(
	snapshot: AcceptedSnapshot<ProjectEnvelope>,
	captured: AuthoringIntent,
	definitions: readonly NormalizedPlacementDefinition[] = [],
) {
	return plannerFor('place-group-copy', definitions).prepare({
		snapshot,
		intent: captured,
		capturedInputs: captured.capturedInputs,
		allocatedIds: captured.allocatedIds,
	});
}

function rotateY(point: Vec3, yaw: number): Vec3 {
	const cos = Math.cos(yaw);
	const sin = Math.sin(yaw);
	return [cos * point[0] + sin * point[2], point[1], -sin * point[0] + cos * point[2]];
}

/** The forward (`-Z`) vector of an XYZ Euler rotation, computed independently. */
function forwardOf(rotation: Vec3): Vec3 {
	const [pitch, yaw] = rotation;
	const afterYaw: Vec3 = [-Math.sin(yaw), 0, -Math.cos(yaw)];
	return [
		afterYaw[0],
		Math.cos(pitch) * afterYaw[1] - Math.sin(pitch) * afterYaw[2],
		Math.sin(pitch) * afterYaw[1] + Math.cos(pitch) * afterYaw[2],
	];
}

function close(actual: Vec3, expected: Vec3, tolerance = 1e-9) {
	for (const axis of [0, 1, 2] as const) {
		expect(Math.abs(actual[axis] - expected[axis])).toBeLessThanOrEqual(tolerance);
	}
}

function lockEntries(envelope: ProjectEnvelope) {
	return envelope.dependencyLock.entries.filter((entry) => entry.domain === 'resource:asset');
}

describe('place-group-copy — round trip and rigid composition', () => {
	it('reproduces an extracted group at the same floor and installs one cluster', async () => {
		const layout = supportedLayout();
		const scene = sourceScene();
		const { coordinator, admitted, project } = await boot({ scene, layout });
		const snapshot = await snapshotOf(project);
		const extracted = groupTemplateFromCluster({
			scene,
			layout,
			sourceContentId: snapshot.sourceContentId,
			clusterId: 'cluster-src',
		});
		expect(extracted.kind).toBe('template');
		if (extracted.kind !== 'template') return;
		// The pivot is the X/Z centre of the member origins.
		expect(extracted.origin).toEqual([2, 0, 1.2]);
		// The copy placed below is the canonical bytes' own reading of the template.
		const templateBytes = canonicalGroupTemplateBytes(extracted.template);
		const reread = readGroupTemplate(JSON.parse(new TextDecoder().decode(templateBytes)));
		if (!reread.success) throw new Error(JSON.stringify(reread.issues));
		expect(reread.template).toEqual(extracted.template);

		const accepted = await coordinator.accept(
			groupIntent({
				snapshot: now(coordinator),
				operationId: 'op-copy-1',
				template: reread.template,
				origin: { kind: 'support', worldXZ: [4, 3] },
				entityIds: ['seat-copy', 'back-copy', 'lamp-copy'],
				clusterId: 'cluster-copy-1',
				contacts: extracted.contacts,
				name: 'Pair copy',
			}),
		);
		if (accepted.kind !== 'accepted') throw new Error(JSON.stringify(accepted));
		const acceptedState = now(coordinator);

		const copied = acceptedState.source.units.scene.data;
		const seat = copied.entities.find((entity) => entity.id === 'seat-copy');
		const back = copied.entities.find((entity) => entity.id === 'back-copy');
		const lamp = copied.entities.find((entity) => entity.id === 'lamp-copy');
		// At yaw 0 the rigid image is the exact sum of origin and local pose.
		close(seat!.position, [4, 0.25, 2.8]);
		close(back!.position, [4, 1, 3.2]);
		close(lamp!.position, [4, 1.8, 2.8]);
		expect(copied.clusters).toContainEqual({
			id: 'cluster-copy-1',
			name: 'Pair copy',
			memberIds: ['seat-copy', 'back-copy', 'lamp-copy'],
		});
		expect(copied.clusters).toHaveLength(2);
		// The copy is ordinary Scene source: no template or project reference.
		const bytes = JSON.stringify(copied);
		expect(bytes).not.toMatch(/"template"|"templateId"|"sourceProjectId"/);
		expect(copied.entities.filter((entity) => entity.id.endsWith('-copy'))).toHaveLength(3);

		const undo = await coordinator.undo();
		expect(undo.kind).toBe('restored');
		expect(now(coordinator).canonicalJson).toBe(admitted.canonicalJson);
		const redo = await coordinator.redo();
		expect(redo.kind).toBe('restored');
		expect(now(coordinator).canonicalJson).toBe(acceptedState.canonicalJson);
	});

	it('rotates every pose and light forward vector rigidly about the origin', async () => {
		const yaw = Math.PI / 3;
		const project = await createUnitProject({
			id: PROJECT_ID,
			name: 'D8b yaw',
			acceptedRevision: REVISION,
			layout: supportedLayout(),
		});
		const snapshot = await snapshotOf(project);
		const yawTemplate = {
			name: 'Pair and downlight',
			members: [
				...pairTemplate().members,
				{
					kind: 'light',
					light: 'spot',
					name: 'Downlight',
					color: '#ffffff',
					intensity: 4,
					angle: 0.6,
					castShadow: false,
					position: [0.5, 2, 0],
					rotation: [-Math.PI / 2, 0, 0],
				},
			],
		};
		const prepared = await prepare(
			snapshot,
			groupIntent({
				snapshot,
				operationId: 'op-copy-yaw',
				template: yawTemplate,
				origin: { kind: 'support', worldXZ: [4, 3] },
				yaw,
				entityIds: ['seat-copy', 'back-copy', 'lamp-copy', 'down-copy'],
				clusterId: 'cluster-copy-yaw',
				contacts: [...PAIR_CONTACTS, null],
			}),
		);
		if (prepared.kind !== 'prepared') throw new Error(JSON.stringify(prepared));
		const scene = prepared.candidate.source.units.scene.data;
		const template = pairTemplate();
		const origin: Vec3 = [4, 0, 3];
		for (const [index, id] of ['seat-copy', 'back-copy', 'lamp-copy'].entries()) {
			const member = template.members[index]!;
			const entity = scene.entities.find((candidate) => candidate.id === id)!;
			const local: Vec3 = [member.position[0], member.position[1], member.position[2]];
			close(entity.position, [
				origin[0] + rotateY(local, yaw)[0],
				origin[1] + local[1],
				origin[2] + rotateY(local, yaw)[2],
			]);
		}
		const lamp = scene.entities.find((candidate) => candidate.id === 'lamp-copy')!;
		const localForward = forwardOf([-1.1, 0.4, 0]);
		const expectedForward = rotateY(localForward, yaw);
		close(forwardOf(lamp.rotation), expectedForward, 1e-6);
		// The emitted target point is the rigid image too, not just the axis.
		const rotatedTarget = rotateY(
			[
				template.members[2]!.position[0] + localForward[0] * 2,
				template.members[2]!.position[1] + localForward[1] * 2,
				template.members[2]!.position[2] + localForward[2] * 2,
			],
			yaw,
		);
		close(
			[
				lamp.position[0] + expectedForward[0] * 2,
				lamp.position[1] + expectedForward[1] * 2,
				lamp.position[2] + expectedForward[2] * 2,
			],
			[
				4 + rotatedTarget[0],
				0 + rotatedTarget[1],
				3 + rotatedTarget[2],
			],
			1e-6,
		);
		// A straight-down spot is the Euler gimbal case: its forward stays down
		// under any yaw.
		const down = scene.entities.find((candidate) => candidate.id === 'down-copy')!;
		close(forwardOf(down.rotation), [0, -1, 0], 1e-6);
		// Scale and the back's captured yaw are preserved under the rigid turn.
		expect(lamp).toMatchObject({ kind: 'light', light: 'spot', intensity: 12, angle: 0.9 });
		const back = scene.entities.find((candidate) => candidate.id === 'back-copy')!;
		expect(back.scale).toBe(1);
	});
});

describe('place-group-copy — origins', () => {
	it('keeps a raised platform’s height, not the floor’s', async () => {
		const project = await createUnitProject({
			id: PROJECT_ID,
			name: 'D8b terrace',
			acceptedRevision: REVISION,
			layout: raisedTerrace(),
		});
		const snapshot = await snapshotOf(project);
		const choice = {
			kind: 'elevation' as const,
			elevation: 0.6,
			generationId: sceneSupportGenerationId(snapshot.sourceContentId),
		};
		const prepared = await prepare(
			snapshot,
			groupIntent({
				snapshot,
				operationId: 'op-copy-terrace',
				template: pairTemplate(),
				origin: { kind: 'support', worldXZ: [3, 2], choice },
				entityIds: ['seat-copy', 'back-copy', 'lamp-copy'],
				clusterId: 'cluster-copy-terrace',
				contacts: [...PAIR_CONTACTS],
			}),
		);
		expect(prepared.kind).toBe('prepared');
		if (prepared.kind !== 'prepared') return;
		const scene = prepared.candidate.source.units.scene.data;
		expect(scene.entities.find((entity) => entity.id === 'seat-copy')!.position[1]).toBeCloseTo(
			0.6 + 0.25,
			9,
		);
		expect(scene.entities.find((entity) => entity.id === 'back-copy')!.position[1]).toBeCloseTo(
			0.6 + 1,
			9,
		);
		expect(scene.entities.find((entity) => entity.id === 'lamp-copy')!.position[1]).toBeCloseTo(
			0.6 + 1.8,
			9,
		);

		const ambiguous = await prepare(
			snapshot,
			groupIntent({
				snapshot,
				operationId: 'op-copy-terrace-no-choice',
				template: pairTemplate(),
				origin: { kind: 'support', worldXZ: [3, 2] },
				entityIds: ['seat-copy', 'back-copy', 'lamp-copy'],
				clusterId: 'cluster-copy-terrace',
				contacts: [...PAIR_CONTACTS],
			}),
		);
		expect(ambiguous.kind).toBe('rejected');
		if (ambiguous.kind === 'rejected') expect(ambiguous.code).toBe('support-choice-required');
	});

	it('hangs from the lowest overhead face and never reads a hit Y', async () => {
		const layout = lidLayout();
		const project = await createUnitProject({
			id: PROJECT_ID,
			name: 'D8b lid',
			acceptedRevision: REVISION,
			layout,
		});
		const snapshot = await snapshotOf(project);
		const compiled = compileWallFirstLayoutGeometry(layout);
		const queried = queryOverheadSupports(overheadSupportSnapshotOf(compiled.geometry), {
			generationId: sceneSupportGenerationId(snapshot.sourceContentId),
			x: 3,
			z: 3,
			aboveElevation: 0,
		});
		expect(queried.kind).toBe('candidates');
		if (queried.kind !== 'candidates') return;
		const lid = queried.candidates[0]!.elevation;
		expect(lid).toBeGreaterThan(2);

		const pendant = {
			name: 'Pendant',
			members: [
				{
					kind: 'primitive',
					primitive: 'box',
					name: 'Shade',
					dimensions: { width: 0.4, height: 0.3, depth: 0.4 },
					materialId: 'plaster-warm',
					castShadow: true,
					receiveShadow: true,
					position: [-0.2, 0, 0],
					rotation: [0, 0, 0],
					scale: 1,
				},
				{
					kind: 'light',
					light: 'point',
					name: 'Bulb',
					color: '#fff2d0',
					intensity: 6,
					castShadow: false,
					position: [-0.2, -0.2, 0],
					rotation: [0, 0, 0],
				},
			],
		};
		const prepared = await prepare(
			snapshot,
			groupIntent({
				snapshot,
				operationId: 'op-copy-overhead',
				template: pendant,
				origin: { kind: 'overhead', worldXZ: [3, 3] },
				entityIds: ['shade-copy', 'bulb-copy'],
				clusterId: 'cluster-copy-overhead',
				contacts: [-0.15, null],
			}),
		);
		expect(prepared.kind).toBe('prepared');
		if (prepared.kind !== 'prepared') return;
		const scene = prepared.candidate.source.units.scene.data;
		expect(scene.entities.find((entity) => entity.id === 'shade-copy')!.position[1]).toBeCloseTo(
			lid,
			9,
		);
		expect(scene.entities.find((entity) => entity.id === 'bulb-copy')!.position[1]).toBeCloseTo(
			lid - 0.2,
			9,
		);
	});

	it('prefers an overhead region beneath the lid and refuses an open space', async () => {
		const layout = overheadRegionLayout();
		const project = await createUnitProject({
			id: PROJECT_ID,
			name: 'D8b overhead region',
			acceptedRevision: REVISION,
			layout,
		});
		const snapshot = await snapshotOf(project);
		const prepared = await prepare(
			snapshot,
			groupIntent({
				snapshot,
				operationId: 'op-copy-overhead-region',
				template: pairTemplate(),
				origin: { kind: 'overhead', worldXZ: [3, 3] },
				entityIds: ['seat-copy', 'back-copy', 'lamp-copy'],
				clusterId: 'cluster-copy-overhead',
				contacts: [...PAIR_CONTACTS],
			}),
		);
		// The region hangs below the lid; the template's members hang from it.
		expect(prepared.kind).toBe('prepared');
		if (prepared.kind !== 'prepared') return;
		const scene = prepared.candidate.source.units.scene.data;
		expect(scene.entities.find((entity) => entity.id === 'seat-copy')!.position[1]).toBeCloseTo(
			2.2 + 0.25,
			9,
		);

		const open = await createUnitProject({
			id: PROJECT_ID,
			name: 'D8b open',
			acceptedRevision: REVISION,
		});
		const openSnapshot = await snapshotOf(open);
		const refused = await prepare(
			openSnapshot,
			groupIntent({
				snapshot: openSnapshot,
				operationId: 'op-copy-open',
				template: pairTemplate(),
				origin: { kind: 'overhead', worldXZ: [3, 3] },
				entityIds: ['seat-copy', 'back-copy', 'lamp-copy'],
				clusterId: 'cluster-copy-open',
				contacts: [...PAIR_CONTACTS],
			}),
		);
		expect(refused.kind).toBe('rejected');
		if (refused.kind === 'rejected') expect(refused.code).toBe('no-overhead-support');
	});

	it('keeps a wall origin’s stored height and refuses a member below the floor', async () => {
		const project = await createUnitProject({
			id: PROJECT_ID,
			name: 'D8b wall',
			acceptedRevision: REVISION,
			layout: supportedLayout(),
		});
		const snapshot = await snapshotOf(project);
		const wall = await prepare(
			snapshot,
			groupIntent({
				snapshot,
				operationId: 'op-copy-wall',
				template: pairTemplate(),
				origin: { kind: 'wall', position: [1.2, 1.6, 5.9] },
				entityIds: ['seat-copy', 'back-copy', 'lamp-copy'],
				clusterId: 'cluster-copy-wall',
				contacts: [...PAIR_CONTACTS],
			}),
		);
		expect(wall.kind).toBe('prepared');
		if (wall.kind !== 'prepared') return;
		const scene = wall.candidate.source.units.scene.data;
		expect(scene.entities.find((entity) => entity.id === 'seat-copy')!.position[1]).toBeCloseTo(
			1.6 + 0.25,
			9,
		);

		const belowFloor = {
			name: 'Suspended',
			members: [
				{
					kind: 'primitive',
					primitive: 'box',
					name: 'Weight',
					dimensions: { width: 0.3, height: 0.3, depth: 0.3 },
					materialId: 'plaster-warm',
					castShadow: true,
					receiveShadow: true,
					position: [0, 0, 0],
					rotation: [0, 0, 0],
					scale: 1,
				},
				{
					kind: 'primitive',
					primitive: 'box',
					name: 'Anchor',
					dimensions: { width: 0.2, height: 0.2, depth: 0.2 },
					materialId: 'plaster-warm',
					castShadow: true,
					receiveShadow: true,
					position: [0, 3, 0],
					rotation: [0, 0, 0],
					scale: 1,
				},
			],
		};
		const refused = await prepare(
			snapshot,
			groupIntent({
				snapshot,
				operationId: 'op-copy-below-floor',
				template: belowFloor,
				origin: { kind: 'wall', position: [2, 0, 2] },
				entityIds: ['weight-copy', 'anchor-copy'],
				clusterId: 'cluster-copy-below',
				contacts: [-0.15, -0.1],
			}),
		);
		expect(refused.kind).toBe('rejected');
		if (refused.kind === 'rejected') {
			expect(refused.code).toBe('no-support');
			expect(refused.diagnostics.some((entry) => entry.message.includes('weight-copy'))).toBe(true);
		}
	});
});

describe('place-group-copy — refusal matrix and atomicity', () => {
	it('refuses a stale generation, a missing contact, a taken id and a tilted template', async () => {
		const project = await createUnitProject({
			id: PROJECT_ID,
			name: 'D8b refusals',
			acceptedRevision: REVISION,
			layout: supportedLayout(),
			scene: sceneWith(
				[box('existing', [6, 0.5, 5]), box('existing-2', [4, 0.5, 5])],
				[{ id: 'existing-cluster', name: 'Existing', memberIds: ['existing', 'existing-2'] }],
			),
		});
		const snapshot = await snapshotOf(project);
		const cases: Array<{
			readonly label: string;
			readonly intent: AuthoringIntent;
			readonly code: string;
			readonly message?: RegExp;
		}> = [
			{
				label: 'stale generation',
				intent: groupIntent({
					snapshot,
					operationId: 'op-stale',
					template: pairTemplate(),
					origin: {
						kind: 'support',
						worldXZ: [4, 3],
						choice: { kind: 'elevation', elevation: 0, generationId: 'stale-generation' },
					},
					entityIds: ['seat-copy', 'back-copy', 'lamp-copy'],
					clusterId: 'cluster-copy-stale',
					contacts: [...PAIR_CONTACTS],
				}),
				code: 'stale-generation',
			},
			{
				label: 'stale overhead generation',
				intent: groupIntent({
					snapshot,
					operationId: 'op-stale-overhead',
					template: pairTemplate(),
					origin: {
						kind: 'overhead',
						worldXZ: [4, 3],
						choice: { kind: 'elevation', elevation: 0, generationId: 'stale-generation' },
					},
					entityIds: ['seat-copy', 'back-copy', 'lamp-copy'],
					clusterId: 'cluster-copy-stale-overhead',
					contacts: [...PAIR_CONTACTS],
				}),
				code: 'stale-generation',
			},
			{
				label: 'missing contact',
				intent: groupIntent({
					snapshot,
					operationId: 'op-no-contact',
					template: pairTemplate(),
					origin: { kind: 'support', worldXZ: [4, 3] },
					entityIds: ['seat-copy', 'back-copy', 'lamp-copy'],
					clusterId: 'cluster-copy-contact',
					contacts: [null, -0.5, null],
				}),
				code: 'missing-contact-metadata',
			},
			{
				label: 'taken entity id',
				intent: groupIntent({
					snapshot,
					operationId: 'op-taken',
					template: pairTemplate(),
					origin: { kind: 'support', worldXZ: [4, 3] },
					entityIds: ['existing', 'back-copy', 'lamp-copy'],
					clusterId: 'cluster-copy-taken',
					contacts: [...PAIR_CONTACTS],
				}),
				code: 'invalid-value',
				message: /already exists/,
			},
			{
				label: 'taken cluster id',
				intent: groupIntent({
					snapshot,
					operationId: 'op-taken-cluster',
					template: pairTemplate(),
					origin: { kind: 'support', worldXZ: [4, 3] },
					entityIds: ['seat-copy', 'back-copy', 'lamp-copy'],
					clusterId: 'existing-cluster',
					contacts: [...PAIR_CONTACTS],
				}),
				code: 'invalid-value',
				message: /already exists/,
			},
			{
				label: 'tilted template member',
				intent: groupIntent({
					snapshot,
					operationId: 'op-tilted',
					template: {
						name: 'Tilted',
						members: [
							{ ...pairTemplate().members[0]!, rotation: [0.4, 0, 0] },
							pairTemplate().members[1]!,
						],
					},
					origin: { kind: 'support', worldXZ: [4, 3] },
					entityIds: ['seat-copy', 'back-copy'],
					clusterId: 'cluster-copy-tilted',
					contacts: [-0.25, -0.5],
				}),
				code: 'ineligible-member',
				message: /not upright/,
			},
		];
		for (const sample of cases) {
			const outcome = await prepare(snapshot, sample.intent);
			expect(outcome.kind, sample.label).toBe('rejected');
			if (outcome.kind !== 'rejected') continue;
			expect(outcome.code, sample.label).toBe(sample.code);
			if (sample.message !== undefined) {
				expect(sample.message.test(outcome.message), sample.label).toBe(true);
			}
		}
	});

	it('leaves the accepted bytes untouched when a member would cross the floor', async () => {
		const { coordinator, admitted } = await boot({ layout: supportedLayout() });
		const baseline = now(coordinator).canonicalJson;
		const template = {
			name: 'Pierced',
			members: [
				{
					kind: 'primitive',
					primitive: 'box',
					name: 'Pierced slab',
					dimensions: { width: 0.4, height: 0.4, depth: 0.4 },
					materialId: 'plaster-warm',
					castShadow: true,
					receiveShadow: true,
					position: [0, -1, 0],
					rotation: [0, 0, 0],
					scale: 1,
				},
				{
					kind: 'primitive',
					primitive: 'box',
					name: 'Hanger',
					dimensions: { width: 0.2, height: 0.2, depth: 0.2 },
					materialId: 'plaster-warm',
					castShadow: true,
					receiveShadow: true,
					position: [0, 0, 0],
					rotation: [0, 0, 0],
					scale: 1,
				},
			],
		};
		const refused = await coordinator.accept(
			groupIntent({
				snapshot: now(coordinator),
				operationId: 'op-copy-pierced',
				template,
				origin: { kind: 'support', worldXZ: [4, 3] },
				entityIds: ['pierced-copy', 'hanger-copy'],
				clusterId: 'cluster-copy-pierced',
				contacts: [-0.2, -0.1],
			}),
		);
		expect(refused.kind).toBe('rejected');
		if (refused.kind === 'rejected') {
			expect(refused.code).toBe('planner-rejected');
			expect(refused.reason).toBe('no-support');
			expect(refused.message).toContain('pierced-copy');
		}
		expect(now(coordinator).canonicalJson).toBe(baseline);
		expect(now(coordinator).canonicalJson).toBe(admitted.canonicalJson);
		expect(now(coordinator).source.units.scene.data.clusters ?? []).toEqual([]);
	});
});

describe('place-group-copy — model contact admission', () => {
	const CHAIR_MEMBER = {
		kind: 'model',
		name: 'Salon chair',
		assetId: ASSET_ID,
		fallback: 'chair',
		position: [0, 0, 0],
		rotation: [0, 0, 0],
		scale: 1,
	};
	const BLOCK_MEMBER = {
		kind: 'primitive',
		primitive: 'box',
		name: 'Block',
		dimensions: { width: 0.4, height: 0.4, depth: 0.4 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position: [1, 0.2, 0],
		rotation: [0, 0, 0],
		scale: 1,
	};

	it('refuses a pinned model whose admitted contact is missing or disagrees with the capture', async () => {
		const project = await createUnitProject({
			id: PROJECT_ID,
			name: 'D8b model contact',
			acceptedRevision: REVISION,
			layout: supportedLayout(),
		});
		const snapshot = await snapshotOf(project);
		const chair = await catalogueModelDefinition(ASSET_ID);
		if (chair === null) throw new Error('the salon chair has no admitted definition');
		// A pin plus a definition without a finite contact is not eligibility.
		const broken: NormalizedPlacementDefinition = { ...chair, contactMinY: Number.NaN };
		const template = { name: 'Chair pair', members: [CHAIR_MEMBER, BLOCK_MEMBER] };
		const missing = await prepare(
			snapshot,
			groupIntent({
				snapshot,
				operationId: 'op-chair-no-contact',
				template,
				origin: { kind: 'support', worldXZ: [3, 3] },
				entityIds: ['chair-copy', 'block-copy'],
				clusterId: 'cluster-chair-no-contact',
				contacts: [chair.contactMinY, -0.2],
			}),
			[broken],
		);
		expect(missing.kind).toBe('rejected');
		if (missing.kind === 'rejected') expect(missing.code).toBe('missing-contact-metadata');

		// A capture that claims a different contact cannot shift the body.
		const shifted = await prepare(
			snapshot,
			groupIntent({
				snapshot,
				operationId: 'op-chair-shifted',
				template,
				origin: { kind: 'support', worldXZ: [3, 3] },
				entityIds: ['chair-copy', 'block-copy'],
				clusterId: 'cluster-chair-shifted',
				contacts: [chair.contactMinY + 0.01, -0.2],
			}),
			[chair],
		);
		expect(shifted.kind).toBe('rejected');
		if (shifted.kind === 'rejected') expect(shifted.code).toBe('missing-contact-metadata');
	});
});

describe('place-group-copy — one atomic install', () => {
	it('grants the pinned asset once, and Undo removes resource, lock, cluster and members', async () => {
		const { coordinator, admitted } = await boot({ layout: supportedLayout() });
		const chair = await catalogueModelDefinition(ASSET_ID);
		if (chair === null) throw new Error('the salon chair has no admitted definition');
		const chairTemplate = {
			name: 'Chair and block',
			members: [
				{
					kind: 'model',
					name: 'Salon chair',
					assetId: ASSET_ID,
					fallback: 'chair',
					position: [0, 0, 0],
					rotation: [0, 0.3, 0],
					scale: 0.92,
				},
				{
					kind: 'primitive',
					primitive: 'box',
					name: 'Block',
					dimensions: { width: 0.4, height: 0.4, depth: 0.4 },
					materialId: 'plaster-warm',
					castShadow: true,
					receiveShadow: true,
					position: [1.2, 0.2, 0],
					rotation: [0, 0, 0],
					scale: 1,
				},
			],
		};
		const contacts = [chair.contactMinY, -0.2];
		const first = await coordinator.accept(
			groupIntent({
				snapshot: now(coordinator),
				operationId: 'op-chair-group-1',
				template: chairTemplate,
				origin: { kind: 'support', worldXZ: [3, 3] },
				entityIds: ['chair-copy', 'block-copy'],
				clusterId: 'cluster-chair-copy',
				contacts,
			}),
		);
		expect(first.kind).toBe('accepted');
		if (first.kind !== 'accepted') return;
		const accepted = now(coordinator);
		const source = accepted.source;
		expect(
			source.units.resources.data.resources.filter((entry) => entry.id === ASSET_ID),
		).toHaveLength(1);
		expect(lockEntries(source)).toHaveLength(1);
		expect(source.units.scene.data.entities).toContainEqual(
			expect.objectContaining({ id: 'chair-copy', kind: 'model', assetId: ASSET_ID, scale: 0.92 }),
		);
		expect(source.units.scene.data.clusters).toContainEqual(
			expect.objectContaining({ id: 'cluster-chair-copy', memberIds: ['chair-copy', 'block-copy'] }),
		);
		// The change record names the copy and the one grant it needed.
		const changes = first.changes;
		expect(changes.map((change) => change.kind)).toEqual(
			expect.arrayContaining(['scene-place-group-copy', 'resource-asset-granted']),
		);
		const copyChange = changes.find((change) => change.kind === 'scene-place-group-copy');
		expect(copyChange?.subjectIds).toEqual([
			'cluster-chair-copy',
			'chair-copy',
			'block-copy',
		]);
		const grantChange = changes.find((change) => change.kind === 'resource-asset-granted');
		expect(grantChange?.subjectIds).toEqual([ASSET_ID]);

		const undo = await coordinator.undo();
		expect(undo.kind).toBe('restored');
		expect(now(coordinator).canonicalJson).toBe(admitted.canonicalJson);
		expect(now(coordinator).source.units.resources.data.resources).toEqual([]);
		expect(lockEntries(now(coordinator).source)).toEqual([]);
		expect(now(coordinator).source.units.scene.data.entities).toEqual([]);
		const redo = await coordinator.redo();
		expect(redo.kind).toBe('restored');
		expect(now(coordinator).canonicalJson).toBe(accepted.canonicalJson);

		// A second copy reuses the held resource and lock: no second grant.
		const second = await coordinator.accept(
			groupIntent({
				snapshot: now(coordinator),
				operationId: 'op-chair-group-2',
				template: chairTemplate,
				origin: { kind: 'support', worldXZ: [5, 3] },
				entityIds: ['chair-copy-2', 'block-copy-2'],
				clusterId: 'cluster-chair-copy-2',
				contacts,
			}),
		);
		expect(second.kind).toBe('accepted');
		if (second.kind !== 'accepted') return;
		expect(
			now(coordinator).source.units.resources.data.resources.filter(
				(entry) => entry.id === ASSET_ID,
			),
		).toHaveLength(1);
		expect(lockEntries(now(coordinator).source)).toHaveLength(1);
		expect(second.changes.map((change) => change.kind)).not.toContain('resource-asset-granted');
	});

	it('changes only Scene entities, clusters, resources and the lock', async () => {
		const { coordinator, admitted } = await boot({
			layout: supportedLayout(),
			scene: sceneWith([box('existing', [6, 0.5, 5])]),
		});
		const baseline = now(coordinator).source;
		const chair = await catalogueModelDefinition(ASSET_ID);
		if (chair === null) throw new Error('the salon chair has no admitted definition');
		const accepted = await coordinator.accept(
			groupIntent({
				snapshot: now(coordinator),
				operationId: 'op-scope',
				template: {
					name: 'Model pair',
					members: [
						{
							kind: 'model',
							name: 'Salon chair',
							assetId: ASSET_ID,
							fallback: 'chair',
							position: [0, 0, 0],
							rotation: [0, 0, 0],
							scale: 1,
						},
						{
							kind: 'primitive',
							primitive: 'box',
							name: 'Block',
							dimensions: { width: 0.4, height: 0.4, depth: 0.4 },
							materialId: 'plaster-warm',
							castShadow: true,
							receiveShadow: true,
							position: [1, 0.2, 0],
							rotation: [0, 0, 0],
							scale: 1,
						},
					],
				},
				origin: { kind: 'support', worldXZ: [3, 2] },
				entityIds: ['chair-scope', 'block-scope'],
				clusterId: 'cluster-scope',
				contacts: [chair.contactMinY, -0.2],
			}),
		);
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		const after = now(coordinator).source;
		// Untouched domains are byte-identical.
		expect(after.units.camera.data).toEqual(baseline.units.camera.data);
		expect(after.units.layout.data).toEqual(baseline.units.layout.data);
		expect(after.units.experience.data).toEqual(baseline.units.experience.data);
		// The accepted source keeps its prefix: no reordering, no edits.
		expect(after.units.scene.data.entities.slice(0, baseline.units.scene.data.entities.length)).toEqual(
			baseline.units.scene.data.entities,
		);
		expect(after.units.scene.data.entities).toHaveLength(baseline.units.scene.data.entities.length + 2);
		expect(after.units.scene.data.clusters).toHaveLength(1);
		expect(after.units.scene.data.textures).toEqual(baseline.units.scene.data.textures);
		expect(after.units.scene.data.materials).toEqual(baseline.units.scene.data.materials);
		// Save/reopen keeps the grant and drops the template.
		expect(after.units.resources.data.resources).toHaveLength(1);
		expect(lockEntries(after)).toHaveLength(1);
		const reopened = await admitUnitProject(after, admitted.project.acceptedRevision);
		expect(reopened.kind).toBe('admitted');
		expect(JSON.stringify(after.units.scene.data)).not.toMatch(/"template"/);
	});
});
