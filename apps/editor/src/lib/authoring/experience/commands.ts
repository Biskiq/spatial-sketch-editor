/**
 * Experience authoring commands (T3.P02.S01).
 *
 * One builder per authored operation. Each is a pure function of the accepted
 * envelope the surface is showing, the surface's focus, and the ids the host
 * captured — it never reads a clock, a renderer or a second source. The surface
 * submits the result through the host's one F.4 acceptance port, so every command
 * here is one accepted result and one undo payload.
 *
 * The commands construct no order: `guide-order` is a permutation of authored Stop
 * ids, and no other command touches Guide order.
 */

import type { AuthoringIntent } from '@portfolio/project-model';
import type { SemanticReference } from '@portfolio/project-model';
import type {
	Experience,
	ExperienceContinuation,
	ProjectEnvelope
} from '@portfolio/project-model/units';
import {
	EXPERIENCE_CAPTURE_BIND_KIND,
	EXPERIENCE_CREATE_KIND,
	EXPERIENCE_GUIDE_ORDER_KIND,
	EXPERIENCE_PRESENTATION_UPDATE_KIND,
	EXPERIENCE_STOP_CREATE_KIND,
	EXPERIENCE_STOP_UPDATE_KIND
} from '@portfolio/project-model/units';

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
};

function intent(
	kind: string,
	ids: CommandIds,
	revision: { readonly projectId: string; readonly revisionId: string },
	targets: readonly SemanticReference[],
	payload: AuthoringIntent['payload'],
	allocatedIds: AuthoringIntent['allocatedIds']
): AuthoringIntent {
	return {
		version: 1,
		kind,
		operationId: ids.operation,
		expectedRevision: revision,
		targets,
		payload,
		capturedInputs: [],
		allocatedIds
	};
}

/** The Experience a subject belongs to is the one its Presentation lives in. */
export function experienceOf(envelope: ProjectEnvelope, experienceId: string | null): Experience | null {
	if (experienceId === null) return null;
	return envelope.units.experience.data.experiences.find((entry) => entry.id === experienceId) ?? null;
}

/** `experience:experience` addressed by its authored identity. */
export function experienceReference(
	envelope: ProjectEnvelope,
	experienceId: string
): SemanticReference {
	return {
		version: 1,
		domain: 'experience',
		revision: { kind: 'exact', contentRevision: envelope.units.experience.header.contentRevision },
		subject: { kind: 'experience', id: experienceId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

/** `experience:presentation` / `experience:stop` are scoped by their Experience. */
export function experienceMemberReference(
	envelope: ProjectEnvelope,
	experienceId: string,
	kind: 'presentation' | 'stop' | 'guide',
	id: string
): SemanticReference {
	return {
		version: 1,
		domain: 'experience',
		revision: { kind: 'exact', contentRevision: envelope.units.experience.header.contentRevision },
		subject: { kind, id },
		instancePath: [experienceId],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

/** A Scene entity used as a Presentation subject, at its exact revision. */
export function sceneEntitySubject(
	envelope: ProjectEnvelope,
	entityId: string
): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: envelope.units.scene.header.contentRevision },
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

export function createExperienceIntent(input: {
	readonly revision: { readonly projectId: string; readonly revisionId: string };
	readonly ids: CommandIds;
	readonly label: string;
}): AuthoringIntent {
	return intent(
		EXPERIENCE_CREATE_KIND,
		input.ids,
		input.revision,
		[],
		{ label: input.label },
		[{ kind: 'experience', id: input.ids.experience! }]
	);
}

/**
 * Capture one View and bind a Presentation to it, optionally inserting a Stop.
 *
 * The subject is the canonical Scene selection when there is one; otherwise the
 * Presentation is an environment/region Presentation with an explicit `null`
 * subject. It is never inferred from a centroid, a Room or a clone.
 */
export function captureBindIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: { readonly projectId: string; readonly revisionId: string };
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly view: CapturedViewPose;
	readonly presentationLabel: string;
	readonly subjectEntityId: string | null;
	readonly text: { kind: 'plain'; body: string } | null;
	readonly guideId: string | null;
	readonly afterStopId: string | null;
}): AuthoringIntent {
	const allocated: AuthoringIntent['allocatedIds'][number][] = [
		{ kind: 'view', id: input.ids.view! },
		{ kind: 'presentation', id: input.ids.presentation! }
	];
	if (input.guideId !== null) allocated.push({ kind: 'stop', id: input.ids.stop! });
	return intent(
		EXPERIENCE_CAPTURE_BIND_KIND,
		input.ids,
		input.revision,
		[experienceReference(input.envelope, input.experienceId)],
		{
			view: input.view,
			presentation: {
				label: input.presentationLabel,
				subject:
					input.subjectEntityId === null ? null : sceneEntitySubject(input.envelope, input.subjectEntityId),
				text: input.text
			},
			stop:
				input.guideId === null
					? null
					: {
							guideId: input.guideId,
							afterStopId: input.afterStopId,
							continuation: { kind: 'sequence-next', transition: 'cut' }
						}
		},
		allocated
	);
}

/** Reuse an existing Presentation at a distinct Stop. */
export function stopCreateIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: { readonly projectId: string; readonly revisionId: string };
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly presentationId: string;
	readonly guideId: string;
	readonly afterStopId: string | null;
	readonly entryViewId: string | null;
	readonly holdSeconds: number | null;
	readonly continuation: ExperienceContinuation | null;
}): AuthoringIntent {
	return intent(
		EXPERIENCE_STOP_CREATE_KIND,
		input.ids,
		input.revision,
		[experienceReference(input.envelope, input.experienceId)],
		{
			presentationId: input.presentationId,
			guideId: input.guideId,
			afterStopId: input.afterStopId,
			...(input.entryViewId === null ? {} : { entryViewId: input.entryViewId }),
			...(input.holdSeconds === null ? {} : { holdSeconds: input.holdSeconds }),
			...(input.continuation === null ? {} : { continuation: input.continuation })
		},
		[{ kind: 'stop', id: input.ids.stop! }]
	);
}

/** Reorder one Guide by stable Stop identity. */
export function guideOrderIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: { readonly projectId: string; readonly revisionId: string };
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly guideId: string;
	readonly stopIds: readonly string[];
}): AuthoringIntent {
	return intent(
		EXPERIENCE_GUIDE_ORDER_KIND,
		input.ids,
		input.revision,
		[experienceReference(input.envelope, input.experienceId)],
		{ guideId: input.guideId, stopIds: [...input.stopIds] },
		[]
	);
}

/** Edit one Presentation's bounded fields, or rebind it to a captured View. */
export function presentationUpdateIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: { readonly projectId: string; readonly revisionId: string };
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly presentationId: string;
	readonly label?: string;
	readonly text?: { kind: 'plain'; body: string } | null;
	readonly view?: CapturedViewPose;
	readonly defaultViewId?: string | null;
}): AuthoringIntent {
	return intent(
		EXPERIENCE_PRESENTATION_UPDATE_KIND,
		input.ids,
		input.revision,
		[experienceMemberReference(input.envelope, input.experienceId, 'presentation', input.presentationId)],
		{
			...(input.label === undefined ? {} : { label: input.label }),
			...(input.text === undefined ? {} : { text: input.text }),
			...(input.view === undefined ? {} : { view: input.view }),
			...(input.defaultViewId === undefined ? {} : { defaultViewId: input.defaultViewId })
		},
		input.view === undefined ? [] : [{ kind: 'view', id: input.ids.view! }]
	);
}

/** Edit one Stop's entry View, hold or continuation edge. */
export function stopUpdateIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: { readonly projectId: string; readonly revisionId: string };
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly stopId: string;
	readonly entryViewId?: string | null;
	readonly holdSeconds?: number | null;
	readonly continuation?: ExperienceContinuation | null;
}): AuthoringIntent {
	return intent(
		EXPERIENCE_STOP_UPDATE_KIND,
		input.ids,
		input.revision,
		[experienceMemberReference(input.envelope, input.experienceId, 'stop', input.stopId)],
		{
			...(input.entryViewId === undefined ? {} : { entryViewId: input.entryViewId }),
			...(input.holdSeconds === undefined ? {} : { holdSeconds: input.holdSeconds }),
			...(input.continuation === undefined ? {} : { continuation: input.continuation })
		},
		[]
	);
}

/** A captured View at the Stage's current framing. Aspect is the viewport's, not a View field. */
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
		fov: input.fov
	};
}
