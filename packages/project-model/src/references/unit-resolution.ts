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
	ReferenceLocation,
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
	/** The subject's canonical location; project-root when absent. */
	location?: ReferenceLocation;
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
	return { kind: 'resolved', contentRevision: found.revision, location: found.location ?? { kind: 'project-root' } };
}

/**
 * The F.2 Layout subject scope.
 *
 * Layout keeps the landed canonical location: the one authored Floor is the
 * level, every other subject lives on that level with an empty structure path,
 * and `project-root` is an equally valid qualification of the same subject. A
 * different level, a structure instance path, a component or a capability is a
 * qualification this unit cannot author and is reported as missing.
 */
function layoutScoped(
	subjects: readonly UnitSubject[],
	reference: SemanticReference,
	contentRevision: string,
	levelId: string
): ReferenceResolverOutcome {
	if (reference.componentId !== null || reference.capabilityId !== null) {
		return { kind: 'missing', message: 'this unit authors no such component or capability', repairs: REACQUIRE };
	}
	if (reference.location.kind === 'layout-location') {
		if (reference.location.levelId !== levelId) {
			return { kind: 'missing', message: `the Layout unit authors level "${levelId}" and no level "${reference.location.levelId}"`, repairs: REACQUIRE };
		}
		if (reference.location.structureInstancePath.length > 0) {
			return { kind: 'missing', message: 'the Layout unit authors no structure instances', repairs: REACQUIRE };
		}
	}
	if (reference.instancePath.length > 0) {
		return { kind: 'missing', message: 'the Layout unit authors no nested instances', repairs: REACQUIRE };
	}
	const found = subjects.find(
		(subject) => subject.kind === reference.subject.kind && subject.id === reference.subject.id
	);
	if (found === undefined) {
		return { kind: 'missing', message: `the Layout unit has no ${reference.subject.kind} "${reference.subject.id}"`, repairs: REACQUIRE };
	}
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
	return { kind: 'resolved', contentRevision: found.revision, location: found.location ?? { kind: 'project-root' } };
}

/**
 * A supplied lock may only answer for the envelope it was admitted for. The
 * landed layer compares the lock against the reference's project; a unit reader
 * additionally knows the project whose source it holds, so a lock for another
 * project is `missing` even when the reference names that same project — there is
 * no source here to resolve that identity against.
 */
function foreignLock(
	request: { readonly context: ReferenceReadContext },
	envelope: ProjectEnvelope
): ReferenceResolverOutcome | null {
	const lock = request.context.lock;
	if (lock === null || lock.projectId === envelope.id) return null;
	return {
		kind: 'missing',
		message: `the supplied dependency lock belongs to project "${lock.projectId}"`,
		repairs: REACQUIRE
	};
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
			const foreign = foreignLock(request, envelope);
			if (foreign !== null) return foreign;
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
	const layoutRevision = envelope.units.layout.header.contentRevision;
	const sceneRevision = envelope.units.scene.header.contentRevision;
	const cameraRevision = envelope.units.camera.header.contentRevision;
	const experienceRevision = envelope.units.experience.header.contentRevision;
	const layout = envelope.units.layout.data;
	const levelId = layout.floor.id;
	const layoutLocation: ReferenceLocation = { kind: 'layout-location', levelId, structureInstancePath: [] };
	const resolvers: ReferenceResolver[] = [
		{
			id: 'unit.layout@1',
			domain: 'layout',
			subjectKinds: ['level', 'room', 'wall', 'opening', 'junction', 'object'],
			owner: 'layout',
			resolve(reference, request) {
				const accepted = request.context.snapshot.acceptedRevision;
				const foreign = foreignLock(request, envelope);
				if (foreign !== null) return foreign;
				if (envelope.acceptedRevision.projectId !== envelope.id || accepted.projectId !== envelope.id) {
					return { kind: 'repair-required', message: 'the resolver and read context must name the same accepted project', repairs: REACQUIRE };
				}
				return layoutScoped(
					[
						{ kind: 'level', id: levelId, instancePath: [], revision: layoutRevision },
						...layout.rooms.map((room) => ({ kind: 'room', id: room.id, instancePath: [] as readonly string[], revision: layoutRevision, location: layoutLocation })),
						...layout.walls.map((wall) => ({ kind: 'wall', id: wall.id, instancePath: [] as readonly string[], revision: layoutRevision, location: layoutLocation })),
						...layout.openings.map((opening) => ({ kind: 'opening', id: opening.id, instancePath: [] as readonly string[], revision: layoutRevision, location: layoutLocation })),
						...layout.junctions.map((junction) => ({ kind: 'junction', id: junction.id, instancePath: [] as readonly string[], revision: layoutRevision, location: layoutLocation })),
						...layout.objects.map((object) => ({ kind: 'object', id: object.id, instancePath: [] as readonly string[], revision: layoutRevision, location: layoutLocation }))
					],
					reference,
					request.contentRevision,
					levelId
				);
			}
		},
		resolver(
			'unit.scene@1',
			'scene',
			['scene', 'entity', 'cluster', 'material', 'texture'],
			[
				{ kind: 'scene', id: envelope.id, instancePath: [], revision: sceneRevision },
				...envelope.units.scene.data.entities.map((entity) => ({ kind: 'entity', id: entity.id, instancePath: [] as readonly string[], revision: sceneRevision })),
				...(envelope.units.scene.data.clusters ?? []).map((cluster) => ({ kind: 'cluster', id: cluster.id, instancePath: [] as readonly string[], revision: sceneRevision })),
				...envelope.units.scene.data.materials.map((material) => ({ kind: 'material', id: material.id, instancePath: [] as readonly string[], revision: sceneRevision })),
				...envelope.units.scene.data.textures.map((texture) => ({ kind: 'texture', id: texture.id, instancePath: [] as readonly string[], revision: sceneRevision }))
			],
			envelope
		),
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
