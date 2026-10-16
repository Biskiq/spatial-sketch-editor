/**
 * The F.4 planner registry and `prepareIntent` (AM-4).
 *
 * `local-single-domain-v1` is one **registration seam**: a domain planner
 * declares what it needs, the registry admits or refuses it, and one pure
 * function dispatches a captured intent to exactly one planner. Nothing here
 * reads a source, computes a digest, mints a revision or installs anything —
 * planning is deterministic and separate from the accepting boundary, which is
 * what makes replay comparable and what lets `T3.P01.S03` add unit planners on
 * the same seam without touching this file.
 *
 * `prepareIntent` keeps the "unchanged expected baseline" claim in one place: it
 * refuses before dispatch when the intent does not answer the snapshot it was
 * handed, so no planner is ever asked to plan against a stale revision.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */

import type { ShapeIssue } from '../strict-shape';
import type { SemanticDomain } from '../references/types';
import { intentScope, validateAuthoringIntent, type IntentValidationOptions } from './intent';
import type {
	AcceptanceRejectionCode,
	AcceptedSnapshot,
	AuthoringIntent,
	CapturedInput,
	DomainPlanner,
	PlannerRegistration,
	PreparedCandidate
} from './types';

export type { PlannerRegistration };

/**
 * A planner registration refusal, or admission. Refusing at registration is the
 * honest place for a wider scope: `local-single-domain-v1` cannot make compound,
 * unit or resource-changing acceptance correct, so it declines the planner rather
 * than failing every one of its operations later.
 */
export type RegistrationRefusal = {
	readonly kind: 'refused';
	/** `compound-acceptance` | `unit-acceptance` | `resource-admission` | `duplicate-kind`. */
	readonly reason: string;
	readonly message: string;
	readonly diagnostics: readonly ShapeIssue[];
};

export type RegistrationOutcome = PlannerRegistration | RegistrationRefusal;

export type PlannerRegistry<Source> = {
	/** Registered planners, in registration order. */
	planners(): readonly DomainPlanner<Source>[];
	plannerFor(kind: string): DomainPlanner<Source> | null;
	register(planner: DomainPlanner<Source>): RegistrationOutcome;
};

/** The one refusal constructor for registration. */
function registrationRefusal(reason: string, message: string): RegistrationRefusal {
	return { kind: 'refused', reason, message, diagnostics: [] };
}

/**
 * The registry, with the `local-single-domain-v1` admission rule built in: a
 * planner that needs compound acceptance, F.2 units or resource staging is
 * refused, and a kind can never be registered twice (two planners for one kind
 * would be two writable owners of the same operation).
 */
export function createPlannerRegistry<Source>(): PlannerRegistry<Source> {
	const byKind = new Map<string, DomainPlanner<Source>>();
	return {
		planners() {
			return [...byKind.values()];
		},
		plannerFor(kind) {
			return byKind.get(kind) ?? null;
		},
		register(planner) {
			if (planner.admission.compound) {
				return registrationRefusal(
					'compound-acceptance',
					`planner "${planner.id}" needs compound acceptance, which local-single-domain-v1 does not provide (T3.P01.S03's unit-acceptance-v1 owns it)`
				);
			}
			if (planner.admission.units) {
				return registrationRefusal(
					'unit-acceptance',
					`planner "${planner.id}" needs F.2 unit acceptance, which local-single-domain-v1 does not provide (T3.P01.S03's unit-acceptance-v1 owns it)`
				);
			}
			if (planner.admission.resources) {
				return registrationRefusal(
					'resource-admission',
					`planner "${planner.id}" needs resource staging, which this current-source adapter never performs (AM-4: no resource/lock mutation)`
				);
			}
			if (planner.sourceVersions.length === 0 || planner.sourceKinds.length === 0) {
				return registrationRefusal(
					'invalid-registration',
					`planner "${planner.id}" declares no admitted source kind/version, so no intent could ever be admitted for it`
				);
			}
			if (byKind.has(planner.kind)) {
				return registrationRefusal(
					'duplicate-kind',
					`operation kind "${planner.kind}" is already registered by another planner; one operation kind has one planner`
				);
			}
			byKind.set(planner.kind, planner);
			return { kind: 'registered' };
		}
	};
}

export type PrepareFailure = {
	readonly kind: 'refused';
	readonly code: AcceptanceRejectionCode;
	/** The planner's own refusal code, when the planner refused. */
	readonly reason: string | null;
	readonly message: string;
	readonly diagnostics: readonly ShapeIssue[];
};

export type PrepareResult<Source> =
	| { readonly kind: 'prepared'; readonly candidate: PreparedCandidate<Source> }
	| PrepareFailure;

/**
 * Dispatch one captured intent to its planner.
 *
 * Order matters and is deliberate: shape and determinism first, then the scope
 * refusals this provider owns (resource, compound), then the planner lookup, then
 * the baseline check, and only then the planner itself. A request that touches
 * two domains or a typed resource never reaches a planner, and a planner is never
 * asked to plan against a revision the snapshot does not hold.
 */
export function prepareIntent<Source>(
	registry: PlannerRegistry<Source>,
	snapshot: AcceptedSnapshot<Source>,
	intent: AuthoringIntent,
	capturedInputs: readonly CapturedInput[] = intent.capturedInputs,
	options: IntentValidationOptions = {}
): PrepareResult<Source> {
	const validated = validateAuthoringIntent(intent, options);
	if (!validated.success) {
		return refusal('invalid-intent', null, 'The intent is not a valid, deterministic AuthoringIntent@1', validated.issues);
	}
	const valid = validated.value;
	const scope = intentScope(valid);
	if (scope.resourceKinds.length > 0) {
		return refusal(
			'unsupported-resource',
			null,
			`local-single-domain-v1 admits no typed-resource operation (requested: ${scope.resourceKinds.join(', ')})`,
			[]
		);
	}
	if (scope.domains.length > 1) {
		return refusal(
			'unsupported-compound',
			null,
			`one accepted operation addresses one domain; this intent spans ${scope.domains.join(' + ')}`,
			[]
		);
	}
	const planner = registry.plannerFor(valid.kind);
	if (planner === null) {
		return refusal('unsupported-operation', null, `No planner is registered for operation kind "${valid.kind}"`, []);
	}
	const plannerDomain: SemanticDomain = planner.admission.domain;
	if (scope.domains.length === 1 && scope.domains[0] !== plannerDomain) {
		// A planner registered for one domain planning another domain's subjects is
		// a wiring defect, not a caller error: refuse rather than let it try.
		return refusal(
			'unsupported-operation',
			null,
			`planner "${planner.id}" is registered for domain "${plannerDomain}" and the intent addresses "${scope.domains[0]}"`,
			[]
		);
	}
	if (!planner.sourceKinds.includes(snapshot.sourceKind) || !planner.sourceVersions.includes(snapshot.sourceVersion)) {
		return refusal(
			'unsupported-operation',
			null,
			`planner "${planner.id}" admits source kinds ${planner.sourceKinds.join(', ')} and this snapshot is "${snapshot.sourceKind}"`,
			[]
		);
	}
	if (!sameRevision(valid.expectedRevision, snapshot.acceptedRevision)) {
		return refusal(
			'stale-revision',
			null,
			`the intent answers revision "${valid.expectedRevision.revisionId}" and the accepted revision is "${snapshot.acceptedRevision.revisionId}"`,
			[]
		);
	}

	const outcome = planner.prepare({
		snapshot,
		intent: valid,
		capturedInputs,
		allocatedIds: valid.allocatedIds
	});
	if (outcome.kind === 'rejected') {
		return refusal('planner-rejected', outcome.code, outcome.message, outcome.diagnostics);
	}
	const candidate = outcome.candidate;
	// The candidate must describe the same operation on the same source format.
	// A planner that renames the operation or the source kind would make the
	// install record a change nobody can attribute.
	if (candidate.operationId !== valid.operationId) {
		return refusal(
			'invalid-intent',
			null,
			`planner "${planner.id}" prepared operation "${candidate.operationId}" for intent "${valid.operationId}"`,
			[]
		);
	}
	if (candidate.sourceKind !== snapshot.sourceKind || candidate.sourceVersion !== snapshot.sourceVersion) {
		return refusal(
			'unsupported-operation',
			null,
			`planner "${planner.id}" prepared source "${candidate.sourceKind}"@${candidate.sourceVersion} instead of "${snapshot.sourceKind}"@${snapshot.sourceVersion}`,
			[]
		);
	}
	return { kind: 'prepared', candidate };
}

function refusal(
	code: AcceptanceRejectionCode,
	reason: string | null,
	message: string,
	diagnostics: readonly ShapeIssue[]
): PrepareFailure {
	return { kind: 'refused', code, reason, message, diagnostics };
}

/** Opaque accepted-revision equality: identity only, never a currency inference. */
export function sameRevision(
	left: { readonly projectId: string; readonly revisionId: string },
	right: { readonly projectId: string; readonly revisionId: string }
): boolean {
	return left.projectId === right.projectId && left.revisionId === right.revisionId;
}
