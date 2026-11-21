/**
 * T2.S8 D follow-up — production target analysis.
 *
 * These contracts mount the production Layout and Scene adapters on an admitted
 * project through `createStageAdapterServices`, so the Finish planner reads the
 * same host analysis the route passes: compiled Layout surfaces for a Wall, the
 * evaluated Form buffer, and the exact approved GLB derivative. No test builds
 * a `TargetFacts` object by hand for the acceptance path.
 *
 * They also prove the strict edges: a derivative from another pin is not an
 * answer, UV1 the GLB does not carry refuses instead of being assumed, and a
 * stale Layout revision has no analysis at all.
 */
import { describe, expect, it } from 'vitest';
import {
	createEmptyWallFirstLayoutDocument,
	surfaceKey,
	type LayoutDocumentWallFirst,
	type LayoutSurfaceRef
} from '@portfolio/layout-core';
import type { AuthoringIntent, SceneEntity, SemanticReference } from '@portfolio/project-model';
import {
	readRecipe,
	recipeHash,
	type Mapping,
	type Recipe
} from '@portfolio/project-model/materials';
import { SCENE_FINISH_REGISTER } from '@portfolio/project-model/scene-planning';
import {
	MODEL_RESOURCE_MIME,
	RESOURCE_UNIT_FORMAT_VERSION,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

import { createAdapter as createLayoutAdapter } from '$lib/authoring/adapters/layout.adapter';
import { createAdapter as createSceneAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createMaterialProofRegistry } from '$lib/authoring/material-proof';
import { createStageAcceptanceHost } from '$lib/authoring/stage/host-acceptance';
import {
	createStageAdapterServices,
	mountStageAdapter,
	type StageAdapterServices
} from '$lib/authoring/stage/stage-adapter-host';
import { createStageFacade } from '$lib/authoring/stage/stage-facade';
import { createStageSession } from '$lib/authoring/stage/stage-session';
import { admitSourceJson } from '$lib/authoring/stage/source-admission';
import type { ModelDerivativeAnalysis } from '$lib/render/materials/target-analysis';
import { createUnitProject, unitRevision } from '../authoring/__fixtures__/unit-envelope-fixtures';

const PROJECT_ID = 'project-d-production-targets';
const COLOUR = `sha256-${'1'.repeat(64)}`;
const ORM = `sha256-${'2'.repeat(64)}`;
const NORMAL = `sha256-${'3'.repeat(64)}`;
const OLD_MODEL = `sha256-${'d'.repeat(64)}`;
const NEW_MODEL = `sha256-${'a'.repeat(64)}`;
const TEXTURES = [
	{ id: '11111111-1111-4111-8111-111111111111', name: 'Brushed colour', hash: COLOUR, size: 101 },
	{ id: '22222222-2222-4222-8222-222222222222', name: 'Brushed ORM', hash: ORM, size: 202 },
	{ id: '33333333-3333-4333-8333-333333333333', name: 'Brushed normal DX', hash: NORMAL, size: 303 }
];

const WALL: Extract<LayoutSurfaceRef, { kind: 'wall-side' }> = {
	kind: 'wall-side',
	wallId: 'wall-a',
	side: 'left'
};

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

function modelExtras(digest: string): {
	resources: ProjectEnvelope['units']['resources']['data'];
	dependencyLock: ProjectEnvelope['dependencyLock'];
} {
	const pin = {
		hash: digest,
		mime: MODEL_RESOURCE_MIME,
		size: 1024,
		locator: `/projects/${PROJECT_ID}/models/content/${digest}`
	};
	return {
		resources: {
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [
				{
					kind: 'model',
					id: 'creator-shelf',
					contentRevision: digest,
					pin,
					unresolved: null,
					model: {
						source: { manifestHash: `sha256-${'e'.repeat(64)}`, size: 2048, fileCount: 2 },
						recipe: { id: 'creator-import', version: 1 },
						reportDigest: `sha256-${'f'.repeat(64)}`,
						placement: {
							metresPerSourceUnit: 0.5,
							pivot: [0, 0, 0],
							footprint: { width: 1.2, depth: 0.8 },
							contactMinY: 0,
							placement: 'floor'
						}
					}
				}
			]
		},
		dependencyLock: {
			formatVersion: 1,
			entries: [
				{
					domain: 'resource:model',
					subjectKind: 'resource',
					subjectId: 'creator-shelf',
					instancePath: [],
					contentRevision: digest,
					requiredCapabilities: [],
					pin
				}
			]
		}
	};
}

/** One approved derivative's draws, exactly what the headless analyzer returns. */
function derivative(digest: string, drawKey: string, withUv1: boolean): ModelDerivativeAnalysis {
	return {
		digest,
		draws: [
			{
				drawKey,
				geometry: {
					positions: [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
					indices: [0, 1, 2, 0, 2, 3],
					uvs: [
						[0, 0, 1, 0, 1, 1, 0, 1],
						withUv1 ? [0, 0, 1, 0, 1, 1, 0, 1] : null
					]
				}
			}
		]
	};
}

async function recipeFor(mapping: Mapping, roles: readonly ('color' | 'normal' | 'roughness' | 'metalness')[] = ['color', 'normal', 'roughness', 'metalness']): Promise<Recipe> {
	const read = readRecipe({
		profile: 'pbr-metallic-roughness/v1',
		color: '#b8bcc0',
		roughness: 0.32,
		metalness: 1,
		occlusionStrength: 1,
		normalScale: 1,
		mapping,
		maps: {
			...(roles.includes('color') ? { color: { image: COLOUR } } : {}),
			...(roles.includes('roughness') ? { roughness: { image: ORM, component: 'g' as const, invert: false } } : {}),
			...(roles.includes('metalness') ? { metalness: { image: ORM, component: 'b' as const, invert: false } } : {}),
			...(roles.includes('normal') ? { normal: { image: NORMAL, convention: '-Y' as const } } : {})
		}
	});
	if (!read.success) throw new Error(JSON.stringify(read.issues));
	return read.recipe;
}

function entityTarget(source: ProjectEnvelope, id: string): SemanticReference {
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

function surfaceTarget(source: ProjectEnvelope, surface: LayoutSurfaceRef): SemanticReference {
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: source.units.layout.header.contentRevision },
		subject: { kind: 'wall', id: WALL.wallId },
		instancePath: [],
		location: {
			kind: 'layout-location',
			levelId: source.units.layout.data.floor.id,
			structureInstancePath: []
		},
		componentId: `side:${surface.kind === 'wall-side' ? surface.side : 'left'}`,
		capabilityId: null
	};
}

function payloadFor(
	recipe: Recipe,
	hash: string,
	sceneRevision: string,
	entityIds: readonly string[],
	surfaces: readonly LayoutSurfaceRef[]
): Record<string, unknown> {
	const named = new Set(Object.values(recipe.maps).map((binding) => binding.image));
	return {
		name: 'Brushed metal',
		recipeHash: hash,
		recipe,
		images: TEXTURES.filter((texture) => named.has(texture.hash)).map((texture) => ({
			hash: texture.hash,
			source: { textureId: texture.id },
			texture: {
				name: texture.name,
				pin: { hash: texture.hash, mime: 'image/png', size: texture.size }
			}
		})),
		entityIds: [...entityIds],
		...(surfaces.length === 0 ? {} : { surfaces: [...surfaces] }),
		targetFacts: []
	};
}

async function mountProduction(modelDigest: string, provider: Map<string, ModelDerivativeAnalysis>) {
	const extras = modelExtras(modelDigest);
	const project = await createUnitProject({
		id: PROJECT_ID,
		name: 'Production targets',
		layout: wallLayout(),
		scene: {
			formatVersion: 1,
			textures: [],
			materials: [],
			entities: [form(), glb()],
			navigationNodes: [],
			connections: []
		},
		resources: extras.resources,
		dependencyLock: extras.dependencyLock
	});
	const admitted = await admitSourceJson(serializeProjectEnvelope(project), {
		sessionEpoch: 'session-production-targets',
		acceptedRevision: unitRevision(PROJECT_ID, 'production-1')
	});
	if (admitted.kind !== 'admitted') {
		throw new Error(`production fixture did not admit: ${JSON.stringify(admitted)}`);
	}
	const snapshot = admitted.snapshot;
	const session = createStageSession({ sessionEpoch: snapshot.sessionEpoch });
	session.replace(snapshot);
	const facade = createStageFacade({ snapshot, session });
	facade.acquireInspection('exclusive');
	const materialProofs = createMaterialProofRegistry();
	const host = createStageAcceptanceHost({
		facade,
		sessionEpoch: snapshot.sessionEpoch,
		baseline: {
			revision: snapshot.acceptedRevision,
			source: project,
			canonicalJson: snapshot.canonicalJson,
			sourceContentId: snapshot.sourceContentId
		},
		planners: []
	});
	// The production composition, not a hand-built services object: the analysis
	// reads the facade's accepted Scene and compiled Layout, and the approved
	// model provider is the only model source.
	const services: StageAdapterServices = createStageAdapterServices(
		facade,
		host,
		undefined,
		materialProofs,
		{ models: (digest) => provider.get(digest) ?? null }
	);
	if (mountStageAdapter(facade, host, createLayoutAdapter, undefined, services).kind !== 'registered') {
		throw new Error('the production Layout adapter did not register');
	}
	if (mountStageAdapter(facade, host, createSceneAdapter, undefined, services).kind !== 'registered') {
		throw new Error('the production Scene adapter did not register');
	}
	return { project, snapshot, facade, host, services, materialProofs };
}

async function register(
	mounted: Awaited<ReturnType<typeof mountProduction>>,
	recipe: Recipe,
	entityIds: readonly string[],
	surfaces: readonly LayoutSurfaceRef[],
	finishId: string
) {
	const hash = await recipeHash(recipe);
	const prepared = await mounted.materialProofs.prepareFinishRegistration(recipe);
	if (!prepared.ok) throw new Error(`recipe proof failed: ${JSON.stringify(prepared.issues)}`);
	const coordinator = mounted.host.coordinator();
	const source = coordinator.current().source;
	return coordinator.accept({
		version: 1,
		kind: SCENE_FINISH_REGISTER,
		operationId: `register-${finishId}`,
		expectedRevision: coordinator.acceptedRevision(),
		targets: [
			...entityIds.map((id) => entityTarget(source, id)),
			...surfaces.map((surface) => surfaceTarget(source, surface))
		],
		payload: payloadFor(
			recipe,
			hash,
			source.units.scene.header.contentRevision,
			entityIds,
			surfaces
		),
		capturedInputs: [],
		allocatedIds: [{ kind: 'scene-finish', id: finishId }]
	} as AuthoringIntent);
}

describe('T2.S8 D production target analysis', () => {
	it('registers one Finish on a Wall, a Form and an approved GLB through the production adapters', async () => {
		const mounted = await mountProduction(OLD_MODEL, new Map([
			[OLD_MODEL, derivative(OLD_MODEL, 'shelf-mesh#0', false)]
		]));
		const recipe = await recipeFor({
			kind: 'target',
			metric: { tileMeters: [1, 1], rotation: 0, offset: [0, 0] }
		});
		const entities = await register(mounted, recipe, ['pedestal', 'shelf'], [], 'finish-form-glb');
		expect(entities.kind).toBe('accepted');
		const wall = await register(mounted, recipe, [], [WALL], 'finish-wall');
		expect(wall.kind).toBe('accepted');
		if (entities.kind !== 'accepted' || wall.kind !== 'accepted') return;
		const source = mounted.host.coordinator().current().source;
		const assigned = source.units.scene.data.entities.map((entity) => ({
			id: entity.id,
			finish: (entity as SceneEntity & { materialInstanceId?: string }).materialInstanceId
		}));
		expect(assigned).toEqual([
			{ id: 'pedestal', finish: 'finish-form-glb' },
			{ id: 'shelf', finish: 'finish-form-glb' }
		]);
		expect(source.units.scene.data.surfaceFinishes).toEqual([
			{ surface: WALL, finish: { materialInstanceId: 'finish-wall' } }
		]);
	});

	it('refuses UV1 on a GLB that only carries UV0', async () => {
		const mounted = await mountProduction(OLD_MODEL, new Map([
			[OLD_MODEL, derivative(OLD_MODEL, 'shelf-mesh#0', false)]
		]));
		const outcome = await register(
			mounted,
			await recipeFor(
				{ kind: 'uv', set: 1, repeat: [1, 1], rotation: 0, offset: [0, 0] },
				['color']
			),
			['shelf'],
			[],
			'finish-uv1'
		);
		expect(outcome.kind).toBe('rejected');
		if (outcome.kind === 'rejected') {
			expect(outcome.reason).toBe('missing-uv');
			expect(mounted.host.coordinator().current().source.units.scene.data.materials).toEqual([]);
		}
	});

	it('binds model analysis to the exact approved derivative identity', async () => {
		const oldOnly = new Map([[OLD_MODEL, derivative(OLD_MODEL, 'old-mesh#0', false)]]);
		const first = await mountProduction(OLD_MODEL, oldOnly);
		const oldFacts = first.services.targetAnalysis([
			{
				subject: 'shelf',
				domain: 'scene',
				entityId: 'shelf',
				expectedGeometryRevision: first.snapshot.domain.unitRevisions.scene
			}
		]);
		expect(oldFacts?.[0]?.draws.map((draw) => draw.drawKey)).toEqual(['old-mesh#0']);
		expect(oldFacts?.[0]?.draws[0]?.uvSets).toEqual([0]);

		// The same Scene now names a different approved pin. An analysis of the
		// old bytes cannot answer for it.
		const changed = await mountProduction(NEW_MODEL, oldOnly);
		expect(
			changed.services.targetAnalysis([
				{
					subject: 'shelf',
					domain: 'scene',
					entityId: 'shelf',
					expectedGeometryRevision: changed.snapshot.domain.unitRevisions.scene
				}
			])
		).toBeNull();

		// The new pin's own analysis is what answers, with its own draws.
		const refreshed = await mountProduction(
			NEW_MODEL,
			new Map([[NEW_MODEL, derivative(NEW_MODEL, 'new-mesh#0', true)]])
		);
		const newFacts = refreshed.services.targetAnalysis([
			{
				subject: 'shelf',
				domain: 'scene',
				entityId: 'shelf',
				expectedGeometryRevision: refreshed.snapshot.domain.unitRevisions.scene
			}
		]);
		expect(newFacts?.[0]?.draws.map((draw) => draw.drawKey)).toEqual(['new-mesh#0']);
		expect(newFacts?.[0]?.draws[0]?.uvSets).toEqual([0, 1]);
	});

	it('analyses the compiled Wall only at its exact Layout revision', async () => {
		const mounted = await mountProduction(OLD_MODEL, new Map());
		const subject = surfaceKey(WALL);
		const current = mounted.snapshot.domain.unitRevisions.layout;
		const facts = mounted.services.targetAnalysis([
			{
				subject,
				domain: 'layout',
				surface: WALL,
				expectedGeometryRevision: current
			}
		]);
		expect(facts).toHaveLength(1);
		expect(facts?.[0]?.geometryRevision).toBe(current);
		expect(facts?.[0]?.draws[0]?.uvSets).toContain(0);
		expect(
			mounted.services.targetAnalysis([
				{
					subject,
					domain: 'layout',
					surface: WALL,
					expectedGeometryRevision: 'stale-layout-revision'
				}
			])
		).toBeNull();
	});
});
