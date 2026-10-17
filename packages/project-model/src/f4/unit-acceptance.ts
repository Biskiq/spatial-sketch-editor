/**
 * `F4.intent-acceptance@1:unit-acceptance-v1` — the additive F.2-backed
 * acceptance extension (T3.P01.S03).
 *
 * The landed provider (`types.ts`, `prepare.ts`, T1.P01.S03) is the enduring
 * `acceptance-invariants-v1` lifecycle plus one retiring admission scope,
 * `local-single-domain-v1`: one domain, no compound, no unit planner, no
 * resource staging. This module adds the wider admission **without editing that
 * scope's behaviour**:
 *
 * - `createUnitPlannerRegistry` is the **landed** registry with a wider
 *   admission profile (Camera and Experience planners, compound and unit-bearing
 *   planners, resources only with explicit staging). The registration loop, its
 *   refusal order and the duplicate-kind rule stay in `createPlannerRegistry`,
 *   so there is one admission seam rather than two that can drift.
 * - `prepareUnitIntent` is the **same** dispatcher with the wider admission, so
 *   the order of refusals, the planner lookup and the baseline check have one
 *   implementation rather than two that can drift.
 * - `createUnitTargetInspector` runs the F.1 resolver over every target against
 *   one supplied envelope and its dependency lock, so a subject the snapshot
 *   cannot resolve refuses the operation **before** planning. It never repairs,
 *   never retargets by proximity and never fabricates a lock entry.
 * - resource staging is the **F.2-dependent** half and lives in
 *   `../units/acceptance-staging.ts`, behind the inactive `./units` subpath: the
 *   architecture gate forbids this module from reaching the unit envelope before
 *   `T3.P01.S04`. Nothing here imports it, and a caller stages only by knowingly
 *   crossing the F.2 subpath.
 *
 * What this module deliberately does not do: it does not read or write a source
 * (the adapter admits), it does not mint revisions or keep history (the
 * coordinator owns both), and it exposes no live unit writer. The live
 * `conditional-save-current-v1` path is untouched; `conditional-save-units-v1`
 * reuses the landed Save protocol over these candidates and stays inactive until
 * `T3.P01.S04`.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */

import { REFERENCE_DOMAINS, type ReferenceReadContext, type SemanticReference } from '../references/types';
import { resolveReference } from '../references/resolve';
import type { ShapeIssue } from '../strict-shape';
import { createPlannerRegistry, prepareIntent, type PlannerRegistry, type PrepareAdmission, type PrepareResult } from './prepare';
import type { IntentValidationOptions } from './intent';
import type { AcceptedSnapshot, AuthoringIntent, CapturedInput } from './types';

/** The exact capability scope this module provides. */
export const UNIT_ACCEPTANCE_SCOPE = 'unit-acceptance-v1' as const;

/**
 * Planners that addressed the current source through `local-single-domain-v1`
 * keep working unchanged; this registry is a **different registry**, not a
 * mutation of the landed one, so a host opts in explicitly.
 */
export type UnitPlannerRegistryOptions = {
	/**
	 * Admit planners that stage or lock typed resources. Off by default: staging
	 * is a separate explicit decision (see
	 * `@portfolio/project-model/units` → `stageUnitResources`), and a planner that
	 * needs it must not be silently admitted by a caller who only wanted
	 * compound/unit acceptance.
	 */
	readonly resourceStaging?: boolean;
};

/**
 * The unit-admission planner registry.
 *
 * This is the **landed** registry with a wider admission profile, not a second
 * registration loop: the domain set, the compound/unit admission, the refusal
 * order and the duplicate-kind rule all stay in `createPlannerRegistry`. A
 * planner admitted here therefore cannot be refused at dispatch for the same
 * need, because `prepareUnitIntent` reads the profile the registry granted.
 */
export function createUnitPlannerRegistry<Source>(
	options: UnitPlannerRegistryOptions = {}
): PlannerRegistry<Source> {
	return createPlannerRegistry<Source>({
		domains: REFERENCE_DOMAINS,
		compound: true,
		units: true,
		resources: options.resourceStaging === true
	});
}

/**
 * Prepare one intent under the admission the registry granted.
 *
 * The registry is the **only** source of the granted profile: `prepareIntent`
 * reads `registry.admission`, and a registry that grants nothing is the landed
 * single-domain profile. No exported admission constant and no per-call flag can
 * therefore downgrade what a planner was admitted with — the disagreement this
 * module exists to avoid.
 *
 * `admission` carries only `inspectTargets` — normally
 * `createUnitTargetInspector(context)` — to run domain/reference/lock validation
 * over the targets before planning; without one the caller is responsible for
 * having validated them, exactly as the landed dispatcher documents.
 */
export function prepareUnitIntent<Source>(
	registry: PlannerRegistry<Source>,
	snapshot: AcceptedSnapshot<Source>,
	intent: AuthoringIntent,
	capturedInputs?: readonly CapturedInput[],
	options: IntentValidationOptions = {},
	admission: PrepareAdmission<Source> = {}
): PrepareResult<Source> {
	return prepareIntent(registry, snapshot, intent, capturedInputs, options, {
		...(admission.inspectTargets === undefined ? {} : { inspectTargets: admission.inspectTargets })
	});
}

/**
 * Validate every target against one supplied read context.
 *
 * The F.1 resolver is the only implementation of resolution: this function adds
 * the *operation-level* rule that a target block must resolve as a whole, and
 * reports each failure at its own path with the resolver's own code. An
 * unresolved typed resource keeps its typed `repair-required` identity — it is
 * never turned into a fabricated pin or a nearest match.
 */
export function validateUnitTargets(
	targets: readonly SemanticReference[],
	context: ReferenceReadContext
): readonly ShapeIssue[] {
	const issues: ShapeIssue[] = [];
	for (const [index, target] of targets.entries()) {
		const resolution = resolveReference(target, context);
		if (resolution.kind === 'failed') {
			issues.push({
				path: `$.targets[${index}]`,
				code: resolution.code,
				message: `${resolution.reference.domain}:${resolution.reference.subject.kind}:${resolution.reference.subject.id} — ${resolution.message}`
			});
		}
	}
	return issues;
}

/**
 * The `inspectTargets` admission this module's preparation uses, bound to one
 * supplied read context. It is built from the accepted envelope, never from an
 * ambient lookup.
 */
export function createUnitTargetInspector(
	context: ReferenceReadContext
): (intent: AuthoringIntent) => readonly ShapeIssue[] {
	return (intent) => validateUnitTargets(intent.targets, context);
}

