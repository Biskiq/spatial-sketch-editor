/**
 * `F4.intent-acceptance@1:unit-acceptance-v1` — the **F.2-dependent half** of the
 * additive unit admission (T3.P01.S05).
 *
 * Why this file lives under `units/` and not under `f4/`: the architecture gate
 * (`apps/editor/tests/lib/project-model/program-entry-closure.test.ts`) forbids
 * any source outside the inactive F.2 subtrees from importing the unit envelope
 * before `T3.P01.S04` activates it. Staging needs the envelope's own resource
 * registry, so it belongs *inside* the inactive subtree and is reached only
 * through the explicit `@portfolio/project-model/units` subpath. The F4-facing
 * half — the wider planner admission, the dispatcher entry and target
 * validation — stays in `f4/unit-acceptance.ts` and imports nothing from here.
 *
 * Staging rules (all tested):
 *
 * - every requested resource must resolve in this envelope's resource unit; a
 *   missing or unresolved one refuses the whole staging (no partial set). An
 *   external resource with bytes outside the project resolves through its pin's
 *   content hash, exactly as the F.1 resolver already answers, so a genuinely
 *   admitted pinned resource stages; a resource with neither revision nor pin is
 *   `repair-required` at resolution and never reaches staging;
 * - the staging is a **set** keyed by `kind:id`, so requesting the same resource
 *   twice stages it once;
 * - order is stable (sorted by `kind`, then `id`), so two equal requests produce
 *   equal staging and a replay is comparable;
 * - nothing is written. The coordinator's install commits the candidate that
 *   carries this staging; a refused staging stages nothing at all.
 */
import type { ReferenceReadContext, SemanticReference } from '../references/types';
import { resolveReference } from '../references/resolve';
import type { ShapeIssue } from '../strict-shape';
import type { ProjectEnvelope, ResourcePin } from './types';

/** One staged typed resource: the admitted subject and what it pins. */
export type StagedUnitResource = {
	readonly kind: string;
	readonly id: string;
	/**
	 * The concrete content identity **the resolver produced**, cross-checked against
	 * the envelope record it must have read: the resource's own revision, or its
	 * pin's content hash for external bytes. Never inferred or fabricated.
	 *
	 * For a pinned external resource this is a **pin identity**, not a content-unit
	 * revision; `T3.P01.S04` consumers must not treat the two as interchangeable.
	 */
	readonly contentRevision: string;
	/** The external-bytes pin when this resource has one; `null` for in-project bytes. */
	readonly pin: ResourcePin | null;
};

export type UnitResourceStaging =
	| { readonly kind: 'staged'; readonly resources: readonly StagedUnitResource[] }
	| { readonly kind: 'refused'; readonly issues: readonly ShapeIssue[] };

/**
 * Stage the typed resources one unit operation needs.
 *
 * `context` is the supplied F.2 read context (envelope + dependency lock); this
 * function performs no ambient lookup and never repairs a reference. A target
 * that is not a typed-resource reference is reported rather than skipped, so a
 * caller cannot mistake a Layout or Camera target for a staged resource.
 */
export function stageUnitResources(
	envelope: ProjectEnvelope,
	targets: readonly SemanticReference[],
	context: ReferenceReadContext
): UnitResourceStaging {
	const issues: ShapeIssue[] = [];
	const staged = new Map<string, StagedUnitResource>();
	const available = new Map<string, (typeof envelope.units.resources.data.resources)[number]>(
		envelope.units.resources.data.resources.map((resource) => [`${resource.kind}:${resource.id}`, resource])
	);
	for (const [index, target] of targets.entries()) {
		const path = `$.targets[${index}]`;
		if (!target.domain.startsWith('resource:')) {
			issues.push({
				path,
				code: 'unsupported-target',
				message: `${target.domain} is not a typed-resource target; only resources are staged`
			});
			continue;
		}
		// Resolution is the authority on the subject: a typed-resource reference
		// addresses a `resource` subject whose owning domain names the kind, so the
		// staging key comes from the resolved domain rather than a caller-shaped id.
		const resolution = resolveReference(target, context);
		if (resolution.kind === 'failed') {
			issues.push({ path, code: resolution.code, message: resolution.message });
			continue;
		}
		const kind = resolution.subject.domain.slice('resource:'.length);
		const key = `${kind}:${resolution.subject.subject.id}`;
		if (staged.has(key)) continue;
		const resource = available.get(key);
		if (resource === undefined) {
			issues.push({
				path,
				code: 'unresolved-resource',
				message: `the envelope's resource registry carries no "${key}"`
			});
			continue;
		}
		// One authority, checked: the resolver answers the concrete revision (the
		// resource's own revision, or its pin hash when that is all it has). The
		// envelope field that answer is derived from is compared against it, so a
		// staged record cannot name a revision the resolver never produced.
		const expectedRevision = resource.contentRevision ?? resource.pin?.hash ?? null;
		if (expectedRevision === null) {
			issues.push({
				path,
				code: 'repair-required',
				message: `resource "${key}" has neither a content revision nor an external-bytes pin`
			});
			continue;
		}
		if (resolution.subject.contentRevision !== expectedRevision) {
			issues.push({
				path,
				code: 'unresolved-resource',
				message: `resource "${key}" resolves to "${resolution.subject.contentRevision}" but the envelope records "${expectedRevision}"`
			});
			continue;
		}
		// A resource may legitimately carry **both** a content revision and an
		// external-bytes pin: the revision names the unit content, while the pin
		// records the immutable bytes (hash/MIME/size/locator) that content depends on.
		// They are different identities, not two answers to one question, so the pin is
		// carried as staging metadata rather than compared with the revision.
		staged.set(key, {
			kind: resource.kind,
			id: resource.id,
			contentRevision: expectedRevision,
			pin: resource.pin
		});
	}
	if (issues.length > 0) return { kind: 'refused', issues };
	const resources = [...staged.values()].sort((left, right) =>
		left.kind === right.kind ? left.id.localeCompare(right.id) : left.kind.localeCompare(right.kind)
	);
	return { kind: 'staged', resources };
}
