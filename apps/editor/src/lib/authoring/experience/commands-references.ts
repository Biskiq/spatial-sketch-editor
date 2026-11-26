/**
 * Experience authoring commands.
 *
 * One builder per authored operation. Each is a pure function of the accepted
 * envelope the surface is showing, the surface's focus, and the ids the host
 * captured — it never reads a clock, a renderer or a second source. The surface
 * submits the result through the host's one F.4 acceptance port, so every command
 * here is one accepted result and one undo payload.
 *
 * The commands construct no order: `guide-order` is a permutation of authored Stop
 * ids, and no other command touches Guide order. A Presentation's View order is
 * likewise only ever a permutation of its authored Views.
 */

import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SemanticReference } from '@portfolio/project-model/references';
import type { Experience, ProjectEnvelope } from '@portfolio/project-model/units';

export type CapturedViewPose = {
	readonly label: string;
	readonly eye: [number, number, number];
	readonly target: [number, number, number];
	readonly fov: number;
};

/**
 * The vertical field of view a perspective projection actually renders, in
 * degrees. Column-major `projectionMatrix[5]` is `1 / tan(fovY / 2)`.
 *
 * The capture must record the framing the creator saw, so the FOV is read from
 * the Stage's evaluated projection rather than from a constant beside it.
 *
 * Precondition: a perspective projection. An orthographic projection has no
 * perspective scale, and its `[5]` is a linear bound, so the caller refuses
 * anything but the 3D reading before asking; this function only guards the
 * arithmetic (missing, non-finite or non-positive scale).
 */
export function capturedFovDegrees(projectionMatrix: readonly number[]): number | null {
	const scale = projectionMatrix[5];
	if (scale === undefined || !Number.isFinite(scale) || scale <= 0) return null;
	return (2 * Math.atan(1 / scale) * 180) / Math.PI;
}

export type CommandIds = {
	readonly operation: string;
	readonly experience?: string;
	readonly view?: string;
	readonly presentation?: string;
	readonly stop?: string;
	readonly guide?: string;
	/** A captured Camera connection id. */
	readonly connection?: string;
	/** Captured Camera connection ids for automatic Travel path reconciliation. */
	readonly connections?: readonly string[];
};

export function intent(
	kind: string,
	ids: CommandIds,
	revision: { readonly projectId: string; readonly revisionId: string },
	targets: readonly SemanticReference[],
	payload: AuthoringIntent['payload'],
	allocatedIds: AuthoringIntent['allocatedIds'],
): AuthoringIntent {
	return {
		version: 1,
		kind,
		operationId: ids.operation,
		expectedRevision: revision,
		targets,
		payload,
		capturedInputs: [],
		allocatedIds,
	};
}

/** The Experience a subject belongs to is the one its Presentation lives in. */
export function experienceOf(
	envelope: ProjectEnvelope,
	experienceId: string | null,
): Experience | null {
	if (experienceId === null) return null;
	return (
		envelope.units.experience.data.experiences.find((entry) => entry.id === experienceId) ?? null
	);
}

/** `experience:experience` addressed by its authored identity. */
export function experienceReference(
	envelope: ProjectEnvelope,
	experienceId: string,
): SemanticReference {
	return {
		version: 1,
		domain: 'experience',
		revision: { kind: 'exact', contentRevision: envelope.units.experience.header.contentRevision },
		subject: { kind: 'experience', id: experienceId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}

/** `experience:presentation` / `experience:stop` are scoped by their Experience. */
export function experienceMemberReference(
	envelope: ProjectEnvelope,
	experienceId: string,
	kind: 'presentation' | 'stop' | 'guide',
	id: string,
): SemanticReference {
	return {
		version: 1,
		domain: 'experience',
		revision: { kind: 'exact', contentRevision: envelope.units.experience.header.contentRevision },
		subject: { kind, id },
		instancePath: [experienceId],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}

/** A Scene entity used as a Presentation subject, at its exact revision. */
export function sceneEntitySubject(envelope: ProjectEnvelope, entityId: string): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: envelope.units.scene.header.contentRevision },
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}

export type Revision = { readonly projectId: string; readonly revisionId: string };

export function cameraViewReference(envelope: ProjectEnvelope, viewId: string): SemanticReference {
	return {
		version: 1,
		domain: 'camera',
		revision: { kind: 'exact', contentRevision: envelope.units.camera.header.contentRevision },
		subject: { kind: 'view', id: viewId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
	};
}

export function capturedViewPose(input: {
	readonly label: string;
	readonly eye: readonly [number, number, number];
	readonly target: readonly [number, number, number];
	readonly fov: number;
}): CapturedViewPose {
	return {
		label: input.label,
		eye: [input.eye[0], input.eye[1], input.eye[2]],
		target: [input.target[0], input.target[1], input.target[2]],
		fov: input.fov,
	};
}
