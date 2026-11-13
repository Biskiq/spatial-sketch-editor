/**
 * E0/C0 synthetic **Scene counting fixture**.
 *
 * This is a counting fixture, not a certified workload (T1/T2 consolidation,
 * slice C0). Its content distribution is fixed so later slices (G2, G3, R2b,
 * R3, R4, R5) read the same work counts:
 *
 * - Layout: the canonical `grid-M` generator (grid-7, 112 Walls, 49 Rooms) with
 *   one Opening per Wall of at least 3 m, built only through public planners.
 * - Per Room: three primitives (two sharing one resolved look), one native Form,
 *   and one textured primitive — five entities per Room.
 * - Plus 20 artworks across 4 distinct sizes and 12 instances of one model.
 *
 * The Scene is authored data only: no generated geometry, no renderer resource
 * and no counting behaviour lives here. Every id is deterministic so a count can
 * cite the same fixture twice.
 */
import {
	compileWallFirstLayoutGeometry,
	evaluateLayoutPlan,
	type CompiledLayoutGeometry,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type PlanEvaluation
} from '@portfolio/layout-core';
import type {
	CameraFreeSceneDocument,
	ProjectEnvelope
} from '@portfolio/project-model/units';
import type {
	SceneArtworkEntity,
	SceneEntity,
	SceneFormEntity,
	SceneMaterialInstance,
	SceneModelEntity,
	ScenePrimitiveEntity,
	SceneTextureAsset
} from '@portfolio/project-model';

import { addOpenings, buildGrid, CELL_METERS, sequentialCaptures } from '../../../../perf/lib/workloads/grid';
import {
	buildPlanSceneFootprintProjection,
	type PlanSceneProjection
} from '$lib/authoring/scene/plan-scene-footprint';
import { createUnitProject } from './unit-envelope-fixtures';

/** The grid-M generator's k, and the number of Rooms it reconciles. */
export const COUNTING_GRID = 7;
export const COUNTING_ROOMS = COUNTING_GRID * COUNTING_GRID;
export const COUNTING_PRIMITIVES_PER_ROOM = 3;
export const COUNTING_FORMS_PER_ROOM = 1;
export const COUNTING_TEXTURED_PER_ROOM = 1;
export const COUNTING_ARTWORKS = 20;
/** Four distinct artwork widths, cycled over the 20 artworks. */
export const COUNTING_ARTWORK_SIZES = [0.4, 0.6, 0.8, 1] as const;
export const COUNTING_MODEL_INSTANCES = 12;

export const COUNTING_PROJECT_ID = 'project-e0-counting-scene';
export const COUNTING_TEXTURE_ID = 'e0-counting-texture';
export const COUNTING_MODEL_ASSET_ID = 'paris-grand-piano';

const SHARED_LOOK = 'e0-look-shared';
const SECOND_LOOK = 'e0-look-second';
const TEXTURED_LOOK = 'e0-look-textured';

const ARTWORK_ASSET_ID = '00000000-0000-4000-8000-000000000001';

export type CountingSceneFixture = {
	readonly project: ProjectEnvelope;
	readonly document: LayoutDocumentWallFirst;
	readonly compiled: CompiledLayoutGeometry;
	readonly plan: PlanEvaluation;
	readonly footprints: PlanSceneProjection;
	readonly entities: readonly SceneEntity[];
	readonly renderableEntities: readonly SceneEntity[];
	readonly counts: {
		readonly walls: number;
		readonly rooms: number;
		readonly primitives: number;
		readonly forms: number;
		readonly artworks: number;
		readonly models: number;
		readonly texturedPrimitives: number;
		readonly renderableEntities: number;
		readonly distinctLooks: number;
	};
};

function roomPoint(index: number, roomSize = CELL_METERS): [number, number] {
	const column = index % COUNTING_GRID;
	const row = Math.floor(index / COUNTING_GRID);
	return [column * roomSize + 1, row * roomSize + 1];
}

function primitive(
	id: string,
	primitiveKind: ScenePrimitiveEntity['primitive'],
	position: [number, number, number],
	look: string,
	options: { readonly castShadow?: boolean } = {}
): ScenePrimitiveEntity {
	const dimensions =
		primitiveKind === 'box'
			? { width: 0.6, height: 0.8, depth: 0.6 }
			: primitiveKind === 'sphere'
				? { radius: 0.3 }
				: primitiveKind === 'cylinder'
					? { radius: 0.25, height: 0.9 }
					: { width: 0.6, height: 0.6 };
	return {
		kind: 'primitive',
		primitive: primitiveKind,
		id,
		name: id,
		dimensions,
		materialId: 'plaster-warm',
		materialInstanceId: look,
		castShadow: options.castShadow ?? true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0]
	} as ScenePrimitiveEntity;
}

function form(id: string, position: [number, number, number], look: string): SceneFormEntity {
	return {
		kind: 'form',
		id,
		name: id,
		position,
		rotation: [0, 0, 0],
		materialId: 'plaster-warm',
		materialInstanceId: look,
		castShadow: true,
		receiveShadow: true,
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				extent: 0.2,
				outline: [
					{ key: 1, u: 0, v: 0, smooth: false },
					{ key: 2, u: 1, v: 0, smooth: false },
					{ key: 3, u: 1, v: 0.5, smooth: false },
					{ key: 4, u: 0, v: 0.5, smooth: false }
				]
			},
			scale: [1, 1, 1],
			nextKey: 5
		}
	};
}

function artwork(index: number): SceneArtworkEntity {
	const size = COUNTING_ARTWORK_SIZES[index % COUNTING_ARTWORK_SIZES.length]!;
	const point = roomPoint(index % (COUNTING_ROOMS - 1));
	return {
		kind: 'artwork',
		id: `e0-artwork-${String(index).padStart(2, '0')}`,
		name: `Counting artwork ${index + 1}`,
		position: [point[0] + (index % 3) * 0.4, 1.4, point[1] + 2.4],
		rotation: [0, 0, 0],
		source: { kind: 'image', assetId: ARTWORK_ASSET_ID, pixelWidth: 800, pixelHeight: 600 },
		widthMeters: size
	};
}

function model(index: number): SceneModelEntity {
	const point = roomPoint((index * 7) % COUNTING_ROOMS);
	return {
		kind: 'model',
		id: `e0-model-${String(index).padStart(2, '0')}`,
		name: `Counting model ${index + 1}`,
		assetId: COUNTING_MODEL_ASSET_ID,
		fallback: 'piano',
		position: [point[0] + 3.4, 0, point[1] + 2.4],
		rotation: [0, 0, 0],
		scale: 1
	};
}

function planFor(compiled: CompiledLayoutGeometry, datumMeters = 0): PlanEvaluation {
	const bounds = compiled.bounds;
	const target: LayoutVec2 =
		bounds === null ? [0, 0] : [(bounds.min[0] + bounds.max[0]) / 2, (bounds.min[2] + bounds.max[2]) / 2];
	const result = evaluateLayoutPlan(
		compiled,
		{
			cutHeightMeters: 1.2,
			depthMeters: 100,
			lateralSpanHalfWidthMeters: null,
			sourceKindFilter: null,
			reveal: []
		},
		{ generationId: 'generation-e0-counting', target, datumMeters }
	);
	if (result.kind !== 'evaluated') {
		throw new Error(`the counting fixture Plan did not evaluate: ${JSON.stringify(result.issues)}`);
	}
	return result.plan;
}

/**
 * Build the fixture's envelope and the derived values a counting harness reads.
 *
 * Layout identities come from a sequential capture source, so the same fixture
 * has the same ids on every run. Scene identities are literals above.
 */
export async function buildCountingSceneFixture(
	projectId = COUNTING_PROJECT_ID
): Promise<CountingSceneFixture> {
	const captures = sequentialCaptures('e0-counting-');
	const document = addOpenings(buildGrid(COUNTING_GRID, captures), captures);
	const compile = compileWallFirstLayoutGeometry(document);
	const blocking = compile.issues.filter((issue) => issue.severity !== 'warning');
	if (blocking.length > 0) {
		throw new Error(`the counting fixture Layout has ${blocking.length} blocking issues: ${blocking[0]?.message}`);
	}
	const compiled = compile.geometry;

	const textures: SceneTextureAsset[] = [
		{ id: COUNTING_TEXTURE_ID, name: 'Counting texture', uri: '/textures/e0-counting.png' }
	];
	const materials: SceneMaterialInstance[] = [
		{ id: SHARED_LOOK, name: 'Shared plaster', baseMaterialId: 'plaster-warm', roughness: 0.85, metalness: 0 },
		{ id: SECOND_LOOK, name: 'Second plaster', baseMaterialId: 'plaster-warm', roughness: 0.4, metalness: 0 },
		{
			id: TEXTURED_LOOK,
			name: 'Textured plaster',
			baseMaterialId: 'plaster-warm',
			baseTextureId: COUNTING_TEXTURE_ID,
			roughness: 0.65,
			metalness: 0
		}
	];

	const entities: SceneEntity[] = [];
	const rooms = document.rooms;
	for (let index = 0; index < rooms.length; index += 1) {
		const [x, z] = roomPoint(index);
		entities.push(
			primitive(`e0-room-${index}-box`, 'box', [x, 0.4, z], SHARED_LOOK),
			primitive(`e0-room-${index}-cylinder`, 'cylinder', [x + 0.9, 0.45, z], SHARED_LOOK),
			primitive(`e0-room-${index}-sphere`, 'sphere', [x + 1.8, 0.3, z], SECOND_LOOK),
			form(`e0-room-${index}-form`, [x + 2.5, 0, z], SHARED_LOOK),
			primitive(`e0-room-${index}-textured`, 'box', [x + 3.4, 0.4, z], TEXTURED_LOOK)
		);
	}
	for (let index = 0; index < COUNTING_ARTWORKS; index += 1) entities.push(artwork(index));
	for (let index = 0; index < COUNTING_MODEL_INSTANCES; index += 1) entities.push(model(index));

	const scene: CameraFreeSceneDocument = {
		formatVersion: 6,
		textures,
		materials,
		entities,
		artworkLibrary: [
			{ assetId: ARTWORK_ASSET_ID, name: 'Counting print', pixelWidth: 800, pixelHeight: 600 }
		]
	};
	const project = await createUnitProject({
		id: projectId,
		name: 'E0 counting Scene',
		layout: document,
		scene
	});
	const plan = planFor(compiled);
	const footprints = buildPlanSceneFootprintProjection({ entities });
	const renderableEntities = entities.filter((entity) => entity.kind !== 'light');

	return {
		project,
		document,
		compiled,
		plan,
		footprints,
		entities,
		renderableEntities,
		counts: {
			walls: document.walls.length,
			rooms: rooms.length,
			primitives: entities.filter((entity) => entity.kind === 'primitive').length,
			forms: entities.filter((entity) => entity.kind === 'form').length,
			artworks: entities.filter((entity) => entity.kind === 'artwork').length,
			models: entities.filter((entity) => entity.kind === 'model').length,
			texturedPrimitives: entities.filter(
				(entity) => entity.kind === 'primitive' && entity.materialInstanceId === TEXTURED_LOOK
			).length,
			renderableEntities: renderableEntities.length,
			distinctLooks: materials.length
		}
	};
}
