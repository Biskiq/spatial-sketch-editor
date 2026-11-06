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
 * ids, and no other command touches Guide order. A Presentation's View order is
 * likewise only ever a permutation of its authored Views.
 */

import type { AuthoringIntent } from '@portfolio/project-model';
import type { ScenePathAnchor, SemanticReference } from '@portfolio/project-model';
import type {
	Experience,
	ExperienceGuidePacing,
	ExperienceInvitation,
	ExperiencePresentationView,
	ProjectEnvelope
} from '@portfolio/project-model/units';
import {
	CAMERA_CONNECTION_CREATE_KIND,
	CAMERA_CONNECTION_UPDATE_KIND,
	CAMERA_VIEW_UPDATE_KIND,
	EXPERIENCE_CAPTURE_BIND_KIND,
	EXPERIENCE_CREATE_KIND,
	EXPERIENCE_GUIDE_CREATE_KIND,
	EXPERIENCE_GUIDE_ORDER_KIND,
	EXPERIENCE_GUIDE_REMOVE_KIND,
	EXPERIENCE_GUIDE_UPDATE_KIND,
	EXPERIENCE_PRESENTATION_REMOVE_KIND,
	EXPERIENCE_PRESENTATION_UPDATE_KIND,
	EXPERIENCE_PRESENTATION_VIEW_REMOVE_KIND,
	EXPERIENCE_STOP_CREATE_KIND,
	EXPERIENCE_STOP_REMOVE_KIND,
	EXPERIENCE_STOP_UPDATE_KIND,
	EXPERIENCE_UPDATE_KIND,
	type CameraView,
	type ExperienceTransitionKind
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
	readonly guide?: string;
	/** R217.S29 — a captured Camera connection id. */
	readonly connection?: string;
	/** Several captured Camera connection ids, for a range set to All Travel. */
	readonly connections?: readonly string[];
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
	readonly presentationLabel: string | null;
	readonly subjectEntityId: string | null;
	readonly text: { kind: 'plain'; body: string } | null;
	readonly guideId: string | null;
	readonly afterStopId: string | null;
	/**
	 * Experience review 1 (ready draft): create the Experience `experienceId` in the
	 * same accepted change, with this label. The capture then targets no Experience.
	 */
	readonly newExperienceLabel?: string | null;
}): AuthoringIntent {
	const newExperienceLabel = input.newExperienceLabel ?? null;
	const allocated: AuthoringIntent['allocatedIds'][number][] = [
		{ kind: 'view', id: input.ids.view! },
		{ kind: 'presentation', id: input.ids.presentation! }
	];
	if (input.guideId !== null) allocated.push({ kind: 'stop', id: input.ids.stop! });
	if (newExperienceLabel !== null) allocated.push({ kind: 'experience', id: input.experienceId });
	return intent(
		EXPERIENCE_CAPTURE_BIND_KIND,
		input.ids,
		input.revision,
		newExperienceLabel === null ? [experienceReference(input.envelope, input.experienceId)] : [],
		{
			view: input.view,
			presentation: {
				label: input.presentationLabel,
				subject:
					input.subjectEntityId === null ? null : sceneEntitySubject(input.envelope, input.subjectEntityId),
				text: input.text
			},
			// A Guide-free capture sends no Stop at all; it never manufactures a Guide
			// or a Stop to hang one on.
			...(input.guideId === null
				? { stop: null }
				: {
						stop: {
							guideId: input.guideId,
							afterStopId: input.guideId === null ? null : input.afterStopId,
							transition: 'cut'
						}
					}),
			...(newExperienceLabel === null ? {} : { newExperience: { label: newExperienceLabel } })
		},
		allocated
	);
}

/**
 * Create a Guide and its initial distinct Stop; the first Guide opens the Experience.
 *
 * The Stop enters the chosen Presentation at its own View — an explicit
 * `entryViewId` or the Presentation's Default. Reusing a Presentation creates a
 * fresh Stop identity; no Camera pose/FOV is copied and no Connection is made.
 */
export function guideCreateIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: { readonly projectId: string; readonly revisionId: string };
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly presentationId: string;
	readonly label: string;
	readonly entryViewId: string | null;
	readonly staySeconds?: number | null;
	readonly transition: ExperienceTransitionKind | null;
}): AuthoringIntent {
	return intent(
		EXPERIENCE_GUIDE_CREATE_KIND,
		input.ids,
		input.revision,
		[experienceReference(input.envelope, input.experienceId)],
		{
			label: input.label,
			presentationId: input.presentationId,
			...(input.entryViewId === null ? {} : { entryViewId: input.entryViewId }),
			...(input.staySeconds == null ? {} : { staySeconds: input.staySeconds }),
			...(input.transition === null ? {} : { transition: input.transition })
		},
		[
			{ kind: 'guide', id: input.ids.guide! },
			{ kind: 'stop', id: input.ids.stop! },
			...(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id }))
		]
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
	readonly staySeconds?: number | null;
	readonly transition: ExperienceTransitionKind | null;
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
			...(input.staySeconds == null ? {} : { staySeconds: input.staySeconds }),
			...(input.transition === null ? {} : { transition: input.transition })
		},
		[
			{ kind: 'stop', id: input.ids.stop! },
			...(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id }))
		]
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
		(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id }))
	);
}

/** Edit one Presentation's bounded fields, or rebind it to a captured View. */
export function presentationUpdateIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: { readonly projectId: string; readonly revisionId: string };
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly presentationId: string;
	/** `null` follows the linked Scene entity's live name. */
	readonly label?: string | null;
	/** Relink to a Scene entity, or unlink with `null` and an own label. */
	readonly subject?: SemanticReference | null;
	readonly explorable?: boolean;
	readonly text?: { kind: 'plain'; body: string } | null;
	readonly view?: CapturedViewPose;
	/**
	 * The ordered Views with their Cut/Travel steps: the same Views (a reorder or a
	 * step change). View 1 is the Default.
	 */
	readonly views?: readonly ExperiencePresentationView[];
	/** View pairs a Travel step needs a straight Camera path for (one Undo). */
	readonly travelPaths?: readonly { readonly fromViewId: string; readonly toViewId: string }[];
}): AuthoringIntent {
	const connectionIds = input.ids.connections ?? (input.ids.connection === undefined ? [] : [input.ids.connection]);
	return intent(
		EXPERIENCE_PRESENTATION_UPDATE_KIND,
		input.ids,
		input.revision,
		[experienceMemberReference(input.envelope, input.experienceId, 'presentation', input.presentationId)],
		{
			...(input.label === undefined ? {} : { label: input.label }),
			...(input.subject === undefined ? {} : { subject: input.subject }),
			...(input.explorable === undefined ? {} : { explorable: input.explorable }),
			...(input.text === undefined ? {} : { text: input.text }),
			...(input.view === undefined ? {} : { view: input.view }),
			...(input.views === undefined ? {} : { views: input.views.map((view) => ({ ...view })) }),
			...(input.travelPaths === undefined || input.travelPaths.length === 0
				? {}
				: { travelPaths: input.travelPaths.map((pair) => ({ ...pair })) })
		},
		[
			...(input.view === undefined ? [] : [{ kind: 'view', id: input.ids.view! }]),
			...(input.travelPaths === undefined && input.ids.connections === undefined
				? []
				: connectionIds.slice(0, input.travelPaths?.length ?? connectionIds.length).map((id) => ({ kind: 'connection', id })))
		]
	);
}

/** Edit one Stop's entry View, stay, invitation or continuation. */
export function stopUpdateIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: { readonly projectId: string; readonly revisionId: string };
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly stopId: string;
	/** `null` follows the Presentation's Default. */
	readonly entryViewId?: string | null;
	readonly staySeconds?: number;
	readonly invitation?: ExperienceInvitation | null;
	readonly transition?: ExperienceTransitionKind | null;
}): AuthoringIntent {
	return intent(
		EXPERIENCE_STOP_UPDATE_KIND,
		input.ids,
		input.revision,
		[experienceMemberReference(input.envelope, input.experienceId, 'stop', input.stopId)],
		{
			...(input.entryViewId === undefined ? {} : { entryViewId: input.entryViewId }),
			...(input.staySeconds === undefined ? {} : { staySeconds: input.staySeconds }),
			...(input.invitation === undefined ? {} : { invitation: input.invitation }),
			...(input.transition === undefined ? {} : { transition: input.transition })
		},
		(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id }))
	);
}

type Revision = { readonly projectId: string; readonly revisionId: string };

/** R217.S26 — rename the Experience or choose its Opening Guide. */
export function experienceUpdateIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: Revision;
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly label?: string;
	readonly entryGuideId?: string;
	readonly welcome?: { kind: 'plain'; body: string } | null;
}): AuthoringIntent {
	return intent(
		EXPERIENCE_UPDATE_KIND,
		input.ids,
		input.revision,
		[experienceReference(input.envelope, input.experienceId)],
		{
			...(input.label === undefined ? {} : { label: input.label }),
			...(input.entryGuideId === undefined ? {} : { entryGuideId: input.entryGuideId }),
			...(input.welcome === undefined ? {} : { welcome: input.welcome })
		},
		[]
	);
}

/** R217.S26 — rename a Guide or set its pacing (sheet §31). */
export function guideUpdateIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: Revision;
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly guideId: string;
	readonly label?: string;
	readonly pacing?: ExperienceGuidePacing;
}): AuthoringIntent {
	return intent(
		EXPERIENCE_GUIDE_UPDATE_KIND,
		input.ids,
		input.revision,
		[experienceMemberReference(input.envelope, input.experienceId, 'guide', input.guideId)],
		{
			...(input.label === undefined ? {} : { label: input.label }),
			...(input.pacing === undefined ? {} : { pacing: input.pacing })
		},
		[]
	);
}

/**
 * Rewrite one Camera View's authored pose and label through `camera-view-update`.
 * Connectivity is never sent: it is a Camera connection operation of its own.
 */
export function viewUpdateIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: Revision;
	readonly ids: CommandIds;
	readonly view: CameraView;
	readonly label?: string;
	readonly eye?: readonly [number, number, number];
	readonly target?: readonly [number, number, number];
	readonly fov?: number;
}): AuthoringIntent {
	const eye = input.eye ?? input.view.eye;
	const target = input.target ?? input.view.target;
	return intent(
		CAMERA_VIEW_UPDATE_KIND,
		input.ids,
		input.revision,
		[
			{
				version: 1,
				domain: 'camera',
				revision: { kind: 'exact', contentRevision: input.envelope.units.camera.header.contentRevision },
				subject: { kind: 'view', id: input.view.id },
				instancePath: [],
				location: { kind: 'project-root' },
				componentId: null,
				capabilityId: null
			}
		],
		{
			label: input.label ?? input.view.label,
			eye: [eye[0], eye[1], eye[2]],
			target: [target[0], target[1], target[2]],
			fov: input.fov ?? input.view.fov
		},
		[]
	);
}

/**
 * R217.S26 — rename a Camera View. The operation rewrites the View's whole pose, so
 * the pose is sent back exactly as authored: only the label changes.
 */
export function viewRenameIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: Revision;
	readonly ids: CommandIds;
	readonly view: CameraView;
	readonly label: string;
}): AuthoringIntent {
	return intent(
		CAMERA_VIEW_UPDATE_KIND,
		input.ids,
		input.revision,
		[
			{
				version: 1,
				domain: 'camera',
				revision: { kind: 'exact', contentRevision: input.envelope.units.camera.header.contentRevision },
				subject: { kind: 'view', id: input.view.id },
				instancePath: [],
				location: { kind: 'project-root' },
				componentId: null,
				capabilityId: null
			}
		],
		{
			label: input.label,
			eye: [...input.view.eye],
			target: [...input.view.target],
			fov: input.view.fov
		},
		[]
	);
}

/** One current Camera View at the Camera unit's exact revision. */
function cameraViewReference(envelope: ProjectEnvelope, viewId: string): SemanticReference {
	return {
		version: 1,
		domain: 'camera',
		revision: { kind: 'exact', contentRevision: envelope.units.camera.header.contentRevision },
		subject: { kind: 'view', id: viewId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

/**
 * R217.S29 (E11) — one straight Camera path from the exit View to the entry
 * View, with the captured connection id and Camera's automatic duration.
 */
export function cameraConnectionCreateIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: Revision;
	readonly ids: CommandIds;
	readonly fromView: CameraView;
	readonly toView: CameraView;
}): AuthoringIntent {
	return intent(
		CAMERA_CONNECTION_CREATE_KIND,
		input.ids,
		input.revision,
		[
			cameraViewReference(input.envelope, input.fromView.id),
			cameraViewReference(input.envelope, input.toView.id)
		],
		{},
		[{ kind: 'connection', id: input.ids.connection! }]
	);
}

/**
 * R217.S29 — replace one Camera path's interior anchors or one direction's
 * duration. `durationSeconds: null` clears only that direction's duration.
 */
export function cameraConnectionUpdateIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: Revision;
	readonly ids: CommandIds;
	readonly connectionId: string;
	readonly anchors?: readonly ScenePathAnchor[];
	readonly timing?: {
		readonly forward?: { readonly durationSeconds: number | null };
		readonly reverse?: { readonly durationSeconds: number | null };
	};
}): AuthoringIntent {
	return intent(
		CAMERA_CONNECTION_UPDATE_KIND,
		input.ids,
		input.revision,
		[
			{
				version: 1,
				domain: 'camera',
				revision: { kind: 'exact', contentRevision: input.envelope.units.camera.header.contentRevision },
				subject: { kind: 'connection', id: input.connectionId },
				instancePath: [],
				location: { kind: 'project-root' },
				componentId: null,
				capabilityId: null
			}
		],
		{
			...(input.anchors === undefined
				? {}
				: { anchors: input.anchors.map((anchor) => ({ id: anchor.id, position: [...anchor.position] })) }),
			...(input.timing === undefined ? {} : { timing: input.timing })
		},
		[]
	);
}

/** R217.S26 (E4) — remove one Stop, one Guide or one Presentation. */
export function removeIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: Revision;
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly subject: 'stop' | 'guide' | 'presentation';
	readonly id: string;
}): AuthoringIntent {
	const kind =
		input.subject === 'stop'
			? EXPERIENCE_STOP_REMOVE_KIND
			: input.subject === 'guide'
				? EXPERIENCE_GUIDE_REMOVE_KIND
				: EXPERIENCE_PRESENTATION_REMOVE_KIND;
	return intent(
		kind,
		input.ids,
		input.revision,
		[experienceMemberReference(input.envelope, input.experienceId, input.subject, input.id)],
		{},
		(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id }))
	);
}

/** R217.S26 (E4) — remove one View from one Presentation; removing View 1 makes the next View the Default unless one is named. */
export function viewRemoveIntent(input: {
	readonly envelope: ProjectEnvelope;
	readonly revision: Revision;
	readonly ids: CommandIds;
	readonly experienceId: string;
	readonly presentationId: string;
	readonly viewId: string;
	readonly defaultViewId: string | null;
}): AuthoringIntent {
	return intent(
		EXPERIENCE_PRESENTATION_VIEW_REMOVE_KIND,
		input.ids,
		input.revision,
		[experienceMemberReference(input.envelope, input.experienceId, 'presentation', input.presentationId)],
		{ viewId: input.viewId, ...(input.defaultViewId === null ? {} : { defaultViewId: input.defaultViewId }) },
		(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id }))
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
