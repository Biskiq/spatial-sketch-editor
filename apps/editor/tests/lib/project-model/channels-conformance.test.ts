/**
 * F.3 `inspection-v1` conformance — the T1.P01.S01 provider for `F3.channels@1`.
 *
 * AM-3's required conformance set: finite default/depth absence, invalid
 * units/frame/range, unknown required versus optional-unsupported families,
 * conflict, replacement and stale cleanup. The S01 acceptance rows add the
 * Layout ordinary Plan value family and the Camera session inspection family.
 *
 * Negotiation is exercised against a **real** F.1 read context — the bounded
 * current-domain adapters over a project built from the package's own boot — so
 * every owner reference is qualified the way a consumer's will be. The traces
 * here are chosen to discriminate the ownership invariants rather than restate
 * implementation outputs: distinct references to one subject contend for one
 * scope; union contributors keep their own identity, order and provenance; a
 * stale completion never deletes or revives anything; and Camera session values
 * belong to whichever run the Camera-output protocol says holds the output.
 *
 * The ticket protocol itself is proved in `camera-output-conformance.test.ts`.
 * Runtime-safe import closure is proved by `tests/lib/project-model-boundary.test.ts`
 * (arch lane). No Stage, evaluator, controller or projection exists here.
 */
import { describe, expect, it } from 'vitest';

import {
	CAMERA_OUTPUT_ROLES,
	CAMERA_SESSION_INSPECTION_FAMILY,
	DEFAULT_CHANNEL_FAMILIES,
	EMPTY_CHANNEL_STATE,
	LAYOUT_PLAN_FAMILY,
	acquireCameraOutput,
	channelFamilySatisfaction,
	compareReferences,
	createCameraOutputState,
	createChannelHost,
	createEmptyWallFirstLayoutDocument,
	declaredProperty,
	familyProblems,
	negotiateChannelContribution,
	pruneChannelState,
	readChannelProperty,
	rebaseCameraOutputSource,
	replaceCameraOutput,
	resolveChannelPropertyScope,
	returnCameraOutput,
	validateChannelAddress,
	validateChannelContribution,
	validateChannelDescriptor,
	validateChannelValue,
	withdrawChannelContribution,
	type CameraOutputState,
	type ChannelAddress,
	type ChannelEvaluationContext,
	type ChannelFamily,
	type ChannelNegotiationOutcome,
	type ChannelPropertyScope,
	type ChannelState,
	type DependencyLockReader,
	type SemanticReference,
	type SnapshotIdentity
} from '@portfolio/project-model';
import { createUnitReadContext } from '@portfolio/project-model/references/unit-resolution';
import { createUnitProject } from '../authoring/__fixtures__/unit-envelope-fixtures';

/** A real F.2 envelope with one authored floor and one Camera view. */
const DOCUMENT = await createUnitProject({
	id: 'project-1',
	name: 'Fixture',
	layout: (() => {
		const layout = createEmptyWallFirstLayoutDocument();
		layout.floor = { id: 'floor-2', name: 'First floor', elevation: 3 };
		layout.junctions = [
			{ id: 'junction-1', point: [0, 0] },
			{ id: 'junction-2', point: [5, 0] },
			{ id: 'junction-3', point: [5, 4] }
		];
		layout.walls = [
			{ id: 'wall-1', startJunctionId: 'junction-1', endJunctionId: 'junction-2', thickness: 0.2, height: 3, centerline: { kind: 'line' } },
			{ id: 'wall-2', startJunctionId: 'junction-2', endJunctionId: 'junction-3', thickness: 0.1, height: 3, centerline: { kind: 'line' } }
		];
		return layout;
	})(),
	camera: {
		formatVersion: 1,
		views: [{ id: 'view-1', label: 'Entry', eye: [0, 1.6, 2], target: [0, 1.4, 0], fov: 54, connectedViewIds: [] }],
		connections: []
	}
});

/** The owning unit revision every exact owner reference names. */
const CONTENT = DOCUMENT.units.layout.header.contentRevision;
const CAMERA_CONTENT = DOCUMENT.units.camera.header.contentRevision;
const SNAPSHOT: SnapshotIdentity = { acceptedRevision: { projectId: 'project-1', revisionId: 'revision-7' }, sourceContentId: CONTENT };

type ContextOptions = {
	snapshot?: SnapshotIdentity;
	generationId?: string | null;
	lock?: DependencyLockReader | null;
	outputs?: readonly CameraOutputState[];
};

/** The F.1 read context over the envelope, plus the live Camera outputs. */
function context(options: ContextOptions = {}): ChannelEvaluationContext {
	const snapshot = options.snapshot ?? SNAPSHOT;
	return {
		read: {
			...createUnitReadContext({
				envelope: DOCUMENT,
				acceptedRevision: snapshot.acceptedRevision,
				sourceContentId: snapshot.sourceContentId,
				sessionEpoch: 'session-1',
				generationId: options.generationId === undefined ? 'generation-3' : options.generationId,
				lock: options.lock ?? null
			}),
			snapshot
		},
		cameraOutputs: options.outputs ?? []
	};
}

const CONTEXT = context();
const HOST = createChannelHost();

/** The one current Layout level, addressed `exact` at the project root. */
function levelReference(overrides: Partial<SemanticReference> = {}): SemanticReference {
	return {
		version: 1,
		domain: 'layout',
		revision: { kind: 'exact', contentRevision: CONTENT },
		subject: { kind: 'level', id: 'floor-2' },
		instancePath: [],
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null,
		...overrides
	};
}

/** The Camera unit's one view: the owner of a session output's values. */
const CAMERA_ROOT: SemanticReference = {
	...levelReference(),
	domain: 'camera',
	revision: { kind: 'exact', contentRevision: CAMERA_CONTENT },
	subject: { kind: 'view', id: 'view-1' }
};

function address(propertyId: string, overrides: Partial<ChannelAddress> = {}): ChannelAddress {
	return {
		version: 1,
		ownerReference: levelReference(),
		instancePath: [],
		componentId: null,
		capabilityId: null,
		propertyId,
		frame: { version: 1, kind: 'project-world' },
		...overrides
	};
}

type ContributionOptions = {
	propertyId: string;
	value: Record<string, unknown>;
	scopeId?: string;
	invocationId?: string;
	runEpoch?: number;
	address?: ChannelAddress;
	descriptor?: Record<string, unknown>;
	computedFrom?: { contentRevision: string | null; generationId: string | null };
	family?: ChannelFamily;
};

/** A raw (untrusted) contribution to a declared property. */
function contribution(options: ContributionOptions): Record<string, unknown> {
	const family = options.family ?? LAYOUT_PLAN_FAMILY;
	const declared = declaredProperty(family, options.propertyId);
	if (declared === null) throw new Error(`the fixture asked for an undeclared property "${options.propertyId}"`);
	const camera = family.domain === 'camera';
	return {
		version: 1,
		descriptor: options.descriptor ?? declared,
		address: options.address ?? address(options.propertyId, camera ? { ownerReference: CAMERA_ROOT } : {}),
		value: options.value,
		scopeId: options.scopeId ?? (camera ? 'output-1' : 'viewport-1'),
		invocationId: options.invocationId ?? 'invocation-1',
		runEpoch: options.runEpoch ?? 1,
		computedFrom: options.computedFrom ?? { contentRevision: CONTENT, generationId: 'generation-3' }
	};
}

function negotiate(state: ChannelState, input: unknown, ctx: ChannelEvaluationContext = CONTEXT): ChannelNegotiationOutcome {
	return negotiateChannelContribution(HOST, state, input, ctx);
}

function accepted(outcome: ChannelNegotiationOutcome): Extract<ChannelNegotiationOutcome, { kind: 'accepted' }> {
	if (outcome.kind !== 'accepted') throw new Error(`expected acceptance, got ${JSON.stringify(outcome.kind === 'rejected' ? outcome.reason : outcome.kind)}`);
	return outcome;
}

function reason(outcome: ChannelNegotiationOutcome): string {
	return outcome.kind === 'rejected' ? outcome.reason : outcome.kind;
}

function scopeOf(propertyId: string, scopeId = 'viewport-1', family: ChannelFamily = LAYOUT_PLAN_FAMILY): ChannelPropertyScope {
	const resolved = resolveChannelPropertyScope(
		family,
		address(propertyId, family.domain === 'camera' ? { ownerReference: CAMERA_ROOT } : {}),
		scopeId,
		CONTEXT
	);
	if (resolved.kind !== 'resolved') throw new Error(resolved.message);
	return resolved.scope;
}

const number = (value: number) => ({ kind: 'number', value });
const walls = (...ids: string[]) => ({
	kind: 'source-set',
	value: ids.map((id) => ({ domain: 'layout', subject: { kind: 'wall', id }, instancePath: [] }))
});

describe('F.3 inspection-v1 — families, descriptors and addresses', () => {
	it('declares the two admitted v1 families without structural problems', () => {
		expect(familyProblems(DEFAULT_CHANNEL_FAMILIES)).toEqual([]);
		expect(HOST.problems).toEqual([]);
		expect(DEFAULT_CHANNEL_FAMILIES.map((family) => family.id)).toEqual(['layout.plan@1', 'camera.session-inspection@1']);
		expect(familyProblems([{ ...LAYOUT_PLAN_FAMILY, id: 'layout.broken@1', requiredProperties: ['missing-property'] }]).join('\n')).toContain(
			'required property "missing-property" is not declared'
		);
		expect(familyProblems([LAYOUT_PLAN_FAMILY, LAYOUT_PLAN_FAMILY]).join('\n')).toContain('declared more than once');
	});

	it('declares the Camera session family as claim-owned output values with no generic interpolation', () => {
		expect(CAMERA_SESSION_INSPECTION_FAMILY.properties.map((property) => property.propertyId)).toEqual([
			'target',
			'azimuth',
			'elevation',
			'frame-height',
			'controller',
			'reading-projection-policy',
			'motion-policy'
		]);
		for (const property of CAMERA_SESSION_INSPECTION_FAMILY.properties) {
			// AM-3: Camera evaluates pose/projection; no generic pose/FOV interpolation.
			expect([property.propertyId, property.interpolation, property.arbitration, property.scope]).toEqual([
				property.propertyId,
				'none',
				'camera-output',
				'output'
			]);
		}
		expect(declaredProperty(CAMERA_SESSION_INSPECTION_FAMILY, 'controller')!.values).toEqual([...CAMERA_OUTPUT_ROLES]);
		expect(CAMERA_SESSION_INSPECTION_FAMILY.requiredProperties).toEqual(['controller']);
		// Policies are open, Camera-owned sets and optional: absence means Camera's declared default.
		expect(declaredProperty(CAMERA_SESSION_INSPECTION_FAMILY, 'motion-policy')!.values).toBeNull();

		// A Camera family that declares generic interpolation, or a claim-owned value outside
		// Camera's output scope, is a declaration defect rather than a runtime state.
		const lerped = {
			...CAMERA_SESSION_INSPECTION_FAMILY,
			properties: CAMERA_SESSION_INSPECTION_FAMILY.properties.map((property) => ({ ...property, interpolation: 'linear' as const }))
		};
		expect(familyProblems([lerped]).join('\n')).toContain('may not declare generic interpolation');
		const misplaced = {
			...LAYOUT_PLAN_FAMILY,
			id: 'layout.misplaced@1',
			properties: LAYOUT_PLAN_FAMILY.properties.map((property) => ({ ...property, arbitration: 'camera-output' as const }))
		};
		expect(familyProblems([misplaced]).join('\n')).toContain('must be a Camera output-scoped property');
	});

	it('rejects a descriptor whose units, range or vocabulary contradict its value kind', () => {
		const depth = declaredProperty(LAYOUT_PLAN_FAMILY, 'depth')!;
		expect(validateChannelDescriptor(depth).success).toBe(true);
		expect(validateChannelDescriptor({ ...depth, version: 2 }).success).toBe(false);
		expect(validateChannelDescriptor({ ...depth, range: { min: 5, max: 1, minExclusive: false, maxExclusive: false } }).success).toBe(false);
		const reveal = declaredProperty(LAYOUT_PLAN_FAMILY, 'reveal')!;
		expect(validateChannelDescriptor({ ...reveal, units: 'meters' }).success).toBe(false);
		expect(validateChannelDescriptor({ ...reveal, range: { min: 0, max: null, minExclusive: false, maxExclusive: false } }).success).toBe(false);
		expect(validateChannelDescriptor({ ...depth, valueKind: 'text' as never }).success).toBe(false);
		expect(validateChannelDescriptor({ ...depth, values: ['only-identifiers'] }).success).toBe(false);
		expect(validateChannelDescriptor({ ...depth, extra: true }).success).toBe(false);
	});

	it('reads an address field by field and never parses a delimiter string', () => {
		const value = address('cut-height', { instancePath: ['a', 'b'] });
		const result = validateChannelAddress({ ...value, ownerReference: levelReference({ subject: { kind: 'level', id: 'level:a/b' } }) });
		expect(result.success).toBe(true);
		if (!result.success) return;
		expect(result.value.ownerReference.subject.id).toBe('level:a/b');
		expect(result.value.instancePath).toEqual(['a', 'b']);
		expect(validateChannelAddress({ ...value, frame: undefined }).success).toBe(false);
		expect(validateChannelAddress({ ...value, frame: { version: 1, kind: 'room-frame', roomId: 'r' } }).success).toBe(false);
		expect(validateChannelAddress({ ...value, propertyId: '' }).success).toBe(false);
		expect(validateChannelAddress({ ...value, capabilityId: 'a b' }).success).toBe(false);
		expect(validateChannelAddress({ ...value, extra: 1 }).success).toBe(false);
	});
});

describe('F.3 inspection-v1 — values', () => {
	it('requires the value kind, units and finite domain of the declared property', () => {
		const cut = declaredProperty(LAYOUT_PLAN_FAMILY, 'cut-height')!;
		expect(validateChannelValue(number(1.2), cut).success).toBe(true);
		expect(validateChannelValue(number(Number.NaN), cut).success).toBe(false);
		expect(validateChannelValue(number(Number.POSITIVE_INFINITY), cut).success).toBe(false);
		expect(validateChannelValue({ kind: 'identifier', value: 'plan' }, cut).success).toBe(false);
		expect(validateChannelValue({ kind: 'number', value: 1.2, units: 'meters' }, cut).success).toBe(false);
		const depth = declaredProperty(LAYOUT_PLAN_FAMILY, 'depth')!;
		const zero = validateChannelValue(number(0), depth);
		expect([zero.success, zero.rangeViolation]).toEqual([false, true]);
		expect(validateChannelValue(number(-4), depth).success).toBe(false);

		const height = declaredProperty(CAMERA_SESSION_INSPECTION_FAMILY, 'frame-height')!;
		expect(validateChannelValue(number(2.4), height).success).toBe(true);
		expect(validateChannelValue(number(0), height).success).toBe(false);
		const target = declaredProperty(CAMERA_SESSION_INSPECTION_FAMILY, 'target')!;
		expect(validateChannelValue({ kind: 'vector3', value: [1, Number.NaN, 3] }, target).success).toBe(false);
		expect(validateChannelValue({ kind: 'vector3', value: [1, 2] }, target).success).toBe(false);
		const controller = declaredProperty(CAMERA_SESSION_INSPECTION_FAMILY, 'controller')!;
		expect(validateChannelValue({ kind: 'identifier', value: 'orbit' }, controller).success).toBe(false);
	});

	it('detects repeated source identities structurally, so delimiter characters never collide', () => {
		const reveal = declaredProperty(LAYOUT_PLAN_FAMILY, 'reveal')!;
		const identity = (instancePath: readonly string[], id = 'wall-1') => ({ domain: 'layout', subject: { kind: 'wall', id }, instancePath });
		expect(validateChannelValue({ kind: 'source-set', value: [identity([]), identity([])] }, reveal).success).toBe(false);
		// Each pair below joins to the same string under any single-delimiter encoding, yet
		// names two distinct opaque id paths, and every id here is a valid opaque id.
		const pairs: Array<[readonly string[], readonly string[]]> = [
			[['a\u0001b'], ['a', 'b']],
			[['a/b'], ['a', 'b']],
			[['a', 'b\u0001c'], ['a\u0001b', 'c']],
			[['"x","y"'], ['x', 'y']]
		];
		for (const [left, right] of pairs) {
			const result = validateChannelValue({ kind: 'source-set', value: [identity(left), identity(right)] }, reveal);
			expect(result.success, JSON.stringify([left, right])).toBe(true);
		}
		// A subject id containing the delimiter is also its own identity.
		expect(validateChannelValue({ kind: 'source-set', value: [identity([], 'w\u00011'), identity(['1'], 'w')] }, reveal).success).toBe(true);
		const filter = declaredProperty(LAYOUT_PLAN_FAMILY, 'source-kind-filter')!;
		expect(validateChannelValue({ kind: 'identifier-set', value: ['wall', 'wall'] }, filter).success).toBe(false);
	});

	it('rejects an unknown required family and reports an optional one as unavailable', () => {
		const required = contribution({ propertyId: 'cut-height', value: number(1.2) });
		required.descriptor = { ...(required.descriptor as object), family: 'layout.unknown@9', capability: { id: 'layout.unknown', required: true } };
		expect(reason(negotiate(EMPTY_CHANNEL_STATE, required))).toBe('unsupported-required-family');

		const optional = contribution({ propertyId: 'cut-height', value: number(1.2) });
		optional.descriptor = { ...(optional.descriptor as object), family: 'layout.optional@1', capability: { id: 'layout.optional', required: false } };
		const unavailable = negotiate(EMPTY_CHANNEL_STATE, optional);
		expect(unavailable.kind === 'unavailable' && unavailable.family).toBe('layout.optional@1');
		expect(unavailable.state).toBe(EMPTY_CHANNEL_STATE);
	});

	it('rejects a malformed contribution and one that redefines a declared property', () => {
		const valid = contribution({ propertyId: 'depth', value: number(100) });
		expect(validateChannelContribution(valid, { admittedFamilies: HOST.families.map((family) => family.id) }).success).toBe(true);
		expect(validateChannelContribution({ ...valid, extra: 1 }).success).toBe(false);
		expect(validateChannelContribution({ ...valid, runEpoch: -1 }).success).toBe(false);
		expect(validateChannelContribution({ ...valid, computedFrom: undefined }).success).toBe(false);
		expect(reason(negotiate(EMPTY_CHANNEL_STATE, { ...valid, address: address('cut-height') }))).toBe('invalid-contribution');
		const redefined = contribution({ propertyId: 'depth', value: number(100) });
		redefined.descriptor = { ...(redefined.descriptor as object), units: 'radians' };
		expect(reason(negotiate(EMPTY_CHANNEL_STATE, redefined))).toBe('descriptor-mismatch');
		const sceneOwned = contribution({
			propertyId: 'cut-height',
			value: number(1.2),
			address: address('cut-height', { ownerReference: { ...levelReference(), domain: 'scene', subject: { kind: 'scene', id: 'project-1' } } })
		});
		expect(reason(negotiate(EMPTY_CHANNEL_STATE, sceneOwned))).toBe('domain-mismatch');
	});
});

describe('F.3 inspection-v1 — owner qualification and the contention boundary', () => {
	const lock: DependencyLockReader = { projectId: 'project-1', contentRevisionFor: () => CONTENT };
	const levelLocated = levelReference({ location: { kind: 'layout-location', levelId: 'floor-2', structureInstancePath: [] } });
	const locked = levelReference({ revision: { kind: 'project-lock', projectId: 'project-1' } });

	it('makes distinct valid references to one canonical subject contend for one property', () => {
		// Three valid, mutually distinct F.1 references to the one current level.
		expect(compareReferences(levelReference(), levelLocated)).not.toBe(0);
		expect(compareReferences(levelReference(), locked)).not.toBe(0);

		const ctx = context({ lock });
		const first = accepted(negotiate(EMPTY_CHANNEL_STATE, contribution({ propertyId: 'cut-height', value: number(1.2) }), ctx));
		for (const [ownerReference, invocationId] of [
			[levelLocated, 'invocation-2'],
			[locked, 'invocation-3']
		] as const) {
			const competing = negotiate(
				first.state,
				contribution({ propertyId: 'cut-height', value: number(2), invocationId, runEpoch: 9, address: address('cut-height', { ownerReference }) }),
				ctx
			);
			// Not a second exclusive holder of the same level's cut height.
			expect(reason(competing)).toBe('competing-exclusive-contribution');
			expect(competing.kind === 'rejected' && competing.diagnostics.owners).toEqual(['invocation-1', invocationId]);
			expect(competing.state).toBe(first.state);
		}
		// And the holder's own replacement may use any of those qualifications.
		const own = negotiate(
			first.state,
			contribution({ propertyId: 'cut-height', value: number(1.4), runEpoch: 2, address: address('cut-height', { ownerReference: locked }) }),
			ctx
		);
		expect(accepted(own).replaced.map((replaced) => replaced.runEpoch)).toEqual([1]);
		expect(accepted(own).scope).toEqual(first.scope);
	});

	it('refuses an owner reference that is stale, unresolved or not the family’s owner', () => {
		const at = (ownerReference: SemanticReference, extra: Partial<ChannelAddress> = {}) =>
			negotiate(EMPTY_CHANNEL_STATE, contribution({ propertyId: 'cut-height', value: number(1.2), address: address('cut-height', { ownerReference, ...extra }) }));
		// An exact reference to other content, and a project-lock with no admitted lock reader.
		expect(reason(at(levelReference({ revision: { kind: 'exact', contentRevision: 'sha256-old' } })))).toBe('unresolved-owner-reference');
		expect(reason(at(locked))).toBe('unresolved-owner-reference');
		// A level the current single-level Layout does not author.
		expect(reason(at(levelReference({ subject: { kind: 'level', id: 'floor-9' } })))).toBe('unresolved-owner-reference');
		// Plan inspection belongs to a level, not to a wall; and no address qualification is declared.
		expect(reason(at(levelReference({ subject: { kind: 'wall', id: 'wall-1' } })))).toBe('inadmissible-address');
		expect(reason(at(levelReference(), { instancePath: ['x'] }))).toBe('inadmissible-address');
		// An owner frame the owner does not author cannot qualify the value.
		expect(reason(at(levelReference(), { frame: { version: 1, kind: 'owner-frame', owner: 'layout', frameId: 'room-1', revision: 'r1' } }))).toBe(
			'unresolved-frame'
		);
		// The Camera family is project-world only.
		const cameraFrame = contribution({
			family: CAMERA_SESSION_INSPECTION_FAMILY,
			propertyId: 'azimuth',
			value: number(0),
			address: address('azimuth', { ownerReference: CAMERA_ROOT, frame: { version: 1, kind: 'owner-frame', owner: 'camera', frameId: 'f', revision: 'r' } })
		});
		expect(reason(negotiate(EMPTY_CHANNEL_STATE, cameraFrame))).toBe('inadmissible-address');
	});

	it('keeps distinct scope instances apart and reads one scope by structure, not by encoding', () => {
		const one = accepted(negotiate(EMPTY_CHANNEL_STATE, contribution({ propertyId: 'cut-height', value: number(1.2) })));
		// A second viewport is a distinct instance, not another writer to the first.
		const two = accepted(negotiate(one.state, contribution({ propertyId: 'cut-height', value: number(1.8), scopeId: 'viewport-2', invocationId: 'invocation-2' })));
		expect(two.state.entries).toHaveLength(2);
		// A structurally equal scope built independently, with its fields in another order, reads the same value.
		const rebuilt = JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(one.scope).reverse()))) as ChannelPropertyScope;
		expect(readChannelProperty(two.state, rebuilt, CONTEXT)).toMatchObject({ kind: 'value', value: number(1.2) });
		expect(readChannelProperty(two.state, scopeOf('cut-height', 'viewport-2'), CONTEXT)).toMatchObject({ value: number(1.8) });
		expect(readChannelProperty(two.state, scopeOf('depth'), CONTEXT).kind).toBe('absent');
	});
});

describe('F.3 inspection-v1 — exclusive ownership, replacement and cleanup', () => {
	it('reports depth absence instead of accepting an unsatisfiable Plan inspection', () => {
		const cut = accepted(negotiate(EMPTY_CHANNEL_STATE, contribution({ propertyId: 'cut-height', value: number(1.2) })));
		expect([cut.satisfied, cut.missingRequiredProperties]).toEqual([false, ['depth']]);
		const depth = accepted(negotiate(cut.state, contribution({ propertyId: 'depth', value: number(100) })));
		expect([depth.satisfied, depth.missingRequiredProperties]).toEqual([true, []]);
		expect(channelFamilySatisfaction(LAYOUT_PLAN_FAMILY, depth.state, scopeOf('reveal'), CONTEXT).satisfied).toBe(true);
	});

	it('refuses a competing exclusive contribution, naming domain, address and owners', () => {
		const first = accepted(negotiate(EMPTY_CHANNEL_STATE, contribution({ propertyId: 'cut-height', value: number(1.2) })));
		const competing = negotiate(first.state, contribution({ propertyId: 'cut-height', value: number(2), invocationId: 'invocation-2', runEpoch: 5 }));
		expect(competing.kind).toBe('rejected');
		if (competing.kind !== 'rejected') return;
		expect(competing.reason).toBe('competing-exclusive-contribution');
		expect([competing.diagnostics.domain, competing.diagnostics.address?.propertyId, competing.diagnostics.owners]).toEqual([
			'layout',
			'cut-height',
			['invocation-1', 'invocation-2']
		]);
		expect(competing.diagnostics.action).not.toBe('');
		expect(competing.state).toBe(first.state);
	});

	it('orders one invocation’s runs: replacement, stale run, same-epoch conflict and idempotence', () => {
		const cut = (value: number, runEpoch: number) => contribution({ propertyId: 'cut-height', value: number(value), runEpoch });
		const first = accepted(negotiate(EMPTY_CHANNEL_STATE, cut(1.2, 1)));
		expect(accepted(negotiate(first.state, cut(1.2, 1)))).toMatchObject({ idempotent: true, state: first.state });
		expect(reason(negotiate(first.state, cut(1.9, 1)))).toBe('same-run-epoch-conflict');
		const replaced = accepted(negotiate(first.state, cut(1.5, 2)));
		expect(replaced.replaced.map((entry) => entry.runEpoch)).toEqual([1]);
		expect(reason(negotiate(replaced.state, cut(1.1, 1)))).toBe('stale-run-epoch');
		// A declared set is its membership: a reordered re-offer is the same value.
		const filter = (members: string[]) => contribution({ propertyId: 'source-kind-filter', value: { kind: 'identifier-set', value: members } });
		const kinds = accepted(negotiate(EMPTY_CHANNEL_STATE, filter(['wall', 'opening'])));
		expect(accepted(negotiate(kinds.state, filter(['opening', 'wall']))).idempotent).toBe(true);
	});

	it('withdraws epoch-qualified: a stale completion neither deletes a newer owner nor revives itself', () => {
		const cut = (invocationId: string, runEpoch: number, value = 1.2) =>
			contribution({ propertyId: 'cut-height', value: number(value), invocationId, runEpoch });
		const scope = scopeOf('cut-height');
		const x5 = accepted(negotiate(accepted(negotiate(EMPTY_CHANNEL_STATE, cut('x', 3))).state, cut('x', 5, 1.3)));

		// A stale cleanup from X's older run removes nothing while X@5 holds.
		const staleCleanup = withdrawChannelContribution(x5.state, { scope, invocationId: 'x', runEpoch: 3 });
		expect(staleCleanup).toMatchObject({ kind: 'ignored', reason: 'stale-run-epoch', state: x5.state });

		const withdrawn = withdrawChannelContribution(x5.state, { scope, invocationId: 'x', runEpoch: 5 });
		expect(withdrawn.kind).toBe('withdrawn');
		const free = withdrawn.state;
		expect(readChannelProperty(free, scope, CONTEXT).kind).toBe('absent');

		// A new owner takes the freed property at its own run epoch.
		const y = accepted(negotiate(free, cut('y', 1, 2)));
		// X's late completions cannot clear Y, and X's spent runs cannot re-enter.
		expect(withdrawChannelContribution(y.state, { scope, invocationId: 'x', runEpoch: 5 })).toMatchObject({ kind: 'absent', state: y.state });
		expect(reason(negotiate(y.state, cut('x', 5, 1.3)))).toBe('competing-exclusive-contribution');
		const yGone = withdrawChannelContribution(y.state, { scope, invocationId: 'y', runEpoch: 1 }).state;
		expect(reason(negotiate(yGone, cut('x', 5, 1.3)))).toBe('stale-run-epoch');
		expect(reason(negotiate(yGone, cut('x', 4)))).toBe('stale-run-epoch');
		expect(accepted(negotiate(yGone, cut('x', 6))).contribution.runEpoch).toBe(6);
	});

	it('expires a contribution when its content or generation changes, without burning its run', () => {
		const x = accepted(negotiate(EMPTY_CHANNEL_STATE, contribution({ propertyId: 'cut-height', value: number(1.2), invocationId: 'x', runEpoch: 4 })));
		const edited: SnapshotIdentity = { acceptedRevision: { projectId: 'project-1', revisionId: 'revision-8' }, sourceContentId: 'sha256-source-8' };
		const next = context({ snapshot: edited });
		const scope = scopeOf('cut-height');
		// The old value is never read under the new content, and pruning drops it.
		expect(readChannelProperty(x.state, scope, next).kind).toBe('absent');
		expect(pruneChannelState(x.state, next).expired.map((entry) => entry.invocationId)).toEqual(['x']);
		// A stale holder does not block a new owner; it expires in that negotiation instead.
		const fresh = (invocationId: string, runEpoch: number) =>
			contribution({
				propertyId: 'cut-height',
				value: number(1.2),
				invocationId,
				runEpoch,
				address: address('cut-height', { ownerReference: levelReference({ revision: { kind: 'exact', contentRevision: CONTENT } }) }),
				computedFrom: { contentRevision: 'sha256-source-8', generationId: 'generation-3' }
			});
		// The same run re-offers its re-evaluated value under the new content.
		const reEvaluated = accepted(negotiate(x.state, fresh('x', 4), next));
		expect([reEvaluated.expired.length, reEvaluated.replaced.length]).toEqual([1, 0]);
		// A contribution computed from superseded content or generation is refused
		// outright; the content check runs before owner qualification.
		expect(reason(negotiate(EMPTY_CHANNEL_STATE, fresh('y', 1)))).toBe('stale-contribution');
		expect(
			reason(negotiate(EMPTY_CHANNEL_STATE, contribution({ propertyId: 'cut-height', value: number(1.2), computedFrom: { contentRevision: CONTENT, generationId: 'generation-2' } })))
		).toBe('stale-contribution');
		expect(readChannelProperty(x.state, scope, context({ generationId: 'generation-4' })).kind).toBe('absent');
	});

	it('distinguishes expiry (re-evaluation permitted) from withdrawal (run retired), even after a prune', () => {
		const edited: SnapshotIdentity = { acceptedRevision: { projectId: 'project-1', revisionId: 'revision-8' }, sourceContentId: 'sha256-source-8' };
		const next = context({ snapshot: edited });
		const nextOwner = levelReference({ revision: { kind: 'exact', contentRevision: CONTENT } });
		for (const [propertyId, value] of [
			['cut-height', number(1.2)],
			['reveal', walls('wall-1')]
		] as const) {
			const offer = (runEpoch: number, ctx: ChannelEvaluationContext) =>
				contribution({
					propertyId,
					value,
					invocationId: 'x',
					runEpoch,
					...(ctx === next
						? { address: address(propertyId, { ownerReference: nextOwner }), computedFrom: { contentRevision: 'sha256-source-8', generationId: 'generation-3' } }
						: {})
				});
			const x4 = accepted(negotiate(EMPTY_CHANNEL_STATE, offer(4, CONTEXT)));
			const pruned = pruneChannelState(x4.state, next);
			expect(pruned.state.entries, propertyId).toEqual([]);
			const scope = x4.scope;

			// prune → re-offer: the expired run re-evaluates under the same run epoch.
			expect(accepted(negotiate(pruned.state, offer(4, next), next)).contribution.runEpoch, propertyId).toBe(4);

			// prune → withdraw → re-offer: the withdrawal retires the run although nothing was left to remove.
			const withdrawn = withdrawChannelContribution(pruned.state, { scope, invocationId: 'x', runEpoch: 4 });
			expect(withdrawn.kind, propertyId).toBe('retired');
			expect(reason(negotiate(withdrawn.state, offer(4, next), next)), propertyId).toBe('stale-run-epoch');
			expect(reason(negotiate(withdrawn.state, offer(3, next), next)), propertyId).toBe('stale-run-epoch');
			// Idempotent, and an older run's cleanup is still a stale no-op.
			expect(withdrawChannelContribution(withdrawn.state, { scope, invocationId: 'x', runEpoch: 4 })).toEqual({ kind: 'absent', state: withdrawn.state });
			expect(withdrawChannelContribution(pruned.state, { scope, invocationId: 'x', runEpoch: 3 }).kind, propertyId).toBe('ignored');
			// A genuinely newer run of the invocation is unaffected.
			expect(accepted(negotiate(withdrawn.state, offer(5, next), next)).contribution.runEpoch, propertyId).toBe(5);
		}
	});

	it('orders a declared ordered-replacement property across every invocation in its scope', () => {
		// No v1 family declares ordered replacement now that the Camera controller reflects the
		// output claim; the common rule is proved through a test-only Layout family.
		const ordered: ChannelFamily = {
			...LAYOUT_PLAN_FAMILY,
			id: 'layout.ordered@1',
			requiredProperties: [],
			properties: [{ ...declaredProperty(LAYOUT_PLAN_FAMILY, 'cut-height')!, family: 'layout.ordered@1', arbitration: 'ordered-replacement' }]
		};
		const host = createChannelHost([ordered]);
		const offer = (state: ChannelState, invocationId: string, runEpoch: number, value = 1) =>
			negotiateChannelContribution(host, state, contribution({ family: ordered, propertyId: 'cut-height', value: number(value), invocationId, runEpoch }), CONTEXT);
		const a3 = accepted(offer(EMPTY_CHANNEL_STATE, 'a', 3));
		const b5 = accepted(offer(a3.state, 'b', 5));
		expect(b5.replaced.map((entry) => entry.invocationId)).toEqual(['a']);
		expect(reason(offer(b5.state, 'a', 4))).toBe('stale-run-epoch');
		expect(reason(offer(b5.state, 'c', 5))).toBe('same-run-epoch-conflict');
		// The replaced run's late cleanup cannot clear the newer contribution.
		const scope = b5.scope;
		expect(withdrawChannelContribution(b5.state, { scope, invocationId: 'a', runEpoch: 3 }).kind).toBe('absent');
		// After the holder withdraws, an older run still cannot reclaim the scope.
		const empty = withdrawChannelContribution(b5.state, { scope, invocationId: 'b', runEpoch: 5 }).state;
		expect(reason(offer(empty, 'a', 4))).toBe('stale-run-epoch');
		expect(reason(offer(empty, 'b', 5))).toBe('stale-run-epoch');
		expect(accepted(offer(empty, 'a', 6)).contribution.invocationId).toBe('a');
	});
});

describe('F.3 inspection-v1 — Reveal union contributions', () => {
	const reveal = (invocationId: string, runEpoch: number, ids: string[], computedFrom?: ContributionOptions['computedFrom']) =>
		contribution({ propertyId: 'reveal', value: walls(...ids), invocationId, runEpoch, computedFrom });
	const members = (read: ReturnType<typeof readChannelProperty>) =>
		read.kind === 'value' && read.value.kind === 'source-set' ? read.value.value.map((identity) => identity.subject.id) : null;

	it('keeps each contributor’s own ordering, identity and provenance (X@5, Y@2, X@1, X@9, withdraw)', () => {
		const scope = scopeOf('reveal');
		const x5 = accepted(negotiate(EMPTY_CHANNEL_STATE, reveal('x', 5, ['wall-3', 'wall-1'])));
		const y2 = accepted(negotiate(x5.state, reveal('y', 2, ['wall-2'])));
		// Y's lower run epoch is its own order, not a stale offer against X.
		expect(y2.replaced).toEqual([]);
		expect(y2.contribution.invocationId).toBe('y');
		// X's older run is stale against X's own accepted run.
		expect(reason(negotiate(y2.state, reveal('x', 1, ['wall-9'])))).toBe('stale-run-epoch');
		// X@9 replaces only X's contribution, and drops wall-3 from X's own set.
		const x9 = accepted(negotiate(y2.state, reveal('x', 9, ['wall-1', 'wall-4'])));
		expect(x9.replaced.map((entry) => [entry.invocationId, entry.runEpoch])).toEqual([['x', 5]]);
		const read = readChannelProperty(x9.state, scope, CONTEXT);
		expect(members(read)).toEqual(['wall-1', 'wall-2', 'wall-4']);
		// Each contributor is reported with its own run and provenance — no aggregate owner.
		expect(read.kind === 'value' && read.contributors.map((contributor) => [contributor.invocationId, contributor.runEpoch])).toEqual([
			['x', 9],
			['y', 2]
		]);
		// The reading is deterministic: acceptance order does not change it.
		const reversed = accepted(negotiate(accepted(negotiate(EMPTY_CHANNEL_STATE, reveal('y', 2, ['wall-2']))).state, reveal('x', 9, ['wall-4', 'wall-1'])));
		expect(readChannelProperty(reversed.state, scope, CONTEXT)).toEqual(read);
		// X withdraws only its own contribution; Y's stays, and X's spent runs cannot return.
		const withdrawn = withdrawChannelContribution(x9.state, { scope, invocationId: 'x', runEpoch: 9 });
		expect(members(readChannelProperty(withdrawn.state, scope, CONTEXT))).toEqual(['wall-2']);
		expect(reason(negotiate(withdrawn.state, reveal('x', 5, ['wall-3'])))).toBe('stale-run-epoch');
		// A same-run re-offer is idempotent; a same-run different set conflicts.
		expect(accepted(negotiate(y2.state, reveal('y', 2, ['wall-2']))).idempotent).toBe(true);
		expect(reason(negotiate(y2.state, reveal('y', 2, ['wall-5'])))).toBe('same-run-epoch-conflict');
	});

	it('reads only contributors computed from the current content while others remain active', () => {
		const x = accepted(negotiate(EMPTY_CHANNEL_STATE, reveal('x', 1, ['wall-1'])));
		const both = accepted(negotiate(x.state, reveal('y', 1, ['wall-2'])));
		const edited: SnapshotIdentity = { acceptedRevision: { projectId: 'project-1', revisionId: 'revision-8' }, sourceContentId: 'sha256-source-8' };
		const next = context({ snapshot: edited });
		const nextOwner = levelReference({ revision: { kind: 'exact', contentRevision: CONTENT } });
		const yAgain = accepted(
			negotiateChannelContribution(
				HOST,
				both.state,
				{ ...reveal('y', 1, ['wall-2'], { contentRevision: 'sha256-source-8', generationId: 'generation-3' }), address: address('reveal', { ownerReference: nextOwner }) },
				next
			)
		);
		// Y re-evaluated under the new content; X did not, so X expires and is never read under it.
		const scope = yAgain.scope;
		expect(members(readChannelProperty(yAgain.state, scope, next))).toEqual(['wall-2']);
		expect(readChannelProperty(yAgain.state, scope, next)).toMatchObject({
			contributors: [{ invocationId: 'y', computedFrom: { contentRevision: 'sha256-source-8' } }]
		});
		// An undo back to the original content (a new acceptance of identical content) reads X again from `both`.
		const undo = context({ snapshot: { ...SNAPSHOT, acceptedRevision: { projectId: 'project-1', revisionId: 'revision-9' } } });
		expect(members(readChannelProperty(both.state, scopeOf('reveal'), undo))).toEqual(['wall-1', 'wall-2']);
	});
});

describe('F.3 inspection-v1 — Camera session values reflect the output claim', () => {
	const fresh = createCameraOutputState({ outputId: 'output-1', viewportId: 'viewport-1', sessionEpoch: 'session-1', sourceRevision: CONTENT });
	const ticket = (ownerId: string, runEpoch: number) => ({ outputId: 'output-1', sourceRevision: CONTENT, sessionEpoch: 'session-1', ownerId, runEpoch });
	const camera = (propertyId: string, value: Record<string, unknown>, invocationId: string, runEpoch: number) =>
		contribution({ family: CAMERA_SESSION_INSPECTION_FAMILY, propertyId, value, invocationId, runEpoch });
	const acquired = (state: CameraOutputState, ownerId: string, runEpoch: number) => {
		const decision = acquireCameraOutput(state, { ticket: ticket(ownerId, runEpoch), role: 'inspection', expected: { kind: 'unowned' }, policy: 'exclusive' });
		if (decision.kind !== 'acquired') throw new Error(decision.reason);
		return decision.state;
	};

	it('admits a Camera value only from the run that holds the output, with the claim’s role as controller', () => {
		// A free output admits nobody: no controller can establish itself through the channel.
		expect(reason(negotiate(EMPTY_CHANNEL_STATE, camera('controller', { kind: 'identifier', value: 'inspection' }, 'inspector', 1), context({ outputs: [fresh] })))).toBe(
			'camera-output-not-held'
		);
		const held = acquired(fresh, 'inspector', 1);
		const ctx = context({ outputs: [held] });
		const controller = accepted(negotiate(EMPTY_CHANNEL_STATE, camera('controller', { kind: 'identifier', value: 'inspection' }, 'inspector', 1), ctx));
		expect(controller.satisfied).toBe(true);
		// The controller value is the claim's role, never a second opinion about it.
		expect(reason(negotiate(EMPTY_CHANNEL_STATE, camera('controller', { kind: 'identifier', value: 'follow' }, 'inspector', 1), ctx))).toBe('invalid-value');
		// Another owner, or another run of the same owner, is not the holder.
		expect(reason(negotiate(controller.state, camera('azimuth', number(1), 'previewer', 2), ctx))).toBe('camera-output-not-held');
		expect(reason(negotiate(controller.state, camera('azimuth', number(1), 'inspector', 0), ctx))).toBe('camera-output-not-held');
		// The holder updates its own values within its run.
		const a1 = accepted(negotiate(controller.state, camera('azimuth', number(1), 'inspector', 1), ctx));
		const a2 = accepted(negotiate(a1.state, camera('azimuth', number(2), 'inspector', 1), ctx));
		expect(a2.replaced.map((entry) => entry.value)).toEqual([number(1)]);
		// A Camera output from another session or source is not this context's output.
		const otherSource = { ...held, sourceRevision: 'sha256-other' };
		expect(reason(negotiate(EMPTY_CHANNEL_STATE, camera('azimuth', number(1), 'inspector', 1), context({ outputs: [otherSource] })))).toBe('camera-output-not-held');
		expect(reason(negotiate(EMPTY_CHANNEL_STATE, camera('azimuth', number(1), 'inspector', 1), context({ outputs: [held, held] })))).toBe('camera-output-not-held');
	});

	it('moves Camera value ownership only through the protocol: handoff, return and source rebase', () => {
		const held = acquired(fresh, 'inspector', 1);
		const atHeld = context({ outputs: [held] });
		const inspected = accepted(negotiate(EMPTY_CHANNEL_STATE, camera('azimuth', number(1), 'inspector', 1), atHeld));
		const scope = inspected.scope;

		const handoff = replaceCameraOutput(held, { ticket: ticket('previewer', 2), role: 'preview', expected: { kind: 'held', ticket: ticket('inspector', 1) }, returnToken: 'back' });
		if (handoff.kind !== 'acquired') throw new Error(handoff.reason);
		const atPreview = context({ outputs: [handoff.state] });
		// The handed-off run's value is no longer read, and its late offers are refused.
		expect(readChannelProperty(inspected.state, scope, atPreview).kind).toBe('absent');
		expect(reason(negotiate(inspected.state, camera('azimuth', number(9), 'inspector', 1), atPreview))).toBe('camera-output-not-held');
		const previewed = accepted(negotiate(inspected.state, camera('azimuth', number(3), 'previewer', 2), atPreview));
		expect(previewed.expired.map((entry) => entry.invocationId)).toEqual(['inspector']);

		// A return gives the inspector a new run; only that run contributes.
		const returned = returnCameraOutput(handoff.state, ticket('previewer', 2), 'back');
		if (returned.kind !== 'returned') throw new Error(returned.reason);
		const atReturn = context({ outputs: [returned.state] });
		expect(readChannelProperty(previewed.state, scope, atReturn).kind).toBe('absent');
		expect(reason(negotiate(previewed.state, camera('azimuth', number(4), 'inspector', 1), atReturn))).toBe('camera-output-not-held');
		const restored = accepted(negotiate(previewed.state, camera('azimuth', number(4), 'inspector', returned.claim.ticket.runEpoch), atReturn));
		expect(readChannelProperty(restored.state, scope, atReturn)).toMatchObject({ value: number(4), contributors: [{ invocationId: 'inspector', runEpoch: 3 }] });

		// A source rebase ends the claim, so every Camera value expires until the output is re-acquired.
		const rebased = rebaseCameraOutputSource(returned.state, 'sha256-source-8');
		if (rebased.kind !== 'rebased') throw new Error(rebased.kind);
		const edited = context({
			snapshot: { acceptedRevision: { projectId: 'project-1', revisionId: 'revision-8' }, sourceContentId: 'sha256-source-8' },
			outputs: [rebased.state]
		});
		expect(pruneChannelState(restored.state, edited).state.entries).toEqual([]);
	});
});
