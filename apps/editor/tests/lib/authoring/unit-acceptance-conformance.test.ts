/**
 * `F4.intent-acceptance@1:unit-acceptance-v1` /
 * `conditional-save-units-v1` — the F.2 acceptance conformance (T3.P01.S05).
 *
 * These assert behavior the F.2 envelopes and the landed coordinator actually
 * produce: a compound candidate installs once with one undo payload, a refused
 * binding/staging/lock installs nothing, and the Save capture names the accepted
 * revision while its content identity ignores that revision. They use the
 * landed coordinator as the single install/history authority — the unit provider
 * supplies the adapter and preparation, not a second writer.
 */
import { describe, expect, it } from 'vitest';

import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	createEmptyWallFirstProject,
	validateProject,
	type AcceptedRevision,
	type AuthoringIntent,
	type SemanticReference
} from '@portfolio/project-model';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	STAGED_RESOURCES_INPUT,
	UNIT_ENVELOPE_SOURCE_KIND,
	UNIT_ENVELOPE_SOURCE_VERSION,
	UNIT_SAVE_SOURCE_KIND,
	captureUnitSave,
	computeEnvelopeSourceContentId,
	createUnitAcceptanceAdapter,
	createUnitAcceptanceProfile,
	normalizeUnitEnvelope,
	serializeProjectEnvelope,
	stageUnitResources,
	type ProjectEnvelope,
	type StagedUnitResource
} from '@portfolio/project-model/units';
import { createUnitReadContext } from '@portfolio/project-model/references/unit-resolution';

const REVISION: AcceptedRevision = { projectId: 'project-s05', revisionId: 'revision-1' };

async function envelope(): Promise<ProjectEnvelope> {
	const source = validateProject(createEmptyWallFirstProject({ id: REVISION.projectId, name: 'S05 project' }));
	if (!source.success) throw new Error('the envelope fixture source does not validate');
	// The baseline is normalized exactly as the adapter normalizes an installed
	// candidate, so the first change comparison is authored content, not derived
	// header identities.
	return normalizeUnitEnvelope({
		formatVersion: 1,
		id: REVISION.projectId,
		name: 'S05 project',
		acceptedRevision: REVISION,
		dependencyLock: { formatVersion: 1, entries: [] },
		units: {
			layout: {
				header: { domain: 'layout', unitId: 'unit-layout', formatVersion: source.project.layout.formatVersion, contentRevision: 'rev-layout' },
				data: source.project.layout
			},
			scene: {
				header: { domain: 'scene', unitId: 'unit-scene', formatVersion: SCENE_UNIT_FORMAT_VERSION, contentRevision: 'rev-scene' },
				data: {
					formatVersion: SCENE_UNIT_FORMAT_VERSION,
					textures: [],
					materials: [],
					entities: []
				}
			},
			camera: {
				header: { domain: 'camera', unitId: 'unit-camera', formatVersion: CAMERA_UNIT_FORMAT_VERSION, contentRevision: 'rev-camera' },
				data: {
					formatVersion: CAMERA_UNIT_FORMAT_VERSION,
					views: [
						{ id: 'view-entry', label: 'Entry', eye: [0, 1.6, 0], target: [0, 1.6, -1], fov: 60, connectedViewIds: [] }
					],
					connections: []
				}
			},
			experience: {
				header: { domain: 'experience', unitId: 'unit-experience', formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, contentRevision: 'rev-experience' },
				data: {
					formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
					experiences: [
						{
							id: 'experience-main',
							label: 'Main',
							entryGuideId: 'guide-main',
							presentations: [{ id: 'presentation-entry', label: 'Entry', viewId: 'view-entry' }],
							// The validator's admitted form states the default continuation explicitly;
					// a raw fixture that omits it would hash differently from the same
					// envelope after admission.
					stops: [
						{
							id: 'stop-entry',
							presentationId: 'presentation-entry',
							continuation: { kind: 'sequence-next' }
						}
					],
							guides: [{ id: 'guide-main', label: 'Guide', stopIds: ['stop-entry'], entryStopId: 'stop-entry' }],
							gates: [],
							detours: []
						}
					]
				}
			},
			resources: {
				header: { domain: 'resources', unitId: 'unit-resources', formatVersion: RESOURCE_UNIT_FORMAT_VERSION, contentRevision: 'rev-resources' },
				data: {
					formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
					resources: [{ kind: 'texture', id: 'paper', contentRevision: 'rev-paper', pin: null, unresolved: null }]
				}
			}
		}
	});
}

function experienceReference(source: ProjectEnvelope): SemanticReference {
	return {
		version: 1,
		domain: 'experience',
		revision: { kind: 'exact', contentRevision: source.units.experience.header.contentRevision },
		subject: { kind: 'experience', id: 'experience-main' },
		instancePath: ['experience-main'],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function viewReference(source: ProjectEnvelope): SemanticReference {
	return {
		version: 1,
		domain: 'camera',
		revision: { kind: 'exact', contentRevision: source.units.camera.header.contentRevision },
		subject: { kind: 'view', id: 'view-entry' },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function resourceReference(): SemanticReference {
	return {
		version: 1,
		domain: 'resource:texture',
		revision: { kind: 'exact', contentRevision: 'rev-paper' },
		subject: { kind: 'resource', id: 'paper' },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

/** The one profile both the registry and the adapter read; no second wiring flag. */
async function boot(source: ProjectEnvelope, options: { readonly compound: boolean; readonly resourceStaging?: boolean }) {
	const profile = createUnitAcceptanceProfile({
		compound: options.compound,
		resourceStaging: options.resourceStaging === true,
		sessionEpoch: 'session-s05'
	});
	const coordinator = createAcceptanceCoordinator<ProjectEnvelope>({
		adapter: profile.adapter,
		sessionEpoch: 'session-s05',
		baseline: {
			revision: source.acceptedRevision,
			source,
			canonicalJson: serializeProjectEnvelope(source),
			sourceContentId: await computeEnvelopeSourceContentId(source)
		},
		mintRevisionId: (ordinal) => `revision-${ordinal + 1}`,
		preparation: { registry: profile.registry, prepare: profile.prepare }
	});
	return coordinator;
}

function staged(resources: readonly StagedUnitResource[]): readonly StagedUnitResource[] {
	return resources.map((resource) => ({ ...resource }));
}

function compoundIntent(source: ProjectEnvelope, overrides: Partial<AuthoringIntent> = {}): AuthoringIntent {
	return {
		version: 1,
		kind: 'experience-presentation-stop-create',
		operationId: 'op-compound',
		expectedRevision: REVISION,
		targets: [experienceReference(source)],
		payload: {
			view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
			presentationLabel: 'New presentation',
			stop: { guideId: 'guide-main', afterStopId: 'stop-entry' }
		},
		capturedInputs: [],
		allocatedIds: [
			{ kind: 'view', id: 'view-new' },
			{ kind: 'presentation', id: 'presentation-new' },
			{ kind: 'stop', id: 'stop-new' }
		],
		...overrides
	};
}

describe('F.2 unit acceptance — one install, one history entry', () => {
	it('installs a compound View + Presentation + Stop once and undoes it as one operation', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true });
		const accepted = await coordinator.accept(compoundIntent(source));
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		expect(accepted.undoResult).toMatchObject({ kind: 'undoable', beforeRevision: REVISION });
		expect(coordinator.installs()).toBe(2);
		const installed = coordinator.acceptedSnapshot().domain.source;
		expect(installed.units.camera.data.views.map((view) => view.id)).toEqual(['view-entry', 'view-new']);
		expect(installed.units.experience.data.experiences[0]!.stops.map((stop) => stop.id)).toEqual(['stop-entry', 'stop-new']);
		expect(installed.units.experience.data.experiences[0]!.guides[0]!.stopIds).toEqual(['stop-entry', 'stop-new']);
		// Revision authority is the snapshot identity. The installed bytes keep the
		// baseline revision the candidate was prepared from, because the coordinator
		// installs source unchanged and history restoration is byte-exact; the Save
		// capture stamps the snapshot revision at the persistence boundary.
		expect(coordinator.acceptedRevision().revisionId).toBe('revision-2');
		expect(accepted.afterRevision.revisionId).toBe('revision-2');
		expect(installed.acceptedRevision).toEqual(REVISION);

		const undone = await coordinator.undo();
		expect(undone.kind).toBe('restored');
		expect(coordinator.acceptedSnapshot().domain.source.units.camera.data.views.map((view) => view.id)).toEqual(['view-entry']);
		const redone = await coordinator.redo();
		expect(redone.kind).toBe('restored');
		expect(coordinator.acceptedSnapshot().domain.source.units.experience.data.experiences[0]!.stops.map((stop) => stop.id)).toEqual(['stop-entry', 'stop-new']);
	});

	it('updates one Camera View without touching another domain', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: false });
		const accepted = await coordinator.accept({
			version: 1,
			kind: 'camera-view-update',
			operationId: 'op-view',
			expectedRevision: REVISION,
			targets: [viewReference(source)],
			payload: { label: 'Entry moved', eye: [0, 1.7, 0], target: [0, 1.7, -2], fov: 50 },
			capturedInputs: [],
			allocatedIds: []
		});
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		const installed = coordinator.acceptedSnapshot().domain.source;
		expect(installed.units.camera.data.views[0]).toMatchObject({ label: 'Entry moved', fov: 50 });
		expect(installed.units.experience.header.contentRevision).toBe(source.units.experience.header.contentRevision);
	});

	it('creates the Presentation without a Stop when no occurrence is requested', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true });
		const accepted = await coordinator.accept(
			compoundIntent(source, {
				payload: {
					view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
					presentationLabel: 'New presentation'
				},
				allocatedIds: [
					{ kind: 'view', id: 'view-new' },
					{ kind: 'presentation', id: 'presentation-new' }
				]
			})
		);
		expect(accepted.kind).toBe('accepted');
		const installed = coordinator.acceptedSnapshot().domain.source;
		expect(installed.units.experience.data.experiences[0]!.presentations.map((item) => item.id)).toEqual([
			'presentation-entry',
			'presentation-new'
		]);
		expect(installed.units.experience.data.experiences[0]!.stops.map((item) => item.id)).toEqual(['stop-entry']);
	});

	it('adds no history for an update that changes nothing', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: false });
		const result = await coordinator.accept({
			version: 1,
			kind: 'camera-view-update',
			operationId: 'op-view-noop',
			expectedRevision: REVISION,
			targets: [viewReference(source)],
			payload: { label: 'Entry', eye: [0, 1.6, 0], target: [0, 1.6, -1], fov: 60 },
			capturedInputs: [],
			allocatedIds: []
		});
		expect(result.kind).toBe('no-op');
		expect(coordinator.installs()).toBe(1);
		expect(coordinator.history().depth).toBe(1);
		expect(coordinator.canUndo()).toBe(false);
	});

	it('refuses an invalid binding and installs nothing', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true });
		const refused = await coordinator.accept(
			compoundIntent(source, {
				payload: {
					view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
					presentationLabel: 'New presentation',
					stop: { guideId: 'guide-absent' }
				}
			})
		);
		expect(refused.kind).toBe('rejected');
		expect(coordinator.installs()).toBe(1);
		expect(coordinator.canUndo()).toBe(false);
		expect(coordinator.acceptedSnapshot().domain.source).toEqual(source);
	});

	it('refuses a captured id that already names a subject', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true });
		const refused = await coordinator.accept(
			compoundIntent(source, {
				allocatedIds: [
					{ kind: 'view', id: 'view-entry' },
					{ kind: 'presentation', id: 'presentation-new' },
					{ kind: 'stop', id: 'stop-new' }
				]
			})
		);
		expect(refused).toMatchObject({ kind: 'rejected', reason: 'duplicate-identity' });
		expect(coordinator.installs()).toBe(1);
	});
});

describe('F.2 unit acceptance — staged resources and the dependency lock', () => {
	it('installs a staged resource revision and its lock entry in the same operation', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		const accepted = await coordinator.accept(
			compoundIntent(source, {
				targets: [experienceReference(source), resourceReference()],
				payload: {
					view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
					presentationLabel: 'New presentation',
					resource: { contentRevision: 'rev-paper-2' }
				},
				allocatedIds: [
					{ kind: 'view', id: 'view-new' },
					{ kind: 'presentation', id: 'presentation-new' }
				],
				capturedInputs: [
					{
						name: STAGED_RESOURCES_INPUT,
						value: staged([{ kind: 'texture', id: 'paper', contentRevision: 'rev-paper-2', pin: null }])
					}
				]
			})
		);
		expect(accepted.kind).toBe('accepted');
		const installed = coordinator.acceptedSnapshot().domain.source;
		expect(installed.units.resources.data.resources[0]).toMatchObject({ id: 'paper', contentRevision: 'rev-paper-2' });
		const lock = installed.dependencyLock.entries.find((entry) => entry.domain === 'resource:texture');
		expect(lock).toMatchObject({ subjectId: 'paper', contentRevision: 'rev-paper-2', pin: null });
		const undone = await coordinator.undo();
		expect(undone.kind).toBe('restored');
		const restored = coordinator.acceptedSnapshot().domain.source;
		expect(restored.units.resources.data.resources[0]).toMatchObject({ id: 'paper', contentRevision: 'rev-paper' });
		expect(restored.dependencyLock.entries.some((entry) => entry.domain === 'resource:texture')).toBe(false);
	});

	it('installs neither the resource nor the View when the operation fails later', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		const refused = await coordinator.accept(
			compoundIntent(source, {
				targets: [experienceReference(source), resourceReference()],
				payload: {
					view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
					presentationLabel: 'New presentation',
					stop: { guideId: 'guide-absent' },
					resource: { contentRevision: 'rev-paper-2' }
				},
				capturedInputs: [
					{
						name: STAGED_RESOURCES_INPUT,
						value: staged([{ kind: 'texture', id: 'paper', contentRevision: 'rev-paper-2', pin: null }])
					}
				]
			})
		);
		expect(refused.kind).toBe('rejected');
		expect(coordinator.installs()).toBe(1);
		expect(coordinator.canUndo()).toBe(false);
		expect(coordinator.acceptedSnapshot().domain.source).toEqual(source);
	});

	it('accepts a compound operation whose captured staging equals the staging derived from the candidate', async () => {
		const source = await envelope();
		const context = createUnitReadContext({ envelope: source, sourceContentId: await computeEnvelopeSourceContentId(source), sessionEpoch: 's' });
		const derived = stageUnitResources(source, [resourceReference()], context);
		expect(derived.kind).toBe('staged');
		if (derived.kind !== 'staged') return;
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		const accepted = await coordinator.accept(
			compoundIntent(source, {
				targets: [experienceReference(source), resourceReference()],
				capturedInputs: [
					{ name: STAGED_RESOURCES_INPUT, value: staged(derived.resources) }
				]
			})
		);
		expect(accepted.kind).toBe('accepted');
	});

	it('refuses a captured staging that names different bytes or revision', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		const refused = await coordinator.accept(
			compoundIntent(source, {
				targets: [experienceReference(source), resourceReference()],
				capturedInputs: [
					{
						name: STAGED_RESOURCES_INPUT,
						value: [{ kind: 'texture', id: 'paper', contentRevision: 'rev-other', pin: null }]
					}
				]
			})
		);
		expect(refused).toMatchObject({ kind: 'rejected', reason: 'invalid-staging' });
		expect(coordinator.installs()).toBe(1);
	});

	it('refuses a resource target without a captured staging set', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		const refused = await coordinator.accept(
			compoundIntent(source, { targets: [experienceReference(source), resourceReference()] })
		);
		expect(refused).toMatchObject({ kind: 'rejected', reason: 'missing-staging' });
	});

	it('refuses a dependency lock that names a subject the envelope does not carry', async () => {
		const source = await envelope();
		const locked: ProjectEnvelope = {
			...source,
			dependencyLock: {
				formatVersion: 1,
				entries: [
					{
						domain: 'camera',
						subjectKind: 'view',
						subjectId: 'view-absent',
						instancePath: [],
						contentRevision: source.units.camera.header.contentRevision,
						requiredCapabilities: [],
						pin: null
					}
				]
			}
		};
		const admission = await createUnitAcceptanceAdapter({ compound: true }).admit(locked, []);
		expect(admission.kind).toBe('rejected');
		if (admission.kind === 'rejected') {
			expect(admission.code).toBe('lock-closure');
			expect(admission.issues.some((entry) => entry.code === 'missing')).toBe(true);
		}
	});
});

describe('F.2 unit acceptance — derived identity and one admission profile', () => {
	const PIN = {
		hash: `sha256-${'a'.repeat(64)}`,
		mime: 'image/png',
		size: 32,
		locator: 'r2://paper.png'
	} as const;

	async function pinOnlyEnvelope(): Promise<ProjectEnvelope> {
		const base = await envelope();
		return normalizeUnitEnvelope({
			...base,
			units: {
				...base.units,
				resources: {
					header: { ...base.units.resources.header },
					data: {
						formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
						resources: [{ kind: 'texture', id: 'paper', contentRevision: null, pin: PIN, unresolved: null }]
					}
				}
			}
		});
	}

	function pinReference(): SemanticReference {
		return {
			version: 1,
			domain: 'resource:texture',
			revision: { kind: 'exact', contentRevision: PIN.hash },
			subject: { kind: 'resource', id: 'paper' },
			instancePath: [],
			location: { kind: 'project-root' },
			componentId: null,
			capabilityId: null
		};
	}

	it('re-derives a stale declared unit header instead of trusting it', async () => {
		const source = await envelope();
		const stale: ProjectEnvelope = {
			...source,
			units: {
				...source.units,
				camera: {
					header: { ...source.units.camera.header, contentRevision: 'rev-camera-declared-stale' },
					data: {
						...source.units.camera.data,
						views: source.units.camera.data.views.map((view) => ({ ...view, label: 'Moved' }))
					}
				}
			}
		};
		const admission = await createUnitAcceptanceAdapter({ compound: true }).admit(stale, []);
		expect(admission.kind).toBe('admitted');
		if (admission.kind !== 'admitted') return;
		// A revision is a derived fact: the declared header is recomputed from the
		// bytes that are actually installed, never carried through verbatim.
		expect(admission.source.units.camera.header.contentRevision).not.toBe('rev-camera-declared-stale');
		expect(admission.source.units.camera.data.views[0]!.label).toBe('Moved');
		expect(await computeEnvelopeSourceContentId(admission.source)).toBe(admission.sourceContentId);
	});

	it('stages a changed pin-only resource through the candidate registry and resolver', async () => {
		const source = await pinOnlyEnvelope();
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		const accepted = await coordinator.accept(
			compoundIntent(source, {
				targets: [experienceReference(source), pinReference()],
				payload: {
					view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
					presentationLabel: 'New presentation',
					resource: { pin: PIN }
				},
				allocatedIds: [
					{ kind: 'view', id: 'view-new' },
					{ kind: 'presentation', id: 'presentation-new' }
				],
				capturedInputs: [
					{
						name: STAGED_RESOURCES_INPUT,
						value: staged([{ kind: 'texture', id: 'paper', contentRevision: PIN.hash, pin: PIN }])
					}
				]
			})
		);
		expect(accepted.kind).toBe('accepted');
		const installed = coordinator.acceptedSnapshot().domain.source;
		expect(installed.units.resources.data.resources[0]).toMatchObject({ contentRevision: null, pin: PIN });
		const lock = installed.dependencyLock.entries.find((entry) => entry.domain === 'resource:texture');
		expect(lock).toMatchObject({ subjectId: 'paper', contentRevision: PIN.hash, pin: PIN });
	});

	it('refuses a captured pin whose size or locator differs from the candidate bytes', async () => {
		const source = await pinOnlyEnvelope();
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		const refused = await coordinator.accept(
			compoundIntent(source, {
				targets: [experienceReference(source), pinReference()],
				payload: {
					view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
					presentationLabel: 'New presentation',
					resource: { pin: PIN }
				},
				capturedInputs: [
					{
						name: STAGED_RESOURCES_INPUT,
						value: staged([{ kind: 'texture', id: 'paper', contentRevision: PIN.hash, pin: { ...PIN, size: 33 } }])
					}
				]
			})
		);
		expect(refused).toMatchObject({ kind: 'rejected', reason: 'invalid-staging' });
		expect(coordinator.installs()).toBe(1);
		expect(coordinator.acceptedSnapshot().domain.source).toEqual(source);
	});

	it('preserves an existing resource lock entry’s required capabilities', async () => {
		const base = await envelope();
		const capabilities = [{ id: 'cap.texture', version: '1' }];
		const source: ProjectEnvelope = {
			...base,
			dependencyLock: {
				formatVersion: 1,
				entries: [
					{
						domain: 'resource:texture',
						subjectKind: 'resource',
						subjectId: 'paper',
						instancePath: [],
						contentRevision: 'rev-paper',
						requiredCapabilities: capabilities,
						pin: null
					}
				]
			}
		};
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		const accepted = await coordinator.accept(
			compoundIntent(source, {
				targets: [experienceReference(source), resourceReference()],
				payload: {
					view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
					presentationLabel: 'New presentation',
					resource: { contentRevision: 'rev-paper-2' }
				},
				capturedInputs: [
					{
						name: STAGED_RESOURCES_INPUT,
						value: staged([{ kind: 'texture', id: 'paper', contentRevision: 'rev-paper-2', pin: null }])
					}
				]
			})
		);
		expect(accepted.kind).toBe('accepted');
		const lock = coordinator.acceptedSnapshot().domain.source.dependencyLock.entries;
		expect(lock).toHaveLength(1);
		expect(lock[0]).toMatchObject({ contentRevision: 'rev-paper-2', requiredCapabilities: capabilities });
	});

	it('refuses a resource-bearing intent under a profile that does not grant staging', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true });
		const refused = await coordinator.accept(
			compoundIntent(source, {
				targets: [experienceReference(source), resourceReference()],
				capturedInputs: [
					{
						name: STAGED_RESOURCES_INPUT,
						value: staged([{ kind: 'texture', id: 'paper', contentRevision: 'rev-paper-2', pin: null }])
					}
				]
			})
		);
		expect(refused.kind).toBe('rejected');
		expect(coordinator.installs()).toBe(1);
		expect(coordinator.acceptedSnapshot().domain.source).toEqual(source);
	});

	it('single-sources the admission profile for the registry and the adapter', () => {
		const staging = createUnitAcceptanceProfile({ compound: true, resourceStaging: true });
		expect(staging.registry.admission).toMatchObject({ compound: true, units: true, resources: true });
		expect(staging.adapter.sourceKind).toBe(UNIT_ENVELOPE_SOURCE_KIND);
		expect(staging.planners[1]!.admission.resources).toBe(true);
		const plain = createUnitAcceptanceProfile({ compound: true });
		expect(plain.registry.admission).toMatchObject({ compound: true, units: true, resources: false });
		expect(plain.planners[1]!.admission.resources).toBe(false);
	});
});

describe('F.2 unit Save capture', () => {
	it('captures the accepted revision while the content identity ignores it', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true });
		const accepted = await coordinator.accept(compoundIntent(source));
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		const captured = await captureUnitSave({
			snapshot: coordinator.acceptedSnapshot(),
			operationId: 'op-save',
			precondition: { kind: 'create-only' }
		});
		expect(captured.kind).toBe('captured');
		if (captured.kind !== 'captured') return;
		expect(captured.capture.sourceKind).toBe(UNIT_SAVE_SOURCE_KIND);
		expect(captured.capture.sourceVersion).toBe(UNIT_ENVELOPE_SOURCE_VERSION);
		expect(captured.capture.acceptedRevision).toEqual(accepted.afterRevision);
		const parsed = JSON.parse(captured.capture.canonicalJson) as ProjectEnvelope;
		expect(parsed.acceptedRevision).toEqual(accepted.afterRevision);
		// AM-2: the source digest excludes acceptedRevision.
		const sameContentOtherRevision = await computeEnvelopeSourceContentId({
			...parsed,
			acceptedRevision: { projectId: REVISION.projectId, revisionId: 'revision-other' }
		});
		expect(sameContentOtherRevision).toBe(captured.capture.sourceContentId);
		expect(captured.capture.sourceKind).toBe(UNIT_ENVELOPE_SOURCE_KIND);
	});
});
