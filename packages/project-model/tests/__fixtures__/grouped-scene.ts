/**
 * T2.G1a — the shared grouped Scene fixture.
 *
 * One Layout with a datum floor, a raised platform and a mezzanine gives group
 * Move/Turn every support case the plan names: a resting member that can leave
 * the platform, a lifted member whose base is below the mezzanine, and a
 * mezzanine above a lifted base that must be ignored. The Scene carries the
 * *Still life* group (form plinth, model, Artwork and Picture spot, plus one
 * lifted box), an ungrouped neighbour and a second two-member group for order
 * and isolation checks.
 *
 * Captured contacts are explicit: support is re-derived from the Layout, never
 * from an entity's Y, so every fixture member that has a floor contact carries
 * the contact height its geometry actually has.
 */
import {
	SCENE_UNIT_FORMAT_VERSION,
	type CameraFreeSceneDocument,
} from '@portfolio/project-model/units';
import type {
	SceneArtworkEntity,
	SceneEntity,
	SceneFormEntity,
	SceneLightEntity,
	SceneObjectCluster,
	ScenePrimitiveEntity,
	Vec3,
} from '@portfolio/project-model/scene';
import {
	createEmptyWallFirstLayoutDocument,
	type LayoutDocumentWallFirst,
	type LayoutRegion,
} from '@portfolio/layout-core/wall';

export type GroupedSceneFixture = {
	readonly layout: LayoutDocumentWallFirst;
	readonly scene: CameraFreeSceneDocument;
	readonly stillLifeClusterId: string;
	readonly orderClusterId: string;
	readonly stillLifeMemberIds: readonly string[];
	readonly orderMemberIds: readonly string[];
	/** Captured contact heights for every member with a floor contact. */
	readonly contacts: Readonly<Record<string, number>>;
};

const PLATFORM: LayoutRegion = {
	id: 'region-platform',
	role: 'floor',
	footprint: {
		kind: 'polygon',
		points: [
			[2, 1],
			[5, 1],
			[5, 4],
			[2, 4],
		],
	},
	elevation: 0.4,
	thickness: 0.2,
	form: { kind: 'flat' },
	intendedGaps: [],
	name: 'Raised platform',
};

/** A floor region above a lifted member's base: it must never become its support. */
const MEZZANINE: LayoutRegion = {
	id: 'region-mezzanine',
	role: 'floor',
	footprint: {
		kind: 'polygon',
		points: [
			[6, 0],
			[7, 0],
			[7, 1],
			[6, 1],
		],
	},
	elevation: 0.9,
	thickness: 0.1,
	form: { kind: 'flat' },
	intendedGaps: [],
	name: 'Mezzanine',
};

function box(id: string, position: Vec3, height = 1): ScenePrimitiveEntity {
	return {
		kind: 'primitive',
		primitive: 'box',
		id,
		name: id,
		dimensions: { width: 1, height, depth: 1 },
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
		position,
		rotation: [0, 0, 0],
		scale: 1,
	};
}

function plinth(): SceneFormEntity {
	return {
		kind: 'form',
		id: 'still-life-plinth',
		name: 'Still life plinth',
		position: [3.2, 0.4, 2],
		rotation: [0, 0, 0],
		form: {
			generator: {
				kind: 'extrude',
				plane: 'plan',
				outline: [
					{ key: 1, u: -0.5, v: -0.5, smooth: false },
					{ key: 2, u: 0.5, v: -0.5, smooth: false },
					{ key: 3, u: 0.5, v: 0.5, smooth: false },
					{ key: 4, u: -0.5, v: 0.5, smooth: false },
				],
				extent: 1,
			},
			scale: [1, 1, 1],
			nextKey: 5,
		},
		materialId: 'plaster-warm',
		castShadow: true,
		receiveShadow: true,
	};
}

/** A floor-standing plinth-like body; the fixture keeps no model-resource closure. */
const MODEL: ScenePrimitiveEntity = {
	kind: 'primitive',
	primitive: 'cylinder',
	id: 'still-life-model',
	name: 'Still life model',
	dimensions: { radius: 0.4, height: 1 },
	materialId: 'plaster-warm',
	castShadow: true,
	receiveShadow: true,
	position: [0.5, 0.5, 1.5],
	rotation: [0, 0, 0],
	scale: 1,
};

const ARTWORK: SceneArtworkEntity = {
	kind: 'artwork',
	id: 'still-life-artwork',
	name: 'Still life artwork',
	source: {
		kind: 'image',
		assetId: '00000000-0000-4000-8000-000000000010',
		pixelWidth: 400,
		pixelHeight: 300,
	},
	widthMeters: 1.2,
	position: [0, 1.5, 5.9],
	rotation: [0, 0, 0],
};

const PICTURE: SceneLightEntity = {
	kind: 'light',
	light: 'spot',
	id: 'still-life-picture',
	name: 'Picture spot',
	color: '#fff4e0',
	intensity: 4,
	range: 8,
	angle: 0.45,
	penumbra: 0.3,
	castShadow: false,
	position: [0, 2.5, 4.5],
	rotation: [0.6, 0, 0],
};

function scene(entities: readonly SceneEntity[], clusters: readonly SceneObjectCluster[]) {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [],
		materials: [],
		artworkLibrary: [
			{
				name: 'Still life print',
				assetId: '00000000-0000-4000-8000-000000000010',
				pixelWidth: 400,
				pixelHeight: 300,
			},
		],
		entities: [...entities],
		clusters: [...clusters],
	} satisfies CameraFreeSceneDocument;
}

export function groupedSceneFixture(): GroupedSceneFixture {
	const layout: LayoutDocumentWallFirst = {
		...createEmptyWallFirstLayoutDocument(),
		regions: [PLATFORM, MEZZANINE],
	};
	const members: readonly SceneEntity[] = [
		plinth(),
		MODEL,
		ARTWORK,
		PICTURE,
		box('still-life-lifted', [3.8, 1.2, 3.2]),
	];
	const stillLifeMemberIds = members.map((entity) => entity.id);
	return {
		layout,
		scene: scene(
			[
				...members,
				box('neighbour', [5.5, 0.5, 2]),
				box('loose-prop', [6, 0.5, 3.2]),
				// Near the platform edge, so a duplicate's fixed offset leaves it.
				box('order-a', [4.8, 0.9, 3.6]),
				box('order-b', [4.6, 0.9, 3.2]),
			],
			[
				{
					id: 'cluster-still-life',
					name: 'Still life',
					memberIds: [...stillLifeMemberIds],
				},
				{
					id: 'cluster-order',
					name: 'Order',
					memberIds: ['order-a', 'order-b'],
				},
			],
		),
		stillLifeClusterId: 'cluster-still-life',
		orderClusterId: 'cluster-order',
		stillLifeMemberIds,
		orderMemberIds: ['order-a', 'order-b'],
		contacts: {
			'still-life-plinth': 0,
			'still-life-model': -0.5,
			'still-life-lifted': -0.5,
			neighbour: -0.5,
			'loose-prop': -0.5,
			'order-a': -0.5,
			'order-b': -0.5,
		},
	};
}

export type ShowcaseRigFixture = {
	readonly layout: LayoutDocumentWallFirst;
	readonly scene: CameraFreeSceneDocument;
	readonly clusterId: string;
	readonly lightIds: readonly string[];
};

/** Three validated lights and the cluster a saved rig would insert. */
export function showcaseRigFixture(): ShowcaseRigFixture {
	const lights: readonly SceneLightEntity[] = [
		{
			kind: 'light',
			light: 'point',
			id: 'rig-key',
			name: 'Key',
			color: '#ffe9c4',
			intensity: 8,
			range: 12,
			castShadow: true,
			position: [2, 3, 2],
			rotation: [0, 0, 0],
		},
		{
			kind: 'light',
			light: 'spot',
			id: 'rig-fill',
			name: 'Fill',
			color: '#d7e8ff',
			intensity: 3,
			range: 10,
			angle: 0.7,
			penumbra: 0.4,
			castShadow: false,
			position: [4, 2.5, 2],
			rotation: [0, 0, 0],
		},
		{
			kind: 'light',
			light: 'point',
			id: 'rig-rim',
			name: 'Rim',
			color: '#ffd9b0',
			intensity: 2,
			range: 8,
			castShadow: false,
			position: [1, 2, 4],
			rotation: [0, 0, 0],
		},
	];
	return {
		layout: createEmptyWallFirstLayoutDocument(),
		scene: scene(lights, [
			{
				id: 'cluster-showcase',
				name: 'Showcase',
				memberIds: lights.map((light) => light.id),
			},
		]),
		clusterId: 'cluster-showcase',
		lightIds: lights.map((light) => light.id),
	};
}
