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

import { dependencyLockKey } from '../units/identity';
import { validateDependencyLock } from '../units/validate';
import { computeEnvelopeSourceContentId } from '../units/canonical';
import type { DependencyLock, ProjectEnvelope } from '../units/types';
import type {
	AcceptedRevision,
	DependencyLockReader,
	ReferenceReadContext,
	ReferenceFailureCode,
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

/**
 * An admitted `DependencyLockReader` over the F.2 lock.
 *
 * `projectId` is the envelope's own id: the landed `resolveReference` compares it
 * against a reference's `project-lock` revision before asking this reader, so a
 * lock can never answer for another project. A scope the lock does not pin
 * answers `null`, which the caller reports as `missing` — no ambient latest
 * lookup and no manufactured pin. Supplied units allow an owned subject to use
 * its actual owning-unit pin, as emitted by the source converter.
 */
export function createDependencyLockReader(
	projectId: string,
	lock: DependencyLock,
	units?: ProjectEnvelope['units']
): DependencyLockReader {
	const validated = validateDependencyLock(lock);
	if (!validated.success) throw new Error(validated.issues[0]!.message);
	const byKey = new Map<string, string>();
	for (const entry of validated.value.entries) {
		byKey.set(dependencyLockKey(entry.domain, entry.subjectKind, entry.subjectId, entry.instancePath), entry.contentRevision);
	}
	return {
		projectId,
		contentRevisionFor(reference: SemanticReference): string | null {
			const direct = byKey.get(dependencyLockKey(reference.domain, reference.subject.kind, reference.subject.id, reference.instancePath));
			if (direct !== undefined) return direct;
			// A domain unit pin covers its owned subjects. Match the supplied unit's
			// identity exactly; never substitute its current header revision for a pin.
			if (units !== undefined && (reference.domain === 'camera' || reference.domain === 'experience' || reference.domain === 'layout' || reference.domain === 'scene')) {
				const unit = units[reference.domain];
				return byKey.get(dependencyLockKey(reference.domain, 'unit', unit.header.unitId, [])) ?? null;
			}
			return null;
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
	kind: string;
	id: string;
	instancePath: readonly string[];
	revision: string | null;
	repair?: string;
	failure?: Exclude<ReferenceFailureCode, 'incompatible'>;
};

function scoped(subjects: readonly UnitSubject[], reference: SemanticReference, contentRevision: string): ReferenceResolverOutcome {
	if (reference.componentId !== null || reference.capabilityId !== null || reference.location.kind !== 'project-root') {
		return { kind: 'missing', message: 'this unit authors no such component, capability or Layout location', repairs: REACQUIRE };
	}
	const owner = reference.instancePath[0];
	const byId = subjects.filter((subject) => subject.kind === reference.subject.kind && subject.id === reference.subject.id);
	// A qualified reference is restricted to the container it names; an
	// unqualified one is allowed to find a subject that is genuinely unique. A
	// qualification that names the wrong container is `missing`, never a silent
	// global search that happens to succeed.
	const candidates = reference.instancePath.length === 0 ? byId : byId.filter((subject) =>
		subject.instancePath.length === reference.instancePath.length &&
		subject.instancePath.every((segment, index) => segment === reference.instancePath[index])
	);
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
	if (found.revision === null || found.repair !== undefined) {
		return {
			kind: found.failure ?? 'repair-required',
			message: found.repair ?? `${reference.subject.kind} "${reference.subject.id}" has no resolved content revision`,
			repairs: REACQUIRE
		};
	}
	if (contentRevision !== found.revision) {
		return { kind: 'repair-required', message: 'the reference revision names content this unit does not hold', repairs: REACQUIRE };
	}
	return { kind: 'resolved', contentRevision: found.revision, location: { kind: 'project-root' } };
}

function resolver(
	id: string,
	domain: ReferenceResolver['domain'],
	subjectKinds: readonly string[],
	subjects: readonly UnitSubject[],
	envelope: ProjectEnvelope
): ReferenceResolver {
	return {
		id,
		domain,
		subjectKinds,
		owner: domain,
		resolve: (reference, request) => {
			const accepted = request.context.snapshot.acceptedRevision;
			// Project identity binds the context to this envelope. The revision ids are
			// deliberately not compared: an F.2 envelope keeps the **baseline** revision
			// it was prepared from (history restoration is byte-exact), while
			// `snapshot.acceptedRevision` names the snapshot currently being read. A
			// later accepted revision therefore shares the envelope's embedded baseline
			// without being a different source.
			if (envelope.acceptedRevision.projectId !== envelope.id || accepted.projectId !== envelope.id) {
				return { kind: 'repair-required', message: 'the resolver and read context must name the same accepted project', repairs: REACQUIRE };
			}
			return scoped(subjects, reference, request.contentRevision);
		}
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
				...envelope.units.camera.data.views.map((view) => ({ kind: 'view', id: view.id, instancePath: [] as readonly string[], revision: cameraRevision })),
				...envelope.units.camera.data.connections.map((connection) => ({
					kind: 'connection',
					id: connection.id,
					instancePath: [] as readonly string[],
					revision: cameraRevision
				}))
			],
			envelope
		),
		resolver(
			'unit.experience@1',
			'experience',
			['experience', 'guide', 'stop', 'presentation'],
			envelope.units.experience.data.experiences.flatMap((experience) => [
				{ kind: 'experience', id: experience.id, instancePath: [experience.id], revision: experienceRevision },
				...experience.guides.map((guide) => ({ kind: 'guide', id: guide.id, instancePath: [experience.id], revision: experienceRevision })),
				...experience.stops.map((stop) => ({ kind: 'stop', id: stop.id, instancePath: [experience.id], revision: experienceRevision })),
				...experience.presentations.map((presentation) => ({
					kind: 'presentation',
					id: presentation.id,
					instancePath: [experience.id],
					revision: experienceRevision
				}))
			]),
			envelope
		)
	];
	const byDomain = new Map<string, UnitSubject[]>([['texture', []], ['asset', []]]);
	for (const resource of envelope.units.resources.data.resources) {
		const subjects = byDomain.get(resource.kind) ?? [];
		subjects.push({
			kind: 'resource',
			id: resource.id,
			instancePath: [],
			revision: resource.contentRevision ?? resource.pin?.hash ?? null,
			...(resource.unresolved === null
				? {}
				: { repair: resource.unresolved.message, failure: resource.unresolved.status === 'incompatible' ? 'repair-required' : resource.unresolved.status })
		});
		byDomain.set(resource.kind, subjects);
	}
	for (const [kind, subjects] of byDomain) {
		resolvers.push(resolver(`unit.resource.${kind}@1`, `resource:${kind}`, ['resource'], subjects, envelope));
	}
	return resolvers;
}

export type UnitResolutionInput = {
	envelope: ProjectEnvelope;
	/**
	 * The accepted snapshot's revision identity. Defaults to the envelope's
	 * embedded revision for a raw-envelope read; an accepted unit source must pass
	 * the coordinator's accepted revision explicitly, because the embedded value is
	 * the immutable baseline the candidate was prepared from.
	 */
	acceptedRevision?: AcceptedRevision;
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
		snapshot: { acceptedRevision: input.acceptedRevision ?? input.envelope.acceptedRevision, sourceContentId: input.sourceContentId },
		sessionEpoch: input.sessionEpoch,
		generationId: input.generationId ?? null,
		supportedExtensions: input.supportedExtensions ?? [],
		lock: input.lock === undefined ? createDependencyLockReader(input.envelope.id, input.envelope.dependencyLock, input.envelope.units) : input.lock,
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
