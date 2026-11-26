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
import type { ScenePathAnchor } from '@portfolio/project-model/scene';
import type { ExperienceGuidePacing, ProjectEnvelope } from '@portfolio/project-model/units';
import { type CameraView } from '@portfolio/project-model/units';
import {
	CAMERA_CONNECTION_CREATE_KIND,
	CAMERA_CONNECTION_UPDATE_KIND,
	CAMERA_VIEW_UPDATE_KIND,
	EXPERIENCE_GUIDE_REMOVE_KIND,
	EXPERIENCE_GUIDE_UPDATE_KIND,
	EXPERIENCE_PRESENTATION_REMOVE_KIND,
	EXPERIENCE_PRESENTATION_VIEW_REMOVE_KIND,
	EXPERIENCE_STOP_REMOVE_KIND,
} from '@portfolio/project-model/units/planning';
import {
	cameraViewReference,
	experienceMemberReference,
	intent,
	type CommandIds,
	type Revision,
} from './commands-references';

/** Rename a Guide or set its pacing (sheet §31). */
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
			...(input.pacing === undefined ? {} : { pacing: input.pacing }),
		},
		[],
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
				revision: {
					kind: 'exact',
					contentRevision: input.envelope.units.camera.header.contentRevision,
				},
				subject: { kind: 'view', id: input.view.id },
				instancePath: [],
				location: { kind: 'project-root' },
				componentId: null,
				capabilityId: null,
			},
		],
		{
			label: input.label ?? input.view.label,
			eye: [eye[0], eye[1], eye[2]],
			target: [target[0], target[1], target[2]],
			fov: input.fov ?? input.view.fov,
		},
		[],
	);
}

/**
 * Rename a Camera View. The operation rewrites the View's whole pose, so
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
				revision: {
					kind: 'exact',
					contentRevision: input.envelope.units.camera.header.contentRevision,
				},
				subject: { kind: 'view', id: input.view.id },
				instancePath: [],
				location: { kind: 'project-root' },
				componentId: null,
				capabilityId: null,
			},
		],
		{
			label: input.label,
			eye: [...input.view.eye],
			target: [...input.view.target],
			fov: input.view.fov,
		},
		[],
	);
}

/** One current Camera View at the Camera unit's exact revision. */

/**
 * One straight Camera path from the exit View to the entry
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
			cameraViewReference(input.envelope, input.toView.id),
		],
		{},
		[{ kind: 'connection', id: input.ids.connection! }],
	);
}

/**
 * Replace one Camera path's interior anchors or one direction's
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
				revision: {
					kind: 'exact',
					contentRevision: input.envelope.units.camera.header.contentRevision,
				},
				subject: { kind: 'connection', id: input.connectionId },
				instancePath: [],
				location: { kind: 'project-root' },
				componentId: null,
				capabilityId: null,
			},
		],
		{
			...(input.anchors === undefined
				? {}
				: {
						anchors: input.anchors.map((anchor) => ({
							id: anchor.id,
							position: [...anchor.position],
						})),
					}),
			...(input.timing === undefined ? {} : { timing: input.timing }),
		},
		[],
	);
}

/** Remove one Stop, one Guide or one Presentation. */
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
		(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id })),
	);
}

/** Remove one View from one Presentation; removing View 1 makes the next View the Default unless one is named. */
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
		[
			experienceMemberReference(
				input.envelope,
				input.experienceId,
				'presentation',
				input.presentationId,
			),
		],
		{
			viewId: input.viewId,
			...(input.defaultViewId === null ? {} : { defaultViewId: input.defaultViewId }),
		},
		(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id })),
	);
}

/** A captured View at the Stage's current framing. Aspect is the viewport's, not a View field. */
