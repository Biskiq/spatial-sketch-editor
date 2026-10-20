/**
 * Closed fixtures for the T3.P01.S06 runtime preparation. Every envelope is built
 * through the F.2 provider's own canonical writer, so the tests read the shapes a
 * real reader accepts rather than a hand-written object that happens to parse.
 */
import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	createProjectEnvelope,
	type CameraUnitPayload,
	type ExperienceUnitPayload,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

export const VIEWS: CameraUnitPayload['views'] = [
	{
		id: 'view-1',
		label: 'Piano',
		eye: [0, 1.6, 2],
		target: [0, 1.4, 0],
		fov: 54,
		connectedViewIds: ['view-2']
	},
	{
		id: 'view-2',
		label: 'Gallery',
		eye: [4, 1.6, 2],
		target: [4, 1.4, 0],
		fov: 54,
		connectedViewIds: ['view-1']
	}
];

export const CONNECTIONS: CameraUnitPayload['connections'] = [
	{
		id: 'connection-1',
		fromNodeId: 'view-1',
		toNodeId: 'view-2',
		positionPath: {
			kind: 'rounded-polyline',
			anchors: [{ id: 'anchor-1', position: [2, 1.6, 2] }]
		},
		clearance: 0.35,
		timing: {
			forward: { durationSeconds: 4, easing: 'smoothstep' },
			reverse: { durationSeconds: 3, easing: 'linear' }
		}
	}
];

export const EXPERIENCE: ExperienceUnitPayload = {
	formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
	experiences: [
		{
			id: 'experience-1',
			label: 'Morning walk',
			entryGuideId: 'guide-1',
			presentations: [
				{ id: 'presentation-1', label: 'Piano', viewId: 'view-1' },
				{ id: 'presentation-2', label: 'Gallery', viewId: 'view-2' }
			],
			stops: [
				{ id: 'stop-1', presentationId: 'presentation-1', holdSeconds: 0.5 },
				{ id: 'stop-2', presentationId: 'presentation-2', continuation: { kind: 'end' } }
			],
			guides: [
				{ id: 'guide-1', label: 'Main', stopIds: ['stop-1', 'stop-2'], entryStopId: 'stop-1' }
			],
			gates: [],
			detours: []
		}
	]
};

export async function experienceEnvelope(overrides: {
	camera?: CameraUnitPayload;
	experience?: ExperienceUnitPayload;
} = {}): Promise<ProjectEnvelope> {
	return createProjectEnvelope({
		id: 'project-1',
		name: 'Project one',
		acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: 'unit-layout', data: createEmptyWallFirstLayoutDocument() },
		scene: {
			unitId: 'unit-scene',
			data: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: [],
				materials: [],
				entities: []
			}
		},
		camera: {
			unitId: 'unit-camera',
			data: overrides.camera ?? { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: VIEWS, connections: CONNECTIONS }
		},
		experience: {
			unitId: 'unit-experience',
			data: overrides.experience ?? EXPERIENCE
		},
		resources: { unitId: 'unit-resources', data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [] } }
	});
}

export const LOWERING_OPTIONS = {
	experienceId: 'experience-1',
	sourceContentId: 'digest-envelope',
	sessionEpoch: 'session-1',
	bindings: [
		{ stopId: 'stop-2', invocation: { kind: 'travel' as const, connectionId: 'connection-1' } }
	],
	content: [
		{ presentationId: 'presentation-1', records: [{ id: 'content-1', text: 'The piano.' }] }
	]
};
