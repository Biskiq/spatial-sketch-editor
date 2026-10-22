/**
 * Probes 3 (bounded) + 4/5 (channel half). What the landed F.1 unit resolvers and F.3 negotiation
 * enforce for a part-qualified target on one of two instances of one model resource.
 *
 * `scene.part-emphasis@1` below is a RESEARCH-ONLY family declared inside this harness to exercise
 * the landed, family-generic negotiation. It is not a proposal for a production family id.
 */
import { describe, expect, it } from 'vitest';
import {
	createChannelHost,
	DEFAULT_CHANNEL_FAMILIES,
	negotiateChannelContribution,
	readChannelProperty,
	withdrawChannelContribution,
	type ChannelContribution,
	type ChannelDescriptor,
	type ChannelFamily,
	type ChannelState,
	type SemanticReference
} from '@portfolio/project-model';
import { createEmptyWallFirstLayoutDocument } from '@portfolio/project-model';
import { createUnitReadContext, resolveUnitReference } from '@portfolio/project-model/references/unit-resolution';
import {
	CAMERA_UNIT_FORMAT_VERSION,
	EXPERIENCE_UNIT_FORMAT_VERSION,
	RESOURCE_UNIT_FORMAT_VERSION,
	SCENE_UNIT_FORMAT_VERSION,
	computeEnvelopeSourceContentId,
	createProjectEnvelope,
	type ProjectEnvelope
} from '@portfolio/project-model/units';

const FIXTURE_REVISION = 'sha256-48a24ffc4a6d2798022e4ae9015da8eb0948460b53b8eba0dad6412c91998bee';

async function envelope(resourceRevision = FIXTURE_REVISION): Promise<ProjectEnvelope> {
	return createProjectEnvelope({
		id: 'project-1',
		name: 'Specimen',
		acceptedRevision: { projectId: 'project-1', revisionId: 'revision-1' },
		dependencyLock: { formatVersion: 1, entries: [] },
		layout: { unitId: 'unit-layout', data: createEmptyWallFirstLayoutDocument() },
		scene: {
			unitId: 'unit-scene',
			data: {
				formatVersion: SCENE_UNIT_FORMAT_VERSION,
				textures: [],
				materials: [],
				entities: [
					{ id: 'instance-a', name: 'Specimen', position: [0, 0, 0], rotation: [0, 0, 0], kind: 'model', assetId: 'specimen', fallback: 'piano' },
					{ id: 'instance-b', name: 'Specimen', position: [2, 0, 0], rotation: [0, 0, 0], kind: 'model', assetId: 'specimen', fallback: 'piano' }
				]
			}
		},
		camera: {
			unitId: 'unit-camera',
			data: {
				formatVersion: CAMERA_UNIT_FORMAT_VERSION,
				views: [{ id: 'view-1', label: 'Specimen', eye: [0, 1.5, 3], target: [0, 1, 0], fov: 50, connectedViewIds: [] }],
				connections: []
			}
		},
		experience: {
			unitId: 'unit-experience',
			data: {
				formatVersion: EXPERIENCE_UNIT_FORMAT_VERSION,
				experiences: [{
					id: 'experience-1', label: 'Explain', entryGuideId: null,
					presentations: [{ id: 'presentation-1', label: 'The lid', viewId: 'view-1' }],
					stops: [], guides: [], gates: [], detours: []
				}]
			}
		},
		resources: {
			unitId: 'unit-resources',
			data: {
				formatVersion: RESOURCE_UNIT_FORMAT_VERSION,
				resources: [{ kind: 'asset', id: 'specimen', contentRevision: resourceRevision, pin: null, unresolved: null }]
			}
		}
	});
}

function sceneRef(env: ProjectEnvelope, entityId: string, componentId: string | null): SemanticReference {
	return {
		version: 1,
		domain: 'scene',
		revision: { kind: 'exact', contentRevision: env.units.scene.header.contentRevision },
		subject: { kind: 'entity', id: entityId },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId,
		capabilityId: null
	};
}

const FAMILY_ID = 'scene.part-emphasis@1';
const EMPHASIS: ChannelDescriptor = {
	version: 1, family: FAMILY_ID, propertyId: 'emphasis', valueKind: 'identifier', units: null, range: null,
	values: ['highlight'], scope: 'session', arbitration: 'exclusive', interpolation: 'none',
	invalidation: ['accepted-revision'], capability: { id: 'scene.part-emphasis', required: true },
	validator: 'research.scene.part-emphasis@1'
};
const RESEARCH_FAMILY: ChannelFamily = {
	id: FAMILY_ID, domain: 'scene', capability: { id: 'scene.part-emphasis', required: true },
	admission: { ownerSubjectKinds: ['entity'], frameKinds: ['project-world'], qualifiedAddresses: true },
	properties: [EMPHASIS], requiredProperties: ['emphasis'], controllerProperty: null
};

function contribution(env: ProjectEnvelope, content: string, entityId: string, componentId: string, invocationId: string, runEpoch: number): ChannelContribution {
	return {
		version: 1,
		descriptor: EMPHASIS,
		address: {
			version: 1, ownerReference: sceneRef(env, entityId, null), instancePath: [], componentId,
			capabilityId: null, propertyId: 'emphasis', frame: { version: 1, kind: 'project-world' }
		},
		value: { kind: 'identifier', value: 'highlight' },
		scopeId: 'preview-session-1',
		invocationId,
		runEpoch,
		computedFrom: { contentRevision: content, generationId: null }
	};
}

describe('F.1: part qualification of a placed instance', () => {
	it('resolves the instance but refuses any componentId: no Scene/resource component provider exists', async () => {
		const env = await envelope();
		const whole = await resolveUnitReference(sceneRef(env, 'instance-b', null), { envelope: env, sessionEpoch: 's1' });
		const part = await resolveUnitReference(sceneRef(env, 'instance-b', 'node:5'), { envelope: env, sessionEpoch: 's1' });
		console.log('F1 WHOLE', whole.kind, 'F1 PART', part.kind, 'code' in part ? part.code : '', 'message' in part ? part.message : '');
		expect(whole.kind).toBe('resolved');
		expect(part.kind).not.toBe('resolved');
	});
});

describe('F.3: a research Scene part family over the landed generic negotiation', () => {
	it('the default host refuses the family: no Scene channel family is admitted', async () => {
		const env = await envelope();
		const content = await computeEnvelopeSourceContentId(env);
		const context = { read: createUnitReadContext({ envelope: env, sourceContentId: content, sessionEpoch: 's1' }), cameraOutputs: [] };
		const out = negotiateChannelContribution(createChannelHost(DEFAULT_CHANNEL_FAMILIES), { entries: [], marks: [] }, contribution(env, content, 'instance-b', 'node:5', 'run-x', 1), context);
		console.log('DEFAULT HOST', out.kind, out.kind === 'rejected' ? out.reason : '');
		expect(out.kind).toBe('rejected');
	});

	it('admits part-qualified, instance-distinct, run-scoped contributions, but never checks the component exists', async () => {
		const env = await envelope();
		const content = await computeEnvelopeSourceContentId(env);
		const context = { read: createUnitReadContext({ envelope: env, sourceContentId: content, sessionEpoch: 's1' }), cameraOutputs: [] };
		const host = createChannelHost([...DEFAULT_CHANNEL_FAMILIES, RESEARCH_FAMILY]);
		expect(host.problems).toEqual([]);
		let state: ChannelState = { entries: [], marks: [] };
		const trace: string[] = [];
		const offer = (c: ChannelContribution) => {
			const out = negotiateChannelContribution(host, state, c, context);
			state = out.state;
			trace.push(`${c.invocationId}@${c.runEpoch} ${c.address.ownerReference.subject.id}/${c.address.componentId} -> ${out.kind}${out.kind === 'rejected' ? `:${out.reason}` : ''}`);
			return out;
		};
		// X on instance B, part node:5 (exists in the fixture) and a nonexistent part node:999.
		const x = offer(contribution(env, content, 'instance-b', 'node:5', 'run-x', 1));
		const ghost = offer(contribution(env, content, 'instance-b', 'node:999', 'run-g', 1));
		// Same part on instance A: a distinct scope, so B's contribution does not leak to A.
		const z = offer(contribution(env, content, 'instance-a', 'node:5', 'run-z', 1));
		// Y on B's same part from another invocation: exclusive conflict.
		const y = offer(contribution(env, content, 'instance-b', 'node:5', 'run-y', 1));
		// X re-enters as a newer run epoch, then the older run's late cleanup arrives.
		offer(contribution(env, content, 'instance-b', 'node:5', 'run-x', 2));
		const staleCleanup = x.kind === 'accepted' ? withdrawChannelContribution(state, { scope: x.scope, invocationId: 'run-x', runEpoch: 1 }) : null;
		if (staleCleanup) {
			state = staleCleanup.state;
			trace.push(`withdraw run-x@1 -> ${staleCleanup.kind}`);
		}
		// Old run tries to re-offer after being superseded.
		offer(contribution(env, content, 'instance-b', 'node:5', 'run-x', 1));
		// Cancel twice.
		const c1 = x.kind === 'accepted' ? withdrawChannelContribution(state, { scope: x.scope, invocationId: 'run-x', runEpoch: 2 }) : null;
		if (c1) { state = c1.state; trace.push(`withdraw run-x@2 -> ${c1.kind}`); }
		const c2 = x.kind === 'accepted' ? withdrawChannelContribution(state, { scope: x.scope, invocationId: 'run-x', runEpoch: 2 }) : null;
		if (c2) { state = c2.state; trace.push(`withdraw run-x@2 again -> ${c2.kind}`); }
		// Contribution computed from an older source content (e.g. before a resource revision).
		offer(contribution(env, 'sha256-older-content', 'instance-b', 'node:5', 'run-w', 1));
		console.log('F3 TRACE\n' + trace.join('\n'));
		expect(x.kind).toBe('accepted');
		expect(ghost.kind).toBe('accepted'); // no component provider: a dangling part id is admitted
		expect(z.kind).toBe('accepted');
		expect(y.kind === 'rejected' && y.reason).toBe('competing-exclusive-contribution');
		if (z.kind === 'accepted') expect(readChannelProperty(state, z.scope, context).kind).toBe('value');
	});

	it('a resource revision changes envelope content, so an older contribution expires on read', async () => {
		const before = await envelope();
		const after = await envelope('sha256-re-exported-revision');
		const c0 = await computeEnvelopeSourceContentId(before);
		const c1 = await computeEnvelopeSourceContentId(after);
		expect(c0).not.toBe(c1);
		const host = createChannelHost([...DEFAULT_CHANNEL_FAMILIES, RESEARCH_FAMILY]);
		const ctx0 = { read: createUnitReadContext({ envelope: before, sourceContentId: c0, sessionEpoch: 's1' }), cameraOutputs: [] };
		const ctx1 = { read: createUnitReadContext({ envelope: after, sourceContentId: c1, sessionEpoch: 's1' }), cameraOutputs: [] };
		const accepted = negotiateChannelContribution(host, { entries: [], marks: [] }, contribution(before, c0, 'instance-b', 'node:5', 'run-x', 1), ctx0);
		expect(accepted.kind).toBe('accepted');
		if (accepted.kind !== 'accepted') return;
		const read = readChannelProperty(accepted.state, accepted.scope, ctx1);
		console.log('READ AFTER RESOURCE REVISION', read.kind);
		expect(read.kind).toBe('absent');
		// Expiry is envelope-wide content, not a component-correspondence check: node:5 is never
		// re-validated against the new resource revision, it simply stops reading.
	});
});
