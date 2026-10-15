/**
 * F.1 references — `references-v1` shapes (AM-1).
 *
 * A durable reference identifies meaning, not a location:
 * domain qualification + revision context + stable subject identity + stable
 * instance-ID path + component/capability. Names, indices, display labels and
 * mutable hierarchy paths may locate data within one revision; they never
 * establish identity across revisions or re-exports.
 *
 * This module is types and vocabulary only — no document read, no editor or
 * renderer dependency. `resolveReference` (./resolve) evaluates a reference
 * against one supplied accepted snapshot; there is no ambient "latest" anywhere
 * in this interface.
 */

/** The exact F.1 interface version this module implements. */
export const REFERENCES_VERSION = 1 as const;

/**
 * Domain qualification. Layout, Scene, Camera and Experience are the four
 * semantic authorities; a typed resource declares its own kind
 * (`resource:audio`, `resource:image`, …) so resources keep one addressing
 * contract without hiding a new domain inside an existing one.
 */
export const REFERENCE_DOMAINS = ['layout', 'scene', 'camera', 'experience'] as const;

export type SemanticDomain = (typeof REFERENCE_DOMAINS)[number];

/** A declared typed-resource kind, e.g. `resource:audio`. */
export type ResourceDomain = `resource:${string}`;

export type ReferenceDomain = SemanticDomain | ResourceDomain;

/** `true` for a declared typed-resource kind (`resource:<kind>`). */
export function isResourceDomain(domain: string): domain is ResourceDomain {
	return /^resource:[a-z][a-z0-9-]*$/.test(domain);
}

/** `true` for any admitted domain qualification, authority or resource kind. */
export function isReferenceDomain(domain: string): domain is ReferenceDomain {
	return (REFERENCE_DOMAINS as readonly string[]).includes(domain) || isResourceDomain(domain);
}

/** A stable canonical subject: its kind declares the target scope, its id is opaque. */
export type ReferenceSubject = { kind: string; id: string };

/**
 * Revision context. `exact` carries an immutable domain/source content identity;
 * `project-lock` names the project whose dependency lock supplies the concrete
 * revision and is resolved against the supplied snapshot and lock, never an
 * ambient latest lookup. A resolution always records its concrete revision.
 */
export type ReferenceRevision =
	| { kind: 'exact'; contentRevision: string }
	| { kind: 'project-lock'; projectId: string };

/**
 * Location qualification. `project-root` is the whole project; `layout-location`
 * names a Layout level plus an ordered structure-instance path, where an empty
 * path means the level root. Current Layout floors map explicitly to level
 * qualification in the read adapter; no Level schema is introduced here.
 */
export type ReferenceLocation =
	| { kind: 'project-root' }
	| { kind: 'layout-location'; levelId: string; structureInstancePath: readonly string[] };

/**
 * A declared extension/capability reference. Every reference declares itself
 * required or optional: a reader must reject an unsupported required one and may
 * ignore an unsupported optional one. An extension entry carries no payload, so
 * an ignored optional extension can never change core reference identity.
 */
export type ReferenceExtension = { id: string; required: boolean };

export type SemanticReference = {
	version: typeof REFERENCES_VERSION;
	domain: ReferenceDomain;
	revision: ReferenceRevision;
	subject: ReferenceSubject;
	/** Ordered stable instance IDs; an empty path explicitly denotes the root subject. */
	instancePath: readonly string[];
	location: ReferenceLocation;
	/** Explicit nullable stable addressable identity; never resolved by name or proximity. */
	componentId: string | null;
	capabilityId: string | null;
	extensions?: readonly ReferenceExtension[];
};

/** Opaque accepted revision identity. Equality only — never inferred from a label or date. */
export type AcceptedRevision = { projectId: string; revisionId: string };

/**
 * `SnapshotIdentity@1`: what one supplied accepted snapshot is. `sourceContentId`
 * hashes the canonical serialized source; a host `SessionEpoch` is a separate
 * lifetime guard, and neither digest nor epoch is the revision token.
 */
export type SnapshotIdentity = { acceptedRevision: AcceptedRevision; sourceContentId: string };

/** Host session lifetime identity. Guards callbacks; it is not an accepted revision. */
export type SessionEpoch = string;

/**
 * An admitted F.2 dependency lock reader. F.2 owns the lock's real shape, so F.1
 * keeps this boundary opaque and asks only for the concrete content revision a
 * locked reference resolves to. F.1 never manufactures one: with no admitted
 * reader, project-lock resolution is `incompatible`.
 */
export type DependencyLockReader = {
	readonly projectId: string;
	contentRevisionFor(reference: SemanticReference): string | null;
};

/**
 * The frame vocabulary. `project-world` needs no data; an owner-qualified frame
 * names its owning domain, a stable id and its revision. A Room without an
 * authored frame cannot qualify as one — the owner resolves a real frame or
 * refuses, and no centroid, nearest Room or containment invents one.
 */
export type FrameOwner = SemanticDomain;

export type FrameReference =
	| { version: typeof REFERENCES_VERSION; kind: 'project-world' }
	| {
			version: typeof REFERENCES_VERSION;
			kind: 'owner-frame';
			owner: FrameOwner;
			frameId: string;
			revision: string;
	  };

/**
 * The placement an owning domain resolves a frame to. Origin is project-world
 * meters in the documented right-handed project convention (+Y up, X/Z
 * horizontal); yaw is radians. `datumMeters` is the frame's own floor datum, or
 * `null` when the owner has none — a representation parameter that needs a datum
 * then cannot qualify.
 */
export type FramePlacement = {
	originMeters: readonly [number, number, number];
	yawRadians: number;
	datumMeters: number | null;
};

/**
 * `DerivedSourceRef@1` is runtime-only. Generated/derived fragments are never
 * durable substitutes for source identity: selection stores the canonical source,
 * and a fragment's details expire on recompile.
 */
export type DerivedSourceRef = {
	source: SemanticReference;
	/** Compile/representation generation the fragment was produced from. */
	generationId: string;
	/** The stream that produced the fragment. Vocabulary is domain-declared. */
	stream: string;
	subRef: DerivedSubRef | null;
};

export type DerivedSubRef =
	| { kind: 'component'; componentId: string }
	| { kind: 'interval'; start: number; end: number };

/** Reusable repair action offered with a failure result. Resolvers perform none. */
export type ReferenceRepairAction = {
	kind: 'choose-subject' | 'reacquire-reference' | 'restore-source' | 'request-access' | 'reload-snapshot';
	description: string;
};

export const REFERENCE_FAILURE_CODES = [
	'missing',
	'removed',
	'incompatible',
	'unauthorized',
	'repair-required'
] as const;

export type ReferenceFailureCode = (typeof REFERENCE_FAILURE_CODES)[number];

/** The canonical subject a reference resolved to, with its concrete revision and owner. */
export type ResolvedSubject = {
	domain: ReferenceDomain;
	subject: ReferenceSubject;
	instancePath: readonly string[];
	componentId: string | null;
	capabilityId: string | null;
	/** The concrete revision this reference resolved to. */
	contentRevision: string;
	/** The domain authority that owns the subject. */
	owner: string;
};

export type ReferenceResolution =
	| { kind: 'resolved'; reference: SemanticReference; subject: ResolvedSubject }
	| {
			kind: 'failed';
			reference: SemanticReference;
			code: ReferenceFailureCode;
			message: string;
			repairs: readonly ReferenceRepairAction[];
	  };

export type FrameResolutionFailureCode = 'missing' | 'incompatible' | 'unauthorized';

export type FrameResolution =
	| { kind: 'resolved'; frame: FrameReference; placement: FramePlacement }
	| {
			kind: 'failed';
			frame: FrameReference;
			code: FrameResolutionFailureCode;
			message: string;
			repairs: readonly ReferenceRepairAction[];
	  };

/** Derived-fragment resolution: the source resolution, or the expiry that invalidated it. */
export type DerivedSourceResolution =
	| { kind: 'resolved'; fragment: DerivedSourceRef; source: ResolvedSubject }
	| {
			kind: 'failed';
			fragment: DerivedSourceRef;
			code: 'stale-generation' | ReferenceFailureCode;
			message: string;
			repairs: readonly ReferenceRepairAction[];
	  };

/** What a domain resolver answers with. It never repairs and never guesses. */
export type ReferenceResolverOutcome =
	| { kind: 'resolved'; contentRevision: string }
	| {
			kind: Exclude<ReferenceFailureCode, 'incompatible'>;
			message: string;
			repairs?: readonly ReferenceRepairAction[];
	  };

export type ReferenceResolver = {
	/** Resolver identity, recorded in diagnostics. */
	readonly id: string;
	readonly domain: ReferenceDomain;
	/**
	 * The subject kinds this resolver answers for. A kind outside this list is
	 * unsupported, which is `incompatible` — never a nearest or name-based fallback.
	 */
	readonly subjectKinds: readonly string[];
	/** The domain authority recorded on a resolved subject. */
	readonly owner: string;
	resolve(reference: SemanticReference, request: ReferenceReadRequest): ReferenceResolverOutcome;
};

/** What an owner-qualified frame resolver answers with. */
export type FrameResolverOutcome =
	| { kind: 'resolved'; placement: FramePlacement }
	| { kind: 'missing' | 'incompatible' | 'unauthorized'; message: string; repairs?: readonly ReferenceRepairAction[] };

export type FrameResolver = {
	readonly id: string;
	readonly owner: FrameOwner;
	resolve(frame: FrameReference, context: ReferenceReadContext): FrameResolverOutcome;
};

/**
 * The read context a reference is evaluated against. Every field is supplied by
 * the caller: the accepted snapshot, the separate host session epoch, the active
 * representation generation, the extensions this reader supports, the admitted
 * F.2 lock reader (or none) and the registered resolvers.
 */
export type ReferenceReadContext = {
	snapshot: SnapshotIdentity;
	sessionEpoch: SessionEpoch;
	generationId: string | null;
	supportedExtensions: readonly string[];
	lock: DependencyLockReader | null;
	/** Admitted domain resolvers. An unadmitted domain is `incompatible`. */
	resolvers: readonly ReferenceResolver[];
	/** Admitted owner-qualified frame resolvers. */
	frameResolvers: readonly FrameResolver[];
};

/** The request a resolver receives: the read context plus the concrete revision. */
export type ReferenceReadRequest = {
	readonly context: ReferenceReadContext;
	/** The concrete revision the revision context resolved to. */
	readonly contentRevision: string;
};
