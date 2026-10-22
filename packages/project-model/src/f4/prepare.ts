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
import { immutableF4Data } from './immutable';
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
 * than failing every one of its operations later. The same applies to a compound
 * planner whose declaration names no write set (`compound-write-set`).
 */
export type RegistrationRefusal = {
	readonly kind: 'refused';
	/** `compound-acceptance` | `compound-write-set` | `unit-acceptance` | `resource-admission` | `duplicate-kind`. */
	readonly reason: string;
	readonly message: string;
	readonly diagnostics: readonly ShapeIssue[];
};

export type RegistrationOutcome = PlannerRegistration | RegistrationRefusal;

export type PlannerRegistry<Source> = {
	/**
	 * The admission this registry grants, when it declares one. The dispatcher
	 * reads it, so a planner admitted here cannot then be refused for the same
	 * need at preparation time.
	 *
	 * **Additive and optional:** a registry built without a profile — every
	 * landed caller, including a hand-built conformance registry — is treated as
	 * the `local-single-domain-v1` profile, exactly as before this extension.
	 * Only a registry that opts into a wider profile states one.
	 */
	readonly admission?: Readonly<PlannerAdmissionProfile>;
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
 * The admission a planner registry grants. The defaults **are** the landed
 * `local-single-domain-v1` rule; a wider profile (T3.P01.S03's
 * `unit-acceptance-v1`) is an explicit option on the one registry rather than a
 * second registration loop, so the seam that admits a planner is single.
 */
export type PlannerRegistryAdmission = {
	/** Domains a planner may declare. Defaults to Layout and Scene only. */
	readonly domains?: readonly SemanticDomain[];
	/** Admit planners whose operation spans more than one domain. Default `false`. */
	readonly compound?: boolean;
	/** Admit planners that need F.2 unit acceptance. Default `false`. */
	readonly units?: boolean;
	/** Admit planners that stage typed resources. Default `false`. */
	readonly resources?: boolean;
};

/** The concrete profile a registry grants and the dispatcher reads. */
export type PlannerAdmissionProfile = {
	readonly domains: readonly SemanticDomain[];
	readonly compound: boolean;
	readonly units: boolean;
	readonly resources: boolean;
};

/** The landed `local-single-domain-v1` domain set. */
const SINGLE_DOMAIN_DOMAINS = ['layout', 'scene'] as const satisfies readonly SemanticDomain[];

/** `local-single-domain-v1`, as the profile a registry or dispatcher reads. */
export const SINGLE_DOMAIN_ADMISSION: Readonly<PlannerAdmissionProfile> = Object.freeze({
	domains: SINGLE_DOMAIN_DOMAINS,
	compound: false,
	units: false,
	resources: false
});

/**
 * The registry, with its admission profile built in: a planner that needs
 * compound acceptance, F.2 units or resource staging is refused unless the
 * caller configured that admission, and a kind can never be registered twice
 * (two planners for one kind would be two writable owners of the same
 * operation).
 *
 * With no options this is exactly `local-single-domain-v1`, including its refusal
 * reasons, messages **and** its dispatcher profile: no `admission` member is
 * declared, so `prepareIntent` cannot mistake the landed registry for a widened
 * one. A caller that grants a wider profile declares it, and the dispatcher then
 * reads that same profile, so registration and dispatch cannot disagree.
 */
export function createPlannerRegistry<Source>(
	options: PlannerRegistryAdmission = {}
): PlannerRegistry<Source> {
	const admission: Readonly<PlannerAdmissionProfile> = Object.freeze({
		// A frozen copy: a granted profile must not share a mutable array with its caller.
		domains: Object.freeze([...(options.domains ?? SINGLE_DOMAIN_DOMAINS)]),
		compound: options.compound === true,
		units: options.units === true,
		resources: options.resources === true
	});
	// `declared` is the one fact that separates the landed registry from a widened
	// one: the profile is only published when the caller asked for one. It is
	// key-presence based: `{ compound: false }` publishes the landed profile, so the
	// dispatcher treats it as "widened" and uses the neutral wording even though
	// nothing was granted. That is a wording choice, never an admission change.
	const declared =
		options.domains !== undefined ||
		options.compound !== undefined ||
		options.units !== undefined ||
		options.resources !== undefined;
	const wider =
		options.domains !== undefined || admission.compound || admission.units || admission.resources;
	const byKind = new Map<string, DomainPlanner<Source>>();
	return {
		...(declared ? { admission } : {}),
		planners() {
			return [...byKind.values()];
		},
		plannerFor(kind) {
			return byKind.get(kind) ?? null;
		},
		register(planner) {
			if (!(admission.domains as readonly string[]).includes(planner.admission.domain)) {
				return registrationRefusal(
					'unsupported-domain',
					wider
						? `this admission profile admits ${admission.domains.join(', ')} planners; "${planner.admission.domain}" is not one`
						: 'local-single-domain-v1 admits Layout and Scene planners only'
				);
			}
			if (planner.admission.compound && !admission.compound) {
				return registrationRefusal(
					'compound-acceptance',
					wider
						? `planner "${planner.id}" needs compound acceptance, which this admission profile does not provide`
						: `planner "${planner.id}" needs compound acceptance, which local-single-domain-v1 does not provide (T3.P01.S03's unit-acceptance-v1 owns it)`
				);
			}
			if (planner.admission.compound && planner.admission.writes === undefined) {
				// A compound planner that declares no write set is exactly the
				// adapter-wide licence this provider stopped accepting: its scope would be
				// "whatever the host grants" rather than what it can correctly produce.
				return registrationRefusal(
					'compound-write-set',
					`planner "${planner.id}" declares compound acceptance and must declare the unit domains it writes (\`writes\`, empty when it writes only its own domain)`
				);
			}
			if (planner.admission.units && !admission.units) {
				return registrationRefusal(
					'unit-acceptance',
					wider
						? `planner "${planner.id}" needs F.2 unit acceptance, which this admission profile does not provide`
						: `planner "${planner.id}" needs F.2 unit acceptance, which local-single-domain-v1 does not provide (T3.P01.S03's unit-acceptance-v1 owns it)`
				);
			}
			if (planner.admission.resources && !admission.resources) {
				return registrationRefusal(
					'resource-admission',
					wider
						? `planner "${planner.id}" needs resource staging, which this admission profile does not provide`
						: `planner "${planner.id}" needs resource staging, which this current-source adapter never performs (AM-4: no resource/lock mutation)`
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
			byKind.set(planner.kind, Object.freeze({ ...planner,
				admission: immutableF4Data(planner.admission),
				sourceKinds: immutableF4Data(planner.sourceKinds),
				sourceVersions: immutableF4Data(planner.sourceVersions)
			}));
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
 * Per-call preparation concerns that are not the registry's admission.
 *
 * The granted profile is the **registry's** (see `PlannerRegistry.admission`),
 * never a per-call flag: a caller that could widen admission at dispatch time
 * would reintroduce the second authority this seam exists to prevent. This type
 * therefore carries only the extension point for the unit provider's own
 * domain/reference/lock validation. It runs after the scope, planner and
 * baseline checks and **before** the planner, so an unresolvable subject never
 * reaches domain planning and never becomes a candidate.
 */
export type PrepareAdmission<Source> = {
	inspectTargets?(
		intent: AuthoringIntent,
		snapshot: AcceptedSnapshot<Source>
	): readonly ShapeIssue[];
};

/**
 * Dispatch one captured intent to its planner.
 *
 * Order matters and is deliberate: shape and determinism first, then the scope
 * refusals this provider owns (resource, compound), then the planner lookup, then
 * the planner's own declaration checks, then the baseline check, and only then the
 * planner itself. A request that touches two domains or a typed resource never
 * reaches a planner that did not declare that acceptance, and a planner is never
 * asked to plan against a revision the snapshot does not hold.
 *
 * Two admissions must both hold for a compound or resource-bearing intent: the
 * registry's granted profile (what the host provides) **and** the planner's own
 * declaration (what this operation can correctly accept). A widened registry is
 * not a licence for a planner that never declared the need.
 */
export function prepareIntent<Source>(
	registry: PlannerRegistry<Source>,
	snapshot: AcceptedSnapshot<Source>,
	intent: AuthoringIntent,
	capturedInputs?: readonly CapturedInput[],
	options: IntentValidationOptions = {},
	admission: PrepareAdmission<Source> = {}
): PrepareResult<Source> {
	const validated = validateAuthoringIntent(intent, options);
	if (!validated.success) {
		return refusal('invalid-intent', null, 'The intent is not a valid, deterministic AuthoringIntent@1', validated.issues);
	}
	let valid = validated.value;
	if (capturedInputs !== undefined) {
		const captured = validateAuthoringIntent({ ...valid, capturedInputs }, options);
		if (!captured.success) return refusal('invalid-intent', null, 'Captured inputs must be deterministic data', captured.issues);
		valid = captured.value;
	}
	const scope = intentScope(valid);
	const granted = registry.admission ?? SINGLE_DOMAIN_ADMISSION;
	// A registry that declares no profile *is* `local-single-domain-v1`, and keeps
	// its landed messages; a widened profile states its own, so a refusal never
	// misnames the profile that produced it.
	const widened = registry.admission !== undefined;
	if (scope.resourceKinds.length > 0 && granted.resources !== true) {
		return refusal(
			'unsupported-resource',
			null,
			widened
				? `this admission profile admits no typed-resource operation (requested: ${scope.resourceKinds.join(', ')})`
				: `local-single-domain-v1 admits no typed-resource operation (requested: ${scope.resourceKinds.join(', ')})`,
			[]
		);
	}
	if (scope.domains.length > 1 && granted.compound !== true) {
		return refusal(
			'unsupported-compound',
			null,
			widened
				? `this admission profile addresses one domain per accepted operation; this intent spans ${scope.domains.join(' + ')}`
				: `one accepted operation addresses one domain; this intent spans ${scope.domains.join(' + ')}`,
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
	// The planner's own declaration is the second, independent gate: a compound or
	// resource-bearing intent must reach a planner that declared it can accept one,
	// whatever the registry grants.
	if (scope.domains.length > 1 && planner.admission.compound !== true) {
		return refusal(
			'unsupported-compound',
			'compound-acceptance',
			`planner "${planner.id}" does not declare compound acceptance, and the intent spans ${scope.domains.join(' + ')}`,
			[]
		);
	}
	if (scope.resourceKinds.length > 0 && planner.admission.resources !== true) {
		return refusal(
			'unsupported-resource',
			'resource-admission',
			`planner "${planner.id}" does not declare typed-resource acceptance (requested: ${scope.resourceKinds.join(', ')})`,
			[]
		);
	}
	// A planner that declares unit or resource acceptance is refused by a
	// preparation that does not provide it, before it is ever asked to plan.
	if (planner.admission.units && granted.units !== true) {
		return refusal(
			'unsupported-unit',
			'unit-acceptance',
			`planner "${planner.id}" needs F.2 unit acceptance, which this preparation does not provide`,
			[]
		);
	}
	if (planner.admission.resources && granted.resources !== true) {
		return refusal(
			'unsupported-resource',
			'resource-admission',
			`planner "${planner.id}" needs resource staging, which this preparation does not provide`,
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

	const targetIssues = admission.inspectTargets?.(valid, snapshot) ?? [];
	if (targetIssues.length > 0) {
		return refusal(
			'unsupported-operation',
			'unresolved-target',
			'The intent addresses subjects this snapshot does not resolve',
			targetIssues
		);
	}

	let outcome;
	try { outcome = planner.prepare({
		snapshot,
		intent: valid,
		capturedInputs: valid.capturedInputs,
		allocatedIds: valid.allocatedIds
	}); } catch (error) {
		return refusal('planner-rejected', 'planner-failed', error instanceof Error ? error.message : 'Planner failed', []);
	}
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
	try { return { kind: 'prepared', candidate: immutableF4Data(candidate) }; } catch {
		return refusal('planner-rejected', 'invalid-candidate', 'Candidate must be capturable data', []);
	}
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
