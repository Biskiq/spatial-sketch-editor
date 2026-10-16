/**
 * AM-7 source-migration inputs and results.
 *
 * The converter decides **no** policy. Every ambiguous row of the conversion
 * matrix is resolved by a supplied typed decision, and a source that needs a
 * decision the caller did not supply is refused with
 * `requires-policy-mapping` — it is never guessed, and an unevaluated authored
 * value is never silently dropped. That is the whole reason these types exist:
 * "S01 decides no policy" is expressed in the type system rather than in prose.
 *
 * The operation is pure: no IO, no clock, no randomness. Identical captured
 * inputs produce identical candidates and an identical report, and the source is
 * never mutated — preparation produces *candidates*.
 */

import type { AcceptedRevision } from '../references/types';
import type { ProjectEnvelope, ResourceKind, ResourcePin, RequiredCapability, UnitDomain } from '../units/types';

/** The captured migration baseline: what the source is, before anything moves. */
export type MigrationBaseline = {
	projectId: string;
	/** Content identity of the source this preparation read. */
	sourceContentId: string;
	/** The stored cloud version, when the source came from storage. */
	storedVersion: string | null;
};

/** A reviewed decision for one legacy `lockInteraction: true` node. */
export type LockInteractionDecision =
	/** Reviewed conclusion: legacy direct-entry prohibition is not a blocking gate. */
	| { kind: 'no-gate' }
	/** Reviewed mapping onto an explicit Presentation gate, with its reason recorded. */
	| { kind: 'gate'; presentationId: string; reason: string };

/**
 * A reviewed mapping of one direction's authored View-key holds onto an
 * identity-qualified Stop. The value is supplied, never derived from the track.
 */
export type ViewKeyHoldDecision = { stopId: string; holdSeconds: number };

/** A reviewed detour mapping: the explicit choice/return relationship. */
export type DetourDecision = {
	fromStopId: string;
	toStopId: string;
	returnToStopId: string;
};

/** A staged external pin the caller verified. A pin is never fabricated. */
export type StagedPin = {
	kind: ResourceKind;
	id: string;
	pin: ResourcePin;
	contentRevision: string | null;
};

/**
 * Every policy decision the conversion matrix can require, keyed by the legacy
 * identity it decides about. Keys are legacy ids so a reviewer can trace each
 * decision to the authored field it resolves.
 */
export type MigrationPolicy = {
	/**
	 * The entry choice for a residual cycle or a multi-component source. Its
	 * `entryStopId` is the converter's deterministic Stop id (`stop:<nodeId>`),
	 * so the choice is expressible before conversion runs.
	 */
	entry: { experienceId: string; entryStopId: string } | null;
	/** Keyed by legacy node id. */
	lockInteraction: Readonly<Record<string, LockInteractionDecision>>;
	/** Keyed by `"<connectionId>/<direction>"`. */
	viewKeyHolds: Readonly<Record<string, ViewKeyHoldDecision>>;
	/** Keyed by the legacy detour node id. */
	detours: Readonly<Record<string, DetourDecision>>;
};

export type MigrationInput = {
	/** The strict post-#115 document pair. */
	source: unknown;
	baseline: MigrationBaseline;
	/** The accepted revision this preparation was captured against, or `null`. */
	acceptedRevision: AcceptedRevision | null;
	policy: MigrationPolicy;
	pins: readonly StagedPin[];
};

export const MIGRATION_REFUSAL_CODES = [
	'invalid-source',
	'missing-baseline',
	'missing-revision',
	'unsupported-unit',
	'requires-policy-mapping',
	'ambiguous-origin',
	'policy-mismatch'
] as const;

export type MigrationRefusalCode = (typeof MIGRATION_REFUSAL_CODES)[number];

/** One refusal: what was found, where, and the action that would resolve it. */
export type MigrationRefusal = {
	code: MigrationRefusalCode;
	path: string;
	message: string;
	action: string;
};

/**
 * The result of preparation: every unit candidate plus the mapping report, or
 * the typed refusals that stop it. `prepared` means the candidates validate;
 * it does not mean anything was installed, and the caller still owns the CAS
 * acceptance AM-7 describes.
 */
export type MigrationResult =
	| { kind: 'prepared'; envelope: ProjectEnvelope; report: MigrationReport }
	| { kind: 'refused'; refusals: readonly MigrationRefusal[] };

/** The unit ids the candidates carry; stable and derived from the source ids. */
export type MigrationUnitIds = Readonly<Record<UnitDomain, string>>;

export type MigrationReport = {
	baseline: MigrationBaseline;
	unitIds: MigrationUnitIds;
	/** One row per legacy navigation node, in source order. */
	views: readonly {
		nodeId: string;
		viewId: string;
		presentationId: string;
		stopId: string | null;
		guideId: string | null;
		authoredHoldSeconds: number | null;
	}[];
	/** One row per produced Guide, with its ordered Stop ids. */
	guides: readonly { guideId: string; experienceId: string; entryStopId: string; stopIds: readonly string[] }[];
	experiences: readonly { experienceId: string; entryGuideId: string | null; entryStopId: string | null }[];
	connections: readonly { connectionId: string; fromViewId: string; toViewId: string }[];
	/** Authored View-key holds and the mapping that covered them. */
	retainedViewKeyHolds: readonly {
		connectionId: string;
		direction: 'forward' | 'reverse';
		authoredHoldSeconds: number;
		stopId: string;
		mappedHoldSeconds: number;
	}[];
	/** How each legacy lock field was resolved. */
	lockInteraction: readonly { nodeId: string; decision: LockInteractionDecision['kind'] }[];
	detours: readonly { nodeId: string; detourId: string; fromStopId: string; toStopId: string; returnToStopId: string }[];
	/** Bindings that remain authored-but-unresolved after preparation. */
	unresolved: readonly { path: string; resourceKind: ResourceKind; resourceId: string; message: string }[];
	/** Capability requirements the candidates' lock entries declare. */
	requiredCapabilities: readonly RequiredCapability[];
	notes: readonly string[];
};
