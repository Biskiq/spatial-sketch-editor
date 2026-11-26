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

describe('F.1 accepted-read identity over an accepted unit source', () => {
	function viewIntent(source: ProjectEnvelope, revision: AcceptedRevision, operationId: string): AuthoringIntent {
		return {
			version: 1,
			kind: 'camera-view-update',
			operationId,
			expectedRevision: revision,
			targets: [viewReference(source)],
			payload: { label: `Entry ${operationId}`, eye: [0, 1.6, 0], target: [0, 1.6, -1], fov: 60 },
			capturedInputs: [],
			allocatedIds: []
		};
	}

	it('names the accepted revision, not the envelope baseline, across accept, undo and redo', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true });
		const profile = createUnitAcceptanceProfile({ compound: true, sessionEpoch: 'session-s05' });
		const first = await coordinator.accept(compoundIntent(source));
		expect(first.kind).toBe('accepted');

		const acceptedSnapshot = coordinator.acceptedSnapshot();
		const context = createUnitReadContext({
			envelope: acceptedSnapshot.domain.source,
			acceptedRevision: acceptedSnapshot.acceptedRevision,
			sourceContentId: acceptedSnapshot.sourceContentId,
			sessionEpoch: 'session-s05'
		});
		// The envelope keeps the baseline revision for byte-exact restoration; the
		// read context names the snapshot that is actually accepted.
		expect(context.snapshot.acceptedRevision).toEqual(acceptedSnapshot.acceptedRevision);
		expect(context.snapshot.acceptedRevision.revisionId).not.toBe(
			acceptedSnapshot.domain.source.acceptedRevision.revisionId
		);
		expect(context.snapshot.sourceContentId).toBe(acceptedSnapshot.sourceContentId);
		expect(resolveReference(viewReference(acceptedSnapshot.domain.source), context).kind).toBe('resolved');
		expect(
			profile.prepare(
				acceptedSnapshot,
				viewIntent(acceptedSnapshot.domain.source, acceptedSnapshot.acceptedRevision, 'op-second')
			).kind
		).toBe('prepared');

		const second = await coordinator.accept(
			viewIntent(acceptedSnapshot.domain.source, acceptedSnapshot.acceptedRevision, 'op-second')
		);
		expect(second.kind).toBe('accepted');

		// Undo mints a fresh revision over the baseline bytes; preparation must name
		// that fresh identity, not the revision the bytes were installed under.
		const undone = await coordinator.undo();
		expect(undone.kind).toBe('restored');
		const afterUndo = coordinator.acceptedSnapshot();
		expect(afterUndo.acceptedRevision).not.toEqual(acceptedSnapshot.acceptedRevision);
		expect(
			profile.prepare(afterUndo, viewIntent(afterUndo.domain.source, afterUndo.acceptedRevision, 'op-undo')).kind
		).toBe('prepared');

		const redone = await coordinator.redo();
		expect(redone.kind).toBe('restored');
		const afterRedo = coordinator.acceptedSnapshot();
		expect(
			profile.prepare(afterRedo, viewIntent(afterRedo.domain.source, afterRedo.acceptedRevision, 'op-redo')).kind
		).toBe('prepared');
	});

	it('refuses a read context whose accepted project is not the envelope project', async () => {
		const source = await envelope();
		const context = createUnitReadContext({
			envelope: source,
			acceptedRevision: { projectId: 'project-other', revisionId: 'revision-1' },
			sourceContentId: 'digest-other',
			sessionEpoch: 'session-s05'
		});
		const resolution = resolveReference(viewReference(source), context);
		expect(resolution.kind).toBe('failed');
		if (resolution.kind === 'failed') expect(resolution.message).toContain('same accepted project');
	});

	it('stages a second resource revision from the accepted snapshot it was pinned to', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true, resourceStaging: true });
		const first = await coordinator.accept(
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
		expect(first.kind).toBe('accepted');
		const afterFirst = coordinator.acceptedSnapshot();
		const acceptedSource = afterFirst.domain.source;
		const pinned = {
			...resourceReference(),
			revision: { kind: 'exact' as const, contentRevision: 'rev-paper-2' }
		};
		const second = await coordinator.accept(
			compoundIntent(afterFirst.domain.source, {
				expectedRevision: afterFirst.acceptedRevision,
				targets: [experienceReference(acceptedSource), pinned],
				payload: {
					view: { label: 'Second view', eye: [2, 1.6, 0], target: [2, 1.6, -1], fov: 50 },
					presentation: { label: 'Second presentation', subject: null, text: null },
					resource: { contentRevision: 'rev-paper-3' }
				},
				allocatedIds: [
					{ kind: 'view', id: 'view-second' },
					{ kind: 'presentation', id: 'presentation-second' }
				],
				capturedInputs: [
					{
						name: STAGED_RESOURCES_INPUT,
						value: staged([{ kind: 'texture', id: 'paper', contentRevision: 'rev-paper-3', pin: null }])
					}
				]
			})
		);
		expect(second.kind).toBe('accepted');
		const installed = coordinator.acceptedSnapshot().domain.source;
		expect(installed.units.resources.data.resources[0]).toMatchObject({ id: 'paper', contentRevision: 'rev-paper-3' });
	});
});
