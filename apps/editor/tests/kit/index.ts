/**
 * The shared editor test kit: one mounting, settling, polling, boot and small
 * document-builder vocabulary for every suite.
 *
 * Format versions come from the codecs, never from literals, so a version bump
 * updates the kit with its document contract.
 */
import { LAYOUT_WALL_FIRST_FORMAT_VERSION, createEmptyWallFirstLayoutDocument, planWallChain, type LayoutDocumentWallFirst } from '@portfolio/layout-core/wall';
import { mintLayoutIdCapture } from '@portfolio/layout-core/plan';
import {
	SCENE_WORLD_LOCAL_FORMAT_VERSION,
	createEmptyWorldLocalSceneDocument,
	type SceneDocument,
	type SceneEntity
} from '@portfolio/project-model/scene';
import { SCENE_UNIT_FORMAT_VERSION, createEmptyCameraPayload, createEmptyExperiencePayload, createEmptyResourcePayload, createEmptyUnitSceneDocument, createProjectEnvelope, type CameraFreeSceneDocument, type ProjectEnvelope } from '@portfolio/project-model/units';
import { admitSource } from '$lib/authoring/stage/source-admission';
import type { StageReadSnapshot } from '$lib/authoring/stage/accepted-read';

export const LAYOUT_FORMAT_VERSION = LAYOUT_WALL_FIRST_FORMAT_VERSION;
export const SCENE_FORMAT_VERSION = SCENE_WORLD_LOCAL_FORMAT_VERSION;
export const SCENE_UNIT_FORMAT_VERSION_VALUE = SCENE_UNIT_FORMAT_VERSION;

export { eventually, mountComponent, mountWithProps, settle, type Mounted } from './dom';

// ---------------------------------------------------------------------------
// Layout builders

/** One empty current-format Layout document. */
export function emptyLayout(): LayoutDocumentWallFirst {
	return createEmptyWallFirstLayoutDocument();
}

/**
 * A Layout enclosure through the canonical chain planner. Points are X/Z
 * metres; the returned document carries the planner's own identity capture.
 */
export function layoutEnclosure(
	points: readonly (readonly [number, number])[],
	options: { readonly close?: boolean; readonly levelId?: string; readonly baseline?: LayoutDocumentWallFirst } = {}
): LayoutDocumentWallFirst {
	const baseline = options.baseline ?? emptyLayout();
	const planned = planWallChain({
		baseline,
		points: points.map(([x, z]) => [x, z] as [number, number]),
		close: options.close ?? true,
		capture: mintLayoutIdCapture(),
		levelId: options.levelId ?? baseline.floor.id
	});
	if (planned.kind !== 'success') throw new Error('the Layout chain fixture was refused');
	return planned.document;
}

// ---------------------------------------------------------------------------
// Scene builders

/** One empty world-local Scene document at the codec's current version. */
export function emptyScene(): SceneDocument {
	return createEmptyWorldLocalSceneDocument();
}

/** A world-local Scene with the named entities, at the codec's version. */
export function sceneWith(entities: readonly SceneEntity[] = []): SceneDocument {
	return { ...emptyScene(), entities: [...entities] };
}

/** One empty Camera-free Scene unit at the codec's current version. */
export function emptySceneUnit(): CameraFreeSceneDocument {
	return createEmptyUnitSceneDocument();
}

/** A Camera-free Scene unit with the named entities, at the codec's version. */
export function sceneUnitWith(entities: readonly SceneEntity[] = []): CameraFreeSceneDocument {
	return { ...createEmptyUnitSceneDocument(), formatVersion: SCENE_UNIT_FORMAT_VERSION, entities: [...entities] };
}

// ---------------------------------------------------------------------------
// Boot

export type BootedProject = {
	readonly project: ProjectEnvelope;
	readonly snapshot: StageReadSnapshot;
};

/**
 * Build and admit one project envelope through the live Stage admission.
 * Layout and Scene builders above supply the authored units; every other unit
 * is the canonical empty payload.
 */
export async function bootProject(input: {
	readonly id: string;
	readonly name?: string;
	readonly layout?: LayoutDocumentWallFirst;
	readonly scene?: CameraFreeSceneDocument;
	readonly revisionId?: string;
	readonly sessionEpoch?: string;
}): Promise<BootedProject> {
	const project = await createProjectEnvelope({
		id: input.id,
		name: input.name ?? input.id,
		acceptedRevision: { projectId: input.id, revisionId: input.revisionId ?? 'revision-boot' },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: `${input.id}:layout`, data: input.layout ?? emptyLayout() },
		scene: { unitId: `${input.id}:scene`, data: input.scene ?? emptySceneUnit() },
		camera: { unitId: `${input.id}:camera`, data: createEmptyCameraPayload() },
		experience: { unitId: `${input.id}:experience`, data: createEmptyExperiencePayload() },
		resources: { unitId: `${input.id}:resources`, data: createEmptyResourcePayload() }
	});
	const admitted = await admitSource(project, {
		sessionEpoch: input.sessionEpoch ?? 'session-kit',
		acceptedRevision: project.acceptedRevision
	});
	if (admitted.kind !== 'admitted') throw new Error(`the boot fixture was not admitted: ${admitted.kind}`);
	return { project, snapshot: admitted.snapshot };
}
