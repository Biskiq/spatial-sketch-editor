/**
 * The Experience homes' reading model (R217.S25).
 *
 * Pure functions of the accepted Experience and Camera facts: what a Card subject is,
 * where a Stop's continuation actually goes, which Stops guide a View, which
 * Presentations are about a Scene entity, and how much of the Experience the Guide
 * reaches. No state, no Camera evaluation, no DOM; the controller derives from these
 * and the Cards render what they return.
 *
 * A Stop is one visit: it enters at its entry View (its own, else the
 * Presentation's Default, View 1) and leaves from the same View. A
 * continuation is read against one Guide: a Stop's neighbour is the next Stop of that
 * Guide, and a chosen target only counts as adjacent when it is that neighbour.
 */
import {
	presentationDefaultViewId,
	presentationViewIds,
	stopEntryViewId as unitStopEntryViewId,
	type CameraView,
	type Experience,
	type ExperienceGuide,
	type ExperiencePresentation,
	type ExperienceStop,
	type ExperienceTransitionKind
} from '@portfolio/project-model/units';

/**
 * The one Card subject (D10). A Stage pick, an Index row, a Guide card or connector, or
 * a Card link replaces it; nothing else does. `transition` is a Stop's outgoing
 * continuation.
 */
export type ExperienceSubject =
	| { readonly kind: 'presentation'; readonly presentationId: string }
	| { readonly kind: 'view'; readonly viewId: string; readonly presentationId: string }
	| { readonly kind: 'stop'; readonly stopId: string }
	| { readonly kind: 'transition'; readonly stopId: string }
	| { readonly kind: 'guide'; readonly guideId: string };

/** What the View Card reads about one View. The lens is the 35 mm equivalent of the vertical field. */
export type ExperienceViewFacts = {
	readonly id: string;
	readonly label: string;
	readonly presentationId: string;
	readonly fovDegrees: number;
	readonly lensMillimetres: number;
	readonly eyeHeightMetres: number;
	readonly isDefault: boolean;
};

/**
 * Where a Stop's continuation really goes, read against one Guide. `explicit` says the
 * author chose the target (an End or a named Stop), not the Guide's own sequence.
 * `position` is 1-based in the Guide; null means the target is not in this Guide.
 */
export type ResolvedContinuation =
	| {
			readonly kind: 'adjacent';
			readonly stopId: string;
			readonly position: number;
			readonly transition: ExperienceTransitionKind;
			readonly explicit: boolean;
	  }
	| {
			readonly kind: 'jump';
			readonly stopId: string;
			readonly position: number | null;
			readonly transition: ExperienceTransitionKind;
			readonly explicit: boolean;
	  }
	| { readonly kind: 'end'; readonly explicit: boolean };

export type ExperienceReach = {
	readonly presentations: number;
	readonly views: number;
	readonly freePresentations: number;
	readonly freeViews: number;
	/** Views reached by free exploration and absent from this Guide. */
	readonly viewsOnlyFree: number;
	readonly hiddenViews: number;
};

/** 35 mm equivalent focal length (24 mm frame height): 12 / tan(fov / 2), rounded. */
export function lensMillimetres(fovDegrees: number): number {
	const half = (fovDegrees * Math.PI) / 360;
	const tangent = Math.tan(half);
	if (!Number.isFinite(tangent) || tangent <= 0) return 0;
	return Math.round(12 / tangent);
}

/** The View a Stop enters at: its own entry, else its Presentation's Default. */
export function stopEntryViewId(experience: Experience, stop: ExperienceStop): string | null {
	return unitStopEntryViewId(stop, experience.presentations.find((entry) => entry.id === stop.presentationId));
}

/** A Stop is one visit: it leaves from the View it entered at. */
export function stopExitViewId(experience: Experience, stop: ExperienceStop): string | null {
	return stopEntryViewId(experience, stop);
}

/** The Presentation holding a View, preferring the named one. */
export function presentationOfView(
	experience: Experience,
	viewId: string,
	presentationId?: string
): ExperiencePresentation | null {
	const named =
		presentationId === undefined
			? undefined
			: experience.presentations.find((entry) => entry.id === presentationId && presentationViewIds(entry).includes(viewId));
	return named ?? experience.presentations.find((entry) => presentationViewIds(entry).includes(viewId)) ?? null;
}

export function viewFactsOf(
	experience: Experience,
	cameraViews: readonly CameraView[],
	viewId: string,
	presentationId?: string,
	floorDatumMeters = 0
): ExperienceViewFacts | null {
	const view = cameraViews.find((entry) => entry.id === viewId);
	const presentation = presentationOfView(experience, viewId, presentationId);
	if (view === undefined || presentation === null) return null;
	return {
		id: view.id,
		label: view.label,
		presentationId: presentation.id,
		fovDegrees: view.fov,
		lensMillimetres: lensMillimetres(view.fov),
		eyeHeightMetres: view.eye[1] - floorDatumMeters,
		isDefault: presentationDefaultViewId(presentation) === view.id
	};
}

/** The Guide's Stops in order, skipping any id the Experience does not carry. */
export function guideStopsOf(experience: Experience, guide: ExperienceGuide | null): readonly ExperienceStop[] {
	if (guide === null) return [];
	const stops: ExperienceStop[] = [];
	for (const stopId of guide.stopIds) {
		const stop = experience.stops.find((entry) => entry.id === stopId);
		if (stop !== undefined) stops.push(stop);
	}
	return stops;
}

/**
 * Resolve one Stop's continuation against a Guide (D11): the sequence's next Stop, a
 * chosen Stop (adjacent only when it is the next one, otherwise a jump), or the End.
 * A sequence-next on the last Stop ends the Experience.
 */
export function resolveContinuation(
	experience: Experience,
	guide: ExperienceGuide | null,
	stopId: string
): ResolvedContinuation | null {
	const stop = experience.stops.find((entry) => entry.id === stopId);
	if (stop === undefined) return null;
	const order = guide?.stopIds ?? [];
	const at = order.indexOf(stopId);
	const next = at === -1 ? undefined : order[at + 1];
	const continuation = stop.continuation;
	if (continuation?.kind === 'end') return { kind: 'end', explicit: true };
	const transition = continuation?.transition ?? 'cut';
	if (continuation?.kind === 'stop') {
		if (continuation.stopId === next) {
			return { kind: 'adjacent', stopId: next, position: at + 2, transition, explicit: true };
		}
		const index = order.indexOf(continuation.stopId);
		return {
			kind: 'jump',
			stopId: continuation.stopId,
			position: index === -1 ? null : index + 1,
			transition,
			explicit: true
		};
	}
	if (next === undefined) return { kind: 'end', explicit: false };
	return { kind: 'adjacent', stopId: next, position: at + 2, transition, explicit: false };
}

export type GuidedViewPosition = { readonly stopId: string; readonly position: number };

/** The Stops of a Guide that enter at this View; positions are one-based in the Guide. */
export function stopsGuiding(
	experience: Experience,
	guide: ExperienceGuide | null,
	viewId: string
): readonly GuidedViewPosition[] {
	const matches: GuidedViewPosition[] = [];
	guide?.stopIds.forEach((stopId, position) => {
		const stop = experience.stops.find((entry) => entry.id === stopId);
		if (stop !== undefined && stopEntryViewId(experience, stop) === viewId) matches.push({ stopId, position: position + 1 });
	});
	return matches;
}

/** Presentations whose subject is this Scene entity. */
export function presentationsAboutEntity(
	experience: Experience,
	entityId: string
): readonly ExperiencePresentation[] {
	return experience.presentations.filter(
		(entry) =>
			entry.subject !== null &&
			entry.subject.domain === 'scene' &&
			entry.subject.subject.kind === 'entity' &&
			entry.subject.subject.id === entityId
	);
}

/** Count distinct Camera Views reached by the Guide, free exploration, or neither. */
export function reachSummary(experience: Experience, guide: ExperienceGuide | null): ExperienceReach {
	const guided = new Set(
		guideStopsOf(experience, guide).flatMap((stop) => {
			const entry = stopEntryViewId(experience, stop);
			return entry === null ? [] : [entry];
		})
	);
	const views = new Set(experience.presentations.flatMap((presentation) => presentationViewIds(presentation)));
	const explorable = experience.presentations.filter((presentation) => presentation.explorable);
	const free = new Set(explorable.flatMap((presentation) => presentationViewIds(presentation)));
	return {
		presentations: experience.presentations.length,
		views: views.size,
		freePresentations: explorable.length,
		freeViews: free.size,
		viewsOnlyFree: [...free].filter((viewId) => !guided.has(viewId)).length,
		hiddenViews: [...views].filter((viewId) => !guided.has(viewId) && !free.has(viewId)).length
	};
}
