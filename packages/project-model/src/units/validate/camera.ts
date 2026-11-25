import { validateProjectSceneCameraPoses } from '../../project-layout-semantics';
import { SCENE_WORLD_LOCAL_FORMAT_VERSION } from '../../scene';
import { validateSceneDocument } from '../../scene-codec/validate';
import { ShapeReader, type ShapeValidation } from '../../strict-shape';
import { CAMERA_UNIT_SCENE_VALIDATION } from '../camera-connectivity';
import { CAMERA_UNIT_FORMAT_VERSION, type CameraUnitPayload, type CameraView } from '../types';
import { failed, delegatedIssues } from './shared';

export const CAMERA_VIEW_KEYS = ['id', 'label', 'eye', 'target', 'fov', 'connectedViewIds'] as const;
export const CAMERA_PAYLOAD_KEYS = ['formatVersion', 'views', 'connections'] as const;

/**
 * Strict read of the Camera 1 payload.
 *
 * A view is the non-editorial half of a landed navigation node — id, label,
 * eye/target/fov and connectivity — so an order link, a stop hold, a lock or a
 * detour field on a view is an unknown key and is rejected here rather than
 * being silently dropped by the migration. The connections are the landed Scene
 * connection records and are validated by the landed validator, with the views
 * supplied as its navigation nodes, so endpoint and path semantics keep exactly
 * one implementation.
 */
export function validateCameraPayload(input: unknown): ShapeValidation<CameraUnitPayload> {
	const reader = new ShapeReader();
	const record = reader.object(input, '$', CAMERA_PAYLOAD_KEYS);
	if (record === null) return failed(reader);
	if (record.formatVersion !== CAMERA_UNIT_FORMAT_VERSION) {
		reader.problem('$.formatVersion', 'unsupported_format_version', `$.formatVersion must be ${CAMERA_UNIT_FORMAT_VERSION}`);
		return failed(reader);
	}
	if (!Array.isArray(record.views)) {
		reader.problem('$.views', 'not-an-array', '$.views must be an array');
		return failed(reader);
	}
	const views: CameraView[] = [];
	const viewIds = new Set<string>();
	for (const [index, entry] of record.views.entries()) {
		const path = `$.views[${index}]`;
		const viewRecord = reader.object(entry, path, CAMERA_VIEW_KEYS);
		if (viewRecord === null) return failed(reader);
		const id = reader.opaqueId(viewRecord.id, `${path}.id`);
		const label = reader.string(viewRecord.label, `${path}.label`);
		const eye = reader.vector3(viewRecord.eye, `${path}.eye`);
		const target = reader.vector3(viewRecord.target, `${path}.target`);
		const fov = reader.number(viewRecord.fov, `${path}.fov`);
		const connectedViewIds = reader.opaqueIdArray(viewRecord.connectedViewIds, `${path}.connectedViewIds`);
		if (id === null || label === null || eye === null || target === null || fov === null || connectedViewIds === null) {
			return failed(reader);
		}
		if (viewIds.has(id)) reader.problem(`${path}.id`, 'duplicate-identity', `view "${id}" is declared twice`);
		viewIds.add(id);
		views.push({ id, label, eye, target, fov, connectedViewIds });
	}
	if (reader.issues.length > 0) return failed(reader);
	// Camera-unit admission uses the one named policy for independent Travel
	// pairs. A direct Scene document keeps the codec's single-component default.
	const delegated = validateSceneDocument(
		{
			formatVersion: SCENE_WORLD_LOCAL_FORMAT_VERSION,
			textures: [],
			materials: [],
			entities: [],
			navigationNodes: views.map((view) => ({
				id: view.id,
				label: view.label,
				position: [...view.eye] as [number, number, number],
				cameraTarget: [...view.target] as [number, number, number],
				fov: view.fov,
				connectedNodeIds: [...view.connectedViewIds]
			})),
			connections: record.connections
		},
		CAMERA_UNIT_SCENE_VALIDATION
	);
	if (!delegated.success) return { success: false, issues: delegatedIssues(delegated.issues) };
	const poseIssues = validateProjectSceneCameraPoses(delegated.document);
	if (poseIssues.length > 0) return { success: false, issues: poseIssues.map((issue) => ({ ...issue, path: issue.path.replace('$.scene.', '$.') })) };
	const resolved: CameraView[] = delegated.document.navigationNodes.map((node) => ({
		id: node.id,
		label: node.label,
		eye: [...node.position] as [number, number, number],
		target: [...node.cameraTarget] as [number, number, number],
		fov: node.fov,
		connectedViewIds: [...node.connectedNodeIds]
	}));
	return {
		success: true,
		value: { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: resolved, connections: delegated.document.connections },
		ignoredOptionalExtensions: []
	};
}
