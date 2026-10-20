/**
 * F.2 envelope construction and the one unit-replacement seam.
 *
 * The editor's live source is one `ProjectEnvelope`. Boot, the starter gallery,
 * the empty baseline and every planner build through these helpers so a
 * candidate always has exactly five units at their admitted versions, and a
 * planner replacing one domain can never drop or re-encode another.
 *
 * Replacing a unit keeps its header and `unitId`: `contentRevision` is a derived
 * fact and the acceptance adapter recomputes it on admission. A candidate
 * therefore carries the baseline revision until it is admitted — the same rule
 * the F.2 planners already follow.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */

import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import { createProjectEnvelope } from './canonical';
import { serializeProjectEnvelope } from './validate';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	type CameraFreeSceneDocument,
	type CameraUnitPayload,
	type ExperienceUnitPayload,
	type LayoutUnitPayload,
	type ProjectEnvelope,
	type ProjectUnits,
	type ResourceUnitPayload,
	type UnitDomain,
	type UnitPayload
} from './types';

/** The empty Camera payload: no fabricated view, no connectivity. */
export function createEmptyCameraPayload(): CameraUnitPayload {
	return { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: [], connections: [] };
}

/** The empty Experience payload: no fabricated Presentation, Guide or Stop. */
export function createEmptyExperiencePayload(): ExperienceUnitPayload {
	return { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [] };
}

/** The empty resource registry. */
export function createEmptyResourcePayload(): ResourceUnitPayload {
	return { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [] };
}

/** The Camera-free Scene 2 baseline. */
export function createEmptyUnitSceneDocument(): CameraFreeSceneDocument {
	return { formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [], entities: [] };
}

/**
 * One project baseline in the only admitted source format.
 *
 * The unit ids are stable per project and domain so a body's owning unit is
 * derivable without a second registry. `dependencyLock` is empty: a baseline
 * pins nothing, and an operation that needs a pin adds it explicitly.
 */
export async function createEmptyUnitEnvelope(input: {
	readonly id: string;
	readonly name: string;
	readonly acceptedRevision: ProjectEnvelope['acceptedRevision'];
	readonly layout?: LayoutUnitPayload;
}): Promise<ProjectEnvelope> {
	return createProjectEnvelope({
		id: input.id,
		name: input.name,
		acceptedRevision: input.acceptedRevision,
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: {
			unitId: `${input.id}:layout`,
			data: input.layout ?? createEmptyWallFirstLayoutDocument()
		},
		scene: { unitId: `${input.id}:scene`, data: createEmptyUnitSceneDocument() },
		camera: { unitId: `${input.id}:camera`, data: createEmptyCameraPayload() },
		experience: { unitId: `${input.id}:experience`, data: createEmptyExperiencePayload() },
		resources: { unitId: `${input.id}:resources`, data: createEmptyResourcePayload() }
	});
}

/**
 * Replace exactly one unit's data, keeping every other unit and the dependency
 * lock byte-identical. The replaced header keeps its identity; its content
 * revision is derived again by unit admission.
 */
export function replaceUnitData(
	envelope: ProjectEnvelope,
	domain: 'layout',
	data: LayoutUnitPayload
): ProjectEnvelope;
export function replaceUnitData(
	envelope: ProjectEnvelope,
	domain: 'scene',
	data: CameraFreeSceneDocument
): ProjectEnvelope;
export function replaceUnitData(
	envelope: ProjectEnvelope,
	domain: 'camera',
	data: CameraUnitPayload
): ProjectEnvelope;
export function replaceUnitData(
	envelope: ProjectEnvelope,
	domain: 'experience',
	data: ExperienceUnitPayload
): ProjectEnvelope;
export function replaceUnitData(
	envelope: ProjectEnvelope,
	domain: 'resources',
	data: ResourceUnitPayload
): ProjectEnvelope;
export function replaceUnitData(
	envelope: ProjectEnvelope,
	domain: UnitDomain,
	data: UnitPayload
): ProjectEnvelope;
export function replaceUnitData(
	envelope: ProjectEnvelope,
	domain: UnitDomain,
	data: UnitPayload
): ProjectEnvelope {
	const units: ProjectUnits = {
		...envelope.units,
		[domain]: { header: { ...envelope.units[domain].header }, data }
	} as ProjectUnits;
	return { ...envelope, units };
}

/** The canonical F.2 source text a Save capture, download or history records. */
export function serializeUnitEnvelope(envelope: ProjectEnvelope): string {
	return serializeProjectEnvelope(envelope);
}

/** Narrow accessors: the one place a unit payload is read by domain. */
export function layoutUnit(envelope: ProjectEnvelope): LayoutUnitPayload {
	return envelope.units.layout.data;
}

export function sceneUnit(envelope: ProjectEnvelope): CameraFreeSceneDocument {
	return envelope.units.scene.data;
}

export function cameraUnit(envelope: ProjectEnvelope): CameraUnitPayload {
	return envelope.units.camera.data;
}

export function experienceUnit(envelope: ProjectEnvelope): ExperienceUnitPayload {
	return envelope.units.experience.data;
}

export function resourceUnit(envelope: ProjectEnvelope): ResourceUnitPayload {
	return envelope.units.resources.data;
}
