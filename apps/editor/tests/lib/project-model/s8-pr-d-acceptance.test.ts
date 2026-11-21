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
	readRecipe,
	recipeHash,
	type Recipe
} from '@portfolio/project-model/materials';
import {
	SCENE_FINISH_REGISTER,
	SCENE_SURFACE_FINISH_ASSIGN
} from '@portfolio/project-model/scene-planning';
import {
	MODEL_RESOURCE_MIME,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	computeUnitContentRevision,
	prepareUnitRuntime,
	serializeProjectEnvelope,
	validateProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { admitSourceJson } from '$lib/authoring/stage/source-admission';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createMaterialProofRegistry } from '$lib/authoring/material-proof';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
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

function form(): SceneEntity {
	return {
		kind: 'form',
		id: 'pedestal',
		name: 'Pedestal',
		position: [2, 0, 0],
		rotation: [0, 0, 0],
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				extent: 1,
				outline: [
					{ key: 1, u: -0.5, v: 0, smooth: false },
					{ key: 2, u: 0.5, v: 0, smooth: false },
					{ key: 3, u: 0.5, v: 1, smooth: false },
					{ key: 4, u: -0.5, v: 1, smooth: false }
				]
			},
			scale: [1, 1, 1],
			nextKey: 5
		}
	} as SceneEntity;
}

function glb(): SceneEntity {
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

function payloadFor(
	recipe: Recipe,
	recipeHash: string,
	sceneRevision: string,
	entityIds: readonly string[] = ['plinth']
) {
	return {
		name: 'Brushed metal',
		recipeHash,
		recipe,
		images: TEXTURES.map((texture) => ({
			hash: texture.hash,
			source: { textureId: texture.id },
			texture: { name: texture.name, pin: { hash: texture.hash, mime: 'image/png', size: texture.size } }
		})),
		entityIds: [...entityIds],
		targetFacts: entityIds.map((id) => ({
			subject: id,
			geometryRevision: sceneRevision,
			metricBasis: { uvMeters: [1, 1] as const, surfaceMeters: [1, 1] as const },
			draws: [{ drawKey: id, uvSets: [0] as const, normalFrameSets: [0] as const }]
		}))
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

async function fixture(
	entities: readonly SceneEntity[] = [box()],
	entityIds: readonly string[] = ['plinth'],
	recipeOverride?: Recipe,
	extras?: {
		resources?: ProjectEnvelope['units']['resources']['data'];
		dependencyLock?: ProjectEnvelope['dependencyLock'];
	}
) {
	const recipe = recipeOverride ?? (await brushedRecipe());
	const hash = await recipeHash(recipe);
	const project = await createUnitProject({
		id: 'project-d',
		name: 'D slice',
		layout: wallLayout(),
		scene: {
			formatVersion: SCENE_UNIT_FORMAT_VERSION,
			textures: [],
			materials: [],
			entities: [...entities]
		},
		...(extras?.resources === undefined ? {} : { resources: extras.resources }),
		...(extras?.dependencyLock === undefined ? {} : { dependencyLock: extras.dependencyLock })
	});
	// A new draft is prepared through the session registry, exactly as the Stage
	// route does; source admission and this preparation are the only proof writers.
	const materialProofs = createMaterialProofRegistry();
	const admitted = await admitSourceJson(serializeProjectEnvelope(project), {
		sessionEpoch: 'fixture',
		acceptedRevision: unitRevision('project-d', 'fixture-revision'),
		materialProofs
	});
	if (admitted.kind !== 'admitted') throw new Error(`fixture source did not admit: ${JSON.stringify(admitted)}`);
	const admittedSource = stageEnvelope(admitted.snapshot);
	const prepared = await materialProofs.prepareFinishRegistration(recipe);
	if (!prepared.ok) throw new Error('fixture recipe did not prepare');
	const planners: unknown[] = [];
	createAdapter({
		materialProofs,
		authoring: {
			registerPlanner: (planner: unknown) => {
				planners.push(planner);
				return { kind: 'registered' };
			}
		}
	} as never);
	const coordinator = await createUnitCoordinator({
		baseline: {
			revision: admitted.snapshot.acceptedRevision,
			source: admittedSource,
			canonicalJson: admitted.snapshot.canonicalJson,
			sourceContentId: admitted.snapshot.sourceContentId
		},
		planners: planners as never
	});
	const registration = await coordinator.accept({
		version: 1,
		kind: SCENE_FINISH_REGISTER,
		operationId: 'register-brushed',
		expectedRevision: coordinator.acceptedRevision(),
		targets: entityIds.map((id) => entityTarget(coordinator.current().source, id)),
		payload: payloadFor(recipe, hash, coordinator.current().source.units.scene.header.contentRevision, entityIds),
		capturedInputs: [],
		allocatedIds: [{ kind: 'scene-finish', id: 'finish-brushed' }]
	} as AuthoringIntent);
	return { recipe, hash, registration, coordinator, materialProofs, surface: { kind: 'wall-side' as const, wallId: 'wall-a', side: 'left' as const } };
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

	it('assigns one resource-backed rotated Finish to a Form and a GLB through the D writer', async () => {
		const rotated: Recipe = {
			...(await brushedRecipe()),
			mapping: { kind: 'target', metric: { tileMeters: [0.45, 1.8], rotation: 0.7, offset: [0.12, 0.34] } }
		};
		const modelHash = `sha256-${'d'.repeat(64)}`;
		const modelPin = {
			hash: modelHash, mime: MODEL_RESOURCE_MIME, size: 1024,
			locator: `/projects/project-d/models/content/${modelHash}`
		};
		const { registration, coordinator } = await fixture(
			[box(), form(), glb()],
			['plinth', 'pedestal', 'shelf'],
			rotated,
			{
				resources: {
					formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
					resources: [{
						kind: 'model', id: 'creator-shelf', contentRevision: modelHash, pin: modelPin, unresolved: null,
						model: {
							source: { manifestHash: `sha256-${'e'.repeat(64)}`, size: 2048, fileCount: 2 },
							recipe: { id: 'creator-import', version: 1 },
							reportDigest: `sha256-${'f'.repeat(64)}`,
							placement: {
								metresPerSourceUnit: 0.5, pivot: [0, 0, 0],
								footprint: { width: 1.2, depth: 0.8 }, contactMinY: 0, placement: 'floor'
							}
						}
					}]
				},
				dependencyLock: {
					formatVersion: 1,
					entries: [{
						domain: 'resource:model', subjectKind: 'resource', subjectId: 'creator-shelf',
						instancePath: [], contentRevision: modelHash, requiredCapabilities: [], pin: modelPin
					}]
				}
			}
		);
		if (registration.kind !== 'accepted') throw new Error(JSON.stringify(registration));
		const source = coordinator.current().source;
		const assignments = source.units.scene.data.entities.map((entity) => ({
			id: entity.id,
			finish: (entity as SceneEntity & { materialInstanceId?: string }).materialInstanceId
		}));
		expect(assignments).toEqual([
			{ id: 'plinth', finish: 'finish-brushed' },
			{ id: 'pedestal', finish: 'finish-brushed' },
			{ id: 'shelf', finish: 'finish-brushed' }
		]);
		const definition = source.units.resources.data.resources.find((resource) => resource.kind === 'material');
		expect(definition?.kind).toBe('material');
		if (definition?.kind === 'material' && definition.material !== undefined) {
			expect(definition.material.recipe.mapping).toEqual(rotated.mapping);
			expect(definition.material.images).toHaveLength(3);
		}
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
			document: stageEnvelope(admitted.snapshot),
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

		const staleGeometry = await coordinator.accept({
			version: 1,
			kind: SCENE_FINISH_REGISTER,
			operationId: 'stale-register-geometry',
			expectedRevision: coordinator.acceptedRevision(),
			targets: [entityTarget(source, 'plinth')],
			payload: {
				...payloadFor((await brushedRecipe()), await recipeHash(await brushedRecipe()), source.units.scene.header.contentRevision),
				name: 'Stale geometry',
				targetFacts: [{
					subject: 'plinth',
					geometryRevision: 'stale-geometry-revision',
					metricBasis: { uvMeters: [1, 1], surfaceMeters: [1, 1] },
					draws: [{ drawKey: 'plinth', uvSets: [0], normalFrameSets: [0] }]
				}]
			},
			capturedInputs: [],
			allocatedIds: [{ kind: 'scene-finish', id: 'finish-stale-geometry' }]
		} as AuthoringIntent);
		expect(staleGeometry.kind).toBe('rejected');

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

		const badStatic = structuredClone(source) as ProjectEnvelope;
		(badStatic.units.scene.data.materials[0] as unknown as { overrides: unknown }).overrides = {
			maps: { color: { image: { shipped: '/evil/anything.png' } } }
		};
		badStatic.units.scene.header.contentRevision = await computeUnitContentRevision(
			badStatic.units.scene.data
		);
		const staticResult = validateProjectEnvelope(badStatic);
		expect(staticResult.success).toBe(true);
		if (staticResult.success) {
			expect(staticResult.closure).toContainEqual(
				expect.objectContaining({ code: 'unknown-static-image' })
			);
		}
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
