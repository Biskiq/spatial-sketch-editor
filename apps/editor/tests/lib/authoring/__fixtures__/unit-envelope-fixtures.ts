/**
 * Test-only F.2 envelope fixtures.
 *
 * The live source is one `ProjectEnvelope`; every suite that used to build a
 * current-source `ProjectDocument` builds through here instead. Nothing in this
 * module is production code or a second source path: `createProjectEnvelope`
 * computes the same derived unit revisions production admission requires, and
 * `admitUnitProject` calls the one live Stage admission.
 *
 * Scene fixtures used to carry `navigationNodes`/`connections`. That data is
 * Camera-owned now, so `createUnitProject` splits a legacy Scene-shaped fixture
 * into the Camera-free Scene unit and the Camera unit exactly as migration 005
 * does, and the resulting envelope has no navigation graph in its Scene.
 */
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import type {
	AcceptedRevision,
	DomainPlanner
} from '@portfolio/project-model';
import type { SceneDocument } from '@portfolio/project-model';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	createEmptyCameraPayload,
	createEmptyExperiencePayload,
	createEmptyResourcePayload,
	createEmptyUnitSceneDocument,
	createProjectEnvelope,
	createUnitAcceptanceAdapter,
	createUnitAcceptancePreparation,
	createUnitPlannerRegistry,
	prepareUnitRuntime,
	serializeProjectEnvelope,
	UNIT_SOURCE_KIND,
	UNIT_SOURCE_VERSION,
	type CameraFreeSceneDocument,
	type CameraUnitPayload,
	type CameraView,
	type ExperienceUnitPayload,
	type LayoutUnitPayload,
	type ProjectEnvelope,
	type ResourceUnitPayload
} from '@portfolio/project-model/units';
import {
	createAcceptanceCoordinator,
	type AcceptanceCoordinator
} from '$lib/authoring/f4';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';
import { admitSource } from '$lib/authoring/stage/source-admission';

export { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION };

export const DEFAULT_SESSION_EPOCH = 'session-1';

export function unitRevision(projectId: string, revisionId = 'revision-1'): AcceptedRevision {
	return { projectId, revisionId };
}

/** The Camera unit a legacy Scene's navigation graph migrates to. */
export function cameraOfScene(scene: SceneDocument): CameraUnitPayload {
	const views: CameraView[] = scene.navigationNodes.map((node) => ({
		id: node.id,
		label: node.label,
		eye: [...node.position] as [number, number, number],
		target: [...node.cameraTarget] as [number, number, number],
		fov: node.fov,
		connectedViewIds: [...node.connectedNodeIds]
	}));
	return { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views, connections: scene.connections };
}

/** The Camera-free Scene unit a legacy Scene migrates to. */
export function cameraFreeScene(scene: SceneDocument): CameraFreeSceneDocument {
	return {
		formatVersion: SCENE_UNIT_FORMAT_VERSION,
		textures: scene.textures,
		materials: scene.materials,
		entities: scene.entities,
		...(scene.clusters === undefined ? {} : { clusters: scene.clusters })
	};
}

export type UnitProjectInput = {
	readonly id: string;
	readonly name: string;
	readonly acceptedRevision?: AcceptedRevision;
	readonly layout?: LayoutUnitPayload;
	/** A legacy Scene shape is split into Scene 2 + Camera 1. */
	readonly scene?: SceneDocument | CameraFreeSceneDocument;
	readonly camera?: CameraUnitPayload;
	readonly experience?: ExperienceUnitPayload;
	readonly resources?: ResourceUnitPayload;
};

function isLegacyScene(value: SceneDocument | CameraFreeSceneDocument): value is SceneDocument {
	return 'navigationNodes' in value;
}

/**
 * Build one admitted-shape envelope. Unit revisions are computed by the
 * provider, so the result is what `validateProjectEnvelope` and
 * `verifyUnitContentRevisions` accept rather than a hand-written object.
 */
export async function createUnitProject(input: UnitProjectInput): Promise<ProjectEnvelope> {
	const acceptedRevision = input.acceptedRevision ?? unitRevision(input.id);
	const legacy = input.scene !== undefined && isLegacyScene(input.scene) ? input.scene : null;
	const sceneData =
		input.scene === undefined
			? createEmptyUnitSceneDocument()
			: legacy === null
				? (input.scene as CameraFreeSceneDocument)
				: cameraFreeScene(legacy);
	const cameraData =
		input.camera ?? (legacy === null ? createEmptyCameraPayload() : cameraOfScene(legacy));
	return createProjectEnvelope({
		id: input.id,
		name: input.name,
		acceptedRevision,
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: `${input.id}:layout`, data: input.layout ?? createEmptyWallFirstLayoutDocument() },
		scene: { unitId: `${input.id}:scene`, data: sceneData },
		camera: { unitId: `${input.id}:camera`, data: cameraData },
		experience: {
			unitId: `${input.id}:experience`,
			data: input.experience ?? createEmptyExperiencePayload()
		},
		resources: {
			unitId: `${input.id}:resources`,
			data: input.resources ?? createEmptyResourcePayload()
		}
	});
}

/** The old admission result shape, over the live F.2 admission. */
export type AdmittedUnitProject = {
	readonly kind: 'admitted';
	readonly envelope: ProjectEnvelope;
	/** Compatibility name for migrated assertions: the admitted source is the envelope. */
	readonly project: ProjectEnvelope;
	readonly snapshot: StageReadSnapshot;
	readonly canonicalJson: string;
	readonly sourceContentId: string;
	readonly blockingIssues: readonly never[];
	readonly issues: readonly never[];
};

export type RefusedUnitProject = {
	readonly kind: 'rejected';
	readonly code: string;
	readonly message: string;
	readonly issues: readonly { path: string; code: string; message: string }[];
};

/** Admit through the one live Stage admission, published under `revision`. */
export async function admitUnitProject(
	input: unknown,
	revision: AcceptedRevision,
	sessionEpoch: string = DEFAULT_SESSION_EPOCH
): Promise<AdmittedUnitProject | RefusedUnitProject> {
	const outcome = await admitSource(input, { acceptedRevision: revision, sessionEpoch });
	if (outcome.kind === 'admitted') {
		return {
			kind: 'admitted',
			envelope: input as ProjectEnvelope,
			project: input as ProjectEnvelope,
			snapshot: outcome.snapshot,
			canonicalJson: outcome.snapshot.canonicalJson,
			sourceContentId: outcome.snapshot.sourceContentId,
			blockingIssues: [],
			issues: []
		};
	}
	if (outcome.kind === 'diagnostics') {
		return {
			kind: 'rejected',
			code: 'blocking-geometry',
			message: outcome.issues[0]?.message ?? 'The source has blocking geometry',
			issues: outcome.issues
		};
	}
	return {
		kind: 'rejected',
		code: outcome.reason,
		message: outcome.issues[0]?.message ?? 'The source was refused',
		issues: outcome.issues
	};
}

/** The source-content half of admission, without a session snapshot. */
export async function admitUnitContent(input: unknown): Promise<
	| {
			readonly kind: 'admitted';
			readonly envelope: ProjectEnvelope;
			readonly project: ProjectEnvelope;
			readonly canonicalJson: string;
			readonly sourceContentId: string;
			readonly blockingIssues: readonly never[];
			readonly issues: readonly never[];
	  }
	| RefusedUnitProject
> {
	const prepared = prepareUnitRuntime(input);
	if (prepared.kind === 'rejected') {
		return {
			kind: 'rejected',
			code: prepared.reason,
			message: prepared.issues[0]?.message ?? 'The source was refused',
			issues: prepared.issues
		};
	}
	return {
		kind: 'admitted',
		envelope: prepared.envelope,
		project: prepared.envelope,
		canonicalJson: serializeProjectEnvelope(prepared.envelope),
		sourceContentId: await computeEnvelopeSourceContentId(prepared.envelope),
		blockingIssues: [],
		issues: []
	};
}

/** A coordinator wired exactly as the Stage host wires it (compound unit admission). */
export async function createUnitCoordinator(input: {
	readonly baseline:
		| ProjectEnvelope
		| {
				readonly revision: AcceptedRevision;
				readonly source: ProjectEnvelope;
				readonly canonicalJson?: string;
				readonly sourceContentId?: string;
				readonly blockingIssues?: readonly never[];
		  };
	readonly planners?: readonly DomainPlanner<ProjectEnvelope>[];
	readonly sessionEpoch?: string;
	readonly mintRevisionId?: (ordinal: number) => string;
}): Promise<AcceptanceCoordinator<ProjectEnvelope>> {
	const sessionEpoch = input.sessionEpoch ?? DEFAULT_SESSION_EPOCH;
	const source = 'source' in input.baseline ? input.baseline.source : input.baseline;
	const revision = 'source' in input.baseline ? input.baseline.revision : input.baseline.acceptedRevision;
	const canonicalJson =
		'source' in input.baseline && input.baseline.canonicalJson !== undefined
			? input.baseline.canonicalJson
			: serializeProjectEnvelope(source);
	const sourceContentId =
		'source' in input.baseline && input.baseline.sourceContentId !== undefined
			? input.baseline.sourceContentId
			: await computeEnvelopeSourceContentId(source);
	const registry = createUnitPlannerRegistry<ProjectEnvelope>();
	return createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: createUnitAcceptanceAdapter({ compound: true }),
		preparation: createUnitAcceptancePreparation({ registry, sessionEpoch }),
		sessionEpoch,
		baseline: {
			revision,
			source,
			canonicalJson,
			sourceContentId,
			blockingIssues: []
		},
		planners: input.planners ?? [],
		...(input.mintRevisionId === undefined ? {} : { mintRevisionId: input.mintRevisionId })
	});
}
