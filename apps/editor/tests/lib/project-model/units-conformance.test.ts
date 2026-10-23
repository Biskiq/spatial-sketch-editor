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

import { createEmptyWallFirstLayoutDocument } from '@portfolio/layout-core';
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

const EMPTY_LAYOUT = createEmptyWallFirstLayoutDocument();

function lock(entries: DependencyLock['entries'] = []): DependencyLock {
	return { formatVersion: 1, entries };
}

async function envelope(overrides: {
	experience?: ExperienceUnitPayload;
	camera?: CameraUnitPayload;
	resources?: ResourceUnitPayload;
	dependencyLock?: DependencyLock;
} = {}): Promise<ProjectEnvelope> {
	return createProjectEnvelope({
		id: 'project-1',
		name: 'Project one',
		acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
		dependencyLock: overrides.dependencyLock ?? lock(),
		layout: { unitId: 'unit-layout', data: EMPTY_LAYOUT },
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

function entryView(id: string): CameraView {
	return { id, label: id, eye: [0, 1.6, 2], target: [0, 1.4, 0], fov: 54, connectedViewIds: [] };
}

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
		presentations: [
			{ id: 'presentation-1', label: 'Entry', viewIds: [viewId], defaultViewId: viewId, subject: null, text: null }
		],
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

	it('discloses a Layout-element Presentation subject Preview cannot present', async () => {
		const base = experience('experience-a', 'view-1');
		const built = await envelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [entryView('view-1')],
				connections: []
			},
			experience: {
				formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
				experiences: [
					{
						...base,
						presentations: [
							{
								...base.presentations[0]!,
								subject: {
									version: 1,
									domain: 'layout',
									revision: { kind: 'project-lock', projectId: 'project-1' },
									subject: { kind: 'level', id: 'level-1' },
									instancePath: [],
									location: { kind: 'project-root' },
									componentId: null,
									capabilityId: null
								}
							}
						]
					}
				]
			}
		});
		const validated = validateProjectEnvelope(readBack(built));
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		// Admitted by the format, unresolved by Preview: the author is told instead of
		// being left to assume the run presents it.
		expect(validated.diagnostics).toHaveLength(1);
		expect(validated.diagnostics[0]).toMatchObject({
			path: '$.units.experience.data.experiences[0].presentations[0].subject',
			code: 'unresolved-subject'
		});
		expect(validated.diagnostics[0]!.message).toContain('does not resolve yet');
		expect(validated.closure).toEqual([]);
	});

	it('resolves a sequence-next Travel through the Guide order, not the Stop array order', async () => {
		const base = experience('experience-a', 'view-1');
		const presentation = (id: string, viewId: string) => ({
			id,
			label: id,
			viewIds: [viewId],
			defaultViewId: viewId,
			subject: null,
			text: null
		});
		const built = await envelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [
					{ ...entryView('view-1'), connectedViewIds: ['view-3'] },
					entryView('view-2'),
					{ ...entryView('view-3'), connectedViewIds: ['view-1'] }
				],
				connections: [{
					id: 'connection-1',
					fromNodeId: 'view-1',
					toNodeId: 'view-3',
					positionPath: { kind: 'rounded-polyline', anchors: [] },
					clearance: 0.35
				}]
			},
			experience: {
				formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
				experiences: [
					{
						...base,
						presentations: [
							presentation('presentation-1', 'view-1'),
							presentation('presentation-2', 'view-2'),
							presentation('presentation-3', 'view-3')
						],
						// The array order puts stop-2 after stop-1; the Guide order does not.
						stops: [
							{
								id: 'stop-1',
								presentationId: 'presentation-1',
								continuation: { kind: 'sequence-next', transition: 'travel' }
							},
							{ id: 'stop-2', presentationId: 'presentation-2', continuation: { kind: 'end' } },
							{
								id: 'stop-3',
								presentationId: 'presentation-3',
								continuation: { kind: 'sequence-next', transition: 'travel' }
							}
						],
						guides: [
							{
								id: 'guide-1',
								label: 'Guide',
								stopIds: ['stop-1', 'stop-3', 'stop-2'],
								entryStopId: 'stop-1'
							}
						]
					}
				]
			}
		});
		const validated = validateProjectEnvelope(readBack(built));
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		// stop-1 travels to stop-3 (connected, no finding); stop-3 travels to
		// stop-2 under the Guide order (no connection, one finding). Under the array
		// order the same source would report stop-1 → stop-2 and miss stop-3's edge.
		expect(validated.diagnostics.map((entry) => entry.path)).toEqual([
			'$.units.experience.data.experiences[0].stops[2].continuation.transition'
		]);
		expect(validated.diagnostics[0]!.code).toBe('travel-gap');
		expect(validated.diagnostics[0]!.message).toContain('stop "stop-2"');
	});

	it('reports no Travel gap when a guided Stop is the last of its Guide', async () => {
		const base = experience('experience-a', 'view-1');
		const presentation = (id: string, viewId: string) => ({
			id,
			label: id,
			viewIds: [viewId],
			defaultViewId: viewId,
			subject: null,
			text: null
		});
		const built = await envelope({
			camera: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [entryView('view-1'), entryView('view-2'), entryView('view-3')],
				connections: []
			},
			experience: {
				formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
				experiences: [
					{
						...base,
						presentations: [
							presentation('presentation-1', 'view-1'),
							presentation('presentation-2', 'view-2'),
							presentation('presentation-3', 'view-3')
						],
						stops: [
							{ id: 'stop-1', presentationId: 'presentation-1', continuation: { kind: 'end' } },
							// stop-2 is the last Stop of the Guide and still authors a Travel: its
							// `sequence-next` edge ends the run. stop-3 follows it only in the array.
							{
								id: 'stop-2',
								presentationId: 'presentation-2',
								continuation: { kind: 'sequence-next', transition: 'travel' }
							},
							{ id: 'stop-3', presentationId: 'presentation-3', continuation: { kind: 'end' } }
						],
						guides: [{ id: 'guide-1', label: 'Guide', stopIds: ['stop-1', 'stop-2'], entryStopId: 'stop-1' }]
					}
				]
			}
		});
		const validated = validateProjectEnvelope(readBack(built));
		expect(validated.success).toBe(true);
		if (!validated.success) return;
		expect(validated.diagnostics).toEqual([]);
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
		expect(validateResourcePayload({ formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [{ kind: 'texture', id: 't',
			contentRevision: null, pin: { ...PIN, size: 1e30 }, unresolved: null }] }).success).toBe(false);
	});

	it('reports pin-only revision mismatches and absent lock pin metadata', async () => {
		const resource: TypedResource = { kind: 'texture', id: 'texture-1', contentRevision: null, pin: PIN, unresolved: null };
		for (const entry of [
			{ contentRevision: 'other', pin: PIN },
			{ contentRevision: PIN.hash, pin: null }
		]) {
			const built = await envelope({ resources: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [resource] }, dependencyLock: lock([{
				domain: 'resource:texture', subjectKind: 'resource', subjectId: 'texture-1', instancePath: [],
				requiredCapabilities: [], ...entry
			}]) });
			const read = validateProjectEnvelope(built);
			expect(read.success && read.closure.length > 0).toBe(true);
		}
	});
});	it('retains the camera eye/target constraint in the Camera unit', () => {
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
	const result = validateExperiencePayload({ formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [value] });
	expect(result.success).toBe(false);
	if (!result.success) expect(result.issues.map((issue) => issue.code)).toContain('duplicate-identity');
});

/** A Scene or Camera semantic reference shaped as the Experience unit reads a Presentation subject. */
function subjectReference(domain: string, componentId: string | null = null) {
	return {
		version: 1,
		domain,
		revision: { kind: 'exact', contentRevision: 'revision-1' },
		subject: { kind: 'entity', id: 'entity-1' },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId,
		capabilityId: null
	};
}

/** The valid Experience-2 payload with one Experience, edited for a single refusal. */
function experiencePayload(edit: (value: Experience) => unknown) {
	return { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [edit(experience('experience-a', 'view-1'))] };
}

describe('validateExperiencePayload refusals', () => {
	it('accepts the valid fixture the refusal rows mutate', () => {
		expect(validateExperiencePayload(experiencePayload((value) => value)).success).toBe(true);
	});

	it.each([
		{
			name: 'a format-1 payload',
			code: 'unsupported_format_version',
			input: () => ({ formatVersion: 1, experiences: [experience('experience-a', 'view-1')] })
		},
		{
			name: 'a View repeated in one Presentation',
			code: 'duplicate-identity',
			input: () =>
				experiencePayload((value) => ({
					...value,
					presentations: [{ ...value.presentations[0]!, viewIds: ['view-1', 'view-1'] }]
				}))
		},
		{
			name: 'a Default View outside the Presentation views',
			code: 'default-not-in-views',
			input: () =>
				experiencePayload((value) => ({
					...value,
					presentations: [{ ...value.presentations[0]!, defaultViewId: 'view-missing' }]
				}))
		},
		{
			name: 'a Stop entry View its Presentation does not carry',
			code: 'entry-view-not-in-presentation',
			input: () =>
				experiencePayload((value) => ({
					...value,
					stops: [{ ...value.stops[0]!, entryViewId: 'view-missing' }]
				}))
		},
		{
			name: 'a component-scoped Presentation subject',
			code: 'component-not-admitted',
			input: () =>
				experiencePayload((value) => ({
					...value,
					presentations: [{ ...value.presentations[0]!, subject: subjectReference('scene', 'component-1') }]
				}))
		},
		{
			name: 'a capability-scoped Presentation subject',
			code: 'component-not-admitted',
			input: () =>
				experiencePayload((value) => ({
					...value,
					presentations: [
						{ ...value.presentations[0]!, subject: { ...subjectReference('scene'), capabilityId: 'capability-1' } }
					]
				}))
		},
		{
			name: 'a Presentation subject in the Camera domain',
			code: 'unsupported-subject-domain',
			input: () =>
				experiencePayload((value) => ({
					...value,
					presentations: [{ ...value.presentations[0]!, subject: subjectReference('camera') }]
				}))
		},
		{
			name: 'an unknown text kind',
			code: 'unknown-tag',
			input: () =>
				experiencePayload((value) => ({
					...value,
					presentations: [{ ...value.presentations[0]!, text: { kind: 'rich', body: 'The piano.' } }]
				}))
		},
		{
			name: 'Presentation text beyond the bound',
			code: 'text-too-long',
			input: () =>
				experiencePayload((value) => ({
					...value,
					presentations: [{ ...value.presentations[0]!, text: { kind: 'plain', body: 'x'.repeat(4001) } }]
				}))
		},
		{
			name: 'an end continuation carrying a transition',
			code: 'unknown-key',
			input: () =>
				experiencePayload((value) => ({
					...value,
					stops: [{ ...value.stops[0]!, continuation: { kind: 'end', transition: 'cut' } }]
				}))
		},
		{
			name: 'an unknown transition',
			code: 'unknown-tag',
			input: () =>
				experiencePayload((value) => ({
					...value,
					stops: [{ ...value.stops[0]!, continuation: { kind: 'sequence-next', transition: 'bezier' } }]
				}))
		},
		{
			name: 'the legacy viewId key on a Stop',
			code: 'unknown-key',
			input: () =>
				experiencePayload((value) => ({
					...value,
					stops: [{ ...value.stops[0]!, viewId: 'view-1' }]
				}))
		}
	])('refuses $name with $code', ({ code, input }) => {
		const result = validateExperiencePayload(input());
		expect(result.success).toBe(false);
		if (!result.success) expect(result.issues.map((issue) => issue.code)).toContain(code);
	});
});
