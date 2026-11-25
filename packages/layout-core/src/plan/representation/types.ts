import type { CompiledRegion, LayoutBounds2 } from '../../geometry/types';
import type { LayoutVec2 } from '../../geometry/coordinates';

/** The four plan streams. Every emitted fragment belongs to exactly one. */
export const PLAN_STREAMS = ['cut', 'projected', 'hidden', 'symbol'] as const;


export type PlanStream = (typeof PLAN_STREAMS)[number];


/** The source kinds this representation can place in a stream. */
export const PLAN_SOURCE_KINDS = ['wall', 'opening', 'object', 'room-floor', 'region'] as const;


export type PlanSourceKind = (typeof PLAN_SOURCE_KINDS)[number];


/**
 * Membership reasons. `included` means the source passed every stage; each other
 * value names the one stage that excluded it.
 */
export const PLAN_MEMBERSHIP_REASONS = [
	'included',
	'filtered-type',
	'outside-depth',
	'outside-span',
	'no-meaningful-projection'
] as const;


export type PlanMembershipReason = (typeof PLAN_MEMBERSHIP_REASONS)[number];


/** The landed sub-reference kinds, mirrored field for field. */
export const PLAN_SUB_REF_KINDS = ['component', 'interval'] as const;


export type PlanSubRef =
	| { readonly kind: 'component'; readonly componentId: string }
	/** A distance range in meters along the owning source's canonical sampled arc. */
	| { readonly kind: 'interval'; readonly start: number; readonly end: number };


/**
 * Layout-native correspondence for one plan fragment. Qualified into the landed
 * `DerivedSourceRef` above this package; never persisted.
 */
export type PlanSourceRef = {
	readonly sourceId: string;
	readonly sourceKind: PlanSourceKind;
	readonly generationId: string;
	readonly stream: PlanStream;
	readonly subRef: PlanSubRef | null;
};


/** Parameters of one Plan evaluation (the landed `layout.plan@1` family values). */
export type PlanParameters = {
	/** Cut height in meters, **relative to the level datum**. */
	readonly cutHeightMeters: number;
	/** Required finite depth in meters, strictly greater than zero, measured downward. */
	readonly depthMeters: number;
	/**
	 * Optional lateral half-width in meters around `context.target`, strictly
	 * greater than zero; `null` is explicit unbounded lateral coverage.
	 */
	readonly lateralSpanHalfWidthMeters: number | null;
	/** Admitted source kinds; `null` admits all of them. */
	readonly sourceKindFilter: readonly PlanSourceKind[] | null;
	/** Declared source ids whose display/hit eligibility is temporarily widened. */
	readonly reveal: readonly string[];
};


/** What the host supplies beside the parameters: identity, target and level datum. */
export type PlanSourceContext = {
	/** Opaque compile/representation generation the fragments belong to. */
	readonly generationId: string;
	/**
	 * Project-world XZ the lateral span is measured around (the inspection target).
	 *
	 * **Only `lateralSpanHalfWidthMeters !== null` reads it** (see
	 * `planDependsOnTarget`). With the shipped default of explicit unbounded
	 * lateral coverage it is validated and echoed, and it changes no fragment, no
	 * membership reason, no stream and no bound. A host may therefore retain one
	 * evaluation while an inspection target moves — a pan — without re-evaluating.
	 */
	readonly target: LayoutVec2;
	/** The evaluated level's datum in project-world meters. */
	readonly datumMeters: number;
};


export type PlanFragmentGeometry =
	| { readonly kind: 'span'; readonly start: LayoutVec2; readonly end: LayoutVec2 }
	| { readonly kind: 'polyline'; readonly polyline: readonly LayoutVec2[] }
	| { readonly kind: 'polygon'; readonly polygon: readonly LayoutVec2[] };


/** One placeable plan fragment. It always carries its source's declared membership. */
export type PlanFragment = {
	readonly ref: PlanSourceRef;
	/** Project-world meters the fragment is drawn from. */
	readonly elevationMeters: number;
	readonly geometry: PlanFragmentGeometry;
	/**
	 * The owning source's declared membership reason. Carried on the fragment so no
	 * consumer can hold a primitive whose membership has been lost in a merge.
	 */
	readonly membership: PlanMembershipReason;
};


/** One compiled source's membership in this evaluation. */
export type PlanSourceMembership = {
	readonly sourceId: string;
	readonly sourceKind: PlanSourceKind;
	/** The declared reason. `reveal` never rewrites it. */
	readonly reason: PlanMembershipReason;
	/** Display/hit eligibility: `included`, or a revealed source. */
	readonly eligible: boolean;
	readonly revealed: boolean;
	/** How far the source's highest point sits below the cut plane, or `null` when it reaches it. */
	readonly depthBelowCutMeters: number | null;
	/** Plan distance from the inspection target, or `null` when lateral coverage is unbounded. */
	readonly lateralDistanceMeters: number | null;
};


export type PlanStreams = {
	readonly cut: readonly PlanFragment[];
	readonly projected: readonly PlanFragment[];
	readonly hidden: readonly PlanFragment[];
	readonly symbol: readonly PlanFragment[];
};


export type PlanEvaluation = {
	readonly generationId: string;
	readonly datumMeters: number;
	readonly cutHeightMeters: number;
	readonly cutElevationMeters: number;
	readonly depthMeters: number;
	readonly lateralSpanHalfWidthMeters: number | null;
	/**
	 * The inspection target this evaluation was asked for. It is a **record**, not
	 * an input to the result unless `lateralSpanHalfWidthMeters` is non-null; see
	 * `planDependsOnTarget` and `planTargetsLiveView`.
	 */
	readonly target: LayoutVec2;
	readonly sourceKindFilter: readonly PlanSourceKind[] | null;
	readonly reveal: readonly string[];
	readonly streams: PlanStreams;
	/** Every fragment in the streams' deterministic order. */
	readonly fragments: readonly PlanFragment[];
	readonly membership: readonly PlanSourceMembership[];
	/** Reveal ids that name no compiled source. Union semantics ignore them; they are reported. */
	readonly unmatchedRevealIds: readonly string[];
	readonly bounds: LayoutBounds2 | null;
};


export type PlanIssue = { path: string; code: string; message: string };


export type PlanEvaluationResult =
	| { readonly kind: 'evaluated'; readonly plan: PlanEvaluation }
	| {
			readonly kind: 'refused';
			readonly code: 'invalid-parameters' | 'invalid-context';
			readonly issues: readonly PlanIssue[];
	  };


export type SourceExtent = {
	readonly minY: number;
	readonly maxY: number;
};


export type SourcePlan =
	| { readonly kind: 'span'; readonly start: LayoutVec2; readonly end: LayoutVec2 }
	| { readonly kind: 'polyline'; readonly polyline: readonly LayoutVec2[] }
	| { readonly kind: 'polygon'; readonly polygon: readonly LayoutVec2[] };


export type Candidate = {
	readonly sourceKind: PlanSourceKind;
	readonly sourceId: string;
	readonly extent: SourceExtent;
	readonly plan: SourcePlan;
	readonly subRef: PlanSubRef | null;
	/** A symbol-only source (an Opening) never contributes a cut/projected/hidden stroke. */
	readonly symbolOnly: boolean;
	readonly regionRole?: CompiledRegion['role'];
	readonly regionKey?: string;
};


/** One candidate after the membership stages: measurement plus the placement it earned. */
export type Evaluated = {
	readonly candidate: Candidate;
	readonly reason: PlanMembershipReason;
	readonly depthBelowCut: number | null;
	readonly lateralDistance: number | null;
	readonly eligible: boolean;
	readonly revealed: boolean;
	/** The stream and elevation this candidate places, or `null` when it places nothing. */
	readonly placement: { readonly stream: PlanStream; readonly elevationMeters: number } | null;
};
