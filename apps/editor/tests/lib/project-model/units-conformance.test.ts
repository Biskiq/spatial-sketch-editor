/**
 * F.2 `unit-envelope-v1` conformance — the `T3.P01.S01` provider for
 * `F2.unit-envelope@1`.
 *
 * AM-2's required conformance set (empty and two-Experience round trips,
 * required-kind/version refusal, reference/lock diagnostics, genuine resource
 * pins) plus the S01 acceptance rows: the strict refusal matrix, the header /
 * payload version rule, the duplicate-and-conflicting lock pin rules and the
 * separation of structural failure from executable closure.
 *
 * Every fixture is built through the provider's own canonical/writer entry, so
 * the suite proves the shapes a reader accepts rather than a hand-written object
 * that happens to parse. Import closure and root-barrel isolation are proved by
 * `program-entry-closure.test.ts` (arch lane), which walks the package sources.
 */
import { describe, expect, it } from 'vitest';

import { createEmptyWallFirstProject, validateProject } from '@portfolio/project-model';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	LAYOUT_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	createProjectEnvelope,
	serializeProjectEnvelope,
	validateDependencyLock,
	validateProjectEnvelope,
	validateResourcePayload,
	validateCameraPayload,
	validateExperiencePayload,
	verifyUnitContentRevisions,
	type CameraUnitPayload,
	type CameraView,
	type DependencyLock,
	type Experience,
	type ExperienceUnitPayload,
	type ProjectEnvelope,
	type ResourceUnitPayload,
	type TypedResource
} from '@portfolio/project-model/units';

const EMPTY = createEmptyWallFirstProject({ id: 'project-1', name: 'Project one' });

function lock(entries: DependencyLock['entries'] = []): DependencyLock {
	return { formatVersion: 1, entries };
}

async function envelope(overrides: {
	experience?: ExperienceUnitPayload;
	camera?: CameraUnitPayload;
	resources?: ResourceUnitPayload;
	dependencyLock?: DependencyLock;
} = {}): Promise<ProjectEnvelope> {
	const source = validateProject(EMPTY);
	if (!source.success) throw new Error('the fixture source does not validate');
	return createProjectEnvelope({
		id: 'project-1',
		name: 'Project one',
		acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
		dependencyLock: overrides.dependencyLock ?? lock(),
		layout: { unitId: 'unit-layout', data: source.project.layout },
		scene: {
			unitId: 'unit-scene',
			data: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: source.project.scene.textures,
				materials: source.project.scene.materials,
				entities: source.project.scene.entities
			}
		},
		camera: {
			unitId: 'unit-camera',
			data: overrides.camera ?? { formatVersion: CAMERA_UNIT_FORMAT_VERSION, views: [], connections: [] }
		},
		experience: {
			unitId: 'unit-experience',
			data: overrides.experience ?? { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [] }
		},
		resources: {
			unitId: 'unit-resources',
			data: overrides.resources ?? { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [] }
		}
	});
}

const PIN = { hash: 'sha256-paper', mime: 'image/png', size: 512, locator: 'objects/paper' };

function readBack(value: ProjectEnvelope) {
	return JSON.parse(serializeProjectEnvelope(value)) as unknown;
}

describe('the F.2 envelope round trips', () => {
	it('accepts an empty project with explicitly empty collections', async () => {
		const built = await envelope();
		const validated = validateProjectEnvelope(readBack(built));
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		expect(validated.diagnostics).toEqual([]);
		expect(validated.closure).toEqual([]);
		expect(validated.envelope.units.camera.data.views).toEqual([]);
		expect(validated.envelope.units.experience.data.experiences).toEqual([]);
		expect(validated.envelope.units.resources.data.resources).toEqual([]);
	});

	it('carries one unit per domain at that domain’s admitted version', async () => {
		const built = await envelope();
		expect(
			Object.fromEntries(Object.entries(built.units).map(([domain, unit]) => [domain, unit.header.formatVersion]))
		).toEqual({
			layout: LAYOUT_UNIT_FORMAT_VERSION,
			scene: SCENE_UNIT_FORMAT_VERSION,
			camera: CAMERA_UNIT_FORMAT_VERSION,
			experience: EXPERIENCE_UNIT_FORMAT_VERSION,
			resources: RESOURCE_UNIT_FORMAT_VERSION
		});
	});

	it('round trips a two-Experience collection over one world', async () => {
		const built = await envelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [
					{ id: 'view-1', label: 'Entry', eye: [0, 0, 0], target: [0, 0, 1], fov: 54, connectedViewIds: [] }
				],
				connections: []
			},
			experience: {
				formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
				experiences: [experience('experience-a', 'view-1'), experience('experience-b', 'view-1')]
			}
		});
		const validated = validateProjectEnvelope(readBack(built));
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		expect(validated.envelope.units.experience.data.experiences.map((entry) => entry.id)).toEqual([
			'experience-a',
			'experience-b'
		]);
		expect(validated.diagnostics).toEqual([]);
	});

	it('accepts a resource whose bytes are pinned and refuses one with no revision, pin or diagnostic', async () => {
		const pinned = await envelope({
			resources: {
				formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
				resources: [{ kind: 'texture', id: 'texture-1', contentRevision: null, pin: PIN, unresolved: null }]
			}
		});
		expect(validateProjectEnvelope(readBack(pinned)).success).toBe(true);

		const undecided = validateResourcePayload({
			formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
			resources: [{ kind: 'texture', id: 'texture-1', contentRevision: null, pin: null, unresolved: null }]
		});
		expect(undecided.success).toBe(false);
		if (undecided.success) return;
		expect(undecided.issues.map((issue) => issue.code)).toContain('unresolved-resource-without-diagnostic');
	});

	it('recomputes every declared content revision', async () => {
		const built = await envelope();
		expect(await verifyUnitContentRevisions(built)).toEqual([]);
		const tampered: ProjectEnvelope = {
			...built,
			units: { ...built.units, camera: { ...built.units.camera, header: { ...built.units.camera.header, contentRevision: 'sha256-other' } } }
		};
		const mismatches = await verifyUnitContentRevisions(tampered);
		expect(mismatches.map((entry) => entry.path)).toEqual(['$.units.camera']);
	});
});

function experience(id: string, viewId: string): Experience {
	return {
		id,
		label: id,
		entryGuideId: 'guide-1',
		presentations: [{ id: 'presentation-1', label: 'Entry', viewId }],
		stops: [
			{
				id: 'stop-1',
				presentationId: 'presentation-1',
				holdSeconds: 0,
				continuation: { kind: 'end' }
			}
		],
		guides: [{ id: 'guide-1', label: 'Guide', stopIds: ['stop-1'], entryStopId: 'stop-1' }],
		gates: [],
		detours: []
	};
}

describe('the strict refusal matrix', () => {
	it('refuses an unknown envelope key, an unknown unit and a missing unit', async () => {
		const built = await envelope();
		const back = readBack(built) as Record<string, unknown>;
		expect(validateProjectEnvelope({ ...back, extra: 1 }).success).toBe(false);
		expect(validateProjectEnvelope({ ...back, formatVersion: 2 }).success).toBe(false);

		const units = { ...(back.units as Record<string, unknown>) };
		delete units.experience;
		expect(validateProjectEnvelope({ ...back, units }).success).toBe(false);

		const withExtraUnit = { ...units, weather: units.camera };
		expect(validateProjectEnvelope({ ...back, units: withExtraUnit }).success).toBe(false);
	});

	it('refuses a header/payload version mismatch and an unsupported payload version', async () => {
		const built = await envelope();
		const back = readBack(built) as Record<string, unknown>;
		const units = back.units as Record<string, { header: Record<string, unknown>; data: Record<string, unknown> }>;
		const mismatched = {
			...back,
			units: { ...units, camera: { header: { ...units.camera.header, formatVersion: 9 }, data: units.camera.data } }
		};
		const refused = validateProjectEnvelope(mismatched);
		expect(refused.success).toBe(false);
		if (refused.success) return;
		expect(refused.issues.map((issue) => issue.code)).toContain('unsupported_format_version');

		const payloadMismatch = {
			...back,
			units: { ...units, scene: { header: units.scene.header, data: { ...units.scene.data, formatVersion: 1 } } }
		};
		const second = validateProjectEnvelope(payloadMismatch);
		expect(second.success).toBe(false);
	});

	it('refuses a non-finite value anywhere in a unit', async () => {
		const built = await envelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [{ id: 'view-1', label: 'Entry', eye: [0, 0, 0], target: [0, 0, 1], fov: 54, connectedViewIds: [] }],
				connections: []
			}
		});
		const back = readBack(built) as Record<string, unknown>;
		const units = back.units as Record<string, { header: Record<string, unknown>; data: Record<string, unknown> }>;
		const views = (units.camera.data.views as Record<string, unknown>[]).map((view) => ({ ...view, fov: Infinity }));
		const nonFinite = {
			...back,
			units: { ...units, camera: { header: units.camera.header, data: { ...units.camera.data, views } } }
		};
		expect(validateProjectEnvelope(nonFinite).success).toBe(false);
	});

	it('refuses an editorial field on a Camera view instead of silently dropping it', async () => {
		const built = await envelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [{ id: 'view-1', label: 'Entry', eye: [0, 0, 0], target: [0, 0, 1], fov: 54, connectedViewIds: [] }],
				connections: []
			}
		});
		const back = readBack(built) as Record<string, unknown>;
		const units = back.units as Record<string, { header: Record<string, unknown>; data: Record<string, unknown> }>;
		const views = [{ ...(units.camera.data.views as Record<string, unknown>[])[0]!, nextNodeId: 'view-1' }];
		expect(
			validateProjectEnvelope({
				...back,
				units: { ...units, camera: { header: units.camera.header, data: { ...units.camera.data, views } } }
			}).success
		).toBe(false);
	});

	it('refuses a duplicate lock entry and a conflicting pin', () => {
		const entry = {
			domain: 'camera',
			subjectKind: 'view',
			subjectId: 'view-1',
			instancePath: [],
			contentRevision: 'sha256-camera',
			requiredCapabilities: [{ id: 'F2.unit-envelope', version: '1' }],
			pin: null
		};
		const duplicate = validateDependencyLock({ formatVersion: 1, entries: [entry, { ...entry }] });
		expect(duplicate.success).toBe(false);
		if (duplicate.success) return;
		expect(duplicate.issues.map((issue) => issue.code)).toEqual(['duplicate-lock-entry']);

		const conflicting = validateDependencyLock({
			formatVersion: 1,
			entries: [entry, { ...entry, contentRevision: 'sha256-other' }]
		});
		expect(conflicting.success).toBe(false);
		if (conflicting.success) return;
		expect(conflicting.issues.map((issue) => issue.code)).toEqual(['conflicting-pins']);
	});

	it('refuses a duplicate identity inside one unit', async () => {
		const view: CameraView = {
			id: 'view-1',
			label: 'Entry',
			eye: [0, 0, 0],
			target: [0, 0, 1],
			fov: 54,
			connectedViewIds: []
		};
		const built = await envelope();
		built.units.camera.data.views = [view, { ...view, label: 'Again', eye: [1, 0, 0], target: [1, 0, 1] }];
		const refused = validateProjectEnvelope(built);
		expect(refused.success).toBe(false);
		if (refused.success) return;
		expect(refused.issues.map((issue) => issue.code)).toContain('duplicate-identity');
	});
});

describe('references, lock diagnostics and closure', () => {
	it('reports an authored Presentation whose Camera view is absent as a non-blocking diagnostic', async () => {
		const built = await envelope({
			experience: {
				formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
				experiences: [experience('experience-a', 'view-absent')]
			}
		});
		const validated = validateProjectEnvelope(readBack(built));
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		expect(validated.diagnostics.map((entry) => entry.code)).toEqual(['unresolved-view']);
		expect(validated.closure).toEqual([]);
	});

	it('reports an unsatisfied resource lock entry as an executable-closure finding, not a structural failure', async () => {
		const built = await envelope({
			dependencyLock: lock([
				{
					domain: 'resource:texture',
					subjectKind: 'resource',
					subjectId: 'texture-1',
					instancePath: [],
					contentRevision: PIN.hash,
					requiredCapabilities: [{ id: 'F2.unit-envelope', version: '1' }],
					pin: PIN
				}
			])
		});
		const validated = validateProjectEnvelope(readBack(built));
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		expect(validated.diagnostics).toEqual([]);
		expect(validated.closure.map((entry) => entry.code)).toEqual(['missing-resource']);
	});

	it('accepts a genuine resource pin and reports mismatches against the lock', async () => {
		const resource: TypedResource = {
			kind: 'texture',
			id: 'texture-1',
			contentRevision: PIN.hash,
			pin: PIN,
			unresolved: null
		};
		const built = await envelope({
			resources: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [resource] },
			dependencyLock: lock([
				{
					domain: 'resource:texture',
					subjectKind: 'resource',
					subjectId: 'texture-1',
					instancePath: [],
					contentRevision: PIN.hash,
					requiredCapabilities: [{ id: 'F2.unit-envelope', version: '1' }],
					pin: PIN
				}
			])
		});
		const matching = validateProjectEnvelope(readBack(built));
		expect(matching.success).toBe(true);
		if (!matching.success) return;
		expect(matching.closure).toEqual([]);

		const mismatched = await envelope({
			resources: {
				formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
				resources: [{ ...resource, contentRevision: 'sha256-other' }]
			},
			dependencyLock: lock([
				{
					domain: 'resource:texture',
					subjectKind: 'resource',
					subjectId: 'texture-1',
					instancePath: [],
					contentRevision: PIN.hash,
					requiredCapabilities: [{ id: 'F2.unit-envelope', version: '1' }],
					pin: PIN
				}
			])
		});
		const reported = validateProjectEnvelope(readBack(mismatched));
		expect(reported.success).toBe(true);
		if (!reported.success) return;
		expect(reported.closure.map((entry) => entry.code)).toEqual(['resource-revision-mismatch']);
	});

	it('keeps the envelope source-content digest independent of the accepted revision', async () => {
		const built = await envelope();
		const other = { ...built, acceptedRevision: { projectId: 'project-1', revisionId: 'revision-9' } };
		expect(await computeEnvelopeSourceContentId(other)).toBe(await computeEnvelopeSourceContentId(built));
	});
});


describe('independent AM-2 regressions', () => {
	it('requires the accepted revision to belong to the envelope and validates writes', async () => {
		const built = await envelope();
		const invalid = { ...built, acceptedRevision: { projectId: 'other', revisionId: 'r' } };
		expect(validateProjectEnvelope(invalid).success).toBe(false);
		expect(() => serializeProjectEnvelope(invalid)).toThrow();
	});

	it('keys lock paths and kind/id pairs without delimiter collisions', () => {
		const entry = { domain: 'camera' as const, subjectKind: 'view', subjectId: 'a|b', instancePath: ['x/y'],
			contentRevision: 'r', requiredCapabilities: [], pin: null };
		expect(validateDependencyLock(lock([entry, { ...entry, instancePath: ['x', 'y'] },
			{ ...entry, subjectKind: 'view|a', subjectId: 'b' }])).success).toBe(true);
	});

	it('refuses conflicting versions of one required capability and inexact byte sizes', () => {
		const entry = { domain: 'camera' as const, subjectKind: 'view', subjectId: 'view-1', instancePath: [],
			contentRevision: 'r', requiredCapabilities: [{ id: 'f', version: '1' }, { id: 'f', version: '2' }], pin: null };
		expect(validateDependencyLock(lock([entry])).success).toBe(false);
		expect(validateResourcePayload({ formatVersion: 1, resources: [{ kind: 'texture', id: 't',
			contentRevision: null, pin: { ...PIN, size: 1e30 }, unresolved: null }] }).success).toBe(false);
	});

	it('reports pin-only revision mismatches and absent lock pin metadata', async () => {
		const resource: TypedResource = { kind: 'texture', id: 'texture-1', contentRevision: null, pin: PIN, unresolved: null };
		for (const entry of [
			{ contentRevision: 'other', pin: PIN },
			{ contentRevision: PIN.hash, pin: null }
		]) {
			const built = await envelope({ resources: { formatVersion: 1, resources: [resource] }, dependencyLock: lock([{
				domain: 'resource:texture', subjectKind: 'resource', subjectId: 'texture-1', instancePath: [],
				requiredCapabilities: [], ...entry
			}]) });
			const read = validateProjectEnvelope(built);
			expect(read.success && read.closure.length > 0).toBe(true);
		}
	});
});


it('retains the current project codec camera eye/target constraint in the Camera unit', () => {
	const result = validateCameraPayload({ formatVersion: 1, views: [
		{ id: 'a', label: 'A', eye: [0, 0, 0], target: [0, 0, 1], fov: 54, connectedViewIds: ['b'] },
		{ id: 'b', label: 'B', eye: [4, 0, 0], target: [4, 0, 1], fov: 54, connectedViewIds: ['a'] }
	], connections: [{ id: 'c', fromNodeId: 'a', toNodeId: 'b', clearance: 0.5,
		positionPath: { kind: 'auto-bezier', anchors: [] },
		viewTracks: { forward: [{ id: 'k', progress: 0.5, cameraTarget: [2, 0, 0], fov: 54 }], reverse: [] }
	}] });
	expect(result.success).toBe(false);
	if (!result.success) expect(result.issues[0]!.code).toBe('camera_target_too_close');
});

it('requires distinct Stop identities for repeated authored Guide placements', () => {
	const value = experience('experience-a', 'view-1');
	value.guides = [{ ...value.guides[0]!, stopIds: ['stop-1', 'stop-1'] }];
	expect(validateExperiencePayload({ formatVersion: 1, experiences: [value] }).success).toBe(false);
});
