/**
 * Canonical form and content identity for `unit-envelope-v1`.
 *
 * AM-2 fixes two identities and requires both to be key-order and whitespace
 * invariant: a unit's `contentRevision` hashes canonical domain data only, and
 * the envelope's source-content digest excludes `acceptedRevision` and every
 * session/history/receipt value. The material failure this suite catches is an
 * identity that changes when the same authored contents are written in a
 * different key order or re-serialized — the defect that would make two equal
 * sources compare unequal across a client/server round trip.
 */
import { describe, expect, it } from 'vitest';

import { createEmptyWallFirstProject, validateProject } from '@portfolio/project-model';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	canonicalUnitBytes,
	canonicalUnitJson,
	computeEnvelopeSourceContentId,
	computeUnitContentRevision,
	createProjectEnvelope,
	serializeProjectEnvelope,
	type ProjectEnvelope,
	type ProjectEnvelopeInput
} from '@portfolio/project-model/units';

const SOURCE = validateProject(createEmptyWallFirstProject({ id: 'project-1', name: 'Project one' }));

function parts(): Omit<ProjectEnvelopeInput, 'acceptedRevision' | 'dependencyLock' | 'id' | 'name'> {
	if (!SOURCE.success) throw new Error('the fixture source does not validate');
	const { layout, scene } = SOURCE.project;
	return {
		layout: { unitId: 'unit-layout', data: layout },
		scene: {
			unitId: 'unit-scene',
			data: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: scene.textures,
				materials: scene.materials,
				entities: scene.entities
			}
		},
		camera: {
			unitId: 'unit-camera',
			data: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [{ id: 'view-1', label: 'Entry', eye: [0, 0, 0], target: [0, 0, 1], fov: 54, connectedViewIds: [] }],
				connections: []
			}
		},
		experience: {
			unitId: 'unit-experience',
			data: {
				formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
				experiences: [
					{
						id: 'experience-a',
						label: 'Experience a',
						entryGuideId: 'guide-1',
						presentations: [{ id: 'presentation-1', label: 'Entry', viewId: 'view-1' }],
						stops: [
							{
								id: 'stop-1',
								presentationId: 'presentation-1',
								holdSeconds: 2,
								continuation: { kind: 'end' }
							}
						],
						guides: [{ id: 'guide-1', label: 'Guide', stopIds: ['stop-1'], entryStopId: 'stop-1' }],
						gates: [],
						detours: []
					}
				]
			}
		},
		resources: { unitId: 'unit-resources', data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [] } }
	};
}

async function build(): Promise<ProjectEnvelope> {
	return createProjectEnvelope({
		id: 'project-1',
		name: 'Project one',
		acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
		dependencyLock: { formatVersion: 1, entries: [] },
		...parts()
	});
}

describe('canonical unit bytes', () => {
	it('orders keys independently of how the value was assembled', () => {
		expect(canonicalUnitJson({ b: 2, a: [1, { d: 4, c: 3 }] })).toBe(
			canonicalUnitJson({ a: [1, { c: 3, d: 4 }], b: 2 })
		);
		expect(new TextDecoder().decode(canonicalUnitBytes({ b: 2, a: 1 }))).toBe('{"a":1,"b":2}');
	});

	it('drops absent values and keeps authored array order', () => {
		expect(canonicalUnitJson({ a: undefined, b: 1 })).toBe('{"b":1}');
		expect(canonicalUnitJson({ list: ['b', 'a'] })).toBe('{"list":["b","a"]}');
	});

	it('refuses a value a validated unit could not carry', () => {
		expect(() => canonicalUnitJson({ bad: Number.NaN })).toThrow(TypeError);
		expect(() => canonicalUnitJson({ bad: () => 1 })).toThrow(TypeError);
	});
});

describe('unit content revisions', () => {
	it('agree for equal contents written in a different key order', async () => {
		const built = await build();
		const reordered = {
			views: built.units.camera.data.views,
			connections: built.units.camera.data.connections,
			formatVersion: built.units.camera.data.formatVersion
		};
		expect(await computeUnitContentRevision({ id: 'view-1', fov: 54 })).toBe(
			await computeUnitContentRevision({ fov: 54, id: 'view-1' })
		);
		expect(await computeUnitContentRevision(reordered)).toBe(built.units.camera.header.contentRevision);
	});

	it('distinguish different authored contents, including a one-metre move', async () => {
		const built = await build();
		const moved = {
			...built.units.camera.data,
			views: [{ ...built.units.camera.data.views[0]!, eye: [0, 0, 0.001] as [number, number, number] }]
		};
		expect(await computeUnitContentRevision(moved)).not.toBe(built.units.camera.header.contentRevision);
		// The revision is over domain data only: the header never enters its own hash.
		expect(await computeUnitContentRevision(built.units.camera.data)).toBe(built.units.camera.header.contentRevision);
	});

	it('survive a canonical JSON round trip for every unit', async () => {
		const built = await build();
		const reparsed = JSON.parse(serializeProjectEnvelope(built)) as ProjectEnvelope;
		for (const domain of Object.keys(built.units) as Array<keyof ProjectEnvelope['units']>) {
			expect(await computeUnitContentRevision(reparsed.units[domain].data)).toBe(
				await computeUnitContentRevision(built.units[domain].data)
			);
		}
	});
});

describe('the envelope source-content digest', () => {
	it('is unchanged by re-serialization and by a different assembly order', async () => {
		const built = await build();
		const reparsed = JSON.parse(serializeProjectEnvelope(built)) as ProjectEnvelope;
		expect(await computeEnvelopeSourceContentId(reparsed)).toBe(await computeEnvelopeSourceContentId(built));
		const reassembled: ProjectEnvelope = {
			units: {
				resources: built.units.resources,
				experience: built.units.experience,
				camera: built.units.camera,
				scene: built.units.scene,
				layout: built.units.layout
			},
			dependencyLock: built.dependencyLock,
			acceptedRevision: built.acceptedRevision,
			name: built.name,
			id: built.id,
			formatVersion: built.formatVersion
		};
		expect(await computeEnvelopeSourceContentId(reassembled)).toBe(await computeEnvelopeSourceContentId(built));
	});

	it('changes when authored contents change', async () => {
		const built = await build();
		const edited = await createProjectEnvelope({
			id: built.id,
			name: built.name,
			acceptedRevision: built.acceptedRevision,
			dependencyLock: built.dependencyLock,
			...parts(),
			experience: {
				unitId: 'unit-experience',
				data: {
					formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
					experiences: [
						{
							...parts().experience.data.experiences[0]!,
							stops: [
								{
									id: 'stop-1',
									presentationId: 'presentation-1',
									holdSeconds: 3,
									continuation: { kind: 'end' }
								}
							]
						}
					]
				}
			}
		});
		expect(await computeEnvelopeSourceContentId(edited)).not.toBe(await computeEnvelopeSourceContentId(built));
	});
});
