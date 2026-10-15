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
	ReferenceSubject,
	SemanticReference,
	SnapshotIdentity
} from '../references/types';

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

/** Where a contribution applies. A second viewport is a distinct output. */
export const CHANNEL_SCOPES = ['viewport', 'session', 'project'] as const;

export type ChannelScope = (typeof CHANNEL_SCOPES)[number];

/**
 * How competing contributions to one property scope are arbitrated.
 *
 * `exclusive` — the first owner holds it; a different owner is rejected, while
 * the same owner may deliberately replace its own contribution. `ordered-replacement`
 * — a strictly newer accepted run epoch replaces the current contribution.
 * `union` — set union over declared identities only.
 */
export const CHANNEL_ARBITRATIONS = ['exclusive', 'ordered-replacement', 'union'] as const;

export type ChannelArbitration = (typeof CHANNEL_ARBITRATIONS)[number];

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
	 * invocation, and deliberate replacement happens within that same invocation.
	 */
	invocationId: string;
	/** Monotonic accepted run epoch, ordered within one property scope. */
	runEpoch: number;
	/** The source revision and generation the value was computed from, or `null`. */
	computedFrom: { contentRevision: string | null; generationId: string | null };
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
	properties: readonly ChannelDescriptor[];
	/** Properties a satisfiable contribution set must include. */
	requiredProperties: readonly string[];
};

/** Accepted contributions, in acceptance order, one property scope each. */
export type ChannelState = { contributions: readonly ChannelContribution[] };

/**
 * The context a contribution is negotiated against: one supplied accepted
 * snapshot, the active representation generation and nothing else. Re-evaluation
 * on a declared invalidation input is the owning evaluator's duty; negotiation
 * only refuses a contribution that can no longer prove it belongs to this context.
 */
export type ChannelEvaluationContext = {
	snapshot: SnapshotIdentity;
	generationId: string | null;
};

export const CHANNEL_REJECTION_REASONS = [
	'invalid-contribution',
	'unsupported-required-family',
	'unknown-family',
	'undeclared-property',
	'descriptor-mismatch',
	'invalid-value',
	'stale-contribution',
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
			contribution: ChannelContribution;
			/** Contributions this acceptance replaced, in replacement order. */
			replaced: readonly ChannelContribution[];
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
