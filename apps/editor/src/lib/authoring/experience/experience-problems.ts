import {
	validateProjectEnvelope,
	type EnvelopeDiagnostic,
	type Experience,
	type ExperienceGuide,
	type ExperienceLoweringRefusal,
	type ExperiencePresentation,
	type ExperienceStop,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

/**
 * The one Card subject a problem can point at. It mirrors the Experience lens's
 * subjects, so *Show* selects the same thing a card or connector would.
 */
export type ExperienceProblemSubject =
	| { readonly kind: 'presentation'; readonly presentationId: string }
	| { readonly kind: 'view'; readonly viewId: string; readonly presentationId: string }
	| { readonly kind: 'stop'; readonly stopId: string }
	| { readonly kind: 'transition'; readonly stopId: string }
	| { readonly kind: 'guide'; readonly guideId: string };

/**
 * One source problem, worded for a creator. `sentence`, `fix` and the subject
 * never carry an opaque id: those live in `detail`, which only *Copy details*
 * shows. A finding this module cannot word still becomes a problem, so nothing
 * the validator reports is hidden.
 */
export type ExperienceProblem = {
	readonly code: string;
	readonly sentence: string;
	readonly subject: ExperienceProblemSubject | null;
	readonly fix: string | null;
	/** Codes, paths and ids, for Copy details only. */
	readonly detail: string;
};

const EXPERIENCE_PATH = /^\$\.units\.experience\.data\.experiences\[(\d+)\]/;
const STOP_PATH = /\.stops\[(\d+)\]/;
const PRESENTATION_PATH = /\.presentations\[(\d+)\]/;
const PRESENTATION_VIEW_PATH = /\.presentations\[(\d+)\]\.views\[(\d+)\]/;
const GUIDE_PATH = /\.guides\[(\d+)\]/;

function experienceAt(envelope: ProjectEnvelope, path: string): Experience | null {
	const index = Number(EXPERIENCE_PATH.exec(path)?.[1]);
	return Number.isInteger(index) ? envelope.units.experience.data.experiences[index] ?? null : null;
}

function stopAt(experience: Experience, path: string): ExperienceStop | null {
	const index = Number(STOP_PATH.exec(path)?.[1]);
	return Number.isInteger(index) ? experience.stops[index] ?? null : null;
}

function presentationAt(experience: Experience, path: string): ExperiencePresentation | null {
	const index = Number(PRESENTATION_PATH.exec(path)?.[1]);
	return Number.isInteger(index) ? experience.presentations[index] ?? null : null;
}

function presentationViewAt(
	experience: Experience,
	path: string
): { readonly presentation: ExperiencePresentation; readonly position: number } | null {
	const match = PRESENTATION_VIEW_PATH.exec(path);
	if (match === null) return null;
	const presentation = experience.presentations[Number(match[1])];
	const position = Number(match[2]);
	return presentation === undefined || !Number.isInteger(position) || presentation.views[position] === undefined
		? null
		: { presentation, position };
}

function guideAt(experience: Experience, path: string): ExperienceGuide | null {
	const index = Number(GUIDE_PATH.exec(path)?.[1]);
	return Number.isInteger(index) ? experience.guides[index] ?? null : null;
}

function guideOf(experience: Experience, stopId: string): ExperienceGuide | null {
	return experience.guides.find((guide) => guide.stopIds.includes(stopId)) ?? null;
}

/** The Stop's one-based place in its Guide; 0 when no Guide orders it. */
export function stopNumber(experience: Experience, stopId: string): number {
	const guide = guideOf(experience, stopId);
	if (guide === null) return 0;
	return guide.stopIds.indexOf(stopId) + 1;
}

function stopName(experience: Experience, stopId: string): string {
	const number = stopNumber(experience, stopId);
	return number === 0 ? 'A Stop' : `Stop ${number}`;
}

function nextStopId(experience: Experience, stopId: string): string | null {
	const guide = guideOf(experience, stopId);
	if (guide === null) return null;
	return guide.stopIds[guide.stopIds.indexOf(stopId) + 1] ?? null;
}

function entryViewId(experience: Experience, stop: ExperienceStop): string | null {
	const presentation = experience.presentations.find((entry) => entry.id === stop.presentationId);
	return stop.entryViewId ?? presentation?.views[0]?.viewId ?? null;
}

function presentationName(presentation: ExperiencePresentation): string {
	return presentation.label ?? 'this Presentation';
}

function viewName(envelope: ProjectEnvelope, viewId: string | null): string {
	if (viewId === null) return 'a missing View';
	const view = envelope.units.camera.data.views.find((entry) => entry.id === viewId);
	return view?.label ?? 'a missing View';
}

function detailOf(finding: { readonly path: string; readonly code: string; readonly message: string }): string {
	return `${finding.code} · ${finding.path} · ${finding.message}`;
}

function fallback(finding: EnvelopeDiagnostic): ExperienceProblem {
	return {
		code: finding.code,
		sentence: 'This file points at something it does not carry.',
		subject: null,
		fix: 'Open it in a source the editor can read, or remove what is missing.',
		detail: detailOf(finding)
	};
}

/** Words one validator diagnostic. `null` means this module has no better sentence. */
function wordDiagnostic(envelope: ProjectEnvelope, finding: EnvelopeDiagnostic): ExperienceProblem | null {
	const experience = experienceAt(envelope, finding.path);
	if (experience === null) return null;
	const stop = stopAt(experience, finding.path);
	const guide = guideAt(experience, finding.path);
	switch (finding.code) {
		case 'travel-gap': {
			if (stop !== null) {
				const targetId = nextStopId(experience, stop.id);
				return {
					code: finding.code,
					sentence: `${stopName(experience, stop.id)}'s Travel to ${
						targetId === null ? 'the next Stop' : stopName(experience, targetId)
					} needs a Camera path.`,
					subject: { kind: 'transition', stopId: stop.id },
					fix: 'Add a Camera path for this move.',
					detail: detailOf(finding)
				};
			}
			const view = presentationViewAt(experience, finding.path);
			if (view !== null) {
				const current = view.presentation.views[view.position]!;
				const next = view.presentation.views[view.position + 1];
				return {
					code: finding.code,
					sentence: `${presentationName(view.presentation)} moves from “${viewName(
						envelope,
						current.viewId
					)}” to “${viewName(envelope, next?.viewId ?? null)}” with no Camera path.`,
					subject: { kind: 'view', viewId: current.viewId, presentationId: view.presentation.id },
					fix: 'Add a Camera path between those Views.',
					detail: detailOf(finding)
				};
			}
			return null;
		}
		case 'travel-same-view': {
			const ids = /Stop "([^"]+)" to "([^"]+)"/.exec(finding.message);
			const viewId = /View "([^"]+)"/.exec(finding.message)?.[1] ?? null;
			const from = ids === null ? null : experience.stops.find((entry) => entry.id === ids[1]) ?? null;
			const to = ids === null ? null : experience.stops.find((entry) => entry.id === ids[2]) ?? null;
			if (from === null || to === null) return null;
			return {
				code: finding.code,
				sentence: `${stopName(experience, from.id)}'s Travel to ${stopName(
					experience,
					to.id
				)} joins “${viewName(envelope, viewId)}” to itself, so that step is a Cut.`,
				subject: { kind: 'transition', stopId: from.id },
				fix: 'Leave that step as a Cut.',
				detail: detailOf(finding)
			};
		}
		case 'travel-after-last': {
			const named = /Guide "([^"]+)"/.exec(finding.message)?.[1] ?? null;
			const owned = named === null ? null : experience.guides.find((entry) => entry.id === named) ?? null;
			return {
				code: finding.code,
				sentence:
					owned === null
						? 'A Guide ends on a Stop that still leaves by a Travel; the last Stop has no next Stop.'
						: `“${owned.label}” ends on a Stop that still leaves by a Travel; the last Stop has no next Stop.`,
				subject: owned === null ? null : { kind: 'guide', guideId: owned.id },
				fix: 'Make the last Stop’s step a Cut.',
				detail: detailOf(finding)
			};
		}
		case 'stop-guide-membership':
			return {
				code: finding.code,
				sentence: 'A Stop must appear in exactly one Guide.',
				subject: null,
				fix: 'Put each Stop in one Guide, once.',
				detail: detailOf(finding)
			};
		case 'unresolved-view': {
			const view = presentationViewAt(experience, finding.path);
			if (view !== null) {
				return {
					code: finding.code,
					sentence: `${presentationName(view.presentation)} shows a View this file does not carry.`,
					subject: {
						kind: 'view',
						viewId: view.presentation.views[view.position]!.viewId,
						presentationId: view.presentation.id
					},
					fix: 'Restore the Camera View, or remove it from this Presentation.',
					detail: detailOf(finding)
				};
			}
			if (stop !== null) {
				return {
					code: finding.code,
					sentence: `${stopName(experience, stop.id)} enters a View this file does not carry.`,
					subject: { kind: 'stop', stopId: stop.id },
					fix: 'Restore the Camera View, or choose another entry View.',
					detail: detailOf(finding)
				};
			}
			return null;
		}
		case 'unresolved-presentation': {
			if (stop === null) return null;
			return {
				code: finding.code,
				sentence: `${stopName(experience, stop.id)} points at a Presentation this file does not carry.`,
				subject: { kind: 'stop', stopId: stop.id },
				fix: 'Restore the Presentation, or remove the Stop.',
				detail: detailOf(finding)
			};
		}
		case 'unresolved-stop': {
			if (guide !== null) {
				return {
					code: finding.code,
					sentence: `“${guide.label}” orders a Stop this file does not carry.`,
					subject: { kind: 'guide', guideId: guide.id },
					fix: 'Remove the missing Stop from the Guide.',
					detail: detailOf(finding)
				};
			}
			return {
				code: finding.code,
				sentence: 'A Detour points at a Stop this file does not carry.',
				subject: null,
				fix: 'Remove the Detour, or restore its Stop.',
				detail: detailOf(finding)
			};
		}
		case 'unresolved-subject': {
			const presentation = presentationAt(experience, finding.path);
			return {
				code: finding.code,
				sentence:
					presentation === null
						? 'A Presentation names an object this Preview cannot show.'
						: `“${presentationName(presentation)}” names an object this Preview cannot show.`,
				subject: presentation === null ? null : { kind: 'presentation', presentationId: presentation.id },
				fix: 'Choose an object in this source, or leave the Presentation without one.',
				detail: detailOf(finding)
			};
		}
		default:
			return null;
	}
}

/**
 * Every source diagnostic as one plain-language problem.
 *
 * The validator is the source of truth: this function filters and words its
 * findings, never re-deriving them, and never evaluates Camera. Findings outside
 * an Experience keep a generic sentence so nothing is hidden.
 */
export function experienceProblems(
	envelope: ProjectEnvelope,
	diagnostics?: readonly EnvelopeDiagnostic[]
): readonly ExperienceProblem[] {
	const validation = validateProjectEnvelope(envelope);
	const findings = diagnostics ?? (validation.success ? validation.diagnostics : []);
	return findings.map((finding) => wordDiagnostic(envelope, finding) ?? fallback(finding));
}

function stopById(envelope: ProjectEnvelope, stopId: string): { experience: Experience; stop: ExperienceStop } | null {
	for (const experience of envelope.units.experience.data.experiences) {
		const stop = experience.stops.find((entry) => entry.id === stopId);
		if (stop !== undefined) return { experience, stop };
	}
	return null;
}

/**
 * Words one lowering refusal. Preview refuses instead of guessing, and this turns
 * that refusal into the same plain shape as a validator problem so the chip can
 * show it and *Show* can open the Transition Card.
 */
export function loweringProblem(envelope: ProjectEnvelope, refusal: ExperienceLoweringRefusal): ExperienceProblem {
	const found = refusal.stopId === undefined ? null : stopById(envelope, refusal.stopId);
	const detail = `${refusal.code} · ${refusal.message}`;
	if (found === null) {
		return {
			code: refusal.code,
			sentence: 'Preview cannot start because this Experience is not complete.',
			subject: null,
			fix: null,
			detail
		};
	}
	const { experience, stop } = found;
	const targetId = nextStopId(experience, stop.id);
	const targetName = targetId === null ? 'the next Stop' : stopName(experience, targetId);
	const fromView = viewName(envelope, entryViewId(experience, stop));
	const target = targetId === null ? null : experience.stops.find((entry) => entry.id === targetId) ?? null;
	const toView = viewName(envelope, target === null ? null : entryViewId(experience, target));
	switch (refusal.code) {
		case 'travel-ambiguous':
			return {
				code: refusal.code,
				sentence: `${stopName(experience, stop.id)}'s Travel to ${targetName} joins “${fromView}” and “${toView}” with more than one Camera path, so the editor will not choose.`,
				subject: { kind: 'transition', stopId: stop.id },
				fix: 'Keep one Camera path between those Views.',
				detail
			};
		case 'travel-gap':
			return {
				code: refusal.code,
				sentence: `${stopName(experience, stop.id)}'s Travel to ${targetName} needs a Camera path.`,
				subject: { kind: 'transition', stopId: stop.id },
				fix: 'Add a Camera path for this move.',
				detail
			};
		case 'missing-entry':
			return {
				code: refusal.code,
				sentence: `${stopName(experience, stop.id)} has no View to enter, so Preview cannot start.`,
				subject: { kind: 'stop', stopId: stop.id },
				fix: 'Choose the View this Stop enters, or restore it.',
				detail
			};
		default:
			return {
				code: refusal.code,
				sentence: 'Preview cannot start because this Experience is not complete.',
				subject: { kind: 'stop', stopId: stop.id },
				fix: null,
				detail
			};
	}
}

/**
 * The `travel-gap` findings the envelope validator already computes for one
 * Stop's outgoing edge. This is a filter over those findings, not a second gap
 * computation, and it never evaluates Camera.
 */
export function travelGapMessages(
	envelope: ProjectEnvelope,
	experienceId: string,
	stopId: string
): readonly string[] {
	const experienceIndex = envelope.units.experience.data.experiences.findIndex((entry) => entry.id === experienceId);
	if (experienceIndex < 0) return [];
	const stopIndex = envelope.units.experience.data.experiences[experienceIndex].stops.findIndex(
		(entry) => entry.id === stopId
	);
	if (stopIndex < 0) return [];
	const validation = validateProjectEnvelope(envelope);
	if (!validation.success) return [];
	const prefix = `$.units.experience.data.experiences[${experienceIndex}].stops[${stopIndex}].transition`;
	return validation.diagnostics
		.filter((entry) => entry.code === 'travel-gap' && entry.path.startsWith(prefix))
		.map((entry) => entry.message);
}

/**
 * Every Stop's `travel-gap` findings for one Experience, from one validation of the
 * envelope. Stops with no finding are absent, so a reader treats a missing key as no
 * gap. The messages and their order are `travelGapMessages`'s.
 */
export function travelGapMessagesByStop(
	envelope: ProjectEnvelope,
	experienceId: string
): ReadonlyMap<string, readonly string[]> {
	const gaps = new Map<string, string[]>();
	const experienceIndex = envelope.units.experience.data.experiences.findIndex((entry) => entry.id === experienceId);
	if (experienceIndex < 0) return gaps;
	const stops = envelope.units.experience.data.experiences[experienceIndex].stops;
	const validation = validateProjectEnvelope(envelope);
	if (!validation.success) return gaps;
	const prefix = `$.units.experience.data.experiences[${experienceIndex}].stops[`;
	for (const entry of validation.diagnostics) {
		if (entry.code !== 'travel-gap' || !entry.path.startsWith(prefix)) continue;
		const stopIndex = Number(/^(\d+)\]\.transition/.exec(entry.path.slice(prefix.length))?.[1]);
		const stop = Number.isInteger(stopIndex) ? stops[stopIndex] : undefined;
		if (stop === undefined) continue;
		gaps.set(stop.id, [...(gaps.get(stop.id) ?? []), entry.message]);
	}
	return gaps;
}
