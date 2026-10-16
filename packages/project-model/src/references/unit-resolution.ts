/**
 * `F1.reference@1:unit-resolution-v1` — the additive F.2-backed extension.
 *
 * `references-v1` landed with a bounded current-domain read adapter that admits
 * Layout, Scene and read-only current Camera subjects and reports `incompatible`
 * for `project-lock` because no F.2 lock reader existed. This module supplies
 * that reader over the real `DependencyLock`, plus the subject kinds that only
 * an F.2 source can address: **Camera** views/connections, **Experience**
 * presentations/stops/guides/experiences and **typed resources**.
 *
 * It is additive in the strict sense: nothing in the landed reference or channel
 * behaviour is edited, `references-v1`'s conformance suite is untouched, and the
 * current-domain resolver still answers `incompatible` for `project-lock` when no
 * F.2 reader is admitted. A caller opts in by admitting this reader and these
 * resolvers.
 *
 * Two rules are deliberately stronger than "look it up":
 *
 * - a subject that appears more than once in the addressable scope is
 *   **ambiguous**, not first-match: it refuses with `incompatible` and a repair
 *   that asks for instance qualification;
 * - an unresolved resource keeps its typed repair identity. It is never resolved
 *   to a fabricated revision, and it is never `missing` — the binding exists and
 *   needs repair, which is a different answer.
 */

import { computeEnvelopeSourceContentId } from '../units/canonical';
import type { DependencyLock, ProjectEnvelope } from '../units/types';
import type {
	DependencyLockReader,
	ReferenceReadContext,
	ReferenceRepairAction,
	ReferenceResolution,
	ReferenceResolver,
	ReferenceResolverOutcome,
	SemanticReference
} from './types';
import { resolveReference } from './resolve';

const REACQUIRE: readonly ReferenceRepairAction[] = [
	{ kind: 'reacquire-reference', description: 'Re-resolve the subject from the supplied envelope before binding it again.' }
];

const QUALIFY: readonly ReferenceRepairAction[] = [
	{ kind: 'choose-subject', description: 'Qualify the subject with its owning instance path so the reference names exactly one subject.' }
];

function lockKeyOf(
	domain: string,
	subjectKind: string,
	subjectId: string,
	instancePath: readonly string[]
): string {
	return [domain, subjectKind, subjectId, instancePath.join('/')].join('|');
}

/**
 * An admitted `DependencyLockReader` over the F.2 lock.
 *
 * `projectId` is the envelope's own id: the landed `resolveReference` compares it
 * against a reference's `project-lock` revision before asking this reader, so a
 * lock can never answer for another project. A scope the lock does not pin
 * answers `null`, which the caller reports as `missing` — no ambient latest
 * lookup and no manufactured pin.
 */
export function createDependencyLockReader(projectId: string, lock: DependencyLock): DependencyLockReader {
	const byKey = new Map<string, string>();
	for (const entry of lock.entries) {
		byKey.set(lockKeyOf(entry.domain, entry.subjectKind, entry.subjectId, entry.instancePath), entry.contentRevision);
	}
	return {
		projectId,
		contentRevisionFor(reference: SemanticReference): string | null {
			return byKey.get(lockKeyOf(reference.domain, reference.subject.kind, reference.subject.id, reference.instancePath)) ?? null;
		}
	};
}

/**
 * One addressable subject in the envelope: its id, its owning container path and
 * how it answers. `revision` is the subject's exact content revision; a subject
 * whose bytes are not resolved yet carries `repair` instead, so a resolver never
 * invents a revision for it.
 */
type UnitSubject = {
	id: string;
	instancePath: readonly string[];
	revision: string | null;
	repair?: string;
};

function scoped(subjects: readonly UnitSubject[], reference: SemanticReference): ReferenceResolverOutcome {
	const owner = reference.instancePath[0];
	const byId = subjects.filter((subject) => subject.id === reference.subject.id);
	// A qualified reference is restricted to the container it names; an
	// unqualified one is allowed to find a subject that is genuinely unique. A
	// qualification that names the wrong container is `missing`, never a silent
	// global search that happens to succeed.
	const candidates = owner === undefined ? byId : byId.filter((subject) => subject.instancePath[0] === owner);
	if (candidates.length === 0) {
		return {
			kind: 'missing',
			message:
				byId.length > 0 && owner !== undefined
					? `${reference.subject.kind} "${reference.subject.id}" is not addressable under instance "${owner}"`
					: `no ${reference.subject.kind} "${reference.subject.id}" is addressable in this envelope`,
			repairs: REACQUIRE
		};
	}
	if (candidates.length > 1) {
		return {
			kind: 'repair-required',
			message: `${candidates.length} ${reference.subject.kind} subjects carry the id "${reference.subject.id}"; the reference names no instance`,
			repairs: QUALIFY
		};
	}
	const found = candidates[0]!;
	if (found.revision === null) {
		return {
			kind: 'repair-required',
			message: found.repair ?? `${reference.subject.kind} "${reference.subject.id}" has no resolved content revision`,
			repairs: REACQUIRE
		};
	}
	return { kind: 'resolved', contentRevision: found.revision, location: { kind: 'project-root' } };
}

function resolver(
	id: string,
	domain: ReferenceResolver['domain'],
	subjectKinds: readonly string[],
	subjects: readonly UnitSubject[]
): ReferenceResolver {
	return {
		id,
		domain,
		subjectKinds,
		owner: domain,
		resolve: (reference) => scoped(subjects, reference)
	};
}

/**
 * The subject resolvers an F.2 envelope supplies.
 *
 * Only the kinds this extension declares are admitted: Camera views and
 * connections, Experience presentations/stops/guides and the Experiences
 * themselves, and one resolver per admitted typed-resource kind present in the
 * registry. Layout and Scene subjects keep their landed current-domain adapters
 * over the current source; an F.2 Layout/Scene resolver is deliberately not
 * invented here, because the source transition that would own it is
 * `T3.P01.S04`'s.
 *
 * A resource resolves to its exact content revision, or to its pin's content
 * hash when the bytes are external. A resource with neither is `repair-required`
 * and answers with its own authored diagnostic — never `missing`, because the
 * binding exists and needs repair.
 */
export function createUnitSubjectResolvers(envelope: ProjectEnvelope): ReferenceResolver[] {
	const cameraRevision = envelope.units.camera.header.contentRevision;
	const experienceRevision = envelope.units.experience.header.contentRevision;
	const resolvers: ReferenceResolver[] = [
		resolver(
			'unit.camera@1',
			'camera',
			['view', 'connection'],
			[
				...envelope.units.camera.data.views.map((view) => ({ id: view.id, instancePath: [] as readonly string[], revision: cameraRevision })),
				...envelope.units.camera.data.connections.map((connection) => ({
					id: connection.id,
					instancePath: [] as readonly string[],
					revision: cameraRevision
				}))
			]
		),
		resolver(
			'unit.experience@1',
			'experience',
			['experience', 'guide', 'stop', 'presentation'],
			envelope.units.experience.data.experiences.flatMap((experience) => [
				{ id: experience.id, instancePath: [experience.id], revision: experienceRevision },
				...experience.guides.map((guide) => ({ id: guide.id, instancePath: [experience.id], revision: experienceRevision })),
				...experience.stops.map((stop) => ({ id: stop.id, instancePath: [experience.id], revision: experienceRevision })),
				...experience.presentations.map((presentation) => ({
					id: presentation.id,
					instancePath: [experience.id],
					revision: experienceRevision
				}))
			])
		)
	];
	const byDomain = new Map<string, UnitSubject[]>();
	for (const resource of envelope.units.resources.data.resources) {
		const subjects = byDomain.get(resource.kind) ?? [];
		subjects.push({
			id: resource.id,
			instancePath: [],
			revision: resource.contentRevision ?? resource.pin?.hash ?? null,
			...(resource.unresolved === null
				? {}
				: { repair: resource.unresolved.message })
		});
		byDomain.set(resource.kind, subjects);
	}
	for (const [kind, subjects] of byDomain) {
		resolvers.push(resolver(`unit.resource.${kind}@1`, `resource:${kind}`, ['resource'], subjects));
	}
	return resolvers;
}

export type UnitResolutionInput = {
	envelope: ProjectEnvelope;
	/** The accepted snapshot's own content identity; never derived from the reference. */
	sourceContentId: string;
	sessionEpoch: ReferenceReadContext['sessionEpoch'];
	generationId?: string | null;
	supportedExtensions?: readonly string[];
	/** `null` (the default) admits the envelope's own lock; a caller may withhold it. */
	lock?: DependencyLockReader | null;
};

/** A `ReferenceReadContext` for one envelope: snapshot identity, lock and resolvers. */
export function createUnitReadContext(input: UnitResolutionInput): ReferenceReadContext {
	return {
		snapshot: { acceptedRevision: input.envelope.acceptedRevision, sourceContentId: input.sourceContentId },
		sessionEpoch: input.sessionEpoch,
		generationId: input.generationId ?? null,
		supportedExtensions: input.supportedExtensions ?? [],
		lock: input.lock === undefined ? createDependencyLockReader(input.envelope.id, input.envelope.dependencyLock) : input.lock,
		resolvers: createUnitSubjectResolvers(input.envelope),
		frameResolvers: []
	};
}

/** Resolve one reference against an envelope, computing its source-content identity. */
export async function resolveUnitReference(
	reference: unknown,
	input: Omit<UnitResolutionInput, 'sourceContentId'>
): Promise<ReferenceResolution> {
	const sourceContentId = await computeEnvelopeSourceContentId(input.envelope);
	return resolveReference(reference, createUnitReadContext({ ...input, sourceContentId }));
}

