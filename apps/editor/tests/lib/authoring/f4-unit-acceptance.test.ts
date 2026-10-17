/**
 * `F4.intent-acceptance@1:unit-acceptance-v1` — the additive unit admission
 * (T3.P01.S03), against the landed enduring lifecycle and the landed F.1/F.2
 * readers.
 *
 * Two contracts are separated the way `tests/README.md` rule 18 asks:
 *
 * - the **lifecycle** contract: a unit/compound planner installs through the
 *   same one-install/one-undo coordinator, while the landed single-domain
 *   registry still refuses it. Faking this with a bespoke registry would prove
 *   nothing, so the coordinator's own `preparation` seam is the subject.
 * - the **admission** contract: targets resolve against one supplied envelope and
 *   its lock before planning, and resources stage as a duplicate-free set or not
 *   at all.
 */
import { describe, expect, it } from 'vitest';

import { createAcceptanceCoordinator } from '$lib/authoring/f4/acceptance-coordinator';
import {
	createEmptyWallFirstProject,
	createPlannerRegistry,
	validateProject,
	type AcceptanceSourceAdapter,
	type AcceptedRevision,
	type AcceptedSnapshot,
	type AuthoringIntent,
	type DomainPlanner,
	type PlannerRegistry
} from '@portfolio/project-model';
import {
	createUnitPlannerRegistry,
	prepareUnitIntent,
	validateUnitTargets
} from '@portfolio/project-model/f4/unit-acceptance';
import type { ReferenceReadContext, SemanticReference } from '@portfolio/project-model';
import { createUnitReadContext } from '@portfolio/project-model/references/unit-resolution';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	createProjectEnvelope,
	// Staging is the F.2-dependent half of the capability, so it lives behind the
	// inactive `./units` subpath (the architecture gate keeps `f4/**` free of it
	// until T3.P01.S04). A test may cross that boundary; editor sources may not.
	stageUnitResources,
	type ProjectEnvelope,
	type TypedResource
} from '@portfolio/project-model/units';

const REVISION: AcceptedRevision = { projectId: 'project-unit', revisionId: 'revision-1' };

type Source = { readonly value: number };

const adapter: AcceptanceSourceAdapter<Source> = {
	sourceKind: 'unit-conformance-source',
	sourceVersion: 1,
	async admit(input) {
		const source = input as Source;
		if (!Number.isFinite(source.value)) {
			return { kind: 'rejected', code: 'invalid-value', message: 'value must be finite', issues: [] };
		}
		return {
			kind: 'admitted',
			source,
			canonicalJson: JSON.stringify(source),
			sourceContentId: `digest-${source.value}`,
			blockingIssues: []
		};
	}
};

function cameraViewPlanner(kind = 'camera-view', id = kind): DomainPlanner<Source> {
	return {
		id,
		kind,
		sourceKinds: [adapter.sourceKind],
		sourceVersions: [1],
		admission: { domain: 'camera', compound: true, units: true, resources: false },
		prepare({ snapshot, intent }) {
			return {
				kind: 'prepared',
				candidate: {
					operationId: intent.operationId,
					sourceKind: snapshot.sourceKind,
					sourceVersion: snapshot.sourceVersion,
					source: { value: intent.payload as number },
					changes: [],
					correspondence: [],
					diagnostics: []
				}
			};
		}
	};
}

function boot(options: {
	readonly registry: PlannerRegistry<Source>;
	readonly inspectTargets?: (intent: AuthoringIntent, snapshot: AcceptedSnapshot<Source>) => readonly { path: string; code: string; message: string }[];
}) {
	return createAcceptanceCoordinator<Source>({
		adapter,
		sessionEpoch: 'session-unit',
		baseline: { revision: REVISION, source: { value: 0 }, canonicalJson: '{"value":0}', sourceContentId: 'digest-0' },
		mintRevisionId: (ordinal) => `revision-${ordinal + 1}`,
		preparation: {
			registry: options.registry,
			prepare(snapshot, intent) {
				return prepareUnitIntent(options.registry, snapshot, intent, intent.capturedInputs, {}, {
					inspectTargets: options.inspectTargets
				});
			}
		}
	});
}

function intent(operationId: string, revision: AcceptedRevision, value: number): AuthoringIntent {
	return {
		version: 1,
		kind: 'camera-view',
		operationId,
		expectedRevision: revision,
		targets: [],
		payload: value,
		capturedInputs: [],
		allocatedIds: []
	};
}

/** The snapshot a direct dispatch test plans against (no coordinator involved). */
function snapshot(): AcceptedSnapshot<Source> {
	return {
		acceptedRevision: REVISION,
		sourceContentId: 'digest-0',
		sourceKind: adapter.sourceKind,
		sourceVersion: 1,
		domain: {
			identity: { acceptedRevision: REVISION, sourceContentId: 'digest-0' },
			source: { value: 0 }
		}
	};
}

async function sourceEnvelope(): Promise<ProjectEnvelope> {
	const source = validateProject(createEmptyWallFirstProject({ id: 'project-unit', name: 'Project unit' }));
	if (!source.success) throw new Error('the envelope fixture source does not validate');
	return createProjectEnvelope({
		id: 'project-unit',
		name: 'Project unit',
		acceptedRevision: REVISION,
		dependencyLock: { formatVersion: 1, entries: [] },
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
			data: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [
					{ id: 'view-entry', label: 'Entry', eye: [0, 1.6, 0], target: [0, 1.6, -1], fov: 60, connectedViewIds: [] }
				],
				connections: []
			}
		},
		experience: {
			unitId: 'unit-experience',
			data: { formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION, experiences: [] }
		},
		resources: {
			unitId: 'unit-resources',
			data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [] }
		}
	});
}

function cameraReference(contentRevision: string, id = 'view-entry'): SemanticReference {
	return {
		version: 1,
		domain: 'camera',
		revision: { kind: 'exact', contentRevision },
		subject: { kind: 'view', id },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function resourceReference(contentRevision: string, kind: string, id: string): SemanticReference {
	return {
		version: 1,
		domain: `resource:${kind}`,
		revision: { kind: 'exact', contentRevision },
		subject: { kind: 'resource', id },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

describe('F.4 unit acceptance — the enduring lifecycle with a wider admission', () => {
	it('installs one compound/unit result through the same coordinator and history', async () => {
		const registry = createUnitPlannerRegistry<Source>();
		expect(registry.register(cameraViewPlanner())).toEqual({ kind: 'registered' });
		const coordinator = boot({ registry });

		const accepted = await coordinator.accept(intent('op-unit', REVISION, 1));
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		expect(accepted.undoResult).toMatchObject({ kind: 'undoable', beforeRevision: REVISION });
		expect(coordinator.installs()).toBe(2);

		const restored = await coordinator.undo();
		expect(restored.kind).toBe('restored');
		expect(coordinator.acceptedSnapshot().domain.source).toEqual({ value: 0 });
	});

	it('still refuses a unit planner registered through the landed single-domain registry', () => {
		const coordinator = boot({ registry: createPlannerRegistry<Source>() });
		// The landed registry's domain gate runs first (`local-single-domain-v1` admits
		// Layout and Scene only), so a Camera unit planner is refused there rather than at
		// the unit gate. Either way the registration is refused and nothing mounts.
		expect(coordinator.register(cameraViewPlanner('landed-unit'))).toMatchObject({
			kind: 'refused',
			reason: 'unsupported-domain'
		});
		expect(coordinator.planners()).toHaveLength(0);
	});

	it('refuses a duplicate operation kind and a resource planner it was not configured for', () => {
		const registry = createUnitPlannerRegistry<Source>();
		expect(registry.register(cameraViewPlanner())).toEqual({ kind: 'registered' });
		expect(registry.register(cameraViewPlanner('camera-view', 'second-camera-view'))).toMatchObject({
			kind: 'refused',
			reason: 'duplicate-kind'
		});
		const resourcePlanner: DomainPlanner<Source> = {
			...cameraViewPlanner('resource-stage'),
			admission: { domain: 'layout', compound: false, units: false, resources: true }
		};
		expect(registry.register(resourcePlanner)).toMatchObject({ kind: 'refused', reason: 'resource-admission' });
		const stagingRegistry = createUnitPlannerRegistry<Source>({ resourceStaging: true });
		expect(stagingRegistry.register(resourcePlanner)).toEqual({ kind: 'registered' });
	});

	it('grants at dispatch exactly what the one registry admitted', () => {
		// Registration and dispatch read the same profile, so a planner that mounted
		// cannot then be refused for the need it was admitted with.
		expect(createUnitPlannerRegistry<Source>().admission!).toMatchObject({
			compound: true,
			units: true,
			resources: false
		});
		expect(createUnitPlannerRegistry<Source>({ resourceStaging: true }).admission!).toMatchObject({
			compound: true,
			units: true,
			resources: true
		});
		// The landed registry declares no profile at all: that absence is what keeps
		// `prepareIntent` on the landed `local-single-domain-v1` branch.
		expect(createPlannerRegistry<Source>().admission).toBeUndefined();
	});

	it('keeps the landed dispatch refusal messages for a registry with no profile', () => {
		// Pinned text, not merely the refusal code: an always-present profile made the
		// landed path silently emit the widened wording once before.
		const compoundIntent: AuthoringIntent = {
			...intent('op-landed-compound', REVISION, 1),
			targets: [
				cameraReference('rev-camera'),
				{ ...cameraReference('rev-layout'), domain: 'layout', subject: { kind: 'wall', id: 'wall-1' } }
			]
		};
		const compound = prepareUnitIntent(createPlannerRegistry<Source>(), snapshot(), compoundIntent);
		expect(compound).toMatchObject({ kind: 'refused', code: 'unsupported-compound', reason: null });
		if (compound.kind === 'refused') {
			expect(compound.message).toContain('one accepted operation addresses one domain');
			expect(compound.message).not.toContain('admission profile');
		}

		const resourceIntent: AuthoringIntent = {
			...intent('op-landed-resource', REVISION, 1),
			targets: [resourceReference('rev-paper', 'texture', 'paper')]
		};
		const resource = prepareUnitIntent(createPlannerRegistry<Source>(), snapshot(), resourceIntent);
		expect(resource).toMatchObject({ kind: 'refused', code: 'unsupported-resource', reason: null });
		if (resource.kind === 'refused') {
			expect(resource.message).toContain('local-single-domain-v1 admits no typed-resource operation');
			expect(resource.message).not.toContain('admission profile');
		}
	});

	it('refuses a Layout unit planner through the landed registry with the unit reason', () => {
		// The landed domain gate admits Layout, so this reaches the unit gate rather
		// than being refused for its domain.
		const coordinator = boot({ registry: createPlannerRegistry<Source>() });
		const layoutUnitPlanner: DomainPlanner<Source> = {
			...cameraViewPlanner('layout-unit', 'layout-unit'),
			admission: { domain: 'layout', compound: false, units: true, resources: false }
		};
		expect(coordinator.register(layoutUnitPlanner)).toMatchObject({
			kind: 'refused',
			reason: 'unit-acceptance'
		});
	});

	it('requires the planner itself to declare compound acceptance, not just a widened registry', async () => {
		const registry = createUnitPlannerRegistry<Source>();
		registry.register({
			...cameraViewPlanner('plain-camera', 'plain-camera'),
			admission: { domain: 'camera', compound: false, units: false, resources: false }
		});
		const compoundIntent: AuthoringIntent = {
			...intent('op-compound', REVISION, 1),
			kind: 'plain-camera',
			targets: [
				cameraReference('rev-camera'),
				{ ...cameraReference('rev-layout'), domain: 'layout', subject: { kind: 'wall', id: 'wall-1' } }
			]
		};
		expect(prepareUnitIntent(registry, snapshot(), compoundIntent)).toMatchObject({
			kind: 'refused',
			code: 'unsupported-compound',
			reason: 'compound-acceptance'
		});
	});

	it('requires the planner itself to declare resource acceptance, not just a staging registry', async () => {
		const registry = createUnitPlannerRegistry<Source>({ resourceStaging: true });
		registry.register({
			...cameraViewPlanner('plain-staging', 'plain-staging'),
			admission: { domain: 'camera', compound: false, units: false, resources: false }
		});
		const resourceIntent: AuthoringIntent = {
			...intent('op-resource', REVISION, 1),
			kind: 'plain-staging',
			targets: [resourceReference('rev-paper', 'texture', 'paper')]
		};
		expect(prepareUnitIntent(registry, snapshot(), resourceIntent)).toMatchObject({
			kind: 'refused',
			code: 'unsupported-resource',
			reason: 'resource-admission'
		});
	});

	it('does not refuse a staging-registry planner at dispatch for the need it registered with', () => {
		const registry = createUnitPlannerRegistry<Source>({ resourceStaging: true });
		const planner: DomainPlanner<Source> = {
			...cameraViewPlanner('staging-unit', 'staging-unit'),
			admission: { domain: 'camera', compound: true, units: true, resources: true }
		};
		expect(registry.register(planner)).toEqual({ kind: 'registered' });
		// A resource-bearing intent, so dispatch really takes the resource-admission
		// path this registry granted; a no-resource intent would pass without it.
		const prepared = prepareUnitIntent(registry, snapshot(), {
			...intent('op-staging', REVISION, 1),
			kind: 'staging-unit',
			targets: [resourceReference('rev-paper', 'texture', 'paper')]
		});
		expect(prepared).toMatchObject({ kind: 'prepared' });
	});

	it('validates targets before planning and refuses without installing', async () => {
		let planned = 0;
		const base = cameraViewPlanner();
		const observed: DomainPlanner<Source> = {
			...base,
			prepare(request) {
				planned += 1;
				return base.prepare(request);
			}
		};
		const registry = createUnitPlannerRegistry<Source>();
		registry.register(observed);
		const coordinator = boot({
			registry,
			inspectTargets: () => [{ path: '$.targets[0]', code: 'missing', message: 'no such view' }]
		});
		const refused = await coordinator.accept(intent('op-unresolved', REVISION, 1));
		expect(refused).toMatchObject({ kind: 'rejected', code: 'unsupported-operation', reason: 'unresolved-target' });
		expect(planned).toBe(0);
		expect(coordinator.installs()).toBe(1);
	});
});

describe('F.2 unit admission — targets and staged resources', () => {
	it('resolves a real Camera view against the supplied envelope', async () => {
		const envelope = await sourceEnvelope();
		const context: ReferenceReadContext = createUnitReadContext({
			envelope,
			sourceContentId: 'digest-envelope',
			sessionEpoch: 'session-unit'
		});
		expect(validateUnitTargets([cameraReference(envelope.units.camera.header.contentRevision)], context)).toEqual([]);
		const missing = validateUnitTargets([cameraReference(envelope.units.camera.header.contentRevision, 'view-absent')], context);
		expect(missing).toHaveLength(1);
		expect(missing[0]).toMatchObject({ path: '$.targets[0]', code: 'missing' });
	});

	it('stages a duplicate-free deterministic resource set and refuses a partial one', async () => {
		const base = await sourceEnvelope();
		const resolved: TypedResource = { kind: 'texture', id: 'paper', contentRevision: 'rev-paper', pin: null, unresolved: null };
		const unresolved: TypedResource = {
			kind: 'texture',
			id: 'fabric',
			contentRevision: null,
			pin: null,
			unresolved: {
				reference: resourceReference('rev-missing', 'texture', 'fabric'),
				domain: 'resource:texture',
				status: 'repair-required',
				message: 'the texture bytes are not resolved yet'
			}
		};
		const envelope: ProjectEnvelope = {
			...base,
			units: {
				...base.units,
				resources: {
					header: { ...base.units.resources.header },
					data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [resolved, unresolved] }
				}
			}
		};
		const context = createUnitReadContext({ envelope, sourceContentId: 'digest-envelope', sessionEpoch: 'session-unit' });
		const revision = envelope.units.resources.data.resources[0]!.contentRevision!;
		const paper = resourceReference(revision, 'texture', 'paper');
		const staged = stageUnitResources(envelope, [paper, paper], context);
		expect(staged.kind).toBe('staged');
		if (staged.kind === 'staged') {
			expect(staged.resources).toEqual([{ kind: 'texture', id: 'paper', contentRevision: 'rev-paper', pin: null }]);
		}

		const refused = stageUnitResources(envelope, [paper, resourceReference(revision, 'texture', 'fabric')], context);
		expect(refused.kind).toBe('refused');
		if (refused.kind === 'refused') expect(refused.issues.length).toBeGreaterThan(0);
	});

	it('stages a pinned external resource by its pin hash and refuses one with neither revision nor pin', async () => {
		const base = await sourceEnvelope();
		const pin = { hash: 'sha256-pinned', mime: 'image/png', size: 128, locator: 'asset://pinned' } as const;
		const pinned: TypedResource = { kind: 'texture', id: 'pinned', contentRevision: null, pin, unresolved: null };
		const neither: TypedResource = { kind: 'texture', id: 'neither', contentRevision: null, pin: null, unresolved: null };
		const envelope: ProjectEnvelope = {
			...base,
			units: {
				...base.units,
				resources: {
					header: { ...base.units.resources.header },
					data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [pinned, neither] }
				}
			}
		};
		const context = createUnitReadContext({ envelope, sourceContentId: 'digest-envelope', sessionEpoch: 'session-unit' });
		// The resolver answers the pin's content hash, which is the subject's concrete
		// revision; there is no fabricated revision and no second source for it.
		const staged = stageUnitResources(envelope, [resourceReference('sha256-pinned', 'texture', 'pinned')], context);
		expect(staged.kind).toBe('staged');
		if (staged.kind === 'staged') {
			expect(staged.resources).toEqual([{ kind: 'texture', id: 'pinned', contentRevision: 'sha256-pinned', pin }]);
		}

		const refused = stageUnitResources(envelope, [resourceReference('rev-none', 'texture', 'neither')], context);
		expect(refused.kind).toBe('refused');
		if (refused.kind === 'refused') expect(refused.issues[0]).toMatchObject({ path: '$.targets[0]', code: 'repair-required' });
	});

	it('refuses a staged record whose resolver answer and envelope fields disagree', async () => {
		const base = await sourceEnvelope();
		const resource: TypedResource = { kind: 'texture', id: 'paper', contentRevision: 'rev-paper', pin: null, unresolved: null };
		const envelope: ProjectEnvelope = {
			...base,
			units: {
				...base.units,
				resources: {
					header: { ...base.units.resources.header },
					data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [resource] }
				}
			}
		};
		const truthful = createUnitReadContext({ envelope, sourceContentId: 'digest-envelope', sessionEpoch: 'session-unit' });
		// A resolver that answers a different revision than the envelope records is the
		// two-authority failure the check exists for: staging must refuse, not pick one.
		const disagreeing = {
			...truthful,
			resolvers: truthful.resolvers.map((resolver) =>
				resolver.domain === 'resource:texture'
					? {
							...resolver,
							resolve: () => ({
								kind: 'resolved' as const,
								contentRevision: 'sha256-other',
								location: { kind: 'project-root' as const }
							})
					  }
					: resolver
			)
		} satisfies ReferenceReadContext;
		const refused = stageUnitResources(envelope, [resourceReference('rev-paper', 'texture', 'paper')], disagreeing);
		expect(refused.kind).toBe('refused');
		if (refused.kind === 'refused') expect(refused.issues[0]).toMatchObject({ path: '$.targets[0]', code: 'unresolved-resource' });
	});

	it('stages a resource that carries both a content revision and an external-bytes pin', async () => {
		const base = await sourceEnvelope();
		// The revision names the unit content and the pin records the immutable bytes it
		// depends on: two different identities that legitimately coexist, so both are
		// kept — the resolver's revision and the pin as external-bytes metadata.
		const resource: TypedResource = {
			kind: 'texture',
			id: 'paper',
			contentRevision: 'rev-paper',
			pin: { hash: 'sha256-pin-other', mime: 'image/png', size: 64, locator: 'asset://other' },
			unresolved: null
		};
		const envelope: ProjectEnvelope = {
			...base,
			units: {
				...base.units,
				resources: {
					header: { ...base.units.resources.header },
					data: { formatVersion: RESOURCE_UNIT_FORMAT_VERSION, resources: [resource] }
				}
			}
		};
		const context = createUnitReadContext({ envelope, sourceContentId: 'digest-envelope', sessionEpoch: 'session-unit' });
		const staged = stageUnitResources(envelope, [resourceReference('rev-paper', 'texture', 'paper')], context);
		expect(staged).toEqual({
			kind: 'staged',
			resources: [{ kind: 'texture', id: 'paper', contentRevision: 'rev-paper', pin: resource.pin }]
		});
	});
});
