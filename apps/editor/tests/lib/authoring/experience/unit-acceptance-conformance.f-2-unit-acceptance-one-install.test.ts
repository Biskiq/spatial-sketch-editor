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

	it('refuses the joint Experience/Camera operation when its candidate also writes Layout', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true });
		const joint = createCaptureBindPlanner();
		// The declared write set is what makes the joint operation legitimate.
		expect(joint.admission).toMatchObject({ domain: 'experience', compound: true, writes: ['camera'] });
		coordinator.register({
			...joint,
			id: 'unit.experience-capture-bind-with-layout-write',
			kind: 'experience-capture-bind-with-layout-write',
			prepare(request) {
				const outcome = joint.prepare(request);
				if (outcome.kind !== 'prepared') return outcome;
				const candidateLayout = outcome.candidate.source.units.layout.data;
				const capture = freshCapture();
				const plan = planCommitLayoutObjectPreset(
					candidateLayout,
					'plinth',
					[0, 0],
					0,
					nextLayoutPresetObjectId(candidateLayout, capture),
					candidateLayout.floor.id
				);
				if (plan.kind !== 'success') throw new Error(`the Layout write fixture was refused: ${plan.kind}`);
				return {
					kind: 'prepared',
					candidate: {
						...outcome.candidate,
						source: replaceUnitData(outcome.candidate.source, 'layout', plan.document),
						changes: [
							...outcome.candidate.changes,
							{ kind: 'layout-object-preset', subjectIds: [plan.createdObjectId ?? ''], fields: ['objects'] }
						]
					}
				};
			}
		});
		const refused = await coordinator.accept(
			compoundIntent(source, { kind: 'experience-capture-bind-with-layout-write' })
		);
		expect(refused).toMatchObject({ kind: 'rejected', code: 'admission-refused', reason: 'unsupported-change' });
		if (refused.kind !== 'rejected') return;
		expect(refused.diagnostics.some((entry) => entry.code === 'out-of-scope-domain')).toBe(true);
		// One atomic result or nothing: the Camera, Experience and Layout change is
		// not partially installed and leaves no history entry.
		expect(coordinator.acceptedSnapshot().domain.source).toEqual(source);
		expect(coordinator.installs()).toBe(1);
		expect(coordinator.canUndo()).toBe(false);
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
					presentation: { label: 'New presentation', subject: null, text: null }
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
					presentation: { label: 'New presentation', subject: null, text: null },
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
