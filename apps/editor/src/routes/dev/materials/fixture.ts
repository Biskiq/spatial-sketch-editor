/**
 * The E7 inspection fixture: a real project, built in the browser.
 *
 * A sphere away from the origin, a Daylight Sky and a Point light are admitted
 * from source. The chart set then goes through the real proposal, draft,
 * acceptance and cold-admission path (only P20 is in memory). The same verified
 * session also yields provisional drafts; none of them is ever accepted.
 */
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import type { RuntimeScene, SemanticReference } from '@portfolio/project-model';
import {
	draftFromCandidate,
	proposeMaterialSet,
	type DraftEdits
} from '@portfolio/project-model/material-authoring';
import type { Mapping } from '@portfolio/project-model/materials';
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
	skyFromPreset,
	type ProjectEnvelope,
	type SceneSky
} from '@portfolio/project-model/units';
import { createAcceptanceCoordinator } from '$lib/authoring/f4';
import { createAdapter } from '$lib/authoring/adapters/scene.adapter';
import { createMaterialProofRegistry } from '$lib/authoring/material-proof';
import {
	acceptDraft,
	prepareDraft,
	readSetFileFacts,
	type PreparedFinishDraft,
	type SetFileInput
} from '$lib/authoring/materials/material-set';
import type { ImportedProjectImage } from '$lib/authoring/artwork/project-artwork';
import type { ProjectApi } from '$lib/platform/project-persistence';
import { admitSourceJson } from '$lib/authoring/stage/source-admission';
import { stageEnvelope } from '$lib/authoring/stage/unit-stage-source';
import { S8_CHART_FIXTURES } from '$lib/dev/s8-fidelity-metrics';
import { createSceneTargetAnalysis } from '$lib/render/materials/target-analysis';
import type { InspectionSubject } from '$lib/render/materials/inspection-subject';
import type { WorldEnvironmentFrame } from '$lib/render/world-environment';
import {
	createProjectTextureScope,
	type ProjectTextureScope
} from '$lib/render/resources/project-texture-scope';
import { composeColdReleaseBundle } from '$lib/visitor/visitor-cold-runtime';

const PROJECT = 'project-e7-inspection';
const SPHERE = 'e7-sphere';
const IDENTITY = { kind: 'uv', set: 0, repeat: [1, 1], rotation: 0, offset: [0, 0] } as const satisfies Mapping;

/** Away from the origin, so an untranslated World light cannot pass. */
export const INSPECTION_ANCHOR = [2.5, 1.1, -1.75] as const;

async function sha(bytes: Uint8Array): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource));
	return `sha256-${[...digest].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function uuidOf(hash: string): string {
	const value = hash.slice('sha256-'.length);
	return `${value.slice(0, 8)}-${value.slice(8, 12)}-4${value.slice(13, 16)}-8${value.slice(17, 20)}-${value.slice(20, 32)}`;
}

export type InspectionFixture = {
	readonly scene: RuntimeScene;
	readonly sky: SceneSky;
	readonly frame: WorldEnvironmentFrame;
	readonly revision: string;
	readonly finish: InspectionSubject & { kind: 'finish' };
	readonly scope: ProjectTextureScope;
	readonly drafts: {
		readonly corrected: PreparedFinishDraft;
		readonly metalSmooth: PreparedFinishDraft;
		readonly metalRough: PreparedFinishDraft;
		/** The ±Y charts, each read under both conventions. */
		readonly normals: Readonly<Record<'plus' | 'minus', Readonly<Record<'+Y' | '-Y', PreparedFinishDraft>>>>;
		readonly halfMetre: PreparedFinishDraft;
		readonly twiceUv: PreparedFinishDraft;
		readonly oneMetre: PreparedFinishDraft;
		readonly secondUv: PreparedFinishDraft;
		/** A normal on the absent UV1 beside a roughness on UV0. */
		readonly mixedUv: PreparedFinishDraft;
	};
	/** Everything inspection must leave untouched. */
	projectState(): { saved: string; revision: string; undo: boolean; camera: string };
	dispose(): void;
};

export async function buildInspectionFixture(): Promise<InspectionFixture> {
	const sky = skyFromPreset('daylight', 30);
	const [x, y, z] = INSPECTION_ANCHOR;
	const scene = createEmptyUnitSceneDocument();
	scene.entities = [
		{
			kind: 'primitive',
			id: SPHERE,
			name: 'Inspection sphere',
			position: [x, y, z],
			rotation: [0, 0, 0],
			primitive: 'sphere',
			dimensions: { radius: 0.5 },
			materialId: 'plaster-warm',
			castShadow: false,
			receiveShadow: false
		},
		{
			kind: 'light',
			id: 'e7-point',
			name: 'Inspection point',
			position: [x + 1.2, y + 0.7, z + 1.6],
			rotation: [0, 0, 0],
			light: 'point',
			color: '#ffb070',
			intensity: 6,
			castShadow: false
		}
	];
	scene.environment = { ...scene.environment, sky };
	const project = await createProjectEnvelope({
		id: PROJECT,
		name: 'E7 inspection',
		acceptedRevision: { projectId: PROJECT, revisionId: 'e7-0' },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: 'layout', data: createEmptyWallFirstLayoutDocument() },
		scene: { unitId: 'scene', data: scene },
		camera: { unitId: 'camera', data: createEmptyCameraPayload() },
		experience: { unitId: 'experience', data: createEmptyExperiencePayload() },
		resources: { unitId: 'resources', data: createEmptyResourcePayload() }
	});
	const materialProofs = createMaterialProofRegistry();
	const admitted = await admitSourceJson(serializeProjectEnvelope(project), {
		sessionEpoch: 'e7',
		acceptedRevision: { projectId: PROJECT, revisionId: 'e7-1' },
		materialProofs
	});
	if (admitted.kind !== 'admitted') throw new Error(`source did not admit: ${JSON.stringify(admitted)}`);
	const baseline = stageEnvelope(admitted.snapshot);

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
		preparation: createUnitAcceptancePreparation({ registry, sessionEpoch: 'e7', resourceStaging: true }),
		sessionEpoch: 'e7',
		baseline: {
			revision: admitted.snapshot.acceptedRevision,
			source: baseline,
			canonicalJson: admitted.snapshot.canonicalJson,
			sourceContentId: admitted.snapshot.sourceContentId,
			blockingIssues: []
		},
		planners: planners as never,
		mintRevisionId: () => `e7-${++ordinal}`
	});
	holder.current = () => coordinator.current().source;

	const signal = new AbortController().signal;
	async function chart(key: string, uri: string, name: string): Promise<SetFileInput> {
		const response = await fetch(uri);
		if (!response.ok) throw new Error(`${uri}: ${response.status}`);
		return { key, file: new File([await response.arrayBuffer()], name, { type: 'image/png' }) };
	}
	const set = await Promise.all([
		chart('colour', S8_CHART_FIXTURES.checker.uri, 'Chart_BaseColor_1k.png'),
		chart('orm', S8_CHART_FIXTURES.orm.uri, 'Chart_ORM_1k.png'),
		chart('minus', S8_CHART_FIXTURES.normalMinusY.uri, 'Chart_NormalDX_1k.png')
	]);
	const setSession = await readSetFileFacts(set, signal);
	const proposal = proposeMaterialSet(setSession.facts, coordinator.acceptedRevision().revisionId);
	const lowered = draftFromCandidate(proposal.candidates[0]!, { name: 'Chart', mapping: IDENTITY });
	if (!lowered.ok) throw new Error(`proposal did not lower: ${JSON.stringify(lowered.issues)}`);
	const prepared = await prepareDraft(lowered.edits, setSession, coordinator.acceptedRevision(), signal, materialProofs);
	if (!prepared.ok) throw new Error(`draft did not prepare: ${JSON.stringify(prepared.issues)}`);

	const stored = new Map<string, Uint8Array>();
	const importImage = (async (_api: ProjectApi, _project: string, input: File) => {
		const bytes = new Uint8Array(await input.arrayBuffer());
		const hash = await sha(bytes);
		const bitmap = await createImageBitmap(input);
		const { width, height } = bitmap;
		bitmap.close();
		const assetId = uuidOf(hash);
		stored.set(assetId, bytes);
		const image: ImportedProjectImage = {
			assetId, name: input.name, pixelWidth: width, pixelHeight: height, mime: 'image/png', byteSize: bytes.length, sha256: hash
		};
		return image;
	}) as never;
	const accepted = await acceptDraft(prepared.draft, { entityIds: [SPHERE], surfaces: [] }, 'chart', signal, {
		api: {} as ProjectApi,
		projectId: PROJECT,
		current: () => ({ source: coordinator.current().source, revision: coordinator.acceptedRevision() }),
		accept: (intent) => coordinator.accept(intent) as never,
		targetAnalysis,
		entityReference: (source, id): SemanticReference => ({
			version: 1,
			domain: 'scene',
			revision: { kind: 'exact', contentRevision: source.units.scene.header.contentRevision },
			subject: { kind: 'entity', id },
			instancePath: [],
			location: { kind: 'project-root' },
			componentId: null,
			capabilityId: null
		}),
		surfaceReference: () => {
			throw new Error('the inspection fixture paints no surface');
		},
		importImage
	});
	if (!accepted.ok) throw new Error(`draft was not accepted: ${accepted.code} ${accepted.message}`);
	setSession.release();

	const revision = coordinator.acceptedRevision();
	const loaded = await admitSourceJson(serializeProjectEnvelope(coordinator.current().source), {
		sessionEpoch: 'e7-cold',
		acceptedRevision: revision
	});
	if (loaded.kind !== 'admitted') throw new Error(`saved source did not admit: ${JSON.stringify(loaded)}`);
	const cold = stageEnvelope(loaded.snapshot);
	const pins = new Map(
		cold.units.resources.data.resources
			.filter((resource) => resource.kind === 'texture' && resource.pin !== null)
			.map((resource) => [resource.id, { hash: resource.pin!.hash, mime: resource.pin!.mime, size: resource.pin!.size }])
	);
	const bundle = composeColdReleaseBundle({
		document: cold,
		manifest: {
			releaseId: 'release-e7',
			bytesByUri: new Map(
				cold.units.scene.data.textures.map((texture) => [
					texture.uri,
					{ bytes: stored.get(texture.id)!, mime: 'image/png' as const, sha256: pins.get(texture.id)!.hash }
				])
			)
		}
	});
	const scope = createProjectTextureScope({
		scopeId: 'e7-inspection-project',
		pins: () => pins,
		load: async (assetId) => {
			const bytes = stored.get(assetId);
			if (bytes === undefined) throw new Error(`no bytes for ${assetId}`);
			return { bytes, mime: 'image/png' };
		}
	});

	// The provisional session outlives acceptance; it only ever produces drafts.
	const charts = await readSetFileFacts(
		[...set, await chart('plus', S8_CHART_FIXTURES.normalPlusY.uri, 'Chart_NormalGL_1k.png')],
		signal
	);
	async function draft(edits: DraftEdits): Promise<PreparedFinishDraft> {
		const result = await prepareDraft(edits, charts, coordinator.acceptedRevision(), signal, materialProofs);
		if (!result.ok) throw new Error(`${edits.name}: ${JSON.stringify(result.issues)}`);
		return result.draft;
	}
	const normal = (file: 'plus' | 'minus', convention: '+Y' | '-Y') =>
		draft({
			name: `Normal ${file} ${convention}`,
			mapping: IDENTITY,
			factors: { color: '#e6e6e6', roughness: 1, metalness: 0 },
			roles: { normal: { role: 'normal', file, convention } }
		});
	const checker = (name: string, mapping: Mapping) =>
		draft({ name, mapping, roles: { color: { role: 'color', file: 'colour' } } });
	const metric = (tile: number): Mapping => ({
		kind: 'target',
		metric: { tileMeters: [tile, tile], rotation: 0, offset: [0, 0] }
	});
	const drafts: InspectionFixture['drafts'] = {
		corrected: await draft({
			name: 'Chart, corrected',
			mapping: IDENTITY,
			factors: { color: '#e0a878', metalness: 0.2 },
			roles: {
				color: { role: 'color', file: 'colour' },
				normal: { role: 'normal', file: 'plus', convention: '+Y' },
				occlusion: { role: 'occlusion', file: 'orm', component: 'r', invert: false },
				roughness: { role: 'roughness', file: 'orm', component: 'g', invert: true }
			}
		}),
		metalSmooth: await draft({ name: 'Metal 0.2', factors: { color: '#ffffff', roughness: 0.2, metalness: 1 }, roles: {} }),
		metalRough: await draft({ name: 'Metal 0.8', factors: { color: '#ffffff', roughness: 0.8, metalness: 1 }, roles: {} }),
		normals: {
			plus: { '+Y': await normal('plus', '+Y'), '-Y': await normal('plus', '-Y') },
			minus: { '+Y': await normal('minus', '+Y'), '-Y': await normal('minus', '-Y') }
		},
		halfMetre: await checker('Half-metre tile', metric(0.5)),
		twiceUv: await checker('Repeat 2', { ...IDENTITY, repeat: [2, 2] }),
		oneMetre: await checker('One-metre tile', metric(1)),
		secondUv: await checker('Absent UV1', { ...IDENTITY, set: 1 }),
		mixedUv: await draft({
			name: 'Absent UV1 beside UV0',
			mapping: IDENTITY,
			roles: {
				normal: { role: 'normal', file: 'plus', convention: '+Y', mapping: { ...IDENTITY, set: 1 } },
				roughness: { role: 'roughness', file: 'orm', component: 'g', invert: false }
			}
		})
	};

	const bounds = {
		min: [x - 0.5, y - 0.5, z - 0.5],
		max: [x + 0.5, y + 0.5, z + 0.5]
	} as const;
	return {
		scene: bundle.scene,
		sky,
		frame: { bounds, shadowBounds: bounds, groundY: 0, flatGround: true },
		revision: revision.revisionId,
		finish: { kind: 'finish', document: bundle.scene, finishId: accepted.finishId, revision: revision.revisionId, scope },
		scope,
		drafts,
		projectState: () => {
			const { source } = coordinator.current();
			return {
				saved: serializeProjectEnvelope(source),
				revision: coordinator.acceptedRevision().revisionId,
				undo: coordinator.canUndo(),
				camera: source.units.camera.header.contentRevision
			};
		},
		dispose() {
			scope.dispose();
			charts.release();
			bundle.dispose();
		}
	};
}
