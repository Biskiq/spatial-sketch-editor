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
import { freshCapture } from '../../../../../../packages/layout-core/tests/__fixtures__/layout-id-capture';
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

	it('stages a changed pin-only resource from the accepted snapshot and the authored identity', async () => {
		const source = await pinOnlyEnvelope();
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		const accepted = await coordinator.accept(
			compoundIntent(source, {
				targets: [experienceReference(source), pinReference()],
				payload: {
					view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
					presentation: { label: 'New presentation', subject: null, text: null },
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
					presentation: { label: 'New presentation', subject: null, text: null },
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

	it('refuses a structurally malformed pin before any install', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		// Negative size is not a pin shape the strict reader admits; it is distinct
		// from the well-formed pin whose bytes disagree with the capture.
		const malformed = { hash: PIN.hash, mime: 'image/png', size: -1, locator: 'r2://paper.png' };
		const refused = await coordinator.accept(
			compoundIntent(source, {
				targets: [experienceReference(source), resourceReference()],
				payload: {
					view: { label: 'New view', eye: [1, 1.6, 0], target: [1, 1.6, -1], fov: 55 },
					presentation: { label: 'New presentation', subject: null, text: null },
					resource: { contentRevision: 'rev-paper-2', pin: malformed }
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
		expect(coordinator.acceptedSnapshot().domain.source).toEqual(source);
	});

	it('refuses a candidate that rewrites the baseline accepted revision', async () => {
		const source = await envelope();
		const adapter = createUnitAcceptanceAdapter({ compound: true });
		const forged: ProjectEnvelope = {
			...source,
			acceptedRevision: { ...source.acceptedRevision, revisionId: 'revision-forged' }
		};
		const issues =
			adapter.validateChange?.(source, forged, {
				domain: 'experience',
				compound: true,
				writes: ['camera'],
				units: true,
				resources: false
			}) ?? [];
		expect(issues.some((entry) => entry.code === 'baseline-revision-mismatch')).toBe(true);
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
					presentation: { label: 'New presentation', subject: null, text: null },
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
		expect(staging.planners.find((planner) => planner.kind === 'experience-capture-bind')!.admission.resources).toBe(true);
		const plain = createUnitAcceptanceProfile({ compound: true });
		expect(plain.registry.admission).toMatchObject({ compound: true, units: true, resources: false });
		expect(plain.planners.find((planner) => planner.kind === 'experience-capture-bind')!.admission.resources).toBe(false);
	});
});
