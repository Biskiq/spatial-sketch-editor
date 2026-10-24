/**
 * T2.P02.S02 — a creator model as a typed resource and a Scene placement.
 *
 * The resource kind, its retained source/recipe/report detail and its placement
 * definition are S01's resources format 2. This module owns the two pure
 * translations S02 adds:
 *
 * - **approval → resource + lock.** One approved immutable revision becomes one
 *   `model` resource entry and the exact dependency-lock entry that pins its
 *   derivative hash. The lock revision is the pin's hash, never a unit content
 *   revision: an external revision is a byte identity.
 * - **resource → normalized placement definition.** A Scene placement consumes
 *   the resource's confirmed metric scale, pivot, footprint and contact, so the
 *   planner never measures a mesh and never reads a second mutable catalogue.
 *
 * Both translations are total and refuse rather than repair. A resource whose
 * detail is incomplete, whose pin is not `model/gltf-binary`, or whose footprint
 * is degenerate yields no definition, so an unplaceable import cannot be put on
 * the floor by a fallback.
 */
import type { LayoutVec2 } from '@portfolio/layout-core';
import type { ProjectEnvelope, TypedResource } from '../units/types';
import type { DependencyLockEntry } from '../units/types';
import { definitionMetadataContentId } from './metadata-identity';
import type { NormalizedPlacementDefinition } from './types';

/** The recipe identity this module admits; a new version is a new record. */
export const CREATOR_MODEL_RECIPE = Object.freeze({ id: 'creator-import@1', version: 1 });

const SHA256_IDENTITY = /^sha256-[0-9a-f]{64}$/;
const MODEL_MIME = 'model/gltf-binary';
const DERIVATIVE_MAX_BYTES = 25 * 1024 * 1024;
const SOURCE_MAX_BYTES = 50 * 1024 * 1024;

/**
 * The durable facts one approval contributes to the authored resource.
 *
 * Server-side revision identities (`revisionId`, the composite `contentHash`)
 * are deliberately absent: they name the approval transaction, not the authored
 * document, and a later identical approval may answer a different pair.
 */
export type CreatorModelResourcePayload = {
	readonly derivative: {
		readonly hash: string;
		readonly mime: string;
		readonly size: number;
		readonly locator: string;
	};
	readonly source: {
		readonly manifestHash: string;
		readonly size: number;
		readonly fileCount: number;
	};
	readonly recipe: { readonly id: string; readonly version: number };
	readonly reportDigest: string;
	readonly placement: {
		readonly metresPerSourceUnit: number;
		readonly pivot: readonly [number, number, number];
		readonly footprint: { readonly width: number; readonly depth: number };
		readonly contactMinY: number;
	};
};

export type CreatorModelResourceEntry = {
	readonly resource: TypedResource;
	readonly lock: DependencyLockEntry;
};

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Validate one approval and turn it into the resource and lock the first
 * placement installs.
 *
 * `resourceId` is minted by the caller (a fresh opaque id); everything else is
 * the server's own answer, so this cannot pin bytes the server did not approve.
 */
export function creatorModelResourceEntry(
	resourceId: string,
	approval: CreatorModelResourcePayload
): CreatorModelResourceEntry | null {
	if (resourceId.trim().length === 0) return null;
	const derivative = approval.derivative;
	const placement = approval.placement;
	if (
		!SHA256_IDENTITY.test(derivative.hash) ||
		derivative.mime !== MODEL_MIME ||
		!Number.isSafeInteger(derivative.size) ||
		derivative.size <= 0 ||
		derivative.size > DERIVATIVE_MAX_BYTES ||
		derivative.locator.trim().length === 0 ||
		!SHA256_IDENTITY.test(approval.source.manifestHash) ||
		!Number.isSafeInteger(approval.source.size) ||
		approval.source.size < 0 ||
		approval.source.size > SOURCE_MAX_BYTES ||
		!Number.isSafeInteger(approval.source.fileCount) ||
		approval.source.fileCount < 1 ||
		approval.recipe.id !== CREATOR_MODEL_RECIPE.id ||
		approval.recipe.version !== CREATOR_MODEL_RECIPE.version ||
		!SHA256_IDENTITY.test(approval.reportDigest) ||
		!isFiniteNumber(placement.metresPerSourceUnit) ||
		placement.metresPerSourceUnit <= 0 ||
		placement.pivot.length !== 3 ||
		!placement.pivot.every(isFiniteNumber) ||
		!isFiniteNumber(placement.footprint.width) ||
		!isFiniteNumber(placement.footprint.depth) ||
		placement.footprint.width <= 0 ||
		placement.footprint.depth <= 0 ||
		!isFiniteNumber(placement.contactMinY)
	) {
		return null;
	}
	const resource: TypedResource = {
		kind: 'model',
		id: resourceId,
		// The resource's content revision **is** its derivative pin: the unit
		// validator requires exactly that, and a second content revision would be a
		// competing answer for the same immutable bytes.
		contentRevision: derivative.hash,
		pin: {
			hash: derivative.hash,
			mime: derivative.mime,
			size: derivative.size,
			locator: derivative.locator
		},
		unresolved: null,
		model: {
			source: {
				manifestHash: approval.source.manifestHash,
				size: approval.source.size,
				fileCount: approval.source.fileCount
			},
			recipe: { id: approval.recipe.id, version: approval.recipe.version },
			reportDigest: approval.reportDigest,
			placement: {
				metresPerSourceUnit: placement.metresPerSourceUnit,
				pivot: [placement.pivot[0], placement.pivot[1], placement.pivot[2]],
				footprint: { width: placement.footprint.width, depth: placement.footprint.depth },
				contactMinY: placement.contactMinY,
				placement: 'floor'
			}
		}
	};
	return { resource, lock: creatorModelLockEntry(resource) };
}

/** The captured payload that introduces one model resource with its entity. */
export function creatorModelResourcePayload(
	entry: CreatorModelResourceEntry
): { readonly id: string } & CreatorModelResourcePayload {
	const { resource } = entry;
	const detail = resource.model;
	if (resource.pin === null || detail === undefined) {
		throw new Error('A creator model resource payload needs a pin and its model detail.');
	}
	return {
		id: resource.id,
		derivative: {
			hash: resource.pin.hash,
			mime: resource.pin.mime,
			size: resource.pin.size,
			locator: resource.pin.locator
		},
		source: {
			manifestHash: detail.source.manifestHash,
			size: detail.source.size,
			fileCount: detail.source.fileCount
		},
		recipe: { id: detail.recipe.id, version: detail.recipe.version },
		reportDigest: detail.reportDigest,
		placement: {
			metresPerSourceUnit: detail.placement.metresPerSourceUnit,
			pivot: [detail.placement.pivot[0], detail.placement.pivot[1], detail.placement.pivot[2]],
			footprint: { width: detail.placement.footprint.width, depth: detail.placement.footprint.depth },
			contactMinY: detail.placement.contactMinY
		}
	};
}

/** The one lock entry that pins a model resource's derivative bytes. */
export function creatorModelLockEntry(resource: TypedResource): DependencyLockEntry {
	if (resource.kind !== 'model' || resource.pin === null) {
		throw new Error('A model lock entry needs a pinned model resource.');
	}
	return {
		domain: 'resource:model',
		subjectKind: 'resource',
		subjectId: resource.id,
		instancePath: [],
		contentRevision: resource.pin.hash,
		requiredCapabilities: [],
		pin: {
			hash: resource.pin.hash,
			mime: resource.pin.mime,
			size: resource.pin.size,
			locator: resource.pin.locator
		}
	};
}

/**
 * Add one resource and its lock to an envelope, or refuse.
 *
 * A duplicate id, a resource without its model detail or a lock that disagrees
 * with its pin is a refusal: the caller installs nothing, so a partially
 * registered model can never become placeable.
 */
export function withCreatorModelResource(
	envelope: ProjectEnvelope,
	entry: CreatorModelResourceEntry
): ProjectEnvelope | null {
	const { resource, lock } = entry;
	if (resource.kind !== 'model' || resource.pin === null || resource.model === undefined) return null;
	const resources = envelope.units.resources.data.resources;
	if (resources.some((existing) => existing.id === resource.id)) return null;
	if (envelope.dependencyLock.entries.some((existing) => existing.subjectId === lock.subjectId && existing.domain === lock.domain)) {
		return null;
	}
	if (lock.contentRevision !== resource.pin.hash || lock.pin === null || lock.pin.hash !== resource.pin.hash) {
		return null;
	}
	return {
		...envelope,
		units: {
			...envelope.units,
			resources: {
				header: { ...envelope.units.resources.header },
				data: {
					formatVersion: envelope.units.resources.data.formatVersion,
					resources: [...resources, resource]
				}
			}
		},
		dependencyLock: {
			...envelope.dependencyLock,
			entries: [...envelope.dependencyLock.entries, lock]
		}
	};
}

/**
 * The normalized placement definition of one approved model resource.
 *
 * `name` is the instance's proposed display name; the definition identity covers
 * it, so two instances placed under different names capture different metadata.
 * The footprint is the confirmed occupied rectangle around the derivative's
 * normalized pivot, and the contact is the derivative's own lowest local point.
 */
export async function creatorModelDefinition(
	resource: TypedResource,
	name: string
): Promise<NormalizedPlacementDefinition | null> {
	if (resource.kind !== 'model' || resource.pin === null || resource.model === undefined) return null;
	const placement = resource.model.placement;
	const width = placement.footprint.width;
	const depth = placement.footprint.depth;
	if (
		!isFiniteNumber(width) ||
		!isFiniteNumber(depth) ||
		width <= 0 ||
		depth <= 0 ||
		!isFiniteNumber(placement.contactMinY) ||
		placement.placement !== 'floor'
	) {
		return null;
	}
	const halfWidth = width / 2;
	const halfDepth = depth / 2;
	const footprintMeters: LayoutVec2[] = [
		[-halfWidth, -halfDepth],
		[halfWidth, -halfDepth],
		[halfWidth, halfDepth],
		[-halfWidth, halfDepth]
	];
	const trimmedName = name.trim().length === 0 ? 'Imported model' : name.trim();
	const facts = {
		definitionKey: creatorModelDefinitionKey(resource.id),
		admission: {
			operations: ['place-object'] as const,
			supportedSurfaces: ['floor'] as const,
			uprightOnly: true,
			// The recorded ingest report is the verification: the derivative's contact
			// and footprint came from the same measured bounds the recipe wrote.
			provenance: {
				kind: 'verified-model' as const,
				verificationId: `creator-import:${resource.model.reportDigest}`
			},
			exclusions: []
		},
		footprintMeters,
		contactMinY: placement.contactMinY,
		creationDefaults: {
			kind: 'model' as const,
			name: trimmedName,
			assetId: resource.id,
			fallback: 'generic' as const
		},
		renderNormalization: { defaultScale: 1 }
	};
	return { ...facts, metadataContentId: await definitionMetadataContentId(facts) };
}

/** One namespace for model-backed definitions, catalogue or creator. */
export function creatorModelDefinitionKey(resourceId: string): string {
	return `model:${resourceId}`;
}

/** The approved model resources an accepted envelope can place again. */
export function approvedModelResources(
	envelope: ProjectEnvelope
): readonly TypedResource[] {
	return envelope.units.resources.data.resources.filter(
		(resource) => resource.kind === 'model' && resource.pin !== null && resource.unresolved === null && resource.model !== undefined
	);
}
