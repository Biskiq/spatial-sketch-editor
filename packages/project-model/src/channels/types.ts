/**
 * F.3 channels — `inspection-v1` shapes (AM-3).
 *
 * A channel address names a writable/evaluable value:
 * instance → component → capability/property → frame. Each address carries a
 * typed value: type, units, allowed range, scope, interpolation and
 * domain-owned composition operators.
 *
 * The owning domain defines what a channel means, its type/units/range and its
 * operators. This module owns only the common contract: addressing, binding,
 * dependency, conflict and invalidation rules. It exposes **no unrestricted
 * setters** — a value reaches an authority as a negotiated contribution, never
 * as a property write.
 */

import type {
	FrameReference,
	ReferenceDomain,
	ReferenceLocation,
	ReferenceReadContext,
	ReferenceSubject,
	SemanticReference
} from '../references/types';
import type { CameraOutputState } from './camera-output';

/** The exact F.3 interface version this module implements. */
export const INSPECTION_VERSION = 1 as const;

/** A declared channel family, e.g. `layout.plan@1`. */
export type ChannelFamilyId = string;

/** Units a declared value can carry. `null` is an explicitly unitless value. */
export type ChannelUnits = 'meters' | 'radians' | 'ratio' | null;

/** The value kinds F.3 v1 admits. Each family declares one per property. */
export const CHANNEL_VALUE_KINDS = ['number', 'vector3', 'identifier', 'identifier-set', 'source-set'] as const;

export type ChannelValueKind = (typeof CHANNEL_VALUE_KINDS)[number];

/** A finite range constraint. `null` bounds are explicitly unbounded. */
export type ChannelRange = {
	min: number | null;
	max: number | null;
	minExclusive: boolean;
	maxExclusive: boolean;
};

/**
 * Where a contribution applies; `scopeId` names the instance. `viewport` is a Stage
 * viewport (Layout's Plan inspection), `output` is a Camera output — the identity a
 * Camera-output ticket names, distinct from the viewport that realises it. A second
 * viewport is a distinct output, never another writer to the first.
 */
export const CHANNEL_SCOPES = ['viewport', 'output', 'session', 'project'] as const;

export type ChannelScope = (typeof CHANNEL_SCOPES)[number];

/**
 * How competing contributions to one property scope are arbitrated.
 *
 * `exclusive` — the first owner holds it; a different owner is rejected, while
 * the same owner may deliberately replace its own contribution with a newer run.
 * `ordered-replacement` — a strictly newer accepted run epoch replaces the current
 * contribution, whoever offered it. `union` — every admitted invocation holds its
 * own set contribution, and the property's value is the union of their declared
 * identities. `camera-output` — the property belongs to the run holding the Camera
 * output (`scopeId` is the output); it is admitted only from the live claim the
 * Camera-output ticket protocol holds, so the channel reflects that one authority
 * instead of arbitrating ownership a second time.
 */
export const CHANNEL_ARBITRATIONS = ['exclusive', 'ordered-replacement', 'union', 'camera-output'] as const;

export type ChannelArbitration = (typeof CHANNEL_ARBITRATIONS)[number];

/**
 * What a generic consumer may do between two values. `none` admits no generic
 * interpolation — the value changes only by a new contribution, and a domain
 * evaluator may still move it under its own rules (Camera pose and projection are
 * evaluated only by Camera, never lerped by a channel).
 */
export const CHANNEL_INTERPOLATIONS = ['none', 'linear'] as const;

export type ChannelInterpolation = (typeof CHANNEL_INTERPOLATIONS)[number];

/** What invalidates a contribution; re-evaluation is the owning evaluator's duty. */
export const CHANNEL_INVALIDATION_INPUTS = [
	'accepted-revision',
	'parameters',
	'generation',
	'frame',
	'intent',
	'clock',
	'viewport-rect',
	'source-extent',
	'source-kind-filter',
	'reveal-set',
	'epoch'
] as const;

export type ChannelInvalidationInput = (typeof CHANNEL_INVALIDATION_INPUTS)[number];

/** An extension/capability reference: it declares itself required or optional. */
export type ChannelCapability = { id: string; required: boolean };

/**
 * `ChannelDescriptor@1`. A descriptor is a declaration, not a value: it says what
 * a property means, what it accepts and what invalidates it. `validator` names the
 * identity that validated the value's domain semantics, so a consumer can tell
 * which declaration admitted a contribution.
 */
export type ChannelDescriptor = {
	version: typeof INSPECTION_VERSION;
	family: ChannelFamilyId;
	propertyId: string;
	valueKind: ChannelValueKind;
	units: ChannelUnits;
	/** Scalar (and vector-component) bounds; valid for `number`/`vector3` only. */
	range: ChannelRange | null;
	/** Closed vocabulary for `identifier`, or `null` for a domain-declared open set. */
	values: readonly string[] | null;
	scope: ChannelScope;
	arbitration: ChannelArbitration;
	interpolation: ChannelInterpolation;
	invalidation: readonly ChannelInvalidationInput[];
	capability: ChannelCapability;
	validator: string;
};

/**
 * `ChannelAddress@1` — one property of one subject in one frame. Every part is an
 * opaque identity or an ordered identity path; nothing here is a delimiter string
 * that a reader would have to parse.
 */
export type ChannelAddress = {
	version: typeof INSPECTION_VERSION;
	ownerReference: SemanticReference;
	instancePath: readonly string[];
	componentId: string | null;
	capabilityId: string | null;
	propertyId: string;
	frame: FrameReference;
};

/** A canonical source identity, used by source-qualified sets (Layout Reveal). */
export type ChannelSourceIdentity = {
	domain: ReferenceDomain;
	subject: ReferenceSubject;
	instancePath: readonly string[];
};

/** A typed channel value, matching its descriptor's declared value kind. */
export type ChannelValue =
	| { kind: 'number'; value: number }
	| { kind: 'vector3'; value: readonly [number, number, number] }
	| { kind: 'identifier'; value: string }
	| { kind: 'identifier-set'; value: readonly string[] }
	| { kind: 'source-set'; value: readonly ChannelSourceIdentity[] };

/**
 * `ChannelContribution@1` — a typed value offered to a declared property. It is
 * separate from an authored baseline: an authored override computes the instance
 * baseline, and a contribution never rewrites it.
 */
export type ChannelContribution = {
	version: typeof INSPECTION_VERSION;
	descriptor: ChannelDescriptor;
	address: ChannelAddress;
	value: ChannelValue;
	/** The viewport/session/project instance this contribution applies to. */
	scopeId: string;
	/**
	 * The accepted invocation that produced this contribution. It is also the
	 * contribution's **owner** identity: an exclusive property belongs to one
	 * invocation, deliberate replacement happens within that same invocation, and a
	 * union property holds one contribution per invocation. For a `camera-output`
	 * property it is the output claim's `ownerId`.
	 */
	invocationId: string;
	/**
	 * Monotonic accepted run epoch. It orders one invocation's runs within a property
	 * scope (and, for `ordered-replacement`, every run in that scope); for a
	 * `camera-output` property it is the output claim's run epoch.
	 */
	runEpoch: number;
	/** The source revision and generation the value was computed from, or `null`. */
	computedFrom: { contentRevision: string | null; generationId: string | null };
};

/**
 * Which addresses a family admits. A family's meaning is owned by one subject kind
 * set and one frame vocabulary, so an address outside them is inadmissible rather
 * than a new property scope: e.g. Plan inspection belongs to a Layout level, not to
 * a wall. `qualifiedAddresses: false` means the family declares no instance,
 * component or capability qualification below its owner, so a non-empty one is
 * refused instead of opening a parallel scope for the same property.
 */
export type ChannelFamilyAdmission = {
	ownerSubjectKinds: readonly string[];
	frameKinds: readonly FrameReference['kind'][];
	qualifiedAddresses: boolean;
};

/**
 * A declared family: the properties one authority publishes together, and which
 * of them a usable contribution set must carry. A family is how a domain
 * publishes channels without minting a feature-local protocol.
 */
export type ChannelFamily = {
	id: ChannelFamilyId;
	/** The authority that owns the family's meaning. */
	domain: ReferenceDomain;
	capability: ChannelCapability;
	admission: ChannelFamilyAdmission;
	properties: readonly ChannelDescriptor[];
	/** Properties a satisfiable contribution set must include. */
	requiredProperties: readonly string[];
	/**
	 * The `camera-output` property whose value must be the claim's role, or `null`.
	 * It is how the one resolved controller per output is the protocol's claim.
	 */
	controllerProperty: string | null;
};

/**
 * The canonical owner of a property scope: what the address's owner reference
 * **resolved to**, not how it was qualified. Distinct valid references to one
 * subject (an `exact` and a `project-lock` revision; a `project-root` and a
 * level-qualified location of the same Layout entity) resolve to one canonical
 * owner, so they contend for one property instead of each holding it exclusively.
 */
export type ChannelOwnerIdentity = {
	domain: ReferenceDomain;
	subject: ReferenceSubject;
	instancePath: readonly string[];
	location: ReferenceLocation;
	componentId: string | null;
	capabilityId: string | null;
};

/**
 * `ChannelPropertyScope` — the semantic ownership scope of one property: its
 * canonical owner, the address's own qualification below that owner, its frame,
 * its property and its scope instance. It is compared **structurally**, field by
 * field (`sameChannelPropertyScope`); no string key is ever built or parsed.
 */
export type ChannelPropertyScope = {
	family: ChannelFamilyId;
	owner: ChannelOwnerIdentity;
	instancePath: readonly string[];
	componentId: string | null;
	capabilityId: string | null;
	frame: FrameReference;
	propertyId: string;
	scopeId: string;
};

/** One admitted contribution and the property scope it was admitted into. */
export type ChannelEntry = { scope: ChannelPropertyScope; contribution: ChannelContribution };

/**
 * The highest run epoch one invocation has had accepted in one property scope.
 * Marks outlive the contributions they record: a withdrawn or replaced run is
 * `retired`, so neither it nor an older run of that invocation can re-enter, while
 * a run whose contribution merely **expired** (its content or generation changed)
 * may re-offer a re-evaluated value under the same run epoch.
 */
export type ChannelEpochMark = { scope: ChannelPropertyScope; invocationId: string; runEpoch: number; retired: boolean };

/**
 * Accepted channel state: the admitted contributions in acceptance order and the
 * run-epoch marks that keep ordering monotonic. It is runtime session state —
 * never serialized, never part of an authored document.
 */
export type ChannelState = { entries: readonly ChannelEntry[]; marks: readonly ChannelEpochMark[] };

/**
 * The context a contribution is negotiated and read against. `read` is the F.1 read
 * context — the one supplied accepted snapshot, its host session, the active
 * representation generation and the admitted resolvers — through which every
 * owner reference and owner frame is qualified; `cameraOutputs` is the live
 * Camera-output ownership the `camera-output` properties reflect. Nothing else is
 * consulted: there is no ambient latest snapshot and no second ownership record.
 */
export type ChannelEvaluationContext = {
	read: ReferenceReadContext;
	cameraOutputs: readonly CameraOutputState[];
};

export const CHANNEL_REJECTION_REASONS = [
	'invalid-contribution',
	'unsupported-required-family',
	'unknown-family',
	'domain-mismatch',
	'undeclared-property',
	'descriptor-mismatch',
	'invalid-value',
	'inadmissible-address',
	'unresolved-owner-reference',
	'unresolved-frame',
	'stale-contribution',
	'camera-output-not-held',
	'competing-exclusive-contribution',
	'stale-run-epoch',
	'same-run-epoch-conflict'
] as const;

export type ChannelRejectionReason = (typeof CHANNEL_REJECTION_REASONS)[number];

/**
 * A creator-facing conflict explanation naming the domain, address and owners —
 * "Opening and Inspection both control this lid", with a concrete choice. The
 * address is `null` only when the rejected input was too malformed to read one.
 */
export type ChannelDiagnostic = {
	/** The owning domain, or `null` only when the rejected input was too malformed to read one. */
	domain: ReferenceDomain | null;
	address: ChannelAddress | null;
	/**
	 * The identities that contend for the value, innermost scope first: an
	 * invocation identity for a competing contribution, a Camera output owner for
	 * a competing output. The caller resolves them to creator-facing labels.
	 */
	owners: readonly string[];
	message: string;
	/** The concrete choice offered to resolve or accept the conflict. */
	action: string;
};

export type ChannelNegotiationOutcome =
	| {
			kind: 'accepted';
			state: ChannelState;
			/** The property scope the contribution was admitted into; read and withdraw by it. */
			scope: ChannelPropertyScope;
			/** The contributor's own admitted contribution — never a merged aggregate. */
			contribution: ChannelContribution;
			/** Contributions this acceptance replaced, in replacement order. */
			replaced: readonly ChannelContribution[];
			/** Contributions in this scope that no longer belonged to the context and were dropped. */
			expired: readonly ChannelContribution[];
			/** True when the same run re-offered the same value and nothing changed. */
			idempotent: boolean;
			/** Families this reader does not admit and may ignore (declared optional). */
			unavailableFamilies: readonly string[];
			/** True when the property scope now carries every required property. */
			satisfied: boolean;
			missingRequiredProperties: readonly string[];
	  }
	| {
			kind: 'rejected';
			state: ChannelState;
			reason: ChannelRejectionReason;
			diagnostics: ChannelDiagnostic;
	  }
	| { kind: 'unavailable'; state: ChannelState; family: ChannelFamilyId; capability: ChannelCapability; message: string };

/** One contributor to a read value: its own identity and provenance, never an aggregate. */
export type ChannelContributor = {
	invocationId: string;
	runEpoch: number;
	computedFrom: ChannelContribution['computedFrom'];
};

/**
 * A property's value as the context reads it. A `union` property's value is the
 * union of every current contributor's set in a deterministic order, and
 * `contributors` lists each of them (ordered by invocation id) with its own run
 * epoch and provenance; every other arbitration has at most one contributor.
 * Contributions that no longer belong to the context are never read.
 */
export type ChannelPropertyRead =
	| { kind: 'absent'; scope: ChannelPropertyScope }
	| { kind: 'value'; scope: ChannelPropertyScope; value: ChannelValue; contributors: readonly ChannelContributor[] };

/** What a contributor presents to withdraw its own contribution. */
export type ChannelContributionHandle = { scope: ChannelPropertyScope; invocationId: string; runEpoch: number };

export type ChannelWithdrawal =
	/** The invocation's contribution at exactly that run epoch was removed. */
	| { kind: 'withdrawn'; state: ChannelState; contribution: ChannelContribution }
	/** The invocation holds nothing in this scope: an idempotent no-op. */
	| { kind: 'absent'; state: ChannelState }
	/** A newer run of the invocation holds the scope; a stale cleanup removes nothing. */
	| { kind: 'ignored'; state: ChannelState; reason: 'stale-run-epoch'; message: string };
