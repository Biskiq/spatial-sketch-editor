/**
 * F.1 resolution — `references-v1` (AM-1).
 *
 * `resolveReference` evaluates one reference against **one supplied accepted
 * snapshot**; there is no ambient "latest" lookup anywhere in this module.
 * Resolution is a read: resolvers perform no repair, and every failure is a
 * typed result with the original reference and explicit repair actions.
 *
 * Domain resolution is delegated to registered resolvers, one per domain
 * authority. The common layer owns what no resolver may vary: strict validation,
 * revision resolution (including the project-lock refusal), domain and subject-kind
 * admission, the no-nearest/no-name rule and the resolved-subject shape. The
 * current read adapters admit Layout, Scene and read-only current Camera
 * subjects; Experience and typed-resource subjects stay explicitly unresolved
 * until their own providers land, which surfaces as `incompatible`.
 */

import { ShapeReader } from '../strict-shape';
import {
	REFERENCES_VERSION,
	type DerivedSourceRef,
	type DerivedSourceResolution,
	type FramePlacement,
	type FrameReference,
	type FrameResolution,
	type FrameResolver,
	type ReferenceFailureCode,
	type ReferenceReadContext,
	type ReferenceRepairAction,
	type ReferenceResolution,
	type ReferenceResolver,
	type ResolvedSubject,
	type SemanticReference
} from './types';
import { validateDerivedSourceRef, validateFrameReference, validateSemanticReference } from './validate';

export type ReferenceResolverHost = {
	readonly resolvers: readonly ReferenceResolver[];
	readonly frameResolvers: readonly FrameResolver[];
	/** Duplicate domain/owner registrations, which would make resolution ambiguous. */
	readonly problems: readonly string[];
};

/**
 * Build a resolver host. One resolver per domain and one per frame owner: two
 * resolvers for one authority would be a second owner of that identity, so the
 * duplicate is reported instead of silently shadowed.
 */
export function createReferenceResolverHost(
	resolvers: readonly ReferenceResolver[],
	frameResolvers: readonly FrameResolver[]
): ReferenceResolverHost {
	const problems: string[] = [];
	const domains = new Set<string>();
	for (const resolver of resolvers) {
		if (domains.has(resolver.domain)) problems.push(`two resolvers are registered for domain "${resolver.domain}"`);
		domains.add(resolver.domain);
	}
	const owners = new Set<string>();
	for (const resolver of frameResolvers) {
		if (owners.has(resolver.owner)) problems.push(`two frame resolvers are registered for owner "${resolver.owner}"`);
		owners.add(resolver.owner);
	}
	return { resolvers, frameResolvers, problems };
}

function failed(
	reference: SemanticReference,
	code: ReferenceFailureCode,
	message: string,
	repairs: readonly ReferenceRepairAction[]
): ReferenceResolution {
	return { kind: 'failed', reference, code, message, repairs };
}

const REACQUIRE: readonly ReferenceRepairAction[] = [
	{ kind: 'reacquire-reference', description: 'Re-resolve the subject from the current snapshot before binding it again.' }
];

/**
 * Resolve one `SemanticReference@1` against the supplied snapshot context.
 *
 * Order: strict validation (unsupported required extension and unsupported
 * domain/kind are `incompatible`), revision resolution (project-lock without an
 * admitted F.2 lock reader is `incompatible`; no lock is ever manufactured),
 * domain and subject-kind admission, then the registered resolver. The
 * resolution records its concrete revision.
 */
export function resolveReference(reference: unknown, context: ReferenceReadContext): ReferenceResolution {
	const validation = validateSemanticReference(reference, { supportedExtensions: context.supportedExtensions });
	if (!validation.success) {
		const first = validation.issues[0];
		const candidate = (reference ?? undefined) as SemanticReference;
		return failed(
			candidate,
			'incompatible',
			first === undefined ? 'the reference is not a valid references-v1 value' : first.message,
			REACQUIRE
		);
	}
	const value = validation.value;

	let contentRevision: string;
	if (value.revision.kind === 'exact') {
		contentRevision = value.revision.contentRevision;
	} else {
		if (context.lock === null) {
			return failed(
				value,
				'incompatible',
				'project-lock resolution needs an admitted F.2 dependency-lock reader; none is supplied and none is manufactured',
				[{ kind: 'reacquire-reference', description: 'Declare an exact content revision until an F.2 lock reader is admitted.' }]
			);
		}
		if (context.lock.projectId !== value.revision.projectId) {
			return failed(value, 'incompatible', `the supplied dependency lock belongs to project "${context.lock.projectId}"`, [
				{ kind: 'reload-snapshot', description: 'Reload the supplied accepted snapshot for the referenced project.' }
			]);
		}
		const locked = context.lock.contentRevisionFor(value);
		if (locked === null) {
			return failed(value, 'missing', `the dependency lock has no entry for "${value.subject.kind}:${value.subject.id}"`, REACQUIRE);
		}
		contentRevision = locked;
	}

	const resolver = context.resolvers.find((candidate) => candidate.domain === value.domain);
	if (resolver === undefined) {
		return failed(
			value,
			'incompatible',
			`no ${value.domain} resolver is admitted by this reader`,
			[{ kind: 'reacquire-reference', description: 'Wait for the owning domain provider to land, or use an admitted domain.' }]
		);
	}
	if (!resolver.subjectKinds.includes(value.subject.kind)) {
		return failed(
			value,
			'incompatible',
			`subject kind "${value.subject.kind}" is not addressable in domain "${value.domain}"`,
			[{ kind: 'choose-subject', description: 'Choose a subject kind the owning domain publishes.' }]
		);
	}

	const outcome = resolver.resolve(value, { context, contentRevision });
	if (outcome.kind !== 'resolved') {
		return failed(value, outcome.kind, outcome.message, outcome.repairs ?? REACQUIRE);
	}

	const subject: ResolvedSubject = {
		domain: value.domain,
		subject: value.subject,
		instancePath: [...value.instancePath],
		componentId: value.componentId,
		capabilityId: value.capabilityId,
		location: outcome.location,
		contentRevision: outcome.contentRevision,
		owner: resolver.owner
	};
	return { kind: 'resolved', reference: value, subject };
}

/**
 * Resolve a frame reference to its owner-provided placement. `project-world` is
 * the project origin frame with datum 0 and needs no resolver; every other frame
 * is owner-qualified and refuses when its owner supplies no authored frame — an
 * unauthored Room never qualifies by centroid, containment or proximity.
 */
export function resolveFrame(frame: unknown, context: ReferenceReadContext): FrameResolution {
	const validation = validateFrameReference(frame);
	if (!validation.success) {
		const candidate = (frame ?? undefined) as FrameReference;
		const first = validation.issues[0];
		return {
			kind: 'failed',
			frame: candidate,
			code: 'incompatible',
			message: first === undefined ? 'the frame is not a valid FrameReference@1 value' : first.message,
			repairs: REACQUIRE
		};
	}
	const value = validation.value;
	if (value.kind === 'project-world') {
		return { kind: 'resolved', frame: value, placement: { originMeters: [0, 0, 0], yawRadians: 0, datumMeters: 0 } };
	}

	const resolver = context.frameResolvers.find((candidate) => candidate.owner === value.owner);
	if (resolver === undefined) {
		return {
			kind: 'failed',
			frame: value,
			code: 'incompatible',
			message: `no ${value.owner} frame resolver is admitted by this reader`,
			repairs: REACQUIRE
		};
	}
	const outcome = resolver.resolve(value, context);
	if (outcome.kind !== 'resolved') {
		return { kind: 'failed', frame: value, code: outcome.kind, message: outcome.message, repairs: outcome.repairs ?? REACQUIRE };
	}
	const placement = validatePlacement(outcome.placement);
	if (placement === null) {
		return {
			kind: 'failed',
			frame: value,
			code: 'incompatible',
			message: `the ${value.owner} frame resolver returned a non-finite placement`,
			repairs: REACQUIRE
		};
	}
	return { kind: 'resolved', frame: value, placement };
}

function validatePlacement(placement: FramePlacement): FramePlacement | null {
	const reader = new ShapeReader();
	const record = reader.object(placement, '$', ['originMeters', 'yawRadians', 'datumMeters']);
	if (record === null) return null;
	const origin = reader.vector3(record.originMeters, '$.originMeters');
	const yaw = reader.number(record.yawRadians, '$.yawRadians');
	const datum = record.datumMeters === null ? null : reader.number(record.datumMeters, '$.datumMeters');
	if (reader.issues.length > 0 || origin === null || yaw === null || datum === undefined) return null;
	return { originMeters: origin, yawRadians: yaw, datumMeters: datum };
}

/**
 * Generation invalidation: a derived fragment is valid only for the generation it
 * was produced from. A recompile produces a new generation and every fragment of
 * the previous one expires.
 */
export function matchesGeneration(fragment: DerivedSourceRef, generationId: string | null): boolean {
	return generationId !== null && fragment.generationId === generationId;
}

/**
 * Resolve a runtime-only `DerivedSourceRef@1`: the fragment is checked against the
 * active generation first, then its canonical source is resolved. Selection stores
 * the canonical source, never the fragment identity.
 */
export function resolveDerivedSourceRef(
	fragment: unknown,
	context: ReferenceReadContext
): DerivedSourceResolution {
	const validation = validateDerivedSourceRef(fragment, { supportedExtensions: context.supportedExtensions });
	if (!validation.success) {
		const candidate = (fragment ?? undefined) as DerivedSourceRef;
		const first = validation.issues[0];
		return {
			kind: 'failed',
			fragment: candidate,
			code: 'incompatible',
			message: first === undefined ? 'the fragment is not a valid DerivedSourceRef@1 value' : first.message,
			repairs: REACQUIRE
		};
	}
	const value = validation.value;
	if (!matchesGeneration(value, context.generationId)) {
		return {
			kind: 'failed',
			fragment: value,
			code: 'stale-generation',
			message: `derived fragment belongs to generation "${value.generationId}" and the active generation is "${context.generationId ?? 'none'}"`,
			repairs: [{ kind: 'reacquire-reference', description: 'Re-derive the fragment from the active representation generation.' }]
		};
	}
	const source = resolveReference(value.source, context);
	if (source.kind !== 'resolved') {
		return { kind: 'failed', fragment: value, code: source.code, message: source.message, repairs: source.repairs };
	}
	return { kind: 'resolved', fragment: value, source: source.subject };
}

function compareIds(left: string, right: string): number {
	return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Compare two ordered stable-ID paths. No path segment is ever empty (an opaque id
 * is nonempty), so a shorter path sorts before a path that extends it.
 */
function compareIdPaths(left: readonly string[], right: readonly string[]): number {
	const length = Math.max(left.length, right.length);
	for (let index = 0; index < length; index += 1) {
		const order = compareIds(left[index] ?? '', right[index] ?? '');
		if (order !== 0) return order;
	}
	return 0;
}

/** The opaque id a revision context names: its content revision, or the locked project. */
function revisionId(revision: SemanticReference['revision']): string {
	return revision.kind === 'exact' ? revision.contentRevision : revision.projectId;
}

/**
 * Stable ordering between two references — by ID fields only, never a parsed
 * display label, instance order or render order.
 *
 * This is a **total** order over the core identity AM-1 declares, so two distinct
 * references never compare equal and a consumer may sort a selection and rely on
 * the result (`compareReferences(a, b) === 0` is exactly "the same reference").
 * The compared sequence is: domain, revision tag and its opaque id, subject kind,
 * subject id, component id, capability id, location tag, location level id, the
 * location structure-instance path, then the reference's instance path. Every part
 * is an opaque stable id or a declared tag.
 *
 * `version` is the fixed interface version rather than an identity, and
 * `extensions` are deliberately **not** compared: an extension entry carries no
 * payload, so an ignorable optional one must not change core reference identity,
 * and ordering by it would let exactly that happen.
 */
export function compareReferences(left: SemanticReference, right: SemanticReference): number {
	const fields: Array<[string, string]> = [
		[left.domain, right.domain],
		[left.revision.kind, right.revision.kind],
		[revisionId(left.revision), revisionId(right.revision)],
		[left.subject.kind, right.subject.kind],
		[left.subject.id, right.subject.id],
		[left.componentId ?? '', right.componentId ?? ''],
		[left.capabilityId ?? '', right.capabilityId ?? ''],
		[left.location.kind, right.location.kind],
		[
			left.location.kind === 'layout-location' ? left.location.levelId : '',
			right.location.kind === 'layout-location' ? right.location.levelId : ''
		]
	];
	for (const [a, b] of fields) {
		const order = compareIds(a, b);
		if (order !== 0) return order;
	}
	const locationPath = compareIdPaths(
		left.location.kind === 'layout-location' ? left.location.structureInstancePath : [],
		right.location.kind === 'layout-location' ? right.location.structureInstancePath : []
	);
	return locationPath !== 0 ? locationPath : compareIdPaths(left.instancePath, right.instancePath);
}

/** The exact version this reader implements, exposed for negotiation/registration. */
export const REFERENCE_INTERFACE_VERSION = REFERENCES_VERSION;
