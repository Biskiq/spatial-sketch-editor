/**
 * T2.S8 D — the three-image brushed-metal vertical slice.
 *
 * One registration installs a definition, three texture resources, one material
 * resource and its lock on a primitive. A second operation paints the same
 * shared Finish onto a Wall. The pair is one history entry each, survives
 * Save/load admission and a cold release, and every adversarial variant refuses
 * without producing a candidate.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutSurfaceRef
} from '@portfolio/layout-core';
import type { AuthoringIntent, SceneEntity, SemanticReference } from '@portfolio/project-model';
import {
	buildMaterialDigestProof,
	readRecipe,
	recipeHash,
	type MaterialDigestProof,
	type Recipe
} from '@portfolio/project-model/materials';
import {
	createFinishPlanners,
	SCENE_FINISH_REGISTER,
	SCENE_SURFACE_FINISH_ASSIGN
} from '@portfolio/project-model/scene-planning';
import {
	SCENE_UNIT_FORMAT_VERSION,
	computeUnitContentRevision,
	prepareUnitRuntime,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { admitSourceJson } from '$lib/authoring/stage/source-admission';
import {
	createUnitCoordinator,
	createUnitProject,
	unitRevision
} from '../authoring/__fixtures__/unit-envelope-fixtures';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';

const COLOUR = `sha256-${'1'.repeat(64)}`;
const ORM = `sha256-${'2'.repeat(64)}`;
const NORMAL = `sha256-${'3'.repeat(64)}`;
const TEXTURES = [
	{ id: '11111111-1111-4111-8111-111111111111', name: 'Brushed colour', hash: COLOUR, size: 101 },
	{ id: '22222222-2222-4222-8222-222222222222', name: 'Brushed ORM', hash: ORM, size: 202 },
	{ id: '33333333-3333-4333-8333-333333333333', name: 'Brushed normal DX', hash: NORMAL, size: 303 }
];

function wallLayout(): LayoutDocumentWallFirst {
	const layout = createEmptyWallFirstLayoutDocument();
	layout.junctions = [
		{ id: 'wall-a:start', point: [0, 0] },
		{ id: 'wall-a:end', point: [4, 0] }
	];
	layout.walls = [
		{
			id: 'wall-a',
			startJunctionId: 'wall-a:start',
			endJunctionId: 'wall-a:end',
			height: 2.8,
			thickness: 0.2,
			centerline: { kind: 'line' }
		}
	];
	return layout;
}

function box(): SceneEntity {
	return {
		kind: 'primitive',
		id: 'plinth',
		name: 'Plinth',
		position: [0, 0, 0],
		rotation: [0, 0, 0],
		primitive: 'box',
		dimensions: { width: 1, height: 1, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true
	} as SceneEntity;
}

function surfaceTarget(
	project: Awaited<ReturnType<typeof createUnitProject>>,
	surface: Extract<LayoutSurfaceRef, { kind: 'wall-side' }>
): SemanticReference {
	const layout = project.units.layout.data;
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: project.units.layout.header.contentRevision },
		subject: { kind: 'wall', id: surface.wallId },
		instancePath: [],
		location: { kind: 'layout-location', levelId: layout.floor.id, structureInstancePath: [] },
		componentId: `side:${surface.side}`,
		capabilityId: null
	};
}

function entityTarget(project: Awaited<ReturnType<typeof createUnitProject>>, id: string): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: project.units.scene.header.contentRevision },
		subject: { kind: 'entity', id },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function payloadFor(recipe: Recipe, recipeHash: string, sceneRevision: string) {
	return {
		name: 'Brushed metal',
		recipeHash,
		recipe,
		images: TEXTURES.map((texture) => ({
			hash: texture.hash,
			source: { textureId: texture.id },
			texture: { name: texture.name, pin: { hash: texture.hash, mime: 'image/png', size: texture.size } }
		})),
		entityIds: ['plinth'],
		targetFacts: [
			{
				subject: 'plinth',
				geometryRevision: sceneRevision,
				metricBasis: { uvMeters: [1, 1], surfaceMeters: [1, 1] },
				draws: [{ drawKey: 'plinth', uvSets: [0], normalFrameSets: [0] }]
			}
		]
	};
}

async function brushedRecipe() {
	const read = readRecipe({
		profile: 'pbr-metallic-roughness/v1',
		color: '#b8bcc0',
		roughness: 0.32,
		metalness: 1,
		occlusionStrength: 1,
		normalScale: 1,
		mapping: { kind: 'target', metric: { tileMeters: [1, 1], rotation: 0, offset: [0, 0] } },
		maps: {
			color: { image: COLOUR },
			roughness: { image: ORM, component: 'g', invert: false },
			metalness: { image: ORM, component: 'b', invert: false },
			normal: { image: NORMAL, convention: '-Y' }
		}
	});
	if (!read.success) throw new Error(JSON.stringify(read.issues));
	return read.recipe;
}

async function fixture() {
	const recipe = await brushedRecipe();
	const hash = await recipeHash(recipe);
	const proofResult = await buildMaterialDigestProof([{ hash, recipe }]);
	if (!proofResult.success) throw new Error('proof');
	const proof: MaterialDigestProof = proofResult.proof;
	const project = await createUnitProject({
		id: 'project-d',
		name: 'D slice',
		layout: wallLayout(),
		scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: [],
			materials: [],
			entities: [box()]
		}
	});
	const planners = createFinishPlanners({
		labelForMaterial: (id) => id,
		materialProof: () => proof
	});
	const coordinator = await createUnitCoordinator({ baseline: project, planners });
	const registration = await coordinator.accept({
		version: 1,
		kind: SCENE_FINISH_REGISTER,
		operationId: 'register-brushed',
		expectedRevision: coordinator.acceptedRevision(),
		targets: [entityTarget(coordinator.current().source, 'plinth')],
		payload: payloadFor(recipe, hash, coordinator.current().source.units.scene.header.contentRevision),
		capturedInputs: [],
		allocatedIds: [{ kind: 'scene-finish', id: 'finish-brushed' }]
	} as AuthoringIntent);
	return { recipe, hash, registration, coordinator, surface: { kind: 'wall-side' as const, wallId: 'wall-a', side: 'left' as const } };
}

describe('T2.S8 PR D exit fixture', () => {
	it('registers three images on a primitive, paints the Wall, and undoes both units atomically', async () => {
		const { registration, coordinator, surface } = await fixture();
		expect(registration.kind).toBe('accepted');
		const registered = coordinator.current().source;
		expect(registered.units.scene.data.materials).toEqual([
			{ id: 'finish-brushed', name: 'Brushed metal', base: { material: expect.stringMatching(/^sha256-/) } }
		]);
		expect(registered.units.resources.data.resources).toHaveLength(4);
		expect(registered.dependencyLock.entries).toContainEqual(
			expect.objectContaining({
				domain: 'resource:material',
				requiredCapabilities: [{ id: 'pbr-metallic-roughness', version: '1' }]
			})
		);
		const afterRegistration = serializeProjectEnvelope(registered);

		const paint = await coordinator.accept({
			version: 1,
			kind: SCENE_SURFACE_FINISH_ASSIGN,
			operationId: 'paint-wall',
			expectedRevision: coordinator.acceptedRevision(),
			targets: [surfaceTarget(registered, surface)],
			payload: { finish: { project: 'finish-brushed' }, surfaces: [surface] },
			capturedInputs: [],
			allocatedIds: []
		} as AuthoringIntent);
		expect(paint.kind).toBe('accepted');
		const painted = coordinator.current().source;
		expect(painted.units.scene.data.surfaceFinishes).toEqual([
			{ surface, finish: { materialInstanceId: 'finish-brushed' } }
		]);
		const afterPaint = serializeProjectEnvelope(painted);

		expect((await coordinator.undo()).kind).toBe('restored');
		expect(serializeProjectEnvelope(coordinator.current().source)).toBe(afterRegistration);
		expect((await coordinator.undo()).kind).toBe('restored');
		expect(coordinator.current().source.units.scene.data.materials).toEqual([]);
		expect((await coordinator.redo()).kind).toBe('restored');
		expect(serializeProjectEnvelope(coordinator.current().source)).toBe(afterRegistration);
		expect((await coordinator.redo()).kind).toBe('restored');
		expect(serializeProjectEnvelope(coordinator.current().source)).toBe(afterPaint);
	});

	it('creates an unassigned Finish and reuses one vendored definition without new records', async () => {
		const { coordinator, recipe, hash } = await fixture();
		const source = coordinator.current().source;
		const resources = source.units.resources.data.resources;
		const locks = source.dependencyLock.entries;
		const unassigned = await coordinator.accept({
			version: 1,
			kind: SCENE_FINISH_REGISTER,
			operationId: 'register-shelf',
			expectedRevision: coordinator.acceptedRevision(),
			targets: [],
			payload: {
				...payloadFor(recipe, hash, source.units.scene.header.contentRevision),
				name: 'Brushed metal shelf',
				images: TEXTURES.map((texture) => ({
					hash: texture.hash,
					source: { textureId: texture.id.replace(/^./, 'a') },
					texture: { name: texture.name, pin: { hash: texture.hash, mime: 'image/png', size: texture.size } }
				})),
				entityIds: [],
				targetFacts: []
			},
			capturedInputs: [],
			allocatedIds: [{ kind: 'scene-finish', id: 'finish-shelf' }]
		} as AuthoringIntent);
		expect(unassigned.kind).toBe('accepted');
		const next = coordinator.current().source;
		expect(next.units.scene.data.materials.map((material) => material.id)).toEqual(['finish-brushed', 'finish-shelf']);
		expect(next.units.scene.data.textures).toEqual(source.units.scene.data.textures);
		expect(next.units.scene.data.entities).toEqual(source.units.scene.data.entities);
		expect(next.units.resources.data.resources).toEqual(resources);
		expect(next.dependencyLock.entries).toEqual(locks);
	});

	it('loads the saved source cold and composes a release with exact image pins', async () => {
		const { coordinator } = await fixture();
		const source = serializeProjectEnvelope(coordinator.current().source);
		const admitted = await admitSourceJson(source, {
			sessionEpoch: 'cold',
			acceptedRevision: unitRevision('project-d', 'cold-revision')
		});
		expect(admitted.kind).toBe('admitted');
		if (admitted.kind !== 'admitted') return;

		const bytesByUri = new Map(
			TEXTURES.map((texture) => [
				`/project-assets/${texture.id}`,
				{
					bytes: new Uint8Array(texture.size),
					mime: 'image/png',
					sha256: texture.hash
				}
			])
		);
		const bundle = composeColdReleaseBundle({
			document: coordinator.current().source,
			manifest: { releaseId: 'release-d', bytesByUri }
		});
		expect(bundle.scene.materials.map((finish) => finish.id)).toEqual(['finish-brushed']);
		expect(bundle.scene.materialIndex?.definitions.size).toBe(1);
		bundle.dispose();
	});

	it('refuses a false hash, a stale target, and a foreign image without a candidate', async () => {
		const { registration, coordinator, surface } = await fixture();
		expect(registration.kind).toBe('accepted');
		const source = coordinator.current().source;
		const finish = source.units.scene.data.materials[0]!;

		const falseHash = await coordinator.accept({
			version: 1,
			kind: SCENE_FINISH_REGISTER,
			operationId: 'false-hash',
			expectedRevision: coordinator.acceptedRevision(),
			targets: [entityTarget(source, 'plinth')],
			payload: {
				...payloadFor((await brushedRecipe()), `sha256-${'9'.repeat(64)}`, source.units.scene.header.contentRevision),
				name: 'False'
			},
			capturedInputs: [],
			allocatedIds: [{ kind: 'scene-finish', id: 'finish-false' }]
		} as AuthoringIntent);
		expect(falseHash.kind).toBe('rejected');

		const stale = await coordinator.accept({
			version: 1,
			kind: SCENE_SURFACE_FINISH_ASSIGN,
			operationId: 'stale-surface',
			expectedRevision: coordinator.acceptedRevision(),
			targets: [{
				...surfaceTarget(source, surface),
				revision: { kind: 'exact', contentRevision: 'stale-layout-revision' }
			}],
			payload: { finish: { project: finish.id }, surfaces: [surface] },
			capturedInputs: [],
			allocatedIds: []
		} as AuthoringIntent);
		expect(stale.kind).toBe('rejected');

		const foreign = await coordinator.accept({
			version: 1,
			kind: SCENE_FINISH_REGISTER,
			operationId: 'foreign-image',
			expectedRevision: coordinator.acceptedRevision(),
			targets: [entityTarget(source, 'plinth')],
			payload: {
				...payloadFor(
					await brushedRecipe(),
					await recipeHash(await brushedRecipe()),
					source.units.scene.header.contentRevision
				),
				name: 'Foreign',
				images: [
					{
						hash: COLOUR,
						source: { textureId: '99999999-9999-4999-8999-999999999999' },
						texture: { name: 'Missing', pin: { hash: COLOUR, mime: 'image/png', size: 1 } }
					}
				]
			},
			capturedInputs: [],
			allocatedIds: [{ kind: 'scene-finish', id: 'finish-foreign' }]
		} as AuthoringIntent);
		expect(foreign.kind).toBe('rejected');
		expect(coordinator.current().source).toEqual(source);
	});

	it('refuses a false recipe hash under valid headers, a missing lock and an unsupported capability', async () => {
		const { coordinator } = await fixture();
		const source = coordinator.current().source;
		const tampered = structuredClone(source) as ProjectEnvelope;
		const material = tampered.units.resources.data.resources.find((resource) => resource.kind === 'material')!;
		(material.material!.recipe as { color: string }).color = '#010101';
		tampered.units.resources.header.contentRevision = await computeUnitContentRevision(
			tampered.units.resources.data
		);
		const falseHash = await admitSourceJson(serializeProjectEnvelope(tampered), {
			sessionEpoch: 'adversarial',
			acceptedRevision: unitRevision('project-d', 'adversarial')
		});
		expect(falseHash.kind).toBe('refused');
		if (falseHash.kind === 'refused') expect(falseHash.issues[0]?.code).toBe('invalid-hash');

		const missingLock = structuredClone(source) as ProjectEnvelope;
		missingLock.dependencyLock.entries = missingLock.dependencyLock.entries.filter(
			(entry) => entry.domain !== 'resource:material'
		);
		const missing = prepareUnitRuntime(missingLock);
		expect(missing.kind).toBe('ready');
		if (missing.kind === 'ready') expect(missing.closure.map((issue) => issue.code)).toContain('missing-lock');

		const unsupported = structuredClone(source) as ProjectEnvelope;
		const lock = unsupported.dependencyLock.entries.find((entry) => entry.domain === 'resource:material')!;
		(lock as { requiredCapabilities: unknown }).requiredCapabilities = [{ id: 'pbr-clearcoat', version: '9' }];
		const capability = prepareUnitRuntime(unsupported);
		expect(capability.kind).toBe('ready');
		if (capability.kind === 'ready') {
			expect(capability.closure.map((issue) => issue.code)).toContain('unsupported-capability');
		}
		expect(coordinator.current().source).toEqual(source);
	});
});
