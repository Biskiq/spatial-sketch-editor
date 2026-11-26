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
import type {
	ExperienceInvitation,
	ExperiencePresentationView,
	ProjectEnvelope,
} from '@portfolio/project-model/units';
import { type ExperienceTransitionKind } from '@portfolio/project-model/units';
import {
	EXPERIENCE_CAPTURE_BIND_KIND,
	EXPERIENCE_CREATE_KIND,
	EXPERIENCE_GUIDE_CREATE_KIND,
	EXPERIENCE_GUIDE_ORDER_KIND,
	EXPERIENCE_PRESENTATION_UPDATE_KIND,
	EXPERIENCE_STOP_CREATE_KIND,
	EXPERIENCE_STOP_UPDATE_KIND,
	EXPERIENCE_UPDATE_KIND,
} from '@portfolio/project-model/units/planning';
import {
	experienceMemberReference,
	experienceReference,
	intent,
	sceneEntitySubject,
	type CapturedViewPose,
	type CommandIds,
} from './commands-references';

export function createExperienceIntent(input: {
	readonly revision: { readonly projectId: string; readonly revisionId: string };
	readonly ids: CommandIds;
	readonly label: string;
}): AuthoringIntent {
	return intent(EXPERIENCE_CREATE_KIND, input.ids, input.revision, [], { label: input.label }, [
		{ kind: 'experience', id: input.ids.experience! },
	]);
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
		{ kind: 'presentation', id: input.ids.presentation! },
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
					input.subjectEntityId === null
						? null
						: sceneEntitySubject(input.envelope, input.subjectEntityId),
				text: input.text,
			},
			// A Guide-free capture sends no Stop at all; it never manufactures a Guide
			// or a Stop to hang one on.
			...(input.guideId === null
				? { stop: null }
				: {
						stop: {
							guideId: input.guideId,
							afterStopId: input.guideId === null ? null : input.afterStopId,
							transition: 'cut',
						},
					}),
			...(newExperienceLabel === null ? {} : { newExperience: { label: newExperienceLabel } }),
		},
		allocated,
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
			...(input.transition === null ? {} : { transition: input.transition }),
		},
		[
			{ kind: 'guide', id: input.ids.guide! },
			{ kind: 'stop', id: input.ids.stop! },
			...(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id })),
		],
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
			...(input.transition === null ? {} : { transition: input.transition }),
		},
		[
			{ kind: 'stop', id: input.ids.stop! },
			...(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id })),
		],
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
		(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id })),
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
	const connectionIds =
		input.ids.connections ?? (input.ids.connection === undefined ? [] : [input.ids.connection]);
	return intent(
		EXPERIENCE_PRESENTATION_UPDATE_KIND,
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
			...(input.label === undefined ? {} : { label: input.label }),
			...(input.subject === undefined ? {} : { subject: input.subject }),
			...(input.explorable === undefined ? {} : { explorable: input.explorable }),
			...(input.text === undefined ? {} : { text: input.text }),
			...(input.view === undefined ? {} : { view: input.view }),
			...(input.views === undefined ? {} : { views: input.views.map((view) => ({ ...view })) }),
			...(input.travelPaths === undefined || input.travelPaths.length === 0
				? {}
				: { travelPaths: input.travelPaths.map((pair) => ({ ...pair })) }),
		},
		[
			...(input.view === undefined ? [] : [{ kind: 'view', id: input.ids.view! }]),
			...(input.travelPaths === undefined && input.ids.connections === undefined
				? []
				: connectionIds
						.slice(0, input.travelPaths?.length ?? connectionIds.length)
						.map((id) => ({ kind: 'connection', id }))),
		],
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
			...(input.transition === undefined ? {} : { transition: input.transition }),
		},
		(input.ids.connections ?? []).map((id) => ({ kind: 'connection' as const, id })),
	);
}

export type Revision = { readonly projectId: string; readonly revisionId: string };

/** Rename the Experience or choose its Opening Guide. */
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
			...(input.welcome === undefined ? {} : { welcome: input.welcome }),
		},
		[],
	);
}
