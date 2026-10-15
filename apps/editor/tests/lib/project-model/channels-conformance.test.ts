/**
 * F.3 `inspection-v1` conformance — the T1.P01.S01 provider for `F3.channels@1`.
 *
 * AM-3's required conformance set: finite default/depth absence, invalid
 * units/frame/range, unknown required versus optional-unsupported families,
 * conflict, replacement and stale cleanup, plus the Camera-output ticket
 * protocol's acquire/request/replace/return/cancel semantics and its
 * stale-owner/epoch rejection. The S01 acceptance rows add the Layout ordinary
 * Plan value family, the Camera session inspection family and the exactly-one
 * exclusive Camera output owner per viewport/session rule.
 *
 * Every fixture here exercises the shared protocol only: no Stage, evaluator,
 * output controller, projection or navigation is implemented by this provider,
 * and the tests assert ownership decisions and validated values, not rendered
 * output. Runtime-safe import closure is proved by
 * `tests/lib/project-model-boundary.test.ts` (arch lane).
 */
import { describe, expect, it } from 'vitest';

import {
	CAMERA_OUTPUT_ROLES,
	CAMERA_SESSION_INSPECTION_FAMILY,
	DEFAULT_CHANNEL_FAMILIES,
	EMPTY_CHANNEL_STATE,
	LAYOUT_PLAN_FAMILY,
	acquireCameraOutput,
	cancelCameraOutput,
	channelFamilySatisfaction,
	createCameraOutputState,
	createChannelHost,
	declaredProperty,
	familyProblems,
	findChannelContribution,
	negotiateChannelContribution,
	replaceCameraOutput,
	requestCameraOutput,
	returnCameraOutput,
	validateCameraOutputTicket,
	validateChannelAddress,
	validateChannelContribution,
	validateChannelDescriptor,
	validateChannelValue,
	type CameraOutputState,
	type CameraOutputTicket,
	type ChannelAddress,
	type ChannelContribution,
	type ChannelEvaluationContext,
	type ChannelState,
	type SemanticReference,
	type SnapshotIdentity
} from '@portfolio/project-model';

const SNAPSHOT: SnapshotIdentity = {
	acceptedRevision: { projectId: 'project-1', revisionId: 'revision-7' },
	sourceContentId: 'sha256-source-7'
};

const CONTEXT: ChannelEvaluationContext = { snapshot: SNAPSHOT, generationId: 'generation-3' };

const HOST = createChannelHost();

function ownerReference(id = 'wall-1'): SemanticReference {
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: 'sha256-source-7' },
		subject: { kind: 'wall', id },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

function planAddress(propertyId: string, overrides: Partial<ChannelAddress> = {}): ChannelAddress {
	return {
		version: 1,
		ownerReference: ownerReference(),
		instancePath: [],
		componentId: null,
		capabilityId: null,
		propertyId,
		frame: { version: 1, kind: 'project-world' },
		...overrides
	};
}

/**
 * A Camera-qualified address. The family's owning domain must agree with the address's
 * owner domain, so a Camera session property is addressed to a Camera subject — current
 * Camera subjects are its navigation nodes and connections.
 */
function cameraAddress(propertyId: string, overrides: Partial<ChannelAddress> = {}): ChannelAddress {
	return planAddress(propertyId, {
		ownerReference: {
			...ownerReference('node-1'),
			domain: 'camera',
			subject: { kind: 'navigation-node', id: 'node-1' },
			instancePath: ['output-1']
		},
		...overrides
	});
}

type ContributionOptions = {
	propertyId: string;
	value: Record<string, unknown>;
	scopeId?: string;
	invocationId?: string;
	runEpoch?: number;
	address?: ChannelAddress;
	descriptor?: Record<string, unknown>;
	computedFrom?: Record<string, unknown> | null;
	camera?: boolean;
};

/** A raw (untrusted) Layout Plan or Camera session contribution. */
function contribution(options: ContributionOptions): Record<string, unknown> {
	const family = options.camera === true ? CAMERA_SESSION_INSPECTION_FAMILY : LAYOUT_PLAN_FAMILY;
	const declared = declaredProperty(family, options.propertyId);
	if (declared === null) throw new Error(`the fixture asked for an undeclared property "${options.propertyId}"`);
	return {
		version: 1,
		descriptor: options.descriptor ?? declared,
		address: options.address ?? (options.camera === true ? cameraAddress(options.propertyId) : planAddress(options.propertyId)),
		value: options.value,
		scopeId: options.scopeId ?? 'viewport-1',
		invocationId: options.invocationId ?? 'invocation-1',
		runEpoch: options.runEpoch ?? 1,
		computedFrom:
			options.computedFrom === null
				? { contentRevision: null, generationId: null }
				: (options.computedFrom ?? { contentRevision: 'sha256-source-7', generationId: 'generation-3' })
	};
}

function accept(state: ChannelState, input: unknown): ChannelState {
	const outcome = negotiateChannelContribution(HOST, state, input, CONTEXT);
	expect(outcome.kind).toBe('accepted');
	if (outcome.kind !== 'accepted') throw new Error('unreachable');
	return outcome.state;
}

describe('F.3 inspection-v1 — families, descriptors and addresses', () => {
	it('declares the two admitted v1 families without structural problems', () => {
		expect(familyProblems(DEFAULT_CHANNEL_FAMILIES)).toEqual([]);
		expect(HOST.problems).toEqual([]);
		expect(DEFAULT_CHANNEL_FAMILIES.map((family) => family.id)).toEqual([
			'layout.plan@1',
			'camera.session-inspection@1'
		]);
		// A required property a family does not publish could never be satisfied.
		expect(
			familyProblems([
				{ ...LAYOUT_PLAN_FAMILY, id: 'layout.broken@1', requiredProperties: ['missing-property'] }
			]).join('\n')
		).toContain('required property "missing-property" is not declared');
		expect(familyProblems([LAYOUT_PLAN_FAMILY, LAYOUT_PLAN_FAMILY]).join('\n')).toContain('declared more than once');
	});

	it('rejects a descriptor whose units, range or vocabulary contradict its value kind', () => {
		const declared = declaredProperty(LAYOUT_PLAN_FAMILY, 'depth')!;
		expect(validateChannelDescriptor(declared).success).toBe(true);
		expect(validateChannelDescriptor({ ...declared, units: 'radians' }).success).toBe(true);
		expect(validateChannelDescriptor({ ...declared, version: 2 }).success).toBe(false);
		expect(validateChannelDescriptor({ ...declared, range: { min: 5, max: 1, minExclusive: false, maxExclusive: false } }).success).toBe(
			false
		);
		const reveal = declaredProperty(LAYOUT_PLAN_FAMILY, 'reveal')!;
		expect(validateChannelDescriptor({ ...reveal, units: 'meters' }).success).toBe(false);
		expect(validateChannelDescriptor({ ...reveal, range: { min: 0, max: null, minExclusive: false, maxExclusive: false } }).success).toBe(
			false
		);
		expect(validateChannelDescriptor({ ...declared, valueKind: 'text' as never }).success).toBe(false);
		expect(validateChannelDescriptor({ ...declared, values: ['only-identifiers'] }).success).toBe(false);
		expect(validateChannelDescriptor({ ...declared, extra: true }).success).toBe(false);
		const controller = declaredProperty(CAMERA_SESSION_INSPECTION_FAMILY, 'controller')!;
		expect(controller.values).toEqual([...CAMERA_OUTPUT_ROLES]);
		// AM-3's Camera session inspection family publishes the reading/projection policy and
		// motion policy inputs, not only the pose values and the controller.
		expect(CAMERA_SESSION_INSPECTION_FAMILY.properties.map((property) => property.propertyId)).toEqual([
			'target',
			'azimuth',
			'elevation',
			'frame-height',
			'controller',
			'reading-projection-policy',
			'motion-policy'
		]);
		for (const [propertyId, validator] of [
			['reading-projection-policy', 'camera.session.reading-projection-policy@1'],
			['motion-policy', 'camera.session.motion-policy@1']
		] as const) {
			const policy = declaredProperty(CAMERA_SESSION_INSPECTION_FAMILY, propertyId)!;
			// The owning domain decides which policies exist: an open declared set, not invented values.
			expect([policy.valueKind, policy.units, policy.values, policy.arbitration, policy.validator]).toEqual([
				'identifier',
				null,
				null,
				'exclusive',
				validator
			]);
			// Optional: an absent policy means the Camera authority's own declared default.
			expect(CAMERA_SESSION_INSPECTION_FAMILY.requiredProperties).not.toContain(propertyId);
		}
	});

	it('reads an address field by field and never parses a delimiter string', () => {
		const address = planAddress('cut-height', {
			ownerReference: ownerReference('wall:a/b'),
			instancePath: ['a', 'b']
		});
		const result = validateChannelAddress(address);
		expect(result.success).toBe(true);
		if (!result.success) return;
		// A subject id may contain a delimiter character: it stays one opaque identity.
		expect(result.value.ownerReference.subject.id).toBe('wall:a/b');
		expect(result.value.instancePath).toEqual(['a', 'b']);
		// ['a','b'] and ['a/b'] are different identities, proving nothing is split.
		expect(validateChannelAddress({ ...address, instancePath: ['a/b'] }).success).toBe(true);

		// The accepted state is then found by that same identity, not by a string form.
		const accepted = accept(EMPTY_CHANNEL_STATE, contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.2 } }));
		const standard = planAddress('cut-height');
		expect(findChannelContribution(accepted, standard, 'viewport-1')).not.toBeNull();
		expect(findChannelContribution(accepted, standard, 'viewport-2')).toBeNull();
		expect(findChannelContribution(accepted, planAddress('depth'), 'viewport-1')).toBeNull();

		expect(validateChannelAddress({ ...address, frame: undefined }).success).toBe(false);
		expect(validateChannelAddress({ ...address, frame: { version: 1, kind: 'room-frame', roomId: 'r' } }).success).toBe(false);
		expect(validateChannelAddress({ ...address, propertyId: '' }).success).toBe(false);
		expect(validateChannelAddress({ ...address, capabilityId: 'a b' }).success).toBe(false);
		expect(validateChannelAddress({ ...address, extra: 1 }).success).toBe(false);
		expect(validateChannelAddress({ ...address, ownerReference: { ...ownerReference(), version: 2 } }).success).toBe(false);
	});
});

describe('F.3 inspection-v1 — values', () => {
	it('requires the value kind, units and finite domain of the declared property', () => {
		const cut = declaredProperty(LAYOUT_PLAN_FAMILY, 'cut-height')!;
		expect(validateChannelValue({ kind: 'number', value: 1.2 }, cut).success).toBe(true);
		expect(validateChannelValue({ kind: 'number', value: Number.NaN }, cut).success).toBe(false);
		expect(validateChannelValue({ kind: 'number', value: Number.POSITIVE_INFINITY }, cut).success).toBe(false);
		expect(validateChannelValue({ kind: 'identifier', value: 'plan' }, cut).success).toBe(false);
		expect(validateChannelValue({ kind: 'number', value: 1.2, units: 'meters' }, cut).success).toBe(false);

		const depth = declaredProperty(LAYOUT_PLAN_FAMILY, 'depth')!;
		expect(validateChannelValue({ kind: 'number', value: 100 }, depth).success).toBe(true);
		// depth is finite meters > 0 and required.
		const zero = validateChannelValue({ kind: 'number', value: 0 }, depth);
		expect(zero.success).toBe(false);
		expect(zero.rangeViolation).toBe(true);
		expect(validateChannelValue({ kind: 'number', value: -4 }, depth).success).toBe(false);
	});

	it('refuses a negative or zero frame height, a non-finite target and an undeclared controller', () => {
		const height = declaredProperty(CAMERA_SESSION_INSPECTION_FAMILY, 'frame-height')!;
		expect(validateChannelValue({ kind: 'number', value: 2.4 }, height).success).toBe(true);
		expect(validateChannelValue({ kind: 'number', value: 0 }, height).success).toBe(false);
		expect(validateChannelValue({ kind: 'number', value: -1 }, height).success).toBe(false);

		const target = declaredProperty(CAMERA_SESSION_INSPECTION_FAMILY, 'target')!;
		expect(validateChannelValue({ kind: 'vector3', value: [1, 2, 3] }, target).success).toBe(true);
		expect(validateChannelValue({ kind: 'vector3', value: [1, Number.NaN, 3] }, target).success).toBe(false);
		expect(validateChannelValue({ kind: 'vector3', value: [1, 2] }, target).success).toBe(false);

		const azimuth = declaredProperty(CAMERA_SESSION_INSPECTION_FAMILY, 'azimuth')!;
		expect(validateChannelValue({ kind: 'number', value: Number.NaN }, azimuth).success).toBe(false);

		const controller = declaredProperty(CAMERA_SESSION_INSPECTION_FAMILY, 'controller')!;
		expect(validateChannelValue({ kind: 'identifier', value: 'inspection' }, controller).success).toBe(true);
		expect(validateChannelValue({ kind: 'identifier', value: 'orbit' }, controller).success).toBe(false);
	});

	it('refuses repeated identities in a declared set', () => {
		const reveal = declaredProperty(LAYOUT_PLAN_FAMILY, 'reveal')!;
		const identity = { domain: 'layout', subject: { kind: 'wall', id: 'wall-1' }, instancePath: [] };
		expect(validateChannelValue({ kind: 'source-set', value: [identity] }, reveal).success).toBe(true);
		expect(validateChannelValue({ kind: 'source-set', value: [identity, identity] }, reveal).success).toBe(false);
		expect(validateChannelValue({ kind: 'source-set', value: [{ domain: 'layout' }] }, reveal).success).toBe(false);
		// A declared source identity is an admitted domain, never an opaque string.
		expect(
			validateChannelValue({ kind: 'source-set', value: [{ ...identity, domain: 'museum' }] }, reveal).success
		).toBe(false);

		const filter = declaredProperty(LAYOUT_PLAN_FAMILY, 'source-kind-filter')!;
		expect(validateChannelValue({ kind: 'identifier-set', value: ['wall', 'opening'] }, filter).success).toBe(true);
		expect(validateChannelValue({ kind: 'identifier-set', value: ['wall', 'wall'] }, filter).success).toBe(false);
	});

	it('rejects an unknown required family and reports an optional one as unavailable', () => {
		const required = contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.2 } });
		required.descriptor = {
			...(required.descriptor as Record<string, unknown>),
			family: 'layout.unknown@9',
			capability: { id: 'layout.unknown', required: true }
		};
		const rejected = negotiateChannelContribution(HOST, EMPTY_CHANNEL_STATE, required, CONTEXT);
		expect(rejected.kind).toBe('rejected');
		if (rejected.kind !== 'rejected') return;
		expect(rejected.reason).toBe('unsupported-required-family');
		expect(rejected.diagnostics.address?.propertyId).toBe('cut-height');

		const optional = contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.2 } });
		optional.descriptor = {
			...(optional.descriptor as Record<string, unknown>),
			family: 'layout.optional@1',
			capability: { id: 'layout.optional', required: false }
		};
		const unavailable = negotiateChannelContribution(HOST, EMPTY_CHANNEL_STATE, optional, CONTEXT);
		expect(unavailable.kind).toBe('unavailable');
		if (unavailable.kind !== 'unavailable') return;
		expect(unavailable.family).toBe('layout.optional@1');
		expect(unavailable.state).toBe(EMPTY_CHANNEL_STATE);
	});

	it('rejects a malformed contribution and one that redefines a declared property', () => {
		const valid = contribution({ propertyId: 'depth', value: { kind: 'number', value: 100 } });
		expect(validateChannelContribution(valid, { admittedFamilies: HOST.families.map((family) => family.id) }).success).toBe(true);
		expect(validateChannelContribution({ ...valid, extra: 1 }).success).toBe(false);
		expect(validateChannelContribution({ ...valid, runEpoch: -1 }).success).toBe(false);
		expect(validateChannelContribution({ ...valid, runEpoch: 1.5 }).success).toBe(false);
		expect(validateChannelContribution({ ...valid, computedFrom: undefined }).success).toBe(false);

		const mismatchedProperty = contribution({
			propertyId: 'depth',
			value: { kind: 'number', value: 100 },
			address: planAddress('cut-height')
		});
		const mismatch = negotiateChannelContribution(HOST, EMPTY_CHANNEL_STATE, mismatchedProperty, CONTEXT);
		expect(mismatch.kind === 'rejected' && mismatch.reason).toBe('invalid-contribution');

		const undeclared = contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1 } });
		undeclared.address = planAddress('peel-depth');
		undeclared.descriptor = { ...(undeclared.descriptor as Record<string, unknown>), propertyId: 'peel-depth' };
		const unknown = negotiateChannelContribution(HOST, EMPTY_CHANNEL_STATE, undeclared, CONTEXT);
		expect(unknown.kind === 'rejected' && unknown.reason).toBe('undeclared-property');

		const redefined = contribution({ propertyId: 'depth', value: { kind: 'number', value: 100 } });
		redefined.descriptor = { ...(redefined.descriptor as Record<string, unknown>), units: 'radians' };
		const descriptorMismatch = negotiateChannelContribution(HOST, EMPTY_CHANNEL_STATE, redefined, CONTEXT);
		expect(descriptorMismatch.kind === 'rejected' && descriptorMismatch.reason).toBe('descriptor-mismatch');
	});
});

describe('F.3 inspection-v1 — negotiation, conflict and replacement', () => {
	it('reports depth absence instead of accepting an unsatisfiable Plan inspection', () => {
		const withCut = accept(
			EMPTY_CHANNEL_STATE,
			contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.2 } })
		);
		const satisfaction = channelFamilySatisfaction(LAYOUT_PLAN_FAMILY, withCut, planAddress('cut-height'), 'viewport-1');
		expect(satisfaction.satisfied).toBe(false);
		expect(satisfaction.missingRequiredProperties).toEqual(['depth']);

		const outcome = negotiateChannelContribution(
			HOST,
			withCut,
			contribution({ propertyId: 'depth', value: { kind: 'number', value: 100 }, runEpoch: 2 }),
			CONTEXT
		);
		expect(outcome.kind).toBe('accepted');
		if (outcome.kind !== 'accepted') return;
		expect(outcome.satisfied).toBe(true);
		expect(outcome.missingRequiredProperties).toEqual([]);
	});

	it('refuses a competing exclusive contribution, naming domain, address and owners', () => {
		const first = accept(
			EMPTY_CHANNEL_STATE,
			contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.2 } })
		);
		const competing = contribution({
			propertyId: 'cut-height',
			value: { kind: 'number', value: 2 },
			invocationId: 'invocation-2',
			runEpoch: 5
		});
		const outcome = negotiateChannelContribution(HOST, first, competing, CONTEXT);
		expect(outcome.kind).toBe('rejected');
		if (outcome.kind !== 'rejected') return;
		// A higher run epoch does not buy an exclusive property: the other invocation's
		// control is refused with the domain, address, owners and an actionable reason.
		expect(outcome.reason).toBe('competing-exclusive-contribution');
		expect(outcome.diagnostics.domain).toBe('layout');
		expect(outcome.diagnostics.address?.propertyId).toBe('cut-height');
		expect(outcome.diagnostics.owners).toEqual(['invocation-1', 'invocation-2']);
		expect(outcome.diagnostics.action).not.toBe('');
		// The accepted contribution is untouched: rejection is not a partial write.
		expect(outcome.state).toBe(first);
	});

	it('refuses a contribution whose family and address owner name different domains', () => {
		// A Layout Plan property cannot be qualified by a Scene-owned address: neither the
		// family nor the address would then be authoritative for the property's meaning.
		const sceneOwned = contribution({
			propertyId: 'cut-height',
			value: { kind: 'number', value: 1.2 },
			address: planAddress('cut-height', {
				ownerReference: { ...ownerReference('entity-1'), domain: 'scene', subject: { kind: 'entity', id: 'entity-1' } }
			})
		});
		const outcome = negotiateChannelContribution(HOST, EMPTY_CHANNEL_STATE, sceneOwned, CONTEXT);
		expect(outcome.kind).toBe('rejected');
		if (outcome.kind !== 'rejected') return;
		expect(outcome.reason).toBe('domain-mismatch');
		expect(outcome.diagnostics.domain).toBe('scene');
		expect(outcome.state).toBe(EMPTY_CHANNEL_STATE);

		// The matching Camera family and Camera-qualified address still negotiate.
		const cameraOwned = contribution({
			propertyId: 'motion-policy',
			value: { kind: 'identifier', value: 'guided' },
			camera: true,
			computedFrom: null
		});
		expect(negotiateChannelContribution(HOST, EMPTY_CHANNEL_STATE, cameraOwned, CONTEXT).kind).toBe('accepted');
	});

	it('allows the holding invocation a deliberate replacement and refuses a stale run epoch', () => {
		const first = accept(
			EMPTY_CHANNEL_STATE,
			contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.2 } })
		);
		const replaced = negotiateChannelContribution(
			HOST,
			first,
			contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.5 }, runEpoch: 2 }),
			CONTEXT
		);
		expect(replaced.kind).toBe('accepted');
		if (replaced.kind !== 'accepted') return;
		expect(replaced.replaced).toHaveLength(1);
		expect(replaced.replaced[0]!.runEpoch).toBe(1);
		expect(replaced.contribution.value).toEqual({ kind: 'number', value: 1.5 });

		const stale = negotiateChannelContribution(
			HOST,
			replaced.state,
			contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.1 }, runEpoch: 1 }),
			CONTEXT
		);
		expect(stale.kind).toBe('rejected');
		if (stale.kind !== 'rejected') return;
		expect(stale.reason).toBe('stale-run-epoch');
		expect(stale.state).toBe(replaced.state);
	});

	it('refuses a same-epoch conflict and accepts an idempotent re-offer', () => {
		const first = accept(
			EMPTY_CHANNEL_STATE,
			contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.2 } })
		);
		// Same invocation and run epoch, a different value: one accepted contribution
		// per run, so the second cannot silently overwrite the first.
		const conflict = negotiateChannelContribution(
			HOST,
			first,
			contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.9 } }),
			CONTEXT
		);
		expect(conflict.kind === 'rejected' && conflict.reason).toBe('same-run-epoch-conflict');

		// A different invocation at the same epoch is the exclusive conflict, not this one.
		const foreign = negotiateChannelContribution(
			HOST,
			first,
			contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.9 }, invocationId: 'invocation-9' }),
			CONTEXT
		);
		expect(foreign.kind === 'rejected' && foreign.reason).toBe('competing-exclusive-contribution');

		const idempotent = negotiateChannelContribution(
			HOST,
			first,
			contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.2 } }),
			CONTEXT
		);
		expect(idempotent.kind).toBe('accepted');
		if (idempotent.kind !== 'accepted') return;
		expect(idempotent.idempotent).toBe(true);
		expect(idempotent.state).toBe(first);
	});

	it('unions a Reveal set over declared source identities only', () => {
		const reveal = (ids: readonly string[]): Record<string, unknown> =>
			contribution({
				propertyId: 'reveal',
				value: {
					kind: 'source-set',
					value: ids.map((id) => ({ domain: 'layout', subject: { kind: 'wall', id }, instancePath: [] }))
				}
			});
		const first = accept(EMPTY_CHANNEL_STATE, reveal(['wall-1']));
		const merged = negotiateChannelContribution(HOST, first, reveal(['wall-1', 'wall-2']), CONTEXT);
		expect(merged.kind).toBe('accepted');
		if (merged.kind !== 'accepted') return;
		expect(merged.contribution.value.kind).toBe('source-set');
		const identities = merged.contribution.value.kind === 'source-set' ? merged.contribution.value.value : [];
		expect(identities.map((identity) => identity.subject.id)).toEqual(['wall-1', 'wall-2']);
		expect(merged.replaced).toHaveLength(1);

		// A subset adds nothing: the union is idempotent rather than a rewrite.
		const subset = negotiateChannelContribution(HOST, merged.state, reveal(['wall-2']), CONTEXT);
		expect(subset.kind === 'accepted' && subset.idempotent).toBe(true);

		// The union property still refuses a value that is not a declared identity set.
		const scalar = contribution({ propertyId: 'reveal', value: { kind: 'number', value: 1 } });
		const invalid = negotiateChannelContribution(HOST, merged.state, scalar, CONTEXT);
		expect(invalid.kind === 'rejected' && invalid.reason).toBe('invalid-contribution');
	});

	it('replaces the one Camera controller only with a strictly newer run epoch', () => {
		const controller = (runEpoch: number): Record<string, unknown> =>
			contribution({
				propertyId: 'controller',
				value: { kind: 'identifier', value: 'inspection' },
				runEpoch,
				camera: true,
				computedFrom: null
			});
		const first = accept(EMPTY_CHANNEL_STATE, controller(1));
		const replaced = negotiateChannelContribution(HOST, first, controller(2), CONTEXT);
		expect(replaced.kind).toBe('accepted');
		if (replaced.kind !== 'accepted') return;
		expect(replaced.replaced).toHaveLength(1);
		expect(replaced.contribution.runEpoch).toBe(2);

		// An older run cannot reclaim the output.
		const reclaimed = negotiateChannelContribution(HOST, replaced.state, controller(1), CONTEXT);
		expect(reclaimed.kind === 'rejected' && reclaimed.reason).toBe('stale-run-epoch');
		expect(reclaimed.state).toBe(replaced.state);

		// A different invocation at a strictly newer epoch takes the same exclusive
		// property scope over: one resolved controller per output, replaced in order.
		const handoff = negotiateChannelContribution(
			HOST,
			replaced.state,
			contribution({
				propertyId: 'controller',
				value: { kind: 'identifier', value: 'follow' },
				invocationId: 'invocation-2',
				runEpoch: 3,
				camera: true,
				computedFrom: null
			}),
			CONTEXT
		);
		expect(handoff.kind).toBe('accepted');
		if (handoff.kind !== 'accepted') return;
		expect(handoff.contribution.value).toEqual({ kind: 'identifier', value: 'follow' });
		expect(handoff.replaced[0]!.invocationId).toBe('invocation-1');
	});

	it('refuses a contribution computed from a superseded revision or generation', () => {
		const staleRevision = negotiateChannelContribution(
			HOST,
			EMPTY_CHANNEL_STATE,
			contribution({
				propertyId: 'cut-height',
				value: { kind: 'number', value: 1.2 },
				computedFrom: { contentRevision: 'sha256-old', generationId: 'generation-3' }
			}),
			CONTEXT
		);
		expect(staleRevision.kind === 'rejected' && staleRevision.reason).toBe('stale-contribution');

		const staleGeneration = negotiateChannelContribution(
			HOST,
			EMPTY_CHANNEL_STATE,
			contribution({
				propertyId: 'cut-height',
				value: { kind: 'number', value: 1.2 },
				computedFrom: { contentRevision: 'sha256-source-7', generationId: 'generation-2' }
			}),
			CONTEXT
		);
		expect(staleGeneration.kind === 'rejected' && staleGeneration.reason).toBe('stale-contribution');

		const unproven = negotiateChannelContribution(
			HOST,
			EMPTY_CHANNEL_STATE,
			contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.2 }, computedFrom: null }),
			CONTEXT
		);
		expect(unproven.kind === 'rejected' && unproven.reason).toBe('stale-contribution');
	});

	it('keys a property scope by frame and scope instance, so neither is a false conflict', () => {
		const world = contribution({ propertyId: 'cut-height', value: { kind: 'number', value: 1.2 } });
		const otherFrame = contribution({
			propertyId: 'cut-height',
			value: { kind: 'number', value: 1.4 },
			address: planAddress('cut-height', {
				frame: { version: 1, kind: 'owner-frame', owner: 'layout', frameId: 'floor-2-frame', revision: 'r1' }
			})
		});
		const both = accept(accept(EMPTY_CHANNEL_STATE, world), otherFrame);
		expect(both.contributions).toHaveLength(2);

		const otherViewport = contribution({
			propertyId: 'cut-height',
			value: { kind: 'number', value: 1.8 },
			scopeId: 'viewport-2'
		});
		// A second viewport is a distinct output, not another writer to the first.
		expect(accept(both, otherViewport).contributions).toHaveLength(3);
	});

	it('keeps a level or revision qualification distinct instead of merging two addresses', () => {
		const at = (overrides: Partial<SemanticReference>, invocationId: string, runEpoch: number): Record<string, unknown> =>
			contribution({
				propertyId: 'cut-height',
				value: { kind: 'number', value: 1.2 },
				address: planAddress('cut-height', { ownerReference: { ...ownerReference(), ...overrides } }),
				invocationId,
				runEpoch
			});
		const level = (levelId: string): SemanticReference['location'] => ({
			kind: 'layout-location',
			levelId,
			structureInstancePath: []
		});

		// Two levels are two addresses: the second is not a competing exclusive writer to the first.
		const bothLevels = accept(
			accept(EMPTY_CHANNEL_STATE, at({ location: level('floor-1') }, 'invocation-1', 1)),
			at({ location: level('floor-2') }, 'invocation-2', 2)
		);
		expect(bothLevels.contributions).toHaveLength(2);

		// So is another revision context: an address identifies meaning, not a location or a label.
		const withRevision = accept(bothLevels, at({ revision: { kind: 'exact', contentRevision: 'sha256-other' } }, 'invocation-3', 3));
		expect(withRevision.contributions).toHaveLength(3);

		// The same complete address is still one scope, and still contends exclusively.
		const competing = negotiateChannelContribution(
			HOST,
			withRevision,
			at({ location: level('floor-1') }, 'invocation-9', 9),
			CONTEXT
		);
		expect(competing.kind === 'rejected' && competing.reason).toBe('competing-exclusive-contribution');
		expect(competing.kind === 'rejected' && competing.diagnostics.owners).toEqual(['invocation-1', 'invocation-9']);
	});
});

function held(outputId: string, runEpoch: number): CameraOutputTicket {
	return { outputId, sourceRevision: 'sha256-source-7', sessionEpoch: 'session-1', ownerId: 'owner-a', runEpoch };
}

describe('F.3 inspection-v1 — Camera output ticket protocol', () => {
	it('validates ticket shapes strictly', () => {
		expect(validateCameraOutputTicket(held('output-1', 0)).valid).toBe(true);
		expect(validateCameraOutputTicket({ ...held('output-1', 0), extra: 1 }).valid).toBe(false);
		expect(validateCameraOutputTicket({ ...held('output-1', 0), outputId: '' }).valid).toBe(false);
		expect(validateCameraOutputTicket({ ...held('output-1', 0), runEpoch: -1 }).valid).toBe(false);
		expect(validateCameraOutputTicket({ ...held('output-1', 0), runEpoch: 0.5 }).valid).toBe(false);
		expect(validateCameraOutputTicket('output-1').valid).toBe(false);
	});

	it('acquires one exclusive owner per viewport and refuses a competing exclusive request', () => {
		const state = createCameraOutputState('viewport-1');
		const acquired = acquireCameraOutput(state, {
			ticket: held('output-1', 0),
			role: 'inspection',
			expected: { kind: 'unowned' },
			policy: 'exclusive'
		});
		expect(acquired.kind).toBe('acquired');
		if (acquired.kind !== 'acquired') return;
		expect(acquired.state.claim?.ticket.ownerId).toBe('owner-a');

		const competing = acquireCameraOutput(acquired.state, {
			ticket: { ...held('output-1', 1), ownerId: 'owner-b' },
			role: 'inspection',
			expected: { kind: 'held', ticket: held('output-1', 0) },
			policy: 'exclusive'
		});
		expect(competing.kind).toBe('refused');
		if (competing.kind !== 'refused') return;
		expect(competing.reason).toBe('competing-exclusive-owner');
		expect(competing.owners).toEqual(['owner-a']);
		expect(competing.state).toBe(acquired.state);

		const unsupported = acquireCameraOutput(state, {
			ticket: held('output-1', 0),
			role: 'orbit' as never,
			expected: { kind: 'unowned' },
			policy: 'exclusive'
		});
		expect(unsupported.kind === 'refused' && unsupported.reason).toBe('unsupported-role');
	});

	it('never lets a stale observation, session or source revision take the output', () => {
		const state = createCameraOutputState('viewport-1');
		const first = acquireCameraOutput(state, {
			ticket: held('output-1', 3),
			role: 'inspection',
			expected: { kind: 'unowned' },
			policy: 'exclusive'
		});
		if (first.kind !== 'acquired') throw new Error('the fixture must acquire');

		const staleObservation = acquireCameraOutput(first.state, {
			ticket: held('output-1', 4),
			role: 'inspection',
			expected: { kind: 'unowned' },
			policy: 'ordered-replacement'
		});
		expect(staleObservation.kind === 'refused' && staleObservation.reason).toBe('output-mismatch');

		const staleSession = acquireCameraOutput(first.state, {
			ticket: { ...held('output-1', 4), sessionEpoch: 'session-2' },
			role: 'inspection',
			expected: { kind: 'held', ticket: held('output-1', 3) },
			policy: 'ordered-replacement'
		});
		expect(staleSession.kind === 'refused' && staleSession.reason).toBe('stale-session-epoch');

		const staleSource = acquireCameraOutput(first.state, {
			ticket: { ...held('output-1', 4), sourceRevision: 'sha256-other' },
			role: 'inspection',
			expected: { kind: 'held', ticket: held('output-1', 3) },
			policy: 'ordered-replacement'
		});
		expect(staleSource.kind === 'refused' && staleSource.reason).toBe('stale-source-revision');

		const olderRun = acquireCameraOutput(first.state, {
			ticket: held('output-1', 2),
			role: 'inspection',
			expected: { kind: 'held', ticket: held('output-1', 3) },
			policy: 'ordered-replacement'
		});
		expect(olderRun.kind === 'refused' && olderRun.reason).toBe('stale-run-epoch');
		expect(olderRun.state.claim?.ticket.runEpoch).toBe(3);
	});

	it('hands off in order, validates the return context and returns to the replaced run', () => {
		const first = acquireCameraOutput(createCameraOutputState('viewport-1'), {
			ticket: held('output-1', 1),
			role: 'inspection',
			expected: { kind: 'unowned' },
			policy: 'exclusive'
		});
		if (first.kind !== 'acquired') throw new Error('the fixture must acquire');

		const handoff = replaceCameraOutput(first.state, {
			ticket: { ...held('output-1', 2), ownerId: 'owner-b' },
			role: 'preview',
			expected: { kind: 'held', ticket: held('output-1', 1) },
			returnToken: 'return-1'
		});
		expect(handoff.kind).toBe('acquired');
		if (handoff.kind !== 'acquired') return;
		expect(handoff.replaced?.ticket.runEpoch).toBe(1);
		expect(handoff.claim.returnContext?.token).toBe('return-1');

		const wrongToken = returnCameraOutput(handoff.state, handoff.claim.ticket, 'return-old');
		expect(wrongToken.kind === 'refused' && wrongToken.reason).toBe('invalid-return-token');

		const foreign = returnCameraOutput(handoff.state, held('output-1', 1), 'return-1');
		expect(foreign.kind === 'refused' && foreign.reason).toBe('not-owner');

		const returned = returnCameraOutput(handoff.state, handoff.claim.ticket, 'return-1');
		expect(returned.kind).toBe('returned');
		if (returned.kind !== 'returned') return;
		// The restored run keeps its identity and role, and continues under a strictly newer epoch:
		// ownership order never moves backwards.
		expect(returned.claim.ticket.ownerId).toBe('owner-a');
		expect(returned.claim.ticket.runEpoch).toBe(3);
		expect(returned.claim.role).toBe('inspection');
		expect(returned.state.claim?.returnContext).toBeNull();

		// A return without a handoff that issued one cannot transfer anything.
		expect(returnCameraOutput(first.state, first.claim.ticket, 'return-1').kind).toBe('refused');
	});

	it('keeps ownership order monotonic across a return, so no spent ticket re-enters', () => {
		// Owner A holds epoch 1; owner B replaces it at epoch 2 and then returns control to A.
		const a = acquireCameraOutput(createCameraOutputState('viewport-1'), {
			ticket: held('output-1', 1),
			role: 'guided-navigation',
			expected: { kind: 'unowned' },
			policy: 'exclusive'
		});
		if (a.kind !== 'acquired') throw new Error('the fixture must acquire');
		const b = replaceCameraOutput(a.state, {
			ticket: { ...held('output-1', 2), ownerId: 'owner-b' },
			role: 'preview',
			expected: { kind: 'held', ticket: held('output-1', 1) },
			returnToken: 'return-1'
		});
		if (b.kind !== 'acquired') throw new Error('the fixture must hand off');
		const restored = returnCameraOutput(b.state, b.claim.ticket, 'return-1');
		if (restored.kind !== 'returned') throw new Error('the fixture must return');
		expect(restored.claim.ticket.runEpoch).toBe(3);

		// B's spent epoch-2 ticket cannot take the output back after handing it over.
		const replay = acquireCameraOutput(restored.state, {
			ticket: b.claim.ticket,
			role: 'preview',
			expected: { kind: 'held', ticket: restored.claim.ticket },
			policy: 'ordered-replacement'
		});
		expect(replay.kind).toBe('refused');
		if (replay.kind !== 'refused') return;
		expect(replay.reason).toBe('stale-run-epoch');
		expect(replay.state.claim?.ticket.runEpoch).toBe(3);

		// A's original epoch-1 ticket is spent too: the restored claim is the live ownership.
		const older = requestCameraOutput(restored.state, a.claim.ticket);
		expect(older.kind).toBe('superseded');
		if (older.kind !== 'superseded') return;
		expect(older.holder.runEpoch).toBe(3);

		// B may take the output again only as a genuinely newer accepted run.
		const newer = acquireCameraOutput(restored.state, {
			ticket: { ...held('output-1', 4), ownerId: 'owner-b' },
			role: 'preview',
			expected: { kind: 'held', ticket: restored.claim.ticket },
			policy: 'ordered-replacement'
		});
		expect(newer.kind).toBe('acquired');
	});

	it('answers a superseded run and refuses a foreign owner', () => {
		const first = acquireCameraOutput(createCameraOutputState('viewport-1'), {
			ticket: held('output-1', 2),
			role: 'guided-navigation',
			expected: { kind: 'unowned' },
			policy: 'exclusive'
		});
		if (first.kind !== 'acquired') throw new Error('the fixture must acquire');

		expect(requestCameraOutput(first.state, held('output-1', 2)).kind).toBe('accepted');
		const superseded = requestCameraOutput(first.state, held('output-1', 1));
		expect(superseded.kind).toBe('superseded');
		if (superseded.kind !== 'superseded') return;
		expect(superseded.holder.runEpoch).toBe(2);

		const foreign = requestCameraOutput(first.state, { ...held('output-1', 2), ownerId: 'owner-b' });
		expect(foreign.kind === 'refused' && foreign.reason).toBe('not-owner');
		expect(requestCameraOutput(createCameraOutputState('viewport-1'), held('output-1', 0)).kind).toBe('refused');
	});

	it('makes cancellation epoch-qualified and idempotent', () => {
		const first = acquireCameraOutput(createCameraOutputState('viewport-1'), {
			ticket: held('output-1', 1),
			role: 'inspection',
			expected: { kind: 'unowned' },
			policy: 'exclusive'
		});
		if (first.kind !== 'acquired') throw new Error('the fixture must acquire');
		const handoff = acquireCameraOutput(first.state, {
			ticket: { ...held('output-1', 2), ownerId: 'owner-b' },
			role: 'follow',
			expected: { kind: 'held', ticket: held('output-1', 1) },
			policy: 'ordered-replacement'
		});
		if (handoff.kind !== 'acquired') throw new Error('the fixture must hand off');

		// A wrong-epoch completion cannot clear the active output.
		const stale = cancelCameraOutput(handoff.state, held('output-1', 1));
		expect(stale.kind).toBe('ignored');
		if (stale.kind !== 'ignored') return;
		expect(stale.reason).toBe('stale-run-epoch');
		expect(stale.state).toBe(handoff.state);

		// A foreign owner at the active epoch is not the owner either.
		const foreign = cancelCameraOutput(handoff.state, { ...held('output-1', 2), ownerId: 'owner-c' });
		expect(foreign.kind === 'ignored' && foreign.reason).toBe('not-owner');

		// The complete ticket identifies the holder: a completion from another host session or
		// another source revision cannot clear this output, even at the same owner and epoch.
		const foreignSession = cancelCameraOutput(handoff.state, {
			...held('output-1', 2),
			ownerId: 'owner-b',
			sessionEpoch: 'session-2'
		});
		expect(foreignSession.kind).toBe('ignored');
		if (foreignSession.kind !== 'ignored') return;
		expect(foreignSession.reason).toBe('not-owner');
		expect(foreignSession.state).toBe(handoff.state);
		const foreignSource = cancelCameraOutput(handoff.state, {
			...held('output-1', 2),
			ownerId: 'owner-b',
			sourceRevision: 'sha256-other'
		});
		expect(foreignSource.kind === 'ignored' && foreignSource.reason).toBe('not-owner');

		const cancelled = cancelCameraOutput(handoff.state, handoff.claim.ticket);
		expect(cancelled.kind).toBe('cancelled');
		if (cancelled.kind !== 'cancelled') return;
		expect(cancelled.state.claim).toBeNull();

		// Idempotent: cancelling an unowned or already-cancelled output is a no-op.
		expect(cancelCameraOutput(cancelled.state, handoff.claim.ticket).kind).toBe('cancelled');
		expect(cancelCameraOutput(createCameraOutputState('viewport-1'), held('output-1', 1)).kind).toBe('cancelled');

		// Cancellation is not re-entry: the cancelled run's epoch is spent, and only a strictly
		// newer accepted run may take the freed output.
		const reacquireOld = acquireCameraOutput(cancelled.state, {
			ticket: handoff.claim.ticket,
			role: 'follow',
			expected: { kind: 'unowned' },
			policy: 'ordered-replacement'
		});
		expect(reacquireOld.kind).toBe('refused');
		if (reacquireOld.kind !== 'refused') return;
		expect(reacquireOld.reason).toBe('stale-run-epoch');
		expect(reacquireOld.state).toBe(cancelled.state);
		const reacquired = acquireCameraOutput(cancelled.state, {
			ticket: { ...held('output-1', 3), ownerId: 'owner-b' },
			role: 'follow',
			expected: { kind: 'unowned' },
			policy: 'ordered-replacement'
		});
		expect(reacquired.kind).toBe('acquired');
	});

	it('keeps every decision pure: no state is mutated in place', () => {
		const state: CameraOutputState = createCameraOutputState('viewport-1');
		const snapshot = JSON.stringify(state);
		acquireCameraOutput(state, {
			ticket: held('output-1', 0),
			role: 'inspection',
			expected: { kind: 'unowned' },
			policy: 'exclusive'
		});
		expect(JSON.stringify(state)).toBe(snapshot);
	});
});
