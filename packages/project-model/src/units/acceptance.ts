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
 * - **`acceptedRevision` is the baseline revision, not the installed one.** The
 *   landed coordinator installs the admitted source bytes unchanged and keeps
 *   the accepted revision as the snapshot identity; history restoration requires
 *   byte-exact source, so rewriting the embedded field on every install would
 *   break that invariant. The embedded value therefore names the revision the
 *   candidate was prepared from. Consumers take revision authority from
 *   `AcceptedSnapshot.acceptedRevision`; the Save capture stamps that revision
 *   into the persisted bytes at the persistence boundary.
 *
 * The adapter is constructed with the profile the host **grants**: a compound
 * host admits multi-domain installs; a resource-staging host admits resource
 * unit and lock changes. The grant is not a planner's licence. `validateChange`
 * receives the producing planner's whole admission and holds the candidate's
 * changed unit domains to that planner's declared write set — its `domain`, plus
 * a compound planner's `writes` — so an untargeted or Scene-targeted operation
 * cannot quietly change a neighbouring authority. Resource and lock changes keep
 * needing both the host's staging grant and the planner's `resources` grant.
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
import { computeEnvelopeSourceContentId, computeUnitContentRevision } from './canonical';
import { dependencyLockKey } from './identity';
import {
	freezePlainJsonSubgraph,
	isDeeplyFrozenPlainJson,
	serializeValidatedProjectEnvelope,
	validateProjectEnvelope,
	type EnvelopeClosureFinding
} from './validate';
import { UNIT_DOMAINS, type DomainUnit, type ProjectEnvelope, type ProjectUnits, type UnitDomain } from './types';

/** The exact capability scope this adapter serves. */
export const UNIT_ACCEPTANCE_SCOPE = 'unit-acceptance-v1' as const;

/** The admitted source pair. */
export const UNIT_ENVELOPE_SOURCE_KIND = 'unit-envelope';
export const UNIT_ENVELOPE_SOURCE_VERSION = 1;

/**
 * The durable database fence value for the clean source epoch. The migration
 * writes this exact literal; the Save path reads it from here so the schema and
 * the writer cannot drift.
 */
export const UNIT_ENVELOPE_SOURCE_FORMAT = 'unit-envelope-v1';

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
 *
 * This runs **before** an accepted revision exists (adapter admission) and after
 * persistence stamped it (Save). The read context therefore uses the envelope's
 * embedded revision, which is the preparation/baseline identity in the first case
 * and the saved revision in the second; neither is a second revision authority.
 */
export async function verifyUnitDependencyLocks(
	envelope: ProjectEnvelope,
	/**
	 * The caller's already-computed `computeEnvelopeSourceContentId` for exactly
	 * this envelope. It is an answer, not an input: the read context only needs a
	 * stable local identity, so a caller that has one passes it instead of paying
	 * for the same canonical hashing of the whole envelope twice.
	 */
	knownSourceContentId?: string
): Promise<ShapeIssue[]> {
	const sourceContentId = knownSourceContentId ?? (await computeEnvelopeSourceContentId(envelope));
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
/**
 * Admission answers keyed by the admitted *envelope object*.
 *
 * Only an envelope that `isDeeplyFrozenPlainJson` accepts can be cached, so the
 * key cannot change after the answer is stored (that predicate rejects accessors
 * and exotic prototypes, so a frozen view over mutable state cannot enter). The
 * answer's `source` is the normalized envelope, which is frozen here too; a
 * cache hit therefore returns the same value a second admission would compute —
 * including the canonical JSON and content id Undo/Redo compare against.
 */
const ADMITTED_BY_FROZEN_ENVELOPE = new WeakMap<object, SourceAdmission<ProjectEnvelope>>();

export function createUnitAcceptanceAdapter(
	options: UnitAcceptanceAdapterOptions = {}
): AcceptanceSourceAdapter<ProjectEnvelope> {
	const compound = options.compound === true;
	const resourceStaging = options.resourceStaging === true;

	async function admitCandidate(input: unknown): Promise<SourceAdmission<ProjectEnvelope>> {
		if (typeof input === 'object' && input !== null && isDeeplyFrozenPlainJson(input)) {
			const cached = ADMITTED_BY_FROZEN_ENVELOPE.get(input);
			if (cached !== undefined) return cached;
		}
		const validated = validateProjectEnvelope(input);
		if (!validated.success) {
			return { kind: 'rejected', code: 'invalid-envelope', message: 'The candidate is not a valid F.2 envelope', issues: validated.issues };
		}
		// Derived identity has exactly one author here: `normalizeUnitEnvelope` stamps
		// every unit header from that unit's own data. Re-hashing the headers it just
		// wrote (`verifyUnitContentRevisions`, still used by Save) could only disagree
		// if the digest were not a pure function of the data, so admission does not.
		// `normalizeUnitEnvelope` stamps only hex SHA-256 `contentRevision` strings on
		// unit headers and unit-scoped lock entries; every payload, resource lock entry
		// and `validated.closure` finding was already validated on `validated.envelope`
		// and is invariant under normalization, so no second envelope validation runs.
		const normalized = await normalizeUnitEnvelope(validated.envelope);
		const sourceContentId = await computeEnvelopeSourceContentId(normalized);
		const lockIssues = await verifyUnitDependencyLocks(normalized, sourceContentId);
		if (lockIssues.length > 0) {
			return { kind: 'rejected', code: 'lock-closure', message: 'The dependency lock does not resolve in this envelope', issues: lockIssues };
		}
		if (validated.closure.length > 0) {
			return {
				kind: 'rejected',
				code: 'lock-closure',
				message: 'The envelope cannot satisfy an executable resource requirement',
				issues: closureIssues(validated.closure)
			};
		}
		const canonicalJson = serializeValidatedProjectEnvelope(normalized);
		freezePlainJsonSubgraph(normalized);
		// Repairable authored diagnostics stay diagnostics: F.2 admits an explicit
		// unresolved binding, and refusing it here would be a stricter contract than
		// the ratified one. Executable closure above is the blocking half.
		//
		// The returned source is the coordinator's immutable install payload. Its
		// embedded `acceptedRevision` is deliberately not rewritten here: the
		// coordinator owns revision minting (see the module header).
		const admission: SourceAdmission<ProjectEnvelope> = {
			kind: 'admitted',
			source: normalized,
			canonicalJson,
			sourceContentId,
			blockingIssues: []
		};
		if (typeof input === 'object' && input !== null && isDeeplyFrozenPlainJson(input)) {
			ADMITTED_BY_FROZEN_ENVELOPE.set(input, admission);
		}
		ADMITTED_BY_FROZEN_ENVELOPE.set(normalized, admission);
		return admission;
	}

	/**
	 * Capture by content identity (D.4/H5).
	 *
	 * A unit is shared when **the whole unit** is the same value: its data hashes to
	 * the same content revision AND its header carries the same `unitId`,
	 * `formatVersion` and `domain`. The revision alone is not enough — it is a digest
	 * of `data` only, while `unitId` and `formatVersion` are authored header facts
	 * the envelope digest covers, so sharing on the revision alone could install the
	 * baseline's `unitId` under the captured revision and make the state disagree
	 * with its own `canonicalJson`.
	 *
	 * The dependency lock is shared only when it is the same value under the same
	 * rule: same length, and every entry equal in the identity `dependencyLockKey`
	 * owns (domain, subject kind, subject id, instance path), in the revision it
	 * pins, in the capabilities it requires and in its byte `pin`. `formatVersion` is
	 * a literal, so it cannot differ between two admitted envelopes.
	 *
	 * Precondition: both arguments are **admissions of the same project**, so their
	 * unit data is canonical. Revision equality is data equality under that
	 * precondition; an arbitrary object graph could differ in an `undefined`-valued
	 * key that the canonical digest drops, which is why this is a capture hook and
	 * not a general-purpose deduplicator.
	 */
	function shareUnchanged(captured: ProjectEnvelope, baseline: ProjectEnvelope): ProjectEnvelope {
		// Two admissions of different projects have no equal immutable parts to share:
		// the coordinator refuses such an install anyway, and a share across projects
		// would be a claim this hook cannot make.
		if (captured.id !== baseline.id) return captured;
		const units = { ...captured.units } as Record<UnitDomain, DomainUnit<unknown>>;
		for (const domain of UNIT_DOMAINS) {
			const declared = captured.units[domain] as DomainUnit<unknown> | undefined;
			const previous = baseline.units[domain] as DomainUnit<unknown> | undefined;
			// Not an admitted envelope: share nothing, rather than throw in a capture
			// path whose only caller always holds admitted values.
			if (declared === undefined || previous === undefined) continue;
			const sameHeader =
				declared.header !== undefined &&
				previous.header !== undefined &&
				declared.header.contentRevision === previous.header.contentRevision &&
				declared.header.domain === previous.header.domain &&
				declared.header.unitId === previous.header.unitId &&
				declared.header.formatVersion === previous.header.formatVersion;
			if (sameHeader) units[domain] = previous;
		}
		const sameLock =
			captured.dependencyLock.entries.length === baseline.dependencyLock.entries.length &&
			captured.dependencyLock.entries.every((entry, index) => {
				const previous = baseline.dependencyLock.entries[index];
				if (previous === undefined) return false;
				return (
					dependencyLockKey(entry.domain, entry.subjectKind, entry.subjectId, entry.instancePath) ===
						dependencyLockKey(previous.domain, previous.subjectKind, previous.subjectId, previous.instancePath) &&
					entry.contentRevision === previous.contentRevision &&
					entry.requiredCapabilities.length === previous.requiredCapabilities.length &&
					entry.requiredCapabilities.every((capability, position) => {
						const pinned = previous.requiredCapabilities[position];
						return pinned !== undefined && pinned.id === capability.id && pinned.version === capability.version;
					}) &&
					(entry.pin === previous.pin ||
						(entry.pin !== null &&
							previous.pin !== null &&
							entry.pin.hash === previous.pin.hash &&
							entry.pin.mime === previous.pin.mime &&
							entry.pin.size === previous.pin.size &&
							entry.pin.locator === previous.pin.locator))
				);
			});
		const shared: ProjectEnvelope = {
			...captured,
			units: units as ProjectUnits,
			dependencyLock: sameLock ? baseline.dependencyLock : captured.dependencyLock
		};
		freezePlainJsonSubgraph(shared);
		const admission = ADMITTED_BY_FROZEN_ENVELOPE.get(captured);
		if (admission !== undefined && admission.kind === 'admitted') {
			ADMITTED_BY_FROZEN_ENVELOPE.set(shared, {
				...admission,
				source: shared
			});
		}
		return shared;
	}

	return {
		sourceKind: UNIT_ENVELOPE_SOURCE_KIND,
		sourceVersion: UNIT_ENVELOPE_SOURCE_VERSION,
		admit: admitCandidate,
		shareUnchanged,
		validateChange(before, after, admission) {
			const issues: ShapeIssue[] = [];
			if (before.id !== after.id) issues.push(issue('$.id', 'project-mismatch', 'an accepted operation cannot change the project identity'));
			// The envelope's own fields are not a unit's to change. A planner owns one
			// domain unit (or an explicit resource lock); renaming the project or
			// rewriting its format is a replacement, not an authored operation.
			if (before.name !== after.name) {
				issues.push(issue('$.name', 'project-mismatch', 'an accepted operation cannot rename the project'));
			}
			if (before.formatVersion !== after.formatVersion) {
				issues.push(issue('$.formatVersion', 'project-mismatch', 'an accepted operation cannot change the envelope format'));
			}
			if (before.acceptedRevision.projectId !== after.acceptedRevision.projectId) {
				issues.push(issue('$.acceptedRevision.projectId', 'project-mismatch', 'an accepted operation cannot change the accepted project'));
			}
			// The embedded revision is source provenance, not an operator-editable
			// fact: the coordinator mints revision identity. A candidate that rewrites
			// it is not the operation's baseline source.
			if (before.acceptedRevision.revisionId !== after.acceptedRevision.revisionId) {
				issues.push(
					issue(
						'$.acceptedRevision.revisionId',
						'baseline-revision-mismatch',
						'an accepted operation cannot rewrite the baseline accepted revision'
					)
				);
			}
			const changed = changedDomains(before, after);
			// Two admissions hold, in this order: the host profile grants compound
			// installs at all, and the producing planner's declaration says which
			// domains this operation may write. An adapter-wide grant alone never
			// widens a planner, and an untargeted intent gets no exemption.
			if (!compound && changed.length > 1) {
				issues.push(
					issue(
						'$.units',
						'unsupported-compound',
						`this admission changes one domain per operation; the candidate changes ${changed.join(', ')}`
					)
				);
			}
			const permitted = new Set<string>([
				admission.domain,
				...(admission.compound ? admission.writes ?? [] : []),
				// A staged resource/lock change is the planner's resource grant plus the
				// host's staging grant, never a declared semantic write domain.
				...(resourceStaging && admission.resources ? ['resources'] : [])
			]);
			const outsideScope = changed.filter((changedDomain) => !permitted.has(changedDomain));
			if (outsideScope.length > 0) {
				issues.push(
					issue(
						'$.units',
						'out-of-scope-domain',
						`the producing planner declares writes in ${[...permitted].join(', ')}; the candidate also changes ${outsideScope.join(', ')}`
					)
				);
			}
			const resourceChange = changed.includes('resources') || lockChanged(before, after);
			if (resourceChange && !resourceStaging) {
				issues.push(issue('$.units.resources', 'unsupported-resource', 'this admission does not grant resource staging or lock mutation'));
			} else if (resourceChange && !admission.resources) {
				issues.push(issue('$.units.resources', 'unsupported-resource', 'the producing planner does not declare resource staging'));
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
			// The context names the **accepted** snapshot: its digest and the
			// coordinator's revision, not the envelope's embedded baseline revision.
			const context = createUnitReadContext({
				envelope: snapshot.domain.source,
				acceptedRevision: snapshot.acceptedRevision,
				sourceContentId: snapshot.sourceContentId,
				sessionEpoch: options.sessionEpoch ?? 'unit-acceptance'
			});
			return prepareUnitIntent(registry, snapshot, intent, capturedInputs, {}, {
				inspectTargets: createUnitTargetInspector(context)
			});
		}
	};
}

