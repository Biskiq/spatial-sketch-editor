/**
 * R217.S26 — the Experience removal rules (E4), as pure plans.
 *
 * One function per removal returns either a refusal with its reason or the
 * Experience (and, for a View or Presentation, the Camera payload) the removal
 * leaves, with every consequence named. The removal planners install exactly
 * this result, and the editor's consequence block reads the same plan before
 * the creator confirms, so the summary shown and the operation run can never
 * disagree. Nothing here is replaced silently:
 *
 * - the Detours that name a removed Stop (or a Stops a removed Guide took) go in
 *   the same change, named (A-6);
 * - a Stop that entered at a removed View enters at its Presentation's Default
 *   (`entryViewId: null`), named;
 * - removing a Presentation's first View makes the next View the Default, named;
 *   the Views either side of a removed View become neighbours and keep their
 *   Cut/Travel;
 * - a Camera View is deleted with its connections only when no other
 *   Presentation lists it; otherwise it is kept and its other users are named;
 * - removing the Opening Guide makes the next Guide the Opening Guide, named, or
 *   leaves `entryGuideId` null when none is left.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import. No id is allocated,
 * no clock is read.
 */

import {
	presentationViewIds,
	stopEntryViewId,
	type CameraUnitPayload,
	type Experience,
	type ExperienceGuide,
	type ExperiencePresentationView,
	type ExperienceStop
} from './types';

/** One named effect of a removal, in the order the removal applies it. */
export type ExperienceRemovalConsequence =
	| { readonly kind: 'stop-removed'; readonly stopId: string; readonly presentationId: string }
	| { readonly kind: 'detour-removed'; readonly detourId: string }
	| { readonly kind: 'stop-entry-fallback'; readonly stopId: string; readonly viewId: string }
	| { readonly kind: 'default-changed'; readonly presentationId: string; readonly fromViewId: string; readonly toViewId: string }
	| { readonly kind: 'view-deleted'; readonly viewId: string }
	| { readonly kind: 'view-kept'; readonly viewId: string; readonly usedByPresentationIds: readonly string[] }
	| { readonly kind: 'connection-deleted'; readonly connectionId: string }
	| { readonly kind: 'guide-removed'; readonly guideId: string }
	| { readonly kind: 'opening-guide-moved'; readonly fromGuideId: string; readonly toGuideId: string | null }
	| { readonly kind: 'presentation-removed'; readonly presentationId: string }
	| { readonly kind: 'view-removed'; readonly presentationId: string; readonly viewId: string };

/** The refusal codes a removal can return; each carries a creator-readable reason. */
export type ExperienceRemovalRefusalCode =
	| 'missing-target'
	| 'guide-keeps-a-stop'
	| 'presentation-keeps-a-view'
	| 'invalid-default';

export type ExperienceRemovalPlan =
	| { readonly kind: 'refused'; readonly code: ExperienceRemovalRefusalCode; readonly reason: string }
	| {
			readonly kind: 'planned';
			readonly experience: Experience;
			/** The Camera payload the removal leaves, or null when it writes no Camera fact. */
			readonly camera: Pick<CameraUnitPayload, 'views' | 'connections'> | null;
			readonly consequences: readonly ExperienceRemovalConsequence[];
	  };

type Refusal = Extract<ExperienceRemovalPlan, { kind: 'refused' }>;

function refused(code: ExperienceRemovalRefusalCode, reason: string): Refusal {
	return { kind: 'refused', code, reason };
}

/** The creator-facing words for a Guide that a removal would leave empty. */
export const GUIDE_KEEPS_A_STOP_REASON = 'A Guide keeps at least one Stop — remove the Guide instead';
/** The creator-facing words for a Presentation's last View. */
export const PRESENTATION_KEEPS_A_VIEW_REASON = 'A Presentation keeps at least one View — remove the Presentation instead';

/**
 * Remove a set of Stops from one Experience under the Stop rules. `removedGuideIds`
 * names Guides the same operation removes, which may therefore become empty.
 */
function removeStops(
	experience: Experience,
	stopIds: ReadonlySet<string>,
	removedGuideIds: ReadonlySet<string>,
	consequences: ExperienceRemovalConsequence[]
): Experience | Refusal {
	if (stopIds.size === 0) return experience;
	// A-6 — a Detour that names a removed Stop goes with it, in the same change.
	const detours = experience.detours.filter((entry) => {
		const uses = stopIds.has(entry.fromStopId) || stopIds.has(entry.toStopId) || stopIds.has(entry.returnToStopId);
		if (uses) consequences.push({ kind: 'detour-removed', detourId: entry.id });
		return !uses;
	});
	const guides: ExperienceGuide[] = [];
	for (const guide of experience.guides) {
		if (removedGuideIds.has(guide.id)) {
			guides.push(guide);
			continue;
		}
		const kept = guide.stopIds.filter((stopId) => !stopIds.has(stopId));
		if (kept.length === guide.stopIds.length) {
			guides.push(guide);
			continue;
		}
		if (kept.length === 0) return refused('guide-keeps-a-stop', GUIDE_KEEPS_A_STOP_REASON);
		guides.push({ ...guide, stopIds: kept });
	}
	const stops: ExperienceStop[] = [];
	for (const stop of experience.stops) {
		if (stopIds.has(stop.id)) {
			consequences.push({ kind: 'stop-removed', stopId: stop.id, presentationId: stop.presentationId });
			continue;
		}
		stops.push(stop);
	}
	return { ...experience, stops, guides, detours };
}

/**
 * Delete the Camera Views no Presentation lists any longer, with every connection
 * that joins them; a View another Presentation still lists is kept and named.
 */
function releaseViews(
	camera: Pick<CameraUnitPayload, 'views' | 'connections'>,
	experiences: readonly Experience[],
	candidateViewIds: readonly string[],
	consequences: ExperienceRemovalConsequence[]
): Pick<CameraUnitPayload, 'views' | 'connections'> | null {
	const deleted = new Set<string>();
	for (const viewId of candidateViewIds) {
		if (deleted.has(viewId)) continue;
		const usedBy = experiences.flatMap((entry) =>
			entry.presentations.filter((presentation) => presentation.views.some((view) => view.viewId === viewId)).map((presentation) => presentation.id)
		);
		if (usedBy.length > 0) {
			consequences.push({ kind: 'view-kept', viewId, usedByPresentationIds: usedBy });
			continue;
		}
		if (!camera.views.some((view) => view.id === viewId)) continue;
		deleted.add(viewId);
		consequences.push({ kind: 'view-deleted', viewId });
	}
	if (deleted.size === 0) return null;
	const connections = camera.connections.filter((connection) => {
		const joins = deleted.has(connection.fromNodeId) || deleted.has(connection.toNodeId);
		if (joins) consequences.push({ kind: 'connection-deleted', connectionId: connection.id });
		return !joins;
	});
	const views = camera.views
		.filter((view) => !deleted.has(view.id))
		.map((view) =>
			view.connectedViewIds.some((id) => deleted.has(id))
				? { ...view, connectedViewIds: view.connectedViewIds.filter((id) => !deleted.has(id)) }
				: view
		);
	return { views, connections };
}

function replaceExperience(experiences: readonly Experience[], next: Experience): Experience[] {
	return experiences.map((entry) => (entry.id === next.id ? next : entry));
}

/** One Travel a normalisation turned into a Cut, for the creator's feedback line. */
export type ExperienceNormalisedCut =
	| { readonly kind: 'stop'; readonly stopId: string; readonly nextStopId?: string }
	| { readonly kind: 'presentation-view'; readonly presentationId: string; readonly viewId: string };

/**
 * A-2 / D-12 — write a Cut wherever a Travel can no longer mean anything: on a
 * Guide's last Stop, on a Presentation's last View, and between two Stops that
 * enter the same View. Nothing remembers the earlier Travel; the Camera path is
 * never deleted, so choosing Travel again reuses its shape and time.
 *
 * `cuts` names exactly the steps this call changed, so an accepted edit can say
 * what it did. Pure: no id is allocated, no clock is read.
 */
export function normalizeTransitions(experience: Experience): {
	readonly experience: Experience;
	readonly cuts: readonly ExperienceNormalisedCut[];
} {
	const cuts: ExperienceNormalisedCut[] = [];
	const stopById = new Map(experience.stops.map((stop) => [stop.id, stop]));
	const presentationById = new Map(experience.presentations.map((presentation) => [presentation.id, presentation]));
	const entryViewOf = (stop: ExperienceStop): string | null =>
		stopEntryViewId(stop, presentationById.get(stop.presentationId));
	const cleared = new Set<string>();
	for (const guide of experience.guides) {
		const lastStopId = guide.stopIds.at(-1);
		if (lastStopId !== undefined && stopById.get(lastStopId)?.transition === 'travel') cleared.add(lastStopId);
		for (let index = 0; index + 1 < guide.stopIds.length; index += 1) {
			const from = stopById.get(guide.stopIds[index]!);
			const to = stopById.get(guide.stopIds[index + 1]!);
			if (from === undefined || to === undefined || from.transition !== 'travel') continue;
			const fromView = entryViewOf(from);
			const toView = entryViewOf(to);
			if (fromView === null || fromView !== toView) continue;
			cleared.add(from.id);
		}
	}
	for (const guide of experience.guides) {
		for (const [index, stopId] of guide.stopIds.entries()) {
			if (!cleared.has(stopId)) continue;
			const nextStopId = guide.stopIds[index + 1];
			cuts.push(nextStopId === undefined ? { kind: 'stop', stopId } : { kind: 'stop', stopId, nextStopId });
		}
	}
	const presentations = experience.presentations.map((presentation) => {
		const views = presentation.views.map((view) => ({ ...view }));
		const last = views.length - 1;
		if (last >= 0 && views[last]!.transition === 'travel') {
			delete views[last]!.transition;
			cuts.push({ kind: 'presentation-view', presentationId: presentation.id, viewId: views[last]!.viewId });
		}
		return { ...presentation, views };
	});
	if (cleared.size === 0 && cuts.length === 0) return { experience, cuts };
	const stops = experience.stops.map((stop) => {
		if (!cleared.has(stop.id)) return stop;
		const { transition: _dropped, ...rest } = stop;
		return rest;
	});
	return { experience: { ...experience, stops, presentations }, cuts };
}

/** A removal's one result: its plan, with every dangling Travel already a Cut. */
function plannedRemoval(
	experience: Experience,
	camera: Pick<CameraUnitPayload, 'views' | 'connections'> | null,
	consequences: ExperienceRemovalConsequence[]
): ExperienceRemovalPlan {
	return { kind: 'planned', experience: normalizeTransitions(experience).experience, camera, consequences };
}

/** E4 — remove one Stop from the Experience and from every Guide that orders it. */
export function planStopRemoval(experience: Experience, stopId: string): ExperienceRemovalPlan {
	if (!experience.stops.some((stop) => stop.id === stopId)) {
		return refused('missing-target', `stop "${stopId}" is not in experience "${experience.id}"`);
	}
	const consequences: ExperienceRemovalConsequence[] = [];
	const next = removeStops(experience, new Set([stopId]), new Set(), consequences);
	if ('kind' in next) return next;
	return plannedRemoval(next, null, consequences);
}

/**
 * E4 — remove one Guide and the Stops no other Guide orders. Removing the Opening
 * Guide makes the next Guide (the one after it, else the one before) the Opening
 * Guide; with none left the Experience enters nothing.
 */
export function planGuideRemoval(experience: Experience, guideId: string): ExperienceRemovalPlan {
	const at = experience.guides.findIndex((guide) => guide.id === guideId);
	if (at === -1) return refused('missing-target', `guide "${guideId}" is not in experience "${experience.id}"`);
	const guide = experience.guides[at]!;
	const elsewhere = new Set(experience.guides.filter((entry) => entry.id !== guideId).flatMap((entry) => entry.stopIds));
	const orphaned = new Set(guide.stopIds.filter((stopId) => !elsewhere.has(stopId)));
	const consequences: ExperienceRemovalConsequence[] = [];
	const next = removeStops(experience, orphaned, new Set([guideId]), consequences);
	if ('kind' in next) return next;
	const guides = next.guides.filter((entry) => entry.id !== guideId);
	consequences.unshift({ kind: 'guide-removed', guideId });
	let entryGuideId = next.entryGuideId;
	if (entryGuideId === guideId) {
		const successor = experience.guides[at + 1] ?? experience.guides[at - 1] ?? null;
		entryGuideId = successor?.id ?? null;
		consequences.push({ kind: 'opening-guide-moved', fromGuideId: guideId, toGuideId: entryGuideId });
	}
	return plannedRemoval({ ...next, guides, entryGuideId }, null, consequences);
}

/**
 * E4 — remove one Presentation: its Stops (under the Stop rules, so a Guide left
 * empty refuses) and its Camera Views no other Presentation lists,
 * with their connections.
 */
export function planPresentationRemoval(
	experiences: readonly Experience[],
	camera: Pick<CameraUnitPayload, 'views' | 'connections'>,
	experienceId: string,
	presentationId: string
): ExperienceRemovalPlan {
	const experience = experiences.find((entry) => entry.id === experienceId);
	if (experience === undefined) return refused('missing-target', `experience "${experienceId}" is not in this envelope`);
	const presentation = experience.presentations.find((entry) => entry.id === presentationId);
	if (presentation === undefined) {
		return refused('missing-target', `presentation "${presentationId}" is not in experience "${experience.id}"`);
	}
	const consequences: ExperienceRemovalConsequence[] = [{ kind: 'presentation-removed', presentationId }];
	const stopIds = new Set(experience.stops.filter((stop) => stop.presentationId === presentationId).map((stop) => stop.id));
	const withoutStops = removeStops(experience, stopIds, new Set(), consequences);
	if ('kind' in withoutStops) return withoutStops;
	const next: Experience = {
		...withoutStops,
		presentations: withoutStops.presentations.filter((entry) => entry.id !== presentationId)
	};
	const releasedCamera = releaseViews(camera, replaceExperience(experiences, next), presentationViewIds(presentation), consequences);
	return plannedRemoval(next, releasedCamera, consequences);
}

/**
 * E4 — remove one View from one Presentation. The last View refuses. The
 * Default is the first View: removing it makes the next View the Default, or
 * `newDefaultViewId` when the creator chose another (it moves to the top).
 * The Views either side of the removed one become neighbours and keep their
 * Cut/Travel. Stops that entered at the View enter at the Default. The Camera
 * View and its connections are deleted only when no other Presentation lists it.
 */
export function planPresentationViewRemoval(
	experiences: readonly Experience[],
	camera: Pick<CameraUnitPayload, 'views' | 'connections'>,
	experienceId: string,
	presentationId: string,
	viewId: string,
	newDefaultViewId: string | null = null
): ExperienceRemovalPlan {
	const experience = experiences.find((entry) => entry.id === experienceId);
	if (experience === undefined) return refused('missing-target', `experience "${experienceId}" is not in this envelope`);
	const presentation = experience.presentations.find((entry) => entry.id === presentationId);
	if (presentation === undefined) {
		return refused('missing-target', `presentation "${presentationId}" is not in experience "${experience.id}"`);
	}
	const at = presentation.views.findIndex((view) => view.viewId === viewId);
	if (at === -1) {
		return refused('missing-target', `view "${viewId}" is not one of presentation "${presentation.id}"'s views`);
	}
	if (presentation.views.length === 1) return refused('presentation-keeps-a-view', PRESENTATION_KEEPS_A_VIEW_REASON);
	const consequences: ExperienceRemovalConsequence[] = [{ kind: 'view-removed', presentationId, viewId }];
	let views: ExperiencePresentationView[] = presentation.views.filter((view) => view.viewId !== viewId);
	if (at === presentation.views.length - 1 && views.length > 0) {
		// A step leaves the View it is authored on, so the new last View has none.
		const { transition: _dropped, ...previous } = views[views.length - 1]!;
		views = [...views.slice(0, -1), previous];
	}
	if (at === 0) {
		const chosen = newDefaultViewId ?? views[0]!.viewId;
		const chosenAt = views.findIndex((view) => view.viewId === chosen);
		if (chosenAt === -1) {
			return refused('invalid-default', `the new Default "${chosen}" is not one of the Presentation's other Views`);
		}
		const { transition: _dropped, ...head } = views[chosenAt]!;
		views = [head, ...views.filter((_, index) => index !== chosenAt)];
		consequences.push({ kind: 'default-changed', presentationId, fromViewId: viewId, toViewId: chosen });
	} else if (newDefaultViewId !== null && newDefaultViewId !== presentation.views[0]!.viewId) {
		return refused('invalid-default', 'A new Default is chosen only when the Default View is removed');
	}
	const stops = experience.stops.map((stop) => {
		if (stop.presentationId !== presentationId || stop.entryViewId !== viewId) return stop;
		consequences.push({ kind: 'stop-entry-fallback', stopId: stop.id, viewId });
		return { ...stop, entryViewId: null };
	});
	const next: Experience = {
		...experience,
		presentations: experience.presentations.map((entry) => (entry.id === presentationId ? { ...entry, views } : entry)),
		stops
	};
	const releasedCamera = releaseViews(camera, replaceExperience(experiences, next), [viewId], consequences);
	return plannedRemoval(next, releasedCamera, consequences);
}


/** One unordered pair of distinct Views a remaining Travel joins. */
export type ExperienceTravelPair = { readonly fromViewId: string; readonly toViewId: string };

function travelPairKey(a: string, b: string): string {
	return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/**
 * D-12 / A-2 — every distinct pair a remaining Travel joins, Guide edges and
 * Presentation steps alike, in sorted order. Same-View pairs are never Travels.
 */
export function travelPairs(experience: Experience): ExperienceTravelPair[] {
	const pairs = new Map<string, ExperienceTravelPair>();
	const add = (fromViewId: string, toViewId: string): void => {
		if (fromViewId === toViewId) return;
		const key = travelPairKey(fromViewId, toViewId);
		if (!pairs.has(key)) pairs.set(key, { fromViewId, toViewId });
	};
	const stopById = new Map(experience.stops.map((stop) => [stop.id, stop]));
	const presentationById = new Map(experience.presentations.map((presentation) => [presentation.id, presentation]));
	const entryViewOf = (stop: ExperienceStop): string | null =>
		stopEntryViewId(stop, presentationById.get(stop.presentationId));
	for (const guide of experience.guides) {
		for (let index = 0; index + 1 < guide.stopIds.length; index += 1) {
			const from = stopById.get(guide.stopIds[index]!);
			const to = stopById.get(guide.stopIds[index + 1]!);
			if (from === undefined || to === undefined || from.transition !== 'travel') continue;
			const fromView = entryViewOf(from);
			const toView = entryViewOf(to);
			if (fromView !== null && toView !== null) add(fromView, toView);
		}
	}
	for (const presentation of experience.presentations) {
		for (let index = 0; index + 1 < presentation.views.length; index += 1) {
			const view = presentation.views[index]!;
			if (view.transition === 'travel') add(view.viewId, presentation.views[index + 1]!.viewId);
		}
	}
	return [...pairs.values()].sort((a, b) =>
		a.fromViewId === b.fromViewId ? a.toViewId.localeCompare(b.toViewId) : a.fromViewId.localeCompare(b.fromViewId)
	);
}

/**
 * G1–G5 — the pairs a remaining Travel uses that no Camera connection joins yet,
 * in either direction. The planners add one straight path per pair, in this order.
 */
export function requiredTravelPairs(
	experience: Experience,
	connections: readonly { readonly fromNodeId: string; readonly toNodeId: string }[]
): ExperienceTravelPair[] {
	const joined = new Set(connections.map((connection) => travelPairKey(connection.fromNodeId, connection.toNodeId)));
	return travelPairs(experience).filter((pair) => !joined.has(travelPairKey(pair.fromViewId, pair.toViewId)));
}
