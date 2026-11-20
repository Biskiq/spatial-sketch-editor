/**
 * Build the PR 1 canonical current-world fixture.
 *
 * The measured 31-wall saved project is not in the repository. The approved
 * plan permits reproducing its scale with the canonical fixture builders, so
 * this script authors a current-format F.2 project with the plan's required
 * content and no renderer-specific construction. It is deterministic: rerun it
 * with `npx vite-node scripts/build-webgpu-current-world.ts` from `apps/editor`
 * and compare the emitted bytes and digest.
 *
 * The layout is a 5 × 2 room grid (27 shared perimeter/partition Walls) plus a
 * four-Wall free-standing cluster whose second Wall is curved: 10 rooms,
 * 31 Walls. A standalone floor Region, one opening, one Layout object, a mapped
 * Finish, a primitive, an imported textured GLB, two Artworks and three shadow
 * casters (Sky Sun, Point, Spot) complete the plan's manifest.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	createEmptyWallFirstLayoutDocument,
	deriveChainSpans,
	wallCubicChain,
	type LayoutDocumentWallFirst,
	type LayoutVec2,
	type LayoutWall,
	type LayoutWallCenterline
} from '@portfolio/layout-core';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	createEmptyExperiencePayload,
	createProjectEnvelope,
	serializeProjectEnvelope,
	type CameraUnitPayload,
	type CameraFreeSceneDocument,
	type ProjectEnvelope,
	type ResourceUnitPayload
} from '@portfolio/project-model/units';

const here = resolve(dirname(fileURLToPath(import.meta.url)), '../experiments/webgpu-migration/baseline');
const projectId = 'project:t2-pr1-current-world';
const roomColumns = 5;
const roomRows = 2;
const cell = 4;
const wallHeight = 3;
const wallThickness = 0.16;

function junctionId(x: number, z: number): string {
	return `j-${x}-${z}`;
}

function wallId(kind: 'v' | 'h', x: number, z: number): string {
	return `wall-${kind}-${x}-${z}`;
}

function buildLayout(): LayoutDocumentWallFirst {
	const layout = createEmptyWallFirstLayoutDocument();
	layout.floor = { id: 'floor-ground', name: 'Ground Floor', elevation: 0 };

	for (let x = 0; x <= roomColumns; x += 1) {
		for (let z = 0; z <= roomRows; z += 1) {
			layout.junctions.push({ id: junctionId(x, z), point: [x * cell, z * cell] });
		}
	}

	for (let x = 0; x <= roomColumns; x += 1) {
		for (let z = 0; z < roomRows; z += 1) {
			layout.walls.push({
				id: wallId('v', x, z),
				startJunctionId: junctionId(x, z),
				endJunctionId: junctionId(x, z + 1),
				thickness: wallThickness,
				height: wallHeight,
				centerline: { kind: 'line' }
			});
		}
	}
	for (let z = 0; z <= roomRows; z += 1) {
		for (let x = 0; x < roomColumns; x += 1) {
			layout.walls.push({
				id: wallId('h', x, z),
				startJunctionId: junctionId(x, z),
				endJunctionId: junctionId(x + 1, z),
				thickness: wallThickness,
				height: wallHeight,
				centerline: { kind: 'line' }
			});
		}
	}

	// A free-standing four-Wall cluster inside the top-right Room. Its second
	// Wall is the required curved Wall; none of these junctions touches a Room
	// boundary, so the cluster is authored as architecture rather than a Room.
	const cluster: Array<{ id: string; start: LayoutVec2; end: LayoutVec2; knot?: LayoutVec2 }> = [
		{ id: 'wall-fs-0', start: [13, 5], end: [15, 5] },
		{ id: 'wall-fs-1', start: [15, 5], end: [15, 7], knot: [15.5, 6] },
		{ id: 'wall-fs-2', start: [15, 7], end: [13, 7] },
		{ id: 'wall-fs-3', start: [13, 7], end: [13, 5] }
	];
	const clusterJunctions = new Map<string, string>();
	for (const entry of cluster) {
		for (const point of [entry.start, entry.end]) {
			const key = `${point[0]},${point[1]}`;
			if (clusterJunctions.has(key)) continue;
			const id = `j-fs-${clusterJunctions.size}`;
			clusterJunctions.set(key, id);
			layout.junctions.push({ id, point: [point[0], point[1]] });
		}
	}
	for (const entry of cluster) {
		const start = clusterJunctions.get(`${entry.start[0]},${entry.start[1]}`)!;
		const end = clusterJunctions.get(`${entry.end[0]},${entry.end[1]}`)!;
		const centerline: LayoutWallCenterline =
			entry.knot === undefined
				? { kind: 'line' }
				: wallCubicChain(
						[{ id: `${entry.id}:knot:0`, point: [entry.knot[0], entry.knot[1]] }],
						deriveChainSpans([entry.start, entry.knot, entry.end])
					);
		layout.walls.push({
			id: entry.id,
			startJunctionId: start,
			endJunctionId: end,
			thickness: 0.12,
			height: 2.4,
			centerline
		});
	}

	for (let x = 0; x < roomColumns; x += 1) {
		for (let z = 0; z < roomRows; z += 1) {
			layout.rooms.push({
				id: `room-${x}-${z}`,
				name: `Room ${x + 1}.${z + 1}`,
				boundary: [
					{ wallId: wallId('h', x, z), direction: 'forward' },
					{ wallId: wallId('v', x + 1, z), direction: 'forward' },
					{ wallId: wallId('h', x, z + 1), direction: 'reverse' },
					{ wallId: wallId('v', x, z), direction: 'reverse' }
				],
				virtualEdges: [],
				overhead: 'closed'
			});
		}
	}

	layout.openings.push({
		id: 'door-entry',
		wallId: wallId('h', 0, 0),
		kind: 'door',
		offset: 1,
		width: 0.9,
		height: 2.1,
		sillHeight: 0,
		profile: 'rectangular',
		name: 'Entry'
	});

	layout.regions.push({
		id: 'region-plinth',
		role: 'floor',
		footprint: {
			kind: 'polygon',
			points: [
				[22, 0],
				[24, 0],
				[24, 2],
				[22, 2]
			]
		},
		elevation: 0,
		thickness: 0.12,
		form: { kind: 'flat' },
		intendedGaps: [],
		name: 'Standalone plinth'
	});

	layout.objects.push({
		id: 'object-bench',
		kind: 'box',
		position: [2, 0.4, 2],
		rotation: [0, 0, 0],
		dimensions: [1, 0.8, 1],
		roomId: 'room-0-0'
	});

	return layout;
}

const NEUTRAL_ARTWORK_ID = '33333333-3333-4333-8333-333333333333';
const TRANSLUCENT_ARTWORK_ID = '44444444-4444-4444-8444-444444444444';
const NEUTRAL_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
	'base64'
);
const TRANSLUCENT_PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
	'base64'
);

function buildScene(): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: [{ id: 'tex-plaster', name: 'Warm plaster map', uri: '/textures/plaster-warm/map.png' }],
		materials: [
			{
				id: 'finish-plaster',
				name: 'Warm plaster',
				baseMaterialId: 'plaster-warm',
				maps: { color: 'tex-plaster' },
				roughness: 0.86
			}
		],
		entities: [
			{
				kind: 'primitive',
				id: 'entity-plinth',
				name: 'Plinth block',
				primitive: 'box',
				position: [17, 0.45, 2],
				rotation: [0, 0, 0],
				dimensions: { width: 1.8, height: 0.9, depth: 1.2 },
				materialId: 'plaster-warm',
				materialInstanceId: 'finish-plaster',
				castShadow: true,
				receiveShadow: true
			},
			{
				kind: 'model',
				id: 'entity-piano',
				name: 'Imported piano',
				assetId: 'paris-grand-piano',
				fallback: 'piano',
				position: [6, 0, 2],
				rotation: [0, 0.4, 0],
				materialInstanceId: 'finish-plaster'
			},
			{
				kind: 'artwork',
				id: 'entity-artwork-neutral',
				name: 'Neutral artwork',
				position: [10, 1.6, 7.88],
				rotation: [0, 0, 0],
				widthMeters: 1,
				source: {
					kind: 'image',
					assetId: NEUTRAL_ARTWORK_ID,
					pixelWidth: 1,
					pixelHeight: 1
				}
			},
			{
				kind: 'artwork',
				id: 'entity-artwork-translucent',
				name: 'Translucent artwork',
				position: [14, 1.6, 4.12],
				rotation: [0, 0, 0],
				widthMeters: 0.8,
				source: {
					kind: 'image',
					assetId: TRANSLUCENT_ARTWORK_ID,
					pixelWidth: 1,
					pixelHeight: 1
				}
			},
			{
				kind: 'form',
				id: 'entity-form',
				name: 'Native form',
				position: [18, 0, 6],
				rotation: [0, 0, 0],
				form: {
					generator: {
						kind: 'extrude',
						plane: 'plan',
						outline: [
							{ key: 1, u: -0.4, v: -0.4, smooth: false },
							{ key: 2, u: 0.4, v: -0.4, smooth: false },
							{ key: 3, u: 0.4, v: 0.4, smooth: false },
							{ key: 4, u: -0.4, v: 0.4, smooth: false }
						],
						extent: 1.2
					},
					scale: [1, 1, 1],
					nextKey: 5
				},
				materialId: 'plaster-warm',
				castShadow: true,
				receiveShadow: true
			},
			{
				kind: 'light',
				id: 'light-point',
				name: 'Point shadow',
				light: 'point',
				position: [10, 2.6, 4],
				rotation: [0, 0, 0],
				color: '#fff1dc',
				intensity: 14,
				castShadow: true
			},
			{
				kind: 'light',
				id: 'light-spot',
				name: 'Spot shadow',
				light: 'spot',
				position: [4, 3, 2],
				rotation: [0, 0, 0],
				color: '#ffe8cc',
				intensity: 60,
				angle: 0.5,
				penumbra: 0.3,
				castShadow: true
			}
		],
		surfaceFinishes: [
			{ surface: { kind: 'region-face', regionId: 'region-plinth', face: 'top' }, finish: { materialInstanceId: 'finish-plaster' } },
			{ surface: { kind: 'room-floor', roomId: 'room-0-0' }, finish: { materialId: 'wood-walnut' } }
		],
		artworkLibrary: [
			{ assetId: NEUTRAL_ARTWORK_ID, pixelWidth: 1, pixelHeight: 1, name: 'Neutral artwork' },
			{ assetId: TRANSLUCENT_ARTWORK_ID, pixelWidth: 1, pixelHeight: 1, name: 'Translucent artwork' }
		],
		environment: {
			sky: {
				preset: 'daylight',
				time: 12,
				heading: 0,
				arcHeight: 50,
				haze: 0.3,
				exposure: 1,
				softness: 0.5,
				sunShadows: true,
				moon: { color: '#ffffff', strength: 0.2 },
				skyColor: '#dfe9f5',
				groundColor: '#bdb7a9'
			}
		}
	};
}

function buildCamera(): CameraUnitPayload {
	return {
		formatVersion: CAMERA_UNIT_FORMAT_VERSION,
		views: [
			{
				id: 'view-entry',
				label: 'Entry',
				eye: [10, 1.7, 3.9],
				target: [10, 1.4, 7.5],
				fov: 54,
				connectedViewIds: []
			},
			{
				id: 'view-piano',
				label: 'Piano',
				eye: [2.5, 1.7, 3.9],
				target: [6, 1.1, 2],
				fov: 54,
				connectedViewIds: []
			},
			{
				id: 'view-plinth',
				label: 'Plinth',
				eye: [17, 1.7, 5.5],
				target: [17, 1.1, 2],
				fov: 54,
				connectedViewIds: []
			}
		],
		connections: []
	};
}

function buildResources(): ResourceUnitPayload {
	// The Scene names one mapped texture and one catalogue model; the closure
	// requires a resolved resource record for each, even when the bytes ship as
	// static files. These revisions are fixture identities, not P20 pins.
	return {
		formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
		resources: [
			{ kind: 'texture', id: 'tex-plaster', contentRevision: 'revision-tex-plaster-1', pin: null, unresolved: null },
			{ kind: 'asset', id: 'paris-grand-piano', contentRevision: 'revision-piano-1', pin: null, unresolved: null }
		]
	};
}

async function build(): Promise<ProjectEnvelope> {
	return createProjectEnvelope({
		id: projectId,
		name: 'T2 PR 1 current world',
		acceptedRevision: { projectId, revisionId: 'revision-current-world-1' },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: `${projectId}:layout`, data: buildLayout() },
		scene: { unitId: `${projectId}:scene`, data: buildScene() },
		camera: { unitId: `${projectId}:camera`, data: buildCamera() },
		experience: {
			unitId: `${projectId}:experience`,
			data: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: createEmptyExperiencePayload().experiences }
		},
		resources: {
			unitId: `${projectId}:resources`,
			data: buildResources()
		}
	});
}

const project = await build();
const canonical = serializeProjectEnvelope(project);
const canonicalFile = `${canonical}`;
const digest = `sha256-${createHash('sha256').update(canonicalFile).digest('hex')}`;
// P20 currently refuses native forms in a prepared publication. Keep the form in
// the canonical source comparator and publish one explicit, hashed projection
// without it rather than letting the public baseline silently diverge.
const publicScene: CameraFreeSceneDocument = {
	...project.units.scene.data,
	entities: project.units.scene.data.entities.filter((entity) => entity.kind !== 'form')
};
const publicProject = await createProjectEnvelope({
	id: project.id,
	name: project.name,
	acceptedRevision: project.acceptedRevision,
	dependencyLock: project.dependencyLock,
	layout: { unitId: project.units.layout.header.unitId, data: project.units.layout.data },
	scene: { unitId: project.units.scene.header.unitId, data: publicScene },
	camera: { unitId: project.units.camera.header.unitId, data: project.units.camera.data },
	experience: { unitId: project.units.experience.header.unitId, data: project.units.experience.data },
	resources: { unitId: project.units.resources.header.unitId, data: project.units.resources.data }
});
const publicCanonical = serializeProjectEnvelope(publicProject);
const publicCanonicalFile = `${publicCanonical}`;
const publicDigest = `sha256-${createHash('sha256').update(publicCanonicalFile).digest('hex')}`;
const layout = project.units.layout.data;
const scene = project.units.scene.data;
const summary = {
	fixture: 'apps/editor/experiments/webgpu-migration/baseline/current-world.project.json',
	digest,
	bytes: Buffer.byteLength(canonicalFile),
	counts: {
		rooms: layout.rooms.length,
		walls: layout.walls.length,
		junctions: layout.junctions.length,
		openings: layout.openings.length,
		regions: layout.regions.length,
		objects: layout.objects.length,
		sceneEntities: scene.entities.length,
		resources: project.units.resources.data.resources.length,
		lights: scene.entities.filter((entity) => entity.kind === 'light').length,
		artworks: scene.entities.filter((entity) => entity.kind === 'artwork').length,
		models: scene.entities.filter((entity) => entity.kind === 'model').length,
		primitives: scene.entities.filter((entity) => entity.kind === 'primitive').length,
		forms: scene.entities.filter((entity) => entity.kind === 'form').length
	},
	publicationProjection: {
		fixture: 'apps/editor/experiments/webgpu-migration/baseline/current-world.public.project.json',
		digest: publicDigest,
		bytes: Buffer.byteLength(publicCanonicalFile),
		removedContent: ['form'],
		reason: 'P20 prepared publication refuses native forms; the source comparator keeps entity-form.'
	},
	requiredContent: {
		opening: layout.openings.some((opening) => opening.kind === 'door'),
		'curved-wall': layout.walls.some((wall) => wall.centerline.kind !== 'line'),
		'room-floor-lid': layout.rooms.some((room) => room.overhead === 'closed'),
		'standalone-region-s5b-faces': scene.surfaceFinishes?.some((entry) => entry.surface.kind === 'region-face') ?? false,
		'layout-object': layout.objects.length > 0,
		'scene-primitive': scene.entities.some((entity) => entity.kind === 'primitive'),
		form: scene.entities.some((entity) => entity.kind === 'form'),
		'mapped-finish': scene.materials.some((material) => material.maps?.color !== undefined),
		'imported-textured-glb': scene.entities.some((entity) => entity.kind === 'model' && entity.assetId === 'paris-grand-piano'),
		'neutral-artwork': scene.entities.some((entity) => entity.kind === 'artwork' && entity.id === 'entity-artwork-neutral'),
		'translucent-artwork': scene.entities.some((entity) => entity.kind === 'artwork' && entity.id === 'entity-artwork-translucent'),
		'shadow-sun': scene.environment?.sky?.sunShadows === true,
		'shadow-spot': scene.entities.some((entity) => entity.kind === 'light' && entity.light === 'spot' && entity.castShadow),
		'shadow-point': scene.entities.some((entity) => entity.kind === 'light' && entity.light === 'point' && entity.castShadow)
	},
	artwork: [
		{ path: 'apps/editor/experiments/webgpu-migration/baseline/current-world-neutral.png', assetId: NEUTRAL_ARTWORK_ID, mime: 'image/png', byteSize: NEUTRAL_PNG.byteLength, digest: `sha256-${createHash('sha256').update(NEUTRAL_PNG).digest('hex')}` },
		{ path: 'apps/editor/experiments/webgpu-migration/baseline/current-world-translucent.png', assetId: TRANSLUCENT_ARTWORK_ID, mime: 'image/png', byteSize: TRANSLUCENT_PNG.byteLength, digest: `sha256-${createHash('sha256').update(TRANSLUCENT_PNG).digest('hex')}` }
	]
};

mkdirSync(here, { recursive: true });
writeFileSync(resolve(here, 'current-world.project.json'), canonicalFile);
writeFileSync(resolve(here, 'current-world.public.project.json'), publicCanonicalFile);
writeFileSync(resolve(here, 'current-world.summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
writeFileSync(resolve(here, 'current-world-neutral.png'), NEUTRAL_PNG);
writeFileSync(resolve(here, 'current-world-translucent.png'), TRANSLUCENT_PNG);
console.log(JSON.stringify(summary, null, 2));
