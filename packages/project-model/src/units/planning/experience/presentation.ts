import {
	type DomainPlanner,
	type OperationChange,
	type CorrespondenceEntry,
} from '../../../f4/types';
import { type SceneConnection } from '../../../scene';
import { ShapeReader } from '../../../strict-shape';
import { planPresentationRemoval, planPresentationViewRemoval } from '../../experience-structure';
import { sameUnorderedPair } from '../camera-connection';
import { readViewPose } from '../camera-view';
import { readSubjectPayload } from './payload';
import { withStraightConnection } from './travel';
import { containerOf, withExperience, prepared, installRemoval, emptyPayload } from './update';
import {
	refuse,
	envelopeOf,
	revisionOf,
	reference,
	targetOf,
	capturedId,
	capturedIds,
	allIds,
} from '../shared';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../../source';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	presentationViewIds,
	type ExperiencePresentationView,
	type CameraView,
	type Experience,
	type ExperiencePresentation,
	type ProjectEnvelope,
} from '../../types';
import { readExperienceText, readPresentationViews } from '../../validate';

/** Edit one Presentation's label, text, subject or Default View. */
export const EXPERIENCE_PRESENTATION_UPDATE_KIND = 'experience-presentation-update';

/** Remove one View from one Presentation under the removal rules (writes Camera when unshared). */
export const EXPERIENCE_PRESENTATION_VIEW_REMOVE_KIND = 'experience-presentation-view-remove';

/** Remove one Presentation under the removal rules (writes Camera when unshared). */
export const EXPERIENCE_PRESENTATION_REMOVE_KIND = 'experience-presentation-remove';

export const PRESENTATION_UPDATE_KEYS = [
	'label',
	'text',
	'subject',
	'view',
	'views',
	'travelPaths',
	'explorable',
] as const;
export const TRAVEL_PATH_KEYS = ['fromViewId', 'toViewId'] as const;

export type ViewPair = { readonly fromViewId: string; readonly toViewId: string };

/** Read an optional list of View pairs a Travel needs a straight Camera path for. */
export function readTravelPaths(
	reader: ShapeReader,
	input: unknown,
	path: string,
): ViewPair[] | null {
	if (!Array.isArray(input)) {
		reader.problem(path, 'not-an-array', `${path} must be an array`);
		return null;
	}
	const pairs: ViewPair[] = [];
	for (const [index, entry] of input.entries()) {
		const record = reader.object(entry, `${path}[${index}]`, TRAVEL_PATH_KEYS);
		if (record === null) return null;
		const fromViewId = reader.opaqueId(record.fromViewId, `${path}[${index}].fromViewId`);
		const toViewId = reader.opaqueId(record.toViewId, `${path}[${index}].toViewId`);
		if (fromViewId === null || toViewId === null) return null;
		pairs.push({ fromViewId, toViewId });
	}
	return pairs;
}

/**
 * Add the straight Camera path each Travel pair needs, in order, consuming one
 * captured `connection` id per pair that is not joined yet. An existing path is
 * kept as it is; the result names every connection it created.
 */
export function withStraightConnections(
	envelope: ProjectEnvelope,
	candidate: ProjectEnvelope,
	pairs: readonly ViewPair[],
	connectionIds: readonly string[],
):
	| {
			readonly kind: 'joined';
			readonly envelope: ProjectEnvelope;
			readonly connections: SceneConnection[];
	  }
	| { readonly kind: 'refused'; readonly code: string; readonly message: string } {
	let current = candidate;
	const created: SceneConnection[] = [];
	let next = 0;
	for (const pair of pairs) {
		if (pair.fromViewId === pair.toViewId) continue;
		const joined = current.units.camera.data.connections.some((connection) =>
			sameUnorderedPair(connection, pair.fromViewId, pair.toViewId),
		);
		if (joined) continue;
		// A pool is shared by every stage of one change, so skip the ids an
		// earlier stage already consumed rather than reusing them.
		let connectionId: string | null = null;
		while (next < connectionIds.length) {
			const candidateId = connectionIds[next]!;
			next += 1;
			if (!allIds(current).has(candidateId)) {
				connectionId = candidateId;
				break;
			}
		}
		const result = withStraightConnection(envelope, current, pair, connectionId);
		if (result.kind === 'refused') return result;
		current = result.envelope;
		if (result.connection !== null) created.push(result.connection);
	}
	return { kind: 'joined', envelope: current, connections: created };
}

export function connectionRecords(
	source: ProjectEnvelope,
	connections: readonly SceneConnection[],
): { changes: OperationChange[]; correspondence: CorrespondenceEntry[] } {
	return {
		changes: connections.map((connection) => ({
			kind: 'camera.connection.created',
			subjectIds: [connection.id],
			fields: ['fromNodeId', 'toNodeId', 'clearance', 'positionPath'],
		})),
		correspondence: connections.map((connection) => ({
			relation: 'created' as const,
			before: null,
			after: reference('camera', 'connection', connection.id, [], revisionOf(source, 'camera')),
		})),
	};
}

/**
 * Edit one Presentation's label, text, subject, Places listing or Views.
 *
 * Targets: exactly one `experience:presentation` reference. `text` and `subject`
 * are replaced when present and cleared by an explicit `null`. `views` replaces
 * the ordered View list with its Cut/Travel steps: it must name the same Views
 * (a reorder or a step change, never an insert or a removal), and the first View
 * — the Default — carries no step. Moving a View to the top makes it the
 * Default; Stops without their own entry follow it. `view` captures a new View
 * and appends it, joined by a Cut, and is never combined with `views`.
 * `travelPaths` names View pairs a Travel step needs: the same accepted change
 * adds each missing straight Camera path (one captured `connection` id each),
 * so the Travel plays at once and is one Undo.
 */
export function createExperiencePresentationUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-presentation-update',
		kind: EXPERIENCE_PRESENTATION_UPDATE_KIND,
		admission: {
			domain: 'experience',
			compound: true,
			writes: ['camera'],
			units: true,
			resources: false,
		},
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', PRESENTATION_UPDATE_KEYS);
			if (payload === null)
				return refuse(
					'invalid-payload',
					'The Presentation payload is not a valid shape',
					reader.issues,
				);
			const labelPresent = payload.label !== undefined;
			const label =
				payload.label === null
					? null
					: payload.label === undefined
						? undefined
						: reader.string(payload.label, '$.payload.label');
			const textPresent = payload.text !== undefined;
			const text =
				!textPresent || payload.text === null
					? null
					: readExperienceText(reader, payload.text, '$.payload.text');
			const subjectPresent = payload.subject !== undefined;
			const subject =
				payload.subject === null
					? { ok: true as const, value: null }
					: payload.subject === undefined
						? null
						: readSubjectPayload(reader, payload.subject, '$.payload.subject');
			const viewPresent = payload.view !== undefined && payload.view !== null;
			const view = viewPresent ? readViewPose(reader, payload.view, '$.payload.view') : null;
			const explorable =
				payload.explorable === undefined
					? undefined
					: reader.boolean(payload.explorable, '$.payload.explorable');
			const viewsPresent = payload.views !== undefined;
			const views = viewsPresent
				? readPresentationViews(reader, payload.views, '$.payload.views')
				: null;
			const travelPaths =
				payload.travelPaths === undefined
					? []
					: readTravelPaths(reader, payload.travelPaths, '$.payload.travelPaths');
			if (
				explorable === null ||
				(viewsPresent && views === null) ||
				travelPaths === null ||
				(labelPresent && payload.label !== null && label === null) ||
				(textPresent && payload.text !== null && text === null) ||
				(subject !== null && subject.ok === false) ||
				(viewPresent && view === null)
			) {
				return refuse(
					'invalid-payload',
					'The Presentation payload is not a valid shape',
					reader.issues,
				);
			}
			if (
				!labelPresent &&
				!textPresent &&
				!subjectPresent &&
				!viewPresent &&
				!viewsPresent &&
				explorable === undefined
			) {
				return refuse('invalid-payload', 'the Presentation payload names no field to change');
			}
			const target = targetOf(request.intent, 'experience', 'presentation');
			if (target === null) {
				return refuse(
					'unsupported-operation',
					'experience-presentation-update targets exactly one experience:presentation reference',
				);
			}
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse(
					'missing-target',
					`the Presentation's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`,
				);
			}
			const presentationIndex = container.presentations.findIndex(
				(candidate) => candidate.id === target.subject.id,
			);
			if (presentationIndex === -1) {
				return refuse(
					'missing-target',
					`presentation "${target.subject.id}" is not in experience "${container.id}"`,
				);
			}
			const previous = container.presentations[presentationIndex]!;
			if (views !== null) {
				if (viewPresent) {
					return refuse(
						'invalid-payload',
						'A View order is never combined with a captured View; reorder after the capture is accepted',
					);
				}
				const authored = new Set(presentationViewIds(previous));
				if (
					views.length !== previous.views.length ||
					!views.every((entry) => authored.has(entry.viewId))
				) {
					return refuse(
						'invalid-order',
						`the Views must be presentation "${previous.id}"'s own Views; reordering or changing a step never inserts or removes one`,
					);
				}
			}
			let nextViews: ExperiencePresentationView[] = [...(views ?? previous.views)];
			let createdView: CameraView | null = null;
			if (view !== null) {
				const viewId = capturedId(request.intent, 'view');
				if (viewId === null) {
					return refuse(
						'unsupported-operation',
						'a captured View change must capture exactly one view id',
					);
				}
				if (allIds(envelope).has(viewId)) {
					return refuse(
						'duplicate-identity',
						`the captured id "${viewId}" already names a subject in this envelope`,
					);
				}
				createdView = {
					id: viewId,
					label: view.label,
					eye: view.eye,
					target: view.target,
					fov: view.fov,
					connectedViewIds: [],
				};
				nextViews = [
					...nextViews,
					nextViews.length === 0 ? { viewId } : { viewId, transition: 'cut' },
				];
			}
			const nextSubject = subject === null ? previous.subject : subject.value;
			if (
				label === null &&
				(nextSubject === null ||
					nextSubject.domain !== 'scene' ||
					nextSubject.subject.kind !== 'entity')
			) {
				return refuse(
					'invalid-payload',
					"A Presentation follows its object's name only when it names a Scene entity; every other Presentation needs its own name.",
				);
			}
			const updated: ExperiencePresentation = {
				id: previous.id,
				label: labelPresent ? (label ?? null) : previous.label,
				views: nextViews,
				subject: subject === null ? previous.subject : subject.value,
				text: textPresent ? text : previous.text,
				explorable: explorable ?? previous.explorable,
			};
			const updatedExperience: Experience = {
				...container,
				presentations: container.presentations.map((candidate, index) =>
					index === presentationIndex ? updated : candidate,
				),
			};
			let source = withExperience(envelope, updatedExperience);
			if (createdView !== null) {
				source = {
					...source,
					units: {
						...source.units,
						camera: {
							header: { ...envelope.units.camera.header },
							data: {
								formatVersion: CAMERA_UNIT_FORMAT_VERSION,
								views: [...envelope.units.camera.data.views, createdView],
								connections: envelope.units.camera.data.connections,
							},
						},
					},
				};
			}
			const joined = withStraightConnections(
				envelope,
				source,
				travelPaths,
				capturedIds(request.intent, 'connection'),
			);
			if (joined.kind === 'refused') return refuse(joined.code, joined.message);
			source = joined.envelope;
			const changedFields: string[] = [];
			if (updated.label !== previous.label) changedFields.push('label');
			if (textPresent) changedFields.push('text');
			if (updated.explorable !== previous.explorable) changedFields.push('explorable');
			if (subject !== null) changedFields.push('subject');
			if (JSON.stringify(updated.views) !== JSON.stringify(previous.views))
				changedFields.push('views');
			const changes: OperationChange[] = [
				{
					kind: 'experience.presentation.updated',
					subjectIds: [updated.id],
					fields: changedFields,
				},
			];
			const correspondence: CorrespondenceEntry[] = [
				{
					relation: 'preserved',
					before: reference(
						'experience',
						'presentation',
						previous.id,
						[container.id],
						revisionOf(envelope, 'experience'),
					),
					after: reference(
						'experience',
						'presentation',
						previous.id,
						[container.id],
						revisionOf(source, 'experience'),
					),
				},
			];
			if (createdView !== null) {
				changes.push({
					kind: 'camera.view.created',
					subjectIds: [createdView.id],
					fields: ['label', 'eye', 'target', 'fov', 'connectedViewIds'],
				});
				correspondence.push({
					relation: 'created',
					before: null,
					after: reference('camera', 'view', createdView.id, [], revisionOf(source, 'camera')),
				});
			}
			const records = connectionRecords(source, joined.connections);
			return prepared(
				request,
				source,
				[...changes, ...records.changes],
				[...correspondence, ...records.correspondence],
			);
		},
	};
}

/**
 * Remove one Presentation. Targets: exactly one `experience:presentation`
 * reference. Its Stops, Gates and unshared Camera Views (with their connections)
 * go with it, so it may write Camera.
 */
export function createExperiencePresentationRemovePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-presentation-remove',
		kind: EXPERIENCE_PRESENTATION_REMOVE_KIND,
		admission: {
			domain: 'experience',
			compound: true,
			writes: ['camera'],
			units: true,
			resources: false,
		},
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const invalid = emptyPayload(request, 'Presentation');
			if (invalid !== null) return invalid;
			const target = targetOf(request.intent, 'experience', 'presentation');
			if (target === null) {
				return refuse(
					'unsupported-operation',
					'experience-presentation-remove targets exactly one experience:presentation reference',
				);
			}
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse(
					'missing-target',
					`the Presentation's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`,
				);
			}
			return installRemoval(
				request,
				envelope,
				container.id,
				planPresentationRemoval(
					envelope.units.experience.data.experiences,
					envelope.units.camera.data,
					container.id,
					target.subject.id,
				),
			);
		},
	};
}

export const VIEW_REMOVE_KEYS = ['viewId', 'defaultViewId'] as const;

/**
 * Remove one View from one Presentation. Targets: exactly one
 * `experience:presentation` reference; the payload names the View and, when it
 * is the Default, the new Default. The Camera View is deleted only when no other
 * Presentation lists it, so it may write Camera.
 */
export function createExperiencePresentationViewRemovePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.experience-presentation-view-remove',
		kind: EXPERIENCE_PRESENTATION_VIEW_REMOVE_KIND,
		admission: {
			domain: 'experience',
			compound: true,
			writes: ['camera'],
			units: true,
			resources: false,
		},
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const payload = reader.object(request.intent.payload, '$.payload', VIEW_REMOVE_KEYS);
			if (payload === null)
				return refuse(
					'invalid-payload',
					'The View removal payload is not a valid shape',
					reader.issues,
				);
			const viewId = reader.opaqueId(payload.viewId, '$.payload.viewId');
			const defaultViewId =
				payload.defaultViewId === undefined || payload.defaultViewId === null
					? null
					: reader.opaqueId(payload.defaultViewId, '$.payload.defaultViewId');
			if (
				viewId === null ||
				(payload.defaultViewId !== undefined &&
					payload.defaultViewId !== null &&
					defaultViewId === null)
			) {
				return refuse(
					'invalid-payload',
					'The View removal payload is not a valid shape',
					reader.issues,
				);
			}
			const target = targetOf(request.intent, 'experience', 'presentation');
			if (target === null) {
				return refuse(
					'unsupported-operation',
					'experience-presentation-view-remove targets exactly one experience:presentation reference',
				);
			}
			const container = containerOf(envelope, target);
			if (container === undefined) {
				return refuse(
					'missing-target',
					`the Presentation's Experience "${target.instancePath[0] ?? '(unspecified)'}" is not in this envelope`,
				);
			}
			return installRemoval(
				request,
				envelope,
				container.id,
				planPresentationViewRemoval(
					envelope.units.experience.data.experiences,
					envelope.units.camera.data,
					container.id,
					target.subject.id,
					viewId,
					defaultViewId,
				),
			);
		},
	};
}
