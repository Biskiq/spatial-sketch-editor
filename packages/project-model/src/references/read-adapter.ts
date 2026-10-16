/**
 * F.1 current-domain read adapters — `references-v1` (AM-1).
 *
 * AM-1 admits **bounded** current-domain resolvers, and this module is the
 * bounded set: actual Layout entities, actual Scene entities and read-only
 * current Camera subjects from one supplied `ProjectDocument`. It is a read
 * adapter, not a compiler: it looks up the subject a reference names, verifies
 * the qualification the reference claims, and refuses with a reason otherwise.
 * It never repairs, never falls back to a name, label, index or nearest match,
 * and it fabricates no identity the current source does not author.
 *
 * **One source, one content, one acceptance.** These adapters are built for one
 * supplied source *and* the `SnapshotIdentity@1` that source is the accepted
 * content of — the phase's F1 draft puts that accepted metadata beside the current
 * source JSON, never inside it, so nothing in the document itself names its
 * revision. That snapshot carries two different identities and they are not
 * interchangeable. `acceptedRevision` is the opaque **acceptance** identity, fresh
 * on every source change *including Undo/Redo* (AM-1), so it names an acceptance
 * event, not a body of content. `sourceContentId` is the current-source
 * **content** identity, hashing the canonical serialized source, and it is what
 * `exact {contentRevision}` names here: AM-1's ratified row and the phase draft
 * both call `contentRevision` an *immutable domain/source content identity*, and
 * only the content identity has that property — an undo back to earlier contents
 * is a new acceptance of the same content.
 *
 * Every resolution therefore checks three things before it looks at a subject:
 * that the read context is that same supplied snapshot, that the supplied source
 * is that snapshot's project, and that the reference's revision names the content
 * this source is. The context check is an acceptance-identity check — a context
 * bound to one acceptance never impersonates another acceptance that happens to
 * hold identical content — while the revision check is a content-identity check,
 * so identical content under a different acceptance still resolves. An exact
 * reference naming other content, or a dependency lock resolving another project
 * or other content, is refused rather than answered from what this adapter holds;
 * that is what keeps a resolution from reporting one revision while reading
 * another, and what stops another project's locked identity from resolving
 * through this source. A resolution that does proceed records that concrete
 * content revision.
 *
 * The binding is a property of the pair, not a copy of the source: an adapter
 * serves the object it was built with, so a caller that mutates a document in
 * place must rebuild its adapters with the new accepted snapshot instead of
 * reusing the old ones. The frame adapters resolve no frame value at all today,
 * so no frame can be reported under a revision either.
 *
 * **Grouping is not instancing.** Scene clusters are named same-room member
 * groups with no prefab/definition model and no authored instance frame, so
 * membership is not part of a subject's identity: an entity keeps the canonical
 * identity its stable ID gives it, addressed with an empty instance path, and
 * moving it into or out of a cluster does not change how it is addressed. The
 * cluster itself stays addressable as its own subject. No assembly, instance or
 * occurrence identity is admitted ahead of the future assembly model.
 *
 * **Declared vs. authored identity.** `componentId` and `capabilityId` are
 * explicit nullable qualifications, and a non-null one only resolves where the
 * owning domain actually authors that identity. The current source authors none:
 * Layout/Scene entities carry no component identity, and the F.3 capability
 * vocabulary is declared per channel family rather than authored per subject. A
 * non-null qualifier is therefore refused as an unknown qualification — a typed
 * result, never nearest/name matching — while the same subject addressed without
 * it resolves. A later provider that authors component or capability identity
 * admits it in its own resolver.
 *
 * What stays out, and why:
 *
 * - Experience and typed-resource subjects have no current provider, so no
 *   resolver is registered for them; the host reports `incompatible`
 *   ("no resolver is admitted"), which is exactly AM-1's "explicitly unresolved
 *   until their provider lands" — never a fabricated resolved subject.
 * - Later unit/public resolvers need their own accepted capability, so they are
 *   not invented here.
 * - No Level schema, Structure schema or Room frame is introduced. The current
 *   Layout authors exactly one floor, and its ID is the current level
 *   qualification; a reference that names another level, or a structure
 *   instance path the current source cannot author, is `missing` rather than
 *   silently re-qualified.
 * - The current source authors no frame identity for any domain, so the frame
 *   adapters refuse every owner-qualified frame with `missing`. A Room without
 *   an authored frame cannot qualify, and neither centroid nor containment may
 *   invent one.
 *
 * Runtime-safe: package-internal imports only, no editor, renderer, Svelte or
 * Three dependency, and no mutation of the supplied source.
 */

import type { ProjectDocument } from '../project-types';
import { createReferenceResolverHost, type ReferenceResolverHost } from './resolve';
import type {
	FrameReference,
	ReferenceLocation,
	FrameResolver,
	FrameResolverOutcome,
	ReferenceFailureCode,
	ReferenceReadRequest,
	ReferenceRepairAction,
	ReferenceResolver,
	ReferenceResolverOutcome,
	SemanticReference,
	SnapshotIdentity
} from './types';

/**
 * The Layout subject kinds the current source publishes. Each is an actual
 * current entity carrying a stable ID; `level` is the document's single floor,
 * whose ID is also the current `layout-location` level qualification.
 */
export const CURRENT_LAYOUT_SUBJECT_KINDS = ['level', 'room', 'wall', 'opening', 'junction', 'object'] as const;

/** The Scene subject kinds the current source publishes, `scene` being the document root. */
export const CURRENT_SCENE_SUBJECT_KINDS = ['scene', 'entity', 'cluster', 'material', 'texture'] as const;

/**
 * The read-only Camera subjects the current source publishes. Current Camera
 * storage lives inside the Scene document (its own codec lands in the F.2
 * cutover), so these are read through the Scene document's authored data.
 *
 * `camera` is the Camera authority's root for the supplied project, addressed by
 * the project id exactly as the Scene root is. It authors nothing itself; it is
 * the owner a session-scoped Camera value (an F.3 Camera output channel) is
 * addressed to, because a session output is not an authored navigation node.
 */
export const CURRENT_CAMERA_SUBJECT_KINDS = ['camera', 'navigation-node', 'connection'] as const;

/** The domain owners whose current sources author no frame identity. */
export const CURRENT_FRAMELESS_OWNERS = ['layout', 'scene', 'camera'] as const;

/** One supplied source and the accepted snapshot identity it is the content of. */
export type CurrentDomainSource = {
	readonly source: ProjectDocument;
	readonly snapshot: SnapshotIdentity;
};

/** A resolver-level refusal: the same shape a resolver outcome uses for a failure. */
type AdapterRefusal = {
	readonly kind: Exclude<ReferenceFailureCode, 'incompatible'>;
	readonly message: string;
	readonly repairs: readonly ReferenceRepairAction[];
};

const CHOOSE_SUBJECT: readonly ReferenceRepairAction[] = [
	{ kind: 'choose-subject', description: 'Re-resolve the subject from the supplied snapshot before binding it again.' }
];
const REACQUIRE_REFERENCE: readonly ReferenceRepairAction[] = [
	{ kind: 'reacquire-reference', description: 'Re-resolve the subject from the current accepted snapshot before binding it again.' }
];
const RELOAD_SNAPSHOT: readonly ReferenceRepairAction[] = [
	{ kind: 'reload-snapshot', description: 'Reload the accepted snapshot this adapter holds the source for.' }
];

/**
 * A resolution records the concrete revision it verified and the subject's
 * canonical location. The binding check has already proved that revision is this
 * snapshot's content identity, so the value recorded is the content a consumer can
 * re-resolve against — never an acceptance token, which would name an acceptance
 * event rather than a body of content.
 */
function resolved(request: ReferenceReadRequest, location: ReferenceLocation): ReferenceResolverOutcome {
	return { kind: 'resolved', contentRevision: request.contentRevision, location };
}

const PROJECT_ROOT: ReferenceLocation = { kind: 'project-root' };

/**
 * The canonical location of a current Layout subject. The one authored floor is
 * the current level qualification, so every Layout entity is canonically located
 * on that level with an empty structure path, and the level itself at the project
 * root. A reference may still qualify an entity with `project-root`: it is a valid,
 * distinct F.1 reference that resolves to this same canonical subject.
 */
function layoutLocation(kind: string, floorId: string): ReferenceLocation {
	return kind === 'level' ? PROJECT_ROOT : { kind: 'layout-location', levelId: floorId, structureInstancePath: [] };
}

function missing(message: string): ReferenceResolverOutcome {
	return { kind: 'missing', message, repairs: CHOOSE_SUBJECT };
}

/** Both identities, so a message never makes an acceptance look like a content. */
function snapshotLabel(snapshot: SnapshotIdentity): string {
	return `${snapshot.acceptedRevision.projectId}@${snapshot.acceptedRevision.revisionId} (content "${snapshot.sourceContentId}")`;
}

function sameSnapshot(left: SnapshotIdentity, right: SnapshotIdentity): boolean {
	return (
		left.acceptedRevision.projectId === right.acceptedRevision.projectId &&
		left.acceptedRevision.revisionId === right.acceptedRevision.revisionId &&
		left.sourceContentId === right.sourceContentId
	);
}

/**
 * The snapshot/source/content binding every resolution is checked against: the
 * read context must be the supplied snapshot, the supplied source must be that
 * snapshot's project, and the reference's revision must name the content this
 * source is. The context and project checks are acceptance-identity checks; the
 * revision check is a content-identity check, so identical content under a
 * different acceptance still resolves while a context bound to that other
 * acceptance does not. A binding failure is never resolved around.
 */
function bindingRefusal(
	supplied: CurrentDomainSource,
	reference: SemanticReference,
	request: ReferenceReadRequest
): AdapterRefusal | null {
	const { source, snapshot } = supplied;
	const accepted = snapshot.acceptedRevision;
	if (!sameSnapshot(request.context.snapshot, snapshot)) {
		return {
			kind: 'repair-required',
			message: `the read context is snapshot "${snapshotLabel(request.context.snapshot)}" and this adapter reads "${snapshotLabel(snapshot)}"`,
			repairs: RELOAD_SNAPSHOT
		};
	}
	if (source.id !== accepted.projectId) {
		return {
			kind: 'repair-required',
			message: `the supplied source is project "${source.id}" and the bound snapshot is project "${accepted.projectId}"`,
			repairs: RELOAD_SNAPSHOT
		};
	}
	if (reference.revision.kind === 'exact') {
		if (reference.revision.contentRevision !== snapshot.sourceContentId) {
			return {
				kind: 'missing',
				message: `exact revision "${reference.revision.contentRevision}" names content this adapter does not hold: the supplied source of project "${accepted.projectId}" is content "${snapshot.sourceContentId}" (accepted revision "${accepted.revisionId}")`,
				repairs: REACQUIRE_REFERENCE
			};
		}
		return null;
	}
	if (reference.revision.projectId !== source.id) {
		return {
			kind: 'missing',
			message: `the dependency lock is consulted for project "${reference.revision.projectId}" and this adapter reads the source of project "${source.id}"; no other project's source is read`,
			repairs: RELOAD_SNAPSHOT
		};
	}
	if (request.contentRevision !== snapshot.sourceContentId) {
		return {
			kind: 'missing',
			message: `the dependency lock resolves project "${reference.revision.projectId}" to content "${request.contentRevision}" and the supplied source is content "${snapshot.sourceContentId}" (accepted revision "${accepted.revisionId}")`,
			repairs: RELOAD_SNAPSHOT
		};
	}
	return null;
}

/**
 * Refuse a component or capability qualification the current source does not
 * author. AM-1 requires an unknown component/capability to return a typed result
 * rather than a nearest or name-based match, and no current domain authors
 * either identity, so every non-null qualifier is that unknown qualification.
 */
function qualifierRefusal(reference: SemanticReference, owner: string, subject: string): AdapterRefusal | null {
	if (reference.componentId !== null) {
		return {
			kind: 'missing',
			message: `the current ${owner} source authors no component identity, so "${subject}" cannot be qualified by component "${reference.componentId}"`,
			repairs: CHOOSE_SUBJECT
		};
	}
	if (reference.capabilityId !== null) {
		return {
			kind: 'missing',
			message: `the current ${owner} source authors no capability identity, so "${subject}" cannot be qualified by capability "${reference.capabilityId}"`,
			repairs: CHOOSE_SUBJECT
		};
	}
	return null;
}

/**
 * Reject a location qualification that a domain cannot author. Every current
 * Layout subject lives under the one authored level, so a `project-root`
 * qualification or that level's own ID is admitted and anything else is missing.
 */
function levelProblem(reference: SemanticReference, floorId: string): string | null {
	if (reference.location.kind !== 'layout-location') return null;
	const { levelId, structureInstancePath } = reference.location;
	if (levelId !== floorId) {
		return `the current Layout source authors one level ("${floorId}") and no level "${levelId}"`;
	}
	if (structureInstancePath.length > 0) {
		return `the current Layout source authors no structure instances, so path "${structureInstancePath.join(' / ')}" cannot qualify a subject`;
	}
	return null;
}

/**
 * A Scene, Camera or root-level subject carries `project-root` qualification. A
 * `layout-location` on such a subject is not a missing entity but a
 * qualification the source cannot author, and it is refused as such.
 */
function rootQualificationProblem(reference: SemanticReference, domain: string): string | null {
	if (reference.location.kind === 'project-root') return null;
	return `a ${domain} subject cannot be qualified by a Layout location`;
}

function byId<T extends { id: string }>(items: readonly T[], id: string): T | undefined {
	return items.find((item) => item.id === id);
}

/** The Layout resolver: one lookup per admitted subject kind, no name fallback. */
function layoutResolver(supplied: CurrentDomainSource): ReferenceResolver {
	const floorId = supplied.source.layout.floor.id;
	return {
		id: 'current-layout-read-adapter',
		domain: 'layout',
		subjectKinds: [...CURRENT_LAYOUT_SUBJECT_KINDS],
		owner: 'layout',
		resolve(reference, request) {
			const binding = bindingRefusal(supplied, reference, request);
			if (binding !== null) return binding;
			const qualifier = qualifierRefusal(reference, 'Layout', `${reference.subject.kind} "${reference.subject.id}"`);
			if (qualifier !== null) return qualifier;
			const level = levelProblem(reference, floorId);
			if (level !== null) return missing(level);
			if (reference.instancePath.length > 0) {
				return missing(
					`the current Layout authors no nested instances, so path "${reference.instancePath.join(' / ')}" cannot qualify "${reference.subject.id}"`
				);
			}
			const found = resolved(request, layoutLocation(reference.subject.kind, floorId));
			switch (reference.subject.kind) {
				case 'level':
					return reference.subject.id === floorId
						? found
						: missing(`the current Layout source authors level "${floorId}" and no level "${reference.subject.id}"`);
				case 'room':
					return byId(supplied.source.layout.rooms, reference.subject.id) === undefined
						? missing(`the current Layout source has no room "${reference.subject.id}"`)
						: found;
				case 'wall':
					return byId(supplied.source.layout.walls, reference.subject.id) === undefined
						? missing(`the current Layout source has no wall "${reference.subject.id}"`)
						: found;
				case 'opening':
					return byId(supplied.source.layout.openings, reference.subject.id) === undefined
						? missing(`the current Layout source has no opening "${reference.subject.id}"`)
						: found;
				case 'junction':
					return byId(supplied.source.layout.junctions, reference.subject.id) === undefined
						? missing(`the current Layout source has no junction "${reference.subject.id}"`)
						: found;
				case 'object':
					return byId(supplied.source.layout.objects, reference.subject.id) === undefined
						? missing(`the current Layout source has no object "${reference.subject.id}"`)
						: found;
				default:
					return missing(`the current Layout adapter does not resolve subject kind "${reference.subject.kind}"`);
			}
		}
	};
}

/**
 * The Scene resolver. `scene` is the document root and an entity is its stable
 * ID: the current Scene authors no instancing, and cluster membership is
 * grouping rather than an instance frame, so a member keeps the identity its ID
 * gives it and any instance path is a path the source cannot author.
 */
function sceneResolver(supplied: CurrentDomainSource): ReferenceResolver {
	const clusters = supplied.source.scene.clusters ?? [];
	return {
		id: 'current-scene-read-adapter',
		domain: 'scene',
		subjectKinds: [...CURRENT_SCENE_SUBJECT_KINDS],
		owner: 'scene',
		resolve(reference, request) {
			const binding = bindingRefusal(supplied, reference, request);
			if (binding !== null) return binding;
			const qualifier = qualifierRefusal(reference, 'Scene', `${reference.subject.kind} "${reference.subject.id}"`);
			if (qualifier !== null) return qualifier;
			const qualification = rootQualificationProblem(reference, 'Scene');
			if (qualification !== null) return missing(qualification);
			const path = reference.instancePath;
			const id = reference.subject.id;
			if (reference.subject.kind === 'scene') {
				if (id !== supplied.source.id) {
					return missing(`the supplied Scene document is the root of project "${supplied.source.id}", not "${id}"`);
				}
				return path.length === 0 ? resolved(request, PROJECT_ROOT) : missing('the Scene root carries no instance path');
			}
			if (path.length > 0) {
				return missing(
					`the current Scene authors no instances, so path "${path.join(' / ')}" cannot qualify "${id}"; cluster membership is grouping, not an instance identity`
				);
			}
			switch (reference.subject.kind) {
				case 'entity':
					return byId(supplied.source.scene.entities, id) === undefined
						? missing(`the current Scene source has no entity "${id}"`)
						: resolved(request, PROJECT_ROOT);
				case 'cluster':
					return byId(clusters, id) === undefined
						? missing(`the current Scene source has no cluster "${id}"`)
						: resolved(request, PROJECT_ROOT);
				case 'material':
					return byId(supplied.source.scene.materials, id) === undefined
						? missing(`the current Scene source has no material "${id}"`)
						: resolved(request, PROJECT_ROOT);
				case 'texture':
					return byId(supplied.source.scene.textures, id) === undefined
						? missing(`the current Scene source has no texture "${id}"`)
						: resolved(request, PROJECT_ROOT);
				default:
					return missing(`the current Scene adapter does not resolve subject kind "${reference.subject.kind}"`);
			}
		}
	};
}

/** The read-only current Camera resolver: the Camera root, navigation nodes and their connections. */
function cameraResolver(supplied: CurrentDomainSource): ReferenceResolver {
	return {
		id: 'current-camera-read-adapter',
		domain: 'camera',
		subjectKinds: [...CURRENT_CAMERA_SUBJECT_KINDS],
		owner: 'camera',
		resolve(reference, request) {
			const binding = bindingRefusal(supplied, reference, request);
			if (binding !== null) return binding;
			const qualifier = qualifierRefusal(reference, 'Camera', `${reference.subject.kind} "${reference.subject.id}"`);
			if (qualifier !== null) return qualifier;
			const qualification = rootQualificationProblem(reference, 'Camera');
			if (qualification !== null) return missing(qualification);
			if (reference.instancePath.length > 0) {
				return missing(
					`the current Camera source authors no nested navigation instances, so path "${reference.instancePath.join(' / ')}" cannot qualify "${reference.subject.id}"`
				);
			}
			switch (reference.subject.kind) {
				case 'camera':
					return reference.subject.id === supplied.source.id
						? resolved(request, PROJECT_ROOT)
						: missing(`the supplied source is the Camera authority of project "${supplied.source.id}", not "${reference.subject.id}"`);
				case 'navigation-node':
					return byId(supplied.source.scene.navigationNodes, reference.subject.id) === undefined
						? missing(`the current Camera source has no navigation node "${reference.subject.id}"`)
						: resolved(request, PROJECT_ROOT);
				case 'connection':
					return byId(supplied.source.scene.connections, reference.subject.id) === undefined
						? missing(`the current Camera source has no connection "${reference.subject.id}"`)
						: resolved(request, PROJECT_ROOT);
				default:
					return missing(`the current Camera adapter does not resolve subject kind "${reference.subject.kind}"`);
			}
		}
	};
}

/** A frame adapter for an owner whose current source authors no frame identity. */
function framelessAdapter(owner: 'layout' | 'scene' | 'camera'): FrameResolver {
	return {
		id: `current-${owner}-frame-adapter`,
		owner,
		resolve(frame: FrameReference): FrameResolverOutcome {
			const frameId = frame.kind === 'owner-frame' ? frame.frameId : 'project-world';
			return {
				kind: 'missing',
				message: `the current ${owner} source authors no frame identity, so "${frameId}" cannot qualify; a Room without an authored frame is not one`,
				repairs: [{ kind: 'choose-subject', description: 'Resolve through project-world until the owning domain authors a frame.' }]
			};
		}
	};
}

/**
 * Build the bounded current-domain adapters for one supplied source and the
 * accepted snapshot it is the content of. Both are supplied by the caller,
 * because the current source JSON does not name its own revision: the adapter
 * holds that accepted metadata beside the document.
 */
export function createCurrentDomainReadAdapters(
	source: ProjectDocument,
	snapshot: SnapshotIdentity
): {
	resolvers: readonly ReferenceResolver[];
	frameResolvers: readonly FrameResolver[];
} {
	const supplied: CurrentDomainSource = { source, snapshot };
	return {
		resolvers: [layoutResolver(supplied), sceneResolver(supplied), cameraResolver(supplied)],
		frameResolvers: CURRENT_FRAMELESS_OWNERS.map((owner) => framelessAdapter(owner))
	};
}

/**
 * Build the resolver host for one supplied source and its accepted snapshot: the
 * current-domain adapters bound to that snapshot, plus the duplicate-registration
 * guard every host carries.
 */
export function createCurrentDomainResolverHost(
	source: ProjectDocument,
	snapshot: SnapshotIdentity
): ReferenceResolverHost {
	const adapters = createCurrentDomainReadAdapters(source, snapshot);
	return createReferenceResolverHost(adapters.resolvers, adapters.frameResolvers);
}
