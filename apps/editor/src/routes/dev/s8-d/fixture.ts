/**
 * The D visual gate fixture: one real three-image brushed-metal Finish.
 *
 * It builds the exact admitted Scene 12 / resources 3 pair the D writer emits
 * (texture records, texture resources, eight-byte-hashed pins, one material
 * resource, its capability lock), saves it through the one serializer, admits
 * the saved bytes in a fresh session, and composes the cold release bundle from
 * the real PNG bytes. Nothing here is a renderer shortcut: the page then draws
 * that bundle through the product Scene description and representation.
 */
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import {
	MATERIAL_CAPABILITY,
	catalogueRecipe,
	readRecipe,
	recipeHash,
	type Recipe
} from '@portfolio/project-model/materials';
import { finishTextureResource } from '@portfolio/project-model/scene-planning';
import {
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	createEmptyCameraPayload,
	createEmptyExperiencePayload,
	createEmptyUnitSceneDocument,
	createProjectEnvelope,
	serializeProjectEnvelope,
	validateProjectEnvelope,
	type ProjectEnvelope,
	type ResourcePin,
	type TypedResource
} from '@portfolio/project-model/units';
import type { RuntimeScene } from '@portfolio/project-model';
import { admitSourceJson } from '$lib/authoring/stage/source-admission';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';

const SIZE = 256;

export type DGateImage = {
	readonly id: string;
	readonly name: string;
	readonly mime: 'image/png';
	readonly bytes: Uint8Array;
	readonly hash: string;
	readonly size: number;
};

function hex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function image(
	id: string,
	name: string,
	draw: (context: OffscreenCanvasRenderingContext2D, size: number) => void
): Promise<DGateImage> {
	const canvas = new OffscreenCanvas(SIZE, SIZE);
	const context = canvas.getContext('2d');
	if (context === null) throw new Error('the D gate needs a 2D canvas');
	draw(context, SIZE);
	const blob = await canvas.convertToBlob({ type: 'image/png' });
	const bytes = new Uint8Array(await blob.arrayBuffer());
	const hash = `sha256-${hex(await crypto.subtle.digest('SHA-256', bytes))}`;
	return { id, name, mime: 'image/png', bytes, hash, size: bytes.byteLength };
}

/** Deterministic brushed patterns: colour, a mostly-flat normal and a packed ORM. */
async function brushedImages(): Promise<{ colour: DGateImage; normal: DGateImage; orm: DGateImage }> {
	const colour = await image('11111111-1111-4111-8111-111111111111', 'Brushed colour', (context, size) => {
		for (let x = 0; x < size; x += 1) {
			const value = 172 + Math.round(48 * Math.sin((x * Math.PI * 2) / 24));
			context.fillStyle = `rgb(${value + 8}, ${value + 12}, ${value + 18})`;
			context.fillRect(x, 0, 1, size);
		}
	});
	const normal = await image('22222222-2222-4222-8222-222222222222', 'Brushed normal DX', (context, size) => {
		context.fillStyle = 'rgb(128, 128, 255)';
		context.fillRect(0, 0, size, size);
		for (let x = 0; x < size; x += 1) {
			context.fillStyle = `rgb(${128 + Math.round(10 * Math.sin((x * Math.PI * 2) / 24))}, 128, 255)`;
			context.fillRect(x, 0, 1, size);
		}
	});
	const orm = await image('33333333-3333-4333-8333-333333333333', 'Brushed ORM', (context, size) => {
		const pixels = context.createImageData(size, size);
		for (let y = 0; y < size; y += 1) {
			for (let x = 0; x < size; x += 1) {
				const index = (y * size + x) * 4;
				pixels.data[index] = 235;
				pixels.data[index + 1] = 84 + Math.round(44 * Math.sin((x * Math.PI * 2) / 24));
				pixels.data[index + 2] = 250;
				pixels.data[index + 3] = 255;
			}
		}
		context.putImageData(pixels, 0, 0);
	});
	return { colour, normal, orm };
}

export type DGateBundle = {
	readonly envelope: ProjectEnvelope;
	readonly saved: string;
	readonly scene: RuntimeScene;
	readonly oracleScene: RuntimeScene;
	/** The B path's catalogue instance, resolving the same authored inputs. */
	readonly sampled: {
		readonly recipeHash: string;
		readonly images: readonly string[];
		readonly maps: readonly string[];
	};
	readonly imageUris: ReadonlyMap<string, Uint8Array>;
	dispose(): void;
};

export async function buildDGate(): Promise<DGateBundle> {
	const { colour, normal, orm } = await brushedImages();
	const images = [colour, normal, orm];
	const recipeRead = readRecipe({
		profile: 'pbr-metallic-roughness/v1',
		color: '#cfd3d8',
		roughness: 0.38,
		metalness: 0.55,
		occlusionStrength: 1,
		normalScale: 1,
		// An explicit UV chart is shared by the native plane and any GLB, so this
		// fixture never claims a metric basis the target does not prove.
		mapping: { kind: 'uv', set: 0, repeat: [1, 1], rotation: 0.35, offset: [0.12, 0.2] },
		maps: {
			color: { image: colour.hash },
			normal: { image: normal.hash, convention: '-Y' },
			roughness: { image: orm.hash, component: 'g', invert: false },
			metalness: { image: orm.hash, component: 'b', invert: false }
		}
	});
	if (!recipeRead.success) throw new Error(JSON.stringify(recipeRead.issues));
	const recipe = recipeRead.recipe;
	const hash = await recipeHash(recipe);

	const textures = images.map((entry) => ({
		id: entry.id,
		name: entry.name,
		uri: `/project-assets/${entry.id}`
	}));
	const textureResources = images.map((entry) =>
		finishTextureResource({
			assetId: entry.id,
			pin: {
				hash: entry.hash,
				mime: entry.mime,
				size: entry.size,
				locator: `/project-assets/${entry.id}`
			} satisfies ResourcePin
		})
	) as (TypedResource | null)[];
	if (textureResources.some((resource) => resource === null)) {
		throw new Error('a brushed fixture image was not an admissible project image');
	}
	const installedTextureResources = textureResources as TypedResource[];

	const scene = createEmptyUnitSceneDocument();
	scene.textures = textures;
	scene.materials = [{ id: 'finish-d', name: 'D Brushed metal', base: { material: hash } }];
	scene.entities = [
		{
			kind: 'primitive',
			id: 'd-plinth',
			name: 'D Plinth',
			position: [0, 0.9, 0],
			rotation: [0, 0, 0],
			primitive: 'plane',
			dimensions: { width: 1.6, height: 1.6 },
			materialId: 'plaster-warm',
			materialInstanceId: 'finish-d',
			castShadow: false,
			receiveShadow: false
		}
	];
	const resources = {
		formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
		resources: [
			...installedTextureResources,
			{
				kind: 'material' as const,
				id: hash,
				contentRevision: hash,
				pin: null,
				unresolved: null,
				material: {
					recipe,
					images: images.map((entry) => ({ hash: entry.hash, source: { textureId: entry.id } }))
				}
			}
		]
	};
	const envelope = await createProjectEnvelope({
		id: 'project-d-gate',
		name: 'D visual gate',
		acceptedRevision: { projectId: 'project-d-gate', revisionId: 'gate-1' },
		dependencyLock: {
			formatVersion: 1,
			entries: [
				{
					domain: 'resource:material',
					subjectKind: 'resource',
					subjectId: hash,
					instancePath: [],
					contentRevision: hash,
					requiredCapabilities: [{ id: MATERIAL_CAPABILITY.id, version: MATERIAL_CAPABILITY.version }],
					pin: null
				}
			]
		},
		layout: { unitId: 'layout', data: createEmptyWallFirstLayoutDocument() },
		scene: { unitId: 'scene', data: scene },
		camera: { unitId: 'camera', data: createEmptyCameraPayload() },
		experience: { unitId: 'experience', data: createEmptyExperiencePayload() },
		resources: { unitId: 'resources', data: resources }
	});
	const admittedSource = validateProjectEnvelope(envelope);
	if (!admittedSource.success) throw new Error(`fixture did not validate: ${JSON.stringify(admittedSource.issues)}`);
	if (admittedSource.closure.length > 0) {
		throw new Error(`fixture closure: ${JSON.stringify(admittedSource.closure)}`);
	}

	// Save through the one serializer, then load the bytes in a fresh session.
	const saved = serializeProjectEnvelope(envelope);
	const loaded = await admitSourceJson(saved, {
		sessionEpoch: 'd-gate-cold',
		acceptedRevision: { projectId: 'project-d-gate', revisionId: 'gate-cold' }
	});
	if (loaded.kind !== 'admitted') throw new Error(`saved source did not admit: ${JSON.stringify(loaded)}`);
	const bytesByUri = new Map(
		images.map((entry) => [
			`/project-assets/${entry.id}`,
			{ bytes: entry.bytes, mime: entry.mime, sha256: entry.hash }
		])
	);
	const bundle = composeColdReleaseBundle({
		document: stageEnvelope(loaded.snapshot),
		manifest: { releaseId: 'release-d-gate', bytesByUri }
	});

	// The accepted B path: one catalogue base carrying the same effective
	// inputs through overrides. Its sampling plan must equal the resource-backed
	// plan; the pixel compare decides whether the two paths agree.
	const base = catalogueRecipe('plaster-warm');
	if (base === undefined) throw new Error('the catalogue base is missing');
	const oracle = {
		...recipe
	};
	const oracleScene: RuntimeScene = {
		...bundle.scene,
		materials: [
			{
				id: 'finish-d',
				name: 'B oracle',
				base: { catalogue: 'plaster-warm' },
				overrides: {
					color: oracle.color,
					roughness: oracle.roughness,
					metalness: oracle.metalness,
					occlusionStrength: oracle.occlusionStrength,
					normalScale: oracle.normalScale,
					mapping: oracle.mapping,
					maps: {
						color: { image: { textureId: colour.id } },
						normal: { image: { textureId: normal.id }, convention: '-Y' },
						roughness: { image: { textureId: orm.id }, component: 'g', invert: false },
						metalness: { image: { textureId: orm.id }, component: 'b', invert: false }
					}
				}
			}
		]
	};

	return {
		envelope,
		saved,
		scene: bundle.scene,
		oracleScene,
		sampled: {
			recipeHash: hash,
			images: images.map((entry) => entry.hash),
			maps: Object.keys(recipe.maps)
		},
		imageUris: new Map(images.map((entry) => [`/project-assets/${entry.id}`, entry.bytes])),
		dispose: () => bundle.dispose()
	};
}

export function sceneForCase(bundle: DGateBundle, label: 'd' | 'b'): RuntimeScene {
	return label === 'b' ? bundle.oracleScene : bundle.scene;
}
