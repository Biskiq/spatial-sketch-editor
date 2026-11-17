/**
 * A P20 project image as a typed `texture` resource (T2.S4b).
 *
 * A Finish image is the same immutable P20 bytes Artwork uses. The Scene keeps
 * two records for it and they always agree:
 *
 * - a `scene.textures` record whose id **is** the asset id and whose URI is
 *   `/project-assets/{id}`, which is what the resolver binds and what release
 *   pinning walks;
 * - a `texture` typed resource that pins those exact bytes, which is what the
 *   editor loader and the release manifest verify.
 *
 * This module owns the one translation from an imported image identity to that
 * resource. It refuses rather than repairs: a pin that is not sha256, a MIME
 * outside the three admitted formats, a size over the Artwork byte cap or an
 * asset id that is not a canonical project asset id yields `null`, so a Finish
 * can never name bytes nobody verified.
 *
 * Texture resources carry no dependency-lock entry: the lock exists to bind an
 * external model revision, while a project texture is already pinned by its
 * resource record. The unit validator's closure check is what proves that (a
 * `texture` resource needs no lock; a `model` resource does).
 */
import { ARTWORK_MAX_BYTES } from '../artwork-image';
import { isArtworkAssetId } from '../artwork';
import type { ProjectEnvelope, ResourcePin, TypedResource } from '../units/types';

/** The three image formats P20 and the Finish importer admit. */
export const FINISH_TEXTURE_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type FinishTextureMime = (typeof FINISH_TEXTURE_MIMES)[number];

/** The one canonical URI a project texture record may carry. */
export function finishTextureUri(assetId: string): string {
	return `/project-assets/${assetId}`;
}

const SHA256_IDENTITY = /^sha256-[0-9a-f]{64}$/;

export type FinishTexturePin = {
	readonly hash: string;
	readonly mime: string;
	readonly size: number;
	readonly locator: string;
};

/** Whether a value is a pin a Finish image may carry. */
export function isFinishTexturePin(value: unknown): value is FinishTexturePin {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const pin = value as Record<string, unknown>;
	return (
		typeof pin.hash === 'string' &&
		SHA256_IDENTITY.test(pin.hash) &&
		typeof pin.mime === 'string' &&
		(FINISH_TEXTURE_MIMES as readonly string[]).includes(pin.mime) &&
		typeof pin.size === 'number' &&
		Number.isSafeInteger(pin.size) &&
		pin.size > 0 &&
		pin.size <= ARTWORK_MAX_BYTES &&
		typeof pin.locator === 'string' &&
		pin.locator.length > 0
	);
}

/**
 * The `texture` resource one imported image installs, or `null` when the
 * identity or the pin is not admissible.
 *
 * The locator must be the asset's canonical `/project-assets/{id}` URI: the
 * release loader resolves resources by that locator, and a second form would be
 * a competing answer for the same bytes.
 */
export function finishTextureResource(input: {
	readonly assetId: string;
	readonly pin: unknown;
}): TypedResource | null {
	const { assetId, pin } = input;
	if (!isArtworkAssetId(assetId)) return null;
	if (!isFinishTexturePin(pin)) return null;
	if (pin.locator !== finishTextureUri(assetId)) return null;
	return {
		kind: 'texture',
		id: assetId,
		// The resource's content revision **is** its byte identity: the validator
		// admits a pinned resource without a separate revision, and a second
		// revision would be a competing answer for immutable bytes.
		contentRevision: pin.hash,
		pin: {
			hash: pin.hash,
			mime: pin.mime,
			size: pin.size,
			locator: pin.locator
		} satisfies ResourcePin,
		unresolved: null
	};
}

/** Whether two pins name the same bytes and the same locator. */
export function sameFinishTexturePin(left: ResourcePin | null, right: ResourcePin | null): boolean {
	if (left === null || right === null) return left === right;
	return (
		left.hash === right.hash &&
		left.mime === right.mime &&
		left.size === right.size &&
		left.locator === right.locator
	);
}

/**
 * Append one texture resource to an envelope, or refuse.
 *
 * A duplicate id is a refusal: the caller must have checked the existing record
 * first, and two answers for one id would be a defect. No lock entry is added —
 * a texture is not an external approved revision.
 */
export function withFinishTextureResource(
	envelope: ProjectEnvelope,
	resource: TypedResource
): ProjectEnvelope | null {
	if (resource.kind !== 'texture' || resource.pin === null) return null;
	const resources = envelope.units.resources.data.resources;
	if (resources.some((existing) => existing.kind === 'texture' && existing.id === resource.id)) {
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
		}
	};
}
