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

describe('the structure and removal planners in the one admission profile', () => {
	const S26 = {
		'experience-update': null,
		'experience-guide-update': null,
		'experience-stop-remove': ['camera'],
		'experience-guide-remove': ['camera'],
		'experience-presentation-view-remove': ['camera'],
		'experience-presentation-remove': ['camera']
	} as const;

	it('registers each S26 operation once, in the Experience domain, compound only where it may delete Camera truth', () => {
		const profile = createUnitAcceptanceProfile({ compound: true });
		for (const [kind, writes] of Object.entries(S26)) {
			const matching = profile.planners.filter((planner) => planner.kind === kind);
			expect(matching, kind).toHaveLength(1);
			const admission = matching[0]!.admission;
			expect(admission.domain).toBe('experience');
			expect(admission.units).toBe(true);
			expect(admission.resources).toBe(false);
			if (writes === null) {
				expect(admission.compound, kind).toBe(false);
				expect(admission.writes, kind).toBeUndefined();
			} else {
				expect(admission.compound, kind).toBe(true);
				expect(admission.writes, kind).toEqual(writes);
			}
		}
	});

	it('installs a single-domain removal with only the Experience unit changed', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true });
		const outcome = await coordinator.accept({
			version: 1,
			kind: 'experience-guide-remove',
			operationId: 'op-s26-guide-remove',
			expectedRevision: coordinator.acceptedRevision(),
			targets: [
				{
					version: 1,
					domain: 'experience',
					revision: { kind: 'exact', contentRevision: source.units.experience.header.contentRevision },
					subject: { kind: 'guide', id: 'guide-main' },
					instancePath: ['experience-main'],
					location: { kind: 'project-root' },
					componentId: null,
					capabilityId: null
				}
			],
			payload: {},
			capturedInputs: [],
			allocatedIds: []
		});
		expect(outcome.kind).toBe('accepted');
		const installed = coordinator.acceptedSnapshot().domain.source;
		for (const domain of ['layout', 'scene', 'camera', 'resources'] as const) {
			expect(installed.units[domain].header.contentRevision, domain).toBe(source.units[domain].header.contentRevision);
		}
		expect(installed.units.experience.header.contentRevision).not.toBe(source.units.experience.header.contentRevision);
		expect(coordinator.history().depth).toBe(2);
	});
});
