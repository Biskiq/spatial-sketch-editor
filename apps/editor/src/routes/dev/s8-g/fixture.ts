/**
 * The G browser gate: save one accepted Finish, insert it twice, edit one
 * instance, delete the item and source, then cold-open the destination.
 *
 * The source project is E's real browser fixture, so the Finish and its three
 * images come through the ordinary authoring pipeline. The library transport is
 * an in-memory stand-in for the API's owner/bytes boundary; every F4 intent,
 * coordinator, serializer, cold admission and render description is the
 * product's. The gate reports no library call after the destination is built.
 */
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import type { AuthoringIntent, RuntimeScene, SemanticReference } from '@portfolio/project-model';
import { SCENE_FINISH_PATCH, SCENE_PALETTE_SLOT_ADD } from '@portfolio/project-model/scene-planning';
import {
	createEmptyCameraPayload,
	createEmptyExperiencePayload,
	createEmptyResourcePayload,
	createEmptyUnitSceneDocument,
	createProjectEnvelope,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import type { AuthoringIntent as Intent } from '@portfolio/project-model';
import { recipeHash, type Recipe } from '@portfolio/project-model/materials';
import { materialLibraryContentId } from '@portfolio/project-model/library';
import { createAcceptanceCoordinator } from '$lib/authoring/f4';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createMaterialProofRegistry } from '$lib/authoring/material-proof';
import {
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation,
	createUnitPlannerRegistry
} from '@portfolio/project-model/units';
import { admitSourceJson } from '$lib/authoring/stage/source-admission';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';
import { describeSceneRender } from '$lib/render/scene-render-description';
import { materialKey } from '$lib/render/resources/material-descriptor';
import { createSceneTargetAnalysis } from '$lib/render/materials/target-analysis';
import type {
	MaterialLibraryClient,
	MaterialLibrarySaveInput
} from '$lib/authoring/adapters/scene/library/material-client';
import { saveFinishToLibrary, insertFinishFromLibrary } from '$lib/authoring/adapters/scene/library/material';
import { buildEGate } from '../s8-e/fixture';

const SOURCE_PROJECT = 'project-e-gate';
const DESTINATION_PROJECT = 'project-g-gate';

type StoredItem = {
	readonly id: string;
	readonly contentId: string;
	readonly recipeHash: string;
	readonly payload: MaterialLibrarySaveInput['payload'];
	readonly images: ReadonlyMap<string, { readonly bytes: Uint8Array; readonly mime: string }>;
};

/** An owner-private in-memory library and vendor, not a URL server. */
function memoryLibrary(sourceBytes: ReadonlyMap<string, Uint8Array>) {
	const items = new Map<string, StoredItem>();
	const vendored = new Map<string, Uint8Array>();
	const textureByHash = new Map<string, string>();
	let calls = 0;
	const client: MaterialLibraryClient = {
		async list() {
			calls += 1;
			return [];
		},
		async read(item) {
			calls += 1;
			const stored = items.get(item.id);
			if (stored === undefined) throw new Error('library item not found');
			return { payload: stored.payload, contentId: stored.contentId, recipeHash: stored.recipeHash };
		},
		async save(input) {
			calls += 1;
			const id = `item-${input.operationId}`;
			const contentId = await materialLibraryContentId(input.payload);
			const pinnedRecipe = await recipeHash(input.payload.recipe);
			const images = new Map(
				input.images.flatMap((binding) => {
					if (!('textureId' in binding.source)) return [];
					const bytes = sourceBytes.get(binding.source.textureId);
					if (bytes === undefined) return [];
					return [[binding.hash, { bytes, mime: 'image/png' as const }] as const];
				})
			);
			const stored: StoredItem = {
				id,
				contentId,
				recipeHash: pinnedRecipe,
				payload: input.payload,
				images
			};
			items.set(id, stored);
			return {
				id,
				name: stored.payload.name,
				kind: 'material' as const,
				formatVersion: 1,
				contentId: stored.contentId,
				createdAt: '2026-11-21T00:00:00.000Z',
				recipeHash: stored.recipeHash,
				imageCount: stored.images.size,
				hasThumbnail: false
			};
		},
		async remove(id) {
			calls += 1;
			items.delete(id);
		},
		async thumbnail() {
			calls += 1;
			throw new Error('no derivative');
		},
		async putThumbnail() {
			calls += 1;
		},
		async transfer(item, _destinationProjectId, operationId) {
			calls += 1;
			const stored = items.get(item.id);
			if (stored === undefined) throw new Error('library item was removed during transfer');
			const images = stored.payload.recipe.maps;
			const hashes = [...new Set(Object.values(images).flatMap((binding) => binding === undefined ? [] : [binding.image]))];
			const transferred = hashes.map((hash) => {
				const image = stored.images.get(hash);
				if (image === undefined) throw new Error('library image bytes are missing');
				let textureId = textureByHash.get(hash);
				if (textureId === undefined) {
					textureId = crypto.randomUUID();
					textureByHash.set(hash, textureId);
					vendored.set(textureId, image.bytes);
				}
				return { hash, source: { textureId }, mime: image.mime, byteSize: image.bytes.length, name: 'library.png' };
			});
			return {
				itemId: stored.id,
				contentId: stored.contentId,
				finishId: `finish-${operationId}`,
				name: stored.payload.name,
				recipe: stored.payload.recipe as Recipe,
				recipeHash: stored.recipeHash,
				images: transferred,
				savedBase: null
			};
		}
	};
	return { client, items, vendored, calls: () => calls, resetCalls: () => (calls = 0) };
}

/** Replace local texture ids with their pinned hashes, so two projects' equal
 * bytes and equal sampling plan produce the same key. */
function normalizedMaterialKey(source: ProjectEnvelope, key: string): string {
	let normalized = key;
	for (const resource of source.units.resources.data.resources) {
		if (resource.kind !== 'texture' || resource.pin === null) continue;
		normalized = normalized.split(encodeURIComponent(resource.id)).join(resource.pin.hash);
	}
	return normalized;
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

function destinationEnvelope(): Promise<ProjectEnvelope> {
	const scene = createEmptyUnitSceneDocument();
	scene.entities = [
		{
			kind: 'primitive',
			id: 'g-plane-a',
			name: 'A',
			position: [-0.9, 0.9, 0],
			rotation: [0, 0, 0],
			primitive: 'plane',
			dimensions: { width: 1.4, height: 1.4 },
			materialId: 'plaster-warm',
			castShadow: false,
			receiveShadow: false
		},
		{
			kind: 'primitive',
			id: 'g-plane-b',
			name: 'B',
			position: [0.9, 0.9, 0],
			rotation: [0, 0, 0],
			primitive: 'plane',
			dimensions: { width: 1.4, height: 1.4 },
			materialId: 'plaster-warm',
			castShadow: false,
			receiveShadow: false
		}
	];
	return createProjectEnvelope({
		id: DESTINATION_PROJECT,
		name: 'G destination gate',
		acceptedRevision: { projectId: DESTINATION_PROJECT, revisionId: 'gate-0' },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: 'layout', data: createEmptyWallFirstLayoutDocument() },
		scene: { unitId: 'scene', data: scene },
		camera: { unitId: 'camera', data: createEmptyCameraPayload() },
		experience: { unitId: 'experience', data: createEmptyExperiencePayload() },
		resources: { unitId: 'resources', data: createEmptyResourcePayload() }
	});
}

async function coordinatorFor(project: ProjectEnvelope, sessionEpoch = 'g-gate') {
	const admitted = await admitSourceJson(serializeProjectEnvelope(project), {
		sessionEpoch,
		acceptedRevision: { projectId: project.id, revisionId: 'gate-1' }
	});
	if (admitted.kind !== 'admitted') throw new Error(`G project ${project.id} did not admit: ${JSON.stringify(admitted)}`);
	const baseline = stageEnvelope(admitted.snapshot);
	const planners: unknown[] = [];
	const materialProofs = createMaterialProofRegistry();
	const holder: { current: () => ProjectEnvelope } = { current: () => baseline };
	const targetAnalysis = createSceneTargetAnalysis({
		read: () => {
			const source = holder.current();
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
				modelDigest: () => null
			};
		},
		models: () => null
	});
	createAdapter({
		materialProofs,
		targetAnalysis,
		authoring: { registerPlanner: (planner: unknown) => (planners.push(planner), { kind: 'registered' }) }
	} as never);
	const registry = createUnitPlannerRegistry<ProjectEnvelope>({ resourceStaging: true });
	let ordinal = 1;
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: createUnitAcceptanceAdapter({ compound: true, resourceStaging: true }),
		preparation: createUnitAcceptancePreparation({ registry, sessionEpoch, resourceStaging: true }),
		sessionEpoch,
		baseline: {
			revision: admitted.snapshot.acceptedRevision,
			source: baseline,
			canonicalJson: admitted.snapshot.canonicalJson,
			sourceContentId: admitted.snapshot.sourceContentId,
			blockingIssues: []
		},
		planners: planners as never,
		mintRevisionId: () => `gate-${++ordinal}`
	});
	holder.current = () => coordinator.current().source;
	return { coordinator, materialProofs };
}

export type GGateReport = Record<string, unknown> & { readonly ok: boolean };

async function sha256Text(text: string): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
	return `sha256-${[...digest].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export async function buildGGate(): Promise<GGateReport> {
	const sourceBundle = await buildEGate('auto');
	let sourceDisposed = false;
	try {
		const sourceAdmitted = await admitSourceJson(sourceBundle.saved, {
			sessionEpoch: 'g-source-cold',
			acceptedRevision: { projectId: SOURCE_PROJECT, revisionId: 'g-source-1' }
		});
		if (sourceAdmitted.kind !== 'admitted') throw new Error('G source did not admit');
		let source: ProjectEnvelope | null = stageEnvelope(sourceAdmitted.snapshot);
		const finish = source.units.scene.data.materials.find((entry) => entry.name === 'Brushed');
		if (finish === undefined) throw new Error('G source Finish is missing');

		const sourceState = await coordinatorFor(source, 'g-source');
		const sourceCoordinator = sourceState.coordinator;
		const paletteAdded = await sourceCoordinator.accept({
			version: 1,
			kind: SCENE_PALETTE_SLOT_ADD,
			operationId: 'gate-palette-add',
			expectedRevision: sourceCoordinator.acceptedRevision(),
			targets: [],
			payload: { color: '#d8b48a' } as AuthoringIntent['payload'],
			capturedInputs: [],
			allocatedIds: [{ kind: 'scene-palette-slot', id: 'palette-warm' }]
		});
		if (paletteAdded.kind !== 'accepted') throw new Error(`G palette add refused: ${JSON.stringify(paletteAdded)}`);
		const paletteFollowed = await sourceCoordinator.accept({
			version: 1,
			kind: SCENE_FINISH_PATCH,
			operationId: 'gate-follow-palette',
			expectedRevision: sourceCoordinator.acceptedRevision(),
			targets: [],
			payload: {
				finish: { project: finish.id },
				mode: 'in-place',
				selectedUsers: ['entity:e-plane'],
				expectedUsers: ['entity:e-plane'],
				edits: [{ field: 'color', op: 'set', value: { slot: 'palette-warm' } }]
			} as AuthoringIntent['payload'],
			capturedInputs: [],
			allocatedIds: []
		});
		if (paletteFollowed.kind !== 'accepted') throw new Error(`G palette follow refused: ${JSON.stringify(paletteFollowed)}`);

		let sourceWithPalette: ProjectEnvelope | null = sourceCoordinator.current().source;
		const sourcePaletteSlot = sourceWithPalette.units.scene.data.palette?.find((slot) => slot.id === 'palette-warm');
		if (sourcePaletteSlot === undefined || sourcePaletteSlot.color !== '#d8b48a') {
			throw new Error('G source envelope did not carry the palette slot');
		}
		const updatedFinish = sourceWithPalette.units.scene.data.materials.find((entry) => entry.id === finish.id);
		if (
			updatedFinish === undefined ||
			updatedFinish.overrides?.color === undefined ||
			typeof updatedFinish.overrides.color !== 'object' ||
			updatedFinish.overrides.color.slot !== 'palette-warm'
		) {
			throw new Error('G source Finish did not carry overrides.color = { slot: "palette-warm" }');
		}

		const sourceBytes = new Map(sourceBundle.bytes);
		const sourcePins = new Map(
			sourceWithPalette.units.resources.data.resources
				.filter((resource) => resource.kind === 'texture' && resource.pin !== null)
				.map((resource) => [resource.id, { hash: resource.pin!.hash, mime: resource.pin!.mime, size: resource.pin!.size }])
		);
		const sourceBytesByUri = new Map(
			sourceWithPalette.units.scene.data.textures.map((texture) => {
				const bytes = sourceBytes.get(texture.id);
				if (bytes === undefined) throw new Error(`G source lost ${texture.id}`);
				return [texture.uri, { bytes, mime: 'image/png' as const, sha256: sourcePins.get(texture.id)!.hash }];
			})
		);
		const sourceColdBundle = composeColdReleaseBundle({
			document: sourceWithPalette,
			manifest: { releaseId: 'release-g-source', bytesByUri: sourceBytesByUri }
		});
		let sourceKey: string;
		try {
			const sourceDescription = describeSceneRender(sourceColdBundle.scene);
			const sourceItem = sourceDescription.items.find((item) => item.id === 'e-plane');
			if (sourceItem === undefined) throw new Error('render description is missing source plane');
			sourceKey = normalizedMaterialKey(sourceWithPalette, materialKey(sourceItem.material));
		} finally {
			sourceColdBundle.dispose();
		}

		const library = memoryLibrary(sourceBytes);
		const saved = await saveFinishToLibrary({
			source: sourceWithPalette,
			finishId: finish.id,
			operationId: 'gate-save',
			client: library.client
		});
		if (!saved.ok) throw new Error(`G Save refused: ${JSON.stringify(saved.issues)}`);
		if (JSON.stringify(saved.draft.capturedFollowers) !== JSON.stringify(['palette-warm'])) {
			throw new Error(`expected capturedFollowers ['palette-warm'], got ${JSON.stringify(saved.draft.capturedFollowers)}`);
		}
		if (saved.draft.payload.recipe.color !== '#d8b48a') {
			throw new Error(`expected flattened literal color '#d8b48a', got ${String(saved.draft.payload.recipe.color)}`);
		}

		const destinationState = await coordinatorFor(await destinationEnvelope());
		const destination = destinationState.coordinator;
		const holder = { current: () => destination.current().source };
		const insert = (operationId: string, entityId: string) =>
			insertFinishFromLibrary({
				item: saved.summary,
				destinationProjectId: DESTINATION_PROJECT,
				operationId,
				targets: { entityIds: [entityId], surfaces: [] },
				client: library.client,
				signal: new AbortController().signal,
				host: {
					current: () => ({ source: holder.current(), revision: destination.acceptedRevision() }),
					accept: (intent: Intent) => destination.accept(intent) as never,
					entityReference,
					surfaceReference: () => {
						throw new Error('the G gate paints no surface');
					},
					materialProofs: destinationState.materialProofs
				}
			});
		const first = await insert('gate-insert-a', 'g-plane-a');
		if (!first.ok) throw new Error(`first insert refused: ${first.message}`);
		const second = await insert('gate-insert-b', 'g-plane-b');
		if (!second.ok) throw new Error(`second insert refused: ${second.message}`);
		if (first.finishId === second.finishId) throw new Error('two inserts shared one Finish id');

		const patched = await destination.accept({
			version: 1,
			kind: SCENE_FINISH_PATCH,
			operationId: 'gate-edit-a',
			expectedRevision: destination.acceptedRevision(),
			targets: [],
			payload: {
				finish: { project: first.finishId },
				mode: 'in-place',
				selectedUsers: ['entity:g-plane-a'],
				expectedUsers: ['entity:g-plane-a'],
				edits: [{ field: 'color', op: 'set', value: '#d08050' }]
			} as AuthoringIntent['payload'],
			capturedInputs: [],
			allocatedIds: []
		});
		if (patched.kind !== 'accepted') throw new Error(`edit refused: ${JSON.stringify(patched)}`);
		const afterEdit = holder.current();
		const finishA = afterEdit.units.scene.data.materials.find((entry) => entry.id === first.finishId);
		const finishB = afterEdit.units.scene.data.materials.find((entry) => entry.id === second.finishId);
		if (finishA === undefined || finishB === undefined) throw new Error('destination Finish is missing');
		if (JSON.stringify(finishA.overrides) === JSON.stringify(finishB.overrides)) {
			throw new Error('the independent edit did not stay independent');
		}

		const destinationJson = serializeProjectEnvelope(afterEdit);
		await library.client.remove(saved.summary.id);
		sourceBytes.clear();
		sourceBundle.dispose();
		sourceDisposed = true;
		source = null;
		sourceWithPalette = null;
		if (library.items.size !== 0) throw new Error('the library item survived removal');
		if (sourceBytes.size !== 0) throw new Error('the source bytes survived removal');
		library.resetCalls();
		const coldAdmitted = await admitSourceJson(destinationJson, {
			sessionEpoch: 'g-cold',
			acceptedRevision: { projectId: DESTINATION_PROJECT, revisionId: 'gate-cold' }
		});
		if (coldAdmitted.kind !== 'admitted') throw new Error(`destination did not cold-admit: ${JSON.stringify(coldAdmitted)}`);
		const cold = stageEnvelope(coldAdmitted.snapshot);
		const pins = new Map(
			cold.units.resources.data.resources
				.filter((resource) => resource.kind === 'texture' && resource.pin !== null)
				.map((resource) => [resource.id, { hash: resource.pin!.hash, mime: resource.pin!.mime, size: resource.pin!.size }])
		);
		const bytesByUri = new Map(
			cold.units.scene.data.textures.map((texture) => {
				const bytes = library.vendored.get(texture.id);
				if (bytes === undefined) throw new Error(`the destination lost ${texture.id}`);
				return [texture.uri, { bytes, mime: 'image/png' as const, sha256: pins.get(texture.id)!.hash }];
			})
		);
		const bundle = composeColdReleaseBundle({
			document: cold,
			manifest: { releaseId: 'release-g-gate', bytesByUri }
		});
		try {
			const destinationDescription = describeSceneRender(bundle.scene);
			const destinationItem = destinationDescription.items.find((item) => item.id === 'g-plane-b');
			if (destinationItem === undefined) throw new Error('render description is missing a plane');
			const destinationKey = normalizedMaterialKey(cold, materialKey(destinationItem.material));
			const definitions = cold.units.resources.data.resources.filter((resource) => resource.kind === 'material');
			const hashes = [...pins.values()].map((pin) => pin.hash).sort();
			const expected = saved.draft.images.map((image) => image.hash).sort();
			if (definitions.length !== 1) throw new Error(`expected one material definition, saw ${definitions.length}`);
			if (JSON.stringify(hashes) !== JSON.stringify(expected)) throw new Error('destination image hashes differ');
			if (sourceKey !== destinationKey) {
				throw new Error(`the unedited Finish does not resolve identically\nsource=${sourceKey}\ndestination=${destinationKey}`);
			}
			if (library.calls() !== 0) throw new Error('cold open called the library');
			return {
				ok: true,
				sourceFinishId: finish.id,
				finishIds: [first.finishId, second.finishId],
				capturedFollowers: saved.draft.capturedFollowers,
				independentEdit: true,
				sourceRemovedBeforeColdOpen: true,
				itemRemovedBeforeColdOpen: true,
				definitionCount: definitions.length,
				textureCount: cold.units.scene.data.textures.length,
				imageHashes: hashes,
				recipeHash: saved.summary.recipeHash,
				litDescriptorEqual: sourceKey === destinationKey,
				runtimeLibraryCalls: library.calls(),
				historyEntries: 3,
				savedBytes: destinationJson.length,
				savedHash: await sha256Text(destinationJson)
			};
		} finally {
			bundle.dispose();
		}
	} finally {
		if (!sourceDisposed) {
			sourceBundle.dispose();
			sourceDisposed = true;
		}
	}
}
