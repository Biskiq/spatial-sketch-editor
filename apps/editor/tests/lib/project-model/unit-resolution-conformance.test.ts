/**
 * `F1.reference@1:unit-resolution-v1` conformance — the additive F.2-backed
 * extension.
 *
 * The property this suite protects is *additivity*. The landed `references-v1`
 * reader resolves only its bounded current-domain adapters and answers
 * `incompatible` for `project-lock` because no F.2 lock reader existed; this
 * extension supplies that reader and the Camera/Experience/resource subject
 * kinds, and it must do so without editing the landed behaviour. So the suite
 * asserts both directions: an F.2 reader makes `project-lock` resolve, and
 * withholding it still produces the landed `incompatible` refusal.
 *
 * Ambiguity is a first-class answer here: a Stop id that appears in two
 * Experiences is `repair-required` when the reference names no instance, never a
 * first-match lookup.
 */
import { describe, expect, it } from 'vitest';

import {
	createEmptyWallFirstLayoutDocument,
	resolveReference,
	type SemanticReference
} from '@portfolio/project-model';
import {
	createDependencyLockReader,
	createUnitReadContext,
	resolveUnitReference,
	type UnitResolutionInput
} from '@portfolio/project-model/references/unit-resolution';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	createProjectEnvelope,
	createDomainUnit,
	type DependencyLock,
	type Experience,
	type ProjectEnvelope,
	type TypedResource
} from '@portfolio/project-model/units';

const EMPTY_LAYOUT = createEmptyWallFirstLayoutDocument();

const PIN = { hash: 'sha256-paper', mime: 'image/png', size: 512, locator: 'objects/paper' };

function experience(id: string, stopId: string): Experience {
	return {
		id,
		label: id,
		entryGuideId: null,
		presentations: [{ id: `presentation:${id}`, label: id, viewId: 'view-1' }],
		stops: [{ id: stopId, presentationId: `presentation:${id}`, continuation: { kind: 'end' } }],
		guides: [],
		gates: [],
		detours: []
	};
}

async function build(resources: TypedResource[] = [], lockEntries: DependencyLock['entries'] = []): Promise<ProjectEnvelope> {
	return createProjectEnvelope({
		id: 'project-1',
		name: 'Project one',
		acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
		dependencyLock: { formatVersion: 1, entries: lockEntries },
		layout: { unitId: 'unit-layout', data: EMPTY_LAYOUT },
		scene: {
			unitId: 'unit-scene',
			data: { formatVersion: SCENE_UNIT_FORMAT_VERSION, textures: [], materials: [], entities: [] }
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
			data: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [experience('experience-a', 'stop-1')] }
		},
		resources: { unitId: 'unit-resources', data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources } }
	});
}

function reference(overrides: Partial<SemanticReference> = {}): SemanticReference {
	return {
		version: 1,
		domain: 'camera',
		revision: { kind: 'exact', contentRevision: 'sha256-camera' },
		subject: { kind: 'view', id: 'view-1' },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
		...overrides
	};
}

function input(envelope: ProjectEnvelope, overrides: Partial<UnitResolutionInput> = {}): Omit<UnitResolutionInput, 'sourceContentId'> {
	return { envelope, sessionEpoch: 'session-1', ...overrides };
}

describe('the F.2 lock reader', () => {
	it('resolves project-lock to the locked content revision', async () => {
		const base = await build();
		const envelope = await build([], [
			{
				domain: 'camera',
				subjectKind: 'view',
				subjectId: 'view-1',
				instancePath: [],
				contentRevision: base.units.camera.header.contentRevision,
				requiredCapabilities: [{ id: 'F2.unit-envelope', version: '1' }],
				pin: null
			}
		]);
		const resolution = await resolveUnitReference(
			reference({ revision: { kind: 'project-lock', projectId: 'project-1' } }),
			input(envelope)
		);
		expect(resolution.kind).toBe('resolved');
		if (resolution.kind !== 'resolved') return;
		expect(resolution.subject.contentRevision).toBe(base.units.camera.header.contentRevision);
	});

	it('still refuses project-lock when no F.2 reader is admitted', async () => {
		const envelope = await build();
		const context = createUnitReadContext({
			envelope,
			sourceContentId: 'sha256-source',
			sessionEpoch: 'session-1',
			lock: null
		});
		const resolution = resolveReference(reference({ revision: { kind: 'project-lock', projectId: 'project-1' } }), context);
		expect(resolution.kind).toBe('failed');
		if (resolution.kind !== 'failed') return;
		expect(resolution.code).toBe('incompatible');
	});

	it('answers missing for a scope the lock does not pin', async () => {
		const envelope = await build();
		const resolution = await resolveUnitReference(
			reference({ revision: { kind: 'project-lock', projectId: 'project-1' } }),
			input(envelope)
		);
		expect(resolution.kind).toBe('failed');
		if (resolution.kind !== 'failed') return;
		expect(resolution.code).toBe('missing');
	});	it('exposes the envelope project as the reader identity', async () => {
		const envelope = await build();
		expect(createDependencyLockReader('project-1', envelope.dependencyLock).projectId).toBe('project-1');
	});
});

describe('Camera, Experience and resource subjects', () => {
	it('resolves an existing Camera view to the Camera unit revision', async () => {
		const envelope = await build();
		const resolution = await resolveUnitReference(reference({ revision: { kind: 'exact', contentRevision: envelope.units.camera.header.contentRevision } }), input(envelope));
		expect(resolution.kind).toBe('resolved');
		if (resolution.kind !== 'resolved') return;
		expect(resolution.subject.contentRevision).toBe(envelope.units.camera.header.contentRevision);
		expect(resolution.subject.location).toEqual({ kind: 'project-root' });
	});

	it('answers missing for a view the envelope does not carry', async () => {
		const envelope = await build();
		const resolution = await resolveUnitReference(
			reference({ subject: { kind: 'view', id: 'view-absent' } }),
			input(envelope)
		);
		expect(resolution.kind).toBe('failed');
		if (resolution.kind !== 'failed') return;
		expect(resolution.code).toBe('missing');
	});

	it('refuses an ambiguous Stop and resolves the instance-qualified reference', async () => {
		const envelope = await build();
		const twoExperiences: ProjectEnvelope = {
			...envelope,
			units: {
				...envelope.units,
				experience: {
					...envelope.units.experience,
					data: {
						formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
						experiences: [experience('experience-a', 'stop-shared'), experience('experience-b', 'stop-shared')]
					}
				}
			}
		};
		twoExperiences.units.experience = await createDomainUnit('experience', twoExperiences.units.experience.header.unitId, twoExperiences.units.experience.data);
		const ambiguous = await resolveUnitReference(
			reference({ domain: 'experience', subject: { kind: 'stop', id: 'stop-shared' } }),
			input(twoExperiences)
		);
		expect(ambiguous.kind).toBe('failed');
		if (ambiguous.kind !== 'failed') return;
		expect(ambiguous.code).toBe('repair-required');

		const qualified = await resolveUnitReference(
			reference({
				domain: 'experience',
				subject: { kind: 'stop', id: 'stop-shared' },
				revision: { kind: 'exact', contentRevision: twoExperiences.units.experience.header.contentRevision },
				instancePath: ['experience-b']
			}),
			input(twoExperiences)
		);
		expect(qualified.kind).toBe('resolved');
	});

	it('keeps an unresolved resource repairable and resolves a pinned one to its bytes', async () => {
		const unresolvedResource: TypedResource = {
			kind: 'texture',
			id: 'texture-1',
			contentRevision: null,
			pin: null,
			unresolved: {
				reference: reference({ domain: 'resource:texture', subject: { kind: 'resource', id: 'texture-1' } }),
				domain: 'resource:texture',
				status: 'repair-required',
				message: 'texture "texture-1" has no staged external pin'
			}
		};
		const pending = await build([unresolvedResource]);
		const repair = await resolveUnitReference(
			reference({ domain: 'resource:texture', subject: { kind: 'resource', id: 'texture-1' } }),
			input(pending)
		);
		expect(repair.kind).toBe('failed');
		if (repair.kind !== 'failed') return;
		expect(repair.code).toBe('repair-required');
		expect(repair.message).toBe('texture "texture-1" has no staged external pin');

		const pinned = await build([
			{ kind: 'texture', id: 'texture-1', contentRevision: null, pin: PIN, unresolved: null }
		]);
		const resolved = await resolveUnitReference(
			reference({ domain: 'resource:texture', subject: { kind: 'resource', id: 'texture-1' }, revision: { kind: 'exact', contentRevision: PIN.hash } }),
			input(pinned)
		);
		expect(resolved.kind).toBe('resolved');
		if (resolved.kind !== 'resolved') return;
		expect(resolved.subject.contentRevision).toBe(PIN.hash);
	});

	it('resolves Layout and Scene subjects from their owning units', async () => {
		const envelope = await build();
		const layout = await resolveUnitReference(
			reference({
				domain: 'layout',
				subject: { kind: 'level', id: 'floor' },
				revision: { kind: 'exact', contentRevision: envelope.units.layout.header.contentRevision }
			}),
			input(envelope)
		);
		expect(layout.kind).toBe('resolved');
		const scene = await resolveUnitReference(
			reference({
				domain: 'scene',
				subject: { kind: 'scene', id: 'project-1' },
				revision: { kind: 'exact', contentRevision: envelope.units.scene.header.contentRevision }
			}),
			input(envelope)
		);
		expect(scene.kind).toBe('resolved');
	});
});


describe('independent identity and revision regressions', () => {
	it('does not resolve one kind through the id of another kind', async () => {
		const envelope = await build();
		const result = await resolveUnitReference(reference({ subject: { kind: 'connection', id: 'view-1' } }), input(envelope));
		expect(result.kind === 'failed' && result.code).toBe('missing');
		const wrongKind = await resolveUnitReference(reference({ domain: 'experience', subject: { kind: 'guide', id: 'stop-1' } }), input(envelope));
		expect(wrongKind.kind === 'failed' && wrongKind.code).toBe('missing');
	});

	it('refuses stale exact and locked revisions instead of rebinding to current contents', async () => {
		const envelope = await build([], [{ domain: 'camera', subjectKind: 'view', subjectId: 'view-1', instancePath: [],
			contentRevision: 'old', requiredCapabilities: [], pin: null }]);
		for (const revision of [{ kind: 'exact', contentRevision: 'old' } as const,
			{ kind: 'project-lock', projectId: 'project-1' } as const]) {
			const result = await resolveUnitReference(reference({ revision }), input(envelope));
			expect(result.kind === 'failed' && result.code).toBe('repair-required');
		}
	});

	it('checks every path segment, location, component and capability qualification', async () => {
		const envelope = await build();
		const ref = reference({ domain: 'experience', subject: { kind: 'stop', id: 'stop-1' },
			revision: { kind: 'exact', contentRevision: envelope.units.experience.header.contentRevision } });
		for (const qualifiers of [{ instancePath: ['experience-a', 'ghost'] }, { componentId: 'ghost' },
			{ capabilityId: 'ghost' }, { location: { kind: 'layout-location', levelId: 'ghost', structureInstancePath: [] } }]) {
			const result = await resolveUnitReference({ ...ref, ...qualifiers }, input(envelope));
			expect(result.kind === 'failed' && result.code).toBe('missing');
		}
	});

	it('does not reuse a resolver under another accepted snapshot', async () => {
		const envelope = await build();
		const context = createUnitReadContext({ ...input(envelope), sourceContentId: 'source' });
		context.snapshot = { ...context.snapshot, acceptedRevision: { projectId: 'other', revisionId: 'r' } };
		const result = resolveReference(reference({ revision: { kind: 'exact', contentRevision: envelope.units.camera.header.contentRevision } }), context);
		expect(result.kind === 'failed' && result.code).toBe('repair-required');
	});

	it('keeps delimiter-bearing instance paths distinct in a real lock reader', () => {
		const entry = { domain: 'experience' as const, subjectKind: 'stop', subjectId: 's', instancePath: ['x/y'],
			contentRevision: 'one', requiredCapabilities: [], pin: null };
		const reader = createDependencyLockReader('project-1', { formatVersion: 1, entries: [entry,
			{ ...entry, instancePath: ['x', 'y'], contentRevision: 'two' }] });
		for (const [instancePath, expected] of [[['x/y'], 'one'], [['x', 'y'], 'two']] as const) {
			expect(reader.contentRevisionFor(reference({ domain: 'experience', subject: { kind: 'stop', id: 's' }, instancePath }))).toBe(expected);
		}
	});
});
