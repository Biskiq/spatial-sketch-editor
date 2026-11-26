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

import { experienceUpdateIntent, presentationUpdateIntent, stopUpdateIntent } from '$lib/authoring/experience/commands-structure';
import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import { createEmptyWallFirstLayoutDocument, planCommitLayoutObjectPreset } from '@portfolio/layout-core/wall';
import { nextLayoutPresetObjectId } from '@portfolio/layout-core/plan';
import { freshCapture } from '../../layout/__fixtures__/layout-id-capture';
import { resolveReference, type AcceptedRevision, type SemanticReference } from '@portfolio/project-model/references';
import type { AuthoringIntent } from '@portfolio/project-model/f4';
import type { SceneSurfaceFinish } from '@portfolio/project-model/scene';
import { CAMERA_UNIT_FORMAT_VERSION, EXPERIENCE_UNIT_FORMAT_VERSION, RESOURCE_UNIT_FORMAT_VERSION, SCENE_UNIT_FORMAT_VERSION, UNIT_ENVELOPE_SOURCE_KIND, UNIT_ENVELOPE_SOURCE_VERSION, UNIT_SAVE_SOURCE_KIND, captureUnitSave, computeEnvelopeSourceContentId, createUnitAcceptanceAdapter, normalizeUnitEnvelope, replaceUnitData, serializeProjectEnvelope, stageUnitResources, type ProjectEnvelope, type StagedUnitResource } from '@portfolio/project-model/units';
import { STAGED_RESOURCES_INPUT, createCaptureBindPlanner, createUnitAcceptanceProfile } from '@portfolio/project-model/units/planning';
import { createUnitReadContext } from '@portfolio/project-model/references/unit-resolution';

const REVISION: AcceptedRevision = { projectId: 'project-s05', revisionId: 'revision-1' };

async function envelope(): Promise<ProjectEnvelope> {
	const layout = createEmptyWallFirstLayoutDocument();
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
				header: { domain: 'layout', unitId: 'unit-layout', formatVersion: layout.formatVersion, contentRevision: 'rev-layout' },
				data: layout
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
							welcome: null,
							entryGuideId: 'guide-main',
							presentations: [
							{
								id: 'presentation-entry',
								label: 'Entry',
								views: [{ viewId: 'view-entry' }],
								explorable: true,
								subject: null,
								text: null
							}
						],
							// The validator's admitted form states the default continuation explicitly;
					// a raw fixture that omits it would hash differently from the same
					// envelope after admission.
					stops: [
						{
							id: 'stop-entry',
							entryViewId: null, staySeconds: 5, invitation: null,
							presentationId: 'presentation-entry',
							transition: 'cut'
						}
					],
							guides: [{ id: 'guide-main', label: 'Guide', stopIds: ['stop-entry'], pacing: 'automatic' as const }],
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
		kind: 'experience-capture-bind',
		operationId: 'op-compound',
		expectedRevision: REVISION,
		targets: [experienceReference(source)],
		payload: {
			view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
			presentation: { label: 'New presentation', subject: null, text: null },
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

describe('F.2 unit acceptance — staged resources and the dependency lock', () => {
	it('installs a staged resource revision and its lock entry in the same operation', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		const accepted = await coordinator.accept(
			compoundIntent(source, {
				targets: [experienceReference(source), resourceReference()],
				payload: {
					view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
					presentation: { label: 'New presentation', subject: null, text: null },
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
					presentation: { label: 'New presentation', subject: null, text: null },
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
