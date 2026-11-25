import { type DomainPlanner, type OperationChange, type CorrespondenceEntry } from '../../f4/types';
import { ShapeReader } from '../../strict-shape';
import { refuse, envelopeOf, revisionOf, reference, targetOf } from './shared';
import { UNIT_SOURCE_KIND, UNIT_SOURCE_VERSION } from '../source';
import { CAMERA_UNIT_FORMAT_VERSION, type ProjectEnvelope } from '../types';

/** The single-domain Camera View operation kind. */
export const CAMERA_VIEW_UPDATE_KIND = 'camera-view-update';

export const VIEW_POSE_KEYS = ['label', 'eye', 'target', 'fov'] as const;

export type ViewPose = { readonly label: string; readonly eye: [number, number, number]; readonly target: [number, number, number]; readonly fov: number };

export function readViewPose(reader: ShapeReader, input: unknown, path: string): ViewPose | null {
	const record = reader.object(input, path, VIEW_POSE_KEYS);
	if (record === null) return null;
	const label = reader.string(record.label, `${path}.label`);
	const eye = reader.vector3(record.eye, `${path}.eye`);
	const target = reader.vector3(record.target, `${path}.target`);
	const fov = reader.numberAtLeast(record.fov, `${path}.fov`, 0, true);
	if (label === null || eye === null || target === null || fov === null) return null;
	return { label, eye, target, fov };
}

export const _UPDATE_PAYLOAD_KEYS = VIEW_POSE_KEYS;

/**
 * Rewrite one existing Camera View's authored pose and label.
 *
 * Targets: exactly one `camera:view` reference. The View must exist in the
 * envelope the dispatch validated; connectivity is preserved verbatim, because
 * changing it is a Camera connection operation with its own validation.
 */
export function createCameraViewUpdatePlanner(): DomainPlanner<ProjectEnvelope> {
	return {
		id: 'unit.camera-view-update',
		kind: CAMERA_VIEW_UPDATE_KIND,
		admission: { domain: 'camera', compound: false, units: true, resources: false },
		sourceKinds: [UNIT_SOURCE_KIND],
		sourceVersions: [UNIT_SOURCE_VERSION],
		prepare(request) {
			const envelope = envelopeOf(request);
			const reader = new ShapeReader();
			const pose = readViewPose(reader, request.intent.payload, '$.payload');
			if (pose === null) return refuse('invalid-payload', 'The Camera View payload is not a valid pose', reader.issues);
			const target = targetOf(request.intent, 'camera', 'view');
			if (target === null) {
				return refuse('unsupported-operation', 'camera-view-update targets exactly one camera:view reference');
			}
			const index = envelope.units.camera.data.views.findIndex((view) => view.id === target.subject.id);
			if (index === -1) {
				return refuse('missing-target', `camera view "${target.subject.id}" is not in this envelope`);
			}
			const previous = envelope.units.camera.data.views[index]!;
			const views = envelope.units.camera.data.views.map((view) =>
				view.id === previous.id ? { ...view, label: pose.label, eye: pose.eye, target: pose.target, fov: pose.fov } : view
			);
			const cameraData = { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views, connections: envelope.units.camera.data.connections };
			const candidate: ProjectEnvelope = {
				...envelope,
				units: {
					...envelope.units,
					camera: { header: { ...envelope.units.camera.header }, data: cameraData }
				}
			};
			const changes: OperationChange[] = [
				{ kind: 'camera.view.updated', subjectIds: [previous.id], fields: ['label', 'eye', 'target', 'fov'] }
			];
			const correspondence: CorrespondenceEntry[] = [
				{
					relation: 'preserved',
					before: reference('camera', 'view', previous.id, [], revisionOf(envelope, 'camera')),
					after: reference('camera', 'view', previous.id, [], revisionOf(candidate, 'camera'))
				}
			];
			return { kind: 'prepared', candidate: { operationId: request.intent.operationId, sourceKind: request.snapshot.sourceKind, sourceVersion: request.snapshot.sourceVersion, source: candidate, changes, correspondence, diagnostics: [] } };
		}
	};
}

/* --- shared payload readers ------------------------------------------------ */
