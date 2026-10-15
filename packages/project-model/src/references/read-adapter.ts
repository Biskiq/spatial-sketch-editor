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
	FrameResolver,
	FrameResolverOutcome,
	ReferenceReadRequest,
	ReferenceRepairAction,
	ReferenceResolver,
	ReferenceResolverOutcome,
	SemanticReference
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
 */
export const CURRENT_CAMERA_SUBJECT_KINDS = ['navigation-node', 'connection'] as const;

/** The domain owners whose current sources author no frame identity. */
export const CURRENT_FRAMELESS_OWNERS = ['layout', 'scene', 'camera'] as const;

const CHOOSE_SUBJECT: readonly ReferenceRepairAction[] = [
	{ kind: 'choose-subject', description: 'Re-resolve the subject from the supplied snapshot before binding it again.' }
];

function resolved(request: ReferenceReadRequest): ReferenceResolverOutcome {
	return { kind: 'resolved', contentRevision: request.contentRevision };
}

function missing(message: string): ReferenceResolverOutcome {
	return { kind: 'missing', message, repairs: CHOOSE_SUBJECT };
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
function layoutResolver(source: ProjectDocument): ReferenceResolver {
	const floorId = source.layout.floor.id;
	return {
		id: 'current-layout-read-adapter',
		domain: 'layout',
		subjectKinds: [...CURRENT_LAYOUT_SUBJECT_KINDS],
		owner: 'layout',
		resolve(reference, request) {
			const level = levelProblem(reference, floorId);
			if (level !== null) return missing(level);
			if (reference.instancePath.length > 0) {
				return missing(
					`the current Layout authors no nested instances, so path "${reference.instancePath.join(' / ')}" cannot qualify "${reference.subject.id}"`
				);
			}
			switch (reference.subject.kind) {
				case 'level':
					return reference.subject.id === floorId
						? resolved(request)
						: missing(`the current Layout source authors level "${floorId}" and no level "${reference.subject.id}"`);
				case 'room':
					return byId(source.layout.rooms, reference.subject.id) === undefined
						? missing(`the current Layout source has no room "${reference.subject.id}"`)
						: resolved(request);
				case 'wall':
					return byId(source.layout.walls, reference.subject.id) === undefined
						? missing(`the current Layout source has no wall "${reference.subject.id}"`)
						: resolved(request);
				case 'opening':
					return byId(source.layout.openings, reference.subject.id) === undefined
						? missing(`the current Layout source has no opening "${reference.subject.id}"`)
						: resolved(request);
				case 'junction':
					return byId(source.layout.junctions, reference.subject.id) === undefined
						? missing(`the current Layout source has no junction "${reference.subject.id}"`)
						: resolved(request);
				case 'object':
					return byId(source.layout.objects, reference.subject.id) === undefined
						? missing(`the current Layout source has no object "${reference.subject.id}"`)
						: resolved(request);
				default:
					return missing(`the current Layout adapter does not resolve subject kind "${reference.subject.kind}"`);
			}
		}
	};
}

/**
 * The Scene resolver. `scene` is the document root, addressed with an empty
 * instance path; a clustered entity's canonical path is its cluster, so a bare
 * path for a clustered entity is refused instead of fabricating a second
 * identity for one subject.
 */
function sceneResolver(source: ProjectDocument): ReferenceResolver {
	const clusters = source.scene.clusters ?? [];
	return {
		id: 'current-scene-read-adapter',
		domain: 'scene',
		subjectKinds: [...CURRENT_SCENE_SUBJECT_KINDS],
		owner: 'scene',
		resolve(reference, request) {
			const qualification = rootQualificationProblem(reference, 'Scene');
			if (qualification !== null) return missing(qualification);
			const path = reference.instancePath;
			const id = reference.subject.id;
			if (reference.subject.kind === 'scene') {
				if (id !== source.id) return missing(`the supplied Scene document is the root of project "${source.id}", not "${id}"`);
				return path.length === 0 ? resolved(request) : missing('the Scene root carries no instance path');
			}
			if (reference.subject.kind === 'entity') {
				const entity = byId(source.scene.entities, id);
				if (entity === undefined) return missing(`the current Scene source has no entity "${id}"`);
				const owner = clusters.find((cluster) => cluster.memberIds.includes(id));
				if (path.length === 0) {
					return owner === undefined
						? resolved(request)
						: missing(`entity "${id}" belongs to cluster "${owner.id}"; address it with that instance path`);
				}
				if (path.length > 1) return missing(`the current Scene authors one cluster level, so path "${path.join(' / ')}" cannot qualify entity "${id}"`);
				const cluster = byId(clusters, path[0]!);
				if (cluster === undefined) return missing(`the current Scene source has no cluster "${path[0]}"`);
				if (!cluster.memberIds.includes(id)) return missing(`cluster "${cluster.id}" does not contain entity "${id}"`);
				return resolved(request);
			}
			if (path.length > 0) {
				return missing(`the current Scene authors no nested instances, so path "${path.join(' / ')}" cannot qualify "${id}"`);
			}
			switch (reference.subject.kind) {
				case 'cluster':
					return byId(clusters, id) === undefined
						? missing(`the current Scene source has no cluster "${id}"`)
						: resolved(request);
				case 'material':
					return byId(source.scene.materials, id) === undefined
						? missing(`the current Scene source has no material "${id}"`)
						: resolved(request);
				case 'texture':
					return byId(source.scene.textures, id) === undefined
						? missing(`the current Scene source has no texture "${id}"`)
						: resolved(request);
				default:
					return missing(`the current Scene adapter does not resolve subject kind "${reference.subject.kind}"`);
			}
		}
	};
}

/** The read-only current Camera resolver: navigation nodes and their connections. */
function cameraResolver(source: ProjectDocument): ReferenceResolver {
	return {
		id: 'current-camera-read-adapter',
		domain: 'camera',
		subjectKinds: [...CURRENT_CAMERA_SUBJECT_KINDS],
		owner: 'camera',
		resolve(reference, request) {
			const qualification = rootQualificationProblem(reference, 'Camera');
			if (qualification !== null) return missing(qualification);
			if (reference.instancePath.length > 0) {
				return missing(
					`the current Camera source authors no nested navigation instances, so path "${reference.instancePath.join(' / ')}" cannot qualify "${reference.subject.id}"`
				);
			}
			switch (reference.subject.kind) {
				case 'navigation-node':
					return byId(source.scene.navigationNodes, reference.subject.id) === undefined
						? missing(`the current Camera source has no navigation node "${reference.subject.id}"`)
						: resolved(request);
				case 'connection':
					return byId(source.scene.connections, reference.subject.id) === undefined
						? missing(`the current Camera source has no connection "${reference.subject.id}"`)
						: resolved(request);
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
 * Build the bounded current-domain adapters for one supplied source. The caller
 * supplies both this document and the matching `SnapshotIdentity` in its read
 * context, so a resolution always records the concrete revision it was read at.
 */
export function createCurrentDomainReadAdapters(source: ProjectDocument): {
	resolvers: readonly ReferenceResolver[];
	frameResolvers: readonly FrameResolver[];
} {
	return {
		resolvers: [layoutResolver(source), sceneResolver(source), cameraResolver(source)],
		frameResolvers: CURRENT_FRAMELESS_OWNERS.map((owner) => framelessAdapter(owner))
	};
}

/**
 * Build the resolver host for one supplied source: the current-domain adapters
 * plus the duplicate-registration guard every host carries.
 */
export function createCurrentDomainResolverHost(source: ProjectDocument): ReferenceResolverHost {
	const adapters = createCurrentDomainReadAdapters(source);
	return createReferenceResolverHost(adapters.resolvers, adapters.frameResolvers);
}
