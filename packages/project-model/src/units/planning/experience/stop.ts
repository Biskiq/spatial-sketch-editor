import { type DomainPlanner } from '../../../f4/types';
import { ShapeReader } from '../../../strict-shape';
import { planStopRemoval } from '../../experience-structure';
import { readOptionalTransition } from './payload';
import { type ViewPair, withStraightConnections, connectionRecords } from './presentation';
import { containerOf, withExperience, prepared, installRemoval, emptyPayload } from './update';
import { refuse, envelopeOf, revisionOf, reference, targetOf, capturedId, capturedIds, allIds } from '../shared';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../../source';
import { EXPERIENCE_STAY_DEFAULT_SECONDS, presentationDefaultViewId, presentationViewIds, EXPERIENCE_UNIT_FORMAT_VERSION, type Experience, type ExperiencePresentation, type ExperienceStop, type ProjectEnvelope } from '../../types';
import { readInvitation, readStaySeconds } from '../../validate';

/** Reuse an existing Presentation at a distinct Stop. */
export const EXPERIENCE_STOP_CREATE_KIND = 'experience-stop-create';

/** Edit one Stop's entry View, stay, invitation or outgoing step. */
export const EXPERIENCE_STOP_UPDATE_KIND = 'experience-stop-update';

/** Remove one Stop under the removal rules. */
export const EXPERIENCE_STOP_REMOVE_KIND = 'experience-stop-remove';

export const STOP_CREATE_PAYLOAD_KEYS = ['presentationId', 'guideId', 'afterStopId', 'entryViewId', 'staySeconds', 'transition'] as const;

/**
 * Create one Stop for an existing Presentation and insert it into a Guide.
 *
 * Targets: exactly one `experience:experience` reference. The Stop's entry View
 * is the payload's `entryViewId` or its Presentation's Default, so one
 * Presentation reused at two Stops can enter at two different Views while the
 * stays and outgoing steps stay per Stop.
 */
export function createExperienceStopCreatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-stop-create',
		kind: EXPERIENCE_STOP_CREATE_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', STOP_CREATE_PAYLOAD_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
			const presentationId = reader.opaqueId(payload.presentationId, '$.payload.presentationId');
			const guideId = reader.opaqueId(payload.guideId, '$.payload.guideId');
			const entryViewId = payload.entryViewId === undefined
				? undefined
				: reader.opaqueId(payload.entryViewId, '$.payload.entryViewId');
			const entryViewProvided = payload.entryViewId !== undefined;
			const staySeconds = payload.staySeconds === undefined
				? EXPERIENCE_STAY_DEFAULT_SECONDS
				: readStaySeconds(reader, payload.staySeconds, '$.payload.staySeconds');
			const transition = readOptionalTransition(reader, payload.transition, '$.payload.transition');
			let afterStopId: string | null = null;
			if (payload.afterStopId !== undefined && payload.afterStopId !== null) {
				const parsed = reader.opaqueId(payload.afterStopId, '$.payload.afterStopId');
				if (parsed === null) return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
				afterStopId = parsed;
			}
			if (
				presentationId === null ||
				guideId === null ||
				staySeconds === null ||
				transition === null ||
				(entryViewProvided && entryViewId === null)
			) {
				return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
			}
			const target = targetOf(request.intent, 'experience', 'experience');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-stop-create targets exactly one experience:experience reference');
			}
			const experienceIndex = envelope.units.experience.data.experiences.findIndex((candidate) => candidate.id === target.subject.id);
			if (experienceIndex === -1) return refuse('missing-target', `experience "${target.subject.id}" is not in this envelope`);
			const experience = envelope.units.experience.data.experiences[experienceIndex]!;
			const presentation = experience.presentations.find((candidate) => candidate.id === presentationId);
			if (presentation === undefined) {
				return refuse('missing-target', `presentation "${presentationId}" is not in experience "${experience.id}"`);
			}
			const guide = experience.guides.find((candidate) => candidate.id === guideId);
			if (guide === undefined) return refuse('missing-target', `guide "${guideId}" is not in experience "${experience.id}"`);
			const defaultViewId = presentationDefaultViewId(presentation);
			const entry: string | null = entryViewId ?? defaultViewId;
			// A Presentation without a Default View is not enterable, so lowering never
			// carries its Stops even when this Stop names its own entry View.
			if (defaultViewId === null || entry === null) {
				return refuse('missing-entry', `presentation "${presentation.id}" has no Default View, so a Stop cannot enter it`);
			}
			if (!presentationViewIds(presentation).includes(entry)) {
				return refuse('invalid-payload', `entry view "${entry}" is not one of presentation "${presentation.id}"'s views`);
			}
			let insertionIndex = guide.stopIds.length;
			if (afterStopId !== null) {
				const at = guide.stopIds.indexOf(afterStopId);
				if (at === -1) return refuse('missing-target', `guide "${guide.id}" does not order stop "${afterStopId}"`);
				insertionIndex = at + 1;
			}
			const stopId = capturedId(request.intent, 'stop');
			if (stopId === null) {
				return refuse('unsupported-operation', 'the intent must capture exactly one stop id');
			}
			if (allIds(envelope).has(stopId)) {
				return refuse('duplicate-identity', `the captured id "${stopId}" already names a subject in this envelope`);
			}
			const newStop: ExperienceStop = {
				id: stopId,
				presentationId,
				entryViewId: entryViewId ?? null,
				staySeconds,
				invitation: null,
				...(transition === undefined ? {} : { transition })
			};
			const guides = experience.guides.map((candidate) =>
				candidate.id === guide.id
					? {
							...candidate,
							stopIds: [...candidate.stopIds.slice(0, insertionIndex), newStop.id, ...candidate.stopIds.slice(insertionIndex)]
						}
					: candidate
			);
			const updatedExperience: Experience = {
				...experience,
				stops: [...experience.stops, newStop],
				guides
			};
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					experience: {
						header: { ...envelope.units.experience.header },
						data: {
							formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
							experiences: envelope.units.experience.data.experiences.map((entryExperience, index) =>
								index === experienceIndex ? updatedExperience : entryExperience
							)
						}
					}
				}
			};
			return prepared(request, candidate, [
						{ kind: 'experience.stop.created', subjectIds: [newStop.id], fields: ['presentationId', 'entryViewId', 'staySeconds', 'invitation', 'transition'] },
						{ kind: 'experience.guide.updated', subjectIds: [guide.id], fields: ['stopIds'] }
					], [
						{
							relation: 'created',
							before: null,
							after: reference('experience', 'stop', newStop.id, [experience.id], revisionOf(candidate, 'experience'))
						}
					]);
		}
	};
}

/* --- Guide order ----------------------------------------------------------- */

export const STOP_UPDATE_PAYLOAD_KEYS = ['entryViewId', 'staySeconds', 'invitation', 'transition', 'travelPath'] as const;
export const STOP_TRAVEL_PATH_KEYS = ['fromViewId', 'toViewId'] as const;

export function presentationOfStop(experience: Experience, stop: ExperienceStop): ExperiencePresentation | null {
	return experience.presentations.find((candidate) => candidate.id === stop.presentationId) ?? null;
}

/**
 * Edit one Stop's own visit facts — its entry View, its stay, its invitation —
 * or its outgoing step, in one intent.
 *
 * `entryViewId: null` follows the Presentation's Default; a named entry must be
 * one of its Views. `staySeconds` is finite and at least 1 s. `invitation` is
 * `null` (off) or `{ prompt }`. Experience review 1 — choosing Travel may carry
 * `travelPath` (the leaving and arriving Views). When no Camera path joins that
 * pair yet, the same accepted change adds the straight one (with the captured
 * `connection` id), so Travel plays at once and is one Undo.
 */
export function createExperienceStopUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-stop-update',
		kind: EXPERIENCE_STOP_UPDATE_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', STOP_UPDATE_PAYLOAD_KEYS);
			if (payload === null) return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
			const entryPresent = payload.entryViewId !== undefined;
			const entryViewId = !entryPresent || payload.entryViewId === null
				? null
				: reader.opaqueId(payload.entryViewId, '$.payload.entryViewId');
			const stayPresent = payload.staySeconds !== undefined;
			const staySeconds = stayPresent ? readStaySeconds(reader, payload.staySeconds, '$.payload.staySeconds') : null;
			const invitationPresent = payload.invitation !== undefined;
			const invitation = invitationPresent ? readInvitation(reader, payload.invitation, '$.payload.invitation') : null;
			const transitionPresent = payload.transition !== undefined;
			const transition = transitionPresent ? readOptionalTransition(reader, payload.transition, '$.payload.transition') : undefined;
			if (
				reader.issues.length !== 0 ||
				(entryPresent && payload.entryViewId !== null && entryViewId === null) ||
				(stayPresent && staySeconds === null) ||
				(invitation !== null && !invitation.ok) ||
				transition === null
			) {
				return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
			}
			if (!entryPresent && !stayPresent && !invitationPresent && !transitionPresent) {
				return refuse('invalid-payload', 'the Stop payload names no field to change');
			}
			let travelPath: ViewPair | null = null;
			if (payload.travelPath !== undefined) {
				const path = reader.object(payload.travelPath, '$.payload.travelPath', STOP_TRAVEL_PATH_KEYS);
				const fromViewId = path === null ? null : reader.string(path.fromViewId, '$.payload.travelPath.fromViewId');
				const toViewId = path === null ? null : reader.string(path.toViewId, '$.payload.travelPath.toViewId');
				if (fromViewId === null || toViewId === null || reader.issues.length !== 0) {
					return refuse('invalid-payload', 'The Stop payload is not a valid shape', reader.issues);
				}
				travelPath = { fromViewId, toViewId };
			}
			const target = targetOf(request.intent, 'experience', 'stop');
			if (target === null) {
				return refuse('unsupported-operation', 'experience-stop-update targets exactly one experience:stop reference');
			}
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse('missing-target', `the Stop's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`);
			}
			const stopIndex = container.stops.findIndex((candidate) => candidate.id === target.subject.id);
			if (stopIndex === -1) return refuse('missing-target', `stop "${target.subject.id}" is not in experience "${container.id}"`);
			const previous = container.stops[stopIndex]!;
			const presentation = presentationOfStop(container, previous);
			if (presentation === null) {
				return refuse('missing-target', `stop "${previous.id}" names presentation "${previous.presentationId}", which this Experience does not carry`);
			}
			if (entryViewId !== null && !presentationViewIds(presentation).includes(entryViewId)) {
				return refuse('invalid-payload', `entry view "${entryViewId}" is not one of presentation "${presentation.id}"'s views`);
			}
			// A named entry stays pinned through reorder, even when it is currently
			// the Default. Only an explicit null follows the Presentation’s View 1.
			const nextEntry = entryPresent
				? entryViewId
				: previous.entryViewId;
			const updated: ExperienceStop = {
				id: previous.id,
				presentationId: previous.presentationId,
				entryViewId: nextEntry,
				staySeconds: staySeconds ?? previous.staySeconds,
				invitation: invitation !== null && invitation.ok ? invitation.value : previous.invitation,
				...(transitionPresent
					? transition === undefined ? {} : { transition }
					: previous.transition === undefined ? {} : { transition: previous.transition })
			};
			const candidate = withExperience(envelope, {
				...container,
				stops: container.stops.map((candidateStop, index) => (index === stopIndex ? updated : candidateStop))
			});
			const joined = withStraightConnections(
				envelope,
				candidate,
				travelPath === null ? [] : [travelPath],
				capturedIds(request.intent, 'connection')
			);
			if (joined.kind === 'refused') return refuse(joined.code, joined.message);
			const source = joined.envelope;
			const changedFields: string[] = [];
			if (updated.entryViewId !== previous.entryViewId) changedFields.push('entryViewId');
			if (updated.staySeconds !== previous.staySeconds) changedFields.push('staySeconds');
			if (JSON.stringify(updated.invitation) !== JSON.stringify(previous.invitation)) changedFields.push('invitation');
			if (updated.transition !== previous.transition) changedFields.push('transition');
			const records = connectionRecords(source, joined.connections);
			return prepared(
				request,
				source,
				[{ kind: 'experience.stop.updated', subjectIds: [updated.id], fields: changedFields }, ...records.changes],
				[
					{
						relation: 'preserved',
						before: reference('experience', 'stop', previous.id, [container.id], revisionOf(envelope, 'experience')),
						after: reference('experience', 'stop', previous.id, [container.id], revisionOf(source, 'experience'))
					},
					...records.correspondence
				]
			);
		}
	};
}

/**
 * Remove one Stop. Targets: exactly one `experience:stop` reference. The
 * Stop leaves every Guide that orders it; the only Stop of a Guide and a Stop a
 * Detour uses refuse.
 */
export function createExperienceStopRemovePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-stop-remove',
		kind: EXPERIENCE_STOP_REMOVE_KIND,
		admission: { domain: 'experience', compound: true, writes: ['camera'], units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const invalid = emptyPayload(request, 'Stop');
			if (invalid !== null) return invalid;
			const target = targetOf(request.intent, 'experience', 'stop');
			if (target === null) return refuse('unsupported-operation', 'experience-stop-remove targets exactly one experience:stop reference');
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse('missing-target', `the Stop's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`);
			}
			return installRemoval(request, envelope, container.id, planStopRemoval(container, target.subject.id));
		}
	};
}

