/**
 * `F4.intent-acceptance@1:unit-acceptance-v1` — the F.2 admission half
 * (T3.P01.S05).
 *
 * The landed coordinator installs, mints revisions, keeps the one bounded
 * history and enforces stale/epoch rules. This module is the **source adapter**
 * it needs for an F.2 envelope, and it deliberately owns no coordinator, no
 * history and no revision mint:
 *
 * - **Structure** is the agreed envelope validator's (`validateProjectEnvelope`).
 * - **Derived identity** — each unit's `contentRevision` and each unit-scoped
 *   lock entry's revision — is recomputed from the candidate's own data, because
 *   a revision is a derived fact, not authored input. A caller cannot install a
 *   header or lock that disagrees with the bytes it carries.
 * - **Lock resolution** runs through the same F.1 unit resolvers the reference
 *   path uses, so a lock entry whose subject does not exist, or whose revision
 *   is not the unit revision it claims, refuses the whole candidate.
 * - **Resource closure** (a pinned resource the registry cannot satisfy, a lock
 *   pin that disagrees with the registry) refuses acceptance; a repairable
 *   authored diagnostic (`unresolved-view`, `unresolved-presentation`) stays a
 *   diagnostic, exactly as F.2 defines it.
 *
 * The adapter is constructed with the profile the host grants: a compound host
 * may change more than the planner's primary domain; a resource-staging host may
 * change the resource unit and lock. That mirrors `createUnitPlannerRegistry`'s
 * admission so registration and acceptance cannot disagree.
 *
 * Runtime-safe: no editor, renderer, Svelte or Three import.
 */

import type { ShapeIssue } from '../strict-shape';
import type { SemanticReference } from '../references/types';
import { resolveReference } from '../references/resolve';
import { createUnitReadContext } from '../references/unit-resolution';
import type {
	AcceptanceSourceAdapter,
	SourceAdmission,
	AuthoringIntent,
	CapturedInput,
	AcceptedSnapshot
} from '../f4/types';
import type { PlannerRegistry, PrepareResult } from '../f4/prepare';
import { createUnitTargetInspector, prepareUnitIntent } from '../f4/unit-acceptance';
import {
	computeEnvelopeSourceContentId,
	computeUnitContentRevision,
	verifyUnitContentRevisions
} from './canonical';
import { serializeProjectEnvelope, validateProjectEnvelope, type EnvelopeClosureFinding } from './validate';
import { UNIT_DOMAINS, type ProjectEnvelope, type ProjectUnits, type UnitDomain } from './types';

/** The exact capability scope this adapter serves. */
export const UNIT_ACCEPTANCE_SCOPE = 'unit-acceptance-v1' as const;

/** The admitted source pair. */
export const UNIT_ENVELOPE_SOURCE_KIND = 'unit-envelope';
export const UNIT_ENVELOPE_SOURCE_VERSION = 1;

export type UnitAcceptanceAdapterOptions = {
	/** The registry grant: compound changes are admitted and checked as one operation. */
	readonly compound?: boolean;
	/** The registry grant: resource-unit and resource-lock changes are admitted. */
	readonly resourceStaging?: boolean;
};

export type UnitAcceptancePreparationOptions = UnitAcceptanceAdapterOptions & {
	readonly registry: PlannerRegistry<ProjectEnvelope>;
	/** The session epoch the reference context carries; not an acceptance identity. */
	readonly sessionEpoch?: string;
};

function issue(path: string, code: string, message: string): ShapeIssue {
	return { path, code, message };
}

/**
 * Recompute the derived identities of one candidate: every unit header's
 * `contentRevision`, and every **unit-scoped** lock entry's revision.
 *
 * A resource lock entry is not rewritten: its revision is the resource's own
 * content revision or its external-byte pin, both authored facts that
 * `validateProjectEnvelope`'s closure check verifies against the registry. Rewriting
 * an external pin here would fabricate a byte identity, which this provider never
 * does.
 */
export async function normalizeUnitEnvelope(envelope: ProjectEnvelope): Promise<ProjectEnvelope> {
	const declared = envelope.units;
	const [layout, scene, camera, experience, resources] = await Promise.all([
		computeUnitContentRevision(declared.layout.data),
		computeUnitContentRevision(declared.scene.data),
		computeUnitContentRevision(declared.camera.data),
		computeUnitContentRevision(declared.experience.data),
		computeUnitContentRevision(declared.resources.data)
	]);
	const units: ProjectUnits = {
		layout: { header: { ...declared.layout.header, contentRevision: layout }, data: declared.layout.data },
		scene: { header: { ...declared.scene.header, contentRevision: scene }, data: declared.scene.data },
		camera: { header: { ...declared.camera.header, contentRevision: camera }, data: declared.camera.data },
		experience: { header: { ...declared.experience.header, contentRevision: experience }, data: declared.experience.data },
		resources: { header: { ...declared.resources.header, contentRevision: resources }, data: declared.resources.data }
	};
	const unitRevision = (domain: UnitDomain): string => units[domain].header.contentRevision;
	const entries = envelope.dependencyLock.entries.map((entry) => {
		if (entry.domain.startsWith('resource:')) return entry;
		const domain = entry.domain as UnitDomain;
		if (!UNIT_DOMAINS.includes(domain)) return entry;
		return { ...entry, contentRevision: unitRevision(domain) };
	});
	return { ...envelope, units, dependencyLock: { ...envelope.dependencyLock, entries } };
}

function lockReference(entry: ProjectEnvelope['dependencyLock']['entries'][number]): SemanticReference {
	return {
		version: 1,
		domain: entry.domain,
		revision: { kind: 'exact', contentRevision: entry.contentRevision },
		subject: { kind: entry.subjectKind, id: entry.subjectId },
		instancePath: entry.instancePath,
		location: { kind: 'project-root' },
		componentId: null,
		capabilityId: null
	};
}

/**
 * Resolve every dependency-lock entry against the envelope and require the
 * revision it answered to be the revision the entry pins. A missing subject is a
 * lock failure, never a skipped entry.
 */
export async function verifyUnitDependencyLocks(envelope: ProjectEnvelope): Promise<ShapeIssue[]> {
	const sourceContentId = await computeEnvelopeSourceContentId(envelope);
	const context = createUnitReadContext({ envelope, sourceContentId, sessionEpoch: 'unit-lock-verification' });
	const issues: ShapeIssue[] = [];
	for (const [index, entry] of envelope.dependencyLock.entries.entries()) {
		const path = `$.dependencyLock.entries[${index}]`;
		const resolution = resolveReference(lockReference(entry), context);
		if (resolution.kind === 'failed') {
			issues.push(issue(path, resolution.code, resolution.message));
			continue;
		}
		// For a unit subject the resolver answers the unit's content revision; for a
		// typed resource it answers the resource revision or its pin hash. Both are
		// the concrete identity the entry must have pinned.
		if (resolution.subject.contentRevision !== entry.contentRevision) {
			issues.push(
				issue(
					path,
					'lock-revision-mismatch',
					`the lock pins "${entry.subjectId}" to ${entry.contentRevision} and the envelope resolves ${resolution.subject.contentRevision}`
				)
			);
		}
	}
	return issues;
}

function closureIssues(closure: readonly EnvelopeClosureFinding[]): ShapeIssue[] {
	return closure.map((finding) => issue(finding.path, finding.code, finding.message));
}

function changedDomains(before: ProjectEnvelope, after: ProjectEnvelope): UnitDomain[] {
	return UNIT_DOMAINS.filter((domain) => before.units[domain].header.contentRevision !== after.units[domain].header.contentRevision);
}

function lockChanged(before: ProjectEnvelope, after: ProjectEnvelope): boolean {
	const left = before.dependencyLock.entries.filter((entry) => entry.domain.startsWith('resource:'));
	const right = after.dependencyLock.entries.filter((entry) => entry.domain.startsWith('resource:'));
	return JSON.stringify(left) !== JSON.stringify(right);
}

/**
 * The F.2 source adapter for the landed coordinator.
 *
 * `admit` re-validates and normalizes the candidate; the coordinator then
 * installs the returned source in one step. A rejection leaves the previously
 * accepted envelope, history and resource bytes untouched.
 */
export function createUnitAcceptanceAdapter(
	options: UnitAcceptanceAdapterOptions = {}
): AcceptanceSourceAdapter<ProjectEnvelope> {
	const compound = options.compound === true;
	const resourceStaging = options.resourceStaging === true;

	async function admitCandidate(input: unknown): Promise<SourceAdmission<ProjectEnvelope>> {
		const validated = validateProjectEnvelope(input);
		if (!validated.success) {
			return { kind: 'rejected', code: 'invalid-envelope', message: 'The candidate is not a valid F.2 envelope', issues: validated.issues };
		}
		const normalized = await normalizeUnitEnvelope(validated.envelope);
		const revisionMismatches = await verifyUnitContentRevisions(normalized);
		if (revisionMismatches.length > 0) {
			return {
				kind: 'rejected',
				code: 'content-revision-mismatch',
				message: 'A unit content revision does not match its canonical data',
				issues: revisionMismatches.map((mismatch) =>
					issue(mismatch.path, 'content-revision-mismatch', `declared ${mismatch.declared}, recomputed ${mismatch.recomputed}`)
				)
			};
		}
		const lockIssues = await verifyUnitDependencyLocks(normalized);
		if (lockIssues.length > 0) {
			return { kind: 'rejected', code: 'lock-closure', message: 'The dependency lock does not resolve in this envelope', issues: lockIssues };
		}
		const revalidated = validateProjectEnvelope(normalized);
		if (!revalidated.success) {
			return { kind: 'rejected', code: 'invalid-envelope', message: 'The normalized candidate is not a valid envelope', issues: revalidated.issues };
		}
		if (revalidated.closure.length > 0) {
			return {
				kind: 'rejected',
				code: 'lock-closure',
				message: 'The envelope cannot satisfy an executable resource requirement',
				issues: closureIssues(revalidated.closure)
			};
		}
		// Repairable authored diagnostics stay diagnostics: F.2 admits an explicit
		// unresolved binding, and refusing it here would be a stricter contract than
		// the ratified one. Executable closure above is the blocking half.
		const canonicalJson = serializeProjectEnvelope(normalized);
		const sourceContentId = await computeEnvelopeSourceContentId(normalized);
		return {
			kind: 'admitted',
			source: normalized,
			canonicalJson,
			sourceContentId,
			blockingIssues: []
		};
	}

	return {
		sourceKind: UNIT_ENVELOPE_SOURCE_KIND,
		sourceVersion: UNIT_ENVELOPE_SOURCE_VERSION,
		admit: admitCandidate,
		validateChange(before, after, domain) {
			const issues: ShapeIssue[] = [];
			if (before.id !== after.id) issues.push(issue('$.id', 'project-mismatch', 'an accepted operation cannot change the project identity'));
			if (before.acceptedRevision.projectId !== after.acceptedRevision.projectId) {
				issues.push(issue('$.acceptedRevision.projectId', 'project-mismatch', 'an accepted operation cannot change the accepted project'));
			}
			const changed = changedDomains(before, after);
			if (!compound && changed.some((changedDomain) => changedDomain !== domain)) {
				issues.push(
					issue(
						'$.units',
						'unsupported-compound',
						`this admission changes one domain per operation; the candidate also changes ${changed.filter((item) => item !== domain).join(', ')}`
					)
				);
			}
			if (!resourceStaging && (changed.includes('resources') || lockChanged(before, after))) {
				issues.push(issue('$.units.resources', 'unsupported-resource', 'this admission does not grant resource staging or lock mutation'));
			}
			return issues;
		}
	};
}

/**
 * The coordinator's preparation seam for an F.2 registry: the same landed
 * dispatcher, with the target inspector bound to the **snapshot's** envelope.
 * A subject the snapshot does not resolve therefore refuses before planning.
 */
export function createUnitAcceptancePreparation(options: UnitAcceptancePreparationOptions): {
	readonly registry: PlannerRegistry<ProjectEnvelope>;
	prepare(
		snapshot: AcceptedSnapshot<ProjectEnvelope>,
		intent: AuthoringIntent,
		capturedInputs?: readonly CapturedInput[]
	): PrepareResult<ProjectEnvelope>;
} {
	const { registry } = options;
	return {
		registry,
		prepare(snapshot, intent, capturedInputs) {
			const context = createUnitReadContext({
				envelope: snapshot.domain.source,
				sourceContentId: snapshot.sourceContentId,
				sessionEpoch: options.sessionEpoch ?? 'unit-acceptance'
			});
			return prepareUnitIntent(registry, snapshot, intent, capturedInputs, {}, {
				inspectTargets: createUnitTargetInspector(context)
			});
		}
	};
}

