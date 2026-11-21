/**
 * The E browser gate fixture: one correctable set, accepted through the
 * ordinary authoring adapter, then saved, cold-admitted and drawn.
 *
 * Every step runs in the browser on real bytes: the set's PNGs are drawn on a
 * canvas, hashed and probed by `readSetFileFacts`, grouped by
 * `proposeMaterialSet`, lowered and digested by `prepareDraft`, and registered
 * by `acceptDraft` through the real Scene adapter, target analysis and F4
 * coordinator. Only P20 is an in-memory stand-in (no server is involved). The
 * accepted envelope is then saved through the one serializer, admitted in a
 * fresh session and composed into the cold release bundle the page draws.
 *
 * `auto` accepts the recognised set (files shuffled), `manual` assembles the
 * same draft by hand, and `edited` accepts the set and then applies one typed
 * patch (a tint and a disabled normal map) as a second history entry.
 */
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import type { AuthoringIntent, RuntimeScene, SemanticReference } from '@portfolio/project-model';
import {
	draftFromCandidate,
	proposeMaterialSet,
	type DraftEdits
} from '@portfolio/project-model/material-authoring';
import type { Mapping } from '@portfolio/project-model/materials';
import { SCENE_FINISH_PATCH } from '@portfolio/project-model/scene-planning';
import {
	createEmptyCameraPayload,
	createEmptyExperiencePayload,
	createEmptyResourcePayload,
	createEmptyUnitSceneDocument,
	createProjectEnvelope,
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation,
	createUnitPlannerRegistry,
	serializeProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';
import { createAcceptanceCoordinator } from '$lib/authoring/f4';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createMaterialProofRegistry } from '$lib/authoring/material-proof';
import {
	acceptDraft,
	prepareDraft,
	readSetFileFacts,
	type SetFileInput
} from '$lib/authoring/materials/material-set';
import type { ImportedProjectImage } from '$lib/authoring/artwork/project-artwork';
import type { ProjectApi } from '$lib/platform/project-persistence';
import { admitSourceJson } from '$lib/authoring/stage/source-admission';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { createSceneTargetAnalysis } from '$lib/render/materials/target-analysis';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';

export type EGateCase = 'auto' | 'manual' | 'edited';

const SIZE = 256;
const PROJECT = 'project-e-gate';
const MAPPING: Mapping = { kind: 'uv', set: 0, repeat: [1, 1], rotation: 0.35, offset: [0.12, 0.2] };

function hex(bytes: ArrayBuffer): string {
	return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

async function sha(bytes: Uint8Array): Promise<string> {
	return `sha256-${hex(await crypto.subtle.digest('SHA-256', bytes as BufferSource))}`;
}

async function png(draw: (context: OffscreenCanvasRenderingContext2D, size: number) => void): Promise<Uint8Array> {
	const canvas = new OffscreenCanvas(SIZE, SIZE);
	const context = canvas.getContext('2d');
	if (context === null) throw new Error('the E gate needs a 2D canvas');
	draw(context, SIZE);
	return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer());
}

/** The creator's set: a brushed colour, a packed ORM and a DirectX normal. */
async function brushedSet(): Promise<SetFileInput[]> {
	const colour = await png((context, size) => {
		for (let x = 0; x < size; x += 1) {
			const value = 172 + Math.round(48 * Math.sin((x * Math.PI * 2) / 24));
			context.fillStyle = `rgb(${value + 8}, ${value + 12}, ${value + 18})`;
			context.fillRect(x, 0, 1, size);
		}
	});
	const normal = await png((context, size) => {
		context.fillStyle = 'rgb(128, 128, 255)';
		context.fillRect(0, 0, size, size);
		for (let x = 0; x < size; x += 1) {
			context.fillStyle = `rgb(${128 + Math.round(10 * Math.sin((x * Math.PI * 2) / 24))}, 128, 255)`;
			context.fillRect(x, 0, 1, size);
		}
	});
	const orm = await png((context, size) => {
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
	const file = (key: string, name: string, bytes: Uint8Array): SetFileInput => ({
		key,
		file: new File([bytes as BlobPart], name, { type: 'image/png' })
	});
	return [
		file('colour', 'Brushed_BaseColor_1k.png', colour),
		file('orm', 'Brushed_ORM_1k.png', orm),
		file('normal', 'Brushed_NormalDX_1k.png', normal)
	];
}

const MANUAL: DraftEdits = {
	name: 'Brushed',
	mapping: MAPPING,
	roles: {
		color: { role: 'color', file: 'colour' },
		normal: { role: 'normal', file: 'normal', convention: '-Y' },
		occlusion: { role: 'occlusion', file: 'orm', component: 'r', invert: false },
		roughness: { role: 'roughness', file: 'orm', component: 'g', invert: false },
		metalness: { role: 'metalness', file: 'orm', component: 'b', invert: false }
	}
};

function uuidOf(hash: string): string {
	const value = hash.slice('sha256-'.length);
	return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-8${value.slice(17, 20)}-${value.slice(20, 32)}`;
}

export type EGateBundle = {
	readonly label: EGateCase;
	readonly saved: string;
	readonly savedHash: string;
	readonly scene: RuntimeScene;
	readonly pins: ReadonlyMap<string, { hash: string; mime: string; size: number }>;
	readonly bytes: ReadonlyMap<string, Uint8Array>;
	readonly report: Record<string, unknown>;
	dispose(): void;
};

export async function buildEGate(label: EGateCase): Promise<EGateBundle> {
	const scene = createEmptyUnitSceneDocument();
	scene.entities = [{
		kind: 'primitive',
		id: 'e-plane',
		name: 'E Plane',
		position: [0, 0.9, 0],
		rotation: [0, 0, 0],
		primitive: 'plane',
		dimensions: { width: 1.6, height: 1.6 },
		materialId: 'plaster-warm',
		castShadow: false,
		receiveShadow: false
	}];
	const project = await createProjectEnvelope({
		id: PROJECT,
		name: 'E browser gate',
		acceptedRevision: { projectId: PROJECT, revisionId: 'gate-0' },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: 'layout', data: createEmptyWallFirstLayoutDocument() },
		scene: { unitId: 'scene', data: scene },
		camera: { unitId: 'camera', data: createEmptyCameraPayload() },
		experience: { unitId: 'experience', data: createEmptyExperiencePayload() },
		resources: { unitId: 'resources', data: createEmptyResourcePayload() }
	});
	const materialProofs = createMaterialProofRegistry();
	const admitted = await admitSourceJson(serializeProjectEnvelope(project), {
		sessionEpoch: 'e-gate',
		acceptedRevision: { projectId: PROJECT, revisionId: 'gate-1' },
		materialProofs
	});
	if (admitted.kind !== 'admitted') throw new Error(`gate source did not admit: ${JSON.stringify(admitted)}`);
	const baseline = stageEnvelope(admitted.snapshot);

	// The real Scene adapter, target analysis and F4 coordinator.
	const holder: { current?: () => ProjectEnvelope } = {};
	const targetAnalysis = createSceneTargetAnalysis({
		read: () => {
			const source = holder.current?.() ?? baseline;
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
	const planners: unknown[] = [];
	createAdapter({
		materialProofs,
		targetAnalysis,
		authoring: { registerPlanner: (planner: unknown) => (planners.push(planner), { kind: 'registered' }) }
	} as never);
	const registry = createUnitPlannerRegistry<ProjectEnvelope>({ resourceStaging: true });
	let ordinal = 1;
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: createUnitAcceptanceAdapter({ compound: true, resourceStaging: true }),
		preparation: createUnitAcceptancePreparation({ registry, sessionEpoch: 'e-gate', resourceStaging: true }),
		sessionEpoch: 'e-gate',
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

	// The creator's files, in a different order for the automatic case.
	const set = await brushedSet();
	const files = label === 'manual' ? set : [set[2]!, set[0]!, set[1]!];
	const controller = new AbortController();
	const session = await readSetFileFacts(files, controller.signal);
	const proposal = proposeMaterialSet(session.facts, coordinator.acceptedRevision().revisionId);
	let edits: DraftEdits = MANUAL;
	if (label !== 'manual') {
		const lowered = draftFromCandidate(proposal.candidates[0]!, { name: 'Brushed', mapping: MAPPING });
		if (!lowered.ok) throw new Error(`proposal did not lower: ${JSON.stringify(lowered.issues)}`);
		edits = lowered.edits;
	}
	const prepared = await prepareDraft(edits, session, coordinator.acceptedRevision(), controller.signal, materialProofs);
	if (!prepared.ok) throw new Error(`draft did not prepare: ${JSON.stringify(prepared.issues)}`);

	// P20, in memory: identical bytes reserve one id.
	const stored = new Map<string, Uint8Array>();
	const uploads: string[] = [];
	const importImage = (async (_api: ProjectApi, _project: string, input: File, signal: AbortSignal) => {
		const bytes = new Uint8Array(await input.arrayBuffer());
		signal.throwIfAborted();
		const hash = await sha(bytes);
		const assetId = uuidOf(hash);
		if (!stored.has(assetId)) uploads.push(input.name);
		stored.set(assetId, bytes);
		const image: ImportedProjectImage = {
			assetId, name: input.name, pixelWidth: SIZE, pixelHeight: SIZE, mime: 'image/png', byteSize: bytes.length, sha256: hash
		};
		return image;
	}) as never;
	const entityReference = (source: ProjectEnvelope, id: string): SemanticReference => ({
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: source.units.scene.header.contentRevision },
		subject: { kind: 'entity', id },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	});
	const accepted = await acceptDraft(prepared.draft, { entityIds: ['e-plane'], surfaces: [] }, 'brushed', controller.signal, {
		api: {} as ProjectApi,
		projectId: PROJECT,
		current: () => ({ source: coordinator.current().source, revision: coordinator.acceptedRevision() }),
		accept: (intent) => coordinator.accept(intent) as never,
		targetAnalysis,
		entityReference,
		surfaceReference: () => {
			throw new Error('the E gate paints no surface');
		},
		importImage
	});
	if (!accepted.ok) throw new Error(`draft was not accepted: ${accepted.code} ${accepted.message}`);
	let historyEntries = 1;

	if (label === 'edited') {
		const patched = await coordinator.accept({
			version: 1,
			kind: SCENE_FINISH_PATCH,
			operationId: 'tint-and-flatten',
			expectedRevision: coordinator.acceptedRevision(),
			targets: [],
			payload: {
				finish: { project: accepted.finishId },
				mode: 'in-place',
				selectedUsers: ['entity:e-plane'],
				expectedUsers: ['entity:e-plane'],
				edits: [
					{ field: 'color', op: 'set', value: '#d08050' },
					{ field: 'maps.normal', op: 'disable' }
				]
			} as AuthoringIntent['payload'],
			capturedInputs: [],
			allocatedIds: []
		});
		if (patched.kind !== 'accepted') throw new Error(`patch was refused: ${JSON.stringify(patched)}`);
		historyEntries += 1;
	}

	// Save, admit in a fresh session, compose the cold release bundle.
	const saved = serializeProjectEnvelope(coordinator.current().source);
	const loaded = await admitSourceJson(saved, {
		sessionEpoch: 'e-gate-cold',
		acceptedRevision: { projectId: PROJECT, revisionId: 'gate-cold' }
	});
	if (loaded.kind !== 'admitted') throw new Error(`saved source did not admit: ${JSON.stringify(loaded)}`);
	const cold = stageEnvelope(loaded.snapshot);
	const pins = new Map(
		cold.units.resources.data.resources
			.filter((resource) => resource.kind === 'texture' && resource.pin !== null)
			.map((resource) => [resource.id, { hash: resource.pin!.hash, mime: resource.pin!.mime, size: resource.pin!.size }])
	);
	const bytesByUri = new Map(
		cold.units.scene.data.textures.map((texture) => {
			const bytes = stored.get(texture.id);
			if (bytes === undefined) throw new Error(`no stored bytes for ${texture.id}`);
			return [texture.uri, { bytes, mime: 'image/png' as const, sha256: pins.get(texture.id)!.hash }];
		})
	);
	const bundle = composeColdReleaseBundle({
		document: cold,
		manifest: { releaseId: `release-e-${label}`, bytesByUri }
	});
	const finish = cold.units.scene.data.materials.find((instance) => instance.id === accepted.finishId)!;
	session.release();
	return {
		label,
		saved,
		savedHash: await sha(new TextEncoder().encode(saved)),
		scene: bundle.scene,
		pins,
		bytes: stored,
		report: {
			fileOrder: files.map((entry) => entry.file.name),
			proposal: proposal.candidates.map((candidate) => ({
				stem: candidate.stem,
				roles: candidate.roleChoices.map((choice) => `${choice.role}:${choice.file}${choice.component === undefined ? '' : `.${choice.component}`}${choice.convention === undefined ? '' : ` ${choice.convention}`}`),
				conflicts: candidate.conflicts.length,
				unassigned: candidate.unassigned.length,
				warnings: candidate.warnings.map((warning) => warning.code)
			})),
			recipeHash: prepared.draft.recipeHash,
			finishId: accepted.finishId,
			finish,
			uploads,
			historyEntries,
			undoAvailable: coordinator.canUndo(),
			textures: cold.units.scene.data.textures.length,
			resources: cold.units.resources.data.resources.map((resource) => resource.kind)
		},
		dispose: () => bundle.dispose()
	};
}
