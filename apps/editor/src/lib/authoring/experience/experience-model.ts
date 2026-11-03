/**
 * The Experience homes' reading model (R217.S25).
 *
 * Pure functions of the accepted Experience and Camera facts: what a Card subject is,
 * where a Stop's continuation actually goes, which Stops enter at a View, which
 * Presentations are about a Scene entity, and how much of the Experience the Guide
 * reaches. No state, no Camera evaluation, no DOM; the controller derives from these
 * and the Cards render what they return.
 *
 * A Stop enters at its own `entryViewId`, else at the Presentation's Default View. A
 * continuation is read against one Guide: a Stop's neighbour is the next Stop of that
 * Guide, and a chosen target only counts as adjacent when it is that neighbour.
 */
import type {
	CameraView,
	Experience,
	ExperienceGuide,
	ExperiencePresentation,
	ExperienceStop,
	ExperienceTransitionKind
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
	/** Views no Stop enters at: only free exploration finds them. */
	readonly viewsOnlyFree: number;
};

/** 35 mm equivalent focal length (24 mm frame height): 12 / tan(fov / 2), rounded. */
export function lensMillimetres(fovDegrees: number): number {
	const half = (fovDegrees * Math.PI) / 360;
	const tangent = Math.tan(half);
	if (!Number.isFinite(tangent) || tangent <= 0) return 0;
	return Math.round(12 / tangent);
}

/** The View a Stop enters at: its own entry View, else its Presentation's Default (null: none). */
export function stopEntryViewId(
	stop: ExperienceStop,
	presentation: ExperiencePresentation | null
): string | null {
	return stop.entryViewId ?? presentation?.defaultViewId ?? null;
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
			: experience.presentations.find((entry) => entry.id === presentationId && entry.viewIds.includes(viewId));
	return named ?? experience.presentations.find((entry) => entry.viewIds.includes(viewId)) ?? null;
}

export function viewFactsOf(
	experience: Experience,
	cameraViews: readonly CameraView[],
	viewId: string,
	presentationId?: string
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
		eyeHeightMetres: view.eye[1],
		isDefault: presentation.defaultViewId === view.id
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

/** The Guide's Stops that enter at this View, with their 1-based positions. */
export function stopsEnteringAt(
	experience: Experience,
	guide: ExperienceGuide | null,
	viewId: string
): readonly { readonly stopId: string; readonly position: number }[] {
	if (guide === null) return [];
	const entering: { stopId: string; position: number }[] = [];
	guide.stopIds.forEach((stopId, index) => {
		const stop = experience.stops.find((entry) => entry.id === stopId);
		if (stop === undefined) return;
		const presentation = experience.presentations.find((entry) => entry.id === stop.presentationId) ?? null;
		if (stopEntryViewId(stop, presentation) === viewId) entering.push({ stopId, position: index + 1 });
	});
	return entering;
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

/** How much of the Experience the Guide reaches: Views no Stop enters at are only found by free exploration. */
export function reachSummary(experience: Experience, guide: ExperienceGuide | null): ExperienceReach {
	const entered = new Set<string>();
	for (const stop of guideStopsOf(experience, guide)) {
		const presentation = experience.presentations.find((entry) => entry.id === stop.presentationId) ?? null;
		const viewId = stopEntryViewId(stop, presentation);
		if (viewId !== null) entered.add(viewId);
	}
	const views = new Set<string>();
	for (const presentation of experience.presentations) {
		for (const viewId of presentation.viewIds) views.add(viewId);
	}
	let free = 0;
	for (const viewId of views) if (!entered.has(viewId)) free += 1;
	return { presentations: experience.presentations.length, views: views.size, viewsOnlyFree: free };
}
