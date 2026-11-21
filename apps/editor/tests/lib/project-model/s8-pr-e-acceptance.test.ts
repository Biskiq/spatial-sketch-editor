/**
 * T2.S8 E exit — manual authoring and correctable set import, through the
 * ordinary authoring adapter.
 *
 * Every write is one F4 intent against the expected revision: create, correct a
 * binding, reset inherited ↔ disabled, a shared edit across an entity, a Wall
 * and a dormant lid, cloning a subset, deleting an unused Finish, Undo/Redo and
 * *Model's own*. Set import shuffles files, reverses completion order, varies
 * GL/DX and packed/loose duplicates, cancels after the first ready upload and
 * retries a corrupt member, and no partial Finish ever appears. Automatic and
 * manual assembly of the same accepted draft produce the same project.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	surfaceKey,
	type LayoutDocumentWallFirst,
	type LayoutSurfaceRef
} from '@portfolio/layout-core';
import type {

	AuthoringIntent,
	SceneEntity,
	SceneMaterialInstance,
	SemanticReference
} from '@portfolio/project-model';
import {
	draftFromCandidate,
	proposeMaterialSet,
	type DraftEdits
} from '@portfolio/project-model/material-authoring';
import {
	SCENE_FINISH_PATCH,
	SCENE_FINISH_REGISTER,
	SCENE_FINISH_REMOVE,
	SCENE_FINISH_RENAME,
	applyFinishPatch,
	inspectFinish,
	resolveEnvelopeFinish,
	surfaceUserKey
} from '@portfolio/project-model/scene-planning';
import {
	MODEL_RESOURCE_MIME,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { admitSourceJson } from '$lib/authoring/stage/source-admission';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createMaterialProofRegistry } from '$lib/authoring/material-proof';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import {
	acceptDraft,
	prepareDraft,
	readSetFileFacts,
	type AcceptDraftHost,
	type DraftTargets,
	type PreparedFinishDraft,
	type SetFileInput
} from '$lib/authoring/materials/material-set';
import type { ImportedProjectImage } from '$lib/authoring/artwork/project-artwork';
import type { ProjectApi } from '$lib/platform/project-persistence';
import { imageSha256 } from '$lib/render/artwork/image-digest';
import { createSceneTargetAnalysis, type ModelDerivativeAnalysis } from '$lib/render/materials/target-analysis';
import { createUnitCoordinator, createUnitProject, unitRevision } from '../authoring/__fixtures__/unit-envelope-fixtures';
import { g1DocumentWithRooms, g1RoomPolygon } from '../layout/__fixtures__/layout-g1-fixtures';

// ---------------------------------------------------------------------------
// Files

function concat(parts: readonly Uint8Array[]): Uint8Array {
	const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		out.set(part, offset);
		offset += part.length;
	}
	return out;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
	const out = new Uint8Array(12 + data.length);
	new DataView(out.buffer).setUint32(0, data.length);
	for (let index = 0; index < 4; index += 1) out[4 + index] = type.charCodeAt(index);
	out.set(data, 8);
	return out;
}

/** A minimal 8-bit RGBA PNG whose bytes (and so digest) depend on `label`. */
function png(label: string): Uint8Array {
	const ihdr = new Uint8Array(13);
	const header = new DataView(ihdr.buffer);
	header.setUint32(0, 4);
	header.setUint32(4, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	return concat([
		Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('tEXt', Uint8Array.from([...`Comment\0${label}`].map((char) => char.charCodeAt(0)))),
		chunk('IDAT', Uint8Array.from([0])),
		chunk('IEND', new Uint8Array())
	]);
}

function file(key: string, name: string, label = name): SetFileInput {
	return { key, file: new File([png(label) as BlobPart], name, { type: 'image/png' }) };
}

const STEEL = [
	file('colour', 'Steel_BaseColor_2k.png'),
	file('orm', 'Steel_ORM_2k.png'),
	file('normal', 'Steel_NormalDX_2k.png')
];

function shuffle<T>(items: readonly T[], seed: number): T[] {
	const out = [...items];
	let state = seed;
	for (let index = out.length - 1; index > 0; index -= 1) {
		state = (state * 1103515245 + 12345) % 2147483648;
		const swap = state % (index + 1);
		[out[index], out[swap]] = [out[swap]!, out[index]!];
	}
	return out;
}

// ---------------------------------------------------------------------------
// Project

const SHELF_HASH = `sha256-${'d'.repeat(64)}`;
const LID: LayoutSurfaceRef = { kind: 'room-lid', roomId: 'roof-room' };
const WALL: LayoutSurfaceRef = { kind: 'wall-side', wallId: 'wall-a', side: 'left' };

function layout(): LayoutDocumentWallFirst {
	const document = createEmptyWallFirstLayoutDocument();
	const rooms = g1DocumentWithRooms([g1RoomPolygon('roof-room', [[8, 0], [12, 0], [12, 3], [8, 3]])]);
	rooms.rooms[0]!.overhead = 'open-to-sky';
	document.floor.id = rooms.floor.id;
	document.junctions = [
		{ id: 'wall-a:start', point: [0, 0] },
		{ id: 'wall-a:end', point: [4, 0] },
		...rooms.junctions
	];
	document.walls = [
		{ id: 'wall-a', startJunctionId: 'wall-a:start', endJunctionId: 'wall-a:end', height: 2.8, thickness: 0.2, centerline: { kind: 'line' } },
		...rooms.walls
	];
	document.rooms = rooms.rooms;
	return document;
}

function box(id: string, instanceId?: string): SceneEntity {
	return {
		kind: 'primitive',
		id,
		name: id,
		position: [0, 0, 0],
		rotation: [0, 0, 0],
		primitive: 'box',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		...(instanceId === undefined ? {} : { materialInstanceId: instanceId })
	} as SceneEntity;
}

function shelf(): SceneEntity {
	return {
		kind: 'model',
		id: 'shelf',
		name: 'Shelf GLB',
		position: [3, 0, 0],
		rotation: [0, 0, 0],
		assetId: 'creator-shelf',
		fallback: 'generic'
	} as SceneEntity;
}

function lamp(): SceneEntity {
	return {
		kind: 'light',
		id: 'lamp',
		name: 'Lamp',
		position: [0, 2, 0],
		rotation: [0, 0, 0],
		light: 'point',
		color: '#ffffff',
		intensity: 1,
		castShadow: false
	} as SceneEntity;
}

const SHARED: SceneMaterialInstance = {
	id: 'shared',
	name: 'Shared plaster',
	base: { catalogue: 'plaster-warm' },
	overrides: { color: '#aabbcc' }
};

function modelDerivative(digest: string): ModelDerivativeAnalysis | null {
	if (digest !== SHELF_HASH) return null;
	return {
		digest,
		draws: [{
			drawKey: 'mesh-0',
			geometry: {
				positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
				indices: [0, 1, 2, 0, 2, 3],
				uvs: [[0, 0, 1, 0, 1, 1, 0, 1], null]
			}
		}]
	};
}

function modelResources() {
	const pin = { hash: SHELF_HASH, mime: MODEL_RESOURCE_MIME, size: 1024, locator: `/projects/project-e/models/content/${SHELF_HASH}` };
	return {
		resources: {
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [{
				kind: 'model' as const, id: 'creator-shelf', contentRevision: SHELF_HASH, pin, unresolved: null,
				model: {
					source: { manifestHash: `sha256-${'e'.repeat(64)}`, size: 2048, fileCount: 2 },
					recipe: { id: 'creator-import', version: 1 },
					reportDigest: `sha256-${'f'.repeat(64)}`,
					placement: { metresPerSourceUnit: 0.5, pivot: [0, 0, 0] as [number, number, number], footprint: { width: 1.2, depth: 0.8 }, contactMinY: 0, placement: 'floor' as const }
				}
			}]
		},
		dependencyLock: {
			formatVersion: 1 as const,
			entries: [{
				domain: 'resource:model', subjectKind: 'resource' as const, subjectId: 'creator-shelf',
				instancePath: [], contentRevision: SHELF_HASH, requiredCapabilities: [], pin
			}]
		}
	};
}

function byKey<T extends { surface: LayoutSurfaceRef }>(entries: T[]): T[] {
	return entries.sort((left, right) => (surfaceKey(left.surface) < surfaceKey(right.surface) ? -1 : 1));
}

async function fixture() {
	const extras = modelResources();
	const project = await createUnitProject({
		id: 'project-e',
		name: 'E slice',
		layout: layout(),
		scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: [],
			materials: [SHARED],
			entities: [box('plinth'), box('plinth-b', 'shared'), shelf(), lamp()],
			surfaceFinishes: byKey([
				{ surface: WALL, finish: { materialInstanceId: 'shared' } },
				{ surface: LID, finish: { materialInstanceId: 'shared' } }
			])
		},
		resources: extras.resources as never,
		dependencyLock: extras.dependencyLock as never
	});
	const materialProofs = createMaterialProofRegistry();
	const admitted = await admitSourceJson(serializeProjectEnvelope(project), {
		sessionEpoch: 'fixture',
		acceptedRevision: unitRevision('project-e', 'fixture-revision'),
		materialProofs
	});
	if (admitted.kind !== 'admitted') throw new Error(`fixture did not admit: ${JSON.stringify(admitted)}`);
	const holder: { current?: () => ProjectEnvelope } = {};
	const baseline = stageEnvelope(admitted.snapshot);
	const targetAnalysis = createSceneTargetAnalysis({
		read: () => {
			const source = holder.current?.() ?? baseline;
			return {
				scene: {
					textures: source.units.scene.data.textures,
					materials: source.units.scene.data.materials,
					entities: source.units.scene.data.entities,
					objects: []
				} as never,
				sceneRevision: source.units.scene.header.contentRevision,
				layoutRevision: source.units.layout.header.contentRevision,
				geometry: admitted.snapshot.domain.geometry,
				modelDigest: (assetId: string) =>
					source.units.resources.data.resources.find((resource) => resource.kind === 'model' && resource.id === assetId)?.pin?.hash ?? null
			};
		},
		models: modelDerivative
	});
	const planners: unknown[] = [];
	createAdapter({
		materialProofs,
		targetAnalysis,
		authoring: { registerPlanner: (planner: unknown) => (planners.push(planner), { kind: 'registered' }) }
	} as never);
	let ordinal = 0;
	const coordinator = await createUnitCoordinator({
		baseline: {
			revision: admitted.snapshot.acceptedRevision,
			source: baseline,
			canonicalJson: admitted.snapshot.canonicalJson,
			sourceContentId: admitted.snapshot.sourceContentId
		},
		planners: planners as never,
		mintRevisionId: () => `revision-${++ordinal}`
	});
	holder.current = () => coordinator.current().source;
	return { coordinator, materialProofs, targetAnalysis };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

function snapshot(fx: Fixture): string {
	return serializeProjectEnvelope(fx.coordinator.current().source);
}

function scene(fx: Fixture) {
	return fx.coordinator.current().source.units.scene.data;
}

function entityReference(source: ProjectEnvelope, id: string): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: source.units.scene.header.contentRevision },
		subject: { kind: 'entity', id },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function surfaceReference(source: ProjectEnvelope, surface: LayoutSurfaceRef): SemanticReference {
	if (surface.kind !== 'wall-side') throw new Error('this fixture paints Wall sides only');
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: source.units.layout.header.contentRevision },
		subject: { kind: 'wall', id: surface.wallId },
		instancePath: [],
		location: { kind: 'layout-location', levelId: source.units.layout.data.floor.id, structureInstancePath: [] },
		componentId: `side:${surface.side}`,
		capabilityId: null
	};
}

function intent(
	fx: Fixture,
	kind: string,
	payload: unknown,
	operationId: string,
	allocatedIds: readonly { kind: string; id: string }[] = []
): AuthoringIntent {
	return {
		version: 1,
		kind,
		operationId,
		expectedRevision: fx.coordinator.acceptedRevision(),
		targets: [],
		payload: payload as AuthoringIntent['payload'],
		capturedInputs: [],
		allocatedIds
	};
}

// ---------------------------------------------------------------------------
// The P20 importer, in memory

type Upload = { readonly name: string; readonly sha256: string };

function uuidOf(hash: string): string {
	const hex = hash.slice('sha256-'.length);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function importer(options: {
	readonly uploads?: Upload[];
	readonly gate?: (hash: string) => Promise<void>;
	readonly corrupt?: (name: string) => boolean;
} = {}): AcceptDraftHost['importImage'] {
	return (async (_api: ProjectApi, _project: string, input: File, signal: AbortSignal) => {
		const bytes = new Uint8Array(await input.arrayBuffer());
		const sha256 = `sha256-${await imageSha256(bytes)}`;
		await options.gate?.(sha256);
		signal.throwIfAborted();
		options.uploads?.push({ name: input.name, sha256 });
		const image: ImportedProjectImage = {
			assetId: uuidOf(sha256),
			name: input.name,
			pixelWidth: 4,
			pixelHeight: 4,
			mime: 'image/png',
			byteSize: bytes.length,
			sha256: options.corrupt?.(input.name) ? `sha256-${'0'.repeat(64)}` : sha256
		};
		return image;
	}) as never;
}

function host(fx: Fixture, importImage: AcceptDraftHost['importImage']): AcceptDraftHost {
	return {
		api: {} as ProjectApi,
		projectId: 'project-e',
		current: () => ({ source: fx.coordinator.current().source, revision: fx.coordinator.acceptedRevision() }),
		accept: (next) => fx.coordinator.accept(next) as never,
		targetAnalysis: fx.targetAnalysis,
		entityReference,
		surfaceReference: surfaceReference as never,
		importImage
	};
}

const MANUAL_STEEL: DraftEdits = {
	name: 'Steel',
	roles: {
		color: { role: 'color', file: 'colour' },
		normal: { role: 'normal', file: 'normal', convention: '-Y' },
		occlusion: { role: 'occlusion', file: 'orm', component: 'r', invert: false },
		roughness: { role: 'roughness', file: 'orm', component: 'g', invert: false },
		metalness: { role: 'metalness', file: 'orm', component: 'b', invert: false }
	}
};

async function draftOf(fx: Fixture, files: readonly SetFileInput[], edits: DraftEdits): Promise<PreparedFinishDraft> {
	const session = await readSetFileFacts(files, new AbortController().signal);
	const prepared = await prepareDraft(edits, session, fx.coordinator.acceptedRevision(), new AbortController().signal, fx.materialProofs);
	if (!prepared.ok) throw new Error(JSON.stringify(prepared.issues));
	return prepared.draft;
}

async function create(fx: Fixture, targets: DraftTargets, operationId: string, edits: DraftEdits = MANUAL_STEEL) {
	const draft = await draftOf(fx, STEEL, edits);
	return acceptDraft(draft, targets, operationId, new AbortController().signal, host(fx, importer()));
}

function project(fx: Fixture, id: string): SceneMaterialInstance {
	const found = scene(fx).materials.find((instance) => instance.id === id);
	if (found === undefined) throw new Error(`no Finish ${id}`);
	return found;
}

// ---------------------------------------------------------------------------

describe('T2.S8 E exit — editing one Finish', () => {
	it('creates, corrects a binding, disables and re-inherits a map, renames, and undoes each as one entry', async () => {
		const fx = await fixture();
		const baseline = snapshot(fx);
		const created = await create(fx, { entityIds: ['plinth'], surfaces: [] }, 'create');
		expect(created).toMatchObject({ ok: true, finishId: 'finish-create' });
		const finish = project(fx, 'finish-create');
		expect(finish).toMatchObject({ name: 'Steel', base: { material: expect.stringMatching(/^sha256-/) } });
		expect(finish.overrides).toBeUndefined();
		const afterCreate = snapshot(fx);

		const inspected = inspectFinish(fx.coordinator.current().source, { project: 'finish-create' }, { analysis: fx.targetAnalysis });
		expect(inspected).toMatchObject({
			definition: { kind: 'material', hash: (finish.base as { material: string }).material },
			users: [{ kind: 'entity', key: 'entity:plinth' }],
			operations: ['assign', 'rename', 'edit-in-place'],
			issues: []
		});
		expect(inspected!.provenance).not.toBeNull();
		const orm = scene(fx).textures.find((texture) => texture.name === 'Steel_ORM_2k.png');
		expect(orm).toBeDefined();
		const ormImage = { textureId: orm!.id };

		// Correct a binding: roughness reads R instead of G. In place, same id.
		const users = { mode: 'in-place', selectedUsers: ['entity:plinth'], expectedUsers: ['entity:plinth'] };
		const corrected = await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'finish-create' },
			edits: [{ field: 'maps.roughness', op: 'set', value: { image: ormImage, component: 'r', invert: false } }],
			...users
		}, 'correct'));
		expect(corrected.kind).toBe('accepted');
		expect(project(fx, 'finish-create').overrides).toEqual({
			maps: { roughness: { image: ormImage, component: 'r', invert: false } }
		});
		const afterCorrect = snapshot(fx);

		// Disable the inherited normal map; its strength stays authored but dormant.
		expect((await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'finish-create' },
			edits: [{ field: 'maps.normal', op: 'disable' }, { field: 'normalScale', op: 'set', value: 0.5 }],
			...users
		}, 'normal-scale-without-normal')))).toMatchObject({ kind: 'rejected', reason: 'normal-control-without-normal' });
		expect((await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'finish-create' },
			edits: [{ field: 'normalScale', op: 'set', value: 0.5 }],
			...users
		}, 'normal-scale'))).kind).toBe('accepted');
		expect((await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'finish-create' },
			edits: [{ field: 'maps.normal', op: 'disable' }],
			...users
		}, 'disable-normal'))).kind).toBe('accepted');
		expect(project(fx, 'finish-create').overrides).toMatchObject({ normalScale: 0.5, maps: { normal: null } });
		const resolvedDisabled = resolveEnvelopeFinish(fx.coordinator.current().source, project(fx, 'finish-create'));
		expect(resolvedDisabled.issues).toEqual([]);

		// Reset: the base's normal map applies again, with the dormant strength.
		expect((await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'finish-create' },
			edits: [{ field: 'maps.normal', op: 'reset' }],
			...users
		}, 'reset-normal'))).kind).toBe('accepted');
		expect(project(fx, 'finish-create').overrides).toEqual({
			normalScale: 0.5,
			maps: { roughness: { image: ormImage, component: 'r', invert: false } }
		});

		// A no-op writes nothing.
		const beforeNoop = snapshot(fx);
		expect((await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'finish-create' },
			edits: [{ field: 'normalScale', op: 'set', value: 0.5 }],
			...users
		}, 'noop')))).toMatchObject({ kind: 'rejected', reason: 'no-change' });
		expect(snapshot(fx)).toBe(beforeNoop);

		// Rename: trimmed, one entry; empty and unchanged names refuse.
		expect((await fx.coordinator.accept(intent(fx, SCENE_FINISH_RENAME, { finish: { project: 'finish-create' }, name: '   ' }, 'rename-empty'))))
			.toMatchObject({ kind: 'rejected', reason: 'invalid-name' });
		expect((await fx.coordinator.accept(intent(fx, SCENE_FINISH_RENAME, { finish: { project: 'finish-create' }, name: '  Brushed steel ' }, 'rename'))).kind)
			.toBe('accepted');
		expect(project(fx, 'finish-create').name).toBe('Brushed steel');
		expect((await fx.coordinator.accept(intent(fx, SCENE_FINISH_RENAME, { finish: { project: 'finish-create' }, name: 'Brushed steel' }, 'rename-same'))))
			.toMatchObject({ kind: 'rejected', reason: 'no-change' });

		// Undo walks back one completed edit at a time, to before creation.
		const undos = ['rename', 'reset-normal', 'disable-normal', 'normal-scale'];
		for (const _ of undos) expect((await fx.coordinator.undo()).kind).toBe('restored');
		expect(snapshot(fx)).toBe(afterCorrect);
		expect((await fx.coordinator.undo()).kind).toBe('restored');
		expect(snapshot(fx)).toBe(afterCreate);
		expect((await fx.coordinator.undo()).kind).toBe('restored');
		expect(snapshot(fx)).toBe(baseline);
		expect((await fx.coordinator.redo()).kind).toBe('restored');
		expect(snapshot(fx)).toBe(afterCreate);
		expect((await fx.coordinator.redo()).kind).toBe('restored');
		expect(snapshot(fx)).toBe(afterCorrect);
	});

	it('edits a shared Finish across an entity, a Wall and a dormant lid, then clones a subset', async () => {
		const fx = await fixture();
		const all = ['entity:plinth-b', surfaceUserKey(LID), surfaceUserKey(WALL)].sort();
		const inspected = inspectFinish(fx.coordinator.current().source, { project: 'shared' });
		expect(inspected!.users.map((user) => user.key).sort()).toEqual(all);
		expect(inspected!.users.find((user) => user.key === surfaceUserKey(LID))).toMatchObject({ lifecycle: 'dormant' });
		expect(inspected!.operations).toEqual(['assign', 'rename', 'edit-all', 'edit-just-this']);

		// A changed user set refuses, even at the same size.
		const swapped = [...all.slice(1), 'entity:plinth'];
		const stale = await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'shared' }, mode: 'all', selectedUsers: all, expectedUsers: swapped,
			edits: [{ field: 'roughness', op: 'set', value: 0.3 }]
		}, 'stale'));
		expect(stale).toMatchObject({ kind: 'rejected', reason: 'stale-reach' });
		const inPlace = await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'shared' }, mode: 'in-place', selectedUsers: all, expectedUsers: all,
			edits: [{ field: 'roughness', op: 'set', value: 0.3 }]
		}, 'in-place-shared'));
		expect(inPlace).toMatchObject({ kind: 'rejected', reason: 'mode-mismatch' });

		// *All*: the shared instance changes once; every assignment keeps its id,
		// including the dormant lid. A sampling change qualifies only drawing users.
		const edited = await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'shared' }, mode: 'all', selectedUsers: all, expectedUsers: all,
			edits: [
				{ field: 'roughness', op: 'set', value: 0.3 },
				{ field: 'mapping', op: 'set', value: { kind: 'target', metric: { tileMeters: [2, 2], rotation: Math.PI * 2 + 0.5, offset: [1.25, 0] } } }
			]
		}, 'edit-all'));
		expect(edited.kind).toBe('accepted');
		expect(project(fx, 'shared').overrides).toEqual({
			color: '#aabbcc',
			roughness: 0.3,
			mapping: { kind: 'target', metric: { tileMeters: [2, 2], rotation: 0.5, offset: [0.25, 0] } }
		});
		expect(scene(fx).surfaceFinishes).toEqual(byKey([
			{ surface: WALL, finish: { materialInstanceId: 'shared' } },
			{ surface: LID, finish: { materialInstanceId: 'shared' } }
		]));

		// *Just this*: one clone shared by the selected proper subset.
		const subset = [surfaceUserKey(WALL), 'entity:plinth-b'].sort();
		const cloned = await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'shared' }, mode: 'just-this', selectedUsers: subset, expectedUsers: all,
			edits: [{ field: 'color', op: 'set', value: '#112233' }]
		}, 'clone', [{ kind: 'scene-finish', id: 'shared-clone' }]));
		expect(cloned.kind).toBe('accepted');
		expect(project(fx, 'shared-clone').overrides).toMatchObject({ color: '#112233', roughness: 0.3 });
		expect(project(fx, 'shared').overrides).toMatchObject({ color: '#aabbcc' });
		expect(scene(fx).entities.find((entity) => entity.id === 'plinth-b')).toMatchObject({ materialInstanceId: 'shared-clone' });
		expect(scene(fx).surfaceFinishes).toEqual(byKey([
			{ surface: WALL, finish: { materialInstanceId: 'shared-clone' } },
			{ surface: LID, finish: { materialInstanceId: 'shared' } }
		]));

		// The original is protected by its dormant lid.
		const removal = await fx.coordinator.accept(intent(fx, SCENE_FINISH_REMOVE, { finish: { project: 'shared' } }, 'remove-shared'));
		expect(removal).toMatchObject({ kind: 'rejected', reason: 'finish-in-use' });
		expect((removal as { message: string }).message).toContain('(1 dormant)');

		expect((await fx.coordinator.undo()).kind).toBe('restored');
		expect(scene(fx).materials.map((instance) => instance.id)).toEqual(['shared']);
	});

	it('materializes a curated base for its users and never edits it in place', async () => {
		const fx = await fixture();
		const users = ['entity:plinth'];
		expect(await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { curated: 'plaster-warm' }, mode: 'in-place', selectedUsers: users, expectedUsers: users,
			edits: [{ field: 'roughness', op: 'set', value: 0.2 }]
		}, 'curated-in-place'))).toMatchObject({ kind: 'rejected', reason: 'mode-mismatch' });
		const materialized = await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { curated: 'plaster-warm' }, mode: 'all', selectedUsers: users, expectedUsers: users,
			edits: [{ field: 'roughness', op: 'set', value: 0.2 }]
		}, 'materialize', [{ kind: 'scene-finish', id: 'plaster-tuned' }]));
		expect(materialized.kind).toBe('accepted');
		expect(project(fx, 'plaster-tuned')).toMatchObject({ base: { catalogue: 'plaster-warm' }, overrides: { roughness: 0.2 } });
		expect(scene(fx).entities.find((entity) => entity.id === 'plinth')).toMatchObject({ materialInstanceId: 'plaster-tuned' });
	});

	it("keeps Model's own outside Finish editing and refuses a light as a target", async () => {
		const fx = await fixture();
		const own = inspectFinish(fx.coordinator.current().source, 'model-own');
		expect(own).toMatchObject({ name: "Model's own", definition: { kind: 'model-own' }, operations: ['assign'] });
		expect(own!.users.map((user) => user.key)).toEqual(['entity:shelf']);
		expect(await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: 'model-own', mode: 'in-place', selectedUsers: ['entity:shelf'], expectedUsers: ['entity:shelf'],
			edits: [{ field: 'roughness', op: 'set', value: 0.2 }]
		}, 'model-own'))).toMatchObject({ kind: 'rejected', reason: 'not-editable' });
		const before = snapshot(fx);
		const light = await create(fx, { entityIds: ['lamp'], surfaces: [] }, 'on-light');
		// A light never becomes paintable: refuse it, do not report pending work.
		expect(light).toMatchObject({ ok: false, code: 'refused', message: 'Lights have no Finish.' });
		expect(snapshot(fx)).toBe(before);
	});

	it('keeps an unassigned named Finish on the shelf and removes it with its definition when unused', async () => {
		const fx = await fixture();
		const unassigned = await create(fx, { entityIds: [], surfaces: [] }, 'shelf', {
			...MANUAL_STEEL,
			name: 'Matte steel',
			factors: { metalness: 0 }
		});
		expect(unassigned).toMatchObject({ ok: true, finishId: 'finish-shelf' });
		const hash = (project(fx, 'finish-shelf').base as { material: string }).material;
		const resources = () => fx.coordinator.current().source.units.resources.data.resources;
		// The explicitly authored zero multiplier survives composition and registration.
		expect(resources().find((resource) => resource.id === hash)?.material?.recipe.metalness).toBe(0);
		expect(inspectFinish(fx.coordinator.current().source, { project: 'finish-shelf' })!.operations).toContain('remove');
		const textureCount = resources().filter((resource) => resource.kind === 'texture').length;
		expect(textureCount).toBe(3);
		const afterCreate = snapshot(fx);

		const removed = await fx.coordinator.accept(intent(fx, SCENE_FINISH_REMOVE, { finish: { project: 'finish-shelf' } }, 'remove'));
		expect(removed.kind).toBe('accepted');
		expect(scene(fx).materials.map((instance) => instance.id)).toEqual(['shared']);
		expect(resources().some((resource) => resource.id === hash)).toBe(false);
		expect(fx.coordinator.current().source.dependencyLock.entries.some((entry) => entry.subjectId === hash)).toBe(false);
		// Registered texture rows stay under ordinary retention.
		expect(resources().filter((resource) => resource.kind === 'texture')).toHaveLength(textureCount);
		expect(scene(fx).textures).toHaveLength(3);

		expect((await fx.coordinator.undo()).kind).toBe('restored');
		expect(snapshot(fx)).toBe(afterCreate);
	});
});

describe('T2.S8 E exit — correctable set import', () => {
	it('proposes the same set for every file order and blocks a packed/loose or GL/DX duplicate', async () => {
		const reference = JSON.stringify(proposeMaterialSet((await readSetFileFacts(STEEL, new AbortController().signal)).facts, 'r'));
		for (const seed of [3, 17, 256]) {
			const session = await readSetFileFacts(shuffle(STEEL, seed), new AbortController().signal);
			expect(JSON.stringify(proposeMaterialSet(session.facts, 'r'))).toBe(reference);
		}
		const duplicates = [
			...STEEL,
			file('loose', 'Steel_Roughness_2k.png'),
			file('gl', 'Steel_NormalGL_2k.png')
		];
		const session = await readSetFileFacts(duplicates, new AbortController().signal);
		const candidate = proposeMaterialSet(session.facts, 'r').candidates[0]!;
		expect(candidate.conflicts.map((conflict) => [conflict.code, conflict.role])).toEqual([
			['duplicate-role', 'normal'],
			['packed-loose-collision', 'roughness']
		]);
		expect(draftFromCandidate(candidate)).toMatchObject({ ok: false });
		// The creator resolves both: the GL normal and the loose roughness map.
		const resolved = draftFromCandidate(candidate, {
			set: {
				normal: { role: 'normal', file: 'gl', convention: '+Y' },
				roughness: { role: 'roughness', file: 'loose', component: 'r', invert: false }
			}
		});
		expect(resolved.ok).toBe(true);
	});

	it('assembles the same project automatically and by hand, in either completion order', async () => {
		const automatic = await fixture();
		const session = await readSetFileFacts(shuffle(STEEL, 5), new AbortController().signal);
		const candidate = proposeMaterialSet(session.facts, automatic.coordinator.acceptedRevision().revisionId).candidates[0]!;
		const lowered = draftFromCandidate(candidate, { name: 'Steel' });
		if (!lowered.ok) throw new Error(JSON.stringify(lowered.issues));
		const autoDraft = await prepareDraft(lowered.edits, session, automatic.coordinator.acceptedRevision(), new AbortController().signal, automatic.materialProofs);
		if (!autoDraft.ok) throw new Error(JSON.stringify(autoDraft.issues));
		// Reverse completion: the last digest finishes first.
		const order = [...autoDraft.draft.sources.keys()].sort().reverse();
		const released: string[] = [];
		const gates = new Map(order.map((hash) => {
			let open!: () => void;
			const promise = new Promise<void>((resolve) => (open = resolve));
			return [hash, { promise, open }];
		}));
		const reversed = importer({
			gate: async (hash) => {
				await gates.get(hash)!.promise;
				released.push(hash);
			}
		});
		expect(await acceptDraft(autoDraft.draft, { entityIds: ['plinth'], surfaces: [WALL] }, 'mixed', new AbortController().signal, host(automatic, importer())))
			.toMatchObject({ ok: false, code: 'refused' });
		const pending = acceptDraft(autoDraft.draft, { entityIds: [], surfaces: [WALL] }, 'steel', new AbortController().signal, host(automatic, reversed));
		for (const hash of order) {
			gates.get(hash)!.open();
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
		expect(await pending).toEqual({ ok: true, finishId: 'finish-steel', revision: expect.anything() });

		const manual = await fixture();
		const manualDraft = await draftOf(manual, STEEL, MANUAL_STEEL);
		expect(manualDraft.recipe).toEqual(autoDraft.draft.recipe);
		expect(manualDraft.recipeHash).toBe(autoDraft.draft.recipeHash);
		expect(await acceptDraft(manualDraft, { entityIds: [], surfaces: [WALL] }, 'steel', new AbortController().signal, host(manual, importer())))
			.toMatchObject({ ok: true, finishId: 'finish-steel' });

		// Canonical recipe, closure, resolved output and history agree.
		expect(snapshot(automatic)).toBe(snapshot(manual));
		const finishOf = (fx: Fixture) => resolveEnvelopeFinish(fx.coordinator.current().source, project(fx, 'finish-steel'));
		expect(finishOf(automatic)).toEqual(finishOf(manual));
		expect(scene(automatic).surfaceFinishes).toContainEqual({ surface: WALL, finish: { materialInstanceId: 'finish-steel' } });
		expect((await automatic.coordinator.undo()).kind).toBe('restored');
		expect((await manual.coordinator.undo()).kind).toBe('restored');
		expect(snapshot(automatic)).toBe(snapshot(manual));
	});

	it('cancels after the first ready upload and retries a corrupt member with no partial Finish', async () => {
		const fx = await fixture();
		const baseline = snapshot(fx);
		const draft = await draftOf(fx, STEEL, MANUAL_STEEL);
		const controller = new AbortController();
		const uploads: Upload[] = [];
		let first = true;
		const cancelling = importer({
			uploads,
			gate: async () => {
				if (first) {
					first = false;
					return;
				}
				// The first upload is ready; the creator cancels before the rest finish.
				controller.abort();
			}
		});
		const cancelled = await acceptDraft(draft, { entityIds: ['plinth'], surfaces: [] }, 'cancelled', controller.signal, host(fx, cancelling));
		expect(cancelled).toMatchObject({ ok: false, code: 'aborted' });
		expect(uploads).toHaveLength(1);
		expect(snapshot(fx)).toBe(baseline);

		const corrupt = await acceptDraft(draft, { entityIds: ['plinth'], surfaces: [] }, 'corrupt', new AbortController().signal, host(fx, importer({
			corrupt: (name) => name === 'Steel_ORM_2k.png'
		})));
		expect(corrupt).toMatchObject({ ok: false, code: 'image-pin-mismatch' });
		expect(snapshot(fx)).toBe(baseline);

		// A stale draft refuses instead of writing against a newer revision.
		expect((await fx.coordinator.accept(intent(fx, SCENE_FINISH_RENAME, { finish: { project: 'shared' }, name: 'Renamed' }, 'bump'))).kind).toBe('accepted');
		const bumped = snapshot(fx);
		expect(await acceptDraft(draft, { entityIds: ['plinth'], surfaces: [] }, 'stale', new AbortController().signal, host(fx, importer())))
			.toMatchObject({ ok: false, code: 'stale-revision' });
		expect(snapshot(fx)).toBe(bumped);

		// Retrying with a fresh draft accepts exactly one Finish.
		const retry = await draftOf(fx, STEEL, MANUAL_STEEL);
		expect(await acceptDraft(retry, { entityIds: ['plinth'], surfaces: [] }, 'retry', new AbortController().signal, host(fx, importer())))
			.toMatchObject({ ok: true, finishId: 'finish-retry' });
		expect(scene(fx).materials.map((instance) => instance.id)).toEqual(['shared', 'finish-retry']);
	});

	it('refuses a pending target before any upload', async () => {
		const fx = await fixture();
		const draft = await draftOf(fx, STEEL, MANUAL_STEEL);
		const uploads: Upload[] = [];
		const outcome = await acceptDraft(draft, { entityIds: ['plinth'], surfaces: [] }, 'pending', new AbortController().signal, {
			...host(fx, importer({ uploads })),
			targetAnalysis: () => null
		});
		expect(outcome).toMatchObject({ ok: false, code: 'target-pending' });
		expect(uploads).toEqual([]);
	});

	it('rejects a stale revision from the coordinator as stale-revision, not refused (finding 3)', async () => {
		const fx = await fixture();
		const draft = await draftOf(fx, STEEL, MANUAL_STEEL);
		const h = host(fx, importer());
		const outcome = await acceptDraft(draft, { entityIds: ['plinth'], surfaces: [] }, 'late-stale', new AbortController().signal, {
			...h,
			// The project moves after the post-IO recheck and before the write.
			accept: async (next) => {
				await fx.coordinator.accept(intent(fx, SCENE_FINISH_RENAME, { finish: { project: 'shared' }, name: 'Moved' }, 'bump-late'));
				return fx.coordinator.accept(next) as never;
			}
		});
		expect(outcome).toMatchObject({ ok: false, code: 'stale-revision' });
		expect(scene(fx).materials.map((instance) => instance.id)).toEqual(['shared']);
	});

	it('starts no upload after a failed one has been reported (finding 2)', async () => {
		const fx = await fixture();
		const draft = await draftOf(fx, STEEL, MANUAL_STEEL);
		let started = 0;
		const failing = (async (_api: unknown, _project: string, input: File, _signal: AbortSignal) => {
			started++;
			if (started === 1) throw new Error('upload exploded');
			await new Promise((resolve) => setTimeout(resolve, 30));
			const bytes = new Uint8Array(await input.arrayBuffer());
			return {
				assetId: uuidOf(`sha256-${await imageSha256(bytes)}`),
				name: input.name,
				pixelWidth: 4,
				pixelHeight: 4,
				mime: 'image/png',
				byteSize: bytes.length,
				sha256: `sha256-${await imageSha256(bytes)}`
			};
		}) as never;
		const outcome = await acceptDraft(draft, { entityIds: ['plinth'], surfaces: [] }, 'fails', new AbortController().signal, host(fx, failing));
		expect(outcome).toMatchObject({ ok: false, code: 'upload-failed', message: 'upload exploded' });
		const atReturn = started;
		await new Promise((resolve) => setTimeout(resolve, 80));
		expect(started).toBe(atReturn);
		expect(atReturn).toBe(2);
	});

	it('refuses a dormant surface for good instead of reporting it pending (finding 4)', async () => {
		const fx = await fixture();
		const draft = await draftOf(fx, STEEL, MANUAL_STEEL);
		const uploads: Upload[] = [];
		const outcome = await acceptDraft(draft, { entityIds: [], surfaces: [LID] }, 'dormant', new AbortController().signal, host(fx, importer({ uploads })));
		expect(outcome).toMatchObject({ ok: false, code: 'refused' });
		expect(uploads).toEqual([]);
	});

	it('lists materialize for a curated Finish with no users (finding 8)', async () => {
		const fx = await fixture();
		expect(inspectFinish(fx.coordinator.current().source, { curated: 'wood-walnut' as never })?.operations).toContain('materialize');
		const created = await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { curated: 'wood-walnut' }, mode: 'all', selectedUsers: [], expectedUsers: [],
			edits: [{ field: 'roughness', op: 'set', value: 0.4 }]
		}, 'unassigned', [{ kind: 'scene-finish', id: 'unassigned-concrete' }]));
		expect(created.kind).toBe('accepted');
	});

	it('a Just-this clone that ends pristine takes the curated normal form (finding 1)', async () => {
		const fx = await fixture();
		const all = ['entity:plinth-b', surfaceUserKey(LID), surfaceUserKey(WALL)].sort();
		const reset = { field: 'color', op: 'reset' };
		const surfaceOnly = await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'shared' }, mode: 'just-this', selectedUsers: [surfaceUserKey(WALL)], expectedUsers: all, edits: [reset]
		}, 'pristine-surface', [{ kind: 'scene-finish', id: 'pristine-clone' }]));
		expect(surfaceOnly.kind).toBe('accepted');
		expect(scene(fx).materials.map((instance) => instance.id)).toEqual(['shared']);
		expect(scene(fx).surfaceFinishes).toEqual(byKey([
			{ surface: WALL, finish: { materialId: 'plaster-warm' } },
			{ surface: LID, finish: { materialInstanceId: 'shared' } }
		]));
		expect((await fx.coordinator.undo()).kind).toBe('restored');

		const entityOnly = await fx.coordinator.accept(intent(fx, SCENE_FINISH_PATCH, {
			finish: { project: 'shared' }, mode: 'just-this', selectedUsers: ['entity:plinth-b'], expectedUsers: all, edits: [reset]
		}, 'pristine-entity', [{ kind: 'scene-finish', id: 'pristine-clone-2' }]));
		expect(entityOnly.kind).toBe('accepted');
		expect(scene(fx).materials.map((instance) => instance.id)).toEqual(['shared']);
		const plinthB = scene(fx).entities.find((entity) => entity.id === 'plinth-b') as { materialId?: string; materialInstanceId?: string };
		expect(plinthB.materialId).toBe('plaster-warm');
		expect(plinthB.materialInstanceId).toBeUndefined();
		expect(inspectFinish(fx.coordinator.current().source, { project: 'shared' })!.users.map((user) => user.key)).not.toContain('entity:plinth-b');
	});

	it('resetting a normal map back to a base without one refuses a stranded strength (finding 7)', () => {
		const instance: SceneMaterialInstance = {
			id: 'n',
			name: 'N',
			base: { catalogue: 'plaster-warm' },
			overrides: {
				normalScale: 0.5,
				maps: { normal: { image: { textureId: 'tex' }, convention: '-Y' } }
			} as never
		};
		const stranded = applyFinishPatch(instance, [{ field: 'maps.normal', op: 'reset' }], undefined);
		expect(stranded).toMatchObject({ ok: false, problem: { code: 'normal-control-without-normal' } });
		expect(applyFinishPatch(instance, [{ field: 'maps.normal', op: 'reset' }, { field: 'normalScale', op: 'reset' }], undefined).ok).toBe(true);
		expect(applyFinishPatch(instance, [{ field: 'maps.normal', op: 'disable' }], undefined).ok).toBe(true);
	});
});
