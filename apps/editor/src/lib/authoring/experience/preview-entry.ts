/**
 * Preview entry (T3.P02.S01).
 *
 * The Preview entry rule is the owner-accepted shell draft's: Preview enters *what
 * you are working on* — the selected Stop of an open Guide, otherwise the
 * Experience's entry Guide; from a selected Presentation, that Presentation alone
 * through Presentation entry; with no Guide at all, the visitor list of enterable
 * Presentations. A Presentation without a Default View is listed as unavailable
 * with its reason rather than entered or silently dropped.
 *
 * Lowering is the one shared Experience pipeline: Preview calls the same
 * `lowerExperienceProgram` the visitor does and executes the same interpreter. It
 * never builds a second program, a second order or a Stop for a Presentation that
 * has none. Each entry mints a fresh run epoch, so a later entry cannot accept a
 * completion from an earlier one.
 */

import type { ProjectEnvelope } from '@portfolio/project-model/units';
import {
	lowerExperienceProgram,
	type ExperienceInterpreterOptions,
	type ExperienceLoweringRefusal,
	type ExperienceProgramTransition,
	type ExecutionProgram,
	type ProgramInvocation
} from '@portfolio/project-model/units';

export type ExperienceFocus = {
	readonly experienceId: string | null;
	readonly guideId: string | null;
	readonly stopId: string | null;
	readonly presentationId: string | null;
};

export const EMPTY_EXPERIENCE_FOCUS: ExperienceFocus = {
	experienceId: null,
	guideId: null,
	stopId: null,
	presentationId: null
};

export type PreviewUnavailablePresentation = {
	readonly presentationId: string;
	readonly label: string;
	readonly reason: string;
};

export type PreviewEntry =
	| {
			readonly kind: 'program';
			readonly experienceId: string;
			readonly title: string;
			readonly program: ExecutionProgram;
			readonly options: ExperienceInterpreterOptions;
			readonly transitions: readonly ExperienceProgramTransition[];
			readonly entryPresentationId: string | null;
			readonly unavailable: readonly PreviewUnavailablePresentation[];
	  }
	| {
			readonly kind: 'presentations';
			readonly experienceId: string;
			readonly title: string;
			readonly presentations: readonly { readonly id: string; readonly label: string }[];
			readonly unavailable: readonly PreviewUnavailablePresentation[];
			/** The guide-free program the visitor list selects from. */
			readonly program?: ExecutionProgram;
			readonly options?: ExperienceInterpreterOptions;
			readonly transitions?: readonly ExperienceProgramTransition[];
	  }
	| { readonly kind: 'unavailable'; readonly message: string };

/** An entry Preview can actually enter; the Head never stores an unavailable one. */
export type EnterablePreviewEntry = Exclude<PreviewEntry, { readonly kind: 'unavailable' }>;

function titleOf(envelope: ProjectEnvelope, experienceId: string): string {
	const experience = envelope.units.experience.data.experiences.find((entry) => entry.id === experienceId);
	return experience?.label ?? experienceId;
}

function unavailableFrom(
	lowered: Extract<ReturnType<typeof lowerExperienceProgram>, { kind: 'lowered' }>,
	envelope: ProjectEnvelope,
	experienceId: string
): PreviewUnavailablePresentation[] {
	const experience = envelope.units.experience.data.experiences.find((entry) => entry.id === experienceId);
	if (experience === undefined) return [];
	return lowered.unavailablePresentations.map((entry) => {
		const presentation = experience.presentations.find((candidate) => candidate.id === entry.presentationId);
		return {
			presentationId: entry.presentationId,
			label: presentation?.label ?? entry.presentationId,
			reason:
				entry.reason === 'no-default-view'
					? 'No Default View is set, so this Presentation cannot be entered.'
					: 'Its Default View is not in this source, so this Presentation cannot be entered.'
		};
	});
}

function refusalMessage(refusal: ExperienceLoweringRefusal): string {
	return `Preview cannot start: ${refusal.message}.`;
}

/**
 * Resolve the Preview entry for one focus.
 *
 * A fresh `runEpoch` and `runId` are minted by the caller's epoch value; the
 * source content id is the accepted snapshot's, so an event from a previous source
 * or entry is stale rather than accepted against the new one.
 */
export function previewEntryFor(input: {
	readonly envelope: ProjectEnvelope;
	readonly sourceContentId: string;
	readonly sessionEpoch: string;
	readonly epoch: number;
	readonly focus: ExperienceFocus;
}): PreviewEntry {
	const { envelope, focus } = input;
	const experiences = envelope.units.experience.data.experiences;
	if (focus.experienceId === null) {
		if (experiences.length === 0) {
			return { kind: 'unavailable', message: 'There is no Experience in this source to Preview.' };
		}
		if (experiences.length > 1) {
			return {
				kind: 'unavailable',
				message: 'This source holds several Experiences; open one in the Experience lens first.'
			};
		}
	}
	// From the World lens there may be no lens focus yet; a lone Experience is
	// unambiguously what the creator is working on. Several are never guessed.
	const experienceId = focus.experienceId ?? experiences[0]!.id;
	const experience = experiences.find((entry) => entry.id === experienceId);
	if (experience === undefined) {
		return { kind: 'unavailable', message: `The source does not carry Experience "${experienceId}".` };
	}
	const runId = `${input.sessionEpoch}:preview:${input.epoch}`;
	const options = (program: ExecutionProgram, transitions: readonly ExperienceProgramTransition[]): ExperienceInterpreterOptions => ({
		runId,
		runEpoch: input.epoch,
		sourceContentId: input.sourceContentId,
		gates: experience.gates.map((gate) => gate.presentationId),
		detours: experience.detours.map((detour) => ({
			fromStopId: detour.fromStopId,
			toStopId: detour.toStopId,
			returnToStopId: detour.returnToStopId
		})),
		transitions
	});

	const baseLowering = {
		experienceId: experience.id,
		sourceContentId: input.sourceContentId,
		sessionEpoch: input.sessionEpoch
	};

	// 1. The selected Stop of an open Guide, otherwise that Guide's entry Stop.
	const openGuide = focus.guideId === null
		? null
		: experience.guides.find((guide) => guide.id === focus.guideId) ?? null;
	if (openGuide !== null) {
		const selectedStop = focus.stopId !== null && openGuide.stopIds.includes(focus.stopId)
			? focus.stopId
			: openGuide.entryStopId;
		const lowered = lowerExperienceProgram(envelope, {
			...baseLowering,
			guideId: openGuide.id,
			entryStopId: selectedStop
		});
		if (lowered.kind === 'refused') return { kind: 'unavailable', message: refusalMessage(lowered) };
		return {
			kind: 'program',
			experienceId: experience.id,
			title: `${experience.label} · ${openGuide.label}`,
			program: lowered.program,
			options: options(lowered.program, lowered.transitions),
			transitions: lowered.transitions,
			entryPresentationId: null,
			unavailable: unavailableFrom(lowered, envelope, experience.id)
		};
	}

	// 2. A selected Presentation with no Guide open: that Presentation alone.
	if (focus.presentationId !== null) {
		const lowered = lowerExperienceProgram(envelope, {
			...baseLowering,
			// The selected Presentation is entered alone: the unrelated entry Guide's
			// Stops and transitions must not refuse or shape this preview.
			guideId: null
		});
		if (lowered.kind === 'refused') return { kind: 'unavailable', message: refusalMessage(lowered) };
		const presentation = lowered.program.presentations.find((entry) => entry.id === focus.presentationId);
		if (presentation === undefined) {
			const reason = unavailableFrom(lowered, envelope, experience.id).find(
				(entry) => entry.presentationId === focus.presentationId
			);
			return {
				kind: 'presentations',
				experienceId: experience.id,
				title: experience.label,
				presentations: [],
				unavailable:
					reason === undefined
						? [
								{
									presentationId: focus.presentationId,
									label: focus.presentationId,
									reason: 'This Presentation is not enterable in the current source.'
								}
							]
						: [reason]
			};
		}
		return {
			kind: 'program',
			experienceId: experience.id,
			title: presentation.label,
			program: lowered.program,
			options: options(lowered.program, lowered.transitions),
			transitions: lowered.transitions,
			entryPresentationId: presentation.id,
			unavailable: unavailableFrom(lowered, envelope, experience.id)
		};
	}

	// 3. The Experience's entry Guide, when it has one.
	if (experience.entryGuideId !== null) {
		const lowered = lowerExperienceProgram(envelope, {
			...baseLowering,
			guideId: experience.entryGuideId
		});
		if (lowered.kind === 'refused') return { kind: 'unavailable', message: refusalMessage(lowered) };
		return {
			kind: 'program',
			experienceId: experience.id,
			title: experience.label,
			program: lowered.program,
			options: options(lowered.program, lowered.transitions),
			transitions: lowered.transitions,
			entryPresentationId: null,
			unavailable: unavailableFrom(lowered, envelope, experience.id)
		};
	}

	// 4. No Guide at all: the visitor list of enterable Presentations.
	const lowered = lowerExperienceProgram(envelope, baseLowering);
	if (lowered.kind === 'refused') return { kind: 'unavailable', message: refusalMessage(lowered) };
	return {
		kind: 'presentations',
		experienceId: experience.id,
		title: experience.label,
		presentations: lowered.program.presentations.map((presentation) => ({
			id: presentation.id,
			label: presentation.label
		})),
		unavailable: unavailableFrom(lowered, envelope, experience.id),
		program: lowered.program,
		options: options(lowered.program, lowered.transitions),
		transitions: lowered.transitions
	};
}

/** Program invocation a Presentation entry realizes: a Cut to its Default View. */
export function presentationEntryInvocation(program: ExecutionProgram, presentationId: string): ProgramInvocation | null {
	const presentation = program.presentations.find((entry) => entry.id === presentationId);
	return presentation === undefined ? null : { kind: 'cut', viewId: presentation.defaultViewId };
}
