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

describe('F.2 unit acceptance — authored envelope metadata is not planner-writable', () => {
	function unitLockEntry(
		source: ProjectEnvelope,
		domain: 'layout' | 'camera',
		subjectKind: string,
		subjectId: string
	): ProjectEnvelope['dependencyLock']['entries'][number] {
		return {
			domain,
			subjectKind,
			subjectId,
			instancePath: [],
			contentRevision: source.units[domain].header.contentRevision,
			requiredCapabilities: [],
			pin: null
		};
	}

	it('refuses a unitId-only rewrite even though no payload revision moves', async () => {
		const source = await envelope();
		const candidate: ProjectEnvelope = {
			...source,
			units: {
				...source.units,
				layout: {
					...source.units.layout,
					header: { ...source.units.layout.header, unitId: 'unit-layout-forged' }
				}
			}
		};
		const issues = createUnitAcceptanceAdapter({ compound: true }).validateChange?.(source, candidate, {
			domain: 'experience',
			compound: true,
			writes: ['camera'],
			units: true,
			resources: false
		}) ?? [];
		expect(issues).toContainEqual(
			expect.objectContaining({ path: '$.units.layout.header.unitId', code: 'unit-header-mismatch' })
		);
	});

	it('refuses a formatVersion-only header rewrite', async () => {
		const source = await envelope();
		const candidate: ProjectEnvelope = {
			...source,
			units: {
				...source.units,
				layout: {
					...source.units.layout,
					header: { ...source.units.layout.header, formatVersion: source.units.layout.header.formatVersion + 1 }
				}
			}
		};
		const issues = createUnitAcceptanceAdapter({ compound: true }).validateChange?.(source, candidate, {
			domain: 'layout',
			compound: false,
			units: true,
			resources: false
		}) ?? [];
		expect(issues).toContainEqual(
			expect.objectContaining({ path: '$.units.layout.header.formatVersion', code: 'unit-header-mismatch' })
		);
	});

	it('refuses a resolvable unit-scoped lock entry with uncatalogued capabilities', async () => {
		const source = await envelope();
		const adapter = createUnitAcceptanceAdapter({ compound: true });
		const candidate: ProjectEnvelope = {
			...source,
			dependencyLock: {
				formatVersion: 1,
				entries: [
					...source.dependencyLock.entries,
					{
						...unitLockEntry(source, 'layout', 'level', source.units.layout.data.floor.id),
						requiredCapabilities: [{ id: 't1.test:uncatalogued', version: '1' }]
					}
				]
			}
		};
		const admitted = await adapter.admit(candidate, []);
		expect(admitted.kind).toBe('admitted');
		if (admitted.kind !== 'admitted') return;
		const issues = adapter.validateChange?.(source, admitted.source, {
			domain: 'layout',
			compound: false,
			units: true,
			resources: false
		}) ?? [];
		expect(issues).toContainEqual(
			expect.objectContaining({ path: '$.dependencyLock.entries', code: 'lock-metadata-mismatch' })
		);
	});

	it('refuses unit lock capability, pin and order rewrites', async () => {
		const base = await envelope();
		const first = unitLockEntry(base, 'layout', 'level', base.units.layout.data.floor.id);
		const second = unitLockEntry(base, 'camera', 'view', 'view-entry');
		const source: ProjectEnvelope = {
			...base,
			dependencyLock: { formatVersion: 1, entries: [first, second] }
		};
		const adapter = createUnitAcceptanceAdapter({ compound: true });
		const admission = { domain: 'layout' as const, compound: false, units: true, resources: false };
		const cases: readonly ProjectEnvelope[] = [
			{
				...source,
				dependencyLock: {
					formatVersion: 1,
					entries: [{ ...first, requiredCapabilities: [{ id: 't1.test:other', version: '1' }] }, second]
				}
			},
			{
				...source,
				dependencyLock: {
					formatVersion: 1,
					entries: [
						{ ...first, pin: { hash: `sha256-${'b'.repeat(64)}`, mime: 'image/png', size: 8, locator: 'r2://forged.png' } },
						second
					]
				}
			},
			{ ...source, dependencyLock: { formatVersion: 1, entries: [second, first] } }
		];
		for (const candidate of cases) {
			const issues = adapter.validateChange?.(source, candidate, admission) ?? [];
			expect(issues.some((entry) => entry.code === 'lock-metadata-mismatch')).toBe(true);
		}
	});

	it('accepts a legitimate Layout change and re-derives its unit lock revision', async () => {
		const base = await envelope();
		const entry = unitLockEntry(base, 'layout', 'level', base.units.layout.data.floor.id);
		const source: ProjectEnvelope = {
			...base,
			dependencyLock: { formatVersion: 1, entries: [entry] }
		};
		const candidate = replaceUnitData(source, 'layout', {
			...source.units.layout.data,
			floor: { ...source.units.layout.data.floor, elevation: source.units.layout.data.floor.elevation + 0.1 }
		});
		const normalized = await normalizeUnitEnvelope(candidate);
		expect(normalized.dependencyLock.entries[0]!.contentRevision).not.toBe(entry.contentRevision);
		const issues = createUnitAcceptanceAdapter({ compound: true }).validateChange?.(source, normalized, {
			domain: 'layout',
			compound: false,
			units: true,
			resources: false
		}) ?? [];
		expect(issues.filter((issue) => issue.code === 'lock-metadata-mismatch')).toEqual([]);
	});

	it('refuses a newly orphaned surface identity even when the same candidate removes an old orphan', async () => {
		const base = await envelope();
		const layout = createEmptyWallFirstLayoutDocument();
		layout.junctions = [
			{ id: 'j-live-a', point: [0, 0] },
			{ id: 'j-live-b', point: [4, 0] }
		];
		layout.walls = [{
			id: 'wall-live', startJunctionId: 'j-live-a', endJunctionId: 'j-live-b',
			thickness: 0.2, height: 3,
			top: { kind: 'level' }, centerline: { kind: 'line' }
		}];
		const withLayout = await normalizeUnitEnvelope(replaceUnitData(base, 'layout', layout));
		const oldOrphan: SceneSurfaceFinish = {
			surface: { kind: 'wall-side' as const, wallId: 'old-orphan', side: 'left' as const },
			finish: { materialId: 'velvet-dark' as const }
		};
		const liveAssignment: SceneSurfaceFinish = {
			surface: { kind: 'wall-side' as const, wallId: 'wall-live', side: 'right' as const },
			finish: { materialId: 'marble-light' as const }
		};
		const source = await normalizeUnitEnvelope(replaceUnitData(withLayout, 'scene', {
			...withLayout.units.scene.data,
			surfaceFinishes: [oldOrphan, liveAssignment]
		}));
		const adapter = createUnitAcceptanceAdapter({ compound: true });
		const baselineAdmission = await adapter.admit(source, []);
		expect(baselineAdmission.kind).toBe('admitted');
		if (baselineAdmission.kind !== 'admitted') return;

		const afterLayout = { ...source.units.layout.data, junctions: [], walls: [] };
		const candidate = await normalizeUnitEnvelope(replaceUnitData(
			replaceUnitData(baselineAdmission.source, 'layout', afterLayout),
			'scene',
			{ ...baselineAdmission.source.units.scene.data, surfaceFinishes: [liveAssignment] }
		));
		const issues = adapter.validateChange?.(baselineAdmission.source, candidate, {
			domain: 'layout', compound: true, writes: ['scene'], units: true, resources: false
		}) ?? [];
		expect(issues).toContainEqual(expect.objectContaining({
			path: '$.units.scene.data.surfaceFinishes',
			code: 'surface-reference-orphaned'
		}));
	});

	it('refuses a metadata-writing planner without installing or recording history', async () => {
		const source = await envelope();
		const coordinator = await boot(source, { compound: true });
		const base = createCaptureBindPlanner();
		const registration = coordinator.register({
			...base,
			id: 'conformance.capture-bind-with-header-write',
			kind: 'conformance-capture-bind-with-header-write',
			prepare(request) {
				const outcome = base.prepare(request);
				if (outcome.kind !== 'prepared') return outcome;
				const planned = outcome.candidate.source;
				return {
					...outcome,
					candidate: {
						...outcome.candidate,
						source: {
							...planned,
							units: {
								...planned.units,
								layout: {
									...planned.units.layout,
									header: { ...planned.units.layout.header, unitId: 'unit-layout-forged' }
								}
							}
						}
					}
				};
			}
		});
		expect(registration.kind).toBe('registered');
		const refused = await coordinator.accept(
			compoundIntent(source, { kind: 'conformance-capture-bind-with-header-write' })
		);
		expect(refused).toMatchObject({ kind: 'rejected', code: 'admission-refused', reason: 'unsupported-change' });
		if (refused.kind !== 'rejected') return;
		expect(refused.diagnostics.some((entry) => entry.code === 'unit-header-mismatch')).toBe(true);
		expect(coordinator.acceptedSnapshot().domain.source).toEqual(source);
		expect(coordinator.acceptedRevision()).toEqual(REVISION);
		expect(coordinator.installs()).toBe(1);
		expect(coordinator.canUndo()).toBe(false);
	});
});
