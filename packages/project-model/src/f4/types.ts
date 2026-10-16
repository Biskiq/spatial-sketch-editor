/**
 * F.4 `acceptance-invariants-v1` — the enduring shared acceptance layer, and the
 * `local-single-domain-v1` admission it extends (AM-4, T1.P01.S03 provider).
 *
 * Two layers, one implementation, deliberately separable:
 *
 * - **`acceptance-invariants-v1` (enduring, never retired)** — one opaque
 *   accepted revision per accepted change, an atomic validated install with
 *   exactly one undo result, stale/ABA rejection, one bounded chronological
 *   history and a validated read facade. It is the prerequisite of
 *   `T3.P01.S03`'s unit capabilities, so **no required signature here names
 *   today's `ProjectDocument`**: the accepted source is a type parameter, and the
 *   only thing this layer claims to know about it is the adapter that admitted it.
 * - **`local-single-domain-v1` (retiring with the current-source adapter)** — the
 *   admission of current-source Layout and Scene planners over that source. It is
 *   the part `T3.P01.S04` retires, and the part whose scope is single-domain.
 *
 * These are types and vocabulary: no IO, no editor dependency, no Svelte, no
 * renderer. `SessionEpoch`, `AcceptedRevision` and `SnapshotIdentity` are F.1's
 * landed read-context types (S01) and are **referenced, never forked** — an
 * acceptance record and a reference resolution must agree on what an accepted
 * revision *is*.
 */

import type { ShapeIssue } from '../strict-shape';
import type {
	AcceptedRevision,
	SemanticDomain,
	SemanticReference,
	SessionEpoch,
	SnapshotIdentity
} from '../references/types';

/** The exact F.4 shape version this module implements. */
export const F4_VERSION = 1 as const;

// F.1 owns these identities; F.4 reuses them so one accepted revision means the
// same thing to a resolver host, a coordinator and a history entry.
export type { AcceptedRevision, SessionEpoch, SnapshotIdentity };

/**
 * A deterministically captured value. Serializable by construction: planning
 * receives no closure, handle, clock, randomness or reactive object, so the same
 * intent plus the same source produces the same candidate (the replay the plan's
 * acceptance criteria require). Non-finite numbers, functions, class instances
 * and `undefined` are not members of this type and are rejected by
 * `validateAuthoringIntent`.
 */
export type F4JsonValue =
	| null
	| boolean
	| number
	| string
	| readonly F4JsonValue[]
	| { readonly [key: string]: F4JsonValue };

/** One captured input, named so a reviewer can see what planning depended on. */
export type CapturedInput = { readonly name: string; readonly value: F4JsonValue };

/**
 * An identity captured **before** planning. A planner never allocates an id
 * itself: allocation is a capture step, so a refusal wastes no identity and a
 * replay produces the same one.
 */
export type CapturedIdAllocation = { readonly kind: string; readonly id: string };

/**
 * `AuthoringIntent@1` — what the caller asks for, captured rather than computed.
 *
 * `expectedRevision` is the exact accepted revision planning answers against; a
 * different one is a stale request, never a retry against current state. The
 * intent carries no clock, network handle, pending gesture or renderer object,
 * because those cannot be captured deterministically.
 */
export type AuthoringIntent = {
	readonly version: typeof F4_VERSION;
	/** The registered planner kind this intent dispatches to. */
	readonly kind: string;
	readonly operationId: string;
	readonly expectedRevision: AcceptedRevision;
	/** Qualified subjects the operation addresses, in F.1 reference form. */
	readonly targets: readonly SemanticReference[];
	/** Typed, serializable domain payload (a scalar patch, a placement, …). */
	readonly payload: F4JsonValue;
	readonly capturedInputs: readonly CapturedInput[];
	readonly allocatedIds: readonly CapturedIdAllocation[];
};

/**
 * Adapter-owned read access over one admitted source.
 *
 * `source` is deliberately opaque to this layer (the type parameter): the
 * invariants layer never inspects, deep-proxies or derives from it. `identity`
 * is the F.1 read-context identity for exactly this accepted content, so a
 * domain planner can hand it straight to the landed resolvers.
 */
export type DomainReadAccess<Source> = {
	readonly identity: SnapshotIdentity;
	readonly source: Source;
};

/**
 * `AcceptedSnapshot@1` — the validated read facade one accepted change publishes.
 *
 * Field names are the AM-4 names S02 composes its boot snapshot from, so the
 * later host↔F4 wiring swaps in this export without renaming a consumer. It is
 * immutable by construction and contains no writable handle, no compiled
 * geometry and no current-source field the invariants layer depends on.
 */
export type AcceptedSnapshot<Source = unknown> = {
	readonly acceptedRevision: AcceptedRevision;
	readonly sourceContentId: string;
	/** Admitted source kind, e.g. the current source's own kind. */
	readonly sourceKind: string;
	readonly sourceVersion: number;
	readonly domain: DomainReadAccess<Source>;
};

/** Entity-level change summary. Domain vocabularies; this layer merges nothing. */
export type OperationChange = {
	readonly kind: string;
	readonly subjectIds: readonly string[];
	readonly fields: readonly string[];
};

export type CorrespondenceRelation = 'preserved' | 'created' | 'retired' | 'replaced';

/**
 * How a subject on one side of an accepted change corresponds to the other side.
 *
 * Returned as **data**: selection requalification is a consumer decision, and
 * prose like "the same wall" is not an identity. `null` is an explicit absence —
 * a created subject has no `before`, a retired one no `after`.
 */
export type CorrespondenceEntry = {
	readonly relation: CorrespondenceRelation;
	readonly before: SemanticReference | null;
	readonly after: SemanticReference | null;
};

/**
 * A prepared, validated candidate: the next source plus the correspondence and
 * diagnostics a reviewer needs. Produced by a domain planner, admitted by the
 * source adapter, installed by the coordinator — three steps, because a planner
 * that could install would be a second writer.
 */
export type PreparedCandidate<Source> = {
	readonly operationId: string;
	readonly sourceKind: string;
	readonly sourceVersion: number;
	/** Adapter/domain-owned next source; this layer never reads into it. */
	readonly source: Source;
	readonly changes: readonly OperationChange[];
	readonly correspondence: readonly CorrespondenceEntry[];
	readonly diagnostics: readonly ShapeIssue[];
};

/** What one domain planner answers with: a candidate, or its own typed refusal. */
export type PlannerOutcome<Source> =
	| { readonly kind: 'prepared'; readonly candidate: PreparedCandidate<Source> }
	| {
			readonly kind: 'rejected';
			/** The planner's own refusal code (`no_op`, `unknown_wall`, …). */
			readonly code: string;
			readonly message: string;
			readonly diagnostics: readonly ShapeIssue[];
	  };

/** Everything a planner is handed. Supplied, never fetched. */
export type PlannerRequest<Source> = {
	readonly snapshot: AcceptedSnapshot<Source>;
	readonly intent: AuthoringIntent;
	readonly capturedInputs: readonly CapturedInput[];
	readonly allocatedIds: readonly CapturedIdAllocation[];
};

/**
 * The scope a planner admits to needing. `local-single-domain-v1` admits
 * single-domain, non-compound, non-unit, non-resource-changing planners only;
 * a planner declaring more is refused registration rather than rejected per
 * operation, because a wider scope is not this provider's to grant.
 */
export type PlannerAdmission = {
	/** The one domain this planner produces changes in. */
	readonly domain: SemanticDomain;
	/** Compound (multi-domain) acceptance, e.g. a Camera View + Presentation. */
	readonly compound: boolean;
	/** F.2 unit creation, which needs `T3.P01.S03`'s `unit-acceptance-v1`. */
	readonly units: boolean;
	/** Resource staging or lock mutation, which this adapter never performs. */
	readonly resources: boolean;
};

/**
 * The registry's admission of one planner. The only successful registration
 * outcome: a planner either joins the registry or is refused with a reason.
 */
export type PlannerRegistration = { readonly kind: 'registered' };

/**
 * A registered domain planner. Its `kind` is the operation kind an intent
 * dispatches on; its `sourceKinds`/`sourceVersions` are the sources it accepts,
 * so an intent cannot reach a planner built for another format.
 */
export type DomainPlanner<Source> = {
	readonly id: string;
	readonly kind: string;
	readonly admission: PlannerAdmission;
	readonly sourceKinds: readonly string[];
	readonly sourceVersions: readonly number[];
	prepare(request: PlannerRequest<Source>): PlannerOutcome<Source>;
};

/**
 * A blocking-issue record carried across accepts. Structurally the Layout
 * compiler's own issue, kept opaque here so the enduring layer does not depend on
 * a domain's compiler: the coordinator only ever hands an adapter the issues that
 * adapter's source introduced, and the adapter decides what they mean.
 */
export type AdmissionIssue = {
	readonly path: string;
	readonly code: string;
	readonly message: string;
	readonly targetId?: string;
	readonly severity?: 'warning' | 'error';
};

/**
 * One source adapter's verdict on a candidate.
 *
 * `admit` is where "admission equals runtime preparation" lives: the current
 * source adapter validates through the project codec, resolves through the
 * runtime Scene path and reports blocking canonical-compile issues that its
 * baseline does not already carry. A rejected candidate never reaches install.
 */
export type SourceAdmission<Source> =
	| {
			readonly kind: 'admitted';
			readonly source: Source;
			readonly canonicalJson: string;
			readonly sourceContentId: string;
			readonly blockingIssues: readonly AdmissionIssue[];
	  }
	| {
			readonly kind: 'rejected';
			readonly code: string;
			readonly message: string;
			readonly issues: readonly ShapeIssue[];
	  };

/** The admission/content-identity seam the coordinator depends on. */
export type AcceptanceSourceAdapter<Source> = {
	readonly sourceKind: string;
	readonly sourceVersion: number;
	admit(candidate: unknown, baselineBlockingIssues: readonly AdmissionIssue[]): Promise<SourceAdmission<Source>>;
};

/**
 * One accepted source, as a coordinator or a history entry holds it.
 *
 * `revision` and `sourceContentId` are different identities of the same value:
 * Undo back to earlier contents restores that **content** identity under a
 * **fresh** revision, which is what keeps an exact F.1 reference resolvable
 * while an acceptance token never pretends to be content.
 */
export type AdmittedSource<Source> = {
	readonly revision: AcceptedRevision;
	readonly source: Source;
	readonly canonicalJson: string;
	readonly sourceContentId: string;
	readonly blockingIssues: readonly AdmissionIssue[];
	readonly operationId: string;
	readonly correspondence: readonly CorrespondenceEntry[];
};

export type AcceptanceRejectionCode =
	/** No planner is registered for the intent's kind. */
	| 'unsupported-operation'
	/** The intent spans more than one domain in one operation. */
	| 'unsupported-compound'
	/** A typed-resource domain, or a resource-changing operation. */
	| 'unsupported-resource'
	/** A new-unit request, which needs `unit-acceptance-v1`. */
	| 'unsupported-unit'
	/** Malformed or non-deterministic intent. */
	| 'invalid-intent'
	/** The intent's expected revision is no longer the accepted revision. */
	| 'stale-revision'
	/** The host session epoch moved while the accept was in flight. */
	| 'superseded-epoch'
	/** The planner refused (its own code is in `reason`). */
	| 'planner-rejected'
	/** The adapter refused the prepared candidate. */
	| 'admission-refused'
	/** Nothing to undo, or nothing to redo. */
	| 'history-unavailable';

/**
 * The one refusal shape. `expectedRevision`/`actualRevision` are filled only when
 * the caller is authorized to see them (`actualRevision` stays `null` for an
 * unsupported operation, which reveals nothing about current state).
 */
export type AcceptanceRejection = {
	readonly kind: 'rejected';
	readonly operationId: string;
	readonly code: AcceptanceRejectionCode;
	/** The domain/planner's own refusal code when one exists. */
	readonly reason: string | null;
	readonly message: string;
	readonly expectedRevision: AcceptedRevision | null;
	readonly actualRevision: AcceptedRevision | null;
	readonly diagnostics: readonly ShapeIssue[];
};

/** Exactly one inverse for one accepted change, or an explicit absence. */
export type UndoResult =
	| {
			readonly kind: 'undoable';
			readonly beforeRevision: AcceptedRevision;
			readonly inverseOperationId: string;
	  }
	| { readonly kind: 'none' };

/**
 * `AcceptanceResult@1`. Exactly one of three outcomes per request: one install
 * with one undo result, a no-op that changed nothing and added no history entry,
 * or a refusal.
 */
export type AcceptanceResult<Source> =
	| {
			readonly kind: 'accepted';
			readonly operationId: string;
			readonly beforeRevision: AcceptedRevision;
			readonly afterRevision: AcceptedRevision;
			readonly snapshot: AcceptedSnapshot<Source>;
			readonly changes: readonly OperationChange[];
			readonly correspondence: readonly CorrespondenceEntry[];
			readonly undoResult: UndoResult;
	  }
	| { readonly kind: 'no-op'; readonly operationId: string; readonly revision: AcceptedRevision }
	| AcceptanceRejection;
