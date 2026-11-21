/**
 * Temporary T2.S8 D product-journey seed.
 *
 * Creates one cloud project through the real Save API, uploads the three image
 * bytes through the real asset API, then saves the same resource-backed Finish
 * shape the D gate draws. The editor then loads, saves and previews this project
 * through its own routes; nothing here participates in rendering.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { AcceptedSnapshot } from '@portfolio/project-model';
import {
	MATERIAL_CAPABILITY,
	readRecipe,
	recipeHash
} from '@portfolio/project-model/materials';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	UNIT_SAVE_SOURCE_KIND,
	UNIT_SAVE_SOURCE_VERSION,
	captureUnitSave,
	computeEnvelopeSourceContentId,
	createEmptyUnitEnvelope,
	createProjectEnvelope,
	serializeProjectEnvelope,
	validateProjectEnvelope,
	type ProjectEnvelope,
	type ResourcePin,
	type TypedResource
} from '@portfolio/project-model/units';
import { finishTextureResource } from '@portfolio/project-model/scene-planning';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';

const apiOrigin = (process.env.JOURNEY_API_ORIGIN ?? 'http://localhost:44075').replace(/\/+$/, '');
const editorOrigin = process.env.JOURNEY_EDITOR_ORIGIN ?? 'http://localhost:5178';
const username = process.env.JOURNEY_USERNAME ?? `s8journey${randomUUID().slice(0, 8)}`;
const password = process.env.JOURNEY_PASSWORD ?? 'JourneyPass123';

const projectId = `project:${randomUUID()}`;
const projectName = 'D resource journey';
const projectAssets = resolve(import.meta.dirname, '../static/s8-fixtures');
const images = [
	{ name: 'Journey colour', file: 'swatch-rgba.png' },
	{ name: 'Journey normal', file: 'normal-minus-y.png' },
	{ name: 'Journey ORM', file: 'orm-distinct.png' }
] as const;

type Session = { cookie: string; userId: string };
type Json = Record<string, unknown>;

async function login(): Promise<Session> {
	const response = await fetch(`${apiOrigin}/auth/register`, {
		method: 'POST',
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			Origin: editorOrigin
		},
		body: JSON.stringify({ username, password })
	});
	if (!response.ok) throw new Error(`register failed: ${response.status} ${await response.text()}`);
	const body = (await response.json()) as { user?: { id?: string } };
	const raw = response.headers.get('set-cookie') ?? '';
	const cookie = raw.split(';', 1)[0] ?? '';
	if (!cookie.startsWith('museum-editor-session=') || !body.user?.id) throw new Error('register returned no session');
	return { cookie, userId: body.user.id };
}

async function request(
	session: Session,
	method: string,
	path: string,
	body?: BodyInit,
	contentType?: string
): Promise<Response> {
	const headers: Record<string, string> = { Origin: editorOrigin, Cookie: session.cookie };
	if (contentType) headers['content-type'] = contentType;
	const response = await fetch(`${apiOrigin}${path}`, { method, headers, body });
	if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${await response.text()}`);
	return response;
}

async function captureFor(envelope: ProjectEnvelope, operationId: string, precondition: Record<string, unknown>) {
	const snapshot = {
		acceptedRevision: envelope.acceptedRevision,
		sourceContentId: await computeEnvelopeSourceContentId(envelope),
		sourceKind: UNIT_SAVE_SOURCE_KIND,
		sourceVersion: UNIT_SAVE_SOURCE_VERSION,
		domain: { source: envelope }
	} as unknown as AcceptedSnapshot<ProjectEnvelope>;
	const captured = await captureUnitSave({
		snapshot,
		operationId,
		precondition: precondition as never
	});
	if (captured.kind !== 'captured') throw new Error(`capture refused: ${JSON.stringify(captured)}`);
	return captured.capture;
}

async function save(
	session: Session,
	envelope: ProjectEnvelope,
	operationId: string,
	precondition: Record<string, unknown>
) {
	const capture = await captureFor(envelope, operationId, precondition);
	const response = await request(
		session,
		'PUT',
		`/projects/${encodeURIComponent(projectId)}`,
		JSON.stringify({ contentIdentityScheme: 'project-model/canonical-authored-json@1', capture }),
		'application/json'
	);
	return (await response.json()) as Json;
}

async function upload(
	session: Session,
	name: string,
	bytes: Uint8Array
): Promise<{ id: string; sha256: string; byteSize: number }> {
	const registered = (await (
		await request(
			session,
			'POST',
			`/projects/${encodeURIComponent(projectId)}/assets`,
			JSON.stringify({ name }),
			'application/json'
		)
	).json()) as Json;
	if (typeof registered.id !== 'string') throw new Error('asset registration returned no id');
	const uploaded = (await (
		await request(
			session,
			'PUT',
			`/projects/${encodeURIComponent(projectId)}/assets/${encodeURIComponent(registered.id)}/content`,
			bytes,
			'application/octet-stream'
		)
	).json()) as Json;
	if (typeof uploaded.sha256 !== 'string' || typeof uploaded.byteSize !== 'number') {
		throw new Error(`asset upload returned no pin: ${JSON.stringify(uploaded)}`);
	}
	return { id: registered.id, sha256: uploaded.sha256, byteSize: uploaded.byteSize };
}

const session = await login();

// 1. A blank project through the only Save API, so assets have an owner row.
const blank = await createEmptyUnitEnvelope({
	id: projectId,
	name: projectName,
	acceptedRevision: { projectId, revisionId: 'journey-blank' }
});
const blankSaved = await save(session, blank, `journey-blank-${randomUUID()}`, { kind: 'create-only' });
const savedBaseToken = blankSaved.savedBaseToken;
if (typeof savedBaseToken !== 'string') throw new Error('blank save returned no saved base token');

// 2. Three real PNGs through the real asset registry and object store.
const uploaded = [];
for (const [index, image] of images.entries()) {
	const bytes = new Uint8Array(readFileSync(resolve(projectAssets, image.file)));
	const asset = await upload(session, image.name, bytes);
	uploaded.push({ ...asset, index });
}
if (uploaded.length !== 3) throw new Error('expected three uploaded images');

const textureResources = uploaded.map((image) =>
	finishTextureResource({
		assetId: image.id,
		pin: {
			hash: image.sha256,
			mime: 'image/png',
			size: image.byteSize,
			locator: `/project-assets/${image.id}`
		} satisfies ResourcePin
	})
);
if (textureResources.some((resource) => resource === null)) throw new Error('a texture resource was refused');
const installedTextures = textureResources as TypedResource[];

const colour = uploaded[0]!;
const normal = uploaded[1]!;
const orm = uploaded[2]!;
const recipeRead = readRecipe({
	profile: 'pbr-metallic-roughness/v1',
	color: '#cfd3d8',
	roughness: 0.38,
	metalness: 0.55,
	occlusionStrength: 1,
	normalScale: 1,
	mapping: { kind: 'uv', set: 0, repeat: [1, 1], rotation: 0.35, offset: [0.12, 0.2] },
	maps: {
		color: { image: colour.sha256 },
		normal: { image: normal.sha256, convention: '-Y' },
		roughness: { image: orm.sha256, component: 'g', invert: false },
		metalness: { image: orm.sha256, component: 'b', invert: false }
	}
});
if (!recipeRead.success) throw new Error(JSON.stringify(recipeRead.issues));
const recipe = recipeRead.recipe;
const hash = await recipeHash(recipe);

const textures = uploaded.map((image, index) => ({
	id: image.id,
	name: images[index]!.name,
	uri: `/project-assets/${image.id}`
}));
const scene = {
	formatVersion: SCENE_UNIT_FORMAT_VERSION,
	textures,
	materials: [{ id: 'finish-d', name: 'D Brushed metal', base: { material: hash } }],
	entities: [
		{
			kind: 'primitive' as const,
			id: 'd-plinth',
			name: 'D Plinth',
			position: [0, 0.9, 0] as [number, number, number],
			rotation: [0, 0, 0] as [number, number, number],
			primitive: 'plane' as const,
			dimensions: { width: 1.6, height: 1.6 },
			materialId: 'plaster-warm',
			materialInstanceId: 'finish-d',
			castShadow: false,
			receiveShadow: false
		}
	]
};
const view = {
	id: 'view-d',
	label: 'Finished plinth',
	eye: [0, 1.6, 3] as [number, number, number],
	target: [0, 0.9, 0] as [number, number, number],
	fov: 54,
	connectedViewIds: [] as string[]
};
const experience = {
	formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
	experiences: [
		{
			id: 'experience-d',
			label: 'D Preview',
			welcome: null,
			// One entry Guide makes the head Preview enter the finished Scene
			// directly; the visitor still uses the product Preview surface.
			entryGuideId: 'guide-d',
			presentations: [
				{
					id: 'presentation-d',
					label: 'Finished plinth',
					views: [{ viewId: view.id }],
					subject: null,
					text: { kind: 'plain' as const, body: 'The resource-backed brushed-metal Finish.' },
					explorable: true
				}
			],
			stops: [
				{
					id: 'stop-d',
					presentationId: 'presentation-d',
					entryViewId: null,
					staySeconds: 4,
					invitation: null
				}
			],
			guides: [{ id: 'guide-d', label: 'Main', stopIds: ['stop-d'], pacing: 'automatic' as const }],
			detours: []
		}
	]
};
const resources = {
	formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
	resources: [
		...installedTextures,
		{
			kind: 'material' as const,
			id: hash,
			contentRevision: hash,
			pin: null,
			unresolved: null,
			material: {
				recipe,
				images: uploaded.map((image) => ({ hash: image.sha256, source: { textureId: image.id } }))
			}
		}
	]
};
const finalEnvelope = await createProjectEnvelope({
	id: projectId,
	name: projectName,
	acceptedRevision: { projectId, revisionId: 'journey-final' },
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
	layout: { unitId: `${projectId}:layout`, data: createEmptyWallFirstLayoutDocument() },
	scene: { unitId: `${projectId}:scene`, data: scene },
	camera: {
		unitId: `${projectId}:camera`,
		data: { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: [view], connections: [] }
	},
	experience: { unitId: `${projectId}:experience`, data: experience },
	resources: { unitId: `${projectId}:resources`, data: resources }
});
const validation = validateProjectEnvelope(finalEnvelope);
if (!validation.success) throw new Error(`final envelope invalid: ${JSON.stringify(validation.issues)}`);
if (validation.closure.length > 0) throw new Error(`final closure: ${JSON.stringify(validation.closure)}`);
const finalSaved = await save(session, finalEnvelope, `journey-final-${randomUUID()}`, {
	kind: 'expected-saved-base',
	token: savedBaseToken
});

const result = {
	projectId,
	projectName,
	apiOrigin,
	editorOrigin,
	userId: session.userId,
	username,
	password,
	cookie: session.cookie,
	savedBaseToken,
	version: finalSaved.version,
	assetIds: uploaded.map((image) => image.id),
	imageHashes: uploaded.map((image) => image.sha256),
	imageSizes: uploaded.map((image) => image.byteSize),
	recipeHash: hash,
	sceneRevision: finalEnvelope.units.scene.header.contentRevision,
	savedBytes: serializeProjectEnvelope(finalEnvelope).length,
	captureJson: serializeProjectEnvelope(finalEnvelope)
};
writeFileSync('/tmp/s8-d-journey-project.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, captureJson: undefined }, null, 2));
