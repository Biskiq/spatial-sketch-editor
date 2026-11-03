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
 * - a continuation that targeted a removed Stop falls back to the Guide order
 *   (`sequence-next`, its Cut/Travel choice kept), named;
 * - a Guide's start that was removed moves to the Stop that followed it (or
 *   preceded it, when it was last), named;
 * - a Stop that entered at a removed View enters at its Presentation's Default,
 *   named;
 * - a Camera View is deleted with its connections only when no other
 *   Presentation lists it; otherwise it is kept and its other users are named;
 * - removing the Opening Guide makes the next Guide the Opening Guide, named, or
 *   leaves `entryGuideId` null when none is left.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import. No id is allocated,
 * no clock is read.
 */

import type {
	CameraUnitPayload,
	Experience,
	ExperienceContinuation,
	ExperienceGuide,
	ExperienceStop
} from './types';

/** One named effect of a removal, in the order the removal applies it. */
export type ExperienceRemovalConsequence =
	| { readonly kind: 'stop-removed'; readonly stopId: string; readonly presentationId: string }
	| { readonly kind: 'continuation-fallback'; readonly stopId: string; readonly removedStopId: string }
	| { readonly kind: 'guide-start-moved'; readonly guideId: string; readonly fromStopId: string; readonly toStopId: string }
	| { readonly kind: 'stop-entry-fallback'; readonly stopId: string; readonly viewId: string }
	| { readonly kind: 'default-changed'; readonly presentationId: string; readonly fromViewId: string; readonly toViewId: string }
	| { readonly kind: 'view-deleted'; readonly viewId: string }
	| { readonly kind: 'view-kept'; readonly viewId: string; readonly usedByPresentationIds: readonly string[] }
	| { readonly kind: 'connection-deleted'; readonly connectionId: string }
	| { readonly kind: 'gate-removed'; readonly gateId: string }
	| { readonly kind: 'guide-removed'; readonly guideId: string }
	| { readonly kind: 'opening-guide-moved'; readonly fromGuideId: string; readonly toGuideId: string | null }
	| { readonly kind: 'presentation-removed'; readonly presentationId: string }
	| { readonly kind: 'view-removed'; readonly presentationId: string; readonly viewId: string };

/** The refusal codes a removal can return; each carries a creator-readable reason. */
export type ExperienceRemovalRefusalCode =
	| 'missing-target'
	| 'guide-keeps-a-stop'
	| 'detour-uses-stop'
	| 'presentation-keeps-a-view'
	| 'default-needed'
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
	const detour = experience.detours.find(
		(entry) => stopIds.has(entry.fromStopId) || stopIds.has(entry.toStopId) || stopIds.has(entry.returnToStopId)
	);
	if (detour !== undefined) {
		return refused('detour-uses-stop', `A Detour uses this Stop; remove the Detour first`);
	}
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
		let entryStopId = guide.entryStopId;
		if (stopIds.has(entryStopId)) {
			const at = guide.stopIds.indexOf(entryStopId);
			const after = guide.stopIds.slice(at + 1).find((stopId) => !stopIds.has(stopId));
			const before = [...guide.stopIds.slice(0, at)].reverse().find((stopId) => !stopIds.has(stopId));
			entryStopId = (after ?? before)!;
			consequences.push({ kind: 'guide-start-moved', guideId: guide.id, fromStopId: guide.entryStopId, toStopId: entryStopId });
		}
		guides.push({ ...guide, stopIds: kept, entryStopId });
	}
	const stops: ExperienceStop[] = [];
	for (const stop of experience.stops) {
		if (stopIds.has(stop.id)) {
			consequences.push({ kind: 'stop-removed', stopId: stop.id, presentationId: stop.presentationId });
			continue;
		}
		const continuation = stop.continuation;
		if (continuation?.kind === 'stop' && stopIds.has(continuation.stopId)) {
			const fallback: ExperienceContinuation =
				continuation.transition === undefined
					? { kind: 'sequence-next' }
					: { kind: 'sequence-next', transition: continuation.transition };
			consequences.push({ kind: 'continuation-fallback', stopId: stop.id, removedStopId: continuation.stopId });
			stops.push({ ...stop, continuation: fallback });
			continue;
		}
		stops.push(stop);
	}
	return { ...experience, stops, guides };
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
			entry.presentations.filter((presentation) => presentation.viewIds.includes(viewId)).map((presentation) => presentation.id)
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

/** E4 — remove one Stop from the Experience and from every Guide that orders it. */
export function planStopRemoval(experience: Experience, stopId: string): ExperienceRemovalPlan {
	if (!experience.stops.some((stop) => stop.id === stopId)) {
		return refused('missing-target', `stop "${stopId}" is not in experience "${experience.id}"`);
	}
	const consequences: ExperienceRemovalConsequence[] = [];
	const next = removeStops(experience, new Set([stopId]), new Set(), consequences);
	if ('kind' in next) return next;
	return { kind: 'planned', experience: next, camera: null, consequences };
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
	return { kind: 'planned', experience: { ...next, guides, entryGuideId }, camera: null, consequences };
}

/**
 * E4 — remove one Presentation: its Stops (under the Stop rules, so a Guide left
 * empty refuses), its Gates, and its Camera Views no other Presentation lists,
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
	const gates = withoutStops.gates.filter((gate) => {
		if (gate.presentationId !== presentationId) return true;
		consequences.push({ kind: 'gate-removed', gateId: gate.id });
		return false;
	});
	const next: Experience = {
		...withoutStops,
		presentations: withoutStops.presentations.filter((entry) => entry.id !== presentationId),
		gates
	};
	const releasedCamera = releaseViews(camera, replaceExperience(experiences, next), presentation.viewIds, consequences);
	return { kind: 'planned', experience: next, camera: releasedCamera, consequences };
}

/**
 * E4 — remove one View from one Presentation. The last View refuses; removing the
 * Default needs the new Default chosen (`newDefaultViewId`), never an automatic
 * pick. Stops that entered at the View enter at the Default. The Camera View and
 * its connections are deleted only when no other Presentation lists it.
 */
export function planPresentationViewRemoval(
	experiences: readonly Experience[],
	camera: Pick<CameraUnitPayload, 'views' | 'connections'>,
	experienceId: string,
	presentationId: string,
	viewId: string,
	newDefaultViewId: string | null
): ExperienceRemovalPlan {
	const experience = experiences.find((entry) => entry.id === experienceId);
	if (experience === undefined) return refused('missing-target', `experience "${experienceId}" is not in this envelope`);
	const presentation = experience.presentations.find((entry) => entry.id === presentationId);
	if (presentation === undefined) {
		return refused('missing-target', `presentation "${presentationId}" is not in experience "${experience.id}"`);
	}
	if (!presentation.viewIds.includes(viewId)) {
		return refused('missing-target', `view "${viewId}" is not one of presentation "${presentation.id}"'s views`);
	}
	if (presentation.viewIds.length === 1) return refused('presentation-keeps-a-view', PRESENTATION_KEEPS_A_VIEW_REASON);
	const viewIds = presentation.viewIds.filter((id) => id !== viewId);
	let defaultViewId = presentation.defaultViewId;
	const consequences: ExperienceRemovalConsequence[] = [{ kind: 'view-removed', presentationId, viewId }];
	if (presentation.defaultViewId === viewId) {
		if (newDefaultViewId === null) {
			return refused('default-needed', 'This is the Default View: choose the new Default first');
		}
		if (!viewIds.includes(newDefaultViewId)) {
			return refused('invalid-default', `the new Default "${newDefaultViewId}" is not one of the Presentation's other Views`);
		}
		defaultViewId = newDefaultViewId;
		consequences.push({ kind: 'default-changed', presentationId, fromViewId: viewId, toViewId: newDefaultViewId });
	} else if (newDefaultViewId !== null && newDefaultViewId !== presentation.defaultViewId) {
		return refused('invalid-default', 'A new Default is chosen only when the Default View is removed');
	}
	const stops = experience.stops.map((stop) => {
		if (stop.presentationId !== presentationId || stop.entryViewId !== viewId) return stop;
		consequences.push({ kind: 'stop-entry-fallback', stopId: stop.id, viewId });
		const { entryViewId: _removed, ...rest } = stop;
		return rest;
	});
	const next: Experience = {
		...experience,
		presentations: experience.presentations.map((entry) =>
			entry.id === presentationId ? { ...entry, viewIds, defaultViewId } : entry
		),
		stops
	};
	const releasedCamera = releaseViews(camera, replaceExperience(experiences, next), [viewId], consequences);
	return { kind: 'planned', experience: next, camera: releasedCamera, consequences };
}
