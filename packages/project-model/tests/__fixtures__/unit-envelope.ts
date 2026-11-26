import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core/wall';
import type { AcceptedRevision } from '@portfolio/project-model/references';
import type { SceneDocument } from '@portfolio/project-model/scene';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	createEmptyCameraPayload,
	createEmptyExperiencePayload,
	createEmptyResourcePayload,
	createEmptyUnitSceneDocument,
	createProjectEnvelope,
	type CameraFreeSceneDocument,
	type CameraUnitPayload,
	type CameraView,
	type ExperienceUnitPayload,
	type LayoutUnitPayload,
	type ProjectEnvelope,
	type ResourceUnitPayload
} from '@portfolio/project-model/units';

export function unitRevision(projectId: string, revisionId = 'revision-1'): AcceptedRevision {
	return { projectId, revisionId };
}

/** Build a Camera unit from a fixture's navigation graph. */
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

/** Build the Camera-free Scene unit from a combined fixture. */
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
	/** A combined fixture supplies separate Scene and Camera units. */
	readonly scene?: SceneDocument | CameraFreeSceneDocument;
	readonly camera?: CameraUnitPayload;
	readonly experience?: ExperienceUnitPayload;
	readonly resources?: ResourceUnitPayload;
	/** A pinned resource's lock entries, when the fixture has one. */
	readonly dependencyLock?: ProjectEnvelope['dependencyLock'];
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
		dependencyLock: input.dependencyLock ?? { formatVersion: 1, entries: [] },
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
