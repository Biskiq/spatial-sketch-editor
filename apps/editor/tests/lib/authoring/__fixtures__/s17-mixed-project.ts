/**
 * R217.S17 mixed authoring project shared with the S11 integration gate.
 *
 * Layout identities are created through their admitted planners. Catalogue
 * resources pin the actual shipped bytes, and the creator model uses the shared
 * resource builder. The only direct Layout edit is the fixture's deliberately
 * low partition height, which is the authored fact this mixed case must carry.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	createEmptyWallFirstLayoutDocument,
	nextLayoutPresetObjectId,
	planCommitLayoutObjectPreset,
	planCreateWallFirstOpening,
	planWallChain
} from '@portfolio/layout-core';
import type { SceneEntity, SceneFormEntity, ScenePrimitiveEntity } from '@portfolio/project-model';
import {
	creatorModelResourceEntry
} from '@portfolio/project-model/scene-planning';
import type {
	DependencyLockEntry,
	ProjectEnvelope,
	ResourceUnitPayload,
	TypedResource
} from '@portfolio/project-model/units';
import { getAssetById } from '$lib/content/assets';
import { CATALOGUE_MODEL_CONTACT_RECORDS } from '$lib/authoring/scene/object-definition-policy';
import { createUnitProject } from './unit-envelope-fixtures';
import { freshCapture } from '../../layout/__fixtures__/layout-id-capture';

const PROJECT_ID = 'project-r217-s17-mixed';
const CREATOR_MODEL_ID = 's17-approved-creator-model';
const EDITOR_STATIC_ROOT = fileURLToPath(new URL('../../../../static/', import.meta.url));

const APPROVAL = {
	derivative: {
		hash: `sha256-${'1'.repeat(64)}`,
		mime: 'model/gltf-binary',
		size: 4096,
		locator: 'models/s17-approved.glb'
	},
	source: { manifestHash: `sha256-${'2'.repeat(64)}`, size: 8192, fileCount: 1 },
	recipe: { id: 'creator-import@1', version: 1 },
	reportDigest: `sha256-${'3'.repeat(64)}`,
	placement: {
		metresPerSourceUnit: 1,
		pivot: [0, 0, 0] as const,
		footprint: { width: 0.45, depth: 0.35 },
		contactMinY: 0
	}
};

function primitive(
	id: string,
	name: string,
	width: number,
	height: number,
	depth: number,
	position: [number, number, number]
): ScenePrimitiveEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name,
		dimensions: { width, height, depth },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0]
	};
}

function form(
	id: string,
	name: string,
	outline: readonly (readonly [number, number])[],
	options: {
		readonly plane?: 'plan' | 'elevation';
		readonly extent?: number;
		readonly rotation?: [number, number, number];
		readonly position?: [number, number, number];
	} = {}
): SceneFormEntity {
	return {
		kind: 'form',
		id,
		name,
		position: options.position ?? [0.25, 0, 0.25],
		rotation: options.rotation ?? [0, 0, 0],
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		form: {
			generator: {
				kind: 'extrude',
				plane: options.plane ?? 'plan',
				extent: options.extent ?? 0.25,
				outline: outline.map(([u, v], index) => ({ key: index + 1, u, v, smooth: false }))
			},
			scale: [1, 1, 1],
			nextKey: outline.length + 1
		}
	};
}

function requireLayout<T extends { readonly kind: string; readonly rejection?: { readonly message: string } }>(
	result: T,
	stage: string
	): Extract<T, { readonly kind: 'success' }> {
	if (result.kind === 'rejected') throw new Error(`${stage}: ${result.rejection?.message ?? 'rejected'}`);
	if (result.kind !== 'success') throw new Error(`${stage}: expected a successful plan`);
	return result as Extract<T, { readonly kind: 'success' }>;
}

/** Pin shipped catalogue bytes by their actual content, not a guessed revision. */
async function catalogueAssetResource(assetId: string): Promise<{
	readonly resource: TypedResource;
	readonly lock: DependencyLockEntry;
}> {
	const asset = getAssetById(assetId);
	if (asset?.productionFile === undefined) throw new Error(`S17 catalogue asset "${assetId}" has no shipped file`);
	const bytes = await readFile(resolve(EDITOR_STATIC_ROOT, `.${asset.productionFile}`));
	const contentRevision = `sha256-${createHash('sha256').update(new Uint8Array(bytes)).digest('hex')}`;
	const resource: TypedResource = {
		kind: 'asset',
		id: assetId,
		contentRevision,
		pin: null,
		unresolved: null
	};
	return {
		resource,
		lock: {
			domain: 'resource:asset',
			subjectKind: 'resource',
			subjectId: assetId,
			instancePath: [],
			contentRevision,
			requiredCapabilities: [],
			pin: null
		}
	};
}

/** Build the same mixed subject set consumed by S17 and the S11 final gate. */
export async function buildS17MixedProject(projectId = PROJECT_ID): Promise<{
	readonly project: ProjectEnvelope;
	readonly ids: {
		readonly roomId: string;
		readonly doorId: string;
		readonly windowId: string;
		readonly plinthId: string;
		readonly lowWallId: string;
		readonly tableId: string;
		readonly nativeBoxId: string;
		readonly catalogueModelId: string;
		readonly unapprovedModelId: string;
		readonly approvedModelId: string;
		readonly rectangularFormId: string;
		readonly concaveFormId: string;
		readonly tiltedFormId: string;
	};
}> {
	const base = createEmptyWallFirstLayoutDocument();
	const room = requireLayout(
		planWallChain({
			baseline: base,
			points: [[0, 0], [3, 0], [3, 2], [0, 2]],
			close: true,
			height: 3,
			capture: freshCapture(),
			levelId: base.floor.id
		}),
		'3 × 2 room'
	);
	if (room.kind !== 'success') throw new Error('3 × 2 room was refused');
	const roomId = room.document.rooms[0]?.id;
	if (roomId === undefined) throw new Error('3 × 2 room has no reconciled Room');

	const doorWall = room.document.walls[0]!;
	const door = requireLayout(
		planCreateWallFirstOpening(
			room.document,
			{ wallId: doorWall.id, kind: 'door', offset: 0.35, width: 0.9, height: 2.1, sillHeight: 0 },
			freshCapture(),
			room.document.floor.id
		),
		'door'
	);
	const windowWall = door.document.walls[1]!;
	const window = requireLayout(
		planCreateWallFirstOpening(
			door.document,
			{ wallId: windowWall.id, kind: 'window', offset: 0.45, width: 1, height: 1, sillHeight: 0.9 },
			freshCapture(),
			door.document.floor.id
		),
		'window'
	);

	const plinth = requireLayout(
		planCommitLayoutObjectPreset(
			window.document,
			'plinth',
			[1.5, 1],
			window.document.floor.elevation,
			nextLayoutPresetObjectId(window.document, freshCapture()),
			window.document.floor.id
		),
		'plinth'
	);
	const lowWallId = plinth.document.walls[2]!.id;
	const layout = {
		...plinth.document,
		walls: plinth.document.walls.map((wall) =>
			wall.id === lowWallId ? { ...wall, height: 0.9 } : wall
		)
	};

	const catalogueRecord = CATALOGUE_MODEL_CONTACT_RECORDS[0];
	const unapprovedRecord = CATALOGUE_MODEL_CONTACT_RECORDS[1];
	if (catalogueRecord === undefined || unapprovedRecord === undefined) {
		throw new Error('S17 needs at least two declared floor catalogue model records');
	}
	const creatorEntry = creatorModelResourceEntry(CREATOR_MODEL_ID, APPROVAL);
	if (creatorEntry === null) throw new Error('the approved creator-model fixture was refused');
	const catalogueEntries = await Promise.all([
		catalogueAssetResource(catalogueRecord.assetId),
		catalogueAssetResource(unapprovedRecord.assetId)
	]);
	const sceneEntities: SceneEntity[] = [
		primitive('s17-table-075', '0.75 m Table', 1.1, 0.75, 0.7, [0.65, 0.375, 1.15]),
		primitive('s17-native-box', 'Native box', 0.45, 0.45, 0.45, [2, 0.225, 0.55]),
		{
			kind: 'model', id: 's17-catalogue-floor-model', name: 'Catalogue floor model',
			assetId: catalogueRecord.assetId, fallback: 'generic', position: [0.55, 0, 0.55], rotation: [0, 0, 0]
		},
		{
			kind: 'model', id: 's17-unapproved-model', name: 'Unapproved catalogue model',
			assetId: unapprovedRecord.assetId, fallback: 'generic', position: [2.45, 0, 0.45], rotation: [0, 0, 0]
		},
		{
			kind: 'model', id: CREATOR_MODEL_ID, name: 'Approved creator model',
			assetId: CREATOR_MODEL_ID, fallback: 'generic', position: [2.5, 0, 1.1], rotation: [0, 0, 0]
		},
		form(
			's17-rectangular-form', 'Rectangular form', [[0, 0], [0.7, 0], [0.7, 0.4], [0, 0.4]],
			{ position: [0.35, 0, 0.35] }
		),
		form(
			's17-concave-form', 'Concave form', [[0, 0], [0.7, 0], [0.7, 0.25], [0.3, 0.25], [0.3, 0.65], [0, 0.65]],
			{ extent: 0.3, position: [1.15, 0, 0.35] }
		),
		form(
			's17-tilted-form', 'Tilted form', [[0, 0], [0.6, 0], [0.6, 0.3], [0, 0.3]],
			{ plane: 'elevation', extent: 0.2, rotation: [0.22, 0, -0.18], position: [0.35, 0, 1.55] }
		)
	];
	const resources: ResourceUnitPayload = {
		formatVersion: 2,
		resources: [...catalogueEntries.map((entry) => entry.resource), creatorEntry.resource]
	};
	const project = await createUnitProject({
		id: projectId,
		name: 'R217.S17 mixed scene and form project',
		layout,
		scene: { formatVersion: 4, textures: [], materials: [], entities: sceneEntities },
		resources
	});
	return {
		project: {
			...project,
			dependencyLock: {
				formatVersion: 1,
				entries: [...catalogueEntries.map((entry) => entry.lock), creatorEntry.lock]
			}
		},
		ids: {
			roomId,
			doorId: door.changedOpeningIds[0]!,
			windowId: window.changedOpeningIds[0]!,
			plinthId: plinth.createdObjectId!,
			lowWallId,
			tableId: 's17-table-075',
			nativeBoxId: 's17-native-box',
			catalogueModelId: 's17-catalogue-floor-model',
			unapprovedModelId: 's17-unapproved-model',
			approvedModelId: CREATOR_MODEL_ID,
			rectangularFormId: 's17-rectangular-form',
			concaveFormId: 's17-concave-form',
			tiltedFormId: 's17-tilted-form'
		}
	};
}
