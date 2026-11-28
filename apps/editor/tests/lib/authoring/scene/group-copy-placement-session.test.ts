/**
 * T2 D8p — the shared group-copy placement session.
 *
 * The harness drives the real session over the real Stage seams: a `GroupTemplate`
 * captured from an accepted cluster (or authored as a fixture), the D8b planner
 * and support authorities through the one F.4 coordinator, a lease that behaves
 * like the Stage's, and the project-keyed arm store the entry slices will use.
 *
 * The cases are the acceptance gate's own:
 *
 * 1. **Three origins, one intent.** `support`, `overhead` and `wall` each write
 *    exactly one `place-group-copy` whose origin is the one previewed.
 * 2. **Preview is acceptance.** Every previewed member pose equals the installed
 *    pose, because both call the same preparation with the same captured inputs.
 * 3. **Refusal and recovery.** An open overhead, a missed wall and a member that
 *    would reach the floor refuse with the approved words, write nothing, and the
 *    same session places correctly afterwards.
 * 4. **Stale generation.** A pinned support whose Layout generation moved refuses
 *    rather than silently re-resolving.
 * 5. **One lifecycle.** Escape writes nothing and releases the lease; placement
 *    stays armed after a commit and mints fresh identities for the next copy; the
 *    new group is selected; Undo and Redo restore exact bytes.
 * 6. **The complete ghost.** A refused member still draws every composed member in
 *    refusal ink, and the mount line is the approved label.
 *
 * No mount relation, group frame or persistent template reference is installed:
 * the copy is ordinary Scene entities and one ordinary cluster.
 */
import { describe, expect, it } from 'vitest';
import {
	createScenePlanners,
	groupTemplateFromCluster,
	type GroupTemplate,
	type NormalizedPlacementDefinition,
} from '@portfolio/project-model/scene-planning';
import type { AcceptanceCoordinator } from '$lib/authoring/f4';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
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
	createEmptyWallFirstLayoutDocument,
	planWallChain,
	type LayoutDocumentWallFirst,
} from '@portfolio/layout-core/wall';
import { planCreateRegion } from '@portfolio/layout-core/room';
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
import { nativePlacementDefinition } from '$lib/authoring/scene/object-definition-policy';
import type { GestureAcquisition } from '$lib/authoring/stage/stage-adapter-host';
import {
	armGroupCopy,
	clearArmedGroupCopy,
	createGroupCopyPlacementSession,
	peekArmedGroupCopy,
	type ArmedGroupCopy,
	type GroupCopyOriginMode,
	type GroupCopyPlacementSession,
	type GroupCopyPointer,
} from '$lib/authoring/adapters/scene/group-copy-placement-session';
import {
	admitUnitProject,
	createUnitCoordinator,
	createUnitProject,
} from '../__fixtures__/unit-envelope-fixtures';

const PROJECT_ID = 'project-d8p-session';
const REVISION: AcceptedRevision = { projectId: PROJECT_ID, revisionId: 'revision-1' };
const SESSION = 'session-d8p';

function supportedLayout(): LayoutDocumentWallFirst {
	const empty = createEmptyWallFirstLayoutDocument();
	const baseline = { ...empty, floor: { ...empty.floor, elevation: 0 } };
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

/** A floor with no enclosure: nothing overhead, and the floor carries support. */
function openFloorLayout(): LayoutDocumentWallFirst {
	const planned = planCreateRegion({
		baseline: createEmptyWallFirstLayoutDocument(),
		capture: freshCapture(),
		intent: {
			role: 'floor',
			footprint: [
				[0, 0],
				[8, 0],
				[8, 8],
				[0, 8],
			],
			elevation: 0,
			thickness: 0.2,
		},
	});
	if (planned.kind !== 'success') throw new Error('the open-floor fixture was refused');
	return planned.document;
}

function overheadLayout(name = 'Soffit'): LayoutDocumentWallFirst {
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
	return {
		...planned.document,
		regions: planned.document.regions.map((region) =>
			region.role === 'overhead' ? { ...region, name } : region,
		),
	};
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

/** A seat, a back and a downward spot: the cluster a creator would copy. */
function sourceScene(): CameraFreeSceneDocument {
	return sceneWith(
		[
			box('seat-src', [2, 0.25, 1], { width: 1, height: 0.5, depth: 1 }),
			box('back-src', [2, 1, 1.4], { width: 1, height: 1, depth: 0.2 }),
			spot('lamp-src', [2, 1.8, 1]),
		],
		[{ id: 'cluster-pair', name: 'Pair', memberIds: ['seat-src', 'back-src', 'lamp-src'] }],
	);
}

/** Two weights that only a wall can hold: the lower one would reach the floor. */
function suspendedTemplate(): GroupTemplate {
	return {
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
}

type Harness = {
	readonly session: GroupCopyPlacementSession;
	readonly coordinator: AcceptanceCoordinator<ProjectEnvelope>;
	readonly intents: AuthoringIntent[];
	readonly selections: string[];
	readonly armFromCluster: (clusterId: string, origin: GroupCopyOriginMode) => ArmedGroupCopy;
	readonly armTemplate: (
		template: GroupTemplate,
		name: string,
		origin: GroupCopyOriginMode,
	) => ArmedGroupCopy;
	readonly escape: () => void;
	readonly hold: (owner: string) => void;
	readonly held: () => string | null;
	readonly releaseHeld: () => void;
	readonly scene: () => CameraFreeSceneDocument;
	readonly sourceContentId: () => string;
	readonly revisionId: () => string;
};

async function boot(input: {
	readonly layout?: LayoutDocumentWallFirst;
	readonly scene?: CameraFreeSceneDocument;
}): Promise<Harness> {
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'D8p session harness',
		acceptedRevision: REVISION,
		...(input.layout === undefined ? {} : { layout: input.layout }),
		...(input.scene === undefined ? {} : { scene: input.scene }),
	});
	const admitted = await admitUnitProject(project, REVISION);
	if (admitted.kind !== 'admitted') throw new Error(JSON.stringify(admitted.issues));
	const definitions: readonly NormalizedPlacementDefinition[] = [
		await nativePlacementDefinition('box'),
	];
	const coordinator = await createUnitCoordinator({
		sessionEpoch: SESSION,
		baseline: {
			revision: admitted.project.acceptedRevision,
			source: admitted.project,
			canonicalJson: admitted.canonicalJson,
			sourceContentId: admitted.sourceContentId,
		},
		planners: createScenePlanners({ definitions: () => definitions }),
		mintRevisionId: (ordinal: number) => `revision-${ordinal + 1}`,
	});
	const intents: AuthoringIntent[] = [];
	const selections: string[] = [];
	let holder: string | null = null;
	let epoch = 0;
	let minted = 0;
	const session = createGroupCopyPlacementSession({
		read: () => {
			const state = coordinator.current();
			return {
				projectId: state.revision.projectId,
				sourceContentId: state.sourceContentId,
				layout: state.source.units.layout.data,
				scene: state.source.units.scene.data,
				definitions,
			};
		},
		accept: async (intent) => {
			intents.push(intent);
			const result = await coordinator.accept(intent);
			if (result.kind !== 'rejected') return { kind: 'installed' as const };
			return {
				kind: 'refused' as const,
				code: result.reason ?? result.code,
				message: result.message,
			};
		},
		acceptedRevisionId: () => coordinator.acceptedRevision().revisionId,
		acquireGesture: (request): GestureAcquisition => {
			if (holder !== null) {
				return { kind: 'refused', code: 'gesture-held', owner: holder };
			}
			holder = request.owner;
			const owner = request.owner;
			const lease = {
				owner,
				evaluationId: request.evaluationId,
				acceptedRevision: coordinator.acceptedRevision(),
				policy: request.policy,
				token: { sessionEpoch: SESSION, epoch: (epoch += 1) },
				active: true,
				release: () => {
					lease.active = false;
					if (holder === owner) holder = null;
				},
			};
			return { kind: 'granted', lease };
		},
		selectGroup: (clusterId) => selections.push(clusterId),
		notify: () => {},
		mint: () => `id-${(minted += 1)}`,
	});

	function armFromCluster(clusterId: string, origin: GroupCopyOriginMode): ArmedGroupCopy {
		const state = coordinator.current();
		const extracted = groupTemplateFromCluster({
			scene: state.source.units.scene.data,
			layout: state.source.units.layout.data,
			sourceContentId: state.sourceContentId,
			clusterId,
		});
		if (extracted.kind !== 'template') throw new Error(JSON.stringify(extracted));
		return armTemplate(extracted.template, extracted.template.name, origin);
	}

	function armTemplate(
		template: GroupTemplate,
		name: string,
		origin: GroupCopyOriginMode,
	): ArmedGroupCopy {
		const copy: ArmedGroupCopy = { template, name, origin };
		armGroupCopy(PROJECT_ID, copy);
		session.arm(peekArmedGroupCopy(PROJECT_ID));
		return copy;
	}

	return {
		session,
		coordinator,
		intents,
		selections,
		armFromCluster,
		armTemplate,
		escape: () => {
			clearArmedGroupCopy(PROJECT_ID);
			session.cancel();
		},
		hold: (owner) => {
			holder = owner;
		},
		held: () => holder,
		releaseHeld: () => {
			holder = null;
		},
		scene: () => coordinator.current().source.units.scene.data,
		sourceContentId: () => coordinator.current().sourceContentId,
		revisionId: () => coordinator.acceptedRevision().revisionId,
	};
}

function pointerAt(x: number, z: number): GroupCopyPointer {
	return { point: [x, 0, z], wallNormal: null };
}

function wallPointer(position: Vec3, normal: Vec3 | null): GroupCopyPointer {
	return { point: position, wallNormal: normal };
}

function installed(scene: CameraFreeSceneDocument, ids: readonly string[]): SceneEntity[] {
	return ids.map((id) => {
		const entity = scene.entities.find((candidate) => candidate.id === id);
		if (entity === undefined) throw new Error(`missing installed entity ${id}`);
		return entity;
	});
}

describe('group-copy placement session — support origin', () => {
	it('previews what acceptance installs, writes one intent and selects the new group', async () => {
		const harness = await boot({ layout: supportedLayout(), scene: sourceScene() });
		const baseline = harness.scene();
		const armed = harness.armFromCluster('cluster-pair', 'support');
		expect(peekArmedGroupCopy(PROJECT_ID)).toBe(armed);

		const begun = harness.session.begin(armed, pointerAt(4, 3), 'eval-1');
		expect(begun.kind).toBe('candidate');
		const candidate = harness.session.candidate();
		expect(candidate).not.toBeNull();
		if (candidate === null) return;

		// The captured name, with G1's collision suffix because the source holds it.
		expect(candidate.name).toBe('Pair 2');
		expect(candidate.origin).toEqual({ kind: 'support', worldXZ: [4, 3] });
		expect(candidate.yaw).toBe(0);
		expect(candidate.anchor).toEqual([4, 0, 3]);
		expect(candidate.mount).toBe('On the floor');
		expect(candidate.contacts).toEqual([-0.25, -0.5, null]);
		expect(candidate.entityIds).toHaveLength(3);
		expect(new Set(candidate.entityIds).size).toBe(3);
		// Every solid member proposes its own body; a light has no body ghost.
		expect(harness.session.ghosts()).toHaveLength(2);
		expect(harness.session.proposalLive()).toBe(true);

		const committed = await harness.session.commit();
		expect(committed).toEqual({ kind: 'committed', clusterId: candidate.clusterId });
		expect(harness.intents).toHaveLength(1);
		expect(harness.intents[0]!.kind).toBe('place-group-copy');
		expect(harness.intents[0]!.payload).toMatchObject({
			kind: 'place-group-copy',
			name: 'Pair 2',
			origin: { kind: 'support', worldXZ: [4, 3] },
			yaw: 0,
			entityIds: [...candidate.entityIds],
			clusterId: candidate.clusterId,
			contacts: [-0.25, -0.5, null],
		});

		const scene = harness.scene();
		const copies = installed(scene, candidate.entityIds);
		// The previewed pose is the installed pose, member for member.
		for (const [index, copy] of copies.entries()) {
			expect(copy.position).toEqual(candidate.members[index]!.position);
			expect(copy.rotation).toEqual(candidate.members[index]!.rotation);
		}
		expect(scene.clusters).toContainEqual({
			id: candidate.clusterId,
			name: 'Pair 2',
			memberIds: [...candidate.entityIds],
		});
		// The new group is selected, and the template is not stored on the copy.
		expect(harness.selections).toEqual([candidate.clusterId]);
		expect(scene.clusters).toHaveLength(2);
		expect(scene.entities).toHaveLength(6);
		expect(harness.session.candidate()).toBeNull();
		expect(harness.session.armed()).not.toBeNull();
		expect(peekArmedGroupCopy(PROJECT_ID)).toBe(armed);

		// Atomic history: Undo restores the exact baseline, Redo the exact copy.
		await harness.coordinator.undo();
		expect(harness.scene().entities.map((entity) => entity.id)).toEqual(
			baseline.entities.map((entity) => entity.id),
		);
		expect(harness.scene().clusters).toHaveLength(1);
		await harness.coordinator.redo();
		expect(harness.scene().entities).toHaveLength(6);
		expect(harness.scene().clusters).toHaveLength(2);
	});

	it('stays armed and mints fresh identities for the next copy', async () => {
		const harness = await boot({ layout: supportedLayout(), scene: sourceScene() });
		const armed = harness.armFromCluster('cluster-pair', 'support');
		harness.session.begin(armed, pointerAt(4, 3), 'eval-1');
		const first = harness.session.candidate()!;
		await harness.session.commit();

		// Placement stays armed after a commit.
		const second = harness.session.begin(armed, pointerAt(5, 4), 'eval-2');
		expect(second.kind).toBe('candidate');
		const copy = harness.session.candidate()!;
		expect(copy.clusterId).not.toBe(first.clusterId);
		expect(copy.entityIds.some((id) => first.entityIds.includes(id))).toBe(false);
		// G1's collision rule names the second cluster.
		expect(copy.name).toBe('Pair 3');
		await harness.session.commit();
		expect(harness.intents).toHaveLength(2);
		expect(harness.scene().clusters).toHaveLength(3);
	});

	it('Escape writes nothing, releases the lease and disarms', async () => {
		const harness = await boot({ layout: supportedLayout(), scene: sourceScene() });
		const armed = harness.armFromCluster('cluster-pair', 'support');
		harness.session.begin(armed, pointerAt(4, 3), 'eval-1');
		expect(harness.session.proposalLive()).toBe(true);
		harness.escape();
		expect(harness.session.candidate()).toBeNull();
		expect(harness.session.proposalLive()).toBe(false);
		expect(harness.session.armed()).toBeNull();
		expect(peekArmedGroupCopy(PROJECT_ID)).toBeNull();
		expect(harness.intents).toHaveLength(0);
		expect(harness.held()).toBeNull();
		expect(harness.revisionId()).toBe('revision-1');
		expect(harness.scene().entities).toHaveLength(3);
	});

	it('refuses a stale support generation without writing', async () => {
		const harness = await boot({ layout: supportedLayout(), scene: sourceScene() });
		const armed = harness.armFromCluster('cluster-pair', 'support');
		const outcome = harness.session.begin(
			armed,
			{
				point: [4, 0, 3],
				wallNormal: null,
				choice: { kind: 'elevation', elevation: 0, generationId: 'stale-generation' },
			},
			'eval-1',
		);
		expect(outcome.kind).toBe('refused');
		expect(harness.session.refusal()?.code).toBe('stale-generation');
		expect(harness.session.ghosts()).toHaveLength(0);
		expect(harness.intents).toHaveLength(0);
		expect(harness.scene().entities).toHaveLength(3);
	});

	it('refuses a begin while another owner holds the gesture lease', async () => {
		const harness = await boot({ layout: supportedLayout(), scene: sourceScene() });
		const armed = harness.armFromCluster('cluster-pair', 'support');
		harness.hold('scene-transform');
		const outcome = harness.session.begin(armed, pointerAt(4, 3), 'eval-1');
		expect(outcome).toMatchObject({ kind: 'refused', code: 'gesture-held' });
		expect(harness.intents).toHaveLength(0);
		harness.releaseHeld();
		expect(harness.session.begin(armed, pointerAt(4, 3), 'eval-2').kind).toBe('candidate');
	});
});

describe('group-copy placement session — overhead origin', () => {
	it('hangs from the named face and installs the previewed elevation', async () => {
		const harness = await boot({ layout: overheadLayout('Soffit'), scene: sourceScene() });
		const armed = harness.armFromCluster('cluster-pair', 'overhead');
		const begun = harness.session.begin(armed, pointerAt(3, 3), 'eval-1');
		expect(begun.kind).toBe('candidate');
		const candidate = harness.session.candidate()!;
		expect(candidate.origin).toEqual({ kind: 'overhead', worldXZ: [3, 3] });
		expect(candidate.anchor).toEqual([3, 2.2, 3]);
		expect(candidate.mount).toBe('Hangs from Soffit · 2.20 m');

		await harness.session.commit();
		const scene = harness.scene();
		const [seat] = installed(scene, [candidate.entityIds[0]!]);
		expect(seat!.position[1]).toBeCloseTo(2.2 + 0.25, 9);
		expect(seat!.position).toEqual(candidate.members[0]!.position);
		expect(harness.intents[0]!.payload).toMatchObject({
			origin: { kind: 'overhead', worldXZ: [3, 3] },
		});
	});

	it('refuses an open overhead with the approved words, then recovers', async () => {
		const harness = await boot({ layout: openFloorLayout(), scene: sourceScene() });
		const armed = harness.armFromCluster('cluster-pair', 'overhead');
		const refused = harness.session.begin(armed, pointerAt(3, 3), 'eval-1');
		expect(refused).toEqual({
			kind: 'refused',
			code: 'no-overhead-support',
			message: 'Nothing overhead to hang from here',
		});
		expect(harness.session.refusal()?.message).toBe('Nothing overhead to hang from here');
		expect(harness.session.ghosts()).toHaveLength(0);
		expect(harness.intents).toHaveLength(0);
		expect(harness.scene().entities).toHaveLength(3);

		// The same session recovers on a floor placement.
		harness.escape();
		const support = harness.armFromCluster('cluster-pair', 'support');
		expect(harness.session.begin(support, pointerAt(4, 3), 'eval-2').kind).toBe('candidate');
		expect((await harness.session.commit()).kind).toBe('committed');
		expect(harness.scene().entities).toHaveLength(6);
	});
});

describe('group-copy placement session — wall origin', () => {
	it('faces the pointer’s wall normal and keeps the stored height', async () => {
		const harness = await boot({ layout: supportedLayout(), scene: sourceScene() });
		const armed = harness.armFromCluster('cluster-pair', 'wall');
		const begun = harness.session.begin(
			armed,
			wallPointer([1.2, 1.6, 5.9], [0, 0, 1]),
			'eval-1',
		);
		expect(begun.kind).toBe('candidate');
		const candidate = harness.session.candidate()!;
		expect(candidate.origin).toEqual({ kind: 'wall', position: [1.2, 1.6, 5.9] });
		expect(candidate.yaw).toBeCloseTo(0, 9);
		expect(candidate.anchor).toEqual([1.2, 1.6, 5.9]);
		expect(candidate.mount).toBe('On the wall · 1.60 m · faces out');

		await harness.session.commit();
		const [seat] = installed(harness.scene(), [candidate.entityIds[0]!]);
		expect(seat!.position).toEqual(candidate.members[0]!.position);
		expect(harness.intents[0]!.payload).toMatchObject({
			origin: { kind: 'wall', position: [1.2, 1.6, 5.9] },
		});
	});

	it('refuses a pointer that did not hit a wall', async () => {
		const harness = await boot({ layout: supportedLayout(), scene: sourceScene() });
		const armed = harness.armFromCluster('cluster-pair', 'wall');
		expect(harness.session.begin(armed, wallPointer([1.2, 1.6, 5.9], null), 'eval-1')).toEqual({
			kind: 'refused',
			code: 'not-a-wall',
			message: 'Point at a wall',
		});
		// A ceiling or floor face is not a wall either.
		expect(
			harness.session.begin(armed, wallPointer([1.2, 1.6, 5.9], [0, 1, 0]), 'eval-2'),
		).toMatchObject({ kind: 'refused', code: 'not-a-wall' });
		expect(harness.intents).toHaveLength(0);
	});

	it('draws the complete refused ghost and names the member that reaches the floor', async () => {
		const harness = await boot({ layout: supportedLayout(), scene: sourceScene() });
		const armed = harness.armTemplate(suspendedTemplate(), 'Suspended', 'wall');
		const outcome = harness.session.begin(armed, wallPointer([2, 0, 2], [0, 0, 1]), 'eval-1');
		expect(outcome).toMatchObject({ kind: 'refused', code: 'no-support' });
		expect(harness.session.refusal()?.message).toBe('Weight would reach the floor here');
		const ghosts = harness.session.ghosts();
		expect(ghosts).toHaveLength(2);
		expect(ghosts.every((ghost) => ghost.treatment === 'refused')).toBe(true);
		expect(harness.intents).toHaveLength(0);
		expect(harness.scene().entities).toHaveLength(3);
	});
});

describe('group-copy placement session — arm store', () => {
	it('keeps one project’s armed copy and clears it on request', () => {
		const armed: ArmedGroupCopy = {
			template: suspendedTemplate(),
			name: 'Suspended',
			origin: 'wall',
		};
		armGroupCopy(PROJECT_ID, armed);
		expect(peekArmedGroupCopy(PROJECT_ID)).toBe(armed);
		expect(peekArmedGroupCopy('another-project')).toBeNull();
		clearArmedGroupCopy(PROJECT_ID);
		expect(peekArmedGroupCopy(PROJECT_ID)).toBeNull();
	});
});
